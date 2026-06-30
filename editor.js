/* ============================================================
   editor.js — Résumé block editor with working drag-to-reorder
   + Portfolio website conversion
   ============================================================ */

// ── State ─────────────────────────────────────────────────────
let blocks = [
  { id: uid(), type: 'header', data: { name: 'Your Full Name', contact: 'email@example.com  ·  +63 912 345 6789  ·  linkedin.com/in/you  ·  City, PH' } },
  { id: uid(), type: 'section', data: { title: 'Education' } },
  { id: uid(), type: 'education', data: { school: 'University of the Philippines', degree: 'B.S. Computer Science', location: 'Diliman, Quezon City', year: 'June 2024', gpa: 'GPA: 1.50' } },
  { id: uid(), type: 'section', data: { title: 'Experience' } },
  { id: uid(), type: 'experience', data: { company: 'Tech Company Inc.', dates: 'Jan 2024 – Present', role: 'Software Engineer', location: 'Makati, PH', bullets: ['Built and shipped a feature used by 10,000+ users.', 'Led a team of 3 engineers to deliver on schedule.'] } },
  { id: uid(), type: 'section', data: { title: 'Skills' } },
  { id: uid(), type: 'skills', data: { items: 'JavaScript, React, Node.js, Python, SQL, Git' } },
  { id: uid(), type: 'links', data: { links: ['github.com/you', 'linkedin.com/in/you', 'yourportfolio.com'] } }
];

let dragSrcType  = null;
let dragSrcIndex = null;
let dragIndicator = null;

// ── Utilities ──────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }
function blockById(id) { return blocks.find(b => b.id === id); }
function save(id, key, val) { const b = blockById(id); if (b) b.data[key] = val; }
function saveBullet(id, idx, val) { const b = blockById(id); if (b) b.data.bullets[idx] = val; }
function saveLink(id, idx, val) { const b = blockById(id); if (b) b.data.links[idx] = val; }

// ── Render ─────────────────────────────────────────────────────
function render() {
  const paper = document.getElementById('resumePaper');
  paper.innerHTML = '';

  if (blocks.length === 0) {
    paper.innerHTML = `<div class="canvas-hint"><p style="font-size:1.5rem;margin-bottom:0.5rem">📋</p><p>Drag a block from the left panel to get started.</p></div>`;
    return;
  }

  blocks.forEach((block, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'resume-block';
    wrap.dataset.id = block.id;
    wrap.dataset.index = i;
    wrap.draggable = false; // enabled dynamically on grip mousedown

    wrap.innerHTML = renderBlock(block, i) + renderControls(i);

    wrap.addEventListener('dragstart', onBlockDragStart);
    wrap.addEventListener('dragend',   onBlockDragEnd);
    wrap.addEventListener('dragover',  onBlockDragOver);
    wrap.addEventListener('dragleave', onBlockDragLeave);
    wrap.addEventListener('drop',      onBlockDrop);

    paper.appendChild(wrap);
  });
}

function renderBlock(b, i) {
  const d = b.data;
  switch (b.type) {
    case 'header':
      return `<div class="rb-header">
        <span class="rb-name" contenteditable="true" onblur="save('${b.id}','name',this.innerText)">${esc(d.name)}</span>
        <span class="rb-contact" contenteditable="true" onblur="save('${b.id}','contact',this.innerText)">${esc(d.contact)}</span>
      </div>`;
    case 'section':
      return `<div class="rb-section-title" contenteditable="true" onblur="save('${b.id}','title',this.innerText)">${esc(d.title)}</div>`;
    case 'experience': {
      const bullets = d.bullets.map((bl, bi) =>
        `<li class="rb-bullet" contenteditable="true" onblur="saveBullet('${b.id}',${bi},this.innerText)">${esc(bl)}</li>`
      ).join('');
      return `<div class="rb-experience">
        <div class="rb-exp-row">
          <span class="rb-company" contenteditable="true" onblur="save('${b.id}','company',this.innerText)">${esc(d.company)}</span>
          <span class="rb-dates" contenteditable="true" onblur="save('${b.id}','dates',this.innerText)">${esc(d.dates)}</span>
        </div>
        <div class="rb-exp-row">
          <span class="rb-role" contenteditable="true" onblur="save('${b.id}','role',this.innerText)">${esc(d.role)}</span>
          <span class="rb-loc" contenteditable="true" onblur="save('${b.id}','location',this.innerText)">${esc(d.location)}</span>
        </div>
        <ul class="rb-bullets">${bullets}</ul>
        <button class="rb-add-bullet" onclick="addBullet('${b.id}')">+ bullet</button>
      </div>`;
    }
    case 'education':
      return `<div class="rb-education">
        <div class="rb-edu-left">
          <span class="rb-edu-school" contenteditable="true" onblur="save('${b.id}','school',this.innerText)">${esc(d.school)}</span>
          <span class="rb-edu-degree" contenteditable="true" onblur="save('${b.id}','degree',this.innerText)">${esc(d.degree)}</span>
        </div>
        <div class="rb-edu-right">
          <div contenteditable="true" onblur="save('${b.id}','location',this.innerText)">${esc(d.location)}</div>
          <div contenteditable="true" onblur="save('${b.id}','year',this.innerText)">${esc(d.year)}</div>
          <div contenteditable="true" onblur="save('${b.id}','gpa',this.innerText)">${esc(d.gpa)}</div>
        </div>
      </div>`;
    case 'skills':
      return `<div class="rb-skills">
        <span class="rb-skills-list" contenteditable="true" onblur="save('${b.id}','items',this.innerText)">${esc(d.items)}</span>
      </div>`;
    case 'text':
      return `<div class="rb-text" contenteditable="true" onblur="save('${b.id}','content',this.innerText)">${esc(d.content || '')}</div>`;
    case 'links': {
      const rows = d.links.map((lk, li) =>
        `<span class="rb-link-item" contenteditable="true" onblur="saveLink('${b.id}',${li},this.innerText)">${esc(lk)}</span>`
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
    <div class="bc-drag-handle" title="Drag to reorder">⠿</div>
    ${i > 0 ? `<button class="bc-btn move" title="Move up" onclick="moveBlock(${i},-1)">↑</button>` : ''}
    ${i < blocks.length - 1 ? `<button class="bc-btn move" title="Move down" onclick="moveBlock(${i},1)">↓</button>` : ''}
    <button class="bc-btn" title="Duplicate" onclick="duplicateBlock(${i})">⧉</button>
    <button class="bc-btn del" title="Delete" onclick="deleteBlock(${i})">✕</button>
  </div>`;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Block operations ───────────────────────────────────────────
function addBullet(id) { const b = blockById(id); if (b) { b.data.bullets.push('Describe what you did.'); render(); } }
function addLink(id)   { const b = blockById(id); if (b) { b.data.links.push('yourlink.com'); render(); } }

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
  if (atIndex === undefined || atIndex >= blocks.length) blocks.push(newBlock);
  else blocks.splice(atIndex, 0, newBlock);
  render();
}

// ── Drag-to-reorder (fixed implementation) ─────────────────────
function createDragIndicator() {
  dragIndicator = document.createElement('div');
  dragIndicator.id = 'dragIndicator';
  dragIndicator.style.cssText = 'height:3px;background:linear-gradient(135deg,#FF3366,#7C4DFF,#00E5B0);border-radius:2px;pointer-events:none;display:none;margin:0;transition:none;';
  document.getElementById('resumePaper').parentNode.insertBefore(dragIndicator, document.getElementById('resumePaper'));
}

function showIndicatorAt(blockEl, position) {
  if (!dragIndicator) return;
  const paper = document.getElementById('resumePaper');
  const paperRect = paper.getBoundingClientRect();
  const rect = blockEl.getBoundingClientRect();
  const y = (position === 'before' ? rect.top : rect.bottom) - paperRect.top + paper.scrollTop;
  dragIndicator.style.display = 'block';
  dragIndicator.style.position = 'absolute';
  dragIndicator.style.left = '0';
  dragIndicator.style.right = '0';
  dragIndicator.style.top = (y - 1) + 'px';
  dragIndicator.style.width = '100%';
  dragIndicator.style.zIndex = '100';
}

function hideIndicator() {
  if (dragIndicator) dragIndicator.style.display = 'none';
}

// Palette drag
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
      hideIndicator();
    });
  });
}

// Block drag (reorder) — only fires when drag originates from the grip handle
let gripMousedown = false;

document.addEventListener('mousedown', e => {
  gripMousedown = !!(e.target.closest('.bc-drag-handle'));
});

function onBlockDragStart(e) {
  if (!gripMousedown || e.target.closest('[contenteditable="true"]')) {
    e.preventDefault();
    return;
  }
  dragSrcType  = 'block';
  dragSrcIndex = parseInt(this.dataset.index);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.index);
  const el = this;
  setTimeout(() => el.classList.add('is-dragging'), 0);
}

function onBlockDragEnd(e) {
  this.classList.remove('is-dragging');
  document.querySelectorAll('.resume-block').forEach(b => b.classList.remove('drag-over-top','drag-over-bottom'));
  hideIndicator();
  dragSrcType  = null;
  dragSrcIndex = null;
}

function onBlockDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = dragSrcType === 'palette' ? 'copy' : 'move';

  const rect = this.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  const position = e.clientY < midY ? 'before' : 'after';

  document.querySelectorAll('.resume-block').forEach(b => b.classList.remove('drag-over-top','drag-over-bottom'));
  this.classList.add(position === 'before' ? 'drag-over-top' : 'drag-over-bottom');
  showIndicatorAt(this, position);
}

function onBlockDragLeave(e) {
  if (!this.contains(e.relatedTarget)) {
    this.classList.remove('drag-over-top','drag-over-bottom');
  }
}

function onBlockDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  document.querySelectorAll('.resume-block').forEach(b => b.classList.remove('drag-over-top','drag-over-bottom'));
  hideIndicator();

  const targetIndex = parseInt(this.dataset.index);
  const rect = this.getBoundingClientRect();
  const dropBefore = e.clientY < (rect.top + rect.height / 2);
  const insertAt = dropBefore ? targetIndex : targetIndex + 1;

  if (dragSrcType === 'palette') {
    const type = e.dataTransfer.getData('block-type');
    insertBlock(type, insertAt);
  } else if (dragSrcType === 'block' && dragSrcIndex !== null) {
    if (dragSrcIndex === targetIndex) return;
    const moved = blocks.splice(dragSrcIndex, 1)[0];
    const newAt = dragSrcIndex < insertAt ? insertAt - 1 : insertAt;
    blocks.splice(newAt, 0, moved);
    render();
  }
}

// Canvas drop (onto empty paper area)
function initCanvasDrop() {
  const paper = document.getElementById('resumePaper');
  paper.addEventListener('dragover', e => {
    if (e.target.closest('.resume-block')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  paper.addEventListener('drop', e => {
    if (e.target.closest('.resume-block')) return;
    e.preventDefault();
    hideIndicator();
    if (dragSrcType === 'palette') {
      const type = e.dataTransfer.getData('block-type');
      insertBlock(type);
    }
  });
}

// ── Toolbar ────────────────────────────────────────────────────
function toggleGuides(on) { document.getElementById('resumePaper').classList.toggle('show-guides', on); }
function toggleDarkPaper(on) { document.getElementById('canvasWrap').classList.toggle('dark-canvas', on); }
function downloadPDF() { window.print(); }
function downloadDOCX() { alert('Word export coming soon.'); }

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
  let heroName = 'Your Name', heroContact = '';
  const sections = [];
  let currentSection = null;

  blocks.forEach(block => {
    const d = block.data;
    switch (block.type) {
      case 'header':
        heroName = d.name || heroName;
        heroContact = d.contact || '';
        break;
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
  const name = (blocks.find(b => b.type === 'header')?.data?.name || 'portfolio').replace(/\s+/g,'-').toLowerCase();
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

// ── Init ───────────────────────────────────────────────────────
render();
createDragIndicator();
initPaletteDrag();
initCanvasDrop();

// Dynamically toggle draggable so contenteditable children work normally
document.addEventListener('mousedown', e => {
  const grip = e.target.closest('.bc-drag-handle');
  document.querySelectorAll('.resume-block').forEach(b => {
    b.draggable = !!grip;
  });
});
