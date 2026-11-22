const upstreamCookie = '__Secure-neon-auth.session_token';
const browserCookie = '__Host-snowrealm-stage-session';
const sessionToken = /^[A-Za-z0-9._~%+=/-]{16,1024}$/;

export function createStagingLogin({base, issuer, accounts, fetchImpl = fetch}) {
  const allowed = new Set(accounts);
  const authFetch = (path, options) => fetchImpl(base + path, {
    ...options, redirect: 'error', signal: AbortSignal.timeout(8000),
  });
  return {
    async authenticate(request) {
      const token = request.headers.get('cookie')?.split(/;\s*/).find(
        value => value.startsWith(browserCookie + '='))?.slice(browserCookie.length + 1);
      if (!token || !sessionToken.test(token)) return null;
      const response = await authFetch('/get-session', {
        headers: {cookie: `${upstreamCookie}=${token}`, 'X-Force-Fetch': 'true'},
      });
      if (!response.ok) throw new Error('staging_session_unavailable');
      const result = await response.json();
      return allowed.has(result?.user?.id) && result?.session?.userId === result.user.id ? result.user.id : null;
    },

    async signIn(email, password) {
      if (typeof email !== 'string' || typeof password !== 'string' ||
          email.length > 254 || !password.length || password.length > 128) return null;
      const response = await authFetch('/sign-in/email', {
        method: 'POST', headers: {Origin: issuer, 'Content-Type': 'application/json'},
        body: JSON.stringify({email, password}),
      });
      if (response.status >= 500) throw new Error('staging_session_unavailable');
      if (!response.ok || !allowed.has((await response.json())?.user?.id)) return null;
      const token = response.headers.getSetCookie().map(value => value.split(';')[0]).find(
        value => value.startsWith(upstreamCookie + '='))?.slice(upstreamCookie.length + 1);
      if (!token || !sessionToken.test(token)) throw new Error('staging_session_cookie_unavailable');
      return `${browserCookie}=${token}; Path=/; Max-Age=900; Secure; HttpOnly; SameSite=Lax`;
    },
  };
}
