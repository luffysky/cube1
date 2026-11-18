// This module is injected by the read-only desktop server, not written into dist.
// It uses only public DOM / fetch APIs and the narrow read-only runtime bridge.
document.documentElement.dataset.runtime = 'desktop';

if (document.readyState === 'loading') {
  await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
}

if (/^\/games\/spinrealm\/(?:index\.html)?$/.test(location.pathname) && new URLSearchParams(location.search).get('mode') === 'practice') {
  document.querySelector('[data-mode="practice"]')?.click();
}

// Desktop resources are already local and updated together with the application.
// A stale PWA cache must not take precedence over the bundled version.
if ('serviceWorker' in navigator) {
  const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
  await Promise.allSettled(registrations.map(registration => registration.unregister()));
}

const runtime = await window.snowrealmDesktop?.getRuntimeInfo().catch(() => null);
if (runtime) window.dispatchEvent(new CustomEvent('snowrealm:desktop-ready', { detail: runtime }));
