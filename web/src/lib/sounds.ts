// Practice sound effects, synthesized with Web Audio so there are no files to
// load. Muting is a per-device preference kept in localStorage.

export type Sound = "correct" | "wrong" | "cleared" | "failed";

const MUTE_KEY = "halolesson:muted";
let context: AudioContext | null = null;

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // Private mode: the choice lasts this page only.
  }
}

// Notes as [frequency Hz, start s, length s].
const TUNES: Record<Sound, { wave: OscillatorType; notes: Array<[number, number, number]>; volume: number }> = {
  correct: { wave: "sine", volume: 0.22, notes: [[784, 0, 0.12], [1175, 0.09, 0.22]] },
  wrong: { wave: "square", volume: 0.07, notes: [[220, 0, 0.14], [174, 0.12, 0.26]] },
  cleared: { wave: "triangle", volume: 0.25, notes: [[523, 0, 0.14], [659, 0.12, 0.14], [784, 0.24, 0.14], [1047, 0.36, 0.4]] },
  failed: { wave: "triangle", volume: 0.2, notes: [[392, 0, 0.2], [330, 0.18, 0.2], [262, 0.36, 0.45]] },
};

export function play(sound: Sound): void {
  if (isMuted() || typeof AudioContext === "undefined") return;
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") void context.resume();
    const tune = TUNES[sound];
    const now = context.currentTime;
    for (const [frequency, start, length] of tune.notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = tune.wave;
      oscillator.frequency.value = frequency;
      // Quick attack, smooth fade: no clicks.
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(tune.volume, now + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + start);
      oscillator.stop(now + start + length + 0.05);
    }
  } catch {
    // Audio is a nicety; never let it break practice.
  }
}
