You are building Hummlings, a mobile app for iOS and Android, in the repo https://github.com/yonatanezer/hummlings (clone it if it is not checked out), in ONE uninterrupted session. This file is also committed as CLAUDE.md, so it survives context compaction. Work autonomously until the Definition of Done is met. Reply to me in Hebrew; code and comments in English.
If the session stops (usage limits, context), a new session resumes from CLAUDE.md and PROGRESS.md with the message "continue".

## Your role
This spec is serious, detailed guidance built from earlier projects. It is not a substitute for judgement. You own this project end to end and are responsible for the result. When a rule here is wrong for this app, do what is right for the app and log the deviation and the reason in DECISIONS.md.

## Project profile
Everything that depends on the nature of the app is set in the "Project profile" of "The app": audience and category, money model, server and accounts, data and privacy, platforms and devices, orientation, languages, tech stack and rendering, assets, feel (motion, sound, haptics), first-run experience, settings, content model, performance targets. If an item is open, choose what fits this app, log it in DECISIONS.md, and apply every store rule that follows from it (age rating, programmes such as Kids / Families, ads, data collection, account deletion, purchase rules). Once set, do not revisit.
Decided once for all apps: developer Yonatan Ezer, support email ezer.yonatan@gmail.com, bundle id com.yonatanezer.hummlings, privacy and support pages in the shared public pages repo yonatanezer/app-pages.

## How to work (always)
- Follow the "Decision authority" block in "The app": decided items are final, the rest you decide alone and log.
- Do not stop to ask, with ONE exception: the look sheet approval in M1. Tell me when it is ready (push notification if the tool exists, otherwise a clear message). If everything that does not depend on the look is done and I have not approved yet, stop with a short message that says what is waiting; continue when I answer. Otherwise pick the simplest reasonable option, log it in DECISIONS.md (one line, with the reason) and continue. Every decision is recorded once; later work is checked against it.
- Things only I can do go in TODO_FOR_YONATAN.md as exact numbered steps. Keep working around them.
- PROGRESS.md stays under 60 lines: milestone status, how to resume, known gaps. Derive state from git and the checks themselves, not from notes.
- Commit and push after every milestone, only on a green `npm run check`.
- SCOPE IS FIXED. Build exactly the v1 in "The app". New ideas go into IDEAS_LATER.md, not into code. Polish the core experience before adding anything.
- At the end, write LESSONS.md: what worked, what failed, what you would do differently from day one.

## Token discipline (always)
- Targeted search (grep/glob), never broad scans. Do not reread unchanged files. Do not narrate steps. Keep command output short.
- Fast checks per milestone (`npm run check`); the full QA suite runs once, at the end, from one shared QA helper library. Every long command gets a timeout. Run one heavy process at a time. Generators write each result as soon as it is ready. Never `pkill -f` a pattern that matches your own command.
- Frameworks change fast: before touching a framework API, read the docs for the installed version (for Expo: docs.expo.dev/versions/v<major>.0.0/ and docs.expo.dev/llms.txt).
- Nothing that costs money (paid APIs, paid hosting, paid builds) without my explicit approval for that specific call.

## Engineering rules (always)
- It must run on my phone as early as possible and stay runnable: Expo Go when the stack allows, otherwise a development build. You work in the cloud and cannot reach my phone, so TODO_FOR_YONATAN.md gives the exact steps from my computer (clone, install, start, scan the QR code on the same Wi-Fi). Native-only modules sit behind an interface with a mock, so the rest keeps running.
- Pure logic lives in `src/core` with no UI imports (lint rule) and is unit-tested. Tests never import UI code. One renderer only.
- All tuning values in one config file, as formulas where possible, each with a one-line comment on why it has that value.
- If the app has content: the schema is fixed in M0, every item has a stable id, progress is saved by id, and an audit test runs over all content in every mode from M0 on.
- Tests: behaviour tests first, plus structure checks where they guard something real (ids, assets, config).
- Strings: one typed dictionary and `t()` from the first screen; a missing key fails the typecheck.
- Original style, names and UI; no competitor names anywhere (code, app, store). docs/ORIGINALITY.md records the origin of every asset.
- Production builds hide every developer tool. Dev builds show a small overlay with screen name and state for bug reports.

## Proven options (use when they fit the profile)
- Expo (latest stable SDK when you start; 58 in November 2026) + TypeScript strict, EAS Build/Submit.
- 2D drawn and animated UI: Skia 2.x (immutable `Skia.PathBuilder` API) + Reanimated 4 + Worklets; core events -> pure planner -> one Skia Picture per frame on the UI thread; every drawing helper is a 'worklet' (lint rule).
- 3D: three.js via @react-three/fiber on expo-gl, instancing and hard object caps.
- Art drawn in code; sound and music synthesised by a script into small committed files.
- Solver/bot to prove content is possible (not to judge difficulty).
- Web build only for automated checks (Playwright).

## Quality bar (always; the details come from the profile)
- The core experience is polished before anything is added, with the feel defined in the profile.
- A first-run experience that fits the audience, and clear feedback within 100 ms of every touch. Touch targets at least 44 pt, larger if the audience needs it.
- Settings include everything relevant to the app, plus privacy and about (and restore purchases if there are purchases).
- Reduce Motion skips motion, never content. Accessibility labels on every button. Pause on background and resume correctly. ErrorBoundary. Safe areas.
- Meet the performance targets in the profile, with hard caps on anything that can grow.

## Milestones (in order)
- M0 Setup: project, CLAUDE.md with this spec, LAYOUT.md (one page: geometry, sizes and spacing of every screen), content schema if relevant, lint rules, tests, `npm run check` (lint + typecheck + tests), strings, tuning file.
- M1 Core experience: fully polished and running on my phone. Publish ONE look sheet as a private artifact: a static page of screenshots of every component and screen state, rendered headlessly (the artifact viewer may block WebGL and wasm, so never rely on a live canvas there); put its link and the phone steps at the top of TODO_FOR_YONATAN.md. **The art direction needs my approval.** Until I approve, continue only with work that does not depend on the look; after approval, polish the visuals.
- M2 Full v1 and all screens, save/load, first-run experience, settings.
- M3 Money and store kit, as the profile sets them: store modules behind interfaces; icon, adaptive icon, splash, feature graphic; build profiles (development, preview, production); real app ids; privacy and support pages with a GitHub Pages workflow; STORE_LISTING.md and STORE_ANSWERS.md (age rating, privacy labels, Data safety, content rights, export compliance).
- M4 Polish and release: performance pass, edge cases, the full QA suite once, store screenshots from the FINAL build in every project language at the required sizes, and `npm run release:check` that prints READY only when no placeholder, dev tool or missing asset remains.

## Definition of Done
- All milestones complete; `npm run check`, the platform health check (e.g. `npx expo-doctor`) and `npm run release:check` pass; LESSONS.md written.
- TODO_FOR_YONATAN.md lists the exact remaining steps in order (phone test, builds, store console records, purchase products if any, GitHub Pages, Google's closed test if it applies, submission, a device feel checklist).
- Your final message to me, in Hebrew: what is done, how to open it on my phone right now, what is left for me.

## The app
Hummlings: a family music toy. Drag cute gummy creatures onto a stage; each one adds a looping layer (drums, bass, melody, voice) to one shared song. Every layer of a stage is in the same key, tempo and chord loop, so every combination sounds good. Tap a creature to mute it, long-press to solo it, record your song and play it back or share it as an audio file, and discover secret combinations that unlock an animated celebration. Fully offline.
Inspiration: the drag-to-stage layering MECHANIC of Incredibox only. Never copy its characters, sounds, look, UI layout, names or wording, and never mention it anywhere (code, app, store).
Audience: the whole family, ages 4+ upwards; usable without reading.

### Project profile (every item decided for this app)
- Name, subtitle, bundle id: Hummlings; "Make music with tiny singers"; com.yonatanezer.hummlings (Android package the same).
- Audience and category: everyone, age rating 4+ / PEGI 3 / Everyone; App Store category Music, Google Play category Music & Audio. NOT in Apple Kids category or Google Families programme, but kid-safe throughout: no ads, no tracking, no chat, no user-generated content shared inside the app.
- Money model and price: free download. Stage 1 fully free (all 16 creatures, all 3 combos, recording and export). One non-consumable IAP `hummlings.unlock_all` at USD 3.99 (tier equivalent) unlocks stages 2 and 3. Restore purchases in settings. A parental gate (hold a button for 2 s while a simple 2-digit addition is solved, numbers shown as digits) before the purchase sheet and before any external link.
- Server and accounts: none. No network calls at all except the store purchase APIs.
- Data and privacy: collect nothing. No analytics, no crash SDK that sends data, no microphone, no permissions except what the share sheet needs. Songs and progress stored locally only. Apple privacy label "Data Not Collected"; Google Data safety: no data collected or shared.
- Platforms, devices, orientation: iOS 16+ (iPhone and iPad), Android 8+ (phones and tablets). Landscape only (both landscape directions).
- Languages: English and Hebrew (full RTL support for text and mirrored navigation; the stage itself does not mirror). UI is icon-first; text only in settings, songs list, parental gate, purchase screen.
- Tech stack and rendering: Expo (latest stable SDK, 58) + TypeScript strict, EAS Build. Drawing and animation: Skia 2.x + Reanimated 4 + Worklets per the proven options. Audio: a sample-accurate engine that schedules looped PCM buffers on one shared clock (first choice: react-native-audio-api, the Web Audio API for React Native; verify on its docs for the installed version). This requires a development build; Expo Go is not used. The audio engine sits behind an interface with a mock so tests and the web check build run without it. Export renders offline in pure TypeScript in `src/core` (sum of buffers + the same master limiter) and encodes to m4a (AAC 128 kbps) via a native encoder if a free, maintained module exists; otherwise WAV 44.1 kHz 16-bit. Log the choice.
- Assets (art, sound): all creatures, stages and UI drawn in code. Sound: a script `npm run sounds` builds every loop from synthesis plus CC0-licensed one-shot samples (drum hits, short vocal syllables). Only CC0 sources; every source file with URL and licence in docs/ORIGINALITY.md and committed under `assets/sources/`. Output: 48 kHz mono or stereo m4a/caf per loop, committed.
- Feel (motion, sound, haptics): everything on stage bounces to the beat (squash-stretch 8% on each beat, bigger on bar 1). Every touch answers within 100 ms visually and with a light haptic, even when the sound waits for the bar boundary. A new layer starts on the next bar boundary with a 20 ms fade; removal and mute fade out over 40 ms. Haptics: light on pick-up, medium on drop, success pattern on combo.
- First-run experience: no text. The first stage opens with the music already ticking softly (a hi-hat count) and an animated hand dragging a creature from the tray to the stage; it repeats every 4 s until the first drop, then never again.
- Settings: music volume, haptics on/off, Reduce Motion (follows system, can be forced on), language (system / English / Hebrew), restore purchases, privacy policy, about (version, credits incl. CC0 sources), reset progress (with confirm).
- Content model: `content/stages/*.json` validated by a schema fixed in M0. Stage: id, nameKey, bpm, key, timeSignature 4/4, loopBars, chordLoop, palette, creatures[16], combos[3]. Creature: id, layer (drums|bass|melody|voice), loopFile, onsets (beat positions for mouth/beat animation), color, shape params (body, eyes, ears, accessory). Combo: id, creatureIds[4], bonusLoopFile, celebrationId. Progress saved by stable id.
- Performance targets: 60 fps on iPhone 11 and Pixel 6a with 6 creatures and a celebration playing; zero drift between layers after 10 minutes (sample-aligned); no audio glitch when adding/removing/muting; cold start <= 2.5 s to stage select; app download <= 60 MB; memory <= 250 MB; export of a 3-minute song <= 10 s on Pixel 6a.

### Decision authority
- Decided (do not revisit): everything in the profile above and in this spec (name, audience, money model and price, v1 scope and counts, sound approach, art direction, recording and export, offline).
- Decide alone and log in DECISIONS.md: technical and design choices inside the agreed direction: libraries, file layout, tuning values, exact layouts, creature designs, stage themes and names, musical content (keys, progressions, patterns), copy, sound design, celebration choreography, edge cases, store texts.
- Needs Yonatan: only the M1 look-and-sound sheet, and anything that costs money or cannot be undone.

### Core experience
- Landscape screen: stage area on top (about 65% of height) with 6 spots in a gentle arc; creature tray along the bottom (16 creatures in 4 colour-coded groups of 4 by layer, scrolls horizontally on phones if needed).
- Drag a creature from the tray to any spot: it hops on and its loop starts on the next bar. Dropping on an occupied spot swaps (the old one hops back to the tray). Each creature can be on stage once (its tray slot shows a faded silhouette while it performs). Drag it off the stage, or flick it down, to remove it.
- Tap a creature on stage: mute / unmute (muted = eyes closed, desaturated, 40% opacity). Long-press 400 ms: solo (everyone else dims to 30% and is silent; a spotlight hits the soloist); long-press again or tap empty stage to end solo.
- Clear-all button (sweeps everyone back to the tray).
- With an empty stage only a soft beat-tick plays, so the clock is always running and the first drop lands on the beat.
- Secret combos: each stage has 3 combos of 4 specific creatures. When all 4 are on stage and unmuted at a bar boundary, after one full loop a celebration starts: an 8-bar animated show (lights, confetti, creatures dance in formation) with a special bonus loop layered on top, then the stage returns to normal. A discovered combo is saved, and can be replayed from the combo book.
- Combo book (per stage): 3 cards; an undiscovered card shows a silhouette and 4 dots that light up for how many of its creatures are currently on stage (honest hint, no timer).

### Screens
1. Splash (logo, 1.2 s max).
2. Stage select: 3 stage cards with their creatures peeking out; locked stages show a padlock and open the unlock screen.
3. Stage (core experience) with top bar: back, record, combo book, songs.
4. Combo book overlay.
5. My songs: list of saved songs (name, stage, length, date), play, rename, share, delete (with confirm).
6. Player: replays a song, re-rendering the stage animation from the recorded event timeline, with share button.
7. Unlock screen (behind the parental gate): what is unlocked, price from the store, buy, restore.
8. Settings (behind the parental gate for restore/links only).
9. Parental gate modal.

### Functionality (with numbers)
- Music grid: each stage 4/4, loop length 4 bars; tempos 84-112 BPM (set per stage); all loops in a stage share the key and one 4-bar chord loop. Melody and voice lines use the stage's pentatonic scale or chord tones only. Registers separated so layers never mask each other: bass below 250 Hz fundamental, melody above 500 Hz, voice in the middle with rhythmic gaps.
- Mixing: per-layer gain normalised so every loop measures -20 LUFS +/- 1; master bus soft limiter at -1 dBFS. Audit renders every 6-creature combination of each stage (8,008 per stage) offline and fails if any exceeds -1 dBFS after the limiter or if the limiter gain reduction exceeds 6 dB.
- Recording: the record button records an event timeline (drop, remove, swap, mute, solo, combo), quantised to the bar, not audio. Max 3 minutes (stops automatically, with a 10 s visual warning). Up to 50 saved songs; oldest is never deleted automatically (at 50 the record button explains the limit with an icon and the songs list). Auto-name "Song N", editable (max 24 characters).
- Playback and export render from the timeline, so a song always sounds identical to what was heard.
- Export: share sheet with the audio file named `Hummlings - <song name>.m4a` (or .wav).
- Audio session: plays even with the iOS silent switch (music app); pauses on interruption (call, other app audio, headphones unplugged) and on background; resumes paused, user taps play.

### v1 content (exact counts; free vs paid)
- 3 stages x 16 creatures = 48 creatures and 48 loops; 3 combos per stage = 9 combos with 9 bonus loops and 9 celebrations (choreography may share building blocks, each with a distinct look).
- Stage 1 free; stages 2 and 3 in the one unlock. Each stage its own world and musical mood (for example a moonlit pond, a candy fair, a sleepy cloud town; final names and themes are yours), with distinct tempo, key and palette.

### Art direction and sound
- Gummy creatures on a night stage: soft round bodies with a glossy top-left highlight and a subtle translucent rim, like gummy candy. Pastel-neon colour per layer, consistent on every stage: drums pink #FF7AA8, bass periwinkle #7A8CFF, melody mint #5FE3C0, voice butter #FFC857 (shades vary per creature). Each layer has its own body family so a child can tell layers by shape: drums round and bouncy, bass wide and heavy, melody tall and stretchy, voice small with a big mouth.
- Stage: deep indigo night (#1B1340 base, stage floor #2A1F5C), warm spotlights (#FFE8A3 at about 20%), soft stars; each stage tints this differently.
- Animation: idle breathing, beat bounce, mouths and limbs driven by each loop's onsets, blink every 3-6 s at random.
- Sound: warm, round, playful; nothing harsh above 8 kHz. No real words in any vocal (syllables only, so it works in every language).
- M1 deliverable: a look-and-sound sheet (screenshots of every creature and screen state plus a page of short audio previews of every stage-1 loop and one full mix) for Yonatan's approval.

### Return reasons (no dark patterns)
- 9 secret combos to discover with honest hints; a songs collection; 3 worlds. No streaks, no daily rewards, no notifications, no timers.

### Edge cases
- Drop outside any spot returns the creature to the tray. Two fingers dragging two creatures at once both work. Rapid add/remove within one bar: only the state at the bar boundary sounds; visuals still respond instantly.
- Solo on a muted creature unmutes it while soloed. Combo check ignores muted creatures and is off while soloing.
- App killed or backgrounded while recording: the song is saved up to the last full bar.
- Low storage on save or export: clear icon message, nothing lost.
- Purchase pending, cancelled, failed, refunded (lock again on next launch), restored on a new device; works offline once purchased (cached entitlement).
- Locale switch while running; very small phones (iPhone SE landscape) and large tablets: spots and tray scale, touch targets at least 56 pt.

### Store page (subtitle, keywords, age rating, screenshot plan)
- Subtitle: Make music with tiny singers. Hebrew listing too.
- Keywords (no competitor names): music maker, beat, loops, song, choir, creatures, kids music, mix, rhythm, sing.
- Age rating 4+; PEGI 3; Everyone.
- Screenshots (both languages, all required sizes, from the final build): full stage with 6 creatures; solo spotlight; a celebration; combo book; songs list with share.

### Acceptance criteria (done when...)
- Any 1-6 creatures of a stage play in perfect sync, and the offline audit passes for all combinations.
- Tap mute and long-press solo respond within 100 ms visually; audio changes on the next bar.
- All 9 combos trigger reliably and replay from the combo book.
- A recorded song replays and exports identically to what was heard.
- Stage 1 is complete for free users; the unlock, restore and parental gate work with the mocked store in dev and the real store in preview builds.
- No network calls except purchases; privacy pages live; `npm run release:check` prints READY.

