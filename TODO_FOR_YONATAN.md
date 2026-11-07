# TODO FOR YONATAN (in order)

Links: look sheet https://claude.ai/artifact/NFGEyFh1q9DYkpx4NvtcB9  |  playable demo https://claude.ai/artifact/MzUnzcENxYkMTtj7DJwVVK

## 1. Run it on a phone (needed before anything else; the app was never run on a device)
Needs Node 22+, and Xcode (iPhone) or Android Studio + USB debugging (Android). Expo Go cannot run the audio engine.
1. `git clone https://github.com/yonatanezer/hummlings && cd hummlings && git checkout claude/hummlings-build`
2. `npm install`
3. Android: `npx expo run:android`  |  iPhone: `npx expo run:ios --device`
4. Then `npm start` and open the installed Hummlings app on the same Wi-Fi.

### Device feel checklist (tick each; write down anything that fails)
- [ ] Music starts softly (hi-hat count) and the animated hand shows on a fresh install
- [ ] Drag a singer to the stage: it hops on, starts on the next bar, haptic on pick-up (light) and drop (medium)
- [ ] 3+ singers stay perfectly in sync; no click when adding, removing, muting
- [ ] Tap = mute (eyes close); hold = volume popup, drag changes level, colour drains, star = solo
- [ ] Loops repeat without a gap or click at the loop point (listen on headphones, 3 minutes)
- [ ] Combo: put the 4 right singers together; celebration starts after a full loop; book replay works
- [ ] Record, stop, My songs, play (sounds identical), rename, share the WAV, delete (confirm)
- [ ] Silent switch on (iPhone): music still plays. Incoming call or headphones unplugged: music pauses, big play button
- [ ] Both languages (Settings > Language); Hebrew text mirrors, the stage does not
- [ ] iPhone SE / small phone: every button reachable; tablet: layout scales
- [ ] Smooth (60 fps) with 6 singers and a celebration
When all pass, create the file `docs/DEVICE_CHECK_PASSED.txt` (any text inside) and tell me what failed otherwise.

## 2. Publish the privacy and support pages
Copy `pages/hummlings/` into your shared repo `yonatanezer/app-pages` (folder `hummlings/`), commit, enable GitHub Pages (Settings > Pages > main). Check:
https://yonatanezer.github.io/app-pages/hummlings/privacy.html and .../support.html

## 3. Store accounts and products (costs money, needs you)
1. Apple Developer Program (99 USD/yr) and Google Play Console (25 USD once), both with developer name Yonatan Ezer.
2. App Store Connect: new app "Hummlings", bundle id `com.yonatanezer.hummlings`, subtitle and texts from STORE_LISTING.md, privacy label "Data Not Collected", age rating 4+ (STORE_ANSWERS.md).
3. Create the non-consumable in-app purchase `hummlings.unlock_all` (price tier equal to USD 3.99) in both stores.
4. Google Play: new app, package `com.yonatanezer.hummlings`, Data safety = no data, content rating = Everyone, add the same product id.
5. Google closed test: new personal developer accounts must run a closed test (12 testers for 14 days) before production. Start it as soon as a build is uploaded.

## 4. Builds (EAS; free tier is enough, paid builds need your OK)
1. `npm i -g eas-cli && eas login && eas init`
2. `eas build --profile preview --platform all` and test the real purchase with a sandbox/test account (buy, cancel, restore, airplane mode after buying).
3. `eas build --profile production --platform all` then `eas submit --platform all`.

## 5. Store screenshots (from the final build)
Take the 5 shots listed in STORE_LISTING.md in English and Hebrew on a real device or simulator at the required sizes. The feature graphic is `assets/store/feature.png`.

## 6. Finish
`npm run release:check` must print READY (needs steps 1 and 2 done). Then submit for review.
