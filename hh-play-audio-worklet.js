/* Optional low-latency HH Play metronome processor. Canvas/Web Audio fallback
   remains active when AudioWorklet is unavailable or the module is blocked. */
class HHPlayMetronomeProcessor extends AudioWorkletProcessor {
  constructor() { super(); this.phase = 0; this.remaining = 0; this.frequency = 0; this.port.onmessage = (event) => { const data = event.data || {}; if (data.type === "pulse") { this.remaining = Math.max(0, Math.min(sampleRate * 0.12, Math.round(sampleRate * (Number(data.duration) || 0.08)))); this.frequency = Math.max(0, Number(data.frequency) || 440); } }; }
  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output?.length) return true;
    for (const channel of output) for (let index = 0; index < channel.length; index += 1) { const active = this.remaining > 0; const envelope = active ? Math.min(1, this.remaining / (sampleRate * 0.02)) : 0; channel[index] = active ? Math.sin(this.phase) * 0.035 * envelope : 0; this.phase += (2 * Math.PI * this.frequency) / sampleRate; if (this.phase > Math.PI * 2) this.phase -= Math.PI * 2; this.remaining = Math.max(0, this.remaining - 1); }
    return true;
  }
}
registerProcessor("hh-play-metronome", HHPlayMetronomeProcessor);
