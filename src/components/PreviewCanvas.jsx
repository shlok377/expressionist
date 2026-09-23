import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  findClipAtTime,
  calculateBouncySquash,
  DEFAULT_TRANSITION_DURATION,
  DEFAULT_BOUNCE_INTENSITY,
  DEFAULT_SQUASH_FACTOR,
} from '../utils/timeline.js';
import { Image as ImageIcon, Play, Pause } from 'lucide-react';

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 960;

export default function PreviewCanvas({
  clips = [],
  playhead = 0,
  isPlaying = false,
  totalDuration = 0,
  transitionDuration = DEFAULT_TRANSITION_DURATION,
  bounceIntensity = DEFAULT_BOUNCE_INTENSITY,
  squashFactor = DEFAULT_SQUASH_FACTOR,
  playheadController,
  onPlayheadChange,
  onTogglePlay,
}) {
  const canvasRef = useRef(null);
  const bitmapCacheRef = useRef(new Map());
  const imageFallbackCacheRef = useRef(new Map());
  const currentClipIdRef = useRef(null);
  const lastDrawnTransformRef = useRef({ scaleX: 1.0, scaleY: 1.0 });
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
  }, [playhead]);

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
          bitmap = await window.createImageBitmap(blob, {
            resizeWidth: CANVAS_WIDTH,
            resizeHeight: CANVAS_HEIGHT,
            resizeQuality: 'high',
          });
        } catch {
          bitmap = await window.createImageBitmap(blob);
        }
      } else {
        const img = new Image();
        img.src = url;
        if ('decode' in img) await img.decode();
        bitmap = img;
      }

      bitmapCacheRef.current.set(url, bitmap);
      return bitmap;
    } catch (err) {
      console.warn('Bitmap decoding failed for', url, err);
      if (!imageFallbackCacheRef.current.has(url)) {
        const img = new Image();
        img.src = url;
        imageFallbackCacheRef.current.set(url, img);
      }
      return null;
    }
  }, []);

  // Pre-load all clip bitmaps when clips change
  useEffect(() => {
    clips.forEach((clip) => {
      const url = clip.expression?.url;
      if (url) {
        loadPreScaledBitmap(url);
      }
    });
  }, [clips, loadPreScaledBitmap]);

  /**
   * Draws the active clip with bouncy squash & stretch center transform and dirty checking.
   */
  const drawClip = useCallback((clip, force = false, scaleX = 1.0, scaleY = 1.0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });

    // If no clip, clear once
    if (!clip) {
      if (currentClipIdRef.current !== null || force) {
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        currentClipIdRef.current = null;
        lastDrawnTransformRef.current = { scaleX: 1.0, scaleY: 1.0 };
        setActiveClipName(null);
      }
      return;
    }

    // Optimization: Dirty check - skip redraw if clip is identical and scale has settled at 1.0
    const lastTransform = lastDrawnTransformRef.current;
    if (
      !force &&
      clip.id === currentClipIdRef.current &&
      scaleX === 1.0 &&
      scaleY === 1.0 &&
      lastTransform.scaleX === 1.0 &&
      lastTransform.scaleY === 1.0
    ) {
      return;
    }

    currentClipIdRef.current = clip.id;
    lastDrawnTransformRef.current = { scaleX, scaleY };
    setActiveClipName(clip.expression?.name || null);

    const imgUrl = clip.expression?.url;
    const bitmap = bitmapCacheRef.current.get(imgUrl);

    // Calculate dimensions with bouncy horizontal squash & stretch centered
    const drawWidth = CANVAS_WIDTH * scaleX;
    const drawHeight = CANVAS_HEIGHT * scaleY;
    const offsetX = (CANVAS_WIDTH - drawWidth) / 2;
    const offsetY = (CANVAS_HEIGHT - drawHeight) / 2;

    if (bitmap) {
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.drawImage(bitmap, offsetX, offsetY, drawWidth, drawHeight);
    } else {
      let img = imageFallbackCacheRef.current.get(imgUrl);
      if (!img) {
        img = new Image();
        img.src = imgUrl;
        imageFallbackCacheRef.current.set(imgUrl, img);
      }

      const renderFallback = () => {
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        const imgAspect = img.width / img.height || 3 / 4;
        const canvasAspect = CANVAS_WIDTH / CANVAS_HEIGHT;

        let baseWidth = CANVAS_WIDTH;
        let baseHeight = CANVAS_HEIGHT;
        if (canvasAspect > imgAspect) {
          baseWidth = CANVAS_HEIGHT * imgAspect;
        } else {
          baseHeight = CANVAS_WIDTH / imgAspect;
        }

        const scaledW = baseWidth * scaleX;
        const scaledH = baseHeight * scaleY;
        const fbOffsetX = (CANVAS_WIDTH - scaledW) / 2;
        const fbOffsetY = (CANVAS_HEIGHT - scaledH) / 2;

        ctx.drawImage(img, fbOffsetX, fbOffsetY, scaledW, scaledH);
      };

      if (img.complete && img.naturalWidth > 0) {
        renderFallback();
      } else {
        img.onload = renderFallback;
      }

      loadPreScaledBitmap(imgUrl).then((loadedBitmap) => {
        if (loadedBitmap && currentClipIdRef.current === clip.id) {
          ctx.fillStyle = '#00ff00';
          ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          ctx.drawImage(loadedBitmap, offsetX, offsetY, drawWidth, drawHeight);
        }
      });
    }
  }, [loadPreScaledBitmap]);

  // Subscribe to playheadController for instant scrubbing sync outside React lifecycle
  useEffect(() => {
    if (!playheadController) return;
    const unsubscribe = playheadController.subscribe((time) => {
      if (isPlayingRef.current) return;
      playheadRef.current = time;
      if (timeDisplayRef.current) {
        timeDisplayRef.current.textContent = `${time.toFixed(2)}s`;
      }
      const match = findClipAtTime(clips, time);
      if (match) {
        const { scaleX, scaleY } = calculateBouncySquash(
          match.localTime,
          transitionDuration,
          bounceIntensity,
          squashFactor
        );
        drawClip(match.clip, true, scaleX, scaleY);
      } else {
        drawClip(null, true, 1.0, 1.0);
      }
    });
    return unsubscribe;
  }, [playheadController, clips, transitionDuration, bounceIntensity, squashFactor, drawClip]);

  // Handle manual scrub / clips change redraw
  useEffect(() => {
    if (isPlaying) return;
    playheadRef.current = playhead;
    if (timeDisplayRef.current) {
      timeDisplayRef.current.textContent = `${playhead.toFixed(2)}s`;
    }
    const match = findClipAtTime(clips, playhead);
    if (match) {
      const { scaleX, scaleY } = calculateBouncySquash(
        match.localTime,
        transitionDuration,
        bounceIntensity,
        squashFactor
      );
      drawClip(match.clip, true, scaleX, scaleY);
    } else {
      drawClip(null, true, 1.0, 1.0);
    }
  }, [playhead, isPlaying, clips, transitionDuration, bounceIntensity, squashFactor, drawClip]);

  // Decoupled 60 FPS Animation Loop with Bouncy Squash & Stretch
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
        playheadRef.current = 0;
        if (playheadController) {
          playheadController.setTime(0);
        }
        if (timeDisplayRef.current) {
          timeDisplayRef.current.textContent = '0.00s';
        }
        onPlayheadChange(0);
        onTogglePlay(false);

        const firstMatch = findClipAtTime(clips, 0);
        drawClip(firstMatch?.clip || null, true, 1.0, 1.0);
        return;
      }

      playheadRef.current = nextPlayhead;

      // 1. Direct 60 FPS update to timeline playhead (bypasses React render)
      if (playheadController) {
        playheadController.setTime(nextPlayhead);
      }

      // 2. Direct DOM update for time HUD
      if (timeDisplayRef.current) {
        timeDisplayRef.current.textContent = `${nextPlayhead.toFixed(2)}s`;
      }

      // 3. Active clip & Bouncy Squash calculation
      const activeMatch = findClipAtTime(clips, nextPlayhead);
      if (activeMatch) {
        const { scaleX, scaleY } = calculateBouncySquash(
          activeMatch.localTime,
          transitionDuration,
          bounceIntensity,
          squashFactor
        );
        const clipChanged = activeMatch.clip.id !== currentClipIdRef.current;
        const isBouncing = scaleX !== 1.0 || scaleY !== 1.0;
        const wasBouncing =
          lastDrawnTransformRef.current.scaleX !== 1.0 || lastDrawnTransformRef.current.scaleY !== 1.0;

        // Draw during bounce window or on clip change or to settle back at 1.0
        if (clipChanged || isBouncing || wasBouncing) {
          drawClip(activeMatch.clip, false, scaleX, scaleY);
        }
      } else {
        drawClip(null, false, 1.0, 1.0);
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      onPlayheadChange(playheadRef.current);
    };
  }, [
    isPlaying,
    totalDuration,
    clips,
    transitionDuration,
    bounceIntensity,
    squashFactor,
    playheadController,
    drawClip,
    onPlayheadChange,
    onTogglePlay,
  ]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0 relative">
      {/* Aspect ratio container (3:4 portrait) in M3 Card styling */}
      <div className="relative h-full max-h-[52vh] aspect-[3/4] rounded-[24px] overflow-hidden border border-[#44474f] bg-[#00ff00] flex items-center justify-center group">
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
            onClick={() => onTogglePlay(!isPlaying)}
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
