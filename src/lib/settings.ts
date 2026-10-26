import { normalizeHost, siteCoversHost, type Site } from './host';

export interface Settings {
	/** Set the flag on every site. Needs the optional host permission for all sites. */
	global: boolean;
	/** Record Plausible events in the debug view. */
	eventLog: boolean;
	sites: Site[];
}

/** Storage shape. Sites are strings to stay below the 8 KB `storage.sync` item limit. */
export interface EncodedSettings {
	v: 1;
	global: boolean;
	eventLog: boolean;
	/** `example.com` or `*.example.com` for the host plus its subdomains. */
	sites: string[];
}

export const SETTINGS_KEY = 'settings';

export const DEFAULT_SETTINGS: Settings = Object.freeze({
	global: false,
	eventLog: false,
	sites: []
}) as Settings;

const SUBDOMAIN_PREFIX = '*.';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeSite(value: unknown): Site | null {
	if (typeof value !== 'string') return null;
	const includeSubdomains = value.startsWith(SUBDOMAIN_PREFIX);
	const host = normalizeHost(includeSubdomains ? value.slice(SUBDOMAIN_PREFIX.length) : value);
	return host ? { host, includeSubdomains } : null;
}

function encodeSite(site: Site): string {
	return site.includeSubdomains ? `${SUBDOMAIN_PREFIX}${site.host}` : site.host;
}

function sortSites(sites: Site[]): Site[] {
	return sites.toSorted((a, b) => a.host.localeCompare(b.host));
}

/** Merges duplicates. If any entry includes subdomains, the merged site does too. */
export function mergeSites(sites: Iterable<Site>): Site[] {
	const byHost = new Map<string, Site>();
	for (const site of sites) {
		const existing = byHost.get(site.host);
		byHost.set(site.host, {
			host: site.host,
			includeSubdomains: site.includeSubdomains || (existing?.includeSubdomains ?? false)
		});
	}
	return sortSites([...byHost.values()]);
}

export function decodeSettings(raw: unknown): Settings {
	if (!isRecord(raw) || raw.v !== 1) return { ...DEFAULT_SETTINGS, sites: [] };

	const rawSites = Array.isArray(raw.sites) ? raw.sites : [];
	const sites = rawSites.map(decodeSite).filter((site): site is Site => site !== null);

	return {
		global: raw.global === true,
		eventLog: raw.eventLog === true,
		sites: mergeSites(sites)
	};
}

export function encodeSettings(settings: Settings): EncodedSettings {
	return {
		v: 1,
		global: settings.global,
		eventLog: settings.eventLog,
		sites: settings.sites.map(encodeSite)
	};
}

export function addSite(settings: Settings, site: Site): Settings {
	const others = settings.sites.filter((existing) => existing.host !== site.host);
	return { ...settings, sites: sortSites([...others, { ...site }]) };
}

export function removeSite(settings: Settings, host: string): Settings {
	if (!settings.sites.some((site) => site.host === host)) return settings;
	return { ...settings, sites: settings.sites.filter((site) => site.host !== host) };
}

export function setSubdomains(
	settings: Settings,
	host: string,
	includeSubdomains: boolean
): Settings {
	if (!settings.sites.some((site) => site.host === host)) return settings;
	return {
		...settings,
		sites: settings.sites.map((site) =>
			site.host === host ? { ...site, includeSubdomains } : site
		)
	};
}

export function findSite(settings: Settings, host: string): Site | undefined {
	return settings.sites.find((site) => siteCoversHost(site, host));
}
