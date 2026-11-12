# PROGRESS
Resume: read CLAUDE.md, DECISIONS.md, TODO_FOR_YONATAN.md, this file; run `npm run check`. Branch claude/hummlings-build (draft PR #1).

| Milestone | Status |
|---|---|
| M0 Setup | DONE |
| M1 Core + look approved | DONE (look approved by owner; playable web demo is the review tool) |
| M2 Full v1 | DONE in code: all screens, save/load, settings, help, stickers, volume popup. Not run on a device. |
| M3 Money + store kit | DONE in repo: expo-iap behind interface, eas.json, icons, pages, store texts. Needs owner: accounts, products, publish pages. |
| M4 Polish + release | Partial (full mix audit PASSED after trim -7 dB; export 1.2 s in Node): sampled mix audit in `check`, full audit `npm run qa:audit`, `npm run release:check` (currently NOT READY: LESSONS final, live pages, device check). |

Known gaps: never run on a device; scenery and tap-toy only in web demo; guide leaves the stage; store screenshots need a real build; m4a loop-gap unverified.
Commands: `npm run check`, `npm run content`, `npm run sounds`, `npm run qa:audit`, `npm run release:check`, `npx tsx scripts/build-web.ts` (demo), `npx tsx scripts/look-sheet.ts`, `npx tsx scripts/build-icons.ts`.
