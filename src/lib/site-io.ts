import { normalizeHost, type Site } from './host';
import { mergeSites } from './settings';

export const EXPORT_FORMAT = 'uncounted/sites';
export const MAX_IMPORT_BYTES = 1_000_000;

export type ImportResult =
	{ ok: true; sites: Site[]; skipped: string[] } | { ok: false; error: string };

export function exportSites(sites: readonly Site[], now = new Date()): string {
	const document = {
		format: EXPORT_FORMAT,
		version: 1,
		exportedAt: now.toISOString(),
		sites: sites.map(({ host, includeSubdomains }) => ({ host, includeSubdomains }))
	};
	return `${JSON.stringify(document, null, '\t')}\n`;
}

function parseEntry(entry: unknown): Site | null {
	if (typeof entry === 'string') {
		const includeSubdomains = entry.startsWith('*.');
		const host = normalizeHost(includeSubdomains ? entry.slice(2) : entry);
		return host ? { host, includeSubdomains } : null;
	}
	if (typeof entry !== 'object' || entry === null) return null;
	const { host, includeSubdomains } = entry as Record<string, unknown>;
	const normalized = typeof host === 'string' ? normalizeHost(host) : null;
	return normalized ? { host: normalized, includeSubdomains: includeSubdomains === true } : null;
}

/** Describes an invalid entry for the user. Never calls methods on imported values. */
function describeEntry(entry: unknown): string {
	const value =
		typeof entry === 'object' && entry !== null && !Array.isArray(entry) && 'host' in entry
			? (entry as { host: unknown }).host
			: entry;
	if (typeof value === 'string') return entry === value ? JSON.stringify(value) : value;
	if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
		return String(value);
	}
	return Array.isArray(value) ? '(list)' : `(${typeof value})`;
}

function collect(entries: unknown[], allowStrings: boolean): ImportResult {
	const sites: Site[] = [];
	const skipped: string[] = [];
	for (const entry of entries) {
		const site = typeof entry === 'string' && !allowStrings ? null : parseEntry(entry);
		if (site) sites.push(site);
		else skipped.push(describeEntry(entry));
	}
	return { ok: true, sites: mergeSites(sites), skipped };
}

/** Accepts an export file or a plain JSON list of host names. */
export function parseImport(json: string): ImportResult {
	if (json.length > MAX_IMPORT_BYTES) return { ok: false, error: 'The file is larger than 1 MB.' };

	let data: unknown;
	try {
		data = JSON.parse(json);
	} catch {
		return { ok: false, error: 'The file is not valid JSON.' };
	}

	if (Array.isArray(data)) return collect(data, true);
	if (typeof data !== 'object' || data === null) {
		return { ok: false, error: 'This is not an Uncounted export.' };
	}

	const { format, version, sites } = data as Record<string, unknown>;
	if (format !== EXPORT_FORMAT) {
		return { ok: false, error: 'This is not an Uncounted export.' };
	}
	if (version !== 1) return { ok: false, error: 'This export version is not supported.' };
	if (!Array.isArray(sites)) return { ok: false, error: 'The export has no site list.' };
	return collect(sites, false);
}
