/* ============================================================
   home.js — Horizontal scroll snap + dot nav
   ============================================================ */

const wrapper   = document.getElementById('wrapper');
const dots      = document.querySelectorAll('.dot');
const panels    = document.querySelectorAll('.panel');
const totalSlides = panels.length;
let currentSlide  = 0;
let isScrolling   = false;

/* ── Scroll to a specific slide ─────────────────────────── */
function scrollToSlide(index) {
  if (index < 0 || index >= totalSlides) return;
  currentSlide = index;

  // Horizontal or vertical depending on viewport
  const isVertical = window.innerWidth <= 768;
  const panel = panels[index];
  panel.scrollIntoView({ behavior: 'smooth', block: isVertical ? 'start' : 'nearest', inline: isVertical ? 'nearest' : 'start' });

  updateDots(index);
}

/* ── Update dot active state ─────────────────────────────── */
function updateDots(index) {
  dots.forEach((d, i) => d.classList.toggle('active', i === index));
}

/* ── Watch scroll position to sync dots ─────────────────── */
function onWrapperScroll() {
  if (isScrolling) return;

  const isVertical = window.innerWidth <= 768;
  let closest = 0;
  let closestDist = Infinity;

  panels.forEach((panel, i) => {
    const rect = panel.getBoundingClientRect();
    const dist = isVertical
      ? Math.abs(rect.top)
      : Math.abs(rect.left);
    if (dist < closestDist) {
      closestDist = dist;
      closest = i;
    }
  });

  if (closest !== currentSlide) {
    currentSlide = closest;
    updateDots(currentSlide);
  }
}

wrapper.addEventListener('scroll', onWrapperScroll, { passive: true });

/* ── Arrow key navigation ────────────────────────────────── */
document.addEventListener('keydown', e => {
  const isVertical = window.innerWidth <= 768;
  if (e.key === 'ArrowRight' || (!isVertical && e.key === 'ArrowDown')) {
    scrollToSlide(currentSlide + 1);
  } else if (e.key === 'ArrowLeft' || (!isVertical && e.key === 'ArrowUp')) {
    scrollToSlide(currentSlide - 1);
  } else if (e.key === 'ArrowDown' && isVertical) {
    scrollToSlide(currentSlide + 1);
  } else if (e.key === 'ArrowUp' && isVertical) {
    scrollToSlide(currentSlide - 1);
  }
});

/* ── Mouse wheel hijack: one wheel tick = one slide ─────── */
let wheelCooldown = false;
window.addEventListener('wheel', e => {
  if (window.innerWidth <= 768) return; // let native scroll handle mobile
  e.preventDefault();
  if (wheelCooldown) return;
  wheelCooldown = true;

  if (e.deltaY > 0 || e.deltaX > 0) {
    scrollToSlide(currentSlide + 1);
  } else {
    scrollToSlide(currentSlide - 1);
  }

  setTimeout(() => { wheelCooldown = false; }, 800);
}, { passive: false });

/* ── Touch swipe ─────────────────────────────────────────── */
let touchStartX = 0;
let touchStartY = 0;

window.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

window.addEventListener('touchend', e => {
  const dx = touchStartX - e.changedTouches[0].clientX;
  const dy = touchStartY - e.changedTouches[0].clientY;
  const isVertical = window.innerWidth <= 768;

  if (isVertical) {
    if (Math.abs(dy) > 40) scrollToSlide(currentSlide + (dy > 0 ? 1 : -1));
  } else {
    if (Math.abs(dx) > 40) scrollToSlide(currentSlide + (dx > 0 ? 1 : -1));
  }
}, { passive: true });

/* ── Page load reveal ────────────────────────────────────── */
window.addEventListener('load', () => {
  setTimeout(() => {
    document.body.classList.remove('is-loading');
    updateDots(0);
  }, 100);
});
