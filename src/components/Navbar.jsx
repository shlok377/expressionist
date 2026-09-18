import React from 'react';
import {
  Plus,
  Trash2,
  Play,
  Pause,
  Clock,
  Download,
  RotateCcw,
  Undo2,
  Redo2,
  Film,
  Sparkles,
} from 'lucide-react';

export default function Navbar({
  expressionsCount,
  selectedClip,
  isPlaying,
  canUndo,
  canRedo,
  hasExported,
  isExporting,
  totalDuration,
  onPickExpression,
  onDeleteSelected,
  onTogglePlay,
  onModifyDuration,
  onExport,
  onResetProject,
  onUndo,
  onRedo,
}) {
  return (
    <header className="h-16 bg-[#131620] border-b border-[#23283a] px-4 flex items-center justify-between z-20 select-none">
      {/* Left: Branding & Library Status */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Film className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-base tracking-tight text-white">Expressionist</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Mascot Studio
            </span>
          </div>
          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{expressionsCount} expressions loaded</span>
          </div>
        </div>
      </div>

      {/* Center: Main Quick Access Actions */}
      <div className="flex items-center space-x-2 bg-[#191d2b] p-1 rounded-xl border border-[#272d42]">
        {/* 1. Pick Expression */}
        <button
          id="btn-pick-expression"
          onClick={onPickExpression}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm shadow-indigo-600/30"
          title="Pick Expression to add to timeline"
        >
          <Plus className="w-4 h-4" />
          <span>Pick Expression</span>
        </button>

        {/* 2. Delete */}
        <button
          id="btn-delete-clip"
          onClick={onDeleteSelected}
          disabled={!selectedClip}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            selectedClip
              ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30'
              : 'text-slate-500 cursor-not-allowed opacity-40'
          }`}
          title={selectedClip ? `Delete selected clip (${selectedClip.expression.name})` : 'Select a clip to delete'}
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete</span>
        </button>

        {/* 3. Play / Pause */}
        <button
          id="btn-play-pause"
          onClick={onTogglePlay}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm shadow-emerald-600/30"
          title="Play/Pause timeline preview (Space)"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
          <span>{isPlaying ? 'Pause' : 'Play'}</span>
        </button>

        {/* 4. Modify Duration */}
        <button
          id="btn-modify-duration"
          onClick={onModifyDuration}
          disabled={!selectedClip}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            selectedClip
              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'text-slate-500 cursor-not-allowed opacity-40'
          }`}
          title={selectedClip ? `Modify duration for ${selectedClip.expression.name}` : 'Select a clip to modify duration'}
        >
          <Clock className="w-4 h-4" />
          <span>Modify Duration</span>
        </button>
      </div>

      {/* Right: Export & History */}
      <div className="flex items-center space-x-3">
        {/* Undo / Redo */}
        <div className="flex items-center space-x-1 bg-[#181b26] p-1 rounded-lg border border-[#262c3e]">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded hover:bg-[#252b3e] transition ${
              canUndo ? 'text-slate-300 hover:text-white' : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded hover:bg-[#252b3e] transition ${
              canRedo ? 'text-slate-300 hover:text-white' : 'text-slate-600 cursor-not-allowed'
            }`}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Total Duration Badge */}
        <div className="px-2.5 py-1 rounded-lg bg-[#181b26] border border-[#262c3e] text-xs font-mono text-slate-300">
          <span className="text-slate-500 text-[10px] uppercase tracking-wider mr-1.5">Total</span>
          <span className="font-semibold text-indigo-400">{totalDuration.toFixed(1)}s</span>
        </div>

        {/* Reset Project Button - Appears once user exports */}
        {hasExported && (
          <button
            id="btn-reset-project"
            onClick={onResetProject}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-lg shadow-amber-500/20 animate-bounce"
            title="Clear sequence and start fresh"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Project, Its Done now!</span>
          </button>
        )}

        {/* Export Video Button */}
        <button
          id="btn-export-video"
          onClick={onExport}
          disabled={isExporting || totalDuration === 0}
          className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition shadow-lg ${
            isExporting || totalDuration === 0
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-indigo-600/30'
          }`}
          title="Render and download MP4 video"
        >
          <Download className={`w-4 h-4 ${isExporting ? 'animate-spin' : ''}`} />
          <span>{isExporting ? 'Exporting MP4...' : 'Export Video'}</span>
        </button>
      </div>
    </header>
  );
}
