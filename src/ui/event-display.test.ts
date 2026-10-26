import { describe, expect, it } from 'vitest';
import type { CapturedEvent } from '../lib/events';
import { decodedUrl, outcomeChip, outcomeText, shortPath } from './event-display';

const event = (overrides: Partial<CapturedEvent> = {}): CapturedEvent => ({
	name: 'pageview',
	url: 'https://a.test/explore?q=Zionskirchstra%C3%9Fe%2C+Berlin',
	domain: null,
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
	time: 1,
	...overrides
});

describe('event display', () => {
	it('shows the path without the query in the row', () => {
		expect(shortPath(event().url)).toBe('/explore');
		expect(shortPath('not a url')).toBe('not a url');
	});

	it('decodes the full URL for the details', () => {
		expect(decodedUrl(event().url)).toBe('https://a.test/explore?q=Zionskirchstraße, Berlin');
		expect(decodedUrl('https://a.test/%E0%A4%A')).toBe('https://a.test/%E0%A4%A');
	});

	it.each([
		[{}, '202', 'Accepted (202). Plausible may still drop it, e.g. as bot traffic.'],
		[{ httpStatus: 200 }, '200', 'Sent (200).'],
		[{ dropped: true }, 'Dropped', 'Dropped by the server (x-plausible-dropped).'],
		[
			{ outcome: 'ignored' as const, reason: 'localStorage flag' },
			'Ignored',
			'Ignored: localStorage flag'
		],
		[
			{ outcome: 'failed' as const, reason: 'Failed to fetch', httpStatus: null },
			'Failed',
			'Failed: Failed to fetch'
		],
		[{ httpStatus: null, transport: 'beacon' as const }, 'Sent', 'Sent.']
	])('%j → chip %s', (overrides, chip, text) => {
		expect(outcomeChip(event(overrides))).toBe(chip);
		expect(outcomeText(event(overrides))).toBe(text);
	});
});
