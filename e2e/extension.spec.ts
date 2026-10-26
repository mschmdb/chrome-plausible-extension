import { resolve } from 'node:path';
import {
	chromium,
	expect,
	test as base,
	type BrowserContext,
	type Page,
	type Worker
} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { startServer, type FixtureServer } from './server';

const extensionPath = resolve(import.meta.dirname, '../dist-e2e');

const test = base.extend<
	{ site: (host?: string) => Promise<Page>; options: Page },
	{ server: FixtureServer; extContext: BrowserContext; sw: Worker; extensionId: string }
>({
	server: [
		async ({}, use) => {
			const server = await startServer();
			await use(server);
			await server.close();
		},
		{ scope: 'worker' }
	],
	extContext: [
		async ({}, use) => {
			const context = await chromium.launchPersistentContext('', {
				channel: 'chromium',
				args: [
					`--disable-extensions-except=${extensionPath}`,
					`--load-extension=${extensionPath}`,
					'--host-resolver-rules=MAP *.test 127.0.0.1'
				]
			});
			await use(context);
			await context.close();
		},
		{ scope: 'worker' }
	],
	sw: [
		async ({ extContext }, use) => {
			const worker =
				extContext.serviceWorkers()[0] ?? (await extContext.waitForEvent('serviceworker'));
			await use(worker);
		},
		{ scope: 'worker' }
	],
	extensionId: [async ({ sw }, use) => use(new URL(sw.url()).host), { scope: 'worker' }],
	site: async ({ extContext, server }, use) => {
		const pages: Page[] = [];
		await use(async (host = 'site.test') => {
			const page = await extContext.newPage();
			pages.push(page);
			await page.goto(`http://${host}:${server.port}/`);
			return page;
		});
		for (const page of pages) await page.close();
	},
	options: async ({ extContext, extensionId }, use) => {
		const page = await extContext.newPage();
		await page.goto(`chrome-extension://${extensionId}/options/index.html`);
		await use(page);
		await page.close();
	}
});

async function send(options: Page, request: unknown) {
	const response = await options.evaluate((req) => chrome.runtime.sendMessage(req), request);
	expect(response).toMatchObject({ ok: true });
	return (response as { data: unknown }).data;
}

const flagOf = (page: Page) => page.evaluate(() => localStorage.getItem('plausible_ignore'));

async function eventCount(server: FixtureServer, host: string, settle = 300) {
	await new Promise((done) => setTimeout(done, settle));
	return server.events.filter((event) => event.host.startsWith(host)).length;
}

test.describe.configure({ mode: 'serial' });

test('counts visits while the site is not enabled', async ({ site, server }) => {
	const page = await site();
	await expect.poll(() => eventCount(server, 'site.test', 0)).toBe(1);
	expect(await flagOf(page)).toBeNull();
});

test('ignores the first pageview after enabling a site', async ({ site, server, options }) => {
	await send(options, {
		type: 'enable-site',
		site: { host: 'site.test', includeSubdomains: false }
	});
	const before = await eventCount(server, 'site.test');

	const page = await site();
	expect(await flagOf(page)).toBe('true');
	await page.reload();
	expect(await eventCount(server, 'site.test')).toBe(before);
});

test('lists the site with access in the options page', async ({ options }) => {
	await options.reload();
	await expect(options.getByRole('row', { name: /site\.test/ })).toContainText('Granted');
	const results = await new AxeBuilder({ page: options })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
		.analyze();
	expect(results.violations.map((v) => v.id)).toEqual([]);
});

test('leaves subdomains alone until enabled', async ({ site, server, options }) => {
	const before = await eventCount(server, 'www.site.test', 0);
	const page = await site('www.site.test');
	expect(await flagOf(page)).toBeNull();
	await expect.poll(() => eventCount(server, 'www.site.test', 0)).toBe(before + 1);

	await send(options, { type: 'set-subdomains', host: 'site.test', enabled: true });
	expect(await flagOf(page)).toBe('true');
});

test('records ignored events in the event log', async ({ site, options, sw }) => {
	await send(options, { type: 'set-event-log', enabled: true });
	const page = await site();
	const tabId = await sw.evaluate(async (url) => {
		const [tab] = await chrome.tabs.query({ url });
		return tab?.id;
	}, page.url());

	await expect
		.poll(async () => {
			const status = (await send(options, { type: 'get-tab-status', tabId })) as {
				events: { outcome: string; reason: string }[];
			};
			return status.events[0];
		})
		.toMatchObject({ outcome: 'ignored', reason: 'localStorage flag' });
});

test('test mode lifts the flag until it stops', async ({ site, server, options, sw }) => {
	const page = await site();
	const tabId = await sw.evaluate(async (url) => {
		const [tab] = await chrome.tabs.query({ url });
		return tab?.id;
	}, page.url());

	await send(options, { type: 'test-start', tabId });
	expect(await flagOf(page)).toBeNull();
	const before = await eventCount(server, 'site.test');
	await page.reload();
	await expect.poll(() => eventCount(server, 'site.test', 0)).toBe(before + 1);

	await send(options, { type: 'test-stop', host: 'site.test' });
	expect(await flagOf(page)).toBe('true');
});

test('removing a site clears the flag in open tabs', async ({ site, server, options }) => {
	const page = await site();
	await send(options, { type: 'disable-site', host: 'site.test' });
	expect(await flagOf(page)).toBeNull();
	const before = await eventCount(server, 'site.test');
	await page.reload();
	await expect.poll(() => eventCount(server, 'site.test', 0)).toBe(before + 1);
});

test('clears the flag on the next visit when no tab was open', async ({
	site,
	server,
	options
}) => {
	await send(options, {
		type: 'enable-site',
		site: { host: 'later.test', includeSubdomains: false }
	});
	const first = await site('later.test');
	expect(await flagOf(first)).toBe('true');
	await first.close();

	await send(options, { type: 'disable-site', host: 'later.test' });
	const again = await site('later.test');
	await expect.poll(() => flagOf(again)).toBeNull();
	// Cleanup checks ownership asynchronously, so this first visit may still be ignored.
	const afterCleanup = await eventCount(server, 'later.test');
	await again.reload();
	await expect.poll(() => eventCount(server, 'later.test', 0)).toBe(afterCleanup + 1);
});

test('leaves a flag alone that the extension did not set', async ({ site, options }) => {
	const page = await site('manual.test');
	await page.evaluate(() => localStorage.setItem('plausible_ignore', 'true'));
	await send(options, {
		type: 'enable-site',
		site: { host: 'manual.test', includeSubdomains: false }
	});
	await send(options, { type: 'disable-site', host: 'manual.test' });
	expect(await flagOf(page)).toBe('true');
});
