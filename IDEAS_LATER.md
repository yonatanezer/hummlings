# IDEAS_LATER (not in v1)
- More worlds, seasonal creatures, creature-specific idle tricks.
- Share the song as a small timeline link instead of audio.

- Child-composed melodies (tap a small keyboard; the tune becomes a creature).

## Share a video of the performance (post-v1)
Idea: after recording, share a video of the stage (creatures dancing) with the song's audio, for family chats.
Approach: record the device screen (not frame-by-frame rendering). Hide the UI chrome while recording, then open the share sheet.
Candidates found by web search (NOT verified, none tried): `react-native-record-screen` (Expo config plugin, iOS 11+, Android minSdk 26, not on iOS Simulator), `react-native-nitro-screen-recorder` (alpha, iOS Broadcast Extension, Android mediaProjection foreground service), `react-native-screen-recorder-pro` (v0.1.0, ReplayKit + MediaProjection). `expo-screen-capture` only blocks capture, it does not record.
Open questions before committing: does Android capture internal audio (needs Android 10+ AudioPlaybackCapture) alongside react-native-audio-api? Maintenance state and Expo 58 compatibility? The system consent dialog (every recording on Android) is hostile for young children.
Must keep: no new permissions beyond the share sheet in v1 (privacy label), so save-to-gallery stays out unless re-decided. Cheaper alternative: share a still card (logo + the song's creatures) next to the audio file.
