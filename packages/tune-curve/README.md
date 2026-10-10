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
tuneCurve(voice, { semitones: 2, f0: { t: times, v: hz }, fs })            // cycles found on a pitch track given

let write = tuneCurve({ semitones: curve, fs })   // streaming: write(chunk) → output `write.latency` samples behind
let out = write(chunk), tail = write()
```

A cycle at a time is cut around its mark by a two-lobed window and laid at the spacing the curve asks for (Moulines & Charpentier, *Speech Communication* 9, 1990), each lobe the source's period that side and no longer than the spacing, as Praat's PSOLA has it: two lobes meet across each gap and sum to one, so a raised voice keeps its level (lobes of a whole period overlapped three at a time, and dividing by their sum lost 1 to 5 dB from +5 semitones). The pulse shape, the vocal tract's ringing on it, the breath and the jitter stay the voice's own, so the formants stay where they were and nothing is resynthesized. Unvoiced audio (consonants, breath, silence) passes as it is. Where the ratio is 1 and the cycles are laid where they were, the output is the input.

Re-spaced, the cycles run ahead of the input by ∫(ratio − 1), and when the ratio comes back to 1 a part of a period is left over: what follows (the input, a crossfade back into it) would meet them that far off, half a period at worst, where the two cancel. Over the 100 ms before the ratio returns to 1 they drift back onto their marks, on them from 10 ms before it (about the time a voice takes to move its pitch a few semitones at its fastest: Xu & Sun, *JASA* 111, 2002), and from there the input comes back sample for sample. On eight recordings (VoiceBank, Spoken Wikipedia), a curve 0.05 to 5 semitones up or 3 down and back, its ends mid-vowel: over the 10 ms after it returns to 0, the difference from the input stood 2.2 dB above the input's own level (median of 32; at worst 5.2), and now none in any of them.

The cycles are found as the audio streams: f0 by YIN (de Cheveigné & Kawahara, *JASA* 111, 2002) on the channels' mean at about 11 kHz, every 5 ms, a frame voiced where its normalized difference dips under .35 and a neighbour's does (YIN's own .15 holds only a voice that does not glide within the frame: of a lecture's voiced frames, 25 to 29% landed within 50 cents of a 4-semitone shift; at .35, 63 to 66%, while the looser dip sometimes takes a harmonic's period for the voice's, a sung take going from 75% to 68%); a mark per cycle, the first at the loudest sample of a voiced run's first period and each next a period on, moved to where a period of waveform matches the one before best (normalized correlation, refined between samples); from a run's first mark, back up to 40 ms a cycle at a time while each matches the one after with a correlation over .7 (Praat's test for a pulse past a voiced interval's edge): YIN finds a voice once its frame is mostly voiced, and the first 20 ms or so of each run stayed at its pitch while the rest moved (6.5% of the frames Praat finds voiced on eight recordings, now 0.9%). A lowered pitch lays its cycles further apart than they are long and leaves the gaps between them: lobes widened to fill them took in the cycles either side, and an octave down, two periods apart, gave the input's own period back. Cycles are read at fractional places through a Kaiser-windowed sinc, so the output is periodic at the new pitch, not jittered to whole samples.

| `options` | default | |
|---|---|---|
| `semitones` | `0` | a number, a function of seconds from the stream's start, or a curve `{ t, v }` (straight between points, flat past its ends) |
| `ratio` | | the shift as a frequency ratio instead, in the same forms |
| `fs` | `44100` | Hz (`sampleRate` is read too) |
| `minFreq` | `60` | Hz, the lowest pitch a cycle is looked for at |
| `maxFreq` | `1000` | Hz, the highest |
| `rmin` | `0.25` | the least ratio the curve takes: a stream's latency covers it |
| `f0` | | the voice's pitch to find its cycles on instead of YIN: a curve `{ t, v }` (seconds → Hz, 0 where unvoiced, straight in log frequency between voiced points) or a function of seconds |

A whole take is better tracked than a stream: given pYIN's Viterbi path (Mauch & Dixon, ICASSP 2014; [`@audio/pitch-pyin`](https://github.com/audiojs/pitch/tree/main/packages/pitch-pyin)) as `f0`, no harmonic's period sets the cycles, which, a third or a quarter of a period apart, re-spaced the waveform's ripples instead of its pulses. Over eight solo singers of Vocadito (158 s), the 30-ms frames whose periodicity (1 less YIN's least normalized difference) fell by more than 0.2 from over 0.8 went from 103 to 36 at +2 semitones, 183 to 48 at −2 and 278 to 76 at +5.

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
