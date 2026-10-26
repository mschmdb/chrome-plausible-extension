import type { GrantAction, UiRequest, UiResponse } from '../lib/messages';
import { requiredOrigins } from '../lib/grant-origins';

export async function send<T = unknown>(request: UiRequest): Promise<T> {
	const response = (await chrome.runtime.sendMessage(request)) as UiResponse<T> | undefined;
	if (!response) throw new Error('The extension did not answer. Try again.');
	if (!response.ok) throw new Error(response.error);
	return response.data;
}

/**
 * Asks for host access, then runs the action. Must be called directly from a click
 * handler: Chrome only shows the prompt during a user gesture.
 */
export async function requestAndRun(action: GrantAction): Promise<boolean> {
	void send({ type: 'pending-grant', action }).catch(() => undefined);
	const granted = await chrome.permissions.request({ origins: requiredOrigins(action) });
	if (granted) await send(action);
	return granted;
}

export async function activeTabId(): Promise<number | null> {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	return tab?.id ?? null;
}
