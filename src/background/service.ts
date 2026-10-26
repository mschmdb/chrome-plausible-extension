// Business logic behind UI requests and content-script messages.
// Every mutation runs through one serial queue, so storage updates never interleave.
import { appendEvent, boundEvent, type CapturedEvent } from '../lib/events';
import { requiredOrigins } from '../lib/grant-origins';
import { matchPatterns, siteCoversHost, type Site } from '../lib/host';
import type { UiRequest } from '../lib/messages';
import {
	ALL_SITES_PATTERN,
	isPatternGranted,
	pendingCleanup,
	shouldIgnoreHost,
	unneededGrants
} from '../lib/registration';
import { createSerialQueue } from '../lib/serial';
import { addSite, findSite, removeSite, setSubdomains, type Settings } from '../lib/settings';
import type { TabStatus } from '../lib/tab-status';
import { applyBadge, inspectTab, refreshBadges } from './badge';
import { pendingGrant, rememberGrant, takeGrantedAction } from './grants';
import { clearFlag, hasProbe, pagesWhere, setFlag, tabHost } from './pages';
import { reconcileRegistrations } from './registrar';
import * as store from './store';

export const serial = createSerialQueue();

/**
 * Sets or clears the flag in open tabs to match the current state. Only clears origins
 * the extension owns, so a flag set by hand stays until the user hands it over.
 */
async function syncTabs(filter: (host: string) => boolean): Promise<void> {
	const state = await store.loadState();
	const flagged = new Set(state.flaggedOrigins);
	const pages = await pagesWhere(filter);
	const set: string[] = [];
	const cleared: string[] = [];

	await Promise.all(
		pages.map(async ({ tabId, host, origin }) => {
			if (shouldIgnoreHost(state, host)) {
				const result = await setFlag(tabId, origin);
				// Enabled here, so the extension owns the flag, also one that was set by hand.
				if (result && 'value' in result && result.value === 'true') set.push(origin);
			} else if (flagged.has(origin) && !state.testHosts.includes(host)) {
				const result = await clearFlag(tabId, origin);
				if (result && 'value' in result && result.value === null) cleared.push(origin);
			}
		})
	);

	if (set.length > 0 || cleared.length > 0) {
		await store.updateFlaggedOrigins((origins) => {
			for (const origin of set) origins.add(origin);
			for (const origin of cleared) origins.delete(origin);
		});
	}
	await refreshBadges(pages.map((page) => page.tabId));
}

/** Drops host access nothing needs anymore. Keeps access a pending prompt is about to use. */
async function pruneGrants(): Promise<void> {
	const pending = await pendingGrant();
	const unneeded = unneededGrants(await store.loadState(), pending ? requiredOrigins(pending) : []);
	if (unneeded.length === 0) return;
	try {
		await chrome.permissions.remove({ origins: unneeded });
	} catch {
		// Required by the manifest or already gone.
	}
}

/** Applies the current state everywhere: registrations, open tabs and host access. */
async function settle(filter: (host: string) => boolean = () => true): Promise<void> {
	await reconcileRegistrations();
	await syncTabs(filter);
	await pruneGrants();
	await reconcileRegistrations();
}

async function updateSettings(change: (settings: Settings) => Settings): Promise<Settings> {
	const next = change(await store.loadSettings());
	await store.saveSettings(next);
	return next;
}

async function requireAccess(origins: string[], message: string): Promise<void> {
	if (!(await chrome.permissions.contains({ origins }))) throw new Error(message);
}

async function enableSite(site: Site): Promise<void> {
	await requireAccess(matchPatterns(site), 'Host access was not granted.');
	await updateSettings((settings) => addSite(settings, site));
	await settle((host) => siteCoversHost(site, host));
}

async function disableSite(host: string): Promise<void> {
	const site = (await store.loadSettings()).sites.find((entry) => entry.host === host);
	if (!site) return;
	await updateSettings((settings) => removeSite(settings, host));
	await settle((h) => siteCoversHost(site, h));
}

async function setSiteSubdomains(host: string, enabled: boolean): Promise<void> {
	const site = (await store.loadSettings()).sites.find((entry) => entry.host === host);
	if (!site) return;
	if (enabled) {
		await requireAccess(
			matchPatterns({ ...site, includeSubdomains: true }),
			'Host access for subdomains was not granted.'
		);
	}
	await updateSettings((current) => setSubdomains(current, host, enabled));
	await settle((h) => siteCoversHost({ ...site, includeSubdomains: true }, h));
}

async function setGlobal(enabled: boolean): Promise<void> {
	if (enabled) await requireAccess([ALL_SITES_PATTERN], 'Access to all sites was not granted.');
	await updateSettings((settings) => ({ ...settings, global: enabled }));
	await settle();
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
	// The origin stays flagged: test mode only lifts the flag for a while.
	const pages = await pagesWhere((h) => h === host);
	await Promise.all(pages.map((page) => clearFlag(page.tabId, page.origin)));
	await refreshBadges(pages.map((page) => page.tabId));
}

async function stopTest(host: string): Promise<void> {
	const entries = await store.loadTestEntries();
	await store.saveTestEntries(entries.filter((entry) => entry.host !== host));
	await settle((h) => h === host);
}

async function importSites(sites: Site[]): Promise<{ added: number; needsAccess: string[] }> {
	const settings = await updateSettings((current) =>
		sites.reduce((acc, site) => addSite(acc, site), current)
	);
	const { granted } = await store.loadState();
	const needsAccess = settings.sites
		.filter((site) => !matchPatterns(site).every((pattern) => isPatternGranted(pattern, granted)))
		.map((site) => site.host);
	await settle();
	return { added: sites.length, needsAccess };
}

/** Flagged origins that need cleanup but have no host access on this device. */
async function leftovers(): Promise<string[]> {
	const state = await store.loadState();
	return pendingCleanup(state).filter(
		(origin) => !isPatternGranted(`*://${new URL(origin).hostname}/*`, state.granted)
	);
}

async function forgetLeftovers(): Promise<void> {
	const forget = new Set(await leftovers());
	await store.updateFlaggedOrigins((origins) => {
		for (const origin of forget) origins.delete(origin);
	});
}

/** Removes a flag on the tab's origin, e.g. one set by hand. */
async function clearTabFlag(tabId: number): Promise<void> {
	const tab = await chrome.tabs.get(tabId);
	if (!tab.url) throw new Error('This page cannot be changed.');
	const origin = new URL(tab.url).origin;
	const result = await clearFlag(tabId, origin);
	if (!result || 'blocked' in result) throw new Error('The flag could not be removed.');
	await store.updateFlaggedOrigins((origins) => void origins.delete(origin));
	await refreshBadges([tabId]);
}

async function tabStatus(tabId: number): Promise<TabStatus> {
	const tab = await chrome.tabs.get(tabId);
	const state = await store.loadState();
	const inspection = await inspectTab(tabId, tab.url);
	await applyBadge(tabId, inspection.status);
	const { host } = inspection;
	const site = host ? (findSite(state.settings, host) ?? null) : null;
	const origin = host && tab.url ? new URL(tab.url).origin : null;
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
		pendingCleanup: origin ? pendingCleanup(state).includes(origin) : false,
		status: inspection.status,
		flag: inspection.flag,
		detection: inspection.detection,
		eventLog: state.settings.eventLog,
		recording: await hasProbe(tabId),
		events: await store.loadEvents(tabId)
	};
}

export async function handleUiRequest(request: UiRequest): Promise<unknown> {
	switch (request.type) {
		case 'get-settings':
			return store.loadSettings();
		case 'get-leftovers':
			return leftovers();
		case 'forget-leftovers':
			return serial(forgetLeftovers);
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
		case 'record-tab':
			return serial(() => recordTab(request.tabId));
		case 'clear-flag':
			return serial(() => clearTabFlag(request.tabId));
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

/** Settings changed on another device. Apply them here, including cleanup. */
export async function onSettingsSynced(): Promise<void> {
	await serial(() => settle());
}

/**
 * Injects the probe into an open page. Uses the popup's activeTab grant, no prompt.
 * Both scripts and the permission to record are bound to one document, so a
 * navigation in between fails instead of splitting them across two pages.
 */
async function recordTab(tabId: number): Promise<void> {
	let documentId: string | undefined;
	try {
		const [relay] = await chrome.scripting.executeScript({
			target: { tabId },
			files: ['content/relay.js']
		});
		documentId = relay?.documentId;
		if (!documentId) throw new Error('No document');
		await chrome.scripting.executeScript({
			target: { tabId, documentIds: [documentId] },
			files: ['content/probe.js'],
			world: 'MAIN'
		});
	} catch {
		throw new Error('Recording could not start on this page. Reload it and try again.');
	}
	await store.setRecordingDocument(tabId, documentId);
}

export async function recordEvent(
	tabId: number,
	documentId: string | undefined,
	event: CapturedEvent
): Promise<void> {
	await serial(async () => {
		const settings = await store.loadSettings();
		const recorded =
			documentId !== undefined && (await store.loadRecordingDocuments())[tabId] === documentId;
		if (!settings.eventLog && !recorded) return;
		await store.saveEvents(tabId, appendEvent(await store.loadEvents(tabId), boundEvent(event)));
	});
}

export async function recordFlagSet(origin: string): Promise<void> {
	await serial(() => store.updateFlaggedOrigins((origins) => void origins.add(origin)));
}

/** The cleanup script cleared the flag on this origin. Forget it and drop unneeded access. */
export async function finishCleanup(origin: string): Promise<void> {
	await serial(async () => {
		await store.updateFlaggedOrigins((origins) => void origins.delete(origin));
		await reconcileRegistrations();
		await pruneGrants();
		await reconcileRegistrations();
	});
}

export async function onTabRemoved(tabId: number): Promise<void> {
	await serial(async () => {
		await store.clearEvents(tabId);
		await store.setRecordingDocument(tabId, null);
		const entries = await store.loadTestEntries();
		const closing = entries.filter((entry) => entry.tabId === tabId);
		if (closing.length === 0) return;
		const remaining = entries.filter((entry) => entry.tabId !== tabId);
		await store.saveTestEntries(remaining);
		const hosts = new Set(
			closing.map((entry) => entry.host).filter((h) => !remaining.some((e) => e.host === h))
		);
		await settle((h) => hosts.has(h));
	});
}
