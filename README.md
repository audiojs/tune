# @audio/tune

> Pitch correction (Auto-Tune / Melodyne class).

| Package | What |
|---|---|
| `@audio/tune-snap` | scale/key correction — YIN → note segmentation → scale snap → PSOLA retune |
| `@audio/tune-midi` | melody correction — YIN → per-guide-note median → PSOLA retune to a MIDI/note guide |

```js
import { snap, tuneMidi } from '@audio/tune'

snap(data, { scale: 'major', root: 0 })      // Auto-Tune-class scale correction
tuneMidi(data, { guide: parsedSmf.notes })   // retune to a reference melody
```

Composition of existing atoms: `@audio/pitch-yin` (detect) → scale/target snap → `@audio/shift-psola` (retune), crossfaded back over the dry signal. Logic "Pitch Correction" / Ableton tuner parity.
