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

const GMAIL_RE = /^[a-z0-9](?:\.?[a-z0-9]){5,29}@gmail\.com$/i;

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

  if (!GMAIL_RE.test(body.email)) {
    claimStatus.textContent = 'Only properly named @gmail.com addresses are accepted.';
    claimStatus.classList.add('error');
    return;
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
const donateTierInput = document.getElementById('donateTier');
const donateTierHint = document.getElementById('donateTierHint');
const donateTierButtons = document.querySelectorAll('#donateTierList .tier-card');
const donateCustomTagField = document.getElementById('donateCustomTagField');
const donateCustomTagInput = document.getElementById('donateCustomTag');
const donateAmountInput = document.getElementById('donateAmount');
const donateAmountLabel = document.getElementById('donateAmountLabel');

// Same per-tier rules as the heart popup — keeps the donate-section form
// and the nav heart popup consistent about what each tag actually costs.
// Each tier carries both a PHP and a USD version of its rule so the
// person can donate in whichever currency they're actually paying in.
const DONATE_TIER_RULES = {
  normal:  { label: 'Pulse',
    php: { fixed: 50,   symbol: '₱' }, usd: { fixed: 1,   symbol: '$' } },
  gold:    { label: 'Beat',
    php: { fixed: 250,  symbol: '₱' }, usd: { fixed: 10,  symbol: '$' } },
  diamond: { label: 'Blood',
    php: { fixed: 1000, symbol: '₱' }, usd: { fixed: 50,  symbol: '$' } },
  real:    { label: 'Soul', customTag: true,
    php: { min: 1000, symbol: '₱' }, usd: { min: 50, symbol: '$' } },
  ghost:   { label: 'Breath',
    php: { max: 1000, odd: true, symbol: '₱' }, usd: { max: 50, odd: true, symbol: '$' } }
};

let donateCurrency = 'php';
const donateCurrencyTabs = document.querySelectorAll('#donateCurrencyTabs .claim-tab');

function currentDonateRule() {
  const tier = donateTierInput.value;
  const rule = DONATE_TIER_RULES[tier];
  if (!rule) return null;
  return { label: rule.label, customTag: rule.customTag, ...rule[donateCurrency] };
}

function refreshDonateAmountUI() {
  const rule = currentDonateRule();
  if (!rule) return;
  const { symbol } = rule;

  if (rule.fixed != null) {
    donateAmountInput.value = rule.fixed;
    donateAmountInput.readOnly = true;
    donateAmountLabel.textContent = `Amount (fixed at ${symbol}${rule.fixed})`;
    donateTierHint.textContent = `${rule.label} is fixed at ${symbol}${rule.fixed}.`;
  } else if (rule.min != null) {
    donateAmountInput.value = '';
    donateAmountInput.readOnly = false;
    donateAmountLabel.textContent = `Amount you sent (above ${symbol}${rule.min})`;
    donateTierHint.textContent = `${rule.label}: enter any amount above ${symbol}${rule.min} and pick your own tag.`;
  } else if (rule.max != null) {
    donateAmountInput.value = '';
    donateAmountInput.readOnly = false;
    donateAmountLabel.textContent = `Amount you sent (odd, below ${symbol}${rule.max})`;
    donateTierHint.textContent = `${rule.label}: enter an odd amount below ${symbol}${rule.max} (e.g. ${symbol}37).`;
  }
  donateTierHint.className = 'username-status';
}

donateCurrencyTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    donateCurrencyTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    donateCurrency = tab.dataset.currency;
    if (donateTierInput.value) refreshDonateAmountUI();
  });
});

function selectDonateTier(tier) {
  const rule = DONATE_TIER_RULES[tier];
  if (!rule) return;

  donateTierInput.value = tier;

  donateTierButtons.forEach(btn => {
    const isActive = btn.dataset.tier === tier;
    btn.classList.toggle('tier-card--selected', isActive);
    btn.setAttribute('aria-checked', String(isActive));
  });

  donateCustomTagField.classList.toggle('hidden', !rule.customTag);
  donateCustomTagInput.required = !!rule.customTag;

  refreshDonateAmountUI();
}

donateTierButtons.forEach(btn => {
  btn.addEventListener('click', () => selectDonateTier(btn.dataset.tier));
});

function validateDonateAmount(rule, amount) {
  const symbol = rule.symbol;
  if (!Number.isFinite(amount) || amount <= 0) return 'Enter a valid amount.';
  if (rule.fixed != null) {
    if (Math.round(amount * 100) !== Math.round(rule.fixed * 100)) {
      return `${rule.label} is exactly ${symbol}${rule.fixed} — adjust the amount to match what you sent.`;
    }
  } else if (rule.min != null) {
    if (amount <= rule.min) return `${rule.label} needs any amount above ${symbol}${rule.min}.`;
  } else if (rule.max != null) {
    if (amount >= rule.max) return `${rule.label} needs an amount below ${symbol}${rule.max}.`;
    if (!Number.isInteger(amount) || amount % 2 === 0) return `${rule.label} needs an odd whole-number amount (e.g. ${symbol}37).`;
  }
  return null;
}

donateForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const tier = donateTierInput.value;
  const rule = currentDonateRule();
  if (!rule) {
    donateTierHint.textContent = 'Pick a heart above to choose your tier.';
    donateTierHint.className = 'username-status error';
    return;
  }

  const amount = parseFloat(donateAmountInput.value);
  const amountError = validateDonateAmount(rule, amount);
  if (amountError) {
    donateStatus.textContent = amountError;
    donateStatus.className = 'username-status error';
    return;
  }

  donateStatus.textContent = 'Submitting…';
  donateStatus.className = 'username-status';

  const body = {
    type: 'donation',
    tier,
    currency: donateCurrency,
    amount,
    referenceNumber: document.getElementById('donateRef').value.trim(),
    username: document.getElementById('donateUsername').value.trim().toLowerCase(),
    email: document.getElementById('donateEmail').value.trim()
  };
  if (rule.customTag) {
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
    donateTierButtons.forEach(btn => { btn.classList.remove('tier-card--selected'); btn.setAttribute('aria-checked', 'false'); });
    donateTierInput.value = '';
    donateAmountInput.readOnly = false;
    donateAmountLabel.textContent = 'Amount you sent';
    donateCustomTagField.classList.add('hidden');
    donateTierHint.textContent = 'Pick a heart on the left to choose your tier.';
    donateCurrencyTabs.forEach(t => t.classList.toggle('active', t.dataset.currency === 'php'));
    donateCurrency = 'php';
  } catch (err) {
    donateStatus.textContent = err.message;
    donateStatus.classList.add('error');
  }
});

/* ── Heart tier popup: a self-contained donation form. Submits
   directly to the API — no redirect back to the page's donate form.
   The amount field is locked (or bounded) per tier so what's actually
   paid always matches what that heart tag offers. ───────────────── */
(function initTierPopup() {
  const popup = document.getElementById('tierPopup');
  const closeBtn = document.getElementById('tierPopupClose');
  const form = document.getElementById('tierPopupForm');
  const titleEl = document.getElementById('tierPopupTitle');
  const amountEl = document.getElementById('tierPopupAmount');
  const amountLabelEl = document.getElementById('tierPopupAmountLabel');
  const copyEl = document.getElementById('tierPopupCopy');
  const heartEl = document.getElementById('tierPopupHeart');
  const statusEl = document.getElementById('tierPopupStatus');
  const submitBtn = document.getElementById('tierPopupSubmit');
  const customTagField = document.getElementById('tierPopupCustomTagField');
  const customTagInput = document.getElementById('tierPopupCustomTag');
  const refInput = document.getElementById('tierPopupRef');
  const usernameInput = document.getElementById('tierPopupUsername');
  const emailInput = document.getElementById('tierPopupEmail');
  const heartButtons = document.querySelectorAll('.heart-link[data-tier]');
  if (!popup || !form) return;

  // Exactly what each heart tag offers — enforced against whatever the
  // person actually types into the amount field before it's submitted.
  const TIER_RULES = {
    normal:  { label: 'Pulse',  fixed: 50,   copy: 'Scan the QR code, send exactly ₱50 / $1, then fill in the details below.' },
    gold:    { label: 'Beat',   fixed: 250,  copy: 'Scan the QR code, send exactly ₱250 / $10, then fill in the details below.' },
    diamond: { label: 'Blood',  fixed: 1000, copy: 'Scan the QR code, send exactly ₱1,000 / $50, then fill in the details below.' },
    real:    { label: 'Soul',   min: 1000,   customTag: true, copy: 'Scan the QR code, send any amount above ₱1,000 / $50, then name your own tag below.' },
    ghost:   { label: 'Breath', max: 1000, odd: true, copy: 'Scan the QR code, send an odd amount below ₱1,000 / $50 (e.g. ₱37), then fill in the details below.' }
  };

  let activeTier = null;

  function openPopup(tier) {
    const rule = TIER_RULES[tier];
    if (!rule) return;
    activeTier = tier;

    titleEl.textContent = rule.label;
    copyEl.textContent = rule.copy;
    heartEl.setAttribute('class', `pixel-heart tier-popup-heart pixel-heart--${tier}`);

    if (rule.fixed) {
      amountEl.value = rule.fixed;
      amountEl.readOnly = true;
      amountLabelEl.textContent = `Amount (fixed at ₱${rule.fixed})`;
    } else {
      amountEl.value = '';
      amountEl.readOnly = false;
      amountLabelEl.textContent = rule.customTag ? 'Amount you sent (above ₱1,000)' : 'Amount you sent (odd, below ₱1,000)';
    }

    customTagField.classList.toggle('hidden', !rule.customTag);
    customTagInput.required = !!rule.customTag;

    statusEl.textContent = '';
    statusEl.className = 'username-status';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit donation';

    popup.classList.remove('hidden');
  }

  function closePopup() { popup.classList.add('hidden'); }

  heartButtons.forEach(btn => {
    btn.addEventListener('click', () => openPopup(btn.dataset.tier));
  });

  closeBtn.addEventListener('click', closePopup);
  popup.addEventListener('click', (e) => { if (e.target === popup) closePopup(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !popup.classList.contains('hidden')) closePopup(); });

  function validateAmount(rule, amount) {
    if (!Number.isFinite(amount) || amount <= 0) return 'Enter a valid amount.';
    if (rule.fixed) {
      if (Math.round(amount * 100) !== Math.round(rule.fixed * 100)) {
        return `${rule.label} is exactly ₱${rule.fixed} / $${rule.fixed === 50 ? 1 : rule.fixed === 250 ? 10 : 50} — adjust the amount to match what you sent.`;
      }
    } else if (rule.min) {
      if (amount <= rule.min) return `Soul needs any amount above ₱${rule.min} / $50.`;
    } else if (rule.max) {
      if (amount >= rule.max) return `Breath needs an amount below ₱${rule.max} / $50.`;
      if (!Number.isInteger(amount) || amount % 2 === 0) return 'Breath needs an odd whole-number amount (e.g. ₱37).';
    }
    return null;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rule = TIER_RULES[activeTier];
    if (!rule) return;

    const amount = parseFloat(amountEl.value);
    const amountError = validateAmount(rule, amount);
    if (amountError) {
      statusEl.textContent = amountError;
      statusEl.className = 'username-status error';
      return;
    }

    statusEl.textContent = 'Submitting…';
    statusEl.className = 'username-status';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    const body = {
      type: 'donation',
      tier: activeTier,
      amount,
      referenceNumber: refInput.value.trim(),
      username: usernameInput.value.trim().toLowerCase(),
      email: emailInput.value.trim()
    };
    if (rule.customTag) body.customTag = customTagInput.value.trim();

    try {
      const res = await fetch('/api/contact', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong.');
      statusEl.textContent = 'Thank you! We\'ll confirm your reference number shortly.';
      statusEl.classList.add('ok');
      submitBtn.textContent = 'Submitted ✓';
      form.reset();
      setTimeout(closePopup, 2200);
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.classList.add('error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit donation';
    }
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
