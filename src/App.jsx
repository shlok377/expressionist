import React, { useState, useEffect, useCallback, useRef } from 'react';
import Navbar from './components/Navbar.jsx';
import PreviewCanvas from './components/PreviewCanvas.jsx';
import Timeline from './components/Timeline.jsx';
import PickExpressionModal from './components/PickExpressionModal.jsx';
import ModifyDurationModal from './components/ModifyDurationModal.jsx';
import ContextMenu from './components/ContextMenu.jsx';
import { TimelineSequence, PlaybackEngine } from './utils/timeline.js';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

const STORAGE_KEY_EXPORTED = 'expressionist_has_exported';

export default function App() {
  // Library state
  const [expressions, setExpressions] = useState([]);

  // Deep Modules: TimelineSequence & PlaybackEngine
  const timelineSequence = useRef(new TimelineSequence()).current;
  const [seqState, setSeqState] = useState(() => timelineSequence.getState());

  const playbackEngine = useRef(
    new PlaybackEngine({ totalDuration: seqState.totalDuration })
  ).current;
  const [playbackState, setPlaybackState] = useState(() => playbackEngine.getState());

  const [hasExported, setHasExported] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_EXPORTED) === 'true';
  });

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

  // Subscribe to TimelineSequence state changes
  useEffect(() => {
    const unsubscribe = timelineSequence.subscribe((state) => {
      setSeqState(state);
      playbackEngine.setTotalDuration(state.totalDuration);
    });
    return unsubscribe;
  }, [timelineSequence, playbackEngine]);

  // Subscribe to PlaybackEngine state changes
  useEffect(() => {
    const unsubscribe = playbackEngine.subscribe((state) => {
      setPlaybackState(state);
    });
    return unsubscribe;
  }, [playbackEngine]);

  // Auto-save export status
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_EXPORTED, hasExported ? 'true' : 'false');
  }, [hasExported]);

  // Load expressions & connect SSE
  useEffect(() => {
    fetch('/api/expressions')
      .then((res) => res.json())
      .then((data) => {
        if (data.expressions) {
          setExpressions(data.expressions);
        }
      })
      .catch((err) => console.error('Error fetching expressions:', err));

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

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        playbackEngine.togglePlay();
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        if (seqState.selectedClipId) {
          e.preventDefault();
          timelineSequence.remove(seqState.selectedClipId);
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        playbackEngine.step(-0.1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        playbackEngine.step(0.1);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          timelineSequence.redo();
        } else {
          timelineSequence.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        timelineSequence.redo();
      } else if (e.key === 'Escape') {
        setPickModalState({ isOpen: false, mode: 'insert', targetClip: null });
        setIsModifyDurationOpen(false);
        setContextMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [seqState.selectedClipId, timelineSequence, playbackEngine]);

  // Actions
  const handlePickSelect = (expression, mode, targetClip) => {
    if (mode === 'replace' && targetClip) {
      timelineSequence.replaceExpression(targetClip.id, expression);
    } else {
      timelineSequence.insert(expression, playbackEngine.getTime());
    }
  };

  const handleDeleteSelected = () => {
    if (seqState.selectedClipId) {
      timelineSequence.remove(seqState.selectedClipId);
    }
  };

  const handleUpdateDuration = (clipId, newDuration) => {
    timelineSequence.updateDuration(clipId, newDuration);
  };

  const handleReorderClips = (fromIndex, toIndex) => {
    timelineSequence.reorder(fromIndex, toIndex);
  };

  const handleDuplicateClip = (clipId) => {
    timelineSequence.duplicate(clipId);
  };

  const handleResetProject = () => {
    if (window.confirm('Are you sure you want to reset the project and clear all clips?')) {
      timelineSequence.reset();
      playbackEngine.pause();
      playbackEngine.seek(0);
      localStorage.removeItem(STORAGE_KEY_EXPORTED);
      setHasExported(false);
      setToast({
        type: 'info',
        message: 'Project has been reset.',
      });
    }
  };

  // Export Video
  const handleExport = async () => {
    if (seqState.clips.length === 0 || isExporting) return;
    setIsExporting(true);
    setToast(null);

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clips: seqState.clips }),
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
        selectedClip={seqState.selectedClip}
        isPlaying={playbackState.isPlaying}
        canUndo={seqState.canUndo}
        canRedo={seqState.canRedo}
        hasExported={hasExported}
        isExporting={isExporting}
        totalDuration={seqState.totalDuration}
        onPickExpression={() =>
          setPickModalState({ isOpen: true, mode: 'insert', targetClip: null })
        }
        onDeleteSelected={handleDeleteSelected}
        onTogglePlay={() => playbackEngine.togglePlay()}
        onModifyDuration={() => setIsModifyDurationOpen(true)}
        onExport={handleExport}
        onResetProject={handleResetProject}
        onUndo={() => timelineSequence.undo()}
        onRedo={() => timelineSequence.redo()}
      />

      {/* Main Preview Area */}
      <main className="flex-1 flex flex-col min-h-0 bg-[#111318] relative">
        <PreviewCanvas
          clips={seqState.clips}
          playhead={playbackState.playhead}
          isPlaying={playbackState.isPlaying}
          totalDuration={seqState.totalDuration}
          playbackEngine={playbackEngine}
          onTogglePlay={() => playbackEngine.togglePlay()}
        />
      </main>

      {/* Timeline Editor */}
      <Timeline
        clips={seqState.clips}
        playhead={playbackState.playhead}
        selectedClipId={seqState.selectedClipId}
        totalDuration={seqState.totalDuration}
        playbackEngine={playbackEngine}
        onSelectClip={(clipId) => timelineSequence.select(clipId)}
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
        clip={seqState.selectedClip}
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
            const c = seqState.clips.find((item) => item.id === clipId);
            if (c) handleUpdateDuration(clipId, c.duration + 0.1);
          }}
          onDecreaseDuration={(clipId) => {
            const c = seqState.clips.find((item) => item.id === clipId);
            if (c) handleUpdateDuration(clipId, c.duration - 0.1);
          }}
          onCustomDuration={(clip) => {
            timelineSequence.select(clip.id);
            setIsModifyDurationOpen(true);
          }}
          onReplaceExpression={(clip) => {
            setPickModalState({ isOpen: true, mode: 'replace', targetClip: clip });
          }}
          onDuplicateClip={handleDuplicateClip}
          onDeleteClip={(clipId) => {
            timelineSequence.remove(clipId);
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
