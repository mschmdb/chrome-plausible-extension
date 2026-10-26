// These functions run inside web pages via chrome.scripting.executeScript, which
// serializes them. They must stay self-contained: no imports, no outer variables.
// The tracker checks `localStorage.plausible_ignore === 'true'` on every event.
//
// `expectedHost` guards against a navigation between choosing the tab and running the
// script: if the page is no longer on that host, nothing happens and null comes back.
import type { FlagState } from './status';

export function readFlagInPage(): FlagState {
	try {
		return { value: localStorage.getItem('plausible_ignore') };
	} catch {
		return { blocked: true };
	}
}

/** `changed` is false if the flag was already "true", e.g. set by hand. */
export function setFlagInPage(
	expectedHost: string | null = null
): ({ value: string | null; changed: boolean } | { blocked: true }) | null {
	if (expectedHost !== null && location.hostname !== expectedHost) return null;
	try {
		const before = localStorage.getItem('plausible_ignore');
		localStorage.setItem('plausible_ignore', 'true');
		const value = localStorage.getItem('plausible_ignore');
		return { value, changed: before !== value };
	} catch {
		return { blocked: true };
	}
}

export function clearFlagInPage(expectedHost: string | null = null): FlagState | null {
	if (expectedHost !== null && location.hostname !== expectedHost) return null;
	try {
		localStorage.removeItem('plausible_ignore');
		return { value: localStorage.getItem('plausible_ignore') };
	} catch {
		return { blocked: true };
	}
}
