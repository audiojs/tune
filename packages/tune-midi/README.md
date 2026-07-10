# @audio/tune-midi

> Note-target pitch correction — align melody to reference MIDI/notes (Melodyne class)

MIDI-guided pitch correction — retune audio to a note guide (parsed SMF via
`@audio/midi-parse`, or a plain note list): YIN F0 track → per-guide-note median →
PSOLA shift to the guide pitch, crossfaded over dry. The melody-following complement
of `tune-snap`'s scale snapping.

```js
import tuneMidi from '@audio/tune-midi'
import parse from '@audio/midi-parse'

let corrected = tuneMidi(data, { guide: parse(smfBytes) })     // or { guide: [{time, duration, midi}] }
```

`tuneMidi(data: Float32Array, opts: {guide: Array<{time, duration, midi}> | {notes} (midi-parse output), fs=44100, a4=440, strength=1, tolerance=8 (¢), maxShift=700 (¢, skip wild targets), frameSize=2048, hop=512, fade=0.01}) → Float32Array`

Built on `@audio/pitch-yin` (F0 tracking) and `@audio/shift-psola` (pitch shifting).

## Install

```
npm i @audio/tune-midi
```
