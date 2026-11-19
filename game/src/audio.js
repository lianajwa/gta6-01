// Procedural sound only: every effect and every radio note is made by the
// Web Audio API at run time. No audio files, no network. Audio starts on the
// first user gesture (browsers block it before then) and stays muted until
// then; M toggles mute, R changes station.

const NOTE = { C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, B2: 123.47, C3: 130.81, E3: 164.81, G3: 196.0, A3: 220.0, B3: 246.94, D3: 146.83 };

// One bassline per station: a slow, loopable pattern of notes and rests.
const BASSLINES = [
  [NOTE.C2, 0, NOTE.G2, 0, NOTE.A2, 0, NOTE.F2, NOTE.G2],
  [NOTE.A2, NOTE.A2, 0, NOTE.C3, 0, NOTE.G2, NOTE.E2, 0],
  [NOTE.E2, 0, NOTE.E2, NOTE.G2, 0, NOTE.D2, NOTE.D2, 0],
];

export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let station = 0;
  let stepTimer = 0;
  let stepIndex = 0;
  let nextNoteTime = 0;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      context = new AC();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      musicGain = context.createGain();
      musicGain.gain.value = 0.12;
      musicGain.connect(master);
      nextNoteTime = context.currentTime + 0.1;
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, duration, type, volume, when = 0) {
    if (!context || muted) return;
    try {
      const t = context.currentTime + when;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + duration + 0.02);
    } catch { /* sound is decoration; never break the game */ }
  }

  function noiseBurst(duration, volume) {
    if (!context || muted) return;
    try {
      const t = context.currentTime;
      const length = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const gain = context.createGain();
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(master);
      source.start(t);
    } catch { /* ignore */ }
  }

  return {
    unlock() { ensure(); },
    setStation(index) { station = index; stepIndex = 0; },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() { return muted; },
    shoot() { noiseBurst(0.09, 0.5); blip(220, 0.07, 'square', 0.25); },
    punch() { noiseBurst(0.06, 0.3); },
    crash() { noiseBurst(0.25, 0.5); blip(70, 0.25, 'sawtooth', 0.3); },
    pickup() { blip(660, 0.09, 'sine', 0.3); blip(990, 0.12, 'sine', 0.3, 0.08); },
    coin() { blip(880, 0.08, 'sine', 0.25); blip(1320, 0.1, 'sine', 0.25, 0.07); },
    siren() { blip(700, 0.18, 'sine', 0.12); blip(950, 0.18, 'sine', 0.12, 0.18); },
    mission() { [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.16, 'triangle', 0.3, i * 0.11)); },
    fail() { [392, 330, 262].forEach((f, i) => blip(f, 0.2, 'triangle', 0.28, i * 0.13)); },
    busted() { [220, 196, 165].forEach((f, i) => blip(f, 0.3, 'sawtooth', 0.25, i * 0.2)); },
    /** Advance the radio bassline; call once per frame with dt. */
    step(dt) {
      if (!context || muted) return;
      stepTimer += dt;
      if (stepTimer < 0.32) return;
      stepTimer = 0;
      const line = BASSLINES[station % BASSLINES.length];
      const note = line[stepIndex % line.length];
      stepIndex += 1;
      if (note > 0) {
        try {
          const t = context.currentTime;
          const osc = context.createOscillator();
          const gain = context.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(note, t);
          gain.gain.setValueAtTime(0.5, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          osc.connect(gain);
          gain.connect(musicGain);
          osc.start(t);
          osc.stop(t + 0.32);
        } catch { /* ignore */ }
      }
    },
  };
}
