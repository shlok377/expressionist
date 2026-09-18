import React, { useState, useEffect } from 'react';
import { Search, X, Check, Image as ImageIcon, Sparkles, RefreshCw } from 'lucide-react';

export default function PickExpressionModal({
  isOpen,
  mode = 'insert', // 'insert' | 'replace'
  targetClip = null,
  expressions = [],
  onSelect,
  onClose,
}) {
  const [search, setSearch] = useState('');
  const [selectedName, setSelectedName] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      if (mode === 'replace' && targetClip) {
        setSelectedName(targetClip.expression.name);
      } else {
        setSelectedName(null);
      }
    }
  }, [isOpen, mode, targetClip]);

  if (!isOpen) return null;

  const filteredExpressions = expressions.filter((exp) =>
    exp.name.toLowerCase().includes(search.toLowerCase())
  );

  function handleConfirm(expression) {
    const chosen = expression || expressions.find((e) => e.name === selectedName);
    if (chosen) {
      onSelect(chosen, mode, targetClip);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-[#282a2f] border border-[#44474f] rounded-[28px] w-full max-w-4xl max-h-[85vh] flex flex-col shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#44474f] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#0842a0] text-[#d3e3fd] flex items-center justify-center">
              {mode === 'replace' ? <RefreshCw className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-medium text-[#e2e2e9]">
                {mode === 'replace' ? `Replace Expression for "${targetClip?.expression.name}"` : 'Pick Expression'}
              </h2>
              <p className="text-xs text-[#c4c6d0]">
                {mode === 'replace'
                  ? 'Choose a new expression while retaining the existing duration.'
                  : 'Select an expression to insert into your timeline after the current playhead position.'}
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

        {/* Search Bar - M3 Search Container */}
        <div className="px-6 py-3 border-b border-[#44474f] bg-[#1d2024] flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#8e9099] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search expressions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#282a2f] border border-[#44474f] rounded-full pl-10 pr-4 py-2 text-xs text-[#e2e2e9] placeholder-[#8e9099] focus:outline-none focus:border-[#a8c7fa] transition"
              autoFocus
            />
          </div>
          <div className="text-xs text-[#8e9099] font-mono ml-4">
            {filteredExpressions.length} of {expressions.length}
          </div>
        </div>

        {/* Expressions Grid */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 bg-[#191c20]">
          {filteredExpressions.length === 0 ? (
            <div className="col-span-full py-16 text-center text-[#8e9099]">
              <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No expressions match "{search}"</p>
            </div>
          ) : (
            filteredExpressions.map((exp) => {
              const isSelected = selectedName === exp.name;
              return (
                <div
                  key={exp.name}
                  onClick={() => setSelectedName(exp.name)}
                  onDoubleClick={() => handleConfirm(exp)}
                  className={`group relative rounded-2xl border p-2.5 flex flex-col items-center cursor-pointer transition ${
                    isSelected
                      ? 'bg-[#33353a] border-2 border-[#a8c7fa]'
                      : 'bg-[#1d2024] border-[#44474f] hover:bg-[#282a2f]'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-full aspect-[3/4] bg-[#111318] rounded-xl overflow-hidden flex items-center justify-center p-1 relative">
                    <img
                      src={exp.url}
                      alt={exp.name}
                      className="w-full h-full object-contain group-hover:scale-105 transition duration-200"
                      loading="lazy"
                    />
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#a8c7fa] text-[#062e6f] flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <div className="w-full mt-2 text-center">
                    <p className="text-xs font-medium text-[#e2e2e9] truncate" title={exp.name}>
                      {exp.name.replace(/\.[^/.]+$/, '')}
                    </p>
                    <p className="text-[10px] text-[#8e9099] truncate mt-0.5 font-mono">
                      {(exp.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#44474f] bg-[#1d2024] flex items-center justify-between">
          <div className="text-xs text-[#8e9099]">
            Tip: Double-click an image to quickly add it to the timeline.
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-full text-xs font-medium text-[#a8c7fa] hover:bg-[#33353a] transition"
            >
              Cancel
            </button>
            <button
              disabled={!selectedName}
              onClick={() => handleConfirm()}
              className="px-6 py-2 rounded-full text-xs font-medium bg-[#a8c7fa] text-[#062e6f] hover:bg-[#b8d2fa] disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              {mode === 'replace' ? 'Replace Expression' : 'Add to Timeline'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
