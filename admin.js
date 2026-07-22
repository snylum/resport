/* ============================================================
   admin.js — sites (claims), donations, messages, audit log
   ============================================================ */

// Same client ID as editor.js — must match the Worker's GOOGLE_CLIENT_ID.
const GOOGLE_CLIENT_ID = '41010460965-oti1phnr8kdbij312qijrg82bc2japj7.apps.googleusercontent.com';

const ADMIN_ACCOUNT_KEY = 'proveswork_admin_google_account';
// Auto sign-out after this long with no mouse/keyboard/touch activity —
// an admin dashboard that can approve/delete sites and confirm money
// shouldn't stay signed in forever on a shared or unattended machine.
const ADMIN_IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const ADMIN_IDLE_CHECK_INTERVAL_MS = 30 * 1000;

// This client-side check is only for UX (deciding which screen to show
// instantly on sign-in) — it is NOT the real security boundary. Every
// /api/admin/* call re-verifies the Google ID token AND the email
// server-side in the Worker, so a person can't just edit this file (or
// their browser) to grant themselves admin access.
const ADMIN_EMAILS = new Set(['snylumagbas@gmail.com']);

// Same tag names used on the public site — keep in sync with home.js.
const TIER_NAMES = { normal: 'Pulse', gold: 'Beat', diamond: 'Blood', real: 'Soul', ghost: 'Breath' };
function tierLabel(tier) { return TIER_NAMES[tier] || tier || 'Untagged'; }

// Claim/donation fields are only checked loosely server-side (e.g.
// `new URL()` validates a string *parses*, not that it's free of quotes
// or angle brackets) and the raw string is what gets stored. Escape
// everything user-supplied before it goes into innerHTML, or a stray
// `"` in a target/email/note can break out of an attribute and mangle
// the card (or everything rendered after it).
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const el = {
  adminGate: document.getElementById('adminGate'),
  adminGateStatus: document.getElementById('adminGateStatus'),
  adminSignInSlot: document.getElementById('adminSignInSlot'),
  adminAccountSlot: document.getElementById('adminAccountSlot'),
  adminPanel: document.getElementById('adminPanel'),
  adminSitesList: document.getElementById('adminSitesList'),
  adminDonationsList: document.getElementById('adminDonationsList'),
  adminListStatus: document.getElementById('adminListStatus'),
  adminSearch: document.getElementById('adminSearch'),
  adminRefreshBtn: document.getElementById('adminRefreshBtn'),
  adminOverviewView: document.getElementById('adminOverviewView'),
  adminSitesView: document.getElementById('adminSitesView'),
  adminDonationsView: document.getElementById('adminDonationsView'),
  adminAuditView: document.getElementById('adminAuditView'),
  adminAuditList: document.getElementById('adminAuditList'),
  adminMessagesView: document.getElementById('adminMessagesView'),
  adminMessagesList: document.getElementById('adminMessagesList'),
  adminStatsGrid: document.getElementById('adminStatsGrid'),
  adminRevenueChart: document.getElementById('adminRevenueChart'),
  adminStatusChart: document.getElementById('adminStatusChart'),
  adminPaymentsLog: document.getElementById('adminPaymentsLog'),
  adminPaymentsCount: document.getElementById('adminPaymentsCount'),
  modalOverlay: document.getElementById('modalOverlay'),
  modalContent: document.getElementById('modalContent'),
  modalCloseBtn: document.getElementById('modalCloseBtn')
};

/* ── Saved Google account + idle timeout ─────────────────────── */
function decodeGoogleCredential(credential) {
  const payload = credential.split('.')[1];
  const json = decodeURIComponent(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    .split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
  return JSON.parse(json);
}

function getSavedAdminAccount() {
  let account;
  try { account = JSON.parse(localStorage.getItem(ADMIN_ACCOUNT_KEY) || 'null'); }
  catch { return null; }
  if (!account || !account.credential) return null;
  try {
    const payload = decodeGoogleCredential(account.credential);
    if (!payload.exp || payload.exp * 1000 <= Date.now()) {
      localStorage.removeItem(ADMIN_ACCOUNT_KEY);
      return null;
    }
  } catch {
    localStorage.removeItem(ADMIN_ACCOUNT_KEY);
    return null;
  }
  return account;
}
function saveAdminAccount(account) {
  localStorage.setItem(ADMIN_ACCOUNT_KEY, JSON.stringify({ ...account, lastActiveAt: Date.now() }));
}
function clearAdminAccount() { localStorage.removeItem(ADMIN_ACCOUNT_KEY); }

function touchAdminActivity() {
  const account = getSavedAdminAccount();
  if (!account) return;
  account.lastActiveAt = Date.now();
  localStorage.setItem(ADMIN_ACCOUNT_KEY, JSON.stringify(account));
}

function isAdminSessionExpired(account) {
  if (!account) return true;
  const lastActive = account.lastActiveAt || 0;
  return (Date.now() - lastActive) > ADMIN_IDLE_TIMEOUT_MS;
}

let idleCheckTimer = null;
function startIdleWatch() {
  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evt => {
    document.addEventListener(evt, touchAdminActivity, { passive: true });
  });
  if (idleCheckTimer) clearInterval(idleCheckTimer);
  idleCheckTimer = setInterval(() => {
    const account = getSavedAdminAccount();
    if (account && isAdminSessionExpired(account)) signOutForInactivity();
  }, ADMIN_IDLE_CHECK_INTERVAL_MS);
}

function signOutForInactivity() {
  if (idleCheckTimer) { clearInterval(idleCheckTimer); idleCheckTimer = null; }
  clearAdminAccount();
  el.adminPanel.classList.add('hidden');
  el.adminGate.classList.remove('hidden');
  el.adminGateStatus.textContent = "You were signed out after 15 minutes of inactivity — sign in again to continue.";
  el.adminGateStatus.className = 'username-status warn';
  el.adminAccountSlot.innerHTML = '';
  renderGoogleSignInButton();
}

function renderAccountSlot() {
  const account = getSavedAdminAccount();
  if (!account) { el.adminAccountSlot.innerHTML = ''; return; }
  el.adminAccountSlot.innerHTML = `
    <span style="font-size:0.85rem;color:var(--color-text-muted);">${esc(account.email)}</span>
    <button class="btn btn-ghost btn-sm" id="adminSignOutBtn" type="button" style="margin-left:0.6rem;">Sign out</button>
  `;
  document.getElementById('adminSignOutBtn').addEventListener('click', () => {
    if (idleCheckTimer) { clearInterval(idleCheckTimer); idleCheckTimer = null; }
    clearAdminAccount();
    location.reload();
  });
}

/* ── Modal ─────────────────────────────────────────────────── */
function openModal(html, onOpen) {
  el.modalContent.innerHTML = html;
  el.modalOverlay.classList.remove('hidden');
  if (onOpen) onOpen(el.modalContent);
}
function closeModal() {
  el.modalOverlay.classList.add('hidden');
  el.modalContent.innerHTML = '';
}
el.modalCloseBtn.addEventListener('click', closeModal);
el.modalOverlay.addEventListener('click', (e) => { if (e.target === el.modalOverlay) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
function alertModal(message) {
  openModal(`
    <h3 class="modal-title">Heads up</h3>
    <p class="modal-sub">${esc(message)}</p>
    <div class="modal-actions"><button class="btn btn-secondary btn-sm" id="alertOkBtn" type="button">OK</button></div>
  `, (root) => root.querySelector('#alertOkBtn').addEventListener('click', closeModal));
}

/* ── Google sign-in ───────────────────────────────────────────── */
function handleGoogleCredential(response) {
  const payload = decodeGoogleCredential(response.credential);
  const email = (payload.email || '').toLowerCase();
  saveAdminAccount({ email, name: payload.name, credential: response.credential });

  if (!ADMIN_EMAILS.has(email)) {
    el.adminGateStatus.textContent = `${email} isn't an admin account on this dashboard.`;
    el.adminGateStatus.className = 'username-status warn';
    return;
  }
  showPanel();
}

// The Google Identity Services <script> tag is async/defer, so it can
// still be mid-flight on a fresh page load — checking window.google
// once and giving up immediately was reporting "hasn't loaded" for a
// script that was simply still downloading. Poll briefly before
// truly giving up.
function waitForGoogleIdentity(callback, { timeoutMs = 4000, intervalMs = 100 } = {}) {
  const isReady = () => !!(window.google && window.google.accounts && window.google.accounts.id);
  if (isReady()) { callback(true); return; }
  const start = Date.now();
  const timer = setInterval(() => {
    if (isReady()) { clearInterval(timer); callback(true); }
    else if (Date.now() - start >= timeoutMs) { clearInterval(timer); callback(false); }
  }, intervalMs);
}

function renderGoogleSignInButton() {
  el.adminSignInSlot.innerHTML = `<p class="username-status">Loading Google sign-in…</p>`;
  waitForGoogleIdentity((ready) => {
    if (!ready) {
      el.adminSignInSlot.innerHTML = `<p class="username-status warn">Google sign-in script hasn't loaded — check your connection and reload.</p>`;
      return;
    }
    el.adminSignInSlot.innerHTML = '';
    window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
    window.google.accounts.id.renderButton(el.adminSignInSlot, { theme: 'outline', size: 'large' });
  });
}

function showPanel() {
  el.adminGate.classList.add('hidden');
  el.adminPanel.classList.remove('hidden');
  touchAdminActivity();
  renderAccountSlot();
  loadSites();
  startIdleWatch();
}

/* ── Top-level view tabs ──────────────────────────────────────── */
let activeView = 'overview';
document.querySelectorAll('.admin-view-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-view-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeView = tab.dataset.view;
    el.adminOverviewView.classList.toggle('hidden', activeView !== 'overview');
    el.adminSitesView.classList.toggle('hidden', activeView !== 'sites');
    el.adminDonationsView.classList.toggle('hidden', activeView !== 'donations');
    el.adminMessagesView.classList.toggle('hidden', activeView !== 'messages');
    el.adminAuditView.classList.toggle('hidden', activeView !== 'audit');
    if (activeView === 'audit') loadAuditLog();
    if (activeView === 'messages') loadContactMessages();
    if (activeView === 'donations') loadDonations();
  });
});

/* ── API helper ────────────────────────────────────────────────── */
async function api(path, body = {}) {
  const account = getSavedAdminAccount();
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, googleCredential: account && account.credential })
  });
  const data = await res.json().catch(() => ({ ok: false, error: 'Bad response from server.' }));
  return data;
}

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleString() : '—';
}

/* ── Data ─────────────────────────────────────────────────────── */
let allSites = [];
let allDonations = [];
let donationsLoaded = false;
let activeFilter = 'all';
let donationFilter = 'unconfirmed';

async function loadSites() {
  el.adminListStatus.textContent = 'Loading sites…';
  el.adminListStatus.className = 'username-status';
  try {
    const data = await api('/api/admin/sites');
    if (!data.ok) {
      el.adminListStatus.textContent = data.error || 'Not authorized.';
      el.adminListStatus.className = 'username-status warn';
      allSites = [];
      renderOverview();
      renderSitesList();
      return;
    }
    allSites = data.sites.filter(s => s && s.username);
    el.adminListStatus.textContent = '';
    renderOverview();
    renderSitesList();
    // Overview needs donation revenue too — load them quietly the first time.
    if (!donationsLoaded) await loadDonations({ silent: true });
  } catch {
    el.adminListStatus.textContent = 'Could not reach the admin API — check the Worker is deployed.';
    el.adminListStatus.className = 'username-status warn';
  }
}

/* ── Overview ─────────────────────────────────────────────────── */
function renderBarChart(container, rows, { formatValue = (v) => v, barColor = 'var(--color-secondary)' } = {}) {
  if (!rows.length || rows.every(r => !r.value)) {
    container.innerHTML = `<p class="admin-empty admin-empty-sm">No data yet.</p>`;
    return;
  }
  const max = Math.max(...rows.map(r => r.value), 1);
  container.innerHTML = rows.map(r => `
    <div class="admin-bar-row">
      <span class="admin-bar-label">${esc(r.label)}</span>
      <div class="admin-bar-track">
        <div class="admin-bar-fill" style="width:${Math.max((r.value / max) * 100, r.value > 0 ? 3 : 0)}%;background:${r.color || barColor};"></div>
      </div>
      <span class="admin-bar-value">${esc(formatValue(r.value))}</span>
    </div>
  `).join('');
}

function money(n, currency = 'php') {
  const symbol = currency === 'usd' ? '$' : '₱';
  return `${symbol}${Number(n || 0).toLocaleString()}`;
}

function confirmedDonations() {
  return allDonations.filter(d => d && d.username && d.confirmed);
}

function renderOverview() {
  const now = new Date();
  const total = allSites.length;
  const byStatus = { live: 0, pending: 0, rejected: 0 };
  let showcased = 0;
  allSites.forEach(s => {
    if (byStatus[s.status] != null) byStatus[s.status]++;
    if (s.showcase) showcased++;
  });

  // Donations mix PHP and USD, so total revenue is reported per-currency
  // rather than force-converted at a made-up exchange rate.
  const confirmed = confirmedDonations();
  const revenueByCurrency = { php: 0, usd: 0 };
  confirmed.forEach(d => { revenueByCurrency[d.currency === 'usd' ? 'usd' : 'php'] += Number(d.amount) || 0; });
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthRevenue = { php: 0, usd: 0 };
  confirmed.filter(d => new Date(d.confirmedAt || d.createdAt || 0) >= monthStart)
    .forEach(d => { monthRevenue[d.currency === 'usd' ? 'usd' : 'php'] += Number(d.amount) || 0; });

  const cards = [
    { label: 'Total sites', value: total },
    { label: 'Live', value: byStatus.live, tone: 'ok' },
    { label: 'Pending review', value: byStatus.pending, tone: byStatus.pending ? 'warn' : '' },
    { label: 'Rejected', value: byStatus.rejected },
    { label: 'Showcased', value: showcased, tone: 'ok' },
    { label: 'Donations this month', value: `${money(monthRevenue.php)} / ${money(monthRevenue.usd, 'usd')}` },
    { label: 'Donations total', value: `${money(revenueByCurrency.php)} / ${money(revenueByCurrency.usd, 'usd')}` },
    { label: 'Unconfirmed donations', value: allDonations.filter(d => !d.confirmed).length, tone: allDonations.some(d => !d.confirmed) ? 'warn' : '' },
  ];
  el.adminStatsGrid.innerHTML = cards.map(c => `
    <div class="admin-stat-card">
      <div class="admin-stat-value ${c.tone || ''}">${esc(String(c.value))}</div>
      <div class="admin-stat-label">${esc(c.label)}</div>
    </div>
  `).join('');

  // Revenue by month (last 6 months, oldest → newest). PHP-denominated
  // donations only, to keep one bar chart honest about its unit — USD
  // shows up in the stat card above instead.
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString(undefined, { month: 'short' }), value: 0 });
  }
  confirmed.filter(d => d.currency !== 'usd').forEach(d => {
    const dt = new Date(d.confirmedAt || d.createdAt || 0);
    const key = `${dt.getFullYear()}-${dt.getMonth()}`;
    const bucket = months.find(m => m.key === key);
    if (bucket) bucket.value += Number(d.amount) || 0;
  });
  renderBarChart(el.adminRevenueChart, months, { formatValue: (v) => money(v) });

  renderBarChart(el.adminStatusChart, [
    { label: 'Live', value: byStatus.live, color: 'var(--color-success)' },
    { label: 'Pending', value: byStatus.pending, color: 'var(--color-warning, #a15c00)' },
    { label: 'Rejected', value: byStatus.rejected, color: 'var(--color-danger)' },
  ], { formatValue: (v) => String(v) });

  const recent = confirmed.slice().sort((a, b) => new Date(b.confirmedAt || b.createdAt || 0) - new Date(a.confirmedAt || a.createdAt || 0));
  el.adminPaymentsCount.textContent = recent.length ? `${recent.length} total` : '';
  if (!recent.length) {
    el.adminPaymentsLog.innerHTML = `<p class="admin-empty admin-empty-sm">No confirmed donations yet — confirm one from the Donations tab to start tracking.</p>`;
  } else {
    el.adminPaymentsLog.innerHTML = recent.slice(0, 15).map(d => `
      <div class="admin-payment-row">
        <div class="admin-payment-main">
          <span class="admin-payment-username">${esc(tierLabel(d.tier))} · ${esc(d.username)}.proves.work</span>
          <span class="admin-payment-meta">${formatDate(d.confirmedAt || d.createdAt)}${d.referenceNumber ? ` · ref: ${esc(d.referenceNumber)}` : ''}</span>
        </div>
        <span class="admin-payment-amount">${money(d.amount, d.currency)}</span>
      </div>
    `).join('');
  }
}

/* ── Sites tab ────────────────────────────────────────────────── */
function renderSitesList() {
  const q = (el.adminSearch.value || '').trim().toLowerCase();
  const filtered = allSites.filter(s => {
    const matchesFilter = activeFilter === 'all' || s.status === activeFilter;
    const matchesQuery = !q || s.username.includes(q) || (s.email || '').toLowerCase().includes(q);
    return matchesFilter && matchesQuery;
  });

  if (!filtered.length) {
    el.adminSitesList.innerHTML = `<p class="admin-empty">Nothing here.</p>`;
    return;
  }

  el.adminSitesList.innerHTML = filtered.map(s => `
    <div class="admin-site-row" data-username="${esc(s.username)}">
      <div class="admin-site-main">
        <div class="admin-site-username">${esc(s.username)}.proves.work${s.showcase ? ` <span class="admin-owner-chip">showcased</span>` : ''}</div>
        <div class="admin-site-meta">
          ${s.mode === 'coder' ? `Coder · repo: <a href="${esc(s.repo)}" target="_blank" rel="noopener">${esc(s.repoName || s.repo)}</a>` : 'No-code'}
          → ${s.target ? `<a href="${esc(s.target)}" target="_blank" rel="noopener">${esc(s.target)}</a>` : `<span class="admin-owner-chip" style="color:var(--color-danger)">no target — malformed record</span>`}
        </div>
        <div class="admin-site-meta">${s.email ? esc(s.email) : 'anonymous'} · claimed ${formatDate(s.createdAt)}</div>
      </div>
      <span class="admin-status-pill ${s.status}">${esc(s.status)}</span>
      <div class="admin-site-actions">
        <button class="btn btn-ghost btn-sm admin-view-btn" data-action="view" type="button">View</button>
        <button class="btn btn-ghost btn-sm" data-action="edit" type="button">Edit</button>
        ${s.status === 'pending' ? `<button class="btn btn-secondary btn-sm" data-action="approve" type="button">Approve</button>
          <button class="btn btn-ghost btn-sm" data-action="reject" type="button">Reject</button>` : ''}
        ${s.status === 'live' ? `<button class="btn btn-ghost btn-sm" data-action="reject" type="button">Unpublish</button>` : ''}
        ${s.status === 'rejected' ? `<button class="btn btn-secondary btn-sm" data-action="restore" type="button">Restore</button>` : ''}
        <button class="btn btn-ghost btn-sm" data-action="toggle-showcase" type="button">${s.showcase ? 'Remove from showcase' : 'Add to showcase'}</button>
        <button class="btn btn-danger btn-sm" data-action="hard-delete" type="button">Delete</button>
      </div>
    </div>
  `).join('');
}

async function setStatus(username, status) {
  const data = await api('/api/admin/set-status', { username, status });
  if (!data.ok) { alertModal(data.error || 'Something went wrong.'); return; }
  loadSites();
}

async function toggleShowcase(username, showcase) {
  const data = await api('/api/admin/showcase/tag', { username, showcase });
  if (!data.ok) { alertModal(data.error || 'Something went wrong.'); return; }
  loadSites();
}

async function hardDeleteSite(username) {
  const data = await api('/api/admin/delete-site', { username });
  if (!data.ok) { alertModal(data.error || 'Something went wrong.'); return; }
  loadSites();
}

function confirmHardDelete(username) {
  openModal(`
    <h3 class="modal-title" id="modalTitle">Permanently delete @${esc(username)}?</h3>
    <p class="modal-sub">This erases the site record entirely and immediately frees up <strong>${esc(username)}.proves.work</strong> for anyone to claim. This can't be undone.</p>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" id="cancelHardDeleteBtn" type="button">Cancel</button>
      <button class="btn btn-danger btn-sm" id="confirmHardDeleteBtn" type="button">Delete permanently</button>
    </div>
  `, (root) => {
    root.querySelector('#cancelHardDeleteBtn').addEventListener('click', closeModal);
    root.querySelector('#confirmHardDeleteBtn').addEventListener('click', () => {
      hardDeleteSite(username);
      closeModal();
    });
  });
}

const PUBLISH_APEX = 'proves.work';
function viewSite(username) { window.open(`https://${username}.${PUBLISH_APEX}`, '_blank', 'noopener'); }

function editSiteModal(site) {
  openModal(`
    <h3 class="modal-title">Edit @${esc(site.username)}'s showcase card</h3>
    <p class="modal-sub">This is the description shown on their card in the public showcase — it replaces the old auto-generated tier blurb, so write whatever fits them best.</p>
    <div class="admin-form-grid">
      <label class="admin-form-field admin-form-field-wide">
        <span>Description</span>
        <textarea id="editSiteDescription" rows="3" maxlength="280" placeholder="e.g. Frontend dev open to junior roles — full portfolio at the link.">${esc(site.description ?? '')}</textarea>
      </label>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" id="cancelEditSiteBtn" type="button">Cancel</button>
      <button class="btn btn-primary btn-sm" id="saveEditSiteBtn" type="button">Save changes</button>
    </div>
  `, (root) => {
    root.querySelector('#cancelEditSiteBtn').addEventListener('click', closeModal);
    root.querySelector('#saveEditSiteBtn').addEventListener('click', async () => {
      const description = root.querySelector('#editSiteDescription').value;
      const data = await api('/api/admin/sites/edit', { username: site.username, description });
      if (!data.ok) { alertModal(data.error || 'Something went wrong.'); return; }
      closeModal();
      loadSites();
    });
  });
}

el.adminSitesList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const row = e.target.closest('.admin-site-row');
  const username = row.dataset.username;
  const site = allSites.find(s => s.username === username);
  const action = btn.dataset.action;
  if (action === 'view') viewSite(username);
  else if (action === 'edit') { if (site) editSiteModal(site); }
  else if (action === 'approve') setStatus(username, 'live');
  else if (action === 'reject') setStatus(username, 'rejected');
  else if (action === 'restore') setStatus(username, 'live');
  else if (action === 'toggle-showcase') toggleShowcase(username, !(site && site.showcase));
  else if (action === 'hard-delete') confirmHardDelete(username);
});

document.querySelectorAll('.admin-tabs [data-filter]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tabs [data-filter]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeFilter = tab.dataset.filter;
    renderSitesList();
  });
});
el.adminSearch.addEventListener('input', renderSitesList);
el.adminRefreshBtn.addEventListener('click', () => {
  loadSites();
  if (activeView === 'audit') loadAuditLog();
  if (activeView === 'messages') loadContactMessages();
  if (activeView === 'donations') loadDonations();
});

/* ── Donations tab ────────────────────────────────────────────── */
async function loadDonations({ silent = false } = {}) {
  if (!silent) el.adminDonationsList.innerHTML = `<p class="admin-empty admin-empty-sm">Loading…</p>`;
  try {
    const data = await api('/api/admin/donations');
    if (!data.ok) {
      if (!silent) el.adminDonationsList.innerHTML = `<p class="admin-empty">${esc(data.error || 'Not authorized.')}</p>`;
      return;
    }
    allDonations = data.donations.filter(d => d && d.username);
    donationsLoaded = true;
    renderDonationsList();
    renderOverview();
  } catch {
    if (!silent) el.adminDonationsList.innerHTML = `<p class="admin-empty">Could not reach the admin API — check the Worker is deployed.</p>`;
  }
}

function renderDonationsList() {
  const filtered = allDonations.filter(d => {
    if (donationFilter === 'confirmed') return d.confirmed;
    if (donationFilter === 'unconfirmed') return !d.confirmed;
    return true;
  });
  if (!filtered.length) {
    el.adminDonationsList.innerHTML = `<p class="admin-empty">Nothing here.</p>`;
    return;
  }
  el.adminDonationsList.innerHTML = filtered.map(d => `
    <div class="admin-site-row" data-id="${esc(d.id)}">
      <div class="admin-site-main">
        <div class="admin-site-username">${esc(tierLabel(d.tier))}${d.customTag ? ` "${esc(d.customTag)}"` : ''} · ${money(d.amount, d.currency)} · ${esc(d.username)}.proves.work</div>
        <div class="admin-site-meta">Ref: ${esc(d.referenceNumber)}${d.email ? ` · ${esc(d.email)}` : ''}</div>
        ${d.note ? `<div class="admin-site-meta">"${esc(d.note)}"</div>` : ''}
        <div class="admin-site-meta">${formatDate(d.createdAt)}</div>
      </div>
      <span class="admin-status-pill ${d.confirmed ? 'live' : 'pending'}">${d.confirmed ? 'confirmed' : 'unconfirmed'}</span>
      <div class="admin-site-actions">
        ${!d.confirmed ? `
        <button class="btn btn-secondary btn-sm" data-donation-action="confirm" type="button">Confirm</button>
        <button class="btn btn-secondary btn-sm" data-donation-action="confirm-showcase" type="button">Confirm + showcase</button>
        ` : `
        <button class="btn btn-secondary btn-sm" data-donation-action="unconfirm" type="button">Unconfirm</button>
        `}
        <button class="btn btn-ghost btn-sm" data-donation-action="edit" type="button">Edit</button>
      </div>
    </div>
  `).join('');
}

async function confirmDonation(id, tagShowcase) {
  const data = await api('/api/admin/donations/confirm', { id, tagShowcase });
  if (!data.ok) { alertModal(data.error || 'Something went wrong.'); return; }
  await loadDonations();
  loadSites();
}

async function unconfirmDonation(id) {
  const data = await api('/api/admin/donations/unconfirm', { id });
  if (!data.ok) { alertModal(data.error || 'Something went wrong.'); return; }
  await loadDonations();
  loadSites();
}

function editDonationModal(donation) {
  const tierOptions = Object.keys(TIER_NAMES).map(t =>
    `<option value="${t}" ${donation.tier === t ? 'selected' : ''}>${TIER_NAMES[t]}</option>`
  ).join('');
  openModal(`
    <h3 class="modal-title">Edit donation</h3>
    <p class="modal-sub">Manually correct any field on this donation record.</p>
    <div class="admin-form-grid">
      <label class="admin-form-field">
        <span>Tier</span>
        <select id="editDonationTier">${tierOptions}</select>
      </label>
      <label class="admin-form-field">
        <span>Currency</span>
        <select id="editDonationCurrency">
          <option value="php" ${donation.currency === 'php' ? 'selected' : ''}>PHP</option>
          <option value="usd" ${donation.currency === 'usd' ? 'selected' : ''}>USD</option>
        </select>
      </label>
      <label class="admin-form-field">
        <span>Amount</span>
        <input type="number" id="editDonationAmount" value="${esc(donation.amount ?? '')}" min="0" step="0.01" />
      </label>
      <label class="admin-form-field">
        <span>Reference number</span>
        <input type="text" id="editDonationRef" value="${esc(donation.referenceNumber ?? '')}" />
      </label>
      <label class="admin-form-field">
        <span>Username</span>
        <input type="text" id="editDonationUsername" value="${esc(donation.username ?? '')}" />
      </label>
      <label class="admin-form-field">
        <span>Email</span>
        <input type="text" id="editDonationEmail" value="${esc(donation.email ?? '')}" />
      </label>
      <label class="admin-form-field admin-form-field-wide">
        <span>Tag / title (shown on their showcase heart badge)</span>
        <input type="text" id="editDonationCustomTag" value="${esc(donation.customTag ?? '')}" maxlength="28" placeholder="${esc(tierLabel(donation.tier))}" />
      </label>
      <label class="admin-form-field admin-form-field-wide">
        <span>Internal note (admin-only — not shown publicly)</span>
        <textarea id="editDonationNote" rows="2" placeholder="e.g. paid via GCash, confirmed by screenshot">${esc(donation.note ?? '')}</textarea>
        <span class="field-hint">To change what's shown on their showcase card, use "Edit" on the Sites tab instead — that's the Description field.</span>
      </label>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" id="cancelEditDonationBtn" type="button">Cancel</button>
      <button class="btn btn-primary btn-sm" id="saveEditDonationBtn" type="button">Save changes</button>
    </div>
  `, (root) => {
    root.querySelector('#cancelEditDonationBtn').addEventListener('click', closeModal);
    root.querySelector('#saveEditDonationBtn').addEventListener('click', async () => {
      const payload = {
        id: donation.id,
        tier: root.querySelector('#editDonationTier').value,
        currency: root.querySelector('#editDonationCurrency').value,
        amount: root.querySelector('#editDonationAmount').value,
        referenceNumber: root.querySelector('#editDonationRef').value,
        username: root.querySelector('#editDonationUsername').value,
        email: root.querySelector('#editDonationEmail').value,
        customTag: root.querySelector('#editDonationCustomTag').value,
        note: root.querySelector('#editDonationNote').value
      };
      const data = await api('/api/admin/donations/edit', payload);
      if (!data.ok) { alertModal(data.error || 'Something went wrong.'); return; }
      closeModal();
      await loadDonations();
      loadSites();
    });
  });
}

el.adminDonationsList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-donation-action]');
  if (!btn) return;
  const row = e.target.closest('.admin-site-row');
  const id = row.dataset.id;
  if (btn.dataset.donationAction === 'confirm') confirmDonation(id, false);
  else if (btn.dataset.donationAction === 'confirm-showcase') confirmDonation(id, true);
  else if (btn.dataset.donationAction === 'unconfirm') unconfirmDonation(id);
  else if (btn.dataset.donationAction === 'edit') {
    const donation = allDonations.find(d => d.id === id);
    if (donation) editDonationModal(donation);
  }
});

document.querySelectorAll('.admin-tabs [data-donation-filter]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tabs [data-donation-filter]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    donationFilter = tab.dataset.donationFilter;
    renderDonationsList();
  });
});

/* ── Audit log tab ────────────────────────────────────────────── */
async function loadAuditLog() {
  el.adminAuditList.innerHTML = `<p class="admin-empty admin-empty-sm">Loading…</p>`;
  const data = await api('/api/admin/audit-log');
  if (!data.ok) {
    el.adminAuditList.innerHTML = `<p class="admin-empty">${esc(data.error || 'Not authorized.')}</p>`;
    return;
  }
  renderAuditLog(data.entries || []);
}

function renderAuditLog(entries) {
  if (!entries.length) {
    el.adminAuditList.innerHTML = `<p class="admin-empty">No hard deletes yet.</p>`;
    return;
  }
  el.adminAuditList.innerHTML = entries.map(e => {
    const snap = e.snapshot;
    const details = snap ? [
      `was ${esc(snap.status)}`,
      snap.email ? esc(snap.email) : 'anonymous',
      snap.showcase ? 'was showcased' : null
    ].filter(Boolean).join(' · ') : 'no record snapshot available';
    return `
    <div class="admin-site-row">
      <div class="admin-site-main">
        <div class="admin-site-username">${esc(e.username)}.proves.work</div>
        <div class="admin-site-meta">${details}</div>
        <div class="admin-site-meta">deleted ${formatDate(e.deletedAt)} by ${esc(e.deletedBy)}</div>
      </div>
      <span class="admin-status-pill rejected">gone</span>
    </div>
  `;
  }).join('');
}

/* ── Messages tab ─────────────────────────────────────────────── */
async function loadContactMessages() {
  el.adminMessagesList.innerHTML = `<p class="admin-empty admin-empty-sm">Loading…</p>`;
  const data = await api('/api/admin/contact-messages');
  if (!data.ok) {
    el.adminMessagesList.innerHTML = `<p class="admin-empty">${esc(data.error || 'Not authorized.')}</p>`;
    return;
  }
  renderContactMessages(data.entries || []);
}

function renderContactMessages(entries) {
  if (!entries.length) {
    el.adminMessagesList.innerHTML = `<p class="admin-empty">No queued messages — either nobody's written in, or Resend is delivering everything straight to your inbox already.</p>`;
    return;
  }
  el.adminMessagesList.innerHTML = entries.map(m => `
    <div class="admin-site-row" data-key="${esc(m.key)}">
      <div class="admin-site-main">
        <div class="admin-site-username">${esc(m.name || '(no name given)')} ${m.email ? `&lt;${esc(m.email)}&gt;` : ''}</div>
        <div class="admin-site-meta" style="white-space:pre-wrap;">${esc(m.message)}</div>
        <div class="admin-site-meta">${formatDate(m.createdAt)}</div>
      </div>
      <button class="btn btn-ghost btn-sm admin-msg-done-btn" type="button" data-key="${esc(m.key)}">Mark handled</button>
    </div>
  `).join('');
  el.adminMessagesList.querySelectorAll('.admin-msg-done-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteContactMessage(btn.dataset.key));
  });
}

async function deleteContactMessage(key) {
  const data = await api('/api/admin/contact-messages/delete', { key });
  if (data.ok) {
    const row = el.adminMessagesList.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (row) row.remove();
    if (!el.adminMessagesList.querySelector('.admin-site-row')) {
      el.adminMessagesList.innerHTML = `<p class="admin-empty">No queued messages — either nobody's written in, or Resend is delivering everything straight to your inbox already.</p>`;
    }
  }
}

/* ── Boot ─────────────────────────────────────────────────────── */
(function init() {
  const account = getSavedAdminAccount();
  if (account && isAdminSessionExpired(account)) {
    clearAdminAccount();
    renderGoogleSignInButton();
    return;
  }
  if (account && ADMIN_EMAILS.has(account.email)) {
    showPanel();
  } else {
    renderGoogleSignInButton();
  }
})();
