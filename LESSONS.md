# LESSONS (from this build so far)

## What worked
- Pure logic in `src/core` with no UI imports (lint-enforced) made nearly everything testable: stage state, combos, gestures, recording, offline render, goals. 60 tests, written before the UI existed.
- One drawing codebase (Skia, with `sk` and the canvas passed in) rendered headlessly in Node gave screenshots, sprite atlases, clips, icons and help lessons from the same code the app runs. The look sheet and the web demo cost almost nothing extra.
- A content generator (`stage-defs.ts` -> JSON + loops + asset map) plus a stale-content test kept 72 creatures, 87 loops and the schema consistent while the design changed five times.
- Showing the owner a playable browser build early produced far better feedback than screenshots (volume as a colour fill, long-press volume popup, world differences).
- Fixed master trim (-6 dB) before the limiter; the audit caught the headroom problem before any listening.

## What failed or was slow
- No device in the cloud sandbox: native audio, touch, performance and the store purchase flow were never run. Everything native is verified only by typecheck, bundling and unit tests.
- Scope grew by owner request (24 creatures per world, stickers, volume popup, distinct worlds). The exhaustive mix audit stopped being feasible (134,596 combinations per world) and became sampled.
- Two renderers now exist (Skia for the app, Canvas 2D for the web demo). Scenery and the tap toy live only in the web demo.
- m4a loops may show a tiny gap at the loop point on device (AAC priming); not verifiable here.

## Do differently from day one
- Ask the owner to try a playable browser build in the first hour, and decide counts and world identity (look, kit, ambience) before generating content.
- Put a device test (even one phone) in the plan before M1 closes; keep a short manual checklist next to the automated checks.
- Share scenery and effects between app and web demo from the start (one description, two backends), or skip the web demo's extras.
- Keep help and text screens renderable headlessly so they can be reviewed without a device.
