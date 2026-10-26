import { describe, expect, it } from 'vitest';
import {
	appendEvent,
	boundEvent,
	MAX_EVENT_BYTES,
	MAX_FIELD_LENGTH,
	classifyEvent,
	isCapturedEvent,
	parsePayload,
	validatePayload,
	type CapturedEvent
} from './events';

const event = (overrides: Partial<CapturedEvent> = {}): CapturedEvent => ({
	name: 'pageview',
	url: 'https://example.com/',
	domain: 'example.com',
	referrer: null,
	props: null,
	revenue: null,
	interactive: true,
	endpoint: 'https://plausible.io/api/event',
	transport: 'fetch',
	outcome: 'sent',
	reason: null,
	httpStatus: 202,
	dropped: null,
	time: 1,
	...overrides
});

describe('parsePayload', () => {
	it('parses a Plausible event body', () => {
		const body = JSON.stringify({
			n: 'Signup',
			u: 'https://example.com/a',
			d: 'example.com',
			r: null,
			p: { plan: 'pro', seats: 3 },
			$: { currency: 'EUR', amount: 9.5 },
			i: false
		});
		expect(parsePayload(body)).toEqual({
			name: 'Signup',
			url: 'https://example.com/a',
			domain: 'example.com',
			referrer: null,
			props: { plan: 'pro', seats: 3 },
			revenue: { currency: 'EUR', amount: 9.5 },
			interactive: false
		});
	});

	it.each([
		'',
		'not json',
		'[]',
		'null',
		JSON.stringify({ u: 'https://x' }),
		JSON.stringify({ n: 'x' }),
		JSON.stringify({ n: 1, u: 'https://x' })
	])('rejects %j', (body) => {
		expect(parsePayload(body)).toBeNull();
	});

	it('defaults optional fields', () => {
		expect(parsePayload(JSON.stringify({ n: 'pageview', u: 'https://x/' }))).toEqual({
			name: 'pageview',
			url: 'https://x/',
			domain: null,
			referrer: null,
			props: null,
			revenue: null,
			interactive: true
		});
	});
});

describe('classifyEvent', () => {
	it.each([
		['pageview', 'pageview'],
		['engagement', 'engagement'],
		['Outbound Link: Click', 'outbound'],
		['File Download', 'file-download'],
		['404', 'not-found'],
		['Signup', 'custom'],
		[null, 'unknown']
	] as const)('%s → %s', (name, kind) => {
		expect(classifyEvent(name)).toBe(kind);
	});
});

describe('validatePayload', () => {
	it('accepts a normal event', () => {
		expect(validatePayload(event())).toEqual([]);
	});

	it('flags long URLs', () => {
		expect(validatePayload(event({ url: `https://x/${'a'.repeat(2000)}` }))).toContain(
			'url-too-long'
		);
	});

	it('flags too many props, long keys and values and non-scalar values', () => {
		const props: Record<string, unknown> = {};
		for (let i = 0; i < 31; i++) props[`k${i}`] = 'v';
		expect(validatePayload(event({ props }))).toContain('too-many-props');
		expect(validatePayload(event({ props: { ['k'.repeat(301)]: 'v' } }))).toContain(
			'prop-key-too-long'
		);
		expect(validatePayload(event({ props: { k: 'v'.repeat(2001) } }))).toContain(
			'prop-value-too-long'
		);
		expect(validatePayload(event({ props: { k: { nested: true } } }))).toContain(
			'prop-value-not-scalar'
		);
	});

	it('flags invalid revenue', () => {
		expect(validatePayload(event({ revenue: { amount: 1 } }))).toContain('revenue-invalid');
		expect(validatePayload(event({ revenue: { currency: 'EURO', amount: 1 } }))).toContain(
			'revenue-invalid'
		);
		expect(validatePayload(event({ revenue: { currency: 'EUR', amount: '9.50' } }))).toEqual([]);
	});
});

describe('isCapturedEvent', () => {
	it('accepts a valid event', () => {
		expect(isCapturedEvent(event())).toBe(true);
		expect(
			isCapturedEvent(event({ name: null, outcome: 'ignored', reason: 'localStorage flag' }))
		).toBe(true);
	});

	it.each([
		null,
		{},
		{ ...event(), outcome: 'other' },
		{ ...event(), transport: 'ws' },
		{ ...event(), url: 42 },
		{ ...event(), time: 'now' },
		{ ...event(), props: [] }
	])('rejects %j', (value) => {
		expect(isCapturedEvent(value)).toBe(false);
	});
});

describe('appendEvent', () => {
	it('adds newest first and caps the list', () => {
		const log = Array.from({ length: 3 }, (_, i) => event({ time: i }));
		const next = appendEvent(log, event({ time: 99 }), 3);
		expect(next.map((e) => e.time)).toEqual([99, 0, 1]);
		expect(log).toHaveLength(3);
	});
});

describe('boundEvent', () => {
	it('keeps normal events unchanged', () => {
		const e = event({ props: { a: 1 } });
		expect(boundEvent(e)).toEqual(e);
	});

	it('trims long strings and drops oversized props and revenue', () => {
		const huge = 'x'.repeat(20_000);
		const bounded = boundEvent(
			event({ url: huge, name: huge, props: { a: huge }, revenue: { amount: huge }, reason: huge })
		);
		expect(bounded.url.length).toBeLessThanOrEqual(MAX_FIELD_LENGTH + 1);
		expect(bounded.name?.length).toBeLessThanOrEqual(MAX_FIELD_LENGTH + 1);
		expect(bounded.reason?.length).toBeLessThanOrEqual(MAX_FIELD_LENGTH + 1);
		expect(bounded.props).toEqual({ '(dropped)': 'Properties larger than 8 KB' });
		expect(bounded.revenue).toEqual({ '(dropped)': 'Revenue larger than 8 KB' });
		expect(JSON.stringify(bounded).length).toBeLessThan(MAX_EVENT_BYTES);
	});

	it('keeps the whole event within the UTF-8 byte budget', () => {
		const wide = '€'.repeat(3999);
		const props = { a: '€'.repeat(2600) };
		const bounded = boundEvent(
			event({
				name: wide,
				url: wide,
				domain: wide,
				referrer: wide,
				endpoint: wide,
				reason: wide,
				props,
				revenue: props
			})
		);
		const bytes = new TextEncoder().encode(JSON.stringify(bounded)).length;
		expect(bytes).toBeLessThanOrEqual(MAX_EVENT_BYTES);
		expect(bounded.props).toEqual({ '(dropped)': 'Event too large to keep' });
	});
});
