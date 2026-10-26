import { describe, expect, it } from 'vitest';
import { hostFromUrl, isIpAddress, matchPatterns, normalizeHost, siteCoversHost } from './host';

describe('hostFromUrl', () => {
	it.each([
		['https://example.com/path?q=1', 'example.com'],
		['http://Sub.Example.COM:8080/', 'sub.example.com'],
		['https://example.com./', 'example.com'],
		['https://bücher.de/', 'xn--bcher-kva.de'],
		['http://127.0.0.1:3000/', '127.0.0.1']
	])('%s → %s', (url, host) => {
		expect(hostFromUrl(url)).toBe(host);
	});

	it.each([
		'chrome://extensions',
		'file:///tmp/a.html',
		'about:blank',
		'chrome-extension://abc/popup.html',
		'https://chromewebstore.google.com/detail/x',
		'https://chrome.google.com/webstore/detail/x',
		'not a url',
		''
	])('rejects %s', (url) => {
		expect(hostFromUrl(url)).toBeNull();
	});

	it('allows other chrome.google.com paths', () => {
		expect(hostFromUrl('https://chrome.google.com/other')).toBe('chrome.google.com');
	});
});

describe('normalizeHost', () => {
	it.each([
		['example.com', 'example.com'],
		['  EXAMPLE.com  ', 'example.com'],
		['https://example.com/path', 'example.com'],
		['example.com:8443', 'example.com'],
		['www.example.com.', 'www.example.com'],
		['localhost', 'localhost']
	])('%s → %s', (input, host) => {
		expect(normalizeHost(input)).toBe(host);
	});

	it.each([
		'',
		'   ',
		'*.example.com',
		'exa mple.com',
		'ftp://example.com',
		'user@example.com',
		'-'
	])('rejects %j', (input) => {
		expect(normalizeHost(input)).toBeNull();
	});
});

describe('isIpAddress', () => {
	it.each(['127.0.0.1', '[::1]', '10.0.0.255'])('%s is an IP', (h) => {
		expect(isIpAddress(h)).toBe(true);
	});
	it.each(['example.com', 'localhost', '1.example.com'])('%s is not an IP', (h) => {
		expect(isIpAddress(h)).toBe(false);
	});
});

describe('matchPatterns', () => {
	it('covers http and https for the host', () => {
		expect(matchPatterns({ host: 'example.com', includeSubdomains: false })).toEqual([
			'*://example.com/*'
		]);
	});

	it('adds a wildcard pattern for subdomains', () => {
		expect(matchPatterns({ host: 'example.com', includeSubdomains: true })).toEqual([
			'*://example.com/*',
			'*://*.example.com/*'
		]);
	});

	it('ignores subdomains for IP addresses', () => {
		expect(matchPatterns({ host: '127.0.0.1', includeSubdomains: true })).toEqual([
			'*://127.0.0.1/*'
		]);
	});
});

describe('siteCoversHost', () => {
	const site = { host: 'example.com', includeSubdomains: false };
	const withSubs = { host: 'example.com', includeSubdomains: true };

	it('matches the exact host', () => {
		expect(siteCoversHost(site, 'example.com')).toBe(true);
	});
	it('does not match subdomains unless enabled', () => {
		expect(siteCoversHost(site, 'www.example.com')).toBe(false);
		expect(siteCoversHost(withSubs, 'www.example.com')).toBe(true);
		expect(siteCoversHost(withSubs, 'a.b.example.com')).toBe(true);
	});
	it('does not match lookalike hosts', () => {
		expect(siteCoversHost(withSubs, 'badexample.com')).toBe(false);
		expect(siteCoversHost(withSubs, 'example.com.evil.net')).toBe(false);
	});
});
