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

function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS, ...extraHeaders }
  });
}

// ── Recruiter Password Lock: strong, server-side verification ──────
// The old scheme baked a single unsalted SHA-256 digest of the
// recruiter key straight into the public HTML page and let the
// browser compare guesses to it client-side. That's effectively no
// protection: anyone can view-source the page, lift the digest, and
// brute-force it offline at billions of guesses/second (unsalted
// SHA-256 is designed to be fast, and human-picked keys are
// low-entropy), with zero rate limiting since the check never
// touched a server.
//
// This replaces that with:
//   1. A salted, iterated hash (PBKDF2-HMAC-SHA256) computed and
//      stored server-side only. The plaintext key is sent to the
//      Worker once (over HTTPS) to be hashed; the hash + salt never
//      go back to the browser, so nothing worth brute-forcing ever
//      appears in page source.
//   2. Guesses are checked via /api/lock/verify, which runs the same
//      slow hash server-side and applies per-IP/per-site rate
//      limiting stored in KV — no unlimited/instant guessing.
// Runs entirely on the free tier: just the KV namespace the Worker
// already has, no paid Rate Limiting Rules/WAF product needed.

const PBKDF2_ITERATIONS = 120_000; // native SubtleCrypto PBKDF2 runs
// outside the JS engine and is typically well under Workers' free-plan
// per-request CPU-time ceiling even at this count — if /api/publish or
// /api/lock/verify ever start erroring with CPU-limit exceptions,
// lower this (e.g. to 50_000) first.

function randomSaltHex() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

async function pbkdf2Hash(password, saltHex, iterations = PBKDF2_ITERATIONS) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Always walks the full length of the longer string instead of
// returning on the first mismatch, so response timing doesn't leak
// how many leading characters of a guess were correct.
function safeEqual(a, b) {
  const len = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

async function buildPasswordLock(plainKey) {
  const salt = randomSaltHex();
  const hash = await pbkdf2Hash(plainKey, salt, PBKDF2_ITERATIONS);
  return { salt, hash, iter: PBKDF2_ITERATIONS };
}

// Rate limiting for /api/lock/verify: per (IP, username) so one nosy
// visitor can't lock out everyone else guessing a different site's
// key, plus a per-username ceiling so distributed guessing against
// one site is still capped. Counters live in the same SITES KV
// namespace with a short TTL so they self-clear.
const LOCK_MAX_ATTEMPTS_PER_IP = 6;
const LOCK_IP_WINDOW_SECONDS = 15 * 60;      // 6 tries / 15 min / IP+site
const LOCK_MAX_ATTEMPTS_PER_SITE = 30;
const LOCK_SITE_WINDOW_SECONDS = 60 * 60;    // 30 tries / hour / site total

async function checkAndBumpRateLimit(env, key, max, windowSeconds) {
  const raw = await env.SITES.get(key, 'json');
  const now = Date.now();
  let count = 1;
  if (raw && typeof raw.count === 'number' && raw.expiresAt > now) count = raw.count + 1;
  if (count > max) return false; // over limit — don't extend the window further
  await env.SITES.put(key, JSON.stringify({ count, expiresAt: now + windowSeconds * 1000 }), {
    expirationTtl: windowSeconds
  });
  return true;
}

// Open-source instruction-tuned models occasionally wrap their JSON in
// ```fences``` or a sentence of preamble even when told not to — pull
// out the first {...} block and parse that instead of trusting the
// raw string.
function parseAIJson(text) {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// ── Verifiable Proof photo storage ──────────────────────────────────
// Photo entries in proofItems/liveProofItems can be large (data-URI
// images), and a site's KV record already carries draft+live copies of
// both `html` and the proof map — inlining photo bytes there
// multiplies that further and pushes toward KV's 25MB per-value
// ceiling as a site accumulates edits. Instead, each photo's bytes
// live in their own KV entry (`proof:<username>:<id>`), and the site
// record only keeps a small `{ type:'photo', photoRef:id, label }`
// pointer. Link-type proof entries are tiny (a URL + label) and stay
// inline as before — only photos get split out.
function proofBlobKey(username, id) {
  return `proof:${username}:${id}`;
}

// Turns a pointer map ({ id: {type, photoRef|link, label} }, as stored
// on the site record) into the full shape the client expects
// ({ id: {type, photo|link, label} }) by reading each photo's bytes
// back out of its own KV entry. Missing/expired blobs degrade to an
// empty photo rather than throwing, so one bad entry can't break the
// whole proof response.
async function hydrateProofItems(env, username, pointerMap) {
  const entries = Object.entries(pointerMap || {});
  const hydrated = await Promise.all(entries.map(async ([id, entry]) => {
    if (entry && entry.type === 'photo') {
      const photo = await env.SITES.get(proofBlobKey(username, entry.photoRef || id));
      return [id, { type: 'photo', photo: photo || '', label: entry.label || '' }];
    }
    return [id, entry];
  }));
  return Object.fromEntries(hydrated);
}

// Deletes any proof:<username>:* blob that isn't referenced by any of
// the pointer maps passed in (typically the freshly-published draft
// and whatever ends up as the live proof map), so editing/republishing
// doesn't leave orphaned photo blobs sitting in KV forever. Passing no
// maps (or maps with no photo entries) reclaims every blob for that
// username — used when a site is hard-deleted.
async function cleanupOrphanedProofBlobs(env, username, ...pointerMaps) {
  const keep = new Set();
  for (const map of pointerMaps) {
    for (const entry of Object.values(map || {})) {
      if (entry && entry.type === 'photo' && entry.photoRef) keep.add(proofBlobKey(username, entry.photoRef));
    }
  }
  const prefix = `proof:${username}:`;
  const list = await env.SITES.list({ prefix });
  const stale = list.keys.map(k => k.name).filter(name => !keep.has(name));
  await Promise.all(stale.map(name => env.SITES.delete(name)));
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

// Shown at <username>.proves.work once a *domain-only* reservation
// (no portfolio, just the name) has been approved by an admin — this
// becomes the record's liveHtml the same way a real portfolio's html
// does, via the exact same /api/admin/set-status → 'live' path.
function domainReservedPage(username) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>${escapeHtml(username)}.${APP_HOST}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body{font-family:-apple-system,'Inter',system-ui,sans-serif;background:#FDF7FA;color:#1A1A1A;
       display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:0 1.5rem;}
  a{color:#7C4DFF;font-weight:700;text-decoration:none;}
  h1{font-size:1.5rem;margin:0 0 0.5rem;}
  p{color:#4b5563;margin:0.25rem 0;}
</style></head>
<body>
  <div>
    <h1>${escapeHtml(username)}.${APP_HOST}</h1>
    <p>This name is reserved. A portfolio is coming soon.</p>
    <p><a href="https://${APP_HOST}">Built with ${APP_HOST} →</a></p>
  </div>
</body></html>`;
}

// Shown at <username>.proves.work while a site is saved but not yet
// approved (pending review) — the site is never public until an admin
// approves it, so this page (not the person's real content) is what
// the public sees at that address in the meantime.
function pendingPage(username) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>Not yet published — ${APP_HOST}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body{font-family:-apple-system,'Inter',system-ui,sans-serif;background:#FDF7FA;color:#1A1A1A;
       display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;}
  a{color:#7C4DFF;font-weight:700;text-decoration:none;}
  h1{font-size:1.4rem;}
</style></head>
<body>
  <div>
    <h1>@${escapeHtml(username)}'s portfolio is awaiting approval</h1>
    <p><a href="https://${APP_HOST}">Build yours at ${APP_HOST} →</a></p>
  </div>
</body></html>`;
}

// Shown at <username>.proves.work once a paid plan's paidUntil date
// has passed — the address itself isn't lost, but the Free tier never
// includes live hosting at username.proves.work (see index.html's
// pricing card), so an expired portfolio drops out of serving here
// until it's republished/renewed from the editor.
function expiredPortfolioPage(username) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>@${escapeHtml(username)}'s plan has ended — ${APP_HOST}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body{font-family:-apple-system,'Inter',system-ui,sans-serif;background:#FDF7FA;color:#1A1A1A;
       display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:0 1.5rem;}
  a{color:#7C4DFF;font-weight:700;text-decoration:none;}
  h1{font-size:1.4rem;margin:0 0 0.5rem;}
  p{color:#4b5563;margin:0.25rem 0;}
</style></head>
<body>
  <div>
    <h1>@${escapeHtml(username)}'s Active Job Hunter plan has ended</h1>
    <p>This address dropped back to the Free tier, which doesn't include live hosting here.</p>
    <p><a href="https://${APP_HOST}">Renew at ${APP_HOST} →</a></p>
  </div>
</body></html>`;
}

// Same idea, for a domain-only reservation whose paid window lapsed —
// distinct copy since there's no "free tier" fallback for a reserved
// name the way there is for a portfolio.
function expiredDomainPage(username) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>Reservation lapsed — ${APP_HOST}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body{font-family:-apple-system,'Inter',system-ui,sans-serif;background:#FDF7FA;color:#1A1A1A;
       display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:0 1.5rem;}
  a{color:#7C4DFF;font-weight:700;text-decoration:none;}
  h1{font-size:1.4rem;margin:0 0 0.5rem;}
  p{color:#4b5563;margin:0.25rem 0;}
</style></head>
<body>
  <div>
    <h1>@${escapeHtml(username)}.${APP_HOST} reservation has lapsed</h1>
    <p>Its paid window ended and hasn't been renewed yet.</p>
    <p><a href="https://${APP_HOST}/manage.html">Renew at ${APP_HOST}/manage →</a></p>
  </div>
</body></html>`;
}

// Whether a record's payment currently covers *right now* — records
// with no paidUntil at all (older records, lifetime promos) are
// treated as always-active, matching how the showcase's `starred`
// flag and the editor's publish-fee check already read this field.
// Deliberately computed on read rather than written back on expiry:
// this runs on every visitor request, and flipping stored `paid` to
// false here would mean a KV write per pageview.
function isPaidActive(record) {
  return !!(record && record.paid && (!record.paidUntil || new Date(record.paidUntil).getTime() > Date.now()));
}

// ── "Support the project" one-off donation pricing ─────────────────
// This is a completely separate price ladder from the domain-only
// reservation's linear ₱199-₱599 formula above — it prices the
// "Active Job Hunter" badge + Recruiter Password Lock bundle on an
// already-free portfolio. Two currency tracks, both anchored at 1/3/
// 6/12 months and both snapped to a friendly .49/.99 ending — USD is
// priced noticeably higher than a straight PHP conversion (not just
// FX, a deliberate "international/inflation" markup), while PHP stays
// inside a fixed ₱99-₱999 band no matter the duration picked.
const SUPPORT_ANCHORS_PHP = { 1: 99, 3: 249, 6: 499, 12: 999 };
const SUPPORT_ANCHORS_USD = { 1: 4.99, 3: 11.49, 6: 24.99, 12: 49.99 };
const SUPPORT_MAX_MONTHS = 12;

// Rounds a raw interpolated amount to the nearest clean .49/.99
// ending — e.g. 17.10 -> 17.49 (not 16.99, since that's further away),
// 21.80 -> 21.99. Keeps every in-between month count (4, 9, ...) on a
// psychologically "friendly" price instead of an odd interpolated
// decimal, for both currencies (PHP just happens to always want the
// whole-number-ish .99 in practice since anchors are whole pesos).
function snapToFriendlyPrice(raw) {
  const base = Math.floor(raw);
  const candidates = [base - 1 + 0.49, base - 1 + 0.99, base + 0.49, base + 0.99];
  let best = candidates[0];
  let bestDiff = Math.abs(raw - best);
  for (const c of candidates) {
    if (c <= 0) continue;
    const diff = Math.abs(raw - c);
    if (diff < bestDiff) { best = c; bestDiff = diff; }
  }
  return Math.max(best, 0.49);
}

// Piecewise-linear interpolation between the nearest two anchor
// points (1/3/6/12), then snapped to .49/.99. Clamped to the
// currency's stated min/max regardless of interpolation drift.
function supportPriceForMonths(months, currency) {
  const m = Math.min(Math.max(Number(months) || 1, 1), SUPPORT_MAX_MONTHS);
  const anchors = currency === 'USD' ? SUPPORT_ANCHORS_USD : SUPPORT_ANCHORS_PHP;
  const points = [1, 3, 6, 12];
  let lo = 1, hi = 12;
  for (let i = 0; i < points.length - 1; i++) {
    if (m >= points[i] && m <= points[i + 1]) { lo = points[i]; hi = points[i + 1]; break; }
  }
  const t = hi === lo ? 0 : (m - lo) / (hi - lo);
  const raw = anchors[lo] + (anchors[hi] - anchors[lo]) * t;
  const snapped = snapToFriendlyPrice(raw);
  const min = currency === 'USD' ? SUPPORT_ANCHORS_USD[1] : SUPPORT_ANCHORS_PHP[1];
  const max = currency === 'USD' ? SUPPORT_ANCHORS_USD[12] : SUPPORT_ANCHORS_PHP[12];
  return Math.min(Math.max(snapped, min), max);
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
      return serveSite(username, env, url.pathname + url.search);
    }

    // Apex + non-API path should never reach this Worker if routes are
    // configured as documented (only /api/* is routed at the apex).
    // Kept as a defensive fallback rather than a hard crash.
    return new Response('Not found', { status: 404 });
  }
};

// Fetches an owner's external page (Carrd, Gumroad, a Vercel app, etc.)
// and serves its content directly, so the browser's address bar keeps
// showing username.proves.work instead of jumping to the other host —
// this is a mask/proxy, not a redirect.
//
// `pathAndQuery` is whatever the visitor actually requested on our
// domain (e.g. "/about?ref=x") — for anything other than the root, we
// ask the target site for that same path, so internal pages like
// /about or /pricing keep working instead of every URL just re-showing
// the target's homepage.
//
// Internal links (<a>, <form action>, ...) that point back at the
// target's own site are rewritten to same-path relative URLs, so
// clicking around the target site keeps the visitor on our domain and
// re-triggers this same proxy for the next page. Asset URLs (images,
// stylesheets, scripts, fonts, iframes) are instead rewritten to full
// absolute URLs on the *real* host — there's no benefit to masking a
// resource fetch, and letting the browser load those directly is
// faster and avoids proxying binary content through here at all.
async function proxyRedirectTarget(redirectUrl, pathAndQuery) {
  let targetOrigin;
  try {
    targetOrigin = new URL(redirectUrl).origin;
  } catch {
    return new Response('This address is not configured correctly.', {
      status: 502,
      headers: { 'content-type': 'text/plain;charset=UTF-8' }
    });
  }

  // The root path reuses whatever the owner actually pasted (which may
  // itself include a path/query, e.g. a specific landing page) — any
  // other path is resolved fresh against the target's origin.
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
      status: 502,
      headers: { 'content-type': 'text/plain;charset=UTF-8' }
    });
  }

  const contentType = upstream.headers.get('content-type') || '';
  const finalUrl = upstream.url || targetPageUrl; // after any upstream redirects

  // Only HTML gets rewritten — a visitor landing directly on a
  // non-HTML path (an image someone linked straight to, etc.) just
  // streams through untouched.
  if (!contentType.includes('text/html')) {
    const headers = new Headers(upstream.headers);
    headers.delete('x-frame-options');
    headers.delete('content-security-policy');
    headers.set('cache-control', 'public, max-age=10, must-revalidate');
    return new Response(upstream.body, { status: upstream.status, headers });
  }

  // Resolves a possibly-relative attribute value against the page we
  // actually fetched, so both root-relative ("/about") and
  // page-relative ("../img.png") links come out as full, correct URLs
  // no matter how deep the target's own URL structure goes.
  function resolve(value) {
    try { return new URL(value, finalUrl); } catch { return null; }
  }

  class LinkAttrRewriter {
    constructor(attr) { this.attr = attr; }
    element(el) {
      const value = el.getAttribute(this.attr);
      if (!value || value.startsWith('#') || value.startsWith('mailto:') || value.startsWith('tel:') || value.startsWith('javascript:')) return;
      const resolved = resolve(value);
      if (!resolved) return;
      // Same site as the target → keep the visitor on our domain by
      // rewriting to a same-path relative URL; a different site →
      // leave it as a normal absolute link to wherever it really goes.
      if (resolved.origin === targetOrigin) {
        el.setAttribute(this.attr, resolved.pathname + resolved.search + resolved.hash);
      } else {
        el.setAttribute(this.attr, resolved.toString());
      }
    }
  }

  class AssetAttrRewriter {
    constructor(attr) { this.attr = attr; }
    element(el) {
      const value = el.getAttribute(this.attr);
      if (!value || value.startsWith('data:') || value.startsWith('#')) return;
      const resolved = resolve(value);
      if (resolved) el.setAttribute(this.attr, resolved.toString());
    }
  }

  // srcset holds one-or-more "<url> <descriptor>" pairs — rewrite just
  // the URL part of each.
  class SrcsetRewriter {
    element(el) {
      const value = el.getAttribute('srcset');
      if (!value) return;
      const rewritten = value.split(',').map(part => {
        const trimmed = part.trim();
        const spaceIdx = trimmed.indexOf(' ');
        const url = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
        const descriptor = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx);
        const resolved = resolve(url);
        return (resolved ? resolved.toString() : url) + descriptor;
      }).join(', ');
      el.setAttribute('srcset', rewritten);
    }
  }

  const rewriter = new HTMLRewriter()
    .on('a[href]', new LinkAttrRewriter('href'))
    .on('area[href]', new LinkAttrRewriter('href'))
    .on('form[action]', new LinkAttrRewriter('action'))
    .on('img[src]', new AssetAttrRewriter('src'))
    .on('img[srcset]', new SrcsetRewriter())
    .on('source[src]', new AssetAttrRewriter('src'))
    .on('source[srcset]', new SrcsetRewriter())
    .on('link[href]', new AssetAttrRewriter('href'))
    .on('script[src]', new AssetAttrRewriter('src'))
    .on('video[src]', new AssetAttrRewriter('src'))
    .on('video[poster]', new AssetAttrRewriter('poster'))
    .on('audio[src]', new AssetAttrRewriter('src'))
    .on('iframe[src]', new AssetAttrRewriter('src'));

  const rewritten = rewriter.transform(new Response(upstream.body, upstream));

  const headers = new Headers();
  headers.set('content-type', 'text/html;charset=UTF-8');
  // Short cache only — changing the redirect target from /manage
  // should show up within seconds, same as a normal republish.
  headers.set('cache-control', 'public, max-age=10, must-revalidate');

  return new Response(rewritten.body, { status: upstream.status, headers });
}

async function serveSite(username, env, pathAndQuery) {
  if (!USERNAME_RE.test(username) || RESERVED.has(username)) {
    return new Response(notFoundPage(username), { status: 404, headers: { 'content-type': 'text/html;charset=UTF-8' } });
  }

  const record = await env.SITES.get(`site:${username}`, 'json');
  if (!record || record.status === 'deleted') {
    return new Response(notFoundPage(username), { status: 404, headers: { 'content-type': 'text/html;charset=UTF-8' } });
  }

  // Not public until an admin has manually approved it — pending and
  // rejected sites never serve their real HTML to visitors. Records
  // saved before this status field existed have no `status` at all;
  // treat those as already-live so old published sites don't vanish.
  const status = record.status || 'live';
  if (status !== 'live') {
    return new Response(pendingPage(username), { status: 200, headers: { 'content-type': 'text/html;charset=UTF-8' } });
  }

  // A domain-only reservation whose owner has pointed it at an
  // existing page elsewhere (Carrd, Gumroad, Vercel, etc.) serves
  // that page's content right here at username.proves.work — the
  // address bar never changes to the other host, unlike a normal
  // redirect. Gated on the payment still being *currently* active
  // (not just having been paid once), so a lapsed reservation stops
  // masking/redirecting until it's renewed.
  if (record.kind === 'domain') {
    if (!isPaidActive(record)) {
      return new Response(expiredDomainPage(username), { status: 200, headers: { 'content-type': 'text/html;charset=UTF-8' } });
    }
    if (record.redirectUrl) {
      return proxyRedirectTarget(record.redirectUrl, pathAndQuery || '/');
    }
    return new Response(domainReservedPage(username), { status: 200, headers: { 'content-type': 'text/html;charset=UTF-8' } });
  }

  // Portfolio hosting itself is free — every approved portfolio gets
  // its live username.proves.work address regardless of payment
  // status. `isPaidActive` still gates the "Active Job Hunter" badge
  // (see the showcase/tier logic below) and the Recruiter Password
  // Lock, but never the hosting itself. (Domain-only reservations
  // above are a different product and keep their own paywall — you
  // don't get an address there without paying, since there's no
  // portfolio underneath it.)
  const liveHtml = record.liveHtml || record.html;
  const lockActive = isPaidActive(record) && !!(record.passwordLock && record.passwordLock.hash);

  // Bake whether the Recruiter Password Lock currently applies into
  // the served page, computed fresh on every request rather than at
  // publish time — this is what lets the lock silently stop
  // enforcing the moment a Support period lapses (or start enforcing
  // again on renewal) without the owner needing to republish. The
  // editor's template reads this global to decide whether to show the
  // lock overlay over the Verifiable Proof section. Unlike before,
  // the salted hash itself is never included here — a guess is
  // checked by calling /api/lock/verify instead, so nothing worth
  // brute-forcing ever sits in this page's source.
  const withLockFlag = liveHtml.includes('</head>')
    ? liveHtml.replace('</head>', `<script>window.__PW_LOCK_ACTIVE__=${lockActive};</script></head>`)
    : `<script>window.__PW_LOCK_ACTIVE__=${lockActive};</script>` + liveHtml;

  // Serve the last *approved* snapshot (liveHtml) when we have one —
  // record.html may be a newer, not-yet-approved draft that was
  // uploaded after this site went live (edits don't go public until
  // re-approved). Records saved before liveHtml existed fall back to
  // record.html so old published sites keep working.
  return new Response(withLockFlag, {
    status: 200,
    headers: {
      'content-type': 'text/html;charset=UTF-8',
      // Short cache: republishing should show up within seconds, not
      // be stuck behind a stale browser/edge cache for a full minute.
      // (KV writes themselves can still take up to ~60s to propagate
      // globally — that floor isn't controllable via headers.)
      'cache-control': 'public, max-age=10, must-revalidate'
    }
  });
}

// Must match GOOGLE_CLIENT_ID in editor.js / admin.js exactly.
const GOOGLE_CLIENT_ID = '41010460965-oti1phnr8kdbij312qijrg82bc2japj7.apps.googleusercontent.com';

// Only this account can approve/reject/restore sites from the admin
// dashboard. Add more addresses here if more admins are needed.
const ADMIN_EMAILS = new Set(['snylumagbas@gmail.com']);

// Destination for the public "Contact" form on the marketing site.
// Lives only here, server-side — the client only ever calls
// POST /api/contact and never sees this address.
const CONTACT_TO_EMAIL = 'snylumagbas@gmail.com';
const CONTACT_MAX_PER_IP = 5;
const CONTACT_IP_WINDOW_SECONDS = 60 * 60; // 5 messages / hour / IP

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

// Same verification, but also requires the email to be on the admin
// allowlist. Used to gate every /api/admin/* route.
async function verifyAdminCredential(credential) {
  const email = await verifyGoogleCredential(credential);
  if (!email || !ADMIN_EMAILS.has(email)) return null;
  return email;
}

async function handleApi(request, env, url) {
  // POST (not GET) so an optional Google credential can travel in the
  // body instead of the URL/query string — same pattern as every other
  // credential-carrying call in this file, and keeps a live ID token
  // out of server/proxy access logs.
  //
  // Ownership here is checked *server-side* against the record's real
  // ownerEmail, not just inferred from whatever the browser has
  // cached locally. That distinction matters after a restore: soft-
  // deleting then restoring a site never touches ownerEmail, but the
  // editor's local "is this my username" cache can easily be stale or
  // absent (cleared because the name looked free mid-deletion, a
  // different browser/device, cleared storage, etc.) — without a real
  // check here, the original owner would see "already taken" and be
  // unable to publish to their own restored address.
  if (url.pathname === '/api/check-username' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ available: false, reason: 'invalid' }, 400); }
    const username = String(body.username || '').toLowerCase().trim();
    if (!USERNAME_RE.test(username) || RESERVED.has(username)) {
      return json({ available: false, reason: 'invalid' });
    }
    const existing = await env.SITES.get(`site:${username}`, 'json');
    // A soft-deleted record (status: 'deleted') no longer occupies the
    // username — it's kept around only so an admin can hard-delete or
    // restore it, not to squat the name forever.
    const isFree = !existing || existing.status === 'deleted';
    if (isFree) return json({ available: true });

    const requesterEmail = await verifyGoogleCredential(body.googleCredential);
    const ownedByYou = !!requesterEmail && !!existing.ownerEmail && requesterEmail === existing.ownerEmail;
    return json({ available: false, ownedByYou });
  }

  // ── Public "Contact" form (marketing site) ──────────────────────
  // Delivers straight to CONTACT_TO_EMAIL via Resend. That address
  // (and the API key) live only in this Worker — the client only ever
  // POSTs {name, email, message} to this route and gets back {ok},
  // never the destination address itself.
  if (url.pathname === '/api/contact' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }

    // Honeypot field: real visitors never fill in a field that's
    // hidden via CSS, so anything here means it's a bot. Pretend
    // success so the bot doesn't learn to work around it.
    if (body.company) return json({ ok: true });

    const name = String(body.name || '').trim().slice(0, 120);
    const fromEmail = String(body.email || '').trim().slice(0, 200);
    const message = String(body.message || '').trim().slice(0, 5000);
    if (!message) return json({ ok: false, error: 'Message is required.' }, 400);
    if (fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
      return json({ ok: false, error: 'That email address looks invalid.' }, 400);
    }

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const rateOk = await checkAndBumpRateLimit(env, `contactrl:ip:${ip}`, CONTACT_MAX_PER_IP, CONTACT_IP_WINDOW_SECONDS);
    if (!rateOk) {
      return json({ ok: false, error: 'Too many messages sent. Please try again later.' }, 429);
    }

    const record = {
      name: name || '(no name given)',
      email: fromEmail || '(no email given)',
      message,
      ip,
      createdAt: new Date().toISOString()
    };

    let delivered = false;
    if (env.RESEND_API_KEY) {
      try {
        const sendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'proves.work contact form <contact@proves.work>',
            to: [CONTACT_TO_EMAIL],
            reply_to: fromEmail || undefined,
            subject: `New contact form message from ${name || 'a visitor'}`,
            text: `From: ${name || '(no name given)'} <${fromEmail || 'no email given'}>\nIP: ${ip}\n\n${message}`
          })
        });
        delivered = sendRes.ok;
      } catch {
        delivered = false;
      }
    }

    // Always keep a copy in KV — either as the only record (if no
    // RESEND_API_KEY is configured yet) or as a safety net if the send
    // above failed, so a message is never silently lost.
    if (!delivered) {
      await env.SITES.put(`contact:${Date.now()}:${crypto.randomUUID()}`, JSON.stringify(record), {
        expirationTtl: 60 * 60 * 24 * 180 // 180 days
      });
    }

    return json({ ok: true });
  }


  // free tier, no external API key. Résumé text is sent for this one
  // request only; nothing is stored server-side.
  if (url.pathname === '/api/ai/resume-check' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid JSON body.' }, 400);
    }
    const resumeText = (body.resumeText || '').slice(0, 8000);
    if (!resumeText.trim()) return json({ ok: false, error: 'resumeText is required.' }, 400);

    const prompt = `You are an ATS (applicant tracking system) and résumé-writing expert. Review the résumé text below.

Respond with ONLY a JSON object, no markdown fences, no preamble, in exactly this shape:
{"score": <integer 1-100>, "verdict": "<short phrase, e.g. 'Strong résumé'>", "issues": ["<concrete problem>", ...], "improvements": ["<concrete suggestion>", ...]}

Score based on: ATS-readability, presence of contact info/headline, strong action-verb bullets, quantified impact (numbers/%/$), concise bullet length, and a solid skills section. List at most 6 issues and 6 improvements, each one sentence.

RÉSUMÉ TEXT:
"""
${resumeText}
"""`;

    try {
      const aiResult = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800
      });
      const parsed = parseAIJson(aiResult.response);
      if (!parsed) return json({ ok: false, error: 'AI returned an unparseable response.' }, 502);
      return json({ ok: true, ...parsed });
    } catch (err) {
      return json({ ok: false, error: 'AI request failed.' }, 502);
    }
  }

  // ── AI: tailor résumé to a pasted job posting ──────────────────
  if (url.pathname === '/api/ai/tailor-resume' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid JSON body.' }, 400);
    }
    const resumeText = (body.resumeText || '').slice(0, 8000);
    const postingText = (body.postingText || '').slice(0, 8000);
    if (!resumeText.trim() || !postingText.trim()) {
      return json({ ok: false, error: 'resumeText and postingText are both required.' }, 400);
    }

    const prompt = `You are a career coach helping someone tailor their résumé to a specific job posting.

Respond with ONLY a JSON object, no markdown fences, no preamble, in exactly this shape:
{"score": <integer 0-100, how well the résumé currently matches the posting>, "verdict": "<short phrase>", "missingKeywords": ["<important term from the posting that's absent or weak in the résumé>", ...], "emphasize": ["<résumé bullet, quoted close to verbatim, that already aligns well with the posting and should be kept/emphasized>", ...], "suggestions": ["<concrete rewrite or wording suggestion tying a résumé bullet to the posting's language>", ...]}

List at most 10 missingKeywords, 6 emphasize items, and 6 suggestions.

JOB POSTING:
"""
${postingText}
"""

RÉSUMÉ TEXT:
"""
${resumeText}
"""`;

    try {
      const aiResult = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 900
      });
      const parsed = parseAIJson(aiResult.response);
      if (!parsed) return json({ ok: false, error: 'AI returned an unparseable response.' }, 502);
      return json({ ok: true, ...parsed });
    } catch (err) {
      return json({ ok: false, error: 'AI request failed.' }, 502);
    }
  }

  // ── Domain-only reservation (no portfolio) ────────────────────
  // Lets someone pay a flat yearly fee for just the address itself —
  // <username>.proves.work — with no site attached yet, marketed on
  // the homepage as a cheaper alternative to buying a whole domain
  // elsewhere. This is deliberately built on the exact same `site:`
  // record + status machine as a real portfolio publish: it lands as
  // 'pending', an admin reviews and approves it from /admin exactly
  // like any other submission (so nothing goes live unattended), and
  // once approved the wildcard routing that already serves every
  // *.proves.work subdomain just works — no separate DNS/Cloudflare
  // registration step is needed, since the zone's wildcard record
  // already covers it.
  if (url.pathname === '/api/domain/claim' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid JSON body.' }, 400);
    }

    const username = String(body.username || '').toLowerCase().trim();
    const ownerEmail = await verifyGoogleCredential(body.googleCredential);

    // Same trust boundary as /api/publish — a real address needs a
    // real, verified account behind it so it can be billed, disputed,
    // or recovered later.
    if (!ownerEmail) {
      return json({ ok: false, error: 'Sign in with Google to reserve a proves.work address.' }, 401);
    }
    if (!USERNAME_RE.test(username) || RESERVED.has(username)) {
      return json({ ok: false, error: 'Name must be 3-30 lowercase letters, numbers, or hyphens.' }, 400);
    }

    const existing = await env.SITES.get(`site:${username}`, 'json');
    if (existing && existing.status !== 'deleted') {
      return json({ ok: false, error: 'That name is already taken.' }, 409);
    }

    // Scaling one-time price: ₱199 for 1 month up to ₱599 for the max 12
    // months (cheaper per month the longer you lock in). Requested months
    // and the client-computed amount are recorded as what the person
    // asked for; recomputing the amount server-side (rather than trusting
    // the client figure outright) keeps a mismatched/tampered amount from
    // sticking — the admin still confirms actual payment by hand before
    // anything goes live.
    const requestedMonths = Math.min(Math.max(Number(body.months) || 1, 1), 12);
    const expectedAmount = Math.round(199 + (599 - 199) * (requestedMonths - 1) / 11);

    // A buyer can optionally paste their payment reference number right
    // away if they've already paid against the QR shown in the claim
    // modal; they can also add/change it later via /manage using
    // /api/domain/submit-proof. Either way this is only ever the
    // buyer's own claim of proof — an admin still confirms the actual
    // payment by hand (set-paid) before anything goes live.
    const buyerReferenceNumber = String(body.referenceNumber || '').trim().slice(0, 120);

    await env.SITES.put(`site:${username}`, JSON.stringify({
      kind: 'domain', // distinguishes a name-only reservation from a real portfolio ('kind' absent/'site') in the admin dashboard
      ownerEmail,
      html: domainReservedPage(username),
      liveHtml: null,
      status: 'pending',
      paid: false,
      redirectUrl: '',
      requestedMonths,
      requestedAmount: expectedAmount,
      buyerReferenceNumber,
      buyerReferenceSubmittedAt: buyerReferenceNumber ? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    return json({ ok: true, status: 'pending', url: `https://${username}.${APP_HOST}` });
  }

  // Lets a buyer submit (or update) their payment reference number after
  // the fact — e.g. they closed the claim modal before paying, or paid
  // via a different reference than the one they first typed. Purely a
  // claim from the buyer's side; an admin still has to manually confirm
  // the real payment (see /api/admin/set-paid) before anything changes
  // for the site itself.
  if (url.pathname === '/api/domain/submit-proof' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
    const ownerEmail = await verifyGoogleCredential(body.googleCredential);
    if (!ownerEmail) return json({ ok: false, error: 'Sign in with Google first.' }, 401);

    const username = String(body.username || '').toLowerCase().trim();
    const referenceNumber = String(body.referenceNumber || '').trim().slice(0, 120);
    if (!referenceNumber) return json({ ok: false, error: 'Enter a reference number.' }, 400);

    const existing = await env.SITES.get(`site:${username}`, 'json');
    if (!existing) return json({ ok: false, error: 'Not found.' }, 404);
    if (existing.ownerEmail !== ownerEmail) {
      return json({ ok: false, error: 'Not authorized — sign in with the account that reserved this address.' }, 403);
    }

    await env.SITES.put(`site:${username}`, JSON.stringify({
      ...existing,
      buyerReferenceNumber: referenceNumber,
      buyerReferenceSubmittedAt: new Date().toISOString()
    }));
    return json({ ok: true });
  }

  // ── Support the project (Active Job Hunter + Password Lock) ────
  // Lets the owner of an already-published (and already free) portfolio
  // record a one-off "donation" request to unlock the Active Job
  // Hunter badge and the Recruiter Password Lock for a chosen number
  // of months. This never touches whether the portfolio is hosted —
  // that's unconditionally free — it only ever sets paid/paidUntil,
  // exactly like a domain reservation's payment does. Same trust
  // model throughout this file: the amount is recomputed server-side
  // from the requested months/currency (never trusted from the
  // client), and nothing actually goes live until an admin manually
  // confirms the reference number via /api/admin/set-paid.
  if (url.pathname === '/api/support/claim' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }

    const username = String(body.username || '').toLowerCase().trim();
    const ownerEmail = await verifyGoogleCredential(body.googleCredential);
    if (!ownerEmail) return json({ ok: false, error: 'Sign in with Google first.' }, 401);

    const existing = await env.SITES.get(`site:${username}`, 'json');
    if (!existing || existing.status === 'deleted') return json({ ok: false, error: 'Not found.' }, 404);
    if (existing.ownerEmail !== ownerEmail) {
      return json({ ok: false, error: 'Not authorized — sign in with the account that published this address.' }, 403);
    }
    if (existing.kind === 'domain') {
      return json({ ok: false, error: 'Domain-only reservations use the reservation slider, not this one.' }, 400);
    }

    const currency = body.currency === 'USD' ? 'USD' : 'PHP';
    const requestedMonths = Math.min(Math.max(Number(body.months) || 1, 1), SUPPORT_MAX_MONTHS);
    const expectedAmount = supportPriceForMonths(requestedMonths, currency);
    const buyerReferenceNumber = String(body.referenceNumber || '').trim().slice(0, 120);

    await env.SITES.put(`site:${username}`, JSON.stringify({
      ...existing,
      requestedMonths,
      requestedAmount: expectedAmount,
      requestedCurrency: currency,
      buyerReferenceNumber: buyerReferenceNumber || existing.buyerReferenceNumber || '',
      buyerReferenceSubmittedAt: buyerReferenceNumber ? new Date().toISOString() : (existing.buyerReferenceSubmittedAt || null),
      updatedAt: new Date().toISOString()
    }));

    return json({ ok: true, amount: expectedAmount, currency });
  }

  // Lets a signed-in owner see every proves.work address tied to their
  // account (domain-only reservations and full portfolios alike) for
  // the /manage page — their payment status, and the redirect target
  // if they've set one.
  if (url.pathname === '/api/domain/my-sites' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
    const ownerEmail = await verifyGoogleCredential(body.googleCredential);
    if (!ownerEmail) return json({ ok: false, error: 'Sign in with Google first.' }, 401);

    const list = await env.SITES.list({ prefix: 'site:' });
    const sites = await Promise.all(list.keys.map(async (k) => {
      const record = await env.SITES.get(k.name, 'json');
      if (!record || record.status === 'deleted' || record.ownerEmail !== ownerEmail) return null;
      return {
        username: k.name.slice('site:'.length),
        kind: record.kind || 'site',
        status: record.status || 'live',
        paid: !!record.paid,
        paidUntil: record.paidUntil || null,
        requestedAmount: record.requestedAmount || null,
        requestedMonths: record.requestedMonths || null,
        requestedCurrency: record.requestedCurrency || 'PHP',
        redirectUrl: record.redirectUrl || '',
        buyerReferenceNumber: record.buyerReferenceNumber || '',
        hasPasswordLock: !!(record.passwordLock && record.passwordLock.hash)
      };
    }));
    return json({ ok: true, sites: sites.filter(Boolean) }, 200, { 'cache-control': 'no-store' });
  }

  // Lets a signed-in owner point their address at an existing page
  // elsewhere (username.carrd.co, username.gumroad.com, a Vercel app,
  // etc.) instead of/until they build a portfolio here. Deliberately
  // not gated behind a second admin review the way a portfolio publish
  // is — an admin already reviews and confirms the *purchase itself*
  // (see /api/admin/set-paid); this just lets the owner change where
  // an already-paid-for address points, any time, without waiting on
  // someone to click Approve again. It's still gated on `paid`, though:
  // an unconfirmed reservation can't redirect anywhere yet.
  if (url.pathname === '/api/domain/set-redirect' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
    const ownerEmail = await verifyGoogleCredential(body.googleCredential);
    if (!ownerEmail) return json({ ok: false, error: 'Sign in with Google first.' }, 401);

    const username = String(body.username || '').toLowerCase().trim();
    const rawUrl = String(body.redirectUrl || '').trim();

    const existing = await env.SITES.get(`site:${username}`, 'json');
    if (!existing) return json({ ok: false, error: 'Not found.' }, 404);
    if (existing.ownerEmail !== ownerEmail) {
      return json({ ok: false, error: 'Not authorized — sign in with the account that reserved this address.' }, 403);
    }
    if (!existing.paid) {
      return json({ ok: false, error: "Payment hasn't been confirmed yet — an admin needs to verify it first." }, 403);
    }

    // Clearing the field (empty string) is allowed — it just turns the
    // redirect off and falls back to the placeholder "reserved" page.
    let redirectUrl = '';
    if (rawUrl) {
      let parsed;
      try { parsed = new URL(rawUrl); } catch { parsed = null; }
      if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
        return json({ ok: false, error: 'Enter a full URL starting with https://' }, 400);
      }
      redirectUrl = parsed.toString();
    }

    await env.SITES.put(`site:${username}`, JSON.stringify({
      ...existing,
      redirectUrl,
      redirectUpdatedAt: new Date().toISOString()
    }));
    return json({ ok: true, redirectUrl });
  }

  // Lets the editor show "Draft / Pending approval / Live / Rejected"
  // on the /editor toolbar for the site the current browser has
  // published (or attempted to publish). Public/unauthenticated —
  // it only ever returns a status string, never the HTML itself.
  if (url.pathname === '/api/site-status' && request.method === 'GET') {
    const username = (url.searchParams.get('u') || '').toLowerCase().trim();
    if (!USERNAME_RE.test(username)) return json({ status: 'draft' });
    const record = await env.SITES.get(`site:${username}`, 'json');
    if (!record || record.status === 'deleted') return json({ status: 'draft' });
    return json({
      status: record.status || 'live',
      updatedAt: record.updatedAt || null,
      // Lets the editor show a "paid until / countdown" readout without
      // needing an admin session — this is just a yes/no + a date, not
      // anything sensitive.
      paid: !!record.paid,
      paidAt: record.paidAt || null,
      paidUntil: record.paidUntil || null,
      paidDurationMonths: record.paidDurationMonths || null
    });
  }

  // Public showcase feed — every live *portfolio* (not a domain-only
  // reservation, which has no site to show) gets listed here for the
  // /showcase.html grid. No auth needed: this only ever exposes what's
  // already publicly live at username.proves.work anyway. Active Job Hunter
  // sites that are still within their paid window get flagged 'starred'
  // so the showcase can list them first — everyone else shows as 'free'.
  // The <title>/meta-description content embedded in a published page
  // is already HTML-escaped (correctly, since it's HTML). Pulling it
  // out with a regex gives back that escaped text as-is — e.g. a
  // literal "&amp;" substring, not a "&" character. The showcase page
  // then runs its own esc() over whatever this API returns to safely
  // inject it into the DOM, which would double-escape "&amp;" into
  // "&amp;amp;" (rendering as the literal text "&amp;" on screen)
  // unless we decode back to real characters first. Covers the small,
  // fixed set of entities editor.js's own esc() can actually produce.
  const decodeHtmlEntities = (str) => String(str || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');

  if (url.pathname === '/api/showcase' && request.method === 'GET') {
    const list = await env.SITES.list({ prefix: 'site:' });
    const now = Date.now();
    const sites = await Promise.all(list.keys.map(async (k) => {
      const record = await env.SITES.get(k.name, 'json');
      if (!record || record.status !== 'live' || record.kind === 'domain' || !record.liveHtml) return null;
      const starred = !!record.paid && (!record.paidUntil || new Date(record.paidUntil).getTime() > now);
      // Pull a human-readable title/description out of the published
      // HTML itself, since portfolios don't have separate structured
      // metadata — falls back to the username if <title> is missing.
      const titleMatch = record.liveHtml.match(/<title>([^<]*)<\/title>/i);
      const descMatch = record.liveHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
      return {
        username: k.name.slice('site:'.length),
        title: (titleMatch && decodeHtmlEntities(titleMatch[1].trim())) || k.name.slice('site:'.length),
        description: (descMatch && decodeHtmlEntities(descMatch[1].trim())) || '',
        tier: starred ? 'starred' : 'free',
        updatedAt: record.updatedAt || null
      };
    }));
    const filtered = sites.filter(Boolean);
    // Starred (Active Job Hunter) portfolios first, most-recently-updated
    // within each group after that.
    filtered.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier === 'starred' ? -1 : 1;
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });
    // Deliberately uncached: an admin marking a site paid should be
    // reflected the very next time this loads, not stuck behind a
    // stale browser/edge/CDN cache — this list changes on every
    // payment/approval, so nothing here should ever be cached.
    return json({ ok: true, sites: filtered }, 200, { 'cache-control': 'no-store' });
  }

  // Serves this site's Verifiable Proof content (photos/links/labels
  // that used to sit directly in the public HTML — see collectProof
  // in editor.js). Two paths:
  //   - No lock active on the site: proof is returned immediately,
  //     no guess needed — matches the pre-lock-feature behavior where
  //     proof was always just part of the public page.
  //   - Lock active: a `guess` is required and checked server-side
  //     against the salted PBKDF2 hash, rate-limited the same way the
  //     old /api/lock/verify was, before any proof content is
  //     returned.
  if (url.pathname === '/api/site/proof' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid JSON body.' }, 400);
    }

    const username = String(body.username || '').toLowerCase().trim();
    if (!USERNAME_RE.test(username)) {
      return json({ ok: false, error: 'Missing username.' }, 400);
    }

    const record = await env.SITES.get(`site:${username}`, 'json');
    if (!record || record.status !== 'live') {
      return json({ ok: false, error: 'Not found.' }, 404);
    }
    const liveProofPointers = record.liveProofItems || {};
    const lockActive = isPaidActive(record) && !!(record.passwordLock && record.passwordLock.hash);

    if (!lockActive) {
      const liveProof = await hydrateProofItems(env, username, liveProofPointers);
      return json({ ok: true, proof: liveProof }, 200, { 'cache-control': 'public, max-age=10, must-revalidate' });
    }

    const guess = typeof body.guess === 'string' ? body.guess.slice(0, 200) : '';
    if (!guess) {
      return json({ ok: false, error: 'Locked.' }, 401);
    }

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';

    // Rate-limit BEFORE doing the (deliberately slow) hash work, so a
    // flood of guesses can't be used to burn CPU/time even when every
    // guess is wrong. Site-wide ceiling checked first since it's the
    // one attacker can't route around by spoofing/rotating IPs alone.
    const siteOk = await checkAndBumpRateLimit(env, `lockrl:site:${username}`, LOCK_MAX_ATTEMPTS_PER_SITE, LOCK_SITE_WINDOW_SECONDS);
    if (!siteOk) {
      return json({ ok: false, error: 'Too many attempts on this portfolio. Try again later.' }, 429);
    }
    const ipOk = await checkAndBumpRateLimit(env, `lockrl:ip:${ip}:${username}`, LOCK_MAX_ATTEMPTS_PER_IP, LOCK_IP_WINDOW_SECONDS);
    if (!ipOk) {
      return json({ ok: false, error: 'Too many attempts. Try again in a while.' }, 429);
    }

    const { salt, hash, iter } = record.passwordLock;
    const guessHash = await pbkdf2Hash(guess, salt, iter || PBKDF2_ITERATIONS);
    const correct = safeEqual(guessHash, hash);
    if (!correct) {
      return json({ ok: false, error: 'Incorrect key.' }, 401);
    }
    const liveProof = await hydrateProofItems(env, username, liveProofPointers);
    return json({ ok: true, proof: liveProof }, 200, { 'cache-control': 'no-store' });
  }

  // Kept as a thin wrapper around /api/site/proof for a pass/fail
  // check with no proof content in the response — some callers just
  // want to know "was that guess right" without also fetching every
  // proof item (e.g. re-verifying to keep a session alive).
  if (url.pathname === '/api/lock/verify' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid JSON body.' }, 400);
    }

    const username = String(body.username || '').toLowerCase().trim();
    const guess = typeof body.guess === 'string' ? body.guess.slice(0, 200) : '';
    if (!USERNAME_RE.test(username) || !guess) {
      return json({ ok: false, error: 'Missing username or key.' }, 400);
    }

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';

    const siteOk = await checkAndBumpRateLimit(env, `lockrl:site:${username}`, LOCK_MAX_ATTEMPTS_PER_SITE, LOCK_SITE_WINDOW_SECONDS);
    if (!siteOk) {
      return json({ ok: false, error: 'Too many attempts on this portfolio. Try again later.' }, 429);
    }
    const ipOk = await checkAndBumpRateLimit(env, `lockrl:ip:${ip}:${username}`, LOCK_MAX_ATTEMPTS_PER_IP, LOCK_IP_WINDOW_SECONDS);
    if (!ipOk) {
      return json({ ok: false, error: 'Too many attempts. Try again in a while.' }, 429);
    }

    const record = await env.SITES.get(`site:${username}`, 'json');
    const lockActive = record && isPaidActive(record) && record.passwordLock && record.passwordLock.hash;
    if (!lockActive) {
      return json({ ok: false, error: 'No active lock to verify.' }, 404);
    }

    const { salt, hash, iter } = record.passwordLock;
    const guessHash = await pbkdf2Hash(guess, salt, iter || PBKDF2_ITERATIONS);
    const correct = safeEqual(guessHash, hash);

    return json({ ok: correct });
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
    const buyerReferenceNumber = String(body.buyerReferenceNumber || '').trim().slice(0, 120);
    // Real Verifiable Proof content (photos/links/labels), collected
    // client-side by collectProof and kept OUT of `html` entirely —
    // see the big comment on collectProof in editor.js. Stored here
    // as its own field so it can be served separately, gated by the
    // Recruiter Password Lock, instead of always sitting in the
    // public page's source. Validated defensively since it's
    // attacker-controlled input just like `html` is.
    // proofItems holds only small pointers ({type, photoRef|link, label})
    // — the actual photo bytes are staged in photoBlobsToWrite and land
    // in their own `proof:<username>:<id>` KV entries below, so they're
    // never inlined into (and don't multiply within) the site record.
    let proofItems = {};
    const photoBlobsToWrite = {};
    if (body.proofItems && typeof body.proofItems === 'object' && !Array.isArray(body.proofItems)) {
      for (const [id, entry] of Object.entries(body.proofItems)) {
        if (typeof id !== 'string' || id.length > 40 || !/^v[0-9]+$/.test(id)) continue;
        if (!entry || typeof entry !== 'object') continue;
        const label = typeof entry.label === 'string' ? entry.label.slice(0, 300) : '';
        if (entry.type === 'photo' && typeof entry.photo === 'string' && entry.photo.length <= 4_000_000) {
          proofItems[id] = { type: 'photo', photoRef: id, label };
          photoBlobsToWrite[id] = entry.photo;
        } else if (entry.type === 'link' && typeof entry.link === 'string' && entry.link.length <= 2000) {
          proofItems[id] = { type: 'link', link: entry.link, label };
        }
      }
    }
    // Each photo blob is its own KV value (well under the 25MB/value
    // ceiling on its own thanks to the 4MB per-photo cap above); this
    // just bounds how much one publish call can push at once.
    const totalPhotoBytes = Object.values(photoBlobsToWrite).reduce((sum, p) => sum + p.length, 0);
    if (totalPhotoBytes > 20_000_000) {
      return json({ ok: false, error: 'Too many/too large proof photos in one publish (20MB total).' }, 400);
    }
    // The owner's chosen Recruiter Password Lock key, in plaintext,
    // sent over HTTPS and hashed here with a per-site salt and 120k
    // rounds of PBKDF2-SHA256 — never stored or echoed back as
    // plaintext, and never a raw/fast digest the client could leak
    // via page source (see buildPasswordLock above). `''`/omitted
    // clears the lock. Capped at 200 chars, generous for any
    // realistic passphrase while keeping the hash call bounded.
    // Whether the lock actually *enforces* on the public page is
    // decided at request time in serveSite (see lockActive there),
    // not here.
    const passwordLockKeyRaw = typeof body.passwordLockKey === 'string' ? body.passwordLockKey.slice(0, 200) : '';
    const clearingLock = ('passwordLockKey' in body) && !passwordLockKeyRaw;
    const settingLock = ('passwordLockKey' in body) && !!passwordLockKeyRaw;
    const newPasswordLock = settingLock ? await buildPasswordLock(passwordLockKeyRaw) : null;
    // Signed in: verified Google email ties this username to an
    // account, so it can be updated later from any device by signing
    // in again. Signed out: published anonymously — same as before,
    // except there's no publish key to lose; an anonymous publish just
    // can't be reclaimed/updated except from the same site's future
    // publishes with a matching (or no) owner.
    const ownerEmail = await verifyGoogleCredential(body.googleCredential);

    // A real username.proves.work address is only ever handed out to a
    // verified Google account — anonymous publishing is no longer
    // allowed, since an unclaimed address can't be recovered, disputed,
    // or billed. The editor should already stop people before this
    // point, but this is the actual trust boundary.
    if (!ownerEmail) {
      return json({ ok: false, error: 'Sign in with Google to publish a proves.work address.' }, 401);
    }

    if (!USERNAME_RE.test(username) || RESERVED.has(username)) {
      return json({ ok: false, error: 'Username must be 3-30 lowercase letters, numbers, or hyphens.' }, 400);
    }
    // 8MB, not 2MB — the editor now downscales/recompresses every
    // uploaded photo before it ever gets embedded (see
    // readAndCompressImage in editor.js), so this ceiling should
    // rarely matter in practice. It's raised anyway to give real
    // headroom for a page carrying several gallery/verify photos, while
    // staying well under Workers KV's 25MB per-value limit.
    if (!html || html.length > 8_000_000) {
      return json({ ok: false, error: 'Missing page content, or content too large (8MB limit).' }, 400);
    }

    const existing = await env.SITES.get(`site:${username}`, 'json');
    if (existing && existing.status !== 'deleted') {
      const ownedByRequester = existing.ownerEmail && ownerEmail && existing.ownerEmail === ownerEmail;
      if (!ownedByRequester) {
        return json({ ok: false, error: 'That username is already taken.' }, 409);
      }
    }

    // First-time publishes (and re-publishes of a site that was never
    // approved, was rejected, or was unpublished) go to "pending" and
    // wait on manual admin review, same as before.
    //
    // But once a site has already been through review and is live, the
    // owner editing and republishing it is treated as an *update* to an
    // already-approved site, not a brand-new submission — it goes
    // straight back out as liveHtml with no further review, and the
    // editor shows "updated", not "submitted for review", for it.
    const wasAlreadyLive = !!existing && existing.status === 'live';
    const nextStatus = wasAlreadyLive ? 'live' : 'pending';

    // A soft-deleted record (status: 'deleted') still holds everything
    // that mattered before the delete — paid/paidUntil/payments/kind/
    // redirectUrl/etc. When the original owner republishes to reclaim
    // the same username, that history must carry forward: spread
    // `existing` first so nothing on the record is lost, then layer the
    // fields this publish actually changes on top. (Previously this
    // built a brand-new object from scratch, silently wiping `paid` —
    // so a site that had already been paid for came back from a
    // delete+republish as unpaid, showing the expired-plan page even
    // though it had a valid paidUntil before it was deleted.)
    // Write new photo blobs first so the site record (put below) never
    // ends up pointing at a photoRef that isn't in KV yet.
    await Promise.all(Object.entries(photoBlobsToWrite).map(
      ([id, data]) => env.SITES.put(proofBlobKey(username, id), data)
    ));

    await env.SITES.put(`site:${username}`, JSON.stringify({
      ...existing,
      ownerEmail: ownerEmail || (existing ? existing.ownerEmail : null) || null,
      html,
      // liveHtml stays whatever was last *approved* unless this publish
      // is itself going straight to live (see wasAlreadyLive above) — in
      // that case this draft is that new approved snapshot.
      liveHtml: wasAlreadyLive ? html : ((existing && existing.liveHtml) || null),
      proofItems,
      // Same draft-vs-approved split as liveHtml — the *served*
      // Verifiable Proof content only ever moves forward once this
      // publish has actually gone live, so an unapproved edit can't
      // leak new proof content early via /api/site/proof.
      liveProofItems: wasAlreadyLive ? proofItems : ((existing && existing.liveProofItems) || {}),
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      createdAt: (existing && existing.createdAt) || new Date().toISOString(),
      // A republish always resurrects a soft-deleted record back into
      // real use, so it shouldn't still read as deleted-at-some-point.
      deletedAt: null,
      // Same idea as the domain flow's buyerReferenceNumber: the
      // buyer's own claim of having paid, purely for an admin to match
      // against the QR payment before calling /api/admin/set-paid.
      // Never overwrites an existing one with a blank resubmission.
      buyerReferenceNumber: buyerReferenceNumber || (existing && existing.buyerReferenceNumber) || '',
      // 'passwordLockKey' in body distinguishes "the editor explicitly
      // sent an updated lock state this publish" from "this field
      // wasn't part of the payload at all" (e.g. an older editor
      // build) — only the former should ever overwrite what's stored.
      // Stores {salt, hash, iter} from buildPasswordLock, never the
      // plaintext key. Old records may still carry the legacy
      // `passwordLockHash` (raw SHA-256 hex) field from before this
      // fix — those are treated as unset going forward (see
      // lockActive/serveSite and /api/lock/verify below), so an owner
      // just needs to re-enter their key once to upgrade to the new
      // scheme; it's never silently trusted as-is.
      passwordLock: clearingLock ? null : (newPasswordLock || (existing && existing.passwordLock) || null),
      passwordLockHash: null, // legacy field, permanently retired
      ...(wasAlreadyLive ? { reviewedAt: new Date().toISOString(), reviewedBy: 'auto (already-approved update)' } : {})
    }));

    // Reclaim any photo blobs from a previous publish that neither this
    // new draft nor the resulting live proof map still reference.
    await cleanupOrphanedProofBlobs(env, username, proofItems, wasAlreadyLive ? proofItems : ((existing && existing.liveProofItems) || {}));

    return json({ ok: true, pending: nextStatus === 'pending', status: nextStatus, url: `https://${username}.${APP_HOST}` });
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

    // Soft-delete: keep the record (marked "deleted") instead of
    // erasing it, so it can be recovered from the admin dashboard if
    // someone unpublishes by mistake. serveSite() already treats
    // status "deleted" the same as not-found for visitors.
    await env.SITES.put(`site:${username}`, JSON.stringify({
      ...existing,
      status: 'deleted',
      deletedAt: new Date().toISOString()
    }));
    return json({ ok: true });
  }

  // ── Cross-device draft sync (signed-in editors only) ──────────
  // Lets a signed-in Google account's in-progress edits (the full
  // editable Store state — profile/blocks/design/template for both
  // documents — NOT the rendered HTML) follow them to any device,
  // independent of whether they've published/paid/been approved yet.
  // Keyed by the verified email itself (draft:<email>), since a
  // person can be editing before they've even picked/claimed a
  // username. This is deliberately separate from the site: record
  // (which only ever holds published snapshots) so autosaving drafts
  // never risks touching what's actually live.
  if (url.pathname === '/api/draft/save' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid JSON body.' }, 400);
    }
    const email = await verifyGoogleCredential(body.googleCredential);
    if (!email) return json({ ok: false, error: 'Sign in with Google to sync edits across devices.' }, 401);

    const stateStr = JSON.stringify(body.state ?? null);
    // Matches the /api/publish limit above — a draft carries the same
    // photos as a published page, just not yet rendered to HTML.
    if (stateStr.length > 8_000_000) {
      return json({ ok: false, error: 'Draft too large (8MB limit).' }, 400);
    }

    await env.SITES.put(`draft:${email}`, JSON.stringify({
      state: body.state,
      updatedAt: new Date().toISOString()
    }));
    return json({ ok: true });
  }

  if (url.pathname === '/api/draft/load' && request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid JSON body.' }, 400);
    }
    const email = await verifyGoogleCredential(body.googleCredential);
    if (!email) return json({ ok: false, error: 'Sign in with Google to sync edits across devices.' }, 401);

    const record = await env.SITES.get(`draft:${email}`, 'json');
    return json({ ok: true, state: record ? record.state : null, updatedAt: record ? record.updatedAt : null });
  }


  // Every route below requires a verified Google ID token belonging to
  // an address in ADMIN_EMAILS. Sites are never public until 'approve'
  // is called here, and can always be recovered ('restore') even after
  // being unpublished or rejected, since nothing is ever hard-deleted.

  if (url.pathname === '/api/admin/sites' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);

    const list = await env.SITES.list({ prefix: 'site:' });
    const sites = await Promise.all(list.keys.map(async (k) => {
      const record = await env.SITES.get(k.name, 'json');
      const username = k.name.slice('site:'.length);
      return record ? {
        username,
        kind: record.kind || 'site',
        ownerEmail: record.ownerEmail,
        status: record.status || 'live',
        updatedAt: record.updatedAt,
        createdAt: record.createdAt,
        deletedAt: record.deletedAt || null,
        paid: !!record.paid,
        referenceNumber: record.referenceNumber || '',
        buyerReferenceNumber: record.buyerReferenceNumber || '',
        redirectUrl: record.redirectUrl || '',
        paidAt: record.paidAt || null,
        paidUntil: record.paidUntil || null,
        paidDurationMonths: record.paidDurationMonths || null,
        amountPaid: record.amountPaid || null,
        payments: Array.isArray(record.payments) ? record.payments : [],
        manualLink: record.manualLink || ''
      } : null;
    }));
    return json({ ok: true, sites: sites.filter(Boolean) });
  }

  if (url.pathname === '/api/admin/site-html' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);
    const username = String(body.username || '').toLowerCase().trim();
    const record = await env.SITES.get(`site:${username}`, 'json');
    if (!record) return json({ ok: false, error: 'Not found.' }, 404);
    return json({ ok: true, html: record.html });
  }

  if (url.pathname === '/api/admin/set-status' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);

    const username = String(body.username || '').toLowerCase().trim();
    const nextStatus = String(body.status || '');
    if (!['live', 'pending', 'rejected', 'deleted'].includes(nextStatus)) {
      return json({ ok: false, error: 'Invalid status.' }, 400);
    }
    const existing = await env.SITES.get(`site:${username}`, 'json');
    if (!existing) return json({ ok: false, error: 'Not found.' }, 404);

    // Going live always (re-)promotes the current draft (`html`) to
    // `liveHtml` — that's the snapshot serveSite() actually serves.
    // Going anywhere else (pending/rejected/deleted) leaves liveHtml
    // untouched, so a restore back to 'live' later — with no newer
    // draft to approve — can fall back to it and bring back the site
    // "as it was" instead of surfacing a stale not-found page.
    const nextLiveHtml = nextStatus === 'live'
      ? (existing.html || existing.liveHtml || null)
      : (existing.liveHtml || null);
    // Same draft-vs-approved promotion as liveHtml, so approving a
    // site's first-ever submission actually makes its proof pointers
    // servable via /api/site/proof (previously only /api/publish's own
    // "already live, re-publish" path did this promotion).
    const nextLiveProofItems = nextStatus === 'live'
      ? (existing.proofItems || existing.liveProofItems || null)
      : (existing.liveProofItems || null);

    await env.SITES.put(`site:${username}`, JSON.stringify({
      ...existing,
      liveHtml: nextLiveHtml,
      liveProofItems: nextLiveProofItems,
      status: nextStatus,
      reviewedAt: new Date().toISOString(),
      reviewedBy: adminEmail,
      ...(nextStatus === 'deleted' ? { deletedAt: new Date().toISOString() } : {})
    }));
    return json({ ok: true });
  }

  // Hard delete: permanently erases the KV record (unlike set-status
  // 'deleted', which only soft-deletes and can be restored). This is
  // the "free up the username for good" action — nothing recoverable
  // is left behind afterward *for the site itself*, but we keep a
  // lightweight audit-log entry (who/when/what it looked like) so an
  // admin can still see what used to be there and who removed it.
  // The audit entry never blocks the username from being re-claimed.
  if (url.pathname === '/api/admin/delete-site' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);

    const username = String(body.username || '').toLowerCase().trim();
    if (!username) return json({ ok: false, error: 'Missing username.' }, 400);

    const existing = await env.SITES.get(`site:${username}`, 'json');
    const deletedAt = new Date().toISOString();
    // Keyed by timestamp-then-username so a KV `list({prefix:'audit:'})`
    // comes back roughly in chronological order; we still sort
    // client-side to be safe. Snapshot excludes liveHtml/html (can be
    // large, and isn't needed to know "what this was" — kind/status/
    // owner/paid info is what matters for an audit trail).
    const auditKey = `audit:${deletedAt}:${username}`;
    await env.SITES.put(auditKey, JSON.stringify({
      username,
      deletedAt,
      deletedBy: adminEmail,
      existed: !!existing,
      snapshot: existing ? {
        kind: existing.kind || 'site',
        status: existing.status || 'live',
        ownerEmail: existing.ownerEmail || null,
        paid: !!existing.paid,
        amountPaid: existing.amountPaid ?? null,
        paidUntil: existing.paidUntil || null,
        redirectUrl: existing.redirectUrl || null,
        createdAt: existing.createdAt || null,
        updatedAt: existing.updatedAt || null
      } : null
    }));

    await env.SITES.delete(`site:${username}`);
    // Nothing references this username's proof pointers anymore —
    // reclaim every proof:<username>:* photo blob (empty maps below
    // mean "keep nothing").
    await cleanupOrphanedProofBlobs(env, username, {}, {});
    return json({ ok: true, freed: username });
  }

  // Lists hard-delete audit entries, most recent first. Read-only,
  // admin-gated — lets the dashboard show "what got permanently
  // erased, by whom, and when" even though the underlying site record
  // is gone for good and can't be restored through the normal flow.
  if (url.pathname === '/api/admin/audit-log' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);

    const list = await env.SITES.list({ prefix: 'audit:', limit: 200 });
    const entries = await Promise.all(list.keys.map(k => env.SITES.get(k.name, 'json')));
    const cleaned = entries.filter(Boolean).sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
    return json({ ok: true, entries: cleaned, truncated: list.list_complete === false });
  }

  // Lets an admin read contact-form messages that landed in the KV
  // fallback — either because RESEND_API_KEY isn't set yet, or a send
  // attempt failed — so nothing submitted through /api/contact is ever
  // silently lost even without email working.
  if (url.pathname === '/api/admin/contact-messages' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);

    const list = await env.SITES.list({ prefix: 'contact:', limit: 200 });
    const entries = await Promise.all(list.keys.map(async k => {
      const value = await env.SITES.get(k.name, 'json');
      return value ? { key: k.name, ...value } : null;
    }));
    const cleaned = entries.filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return json({ ok: true, entries: cleaned, truncated: list.list_complete === false });
  }

  // Lets an admin clear a contact message out of the KV fallback queue
  // once they've read/handled it (e.g. replied manually), so the queue
  // doesn't grow forever.
  if (url.pathname === '/api/admin/contact-messages/delete' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);

    const key = String(body.key || '');
    if (!key.startsWith('contact:')) return json({ ok: false, error: 'Invalid key.' }, 400);
    await env.SITES.delete(key);
    return json({ ok: true });
  }

  // Lets an admin manually attach/replace an external reference link on
  // a site's record (e.g. a payment receipt, a support ticket, a social
  // profile) — purely informational, shown only in the admin dashboard.
  if (url.pathname === '/api/admin/set-link' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);

    const username = String(body.username || '').toLowerCase().trim();
    const link = String(body.link || '').trim().slice(0, 500);
    const existing = await env.SITES.get(`site:${username}`, 'json');
    if (!existing) return json({ ok: false, error: 'Not found.' }, 404);

    await env.SITES.put(`site:${username}`, JSON.stringify({
      ...existing,
      manualLink: link,
      linkUpdatedAt: new Date().toISOString(),
      linkUpdatedBy: adminEmail
    }));
    return json({ ok: true });
  }

  // Manually label whether this person has paid, with an optional
  // reference number (e.g. GCash/bank transfer ref) for bookkeeping.
  if (url.pathname === '/api/admin/set-paid' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);

    const username = String(body.username || '').toLowerCase().trim();
    const paid = !!body.paid;
    const referenceNumber = String(body.referenceNumber || '').trim().slice(0, 120);
    // How long this payment covers, in months — defaults to the
    // standard Active Job Hunter validity window (see PUBLISH_FEE in
    // editor.js) but an admin can override it per-site (e.g. a promo,
    // a domain-only reservation's requested months, or a partial-period
    // renewal).
    const durationMonths = paid ? (Number(body.durationMonths) > 0 ? Number(body.durationMonths) : 3) : null;
    // The peso (or whatever currency) amount actually received —
    // purely a manual bookkeeping field, defaults to the standard Job
    // Hunt Pass fee but an admin can adjust it for discounts/promos,
    // partial payments, or a domain-only reservation's scaling price.
    const amount = paid ? (Number(body.amount) >= 0 ? Number(body.amount) : 249) : null;
    const existing = await env.SITES.get(`site:${username}`, 'json');
    if (!existing) return json({ ok: false, error: 'Not found.' }, 404);

    const now = new Date();
    const paidUntil = paid
      ? new Date(now.getFullYear(), now.getMonth() + durationMonths, now.getDate()).toISOString()
      : (existing.paidUntil || null);

    // Every time an admin marks a site paid, that's a real payment
    // event worth keeping — appended to a running log rather than
    // overwritten, so the dashboard can total revenue and chart it
    // over time instead of only ever knowing about the latest one.
    // Unmarking "paid" (e.g. correcting a mistake) never touches the
    // log — it only flips the current paid/live flag.
    const payments = Array.isArray(existing.payments) ? existing.payments.slice() : [];
    if (paid) {
      payments.push({
        amount,
        referenceNumber,
        durationMonths,
        paidAt: now.toISOString(),
        adminEmail
      });
    }

    await env.SITES.put(`site:${username}`, JSON.stringify({
      ...existing,
      paid,
      referenceNumber: paid ? referenceNumber : (existing.referenceNumber || ''),
      paidAt: paid ? now.toISOString() : (existing.paidAt || null),
      paidDurationMonths: paid ? durationMonths : (existing.paidDurationMonths || null),
      amountPaid: paid ? amount : (existing.amountPaid || null),
      paidUntil,
      paidMarkedBy: adminEmail,
      payments
    }));
    return json({ ok: true });
  }

  // ── Site-wide visitor counter ───────────────────────────────────
  // A single KV key holds a running total. Every real page load hits
  // this once (see index.html), we bump it by 1 and hand back the new
  // total — no per-visitor dedup, so it's a "page views" counter, not
  // a unique-visitor counter. KV writes aren't atomic increments, but
  // traffic on this marketing page is far too low for the occasional
  // lost increment on a simultaneous read-modify-write to matter.
  if (url.pathname === '/api/visits' && request.method === 'POST') {
    const current = parseInt((await env.SITES.get('meta:visit-count')) || '0', 10) || 0;
    const next = current + 1;
    await env.SITES.put('meta:visit-count', String(next));
    return json({ ok: true, count: next });
  }

  if (url.pathname === '/api/visits' && request.method === 'GET') {
    const current = parseInt((await env.SITES.get('meta:visit-count')) || '0', 10) || 0;
    return json({ ok: true, count: current });
  }

  return json({ ok: false, error: 'Unknown API route.' }, 404);
}
