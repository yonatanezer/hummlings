# STORE ANSWERS

## Ratings
- Apple age rating 4+: no objectionable content, no web content (the privacy policy link opens the browser behind the grown-up check), no user-generated content shared in-app.
- PEGI 3. Google Play IARC: Everyone.
- Not enrolled in Apple Kids category or Google Families programme (kid-safe anyway: no ads, no cross-app tracking, no chat).

## Privacy
- Apple privacy label: **Data Used to Track You: none. Data Not Linked to You: Usage Data (Product Interaction), purpose Analytics.** Not Data Not Collected any more (PostHog EU anonymous events, see src/app/analytics.ts).
- Google Data safety: collects App activity > App interactions (anonymous, not linked, not shared except with PostHog as a service provider, purpose Analytics, collection not optional); no personal data, no device or advertising IDs; data in transit is encrypted (HTTPS); purchases are handled by Google/Apple; account creation: none; data deletion: not applicable (data stays on the device; Settings > Reset progress).
- Permissions: none requested. RECORD_AUDIO and external storage permissions are blocked in app.json.
- Tracking (ATT): not used, no advertising identifier. No analytics SDK; events are posted to PostHog EU with no device id.
- Risk to re-check before submitting: the app is also for children. Apple Kids category and Google Families programme stay NOT enrolled (see Ratings); enrolling would need analytics off or behind parental consent.
- Privacy policy URL: https://yonatanezer.github.io/app-pages/hummlings/privacy.html
- Support URL: https://yonatanezer.github.io/app-pages/hummlings/support.html

## Content rights
All art is drawn in code and all sound is synthesised by scripts in this repo (docs/ORIGINALITY.md). No third-party assets.

## Export compliance
ITSAppUsesNonExemptEncryption = false (no encryption beyond what the operating system provides).

## In-app purchase
- Product: non-consumable `hummlings.unlock_all`, price tier equal to USD 3.99. Unlocks worlds 2 to 5 (four worlds, 96 singers, 16 secret combos).
- Reviewer note: a grown-up check (a sum of a number from 11 to 19 and a number from 3 to 9, then a 2-second hold) appears before the purchase screen and before the privacy link. Restore purchases is in Settings and on the unlock screen.

## Accounts
No accounts, so no account deletion flow is needed.
