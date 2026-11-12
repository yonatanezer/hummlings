/**
 * The interface icons as shapes on a 24x24 grid (original shapes, no icon font). One family: 2.2 round strokes, filled dots and wedges for the few solid ones.
 * Used by scripts/build-ui-icons.ts, which renders them once into PNGs (a Skia canvas per icon was a lot of GPU surfaces on every screen).
 */
export type IconName =
  | 'back' | 'next' | 'record' | 'stop' | 'combos' | 'note' | 'gear' | 'trash' | 'play' | 'pause' | 'share' | 'close' | 'pencil' | 'lock'
  | 'sweep' | 'restore' | 'check' | 'full' | 'info' | 'help' | 'volume' | 'vibrate' | 'motion' | 'globe' | 'dice' | 'download' | 'star' | 'mic'
  | 'goalBand' | 'goalDrums' | 'goalChoir' | 'goalStage' | 'goalSolo' | 'goalMix' | 'goalSwap' | 'goalCombos';

export type IconShape =
  | { kind: 'stroke'; d: string; w?: number }
  | { kind: 'fill'; d: string }
  | { kind: 'circle'; cx: number; cy: number; r: number; style: 'fill' | 'stroke'; w?: number }
  | { kind: 'rrect'; x: number; y: number; w: number; h: number; r: number };

const f = (n: number) => Number(n.toFixed(2));

/** A cog: `teeth` trapezoid teeth around the centre (12,12). */
export function gearPath(teeth = 8, rOut = 9.2, rIn = 7, half = 0.2): string {
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    // each tooth: rise to rOut over [a - half, a + half], fall back to rIn over the gap
    for (const [ang, r] of [[a - half * 1.35, rIn], [a - half * 0.8, rOut], [a + half * 0.8, rOut], [a + half * 1.35, rIn]] as const) {
      pts.push(`${f(12 + Math.cos(ang) * r)} ${f(12 + Math.sin(ang) * r)}`);
    }
  }
  return `M${pts.join('L')}Z`;
}

/** A five-point star centred at (12,12.5). */
export function starPath(rOut = 9.6, rIn = 4.2, cx = 12, cy = 12.6): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`);
  }
  return `M${pts.join('L')}Z`;
}

const S = (d: string, w?: number): IconShape => ({ kind: 'stroke', d, w });

export const ICON_SHAPES: Record<IconName, IconShape[]> = {
  back: [S('M15 5 L8 12 L15 19')],
  next: [S('M9 5 L16 12 L9 19')],
  record: [{ kind: 'circle', cx: 12, cy: 12, r: 7, style: 'fill' }],
  stop: [{ kind: 'rrect', x: 6, y: 6, w: 12, h: 12, r: 2.5 }],
  play: [{ kind: 'fill', d: 'M8 5l11 7-11 7z' }],
  pause: [{ kind: 'rrect', x: 6, y: 5, w: 4, h: 14, r: 1.5 }, { kind: 'rrect', x: 14, y: 5, w: 4, h: 14, r: 1.5 }],
  // the secret-combos button: a star with two sparkles (the old open book read as a notebook)
  combos: [S(starPath(8.2, 3.6)), S('M20 3v4 M18 5h4', 1.8), S('M3.5 17v3.5 M1.75 18.75h3.5', 1.6)],
  star: [{ kind: 'fill', d: starPath(10, 4.4) }],
  note: [{ kind: 'circle', cx: 7, cy: 17, r: 3, style: 'fill' }, { kind: 'circle', cx: 17, cy: 15, r: 3, style: 'fill' }, S('M9.5 17V6l10-2v11')],
  // a real cog (the old one was a ring with eight spokes and read as a sun)
  gear: [S(gearPath(8, 9.4, 7.2)), { kind: 'circle', cx: 12, cy: 12, r: 3, style: 'stroke', w: 2.2 }],
  trash: [S('M5 7h14 M9 7V4h6v3 M7 7l1 13h8l1-13')],
  share: [S('M12 15V4 M8 8l4-4 4 4 M5 12v8h14v-8')],
  close: [S('M6 6l12 12 M18 6L6 18')],
  pencil: [S('M4 20l1-5L16 4l4 4L9 19z')],
  lock: [{ kind: 'rrect', x: 5, y: 11, w: 14, h: 10, r: 2.5 }, S('M8 11V8a4 4 0 0 1 8 0v3')],
  // clear the stage: a broom sweeping (this used to be a copy of the download arrow)
  sweep: [S('M19 3l-6.5 8.5'), S('M10 10l4.2 3.3-2.6 6.7H4l2.6-6.7z'), S('M8.5 17.2l-.9 2.8 M11.5 17.2l-.3 2.8')],
  restore: [S('M4 12a8 8 0 1 1 3 6 M4 18v-5h5')],
  check: [S('M5 12l5 5 9-10')],
  full: [{ kind: 'circle', cx: 12, cy: 12, r: 9, style: 'stroke', w: 2.2 }, S('M12 7v6 M12 17v.5')],
  info: [{ kind: 'circle', cx: 12, cy: 12, r: 9, style: 'stroke', w: 2.2 }, S('M12 11v6 M12 7v.5')],
  help: [{ kind: 'circle', cx: 12, cy: 12, r: 9, style: 'stroke', w: 2.2 }, S('M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8 M12 17.2v.3')],
  volume: [{ kind: 'fill', d: 'M5 9v6h4l5 4V5L9 9z' }, S('M17 9a4 4 0 0 1 0 6 M19.5 6.5a8 8 0 0 1 0 11')],
  vibrate: [S('M8 4h8a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M3 9v6 M21 9v6')],
  motion: [S('M3 12c3-5 6 5 9 0s6 5 9 0')],
  globe: [S('M12 3a9 9 0 1 0 0.01 0z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18')],
  dice: [S('M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M8.5 9h.01 M15.5 9h.01 M12 12h.01 M8.5 15h.01 M15.5 15h.01')],
  download: [S('M12 4v11 M7 10l5 5 5-5 M5 20h14')],
  // sticker pictograms: no words, one picture per goal
  goalBand: [S('M5 20v-5 M10 20V9 M15 20v-8 M20 20V4', 3)],
  goalDrums: [S('M4 11a8 3 0 1 0 16 0a8 3 0 1 0-16 0 M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6 M7 3l4 5 M17 3l-4 5')],
  goalChoir: [{ kind: 'circle', cx: 6, cy: 8, r: 2.4, style: 'fill' }, { kind: 'circle', cx: 12, cy: 6, r: 2.4, style: 'fill' }, { kind: 'circle', cx: 18, cy: 8, r: 2.4, style: 'fill' }, S('M2.5 19a3.5 3.5 0 0 1 7 0 M8.5 17a3.5 3.5 0 0 1 7 0 M14.5 19a3.5 3.5 0 0 1 7 0')],
  goalStage: [{ kind: 'circle', cx: 6, cy: 7, r: 2, style: 'fill' }, { kind: 'circle', cx: 12, cy: 7, r: 2, style: 'fill' }, { kind: 'circle', cx: 18, cy: 7, r: 2, style: 'fill' }, { kind: 'circle', cx: 6, cy: 14, r: 2, style: 'fill' }, { kind: 'circle', cx: 12, cy: 14, r: 2, style: 'fill' }, { kind: 'circle', cx: 18, cy: 14, r: 2, style: 'fill' }, S('M3 20h18')],
  goalSolo: [S('M9 3h6l4 12H5z M12 15v6 M8 21h8')],
  goalMix: [S('M5 4v16 M12 4v16 M19 4v16'), { kind: 'circle', cx: 5, cy: 9, r: 2.6, style: 'fill' }, { kind: 'circle', cx: 12, cy: 15, r: 2.6, style: 'fill' }, { kind: 'circle', cx: 19, cy: 7, r: 2.6, style: 'fill' }],
  goalSwap: [S('M4 8h14 M14 4l4 4-4 4 M20 16H6 M10 12l-4 4 4 4')],
  goalCombos: [{ kind: 'fill', d: starPath(6.2, 2.8, 7.5, 9) }, { kind: 'fill', d: starPath(6.2, 2.8, 16.5, 15.5) }],
  mic: [S('M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z M6 11a6 6 0 0 0 12 0 M12 17v4')],
};

export const ICON_NAMES = Object.keys(ICON_SHAPES) as IconName[];
