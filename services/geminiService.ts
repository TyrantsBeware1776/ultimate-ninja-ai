import { GoogleGenAI, Modality } from "@google/genai";
import { VOICES, getVoiceModel } from "./voiceRegistry";

/* -----------------------------------------------------------
   BASE64 DECODE → BYTES
----------------------------------------------------------- */
export function decode(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/* -----------------------------------------------------------
   PCM → WAV (Stable Output for Audio Elements)
----------------------------------------------------------- */
export function pcmToWav(pcmData: Uint8Array, sampleRate: number = 24000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;

  const wavHeader = new ArrayBuffer(44);
  const view = new DataView(wavHeader);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcmData.length, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, pcmData.length, true);

  return URL.createObjectURL(new Blob([wavHeader, pcmData], { type: "audio/wav" }));
}

/* -----------------------------------------------------------
   SCRIPT GENERATION
----------------------------------------------------------- */
export const generateSkitScript = async (
  prompt: string,
  characters: { name: string; voice: string; personality?: string }[]
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const charList = characters
    .map(c => `${c.name}${c.personality ? ` (Personality: ${c.personality})` : ""}`)
    .join(", ");

  const systemInstruction = `
You are a professional dialogue writer.
Write ONLY character dialogue — NO scene descriptions.
Format EXACTLY like:

Name: "line"
Name: "line"

Keep voices distinct and under 100 words total.
Characters included: ${charList}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { systemInstruction }
  });

  return response.text || "";
};

/* -----------------------------------------------------------
   AUDIO TRANSCRIPTION
----------------------------------------------------------- */
export const transcribeAudio = async (blob: Blob): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const base64 = await blobToBase64(blob);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [
        {
          inlineData: { mimeType: blob.type, data: base64 }
        },
        { text: "Transcribe the speech exactly as spoken." }
      ]
    }
  });

  return response.text || "";
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onloadend = () => {
      const base64 = (r.result as string).split(",")[1];
      res(base64);
    };
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

/* -----------------------------------------------------------
   MULTI-SPEAKER AI AUDIO (UNLIMITED CHARACTERS)
----------------------------------------------------------- */
export const generateMultiSpeakerAudio = async (
  script: string
): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Auto-detect speaker names from script
  const speakerNames: string[] = Array.from(
    script.matchAll(/^([A-Za-z0-9_ ]+):/gm)
  ).map(match => match[1].trim());

  // Build speaker voice config
  const speakerVoiceConfigs = speakerNames.map(name => ({
    speaker: name,
    voiceConfig: {
      prebuiltVoiceConfig: { voiceName: getVoiceModel(name) }
    }
  }));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: script }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs
          }
        }
      }
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) return null;

    return base64Audio;
  } catch (err) {
    console.error("Multi-speaker TTS error:", err);
    throw err;
  }
};

/* -----------------------------------------------------------
   VIDEO GENERATION (UNCHANGED)
----------------------------------------------------------- */
export const generateVideoFromImage = async (
  imageBase64: string,
  prompt: string
): Promise<string | null> => {
  if (window.aistudio?.hasSelectedApiKey) {
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) await window.aistudio.openSelectKey();
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    let operation = await ai.models.generateVideos({
      model: "veo-3.1-fast-generate-preview",
      prompt: prompt || "Animate this character speaking naturally",
      image: { imageBytes: imageBase64, mimeType: "image/png" },
      config: {
        numberOfVideos: 1,
        resolution: "720p",
        aspectRatio: "16:9"
      }
    });

    while (!operation.done) {
      await new Promise(r => setTimeout(r, 5000));
      operation = await ai.operations.getVideosOperation({ operation });
    }

    const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) return null;

    const fetched = await fetch(`${uri}&key=${process.env.API_KEY}`);
    return URL.createObjectURL(await fetched.blob());
  } catch (e) {
    console.error("Veo Error:", e);
    if (e instanceof Error && e.message.includes("Requested entity was not found")) {
      await window.aistudio?.openSelectKey();
    }
    throw e;
  }
};
