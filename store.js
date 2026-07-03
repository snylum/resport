/* ============================================================
   store.js — Centralized state management & event bus
   ============================================================ */

// ── Résumé templates ──────────────────────────────────────────
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

const defaultDesign = { ...TEMPLATES[0].design };

// ── Addable section library ────────────────────────────────────
export const BLOCK_LIBRARY = [
  { type: 'section', label: 'Section Heading', makeData: () => ({ title: 'New Section' }) },
  { type: 'summary', label: 'Summary', makeData: () => ({ text: 'A brief, compelling summary of your professional background and goals.' }) },
  { type: 'experience', label: 'Experience Entry', makeData: () => ({ company: 'Company Name', role: 'Job Title', location: 'City, Country', dates: 'Month Year – Present', bullets: ['Describe an achievement or responsibility.'] }) },
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
  { id: 'b4', type: 'experience', col: 'main', data: { company: 'Tech Company Inc.', dates: 'Jan 2024 – Present', role: 'Software Engineer', location: 'Makati, PH', bullets: ['Built and shipped a feature used by 10k monthly active users.', 'Optimized frontend rendering speeds by restructuring dynamic canvas flows.'] } },
  { id: 'b1e', type: 'section', col: 'main', data: { title: 'Education' } },
  { id: 'b2', type: 'education', col: 'main', data: { school: 'University of the Philippines', degree: 'B.S. Computer Science', location: 'Diliman, Quezon City', year: 'June 2024', gpa: 'GPA: 1.50' } },
  { id: 'b5', type: 'section', col: 'main', data: { title: 'Skills' } },
  { id: 'b6', type: 'skills', col: 'main', data: { items: ['JavaScript', 'Python', 'Figma', 'Git', 'SQL'] } }
];

class EditorStore {
  constructor() {
    this.state = {
      profile: {
        jobTitle: '', firstName: 'Juan', lastName: 'Lala',
        email: '', phone: '', address: '', photo: null
      },
      blocks: [...defaultBlocks],
      selectedBlockId: null,
      mode: 'edit', // 'edit' or 'customize'
      resumeTitle: 'Untitled résumé',
      template: TEMPLATES[0].id,
      design: { ...defaultDesign }
    };
    this.listeners = {};
  }

  // Pub/Sub Event System
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  // ── Profile / meta ──────────────────────────────────────────
  updateProfile(field, value) {
    this.state.profile[field] = value;
    this.emit('profile_changed', this.state.profile);
  }

  updateTitle(title) {
    this.state.resumeTitle = title;
    this.emit('title_changed', title);
  }

  setMode(mode) {
    this.state.mode = mode;
    this.emit('mode_changed', mode);
  }

  // ── Block content ───────────────────────────────────────────
  updateBlockData(id, field, value, index = null, subfield = null) {
    const block = this.state.blocks.find(b => b.id === id);
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
    this.emit('blocks_changed', this.state.blocks);
  }

  addListItem(id, field, defaultItem) {
    const block = this.state.blocks.find(b => b.id === id);
    if (!block || !Array.isArray(block.data[field])) return;
    block.data[field].push(defaultItem);
    this.emit('blocks_changed', this.state.blocks);
  }

  removeListItem(id, field, index) {
    const block = this.state.blocks.find(b => b.id === id);
    if (!block || !Array.isArray(block.data[field])) return;
    block.data[field].splice(index, 1);
    this.emit('blocks_changed', this.state.blocks);
  }

  setBlocks(newBlocks) {
    this.state.blocks = newBlocks;
    this.emit('blocks_changed', this.state.blocks);
  }

  addBlock(type, col = 'main') {
    const lib = BLOCK_LIBRARY.find(b => b.type === type);
    if (!lib) return null;
    const block = { id: uid(), type, col, data: lib.makeData() };
    this.state.blocks.push(block);
    this.state.selectedBlockId = block.id;
    this.emit('blocks_changed', this.state.blocks);
    this.emit('selection_changed', block.id);
    return block.id;
  }

  removeBlock(id) {
    this.state.blocks = this.state.blocks.filter(b => b.id !== id);
    if (this.state.selectedBlockId === id) this.state.selectedBlockId = null;
    this.emit('blocks_changed', this.state.blocks);
  }

  setBlockColumn(id, col) {
    const block = this.state.blocks.find(b => b.id === id);
    if (!block) return;
    block.col = col;
    this.emit('blocks_changed', this.state.blocks);
  }

  setSelectedBlock(id) {
    this.state.selectedBlockId = id;
    this.emit('selection_changed', id);
  }

  // ── Templates & design (color / font / structural details) ──
  setTemplate(id) {
    const t = TEMPLATES.find(x => x.id === id);
    if (!t) return;
    this.state.template = id;
    this.state.design = { ...t.design };
    this.emit('template_changed', id);
    this.emit('design_changed', this.state.design);
  }

  setDesign(key, value) {
    this.state.design[key] = value;
    this.emit('design_changed', this.state.design);
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
