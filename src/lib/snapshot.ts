// Collects what the page exposes about Plausible. Runs in the page's MAIN world via
// chrome.scripting.executeScript, so this function must stay self-contained:
// no imports, no outer variables, only serializable return values.

export interface ScriptInfo {
	src: string | null;
	id: string | null;
	dataDomain: string | null;
	dataApi: string | null;
	inHead: boolean;
	/** Inline script that calls `plausible.init` or defines the `window.plausible` stub. */
	inline: boolean;
}

export interface PageSnapshot {
	/** Base for relative URLs such as `data-api`. The tracker's fetch resolves against it. */
	pageUrl: string;
	hostname: string;
	protocol: string;
	global: { present: boolean; loaded: boolean; version: string | null; lib: string | null };
	scripts: ScriptInfo[];
	csp: string[];
	taggedClasses: string[];
}

export function collectSnapshot(): PageSnapshot {
	const MAX_CLASSES = 200;
	// Legacy installs always carry data-domain. Without it, trust only the host or file name.
	const isCandidateSrc = (url: string): boolean => {
		try {
			const { hostname, pathname } = new URL(url, location.href);
			const file = pathname.split('/').pop() ?? '';
			return hostname.includes('plausible') || /^(pa-[\w-]+|plausible[\w.-]*)\.js$/i.test(file);
		} catch {
			return false;
		}
	};

	const plausible = (window as unknown as { plausible?: unknown }).plausible;
	const fn = typeof plausible === 'function' || typeof plausible === 'object' ? plausible : null;
	const read = (key: string): unknown =>
		fn ? (fn as unknown as Record<string, unknown>)[key] : undefined;
	const text = (value: unknown) =>
		typeof value === 'string' || typeof value === 'number' ? String(value) : null;

	const scripts: ScriptInfo[] = [];
	for (const el of Array.from(document.scripts)) {
		const src = el.getAttribute('src');
		const dataDomain = el.getAttribute('data-domain');
		const inline = !src && /plausible\.init|window\.plausible\s*=/.test(el.textContent ?? '');
		const isCandidate =
			inline ||
			dataDomain !== null ||
			el.id === 'plausible' ||
			(src !== null && isCandidateSrc(src));
		if (!isCandidate) continue;
		scripts.push({
			src: src ? el.src : null,
			id: el.id || null,
			dataDomain,
			dataApi: el.getAttribute('data-api'),
			inHead: el.parentElement === document.head,
			inline
		});
	}

	const csp = Array.from(
		document.querySelectorAll<HTMLMetaElement>('meta[http-equiv="Content-Security-Policy" i]')
	).map((meta) => meta.content);

	const taggedClasses = new Set<string>();
	for (const el of Array.from(document.querySelectorAll('[class*="plausible-event-"]'))) {
		for (const cls of Array.from(el.classList)) {
			if (cls.startsWith('plausible-event-') && taggedClasses.size < MAX_CLASSES) {
				taggedClasses.add(cls);
			}
		}
	}

	return {
		pageUrl: document.baseURI,
		hostname: location.hostname,
		protocol: location.protocol,
		global: {
			present: fn !== null,
			loaded: read('l') === true,
			version: text(read('v')),
			lib: text(read('s'))
		},
		scripts,
		csp,
		taggedClasses: [...taggedClasses]
	};
}
