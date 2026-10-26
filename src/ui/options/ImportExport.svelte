<script lang="ts">
	import { Download, Upload } from '@lucide/svelte';
	import { matchPatterns, type Site } from '../../lib/host';
	import { MAX_IMPORT_BYTES, exportSites, parseImport } from '../../lib/site-io';
	import { send } from '../client';
	import Notice from '../components/Notice.svelte';

	interface Props {
		sites: Site[];
		busy: boolean;
		run: (task: () => Promise<unknown>) => void;
	}

	let { sites, busy, run }: Props = $props();

	let result = $state<{ added: number; skipped: string[]; needsAccess: string[] } | null>(null);
	let importError = $state<string | null>(null);
	let fileInput: HTMLInputElement | undefined = $state();

	function download() {
		const blob = new Blob([exportSites(sites)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `uncounted-sites-${new Date().toISOString().slice(0, 10)}.json`;
		link.click();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	}

	function importFile(event: Event & { currentTarget: HTMLInputElement }) {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (!file || busy) return;
		result = null;
		importError = null;
		if (file.size > MAX_IMPORT_BYTES) {
			importError = 'The file is larger than 1 MB.';
			return;
		}

		// Reading, parsing and saving share one busy phase, so imports never overlap.
		run(async () => {
			let text: string;
			try {
				text = await file.text();
			} catch {
				importError = 'The file could not be read.';
				return;
			}
			const parsed = parseImport(text);
			if (!parsed.ok) {
				importError = parsed.error;
				return;
			}
			const response = await send<{ added: number; needsAccess: string[] }>({
				type: 'import-sites',
				sites: parsed.sites
			});
			result = { ...response, skipped: parsed.skipped };
		});
	}

	function grantImported() {
		if (!result) return;
		const hosts = new Set(result.needsAccess);
		const origins = sites.filter((site) => hosts.has(site.host)).flatMap(matchPatterns);
		run(async () => {
			const granted = await chrome.permissions.request({ origins });
			if (granted && result) result = { ...result, needsAccess: [] };
		});
	}
</script>

<section aria-labelledby="io-title">
	<h2 id="io-title">Export and import</h2>
	<p class="hint">
		The file lists host names only. Access is granted per device, so you confirm it after an import.
	</p>
	<div class="row">
		<button type="button" class="button" disabled={busy || sites.length === 0} onclick={download}>
			<Download size={14} aria-hidden="true" />
			Export sites
		</button>
		<button type="button" class="button" disabled={busy} onclick={() => fileInput?.click()}>
			<Upload size={14} aria-hidden="true" />
			Import sites
		</button>
		<input
			bind:this={fileInput}
			class="visually-hidden"
			type="file"
			accept="application/json,.json"
			tabindex="-1"
			aria-hidden="true"
			onchange={importFile}
		/>
	</div>

	<div role="status">
		{#if importError}
			<Notice tone="error"><p>{importError}</p></Notice>
		{:else if result}
			<Notice tone={result.skipped.length > 0 ? 'warning' : 'success'}>
				<p>
					Imported {result.added}
					{result.added === 1 ? 'site' : 'sites'}.
					{#if result.skipped.length > 0}
						Skipped {result.skipped.length} invalid {result.skipped.length === 1
							? 'entry'
							: 'entries'}: {result.skipped.slice(0, 5).join(', ')}{result.skipped.length > 5
							? ' …'
							: ''}
					{/if}
				</p>
				{#if result.needsAccess.length > 0}
					<p>{result.needsAccess.length} sites still need access on this device.</p>
					<button type="button" class="button primary" disabled={busy} onclick={grantImported}>
						Grant access to {result.needsAccess.length} sites
					</button>
				{/if}
			</Notice>
		{/if}
	</div>
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
	.row {
		display: flex;
		gap: var(--space-2);
	}
	.button.primary {
		margin-top: var(--space-2);
	}
</style>
