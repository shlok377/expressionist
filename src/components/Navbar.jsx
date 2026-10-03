import {
  Plus,
  Trash2,
  Play,
  Pause,
  Maximize2,
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
  onOpenAiDirector,
  onDeleteSelected,
  onTogglePlay,
  onOpenModifyScale,
  onExport,
  onResetProject,
  onUndo,
  onRedo,
}) {
  return (
    <header className="h-16 bg-[#1d2024] border-b border-[#44474f] px-4 flex items-center justify-between z-20 select-none">
      {/* Left: Branding & Status Chip */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-[#0842a0] text-[#d3e3fd] flex items-center justify-center">
          <Film className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-medium text-base tracking-tight text-[#e2e2e9]">Expressionist</span>
          </div>
          <div className="flex items-center space-x-1.5 text-xs text-[#c4c6d0]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#a8c7fa]"></span>
            <span>{expressionsCount} expressions available</span>
          </div>
        </div>
      </div>

      {/* Center: Material 3 Action Buttons */}
      <div className="flex items-center space-x-2 bg-[#282a2f] p-1.5 rounded-full">
        {/* 1. Pick Expression - M3 Filled Button */}
        <button
          id="btn-pick-expression"
          onClick={onPickExpression}
          className="flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-medium bg-[#a8c7fa] text-[#062e6f] hover:bg-[#b8d2fa] transition"
          title="Pick Expression to add to timeline"
        >
          <Plus className="w-4 h-4" />
          <span>Pick Expression</span>
        </button>

        {/* 1b. AI Director - M3 Tonal Primary Button */}
        <button
          id="btn-ai-director"
          onClick={onOpenAiDirector}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-full text-xs font-medium bg-[#0842a0] text-[#d3e3fd] hover:bg-[#0b50bd] transition"
          title="AI Script Director: map script/audio to expressions"
        >
          <Sparkles className="w-4 h-4 text-[#a8c7fa]" />
          <span>AI Director</span>
        </button>

        {/* 2. Delete - M3 Tonal Error Button */}
        <button
          id="btn-delete-clip"
          onClick={onDeleteSelected}
          disabled={!selectedClip}
          className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition ${
            selectedClip
              ? 'bg-[#8c1d18] text-[#f9dedc] hover:bg-[#a0221c]'
              : 'text-[#8e9099] opacity-30 cursor-not-allowed'
          }`}
          title={selectedClip ? `Delete selected clip (${selectedClip.expression.name})` : 'Select a clip to delete'}
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete</span>
        </button>

        {/* 3. Play / Pause - M3 Tonal Secondary Button */}
        <button
          id="btn-play-pause"
          onClick={onTogglePlay}
          className="flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-medium bg-[#3f4759] text-[#dbe2f9] hover:bg-[#4b5469] transition"
          title="Play/Pause timeline preview (Space)"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
          <span>{isPlaying ? 'Pause' : 'Play'}</span>
        </button>

        {/* 4. Modify Scale - M3 Outlined Button */}
        <button
          id="btn-modify-scale"
          onClick={onOpenModifyScale}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-full text-xs font-medium border border-[#8e9099] text-[#e2e2e9] hover:bg-[#33353a] transition"
          title="Modify scale for all timeline expressions"
        >
          <Maximize2 className="w-4 h-4 text-[#a8c7fa]" />
          <span>Modify Scale</span>
        </button>
      </div>

      {/* Right: History & Export */}
      <div className="flex items-center space-x-3">
        {/* Undo / Redo - M3 Standard Icon Buttons */}
        <div className="flex items-center space-x-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
              canUndo
                ? 'text-[#c4c6d0] hover:text-[#e2e2e9] hover:bg-[#33353a]'
                : 'text-[#44474f] cursor-not-allowed'
            }`}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition ${
              canRedo
                ? 'text-[#c4c6d0] hover:text-[#e2e2e9] hover:bg-[#33353a]'
                : 'text-[#44474f] cursor-not-allowed'
            }`}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Total Duration Chip */}
        <div className="px-3 py-1.5 rounded-full bg-[#282a2f] border border-[#44474f] text-xs font-mono text-[#c4c6d0]">
          <span className="text-[#8e9099] mr-1.5">Total</span>
          <span className="font-semibold text-[#a8c7fa]">{totalDuration.toFixed(1)}s</span>
        </div>

        {/* Reset Project Button - M3 Tonal Button (appears after export) */}
        {hasExported && (
          <button
            id="btn-reset-project"
            onClick={onResetProject}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-medium bg-[#583e5b] text-[#fbd7fc] hover:bg-[#684a6b] transition"
            title="Clear sequence and start fresh"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Project, Its Done now!</span>
          </button>
        )}

        {/* Export Video Button - M3 Filled Primary Button */}
        <button
          id="btn-export-video"
          onClick={onExport}
          disabled={isExporting || totalDuration === 0}
          className={`flex items-center space-x-2 px-5 py-2 rounded-full text-xs font-medium transition ${
            isExporting || totalDuration === 0
              ? 'bg-[#282a2f] text-[#8e9099] cursor-not-allowed border border-[#44474f]'
              : 'bg-[#a8c7fa] text-[#062e6f] hover:bg-[#b8d2fa]'
          }`}
          title="Render and download MP4 video"
        >
          <Download className={`w-4 h-4 ${isExporting ? 'animate-spin' : ''}`} />
          <span>{isExporting ? 'Exporting...' : 'Export Video'}</span>
        </button>
      </div>
    </header>
  );
}
