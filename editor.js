import { Store, esc, uid, TEMPLATES, FONT_STACKS, FONT_OPTIONS, BLOCK_LIBRARY } from './store.js';

// ── DOM Elements Cache ───────────────────────────────────────
const el = {
  tabPortfolioBtn: document.getElementById('tabPortfolioBtn'),
  tabResumeBtn: document.getElementById('tabResumeBtn'),
  tabEditBtn: document.getElementById('tabEditBtn'),
  tabCustomizeBtn: document.getElementById('tabCustomizeBtn'),
  docTitle: document.getElementById('docTitle'),
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
  pfFooterName: document.getElementById('pfFooterName'),

  sidebarSectionsList: document.getElementById('sidebarSectionsList'),
  editorSidebar: document.getElementById('editorSidebar'),
  sidebarResizer: document.getElementById('sidebarResizer'),
  editorWorkspace: document.querySelector('.editor-workspace'),
  canvasWrap: document.getElementById('canvasWrap'),
  canvasZoomTarget: document.getElementById('canvasZoomTarget'),
  panelEdit: document.getElementById('panelEdit'),
  panelCustomize: document.getElementById('panelCustomize'),
  btnZoomIn: document.getElementById('btnZoomIn'),
  btnZoomOut: document.getElementById('btnZoomOut'),
  zoomLevelDisplay: document.getElementById('zoomLevelDisplay'),
  btnAddSection: document.getElementById('btnAddSection'),
  addSectionMenu: document.getElementById('addSectionMenu'),
  inAccentCustom: document.getElementById('inAccentCustom'),
  accentSwatchCustom: document.getElementById('accentSwatchCustom'),
  selHeadingFont: document.getElementById('selHeadingFont'),
  selBodyFont: document.getElementById('selBodyFont'),
  templateGallery: document.getElementById('templateGallery'),

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
    el.pfFooterName.textContent = fullName;
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

function verifyControlHTML(block) {
  const v = block.data.verify || { type: 'none' };
  if (v.type !== 'none') {
    const labelText = v.label || (v.type === 'photo' ? 'View proof' : 'View link');
    return `
      <button class="pf-verify-badge" data-action="view-verify" data-block="${block.id}" type="button">✓ Verified <span class="pf-verify-label">${esc(labelText)}</span></button>
      <button class="pf-verify-edit" data-action="edit-verify" data-block="${block.id}" title="Edit verification" type="button">✎</button>`;
  }
  return `<button class="pf-verify-add" data-action="edit-verify" data-block="${block.id}" type="button">+ Add proof</button>`;
}

// ── 3a. RESUME / PDF block renderer (paper-style, unchanged look) ─
function createResumeBlock(block) {
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

// ── 3b. PORTFOLIO SITE block renderer (cards + verification) ─────
function createPortfolioBlock(block) {
  const wrapper = document.createElement('div');
  wrapper.dataset.id = block.id;
  if (Store.state.selectedBlockId === block.id) wrapper.classList.add('selected');

  switch (block.type) {
    case 'section':
      wrapper.className = 'pf-block-section-title';
      wrapper.innerHTML = ceField(block.data.title, 'title', block.id);
      break;
    case 'summary':
      wrapper.className = 'pf-card pf-summary-card';
      wrapper.innerHTML = ceField(block.data.text, 'text', block.id, { cls: 'ce-block' });
      break;
    case 'custom':
      wrapper.className = 'pf-card';
      wrapper.innerHTML = `
        <h3 class="pf-exp-company">${ceField(block.data.title, 'title', block.id)}</h3>
        <p>${ceField(block.data.text, 'text', block.id, { cls: 'ce-block' })}</p>`;
      break;
    case 'experience':
      wrapper.className = 'pf-card';
      wrapper.innerHTML = `
        <div class="pf-exp-top-row">
          <span class="pf-exp-company">${ceField(block.data.company, 'company', block.id)}</span>
          <span class="pf-exp-dates">${ceField(block.data.dates, 'dates', block.id)}</span>
        </div>
        <div class="pf-exp-sub-row">
          <span>${ceField(block.data.role, 'role', block.id)}</span>
          <span>${ceField(block.data.location, 'location', block.id)}</span>
        </div>
        ${renderBulletList(block.data.bullets, block.id, 'bullets')}
        <div class="pf-verify">${verifyControlHTML(block)}</div>`;
      break;
    case 'education':
      wrapper.className = 'pf-card pf-edu-card';
      wrapper.innerHTML = `
        <div class="pf-exp-top-row">
          <span class="pf-exp-company">${ceField(block.data.school, 'school', block.id)}</span>
          <span class="pf-exp-dates">${ceField(block.data.year, 'year', block.id)}</span>
        </div>
        <div class="pf-exp-sub-row">
          <span>${ceField(block.data.degree, 'degree', block.id)}</span>
          <span>${ceField(block.data.location, 'location', block.id)}</span>
        </div>
        <div class="pf-edu-gpa">${ceField(block.data.gpa, 'gpa', block.id)}</div>`;
      break;
    case 'projects':
      wrapper.className = 'pf-card';
      wrapper.innerHTML = `
        <div class="pf-exp-top-row">
          <span class="pf-exp-company">${ceField(block.data.name, 'name', block.id)}</span>
          <span class="pf-exp-dates">${ceField(block.data.dates, 'dates', block.id)}</span>
        </div>
        <div class="pf-exp-sub-row"><span>${ceField(block.data.description, 'description', block.id)}</span></div>
        ${renderBulletList(block.data.bullets, block.id, 'bullets')}`;
      break;
    case 'skills':
      wrapper.className = 'pf-card';
      wrapper.innerHTML = renderSkillTags(block.data.items, block.id, 'items');
      break;
    case 'certifications':
      wrapper.className = 'pf-card';
      wrapper.innerHTML = renderEntryList(block.data.items, block.id, 'items', [
        { key: 'name', cls: 'ce-strong' }, { key: 'issuer', cls: 'ce-muted' }, { key: 'date', cls: 'ce-muted' }
      ]);
      break;
    case 'languages':
      wrapper.className = 'pf-card';
      wrapper.innerHTML = renderEntryList(block.data.items, block.id, 'items', [
        { key: 'name', cls: 'ce-strong' }, { key: 'level', cls: 'ce-muted' }
      ]);
      break;
    default:
      break;
  }
  return wrapper;
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
    el.pfSections.innerHTML = '';
    blocks.forEach(block => el.pfSections.appendChild(createPortfolioBlock(block)));
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
    const action = actionBtn.dataset.action;
    if (action === 'add-item') {
      Store.addListItem(blockId, field, actionBtn.dataset.itemType === 'object' ? {} : '');
    } else if (action === 'remove-item') {
      Store.removeListItem(blockId, field, Number(actionBtn.dataset.index));
    } else if (action === 'view-verify') {
      openVerifyViewModal(blockId);
    } else if (action === 'edit-verify') {
      openVerifyEditModal(blockId);
    }
    return;
  }
  const blockEl = e.target.closest('.resume-block, .pf-card, .pf-block-section-title');
  if (blockEl) Store.setSelectedBlock(blockEl.dataset.id);
}

function initCanvasDelegation() {
  [el.mainTrack, el.sideTrack, el.pfSections].forEach(track => {
    track.addEventListener('focusout', handleFieldSync);
    track.addEventListener('click', handleTrackClick);
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

// ── 4a. Verification: view proof ──────────────────────────────
function openVerifyViewModal(blockId) {
  const block = Store.active().blocks.find(b => b.id === blockId);
  if (!block) return;
  const v = block.data.verify || { type: 'none' };

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
function openVerifyEditModal(blockId) {
  const block = Store.active().blocks.find(b => b.id === blockId);
  if (!block) return;
  const v = block.data.verify || { type: 'none', photo: null, link: '', label: '' };

  let currentType = v.type === 'none' ? 'photo' : v.type;
  let pendingPhoto = v.photo || null;

  const html = `
    <h3 class="modal-title" id="modalTitle">Verify this experience</h3>
    <p class="modal-sub">Attach a photo (certificate, badge, ID) or a link (LinkedIn post, reference, article) so visitors can confirm this role really happened.</p>
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
        Store.clearVerify(blockId);
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

      Store.updateVerify(blockId, 'type', currentType);
      if (currentType === 'photo') Store.updateVerify(blockId, 'photo', pendingPhoto);
      else Store.updateVerify(blockId, 'link', link);
      Store.updateVerify(blockId, 'label', label);
      closeModal();
    });
  });
}

// ── 4c. Publishing to <username>.proves.work ───────────────────
// Talks to the Cloudflare Worker in /worker (see worker/README.md).
// Relative paths — works as long as the editor itself is served from
// proves.work (or www.proves.work), since that's the only host the
// Worker's /api/* route is attached to.
const PUBLISH_TOKEN_KEY = 'proveswork_publish_token';
const PUBLISH_USERNAME_KEY = 'proveswork_username';

function getPublishToken() {
  let token = localStorage.getItem(PUBLISH_TOKEN_KEY);
  if (!token) {
    token = 'tok_' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : String(Math.random()).slice(2) + Date.now());
    localStorage.setItem(PUBLISH_TOKEN_KEY, token);
  }
  return token;
}

function getSavedUsername() {
  return localStorage.getItem(PUBLISH_USERNAME_KEY) || '';
}

function saveUsername(u) {
  localStorage.setItem(PUBLISH_USERNAME_KEY, u);
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
`;

// Plain-HTML (no contenteditable, no editor chrome) render of a single
// portfolio block, for the published static snapshot.
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
        verifyHTML = `<button class="pf-verify-badge" data-verify-type="photo" data-verify-photo="${esc(v.photo)}" data-verify-label="${esc(v.label || 'View proof')}" type="button">✓ Verified <span class="pf-verify-label">${esc(v.label || 'View proof')}</span></button>`;
      } else if (v.type === 'link' && v.link) {
        const safeHref = /^https?:\/\//i.test(v.link) ? v.link : `https://${v.link}`;
        verifyHTML = `<button class="pf-verify-badge" data-verify-type="link" data-verify-link="${esc(safeHref)}" data-verify-label="${esc(v.label || 'View link')}" type="button">✓ Verified <span class="pf-verify-label">${esc(v.label || 'View link')}</span></button>`;
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
    default:
      return '';
  }
}

// Builds a complete, standalone HTML document for the published site.
// Always snapshots state.portfolio — publishing never reads from the
// résumé/PDF document.
function buildPublishedSiteHTML() {
  const p = Store.state.portfolio.profile;
  const design = Store.state.portfolio.design;
  const blocks = Store.state.portfolio.blocks;
  const fullName = `${p.firstName} ${p.lastName}`.trim() || 'Untitled Portfolio';
  const contactLine = [p.email, p.phone, p.address].filter(Boolean).join('   •   ');
  const sectionsHTML = blocks.map(renderStaticPortfolioBlock).join('\n');

  return `<!DOCTYPE html>
<html lang="en" data-theme="dazed">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(fullName)}${p.jobTitle ? ' — ' + esc(p.jobTitle) : ''}</title>
<meta name="description" content="${esc(p.tagline || (fullName + ' — portfolio, built with proves.work'))}" />
<link rel="stylesheet" href="https://proves.work/dazed.css" />
<link rel="stylesheet" href="https://proves.work/portfolio.css" />
<style>
  body { margin: 0; background: var(--color-background, #FDF7FA); }
  .portfolio-site { width: 100%; max-width: 100%; border: none; box-shadow: none; }
  .pf-sections { max-width: 780px; margin: 0 auto; }
</style>
</head>
<body data-viewmode="portfolio">
  <div class="portfolio-site" id="portfolioSite" style="--pf-accent:${esc(design.accent)};--pf-heading-font:${esc(FONT_STACKS[design.headingFont] || FONT_STACKS.modern)};--pf-body-font:${esc(FONT_STACKS[design.bodyFont] || FONT_STACKS.sans)};">
    <header class="pf-hero">
      ${p.photo ? `<div class="pf-hero-photo-wrap"><img src="${esc(p.photo)}" alt="${esc(fullName)}" /></div>` : ''}
      <div class="pf-hero-text">
        <h1 class="pf-name">${esc(fullName)}</h1>
        ${p.jobTitle ? `<div class="pf-jobtitle">${esc(p.jobTitle)}</div>` : ''}
        ${p.tagline ? `<p class="pf-tagline">${esc(p.tagline)}</p>` : ''}
        ${contactLine ? `<div class="pf-contact-line">${esc(contactLine)}</div>` : ''}
      </div>
    </header>
    <div class="pf-sections">${sectionsHTML}</div>
    <footer class="pf-footer">${esc(fullName)} · built with <a href="https://proves.work">proves.work</a></footer>
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

function openPublishModal() {
  const p = Store.state.portfolio.profile;
  const defaultUsername = getSavedUsername() || slugifyUsername(`${p.firstName}${p.lastName}`) || 'me';

  const html = `
    <h3 class="modal-title" id="modalTitle">Publish your portfolio</h3>
    <p class="modal-sub">Pick the address where your portfolio will live. You can change this later — this only affects your portfolio, never your résumé/PDF document.</p>
    <div class="field-box full-width">
      <span>Your proves.work address</span>
      <div class="username-input-row">
        <input type="text" id="publishUsernameInput" value="${esc(defaultUsername)}" maxlength="30" autocomplete="off" spellcheck="false" />
        <span class="username-suffix">.proves.work</span>
      </div>
      <p class="username-status" id="publishUsernameStatus"></p>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary btn-sm" id="publishConfirmBtn" type="button" disabled>Publish</button>
    </div>
  `;

  openModal(html, (root) => {
    const input = root.querySelector('#publishUsernameInput');
    const status = root.querySelector('#publishUsernameStatus');
    const confirmBtn = root.querySelector('#publishConfirmBtn');
    let checkTimer = null;

    async function checkAvailability() {
      const value = slugifyUsername(input.value);
      if (input.value !== value) input.value = value;

      if (value.length < 3) {
        status.textContent = 'Must be at least 3 characters.';
        status.className = 'username-status warn';
        confirmBtn.disabled = true;
        return;
      }
      status.textContent = 'Checking availability…';
      status.className = 'username-status';
      try {
        const res = await fetch(`/api/check-username?u=${encodeURIComponent(value)}`);
        const data = await res.json();
        if (data.available) {
          status.textContent = `✓ ${value}.proves.work is available`;
          status.className = 'username-status ok';
          confirmBtn.disabled = false;
        } else {
          status.textContent = data.reason === 'invalid'
            ? 'That name is reserved or has invalid characters.'
            : `${value}.proves.work is already taken.`;
          status.className = 'username-status warn';
          confirmBtn.disabled = true;
        }
      } catch (err) {
        status.textContent = 'Could not check availability right now — you can still try publishing.';
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

    confirmBtn.addEventListener('click', async () => {
      const username = slugifyUsername(input.value);
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Publishing…';
      try {
        const res = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username, token: getPublishToken(), html: buildPublishedSiteHTML() })
        });
        const data = await res.json();
        if (!data.ok) {
          status.textContent = data.error || 'Something went wrong.';
          status.className = 'username-status warn';
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Publish';
          return;
        }
        saveUsername(username);
        openPublishSuccessModal(data.url);
      } catch (err) {
        status.textContent = 'Network error — please try again.';
        status.className = 'username-status warn';
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Publish';
      }
    });
  });
}

function openPublishSuccessModal(url) {
  openModal(`
    <h3 class="modal-title" id="modalTitle">🎉 You're live!</h3>
    <p class="modal-sub">Your portfolio is published at:</p>
    <p class="publish-url">${esc(url)}</p>
    <div class="modal-actions">
      <button class="btn btn-ghost btn-sm" id="publishCopyBtn" type="button">Copy link</button>
      <a class="btn btn-secondary btn-sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Visit site ↗</a>
    </div>
  `, (root) => {
    root.querySelector('#publishCopyBtn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        root.querySelector('#publishCopyBtn').textContent = 'Copied ✓';
      } catch (err) {
        /* Clipboard API may be unavailable (e.g. insecure context) — link is still visible and selectable. */
      }
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

    const verifyBadge = (block.type === 'experience' && block.data.verify && block.data.verify.type !== 'none')
      ? `<span class="sd-verify-dot" title="Has verification proof">✓</span>` : '';

    const swapBtn = twoCol
      ? `<button class="sd-icon-btn sd-swap-btn" data-action="swap" data-id="${block.id}" title="Move to ${block.col === 'side' ? 'main column' : 'sidebar'}" type="button">${block.col === 'side' ? '⇤' : '⇥'}</button>`
      : '';

    item.innerHTML = `
      <div class="sd-item-header">
        <span class="sd-drag-handle">☰</span>
        <span class="sd-title-text">${esc(titleText)} ${verifyBadge}</span>
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

function initSidebarActions() {
  el.sidebarSectionsList.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) {
      const id = actionBtn.dataset.id;
      if (actionBtn.dataset.action === 'delete') {
        if (confirm('Remove this section?')) Store.removeBlock(id);
      } else if (actionBtn.dataset.action === 'swap') {
        const block = Store.active().blocks.find(b => b.id === id);
        if (block) Store.setBlockColumn(id, block.col === 'side' ? 'main' : 'side');
      }
      return;
    }
    const item = e.target.closest('.sd-section-item');
    if (item) Store.setSelectedBlock(item.dataset.id);
  });
}

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
  el.tabEditBtn.addEventListener('click', () => Store.setMode('edit'));
  el.tabCustomizeBtn.addEventListener('click', () => Store.setMode('customize'));

  el.docTitle.addEventListener('input', (e) => Store.updateTitle(e.target.textContent));

  document.getElementById('btnDownloadPDF').addEventListener('click', () => {
    openInfoModal('Generating your PDF', 'Rendering this résumé as a print-ready, ATS-safe PDF. This only affects this résumé copy — your live portfolio is untouched.');
  });

  document.getElementById('btnPublishShowcase').addEventListener('click', openPublishModal);

  el.btnResetResume.addEventListener('click', () => {
    if (confirm('Reset this résumé to match your current portfolio content? Any résumé-only edits (wording, template, styling made here) will be lost. Your portfolio is never affected.')) {
      Store.resetResumeToPortfolio();
      openInfoModal('Résumé reset', 'This résumé now matches your portfolio content again. Feel free to re-apply a template and tweak it for a specific job.');
    }
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
  el.resumePaper.style.setProperty('--rp-line-height', design.lineHeight === 'compact' ? '1.25' : design.lineHeight === 'relaxed' ? '1.7' : '1.45');
}

function applyPortfolioDesign(design) {
  el.portfolioSite.style.setProperty('--pf-accent', design.accent);
  el.portfolioSite.style.setProperty('--pf-heading-font', FONT_STACKS[design.headingFont] || FONT_STACKS.modern);
  el.portfolioSite.style.setProperty('--pf-body-font', FONT_STACKS[design.bodyFont] || FONT_STACKS.sans);
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

  Store.on('design_changed', applyActiveDesign);
}

// ── 9. Zoom controls (applies to whichever canvas is showing) ──
function initZoomControls() {
  const MIN_ZOOM = 50;
  const MAX_ZOOM = 150;
  const STEP = 10;
  let zoom = 100;

  const applyZoom = () => {
    el.canvasZoomTarget.style.transform = `scale(${zoom / 100})`;
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
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    el.sidebarResizer.classList.remove('is-dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  });
}

// ── Application bootstrapping ──────────────────────────────────
function init() {
  document.body.dataset.viewmode = Store.state.viewMode;

  initModal();
  initInputListeners();
  initToolbar();
  initSidebarResizer();
  initFormSectionToggles();
  initCustomizePanel();
  initZoomControls();
  initCanvasDelegation();
  initSidebarActions();
  initAddSectionMenu();

  refreshToolbarActiveStates();
  refreshDocTitle();
  refreshInputsFromActive();

  Store.emit('profile_changed', Store.active().profile);
  Store.emit('mode_changed', Store.state.mode);

  renderActiveCanvas();
  applyActiveDesign();
}

document.addEventListener('DOMContentLoaded', init);
