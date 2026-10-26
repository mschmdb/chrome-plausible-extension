<script lang="ts">
	import type { Snippet } from 'svelte';
	import { CircleCheck, Info, TriangleAlert } from '@lucide/svelte';

	interface Props {
		tone?: 'info' | 'warning' | 'error' | 'success';
		children: Snippet;
	}

	let { tone = 'info', children }: Props = $props();

	const Icon = $derived(tone === 'success' ? CircleCheck : tone === 'info' ? Info : TriangleAlert);
</script>

<div class="notice {tone}">
	<Icon size={16} aria-hidden="true" />
	<div>{@render children()}</div>
</div>

<style>
	.notice {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--rule);
		border-left-width: 4px;
		border-radius: var(--radius-sm);
		background: var(--bg-elevated);
		font-size: var(--text-sm);
	}

	.notice :global(svg) {
		flex: none;
		margin-top: 0.2rem;
	}

	.info {
		border-left-color: var(--rule-strong);
	}
	.warning {
		border-left-color: var(--warning);
	}
	.warning :global(svg) {
		color: var(--warning);
	}
	.error {
		border-left-color: var(--error);
	}
	.error :global(svg) {
		color: var(--error);
	}
	.success {
		border-left-color: var(--success);
	}
	.success :global(svg) {
		color: var(--success);
	}
</style>
