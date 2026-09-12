// In-App Voice Guidance Engine for BearDrive Navigation
// Uses native Web Speech API (window.speechSynthesis) for Spanish voice prompts

class NavVoiceService {
  constructor() {
    this.muted = typeof window !== "undefined" && localStorage.getItem("bear_nav_muted") === "true";
    this.lastSpokenKey = "";
    this.lastSpokenTime = 0;
    this.cachedVoice = null;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const loadVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        this.cachedVoice =
          voices.find((v) => v.lang.startsWith("es-AR")) ||
          voices.find((v) => v.lang.startsWith("es-ES")) ||
          voices.find((v) => v.lang.startsWith("es")) ||
          null;
      };
      loadVoice();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoice;
      }
    }
  }

  isMuted() {
    return this.muted;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("bear_nav_muted", String(this.muted));
        if (this.muted && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
      }
    } catch {
      // ignore
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  speak(text, priority = false) {
    if (this.muted || typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const cleanText = (text || "").trim();
    if (!cleanText) return;

    const now = Date.now();
    // Prevent repeating the identical phrase within 6 seconds unless marked priority
    if (!priority && cleanText === this.lastSpokenKey && now - this.lastSpokenTime < 6000) {
      return;
    }

    try {
      window.speechSynthesis.cancel(); // cancel pending speech so fresh guidance plays immediately
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = "es-AR";
      utterance.rate = 1.05; // natural swift pace
      utterance.pitch = 1.0;

      // Select cached or active Spanish voice
      const esVoice =
        this.cachedVoice ||
        (() => {
          const voices = window.speechSynthesis.getVoices();
          return (
            voices.find((v) => v.lang.startsWith("es-AR")) ||
            voices.find((v) => v.lang.startsWith("es-ES")) ||
            voices.find((v) => v.lang.startsWith("es")) ||
            null
          );
        })();

      if (esVoice) {
        utterance.voice = esVoice;
      }

      window.speechSynthesis.speak(utterance);
      this.lastSpokenKey = cleanText;
      this.lastSpokenTime = now;
    } catch {
      // ignore synthesis errors silently
    }
  }

  // Generate appropriate vocal announcement based on maneuver and meters remaining
  announceManeuver(instruction, distanceMeters, isUrgent = false) {
    if (this.muted || !instruction) return;

    // Approaching turn closely (< 60m)
    if (isUrgent && distanceMeters <= 60) {
      this.speak(instruction, true);
      return;
    }

    // Mid-range anticipation (150m - 250m)
    if (distanceMeters >= 120 && distanceMeters <= 260) {
      const distText = distanceMeters < 200 ? "En ciento cincuenta metros" : "En doscientos metros";
      this.speak(`${distText}, ${instruction.toLowerCase()}`);
    }
  }

  announceArrival(isPickup = true) {
    this.speak(
      isPickup
        ? "Has llegado al punto de encuentro con el pasajero."
        : "Has llegado al destino final.",
      true
    );
  }
}

export const navVoice = new NavVoiceService();
export default navVoice;
