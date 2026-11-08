import { afterEach, describe, expect, it, vi } from "vitest";

type AudioStats = { nodes: number; started: number; createdContexts: number };

function installFakeAudioContext() {
  const stats: AudioStats = { nodes: 0, started: 0, createdContexts: 0 };
  class FakeParam {
    setValueAtTime() {}
    exponentialRampToValueAtTime() {}
  }
  class FakeNode {
    frequency = new FakeParam();
    gain = new FakeParam();
    buffer: AudioBuffer | null = null;
    constructor() { stats.nodes += 1; }
    connect() {}
    start() { stats.started += 1; }
    stop() {}
  }
  class FakeAudioContext {
    state: AudioContextState = "running";
    currentTime = 1;
    sampleRate = 8_000;
    destination = {} as AudioDestinationNode;
    constructor() { stats.createdContexts += 1; }
    createOscillator() { return new FakeNode() as unknown as OscillatorNode; }
    createGain() { return new FakeNode() as unknown as GainNode; }
    createBuffer(_channels: number, _length: number, _sampleRate: number) {
      return { getChannelData: () => new Float32Array(16) } as unknown as AudioBuffer;
    }
    createBufferSource() { return new FakeNode() as unknown as AudioBufferSourceNode; }
    createBiquadFilter() { return new FakeNode() as unknown as BiquadFilterNode; }
    resume() { return Promise.resolve(); }
  }
  vi.stubGlobal("window", { AudioContext: FakeAudioContext } as unknown as Window);
  return stats;
}

describe("local interface sound engine", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("plays every supported cue using the local Web Audio API", async () => {
    const stats = installFakeAudioContext();
    const { playSound } = await import("./sound");
    const cues = ["click", "navigation", "toggle", "slider", "focus", "shutter", "success", "warning", "error"] as const;
    for (const cue of cues) playSound(cue, true, 0.4);
    expect(stats.createdContexts).toBe(1);
    expect(stats.nodes).toBeGreaterThan(0);
    expect(stats.started).toBeGreaterThan(0);
  });

  it("does not create audio nodes while disabled or muted", async () => {
    const stats = installFakeAudioContext();
    const { playSound } = await import("./sound");
    playSound("click", false, 0.65);
    playSound("success", true, 0);
    expect(stats.createdContexts).toBe(0);
    expect(stats.nodes).toBe(0);
  });

  it("safely falls back when Web Audio is unavailable", async () => {
    vi.stubGlobal("window", {} as unknown as Window);
    const { playSound } = await import("./sound");
    expect(() => playSound("navigation", true, 0.5)).not.toThrow();
  });
});
