import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { page } from 'vitest/browser';
import type { CapturedEvent } from '../../lib/events';
import { expectNoAxeViolations } from '../components/axe-helper';
import EventLog from './EventLog.svelte';

const event = (overrides: Partial<CapturedEvent> = {}): CapturedEvent => ({
	name: 'pageview',
	url: 'https://a.test/pricing?x=1',
	domain: 'a.test',
	referrer: null,
	props: null,
	revenue: null,
	interactive: true,
	endpoint: 'https://plausible.io/api/event',
	transport: 'fetch',
	outcome: 'sent',
	reason: null,
	httpStatus: 202,
	dropped: null,
	time: Date.UTC(2026, 9, 26, 12),
	...overrides
});

describe('EventLog', () => {
	it('shows an empty state', async () => {
		await render(EventLog, { props: { events: [] } });
		await expect.element(page.getByText('No events yet.', { exact: false })).toBeVisible();
	});

	it('shows one compact row per event with a status chip', async () => {
		await render(EventLog, {
			props: {
				events: [
					event({ name: 'Signup', props: { plan: 'pro' } }),
					event({
						name: null,
						outcome: 'ignored',
						reason: 'localStorage flag',
						transport: 'console'
					}),
					event({ dropped: true }),
					event({ outcome: 'failed', reason: 'Failed to fetch', httpStatus: null })
				]
			}
		});
		await expect.element(page.getByText('Signup')).toBeVisible();
		await expect.element(page.getByText('Skipped event')).toBeVisible();
		await expect.element(page.getByText('Dropped', { exact: true })).toBeVisible();
		await expect.element(page.getByText('Failed', { exact: true })).toBeVisible();
		await expect.element(page.getByText('/pricing').first()).toBeVisible();
		// Details stay collapsed until the row is opened.
		await expect.element(page.getByText('Accepted (202)', { exact: false })).not.toBeVisible();
		await page.getByText('Signup').click();
		await expect.element(page.getByText('Accepted (202)', { exact: false })).toBeVisible();
		await expect.element(page.getByText('"plan": "pro"', { exact: false })).toBeVisible();
	});

	it('hides engagement events until asked', async () => {
		localStorage.removeItem('event-log-show-engagement');
		await render(EventLog, {
			props: { events: [event({ name: 'engagement' }), event({ name: 'pageview' })] }
		});
		await expect.element(page.getByText('(1 hidden)', { exact: false })).toBeVisible();
		await expect.element(page.getByText('Engagement', { exact: true })).not.toBeInTheDocument();
		await page.getByRole('checkbox', { name: /Show engagement events/ }).click();
		await expect.element(page.getByText('Engagement', { exact: true }).first()).toBeVisible();
		localStorage.removeItem('event-log-show-engagement');
	});

	it('warns about payloads Plausible rejects', async () => {
		await render(EventLog, { props: { events: [event({ revenue: { amount: 5 } })] } });
		await expect.element(page.getByLabelText('Has warnings')).toBeVisible();
		await page.getByText('Pageview', { exact: true }).first().click();
		const warnings = page.getByRole('list', { name: 'Payload warnings' });
		await expect
			.element(warnings.getByText(/Revenue needs a 3-letter currency code/))
			.toBeVisible();
	});

	it('has no axe violations', async () => {
		const { container } = await render(EventLog, {
			props: { events: [event(), event({ name: 'Signup', props: { a: 1 } })] }
		});
		await expectNoAxeViolations(container);
	});
});
