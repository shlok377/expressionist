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
      className="fixed z-50 w-56 bg-[#161925] border border-[#2c3349] rounded-xl shadow-2xl shadow-black/80 py-1.5 text-xs text-slate-200 divide-y divide-[#23283a] select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Clip Info Header */}
      <div className="px-3 py-1.5 text-[11px] font-medium text-slate-400 truncate flex items-center justify-between">
        <span className="truncate">{clip.expression.name}</span>
        <span className="font-mono text-indigo-400 font-bold ml-2">
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
          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-indigo-600/20 hover:text-indigo-300 disabled:opacity-40 disabled:hover:bg-transparent transition text-left"
        >
          <span className="flex items-center space-x-2">
            <Plus className="w-3.5 h-3.5 text-indigo-400" />
            <span>Increase (+0.1s)</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">max 2.0s</span>
        </button>

        <button
          onClick={() => {
            onDecreaseDuration(clip.id);
            onClose();
          }}
          disabled={clip.duration <= 0.2}
          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-indigo-600/20 hover:text-indigo-300 disabled:opacity-40 disabled:hover:bg-transparent transition text-left"
        >
          <span className="flex items-center space-x-2">
            <Minus className="w-3.5 h-3.5 text-indigo-400" />
            <span>Decrease (-0.1s)</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">min 0.2s</span>
        </button>

        <button
          onClick={() => {
            onCustomDuration(clip);
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center space-x-2 hover:bg-indigo-600/20 hover:text-indigo-300 transition text-left"
        >
          <Clock className="w-3.5 h-3.5 text-amber-400" />
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
          className="w-full px-3 py-1.5 flex items-center space-x-2 hover:bg-indigo-600/20 hover:text-indigo-300 transition text-left"
        >
          <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
          <span>Replace Expression...</span>
        </button>

        <button
          onClick={() => {
            onDuplicateClip(clip.id);
            onClose();
          }}
          className="w-full px-3 py-1.5 flex items-center space-x-2 hover:bg-indigo-600/20 hover:text-indigo-300 transition text-left"
        >
          <Copy className="w-3.5 h-3.5 text-emerald-400" />
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
          className="w-full px-3 py-1.5 flex items-center space-x-2 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition text-left"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Clip</span>
        </button>
      </div>
    </div>
  );
}
