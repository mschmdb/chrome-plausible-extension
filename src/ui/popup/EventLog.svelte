<script lang="ts">
	import { TriangleAlert } from '@lucide/svelte';
	import { classifyEvent, validatePayload, type CapturedEvent } from '../../lib/events';
	import { decodedUrl, outcomeChip, outcomeText, shortPath } from '../event-display';
	import { KIND_LABEL, WARNING_TEXT } from '../text';

	interface Props {
		events: CapturedEvent[];
	}

	let { events }: Props = $props();

	const SHOW_ENGAGEMENT_KEY = 'event-log-show-engagement';
	let showEngagement = $state(localStorage.getItem(SHOW_ENGAGEMENT_KEY) === 'true');

	const visible = $derived(
		showEngagement ? events : events.filter((event) => classifyEvent(event.name) !== 'engagement')
	);
	const hidden = $derived(events.length - visible.length);

	const time = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' });

	function title(event: CapturedEvent): string {
		if (event.outcome === 'ignored' && !event.name) return 'Pageview or automatic event';
		const kind = classifyEvent(event.name);
		return kind === 'custom' && event.name ? event.name : KIND_LABEL[kind];
	}

	function toggleEngagement(event: Event & { currentTarget: HTMLInputElement }) {
		showEngagement = event.currentTarget.checked;
		localStorage.setItem(SHOW_ENGAGEMENT_KEY, String(showEngagement));
	}
</script>

<label class="filter">
	<input type="checkbox" checked={showEngagement} onchange={toggleEngagement} />
	Show engagement events{#if hidden > 0}&nbsp;({hidden} hidden){/if}
</label>

{#if visible.length === 0}
	<p class="muted">No events yet. Trigger an event on the page.</p>
{:else}
	<ol class="log" aria-label="Plausible events, newest first">
		{#each visible as event, index (`${event.time}-${index}`)}
			{@const warnings = event.outcome === 'ignored' ? [] : validatePayload(event)}
			<li class={event.outcome}>
				<details>
					<summary>
						<span class="row">
							<span class="name">{title(event)}</span>
							<span class="chip">{outcomeChip(event)}</span>
							{#if warnings.length > 0}
								<TriangleAlert size={14} class="warn-icon" aria-label="Has warnings" />
							{/if}
							<time datetime={new Date(event.time).toISOString()}>{time.format(event.time)}</time>
						</span>
						{#if event.outcome !== 'ignored'}
							<span class="path">{shortPath(event.url)}</span>
						{/if}
					</summary>
					<dl>
						{#if event.name}
							<dt>Type</dt>
							<dd>{KIND_LABEL[classifyEvent(event.name)]}</dd>
						{/if}
						<dt>Result</dt>
						<dd>{outcomeText(event)}</dd>
						{#if event.outcome !== 'ignored'}
							<dt>URL</dt>
							<dd><code>{decodedUrl(event.url)}</code></dd>
						{/if}
						{#if event.endpoint}
							<dt>Endpoint</dt>
							<dd><code>{event.endpoint}</code></dd>
						{/if}
						{#if !event.interactive}
							<dt>Interactive</dt>
							<dd>No (does not affect bounce rate)</dd>
						{/if}
						{#if event.props && Object.keys(event.props).length > 0}
							<dt>Properties</dt>
							<dd><pre>{JSON.stringify(event.props, null, 2)}</pre></dd>
						{/if}
						{#if event.revenue}
							<dt>Revenue</dt>
							<dd><pre>{JSON.stringify(event.revenue, null, 2)}</pre></dd>
						{/if}
					</dl>
					{#if warnings.length > 0}
						<ul class="warnings" aria-label="Payload warnings">
							{#each warnings as warning (warning)}
								<li>{WARNING_TEXT[warning]}</li>
							{/each}
						</ul>
					{/if}
				</details>
			</li>
		{/each}
	</ol>
{/if}

<style>
	.filter {
		display: flex;
		min-height: 1.5rem;
		padding-block: var(--space-1);
		gap: var(--space-2);
		align-items: center;
		color: var(--ink-muted);
		font-size: var(--text-sm);
	}
	.filter input {
		width: 1rem;
		height: 1rem;
		margin: 0;
		accent-color: var(--accent);
	}
	.muted {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--text-sm);
	}
	.log {
		display: grid;
		gap: var(--space-1);
		max-height: 18rem;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		list-style: none;
		font-size: var(--text-sm);
	}
	.log > li {
		border: 1px solid var(--rule);
		border-left: 3px solid var(--success);
		border-radius: var(--radius-sm);
		background: var(--bg-elevated);
	}
	.log > li.ignored {
		border-left-color: var(--rule-strong);
	}
	.log > li.failed {
		border-left-color: var(--error);
	}
	summary {
		display: grid;
		gap: 0.125rem;
		padding: var(--space-1) var(--space-2);
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.row {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		min-width: 0;
	}
	.name {
		overflow: hidden;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chip {
		flex: none;
		padding: 0 var(--space-1);
		border: 1px solid var(--rule-strong);
		border-radius: var(--radius-xs);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}
	.row :global(.warn-icon) {
		flex: none;
		color: var(--warning);
	}
	time {
		flex: none;
		margin-left: auto;
		color: var(--ink-muted);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}
	.path {
		overflow: hidden;
		color: var(--ink-muted);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-1) var(--space-2);
		margin: 0;
		padding: var(--space-2);
		border-top: 1px solid var(--rule);
	}
	dt {
		color: var(--ink-muted);
	}
	dd {
		margin: 0;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	pre {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.warnings {
		margin: 0;
		padding: 0 var(--space-2) var(--space-2) var(--space-6);
		color: var(--warning);
	}
</style>
