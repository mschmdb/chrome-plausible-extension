// These functions run inside web pages via chrome.scripting.executeScript, which
// serializes them. They must stay self-contained: no imports, no outer variables.
// The tracker checks `localStorage.plausible_ignore === 'true'` on every event.
import type { FlagState } from './status';

export function readFlagInPage(): FlagState {
	try {
		return { value: localStorage.getItem('plausible_ignore') };
	} catch {
		return { blocked: true };
	}
}

export function setFlagInPage(): FlagState {
	try {
		localStorage.setItem('plausible_ignore', 'true');
		return { value: localStorage.getItem('plausible_ignore') };
	} catch {
		return { blocked: true };
	}
}

export function clearFlagInPage(): FlagState {
	try {
		localStorage.removeItem('plausible_ignore');
		return { value: localStorage.getItem('plausible_ignore') };
	} catch {
		return { blocked: true };
	}
}
