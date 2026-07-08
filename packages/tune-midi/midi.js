// MIDI-guided pitch correction — retune audio to a note guide (parsed SMF via
// @audio/midi-parse, or a plain [{time, duration, midi}] list): YIN F0 track →
// per-guide-note median → PSOLA shift to the guide pitch, crossfaded over dry.
// The melody-following complement of tune-snap's scale snapping.

import yin from '@audio/pitch-yin'
import psola from '@audio/shift-psola'

const midiToHz = (m, a4 = 440) => a4 * 2 ** ((m - 69) / 12)

/**
 * @param {Float32Array} data — mono PCM
 * @param {object} opts — {
 *   guide: Array<{time, duration, midi}> | { notes } (midi-parse output) — required,
 *   fs=44100, a4=440, strength=1, tolerance=8 (¢), maxShift=700 (¢ — skip wild targets),
 *   frameSize=2048, hop=512, fade=0.01
 * }
 * @returns {Float32Array} corrected copy
 */
export default function tuneMidi (data, { guide, fs = 44100, a4 = 440, strength = 1, tolerance = 8, maxShift = 700, frameSize = 2048, hop = 512, fade = 0.01 } = {}) {
	let notes = Array.isArray(guide) ? guide : guide?.notes
	if (!notes?.length) throw new RangeError('tune-midi: opts.guide (note list or midi-parse output) is required')

	// frame-wise F0
	let nFrames = Math.max(0, Math.floor((data.length - frameSize) / hop) + 1)
	let f0 = new Float32Array(nFrames)
	for (let i = 0; i < nFrames; i++) {
		let r = yin(data.subarray(i * hop, i * hop + frameSize), { fs })
		if (r) f0[i] = r.freq
	}

	let out = Float32Array.from(data)
	let fadeN = Math.max(1, Math.round(fade * fs))
	for (let note of notes) {
		let from = Math.max(0, Math.round(note.time * fs))
		let to = Math.min(data.length, Math.round((note.time + note.duration) * fs))
		if (to - from < frameSize) continue
		// measured pitch across the note span (median of voiced frames)
		let fa = Math.ceil(from / hop), fb = Math.min(nFrames, Math.floor((to - frameSize) / hop) + 1)
		let voiced = []
		for (let i = fa; i < fb; i++) if (f0[i] > 0) voiced.push(f0[i])
		if (voiced.length < 2) continue
		voiced.sort((a, b) => a - b)
		let measured = voiced[voiced.length >> 1]
		let target = midiToHz(note.midi, a4)
		let cents = 1200 * Math.log2(target / measured)
		if (Math.abs(cents) < tolerance || Math.abs(cents) > maxShift) continue
		let ratio = 2 ** (cents * strength / 1200)

		let shifted = psola(data.slice(from, to), { ratio, sampleRate: fs })
		let n = Math.min(shifted.length, to - from)
		for (let i = 0; i < n; i++) {
			let g = Math.min(1, i / fadeN, (n - 1 - i) / fadeN)
			out[from + i] = out[from + i] * (1 - g) + shifted[i] * g
		}
	}
	return out
}
