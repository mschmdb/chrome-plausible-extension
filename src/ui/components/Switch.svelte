<script lang="ts">
	interface Props {
		label: string;
		checked: boolean;
		description?: string;
		disabled?: boolean;
		busy?: boolean;
		onchange: (checked: boolean) => void;
	}

	let { label, checked, description, disabled = false, busy = false, onchange }: Props = $props();

	const id = $props.id();
</script>

<div class="switch-row">
	<div class="text">
		<span class="label" id="{id}-label">{label}</span>
		{#if description}
			<span class="description" id="{id}-description">{description}</span>
		{/if}
	</div>
	<button
		type="button"
		role="switch"
		class="switch"
		aria-checked={checked}
		aria-labelledby="{id}-label"
		aria-describedby={description ? `${id}-description` : undefined}
		aria-busy={busy || undefined}
		{disabled}
		onclick={() => onchange(!checked)}
	>
		<span class="thumb" aria-hidden="true"></span>
	</button>
</div>

<style>
	.switch-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-4);
	}

	.text {
		display: grid;
		gap: var(--space-1);
	}

	.label {
		font-weight: 600;
	}

	.description {
		color: var(--ink-muted);
		font-size: var(--text-sm);
	}

	.switch {
		flex: none;
		position: relative;
		width: 2.75rem;
		height: 1.5rem;
		margin-top: 0.125rem;
		padding: 0;
		border: 2px solid var(--rule-strong);
		border-radius: 999px;
		background: var(--bg-elevated);
		cursor: pointer;
		transition: background-color 150ms ease;
	}

	.switch[aria-checked='true'] {
		border-color: var(--accent);
		background: var(--accent);
	}

	.thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		background: var(--rule-strong);
		transition: transform 150ms ease;
	}

	.switch[aria-checked='true'] .thumb {
		background: var(--bg);
		transform: translateX(1.25rem);
	}

	.switch:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	@media (forced-colors: active) {
		.switch,
		.thumb {
			border: 1px solid ButtonText;
		}
		.switch[aria-checked='true'] .thumb {
			background: Highlight;
		}
	}
</style>
