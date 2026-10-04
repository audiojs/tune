# @audio/tune-snap [![npm](https://img.shields.io/npm/v/@audio/tune-snap)](https://www.npmjs.com/package/@audio/tune-snap) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

> Pitch correction to a scale: each note's centre moved onto its note, its slow drift flattened, the voice's own cycles re-spaced along one pitch curve (Auto-Tune / Melodyne class)

```
npm install @audio/tune-snap
```

```js
import snap from '@audio/tune-snap'

snap(voice, { fs })                                  // chromatic, natural: centres on their notes, vibrato kept
snap(voice, { fs, scale: 'major', root: 2 })         // to D major
snap(voice, { fs, speed: 0 })                        // every moment on its note: the hard, stepped sound
snap(voice, { fs, strength: .5 })                    // half way there
snap([left, right], { fs })                          // a stereo voice, on one pitch and one set of cycles
```

The voice's pitch is pYIN's Viterbi path (Mauch & Dixon, ICASSP 2014) every 5 ms. The note each moment means is a Viterbi path over the scale's notes: a frame costs its squared distance from a note, a change of note costs what 40 ms a semitone away does, so a vibrato swinging past the midpoint between two notes stays on its note and a sung step moves to the next. Each note's centre, the median of its middle half, is moved onto its note; the part of its pitch slower than `speed` (drift, a held note sagging) is taken away and the faster part (vibrato, a scoop, a slide) kept. Between notes the shift crosses over a raised cosine, inside the gap between them, or `speed` long across a legato step. Then the voice's own glottal cycles are re-spaced along that curve, found on the same pitch ([`@audio/tune-curve`](../tune-curve), TD-PSOLA): formants, consonants and breath kept.

Nothing is cut out, shifted apart and crossfaded back over the dry voice, so no note comes in or out with a jump in pitch or a dip where two pitches cancel. Unvoiced audio passes as it is; a note already in tune is left as sung, and a take all in tune comes out sample for sample.

| `options` | default | |
|---|---|---|
| `fs` | `44100` | Hz (`sampleRate` is read too) |
| `scale` | `'chromatic'` | `'major'`, `'minor'`, `'harmonic-minor'`, `'melodic-minor'`, `'pentatonic-major'`, `'pentatonic-minor'`, `'blues'`, `'dorian'`, `'mixolydian'`, `'whole'`, or the degrees as semitones above the root |
| `root` | `0` | the scale's root, semitones above C (2 is D, 9 is A) |
| `a4` | `440` | Hz, the tuning of A4 |
| `strength` | `1` | how much of the correction is applied: 1 all, .5 half way, 0 none |
| `speed` | `80` | ms: how slow a motion within a note must be to be corrected away. 0 sets every moment on its note; 20 keeps 40% of a 5.5 Hz vibrato, 50 keeps 80%, 80 keeps 90% and takes away drift; 400 moves the notes' centres alone |
| `tolerance` | `8` | cents: a note whose centre, and its motion slower than `speed`, stay this close to its note is left as sung |
| `minFreq`, `maxFreq` | `60`, `1000` | Hz, the pitch looked for |

`pitchOf(channels, opts)` and `correction(midi, opts)` are the two halves before the retune: the pitch every 5 ms (MIDI, NaN unvoiced), and the shift in semitones that tunes it.

## Measured

Eight solo singers of [Vocadito](https://zenodo.org/records/5578807) (tracks 1, 5, 10, 14, 20, 27, 33, 38: 158 s, 2021, CC BY 4.0), chromatic. A note's pitch is the median of the corrected voice's pYIN pitch over the middle of each annotated note of 150 ms or more; periodicity is 1 less YIN's least normalized difference over 30 ms, its loss counted where the sung voice's exceeds 0.8.

| | notes within 10 cents of a semitone | mean distance | periodicity lost, 1% worst frames | time per second of audio |
|---|---|---|---|---|
| as sung | 26% | 23.7 cents | | |
| tune-snap 1 (per-note PSOLA, crossfaded over dry) | 64% | 10.4 cents | 0.17 | 97 ms |
| `speed: 80` | 71% | 8.4 cents | 0.07 | 19 ms |
| `speed: 0` | 96% | 2.6 cents | 0.17 (the steps between notes) | 19 ms |

On a synthetic voice gliding from A3 30 cents sharp to C#4 40 cents flat in 80 ms, the glide kept its level within 1.2 dB and moved no faster than it was sung; tune-snap 1 dropped 3.2 dB where its shifted note crossed back into the dry glide, and YIN found no period there.

**Use when:** one voice, sung or played on a monophonic instrument, tuned to a scale: natural correction or the hard-tuned effect.<br>
**Not for:** chords, mixes, a choir (one pitch per moment); retuning to a written melody, use [`@audio/tune-midi`](../tune-midi).

---

Part of [@audio/tune](https://github.com/audiojs/tune), the tune family umbrella.

MIT © [audiojs](https://github.com/audiojs)
