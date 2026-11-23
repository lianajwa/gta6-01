// Procedural radio: 3 WebAudio stations, no audio files. Each station is a small
// step-sequencer (bass + lead + hats) with its own scale and tempo. Audio only
// starts after a user gesture; everything is guarded so a blocked context can
// never break the game loop.
export const STATIONS = [
  { name: 'Tide FM 88.1', desc: 'Delta soul', bpm: 96, scale: [0, 3, 5, 7, 10], base: 110, wave: 'sawtooth' },
  { name: 'Neon 104', desc: 'Night drive synth', bpm: 122, scale: [0, 2, 3, 7, 9], base: 130.8, wave: 'square' },
  { name: 'Canal 96.5', desc: 'Lazy reggae', bpm: 76, scale: [0, 4, 5, 7, 11], base: 98, wave: 'triangle' },
];

export function createAudio() {
  let ctx = null, master = null, station = 0, muted = false, timer = null, step = 0;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.12;
      master.connect(ctx.destination);
      return true;
    } catch { return false; }
  }
  function note(freq, when, dur, type, vol) {
    try {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + dur);
      o.connect(g); g.connect(master);
      o.start(when); o.stop(when + dur + 0.02);
    } catch { /* audio is cosmetic */ }
  }
  function tick() {
    if (!ctx || muted) return;
    const st = STATIONS[station];
    const spb = 60 / st.bpm / 2; // eighth notes
    const now = ctx.currentTime + 0.05;
    const deg = st.scale[step % st.scale.length];
    const f = st.base * Math.pow(2, deg / 12) * (step % 8 === 6 ? 2 : 1);
    note(f, now, spb * 1.8, st.wave, 0.5);
    if (step % 2 === 0) note(st.base / 2, now, spb * 1.9, 'sine', 0.9);
    if (step % 4 === 2) note(st.base * 4, now, 0.05, 'sine', 0.25); // hat tick
    step += 1;
  }
  return {
    get station() { return station; },
    get muted() { return muted; },
    stationName() { return STATIONS[station].name; },
    unlock() {
      if (started) return;
      if (!ensure()) return;
      started = true;
      try { ctx.resume(); } catch { /* ignore */ }
      const st = STATIONS[station];
      timer = window.setInterval(tick, (60 / st.bpm / 2) * 1000);
    },
    nextStation() {
      station = (station + 1) % STATIONS.length;
      step = 0;
      if (timer) { window.clearInterval(timer); timer = null; }
      if (started && ctx) {
        const st = STATIONS[station];
        timer = window.setInterval(tick, (60 / st.bpm / 2) * 1000);
      }
      return STATIONS[station].name;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.12;
      return muted;
    },
    beep(freq = 660, dur = 0.08) {
      if (!started || !ctx || muted) return;
      try { ctx.resume(); note(freq, ctx.currentTime, dur, 'square', 0.4); } catch { /* ignore */ }
    },
    shot() { if (started && ctx && !muted) { try { note(180, ctx.currentTime, 0.12, 'sawtooth', 0.7); } catch { /* ignore */ } } },
  };
}
