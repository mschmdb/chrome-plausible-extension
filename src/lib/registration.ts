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
	/** Removed sites whose flag still needs to be cleared on the next visit. */
	cleanupSites: readonly Site[];
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

	const cleanupMatches = state.cleanupSites
		.filter((site) => isSiteGranted(site, state.granted))
		.filter((site) => !global && !sites.some((active) => siteCoversHost(active, site.host)))
		.flatMap(matchPatterns);
	if (cleanupMatches.length > 0) {
		plan.push(script('cleanup', cleanupMatches, 'ISOLATED'));
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

/** Whether the flag should be set on this host right now. */
export function shouldIgnoreHost(state: ExtensionState, host: string): boolean {
	if (state.testHosts.includes(host)) return false;
	if (isGlobalActive(state)) return true;
	return activeSites(state).some((site) => siteCoversHost(site, host));
}
