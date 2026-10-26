import { afterEach, describe, expect, it, vi } from 'vitest';
import { safeSend } from './safe-send';

function stubChrome(runtime: unknown) {
	vi.stubGlobal('chrome', { runtime });
}

afterEach(() => vi.unstubAllGlobals());

describe('safeSend', () => {
	it('sends and reports success', () => {
		const sendMessage = vi.fn(() => Promise.resolve());
		stubChrome({ id: 'ext', sendMessage });
		expect(safeSend({ type: 'flag-set' })).toBe(true);
		expect(sendMessage).toHaveBeenCalledWith({ type: 'flag-set' });
	});

	it('returns false when the extension was reloaded or removed', () => {
		stubChrome({ id: undefined, sendMessage: vi.fn() });
		expect(safeSend({ type: 'flag-set' })).toBe(false);
	});

	it('returns false instead of throwing on an invalidated context', () => {
		stubChrome({
			id: 'ext',
			sendMessage: () => {
				throw new Error('Extension context invalidated.');
			}
		});
		expect(safeSend({ type: 'flag-set' })).toBe(false);
	});

	it('swallows rejected sends', async () => {
		stubChrome({ id: 'ext', sendMessage: () => Promise.reject(new Error('No receiver')) });
		expect(safeSend({ type: 'flag-set' })).toBe(true);
		await Promise.resolve();
	});
});
