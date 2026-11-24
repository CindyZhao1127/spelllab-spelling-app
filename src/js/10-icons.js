/* ---------------- 图标 ---------------- */
const PATHS = {
  left:'<path d="M15 18l-6-6 6-6"/>',
  right:'<path d="M9 18l6-6-6-6"/>',
  volume:'<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 010 7"/><path d="M18.5 5.5a9 9 0 010 13"/>',
  mic:'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0014 0"/><path d="M12 17v5M8 22h8"/>',
  bulb:'<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/>',
  eye:'<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff:'<path d="M17.9 17.9A10.4 10.4 0 0112 19C5 19 1 12 1 12a18 18 0 015.1-5.9"/><path d="M9.9 4.2A10 10 0 0112 4c7 0 11 7 11 7a17 17 0 01-2.2 3.2"/><path d="M1 1l22 22"/>',
  refresh:'<path d="M3 12a9 9 0 0115.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 01-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>',
  check:'<path d="M20 6L9 17l-5-5"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  close:'<path d="M18 6L6 18M6 6l12 12"/>',
  shuffle:'<path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L21 2"/><path d="M18 5l3 3"/><path d="M15 8l3 3"/>',
  book:'<path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>',
  star:'<path d="M12 2.5l2.9 6 6.6 1-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.1 1.2-6.6-4.8-4.6 6.6-1z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
  play:'<path d="M7 4l13 8-13 8z"/>'
};
function icon(name){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+PATHS[name]+'</svg>';}
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

