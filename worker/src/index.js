/* ============================================================
   proves-work-router — Cloudflare Worker
   ============================================================
   Handles TWO jobs on the proves.work zone:

   1. Wildcard subdomains  (<username>.proves.work/*)
      → looks up a published portfolio snapshot in KV and serves
        the static HTML directly. No origin server involved.

   2. The publish API      (proves.work/api/*)
      → lets the editor (running on proves.work) claim a
        username and upload a rendered HTML snapshot.

   Route this Worker on exactly these two Route patterns (see
   wrangler.jsonc / README.md in this folder):
      - "proves.work/api/*"
      - "*.proves.work/*"

   Your marketing site / editor (index.html, editor.html, etc.)
   keeps being served however it is today on proves.work —
   this Worker never touches that traffic because it's only
   routed on /api/* at that host.
   ============================================================ */

// The single app host. Change this one line (and the routes in
// wrangler.jsonc) if you ever move the editor to a different
// domain/subdomain.
const APP_HOST = 'proves.work';

const RESERVED = new Set([
  'www', 'api', 'app', 'admin', 'mail', 'email', 'ftp', 'blog', 'help',
  'support', 'static', 'cdn', 'assets', 'img', 'images', 'dashboard',
  'dev', 'staging', 'test', 'docs', 'status', 'shop', 'store', 'proves', 'proveswork',
  'portfolio', 'account', 'accounts', 'login', 'logout', 'signup',
  'billing', 'payments', 'ns1', 'ns2', 'mx', 'root', 'null', 'undefined'
]);

// 3–30 chars, lowercase letters/digits/hyphens, no leading/trailing hyphen.
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;

const CORS_HEADERS = {
  'access-control-allow-origin': '*', // tighten to `https://${APP_HOST}` once you deploy the editor for real
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
<title>Not found — ${APP_HOST}</title>
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
    <p><a href="https://${APP_HOST}">Build yours at ${APP_HOST} →</a></p>
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

    const isApex = host === APP_HOST || host === `www.${APP_HOST}`;

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

// Must match GOOGLE_CLIENT_ID in editor.js exactly.
const GOOGLE_CLIENT_ID = '41010460965-oti1phnr8kdbij312qijrg82bc2japj7.apps.googleusercontent.com';

// Verifies a Google ID token (JWT) server-side via Google's tokeninfo
// endpoint — this is the real trust boundary; the editor's own decode
// of the JWT is only for display and must never be trusted on its own.
// Returns the verified email, or null if the token is missing/invalid/
// for the wrong client.
async function verifyGoogleCredential(credential) {
  if (!credential) return null;
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!res.ok) return null;
    const payload = await res.json();
    if (payload.aud !== GOOGLE_CLIENT_ID) return null;
    if (!payload.email || payload.email_verified !== 'true') return null;
    return payload.email.toLowerCase();
  } catch {
    return null;
  }
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
    const html = String(body.html || '');
    // Signed in: verified Google email ties this username to an
    // account, so it can be updated later from any device by signing
    // in again. Signed out: published anonymously — same as before,
    // except there's no publish key to lose; an anonymous publish just
    // can't be reclaimed/updated except from the same site's future
    // publishes with a matching (or no) owner.
    const ownerEmail = await verifyGoogleCredential(body.googleCredential);

    if (!USERNAME_RE.test(username) || RESERVED.has(username)) {
      return json({ ok: false, error: 'Username must be 3-30 lowercase letters, numbers, or hyphens.' }, 400);
    }
    if (!html || html.length > 2_000_000) {
      return json({ ok: false, error: 'Missing page content, or content too large (2MB limit).' }, 400);
    }

    const existing = await env.SITES.get(`site:${username}`, 'json');
    if (existing) {
      const ownedByRequester = existing.ownerEmail && ownerEmail && existing.ownerEmail === ownerEmail;
      if (!ownedByRequester) {
        return json({ ok: false, error: 'That username is already taken.' }, 409);
      }
    }

    await env.SITES.put(`site:${username}`, JSON.stringify({
      ownerEmail: ownerEmail || (existing ? existing.ownerEmail : null) || null,
      html,
      updatedAt: new Date().toISOString()
    }));

    return json({ ok: true, url: `https://${username}.${APP_HOST}` });
  }

  if (url.pathname === '/api/publish' && request.method === 'DELETE') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid JSON body.' }, 400);
    }

    const username = String(body.username || '').toLowerCase().trim();
    const ownerEmail = await verifyGoogleCredential(body.googleCredential);

    const existing = await env.SITES.get(`site:${username}`, 'json');
    if (!existing) return json({ ok: true });
    if (!existing.ownerEmail || existing.ownerEmail !== ownerEmail) {
      return json({ ok: false, error: 'Not authorized to unpublish this username — sign in with the Google account that published it.' }, 403);
    }

    await env.SITES.delete(`site:${username}`);
    return json({ ok: true });
  }

  return json({ ok: false, error: 'Unknown API route.' }, 404);
}
