/* ============================================================
   manage.js — proves.work/manage
   Lets a signed-in owner check payment status on their reserved
   address(es) and point a domain-only reservation at an existing
   page elsewhere (Carrd, Gumroad, Vercel, etc.). No admin approval
   gates the redirect itself — only whether the underlying purchase
   has been manually confirmed paid by an admin.
   ============================================================ */

// Must match GOOGLE_CLIENT_ID in index.html / editor.js / worker/src/index.js.
const GOOGLE_CLIENT_ID = '41010460965-oti1phnr8kdbij312qijrg82bc2japj7.apps.googleusercontent.com';
const GOOGLE_ACCOUNT_KEY = 'proveswork_google_account';

const el = {
  gate: document.getElementById('manageGate'),
  gateStatus: document.getElementById('manageGateStatus'),
  signInSlot: document.getElementById('manageSignInSlot'),
  panel: document.getElementById('managePanel'),
  accountEmail: document.getElementById('manageAccountEmail'),
  listStatus: document.getElementById('manageListStatus'),
  sitesList: document.getElementById('manageSitesList')
};

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function decodeGoogleCredential(credential) {
  const payload = credential.split('.')[1];
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
}

// Same stale-token handling as index.html/editor.js: an expired ID
// token should read as "signed out", not as a confusing signed-in
// state the server will reject.
function getSavedGoogleAccount() {
  let account;
  try { account = JSON.parse(localStorage.getItem(GOOGLE_ACCOUNT_KEY) || 'null'); }
  catch { return null; }
  if (!account || !account.credential) return null;
  try {
    const payload = decodeGoogleCredential(account.credential);
    if (!payload.exp || payload.exp * 1000 <= Date.now()) {
      localStorage.removeItem(GOOGLE_ACCOUNT_KEY);
      return null;
    }
  } catch {
    localStorage.removeItem(GOOGLE_ACCOUNT_KEY);
    return null;
  }
  return account;
}

function saveGoogleAccount(account) {
  localStorage.setItem(GOOGLE_ACCOUNT_KEY, JSON.stringify(account));
}

function renderGate() {
  el.gate.classList.remove('hidden');
  el.panel.classList.add('hidden');
  if (window.google && window.google.accounts && window.google.accounts.id) {
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        const payload = decodeGoogleCredential(response.credential);
        saveGoogleAccount({ email: payload.email, name: payload.name, credential: response.credential });
        init();
      }
    });
    window.google.accounts.id.renderButton(el.signInSlot, { theme: 'outline', size: 'medium', text: 'signin_with' });
  }
}

function paidStatusLine(site) {
  if (!site.paid) {
    return `<p class="manage-site-status warn">⏳ Payment not yet confirmed — an admin verifies each reference number by hand before this goes live.</p>`;
  }
  const until = site.paidUntil ? new Date(site.paidUntil).toLocaleDateString() : null;
  return `<p class="manage-site-status ok">✓ Paid${until ? ` · active until ${esc(until)}` : ''}</p>`;
}

// Warns the owner, in a dismissible popup, when a paid address is
// within 2 weeks of lapsing — a portfolio drops back to the (no live
// hosting) Free tier, and a domain-only reservation stops
// redirecting/masking, until it's renewed. Shown at most once per
// address per calendar day so it doesn't nag on every visit; already-
// expired addresses are covered by the "Payment not yet confirmed"-
// style status line on the card instead, not this popup.
const RENEWAL_REMINDER_KEY_PREFIX = 'proveswork_renewal_reminder_shown';
function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}
function maybeShowRenewalReminders(sites) {
  const soon = sites.filter(s => s.paid && s.paidUntil && daysUntil(s.paidUntil) > 0 && daysUntil(s.paidUntil) <= 14);
  if (!soon.length) return;
  const todayKey = `${RENEWAL_REMINDER_KEY_PREFIX}:${soon.map(s => s.username).sort().join(',')}:${new Date().toISOString().slice(0, 10)}`;
  if (localStorage.getItem(todayKey)) return;
  localStorage.setItem(todayKey, '1');
  const overlay = document.getElementById('renewalReminderOverlay');
  const content = document.getElementById('renewalReminderContent');
  if (!overlay || !content) return;
  const isDomain = (s) => s.kind === 'domain';
  const rows = soon.map(s => {
    const d = daysUntil(s.paidUntil);
    return `<li style="margin-bottom:0.4rem"><strong>${esc(s.username)}.proves.work</strong> — ${d} day${d === 1 ? '' : 's'} left${isDomain(s) ? ' (reservation)' : ''}</li>`;
  }).join('');
  content.innerHTML = `
    <button type="button" class="close-x" id="renewalReminderCloseBtn" aria-label="Close">✕</button>
    <h3>Coming up on renewal</h3>
    <p class="sub">${soon.length > 1 ? 'These addresses are' : 'This address is'} within 2 weeks of running out. After that${soon.length > 1 ? ' each drops' : ' it drops'} back to Free tier (portfolios) or stops redirecting (domain-only) until renewed.</p>
    <ul style="margin:0 0 1.25rem;padding-left:1.1rem;font-size:0.9rem;">${rows}</ul>
    <div class="actions">
      <button type="button" class="btn btn-primary btn-sm" id="renewalReminderOkBtn">Got it</button>
    </div>
  `;
  overlay.classList.remove('hidden');
  const close = () => { overlay.classList.add('hidden'); content.innerHTML = ''; };
  document.getElementById('renewalReminderCloseBtn').addEventListener('click', close);
  document.getElementById('renewalReminderOkBtn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); }, { once: true });
}

function siteCardHtml(site) {
  const isDomain = site.kind === 'domain';
  return `
    <div class="manage-site-card" data-username="${esc(site.username)}">
      <h3 class="manage-site-name">${esc(site.username)}.proves.work${isDomain ? ' <span class="manage-kind-badge">Domain only</span>' : ''}</h3>
      ${paidStatusLine(site)}
      ${isDomain ? `
        <div class="manage-redirect-row">
          <input type="text" class="manage-redirect-input" placeholder="https://yourname.carrd.co" value="${esc(site.redirectUrl || '')}" ${site.paid ? '' : 'disabled'} autocomplete="off" />
          <button type="button" class="btn btn-primary btn-sm manage-redirect-save" ${site.paid ? '' : 'disabled'}>Save</button>
        </div>
        <p class="manage-field-note">${site.paid
          ? "Point this address at an existing page — Carrd, Gumroad, a Vercel app, anything. Visitors see that page's content, but the address bar keeps showing your username.proves.work — it's not a redirect. Changes go live immediately, no re-approval needed. Leave it blank to show the plain \"reserved\" page instead."
          : 'You can set this once an admin has confirmed your payment.'}</p>
        <div class="manage-status-line manage-redirect-status"></div>
      ` : ''}
      ${!site.paid ? `
        <div class="manage-proof-row">
          <input type="text" class="manage-proof-input" placeholder="Payment reference number" value="${esc(site.buyerReferenceNumber || '')}" autocomplete="off" />
          <button type="button" class="btn btn-ghost btn-sm manage-proof-submit">Submit proof of payment</button>
        </div>
        <div class="manage-status-line manage-proof-status"></div>
      ` : ''}
    </div>
  `;
}

function wireCard(card, account) {
  const username = card.dataset.username;

  const redirectInput = card.querySelector('.manage-redirect-input');
  const redirectBtn = card.querySelector('.manage-redirect-save');
  const redirectStatus = card.querySelector('.manage-redirect-status');
  if (redirectBtn) {
    redirectBtn.addEventListener('click', async () => {
      redirectBtn.disabled = true;
      redirectBtn.textContent = 'Saving…';
      redirectStatus.textContent = '';
      redirectStatus.className = 'manage-status-line';
      try {
        const res = await fetch('/api/domain/set-redirect', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username, googleCredential: account.credential, redirectUrl: redirectInput.value.trim() })
        });
        const data = await res.json();
        if (!data.ok) {
          redirectStatus.textContent = data.error || 'Something went wrong.';
          redirectStatus.className = 'manage-status-line warn';
        } else {
          redirectStatus.textContent = data.redirectUrl ? 'Saved — your address now shows that page.' : 'Cleared — showing the default reserved page.';
          redirectStatus.className = 'manage-status-line ok';
        }
      } catch {
        redirectStatus.textContent = 'Network error — try again.';
        redirectStatus.className = 'manage-status-line warn';
      }
      redirectBtn.disabled = false;
      redirectBtn.textContent = 'Save';
    });
  }

  const proofInput = card.querySelector('.manage-proof-input');
  const proofBtn = card.querySelector('.manage-proof-submit');
  const proofStatus = card.querySelector('.manage-proof-status');
  if (proofBtn) {
    proofBtn.addEventListener('click', async () => {
      const ref = proofInput.value.trim();
      if (!ref) { proofStatus.textContent = 'Enter a reference number.'; proofStatus.className = 'manage-status-line warn'; return; }
      proofBtn.disabled = true;
      proofBtn.textContent = 'Submitting…';
      try {
        const res = await fetch('/api/domain/submit-proof', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username, googleCredential: account.credential, referenceNumber: ref })
        });
        const data = await res.json();
        if (!data.ok) {
          proofStatus.textContent = data.error || 'Something went wrong.';
          proofStatus.className = 'manage-status-line warn';
        } else {
          proofStatus.textContent = "Submitted — an admin will verify it against their payment records.";
          proofStatus.className = 'manage-status-line ok';
        }
      } catch {
        proofStatus.textContent = 'Network error — try again.';
        proofStatus.className = 'manage-status-line warn';
      }
      proofBtn.disabled = false;
      proofBtn.textContent = 'Submit proof of payment';
    });
  }
}

async function renderPanel(account) {
  el.gate.classList.add('hidden');
  el.panel.classList.remove('hidden');
  el.accountEmail.textContent = account.email;
  el.listStatus.textContent = 'Loading your addresses…';
  el.sitesList.innerHTML = '';

  try {
    const res = await fetch('/api/domain/my-sites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ googleCredential: account.credential })
    });
    const data = await res.json();
    if (!data.ok) {
      el.listStatus.textContent = data.error || 'Could not load your addresses.';
      return;
    }
    if (!data.sites.length) {
      el.listStatus.textContent = '';
      el.sitesList.innerHTML = `<p class="username-status">No addresses found for this account yet. <a href="index.html">Reserve one →</a></p>`;
      return;
    }
    el.listStatus.textContent = '';
    el.sitesList.innerHTML = data.sites.map(siteCardHtml).join('');
    el.sitesList.querySelectorAll('.manage-site-card').forEach(card => wireCard(card, account));
    maybeShowRenewalReminders(data.sites);
  } catch {
    el.listStatus.textContent = 'Network error — try refreshing.';
  }
}

function init() {
  const account = getSavedGoogleAccount();
  if (account) {
    renderPanel(account);
  } else {
    renderGate();
  }
}

window.addEventListener('load', init);
