import { Canvas, Circle, Group, Path, RoundedRect } from '@shopify/react-native-skia';

export type IconName = 'back' | 'record' | 'stop' | 'book' | 'note' | 'gear' | 'trash' | 'play' | 'pause' | 'share' | 'close' | 'pencil' | 'lock' | 'sweep' | 'restore' | 'check' | 'full' | 'info' | 'next' | 'help' | 'volume' | 'vibrate' | 'motion' | 'globe' | 'dice' | 'download';

// Icons are drawn from SVG path data on a 24x24 grid (original shapes, no icon font).
const STROKES: Partial<Record<IconName, string>> = {
  back: 'M15 5 L8 12 L15 19',
  next: 'M9 5 L16 12 L9 19',
  download: 'M12 4v11 M7 10l5 5 5-5 M5 20h14',
  dice: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M8.5 9h.01 M15.5 9h.01 M12 12h.01 M8.5 15h.01 M15.5 15h.01',
  volume: 'M17 9a4 4 0 0 1 0 6 M19.5 6.5a8 8 0 0 1 0 11',
  vibrate: 'M8 4h8a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z M3 9v6 M21 9v6',
  motion: 'M3 12c3-5 6 5 9 0s6 5 9 0',
  globe: 'M12 3a9 9 0 1 0 0.01 0z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18',
  help: 'M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8 M12 17.2v.3',
  book: 'M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z M8 4v13',
  note: 'M9 18V6l10-2v12',
  trash: 'M5 7h14 M9 7V4h6v3 M7 7l1 13h8l1-13',
  share: 'M12 15V4 M8 8l4-4 4 4 M5 12v8h14v-8',
  close: 'M6 6l12 12 M18 6L6 18',
  pencil: 'M4 20l1-5L16 4l4 4L9 19z',
  lock: 'M8 11V8a4 4 0 0 1 8 0v3',
  sweep: 'M12 4v12 M7 11l5 5 5-5 M5 20h14',
  restore: 'M4 12a8 8 0 1 1 3 6 M4 18v-5h5',
  check: 'M5 12l5 5 9-10',
  full: 'M12 7v6 M12 17v.5',
  info: 'M12 11v6 M12 7v.5',
  gear: 'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M5.6 18.4l2.1-2.1 M16.3 7.7l2.1-2.1',
};

export function Icon({ name, size = 28, color = '#FFFFFF', mirror = false }: { name: IconName; size?: number; color?: string; mirror?: boolean }) {
  const k = size / 24;
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Group transform={mirror ? [{ scale: k }, { translateX: 24 }, { scaleX: -1 }] : [{ scale: k }]}>
        {name === 'record' && <Circle cx={12} cy={12} r={7} color={color} />}
        {name === 'stop' && <RoundedRect x={6} y={6} width={12} height={12} r={2.5} color={color} />}
        {name === 'play' && <Path path="M8 5l11 7-11 7z" color={color} />}
        {name === 'pause' && (<><RoundedRect x={6} y={5} width={4} height={14} r={1.5} color={color} /><RoundedRect x={14} y={5} width={4} height={14} r={1.5} color={color} /></>)}
        {name === 'note' && (<><Circle cx={7} cy={17} r={3} color={color} /><Circle cx={17} cy={15} r={3} color={color} /></>)}
        {name === 'gear' && <Circle cx={12} cy={12} r={4.5} color={color} style="stroke" strokeWidth={2.2} />}
        {name === 'lock' && <RoundedRect x={5} y={11} width={14} height={10} r={2.5} color={color} />}
        {name === 'full' && <Circle cx={12} cy={12} r={9} color={color} style="stroke" strokeWidth={2} />}
        {name === 'volume' && <Path path="M5 9v6h4l5 4V5L9 9z" color={color} />}
        {name === 'help' && <Circle cx={12} cy={12} r={9} color={color} style="stroke" strokeWidth={2} />}
        {name === 'info' && <Circle cx={12} cy={12} r={9} color={color} style="stroke" strokeWidth={2} />}
        {STROKES[name] && <Path path={STROKES[name]!} color={color} style="stroke" strokeWidth={2.2} strokeCap="round" strokeJoin="round" />}
      </Group>
    </Canvas>
  );
}
