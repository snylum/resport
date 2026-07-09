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

  // Serve the last *approved* snapshot (liveHtml) when we have one —
  // record.html may be a newer, not-yet-approved draft that was
  // uploaded after this site went live (edits don't go public until
  // re-approved). Records saved before liveHtml existed fall back to
  // record.html so old published sites keep working.
  return new Response(record.liveHtml || record.html, {
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
  if (url.pathname === '/api/check-username' && request.method === 'GET') {
    const username = (url.searchParams.get('u') || '').toLowerCase();
    if (!USERNAME_RE.test(username) || RESERVED.has(username)) {
      return json({ available: false, reason: 'invalid' });
    }
    const existing = await env.SITES.get(`site:${username}`, 'json');
    // A soft-deleted record (status: 'deleted') no longer occupies the
    // username — it's kept around only so an admin can hard-delete or
    // restore it, not to squat the name forever.
    const isFree = !existing || existing.status === 'deleted';
    return json({ available: isFree });
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
    if (!html || html.length > 2_000_000) {
      return json({ ok: false, error: 'Missing page content, or content too large (2MB limit).' }, 400);
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

    await env.SITES.put(`site:${username}`, JSON.stringify({
      ownerEmail: ownerEmail || (existing ? existing.ownerEmail : null) || null,
      html,
      // liveHtml stays whatever was last *approved* unless this publish
      // is itself going straight to live (see wasAlreadyLive above) — in
      // that case this draft is that new approved snapshot.
      liveHtml: wasAlreadyLive ? html : ((existing && existing.liveHtml) || null),
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      createdAt: (existing && existing.createdAt) || new Date().toISOString(),
      ...(wasAlreadyLive ? { reviewedAt: new Date().toISOString(), reviewedBy: 'auto (already-approved update)' } : {})
    }));

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
    if (stateStr.length > 2_000_000) {
      return json({ ok: false, error: 'Draft too large (2MB limit).' }, 400);
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
        ownerEmail: record.ownerEmail,
        status: record.status || 'live',
        updatedAt: record.updatedAt,
        createdAt: record.createdAt,
        deletedAt: record.deletedAt || null,
        paid: !!record.paid,
        referenceNumber: record.referenceNumber || '',
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

    await env.SITES.put(`site:${username}`, JSON.stringify({
      ...existing,
      liveHtml: nextLiveHtml,
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
  // is left behind afterward.
  if (url.pathname === '/api/admin/delete-site' && request.method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ ok: false, error: 'Invalid JSON body.' }, 400); }
    const adminEmail = await verifyAdminCredential(body.googleCredential);
    if (!adminEmail) return json({ ok: false, error: 'Admin sign-in required.' }, 403);

    const username = String(body.username || '').toLowerCase().trim();
    if (!username) return json({ ok: false, error: 'Missing username.' }, 400);
    await env.SITES.delete(`site:${username}`);
    return json({ ok: true, freed: username });
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
    // standard publishing-fee validity window (see PUBLISH_FEE in
    // editor.js) but an admin can override it per-site (e.g. a promo
    // or a partial-period renewal).
    const durationMonths = paid ? (Number(body.durationMonths) > 0 ? Number(body.durationMonths) : 3) : null;
    // The peso (or whatever currency) amount actually received —
    // purely a manual bookkeeping field, defaults to the standard fee
    // but an admin can adjust it for discounts/promos/partial payments.
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

  return json({ ok: false, error: 'Unknown API route.' }, 404);
}
