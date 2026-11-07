import { Canvas, Group, Path } from '@shopify/react-native-skia';
import { worldIcon } from '../core/worldIcons';

/** Emblem of a world (moon pond, ferris wheel, cloud town). */
export function WorldIcon({ stageId, size = 40 }: { stageId: string; size?: number }) {
  const k = size / 24;
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Group transform={[{ scale: k }]}>
        {worldIcon(stageId).map((s, i) => (s.stroke
          ? <Path key={i} path={s.d} color={s.stroke} style="stroke" strokeWidth={s.width ?? 2} strokeCap="round" strokeJoin="round" />
          : <Path key={i} path={s.d} color={s.fill ?? '#fff'} />))}
      </Group>
    </Canvas>
  );
}
