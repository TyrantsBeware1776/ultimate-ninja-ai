
export type TransitionType = 'none' | 'fade' | 'wipe';

export interface Clip {
  id: string;
  type: 'video' | 'image' | 'audio';
  src: string; // URL or Base64
  name: string;
  start: number; // Start time in timeline (seconds)
  duration: number; // Duration in seconds (timeline duration)
  offset: number; // Offset into the source media (seconds)
  trackId: string;
  thumbnail?: string;
  speed: number; // Playback rate (1.0 is normal)
  // Visual properties
  x?: number;
  y?: number;
  scale?: number;
  zIndex?: number;
  crop?: {
    top: number;    // 0-1 percentage
    bottom: number; // 0-1 percentage
    left: number;   // 0-1 percentage
    right: number;  // 0-1 percentage
  };
  transition?: {
    inType: TransitionType;
    inDuration: number;
    outType: TransitionType;
    outDuration: number;
  };
}

export interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio';
  isMuted: boolean;
  isHidden: boolean;
}

export interface ProjectState {
  tracks: Track[];
  clips: Clip[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  selectedClipId: string | null;
  zoom: number; // Pixels per second
}

export enum AppView {
  EDITOR = 'EDITOR',
  SKIT_GENERATOR = 'SKIT_GENERATOR',
}

export interface VoiceConfig {
  id: string;
  name: string;
  geminiVoiceName: string; // 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'
}

export const AVAILABLE_VOICES: VoiceConfig[] = [
  // Standard Gemini Voices
  { id: 'v1', name: 'Kore (Female, Soothing)', geminiVoiceName: 'Kore' },
  { id: 'v2', name: 'Fenrir (Male, Deep)', geminiVoiceName: 'Fenrir' },
  { id: 'v3', name: 'Puck (Male, Playful)', geminiVoiceName: 'Puck' },
  { id: 'v4', name: 'Charon (Male, Authoritative)', geminiVoiceName: 'Charon' },
  { id: 'v5', name: 'Zephyr (Female, Calm)', geminiVoiceName: 'Zephyr' },
  
  // Extended Character Voices (Mapped to Gemini engines for variety)
  { id: 'v6', name: 'Adam (Deep Narration)', geminiVoiceName: 'Fenrir' },
  { id: 'v7', name: 'Bella (Soft & Sweet)', geminiVoiceName: 'Zephyr' },
  { id: 'v8', name: 'Antoni (Balanced)', geminiVoiceName: 'Charon' },
  { id: 'v9', name: 'Josh (Young & Energetic)', geminiVoiceName: 'Puck' },
  { id: 'v10', name: 'Rachel (Clear Professional)', geminiVoiceName: 'Kore' },
  { id: 'v11', name: 'Domi (Strong Female)', geminiVoiceName: 'Kore' },
  { id: 'v12', name: 'Elli (Emotional)', geminiVoiceName: 'Zephyr' },
  { id: 'v13', name: 'Sam (Raspy)', geminiVoiceName: 'Fenrir' },
  { id: 'v14', name: 'News Anchor (Authoritative)', geminiVoiceName: 'Charon' },
  { id: 'v15', name: 'Storyteller (Vivid)', geminiVoiceName: 'Puck' },
];
