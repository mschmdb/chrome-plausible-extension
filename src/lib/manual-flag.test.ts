import { describe, expect, it } from 'vitest';
import { hasManualFlag } from './manual-flag';
import type { TabStatus } from './tab-status';

const tab = (overrides: Partial<TabStatus>): TabStatus => ({
	tabId: 1,
	host: 'a.test',
	site: null,
	siteGranted: false,
	global: false,
	globalGranted: false,
	shouldIgnore: false,
	testMode: false,
	pendingCleanup: false,
	status: 'ignored',
	flag: { value: 'true' },
	detection: null,
	eventLog: false,
	events: [],
	...overrides
});

describe('hasManualFlag', () => {
	it('is true for a flag on a site the extension does not manage', () => {
		expect(hasManualFlag(tab({}))).toBe(true);
	});

	it.each([
		['managed site', { shouldIgnore: true }],
		['own flag waiting for cleanup', { pendingCleanup: true }],
		['test mode', { testMode: true }],
		['no flag', { flag: { value: null } }],
		['wrong value', { flag: { value: '1' } }],
		['blocked storage', { flag: { blocked: true as const } }],
		['unknown', { flag: null }]
	])('is false for %s', (_name, overrides) => {
		expect(hasManualFlag(tab(overrides))).toBe(false);
	});
});
