<script lang="ts">
	import { onMount } from 'svelte';
	import { ALL_SITES_PATTERN, isPatternGranted } from '../../lib/registration';
	import type { Settings } from '../../lib/settings';
	import { send } from '../client';
	import Notice from '../components/Notice.svelte';
	import GlobalMode from './GlobalMode.svelte';
	import SiteList from './SiteList.svelte';

	let settings = $state<Settings | null>(null);
	let granted = $state<string[]>([]);
	let busy = $state(false);
	let error = $state<string | null>(null);

	async function load() {
		const [loaded, permissions] = await Promise.all([
			send<Settings>({ type: 'get-settings' }),
			chrome.permissions.getAll()
		]);
		settings = loaded;
		granted = permissions.origins ?? [];
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
		chrome.permissions.onAdded.addListener(reload);
		chrome.permissions.onRemoved.addListener(reload);
		return () => {
			chrome.storage.sync.onChanged.removeListener(reload);
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
	{:else if !error}
		<p role="status">Loading settings…</p>
	{/if}
</main>

<style>
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
	[role='alert']:empty {
		display: none;
	}
	:global(p) {
		margin: 0;
	}
</style>
