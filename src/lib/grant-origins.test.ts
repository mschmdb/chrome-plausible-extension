import { describe, expect, it } from 'vitest';
import { requiredOrigins } from './grant-origins';

describe('requiredOrigins', () => {
	it('maps each action to its host permission', () => {
		expect(
			requiredOrigins({ type: 'enable-site', site: { host: 'a.com', includeSubdomains: true } })
		).toEqual(['*://a.com/*', '*://*.a.com/*']);
		expect(requiredOrigins({ type: 'set-subdomains', host: 'a.com', enabled: true })).toEqual([
			'*://*.a.com/*'
		]);
		expect(requiredOrigins({ type: 'set-global', enabled: true })).toEqual(['*://*/*']);
	});
});
