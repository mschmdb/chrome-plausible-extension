import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';

const fixtures = resolve(import.meta.dirname, 'fixtures');

export interface FixtureServer {
	port: number;
	events: { host: string; body: string }[];
	close: () => Promise<void>;
}

export async function startServer(): Promise<FixtureServer> {
	const events: FixtureServer['events'] = [];
	const server: Server = createServer((req, res) => {
		void (async () => {
			if (req.method === 'POST' && req.url === '/api/event') {
				let body = '';
				for await (const chunk of req) body += chunk;
				events.push({ host: req.headers.host ?? '', body });
				res.writeHead(202).end('ok');
				return;
			}
			const file = req.url === '/js/plausible.js' ? 'plausible.js' : 'index.html';
			const type = file.endsWith('.js') ? 'text/javascript' : 'text/html';
			res.writeHead(200, { 'Content-Type': type });
			res.end(await readFile(resolve(fixtures, file)));
		})();
	});
	await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('No port');
	return {
		port: address.port,
		events,
		close: () =>
			new Promise((done) => {
				server.closeAllConnections();
				server.close(() => done());
			})
	};
}
