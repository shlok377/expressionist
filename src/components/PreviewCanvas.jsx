import React, { useRef, useEffect, useState, useCallback } from 'react';
import { findClipAtTime } from '../utils/timeline.js';
import { Image as ImageIcon, Play, Pause } from 'lucide-react';

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 960;

export default function PreviewCanvas({
  clips = [],
  playhead = 0,
  isPlaying = false,
  totalDuration = 0,
  playheadController,
  onPlayheadChange,
  onTogglePlay,
}) {
  const canvasRef = useRef(null);
  const bitmapCacheRef = useRef(new Map());
  const imageFallbackCacheRef = useRef(new Map());
  const currentClipIdRef = useRef(null);
  const playheadRef = useRef(playhead);
  const isPlayingRef = useRef(isPlaying);
  const timeDisplayRef = useRef(null);
  const [activeClipName, setActiveClipName] = useState(null);

  // Keep isPlayingRef updated
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Sync from external playhead changes (scrubbing, seeking)
  useEffect(() => {
    playheadRef.current = playhead;
    if (timeDisplayRef.current) {
      timeDisplayRef.current.textContent = `${playhead.toFixed(2)}s`;
    }
    if (playheadController) {
      playheadController.setTime(playhead);
    }
  }, [playhead, playheadController]);

  /**
   * Pre-scales and decodes an image off the main thread using createImageBitmap.
   * Caches the resulting GPU-ready ImageBitmap for instant 1:1 drawing.
   */
  const loadPreScaledBitmap = useCallback(async (url) => {
    if (!url || bitmapCacheRef.current.has(url)) {
      return bitmapCacheRef.current.get(url);
    }

    try {
      const res = await fetch(url);
      const blob = await res.blob();

      let bitmap;
      if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
        try {
          // Off-thread decoding AND high-quality downsampling to 720x960
          bitmap = await window.createImageBitmap(blob, {
            resizeWidth: CANVAS_WIDTH,
            resizeHeight: CANVAS_HEIGHT,
            resizeQuality: 'high',
          });
        } catch {
          // Fallback to standard off-thread decoding without resize options
          bitmap = await window.createImageBitmap(blob);
        }
      } else {
        // Fallback for environments without createImageBitmap
        const img = new Image();
        img.src = url;
        if ('decode' in img) await img.decode();
        bitmap = img;
      }

      bitmapCacheRef.current.set(url, bitmap);
      return bitmap;
    } catch (err) {
      console.warn('Bitmap decoding failed for', url, err);
      // Fallback to Image element
      if (!imageFallbackCacheRef.current.has(url)) {
        const img = new Image();
        img.src = url;
        imageFallbackCacheRef.current.set(url, img);
      }
      return null;
    }
  }, []);

  // Pre-load and pre-decode all clip bitmaps when clips change
  useEffect(() => {
    clips.forEach((clip) => {
      const url = clip.expression?.url;
      if (url) {
        loadPreScaledBitmap(url);
      }
    });
  }, [clips, loadPreScaledBitmap]);

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
    const bitmap = bitmapCacheRef.current.get(imgUrl);

    if (bitmap) {
      // 1:1 Instant GPU Texture Blit (0 downsampling CPU cost!)
      ctx.drawImage(bitmap, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
      // If bitmap is still decoding asynchronously in background, draw fallback image
      let img = imageFallbackCacheRef.current.get(imgUrl);
      if (!img) {
        img = new Image();
        img.src = imgUrl;
        imageFallbackCacheRef.current.set(imgUrl, img);
      }

      const renderFallback = () => {
        ctx.fillStyle = '#0c0e13';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const imgAspect = img.width / img.height || 3 / 4;
        const canvasAspect = CANVAS_WIDTH / CANVAS_HEIGHT;

        let drawWidth = CANVAS_WIDTH;
        let drawHeight = CANVAS_HEIGHT;
        let offsetX = 0;
        let offsetY = 0;

        if (canvasAspect > imgAspect) {
          drawWidth = CANVAS_HEIGHT * imgAspect;
          offsetX = (CANVAS_WIDTH - drawWidth) / 2;
        } else {
          drawHeight = CANVAS_WIDTH / imgAspect;
          offsetY = (CANVAS_HEIGHT - drawHeight) / 2;
        }

        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      };

      if (img.complete && img.naturalWidth > 0) {
        renderFallback();
      } else {
        img.onload = renderFallback;
      }

      // Trigger background bitmap load for subsequent frames
      loadPreScaledBitmap(imgUrl).then((loadedBitmap) => {
        if (loadedBitmap && currentClipIdRef.current === clip.id) {
          ctx.drawImage(loadedBitmap, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
      });
    }
  }, [loadPreScaledBitmap]);

  // Handle manual scrub / clips change redraw
  useEffect(() => {
    const match = findClipAtTime(clips, playheadRef.current);
    drawClip(match?.clip || null, true);
  }, [clips, drawClip]);

  // Decoupled 60 FPS Animation Loop (Zero React Re-renders During Playback)
  useEffect(() => {
    if (!isPlaying || totalDuration <= 0) return;

    let animationFrameId;
    let lastTime = performance.now();

    const loop = (currentTime) => {
      if (!isPlayingRef.current) return;

      const deltaSeconds = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      const nextPlayhead = playheadRef.current + deltaSeconds;

      if (nextPlayhead >= totalDuration) {
        // Stop and reset to 0:00 per spec
        playheadRef.current = 0;
        if (playheadController) {
          playheadController.setTime(0);
        }
        if (timeDisplayRef.current) {
          timeDisplayRef.current.textContent = '0.00s';
        }
        onPlayheadChange(0);
        onTogglePlay(false);

        // Draw first frame
        const firstMatch = findClipAtTime(clips, 0);
        drawClip(firstMatch?.clip || null, true);
        return;
      }

      playheadRef.current = nextPlayhead;

      // 1. Direct 60 FPS update to timeline playhead via controller (bypasses React render)
      if (playheadController) {
        playheadController.setTime(nextPlayhead);
      }

      // 2. Direct DOM update for time HUD (zero React re-renders)
      if (timeDisplayRef.current) {
        timeDisplayRef.current.textContent = `${nextPlayhead.toFixed(2)}s`;
      }

      // 3. Dirty-checked canvas draw: only draws if the active clip changed!
      const activeMatch = findClipAtTime(clips, nextPlayhead);
      if (activeMatch?.clip?.id !== currentClipIdRef.current) {
        drawClip(activeMatch?.clip || null, false);
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      // On pause / unmount, sync exact playhead back to React state
      onPlayheadChange(playheadRef.current);
    };
  }, [isPlaying, totalDuration, clips, playheadController, drawClip, onPlayheadChange, onTogglePlay]);

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
            onClick={() => onTogglePlay()}
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition duration-150"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#a8c7fa] text-[#062e6f] hover:bg-[#b8d2fa] flex items-center justify-center transition">
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
            </div>
          </button>
        )}

        {/* Timestamp Chip with direct DOM ref for 60 FPS update */}
        <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-[#1d2024] border border-[#44474f] font-mono text-xs text-[#c4c6d0] pointer-events-none flex items-center">
          <span ref={timeDisplayRef} className="text-[#a8c7fa] font-medium min-w-[36px]">
            {playhead.toFixed(2)}s
          </span>
          <span className="text-[#8e9099] mx-1">/</span>
          <span>{totalDuration.toFixed(2)}s</span>
        </div>
      </div>
    </div>
  );
}
