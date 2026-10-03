// Retune a voice along a pitch curve: its own glottal cycles, re-spaced (TD-PSOLA, Moulines & Charpentier, Speech
// Communication 9, 1990). A cycle at a time is cut around its mark by a two-lobed window and laid at the spacing the
// curve asks for. The pulse shape, the vocal tract's ringing on it, the breath and the jitter stay the voice's own, so
// the formants stay where they were. Unvoiced audio (consonants, breath, silence) passes as it is.
//
// The cycles are found as the audio streams: f0 by YIN (de Cheveigné & Kawahara, JASA 111, 2002) on the channels' mean
// at about 11 kHz (samples averaged in fours), every 5 ms, a frame voiced where it and a neighbour pass: where YIN's
// normalized difference dips under .35. YIN's own .15 holds a voice that does not glide within its 46 ms frame, and
// running speech glides: of a lecture's voiced frames (pYIN's), 25 to 29% landed within 50 cents of a 4-semitone
// shift up or down; at .35, 63 to 66%. The looser dip sometimes takes a harmonic's period for the voice's: a sung take
// (audio-lena) went from 75% to 68%. Synthetic voices shift as before. Then a mark per cycle, the first at the loudest sample of a voiced run's first period and each next a period on, moved to where a
// period of waveform matches the one before best (normalized correlation, refined between samples), as the prosody
// editor's cycles.js steps them.
// Against a synthetic voice re-synthesized at the target pitch (same Rosenberg pulse, same formants), the re-spaced
// cycles kept its harmonics within 2.6 dB (median over ±12 semitones), a phase vocoder within 10.6 dB, its formants
// moving with the pitch; on a sung recording they kept the long-term spectrum within 1.6 to 2.7 dB, the vocoder 7.5 to
// 12.4.
//
// tuneCurve(data, { semitones | ratio, fs }) → retuned copy; tuneCurve(opts) → write(chunk) → the retuned stream
// `write.latency` samples behind its input, write() → the rest. `semitones` (or `ratio`): a number, a function of
// seconds from the stream's start, or a curve { t, v } (seconds → semitones, straight between points, flat past its
// ends). Where the ratio is 1 and the cycles are laid where they were, the output is the input to float precision.

import yin from '@audio/pitch-yin'

const isCurve = c => c != null && typeof c === 'object' && c.t?.length > 0 && c.v?.length === c.t.length

// a curve at x seconds, searched from the point found last (asked in order)
const curveAt = ({ t, v }) => {
  let i = 1, n = t.length
  return x => {
    if (x <= t[0]) return v[0]
    if (x >= t[n - 1]) return v[n - 1]
    while (t[i] < x) i++
    while (i > 1 && t[i - 1] >= x) i--
    return v[i - 1] + (v[i] - v[i - 1]) * ((x - t[i - 1]) / (t[i] - t[i - 1]))
  }
}

/** The ratio at x seconds from the stream's start, from `ratio` or `semitones`. */
export function ratioOf(o) {
  let r = o?.ratio, s = o?.semitones
  if (r != null) {
    let f = typeof r === 'function' ? r : isCurve(r) ? curveAt(r) : () => +r
    return x => { let v = f(x); return v > 0 && Number.isFinite(v) ? v : 1 }
  }
  let f = typeof s === 'function' ? s : isCurve(s) ? curveAt(s) : () => +(s || 0), last = NaN, lr = 1
  return x => { let v = +f(x) || 0; return v === last ? lr : (last = v, lr = 2 ** (v / 12)) }
}

// A Kaiser-windowed sinc (β 8, 8 zero crossings a side; Kaiser 1974) reads a cycle at a fractional place; whole places
// read exactly, so cycles laid where they were give the input back.
const ZC = 8, RES = 512
// a frame is voiced where YIN's normalized difference dips under this (above)
const VOICED = .35
const I0 = x => { let s = 1, t = 1; for (let k = 1; k < 25; k++) { t *= (x / 2 / k) ** 2; s += t } return s }
const KERNEL = Float64Array.from({ length: ZC * RES + 2 }, (_, i) => { let x = i / RES; return x >= ZC ? 0 : (x ? Math.sin(Math.PI * x) / (Math.PI * x) : 1) * I0(8 * Math.sqrt(1 - (x / ZC) ** 2)) / I0(8) })

const ncc = (x, a, b, n) => { let xy = 0, xx = 0, yy = 0; for (let i = 0; i < n; i++) { let p = x[a + i], q = x[b + i]; xy += p * q; xx += p * p; yy += q * q } return xy / Math.sqrt(xx * yy || 1) }

/** Samples the retuner runs behind its input, for voices down to minFreq and ratios down to rmin: half a YIN window
 *  and two frames ahead for the track, a period and a half for the next mark, a cycle's window past its mark, and the
 *  widest lobe a cycle still to come reaches back by. */
export const latencyOf = ({ fs = 44100, sampleRate, minFreq = 60, rmin = .25 } = {}) => {
  fs = sampleRate || fs
  let dec = Math.max(1, Math.floor(fs / 11025)), Wd = 2 ** Math.ceil(Math.log2(2 * fs / dec / minFreq)), hop = Math.max(dec, Math.round(.005 * fs / dec) * dec)
  return Wd / 2 * dec + 2 * hop + Math.ceil(fs / minFreq * (3 + 1 / Math.min(1, rmin))) + 2 * ZC + 2
}

/** The streaming retuner over `nch` channels: write(channels) → the timeline samples now final; end() → the rest. */
export function retuner(nch, o = {}) {
  let fs = o.sampleRate || o.fs || 44100, ratio = ratioOf(o)
  let minFreq = o.minFreq || 60, maxFreq = o.maxFreq || 1000, Pmax = Math.ceil(fs / minFreq), Pmin = Math.max(2, Math.floor(fs / maxFreq))
  let dec = Math.max(1, Math.floor(fs / 11025)), fsd = fs / dec, Wd = 2 ** Math.ceil(Math.log2(2 * fsd / minFreq))
  let hop = Math.max(dec, Math.round(.005 * fs / dec) * dec), V = hop, latency = latencyOf({ fs, minFreq, rmin: o.rmin })
  // the input, its channels' mean, and that mean averaged in fours, all from timeline sample `base`
  let x = Array.from({ length: nch }, () => new Float32Array(1 << 15)), m = new Float32Array(1 << 15), d = new Float32Array((1 << 15) / dec + 2)
  let base = 0, n = 0
  // f0 frames at k·hop from `tbase`: raw, and decided (a period in samples, 0 unvoiced) one frame later
  let raw = [], track = [], tbase = 0
  // marks, from `mbase`; where the next is looked for; whether a voiced run is on
  let marks = [], mbase = 0, cursor = 0, run = false
  // the next cycle's place `s` and the mark `j` it is laid from; sums of the laid cycles and their windows from `obase`
  let s = 0, j = 0, started = false, out = Array.from({ length: nch }, () => new Float64Array(1 << 15)), wsum = new Float64Array(1 << 15), obase = 0, emitted = 0
  let late = 0  // cycle samples that would have landed on emitted output: a latency too short (stays 0)

  const grow = need => {
    if (need <= m.length) return
    let len = Math.max(need, 2 * m.length), have = n - base
    x = x.map(a => { let b = new Float32Array(len); b.set(a.subarray(0, have)); return b })
    let mb = new Float32Array(len); mb.set(m.subarray(0, have)); m = mb
    let db = new Float32Array(Math.ceil(len / dec) + 2); db.set(d.subarray(0, Math.ceil(have / dec))); d = db
  }
  const growOut = need => {
    if (need <= wsum.length) return
    let len = Math.max(need, 2 * wsum.length)
    out = out.map(a => { let b = new Float64Array(len); b.set(a); return b })
    let wb = new Float64Array(len); wb.set(wsum); wsum = wb
  }
  const at = (c, p) => {
    let fl = Math.floor(p)
    if (p === fl) { let i = fl - base; return i >= 0 && i < n - base ? x[c][i] : 0 }
    let sum = 0, acc = 0
    for (let k = fl - ZC + 1; k <= fl + ZC; k++) {
      let q = Math.abs(p - k) * RES, i = q | 0, w = KERNEL[i] + (KERNEL[i + 1] - KERNEL[i]) * (q - i), idx = k - base
      sum += w
      if (idx >= 0 && idx < n - base) acc += w * x[c][idx]
    }
    return acc / sum
  }
  const known = () => (tbase + track.length) * hop - hop / 2   // the track decides voicing up to here
  const period = p => { let k = Math.round(p / hop) - tbase; return k >= 0 && k < track.length ? track[k] : 0 }

  function analyse() {
    for (;;) {
      let k = tbase + raw.length, c = k * hop
      if (c + Wd / 2 * dec > n) return
      let lo = c / dec - Wd / 2 - base / dec, f = 0
      if (lo >= 0) {
        let fr = d.subarray(lo, lo + Wd), e = 0
        for (let i = 0; i < Wd; i++) e += fr[i] * fr[i]
        if (e / Wd > 1e-7) { let r = yin(fr, { fs: fsd, minFreq, maxFreq: Math.min(maxFreq, fsd / 4), threshold: VOICED }); if (r) f = fs / r.freq }
      }
      raw.push(f)
      // the frame before, decided: voiced where it and a neighbour are, its period the median of those voiced
      let i = raw.length - 2
      if (i < 0) continue
      let a = i > 0 ? raw[i - 1] : 0, b = raw[i], cc = raw[i + 1], v = b && (a || cc) ? [a, b, cc].filter(Boolean).sort((p, q) => p - q) : []
      track.push(v.length ? v[v.length >> 1] : 0)
    }
  }

  function place() {
    for (;;) {
      let edge = known()
      if (cursor >= edge) return
      let P = period(cursor), prev = marks[marks.length - 1]
      if (!P) {
        // unvoiced: a mark on the 5 ms grid; cycles laid where they are
        let pos = Math.max(Math.ceil(cursor / V) * V, prev ? Math.floor(prev.pos) + 1 : 0)
        if (pos >= edge) return
        if (period(pos)) { cursor = pos; continue }
        marks.push({ pos, voiced: false }); run = false; cursor = pos + 1
        continue
      }
      let pos
      if (!run) {
        // a voiced run starts at the loudest sample of its first period
        let a = Math.max(Math.ceil(cursor), prev ? Math.floor(prev.pos) + 1 : 0), b = a + Math.round(P)
        if (b + 2 > n) return
        pos = a
        for (let i = a, bv = -1; i < b; i++) { let v = Math.abs(m[i - base]); if (v > bv) { bv = v; pos = i } }
      } else {
        let next = prev.pos + P
        if (next >= edge) return
        if (!period(next)) { run = false; cursor = next; continue }
        let h = Math.round(P / 2), lo = Math.round(next - .3 * P), hi = Math.round(next + .3 * P), b0 = Math.round(prev.pos)
        if (hi + h + 2 > n) return
        let best = Math.round(next), score = -Infinity, sc = new Map()
        for (let c = lo; c <= hi; c++) { let v = ncc(m, b0 - h - base, c - h - base, 2 * h); sc.set(c, v); if (v > score) { score = v; best = c } }
        pos = next
        // an aperiodic cycle keeps the predicted spacing rather than a random peak
        if (score >= .3) {
          let lag = best - b0
          if (best > lo && best < hi) { let y0 = sc.get(best - 1), y2 = sc.get(best + 1), dd = y0 - 2 * score + y2; if (dd < 0) lag += (y0 - y2) / (2 * dd) }
          pos = prev.pos + lag
        }
        if (pos - prev.pos < Pmin) pos = prev.pos + P
      }
      marks.push({ pos, voiced: true }); run = true; cursor = pos
    }
  }

  function synth() {
    for (;;) {
      let k = j - mbase
      if (k + 1 >= marks.length) return
      if (!started) { s = marks[k].pos; started = true }
      // the mark nearest the place: the cycle laid there
      while (k + 1 < marks.length && Math.abs(marks[k + 1].pos - s) <= Math.abs(marks[k].pos - s)) { j++; k++ }
      if (k + 1 >= marks.length) return
      let mk = marks[k], nx = marks[k + 1], pv = k > 0 ? marks[k - 1] : null
      if (!mk.voiced) s = mk.pos
      // the next cycle a period of the source on, at the ratio half way to it: the period of the cycle the place is in
      // (before the mark, the one ending there), so a glide or a vibrato is followed cycle by cycle
      let R = nx.pos - mk.pos, L = pv ? mk.pos - pv.pos : R, P = s < mk.pos ? L : R, r = 1, T = R
      if (mk.voiced) { r = ratio(s / fs); T = P / r; r = ratio((s + T / 2) / fs); T = P / r; r = ratio((s + T / 2) / fs); T = P / r }
      // lobes of a source cycle each side. A lowered pitch lays the cycles further apart than they are long, and leaves
      // the gap: lobes widened to the new spacing took in the cycles either side, and laid an octave down, two periods
      // apart, gave the input's own period back (at 120 Hz, -12 and -9 semitones came out at 120 Hz)
      let lw = L, rw = R
      if (mk.pos + rw + ZC + 2 > n) return
      let i0 = Math.ceil(s - lw), i1 = Math.floor(s + rw)
      if (Math.max(i0, 0) < emitted) late += emitted - Math.max(i0, 0)
      growOut(i1 - obase + 2)
      for (let i = Math.max(i0, emitted); i <= i1; i++) {
        let u = i - s, w = u < 0 ? .5 + .5 * Math.cos(Math.PI * u / lw) : .5 + .5 * Math.cos(Math.PI * u / rw)
        if (!(w > 0)) continue
        let p = mk.pos + u, oi = i - obase
        for (let c = 0; c < nch; c++) out[c][oi] += w * at(c, p)
        wsum[oi] += w
      }
      // the next cycle a period on at the curve's ratio; back on the marks once the ratio is 1 and they are met, or the
      // voice stops (unvoiced marks are laid where they are)
      s = !mk.voiced || (r === 1 && Math.abs(s - mk.pos) < 1e-6) ? nx.pos : s + T
    }
  }

  function emit(upto) {
    let len = Math.max(0, upto - emitted), res = Array.from({ length: nch }, () => new Float32Array(len))
    if (!len) return res
    growOut(upto - obase + 1)
    for (let i = 0; i < len; i++) {
      let oi = emitted + i - obase, w = wsum[oi]
      // the cycles' sum over their windows' where they overlap; a gap is not raised to full level, which would fill it
      for (let c = 0; c < nch; c++) res[c][i] = w > 1 - 1e-9 ? out[c][oi] / w : out[c][oi]
    }
    emitted = upto
    let drop = emitted - obase
    if (drop > (wsum.length >> 1)) {
      for (let c = 0; c < nch; c++) { out[c].copyWithin(0, drop); out[c].fill(0, out[c].length - drop) }
      wsum.copyWithin(0, drop); wsum.fill(0, wsum.length - drop); obase += drop
    }
    // what nothing reads any more goes: input, track and marks well behind the next cycle
    let keep = Math.min(emitted, s) - 4 * Pmax - Wd * dec - 4 * hop
    let gone = 0
    while (gone + 2 < j - mbase && marks[gone + 1].pos < keep) gone++
    if (gone) { marks.splice(0, gone); mbase += gone }
    let frames = Math.floor(keep / hop) - tbase - 2
    if (frames > 64 && frames < track.length) { track.splice(0, frames); raw.splice(0, frames); tbase += frames }
    let cut = Math.floor(Math.max(0, keep - base) / dec) * dec
    if (cut > (m.length >> 1)) {
      for (let c = 0; c < nch; c++) x[c].copyWithin(0, cut, n - base)
      m.copyWithin(0, cut, n - base); d.copyWithin(0, cut / dec, Math.ceil((n - base) / dec) + 1); base += cut
    }
    return res
  }

  function feed(chunk) {
    let len = chunk[0].length, have = n - base
    grow(have + len + 1)
    for (let c = 0; c < nch; c++) x[c].set(chunk[c], have)
    for (let i = 0; i < len; i++) { let v = 0; for (let c = 0; c < nch; c++) v += chunk[c][i]; m[have + i] = v / nch }
    let d0 = Math.floor(have / dec), d1 = Math.floor((have + len) / dec)
    for (let k = d0; k < d1; k++) { let v = 0; for (let i = 0; i < dec; i++) v += m[k * dec + i]; d[k] = v / dec }
    n += len
    analyse(); place(); synth()
  }
  let end = Infinity
  return {
    latency,
    get late() { return late },
    write(chunk) { feed(chunk); return emit(Math.min(end, Math.max(emitted, n - latency))) },
    // silence past the end lets the last frames, marks and cycles complete
    end() { end = n; feed(Array.from({ length: nch }, () => new Float32Array(latency + Wd * dec))); return emit(end) }
  }
}

/** tuneCurve(data, opts) → retuned copy (a Float32Array, or channels: one set of cycles for all);
 *  tuneCurve(opts) → write(chunk) → the retuned stream, `write.latency` samples behind; write() → the rest. */
export default function tuneCurve(data, opts) {
  let multi = Array.isArray(data) && data[0] instanceof Float32Array
  if (data instanceof Float32Array || multi) {
    let ch = multi ? data : [data], r = retuner(ch.length, opts), len = ch[0].length, res = ch.map(() => new Float32Array(len)), p = 0
    let put = part => { for (let c = 0; c < ch.length; c++) res[c].set(part[c], p); p += part[0].length }
    for (let i = 0; i < len; i += 8192) put(r.write(ch.map(c => c.subarray(i, Math.min(len, i + 8192)))))
    put(r.end())
    return multi ? res : res[0]
  }
  let o = data || {}, r = null, mono = false
  let write = chunk => {
    if (chunk === undefined) { if (!r) return mono ? new Float32Array(0) : []; let res = r.end(); return mono ? res[0] : res }
    mono = chunk instanceof Float32Array
    r ??= retuner(mono ? 1 : chunk.length, o)
    let res = r.write(mono ? [chunk] : chunk)
    return mono ? res[0] : res
  }
  write.latency = latencyOf(o)
  return write
}
