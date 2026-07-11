/** Scale-correction (Auto-Tune class) — YIN F0 track → note segmentation → scale snap → PSOLA retune, crossfaded over the dry signal. */
export interface SnapOptions {
  /** Hz, default 44100 */
  fs?: number
  /** target scale, default 'chromatic' */
  scale?: 'chromatic' | 'major' | 'minor' | 'harmonic-minor' | 'melodic-minor' | 'pentatonic-major' | 'pentatonic-minor' | 'blues' | 'dorian' | 'mixolydian' | 'whole'
  /** 0-11, root note (0 = C), default 0 */
  root?: number
  /** Hz, tuning reference, default 440 */
  a4?: number
  /** cents; segments already this close to a scale note are left alone, default 8 */
  tolerance?: number
  /** 0-1, correction amount (0 = no shift, 1 = full snap), default 1 */
  strength?: number
  /** YIN analysis frame, samples, default 2048 */
  frameSize?: number
  /** frame hop, samples, default 512 */
  hop?: number
  /** s, crossfade at each segment boundary, default 0.01 */
  fade?: number
}

/** Returns a corrected copy of `data`; unvoiced audio passes through untouched. No streaming form (v1 corrects per note segment, no intra-note glide). */
export default function snap(data: Float32Array, options?: SnapOptions): Float32Array
