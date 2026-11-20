# REVIEW (multi-persona pass)

Evidence: unit tests (71), prebuilt Android manifest, `npm audit --omit=dev`, headless renders, browser runs of the web demo, mix audits (6 singers; and 6 singers + bonus loop + ambience). Nothing here was run on a device.

## Store reviewer (Apple / Google)
- FIXED: `SYSTEM_ALERT_WINDOW` was in the merged manifest (flagged by Play) -> blocked in app.json. Manifest now: INTERNET (purchases), VIBRATE (haptics); RECORD_AUDIO and storage permissions removed.
- FIXED: sharing or saving a song now sits behind the grown-up check (a child could send audio to a stranger through the share sheet).
- OK: purchase, restore, privacy link behind the gate; price from the store; no ads/tracking/accounts.
- OPEN (owner): privacy pages live (PR app-pages#1), products in both stores, screenshots from a real build, closed test for new Google accounts.

## Parent
- OK: no ads, timers, streaks, notifications; delete asks for confirmation; reset progress asks.
- FIXED: leaving a stage (back, help, songs) lost the band; it is now remembered while the app is open.
- NOTE: the Clear button is a big target near the corner; accidental use is recoverable by dragging singers back (no undo yet).

## Child (4-6 years)
- OK: tap-to-add, drag, first-run hand, pictogram help, large targets, no text needed for the core loop.
- FIXED: a shallow diagonal drag from the menu was read as a scroll (singer not picked up).
- OPEN: the reward ring shows a number (digits only); a pure icon countdown would be friendlier for non-readers.

## Accessibility auditor
- FIXED: the stage is a canvas, so a screen reader saw nothing. With VoiceOver/TalkBack on, an accessible layer now lists every singer (add/remove) and each singer on stage as an adjustable control (volume up/down, mute, solo, remove).
- OK: labels on icon buttons, Reduce Motion, colour is never the only cue (layer glyphs), 52+ pt targets.
- OPEN: layouts use fixed font sizes (large system text may clip captions); verify on device.

## Right-to-left (Hebrew)
- FIXED: back/next arrows pointed the wrong way in Hebrew; icons now mirror.
- OK: strings complete and checked by test; stage not mirrored by design.
- OPEN: check caption widths in Hebrew on small phones.

## QA tester
- FIXED: Android hardware back button left the app from any screen; now steps back one screen (closes the grown-up check first).
- OK: corrupt save file falls back to defaults; atomic write; ErrorBoundary; pause on background/interruption.
- OPEN: never exercised on a device (touch, interruptions, low storage, purchase edge cases).

## Audio engineer
- OK: loops -20 LUFS, master trim -8 dB, limiter budget met in 40,000 sampled mixes; celebration mixes (six singers + bonus + ambience) reduce at most 3.6 dB.
- NOTE: live master is a soft-clip curve, export uses the look-ahead limiter; identical at audited levels but not bit-identical.
- OPEN: m4a loop point may click on a device (AAC priming) - listen on headphones; fallback is FLAC/WAV via one switch.

## Performance engineer
- FIXED: the 24-singer tray was redrawn every frame (thousands of paint objects per frame); it is now recorded once per touch change (breathing animation removed from the tray).
- OPEN: stage singers still allocate paints each frame; measure on a Pixel 6a / iPhone 11 and cache if below 60 fps.

## Security / privacy
- OK: no network calls besides the store; file names sanitised; no secrets; `npm audit --omit=dev`: 5 moderate issues, all in build tooling (not shipped).

## Game designer
- OK: 5 worlds, 120 singers, 20 combos, stickers, honest hints, reward countdown.
- OPEN: scenery and the tap-the-scenery toy exist only in the web demo (not the app).
