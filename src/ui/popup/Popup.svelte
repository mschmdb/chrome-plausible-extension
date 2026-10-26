<script lang="ts">
	import { onMount } from 'svelte';
	import { Settings } from '@lucide/svelte';
	import type { TabStatus } from '../../lib/tab-status';
	import { activeTabId, send } from '../client';
	import Notice from '../components/Notice.svelte';
	import DevTools from './DevTools.svelte';
	import SiteControls from './SiteControls.svelte';
	import StatusCard from './StatusCard.svelte';

	let tab = $state<TabStatus | null>(null);
	let loadError = $state<string | null>(null);
	let actionError = $state<string | null>(null);
	let busy = $state(false);

	async function load() {
		try {
			const tabId = await activeTabId();
			if (tabId === null) throw new Error('No active tab found.');
			tab = await send<TabStatus>({ type: 'get-tab-status', tabId });
			loadError = null;
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Could not read this tab.';
		}
	}

	/** Starts the task synchronously, so permission prompts keep the click's user gesture. */
	function run(task: () => Promise<unknown>) {
		busy = true;
		actionError = null;
		task()
			.catch((error: unknown) => {
				actionError = error instanceof Error ? error.message : 'Something went wrong.';
			})
			.finally(async () => {
				await load();
				busy = false;
			});
	}

	onMount(() => {
		void load();
		let timer: ReturnType<typeof setTimeout> | undefined;
		const onChange = () => {
			clearTimeout(timer);
			timer = setTimeout(() => void load(), 150);
		};
		chrome.storage.onChanged.addListener(onChange);
		return () => {
			clearTimeout(timer);
			chrome.storage.onChanged.removeListener(onChange);
		};
	});
</script>

<main>
	<header>
		<h1>Ignore for Plausible</h1>
		<button
			type="button"
			class="icon-button"
			aria-label="Open settings"
			onclick={() => chrome.runtime.openOptionsPage()}
		>
			<Settings size={18} aria-hidden="true" />
		</button>
	</header>

	{#if tab}
		<div aria-live="polite">
			<StatusCard status={tab.status} host={tab.host} />
		</div>

		{#if tab.host}
			{@const current = { ...tab, host: tab.host }}
			<SiteControls tab={current} {busy} {run} />
			<DevTools tab={current} {busy} {run} />
		{/if}
	{:else if !loadError}
		<p class="loading" role="status">Reading this tab…</p>
	{/if}

	<div role="alert">
		{#if loadError || actionError}
			<Notice tone="error"><p>{loadError ?? actionError}</p></Notice>
		{/if}
	</div>
</main>

<style>
	main {
		display: grid;
		gap: var(--space-4);
		width: 22rem;
		padding: var(--space-4);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--rule);
	}

	h1 {
		margin: 0;
		font-size: var(--text-sm);
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--ink-muted);
	}

	.icon-button {
		display: inline-grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--ink-muted);
		cursor: pointer;
	}

	.icon-button:hover {
		border-color: var(--rule);
		color: var(--ink);
	}

	.loading {
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
