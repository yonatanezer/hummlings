import { Platform } from 'react-native';
import type { AudioEngine } from '../core/engine';
import { MockEngine } from './mock';

let engine: AudioEngine | null = null;

/** One engine for the app. Web (automated checks) and tests use the mock; devices use react-native-audio-api. */
export function getEngine(): AudioEngine {
  if (!engine) {
    if (Platform.OS === 'web') engine = new MockEngine();
    else {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded lazily so web never imports the native module
      const { NativeEngine } = require('./native') as typeof import('./native');
      engine = new NativeEngine();
    }
  }
  return engine;
}
