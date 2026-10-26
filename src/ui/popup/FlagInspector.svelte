<script lang="ts">
	import type { FlagState } from '../../lib/status';
	import Notice from '../components/Notice.svelte';

	interface Props {
		flag: FlagState | null;
		shouldIgnore: boolean;
	}

	let { flag, shouldIgnore }: Props = $props();

	const value = $derived(flag && 'value' in flag ? flag.value : null);
	const blocked = $derived(flag !== null && 'blocked' in flag);
	const mismatch = $derived(!blocked && flag !== null && (value === 'true') !== shouldIgnore);
</script>

<section aria-labelledby="flag-title">
	<h3 id="flag-title">Ignore flag</h3>
	<dl>
		<dt>Current value</dt>
		<dd>
			{#if flag === null}
				Unknown
			{:else if blocked}
				localStorage blocked
			{:else if value === null}
				Not set
			{:else}
				<code>{JSON.stringify(value)}</code>
			{/if}
		</dd>
		<dt>Expected</dt>
		<dd>
			{#if shouldIgnore}<code>"true"</code>{:else}Not set{/if}
		</dd>
	</dl>
	{#if blocked}
		<Notice tone="error">
			<p>The browser blocks localStorage here. Plausible cannot read the flag either.</p>
		</Notice>
	{:else if mismatch}
		<Notice tone="warning">
			<p>
				{#if value === 'true'}
					The flag is set, but this extension does not manage this site. Someone set it by hand or
					with another tool.
				{:else if value !== null}
					The flag has the wrong value. Plausible only accepts the exact string "true". Reload the
					page to fix it.
				{:else}
					The flag is missing. Reload the page to set it.
				{/if}
			</p>
		</Notice>
	{/if}
</section>

<style>
	section {
		display: grid;
		gap: var(--space-2);
	}
	h3 {
		margin: 0;
		font-size: var(--text-sm);
	}
	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-1) var(--space-3);
		margin: 0;
		font-size: var(--text-sm);
	}
	dt {
		color: var(--ink-muted);
	}
	dd {
		margin: 0;
	}
</style>
