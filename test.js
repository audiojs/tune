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
