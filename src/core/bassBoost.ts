/**
 * Why the blue singers (the bass group) were hard to hear: their loops keep almost all of their energy below 150 Hz, and a phone or laptop speaker barely plays below
 * ~250 Hz. Measured on the pond loops: about -16 dB below 150 Hz but only -36 dB above 300 Hz, against -18 dB for the melody and voice in that same upper band, so on a
 * small speaker the bass sat ~18 dB under everything else (the loops are all normalised to the same overall loudness, which hides this).
 *
 * The fix is the classic "missing fundamental": every bass voice also plays harmonics of its own low notes (the low band is saturated, the saturated copy keeps only
 * what lies above 280 Hz and is mixed in quietly). The ear hears the same bass note, now through the speaker, and the loud low end of a real speaker or headphones is untouched.
 * Measured with these numbers: the band above 300 Hz rises about 12 dB, the overall level only about 1 dB, peaks about 2.5 dB.
 */
export const BASS_BOOST = { lowpassHz: 150, drive: 2.5, shape: 3, highpassHz: 280, wet: 0.5, q: 0.707 } as const;

/** WaveShaper curve of the saturator: tanh, normalised so that +-1 maps to +-1. Odd and monotonic. */
export function bassHarmonicsCurve(points = 2049): Float32Array {
  const out = new Float32Array(points);
  const norm = Math.tanh(BASS_BOOST.shape);
  for (let i = 0; i < points; i++) out[i] = Math.tanh(BASS_BOOST.shape * ((i / (points - 1)) * 2 - 1)) / norm;
  return out;
}
