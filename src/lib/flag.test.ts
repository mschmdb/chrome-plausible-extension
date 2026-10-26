import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearFlagInPage, readFlagInPage, setFlagInPage } from './flag';

class MemoryStorage {
	private data = new Map<string, string>();
	getItem(key: string) {
		return this.data.get(key) ?? null;
	}
	setItem(key: string, value: string) {
		this.data.set(key, value);
	}
	removeItem(key: string) {
		this.data.delete(key);
	}
}

const blockedStorage = {
	getItem() {
		throw new Error('SecurityError');
	},
	setItem() {
		throw new Error('SecurityError');
	},
	removeItem() {
		throw new Error('SecurityError');
	}
};

describe('flag helpers', () => {
	beforeEach(() => {
		Object.defineProperty(globalThis, 'localStorage', {
			value: new MemoryStorage(),
			configurable: true
		});
	});
	afterEach(() => {
		Reflect.deleteProperty(globalThis, 'localStorage');
	});

	it('sets, reads and clears the exact string "true"', () => {
		expect(readFlagInPage()).toEqual({ value: null });
		expect(setFlagInPage()).toEqual({ value: 'true' });
		expect(localStorage.getItem('plausible_ignore')).toBe('true');
		expect(clearFlagInPage()).toEqual({ value: null });
		expect(readFlagInPage()).toEqual({ value: null });
	});

	it('reports blocked storage instead of throwing', () => {
		Object.defineProperty(globalThis, 'localStorage', {
			value: blockedStorage,
			configurable: true
		});
		expect(readFlagInPage()).toEqual({ blocked: true });
		expect(setFlagInPage()).toEqual({ blocked: true });
		expect(clearFlagInPage()).toEqual({ blocked: true });
	});
});
