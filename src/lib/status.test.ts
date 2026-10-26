import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BADGE_COLORS, badgeFor, pageStatus } from './status';
import { oklchToSrgb, parseOklch } from './oklch';

describe('pageStatus', () => {
	const detected = 'detected' as const;

	it('is unsupported without a host', () => {
		expect(pageStatus({ host: null, flag: null, detection: null })).toBe('unsupported');
	});

	it('reports blocked storage first', () => {
		expect(pageStatus({ host: 'a.com', flag: { blocked: true }, detection: detected })).toBe(
			'storage-blocked'
		);
	});

	it('is ignored when the flag is exactly "true"', () => {
		expect(pageStatus({ host: 'a.com', flag: { value: 'true' }, detection: 'none' })).toBe(
			'ignored'
		);
	});

	it('is counted when Plausible runs without a valid flag', () => {
		expect(pageStatus({ host: 'a.com', flag: { value: null }, detection: detected })).toBe(
			'counted'
		);
		expect(pageStatus({ host: 'a.com', flag: { value: '1' }, detection: detected })).toBe(
			'counted'
		);
	});

	it('is not-detected without Plausible and without flag', () => {
		expect(pageStatus({ host: 'a.com', flag: { value: null }, detection: 'none' })).toBe(
			'not-detected'
		);
	});

	it('is unknown when the page could not be inspected', () => {
		expect(pageStatus({ host: 'a.com', flag: null, detection: null })).toBe('unknown');
	});
});

describe('badgeFor', () => {
	it('uses a symbol and a title, not color alone', () => {
		for (const status of ['ignored', 'counted', 'storage-blocked'] as const) {
			const badge = badgeFor(status);
			expect(badge.text).not.toBe('');
			expect(badge.title.length).toBeGreaterThan(10);
		}
	});

	it('shows no badge text when there is nothing to report', () => {
		expect(badgeFor('not-detected').text).toBe('');
		expect(badgeFor('unsupported').text).toBe('');
		expect(badgeFor('unknown').text).toBe('');
	});
});

describe('BADGE_COLORS', () => {
	// Badge colors must be hex. They mirror the light-mode tokens.
	const css = readFileSync(
		fileURLToPath(new URL('../ui/styles/tokens.css', import.meta.url)),
		'utf8'
	);
	const token = (name: string) => {
		const match = new RegExp(`--${name}:\\s*(oklch\\([^)]+\\))`).exec(css);
		if (!match?.[1]) throw new Error(`Missing token ${name}`);
		const { r, g, b } = oklchToSrgb(parseOklch(match[1]));
		return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
	};

	it.each(Object.entries(BADGE_COLORS))('%s matches its token', (name, hex) => {
		const diff = (a: string, b: string, i: number) =>
			Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16));
		const expected = token(name);
		for (const i of [1, 3, 5]) expect(diff(hex, expected, i)).toBeLessThanOrEqual(2);
	});
});
