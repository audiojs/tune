// Generated from the audio.js manifest (params metadata is the source of truth).
// Regenerate: node tools/dts.js in @audio/compile. Do not edit by hand.

/** Automatable number — scalar, `t => value` fn, or breakpoint curve {t, v} */
type Auto = number | ((t: number) => number) | { t: number[], v: number[] }
/** Per-block param values as delivered by hosts (numbers arrive as 1-length Float32Array) */
type Live = Record<string, Float32Array | string | boolean>
type Ctx = { sampleRate: number, maxBlockSize: number, maxChannels: number, currentTime: number, duration?: number, events?: readonly any[], emit?: (name: string, ...args: any[]) => void, [k: string]: unknown }
type Process = (inputs: Float32Array[][], outputs: Float32Array[][], params: Live) => void

/** Chainable-host options for 'tune' */
export interface TuneOptions {
  /** default "chromatic" */
  "scale"?: "chromatic" | "major" | "minor" | "harmonic-minor" | "melodic-minor" | "pentatonic-major" | "pentatonic-minor" | "blues" | "dorian" | "mixolydian" | "whole"
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
    "scale": { type: "enum", values: ["chromatic","major","minor","harmonic-minor","melodic-minor","pentatonic-major","pentatonic-minor","blues","dorian","mixolydian","whole"], default: "chromatic" }
    /** 0..11 (default 0) */
    "root": { type: "number", default: 0 }
    /** 415..466 Hz (default 440) */
    "a4": { type: "number", default: 440 }
    /** 0..50 cents (default 8) */
    "tolerance": { type: "number", default: 8 }
    /** 0..1 (default 1) */
    "strength": { type: "number", default: 1 }
    /** 0..400 ms (default 80) */
    "speed": { type: "number", default: 80 }
  }
}
