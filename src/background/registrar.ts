import { planRegistrations, type PlannedScript, type ScriptId } from '../lib/registration';
import { loadState } from './store';

const OUR_IDS: readonly ScriptId[] = ['ignore', 'cleanup', 'probe', 'relay'];

function comparable(script: Partial<PlannedScript>) {
	return JSON.stringify({
		id: script.id,
		js: script.js,
		matches: [...(script.matches ?? [])].sort(),
		excludeMatches: [...(script.excludeMatches ?? [])].sort(),
		world: script.world ?? 'ISOLATED'
	});
}

/** Brings registered content scripts in line with settings, permissions and test mode. */
export async function reconcileRegistrations(): Promise<void> {
	const plan = planRegistrations(await loadState());
	const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [...OUR_IDS] });

	const wanted = new Set(plan.map(comparable));
	const current = new Set(registered.map((script) => comparable(script as Partial<PlannedScript>)));
	if (wanted.size === current.size && [...wanted].every((entry) => current.has(entry))) return;

	if (registered.length > 0) {
		await chrome.scripting.unregisterContentScripts({ ids: registered.map((script) => script.id) });
	}
	if (plan.length > 0) {
		await chrome.scripting.registerContentScripts(plan);
	}
}
