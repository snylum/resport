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
export const PORTFOLIO_DEFAULT_DESIGN = { accent: '#7C4DFF', headingFont: 'modern', bodyFont: 'sans', headerStyle: 'scroll', sectionAnimation: 'none', contentWidth: 'contained', heroAlign: 'left', dotsPosition: 'right' };

// Portfolio templates: unlike résumé templates (which change structural
// layout — columns, alignment), the portfolio has one adaptive layout,
// so a "template" here is a coordinated bundle across every themeable
// design axis (accent, font pairing, header behavior, section motion,
// content width) tuned toward how a given field actually presents
// itself — a designer's page should feel different from an engineer's
// or a teacher's, not just wear a different accent color.
export const PORTFOLIO_TEMPLATES = [
  {
    id: 'general',
    name: 'General / Default',
    tagline: 'Balanced, works for any field',
    icon: '✦',
    design: { ...PORTFOLIO_DEFAULT_DESIGN }
  },
  {
    id: 'tech',
    name: 'Tech / Developer',
    tagline: 'Monospace accents, pinned header',
    icon: '💻',
    design: { accent: '#7C4DFF', headingFont: 'modern', bodyFont: 'mono', headerStyle: 'pinned', sectionAnimation: 'fade-up', contentWidth: 'wide' }
  },
  {
    id: 'engineering',
    name: 'Engineering',
    tagline: 'Precise, structured, no-frills',
    icon: '⚙️',
    design: { accent: '#33475B', headingFont: 'mono', bodyFont: 'sans', headerStyle: 'pinned', sectionAnimation: 'none', contentWidth: 'wide' }
  },
  {
    id: 'educator',
    name: 'Educator',
    tagline: 'Warm serif, academic feel',
    icon: '🎓',
    design: { accent: '#1E3A5F', headingFont: 'serif', bodyFont: 'serif', headerStyle: 'scroll', sectionAnimation: 'fade-up', contentWidth: 'contained' }
  },
  {
    id: 'virtual-assistant',
    name: 'Virtual Assistant',
    tagline: 'Friendly, approachable, tidy',
    icon: '🗂️',
    design: { accent: '#00A896', headingFont: 'sans', bodyFont: 'sans', headerStyle: 'scroll', sectionAnimation: 'none', contentWidth: 'contained' }
  },
  {
    id: 'customer-service',
    name: 'Customer Service',
    tagline: 'Warm coral, easy to read',
    icon: '🎧',
    design: { accent: '#FF6F59', headingFont: 'sans', bodyFont: 'sans', headerStyle: 'scroll', sectionAnimation: 'fade-up', contentWidth: 'contained' }
  },
  {
    id: 'arts-design',
    name: 'Arts & Design',
    tagline: 'Full-bleed gallery slides',
    icon: '🎨',
    design: { accent: '#C0392B', headingFont: 'modern', bodyFont: 'sans', headerStyle: 'pinned', sectionAnimation: 'horizontal', contentWidth: 'full' }
  },
  {
    id: 'marketing',
    name: 'Marketing / Creative',
    tagline: 'Gold accent, horizontal story',
    icon: '📣',
    design: { accent: '#B8860B', headingFont: 'modern', bodyFont: 'sans', headerStyle: 'scroll', sectionAnimation: 'horizontal', contentWidth: 'wide' }
  },
  {
    id: 'corporate',
    name: 'Corporate / Consulting',
    tagline: 'Minimal ink, serif headings',
    icon: '💼',
    design: { accent: '#1A1A1A', headingFont: 'serif', bodyFont: 'sans', headerStyle: 'scroll', sectionAnimation: 'none', contentWidth: 'contained', heroAlign: 'left' }
  },
  {
    id: 'photography',
    name: 'Photography / Visual Arts',
    tagline: 'Centered hero, full-bleed slides',
    icon: '📷',
    design: { accent: '#111111', headingFont: 'modern', bodyFont: 'sans', headerStyle: 'pinned', sectionAnimation: 'horizontal', contentWidth: 'full', heroAlign: 'center' }
  },
  {
    id: 'legal',
    name: 'Legal',
    tagline: 'Formal serif, centered letterhead',
    icon: '⚖️',
    design: { accent: '#0B2545', headingFont: 'serif', bodyFont: 'serif', headerStyle: 'scroll', sectionAnimation: 'none', contentWidth: 'contained', heroAlign: 'center' }
  },
  {
    id: 'healthcare',
    name: 'Healthcare / Medical',
    tagline: 'Calm teal, clean and legible',
    icon: '⚕️',
    design: { accent: '#2A9D8F', headingFont: 'sans', bodyFont: 'sans', headerStyle: 'pinned', sectionAnimation: 'fade-up', contentWidth: 'contained', heroAlign: 'left' }
  },
  {
    id: 'finance',
    name: 'Finance / Banking',
    tagline: 'Deep green, right-aligned card',
    icon: '📊',
    design: { accent: '#14532D', headingFont: 'serif', bodyFont: 'sans', headerStyle: 'scroll', sectionAnimation: 'none', contentWidth: 'wide', heroAlign: 'right' }
  },
  {
    id: 'writer',
    name: 'Writer / Journalist',
    tagline: 'Editorial serif, narrow column',
    icon: '✍️',
    design: { accent: '#7A1F2B', headingFont: 'serif', bodyFont: 'serif', headerStyle: 'scroll', sectionAnimation: 'fade-up', contentWidth: 'contained', heroAlign: 'center' }
  },
  {
    id: 'music',
    name: 'Music / Performing Arts',
    tagline: 'Bold accent, full-bleed slide deck',
    icon: '🎤',
    design: { accent: '#D62839', headingFont: 'modern', bodyFont: 'sans', headerStyle: 'pinned', sectionAnimation: 'horizontal', contentWidth: 'full', heroAlign: 'center' }
  },
  {
    id: 'realestate',
    name: 'Real Estate / Sales',
    tagline: 'Confident gold, pinned header',
    icon: '🏡',
    design: { accent: '#A47148', headingFont: 'modern', bodyFont: 'sans', headerStyle: 'pinned', sectionAnimation: 'none', contentWidth: 'wide', heroAlign: 'right' }
  },
  {
    id: 'fitness',
    name: 'Fitness / Coaching',
    tagline: 'High-energy orange, slide story',
    icon: '💪',
    design: { accent: '#E85D04', headingFont: 'modern', bodyFont: 'sans', headerStyle: 'scroll', sectionAnimation: 'horizontal', contentWidth: 'full', heroAlign: 'left' }
  },
  {
    id: 'nonprofit',
    name: 'Nonprofit / Social Impact',
    tagline: 'Earthy green, warm and grounded',
    icon: '🌱',
    design: { accent: '#4C7A3F', headingFont: 'serif', bodyFont: 'sans', headerStyle: 'scroll', sectionAnimation: 'fade-up', contentWidth: 'contained', heroAlign: 'center' }
  },
  {
    id: 'academic',
    name: 'Academic / Research',
    tagline: 'Understated navy, dense reading column',
    icon: '📚',
    design: { accent: '#22314A', headingFont: 'serif', bodyFont: 'serif', headerStyle: 'pinned', sectionAnimation: 'none', contentWidth: 'contained', heroAlign: 'left' }
  }
].map(t => ({ category: 'style', ...t }));

// ── Structural portfolio layouts ──────────────────────────────
// Unlike the templates above (which only re-theme color/font/motion
// on the same adaptive block layout), these change the actual page
// structure — e.g. adding a photo gallery grid — while still being a
// normal, editable portfolio underneath. Kept in a separate list so
// the Customize gallery can show "Templates" (style) and "Layouts"
// (structure) as distinct groups.
export const PORTFOLIO_STRUCTURAL_TEMPLATES = [
  {
    id: 'photo-gallery',
    name: 'Photo Gallery',
    tagline: 'Adds a visual grid of work samples',
    icon: '🖼️',
    category: 'structural',
    addsBlockTypes: ['gallery'],
    design: { accent: '#111111', headingFont: 'modern', bodyFont: 'sans', headerStyle: 'pinned', sectionAnimation: 'none', contentWidth: 'wide', heroAlign: 'center' }
  },
  {
    id: 'gallery-slideshow',
    name: 'Gallery Slideshow',
    tagline: 'Photo grid inside a horizontal slide deck',
    icon: '🎞️',
    category: 'structural',
    addsBlockTypes: ['gallery'],
    design: { accent: '#7C4DFF', headingFont: 'modern', bodyFont: 'sans', headerStyle: 'pinned', sectionAnimation: 'horizontal', contentWidth: 'full', heroAlign: 'center' }
  },
  {
    id: 'video-reel',
    name: 'Video Reel / Filmmaker',
    tagline: 'Adds a featured video embed up top',
    icon: '🎬',
    category: 'structural',
    addsBlockTypes: ['video'],
    design: { accent: '#111111', headingFont: 'modern', bodyFont: 'sans', headerStyle: 'pinned', sectionAnimation: 'fade-up', contentWidth: 'wide', heroAlign: 'center' }
  },
  {
    id: 'case-study-links',
    name: 'Case Study / UX Design',
    tagline: 'Project gallery plus links out to full case studies',
    icon: '🧩',
    category: 'structural',
    addsBlockTypes: ['gallery', 'links'],
    design: { accent: '#3D5A80', headingFont: 'modern', bodyFont: 'sans', headerStyle: 'scroll', sectionAnimation: 'fade-up', contentWidth: 'contained', heroAlign: 'left' }
  },
  {
    id: 'music-podcast',
    name: 'Music / Podcast',
    tagline: 'Embedded track plus streaming platform links',
    icon: '🎙️',
    category: 'structural',
    addsBlockTypes: ['video', 'links'],
    design: { accent: '#D62839', headingFont: 'modern', bodyFont: 'sans', headerStyle: 'pinned', sectionAnimation: 'horizontal', contentWidth: 'full', heroAlign: 'center' }
  },
  {
    id: 'coaching-showcase',
    name: 'Coaching / Course Creator',
    tagline: 'Testimonial video plus a booking or enrollment link',
    icon: '🎯',
    category: 'structural',
    addsBlockTypes: ['video', 'links'],
    design: { accent: '#E85D04', headingFont: 'modern', bodyFont: 'sans', headerStyle: 'scroll', sectionAnimation: 'fade-up', contentWidth: 'contained', heroAlign: 'left' }
  },
  {
    id: 'social-proof',
    name: 'Social Media / Influencer',
    tagline: 'Content grid plus links to every social profile',
    icon: '📱',
    category: 'structural',
    addsBlockTypes: ['gallery', 'links'],
    design: { accent: '#C0392B', headingFont: 'modern', bodyFont: 'sans', headerStyle: 'pinned', sectionAnimation: 'horizontal', contentWidth: 'full', heroAlign: 'center' }
  },
  {
    id: 'project-gallery-plus',
    name: 'Architecture / Interior Design',
    tagline: 'Project photo gallery plus links to floor plans or listings',
    icon: '🏛️',
    category: 'structural',
    addsBlockTypes: ['gallery', 'links'],
    design: { accent: '#33475B', headingFont: 'serif', bodyFont: 'sans', headerStyle: 'scroll', sectionAnimation: 'none', contentWidth: 'wide', heroAlign: 'left' }
  },
  {
    id: 'app-demo',
    name: 'Software / App Showcase',
    tagline: 'Product demo video plus store and repo links',
    icon: '💾',
    category: 'structural',
    addsBlockTypes: ['video', 'links'],
    design: { accent: '#7C4DFF', headingFont: 'mono', bodyFont: 'sans', headerStyle: 'pinned', sectionAnimation: 'fade-up', contentWidth: 'wide', heroAlign: 'left' }
  },
  {
    id: 'speaker-reel',
    name: 'Public Speaking / Author',
    tagline: 'Speaker reel video plus press and book links',
    icon: '🎤',
    category: 'structural',
    addsBlockTypes: ['video', 'links'],
    design: { accent: '#0B2545', headingFont: 'serif', bodyFont: 'serif', headerStyle: 'scroll', sectionAnimation: 'none', contentWidth: 'contained', heroAlign: 'center' }
  },
  {
    id: 'recipe-gallery',
    name: 'Culinary / Chef',
    tagline: 'Dish photo gallery plus an embedded cooking video',
    icon: '👨‍🍳',
    category: 'structural',
    addsBlockTypes: ['gallery', 'video'],
    design: { accent: '#B8860B', headingFont: 'serif', bodyFont: 'sans', headerStyle: 'scroll', sectionAnimation: 'fade-up', contentWidth: 'wide', heroAlign: 'center' }
  },
  {
    id: 'impact-story',
    name: 'Nonprofit / Fundraising',
    tagline: 'Impact photos, a story video, and a donate link',
    icon: '🌍',
    category: 'structural',
    addsBlockTypes: ['gallery', 'video', 'links'],
    design: { accent: '#4C7A3F', headingFont: 'serif', bodyFont: 'sans', headerStyle: 'scroll', sectionAnimation: 'fade-up', contentWidth: 'contained', heroAlign: 'center' }
  }
];

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
  { type: 'custom', label: 'Custom Text Block', makeData: () => ({ title: 'Custom Section', text: 'Add any additional information here.' }) },
  { type: 'gallery', label: 'Photo Gallery', makeData: () => ({ photos: [] }) },
  { type: 'video', label: 'Embedded Video', makeData: () => ({ url: '', caption: '' }) },
  { type: 'links', label: 'Embedded Links', makeData: () => ({ items: [{ label: 'Website', url: '' }] }) }
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

// ── Sample content library for the Randomize feature ────────────
// Short, factual, own-words summaries of real Nobel laureates and
// other widely-known changemakers, reshaped as resume/portfolio
// content purely as inspiring placeholder/demo data. Every "Randomize"
// click picks one at random (plus a random accent/font pairing) so
// people never stare at the same blank "Juan Lala" starter twice.
export const SAMPLE_PROFILES = [
  {
    profile: { jobTitle: 'Education Activist & Author', firstName: 'Malala', lastName: 'Yousafzai', email: 'malala@example.com', phone: '', address: 'Birmingham, UK', photo: null, tagline: 'Fighting for every girl\'s right to 12 years of free, safe, quality education.' },
    blocks: [
      { type: 'summary', data: { text: 'Education advocate and youngest-ever Nobel Prize laureate, working globally to expand access to schooling for girls affected by conflict, poverty, and discrimination.' } },
      { type: 'section', data: { title: 'Experience' } },
      { type: 'experience', data: { company: 'Malala Fund', role: 'Co-Founder', location: 'Birmingham, UK', dates: '2013 – Present', bullets: ['Built a global fund investing in local education programs and advocates across multiple countries.', 'Advocated to world leaders and institutions for policy change on girls\' education access.'], verify: emptyVerify() } },
      { type: 'section', data: { title: 'Recognition' } },
      { type: 'custom', data: { title: 'Nobel Peace Prize (2014)', text: 'Awarded jointly for the struggle against the suppression of children and young people, and for the right of all children to education.' } },
      { type: 'section', data: { title: 'Education' } },
      { type: 'education', data: { school: 'University of Oxford', degree: 'B.A. Philosophy, Politics & Economics', location: 'Oxford, UK', year: '2020', gpa: '' } },
      { type: 'section', data: { title: 'Skills' } },
      { type: 'skills', data: { items: ['Public Speaking', 'Policy Advocacy', 'Fundraising', 'Writing', 'Nonprofit Leadership'] } }
    ]
  },
  {
    profile: { jobTitle: 'Physicist & Chemist', firstName: 'Marie', lastName: 'Curie', email: 'marie.curie@example.com', phone: '', address: 'Paris, France', photo: null, tagline: 'Pioneering research on radioactivity, in the lab and against the odds.' },
    blocks: [
      { type: 'summary', data: { text: 'Physicist and chemist whose research on radioactivity opened an entirely new field of science and led to major advances in medicine and physics.' } },
      { type: 'section', data: { title: 'Experience' } },
      { type: 'experience', data: { company: 'University of Paris', role: 'Professor of General Physics', location: 'Paris, France', dates: '1906 – 1934', bullets: ['First woman appointed to a professorship at the University of Paris.', 'Directed research into the properties and applications of radioactive elements.'], verify: emptyVerify() } },
      { type: 'section', data: { title: 'Recognition' } },
      { type: 'custom', data: { title: 'Nobel Prizes in Physics (1903) & Chemistry (1911)', text: 'The first person to win Nobel Prizes in two different sciences, recognized for foundational work on radioactivity and the discovery of polonium and radium.' } },
      { type: 'section', data: { title: 'Education' } },
      { type: 'education', data: { school: 'University of Paris (Sorbonne)', degree: 'Degrees in Physics & Mathematics', location: 'Paris, France', year: '1894', gpa: '' } },
      { type: 'section', data: { title: 'Skills' } },
      { type: 'skills', data: { items: ['Experimental Physics', 'Radiochemistry', 'Scientific Research', 'Mentorship', 'Laboratory Management'] } }
    ]
  },
  {
    profile: { jobTitle: 'President & Anti-Apartheid Leader', firstName: 'Nelson', lastName: 'Mandela', email: 'nelson.mandela@example.com', phone: '', address: 'Johannesburg, South Africa', photo: null, tagline: 'Leading the long walk from resistance to reconciliation.' },
    blocks: [
      { type: 'summary', data: { text: 'Lawyer and anti-apartheid leader who spent 27 years as a political prisoner before becoming South Africa\'s first democratically elected president, championing reconciliation and human rights.' } },
      { type: 'section', data: { title: 'Experience' } },
      { type: 'experience', data: { company: 'Government of South Africa', role: 'President', location: 'Pretoria, South Africa', dates: '1994 – 1999', bullets: ['Led South Africa\'s transition from apartheid to multiracial democracy.', 'Established the Truth and Reconciliation Commission to address the era\'s human rights abuses.'], verify: emptyVerify() } },
      { type: 'section', data: { title: 'Recognition' } },
      { type: 'custom', data: { title: 'Nobel Peace Prize (1993)', text: 'Awarded jointly for work toward the peaceful termination of the apartheid regime and for laying the foundations for a new, democratic South Africa.' } },
      { type: 'section', data: { title: 'Education' } },
      { type: 'education', data: { school: 'University of London (External Programme)', degree: 'LL.B. Law', location: 'London, UK', year: '1989', gpa: '' } },
      { type: 'section', data: { title: 'Skills' } },
      { type: 'skills', data: { items: ['Leadership', 'Negotiation', 'Public Policy', 'Law', 'Reconciliation & Mediation'] } }
    ]
  },
  {
    profile: { jobTitle: 'Environmentalist & Founder', firstName: 'Wangari', lastName: 'Maathai', email: 'wangari.maathai@example.com', phone: '', address: 'Nairobi, Kenya', photo: null, tagline: 'Planting trees, and with them, peace, democracy, and sustainable development.' },
    blocks: [
      { type: 'summary', data: { text: 'Environmental and political activist who linked grassroots tree-planting to community empowerment, sustainable development, and democratic governance across Africa.' } },
      { type: 'section', data: { title: 'Experience' } },
      { type: 'experience', data: { company: 'Green Belt Movement', role: 'Founder', location: 'Nairobi, Kenya', dates: '1977 – 2011', bullets: ['Founded a grassroots organization that has supported the planting of tens of millions of trees across Kenya.', 'Trained thousands of women in forestry, food processing, and other trades to earn income while conserving the environment.'], verify: emptyVerify() } },
      { type: 'section', data: { title: 'Recognition' } },
      { type: 'custom', data: { title: 'Nobel Peace Prize (2004)', text: 'The first African woman to receive the prize, honored for her contribution to sustainable development, democracy, and peace.' } },
      { type: 'section', data: { title: 'Education' } },
      { type: 'education', data: { school: 'University of Nairobi', degree: 'Ph.D. Veterinary Anatomy', location: 'Nairobi, Kenya', year: '1971', gpa: '' } },
      { type: 'section', data: { title: 'Skills' } },
      { type: 'skills', data: { items: ['Community Organizing', 'Environmental Policy', 'Nonprofit Leadership', 'Public Speaking', 'Sustainable Development'] } }
    ]
  },
  {
    profile: { jobTitle: 'Child Rights Activist', firstName: 'Kailash', lastName: 'Satyarthi', email: 'kailash.satyarthi@example.com', phone: '', address: 'New Delhi, India', photo: null, tagline: 'Working to end child labor and trafficking, one rescue and one law at a time.' },
    blocks: [
      { type: 'summary', data: { text: 'Children\'s rights advocate who has led rescue operations and policy campaigns against child labor and trafficking for over three decades.' } },
      { type: 'section', data: { title: 'Experience' } },
      { type: 'experience', data: { company: 'Bachpan Bachao Andolan (Save the Childhood Movement)', role: 'Founder', location: 'New Delhi, India', dates: '1980 – Present', bullets: ['Helped coordinate the rescue of tens of thousands of children from forced labor and trafficking.', 'Campaigned for international standards and legislation on child labor and education.'], verify: emptyVerify() } },
      { type: 'section', data: { title: 'Recognition' } },
      { type: 'custom', data: { title: 'Nobel Peace Prize (2014)', text: 'Awarded jointly for the struggle against the suppression of children and young people, and for the right of all children to education.' } },
      { type: 'section', data: { title: 'Education' } },
      { type: 'education', data: { school: 'Samrat Ashok Technological Institute', degree: 'B.E. Electrical Engineering', location: 'Vidisha, India', year: '1972', gpa: '' } },
      { type: 'section', data: { title: 'Skills' } },
      { type: 'skills', data: { items: ['Human Rights Advocacy', 'Nonprofit Leadership', 'Public Policy', 'Crisis Response', 'Coalition Building'] } }
    ]
  },
  {
    profile: { jobTitle: 'Economist & Microfinance Pioneer', firstName: 'Muhammad', lastName: 'Yunus', email: 'muhammad.yunus@example.com', phone: '', address: 'Dhaka, Bangladesh', photo: null, tagline: 'Proving that credit, not charity, can be a human right.' },
    blocks: [
      { type: 'summary', data: { text: 'Economist and social entrepreneur who pioneered microcredit and microfinance as tools for lifting families out of poverty through small, collateral-free loans.' } },
      { type: 'section', data: { title: 'Experience' } },
      { type: 'experience', data: { company: 'Grameen Bank', role: 'Founder & Managing Director', location: 'Dhaka, Bangladesh', dates: '1983 – 2011', bullets: ['Built a bank extending small loans to millions of borrowers without requiring collateral.', 'Popularized the microfinance model that has since been adapted in dozens of countries.'], verify: emptyVerify() } },
      { type: 'section', data: { title: 'Recognition' } },
      { type: 'custom', data: { title: 'Nobel Peace Prize (2006)', text: 'Awarded jointly for efforts to create economic and social development from below through microcredit.' } },
      { type: 'section', data: { title: 'Education' } },
      { type: 'education', data: { school: 'Vanderbilt University', degree: 'Ph.D. Economics', location: 'Nashville, TN, USA', year: '1971', gpa: '' } },
      { type: 'section', data: { title: 'Skills' } },
      { type: 'skills', data: { items: ['Microfinance', 'Economic Policy', 'Social Entrepreneurship', 'Organizational Leadership', 'Financial Inclusion'] } }
    ]
  },
  {
    profile: { jobTitle: 'Political Economist', firstName: 'Elinor', lastName: 'Ostrom', email: 'elinor.ostrom@example.com', phone: '', address: 'Bloomington, IN, USA', photo: null, tagline: 'Studying how communities govern shared resources without top-down control.' },
    blocks: [
      { type: 'summary', data: { text: 'Political economist whose research on how communities successfully self-manage shared resources reshaped economic thinking on governance and the commons.' } },
      { type: 'section', data: { title: 'Experience' } },
      { type: 'experience', data: { company: 'Indiana University', role: 'Professor of Political Science', location: 'Bloomington, IN, USA', dates: '1965 – 2012', bullets: ['Co-founded the Workshop in Political Theory and Policy Analysis to study institutions and collective action.', 'Conducted fieldwork on community-managed forests, fisheries, and irrigation systems worldwide.'], verify: emptyVerify() } },
      { type: 'section', data: { title: 'Recognition' } },
      { type: 'custom', data: { title: 'Nobel Memorial Prize in Economic Sciences (2009)', text: 'The first woman to receive the prize, recognized for her analysis of economic governance, especially the commons.' } },
      { type: 'section', data: { title: 'Education' } },
      { type: 'education', data: { school: 'University of California, Los Angeles', degree: 'Ph.D. Political Science', location: 'Los Angeles, CA, USA', year: '1965', gpa: '' } },
      { type: 'section', data: { title: 'Skills' } },
      { type: 'skills', data: { items: ['Institutional Analysis', 'Field Research', 'Policy Analysis', 'Academic Writing', 'Collective Action Theory'] } }
    ]
  },
  {
    profile: { jobTitle: 'Indigenous Rights Activist', firstName: 'Rigoberta', lastName: 'Menchú Tum', email: 'rigoberta.menchu@example.com', phone: '', address: 'Guatemala City, Guatemala', photo: null, tagline: 'Advocating for the rights and reconciliation of Indigenous peoples.' },
    blocks: [
      { type: 'summary', data: { text: 'Indigenous rights advocate who has campaigned internationally for the rights, land, and cultural recognition of Indigenous peoples in Guatemala and beyond.' } },
      { type: 'section', data: { title: 'Experience' } },
      { type: 'experience', data: { company: 'Rigoberta Menchú Tum Foundation', role: 'Founder', location: 'Guatemala City, Guatemala', dates: '1993 – Present', bullets: ['Advocated for Indigenous rights and social reconciliation following Guatemala\'s civil conflict.', 'Represented Indigenous rights issues before international bodies including the United Nations.'], verify: emptyVerify() } },
      { type: 'section', data: { title: 'Recognition' } },
      { type: 'custom', data: { title: 'Nobel Peace Prize (1992)', text: 'Awarded in recognition of work for social justice and ethno-cultural reconciliation based on respect for the rights of Indigenous peoples.' } },
      { type: 'section', data: { title: 'Education' } },
      { type: 'education', data: { school: 'Self-taught / community education', degree: 'Community & Cultural Studies', location: 'Guatemala', year: '—', gpa: '' } },
      { type: 'section', data: { title: 'Skills' } },
      { type: 'skills', data: { items: ['Human Rights Advocacy', 'Public Speaking', 'Community Organizing', 'Cross-Cultural Communication', 'International Relations'] } }
    ]
  }
];

// Placeholder media used by randomExtraBlocks() below — real,
// working images/video so "Randomize" never leaves the gallery,
// video, or links sections looking empty or broken.
const RANDOM_GALLERY_SEEDS = ['studio', 'workshop', 'field', 'lab', 'campus', 'stage'];
const RANDOM_YOUTUBE_URLS = [
  { url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', caption: 'Big Buck Bunny — Blender Foundation (sample embed)' },
  { url: 'https://www.youtube.com/watch?v=YE7VzlLtp-4', caption: 'Big Buck Bunny trailer — Blender Foundation (sample embed)' }
];
const RANDOM_LINK_SETS = [
  [{ label: 'Portfolio site', url: 'https://example.com' }, { label: 'GitHub', url: 'https://github.com/example' }, { label: 'LinkedIn', url: 'https://linkedin.com/in/example' }],
  [{ label: 'Personal site', url: 'https://example.org' }, { label: 'Twitter / X', url: 'https://x.com/example' }, { label: 'Press feature', url: 'https://example.com/press' }]
];

// Every remaining block type (gallery, video, links) filled with
// placeholder content — appended to whichever sample profile
// Randomize picks, each under its own section heading.
function randomExtraBlocks() {
  const seed = RANDOM_GALLERY_SEEDS[Math.floor(Math.random() * RANDOM_GALLERY_SEEDS.length)];
  const video = RANDOM_YOUTUBE_URLS[Math.floor(Math.random() * RANDOM_YOUTUBE_URLS.length)];
  const links = RANDOM_LINK_SETS[Math.floor(Math.random() * RANDOM_LINK_SETS.length)];
  return [
    { id: uid(), type: 'section', col: 'main', data: { title: 'Gallery' } },
    { id: uid(), type: 'gallery', col: 'main', data: { photos: [1, 2, 3].map(n => `https://picsum.photos/seed/${seed}${n}/600/400`) } },
    { id: uid(), type: 'section', col: 'main', data: { title: 'Video' } },
    { id: uid(), type: 'video', col: 'main', data: { url: video.url, caption: video.caption } },
    { id: uid(), type: 'section', col: 'main', data: { title: 'Links' } },
    { id: uid(), type: 'links', col: 'main', data: { items: deepClone(links) } }
  ];
}

// A curated set of accent/font pairings drawn from the résumé
// templates above, used to randomize the look alongside the content.
export const SAMPLE_STYLES = [
  { accent: '#1A1A1A', headingFont: 'sans', bodyFont: 'sans' },
  { accent: '#1E3A5F', headingFont: 'serif', bodyFont: 'serif' },
  { accent: '#00693E', headingFont: 'modern', bodyFont: 'sans' },
  { accent: '#33475B', headingFont: 'sans', bodyFont: 'sans' },
  { accent: '#7C4DFF', headingFont: 'modern', bodyFont: 'sans' },
  { accent: '#B8860B', headingFont: 'classic', bodyFont: 'serif' },
  { accent: '#C0392B', headingFont: 'modern', bodyFont: 'sans' }
];

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
        template: 'general',
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
    } else if (Array.isArray(block.data[field])) {
      // Guard: never let a list field (bullets, skills, entries) get
      // clobbered by a scalar write that lost its index — that would
      // silently wipe every item in the list.
      return;
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

  // Portfolio templates apply a coordinated design bundle (accent,
  // fonts, header behavior, section motion, content width) in one
  // click — same idea as résumé templates, just themed toward a
  // field instead of a structural layout.
  setPortfolioTemplate(id) {
    if (this.state.viewMode !== 'portfolio') return;
    const t = PORTFOLIO_TEMPLATES.find(x => x.id === id) || PORTFOLIO_STRUCTURAL_TEMPLATES.find(x => x.id === id);
    if (!t) return;
    this.state.portfolio.template = id;
    this.state.portfolio.design = { ...t.design };
    // Structural layouts (e.g. Photo Gallery) add a block type that
    // isn't part of the adaptive default layout — only append it if
    // one isn't already present, so re-picking the layout never
    // duplicates it.
    (t.addsBlockTypes || []).forEach(blockType => {
      const alreadyHas = this.state.portfolio.blocks.some(b => b.type === blockType);
      if (!alreadyHas) {
        const lib = BLOCK_LIBRARY.find(b => b.type === blockType);
        if (lib) {
          this.state.portfolio.blocks.push({ id: uid(), type: blockType, col: 'main', data: lib.makeData() });
        }
      }
    });
    this.emit('template_changed', id);
    this.emit('design_changed', this.state.portfolio.design);
    this.emit('blocks_changed');
  }

  setDesign(key, value) {
    this.active().design[key] = value;
    this.emit('design_changed', this.active().design);
  }

  // ── Randomize / Reset (sample content) ───────────────────────
  // Picks a random inspiring-figure sample profile + a random style,
  // and applies it to whichever document (portfolio or resume) is
  // currently active. IDs are re-generated so drag/select/verify
  // state never collides with whatever was there before.
  randomizeContent() {
    const sample = SAMPLE_PROFILES[Math.floor(Math.random() * SAMPLE_PROFILES.length)];
    const style = SAMPLE_STYLES[Math.floor(Math.random() * SAMPLE_STYLES.length)];
    const doc = this.active();

    doc.profile = deepClone(sample.profile);
    // Sample profiles don't carry a real uploaded photo — drop in a
    // placeholder avatar so "Randomize" never leaves the photo slot
    // looking broken/empty either.
    if (!doc.profile.photo) {
      doc.profile.photo = `https://picsum.photos/seed/${encodeURIComponent(doc.profile.firstName + doc.profile.lastName)}/400/400`;
    }
    doc.blocks = ensureVerifyShape([
      ...sample.blocks.map(b => ({
        id: uid(),
        type: b.type,
        col: 'main',
        data: deepClone(b.data)
      })),
      // The curated samples only demonstrate the text-based block
      // types. Append one of every remaining block type — gallery,
      // video (with a working YouTube embed), and links — filled with
      // placeholder content, so Randomize always shows off every
      // feature/section instead of leaving them empty.
      ...randomExtraBlocks()
    ]);

    if (this.state.viewMode === 'resume') {
      doc.design = { ...doc.design, accent: style.accent, headingFont: style.headingFont, bodyFont: style.bodyFont };
    } else {
      doc.design = { accent: style.accent, headingFont: style.headingFont, bodyFont: style.bodyFont };
    }

    this.state.selectedBlockId = null;
    this.emit('profile_changed', doc.profile);
    this.emit('blocks_changed', doc.blocks);
    this.emit('design_changed', doc.design);
    return sample.profile.firstName + ' ' + sample.profile.lastName;
  }

  // Restores the original "Juan Lala" starter content on whichever
  // document is active — a clean, known-good baseline to get back to.
  resetContent() {
    const vm = this.state.viewMode;
    if (vm === 'resume') {
      this.state.resume = {
        resumeTitle: this.state.resume.resumeTitle,
        profile: { ...defaultProfile },
        blocks: ensureVerifyShape(deepClone(defaultBlocks)),
        template: TEMPLATES[0].id,
        design: { ...TEMPLATES[0].design }
      };
    } else {
      this.state.portfolio.profile = { ...defaultProfile };
      this.state.portfolio.blocks = ensureVerifyShape(deepClone(defaultBlocks));
      this.state.portfolio.template = 'general';
      this.state.portfolio.design = { ...PORTFOLIO_DEFAULT_DESIGN };
    }
    this.state.selectedBlockId = null;
    const doc = this.active();
    this.emit('profile_changed', doc.profile);
    this.emit('blocks_changed', doc.blocks);
    this.emit('design_changed', doc.design);
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
