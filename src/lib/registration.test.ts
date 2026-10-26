import { describe, expect, it } from 'vitest';
import {
	ALL_SITES_PATTERN,
	isPatternGranted,
	planRegistrations,
	shouldIgnoreHost
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
	cleanupSites: [],
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

	it('registers cleanup for removed sites that are not otherwise active', () => {
		const plan = planRegistrations(
			state({
				settings: settings({ sites: [site('a.com')] }),
				granted: ['*://a.com/*', '*://old.com/*', '*://gone.com/*'],
				cleanupSites: [site('old.com'), site('a.com'), site('nogrant.com')]
			})
		);
		expect(plan.find((s) => s.id === 'cleanup')?.matches).toEqual(['*://old.com/*']);
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
