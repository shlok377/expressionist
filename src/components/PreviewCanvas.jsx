import React, { useRef, useEffect, useState, useCallback } from 'react';
import { findClipAtTime } from '../utils/timeline.js';
import { ExpressionTextureCache } from '../core/ExpressionTextureCache.js';
import { Image as ImageIcon, Play, Pause } from 'lucide-react';

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 960;

export default function PreviewCanvas({
  clips = [],
  playhead = 0,
  isPlaying = false,
  totalDuration = 0,
  playbackEngine,
  playheadController,
  textureCache,
  onPlayheadChange,
  onTogglePlay,
}) {
  const canvasRef = useRef(null);
  const cache = useRef(textureCache || new ExpressionTextureCache()).current;
  const currentClipIdRef = useRef(null);
  const timeDisplayRef = useRef(null);
  const [activeClipName, setActiveClipName] = useState(null);

  // Pre-load and pre-decode all clip textures when clips change
  useEffect(() => {
    cache.preloadExpressions(clips);
  }, [clips, cache]);

  /**
   * Draws the active clip with dirty checking and GPU-accelerated blitting.
   */
  const drawClip = useCallback((clip, force = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });

    // If no clip, clear once
    if (!clip) {
      if (currentClipIdRef.current !== null || force) {
        ctx.fillStyle = '#0c0e13';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        currentClipIdRef.current = null;
        setActiveClipName(null);
      }
      return;
    }

    // Optimization: Dirty check - skip redraw if clip is identical
    if (!force && clip.id === currentClipIdRef.current) {
      return;
    }

    currentClipIdRef.current = clip.id;
    setActiveClipName(clip.expression?.name || null);

    const imgUrl = clip.expression?.url;
    const texture = cache.getTexture(imgUrl);

    if (texture) {
      // 1:1 Instant GPU Texture Blit
      if (typeof ImageBitmap !== 'undefined' && texture instanceof ImageBitmap) {
        ctx.drawImage(texture, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } else {
        // Fallback HTMLImageElement with aspect-ratio letterboxing
        ctx.fillStyle = '#0c0e13';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        const { drawWidth, drawHeight, offsetX, offsetY } = cache.calculateLetterbox(
          texture.naturalWidth || texture.width,
          texture.naturalHeight || texture.height,
          CANVAS_WIDTH,
          CANVAS_HEIGHT
        );
        ctx.drawImage(texture, offsetX, offsetY, drawWidth, drawHeight);
      }
    } else {
      // Clear canvas while texture decodes asynchronously
      ctx.fillStyle = '#0c0e13';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Trigger background load and redraw once ready
      cache.loadTexture(imgUrl).then((loadedTexture) => {
        if (loadedTexture && currentClipIdRef.current === clip.id) {
          drawClip(clip, true);
        }
      });
    }
  }, [cache]);

  // Frame tick handler (high frequency 60 FPS updates from PlaybackEngine)
  const handleFrameTick = useCallback((time) => {
    if (timeDisplayRef.current) {
      timeDisplayRef.current.textContent = `${time.toFixed(2)}s`;
    }

    const activeMatch = findClipAtTime(clips, time);
    if (activeMatch?.clip?.id !== currentClipIdRef.current) {
      drawClip(activeMatch?.clip || null, false);
    }
  }, [clips, drawClip]);

  // Subscribe to PlaybackEngine 60 FPS frame ticks
  useEffect(() => {
    if (!playbackEngine) return;

    // Initial render at current engine time
    handleFrameTick(playbackEngine.getTime());

    const unsubscribe = playbackEngine.subscribeFrame((time) => {
      handleFrameTick(time);
    });
    return unsubscribe;
  }, [playbackEngine, handleFrameTick]);

  // Fallback subscription for legacy PlayheadController
  useEffect(() => {
    if (playbackEngine || !playheadController) return;

    handleFrameTick(playheadController.getTime());
    const unsubscribe = playheadController.subscribe((time) => {
      handleFrameTick(time);
    });
    return unsubscribe;
  }, [playbackEngine, playheadController, handleFrameTick]);

  // Redraw when clips array changes or initial playhead updates
  useEffect(() => {
    const initialTime = playbackEngine ? playbackEngine.getTime() : playhead;
    const match = findClipAtTime(clips, initialTime);
    drawClip(match?.clip || null, true);
    if (timeDisplayRef.current) {
      timeDisplayRef.current.textContent = `${initialTime.toFixed(2)}s`;
    }
  }, [clips, playbackEngine, playhead, drawClip]);

  const handleToggle = () => {
    if (playbackEngine) {
      playbackEngine.togglePlay();
    } else if (onTogglePlay) {
      onTogglePlay(!isPlaying);
    }
  };

  const activeIsPlaying = playbackEngine ? playbackEngine.getState().isPlaying : isPlaying;
  const currentTime = playbackEngine ? playbackEngine.getTime() : playhead;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0 relative">
      {/* Aspect ratio container (3:4 portrait) in M3 Card styling */}
      <div className="relative h-full max-h-[52vh] aspect-[3/4] rounded-[24px] overflow-hidden border border-[#44474f] bg-[#0c0e13] flex items-center justify-center group">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="w-full h-full object-contain"
        />

        {/* Empty Canvas Overlay */}
        {clips.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[#c4c6d0] p-6 text-center bg-[#191c20]">
            <div className="w-14 h-14 rounded-2xl bg-[#282a2f] text-[#a8c7fa] flex items-center justify-center mb-3">
              <ImageIcon className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-medium text-[#e2e2e9] mb-1">No Expressions in Timeline</h3>
            <p className="text-xs text-[#8e9099] max-w-[220px]">
              Click <strong className="text-[#a8c7fa]">Pick Expression</strong> above to start creating your clip!
            </p>
          </div>
        )}

        {/* Active Expression Name Chip */}
        {activeClipName && (
          <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#1d2024] border border-[#44474f] text-xs font-medium text-[#e2e2e9] pointer-events-none flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#a8c7fa]"></span>
            <span className="truncate max-w-[180px]">{activeClipName.replace(/\.[^/.]+$/, '')}</span>
          </div>
        )}

        {/* Quick Play/Pause Control on Hover - M3 FAB Style */}
        {clips.length > 0 && (
          <button
            onClick={handleToggle}
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition duration-150"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#a8c7fa] text-[#062e6f] hover:bg-[#b8d2fa] flex items-center justify-center transition">
              {activeIsPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
            </div>
          </button>
        )}

        {/* Timestamp Chip with direct DOM ref for 60 FPS update */}
        <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-[#1d2024] border border-[#44474f] font-mono text-xs text-[#c4c6d0] pointer-events-none flex items-center">
          <span ref={timeDisplayRef} className="text-[#a8c7fa] font-medium min-w-[36px]">
            {currentTime.toFixed(2)}s
          </span>
          <span className="text-[#8e9099] mx-1">/</span>
          <span>{totalDuration.toFixed(2)}s</span>
        </div>
      </div>
    </div>
  );
}
