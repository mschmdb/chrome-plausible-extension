import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import FlagInspector from './FlagInspector.svelte';

describe('FlagInspector', () => {
	it('shows the current and expected value', async () => {
		await render(FlagInspector, { flag: { value: 'true' }, shouldIgnore: true });
		await expect.element(page.getByText('"true"').first()).toBeVisible();
		await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
	});

	it('explains a wrong value', async () => {
		await render(FlagInspector, { flag: { value: '1' }, shouldIgnore: true });
		await expect
			.element(page.getByText('only accepts the exact string', { exact: false }))
			.toBeVisible();
	});

	it('explains a flag set outside the extension', async () => {
		await render(FlagInspector, { flag: { value: 'true' }, shouldIgnore: false });
		await expect
			.element(page.getByText('does not manage this site', { exact: false }))
			.toBeVisible();
	});

	it('reports blocked storage', async () => {
		await render(FlagInspector, { flag: { blocked: true }, shouldIgnore: true });
		await expect.element(page.getByText('localStorage blocked')).toBeVisible();
	});
});
