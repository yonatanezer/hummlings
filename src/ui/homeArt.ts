/* eslint-disable @typescript-eslint/no-require-imports */
// Hand-drawn art for the home screen (cut from the artist's sheet by hand; see assets/home).
export const HOME_ART = {
  logo: require('../../assets/home/logo.png') as number,
  btnGear: require('../../assets/home/btn-gear.png') as number,
  btnHelp: require('../../assets/home/btn-help.png') as number,
  btnNote: require('../../assets/home/btn-note.png') as number,
  cards: [
    require('../../assets/home/card1.png'),
    require('../../assets/home/card2.png'),
    require('../../assets/home/card3.png'),
    require('../../assets/home/card4.png'),
    require('../../assets/home/card5.png'),
  ] as number[],
  planetRing: require('../../assets/home/planet-ring.png') as number,
  planetA: require('../../assets/home/planet-a.png') as number,
  planetB: require('../../assets/home/planet-b.png') as number,
  planetC: require('../../assets/home/planet-c.png') as number,
  comet: require('../../assets/home/comet.png') as number,
  cloudA: require('../../assets/home/cloud-a.png') as number,
  cloudB: require('../../assets/home/cloud-b.png') as number,
  starA: require('../../assets/home/star-a.png') as number,
  starB: require('../../assets/home/star-b.png') as number,
  starC: require('../../assets/home/star-c.png') as number,
};
export { CARD_BY_STAGE_INDEX } from './homeCardOrder';
