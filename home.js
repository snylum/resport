/* ============================================================
   home.js — claim form, donation form, infinite showcase
   ============================================================ */

window.addEventListener('load', () => {
  document.body.classList.remove('is-loading');
});

/* ── Friendly validation tooltip (replaces the native browser
   "Please fill out this field" bubble on every form marked
   novalidate) ─────────────────────────────────────────────── */
(function initFriendlyValidation() {
  let tip = null;
  let hideTimer = null;
  let attachedField = null;

  function ensureTip() {
    if (tip) return tip;
    tip = document.createElement('div');
    tip.className = 'field-tip';
    tip.innerHTML = `<span class="field-tip-icon">!</span><span class="field-tip-msg"></span>`;
    document.body.appendChild(tip);
    return tip;
  }

  function messageFor(field) {
    if (field.validity.valueMissing) {
      return field.dataset.tipMissing || 'Please fill out this field.';
    }
    if (field.validity.typeMismatch && field.type === 'email') {
      return 'Please enter a valid email address.';
    }
    if (field.validity.rangeUnderflow) {
      return `Please enter a value of at least ${field.min}.`;
    }
    if (field.validity.tooShort) {
      return `Please use at least ${field.minLength} characters.`;
    }
    return field.validationMessage || 'Please check this field.';
  }

  function positionTip(field) {
    const t = ensureTip();
    const rect = field.getBoundingClientRect();
    t.style.left = `${rect.left + window.scrollX}px`;
    t.style.top = `${rect.bottom + window.scrollY + 10}px`;
    t.style.setProperty('--tip-width', `${Math.max(rect.width, 220)}px`);
  }

  function hideTip() {
    if (!tip) return;
    tip.classList.remove('visible');
    window.clearTimeout(hideTimer);
    if (attachedField) {
      attachedField.removeEventListener('input', hideTip);
      attachedField.classList.remove('field-invalid');
      attachedField = null;
    }
  }

  function showTip(field) {
    const t = ensureTip();
    t.querySelector('.field-tip-msg').textContent = messageFor(field);
    positionTip(field);
    t.classList.add('visible');
    field.classList.add('field-invalid');
    field.focus();
    attachedField = field;
    field.addEventListener('input', hideTip, { once: true });
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hideTip, 5000);
  }

  window.addEventListener('scroll', () => { if (attachedField) positionTip(attachedField); }, { passive: true });
  window.addEventListener('resize', () => { if (attachedField) positionTip(attachedField); });
  document.addEventListener('click', (e) => {
    if (attachedField && e.target !== attachedField && !e.target.closest('.field-tip')) hideTip();
  });

  document.querySelectorAll('form[novalidate]').forEach(form => {
    form.addEventListener('submit', (e) => {
      hideTip();
      if (form.checkValidity()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const invalidField = Array.from(form.elements).find(el => el.willValidate && !el.checkValidity());
      if (invalidField) showTip(invalidField);
    }, true); // capture: run before the app's own submit handler
  });
})();


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

function applyClaimMode() {
  const isNocode = claimMode === 'nocode';
  nocodeFields.classList.toggle('hidden', !isNocode);
  coderFields.classList.toggle('hidden', isNocode);
  claimIntroNocode?.classList.toggle('hidden', !isNocode);
  claimIntroCoder?.classList.toggle('hidden', isNocode);

  // Hidden fields must not stay `required`, or the browser blocks
  // submission trying to focus an unfocusable (display:none) control.
  document.getElementById('claimEmailNocode').required = isNocode;
  document.getElementById('claimEmailCoder').required = !isNocode;
}

claimTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    claimTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    claimMode = tab.dataset.mode;
    applyClaimMode();
  });
});

applyClaimMode();

/* ── Claim form submit ───────────────────────────────────── */
const claimForm = document.getElementById('claimForm');
const claimStatus = document.getElementById('claimStatus');

const GMAIL_RE = /^[a-z0-9](?:\.?[a-z0-9]){5,29}@gmail\.com$/i;

// Capture the Turnstile token via callback rather than querying the
// widget with getResponse() at submit time. Some browsers/extensions
// let the widget render and complete visually while still breaking the
// query-based lookup (getResponse throwing "Could not find widget for
// provided container" even after a real success) — listening for the
// token directly avoids that whole class of failure.
let claimTurnstileToken = '';
window.onClaimTurnstileVerified = (token) => { claimTurnstileToken = token; };
window.onClaimTurnstileExpired = () => { claimTurnstileToken = ''; };
window.onClaimTurnstileError = () => { claimTurnstileToken = ''; };

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

  // Turnstile tokens are single-use — this is captured fresh via the
  // widget's own success callback (see onClaimTurnstileVerified above),
  // not queried on demand, since some browsers/extensions let the widget
  // render and complete visually while breaking getResponse() lookups.
  body.turnstileToken = claimTurnstileToken;
  if (!body.turnstileToken) {
    claimStatus.textContent = 'Please complete the verification challenge (or it may have failed to load — try disabling ad blockers/privacy extensions for this site).';
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
  } finally {
    claimTurnstileToken = '';
    try { window.turnstile?.reset('claimTurnstile'); } catch { /* widget never mounted */ }
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

/* ── Clean-path routing: map each full-screen slide to a plain path
   (e.g. /claim) instead of a #hash. Hashes stick around in the address
   bar forever once set — this keeps the URL matching whatever slide is
   actually in view, and clears back to "/" once you scroll past. ── */
const SLIDE_PATHS = {
  'top-slide': '/',
  'how': '/how',
  'claim': '/claim',
  'donate': '/donate',
  'showcase': '/showcase',
  'contact': '/contact'
};
function pathForSlide(id) { return SLIDE_PATHS[id] || '/'; }

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

  // The showcase slide has its own internally-scrolling card grid (it
  // can hold far more content than fits one screen). While that inner
  // container still has room to scroll in the wheel's direction, let
  // the browser scroll it natively instead of hijacking to the next
  // full-page slide — only once it's scrolled all the way to its own
  // top/bottom does normal slide-pagination kick back in.
  function findInnerScroller(index) {
    const slide = slides[index];
    if (!slide || slide.id !== 'showcase') return null;
    return document.getElementById('showcaseScroll');
  }

  function innerScrollerBlocksWheel(scroller, deltaY) {
    if (!scroller) return false;
    const atTop = scroller.scrollTop <= 0;
    const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
    if (deltaY > 0 && !atBottom) return true;  // scrolling down, more content below
    if (deltaY < 0 && !atTop) return true;     // scrolling up, more content above
    return false;
  }

  window.addEventListener('wheel', (e) => {
    // Let pinch-zoom / modifier scrolling through untouched.
    if (e.ctrlKey) return;
    if (locked) { e.preventDefault(); return; }

    const scroller = findInnerScroller(currentIndex());
    if (innerScrollerBlocksWheel(scroller, e.deltaY)) {
      // Let the browser handle this natively inside the showcase grid.
      return;
    }

    e.preventDefault();

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
  // doesn't fight the animation — and should update the address bar to a
  // clean path (e.g. /claim) instead of a #hash.
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.pushState(null, '', pathForSlide(id));
      }
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

/* ── Clean-path URL sync: keep the address bar matching whichever slide
   is actually in view (replaceState — no history spam, no reload), and
   land on the right slide if the page was loaded at a clean path or an
   old-style #hash link. ─────────────────────────────────────────── */
(function initSlideUrlSync() {
  const slides = Array.from(document.querySelectorAll('main .section, .site-footer'));
  if (!slides.length) return;

  const hashId = window.location.hash.replace(/^#/, '');
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const initialSlide = (hashId && document.getElementById(hashId))
    || slides.find(s => pathForSlide(s.id) === path)
    || null;
  if (initialSlide) {
    history.replaceState(null, '', pathForSlide(initialSlide.id));
    requestAnimationFrame(() => initialSlide.scrollIntoView({ block: 'start' }));
  }

  let currentPath = pathForSlide(initialSlide ? initialSlide.id : 'top-slide');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const next = pathForSlide(entry.target.id);
      if (next === currentPath) return;
      currentPath = next;
      history.replaceState(null, '', next);
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

/* ── Infinite showcase: flat, filterable card grid ───────── */
const showcaseGrid = document.getElementById('showcaseGrid');
const showcaseScroll = document.getElementById('showcaseScroll');
const showcaseStatus = document.getElementById('showcaseStatus');
const showcaseSearch = document.getElementById('showcaseSearch');
const showcaseArrowDown = document.getElementById('showcaseArrowDown');
const showcaseHeartOrderBtn = document.getElementById('showcaseHeartOrderBtn');
let showcaseCursor = null;
let showcaseLoading = false;
let showcaseDone = false;
let showcaseItems = [];
let showcaseFilter = 'all';
let showcaseQuery = '';

// `color` mirrors the pixel-heart tier colors in home.css — used to tint
// each card's border/shadow to match the heart the donor actually gave.
// Only the top tier (Soul/"real") gets the extra pill on top of the
// card; the others just get the tinted border/shadow.
const TIER_META = {
  real:    { label: 'Soul',   pill: true,  color: '#FF3366' },
  diamond: { label: 'Blood',  pill: false, color: '#00E5F0' },
  gold:    { label: 'Beat',   pill: false, color: '#FFD400' },
  normal:  { label: 'Pulse',  pill: false, color: '#FFFFFF' },
  ghost:   { label: 'Breath', pill: false, color: '#B9A7FF' }
};

// Sort priority for the showcase grid — Soul donors first by default.
// Clicking the heart pill rotates this: the current front tier moves to
// the back and the next one takes its place, for both the card order
// and the heart icons drawn inside the pill itself.
let heartOrder = ['real', 'diamond', 'gold', 'normal', 'ghost'];

function renderHeartOrderPill() {
  if (!showcaseHeartOrderBtn) return;
  showcaseHeartOrderBtn.innerHTML = heartOrder.map(tier =>
    `<svg class="pixel-heart pixel-heart--${tier}" viewBox="0 0 16 16" aria-hidden="true"><use href="#pixel-heart"/></svg>`
  ).join('');
}
renderHeartOrderPill();

showcaseHeartOrderBtn?.addEventListener('click', () => {
  heartOrder.push(heartOrder.shift());
  renderHeartOrderPill();
  renderShowcaseGrid();
});

function showcaseInitials(username) {
  return (username || '?').slice(0, 2).toUpperCase();
}

// Minimal escaper for the bits of donor/site-supplied text (custom tag,
// description) we inject into card markup — both are admin-editable free
// text, so they get the same treatment as admin.js's esc().
function escHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderShowcaseItem(item) {
  const meta = item.tier ? TIER_META[item.tier] : null;
  const tag = item.customTag || meta?.label || 'Community';
  const showPill = !!meta?.pill;
  const description = (item.description || '').trim()
    || (item.mode === 'coder'
      ? `Open source${item.repoName ? ` — ${item.repoName}` : ''}. Live proof-of-work, not just a resume line.`
      : 'Live proof-of-work published for everyone to see.');

  const card = document.createElement('a');
  card.className = `showcase-card${showPill ? ' is-starred' : ''}${meta ? ' has-donor-tag' : ''}`;
  card.href = `https://${item.username}.proves.work`;
  card.target = '_blank';
  card.rel = 'noopener';
  card.dataset.starred = showPill ? '1' : '0';
  card.dataset.coder = item.mode === 'coder' ? '1' : '0';
  card.dataset.username = item.username;
  if (meta) card.style.setProperty('--donor-heart-color', meta.color);

  card.innerHTML = `
    ${showPill ? `<span class="showcase-badge">${escHtml(tag)}</span>` : ''}
    <div class="showcase-card-top">
      <div class="showcase-avatar">${showcaseInitials(item.username)}</div>
      <div>
        <div class="showcase-card-title">${item.username}</div>
        <div class="showcase-card-handle">${item.username}.proves.work</div>
      </div>
    </div>
    <p class="showcase-card-desc">${escHtml(description)}</p>
    <span class="showcase-card-cta">View portfolio →</span>
  `;
  return card;
}

// Stable sort by current heart priority order; untagged/no-donation
// entries always sink to the bottom, keeping their relative order.
function sortShowcaseItems(list) {
  const rank = new Map(heartOrder.map((tier, i) => [tier, i]));
  return list
    .map((item, i) => ({ item, i, r: item.tier && rank.has(item.tier) ? rank.get(item.tier) : heartOrder.length }))
    .sort((a, b) => (a.r - b.r) || (a.i - b.i))
    .map(x => x.item);
}

function renderShowcaseGrid() {
  const q = showcaseQuery.trim().toLowerCase();
  const filtered = sortShowcaseItems(showcaseItems.filter(item => {
    if (showcaseFilter === 'coder' && item.mode !== 'coder') return false;
    if (q && !item.username.toLowerCase().includes(q)) return false;
    return true;
  }));

  showcaseGrid.innerHTML = '';
  if (!filtered.length) {
    showcaseStatus.textContent = showcaseItems.length
      ? 'No profiles match that filter.'
      : (showcaseDone ? 'No showcased sites yet — donate to be featured!' : '');
    updateShowcaseArrow();
    return;
  }
  showcaseStatus.textContent = '';
  filtered.forEach(item => showcaseGrid.appendChild(renderShowcaseItem(item)));
  updateShowcaseArrow();
}

async function loadShowcasePage() {
  if (showcaseLoading || showcaseDone) return;
  showcaseLoading = true;
  if (!showcaseItems.length) showcaseStatus.textContent = 'Loading…';
  try {
    const url = new URL('/api/showcase', window.location.origin);
    if (showcaseCursor) url.searchParams.set('cursor', showcaseCursor);
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok) throw new Error();
    showcaseItems = showcaseItems.concat(data.items);
    showcaseCursor = data.cursor;
    if (!showcaseCursor) showcaseDone = true;
    renderShowcaseGrid();
  } catch {
    showcaseStatus.textContent = 'Could not load the showcase right now.';
  } finally {
    showcaseLoading = false;
  }
}

document.querySelectorAll('[data-showcase-filter]').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('[data-showcase-filter]').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    showcaseFilter = chip.dataset.showcaseFilter;
    renderShowcaseGrid();
  });
});

showcaseSearch?.addEventListener('input', () => {
  showcaseQuery = showcaseSearch.value;
  renderShowcaseGrid();
});

// Load more as the visitor nears the bottom of the showcase's own
// scroll container (not the page — this container scrolls internally
// while the showcase slide is active).
showcaseScroll?.addEventListener('scroll', () => {
  updateShowcaseArrow();
  if (showcaseLoading || showcaseDone) return;
  const { scrollTop, scrollHeight, clientHeight } = showcaseScroll;
  if (scrollHeight - (scrollTop + clientHeight) < 300) loadShowcasePage();
});

// Down arrow: nudges the showcase's own content down by one screenful.
function updateShowcaseArrow() {
  if (!showcaseScroll || !showcaseArrowDown) return;
  const { scrollTop, scrollHeight, clientHeight } = showcaseScroll;
  const hasMore = scrollHeight - (scrollTop + clientHeight) > 24;
  showcaseArrowDown.classList.toggle('hidden', !hasMore);
}

showcaseArrowDown?.addEventListener('click', () => {
  showcaseScroll.scrollBy({ top: showcaseScroll.clientHeight * 0.85, behavior: 'smooth' });
});

if (showcaseGrid) new ResizeObserver(updateShowcaseArrow).observe(showcaseGrid);

const showcaseObserver = new IntersectionObserver(entries => {
  if (entries.some(e => e.isIntersecting)) {
    loadShowcasePage();
    updateShowcaseArrow();
  }
}, { rootMargin: '300px' });

showcaseObserver.observe(document.getElementById('showcase'));
loadShowcasePage();
