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
const claimIntroNocode = document.getElementById('claimIntroNocode');
const claimIntroCoder = document.getElementById('claimIntroCoder');
let claimMode = 'nocode';

claimTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    claimTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    claimMode = tab.dataset.mode;
    nocodeFields.classList.toggle('hidden', claimMode !== 'nocode');
    coderFields.classList.toggle('hidden', claimMode !== 'coder');
    claimIntroNocode?.classList.toggle('hidden', claimMode !== 'nocode');
    claimIntroCoder?.classList.toggle('hidden', claimMode !== 'coder');
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
const donateTierSelect = document.getElementById('donateTier');
const donateCustomTagField = document.getElementById('donateCustomTagField');
const donateCustomTagInput = document.getElementById('donateCustomTag');

function syncCustomTagField() {
  const isCustom = donateTierSelect.value === 'real';
  donateCustomTagField.classList.toggle('hidden', !isCustom);
  donateCustomTagInput.required = isCustom;
}
donateTierSelect.addEventListener('change', syncCustomTagField);
syncCustomTagField();

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
  if (body.tier === 'real') {
    body.customTag = donateCustomTagInput.value.trim();
  }

  try {
    const res = await fetch('/api/contact', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong.');
    donateStatus.textContent = 'Thank you! We\'ll confirm your reference number shortly.';
    donateStatus.classList.add('ok');
    donateForm.reset();
    syncCustomTagField();
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
  const copyEl = document.getElementById('tierPopupCopy');
  const heartEl = document.getElementById('tierPopupHeart');
  const heartButtons = document.querySelectorAll('.heart-link[data-tier]');
  if (!popup) return;

  const tierNames = { normal: 'Pulse', gold: 'Beat', diamond: 'Blood', real: 'Soul', ghost: 'Breath' };
  const defaultCopy = 'Scan the QR code, send this exact amount, then continue to fill in your reference number.';
  const realCopy = 'Scan the QR code, send any amount above ₱1,000 / $50, then continue to name your own tag and fill in your reference number.';
  let activeTier = null;
  let activeAmount = null;

  function openPopup(tier, amount) {
    activeTier = tier;
    activeAmount = amount;
    titleEl.textContent = tierNames[tier] || 'Donate';
    amountEl.textContent = amount;
    copyEl.textContent = tier === 'real' ? realCopy : defaultCopy;
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
    tierSelect?.dispatchEvent(new Event('change'));
    closePopup();
    document.getElementById('donate')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    (activeTier === 'real' ? document.getElementById('donateCustomTag') : document.getElementById('donateRef'))?.focus({ preventScroll: true });
  });
})();

/* ── Paginated slide scrolling: one slide per gesture, with a
   deliberate pause before the next scroll is accepted, so it feels
   like a controlled slide-to-slide transition instead of jittery
   momentum scroll-snap. ─────────────────────────────────────── */
(function initPaginatedScroll() {
  const slides = Array.from(document.querySelectorAll('main .section, .site-footer'));
  if (!slides.length) return;

  const NAV_HEIGHT = 56;
  const COOLDOWN_MS = 900;       // pause after a slide transition before accepting new input
  const WHEEL_THRESHOLD = 12;    // ignore tiny trackpad jitter

  let locked = false;
  let wheelAccum = 0;
  let wheelResetTimer = null;

  function currentIndex() {
    const y = window.scrollY + NAV_HEIGHT + 4;
    let idx = 0;
    slides.forEach((s, i) => { if (s.offsetTop <= y) idx = i; });
    return idx;
  }

  function goTo(index) {
    if (index < 0 || index >= slides.length) return;
    locked = true;
    slides[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.clearTimeout(goTo._t);
    goTo._t = window.setTimeout(() => { locked = false; }, COOLDOWN_MS);
  }

  window.addEventListener('wheel', (e) => {
    // Let pinch-zoom / modifier scrolling through untouched.
    if (e.ctrlKey) return;

    e.preventDefault();
    if (locked) return;

    wheelAccum += e.deltaY;
    window.clearTimeout(wheelResetTimer);
    wheelResetTimer = window.setTimeout(() => { wheelAccum = 0; }, 150);

    if (Math.abs(wheelAccum) < WHEEL_THRESHOLD) return;

    const dir = wheelAccum > 0 ? 1 : -1;
    wheelAccum = 0;
    goTo(currentIndex() + dir);
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
    if (locked) return;

    if (e.key === 'PageDown' || e.key === 'ArrowDown') { e.preventDefault(); goTo(currentIndex() + 1); }
    else if (e.key === 'PageUp' || e.key === 'ArrowUp') { e.preventDefault(); goTo(currentIndex() - 1); }
  });

  let touchStartY = null;
  window.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchend', (e) => {
    if (touchStartY === null || locked) return;
    const dy = touchStartY - e.changedTouches[0].clientY;
    touchStartY = null;
    if (Math.abs(dy) < 40) return;
    goTo(currentIndex() + (dy > 0 ? 1 : -1));
  }, { passive: true });

  // In-app anchor links (nav, footer, hero CTA) should still land cleanly
  // on a slide and re-arm the cooldown so wheel input right after a click
  // doesn't fight the animation.
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', () => {
      locked = true;
      window.clearTimeout(goTo._t);
      goTo._t = window.setTimeout(() => { locked = false; }, COOLDOWN_MS);
    });
  });
})();

/* ── Dot nav: one dot per slide, hollow scrollbar replacement ────── */
(function initPageDots() {
  const slides = Array.from(document.querySelectorAll('main .section, .site-footer'));
  const dotsWrap = document.getElementById('pageDots');
  if (!slides.length || !dotsWrap) return;

  dotsWrap.classList.remove('hidden');
  dotsWrap.innerHTML = '';

  slides.forEach((slide, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'page-dot';
    dot.setAttribute('aria-label', `Go to section ${i + 1} of ${slides.length}`);
    dot.addEventListener('click', () => slide.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    dotsWrap.appendChild(dot);
  });

  const dots = Array.from(dotsWrap.querySelectorAll('.page-dot'));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const idx = slides.indexOf(entry.target);
      if (idx === -1) return;
      dots.forEach((d, di) => d.classList.toggle('active', di === idx));
    });
  }, { threshold: 0.55 });
  slides.forEach(s => observer.observe(s));
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

/* ── Contact form submit ──────────────────────────────────── */
const contactForm = document.getElementById('contactForm');
const contactStatus = document.getElementById('contactStatus');

contactForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  contactStatus.textContent = 'Sending…';
  contactStatus.className = 'username-status';

  const body = {
    type: 'contact',
    name: document.getElementById('contactName').value.trim(),
    email: document.getElementById('contactEmail').value.trim(),
    message: document.getElementById('contactMessage').value.trim()
  };

  try {
    const res = await fetch('/api/contact', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong.');
    contactStatus.textContent = 'Thanks! We\'ll get back to you by email.';
    contactStatus.classList.add('ok');
    contactForm.reset();
  } catch (err) {
    contactStatus.textContent = err.message;
    contactStatus.classList.add('error');
  }
});

/* ── Footer: scroll back to the top slide ────────────────── */
document.getElementById('scrollTopBtn')?.addEventListener('click', () => {
  document.getElementById('top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/* ── Infinite showcase, grouped by tag ───────────────────── */
const showcaseGrid = document.getElementById('showcaseGrid');
const showcaseStatus = document.getElementById('showcaseStatus');
let showcaseCursor = null;
let showcaseLoading = false;
let showcaseDone = false;
let showcaseItems = [];

// Priority order: larger/rarer donor tags first. "diamond" (Blood) and
// "real" (Soul, custom tag above ₱1,000) lead, then "gold" (Beat),
// "normal" (Pulse), then "ghost" (Breath). Untagged entries go last.
const TIER_META = {
  diamond: { label: 'Blood',  color: '#00E5F0', order: 0 },
  real:    { label: 'Soul',   color: '#FF3366', order: 1 },
  gold:    { label: 'Beat',   color: '#FFD400', order: 2 },
  normal:  { label: 'Pulse',  color: '#FFFFFF', order: 3 },
  ghost:   { label: 'Breath', color: '#B9A7FF', order: 4 },
  none:    { label: 'Community', color: null, order: 5 }
};

function renderShowcaseItem(item) {
  const card = document.createElement('a');
  card.className = 'showcase-card';
  card.href = `https://${item.username}.proves.work`;
  card.target = '_blank';
  card.rel = 'noopener';
  const tag = item.customTag || (item.tier ? TIER_META[item.tier]?.label : null);
  card.innerHTML = `
    ${tag ? `<span class="showcase-card-tag">${tag}</span>` : ''}
    <div class="showcase-card-name">${item.username}.proves.work</div>
    ${item.mode === 'coder' ? `<div class="showcase-card-badge">⚡ open source${item.repoName ? ' · ' + item.repoName : ''}</div>` : ''}
  `;
  return card;
}

function renderShowcaseGroups() {
  showcaseGrid.innerHTML = '';
  if (!showcaseItems.length) return;

  const buckets = new Map();
  showcaseItems.forEach(item => {
    const key = item.tier && TIER_META[item.tier] ? item.tier : 'none';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  });

  Array.from(buckets.keys())
    .sort((a, b) => TIER_META[a].order - TIER_META[b].order)
    .forEach(key => {
      const meta = TIER_META[key];
      const items = buckets.get(key).sort((a, b) => (b.amount || 0) - (a.amount || 0));

      const section = document.createElement('div');
      section.className = 'showcase-tier-section';
      if (meta.color) section.style.setProperty('--tier-color', meta.color);

      const heading = document.createElement('h3');
      heading.className = 'showcase-tier-heading';
      heading.innerHTML = `
        ${key !== 'none' ? `<svg class="pixel-heart pixel-heart--${key}" viewBox="0 0 8 7" aria-hidden="true"><use href="#pixel-heart"/></svg>` : ''}
        ${meta.label} <span class="showcase-tier-count">· ${items.length}</span>
      `;

      const grid = document.createElement('div');
      grid.className = 'showcase-tier-grid';
      items.forEach(item => grid.appendChild(renderShowcaseItem(item)));

      section.appendChild(heading);
      section.appendChild(grid);
      showcaseGrid.appendChild(section);
    });
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
    showcaseItems = showcaseItems.concat(data.items);
    renderShowcaseGroups();
    showcaseCursor = data.cursor;
    if (!showcaseCursor) {
      showcaseDone = true;
      showcaseStatus.textContent = showcaseItems.length ? '' : 'No showcased sites yet — donate to be featured!';
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
