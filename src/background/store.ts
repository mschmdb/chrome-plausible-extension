// Typed access to chrome.storage. Settings sync across devices. Permissions do not,
// so everything that depends on granted access stays local or in the session.
import type { CapturedEvent } from '../lib/events';
import { normalizeHost, type Site } from '../lib/host';
import type { ExtensionState } from '../lib/registration';
import {
	SETTINGS_KEY,
	decodeSettings,
	encodeSettings,
	mergeSites,
	type Settings
} from '../lib/settings';

const CLEANUP_KEY = 'cleanupSites';
const TEST_KEY = 'testMode';
const eventsKey = (tabId: number) => `events:${tabId}`;

export interface TestEntry {
	host: string;
	tabId: number;
}

export async function loadSettings(): Promise<Settings> {
	const stored = await chrome.storage.sync.get(SETTINGS_KEY);
	return decodeSettings(stored[SETTINGS_KEY]);
}

export async function saveSettings(settings: Settings): Promise<void> {
	await chrome.storage.sync.set({ [SETTINGS_KEY]: encodeSettings(settings) });
}

export async function loadCleanupSites(): Promise<Site[]> {
	const stored = await chrome.storage.local.get(CLEANUP_KEY);
	const raw: unknown = stored[CLEANUP_KEY];
	if (!Array.isArray(raw)) return [];
	return mergeSites(
		raw.flatMap((value: unknown) => {
			if (typeof value !== 'object' || value === null) return [];
			const { host, includeSubdomains } = value as Record<string, unknown>;
			const normalized = typeof host === 'string' ? normalizeHost(host) : null;
			return normalized
				? [{ host: normalized, includeSubdomains: includeSubdomains === true }]
				: [];
		})
	);
}

export async function saveCleanupSites(sites: readonly Site[]): Promise<void> {
	await chrome.storage.local.set({ [CLEANUP_KEY]: sites });
}

export async function loadTestEntries(): Promise<TestEntry[]> {
	const stored = await chrome.storage.session.get(TEST_KEY);
	const raw: unknown = stored[TEST_KEY];
	if (!Array.isArray(raw)) return [];
	return raw.filter(
		(entry: unknown): entry is TestEntry =>
			typeof entry === 'object' &&
			entry !== null &&
			typeof (entry as TestEntry).host === 'string' &&
			Number.isInteger((entry as TestEntry).tabId)
	);
}

export async function saveTestEntries(entries: readonly TestEntry[]): Promise<void> {
	await chrome.storage.session.set({ [TEST_KEY]: entries });
}

export async function loadEvents(tabId: number): Promise<CapturedEvent[]> {
	const stored = await chrome.storage.session.get(eventsKey(tabId));
	const raw: unknown = stored[eventsKey(tabId)];
	return Array.isArray(raw) ? (raw as CapturedEvent[]) : [];
}

export async function saveEvents(tabId: number, events: readonly CapturedEvent[]): Promise<void> {
	await chrome.storage.session.set({ [eventsKey(tabId)]: events });
}

export async function clearEvents(tabId: number): Promise<void> {
	await chrome.storage.session.remove(eventsKey(tabId));
}

export async function loadState(): Promise<ExtensionState> {
	const [settings, permissions, testEntries, cleanupSites] = await Promise.all([
		loadSettings(),
		chrome.permissions.getAll(),
		loadTestEntries(),
		loadCleanupSites()
	]);
	return {
		settings,
		granted: permissions.origins ?? [],
		testHosts: [...new Set(testEntries.map((entry) => entry.host))],
		cleanupSites
	};
}
