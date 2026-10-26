import { describe, expect, it } from 'vitest';
import {
	ALL_SITES_PATTERN,
	isPatternGranted,
	pendingCleanup,
	planRegistrations,
	shouldIgnoreHost,
	unneededGrants
} from './registration';
import { DEFAULT_SETTINGS, type Settings } from './settings';

const site = (host: string, includeSubdomains = false) => ({ host, includeSubdomains });
const settings = (overrides: Partial<Settings>): Settings => ({
	...DEFAULT_SETTINGS,
	...overrides
});
const state = (overrides: Partial<Parameters<typeof planRegistrations>[0]> = {}) => ({
	settings: DEFAULT_SETTINGS,
	granted: [],
	testHosts: [],
	flaggedOrigins: [],
	...overrides
});

describe('isPatternGranted', () => {
	it.each([
		['*://example.com/*', ['*://example.com/*'], true],
		['*://example.com/*', ['https://example.com/*'], true],
		['*://example.com/*', ['*://*/*'], true],
		['*://example.com/*', ['<all_urls>'], true],
		['*://www.example.com/*', ['*://*.example.com/*'], true],
		['*://example.com/*', ['*://*.example.com/*'], true],
		['*://*.example.com/*', ['*://example.com/*'], false],
		['*://*.example.com/*', ['*://*.example.com/*'], true],
		['*://example.com/*', ['*://other.com/*'], false],
		['*://example.com/*', ['*://badexample.com/*'], false],
		['*://example.com/*', [], false]
	])('%s with %j → %s', (pattern, granted, expected) => {
		expect(isPatternGranted(pattern, granted)).toBe(expected);
	});
});

describe('planRegistrations', () => {
	it('registers nothing by default', () => {
		expect(planRegistrations(state())).toEqual([]);
	});

	it('registers the ignore script for granted sites only', () => {
		const plan = planRegistrations(
			state({
				settings: settings({ sites: [site('a.com'), site('b.com', true)] }),
				granted: ['*://a.com/*']
			})
		);
		expect(plan).toEqual([
			expect.objectContaining({
				id: 'ignore',
				js: ['content/ignore.js'],
				matches: ['*://a.com/*'],
				runAt: 'document_start',
				world: 'ISOLATED',
				allFrames: false,
				persistAcrossSessions: true
			})
		]);
	});

	it('covers every site in global mode when the permission is granted', () => {
		const plan = planRegistrations(
			state({ settings: settings({ global: true }), granted: [ALL_SITES_PATTERN] })
		);
		expect(plan[0]?.matches).toEqual([ALL_SITES_PATTERN]);
	});

	it('falls back to sites when global mode lacks the permission', () => {
		const plan = planRegistrations(
			state({
				settings: settings({ global: true, sites: [site('a.com')] }),
				granted: ['*://a.com/*']
			})
		);
		expect(plan[0]?.matches).toEqual(['*://a.com/*']);
	});

	it('excludes hosts in test mode', () => {
		const plan = planRegistrations(
			state({
				settings: settings({ sites: [site('a.com', true)] }),
				granted: ['*://a.com/*', '*://*.a.com/*'],
				testHosts: ['www.a.com']
			})
		);
		expect(plan[0]).toMatchObject({
			matches: ['*://a.com/*', '*://*.a.com/*'],
			excludeMatches: ['*://www.a.com/*']
		});
	});

	it('registers cleanup for flagged origins that are no longer ignored', () => {
		const plan = planRegistrations(
			state({
				settings: settings({ sites: [site('sub.a.com')] }),
				granted: ['*://sub.a.com/*', '*://a.com/*', '*://*.a.com/*'],
				flaggedOrigins: [
					'https://a.com',
					'http://a.com:8080',
					'https://www.a.com',
					'https://sub.a.com',
					'https://nogrant.com'
				]
			})
		);
		expect(plan.find((s) => s.id === 'cleanup')?.matches).toEqual([
			'https://a.com/*',
			'http://a.com/*',
			'https://www.a.com/*'
		]);
	});

	it('adds the probe and relay scripts when the event log is on, including test hosts', () => {
		const plan = planRegistrations(
			state({
				settings: settings({ eventLog: true, sites: [site('a.com')] }),
				granted: ['*://a.com/*', '*://b.com/*'],
				testHosts: ['a.com']
			})
		);
		const probe = plan.find((s) => s.id === 'probe');
		const relay = plan.find((s) => s.id === 'relay');
		expect(probe).toMatchObject({
			world: 'MAIN',
			matches: ['*://a.com/*'],
			js: ['content/probe.js']
		});
		expect(probe?.excludeMatches).toBeUndefined();
		expect(relay).toMatchObject({ world: 'ISOLATED', matches: ['*://a.com/*'] });
	});
});

describe('shouldIgnoreHost', () => {
	const s = state({
		settings: settings({ sites: [site('a.com', true)] }),
		granted: ['*://a.com/*', '*://*.a.com/*'],
		testHosts: ['test.a.com']
	});

	it('is true for covered hosts', () => {
		expect(shouldIgnoreHost(s, 'a.com')).toBe(true);
		expect(shouldIgnoreHost(s, 'www.a.com')).toBe(true);
	});
	it('is false in test mode, for other hosts and without permission', () => {
		expect(shouldIgnoreHost(s, 'test.a.com')).toBe(false);
		expect(shouldIgnoreHost(s, 'b.com')).toBe(false);
		expect(shouldIgnoreHost({ ...s, granted: [] }, 'a.com')).toBe(false);
	});
	it('is true everywhere in global mode', () => {
		const g = state({ settings: settings({ global: true }), granted: [ALL_SITES_PATTERN] });
		expect(shouldIgnoreHost(g, 'anything.net')).toBe(true);
	});
});

describe('pendingCleanup', () => {
	it('lists flagged origins that should not keep the flag, except test hosts', () => {
		const s = state({
			settings: settings({ sites: [site('a.com')] }),
			granted: ['*://a.com/*'],
			testHosts: ['t.com'],
			flaggedOrigins: ['https://a.com', 'https://b.com', 'https://t.com', 'not an origin']
		});
		expect(pendingCleanup(s)).toEqual(['https://b.com']);
	});

	it('keeps origins whose site lost access, since the flag is still wanted', () => {
		const s = state({
			settings: settings({ sites: [site('a.com')] }),
			flaggedOrigins: ['https://a.com']
		});
		expect(pendingCleanup(s)).toEqual([]);
	});
});

describe('unneededGrants', () => {
	it('keeps grants for configured sites and global mode', () => {
		const s = state({
			settings: settings({ global: true, sites: [site('a.com', true)] }),
			granted: [ALL_SITES_PATTERN, '*://a.com/*', '*://*.a.com/*']
		});
		expect(unneededGrants(s)).toEqual([]);
	});

	it('keeps grants needed to clean up flagged origins', () => {
		const s = state({
			granted: ['*://a.com/*', '*://*.b.com/*', '*://c.com/*'],
			flaggedOrigins: ['https://a.com', 'http://x.b.com']
		});
		expect(unneededGrants(s)).toEqual(['*://c.com/*']);
	});

	it('drops access to all sites when global mode is off, even with pending cleanup', () => {
		const s = state({ granted: [ALL_SITES_PATTERN], flaggedOrigins: ['https://a.com'] });
		expect(unneededGrants(s)).toEqual([ALL_SITES_PATTERN]);
	});

	it('never touches grants in other formats or the ones explicitly kept', () => {
		const s = state({ granted: ['https://a.com/*', '*://k.com/*', '*://z.com/*'] });
		expect(unneededGrants(s, ['*://k.com/*'])).toEqual(['*://z.com/*']);
	});
});
