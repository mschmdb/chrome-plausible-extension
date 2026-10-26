// Typed access to chrome.storage. Settings sync across devices. Permissions do not,
// so everything that depends on granted access stays local or in the session.
import type { CapturedEvent } from '../lib/events';
import type { ExtensionState } from '../lib/registration';
import { SETTINGS_KEY, decodeSettings, encodeSettings, type Settings } from '../lib/settings';

import { FLAGGED_ORIGINS_KEY as FLAGGED_KEY } from '../lib/storage-keys';
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

export async function loadFlaggedOrigins(): Promise<string[]> {
	const stored = await chrome.storage.local.get(FLAGGED_KEY);
	const raw: unknown = stored[FLAGGED_KEY];
	return Array.isArray(raw)
		? raw.filter((value): value is string => typeof value === 'string')
		: [];
}

export async function updateFlaggedOrigins(change: (origins: Set<string>) => void): Promise<void> {
	const origins = new Set(await loadFlaggedOrigins());
	change(origins);
	await chrome.storage.local.set({ [FLAGGED_KEY]: [...origins].sort() });
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
	const [settings, permissions, testEntries, flaggedOrigins] = await Promise.all([
		loadSettings(),
		chrome.permissions.getAll(),
		loadTestEntries(),
		loadFlaggedOrigins()
	]);
	return {
		settings,
		granted: permissions.origins ?? [],
		testHosts: [...new Set(testEntries.map((entry) => entry.host))],
		flaggedOrigins
	};
}

const RECORDING_KEY = 'recordingDocuments';
const MAX_RECORDING_DOCUMENTS = 50;

/** Documents where the popup injected the probe by hand. A new page gets a new ID. */
export async function loadRecordingDocuments(): Promise<string[]> {
	const stored = await chrome.storage.session.get(RECORDING_KEY);
	const raw: unknown = stored[RECORDING_KEY];
	return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
}

export async function saveRecordingDocuments(documentIds: readonly string[]): Promise<void> {
	const unique = [...new Set(documentIds)].slice(-MAX_RECORDING_DOCUMENTS);
	await chrome.storage.session.set({ [RECORDING_KEY]: unique });
}
