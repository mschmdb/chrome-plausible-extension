// Runs small functions inside open tabs. Every call can fail: the tab may be gone,
// discarded, or outside our host permissions. Failures return null instead of throwing.
import { analyzeSnapshot, type Detection } from '../lib/detect';
import { clearFlagInPage, readFlagInPage, setFlagInPage } from '../lib/flag';
import { hostFromUrl } from '../lib/host';
import { collectSnapshot } from '../lib/snapshot';
import type { FlagState } from '../lib/status';

async function runInTab<T>(
	tabId: number,
	func: () => T,
	world: `${chrome.scripting.ExecutionWorld}` = 'ISOLATED'
): Promise<T | null> {
	try {
		const [result] = await chrome.scripting.executeScript({ target: { tabId }, func, world });
		return (result?.result as T | undefined) ?? null;
	} catch {
		return null;
	}
}

export const readFlag = (tabId: number) => runInTab<FlagState>(tabId, readFlagInPage);
export const setFlag = (tabId: number) => runInTab<FlagState>(tabId, setFlagInPage);
export const clearFlag = (tabId: number) => runInTab<FlagState>(tabId, clearFlagInPage);

export async function detect(tabId: number): Promise<Detection | null> {
	const snapshot = await runInTab(tabId, collectSnapshot, 'MAIN');
	return snapshot ? analyzeSnapshot(snapshot) : null;
}

/** Open tabs whose host passes the filter. Needs host access to read their URLs. */
export async function tabsWhere(filter: (host: string) => boolean): Promise<number[]> {
	const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
	return tabs.flatMap((tab) => {
		const host = tab.url ? hostFromUrl(tab.url) : null;
		return tab.id !== undefined && host && filter(host) ? [tab.id] : [];
	});
}

export async function tabHost(tabId: number): Promise<string | null> {
	try {
		const tab = await chrome.tabs.get(tabId);
		return tab.url ? hostFromUrl(tab.url) : null;
	} catch {
		return null;
	}
}
