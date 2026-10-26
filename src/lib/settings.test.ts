import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SETTINGS,
	addSite,
	decodeSettings,
	encodeSettings,
	findSite,
	removeSite,
	setSubdomains
} from './settings';

const site = (host: string, includeSubdomains = false) => ({ host, includeSubdomains });

describe('decodeSettings', () => {
	it('returns defaults for missing or broken data', () => {
		expect(decodeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
		expect(decodeSettings(null)).toEqual(DEFAULT_SETTINGS);
		expect(decodeSettings('nope')).toEqual(DEFAULT_SETTINGS);
		expect(decodeSettings({ v: 99, sites: ['a.com'] })).toEqual(DEFAULT_SETTINGS);
	});

	it('round-trips through encodeSettings', () => {
		const settings = {
			global: true,
			eventLog: true,
			sites: [site('blog.example.org', true), site('example.com')]
		};
		expect(decodeSettings(encodeSettings(settings))).toEqual(settings);
	});

	it('drops invalid hosts and duplicates, keeps the broader entry', () => {
		const decoded = decodeSettings({
			v: 1,
			global: 'yes',
			eventLog: 1,
			sites: ['Example.com', 'bad host', 42, '*.example.com', '*.', 'other.org']
		});
		expect(decoded).toEqual({
			global: false,
			eventLog: false,
			sites: [site('example.com', true), site('other.org')]
		});
	});

	it('handles a non-array site list', () => {
		expect(decodeSettings({ v: 1, sites: 'example.com' }).sites).toEqual([]);
	});
});

describe('encodeSettings', () => {
	it('stores sites compactly with a *. prefix for subdomains', () => {
		expect(
			encodeSettings({
				global: false,
				eventLog: false,
				sites: [site('a.com'), site('b.com', true)]
			})
		).toEqual({ v: 1, global: false, eventLog: false, sites: ['a.com', '*.b.com'] });
	});
});

describe('site list updates', () => {
	const base = { ...DEFAULT_SETTINGS, sites: [site('a.com')] };

	it('adds a new site and keeps the list sorted', () => {
		expect(addSite(base, site('0.com')).sites).toEqual([site('0.com'), site('a.com')]);
	});

	it('replaces an existing entry for the same host', () => {
		expect(addSite(base, site('a.com', true)).sites).toEqual([site('a.com', true)]);
	});

	it('removes a site and ignores unknown hosts', () => {
		expect(removeSite(base, 'a.com').sites).toEqual([]);
		expect(removeSite(base, 'zzz.com')).toEqual(base);
	});

	it('toggles subdomains', () => {
		expect(setSubdomains(base, 'a.com', true).sites).toEqual([site('a.com', true)]);
		expect(setSubdomains(base, 'zzz.com', true)).toEqual(base);
	});

	it('does not mutate the input', () => {
		const copy = structuredClone(base);
		addSite(base, site('b.com'));
		removeSite(base, 'a.com');
		expect(base).toEqual(copy);
	});

	it('finds the site that covers a host', () => {
		const settings = { ...DEFAULT_SETTINGS, sites: [site('a.com', true)] };
		expect(findSite(settings, 'www.a.com')).toEqual(site('a.com', true));
		expect(findSite(settings, 'b.com')).toBeUndefined();
	});
});
