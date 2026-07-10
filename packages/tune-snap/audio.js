// atom manifest — wraps the scale-snap pitch corrector per @audio/compile CONTRACT.
// The kernel is whole-signal by design: it tracks F0 across the take (YIN), segments
// the melody into note runs, snaps each run's median pitch to the scale, and PSOLA-
// retunes the segment crossfaded over the dry copy — segmentation needs the complete
// line, so streaming: false: the host buffers the full input and calls process once,
// exactly the batch shape the kernel expects. Channels correct independently.
// (MIDI-guided retune — @audio/tune-midi — takes a note-list argument that has no
// scalar-param form; use it via direct import, not the registry.)

import snap from './snap.js'

const SCALES = ['chromatic', 'major', 'minor', 'harmonic-minor', 'melodic-minor',
	'pentatonic-major', 'pentatonic-minor', 'blues', 'dorian', 'mixolydian', 'whole']

export const tune = (ctx) => {
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const opts = {
			fs: ctx.sampleRate,
			scale: params.scale,
			root: params.root[0] | 0,
			a4: params.a4[0],
			tolerance: params.tolerance[0],
			strength: params.strength[0],
		}
		for (let c = 0; c < inp.length; c++) out[c].set(snap(inp[c], opts))
	}
}
tune.channels = 'any'
tune.streaming = false
tune.tail = 0
tune.params = {
	scale:     { type: 'enum', values: SCALES, default: 'chromatic' },
	root:      { type: 'number', min: 0, max: 11, default: 0, step: 1 },
	a4:        { type: 'number', min: 415, max: 466, default: 440, unit: 'Hz' },
	tolerance: { type: 'number', min: 0, max: 50, default: 8, unit: 'cents' },
	strength:  { type: 'number', min: 0, max: 1, default: 1 },
}
