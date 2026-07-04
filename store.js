/* ============================================================
   store.js — Centralized state management & event bus
   ============================================================

   BIG PICTURE CHANGE FROM THE ORIGINAL:
   The editor now has two independent "documents":

     state.portfolio  → the live, verified portfolio-site version.
                         This is the source of truth for your work
                         history (experience, education, etc).

     state.resume     → a separate, print/PDF-oriented copy that
                         starts out cloned from the portfolio, but
                         once created lives its own life: you can
                         retemplate/restyle/re-edit it for a specific
                         job application without ever touching the
                         portfolio. "Reset" just re-clones it from
                         the portfolio again.

   state.viewMode ('portfolio' | 'resume') decides which of the two
   documents is currently "active" — i.e. which one the sidebar
   forms & canvas read from and write to. Every mutating method
   below operates on `this.active()`, so the exact same UI code
   (inputs, contenteditable fields, add/remove list buttons, drag
   reorder, etc.) works for both documents without caring which one
   is selected.
   ============================================================ */

// ── Résumé templates (used by the Resume/PDF document only) ────
// Each template is a starting point: it sets structure (columns,
// header/date alignment), color, typography and section-title
// styling all at once. Every one of those axes stays individually
// tweakable afterwards from the Customize panel.
export const TEMPLATES = [
  {
    id: 'ats',
    name: 'ATS Simple',
    tagline: 'Plain & parser-friendly',
    design: { layout: '1', headerAlign: 'left', dateAlign: 'right', accent: '#1A1A1A', headingFont: 'sans', bodyFont: 'sans', fontSize: '100', lineHeight: 'normal', titleStyle: 'plain' }
  },
  {
    id: 'harvard',
    name: 'Harvard Classic',
    tagline: 'Centered, academic, serif',
    design: { layout: '1', headerAlign: 'center', dateAlign: 'right', accent: '#1E3A5F', headingFont: 'serif', bodyFont: 'serif', fontSize: '100', lineHeight: 'normal', titleStyle: 'underline' }
  },
  {
    id: 'lasalle',
    name: 'La Salle',
    tagline: 'Sidebar with campus colors',
    design: { layout: '2', headerAlign: 'left', dateAlign: 'right', accent: '#00693E', headingFont: 'modern', bodyFont: 'sans', fontSize: '100', lineHeight: 'normal', titleStyle: 'bar' }
  },
  {
    id: 'compact',
    name: 'Executive Compact',
    tagline: 'Dense — fits more on one page',
    design: { layout: '1', headerAlign: 'left', dateAlign: 'right', accent: '#33475B', headingFont: 'sans', bodyFont: 'sans', fontSize: '90', lineHeight: 'compact', titleStyle: 'plain' }
  },
  {
    id: 'creative',
    name: 'Creative Accent',
    tagline: 'Bold color, modern display type',
    design: { layout: '2', headerAlign: 'left', dateAlign: 'right', accent: '#7C4DFF', headingFont: 'modern', bodyFont: 'sans', fontSize: '100', lineHeight: 'normal', titleStyle: 'bar' }
  }
];

// Font stacks are all system/web-safe so the résumé never depends
// on an external font loading (also keeps ATS parsing safe).
export const FONT_STACKS = {
  sans: "'Helvetica Neue', Arial, Helvetica, sans-serif",
  serif: "Georgia, 'Times New Roman', Times, serif",
  modern: "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
  classic: "'Times New Roman', Times, serif",
  mono: "'Roboto Mono', 'Courier New', Courier, monospace"
};

export const FONT_OPTIONS = [
  { id: 'sans', label: 'Arial (ATS-safe)' },
  { id: 'serif', label: 'Georgia' },
  { id: 'modern', label: 'Space Grotesk' },
  { id: 'classic', label: 'Times New Roman' },
  { id: 'mono', label: 'Roboto Mono' }
];

// Default design for the portfolio site (independent of résumé templates —
// the portfolio has one flowing layout, but still themeable via color/font).
export const PORTFOLIO_DEFAULT_DESIGN = { accent: '#7C4DFF', headingFont: 'modern', bodyFont: 'sans' };

const defaultDesign = { ...TEMPLATES[0].design };

// Shape of a "verification" attachment on an experience block.
// type: 'none' | 'photo' | 'link'
function emptyVerify() {
  return { type: 'none', photo: null, link: '', label: '' };
}

// ── Addable section library ────────────────────────────────────
export const BLOCK_LIBRARY = [
  { type: 'section', label: 'Section Heading', makeData: () => ({ title: 'New Section' }) },
  { type: 'summary', label: 'Summary', makeData: () => ({ text: 'A brief, compelling summary of your professional background and goals.' }) },
  { type: 'experience', label: 'Experience Entry', makeData: () => ({ company: 'Company Name', role: 'Job Title', location: 'City, Country', dates: 'Month Year – Present', bullets: ['Describe an achievement or responsibility.'], verify: emptyVerify() }) },
  { type: 'education', label: 'Education Entry', makeData: () => ({ school: 'School Name', degree: 'Degree / Program', location: 'City, Country', year: 'Year', gpa: '' }) },
  { type: 'projects', label: 'Project Entry', makeData: () => ({ name: 'Project Name', dates: 'Year', description: 'Short project description.', bullets: ['Key contribution or outcome.'] }) },
  { type: 'skills', label: 'Skills', makeData: () => ({ items: ['Skill One', 'Skill Two', 'Skill Three'] }) },
  { type: 'certifications', label: 'Certifications', makeData: () => ({ items: [{ name: 'Certification Name', issuer: 'Issuing Body', date: 'Year' }] }) },
  { type: 'languages', label: 'Languages', makeData: () => ({ items: [{ name: 'English', level: 'Fluent' }] }) },
  { type: 'custom', label: 'Custom Text Block', makeData: () => ({ title: 'Custom Section', text: 'Add any additional information here.' }) }
];

const defaultBlocks = [
  { id: 'b0', type: 'summary', col: 'main', data: { text: 'Detail-oriented Computer Science graduate with hands-on experience building and shipping user-facing features. Passionate about clean code, performance, and thoughtful design.' } },
  { id: 'b1', type: 'section', col: 'main', data: { title: 'Experience' } },
  { id: 'b4', type: 'experience', col: 'main', data: { company: 'Tech Company Inc.', dates: 'Jan 2024 – Present', role: 'Software Engineer', location: 'Makati, PH', bullets: ['Built and shipped a feature used by 10k monthly active users.', 'Optimized frontend rendering speeds by restructuring dynamic canvas flows.'], verify: emptyVerify() } },
  { id: 'b1e', type: 'section', col: 'main', data: { title: 'Education' } },
  { id: 'b2', type: 'education', col: 'main', data: { school: 'University of the Philippines', degree: 'B.S. Computer Science', location: 'Diliman, Quezon City', year: 'June 2024', gpa: 'GPA: 1.50' } },
  { id: 'b5', type: 'section', col: 'main', data: { title: 'Skills' } },
  { id: 'b6', type: 'skills', col: 'main', data: { items: ['JavaScript', 'Python', 'Figma', 'Git', 'SQL'] } }
];

const defaultProfile = {
  jobTitle: '', firstName: 'Juan', lastName: 'Lala',
  email: '', phone: '', address: '', photo: null,
  tagline: 'I build things for the web and like proving it.'
};

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Make sure every experience block has a verify object, even ones
// coming from an older save file / the resume clone.
function ensureVerifyShape(blocks) {
  blocks.forEach(b => {
    if (b.type === 'experience' && !b.data.verify) b.data.verify = emptyVerify();
  });
  return blocks;
}

class EditorStore {
  constructor() {
    this.state = {
      viewMode: 'portfolio',   // 'portfolio' | 'resume' — which document is on screen
      mode: 'edit',            // 'edit' | 'customize' — which sidebar panel is open
      selectedBlockId: null,

      portfolio: {
        siteTitle: 'My Portfolio',
        profile: { ...defaultProfile },
        blocks: ensureVerifyShape(deepClone(defaultBlocks)),
        design: { ...PORTFOLIO_DEFAULT_DESIGN }
      },

      resume: null // built just below, from the portfolio
    };
    this.state.resume = this._makeResumeFromPortfolio();
    this.listeners = {};
  }

  // ── Pub/Sub Event System ────────────────────────────────────
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  // ── Which document is currently being edited ────────────────
  active() {
    return this.state.viewMode === 'resume' ? this.state.resume : this.state.portfolio;
  }

  _makeResumeFromPortfolio() {
    return {
      resumeTitle: 'Untitled résumé',
      profile: deepClone(this.state.portfolio.profile),
      blocks: ensureVerifyShape(deepClone(this.state.portfolio.blocks)),
      template: TEMPLATES[0].id,
      design: { ...TEMPLATES[0].design }
    };
  }

  setViewMode(vm) {
    if (vm !== 'portfolio' && vm !== 'resume') return;
    this.state.viewMode = vm;
    this.state.selectedBlockId = null;
    this.emit('viewmode_changed', vm);
  }

  // Re-clone the résumé document from the current portfolio content.
  // Does NOT touch the portfolio in any way.
  resetResumeToPortfolio() {
    this.state.resume = this._makeResumeFromPortfolio();
    this.emit('resume_reset', this.state.resume);
  }

  // ── Profile / meta (operates on whichever document is active) ─
  updateProfile(field, value) {
    this.active().profile[field] = value;
    this.emit('profile_changed', this.active().profile);
  }

  updateTitle(title) {
    if (this.state.viewMode === 'resume') this.state.resume.resumeTitle = title;
    else this.state.portfolio.siteTitle = title;
    this.emit('title_changed', title);
  }

  setMode(mode) {
    this.state.mode = mode;
    this.emit('mode_changed', mode);
  }

  // ── Block content ───────────────────────────────────────────
  updateBlockData(id, field, value, index = null, subfield = null) {
    const block = this.active().blocks.find(b => b.id === id);
    if (!block) return;

    if (index !== null && Array.isArray(block.data[field])) {
      if (subfield) {
        if (typeof block.data[field][index] !== 'object' || block.data[field][index] === null) {
          block.data[field][index] = {};
        }
        block.data[field][index][subfield] = value;
      } else {
        block.data[field][index] = value;
      }
    } else {
      block.data[field] = value;
    }
    this.emit('blocks_changed', this.active().blocks);
  }

  // Verification attachment on an experience block (portfolio-only concept,
  // but works on whichever document is active so the same UI code runs).
  updateVerify(id, field, value) {
    const block = this.active().blocks.find(b => b.id === id);
    if (!block) return;
    if (!block.data.verify) block.data.verify = emptyVerify();
    block.data.verify[field] = value;
    this.emit('blocks_changed', this.active().blocks);
  }

  clearVerify(id) {
    const block = this.active().blocks.find(b => b.id === id);
    if (!block) return;
    block.data.verify = emptyVerify();
    this.emit('blocks_changed', this.active().blocks);
  }

  addListItem(id, field, defaultItem) {
    const block = this.active().blocks.find(b => b.id === id);
    if (!block || !Array.isArray(block.data[field])) return;
    block.data[field].push(defaultItem);
    this.emit('blocks_changed', this.active().blocks);
  }

  removeListItem(id, field, index) {
    const block = this.active().blocks.find(b => b.id === id);
    if (!block || !Array.isArray(block.data[field])) return;
    block.data[field].splice(index, 1);
    this.emit('blocks_changed', this.active().blocks);
  }

  setBlocks(newBlocks) {
    this.active().blocks = newBlocks;
    this.emit('blocks_changed', this.active().blocks);
  }

  addBlock(type, col = 'main') {
    const lib = BLOCK_LIBRARY.find(b => b.type === type);
    if (!lib) return null;
    const block = { id: uid(), type, col, data: lib.makeData() };
    this.active().blocks.push(block);
    this.state.selectedBlockId = block.id;
    this.emit('blocks_changed', this.active().blocks);
    this.emit('selection_changed', block.id);
    return block.id;
  }

  removeBlock(id) {
    this.active().blocks = this.active().blocks.filter(b => b.id !== id);
    if (this.state.selectedBlockId === id) this.state.selectedBlockId = null;
    this.emit('blocks_changed', this.active().blocks);
  }

  setBlockColumn(id, col) {
    const block = this.active().blocks.find(b => b.id === id);
    if (!block) return;
    block.col = col;
    this.emit('blocks_changed', this.active().blocks);
  }

  setSelectedBlock(id) {
    this.state.selectedBlockId = id;
    this.emit('selection_changed', id);
  }

  // ── Templates & design (color / font / structural details) ──
  // Templates are a Resume/PDF-only concept — the portfolio has one
  // adaptive layout, so this is a no-op outside resume mode.
  setTemplate(id) {
    if (this.state.viewMode !== 'resume') return;
    const t = TEMPLATES.find(x => x.id === id);
    if (!t) return;
    this.state.resume.template = id;
    this.state.resume.design = { ...t.design };
    this.emit('template_changed', id);
    this.emit('design_changed', this.state.resume.design);
  }

  setDesign(key, value) {
    this.active().design[key] = value;
    this.emit('design_changed', this.active().design);
  }
}

export const Store = new EditorStore();

// Utilities isolated out of window scope
export function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function uid() {
  return 'uid_' + Math.random().toString(36).substring(2, 11);
}
