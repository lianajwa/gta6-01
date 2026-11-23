// audio.js: three radio stations, all synthesized live with WebAudio — no
// audio files, no network. Each station is a step sequencer: a bass line, a
// chord stab and a hat, at its own tempo, root and waveform.
import { RADIO } from './config.js';

export function createAudio() {
  let ctx = null;
  let station = 0;
  let timer = null;
  let step = 0;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function note(freq, t, dur, wave, gain, dest) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // Minor-pentatonic bass + stab patterns, different per station.
  const PATTERNS = {
    delta: { bass: [0, 0, 3, 0, 5, 0, 3, 7], stab: [0, 7, 10, 12], hatEvery: 2 },
    neon: { bass: [0, 0, 0, 3, 0, 0, 5, 7], stab: [0, 3, 7, 10], hatEvery: 1 },
    tide: { bass: [0, 5, 3, 0, 0, 3, 5, 7], stab: [0, 5, 7, 12], hatEvery: 4 },
  };
  const SCALE = [1, 1.189, 1.335, 1.498, 1.782, 2];

  function tick() {
    if (!ctx || muted) return;
    const st = RADIO[station];
    const pat = PATTERNS[st.id];
    const beat = 60 / st.bpm / 2; // eighth notes
    const t = ctx.currentTime + 0.05;
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const bi = step % 8;
    const bassNote = st.root * SCALE[pat.bass[bi] % SCALE.length] * (pat.bass[bi] >= 6 ? 0.5 : 1);
    note(bassNote, t, beat * 1.8, st.wave, 0.22, master);
    if (step % 4 === 2) {
      const chord = st.root * 2 * SCALE[pat.stab[(step / 4 | 0) % 4] % SCALE.length];
      note(chord, t, beat * 1.4, 'triangle', 0.08, master);
      note(chord * 1.5, t, beat * 1.4, 'triangle', 0.05, master);
    }
    if (step % pat.hatEvery === 0) note(6000, t, 0.03, 'square', 0.015, master);
    step++;
    timer = setTimeout(tick, beat * 1000);
  }

  function startEngine() {
    ensure();
    if (!ctx || engineOsc) return;
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 320;
    engineOsc.connect(filt).connect(engineGain).connect(ctx.destination);
    engineOsc.start();
  }

  return {
    get station() { return RADIO[station]; },
    get muted() { return muted; },
    unlock() { ensure(); startEngine(); if (!timer) tick(); },
    setStation(i) {
      station = ((i % RADIO.length) + RADIO.length) % RADIO.length;
      step = 0;
      return RADIO[station];
    },
    nextStation() { return this.setStation(station + 1); },
    setMuted(m) {
      muted = m;
      if (muted && timer) { clearTimeout(timer); timer = null; }
      else if (!muted && ctx && !timer) tick();
      if (engineGain) engineGain.gain.value = muted ? 0 : 0.05;
    },
    engine(speedN, on) {
      if (!engineOsc) return;
      const target = on && !muted ? 0.03 + speedN * 0.06 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(45 + speedN * 90, ctx.currentTime, 0.1);
    },
    blip(freq = 880, dur = 0.08, gain = 0.12) {
      if (!ctx || muted) return;
      note(freq, ctx.currentTime, dur, 'square', gain, ctx.destination);
    },
    gunshot() {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const buf = ctx.createBuffer(1, 2205, 44100);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.25;
      src.connect(g).connect(ctx.destination);
      src.start(t);
    },
    siren(on) {
      // A two-tone siren is just two alternating blips; the caller toggles.
      if (on) this.blip(660, 0.18, 0.05);
    },
    stop() {
      if (timer) { clearTimeout(timer); timer = null; }
      step = 0; // restart the sequencer pattern from the top next unlock
      try { engineOsc && engineOsc.stop(); } catch { /* already stopped */ }
      engineOsc = null;
    },
  };
}
