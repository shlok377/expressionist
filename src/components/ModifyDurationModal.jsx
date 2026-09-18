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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[#282a2f] border border-[#44474f] rounded-[28px] w-full max-w-md shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#44474f] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#3f4759] text-[#dbe2f9] flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-[#e2e2e9]">Modify Duration</h2>
              <p className="text-xs text-[#c4c6d0] truncate max-w-[240px]">
                {clip.expression.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full text-[#c4c6d0] hover:text-[#e2e2e9] hover:bg-[#33353a] flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Main Duration Display & Slider */}
          <div className="bg-[#1d2024] border border-[#44474f] rounded-2xl p-5 text-center">
            <span className="text-[11px] font-medium text-[#8e9099] uppercase tracking-wider block mb-1">
              Active Duration
            </span>
            <div className="flex items-baseline justify-center space-x-1">
              <span className="text-4xl font-bold font-mono text-[#a8c7fa]">
                {duration.toFixed(1)}
              </span>
              <span className="text-sm font-medium text-[#8e9099]">sec</span>
            </div>

            {/* M3 Slider */}
            <div className="mt-4 px-2">
              <input
                type="range"
                min={MIN_CLIP_DURATION}
                max={MAX_CLIP_DURATION}
                step={0.1}
                value={duration}
                onChange={(e) => setDuration(parseFloat(e.target.value))}
                className="w-full accent-[#a8c7fa] cursor-pointer h-2 bg-[#33353a] rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] text-[#8e9099] font-mono mt-1">
                <span>{MIN_CLIP_DURATION}s</span>
                <span>{MAX_CLIP_DURATION}s</span>
              </div>
            </div>
          </div>

          {/* Quick Presets - M3 Chips */}
          <div>
            <label className="text-xs font-medium text-[#c4c6d0] block mb-2">
              Presets
            </label>
            <div className="grid grid-cols-4 gap-2">
              {presets.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setDuration(preset)}
                  className={`py-1.5 px-2 rounded-full text-xs font-mono font-medium border transition ${
                    Math.abs(duration - preset) < 0.05
                      ? 'bg-[#a8c7fa] border-[#a8c7fa] text-[#062e6f]'
                      : 'bg-[#1d2024] border-[#44474f] text-[#c4c6d0] hover:bg-[#33353a]'
                  }`}
                >
                  {preset.toFixed(1)}s
                </button>
              ))}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-[#44474f]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-full text-xs font-medium text-[#a8c7fa] hover:bg-[#33353a] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-full text-xs font-medium bg-[#a8c7fa] text-[#062e6f] hover:bg-[#b8d2fa] transition flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Apply</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
