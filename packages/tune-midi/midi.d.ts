/** A single guide note in absolute time. */
export interface GuideNote {
  /** s, note start */
  time: number
  /** s, note length */
  duration: number
  /** MIDI note number */
  midi: number
}

/** MIDI-guided pitch correction — retune audio to a note guide (parsed SMF via `@audio/midi-parse`, or a plain note list). */
export interface MidiOptions {
  /** the reference melody: a plain note list, or `@audio/midi-parse`'s `{ notes }` output. Required — throws RangeError if omitted or empty. */
  guide: GuideNote[] | { notes: GuideNote[] }
  /** Hz, default 44100 */
  fs?: number
  /** Hz, tuning reference, default 440 */
  a4?: number
  /** 0-1, correction amount (0 = no shift, 1 = full retune to guide), default 1 */
  strength?: number
  /** cents; a note-span measurement already this close to its guide target is left alone, default 8 */
  tolerance?: number
  /** cents; skip wild targets whose correction would exceed this, default 700 */
  maxShift?: number
  /** YIN analysis frame, samples, default 2048 */
  frameSize?: number
  /** frame hop, samples, default 512 */
  hop?: number
  /** s, crossfade at each note boundary, default 0.01 */
  fade?: number
}

/** Returns a corrected copy of `data`, retuned to `options.guide`. The melody-following complement of `@audio/tune-snap`'s scale snapping. */
export default function tuneMidi(data: Float32Array, options: MidiOptions): Float32Array
