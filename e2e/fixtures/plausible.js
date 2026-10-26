// Minimal stand-in for the Plausible tracker. Same flag check and wire format as
// tracker/src/track.js in plausible/analytics.
(function () {
	function track(name) {
		try {
			if (window.localStorage.plausible_ignore === 'true') {
				console.warn('Ignoring Event: localStorage flag');
				return;
			}
		} catch (_error) {
			// ignore
		}
		fetch('/api/event', {
			method: 'POST',
			headers: { 'Content-Type': 'text/plain' },
			keepalive: true,
			body: JSON.stringify({ n: name, u: location.href, d: location.hostname, r: null })
		});
	}
	window.plausible = track;
	window.plausible.l = true;
	window.plausible.v = 'e2e';
	track('pageview');
})();
