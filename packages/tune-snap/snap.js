// Pitch correction to a scale, as one pitch curve (Auto-Tune / Melodyne class). The voice's pitch, pYIN's Viterbi path
// (Mauch & Dixon, ICASSP 2014); the note each moment means on the scale, a Viterbi path over the scale's notes; each
// note's centre moved onto its note, its motion slower than `speed` flattened and the faster (vibrato, a scoop, a
// slide) kept, the shift crossing from one note's to the next's within the transition; then the voice's own glottal
// cycles re-spaced along that curve, found on the same pitch (@audio/tune-curve, TD-PSOLA: formants and consonants
// kept). No note is cut out, shifted apart and crossfaded back over the dry voice, so none comes in or out with a jump
// in pitch or a dip where two pitches cancel, and a voice glides into its next note as it was sung.

import { track } from '@audio/pitch-pyin'
import tuneCurve from '@audio/tune-curve'
import { SCALES } from '@audio/note'

// s, the pitch's frames
const HOP = .005
// a change of note costs what a frame a semitone off it costs, eight times over: a note changes once the pitch has sat
// nearer another for about 40 ms, and a vibrato swinging past the midpoint between two notes stays on its own
const HOLD = 4
// s, an unvoiced gap a note holds across: a tracking flicker, not a consonant
const BRIDGE = .03
// a frame whose peak is under this share of the loudest is silent, as Praat has it (Boersma 1993): pYIN's model holds
// its lowest pitch through a pause
const SILENT = .03

/** The voice's pitch every 5 ms, MIDI re `a4`, NaN where unvoiced: pYIN on the channels' mean averaged to about
 *  11 kHz (a voice's pitch stays under 1 kHz). */
export function pitchOf(channels, { fs = 44100, a4 = 440, minFreq = 60, maxFreq = 1000 } = {}) {
  let dec = Math.max(1, Math.floor(fs / 11025)), fsd = fs / dec, n = Math.floor(channels[0].length / dec), y = new Float32Array(n), top = 0
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let c of channels) for (let j = 0; j < dec; j++) s += c[i * dec + j]
    y[i] = s / dec / channels.length
    top = Math.max(top, Math.abs(y[i]))
  }
  let { times, f0 } = track(y, { fs: fsd, minFreq, maxFreq, hopSize: Math.max(1, Math.round(HOP * fsd)) })
  // the frame's peak, over its YIN window either side of its centre
  let W = 2 ** Math.ceil(Math.log2(2 * fsd / minFreq)) >> 1, midi = new Float64Array(f0.length).fill(NaN)
  for (let i = 0; i < f0.length; i++) {
    if (!f0[i]) continue
    let c = Math.round(times[i] * fsd), pk = 0
    for (let k = Math.max(0, c - W); k < Math.min(n, c + W); k++) pk = Math.max(pk, Math.abs(y[k]))
    if (pk >= SILENT * top) midi[i] = 69 + 12 * Math.log2(f0[i] / a4)
  }
  return { times: Float64Array.from(times), midi }
}

/** The note each frame of `midi` means, an index into `notes`: the Viterbi path where a frame costs its squared
 *  distance from the note over 2 (semitones) and a change of note costs HOLD. An unvoiced frame costs nothing. */
function decode(midi, notes) {
  let T = midi.length, K = notes.length, cost = new Float64Array(K), next = new Float64Array(K)
  let moved = new Uint8Array(T * K), best = new Int32Array(T)
  for (let t = 0; t < T; t++) {
    let b = 0
    for (let k = 1; k < K; k++) if (cost[k] < cost[b]) b = k
    best[t] = b
    let v = midi[t], lo = Infinity
    for (let k = 0; k < K; k++) {
      let stay = cost[k], jump = cost[b] + HOLD, o = v === v ? (v - notes[k]) ** 2 / 2 : 0
      if (stay <= jump) next[k] = stay + o
      else { next[k] = jump + o; moved[t * K + k] = 1 }
      if (next[k] < lo) lo = next[k]
    }
    for (let k = 0; k < K; k++) cost[k] = next[k] - lo
  }
  let path = new Int32Array(T), k = 0
  for (let j = 1; j < K; j++) if (cost[j] < cost[k]) k = j
  for (let t = T - 1; t >= 0; t--) { path[t] = k; if (moved[t * K + k]) k = best[t] }
  return path
}

// x[a..b) through a one-pole of `tau` frames forward, then back, each pass from 0 (tau 0: x itself)
function smooth(x, a, b, tau, out) {
  if (!(tau > 0)) { for (let i = a; i < b; i++) out[i] = x[i]; return }
  let k = 1 - Math.exp(-1 / tau), y = 0
  for (let i = a; i < b; i++) out[i] = y += k * (x[i] - y)
  y = 0
  for (let i = b - 1; i >= a; i--) out[i] = y += k * (out[i] - y)
}

// the median of the voiced frames of x[a..b), undefined if none
function median(x, a, b) {
  let v = []
  for (let i = a; i < b; i++) if (x[i] === x[i]) v.push(x[i])
  return v.sort((p, q) => p - q)[v.length >> 1]
}

const rise = u => u <= 0 ? 0 : u >= 1 ? 1 : .5 - .5 * Math.cos(Math.PI * u)

/** The shift, semitones per 5-ms frame, that tunes the pitch `midi` (MIDI per frame, NaN where unvoiced). */
export function correction(midi, { scale = 'chromatic', root = 0, strength = 1, speed = 80, tolerance = 8 } = {}) {
  let T = midi.length, move = new Float64Array(T), degrees = typeof scale === 'string' ? SCALES[scale] : scale
  if (!degrees?.length) throw new RangeError(`tune-snap: unknown scale "${scale}"`)
  let lo = Infinity, hi = -Infinity
  for (let v of midi) if (v === v) { if (v < lo) lo = v; if (v > hi) hi = v }
  if (!(hi >= lo) || !(strength > 0)) return move
  // the scale's notes over the voice's range and a whole tone past it, and the one each frame means
  let notes = [], r = ((Math.round(root) % 12) + 12) % 12
  for (let n = Math.floor(lo) - 2; n <= Math.ceil(hi) + 2; n++) if (degrees.includes((n - r + 12) % 12)) notes.push(n)
  let meant = decode(midi, notes)

  // the notes sung: runs of one meant note over voiced frames, held across an unvoiced flicker
  let segs = [], bridge = Math.round(BRIDGE / HOP)
  for (let i = 0; i < T; i++) {
    if (midi[i] !== midi[i]) continue
    let g = segs[segs.length - 1], note = notes[meant[i]]
    if (g && g.note === note && i - g.b <= bridge) g.b = i + 1
    else segs.push({ a: i, b: i + 1, note })
  }

  // each note's centre, the median of its middle half (past the glides into and out of it), and its shift onto the note
  // it means; its pitch about that centre, straight across a flicker, and the part of it slower than `speed`, which is
  // taken away. A note whose centre and slow part stay within `tolerance` of its note is left as sung
  let tau = speed / 1000 / HOP, dev = new Float64Array(T), slow = new Float64Array(T), shift = new Float64Array(T)
  for (let g of segs) {
    let q = (g.b - g.a) >> 2, c = median(midi, g.a + q, g.b - q) ?? median(midi, g.a, g.b), off = 0
    for (let i = g.a, last = -1; i < g.b; i++) {
      if (midi[i] !== midi[i]) continue
      dev[i] = midi[i] - c
      for (let j = last + 1; last >= 0 && j < i; j++) dev[j] = dev[last] + (dev[i] - dev[last]) * (j - last) / (i - last)
      last = i
    }
    smooth(dev, g.a, g.b, tau, slow)
    for (let i = g.a; i < g.b; i++) off = Math.max(off, Math.abs(c + slow[i] - g.note))
    g.shift = off * 100 < tolerance ? (slow.fill(0, g.a, g.b), 0) : g.note - c
    shift.fill(g.shift, g.a, g.b)
  }
  // one note's shift crosses to the next's over a raised cosine, `speed` long where the gap between them is shorter
  // (a legato step), never past a quarter of either note
  for (let k = 0; k + 1 < segs.length; k++) {
    let g = segs[k], h = segs[k + 1], e = Math.max(0, Math.min(tau - (h.a - g.b) / 2, (g.b - g.a) / 4, (h.b - h.a) / 4))
    if (!e || g.shift === h.shift) continue
    let a = g.b - e, b = h.a + e
    for (let i = Math.ceil(a); i < b; i++) if (i < g.b || i >= h.a) shift[i] = g.shift + (h.shift - g.shift) * rise((i + .5 - a) / (b - a))
  }
  // within notes, the shift less the slow part; between them straight from one's last to the next's first, held past
  // the first and the last
  let on = new Uint8Array(T)
  for (let g of segs) for (let i = g.a; i < g.b; i++) { move[i] = strength * (shift[i] - slow[i]); on[i] = 1 }
  for (let i = 0, last = -1; i <= T; i++) {
    if (i < T && !on[i]) continue
    let from = last < 0 ? move[i] : move[last], to = i < T ? move[i] : from
    for (let j = last + 1; j < i; j++) move[j] = from + (to - from) * (j - last) / (i - last)
    last = i
  }
  return move
}

/**
 * Tune a voice to a scale: a corrected copy of `data` (one channel, or channels retuned on one set of cycles).
 * opts: { fs=44100, scale='chromatic', root=0, a4=440, strength=1, speed=80 (ms), tolerance=8 (cents),
 *   minFreq=60, maxFreq=1000 }
 */
export default function snap(data, opts = {}) {
  let { a4 = 440, minFreq = 60, maxFreq = 1000 } = opts, fs = opts.fs || opts.sampleRate || 44100
  let multi = Array.isArray(data), ch = multi ? data : [data]
  let copy = () => multi ? ch.map(c => Float32Array.from(c)) : Float32Array.from(data)
  if (!ch[0]?.length) return copy()
  let { times, midi } = pitchOf(ch, { fs, a4, minFreq, maxFreq })
  let move = correction(midi, opts)
  if (!move.some(v => v)) return copy()
  let f0 = { t: times, v: Array.from(midi, m => m === m ? a4 * 2 ** ((m - 69) / 12) : 0) }
  let out = tuneCurve(ch, { semitones: { t: times, v: move }, f0, fs, minFreq, maxFreq })
  return multi ? out : out[0]
}
