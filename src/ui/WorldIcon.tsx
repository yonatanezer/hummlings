import { Image } from 'react-native';
import { WORLD_PNG } from './iconAssets';

/** Emblem of a world (moon pond, ferris wheel, cloud town, neon city, frosty peaks): a coloured PNG rendered once from src/core/worldIcons.ts. */
export function WorldIcon({ stageId, size = 40 }: { stageId: string; size?: number }) {
  return <Image source={WORLD_PNG[stageId]} style={{ width: size, height: size }} fadeDuration={0} accessible={false} />;
}
