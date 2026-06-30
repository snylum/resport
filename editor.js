/* ============================================================
   editor.js — Drag-and-drop résumé block editor
   ============================================================ */

// ── State ────────────────────────────────────────────────────
let blocks = [
  {
    id: uid(), type: 'header',
    data: {
      name: 'Your Full Name',
      contact: 'email@example.com  ·  +63 912 345 6789  ·  linkedin.com/in/you  ·  City, PH'
    }
  },
  { id: uid(), type: 'section', data: { title: 'Education' } },
  {
    id: uid(), type: 'education',
    data: {
      school: 'University of the Philippines',
      degree: 'B.S. Computer Science',
      location: 'Diliman, Quezon City',
      year: 'June 2024',
      gpa: 'GPA: 1.50'
    }
  },
  { id: uid(), type: 'section', data: { title: 'Experience' } },
  {
    id: uid(), type: 'experience',
    data: {
      company: 'Tech Company Inc.',
      dates: 'Jan 2024 – Present',
      role: 'Software Engineer',
      location: 'Makati, PH',
      bullets: ['Built and shipped a feature used by 10,000+ users.', 'Led a team of 3 engineers to deliver on schedule.']
    }
  },
  { id: uid(), type: 'section', data: { title: 'Skills' } },
  {
    id: uid(), type: 'skills',
    data: { items: 'JavaScript, React, Node.js, Python, SQL, Git' }
  },
  {
    id: uid(), type: 'links',
    data: { links: ['github.com/you', 'linkedin.com/in/you', 'yourportfolio.com'] }
  }
];

// Drag state
let dragSrcType  = null;   // 'palette' | 'block'
let dragSrcIndex = null;   // block index when reordering
let dragOverIndex = null;

// ── Utilities ─────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function blockById(id) {
  return blocks.find(b => b.id === id);
}

function save(id, key, val) {
  const b = blockById(id);
  if (b) b.data[key] = val;
}

function saveBullet(id, idx, val) {
  const b = blockById(id);
  if (b) b.data.bullets[idx] = val;
}

function saveLink(id, idx, val) {
  const b = blockById(id);
  if (b) b.data.links[idx] = val;
}

// ── Render ────────────────────────────────────────────────────
function render() {
  const paper = document.getElementById('resumePaper');
  paper.innerHTML = '';

  if (blocks.length === 0) {
    paper.innerHTML = `<div class="canvas-hint">
      <p style="font-size:1.5rem;margin-bottom:0.5rem">📋</p>
      <p>Drag a block from the left panel to get started.</p>
    </div>`;
    return;
  }

  blocks.forEach((block, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'resume-block';
    wrap.dataset.id = block.id;
    wrap.dataset.index = i;
    wrap.draggable = true;

    // block content
    wrap.innerHTML = renderBlock(block, i) + renderControls(i);

    // block-level drag events (reorder)
    wrap.addEventListener('dragstart', onBlockDragStart);
    wrap.addEventListener('dragend',   onBlockDragEnd);
    wrap.addEventListener('dragover',  onBlockDragOver);
    wrap.addEventListener('drop',      onBlockDrop);

    paper.appendChild(wrap);
  });
}

function renderBlock(b, i) {
  const d = b.data;

  switch (b.type) {

    case 'header':
      return `<div class="rb-header">
        <span class="rb-name" contenteditable="true"
          onblur="save('${b.id}','name',this.innerText)">${esc(d.name)}</span>
        <span class="rb-contact" contenteditable="true"
          onblur="save('${b.id}','contact',this.innerText)">${esc(d.contact)}</span>
      </div>`;

    case 'section':
      return `<div class="rb-section-title" contenteditable="true"
        onblur="save('${b.id}','title',this.innerText)">${esc(d.title)}</div>`;

    case 'experience': {
      const bullets = d.bullets.map((bl, bi) =>
        `<li class="rb-bullet" contenteditable="true"
          onblur="saveBullet('${b.id}',${bi},this.innerText)">${esc(bl)}</li>`
      ).join('');
      return `<div class="rb-experience">
        <div class="rb-exp-row">
          <span class="rb-company" contenteditable="true"
            onblur="save('${b.id}','company',this.innerText)">${esc(d.company)}</span>
          <span class="rb-dates" contenteditable="true"
            onblur="save('${b.id}','dates',this.innerText)">${esc(d.dates)}</span>
        </div>
        <div class="rb-exp-row">
          <span class="rb-role" contenteditable="true"
            onblur="save('${b.id}','role',this.innerText)">${esc(d.role)}</span>
          <span class="rb-loc" contenteditable="true"
            onblur="save('${b.id}','location',this.innerText)">${esc(d.location)}</span>
        </div>
        <ul class="rb-bullets">${bullets}</ul>
        <button class="rb-add-bullet" onclick="addBullet('${b.id}')">+ bullet</button>
      </div>`;
    }

    case 'education':
      return `<div class="rb-education">
        <div class="rb-edu-left">
          <span class="rb-edu-school" contenteditable="true"
            onblur="save('${b.id}','school',this.innerText)">${esc(d.school)}</span>
          <span class="rb-edu-degree" contenteditable="true"
            onblur="save('${b.id}','degree',this.innerText)">${esc(d.degree)}</span>
        </div>
        <div class="rb-edu-right">
          <div contenteditable="true" onblur="save('${b.id}','location',this.innerText)">${esc(d.location)}</div>
          <div contenteditable="true" onblur="save('${b.id}','year',this.innerText)">${esc(d.year)}</div>
          <div contenteditable="true" onblur="save('${b.id}','gpa',this.innerText)">${esc(d.gpa)}</div>
        </div>
      </div>`;

    case 'skills':
      return `<div class="rb-skills">
        <span class="rb-skills-list" contenteditable="true"
          onblur="save('${b.id}','items',this.innerText)">${esc(d.items)}</span>
      </div>`;

    case 'text':
      return `<div class="rb-text" contenteditable="true"
        onblur="save('${b.id}','content',this.innerText)">${esc(d.content || '')}</div>`;

    case 'links': {
      const rows = d.links.map((lk, li) =>
        `<span class="rb-link-item" contenteditable="true"
          onblur="saveLink('${b.id}',${li},this.innerText)">${esc(lk)}</span>`
      ).join('');
      return `<div class="rb-links">
        <div class="rb-links-row">${rows}</div>
        <button class="rb-add-bullet" onclick="addLink('${b.id}')">+ link</button>
      </div>`;
    }

    case 'spacer':
      return `<div class="rb-spacer"></div>`;

    default: return '';
  }
}

function renderControls(i) {
  return `<div class="block-controls">
    ${i > 0
      ? `<button class="bc-btn move" title="Move up" onclick="moveBlock(${i},-1)">↑</button>`
      : ''}
    ${i < blocks.length - 1
      ? `<button class="bc-btn move" title="Move down" onclick="moveBlock(${i},1)">↓</button>`
      : ''}
    <button class="bc-btn" title="Duplicate" onclick="duplicateBlock(${i})">⧉</button>
    <button class="bc-btn" title="Delete" onclick="deleteBlock(${i})">✕</button>
  </div>`;
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ── Block operations ──────────────────────────────────────────
function addBullet(id) {
  const b = blockById(id);
  if (b) { b.data.bullets.push('Describe what you did.'); render(); }
}

function addLink(id) {
  const b = blockById(id);
  if (b) { b.data.links.push('yourlink.com'); render(); }
}

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
  if (!confirm('Delete this block?')) return;
  blocks.splice(i, 1);
  render();
}

function defaultData(type) {
  const map = {
    header:     { name: 'Your Name', contact: 'email@example.com · Phone · City' },
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

function insertBlock(type, atIndex) {
  const newBlock = { id: uid(), type, data: { ...defaultData(type) } };
  if (atIndex === undefined || atIndex >= blocks.length) {
    blocks.push(newBlock);
  } else {
    blocks.splice(atIndex, 0, newBlock);
  }
  render();
}

// ── Palette drag (sidebar → canvas) ──────────────────────────
function initPaletteDrag() {
  document.querySelectorAll('.palette-chip').forEach(chip => {
    chip.addEventListener('dragstart', e => {
      dragSrcType  = 'palette';
      dragSrcIndex = null;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('block-type', chip.dataset.blockType);
      chip.classList.add('dragging');
    });
    chip.addEventListener('dragend', () => {
      chip.classList.remove('dragging');
      dragSrcType = null;
    });
  });
}

// ── Block drag (reorder within canvas) ───────────────────────
function onBlockDragStart(e) {
  // Don't intercept drags starting on contenteditable
  if (e.target.contentEditable === 'true') { e.stopPropagation(); return; }
  dragSrcType  = 'block';
  dragSrcIndex = parseInt(this.dataset.index);
  e.dataTransfer.effectAllowed = 'move';
  this.classList.add('is-dragging');
}

function onBlockDragEnd() {
  this.classList.remove('is-dragging');
  dragSrcType  = null;
  dragSrcIndex = null;
  dragOverIndex = null;
}

function onBlockDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = dragSrcType === 'palette' ? 'copy' : 'move';
  dragOverIndex = parseInt(this.dataset.index);
}

function onBlockDrop(e) {
  e.preventDefault();
  e.stopPropagation();

  const targetIndex = parseInt(this.dataset.index);

  if (dragSrcType === 'palette') {
    const type = e.dataTransfer.getData('block-type');
    insertBlock(type, targetIndex);
  } else if (dragSrcType === 'block' && dragSrcIndex !== null && dragSrcIndex !== targetIndex) {
    const moved = blocks.splice(dragSrcIndex, 1)[0];
    blocks.splice(targetIndex, 0, moved);
    render();
  }
}

// ── Canvas drop (drop onto empty paper) ──────────────────────
function initCanvasDrop() {
  const paper = document.getElementById('resumePaper');

  paper.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  paper.addEventListener('drop', e => {
    // Only handle if we didn't land on a block (which has its own handler)
    if (e.target.closest('.resume-block')) return;
    e.preventDefault();
    if (dragSrcType === 'palette') {
      const type = e.dataTransfer.getData('block-type');
      insertBlock(type);
    }
  });
}

// ── Toolbar actions ───────────────────────────────────────────
function toggleGuides(on) {
  document.getElementById('resumePaper').classList.toggle('show-guides', on);
}

function toggleDarkPaper(on) {
  document.getElementById('canvasWrap').classList.toggle('dark-canvas', on);
}

function downloadPDF() {
  alert('PDF export — connect Cloudflare Browser Rendering or use window.print().');
}

function downloadDOCX() {
  alert('Word export coming soon.');
}

// ── Showcase modal ────────────────────────────────────────────
function openShowcaseModal() {
  document.getElementById('showcaseModal').style.display = 'flex';
}

function closeShowcaseModal(e) {
  if (!e || e.target === document.getElementById('showcaseModal')) {
    document.getElementById('showcaseModal').style.display = 'none';
  }
}

function publishToShowcase() {
  const settings = {
    showPhoto:    document.getElementById('showPhoto').checked,
    showFullName: document.getElementById('showFullName').checked,
    showLocation: document.getElementById('showLocation').checked,
    showContact:  document.getElementById('showContact').checked,
    category:     document.getElementById('categorySelect').value,
  };

  // In a real app: POST to your backend here
  console.log('Publishing with settings:', settings);
  alert(`Published to Showcase under "${settings.category}"! 🎉\n\n(Wire up your backend to make this real.)`);
  closeShowcaseModal();
}

// ── Init ──────────────────────────────────────────────────────
render();
initPaletteDrag();
initCanvasDrop();
