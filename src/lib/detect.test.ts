import { describe, expect, it } from 'vitest';
import { analyzeSnapshot, parseTaggedClasses } from './detect';
import type { PageSnapshot, ScriptInfo } from './snapshot';

const script = (overrides: Partial<ScriptInfo> = {}): ScriptInfo => ({
	src: null,
	id: null,
	dataDomain: null,
	dataApi: null,
	inHead: true,
	inline: false,
	...overrides
});

const snapshot = (overrides: Partial<PageSnapshot> = {}): PageSnapshot => ({
	hostname: 'example.com',
	protocol: 'https:',
	global: { present: false, loaded: false, version: null, lib: null },
	scripts: [],
	csp: [],
	taggedClasses: [],
	...overrides
});

const ids = (s: PageSnapshot) => analyzeSnapshot(s).diagnostics.map((d) => d.id);

describe('analyzeSnapshot', () => {
	it('reports no Plausible on an empty page', () => {
		expect(analyzeSnapshot(snapshot())).toMatchObject({ status: 'none', variant: null });
	});

	it('detects the legacy script with domain and default endpoint', () => {
		const result = analyzeSnapshot(
			snapshot({
				global: { present: true, loaded: true, version: '2', lib: null },
				scripts: [script({ src: 'https://plausible.io/js/script.js', dataDomain: 'example.com' })]
			})
		);
		expect(result).toMatchObject({
			status: 'detected',
			variant: 'legacy',
			scriptSrc: 'https://plausible.io/js/script.js',
			domain: 'example.com',
			endpoint: 'https://plausible.io/api/event',
			version: '2'
		});
	});

	it('uses data-api as the endpoint, resolved against the page', () => {
		const result = analyzeSnapshot(
			snapshot({
				global: { present: true, loaded: true, version: null, lib: null },
				scripts: [
					script({
						src: 'https://example.com/js/script.js',
						dataDomain: 'example.com',
						dataApi: '/api/event'
					})
				]
			})
		);
		expect(result.endpoint).toBe('https://example.com/api/event');
	});

	it('detects the new web snippet', () => {
		const result = analyzeSnapshot(
			snapshot({
				global: { present: true, loaded: true, version: '30', lib: 'web' },
				scripts: [script({ src: 'https://plausible.io/js/pa-abc123.js' }), script({ inline: true })]
			})
		);
		expect(result).toMatchObject({
			status: 'detected',
			variant: 'web',
			domain: null,
			endpoint: null
		});
	});

	it('detects the npm package by its lib marker', () => {
		const result = analyzeSnapshot(
			snapshot({ global: { present: true, loaded: true, version: '1', lib: 'npm' } })
		);
		expect(result).toMatchObject({ status: 'detected', variant: 'npm' });
	});

	it('reports a script that did not load as blocked', () => {
		const result = analyzeSnapshot(
			snapshot({ scripts: [script({ src: 'https://plausible.io/js/script.js', dataDomain: 'x' })] })
		);
		expect(result).toMatchObject({ status: 'blocked', variant: 'legacy' });
		expect(result.diagnostics.map((d) => d.id)).toContain('not-loaded');
	});

	it('treats a stub without a loaded script as blocked', () => {
		const result = analyzeSnapshot(
			snapshot({
				global: { present: true, loaded: false, version: null, lib: null },
				scripts: [script({ inline: true })]
			})
		);
		expect(result.status).toBe('blocked');
	});

	it('warns about multiple scripts and scripts outside head', () => {
		const result = snapshot({
			global: { present: true, loaded: true, version: null, lib: null },
			scripts: [
				script({ src: 'https://plausible.io/js/script.js', dataDomain: 'a' }),
				script({ src: 'https://plausible.io/js/script.js', dataDomain: 'a', inHead: false })
			]
		});
		expect(ids(result)).toEqual(expect.arrayContaining(['multiple-scripts', 'not-in-head']));
	});

	it('notes that the tracker ignores localhost', () => {
		expect(ids(snapshot({ hostname: 'localhost' }))).toContain('localhost');
		expect(ids(snapshot({ hostname: '127.0.0.1' }))).toContain('localhost');
		expect(ids(snapshot({ hostname: '', protocol: 'file:' }))).toContain('localhost');
	});

	it('warns when a CSP meta tag does not allow the script origin', () => {
		const base = {
			global: { present: true, loaded: false, version: null, lib: null },
			scripts: [script({ src: 'https://plausible.io/js/script.js', dataDomain: 'a' })]
		};
		expect(ids(snapshot({ ...base, csp: ["script-src 'self'"] }))).toContain('csp');
		expect(ids(snapshot({ ...base, csp: ["default-src 'self'"] }))).toContain('csp');
		expect(
			ids(snapshot({ ...base, csp: ["script-src 'self' https://plausible.io"] }))
		).not.toContain('csp');
		expect(ids(snapshot({ ...base, csp: ['script-src https:'] }))).not.toContain('csp');
		expect(ids(snapshot({ ...base, csp: ['img-src *'] }))).not.toContain('csp');
	});

	it('flags malformed tagged-event classes', () => {
		const result = analyzeSnapshot(
			snapshot({ taggedClasses: ['plausible-event-name=Sign+Up', 'plausible-event-name'] })
		);
		expect(result.diagnostics.map((d) => d.id)).toContain('tagged-malformed');
		expect(result.taggedEvents).toEqual(['Sign Up']);
	});
});

describe('parseTaggedClasses', () => {
	it('reads names and props in both notations', () => {
		expect(
			parseTaggedClasses([
				'plausible-event-name=Sign+Up',
				'plausible-event-name--Download',
				'plausible-event-plan=pro',
				'plausible-event-',
				'plausible-event-name=',
				'plausible-event-plan'
			])
		).toEqual({
			names: ['Sign Up', 'Download'],
			malformed: ['plausible-event-', 'plausible-event-name=', 'plausible-event-plan']
		});
	});
});
