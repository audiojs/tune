/** A breakpoint curve: seconds → value, straight between points, flat past its ends. */
export interface Curve {
  t: ArrayLike<number>
  v: ArrayLike<number>
}

/** Retune a voice along a pitch curve, its own glottal cycles re-spaced (TD-PSOLA): formants and consonants kept. */
export interface CurveOptions {
  /** the shift in semitones: a number, a function of seconds from the stream's start, or a curve. Default 0 */
  semitones?: number | ((t: number) => number) | Curve
  /** the shift as a frequency ratio instead (2 = an octave up), in the same forms */
  ratio?: number | ((t: number) => number) | Curve
  /** Hz, default 44100 (`sampleRate` is read too) */
  fs?: number
  sampleRate?: number
  /** Hz, the lowest pitch a cycle is looked for at, default 60 */
  minFreq?: number
  /** Hz, the highest, default 1000 */
  maxFreq?: number
  /** the least ratio the curve takes, for the stream's latency (a lowered pitch lays its cycles wider), default 0.25 */
  rmin?: number
  /** the voice's pitch to find its cycles on, instead of the retuner's own YIN: a curve (seconds → Hz, 0 where
   *  unvoiced; straight in log frequency between voiced points) or a function of seconds */
  f0?: ((t: number) => number) | Curve
}

/** A stream: write(chunk) → the retuned stream so far, `latency` samples behind; write() → the rest. A chunk is a
 *  Float32Array, or an array of channels retuned on one set of cycles. */
export interface CurveWriter {
  (chunk: Float32Array): Float32Array
  (chunk: Float32Array[]): Float32Array[]
  (): Float32Array | Float32Array[]
  latency: number
}

/** Retune `data` (one channel, or channels on one set of cycles); the same length out. */
export default function tuneCurve(data: Float32Array, options?: CurveOptions): Float32Array
export default function tuneCurve(data: Float32Array[], options?: CurveOptions): Float32Array[]
export default function tuneCurve(options?: CurveOptions): CurveWriter

/** The ratio at t seconds from the stream's start, from `ratio` or `semitones`. */
export function ratioOf(options?: CurveOptions): (t: number) => number

/** Samples the retuner runs behind its input. */
export function latencyOf(options?: CurveOptions): number

/** The streaming core over `channels`: write(channels) → the timeline samples now final; end() → the rest. */
export function retuner(channels: number, options?: CurveOptions): {
  latency: number
  readonly late: number
  write(chunk: Float32Array[]): Float32Array[]
  end(): Float32Array[]
}
