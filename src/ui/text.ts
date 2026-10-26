import type { DiagnosticId, Variant } from '../lib/detect';
import type { EventKind, PayloadWarning } from '../lib/events';
import type { PageStatus } from '../lib/status';

export const STATUS_TEXT: Record<PageStatus, { title: string; detail: string }> = {
	ignored: {
		title: 'Your visits are ignored',
		detail: 'Plausible skips every event from this browser on this site.'
	},
	counted: {
		title: 'Plausible counts your visits',
		detail: 'This site runs Plausible and the ignore flag is not set.'
	},
	'tracker-blocked': {
		title: 'Plausible did not run',
		detail:
			'The script is on the page but did not load. An ad blocker or a Content Security Policy may block it. Your visit is not counted right now.'
	},
	'not-detected': {
		title: 'No Plausible script found',
		detail: 'This page does not load Plausible, or it loads it later.'
	},
	'storage-blocked': {
		title: 'localStorage is blocked',
		detail: 'The browser blocks storage for this site, so the flag cannot be set.'
	},
	unsupported: {
		title: 'Not available here',
		detail: 'Chrome does not let extensions run on this page.'
	},
	unknown: {
		title: 'Status unknown',
		detail: 'The extension cannot read this page. Reload it and try again.'
	}
};

export const DIAGNOSTIC_TEXT: Record<DiagnosticId, string> = {
	'not-loaded':
		'A Plausible script is on the page but did not run. An ad blocker or a Content Security Policy may block it.',
	'multiple-scripts': 'The page loads more than one Plausible script. Events may count twice.',
	'not-in-head': 'Plausible recommends placing the script in the <head>.',
	localhost:
		'Plausible ignores localhost and file pages unless captureOnLocalhost (or the local script extension) is set.',
	csp: "A Content Security Policy meta tag does not allow the script's origin.",
	'tagged-malformed':
		'Some tagged-event classes are malformed. Use plausible-event-name=Name+With+Spaces.'
};

export const WARNING_TEXT: Record<PayloadWarning, string> = {
	'url-too-long': 'URL is longer than 2,000 characters.',
	'too-many-props': 'More than 30 custom properties.',
	'prop-key-too-long': 'A property name is longer than 300 characters.',
	'prop-value-too-long': 'A property value is longer than 2,000 characters.',
	'prop-value-not-scalar': 'A property value is not a string, number or boolean.',
	'revenue-invalid': 'Revenue needs a 3-letter currency code and a numeric amount.'
};

export const KIND_LABEL: Record<EventKind, string> = {
	pageview: 'Pageview',
	engagement: 'Engagement',
	outbound: 'Outbound link',
	'file-download': 'File download',
	'not-found': '404',
	custom: 'Custom event',
	unknown: 'Event'
};

export const VARIANT_LABEL: Record<Variant, string> = {
	legacy: 'Legacy script (data-domain)',
	web: 'Site-specific snippet (pa-*.js)',
	npm: 'npm package',
	unknown: 'Unknown variant'
};
