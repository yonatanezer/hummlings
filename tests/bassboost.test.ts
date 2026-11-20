import { describe, expect, it } from 'vitest';
import { BASS_BOOST, bassHarmonicsCurve } from '../src/core/bassBoost';

describe('bass harmonics (so small speakers can play the bass group)', () => {
  const c = bassHarmonicsCurve();
  it('maps +-1 to +-1, is odd and never decreases', () => {
    expect(c[0]).toBeCloseTo(-1, 6);
    expect(c[c.length - 1]).toBeCloseTo(1, 6);
    expect(c[(c.length - 1) / 2]).toBeCloseTo(0, 6);
    for (let i = 1; i < c.length; i++) expect(c[i]!).toBeGreaterThanOrEqual(c[i - 1]!);
    for (let i = 0; i < 100; i++) expect(c[i]!).toBeCloseTo(-c[c.length - 1 - i]!, 6);
  });
  it('keeps the added band above what a phone speaker plays and the mix quiet', () => {
    expect(BASS_BOOST.highpassHz).toBeGreaterThanOrEqual(250);
    expect(BASS_BOOST.lowpassHz).toBeLessThan(BASS_BOOST.highpassHz);
    expect(BASS_BOOST.wet).toBeLessThanOrEqual(0.6);
  });
});
