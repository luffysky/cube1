import { api, subscribeMember } from './games/spinrealm/member-client.mjs';
import { initLocalization } from './games/spinrealm/i18n.mjs';
import { initMemberUI } from './games/spinrealm/member-ui.mjs';
initLocalization();
initMemberUI({mount:document.querySelector('.site-header')});

const adminEntry = document.getElementById('gamesAdminEntry');
if (adminEntry) {
  let userId, pending;
  function hideEntry() {
    pending?.abort();
    pending = null;
    adminEntry.hidden = true;
    adminEntry.removeAttribute('href');
  }
  async function checkEntry() {
    hideEntry();
    if (!userId) return;
    const request = new AbortController();
    pending = request;
    try {
      const result = await api('/v1/admin/entry', { signal: request.signal });
      if (pending !== request || !/^\/srg-console-[A-Za-z0-9_-]{24,80}\/$/.test(result?.path ?? '')) return;
      adminEntry.href = new URL(result.path, 'https://games.snowrealm.pet').href;
      adminEntry.hidden = false;
    } catch {
      // Keep the entry hidden when authorization cannot be confirmed.
    }
  }
  subscribeMember(({ user }) => {
    const nextUserId = user?.id ?? null;
    if (userId === nextUserId) return;
    userId = nextUserId;
    void checkEntry();
  });
  window.addEventListener('focus', () => void checkEntry());
  window.addEventListener('pagehide', hideEntry);
  window.addEventListener('pageshow', event => {
    if (event.persisted) void checkEntry();
  });
}
