import { Store, esc, uid } from './store.js';

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
  panelEdit: document.getElementById('panelEdit'),
  panelCustomize: document.getElementById('panelCustomize'),
  resumePaper: document.getElementById('resumePaper'),
  btnZoomIn: document.getElementById('btnZoomIn'),
  btnZoomOut: document.getElementById('btnZoomOut'),
  zoomLevelDisplay: document.getElementById('zoomLevelDisplay')
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
function createDOMBlock(block) {
  const wrapper = document.createElement('div');
  wrapper.className = `resume-block block-${block.type}`;
  wrapper.dataset.id = block.id;
  if (Store.state.selectedBlockId === block.id) wrapper.classList.add('selected');

  wrapper.addEventListener('click', (e) => {
    e.stopPropagation();
    Store.setSelectedBlock(block.id);
  });

  let innerHTML = '';
  switch (block.type) {
    case 'section':
      innerHTML = `<h2 class="rb-section-title">${esc(block.data.title)}</h2>`;
      break;
    case 'experience':
      innerHTML = `
        <div class="rb-experience">
          <div class="rb-exp-row">
            <span class="rb-company">${esc(block.data.company)}</span>
            <span class="rb-dates">${esc(block.data.dates)}</span>
          </div>
          <div class="rb-exp-row">
            <span class="rb-role">${esc(block.data.role)}</span>
            <span class="rb-loc">${esc(block.data.location)}</span>
          </div>
          <ul class="rb-bullets">
            ${(block.data.bullets || []).map(b => `<li>${esc(b)}</li>`).join('')}
          </ul>
        </div>`;
      break;
    case 'education':
      innerHTML = `
        <div class="rb-education">
          <div class="rb-edu-row">
            <span class="rb-edu-school">${esc(block.data.school)}</span>
            <span class="rb-dates">${esc(block.data.year)}</span>
          </div>
          <div class="rb-edu-row">
            <span class="rb-edu-degree">${esc(block.data.degree)}</span>
            <span class="rb-loc">${esc(block.data.location)}</span>
          </div>
          <div class="rb-edu-gpa">${esc(block.data.gpa)}</div>
        </div>`;
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

// ── 4. Sidebar Controller Component ──────────────────────────
function renderSidebarList(blocks) {
  el.sidebarSectionsList.innerHTML = '';
  
  blocks.forEach(block => {
    const item = document.createElement('div');
    item.className = 'sd-section-item';
    item.dataset.id = block.id;
    item.draggable = true;
    
    let titleText = block.type.toUpperCase();
    if (block.type === 'section') titleText = `Heading: ${block.data.title}`;
    if (block.type === 'experience') titleText = block.data.company || 'Job Position';
    if (block.type === 'education') titleText = block.data.school || 'Academic Degree';

    item.innerHTML = `
      <div class="sd-item-header">
        <span class="sd-drag-handle">☰</span>
        <span class="sd-title-text">${esc(titleText)}</span>
      </div>
    `;
    el.sidebarSectionsList.appendChild(item);
  });

  initSectionDragReorder();
}

// ── 4b. Drag-to-reorder for the sections list ─────────────────
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

// ── 7. Customize panel: layout / alignment option pills ───────
function initCustomizePanel() {
  document.querySelectorAll('.option-pill-row').forEach(row => {
    const attr = row.dataset.target === 'layout' ? 'data-layout'
      : row.dataset.target === 'headerAlign' ? 'data-header-align'
      : 'data-date-align';

    row.querySelectorAll('.option-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        row.querySelectorAll('.option-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        el.resumePaper.setAttribute(attr, pill.dataset.value);
      });
    });
  });
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

  applyZoom();
}

// ── 6. Sidebar Resizer (25% – 50% of workspace width) ────────
function initSidebarResizer() {
  const MIN_PCT = 25;
  const MAX_PCT = 50;
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
    pct = Math.min(MAX_PCT, Math.max(MIN_PCT, pct));
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
  
  // Set initial trigger events
  Store.emit('profile_changed', Store.state.profile);
  Store.emit('blocks_changed', Store.state.blocks);
  Store.emit('mode_changed', Store.state.mode);
}

document.addEventListener('DOMContentLoaded', init);