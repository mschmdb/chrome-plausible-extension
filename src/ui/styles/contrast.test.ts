import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contrastRatio, oklchToSrgb, parseOklch } from '../../lib/oklch';

// Reads the real tokens from tokens.css. The CSS stays the single source of truth.
const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

function readRootBlocks(): Record<string, string>[] {
	return [...css.matchAll(/:root\s*\{([^}]*)\}/g)].map((block) => {
		const tokens: Record<string, string> = {};
		for (const m of (block[1] ?? '').matchAll(/(--[\w-]+):\s*(oklch\([^;]+\));/g)) {
			tokens[m[1]!] = m[2]!;
		}
		return tokens;
	});
}

const [light, dark] = readRootBlocks();

const ratio = (a: string | undefined, b: string | undefined) => {
	if (!a || !b) throw new Error('Missing token');
	return contrastRatio(oklchToSrgb(parseOklch(a)), oklchToSrgb(parseOklch(b)));
};

describe('tokens.css', () => {
	it('defines a light and a dark root block', () => {
		expect(light).toBeDefined();
		expect(dark).toBeDefined();
		expect(Object.keys(dark!).sort()).toEqual(Object.keys(light!).sort());
	});
});

describe.each([
	['light', light!],
	['dark', dark!]
])('contrast (%s mode)', (_mode, t) => {
	it.each([
		'--ink',
		'--ink-muted',
		'--ink-subtle',
		'--accent',
		'--error',
		'--warning',
		'--success'
	])('%s on bg and bg-elevated ≥ 4.5 (AA text)', (token) => {
		expect(ratio(t[token], t['--bg'])).toBeGreaterThanOrEqual(4.5);
		expect(ratio(t[token], t['--bg-elevated'])).toBeGreaterThanOrEqual(4.5);
	});

	it.each(['--rule-strong', '--focus'])('%s on bg ≥ 3 (non-text)', (token) => {
		expect(ratio(t[token], t['--bg'])).toBeGreaterThanOrEqual(3);
	});

	it('button text (bg) on accent ≥ 4.5', () => {
		expect(ratio(t['--bg'], t['--accent'])).toBeGreaterThanOrEqual(4.5);
	});
});
