'use client';

// Web Audio API で効果音を生成（外部ファイル不要）
function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    return new (window.AudioContext || (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  } catch { return null; }
}

function beep(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.3) {
  const ac = ctx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  gain.gain.setValueAtTime(vol, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + duration);
}

function chord(freqs: number[], duration: number, type: OscillatorType = 'sine') {
  freqs.forEach(f => beep(f, duration, type, 0.2));
}

export const sounds = {
  action() { beep(440, 0.12, 'square', 0.2); },
  challenge() {
    beep(300, 0.08, 'sawtooth', 0.25);
    setTimeout(() => beep(500, 0.12, 'sawtooth', 0.25), 80);
  },
  block() {
    beep(250, 0.1, 'square', 0.2);
    setTimeout(() => beep(200, 0.15, 'square', 0.2), 100);
  },
  loseInfluence() {
    beep(400, 0.1, 'sine', 0.25);
    setTimeout(() => beep(280, 0.2, 'sine', 0.2), 100);
    setTimeout(() => beep(200, 0.3, 'sine', 0.15), 220);
  },
  win() {
    [0, 100, 200, 350].forEach((t, i) =>
      setTimeout(() => beep([523, 659, 784, 1047][i], 0.3, 'sine', 0.25), t)
    );
  },
  coup() {
    beep(150, 0.05, 'sawtooth', 0.3);
    setTimeout(() => beep(100, 0.4, 'sawtooth', 0.25), 50);
  },
  coins() { beep(880, 0.08, 'sine', 0.15); setTimeout(() => beep(1100, 0.1, 'sine', 0.1), 70); },
  buttonClick() { beep(600, 0.05, 'sine', 0.1); },
};
