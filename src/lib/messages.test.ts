import { describe, expect, it } from 'vitest';
import { PROBE_SOURCE, isContentMessage, isProbeMessage, isUiRequest } from './messages';

const event = {
	name: 'pageview',
	url: 'https://a.com/',
	domain: 'a.com',
	referrer: null,
	props: null,
	revenue: null,
	interactive: true,
	endpoint: null,
	transport: 'fetch',
	outcome: 'sent',
	reason: null,
	httpStatus: 202,
	dropped: null,
	time: 1
};

describe('isProbeMessage', () => {
	it('accepts tagged events', () => {
		expect(isProbeMessage({ source: PROBE_SOURCE, event })).toBe(true);
	});
	it.each([
		null,
		'x',
		{ source: 'other', event },
		{ source: PROBE_SOURCE, event: { ...event, url: 1 } }
	])('rejects %j', (value) => {
		expect(isProbeMessage(value)).toBe(false);
	});
});

describe('isContentMessage', () => {
	it.each([
		{ type: 'flag-set' },
		{ type: 'flag-blocked' },
		{ type: 'flag-cleared' },
		{ type: 'event', event }
	])('accepts %j', (value) => {
		expect(isContentMessage(value)).toBe(true);
	});
	it.each([{ type: 'enable-site' }, { type: 'event', event: {} }, {}])('rejects %j', (value) => {
		expect(isContentMessage(value)).toBe(false);
	});
});

describe('isUiRequest', () => {
	it.each([
		{ type: 'get-tab-status', tabId: 3 },
		{ type: 'enable-site', site: { host: 'a.com', includeSubdomains: false } },
		{ type: 'disable-site', host: 'a.com' },
		{ type: 'set-subdomains', host: 'a.com', enabled: true },
		{ type: 'set-global', enabled: false },
		{ type: 'set-event-log', enabled: true },
		{ type: 'test-start', tabId: 1 },
		{ type: 'test-stop', host: 'a.com' },
		{ type: 'clear-events', tabId: 1 },
		{ type: 'import-sites', sites: [{ host: 'a.com', includeSubdomains: true }] },
		{ type: 'get-settings' },
		{ type: 'get-leftovers' },
		{ type: 'forget-leftovers' },
		{ type: 'pending-grant', action: { type: 'set-global', enabled: true } },
		{ type: 'pending-grant', action: { type: 'set-subdomains', host: 'a.com', enabled: true } }
	])('accepts %j', (value) => {
		expect(isUiRequest(value)).toBe(true);
	});

	it.each([
		{ type: 'get-tab-status', tabId: '3' },
		{ type: 'enable-site', site: { host: 'bad host', includeSubdomains: false } },
		{ type: 'enable-site', site: { host: 'a.com' } },
		{ type: 'disable-site', host: 5 },
		{ type: 'set-global', enabled: 'yes' },
		{ type: 'import-sites', sites: 'a.com' },
		{ type: 'import-sites', sites: [{ host: '*', includeSubdomains: true }] },
		{ type: 'unknown' },
		{ type: 'pending-grant', action: { type: 'set-global', enabled: false } },
		{ type: 'pending-grant', action: { type: 'disable-site', host: 'a.com' } },
		null
	])('rejects %j', (value) => {
		expect(isUiRequest(value)).toBe(false);
	});
});
