// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/plugin. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Transport = Readonly<{ playing: boolean, bpm: number, beat: number, barStart: number, timeSig: [number, number] }>
/** What a host hands a processor it builds: the contract's Context (CONTRACT.d.ts, 1.0) */
type Ctx = { readonly sampleRate: number, readonly maxBlockSize: number, readonly maxChannels: number, readonly layouts?: { readonly inputs: readonly (string | undefined)[], readonly outputs: readonly (string | undefined)[] }, readonly params: Live, readonly buffers: Readonly<Record<string, Float32Array[] | undefined>>, readonly events?: readonly { time: number, kind: 'on' | 'off', midi: number, velocity: number, id: number }[], emit(name: string, value: number): void, readonly transport: Transport }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'tune' */
export interface TuneOptions {
  /** default "chromatic" */
  "scale"?: "chromatic" | "major" | "minor" | "harmonic-minor" | "melodic-minor" | "pentatonic-major" | "pentatonic-minor" | "blues" | "dorian" | "mixolydian" | "whole" | "phrygian" | "lydian" | "locrian"
  /** 0..11 (default 0) */
  "root"?: Auto
  /** 415..466 Hz (default 440) */
  "a4"?: Auto
  /** 0..50 cents (default 8) */
  "tolerance"?: Auto
  /** 0..1 (default 1) */
  "strength"?: Auto
  /** 0..400 ms (default 80) */
  "speed"?: Auto
  at?: number | string
  duration?: number | string
}

export declare const tune: {
  (ctx: Ctx): Process
  channels: "any"
  streaming: false
  tail: 0
  params: {
    /** default "chromatic" */
    "scale": { type: "enum", values: ["chromatic","major","minor","harmonic-minor","melodic-minor","pentatonic-major","pentatonic-minor","blues","dorian","mixolydian","whole","phrygian","lydian","locrian"], default: "chromatic" }
    /** 0..11 (default 0) */
    "root": { type: "number", min: 0, max: 11, default: 0, step: 1 }
    /** 415..466 Hz (default 440) */
    "a4": { type: "number", min: 415, max: 466, default: 440, unit: "Hz" }
    /** 0..50 cents (default 8) */
    "tolerance": { type: "number", min: 0, max: 50, default: 8, unit: "cents" }
    /** 0..1 (default 1) */
    "strength": { type: "number", min: 0, max: 1, default: 1 }
    /** 0..400 ms (default 80) */
    "speed": { type: "number", min: 0, max: 400, default: 80, unit: "ms" }
  }
}
