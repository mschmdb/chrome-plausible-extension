<script lang="ts">
	import { isIpAddress } from '../../lib/host';
	import { hasManualFlag } from '../../lib/manual-flag';
	import type { TabStatus } from '../../lib/tab-status';
	import { requestAndRun, send } from '../client';
	import Notice from '../components/Notice.svelte';
	import Switch from '../components/Switch.svelte';

	interface Props {
		tab: TabStatus & { host: string };
		busy: boolean;
		run: (task: () => Promise<unknown>) => void;
	}

	let { tab, busy, run }: Props = $props();

	const globalActive = $derived(tab.global && tab.globalGranted);
	const site = $derived(tab.site);

	const description = $derived.by(() => {
		if (globalActive) return 'Global mode is on and covers every site. Change it in the settings.';
		if (site && site.host !== tab.host)
			return `Covered by the entry for ${site.host} and its subdomains.`;
		return 'Sets the plausible_ignore flag before Plausible loads.';
	});

	function toggleSite(enabled: boolean) {
		if (enabled) {
			run(() =>
				requestAndRun({ type: 'enable-site', site: { host: tab.host, includeSubdomains: false } })
			);
		} else if (site) {
			run(() => send({ type: 'disable-site', host: site.host }));
		}
	}

	function toggleSubdomains(event: Event & { currentTarget: HTMLInputElement }) {
		if (!site) return;
		const enabled = event.currentTarget.checked;
		run(() =>
			enabled
				? requestAndRun({ type: 'set-subdomains', host: site.host, enabled: true })
				: send({ type: 'set-subdomains', host: site.host, enabled: false })
		);
	}

	const manualFlag = $derived(hasManualFlag(tab));

	function grantAccess() {
		if (site) run(() => requestAndRun({ type: 'enable-site', site }));
	}
</script>

<section class="controls" aria-label="Site settings">
	<Switch
		label="Ignore my visits on this site"
		{description}
		checked={globalActive || site !== null}
		disabled={busy || globalActive}
		{busy}
		onchange={toggleSite}
	/>

	{#if site && !globalActive}
		<label class="checkbox">
			<input
				type="checkbox"
				checked={site.includeSubdomains}
				disabled={busy || isIpAddress(site.host)}
				onchange={toggleSubdomains}
			/>
			<span>Include subdomains of <code>{site.host}</code></span>
		</label>
	{/if}

	{#if site && !tab.siteGranted && !globalActive}
		<Notice tone="warning">
			<p>The extension has no access to this site on this device, so the flag is not set.</p>
			<button type="button" class="button" disabled={busy} onclick={grantAccess}>
				Grant access
			</button>
		</Notice>
	{/if}

	{#if manualFlag}
		<Notice>
			<p>
				The flag on this site was set by hand, for example with the console command from the
				Plausible docs. The extension does not manage it.
			</p>
			<div class="actions">
				<button type="button" class="button" disabled={busy} onclick={() => toggleSite(true)}>
					Manage with this extension
				</button>
				<button
					type="button"
					class="button"
					disabled={busy}
					onclick={() => run(() => send({ type: 'clear-flag', tabId: tab.tabId }))}
				>
					Remove flag
				</button>
			</div>
		</Notice>
	{/if}

	{#if !site && tab.pendingCleanup}
		<Notice>
			<p>The flag will be removed the next time you open this site.</p>
		</Notice>
	{/if}

	{#if tab.testMode}
		<Notice tone="warning">
			<p>Test mode is on. Plausible counts your visits on this site until you stop it.</p>
		</Notice>
	{/if}
</section>

<style>
	.controls {
		display: grid;
		gap: var(--space-3);
	}

	.checkbox {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		font-size: var(--text-sm);
	}

	.checkbox input {
		width: 1rem;
		height: 1rem;
		margin: 0;
		accent-color: var(--accent);
	}

	p {
		margin: 0;
	}

	.button {
		margin-top: var(--space-2);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>
