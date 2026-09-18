import React, { useRef, useEffect, useState } from 'react';
import { findClipAtTime } from '../utils/timeline.js';
import { Image as ImageIcon, Play, Pause } from 'lucide-react';

export default function PreviewCanvas({
  clips = [],
  playhead = 0,
  isPlaying = false,
  totalDuration = 0,
  onPlayheadChange,
  onTogglePlay,
}) {
  const canvasRef = useRef(null);
  const imageCacheRef = useRef(new Map());
  const [activeClipName, setActiveClipName] = useState(null);

  // Pre-cache images in clips whenever clips change
  useEffect(() => {
    clips.forEach((clip) => {
      const url = clip.expression?.url;
      if (url && !imageCacheRef.current.has(url)) {
        const img = new Image();
        img.src = url;
        imageCacheRef.current.set(url, img);
      }
    });
  }, [clips]);

  // Find active clip at current playhead
  const activeMatch = findClipAtTime(clips, playhead);
  const activeClip = activeMatch?.clip || null;

  useEffect(() => {
    setActiveClipName(activeClip?.expression?.name || null);
  }, [activeClip]);

  // Render to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#0b0d14';
    ctx.fillRect(0, 0, width, height);

    if (!activeClip) {
      // Empty state
      ctx.fillStyle = '#1c2233';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    const imgUrl = activeClip.expression?.url;
    let img = imageCacheRef.current.get(imgUrl);

    if (!img) {
      img = new Image();
      img.src = imgUrl;
      imageCacheRef.current.set(imgUrl, img);
    }

    const draw = () => {
      ctx.fillStyle = '#0b0d14';
      ctx.fillRect(0, 0, width, height);

      // Fit image inside canvas maintaining 3:4 aspect ratio
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
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    };

    if (img.complete && img.naturalWidth > 0) {
      draw();
    } else {
      img.onload = draw;
    }
  }, [activeClip, playhead]);

  // Playback requestAnimationFrame loop
  useEffect(() => {
    if (!isPlaying || totalDuration <= 0) return;

    let animationFrameId;
    let lastTime = performance.now();

    const loop = (currentTime) => {
      const deltaSeconds = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      const nextPlayhead = playhead + deltaSeconds;

      if (nextPlayhead >= totalDuration) {
        // Stop and reset to 0:00 per spec
        onPlayheadChange(0);
        onTogglePlay(false);
      } else {
        onPlayheadChange(nextPlayhead);
        animationFrameId = requestAnimationFrame(loop);
      }
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPlaying, playhead, totalDuration, onPlayheadChange, onTogglePlay]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0 relative">
      {/* Aspect ratio container (3:4 portrait) */}
      <div className="relative h-full max-h-[52vh] aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border border-[#232a3c] bg-[#0c0e16] flex items-center justify-center group">
        <canvas
          ref={canvasRef}
          width={1080}
          height={1440}
          className="w-full h-full object-contain"
        />

        {/* Empty Canvas Overlay */}
        {clips.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 p-6 text-center bg-[#0d101a]/90">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-3">
              <ImageIcon className="w-8 h-8 text-indigo-400 opacity-60" />
            </div>
            <h3 className="text-sm font-semibold text-slate-300 mb-1">No Expressions in Timeline</h3>
            <p className="text-xs text-slate-500 max-w-[200px]">
              Click <strong className="text-indigo-400">Pick Expression</strong> above to start creating your clip!
            </p>
          </div>
        )}

        {/* Active Expression Name Badge */}
        {activeClipName && (
          <div className="absolute top-3 left-3 px-3 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-xs font-semibold text-white shadow-lg pointer-events-none flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
            <span className="truncate max-w-[180px]">{activeClipName.replace(/\.[^/.]+$/, '')}</span>
          </div>
        )}

        {/* Floating Quick Play/Pause Control on Hover */}
        {clips.length > 0 && (
          <button
            onClick={() => onTogglePlay()}
            className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition duration-150 backdrop-blur-[2px]"
          >
            <div className="w-14 h-14 rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white flex items-center justify-center shadow-xl transform group-hover:scale-105 transition">
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-white ml-0.5" />}
            </div>
          </button>
        )}

        {/* Timestamp HUD */}
        <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 font-mono text-xs text-slate-200 pointer-events-none">
          <span className="text-indigo-400 font-bold">{playhead.toFixed(2)}s</span>
          <span className="text-slate-500 mx-1">/</span>
          <span>{totalDuration.toFixed(2)}s</span>
        </div>
      </div>
    </div>
  );
}
