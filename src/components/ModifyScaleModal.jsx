import React, { useState, useEffect } from 'react';
import { Maximize2, X, Check, RotateCcw } from 'lucide-react';
import {
  MIN_GLOBAL_SCALE,
  MAX_GLOBAL_SCALE,
  GLOBAL_SCALE_STEP,
  DEFAULT_GLOBAL_SCALE,
  clampGlobalScale,
} from '../utils/timeline.js';

export default function ModifyScaleModal({
  isOpen,
  globalScale = DEFAULT_GLOBAL_SCALE,
  onSave,
  onClose,
}) {
  const [scale, setScale] = useState(DEFAULT_GLOBAL_SCALE);
  const [initialScale, setInitialScale] = useState(DEFAULT_GLOBAL_SCALE);

  useEffect(() => {
    if (isOpen) {
      setScale(globalScale);
      setInitialScale(globalScale);
    }
  }, [isOpen, globalScale]);

  if (!isOpen) return null;

  const presets = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  function handleSliderChange(val) {
    const clamped = clampGlobalScale(val);
    setScale(clamped);
    onSave(clamped); // Live update preview
  }

  function handleReset() {
    setScale(DEFAULT_GLOBAL_SCALE);
    onSave(DEFAULT_GLOBAL_SCALE);
  }

  function handleCancel() {
    onSave(initialScale); // Revert to initial scale if cancelled
    onClose();
  }

  function handleSubmit(e) {
    e?.preventDefault();
    onSave(clampGlobalScale(scale));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[#282a2f] border border-[#44474f] rounded-[28px] w-full max-w-md shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#44474f] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#3f4759] text-[#dbe2f9] flex items-center justify-center">
              <Maximize2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-[#e2e2e9]">Modify Expression Scale</h2>
              <p className="text-xs text-[#c4c6d0]">
                Scale all timeline expressions uniformly
              </p>
            </div>
          </div>
          <button
            onClick={handleCancel}
            className="w-9 h-9 rounded-full text-[#c4c6d0] hover:text-[#e2e2e9] hover:bg-[#33353a] flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Main Scale Display & Slider */}
          <div className="bg-[#1d2024] border border-[#44474f] rounded-2xl p-5 text-center">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-medium text-[#8e9099] uppercase tracking-wider">
                Current Scale
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] font-medium text-[#a8c7fa] hover:text-[#b8d2fa] flex items-center space-x-1 hover:underline transition"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset (1.0x)</span>
              </button>
            </div>

            <div className="flex items-baseline justify-center space-x-2 my-2">
              <span className="text-4xl font-bold font-mono text-[#a8c7fa]">
                {scale.toFixed(2)}x
              </span>
              <span className="text-sm font-medium text-[#8e9099] font-mono">
                ({(scale * 100).toFixed(0)}%)
              </span>
            </div>

            {/* M3 Slider */}
            <div className="mt-4 px-2">
              <input
                type="range"
                min={MIN_GLOBAL_SCALE}
                max={MAX_GLOBAL_SCALE}
                step={GLOBAL_SCALE_STEP}
                value={scale}
                onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
                className="w-full accent-[#a8c7fa] cursor-pointer h-2 bg-[#33353a] rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] text-[#8e9099] font-mono mt-1">
                <span>{MIN_GLOBAL_SCALE.toFixed(1)}x</span>
                <span>1.0x</span>
                <span>{MAX_GLOBAL_SCALE.toFixed(1)}x</span>
              </div>
            </div>
          </div>

          {/* Quick Presets - M3 Chips */}
          <div>
            <label className="text-xs font-medium text-[#c4c6d0] block mb-2">
              Presets
            </label>
            <div className="grid grid-cols-6 gap-1.5">
              {presets.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => handleSliderChange(preset)}
                  className={`py-1.5 px-1 rounded-full text-xs font-mono font-medium border transition text-center ${
                    Math.abs(scale - preset) < 0.02
                      ? 'bg-[#a8c7fa] border-[#a8c7fa] text-[#062e6f]'
                      : 'bg-[#1d2024] border-[#44474f] text-[#c4c6d0] hover:bg-[#33353a]'
                  }`}
                >
                  {preset}x
                </button>
              ))}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-[#44474f]">
            <button
              type="button"
              onClick={handleCancel}
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
