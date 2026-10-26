<script lang="ts">
	import { FlaskConical, Trash } from '@lucide/svelte';
	import type { TabStatus } from '../../lib/tab-status';
	import { send } from '../client';
	import DetectionDetails from './DetectionDetails.svelte';
	import EventLog from './EventLog.svelte';
	import FlagInspector from './FlagInspector.svelte';

	interface Props {
		tab: TabStatus & { host: string };
		busy: boolean;
		run: (task: () => Promise<unknown>) => void;
	}

	let { tab, busy, run }: Props = $props();

	const OPEN_KEY = 'devtools-open';
	let open = $state(localStorage.getItem(OPEN_KEY) === 'true');

	function toggle(event: Event & { currentTarget: HTMLDetailsElement }) {
		open = event.currentTarget.open;
		localStorage.setItem(OPEN_KEY, String(open));
	}
</script>

<details {open} ontoggle={toggle}>
	<summary>Developer tools</summary>
	<div class="panel">
		<DetectionDetails detection={tab.detection} />
		<FlagInspector flag={tab.flag} shouldIgnore={tab.shouldIgnore} />

		{#if tab.testMode || tab.shouldIgnore}
			<section aria-labelledby="test-title">
				<h3 id="test-title">Test mode</h3>
				<p class="muted">
					Lifts the flag on {tab.host} so you can check goals and events. Other tabs of this site are
					counted too. Closing this tab ends test mode.
				</p>
				<button
					type="button"
					class="button"
					disabled={busy}
					onclick={() =>
						run(() =>
							tab.testMode
								? send({ type: 'test-stop', host: tab.host })
								: send({ type: 'test-start', tabId: tab.tabId })
						)}
				>
					<FlaskConical size={14} aria-hidden="true" />
					{tab.testMode ? 'Stop test mode' : 'Start test mode'}
				</button>
			</section>
		{/if}

		<section aria-labelledby="log-title">
			<div class="log-head">
				<h3 id="log-title">Event log</h3>
				{#if tab.eventLog && tab.events.length > 0}
					<button
						type="button"
						class="button"
						disabled={busy}
						onclick={() => run(() => send({ type: 'clear-events', tabId: tab.tabId }))}
					>
						<Trash size={14} aria-hidden="true" />
						Clear
					</button>
				{/if}
			</div>
			{#if tab.eventLog && !tab.shouldIgnore && !tab.testMode}
				<p class="muted">The event log runs only on sites you enabled.</p>
			{:else if tab.eventLog}
				<EventLog events={tab.events} />
			{:else}
				<p class="muted">
					The event log shows what Plausible sends or skips on sites you enabled. It watches network
					requests in the page, so it is off by default.
				</p>
				<button
					type="button"
					class="button"
					disabled={busy}
					onclick={() => run(() => send({ type: 'set-event-log', enabled: true }))}
				>
					Turn on event log
				</button>
			{/if}
		</section>
	</div>
</details>

<style>
	details {
		border-top: 1px solid var(--rule);
		padding-top: var(--space-3);
	}
	summary {
		font-weight: 600;
		cursor: pointer;
	}
	.panel {
		display: grid;
		gap: var(--space-4);
		margin-top: var(--space-3);
	}
	section {
		display: grid;
		gap: var(--space-2);
		justify-items: start;
	}
	h3 {
		margin: 0;
		font-size: var(--text-sm);
	}
	.muted {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--text-sm);
	}
	.log-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		justify-self: stretch;
	}
	section :global(.log),
	section :global(.muted) {
		justify-self: stretch;
	}
</style>
