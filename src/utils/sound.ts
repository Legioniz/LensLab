/**
 * Local, synthesized interface feedback. No audio assets or network requests are used.
 * Every sound is short, volume-controlled, and optional; a browser audio failure
 * must never interrupt camera controls or photo processing.
 */
export type SoundKind =
  | "click"
  | "navigation"
  | "toggle"
  | "slider"
  | "focus"
  | "shutter"
  | "success"
  | "warning"
  | "error";

let audioContext: AudioContext | null = null;
let lastSoundAt = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const browserWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextConstructor = window.AudioContext ?? browserWindow.webkitAudioContext;
    if (!AudioContextConstructor) return null;
    audioContext ??= new AudioContextConstructor();
    if (audioContext.state === "suspended") void audioContext.resume().catch(() => undefined);
    return audioContext;
  } catch {
    audioContext = null;
    return null;
  }
}

function playTone(
  context: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine",
  endFrequency?: number,
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(Math.max(20, frequency), startAt);
  if (endFrequency && endFrequency > 0) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), startAt + duration);
  }
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startAt + Math.min(0.008, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.005);
}

function playShutter(context: AudioContext, now: number, volume: number) {
  // A quiet mechanical transient plus a low body tone, closer to a camera action
  // than a loud stock notification. The generated noise stays entirely local.
  const sampleRate = context.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * 0.075));
  const buffer = context.createBuffer(1, length, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    const envelope = Math.pow(1 - index / length, 2.8);
    channel[index] = (Math.random() * 2 - 1) * envelope;
  }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2400, now);
  gain.gain.setValueAtTime(volume * 0.48, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start(now);
  source.stop(now + 0.08);
  playTone(context, 142, now, 0.09, volume * 0.78, "triangle", 56);
}

export function playSound(kind: SoundKind, enabled: boolean, masterVolume = 0.65) {
  if (!enabled || masterVolume <= 0) return;
  const context = getAudioContext();
  if (!context) return;

  const now = context.currentTime;
  const volume = Math.max(0, Math.min(1, masterVolume));
  // Avoid accidental stacks caused by rapid pointer/click events. Slider ticks
  // are rate-limited by the caller as well, but are protected here too.
  if (kind === "slider" && now - lastSoundAt < 0.045) return;
  lastSoundAt = now;

  try {
    const base = volume * 0.055;
    switch (kind) {
      case "click":
        playTone(context, 620, now, 0.035, base * 0.52, "sine");
        break;
      case "navigation":
        playTone(context, 520, now, 0.055, base * 0.72, "sine");
        playTone(context, 780, now + 0.045, 0.065, base * 0.64, "sine");
        break;
      case "toggle":
        playTone(context, 390, now, 0.035, base * 0.58, "triangle");
        playTone(context, 640, now + 0.025, 0.045, base * 0.58, "sine");
        break;
      case "slider":
        playTone(context, 860, now, 0.022, base * 0.32, "sine");
        break;
      case "focus":
        playTone(context, 880, now, 0.055, base * 0.64, "sine");
        playTone(context, 1174, now + 0.055, 0.07, base * 0.54, "sine");
        break;
      case "shutter":
        playShutter(context, now, volume * 0.12);
        break;
      case "success":
        playTone(context, 523.25, now, 0.12, base * 0.65, "triangle");
        playTone(context, 659.25, now + 0.075, 0.13, base * 0.62, "triangle");
        playTone(context, 783.99, now + 0.15, 0.18, base * 0.72, "sine");
        break;
      case "warning":
        playTone(context, 440, now, 0.075, base * 0.62, "triangle");
        playTone(context, 330, now + 0.085, 0.09, base * 0.58, "triangle");
        break;
      case "error":
        playTone(context, 310, now, 0.09, base * 0.68, "sawtooth", 230);
        playTone(context, 230, now + 0.095, 0.11, base * 0.58, "sawtooth", 170);
        break;
    }
  } catch {
    // Audio is progressive enhancement only; all controls remain functional.
  }
}
