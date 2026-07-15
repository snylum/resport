import { Store, esc, uid, TEMPLATES, PORTFOLIO_TEMPLATES, PORTFOLIO_STRUCTURAL_TEMPLATES, FONT_STACKS, FONT_OPTIONS, BLOCK_LIBRARY, emptyBlockStyle } from './store.js';
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
  dotsCenteringGroup: document.getElementById('dotsCenteringGroup'),
  dotsSymbolGroup: document.getElementById('dotsSymbolGroup'),

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
  inHeroPhotoBorder: document.getElementById('inHeroPhotoBorder'),
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
  modalBox: document.getElementById('modalBox'),
  modalCloseBtn: document.getElementById('modalCloseBtn')
};

// ── Image upload compression ──────────────────────────────────
// Every photo (profile, gallery, verification) ends up embedded
// directly as a base64 data URL in the published page (see
// buildPublishedSiteHTML) — an unmodified phone photo can be several
// MB on its own, and base64 inflates that by another ~33% on top.
// Downscaling + recompressing on upload keeps published pages small
// and fast to load, and means the Worker's page-size cap (see
// /api/publish in worker/src/index.js) practically never gets hit
// regardless of what someone uploads.
const IMAGE_UPLOAD_MAX_DIMENSION = 1600; // px, longest side
const IMAGE_UPLOAD_JPEG_QUALITY = 0.82;

function readAndCompressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      reject(new Error('Not an image file.'));
      return;
    }
    // GIFs may be animated — decoding through <canvas> would flatten
    // them to a single frame, so those pass through unmodified.
    if (file.type === 'image/gif') {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target.result);
      reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
      reader.readAsDataURL(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, IMAGE_UPLOAD_MAX_DIMENSION / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        // Re-encoding as JPEG drops alpha, so PNGs (logos, cutouts —
        // anything that might actually rely on transparency) keep
        // their original format instead of getting a flattened black
        // background.
        const keepPng = file.type === 'image/png';
        try {
          resolve(canvas.toDataURL(keepPng ? 'image/png' : 'image/jpeg', keepPng ? undefined : IMAGE_UPLOAD_JPEG_QUALITY));
        } catch (err) {
          // Canvas export can fail in rare cases — fall back to the
          // original upload rather than losing it entirely.
          resolve(ev.target.result);
        }
      };
      img.onerror = () => resolve(ev.target.result); // fall back on decode failure
      img.src = ev.target.result;
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

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
    readAndCompressImage(file)
      .then((dataUrl) => Store.updateProfile('photo', dataUrl))
      .catch(() => {});
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

// Skill items were originally plain strings; adding per-skill proof
// needs somewhere to hang a `verify` object, so a skill can now also
// be `{ name, verify }`. These two helpers paper over both shapes
// everywhere a skill gets displayed or checked for proof, so existing
// portfolios (still storing plain strings) keep working untouched.
function skillName(it) {
  return typeof it === 'string' ? it : ((it && it.name) || '');
}
function skillVerify(it) {
  return (it && typeof it === 'object' && it.verify) || { type: 'none' };
}

function renderSkillTags(items, blockId, field) {
  const showVerify = Store.state.viewMode === 'portfolio';
  const tags = (items || []).map((s, i) => {
    const verified = skillVerify(s).type !== 'none';
    return `
    <span class="rb-skill-tag">
      ${ceField(skillName(s), field, blockId, { index: i, subfield: 'name' })}
      ${showVerify ? `<button class="sd-gallery-thumb-verify ${verified ? 'is-verified' : ''}" data-action="edit-photo-verify" data-block="${blockId}" data-photo-index="${i}" title="${verified ? 'Edit proof for this skill' : 'Add proof for this skill'}" type="button">${verified ? '✓' : '+ proof'}</button>` : ''}
      <button class="tag-remove-btn" data-action="remove-item" data-block="${blockId}" data-field="${field}" data-index="${i}" title="Remove" type="button">✕</button>
    </span>`;
  }).join('');
  return `<div class="rb-skills-wrap">${tags}</div>
    <button class="add-item-btn" data-action="add-item" data-block="${blockId}" data-field="${field}" type="button">+ Add skill</button>`;
}

function renderEntryList(items, blockId, field, cols) {
  const showVerify = Store.state.viewMode === 'portfolio';
  const rows = (items || []).map((it, i) => {
    const verified = it.verify && it.verify.type !== 'none';
    return `
    <div class="rb-entry-row">
      <div class="rb-entry-fields">
        ${cols.map(c => `
          <div class="rb-entry-subfield">
            ${c.label ? `<span class="rb-entry-subfield-label">${esc(c.label)}</span>` : ''}
            ${ceField(it[c.key] || '', field, blockId, { index: i, subfield: c.key, cls: c.cls })}
          </div>`).join('')}
      </div>
      ${showVerify ? `<button class="sd-gallery-thumb-verify ${verified ? 'is-verified' : ''}" data-action="edit-photo-verify" data-block="${blockId}" data-photo-index="${i}" type="button" title="${verified ? 'Edit proof for this entry' : 'Add proof for this entry'}">${verified ? '✓' : '+ proof'}</button>` : ''}
      <button class="li-remove-btn" data-action="remove-item" data-block="${blockId}" data-field="${field}" data-index="${i}" title="Remove" type="button">✕</button>
    </div>`;
  }).join('');
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

// Crisp SVG checkmark used in every verified badge, instead of the
// unicode "✓" glyph — renders identically (weight, alignment) across
// every OS/font instead of depending on whatever glyph the system
// font ships, and scales cleanly at the small sizes these badges use.
const CHECK_ICON = '<svg class="pf-check-icon" width="9" height="9" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// The actual "verified" mark shown on the portfolio — a scalloped,
// rounded-petal seal (like a notary/social "verified" badge) instead
// of a plain flat circle, with the checkmark baked in. Colored green
// (var(--color-success)) via `fill: currentColor` on the seal shape,
// no drop shadow — just a flat, soft badge. One self-contained SVG so
// every place that shows a verified mark (summary/experience/skills/
// gallery/etc.) renders the exact same shape at whatever size its
// container gives it.
const VERIFIED_SEAL_ICON = '<svg class="pf-verify-seal" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M 50.00,4.00 C 54.02,4.00 57.55,11.44 62.05,12.91 C 66.56,14.37 73.79,10.42 77.04,12.79 C 80.29,15.15 78.77,23.24 81.55,27.08 C 84.34,30.91 92.51,31.96 93.75,35.79 C 94.99,39.61 89.00,45.26 89.00,50.00 C 89.00,54.74 94.99,60.39 93.75,64.21 C 92.51,68.04 84.34,69.09 81.55,72.92 C 78.77,76.76 80.29,84.85 77.04,87.21 C 73.79,89.58 66.56,85.63 62.05,87.09 C 57.55,88.56 54.02,96.00 50.00,96.00 C 45.98,96.00 42.45,88.56 37.95,87.09 C 33.44,85.63 26.21,89.58 22.96,87.21 C 19.71,84.85 21.23,76.76 18.45,72.92 C 15.66,69.09 7.49,68.04 6.25,64.21 C 5.01,60.39 11.00,54.74 11.00,50.00 C 11.00,45.26 5.01,39.61 6.25,35.79 C 7.49,31.96 15.66,30.91 18.45,27.08 C 21.23,23.24 19.71,15.15 22.96,12.79 C 26.21,10.42 33.44,14.37 37.95,12.91 C 42.45,11.44 45.98,4.00 50.00,4.00 Z" fill="currentColor"/><path d="M30 53 L44 67 L72 35" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function verifyControlHTML(block) {
  const v = block.data.verify || { type: 'none' };
  if (v.type !== 'none') {
    const labelHTML = v.label ? `<span class="pf-verify-label">${esc(v.label)}</span>` : '';
    return `
      <button class="pf-verify-badge" data-action="view-verify" data-block="${block.id}" type="button"><span class="pf-verify-check">${VERIFIED_SEAL_ICON}</span>Verified${labelHTML}</button>
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

// Same idea, for the per-block Style panel (font size/family,
// bold/italic/underline, paragraph spacing, per-side margins).
// Resume-only: templates already carry the portfolio's styling.
const styleOpenBlocks = new Set();

function toggleBlockStyleOpen(blockId) {
  if (styleOpenBlocks.has(blockId)) styleOpenBlocks.delete(blockId);
  else styleOpenBlocks.add(blockId);
  renderSidebarList(Store.active().blocks);
}

function blockStyleFieldsHTML(block) {
  const s = block.style || emptyBlockStyle();
  const fontOpts = FONT_OPTIONS.map(f => `<option value="${f.id}" ${s.fontFamily === f.id ? 'selected' : ''}>${esc(f.label)}</option>`).join('');
  return `
    <div class="sd-style-body">
      <div class="sd-style-row">
        <label class="sd-style-label">Font size
          <input type="number" class="sd-style-num" data-style-key="fontSize" data-block="${block.id}" min="6" max="72" step="1" placeholder="Default" value="${s.fontSize ?? ''}" /> px
        </label>
        <label class="sd-style-label">Font style
          <select class="sd-style-select" data-style-key="fontFamily" data-block="${block.id}">
            <option value="" ${!s.fontFamily ? 'selected' : ''}>Template default</option>
            ${fontOpts}
          </select>
        </label>
      </div>
      <div class="sd-style-row">
        <button type="button" class="sd-style-toggle-btn ${s.bold ? 'active' : ''}" data-action="style-toggle" data-style-toggle="bold" data-block="${block.id}" title="Bold"><strong>B</strong></button>
        <button type="button" class="sd-style-toggle-btn ${s.italic ? 'active' : ''}" data-action="style-toggle" data-style-toggle="italic" data-block="${block.id}" title="Italic"><em>I</em></button>
        <button type="button" class="sd-style-toggle-btn ${s.underline ? 'active' : ''}" data-action="style-toggle" data-style-toggle="underline" data-block="${block.id}" title="Underline"><u>U</u></button>
        <label class="sd-style-label sd-style-label-inline">Paragraph spacing
          <input type="number" class="sd-style-num" data-style-key="paraSpacing" data-block="${block.id}" min="0" max="6" step="0.05" placeholder="Default" value="${s.paraSpacing ?? ''}" /> rem
        </label>
      </div>
      <div class="sd-style-row sd-style-margins">
        <span class="sd-style-margins-label">Margin (rem, from 0)</span>
        <label class="sd-style-label sd-style-margin-in">Top <input type="number" class="sd-style-num" data-style-key="marginTop" data-block="${block.id}" min="0" max="10" step="0.05" placeholder="0" value="${s.marginTop ?? ''}" /></label>
        <label class="sd-style-label sd-style-margin-in">Right <input type="number" class="sd-style-num" data-style-key="marginRight" data-block="${block.id}" min="0" max="10" step="0.05" placeholder="0" value="${s.marginRight ?? ''}" /></label>
        <label class="sd-style-label sd-style-margin-in">Bottom <input type="number" class="sd-style-num" data-style-key="marginBottom" data-block="${block.id}" min="0" max="10" step="0.05" placeholder="0" value="${s.marginBottom ?? ''}" /></label>
        <label class="sd-style-label sd-style-margin-in">Left <input type="number" class="sd-style-num" data-style-key="marginLeft" data-block="${block.id}" min="0" max="10" step="0.05" placeholder="0" value="${s.marginLeft ?? ''}" /></label>
      </div>
      <button type="button" class="sd-style-reset-btn" data-action="reset-block-style" data-id="${block.id}">Reset to template default</button>
    </div>`;
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
    case 'skills': return (d.items || []).map(skillName).join(', ') || 'Skills';
    case 'certifications': return (d.items || []).map(i => i.name).filter(Boolean).join(', ') || 'Certifications';
    case 'languages': return (d.items || []).map(i => i.name).filter(Boolean).join(', ') || 'Languages';
    case 'gallery': return (d.photos || []).length ? `${d.photos.length} photo${d.photos.length === 1 ? '' : 's'}` : 'Photo gallery (empty)';
    case 'video': return d.url || 'Embedded video (empty)';
    case 'links': return (d.items || []).map(i => i.label).filter(Boolean).join(', ') || 'Embedded links';
    case 'spacer': return d.size === 'sm' ? 'Small gap' : d.size === 'lg' ? 'Large gap' : 'Medium gap';
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
      return field('Text', ceField(d.text, 'text', block.id, { cls: 'ce-block' }))
        + field('Verification', `<div class="pf-verify">${verifyControlHTML(block)}</div>`);
    case 'custom':
      return field('Title', ceField(d.title, 'title', block.id))
        + field('Text', ceField(d.text, 'text', block.id, { cls: 'ce-block' }))
        + field('Verification', `<div class="pf-verify">${verifyControlHTML(block)}</div>`);
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
        + field('GPA', ceField(d.gpa, 'gpa', block.id))
        + field('Verification', `<div class="pf-verify">${verifyControlHTML(block)}</div>`);
    case 'projects':
      return field('Name', ceField(d.name, 'name', block.id))
        + field('Dates', ceField(d.dates, 'dates', block.id))
        + field('Description', ceField(d.description, 'description', block.id))
        + field('Bullets', renderBulletList(d.bullets, block.id, 'bullets'))
        + field('Verification', `<div class="pf-verify">${verifyControlHTML(block)}</div>`);
    case 'skills':
      // Skills verification is per-entry (the "+ proof" button baked
      // into each tag by renderSkillTags) — same model as
      // certifications/languages below. No block-level "Verification"
      // field here; one used to be added by mistake, which produced a
      // confusing second, whole-section "+ Add proof" control that
      // didn't do anything useful once every tag already had its own.
      return field('Skills', renderSkillTags(d.items, block.id, 'items'));
    case 'certifications':
      return field('Certifications', renderEntryList(d.items, block.id, 'items', [
        { key: 'name', cls: 'ce-strong', label: 'Name' }, { key: 'issuer', cls: 'ce-muted', label: 'Issuer' }, { key: 'date', cls: 'ce-muted', label: 'Date' }
      ]));
    case 'languages':
      return field('Languages', renderEntryList(d.items, block.id, 'items', [
        { key: 'name', cls: 'ce-strong', label: 'Language' }, { key: 'level', cls: 'ce-muted', label: 'Level' }
      ]));
    case 'gallery': {
      const showVerify = Store.state.viewMode === 'portfolio';
      const thumbs = (d.photos || []).map((p, i) => `
        <div class="sd-gallery-thumb">
          <img src="${esc(p.src)}" alt="" />
          ${showVerify ? `<button class="sd-gallery-thumb-verify ${p.verify && p.verify.type !== 'none' ? 'is-verified' : ''}" data-action="edit-photo-verify" data-block="${block.id}" data-photo-index="${i}" type="button" title="${p.verify && p.verify.type !== 'none' ? 'Edit proof for this photo' : 'Add proof for this photo'}">${p.verify && p.verify.type !== 'none' ? '✓' : '+ proof'}</button>` : ''}
          <button class="sd-gallery-thumb-remove" data-action="remove-item" data-block="${block.id}" data-field="photos" data-index="${i}" type="button" title="Remove photo">✕</button>
        </div>`).join('');
      return field('Photos', `
        <div class="sd-gallery-grid">${thumbs}</div>
        <label class="add-item-btn sd-gallery-add">
          + Add photo
          <input type="file" accept="image/*" class="sd-gallery-file-input" data-block="${block.id}" hidden />
        </label>`)
        + (showVerify ? `<p class="sd-field-hint">Click "+ proof" on a photo to attach verification (certificate, badge, ID, or link) to that specific photo.</p>` : '');
    }
    case 'video':
      return field('Video URL (YouTube, Vimeo, Loom)', ceField(d.url, 'url', block.id))
        + field('Caption (optional)', ceField(d.caption, 'caption', block.id));
    case 'links':
      return field('Links', renderEntryList(d.items, block.id, 'items', [
        { key: 'label', cls: 'ce-strong', label: 'Label' }, { key: 'url', cls: 'ce-muted', label: 'URL' }
      ]));
    case 'spacer': {
      const size = ['sm', 'md', 'lg'].includes(d.size) ? d.size : 'md';
      const sizeLabel = size === 'sm' ? 'Small' : size === 'lg' ? 'Large' : 'Medium';
      return field('Size', `<button class="sd-spacer-size-btn" data-action="cycle-spacer-size" data-block="${block.id}" data-size="${size}" type="button">${sizeLabel} (click to change)</button>`);
    }
    default:
      return '';
  }
}

// View-only verify badge for the canvas preview (no edit/add-proof
// affordance there anymore — that lives in the sidebar accordion).
function canvasVerifyBadge(block, index) {
  const v = index != null ? ((block.data.items && block.data.items[index] && block.data.items[index].verify) || { type: 'none' }) : (block.data.verify || { type: 'none' });
  if (v.type === 'none') return '';
  const labelHTML = v.label ? `<span class="pf-verify-label">${esc(v.label)}</span>` : '';
  const idxAttr = index != null ? ` data-photo-index="${index}"` : '';
  return `<div class="pf-verify"><button class="pf-verify-badge" data-action="view-verify" data-block="${block.id}"${idxAttr} type="button"><span class="pf-verify-check">${VERIFIED_SEAL_ICON}</span>Verified${labelHTML}</button></div>`;
}

// Compact inline version for entry-list rows (certifications, languages)
// where a full-size badge would overwhelm a single line.
function canvasEntryVerifyBadge(block, index) {
  const v = (block.data.items && block.data.items[index] && block.data.items[index].verify) || { type: 'none' };
  if (v.type === 'none') return '';
  return `<button class="pf-verify-badge pf-verify-badge-sm" data-action="view-verify" data-block="${block.id}" data-photo-index="${index}" type="button" title="View proof">${VERIFIED_SEAL_ICON}</button>`;
}

// Small "✓" pin shown in the corner of a gallery photo that has its
// own proof attached. The photo tile itself always just zooms the
// image on click. Both link-type and photo-type proof make the
// checkmark badge its own clickable control — for link-type it opens
// the verification URL in a new tab; for photo-type it opens the
// actual proof photo (via the same view-proof modal used elsewhere)
// instead of just zooming the gallery photo itself. Clicking anywhere
// else on the tile (including the rest of the badge's surrounding
// photo) still zooms the gallery photo like normal.
function canvasPhotoVerifyBadge(photo, blockId, index) {
  const v = photo.verify || { type: 'none' };
  if (v.type === 'none') return '';
  if (v.type === 'link' && v.link) {
    const safeHref = /^https?:\/\//i.test(v.link) ? v.link : `https://${v.link}`;
    return `<button class="pf-photo-verify-badge is-link" data-action="open-verify-link" data-href="${esc(safeHref)}" type="button" title="Open verification link">${VERIFIED_SEAL_ICON}</button>`;
  }
  if (v.type === 'photo' && v.photo) {
    return `<button class="pf-photo-verify-badge is-link" data-action="view-verify" data-block="${blockId}" data-photo-index="${index}" type="button" title="View proof photo">${VERIFIED_SEAL_ICON}</button>`;
  }
  return `<span class="pf-photo-verify-badge" title="Verified">${VERIFIED_SEAL_ICON}</span>`;
}

// Turns a block.style object into a CSS style string applied to the
// block's own wrapper div. Only properties the person actually set are
// included, so an untouched block renders exactly as the template
// defines it — this never overrides template CSS unless asked to.
function blockStyleToCSS(style) {
  if (!style) return '';
  const s = style;
  const parts = [];
  if (s.fontSize) parts.push(`font-size:${Number(s.fontSize)}px`);
  if (s.fontFamily && FONT_STACKS[s.fontFamily]) parts.push(`font-family:${FONT_STACKS[s.fontFamily]}`);
  if (s.bold) parts.push('font-weight:700');
  if (s.italic) parts.push('font-style:italic');
  if (s.underline) parts.push('text-decoration:underline');
  if (s.paraSpacing !== null && s.paraSpacing !== undefined && s.paraSpacing !== '') parts.push(`--blk-para-spacing:${Number(s.paraSpacing)}rem`);
  if (s.marginTop !== null && s.marginTop !== undefined && s.marginTop !== '') parts.push(`margin-top:${Number(s.marginTop)}rem`);
  if (s.marginRight !== null && s.marginRight !== undefined && s.marginRight !== '') parts.push(`margin-right:${Number(s.marginRight)}rem`);
  if (s.marginBottom !== null && s.marginBottom !== undefined && s.marginBottom !== '') parts.push(`margin-bottom:${Number(s.marginBottom)}rem`);
  if (s.marginLeft !== null && s.marginLeft !== undefined && s.marginLeft !== '') parts.push(`margin-left:${Number(s.marginLeft)}rem`);
  return parts.join(';');
}

function createResumeBlock(block) {
  const wrapper = document.createElement('div');
  wrapper.className = `resume-block block-${block.type}`;
  wrapper.dataset.id = block.id;
  if (Store.state.selectedBlockId === block.id) wrapper.classList.add('selected');
  if (block.hidden) wrapper.classList.add('section-hidden-preview');
  const styleCSS = blockStyleToCSS(block.style);
  if (styleCSS) wrapper.setAttribute('style', styleCSS);
  wrapper.innerHTML = renderStaticResumeBlock(block);
  return wrapper;
}


// ── 3b. PORTFOLIO SITE block renderer (cards + verification) ─────
function createPortfolioBlock(block) {
  const wrapper = document.createElement('div');
  wrapper.dataset.id = block.id;
  wrapper.dataset.align = block.align || 'left';
  wrapper.dataset.contentAlign = block.contentAlign || 'left';
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
      innerHTML = esc(block.data.text) + canvasVerifyBadge(block);
      break;
    case 'custom':
      baseClass = 'pf-card';
      innerHTML = `
        <h3 class="pf-exp-company">${esc(block.data.title)}</h3>
        <p>${esc(block.data.text)}</p>
        ${canvasVerifyBadge(block)}`;
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
        <div class="pf-edu-gpa">${esc(block.data.gpa)}</div>
        ${canvasVerifyBadge(block)}`;
      break;
    case 'projects':
      baseClass = 'pf-card';
      innerHTML = `
        <div class="pf-exp-top-row">
          <span class="pf-exp-company">${esc(block.data.name)}</span>
          <span class="pf-exp-dates">${esc(block.data.dates)}</span>
        </div>
        <div class="pf-exp-sub-row"><span>${esc(block.data.description)}</span></div>
        <ul class="rb-bullets">${(block.data.bullets || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul>
        ${canvasVerifyBadge(block)}`;
      break;
    case 'skills':
      baseClass = 'pf-card';
      innerHTML = `<div class="rb-skills-wrap">${(block.data.items || []).map((s, i) => `<span class="rb-skill-tag">${esc(skillName(s))}${canvasEntryVerifyBadge(block, i)}</span>`).join('')}</div>
        ${canvasVerifyBadge(block)}`;
      break;
    case 'certifications':
      baseClass = 'pf-card';
      innerHTML = `<div class="rb-entry-list">${(block.data.items || []).map((it, i) => `<div class="rb-entry-row"><div class="rb-entry-main"><span class="ce-strong">${esc(it.name || '')}</span><span class="ce-muted">${esc(it.issuer || '')}</span></div><div class="rb-entry-right"><span class="ce-muted rb-entry-date">${esc(it.date || '')}</span>${canvasEntryVerifyBadge(block, i)}</div></div>`).join('')}</div>`;
      break;
    case 'languages':
      baseClass = 'pf-card';
      innerHTML = `<div class="rb-entry-list">${(block.data.items || []).map((it, i) => `<div class="rb-entry-row"><div class="rb-entry-main"><span class="ce-strong">${esc(it.name || '')}</span></div><div class="rb-entry-right"><span class="ce-muted rb-entry-date">${esc(it.level || '')}</span>${canvasEntryVerifyBadge(block, i)}</div></div>`).join('')}</div>`;
      break;
    case 'gallery': {
      baseClass = 'pf-card pf-gallery-card';
      innerHTML = (block.data.photos || []).length
        ? `<div class="pf-gallery-grid">${(block.data.photos || []).map((p, i) => {
            const pv = p.verify || { type: 'none' };
            const badge = canvasPhotoVerifyBadge(p, block.id, i);
            const hasProof = pv.type === 'photo' && !!pv.photo;
            const captionAttr = hasProof && pv.label ? ` data-caption="${esc(pv.label)}"` : '';
            return `<div class="pf-gallery-item" data-action="zoom-photo" data-src="${esc(p.src)}" data-verified="${hasProof ? '1' : '0'}"${captionAttr} title="Click to zoom">${badge}<img src="${esc(p.src)}" alt="" /></div>`;
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
    case 'spacer':
      baseClass = 'pf-spacer pf-spacer-' + (['sm', 'md', 'lg'].includes(block.data.size) ? block.data.size : 'md');
      innerHTML = `<span class="pf-spacer-label">Blank space</span>`;
      break;
    default:
      break;
  }
  if (baseClass) wrapper.classList.add(...baseClass.split(' '));
  if (block.hardShadow === false) wrapper.classList.add('pf-no-shadow');
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
    el.portfolioSite.classList.remove('pf-header-collapsed');
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
    const dotsStyle = Store.active().design.dotsStyle || 'dot';
    const classes = ['pf-dot'];
    if (i === keepIndex) classes.push('active');
    if (dotsStyle === 'progress' && i <= keepIndex) classes.push('passed');
    dot.className = classes.join(' ');
    dot.dataset.pfSlide = String(i);
    dot.setAttribute('aria-label', `Section ${i + 1}`);
    el.pfSlideDots.appendChild(dot);
    return dot;
  });

  pfCurrentSlide = keepIndex;
  pfUpdateHeaderCollapse(keepIndex);
  // Jump (no smooth animation — this is a re-render, not a user nav
  // action) back to whichever slide was active before the re-render,
  // once the new layout has settled.
  requestAnimationFrame(() => {
    pfSlideEls[pfCurrentSlide]?.scrollIntoView({ behavior: 'auto', block: axis === 'y' ? 'start' : 'nearest', inline: axis === 'x' ? 'start' : 'nearest' });
  });

  initPortfolioHorizontalNav();
}

function pfSetActiveDot(i) {
  const dotsStyle = Store.active().design.dotsStyle || 'dot';
  pfDotEls.forEach((d, di) => {
    d.classList.toggle('active', di === i);
    d.classList.toggle('passed', dotsStyle === 'progress' && di <= i);
  });
  el.pfSlideArrowTop.toggleAttribute('disabled', i <= 0);
  el.pfSlideArrowBottom.toggleAttribute('disabled', i >= pfSlideEls.length - 1);
  pfUpdateHeaderCollapse(i);
}

// Pinned header in horizontal/vertical mode: visible on slide 0,
// collapsed away (see .pf-header-collapsed in portfolio.css) on every
// slide after that, so those slides expand up to where the header
// used to be. No-op (class stays off) for "scroll"-style headers,
// which have nothing to collapse.
function pfUpdateHeaderCollapse(i) {
  const headerStyle = el.portfolioSite.getAttribute('data-header-style');
  el.portfolioSite.classList.toggle('pf-header-collapsed', headerStyle === 'pinned' && i > 0);
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
    el.resumePaper.classList.toggle('no-side-content', el.sideTrack.children.length === 0);
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
      openPhotoZoomModal(actionBtn.dataset.src, actionBtn.dataset.verified === '1', actionBtn.dataset.caption || '');
    } else if (action === 'open-verify-link') {
      if (actionBtn.dataset.href) window.open(actionBtn.dataset.href, '_blank', 'noopener,noreferrer');
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
function openModal(html, onOpen, boxClass) {
  el.modalContent.innerHTML = html;
  el.modalOverlay.classList.remove('hidden');
  if (el.modalBox) el.modalBox.className = 'modal-box' + (boxClass ? ` ${boxClass}` : '');
  document.addEventListener('keydown', handleModalEscape);
  if (typeof onOpen === 'function') onOpen(el.modalContent);
}

function closeModal() {
  el.modalOverlay.classList.add('hidden');
  el.modalContent.innerHTML = '';
  if (el.modalBox) el.modalBox.className = 'modal-box';
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
// The larger pop-up view of a gallery photo. If that photo has a
// photo-type proof attached, a "✓ Verified" footer (plus its caption,
// if any) is shown underneath the enlarged image.
function openPhotoZoomModal(src, verified, caption) {
  if (!src) return;
  const footer = verified
    ? `<div class="pf-zoom-verified"><span class="pf-zoom-verified-check">Proof</span>${caption ? `<p class="pf-zoom-caption">${esc(caption)}</p>` : ''}</div>`
    : '';
  openModal(`<div class="verify-modal-body pf-zoom-modal-body"><img src="${esc(src)}" alt="" class="pf-zoom-img" />${footer}</div>`, null, 'modal-box--zoom');
}

// ── 4a. Verification: view proof ──────────────────────────────
function openVerifyViewModal(blockId, index) {
  const block = Store.active().blocks.find(b => b.id === blockId);
  if (!block) return;
  const v = (index != null && block.data.photos && block.data.photos[index])
    ? (block.data.photos[index].verify || { type: 'none' })
    : (index != null && block.data.items && block.data.items[index])
      ? (block.data.items[index].verify || { type: 'none' })
      : (block.data.verify || { type: 'none' });

  if (v.type === 'link' && v.link) {
    const safeHref = /^https?:\/\//i.test(v.link) ? v.link : `https://${v.link}`;
    window.open(safeHref, '_blank', 'noopener,noreferrer');
    return;
  }

  let body;
  if (v.type === 'photo' && v.photo) {
    body = `<div class="verify-modal-body">
      <img src="${v.photo}" alt="Verification proof" class="verify-modal-img" />
      ${v.label ? `<p class="verify-modal-caption">${esc(v.label)}</p>` : ''}
    </div>`;
  } else {
    body = `<p class="verify-empty">No proof attached yet.</p>`;
  }

  openModal(`<h3 class="modal-title-proof" id="modalTitle">Proof</h3>${body}`);
}

// ── 4b. Verification: add / edit / remove proof ────────────────
function openVerifyEditModal(blockId, index) {
  const block = Store.active().blocks.find(b => b.id === blockId);
  if (!block) return;
  const isPhotoScoped = index != null && block.data.photos && block.data.photos[index];
  const isItemScoped = !isPhotoScoped && index != null && block.data.items && block.data.items[index];
  const isScoped = isPhotoScoped || isItemScoped;
  const v = isPhotoScoped ? (block.data.photos[index].verify || { type: 'none', photo: null, link: '', label: '' })
    : isItemScoped ? (block.data.items[index].verify || { type: 'none', photo: null, link: '', label: '' })
    : (block.data.verify || { type: 'none', photo: null, link: '', label: '' });

  let currentType = v.type === 'none' ? 'photo' : v.type;
  let pendingPhoto = v.photo || null;

  const html = `
    <h3 class="modal-title" id="modalTitle">${isPhotoScoped ? 'Verify this photo' : isItemScoped ? 'Verify this entry' : 'Verify this section'}</h3>
    <p class="modal-sub">${isPhotoScoped ? 'Attach a photo (certificate, badge, ID) or a link (LinkedIn post, reference, article) so visitors can confirm this specific photo is real.' : isItemScoped ? 'Attach a photo or a link so visitors can confirm this entry is real.' : 'Attach a photo (certificate, badge, ID) or a link (LinkedIn post, reference, article) so visitors can confirm this really happened.'}</p>
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
      readAndCompressImage(file)
        .then((dataUrl) => {
          pendingPhoto = dataUrl;
          root.querySelector('#verifyPhotoPreview').style.backgroundImage = `url(${pendingPhoto})`;
        })
        .catch(() => {});
    });

    const removeBtn = root.querySelector('#verifyRemoveBtn');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        Store.clearVerify(blockId, index);
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

      Store.updateVerify(blockId, 'type', currentType, index);
      if (currentType === 'photo') Store.updateVerify(blockId, 'photo', pendingPhoto, index);
      else Store.updateVerify(blockId, 'link', link, index);
      Store.updateVerify(blockId, 'label', label, index);
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
// Progress is NOT saved locally unless you're signed in with Google —
// that's what the sign-in popup on load is for. Once signed in,
// autosave writes to this browser's localStorage AND syncs the same
// state to the server, keyed by the Google account (see worker's
// /api/draft/save + /api/draft/load) — that's what makes edits
// follow you to any device. Signed-out visitors can still edit in
// this session, but nothing persists past a refresh until they sign
// in. Publishing (a separate, explicit action) is unaffected — this
// only ever writes to the draft: key, never to a live site.
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
// typing doesn't fire a request per keystroke. Signed-out visitors
// get neither — there is no local saving unless you're signed in, so
// this is a no-op until then (see the sign-in popup shown on load).
function scheduleAutosave() {
  if (!getSavedGoogleAccount()) return;
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

// Google ID tokens expire (usually ~1hr) — without this check, a long
// editing session would still show "signed in" locally while the
// Worker silently rejects the now-stale token on publish/save. Treat
// an expired token as no account at all, and clear it so sign-in is
// prompted again.
function getSavedGoogleAccount() {
  let account;
  try { account = JSON.parse(localStorage.getItem(GOOGLE_ACCOUNT_KEY) || 'null'); }
  catch (err) { return null; }
  if (!account || !account.credential) return null;
  try {
    const payload = decodeGoogleCredential(account.credential);
    if (!payload.exp || payload.exp * 1000 <= Date.now()) {
      localStorage.removeItem(GOOGLE_ACCOUNT_KEY);
      return null;
    }
  } catch (err) {
    localStorage.removeItem(GOOGLE_ACCOUNT_KEY);
    return null;
  }
  return account;
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
  // If a username is cached locally but it belongs to a *different*
  // email than the one signing in now, it's stale — drop it so this
  // account doesn't briefly show someone else's username.proves.work
  // before loadServerDraft() below fills in this account's real state.
  const cachedOwner = localStorage.getItem(USERNAME_OWNER_EMAIL_KEY);
  if (cachedOwner && cachedOwner !== payload.email) {
    clearLocalUsernameState();
  }
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

// The Google Identity Services <script> tag is async/defer, so it can
// still be mid-flight when this code runs — especially right after a
// fresh navigation (e.g. clicking "Open Editor" from index.html),
// where it's competing with every other asset on the page for the
// very first load, with no cache to lean on. Checking window.google
// exactly once and giving up immediately if it's not there yet was
// reporting "script hasn't loaded / blocked" for a script that was
// simply still downloading. This polls for a short window before
// truly giving up, so a real block/offline case still gets reported
// (just a beat later), but an ordinary slow first load doesn't.
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

function renderGoogleSignInButton(container) {
  container.innerHTML = `<p class="username-status">Loading Google sign-in…</p>`;
  waitForGoogleIdentity((ready) => {
    // Modal may have been closed/re-rendered while we were waiting —
    // don't write into a detached node.
    if (!container.isConnected) return;
    if (!ready) {
      container.innerHTML = `<p class="username-status warn">Google sign-in script hasn't loaded (offline, or blocked) — you can still publish anonymously below.</p>`;
      return;
    }
    window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential });
    window.google.accounts.id.renderButton(container, { theme: 'outline', size: 'medium', text: 'signin_with' });
  });
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
      // Also drop the cached username on sign-out — otherwise it sits
      // in localStorage with no account attached and can get picked up
      // by whichever Google account signs in next on this browser.
      clearLocalUsernameState();
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

// BUG FIX: PUBLISH_USERNAME_KEY used to be a single global localStorage
// value with no link to *which* Google account it belonged to. Server
// side, a username is correctly scoped to the signed-in email
// (draft:<email>, ownerEmail on publish) — but this front-end cache
// wasn't, so signing out and signing back in with a different Google
// account on the same browser kept showing the previous account's
// username.proves.work in the nav bar / publish field. It wasn't a real
// ownership bypass (the Worker still checks the credential on every
// write), just a stale, mismatched local display. Fix: remember which
// email the cached username belongs to, and wipe the cache whenever the
// signed-in account differs from that owner (see handleGoogleCredential
// and the sign-out handler below).
const USERNAME_OWNER_EMAIL_KEY = 'proveswork_username_owner_email';

function clearLocalUsernameState() {
  localStorage.removeItem(PUBLISH_USERNAME_KEY);
  localStorage.removeItem(USERNAME_CHANGE_COUNT_KEY);
  localStorage.removeItem(USERNAME_OWNER_EMAIL_KEY);
}

function getSavedUsername() {
  return localStorage.getItem(PUBLISH_USERNAME_KEY) || '';
}

function saveUsername(u) {
  localStorage.setItem(PUBLISH_USERNAME_KEY, u);
  const account = getSavedGoogleAccount();
  if (account) localStorage.setItem(USERNAME_OWNER_EMAIL_KEY, account.email);
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

// Warns the owner, inside a dismissible popup, when their paid window
// is closing in on running out — so "back to Free tier, offline until
// renewed" doesn't happen as a surprise. Fires once the countdown is
// 14 days or fewer (and hasn't already hit zero — that state already
// shows via the toolbar badge/expired page instead of a popup) and at
// most once per address per calendar day, so it doesn't nag on every
// visit.
const RENEWAL_REMINDER_KEY_PREFIX = 'proveswork_renewal_reminder_shown';
function maybeShowRenewalReminder(data, username) {
  if (!data || !data.paid || data.status !== 'live' || !data.paidUntil || !username) return;
  const daysLeft = Math.ceil((new Date(data.paidUntil).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (daysLeft > 14 || daysLeft <= 0) return;
  const dismissKey = `${RENEWAL_REMINDER_KEY_PREFIX}:${username}:${new Date().toISOString().slice(0, 10)}`;
  if (localStorage.getItem(dismissKey)) return;
  localStorage.setItem(dismissKey, '1');
  openModal(`
    <h3 class="modal-title">Your plan ends soon</h3>
    <p class="modal-sub"><strong>${esc(username)}.${PUBLISH_APEX}</strong> stays live for ${daysLeft} more day${daysLeft === 1 ? '' : 's'}. After that it drops back to the Free tier and comes down from ${esc(username)}.${PUBLISH_APEX} until you republish and renew (₱${PUBLISH_FEE.amount} for another ${PUBLISH_FEE.validityMonths} months).</p>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" id="renewalLaterBtn" type="button">Remind me later</button>
      <button class="btn btn-secondary btn-sm" id="renewalNowBtn" type="button">Renew now</button>
    </div>
  `, (root) => {
    root.querySelector('#renewalLaterBtn').addEventListener('click', closeModal);
    root.querySelector('#renewalNowBtn').addEventListener('click', () => {
      closeModal();
      openPublishModal();
    });
  });
}


async function refreshSiteStatusBadge() {
  if (!el.siteStatusBadge) return;
  const username = getSavedUsername();
  if (!username) {
    el.siteStatusBadge.className = 'site-status-badge status-draft';
    el.siteStatusBadge.textContent = SITE_STATUS_LABELS.draft;
    el.siteStatusBadge.classList.remove('hidden');
    refreshNavUsername();
    refreshSaveOrPreviewButton();
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
    maybeShowRenewalReminder(data, username);
  } catch (err) {
    // No backend reachable from here — don't claim a status we can't
    // verify.
    lastSiteStatusData = null;
    el.siteStatusBadge.classList.add('hidden');
  }
  refreshNavUsername();
  refreshSaveOrPreviewButton();
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
//
// When the address is genuinely live — signed in, published, admin-
// approved, and paid (not just "status: live", which an unpaid/lapsed
// record can still carry) — this becomes a real link that opens
// username.proves.work in a new tab. Otherwise it's inert text: no
// href, so there's nothing to click.
function refreshNavUsername() {
  if (!el.navUsername) return;
  const saved = getSavedUsername();
  const signedIn = !!getSavedGoogleAccount();
  const eligible = !!(signedIn && saved && lastSiteStatusData &&
    lastSiteStatusData.status === 'live' &&
    lastSiteStatusData.paid &&
    (!lastSiteStatusData.paidUntil || new Date(lastSiteStatusData.paidUntil).getTime() > Date.now()));

  if (eligible) {
    el.navUsername.textContent = saved;
    el.navUsername.classList.remove('is-unclaimed');
    el.navUsername.classList.add('is-claimed');
    el.navUsername.title = `${saved}.${PUBLISH_APEX} — live`;
    el.navUsername.href = `https://${saved}.${PUBLISH_APEX}`;
    el.navUsername.target = '_blank';
    el.navUsername.rel = 'noopener noreferrer';
  } else {
    el.navUsername.textContent = 'a-sign-up';
    el.navUsername.classList.remove('is-claimed');
    el.navUsername.classList.add('is-unclaimed');
    el.navUsername.title = 'Sign in with Google and publish to claim a real username — subject to admin approval';
    el.navUsername.removeAttribute('href');
    el.navUsername.removeAttribute('target');
    el.navUsername.removeAttribute('rel');
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

// Horizontal/vertical-slide mode: dot nav, arrow keys, and
// wheel-to-slide. Shared verbatim between the hosted PUBLISHED_PAGE_SCRIPT
// and the offline ZIP_PAGE_SCRIPT below since it has no dependency on
// proof, the lock, or any backend.
const HORIZONTAL_SLIDE_SCRIPT = `
(function () {
  var root = document.getElementById('portfolioSite');
  var anim = root && root.getAttribute('data-section-anim');
  if (!root || (anim !== 'horizontal' && anim !== 'vertical')) return;

  var hero = root.querySelector('.pf-hero');
  function syncHeaderHeight() {
    if (!hero) return;
    root.style.setProperty('--pf-header-real-h', hero.getBoundingClientRect().height + 'px');
  }
  syncHeaderHeight();
  if (hero && 'ResizeObserver' in window) {
    new ResizeObserver(syncHeaderHeight).observe(hero);
  } else {
    window.addEventListener('resize', syncHeaderHeight);
  }

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
  var dotsStyle = root.getAttribute('data-dots-style') || 'dot';
  var headerStyle = root.getAttribute('data-header-style');
  function setDots(i) {
    dots.forEach(function (d, di) {
      d.classList.toggle('active', di === i);
      d.classList.toggle('passed', dotsStyle === 'progress' && di <= i);
    });
    root.classList.toggle('pf-header-collapsed', headerStyle === 'pinned' && i > 0);
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

// A tiny, self-contained script embedded in every published page so
// verification badges stay clickable there too — without shipping the
// whole editor. No dependency on Store/editor.js.
const PUBLISHED_PAGE_SCRIPT = `
// ── Verifiable Proof: fetched at runtime, never embedded in this page's
// source. window.__PW_PROOF__ is populated either immediately on load
// (when no Recruiter Password Lock is active on this site) or after a
// correct guess in the unlock modal below. Until it's populated, proof
// buttons resolve to nothing rather than showing stale/empty content.
window.__PW_PROOF__ = null;
function pwFetchProof(guess) {
  var scope = (document.getElementById('portfolioSite') || {}).getAttribute
    ? document.getElementById('portfolioSite').getAttribute('data-lock-scope')
    : '';
  var payload = { username: scope || '' };
  if (guess) payload.guess = guess;
  return fetch('https://${PUBLISH_APEX}/api/site/proof', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(function (res) { return res.json().catch(function () { return { ok: false }; }); })
    .catch(function () { return { ok: false, error: 'network' }; });
}
if (!window.__PW_LOCK_ACTIVE__) {
  // No lock on this site (or it lapsed) — proof was always meant to be
  // public here, so fetch it right away rather than waiting on a guess.
  pwFetchProof().then(function (result) {
    if (result && result.ok) window.__PW_PROOF__ = result.proof || {};
  });
}
document.addEventListener('click', function (e) {
  var linkBadge = e.target.closest('[data-action="open-verify-link"]');
  if (linkBadge) {
    var entry = window.__PW_PROOF__ && window.__PW_PROOF__[linkBadge.getAttribute('data-verify-id')];
    if (entry && entry.link) window.open(entry.link, '_blank', 'noopener,noreferrer');
    return;
  }
  var verifyBtn = e.target.closest('[data-verify-type]');
  if (verifyBtn) {
    var type = verifyBtn.getAttribute('data-verify-type');
    var vEntry = window.__PW_PROOF__ && window.__PW_PROOF__[verifyBtn.getAttribute('data-verify-id')];
    if (type === 'link') {
      if (vEntry && vEntry.link) window.open(vEntry.link, '_blank', 'noopener,noreferrer');
      return;
    }
    var overlay = document.getElementById('modalOverlay');
    var content = document.getElementById('modalContent');
    var box = document.getElementById('modalBox');
    var html = '';
    if (type === 'photo' && vEntry && vEntry.photo) {
      var label = vEntry.label || '';
      html = '<h3 class="modal-title-proof">Proof</h3><div class="verify-modal-body"><img src="' + vEntry.photo + '" class="verify-modal-img" alt="Verification proof"/>' + (label ? '<p class="verify-modal-caption">' + label + '</p>' : '') + '</div>';
    } else {
      // Proof not loaded yet (e.g. still locked) — nothing to show.
      return;
    }
    content.innerHTML = html;
    if (box) box.className = 'modal-box';
    overlay.classList.remove('hidden');
    return;
  }
  var zoomEl = e.target.closest('[data-action="zoom-photo"]');
  if (zoomEl) {
    var overlay = document.getElementById('modalOverlay');
    var content = document.getElementById('modalContent');
    var box = document.getElementById('modalBox');
    var src = zoomEl.getAttribute('data-src');
    var verified = zoomEl.getAttribute('data-verified') === '1';
    var captionId = zoomEl.getAttribute('data-caption-id');
    var captionEntry = captionId && window.__PW_PROOF__ && window.__PW_PROOF__[captionId];
    var caption = captionEntry ? (captionEntry.label || '') : '';
    var footer = verified
      ? '<div class="pf-zoom-verified"><span class="pf-zoom-verified-check">Proof</span>' + (caption ? '<p class="pf-zoom-caption">' + caption + '</p>' : '') + '</div>'
      : '';
    content.innerHTML = '<div class="verify-modal-body pf-zoom-modal-body"><img src="' + src + '" class="pf-zoom-img" alt=""/>' + footer + '</div>';
    if (box) box.className = 'modal-box modal-box--zoom';
    overlay.classList.remove('hidden');
    return;
  }
  if (e.target.id === 'modalCloseBtn' || e.target.id === 'modalOverlay') {
    document.getElementById('modalOverlay').classList.add('hidden');
    var box = document.getElementById('modalBox');
    if (box) box.className = 'modal-box';
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

// ── Recruiter Password Lock ──────────────────────────────────────
// window.__PW_LOCK_ACTIVE__ is baked in by the Worker fresh on every
// request (true only while this site's Support donation is currently
// active AND a lock key was set). Unlike before, no hash is baked
// into the page at all — a typed guess is sent to the Worker's
// POST /api/lock/verify, which hashes it server-side with the site's
// salted PBKDF2 parameters and rate-limits attempts. Nothing worth
// brute-forcing ever appears in this page's source.
(function () {
  var root = document.getElementById('portfolioSite');
  if (!root || !window.__PW_LOCK_ACTIVE__) return;
  // Every element that ever surfaces a piece of Verifiable Proof —
  // per-skill/per-entry badges, gallery "+ proof" pins, and the
  // small ✓ dot next to a skill tag.
  var SELECTOR = '.pf-verify-badge, .pf-verify-badge-sm, .sd-gallery-thumb-verify, .pf-verify-add, .sd-verify-dot, [data-verify-type], [data-action="zoom-photo"][data-verified="1"]';
  var UNLOCK_KEY = 'pw_recruiter_unlocked_' + (root.getAttribute('data-lock-scope') || '1');

  function hide() {
    root.querySelectorAll(SELECTOR).forEach(function (el) { el.classList.add('pw-lock-hidden'); });
  }
  function reveal() {
    root.querySelectorAll(SELECTOR).forEach(function (el) { el.classList.remove('pw-lock-hidden'); });
  }

  var USERNAME_FOR_VERIFY = root.getAttribute('data-lock-scope') || '';

  function verifyGuess(guess) {
    return fetch('https://${PUBLISH_APEX}/api/site/proof', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: USERNAME_FOR_VERIFY, guess: guess })
    }).then(function (res) { return res.json().catch(function () { return { ok: false }; }); })
      .catch(function () { return { ok: false, error: 'network' }; });
  }

  // Session persistence stores the guess itself (sessionStorage,
  // scoped to this tab only — never localStorage/cookies) rather than
  // just a boolean, because proof content is never cached in the
  // page: a fresh load has to re-ask the server for it, and the
  // server needs the key again to release it. This still costs one
  // rate-limited PBKDF2 check per reload (same cost as a real guess),
  // it just doesn't require the recruiter to type the key again
  // within the same browser tab.
  var remembered = sessionStorage.getItem(UNLOCK_KEY);
  if (remembered) {
    verifyGuess(remembered).then(function (result) {
      if (result && result.ok) {
        window.__PW_PROOF__ = result.proof || {};
        reveal();
      } else {
        sessionStorage.removeItem(UNLOCK_KEY);
        hide();
        showFabAndPrompt();
      }
    });
  } else {
    hide();
    showFabAndPrompt();
  }

  var fab, openModal;
  function showFabAndPrompt() {
    if (fab) { fab.style.display = 'none'; openModal(); return; }
    // A small fixed lock icon, bottom-right, that's always available once
    // the popup has been dismissed — clicking it reopens the same prompt.
    fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'pw-lock-fab';
    fab.setAttribute('aria-label', 'Unlock verified proof');
    fab.innerHTML = '🔒';
    fab.style.display = 'none';
    document.body.appendChild(fab);

    var backdrop = null;

    openModal = function () {
    if (backdrop) return;
    backdrop = document.createElement('div');
    backdrop.className = 'pw-lock-backdrop';
    backdrop.innerHTML =
      '<div class="pw-lock-modal" role="dialog" aria-modal="true">' +
        '<button type="button" class="pw-lock-modal-close" aria-label="Close">✕</button>' +
        '<div class="pw-lock-modal-icon">🔒</div>' +
        '<p class="pw-lock-modal-label">This portfolio\u2019s Verifiable Proof is locked. Recruiters: enter the access key from this candidate\u2019s résumé.</p>' +
        '<input type="password" class="pw-lock-modal-input" placeholder="Access key" autocomplete="off" />' +
        '<button type="button" class="pw-lock-modal-btn">Unlock</button>' +
        '<span class="pw-lock-modal-status"></span>' +
      '</div>';
    document.body.appendChild(backdrop);

    var input = backdrop.querySelector('.pw-lock-modal-input');
    var status = backdrop.querySelector('.pw-lock-modal-status');
    input.focus();

    function attempt() {
      var val = input.value;
      if (!val) return;
      status.textContent = 'Checking…';
      verifyGuess(val).then(function (result) {
        if (result && result.ok) {
          window.__PW_PROOF__ = result.proof || {};
          sessionStorage.setItem(UNLOCK_KEY, val);
          reveal();
          closeModal();
          fab.style.display = 'none';
        } else if (result && result.error && /too many/i.test(result.error)) {
          status.textContent = result.error;
        } else {
          status.textContent = 'Incorrect key.';
          input.value = '';
        }
      });
    }
    function closeModal() {
      if (!backdrop) return;
      backdrop.remove();
      backdrop = null;
      // Popup was crossed/dismissed without unlocking — leave the
      // lock icon visible at the bottom of the page as the way back in.
      fab.style.display = 'flex';
    }

    backdrop.querySelector('.pw-lock-modal-btn').addEventListener('click', attempt);
    backdrop.querySelector('.pw-lock-modal-close').addEventListener('click', closeModal);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) closeModal(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') attempt(); if (e.key === 'Escape') closeModal(); });
    };

    fab.addEventListener('click', openModal);
    openModal();
  }
})();
${HORIZONTAL_SLIDE_SCRIPT}`;

// ── Static, offline ZIP export script ────────────────────────────
// Used only by the "Download ZIP" feature (see buildPortfolioZipHTML /
// downloadPortfolioZip). Deliberately excludes everything tied to the
// hosted backend: no fetch calls, no window.__PW_LOCK_ACTIVE__/
// __PW_PROOF__, and no Recruiter Password Lock at all — proof content
// is baked directly into data-verify-photo/data-verify-link/
// data-verify-label/data-caption attributes on each badge (see
// INLINE_PROOF_MODE in renderStaticPortfolioBlockInner), so the
// exported site is fully functional just by opening index.html
// locally, with nothing to fetch and no key to unlock.
const ZIP_PAGE_SCRIPT = `
document.addEventListener('click', function (e) {
  var linkBadge = e.target.closest('[data-action="open-verify-link"]');
  if (linkBadge) {
    var link = linkBadge.getAttribute('data-verify-link');
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
    return;
  }
  var verifyBtn = e.target.closest('[data-verify-type]');
  if (verifyBtn) {
    var type = verifyBtn.getAttribute('data-verify-type');
    if (type === 'link') {
      var link2 = verifyBtn.getAttribute('data-verify-link');
      if (link2) window.open(link2, '_blank', 'noopener,noreferrer');
      return;
    }
    var overlay = document.getElementById('modalOverlay');
    var content = document.getElementById('modalContent');
    var box = document.getElementById('modalBox');
    var photo = verifyBtn.getAttribute('data-verify-photo');
    if (type === 'photo' && photo) {
      var label = verifyBtn.getAttribute('data-verify-label') || '';
      content.innerHTML = '<h3 class="modal-title-proof">Proof</h3><div class="verify-modal-body"><img src="' + photo + '" class="verify-modal-img" alt="Verification proof"/>' + (label ? '<p class="verify-modal-caption">' + label + '</p>' : '') + '</div>';
      if (box) box.className = 'modal-box';
      overlay.classList.remove('hidden');
    }
    return;
  }
  var zoomEl = e.target.closest('[data-action="zoom-photo"]');
  if (zoomEl) {
    var overlay = document.getElementById('modalOverlay');
    var content = document.getElementById('modalContent');
    var box = document.getElementById('modalBox');
    var src = zoomEl.getAttribute('data-src');
    var verified = zoomEl.getAttribute('data-verified') === '1';
    var caption = zoomEl.getAttribute('data-caption') || '';
    var footer = verified
      ? '<div class="pf-zoom-verified"><span class="pf-zoom-verified-check">Proof</span>' + (caption ? '<p class="pf-zoom-caption">' + caption + '</p>' : '') + '</div>'
      : '';
    content.innerHTML = '<div class="verify-modal-body pf-zoom-modal-body"><img src="' + src + '" class="pf-zoom-img" alt=""/>' + footer + '</div>';
    if (box) box.className = 'modal-box modal-box--zoom';
    overlay.classList.remove('hidden');
    return;
  }
  if (e.target.id === 'modalCloseBtn' || e.target.id === 'modalOverlay') {
    document.getElementById('modalOverlay').classList.add('hidden');
    var box2 = document.getElementById('modalBox');
    if (box2) box2.className = 'modal-box';
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
${HORIZONTAL_SLIDE_SCRIPT}`;

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
        return [(block.data.items || []).map(skillName).join(', ')];
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
      return `<div class="rb-skills-wrap">${(block.data.items || []).map(s => `<span class="rb-skill-tag">${esc(skillName(s))}</span>`).join('')}</div>`;
    case 'certifications':
      return `<div class="rb-entry-list">${(block.data.items || []).map(it => `<div class="rb-entry-row"><div class="rb-entry-main"><span class="ce-strong">${esc(it.name || '')}</span><span class="ce-muted">${esc(it.issuer || '')}</span></div><span class="ce-muted rb-entry-date">${esc(it.date || '')}</span></div>`).join('')}</div>`;
    case 'languages':
      return `<div class="rb-entry-list">${(block.data.items || []).map(it => `<div class="rb-entry-row"><div class="rb-entry-main"><span class="ce-strong">${esc(it.name || '')}</span></div><span class="ce-muted rb-entry-date">${esc(it.level || '')}</span></div>`).join('')}</div>`;
    case 'spacer': {
      const size = ['sm', 'md', 'lg'].includes(block.data.size) ? block.data.size : 'md';
      return `<div class="rb-spacer rb-spacer-${size}" aria-hidden="true"></div>`;
    }
    default:
      return '';
  }
}

// Templates whose CSS ([data-template="..."] rules in editor.css)
// specifically restyles the side column — these need layout "2" on
// the thumbnail clone or their side-track styling never shows up.
// Keep in sync with editor.css's .resume-paper[data-template="..."]
// blocks that touch .side-track.
const TEMPLATE_TWO_COL = new Set(['lasalle', 'creative', 'modern-sidebar', 'slate-sidebar', 'mono-grid', 'wide-photo-sidebar']);

// Small, fixed sample content shared by every thumbnail — enough to
// show name/header styling, a section title, and a couple of bullet
// lines, which is where most templates' distinguishing rules live.
function templateThumbSampleBlocks() {
  return {
    main: [
      { id: 'th-sec', type: 'section', data: { title: 'Experience' } },
      { id: 'th-exp', type: 'experience', data: {
        company: 'Acme Co.', dates: '2022 — Now', role: 'Product Designer', location: 'Remote',
        bullets: ['Led redesign of the core product', 'Grew activation by 24%']
      } }
    ],
    side: [
      { id: 'th-sec2', type: 'section', data: { title: 'Skills' } },
      { id: 'th-skills', type: 'skills', data: { items: ['Figma', 'React'] } }
    ]
  };
}

// Builds one real .resume-paper element per template card — same
// classes/markup renderStaticResumeBlock() feeds the actual canvas —
// and scales it down with a CSS transform to fit the small thumbnail
// box. Because it's the *real* element under the *real* CSS rules
// (.resume-paper[data-template="..."] in editor.css), this can never
// drift out of sync with what the canvas actually renders — unlike
// the old hand-drawn tpl-line mockups, which were a second,
// independently-maintained approximation.
function renderTemplateThumbnails() {
  document.querySelectorAll('.template-card[data-template]').forEach(card => {
    const tpl = card.dataset.template;
    const tplDef = TEMPLATES.find(t => t.id === tpl);
    const design = tplDef ? tplDef.design : null;
    if (!design) return;

    // Heading/body font + accent color preview row — communicates each
    // template's typography and color scheme at a glance. (A live
    // scaled-down clone of the actual .resume-paper was tried here
    // previously, but it depends on layout timing that isn't reliable
    // inside a panel that's just switched from display:none, and was
    // rendering as an empty box more often than not — this reads
    // straight from the template's own design data instead, so it's
    // simple and always correct.)
    let meta = card.querySelector('.tpl-card-meta');
    if (!meta) {
      meta = document.createElement('div');
      meta.className = 'tpl-card-meta';
      const nameEl = card.querySelector('.tpl-card-name');
      if (nameEl) card.insertBefore(meta, nameEl);
      else card.appendChild(meta);
    }
    meta.innerHTML = `
      <span class="tpl-card-font tpl-card-font-heading" style="font-family:${esc(FONT_STACKS[design.headingFont] || FONT_STACKS.sans)};" title="Heading font">Aa</span>
      <span class="tpl-card-font tpl-card-font-body" style="font-family:${esc(FONT_STACKS[design.bodyFont] || FONT_STACKS.sans)};" title="Body font">Aa</span>
      <span class="tpl-card-swatch" style="background:${esc(design.accent)};" title="Accent color"></span>`;
  });
}

// ── Verifiable Proof content: kept out of the public page ──────────
// Proof photos/links used to be embedded directly as data-verify-*
// attributes in the exported HTML — always present in the DOM/page
// source regardless of whether the Recruiter Password Lock was
// "unlocked" in the UI, since that lock only ever toggled a CSS
// class. That meant the lock protected nothing for anyone willing to
// view-source or open devtools.
//
// Now, static badge rendering below emits only a stable
// data-verify-id per proof item and records the real content (photo
// data-URI, link, label) in this collector instead of inlining it.
// buildPublishedSiteHTML drains the collector into a `proofItems` map
// that's uploaded to the Worker *separately* from the HTML (see
// /api/publish's proofItems handling) and never baked into the page.
// The published page fetches that map from /api/site/proof at
// runtime — freely if no lock is active on the site, or only after a
// correct guess via /api/lock/verify if one is.
let CURRENT_PROOF_COLLECTOR = null;
let CURRENT_PROOF_SEQ = 0;
// When true, staticVerifyBadge/the gallery renderer below skip the
// collectProof id-indirection entirely and bake proof content
// straight into data-verify-photo/data-verify-link/data-verify-label
// attributes instead. Only ever turned on for buildPortfolioZipHTML —
// a self-contained offline export has no backend to fetch proof from
// (and, being a private file the person downloaded themselves, no
// view-source privacy concern that the hosted flow's indirection
// exists to solve).
let INLINE_PROOF_MODE = false;

function collectProof(entry) {
  if (!CURRENT_PROOF_COLLECTOR) return null; // collector not active (e.g. live-canvas preview, not a static export)
  const id = 'v' + (++CURRENT_PROOF_SEQ);
  CURRENT_PROOF_COLLECTOR[id] = entry;
  return id;
}

function renderStaticPortfolioBlock(block) {
  const html = renderStaticPortfolioBlockInner(block);
  if (!html) return html;
  // Every case below opens with a single top-level element whose first
  // attribute is class="..." — injecting pf-no-shadow into that first
  // match is enough to flatten the shadow on export, matching what
  // pf-no-shadow already does on the live canvas (see
  // createPortfolioBlock). A block with no shadow to begin with (e.g.
  // the section-title heading) just gets a harmless, inert class.
  const shadowed = block.hardShadow === false
    ? html.replace(/^(<[a-z0-9]+\s+class=")/i, '$1pf-no-shadow ')
    : html;
  const align = block.align === 'center' || block.align === 'right' ? block.align : 'left';
  const contentAlign = block.contentAlign === 'center' || block.contentAlign === 'right' ? block.contentAlign : 'left';
  // Same idea: inject data-align/data-content-align onto that same
  // top-level element (not a wrapping div) so the exported DOM shape
  // matches the live canvas, where createPortfolioBlock sets
  // dataset.align/dataset.contentAlign directly on the card.
  return shadowed.replace(/^(<[a-z0-9]+\s)/i, `$1data-align="${align}" data-content-align="${contentAlign}" `);
}

function renderStaticPortfolioBlockInner(block) {
  const bulletsHTML = (bullets) => `<ul class="rb-bullets">${(bullets || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul>`;
  // Self-contained proof badge — carries its own type/link/photo/label
  // attributes so PUBLISHED_PAGE_SCRIPT's delegated click handler can
  // act on it directly, with no index lookups needed. `small` gives a
  // compact variant for inline use in entry-list rows (certifications,
  // languages) where a full-size badge would overwhelm one line.
  const staticVerifyBadge = (v, small) => {
    if (!v || v.type === 'none') return '';
    const labelHTML = v.label ? `<span class="pf-verify-label">${esc(v.label)}</span>` : '';
    const cls = small ? 'pf-verify-badge pf-verify-badge-sm' : 'pf-verify-badge';
    const text = small ? VERIFIED_SEAL_ICON : `<span class="pf-verify-check">${VERIFIED_SEAL_ICON}</span>Verified${labelHTML}`;
    if (v.type === 'photo' && v.photo) {
      if (INLINE_PROOF_MODE) {
        return `<button class="${cls}" data-verify-type="photo" data-verify-photo="${esc(v.photo)}" data-verify-label="${esc(v.label || '')}" type="button" title="View proof">${text}</button>`;
      }
      const id = collectProof({ type: 'photo', photo: v.photo, label: v.label || '' });
      return `<button class="${cls}" data-verify-type="photo" data-verify-id="${esc(id)}" type="button" title="View proof">${text}</button>`;
    }
    if (v.type === 'link' && v.link) {
      const safeHref = /^https?:\/\//i.test(v.link) ? v.link : `https://${v.link}`;
      if (INLINE_PROOF_MODE) {
        return `<button class="${cls}" data-verify-type="link" data-verify-link="${esc(safeHref)}" type="button" title="View proof">${text}</button>`;
      }
      const id = collectProof({ type: 'link', link: safeHref, label: v.label || '' });
      return `<button class="${cls}" data-verify-type="link" data-verify-id="${esc(id)}" type="button" title="View proof">${text}</button>`;
    }
    return '';
  };

  switch (block.type) {
    case 'section':
      return `<h2 class="pf-block-section-title">${esc(block.data.title)}</h2>`;
    case 'summary': {
      const badge = staticVerifyBadge(block.data.verify);
      return `<div class="pf-card pf-summary-card">${esc(block.data.text)}${badge ? `<div class="pf-verify">${badge}</div>` : ''}</div>`;
    }
    case 'custom': {
      const badge = staticVerifyBadge(block.data.verify);
      return `<div class="pf-card"><h3 class="pf-exp-company">${esc(block.data.title)}</h3><p>${esc(block.data.text)}</p>${badge ? `<div class="pf-verify">${badge}</div>` : ''}</div>`;
    }
    case 'experience': {
      const verifyHTML = staticVerifyBadge(block.data.verify);
      return `<div class="pf-card">
        <div class="pf-exp-top-row"><span class="pf-exp-company">${esc(block.data.company)}</span><span class="pf-exp-dates">${esc(block.data.dates)}</span></div>
        <div class="pf-exp-sub-row"><span>${esc(block.data.role)}</span><span>${esc(block.data.location)}</span></div>
        ${bulletsHTML(block.data.bullets)}
        ${verifyHTML ? `<div class="pf-verify">${verifyHTML}</div>` : ''}
      </div>`;
    }
    case 'education': {
      const badge = staticVerifyBadge(block.data.verify);
      return `<div class="pf-card pf-edu-card">
        <div class="pf-exp-top-row"><span class="pf-exp-company">${esc(block.data.school)}</span><span class="pf-exp-dates">${esc(block.data.year)}</span></div>
        <div class="pf-exp-sub-row"><span>${esc(block.data.degree)}</span><span>${esc(block.data.location)}</span></div>
        ${block.data.gpa ? `<div class="pf-edu-gpa">${esc(block.data.gpa)}</div>` : ''}
        ${badge ? `<div class="pf-verify">${badge}</div>` : ''}
      </div>`;
    }
    case 'projects': {
      const badge = staticVerifyBadge(block.data.verify);
      return `<div class="pf-card">
        <div class="pf-exp-top-row"><span class="pf-exp-company">${esc(block.data.name)}</span><span class="pf-exp-dates">${esc(block.data.dates)}</span></div>
        <div class="pf-exp-sub-row"><span>${esc(block.data.description)}</span></div>
        ${bulletsHTML(block.data.bullets)}
        ${badge ? `<div class="pf-verify">${badge}</div>` : ''}
      </div>`;
    }
    case 'skills': {
      // Per-entry proof only (each tag carries its own badge via
      // skillVerify/staticVerifyBadge) — no block-level verify here,
      // matching certifications/languages below. A whole-section
      // badge sourced from block.data.verify used to render here too,
      // which never had anywhere to be set from the editor and just
      // showed a stray, meaningless "Verified" pill under the tags.
      return `<div class="pf-card"><div class="rb-skills-wrap">${(block.data.items || []).map(s => `<span class="rb-skill-tag">${esc(skillName(s))}${staticVerifyBadge(skillVerify(s), true)}</span>`).join('')}</div></div>`;
    }
    case 'certifications':
      return `<div class="pf-card"><div class="rb-entry-list">${(block.data.items || []).map(it => `<div class="rb-entry-row"><div class="rb-entry-main"><span class="ce-strong">${esc(it.name || '')}</span><span class="ce-muted">${esc(it.issuer || '')}</span></div><div class="rb-entry-right"><span class="ce-muted rb-entry-date">${esc(it.date || '')}</span>${staticVerifyBadge(it.verify, true)}</div></div>`).join('')}</div></div>`;
    case 'languages':
      return `<div class="pf-card"><div class="rb-entry-list">${(block.data.items || []).map(it => `<div class="rb-entry-row"><div class="rb-entry-main"><span class="ce-strong">${esc(it.name || '')}</span></div><div class="rb-entry-right"><span class="ce-muted rb-entry-date">${esc(it.level || '')}</span>${staticVerifyBadge(it.verify, true)}</div></div>`).join('')}</div></div>`;
    case 'gallery': {
      if (!(block.data.photos || []).length) return '';
      const itemsHTML = block.data.photos.map((p, i) => {
        const pv = p.verify || { type: 'none' };
        // The photo tile always zooms into the usual larger pop-up on
        // click. Both link-type and photo-type proof get their own
        // clickable checkmark badge — only clicking that checkmark
        // opens the verification URL (link-type) or the proof photo
        // itself (photo-type, via the same data-verify-type handler
        // used for experience/skills badges); the rest of the tile
        // still zooms as normal.
        let badge = '';
        let photoProofId = null;
        if (pv.type === 'link' && pv.link) {
          const safeHref = /^https?:\/\//i.test(pv.link) ? pv.link : `https://${pv.link}`;
          if (INLINE_PROOF_MODE) {
            badge = `<button class="pf-photo-verify-badge is-link" data-action="open-verify-link" data-verify-link="${esc(safeHref)}" type="button" title="Open verification link">${VERIFIED_SEAL_ICON}</button>`;
          } else {
            const id = collectProof({ type: 'link', link: safeHref, label: pv.label || '' });
            badge = `<button class="pf-photo-verify-badge is-link" data-action="open-verify-link" data-verify-id="${esc(id)}" type="button" title="Open verification link">${VERIFIED_SEAL_ICON}</button>`;
          }
        } else if (pv.type === 'photo' && pv.photo) {
          if (INLINE_PROOF_MODE) {
            badge = `<button class="pf-photo-verify-badge is-link" data-verify-type="photo" data-verify-photo="${esc(pv.photo)}" data-verify-label="${esc(pv.label || '')}" type="button" title="View proof photo">${VERIFIED_SEAL_ICON}</button>`;
          } else {
            photoProofId = collectProof({ type: 'photo', photo: pv.photo, label: pv.label || '' });
            badge = `<button class="pf-photo-verify-badge is-link" data-verify-type="photo" data-verify-id="${esc(photoProofId)}" type="button" title="View proof photo">${VERIFIED_SEAL_ICON}</button>`;
          }
        }
        const hasProof = pv.type === 'photo' && !!pv.photo;
        // Hosted flow: caption is drawn from the same proof entry
        // (looked up by id at unlock/hydrate time) rather than
        // embedded here, so a recruiter's private note doesn't leak
        // via view-source. Zip flow: no view-source concern for a
        // file the person downloaded themselves, so bake it straight
        // in as data-caption.
        const captionAttr = hasProof && pv.label
          ? (INLINE_PROOF_MODE ? ` data-caption="${esc(pv.label)}"` : ` data-caption-id="${esc(photoProofId)}"`)
          : '';
        return `<div class="pf-gallery-item" data-action="zoom-photo" data-src="${esc(p.src)}" data-verified="${hasProof ? '1' : '0'}"${captionAttr}>${badge}<img src="${esc(p.src)}" alt="" /></div>`;
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
    case 'spacer': {
      const size = ['sm', 'md', 'lg'].includes(block.data.size) ? block.data.size : 'md';
      return `<div class="pf-spacer pf-spacer-${size}" aria-hidden="true"></div>`;
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

function buildHorizontalSectionsHTML(blocks, dotsStyle) {
  const slides = groupBlocksIntoSlides(blocks);
  const slidesHTML = slides.map((slideBlocks, i) => `
    <div class="pf-slide" id="pfSlide-${i}">
      <div class="pf-slide-inner">${slideBlocks.map(renderStaticPortfolioBlock).join('\n')}</div>
    </div>`).join('\n');
  const dotsHTML = slides.length > 1
    ? `<nav class="pf-slide-dots" aria-label="Portfolio sections">${slides.map((_, i) => {
        const classes = ['pf-dot'];
        if (i === 0) classes.push('active');
        if (dotsStyle === 'progress' && i === 0) classes.push('passed');
        return `<button class="${classes.join(' ')}" data-pf-slide="${i}" aria-label="Section ${i + 1}"></button>`;
      }).join('')}</nav>`
    : '';
  return `<div class="pf-sections">${slidesHTML}</div>${dotsHTML}`;
}

// Builds a complete, standalone HTML document for the published site.
// Always snapshots state.portfolio — publishing never reads from the
// résumé/PDF document.
function buildPublishedSiteHTML(username) {
  const p = Store.state.portfolio.profile;
  const design = Store.state.portfolio.design;
  const blocks = filterVisibleBlocksHidingOrphanSections(Store.state.portfolio.blocks);
  const fullName = `${p.firstName} ${p.lastName}`.trim() || 'Untitled Portfolio';
  const contactLine = [p.email, p.phone, p.address].filter(Boolean).join('   •   ');
  const isHorizontal = (design.sectionAnimation || 'none') === 'horizontal';
  const isVertical = (design.sectionAnimation || 'none') === 'vertical';
  // Drain real proof content (photos/links/labels) into a side map
  // instead of the returned HTML — see collectProof above. Reset
  // before, and stash onto the function itself right after, so
  // publishPortfolio (below) can pick it up without changing every
  // caller's signature; each call to buildPublishedSiteHTML fully
  // replaces the previous map.
  CURRENT_PROOF_COLLECTOR = {};
  CURRENT_PROOF_SEQ = 0;
  const sectionsHTML = (isHorizontal || isVertical)
    ? buildHorizontalSectionsHTML(blocks, design.dotsStyle || 'dot')
    : `<div class="pf-sections">${blocks.map(renderStaticPortfolioBlock).join('\n')}</div>`;
  buildPublishedSiteHTML.lastProofItems = CURRENT_PROOF_COLLECTOR;
  CURRENT_PROOF_COLLECTOR = null;

  const pageTitle = `${esc(fullName)}${p.jobTitle ? ' — ' + esc(p.jobTitle) : ''}`;
  const pageDescription = esc(p.tagline || (fullName + ' — portfolio, built with ' + PUBLISH_APEX));
  const siteUrl = username ? `https://${esc(username)}.${PUBLISH_APEX}` : '';
  // The profile photo doubles as the favicon/social preview image when
  // there is one — it's already a data: URI (see FileReader usage in
  // initInputListeners), which every modern browser accepts directly
  // as a <link rel="icon"> href, no separate upload/resize step
  // needed. Falls back to the site's own favicon when no photo is set.
  const iconHref = p.photo || `https://${PUBLISH_APEX}/favicon.png`;
  const ogImage = p.photo || `https://${PUBLISH_APEX}/favicon.png`;
  // Recruiter Password Lock: whether it's currently *enforced* is
  // decided fresh on every request by the Worker (see
  // window.__PW_LOCK_ACTIVE__ in worker/src/index.js's serveSite),
  // tied to this site's current Support-donation status. Unlike
  // before, no password hash is baked into this page at all — a
  // typed guess is checked against a salted, iterated hash kept only
  // on the server, via POST /api/lock/verify, so there's nothing here
  // worth lifting from view-source and brute-forcing offline.

  return `<!DOCTYPE html>
<html lang="en" data-theme="dazed">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${pageTitle}</title>
<meta name="description" content="${pageDescription}" />
${siteUrl ? `<link rel="canonical" href="${esc(siteUrl)}" />` : ''}
<link rel="icon" href="${esc(iconHref)}" />
<link rel="apple-touch-icon" href="${esc(iconHref)}" />
<meta property="og:type" content="profile" />
${siteUrl ? `<meta property="og:url" content="${esc(siteUrl)}" />` : ''}
<meta property="og:title" content="${pageTitle}" />
<meta property="og:description" content="${pageDescription}" />
<meta property="og:image" content="${esc(ogImage)}" />
<meta name="twitter:card" content="${p.photo ? 'summary_large_image' : 'summary'}" />
<meta name="twitter:title" content="${pageTitle}" />
<meta name="twitter:description" content="${pageDescription}" />
<meta name="twitter:image" content="${esc(ogImage)}" />
<link rel="stylesheet" href="https://${PUBLISH_APEX}/dazed.css" />
<link rel="stylesheet" href="https://${PUBLISH_APEX}/portfolio.css" />
<style>
  body { margin: 0; background: var(--color-background, #FDF7FA); }
  .portfolio-site { width: 100%; max-width: 100%; border: none; box-shadow: none; }
</style>
</head>
<body data-viewmode="portfolio">
  <div class="portfolio-site" id="portfolioSite" data-lock-scope="${esc(username || 'preview')}" data-header-style="${esc(design.headerStyle || 'scroll')}" data-section-anim="${esc(design.sectionAnimation || 'none')}" data-dots-pos="${esc(design.dotsPosition || 'right')}" data-dots-center="${esc(design.dotsCentering || 'slide')}" data-dots-style="${esc(design.dotsStyle || 'dot')}" data-dots-symbol="${esc(design.dotsSymbol || 'circle')}" data-content-width="${esc(design.contentWidth || 'contained')}" data-hero-align="${esc(design.heroAlign || 'left')}" data-hero-photo-shape="${esc(design.heroPhotoShape || 'circle')}" data-hero-photo-border="${design.heroPhotoBorder === false ? '0' : '1'}" data-hero-photo-size="${esc(design.heroPhotoSize || 'md')}" data-hero-size="${esc(design.heroSize || 'normal')}" style="--pf-accent:${esc(design.accent)};--pf-heading-font:${esc(FONT_STACKS[design.headingFont] || FONT_STACKS.modern)};--pf-body-font:${esc(FONT_STACKS[design.bodyFont] || FONT_STACKS.sans)};--pf-header-pct:${esc(design.headerHeightPct || 30)};--pf-text-pad:${esc((Number(design.textPaddingRem) || 0) + 'rem')};--pf-line-height:${esc(LINE_SPACING_PRESETS[design.lineSpacing] || LINE_SPACING_PRESETS.normal)};--pf-section-gap:${esc(SECTION_SPACING_PRESETS[design.sectionSpacing] || SECTION_SPACING_PRESETS.normal)};--pf-card-pad:${esc(CARD_PADDING_PRESETS[design.cardPadding] || CARD_PADDING_PRESETS.normal)};">
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
    <div class="modal-box" id="modalBox" role="dialog" aria-modal="true">
      <button class="modal-close" id="modalCloseBtn" type="button" aria-label="Close">✕</button>
      <div id="modalContent"></div>
    </div>
  </div>

  <script>${PUBLISHED_PAGE_SCRIPT}</script>
</body>
</html>`;
}

// Self-contained, offline HTML for the "Download ZIP" feature — the
// portfolio only (not the résumé), with no hosting, no account, and
// no Recruiter Password Lock involved at all. Proof content is baked
// straight into the markup (see INLINE_PROOF_MODE) instead of being
// drained out for a separate lock-gated fetch, dazed.css/portfolio.css
// are referenced as plain relative files (bundled alongside index.html
// in the zip, see downloadPortfolioZip), and the embedded script is
// the trimmed ZIP_PAGE_SCRIPT rather than PUBLISHED_PAGE_SCRIPT.
function buildPortfolioZipHTML() {
  const p = Store.state.portfolio.profile;
  const design = Store.state.portfolio.design;
  const blocks = filterVisibleBlocksHidingOrphanSections(Store.state.portfolio.blocks);
  const fullName = `${p.firstName} ${p.lastName}`.trim() || 'Untitled Portfolio';
  const contactLine = [p.email, p.phone, p.address].filter(Boolean).join('   •   ');
  const isHorizontal = (design.sectionAnimation || 'none') === 'horizontal';
  const isVertical = (design.sectionAnimation || 'none') === 'vertical';

  INLINE_PROOF_MODE = true;
  CURRENT_PROOF_COLLECTOR = null; // not used in this mode — proof is inlined directly
  let sectionsHTML;
  try {
    sectionsHTML = (isHorizontal || isVertical)
      ? buildHorizontalSectionsHTML(blocks, design.dotsStyle || 'dot')
      : `<div class="pf-sections">${blocks.map(renderStaticPortfolioBlock).join('\n')}</div>`;
  } finally {
    INLINE_PROOF_MODE = false;
  }

  const pageTitle = `${esc(fullName)}${p.jobTitle ? ' — ' + esc(p.jobTitle) : ''}`;
  const pageDescription = esc(p.tagline || (fullName + ' — portfolio'));
  const iconHref = p.photo || '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="dazed">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${pageTitle}</title>
<meta name="description" content="${pageDescription}" />
${iconHref ? `<link rel="icon" href="${esc(iconHref)}" />` : ''}
<link rel="stylesheet" href="dazed.css" />
<link rel="stylesheet" href="portfolio.css" />
<style>
  body { margin: 0; background: var(--color-background, #FDF7FA); }
  .portfolio-site { width: 100%; max-width: 100%; border: none; box-shadow: none; }
</style>
</head>
<body data-viewmode="portfolio">
  <div class="portfolio-site" id="portfolioSite" data-header-style="${esc(design.headerStyle || 'scroll')}" data-section-anim="${esc(design.sectionAnimation || 'none')}" data-dots-pos="${esc(design.dotsPosition || 'right')}" data-dots-center="${esc(design.dotsCentering || 'slide')}" data-dots-style="${esc(design.dotsStyle || 'dot')}" data-dots-symbol="${esc(design.dotsSymbol || 'circle')}" data-content-width="${esc(design.contentWidth || 'contained')}" data-hero-align="${esc(design.heroAlign || 'left')}" data-hero-photo-shape="${esc(design.heroPhotoShape || 'circle')}" data-hero-photo-border="${design.heroPhotoBorder === false ? '0' : '1'}" data-hero-photo-size="${esc(design.heroPhotoSize || 'md')}" data-hero-size="${esc(design.heroSize || 'normal')}" style="--pf-accent:${esc(design.accent)};--pf-heading-font:${esc(FONT_STACKS[design.headingFont] || FONT_STACKS.modern)};--pf-body-font:${esc(FONT_STACKS[design.bodyFont] || FONT_STACKS.sans)};--pf-header-pct:${esc(design.headerHeightPct || 30)};--pf-text-pad:${esc((Number(design.textPaddingRem) || 0) + 'rem')};--pf-line-height:${esc(LINE_SPACING_PRESETS[design.lineSpacing] || LINE_SPACING_PRESETS.normal)};--pf-section-gap:${esc(SECTION_SPACING_PRESETS[design.sectionSpacing] || SECTION_SPACING_PRESETS.normal)};--pf-card-pad:${esc(CARD_PADDING_PRESETS[design.cardPadding] || CARD_PADDING_PRESETS.normal)};">
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
    <div class="modal-box" id="modalBox" role="dialog" aria-modal="true">
      <button class="modal-close" id="modalCloseBtn" type="button" aria-label="Close">✕</button>
      <div id="modalContent"></div>
    </div>
  </div>

  <script>${ZIP_PAGE_SCRIPT}</script>
</body>
</html>`;
}

// A person's name/job title, cleaned up into a readable, GitHub-safe
// repo name — used both for the zip's own filename and suggested repo
// names in the bundled README (buildPortfolioZipReadme below).
function portfolioZipBaseName() {
  const p = Store.state.portfolio.profile;
  return slugifyUsername(`${p.firstName || ''}-${p.lastName || ''}-portfolio`) || 'portfolio';
}

// Plain-language instructions for hosting the exported folder for
// free, bundled into every zip alongside index.html. Covers the three
// most common free static-hosting options — deliberately kept
// beginner-friendly (drag-and-drop first) since this replaces the old
// one-click "Publish to username.proves.work" flow.
function buildPortfolioZipReadme() {
  const repoName = portfolioZipBaseName();
  return `# Your portfolio — how to host it for free

This folder is a complete, self-contained website:

  index.html
  dazed.css
  portfolio.css

Open \`index.html\` directly in a browser and it already works —
double-click it, no server required. To share it at a public URL,
pick any one of the free options below. You only need one.

---

## Option 1: GitHub Pages

1. Create a new repository on https://github.com/new (e.g. \`${repoName}\`).
   Public repos work with GitHub Pages on the free plan.
2. Upload all 3 files from this folder into the repo — on the repo
   page, use "Add file" → "Upload files", drag them in, then commit.
3. Go to the repo's **Settings** → **Pages**.
4. Under "Build and deployment", set **Source** to "Deploy from a
   branch", pick the **main** branch and the **/ (root)** folder,
   then click **Save**.
5. GitHub will give you a URL that looks like:
   \`https://your-username.github.io/${repoName}/\`
   It usually goes live within a minute or two.

---

## Option 2: Vercel

1. Go to https://vercel.com and sign up (free) — GitHub sign-in is
   the fastest option.
2. Click **Add New… → Project**.
3. Easiest path: drag this whole folder onto the Vercel dashboard's
   upload area (no GitHub repo needed). Alternatively, push it to a
   GitHub repo first (see Option 1, steps 1–2) and "Import" that repo
   instead.
4. Leave the framework preset as **Other** — there's nothing to build,
   these are already plain HTML/CSS files.
5. Click **Deploy**. Vercel gives you a URL like:
   \`https://${repoName}.vercel.app\`

---

## Option 3: Cloudflare Pages

1. Go to https://dash.cloudflare.com → **Workers & Pages** → **Create**
   → **Pages**.
2. Choose **Upload assets** (no GitHub account needed) and drag this
   folder in — or **Connect to Git** if you've pushed it to GitHub
   (see Option 1, steps 1–2) and want automatic redeploys on future
   edits.
3. Leave the build command blank and the output directory as \`/\`
   (there's no build step — it's already static HTML/CSS).
4. Click **Save and Deploy**. Cloudflare gives you a URL like:
   \`https://${repoName}.pages.dev\`

---

## A couple of notes

- All three options are free for a personal portfolio like this one,
  with no time limit and no card required for GitHub Pages or
  Cloudflare Pages (Vercel's free "Hobby" plan is also card-free).
- If you edit your portfolio again later and re-download the zip,
  just re-upload the new files (GitHub Pages) or re-deploy the new
  folder (Vercel/Cloudflare) to update the live site — your URL stays
  the same.
- This export doesn't include a Recruiter Password Lock, even if you
  have one set up elsewhere — it's meant to be a simple, fully public
  copy of your portfolio.
`;
}

// Fetches dazed.css/portfolio.css (served alongside editor.js on this
// same origin) and bundles them — plus a bundled README.md with free
// hosting instructions (GitHub Pages, Vercel, Cloudflare Pages) — into
// a downloadable .zip. A fully self-contained copy of just the
// portfolio (not the résumé), with no account, no hosting, and no
// Recruiter Password Lock, available regardless of whether you're on
// the free tier or have an active Support/paid period. Works fully
// offline once downloaded: open index.html directly, no server needed.
async function downloadPortfolioZip(triggerBtn) {
  const original = triggerBtn ? triggerBtn.textContent : '';
  if (triggerBtn) { triggerBtn.disabled = true; triggerBtn.textContent = 'Zipping…'; }
  try {
    const [dazedCss, portfolioCss] = await Promise.all([
      fetch('dazed.css').then(r => r.text()),
      fetch('portfolio.css').then(r => r.text())
    ]);
    const zip = new JSZip();
    zip.file('index.html', buildPortfolioZipHTML());
    zip.file('dazed.css', dazedCss);
    zip.file('portfolio.css', portfolioCss);
    zip.file('README.md', buildPortfolioZipReadme());
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const name = portfolioZipBaseName();
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    if (triggerBtn) { triggerBtn.textContent = '✓ Downloaded'; setTimeout(() => { triggerBtn.textContent = original; triggerBtn.disabled = false; }, 1600); }
  } catch (err) {
    if (triggerBtn) { triggerBtn.textContent = 'Download failed'; setTimeout(() => { triggerBtn.textContent = original; triggerBtn.disabled = false; }, 1800); }
  }
}


// The toolbar button is permanently an icon-only green up-arrow — it
// no longer flips to "Sign in to Google" when signed out, and no
// longer shows a text label. Clicking it while signed out still opens
// the sign-in flow first (see the click handler in initToolbar), but
// its icon and green styling never change.
function refreshPublishToolbarButton() {
  const btn = document.getElementById('btnPublishShowcase');
  if (!btn) return;
  btn.textContent = '⬆';
  btn.classList.add('btn-green');
  btn.classList.remove('btn-ghost', 'btn-secondary');
}

// Always a consistent, explicit manual "Save" action — saves the
// current draft to the person's Google account. This used to flip to
// "👀 Preview" once a site was live, which meant the same button did
// two different things depending on state; keeping it as Save at all
// times means people always know what clicking it will do.
function refreshSaveOrPreviewButton() {
  const btn = document.getElementById('btnPreviewShowcase');
  if (!btn) return;
  btn.textContent = '💾';
  btn.dataset.mode = 'save';
  btn.title = 'Save your progress to your Google account';
}

// Explicit manual save, used by the "Save" toolbar button for anyone
// who hasn't published yet (free tier or otherwise). Requires being
// signed in — there is no local saving unless you're signed in — so
// signed-out visitors are routed to sign in first.
function manualSaveProgress() {
  if (!getSavedGoogleAccount()) {
    openSignInModal();
    return;
  }
  saveLocalDraft();
  syncDraftToServer();
  const btn = document.getElementById('btnPreviewShowcase');
  if (btn) {
    const original = btn.textContent;
    btn.textContent = '✓';
    setTimeout(() => { if (btn.dataset.mode === 'save') btn.textContent = original; }, 1400);
  }
}

// A focused, single-purpose modal for signing in — shown when the
// toolbar button is clicked while signed out, or automatically when
// /editor first loads (see maybeShowSignInOnLoad). On success it
// hands straight off into the normal Publish modal, so "sign in"
// flows directly into "publish" in one motion rather than making the
// person click the toolbar button a second time. Pass
// { onLoad: true } for the automatic, on-page-load version, which
// just closes and lets autosave pick up instead of jumping into
// Publish — someone who just landed on the page hasn't asked to
// publish anything yet.
function openSignInModal(opts) {
  const onLoad = !!(opts && opts.onLoad);
  const customMessage = opts && opts.message;
  openModal(`
    <div class="signin-modal-centered">
      <h3 class="modal-title" id="modalTitle">Sign in to Google</h3>
      <p class="modal-sub">${customMessage
        ? esc(customMessage)
        : (onLoad
          ? `Sign in with Google so any progress you make here can be saved and loaded again later — on this device or any other.`
          : `Sign in to save your progress and publish your portfolio to ${PUBLISH_APEX}.`)}</p>
      <div class="field-box full-width" id="signInAccountBox"></div>
    </div>
  `, (root) => {
    const box = root.querySelector('#signInAccountBox');
    box.innerHTML = `<p class="username-status">Loading Google sign-in…</p>`;
    waitForGoogleIdentity((ready) => {
      if (!box.isConnected) return;
      if (!ready) {
        box.innerHTML = `<p class="username-status warn">Google sign-in script hasn't loaded (offline, or blocked) — you can still edit, but nothing will be saved until you sign in.</p>`;
        return;
      }
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          handleGoogleCredential(response);
          closeModal();
          await refreshSiteStatusBadge();
          if (!onLoad) openPublishModal();
        }
      });
      window.google.accounts.id.renderButton(box, { theme: 'outline', size: 'large', text: 'signin_with' });
    });
  });
}

// Shown once, automatically, every time /editor is opened while
// signed out — this is how people find out sign-in is what makes
// their progress saveable at all. It's fully dismissible: the
// modal's own × close button, clicking outside it, or Escape all
// cross it out and drop straight into editing with no account
// required for that session (see scheduleAutosave for what that
// does and doesn't persist).
function maybeShowSignInOnLoad() {
  if (getSavedGoogleAccount()) return;
  openSignInModal({ onLoad: true });
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
    <p class="modal-sub">Free, and manually reviewed before it goes live.${signedIn && getSavedUsername() ? ` You have ${usernameChangesRemaining()} username change${usernameChangesRemaining() === 1 ? '' : 's'} left.` : ''}</p>
    <div class="modal-actions modal-actions--publish">
      <button class="btn btn-ghost btn-sm" id="publishDownloadZipBtn" type="button" title="Download a fully-functioning offline copy — no account or review needed">⬇ Download ZIP</button>
      <button class="btn btn-secondary btn-sm" id="publishConfirmBtn" type="button" disabled>Publish</button>
    </div>
    <p class="modal-footnote">Prefer to self-host? The ZIP includes a README for free hosting on GitHub Pages, Vercel, or Cloudflare Pages.</p>
  `;

  openModal(html, (root) => {
    renderPublishAccountBox();
    root.querySelector('#publishDownloadZipBtn').addEventListener('click', (e) => downloadPortfolioZip(e.currentTarget));

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
      const wasCachedUsername = value === getSavedUsername();

      // Changing to a different address than the one already saved
      // consumes one of the 2 allowed username changes — block it here
      // once they're used up, rather than letting the publish request
      // go out and fail (or worse, silently reuse the limit). This is
      // just a UX speed bump based on the local cache; the real check
      // below is what actually decides ownership.
      if (!wasCachedUsername && getSavedUsername() && usernameChangesRemaining() <= 0) {
        status.textContent = `You've already changed your username ${MAX_USERNAME_CHANGES} times — ${getSavedUsername()}.${PUBLISH_APEX} is the only address you can publish to.`;
        status.className = 'username-status warn';
        confirmBtn.disabled = true;
        return;
      }
      status.textContent = 'Checking availability…';
      status.className = 'username-status';
      try {
        const account = getSavedGoogleAccount();
        const res = await fetch('/api/check-username', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username: value, googleCredential: account && account.credential })
        });
        if (!res.ok) throw new Error('no-backend');
        const data = await res.json();
        if (data.available) {
          // The server says this name is free. If it's the name we had
          // cached locally, that cache is now stale — an admin must have
          // unpublished, rejected, or hard-deleted it since. Clear it so
          // the rest of the UI (toolbar status badge, change-count logic)
          // stops treating a name we no longer actually hold as ours.
          if (wasCachedUsername) clearLocalUsernameState();
          status.textContent = `✓ ${value}.${PUBLISH_APEX} is available`;
          status.className = 'username-status ok';
          confirmBtn.disabled = false;
        } else if (data.ownedByYou) {
          // Server-verified, not just a local-cache guess — this is
          // what makes a site an admin soft-deleted and then restored
          // still recognized as yours, even if the local cache was
          // cleared or you're on a different browser/device: the
          // record's ownerEmail still matches your signed-in account.
          // Re-sync the local cache to match, without counting it as
          // one of the 2 allowed username changes (nothing changed).
          if (!wasCachedUsername) saveUsername(value);
          status.textContent = `✓ ${value}.${PUBLISH_APEX} is already yours`;
          status.className = 'username-status ok';
          confirmBtn.disabled = false;
        } else {
          // Genuinely someone else's (or a stale local cache claiming
          // a name the server no longer attributes to you) — clear any
          // stale cache pointing at it so the UI stops implying it's
          // still ours.
          if (wasCachedUsername) clearLocalUsernameState();
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
      // Publishing itself is free and unconditional now — hosting at
      // username.proves.work is never gated on payment. The old
      // "Active Job Hunter" fee-before-publish flow has moved to a
      // separate, optional Support flow (see openSupportModal) reached
      // from the publish-success screen and /manage, since it now only
      // grants the badge + Recruiter Password Lock, not hosting itself.
      doPublish(username, confirmBtn);
    });
  });
}

async function doPublish(username, confirmBtn, referenceNumber) {
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Publishing…';
  const account = getSavedGoogleAccount();
  let res;
  try {
    res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username,
        // The Worker verifies this ID token server-side and ties the
        // username to the Google account — publishing without one is
        // rejected server-side too (the UI already prevents reaching
        // this point unless signed in).
        googleCredential: account ? account.credential : null,
        html: buildPublishedSiteHTML(username),
        // Real proof photo/link/label content, drained out of the
        // HTML above by collectProof — stored separately server-side
        // and served only via /api/site/proof (gated by the
        // Recruiter Password Lock when one is active). Always resent
        // on every publish since it's tied 1:1 to this snapshot's
        // content/ids, not something to leave stale.
        proofItems: buildPublishedSiteHTML.lastProofItems || {},
        // Purely informational — lets an admin match this submission
        // against the payment shown on the QR step (see
        // openPublishPaymentModal). It does NOT mark the site as paid
        // by itself; only an admin's explicit "Mark as paid" in
        // /admin does that (see /api/admin/set-paid).
        buyerReferenceNumber: referenceNumber || ''
        // No passwordLockKey field here on purpose: the plaintext key
        // is never retained in the browser after it's sent once (see
        // openSupportModal), so a regular publish must omit this
        // field entirely to leave whatever lock is already stored on
        // the server untouched — only the support modal's own publish
        // call includes 'passwordLockKey' to actually change it.
      })
    });
  } catch (err) {
    // fetch() itself only throws for a genuine network-level failure
    // (offline, DNS, CORS, no worker deployed at all) — this is the
    // one case where there's truly no backend to talk to, so falling
    // back to a local-only preview is the right move.
    saveUsername(username);
    const blob = new Blob([buildPublishedSiteHTML(username)], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    openPublishSuccessModal(blobUrl, 'local');
    return;
  }

  // Past this point the backend *did* respond — a non-2xx status here
  // is a real rejection from the server (expired sign-in, ownership
  // mismatch, a validation error, a genuine server-side failure,
  // etc.), not an absent backend. Silently treating this the same as
  // "no backend reachable" used to swallow the real reason and show
  // "Local preview ready" instead — which looked like success but
  // never actually published anything, leaving an already-approved,
  // already-paid site stuck showing its old content with no
  // indication anything had gone wrong.
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok || !data || !data.ok) {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Publish';
    // A 401 here specifically means the signed-in session expired
    // (Google ID tokens are only valid for about an hour) — the most
    // helpful thing to do is send the person straight back through
    // sign-in, which re-opens Publish automatically on success,
    // rather than leaving them to figure out "sign in again" from a
    // plain error message.
    if (res.status === 401) {
      clearGoogleAccount();
      openSignInModal({ message: 'Your sign-in expired — sign in again to publish this update.' });
      return;
    }
    alertModal(
      (data && data.error) ||
      `The server rejected this update (HTTP ${res.status}). Nothing was published — try signing out and back in, then republish.`
    );
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
      : `Your address is reserved and free to keep — it'll go live once an admin reviews it (usually quick).`);
  const linkLabel = mode === 'local' ? 'Open preview ↗' : (mode === 'updated' ? 'View live site ↗' : 'Preview address ↗');
  const showCopy = mode !== 'local';
  const showSupport = mode !== 'local';

  openModal(`
    <h3 class="modal-title" id="modalTitle">${title}</h3>
    <p class="modal-sub">${sub}</p>
    ${showCopy ? `<p class="publish-url">${esc(url)}</p>` : ''}
    ${showSupport ? `<p class="modal-sub" style="font-size:0.82rem;">Want the ★ Active Job Hunter badge (front-of-line in the Showcase) and the Recruiter Password Lock? It's an optional one-off donation to keep this project running.</p>` : ''}
    <div class="modal-actions">
      ${showCopy ? `<button class="btn btn-ghost btn-sm" id="publishCopyBtn" type="button">Copy link</button>` : ''}
      ${showSupport ? `<button class="btn btn-ghost btn-sm" id="publishSupportBtn" type="button">Support the project →</button>` : ''}
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
    const supportBtn = root.querySelector('#publishSupportBtn');
    if (supportBtn) supportBtn.addEventListener('click', () => openSupportModal(getSavedUsername()));
  });
}

// ── Support the project: donation slider + Recruiter Password Lock ──
// A completely separate, optional flow from publishing itself — hosting
// is always free. This grants two things for the chosen duration: the
// ★ Active Job Hunter badge (front-of-line in the Showcase) and,
// if a lock key is set, the Recruiter Password Lock on the
// Verifiable Proof badges. Same trust model as everywhere else in
// this app: nothing here is a real payment gateway — it's a QR +
// reference number an admin manually confirms (see /api/admin/set-paid).
const SUPPORT_ANCHORS = {
  PHP: { 1: 99, 3: 249, 6: 499, 12: 999, symbol: '₱' },
  USD: { 1: 4.99, 3: 11.49, 6: 24.99, 12: 49.99, symbol: '$' }
};
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
function supportPrice(months, currency) {
  const anchors = SUPPORT_ANCHORS[currency] || SUPPORT_ANCHORS.PHP;
  const m = Math.min(Math.max(Number(months) || 1, 1), 12);
  const points = [1, 3, 6, 12];
  let lo = 1, hi = 12;
  for (let i = 0; i < points.length - 1; i++) {
    if (m >= points[i] && m <= points[i + 1]) { lo = points[i]; hi = points[i + 1]; break; }
  }
  const t = hi === lo ? 0 : (m - lo) / (hi - lo);
  const raw = anchors[lo] + (anchors[hi] - anchors[lo]) * t;
  const snapped = snapToFriendlyPrice(raw);
  return Math.min(Math.max(snapped, anchors[1]), anchors[12]);
}
function formatSupportPrice(months, currency) {
  const anchors = SUPPORT_ANCHORS[currency] || SUPPORT_ANCHORS.PHP;
  const amount = supportPrice(months, currency);
  return `${anchors.symbol}${currency === 'USD' ? amount.toFixed(2) : Math.round(amount)}`;
}

function openSupportModal(username) {
  if (!username) { openSignInModal({ message: 'Publish your portfolio first, then come back to support the project.' }); return; }
  let currency = 'PHP';
  let months = 3;

  const html = `
    <h3 class="modal-title" id="modalTitle">Support the project</h3>
    <p class="modal-sub">A one-off donation to help cover the real cost of running this — not a subscription, and not payment for support or new features. This is a solo, AI-assisted project offered as-is on Cloudflare's free tier; your portfolio stays live and free either way. In return, this grants the ★ Active Job Hunter badge for the months you pick.</p>
    <div class="field-box full-width">
      <span>Currency</span>
      <div class="modal-actions" style="justify-content:flex-start;gap:0.5rem;margin:0.35rem 0 0.75rem;">
        <button type="button" class="btn btn-ghost btn-sm" id="supportCurrencyPHP" data-active="1">₱ PHP</button>
        <button type="button" class="btn btn-ghost btn-sm" id="supportCurrencyUSD">$ USD</button>
      </div>
    </div>
    <div class="field-box full-width">
      <span>Duration</span>
      <input type="range" min="1" max="12" step="1" value="${months}" id="supportMonthsSlider" style="width:100%;" />
      <div class="price-duration-label">
        <span id="supportMonthsLabel">${months} months</span>
        <span id="supportAmountLabel">${formatSupportPrice(months, currency)} one-time</span>
      </div>
    </div>
    <p class="modal-footnote">Want the Recruiter Password Lock too? Set or change it separately from the 🔑 button in the toolbar — it only actually locks anything while your Support period is active.</p>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" id="supportBackBtn" type="button">Cancel</button>
      <button class="btn btn-secondary btn-sm" id="supportContinueBtn" type="button">Continue to pay</button>
    </div>
  `;
  openModal(html, (root) => {
    const slider = root.querySelector('#supportMonthsSlider');
    const monthsLabel = root.querySelector('#supportMonthsLabel');
    const amountLabel = root.querySelector('#supportAmountLabel');
    const btnPHP = root.querySelector('#supportCurrencyPHP');
    const btnUSD = root.querySelector('#supportCurrencyUSD');

    function refresh() {
      months = Number(slider.value);
      monthsLabel.textContent = `${months} month${months > 1 ? 's' : ''}`;
      amountLabel.textContent = `${formatSupportPrice(months, currency)} one-time`;
      btnPHP.classList.toggle('btn-secondary', currency === 'PHP');
      btnUSD.classList.toggle('btn-secondary', currency === 'USD');
    }
    slider.addEventListener('input', refresh);
    btnPHP.addEventListener('click', () => { currency = 'PHP'; refresh(); });
    btnUSD.addEventListener('click', () => { currency = 'USD'; refresh(); });
    refresh();

    root.querySelector('#supportBackBtn').addEventListener('click', closeModal);
    root.querySelector('#supportContinueBtn').addEventListener('click', async () => {
      openSupportPaymentModal(username, months, currency);
    });
  });
}

// Standalone Recruiter Password Lock management, split out from the
// Support flow — setting/changing the key is its own action and
// doesn't require a donation to do. (Whether it's actually enforced
// on the published page still depends on an active Support period —
// see the note in this modal and openSupportModal above.) The
// plaintext key is never kept in the browser once sent; only whether
// one is currently set is tracked locally (hasPasswordLock), so this
// modal can show "already set" without ever holding onto the key.
function openRecruiterLockModal(username) {
  if (!username) { openSignInModal({ message: 'Publish your portfolio first, then come back to set a Recruiter Password Lock.' }); return; }
  const hasExistingLock = !!(Store.state.portfolio.hasPasswordLock || (lastSiteStatusData && lastSiteStatusData.hasPasswordLock));

  const html = `
    <h3 class="modal-title" id="modalTitle">Recruiter Password Lock</h3>
    <p class="modal-sub">Set an access key recruiters must enter to view your Verifiable Proof badges. This only actually locks anything while you have an active Support (♥) period — the key itself can be set anytime.</p>
    <div class="field-box full-width">
      <span>Access key</span>
      <input type="password" class="field-input" id="recruiterLockInput" placeholder="${hasExistingLock ? 'Key already set — type to change it' : 'Set an access key for recruiters'}" autocomplete="off" />
      <p class="username-status" style="font-size:0.75rem;">Sent over HTTPS and hashed on the server with a per-site salt — never stored or shown as plain text once set. Leave blank to keep your existing key unchanged.</p>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" id="recruiterLockCancelBtn" type="button">Cancel</button>
      <button class="btn btn-secondary btn-sm" id="recruiterLockSaveBtn" type="button">Save key</button>
    </div>
  `;
  openModal(html, (root) => {
    root.querySelector('#recruiterLockCancelBtn').addEventListener('click', closeModal);
    root.querySelector('#recruiterLockSaveBtn').addEventListener('click', async (e) => {
      const lockPlain = root.querySelector('#recruiterLockInput').value;
      if (!lockPlain) { closeModal(); return; }
      const btn = e.currentTarget;
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Saving…';
      try {
        await fetch('/api/publish', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            username,
            googleCredential: getSavedGoogleAccount() ? getSavedGoogleAccount().credential : null,
            html: buildPublishedSiteHTML(username),
            proofItems: buildPublishedSiteHTML.lastProofItems || {},
            passwordLockKey: lockPlain
          })
        });
        Store.state.portfolio.hasPasswordLock = true;
        closeModal();
      } catch {
        btn.disabled = false;
        btn.textContent = original;
        const status = root.querySelector('.username-status');
        if (status) { status.textContent = 'Couldn\u2019t save — check your connection and try again.'; status.classList.add('warn'); }
      }
    });
  });
}

function openSupportPaymentModal(username, months, currency) {
  const amountLabel = formatSupportPrice(months, currency);
  const html = `
    <h3 class="modal-title" id="modalTitle">Pay ${amountLabel} to support</h3>
    <p class="modal-sub">Scan the QR below to donate <strong>${amountLabel}</strong> (${months} month${months > 1 ? 's' : ''}), then enter the reference number so an admin can confirm it.</p>
    <img src="payment-qr.png" alt="Payment QR code" width="220" height="220" style="display:block;margin:0 auto 1rem;border-radius:12px;border:1px solid rgba(0,0,0,0.08);" />
    <input type="text" id="supportRefInput" class="field-input" placeholder="Payment reference number" autocomplete="off" />
    <div class="username-status" id="supportRefStatus"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" id="supportRefLaterBtn" type="button">I'll do this later</button>
      <button class="btn btn-secondary btn-sm" id="supportRefSubmitBtn" type="button">Submit reference</button>
    </div>
  `;
  openModal(html, (root) => {
    const status = root.querySelector('#supportRefStatus');
    async function submit(ref) {
      const account = getSavedGoogleAccount();
      try {
        await fetch('/api/support/claim', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username, googleCredential: account ? account.credential : null, months, currency, referenceNumber: ref })
        });
      } catch { /* handled as a generic network error below via the finally-success UX */ }
      closeModal();
      openModal(`
        <h3 class="modal-title">Thank you 🎉</h3>
        <p class="modal-sub">Your support request is recorded. An admin confirms every payment by hand before the badge/lock actually turn on — check <strong>proves.work/manage</strong> anytime for status.</p>
        <div class="modal-actions"><button class="btn btn-secondary btn-sm" id="supportDoneBtn" type="button">Got it</button></div>
      `, (r) => r.querySelector('#supportDoneBtn').addEventListener('click', closeModal));
    }
    root.querySelector('#supportRefLaterBtn').addEventListener('click', () => submit(''));
    root.querySelector('#supportRefSubmitBtn').addEventListener('click', () => {
      const ref = root.querySelector('#supportRefInput').value.trim();
      if (!ref) { status.textContent = 'Enter your payment reference number.'; status.className = 'username-status warn'; return; }
      submit(ref);
    });
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
    item.dataset.blockType = block.type;
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
    else if (block.type === 'spacer') titleText = 'Blank Space';

    const hasGalleryVerify = block.type === 'gallery' && (block.data.photos || []).some(p => p.verify && p.verify.type !== 'none');
    const verifyBadge = ((block.type === 'experience' && block.data.verify && block.data.verify.type !== 'none') || hasGalleryVerify)
      ? `<span class="sd-verify-dot" title="Has verification proof">✓</span>` : '';

    const swapBtn = twoCol
      ? `<button class="sd-icon-btn sd-swap-btn" data-action="swap" data-id="${block.id}" title="Move to ${block.col === 'side' ? 'main column' : 'sidebar'}" type="button">${block.col === 'side' ? '⇤' : '⇥'}</button>`
      : '';

    const isExpanded = expandedBlocks.has(block.id);
    if (isExpanded) item.classList.add('expanded');
    const isResume = Store.state.viewMode === 'resume';
    const isStyleOpen = isResume && styleOpenBlocks.has(block.id);
    if (isStyleOpen) item.classList.add('style-open');
    const styleBtn = isResume
      ? `<button class="sd-icon-btn sd-style-btn ${isStyleOpen ? 'active' : ''}" data-action="toggle-style" data-block="${block.id}" title="${isStyleOpen ? 'Close styling' : 'Font, bold/italic/underline, spacing & margins'}" type="button">🎨</button>`
      : '';

    const hideBtn = `<button class="sd-icon-btn sd-hide-btn ${block.hidden ? 'is-hidden' : ''}" data-action="toggle-hidden" data-id="${block.id}" title="${block.hidden ? 'Show this section' : 'Hide this section (keeps its content)'}" type="button">${block.hidden ? '🚫' : '👁'}</button>`;
    const shadowOn = block.hardShadow !== false;
    const shadowBtn = `<button class="sd-icon-btn sd-shadow-btn ${shadowOn ? '' : 'is-off'}" data-action="toggle-shadow" data-id="${block.id}" title="${shadowOn ? 'Turn off hard shadow for this section' : 'Turn on hard shadow for this section'}" type="button">◱</button>`;
    const align = block.align === 'center' || block.align === 'right' ? block.align : 'left';
    const alignIcon = align === 'center' ? '↔' : align === 'right' ? '➡' : '⬅';
    const alignLabel = align === 'center' ? 'Centered' : align === 'right' ? 'Right-aligned' : 'Left-aligned';
    const alignBtn = `<button class="sd-icon-btn sd-align-btn" data-action="cycle-align" data-id="${block.id}" data-align="${align}" title="Section position on page: ${alignLabel} (click to change)" type="button">${alignIcon}</button>`;
    const contentAlign = block.contentAlign === 'center' || block.contentAlign === 'right' ? block.contentAlign : 'left';
    const contentAlignIcon = contentAlign === 'center' ? 'T↔' : contentAlign === 'right' ? 'T➡' : 'T⬅';
    const contentAlignLabel = contentAlign === 'center' ? 'Centered' : contentAlign === 'right' ? 'Right-aligned' : 'Left-aligned';
    const contentAlignBtn = `<button class="sd-icon-btn sd-content-align-btn" data-action="cycle-content-align" data-id="${block.id}" data-content-align="${contentAlign}" title="Text alignment inside this section: ${contentAlignLabel} (click to change)" type="button">${contentAlignIcon}</button>`;
    const hiddenTag = block.hidden ? `<span class="sd-hidden-tag">Hidden</span>` : '';

    item.innerHTML = `
      <div class="sd-item-header">
        <span class="sd-drag-handle">☰</span>
        <span class="sd-title-text">${esc(titleText)} ${verifyBadge}${hiddenTag}</span>
        <span class="sd-item-actions">
          ${swapBtn}
          ${alignBtn}
          ${contentAlignBtn}
          ${shadowBtn}
          ${hideBtn}
          ${styleBtn}
          <button class="sd-icon-btn sd-expand-btn" data-action="toggle-expand" data-block="${block.id}" title="${isExpanded ? 'Done editing' : 'Edit this section'}" type="button">${isExpanded ? '✓' : '✎'}</button>
          <button class="sd-icon-btn sd-delete-btn" data-action="delete" data-id="${block.id}" title="Delete section" type="button">✕</button>
        </span>
      </div>
      <div class="sd-summary-line">${esc(blockSummaryLine(block))}</div>
      ${isStyleOpen ? blockStyleFieldsHTML(block) : ''}
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
    const styleInput = e.target.closest('[data-style-key]');
    if (styleInput) {
      const blockId = styleInput.dataset.block;
      const key = styleInput.dataset.styleKey;
      if (styleInput.tagName === 'SELECT') {
        Store.setBlockStyle(blockId, key, styleInput.value || null);
      } else {
        const raw = styleInput.value;
        Store.setBlockStyle(blockId, key, raw === '' ? null : Number(raw));
      }
      return;
    }
    const input = e.target.closest('.sd-gallery-file-input');
    if (!input || !input.files[0]) return;
    const blockId = input.dataset.block;
    readAndCompressImage(input.files[0])
      .then((dataUrl) => Store.addListItem(blockId, 'photos', { id: uid(), src: dataUrl, verify: { type: 'none', photo: null, link: '', label: '' } }))
      .catch(() => {});
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
      } else if (action === 'toggle-shadow') {
        Store.toggleBlockShadow(actionBtn.dataset.id);
      } else if (action === 'cycle-align') {
        const order = ['left', 'center', 'right'];
        const next = order[(order.indexOf(actionBtn.dataset.align) + 1) % order.length];
        Store.setBlockAlign(actionBtn.dataset.id, next);
      } else if (action === 'cycle-content-align') {
        const order = ['left', 'center', 'right'];
        const next = order[(order.indexOf(actionBtn.dataset.contentAlign) + 1) % order.length];
        Store.setBlockContentAlign(actionBtn.dataset.id, next);
      } else if (action === 'toggle-expand') {
        toggleBlockExpand(actionBtn.dataset.block);
      } else if (action === 'toggle-style') {
        toggleBlockStyleOpen(actionBtn.dataset.block);
      } else if (action === 'reset-block-style') {
        Store.resetBlockStyle(actionBtn.dataset.id);
      } else if (actionBtn.dataset.styleToggle) {
        const key = actionBtn.dataset.styleToggle;
        const blockId = actionBtn.dataset.block;
        const block = Store.active().blocks.find(b => b.id === blockId);
        const current = !!(block && block.style && block.style[key]);
        Store.setBlockStyle(blockId, key, !current);
      } else if (action === 'add-item') {
        Store.addListItem(actionBtn.dataset.block, actionBtn.dataset.field, actionBtn.dataset.itemType === 'object' ? {} : '');
      } else if (action === 'remove-item') {
        Store.removeListItem(actionBtn.dataset.block, actionBtn.dataset.field, Number(actionBtn.dataset.index));
      } else if (action === 'view-verify') {
        openVerifyViewModal(actionBtn.dataset.block, actionBtn.dataset.photoIndex !== undefined ? Number(actionBtn.dataset.photoIndex) : undefined);
      } else if (action === 'edit-verify') {
        openVerifyEditModal(actionBtn.dataset.block, actionBtn.dataset.photoIndex !== undefined ? Number(actionBtn.dataset.photoIndex) : undefined);
      } else if (action === 'edit-photo-verify') {
        openVerifyEditModal(actionBtn.dataset.block, Number(actionBtn.dataset.photoIndex));
      } else if (action === 'cycle-spacer-size') {
        const order = ['sm', 'md', 'lg'];
        const next = order[(order.indexOf(actionBtn.dataset.size) + 1) % order.length];
        Store.updateBlockData(actionBtn.dataset.block, 'size', next);
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
    // The whole item is draggable="true" so the header/handle can start
    // a reorder from anywhere convenient — but that same draggable
    // ancestor hijacks the browser's native text-selection drag when
    // the mousedown starts inside a contenteditable field (bullets,
    // company name, etc): instead of highlighting text, the browser
    // starts dragging the item. Toggle draggable off right before that
    // happens whenever the press starts inside an editable text field
    // (or any other interactive control), and back on otherwise, so
    // highlighting a bullet's text never gets mistaken for a reorder.
    item.addEventListener('mousedown', (e) => {
      item.draggable = !e.target.closest('.ce-field, input, textarea, button');
    });

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

    // Make sure the résumé is balanced to the page (grown to fill it,
    // or shrunk to fit it) using the live on-screen element *before* we
    // read Store.state.resume.design below — otherwise the export could
    // clone a stale/short design an instant before the auto-balance
    // debounce fires, producing a downloaded PDF that looks noticeably
    // more cramped or sparse than what's currently on screen.
    clearTimeout(autoBalanceTimer);
    runResumePageBalance();

    const resume = Store.state.resume;
    const design = resume.design || {};
    const blocks = resume.blocks || [];
    const profile = resume.profile || {};

    const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Resume';
    const contactLine = [profile.email, profile.phone, profile.address].filter(Boolean).join(' • ');

    const clone = document.createElement('div');
    clone.className = 'resume-paper is-pdf-export';
    if (!blocks.some(b => b.col === 'side')) clone.classList.add('no-side-content');
    clone.setAttribute('data-template', resume.template || 'ats');
    clone.setAttribute('data-layout', design.layout || '1');
    clone.setAttribute('data-header-align', design.headerAlign || 'left');
    clone.setAttribute('data-date-align', design.dateAlign || 'right');
    clone.setAttribute('data-title-style', design.titleStyle || 'plain');
    clone.style.setProperty('--rp-accent', design.accent || '#111');
    clone.style.setProperty('--rp-heading-font', FONT_STACKS[design.headingFont] || FONT_STACKS.sans);
    clone.style.setProperty('--rp-body-font', FONT_STACKS[design.bodyFont] || FONT_STACKS.sans);
    clone.style.setProperty('--rp-font-scale', Number(design.fontSize || 100) / 100);
    clone.style.setProperty('--rp-line-height', Number(design.lineHeight) || 1.45);
    const pdfPage = PAGE_SIZES_MM[design.pageSize] || PAGE_SIZES_MM.letter;
    clone.style.setProperty('--rp-page-w', pdfPage.w + 'mm');
    clone.style.setProperty('--rp-page-min-h', pdfPage.h + 'mm');
    clone.style.setProperty('--rp-margin', (Number(design.pageMargin) || 2.5) + 'rem');
    clone.style.setProperty('--rp-margin-y', (Number(design.pageMarginY ?? design.pageMargin) || 2.5) + 'rem');
    clone.style.setProperty('--rp-margin-x', (Number(design.pageMarginX ?? design.pageMargin) || 2.5) + 'rem');
    clone.style.setProperty('--rp-section-gap', (Number(design.sectionGap) ?? 1) + 'rem');
    clone.style.setProperty('--rp-block-pad', (Number(design.blockPad) ?? 0.5) + 'rem');
    clone.style.setProperty('--rp-title-gap', (Number(design.titleGap) ?? 0.2) + 'rem');
    clone.style.setProperty('--rp-bullet-scale', (Number(design.bulletSize) || 100) / 100);
    clone.style.setProperty('--rp-col-gap', (Number(design.colGap) ?? 2) + 'rem');
    clone.style.setProperty('--rp-side-width', (Number(design.colSplit) || 34) + '%');
    clone.style.setProperty('--rp-col-border-w', design.colBorder === false ? '0px' : '2px');

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
        <div class="col-track main-track">${filterVisibleBlocksHidingOrphanSections(blocks.filter(b => b.col === 'main')).map(b => `<div class="resume-block block-${b.type}" style="${esc(blockStyleToCSS(b.style))}">${renderStaticResumeBlock(b)}</div>`).join('')}</div>
        <div class="col-track side-track">${filterVisibleBlocksHidingOrphanSections(blocks.filter(b => b.col === 'side')).map(b => `<div class="resume-block block-${b.type}" style="${esc(blockStyleToCSS(b.style))}">${renderStaticResumeBlock(b)}</div>`).join('')}</div>
      </div>`;

    // Render off-screen but still fully "visible" to the browser's paint
    // pipeline — html2canvas only captures pixels that are actually
    // rendered, so `visibility:hidden` / `display:none` / `opacity:0` all
    // produce a blank canvas. A huge negative offset (-99999px) is also
    // unreliable: html2canvas can miscalculate the capture region against
    // such extreme coordinates and again come back blank / wrong size,
    // which is also why pagination silently failed (nothing real to
    // paginate). Instead, clip the clone out of view with a zero-size,
    // overflow:hidden wrapper — the clone inside still lays out and paints
    // at its real, full size; only its visual overflow is hidden from the
    // user.
    const wrapper = document.createElement('div');
    wrapper.className = 'resume-paper-export-wrapper';
    wrapper.style.position = 'fixed';
    wrapper.style.top = '0';
    wrapper.style.left = '0';
    wrapper.style.width = '0';
    wrapper.style.height = '0';
    wrapper.style.overflow = 'hidden';
    wrapper.style.pointerEvents = 'none';
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    // Make sure web fonts and any images (profile photo, etc.) have
    // actually finished loading before html2canvas measures/paints the
    // clone — otherwise the captured canvas can come out blank, wrongly
    // sized, or too short to trigger a page break.
    const imgEls = Array.from(clone.querySelectorAll('img'));
    await Promise.all([
      document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
      ...imgEls.map(img => img.complete ? Promise.resolve() : new Promise(res => {
        img.addEventListener('load', res, { once: true });
        img.addEventListener('error', res, { once: true });
      }))
    ]);
    // One extra frame so layout/paint has settled before capture.
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));

    const filename = `${fullName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'resume'}.pdf`;

    // Pin the capture width to the *exact* page width in px (96dpi),
    // the same math the live canvas itself is drawn at (pxFromMm), so
    // html2canvas's internal px→pt conversion lines up 1:1 with the
    // page. Using clone.scrollWidth/scrollHeight here instead (as
    // before) let sub-pixel layout rounding creep in over a tall
    // résumé, which html2canvas's scale factor then amplified — the
    // visible symptom being a downloaded PDF that looked noticeably
    // more squeezed/stretched than the editor preview of the exact
    // same résumé.
    const exactWidthPx = Math.round(pxFromMm(pdfPage.w));
    // Read the real rendered height off the clone (now settled/painted)
    // rather than trusting scrollWidth math for height too, since
    // content height is data-dependent, not a fixed page constant.
    const exactHeightPx = Math.ceil(clone.getBoundingClientRect().height) || clone.scrollHeight;

    await html2pdf()
      .set({
        margin: 0,
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          width: exactWidthPx,
          windowWidth: exactWidthPx,
          height: exactHeightPx,
          windowHeight: exactHeightPx,
          x: 0, y: 0, scrollX: 0, scrollY: 0
        },
        jsPDF: { unit: 'in', format: PAGE_SIZES_IN[design.pageSize] || PAGE_SIZES_IN.letter, orientation: 'portrait' },
        pagebreak: { mode: ['css'], avoid: ['.resume-block', '.rb-entry-row', '.rb-header'] }
      })
      .from(clone)
      .save();

    wrapper.remove();
  } catch (err) {
    console.error(err);
    alert('Sorry — the PDF could not be generated. Please try again.');
  } finally {
    document.querySelectorAll('.resume-paper-export-wrapper').forEach(w => w.remove());
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

  const btnFitOnePage = document.getElementById('btnFitOnePage');
  const fitOnePageStatus = document.getElementById('fitOnePageStatus');
  if (btnFitOnePage) {
    btnFitOnePage.addEventListener('click', () => {
      const originalLabel = btnFitOnePage.textContent;
      const originalHint = fitOnePageStatus ? fitOnePageStatus.textContent : '';
      btnFitOnePage.disabled = true;
      btnFitOnePage.textContent = 'Fitting…';
      // Let the "Fitting…" label paint before the (synchronous, and on
      // long résumés potentially chunky) fit loop runs.
      requestAnimationFrame(() => {
        setTimeout(() => {
          // Priority: fit lengthwise (page height) first — this is
          // what actually gets a résumé onto one page. Only once
          // that's settled do we compress horizontal whitespace
          // (tighten side margins) to make better use of the width.
          // Compressing width can reflow lines (usually fewer per
          // line becoming more per line, i.e. shorter — occasionally
          // the reverse), which changes content height, so the length
          // fit is re-run afterward to account for that.
          fitResumeToOnePage();
          compressResumeWidth();
          const result = fitResumeToOnePage();
          btnFitOnePage.disabled = false;
          btnFitOnePage.textContent = originalLabel;
          if (fitOnePageStatus) {
            fitOnePageStatus.textContent = result.fit
              ? '✓ Fitted to one page.'
              : 'Shrunk as far as it can while staying readable — there\'s still a bit too much content for one page. Try trimming a bullet or two.';
            fitOnePageStatus.style.color = result.fit ? 'var(--color-secondary, #12704A)' : '#9C2A2A';
            setTimeout(() => {
              if (fitOnePageStatus) {
                fitOnePageStatus.textContent = originalHint;
                fitOnePageStatus.style.color = '';
              }
            }, 4000);
          }
        }, 10);
      });
    });
  }

  document.getElementById('btnPublishShowcase').addEventListener('click', async () => {
    // Opens straight into the Publish modal — sign-in (needed only for
    // the hosted address) is handled inline inside it (see
    // renderPublishAccountBox), so "Download ZIP instead" is reachable
    // without signing in at all.
    // Refresh site status right before opening the Publish modal so
    // "already paid & live" is judged against the current truth, not
    // whatever was cached at page load — an admin could have approved
    // or marked the site paid at any point since then. This is what
    // makes the fee-skip check further down actually trustworthy.
    if (getSavedGoogleAccount()) await refreshSiteStatusBadge();
    openPublishModal();
  });
  refreshPublishToolbarButton();
  refreshSaveOrPreviewButton();
  refreshSiteStatusBadge();
  document.getElementById('btnSupportProject').addEventListener('click', () => {
    if (!getSavedGoogleAccount()) { openSignInModal(); return; }
    openSupportModal(getSavedUsername());
  });
  document.getElementById('btnRecruiterLock').addEventListener('click', () => {
    if (!getSavedGoogleAccount()) { openSignInModal(); return; }
    openRecruiterLockModal(getSavedUsername());
  });
  document.getElementById('btnPreviewShowcase').addEventListener('click', (e) => {
    if (e.currentTarget.dataset.mode === 'save') {
      manualSaveProgress();
      return;
    }
    const blob = new Blob([buildPublishedSiteHTML(getSavedUsername())], { type: 'text/html' });
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
  // Thumbnails are measured/scaled against their holder's rendered
  // width (see renderTemplateThumbnails), which is 0 while this panel
  // is hidden — so the very first render (at page load, before the
  // user has ever opened Customize) always computes scale 0 and every
  // template card is left permanently blank. Re-running it here, now
  // that the panel is actually visible and has a real width, fixes
  // that without touching the render logic itself.
  if (mode === 'customize') renderTemplateThumbnails();
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
  legal: { w: 215.9, h: 355.6 },
  folio: { w: 215.9, h: 330.2 }
};

// Same sizes in inches, used for the exported PDF's jsPDF format so the
// download always matches whichever Document Size the template is set to.
const PAGE_SIZES_IN = {
  letter: [8.5, 11],
  a4: [8.2677, 11.6929],
  legal: [8.5, 14],
  folio: [8.5, 13]
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
  el.resumePaper.style.setProperty('--rp-margin-y', (Number(design.pageMarginY ?? design.pageMargin) || 2.5) + 'rem');
  el.resumePaper.style.setProperty('--rp-margin-x', (Number(design.pageMarginX ?? design.pageMargin) || 2.5) + 'rem');
  el.resumePaper.style.setProperty('--rp-section-gap', (Number(design.sectionGap) ?? 1) + 'rem');
  el.resumePaper.style.setProperty('--rp-block-pad', (Number(design.blockPad) ?? 0.5) + 'rem');
  el.resumePaper.style.setProperty('--rp-title-gap', (Number(design.titleGap) ?? 0.2) + 'rem');
  el.resumePaper.style.setProperty('--rp-bullet-scale', (Number(design.bulletSize) || 100) / 100);
  el.resumePaper.style.setProperty('--rp-col-gap', (Number(design.colGap) ?? 2) + 'rem');
  el.resumePaper.style.setProperty('--rp-side-width', (Number(design.colSplit) || 34) + '%');
  el.resumePaper.style.setProperty('--rp-col-border-w', design.colBorder === false ? '0px' : '2px');

  applyPortfolioLinkToResume(design);
}

// ── "Fit to One Page" ───────────────────────────────────────────
// Shrinks margin → block padding → section gap → line height → font
// size (in that order, each down to a sane floor) until the live
// .resume-paper's rendered content height fits within one page of
// whichever Document Size is currently selected. Operates directly on
// the real canvas element (same one applyResumeDesign drives) so the
// measurement always matches what's actually on screen/exported, then
// commits the final numbers back into the design so they persist,
// export to PDF, and survive template/page-size switches.
function pxFromMm(mm) {
  return mm * (96 / 25.4);
}

function fitResumeToOnePage() {
  if (Store.state.viewMode !== 'resume') return { fit: true };

  const doc = Store.active();
  const design = doc.design;
  const page = PAGE_SIZES_MM[design.pageSize] || PAGE_SIZES_MM.letter;
  // A small safety buffer below the true page height. The live canvas
  // (this measurement) and the PDF export (html2canvas → jsPDF, a
  // different rendering/rounding pipeline) can disagree by a few
  // sub-pixels on the exact height of the same content. Fitting to
  // 100% of the page here left just enough overflow for the export to
  // round the wrong way, push the last block onto a new page (its
  // "avoid split" rule refuses to cut it), and produce a mostly-blank
  // trailing page. Targeting ~1.5% under the page height leaves
  // headroom for that rounding without a visible difference on screen.
  const targetH = pxFromMm(page.h) * 0.985;
  const paper = el.resumePaper;

  let margin = Number(design.pageMarginY ?? design.pageMargin) || 2.5;
  let blockPad = Number(design.blockPad) ?? 0.5;
  let sectionGap = Number(design.sectionGap) ?? 1;
  let titleGap = Number(design.titleGap) ?? 0.2;
  let lineHeight = Number(design.lineHeight) || 1.45;
  let fontScale = Number(design.fontSize || 100) / 100;

  const MIN_MARGIN = 0.4;
  const MIN_PAD = 0.15;
  const MIN_GAP = 0.15;
  const MIN_TITLE_GAP = 0.05;
  const MIN_LH = 1.05;
  const MIN_FONT = 0.62;

  const apply = () => {
    paper.style.setProperty('--rp-margin-y', margin + 'rem');
    paper.style.setProperty('--rp-block-pad', blockPad + 'rem');
    paper.style.setProperty('--rp-section-gap', sectionGap + 'rem');
    paper.style.setProperty('--rp-title-gap', titleGap + 'rem');
    paper.style.setProperty('--rp-line-height', lineHeight);
    paper.style.setProperty('--rp-font-scale', fontScale);
  };
  const fits = () => {
    apply();
    return paper.scrollHeight <= targetH;
  };

  // Squeeze whitespace before type: page margins, line spacing, and
  // the gap between a section title and its own body all get driven
  // down toward their floor first (each still readable at its floor —
  // this is layout tightening, not just shrinking text), then section
  // gap and block padding, and only then font size as a last resort.
  // Finer steps near the end of each lever's range converge closer to
  // the target instead of possibly overshooting past it in one jump.
  let guard = 0;
  while (!fits() && guard < 600) {
    guard++;
    if (margin > MIN_MARGIN) { margin = Math.max(MIN_MARGIN, margin - 0.05); continue; }
    if (lineHeight > MIN_LH) { lineHeight = Math.max(MIN_LH, lineHeight - 0.015); continue; }
    if (titleGap > MIN_TITLE_GAP) { titleGap = Math.max(MIN_TITLE_GAP, titleGap - 0.015); continue; }
    if (sectionGap > MIN_GAP) { sectionGap = Math.max(MIN_GAP, sectionGap - 0.04); continue; }
    if (blockPad > MIN_PAD) { blockPad = Math.max(MIN_PAD, blockPad - 0.02); continue; }
    if (fontScale > MIN_FONT) { fontScale = Math.max(MIN_FONT, fontScale - 0.01); continue; }
    break;
  }

  const succeeded = fits();

  margin = Math.round(margin * 100) / 100;
  blockPad = Math.round(blockPad * 100) / 100;
  sectionGap = Math.round(sectionGap * 100) / 100;
  titleGap = Math.round(titleGap * 100) / 100;
  lineHeight = Math.round(lineHeight * 100) / 100;
  fontScale = Math.round(fontScale * 1000) / 1000;

  // Persist — this also re-triggers applyResumeDesign via design_changed,
  // which re-applies the exact same numbers, so nothing visually jumps.
  design.pageMarginY = margin;
  design.blockPad = blockPad;
  design.sectionGap = sectionGap;
  design.titleGap = titleGap;
  design.lineHeight = lineHeight;
  design.fontSize = String(Math.round(fontScale * 100));
  Store.emit('design_changed', design);

  return { fit: succeeded };
}

// ── "Fill the Page" ──────────────────────────────────────────────
// The inverse of fitResumeToOnePage: when a résumé is short, it used to
// just sit at the top of the page with dead white space below —
// distracting on screen, and worse, that's exactly the space html2pdf
// silently drops since it captures only the rendered content height per
// page. Instead of leaving the layout "compressed" into a small block,
// grow line-height → title/section gaps → block padding → margin (the
// same levers fitResumeToOnePage shrinks, in roughly reverse order) up
// toward generous ceilings until the content comfortably spans the
// page, without ever spilling onto a second page. Operates on the same
// live .resume-paper element, so screen and export always agree.
function growResumeToFillPage() {
  if (Store.state.viewMode !== 'resume') return { grew: true };

  const doc = Store.active();
  const design = doc.design;
  const page = PAGE_SIZES_MM[design.pageSize] || PAGE_SIZES_MM.letter;
  // Aim just under a full page so growth never tips content onto a
  // second page — mirrors the safety buffer fitResumeToOnePage uses.
  const targetH = pxFromMm(page.h) * 0.97;
  const paper = el.resumePaper;

  let margin = Number(design.pageMarginY ?? design.pageMargin) || 2.5;
  let blockPad = Number(design.blockPad) ?? 0.5;
  let sectionGap = Number(design.sectionGap) ?? 1;
  let titleGap = Number(design.titleGap) ?? 0.2;
  let lineHeight = Number(design.lineHeight) || 1.45;
  let fontScale = Number(design.fontSize || 100) / 100;

  // Ceilings deliberately modest — this should read as "well-balanced
  // whitespace", never as a résumé stretched thin to fake a full page.
  const MAX_LH = 1.8;
  const MAX_TITLE_GAP = 0.6;
  const MAX_GAP = 2.2;
  const MAX_PAD = 1.1;
  const MAX_MARGIN = 4;
  const MAX_FONT = 1.12;

  const apply = () => {
    paper.style.setProperty('--rp-margin-y', margin + 'rem');
    paper.style.setProperty('--rp-block-pad', blockPad + 'rem');
    paper.style.setProperty('--rp-section-gap', sectionGap + 'rem');
    paper.style.setProperty('--rp-title-gap', titleGap + 'rem');
    paper.style.setProperty('--rp-line-height', lineHeight);
    paper.style.setProperty('--rp-font-scale', fontScale);
  };
  const height = () => { apply(); return paper.scrollHeight; };

  // Nothing to do if it already fills (or overflows) the page.
  if (height() >= targetH) return { grew: true };

  let guard = 0;
  while (height() < targetH && guard < 600) {
    guard++;
    let movedAnyLever = false;
    if (lineHeight < MAX_LH) { lineHeight = Math.min(MAX_LH, lineHeight + 0.015); movedAnyLever = true; }
    if (height() >= targetH) break;
    if (titleGap < MAX_TITLE_GAP) { titleGap = Math.min(MAX_TITLE_GAP, titleGap + 0.015); movedAnyLever = true; }
    if (height() >= targetH) break;
    if (sectionGap < MAX_GAP) { sectionGap = Math.min(MAX_GAP, sectionGap + 0.04); movedAnyLever = true; }
    if (height() >= targetH) break;
    if (blockPad < MAX_PAD) { blockPad = Math.min(MAX_PAD, blockPad + 0.02); movedAnyLever = true; }
    if (height() >= targetH) break;
    if (margin < MAX_MARGIN) { margin = Math.min(MAX_MARGIN, margin + 0.05); movedAnyLever = true; }
    if (height() >= targetH) break;
    // Font size only grows a little, and only once the roomier spacing
    // above is already maxed out — a slightly larger type size reads
    // as "well-designed", not "stretched".
    if (!movedAnyLever || (margin >= MAX_MARGIN && blockPad >= MAX_PAD && sectionGap >= MAX_GAP)) {
      if (fontScale < MAX_FONT) { fontScale = Math.min(MAX_FONT, fontScale + 0.01); movedAnyLever = true; }
    }
    if (!movedAnyLever) break; // every lever maxed out — stop
  }

  // If the last nudge overshot onto a second page, back off one notch
  // on whichever lever moved last so we land just under the page, not
  // just over it.
  if (height() > targetH) {
    if (fontScale > (Number(design.fontSize || 100) / 100)) fontScale = Math.max(1, fontScale - 0.01);
    else if (margin > (Number(design.pageMarginY ?? design.pageMargin) || 2.5)) margin -= 0.05;
    else if (blockPad > (Number(design.blockPad) ?? 0.5)) blockPad -= 0.02;
    else if (sectionGap > (Number(design.sectionGap) ?? 1)) sectionGap -= 0.04;
    else if (titleGap > (Number(design.titleGap) ?? 0.2)) titleGap -= 0.015;
    else if (lineHeight > (Number(design.lineHeight) || 1.45)) lineHeight -= 0.015;
    height();
  }

  margin = Math.round(margin * 100) / 100;
  blockPad = Math.round(blockPad * 100) / 100;
  sectionGap = Math.round(sectionGap * 100) / 100;
  titleGap = Math.round(titleGap * 100) / 100;
  lineHeight = Math.round(lineHeight * 100) / 100;
  fontScale = Math.round(fontScale * 1000) / 1000;

  design.pageMarginY = margin;
  design.blockPad = blockPad;
  design.sectionGap = sectionGap;
  design.titleGap = titleGap;
  design.lineHeight = lineHeight;
  design.fontSize = String(Math.round(fontScale * 100));
  Store.emit('design_changed', design);

  return { grew: true };
}

// ── Width compression ────────────────────────────────────────────
// Tightens *horizontal* margin only (--rp-margin-x), independent of
// the vertical margin the fit/grow functions above control, down to a
// sensible floor — this is the "fill the width" half of page balance.
// It deliberately never touches anything vertical itself; whichever
// caller runs this is responsible for re-running the length step
// afterward, since giving lines more width to work with can reflow
// text into fewer (or, rarely, more) lines and change content height.
const MIN_MARGIN_X = 1;
function compressResumeWidth() {
  if (Store.state.viewMode !== 'resume') return;
  const doc = Store.active();
  const design = doc.design;
  const paper = el.resumePaper;
  if (!paper) return;

  const currentX = Number(design.pageMarginX ?? design.pageMargin) || 2.5;
  if (currentX <= MIN_MARGIN_X + 0.01) return; // already tight

  design.pageMarginX = MIN_MARGIN_X;
  paper.style.setProperty('--rp-margin-x', MIN_MARGIN_X + 'rem');
  Store.emit('design_changed', design);
}

// ── Auto page balance ────────────────────────────────────────────
// Runs after every content/design change to a résumé:
//  1. Re-measure and shrink (fitResumeToOnePage) if content overflows
//     the page, or grow (growResumeToFillPage) if it's noticeably
//     short of filling it — length takes priority, since that's what
//     actually keeps the résumé on one page.
//  2. Only then compress unused width (tight horizontal margin; an
//     empty side column collapses to 0 via the .no-side-content CSS
//     rule/class toggled in renderActiveCanvas above) — this is what
//     previously showed up as a big dead strip down the right of the
//     page.
//  3. Re-measure once more: narrowing the margins in step 2 can
//     reflow lines and change content height, so the length step runs
//     again afterward to account for that.
// Screen and PDF export always agree since the export re-runs this
// same balance against the live element right before cloning it.
let autoBalanceTimer = null;
function scheduleAutoBalanceResumePage() {
  if (Store.state.viewMode !== 'resume') return;
  clearTimeout(autoBalanceTimer);
  autoBalanceTimer = setTimeout(runResumePageBalance, 450);
}
function runResumePageBalance() {
  const paper = el.resumePaper;
  if (!paper) return;
  const doc = Store.active();
  const page = PAGE_SIZES_MM[doc.design.pageSize] || PAGE_SIZES_MM.letter;
  const fullH = pxFromMm(page.h);
  const lengthPass = () => {
    const h = paper.scrollHeight;
    if (h > fullH * 0.995) {
      fitResumeToOnePage();
    } else if (h < fullH * 0.9) {
      growResumeToFillPage();
    }
  };
  lengthPass();
  compressResumeWidth();
  lengthPass();
}
Store.on('blocks_changed', scheduleAutoBalanceResumePage);
Store.on('profile_changed', scheduleAutoBalanceResumePage);
Store.on('template_changed', scheduleAutoBalanceResumePage);

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
  const eligible = lastSiteStatusData && lastSiteStatusData.status === 'live' && lastSiteStatusData.paid && username &&
    (!lastSiteStatusData.paidUntil || new Date(lastSiteStatusData.paidUntil).getTime() > Date.now());
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
  el.portfolioSite.setAttribute('data-dots-center', design.dotsCentering || 'slide');
  el.portfolioSite.setAttribute('data-dots-style', design.dotsStyle || 'dot');
  el.portfolioSite.setAttribute('data-dots-symbol', design.dotsSymbol || 'circle');
  el.portfolioSite.setAttribute('data-content-width', design.contentWidth || 'contained');
  el.portfolioSite.setAttribute('data-hero-align', design.heroAlign || 'left');
  el.portfolioSite.setAttribute('data-hero-photo-shape', design.heroPhotoShape || 'circle');
  el.portfolioSite.setAttribute('data-hero-photo-border', design.heroPhotoBorder === false ? '0' : '1');
  el.portfolioSite.setAttribute('data-hero-photo-size', design.heroPhotoSize || 'md');
  el.portfolioSite.setAttribute('data-hero-size', design.heroSize || 'normal');
  el.portfolioSite.style.setProperty('--pf-header-pct', design.headerHeightPct || 30);
  el.portfolioSite.style.setProperty('--pf-text-pad', (Number(design.textPaddingRem) || 0) + 'rem');
  el.portfolioSite.style.setProperty('--pf-line-height', LINE_SPACING_PRESETS[design.lineSpacing] || LINE_SPACING_PRESETS.normal);
  el.portfolioSite.style.setProperty('--pf-section-gap', SECTION_SPACING_PRESETS[design.sectionSpacing] || SECTION_SPACING_PRESETS.normal);
  el.portfolioSite.style.setProperty('--pf-card-pad', CARD_PADDING_PRESETS[design.cardPadding] || CARD_PADDING_PRESETS.normal);
  initPortfolioAnimation(design.sectionAnimation || 'none');
  syncPortfolioHeaderHeight();
}

// Keeps the horizontal/vertical mode's side dot rail (see .pf-slide-dots
// in portfolio.css) centered on the real space below the header, not an
// assumed one. The hero's min-height (--pf-header-pct) is only a
// target — a long name/tagline/contact line can wrap and push it
// taller — so the rail's CSS centering math reads the hero's actual
// measured height (--pf-header-real-h) instead of guessing from the
// target percentage. Re-runs via ResizeObserver whenever the hero's
// rendered size changes (content edits, re-render, window resize),
// same approach used in the published page's own script.
let portfolioHeaderHeightObserver = null;
function syncPortfolioHeaderHeight() {
  const hero = el.portfolioSite.querySelector('.pf-hero');
  if (!hero) return;
  const setH = () => el.portfolioSite.style.setProperty('--pf-header-real-h', hero.getBoundingClientRect().height + 'px');
  setH();
  if ('ResizeObserver' in window) {
    if (portfolioHeaderHeightObserver) portfolioHeaderHeightObserver.disconnect();
    portfolioHeaderHeightObserver = new ResizeObserver(setH);
    portfolioHeaderHeightObserver.observe(hero);
  }
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

  if (el.dotsCenteringGroup) {
    const pos = design.dotsPosition || 'right';
    el.dotsCenteringGroup.classList.toggle('hidden', pos !== 'left' && pos !== 'right');
  }

  if (el.dotsSymbolGroup) {
    el.dotsSymbolGroup.classList.toggle('hidden', (design.dotsStyle || 'dot') !== 'symbol');
  }

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
  if (el.inHeroPhotoBorder) el.inHeroPhotoBorder.checked = design.heroPhotoBorder !== false;

  const isTwoCol = Store.state.viewMode === 'resume' && String(design.layout) === '2';
  [el.colSplitGroup, el.colGapGroup, el.colBorderGroup].forEach(g => { if (g) g.classList.toggle('hidden', !isTwoCol); });

  if (el.inIncludePortfolioLink && Store.state.viewMode === 'resume') {
    const username = getSavedUsername();
    const eligible = !!(lastSiteStatusData && lastSiteStatusData.status === 'live' && lastSiteStatusData.paid && username &&
      (!lastSiteStatusData.paidUntil || new Date(lastSiteStatusData.paidUntil).getTime() > Date.now()));
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
  renderTemplateThumbnails();

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
  if (el.inHeroPhotoBorder) {
    el.inHeroPhotoBorder.addEventListener('change', (e) => Store.setDesign('heroPhotoBorder', e.target.checked));
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
// Called by the sidebar resizer drag: unlike forceCanvasRefit (which
// only ever shrinks a manually-zoomed-in view down if it no longer
// fits, but otherwise leaves it exactly as the person left it —
// including happily overlapping the canvas edges), adjusting the left
// column should always snap the preview back to the normal, fully
// spaced-out fit-to-window view, the same as clicking the zoom
// percentage label would.
let refitToFitOnLayoutChange = () => {};

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
  refitToFitOnLayoutChange = () => {
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
    // change — don't wait for ResizeObserver's own timing. Dragging
    // the left column always snaps the preview back to the normal
    // spaced-out fit-to-window view (even if it had been manually
    // zoomed in past the point of overlapping the canvas edges),
    // rather than just clamping a zoomed-in view down bit by bit.
    refitToFitOnLayoutChange();
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

  // Shown last, on top of the fully-rendered editor: a centered
  // "Sign in with Google" popup, since there is no local saving unless
  // you're signed in. Dismissible (cross it out) — it never blocks
  // editing, it just means nothing will persist until sign-in happens.
  maybeShowSignInOnLoad();
}

document.addEventListener('DOMContentLoaded', init);
