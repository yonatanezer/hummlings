/** One small emblem per world, as SVG shapes on a 24x24 grid. Used by the app (Skia paths) and the web demo (inline SVG). */
export interface IconShape { d: string; fill?: string; stroke?: string; width?: number }

export const WORLD_ICONS: Record<string, IconShape[]> = {
  // Moonlit Pond: full moon over rippling water with a lily pad and a reed
  pond: [
    { d: 'M16.5 3.5a4.6 4.6 0 1 0 0.01 0z', fill: '#FFF2B8' },
    { d: 'M13.8 5.2a1 1 0 1 0 0.01 0zM17.8 8a0.8 0.8 0 1 0 0.01 0z', fill: '#E5D58C' },
    { d: 'M2.5 15.5c2.2-2 4.3 2 6.5 0s4.3 2 6.5 0 4.3 2 6.5 0', stroke: '#7FE3FF', width: 1.9 },
    { d: 'M3 20.5c2.2-1.6 4.3 1.6 6.5 0s4.3 1.6 6.5 0 3.6 1 5 0', stroke: '#4FA8D8', width: 1.7 },
    { d: 'M4 19a3 1.5 0 1 0 6 0a3 1.5 0 1 0-6 0z', fill: '#5FE3C0' },
    { d: 'M19.5 18.5V11', stroke: '#8A5A3C', width: 1.6 },
    { d: 'M19.5 9.2a1.1 2 0 1 0 0.01 0z', fill: '#B07A4C' },
  ],
  // Candy Fair: ferris wheel with colourful gondolas
  fair: [
    { d: 'M12 12.5L6.5 22.5M12 12.5l5.5 10', stroke: '#FFD6E8', width: 1.7 },
    { d: 'M12 3.5a8.5 8.5 0 1 0 0.01 0z', stroke: '#FFD6E8', width: 1.8 },
    { d: 'M12 3.5v18M3.5 12h17M6 6l12 12M18 6L6 18', stroke: '#FFD6E8', width: 1.1 },
    { d: 'M10.4 2.2h3.2v2.6h-3.2z', fill: '#FF7AA8' },
    { d: 'M19 10.7h3.2v2.6H19z', fill: '#FFC857' },
    { d: 'M10.4 19.2h3.2v2.6h-3.2z', fill: '#5FE3C0' },
    { d: 'M1.8 10.7H5v2.6H1.8z', fill: '#7A8CFF' },
    { d: 'M12 12m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0', fill: '#FFC857' },
  ],
  // Sleepy Cloud Town: puffy cloud with a crescent moon and a star
  clouds: [
    { d: 'M20.2 3.2a4.4 4.4 0 1 0 2 7.6 5.6 5.6 0 0 1-2-7.6z', fill: '#FFE8A3' },
    { d: 'M6.6 20.5a4.3 4.3 0 0 1-.6-8.5 5.6 5.6 0 0 1 10.6-.6 3.6 3.6 0 0 1 .8 7.1z', fill: '#E8F6FF' },
    { d: 'M8 17.6h8.6', stroke: '#B9D8F0', width: 1.4 },
    { d: 'M5 4.5l.7 1.5 1.6.2-1.2 1.1.3 1.6L5 8l-1.4.9.3-1.6L2.7 6.2 4.3 6z', fill: '#FFFFFF' },
  ],
  // Neon City: skyline with glowing windows and a neon moon
  neon: [
    { d: 'M17.5 3.5a3.4 3.4 0 1 0 0.01 0z', stroke: '#FF4DD2', width: 1.7 },
    { d: 'M3 21V12h4.5v9M8.5 21V6.5H14V21M15 21v-7h5.5v7M2 21h20', stroke: '#7DF9FF', width: 1.7 },
    { d: 'M10 9.5h2M10 13h2M10 16.5h2M17 16.5h1.5', stroke: '#FFE066', width: 1.6 },
  ],
  // Frosty Peaks: mountain with a snow cap, snowflake and aurora ribbon
  frost: [
    { d: 'M2 20l7-12 4 6 2.5-3.5L22 20z', fill: '#BFE3FF' },
    { d: 'M9 8l-2.2 3.8 2.2-1.2 1.6 1.4 0.4-2z', fill: '#FFFFFF' },
    { d: 'M17 4v5M14.8 6.5h4.4M15.4 4.9l3.2 3.2M18.6 4.9l-3.2 3.2', stroke: '#E8F6FF', width: 1.3 },
    { d: 'M3 7c3-3 5 1 8-1.5', stroke: '#5FE3C0', width: 1.5 },
  ],
};

export const worldIcon = (stageId: string): IconShape[] => WORLD_ICONS[stageId] ?? WORLD_ICONS['pond']!;

/** Inline SVG markup of a world's emblem (web demo). */
export function worldIconSvg(stageId: string, size = 24): string {
  const body = worldIcon(stageId)
    .map((s) => `<path d="${s.d}"${s.fill ? ` fill="${s.fill}"` : ' fill="none"'}${s.stroke ? ` stroke="${s.stroke}" stroke-width="${s.width ?? 2}" stroke-linecap="round" stroke-linejoin="round"` : ' stroke="none"'}/>`)
    .join('');
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
}
