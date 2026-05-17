export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this._init();
  }

  _init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this.enabled = false;
    }
  }

  _resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _tone(freq, duration, type = 'square', gainVal = 0.1, detune = 0) {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.detune.setValueAtTime(detune, this.ctx.currentTime);
    gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  }

  _noise(duration, gainVal = 0.05) {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    const bufSize = Math.floor(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    src.connect(gain);
    gain.connect(this.ctx.destination);
    gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    src.start();
  }

  playHit() {
    this._noise(0.08, 0.15);
    this._tone(120, 0.1, 'sawtooth', 0.08);
  }

  playShoot() {
    this._noise(0.05, 0.2);
    this._tone(300, 0.05, 'sawtooth', 0.1);
    this._tone(150, 0.1, 'square', 0.05, -100);
  }

  playHack() {
    this._tone(800, 0.05, 'square', 0.06);
    this._tone(600, 0.08, 'square', 0.05);
    this._tone(1000, 0.1, 'sine', 0.07);
  }

  playPickup() {
    this._tone(440, 0.05, 'sine', 0.08);
    this._tone(660, 0.07, 'sine', 0.06);
  }

  playDeath() {
    this._tone(200, 0.3, 'sawtooth', 0.1);
    this._tone(100, 0.5, 'square', 0.08);
    this._noise(0.4, 0.15);
  }

  playStep() {
    this._tone(80, 0.05, 'square', 0.02, rand(-20, 20));
  }

  playLevelUp() {
    this._tone(440, 0.1, 'sine', 0.1);
    this._tone(550, 0.1, 'sine', 0.1);
    this._tone(660, 0.2, 'sine', 0.12);
  }

  playStairs() {
    this._tone(300, 0.1, 'sawtooth', 0.05);
    this._tone(250, 0.15, 'sawtooth', 0.07);
  }

  playEnemyDie() {
    this._noise(0.15, 0.2);
    this._tone(150, 0.2, 'sawtooth', 0.1);
  }
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
