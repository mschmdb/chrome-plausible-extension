// Remembers what the user wanted while Chrome shows the permission prompt.
// If the popup closes during the prompt, permissions.onAdded still finishes the action.
import { requiredOrigins } from '../lib/grant-origins';
import { isGrantAction, type GrantAction } from '../lib/messages';

const KEY = 'pendingGrant';
const MAX_AGE_MS = 5 * 60 * 1000;

export async function rememberGrant(action: GrantAction): Promise<void> {
	await chrome.storage.session.set({ [KEY]: { action, at: Date.now() } });
}

/** Returns the pending action once its permission is granted, and forgets it. */
export async function takeGrantedAction(): Promise<GrantAction | null> {
	const stored = await chrome.storage.session.get(KEY);
	const entry = stored[KEY] as { action?: unknown; at?: unknown } | undefined;
	if (!entry || !isGrantAction(entry.action) || typeof entry.at !== 'number') return null;
	if (Date.now() - entry.at > MAX_AGE_MS) {
		await chrome.storage.session.remove(KEY);
		return null;
	}
	if (!(await chrome.permissions.contains({ origins: requiredOrigins(entry.action) }))) return null;
	await chrome.storage.session.remove(KEY);
	return entry.action;
}
