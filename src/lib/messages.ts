import { isCapturedEvent, type CapturedEvent } from './events';
import { normalizeHost, type Site } from './host';

/** Tag for window messages from the MAIN-world probe to the relay content script. */
export const PROBE_SOURCE = 'uncounted:probe';

export interface ProbeMessage {
	source: typeof PROBE_SOURCE;
	event: CapturedEvent;
}

export type ContentMessage =
	| { type: 'flag-set' }
	| { type: 'flag-blocked' }
	| { type: 'flag-cleared' }
	| { type: 'event'; event: CapturedEvent };

export type UiRequest =
	| { type: 'get-settings' }
	| { type: 'get-leftovers' }
	| { type: 'forget-leftovers' }
	| { type: 'get-tab-status'; tabId: number }
	| { type: 'enable-site'; site: Site }
	| { type: 'disable-site'; host: string }
	| { type: 'set-subdomains'; host: string; enabled: boolean }
	| { type: 'set-global'; enabled: boolean }
	| { type: 'set-event-log'; enabled: boolean }
	| { type: 'test-start'; tabId: number }
	| { type: 'test-stop'; host: string }
	| { type: 'clear-events'; tabId: number }
	| { type: 'clear-flag'; tabId: number }
	| { type: 'record-tab'; tabId: number }
	| { type: 'import-sites'; sites: Site[] }
	| { type: 'pending-grant'; action: GrantAction };

/** Requests that need a host permission first. The popup may close during the prompt. */
export type GrantAction =
	| { type: 'enable-site'; site: Site }
	| { type: 'set-subdomains'; host: string; enabled: true }
	| { type: 'set-global'; enabled: true };

export type UiResponse<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isTabId = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;
const isHost = (value: unknown) => typeof value === 'string' && normalizeHost(value) === value;
const isSite = (value: unknown): value is Site =>
	isRecord(value) && isHost(value.host) && typeof value.includeSubdomains === 'boolean';

export function isProbeMessage(value: unknown): value is ProbeMessage {
	return isRecord(value) && value.source === PROBE_SOURCE && isCapturedEvent(value.event);
}

export function isContentMessage(value: unknown): value is ContentMessage {
	if (!isRecord(value)) return false;
	switch (value.type) {
		case 'flag-set':
		case 'flag-blocked':
		case 'flag-cleared':
			return true;
		case 'event':
			return isCapturedEvent(value.event);
		default:
			return false;
	}
}

export function isGrantAction(value: unknown): value is GrantAction {
	if (!isRecord(value)) return false;
	switch (value.type) {
		case 'enable-site':
			return isSite(value.site);
		case 'set-subdomains':
			return isHost(value.host) && value.enabled === true;
		case 'set-global':
			return value.enabled === true;
		default:
			return false;
	}
}

export function isUiRequest(value: unknown): value is UiRequest {
	if (!isRecord(value)) return false;
	switch (value.type) {
		case 'pending-grant':
			return isGrantAction(value.action);
		case 'get-settings':
		case 'get-leftovers':
		case 'forget-leftovers':
			return true;
		case 'get-tab-status':
		case 'test-start':
		case 'clear-events':
		case 'clear-flag':
		case 'record-tab':
			return isTabId(value.tabId);
		case 'enable-site':
			return isSite(value.site);
		case 'disable-site':
		case 'test-stop':
			return isHost(value.host);
		case 'set-subdomains':
			return isHost(value.host) && typeof value.enabled === 'boolean';
		case 'set-global':
		case 'set-event-log':
			return typeof value.enabled === 'boolean';
		case 'import-sites':
			return Array.isArray(value.sites) && value.sites.every(isSite);
		default:
			return false;
	}
}
