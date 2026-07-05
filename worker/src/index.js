/* ============================================================
   proves-work-router — Cloudflare Worker
   ============================================================
   Handles TWO jobs on the proves.work zone:

   1. Wildcard subdomains  (<username>.proves.work/*)
      → looks up a published portfolio snapshot in KV and serves
        the static HTML directly. No origin server involved.

   2. The publish API      (proves.work/api/*)
      → lets the editor (running on the apex domain) claim a
        username and upload a rendered HTML snapshot.

   Route this Worker on exactly these two Route patterns (see
   wrangler.jsonc / README.md in this folder):
      - "proves.work/api/*"
      - "*.proves.work/*"

   Your marketing site / editor (index.html, editor.html, etc.)
   keeps being served however it is today (e.g. Cloudflare Pages
   on the apex domain) — this Worker never touches that traffic
   because it's only routed on /api/* at the apex.
   ============================================================ */

const RESERVED = new Set([
  'www', 'api', 'app', 'admin', 'mail', 'email', 'ftp', 'blog', 'help',
  'support', 'static', 'cdn', 'assets', 'img', 'images', 'dashboard',
  'dev', 'staging', 'test', 'docs', 'status', 'shop', 'store', 'proves',
  'portfolio', 'account', 'accounts', 'login', 'logout', 'signup',
  'billing', 'payments', 'ns1', 'ns2', 'mx', 'root', 'null', 'undefined'
]);

// 3–30 chars, lowercase letters/digits/hyphens, no leading/trailing hyphen.
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;

const CORS_HEADERS = {
  'access-control-allow-origin': '*', // tighten to 'https://proves.work' once you deploy the editor for real
  'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type'
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS }
  });
}

function notFoundPage(username) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>Not found — proves.work</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body{font-family:-apple-system,'Inter',system-ui,sans-serif;background:#FDF7FA;color:#1A1A1A;
       display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}
  a{color:#7C4DFF;font-weight:700;text-decoration:none;}
  h1{font-size:1.4rem;}
</style></head>
<body>
  <div>
    <h1>@${escapeHtml(username)} hasn't published a portfolio yet</h1>
    <p><a href="https://proves.work">Build yours at proves.work →</a></p>
  </div>
</body></html>`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const isApex = host === 'proves.work' || host === 'www.proves.work';

    if (isApex && url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url);
    }

    if (!isApex) {
      const username = host.split('.')[0];
      return serveSite(username, env);
    }

    // Apex + non-API path should never reach this Worker if routes are
    // configured as documented (only /api/* is routed at the apex).
    // Kept as a defensive fallback rather than a hard crash.
    return new Response('Not found', { status: 404 });
  }
};

async function serveSite(username, env) {
  if (!USERNAME_RE.test(username) || RESERVED.has(username)) {
    return new Response(notFoundPage(username), { status: 404, headers: { 'content-type': 'text/html;charset=UTF-8' } });
  }

  const record = await env.SITES.get(`site:${username}`, 'json');
  if (!record) {
    return new Response(notFoundPage(username), { status: 404, headers: { 'content-type': 'text/html;charset=UTF-8' } });
  }

  return new Response(record.html, {
    status: 200,
    headers: {
      'content-type': 'text/html;charset=UTF-8',
      // Short edge cache: republishing should show up within a minute,
      // not be stuck behind a long cache.
      'cache-control': 'public, max-age=60'
    }
  });
}

async function handleApi(request, env, url) {
  if (url.pathname === '/api/check-username' && request.method === 'GET') {
    const username = (url.searchParams.get('u') || '').toLowerCase();
    if (!USERNAME_RE.test(username) || RESERVED.has(username)) {
      return json({ available: false, reason: 'invalid' });
    }
    const existing = await env.SITES.get(`site:${username}`);
    return json({ available: !existing });
  }

  if (url.pathname === '/api/publish' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid JSON body.' }, 400);
    }

    const username = String(body.username || '').toLowerCase().trim();
    const token = String(body.token || '').trim();
    const html = String(body.html || '');

    if (!USERNAME_RE.test(username) || RESERVED.has(username)) {
      return json({ ok: false, error: 'Username must be 3-30 lowercase letters, numbers, or hyphens.' }, 400);
    }
    if (!token || token.length < 8) {
      return json({ ok: false, error: 'Missing publish token.' }, 400);
    }
    if (!html || html.length > 2_000_000) {
      return json({ ok: false, error: 'Missing page content, or content too large (2MB limit).' }, 400);
    }

    const existing = await env.SITES.get(`site:${username}`, 'json');
    if (existing && existing.token !== token) {
      return json({ ok: false, error: 'That username is already taken.' }, 409);
    }

    await env.SITES.put(`site:${username}`, JSON.stringify({
      token,
      html,
      updatedAt: new Date().toISOString()
    }));

    return json({ ok: true, url: `https://${username}.proves.work` });
  }

  if (url.pathname === '/api/publish' && request.method === 'DELETE') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid JSON body.' }, 400);
    }

    const username = String(body.username || '').toLowerCase().trim();
    const token = String(body.token || '').trim();

    const existing = await env.SITES.get(`site:${username}`, 'json');
    if (!existing) return json({ ok: true });
    if (existing.token !== token) return json({ ok: false, error: 'Not authorized to unpublish this username.' }, 403);

    await env.SITES.delete(`site:${username}`);
    return json({ ok: true });
  }

  return json({ ok: false, error: 'Unknown API route.' }, 404);
}
