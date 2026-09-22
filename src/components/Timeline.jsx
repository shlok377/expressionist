import React, { useRef, useState, useEffect, useCallback } from 'react';
import { clampDuration } from '../utils/timeline.js';
import { GripVertical } from 'lucide-react';

const PIXELS_PER_SECOND = 180; // 1 second = 180px

export default function Timeline({
  clips = [],
  playhead = 0,
  selectedClipId = null,
  totalDuration = 0,
  playbackEngine,
  playheadController,
  onPlayheadChange,
  onSelectClip,
  onReorderClips,
  onUpdateDuration,
  onContextMenu,
}) {
  const rulerRef = useRef(null);
  const trackRef = useRef(null);
  const playheadLineRef = useRef(null);
  const playheadScrubberRef = useRef(null);

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

  // Direct GPU Compositor DOM update for playhead at 60 FPS (zero React re-renders)
  const updatePlayheadDOM = useCallback((time) => {
    const x = time * PIXELS_PER_SECOND;
    const transformValue = `translate3d(${x}px, 0, 0)`;
    if (playheadLineRef.current) {
      playheadLineRef.current.style.transform = transformValue;
    }
    if (playheadScrubberRef.current) {
      playheadScrubberRef.current.style.transform = transformValue;
    }
  }, []);

  // Subscribe to PlaybackEngine for 60 FPS frame ticks
  useEffect(() => {
    if (!playbackEngine) return;
    updatePlayheadDOM(playbackEngine.getTime());
    const unsubscribe = playbackEngine.subscribeFrame((time) => {
      updatePlayheadDOM(time);
    });
    return unsubscribe;
  }, [playbackEngine, updatePlayheadDOM]);

  // Fallback subscription for legacy PlayheadController
  useEffect(() => {
    if (playbackEngine || !playheadController) return;
    updatePlayheadDOM(playheadController.getTime());
    const unsubscribe = playheadController.subscribe((time) => {
      updatePlayheadDOM(time);
    });
    return unsubscribe;
  }, [playbackEngine, playheadController, updatePlayheadDOM]);

  // Sync on manual playhead prop changes
  useEffect(() => {
    if (!playbackEngine && !playheadController) {
      updatePlayheadDOM(playhead);
    }
  }, [playbackEngine, playheadController, playhead, updatePlayheadDOM]);

  // Handle Playhead Scrubbing
  const handleScrub = useCallback(
    (clientX) => {
      const track = trackRef.current;
      const ruler = rulerRef.current;
      const refEl = ruler || track;
      if (!refEl) return;
      const rect = refEl.getBoundingClientRect();
      const scrollLeft = track?.scrollLeft || ruler?.scrollLeft || 0;
      const x = clientX - rect.left + scrollLeft;
      const time = Math.max(0, Math.min(totalDuration, x / PIXELS_PER_SECOND));
      const rounded = Math.round(time * 100) / 100;

      if (playbackEngine) {
        playbackEngine.seek(rounded);
      } else {
        updatePlayheadDOM(rounded);
        if (playheadController) {
          playheadController.setTime(rounded);
        }
        if (onPlayheadChange) {
          onPlayheadChange(rounded);
        }
      }
    },
    [totalDuration, playbackEngine, playheadController, updatePlayheadDOM, onPlayheadChange]
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

  const initialPlayhead = playbackEngine ? playbackEngine.getTime() : playhead;

  return (
    <div className="h-56 bg-[#191c20] border-t border-[#44474f] flex flex-col select-none relative z-10">
      {/* Timeline Header */}
      <div className="h-8 px-4 bg-[#1d2024] border-b border-[#44474f] flex items-center justify-between text-xs text-[#c4c6d0]">
        <div className="flex items-center space-x-3">
          <span className="font-medium text-[#e2e2e9]">Timeline Sequence</span>
          <span className="text-[11px] text-[#8e9099]">
            {clips.length} {clips.length === 1 ? 'clip' : 'clips'}
          </span>
        </div>
        <div className="text-[11px] text-[#8e9099]">
          Right-click a clip for actions • Drag edges to resize • Drag body to reorder
        </div>
      </div>

      {/* Ruler & Playhead Track */}
      <div
        ref={rulerRef}
        onMouseDown={handleRulerMouseDown}
        className="h-7 border-b border-[#44474f] bg-[#14161b] relative overflow-x-hidden cursor-pointer"
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
                    isSecond ? 'h-3.5 bg-[#8e9099]' : 'h-2 bg-[#44474f]'
                  }`}
                />
                {isSecond && (
                  <span className="text-[9px] font-mono text-[#8e9099] -translate-x-1/2 select-none mb-0.5">
                    {time}s
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Playhead Scrubber Head on Ruler (GPU Accelerated with translate3d) */}
        <div
          ref={playheadScrubberRef}
          onMouseDown={handleRulerMouseDown}
          style={{ transform: `translate3d(${initialPlayhead * PIXELS_PER_SECOND}px, 0, 0)` }}
          className="absolute top-0 bottom-0 z-30 cursor-ew-resize will-change-transform"
        >
          <div className="w-4 h-full -translate-x-1/2 flex items-center justify-center">
            <div className="w-3.5 h-4 bg-[#a8c7fa] rounded-b-md flex items-center justify-center shadow-md">
              <div className="w-1 h-1 bg-[#062e6f] rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Clips Area */}
      <div
        ref={trackRef}
        onScroll={() => {
          if (rulerRef.current && trackRef.current) {
            rulerRef.current.scrollLeft = trackRef.current.scrollLeft;
          }
        }}
        onMouseDown={(e) => {
          // If clicking empty area of the track, scrub to that position
          if (!e.target.closest('[draggable]') && !e.target.closest('.cursor-ew-resize')) {
            handleRulerMouseDown(e);
          }
        }}
        className="flex-1 overflow-x-auto overflow-y-hidden p-4 relative bg-[#111318]"
      >
        <div
          style={{ width: `${Math.max(totalRulerWidth, 1200)}px` }}
          className="h-full relative flex items-center"
        >
          {/* Playhead Vertical Line with grab hit-area (GPU Accelerated with translate3d) */}
          <div
            ref={playheadLineRef}
            onMouseDown={handleRulerMouseDown}
            style={{ transform: `translate3d(${initialPlayhead * PIXELS_PER_SECOND}px, 0, 0)` }}
            className="absolute top-0 bottom-0 z-30 cursor-ew-resize will-change-transform flex justify-center group/line"
          >
            <div className="w-4 h-full -translate-x-1/2 flex justify-center cursor-ew-resize">
              <div className="w-0.5 h-full bg-[#a8c7fa] group-hover/line:w-1 group-hover/line:bg-[#d3e3fd] transition-all" />
            </div>
          </div>

          {/* Clips List */}
          {clips.length === 0 ? (
            <div className="h-28 w-full border border-dashed border-[#44474f] rounded-2xl flex items-center justify-center text-[#8e9099] text-xs">
              Timeline is empty. Click "Pick Expression" to add mascot clips.
            </div>
          ) : (
            <div className="flex items-center h-28 space-x-2">
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
                    className={`group relative h-full rounded-2xl border flex flex-col justify-between p-2.5 cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? 'bg-[#33353a] border-2 border-[#a8c7fa]'
                        : isDragOver
                        ? 'bg-[#3f4759] border-[#8e9099]'
                        : 'bg-[#282a2f] border-[#44474f] hover:bg-[#33353a]'
                    }`}
                  >
                    {/* Left Resize Handle */}
                    <div
                      onMouseDown={(e) => startResize(e, clip, 'left')}
                      className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-[#a8c7fa]/30 rounded-l-2xl z-20 transition"
                      title="Drag to resize left edge"
                    />

                    {/* Clip Header */}
                    <div className="flex items-center justify-between text-xs text-[#e2e2e9] pointer-events-none">
                      <div className="flex items-center space-x-1 truncate pr-1">
                        <GripVertical className="w-3.5 h-3.5 text-[#8e9099] shrink-0" />
                        <span className="font-medium text-[11px] truncate" title={clip.expression.name}>
                          {clip.expression.name.replace(/\.[^/.]+$/, '')}
                        </span>
                      </div>
                    </div>

                    {/* Clip Body: Thumbnail */}
                    <div className="flex-1 flex items-center justify-center my-1 overflow-hidden pointer-events-none">
                      <img
                        src={clip.expression.url}
                        alt={clip.expression.name}
                        className="h-12 w-auto object-contain rounded"
                      />
                    </div>

                    {/* Clip Footer */}
                    <div className="flex items-center justify-between pointer-events-none">
                      <span className="text-[10px] text-[#8e9099] font-mono">
                        #{index + 1}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-[#a8c7fa] text-[#062e6f]'
                            : 'bg-[#1d2024] text-[#c4c6d0] border border-[#44474f]'
                        }`}
                      >
                        {clip.duration.toFixed(1)}s
                      </span>
                    </div>

                    {/* Right Resize Handle */}
                    <div
                      onMouseDown={(e) => startResize(e, clip, 'right')}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-[#a8c7fa]/30 rounded-r-2xl z-20 transition"
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
