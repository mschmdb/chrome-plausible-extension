<script lang="ts">
	import { classifyEvent, validatePayload, type CapturedEvent } from '../../lib/events';
	import { KIND_LABEL, WARNING_TEXT } from '../text';

	interface Props {
		events: CapturedEvent[];
	}

	let { events }: Props = $props();

	const time = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' });

	function outcomeText(event: CapturedEvent): string {
		if (event.outcome === 'ignored') return `Ignored: ${event.reason ?? 'unknown reason'}`;
		if (event.outcome === 'failed') return `Failed: ${event.reason ?? 'unknown error'}`;
		if (event.dropped) return 'Dropped by the server';
		if (event.httpStatus === 202) return 'Accepted (202), not necessarily counted';
		return event.httpStatus ? `Sent (${event.httpStatus})` : 'Sent';
	}

	const pathOf = (url: string) => {
		try {
			const parsed = new URL(url);
			return `${parsed.pathname}${parsed.search}${parsed.hash}`;
		} catch {
			return url;
		}
	};
</script>

{#if events.length === 0}
	<p class="muted">No events yet. Reload the page or trigger an event.</p>
{:else}
	<ol class="log" aria-label="Plausible events, newest first">
		{#each events as event, index (`${event.time}-${index}`)}
			{@const warnings = event.outcome === 'ignored' ? [] : validatePayload(event)}
			<li class={event.outcome}>
				<div class="head">
					<span class="kind">
						{event.outcome === 'ignored' && !event.name
							? 'Skipped event'
							: KIND_LABEL[classifyEvent(event.name)]}
					</span>
					{#if event.name && classifyEvent(event.name) === 'custom'}
						<code>{event.name}</code>
					{/if}
					{#if event.revenue}
						<span class="tag">Revenue</span>
					{/if}
					{#if !event.interactive}
						<span class="tag">Non-interactive</span>
					{/if}
					<time datetime={new Date(event.time).toISOString()}>{time.format(event.time)}</time>
				</div>
				<p class="outcome">{outcomeText(event)}</p>
				{#if event.outcome !== 'ignored'}
					<p class="url"><code>{pathOf(event.url)}</code></p>
				{/if}
				{#if event.props && Object.keys(event.props).length > 0}
					<details>
						<summary>Properties ({Object.keys(event.props).length})</summary>
						<pre>{JSON.stringify(event.props, null, 2)}</pre>
					</details>
				{/if}
				{#if event.revenue}
					<details>
						<summary>Revenue</summary>
						<pre>{JSON.stringify(event.revenue, null, 2)}</pre>
					</details>
				{/if}
				{#if warnings.length > 0}
					<ul class="warnings" aria-label="Payload warnings">
						{#each warnings as warning (warning)}
							<li>{WARNING_TEXT[warning]}</li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</ol>
{/if}

<style>
	.muted {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--text-sm);
	}
	.log {
		display: grid;
		gap: var(--space-2);
		max-height: 16rem;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		list-style: none;
		font-size: var(--text-sm);
	}
	.log > li {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-2);
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
	.head {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: baseline;
	}
	.kind {
		font-weight: 600;
	}
	.tag {
		padding: 0 var(--space-1);
		border: 1px solid var(--rule-strong);
		border-radius: var(--radius-xs);
		font-size: var(--text-xs);
	}
	time {
		margin-left: auto;
		color: var(--ink-muted);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
	}
	p {
		margin: 0;
	}
	.outcome {
		color: var(--ink-muted);
	}
	.url code {
		overflow-wrap: anywhere;
	}
	pre {
		margin: var(--space-1) 0 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.warnings {
		margin: 0;
		padding-left: var(--space-4);
		color: var(--warning);
	}
</style>
