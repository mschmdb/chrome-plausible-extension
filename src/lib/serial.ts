/** Runs async tasks strictly one after another. Keeps read-modify-write on storage atomic. */
export function createSerialQueue() {
	let tail: Promise<unknown> = Promise.resolve();
	return function run<T>(task: () => Promise<T>): Promise<T> {
		const result = tail.then(task, task);
		tail = result.catch(() => undefined);
		return result;
	};
}
