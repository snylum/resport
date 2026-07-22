/* ============================================================
   proves-work-router — Cloudflare Worker
   ============================================================
   Free subdomains on proves.work. No portfolio builder, no
   sign-ups. Two ways to claim a name:

   1. "no-code" — give a username + your name/email + a URL.
      <username>.proves.work proxies to that URL.
   2. "coder"   — give a username + a public GitHub repo (must be
      open source) + the URL it deploys to (GitHub Pages, Vercel,
      etc). Same proxy, plus we show an "open source" badge and
      link back to the repo, like is-a.dev does for its domains.

   Every claim is reviewed by hand at /admin before it goes live
   (same idea is-a.dev uses via PRs — here it's just a click).

   Routes this Worker on:
      - "proves.work/api/*"
      - "*.proves.work/*"
   ============================================================ */

const APP_HOST = 'proves.work';

const RESERVED = new Set([
  'www', 'api', 'app', 'admin', 'mail', 'email', 'ftp', 'blog', 'help',
  'support', 'static', 'cdn', 'assets', 'img', 'images', 'dashboard',
  'dev', 'staging', 'test', 'docs', 'status', 'shop', 'store', 'proves',
  'proveswork', 'account', 'accounts', 'login', 'logout', 'signup',
  'billing', 'payments', 'ns1', 'ns2', 'mx', 'root', 'null', 'undefined'
]);

// 3–30 chars, lowercase letters/digits/hyphens, no leading/trailing hyphen.
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Claims specifically require a properly formatted @gmail.com address
// (letters/digits/dots only, no leading/trailing/double dots).
const GMAIL_RE = /^[a-z0-9](?:\.?[a-z0-9]){5,29}@gmail\.com$/i;

const CORS_HEADERS = {
  'access-control-allow-origin': '*', // tighten to `https://${APP_HOST}` once live
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
};

function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS, ...extraHeaders }
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Only this account can approve claims / confirm donations / tag
// showcase entries from /admin. Add more addresses if needed.
const ADMIN_EMAILS = new Set(['snylumagbas@gmail.com']);

// Cap how many active (pending or live) subdomains one email can hold at
// once, so a single person/bot can't hoard names. Rejected/deleted claims
// free up the slot again — see releaseEmailSlot().
const MAX_CLAIMS_PER_EMAIL = 3;

async function verifyAdminCredential(credential) {
  if (!credential) return null;
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const email = (data.email_verified === 'true' || data.email_verified === true) ? data.email : null;
    if (!email || !ADMIN_EMAILS.has(email)) return null;
    return email;
  } catch {
    return null;
  }
}

// ── Simple per-IP rate limiting, stored in KV with a TTL ───────────
async function checkAndBumpRateLimit(env, key, max, windowSeconds) {
  const raw = await env.SITES.get(key, 'json');
  const now = Date.now();
  let count = 1;
  if (raw && typeof raw.count === 'number' && raw.expiresAt > now) count = raw.count + 1;
  if (count > max) return false;
  await env.SITES.put(key, JSON.stringify({ count, expiresAt: now + windowSeconds * 1000 }), {
    expirationTtl: windowSeconds
  });
  return true;
}

// ── Cloudflare Turnstile — blocks scripted/bot submissions before they
// ever reach the rate limiter or KV. Requires TURNSTILE_SECRET_KEY set via
// `npx wrangler secret put TURNSTILE_SECRET_KEY`. Until that secret is
// set, verification is skipped entirely (so local/dev setups don't break) —
// set it before going live if bot spam is a concern.
async function verifyTurnstile(token, ip, env) {
  if (!env.TURNSTILE_SECRET_KEY) return true; // not configured — skip
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip })
    });
    const data = await res.json();
    return !!data.success;
  } catch {
    return false;
  }
}

// ── Per-email active-claim tracking (KV list, prefix "emailclaims:") ──
// Keeps this cheap (no D1/database) while still capping how many live
// names one email can hold. Call releaseEmailSlot() whenever a claim is
// rejected or deleted so that email can claim again.
async function addEmailSlot(env, email, username, max) {
  const key = `emailclaims:${email}`;
  const current = (await env.SITES.get(key, 'json')) || [];
  if (current.includes(username)) return true;
  if (current.length >= max) return false;
  current.push(username);
  await env.SITES.put(key, JSON.stringify(current));
  return true;
}
async function releaseEmailSlot(env, email, username) {
  if (!email) return;
  const key = `emailclaims:${email}`;
  const current = (await env.SITES.get(key, 'json')) || [];
  const next = current.filter(u => u !== username);
  if (next.length) await env.SITES.put(key, JSON.stringify(next));
  else await env.SITES.delete(key);
}

// ── Donation tiers ──────────────────────────────────────────────────
const TIERS = {
  normal:  { label: 'Pulse',  php: 50,   usd: 1 },
  gold:    { label: 'Beat',   php: 250,  usd: 10 },
  diamond: { label: 'Blood',  php: 1000, usd: 50 },
  real:    { label: 'Soul',   php: null, usd: null }, // any amount > diamond, custom tag
  ghost:   { label: 'Breath', php: null, usd: null }  // any odd amount < diamond
};

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
    <h1>@${escapeHtml(username)} hasn't claimed this yet</h1>
    <p><a href="https://${APP_HOST}">Claim it free at ${APP_HOST} →</a></p>
  </div>
</body></html>`;
}

function pendingPage(username) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>Pending review — ${APP_HOST}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body{font-family:-apple-system,'Inter',system-ui,sans-serif;background:#FDF7FA;color:#1A1A1A;
       display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:0 1.5rem;}
  a{color:#7C4DFF;font-weight:700;text-decoration:none;}
  h1{font-size:1.4rem;margin:0 0 .5rem;}
  p{color:#6B6B6B;}
</style></head>
<body>
  <div>
    <h1>${escapeHtml(username)}.${APP_HOST} is pending review</h1>
    <p>Claims are checked by hand and usually go live within a day.</p>
    <p><a href="https://${APP_HOST}">Back to ${APP_HOST} →</a></p>
  </div>
</body></html>`;
}

// ── Proxy: fetches the owner's real page and serves it back so the
// address bar keeps showing username.proves.work. ────────────────
async function proxyRedirectTarget(redirectUrl, pathAndQuery) {
  let targetOrigin;
  try {
    targetOrigin = new URL(redirectUrl).origin;
  } catch {
    return new Response('This address is not configured correctly.', {
      status: 502, headers: { 'content-type': 'text/plain;charset=UTF-8' }
    });
  }

  const targetPageUrl = (!pathAndQuery || pathAndQuery === '/')
    ? redirectUrl
    : targetOrigin + pathAndQuery;

  let upstream;
  try {
    upstream = await fetch(targetPageUrl, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; proves.work-proxy/1.0)' }
    });
  } catch {
    return new Response('The connected page could not be reached right now.', {
      status: 502, headers: { 'content-type': 'text/plain;charset=UTF-8' }
    });
  }

  const contentType = upstream.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return new Response(upstream.body, { status: upstream.status, headers: { 'content-type': contentType } });
  }

  let html = await upstream.text();
  const originEsc = targetOrigin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  html = html.replace(new RegExp(`(href|action)="${originEsc}(/[^"]*)?"`, 'g'), (m, attr, path) => `${attr}="${path || '/'}"`);

  return new Response(html, {
    status: upstream.status,
    headers: { 'content-type': 'text/html;charset=UTF-8' }
  });
}

async function serveSite(username, env, pathAndQuery) {
  username = username.toLowerCase();
  const record = await env.SITES.get(`site:${username}`, 'json');
  if (!record) return new Response(notFoundPage(username), { status: 404, headers: { 'content-type': 'text/html;charset=UTF-8' } });
  if (record.status !== 'live') return new Response(pendingPage(username), { status: 200, headers: { 'content-type': 'text/html;charset=UTF-8' } });
  return proxyRedirectTarget(record.target, pathAndQuery);
}

// ── GitHub check: repo must exist and be public ────────────────────
async function verifyPublicRepo(repoUrl) {
  try {
    const u = new URL(repoUrl);
    if (u.hostname !== 'github.com') return { ok: false, error: 'Repo must be a github.com URL.' };
    const [, owner, repo] = u.pathname.split('/');
    if (!owner || !repo) return { ok: false, error: 'Could not parse owner/repo from that URL.' };
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo.replace(/\.git$/, '')}`, {
      headers: { 'user-agent': 'proves-work-worker', 'accept': 'application/vnd.github+json' }
    });
    if (!res.ok) return { ok: false, error: 'Repo not found on GitHub.' };
    const data = await res.json();
    if (data.private) return { ok: false, error: 'Repo must be public/open-source.' };
    return { ok: true, fullName: data.full_name, htmlUrl: data.html_url };
  } catch {
    return { ok: false, error: 'Could not verify that repo.' };
  }
}

async function handleApi(request, env, url) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';

  // ── Claim a subdomain (no sign-up) ────────────────────────────────
  if (url.pathname === '/api/claim' && request.method === 'POST') {
    const ok = await checkAndBumpRateLimit(env, `rl:claim:${ip}`, 10, 60 * 60);
    if (!ok) return json({ ok: false, error: 'Too many claims from this connection. Try again later.' }, 429);

    const body = await request.json().catch(() => ({}));

    const turnstileOk = await verifyTurnstile(body.turnstileToken, ip, env);
    if (!turnstileOk) return json({ ok: false, error: 'Verification failed. Please retry the challenge and submit again.' }, 400);

    const username = String(body.username || '').toLowerCase().trim();
    const mode = body.mode === 'coder' ? 'coder' : 'nocode';

    if (!USERNAME_RE.test(username)) return json({ ok: false, error: 'Username must be 3–30 lowercase letters, numbers, or hyphens.' }, 400);
    if (RESERVED.has(username)) return json({ ok: false, error: 'That name is reserved.' }, 400);

    const existing = await env.SITES.get(`site:${username}`, 'json');
    if (existing && existing.status !== 'rejected') return json({ ok: false, error: 'That name is already taken.' }, 409);

    let record;
    if (mode === 'coder') {
      const repo = String(body.repo || '').trim();
      const target = String(body.target || '').trim();
      if (!repo || !target) return json({ ok: false, error: 'Repo URL and deployed site URL are both required.' }, 400);
      const email = String(body.email || '').trim();
      if (!GMAIL_RE.test(email)) return json({ ok: false, error: 'Only properly named @gmail.com addresses are accepted.' }, 400);
      const check = await verifyPublicRepo(repo);
      if (!check.ok) return json({ ok: false, error: check.error }, 400);
      let normalizedTarget;
      try { normalizedTarget = new URL(target).href; } catch { return json({ ok: false, error: 'Deployed site URL is not valid.' }, 400); }
      record = {
        username, mode: 'coder', target: normalizedTarget,
        repo: check.htmlUrl, repoName: check.fullName,
        email,
        status: 'pending', showcase: false, createdAt: new Date().toISOString()
      };
    } else {
      const target = String(body.target || '').trim();
      const email = String(body.email || '').trim();
      if (!target) return json({ ok: false, error: 'A URL to point this domain at is required.' }, 400);
      let normalizedTarget;
      try { normalizedTarget = new URL(target).href; } catch { return json({ ok: false, error: 'That URL is not valid.' }, 400); }
      if (!GMAIL_RE.test(email)) return json({ ok: false, error: 'Only properly named @gmail.com addresses are accepted.' }, 400);
      record = {
        username, mode: 'nocode', target: normalizedTarget,
        email,
        status: 'pending', showcase: false, createdAt: new Date().toISOString()
      };
    }

    const slotOk = await addEmailSlot(env, record.email, username, MAX_CLAIMS_PER_EMAIL);
    if (!slotOk) return json({ ok: false, error: `That email already has ${MAX_CLAIMS_PER_EMAIL} active claims — the limit per email.` }, 429);

    await env.SITES.put(`site:${username}`, JSON.stringify(record));
    return json({ ok: true, username, status: 'pending' });
  }

  // ── Public showcase feed (paginated, for infinite scroll) ──────────
  if (url.pathname === '/api/showcase' && request.method === 'GET') {
    const cursor = url.searchParams.get('cursor') || undefined;
    const list = await env.SITES.list({ prefix: 'site:', cursor, limit: 30 });
    const records = (await Promise.all(list.keys.map(k => env.SITES.get(k.name, 'json'))))
      .filter(r => r && r.username && r.status === 'live' && r.showcase);
    return json({
      ok: true,
      items: records.map(r => ({
        username: r.username, target: r.target, mode: r.mode,
        repo: r.repo || null, repoName: r.repoName || null,
        tier: r.showcaseTier || null,
        amount: r.showcaseAmount ?? null,
        customTag: r.showcaseCustomTag || null
      })),
      cursor: list.list_complete ? null : list.cursor
    });
  }

  // ── Contact form — also used for donation reference-number submissions ──
  if (url.pathname === '/api/contact' && request.method === 'POST') {
    const ok = await checkAndBumpRateLimit(env, `rl:contact:${ip}`, 15, 60 * 60);
    if (!ok) return json({ ok: false, error: 'Too many submissions. Try again later.' }, 429);

    const body = await request.json().catch(() => ({}));
    const type = body.type === 'donation' ? 'donation' : 'contact';
    const now = new Date();

    if (type === 'donation') {
      const tier = TIERS[body.tier] ? body.tier : null;
      const currency = body.currency === 'usd' ? 'usd' : 'php';
      const symbol = currency === 'usd' ? '$' : '₱';
      const referenceNumber = String(body.referenceNumber || '').trim();
      const username = String(body.username || '').toLowerCase().trim();
      const amount = Number(body.amount) || null;
      const donationEmail = String(body.email || '').trim();
      if (!tier) return json({ ok: false, error: 'Pick a donation tier.' }, 400);
      if (!amount || amount <= 0) return json({ ok: false, error: 'Enter a valid amount.' }, 400);
      if (!referenceNumber) return json({ ok: false, error: 'Reference number is required.' }, 400);
      if (!username) return json({ ok: false, error: 'Tell us which subdomain to boost.' }, 400);
      if (!EMAIL_RE.test(donationEmail)) return json({ ok: false, error: 'A valid email is required.' }, 400);

      // Make sure what's actually submitted matches what that tier tag
      // offers in the chosen currency — fixed tiers must match exactly,
      // Soul must exceed the Blood threshold, Breath must stay under it
      // with an odd amount.
      const diamondAmount = TIERS.diamond[currency];
      if (['normal', 'gold', 'diamond'].includes(tier)) {
        const expected = TIERS[tier][currency];
        if (Math.round(amount * 100) !== Math.round(expected * 100)) {
          return json({ ok: false, error: `${TIERS[tier].label} is a fixed amount of ${symbol}${expected}.` }, 400);
        }
      } else if (tier === 'real') {
        if (amount <= diamondAmount) return json({ ok: false, error: `Soul needs an amount above ${symbol}${diamondAmount}.` }, 400);
      } else if (tier === 'ghost') {
        if (amount >= diamondAmount) return json({ ok: false, error: `Breath needs an amount below ${symbol}${diamondAmount}.` }, 400);
        if (!Number.isInteger(amount) || amount % 2 === 0) return json({ ok: false, error: 'Breath needs an odd whole-number amount.' }, 400);
      }

      const customTag = tier === 'real' ? String(body.customTag || '').trim().slice(0, 28) : null;

      const record = {
        id: crypto.randomUUID(), type: 'donation', tier, currency, amount, referenceNumber, username,
        email: donationEmail, customTag,
        note: String(body.message || '').slice(0, 2000),
        confirmed: false, createdAt: now.toISOString()
      };
      await env.SITES.put(`donation:${record.id}`, JSON.stringify(record));
      return json({ ok: true });
    }

    const record = {
      id: crypto.randomUUID(), type: 'contact',
      name: String(body.name || '').slice(0, 200),
      email: String(body.email || '').trim(),
      message: String(body.message || '').slice(0, 5000),
      createdAt: now.toISOString()
    };

    let delivered = false;
    if (env.RESEND_API_KEY) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
          body: JSON.stringify({
            from: `${APP_HOST} <noreply@${APP_HOST}>`,
            to: [...ADMIN_EMAILS],
            subject: `[${APP_HOST}] New contact message`,
            text: `From: ${record.name} <${record.email}>\n\n${record.message}`
          })
        });
        delivered = res.ok;
      } catch { /* delivered stays false — queue it below */ }
    }
    // Only queue in KV (for the admin Messages tab) when email delivery
    // didn't actually happen — otherwise every message would sit in both
    // places forever.
    if (!delivered) {
      await env.SITES.put(`contact:${Date.now()}:${crypto.randomUUID()}`, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 90 });
    }
    return json({ ok: true });
  }

  // ── Site-wide visit counter (sampled ~10%, to stay well under the
  // free KV-write quota even with real traffic) ──────────────────────
  if (url.pathname === '/api/visits' && request.method === 'POST') {
    if (Math.random() < 0.1) {
      const current = parseInt((await env.SITES.get('meta:visit-count')) || '0', 10) || 0;
      const next = current + 10; // each sampled write stands in for ~10 visits
      await env.SITES.put('meta:visit-count', String(next));
      return json({ ok: true, count: next });
    }
    const current = parseInt((await env.SITES.get('meta:visit-count')) || '0', 10) || 0;
    return json({ ok: true, count: current });
  }
  if (url.pathname === '/api/visits' && request.method === 'GET') {
    const current = parseInt((await env.SITES.get('meta:visit-count')) || '0', 10) || 0;
    return json({ ok: true, count: current });
  }

  // ═══════════════════ ADMIN (Google-gated) ═══════════════════════
  // "sites" is the current name for this list (matches admin.js); kept
  // functionally identical to the old /api/admin/claims endpoint.
  if (url.pathname === '/api/admin/sites' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);
    const list = await env.SITES.list({ prefix: 'site:' });
    // Parse each record independently — a single corrupt/malformed value
    // (e.g. from a partial write) must not crash the whole listing with
    // an uncaught exception (which Cloudflare turns into a bare 503).
    // Malformed entries are still surfaced (flagged) so an admin can see
    // and delete them instead of them becoming invisible, unremovable
    // ghosts that keep blocking a username forever.
    const records = await Promise.all(list.keys.map(async (k) => {
      const fallbackUsername = k.name.replace(/^site:/, '');
      try {
        const parsed = await env.SITES.get(k.name, 'json');
        if (!parsed || typeof parsed !== 'object') {
          return { username: fallbackUsername, status: 'malformed', malformed: true, createdAt: '' };
        }
        return { ...parsed, username: parsed.username || fallbackUsername };
      } catch {
        return { username: fallbackUsername, status: 'malformed', malformed: true, createdAt: '' };
      }
    }));
    return json({
      ok: true,
      sites: records
        .filter(r => r && r.username)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    });
  }

  if (url.pathname === '/api/admin/set-status' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);
    const username = String(body.username || '').toLowerCase().trim();
    const status = body.status;
    if (!['live', 'pending', 'rejected'].includes(status)) return json({ ok: false, error: 'Invalid status.' }, 400);
    const existing = await env.SITES.get(`site:${username}`, 'json');
    if (!existing) return json({ ok: false, error: 'Not found.' }, 404);
    existing.status = status;
    existing.reviewedBy = adminEmail;
    existing.reviewedAt = new Date().toISOString();
    await env.SITES.put(`site:${username}`, JSON.stringify(existing));
    // Rejected claims free up that email's slot so they (or someone else) can claim again.
    if (status === 'rejected') await releaseEmailSlot(env, existing.email, username);
    return json({ ok: true });
  }

  // Hard delete — permanently frees the username. Unlike 'rejected' (which
  // just hides the site but keeps the name reserved to that email), this
  // erases the record entirely. Keeps a snapshot in an audit log first,
  // since this can't be undone and admins want to know what was deleted.
  if (url.pathname === '/api/admin/delete-site' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);
    const username = String(body.username || '').toLowerCase().trim();
    const existing = await env.SITES.get(`site:${username}`, 'json');
    if (!existing) return json({ ok: false, error: 'Not found.' }, 404);
    await releaseEmailSlot(env, existing.email, username);
    await env.SITES.delete(`site:${username}`);
    const auditEntry = {
      username, deletedBy: adminEmail, deletedAt: new Date().toISOString(),
      snapshot: {
        status: existing.status, mode: existing.mode, email: existing.email,
        showcase: !!existing.showcase, target: existing.target
      }
    };
    await env.SITES.put(`auditlog:${Date.now()}:${crypto.randomUUID()}`, JSON.stringify(auditEntry));
    return json({ ok: true });
  }

  // Last 200 hard-delete audit entries, newest first. Read-only — the
  // point is visibility into what was deleted and by whom, not recovery.
  if (url.pathname === '/api/admin/audit-log' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);
    const list = await env.SITES.list({ prefix: 'auditlog:', limit: 200 });
    const entries = (await Promise.all(list.keys.map(k => env.SITES.get(k.name, 'json'))))
      .filter(Boolean)
      .sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
    return json({ ok: true, entries });
  }

  // Contact-form messages that landed in KV because Resend either isn't
  // configured or a send failed (see /api/contact below) — the queue an
  // admin actually needs to work through.
  if (url.pathname === '/api/admin/contact-messages' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);
    const list = await env.SITES.list({ prefix: 'contact:', limit: 200 });
    const entries = (await Promise.all(list.keys.map(async k => {
      const value = await env.SITES.get(k.name, 'json');
      return value ? { ...value, key: k.name } : null;
    }))).filter(Boolean).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return json({ ok: true, entries });
  }

  if (url.pathname === '/api/admin/contact-messages/delete' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);
    const key = String(body.key || '');
    if (!key.startsWith('contact:')) return json({ ok: false, error: 'Invalid key.' }, 400);
    await env.SITES.delete(key);
    return json({ ok: true });
  }

  if (url.pathname === '/api/admin/donations' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);
    const list = await env.SITES.list({ prefix: 'donation:', limit: 200 });
    const records = await Promise.all(list.keys.map(k => env.SITES.get(k.name, 'json')));
    return json({ ok: true, donations: records.filter(Boolean).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')) });
  }

  // Confirm a donation's reference number by hand, and optionally tag
  // the named subdomain into the public showcase in the same step.
  if (url.pathname === '/api/admin/donations/confirm' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);
    const id = String(body.id || '');
    const donation = await env.SITES.get(`donation:${id}`, 'json');
    if (!donation) return json({ ok: false, error: 'Donation not found.' }, 404);
    donation.confirmed = true;
    donation.confirmedBy = adminEmail;
    donation.confirmedAt = new Date().toISOString();
    await env.SITES.put(`donation:${id}`, JSON.stringify(donation));

    if (body.tagShowcase) {
      const site = await env.SITES.get(`site:${donation.username}`, 'json');
      if (site) {
        site.showcase = true;
        site.showcaseTier = donation.tier;
        site.showcaseAmount = donation.amount ?? null;
        site.showcaseCustomTag = donation.customTag || null;
        site.showcaseAddedAt = new Date().toISOString();
        await env.SITES.put(`site:${donation.username}`, JSON.stringify(site));
      }
    }
    return json({ ok: true });
  }

  // Manually edit a donation's fields (reference number, amount, tier,
  // currency, username, email, custom tag, note). Admin-only, used when a
  // donor's submission needs correcting after the fact.
  if (url.pathname === '/api/admin/donations/edit' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);
    const id = String(body.id || '');
    const donation = await env.SITES.get(`donation:${id}`, 'json');
    if (!donation) return json({ ok: false, error: 'Donation not found.' }, 404);

    if (body.tier !== undefined) {
      if (!TIERS[body.tier]) return json({ ok: false, error: 'Invalid tier.' }, 400);
      donation.tier = body.tier;
    }
    if (body.currency !== undefined) {
      donation.currency = body.currency === 'usd' ? 'usd' : 'php';
    }
    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (!amount || amount <= 0) return json({ ok: false, error: 'Enter a valid amount.' }, 400);
      donation.amount = amount;
    }
    if (body.referenceNumber !== undefined) {
      donation.referenceNumber = String(body.referenceNumber || '').trim();
    }
    if (body.username !== undefined) {
      donation.username = String(body.username || '').toLowerCase().trim();
    }
    if (body.email !== undefined) {
      donation.email = String(body.email || '').trim();
    }
    if (body.customTag !== undefined) {
      donation.customTag = String(body.customTag || '').trim().slice(0, 28) || null;
    }
    if (body.note !== undefined) {
      donation.note = String(body.note || '').slice(0, 2000);
    }
    donation.editedBy = adminEmail;
    donation.editedAt = new Date().toISOString();
    await env.SITES.put(`donation:${id}`, JSON.stringify(donation));
    return json({ ok: true, donation });
  }

  // Reverse a confirmation — flips the donation back to unconfirmed. Does
  // not automatically un-showcase the site (an admin may still want the
  // profile featured even if the donation record needs re-checking); use
  // the showcase toggle separately for that.
  if (url.pathname === '/api/admin/donations/unconfirm' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);
    const id = String(body.id || '');
    const donation = await env.SITES.get(`donation:${id}`, 'json');
    if (!donation) return json({ ok: false, error: 'Donation not found.' }, 404);
    donation.confirmed = false;
    donation.unconfirmedBy = adminEmail;
    donation.unconfirmedAt = new Date().toISOString();
    await env.SITES.put(`donation:${id}`, JSON.stringify(donation));
    return json({ ok: true });
  }

  if (url.pathname === '/api/admin/showcase/tag' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);
    const username = String(body.username || '').toLowerCase().trim();
    const site = await env.SITES.get(`site:${username}`, 'json');
    if (!site) return json({ ok: false, error: 'Not found.' }, 404);
    site.showcase = !!body.showcase;
    site.showcaseAddedAt = site.showcase ? new Date().toISOString() : null;
    await env.SITES.put(`site:${username}`, JSON.stringify(site));
    return json({ ok: true });
  }

  return json({ ok: false, error: 'Unknown API route.' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

    const isApex = host === APP_HOST || host === `www.${APP_HOST}`;

    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url);

    if (!isApex) {
      const username = host.split('.')[0];
      return serveSite(username, env, url.pathname + url.search);
    }

    return new Response('Not found', { status: 404 });
  }
};
