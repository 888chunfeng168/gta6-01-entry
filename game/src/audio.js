// audio.js — all sound is synthesized with WebAudio oscillators and
// filtered noise. No audio files, no network, nothing to download.
export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
  };

  audio.ensure = () => {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.35;
      audio.master.connect(audio.ctx.destination);
    } catch (err) { audio.ctx = null; }
  };

  function tone(freq, dur, type, vol, slideTo) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(audio.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const len = Math.floor(audio.ctx.sampleRate * dur);
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buf;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = filterFreq || 1800;
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(audio.master);
    src.start(t);
  }

  audio.shoot = () => { noise(0.14, 0.5, 2600); tone(180, 0.1, 'square', 0.16, 60); };
  audio.hit = () => { tone(120, 0.12, 'sawtooth', 0.2, 70); };
  audio.crash = () => { noise(0.25, 0.45, 900); };
  audio.pickup = () => { tone(660, 0.09, 'sine', 0.22); setTimeout(() => tone(990, 0.14, 'sine', 0.22), 80); };
  audio.cash = () => { tone(880, 0.1, 'triangle', 0.25); setTimeout(() => tone(1320, 0.18, 'triangle', 0.25), 90); };
  audio.mission = () => { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.25), i * 110)); };
  audio.busted = () => { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.2), i * 180)); };
  audio.steal = () => { tone(300, 0.12, 'square', 0.18, 520); };
  audio.door = () => { noise(0.08, 0.2, 1200); };
  audio.click = () => { tone(520, 0.06, 'triangle', 0.18); };

  // Continuous engine hum while driving; call every frame with speed.
  audio.engine = (driving, speedRatio) => {
    if (!audio.ctx || audio.muted) return;
    if (!driving) {
      if (audio.engineOsc) { try { audio.engineOsc.stop(); } catch (e) {} audio.engineOsc = null; }
      return;
    }
    if (!audio.engineOsc) {
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineGain = audio.ctx.createGain();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 60;
      audio.engineGain.gain.value = 0.05;
      const filter = audio.ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 700;
      audio.engineOsc.connect(filter); filter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
    }
    audio.engineOsc.frequency.value = 55 + speedRatio * 140;
    audio.engineGain.gain.value = 0.04 + speedRatio * 0.05;
  };

  // Two-tone police siren while any cop is near; call every frame.
  audio.siren = (dt, active) => {
    if (!audio.ctx || audio.muted) { audio.sirenTimer = 0; return; }
    if (!active) {
      if (audio.sirenOsc) { try { audio.sirenOsc.stop(); } catch (e) {} audio.sirenOsc = null; }
      return;
    }
    audio.sirenTimer += dt;
    const phase = Math.floor(audio.sirenTimer / 0.45) % 2;
    if (!audio.sirenOsc) {
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenOsc.type = 'triangle';
      audio.sirenGain.gain.value = 0.05;
      audio.sirenOsc.connect(audio.sirenGain);
      audio.sirenGain.connect(audio.master);
      audio.sirenOsc.start();
    }
    audio.sirenOsc.frequency.value = phase === 0 ? 720 : 960;
  };

  audio.toggleMute = () => { audio.muted = !audio.muted; return audio.muted; };
  return audio;
}
