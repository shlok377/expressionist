import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from './components/Navbar.jsx';
import PreviewCanvas from './components/PreviewCanvas.jsx';
import Timeline from './components/Timeline.jsx';
import PickExpressionModal from './components/PickExpressionModal.jsx';
import ModifyDurationModal from './components/ModifyDurationModal.jsx';
import ContextMenu from './components/ContextMenu.jsx';
import {
  calculateTotalDuration,
  insertClipAfterPlayhead,
  reorderClips,
  updateClipDuration,
  duplicateClip,
  deleteClip,
  replaceClipExpression,
  clampDuration,
  PlayheadController,
} from './utils/timeline.js';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

const STORAGE_KEY_CLIPS = 'expressionist_clips';
const STORAGE_KEY_EXPORTED = 'expressionist_has_exported';

export default function App() {
  // Library state
  const [expressions, setExpressions] = useState([]);

  // Sequence state
  const [clips, setClips] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLIPS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [hasExported, setHasExported] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_EXPORTED) === 'true';
  });

  // History state for Undo / Redo
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);

  // Playback & Selection
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState(null);

  // Decoupled Playhead Controller for 60 FPS playback without React diffing
  const playheadController = useRef(new PlayheadController(0)).current;

  // Modals & Menus
  const [pickModalState, setPickModalState] = useState({
    isOpen: false,
    mode: 'insert', // 'insert' | 'replace'
    targetClip: null,
  });
  const [isModifyDurationOpen, setIsModifyDurationOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, clip }

  // Export state & Toast
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState(null);

  // Auto-save clips
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CLIPS, JSON.stringify(clips));
    } catch (err) {
      console.error('Failed to save clips to localStorage', err);
    }
  }, [clips]);

  // Auto-save export status
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_EXPORTED, hasExported ? 'true' : 'false');
  }, [hasExported]);

  // Load expressions & connect SSE
  useEffect(() => {
    // Initial fetch
    fetch('/api/expressions')
      .then((res) => res.json())
      .then((data) => {
        if (data.expressions) {
          setExpressions(data.expressions);
        }
      })
      .catch((err) => console.error('Error fetching expressions:', err));

    // SSE Stream for live watching
    const eventSource = new EventSource('/api/expressions/stream');
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.expressions) {
          setExpressions(payload.expressions);
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Helper to commit clips with undo history
  const commitClips = useCallback(
    (newClips) => {
      setPast((prev) => [...prev, clips]);
      setFuture([]);
      setClips(newClips);
    },
    [clips]
  );

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast((prev) => prev.slice(0, prev.length - 1));
    setFuture((prev) => [clips, ...prev]);
    setClips(previous);
  }, [past, clips]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setPast((prev) => [...prev, clips]);
    setClips(next);
  }, [future, clips]);

  const totalDuration = calculateTotalDuration(clips);
  const selectedClip = clips.find((c) => c.id === selectedClipId) || null;

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedClipId) {
          e.preventDefault();
          commitClips(deleteClip(clips, selectedClipId));
          setSelectedClipId(null);
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setPlayhead((prev) => {
          const next = Math.max(0, Math.round((prev - 0.1) * 10) / 10);
          playheadController.setTime(next);
          return next;
        });
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setPlayhead((prev) => {
          const next = Math.min(totalDuration, Math.round((prev + 0.1) * 10) / 10);
          playheadController.setTime(next);
          return next;
        });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Escape') {
        setPickModalState({ isOpen: false, mode: 'insert', targetClip: null });
        setIsModifyDurationOpen(false);
        setContextMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, clips, totalDuration, commitClips, handleUndo, handleRedo, playheadController]);

  // Actions
  const handlePickSelect = (expression, mode, targetClip) => {
    if (mode === 'replace' && targetClip) {
      commitClips(replaceClipExpression(clips, targetClip.id, expression));
    } else {
      const nextClips = insertClipAfterPlayhead(clips, expression, playhead);
      commitClips(nextClips);
    }
  };

  const handleDeleteSelected = () => {
    if (!selectedClipId) return;
    commitClips(deleteClip(clips, selectedClipId));
    setSelectedClipId(null);
  };

  const handleUpdateDuration = (clipId, newDuration) => {
    commitClips(updateClipDuration(clips, clipId, newDuration));
  };

  const handleReorderClips = (fromIndex, toIndex) => {
    commitClips(reorderClips(clips, fromIndex, toIndex));
  };

  const handleDuplicateClip = (clipId) => {
    commitClips(duplicateClip(clips, clipId));
  };

  const handleResetProject = () => {
    if (window.confirm('Are you sure you want to reset the project and clear all clips?')) {
      localStorage.removeItem(STORAGE_KEY_CLIPS);
      localStorage.removeItem(STORAGE_KEY_EXPORTED);
      setClips([]);
      setPast([]);
      setFuture([]);
      setPlayhead(0);
      playheadController.setTime(0);
      setIsPlaying(false);
      setSelectedClipId(null);
      setHasExported(false);
      setToast({
        type: 'info',
        message: 'Project has been reset.',
      });
    }
  };

  // Export Video
  const handleExport = async () => {
    if (clips.length === 0 || isExporting) return;
    setIsExporting(true);
    setToast(null);

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clips }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Export failed');
      }

      setHasExported(true);

      // Trigger download
      const downloadLink = document.createElement('a');
      downloadLink.href = data.downloadUrl;
      downloadLink.download = data.filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      setToast({
        type: 'success',
        message: `Video exported successfully! (${data.filename})`,
        downloadUrl: data.downloadUrl,
      });
    } catch (err) {
      console.error('Export failed:', err);
      setToast({
        type: 'error',
        message: `Export failed: ${err.message}`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#111318] text-[#e2e2e9] overflow-hidden font-sans">
      {/* Top Navigation - M3 Top App Bar */}
      <Navbar
        expressionsCount={expressions.length}
        selectedClip={selectedClip}
        isPlaying={isPlaying}
        canUndo={past.length > 0}
        canRedo={future.length > 0}
        hasExported={hasExported}
        isExporting={isExporting}
        totalDuration={totalDuration}
        onPickExpression={() =>
          setPickModalState({ isOpen: true, mode: 'insert', targetClip: null })
        }
        onDeleteSelected={handleDeleteSelected}
        onTogglePlay={() => setIsPlaying((p) => !p)}
        onModifyDuration={() => setIsModifyDurationOpen(true)}
        onExport={handleExport}
        onResetProject={handleResetProject}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {/* Main Preview Area */}
      <main className="flex-1 flex flex-col min-h-0 bg-[#111318] relative">
        <PreviewCanvas
          clips={clips}
          playhead={playhead}
          isPlaying={isPlaying}
          totalDuration={totalDuration}
          playheadController={playheadController}
          onPlayheadChange={setPlayhead}
          onTogglePlay={setIsPlaying}
        />
      </main>

      {/* Timeline Editor */}
      <Timeline
        clips={clips}
        playhead={playhead}
        selectedClipId={selectedClipId}
        totalDuration={totalDuration}
        playheadController={playheadController}
        onPlayheadChange={setPlayhead}
        onSelectClip={setSelectedClipId}
        onReorderClips={handleReorderClips}
        onUpdateDuration={handleUpdateDuration}
        onContextMenu={(x, y, clip) => setContextMenu({ x, y, clip })}
      />

      {/* Pick / Replace Expression Modal - M3 Dialog */}
      <PickExpressionModal
        isOpen={pickModalState.isOpen}
        mode={pickModalState.mode}
        targetClip={pickModalState.targetClip}
        expressions={expressions}
        onSelect={handlePickSelect}
        onClose={() => setPickModalState({ isOpen: false, mode: 'insert', targetClip: null })}
      />

      {/* Modify Duration Modal - M3 Dialog */}
      <ModifyDurationModal
        isOpen={isModifyDurationOpen}
        clip={selectedClip}
        onSave={(clipId, duration) => handleUpdateDuration(clipId, duration)}
        onClose={() => setIsModifyDurationOpen(false)}
      />

      {/* Right Click Context Menu - M3 Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          clip={contextMenu.clip}
          onClose={() => setContextMenu(null)}
          onIncreaseDuration={(clipId) => {
            const c = clips.find((item) => item.id === clipId);
            if (c) handleUpdateDuration(clipId, c.duration + 0.1);
          }}
          onDecreaseDuration={(clipId) => {
            const c = clips.find((item) => item.id === clipId);
            if (c) handleUpdateDuration(clipId, c.duration - 0.1);
          }}
          onCustomDuration={(clip) => {
            setSelectedClipId(clip.id);
            setIsModifyDurationOpen(true);
          }}
          onReplaceExpression={(clip) => {
            setPickModalState({ isOpen: true, mode: 'replace', targetClip: clip });
          }}
          onDuplicateClip={handleDuplicateClip}
          onDeleteClip={(clipId) => {
            commitClips(deleteClip(clips, clipId));
            if (selectedClipId === clipId) setSelectedClipId(null);
          }}
        />
      )}

      {/* Toast Notification - M3 Snackbar */}
      {toast && (
        <div className="fixed bottom-60 right-6 z-50 flex items-center space-x-3 bg-[#33353a] border border-[#44474f] text-[#e2e2e9] px-5 py-3 rounded-full shadow-lg">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-[#a8c7fa] shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-[#f2b8b5] shrink-0" />
          )}
          <div className="text-xs">
            <span className="font-medium">{toast.message}</span>
            {toast.downloadUrl && (
              <a
                href={toast.downloadUrl}
                download
                className="text-[#a8c7fa] underline hover:text-[#d3e3fd] font-medium ml-2"
              >
                Download again
              </a>
            )}
          </div>
          <button
            onClick={() => setToast(null)}
            className="p-1 text-[#c4c6d0] hover:text-[#e2e2e9] rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
