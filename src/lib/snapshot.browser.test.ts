import { afterEach, describe, expect, it } from 'vitest';
import { collectSnapshot } from './snapshot';

const added: Element[] = [];

function addScript(attrs: Record<string, string>, parent: HTMLElement = document.head, text = '') {
	const el = document.createElement('script');
	// A non-JS type keeps the browser from fetching or running the script.
	el.type = 'text/plain';
	for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
	el.textContent = text;
	parent.append(el);
	added.push(el);
}

afterEach(() => {
	for (const el of added.splice(0)) el.remove();
	Reflect.deleteProperty(window, 'plausible');
});

describe('collectSnapshot', () => {
	it('returns an empty result on a page without Plausible', () => {
		const snapshot = collectSnapshot();
		expect(snapshot.global).toEqual({ present: false, loaded: false, version: null, lib: null });
		expect(snapshot.scripts).toEqual([]);
	});

	it('finds the legacy script and its attributes', () => {
		addScript({
			src: 'https://plausible.io/js/script.js',
			'data-domain': 'example.com',
			'data-api': '/proxy/event'
		});
		expect(collectSnapshot().scripts).toEqual([
			{
				src: 'https://plausible.io/js/script.js',
				id: null,
				dataDomain: 'example.com',
				dataApi: '/proxy/event',
				inHead: true,
				inline: false
			}
		]);
	});

	it('finds the web snippet, its inline init and the loaded global', () => {
		addScript({ src: 'https://plausible.io/js/pa-abc.js', async: '' });
		addScript(
			{},
			document.body,
			'window.plausible=window.plausible||function(){};plausible.init()'
		);
		Object.assign(window, {
			plausible: Object.assign(() => undefined, { l: true, v: 30, s: 'web' })
		});

		const snapshot = collectSnapshot();
		expect(snapshot.global).toEqual({ present: true, loaded: true, version: '30', lib: 'web' });
		expect(snapshot.scripts.map((s) => [s.inline, s.inHead])).toEqual([
			[false, true],
			[true, false]
		]);
	});

	it('ignores unrelated scripts', () => {
		addScript({ src: 'https://cdn.test/app.js' });
		addScript({}, document.head, 'console.log(1)');
		expect(collectSnapshot().scripts).toEqual([]);
	});

	it('collects CSP meta tags and tagged-event classes', () => {
		const meta = document.createElement('meta');
		meta.httpEquiv = 'Content-Security-Policy';
		meta.content = "img-src 'self'";
		document.head.append(meta);
		const button = document.createElement('button');
		button.className = 'btn plausible-event-name=Sign+Up plausible-event-plan=pro';
		document.body.append(button);
		added.push(meta, button);

		const snapshot = collectSnapshot();
		expect(snapshot.csp).toEqual(["img-src 'self'"]);
		expect(snapshot.taggedClasses).toEqual([
			'plausible-event-name=Sign+Up',
			'plausible-event-plan=pro'
		]);
	});
});

describe('collectSnapshot script matching', () => {
	it.each([
		['https://cdn.test/plausible-docs/app.js', false],
		['https://cdn.test/js/script.js', false],
		['https://cdn.test/js/pa-XyZ_12.js', true],
		['https://p.proxy.test/js/pa-GzUosA8gkfhIw50L14ipf.js', true],
		// Seen on live sites: an init queue file and unrelated scripts on plausible.io.
		['https://site.test/plausible-init.js', false],
		['https://plausible.io/assets/js/alpine.js?v=1', false]
	])('%s → %s', (src, expected) => {
		addScript({ src });
		expect(collectSnapshot().scripts.some((s) => s.src === src)).toBe(expected);
	});
});
