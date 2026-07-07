import { esc } from './store.js';

// Same client ID as editor.js — must match the Worker's GOOGLE_CLIENT_ID.
const GOOGLE_CLIENT_ID = '41010460965-oti1phnr8kdbij312qijrg82bc2japj7.apps.googleusercontent.com';
const ADMIN_ACCOUNT_KEY = 'proveswork_admin_google_account';

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
  try { return JSON.parse(localStorage.getItem(ADMIN_ACCOUNT_KEY) || 'null'); }
  catch { return null; }
}
function saveAdminAccount(account) { localStorage.setItem(ADMIN_ACCOUNT_KEY, JSON.stringify(account)); }
function clearAdminAccount() { localStorage.removeItem(ADMIN_ACCOUNT_KEY); }

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

let activeFilter = 'pending';
let allSites = [];

function renderAccountSlot() {
  const account = getSavedAdminAccount();
  if (!account) { el.adminAccountSlot.innerHTML = ''; return; }
  el.adminAccountSlot.innerHTML = `
    <span style="font-size:0.85rem;color:var(--color-text-muted);">${esc(account.email)}</span>
    <button class="btn btn-ghost btn-sm" id="adminSignOutBtn" type="button" style="margin-left:0.6rem;">Sign out</button>
  `;
  document.getElementById('adminSignOutBtn').addEventListener('click', () => {
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

function renderGoogleSignInButton() {
  if (!(window.google && window.google.accounts && window.google.accounts.id)) {
    el.adminSignInSlot.innerHTML = `<p class="username-status warn">Google sign-in script hasn't loaded — check your connection and reload.</p>`;
    return;
  }
  window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
  window.google.accounts.id.renderButton(el.adminSignInSlot, { theme: 'outline', size: 'large', text: 'signin_with' });
}

function showPanel() {
  el.adminGate.classList.add('hidden');
  el.adminPanel.classList.remove('hidden');
  renderAccountSlot();
  loadSites();
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
      renderList();
      return;
    }
    allSites = data.sites;
    el.adminListStatus.textContent = '';
    renderList();
  } catch (err) {
    el.adminListStatus.textContent = 'Could not reach the admin API — check the Worker is deployed.';
    el.adminListStatus.className = 'username-status warn';
  }
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
        <div class="admin-site-username">${esc(s.username)}.proves.work${(s.status === 'live' && s.ownerEmail) ? ` <span class="admin-owner-chip">${esc(s.ownerEmail)}</span>` : ''}</div>
        <div class="admin-site-meta">${s.ownerEmail ? esc(s.ownerEmail) : 'anonymous'} · updated ${s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '—'}</div>
      </div>
      <span class="admin-status-pill ${s.status}">${s.status}</span>
      <div class="admin-site-actions">
        <button class="btn btn-ghost btn-sm admin-view-btn" data-action="view" type="button">View</button>
        ${s.status === 'pending' ? `<button class="btn btn-secondary btn-sm" data-action="approve" type="button">Approve</button>
          <button class="btn btn-ghost btn-sm" data-action="reject" type="button">Reject</button>` : ''}
        ${s.status === 'live' ? `<button class="btn btn-ghost btn-sm" data-action="reject" type="button">Unpublish</button>` : ''}
        ${(s.status === 'rejected' || s.status === 'deleted') ? `<button class="btn btn-secondary btn-sm" data-action="restore" type="button">Restore</button>` : ''}
      </div>
    </div>
  `).join('');
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

async function viewSite(username) {
  const account = getSavedAdminAccount();
  try {
    const res = await fetch('/api/admin/site-html', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ googleCredential: account.credential, username })
    });
    const data = await res.json();
    if (!data.ok) { alertModal(data.error || 'Could not load that site.'); return; }
    const blob = new Blob([data.html], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank', 'noopener');
  } catch (err) {
    alertModal('Could not reach the admin API.');
  }
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
  if (action === 'view') viewSite(username);
  else if (action === 'approve') setStatus(username, 'live');
  else if (action === 'reject') setStatus(username, 'rejected');
  else if (action === 'restore') setStatus(username, 'pending');
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
  if (account && ADMIN_EMAILS.has(account.email)) {
    showPanel();
  } else {
    renderGoogleSignInButton();
  }
})();
