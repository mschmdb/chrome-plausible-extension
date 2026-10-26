<script lang="ts">
	import { Trash } from '@lucide/svelte';
	import { isIpAddress, matchPatterns, normalizeHost, type Site } from '../../lib/host';
	import { isPatternGranted } from '../../lib/registration';
	import { requestAndRun, send } from '../client';

	interface Props {
		sites: Site[];
		granted: string[];
		busy: boolean;
		run: (task: () => Promise<unknown>) => void;
	}

	let { sites, granted, busy, run }: Props = $props();

	let newHost = $state('');
	let inputError = $state<string | null>(null);

	const hasAccess = (site: Site) =>
		matchPatterns(site).every((pattern) => isPatternGranted(pattern, granted));

	const missing = $derived(sites.filter((site) => !hasAccess(site)));

	function grantMissing() {
		const origins = missing.flatMap(matchPatterns);
		run(() => chrome.permissions.request({ origins }));
	}

	function addSite(event: SubmitEvent) {
		event.preventDefault();
		const host = normalizeHost(newHost);
		if (!host) {
			inputError = 'Enter a host name like example.com.';
			return;
		}
		inputError = null;
		run(async () => {
			const added = await requestAndRun({
				type: 'enable-site',
				site: { host, includeSubdomains: false }
			});
			if (added) newHost = '';
		});
	}

	function toggleSubdomains(site: Site, enabled: boolean) {
		run(() =>
			enabled
				? requestAndRun({ type: 'set-subdomains', host: site.host, enabled: true })
				: send({ type: 'set-subdomains', host: site.host, enabled: false })
		);
	}
</script>

<section aria-labelledby="sites-title">
	<h2 id="sites-title">Sites</h2>

	<form onsubmit={addSite} novalidate>
		<label for="new-host">Add a site</label>
		<div class="row">
			<input
				id="new-host"
				type="text"
				inputmode="url"
				autocomplete="off"
				spellcheck="false"
				placeholder="example.com"
				bind:value={newHost}
				aria-invalid={inputError ? 'true' : undefined}
				aria-describedby={inputError ? 'new-host-error' : undefined}
			/>
			<button type="submit" class="button primary" disabled={busy}>Add</button>
		</div>
		{#if inputError}
			<p id="new-host-error" class="error">{inputError}</p>
		{/if}
	</form>

	{#if missing.length > 1}
		<div class="bulk">
			<p>{missing.length} sites have no access on this device, so their flag is not set.</p>
			<button type="button" class="button" disabled={busy} onclick={grantMissing}>
				Grant access to {missing.length} sites
			</button>
		</div>
	{/if}

	{#if sites.length === 0}
		<p class="empty">No sites yet. Add one here or use the toolbar button on a site.</p>
	{:else}
		<table>
			<caption class="visually-hidden">Sites where your visits are ignored</caption>
			<thead>
				<tr>
					<th scope="col">Host</th>
					<th scope="col">Subdomains</th>
					<th scope="col">Access on this device</th>
					<th scope="col"><span class="visually-hidden">Actions</span></th>
				</tr>
			</thead>
			<tbody>
				{#each sites as site (site.host)}
					<tr>
						<th scope="row"><code>{site.host}</code></th>
						<td>
							<input
								type="checkbox"
								aria-label="Include subdomains of {site.host}"
								checked={site.includeSubdomains}
								disabled={busy || isIpAddress(site.host)}
								onchange={(event) => toggleSubdomains(site, event.currentTarget.checked)}
							/>
						</td>
						<td>
							{#if hasAccess(site)}
								Granted
							{:else}
								<button
									type="button"
									class="button"
									disabled={busy}
									onclick={() => run(() => requestAndRun({ type: 'enable-site', site }))}
								>
									Grant access <span class="visually-hidden">to {site.host}</span>
								</button>
							{/if}
						</td>
						<td>
							<button
								type="button"
								class="button"
								disabled={busy}
								onclick={() => run(() => send({ type: 'disable-site', host: site.host }))}
							>
								<Trash size={14} aria-hidden="true" />
								Remove <span class="visually-hidden">{site.host}</span>
							</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
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
	form {
		display: grid;
		gap: var(--space-1);
	}
	label {
		font-weight: 600;
		font-size: var(--text-sm);
	}
	.row {
		display: flex;
		gap: var(--space-2);
	}
	input[type='text'] {
		flex: 1;
		min-height: 2rem;
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--radius-sm);
		background: var(--bg-elevated);
		color: var(--ink);
		font: inherit;
		font-family: var(--font-mono);
	}
	input[type='checkbox'] {
		width: 1rem;
		height: 1rem;
		accent-color: var(--accent);
	}
	.error {
		margin: 0;
		color: var(--error);
		font-size: var(--text-sm);
	}
	.bulk {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
		font-size: var(--text-sm);
	}
	.bulk p {
		margin: 0;
	}
	.empty {
		margin: 0;
		color: var(--ink-muted);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}
	th,
	td {
		padding: var(--space-2);
		border-bottom: 1px solid var(--rule);
		text-align: left;
		vertical-align: middle;
	}
	thead th {
		color: var(--ink-muted);
		font-weight: 600;
	}
	tbody th {
		font-weight: 400;
		overflow-wrap: anywhere;
	}
</style>
