import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useProgress } from '../app/progress';

/** True when the player turned "reduce motion" on in the app OR the phone's own accessibility setting asks for it. */
export function useReduceMotion(): boolean {
  const { progress } = useProgress();
  const [system, setSystem] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setSystem);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystem);
    return () => sub.remove();
  }, []);
  return progress.settings.reduceMotion || system;
}
