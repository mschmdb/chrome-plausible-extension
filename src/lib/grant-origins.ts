import { matchPatterns } from './host';
import type { GrantAction } from './messages';
import { ALL_SITES_PATTERN } from './registration';

/** Host permissions an action needs before it can run. */
export function requiredOrigins(action: GrantAction): string[] {
	switch (action.type) {
		case 'enable-site':
			return matchPatterns(action.site);
		case 'set-subdomains':
			return [`*://*.${action.host}/*`];
		case 'set-global':
			return [ALL_SITES_PATTERN];
	}
}
