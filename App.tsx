
import React, { useState, useEffect, useRef } from 'react';
import { Timeline } from './components/Timeline';
import { SkitGenerator } from './components/SkitGenerator';
import { ProjectState, Clip, Track, AppView, TransitionType } from './types';

// Icons using SVG for no-dep simplicity
const PlayIcon = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>;
const PauseIcon = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;
const PlusIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
const ScissorsIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" /></svg>;
const TrashIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const CropIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4M6 16V4h10m4 12v-8m-8 12h8" /></svg>;
const ExportIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
const UndoIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>;
const RedoIcon = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>;
const RefreshIcon = () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
const TransitionIcon = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>;

const INITIAL_STATE: ProjectState = {
  tracks: [
    { id: 't1', name: 'Video 1', type: 'video', isMuted: false, isHidden: false },
    { id: 't2', name: 'Video 2', type: 'video', isMuted: false, isHidden: false },
    { id: 't3', name: 'Audio 1', type: 'audio', isMuted: false, isHidden: false },
  ],
  clips: [],
  currentTime: 0,
  duration: 60, 
  isPlaying: false,
  selectedClipId: null,
  zoom: 50,
};

function App() {
  const [state, setState] = useState<ProjectState>(INITIAL_STATE);
  const [history, setHistory] = useState<{ past: ProjectState[], future: ProjectState[] }>({ past: [], future: [] });
  const [view, setView] = useState<AppView>(AppView.EDITOR);
  const [isExporting, setIsExporting] = useState(false);
  
  // Audio Refs for playback
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const activeSourcesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
  const audioBufferCache = useRef<Map<string, AudioBuffer>>(new Map());
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const startTimeRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  // Canvas Interaction State
  const [canvasDrag, setCanvasDrag] = useState<{ startX: number, startY: number, initialClipX: number, initialClipY: number } | null>(null);

  // Initialize AudioContext
  useEffect(() => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const master = ctx.createGain();
    master.connect(ctx.destination);
    masterGainRef.current = master;
    audioContextRef.current = ctx;
    return () => {
      ctx.close();
    };
  }, []);

  // --- HISTORY MANAGEMENT ---
  const pushHistory = () => {
    setHistory(curr => ({
      past: [...curr.past, state],
      future: []
    }));
  };

  const undo = () => {
    if (history.past.length === 0) return;
    const previous = history.past[history.past.length - 1];
    const newPast = history.past.slice(0, -1);
    
    // Stop playback if playing
    if (state.isPlaying) stopPlayback();

    setHistory({
      past: newPast,
      future: [state, ...history.future]
    });
    setState(previous);
    setTimeout(() => drawCanvas(previous.currentTime), 10);
  };

  const redo = () => {
    if (history.future.length === 0) return;
    const next = history.future[0];
    const newFuture = history.future.slice(1);

    if (state.isPlaying) stopPlayback();

    setHistory({
      past: [...history.past, state],
      future: newFuture
    });
    setState(next);
    setTimeout(() => drawCanvas(next.currentTime), 10);
  };

  const handlePlayPause = () => {
    if (state.isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  const startPlayback = () => {
    if (!audioContextRef.current || !masterGainRef.current) return;
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    setState(s => ({ ...s, isPlaying: true }));
    startTimeRef.current = performance.now() - (state.currentTime * 1000);
    
    // Schedule audio clips
    state.clips.filter(c => c.type === 'audio').forEach(async clip => {
      try {
        let audioBuffer = audioBufferCache.current.get(clip.src);
        
        if (!audioBuffer) {
             const response = await fetch(clip.src);
             const arrayBuffer = await response.arrayBuffer();
             audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);
             audioBufferCache.current.set(clip.src, audioBuffer);
        }
        
        const source = audioContextRef.current!.createBufferSource();
        source.buffer = audioBuffer;
        
        // Handle Playback Rate
        const playbackRate = clip.speed;
        source.playbackRate.value = playbackRate; 
        
        // Connect to Master Gain instead of Destination directly
        source.connect(masterGainRef.current!);
        
        const offset = clip.start - state.currentTime;
        const bufferPlayDuration = clip.duration * playbackRate;
        
        if (offset >= 0) {
           source.start(audioContextRef.current!.currentTime + offset, clip.offset, bufferPlayDuration);
        } else if (offset < 0) {
           const timeIntoClip = Math.abs(offset);
           if (timeIntoClip < clip.duration) {
                const bufferOffset = clip.offset + (timeIntoClip * playbackRate);
                const durationRemaining = (clip.duration - timeIntoClip) * playbackRate; 
                if (durationRemaining > 0) {
                  source.start(audioContextRef.current!.currentTime, bufferOffset, durationRemaining);
                }
           }
        }
        activeSourcesRef.current.set(clip.id, source);
        source.onended = () => activeSourcesRef.current.delete(clip.id);
      } catch (e) {
        console.error("Error playing audio clip", e);
      }
    });

    requestRef.current = requestAnimationFrame(animate);
  };

  const stopPlayback = () => {
    setState(s => ({ ...s, isPlaying: false }));
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    activeSourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    activeSourcesRef.current.clear();
  };

  const animate = (time: number) => {
    const nextTime = (time - startTimeRef.current) / 1000;
    
    if (nextTime >= state.duration) {
      if (isExporting && mediaRecorderRef.current?.state === 'recording') {
         mediaRecorderRef.current.stop();
      }
      stopPlayback();
      setState(s => ({ ...s, currentTime: 0 }));
      return;
    }

    setState(s => ({ ...s, currentTime: nextTime }));
    drawCanvas(nextTime);
    requestRef.current = requestAnimationFrame(animate);
  };

  const handleExport = async () => {
    if (state.clips.length === 0) return;
    if (state.isPlaying) stopPlayback();
    
    setState(s => ({ ...s, currentTime: 0 }));
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const ctx = audioContextRef.current;
    if (!ctx || !masterGainRef.current) return;
    
    const audioDest = ctx.createMediaStreamDestination();
    masterGainRef.current.connect(audioDest);
    
    if (!canvasRef.current) return;
    const canvasStream = canvasRef.current.captureStream(60);
    
    const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDest.stream.getAudioTracks()
    ]);
    
    const recorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9'
    });
    
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };
    
    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ninja-edit-${Date.now()}.webm`;
        a.click();
        
        masterGainRef.current?.disconnect(audioDest);
        setIsExporting(false);
    };
    
    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsExporting(true);
    startPlayback();
  };

  const drawCanvas = (time: number) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current) return;

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    const visibleClips = state.clips
      .filter(c => (c.type === 'video' || c.type === 'image') && time >= c.start && time < (c.start + c.duration))
      .sort((a, b) => {
          const trackIdxA = state.tracks.findIndex(t => t.id === a.trackId);
          const trackIdxB = state.tracks.findIndex(t => t.id === b.trackId);
          return trackIdxA - trackIdxB; 
      });

    visibleClips.forEach(clip => {
       const elementId = `media-${clip.id}`;
       let el = document.getElementById(elementId) as HTMLImageElement | HTMLVideoElement;
       
       if (!el) return;
       
       ctx.save();

       if (clip.type === 'video') {
         const videoEl = el as HTMLVideoElement;
         const timeElapsedInClip = time - clip.start;
         const videoTime = clip.offset + (timeElapsedInClip * clip.speed);
         
         const drift = Math.abs(videoEl.currentTime - videoTime);
         const tolerance = clip.speed !== 1 ? 0.05 : 0.3;
         if (drift > tolerance) {
             videoEl.currentTime = videoTime;
         }
       }

       const scale = clip.scale ?? 1;
       const x = clip.x ?? 0;
       const y = clip.y ?? 0;
       
       const cWidth = canvasRef.current!.width;
       const cHeight = canvasRef.current!.height;
       const drawWidth = cWidth * scale;
       const drawHeight = cHeight * scale;
       const drawX = (cWidth - drawWidth) / 2 + x;
       const drawY = (cHeight - drawHeight) / 2 + y;
       
       // Transition Logic
       let alpha = 1;
       let clipRegion = { x: drawX, y: drawY, w: drawWidth, h: drawHeight };

       const transition = clip.transition || { inType: 'none', inDuration: 0, outType: 'none', outDuration: 0 };
       const timeIn = time - clip.start;
       const timeOut = (clip.start + clip.duration) - time;

       // Entry
       if (transition.inType !== 'none' && timeIn < transition.inDuration) {
           const p = Math.max(0, Math.min(1, timeIn / transition.inDuration));
           if (transition.inType === 'fade') alpha *= p;
           if (transition.inType === 'wipe') clipRegion.w *= p;
       }

       // Exit
       if (transition.outType !== 'none' && timeOut < transition.outDuration) {
           const p = Math.max(0, Math.min(1, timeOut / transition.outDuration));
           if (transition.outType === 'fade') alpha *= p;
           if (transition.outType === 'wipe') clipRegion.w *= p;
       }

       ctx.globalAlpha = alpha;

       // Apply Wipe (Clip)
       if (transition.inType === 'wipe' || transition.outType === 'wipe') {
           ctx.beginPath();
           ctx.rect(clipRegion.x, clipRegion.y, clipRegion.w, clipRegion.h);
           ctx.clip();
       }

       const crop = clip.crop || { top: 0, bottom: 0, left: 0, right: 0 };
       const videoEl = el as HTMLVideoElement;
       const imgEl = el as HTMLImageElement;
       const naturalWidth = videoEl.videoWidth || imgEl.naturalWidth;
       const naturalHeight = videoEl.videoHeight || imgEl.naturalHeight;

       if (naturalWidth && naturalHeight) {
           const sX = naturalWidth * crop.left;
           const sY = naturalHeight * crop.top;
           const sW = naturalWidth * (1 - crop.left - crop.right);
           const sH = naturalHeight * (1 - crop.top - crop.bottom);
           
           if (sW > 0 && sH > 0) {
               ctx.drawImage(el, sX, sY, sW, sH, drawX, drawY, drawWidth, drawHeight);
           }
       } else {
           ctx.drawImage(el, drawX, drawY, drawWidth, drawHeight);
       }
       
       ctx.restore();
       
       // Draw Selection Box (Outside of restore/clip)
       if (state.selectedClipId === clip.id) {
           ctx.strokeStyle = '#3b82f6'; // Blue-500
           ctx.lineWidth = 4;
           ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);
           
           ctx.fillStyle = '#fff';
           const handleSize = 8;
           ctx.fillRect(drawX - handleSize/2, drawY - handleSize/2, handleSize, handleSize);
           ctx.fillRect(drawX + drawWidth - handleSize/2, drawY + drawHeight - handleSize/2, handleSize, handleSize);
       }
    });
  };

  // --- CANVAS INTERACTION ---
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;
      
      const visibleClips = state.clips
        .filter(c => (c.type === 'video' || c.type === 'image') && state.currentTime >= c.start && state.currentTime < (c.start + c.duration))
        .sort((a, b) => {
            const trackIdxA = state.tracks.findIndex(t => t.id === a.trackId);
            const trackIdxB = state.tracks.findIndex(t => t.id === b.trackId);
            return trackIdxB - trackIdxA; 
        });
        
      for (const clip of visibleClips) {
           const scale = clip.scale ?? 1;
           const x = clip.x ?? 0;
           const y = clip.y ?? 0;
           
           const cWidth = canvas.width;
           const cHeight = canvas.height;
           const drawWidth = cWidth * scale;
           const drawHeight = cHeight * scale;
           const drawX = (cWidth - drawWidth) / 2 + x;
           const drawY = (cHeight - drawHeight) / 2 + y;
           
           if (mouseX >= drawX && mouseX <= drawX + drawWidth && mouseY >= drawY && mouseY <= drawY + drawHeight) {
               pushHistory();
               setState(s => ({ ...s, selectedClipId: clip.id }));
               setCanvasDrag({ startX: mouseX, startY: mouseY, initialClipX: x, initialClipY: y });
               return;
           }
      }
      
      setState(s => ({ ...s, selectedClipId: null }));
  };
  
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
      if (!canvasDrag || !state.selectedClipId) return;
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;
      
      const deltaX = mouseX - canvasDrag.startX;
      const deltaY = mouseY - canvasDrag.startY;
      
      setState(s => ({
          ...s,
          clips: s.clips.map(c => c.id === s.selectedClipId ? { ...c, x: canvasDrag.initialClipX + deltaX, y: canvasDrag.initialClipY + deltaY } : c)
      }));
      
      setTimeout(() => drawCanvas(state.currentTime), 0);
  };
  
  const handleCanvasMouseUp = () => {
      setCanvasDrag(null);
  };

  const handleSeek = (time: number) => {
    const wasPlaying = state.isPlaying;
    if (wasPlaying) stopPlayback();
    
    setState(s => ({ ...s, currentTime: time }));
    setTimeout(() => {
        drawCanvas(time);
        if (wasPlaying) startPlayback();
    }, 50);
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea';

      if (e.code === 'Space' && !isInput) {
         e.preventDefault();
         state.isPlaying ? stopPlayback() : startPlayback();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, history]);

  // --- EDITING ACTIONS ---

  const handleSplit = () => {
    if (!state.selectedClipId) return;
    const clipIndex = state.clips.findIndex(c => c.id === state.selectedClipId);
    if (clipIndex === -1) return;
    
    pushHistory(); 

    const clip = state.clips[clipIndex];
    const time = state.currentTime;

    if (time > clip.start && time < clip.start + clip.duration) {
       const splitPoint = time - clip.start; 
       
       const firstHalf = {
           ...clip,
           duration: splitPoint, 
       };
       
       const secondHalf: Clip = {
           ...clip,
           id: `clip-${Date.now()}`,
           start: time,
           duration: clip.duration - splitPoint,
           offset: clip.offset + (splitPoint * clip.speed),
       };

       const newClips = [...state.clips];
       newClips[clipIndex] = firstHalf;
       newClips.push(secondHalf);
       
       setState(s => ({ ...s, clips: newClips, selectedClipId: secondHalf.id }));
    }
  };

  const handleDelete = () => {
      if (!state.selectedClipId) return;
      pushHistory(); 
      setState(s => ({
          ...s,
          clips: s.clips.filter(c => c.id !== s.selectedClipId),
          selectedClipId: null
      }));
  };

  const handleSpeedChange = (newSpeed: number) => {
      if (!state.selectedClipId) return;
      setState(s => ({
          ...s,
          clips: s.clips.map(c => c.id === s.selectedClipId ? { ...c, speed: newSpeed } : c)
      }));
  };

  const handleTransformChange = (prop: 'x' | 'y' | 'scale', value: number) => {
      if (!state.selectedClipId) return;
      setState(s => ({
          ...s,
          clips: s.clips.map(c => c.id === s.selectedClipId ? { ...c, [prop]: value } : c)
      }));
      setTimeout(() => drawCanvas(state.currentTime), 0);
  };
  
  const resetTransform = () => {
      if (!state.selectedClipId) return;
      pushHistory();
      setState(s => ({
          ...s,
          clips: s.clips.map(c => c.id === s.selectedClipId ? { ...c, x: 0, y: 0, scale: 1 } : c)
      }));
      setTimeout(() => drawCanvas(state.currentTime), 0);
  };
  
  const resetCrop = () => {
      if (!state.selectedClipId) return;
      pushHistory();
      setState(s => ({
          ...s,
          clips: s.clips.map(c => c.id === s.selectedClipId ? { ...c, crop: { top: 0, bottom: 0, left: 0, right: 0 } } : c)
      }));
      setTimeout(() => drawCanvas(state.currentTime), 0);
  };
  
  const resetTransition = () => {
      if (!state.selectedClipId) return;
      pushHistory();
      setState(s => ({
          ...s,
          clips: s.clips.map(c => c.id === s.selectedClipId ? { 
              ...c, 
              transition: { inType: 'none', inDuration: 0.5, outType: 'none', outDuration: 0.5 } 
          } : c)
      }));
      setTimeout(() => drawCanvas(state.currentTime), 0);
  }

  const handleCropChange = (side: 'left' | 'right' | 'top' | 'bottom', value: number) => {
      if (!state.selectedClipId) return;
      const clamped = Math.max(0, Math.min(0.9, value));
      
      setState(s => ({
          ...s,
          clips: s.clips.map(c => {
             if (c.id === s.selectedClipId) {
                 const currentCrop = c.crop || { top: 0, bottom: 0, left: 0, right: 0 };
                 return { ...c, crop: { ...currentCrop, [side]: clamped } };
             }
             return c;
          })
      }));
      setTimeout(() => drawCanvas(state.currentTime), 0);
  };

  const handleTransitionChange = (prop: 'inType' | 'inDuration' | 'outType' | 'outDuration', value: any) => {
      if (!state.selectedClipId) return;
      setState(s => ({
          ...s,
          clips: s.clips.map(c => {
              if (c.id === s.selectedClipId) {
                  const currentTrans = c.transition || { inType: 'none', inDuration: 0.5, outType: 'none', outDuration: 0.5 };
                  return { ...c, transition: { ...currentTrans, [prop]: value } };
              }
              return c;
          })
      }));
      setTimeout(() => drawCanvas(state.currentTime), 0);
  };

  const addClip = (type: 'audio' | 'video' | 'image', src: string, name: string, duration: number) => {
      pushHistory(); 
      const track = state.tracks.find(t => t.type === (type === 'audio' ? 'audio' : 'video'));
      if (!track) return;
      
      const newClip: Clip = {
          id: `clip-${Date.now()}`,
          type,
          src,
          name,
          start: state.currentTime,
          duration,
          offset: 0,
          trackId: track.id,
          speed: 1.0,
          scale: 1,
          x: 0,
          y: 0,
          crop: { top: 0, bottom: 0, left: 0, right: 0 },
          transition: { inType: 'none', inDuration: 0.5, outType: 'none', outDuration: 0.5 }
      };
      
      setState(s => ({
          ...s,
          clips: [...s.clips, newClip]
      }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const url = URL.createObjectURL(file);
          const type = file.type.startsWith('image') ? 'image' : (file.type.startsWith('audio') ? 'audio' : 'video');
          
          if (type === 'image') {
              addClip('image', url, file.name, 5);
          } else {
              const el = document.createElement(type === 'audio' ? 'audio' : 'video');
              el.src = url;
              el.onloadedmetadata = () => {
                  addClip(type as any, url, file.name, el.duration);
              };
          }
      }
  };

  const selectedClip = state.clips.find(c => c.id === state.selectedClipId);

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-200">
      {/* Hidden Media Elements */}
      <div className="hidden">
          {state.clips.map(clip => {
              if (clip.type === 'image') {
                  return <img key={clip.id} id={`media-${clip.id}`} src={clip.src} alt="resource" />;
              }
              if (clip.type === 'video') {
                  return <video key={clip.id} id={`media-${clip.id}`} src={clip.src} preload="auto" muted crossOrigin="anonymous" />;
              }
              return null;
          })}
      </div>

      {/* Header */}
      <header className="h-14 bg-slate-800 border-b border-slate-700 flex items-center px-4 justify-between shrink-0">
         <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg">V</div>
            <h1 className="font-bold text-lg tracking-tight">AI Video Forge</h1>
         </div>
         <div className="flex items-center gap-2">
             <button 
                onClick={undo}
                disabled={history.past.length === 0}
                className="p-2 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-700 transition"
                title="Undo (Ctrl+Z)"
             >
                 <UndoIcon />
             </button>
             <button 
                onClick={redo}
                disabled={history.future.length === 0}
                className="p-2 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-700 transition"
                title="Redo (Ctrl+Y)"
             >
                 <RedoIcon />
             </button>
             <div className="h-6 w-px bg-slate-700 mx-2"></div>
             <button 
                onClick={handleExport}
                disabled={isExporting}
                className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 shadow-sm transition disabled:opacity-50"
             >
                 <ExportIcon /> {isExporting ? 'Exporting...' : 'Export Video'}
             </button>
             <button 
                onClick={() => setView(AppView.SKIT_GENERATOR)}
                disabled={isExporting}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 shadow-md transition disabled:opacity-50"
             >
                 <span>✨</span> Create Skit
             </button>
         </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
         {/* Left Sidebar (Assets) */}
         <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col shrink-0 z-10">
             <div className="p-4 border-b border-slate-700">
                 <h2 className="font-semibold mb-2 text-slate-300">Library</h2>
                 <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-slate-600 rounded-lg hover:border-blue-500 hover:bg-slate-750 cursor-pointer transition group">
                     <div className="text-center group-hover:scale-105 transition">
                         <div className="flex justify-center mb-1 text-slate-400 group-hover:text-blue-400"><PlusIcon /></div>
                         <span className="text-xs text-slate-500 font-medium group-hover:text-blue-300">Import Media</span>
                     </div>
                     <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,video/*,audio/*" />
                 </label>
             </div>
             <div className="flex-1 overflow-y-auto p-2 space-y-2">
                 {state.clips.map(clip => (
                     <div 
                        key={clip.id} 
                        className={`flex items-center gap-3 p-2 rounded-lg text-sm cursor-pointer border border-transparent transition ${state.selectedClipId === clip.id ? 'bg-blue-900/40 border-blue-500/50' : 'bg-slate-700/50 hover:bg-slate-700'}`}
                        onClick={() => setState(s => ({...s, selectedClipId: clip.id}))}
                     >
                         <div className="w-10 h-10 bg-slate-900 rounded flex-shrink-0 overflow-hidden flex items-center justify-center border border-slate-600">
                             {clip.type === 'image' && <img src={clip.src} className="w-full h-full object-cover" />}
                             {clip.type === 'video' && <span className="text-lg">🎥</span>}
                             {clip.type === 'audio' && <span className="text-lg">🔊</span>}
                         </div>
                         <div className="flex-1 min-w-0">
                            <div className="truncate font-medium text-slate-300">{clip.name}</div>
                            <div className="text-xs text-slate-500">{clip.duration.toFixed(1)}s</div>
                         </div>
                     </div>
                 ))}
             </div>
         </div>

         {/* Center (Preview) */}
         <div className="flex-1 flex flex-col bg-black relative min-w-0">
             <div className="flex-1 flex items-center justify-center p-8 bg-zinc-950">
                 <canvas 
                    ref={canvasRef}
                    width={1280} 
                    height={720} 
                    className="max-w-full max-h-full aspect-video bg-black shadow-2xl ring-1 ring-slate-800 cursor-move"
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                 />
                 {isExporting && (
                     <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                         <div className="text-center">
                             <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                             <h3 className="text-xl font-bold text-white">Rendering Video...</h3>
                             <p className="text-slate-400 text-sm mt-2">Please wait while we record the timeline.</p>
                         </div>
                     </div>
                 )}
             </div>
             {/* Transport Controls */}
             <div className="h-14 bg-slate-800 border-t border-slate-700 flex items-center justify-center gap-6 shrink-0">
                 <button onClick={() => handleSeek(0)} disabled={isExporting} className="text-slate-400 hover:text-white transition disabled:opacity-50">⏮</button>
                 <button onClick={() => handleSeek(Math.max(0, state.currentTime - 5))} disabled={isExporting} className="text-slate-400 hover:text-white text-xs disabled:opacity-50">-5s</button>
                 <button 
                    onClick={handlePlayPause}
                    disabled={isExporting}
                    title="Play/Pause (Space)"
                    className="w-12 h-12 rounded-full bg-white text-slate-900 flex items-center justify-center hover:bg-slate-200 hover:scale-105 transition shadow-lg disabled:opacity-50 disabled:hover:scale-100"
                 >
                     {state.isPlaying ? <PauseIcon /> : <PlayIcon />}
                 </button>
                 <button onClick={() => handleSeek(Math.min(state.duration, state.currentTime + 5))} disabled={isExporting} className="text-slate-400 hover:text-white text-xs disabled:opacity-50">+5s</button>
                 <span className="text-sm font-mono text-slate-300 w-24 text-center">
                    {state.currentTime.toFixed(1)}s
                 </span>
             </div>
         </div>

         {/* Right Sidebar (Inspector) */}
         <div className="w-64 bg-slate-800 border-l border-slate-700 flex flex-col shrink-0 overflow-y-auto">
             <div className="p-4 border-b border-slate-700">
                 <h2 className="font-semibold mb-1 text-slate-300">Inspector</h2>
             </div>
             <div className="p-4">
             {selectedClip ? (
                 <div className="space-y-6">
                     <div>
                        <label className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2 block">Info</label>
                        <div className="text-sm font-medium text-slate-300 truncate">{selectedClip.name}</div>
                        <div className="text-xs text-slate-500 mt-1 capitalize">{selectedClip.type} Clip</div>
                     </div>
                     
                     {selectedClip.type !== 'audio' && (
                         <>
                         <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs text-slate-500 uppercase font-bold tracking-wider block">Transform</label>
                                <button onClick={resetTransform} title="Reset Transform" className="text-slate-500 hover:text-white"><RefreshIcon /></button>
                            </div>
                            <div className="space-y-3">
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-slate-400">Scale</span>
                                    <input 
                                        type="range" min="0.1" max="2" step="0.1" 
                                        value={selectedClip.scale ?? 1}
                                        onMouseDown={pushHistory}
                                        onChange={(e) => handleTransformChange('scale', parseFloat(e.target.value))}
                                        className="w-full accent-blue-500 h-1 bg-slate-600 rounded"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-slate-400">X Position</span>
                                        <input 
                                            type="number" className="bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white"
                                            value={selectedClip.x ?? 0}
                                            onFocus={pushHistory}
                                            onChange={(e) => handleTransformChange('x', parseInt(e.target.value))}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-slate-400">Y Position</span>
                                        <input 
                                            type="number" className="bg-slate-900 border border-slate-700 rounded p-1 text-xs text-white"
                                            value={selectedClip.y ?? 0}
                                            onFocus={pushHistory}
                                            onChange={(e) => handleTransformChange('y', parseInt(e.target.value))}
                                        />
                                    </div>
                                </div>
                            </div>
                         </div>
                         
                         <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs text-slate-500 uppercase font-bold tracking-wider block flex items-center gap-1"><CropIcon /> Crop</label>
                                <button onClick={resetCrop} title="Reset Crop" className="text-slate-500 hover:text-white"><RefreshIcon /></button>
                            </div>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                                {['top', 'bottom', 'left', 'right'].map((side) => (
                                    <div key={side} className="flex flex-col gap-1">
                                        <span className="text-xs text-slate-400 capitalize">{side}</span>
                                        <div className="flex items-center gap-1">
                                            <input 
                                                type="range" min="0" max="0.5" step="0.01"
                                                // @ts-ignore
                                                value={selectedClip.crop?.[side] || 0}
                                                onMouseDown={pushHistory}
                                                // @ts-ignore
                                                onChange={(e) => handleCropChange(side, parseFloat(e.target.value))}
                                                className="w-full accent-blue-500 h-1 bg-slate-600 rounded"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                         </div>
                         
                         <div>
                             <div className="flex justify-between items-center mb-2">
                                <label className="text-xs text-slate-500 uppercase font-bold tracking-wider block flex items-center gap-1"><TransitionIcon /> Transitions</label>
                                <button onClick={resetTransition} title="Reset Transition" className="text-slate-500 hover:text-white"><RefreshIcon /></button>
                             </div>
                             <div className="space-y-4">
                                 {/* Entry */}
                                 <div className="bg-slate-700/30 p-2 rounded">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-xs font-semibold text-blue-300">Entry</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <select 
                                            className="bg-slate-900 border border-slate-700 rounded text-xs p-1"
                                            value={selectedClip.transition?.inType || 'none'}
                                            onMouseDown={pushHistory}
                                            onChange={(e) => handleTransitionChange('inType', e.target.value)}
                                        >
                                            <option value="none">None</option>
                                            <option value="fade">Fade In</option>
                                            <option value="wipe">Wipe In</option>
                                        </select>
                                        <div className="flex items-center gap-1">
                                            <input 
                                                type="number" step="0.1" min="0.1" max="5" 
                                                className="w-full bg-slate-900 border border-slate-700 rounded text-xs p-1"
                                                value={selectedClip.transition?.inDuration || 0.5}
                                                onFocus={pushHistory}
                                                onChange={(e) => handleTransitionChange('inDuration', parseFloat(e.target.value))}
                                            />
                                            <span className="text-[10px] text-slate-500">sec</span>
                                        </div>
                                    </div>
                                 </div>
                                 
                                 {/* Exit */}
                                 <div className="bg-slate-700/30 p-2 rounded">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-xs font-semibold text-red-300">Exit</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <select 
                                            className="bg-slate-900 border border-slate-700 rounded text-xs p-1"
                                            value={selectedClip.transition?.outType || 'none'}
                                            onMouseDown={pushHistory}
                                            onChange={(e) => handleTransitionChange('outType', e.target.value)}
                                        >
                                            <option value="none">None</option>
                                            <option value="fade">Fade Out</option>
                                            <option value="wipe">Wipe Out</option>
                                        </select>
                                        <div className="flex items-center gap-1">
                                            <input 
                                                type="number" step="0.1" min="0.1" max="5" 
                                                className="w-full bg-slate-900 border border-slate-700 rounded text-xs p-1"
                                                value={selectedClip.transition?.outDuration || 0.5}
                                                onFocus={pushHistory}
                                                onChange={(e) => handleTransitionChange('outDuration', parseFloat(e.target.value))}
                                            />
                                            <span className="text-[10px] text-slate-500">sec</span>
                                        </div>
                                    </div>
                                 </div>
                             </div>
                         </div>
                         </>
                     )}

                     <div>
                        <label className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2 block">Speed</label>
                        <div className="flex items-center gap-2">
                             <input 
                                type="range" 
                                min="0.5" 
                                max="2" 
                                step="0.1"
                                value={selectedClip.speed}
                                onMouseDown={pushHistory}
                                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                                className="flex-1 accent-blue-500 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                             />
                             <span className="text-xs font-mono w-8 text-right">{selectedClip.speed}x</span>
                        </div>
                     </div>

                     <div>
                        <label className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2 block">Actions</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={handleSplit}
                                className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded text-xs transition"
                                title="Split at Playhead"
                            >
                                <ScissorsIcon /> Split
                            </button>
                            <button 
                                onClick={handleDelete}
                                className="flex items-center justify-center gap-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50 py-2 rounded text-xs transition"
                            >
                                <TrashIcon /> Delete
                            </button>
                        </div>
                     </div>
                 </div>
             ) : (
                 <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-sm text-center">
                     <p>No clip selected.</p>
                     <p className="text-xs mt-2">Click a clip in the timeline or library to edit properties.</p>
                 </div>
             )}
             </div>
         </div>
      </div>

      {/* Timeline with Tools Bar */}
      <div className="bg-slate-800 border-t border-slate-700 flex flex-col shrink-0">
          <div className="h-10 border-b border-slate-700 flex items-center px-4 gap-4 bg-slate-800">
               {/* Timeline Tools */}
               <button
                  onClick={handlePlayPause}
                  disabled={isExporting}
                  className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white disabled:opacity-50"
               >
                   {state.isPlaying ? <PauseIcon /> : <PlayIcon />} <span className="hidden sm:inline">Play/Pause</span>
               </button>
               <div className="h-4 w-px bg-slate-700"></div>
               <button 
                 onClick={handleSplit} 
                 disabled={!selectedClip || isExporting}
                 className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400"
               >
                   <ScissorsIcon /> Cut / Split
               </button>
               <div className="h-4 w-px bg-slate-700"></div>
               <button 
                 onClick={handleDelete}
                 disabled={!selectedClip || isExporting}
                 className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-red-400 disabled:opacity-30 disabled:hover:text-slate-400"
               >
                   <TrashIcon /> Delete
               </button>
          </div>
          
          <Timeline 
            state={state} 
            onSeek={handleSeek} 
            onInteractionStart={pushHistory}
            onClipMove={(id, start, trackId) => {
                setState(prev => ({
                    ...prev,
                    clips: prev.clips.map(c => c.id === id ? { ...c, start, trackId } : c)
                }));
            }}
            onClipSelect={(id) => setState(s => ({ ...s, selectedClipId: id }))}
            onClipResize={(id, start, duration, offset) => {
                setState(prev => ({
                    ...prev,
                    clips: prev.clips.map(c => c.id === id ? { ...c, start, duration, offset } : c)
                }));
            }}
          />
      </div>

      {/* Skit Generator Modal */}
      {view === AppView.SKIT_GENERATOR && (
          <SkitGenerator 
            onAddClip={addClip}
            onClose={() => setView(AppView.EDITOR)}
          />
      )}
    </div>
  );
}

export default App;
