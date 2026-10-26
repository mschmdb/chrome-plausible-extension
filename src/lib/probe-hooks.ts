// Observes Plausible traffic in the page's MAIN world. Every hook calls the original
// first and never changes arguments, return values or errors seen by the page.
import { parsePayload, type CapturedEvent, type ParsedPayload, type Transport } from './events';

export type Report = (event: CapturedEvent) => void;

const IGNORE_PREFIX = 'Ignoring Event: ';

interface ProbeWindow {
	fetch: typeof fetch;
	XMLHttpRequest: typeof XMLHttpRequest;
	navigator: Navigator;
	console: Console;
	location: Location;
}

function toUrl(input: unknown, base: string): string | null {
	try {
		if (typeof input === 'string' || input instanceof URL) return new URL(input, base).href;
		if (input instanceof Request) return input.url;
	} catch {
		// Fall through to null.
	}
	return null;
}

function droppedHeader(headers: Headers | null): boolean | null {
	const value = headers?.get('x-plausible-dropped');
	return value === null || value === undefined ? null : value === '1';
}

function capture(
	payload: ParsedPayload,
	endpoint: string | null,
	transport: Transport,
	result: Pick<CapturedEvent, 'outcome' | 'reason' | 'httpStatus' | 'dropped'>
): CapturedEvent {
	return { ...payload, endpoint, transport, ...result, time: Date.now() };
}

function safely(fn: () => void): void {
	try {
		fn();
	} catch {
		// The probe must never break the page.
	}
}

function hookFetch(win: ProbeWindow, report: Report): void {
	const original = win.fetch;
	win.fetch = function (this: unknown, ...args: Parameters<typeof fetch>) {
		const promise = original.apply(this, args);
		safely(() => {
			const body = args[1]?.body;
			const payload = typeof body === 'string' ? parsePayload(body) : null;
			if (!payload) return;
			const endpoint = toUrl(args[0], win.location.href);
			promise.then(
				(response) =>
					report(
						capture(payload, endpoint, 'fetch', {
							outcome: response.ok ? 'sent' : 'failed',
							reason: response.ok ? null : `HTTP ${response.status}`,
							httpStatus: response.status,
							dropped: droppedHeader(response.headers)
						})
					),
				(error: unknown) =>
					report(
						capture(payload, endpoint, 'fetch', {
							outcome: 'failed',
							reason: error instanceof Error ? error.message : 'Network error',
							httpStatus: null,
							dropped: null
						})
					)
			);
		});
		return promise;
	} as typeof fetch;
}

function hookXhr(win: ProbeWindow, report: Report): void {
	const proto = win.XMLHttpRequest.prototype;
	const urls = new WeakMap<XMLHttpRequest, string | null>();
	const originalOpen = proto.open;
	const originalSend = proto.send;

	proto.open = function (this: XMLHttpRequest, ...args: unknown[]) {
		safely(() => urls.set(this, toUrl(args[1], win.location.href)));
		return (originalOpen as (...a: unknown[]) => void).apply(this, args);
	} as typeof proto.open;

	proto.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
		safely(() => {
			const payload = typeof body === 'string' ? parsePayload(body) : null;
			if (!payload) return;
			const endpoint = urls.get(this) ?? null;
			this.addEventListener('loadend', () => {
				const ok = this.status >= 200 && this.status < 300;
				let dropped: boolean | null = null;
				safely(() => {
					const value = this.getResponseHeader('x-plausible-dropped');
					dropped = value === null ? null : value === '1';
				});
				report(
					capture(payload, endpoint, 'xhr', {
						outcome: ok ? 'sent' : 'failed',
						reason: ok ? null : this.status === 0 ? 'Network error' : `HTTP ${this.status}`,
						httpStatus: this.status || null,
						dropped
					})
				);
			});
		});
		return originalSend.call(this, body);
	};
}

function hookBeacon(win: ProbeWindow, report: Report): void {
	const nav = win.navigator;
	if (typeof nav.sendBeacon !== 'function') return;
	const original = nav.sendBeacon.bind(nav);
	nav.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
		const queued = original(url, data);
		safely(() => {
			const payload = typeof data === 'string' ? parsePayload(data) : null;
			if (!payload) return;
			report(
				capture(payload, toUrl(url, win.location.href), 'beacon', {
					outcome: queued ? 'sent' : 'failed',
					reason: queued ? null : 'Beacon rejected',
					httpStatus: null,
					dropped: null
				})
			);
		});
		return queued;
	};
}

function hookConsole(win: ProbeWindow, report: Report): void {
	const original = win.console.warn;
	win.console.warn = function (this: Console, ...args: unknown[]) {
		safely(() => {
			const [first] = args;
			if (typeof first !== 'string' || !first.startsWith(IGNORE_PREFIX)) return;
			report({
				name: null,
				url: win.location.href,
				domain: null,
				referrer: null,
				props: null,
				revenue: null,
				interactive: true,
				endpoint: null,
				transport: 'console',
				outcome: 'ignored',
				reason: first.slice(IGNORE_PREFIX.length),
				httpStatus: null,
				dropped: null,
				time: Date.now()
			});
		});
		return original.apply(this, args);
	};
}

export function installProbe(win: ProbeWindow, report: Report): void {
	hookFetch(win, report);
	hookXhr(win, report);
	hookBeacon(win, report);
	hookConsole(win, report);
}
