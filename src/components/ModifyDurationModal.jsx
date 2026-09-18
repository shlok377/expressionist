import React, { useState, useEffect } from 'react';
import { Clock, X, Check } from 'lucide-react';
import { MIN_CLIP_DURATION, MAX_CLIP_DURATION, clampDuration } from '../utils/timeline.js';

export default function ModifyDurationModal({
  isOpen,
  clip,
  onSave,
  onClose,
}) {
  const [duration, setDuration] = useState(0.6);

  useEffect(() => {
    if (isOpen && clip) {
      setDuration(clip.duration);
    }
  }, [isOpen, clip]);

  if (!isOpen || !clip) return null;

  const presets = [0.2, 0.4, 0.6, 0.8, 1.0, 1.5, 2.0];

  function handleSubmit(e) {
    e?.preventDefault();
    onSave(clip.id, clampDuration(duration));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#151824] border border-[#272e42] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#23293c] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Modify Clip Duration</h2>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">
                {clip.expression.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#23293c] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Main Duration Display & Stepper */}
          <div className="bg-[#11141e] border border-[#242a3e] rounded-xl p-5 text-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Active Duration
            </span>
            <div className="flex items-baseline justify-center space-x-1">
              <span className="text-4xl font-black font-mono text-amber-400">
                {duration.toFixed(1)}
              </span>
              <span className="text-sm font-bold text-slate-400">sec</span>
            </div>

            {/* Slider */}
            <div className="mt-4 px-2">
              <input
                type="range"
                min={MIN_CLIP_DURATION}
                max={MAX_CLIP_DURATION}
                step={0.1}
                value={duration}
                onChange={(e) => setDuration(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer h-2 bg-[#1e2333] rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                <span>{MIN_CLIP_DURATION}s (snappy)</span>
                <span>{MAX_CLIP_DURATION}s (slow)</span>
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Quick Presets
            </label>
            <div className="grid grid-cols-4 gap-2">
              {presets.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setDuration(preset)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-mono font-semibold border transition ${
                    Math.abs(duration - preset) < 0.05
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-[#181d2c] border-[#252c40] text-slate-300 hover:bg-[#202639]'
                  }`}
                >
                  {preset.toFixed(1)}s
                </button>
              ))}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-[#23293c]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-[#1f2537] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-sm shadow-amber-500/30 flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Apply Duration</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
