import type { TabStatus } from './tab-status';

/** The flag is set, but not by this extension: e.g. by hand via the Plausible docs. */
export function hasManualFlag(tab: TabStatus): boolean {
	const value = tab.flag && 'value' in tab.flag ? tab.flag.value : null;
	return value === 'true' && !tab.shouldIgnore && !tab.pendingCleanup && !tab.testMode;
}
