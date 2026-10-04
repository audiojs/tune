# @audio/tune

> Pitch correction (Auto-Tune / Melodyne class).

| Package | What |
|---|---|
| `@audio/tune-snap` | scale/key correction: pYIN pitch → the notes meant on the scale → each centred on its note, slow drift flattened → one curve through `tune-curve` |
| `@audio/tune-midi` | melody correction — YIN → per-guide-note median → PSOLA retune to a MIDI/note guide |
| `@audio/tune-curve` | a drawn pitch curve: the voice's own glottal cycles re-spaced (TD-PSOLA): formants and consonants kept, streaming |

```js
import { snap, tuneMidi } from '@audio/tune'

snap(data, { scale: 'major', root: 0 })      // to C major, vibrato kept
snap(data, { speed: 0 })                     // the hard-tuned effect
tuneMidi(data, { guide: parsedSmf.notes })   // retune to a reference melody
tuneCurve(data, { semitones: { t: [0, 1, 1.5], v: [0, 2, 0] } })   // along a curve, as drawn (Melodyne class)
```

`tune-snap` builds one pitch curve over the whole take and retunes along it with `tune-curve`, so notes are never cut out and crossfaded back over the dry voice. `tune-midi` still shifts each guide note apart with `@audio/shift-psola` and crossfades it back.
