import { Image } from 'react-native';
import { ICON_PNG } from './iconAssets';
import type { IconName } from '../core/uiIcons';

export type { IconName };

/**
 * An interface icon: a white PNG (rendered once from src/core/uiIcons.ts by scripts/build-ui-icons.ts) tinted with `color`.
 * It used to be one Skia canvas per icon, i.e. a GPU surface for every button on every screen.
 */
export function Icon({ name, size = 28, color = '#FFFFFF', mirror = false }: { name: IconName; size?: number; color?: string; mirror?: boolean }) {
  return <Image source={ICON_PNG[name]} style={{ width: size, height: size, tintColor: color, transform: mirror ? [{ scaleX: -1 }] : [] }} fadeDuration={0} accessible={false} />;
}
