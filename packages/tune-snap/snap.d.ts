/** Pitch correction to a scale (Auto-Tune / Melodyne class): each note's centre moved onto the scale note it means, its
 *  motion slower than `speed` flattened, the voice's own cycles re-spaced along that one curve (TD-PSOLA). */
export interface SnapOptions {
  /** Hz, default 44100 (`sampleRate` is read too) */
  fs?: number
  sampleRate?: number
  /** the notes a voice may land on, default 'chromatic'; or the scale's degrees, semitones above the root */
  scale?: 'chromatic' | 'major' | 'minor' | 'harmonic-minor' | 'melodic-minor' | 'pentatonic-major' | 'pentatonic-minor' | 'blues' | 'dorian' | 'mixolydian' | 'whole' | number[]
  /** 0-11, the scale's root, semitones above C, default 0 */
  root?: number
  /** Hz, the tuning of A4, default 440 */
  a4?: number
  /** 0-1, how much of the correction is applied, default 1 */
  strength?: number
  /** ms, default 80: how slow a motion within a note must be to be corrected away. 0 sets every moment on its note
   *  (the hard, stepped sound); longer keeps more of the voice's own vibrato, scoops and drift */
  speed?: number
  /** cents, default 8: a note whose centre, and its motion slower than `speed`, stay this close to its note is left as
   *  sung */
  tolerance?: number
  /** Hz, the lowest pitch looked for, default 60 */
  minFreq?: number
  /** Hz, the highest, default 1000 */
  maxFreq?: number
}

/** A corrected copy of `data`: one channel, or channels retuned on one pitch and one set of cycles. Unvoiced audio
 *  passes as it is. Whole-signal: the notes are decoded over the whole line. */
export default function snap(data: Float32Array, options?: SnapOptions): Float32Array
export default function snap(data: Float32Array[], options?: SnapOptions): Float32Array[]

/** The voice's pitch every 5 ms: `times` (s) and `midi` (MIDI re `a4`, NaN where unvoiced). */
export function pitchOf(channels: Float32Array[], options?: Pick<SnapOptions, 'fs' | 'a4' | 'minFreq' | 'maxFreq'>): { times: Float64Array, midi: Float64Array }

/** The shift, semitones per 5-ms frame, that tunes a pitch track (MIDI per frame, NaN where unvoiced). */
export function correction(midi: ArrayLike<number>, options?: Pick<SnapOptions, 'scale' | 'root' | 'strength' | 'speed' | 'tolerance'>): Float64Array
