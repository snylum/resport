/* ============================================================
   editor.js — Résumé block editor (v2)
   - Edit tab: fixed Personal Details form + draggable Sections list
     (accordion edit-in-place) + canvas drag-to-reorder
   - Customize tab: Template & Colors / Text / Layout, wired to
     CSS custom properties on the live preview
   - Two-column layout support (Main / Side column per block)
   + Portfolio website conversion
   ============================================================ */

// ── State ─────────────────────────────────────────────────────
let profile = {
  jobTitle: '', firstName: 'Juan', lastName: 'Lala',
  email: '', phone: '', address: '', photo: null
};

// NOTE: 'header' is no longer a draggable block — it's the fixed
// Personal Details form above. Everything else is still a block.
let blocks = [
  { id: uid(), type: 'section', col: 'main', data: { title: 'Education' } },
  { id: uid(), type: 'education', col: 'main', data: { school: 'University of the Philippines', degree: 'B.S. Computer Science', location: 'Diliman, Quezon City', year: 'June 2024', gpa: 'GPA: 1.50' } },
  { id: uid(), type: 'section', col: 'main', data: { title: 'Experience' } },
  { id: uid(), type: 'experience', col: 'main', data: { company: 'Tech Company Inc.', dates: 'Jan 2024 – Present', role: 'Software Engineer', location: 'Makati, PH', bullets: ['Built and shipped a feature used by 10,000+ users.', 'Led a team of 3 engineers to deliver on schedule.'] } },
  { id: uid(), type: 'section', col: 'main', data: { title: 'Skills' } },
  { id: uid(), type: 'skills', col: 'main', data: { items: 'JavaScript, React, Node.js, Python, SQL, Git' } },
  { id: uid(), type: 'links', col: 'main', data: { links: ['github.com/you', 'linkedin.com/in/you', 'yourportfolio.com'] } }
];

let dragSrcType  = null;   // 'palette' — block reorder uses pointer drag below
let columnLayout = '1';    // '1' | '2-30' | '2-35' | '2-40'
let sidebarPos   = 'left'; // 'left' | 'right'
let selectedBlockId = null;
let currentMode = 'edit';      // 'edit' | 'customize'
let currentCTab = 'template';  // 'template' | 'text' | 'layout'

// ── Utilities ──────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }
function blockById(id) { return blocks.find(b => b.id === id); }
function save(id, key, val) { const b = blockById(id); if (b) { b.data[key] = val; renderBlockInPlace(id); } }
function saveBullet(id, idx, val) { const b = blockById(id); if (b) { b.data.bullets[idx] = val; renderBlockInPlace(id); } }
function saveLink(id, idx, val) { const b = blockById(id); if (b) { b.data.links[idx] = val; renderBlockInPlace(id); } }

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Personal details ─────────────────────────────────────────
function updateProfile(key, val) {
  profile[key] = val;
  renderHeader();
}

function handlePhotoUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    profile.photo = reader.result;
    renderHeader();
    syncPhotoBox();
  };
  reader.readAsDataURL(file);
}

function syncPhotoBox() {
  const box = document.getElementById('pdPhotoBox');
  if (!box) return;
  box.innerHTML = profile.photo
    ? `<img src="${profile.photo}" alt="Profile photo" />`
    : `<span id="pdPhotoIcon">👤</span>`;
}

function contactLine() {
  return [profile.email, profile.phone, profile.address].filter(Boolean).join('  ·  ');
}

function renderHeader() {
  const host = document.getElementById('resumeHeader');
  if (!host) return;
  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
  host.innerHTML = `
    ${profile.photo ? `<img class="rb-photo" src="${esc(profile.photo)}" alt="" />` : ''}
    <span class="rb-name">${esc(fullName) || '<span class="rb-placeholder">Your Full Name</span>'}</span>
    ${profile.jobTitle ? `<span class="rb-job-title">${esc(profile.jobTitle)}</span>` : ''}
    <span class="rb-contact">${esc(contactLine()) || '<span class="rb-placeholder">Contact info</span>'}</span>
  `;
}

function syncPersonalDetailsForm() {
  const map = {
    pdJobTitle: 'jobTitle', pdFirst: 'firstName', pdLast: 'lastName',
    pdEmail: 'email', pdPhone: 'phone', pdAddress: 'address'
  };
  Object.entries(map).forEach(([elId, key]) => {
    const el = document.getElementById(elId);
    if (el) el.value = profile[key] || '';
  });
  syncPhotoBox();
}

// ── Mode switching: Edit / Customize ───────────────────────────
function setMode(mode) {
  currentMode = mode;
  document.getElementById('tabEditBtn').classList.toggle('active', mode === 'edit');
  document.getElementById('tabCustomizeBtn').classList.toggle('active', mode === 'customize');
  document.getElementById('editModePanel').style.display = mode === 'edit' ? 'flex' : 'none';
  document.getElementById('customizeModePanel').style.display = mode === 'customize' ? 'flex' : 'none';
}

function setCustomizeTab(tab) {
  currentCTab = tab;
  document.querySelectorAll('.customize-tab').forEach(t => t.classList.toggle('active', t.dataset.ctab === tab));
  document.querySelectorAll('.customize-pane').forEach(p => p.style.display = 'none');
  document.getElementById('ctab-' + tab).style.display = 'flex';
}

// ── Render (document / preview side — read-only, no contenteditable) ──
function render() {
  const paper = document.getElementById('resumePaper');
  paper.innerHTML = '';
  paper.classList.toggle('is-two-col', columnLayout !== '1');
  paper.classList.toggle('sidebar-right', sidebarPos === 'right');

  const header = document.createElement('div');
  header.className = 'rb-header';
  header.id = 'resumeHeader';
  paper.appendChild(header);

  if (blocks.length === 0) {
    const hint = document.createElement('div');
    hint.className = 'canvas-hint';
    hint.innerHTML = `<p style="font-size:1.5rem;margin-bottom:0.5rem">📋</p><p>Drag a section from the left panel to get started.</p>`;
    paper.appendChild(hint);
    renderHeader();
    renderSectionsList();
    return;
  }

  if (columnLayout === '1') {
    const track = document.createElement('div');
    track.className = 'col-track col-main';
    track.dataset.col = 'main';
    blocks.forEach((block, i) => track.appendChild(renderBlockEl(block, i)));
    paper.appendChild(track);
  } else {
    const sideWidth = columnLayout.split('-')[1];
    paper.style.setProperty('--side-width', sideWidth + '%');

    const mainTrack = document.createElement('div');
    mainTrack.className = 'col-track col-main';
    mainTrack.dataset.col = 'main';

    const sideTrack = document.createElement('div');
    sideTrack.className = 'col-track col-side';
    sideTrack.dataset.col = 'side';

    blocks.forEach((block, i) => {
      const el = renderBlockEl(block, i);
      (block.col === 'side' ? sideTrack : mainTrack).appendChild(el);
    });

    const cols = document.createElement('div');
    cols.className = 'col-wrap';
    if (sidebarPos === 'left') { cols.appendChild(sideTrack); cols.appendChild(mainTrack); }
    else { cols.appendChild(mainTrack); cols.appendChild(sideTrack); }
    paper.appendChild(cols);
  }

  renderHeader();
  highlightSelectedBlock();
  renderSectionsList();
}

function renderBlockEl(block, i) {
  const wrap = document.createElement('div');
  wrap.className = 'resume-block';
  wrap.dataset.id = block.id;
  wrap.dataset.index = i;
  wrap.innerHTML = renderBlockContent(block);
  wrap.addEventListener('click', () => selectBlock(block.id));
  return wrap;
}

// Re-render just one block's content (after a panel edit) without
// rebuilding the whole canvas / losing drag listeners elsewhere.
function renderBlockInPlace(id) {
  const el = document.querySelector(`.resume-block[data-id="${id}"]`);
  const block = blockById(id);
  if (!el || !block) return;
  const i = blocks.indexOf(block);
  el.innerHTML = renderBlockContent(block);
  refreshSectionRowTitle(id);
}

function renderBlockContent(b) {
  const d = b.data;
  switch (b.type) {
    case 'section':
      return `<div class="rb-section-title">${esc(d.title) || '<span class="rb-placeholder">Section Title</span>'}</div>`;
    case 'experience': {
      const bullets = (d.bullets || []).map(bl => `<li class="rb-bullet">${esc(bl)}</li>`).join('');
      return `<div class="rb-experience">
        <div class="rb-exp-row">
          <span class="rb-company">${esc(d.company)}</span>
          <span class="rb-dates">${esc(d.dates)}</span>
        </div>
        <div class="rb-exp-row">
          <span class="rb-role">${esc(d.role)}</span>
          <span class="rb-loc">${esc(d.location)}</span>
        </div>
        <ul class="rb-bullets">${bullets}</ul>
      </div>`;
    }
    case 'education':
      return `<div class="rb-education">
        <div class="rb-edu-left">
          <span class="rb-edu-school">${esc(d.school)}</span>
          <span class="rb-edu-degree">${esc(d.degree)}</span>
        </div>
        <div class="rb-edu-right">
          <div>${esc(d.location)}</div>
          <div>${esc(d.year)}</div>
          <div>${esc(d.gpa)}</div>
        </div>
      </div>`;
    case 'skills': {
      const tags = (d.items || '').split(',').map(s => s.trim()).filter(Boolean);
      return `<div class="rb-skills"><span class="rb-skills-list">${tags.map(t => `<span class="rb-skill-tag">${esc(t)}</span>`).join(', ')}</span></div>`;
    }
    case 'text':
      return `<div class="rb-text">${esc(d.content || '') || '<span class="rb-placeholder">Type your text here.</span>'}</div>`;
    case 'links': {
      const rows = (d.links || []).map(lk => `<span class="rb-link-item">${esc(lk)}</span>`).join('');
      return `<div class="rb-links"><div class="rb-links-row">${rows}</div></div>`;
    }
    case 'spacer':
      return `<div class="rb-spacer"></div>`;
    default: return '';
  }
}

function highlightSelectedBlock() {
  document.querySelectorAll('.resume-block').forEach(el => {
    el.classList.toggle('block-selected', el.dataset.id === selectedBlockId);
  });
}

// ── Block operations ───────────────────────────────────────────
function addBullet(id) { const b = blockById(id); if (b) { b.data.bullets.push('Describe what you did.'); renderBlockInPlace(id); refreshExpandedRow(id); } }
function removeBullet(id, idx) { const b = blockById(id); if (b) { b.data.bullets.splice(idx, 1); renderBlockInPlace(id); refreshExpandedRow(id); } }
function addLink(id)   { const b = blockById(id); if (b) { b.data.links.push('yourlink.com'); renderBlockInPlace(id); refreshExpandedRow(id); } }
function removeLink(id, idx) { const b = blockById(id); if (b) { b.data.links.splice(idx, 1); renderBlockInPlace(id); refreshExpandedRow(id); } }

function moveBlock(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= blocks.length) return;
  [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  render();
}

function duplicateBlock(i) {
  const clone = JSON.parse(JSON.stringify(blocks[i]));
  clone.id = uid();
  blocks.splice(i + 1, 0, clone);
  render();
}

function deleteBlock(i) {
  if (!confirm('Delete this section?')) return;
  const id = blocks[i].id;
  blocks.splice(i, 1);
  if (selectedBlockId === id) selectedBlockId = null;
  render();
}

function toggleBlockColumn(id) {
  const b = blockById(id);
  if (!b) return;
  b.col = b.col === 'side' ? 'main' : 'side';
  render();
  if (selectedBlockId === id) selectBlock(id);
}

function defaultData(type) {
  const map = {
    section:    { title: 'Section Title' },
    experience: { company: 'Company Name', dates: '2024 – Present', role: 'Your Role', location: 'City, PH', bullets: ['Describe your impact here.'] },
    education:  { school: 'University Name', degree: 'Degree & Major', location: 'City', year: '2024', gpa: '' },
    skills:     { items: 'Skill 1, Skill 2, Skill 3' },
    text:       { content: 'Type your text here.' },
    links:      { links: ['github.com/you', 'linkedin.com/in/you'] },
    spacer:     {},
  };
  return map[type] || {};
}

function insertBlock(type, atIndex, col) {
  const newBlock = { id: uid(), type, col: col || 'main', data: { ...defaultData(type) } };
  if (atIndex === undefined || atIndex >= blocks.length) blocks.push(newBlock);
  else blocks.splice(atIndex, 0, newBlock);
  render();
  selectBlock(newBlock.id);
  return newBlock;
}

function addSection(type) {
  insertBlock(type, undefined, 'main');
  closeAddSectionMenu();
}

function toggleAddSectionMenu(e) {
  e.stopPropagation();
  document.getElementById('addSectionDropdown').classList.toggle('open');
}
function closeAddSectionMenu() {
  document.getElementById('addSectionDropdown')?.classList.remove('open');
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('#addSectionDropdown')) closeAddSectionMenu();
});

// ── Column layout controls ──────────────────────────────────────
function setColumnLayout(value) {
  columnLayout = value;
  if (value === '1') {
    // collapse everything back into main, preserving order
    blocks.forEach(b => b.col = 'main');
  }
  render();
  // BUG FIX: previously the open field-editor kept showing a stale
  // Main/Side toggle after switching back to single column. Re-open
  // it so it reflects the current layout.
  if (selectedBlockId) selectBlock(selectedBlockId);
}

function setSidebarPosition(value) {
  sidebarPos = value;
  render();
}

// ── Sections accordion (left sidebar, Edit tab) ─────────────────
const typeLabels = {
  section: '📌 Section Title', experience: '💼 Experience',
  education: '🎓 Education', skills: '⚡ Skills', text: '📝 Text Block',
  links: '🔗 Links', spacer: '↕️ Spacer',
};
const typeIcons = { section:'📌', experience:'💼', education:'🎓', skills:'⚡', text:'📝', links:'🔗', spacer:'↕️' };

function sectionRowTitle(block) {
  const d = block.data;
  switch (block.type) {
    case 'section': return d.title || 'Section Title';
    case 'experience': return d.company || 'Experience';
    case 'education': return d.school || 'Education';
    case 'skills': return 'Skills';
    case 'text': return 'Text Block';
    case 'links': return 'Links';
    case 'spacer': return 'Spacer';
    default: return block.type;
  }
}

function refreshSectionRowTitle(id) {
  const row = document.querySelector(`.section-row[data-id="${id}"] .section-row-title`);
  const block = blockById(id);
  if (row && block) row.textContent = sectionRowTitle(block);
}

function refreshExpandedRow(id) {
  if (selectedBlockId === id) renderSectionsList();
}

function renderSectionsList() {
  const host = document.getElementById('sectionsList');
  if (!host) return;
  if (blocks.length === 0) {
    host.innerHTML = `<p class="sidebar-hint">No sections yet — use "+ Add" above to get started.</p>`;
    return;
  }
  host.innerHTML = blocks.map((b, i) => `
    <div class="section-row ${selectedBlockId === b.id ? 'expanded' : ''}" data-id="${b.id}" data-index="${i}">
      <div class="section-row-head" onclick="toggleSectionRow('${b.id}')">
        <span class="section-row-grip" title="Drag to reorder">⠿</span>
        <span class="section-row-icon">${typeIcons[b.type] || ''}</span>
        <span class="section-row-title">${esc(sectionRowTitle(b))}</span>
        <span class="section-row-actions">
          <button class="bc-btn" title="Duplicate" onclick="event.stopPropagation();duplicateBlock(${i})">⧉</button>
          <button class="bc-btn del" title="Delete" onclick="event.stopPropagation();deleteBlock(${i})">✕</button>
        </span>
      </div>
      ${selectedBlockId === b.id ? `<div class="section-row-body">${renderFieldsForBlock(b)}</div>` : ''}
    </div>
  `).join('');
}

function toggleSectionRow(id) {
  selectedBlockId = (selectedBlockId === id) ? null : id;
  highlightSelectedBlock();
  renderSectionsList();
}

function selectBlock(id) {
  selectedBlockId = id;
  highlightSelectedBlock();
  renderSectionsList();
  const row = document.querySelector(`.section-row[data-id="${id}"]`);
  if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function panelField(label, inputHtml) {
  return `<div class="pf-field"><label class="pf-label">${esc(label)}</label>${inputHtml}</div>`;
}
function panelInput(value, onInput, placeholder) {
  return `<input type="text" class="pf-input" value="${esc(value || '')}" placeholder="${esc(placeholder || '')}" oninput="${onInput}" />`;
}
function panelTextarea(value, onInput, placeholder, rows) {
  return `<textarea class="pf-textarea" rows="${rows || 3}" placeholder="${esc(placeholder || '')}" oninput="${onInput}">${esc(value || '')}</textarea>`;
}

function renderFieldsForBlock(block) {
  const id = block.id, d = block.data;
  let fieldsHtml = '';
  switch (block.type) {
    case 'section':
      fieldsHtml += panelField('Section title', panelInput(d.title, `save('${id}','title',this.value)`, 'Experience'));
      break;
    case 'experience':
      fieldsHtml += panelField('Company', panelInput(d.company, `save('${id}','company',this.value)`, 'Company Name'));
      fieldsHtml += panelField('Dates', panelInput(d.dates, `save('${id}','dates',this.value)`, '2024 – Present'));
      fieldsHtml += panelField('Role / title', panelInput(d.role, `save('${id}','role',this.value)`, 'Your Role'));
      fieldsHtml += panelField('Location', panelInput(d.location, `save('${id}','location',this.value)`, 'City, PH'));
      fieldsHtml += `<div class="pf-field"><label class="pf-label">Bullet points</label>
        <div class="pf-bullet-list">
          ${(d.bullets || []).map((bl, bi) => `
            <div class="pf-bullet-row">
              <textarea class="pf-textarea pf-textarea-sm" rows="2" oninput="saveBullet('${id}',${bi},this.value)">${esc(bl)}</textarea>
              <button class="pf-remove-btn" title="Remove bullet" onclick="removeBullet('${id}',${bi})">✕</button>
            </div>`).join('')}
        </div>
        <button class="pf-add-btn" onclick="addBullet('${id}')">+ Add bullet</button>
      </div>`;
      break;
    case 'education':
      fieldsHtml += panelField('School', panelInput(d.school, `save('${id}','school',this.value)`, 'University Name'));
      fieldsHtml += panelField('Degree', panelInput(d.degree, `save('${id}','degree',this.value)`, 'Degree & Major'));
      fieldsHtml += panelField('Location', panelInput(d.location, `save('${id}','location',this.value)`, 'City'));
      fieldsHtml += panelField('Year', panelInput(d.year, `save('${id}','year',this.value)`, '2024'));
      fieldsHtml += panelField('GPA / honors', panelInput(d.gpa, `save('${id}','gpa',this.value)`, 'GPA: 1.50'));
      break;
    case 'skills':
      fieldsHtml += panelField('Skills (comma-separated)', panelTextarea(d.items, `save('${id}','items',this.value)`, 'JavaScript, React, Node.js', 3));
      break;
    case 'text':
      fieldsHtml += panelField('Content', panelTextarea(d.content, `save('${id}','content',this.value)`, 'Type your text here.', 5));
      break;
    case 'links':
      fieldsHtml += `<div class="pf-field"><label class="pf-label">Links</label>
        <div class="pf-bullet-list">
          ${(d.links || []).map((lk, li) => `
            <div class="pf-bullet-row">
              <input type="text" class="pf-input" value="${esc(lk)}" oninput="saveLink('${id}',${li},this.value)" />
              <button class="pf-remove-btn" title="Remove link" onclick="removeLink('${id}',${li})">✕</button>
            </div>`).join('')}
        </div>
        <button class="pf-add-btn" onclick="addLink('${id}')">+ Add link</button>
      </div>`;
      break;
    case 'spacer':
      fieldsHtml += `<p class="pf-hint">A spacer just adds vertical space — nothing to edit here.</p>`;
      break;
  }

  let colControl = '';
  if (columnLayout !== '1') {
    colControl = `<div class="pf-field">
      <label class="pf-label">Column</label>
      <div class="pf-col-toggle">
        <button class="pf-col-btn ${block.col !== 'side' ? 'active' : ''}" onclick="setBlockColumn('${id}','main')">Main</button>
        <button class="pf-col-btn ${block.col === 'side' ? 'active' : ''}" onclick="setBlockColumn('${id}','side')">Side</button>
      </div>
    </div>`;
  }
  return colControl + fieldsHtml;
}

function setBlockColumn(id, col) {
  const b = blockById(id);
  if (!b) return;
  b.col = col;
  render();
  selectBlock(id);
}

// ── Drag-to-reorder: Sections list (left sidebar) ───────────────
let srDragEl = null, srPlaceholder = null, srOffsetY = 0;

function initSectionsDrag() {
  document.getElementById('sectionsList').addEventListener('pointerdown', (e) => {
    const grip = e.target.closest('.section-row-grip');
    const row = e.target.closest('.section-row');
    if (!grip || !row) return;
    e.preventDefault();

    srDragEl = row;
    const rect = row.getBoundingClientRect();
    srOffsetY = e.clientY - rect.top;

    srPlaceholder = document.createElement('div');
    srPlaceholder.className = 'section-row-placeholder';
    row.after(srPlaceholder);

    row.classList.add('dragging');
    row.style.position = 'fixed';
    row.style.left = rect.left + 'px';
    row.style.top = rect.top + 'px';
    row.style.width = rect.width + 'px';
    row.style.zIndex = '999';
    row.style.pointerEvents = 'none';

    document.addEventListener('pointermove', onSectionsPointerMove);
    document.addEventListener('pointerup', onSectionsPointerUp);
  });
}

function onSectionsPointerMove(e) {
  if (!srDragEl) return;
  srDragEl.style.top = (e.clientY - srOffsetY) + 'px';

  const host = document.getElementById('sectionsList');
  const siblings = Array.from(host.querySelectorAll('.section-row')).filter(r => r !== srDragEl);
  const dragCenterY = e.clientY;

  let inserted = false;
  for (const sib of siblings) {
    const rect = sib.getBoundingClientRect();
    if (dragCenterY < rect.top + rect.height / 2) {
      if (srPlaceholder.nextSibling !== sib) sib.before(srPlaceholder);
      inserted = true;
      break;
    }
  }
  if (!inserted) {
    const last = siblings[siblings.length - 1];
    if (last && srPlaceholder !== last.nextSibling) last.after(srPlaceholder);
  }
}

function onSectionsPointerUp() {
  if (!srDragEl) return;
  document.removeEventListener('pointermove', onSectionsPointerMove);
  document.removeEventListener('pointerup', onSectionsPointerUp);

  srPlaceholder.replaceWith(srDragEl);
  srDragEl.classList.remove('dragging');
  srDragEl.style.position = '';
  srDragEl.style.left = '';
  srDragEl.style.top = '';
  srDragEl.style.width = '';
  srDragEl.style.zIndex = '';
  srDragEl.style.pointerEvents = '';

  const host = document.getElementById('sectionsList');
  const orderedIds = Array.from(host.querySelectorAll('.section-row')).map(r => r.dataset.id);
  blocks = orderedIds.map(id => blockById(id)).filter(Boolean);

  srDragEl = null;
  srPlaceholder = null;
  render();
}

// ── Toolbar ────────────────────────────────────────────────────
function toggleGuides(on) { document.getElementById('resumePaper').classList.toggle('show-guides', on); }
function toggleDarkPaper(on) { document.getElementById('canvasWrap').classList.toggle('dark-canvas', on); }
function downloadPDF() { window.print(); }

// ── Pagination (preview footer) ─────────────────────────────────
// Single continuous canvas today; the nav UI is wired and ready for
// real multi-page support, but with one page we keep Prev/Next disabled
// instead of leaving them clickable-but-broken (that was the bug).
let currentPage = 1, totalPages = 1;
function pageNav(dir) {
  const next = currentPage + dir;
  if (next < 1 || next > totalPages) return;
  currentPage = next;
  updatePageIndicator();
}
function updatePageIndicator() {
  document.getElementById('pageIndicator').textContent = `${currentPage} / ${totalPages}`;
}

// ── Customize: Template & Colors ─────────────────────────────────
function setMainColor(hex) {
  document.getElementById('resumePaper').style.setProperty('--resume-accent', hex);
  document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s.dataset.color.toLowerCase() === hex.toLowerCase()));
}

function setTemplate(name) {
  const paper = document.getElementById('resumePaper');
  paper.dataset.template = name;
  document.querySelectorAll('.template-card').forEach(c => c.classList.toggle('active', c.dataset.template === name));
}

// ── Customize: Text ───────────────────────────────────────────
function setPrimaryFont(value) {
  document.getElementById('resumePaper').style.setProperty('--resume-font', value);
}
function setLineHeight(pct) {
  document.getElementById('resumePaper').style.setProperty('--resume-line-height', (pct / 100));
  document.getElementById('lineHeightVal').textContent = pct + '%';
}
function setFontSize(step) {
  const sizes = ['11px', '12.5px', '14px'];
  const labels = ['S', 'M', 'L'];
  document.getElementById('resumePaper').style.setProperty('--resume-font-size', sizes[step]);
  document.getElementById('fontSizeVal').textContent = labels[step];
}

// ── Customize: Layout ─────────────────────────────────────────
function setPageFormat(fmt) {
  const paper = document.getElementById('resumePaper');
  paper.style.maxWidth = fmt === 'letter' ? '660px' : '680px';
}
function setMargin(which, px) {
  const paper = document.getElementById('resumePaper');
  if (which === 'tb') {
    paper.style.setProperty('--resume-pad-tb', px + 'px');
    document.getElementById('marginTBVal').textContent = px + 'px';
  } else {
    paper.style.setProperty('--resume-pad-lr', px + 'px');
    document.getElementById('marginLRVal').textContent = px + 'px';
  }
}
function setSpacing(which, px) {
  const paper = document.getElementById('resumePaper');
  if (which === 'section') {
    paper.style.setProperty('--resume-gap-section', px + 'px');
    document.getElementById('gapSectionVal').textContent = px + 'px';
  } else {
    paper.style.setProperty('--resume-gap-block', px + 'px');
    document.getElementById('gapBlockVal').textContent = px + 'px';
  }
}
function setHeaderAlign(val) {
  document.getElementById('resumePaper').dataset.headerAlign = val;
  document.querySelectorAll('#ctab-layout .align-toggle')[0].querySelectorAll('.align-btn').forEach(b => b.classList.toggle('active', b.dataset.val === val));
}
function setDateAlign(val) {
  document.getElementById('resumePaper').dataset.dateAlign = val;
  document.querySelectorAll('#ctab-layout .align-toggle')[1].querySelectorAll('.align-btn').forEach(b => b.classList.toggle('active', b.dataset.val === val));
}
function setSkillsLayout(val) {
  document.getElementById('resumePaper').dataset.skillsLayout = val;
  document.querySelectorAll('#ctab-layout .align-toggle')[2].querySelectorAll('.align-btn').forEach(b => b.classList.toggle('active', b.dataset.val === val));
}

// ── Portfolio builder ──────────────────────────────────────────
const PORTFOLIO_THEMES = {
  minimal: {
    label: 'Minimal',
    desc: 'Clean, white, typographic',
    css: `
      body { font-family: 'Georgia', serif; background: #fff; color: #111; margin: 0; }
      .pf-hero { max-width: 720px; margin: 80px auto 60px; padding: 0 2rem; }
      .pf-name { font-size: 3.5rem; font-weight: 400; letter-spacing: -0.02em; line-height: 1.1; margin-bottom: 0.5rem; }
      .pf-contact { font-family: 'Courier New', monospace; font-size: 0.8rem; color: #888; letter-spacing: 0.05em; }
      .pf-section { max-width: 720px; margin: 0 auto 2.5rem; padding: 0 2rem; border-top: 1px solid #eee; padding-top: 2rem; }
      .pf-section-title { font-family: 'Courier New', monospace; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.15em; color: #aaa; margin-bottom: 1.25rem; }
      .pf-exp { margin-bottom: 2rem; }
      .pf-exp-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.2rem; }
      .pf-company { font-weight: 700; font-size: 1rem; }
      .pf-dates { font-family: 'Courier New', monospace; font-size: 0.75rem; color: #888; }
      .pf-role { font-style: italic; color: #555; font-size: 0.9rem; margin-bottom: 0.5rem; }
      .pf-bullets { padding-left: 1.25rem; font-size: 0.9rem; line-height: 1.7; color: #333; }
      .pf-skills { display: flex; flex-wrap: wrap; gap: 0.5rem; }
      .pf-skill-tag { border: 1px solid #ddd; padding: 0.3rem 0.75rem; font-size: 0.8rem; font-family: 'Courier New', monospace; }
      .pf-links { display: flex; gap: 1.5rem; flex-wrap: wrap; }
      .pf-link { font-family: 'Courier New', monospace; font-size: 0.8rem; color: #111; text-decoration: none; border-bottom: 1px solid #111; padding-bottom: 1px; }
      .pf-edu { margin-bottom: 1rem; }
      .pf-edu-school { font-weight: 700; }
      .pf-edu-degree { font-style: italic; color: #555; font-size: 0.9rem; }
      .pf-edu-meta { font-family: 'Courier New', monospace; font-size: 0.75rem; color: #aaa; margin-top: 0.2rem; }
    `
  },
  bold: {
    label: 'Bold',
    desc: 'High contrast, editorial',
    css: `
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700;900&display=swap');
      body { font-family: 'Space Grotesk', sans-serif; background: #0a0a0a; color: #f0f0f0; margin: 0; }
      .pf-hero { max-width: 800px; margin: 0 auto; padding: 80px 2rem 60px; border-bottom: 2px solid #ff3366; }
      .pf-name { font-size: 5rem; font-weight: 900; line-height: 0.9; letter-spacing: -0.04em; text-transform: uppercase; margin-bottom: 1rem; background: linear-gradient(135deg,#FF3366,#7C4DFF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
      .pf-contact { font-size: 0.75rem; letter-spacing: 0.1em; color: #666; }
      .pf-section { max-width: 800px; margin: 0 auto 3rem; padding: 0 2rem; }
      .pf-section-title { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #ff3366; margin: 3rem 0 1.5rem; display: flex; align-items: center; gap: 1rem; }
      .pf-section-title::after { content:''; flex:1; height:1px; background:#222; }
      .pf-exp { margin-bottom: 2.5rem; padding-left: 1rem; border-left: 3px solid #7C4DFF; }
      .pf-exp-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.25rem; }
      .pf-company { font-weight: 700; font-size: 1.1rem; color: #fff; }
      .pf-dates { font-size: 0.75rem; color: #555; letter-spacing: 0.05em; }
      .pf-role { font-size: 0.85rem; color: #7C4DFF; margin-bottom: 0.75rem; }
      .pf-bullets { padding-left: 1.25rem; font-size: 0.875rem; line-height: 1.75; color: #aaa; }
      .pf-skills { display: flex; flex-wrap: wrap; gap: 0.5rem; }
      .pf-skill-tag { background: #1a1a1a; border: 1px solid #333; color: #00E5B0; padding: 0.35rem 0.85rem; font-size: 0.75rem; letter-spacing: 0.05em; border-radius: 2px; }
      .pf-links { display: flex; gap: 1rem; flex-wrap: wrap; }
      .pf-link { color: #ff3366; text-decoration: none; font-size: 0.8rem; border-bottom: 1px solid #ff3366; padding-bottom: 1px; letter-spacing: 0.05em; }
      .pf-edu { margin-bottom: 1.25rem; }
      .pf-edu-school { font-weight: 700; color: #fff; }
      .pf-edu-degree { color: #7C4DFF; font-size: 0.9rem; }
      .pf-edu-meta { font-size: 0.75rem; color: #555; margin-top: 0.25rem; }
    `
  },
  warm: {
    label: 'Warm',
    desc: 'Earthy, approachable',
    css: `
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;500&display=swap');
      body { font-family: 'Inter', sans-serif; background: #FDF6EE; color: #2c1a0e; margin: 0; }
      .pf-hero { max-width: 760px; margin: 0 auto; padding: 80px 2rem 60px; }
      .pf-name { font-family: 'Playfair Display', serif; font-size: 4rem; font-weight: 700; line-height: 1.05; color: #1a0a00; margin-bottom: 0.5rem; }
      .pf-contact { font-size: 0.8rem; color: #a07850; letter-spacing: 0.03em; }
      .pf-section { max-width: 760px; margin: 0 auto 2.5rem; padding: 0 2rem; }
      .pf-section-title { font-family: 'Playfair Display', serif; font-size: 1.4rem; font-weight: 700; color: #8B4513; border-bottom: 2px solid #e8d5b7; padding-bottom: 0.5rem; margin-bottom: 1.5rem; }
      .pf-exp { margin-bottom: 2rem; background: #fff8f0; border-radius: 8px; padding: 1.25rem; }
      .pf-exp-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.2rem; }
      .pf-company { font-weight: 600; font-size: 1rem; color: #1a0a00; }
      .pf-dates { font-size: 0.75rem; color: #a07850; }
      .pf-role { font-style: italic; color: #8B4513; font-size: 0.875rem; margin-bottom: 0.5rem; }
      .pf-bullets { padding-left: 1.25rem; font-size: 0.875rem; line-height: 1.7; color: #4a3020; }
      .pf-skills { display: flex; flex-wrap: wrap; gap: 0.5rem; }
      .pf-skill-tag { background: #8B4513; color: #FDF6EE; padding: 0.35rem 0.85rem; font-size: 0.75rem; border-radius: 100px; font-weight: 500; }
      .pf-links { display: flex; gap: 1.5rem; flex-wrap: wrap; }
      .pf-link { color: #8B4513; font-size: 0.85rem; text-decoration: none; font-weight: 500; border-bottom: 1.5px solid #e8d5b7; padding-bottom: 1px; }
      .pf-edu { margin-bottom: 1.25rem; padding: 1rem; background: #fff8f0; border-radius: 8px; }
      .pf-edu-school { font-weight: 600; color: #1a0a00; }
      .pf-edu-degree { font-style: italic; color: #8B4513; font-size: 0.875rem; }
      .pf-edu-meta { font-size: 0.75rem; color: #a07850; margin-top: 0.25rem; }
    `
  },
  neon: {
    label: 'Neon',
    desc: 'Vibrant, tech-forward',
    css: `
      @import url('https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&family=Inter:wght@400;600&display=swap');
      body { font-family: 'Inter', sans-serif; background: #050510; color: #e0e0ff; margin: 0; }
      .pf-hero { max-width: 800px; margin: 0 auto; padding: 80px 2rem 60px; position: relative; }
      .pf-hero::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, #00E5B0, #7C4DFF, #FF3366); }
      .pf-name { font-family: 'Roboto Mono', monospace; font-size: 3rem; font-weight: 700; color: #00E5B0; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
      .pf-contact { font-family: 'Roboto Mono', monospace; font-size: 0.7rem; color: #555; letter-spacing: 0.08em; }
      .pf-section { max-width: 800px; margin: 0 auto 2.5rem; padding: 0 2rem; }
      .pf-section-title { font-family: 'Roboto Mono', monospace; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.2em; color: #7C4DFF; margin-bottom: 1.25rem; padding: 0.5rem 0; border-bottom: 1px solid #1a1a2e; }
      .pf-exp { margin-bottom: 2rem; padding: 1.25rem; background: #0d0d1a; border: 1px solid #1a1a3a; border-radius: 4px; }
      .pf-exp-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.25rem; }
      .pf-company { font-weight: 600; color: #fff; font-size: 1rem; }
      .pf-dates { font-family: 'Roboto Mono', monospace; font-size: 0.7rem; color: #444; }
      .pf-role { font-family: 'Roboto Mono', monospace; font-size: 0.75rem; color: #7C4DFF; margin-bottom: 0.75rem; }
      .pf-bullets { padding-left: 1.25rem; font-size: 0.85rem; line-height: 1.75; color: #9090b0; }
      .pf-skills { display: flex; flex-wrap: wrap; gap: 0.5rem; }
      .pf-skill-tag { background: transparent; border: 1px solid #00E5B0; color: #00E5B0; padding: 0.3rem 0.75rem; font-family: 'Roboto Mono', monospace; font-size: 0.7rem; border-radius: 2px; }
      .pf-links { display: flex; gap: 1rem; flex-wrap: wrap; }
      .pf-link { font-family: 'Roboto Mono', monospace; color: #00E5B0; text-decoration: none; font-size: 0.75rem; border-bottom: 1px solid #00E5B0; padding-bottom: 1px; opacity: 0.8; }
      .pf-edu { margin-bottom: 1.25rem; padding: 1rem; background: #0d0d1a; border: 1px solid #1a1a3a; border-radius: 4px; }
      .pf-edu-school { font-weight: 600; color: #fff; }
      .pf-edu-degree { color: #7C4DFF; font-size: 0.875rem; font-family: 'Roboto Mono', monospace; }
      .pf-edu-meta { font-family: 'Roboto Mono', monospace; font-size: 0.7rem; color: #444; margin-top: 0.25rem; }
    `
  }
};

let selectedTheme = 'minimal';

function buildPortfolioHTML(theme) {
  const t = PORTFOLIO_THEMES[theme];
  const heroName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Your Name';
  const heroContact = [contactLine(), profile.jobTitle].filter(Boolean).join('  ·  ');
  const sections = [];
  let currentSection = null;

  blocks.forEach(block => {
    const d = block.data;
    switch (block.type) {
      case 'section':
        if (currentSection) sections.push(currentSection);
        currentSection = { title: d.title, items: [] };
        break;
      case 'experience':
        if (currentSection) currentSection.items.push({ type: 'experience', data: d });
        break;
      case 'education':
        if (currentSection) currentSection.items.push({ type: 'education', data: d });
        break;
      case 'skills':
        if (currentSection) currentSection.items.push({ type: 'skills', data: d });
        break;
      case 'links':
        if (currentSection) currentSection.items.push({ type: 'links', data: d });
        break;
      case 'text':
        if (currentSection) currentSection.items.push({ type: 'text', data: d });
        break;
    }
  });
  if (currentSection) sections.push(currentSection);

  let sectionsHTML = '';
  sections.forEach(sec => {
    let itemsHTML = '';
    sec.items.forEach(item => {
      const d = item.data;
      if (item.type === 'experience') {
        const bullets = (d.bullets || []).map(b => `<li>${esc(b)}</li>`).join('');
        itemsHTML += `<div class="pf-exp">
          <div class="pf-exp-header">
            <span class="pf-company">${esc(d.company)}</span>
            <span class="pf-dates">${esc(d.dates)}</span>
          </div>
          <div class="pf-role">${esc(d.role)} · ${esc(d.location)}</div>
          <ul class="pf-bullets">${bullets}</ul>
        </div>`;
      } else if (item.type === 'education') {
        itemsHTML += `<div class="pf-edu">
          <div class="pf-edu-school">${esc(d.school)}</div>
          <div class="pf-edu-degree">${esc(d.degree)}</div>
          <div class="pf-edu-meta">${esc(d.location)} · ${esc(d.year)}${d.gpa ? ' · ' + esc(d.gpa) : ''}</div>
        </div>`;
      } else if (item.type === 'skills') {
        const tags = (d.items || '').split(',').map(s => s.trim()).filter(Boolean);
        itemsHTML += `<div class="pf-skills">${tags.map(t => `<span class="pf-skill-tag">${esc(t)}</span>`).join('')}</div>`;
      } else if (item.type === 'links') {
        const links = (d.links || []);
        itemsHTML += `<div class="pf-links">${links.map(lk => `<a href="https://${esc(lk)}" class="pf-link" target="_blank">${esc(lk)}</a>`).join('')}</div>`;
      } else if (item.type === 'text') {
        itemsHTML += `<p style="font-size:0.9rem;line-height:1.7;opacity:0.85">${esc(d.content)}</p>`;
      }
    });
    sectionsHTML += `<div class="pf-section">
      <div class="pf-section-title">${esc(sec.title)}</div>
      ${itemsHTML}
    </div>`;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(heroName)} — Portfolio</title>
<style>${t.css}</style>
</head>
<body>
<div class="pf-hero">
  <div class="pf-name">${esc(heroName)}</div>
  <div class="pf-contact">${esc(heroContact)}</div>
</div>
${sectionsHTML}
<div style="max-width:800px;margin:0 auto;padding:3rem 2rem;opacity:0.3;font-size:0.7rem;text-align:center">
  Built with résumé · ${new Date().getFullYear()}
</div>
</body>
</html>`;
}

function openPortfolioModal() {
  document.getElementById('portfolioModal').style.display = 'flex';
  previewPortfolio();
}

function closePortfolioModal(e) {
  if (!e || e.target === document.getElementById('portfolioModal')) {
    document.getElementById('portfolioModal').style.display = 'none';
  }
}

function selectTheme(theme) {
  selectedTheme = theme;
  document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('theme-selected'));
  document.querySelector(`.theme-card[data-theme="${theme}"]`).classList.add('theme-selected');
  previewPortfolio();
}

function previewPortfolio() {
  const iframe = document.getElementById('portfolioPreviewFrame');
  const html = buildPortfolioHTML(selectedTheme);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  iframe.src = url;
}

function downloadPortfolio() {
  const html = buildPortfolioHTML(selectedTheme);
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const name = (`${profile.firstName} ${profile.lastName}`.trim() || 'portfolio').replace(/\s+/g,'-').toLowerCase();
  a.download = `${name}-portfolio.html`;
  a.click();
}

// ── Showcase modal (original) ──────────────────────────────────
function openShowcaseModal() { document.getElementById('showcaseModal').style.display = 'flex'; }
function closeShowcaseModal(e) {
  if (!e || e.target === document.getElementById('showcaseModal')) {
    document.getElementById('showcaseModal').style.display = 'none';
  }
}
function publishToShowcase() {
  const settings = {
    showPhoto: document.getElementById('showPhoto').checked,
    showFullName: document.getElementById('showFullName').checked,
    showLocation: document.getElementById('showLocation').checked,
    showContact: document.getElementById('showContact').checked,
    category: document.getElementById('categorySelect').value,
  };
  console.log('Publishing with settings:', settings);
  alert(`Published to Showcase under "${settings.category}"! 🎉\n\n(Wire up your backend to make this real.)`);
  closeShowcaseModal();
}

// ── Sidebar resizer (drag to adjust edit panel vs preview width) ──
function initSidebarResizer() {
  const resizer = document.getElementById('sidebarResizer');
  const sidebar = document.getElementById('sidebar');
  if (!resizer || !sidebar) return;

  const MIN = 260, MAX = 560;
  const saved = localStorage.getItem('editorSidebarWidth');
  if (saved) sidebar.style.width = Math.min(MAX, Math.max(MIN, parseInt(saved))) + 'px';

  resizer.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    resizer.setPointerCapture(e.pointerId);
    document.body.classList.add('resizing-sidebar');

    const onMove = (ev) => {
      const layoutLeft = sidebar.getBoundingClientRect().left;
      let w = ev.clientX - layoutLeft;
      w = Math.min(MAX, Math.max(MIN, w));
      sidebar.style.width = w + 'px';
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.classList.remove('resizing-sidebar');
      localStorage.setItem('editorSidebarWidth', parseInt(sidebar.style.width));
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });
}

// ── Init ───────────────────────────────────────────────────────
render();
syncPersonalDetailsForm();
initSectionsDrag();
initSidebarResizer();
updatePageIndicator();

// Click outside any block (but inside the canvas) deselects.
// BUG FIX: this used to only fire when the click landed exactly on
// the canvas wrapper, so clicking the empty-state hint or paper
// background never closed the open field editor.
document.getElementById('canvasWrap').addEventListener('click', (e) => {
  if (!e.target.closest('.resume-block')) {
    selectedBlockId = null;
    highlightSelectedBlock();
    renderSectionsList();
  }
});
