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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#151824] border border-[#272e42] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#23293c] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              {mode === 'replace' ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {mode === 'replace' ? `Replace Expression for "${targetClip?.expression.name}"` : 'Pick Expression'}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'replace'
                  ? 'Choose a new expression while retaining the existing duration.'
                  : 'Select an expression to insert into your timeline after the current playhead position.'}
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

        {/* Search Bar */}
        <div className="px-6 py-3 border-b border-[#202536] bg-[#11141e]/50 flex items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search expressions (e.g. smile, angry, laugh)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#181d2c] border border-[#272f44] rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              autoFocus
            />
          </div>
          <div className="text-xs text-slate-400 font-mono ml-4">
            Showing {filteredExpressions.length} of {expressions.length}
          </div>
        </div>

        {/* Expressions Grid */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredExpressions.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-500">
              <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
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
                  className={`group relative rounded-xl border p-2.5 flex flex-col items-center cursor-pointer transition ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 ring-2 ring-indigo-500/40'
                      : 'bg-[#191d2c] border-[#252c40] hover:bg-[#202639] hover:border-[#333b54]'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-full aspect-[3/4] bg-[#0f1118] rounded-lg overflow-hidden flex items-center justify-center p-1 relative">
                    <img
                      src={exp.url}
                      alt={exp.name}
                      className="w-full h-full object-contain group-hover:scale-105 transition duration-200"
                      loading="lazy"
                    />
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  <div className="w-full mt-2 text-center">
                    <p className="text-xs font-semibold text-slate-200 truncate" title={exp.name}>
                      {exp.name.replace(/\.[^/.]+$/, '')}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {(exp.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#23293c] bg-[#11141e] flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Tip: Double-click an image to quickly add it to the timeline.
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-[#1f2537] transition"
            >
              Cancel
            </button>
            <button
              disabled={!selectedName}
              onClick={() => handleConfirm()}
              className="px-5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition shadow-sm shadow-indigo-600/30"
            >
              {mode === 'replace' ? 'Replace Expression' : 'Add to Timeline'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
