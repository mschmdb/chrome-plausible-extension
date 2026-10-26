import type { ContentMessage } from './messages';

/**
 * Sends a message from a content script. After the extension is reloaded or removed,
 * scripts left in open tabs lose their context and `sendMessage` throws synchronously.
 * Returns false in that case, so the caller can stop listening.
 */
export function safeSend(message: ContentMessage): boolean {
	try {
		if (!chrome.runtime?.id) return false;
		chrome.runtime.sendMessage(message).catch(() => undefined);
		return true;
	} catch {
		return false;
	}
}
