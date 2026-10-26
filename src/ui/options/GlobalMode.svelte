<script lang="ts">
	import { requestAndRun, send } from '../client';
	import Notice from '../components/Notice.svelte';
	import Switch from '../components/Switch.svelte';

	interface Props {
		enabled: boolean;
		granted: boolean;
		busy: boolean;
		run: (task: () => Promise<unknown>) => void;
	}

	let { enabled, granted, busy, run }: Props = $props();

	function toggle(next: boolean) {
		run(() =>
			next
				? requestAndRun({ type: 'set-global', enabled: true })
				: send({ type: 'set-global', enabled: false })
		);
	}
</script>

<section aria-labelledby="global-title">
	<h2 id="global-title">Global mode</h2>
	<Switch
		label="Ignore my visits on every site"
		description="Needs access to all sites. The extension only sets the plausible_ignore flag and sends no data anywhere."
		checked={enabled}
		disabled={busy}
		{busy}
		onchange={toggle}
	/>
	{#if enabled && !granted}
		<Notice tone="warning">
			<p>
				Global mode is on, but this device has no access to all sites. Turn it off and on again.
			</p>
		</Notice>
	{/if}
	<p class="hint">
		Turning global mode off clears the flag in open tabs. Sites you visited earlier keep it until
		you clear their site data.
	</p>
</section>

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
</style>
