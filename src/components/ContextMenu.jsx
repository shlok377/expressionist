import React, { useEffect, useRef } from 'react';
import {
  Plus,
  Minus,
  Clock,
  RefreshCw,
  Copy,
  Trash2,
} from 'lucide-react';

export default function ContextMenu({
  x,
  y,
  clip,
  onClose,
  onIncreaseDuration,
  onDecreaseDuration,
  onCustomDuration,
  onReplaceExpression,
  onDuplicateClip,
  onDeleteClip,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!clip) return null;

  // Prevent overflowing window bounds
  const menuWidth = 220;
  const menuHeight = 250;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

  return (
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-50 w-56 bg-[#282a2f] border border-[#44474f] rounded-2xl shadow-xl py-2 text-xs text-[#e2e2e9] divide-y divide-[#44474f] select-none"
    >
      {/* Clip Info Header */}
      <div className="px-3.5 py-1.5 text-[11px] font-medium text-[#c4c6d0] truncate flex items-center justify-between">
        <span className="truncate">{clip.expression.name}</span>
        <span className="font-mono text-[#a8c7fa] font-medium ml-2">
          {clip.duration.toFixed(1)}s
        </span>
      </div>

      {/* Quick Adjustments */}
      <div className="py-1">
        <button
          onClick={() => {
            onIncreaseDuration(clip.id);
            onClose();
          }}
          disabled={clip.duration >= 2.0}
          className="w-full px-3.5 py-2 flex items-center justify-between hover:bg-[#33353a] disabled:opacity-30 disabled:hover:bg-transparent transition text-left"
        >
          <span className="flex items-center space-x-2.5">
            <Plus className="w-4 h-4 text-[#a8c7fa]" />
            <span>Increase (+0.1s)</span>
          </span>
          <span className="text-[10px] text-[#8e9099] font-mono">max 2.0s</span>
        </button>

        <button
          onClick={() => {
            onDecreaseDuration(clip.id);
            onClose();
          }}
          disabled={clip.duration <= 0.2}
          className="w-full px-3.5 py-2 flex items-center justify-between hover:bg-[#33353a] disabled:opacity-30 disabled:hover:bg-transparent transition text-left"
        >
          <span className="flex items-center space-x-2.5">
            <Minus className="w-4 h-4 text-[#a8c7fa]" />
            <span>Decrease (-0.1s)</span>
          </span>
          <span className="text-[10px] text-[#8e9099] font-mono">min 0.2s</span>
        </button>

        <button
          onClick={() => {
            onCustomDuration(clip);
            onClose();
          }}
          className="w-full px-3.5 py-2 flex items-center space-x-2.5 hover:bg-[#33353a] transition text-left"
        >
          <Clock className="w-4 h-4 text-[#c4c6d0]" />
          <span>Set Custom Duration...</span>
        </button>
      </div>

      {/* Actions */}
      <div className="py-1">
        <button
          onClick={() => {
            onReplaceExpression(clip);
            onClose();
          }}
          className="w-full px-3.5 py-2 flex items-center space-x-2.5 hover:bg-[#33353a] transition text-left"
        >
          <RefreshCw className="w-4 h-4 text-[#c4c6d0]" />
          <span>Replace Expression...</span>
        </button>

        <button
          onClick={() => {
            onDuplicateClip(clip.id);
            onClose();
          }}
          className="w-full px-3.5 py-2 flex items-center space-x-2.5 hover:bg-[#33353a] transition text-left"
        >
          <Copy className="w-4 h-4 text-[#c4c6d0]" />
          <span>Duplicate Clip</span>
        </button>
      </div>

      {/* Destructive */}
      <div className="py-1">
        <button
          onClick={() => {
            onDeleteClip(clip.id);
            onClose();
          }}
          className="w-full px-3.5 py-2 flex items-center space-x-2.5 text-[#f2b8b5] hover:bg-[#8c1d18]/40 transition text-left"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete Clip</span>
        </button>
      </div>
    </div>
  );
}
