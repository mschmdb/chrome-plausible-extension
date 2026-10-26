import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node, chrome: 'readonly' } },
		rules: {
			// typescript-eslint recommends turning no-undef off for TypeScript projects.
			'no-undef': 'off',
			'no-console': 'error'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	},
	{
		// Playwright fixtures need an empty destructuring pattern.
		files: ['e2e/**/*.ts'],
		rules: { 'no-empty-pattern': 'off' }
	},
	{
		// Stand-in for the third-party Plausible tracker, written like the original.
		ignores: ['e2e/fixtures/**']
	}
);
