import { describe, expect, it } from 'vitest';
import { EXPORT_FORMAT, exportSites, parseImport } from './site-io';

const site = (host: string, includeSubdomains = false) => ({ host, includeSubdomains });

describe('exportSites', () => {
	it('writes a versioned, readable JSON document', () => {
		const json = exportSites(
			[site('a.com'), site('b.com', true)],
			new Date('2026-10-26T12:00:00Z')
		);
		expect(JSON.parse(json)).toEqual({
			format: EXPORT_FORMAT,
			version: 1,
			exportedAt: '2026-10-26T12:00:00.000Z',
			sites: [
				{ host: 'a.com', includeSubdomains: false },
				{ host: 'b.com', includeSubdomains: true }
			]
		});
		expect(json.endsWith('\n')).toBe(true);
	});
});

describe('parseImport', () => {
	it('round-trips an export', () => {
		const sites = [site('a.com'), site('b.com', true)];
		expect(parseImport(exportSites(sites))).toEqual({ ok: true, sites, skipped: [] });
	});

	it('normalizes hosts, merges duplicates and reports skipped entries', () => {
		const json = JSON.stringify({
			format: EXPORT_FORMAT,
			version: 1,
			sites: [
				{ host: 'A.com', includeSubdomains: false },
				{ host: 'a.com', includeSubdomains: true },
				{ host: 'bad host', includeSubdomains: false },
				{ host: 42 },
				'c.com'
			]
		});
		expect(parseImport(json)).toEqual({
			ok: true,
			sites: [site('a.com', true)],
			skipped: ['bad host', '42', '"c.com"']
		});
	});

	it('accepts a plain list of host names', () => {
		expect(parseImport('["a.com", "*.b.com"]')).toEqual({
			ok: true,
			sites: [site('a.com'), site('b.com', true)],
			skipped: []
		});
	});

	it.each([
		['', 'The file is not valid JSON.'],
		['{', 'The file is not valid JSON.'],
		['{"format":"other","version":1,"sites":[]}', 'This is not an Ignore for Plausible export.'],
		[
			`{"format":"${EXPORT_FORMAT}","version":2,"sites":[]}`,
			'This export version is not supported.'
		],
		[`{"format":"${EXPORT_FORMAT}","version":1}`, 'The export has no site list.'],
		['"a.com"', 'This is not an Ignore for Plausible export.']
	])('rejects %j', (json, error) => {
		expect(parseImport(json)).toEqual({ ok: false, error });
	});

	it('rejects oversized files', () => {
		expect(parseImport(' '.repeat(1_000_001))).toEqual({
			ok: false,
			error: 'The file is larger than 1 MB.'
		});
	});
});
