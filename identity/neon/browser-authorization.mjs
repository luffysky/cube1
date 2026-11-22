import {createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import {normalizeClients} from '../oauth-core.mjs';

const path = '/oauth/authorize';
const cookie = '__Host-snowrealm-consent';
const lifetime = 300;
const fields = {
  client_id: 'clientId', redirect_uri: 'redirectUri', code_challenge: 'codeChallenge',
  state: 'state', nonce: 'nonce',
};
const headers = {
  'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

function html(status, title, content = '', extra = {}) {
  return new Response(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>${title}</title><main><h1>${title}</h1>${content}</main></html>`, {
    status, headers: {...headers, 'Content-Type': 'text/html; charset=utf-8', ...extra},
  });
}

export function createBrowserAuthorization({issuer, clients, authorize, authenticate, signIn, loginUrl, secret}) {
  const allowed = normalizeClients(clients);
  const login = loginUrl ? new URL(loginUrl) : null;
  if ((!signIn && !login) || (login && (login.protocol !== 'https:' || login.username || login.password || login.hash)) ||
      typeof secret !== 'string' || Buffer.byteLength(secret) < 32)
    throw new Error('browser_authorization_config_invalid');
  const mac = value => createHmac('sha256', secret).update('snowrealm-consent-v1:').update(value).digest();
  const setCookie = (value, maxAge) => `${cookie}=${value}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`;
  const invalid = () => html(400, '授權請求無效');
  const loginPage = (url, failed = false) => {
    const action = (path + url.search).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return html(failed ? 401 : 200, '登入 SnowRealm Games 測試站',
      `<p>請使用 staging 測試帳號。</p>${failed ? '<p>登入失敗。</p>' : ''}
      <form method="post" action="${action}">
      <label>電子郵件 <input name="email" type="email" autocomplete="username" required></label>
      <label>密碼 <input name="password" type="password" autocomplete="current-password" required></label>
      <button type="submit">登入</button></form>`);
  };
  return async request => {
    const url = new URL(request.url);
    if (url.origin !== issuer) return invalid();
    if (request.method === 'GET') {
      if (url.search.length > 2048 || new Set(url.searchParams.keys()).size !== url.searchParams.size ||
          url.searchParams.get('response_type') !== 'code' ||
          url.searchParams.get('code_challenge_method') !== 'S256') return invalid();
      const grant = Object.fromEntries(Object.entries(fields).map(([param, key]) => [key, url.searchParams.get(param)]));
      if (!allowed.has(grant.clientId) || allowed.get(grant.clientId) !== grant.redirectUri ||
          !/^[A-Za-z0-9_-]{43}$/.test(grant.codeChallenge ?? '') ||
          ![grant.state, grant.nonce].every(value => /^[A-Za-z0-9._~-]{22,256}$/.test(value ?? ''))) return invalid();
      const subject = await authenticate(request);
      if (!subject) {
        if (signIn) return loginPage(url);
        const destination = new URL(login);
        destination.searchParams.set('return_to', url.href);
        return new Response(null, {status: 303, headers: {...headers, Location: destination.href}});
      }
      const csrf = randomBytes(32).toString('base64url');
      const data = Buffer.from(JSON.stringify({grant, subject, csrf, expires: Date.now() + lifetime * 1000})).toString('base64url');
      return html(200, '連結 SnowRealm Games 帳號',
        `<p>允許 BrickDuel 測試站連結你目前登入的 SnowRealm 帳號？</p>
        <form method="post" action="${path}">
        <input type="hidden" name="csrf" value="${csrf}">
        <button name="decision" value="allow">同意</button>
        <button name="decision" value="deny">拒絕</button></form>`,
        {'Set-Cookie': setCookie(`${data}.${mac(data).toString('base64url')}`, lifetime)});
    }
    if (request.method !== 'POST') return new Response(null, {status: 405, headers: {...headers, Allow: 'GET, POST'}});
    if (request.headers.get('origin') !== issuer ||
        request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') return invalid();
    const reader = request.body?.getReader();
    if (!reader) return invalid();
    const parts = [];
    let size = 0;
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) { void reader.cancel().catch(() => {}); return invalid(); }
      parts.push(value);
    }
    const form = new URLSearchParams(Buffer.concat(parts).toString('utf8'));
    if (signIn && url.search && url.search.length <= 2048 && form.size === 2 &&
        form.has('email') && form.has('password')) {
      const session = await signIn(form.get('email'), form.get('password'));
      if (!session) return loginPage(url, true);
      return new Response(null, {status: 303, headers: {
        ...headers, Location: path + url.search, 'Set-Cookie': session,
      }});
    }
    const cookieValue = request.headers.get('cookie')?.split(/;\s*/).find(value => value.startsWith(`${cookie}=`))?.slice(cookie.length + 1);
    if (!cookieValue || cookieValue.length > 3600 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(cookieValue)) return invalid();
    const [data, signature] = cookieValue.split('.');
    if (!timingSafeEqual(mac(data), Buffer.from(signature, 'base64url'))) return invalid();
    const transaction = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (transaction.expires <= Date.now()) return invalid();
    const decision = form.get('decision');
    if (form.size !== 2 || form.get('csrf') !== transaction.csrf ||
        !['allow', 'deny'].includes(decision) || await authenticate(request) !== transaction.subject) return invalid();
    const {grant} = transaction;
    const redirect = new URL(grant.redirectUri);
    redirect.searchParams.set('iss', issuer);
    redirect.searchParams.set('state', grant.state);
    if (decision === 'allow') {
      const {code} = await authorize({...grant, verifiedSubject: transaction.subject, consentGranted: true});
      redirect.searchParams.set('code', code);
    } else {
      redirect.searchParams.set('error', 'access_denied');
    }
    return new Response(null, {status: 303, headers: {
      ...headers, Location: redirect.href, 'Set-Cookie': setCookie('', 0),
    }});
  };
}
