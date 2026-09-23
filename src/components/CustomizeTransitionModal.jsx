import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  X,
  Check,
  RotateCcw,
  Play,
  Sliders,
  Sparkles,
} from 'lucide-react';
import {
  DEFAULT_TRANSITION_DURATION,
  DEFAULT_BOUNCE_INTENSITY,
  DEFAULT_SQUASH_FACTOR,
  MIN_TRANSITION_DURATION,
  MAX_TRANSITION_DURATION,
  TRANSITION_PRESETS,
  clampTransitionDuration,
  calculateBouncySquash,
} from '../utils/timeline.js';

export default function CustomizeTransitionModal({
  isOpen,
  settings,
  sampleImageUrl,
  onSave,
  onClose,
}) {
  const [duration, setDuration] = useState(DEFAULT_TRANSITION_DURATION);
  const [intensity, setIntensity] = useState(DEFAULT_BOUNCE_INTENSITY);
  const [squash, setSquash] = useState(DEFAULT_SQUASH_FACTOR);
  const [activePreset, setActivePreset] = useState('smooth-squash');

  // Preview animation state
  const [previewTransform, setPreviewTransform] = useState({ scaleX: 1, scaleY: 1 });
  const animFrameRef = useRef(null);

  useEffect(() => {
    if (isOpen && settings) {
      setDuration(settings.duration ?? DEFAULT_TRANSITION_DURATION);
      setIntensity(settings.intensity ?? DEFAULT_BOUNCE_INTENSITY);
      setSquash(settings.squash ?? DEFAULT_SQUASH_FACTOR);
      setActivePreset(settings.preset || 'custom');
    }
  }, [isOpen, settings]);

  // Trigger test animation
  const triggerTestAnimation = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const startTime = performance.now();
    const animDurationMs = duration * 1000;

    const animate = (now) => {
      const elapsedSeconds = (now - startTime) / 1000;
      if (elapsedSeconds >= duration) {
        setPreviewTransform({ scaleX: 1, scaleY: 1 });
        return;
      }

      const { scaleX, scaleY } = calculateBouncySquash(elapsedSeconds, duration, intensity, squash);
      setPreviewTransform({ scaleX, scaleY });
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (isOpen) {
      triggerTestAnimation();
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [duration, intensity, squash, isOpen]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset) => {
    setActivePreset(preset.id);
    setDuration(preset.duration);
    setIntensity(preset.intensity);
    setSquash(preset.squash);
  };

  const handleResetDefaults = () => {
    setActivePreset('smooth-squash');
    setDuration(DEFAULT_TRANSITION_DURATION);
    setIntensity(DEFAULT_BOUNCE_INTENSITY);
    setSquash(DEFAULT_SQUASH_FACTOR);
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    onSave({
      duration: clampTransitionDuration(duration),
      intensity,
      squash,
      preset: activePreset,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[#282a2f] border border-[#44474f] rounded-[28px] w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#44474f] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#0842a0] text-[#d3e3fd] flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-[#e2e2e9]">Customize Transition</h2>
              <p className="text-xs text-[#c4c6d0]">
                Configure the bouncy Scale Pop and horizontal squash & stretch animation.
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Top: Interactive Live Sandbox + Presets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Live Animation Sandbox */}
            <div className="bg-[#1d2024] border border-[#44474f] rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden">
              <span className="text-[10px] font-medium text-[#8e9099] uppercase tracking-wider mb-2">
                Live Preview
              </span>
              <div className="w-28 h-36 bg-[#00ff00] rounded-xl flex items-center justify-center p-2 relative overflow-hidden border border-[#44474f]">
                {sampleImageUrl ? (
                  <img
                    src={sampleImageUrl}
                    alt="Mascot Preview"
                    style={{
                      transform: `scale(${previewTransform.scaleX}, ${previewTransform.scaleY})`,
                      transformOrigin: 'center center',
                    }}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div
                    style={{
                      transform: `scale(${previewTransform.scaleX}, ${previewTransform.scaleY})`,
                      transformOrigin: 'center center',
                    }}
                    className="w-16 h-20 rounded-xl bg-[#0842a0] text-[#d3e3fd] flex items-center justify-center font-bold text-lg"
                  >
                    🎭
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={triggerTestAnimation}
                className="mt-3 flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#3f4759] text-[#dbe2f9] hover:bg-[#4b5469] transition"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Test Bounce</span>
              </button>
            </div>

            {/* Presets Column */}
            <div className="flex flex-col justify-between">
              <div>
                <label className="text-xs font-medium text-[#c4c6d0] block mb-2">
                  Transition Presets
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TRANSITION_PRESETS.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => handleSelectPreset(p)}
                      className={`p-2.5 rounded-xl text-left border transition ${
                        activePreset === p.id
                          ? 'bg-[#a8c7fa] border-[#a8c7fa] text-[#062e6f]'
                          : 'bg-[#1d2024] border-[#44474f] text-[#e2e2e9] hover:bg-[#33353a]'
                      }`}
                    >
                      <span className="font-medium text-xs block truncate">{p.name}</span>
                      <span className="text-[10px] opacity-75 font-mono">
                        {(p.duration * 1000).toFixed(0)}ms • {Math.round(p.intensity * 100)}% pop
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3 p-2.5 rounded-xl bg-[#1d2024] border border-[#44474f] text-[11px] text-[#c4c6d0]">
                <p>
                  Spring formula applies damped harmonic oscillation with horizontal stretch phase for organic 2D reaction.
                </p>
              </div>
            </div>
          </div>

          {/* Sliders Area */}
          <div className="space-y-4 bg-[#1d2024] border border-[#44474f] rounded-2xl p-5">
            {/* Slider 1: Transition Duration */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-[#e2e2e9]">Transition Duration</span>
                <span className="font-mono text-[#a8c7fa] font-bold">
                  {(duration * 1000).toFixed(0)}ms ({duration.toFixed(2)}s)
                </span>
              </div>
              <input
                type="range"
                min={MIN_TRANSITION_DURATION}
                max={MAX_TRANSITION_DURATION}
                step={0.01}
                value={duration}
                onChange={(e) => {
                  setActivePreset('custom');
                  setDuration(parseFloat(e.target.value));
                }}
                className="w-full accent-[#a8c7fa] cursor-pointer h-2 bg-[#33353a] rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] text-[#8e9099] font-mono mt-1">
                <span>30ms (ultra snappy)</span>
                <span>Default: 300ms</span>
                <span>300ms (slow spring)</span>
              </div>
            </div>

            {/* Slider 2: Bounce Overshoot */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-[#e2e2e9]">Bounce Overshoot (Scale Pop)</span>
                <span className="font-mono text-[#a8c7fa] font-bold">
                  {(intensity * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={0.25}
                step={0.01}
                value={intensity}
                onChange={(e) => {
                  setActivePreset('custom');
                  setIntensity(parseFloat(e.target.value));
                }}
                className="w-full accent-[#a8c7fa] cursor-pointer h-2 bg-[#33353a] rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] text-[#8e9099] font-mono mt-1">
                <span>0% (no overshoot)</span>
                <span>Default: 4%</span>
                <span>25% (extreme pop)</span>
              </div>
            </div>

            {/* Slider 3: Horizontal Squash & Stretch */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-[#e2e2e9]">Horizontal Squash & Stretch</span>
                <span className="font-mono text-[#a8c7fa] font-bold">
                  {(squash * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={0.20}
                step={0.01}
                value={squash}
                onChange={(e) => {
                  setActivePreset('custom');
                  setSquash(parseFloat(e.target.value));
                }}
                className="w-full accent-[#a8c7fa] cursor-pointer h-2 bg-[#33353a] rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] text-[#8e9099] font-mono mt-1">
                <span>0% (uniform scaling)</span>
                <span>Default: 18%</span>
                <span>20% (heavy squish)</span>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-between border-t border-[#44474f]">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center space-x-1.5 text-xs text-[#8e9099] hover:text-[#e2e2e9] transition px-3 py-1.5 rounded-full hover:bg-[#33353a]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>

            <div className="flex items-center space-x-2">
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
                <span>Apply Transition</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
