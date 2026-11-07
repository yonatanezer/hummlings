// Text-free pictograms (inline SVG strings) so the demo is understandable without reading.
const svg = (body: string, size = 28, extra = '') => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" ${extra}>${body}</svg>`;
export const P = {
  hand: (s = 30) => svg('<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-1a5 5 0 0 1-4-2l-3-4.5a1.6 1.6 0 0 1 2.5-2L9 16" fill="#fff" stroke="#1B1340"/>', s),
  arrowUp: (s = 26) => svg('<path d="M12 20V5M6 11l6-6 6 6"/>', s),
  arrowOut: (s = 26) => svg('<path d="M4 12h14M13 6l6 6-6 6"/>', s),
  speakerOff: (s = 28) => svg('<path d="M5 9v6h4l5 4V5L9 9z" fill="currentColor" stroke="none"/><path d="M17 9l5 6M22 9l-5 6" stroke="#FF6F91"/>', s),
  speaker: (s = 28) => svg('<path d="M5 9v6h4l5 4V5L9 9z" fill="currentColor" stroke="none"/><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11"/>', s),
  slider: (s = 28) => svg('<rect x="9" y="3" width="6" height="18" rx="3" fill="#ffffff33" stroke="none"/><rect x="9" y="12" width="6" height="9" rx="3" fill="#FFC857" stroke="none"/><circle cx="12" cy="12" r="3.4" fill="#fff" stroke="none"/>', s),
  star: (s = 28, c = '#FFE066') => svg('<path d="M12 2.5l2.9 6 6.5.9-4.7 4.6 1.1 6.5L12 17.4 6.2 20.5l1.1-6.5L2.6 9.4l6.5-.9z" fill="' + c + '" stroke="none"/>', s),
  plus: (s = 22) => svg('<path d="M12 5v14M5 12h14"/>', s),
  broom: (s = 28) => svg('<path d="M19 3l-7 8"/><path d="M9.5 10.5l4 4-3 6.5H3l2-5z" fill="currentColor" stroke="none"/><path d="M7 17l2 2"/>', s),
  book: (s = 28) => svg('<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM8 4v13"/><path d="M12.5 8.5l.9 1.7 1.8.3-1.3 1.3.3 1.8-1.7-.9-1.7.9.3-1.8-1.3-1.3 1.8-.3z" fill="#FFE066" stroke="none"/>', s),
  sticker: (s = 28) => svg('<circle cx="12" cy="12" r="9" fill="#FFC857" stroke="#fff"/><path d="M12 6.5l1.7 3.5 3.8.5-2.8 2.6.7 3.8-3.4-1.8-3.4 1.8.7-3.8L6.5 10.5l3.8-.5z" fill="#7A4A00" stroke="none"/>', s),
  question: (s = 28) => svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 17.2v.3"/>', s),
  play: (s = 34) => svg('<path d="M7 4.5l13 7.5-13 7.5z" fill="currentColor" stroke="none"/>', s),
  rotate: (s = 64) => svg('<rect x="8" y="3" width="8" height="14" rx="2"/><path d="M4 14a8 8 0 0 0 5 7M20 10a8 8 0 0 0-5-7M9 21l-3-.5.5-3M15 3l3 .5-.5 3"/>', s),
  swipe: (s = 26) => svg('<path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/>', s),
  tapRing: (s = 26) => svg('<circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="8" opacity=".5"/>', s),
  holdRing: (s = 26) => svg('<circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 2.4"/>', s),
  dots: (n: number, total = 4, c = '#FFC857') => `<span class="dd">${Array.from({ length: total }, (_, i) => `<i style="background:${i < n ? c : 'rgba(255,255,255,.2)'}"></i>`).join('')}</span>`,
};
