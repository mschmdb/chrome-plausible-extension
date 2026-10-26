<script lang="ts">
	import { onMount } from 'svelte';
	import { ALL_SITES_PATTERN, isPatternGranted } from '../../lib/registration';
	import type { Settings } from '../../lib/settings';
	import { send } from '../client';
	import Notice from '../components/Notice.svelte';
	import Switch from '../components/Switch.svelte';
	import GlobalMode from './GlobalMode.svelte';
	import ImportExport from './ImportExport.svelte';
	import Leftovers from './Leftovers.svelte';
	import SiteList from './SiteList.svelte';

	let settings = $state<Settings | null>(null);
	let granted = $state<string[]>([]);
	let leftovers = $state<string[]>([]);
	let busy = $state(false);
	let error = $state<string | null>(null);

	async function load() {
		const [loaded, permissions, left] = await Promise.all([
			send<Settings>({ type: 'get-settings' }),
			chrome.permissions.getAll(),
			send<string[]>({ type: 'get-leftovers' })
		]);
		settings = loaded;
		granted = permissions.origins ?? [];
		leftovers = left;
	}

	/** Starts the task synchronously, so permission prompts keep the click's user gesture. */
	function run(task: () => Promise<unknown>) {
		busy = true;
		error = null;
		task()
			.catch((err: unknown) => {
				error = err instanceof Error ? err.message : 'Something went wrong.';
			})
			.finally(async () => {
				await load().catch(() => undefined);
				busy = false;
			});
	}

	onMount(() => {
		load().catch((err: unknown) => {
			error = err instanceof Error ? err.message : 'Could not load the settings.';
		});
		const reload = () => void load().catch(() => undefined);
		chrome.storage.sync.onChanged.addListener(reload);
		chrome.storage.local.onChanged.addListener(reload);
		chrome.permissions.onAdded.addListener(reload);
		chrome.permissions.onRemoved.addListener(reload);
		return () => {
			chrome.storage.sync.onChanged.removeListener(reload);
			chrome.storage.local.onChanged.removeListener(reload);
			chrome.permissions.onAdded.removeListener(reload);
			chrome.permissions.onRemoved.removeListener(reload);
		};
	});
</script>

<main>
	<header>
		<h1>Ignore for Plausible</h1>
		<p>
			Sets <code>localStorage.plausible_ignore</code> so Plausible Analytics skips your own visits. No
			data leaves your browser.
		</p>
	</header>

	<div role="alert">
		{#if error}
			<Notice tone="error"><p>{error}</p></Notice>
		{/if}
	</div>

	{#if settings}
		<GlobalMode
			enabled={settings.global}
			granted={isPatternGranted(ALL_SITES_PATTERN, granted)}
			{busy}
			{run}
		/>
		<SiteList sites={settings.sites} {granted} {busy} {run} />
		<Leftovers origins={leftovers} {busy} {run} />
		<ImportExport sites={settings.sites} {busy} {run} />
		<section aria-labelledby="dev-title">
			<h2 id="dev-title">Developer tools</h2>
			<Switch
				label="Record Plausible events"
				description="Watches network requests to Plausible on ignored sites and lists them in the popup. Nothing leaves your browser. Reload open pages after turning it on."
				checked={settings.eventLog}
				disabled={busy}
				{busy}
				onchange={(enabled) => run(() => send({ type: 'set-event-log', enabled }))}
			/>
		</section>
	{:else if !error}
		<p role="status">Loading settings…</p>
	{/if}
	<footer>
		<p>
			Unofficial extension. Not made by, endorsed by or affiliated with
			<a href="https://plausible.io" target="_blank" rel="noopener noreferrer"
				>Plausible Analytics<span class="visually-hidden"> (opens in a new tab)</span></a
			>. It uses the
			<a
				href="https://plausible.io/docs/excluding-localstorage"
				target="_blank"
				rel="noopener noreferrer"
				>opt-out flag Plausible documents<span class="visually-hidden">
					(opens in a new tab)</span
				></a
			>.
		</p>
	</footer>
</main>

<style>
	footer {
		padding-top: var(--space-4);
		border-top: 1px solid var(--rule);
		color: var(--ink-muted);
		font-size: var(--text-sm);
	}
	footer a {
		color: var(--accent);
	}
	main {
		display: grid;
		gap: var(--space-6);
		max-width: 44rem;
		margin: 0 auto;
		padding: var(--space-6) var(--space-4);
	}
	h1 {
		margin: 0 0 var(--space-2);
		font-size: var(--text-lg);
	}
	header p {
		margin: 0;
		color: var(--ink-muted);
	}
	section {
		display: grid;
		gap: var(--space-3);
	}
	h2 {
		margin: 0;
		font-size: var(--text-lg);
	}
	[role='alert']:empty {
		display: none;
	}
	:global(p) {
		margin: 0;
	}
</style>
