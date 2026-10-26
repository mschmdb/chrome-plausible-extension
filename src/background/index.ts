import { hostFromUrl } from '../lib/host';
import { isContentMessage, isUiRequest, type UiResponse } from '../lib/messages';
import { SETTINGS_KEY } from '../lib/settings';
import { refreshBadge } from './badge';
import { reconcileRegistrations } from './registrar';
import {
	completePendingGrant,
	finishCleanup,
	handleUiRequest,
	onTabRemoved,
	recordEvent,
	serial
} from './service';

const EXTENSION_ORIGIN = chrome.runtime.getURL('');

const reconcile = () => serial(reconcileRegistrations).catch(() => undefined);

chrome.runtime.onInstalled.addListener(() => void reconcile());
chrome.runtime.onStartup.addListener(() => void reconcile());
chrome.permissions.onAdded.addListener(() => {
	void reconcile();
	void completePendingGrant().catch(() => undefined);
});
chrome.permissions.onRemoved.addListener(() => void reconcile());
chrome.storage.sync.onChanged.addListener((changes) => {
	// Settings can change on another device.
	if (SETTINGS_KEY in changes) void reconcile();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
	if (changeInfo.status === 'complete') void refreshBadge(tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => void onTabRemoved(tabId).catch(() => undefined));

function handleContentMessage(message: unknown, sender: chrome.runtime.MessageSender): void {
	const tabId = sender.tab?.id;
	if (tabId === undefined || !isContentMessage(message)) return;
	switch (message.type) {
		case 'event':
			void recordEvent(tabId, message.event).catch(() => undefined);
			return;
		case 'flag-cleared': {
			const host = sender.url ? hostFromUrl(sender.url) : null;
			if (host) void finishCleanup(host).catch(() => undefined);
			void refreshBadge(tabId);
			return;
		}
		case 'flag-blocked':
			void refreshBadge(tabId);
	}
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
	if (sender.id !== chrome.runtime.id) return false;

	const fromExtensionPage = sender.url?.startsWith(EXTENSION_ORIGIN) ?? false;
	if (!fromExtensionPage) {
		handleContentMessage(message, sender);
		return false;
	}

	if (!isUiRequest(message)) {
		sendResponse({ ok: false, error: 'Invalid request.' } satisfies UiResponse);
		return false;
	}
	handleUiRequest(message).then(
		(data) => sendResponse({ ok: true, data: data ?? null } satisfies UiResponse),
		(error: unknown) =>
			sendResponse({
				ok: false,
				error: error instanceof Error ? error.message : 'Something went wrong.'
			} satisfies UiResponse)
	);
	return true;
});
