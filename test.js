import test, { almost, ok, is } from 'tst'
import { snap } from './index.js'
import yin from '@audio/pitch-yin'

const fs = 44100

function sine (freq, n, sr = fs) {
	let d = new Float32Array(n)
	for (let i = 0; i < n; i++) d[i] = 0.6 * Math.sin(2 * Math.PI * freq * i / sr)
	return d
}
function measure (d, from, to) {
	let r = yin(d.subarray(from, from + 4096), { fs })
	return r ? r.freq : 0
}

test('snap — 47¢-sharp A4 pulls to 440 in A major', () => {
	let d = sine(452, fs)
	let out = snap(d, { fs, scale: 'major', root: 9 })
	let f = measure(out, fs / 2)
	almost(f, 440, 3, 'corrected to ' + f.toFixed(1) + ' Hz')
	ok(out.every(isFinite))
})

test('snap — in-tune note left untouched', () => {
	let d = sine(440, fs)
	let out = snap(d, { fs, scale: 'major', root: 9 })
	let diff = 0
	for (let i = 0; i < d.length; i++) diff = Math.max(diff, Math.abs(out[i] - d[i]))
	ok(diff < 1e-6, 'bit-identical (within tolerance gate)')
})

test('snap — two-note melody corrects each note independently', () => {
	let a = sine(300, fs), b = sine(452, fs) // 300 → D4 293.66 (chromatic), 452 → A4 440
	let d = new Float32Array(a.length + b.length)
	d.set(a, 0); d.set(b, a.length)
	let out = snap(d, { fs, scale: 'chromatic' })
	almost(measure(out, Math.round(fs * 0.4)), 293.66, 4, 'first note → D4')
	almost(measure(out, a.length + Math.round(fs * 0.4)), 440, 4, 'second note → A4')
})

test('snap — silence passes through', () => {
	let d = new Float32Array(fs / 2)
	let out = snap(d, { fs })
	ok(out.every(v => v === 0))
})

import tuneMidi from '@audio/tune-midi'

test('tune-midi — off-pitch note pulled to the guide note', () => {
	let fs = 44100, n = fs
	// sing a slightly flat A (427 Hz ≈ −52¢ from 440), guide says A4
	let d = new Float32Array(n)
	for (let i = 0; i < n; i++) d[i] = 0.6 * Math.sin(2 * Math.PI * 427 * i / fs)
	let out = tuneMidi(d, { guide: [{ time: 0, duration: 1, midi: 69 }], fs })
	// measure corrected pitch in the middle via zero crossings
	let from = fs >> 2, to = n - (fs >> 2), c = 0
	for (let i = from + 1; i < to; i++) if ((out[i - 1] < 0) !== (out[i] < 0)) c++
	let freq = c / 2 * fs / (to - from)
	almost(freq, 440, 4, `corrected to ${freq.toFixed(1)} Hz`)
	ok(out.every(isFinite))
})

test('tune-midi — in-tune note untouched, guide required', () => {
	let fs = 44100, n = fs >> 1
	let d = new Float32Array(n)
	for (let i = 0; i < n; i++) d[i] = 0.6 * Math.sin(2 * Math.PI * 440 * i / fs)
	let out = tuneMidi(d, { guide: [{ time: 0, duration: 0.5, midi: 69 }], fs })
	let diff = 0
	for (let i = 0; i < n; i++) diff = Math.max(diff, Math.abs(out[i] - d[i]))
	ok(diff < 1e-9, 'within tolerance → bypass')
	let threw = false
	try { tuneMidi(d, { fs }) } catch { threw = true }
	ok(threw)
})

import tuneCurve, { retuner } from '@audio/tune-curve'

// A voice: Rosenberg (1971) glottal pulses at f0 (Hz, or t => Hz), differentiated (lip radiation), through Klatt (1980)
// resonators at Peterson & Barney's (1952) male /a/ formants, 730, 1090, 2440 Hz (and 3400): the same tract at any pitch,
// so the voice made at the target pitch is what a retune that keeps formants should give
function voice (f0, n, sr = fs) {
	let rs = [[730, 90], [1090, 110], [2440, 170], [3400, 250]].map(([F, B]) => {
		let C = -Math.exp(-2 * Math.PI * B / sr), Bc = 2 * Math.exp(-Math.PI * B / sr) * Math.cos(2 * Math.PI * F / sr), A = 1 - Bc - C, y1 = 0, y2 = 0
		return x => { let y = A * x + Bc * y1 + C * y2; y2 = y1; y1 = y; return y }
	})
	let d = new Float32Array(n), ph = 0, prev = 0, peak = 0
	for (let i = 0; i < n; i++) {
		ph += (typeof f0 === 'function' ? f0(i / sr) : f0) / sr
		if (ph >= 1) ph -= 1
		let g = ph < .4 ? .5 * (1 - Math.cos(Math.PI * ph / .4)) : ph < .56 ? Math.cos(Math.PI * (ph - .4) / .32) : 0, y = g - prev
		prev = g
		for (let r of rs) y = r(y)
		d[i] = y
	}
	for (let v of d) peak = Math.max(peak, Math.abs(v))
	return d.map(v => .3 * v / peak)
}
// amplitude of harmonic h·f over [a, b), Hann-windowed DFT
const harmonic = (d, f, a, b) => { let w = 2 * Math.PI * f / fs, re = 0, im = 0; for (let i = a; i < b; i++) { let h = .5 - .5 * Math.cos(2 * Math.PI * (i - a) / (b - a)); re += d[i] * h * Math.cos(w * i); im -= d[i] * h * Math.sin(w * i) } return Math.hypot(re, im) }

test('tune-curve: no shift: the input, sample for sample; unvoiced audio passes as it is', () => {
	let d = voice(130, fs)
	let out = tuneCurve(d, { semitones: 0, fs })
	ok(out.length === d.length && out.every((v, i) => v === d[i]), 'a voice at 0 semitones')
	let noise = new Float32Array(fs >> 1), r = 7
	for (let i = 0; i < noise.length; i++) { r = (r * 1664525 + 1013904223) >>> 0; noise[i] = .2 * (r / 2 ** 32 - .5) }
	let n = tuneCurve(noise, { semitones: 5, fs })
	ok(n.every((v, i) => v === noise[i]), 'noise at +5 semitones: no cycles to re-space')
})

test('tune-curve: a shift lands on the pitch and keeps the formants (vs the voice made at that pitch)', () => {
	let n = Math.round(1.2 * fs), a = Math.round(.4 * fs), b = Math.round(.9 * fs)
	for (let [f0, st] of [[120, 4], [120, -4], [220, 7]]) {
		let f = f0 * 2 ** (st / 12), out = tuneCurve(voice(f0, n), { semitones: st, fs }), truth = voice(f, n)
		let r = yin(out.subarray(fs >> 1, (fs >> 1) + 4096), { fs, minFreq: 60, maxFreq: 1000 }), cents = 1200 * Math.log2(r.freq / f)
		ok(Math.abs(cents) < 2, `${f0} Hz ${st > 0 ? '+' : ''}${st}: ${r.freq.toFixed(2)} Hz, ${cents.toFixed(2)} cents`)
		// harmonics within 30 dB of the truth's strongest, below 4 kHz: their levels re the truth's, the mean taken out
		let d = [], tv = []
		for (let h = 1; h * f < 4000; h++) { let x = harmonic(out, h * f, a, b), t = harmonic(truth, h * f, a, b); d.push(20 * Math.log10(x / t)); tv.push(20 * Math.log10(t)) }
		let top = Math.max(...tv), keep = d.filter((_, i) => tv[i] > top - 30), mean = keep.reduce((s, v) => s + v) / keep.length
		let rmsDb = Math.sqrt(keep.reduce((s, v) => s + (v - mean) ** 2, 0) / keep.length)
		ok(rmsDb < 6, `harmonics within ${rmsDb.toFixed(1)} dB of the voice made at ${f.toFixed(0)} Hz (a vocoder: 10.9 median)`)
	}
})

test('tune-curve: a curve: the pitch follows it; a stream equals the batch however it is chunked', () => {
	let n = 3 * fs, d = voice(140, n), curve = { t: [.4, 1.2, 1.6, 2.2], v: [0, 7, 7, -5] }
	let v = s => { let { t, v: V } = curve; if (s <= t[0]) return V[0]; for (let i = 1; i < t.length; i++) if (s <= t[i]) return V[i - 1] + (V[i] - V[i - 1]) * (s - t[i - 1]) / (t[i] - t[i - 1]); return V.at(-1) }
	let out = tuneCurve(d, { semitones: curve, fs }), cents = []
	for (let c = 1024; c + 1024 < n; c += 441) { let r = yin(out.subarray(c - 1024, c + 1024), { fs, minFreq: 60, maxFreq: 1000 }); if (r) cents.push(Math.abs(1200 * Math.log2(r.freq / (140 * 2 ** (v(c / fs) / 12))))) }
	cents.sort((p, q) => p - q)
	ok(cents[cents.length >> 1] < 6, `median ${cents[cents.length >> 1].toFixed(1)} cents off the curve`)
	let write = tuneCurve({ semitones: curve, fs }), s = new Float32Array(n), p = 0, k = 0
	for (let i = 0; i < n;) { let m = [17, 1000, 4096, 333][k++ % 4]; let o = write(d.subarray(i, i + m)); s.set(o, p); p += o.length; i += m }
	let tail = write(); s.set(tail, p); p += tail.length
	ok(p === n && s.every((x, i) => x === out[i]), `stream in odd chunks ≡ batch (${p} samples)`)
	let r = retuner(1, { semitones: curve, fs }); r.write([d]); r.end()
	is(r.late, 0, 'no cycle reaches back past what was already out')
})

// Down to an octave and past it, every semitone lands: cycles laid further apart than they are long keep the gap
// between them (widened to fill it, an octave down gave the input's own pitch back, 120 Hz at -12 and -9)
test('tune-curve: lowered an octave or less, every semitone lands on its pitch', () => {
	for (let f0 of [120, 220]) for (let st = -13; st <= -1; st++) {
		let out = tuneCurve(voice(f0, Math.round(1.2 * fs)), { semitones: st, fs }), f = f0 * 2 ** (st / 12)
		let r = yin(out.subarray(fs >> 1, (fs >> 1) + 4096), { fs, minFreq: 40, maxFreq: 1000, threshold: .2 }), cents = r ? 1200 * Math.log2(r.freq / f) : Infinity
		ok(Math.abs(cents) < 5, `${f0} Hz ${st}: ${r?.freq.toFixed(2)} Hz, ${cents.toFixed(1)} cents off`)
	}
})

// A voice gliding as speech does, ±4 semitones about 140 Hz twice a second (up to 25 semitones a second): its pitch
// moves within a frame, and YIN's own threshold (.15) took half of it for unvoiced, a third of it left at its pitch.
// Every frame moves 3 semitones, the output's pitch against the input's at it (YIN on both, the frames it reads within a
// semitone of the glide's, shifted or not: its window lags the glide, and octaves off are its own errors)
test('tune-curve: a voice gliding as speech does shifts whole, every frame by the semitones asked', () => {
	let f = s => 140 * 2 ** (4 * Math.sin(2 * Math.PI * 2 * s) / 12), n = 2 * fs, x = voice(f, n), out = tuneCurve(x, { semitones: 3, fs }), moved = []
	let at = (d, c) => yin(d.subarray(c - 1024, c + 1024), { fs, minFreq: 60, maxFreq: 1000, threshold: .35 })?.freq
	for (let c = 4410; c + 1024 < n - 4410; c += 441) {
		let a = at(x, c), b = at(out, c)
		let near = (v, st) => v && Math.abs(1200 * Math.log2(v / f(c / fs)) - 100 * st) < 100
		if (near(a, 0) && (near(b, 0) || near(b, 3))) moved.push(1200 * Math.log2(b / a))
	}
	let landed = moved.filter(c => Math.abs(c - 300) < 50).length / moved.length
	ok(moved.length > 120 && landed > .95, `${(100 * landed).toFixed(0)}% of ${moved.length} frames 3 semitones up, within 50 cents`)
})

test('tune-curve: channels retune on one set of cycles', () => {
	let d = voice(150, fs), [l, r] = tuneCurve([d, d.map(x => .5 * x)], { semitones: 3, fs })
	ok(l.every((x, i) => Math.abs(.5 * x - r[i]) < 1e-6), 'the same cycles in both, the level of each kept')
})
