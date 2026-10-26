import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import { expectNoAxeViolations } from './axe-helper';
import Switch from './Switch.svelte';

describe('Switch', () => {
	it('exposes a labelled switch with its state', async () => {
		await render(Switch, { label: 'Ignore my visits', checked: true, onchange: () => {} });
		const control = page.getByRole('switch', { name: 'Ignore my visits' });
		await expect.element(control).toHaveAttribute('aria-checked', 'true');
	});

	it('calls onchange with the new value on click and keyboard', async () => {
		const onchange = vi.fn();
		await render(Switch, { label: 'Ignore', checked: false, onchange });
		const control = page.getByRole('switch', { name: 'Ignore' });
		await control.click();
		expect(onchange).toHaveBeenLastCalledWith(true);
		(control.element() as HTMLElement).focus();
		await userEventPress('Space');
		expect(onchange).toHaveBeenCalledTimes(2);
	});

	it('links the description and blocks changes when disabled', async () => {
		const onchange = vi.fn();
		await render(Switch, {
			label: 'Ignore',
			description: 'Global mode covers this site.',
			checked: true,
			disabled: true,
			onchange
		});
		const control = page.getByRole('switch', { name: 'Ignore' });
		await expect.element(control).toHaveAccessibleDescription('Global mode covers this site.');
		await expect.element(control).toBeDisabled();
	});

	it('has no axe violations', async () => {
		const { container } = await render(Switch, {
			label: 'Ignore',
			description: 'Details',
			checked: false,
			onchange: () => {}
		});
		await expectNoAxeViolations(container);
	});
});

async function userEventPress(key: string) {
	const { userEvent } = await import('vitest/browser');
	await userEvent.keyboard(`{${key}}`);
}
