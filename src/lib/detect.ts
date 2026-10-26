import type { PageSnapshot, ScriptInfo } from './snapshot';

export type DetectionStatus = 'detected' | 'blocked' | 'none';
export type Variant = 'legacy' | 'web' | 'npm' | 'unknown';
export type DiagnosticId =
	'not-loaded' | 'multiple-scripts' | 'not-in-head' | 'localhost' | 'csp' | 'tagged-malformed';

export interface Diagnostic {
	id: DiagnosticId;
	severity: 'warning' | 'info';
	/** Extra detail, e.g. the malformed class names. */
	detail: string | null;
}

export interface Detection {
	status: DetectionStatus;
	variant: Variant | null;
	scriptSrc: string | null;
	domain: string | null;
	endpoint: string | null;
	version: string | null;
	taggedEvents: string[];
	diagnostics: Diagnostic[];
}

const LOCALHOST = /^localhost$|^127(\.[0-9]+){0,2}\.[0-9]+$|^\[::1?\]$/;
const TAGGED_NAME = /^plausible-event-name(?:=|--)(.+)$/;
const TAGGED_PROP = /^plausible-event-[a-z0-9_-]+?(?:=|--).+$/i;

function originOf(url: string | null): string | null {
	if (!url) return null;
	try {
		return new URL(url).origin;
	} catch {
		return null;
	}
}

function resolveUrl(value: string, base: string | null): string | null {
	try {
		return new URL(value, base ?? undefined).href;
	} catch {
		return null;
	}
}

export function parseTaggedClasses(classes: readonly string[]): {
	names: string[];
	malformed: string[];
} {
	const names: string[] = [];
	const malformed: string[] = [];
	for (const cls of classes) {
		const name = TAGGED_NAME.exec(cls)?.[1];
		if (name) names.push(name.replace(/\+/g, ' '));
		else if (!TAGGED_PROP.test(cls) || cls.startsWith('plausible-event-name')) malformed.push(cls);
	}
	return { names, malformed };
}

function detectVariant(snapshot: PageSnapshot, script: ScriptInfo | undefined): Variant | null {
	const { global } = snapshot;
	if (global.lib === 'web') return 'web';
	if (global.lib === 'npm') return 'npm';
	if (script?.src && /\/js\/pa-/.test(script.src)) return 'web';
	if (script?.dataDomain || (global.loaded && global.lib === null)) return 'legacy';
	if (global.present || script) return 'unknown';
	return null;
}

function cspAllows(policy: string, scriptOrigin: string, pageOrigin: string): boolean {
	const directives = new Map(
		policy
			.split(';')
			.map((part) => part.trim().split(/\s+/))
			.filter((tokens) => tokens[0])
			.map((tokens) => [tokens[0]!.toLowerCase(), tokens.slice(1)])
	);
	const sources = directives.get('script-src') ?? directives.get('default-src');
	if (!sources) return true;

	const scheme = new URL(scriptOrigin).protocol;
	return sources.some((source) => {
		const s = source.toLowerCase();
		if (s === '*' || s === scheme) return true;
		if (s === "'self'") return scriptOrigin === pageOrigin;
		return originOf(s) === scriptOrigin;
	});
}

export function analyzeSnapshot(snapshot: PageSnapshot): Detection {
	const external = snapshot.scripts.filter((script) => script.src !== null);
	const main = external[0];
	const variant = detectVariant(snapshot, main);
	const diagnostics: Diagnostic[] = [];
	const add = (id: DiagnosticId, severity: Diagnostic['severity'], detail: string | null = null) =>
		diagnostics.push({ id, severity, detail });

	let status: DetectionStatus = 'none';
	if (snapshot.global.loaded) status = 'detected';
	else if (snapshot.scripts.length > 0 || snapshot.global.present) status = 'blocked';

	if (status === 'blocked') add('not-loaded', 'warning');
	if (external.length > 1) add('multiple-scripts', 'warning', String(external.length));
	if (external.some((script) => !script.inHead)) add('not-in-head', 'info');
	if (LOCALHOST.test(snapshot.hostname) || snapshot.protocol === 'file:') add('localhost', 'info');

	const scriptOrigin = originOf(main?.src ?? null);
	const pageOrigin = originOf(main?.src ? `${snapshot.protocol}//${snapshot.hostname}` : null);
	if (scriptOrigin && pageOrigin) {
		const blocking = snapshot.csp.filter((policy) => !cspAllows(policy, scriptOrigin, pageOrigin));
		if (blocking.length > 0) add('csp', 'warning', blocking.join(' | '));
	}

	const tagged = parseTaggedClasses(snapshot.taggedClasses);
	if (tagged.malformed.length > 0) add('tagged-malformed', 'warning', tagged.malformed.join(', '));

	let endpoint: string | null = null;
	if (variant === 'legacy' && main?.src) {
		endpoint = main.dataApi
			? resolveUrl(main.dataApi, main.src)
			: `${originOf(main.src) ?? ''}/api/event`;
	}

	return {
		status,
		variant,
		scriptSrc: main?.src ?? null,
		domain: main?.dataDomain ?? null,
		endpoint,
		version: snapshot.global.version,
		taggedEvents: tagged.names,
		diagnostics
	};
}
