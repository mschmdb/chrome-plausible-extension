// Business logic behind UI requests and content-script messages.
// Every mutation runs through one serial queue, so storage updates never interleave.
import { appendEvent, type CapturedEvent } from '../lib/events';
import { matchPatterns, siteCoversHost, type Site } from '../lib/host';
import type { UiRequest } from '../lib/messages';
import {
	ALL_SITES_PATTERN,
	isPatternGranted,
	shouldIgnoreHost,
	type ExtensionState
} from '../lib/registration';
import { createSerialQueue } from '../lib/serial';
import {
	addSite,
	findSite,
	mergeSites,
	removeSite,
	setSubdomains,
	type Settings
} from '../lib/settings';
import type { TabStatus } from '../lib/tab-status';
import { inspectTab, applyBadge, refreshBadges } from './badge';
import { rememberGrant, takeGrantedAction } from './grants';
import { clearFlag, setFlag, tabHost, tabsWhere } from './pages';
import { reconcileRegistrations } from './registrar';
import * as store from './store';

export const serial = createSerialQueue();

async function syncTabs(filter: (host: string) => boolean): Promise<void> {
	const state = await store.loadState();
	const tabIds = await tabsWhere(filter);
	await Promise.all(
		tabIds.map(async (tabId) => {
			const host = await tabHost(tabId);
			if (!host) return;
			await (shouldIgnoreHost(state, host) ? setFlag(tabId) : clearFlag(tabId));
		})
	);
	await refreshBadges(tabIds);
}

async function updateSettings(change: (settings: Settings) => Settings): Promise<Settings> {
	const next = change(await store.loadSettings());
	await store.saveSettings(next);
	return next;
}

async function removePermission(origins: string[]): Promise<void> {
	try {
		await chrome.permissions.remove({ origins });
	} catch {
		// Required or already removed.
	}
}

async function hasPermission(origins: string[]): Promise<boolean> {
	return chrome.permissions.contains({ origins });
}

async function enableSite(site: Site): Promise<void> {
	if (!(await hasPermission(matchPatterns(site)))) throw new Error('Host access was not granted.');
	await updateSettings((settings) => addSite(settings, site));
	const cleanup = await store.loadCleanupSites();
	await store.saveCleanupSites(cleanup.filter((entry) => !siteCoversHost(site, entry.host)));
	await reconcileRegistrations();
	await syncTabs((host) => siteCoversHost(site, host));
}

async function disableSite(host: string): Promise<void> {
	const before = await store.loadSettings();
	const site = before.sites.find((entry) => entry.host === host);
	if (!site) return;
	await updateSettings((settings) => removeSite(settings, host));
	await reconcileRegistrations();

	const state = await store.loadState();
	const covers = (h: string) => siteCoversHost(site, h);
	const openTabs = await tabsWhere(covers);
	await syncTabs(covers);

	if (state.settings.global) return;
	if (openTabs.length > 0) {
		await removePermission(matchPatterns(site));
	} else {
		// Nothing open to clean right now. Keep access and clear the flag on the next visit.
		await store.saveCleanupSites(mergeSites([...state.cleanupSites, site]));
		await reconcileRegistrations();
	}
}

async function setSiteSubdomains(host: string, enabled: boolean): Promise<void> {
	const settings = await store.loadSettings();
	const site = settings.sites.find((entry) => entry.host === host);
	if (!site) return;
	const updated = { ...site, includeSubdomains: enabled };
	if (enabled && !(await hasPermission(matchPatterns(updated)))) {
		throw new Error('Host access for subdomains was not granted.');
	}
	await updateSettings((current) => setSubdomains(current, host, enabled));
	await reconcileRegistrations();
	await syncTabs((h) => siteCoversHost({ ...site, includeSubdomains: true }, h));
	if (!enabled && !settings.global) await removePermission([`*://*.${host}/*`]);
}

async function setGlobal(enabled: boolean): Promise<void> {
	if (enabled && !(await hasPermission([ALL_SITES_PATTERN]))) {
		throw new Error('Access to all sites was not granted.');
	}
	await updateSettings((settings) => ({ ...settings, global: enabled }));
	await reconcileRegistrations();
	await syncTabs(() => true);
	if (!enabled) {
		await removePermission([ALL_SITES_PATTERN]);
		await reconcileRegistrations();
	}
}

async function setEventLog(enabled: boolean): Promise<void> {
	await updateSettings((settings) => ({ ...settings, eventLog: enabled }));
	await reconcileRegistrations();
}

async function startTest(tabId: number): Promise<void> {
	const host = await tabHost(tabId);
	if (!host) throw new Error('Test mode is not available on this page.');
	const entries = await store.loadTestEntries();
	if (!entries.some((entry) => entry.tabId === tabId && entry.host === host)) {
		await store.saveTestEntries([...entries, { host, tabId }]);
	}
	await reconcileRegistrations();
	await syncTabs((h) => h === host);
}

async function stopTest(host: string): Promise<void> {
	const entries = await store.loadTestEntries();
	await store.saveTestEntries(entries.filter((entry) => entry.host !== host));
	await reconcileRegistrations();
	await syncTabs((h) => h === host);
}

async function importSites(sites: Site[]): Promise<{ added: number; needsAccess: string[] }> {
	const settings = await updateSettings((current) =>
		sites.reduce((acc, site) => addSite(acc, site), current)
	);
	const { granted } = await store.loadState();
	const needsAccess = settings.sites
		.filter((site) => !matchPatterns(site).every((pattern) => isPatternGranted(pattern, granted)))
		.map((site) => site.host);
	await reconcileRegistrations();
	return { added: sites.length, needsAccess };
}

async function tabStatus(tabId: number): Promise<TabStatus> {
	const tab = await chrome.tabs.get(tabId);
	const state: ExtensionState = await store.loadState();
	const inspection = await inspectTab(tabId, tab.url);
	await applyBadge(tabId, inspection.status);
	const { host } = inspection;
	const site = host ? (findSite(state.settings, host) ?? null) : null;
	return {
		tabId,
		host,
		site,
		siteGranted: site
			? matchPatterns(site).every((pattern) => isPatternGranted(pattern, state.granted))
			: false,
		global: state.settings.global,
		globalGranted: isPatternGranted(ALL_SITES_PATTERN, state.granted),
		shouldIgnore: host ? shouldIgnoreHost(state, host) : false,
		testMode: host ? state.testHosts.includes(host) : false,
		pendingCleanup: host ? state.cleanupSites.some((entry) => siteCoversHost(entry, host)) : false,
		status: inspection.status,
		flag: inspection.flag,
		detection: inspection.detection,
		eventLog: state.settings.eventLog,
		events: await store.loadEvents(tabId)
	};
}

export async function handleUiRequest(request: UiRequest): Promise<unknown> {
	switch (request.type) {
		case 'get-settings':
			return store.loadSettings();
		case 'get-tab-status':
			return tabStatus(request.tabId);
		case 'enable-site':
			return serial(() => enableSite(request.site));
		case 'disable-site':
			return serial(() => disableSite(request.host));
		case 'set-subdomains':
			return serial(() => setSiteSubdomains(request.host, request.enabled));
		case 'set-global':
			return serial(() => setGlobal(request.enabled));
		case 'set-event-log':
			return serial(() => setEventLog(request.enabled));
		case 'test-start':
			return serial(() => startTest(request.tabId));
		case 'test-stop':
			return serial(() => stopTest(request.host));
		case 'clear-events':
			return serial(() => store.clearEvents(request.tabId));
		case 'import-sites':
			return serial(() => importSites(request.sites));
		case 'pending-grant':
			return rememberGrant(request.action);
	}
}

/** Finishes an action whose permission prompt outlived the popup. */
export async function completePendingGrant(): Promise<void> {
	const action = await takeGrantedAction();
	if (action) await handleUiRequest(action);
}

export async function recordEvent(tabId: number, event: CapturedEvent): Promise<void> {
	await serial(async () => {
		const settings = await store.loadSettings();
		if (!settings.eventLog) return;
		await store.saveEvents(tabId, appendEvent(await store.loadEvents(tabId), event));
	});
}

/** The cleanup script cleared the flag on this host. Drop the entry and its access. */
export async function finishCleanup(host: string): Promise<void> {
	await serial(async () => {
		const cleanup = await store.loadCleanupSites();
		const done = cleanup.filter((site) => site.host === host);
		if (done.length === 0) return;
		await store.saveCleanupSites(cleanup.filter((site) => site.host !== host));
		const settings = await store.loadSettings();
		if (!settings.global && !findSite(settings, host)) {
			await removePermission(done.flatMap(matchPatterns));
		}
		await reconcileRegistrations();
	});
}

export async function onTabRemoved(tabId: number): Promise<void> {
	await serial(async () => {
		await store.clearEvents(tabId);
		const entries = await store.loadTestEntries();
		const closing = entries.filter((entry) => entry.tabId === tabId);
		if (closing.length === 0) return;
		const remaining = entries.filter((entry) => entry.tabId !== tabId);
		await store.saveTestEntries(remaining);
		await reconcileRegistrations();
		for (const { host } of closing) {
			if (!remaining.some((entry) => entry.host === host)) await syncTabs((h) => h === host);
		}
	});
}
