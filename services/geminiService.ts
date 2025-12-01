
import { GoogleGenAI, Modality } from "@google/genai";

async function resolveApiKey(): Promise<string> {
  // Prefer runtime-selected key via AI Studio helper if available
  if (typeof window !== "undefined" && (window as any).aistudio?.hasSelectedApiKey) {
    // @ts-ignore
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey && (window as any).aistudio?.openSelectKey) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
    }
    // @ts-ignore
    const selectedKey = await window.aistudio.getSelectedApiKey?.();
    if (selectedKey) return selectedKey;
  }

  // Local storage fallback (runtime-provided to avoid bundling secrets)
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("gemini_api_key");
    if (stored) return stored;
  }

  // Env fallback (will be bundled if set; prefer runtime sources above)
  const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!envKey) throw new Error("Missing Gemini API key. Provide one via AI Studio key picker or localStorage.");
  return envKey;
}

// Helper to decode base64 audio
export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Manual PCM Decoder for raw audio streams (Gemini output)
// Browsers cannot natively decode raw PCM without headers using decodeAudioData
export async function decodePcmToAudioBuffer(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  // Ensure 16-bit alignment
  if (data.byteLength % 2 !== 0) {
      const newData = new Uint8Array(data.byteLength + 1);
      newData.set(data);
      data = newData;
  }

  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const generateSkitScript = async (
  prompt: string,
  characters: { name: string; voice: string; personality?: string }[]
): Promise<string> => {
  const apiKey = await resolveApiKey();
  const ai = new GoogleGenAI({ apiKey });
  
  const charDescription = characters.map(c => 
    c.personality ? `${c.name} (Personality: ${c.personality})` : c.name
  ).join(", ");

  const systemInstruction = `You are a creative screenwriter. Write a short dialogue skit between the following characters: ${charDescription}. 
  Ensure each character speaks according to their defined personality.
  Format the output exactly as follows:
  CharacterName: "Line of dialogue"
  CharacterName: "Line of dialogue"
  Do not add scene descriptions or actions, only dialogue. Keep it under 100 words total.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    config: {
      systemInstruction,
    },
  });

  return response.text || "";
};

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  const apiKey = await resolveApiKey();
  const ai = new GoogleGenAI({ apiKey });
  
  // Convert blob to base64
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onloadend = async () => {
      const base64data = (reader.result as string).split(',')[1];
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-audio',
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: audioBlob.type,
                    data: base64data
                  }
                },
                { text: "Transcribe the speech in this audio exactly." }
              ]
            }
          ]
        });
        resolve(response.text || "");
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });
};

export const generateMultiSpeakerAudio = async (
  script: string,
  characterMap: Record<string, string> // Character Name -> Gemini Voice Name
): Promise<string | null> => {
  const apiKey = await resolveApiKey();
  const ai = new GoogleGenAI({ apiKey });

  // Construct speaker config
  const speakerVoiceConfigs = Object.entries(characterMap).map(([name, voiceName]) => ({
    speaker: name,
    voiceConfig: {
      prebuiltVoiceConfig: { voiceName },
    },
  }));

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: script }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        audioConfig: {
          audioEncoding: "LINEAR16",
          sampleRateHertz: 24000,
        },
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: speakerVoiceConfigs,
          },
        },
      },
    });

    const base64Audio = response.candidates
      ?.flatMap(c => c.content?.parts || [])
      .find(p => (p as any).inlineData?.data)?.inlineData?.data;
    if (!base64Audio) return null;

    return base64Audio; 
  } catch (e) {
    console.error("TTS Error", e);
    throw e;
  }
};

// Veo Video Generation
export const generateVideoFromImage = async (
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<string | null> => {
    // Check for Paid Key
    // @ts-ignore
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        // @ts-ignore
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
            // @ts-ignore
            await window.aistudio.openSelectKey();
            // Assume success after dialog
        }
    }

    // Must re-init client to pick up the selected key if it changed
    const apiKey = await resolveApiKey();
    const ai = new GoogleGenAI({ apiKey });

    try {
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt || "Animate this character speaking naturally",
            image: {
                imageBytes: imageBase64,
                mimeType,
            },
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: '16:9'
            }
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            const opName = (operation as any).name || operation;
            operation = await ai.operations.getVideosOperation({ operation: opName });
        }

        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!videoUri) return null;

        // Fetch the actual video bytes
        const videoRes = await fetch(videoUri, {
            headers: {
                "X-Goog-Api-Key": apiKey,
            }
        });
        const blob = await videoRes.blob();
        return URL.createObjectURL(blob);

    } catch (e) {
        console.error("Veo Error", e);
        // If entity not found (key issue), prompt again
        if (e instanceof Error && e.message.includes("Requested entity was not found")) {
             // @ts-ignore
             if (window.aistudio) await window.aistudio.openSelectKey();
        }
        throw e;
    }
}

// Helper to add WAV header to PCM data for easier playback in standard audio elements
export function pcmToWav(pcmData: Uint8Array, sampleRate: number = 24000) {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);

    const writeString = (view: DataView, offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmData.length, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, pcmData.length, true);

    const wavBlob = new Blob([wavHeader, pcmData], { type: 'audio/wav' });
    return URL.createObjectURL(wavBlob);
}
