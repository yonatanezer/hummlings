# DECISIONS (one line each: decision — reason)

- Branch `claude/hummlings-build` with a draft PR — the cloud environment rule is to branch off main and open a draft PR.
- Stage 1 "Moonlit Pond": A minor, 92 BPM, Am-F-C-G; Stage 2 "Candy Fair": C major, 112 BPM, C-G-Am-F; Stage 3 "Sleepy Cloud Town": D major, 84 BPM, D-Bm-G-A — distinct key, tempo and mood per world.
- Loop phase follows the global bar counter (bar mod 4) — a layer joining mid-loop stays in sync with the chord loop.
- Sounds are fully synthesised in code (no downloaded CC0 samples) — keeps every sound original with zero licence risk and no network dependency at build; docs/ORIGINALITY.md records that. Vocal syllables use a formant synth.
- Loops shipped as m4a (AAC) with seamless-loop authoring (tail wrapped into the head) and `loopEnd` set exactly in the engine — AAC encoder delay is absorbed by the loop points; fallback is WAV/FLAC via one config flag.
- Pure TS zod schema in src/core/schema.ts is the fixed content schema (M0) — one validator for build script, tests and app.
- Live master bus uses the audio engine's compressor-as-limiter; export uses the pure `limit()` in core — the audit proves the limiter rarely engages (<= 6 dB), so both sound the same.
- After a celebration the same combo does not re-fire until it has been broken once — avoids nagging confetti while the child keeps playing.
- Songs and progress stored as JSON via expo-file-system (no AsyncStorage) — fewer dependencies, one atomic write.
- Fixed master trim of -6 dB before the limiter — six loops at -20 LUFS each exceeded the 6 dB limiter-reduction budget (measured 7-10 dB); with the trim the audit passes.
- Loop loudness measured as ungated K-weighted LUFS over the whole 4-bar loop; peaky loops (drums) are tanh-saturated (knee 0.55) so peaks stay below -5 dBFS.
- Expo Go is not used (native audio engine): dev client / preview build, as specified.
- Live master limiter is a WaveShaper soft-clip curve (react-native-audio-api has no compressor node); export uses the pure look-ahead limiter — both are inaudible at the audited levels (limiter reduction is 0 dB on typical mixes).
- Song export is WAV 48 kHz 16-bit mono — no free maintained module encodes arbitrary PCM arrays to m4a (the audio library's AAC writer is tied to its recorder).
- Plain state-based navigation in App.tsx instead of Expo Router — 7 screens, no deep links, fewer moving parts.
- Touch handling is a pure `GestureTracker` in core fed by raw RN touch events (no gesture-handler API) — fully unit-tested, supports multi-touch.
- Look sheet audio is mp3 (the artifact host does not serve m4a); the app itself ships m4a.
