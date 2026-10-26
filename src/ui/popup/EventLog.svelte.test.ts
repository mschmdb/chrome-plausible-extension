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

	it('labels events and explains the outcome', async () => {
		await render(EventLog, {
			props: {
				events: [
					event({
						name: 'Signup',
						props: { plan: 'pro' },
						revenue: { currency: 'EUR', amount: 5 }
					}),
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
		const list = page.getByRole('list', { name: 'Plausible events, newest first' });
		await expect.element(list).toBeVisible();
		await expect.element(page.getByText('Custom event')).toBeVisible();
		await expect.element(page.getByText('Signup')).toBeVisible();
		await expect.element(page.getByText('Ignored: localStorage flag')).toBeVisible();
		await expect.element(page.getByText('Dropped by the server')).toBeVisible();
		await expect.element(page.getByText('Failed: Failed to fetch')).toBeVisible();
		await expect.element(page.getByText('Properties (1)')).toBeVisible();
	});

	it('warns about payloads Plausible rejects', async () => {
		await render(EventLog, { props: { events: [event({ revenue: { amount: 5 } })] } });
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
