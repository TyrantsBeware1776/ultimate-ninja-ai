// ===============================
//   voiceRegistry.ts (FULL FILE)
// ===============================

export type VoiceProfile = {
  id: string;
  name: string;
  model: string;
  description: string;
};

/**
 * 🎤 MASTER VOICE REGISTRY
 * Add as many characters as you want.
 * Each voice has:
 *  - id  (used in scripts like ATHENA:, ALPHA:, etc.)
 *  - name  (display name)
 *  - model (Gemini voice model or custom model name)
 *  - description (explains the tone)
 */

export const VOICES: Record<string, VoiceProfile> = {
  ATHENA: {
    id: "ATHENA",
    name: "Athena (Calm Investigator)",
    model: "models/athena-natural",
    description: "Analytical, steady, serious tone perfect for investigative narration."
  },

  ALPHA: {
    id: "ALPHA",
    name: "Alpha (Strategic Analyst)",
    model: "models/alpha-deepclarity",
    description: "Strong, confident, focused tone with leadership presence."
  },

  TYRANTS_BEWARE: {
    id: "TYRANTS_BEWARE",
    name: "Tyrants Beware (Narrator)",
    model: "models/tyrantsbeware-commanding",
    description: "Deep, steady, patriotic tone with emotional punch."
  },
};

/**
 * Returns a voice model name by character ID.
 * Falls back to a default if a model is missing.
 */
export const getVoiceModel = (id: string): string => {
  return VOICES[id]?.model || "models/default-voice";
};
