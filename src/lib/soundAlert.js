// In-App Acoustic Alert Engine for BearDrive Ride Requests
// Uses native Web Audio API to produce pleasant, high-fidelity chimes
// without external audio file dependencies or network latency.

class SoundAlertService {
  constructor() {
    this.ctx = null;
    this.intervalId = null;
    this.isPlaying = false;
  }

  getAudioContext() {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Play a single harmonic double-tone chime (E5 -> A5)
  playChime() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Tone 1: E5 (659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, now);

      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.16);

      // Tone 2: A5 (880.00 Hz) - Higher and resonant
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880.0, now + 0.12);

      gain2.gain.setValueAtTime(0.001, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.4, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(now + 0.12);
      osc2.stop(now + 0.5);

      // Trigger synchronized haptic pulse on mobile devices
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([120, 80, 160]);
      }
    } catch {
      // Ignore audio synthesis errors on locked browsers
    }
  }

  // Start continuous repeating alert every intervalMs (default 1800ms)
  startIncomingAlert(intervalMs = 1800) {
    if (this.isPlaying) return;
    this.isPlaying = true;

    // Play initial tone immediately
    this.playChime();

    this.intervalId = setInterval(() => {
      this.playChime();
    }, intervalMs);
  }

  // Stop repeating alert immediately
  stopIncomingAlert() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const soundAlert = new SoundAlertService();
export default soundAlert;
