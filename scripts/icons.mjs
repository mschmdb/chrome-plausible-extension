// Renders assets/icon.svg to the PNG sizes Chrome needs, using headless Chromium.
// The PNGs are committed, so the build does not depend on this script.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const svg = await readFile(resolve(root, 'assets/icon.svg'), 'utf8');
const browser = await chromium.launch();

try {
	for (const size of [16, 32, 48, 128]) {
		const page = await browser.newPage({ viewport: { width: size, height: size } });
		const sized = svg.replace('width="128" height="128"', `width="${size}" height="${size}"`);
		await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${sized}`);
		const target = resolve(root, `static/icons/icon-${size}.png`);
		await page.screenshot({ path: target, omitBackground: true });
		await page.close();
		console.log(`Wrote ${target}`);
	}
} finally {
	await browser.close();
}
