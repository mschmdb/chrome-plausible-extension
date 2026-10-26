import { describe, expect, it } from 'vitest';
import { trackPlausibleCalls } from './plausible-calls';

describe('trackPlausibleCalls', () => {
	it('names the call in progress and keeps the function working', () => {
		const win: Record<string, unknown> = {};
		const current = trackPlausibleCalls(win);
		const seen: unknown[] = [];

		// The tracker replaces the stub and adds properties to its function.
		const track = (name: string) => {
			seen.push(current());
			return `tracked ${name}`;
		};
		win.plausible = track;
		(win.plausible as { l?: boolean }).l = true;

		const plausible = win.plausible as (name: string, options?: object) => string;
		expect(plausible('MapClick', { props: { zoom: 14 }, interactive: false })).toBe(
			'tracked MapClick'
		);
		expect(seen[0]).toEqual({
			name: 'MapClick',
			url: null,
			props: { zoom: 14 },
			revenue: null,
			interactive: false
		});
		expect(current()).toBeNull();
		expect((win.plausible as { l?: boolean }).l).toBe(true);
		expect(win.plausible).toBe(win.plausible);
	});

	it('wraps a function that already exists', () => {
		const win: Record<string, unknown> = { plausible: () => 'ok' };
		trackPlausibleCalls(win);
		expect((win.plausible as () => string)()).toBe('ok');
	});

	it('passes errors through and clears the current call', () => {
		const win: Record<string, unknown> = {};
		const current = trackPlausibleCalls(win);
		win.plausible = () => {
			throw new Error('boom');
		};
		expect(() => (win.plausible as () => void)()).toThrow('boom');
		expect(current()).toBeNull();
	});

	it('leaves non-configurable globals alone', () => {
		const win = {};
		Object.defineProperty(win, 'plausible', { value: 1, configurable: false });
		const current = trackPlausibleCalls(win);
		expect(current()).toBeNull();
	});
});
