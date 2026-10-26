// Renders Chrome Web Store screenshots (1280×800) and the small promo tile (440×280).
// Uses the e2e build, which has host access to *.test, and the e2e fixture site.
// Run: node scripts/build.mjs --e2e && node scripts/store-assets.mjs
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const extensionPath = resolve(root, 'dist-e2e');
const outDir = resolve(root, 'docs/store/assets');
const HOST = 'myblog.test';

const tokens = await readFile(resolve(root, 'src/ui/styles/tokens.css'), 'utf8');
const icon = await readFile(resolve(root, 'assets/icon.svg'), 'utf8');

const tracker = (await readFile(resolve(root, 'e2e/fixtures/plausible.js'), 'utf8')).replace(
	"window.plausible.v = 'e2e'",
	'window.plausible.v = 33'
);
const page = (
	/** @type {string} */ host
) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${host}</title>
<script defer data-domain="${host}" src="https://plausible.io/js/script.js"></script></head>
<body><h1>${host}</h1></body></html>`;

const context = await chromium.launchPersistentContext('', {
	channel: 'chromium',
	deviceScaleFactor: 2,
	args: [
		`--disable-extensions-except=${extensionPath}`,
		`--load-extension=${extensionPath}`,
		'--host-resolver-rules=MAP *.test 127.0.0.1'
	]
});

// Serve the demo site and tracker locally, so nothing reaches the real Plausible.
await context.route('https://plausible.io/js/script.js', (route) =>
	route.fulfill({ contentType: 'text/javascript', body: tracker })
);
await context.route('https://*.test/api/event', (route) =>
	route.fulfill({ status: 202, body: 'ok' })
);
await context.route(/^https:\/\/[^/]+\.test\/(?!api\/)/, (route) =>
	route.fulfill({ contentType: 'text/html', body: page(new URL(route.request().url()).hostname) })
);

try {
	const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
	const id = new URL(worker.url()).host;
	const options = await context.newPage();
	await options.goto(`chrome-extension://${id}/options/index.html`);
	const send = (/** @type {unknown} */ request) =>
		options.evaluate((r) => chrome.runtime.sendMessage(r), request);
	await send({ type: 'enable-site', site: { host: HOST, includeSubdomains: false } });
	await send({ type: 'enable-site', site: { host: 'docs.example.test', includeSubdomains: true } });
	await send({ type: 'set-event-log', enabled: true });

	const site = await context.newPage();
	await site.goto(`https://${HOST}/pricing`);
	await site.evaluate(() => {
		const { plausible } = /** @type {{ plausible: (name: string, options: object) => void }} */ (
			/** @type {unknown} */ (window)
		);
		plausible('Signup', { props: { plan: 'pro', seats: 3 } });
		plausible('Outbound Link: Click', { props: { url: 'https://github.com' } });
	});
	const tabId = await worker.evaluate(
		async (url) => (await chrome.tabs.query({ url }))[0]?.id,
		site.url()
	);

	/** @param {boolean} devtoolsOpen */
	async function popupShot(devtoolsOpen) {
		const popup = await context.newPage();
		await popup.setViewportSize({ width: 352, height: 1200 });
		await popup.addInitScript(
			([tab, open]) => {
				localStorage.setItem('devtools-open', String(open));
				const query = chrome.tabs.query.bind(chrome.tabs);
				chrome.tabs.query = /** @type {typeof chrome.tabs.query} */ (
					async (/** @type {chrome.tabs.QueryInfo} */ q) =>
						q.active ? /** @type {chrome.tabs.Tab[]} */ ([{ id: tab }]) : query(q)
				);
			},
			[tabId, devtoolsOpen]
		);
		await popup.goto(`chrome-extension://${id}/popup/index.html`);
		await popup.waitForTimeout(1200);
		if (devtoolsOpen) {
			// Focus the shot on detection and the event log.
			await popup.addStyleTag({
				content:
					'[aria-live="polite"],.controls,section[aria-labelledby="flag-title"],section[aria-labelledby="test-title"]{display:none!important}'
			});
			await popup.getByText('Signup', { exact: true }).click();
			await popup.waitForTimeout(200);
		}
		const main = popup.locator('main');
		const image = await main.screenshot();
		await popup.close();
		return image.toString('base64');
	}

	await options.reload();
	await options.setViewportSize({ width: 760, height: 1000 });
	await options.waitForTimeout(800);
	const optionsImage = (await options.screenshot()).toString('base64');

	const scenes = [
		{
			file: 'screenshot-1-status.png',
			title: 'Stop counting your own visits',
			text: 'Turn a site on and Uncounted sets Plausible’s opt-out flag before the script loads. Even the first pageview is skipped.',
			image: await popupShot(false),
			width: 352
		},
		{
			file: 'screenshot-2-devtools.png',
			title: 'See what Plausible sends or skips',
			text: 'Detection, installation checks, flag inspector, test mode and an event log with payload warnings.',
			image: await popupShot(true),
			width: 352
		},
		{
			file: 'screenshot-3-settings.png',
			title: 'Per site or everywhere',
			text: 'Manage ignored sites, include subdomains, turn on global mode, export and import your list.',
			image: optionsImage,
			width: 560
		}
	];

	// Store images must have exact pixel sizes, so the canvas renders at scale 1.
	const plain = await chromium.launch();
	const canvas = await plain.newPage({
		viewport: { width: 1280, height: 800 },
		deviceScaleFactor: 1
	});
	for (const scene of scenes) {
		await canvas.setContent(`<!doctype html><html><head><style>${tokens}
			body{margin:0;width:1280px;height:800px;display:flex;align-items:center;gap:64px;padding:0 80px;box-sizing:border-box;background:var(--bg);color:var(--ink);font-family:system-ui,sans-serif}
			.copy{flex:1} .brand{display:flex;align-items:center;gap:12px;font-weight:600;font-size:22px;margin-bottom:40px}
			.brand svg{width:44px;height:44px} h1{font-size:46px;line-height:1.1;margin:0 0 20px} p{font-size:22px;line-height:1.45;color:var(--ink-muted);margin:0}
			.shot{max-height:720px;overflow:hidden;border:1px solid var(--rule-strong);border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.18)}
			.shot img{display:block;width:${scene.width}px}
			</style></head><body>
			<div class="copy"><div class="brand">${icon}Uncounted</div><h1>${scene.title}</h1><p>${scene.text}</p></div>
			<div class="shot"><img src="data:image/png;base64,${scene.image}"></div>
			</body></html>`);
		await canvas.waitForTimeout(300);
		await canvas.screenshot({ path: resolve(outDir, scene.file) });
	}

	await canvas.setViewportSize({ width: 440, height: 280 });
	await canvas.setContent(`<!doctype html><html><head><style>${tokens}
		body{margin:0;width:440px;height:280px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:var(--bg);color:var(--ink);font-family:system-ui,sans-serif}
		svg{width:96px;height:96px} h1{margin:0;font-size:36px} p{margin:0;font-size:16px;color:var(--ink-muted)}
		</style></head><body>${icon}<h1>Uncounted</h1><p>Exclude your own visits from Plausible Analytics</p></body></html>`);
	await canvas.screenshot({ path: resolve(outDir, 'promo-small-440x280.png') });
	await plain.close();

	process.stdout.write(`Wrote store assets to ${outDir}\n`);
} finally {
	await context.close();
}
