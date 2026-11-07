import { Text, View } from 'react-native';

/** Dev builds only: small overlay with screen name and state, for bug reports. Hidden in production. */
export function DevOverlay({ screen, info }: { screen: string; info: string }) {
  if (!__DEV__) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', bottom: 2, left: 2, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, borderRadius: 6 }}>
      <Text style={{ color: '#9f9', fontSize: 10 }}>{screen} · {info}</Text>
    </View>
  );
}
