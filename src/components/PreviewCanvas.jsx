import React, { useRef, useEffect, useState, useCallback } from 'react';
import { findClipAtTime } from '../utils/timeline.js';
import { Image as ImageIcon, Play, Pause } from 'lucide-react';

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
  const imageCacheRef = useRef(new Map());
  const currentClipIdRef = useRef(null);
  const playheadRef = useRef(playhead);
  const isPlayingRef = useRef(isPlaying);
  const lastReactSyncRef = useRef(0);
  const [activeClipName, setActiveClipName] = useState(null);
  const [displayTime, setDisplayTime] = useState(playhead);

  // Keep isPlayingRef and playheadRef in sync
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Sync from external playhead changes (scrubbing, seeking)
  useEffect(() => {
    playheadRef.current = playhead;
    setDisplayTime(playhead);
    if (playheadController) {
      playheadController.setTime(playhead);
    }
  }, [playhead, playheadController]);

  // Pre-cache & async decode images in clips
  useEffect(() => {
    clips.forEach((clip) => {
      const url = clip.expression?.url;
      if (url && !imageCacheRef.current.has(url)) {
        const img = new Image();
        img.src = url;
        // Asynchronous decode to prevent main-thread jank
        if ('decode' in img) {
          img.decode().catch(() => {});
        }
        imageCacheRef.current.set(url, img);
      }
    });
  }, [clips]);

  // Function to draw clip to canvas ONLY when needed (dirty check)
  const drawClip = useCallback((clip, force = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    const width = canvas.width;
    const height = canvas.height;

    // If no clip, clear once
    if (!clip) {
      if (currentClipIdRef.current !== null || force) {
        ctx.fillStyle = '#0c0e13';
        ctx.fillRect(0, 0, width, height);
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
    let img = imageCacheRef.current.get(imgUrl);

    if (!img) {
      img = new Image();
      img.src = imgUrl;
      imageCacheRef.current.set(imgUrl, img);
    }

    const render = () => {
      ctx.fillStyle = '#0c0e13';
      ctx.fillRect(0, 0, width, height);

      const imgAspect = img.width / img.height || 3 / 4;
      const canvasAspect = width / height;

      let drawWidth = width;
      let drawHeight = height;
      let offsetX = 0;
      let offsetY = 0;

      if (canvasAspect > imgAspect) {
        drawWidth = height * imgAspect;
        offsetX = (width - drawWidth) / 2;
      } else {
        drawHeight = width / imgAspect;
        offsetY = (height - drawHeight) / 2;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    };

    if (img.complete && img.naturalWidth > 0) {
      render();
    } else {
      img.onload = render;
    }
  }, []);

  // Handle manual scrub / clips change redraw
  useEffect(() => {
    const match = findClipAtTime(clips, playheadRef.current);
    drawClip(match?.clip || null, true);
  }, [clips, drawClip]);

  // Decoupled 60 FPS Animation Loop
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
        setDisplayTime(0);
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

      // 2. Dirty-checked canvas draw: only draws if the active clip changed!
      const activeMatch = findClipAtTime(clips, nextPlayhead);
      if (activeMatch?.clip?.id !== currentClipIdRef.current) {
        drawClip(activeMatch?.clip || null, false);
      }

      // 3. Throttled UI state sync (~10 FPS / every 100ms) for time display
      if (currentTime - lastReactSyncRef.current >= 100) {
        lastReactSyncRef.current = currentTime;
        setDisplayTime(nextPlayhead);
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      // On pause / unmount, sync exact playhead back to React
      onPlayheadChange(playheadRef.current);
    };
  }, [isPlaying, totalDuration, clips, playheadController, drawClip, onPlayheadChange, onTogglePlay]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0 relative">
      {/* Aspect ratio container (3:4 portrait) in M3 Card styling */}
      <div className="relative h-full max-h-[52vh] aspect-[3/4] rounded-[24px] overflow-hidden border border-[#44474f] bg-[#0c0e13] flex items-center justify-center group">
        <canvas
          ref={canvasRef}
          width={720}
          height={960}
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

        {/* Timestamp Chip */}
        <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-[#1d2024] border border-[#44474f] font-mono text-xs text-[#c4c6d0] pointer-events-none">
          <span className="text-[#a8c7fa] font-medium">{displayTime.toFixed(2)}s</span>
          <span className="text-[#8e9099] mx-1">/</span>
          <span>{totalDuration.toFixed(2)}s</span>
        </div>
      </div>
    </div>
  );
}
