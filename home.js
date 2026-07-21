/* ============================================================
   home.js — claim form, donation form, infinite showcase
   ============================================================ */

window.addEventListener('load', () => {
  document.body.classList.remove('is-loading');
});

/* ── Live visitor counter ─────────────────────────────────── */
(function initVisitCounter() {
  const el = document.getElementById('visitCount');
  if (!el) return;
  fetch('/api/visits', { method: 'POST' })
    .then(res => res.ok ? res.json() : Promise.reject())
    .then(data => { el.textContent = data.count.toLocaleString(); })
    .catch(() => {
      const tag = el.closest('.user-count-tag');
      if (tag) tag.style.display = 'none';
    });
})();

/* ── Claim tabs (no-code / coder) ────────────────────────── */
const claimTabs = document.querySelectorAll('.claim-tab');
const nocodeFields = document.getElementById('nocodeFields');
const coderFields = document.getElementById('coderFields');
let claimMode = 'nocode';

claimTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    claimTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    claimMode = tab.dataset.mode;
    nocodeFields.classList.toggle('hidden', claimMode !== 'nocode');
    coderFields.classList.toggle('hidden', claimMode !== 'coder');
  });
});

/* ── Claim form submit ───────────────────────────────────── */
const claimForm = document.getElementById('claimForm');
const claimStatus = document.getElementById('claimStatus');

claimForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  claimStatus.textContent = 'Submitting…';
  claimStatus.className = 'username-status';

  const username = document.getElementById('claimUsername').value.trim().toLowerCase();
  const body = { mode: claimMode, username };

  if (claimMode === 'coder') {
    body.repo = document.getElementById('claimRepo').value.trim();
    body.target = document.getElementById('claimTargetCoder').value.trim();
    body.email = document.getElementById('claimEmailCoder').value.trim();
  } else {
    body.target = document.getElementById('claimTargetNocode').value.trim();
    body.email = document.getElementById('claimEmailNocode').value.trim();
  }

  try {
    const res = await fetch('/api/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong.');
    claimStatus.textContent = `${username}.proves.work submitted — pending review.`;
    claimStatus.classList.add('ok');
    claimForm.reset();
  } catch (err) {
    claimStatus.textContent = err.message;
    claimStatus.classList.add('error');
  }
});

/* ── Donation form submit ────────────────────────────────── */
const donateForm = document.getElementById('donateForm');
const donateStatus = document.getElementById('donateStatus');

donateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  donateStatus.textContent = 'Submitting…';
  donateStatus.className = 'username-status';

  const body = {
    type: 'donation',
    tier: document.getElementById('donateTier').value,
    amount: document.getElementById('donateAmount').value,
    referenceNumber: document.getElementById('donateRef').value.trim(),
    username: document.getElementById('donateUsername').value.trim().toLowerCase(),
    email: document.getElementById('donateEmail').value.trim()
  };

  try {
    const res = await fetch('/api/contact', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong.');
    donateStatus.textContent = 'Thank you! We\'ll confirm your reference number shortly.';
    donateStatus.classList.add('ok');
    donateForm.reset();
  } catch (err) {
    donateStatus.textContent = err.message;
    donateStatus.classList.add('error');
  }
});

/* ── Heart tier popup ─────────────────────────────────────── */
(function initTierPopup() {
  const popup = document.getElementById('tierPopup');
  const closeBtn = document.getElementById('tierPopupClose');
  const continueBtn = document.getElementById('tierPopupContinue');
  const titleEl = document.getElementById('tierPopupTitle');
  const amountEl = document.getElementById('tierPopupAmount');
  const heartEl = document.getElementById('tierPopupHeart');
  const heartButtons = document.querySelectorAll('.heart-link[data-tier]');
  if (!popup) return;

  const tierNames = { normal: 'Normal Heart', gold: 'Gold Heart', diamond: 'Diamond Heart', real: 'Real Heart', ghost: 'Ghost Heart' };
  let activeTier = null;
  let activeAmount = null;

  function openPopup(tier, amount) {
    activeTier = tier;
    activeAmount = amount;
    titleEl.textContent = tierNames[tier] || 'Donate';
    amountEl.textContent = amount;
    heartEl.className = `pixel-heart tier-popup-heart pixel-heart--${tier}`;
    popup.classList.remove('hidden');
  }

  function closePopup() { popup.classList.add('hidden'); }

  heartButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      openPopup(btn.dataset.tier, btn.dataset.amount);
    });
  });

  closeBtn.addEventListener('click', closePopup);
  popup.addEventListener('click', (e) => { if (e.target === popup) closePopup(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePopup(); });

  continueBtn.addEventListener('click', () => {
    const tierSelect = document.getElementById('donateTier');
    const amountInput = document.getElementById('donateAmount');
    if (tierSelect) tierSelect.value = activeTier;
    if (amountInput) amountInput.value = activeAmount;
    closePopup();
    document.getElementById('donate')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('donateRef')?.focus({ preventScroll: true });
  });
})();

/* ── Slide tracking: fade each slide in as it becomes active ────── */
(function initSlideFade() {
  const slides = Array.from(document.querySelectorAll('main .section, .site-footer'));
  if (!slides.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      entry.target.classList.toggle('in-view', entry.isIntersecting);
    });
  }, { threshold: 0.35 });

  slides.forEach(s => observer.observe(s));
})();

/* ── Infinite showcase ───────────────────────────────────── */
const showcaseGrid = document.getElementById('showcaseGrid');
const showcaseStatus = document.getElementById('showcaseStatus');
let showcaseCursor = null;
let showcaseLoading = false;
let showcaseDone = false;

function renderShowcaseItem(item) {
  const card = document.createElement('a');
  card.className = 'showcase-card';
  card.href = `https://${item.username}.proves.work`;
  card.target = '_blank';
  card.rel = 'noopener';
  card.innerHTML = `
    <div class="showcase-card-name">${item.username}.proves.work</div>
    ${item.mode === 'coder' ? `<div class="showcase-card-badge">⚡ open source${item.repoName ? ' · ' + item.repoName : ''}</div>` : ''}
  `;
  return card;
}

async function loadShowcasePage() {
  if (showcaseLoading || showcaseDone) return;
  showcaseLoading = true;
  showcaseStatus.textContent = 'Loading…';
  try {
    const url = new URL('/api/showcase', window.location.origin);
    if (showcaseCursor) url.searchParams.set('cursor', showcaseCursor);
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok) throw new Error();
    data.items.forEach(item => showcaseGrid.appendChild(renderShowcaseItem(item)));
    showcaseCursor = data.cursor;
    if (!showcaseCursor) {
      showcaseDone = true;
      showcaseStatus.textContent = showcaseGrid.children.length ? '' : 'No showcased sites yet — donate to be featured!';
    } else {
      showcaseStatus.textContent = '';
    }
  } catch {
    showcaseStatus.textContent = 'Could not load the showcase right now.';
  } finally {
    showcaseLoading = false;
  }
}

const showcaseObserver = new IntersectionObserver(entries => {
  if (entries.some(e => e.isIntersecting)) loadShowcasePage();
}, { rootMargin: '300px' });

showcaseObserver.observe(document.getElementById('showcase'));
loadShowcasePage();
