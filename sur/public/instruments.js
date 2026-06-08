// Sur's "band" — the host synthesizes every instrument with the Web Audio API
// (phones just send tap events, so latency never matters). A subtle tabla
// groove + tanpura drone hold the jam together.
import { INSTRUMENTS, getInstrument } from '/sur/instruments-data.js';

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function createBand() {
  let ctx = null, master = null, jam = null, loopGain = null;
  let looping = false, loopTimer = null, step = 0, nextTime = 0, drone = [];

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.75; master.connect(ctx.destination);
      jam = ctx.createGain(); jam.gain.value = 1.0; jam.connect(master);
      loopGain = ctx.createGain(); loopGain.gain.value = 0.4; loopGain.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noiseBurst(t, { dur = 0.05, gain = 0.15, type = 'highpass', freq = 3000, target }) {
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(target || jam); src.start(t); src.stop(t + dur + 0.02);
  }
  function drum(t, { freq, drop = 0.5, dur = 0.22, gain = 0.5, noiseGain = 0.14, noiseFreq = 2000, target }) {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * drop, t + dur * 0.6);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(target || jam); osc.start(t); osc.stop(t + dur + 0.02);
    noiseBurst(t, { dur: 0.05, gain: noiseGain, type: 'lowpass', freq: noiseFreq, target });
  }
  function tick(t, { freq = 900, gain = 0.28, target }) {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.connect(g).connect(target || jam); osc.start(t); osc.stop(t + 0.11);
    noiseBurst(t, { dur: 0.04, gain: gain * 0.4, type: 'highpass', freq: 5000, target });
  }
  function pluck(t, freq, target) {
    const osc = ctx.createOscillator(); const g = ctx.createGain(); const f = ctx.createBiquadFilter();
    osc.type = 'sawtooth'; osc.frequency.setValueAtTime(freq, t);
    f.type = 'lowpass'; f.frequency.setValueAtTime(freq * 7, t); f.frequency.exponentialRampToValueAtTime(freq * 2, t + 0.4); f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(f).connect(g).connect(target || jam); osc.start(t); osc.stop(t + 0.65);
  }
  function flute(t, freq, target) {
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(freq, t);
    const lfo = ctx.createOscillator(); const lg = ctx.createGain(); lfo.frequency.value = 5; lg.gain.value = freq * 0.01;
    lfo.connect(lg).connect(osc.frequency); lfo.start(t); lfo.stop(t + 0.82);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.26, t + 0.06); g.gain.setValueAtTime(0.26, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.78);
    osc.connect(g).connect(target || jam); osc.start(t); osc.stop(t + 0.82);
  }
  function bell(t, freq, target) {
    [1, 2.01].forEach((m, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq * m;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(i ? 0.08 : 0.2, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(g).connect(target || jam); osc.start(t); osc.stop(t + 0.52);
    });
  }

  function hit(instId, pad = 0, when) {
    ensure();
    const t = when ?? ctx.currentTime;
    const inst = getInstrument(instId);
    if (inst.type === 'perc') {
      if (instId === 'tabla') {
        if (pad === 0) tick(t, { freq: 1000, gain: 0.28 });
        else if (pad === 1) tick(t, { freq: 680, gain: 0.28 });
        else if (pad === 2) drum(t, { freq: 150, dur: 0.25, gain: 0.5 });
        else drum(t, { freq: 110, dur: 0.3, gain: 0.5 });
      } else {
        if (pad === 0) drum(t, { freq: 220, dur: 0.2, gain: 0.45, noiseFreq: 1600 });
        else drum(t, { freq: 95, dur: 0.32, gain: 0.55 });
      }
    } else {
      const note = inst.pads[pad]?.note ?? 67;
      const f = midi(note);
      if (inst.type === 'pluck') pluck(t, f);
      else if (inst.type === 'flute') flute(t, f);
      else bell(t, f);
    }
  }

  // backing groove + tanpura drone
  const BPM = 92, EIGHTH = 30 / BPM;
  function scheduleLoop() {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.25) {
      const s = step % 8;
      if (s === 0 || s === 4) drum(nextTime, { freq: 130, dur: 0.22, gain: 0.26, target: loopGain });
      if (s === 2 || s === 6) tick(nextTime, { freq: 900, gain: 0.12, target: loopGain });
      if (s === 3 || s === 7) tick(nextTime, { freq: 650, gain: 0.08, target: loopGain });
      nextTime += EIGHTH; step = (step + 1) % 8;
    }
  }
  function startLoop() {
    ensure();
    if (looping) return; looping = true;
    drone = [36, 43].map((m, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = midi(m); g.gain.value = i ? 0.05 : 0.07;
      o.connect(g).connect(loopGain); o.start(); return { o, g };
    });
    step = 0; nextTime = ctx.currentTime + 0.1;
    loopTimer = setInterval(scheduleLoop, 60);
  }
  function stopLoop() {
    looping = false;
    if (loopTimer) { clearInterval(loopTimer); loopTimer = null; }
    drone.forEach(({ o }) => { try { o.stop(); } catch {} });
    drone = [];
  }

  return {
    unlock: () => ensure(),
    hit,
    startLoop,
    stopLoop,
    setMaster: (v) => { ensure(); master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    instruments: INSTRUMENTS,
  };
}
