import type { DetectionStatus } from './detect';

export type PageStatus =
	| 'ignored'
	| 'counted'
	| 'tracker-blocked'
	| 'not-detected'
	| 'storage-blocked'
	| 'unsupported'
	| 'unknown';

export type FlagState = { value: string | null } | { blocked: true };

export interface StatusInput {
	host: string | null;
	flag: FlagState | null;
	detection: DetectionStatus | null;
}

/** Hex mirrors of the light-mode tokens. The badge API does not take OKLCH. */
export const BADGE_COLORS = {
	success: '#0E6549',
	warning: '#9E5520',
	error: '#A12626'
} as const;

export function pageStatus({ host, flag, detection }: StatusInput): PageStatus {
	if (!host) return 'unsupported';
	if (!flag) return 'unknown';
	if ('blocked' in flag) return 'storage-blocked';
	// The tracker compares against the exact string "true".
	if (flag.value === 'true') return 'ignored';
	if (detection === 'detected') return 'counted';
	if (detection === 'blocked') return 'tracker-blocked';
	return 'not-detected';
}

export interface Badge {
	text: string;
	color: string | null;
	title: string;
}

const NAME = 'Uncounted';

export function badgeFor(status: PageStatus): Badge {
	switch (status) {
		case 'ignored':
			return { text: '✓', color: BADGE_COLORS.success, title: `${NAME}: your visits are ignored` };
		case 'counted':
			return {
				text: '!',
				color: BADGE_COLORS.warning,
				title: `${NAME}: Plausible counts your visits`
			};
		case 'storage-blocked':
			return {
				text: '×',
				color: BADGE_COLORS.error,
				title: `${NAME}: localStorage is blocked, the flag cannot be set`
			};
		case 'tracker-blocked':
			return { text: '', color: null, title: `${NAME}: the Plausible script did not run` };
		case 'not-detected':
			return { text: '', color: null, title: `${NAME}: no Plausible script found` };
		case 'unsupported':
			return { text: '', color: null, title: `${NAME}: not available on this page` };
		case 'unknown':
			return { text: '', color: null, title: NAME };
	}
}
