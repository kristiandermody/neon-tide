// Sound (Web Audio, synthesized, no files), vibration (Android; iOS Safari has no Vibration API), mute state.
import { store } from "./store.js";

let ctx = null;
let muted = store.get("nt:muted") === "1";
const listeners = new Set();

export const isMuted = () => muted;

export function setMuted(value) {
  muted = value;
  store.set("nt:muted", value ? "1" : "0");
  for (const fn of listeners) fn(muted);
}

export function onMuteChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Browsers only start audio after a user gesture; call this from one. */
export function unlockAudio() {
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
}

function tone(freq, start, duration, { type = "square", gain = 0.06, to } = {}) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + start + duration);
  amp.gain.setValueAtTime(gain, ctx.currentTime + start);
  amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration + 0.02);
}

const SOUNDS = {
  fire: () => tone(880, 0, 0.08, { to: 440 }),
  miss: () => tone(220, 0, 0.14, { type: "triangle", gain: 0.08, to: 160 }),
  hit: () => {
    tone(160, 0, 0.18, { type: "sawtooth", gain: 0.08, to: 60 });
    tone(660, 0, 0.1, { gain: 0.05 });
  },
  sunk: () => [784, 659, 523, 392].forEach((f, i) => tone(f, i * 0.09, 0.12, { gain: 0.06 })),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.16, { gain: 0.06 })),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, i * 0.16, 0.2, { type: "triangle", gain: 0.08 })),
  tap: () => tone(1320, 0, 0.03, { gain: 0.03 }),
};

const VIBRATION = { miss: 20, hit: [60], sunk: [80, 40, 140], win: [60, 40, 60, 40, 200], lose: [300] };

export function play(name) {
  if (navigator.vibrate && VIBRATION[name]) {
    try {
      navigator.vibrate(VIBRATION[name]);
    } catch {
      // Ignored: some browsers throw before a user gesture.
    }
  }
  if (muted || !ctx || ctx.state !== "running" || !SOUNDS[name]) return;
  SOUNDS[name]();
}
