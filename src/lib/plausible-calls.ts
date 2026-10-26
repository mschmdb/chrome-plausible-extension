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

/** Reads an own data property without running getters, which could have side effects. */
function dataProperty(target: unknown, key: string): unknown {
	if (!isRecord(target)) return undefined;
	const descriptor = Object.getOwnPropertyDescriptor(target, key);
	return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}

function describeCall(args: readonly unknown[]): PlausibleCall {
	const [name, options] = args;
	const u = dataProperty(options, 'u');
	const url = dataProperty(options, 'url');
	const props = dataProperty(options, 'props');
	const revenue = dataProperty(options, 'revenue');
	return {
		name: typeof name === 'string' ? name : null,
		url: typeof u === 'string' ? u : typeof url === 'string' ? url : null,
		props: isRecord(props) ? props : null,
		revenue: isRecord(revenue) ? revenue : null,
		interactive: dataProperty(options, 'interactive') !== false
	};
}

/**
 * Wraps whatever function the page stores in `window.plausible`, now or later, in a
 * transparent proxy. Returns a getter for the call in progress.
 */
export function trackPlausibleCalls(win: object): () => PlausibleCall | null {
	let current: PlausibleCall | null = null;
	const descriptor = Object.getOwnPropertyDescriptor(win, 'plausible');
	// A page that manages window.plausible through its own accessor keeps it untouched.
	if (descriptor && (!descriptor.configurable || !('value' in descriptor))) return () => null;

	let stored: unknown = descriptor?.value;
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
