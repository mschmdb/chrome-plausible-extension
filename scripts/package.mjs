// Zips dist/ for the Chrome Web Store. Run `pnpm build` first. Needs the `zip` command.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
if (!existsSync(resolve(dist, 'manifest.json'))) {
	throw new Error('dist/manifest.json is missing. Run `pnpm build` first.');
}

const { version } = JSON.parse(readFileSync(resolve(dist, 'manifest.json'), 'utf8'));
const outDir = resolve(root, 'release');
const target = resolve(outDir, `ignore-for-plausible-${version}.zip`);
mkdirSync(outDir, { recursive: true });
rmSync(target, { force: true });

execFileSync('zip', ['-r', '-X', '-q', target, '.'], { cwd: dist, stdio: 'inherit' });
process.stdout.write(`Wrote ${target}\n`);
