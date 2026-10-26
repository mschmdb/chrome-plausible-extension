<script lang="ts">
	import type { Detection } from '../../lib/detect';
	import { DIAGNOSTIC_TEXT, VARIANT_LABEL } from '../text';

	interface Props {
		detection: Detection | null;
	}

	let { detection }: Props = $props();
</script>

<section aria-labelledby="detection-title">
	<h3 id="detection-title">Plausible on this page</h3>
	{#if !detection}
		<p class="muted">The page could not be inspected.</p>
	{:else if detection.status === 'none'}
		<p class="muted">No Plausible script found.</p>
	{:else}
		<dl>
			<dt>Status</dt>
			<dd>{detection.status === 'detected' ? 'Loaded' : 'Found, but not running'}</dd>
			{#if detection.variant}
				<dt>Variant</dt>
				<dd>{VARIANT_LABEL[detection.variant]}</dd>
			{/if}
			{#if detection.version}
				<dt>Version</dt>
				<dd><code>{detection.version}</code></dd>
			{/if}
			{#if detection.scriptSrc}
				<dt>Script</dt>
				<dd><code>{detection.scriptSrc}</code></dd>
			{/if}
			{#if detection.domain}
				<dt>Domain</dt>
				<dd><code>{detection.domain}</code></dd>
			{/if}
			{#if detection.endpoint}
				<dt>Endpoint</dt>
				<dd><code>{detection.endpoint}</code></dd>
			{/if}
			{#if detection.taggedEvents.length > 0}
				<dt>Tagged events</dt>
				<dd>{detection.taggedEvents.join(', ')}</dd>
			{/if}
		</dl>
	{/if}

	{#if detection && detection.diagnostics.length > 0}
		<h3 id="diagnostics-title">Checks</h3>
		<ul aria-labelledby="diagnostics-title">
			{#each detection.diagnostics as diagnostic (diagnostic.id)}
				<li class={diagnostic.severity}>
					<span class="visually-hidden">{diagnostic.severity}:</span>
					{DIAGNOSTIC_TEXT[diagnostic.id]}
					{#if diagnostic.detail}
						<code class="detail">{diagnostic.detail}</code>
					{/if}
				</li>
			{/each}
		</ul>
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
	.muted {
		margin: 0;
		color: var(--ink-muted);
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
		overflow-wrap: anywhere;
	}
	ul {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--text-sm);
	}
	li {
		padding-left: var(--space-3);
		border-left: 3px solid var(--rule-strong);
	}
	li.warning {
		border-left-color: var(--warning);
	}
	.detail {
		display: block;
		margin-top: var(--space-1);
		color: var(--ink-muted);
		overflow-wrap: anywhere;
	}
</style>
