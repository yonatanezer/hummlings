# LAYOUT — geometry of every screen (landscape only)

Reference sizes (pt): iPhone SE 667x375, iPhone 14 844x390, Pixel 6a 915x412, iPad 1180x820. All sizes below are
formulas of the safe-area-reduced window `W x H`; `u = min(W/844, H/390)` is the scale unit (clamped 0.8..2.2).
Min touch target 56 pt (spec edge case). Spacing scale: 4, 8, 12, 16, 24 (times u, rounded).

## Common
- Background: stage sky gradient (`palette.sky` -> `#1B1340`), stars (max 40), floor `palette.floor`.
- Top bar: height 56, buttons 56x56 round, 8 gap; overlays the stage; icon-only. Back at the leading edge (mirrors in RTL),
  actions at the trailing edge. The stage itself never mirrors.
- Text only in: settings, songs list, parental gate, purchase screen. Min text 16 pt.

## 1 Splash
Logo (8 gummies in a row + wordmark) centred, 1.2 s max.

## 2 Stage select
3 cards in a row, each `W*0.28 x H*0.62`, gap 16u, vertically centred. Card: stage sky, floor strip, 4 creatures peeking
from the bottom edge, name (24 pt) under the card art, padlock badge 40u top corner on locked stages. Settings button
top-trailing, songs button top-leading next to nothing else (back not shown).

## 3 Stage
- Stage area: top `0.65H`. 6 spots on an arc: `t=(i+0.5)/6`, `x = W*(0.10+0.80t)`, `y = 0.65H - 0.10H - 0.14H*4t(1-t)`.
  Creature size `S = min(0.40H, 0.9*W/6)` (SE: ~150 -> clamp 56..200). Spot ring shown when empty (dashed, 0.8S).
- Tray: bottom `0.35H`. 16 slots, `0.56*trayH` (>=56) wide, 4 colour groups of 4 (group gap 16u). Scrolls horizontally if
  total width > W - 2*inset. Occupied slot shows a faded silhouette (25% opacity).
- Top bar: back | record | combo book | songs (settings lives on stage select). Record shows a red dot + elapsed bars while recording;
  10 s warning pulses the dot.
- Clear-all: 56x56 at the stage-area bottom trailing corner.
- Solo: darkens stage 70% except the soloist; a warm spotlight cone (`glow`, 20%) on the soloist.

## 4 Combo book overlay
Modal sheet `0.8W x 0.8H`, centred; 3 cards in a row, each with silhouette (undiscovered) or colour art + replay button,
and 4 dots (28u) that light up for creatures currently on stage. Close 56x56 top-trailing.

## 5 My songs
List, rows 72u high: name (20 pt), stage + bars + date (14 pt), play/rename/share/delete icons 56x56 each at the trailing end.
Empty state: big note icon + text. Limit banner at top when 50.

## 6 Player
Stage view as screen 3 without tray; bottom bar: play/pause 72u, timeline bar, share 56u.

## 7 Unlock
Two-column: left = creature preview of stages 2 and 3 (art), right = text, price button 64u high, restore link, close.

## 8 Settings
Single column list centred, max width 560u: volume slider (44u tall), toggles, language segmented control, restore,
privacy, about, reset. Row height 64u.

## 9 Parental gate
Centred card 420u wide: sum shown as digits ("7 + 5"), 3 answer buttons 72u, hold-to-confirm ring 88u (2 s).
