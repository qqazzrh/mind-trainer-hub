// Web Audio API based cues for The Grid timer signals.
let ctx: AudioContext | null = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

function tone(freq: number, durationMs: number, when = 0, gain = 0.15) {
  const ac = getCtx();
  if (!ac) return;
  const start = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.linearRampToValueAtTime(0, start + durationMs / 1000);
  osc.connect(g).connect(ac.destination);
  osc.start(start);
  osc.stop(start + durationMs / 1000 + 0.05);
}

export const cues = {
  start: () => tone(660, 180),
  tick: (i: number) => tone(500 + i * 150, 140), // ascending
  end: () => {
    tone(880, 220);
    tone(660, 220, 0.18);
  },
};