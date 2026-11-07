# TODO FOR YONATAN

## 1. Approve the look and sound (needed now)
Open the look sheet (private artifact): https://claude.ai/artifact/NFGEyFh1q9DYkpx4NvtcB9
It has every creature of the 3 worlds, the stage states (full, muted, solo, celebration, first-run hand, dragging), screen sizes,
stage select, combo book, plus audio of every stage-1 loop and a full mix. Answer "approved" or tell me what to change.

## 2. Run it on your phone (the app needs a development build: Expo Go cannot run the audio engine)
Requires a computer with Node 22+, and Xcode (iPhone) or Android Studio + a USB cable / emulator (Android).
1. `git clone https://github.com/yonatanezer/hummlings && cd hummlings && git checkout claude/hummlings-build`
2. `npm install`
3. Android phone (USB debugging on): `npx expo run:android`   |   iPhone (Xcode, signed in with your Apple ID): `npx expo run:ios --device`
4. After the first build, start the dev server with `npm start` and open the installed "Hummlings" app on the same Wi-Fi.
5. Device feel checklist: first-run hand appears; drag a creature to the stage (it starts on the next bar); tap = mute; hold 400 ms = solo;
   drag off = remove; record, stop, open My songs, play, share; find a combo (combo book dots help); lock rotation is landscape only.

(More steps — builds, store records, GitHub Pages, submission — are added as the milestones complete.)
