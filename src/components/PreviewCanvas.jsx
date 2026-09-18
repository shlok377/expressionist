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

    // Clear background to M3 surface-container-lowest
    ctx.fillStyle = '#0c0e13';
    ctx.fillRect(0, 0, width, height);

    if (!activeClip) {
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
      ctx.fillStyle = '#0c0e13';
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
      {/* Aspect ratio container (3:4 portrait) in M3 Card styling */}
      <div className="relative h-full max-h-[52vh] aspect-[3/4] rounded-[24px] overflow-hidden border border-[#44474f] bg-[#0c0e13] flex items-center justify-center group">
        <canvas
          ref={canvasRef}
          width={1080}
          height={1440}
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
          <span className="text-[#a8c7fa] font-medium">{playhead.toFixed(2)}s</span>
          <span className="text-[#8e9099] mx-1">/</span>
          <span>{totalDuration.toFixed(2)}s</span>
        </div>
      </div>
    </div>
  );
}
