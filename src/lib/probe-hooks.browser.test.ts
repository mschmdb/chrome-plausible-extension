import { describe, expect, it, vi } from 'vitest';
import type { CapturedEvent } from './events';
import { installProbe } from './probe-hooks';

function fakeWindow() {
	const fetchMock = vi.fn(
		async () => new Response('ok', { status: 202, headers: { 'x-plausible-dropped': '1' } })
	);
	const warn = vi.fn();
	const beacon = vi.fn(() => true);
	const win = {
		fetch: fetchMock as unknown as typeof fetch,
		XMLHttpRequest,
		navigator: { sendBeacon: beacon } as unknown as Navigator,
		console: { warn } as unknown as Console,
		location: { href: 'https://site.test/page' } as Location
	};
	const events: CapturedEvent[] = [];
	installProbe(win, (e) => events.push(e));
	return { win, events, fetchMock, warn, beacon };
}

const body = JSON.stringify({
	n: 'Signup',
	u: 'https://site.test/page',
	d: 'site.test',
	p: { a: 1 }
});

describe('installProbe', () => {
	it('reports Plausible fetch requests and passes the response through', async () => {
		const { win, events, fetchMock } = fakeWindow();
		const response = await win.fetch('/api/event', { method: 'POST', body });
		expect(response.status).toBe(202);
		expect(fetchMock).toHaveBeenCalledWith('/api/event', { method: 'POST', body });
		await vi.waitFor(() => expect(events).toHaveLength(1));
		expect(events[0]).toMatchObject({
			name: 'Signup',
			endpoint: 'https://site.test/api/event',
			transport: 'fetch',
			outcome: 'sent',
			httpStatus: 202,
			dropped: true,
			props: { a: 1 }
		});
	});

	it('ignores unrelated fetch requests', async () => {
		const { win, events } = fakeWindow();
		await win.fetch('/other', { method: 'POST', body: '{"a":1}' });
		await win.fetch('/other');
		expect(events).toHaveLength(0);
	});

	it('reports failed requests and still rejects for the page', async () => {
		const { win, events, fetchMock } = fakeWindow();
		fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
		await expect(win.fetch('/api/event', { method: 'POST', body })).rejects.toThrow(
			'Failed to fetch'
		);
		await vi.waitFor(() =>
			expect(events[0]).toMatchObject({ outcome: 'failed', reason: 'Failed to fetch' })
		);
	});

	it('reports beacons', () => {
		const { win, events, beacon } = fakeWindow();
		expect(win.navigator.sendBeacon('https://p.test/api/event', body)).toBe(true);
		expect(beacon).toHaveBeenCalled();
		expect(events[0]).toMatchObject({ transport: 'beacon', endpoint: 'https://p.test/api/event' });
	});

	it('reports ignored events from the tracker warning and still logs it', () => {
		const { win, events, warn } = fakeWindow();
		win.console.warn('Ignoring Event: localStorage flag');
		win.console.warn('something else');
		expect(warn).toHaveBeenCalledTimes(2);
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			outcome: 'ignored',
			reason: 'localStorage flag',
			name: null
		});
	});
});

describe('installProbe with XMLHttpRequest', () => {
	it('reports each send once, also when the request object is reused', async () => {
		const events: CapturedEvent[] = [];
		const win = {
			fetch,
			XMLHttpRequest: class extends XMLHttpRequest {},
			navigator: {} as Navigator,
			console: { warn: () => undefined } as unknown as Console,
			location: { href: `${location.origin}/page` } as Location
		};
		installProbe(win, (e) => events.push(e));

		const xhr = new win.XMLHttpRequest();
		const send = (name: string) =>
			new Promise<void>((done) => {
				xhr.addEventListener('loadend', () => done(), { once: true });
				xhr.open('POST', '/__probe_test_missing__');
				xhr.send(JSON.stringify({ n: name, u: 'https://a.test/' }));
			});

		await send('first');
		await send('second');
		await vi.waitFor(() => expect(events.map((e) => e.name)).toEqual(['first', 'second']));
		// The page reopens the XHR in its own loadend handler, so the status may already be reset.
		expect(events[0]?.transport).toBe('xhr');
	});
});
