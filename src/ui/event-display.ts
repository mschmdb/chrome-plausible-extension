import type { CapturedEvent } from '../lib/events';

/** Path only, for the one-line row. */
export function shortPath(url: string): string {
	try {
		return new URL(url).pathname;
	} catch {
		return url;
	}
}

function safeDecode(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

/** Full URL with percent-encoding decoded for reading. `+` means a space only in the query. */
export function decodedUrl(url: string): string {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return url;
	}
	const query = parsed.search ? safeDecode(parsed.search.replace(/\+/g, ' ')) : '';
	return `${parsed.origin}${safeDecode(parsed.pathname)}${query}${safeDecode(parsed.hash)}`;
}

export function outcomeChip(event: CapturedEvent): string {
	if (event.outcome === 'ignored') return 'Ignored';
	if (event.outcome === 'failed') return 'Failed';
	if (event.dropped) return 'Dropped';
	return event.httpStatus ? String(event.httpStatus) : 'Sent';
}

export function outcomeText(event: CapturedEvent): string {
	if (event.outcome === 'ignored') return `Ignored: ${event.reason ?? 'unknown reason'}`;
	if (event.outcome === 'failed') return `Failed: ${event.reason ?? 'unknown error'}`;
	if (event.dropped) return 'Dropped by the server (x-plausible-dropped).';
	if (event.httpStatus === 202) {
		return 'Accepted (202). Plausible may still drop it, e.g. as bot traffic.';
	}
	return event.httpStatus ? `Sent (${event.httpStatus}).` : 'Sent.';
}
