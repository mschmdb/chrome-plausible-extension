// Builds the extension into dist/.
// Pages and the service worker share ES chunks. Content scripts must be single classic
// scripts, so each one gets its own IIFE build.
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { build } from 'vite';

const root = resolve(import.meta.dirname, '..');
const outDir = resolve(root, 'dist');
const contentScripts = ['ignore', 'cleanup', 'probe', 'relay'];

await rm(outDir, { recursive: true, force: true });

await build({
	configFile: false,
	root: resolve(root, 'src/ui'),
	base: '/',
	plugins: [svelte({ configFile: resolve(root, 'svelte.config.js') })],
	build: {
		outDir,
		emptyOutDir: false,
		modulePreload: false,
		rollupOptions: {
			input: {
				popup: resolve(root, 'src/ui/popup/index.html'),
				options: resolve(root, 'src/ui/options/index.html'),
				background: resolve(root, 'src/background/index.ts')
			},
			output: {
				entryFileNames: (chunk) =>
					chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'
			}
		}
	}
});

for (const name of contentScripts) {
	await build({
		configFile: false,
		build: {
			outDir: resolve(outDir, 'content'),
			emptyOutDir: false,
			lib: {
				entry: resolve(root, `src/content/${name}.ts`),
				formats: ['iife'],
				name: `ifp_${name}`,
				fileName: () => `${name}.js`
			}
		}
	});
}

const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(await readFile(resolve(root, 'src/manifest.json'), 'utf8'));
manifest.version = pkg.version;
await writeFile(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, '\t') + '\n');
await cp(resolve(root, 'static'), outDir, { recursive: true });
