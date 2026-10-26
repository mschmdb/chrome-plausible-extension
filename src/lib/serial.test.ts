import { describe, expect, it } from 'vitest';
import { createSerialQueue } from './serial';

const tick = () => new Promise((resolve) => setTimeout(resolve, 1));

describe('createSerialQueue', () => {
	it('runs tasks one after another in call order', async () => {
		const run = createSerialQueue();
		const order: string[] = [];
		const a = run(async () => {
			order.push('a:start');
			await tick();
			order.push('a:end');
			return 'a';
		});
		const b = run(async () => {
			order.push('b');
			return 'b';
		});
		expect(await Promise.all([a, b])).toEqual(['a', 'b']);
		expect(order).toEqual(['a:start', 'a:end', 'b']);
	});

	it('keeps running after a task fails', async () => {
		const run = createSerialQueue();
		const failed = run(async () => {
			throw new Error('boom');
		});
		const next = run(async () => 'ok');
		await expect(failed).rejects.toThrow('boom');
		await expect(next).resolves.toBe('ok');
	});
});
