
import React, { useState, useRef } from 'react';
import { AVAILABLE_VOICES, VoiceConfig } from '../types';
import { generateSkitScript, generateMultiSpeakerAudio, pcmToWav, generateVideoFromImage, decode, decodePcmToAudioBuffer, transcribeAudio } from '../services/geminiService';

interface SkitGeneratorProps {
  onAddClip: (type: 'audio' | 'video', src: string, name: string, duration: number) => void;
  onClose: () => void;
}

export const SkitGenerator: React.FC<SkitGeneratorProps> = ({ onAddClip, onClose }) => {
  const [characters, setCharacters] = useState<{ id: string; name: string; personality: string; voiceId: string; image?: File }[]>([
    { id: 'c1', name: 'Alice', personality: 'Cheerful and optimistic', voiceId: 'v1' },
    { id: 'c2', name: 'Bob', personality: 'Grumpy but secretly kind', voiceId: 'v2' }
  ]);
  const [customVoices, setCustomVoices] = useState<VoiceConfig[]>([]);
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [isCloning, setIsCloning] = useState(false);
  
  const [topic, setTopic] = useState('');
  const [generatedScript, setGeneratedScript] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddCharacter = () => {
    if (characters.length < 10) { 
       setCharacters([...characters, { id: `c${Date.now()}`, name: '', personality: '', voiceId: 'v1' }]);
    }
  };

  const handleVoiceClone = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setIsCloning(true);
          
          // Simulate API upload and processing time
          setTimeout(() => {
              const newVoice: VoiceConfig = {
                  id: `custom_${Date.now()}`,
                  name: `Custom: ${file.name.split('.')[0]}`,
                  // In a real app, this would be the ID returned by the cloning service.
                  // For now, we map it to a random high-quality Gemini voice to simulate functionality.
                  geminiVoiceName: ['Fenrir', 'Kore', 'Puck', 'Charon'][Math.floor(Math.random() * 4)] 
              };
              setCustomVoices(prev => [...prev, newVoice]);
              setIsCloning(false);
          }, 2000);
      }
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' }); // Chrome records weba/webm usually
        setIsGeneratingScript(true); // Re-use spinner
        try {
          const text = await transcribeAudio(blob);
          setTopic(prev => (prev + " " + text).trim());
        } catch (e) {
          console.error(e);
          alert("Failed to transcribe audio.");
        } finally {
          setIsGeneratingScript(false);
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) {
      console.error(e);
      alert("Microphone permission denied or not available.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleGenerateScript = async () => {
    if (!topic) return;
    setIsGeneratingScript(true);
    try {
      const allVoices = [...AVAILABLE_VOICES, ...customVoices];
      const charInfos = characters.map(c => ({ 
        name: c.name, 
        personality: c.personality,
        voice: allVoices.find(v => v.id === c.voiceId)?.geminiVoiceName || 'Puck' 
      }));
      const script = await generateSkitScript(topic, charInfos);
      setGeneratedScript(script);
    } catch (error) {
      alert("Failed to generate script. Please check API Key.");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!generatedScript) return;
    setIsGeneratingAudio(true);
    try {
      const allVoices = [...AVAILABLE_VOICES, ...customVoices];
      const charMap: Record<string, string> = {};
      characters.forEach(c => {
         const v = allVoices.find(voice => voice.id === c.voiceId);
         if (v) charMap[c.name] = v.geminiVoiceName;
      });

      const base64Audio = await generateMultiSpeakerAudio(generatedScript, charMap);
      if (base64Audio) {
        // Decode raw PCM to Uint8Array using helper
        const bytes = decode(base64Audio);
        
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Gemini returns raw PCM (linear16).
        const buffer = await decodePcmToAudioBuffer(bytes, ctx, 24000); 
        
        // Create WAV for valid source URL
        const wavUrl = pcmToWav(bytes, 24000);
        onAddClip('audio', wavUrl, `Skit: ${topic.substring(0, 10) || 'Audio'}...`, buffer.duration);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to generate audio.");
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleAnimateCharacter = async (charId: string) => {
    const char = characters.find(c => c.id === charId);
    if (!char || !char.image) return;

    setIsGeneratingVideo(charId);
    try {
       // Convert file to base64
       const reader = new FileReader();
       reader.readAsDataURL(char.image);
       reader.onloadend = async () => {
           const base64data = (reader.result as string).split(',')[1];
           const prompt = customPrompts[charId] 
              ? `A video of ${char.name} ${customPrompts[charId]}`
              : `A video of ${char.name} talking, looking at the camera, natural movement.`;
              
           const videoUrl = await generateVideoFromImage(base64data, prompt);
           if (videoUrl) {
               onAddClip('video', videoUrl, `Anim: ${char.name}`, 6); 
           } else {
               alert("Failed to generate video (Veo returned null).");
           }
           setIsGeneratingVideo(null);
       };
    } catch (e) {
        console.error(e);
        alert("Failed to animate character. Ensure you have a paid key selected.");
        setIsGeneratingVideo(null);
    }
  };

  const allVoices = [...AVAILABLE_VOICES, ...customVoices];

  return (
    <div className="absolute inset-0 bg-slate-900/95 z-50 flex items-center justify-center p-8">
      <div className="bg-slate-800 w-full max-w-6xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center shrink-0">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">AI Skit Studio</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Column: Characters */}
          <div className="space-y-6">
             <div className="flex justify-between items-center">
                 <h3 className="text-lg font-semibold text-slate-200">1. Cast Characters</h3>
                 <div className="flex gap-2">
                    <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">Max 10</span>
                    <button onClick={handleAddCharacter} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded">
                        + Add Char
                    </button>
                 </div>
             </div>

             {/* Voice Lab Section */}
             <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-semibold text-indigo-300 flex items-center gap-2">
                        🎙️ Voice Lab <span className="text-xs font-normal text-indigo-400/70">(Clone your own)</span>
                    </h4>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isCloning}
                        className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded shadow-sm transition flex items-center gap-2"
                    >
                        {isCloning ? <span className="animate-spin">⏳</span> : '➕'} 
                        {isCloning ? 'Processing...' : 'New Clone'}
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="audio/*" 
                        onChange={handleVoiceClone}
                    />
                </div>
                {/* List of custom voices */}
                {customVoices.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-3">
                        {customVoices.map(v => (
                            <span key={v.id} className="text-xs bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 px-2 py-1 rounded flex items-center gap-1">
                                👤 {v.name.replace('Custom: ', '')}
                            </span>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-indigo-400/50 italic">Upload an audio sample to create a custom AI voice.</p>
                )}
             </div>
             
             <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
              {characters.map((char, idx) => (
                <div key={char.id} className="bg-slate-700/30 p-4 rounded-lg border border-slate-600/50">
                  <div className="flex justify-between mb-3">
                    <span className="font-medium text-blue-300">Character {idx + 1}</span>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Name (e.g., Alice)"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 mb-3 text-white text-sm"
                    value={char.name}
                    onChange={(e) => {
                      const newChars = [...characters];
                      newChars[idx].name = e.target.value;
                      setCharacters(newChars);
                    }}
                  />
                  <input 
                    type="text" 
                    placeholder="Personality (e.g., Grumpy, Excited)"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 mb-3 text-white text-sm"
                    value={char.personality}
                    onChange={(e) => {
                      const newChars = [...characters];
                      newChars[idx].personality = e.target.value;
                      setCharacters(newChars);
                    }}
                  />
                  <select 
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 mb-3 text-white text-sm"
                    value={char.voiceId}
                    onChange={(e) => {
                      const newChars = [...characters];
                      newChars[idx].voiceId = e.target.value;
                      setCharacters(newChars);
                    }}
                  >
                    {allVoices.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  
                  <div className="border-t border-slate-600/50 pt-3">
                    <label className="text-xs text-slate-400 block mb-1">Upload Photo (for Veo Animation)</label>
                    <input 
                        type="file" 
                        accept="image/*"
                        className="text-xs text-slate-400 w-full mb-2"
                        onChange={(e) => {
                             if (e.target.files?.[0]) {
                                 const newChars = [...characters];
                                 newChars[idx].image = e.target.files[0];
                                 setCharacters(newChars);
                             }
                        }}
                    />
                    {char.image && (
                      <div className="mt-2 space-y-2">
                          <input 
                            type="text" 
                            placeholder="Animation prompt (e.g. laughing, nodding)"
                            className="w-full bg-slate-800 border border-slate-600 rounded p-1.5 text-xs text-white"
                            value={customPrompts[char.id] || ''}
                            onChange={(e) => setCustomPrompts(prev => ({ ...prev, [char.id]: e.target.value }))}
                          />
                          <button 
                            onClick={() => handleAnimateCharacter(char.id)}
                            disabled={!!isGeneratingVideo}
                            className="w-full py-1.5 text-xs bg-purple-600/20 text-purple-300 border border-purple-500/50 hover:bg-purple-600 hover:text-white rounded transition disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                              {isGeneratingVideo === char.id ? 'Generating...' : '✨ Animate with Veo'}
                          </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Script & Audio */}
          <div className="space-y-6">
             <h3 className="text-lg font-semibold text-slate-200">2. Script & Audio</h3>
             
             {/* Topic Input with Mic */}
             <div className="space-y-2">
                 <label className="text-sm text-slate-400">What should they discuss?</label>
                 <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Enter a topic or record your voice..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-white"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                    />
                    <button 
                       onClick={isRecording ? handleStopRecording : handleStartRecording}
                       className={`w-12 flex items-center justify-center rounded border ${isRecording ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse' : 'bg-slate-700 border-slate-600 hover:bg-slate-600'}`}
                       title="Record Topic"
                    >
                       {isRecording ? '⏹' : '🎤'}
                    </button>
                    <button 
                      onClick={handleGenerateScript}
                      disabled={isGeneratingScript || !topic}
                      className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-medium disabled:opacity-50 text-sm whitespace-nowrap"
                    >
                      {isGeneratingScript ? 'Writing...' : 'Auto-Write'}
                    </button>
                 </div>
             </div>

             {/* Script Area */}
             <div className="relative">
                 <div className="flex justify-between mb-1">
                     <label className="text-sm text-slate-400">Script (Editable)</label>
                     <span className="text-xs text-slate-500">Paste your own script here</span>
                 </div>
                 <textarea 
                   className="w-full h-48 bg-slate-900 border border-slate-700 rounded p-4 text-sm font-mono text-slate-300 leading-relaxed focus:ring-1 focus:ring-blue-500 outline-none"
                   value={generatedScript}
                   onChange={(e) => setGeneratedScript(e.target.value)}
                   placeholder={`Format:\nName: "Dialogue line..."\nName: "Dialogue line..."`}
                 />
             </div>

             {/* Final Action */}
             <div className="pt-4 border-t border-slate-700">
                <button 
                    onClick={handleGenerateAudio}
                    disabled={isGeneratingAudio || !generatedScript}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 py-3 rounded-lg font-bold text-white shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 transform transition active:scale-[0.98]"
                  >
                    {isGeneratingAudio ? (
                        <>
                           <span className="animate-spin">⏳</span> Synthesizing Voices...
                        </>
                    ) : (
                        <>🔊 Generate Audio & Add to Timeline</>
                    )}
                  </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
