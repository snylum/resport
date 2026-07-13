import { esc } from './store.js';

// Same client ID as editor.js — must match the Worker's GOOGLE_CLIENT_ID.
const GOOGLE_CLIENT_ID = '41010460965-oti1phnr8kdbij312qijrg82bc2japj7.apps.googleusercontent.com';
const ADMIN_ACCOUNT_KEY = 'proveswork_admin_google_account';
// Auto sign-out after this long with no mouse/keyboard/touch activity —
// an admin dashboard that can approve/delete sites shouldn't stay
// signed in forever on a shared or unattended machine.
const ADMIN_IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const ADMIN_IDLE_CHECK_INTERVAL_MS = 30 * 1000;

// This client-side check is only for UX (deciding which screen to show
// instantly on sign-in) — it is NOT the real security boundary. Every
// /api/admin/* call re-verifies the Google ID token AND the email
// server-side in the Worker, so a person can't just edit this file (or
// their browser) to grant themselves admin access.
const ADMIN_EMAILS = new Set(['snylumagbas@gmail.com']);

const el = {
  adminGate: document.getElementById('adminGate'),
  adminGateStatus: document.getElementById('adminGateStatus'),
  adminSignInSlot: document.getElementById('adminSignInSlot'),
  adminAccountSlot: document.getElementById('adminAccountSlot'),
  adminPanel: document.getElementById('adminPanel'),
  adminSitesList: document.getElementById('adminSitesList'),
  adminListStatus: document.getElementById('adminListStatus'),
  adminSearch: document.getElementById('adminSearch'),
  adminRefreshBtn: document.getElementById('adminRefreshBtn'),
  adminOverviewView: document.getElementById('adminOverviewView'),
  adminSitesView: document.getElementById('adminSitesView'),
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
  modalCloseBtn: document.getElementById('modalCloseBtn'),
};

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

// Bumps lastActiveAt on the stored account so the idle timer resets —
// called from real user interaction (mouse/keyboard/touch/click), not
// on a timer itself.
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
    if (account && isAdminSessionExpired(account)) {
      signOutForInactivity();
    }
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

let activeFilter = 'all';
let activeView = 'overview';
let allSites = [];
const CURRENCY = '₱';

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
// truly giving up (see the same fix/comment in editor.js).
function waitForGoogleIdentity(callback, { timeoutMs = 4000, intervalMs = 100 } = {}) {
  const isReady = () => !!(window.google && window.google.accounts && window.google.accounts.id);
  if (isReady()) { callback(true); return; }
  const start = Date.now();
  const timer = setInterval(() => {
    if (isReady()) {
      clearInterval(timer);
      callback(true);
    } else if (Date.now() - start >= timeoutMs) {
      clearInterval(timer);
      callback(false);
    }
  }, intervalMs);
}

function renderGoogleSignInButton() {
  el.adminSignInSlot.innerHTML = `<p class="username-status">Loading Google sign-in…</p>`;
  waitForGoogleIdentity((ready) => {
    if (!ready) {
      el.adminSignInSlot.innerHTML = `<p class="username-status warn">Google sign-in script hasn't loaded — check your connection and reload.</p>`;
      return;
    }
    window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
    window.google.accounts.id.renderButton(el.adminSignInSlot, { theme: 'outline', size: 'large', text: 'signin_with' });
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

document.querySelectorAll('.admin-view-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-view-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeView = tab.dataset.view;
    el.adminOverviewView.classList.toggle('hidden', activeView !== 'overview');
    el.adminSitesView.classList.toggle('hidden', activeView !== 'sites');
    el.adminMessagesView.classList.toggle('hidden', activeView !== 'messages');
    el.adminAuditView.classList.toggle('hidden', activeView !== 'audit');
    if (activeView === 'audit') loadAuditLog();
    if (activeView === 'messages') loadContactMessages();
  });
});

function money(n) {
  return `${CURRENCY}${Number(n || 0).toLocaleString()}`;
}

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

// Flattens every site's payments log into one list (each entry tagged
// with the username it belongs to), newest first — the single source
// both the revenue chart and the "Recent payments" list are built from.
function allPayments() {
  const out = [];
  allSites.forEach(s => {
    (s.payments || []).forEach(p => out.push({ ...p, username: s.username }));
  });
  out.sort((a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0));
  return out;
}

// A tiny, dependency-free horizontal bar chart — good enough for a
// handful of categories/months without pulling in a charting library.
// `rows` is [{ label, value, hint? }]; bars scale relative to the
// largest value in the set.
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

function renderOverview() {
  const now = new Date();
  const total = allSites.length;
  const byStatus = { live: 0, pending: 0, rejected: 0, deleted: 0 };
  let paidActive = 0, expiringSoon = 0;
  allSites.forEach(s => {
    if (byStatus[s.status] != null) byStatus[s.status]++;
    if (s.paid && s.paidUntil) {
      const daysLeft = Math.ceil((new Date(s.paidUntil).getTime() - now.getTime()) / 86400000);
      if (daysLeft > 0) {
        paidActive++;
        if (daysLeft <= 7) expiringSoon++;
      }
    }
  });

  const payments = allPayments();
  const totalRevenue = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthRevenue = payments
    .filter(p => new Date(p.paidAt || 0) >= monthStart)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // ── Stat cards ──────────────────────────────────────────────
  const cards = [
    { label: 'Total sites', value: total },
    { label: 'Live', value: byStatus.live, tone: 'ok' },
    { label: 'Pending review', value: byStatus.pending, tone: byStatus.pending ? 'warn' : '' },
    { label: 'Paid & active', value: paidActive, tone: 'ok' },
    { label: 'Expiring ≤7 days', value: expiringSoon, tone: expiringSoon ? 'warn' : '' },
    { label: 'Revenue this month', value: money(monthRevenue) },
    { label: 'Total revenue', value: money(totalRevenue) },
    { label: 'Payments logged', value: payments.length },
  ];
  el.adminStatsGrid.innerHTML = cards.map(c => `
    <div class="admin-stat-card">
      <div class="admin-stat-value ${c.tone || ''}">${esc(String(c.value))}</div>
      <div class="admin-stat-label">${esc(c.label)}</div>
    </div>
  `).join('');

  // ── Revenue by month (last 6 months, oldest → newest) ────────
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString(undefined, { month: 'short' }), value: 0 });
  }
  payments.forEach(p => {
    const d = new Date(p.paidAt || 0);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = months.find(m => m.key === key);
    if (bucket) bucket.value += Number(p.amount) || 0;
  });
  renderBarChart(el.adminRevenueChart, months, { formatValue: money });

  // ── Sites by status ───────────────────────────────────────────
  renderBarChart(el.adminStatusChart, [
    { label: 'Live', value: byStatus.live, color: 'var(--color-success)' },
    { label: 'Pending', value: byStatus.pending, color: 'var(--color-warning)' },
    { label: 'Rejected', value: byStatus.rejected, color: 'var(--color-danger)' },
    { label: 'Deleted', value: byStatus.deleted, color: 'var(--color-text-muted)' },
  ], { formatValue: (v) => String(v) });

  // ── Recent payments log ───────────────────────────────────────
  el.adminPaymentsCount.textContent = payments.length ? `${payments.length} total` : '';
  if (!payments.length) {
    el.adminPaymentsLog.innerHTML = `<p class="admin-empty admin-empty-sm">No payments logged yet — mark a site paid from the Sites tab to start tracking.</p>`;
  } else {
    el.adminPaymentsLog.innerHTML = payments.slice(0, 15).map(p => `
      <div class="admin-payment-row">
        <div class="admin-payment-main">
          <span class="admin-payment-username">${esc(p.username)}.proves.work</span>
          <span class="admin-payment-meta">${formatDate(p.paidAt)}${p.durationMonths ? ` · ${p.durationMonths}mo` : ''}${p.referenceNumber ? ` · ref: ${esc(p.referenceNumber)}` : ''}</span>
        </div>
        <span class="admin-payment-amount">${money(p.amount)}</span>
      </div>
    `).join('');
  }
}

async function loadSites() {
  const account = getSavedAdminAccount();
  el.adminListStatus.textContent = 'Loading sites…';
  el.adminListStatus.className = 'username-status';
  try {
    const res = await fetch('/api/admin/sites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ googleCredential: account.credential })
    });
    const data = await res.json();
    if (!data.ok) {
      el.adminListStatus.textContent = data.error || 'Not authorized.';
      el.adminListStatus.className = 'username-status warn';
      allSites = [];
      renderOverview();
      renderList();
      return;
    }
    allSites = data.sites;
    el.adminListStatus.textContent = '';
    renderOverview();
    renderList();
  } catch (err) {
    el.adminListStatus.textContent = 'Could not reach the admin API — check the Worker is deployed.';
    el.adminListStatus.className = 'username-status warn';
  }
}

// Renders the little " · N days left" / " · expired" suffix shown next
// to "✓ Paid" on a site row, based on the paidUntil date the Worker
// computed when the admin marked it paid.
function paidCountdownLabel(s) {
  if (!s.paidUntil) return '';
  const msLeft = new Date(s.paidUntil).getTime() - Date.now();
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  const durationLabel = s.paidDurationMonths ? ` (${s.paidDurationMonths}mo)` : '';
  if (daysLeft <= 0) return ` · <span class="admin-paid-expired">expired ${Math.abs(daysLeft)}d ago${durationLabel}</span>`;
  if (daysLeft <= 7) return ` · <span class="admin-paid-soon">${daysLeft}d left${durationLabel}</span>`;
  return ` · ${daysLeft}d left${durationLabel}`;
}

function renderList() {
  const q = (el.adminSearch.value || '').trim().toLowerCase();
  const filtered = allSites.filter(s => {
    const matchesFilter = activeFilter === 'all' || s.status === activeFilter;
    const matchesQuery = !q || s.username.includes(q) || (s.ownerEmail || '').toLowerCase().includes(q);
    return matchesFilter && matchesQuery;
  });

  if (!filtered.length) {
    el.adminSitesList.innerHTML = `<p class="admin-empty">Nothing here.</p>`;
    return;
  }

  el.adminSitesList.innerHTML = filtered.map(s => `
    <div class="admin-site-row" data-username="${esc(s.username)}">
      <div class="admin-site-main">
        <div class="admin-site-username">${esc(s.username)}.proves.work${s.kind === 'domain' ? ` <span class="admin-kind-badge">Domain only</span>` : ''}${(s.status === 'live' && s.ownerEmail) ? ` <span class="admin-owner-chip">${esc(s.ownerEmail)}</span>` : ''}</div>
        <div class="admin-site-meta">${s.ownerEmail ? esc(s.ownerEmail) : 'anonymous'} · updated ${s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '—'}</div>
        ${s.paid ? `<div class="admin-site-meta admin-site-paid">✓ Paid${s.amountPaid != null ? ` ${money(s.amountPaid)}` : ''}${s.referenceNumber ? ` · ref: ${esc(s.referenceNumber)}` : ''}${paidCountdownLabel(s)}</div>` : ''}
        ${!s.paid && s.buyerReferenceNumber ? `<div class="admin-site-meta admin-site-proof">💳 Buyer submitted proof of payment — ref: <strong>${esc(s.buyerReferenceNumber)}</strong> (unverified, check it against your payment provider before marking paid)</div>` : ''}
        ${s.redirectUrl ? `<div class="admin-site-meta">🎭 masking ${esc(s.redirectUrl)}</div>` : ''}
      </div>
      <span class="admin-status-pill ${s.status}">${s.status}</span>
      <div class="admin-site-actions">
        <button class="btn btn-ghost btn-sm admin-view-btn" data-action="view" type="button">View</button>
        ${s.status === 'pending' ? `<button class="btn btn-secondary btn-sm" data-action="approve" type="button">Approve</button>
          <button class="btn btn-ghost btn-sm" data-action="reject" type="button">Reject</button>` : ''}
        ${s.status === 'live' ? `<button class="btn btn-ghost btn-sm" data-action="reject" type="button">Unpublish</button>` : ''}
        ${(s.status === 'rejected' || s.status === 'deleted') ? `<button class="btn btn-secondary btn-sm" data-action="restore" type="button">Restore</button>` : ''}
        <button class="btn btn-ghost btn-sm" data-action="${s.paid ? 'unmark-paid' : 'mark-paid'}" data-kind="${s.kind || 'site'}" type="button">${s.paid ? 'Unmark paid' : '$ Mark paid'}</button>
        <button class="btn btn-danger btn-sm" data-action="hard-delete" type="button">Delete</button>
      </div>
    </div>
  `).join('');
}

// Hard-delete audit trail — fetched lazily the first time the tab is
// opened, then re-fetched on every click (cheap: admin-only, capped
// at 200 entries server-side). Entries are read-only: there's no
// action button here because a hard delete really is permanent — the
// point of this view is visibility ("who deleted @foo, and when"),
// not recovery.
async function loadAuditLog() {
  const account = getSavedAdminAccount();
  el.adminAuditList.innerHTML = `<p class="admin-empty admin-empty-sm">Loading…</p>`;
  try {
    const res = await fetch('/api/admin/audit-log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ googleCredential: account.credential })
    });
    const data = await res.json();
    if (!data.ok) {
      el.adminAuditList.innerHTML = `<p class="admin-empty">${esc(data.error || 'Not authorized.')}</p>`;
      return;
    }
    renderAuditLog(data.entries || []);
  } catch (err) {
    el.adminAuditList.innerHTML = `<p class="admin-empty">Could not reach the admin API — check the Worker is deployed.</p>`;
  }
}

function renderAuditLog(entries) {
  if (!entries.length) {
    el.adminAuditList.innerHTML = `<p class="admin-empty">No hard deletes yet.</p>`;
    return;
  }
  el.adminAuditList.innerHTML = entries.map(e => {
    const snap = e.snapshot;
    const kindBadge = snap && snap.kind === 'domain' ? ` <span class="admin-kind-badge">Domain only</span>` : '';
    const details = snap ? [
      `was ${esc(snap.status)}`,
      snap.ownerEmail ? esc(snap.ownerEmail) : 'anonymous',
      snap.paid ? `paid${snap.amountPaid != null ? ` ${money(snap.amountPaid)}` : ''}` : null
    ].filter(Boolean).join(' · ') : 'no record snapshot available';
    return `
    <div class="admin-site-row">
      <div class="admin-site-main">
        <div class="admin-site-username">${esc(e.username)}.proves.work${kindBadge}</div>
        <div class="admin-site-meta">${details}</div>
        <div class="admin-site-meta">deleted ${new Date(e.deletedAt).toLocaleString()} by ${esc(e.deletedBy)}</div>
      </div>
      <span class="admin-status-pill deleted">gone</span>
    </div>
  `;
  }).join('');
}

async function loadContactMessages() {
  const account = getSavedAdminAccount();
  el.adminMessagesList.innerHTML = `<p class="admin-empty admin-empty-sm">Loading…</p>`;
  try {
    const res = await fetch('/api/admin/contact-messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ googleCredential: account.credential })
    });
    const data = await res.json();
    if (!data.ok) {
      el.adminMessagesList.innerHTML = `<p class="admin-empty">${esc(data.error || 'Not authorized.')}</p>`;
      return;
    }
    renderContactMessages(data.entries || []);
  } catch (err) {
    el.adminMessagesList.innerHTML = `<p class="admin-empty">Could not reach the admin API — check the Worker is deployed.</p>`;
  }
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
        <div class="admin-site-meta">${new Date(m.createdAt).toLocaleString()} · from ${esc(m.ip || 'unknown IP')}</div>
      </div>
      <button class="btn btn-ghost btn-sm admin-msg-done-btn" type="button" data-key="${esc(m.key)}">Mark handled</button>
    </div>
  `).join('');
  el.adminMessagesList.querySelectorAll('.admin-msg-done-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteContactMessage(btn.dataset.key));
  });
}

async function deleteContactMessage(key) {
  const account = getSavedAdminAccount();
  try {
    const res = await fetch('/api/admin/contact-messages/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ googleCredential: account.credential, key })
    });
    const data = await res.json();
    if (data.ok) {
      const row = el.adminMessagesList.querySelector(`[data-key="${CSS.escape(key)}"]`);
      if (row) row.remove();
      if (!el.adminMessagesList.querySelector('.admin-site-row')) {
        el.adminMessagesList.innerHTML = `<p class="admin-empty">No queued messages — either nobody's written in, or Resend is delivering everything straight to your inbox already.</p>`;
      }
    }
  } catch {
    // silent — worst case the row just stays until next refresh
  }
}

async function setStatus(username, status) {
  const account = getSavedAdminAccount();
  const res = await fetch('/api/admin/set-status', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ googleCredential: account.credential, username, status })
  });
  const data = await res.json();
  if (!data.ok) {
    alertModal(data.error || 'Something went wrong.');
    return;
  }
  loadSites();
}

async function hardDeleteSite(username) {
  const account = getSavedAdminAccount();
  const res = await fetch('/api/admin/delete-site', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ googleCredential: account.credential, username })
  });
  const data = await res.json();
  if (!data.ok) {
    alertModal(data.error || 'Something went wrong.');
    return;
  }
  loadSites();
}

function confirmHardDelete(username) {
  openModal(`
    <h3 class="modal-title" id="modalTitle">Permanently delete @${esc(username)}?</h3>
    <p class="modal-sub">This erases the site record entirely and immediately frees up <strong>${esc(username)}.proves.work</strong> for anyone to claim. This can't be undone — restoring won't work after this.</p>
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

async function setPaid(username, paid, referenceNumber, durationMonths, amount, alsoApprove) {
  const account = getSavedAdminAccount();
  const res = await fetch('/api/admin/set-paid', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ googleCredential: account.credential, username, paid, referenceNumber, durationMonths, amount })
  });
  const data = await res.json();
  if (!data.ok) {
    alertModal(data.error || 'Something went wrong.');
    return;
  }
  // Marking paid and approving-to-live are separate fields on the
  // record, so a site marked paid while still 'pending' used to just
  // sit there paid-but-invisible — no portfolio, no ★ Active Job
  // Hunter badge on /showcase, nothing — until someone remembered to
  // also click Approve. Since confirming payment is itself a form of
  // sign-off, fold the approval into this same action.
  if (alsoApprove) {
    await fetch('/api/admin/set-status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ googleCredential: account.credential, username, status: 'live' })
    });
  }
  loadSites();
}

// Scaling one-time price for a domain-only reservation: ₱199 for 1 month
// up to ₱599 for the max 12 months. Kept in sync with worker/src/index.js
// and index.html's copy of the same formula.
function domainPriceForMonths(months) {
  const m = Math.min(Math.max(Number(months) || 1, 1), 12);
  return Math.round(199 + (599 - 199) * (m - 1) / 11);
}

// "Support the project" — Active Job Hunter badge + Recruiter
// Password Lock bundle. Interpolated between 1/3/6/12-month anchors
// and snapped to a friendly .49/.99 ending, same formula as
// supportPriceForMonths in worker/src/index.js (PHP anchors shown
// here since this dashboard bookkeeps in ₱ regardless of which
// currency the buyer actually paid in — see requestedCurrency).
const SUPPORT_ANCHORS_PHP = { 1: 99, 3: 249, 6: 499, 12: 999 };
function snapToFriendlyPrice(raw) {
  const base = Math.floor(raw);
  const candidates = [base - 1 + 0.49, base - 1 + 0.99, base + 0.49, base + 0.99];
  let best = candidates[0], bestDiff = Math.abs(raw - best);
  for (const c of candidates) {
    if (c <= 0) continue;
    const diff = Math.abs(raw - c);
    if (diff < bestDiff) { best = c; bestDiff = diff; }
  }
  return Math.max(best, 0.49);
}
function sitePriceForMonths(months) {
  const m = Math.min(Math.max(Number(months) || 1, 1), 12);
  const points = [1, 3, 6, 12];
  let lo = 1, hi = 12;
  for (let i = 0; i < points.length - 1; i++) {
    if (m >= points[i] && m <= points[i + 1]) { lo = points[i]; hi = points[i + 1]; break; }
  }
  const t = hi === lo ? 0 : (m - lo) / (hi - lo);
  const raw = SUPPORT_ANCHORS_PHP[lo] + (SUPPORT_ANCHORS_PHP[hi] - SUPPORT_ANCHORS_PHP[lo]) * t;
  return Math.min(Math.max(snapToFriendlyPrice(raw), SUPPORT_ANCHORS_PHP[1]), SUPPORT_ANCHORS_PHP[12]);
}

function priceForMonths(kind, months) {
  return kind === 'domain' ? domainPriceForMonths(months) : sitePriceForMonths(months);
}

function openMarkPaidModal(username, currentRef, kind = 'site', requestedMonths, currentStatus) {
  const isDomain = kind === 'domain';
  const needsApproval = currentStatus === 'pending';
  const defaultMonths = isDomain ? (Number(requestedMonths) || 12) : 3;
  const defaultAmount = priceForMonths(kind, defaultMonths);
  openModal(`
    <h3 class="modal-title" id="modalTitle">Mark @${esc(username)} as paid</h3>
    <p class="modal-sub">${isDomain
      ? `Domain-only reservation — scaling rate from ₱199 (1 mo) to ₱599 (12 mo, max). ${requestedMonths ? `They requested ${requestedMonths} month${requestedMonths > 1 ? 's' : ''}.` : ''} Adjust if this was a promo or partial payment.`
      : `Support donation — Active Job Hunter badge + Recruiter Password Lock. ₱99 (1 mo) up to ₱999 (12 mo, max), or the buyer may have paid in USD ($4.99-$49.99)${requestedMonths ? ` — they requested ${requestedMonths} month${requestedMonths > 1 ? 's' : ''}` : ''}. Record what was actually received, how long it covers, and optionally a reference number.`}</p>
    ${needsApproval ? `<p class="modal-sub" style="font-size:0.8rem;">This site is still <strong>pending</strong> — marking it paid will also approve it live, otherwise it stays invisible (no showcase badge) despite being paid.</p>` : ''}
    <div class="admin-modal-field">
      <label for="paidAmountInput" style="display:block;font-size:0.8rem;color:var(--color-text-muted);margin-bottom:0.3rem;">Amount received (${CURRENCY})</label>
      <input type="number" id="paidAmountInput" min="0" step="1" value="${defaultAmount}" autocomplete="off" />
    </div>
    <div class="admin-modal-field">
      <label for="paidDurationSelect" style="display:block;font-size:0.8rem;color:var(--color-text-muted);margin-bottom:0.3rem;">Duration</label>
      <select id="paidDurationSelect">
        <option value="1"${defaultMonths === 1 ? ' selected' : ''}>1 month</option>
        <option value="3"${defaultMonths === 3 ? ' selected' : ''}>3 months${isDomain ? '' : ' (standard)'}</option>
        <option value="4"${defaultMonths === 4 ? ' selected' : ''}>4 months</option>
        <option value="6"${defaultMonths === 6 ? ' selected' : ''}>6 months</option>
        <option value="12"${defaultMonths === 12 ? ' selected' : ''}>12 months${isDomain ? ' (max)' : ''}</option>
      </select>
    </div>
    <div class="admin-modal-field">
      <input type="text" id="paidRefInput" placeholder="Reference number (optional)" value="${esc(currentRef || '')}" autocomplete="off" />
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" id="cancelPaidBtn" type="button">Cancel</button>
      <button class="btn btn-secondary btn-sm" id="confirmPaidBtn" type="button">Mark paid${needsApproval ? ' & approve' : ''}</button>
    </div>
  `, (root) => {
    root.querySelector('#cancelPaidBtn').addEventListener('click', closeModal);
    // Nudge the amount to the standard scaling rate as the admin changes
    // duration — still freely editable for promos/partial payments.
    root.querySelector('#paidDurationSelect').addEventListener('change', (e) => {
      root.querySelector('#paidAmountInput').value = priceForMonths(kind, e.target.value);
    });
    root.querySelector('#confirmPaidBtn').addEventListener('click', () => {
      const ref = root.querySelector('#paidRefInput').value.trim();
      const durationMonths = Number(root.querySelector('#paidDurationSelect').value) || (isDomain ? 12 : 3);
      const amount = Number(root.querySelector('#paidAmountInput').value) || 0;
      setPaid(username, true, ref, durationMonths, amount, needsApproval);
      closeModal();
    });
  });
}

// Same apex the Worker serves published sites on (<username>.proves.work).
const PUBLISH_APEX = 'proves.work';

async function viewSite(username) {
  window.open(`https://${username}.${PUBLISH_APEX}`, '_blank', 'noopener');
}

function alertModal(message) {
  openModal(`
    <h3 class="modal-title">Heads up</h3>
    <p class="modal-sub">${esc(message)}</p>
    <div class="modal-actions"><button class="btn btn-secondary btn-sm" id="alertOkBtn" type="button">OK</button></div>
  `, (root) => root.querySelector('#alertOkBtn').addEventListener('click', closeModal));
}

el.adminSitesList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const row = e.target.closest('.admin-site-row');
  const username = row.dataset.username;
  const action = btn.dataset.action;
  const site = allSites.find(s => s.username === username);
  if (action === 'view') viewSite(username);
  else if (action === 'approve') setStatus(username, 'live');
  else if (action === 'reject') setStatus(username, 'rejected');
  // Restoring brings the site straight back to 'live' rather than
  // dropping it into 'pending' for re-review — the Worker re-promotes
  // whichever snapshot was last approved (liveHtml), or the latest
  // draft if nothing was ever approved, so the site comes back as
  // close to its last published version as possible.
  else if (action === 'restore') setStatus(username, 'live');
  else if (action === 'hard-delete') confirmHardDelete(username);
  else if (action === 'mark-paid') openMarkPaidModal(username, (site && (site.referenceNumber || site.buyerReferenceNumber)) || '', (site && site.kind) || 'site', site && site.requestedMonths, site && site.status);
  else if (action === 'unmark-paid') setPaid(username, false, '');
});

document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeFilter = tab.dataset.filter;
    renderList();
  });
});

el.adminSearch.addEventListener('input', renderList);
el.adminRefreshBtn.addEventListener('click', loadSites);

// ── Boot ─────────────────────────────────────────────────────
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
