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
  sidebarSectionsList: document.getElementById('sidebarSectionsList')
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
}

// ── 5. Toolbar Actions Initialization ────────────────────────
function initToolbar() {
  el.tabEditBtn.addEventListener('click', () => Store.setMode('edit'));
  el.tabCustomizeBtn.addEventListener('click', () => Store.setMode('customize'));
  
  document.getElementById('btnDownloadPDF').addEventListener('click', () => alert('Generating dynamic vector PDF...'));
  document.getElementById('btnOpenPortfolio').addEventListener('click', () => alert('Serving instance onto john.proves.work'));
}

// Application bootstrapping
function init() {
  initInputListeners();
  initToolbar();
  
  // Set initial trigger events
  Store.emit('profile_changed', Store.state.profile);
  Store.emit('blocks_changed', Store.state.blocks);
}

document.addEventListener('DOMContentLoaded', init);