import { describe, expect, it } from 'vitest';
import { parseOklch, oklchToSrgb, contrastRatio, type Rgb } from './oklch';

// Reference hex values from the schmidbauer.dev design tokens.
// The converter must reproduce them (small tolerance for rounding).
const hexToRgb = (hex: string): Rgb => {
	const n = parseInt(hex.replace('#', ''), 16);
	return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

const expectClose = (a: Rgb, b: Rgb, tol = 2) => {
	expect(Math.abs(a.r - b.r)).toBeLessThanOrEqual(tol);
	expect(Math.abs(a.g - b.g)).toBeLessThanOrEqual(tol);
	expect(Math.abs(a.b - b.b)).toBeLessThanOrEqual(tol);
};

describe('parseOklch', () => {
	it('parses percentage lightness and numeric chroma/hue', () => {
		const { l, c, h } = parseOklch('oklch(93.6% 0.014 97)');
		expect(l).toBeCloseTo(0.936, 5);
		expect(c).toBe(0.014);
		expect(h).toBe(97);
	});
});

describe('oklchToSrgb', () => {
	// Samples from the token table (light and dark).
	const cases: Array<[string, string]> = [
		['oklch(93.6% 0.014 97)', '#ECEAE0'], // light bg
		['oklch(19.1% 0 90)', '#141414'], // light ink
		['oklch(38.5% 0.107 267)', '#2A3F7C'], // light accent
		['oklch(17.5% 0.010 97)', '#12110C'], // dark bg
		['oklch(93.0% 0.008 97)', '#E9E8E2'] // dark ink
	];
	it.each(cases)('%s ≈ %s', (oklch, hex) => {
		expectClose(oklchToSrgb(parseOklch(oklch)), hexToRgb(hex));
	});
});

describe('contrastRatio', () => {
	it('black on white is 21:1', () => {
		expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 1);
	});

	it('is symmetric', () => {
		const a = { r: 10, g: 20, b: 30 };
		const b = { r: 200, g: 210, b: 220 };
		expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 5);
	});
});
