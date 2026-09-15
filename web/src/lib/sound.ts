// The sound of the sea, made on the spot with Web Audio: a low drone, the rush
// of water that grows as you move and dulls as you go deeper, and a soft ping
// whenever a light is born or answered, pitched by its colour. Nothing plays
// until the diver turns sound on.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let droneFilter: BiquadFilterNode | null = null;
let waterFilter: BiquadFilterNode | null = null;
let waterGain: GainNode | null = null;
let echo: DelayNode | null = null;
let enabled = false;

function build() {
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  // Drone: a low open fifth, each voice breathing at its own slow rate.
  droneFilter = ctx.createBiquadFilter();
  droneFilter.type = "lowpass";
  droneFilter.frequency.value = 420;
  droneFilter.connect(master);
  for (const [freq, level, rate] of [
    [55, 0.22, 0.05],
    [82.41, 0.14, 0.07],
    [110.3, 0.05, 0.031],
  ]) {
    const osc = ctx.createOscillator();
    osc.type = freq > 100 ? "triangle" : "sine";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = level;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    const depth = ctx.createGain();
    depth.gain.value = level * 0.6;
    lfo.connect(depth).connect(gain.gain);
    osc.connect(gain).connect(droneFilter);
    osc.start();
    lfo.start();
  }

  // Water: looping brown noise through a lowpass.
  const seconds = 4;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  waterFilter = ctx.createBiquadFilter();
  waterFilter.type = "lowpass";
  waterFilter.frequency.value = 900;
  waterGain = ctx.createGain();
  waterGain.gain.value = 0.25;
  noise.connect(waterFilter).connect(waterGain).connect(master);
  noise.start();

  // A long soft echo for pings, as if they carried a long way through water.
  echo = ctx.createDelay(2);
  echo.delayTime.value = 0.42;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.38;
  const damp = ctx.createBiquadFilter();
  damp.type = "lowpass";
  damp.frequency.value = 1800;
  echo.connect(damp).connect(feedback).connect(echo);
  damp.connect(master);
}

export const sound = {
  get enabled() {
    return enabled;
  },

  async setEnabled(on: boolean) {
    enabled = on;
    if (on && !ctx) build();
    if (!ctx || !master) return;
    if (on) await ctx.resume();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, on ? 1.2 : 0.3);
  },

  // Called every frame with where the diver is and how fast they're moving.
  update(depth: number, speed: number) {
    if (!enabled || !ctx || !droneFilter || !waterFilter || !waterGain) return;
    const t = ctx.currentTime;
    const deep = Math.min(1, Math.log10(1 + depth) / 4);
    droneFilter.frequency.setTargetAtTime(420 - deep * 260, t, 0.5);
    waterFilter.frequency.setTargetAtTime(1100 - deep * 900 + Math.min(speed * 40, 900), t, 0.2);
    waterGain.gain.setTargetAtTime(0.12 + (1 - deep) * 0.12 + Math.min(speed * 0.02, 0.35), t, 0.2);
  },

  // A light's voice: shorter wavelengths ring higher.
  ping(wavelength: number, strength = 1) {
    if (!enabled || !ctx || !master || !echo) return;
    const t = ctx.currentTime;
    const freq = 880 * Math.pow(2, -(wavelength - 440) / 135);
    for (const [ratio, level] of [
      [1, 0.16],
      [2.01, 0.04],
    ]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * ratio;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(level * strength, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      osc.connect(gain);
      gain.connect(master);
      gain.connect(echo);
      osc.start(t);
      osc.stop(t + 3);
    }
  },
};
