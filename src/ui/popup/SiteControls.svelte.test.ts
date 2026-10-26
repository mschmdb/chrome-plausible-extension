import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import type { TabStatus } from '../../lib/tab-status';
import { expectNoAxeViolations } from '../components/axe-helper';
import SiteControls from './SiteControls.svelte';

const tab = (overrides: Partial<TabStatus> = {}): TabStatus & { host: string } => ({
	tabId: 1,
	host: 'navigator.test',
	site: null,
	siteGranted: false,
	global: false,
	globalGranted: false,
	shouldIgnore: false,
	testMode: false,
	pendingCleanup: false,
	status: 'ignored',
	flag: { value: 'true' },
	detection: null,
	eventLog: false,
	events: [],
	...overrides
});

describe('SiteControls', () => {
	it('offers to migrate a flag set by hand', async () => {
		const { container } = await render(SiteControls, {
			props: { tab: tab(), busy: false, run: () => {} }
		});
		await expect.element(page.getByText('Flag found:')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Migrate to extension' })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Delete flag' })).toBeVisible();
		await expectNoAxeViolations(container);
	});

	it('shows no migration once the extension manages the site', async () => {
		await render(SiteControls, {
			props: {
				tab: tab({
					site: { host: 'navigator.test', includeSubdomains: false },
					siteGranted: true,
					shouldIgnore: true
				}),
				busy: false,
				run: () => {}
			}
		});
		await expect.element(page.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
		await expect.element(page.getByText('Flag found:')).not.toBeInTheDocument();
	});
});
