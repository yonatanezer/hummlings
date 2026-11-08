import { useCallback, useEffect, useState } from 'react';
import { I18nManager, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Localization from 'expo-localization';
import { StatusBar } from 'expo-status-bar';
import { getStage, STAGES } from './src/content';
import { getPurchases } from './src/app/purchases';
import { ProgressProvider, useProgress } from './src/app/progress';
import { resolveLang, setLang } from './src/i18n';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { PlayerScreen } from './src/screens/PlayerScreen';
import { SongsScreen } from './src/screens/SongsScreen';
import { SplashScreen } from './src/screens/SplashScreen';
import { StageScreen } from './src/screens/StageScreen';
import { StageSelectScreen } from './src/screens/StageSelectScreen';
import { HelpScreen } from './src/screens/HelpScreen';
import { UnlockScreen } from './src/screens/UnlockScreen';
import { ErrorBoundary } from './src/ui/ErrorBoundary';
import { ParentalGate } from './src/ui/ParentalGate';
import { DevOverlay } from './src/ui/DevOverlay';
import { COLORS } from './src/ui/theme';

type Route =
  | { name: 'splash' } | { name: 'select' } | { name: 'stage'; stageId: string }
  | { name: 'songs'; from: Route } | { name: 'player'; songId: string } | { name: 'unlock' } | { name: 'settings' } | { name: 'help'; from: Route };

function Root() {
  const { progress, ready, update } = useProgress();
  const [route, setRoute] = useState<Route>({ name: 'splash' });
  const [gateFor, setGateFor] = useState<null | 'unlock'>(null);
  const [debug, setDebug] = useState('');

  // Language: user choice or device locale. The stage never mirrors; text screens do (see useLang).
  useEffect(() => {
    const device = Localization.getLocales()[0]?.languageCode ?? 'en';
    setLang(resolveLang(progress.settings.language, device));
  }, [progress.settings.language]);
  useEffect(() => { I18nManager.allowRTL(false); I18nManager.forceRTL(false); }, []);

  // Refunded purchases lock again on the next launch; offline (null) keeps the cached entitlement.
  useEffect(() => {
    if (!ready || !progress.unlocked) return;
    void getPurchases().hasEntitlement().then((has) => { if (has === false) update((p) => ({ ...p, unlocked: false })); });
  }, [ready]);

  const done = useCallback(() => setRoute({ name: 'select' }), []);
  if (!ready) return <View style={{ flex: 1, backgroundColor: COLORS.sky }} />;

  const songs = (from: Route) => setRoute({ name: 'songs', from });
  let screen;
  switch (route.name) {
    case 'splash': screen = <SplashScreen onDone={done} />; break;
    case 'select': screen = <StageSelectScreen onPick={(id) => setRoute({ name: 'stage', stageId: id })} onLocked={() => setGateFor('unlock')} onSettings={() => setRoute({ name: 'settings' })} onSongs={() => songs(route)} onHelp={() => setRoute({ name: 'help', from: route })} />; break;
    case 'stage': screen = <StageScreen key={route.stageId} stage={getStage(route.stageId)} onBack={() => setRoute({ name: 'select' })} onSongs={() => songs(route)} onHelp={() => setRoute({ name: 'help', from: route })} onPlay={(id) => setRoute({ name: 'player', songId: id })} onDebug={setDebug} />; break;
    case 'songs': screen = <SongsScreen onBack={() => setRoute(route.from.name === 'stage' ? { name: 'select' } : route.from)} onPlay={(id) => setRoute({ name: 'player', songId: id })} />; break;
    case 'player': {
      const song = progress.songs.find((s) => s.id === route.songId);
      screen = song ? <PlayerScreen key={song.id} song={song} onBack={() => songs({ name: 'select' })} /> : <View />;
      break;
    }
    case 'unlock': screen = <UnlockScreen onBack={() => setRoute({ name: 'select' })} />; break;
    case 'help': screen = <HelpScreen onBack={() => setRoute(route.from)} />; break;
    case 'settings': screen = <SettingsScreen onBack={() => setRoute({ name: 'select' })} />; break;
  }
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.sky }}>
      {screen}
      {gateFor === 'unlock' && <ParentalGate onPass={() => { setGateFor(null); setRoute({ name: 'unlock' }); }} onCancel={() => setGateFor(null)} />}
      <DevOverlay screen={route.name} info={debug || `${STAGES.length} stages`} />
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <ProgressProvider>
            <StatusBar hidden />
            <Root />
          </ProgressProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
