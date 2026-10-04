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

// The pitch of `d` in cents re A4 every 5 ms over [a, b) s, YIN on 2048 samples (NaN where it finds none)
const cents = (d, a, b) => {
	let c = []
	for (let t = a; t < b; t += .005) { let i = Math.round(t * fs) - 1024, r = i >= 0 && yin(d.subarray(i, i + 2048), { fs, minFreq: 60, maxFreq: 1000 }); c.push(r ? 1200 * Math.log2(r.freq / 440) : NaN) }
	return c
}
const median = a => { let s = a.filter(v => v === v).sort((p, q) => p - q); return s[s.length >> 1] }
const spread = a => { let v = a.filter(x => x === x), m = v.reduce((s, x) => s + x, 0) / v.length; return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length) }

// A3 sung 30 cents sharp with a ±40-cent vibrato at 5.5 Hz: the centre lands on A3; at the default speed the vibrato
// stays, at speed 0 every moment is set on the note
test('snap — a sung note lands on its note, its vibrato kept; speed 0 flattens it', () => {
	let f0 = t => 220 * 2 ** ((.3 + .4 * Math.sin(2 * Math.PI * 5.5 * t)) / 12), d = voice(f0, Math.round(1.6 * fs))
	let dry = cents(d, .3, 1.3), wet = cents(snap(d, { fs }), .3, 1.3), hard = cents(snap(d, { fs, speed: 0 }), .3, 1.3)
	almost(median(wet), -1200, 5, `centre ${(median(dry) + 1200).toFixed(0)} → ${(median(wet) + 1200).toFixed(1)} cents re A3`)
	ok(spread(wet) / spread(dry) > .85, `vibrato kept: ${spread(dry).toFixed(1)} → ${spread(wet).toFixed(1)} cents rms`)
	ok(spread(hard) < 6 && Math.abs(median(hard) + 1200) < 3, `speed 0: ${spread(hard).toFixed(1)} cents rms about ${(median(hard) + 1200).toFixed(1)}`)
})

// A3 30 cents sharp, then an 80-ms glide up to C#4 40 cents flat: each lands, and the pitch and the level move from one
// to the next as they were sung. Cut out, shifted apart and crossfaded back over the dry voice (tune-snap 1), the
// glide fell 3.2 dB where the two pitches met and YIN found no period in it
test('snap — a legato step: both notes land, the glide between them unbroken', () => {
	let p = t => t < .7 ? .3 : t > .78 ? 3.6 : .3 + 3.3 * (.5 - .5 * Math.cos(Math.PI * (t - .7) / .08))
	let d = voice(t => 220 * 2 ** (p(t) / 12), Math.round(1.5 * fs)), out = snap(d, { fs })
	let a = cents(out, .25, .6), b = cents(out, .9, 1.3), c = cents(out, .55, .95), dc = cents(d, .55, .95)
	almost(median(a), -1200, 5, `first note: ${(median(a) + 1200).toFixed(1)} cents re A3`)
	almost(median(b), -800, 5, `second note: ${(median(b) + 800).toFixed(1)} cents re C#4`)
	let jump = x => Math.max(...x.slice(1).map((v, i) => Math.abs(v - x[i])).filter(v => v === v))
	ok(jump(c) < jump(dc) + 15, `the largest step in 5 ms: ${jump(dc).toFixed(0)} cents sung, ${jump(c).toFixed(0)} tuned`)
	let level = (x, i) => { let s = 0; for (let k = i; k < i + 441; k++) s += x[k] * x[k]; return 10 * Math.log10(s) }, dip = 0
	for (let i = Math.round(.5 * fs); i < fs; i += 110) dip = Math.min(dip, level(out, i) - level(d, i))
	ok(dip > -2, `the level within ${(-dip).toFixed(1)} dB of the voice's through the step (10 ms)`)
})

test('snap — channels on one pitch and one set of cycles', () => {
	let d = voice(t => 150 * 2 ** (.35 * Math.sin(2 * Math.PI * 1.3 * t) / 12), fs), [l, r] = snap([d, d.map(x => .5 * x)], { fs, speed: 0 })
	ok(l.some((x, i) => x !== d[i]) && l.every((x, i) => Math.abs(.5 * x - r[i]) < 1e-6), 'retuned, the level of each kept')
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

// A pitch track given finds the cycles on it: where it says unvoiced, nothing moves; where it says the voice's pitch,
// the shift lands as on the retuner's own
test('tune-curve: cycles found on a pitch track given (f0)', () => {
	let n = Math.round(1.2 * fs), d = voice(140, n)
	let none = tuneCurve(d, { semitones: 3, fs, f0: { t: [0, 1.2], v: [0, 0] } })
	ok(none.every((x, i) => x === d[i]), 'a track all unvoiced: the input as it is')
	let out = tuneCurve(d, { semitones: 3, fs, f0: t => 140 }), f = 140 * 2 ** (3 / 12)
	let r = yin(out.subarray(fs >> 1, (fs >> 1) + 4096), { fs, minFreq: 60, maxFreq: 1000 }), c = 1200 * Math.log2(r.freq / f)
	ok(Math.abs(c) < 2, `on the voice's pitch, +3: ${r.freq.toFixed(2)} Hz, ${c.toFixed(2)} cents`)
})
