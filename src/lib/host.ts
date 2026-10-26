export interface Site {
	/** Lowercase, punycode-encoded hostname without trailing dot. */
	host: string;
	includeSubdomains: boolean;
}

// Chrome blocks content scripts on its own store pages.
const BLOCKED_PAGES: readonly { host: string; pathPrefix: string }[] = [
	{ host: 'chromewebstore.google.com', pathPrefix: '/' },
	{ host: 'chrome.google.com', pathPrefix: '/webstore' }
];

const HOSTNAME =
	/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

function stripTrailingDot(host: string): string {
	return host.endsWith('.') ? host.slice(0, -1) : host;
}

function parseUrl(value: string): URL | null {
	try {
		return new URL(value);
	} catch {
		return null;
	}
}

/** Hostname of a page the extension can act on, or null for unsupported pages. */
export function hostFromUrl(url: string): string | null {
	const parsed = parseUrl(url);
	if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) return null;

	const host = stripTrailingDot(parsed.hostname);
	const blocked = BLOCKED_PAGES.some(
		(page) => page.host === host && parsed.pathname.startsWith(page.pathPrefix)
	);
	return blocked || host === '' ? null : host;
}

/** Normalizes user input like "Example.com" or "https://example.com/path" to a hostname. */
export function normalizeHost(input: string): string | null {
	const trimmed = input.trim();
	if (trimmed === '' || /\s|@|\*/.test(trimmed)) return null;

	const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
	if (hasScheme && !/^https?:\/\//i.test(trimmed)) return null;

	const parsed = parseUrl(hasScheme ? trimmed : `https://${trimmed}`);
	if (!parsed) return null;

	const host = stripTrailingDot(parsed.hostname);
	return isIpAddress(host) || HOSTNAME.test(host) ? host : null;
}

export function isIpAddress(host: string): boolean {
	return IPV4.test(host) || host.startsWith('[');
}

/** Chrome match patterns for a site. `*://` covers http and https. */
export function matchPatterns(site: Site): string[] {
	const patterns = [`*://${site.host}/*`];
	if (site.includeSubdomains && !isIpAddress(site.host)) {
		patterns.push(`*://*.${site.host}/*`);
	}
	return patterns;
}

export function siteCoversHost(site: Site, host: string): boolean {
	if (host === site.host) return true;
	return site.includeSubdomains && !isIpAddress(site.host) && host.endsWith(`.${site.host}`);
}
