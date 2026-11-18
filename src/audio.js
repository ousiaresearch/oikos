// Opt-In Procedural Web Audio Chime Engine for Oikos.
// Muted by default and safe no-op in headless Node test environments.

class OikosSoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = true;
  }

  init() {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume?.().catch?.(() => {});
    }
    return this.ctx;
  }

  setMuted(val) {
    this.muted = Boolean(val);
    return this.muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (!this.muted) this.playClick();
    return this.muted;
  }

  playTone(freq, duration = 0.08, type = 'triangle', volume = 0.045, slideTo = null, delay = 0) {
    if (this.muted) return;
    const ctx = this.init();
    if (!ctx) return;

    try {
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
      }
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Audio playback is optional enhancement
    }
  }

  playClick() {
    this.playTone(540, 0.04, 'triangle', 0.035, 680, 0);
  }

  playDoor(entering = true) {
    if (entering) {
      this.playTone(280, 0.07, 'triangle', 0.05, 380, 0);
      this.playTone(420, 0.11, 'triangle', 0.05, 560, 0.07);
    } else {
      this.playTone(520, 0.07, 'triangle', 0.05, 390, 0);
      this.playTone(350, 0.11, 'triangle', 0.05, 250, 0.07);
    }
  }

  playArrival() {
    this.playTone(587.33, 0.07, 'sine', 0.04, null, 0);
    this.playTone(880, 0.12, 'sine', 0.04, null, 0.07);
  }

  playSocial() {
    this.playTone(523.25, 0.06, 'sine', 0.04, null, 0);
    this.playTone(659.25, 0.08, 'sine', 0.04, null, 0.06);
    this.playTone(783.99, 0.1, 'sine', 0.035, null, 0.13);
  }

  playUnlock() {
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((n, idx) => this.playTone(n, 0.12, 'triangle', 0.045, null, idx * 0.06));
  }

  playCraft() {
    this.playTone(587.33, 0.06, 'triangle', 0.04, null, 0);
    this.playTone(783.99, 0.07, 'triangle', 0.04, null, 0.06);
    this.playTone(1174.66, 0.11, 'triangle', 0.045, null, 0.12);
  }

  playGathering() {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((n, idx) => this.playTone(n, 0.10, 'sine', 0.04, null, idx * 0.055));
  }

  playWeatherShift(mode = 'clear') {
    if (mode === 'rain') {
      this.playTone(320, 0.18, 'sine', 0.03, 240, 0);
    } else {
      this.playTone(480, 0.15, 'sine', 0.03, 620, 0);
    }
  }

  playProjectContribute() {
    const notes = [523.25, 659.25, 987.77];
    notes.forEach((n, idx) => this.playTone(n, 0.1, 'triangle', 0.04, null, idx * 0.06));
  }

  playChatReply() {
    this.playTone(660, 0.06, 'sine', 0.035, null, 0);
    this.playTone(825, 0.09, 'sine', 0.035, null, 0.06);
  }
}

export const sound = new OikosSoundEngine();
