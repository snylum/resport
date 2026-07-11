import { Store, esc, uid, TEMPLATES, PORTFOLIO_TEMPLATES, PORTFOLIO_STRUCTURAL_TEMPLATES, FONT_STACKS, FONT_OPTIONS, BLOCK_LIBRARY } from './store.js';
// (SAMPLE_PROFILES/SAMPLE_STYLES live entirely inside Store.randomizeContent()
// in store.js — nothing in editor.js needs to reach into them directly.)

// ── DOM Elements Cache ───────────────────────────────────────
const el = {
  tabPortfolioBtn: document.getElementById('tabPortfolioBtn'),
  tabResumeBtn: document.getElementById('tabResumeBtn'),
  tabEditBtn: document.getElementById('tabEditBtn'),
  tabCustomizeBtn: document.getElementById('tabCustomizeBtn'),
  docTitle: document.getElementById('docTitle'),
  navUsername: document.getElementById('navUsername'),
  siteStatusBadge: document.getElementById('siteStatusBadge'),
  btnResetResume: document.getElementById('btnResetResume'),

  inJobTitle: document.getElementById('inJobTitle'),
  inFirstName: document.getElementById('inFirstName'),
  inLastName: document.getElementById('inLastName'),
  inEmail: document.getElementById('inEmail'),
  inPhone: document.getElementById('inPhone'),
  inAddress: document.getElementById('inAddress'),
  inTagline: document.getElementById('inTagline'),
  inPhoto: document.getElementById('inPhoto'),
  photoSidebarPreview: document.getElementById('photoSidebarPreview'),

  // Resume/PDF canvas
  resumePaper: document.getElementById('resumePaper'),
  canvasName: document.getElementById('canvasName'),
  canvasJobTitle: document.getElementById('canvasJobTitle'),
  canvasContactLine: document.getElementById('canvasContactLine'),
  canvasPhotoWrap: document.getElementById('canvasPhotoWrap'),
  canvasPhotoImg: document.getElementById('canvasPhotoImg'),
  mainTrack: document.getElementById('mainTrack'),
  sideTrack: document.getElementById('sideTrack'),

  // Portfolio canvas
  portfolioSite: document.getElementById('portfolioSite'),
  pfName: document.getElementById('pfName'),
  pfJobTitle: document.getElementById('pfJobTitle'),
  pfTagline: document.getElementById('pfTagline'),
  pfContactLine: document.getElementById('pfContactLine'),
  pfPhotoWrap: document.getElementById('pfPhotoWrap'),
  pfPhotoImg: document.getElementById('pfPhotoImg'),
  pfSections: document.getElementById('pfSections'),
  pfSlideDots: document.getElementById('pfSlideDots'),
  pfSlideArrowTop: document.getElementById('pfSlideArrowTop'),
  pfSlideArrowBottom: document.getElementById('pfSlideArrowBottom'),

  sidebarSectionsList: document.getElementById('sidebarSectionsList'),
  editorSidebar: document.getElementById('editorSidebar'),
  sidebarResizer: document.getElementById('sidebarResizer'),
  editorWorkspace: document.querySelector('.editor-workspace'),
  canvasWrap: document.getElementById('canvasWrap'),
  canvasContainer: document.getElementById('canvasContainer'),
  canvasZoomTarget: document.getElementById('canvasZoomTarget'),
  panelEdit: document.getElementById('panelEdit'),
  panelCustomize: document.getElementById('panelCustomize'),
  btnZoomIn: document.getElementById('btnZoomIn'),
  btnZoomOut: document.getElementById('btnZoomOut'),
  zoomLevelDisplay: document.getElementById('zoomLevelDisplay'),
  btnAddSection: document.getElementById('btnAddSection'),
  addSectionMenu: document.getElementById('addSectionMenu'),
  btnRandomize: document.getElementById('btnRandomize'),
  btnResetContent: document.getElementById('btnResetContent'),
  inAccentCustom: document.getElementById('inAccentCustom'),
  accentSwatchCustom: document.getElementById('accentSwatchCustom'),
  selHeadingFont: document.getElementById('selHeadingFont'),
  selBodyFont: document.getElementById('selBodyFont'),
  inTextPadding: document.getElementById('inTextPadding'),
  textPaddingLabel: document.getElementById('textPaddingLabel'),

  // Resume: numeric customization sliders
  inFontSize: document.getElementById('inFontSize'),
  fontSizeLabel: document.getElementById('fontSizeLabel'),
  inLineHeight: document.getElementById('inLineHeight'),
  lineHeightLabel: document.getElementById('lineHeightLabel'),
  inSectionGap: document.getElementById('inSectionGap'),
  sectionGapLabel: document.getElementById('sectionGapLabel'),
  inBlockPad: document.getElementById('inBlockPad'),
  blockPadLabel: document.getElementById('blockPadLabel'),
  inBulletSize: document.getElementById('inBulletSize'),
  bulletSizeLabel: document.getElementById('bulletSizeLabel'),
  inPageMargin: document.getElementById('inPageMargin'),
  pageMarginLabel: document.getElementById('pageMarginLabel'),
  inColSplit: document.getElementById('inColSplit'),
  colSplitLabel: document.getElementById('colSplitLabel'),
  inColGap: document.getElementById('inColGap'),
  colGapLabel: document.getElementById('colGapLabel'),
  inColBorder: document.getElementById('inColBorder'),
  colSplitGroup: document.getElementById('colSplitGroup'),
  colGapGroup: document.getElementById('colGapGroup'),
  colBorderGroup: document.getElementById('colBorderGroup'),

  // Resume: portfolio-link + copy-link
  inIncludePortfolioLink: document.getElementById('inIncludePortfolioLink'),
  portfolioLinkUrlPreview: document.getElementById('portfolioLinkUrlPreview'),
  portfolioLinkLockMsg: document.getElementById('portfolioLinkLockMsg'),
  templateGallery: document.getElementById('templateGallery'),
  portfolioTemplateGallery: document.getElementById('portfolioTemplateGallery'),

  // Modal
  modalOverlay: document.getElementById('modalOverlay'),
  modalContent: document.getElementById('modalContent'),
  modalCloseBtn: document.getElementById('modalCloseBtn')
};

// ── 1. Sidebar input <-> active-document profile sync ─────────
// These listeners never change: they always write into whichever
// document (portfolio or resume) is currently active. Displaying
// the *right* values when the active document switches is handled
// separately by refreshInputsFromActive().
function initInputListeners() {
  const syncField = (inputEl, fieldName) => {
    inputEl.addEventListener('input', (e) => {
      Store.updateProfile(fieldName, e.target.value);
    });
  };

  syncField(el.inJobTitle, 'jobTitle');
  syncField(el.inFirstName, 'firstName');
  syncField(el.inLastName, 'lastName');
  syncField(el.inEmail, 'email');
  syncField(el.inPhone, 'phone');
  syncField(el.inAddress, 'address');
  syncField(el.inTagline, 'tagline');

  el.inPhoto.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => Store.updateProfile('photo', ev.target.result);
    reader.readAsDataURL(file);
  });
}

function refreshInputsFromActive() {
  const p = Store.active().profile;
  el.inJobTitle.value = p.jobTitle || '';
  el.inFirstName.value = p.firstName || '';
  el.inLastName.value = p.lastName || '';
  el.inEmail.value = p.email || '';
  el.inPhone.value = p.phone || '';
  el.inAddress.value = p.address || '';
  el.inTagline.value = p.tagline || '';
  el.photoSidebarPreview.style.backgroundImage = p.photo ? `url(${p.photo})` : '';
}

// ── 2. Header / hero repaint (targeted, no innerHTML destruction) ─
function refreshHeader() {
  const profile = Store.active().profile;
  const fullName = `${profile.firstName} ${profile.lastName}`.trim() || 'Untitled Profile';
  const contactLine = [profile.email, profile.phone, profile.address].filter(Boolean).join('   •   ');

  if (Store.state.viewMode === 'resume') {
    el.canvasName.textContent = fullName;
    el.canvasJobTitle.textContent = profile.jobTitle;
    el.canvasContactLine.textContent = contactLine;
    if (profile.photo) {
      el.canvasPhotoImg.src = profile.photo;
      el.canvasPhotoWrap.classList.remove('hidden');
    } else {
      el.canvasPhotoWrap.classList.add('hidden');
    }
  } else {
    el.pfName.textContent = fullName;
    el.pfJobTitle.textContent = profile.jobTitle;
    el.pfTagline.textContent = profile.tagline || '';
    el.pfTagline.style.display = profile.tagline ? '' : 'none';
    el.pfContactLine.textContent = contactLine;
    if (profile.photo) {
      el.pfPhotoImg.src = profile.photo;
      el.pfPhotoWrap.classList.remove('hidden');
    } else {
      el.pfPhotoWrap.classList.add('hidden');
    }
  }
  el.photoSidebarPreview.style.backgroundImage = profile.photo ? `url(${profile.photo})` : '';
}

Store.on('profile_changed', refreshHeader);

// ── 3. Shared field-rendering helpers (used by BOTH canvases) ──
function ceField(value, field, blockId, opts = {}) {
  const { index = null, subfield = null, cls = '' } = opts;
  const idxAttr = index !== null ? ` data-index="${index}"` : '';
  const subAttr = subfield ? ` data-subfield="${subfield}"` : '';
  return `<span class="ce-field ${cls}" contenteditable="true" spellcheck="false" data-field="${field}"${idxAttr}${subAttr} data-block="${blockId}">${esc(value)}</span>`;
}

function renderBulletList(bullets, blockId, field) {
  const items = (bullets || []).map((b, i) => `
    <li>
      ${ceField(b, field, blockId, { index: i })}
      <button class="li-remove-btn" data-action="remove-item" data-block="${blockId}" data-field="${field}" data-index="${i}" title="Remove bullet" type="button">✕</button>
    </li>`).join('');
  return `<ul class="rb-bullets editable-list">${items}</ul>
    <button class="add-item-btn" data-action="add-item" data-block="${blockId}" data-field="${field}" type="button">+ Add bullet</button>`;
}

function renderSkillTags(items, blockId, field) {
  const tags = (items || []).map((s, i) => `
    <span class="rb-skill-tag">
      ${ceField(s, field, blockId, { index: i })}
      <button class="tag-remove-btn" data-action="remove-item" data-block="${blockId}" data-field="${field}" data-index="${i}" title="Remove" type="button">✕</button>
    </span>`).join('');
  return `<div class="rb-skills-wrap">${tags}</div>
    <button class="add-item-btn" data-action="add-item" data-block="${blockId}" data-field="${field}" type="button">+ Add skill</button>`;
}

function renderEntryList(items, blockId, field, cols) {
  const rows = (items || []).map((it, i) => `
    <div class="rb-entry-row">
      ${cols.map(c => ceField(it[c.key] || '', field, blockId, { index: i, subfield: c.key, cls: c.cls })).join('')}
      <button class="li-remove-btn" data-action="remove-item" data-block="${blockId}" data-field="${field}" data-index="${i}" title="Remove" type="button">✕</button>
    </div>`).join('');
  return `<div class="rb-entry-list">${rows}</div>
    <button class="add-item-btn" data-action="add-item" data-block="${blockId}" data-field="${field}" data-item-type="object" type="button">+ Add</button>`;
}

// Turns a pasted YouTube/Vimeo/Loom URL into an embeddable iframe src.
// Falls back to null (rendered as a plain link) for anything else, so
// people can still paste a Google Drive link, a Dropbox link, etc.
// without breaking the block.
function videoEmbedSrc(url) {
  if (!url) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}`;
      const shorts = u.pathname.match(/^\/shorts\/([\w-]+)/);
      if (shorts) return `https://www.youtube.com/embed/${shorts[1]}`;
    }
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    if (host === 'loom.com') {
      const id = u.pathname.split('/').filter(Boolean).pop();
      if (id) return `https://www.loom.com/embed/${id}`;
    }
  } catch { /* not a valid URL yet — treat as no embed */ }
  return null;
}

function verifyControlHTML(block) {
  const v = block.data.verify || { type: 'none' };
  if (v.type !== 'none') {
    const labelHTML = v.label ? `<span class="pf-verify-label">${esc(v.label)}</span>` : '';
    return `
      <button class="pf-verify-badge" data-action="view-verify" data-block="${block.id}" type="button">✓ Verified${labelHTML}</button>
      <button class="pf-verify-edit" data-action="edit-verify" data-block="${block.id}" title="Edit verification" type="button">✎</button>`;
  }
  return `<button class="pf-verify-add" data-action="edit-verify" data-block="${block.id}" type="button">+ Add proof</button>`;
}

// ── 3a. RESUME / PDF block renderer (paper-style, unchanged look) ─
// Which blocks currently have their edit accordion expanded IN THE
// SIDEBAR. Pure UI state — not part of Store — so it's fine to keep it
// as module-level state that resets on reload. The canvas itself is
// always a plain, non-editable preview now; only the left sidebar list
// has the expand/collapse edit accordion.
const expandedBlocks = new Set();

function toggleBlockExpand(blockId) {
  if (expandedBlocks.has(blockId)) expandedBlocks.delete(blockId);
  else expandedBlocks.add(blockId);
  renderSidebarList(Store.active().blocks);
}

// Short, non-editable one-liner shown next to a collapsed sidebar item so
// people can tell sections apart before expanding one to edit it.
function blockSummaryLine(block) {
  const d = block.data || {};
  switch (block.type) {
    case 'section': return d.title || 'Section title';
    case 'summary': return (d.text || '').slice(0, 70) || 'Summary';
    case 'custom': return d.title || 'Custom section';
    case 'experience': return [d.company, d.role].filter(Boolean).join(' — ') || 'Experience entry';
    case 'education': return [d.school, d.degree].filter(Boolean).join(' — ') || 'Education entry';
    case 'projects': return d.name || 'Project';
    case 'skills': return (d.items || []).join(', ') || 'Skills';
    case 'certifications': return (d.items || []).map(i => i.name).filter(Boolean).join(', ') || 'Certifications';
    case 'languages': return (d.items || []).map(i => i.name).filter(Boolean).join(', ') || 'Languages';
    case 'gallery': return (d.photos || []).length ? `${d.photos.length} photo${d.photos.length === 1 ? '' : 's'}` : 'Photo gallery (empty)';
    case 'video': return d.url || 'Embedded video (empty)';
    case 'links': return (d.items || []).map(i => i.label).filter(Boolean).join(', ') || 'Embedded links';
    default: return 'Section';
  }
}

// ── 3a-i. Sidebar accordion edit-body markup (the ONLY place with
// actual editable ce-fields now). One labeled field-box per data field,
// reusing the same ceField/renderBulletList/renderSkillTags/renderEntryList
// helpers (and therefore the same Store.updateBlockData wiring) that used
// to live directly on the canvas.
function blockEditFieldsHTML(block) {
  const d = block.data || {};
  const field = (label, html) => `<div class="sd-field"><span class="sd-field-label">${esc(label)}</span>${html}</div>`;
  switch (block.type) {
    case 'section':
      return field('Section title', ceField(d.title, 'title', block.id));
    case 'summary':
      return field('Text', ceField(d.text, 'text', block.id, { cls: 'ce-block' }));
    case 'custom':
      return field('Title', ceField(d.title, 'title', block.id))
        + field('Text', ceField(d.text, 'text', block.id, { cls: 'ce-block' }));
    case 'experience':
      return field('Company', ceField(d.company, 'company', block.id))
        + field('Dates', ceField(d.dates, 'dates', block.id))
        + field('Role', ceField(d.role, 'role', block.id))
        + field('Location', ceField(d.location, 'location', block.id))
        + field('Bullets', renderBulletList(d.bullets, block.id, 'bullets'))
        + field('Verification', `<div class="pf-verify">${verifyControlHTML(block)}</div>`);
    case 'education':
      return field('School', ceField(d.school, 'school', block.id))
        + field('Year', ceField(d.year, 'year', block.id))
        + field('Degree', ceField(d.degree, 'degree', block.id))
        + field('Location', ceField(d.location, 'location', block.id))
        + field('GPA', ceField(d.gpa, 'gpa', block.id));
    case 'projects':
      return field('Name', ceField(d.name, 'name', block.id))
        + field('Dates', ceField(d.dates, 'dates', block.id))
        + field('Description', ceField(d.description, 'description', block.id))
        + field('Bullets', renderBulletList(d.bullets, block.id, 'bullets'));
    case 'skills':
      return field('Skills', renderSkillTags(d.items, block.id, 'items'));
    case 'certifications':
      return field('Certifications', renderEntryList(d.items, block.id, 'items', [
        { key: 'name', cls: 'ce-strong' }, { key: 'issuer', cls: 'ce-muted' }, { key: 'date', cls: 'ce-muted' }
      ]));
    case 'languages':
      return field('Languages', renderEntryList(d.items, block.id, 'items', [
        { key: 'name', cls: 'ce-strong' }, { key: 'level', cls: 'ce-muted' }
      ]));
    case 'gallery': {
      const thumbs = (d.photos || []).map((p, i) => `
        <div class="sd-gallery-thumb">
          <img src="${esc(p.src)}" alt="" />
          <button class="sd-gallery-thumb-verify ${p.verify && p.verify.type !== 'none' ? 'is-verified' : ''}" data-action="edit-photo-verify" data-block="${block.id}" data-photo-index="${i}" type="button" title="${p.verify && p.verify.type !== 'none' ? 'Edit proof for this photo' : 'Add proof for this photo'}">${p.verify && p.verify.type !== 'none' ? '✓' : '+ proof'}</button>
          <button class="sd-gallery-thumb-remove" data-action="remove-item" data-block="${block.id}" data-field="photos" data-index="${i}" type="button" title="Remove photo">✕</button>
        </div>`).join('');
      return field('Photos', `
        <div class="sd-gallery-grid">${thumbs}</div>
        <label class="add-item-btn sd-gallery-add">
          + Add photo
          <input type="file" accept="image/*" class="sd-gallery-file-input" data-block="${block.id}" hidden />
        </label>`)
        + `<p class="sd-field-hint">Click "+ proof" on a photo to attach verification (certificate, badge, ID, or link) to that specific photo.</p>`;
    }
    case 'video':
      return field('Video URL (YouTube, Vimeo, Loom)', ceField(d.url, 'url', block.id))
        + field('Caption (optional)', ceField(d.caption, 'caption', block.id));
    case 'links':
      return field('Links', renderEntryList(d.items, block.id, 'items', [
        { key: 'label', cls: 'ce-strong' }, { key: 'url', cls: 'ce-muted' }
      ]));
    default:
      return '';
  }
}

// View-only verify badge for the canvas preview (no edit/add-proof
// affordance there anymore — that lives in the sidebar accordion).
function canvasVerifyBadge(block) {
  const v = block.data.verify || { type: 'none' };
  if (v.type === 'none') return '';
  const labelHTML = v.label ? `<span class="pf-verify-label">${esc(v.label)}</span>` : '';
  return `<div class="pf-verify"><button class="pf-verify-badge" data-action="view-verify" data-block="${block.id}" type="button">✓ Verified${labelHTML}</button></div>`;
}

// Small "✓" pin shown in the corner of a gallery photo that has its
// own proof attached — clicking it opens that photo's verification,
// same view-only modal as the block-level badge above, just scoped
// to one photo via data-photo-index instead of the whole block.
function canvasPhotoVerifyBadge(block, photo, index) {
  const v = photo.verify || { type: 'none' };
  if (v.type === 'none') return '';
  return `<button class="pf-photo-verify-badge" data-action="view-verify" data-block="${block.id}" data-photo-index="${index}" title="View proof for this photo" type="button">✓</button>`;
}

function createResumeBlock(block) {
  const wrapper = document.createElement('div');
  wrapper.className = `resume-block block-${block.type}`;
  wrapper.dataset.id = block.id;
  if (Store.state.selectedBlockId === block.id) wrapper.classList.add('selected');
  if (block.hidden) wrapper.classList.add('section-hidden-preview');
  wrapper.innerHTML = renderStaticResumeBlock(block);
  return wrapper;
}


// ── 3b. PORTFOLIO SITE block renderer (cards + verification) ─────
function createPortfolioBlock(block) {
  const wrapper = document.createElement('div');
  wrapper.dataset.id = block.id;
  if (Store.state.selectedBlockId === block.id) wrapper.classList.add('selected');
  if (block.hidden) wrapper.classList.add('section-hidden-preview');

  let baseClass = '';
  let innerHTML = '';
  switch (block.type) {
    case 'section':
      baseClass = 'pf-block-section-title';
      innerHTML = esc(block.data.title);
      break;
    case 'summary':
      baseClass = 'pf-card pf-summary-card';
      innerHTML = esc(block.data.text);
      break;
    case 'custom':
      baseClass = 'pf-card';
      innerHTML = `
        <h3 class="pf-exp-company">${esc(block.data.title)}</h3>
        <p>${esc(block.data.text)}</p>`;
      break;
    case 'experience':
      baseClass = 'pf-card';
      innerHTML = `
        <div class="pf-exp-top-row">
          <span class="pf-exp-company">${esc(block.data.company)}</span>
          <span class="pf-exp-dates">${esc(block.data.dates)}</span>
        </div>
        <div class="pf-exp-sub-row">
          <span>${esc(block.data.role)}</span>
          <span>${esc(block.data.location)}</span>
        </div>
        <ul class="rb-bullets">${(block.data.bullets || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul>
        ${canvasVerifyBadge(block)}`;
      break;
    case 'education':
      baseClass = 'pf-card pf-edu-card';
      innerHTML = `
        <div class="pf-exp-top-row">
          <span class="pf-exp-company">${esc(block.data.school)}</span>
          <span class="pf-exp-dates">${esc(block.data.year)}</span>
        </div>
        <div class="pf-exp-sub-row">
          <span>${esc(block.data.degree)}</span>
          <span>${esc(block.data.location)}</span>
        </div>
        <div class="pf-edu-gpa">${esc(block.data.gpa)}</div>`;
      break;
    case 'projects':
      baseClass = 'pf-card';
      innerHTML = `
        <div class="pf-exp-top-row">
          <span class="pf-exp-company">${esc(block.data.name)}</span>
          <span class="pf-exp-dates">${esc(block.data.dates)}</span>
        </div>
        <div class="pf-exp-sub-row"><span>${esc(block.data.description)}</span></div>
        <ul class="rb-bullets">${(block.data.bullets || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul>`;
      break;
    case 'skills':
      baseClass = 'pf-card';
      innerHTML = `<div class="rb-skills-wrap">${(block.data.items || []).map(s => `<span class="rb-skill-tag">${esc(s)}</span>`).join('')}</div>`;
      break;
    case 'certifications':
      baseClass = 'pf-card';
      innerHTML = `<div class="rb-entry-list">${(block.data.items || []).map(it => `<div class="rb-entry-row"><span class="ce-strong">${esc(it.name || '')}</span><span class="ce-muted">${esc(it.issuer || '')}</span><span class="ce-muted">${esc(it.date || '')}</span></div>`).join('')}</div>`;
      break;
    case 'languages':
      baseClass = 'pf-card';
      innerHTML = `<div class="rb-entry-list">${(block.data.items || []).map(it => `<div class="rb-entry-row"><span class="ce-strong">${esc(it.name || '')}</span><span class="ce-muted">${esc(it.level || '')}</span></div>`).join('')}</div>`;
      break;
    case 'gallery': {
      baseClass = 'pf-card pf-gallery-card';
      innerHTML = (block.data.photos || []).length
        ? `<div class="pf-gallery-grid">${(block.data.photos || []).map((p, i) => {
            const pv = p.verify || { type: 'none' };
            const photoHref = pv.type === 'link' && pv.link ? (/^https?:\/\//i.test(pv.link) ? pv.link : `https://${pv.link}`) : null;
            const badge = canvasPhotoVerifyBadge(block, p, i);
            return photoHref
              ? `<a class="pf-gallery-item" href="${esc(photoHref)}" target="_blank" rel="noopener noreferrer" title="Open verification link">${badge}<img src="${esc(p.src)}" alt="" /></a>`
              : `<div class="pf-gallery-item" data-action="zoom-photo" data-src="${esc(p.src)}" title="Click to zoom">${badge}<img src="${esc(p.src)}" alt="" /></div>`;
          }).join('')}</div>`
        : `<div class="pf-gallery-empty">No photos yet — add some from the sidebar.</div>`;
      break;
    }
    case 'video': {
      baseClass = 'pf-card pf-video-card';
      const embedSrc = videoEmbedSrc(block.data.url);
      innerHTML = block.data.url
        ? (embedSrc
          ? `<div class="pf-video-frame"><iframe src="${esc(embedSrc)}" title="Embedded video" referrerpolicy="strict-origin-when-cross-origin" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`
          : `<a class="pf-video-fallback" href="${esc(/^https?:\/\//i.test(block.data.url) ? block.data.url : `https://${block.data.url}`)}" target="_blank" rel="noopener noreferrer">▶ Watch video</a>`)
        : `<div class="pf-gallery-empty">No video yet — add a URL from the sidebar.</div>`;
      innerHTML += block.data.caption ? `<p class="pf-video-caption">${esc(block.data.caption)}</p>` : '';
      break;
    }
    case 'links':
      baseClass = 'pf-card pf-links-card';
      innerHTML = (block.data.items || []).filter(i => i.url).length
        ? `<div class="pf-links-list">${(block.data.items || []).filter(i => i.url).map(it => `<a class="pf-link-chip" href="${esc(/^https?:\/\//i.test(it.url) ? it.url : `https://${it.url}`)}" target="_blank" rel="noopener noreferrer">${esc(it.label || it.url)} ↗</a>`).join('')}</div>`
        : `<div class="pf-gallery-empty">No links yet — add some from the sidebar.</div>`;
      break;
    default:
      break;
  }
  if (baseClass) wrapper.classList.add(...baseClass.split(' '));
  wrapper.innerHTML = innerHTML;
  return wrapper;
}

// ── 3b2. Live (editable) horizontal-slide rendering ────────────
// Mirrors buildHorizontalSectionsHTML/groupBlocksIntoSlides (used for
// the published static export) but builds real, editable block
// elements via createPortfolioBlock instead of static HTML strings,
// so the in-editor preview's horizontal mode is click-to-select,
// double-click-to-edit, and live-updating just like every other
// section-animation mode — not just a flat, unsliced row of cards.
let pfSlideEls = [];
let pfDotEls = [];
let pfCurrentSlide = 0;
let pfSlideNavBound = false;

function renderPortfolioCanvasBlocks(blocks, mode) {
  if (mode !== 'horizontal' && mode !== 'vertical') {
    el.pfSlideDots.innerHTML = '';
    el.pfSlideDots.classList.add('hidden');
    el.pfSlideArrowTop.classList.add('hidden');
    el.pfSlideArrowBottom.classList.add('hidden');
    pfSlideEls = [];
    pfDotEls = [];
    el.pfSections.innerHTML = '';
    blocks.forEach(block => el.pfSections.appendChild(createPortfolioBlock(block)));
    return;
  }

  const axis = mode === 'vertical' ? 'y' : 'x';
  const slides = groupBlocksIntoSlides(blocks);
  const keepIndex = Math.min(pfCurrentSlide, Math.max(0, slides.length - 1));

  el.pfSections.innerHTML = '';
  pfSlideEls = slides.map((slideBlocks, i) => {
    const slideEl = document.createElement('div');
    slideEl.className = 'pf-slide';
    slideEl.id = `pfSlide-${i}`;
    const innerEl = document.createElement('div');
    innerEl.className = 'pf-slide-inner';
    slideBlocks.forEach(block => innerEl.appendChild(createPortfolioBlock(block)));
    slideEl.appendChild(innerEl);
    el.pfSections.appendChild(slideEl);
    return slideEl;
  });

  el.pfSlideDots.innerHTML = '';
  el.pfSlideDots.classList.toggle('hidden', slides.length <= 1);
  // Arrowheads removed per feedback — dot nav + wheel/keyboard
  // navigation are enough; always keep the arrow buttons hidden.
  el.pfSlideArrowTop.classList.add('hidden');
  el.pfSlideArrowBottom.classList.add('hidden');
  // Arrows always sit top/bottom, but their glyph and meaning flip
  // with the scroll axis: up/down = prev/next when stacking
  // vertically, left/right when paging horizontally.
  el.pfSlideArrowTop.innerHTML = axis === 'y' ? '&#9650;' : '&#9664;';
  el.pfSlideArrowBottom.innerHTML = axis === 'y' ? '&#9660;' : '&#9654;';
  el.pfSlideArrowTop.setAttribute('aria-label', 'Previous section');
  el.pfSlideArrowBottom.setAttribute('aria-label', 'Next section');
  pfDotEls = slides.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = `pf-dot${i === keepIndex ? ' active' : ''}`;
    dot.dataset.pfSlide = String(i);
    dot.setAttribute('aria-label', `Section ${i + 1}`);
    el.pfSlideDots.appendChild(dot);
    return dot;
  });

  pfCurrentSlide = keepIndex;
  // Jump (no smooth animation — this is a re-render, not a user nav
  // action) back to whichever slide was active before the re-render,
  // once the new layout has settled.
  requestAnimationFrame(() => {
    pfSlideEls[pfCurrentSlide]?.scrollIntoView({ behavior: 'auto', block: axis === 'y' ? 'start' : 'nearest', inline: axis === 'x' ? 'start' : 'nearest' });
  });

  initPortfolioHorizontalNav();
}

function pfSetActiveDot(i) {
  pfDotEls.forEach((d, di) => d.classList.toggle('active', di === i));
  el.pfSlideArrowTop.toggleAttribute('disabled', i <= 0);
  el.pfSlideArrowBottom.toggleAttribute('disabled', i >= pfSlideEls.length - 1);
}

function pfCurrentAxis() {
  return el.portfolioSite.getAttribute('data-section-anim') === 'vertical' ? 'y' : 'x';
}

function pfGoToSlide(i) {
  if (i < 0 || i >= pfSlideEls.length) return;
  const axis = pfCurrentAxis();
  pfCurrentSlide = i;
  pfIsProgrammaticScroll = true;
  pfSlideEls[i].scrollIntoView({ behavior: 'smooth', block: axis === 'y' ? 'start' : 'nearest', inline: axis === 'x' ? 'start' : 'nearest' });
  pfSetActiveDot(i);
  setTimeout(() => { pfIsProgrammaticScroll = false; }, 500);
}

let pfIsProgrammaticScroll = false;
let pfWheelCooldown = false;

// Wired once — el.pfSections/el.pfSlideDots are stable elements that
// persist across re-renders (only their children are rebuilt each
// time), so delegation lets this survive renderPortfolioCanvasBlocks
// swapping the slide/dot elements out from under it.
function initPortfolioHorizontalNav() {
  if (pfSlideNavBound) return;
  pfSlideNavBound = true;

  el.pfSlideDots.addEventListener('click', (e) => {
    const dot = e.target.closest('.pf-dot');
    if (!dot) return;
    pfGoToSlide(parseInt(dot.dataset.pfSlide, 10));
  });

  el.pfSlideArrowTop.addEventListener('click', () => pfGoToSlide(pfCurrentSlide - 1));
  el.pfSlideArrowBottom.addEventListener('click', () => pfGoToSlide(pfCurrentSlide + 1));

  el.pfSections.addEventListener('scroll', () => {
    if (pfIsProgrammaticScroll || !pfSlideEls.length) return;
    const axis = pfCurrentAxis();
    const trackRect = el.pfSections.getBoundingClientRect();
    let closest = 0, closestDist = Infinity;
    pfSlideEls.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      const dist = axis === 'y' ? Math.abs(r.top - trackRect.top) : Math.abs(r.left - trackRect.left);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    });
    if (closest !== pfCurrentSlide) {
      pfCurrentSlide = closest;
      pfSetActiveDot(closest);
    }
  }, { passive: true });

  el.pfSections.addEventListener('keydown', (e) => {
    if (!pfSlideEls.length) return;
    const axis = pfCurrentAxis();
    if (axis === 'x') {
      if (e.key === 'ArrowRight') { e.preventDefault(); pfGoToSlide(pfCurrentSlide + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); pfGoToSlide(pfCurrentSlide - 1); }
    } else {
      if (e.key === 'ArrowDown') { e.preventDefault(); pfGoToSlide(pfCurrentSlide + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); pfGoToSlide(pfCurrentSlide - 1); }
    }
  });

  el.pfSections.addEventListener('wheel', (e) => {
    if (!pfSlideEls.length) return;
    const anim = el.portfolioSite.getAttribute('data-section-anim');
    if (anim !== 'horizontal' && anim !== 'vertical') return;
    if (window.innerWidth <= 768) return;
    const axis = anim === 'vertical' ? 'y' : 'x';
    const delta = axis === 'y' ? e.deltaY : (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY);
    if (Math.abs(delta) < 10) return;
    e.preventDefault();
    if (pfWheelCooldown) return;
    pfWheelCooldown = true;
    pfGoToSlide(pfCurrentSlide + (delta > 0 ? 1 : -1));
    setTimeout(() => { pfWheelCooldown = false; }, 700);
  }, { passive: false });
}

// ── 3c. Render whichever canvas matches the active document ───
function renderActiveCanvas() {
  const blocks = Store.active().blocks;

  if (Store.state.viewMode === 'resume') {
    el.mainTrack.innerHTML = '';
    el.sideTrack.innerHTML = '';
    blocks.forEach(block => {
      const blockEl = createResumeBlock(block);
      (block.col === 'side' ? el.sideTrack : el.mainTrack).appendChild(blockEl);
    });
  } else {
    renderPortfolioCanvasBlocks(blocks, Store.active().design.sectionAnimation || 'none');
    initPortfolioAnimation(Store.active().design.sectionAnimation || 'none');
  }

  renderSidebarList(blocks);
}

Store.on('blocks_changed', renderActiveCanvas);

// Reflect block selection with a lightweight class toggle (no re-render,
// so it never disturbs a field mid-edit).
Store.on('selection_changed', (id) => {
  document.querySelectorAll('.resume-block.selected, .pf-card.selected, .pf-block-section-title.selected, .sd-section-item.selected')
    .forEach(n => n.classList.remove('selected'));
  if (id) {
    document.querySelectorAll(`[data-id="${id}"]`).forEach(n => n.classList.add('selected'));
  }
});

// ── 3d. Canvas-level delegated events: field sync + list + verify ─
function handleFieldSync(e) {
  const target = e.target;
  // Only sync actual editable text fields — buttons like "+ Add bullet" /
  // "+ Add skill" also carry data-field (so add-item knows the target
  // array) but must never be treated as a value to write back.
  if (!target.matches('.ce-field[contenteditable="true"][data-field]')) return;
  const blockId = target.dataset.block;
  const field = target.dataset.field;
  const index = target.dataset.index !== undefined ? Number(target.dataset.index) : null;
  const subfield = target.dataset.subfield || null;
  Store.updateBlockData(blockId, field, target.textContent, index, subfield);
}

function handleTrackClick(e) {
  const actionBtn = e.target.closest('[data-action]');
  if (actionBtn) {
    const blockId = actionBtn.dataset.block;
    const field = actionBtn.dataset.field;
    const action = actionBtn.dataset.action;
    if (action === 'add-item') {
      Store.addListItem(blockId, field, actionBtn.dataset.itemType === 'object' ? {} : '');
    } else if (action === 'remove-item') {
      Store.removeListItem(blockId, field, Number(actionBtn.dataset.index));
    } else if (action === 'view-verify') {
      openVerifyViewModal(blockId, actionBtn.dataset.photoIndex !== undefined ? Number(actionBtn.dataset.photoIndex) : undefined);
    } else if (action === 'edit-verify') {
      openVerifyEditModal(blockId);
    } else if (action === 'toggle-expand') {
      toggleBlockExpand(blockId);
    } else if (action === 'zoom-photo') {
      openPhotoZoomModal(actionBtn.dataset.src);
    }
    return;
  }
  const blockEl = e.target.closest('.resume-block, .pf-card, .pf-block-section-title');
  if (blockEl) Store.setSelectedBlock(blockEl.dataset.id);
}

// Double-clicking a section on the canvas jumps straight to editing it:
// select it, open its sidebar accordion (if not already open), and
// scroll the sidebar so the edit fields are in view.
function openBlockEditFromCanvas(blockId) {
  if (!blockId) return;
  Store.setSelectedBlock(blockId);
  if (!expandedBlocks.has(blockId)) {
    expandedBlocks.add(blockId);
    renderSidebarList(Store.active().blocks);
  }
  requestAnimationFrame(() => {
    const item = document.querySelector(`.sd-section-item[data-id="${blockId}"]`);
    if (item) {
      item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      item.querySelector('.sd-edit-body .ce-field')?.focus();
    }
  });
}

function handleTrackDblClick(e) {
  if (e.target.closest('[data-action]')) return;
  const blockEl = e.target.closest('.resume-block, .pf-card, .pf-block-section-title');
  if (blockEl) openBlockEditFromCanvas(blockEl.dataset.id);
}

function initCanvasDelegation() {
  [el.mainTrack, el.sideTrack, el.pfSections].forEach(track => {
    track.addEventListener('focusout', handleFieldSync);
    track.addEventListener('click', handleTrackClick);
    track.addEventListener('dblclick', handleTrackDblClick);
  });
}

// ── 4. Generic modal system (verification popups + toasts) ────
// A real, custom-styled centered lightbox — never a native
// alert()/confirm()/prompt() — used for viewing & editing proof.
function openModal(html, onOpen) {
  el.modalContent.innerHTML = html;
  el.modalOverlay.classList.remove('hidden');
  document.addEventListener('keydown', handleModalEscape);
  if (typeof onOpen === 'function') onOpen(el.modalContent);
}

function closeModal() {
  el.modalOverlay.classList.add('hidden');
  el.modalContent.innerHTML = '';
  document.removeEventListener('keydown', handleModalEscape);
}

function handleModalEscape(e) {
  if (e.key === 'Escape') closeModal();
}

function alertModal(message) {
  openModal(`
    <h3 class="modal-title">Heads up</h3>
    <p class="modal-sub">${esc(message)}</p>
    <div class="modal-actions"><button class="btn btn-secondary btn-sm" id="alertOkBtn" type="button">OK</button></div>
  `, (root) => root.querySelector('#alertOkBtn').addEventListener('click', closeModal));
}

function initModal() {
  el.modalCloseBtn.addEventListener('click', closeModal);
  el.modalOverlay.addEventListener('click', (e) => {
    if (e.target === el.modalOverlay) closeModal();
  });
}

function openInfoModal(title, message) {
  openModal(`
    <h3 class="modal-title" id="modalTitle">${esc(title)}</h3>
    <p class="modal-sub">${esc(message)}</p>
    <div class="modal-actions"><button class="btn btn-secondary btn-sm" id="infoOkBtn" type="button">Got it</button></div>
  `, (root) => root.querySelector('#infoOkBtn').addEventListener('click', closeModal));
}

// ── 4a-i. Gallery photo zoom (lightbox) ────────────────────────
function openPhotoZoomModal(src) {
  if (!src) return;
  openModal(`<div class="verify-modal-body pf-zoom-modal-body"><img src="${esc(src)}" alt="" class="pf-zoom-img" /></div>`);
}

// ── 4a. Verification: view proof ──────────────────────────────
function openVerifyViewModal(blockId, photoIndex) {
  const block = Store.active().blocks.find(b => b.id === blockId);
  if (!block) return;
  const v = (photoIndex != null && block.data.photos && block.data.photos[photoIndex])
    ? (block.data.photos[photoIndex].verify || { type: 'none' })
    : (block.data.verify || { type: 'none' });

  let body;
  if (v.type === 'photo' && v.photo) {
    body = `<div class="verify-modal-body">
      <img src="${v.photo}" alt="Verification proof" class="verify-modal-img" />
      ${v.label ? `<p class="verify-modal-caption">${esc(v.label)}</p>` : ''}
    </div>`;
  } else if (v.type === 'link' && v.link) {
    const safeHref = /^https?:\/\//i.test(v.link) ? v.link : `https://${v.link}`;
    body = `<div class="verify-modal-body verify-modal-link">
      <div class="verify-link-icon">🔗</div>
      <p class="verify-modal-caption">${esc(v.label || 'Verification link')}</p>
      <a class="btn btn-secondary btn-sm" href="${esc(safeHref)}" target="_blank" rel="noopener noreferrer">Visit link ↗</a>
    </div>`;
  } else {
    body = `<p class="verify-empty">No proof attached yet.</p>`;
  }

  openModal(`<h3 class="modal-title" id="modalTitle">✓ Verified experience</h3>${body}`);
}

// ── 4b. Verification: add / edit / remove proof ────────────────
function openVerifyEditModal(blockId, photoIndex) {
  const block = Store.active().blocks.find(b => b.id === blockId);
  if (!block) return;
  const isPhotoScoped = photoIndex != null && block.data.photos && block.data.photos[photoIndex];
  const v = isPhotoScoped ? (block.data.photos[photoIndex].verify || { type: 'none', photo: null, link: '', label: '' }) : (block.data.verify || { type: 'none', photo: null, link: '', label: '' });

  let currentType = v.type === 'none' ? 'photo' : v.type;
  let pendingPhoto = v.photo || null;

  const html = `
    <h3 class="modal-title" id="modalTitle">${isPhotoScoped ? 'Verify this photo' : 'Verify this experience'}</h3>
    <p class="modal-sub">${isPhotoScoped ? 'Attach a photo (certificate, badge, ID) or a link (LinkedIn post, reference, article) so visitors can confirm this specific photo is real.' : 'Attach a photo (certificate, badge, ID) or a link (LinkedIn post, reference, article) so visitors can confirm this role really happened.'}</p>
    <div class="verify-type-row">
      <button class="option-pill ${currentType === 'photo' ? 'active' : ''}" data-verify-type="photo" type="button">📷 Photo</button>
      <button class="option-pill ${currentType === 'link' ? 'active' : ''}" data-verify-type="link" type="button">🔗 Link</button>
    </div>
    <div class="verify-edit-fields">
      <div class="verify-field-photo field-box ${currentType === 'photo' ? '' : 'hidden'}">
        <span>Photo</span>
        <div class="photo-input-row">
          <div class="photo-preview-placeholder" id="verifyPhotoPreview" style="${pendingPhoto ? `background-image:url(${pendingPhoto})` : ''}"></div>
          <label class="btn btn-ghost btn-sm btn-file">Upload Image <input type="file" id="verifyPhotoInput" accept="image/*" style="display:none;" /></label>
        </div>
      </div>
      <div class="verify-field-link field-box ${currentType === 'link' ? '' : 'hidden'}">
        <span>Link URL</span>
        <input type="url" id="verifyLinkInput" placeholder="https://..." value="${esc(v.link || '')}" />
      </div>
      <div class="field-box">
        <span>Caption / label</span>
        <input type="text" id="verifyLabelInput" placeholder="e.g. Certificate of Employment" value="${esc(v.label || '')}" />
      </div>
      <p class="verify-warn hidden" id="verifyWarn"></p>
    </div>
    <div class="modal-actions">
      ${v.type !== 'none' ? `<button class="btn btn-ghost btn-sm" id="verifyRemoveBtn" type="button">Remove proof</button>` : ''}
      <button class="btn btn-secondary btn-sm" id="verifySaveBtn" type="button">Save</button>
    </div>
  `;

  openModal(html, (root) => {
    const photoField = root.querySelector('.verify-field-photo');
    const linkField = root.querySelector('.verify-field-link');
    const warn = root.querySelector('#verifyWarn');

    root.querySelectorAll('[data-verify-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentType = btn.dataset.verifyType;
        root.querySelectorAll('[data-verify-type]').forEach(b => b.classList.toggle('active', b === btn));
        photoField.classList.toggle('hidden', currentType !== 'photo');
        linkField.classList.toggle('hidden', currentType !== 'link');
        warn.classList.add('hidden');
      });
    });

    root.querySelector('#verifyPhotoInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        pendingPhoto = ev.target.result;
        root.querySelector('#verifyPhotoPreview').style.backgroundImage = `url(${pendingPhoto})`;
      };
      reader.readAsDataURL(file);
    });

    const removeBtn = root.querySelector('#verifyRemoveBtn');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        Store.clearVerify(blockId, photoIndex);
        closeModal();
      });
    }

    root.querySelector('#verifySaveBtn').addEventListener('click', () => {
      const link = root.querySelector('#verifyLinkInput').value.trim();
      const label = root.querySelector('#verifyLabelInput').value.trim();

      if (currentType === 'photo' && !pendingPhoto) {
        warn.textContent = 'Upload a photo first, or switch to Link.';
        warn.classList.remove('hidden');
        return;
      }
      if (currentType === 'link' && !link) {
        warn.textContent = 'Enter a link first, or switch to Photo.';
        warn.classList.remove('hidden');
        return;
      }

      Store.updateVerify(blockId, 'type', currentType, photoIndex);
      if (currentType === 'photo') Store.updateVerify(blockId, 'photo', pendingPhoto, photoIndex);
      else Store.updateVerify(blockId, 'link', link, photoIndex);
      Store.updateVerify(blockId, 'label', label, photoIndex);
      closeModal();
    });
  });
}

// ── 4c. Publishing to <username>.proves.work ─────────────
// Talks to the Cloudflare Worker in /worker (see worker/README.md).
// Relative API paths (/api/*) — work as long as the editor itself is
// served from PUBLISH_APEX below, since that's the only host the
// Worker's /api/* route is attached to.
const PUBLISH_APEX = 'proves.work';
const PUBLISH_USERNAME_KEY = 'proveswork_username';

// ── Cross-device autosave (drafts) ──────────────────────────────
// Everyone gets local autosave — no account needed, works offline,
// and never loses work on refresh (previously there was NO
// persistence at all; a refresh silently wiped the whole document).
// Signed-in users additionally sync the exact same state to the
// server, keyed by their Google account (see worker's
// /api/draft/save + /api/draft/load) — that's what makes edits
// follow you to any device, independent of publish/paid/approval
// status. Publishing (a separate, explicit action) is unaffected —
// this only ever writes to the draft: key, never to a live site.
const LOCAL_DRAFT_KEY = 'proveswork_editor_draft';

function saveLocalDraft() {
  try {
    localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(Store.serialize()));
  } catch (err) {
    // Storage full/disabled (private browsing, etc.) — local autosave
    // is best-effort; the signed-in server sync (if any) still works.
  }
}

function loadLocalDraft() {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

let draftSyncTimer = null;
function syncDraftToServer() {
  const account = getSavedGoogleAccount();
  if (!account) return;
  fetch('/api/draft/save', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ googleCredential: account.credential, state: Store.serialize() })
  }).catch(() => { /* offline / worker not deployed yet — local autosave already has it covered */ });
}

// Local save is synchronous and immediate (never lost even if the tab
// closes a moment later); the server sync is debounced so rapid
// typing doesn't fire a request per keystroke.
function scheduleAutosave() {
  saveLocalDraft();
  if (draftSyncTimer) clearTimeout(draftSyncTimer);
  draftSyncTimer = setTimeout(syncDraftToServer, 1200);
}

async function loadServerDraft() {
  const account = getSavedGoogleAccount();
  if (!account) return null;
  try {
    const res = await fetch('/api/draft/load', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ googleCredential: account.credential })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.ok ? data.state : null;
  } catch (err) {
    return null;
  }
}

// Wires autosave to every content-mutating Store event, and — for a
// signed-in account — pulls that account's server draft in. The
// server copy wins over this browser's own localStorage if both
// exist, since it may hold newer edits made from a different device.
function initPersistence() {
  ['profile_changed', 'blocks_changed', 'design_changed', 'template_changed', 'title_changed', 'resume_reset']
    .forEach(evt => Store.on(evt, scheduleAutosave));

  loadServerDraft().then(state => {
    if (state) {
      Store.loadSerialized(state);
      saveLocalDraft();
    }
  });
}


// NOTE: this front-end scaffold requests + decodes a Google ID token
// (JWT) so the person's Google account is what proves ownership of a
// username, instead of a random token they had to copy/paste/lose.
// GOOGLE_CLIENT_ID must be set to a real OAuth Client ID from Google
// Cloud Console (APIs & Services → Credentials → OAuth client ID →
// "Web application", with this site's origin allowed) before sign-in
// will actually work. The Worker in /worker also needs a matching
// update to verify the ID token server-side and key published sites of
// off the token's `sub`/email instead of the old opaque token — see
// worker/README.md.
const GOOGLE_CLIENT_ID = '41010460965-oti1phnr8kdbij312qijrg82bc2japj7.apps.googleusercontent.com';
const GOOGLE_ACCOUNT_KEY = 'proveswork_google_account';

function getSavedGoogleAccount() {
  try { return JSON.parse(localStorage.getItem(GOOGLE_ACCOUNT_KEY) || 'null'); }
  catch (err) { return null; }
}

function saveGoogleAccount(account) {
  localStorage.setItem(GOOGLE_ACCOUNT_KEY, JSON.stringify(account));
}

function clearGoogleAccount() {
  localStorage.removeItem(GOOGLE_ACCOUNT_KEY);
}

// Decodes the (already-verified-by-Google-on-the-client) JWT payload
// just to read the email/name for display. The actual trust boundary
// is server-side — the Worker must re-verify the raw credential JWT
// itself before treating it as proof of identity; this decode is only
// for showing "Signed in as ...".
function decodeGoogleCredential(credential) {
  const payload = credential.split('.')[1];
  const json = decodeURIComponent(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    .split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
  return JSON.parse(json);
}

function handleGoogleCredential(response) {
  const payload = decodeGoogleCredential(response.credential);
  saveGoogleAccount({ email: payload.email, name: payload.name, credential: response.credential });
  renderPublishAccountBox();
  refreshNavUsername();
  refreshPublishToolbarButton();
  // Just signed in mid-session: pull in whatever draft already exists
  // for this account from another device. If there isn't one yet,
  // push what's currently in the editor up so cross-device sync
  // starts from here instead of from nothing.
  loadServerDraft().then(state => {
    if (state) {
      Store.loadSerialized(state);
      saveLocalDraft();
    } else {
      syncDraftToServer();
    }
  });
}

function renderGoogleSignInButton(container) {
  if (!(window.google && window.google.accounts && window.google.accounts.id)) {
    container.innerHTML = `<p class="username-status warn">Google sign-in script hasn't loaded (offline, or blocked) — you can still publish anonymously below.</p>`;
    return;
  }
  window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
  window.google.accounts.id.renderButton(container, { theme: 'outline', size: 'medium', text: 'signin_with' });
}

// Renders the "Account" box at the top of the Publish modal: either a
// Sign in with Google button, or the signed-in email + a sign-out link.
// Signing in with Google is how progress can follow you across
// devices/browsers going forward — it replaces the old copy-paste
// publish key entirely.
function renderPublishAccountBox() {
  const box = document.getElementById('publishAccountBox');
  if (!box) return;
  const account = getSavedGoogleAccount();
  if (account) {
    box.innerHTML = `
      <p class="username-status ok">Signed in as ${esc(account.email)}</p>
      <button class="btn btn-ghost btn-sm" id="googleSignOutBtn" type="button">Sign out</button>
    `;
    box.querySelector('#googleSignOutBtn').addEventListener('click', () => {
      clearGoogleAccount();
      renderPublishAccountBox();
      lockPublishUsernameField();
      refreshNavUsername();
      refreshPublishToolbarButton();
      closeModal();
    });
  } else {
    box.innerHTML = `
      <p class="modal-sub">Sign in with Google to save your progress.</p>
      <div id="googleSignInSlot"></div>
    `;
    renderGoogleSignInButton(box.querySelector('#googleSignInSlot'));
  }
  unlockOrLockPublishUsernameField();
}

// Keeps the username field's locked/unlocked state in sync with
// Google sign-in status, live — so signing in inside the Publish
// modal doesn't require reopening it.
function unlockOrLockPublishUsernameField() {
  const input = document.getElementById('publishUsernameInput');
  if (!input) return; // modal not open / different modal on screen
  if (getSavedGoogleAccount()) {
    input.disabled = false;
    input.placeholder = 'yourname';
    const suffix = document.getElementById('publishUsernameSuffix');
    if (suffix) suffix.textContent = `.${PUBLISH_APEX}`;
    if (!input.value) input.value = getSavedUsername() || '';
    input.dispatchEvent(new Event('input'));
  } else {
    lockPublishUsernameField();
  }
}

function lockPublishUsernameField() {
  const input = document.getElementById('publishUsernameInput');
  if (!input) return;
  input.disabled = true;
  input.value = '';
  input.placeholder = 'a-sign-up';
  const suffix = document.getElementById('publishUsernameSuffix');
  if (suffix) suffix.textContent = '';
  const status = document.getElementById('publishUsernameStatus');
  if (status) status.textContent = '';
  const confirmBtn = document.getElementById('publishConfirmBtn');
  if (confirmBtn) confirmBtn.disabled = true;
}

function getSavedUsername() {
  return localStorage.getItem(PUBLISH_USERNAME_KEY) || '';
}

function saveUsername(u) {
  localStorage.setItem(PUBLISH_USERNAME_KEY, u);
}

// Claiming your first address doesn't count as a "change" — only
// switching away from an address you already had does. Capped at 2
// changes total, so an account can use at most 3 different addresses
// over its lifetime (the original + 2 changes).
const USERNAME_CHANGE_COUNT_KEY = 'proveswork_username_change_count';
const MAX_USERNAME_CHANGES = 2;

function getUsernameChangeCount() {
  return Number(localStorage.getItem(USERNAME_CHANGE_COUNT_KEY) || '0') || 0;
}

function usernameChangesRemaining() {
  return Math.max(0, MAX_USERNAME_CHANGES - getUsernameChangeCount());
}

// Call this right before saveUsername() when the value being published
// is actually different from what was previously saved — that's the
// only case that should consume one of the 2 allowed changes.
function recordUsernameChangeIfNeeded(newUsername) {
  const previous = getSavedUsername();
  if (previous && previous !== newUsername) {
    localStorage.setItem(USERNAME_CHANGE_COUNT_KEY, String(getUsernameChangeCount() + 1));
  }
}

// ── Site status badge (toolbar) ───────────────────────────────
// Tells you, right on /editor, whether what's saved for your address
// is a draft that's never been submitted, awaiting admin approval,
// actually live, or was rejected/unpublished — since the editor's
// own "saved" state doesn't tell you what visitors currently see.
const SITE_STATUS_LABELS = {
  draft: '● Draft — not published',
  pending: '● Pending approval',
  live: '● Live',
  rejected: '● Rejected by admin',
  deleted: '● Unpublished'
};

// Once an admin has marked a site paid, show how long that payment
// covers right on the toolbar badge — e.g. "● Live · paid, 42d left" —
// so the owner doesn't have to guess when they'll need to republish
// and pay again.
function paidCountdownSuffix(data) {
  if (!data || !data.paid) return '';
  if (!data.paidUntil) return ' · paid';
  const msLeft = new Date(data.paidUntil).getTime() - Date.now();
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  if (daysLeft <= 0) return ` · paid period expired ${Math.abs(daysLeft)}d ago`;
  return ` · paid, ${daysLeft}d left`;
}

// Cached from the most recent refreshSiteStatusBadge() call — lets the
// publish flow (below) check "is this address already paid and live"
// without re-fetching, so a person who already paid never gets routed
// back through the fee modal just to push a content update.
let lastSiteStatusData = null;

async function refreshSiteStatusBadge() {
  if (!el.siteStatusBadge) return;
  const username = getSavedUsername();
  if (!username) {
    el.siteStatusBadge.className = 'site-status-badge status-draft';
    el.siteStatusBadge.textContent = SITE_STATUS_LABELS.draft;
    el.siteStatusBadge.classList.remove('hidden');
    refreshNavUsername();
    return;
  }
  try {
    const res = await fetch(`/api/site-status?u=${encodeURIComponent(username)}`);
    if (!res.ok) throw new Error('no-backend');
    const data = await res.json();
    lastSiteStatusData = data;
    const status = data.status || 'draft';
    el.siteStatusBadge.className = `site-status-badge status-${status}`;
    el.siteStatusBadge.textContent = (SITE_STATUS_LABELS[status] || SITE_STATUS_LABELS.draft) + paidCountdownSuffix(data);
    el.siteStatusBadge.classList.remove('hidden');
  } catch (err) {
    // No backend reachable from here — don't claim a status we can't
    // verify.
    lastSiteStatusData = null;
    el.siteStatusBadge.classList.add('hidden');
  }
  refreshNavUsername();
}

// Reflects the logo in the toolbar as either the placeholder
// "a-sign-up.proves.work" (in red italics) or the person's actual,
// paid-and-admin-approved address. This is intentionally NOT
// contenteditable — typing a name into the toolbar used to "reserve"
// it for free, with no sign-in, no payment, and no review. A real
// username.proves.work address now only exists once someone has
// signed in with Google, paid the publishing fee, and an admin has
// approved the site under /admin (see doPublish / SITE_STATUS_LABELS).
function initUsernameEditor() {
  refreshNavUsername();
}

// Call this whenever sign-in state, saved username, or site status
// changes, so the toolbar logo never implies an address is claimed
// when it isn't.
function refreshNavUsername() {
  if (!el.navUsername) return;
  const saved = getSavedUsername();
  const signedIn = !!getSavedGoogleAccount();
  const approvedLive = el.siteStatusBadge && el.siteStatusBadge.classList.contains('status-live');

  if (signedIn && saved && approvedLive) {
    el.navUsername.textContent = saved;
    el.navUsername.classList.remove('is-unclaimed');
    el.navUsername.classList.add('is-claimed');
    el.navUsername.title = `${saved}.${PUBLISH_APEX} — live`;
  } else {
    el.navUsername.textContent = 'a-sign-up';
    el.navUsername.classList.remove('is-claimed');
    el.navUsername.classList.add('is-unclaimed');
    el.navUsername.title = 'Sign in with Google and publish to claim a real username — subject to admin approval';
  }
}

function slugifyUsername(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

// A tiny, self-contained script embedded in every published page so
// verification badges stay clickable there too — without shipping the
// whole editor. No dependency on Store/editor.js.
const PUBLISHED_PAGE_SCRIPT = `
document.addEventListener('click', function (e) {
  var zoomEl = e.target.closest('[data-action="zoom-photo"]');
  if (zoomEl) {
    var overlay = document.getElementById('modalOverlay');
    var content = document.getElementById('modalContent');
    var src = zoomEl.getAttribute('data-src');
    content.innerHTML = '<div class="verify-modal-body pf-zoom-modal-body"><img src="' + src + '" class="pf-zoom-img" alt=""/></div>';
    overlay.classList.remove('hidden');
    return;
  }
  var btn = e.target.closest('[data-verify-type]');
  if (btn) {
    var overlay = document.getElementById('modalOverlay');
    var content = document.getElementById('modalContent');
    var type = btn.getAttribute('data-verify-type');
    var label = btn.getAttribute('data-verify-label') || '';
    var html = '';
    if (type === 'photo') {
      var photo = btn.getAttribute('data-verify-photo');
      html = '<h3 class="modal-title">Verified experience</h3><div class="verify-modal-body"><img src="' + photo + '" class="verify-modal-img" alt="Verification proof"/>' + (label ? '<p class="verify-modal-caption">' + label + '</p>' : '') + '</div>';
    } else if (type === 'link') {
      var link = btn.getAttribute('data-verify-link');
      html = '<h3 class="modal-title">Verified experience</h3><div class="verify-modal-body verify-modal-link"><div class="verify-link-icon">\\uD83D\\uDD17</div>' + (label ? '<p class="verify-modal-caption">' + label + '</p>' : '') + '<a class="btn btn-secondary btn-sm" href="' + link + '" target="_blank" rel="noopener noreferrer">Visit link \\u2197</a></div>';
    }
    content.innerHTML = html;
    overlay.classList.remove('hidden');
    return;
  }
  if (e.target.id === 'modalCloseBtn' || e.target.id === 'modalOverlay') {
    document.getElementById('modalOverlay').classList.add('hidden');
  }
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') document.getElementById('modalOverlay').classList.add('hidden');
});
(function () {
  var root = document.getElementById('portfolioSite');
  if (!root || root.getAttribute('data-section-anim') !== 'fade-up') return;
  var items = root.querySelectorAll('.pf-sections > *');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (n) { n.classList.add('pf-revealed'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) entry.target.classList.add('pf-revealed');
    });
  }, { threshold: 0.15 });
  items.forEach(function (n) { io.observe(n); });
})();
// Horizontal-slide mode: dot nav, arrow keys, and wheel-to-slide —
// scoped to .pf-sections only (the fixed hero above it is untouched),
// the same interaction model as the homepage's own slide deck.
(function () {
  var root = document.getElementById('portfolioSite');
  var anim = root && root.getAttribute('data-section-anim');
  if (!root || (anim !== 'horizontal' && anim !== 'vertical')) return;
  var axis = anim === 'vertical' ? 'y' : 'x';
  var track = root.querySelector('.pf-sections');
  var slides = root.querySelectorAll('.pf-slide');
  var dots = root.querySelectorAll('.pf-dot');
  if (!track || !slides.length) return;
  var current = 0;
  var isProgrammatic = false;

  function goTo(i) {
    if (i < 0 || i >= slides.length) return;
    current = i;
    isProgrammatic = true;
    slides[i].scrollIntoView({ behavior: 'smooth', block: axis === 'y' ? 'start' : 'nearest', inline: axis === 'x' ? 'start' : 'nearest' });
    setDots(i);
    setTimeout(function () { isProgrammatic = false; }, 500);
  }
  function setDots(i) {
    dots.forEach(function (d, di) { d.classList.toggle('active', di === i); });
  }
  dots.forEach(function (d) {
    d.addEventListener('click', function () { goTo(parseInt(d.getAttribute('data-pf-slide'), 10)); });
  });
  track.addEventListener('scroll', function () {
    if (isProgrammatic) return;
    var closest = 0, closestDist = Infinity;
    var trackRect = track.getBoundingClientRect();
    slides.forEach(function (s, i) {
      var r = s.getBoundingClientRect();
      var dist = axis === 'y' ? Math.abs(r.top - trackRect.top) : Math.abs(r.left - trackRect.left);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    });
    if (closest !== current) { current = closest; setDots(current); }
  }, { passive: true });
  track.addEventListener('keydown', function (e) {
    if (axis === 'x') {
      if (e.key === 'ArrowRight') goTo(current + 1);
      else if (e.key === 'ArrowLeft') goTo(current - 1);
    } else {
      if (e.key === 'ArrowDown') goTo(current + 1);
      else if (e.key === 'ArrowUp') goTo(current - 1);
    }
  });
  var wheelCooldown = false;
  track.addEventListener('wheel', function (e) {
    if (window.innerWidth <= 768) return;
    var delta = axis === 'y' ? e.deltaY : (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY);
    if (Math.abs(delta) < 10) return;
    e.preventDefault();
    if (wheelCooldown) return;
    wheelCooldown = true;
    goTo(current + (delta > 0 ? 1 : -1));
    setTimeout(function () { wheelCooldown = false; }, 700);
  }, { passive: false });
})();
`;

// Plain-HTML (no contenteditable, no editor chrome) render of a single
// portfolio block, for the published static snapshot.
// Clean, non-editable resume block markup — used ONLY for PDF export, so
// the exported file never contains contenteditable spans, "Edit ✎" toggles,
// remove buttons, or any other editor chrome that leaks into the print view.
// Drops hidden entry blocks, and also drops a 'section' heading block
// whenever every entry under it (up to the next 'section' block, or the
// end of the list) is hidden — an orphaned heading over an empty section
// looks broken in the published/exported output. Only meant for final
// render paths (published site, PDF export); the editor canvas still
// shows hidden blocks (dimmed) so they can be toggled back on.
function filterVisibleBlocksHidingOrphanSections(blocks) {
  const result = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (block.type === 'section') {
      let j = i + 1;
      while (j < blocks.length && blocks[j].type !== 'section') j++;
      const entries = blocks.slice(i + 1, j);
      const hasVisibleEntry = entries.some(b => !b.hidden);
      if (!block.hidden && hasVisibleEntry) result.push(block);
      entries.forEach(b => { if (!b.hidden) result.push(b); });
      i = j;
    } else {
      if (!block.hidden) result.push(block);
      i++;
    }
  }
  return result;
}

// Builds a clean, ATS-friendly plain-text version of the résumé — no
// markup, no styling, just readable text in reading order. Used by
// "Copy as Plain Text" for pasting straight into job-application
// forms and ATS upload fields that mangle rich formatting.
function buildResumePlainText() {
  const resume = Store.state.resume;
  const design = resume.design || {};
  const profile = resume.profile || {};
  const blocks = filterVisibleBlocksHidingOrphanSections(resume.blocks || []);

  const lines = [];
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  if (fullName) lines.push(fullName.toUpperCase());
  const contactBits = [profile.email, profile.phone, profile.location].filter(Boolean);
  if (design.includePortfolioLink) {
    const username = getSavedUsername();
    if (username) contactBits.push(`${username}.${PUBLISH_APEX}`);
  }
  if (contactBits.length) lines.push(contactBits.join(' | '));
  lines.push('');

  const blockToText = (block) => {
    switch (block.type) {
      case 'section':
        return [`\n${(block.data.title || '').toUpperCase()}`];
      case 'summary':
        return [block.data.text || ''];
      case 'custom':
        return [block.data.title || '', block.data.text || ''];
      case 'experience':
        return [
          `${block.data.company || ''} — ${block.data.role || ''}`,
          [block.data.location, block.data.dates].filter(Boolean).join(' | '),
          ...(block.data.bullets || []).map(b => `• ${b}`)
        ];
      case 'education':
        return [
          `${block.data.school || ''} — ${block.data.degree || ''}`,
          [block.data.location, block.data.year].filter(Boolean).join(' | '),
          block.data.gpa || ''
        ];
      case 'projects':
        return [
          `${block.data.name || ''}${block.data.dates ? ' — ' + block.data.dates : ''}`,
          block.data.description || '',
          ...(block.data.bullets || []).map(b => `• ${b}`)
        ];
      case 'skills':
        return [(block.data.items || []).join(', ')];
      case 'certifications':
        return (block.data.items || []).map(it => [it.name, it.issuer, it.date].filter(Boolean).join(' — '));
      case 'languages':
        return (block.data.items || []).map(it => [it.name, it.level].filter(Boolean).join(' — '));
      default:
        return [];
    }
  };

  // Two-column layouts still read top-to-bottom, main column first,
  // then sidebar — plain text has no room for side-by-side columns.
  const ordered = design.layout === '2'
    ? [...blocks.filter(b => b.col === 'main'), ...blocks.filter(b => b.col === 'side')]
    : blocks;

  ordered.forEach(block => {
    blockToText(block).forEach(l => { if (l !== '') lines.push(l); });
  });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function renderStaticResumeBlock(block) {
  const bulletsHTML = (bullets) => `<ul class="rb-bullets">${(bullets || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul>`;
  switch (block.type) {
    case 'section':
      return `<h2 class="rb-section-title">${esc(block.data.title)}</h2>`;
    case 'summary':
      return `<p class="rb-summary-text">${esc(block.data.text)}</p>`;
    case 'custom':
      return `<h3 class="rb-custom-title">${esc(block.data.title)}</h3><p class="rb-summary-text">${esc(block.data.text)}</p>`;
    case 'experience':
      return `<div class="rb-experience">
        <div class="rb-exp-row"><span class="rb-company">${esc(block.data.company)}</span><span class="rb-dates">${esc(block.data.dates)}</span></div>
        <div class="rb-exp-row"><span class="rb-role">${esc(block.data.role)}</span><span class="rb-loc">${esc(block.data.location)}</span></div>
        ${bulletsHTML(block.data.bullets)}
      </div>`;
    case 'education':
      return `<div class="rb-education">
        <div class="rb-edu-row"><span class="rb-edu-school">${esc(block.data.school)}</span><span class="rb-dates">${esc(block.data.year)}</span></div>
        <div class="rb-edu-row"><span class="rb-edu-degree">${esc(block.data.degree)}</span><span class="rb-loc">${esc(block.data.location)}</span></div>
        ${block.data.gpa ? `<div class="rb-edu-gpa">${esc(block.data.gpa)}</div>` : ''}
      </div>`;
    case 'projects':
      return `<div class="rb-experience">
        <div class="rb-exp-row"><span class="rb-company">${esc(block.data.name)}</span><span class="rb-dates">${esc(block.data.dates)}</span></div>
        <div class="rb-exp-row"><span class="rb-role">${esc(block.data.description)}</span></div>
        ${bulletsHTML(block.data.bullets)}
      </div>`;
    case 'skills':
      return `<div class="rb-skills-wrap">${(block.data.items || []).map(s => `<span class="rb-skill-tag">${esc(s)}</span>`).join('')}</div>`;
    case 'certifications':
      return `<div class="rb-entry-list">${(block.data.items || []).map(it => `<div class="rb-entry-row"><span class="ce-strong">${esc(it.name || '')}</span><span class="ce-muted">${esc(it.issuer || '')}</span><span class="ce-muted">${esc(it.date || '')}</span></div>`).join('')}</div>`;
    case 'languages':
      return `<div class="rb-entry-list">${(block.data.items || []).map(it => `<div class="rb-entry-row"><span class="ce-strong">${esc(it.name || '')}</span><span class="ce-muted">${esc(it.level || '')}</span></div>`).join('')}</div>`;
    default:
      return '';
  }
}

function renderStaticPortfolioBlock(block) {
  const bulletsHTML = (bullets) => `<ul class="rb-bullets">${(bullets || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul>`;

  switch (block.type) {
    case 'section':
      return `<h2 class="pf-block-section-title">${esc(block.data.title)}</h2>`;
    case 'summary':
      return `<div class="pf-card pf-summary-card">${esc(block.data.text)}</div>`;
    case 'custom':
      return `<div class="pf-card"><h3 class="pf-exp-company">${esc(block.data.title)}</h3><p>${esc(block.data.text)}</p></div>`;
    case 'experience': {
      const v = block.data.verify || { type: 'none' };
      let verifyHTML = '';
      if (v.type === 'photo' && v.photo) {
        const labelHTML = v.label ? `<span class="pf-verify-label">${esc(v.label)}</span>` : '';
        verifyHTML = `<button class="pf-verify-badge" data-verify-type="photo" data-verify-photo="${esc(v.photo)}" data-verify-label="${esc(v.label || '')}" type="button">✓ Verified${labelHTML}</button>`;
      } else if (v.type === 'link' && v.link) {
        const safeHref = /^https?:\/\//i.test(v.link) ? v.link : `https://${v.link}`;
        const labelHTML = v.label ? `<span class="pf-verify-label">${esc(v.label)}</span>` : '';
        verifyHTML = `<button class="pf-verify-badge" data-verify-type="link" data-verify-link="${esc(safeHref)}" data-verify-label="${esc(v.label || '')}" type="button">✓ Verified${labelHTML}</button>`;
      }
      return `<div class="pf-card">
        <div class="pf-exp-top-row"><span class="pf-exp-company">${esc(block.data.company)}</span><span class="pf-exp-dates">${esc(block.data.dates)}</span></div>
        <div class="pf-exp-sub-row"><span>${esc(block.data.role)}</span><span>${esc(block.data.location)}</span></div>
        ${bulletsHTML(block.data.bullets)}
        ${verifyHTML ? `<div class="pf-verify">${verifyHTML}</div>` : ''}
      </div>`;
    }
    case 'education':
      return `<div class="pf-card pf-edu-card">
        <div class="pf-exp-top-row"><span class="pf-exp-company">${esc(block.data.school)}</span><span class="pf-exp-dates">${esc(block.data.year)}</span></div>
        <div class="pf-exp-sub-row"><span>${esc(block.data.degree)}</span><span>${esc(block.data.location)}</span></div>
        ${block.data.gpa ? `<div class="pf-edu-gpa">${esc(block.data.gpa)}</div>` : ''}
      </div>`;
    case 'projects':
      return `<div class="pf-card">
        <div class="pf-exp-top-row"><span class="pf-exp-company">${esc(block.data.name)}</span><span class="pf-exp-dates">${esc(block.data.dates)}</span></div>
        <div class="pf-exp-sub-row"><span>${esc(block.data.description)}</span></div>
        ${bulletsHTML(block.data.bullets)}
      </div>`;
    case 'skills':
      return `<div class="pf-card"><div class="rb-skills-wrap">${(block.data.items || []).map(s => `<span class="rb-skill-tag">${esc(s)}</span>`).join('')}</div></div>`;
    case 'certifications':
      return `<div class="pf-card"><div class="rb-entry-list">${(block.data.items || []).map(it => `<div class="rb-entry-row"><span class="ce-strong">${esc(it.name || '')}</span><span class="ce-muted">${esc(it.issuer || '')}</span><span class="ce-muted">${esc(it.date || '')}</span></div>`).join('')}</div></div>`;
    case 'languages':
      return `<div class="pf-card"><div class="rb-entry-list">${(block.data.items || []).map(it => `<div class="rb-entry-row"><span class="ce-strong">${esc(it.name || '')}</span><span class="ce-muted">${esc(it.level || '')}</span></div>`).join('')}</div></div>`;
    case 'gallery': {
      if (!(block.data.photos || []).length) return '';
      const itemsHTML = block.data.photos.map((p, i) => {
        const pv = p.verify || { type: 'none' };
        const photoHref = pv.type === 'link' && pv.link ? (/^https?:\/\//i.test(pv.link) ? pv.link : `https://${pv.link}`) : null;
        let badge = '';
        if (pv.type === 'photo' && pv.photo) {
          const labelHTML = pv.label ? `<span class="pf-verify-label">${esc(pv.label)}</span>` : '';
          badge = `<button class="pf-photo-verify-badge" data-verify-type="photo" data-verify-photo="${esc(pv.photo)}" data-verify-label="${esc(pv.label || '')}" type="button" title="View proof">✓${labelHTML}</button>`;
        } else if (pv.type === 'link' && pv.link) {
          const safeHref = /^https?:\/\//i.test(pv.link) ? pv.link : `https://${pv.link}`;
          const labelHTML = pv.label ? `<span class="pf-verify-label">${esc(pv.label)}</span>` : '';
          badge = `<button class="pf-photo-verify-badge" data-verify-type="link" data-verify-link="${esc(safeHref)}" data-verify-label="${esc(pv.label || '')}" type="button" title="View proof">✓${labelHTML}</button>`;
        }
        return photoHref
          ? `<a class="pf-gallery-item" href="${esc(photoHref)}" target="_blank" rel="noopener noreferrer">${badge}<img src="${esc(p.src)}" alt="" /></a>`
          : `<div class="pf-gallery-item" data-action="zoom-photo" data-src="${esc(p.src)}">${badge}<img src="${esc(p.src)}" alt="" /></div>`;
      }).join('');
      return `<div class="pf-card pf-gallery-card"><div class="pf-gallery-grid">${itemsHTML}</div></div>`;
    }
    case 'video': {
      if (!block.data.url) return '';
      const embedSrc = videoEmbedSrc(block.data.url);
      const href = /^https?:\/\//i.test(block.data.url) ? block.data.url : `https://${block.data.url}`;
      const bodyHTML = embedSrc
        ? `<div class="pf-video-frame"><iframe src="${esc(embedSrc)}" title="Embedded video" referrerpolicy="strict-origin-when-cross-origin" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`
        : `<a class="pf-video-fallback" href="${esc(href)}" target="_blank" rel="noopener noreferrer">▶ Watch video</a>`;
      const captionHTML = block.data.caption ? `<p class="pf-video-caption">${esc(block.data.caption)}</p>` : '';
      return `<div class="pf-card pf-video-card">${bodyHTML}${captionHTML}</div>`;
    }
    case 'links': {
      const items = (block.data.items || []).filter(i => i.url);
      if (!items.length) return '';
      const linksHTML = items.map(it => {
        const href = /^https?:\/\//i.test(it.url) ? it.url : `https://${it.url}`;
        return `<a class="pf-link-chip" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(it.label || it.url)} ↗</a>`;
      }).join('');
      return `<div class="pf-card pf-links-card"><div class="pf-links-list">${linksHTML}</div></div>`;
    }
    default:
      return '';
  }
}

// Groups flat blocks into full-panel "slides" for horizontal mode —
// each 'section' title block starts a new slide, and everything
// under it (cards, summaries, etc.) rides along inside that same
// slide, so one slide == one themed section, the same way each
// panel on the proves.work homepage is one themed section rather
// than one card. Anything before the first section title becomes
// its own leading slide instead of being dropped.
function groupBlocksIntoSlides(blocks) {
  const slides = [];
  let current = null;
  blocks.forEach(block => {
    if (block.type === 'section' || !current) {
      current = [];
      slides.push(current);
    }
    current.push(block);
  });
  return slides;
}

function buildHorizontalSectionsHTML(blocks) {
  const slides = groupBlocksIntoSlides(blocks);
  const slidesHTML = slides.map((slideBlocks, i) => `
    <div class="pf-slide" id="pfSlide-${i}">
      <div class="pf-slide-inner">${slideBlocks.map(renderStaticPortfolioBlock).join('\n')}</div>
    </div>`).join('\n');
  const dotsHTML = slides.length > 1
    ? `<nav class="pf-slide-dots" aria-label="Portfolio sections">${slides.map((_, i) => `<button class="pf-dot${i === 0 ? ' active' : ''}" data-pf-slide="${i}" aria-label="Section ${i + 1}"></button>`).join('')}</nav>`
    : '';
  return `<div class="pf-sections">${slidesHTML}</div>${dotsHTML}`;
}

// Builds a complete, standalone HTML document for the published site.
// Always snapshots state.portfolio — publishing never reads from the
// résumé/PDF document.
function buildPublishedSiteHTML() {
  const p = Store.state.portfolio.profile;
  const design = Store.state.portfolio.design;
  const blocks = filterVisibleBlocksHidingOrphanSections(Store.state.portfolio.blocks);
  const fullName = `${p.firstName} ${p.lastName}`.trim() || 'Untitled Portfolio';
  const contactLine = [p.email, p.phone, p.address].filter(Boolean).join('   •   ');
  const isHorizontal = (design.sectionAnimation || 'none') === 'horizontal';
  const isVertical = (design.sectionAnimation || 'none') === 'vertical';
  const sectionsHTML = (isHorizontal || isVertical)
    ? buildHorizontalSectionsHTML(blocks)
    : `<div class="pf-sections">${blocks.map(renderStaticPortfolioBlock).join('\n')}</div>`;

  return `<!DOCTYPE html>
<html lang="en" data-theme="dazed">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(fullName)}${p.jobTitle ? ' — ' + esc(p.jobTitle) : ''}</title>
<meta name="description" content="${esc(p.tagline || (fullName + ' — portfolio, built with ' + PUBLISH_APEX))}" />
<link rel="stylesheet" href="https://${PUBLISH_APEX}/dazed.css" />
<link rel="stylesheet" href="https://${PUBLISH_APEX}/portfolio.css" />
<style>
  body { margin: 0; background: var(--color-background, #FDF7FA); }
  .portfolio-site { width: 100%; max-width: 100%; border: none; box-shadow: none; }
</style>
</head>
<body data-viewmode="portfolio">
  <div class="portfolio-site" id="portfolioSite" data-header-style="${esc(design.headerStyle || 'scroll')}" data-section-anim="${esc(design.sectionAnimation || 'none')}" data-dots-pos="${esc(design.dotsPosition || 'right')}" data-content-width="${esc(design.contentWidth || 'contained')}" data-hero-align="${esc(design.heroAlign || 'left')}" data-hero-photo-shape="${esc(design.heroPhotoShape || 'circle')}" data-hero-photo-size="${esc(design.heroPhotoSize || 'md')}" data-hero-size="${esc(design.heroSize || 'normal')}" style="--pf-accent:${esc(design.accent)};--pf-heading-font:${esc(FONT_STACKS[design.headingFont] || FONT_STACKS.modern)};--pf-body-font:${esc(FONT_STACKS[design.bodyFont] || FONT_STACKS.sans)};--pf-header-pct:${esc(design.headerHeightPct || 30)};--pf-text-pad:${esc((Number(design.textPaddingRem) || 0) + 'rem')};--pf-line-height:${esc(LINE_SPACING_PRESETS[design.lineSpacing] || LINE_SPACING_PRESETS.normal)};--pf-section-gap:${esc(SECTION_SPACING_PRESETS[design.sectionSpacing] || SECTION_SPACING_PRESETS.normal)};--pf-card-pad:${esc(CARD_PADDING_PRESETS[design.cardPadding] || CARD_PADDING_PRESETS.normal)};">
    <header class="pf-hero">
      ${p.photo ? `<div class="pf-hero-photo-wrap"><img src="${esc(p.photo)}" alt="${esc(fullName)}" /></div>` : ''}
      <div class="pf-hero-text">
        <h1 class="pf-name">${esc(fullName)}</h1>
        ${p.jobTitle ? `<div class="pf-jobtitle">${esc(p.jobTitle)}</div>` : ''}
        ${p.tagline ? `<p class="pf-tagline">${esc(p.tagline)}</p>` : ''}
        ${contactLine ? `<div class="pf-contact-line">${esc(contactLine)}</div>` : ''}
      </div>
    </header>
    ${sectionsHTML}
  </div>

  <div class="modal-overlay hidden" id="modalOverlay">
    <div class="modal-box" role="dialog" aria-modal="true">
      <button class="modal-close" id="modalCloseBtn" type="button" aria-label="Close">✕</button>
      <div id="modalContent"></div>
    </div>
  </div>

  <script>${PUBLISHED_PAGE_SCRIPT}</script>
</body>
</html>`;
}

// Keeps the toolbar action in sync with sign-in state: signed-out
// visitors see "Sign in to Google" (publishing requires an account to
// own the address against); once signed in it flips to the normal
// "Publish" action. Called on load, right after sign-in, and right
// after sign-out.
function refreshPublishToolbarButton() {
  const btn = document.getElementById('btnPublishShowcase');
  if (!btn) return;
  const signedIn = !!getSavedGoogleAccount();
  btn.textContent = signedIn ? '✦ Publish' : 'Sign in to Google';
  btn.classList.toggle('btn-secondary', signedIn);
  btn.classList.toggle('btn-ghost', !signedIn);
}

// A focused, single-purpose modal for signing in — shown when the
// toolbar button is clicked while signed out. On success it hands
// straight off into the normal Publish modal, so "sign in" flows
// directly into "publish" in one motion rather than making the person
// click the toolbar button a second time.
function openSignInModal() {
  openModal(`
    <h3 class="modal-title" id="modalTitle">Sign in to Google</h3>
    <p class="modal-sub">Sign in to save your progress and publish your portfolio to ${PUBLISH_APEX}.</p>
    <div class="field-box full-width" id="signInAccountBox"></div>
  `, (root) => {
    const box = root.querySelector('#signInAccountBox');
    if (!(window.google && window.google.accounts && window.google.accounts.id)) {
      box.innerHTML = `<p class="username-status warn">Google sign-in script hasn't loaded (offline, or blocked) — try again in a moment.</p>`;
      return;
    }
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        handleGoogleCredential(response);
        closeModal();
        await refreshSiteStatusBadge();
        openPublishModal();
      }
    });
    window.google.accounts.id.renderButton(box, { theme: 'outline', size: 'large', text: 'signin_with' });
  });
}

function openPublishModal() {
  const signedIn = !!getSavedGoogleAccount();
  // Blank by default — no guessed name is pre-filled and nothing is
  // reserved just by opening this dialog. A real address only exists
  // once it's typed in, checked, signed in, paid for, and approved
  // under /admin.
  const defaultUsername = signedIn ? (getSavedUsername() || '') : '';

  const html = `
    <h3 class="modal-title" id="modalTitle">Publish your portfolio</h3>
    <div class="field-box full-width" id="publishAccountBox"></div>
    <div class="field-box full-width">
      <span>Your ${PUBLISH_APEX} address</span>
      <div class="username-input-row">
        <input type="text" id="publishUsernameInput" value="${esc(defaultUsername)}" placeholder="${signedIn ? 'yourname' : 'a-sign-up'}" maxlength="30" autocomplete="off" spellcheck="false" ${signedIn ? '' : 'disabled'} />
        <span class="username-suffix" id="publishUsernameSuffix">${signedIn ? `.${PUBLISH_APEX}` : ''}</span>
      </div>
      <p class="username-status" id="publishUsernameStatus"></p>
    </div>
    <p class="modal-sub">Publishing is manually reviewed before it goes live and requires an active plan.</p>
    ${signedIn && getSavedUsername() ? `<p class="modal-sub" style="font-size:0.78rem;">You can change your username ${MAX_USERNAME_CHANGES} times total. ${usernameChangesRemaining()} change${usernameChangesRemaining() === 1 ? '' : 's'} left.</p>` : ''}
    <div class="modal-actions">
      <button class="btn btn-secondary btn-sm" id="publishConfirmBtn" type="button" disabled>Publish</button>
    </div>
  `;

  openModal(html, (root) => {
    renderPublishAccountBox();

    const input = root.querySelector('#publishUsernameInput');
    const status = root.querySelector('#publishUsernameStatus');
    const confirmBtn = root.querySelector('#publishConfirmBtn');
    let checkTimer = null;

    async function checkAvailability() {
      // Without a verified Google account there is no real address to
      // check — the field itself is disabled above, so just keep this
      // in the same locked state rather than hitting the API.
      if (!getSavedGoogleAccount()) {
        status.textContent = '';
        confirmBtn.disabled = true;
        return;
      }
      const value = slugifyUsername(input.value);
      if (input.value !== value) input.value = value;

      if (value.length < 3) {
        status.textContent = 'Must be at least 3 characters.';
        status.className = 'username-status warn';
        confirmBtn.disabled = true;
        return;
      }
      // If this is the name already saved for this browser (e.g. set once
      // from the toolbar, or from a prior publish), it's theirs — don't
      // run it past the "is it taken" check at all, since a naive
      // availability check has no way to know a name is already yours.
      if (value === getSavedUsername()) {
        status.textContent = `✓ ${value}.${PUBLISH_APEX} is already yours`;
        status.className = 'username-status ok';
        confirmBtn.disabled = false;
        return;
      }
      // Changing to a different address than the one already saved
      // consumes one of the 2 allowed username changes — block it here
      // once they're used up, rather than letting the publish request
      // go out and fail (or worse, silently reuse the limit).
      if (getSavedUsername() && usernameChangesRemaining() <= 0) {
        status.textContent = `You've already changed your username ${MAX_USERNAME_CHANGES} times — ${getSavedUsername()}.${PUBLISH_APEX} is the only address you can publish to.`;
        status.className = 'username-status warn';
        confirmBtn.disabled = true;
        return;
      }
      status.textContent = 'Checking availability…';
      status.className = 'username-status';
      try {
        const res = await fetch(`/api/check-username?u=${encodeURIComponent(value)}`);
        if (!res.ok) throw new Error('no-backend');
        const data = await res.json();
        if (data.available) {
          status.textContent = `✓ ${value}.${PUBLISH_APEX} is available`;
          status.className = 'username-status ok';
          confirmBtn.disabled = false;
        } else {
          status.textContent = data.reason === 'invalid'
            ? 'That name is reserved or has invalid characters.'
            : `${value}.${PUBLISH_APEX} is already taken.`;
          status.className = 'username-status warn';
          confirmBtn.disabled = true;
        }
      } catch (err) {
        // No live publish backend reachable from here (e.g. this copy of
        // the editor isn't served from proves.work / no worker deployed).
        // Rather than dead-end the flow, fall through to a local preview.
        status.textContent = `Live availability check isn't reachable right now — you can still generate a local preview of ${value}.${PUBLISH_APEX}.`;
        status.className = 'username-status warn';
        confirmBtn.disabled = false;
      }
    }

    input.addEventListener('input', () => {
      clearTimeout(checkTimer);
      confirmBtn.disabled = true;
      checkTimer = setTimeout(checkAvailability, 450);
    });
    checkAvailability();

    confirmBtn.addEventListener('click', () => {
      const username = slugifyUsername(input.value);
      // Already paid for THIS exact address, and not rejected/deleted?
      // This is just a content update (or a resubmission still awaiting
      // review), not a fresh publish — skip the fee modal entirely and
      // push the update straight through. Re-showing "Pay ₱399 &
      // Publish" here would be charging someone again for something
      // they already own, which used to happen for anyone whose site
      // was marked paid in /admin but not yet separately approved to
      // "live" (paid + pending is still "already paid").
      const alreadyPaid = (
        lastSiteStatusData &&
        lastSiteStatusData.status !== 'rejected' &&
        lastSiteStatusData.status !== 'deleted' &&
        lastSiteStatusData.status !== 'draft' &&
        lastSiteStatusData.paid &&
        username === getSavedUsername() &&
        (!lastSiteStatusData.paidUntil || new Date(lastSiteStatusData.paidUntil).getTime() > Date.now())
      );
      if (alreadyPaid) {
        doPublish(username, confirmBtn);
      } else {
        openPublishFeeModal(username);
      }
    });
  });
}

// One-time publishing fee, valid for a fixed window — shown as a
// confirmation step before the actual publish request goes out.
// (No real payment processor is wired up yet: "Pay & Publish" just
// proceeds, the same way the rest of this prototype mocks payment.)
const PUBLISH_FEE = { amount: 399, currency: '₱', validityMonths: 4 };

function openPublishFeeModal(username) {
  const html = `
    <h3 class="modal-title" id="modalTitle">Active Job Hunter</h3>
    <p class="modal-sub">Keeping <strong>${esc(username)}.${PUBLISH_APEX}</strong> live — plus a ★ starred, front-of-line spot in the Showcase — costs a one-time fee of <strong>${PUBLISH_FEE.currency}${PUBLISH_FEE.amount}</strong>, valid for <strong>${PUBLISH_FEE.validityMonths} months</strong> (perfect timing for a job hunt). After that, republish (same fee) to keep your address live.</p>
    <p class="modal-sub" style="font-size:0.8rem;">This covers review, hosting, and abuse protection for your subdomain. No recurring charge — it simply expires after ${PUBLISH_FEE.validityMonths} months unless renewed.</p>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" id="publishFeeBackBtn" type="button">Back</button>
      <button class="btn btn-secondary btn-sm" id="publishFeeConfirmBtn" type="button">Pay ${PUBLISH_FEE.currency}${PUBLISH_FEE.amount} & Publish</button>
    </div>
  `;
  openModal(html, (root) => {
    root.querySelector('#publishFeeBackBtn').addEventListener('click', () => openPublishModal());
    root.querySelector('#publishFeeConfirmBtn').addEventListener('click', (e) => doPublish(username, e.target));
  });
}

async function doPublish(username, confirmBtn) {
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Publishing…';
  const account = getSavedGoogleAccount();
  try {
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username,
        // The Worker verifies this ID token server-side and ties the
        // username to the Google account — publishing without one is
        // rejected server-side too (the UI already prevents reaching
        // this point unless signed in).
        googleCredential: account ? account.credential : null,
        html: buildPublishedSiteHTML()
      })
    });
    if (!res.ok) throw new Error('no-backend');
    const data = await res.json();
    if (!data.ok) {
      alertModal(data.error || 'Something went wrong.');
      return;
    }
    recordUsernameChangeIfNeeded(username);
    saveUsername(username);
    refreshSiteStatusBadge();
    // The Worker tells us whether this went straight back out as a live
    // update to an already-approved site, or is a fresh submission that
    // now needs manual review — the success modal should say the right
    // thing in each case instead of always claiming "submitted for
    // review" (which isn't true for a routine update to a live site).
    openPublishSuccessModal(data.url, data.status === 'live' ? 'updated' : 'pending');
  } catch (err) {
    // No live worker to publish to from here — generate a real,
    // fully-working local preview instead of dead-ending on a
    // network error. Swap this branch out once the worker in
    // /worker is actually deployed and reachable at PUBLISH_APEX.
    saveUsername(username);
    const blob = new Blob([buildPublishedSiteHTML()], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    openPublishSuccessModal(blobUrl, 'local');
  }
}

function openPublishSuccessModal(url, mode = 'pending') {
  // mode: 'pending' (real backend, first-time submission awaiting admin
  // review + paywall), 'updated' (real backend, but this site was
  // already live/approved — the edit went straight back out, no
  // re-review needed), or 'local' (no backend reachable — a
  // local-only preview blob).
  const title = mode === 'local' ? '👀 Local preview ready' : (mode === 'updated' ? '✓ Live site updated' : '✓ Submitted for review');
  const sub = mode === 'local'
    ? `No live backend reachable from here — this is a local preview only, nothing was published.`
    : (mode === 'updated'
      ? `Your changes are live now — no additional review needed since this address was already approved.`
      : `Your address is reserved. It'll go live once payment and admin review are complete.`);
  const linkLabel = mode === 'local' ? 'Open preview ↗' : (mode === 'updated' ? 'View live site ↗' : 'Preview address ↗');
  const showCopy = mode !== 'local';

  openModal(`
    <h3 class="modal-title" id="modalTitle">${title}</h3>
    <p class="modal-sub">${sub}</p>
    ${showCopy ? `<p class="publish-url">${esc(url)}</p>` : ''}
    <div class="modal-actions">
      ${showCopy ? `<button class="btn btn-ghost btn-sm" id="publishCopyBtn" type="button">Copy link</button>` : ''}
      <a class="btn btn-secondary btn-sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${linkLabel}</a>
    </div>
  `, (root) => {
    const copyBtn = root.querySelector('#publishCopyBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(url);
          copyBtn.textContent = 'Copied ✓';
        } catch (err) {
          /* Clipboard API may be unavailable (e.g. insecure context) — link is still visible and selectable. */
        }
      });
    }
  });
}

// ── 5. Sections list (sidebar) ─────────────────────────────────
function renderSidebarList(blocks) {
  el.sidebarSectionsList.innerHTML = '';
  const twoCol = Store.state.viewMode === 'resume' && Store.active().design.layout === '2';

  blocks.forEach(block => {
    const item = document.createElement('div');
    item.className = 'sd-section-item';
    item.dataset.id = block.id;
    if (Store.state.selectedBlockId === block.id) item.classList.add('selected');
    if (block.hidden) item.classList.add('section-hidden');
    item.draggable = true;

    let titleText = block.type.toUpperCase();
    if (block.type === 'section') titleText = `Heading: ${block.data.title}`;
    else if (block.type === 'experience') titleText = block.data.company || 'Experience';
    else if (block.type === 'education') titleText = block.data.school || 'Education';
    else if (block.type === 'projects') titleText = block.data.name || 'Project';
    else if (block.type === 'summary') titleText = 'Summary';
    else if (block.type === 'skills') titleText = 'Skills';
    else if (block.type === 'certifications') titleText = 'Certifications';
    else if (block.type === 'languages') titleText = 'Languages';
    else if (block.type === 'custom') titleText = block.data.title || 'Custom Block';

    const hasGalleryVerify = block.type === 'gallery' && (block.data.photos || []).some(p => p.verify && p.verify.type !== 'none');
    const verifyBadge = ((block.type === 'experience' && block.data.verify && block.data.verify.type !== 'none') || hasGalleryVerify)
      ? `<span class="sd-verify-dot" title="Has verification proof">✓</span>` : '';

    const swapBtn = twoCol
      ? `<button class="sd-icon-btn sd-swap-btn" data-action="swap" data-id="${block.id}" title="Move to ${block.col === 'side' ? 'main column' : 'sidebar'}" type="button">${block.col === 'side' ? '⇤' : '⇥'}</button>`
      : '';

    const isExpanded = expandedBlocks.has(block.id);
    if (isExpanded) item.classList.add('expanded');

    const hideBtn = `<button class="sd-icon-btn sd-hide-btn ${block.hidden ? 'is-hidden' : ''}" data-action="toggle-hidden" data-id="${block.id}" title="${block.hidden ? 'Show this section' : 'Hide this section (keeps its content)'}" type="button">${block.hidden ? '🚫' : '👁'}</button>`;
    const hiddenTag = block.hidden ? `<span class="sd-hidden-tag">Hidden</span>` : '';

    item.innerHTML = `
      <div class="sd-item-header">
        <span class="sd-drag-handle">☰</span>
        <span class="sd-title-text">${esc(titleText)} ${verifyBadge}${hiddenTag}</span>
        <span class="sd-item-actions">
          ${swapBtn}
          ${hideBtn}
          <button class="sd-icon-btn sd-expand-btn" data-action="toggle-expand" data-block="${block.id}" title="${isExpanded ? 'Done editing' : 'Edit this section'}" type="button">${isExpanded ? '✓' : '✎'}</button>
          <button class="sd-icon-btn sd-delete-btn" data-action="delete" data-id="${block.id}" title="Delete section" type="button">✕</button>
        </span>
      </div>
      <div class="sd-summary-line">${esc(blockSummaryLine(block))}</div>
      ${isExpanded ? `<div class="sd-edit-body">${blockEditFieldsHTML(block)}</div>` : ''}
    `;
    el.sidebarSectionsList.appendChild(item);
  });

  initSectionDragReorder();
}

function confirmDeleteSection(id) {
  openModal(`
    <h3 class="modal-title" id="modalTitle">Remove this section?</h3>
    <p class="modal-sub">This deletes just this one card — nothing else on your page is touched. This can't be undone.</p>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" id="cancelDeleteBtn" type="button">Cancel</button>
      <button class="btn btn-secondary btn-sm" id="confirmDeleteBtn" type="button">Remove section</button>
    </div>
  `, (root) => {
    root.querySelector('#cancelDeleteBtn').addEventListener('click', closeModal);
    root.querySelector('#confirmDeleteBtn').addEventListener('click', () => {
      Store.removeBlock(id);
      closeModal();
    });
  });
}

function initSidebarActions() {
  el.sidebarSectionsList.addEventListener('change', (e) => {
    const input = e.target.closest('.sd-gallery-file-input');
    if (!input || !input.files[0]) return;
    const blockId = input.dataset.block;
    const reader = new FileReader();
    reader.onload = (ev) => Store.addListItem(blockId, 'photos', { id: uid(), src: ev.target.result, verify: { type: 'none', photo: null, link: '', label: '' } });
    reader.readAsDataURL(input.files[0]);
  });

  el.sidebarSectionsList.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      e.preventDefault();
      e.stopPropagation();
      const action = actionBtn.dataset.action;
      // "delete" / "swap" address a block via data-id (list-management
      // actions on the item header); everything else (accordion toggle,
      // add/remove list item, verify) addresses a block via data-block
      // (field-editing actions, same scheme the old canvas chrome used).
      if (action === 'delete') {
        confirmDeleteSection(actionBtn.dataset.id);
      } else if (action === 'swap') {
        const id = actionBtn.dataset.id;
        const block = Store.active().blocks.find(b => b.id === id);
        if (block) Store.setBlockColumn(id, block.col === 'side' ? 'main' : 'side');
      } else if (action === 'toggle-hidden') {
        Store.toggleBlockHidden(actionBtn.dataset.id);
      } else if (action === 'toggle-expand') {
        toggleBlockExpand(actionBtn.dataset.block);
      } else if (action === 'add-item') {
        Store.addListItem(actionBtn.dataset.block, actionBtn.dataset.field, actionBtn.dataset.itemType === 'object' ? {} : '');
      } else if (action === 'remove-item') {
        Store.removeListItem(actionBtn.dataset.block, actionBtn.dataset.field, Number(actionBtn.dataset.index));
      } else if (action === 'view-verify') {
        openVerifyViewModal(actionBtn.dataset.block);
      } else if (action === 'edit-verify') {
        openVerifyEditModal(actionBtn.dataset.block);
      } else if (action === 'edit-photo-verify') {
        openVerifyEditModal(actionBtn.dataset.block, Number(actionBtn.dataset.photoIndex));
      }
      return;
    }
    // Clicking inside the open edit body (e.g. into a ce-field to type)
    // should still select the block, but must never toggle it closed —
    // only the explicit Edit ✎ / Done ✓ button does that.
    const item = e.target.closest('.sd-section-item');
    if (item) Store.setSelectedBlock(item.dataset.id);
  });

  // Same field-sync used by the (now read-only) canvas — writes a
  // ce-field's text back into the Store the moment it loses focus.
  el.sidebarSectionsList.addEventListener('focusout', handleFieldSync);

  // Double-clicking a collapsed sidebar item's header opens it straight
  // into edit mode, same as double-clicking the section on the canvas.
  el.sidebarSectionsList.addEventListener('dblclick', (e) => {
    if (e.target.closest('.ce-field, [data-action]')) return;
    const item = e.target.closest('.sd-section-item');
    if (item && !expandedBlocks.has(item.dataset.id)) {
      toggleBlockExpand(item.dataset.id);
    }
  });
}

// Media blocks (photo gallery, embedded video) only render on the
// portfolio site — the plain-text resume silently drops them (see
// renderStaticResumeBlock's default case). Rather than let people add
// a section that then appears to do nothing, the résumé's "add
// section" menu excludes them; switching to the portfolio tab brings
// them back. Nothing is deleted either way — this only affects which
// options are offered, never existing content.
function renderAddSectionMenu() {
  const library = Store.state.viewMode === 'resume'
    ? BLOCK_LIBRARY.filter(item => !item.mediaOnly)
    : BLOCK_LIBRARY;
  el.addSectionMenu.innerHTML = library.map(item =>
    `<button class="add-section-item" data-type="${item.type}" type="button">${esc(item.label)}</button>`
  ).join('');
}

function initAddSectionMenu() {
  renderAddSectionMenu();

  el.btnAddSection.addEventListener('click', (e) => {
    e.stopPropagation();
    el.addSectionMenu.classList.toggle('hidden');
  });

  el.addSectionMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    const newId = Store.addBlock(btn.dataset.type, 'main');
    el.addSectionMenu.classList.add('hidden');
    // Newly added blocks are appended to the END of the list — without
    // this it can look like existing content vanished when really the
    // new (empty/placeholder) block just landed off-screen below the fold.
    requestAnimationFrame(() => {
      document.querySelector(`.sd-section-item[data-id="${newId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.querySelector(`[data-id="${newId}"].resume-block, [data-id="${newId}"].pf-card, [data-id="${newId}"].pf-block-section-title`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  document.addEventListener('click', (e) => {
    if (!el.addSectionMenu.classList.contains('hidden') && !e.target.closest('.add-section-wrap')) {
      el.addSectionMenu.classList.add('hidden');
    }
  });
}

function initSectionDragReorder() {
  const items = Array.from(el.sidebarSectionsList.querySelectorAll('.sd-section-item'));
  let draggedId = null;

  items.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedId = item.dataset.id;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      items.forEach(i => i.classList.remove('drag-over'));
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (item.dataset.id === draggedId) return;
      item.classList.add('drag-over');
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('drag-over');
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const targetId = item.dataset.id;
      if (!draggedId || draggedId === targetId) return;

      const blocks = [...Store.active().blocks];
      const fromIndex = blocks.findIndex(b => b.id === draggedId);
      const toIndex = blocks.findIndex(b => b.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return;

      const [moved] = blocks.splice(fromIndex, 1);
      blocks.splice(toIndex, 0, moved);
      Store.setBlocks(blocks);
    });
  });
}

// ── 5c. Résumé PDF export — real, downloadable PDF file ────────
// Builds a fully static (non-editable, chrome-free) copy of the resume in
// an off-screen container — never touches the live editable canvas — and
// hands it to html2pdf.js, which generates and auto-downloads an actual
// .pdf file. No print dialog, no "Edit ✎" buttons, no remove buttons.
async function ensureHtml2Pdf() {
  if (window.html2pdf) return window.html2pdf;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load PDF engine'));
    document.head.appendChild(s);
  });
  return window.html2pdf;
}

async function downloadResumeAsPDF() {
  const btn = document.getElementById('btnDownloadPDF');
  const originalLabel = btn ? btn.textContent : null;
  if (btn) { btn.disabled = true; btn.textContent = 'Preparing PDF…'; }

  try {
    const html2pdf = await ensureHtml2Pdf();
    const resume = Store.state.resume;
    const design = resume.design || {};
    const blocks = resume.blocks || [];
    const profile = resume.profile || {};

    const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Resume';
    const contactLine = [profile.email, profile.phone, profile.address].filter(Boolean).join(' • ');

    const clone = document.createElement('div');
    clone.className = 'resume-paper';
    clone.setAttribute('data-template', resume.template || 'ats');
    clone.setAttribute('data-layout', design.layout || '1');
    clone.setAttribute('data-header-align', design.headerAlign || 'left');
    clone.setAttribute('data-date-align', design.dateAlign || 'right');
    clone.setAttribute('data-title-style', design.titleStyle || 'plain');
    clone.style.setProperty('--rp-accent', design.accent || '#111');
    clone.style.setProperty('--rp-heading-font', FONT_STACKS[design.headingFont] || FONT_STACKS.sans);
    clone.style.setProperty('--rp-body-font', FONT_STACKS[design.bodyFont] || FONT_STACKS.sans);
    clone.style.setProperty('--rp-font-scale', Number(design.fontSize || 100) / 100);
    clone.style.setProperty('--rp-line-height', design.lineHeight === 'compact' ? '1.25' : design.lineHeight === 'relaxed' ? '1.7' : '1.45');

    const photoHTML = profile.photo
      ? `<div class="rb-header-photo-wrap"><img src="${esc(profile.photo)}" alt="Profile" /></div>`
      : '';
    clone.innerHTML = `
      <header class="rb-header">
        ${photoHTML}
        <div class="rb-header-text">
          <h1 class="rb-name">${esc(fullName)}</h1>
          <div class="rb-title">${esc(profile.jobTitle || '')}</div>
          <div class="rb-contact-line">${esc(contactLine)}</div>
        </div>
      </header>
      <div class="tracks-layout-${design.layout || '1'}">
        <div class="col-track main-track">${filterVisibleBlocksHidingOrphanSections(blocks.filter(b => b.col === 'main')).map(b => `<div class="resume-block block-${b.type}">${renderStaticResumeBlock(b)}</div>`).join('')}</div>
        <div class="col-track side-track">${filterVisibleBlocksHidingOrphanSections(blocks.filter(b => b.col === 'side')).map(b => `<div class="resume-block block-${b.type}">${renderStaticResumeBlock(b)}</div>`).join('')}</div>
      </div>`;

    // Render off-screen (not display:none — html2canvas needs real layout).
    clone.style.position = 'fixed';
    clone.style.top = '0';
    clone.style.left = '-99999px';
    document.body.appendChild(clone);

    const filename = `${fullName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'resume'}.pdf`;

    await html2pdf()
      .set({
        margin: 0,
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
      })
      .from(clone)
      .save();

    document.body.removeChild(clone);
  } catch (err) {
    console.error(err);
    alert('Sorry — the PDF could not be generated. Please try again.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
  }
}

// ── 5d. Résumé Check — automated, in-browser critique ──────────
// Adapted from the "AI resume review" idea (Get Hired's Gemini
// button): same UX shape (score + issues + improvements), but runs
// entirely client-side with a heuristic scorer instead of calling
// an external LLM, so it works with no API key and sends nothing
// off-device. Swap `scoreResume()`'s body for a fetch() to a real
// AI endpoint later without touching the UI code below it.
const ACTION_VERBS = ['built', 'led', 'launched', 'designed', 'improved', 'increased', 'reduced', 'created', 'managed', 'shipped', 'optimized', 'developed', 'implemented', 'automated', 'delivered', 'drove', 'grew', 'saved', 'organized', 'mentored', 'architected'];

function scoreResume() {
  const r = Store.state.resume;
  const issues = [];
  const improvements = [];
  let score = 100;

  const bulletBlocks = r.blocks.filter(b => Array.isArray(b.data.bullets));
  const allBullets = bulletBlocks.flatMap(b => b.data.bullets || []);

  if (!r.profile.jobTitle) {
    issues.push('No job title/headline set — recruiters scan this first.');
    score -= 8;
  }
  if (!r.profile.email && !r.profile.phone) {
    issues.push('No email or phone listed — make sure you\'re reachable.');
    score -= 10;
  }
  if (allBullets.length === 0) {
    issues.push('No bullet points found under Experience/Projects.');
    score -= 15;
  }

  const weakBullets = allBullets.filter(b => {
    const firstWord = (b || '').trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
    return !ACTION_VERBS.includes(firstWord);
  });
  if (weakBullets.length) {
    issues.push(`${weakBullets.length} bullet${weakBullets.length > 1 ? 's' : ''} don't open with a strong action verb (e.g. "Built", "Led", "Increased").`);
    score -= Math.min(20, weakBullets.length * 4);
  }

  const noMetric = allBullets.filter(b => !/\d/.test(b || ''));
  if (allBullets.length && noMetric.length === allBullets.length) {
    improvements.push('Add at least one number to a bullet (%, $, time saved, users affected) to make impact concrete.');
    score -= 8;
  }

  const tooLong = allBullets.filter(b => (b || '').split(/\s+/).length > 28);
  if (tooLong.length) {
    improvements.push(`${tooLong.length} bullet${tooLong.length > 1 ? 's' : ''} run long — aim for one line, under ~25 words, per bullet.`);
    score -= 5;
  }

  const skillsBlock = r.blocks.find(b => b.type === 'skills');
  if (!skillsBlock || (skillsBlock.data.items || []).length < 3) {
    improvements.push('List at least a few concrete skills/tools — many ATS systems keyword-match against this section.');
    score -= 5;
  }

  score = Math.max(1, Math.min(100, Math.round(score)));
  return { score, issues, improvements };
}

function verdictForScore(score) {
  if (score >= 90) return 'Excellent, ATS-ready résumé';
  if (score >= 80) return 'Strong résumé';
  if (score >= 70) return 'Good, but needs some polish';
  if (score >= 60) return 'Weak ATS optimization';
  return 'High rejection risk — worth revising';
}

function initResumeReview() {
  const btn = document.getElementById('btnReviewResume');
  if (!btn) return;

  function paint(score, verdict, issues, improvements) {
    document.getElementById('aiReviewResults').classList.remove('hidden');
    document.getElementById('aiReviewScoreNum').textContent = score;
    document.getElementById('aiReviewVerdict').textContent = verdict;

    const issuesBox = document.getElementById('aiReviewIssuesBox');
    const issuesList = document.getElementById('aiReviewIssuesList');
    issuesList.innerHTML = issues.map(i => `<li>${esc(i)}</li>`).join('');
    issuesBox.classList.toggle('hidden', issues.length === 0);
    document.getElementById('aiReviewIssuesTitle').textContent = `${issues.length} Found Issue${issues.length === 1 ? '' : 's'}`;

    const impBox = document.getElementById('aiReviewImprovementsBox');
    const impList = document.getElementById('aiReviewImprovementsList');
    impList.innerHTML = improvements.map(i => `<li>${esc(i)}</li>`).join('');
    impBox.classList.toggle('hidden', improvements.length === 0);
    document.getElementById('aiReviewImprovementsTitle').textContent = `${improvements.length} Improvement${improvements.length === 1 ? '' : 's'}`;
  }

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = 'Checking…';
    try {
      const res = await fetch('/api/ai/resume-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resumeText: buildResumePlainText() })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'AI check failed');
      paint(data.score, data.verdict || verdictForScore(data.score), data.issues || [], data.improvements || []);
    } catch {
      // AI endpoint unavailable (e.g. not deployed yet, or the daily free
      // quota was hit) — fall back to the local heuristic scorer so the
      // feature never just breaks.
      const { score, issues, improvements } = scoreResume();
      paint(score, verdictForScore(score), issues, improvements);
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });
}

// ── 5e. Tailor résumé to a pasted job posting — in-browser keyword
// matcher. Same non-network approach as the Résumé Check above: no
// text ever leaves the device. Pulls the most meaningful terms out of
// the posting, checks which already appear in the résumé, and surfaces
// the gap plus a few common wording swaps so the person can edit their
// own bullets to mirror the posting's language.
const TAILOR_STOPWORDS = new Set(['the','and','for','are','with','that','this','you','your','will','have','has','from','our','about','into','their','they','them','than','then','also','who','what','when','where','which','while','able','not','all','any','can','may','must','should','would','could','been','being','was','were','role','job','work','team','company','years','year','experience','experienced','strong','excellent','ability','skills','skill','required','requirements','requirement','responsibilities','responsibility','including','include','includes','looking','ideal','candidate','plus','etc','using','used','use','per','each','other','more','most','some','such','within','across','over','under','both','well','high','level','including','position','apply','join','new','across','ensure','ensuring','help','helping']);

function extractKeywords(text) {
  const counts = {};
  (text.toLowerCase().match(/[a-z][a-z0-9+.#/-]{2,}/g) || []).forEach(w => {
    const word = w.replace(/^[-+.#/]+|[-+.#/]+$/g, '');
    if (word.length < 4 || TAILOR_STOPWORDS.has(word)) return;
    counts[word] = (counts[word] || 0) + 1;
  });
  return counts;
}

function buildResumeSearchText() {
  const r = Store.state.resume;
  const parts = [r.profile.jobTitle || ''];
  (r.blocks || []).forEach(b => {
    if (b.data.text) parts.push(b.data.text);
    if (Array.isArray(b.data.bullets)) parts.push(...b.data.bullets);
    if (Array.isArray(b.data.items)) parts.push(...b.data.items.map(i => (typeof i === 'string' ? i : i.name || '')));
    if (b.data.description) parts.push(b.data.description);
    if (b.data.role) parts.push(b.data.role);
  });
  return parts.join(' \n ');
}

function getResumeBullets() {
  const r = Store.state.resume;
  return (r.blocks || []).filter(b => Array.isArray(b.data.bullets)).flatMap(b => b.data.bullets || []);
}

// A short list of common wording pairs where job postings and résumés
// often favor different terms for the same underlying skill. If the
// posting leans on one side and the résumé uses the other, we flag it.
const TAILOR_SYNONYM_PAIRS = [
  ['developed', 'built'], ['engineered', 'built'], ['spearheaded', 'led'], ['directed', 'led'],
  ['collaborated', 'worked'], ['leveraged', 'used'], ['utilized', 'used'], ['implemented', 'built'],
  ['optimized', 'improved'], ['streamlined', 'improved'], ['enhanced', 'improved'], ['increased', 'grew'],
  ['communication', 'communicating'], ['stakeholders', 'clients'], ['stakeholder', 'client'],
  ['cross-functional', 'cross-team'], ['analytics', 'data analysis'], ['management', 'managing'],
  ['strategy', 'planning'], ['automation', 'automated'], ['mentored', 'trained'], ['coordinated', 'organized']
];

function tailorResumeToPosting(postingText) {
  const postingCounts = extractKeywords(postingText);
  const resumeText = buildResumeSearchText().toLowerCase();
  const bullets = getResumeBullets();

  const rankedKeywords = Object.entries(postingCounts).sort((a, b) => b[1] - a[1]);
  const matched = rankedKeywords.filter(([kw]) => resumeText.includes(kw));
  const missing = rankedKeywords.filter(([kw]) => !resumeText.includes(kw)).slice(0, 12).map(([kw]) => kw);

  const totalConsidered = Math.min(rankedKeywords.length, 40) || 1;
  const matchScore = Math.round((matched.filter(([kw]) => rankedKeywords.slice(0, 40).some(([k]) => k === kw)).length / totalConsidered) * 100);

  const emphasize = bullets.filter(b => {
    const lower = (b || '').toLowerCase();
    return rankedKeywords.slice(0, 25).some(([kw]) => lower.includes(kw));
  }).slice(0, 6);

  const swaps = [];
  TAILOR_SYNONYM_PAIRS.forEach(([a, b]) => {
    const postingHasA = postingText.toLowerCase().includes(a);
    const postingHasB = postingText.toLowerCase().includes(b);
    const resumeHasA = resumeText.includes(a);
    const resumeHasB = resumeText.includes(b);
    if (postingHasA && !postingHasB && resumeHasB && !resumeHasA) swaps.push(`Swap "${b}" → "${a}" to mirror the posting's wording.`);
    else if (postingHasB && !postingHasA && resumeHasA && !resumeHasB) swaps.push(`Swap "${a}" → "${b}" to mirror the posting's wording.`);
  });

  return { score: Math.max(0, Math.min(100, matchScore || 0)), missing, emphasize, swaps: swaps.slice(0, 8) };
}

function tailorVerdictForScore(score) {
  if (score >= 75) return 'Strong alignment with this posting';
  if (score >= 50) return 'Decent overlap — a few tweaks would help';
  if (score >= 25) return 'Light overlap — worth tailoring your wording';
  return 'Low overlap — consider reworking key sections';
}

function initTailorToPosting() {
  const btn = document.getElementById('btnTailorResume');
  const input = document.getElementById('jobPostingInput');
  const wordCount = document.getElementById('jobPostingWordCount');
  if (!btn || !input) return;

  if (wordCount) {
    const updateCount = () => {
      const words = input.value.trim().split(/\s+/).filter(Boolean);
      wordCount.textContent = `${words.length} word${words.length === 1 ? '' : 's'}`;
      wordCount.classList.toggle('is-thin', words.length > 0 && words.length < 30);
    };
    input.addEventListener('input', updateCount);
    updateCount();
  }

  function paint(score, verdict, missing, emphasize, swaps) {
    document.getElementById('tailorResults').classList.remove('hidden');
    document.getElementById('tailorScoreNum').textContent = `${score}%`;
    document.getElementById('tailorVerdict').textContent = verdict;

    const missingBox = document.getElementById('tailorMissingBox');
    const missingList = document.getElementById('tailorMissingList');
    missingList.innerHTML = missing.map(kw => `<li>${esc(kw)}</li>`).join('');
    missingBox.classList.toggle('hidden', missing.length === 0);
    document.getElementById('tailorMissingTitle').textContent = missing.length
      ? `${missing.length} Keyword${missing.length === 1 ? '' : 's'} From The Posting Not Found In Your Résumé`
      : 'Keywords Missing From Your Résumé';

    const emphasizeBox = document.getElementById('tailorEmphasizeBox');
    const emphasizeList = document.getElementById('tailorEmphasizeList');
    emphasizeList.innerHTML = emphasize.map(b => `<li>${esc(b)}</li>`).join('');
    emphasizeBox.classList.toggle('hidden', emphasize.length === 0);

    const swapBox = document.getElementById('tailorSwapBox');
    const swapList = document.getElementById('tailorSwapList');
    swapList.innerHTML = swaps.map(s => `<li>${esc(s)}</li>`).join('');
    swapBox.classList.toggle('hidden', swaps.length === 0);
  }

  btn.addEventListener('click', async () => {
    const posting = input.value.trim();
    if (!posting) {
      input.focus();
      return;
    }
    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = 'Matching…';
    try {
      const res = await fetch('/api/ai/tailor-resume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resumeText: buildResumePlainText(), postingText: posting })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'AI tailor failed');
      paint(
        data.score,
        data.verdict || tailorVerdictForScore(data.score),
        data.missingKeywords || [],
        data.emphasize || [],
        data.suggestions || []
      );
    } catch {
      // AI endpoint unavailable — fall back to the local keyword matcher.
      const { score, missing, emphasize, swaps } = tailorResumeToPosting(posting);
      paint(score, tailorVerdictForScore(score), missing, emphasize, swaps);
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });
}

// ── 6. Toolbar: view-mode switch, panel switch, doc title, actions ─
function refreshDocTitle() {
  el.docTitle.textContent = Store.state.viewMode === 'resume'
    ? Store.state.resume.resumeTitle
    : Store.state.portfolio.siteTitle;
}

function refreshToolbarActiveStates() {
  el.tabPortfolioBtn.classList.toggle('active', Store.state.viewMode === 'portfolio');
  el.tabResumeBtn.classList.toggle('active', Store.state.viewMode === 'resume');
}

function initToolbar() {
  el.tabPortfolioBtn.addEventListener('click', () => Store.setViewMode('portfolio'));
  el.tabResumeBtn.addEventListener('click', () => Store.setViewMode('resume'));
  Store.on('viewmode_changed', () => resetZoomOnModeSwitch());
  el.tabEditBtn.addEventListener('click', () => Store.setMode('edit'));
  el.tabCustomizeBtn.addEventListener('click', () => Store.setMode('customize'));

  el.docTitle.addEventListener('input', (e) => Store.updateTitle(e.target.textContent));

  document.getElementById('btnDownloadPDF').addEventListener('click', () => {
    downloadResumeAsPDF();
  });

  document.getElementById('btnPublishShowcase').addEventListener('click', async () => {
    // Signed-out visitors don't get straight to the Publish modal —
    // there's no account yet to own the address against — so the
    // button itself doubles as "Sign in to Google" until one exists.
    if (!getSavedGoogleAccount()) {
      openSignInModal();
      return;
    }
    // Refresh site status right before opening the Publish modal so
    // "already paid & live" is judged against the current truth, not
    // whatever was cached at page load — an admin could have approved
    // or marked the site paid at any point since then. This is what
    // makes the fee-skip check further down actually trustworthy.
    await refreshSiteStatusBadge();
    openPublishModal();
  });
  refreshPublishToolbarButton();
  refreshSiteStatusBadge();
  document.getElementById('btnPreviewShowcase').addEventListener('click', () => {
    const blob = new Blob([buildPublishedSiteHTML()], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank', 'noopener');
  });

  el.btnResetResume.addEventListener('click', () => {
    openModal(`
      <h3 class="modal-title" id="modalTitle">Reset résumé to match portfolio?</h3>
      <p class="modal-sub">Any résumé-only edits (wording, template, styling made here) will be lost. Your portfolio is never affected.</p>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-sm" id="cancelResumeResetBtn" type="button">Cancel</button>
        <button class="btn btn-secondary btn-sm" id="confirmResumeResetBtn" type="button">Reset résumé</button>
      </div>
    `, (root) => {
      root.querySelector('#cancelResumeResetBtn').addEventListener('click', closeModal);
      root.querySelector('#confirmResumeResetBtn').addEventListener('click', () => {
        Store.resetResumeToPortfolio();
        closeModal();
      });
    });
  });
}

// View/document switch: swap canvases, re-hydrate every panel from
// whichever document just became active.
Store.on('viewmode_changed', (vm) => {
  document.body.dataset.viewmode = vm;
  refreshToolbarActiveStates();
  refreshDocTitle();
  refreshInputsFromActive();
  refreshHeader();
  renderActiveCanvas();
  applyActiveDesign();
  renderAddSectionMenu();
});

Store.on('resume_reset', () => {
  if (Store.state.viewMode !== 'resume') return;
  refreshDocTitle();
  refreshInputsFromActive();
  refreshHeader();
  renderActiveCanvas();
  applyActiveDesign();
});

Store.on('title_changed', refreshDocTitle);

// ── 6b. Edit / Customize panel switching ──────────────────────
Store.on('mode_changed', (mode) => {
  el.tabEditBtn.classList.toggle('active', mode === 'edit');
  el.tabCustomizeBtn.classList.toggle('active', mode === 'customize');
  el.panelEdit.classList.toggle('active', mode === 'edit');
  el.panelCustomize.classList.toggle('active', mode === 'customize');
});

// ── 7. Collapsible form sections (e.g. "Personal Details") ────
function initFormSectionToggles() {
  document.querySelectorAll('.form-section-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      toggle.closest('.form-section').classList.toggle('active');
    });
  });
}

// ── 8. Customize panel: templates, layout, color, font, text ──
function populateFontSelects() {
  const opts = FONT_OPTIONS.map(f => `<option value="${f.id}">${esc(f.label)}</option>`).join('');
  el.selHeadingFont.innerHTML = opts;
  el.selBodyFont.innerHTML = opts;
}

// Portfolio templates are generated (not hand-written in HTML like the
// résumé gallery) since there are several of them and each card's
// swatch just reflects that template's own accent/font — one source
// of truth in PORTFOLIO_TEMPLATES instead of keeping markup in sync.
function populatePortfolioTemplateGallery() {
  if (!el.portfolioTemplateGallery) return;
  const cardHTML = t => `
    <button class="tpl-mini" data-portfolio-template="${t.id}" type="button" title="${esc(t.name)} — ${esc(t.tagline)}" style="background:color-mix(in srgb, ${t.design.accent} 16%, white);">
      <span class="tpl-mini-icon">${t.icon}</span>
      <span class="tpl-mini-font" style="font-family:${esc(FONT_STACKS[t.design.headingFont] || FONT_STACKS.modern)};">Aa</span>
    </button>
  `;
  el.portfolioTemplateGallery.innerHTML = `
    <div class="tpl-group">
      <div class="tpl-group-title">Templates</div>
      <div class="tpl-group-hint">Color, font & motion — same adaptive layout</div>
      <div class="template-gallery template-gallery-mini">${PORTFOLIO_TEMPLATES.map(cardHTML).join('')}</div>
    </div>
    <div class="tpl-group">
      <div class="tpl-group-title">Layouts</div>
      <div class="tpl-group-hint">Structural variations, like a photo gallery grid</div>
      <div class="template-gallery template-gallery-mini">${PORTFOLIO_STRUCTURAL_TEMPLATES.map(cardHTML).join('')}</div>
    </div>
  `;
}

// Page sizes in mm, matched between the on-screen canvas and the
// exported PDF so what you design is exactly what prints.
const PAGE_SIZES_MM = {
  letter: { w: 215.9, h: 279.4 },
  a4: { w: 210, h: 297 },
  legal: { w: 215.9, h: 355.6 }
};

function applyResumeDesign(design) {
  el.resumePaper.setAttribute('data-template', Store.state.resume.template);
  el.resumePaper.setAttribute('data-layout', design.layout);
  el.resumePaper.setAttribute('data-header-align', design.headerAlign);
  el.resumePaper.setAttribute('data-date-align', design.dateAlign);
  el.resumePaper.setAttribute('data-title-style', design.titleStyle);
  el.resumePaper.style.setProperty('--rp-accent', design.accent);
  el.resumePaper.style.setProperty('--rp-heading-font', FONT_STACKS[design.headingFont] || FONT_STACKS.sans);
  el.resumePaper.style.setProperty('--rp-body-font', FONT_STACKS[design.bodyFont] || FONT_STACKS.sans);
  el.resumePaper.style.setProperty('--rp-font-scale', Number(design.fontSize) / 100);
  el.resumePaper.style.setProperty('--rp-line-height', Number(design.lineHeight) || 1.45);

  const page = PAGE_SIZES_MM[design.pageSize] || PAGE_SIZES_MM.letter;
  el.resumePaper.style.setProperty('--rp-page-w', page.w + 'mm');
  el.resumePaper.style.setProperty('--rp-page-min-h', page.h + 'mm');
  el.resumePaper.style.setProperty('--rp-margin', (Number(design.pageMargin) || 2.5) + 'rem');
  el.resumePaper.style.setProperty('--rp-section-gap', (Number(design.sectionGap) ?? 1) + 'rem');
  el.resumePaper.style.setProperty('--rp-block-pad', (Number(design.blockPad) ?? 0.5) + 'rem');
  el.resumePaper.style.setProperty('--rp-bullet-scale', (Number(design.bulletSize) || 100) / 100);
  el.resumePaper.style.setProperty('--rp-col-gap', (Number(design.colGap) ?? 2) + 'rem');
  el.resumePaper.style.setProperty('--rp-side-width', (Number(design.colSplit) || 34) + '%');
  el.resumePaper.style.setProperty('--rp-col-border-w', design.colBorder === false ? '0px' : '2px');

  applyPortfolioLinkToResume(design);
}

// Appends "yourname.proves.work" to the résumé's contact line when
// the checkbox is on — only meaningful once the site is actually
// live under the person's own username, so it's re-derived every
// time design/site-status changes rather than baked into content.
function applyPortfolioLinkToResume(design) {
  if (!el.canvasContactLine) return;
  const marker = el.canvasContactLine.querySelector('[data-portfolio-link-chip]');
  if (marker) marker.remove();
  if (!design.includePortfolioLink) return;
  const username = getSavedUsername && getSavedUsername();
  const eligible = lastSiteStatusData && lastSiteStatusData.status === 'live' && lastSiteStatusData.paid && username;
  if (!eligible) return;
  const chip = document.createElement('span');
  chip.setAttribute('data-portfolio-link-chip', '');
  chip.textContent = ` · ${username}.${PUBLISH_APEX}`;
  el.canvasContactLine.appendChild(chip);
}

let portfolioAnimObserver = null;
function initPortfolioAnimation(mode) {
  if (portfolioAnimObserver) {
    portfolioAnimObserver.disconnect();
    portfolioAnimObserver = null;
  }
  el.portfolioSite.querySelectorAll('.pf-sections > *').forEach(n => n.classList.remove('pf-revealed'));
  if (mode !== 'fade-up') return;
  portfolioAnimObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('pf-revealed');
    });
  }, { threshold: 0.15 });
  el.portfolioSite.querySelectorAll('.pf-sections > *').forEach(n => portfolioAnimObserver.observe(n));
}

// Named presets, not raw numbers, so the panel stays simple (three
// clear choices) while the underlying CSS vars can still be tuned
// centrally here without touching markup.
const LINE_SPACING_PRESETS = { compact: 1.25, normal: 1.5, relaxed: 1.85 };
const SECTION_SPACING_PRESETS = { compact: '1rem', normal: '1.75rem', relaxed: '2.75rem' };
const CARD_PADDING_PRESETS = { compact: '0.85rem 1rem', normal: '1.25rem 1.4rem', relaxed: '1.75rem 2rem' };

function applyPortfolioDesign(design) {
  el.portfolioSite.style.setProperty('--pf-accent', design.accent);
  el.portfolioSite.style.setProperty('--pf-heading-font', FONT_STACKS[design.headingFont] || FONT_STACKS.modern);
  el.portfolioSite.style.setProperty('--pf-body-font', FONT_STACKS[design.bodyFont] || FONT_STACKS.sans);
  el.portfolioSite.setAttribute('data-header-style', design.headerStyle || 'scroll');
  el.portfolioSite.setAttribute('data-section-anim', design.sectionAnimation || 'none');
  el.portfolioSite.setAttribute('data-dots-pos', design.dotsPosition || 'right');
  el.portfolioSite.setAttribute('data-content-width', design.contentWidth || 'contained');
  el.portfolioSite.setAttribute('data-hero-align', design.heroAlign || 'left');
  el.portfolioSite.setAttribute('data-hero-photo-shape', design.heroPhotoShape || 'circle');
  el.portfolioSite.setAttribute('data-hero-photo-size', design.heroPhotoSize || 'md');
  el.portfolioSite.setAttribute('data-hero-size', design.heroSize || 'normal');
  el.portfolioSite.style.setProperty('--pf-header-pct', design.headerHeightPct || 30);
  el.portfolioSite.style.setProperty('--pf-text-pad', (Number(design.textPaddingRem) || 0) + 'rem');
  el.portfolioSite.style.setProperty('--pf-line-height', LINE_SPACING_PRESETS[design.lineSpacing] || LINE_SPACING_PRESETS.normal);
  el.portfolioSite.style.setProperty('--pf-section-gap', SECTION_SPACING_PRESETS[design.sectionSpacing] || SECTION_SPACING_PRESETS.normal);
  el.portfolioSite.style.setProperty('--pf-card-pad', CARD_PADDING_PRESETS[design.cardPadding] || CARD_PADDING_PRESETS.normal);
  initPortfolioAnimation(design.sectionAnimation || 'none');
}

function applyActiveDesign() {
  const design = Store.active().design;
  if (Store.state.viewMode === 'resume') applyResumeDesign(design);
  else applyPortfolioDesign(design);
  syncCustomizeControls(design);
  renderSidebarList(Store.active().blocks);
}

function syncCustomizeControls(design) {
  document.querySelectorAll('.option-pill-row[data-target]').forEach(row => {
    const key = row.dataset.target;
    row.querySelectorAll('.option-pill').forEach(p => {
      p.classList.toggle('active', String(p.dataset.value) === String(design[key]));
    });
  });

  document.querySelectorAll('.ratio-pill-row[data-target]').forEach(row => {
    const key = row.dataset.target;
    const pct = Number(design[key]) || 30;
    row.querySelectorAll('.ratio-pill').forEach(p => {
      p.classList.toggle('active', Number(p.dataset.value) === pct);
    });
  });

  if (el.inTextPadding) {
    const pad = Number(design.textPaddingRem) || 0;
    el.inTextPadding.value = pad;
    if (el.textPaddingLabel) el.textPaddingLabel.textContent = pad + 'rem';
  }

  if (el.inFontSize) {
    const v = Number(design.fontSize) || 100;
    el.inFontSize.value = v;
    el.fontSizeLabel.textContent = v + '%';
  }
  if (el.inLineHeight) {
    const v = Number(design.lineHeight) || 1.45;
    el.inLineHeight.value = v;
    el.lineHeightLabel.textContent = v.toFixed(2).replace(/\.?0+$/, '') || v;
  }
  if (el.inSectionGap) {
    const v = Number(design.sectionGap) ?? 1;
    el.inSectionGap.value = v;
    el.sectionGapLabel.textContent = v + 'rem';
  }
  if (el.inBlockPad) {
    const v = Number(design.blockPad) ?? 0.5;
    el.inBlockPad.value = v;
    el.blockPadLabel.textContent = v + 'rem';
  }
  if (el.inBulletSize) {
    const v = Number(design.bulletSize) || 100;
    el.inBulletSize.value = v;
    el.bulletSizeLabel.textContent = v + '%';
  }
  if (el.inPageMargin) {
    const v = Number(design.pageMargin) ?? 2.5;
    el.inPageMargin.value = v;
    el.pageMarginLabel.textContent = v + 'rem';
  }
  if (el.inColSplit) {
    const v = Number(design.colSplit) || 34;
    el.inColSplit.value = v;
    el.colSplitLabel.textContent = v + '%';
  }
  if (el.inColGap) {
    const v = Number(design.colGap) ?? 2;
    el.inColGap.value = v;
    el.colGapLabel.textContent = v + 'rem';
  }
  if (el.inColBorder) el.inColBorder.checked = design.colBorder !== false;

  const isTwoCol = Store.state.viewMode === 'resume' && String(design.layout) === '2';
  [el.colSplitGroup, el.colGapGroup, el.colBorderGroup].forEach(g => { if (g) g.classList.toggle('hidden', !isTwoCol); });

  if (el.inIncludePortfolioLink && Store.state.viewMode === 'resume') {
    const username = getSavedUsername();
    const eligible = !!(lastSiteStatusData && lastSiteStatusData.status === 'live' && lastSiteStatusData.paid && username);
    el.inIncludePortfolioLink.disabled = !eligible;
    el.inIncludePortfolioLink.checked = eligible && !!design.includePortfolioLink;
    if (el.portfolioLinkUrlPreview) el.portfolioLinkUrlPreview.textContent = `${username || 'yourname'}.${PUBLISH_APEX}`;
    if (el.portfolioLinkLockMsg) {
      el.portfolioLinkLockMsg.classList.toggle('hidden', eligible);
    }
  }

  const knownSwatches = Array.from(document.querySelectorAll('#optAccentColor .color-swatch[data-value]'));
  let matched = false;
  knownSwatches.forEach(sw => {
    const isMatch = sw.dataset.value.toLowerCase() === (design.accent || '').toLowerCase();
    sw.classList.toggle('active', isMatch);
    if (isMatch) matched = true;
  });
  el.accentSwatchCustom.classList.toggle('active', !matched);
  el.inAccentCustom.value = design.accent || '#1A1A1A';

  el.selHeadingFont.value = design.headingFont;
  el.selBodyFont.value = design.bodyFont;

  document.querySelectorAll('.template-card[data-template]').forEach(card => {
    card.classList.toggle('active', Store.state.viewMode === 'resume' && card.dataset.template === Store.state.resume.template);
  });

  document.querySelectorAll('.tpl-mini[data-portfolio-template]').forEach(card => {
    card.classList.toggle('active', Store.state.viewMode === 'portfolio' && card.dataset.portfolioTemplate === Store.state.portfolio.template);
  });
}

function initCustomizePanel() {
  populateFontSelects();
  populatePortfolioTemplateGallery();

  document.querySelectorAll('.option-pill-row[data-target]').forEach(row => {
    const key = row.dataset.target;
    row.querySelectorAll('.option-pill').forEach(pill => {
      pill.addEventListener('click', () => Store.setDesign(key, pill.dataset.value));
    });
  });

  document.querySelectorAll('#optAccentColor .color-swatch[data-value]').forEach(sw => {
    sw.addEventListener('click', () => Store.setDesign('accent', sw.dataset.value));
  });
  el.inAccentCustom.addEventListener('input', (e) => Store.setDesign('accent', e.target.value));

  el.selHeadingFont.addEventListener('change', (e) => Store.setDesign('headingFont', e.target.value));
  el.selBodyFont.addEventListener('change', (e) => Store.setDesign('bodyFont', e.target.value));

  document.querySelectorAll('.ratio-pill-row[data-target]').forEach(row => {
    const key = row.dataset.target;
    row.querySelectorAll('.ratio-pill').forEach(pill => {
      pill.addEventListener('click', () => Store.setDesign(key, Number(pill.dataset.value)));
    });
  });

  if (el.inTextPadding) {
    el.inTextPadding.addEventListener('input', (e) => {
      const pad = Math.min(2, Math.max(0, Number(e.target.value) || 0));
      if (el.textPaddingLabel) el.textPaddingLabel.textContent = pad + 'rem';
      Store.setDesign('textPaddingRem', pad);
    });
  }

  // Numeric résumé sliders — every one of these is a raw, directly
  // editable number (no named presets) per-spec, each with a quiet
  // "recommended" tick mark rather than a hard default.
  const bindRangeSlider = (input, label, key, unit, parseFn = Number) => {
    if (!input) return;
    input.addEventListener('input', (e) => {
      const v = parseFn(e.target.value);
      if (label) label.textContent = (unit === '%' ? v : v) + unit;
      Store.setDesign(key, v);
    });
  };
  bindRangeSlider(el.inFontSize, el.fontSizeLabel, 'fontSize', '%');
  bindRangeSlider(el.inLineHeight, el.lineHeightLabel, 'lineHeight', '');
  bindRangeSlider(el.inSectionGap, el.sectionGapLabel, 'sectionGap', 'rem');
  bindRangeSlider(el.inBlockPad, el.blockPadLabel, 'blockPad', 'rem');
  bindRangeSlider(el.inBulletSize, el.bulletSizeLabel, 'bulletSize', '%');
  bindRangeSlider(el.inPageMargin, el.pageMarginLabel, 'pageMargin', 'rem');
  bindRangeSlider(el.inColSplit, el.colSplitLabel, 'colSplit', '%');
  bindRangeSlider(el.inColGap, el.colGapLabel, 'colGap', 'rem');

  if (el.inColBorder) {
    el.inColBorder.addEventListener('change', (e) => Store.setDesign('colBorder', e.target.checked));
  }

  if (el.inIncludePortfolioLink) {
    el.inIncludePortfolioLink.addEventListener('change', (e) => Store.setDesign('includePortfolioLink', e.target.checked));
  }

  document.querySelectorAll('.template-card[data-template]').forEach(card => {
    card.addEventListener('click', () => Store.setTemplate(card.dataset.template));
  });

  document.querySelectorAll('.tpl-mini[data-portfolio-template]').forEach(card => {
    card.addEventListener('click', () => Store.setPortfolioTemplate(card.dataset.portfolioTemplate));
  });

  Store.on('design_changed', (design) => {
    applyActiveDesign();
    // Section-animation mode changes the *shape* of the DOM the canvas
    // needs (blocks grouped into full-panel .pf-slide wrappers for
    // horizontal/vertical, flat otherwise) — applyActiveDesign only
    // updates attributes/CSS vars, so without this, switching into
    // Horizontal/Vertical scroll left the old flat block markup in
    // place: the CSS then laid those un-sliced cards out in a single
    // cramped row instead of real full-width slides.
    if (Store.state.viewMode === 'portfolio') {
      const mode = Store.active().design.sectionAnimation || 'none';
      renderPortfolioCanvasBlocks(Store.active().blocks, mode);
      initPortfolioAnimation(mode);
    }
  });
}

// ── 9. Zoom controls (applies to whichever canvas is showing) ──
// Default behavior is "fit to page": the whole document is always
// visible, and the zoom recalculates live whenever the space it has
// to work with changes (sidebar drag, window resize) or the document
// itself changes size (content edits, template/layout changes).
// Manual +/- or ctrl+wheel zoom breaks out of fit mode; clicking the
// percentage label returns to it.
// Set by initZoomControls; called directly by the sidebar resizer drag
// so the canvas re-fits in lockstep with the drag itself, instead of
// solely trusting ResizeObserver's own (rAF-batched, sometimes-delayed)
// timing to notice the canvas area changed size.
let forceCanvasRefit = () => {};
let resetZoomOnModeSwitch = () => {};

function initZoomControls() {
  const MIN_ZOOM = 25;
  const MAX_ZOOM = 150;
  const STEP = 10;

  let zoom = 100;
  let fitMode = true;

  const getActiveDoc = () => (
    Store.state.viewMode === 'resume' ? el.resumePaper : el.portfolioSite
  );

  const getAvailWidth = () => {
    const wrapStyle = getComputedStyle(el.canvasWrap);
    const padX = parseFloat(wrapStyle.paddingLeft) + parseFloat(wrapStyle.paddingRight);
    return el.canvasWrap.clientWidth - padX;
  };

  // Portfolio now renders edge-to-edge in the editor (see #canvasWrap
  // .portfolio-site override in editor.css), same as the real
  // published page. Its width must come from the actual browser
  // viewport (documentElement.clientWidth — window width minus its
  // own scrollbar) and NOT from the canvas region's available space,
  // which shrinks whenever the left sidebar is dragged wider. A real
  // visitor's browser window doesn't get narrower because some other
  // panel exists next to it, so neither should this preview — it's
  // meant to always match "what my display would show", full stop.
  // If that's wider than the visible canvas area, the canvas simply
  // scrolls horizontally to reveal the rest, the same way scrolling
  // sideways on an actual wide page would work.
  const pinPortfolioWidth = () => {
    const deviceWidth = document.documentElement.clientWidth;
    if (deviceWidth > 0) {
      el.canvasZoomTarget.style.width = `${deviceWidth}px`;
    }
  };

  // "Fit" zoom, computed differently per document type:
  // - Resume is a fixed paper size, so fit means shrink-to-thumbnail
  //   (both width AND height) so the whole page is visible at once.
  // - Portfolio's width is already pinned to the real available space
  //   (pinPortfolioWidth, above) — that IS matching-real-device-width,
  //   not something zoom needs to solve. So portfolio's zoom simply
  //   stays 100% by default (a pure 1:1 preview) and is otherwise a
  //   manual-only magnifier; it's never auto-computed from a
  //   width/height ratio the way resume's is.
  const computeFitZoom = () => {
    if (Store.state.viewMode === 'portfolio') {
      // Keep the document's *natural* width pinned to the real device
      // width (so responsive breakpoints/media queries behave exactly
      // like an actual visitor's browser — see pinPortfolioWidth), but
      // don't let that force the visible canvas to overflow/scroll
      // whenever the left sidebar is dragged wider. Instead, zoom the
      // whole thing out (transform: scale) just enough to keep it fully
      // visible — same page, same dimensions, just viewed smaller.
      const deviceWidth = document.documentElement.clientWidth;
      const availWidth = getAvailWidth();
      if (!deviceWidth || availWidth <= 0) return 100;
      const scalePct = (availWidth / deviceWidth) * 100;
      return Math.min(100, Math.max(MIN_ZOOM, scalePct));
    }

    const doc = getActiveDoc();
    if (!doc) return zoom;
    const wrapStyle = getComputedStyle(el.canvasWrap);
    const padY = parseFloat(wrapStyle.paddingTop) + parseFloat(wrapStyle.paddingBottom);
    const availWidth = getAvailWidth();
    const availHeight = el.canvasWrap.clientHeight - padY;
    const docWidth = doc.offsetWidth;
    const docHeight = doc.offsetHeight;
    if (!docWidth || !docHeight || availWidth <= 0 || availHeight <= 0) return zoom;
    const scalePct = Math.min(availWidth / docWidth, availHeight / docHeight) * 100;
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scalePct));
  };

  const applyZoom = () => {
    const doc = getActiveDoc();
    const scale = zoom / 100;
    const isPortfolio = Store.state.viewMode === 'portfolio';
    if (doc && isPortfolio) {
      pinPortfolioWidth();
      const natW = doc.offsetWidth;
      const natH = doc.offsetHeight;
      el.canvasZoomTarget.style.height = `${natH}px`;
      el.canvasZoomTarget.style.transform = `translate(-50%, -50%) scale(${scale})`;
      el.canvasContainer.style.width = `${natW * scale}px`;
      el.canvasContainer.style.height = `${natH * scale}px`;
    } else if (doc) {
      // Give the zoom target an explicit, unambiguous natural size
      // (rather than relying on it shrink-wrapping its visible child)
      // so the scaled footprint we assign to the container below is
      // guaranteed to match exactly what's rendered — no drift, no
      // off-center content.
      const natW = doc.offsetWidth;
      const natH = doc.offsetHeight;
      el.canvasZoomTarget.style.width = `${natW}px`;
      el.canvasZoomTarget.style.height = `${natH}px`;
      el.canvasZoomTarget.style.transform = `translate(-50%, -50%) scale(${scale})`;
      el.canvasContainer.style.width = `${natW * scale}px`;
      el.canvasContainer.style.height = `${natH * scale}px`;
    } else {
      el.canvasZoomTarget.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }
    el.zoomLevelDisplay.textContent = `${Math.round(zoom)}%`;
    el.zoomLevelDisplay.title = fitMode
      ? 'Fitted to window — click +/- to zoom manually'
      : 'Click to fit the whole document';
    el.btnZoomOut.disabled = zoom <= MIN_ZOOM;
    el.btnZoomIn.disabled = zoom >= MAX_ZOOM;
  };

  const refit = () => {
    const fitZoom = computeFitZoom();
    if (fitMode) {
      zoom = fitZoom;
    } else if (zoom > fitZoom) {
      zoom = fitZoom;
    }
    applyZoom();
  };

  el.btnZoomIn.addEventListener('click', () => {
    fitMode = false;
    zoom = Math.min(MAX_ZOOM, zoom + STEP);
    applyZoom();
  });

  el.btnZoomOut.addEventListener('click', () => {
    fitMode = false;
    zoom = Math.max(MIN_ZOOM, zoom - STEP);
    applyZoom();
  });

  el.zoomLevelDisplay.addEventListener('click', () => {
    fitMode = true;
    refit();
  });

  el.canvasWrap.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    fitMode = false;
    zoom = e.deltaY < 0
      ? Math.min(MAX_ZOOM, zoom + STEP)
      : Math.max(MIN_ZOOM, zoom - STEP);
    applyZoom();
  }, { passive: false });

  // Recompute fit whenever the canvas area's available space changes
  // (window resize, sidebar drag — this fires continuously mid-drag)
  // or the active document's own natural size changes (typing content,
  // switching templates, changing columns/fonts/spacing).
  let rafId = null;
  const scheduleRefit = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      refit();
    });
  };

  new ResizeObserver(scheduleRefit).observe(el.canvasWrap);
  window.addEventListener('resize', scheduleRefit);
  const docObserver = new ResizeObserver(scheduleRefit);
  docObserver.observe(el.resumePaper);
  docObserver.observe(el.portfolioSite);

  forceCanvasRefit = refit;
  resetZoomOnModeSwitch = () => {
    zoom = 100;
    fitMode = true;
    refit();
  };

  // Belt-and-suspenders on top of the ResizeObservers above: content
  // (sections, photos, template swaps) can change the document's
  // natural size in ways that don't always fire a resize callback in
  // the same tick — e.g. an <img> whose box doesn't change size once
  // its src loads, or a webfont swap. When that happens the container
  // we sized for the *old* natural size goes stale, and the actually-
  // rendered (scaled) content spills out past it instead of staying
  // centered. Re-running refit() on DOM mutations, font loads, and
  // window load closes that gap.
  const mutationObserver = new MutationObserver(scheduleRefit);
  mutationObserver.observe(el.canvasZoomTarget, {
    childList: true,
    subtree: true,
    // Only 'class' — NOT the blanket 'attributes: true' this used to be.
    // applyZoom() itself sets style.transform/width/height directly on
    // this same element, so watching all attributes made every zoom
    // change observe its own mutation, re-run refit(), and clamp the
    // zoom straight back down to fit-percentage. Class changes (e.g.
    // template/selection swaps) still matter for re-fitting; the
    // self-inflicted style writes from applyZoom must not.
    attributeFilter: ['class'],
    characterData: true
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleRefit);
  }
  window.addEventListener('load', scheduleRefit);

  // Re-fit to whichever document just became active (its layout needs
  // a frame to settle after the display:none/block swap).
  Store.on('viewmode_changed', () => {
    fitMode = true;
    requestAnimationFrame(refit);
  });

  refit();
}

// ── 10. Sidebar Resizer (25% – 50% of workspace width) ────────
function initSidebarResizer() {
  const MIN_PCT = 25;
  const MAX_PCT = 50;
  const CANVAS_MIN_PX = 360;
  let dragging = false;

  el.sidebarResizer.addEventListener('mousedown', (e) => {
    dragging = true;
    el.sidebarResizer.classList.add('is-dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const workspaceRect = el.editorWorkspace.getBoundingClientRect();
    let pct = ((e.clientX - workspaceRect.left) / workspaceRect.width) * 100;
    const maxPctForCanvasRoom = ((workspaceRect.width - CANVAS_MIN_PX) / workspaceRect.width) * 100;
    pct = Math.min(MAX_PCT, maxPctForCanvasRoom, Math.max(MIN_PCT, pct));
    el.editorSidebar.style.width = `${pct}%`;
    // Recompute the fit immediately, in the same tick as the width
    // change — don't wait for ResizeObserver's own timing, so a
    // manually-zoomed document shrinks to stay fully visible in
    // real time as the sidebar (and available canvas space) changes.
    forceCanvasRefit();
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    el.sidebarResizer.classList.remove('is-dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  });
}

// ── Randomize / Reset sample content ───────────────────────────
function refreshEverythingForActiveDoc() {
  refreshDocTitle();
  refreshInputsFromActive();
  refreshHeader();
  renderActiveCanvas();
  applyActiveDesign();
}

function initSampleContentControls() {
  el.btnRandomize.addEventListener('click', () => {
    Store.randomizeContent();
    refreshEverythingForActiveDoc();
  });

  el.btnResetContent.addEventListener('click', () => {
    openModal(`
      <h3 class="modal-title" id="modalTitle">Reset to starter content?</h3>
      <p class="modal-sub">This replaces everything in this document with the original starter content. This can't be undone.</p>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-sm" id="cancelContentResetBtn" type="button">Cancel</button>
        <button class="btn btn-secondary btn-sm" id="confirmContentResetBtn" type="button">Reset</button>
      </div>
    `, (root) => {
      root.querySelector('#cancelContentResetBtn').addEventListener('click', closeModal);
      root.querySelector('#confirmContentResetBtn').addEventListener('click', () => {
        Store.resetContent();
        refreshEverythingForActiveDoc();
        closeModal();
      });
    });
  });
}

// ── Application bootstrapping ──────────────────────────────────
function init() {
  // Default to signed out on every fresh visit to the editor — a
  // lingering Google session from last time shouldn't silently carry
  // over just because localStorage still has it. This only affects
  // the *sign-in* state itself: the saved username, the site's
  // paid/approved status, and the local draft are untouched, so
  // signing back in (one click) immediately re-establishes "already
  // signed in, already paid, already approved" for the republish-fee
  // skip above — it just requires that one click each visit rather
  // than persisting indefinitely and silently.
  clearGoogleAccount();

  // Restore autosaved edits before the first paint. Local storage is
  // synchronous, so this can't race the initial render below; a
  // signed-in user's server draft (possibly newer, from another
  // device) is fetched and applied right after — see initPersistence.
  const localDraft = loadLocalDraft();
  if (localDraft) Store.loadSerialized(localDraft);

  document.body.dataset.viewmode = Store.state.viewMode;

  initModal();
  initUsernameEditor();
  initInputListeners();
  initToolbar();
  initSidebarResizer();
  initFormSectionToggles();
  initResumeReview();
  initTailorToPosting();
  initCustomizePanel();
  initZoomControls();
  initCanvasDelegation();
  initSidebarActions();
  initAddSectionMenu();
  initSampleContentControls();
  initPersistence();

  refreshToolbarActiveStates();
  refreshDocTitle();
  refreshInputsFromActive();

  Store.emit('profile_changed', Store.active().profile);
  Store.emit('mode_changed', Store.state.mode);

  renderActiveCanvas();
  applyActiveDesign();
}

document.addEventListener('DOMContentLoaded', init);
