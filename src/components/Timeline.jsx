import React, { useRef, useState, useEffect, useCallback } from 'react';
import { clampDuration, MIN_CLIP_DURATION, MAX_CLIP_DURATION } from '../utils/timeline.js';
import { GripVertical } from 'lucide-react';

const PIXELS_PER_SECOND = 180; // 1 second = 180px

export default function Timeline({
  clips = [],
  playhead = 0,
  selectedClipId = null,
  totalDuration = 0,
  onPlayheadChange,
  onSelectClip,
  onReorderClips,
  onUpdateDuration,
  onContextMenu,
}) {
  const rulerRef = useRef(null);
  const trackRef = useRef(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [draggedClipIndex, setDraggedClipIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Resize state
  const resizeRef = useRef({
    active: false,
    clipId: null,
    handle: null, // 'left' | 'right'
    startX: 0,
    startDuration: 0,
  });

  // Calculate pixel position of playhead
  const playheadX = playhead * PIXELS_PER_SECOND;

  // Handle Playhead Scrubbing
  const handleScrub = useCallback(
    (clientX) => {
      const ruler = rulerRef.current;
      if (!ruler) return;
      const rect = ruler.getBoundingClientRect();
      const scrollLeft = ruler.scrollLeft || 0;
      const x = clientX - rect.left + scrollLeft;
      const time = Math.max(0, Math.min(totalDuration, x / PIXELS_PER_SECOND));
      onPlayheadChange(Math.round(time * 100) / 100);
    },
    [totalDuration, onPlayheadChange]
  );

  const handleRulerMouseDown = (e) => {
    e.preventDefault();
    setIsScrubbing(true);
    handleScrub(e.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isScrubbing) {
        handleScrub(e.clientX);
      } else if (resizeRef.current.active) {
        const { clipId, handle, startX, startDuration } = resizeRef.current;
        const deltaX = e.clientX - startX;
        const deltaSeconds = deltaX / PIXELS_PER_SECOND;

        let nextDuration = startDuration;
        if (handle === 'right') {
          nextDuration = startDuration + deltaSeconds;
        } else if (handle === 'left') {
          nextDuration = startDuration - deltaSeconds;
        }

        const clamped = clampDuration(nextDuration);
        onUpdateDuration(clipId, clamped);
      }
    };

    const handleMouseUp = () => {
      if (isScrubbing) {
        setIsScrubbing(false);
      }
      if (resizeRef.current.active) {
        resizeRef.current.active = false;
      }
    };

    if (isScrubbing || resizeRef.current.active) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isScrubbing, handleScrub, onUpdateDuration]);

  // Handle Edge Resizing Start
  const startResize = (e, clip, handle) => {
    e.stopPropagation();
    e.preventDefault();
    resizeRef.current = {
      active: true,
      clipId: clip.id,
      handle,
      startX: e.clientX,
      startDuration: clip.duration,
    };
  };

  // Reorder Drag & Drop Handlers
  const handleDragStart = (e, index) => {
    setDraggedClipIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedClipIndex !== null && draggedClipIndex !== targetIndex) {
      onReorderClips(draggedClipIndex, targetIndex);
    }
    setDraggedClipIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedClipIndex(null);
    setDragOverIndex(null);
  };

  // Generate ruler tick marks
  const maxRulerTime = Math.max(10, totalDuration + 2);
  const totalRulerWidth = maxRulerTime * PIXELS_PER_SECOND;
  const majorTicks = [];
  for (let s = 0; s <= maxRulerTime; s += 0.5) {
    majorTicks.push(s);
  }

  return (
    <div className="h-56 bg-[#11141e] border-t border-[#23293c] flex flex-col select-none relative z-10">
      {/* Timeline Controls / Header */}
      <div className="h-8 px-4 bg-[#141824] border-b border-[#202536] flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center space-x-3">
          <span className="font-semibold text-slate-300">Timeline Sequence</span>
          <span className="text-[11px] text-slate-500">
            {clips.length} {clips.length === 1 ? 'clip' : 'clips'}
          </span>
        </div>
        <div className="text-[11px] text-slate-500">
          Right-click a clip for actions • Drag edges to resize • Drag body to reorder
        </div>
      </div>

      {/* Ruler & Playhead Track */}
      <div
        ref={rulerRef}
        onMouseDown={handleRulerMouseDown}
        className="h-7 border-b border-[#202536] bg-[#121520] relative overflow-x-hidden cursor-pointer"
      >
        <div style={{ width: `${totalRulerWidth}px` }} className="h-full relative pointer-events-none">
          {majorTicks.map((time) => {
            const isSecond = Number.isInteger(time);
            const x = time * PIXELS_PER_SECOND;
            return (
              <div
                key={time}
                style={{ left: `${x}px` }}
                className="absolute top-0 bottom-0 flex flex-col justify-end"
              >
                <div
                  className={`w-px ${
                    isSecond ? 'h-3.5 bg-slate-500' : 'h-2 bg-slate-700'
                  }`}
                />
                {isSecond && (
                  <span className="text-[9px] font-mono text-slate-400 -translate-x-1/2 select-none mb-0.5">
                    {time}s
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Playhead Scrubber Head on Ruler */}
        <div
          style={{ transform: `translateX(${playheadX}px)` }}
          className="absolute top-0 bottom-0 z-30 pointer-events-none"
        >
          <div className="w-3.5 h-3.5 bg-indigo-500 rounded-sm -translate-x-1/2 flex items-center justify-center shadow-md shadow-indigo-500/50">
            <div className="w-1 h-1.5 bg-white rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Clips Area */}
      <div
        ref={trackRef}
        className="flex-1 overflow-x-auto overflow-y-hidden p-4 relative bg-[#0d0f17]"
      >
        <div
          style={{ width: `${Math.max(totalRulerWidth, 1200)}px` }}
          className="h-full relative flex items-center"
        >
          {/* Playhead Vertical Line extending across clips */}
          <div
            style={{ transform: `translateX(${playheadX}px)` }}
            className="absolute top-0 bottom-0 w-0.5 bg-indigo-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(99,102,241,0.8)]"
          />

          {/* Clips List */}
          {clips.length === 0 ? (
            <div className="h-28 w-full border-2 border-dashed border-[#23293c] rounded-xl flex items-center justify-center text-slate-500 text-xs">
              Timeline is empty. Click "Pick Expression" to add mascot clips.
            </div>
          ) : (
            <div className="flex items-center h-28 space-x-1.5">
              {clips.map((clip, index) => {
                const isSelected = selectedClipId === clip.id;
                const isDragOver = dragOverIndex === index;
                const widthPx = clip.duration * PIXELS_PER_SECOND;

                return (
                  <div
                    key={clip.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectClip(clip.id);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelectClip(clip.id);
                      onContextMenu(e.clientX, e.clientY, clip);
                    }}
                    style={{ width: `${widthPx}px` }}
                    className={`group relative h-full rounded-xl border flex flex-col justify-between p-2 cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/50 shadow-lg shadow-indigo-950/50'
                        : 'bg-[#181d2c] border-[#252c40] hover:bg-[#1f2537] hover:border-[#353d58]'
                    } ${isDragOver ? 'border-l-4 border-l-cyan-400 pl-3' : ''}`}
                  >
                    {/* Left Resize Handle */}
                    <div
                      onMouseDown={(e) => startResize(e, clip, 'left')}
                      className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-indigo-400/40 rounded-l-xl z-20 transition"
                      title="Drag to resize left edge"
                    />

                    {/* Clip Header: Drag grip & name */}
                    <div className="flex items-center justify-between text-xs text-slate-300 pointer-events-none">
                      <div className="flex items-center space-x-1 truncate pr-1">
                        <GripVertical className="w-3 h-3 text-slate-500 shrink-0 opacity-40 group-hover:opacity-100" />
                        <span className="font-semibold text-[11px] truncate" title={clip.expression.name}>
                          {clip.expression.name.replace(/\.[^/.]+$/, '')}
                        </span>
                      </div>
                    </div>

                    {/* Clip Body: Mascot Thumbnail Preview */}
                    <div className="flex-1 flex items-center justify-center my-1 overflow-hidden pointer-events-none">
                      <img
                        src={clip.expression.url}
                        alt={clip.expression.name}
                        className="h-12 w-auto object-contain rounded drop-shadow"
                      />
                    </div>

                    {/* Clip Footer: Duration Pill */}
                    <div className="flex items-center justify-between pointer-events-none">
                      <span className="text-[9px] text-slate-500 font-mono">
                        #{index + 1}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-[#121520] text-indigo-300 border border-[#23293c]'
                        }`}
                      >
                        {clip.duration.toFixed(1)}s
                      </span>
                    </div>

                    {/* Right Resize Handle */}
                    <div
                      onMouseDown={(e) => startResize(e, clip, 'right')}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-indigo-400/40 rounded-r-xl z-20 transition"
                      title="Drag to resize right edge"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
