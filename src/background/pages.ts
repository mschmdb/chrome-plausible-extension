// Runs small functions inside open tabs. Every call can fail: the tab may be gone,
// discarded, or outside our host permissions. Failures return null instead of throwing.
import { analyzeSnapshot, type Detection } from '../lib/detect';
import { clearFlagInPage, readFlagInPage, setFlagInPage } from '../lib/flag';
import { hostFromUrl } from '../lib/host';
import { collectSnapshot } from '../lib/snapshot';
import type { FlagState } from '../lib/status';

async function runInTab<T, A extends unknown[] = []>(
	tabId: number,
	func: (...args: A) => T,
	args: A,
	world: `${chrome.scripting.ExecutionWorld}` = 'ISOLATED'
): Promise<T | null> {
	try {
		const [result] = await chrome.scripting.executeScript({
			target: { tabId },
			func,
			args,
			world
		});
		return (result?.result as T | undefined) ?? null;
	} catch {
		return null;
	}
}

export const readFlag = (tabId: number) => runInTab(tabId, readFlagInPage, []);
/** Sets the flag only if the tab is still on `origin`. */
export const setFlag = (tabId: number, origin: string) =>
	runInTab<ReturnType<typeof setFlagInPage>, [string]>(tabId, setFlagInPage, [origin]);
/** Clears the flag only if the tab is still on `origin`. */
export const clearFlag = (tabId: number, origin: string) =>
	runInTab<FlagState | null, [string]>(tabId, clearFlagInPage, [origin]);

export async function detect(tabId: number): Promise<Detection | null> {
	const snapshot = await runInTab(tabId, collectSnapshot, [], 'MAIN');
	return snapshot ? analyzeSnapshot(snapshot) : null;
}

export interface OpenPage {
	tabId: number;
	host: string;
	origin: string;
}

/** Open tabs whose host passes the filter. Needs host access to read their URLs. */
export async function pagesWhere(filter: (host: string) => boolean): Promise<OpenPage[]> {
	const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
	return tabs.flatMap((tab) => {
		const host = tab.url ? hostFromUrl(tab.url) : null;
		if (tab.id === undefined || !tab.url || !host || !filter(host)) return [];
		return [{ tabId: tab.id, host, origin: new URL(tab.url).origin }];
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

function probeInstalledInPage(): boolean {
	return Boolean((window as unknown as Record<symbol, unknown>)[Symbol.for('uncounted.probe')]);
}

/** Whether the event probe runs in the tab's current page. */
export async function hasProbe(tabId: number): Promise<boolean> {
	return (await runInTab(tabId, probeInstalledInPage, [], 'MAIN')) === true;
}
