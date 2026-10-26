import { matchPatterns, siteCoversHost, type Site } from './host';
import type { Settings } from './settings';

/** Host permission for global mode. Covers http and https on every host. */
export const ALL_SITES_PATTERN = '*://*/*';

export type ScriptId = 'ignore' | 'cleanup' | 'probe' | 'relay';

export interface PlannedScript {
	id: ScriptId;
	js: string[];
	matches: string[];
	excludeMatches?: string[];
	runAt: 'document_start';
	world: 'ISOLATED' | 'MAIN';
	allFrames: false;
	persistAcrossSessions: true;
}

export interface ExtensionState {
	settings: Settings;
	/** Origins from `chrome.permissions.getAll()`. */
	granted: readonly string[];
	/** Hosts in test mode. The flag stays off there. */
	testHosts: readonly string[];
	/** Origins (scheme, host, port) where the extension set the flag and has not cleared it. */
	flaggedOrigins: readonly string[];
}

function hostOfPattern(pattern: string): string | null {
	if (pattern === '<all_urls>') return '*';
	const match = /^(\*|https?):\/\/([^/]+)\//.exec(pattern);
	return match?.[2] ?? null;
}

function grantedHostCovers(granted: string, wanted: string): boolean {
	if (granted === '*' || granted === wanted) return true;
	if (!granted.startsWith('*.')) return false;
	const base = granted.slice(2);
	const wantedBase = wanted.startsWith('*.') ? wanted.slice(2) : wanted;
	return wantedBase === base || wantedBase.endsWith(`.${base}`);
}

/** True if any granted origin covers the host part of a `*://host/*` pattern. */
export function isPatternGranted(pattern: string, granted: readonly string[]): boolean {
	const wanted = hostOfPattern(pattern);
	if (!wanted) return false;
	return granted.some((origin) => {
		const host = hostOfPattern(origin);
		return host !== null && grantedHostCovers(host, wanted);
	});
}

function isSiteGranted(site: Site, granted: readonly string[]): boolean {
	return matchPatterns(site).every((pattern) => isPatternGranted(pattern, granted));
}

function isGlobalActive(state: ExtensionState): boolean {
	return state.settings.global && isPatternGranted(ALL_SITES_PATTERN, state.granted);
}

function activeSites(state: ExtensionState): Site[] {
	return state.settings.sites.filter((site) => isSiteGranted(site, state.granted));
}

function hostPattern(host: string): string {
	return `*://${host}/*`;
}

function script(
	id: ScriptId,
	matches: string[],
	world: PlannedScript['world'],
	excludeMatches: string[] = []
): PlannedScript {
	return {
		id,
		js: [`content/${id}.js`],
		matches,
		...(excludeMatches.length > 0 ? { excludeMatches } : {}),
		runAt: 'document_start',
		world,
		allFrames: false,
		persistAcrossSessions: true
	};
}

/** Content scripts the extension should have registered for the given state. */
export function planRegistrations(state: ExtensionState): PlannedScript[] {
	const global = isGlobalActive(state);
	const sites = activeSites(state);
	const ignoreMatches = global ? [ALL_SITES_PATTERN] : sites.flatMap(matchPatterns);
	const testPatterns = state.testHosts.map(hostPattern);
	const plan: PlannedScript[] = [];

	if (ignoreMatches.length > 0) {
		plan.push(script('ignore', ignoreMatches, 'ISOLATED', testPatterns));
	}

	const cleanupMatches = pendingCleanup(state)
		.map(originPattern)
		.filter((pattern): pattern is string => pattern !== null)
		.filter((pattern) => isPatternGranted(pattern, state.granted));
	if (cleanupMatches.length > 0) {
		plan.push(script('cleanup', [...new Set(cleanupMatches)], 'ISOLATED'));
	}

	if (state.settings.eventLog && ignoreMatches.length > 0) {
		const extraTestPatterns = global
			? []
			: testPatterns.filter(
					(pattern) => isPatternGranted(pattern, state.granted) && !ignoreMatches.includes(pattern)
				);
		const logMatches = [...ignoreMatches, ...extraTestPatterns];
		plan.push(script('probe', logMatches, 'MAIN'));
		plan.push(script('relay', logMatches, 'ISOLATED'));
	}

	return plan;
}

function parseOrigin(origin: string): URL | null {
	try {
		const url = new URL(origin);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
	} catch {
		return null;
	}
}

/** Match pattern for one origin. Patterns cannot carry a port, so they cover all ports. */
function originPattern(origin: string): string | null {
	const url = parseOrigin(origin);
	return url ? `${url.protocol}//${url.hostname}/*` : null;
}

/** Flagged origins that should lose the flag. Test hosts are handled by test mode. */
export function pendingCleanup(state: ExtensionState): string[] {
	return state.flaggedOrigins.filter((origin) => {
		const host = parseOrigin(origin)?.hostname;
		if (!host || state.testHosts.includes(host)) return false;
		const wanted =
			state.settings.global || state.settings.sites.some((s) => siteCoversHost(s, host));
		return !wanted;
	});
}

/**
 * Host grants in this extension's own format that no setting and no pending cleanup needs.
 * Access to all sites never stays for cleanup alone: users expect it gone with global mode.
 */
export function unneededGrants(state: ExtensionState, keep: readonly string[] = []): string[] {
	const sitePatterns = new Set(state.settings.sites.flatMap(matchPatterns));
	const cleanupPatterns = pendingCleanup(state)
		.map(originPattern)
		.filter((pattern): pattern is string => pattern !== null);

	return state.granted.filter((grant) => {
		if (!grant.startsWith('*://') || keep.includes(grant)) return false;
		if (grant === ALL_SITES_PATTERN) return !state.settings.global;
		if (sitePatterns.has(grant)) return false;
		return !cleanupPatterns.some((pattern) => isPatternGranted(pattern, [grant]));
	});
}

/** Whether the flag should be set on this host right now. */
export function shouldIgnoreHost(state: ExtensionState, host: string): boolean {
	if (state.testHosts.includes(host)) return false;
	if (isGlobalActive(state)) return true;
	return activeSites(state).some((site) => siteCoversHost(site, host));
}
