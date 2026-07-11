# @audio/tune-snap [![npm](https://img.shields.io/npm/v/@audio/tune-snap)](https://www.npmjs.com/package/@audio/tune-snap) [![MIT](https://img.shields.io/badge/MIT-%E0%A5%90-white)](https://github.com/krishnized/license)

Scale/key pitch correction — YIN track → note segments → scale snap → PSOLA retune (Auto-Tune class)

```
npm install @audio/tune-snap
```

```js
import snap from '@audio/tune-snap'
```

YIN F0 tracking per frame, segmented into note runs (a run splits wherever pitch jumps more than 80¢ from its running median), each segment's median pitch snapped to the nearest note in `scale`/`root`, then shifted there with PSOLA and crossfaded back over the dry signal. v1 corrects per note segment — no intra-note glide/portamento; unvoiced audio passes through untouched.

```js
snap(data, { scale: 'major', root: 0 })              // classic Auto-Tune-style scale correction
snap(data, { scale: 'chromatic', strength: 0.5 })    // half-strength chromatic snap ("natural" mode)
```

| Param | Default | |
|---|---|---|
| `fs` | `44100` | Hz |
| `scale` | `'chromatic'` | `'chromatic'`, `'major'`, `'minor'`, `'harmonic-minor'`, `'melodic-minor'`, `'pentatonic-major'`, `'pentatonic-minor'`, `'blues'`, `'dorian'`, `'mixolydian'`, `'whole'` |
| `root` | `0` | 0–11, root note (0 = C) |
| `a4` | `440` | Hz, tuning reference |
| `tolerance` | `8` | cents; segments already this close to a scale note are left alone |
| `strength` | `1` | 0–1, correction amount (0 = no shift, 1 = full snap) |
| `frameSize` | `2048` | YIN analysis frame |
| `hop` | `512` | frame hop |
| `fade` | `0.01` | s, crossfade at each segment boundary |

Built on [`@audio/pitch-yin`](https://github.com/audiojs/pitch-yin) (F0 tracking) and [`@audio/shift-psola`](https://github.com/audiojs/shift-psola) (pitch shifting). The melody-following complement is [`@audio/tune-midi`](https://github.com/audiojs/tune-midi), which retunes to a reference note guide instead of a scale.

**Use when:** vocal/instrument scale correction, Auto-Tune-style effects.<br>
**Not for:** retuning to a specific melody/guide track — use `tune-midi`.

---

Part of [@audio/tune](https://github.com/audiojs/tune) — the tune family umbrella.

MIT © [audiojs](https://github.com/audiojs)
