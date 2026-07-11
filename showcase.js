// Showcase — public grid of every live .proves.work portfolio. Pulls
// from /api/showcase (already sorted starred-first server-side) and
// layers client-side filtering/search on top. Each card is a plain
// link to the live subdomain — clicking it navigates straight to the
// person's portfolio, no intermediate step.

const APP_HOST = 'proves.work';

const stateEl = document.getElementById('showcaseState');
const gridEl = document.getElementById('showcaseGrid');
const searchInput = document.getElementById('showcaseSearch');
const filterChips = Array.from(document.querySelectorAll('.chip'));

let allSites = [];
let activeFilter = 'all';

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function initials(title) {
  const words = String(title || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return (words[0][0] + (words[1] ? words[1][0] : '')).slice(0, 2);
}

function cardHTML(site) {
  const starred = site.tier === 'starred';
  const url = `https://${site.username}.${APP_HOST}`;
  return `
    <a class="showcase-card${starred ? ' is-starred' : ''}" href="${url}" target="_blank" rel="noopener">
      ${starred ? '<div class="showcase-badge">★ Active Job Hunter</div>' : ''}
      <div class="showcase-card-top">
        <div class="showcase-avatar">${esc(initials(site.title))}</div>
        <div>
          <div class="showcase-card-title">${esc(site.title)}</div>
          <div class="showcase-card-handle">${esc(site.username)}.${APP_HOST}</div>
        </div>
      </div>
      ${site.description ? `<p class="showcase-card-desc">${esc(site.description)}</p>` : ''}
      <span class="showcase-card-cta">View portfolio →</span>
    </a>
  `;
}

function render() {
  const query = (searchInput.value || '').trim().toLowerCase();
  const filtered = allSites.filter((site) => {
    if (activeFilter !== 'all' && site.tier !== activeFilter) return false;
    if (!query) return true;
    return site.title.toLowerCase().includes(query) || site.username.toLowerCase().includes(query) || (site.description || '').toLowerCase().includes(query);
  });

  if (!filtered.length) {
    gridEl.hidden = true;
    stateEl.hidden = false;
    stateEl.textContent = allSites.length
      ? 'No portfolios match that search/filter.'
      : 'No portfolios published yet — be the first!';
    return;
  }

  stateEl.hidden = true;
  gridEl.hidden = false;
  gridEl.innerHTML = filtered.map(cardHTML).join('');
}

filterChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    filterChips.forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    activeFilter = chip.dataset.filter;
    render();
  });
});

searchInput.addEventListener('input', render);

async function loadShowcase() {
  try {
    const res = await fetch('/api/showcase');
    const data = await res.json();
    if (!data.ok) throw new Error('bad-response');
    allSites = data.sites || [];
    render();
  } catch {
    stateEl.textContent = "Couldn't load the showcase right now — try refreshing.";
  }
}

loadShowcase();
