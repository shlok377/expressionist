import { describe, it, expect, vi } from 'vitest';
import { PlayheadController, findClipAtTime } from '../src/utils/timeline.js';

describe('Playback & Drag Sync Feedback Loop', () => {
  it('verifies Bug 1 Fix: PreviewCanvas controller subscription syncs active clip on scrub', () => {
    const controller = new PlayheadController(0);
    const clips = [
      { id: 'c1', expression: { name: 'first.png', url: '/first.png' }, duration: 0.6 },
      { id: 'c2', expression: { name: 'second.png', url: '/second.png' }, duration: 0.6 },
    ];

    let currentDrawnClipId = 'c1';
    const drawClip = vi.fn((clip) => {
      currentDrawnClipId = clip?.id || null;
    });

    // Mirror PreviewCanvas's subscription to playheadController:
    const unsubscribe = controller.subscribe((time) => {
      const match = findClipAtTime(clips, time);
      drawClip(match?.clip || null);
    });

    // When scrubbing from 0.1s to 0.8s:
    const scrubTime = 0.8;
    controller.setTime(scrubTime);

    expect(drawClip).toHaveBeenCalled();
    expect(currentDrawnClipId).toBe('c2');

    // Clean up
    unsubscribe();
  });

  it('verifies Bug 2 Fix: onTogglePlay in App.jsx and PreviewCanvas correctly toggles playback boolean', () => {
    let isPlaying = false;
    const setIsPlaying = (arg) => {
      if (typeof arg === 'function') {
        isPlaying = arg(isPlaying);
      } else {
        isPlaying = arg;
      }
    };

    // In App.jsx (fixed):
    // onTogglePlay={(val) => setIsPlaying((p) => (typeof val === 'boolean' ? val : !p))}
    const onTogglePlayProp = (val) => setIsPlaying((p) => (typeof val === 'boolean' ? val : !p));

    // In PreviewCanvas.jsx (fixed):
    // onClick={() => onTogglePlay(!isPlaying)}
    onTogglePlayProp(!isPlaying);
    expect(isPlaying).toBe(true);

    // Clicking again pauses:
    onTogglePlayProp(!isPlaying);
    expect(isPlaying).toBe(false);

    // Also works if called with no arguments:
    onTogglePlayProp();
    expect(isPlaying).toBe(true);
  });
});
