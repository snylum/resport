/* ============================================================
   admin.js — claims review + donation confirmation
   ============================================================ */

// Must match the Worker's ADMIN_EMAILS check (GOOGLE_CLIENT_ID must
// match whatever OAuth client you created for this).
const GOOGLE_CLIENT_ID = '41010460965-oti1phnr8kdbij312qijrg82bc2japj7.apps.googleusercontent.com';

const el = {
  adminGate: document.getElementById('adminGate'),
  adminPanel: document.getElementById('adminPanel'),
  adminGateStatus: document.getElementById('adminGateStatus'),
  adminListStatus: document.getElementById('adminListStatus'),
  adminSignInSlot: document.getElementById('adminSignInSlot'),
  adminAccountSlot: document.getElementById('adminAccountSlot'),
  claimsList: document.getElementById('claimsList'),
  donationsList: document.getElementById('donationsList'),
  refreshBtn: document.getElementById('adminRefreshBtn')
};

// Same tag names used on the public site — keep in sync with home.js.
const TIER_NAMES = { normal: 'Pulse', gold: 'Beat', diamond: 'Blood', real: 'Soul', ghost: 'Breath' };
function tierLabel(tier) { return TIER_NAMES[tier] || tier || 'Untagged'; }

let credential = null;
let claimFilter = 'pending';
let allSites = [];
let allDonations = [];
let currentView = 'claims';

/* ── Google sign-in ──────────────────────────────────────── */
function handleGoogleCredential(response) {
  credential = response.credential;
  el.adminGateStatus.textContent = 'Verifying…';
  loadEverything(true);
}

(function initGoogle() {
  const ready = () => !!(window.google && window.google.accounts && window.google.accounts.id);
  const start = () => {
    if (!ready()) return setTimeout(start, 150);
    window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
    window.google.accounts.id.renderButton(el.adminSignInSlot, { theme: 'outline', size: 'large', text: 'signin_with' });
  };
  start();
})();

/* ── API helpers ─────────────────────────────────────────── */
async function api(path, body = {}) {
  const res = await fetch(path, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, googleCredential: credential })
  });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

async function loadEverything(firstLoad = false) {
  el.adminListStatus.textContent = 'Loading…';
  try {
    const [claims, donations] = await Promise.all([
      api('/api/admin/claims'),
      api('/api/admin/donations')
    ]);
    allSites = claims.sites;
    allDonations = donations.donations;
    el.adminGate.classList.add('hidden');
    el.adminPanel.classList.remove('hidden');
    el.adminAccountSlot.textContent = 'Signed in';
    el.adminListStatus.textContent = '';
    renderClaims();
    renderDonations();
  } catch (err) {
    if (firstLoad) el.adminGateStatus.textContent = err.message;
    else el.adminListStatus.textContent = err.message;
  }
}

/* ── Claims tab ───────────────────────────────────────────── */
document.querySelectorAll('.admin-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    claimFilter = btn.dataset.filter;
    renderClaims();
  });
});

function renderClaims() {
  // Guard against incomplete/corrupt records (missing username or target)
  // so the dashboard never renders "undefined" cards.
  const usable = allSites.filter(s => s && s.username && s.target);
  const filtered = claimFilter === 'all' ? usable : usable.filter(s => s.status === claimFilter);
  el.claimsList.innerHTML = '';
  if (!filtered.length) {
    el.claimsList.innerHTML = `<p class="username-status">Nothing here.</p>`;
    return;
  }
  filtered.forEach(site => {
    const row = document.createElement('div');
    row.className = 'admin-card';
    row.innerHTML = `
      <div class="admin-card-title-row">
        <h3 class="admin-card-title">${site.username}.proves.work</h3>
        <span class="admin-card-title-sub">${site.status}${site.showcase ? ' · showcased' : ''}</span>
      </div>
      <p class="modal-sub" style="margin:0 0 .5rem;">
        ${site.mode === 'coder' ? `Coder · repo: <a href="${site.repo}" target="_blank" rel="noopener">${site.repoName || site.repo}</a>` : 'No-code'}
        → <a href="${site.target}" target="_blank" rel="noopener">${site.target}</a>
        ${site.email ? ` · ${site.email}` : ''}
      </p>
      <div class="admin-card-actions">
        <button class="btn btn-ghost btn-sm" data-act="live">Approve / live</button>
        <button class="btn btn-ghost btn-sm" data-act="rejected">Reject</button>
        <button class="btn btn-ghost btn-sm" data-act="showcase">${site.showcase ? 'Remove from showcase' : 'Add to showcase'}</button>
        <button class="btn btn-ghost btn-sm" data-act="delete">Delete</button>
      </div>`;
    row.querySelector('[data-act="live"]').addEventListener('click', () => setStatus(site.username, 'live'));
    row.querySelector('[data-act="rejected"]').addEventListener('click', () => setStatus(site.username, 'rejected'));
    row.querySelector('[data-act="showcase"]').addEventListener('click', () => toggleShowcase(site.username, !site.showcase));
    row.querySelector('[data-act="delete"]').addEventListener('click', (e) => deleteSite(site.username, e.currentTarget));
    el.claimsList.appendChild(row);
  });
}

async function setStatus(username, status) {
  try { await api('/api/admin/set-status', { username, status }); await loadEverything(); }
  catch (err) { el.adminListStatus.textContent = err.message; }
}
async function toggleShowcase(username, showcase) {
  try { await api('/api/admin/showcase/tag', { username, showcase }); await loadEverything(); }
  catch (err) { el.adminListStatus.textContent = err.message; }
}
async function deleteSite(username, btn) {
  // Two clicks required, no native confirm() dialog — some embedded /
  // preview contexts silently block window.confirm(), which made the
  // old delete button appear to do nothing.
  if (btn && btn.dataset.confirming !== '1') {
    btn.dataset.confirming = '1';
    const original = btn.textContent;
    btn.dataset.originalLabel = original;
    btn.textContent = 'Confirm delete?';
    btn.classList.add('btn-confirm-danger');
    clearTimeout(btn._confirmTimer);
    btn._confirmTimer = setTimeout(() => {
      btn.dataset.confirming = '0';
      btn.textContent = btn.dataset.originalLabel || 'Delete';
      btn.classList.remove('btn-confirm-danger');
    }, 3000);
    return;
  }
  if (btn) {
    clearTimeout(btn._confirmTimer);
    btn.disabled = true;
    btn.textContent = 'Deleting…';
  }
  try { await api('/api/admin/delete', { username }); await loadEverything(); }
  catch (err) {
    el.adminListStatus.textContent = err.message;
    if (btn) {
      btn.disabled = false;
      btn.dataset.confirming = '0';
      btn.textContent = btn.dataset.originalLabel || 'Delete';
      btn.classList.remove('btn-confirm-danger');
    }
  }
}

/* ── Donations tab ───────────────────────────────────────── */
function renderDonations() {
  el.donationsList.innerHTML = '';
  const usable = allDonations.filter(d => d && d.username);
  if (!usable.length) {
    el.donationsList.innerHTML = `<p class="username-status">No donations yet.</p>`;
    return;
  }
  usable.forEach(d => {
    const row = document.createElement('div');
    row.className = 'admin-card';
    row.innerHTML = `
      <div class="admin-card-title-row">
        <h3 class="admin-card-title">${tierLabel(d.tier)}${d.customTag ? ` "${d.customTag}"` : ''} · ${d.amount ?? '?'} · ${d.username}.proves.work</h3>
        <span class="admin-card-title-sub">${d.confirmed ? 'confirmed' : 'unconfirmed'}</span>
      </div>
      <p class="modal-sub" style="margin:0 0 .5rem;">
        Ref: <code>${d.referenceNumber}</code>${d.email ? ` · ${d.email}` : ''}${d.note ? ` · "${d.note}"` : ''}
      </p>
      ${!d.confirmed ? `
      <div class="admin-card-actions">
        <button class="btn btn-ghost btn-sm" data-act="confirm">Confirm</button>
        <button class="btn btn-ghost btn-sm" data-act="confirm-showcase">Confirm + add to showcase</button>
      </div>` : ''}`;
    if (!d.confirmed) {
      row.querySelector('[data-act="confirm"]').addEventListener('click', () => confirmDonation(d.id, false));
      row.querySelector('[data-act="confirm-showcase"]').addEventListener('click', () => confirmDonation(d.id, true));
    }
    el.donationsList.appendChild(row);
  });
}

async function confirmDonation(id, tagShowcase) {
  try { await api('/api/admin/donations/confirm', { id, tagShowcase }); await loadEverything(); }
  catch (err) { el.adminListStatus.textContent = err.message; }
}

/* ── View tabs (Claims / Donations) ──────────────────────── */
document.querySelectorAll('.admin-view-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-view-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.admin-view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`${btn.dataset.view}View`).classList.remove('hidden');
    currentView = btn.dataset.view;
  });
});

el.refreshBtn.addEventListener('click', () => loadEverything());
