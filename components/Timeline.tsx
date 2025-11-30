
import React, { useRef, useState, useEffect } from 'react';
import { ProjectState, Clip, Track } from '../types';

interface TimelineProps {
  state: ProjectState;
  onSeek: (time: number) => void;
  onClipMove: (clipId: string, newStart: number, newTrackId: string) => void;
  onClipSelect: (clipId: string) => void;
  onClipResize: (clipId: string, newStart: number, newDuration: number, newOffset: number) => void;
  onInteractionStart?: () => void;
}

const PIXELS_PER_SECOND = 50;

export const Timeline: React.FC<TimelineProps> = ({ state, onSeek, onClipMove, onClipSelect, onClipResize, onInteractionStart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const [draggingClip, setDraggingClip] = useState<{ id: string, startX: number, originalStart: number, trackId: string } | null>(null);
  const [resizingClip, setResizingClip] = useState<{ id: string, startX: number, originalStart: number, originalDuration: number, originalOffset: number, direction: 'left' | 'right' } | null>(null);

  // Calculate total width based on duration
  // Ensure at least 100% width to fill screen if duration is short
  const totalWidth = Math.max(state.duration * PIXELS_PER_SECOND, 100);

  // Handle Global Mouse Up
  useEffect(() => {
    const handleUp = () => {
      setDraggingClip(null);
      setResizingClip(null);
    };
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
  }, []);

  // Handle Global Mouse Move
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      // Moving
      if (draggingClip) {
        const diffX = e.clientX - draggingClip.startX;
        const diffSeconds = diffX / PIXELS_PER_SECOND;
        const newStart = Math.max(0, draggingClip.originalStart + diffSeconds);
        onClipMove(draggingClip.id, newStart, draggingClip.trackId);
      }
      
      // Resizing (Trimming)
      if (resizingClip) {
        const diffX = e.clientX - resizingClip.startX;
        const diffSeconds = diffX / PIXELS_PER_SECOND;

        if (resizingClip.direction === 'right') {
          // Changing duration only
          const newDuration = Math.max(0.1, resizingClip.originalDuration + diffSeconds);
          onClipResize(resizingClip.id, resizingClip.originalStart, newDuration, resizingClip.originalOffset);
        } else {
          // Left resize: changing start time, duration, and offset
          // Move start right means: increase start, decrease duration, increase offset
          // Prevent duration < 0.1
          const maxDiff = resizingClip.originalDuration - 0.1;
          const validDiff = Math.min(diffSeconds, maxDiff);
          
          const newStart = Math.max(0, resizingClip.originalStart + validDiff);
          // If start was clamped at 0, recalculate validDiff
          const actualDiff = newStart - resizingClip.originalStart;
          
          const newDuration = resizingClip.originalDuration - actualDiff;
          const newOffset = resizingClip.originalOffset + actualDiff;
          
          onClipResize(resizingClip.id, newStart, newDuration, newOffset);
        }
      }
    };

    if (draggingClip || resizingClip) {
      window.addEventListener('mousemove', handleMove);
    }
    return () => window.removeEventListener('mousemove', handleMove);
  }, [draggingClip, resizingClip, onClipMove, onClipResize]);

  // Sync horizontal scroll between Tracks and Ruler
  const handleScroll = () => {
    if (containerRef.current && rulerRef.current) {
        rulerRef.current.scrollLeft = containerRef.current.scrollLeft;
    }
  };

  const handleMouseDown = (e: React.MouseEvent, clip: Clip) => {
    e.stopPropagation();
    if (onInteractionStart) onInteractionStart();
    setDraggingClip({ id: clip.id, startX: e.clientX, originalStart: clip.start, trackId: clip.trackId });
    onClipSelect(clip.id);
  };

  const handleResizeStart = (e: React.MouseEvent, clip: Clip, direction: 'left' | 'right') => {
    e.stopPropagation();
    if (onInteractionStart) onInteractionStart();
    setResizingClip({ 
      id: clip.id, 
      startX: e.clientX, 
      originalStart: clip.start, 
      originalDuration: clip.duration, 
      originalOffset: clip.offset,
      direction 
    });
    onClipSelect(clip.id);
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const scrollLeft = containerRef.current.scrollLeft;
      
      // Calculate x relative to the start of the scrolling content
      // rect.left is viewport x of container
      // 200 is the header width
      // scrollLeft is how much we are scrolled
      const x = e.clientX - rect.left - 200 + scrollLeft;
      
      if (x >= 0) {
          const time = Math.max(0, x / PIXELS_PER_SECOND);
          onSeek(time);
      }
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-slate-900 border-t border-slate-700 h-72 select-none">
      {/* Time Ruler */}
      <div className="flex h-8 bg-slate-800 border-b border-slate-700 shrink-0 overflow-hidden">
        <div className="w-[200px] border-r border-slate-700 shrink-0 bg-slate-800 z-30"></div>
        <div 
            ref={rulerRef}
            className="flex-1 relative cursor-pointer overflow-hidden" 
            onClick={handleTimelineClick}
        >
           <div style={{ width: totalWidth }} className="h-full relative">
               {Array.from({ length: Math.ceil(state.duration / 5) + 5 }).map((_, i) => (
                 <div key={i} className="absolute top-0 bottom-0 border-l border-slate-600 text-[10px] text-slate-400 pl-1" style={{ left: i * 5 * PIXELS_PER_SECOND }}>
                   {i * 5}s
                 </div>
               ))}
               {/* Playhead Marker on Ruler */}
               <div 
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-50 pointer-events-none"
                style={{ left: state.currentTime * PIXELS_PER_SECOND }}
               >
                 <div className="w-3 h-3 -ml-1.5 bg-red-500 rounded-full"></div>
               </div>
           </div>
        </div>
      </div>

      {/* Tracks */}
      <div 
        className="flex-1 overflow-y-auto overflow-x-auto relative" 
        ref={containerRef}
        onScroll={handleScroll}
      >
        {state.tracks.map(track => (
          <div key={track.id} className="flex h-[80px] border-b border-slate-800 relative group min-w-max">
            {/* Track Header (Sticky) */}
            <div className="w-[200px] bg-slate-800 border-r border-slate-700 shrink-0 p-2 flex flex-col justify-center z-30 sticky left-0 shadow-lg">
              <span className="font-medium text-sm truncate text-slate-300">{track.name}</span>
              <div className="flex gap-2 mt-1">
                 <button className="text-xs bg-slate-700 px-1.5 py-0.5 rounded text-slate-400">
                   {track.type === 'video' ? '📺' : '🔊'}
                 </button>
              </div>
            </div>

            {/* Track Content */}
            <div 
                className="relative bg-slate-900/50" 
                style={{ width: totalWidth }}
                onClick={handleTimelineClick}
            >
              {state.clips.filter(c => c.trackId === track.id).map(clip => {
                const isSelected = state.selectedClipId === clip.id;
                return (
                  <div
                    key={clip.id}
                    onMouseDown={(e) => handleMouseDown(e, clip)}
                    className={`absolute top-1 bottom-1 rounded overflow-hidden cursor-move border group/clip
                      ${isSelected ? 'border-yellow-400 ring-2 ring-yellow-400/50 z-20' : 'border-slate-600 z-10'}
                      ${clip.type === 'audio' ? 'bg-emerald-900/80' : 'bg-blue-900/80'}
                    `}
                    style={{
                      left: clip.start * PIXELS_PER_SECOND,
                      width: clip.duration * PIXELS_PER_SECOND,
                    }}
                  >
                    {/* Clip Info */}
                    <div className="px-2 py-1 text-xs truncate font-medium text-white/90 pointer-events-none">
                      {clip.name} {clip.speed !== 1 && <span className="text-[10px] bg-black/30 px-1 rounded ml-1">{clip.speed}x</span>}
                    </div>
                    {clip.thumbnail && (
                      <img src={clip.thumbnail} alt="" className="h-full w-auto opacity-50 absolute top-0 left-0 -z-10 pointer-events-none" />
                    )}

                    {/* Resize Handles */}
                    <div 
                      className={`absolute top-0 bottom-0 left-0 w-3 cursor-w-resize hover:bg-yellow-400/50 ${isSelected ? 'bg-yellow-400/20' : 'opacity-0 group-hover/clip:opacity-100'}`}
                      onMouseDown={(e) => handleResizeStart(e, clip, 'left')}
                    />
                    <div 
                      className={`absolute top-0 bottom-0 right-0 w-3 cursor-e-resize hover:bg-yellow-400/50 ${isSelected ? 'bg-yellow-400/20' : 'opacity-0 group-hover/clip:opacity-100'}`}
                      onMouseDown={(e) => handleResizeStart(e, clip, 'right')}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {/* Render playhead line across tracks (z-25 to go under header z-30 but above clips z-20) */}
        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-25"
          style={{ left: (state.currentTime * PIXELS_PER_SECOND) + 200 }} 
        />
      </div>
    </div>
  );
};
