// Procedural sound engine — every sound is synthesized with the Web Audio API
// so the game ships with zero audio files. Call Sound.unlock() on first user
// gesture (browsers require this), then trigger named effects.
export const Sound = (() => {
  let ctx = null;
  let master = null;
  let muted = false;
  // background music state
  let musicGain = null, mTimer = null, mStep = 0, mNextTime = 0, mPlaying = false;
  const MUSIC_VOL = 0.85;

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({ freq = 440, type = 'sine', dur = 0.15, gain = 0.3, attack = 0.005, decay = null, slideTo = null, when = 0 } = {}) {
    if (muted) return;
    ensure();
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (decay ?? dur));
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + (decay ?? dur) + 0.02);
  }

  function noise({ dur = 0.2, gain = 0.3, type = 'highpass', freq = 1000, when = 0 } = {}) {
    if (muted) return;
    ensure();
    const t0 = ctx.currentTime + when;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + dur);
  }

  const effects = {
    // Rising pop as you chain more tiles — pitch climbs with chain length.
    tile(step = 0) {
      const base = 320 * Math.pow(1.0595, Math.min(step, 16));
      tone({ freq: base, type: 'triangle', dur: 0.12, gain: 0.25, slideTo: base * 1.4 });
    },
    select() {
      tone({ freq: 520, type: 'square', dur: 0.05, gain: 0.12 });
    },
    success(len = 3) {
      // Happy arpeggio that grows with the word length.
      const root = 440;
      const steps = [0, 4, 7, 12, 16, 19].slice(0, Math.min(6, Math.max(3, len - 1)));
      steps.forEach((s, i) => {
        tone({ freq: root * Math.pow(2, s / 12), type: 'triangle', dur: 0.18, gain: 0.22, when: i * 0.05 });
      });
    },
    combo(level = 1) {
      const f = 600 + level * 120;
      tone({ freq: f, type: 'sawtooth', dur: 0.18, gain: 0.18, slideTo: f * 1.8 });
      noise({ dur: 0.15, gain: 0.12, type: 'bandpass', freq: 3000 });
    },
    error() {
      tone({ freq: 180, type: 'sawtooth', dur: 0.22, gain: 0.18, slideTo: 90 });
    },
    dupe() {
      tone({ freq: 300, type: 'sine', dur: 0.1, gain: 0.15 });
      tone({ freq: 300, type: 'sine', dur: 0.1, gain: 0.15, when: 0.12 });
    },
    join() {
      tone({ freq: 660, type: 'sine', dur: 0.1, gain: 0.2, slideTo: 990 });
    },
    countdown() {
      tone({ freq: 440, type: 'square', dur: 0.15, gain: 0.25 });
    },
    go() {
      tone({ freq: 880, type: 'square', dur: 0.4, gain: 0.3, slideTo: 1320 });
      noise({ dur: 0.3, gain: 0.2 });
    },
    tick() {
      tone({ freq: 1200, type: 'square', dur: 0.04, gain: 0.08 });
    },
    warn() {
      tone({ freq: 1500, type: 'square', dur: 0.08, gain: 0.18 });
    },
    fanfare() {
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.5, gain: 0.25, when: i * 0.12 }));
      notes.forEach((f, i) => tone({ freq: f * 1.5, type: 'sine', dur: 0.5, gain: 0.12, when: i * 0.12 + 0.6 }));
      noise({ dur: 0.6, gain: 0.15, when: 0.0 });
    },
    drumroll() {
      for (let i = 0; i < 18; i++) noise({ dur: 0.05, gain: 0.1, type: 'lowpass', freq: 400, when: i * 0.06 });
    },
    reveal() {
      tone({ freq: 700, type: 'sine', dur: 0.25, gain: 0.2, slideTo: 1100 });
    },
  };

  // ---------------------------------------------------------------------------
  // Background music — a generative, looping groove for the host screen so the
  // room is never silent. Pad chords + bright arpeggio + soft kick/hat.
  // ---------------------------------------------------------------------------
  const MIDI = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const PROG = [ // Am – F – C – G (one bar each)
    { bass: 45, pad: [57, 60, 64], arp: [69, 72, 76, 72] },
    { bass: 41, pad: [53, 57, 60], arp: [65, 69, 72, 69] },
    { bass: 48, pad: [60, 64, 67], arp: [72, 76, 79, 76] },
    { bass: 43, pad: [55, 59, 62], arp: [67, 71, 74, 71] },
  ];
  const BPM = 100;
  const EIGHTH = 30 / BPM;              // seconds per eighth note (0.3s)
  const STEPS_PER_BAR = 8;
  const BAR_DUR = STEPS_PER_BAR * EIGHTH;
  const TOTAL_STEPS = STEPS_PER_BAR * PROG.length;

  function mTone(freq, { type = 'sine', dur = 0.3, gain = 0.1, attack = 0.01, when = 0 }) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gain, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g).connect(musicGain);
    osc.start(when); osc.stop(when + dur + 0.02);
  }
  function mKick(t) {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(g).connect(musicGain);
    osc.start(t); osc.stop(t + 0.2);
  }
  function mHat(t) {
    const dur = 0.04;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(musicGain);
    src.start(t); src.stop(t + dur);
  }
  function scheduleStep(time) {
    const bar = Math.floor(mStep / STEPS_PER_BAR) % PROG.length;
    const s = mStep % STEPS_PER_BAR;
    const ch = PROG[bar];
    if (s === 0) {
      ch.pad.forEach((m) => mTone(MIDI(m), { type: 'triangle', dur: BAR_DUR * 0.95, gain: 0.045, attack: 0.08, when: time }));
      mTone(MIDI(ch.bass), { type: 'sine', dur: BAR_DUR * 0.9, gain: 0.11, attack: 0.02, when: time });
      mKick(time);
    }
    if (s === 4) { mKick(time); mTone(MIDI(ch.bass), { type: 'sine', dur: EIGHTH * 3, gain: 0.08, when: time }); }
    if (s % 2 === 1) mHat(time);
    mTone(MIDI(ch.arp[s % ch.arp.length] + 12), { type: 'triangle', dur: EIGHTH * 1.4, gain: 0.05, attack: 0.005, when: time });
  }
  function scheduler() {
    if (!ctx) return;
    while (mNextTime < ctx.currentTime + 0.25) {
      scheduleStep(mNextTime);
      mNextTime += EIGHTH;
      mStep = (mStep + 1) % TOTAL_STEPS;
    }
  }

  return {
    unlock() { ensure(); },
    play(name, ...args) { effects[name]?.(...args); },
    startMusic() {
      ensure();
      if (!musicGain) { musicGain = ctx.createGain(); musicGain.gain.value = muted ? 0 : MUSIC_VOL; musicGain.connect(master); }
      if (mPlaying) return;
      mPlaying = true; mStep = 0; mNextTime = ctx.currentTime + 0.1;
      mTimer = setInterval(scheduler, 60);
    },
    stopMusic() { mPlaying = false; if (mTimer) { clearInterval(mTimer); mTimer = null; } },
    toggleMute() {
      muted = !muted;
      if (musicGain) musicGain.gain.setTargetAtTime(muted ? 0 : MUSIC_VOL, ctx.currentTime, 0.05);
      return muted;
    },
    isMuted() { return muted; },
    setMute(v) { muted = v; if (musicGain) musicGain.gain.setTargetAtTime(v ? 0 : MUSIC_VOL, ctx.currentTime, 0.05); },
  };
})();
