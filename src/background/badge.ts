import { hostFromUrl } from '../lib/host';
import { badgeFor, pageStatus, type PageStatus } from '../lib/status';
import { detect, readFlag } from './pages';

export async function inspectTab(tabId: number, url: string | undefined) {
	const host = url ? hostFromUrl(url) : null;
	if (!host) {
		return { host, flag: null, detection: null, status: 'unsupported' as PageStatus };
	}
	const [flag, detection] = await Promise.all([readFlag(tabId), detect(tabId)]);
	const status = pageStatus({ host, flag, detection: detection?.status ?? null });
	return { host, flag, detection, status };
}

export async function applyBadge(tabId: number, status: PageStatus): Promise<void> {
	const badge = badgeFor(status);
	try {
		await chrome.action.setBadgeText({ tabId, text: badge.text });
		await chrome.action.setTitle({ tabId, title: badge.title });
		if (badge.color) {
			await chrome.action.setBadgeBackgroundColor({ tabId, color: badge.color });
			await chrome.action.setBadgeTextColor({ tabId, color: '#FFFFFF' });
		}
	} catch {
		// The tab closed in the meantime.
	}
}

export async function refreshBadge(tabId: number): Promise<void> {
	try {
		const tab = await chrome.tabs.get(tabId);
		const { status } = await inspectTab(tabId, tab.url);
		await applyBadge(tabId, status);
	} catch {
		// The tab closed in the meantime.
	}
}

export async function refreshBadges(tabIds: readonly number[]): Promise<void> {
	await Promise.all(tabIds.map(refreshBadge));
}
