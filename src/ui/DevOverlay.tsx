import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

/** Dev builds only: screen name, state and a frame counter, for bug reports and for measuring 60 fps on a device. Hidden in production. */
export function DevOverlay({ screen, info }: { screen: string; info: string }) {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    if (!__DEV__) return;
    let frames = 0, last = Date.now(), raf = 0;
    const loop = () => {
      frames++;
      const now = Date.now();
      if (now - last >= 1000) { setFps(Math.round((frames * 1000) / (now - last))); frames = 0; last = now; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  if (!__DEV__) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', bottom: 2, left: 2, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, borderRadius: 6 }}>
      <Text style={{ color: fps >= 55 ? '#9f9' : '#ff8', fontSize: 10 }}>{screen} · {info} · JS {fps} fps</Text>
    </View>
  );
}
