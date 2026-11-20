import * as Haptics from 'expo-haptics';

let enabled = true;
export const setHapticsEnabled = (v: boolean): void => { enabled = v; };

/** Light on pick-up, medium on drop, success pattern on combo (spec). All no-ops when disabled in settings. */
export const hapticLight = (): void => { if (enabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); };
export const hapticMedium = (): void => { if (enabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); };
export const hapticSuccess = (): void => { if (enabled) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); };
