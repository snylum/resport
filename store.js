/* ============================================================
   store.js — Centralized state management & event bus
   ============================================================ */

const defaultBlocks = [
  { id: 'b1', type: 'section', col: 'main', data: { title: 'Education' } },
  { id: 'b2', type: 'education', col: 'main', data: { school: 'University of the Philippines', degree: 'B.S. Computer Science', location: 'Diliman, Quezon City', year: 'June 2024', gpa: 'GPA: 1.50' } },
  { id: 'b3', type: 'section', col: 'main', data: { title: 'Experience' } },
  { id: 'b4', type: 'experience', col: 'main', data: { company: 'Tech Company Inc.', dates: 'Jan 2024 – Present', role: 'Software Engineer', location: 'Makati, PH', bullets: ['Built and shipped a feature used by 10k monthly active users.', 'Optimized frontend rendering speeds by restructuring dynamic canvas flows.'] } }
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
      resumeTitle: 'Untitled résumé'
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

  // Mutators
  updateProfile(field, value) {
    this.state.profile[field] = value;
    this.emit('profile_changed', this.state.profile);
  }

  updateBlockData(id, field, value, index = null) {
    const block = this.state.blocks.find(b => b.id === id);
    if (!block) return;

    if (index !== null && Array.isArray(block.data[field])) {
      block.data[field][index] = value;
    } else {
      block.data[field] = value;
    }
    this.emit('blocks_changed', this.state.blocks);
  }

  setBlocks(newBlocks) {
    this.state.blocks = newBlocks;
    this.emit('blocks_changed', this.state.blocks);
  }

  setSelectedBlock(id) {
    this.state.selectedBlockId = id;
    this.emit('selection_changed', id);
  }

  setMode(mode) {
    this.state.mode = mode;
    this.emit('mode_changed', mode);
  }

  updateTitle(title) {
    this.state.resumeTitle = title;
    this.emit('title_changed', title);
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