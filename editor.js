import { Store, esc, uid, TEMPLATES, FONT_STACKS, FONT_OPTIONS, BLOCK_LIBRARY } from './store.js';

// DOM Elements Cache
const el = {
  tabEditBtn: document.getElementById('tabEditBtn'),
  tabCustomizeBtn: document.getElementById('tabCustomizeBtn'),
  resumeTitle: document.getElementById('resumeTitle'),
  inJobTitle: document.getElementById('inJobTitle'),
  inFirstName: document.getElementById('inFirstName'),
  inLastName: document.getElementById('inLastName'),
  inEmail: document.getElementById('inEmail'),
  inPhone: document.getElementById('inPhone'),
  inAddress: document.getElementById('inAddress'),
  inPhoto: document.getElementById('inPhoto'),
  canvasName: document.getElementById('canvasName'),
  canvasJobTitle: document.getElementById('canvasJobTitle'),
  canvasContactLine: document.getElementById('canvasContactLine'),
  photoSidebarPreview: document.getElementById('photoSidebarPreview'),
  canvasPhotoWrap: document.getElementById('canvasPhotoWrap'),
  canvasPhotoImg: document.getElementById('canvasPhotoImg'),
  mainTrack: document.getElementById('mainTrack'),
  sideTrack: document.getElementById('sideTrack'),
  sidebarSectionsList: document.getElementById('sidebarSectionsList'),
  editorSidebar: document.getElementById('editorSidebar'),
  sidebarResizer: document.getElementById('sidebarResizer'),
  editorWorkspace: document.querySelector('.editor-workspace'),
  canvasWrap: document.getElementById('canvasWrap'),
  panelEdit: document.getElementById('panelEdit'),
  panelCustomize: document.getElementById('panelCustomize'),
  resumePaper: document.getElementById('resumePaper'),
  btnZoomIn: document.getElementById('btnZoomIn'),
  btnZoomOut: document.getElementById('btnZoomOut'),
  zoomLevelDisplay: document.getElementById('zoomLevelDisplay'),
  btnAddSection: document.getElementById('btnAddSection'),
  addSectionMenu: document.getElementById('addSectionMenu'),
  inAccentCustom: document.getElementById('inAccentCustom'),
  accentSwatchCustom: document.getElementById('accentSwatchCustom'),
  selHeadingFont: document.getElementById('selHeadingFont'),
  selBodyFont: document.getElementById('selBodyFont'),
  templateGallery: document.getElementById('templateGallery')
};

// ── 1. Dual-Binding Inputs Sync ──────────────────────────────
function initInputListeners() {
  const syncField = (inputEl, fieldName) => {
    inputEl.value = Store.state.profile[fieldName] || '';
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

  el.resumeTitle.addEventListener('input', (e) => {
    Store.updateTitle(e.target.textContent);
  });

  el.inPhoto.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      Store.updateProfile('photo', ev.target.result);
    };
    reader.readAsDataURL(file);
  });
}

// ── 2. Targeted Repaint Listeners (No innerHTML destruction) ──
Store.on('profile_changed', (profile) => {
  el.canvasName.textContent = `${profile.firstName} ${profile.lastName}`.trim() || 'Untitled Profile';
  el.canvasJobTitle.textContent = profile.jobTitle;

  // Format dynamic line safely
  const parts = [profile.email, profile.phone, profile.address].filter(Boolean);
  el.canvasContactLine.textContent = parts.join('   •   ');

  if (profile.photo) {
    el.photoSidebarPreview.style.backgroundImage = `url(${profile.photo})`;
    el.canvasPhotoImg.src = profile.photo;
    el.canvasPhotoWrap.classList.remove('hidden');
  } else {
    el.photoSidebarPreview.style.backgroundImage = '';
    el.canvasPhotoWrap.classList.add('hidden');
  }
});

// ── 3. Component Rendering via DOM Nodes ────────────────────
// Small helper: a contenteditable text span bound back to the store.
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
  // cols: array of {key, cls} describing each editable column of the row
  const rows = (items || []).map((it, i) => `
    <div class="rb-entry-row">
      ${cols.map(c => ceField(it[c.key] || '', field, blockId, { index: i, subfield: c.key, cls: c.cls })).join('')}
      <button class="li-remove-btn" data-action="remove-item" data-block="${blockId}" data-field="${field}" data-index="${i}" title="Remove" type="button">✕</button>
    </div>`).join('');
  return `<div class="rb-entry-list">${rows}</div>
    <button class="add-item-btn" data-action="add-item" data-block="${blockId}" data-field="${field}" data-item-type="object" type="button">+ Add</button>`;
}

function createDOMBlock(block) {
  const wrapper = document.createElement('div');
  wrapper.className = `resume-block block-${block.type}`;
  wrapper.dataset.id = block.id;
  if (Store.state.selectedBlockId === block.id) wrapper.classList.add('selected');

  let innerHTML = '';
  switch (block.type) {
    case 'section':
      innerHTML = `<h2 class="rb-section-title">${ceField(block.data.title, 'title', block.id)}</h2>`;
      break;
    case 'summary':
      innerHTML = `<p class="rb-summary-text">${ceField(block.data.text, 'text', block.id, { cls: 'ce-block' })}</p>`;
      break;
    case 'custom':
      innerHTML = `
        <h3 class="rb-custom-title">${ceField(block.data.title, 'title', block.id)}</h3>
        <p class="rb-summary-text">${ceField(block.data.text, 'text', block.id, { cls: 'ce-block' })}</p>`;
      break;
    case 'experience':
      innerHTML = `
        <div class="rb-experience">
          <div class="rb-exp-row">
            <span class="rb-company">${ceField(block.data.company, 'company', block.id)}</span>
            <span class="rb-dates">${ceField(block.data.dates, 'dates', block.id)}</span>
          </div>
          <div class="rb-exp-row">
            <span class="rb-role">${ceField(block.data.role, 'role', block.id)}</span>
            <span class="rb-loc">${ceField(block.data.location, 'location', block.id)}</span>
          </div>
          ${renderBulletList(block.data.bullets, block.id, 'bullets')}
        </div>`;
      break;
    case 'education':
      innerHTML = `
        <div class="rb-education">
          <div class="rb-edu-row">
            <span class="rb-edu-school">${ceField(block.data.school, 'school', block.id)}</span>
            <span class="rb-dates">${ceField(block.data.year, 'year', block.id)}</span>
          </div>
          <div class="rb-edu-row">
            <span class="rb-edu-degree">${ceField(block.data.degree, 'degree', block.id)}</span>
            <span class="rb-loc">${ceField(block.data.location, 'location', block.id)}</span>
          </div>
          <div class="rb-edu-gpa">${ceField(block.data.gpa, 'gpa', block.id)}</div>
        </div>`;
      break;
    case 'projects':
      innerHTML = `
        <div class="rb-experience">
          <div class="rb-exp-row">
            <span class="rb-company">${ceField(block.data.name, 'name', block.id)}</span>
            <span class="rb-dates">${ceField(block.data.dates, 'dates', block.id)}</span>
          </div>
          <div class="rb-exp-row"><span class="rb-role">${ceField(block.data.description, 'description', block.id)}</span></div>
          ${renderBulletList(block.data.bullets, block.id, 'bullets')}
        </div>`;
      break;
    case 'skills':
      innerHTML = renderSkillTags(block.data.items, block.id, 'items');
      break;
    case 'certifications':
      innerHTML = renderEntryList(block.data.items, block.id, 'items', [
        { key: 'name', cls: 'ce-strong' }, { key: 'issuer', cls: 'ce-muted' }, { key: 'date', cls: 'ce-muted' }
      ]);
      break;
    case 'languages':
      innerHTML = renderEntryList(block.data.items, block.id, 'items', [
        { key: 'name', cls: 'ce-strong' }, { key: 'level', cls: 'ce-muted' }
      ]);
      break;
    default:
      break;
  }

  wrapper.innerHTML = innerHTML;
  return wrapper;
}

// Render loop handles appending node elements directly
Store.on('blocks_changed', (blocks) => {
  el.mainTrack.innerHTML = '';
  el.sideTrack.innerHTML = '';

  blocks.forEach(block => {
    const blockEl = createDOMBlock(block);
    if (block.col === 'side') {
      el.sideTrack.appendChild(blockEl);
    } else {
      el.mainTrack.appendChild(blockEl);
    }
  });
  renderSidebarList(blocks);
});

// Reflect block selection with a lightweight class toggle (no re-render,
// so it never disturbs a field mid-edit).
Store.on('selection_changed', (id) => {
  document.querySelectorAll('.resume-block.selected, .sd-section-item.selected').forEach(n => n.classList.remove('selected'));
  if (id) {
    document.querySelectorAll(`[data-id="${id}"]`).forEach(n => n.classList.add('selected'));
  }
});

// ── 3b. Canvas-level delegated events: field sync + list actions ─
function handleFieldSync(e) {
  const target = e.target;
  if (!target.matches('[data-field]')) return;
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
    if (actionBtn.dataset.action === 'add-item') {
      Store.addListItem(blockId, field, actionBtn.dataset.itemType === 'object' ? {} : '');
    } else if (actionBtn.dataset.action === 'remove-item') {
      Store.removeListItem(blockId, field, Number(actionBtn.dataset.index));
    }
    return;
  }
  const blockEl = e.target.closest('.resume-block');
  if (blockEl) Store.setSelectedBlock(blockEl.dataset.id);
}

function initCanvasDelegation() {
  [el.mainTrack, el.sideTrack].forEach(track => {
    track.addEventListener('focusout', handleFieldSync);
    track.addEventListener('click', handleTrackClick);
  });
}

// ── 4. Sidebar Controller Component ──────────────────────────
function renderSidebarList(blocks) {
  el.sidebarSectionsList.innerHTML = '';
  const twoCol = Store.state.design.layout === '2';

  blocks.forEach(block => {
    const item = document.createElement('div');
    item.className = 'sd-section-item';
    item.dataset.id = block.id;
    if (Store.state.selectedBlockId === block.id) item.classList.add('selected');
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

    const swapBtn = twoCol
      ? `<button class="sd-icon-btn sd-swap-btn" data-action="swap" data-id="${block.id}" title="Move to ${block.col === 'side' ? 'main column' : 'sidebar'}" type="button">${block.col === 'side' ? '⇤' : '⇥'}</button>`
      : '';

    item.innerHTML = `
      <div class="sd-item-header">
        <span class="sd-drag-handle">☰</span>
        <span class="sd-title-text">${esc(titleText)}</span>
        <span class="sd-item-actions">
          ${swapBtn}
          <button class="sd-icon-btn sd-delete-btn" data-action="delete" data-id="${block.id}" title="Delete section" type="button">✕</button>
        </span>
      </div>
    `;
    el.sidebarSectionsList.appendChild(item);
  });

  initSectionDragReorder();
}

// ── 4b. Sidebar item selection + actions (delegated once) ─────
function initSidebarActions() {
  el.sidebarSectionsList.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      const id = actionBtn.dataset.id;
      if (actionBtn.dataset.action === 'delete') {
        if (confirm('Remove this section from your résumé?')) Store.removeBlock(id);
      } else if (actionBtn.dataset.action === 'swap') {
        const block = Store.state.blocks.find(b => b.id === id);
        if (block) Store.setBlockColumn(id, block.col === 'side' ? 'main' : 'side');
      }
      return;
    }
    const item = e.target.closest('.sd-section-item');
    if (item) Store.setSelectedBlock(item.dataset.id);
  });
}

// ── 4c. Add-section popover ────────────────────────────────────
function initAddSectionMenu() {
  el.addSectionMenu.innerHTML = BLOCK_LIBRARY.map(item =>
    `<button class="add-section-item" data-type="${item.type}" type="button">${esc(item.label)}</button>`
  ).join('');

  el.btnAddSection.addEventListener('click', (e) => {
    e.stopPropagation();
    el.addSectionMenu.classList.toggle('hidden');
  });

  el.addSectionMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-type]');
    if (!btn) return;
    Store.addBlock(btn.dataset.type, 'main');
    el.addSectionMenu.classList.add('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!el.addSectionMenu.classList.contains('hidden') && !e.target.closest('.add-section-wrap')) {
      el.addSectionMenu.classList.add('hidden');
    }
  });
}

// ── 4d. Drag-to-reorder for the sections list ─────────────────
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

      const blocks = [...Store.state.blocks];
      const fromIndex = blocks.findIndex(b => b.id === draggedId);
      const toIndex = blocks.findIndex(b => b.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return;

      const [moved] = blocks.splice(fromIndex, 1);
      blocks.splice(toIndex, 0, moved);
      Store.setBlocks(blocks);
    });
  });
}

// ── 5. Toolbar Actions Initialization ────────────────────────
function initToolbar() {
  el.tabEditBtn.addEventListener('click', () => Store.setMode('edit'));
  el.tabCustomizeBtn.addEventListener('click', () => Store.setMode('customize'));

  document.getElementById('btnDownloadPDF').addEventListener('click', () => alert('Generating dynamic vector PDF...'));
  document.getElementById('btnOpenPortfolio').addEventListener('click', () => alert('Serving instance onto john.proves.work'));
}

// ── 5b. Edit / Customize panel switching ──────────────────────
Store.on('mode_changed', (mode) => {
  el.tabEditBtn.classList.toggle('active', mode === 'edit');
  el.tabCustomizeBtn.classList.toggle('active', mode === 'customize');
  el.panelEdit.classList.toggle('active', mode === 'edit');
  el.panelCustomize.classList.toggle('active', mode === 'customize');
});

// ── 6. Collapsible form sections (e.g. "Personal Details") ────
function initFormSectionToggles() {
  document.querySelectorAll('.form-section-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      toggle.closest('.form-section').classList.toggle('active');
    });
  });
}

// ── 7. Customize panel: templates, layout, color, font, text ──
function populateFontSelects() {
  const opts = FONT_OPTIONS.map(f => `<option value="${f.id}">${esc(f.label)}</option>`).join('');
  el.selHeadingFont.innerHTML = opts;
  el.selBodyFont.innerHTML = opts;
}

function applyDesign(design) {
  el.resumePaper.setAttribute('data-template', Store.state.template);
  el.resumePaper.setAttribute('data-layout', design.layout);
  el.resumePaper.setAttribute('data-header-align', design.headerAlign);
  el.resumePaper.setAttribute('data-date-align', design.dateAlign);
  el.resumePaper.setAttribute('data-title-style', design.titleStyle);
  el.resumePaper.style.setProperty('--rp-accent', design.accent);
  el.resumePaper.style.setProperty('--rp-heading-font', FONT_STACKS[design.headingFont] || FONT_STACKS.sans);
  el.resumePaper.style.setProperty('--rp-body-font', FONT_STACKS[design.bodyFont] || FONT_STACKS.sans);
  el.resumePaper.style.setProperty('--rp-font-scale', Number(design.fontSize) / 100);
  el.resumePaper.style.setProperty('--rp-line-height', design.lineHeight === 'compact' ? '1.25' : design.lineHeight === 'relaxed' ? '1.7' : '1.45');
  syncCustomizeControls(design);
  // A layout switch changes whether the sidebar swap icon is shown.
  renderSidebarList(Store.state.blocks);
}

function syncCustomizeControls(design) {
  document.querySelectorAll('.option-pill-row[data-target]').forEach(row => {
    const key = row.dataset.target;
    row.querySelectorAll('.option-pill').forEach(p => {
      p.classList.toggle('active', String(p.dataset.value) === String(design[key]));
    });
  });

  const knownSwatches = Array.from(document.querySelectorAll('#optAccentColor .color-swatch[data-value]'));
  let matched = false;
  knownSwatches.forEach(sw => {
    const isMatch = sw.dataset.value.toLowerCase() === design.accent.toLowerCase();
    sw.classList.toggle('active', isMatch);
    if (isMatch) matched = true;
  });
  el.accentSwatchCustom.classList.toggle('active', !matched);
  el.inAccentCustom.value = design.accent;

  el.selHeadingFont.value = design.headingFont;
  el.selBodyFont.value = design.bodyFont;

  document.querySelectorAll('.template-card[data-template]').forEach(card => {
    card.classList.toggle('active', card.dataset.template === Store.state.template);
  });
}

function initCustomizePanel() {
  populateFontSelects();

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

  document.querySelectorAll('.template-card[data-template]').forEach(card => {
    card.addEventListener('click', () => Store.setTemplate(card.dataset.template));
  });

  Store.on('design_changed', applyDesign);
}

// ── 8. Zoom controls ────────────────────────────────────────
function initZoomControls() {
  const MIN_ZOOM = 50;
  const MAX_ZOOM = 150;
  const STEP = 10;
  let zoom = 100;

  const applyZoom = () => {
    el.resumePaper.style.transform = `scale(${zoom / 100})`;
    el.zoomLevelDisplay.textContent = `${zoom}%`;
    el.btnZoomOut.disabled = zoom <= MIN_ZOOM;
    el.btnZoomIn.disabled = zoom >= MAX_ZOOM;
  };

  el.btnZoomIn.addEventListener('click', () => {
    zoom = Math.min(MAX_ZOOM, zoom + STEP);
    applyZoom();
  });

  el.btnZoomOut.addEventListener('click', () => {
    zoom = Math.max(MIN_ZOOM, zoom - STEP);
    applyZoom();
  });

  el.zoomLevelDisplay.addEventListener('click', () => {
    zoom = 100;
    applyZoom();
  });

  // Ctrl (or Cmd, on trackpad pinch) + scroll over the preview zooms
  // it in/out instead of scrolling the page.
  el.canvasWrap.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoom = e.deltaY < 0
      ? Math.min(MAX_ZOOM, zoom + STEP)
      : Math.max(MIN_ZOOM, zoom - STEP);
    applyZoom();
  }, { passive: false });

  applyZoom();
}

// ── 9. Sidebar Resizer (25% – 50% of workspace width) ────────
function initSidebarResizer() {
  const MIN_PCT = 25;
  const MAX_PCT = 50;
  const CANVAS_MIN_PX = 360; // keep the canvas wide enough that the preview never crowds the resizer
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
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    el.sidebarResizer.classList.remove('is-dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  });
}

// Application bootstrapping
function init() {
  initInputListeners();
  initToolbar();
  initSidebarResizer();
  initFormSectionToggles();
  initCustomizePanel();
  initZoomControls();
  initCanvasDelegation();
  initSidebarActions();
  initAddSectionMenu();

  // Set initial trigger events
  Store.emit('profile_changed', Store.state.profile);
  Store.emit('blocks_changed', Store.state.blocks);
  Store.emit('mode_changed', Store.state.mode);
  Store.emit('design_changed', Store.state.design);
}

document.addEventListener('DOMContentLoaded', init);
