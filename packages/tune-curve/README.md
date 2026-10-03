# @audio/tune-curve [![npm](https://img.shields.io/npm/v/@audio/tune-curve)](https://www.npmjs.com/package/@audio/tune-curve) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

> Retune a voice along a pitch curve, its own glottal cycles re-spaced (TD-PSOLA): formants and consonants kept (Melodyne class)

```
npm install @audio/tune-curve
```

```js
import tuneCurve from '@audio/tune-curve'

tuneCurve(voice, { semitones: 3, fs: 44100 })                               // a constant shift
tuneCurve(voice, { semitones: { t: [0, 1, 1.5], v: [0, 2, 0] }, fs })      // a drawn curve: seconds → semitones
tuneCurve(voice, { semitones: t => 0.5 * Math.sin(2 * Math.PI * 5 * t), fs }) // vibrato

let write = tuneCurve({ semitones: curve, fs })   // streaming: write(chunk) → output `write.latency` samples behind
let out = write(chunk), tail = write()
```

A cycle at a time is cut around its mark by a two-lobed window and laid at the spacing the curve asks for (Moulines & Charpentier, *Speech Communication* 9, 1990). The pulse shape, the vocal tract's ringing on it, the breath and the jitter stay the voice's own, so the formants stay where they were and nothing is resynthesized. Unvoiced audio (consonants, breath, silence) passes as it is. Where the ratio is 1 and the cycles are laid where they were, the output is the input.

The cycles are found as the audio streams: f0 by YIN (de Cheveigné & Kawahara, *JASA* 111, 2002) on the channels' mean at about 11 kHz, every 5 ms, a frame voiced where its normalized difference dips under .35 and a neighbour's does (YIN's own .15 holds only a voice that does not glide within the frame: of a lecture's voiced frames, 25 to 29% landed within 50 cents of a 4-semitone shift; at .35, 63 to 66%, while the looser dip sometimes takes a harmonic's period for the voice's, a sung take going from 75% to 68%); a mark per cycle, the first at the loudest sample of a voiced run's first period and each next a period on, moved to where a period of waveform matches the one before best (normalized correlation, refined between samples). A lowered pitch lays its cycles further apart than they are long and leaves the gaps between them: lobes widened to fill them took in the cycles either side, and an octave down, two periods apart, gave the input's own period back. Cycles are read at fractional places through a Kaiser-windowed sinc, so the output is periodic at the new pitch, not jittered to whole samples.

| `options` | default | |
|---|---|---|
| `semitones` | `0` | a number, a function of seconds from the stream's start, or a curve `{ t, v }` (straight between points, flat past its ends) |
| `ratio` | | the shift as a frequency ratio instead, in the same forms |
| `fs` | `44100` | Hz (`sampleRate` is read too) |
| `minFreq` | `60` | Hz, the lowest pitch a cycle is looked for at |
| `maxFreq` | `1000` | Hz, the highest |
| `rmin` | `0.25` | the least ratio the curve takes: a stream's latency covers it |

Channels are retuned on one set of cycles, found on their mean, so a stereo voice keeps its image. Streaming output equals the batch output sample for sample, however the input is chunked.

## Measured

Against a synthetic voice re-synthesized at the target pitch (Rosenberg pulses through Peterson & Barney's /a/ formants, the same at both pitches), from −7 to +12 semitones at 120 and 220 Hz:

| | harmonics re the truth, median (max) | between harmonics | period shape vs the truth |
|---|---|---|---|
| `tune-curve` | 3.2 dB (5.7) | −95 dB | 0.92 |
| `@audio/shift-formant` | 4.3 dB (6.1) | −80 dB | 0.81 |
| phase-locked vocoder | 10.9 dB (34.5) | −64 dB | 0.60 |

On a sung recording (audio-lena) and a speech sample, the long-term spectrum over voiced frames stays within ±0.5 to ±1.7 dB of the input from −4 to +7 semitones (the vocoder: ±3.7 to ±12.6 dB), the pitch within a median 0.7 to 2.2 cents of the input's times the ratio.

**Use when:** one voice, speech or singing: pitch correction, intonation, drawn pitch curves.<br>
**Not for:** chords, mixes, drums (no single cycle to re-space: they pass unshifted where unvoiced), or a pure tone (its "formant" is the tone itself, which a kept envelope holds in place).

---

Part of [@audio/tune](https://github.com/audiojs/tune), the tune family umbrella.

MIT © [audiojs](https://github.com/audiojs)
