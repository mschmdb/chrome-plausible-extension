// Plausible event payloads as sent by the tracker (fields n, u, d, r, p, $, i).
// Limits from https://plausible.io/docs/events-api and the custom props docs.

export type Transport = 'fetch' | 'xhr' | 'beacon' | 'console';
export type Outcome = 'sent' | 'ignored' | 'failed';
export type EventKind =
	'pageview' | 'outbound' | 'file-download' | 'not-found' | 'custom' | 'unknown';
export type PayloadWarning =
	| 'url-too-long'
	| 'too-many-props'
	| 'prop-key-too-long'
	| 'prop-value-too-long'
	| 'prop-value-not-scalar'
	| 'revenue-invalid';

export interface ParsedPayload {
	name: string;
	url: string;
	domain: string | null;
	referrer: string | null;
	props: Record<string, unknown> | null;
	revenue: Record<string, unknown> | null;
	interactive: boolean;
}

export interface CapturedEvent extends Omit<ParsedPayload, 'name'> {
	/** Null when the tracker only reported an ignored event without its name. */
	name: string | null;
	endpoint: string | null;
	transport: Transport;
	outcome: Outcome;
	/** Reason from the tracker's "Ignoring Event" warning or the network error. */
	reason: string | null;
	httpStatus: number | null;
	/** `x-plausible-dropped` response header, if the server exposed it. */
	dropped: boolean | null;
	time: number;
}

export const MAX_URL_LENGTH = 2000;
export const MAX_PROPS = 30;
export const MAX_PROP_KEY_LENGTH = 300;
export const MAX_PROP_VALUE_LENGTH = 2000;
export const MAX_LOG_SIZE = 100;

const TRANSPORTS: readonly Transport[] = ['fetch', 'xhr', 'beacon', 'console'];
const OUTCOMES: readonly Outcome[] = ['sent', 'ignored', 'failed'];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const stringOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null);

export function parsePayload(body: string): ParsedPayload | null {
	let data: unknown;
	try {
		data = JSON.parse(body);
	} catch {
		return null;
	}
	if (!isRecord(data) || typeof data.n !== 'string' || typeof data.u !== 'string') return null;

	return {
		name: data.n,
		url: data.u,
		domain: stringOrNull(data.d),
		referrer: stringOrNull(data.r),
		props: isRecord(data.p) ? data.p : null,
		revenue: isRecord(data.$) ? data.$ : null,
		interactive: data.i !== false
	};
}

export function classifyEvent(name: string | null): EventKind {
	switch (name) {
		case null:
			return 'unknown';
		case 'pageview':
			return 'pageview';
		case 'Outbound Link: Click':
			return 'outbound';
		case 'File Download':
			return 'file-download';
		case '404':
			return 'not-found';
		default:
			return 'custom';
	}
}

const isScalar = (value: unknown) =>
	value === null || ['string', 'number', 'boolean'].includes(typeof value);

function isValidRevenue(revenue: Record<string, unknown>): boolean {
	const { currency, amount } = revenue;
	const validCurrency = typeof currency === 'string' && /^[A-Z]{3}$/.test(currency);
	const validAmount =
		(typeof amount === 'number' && Number.isFinite(amount)) ||
		(typeof amount === 'string' && amount.trim() !== '' && Number.isFinite(Number(amount)));
	return validCurrency && validAmount;
}

export function validatePayload(
	event: Pick<CapturedEvent, 'url' | 'props' | 'revenue'>
): PayloadWarning[] {
	const warnings = new Set<PayloadWarning>();
	if (event.url.length > MAX_URL_LENGTH) warnings.add('url-too-long');

	const entries = Object.entries(event.props ?? {});
	if (entries.length > MAX_PROPS) warnings.add('too-many-props');
	for (const [key, value] of entries) {
		if (key.length > MAX_PROP_KEY_LENGTH) warnings.add('prop-key-too-long');
		if (!isScalar(value)) warnings.add('prop-value-not-scalar');
		else if (String(value).length > MAX_PROP_VALUE_LENGTH) warnings.add('prop-value-too-long');
	}

	if (event.revenue && !isValidRevenue(event.revenue)) warnings.add('revenue-invalid');
	return [...warnings];
}

const isNullableString = (value: unknown) => value === null || typeof value === 'string';
const isNullableRecord = (value: unknown) => value === null || isRecord(value);

/** Validates events that cross a trust boundary (page → extension). */
export function isCapturedEvent(value: unknown): value is CapturedEvent {
	if (!isRecord(value)) return false;
	return (
		isNullableString(value.name) &&
		typeof value.url === 'string' &&
		isNullableString(value.domain) &&
		isNullableString(value.referrer) &&
		isNullableRecord(value.props) &&
		isNullableRecord(value.revenue) &&
		typeof value.interactive === 'boolean' &&
		isNullableString(value.endpoint) &&
		TRANSPORTS.includes(value.transport as Transport) &&
		OUTCOMES.includes(value.outcome as Outcome) &&
		isNullableString(value.reason) &&
		(value.httpStatus === null || Number.isInteger(value.httpStatus)) &&
		(value.dropped === null || typeof value.dropped === 'boolean') &&
		typeof value.time === 'number' &&
		Number.isFinite(value.time)
	);
}

/** Newest first, capped at `max` entries. */
export function appendEvent(
	log: readonly CapturedEvent[],
	event: CapturedEvent,
	max = MAX_LOG_SIZE
): CapturedEvent[] {
	return [event, ...log].slice(0, max);
}

/** Cap for single string fields. Above Plausible's URL limit, so the warning still fires. */
export const MAX_FIELD_LENGTH = 4000;
const MAX_OBJECT_BYTES = 8000;
export const MAX_EVENT_BYTES = 32_000;

const trim = (value: string) =>
	value.length > MAX_FIELD_LENGTH ? `${value.slice(0, MAX_FIELD_LENGTH)}…` : value;
const trimOrNull = (value: string | null) => (value === null ? null : trim(value));

function boundObject(
	value: Record<string, unknown> | null,
	label: string
): Record<string, unknown> | null {
	if (value === null) return null;
	return JSON.stringify(value).length > MAX_OBJECT_BYTES
		? { '(dropped)': `${label} larger than 8 KB` }
		: value;
}

/** Keeps page-controlled events small enough for session storage. */
export function boundEvent(event: CapturedEvent): CapturedEvent {
	return {
		...event,
		name: trimOrNull(event.name),
		url: trim(event.url),
		domain: trimOrNull(event.domain),
		referrer: trimOrNull(event.referrer),
		endpoint: trimOrNull(event.endpoint),
		reason: trimOrNull(event.reason),
		props: boundObject(event.props, 'Properties'),
		revenue: boundObject(event.revenue, 'Revenue')
	};
}
