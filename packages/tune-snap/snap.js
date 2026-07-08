// Pitch correction (Auto-Tune class) — YIN F0 track → note segmentation → per-segment
// scale snap → formant-moving PSOLA retune, crossfaded back over the dry signal.
// v1 corrects per note segment (no intra-note glide); unvoiced audio passes through.

import yin from '@audio/pitch-yin'
import { snapHz } from '@audio/note'
import psola from '@audio/shift-psola'

const median = arr => {
	let s = [...arr].sort((a, b) => a - b)
	return s[s.length >> 1]
}

/**
 * @param {Float32Array} data — mono PCM
 * @param {object} opts — { fs=44100, scale='chromatic', root=0, a4=440,
 *   tolerance=8 (¢, leave in-tune notes alone), strength=1 (0..1 correction amount),
 *   frameSize=2048, hop=512, fade=0.01 (s) }
 * @returns {Float32Array} corrected copy
 */
export default function snap (data, { fs = 44100, scale = 'chromatic', root = 0, a4 = 440, tolerance = 8, strength = 1, frameSize = 2048, hop = 512, fade = 0.01 } = {}) {
	// 1. frame-wise F0
	let nFrames = Math.max(0, Math.floor((data.length - frameSize) / hop) + 1)
	let f0 = new Float32Array(nFrames)
	for (let i = 0; i < nFrames; i++) {
		let r = yin(data.subarray(i * hop, i * hop + frameSize), { fs })
		if (r) f0[i] = r.freq
	}

	// 2. segment into note runs (split on >80¢ jumps from the running median)
	let segs = []
	let run = null
	let flush = () => { if (run && run.frames.length >= 2) segs.push(run); run = null }
	for (let i = 0; i < nFrames; i++) {
		if (!f0[i]) { flush(); continue }
		if (run) {
			let m = median(run.frames)
			if (Math.abs(1200 * Math.log2(f0[i] / m)) > 80) flush()
		}
		if (!run) run = { start: i, frames: [] }
		run.frames.push(f0[i])
		run.end = i
	}
	flush()

	// 3-5. per segment: snap → psola → crossfade over the dry copy
	let out = Float32Array.from(data)
	let fadeN = Math.max(1, Math.round(fade * fs))
	for (let s of segs) {
		let m = median(s.frames)
		let target = snapHz(m, { scale, root, a4 })
		let cents = 1200 * Math.log2(target / m)
		if (Math.abs(cents) < tolerance) continue
		let ratio = 2 ** (cents * strength / 1200)

		let from = s.start * hop
		let to = Math.min(data.length, s.end * hop + frameSize)
		let shifted = psola(data.slice(from, to), { ratio, sampleRate: fs })
		let n = Math.min(shifted.length, to - from)
		for (let i = 0; i < n; i++) {
			let g = Math.min(1, i / fadeN, (n - 1 - i) / fadeN)
			out[from + i] = out[from + i] * (1 - g) + shifted[i] * g
		}
	}
	return out
}
