<script lang="ts">
	import { Ban, CircleCheck, CircleQuestionMark, CircleSlash, TriangleAlert } from '@lucide/svelte';
	import type { PageStatus } from '../../lib/status';
	import { STATUS_TEXT } from '../text';

	interface Props {
		status: PageStatus;
		host: string | null;
	}

	let { status, host }: Props = $props();

	const ICONS = {
		ignored: CircleCheck,
		counted: TriangleAlert,
		'not-detected': CircleSlash,
		'storage-blocked': Ban,
		unsupported: CircleSlash,
		unknown: CircleQuestionMark
	} as const;

	const text = $derived(STATUS_TEXT[status]);
	const Icon = $derived(ICONS[status]);
</script>

<section class="status {status}" aria-labelledby="status-title">
	<Icon size={24} aria-hidden="true" />
	<div>
		{#if host}
			<p class="host"><code>{host}</code></p>
		{/if}
		<h2 id="status-title">{text.title}</h2>
		<p class="detail">{text.detail}</p>
	</div>
</section>

<style>
	.status {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
	}

	.status :global(svg) {
		flex: none;
		margin-top: 1.4rem;
		color: var(--ink-subtle);
	}

	.ignored :global(svg) {
		color: var(--success);
	}
	.counted :global(svg) {
		color: var(--warning);
	}
	.storage-blocked :global(svg) {
		color: var(--error);
	}

	.host {
		margin: 0;
		color: var(--ink-muted);
		overflow-wrap: anywhere;
	}

	h2 {
		margin: 0;
		font-size: var(--text-lg);
		line-height: 1.25;
	}

	.detail {
		margin: var(--space-1) 0 0;
		color: var(--ink-muted);
		font-size: var(--text-sm);
	}
</style>
