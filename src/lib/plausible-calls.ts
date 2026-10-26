// Remembers which `plausible(name, options)` call is running. The tracker's
// "Ignoring Event" warning carries only the reason, so the probe uses this to name the
// skipped event. Runs in the page's MAIN world and must never change the page's behavior.

export interface PlausibleCall {
	name: string | null;
	url: string | null;
	props: Record<string, unknown> | null;
	revenue: Record<string, unknown> | null;
	interactive: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeCall(args: readonly unknown[]): PlausibleCall {
	const [name, options] = args;
	const opts = isRecord(options) ? options : {};
	const url = typeof opts.u === 'string' ? opts.u : typeof opts.url === 'string' ? opts.url : null;
	return {
		name: typeof name === 'string' ? name : null,
		url,
		props: isRecord(opts.props) ? opts.props : null,
		revenue: isRecord(opts.revenue) ? opts.revenue : null,
		interactive: opts.interactive !== false
	};
}

/**
 * Wraps whatever function the page stores in `window.plausible`, now or later, in a
 * transparent proxy. Returns a getter for the call in progress.
 */
export function trackPlausibleCalls(win: object): () => PlausibleCall | null {
	let current: PlausibleCall | null = null;
	const descriptor = Object.getOwnPropertyDescriptor(win, 'plausible');
	if (descriptor && !descriptor.configurable) return () => null;

	let stored: unknown = descriptor?.get ? descriptor.get.call(win) : descriptor?.value;
	const proxies = new WeakMap<object, unknown>();

	const wrap = (value: unknown): unknown => {
		if (typeof value !== 'function') return value;
		const cached = proxies.get(value);
		if (cached) return cached;
		const proxy = new Proxy(value, {
			apply(target, thisArg, args: unknown[]) {
				const previous = current;
				try {
					current = describeCall(args);
				} catch {
					current = null;
				}
				try {
					return Reflect.apply(target, thisArg, args);
				} finally {
					current = previous;
				}
			}
		});
		proxies.set(value, proxy);
		return proxy;
	};

	Object.defineProperty(win, 'plausible', {
		configurable: true,
		enumerable: true,
		get: () => wrap(stored),
		set: (value: unknown) => {
			stored = value;
		}
	});

	return () => current;
}
