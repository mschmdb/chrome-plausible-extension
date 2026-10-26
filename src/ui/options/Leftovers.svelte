<script lang="ts">
	import { send } from '../client';

	interface Props {
		origins: string[];
		busy: boolean;
		run: (task: () => Promise<unknown>) => void;
	}

	let { origins, busy, run }: Props = $props();

	function cleanUp() {
		const patterns = [...new Set(origins.map((origin) => `*://${new URL(origin).hostname}/*`))];
		run(() => chrome.permissions.request({ origins: patterns }));
	}
</script>

{#if origins.length > 0}
	<section aria-labelledby="leftovers-title">
		<h2 id="leftovers-title">Leftover flags</h2>
		<p class="hint">
			The extension set the flag on these sites but has no access to remove it anymore. Grant access
			and the flag is removed on your next visit. Access is dropped right after.
		</p>
		<ul>
			{#each origins as origin (origin)}
				<li><code>{origin}</code></li>
			{/each}
		</ul>
		<div class="row">
			<button type="button" class="button primary" disabled={busy} onclick={cleanUp}>
				Grant access to clean up
			</button>
			<button
				type="button"
				class="button"
				disabled={busy}
				onclick={() => run(() => send({ type: 'forget-leftovers' }))}
			>
				Forget this list
			</button>
		</div>
	</section>
{/if}

<style>
	section {
		display: grid;
		gap: var(--space-3);
	}
	h2 {
		margin: 0;
		font-size: var(--text-lg);
	}
	.hint {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--text-sm);
	}
	ul {
		margin: 0;
		padding-left: var(--space-4);
		font-size: var(--text-sm);
	}
	.row {
		display: flex;
		gap: var(--space-2);
	}
</style>
