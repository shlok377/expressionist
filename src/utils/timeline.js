import {
  MIN_CLIP_DURATION,
  MAX_CLIP_DURATION,
  DEFAULT_CLIP_DURATION,
  clampDuration,
  calculateTotalDuration,
  findClipAtTime,
  generateId,
  TimelineSequence,
} from '../core/TimelineSequence.js';
import { PlaybackEngine } from '../core/PlaybackEngine.js';

export {
  MIN_CLIP_DURATION,
  MAX_CLIP_DURATION,
  DEFAULT_CLIP_DURATION,
  clampDuration,
  calculateTotalDuration,
  findClipAtTime,
  generateId,
  TimelineSequence,
  PlaybackEngine,
};

/**
 * Inserts a new clip immediately after the clip under the playhead.
 * Maintained for backward compatibility.
 */
export function insertClipAfterPlayhead(clips, expression, playhead) {
  const seq = new TimelineSequence({ initialClips: clips, storage: null });
  seq.insert(expression, playhead);
  return seq.getClips();
}

/**
 * Reorders clips by moving a clip from sourceIndex to destinationIndex.
 * Maintained for backward compatibility.
 */
export function reorderClips(clips, sourceIndex, destinationIndex) {
  const seq = new TimelineSequence({ initialClips: clips, storage: null });
  seq.reorder(sourceIndex, destinationIndex);
  return seq.getClips();
}

/**
 * Updates a clip's duration with boundary clamping.
 * Maintained for backward compatibility.
 */
export function updateClipDuration(clips, clipId, newDuration) {
  const seq = new TimelineSequence({ initialClips: clips, storage: null });
  seq.updateDuration(clipId, newDuration);
  return seq.getClips();
}

/**
 * Duplicates a clip and inserts it immediately after the original.
 * Maintained for backward compatibility.
 */
export function duplicateClip(clips, clipId) {
  const seq = new TimelineSequence({ initialClips: clips, storage: null });
  seq.duplicate(clipId);
  return seq.getClips();
}

/**
 * Deletes a clip by ID.
 * Maintained for backward compatibility.
 */
export function deleteClip(clips, clipId) {
  const seq = new TimelineSequence({ initialClips: clips, storage: null });
  seq.remove(clipId);
  return seq.getClips();
}

/**
 * Replaces the expression of a clip while preserving its duration.
 * Maintained for backward compatibility.
 */
export function replaceClipExpression(clips, clipId, newExpression) {
  const seq = new TimelineSequence({ initialClips: clips, storage: null });
  seq.replaceExpression(clipId, newExpression);
  return seq.getClips();
}

/**
 * PlayheadController maintained for backward compatibility.
 * Delegates to PlaybackEngine frame subscription semantics.
 */
export class PlayheadController {
  constructor(initialTime = 0) {
    this.time = initialTime;
    this.subscribers = new Set();
  }

  getTime() {
    return this.time;
  }

  setTime(time) {
    this.time = time;
    for (const fn of this.subscribers) {
      fn(time);
    }
  }

  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }
}

export const DEFAULT_TRANSITION_DURATION = 0.08; // 80ms
export const MIN_TRANSITION_DURATION = 0.03;     // 30ms
export const MAX_TRANSITION_DURATION = 0.20;     // 200ms

/**
 * Clamps transition duration between 0.03s and 0.20s with 2 decimal precision.
 */
export function clampTransitionDuration(duration) {
  const rounded = Math.round(duration * 100) / 100;
  return Math.min(MAX_TRANSITION_DURATION, Math.max(MIN_TRANSITION_DURATION, rounded));
}

/**
 * Calculates the Scale Pop easing factor for a given local clip time.
 * Over [0, transitionDuration], eases smoothly from (1 + popIntensity) to 1.0.
 */
export function calculateScalePop(localTime, transitionDuration = DEFAULT_TRANSITION_DURATION, popIntensity = 0.06) {
  if (localTime >= transitionDuration || transitionDuration <= 0) return 1.0;
  const progress = Math.max(0, Math.min(1, localTime / transitionDuration));
  return 1.0 + popIntensity * Math.pow(1 - progress, 2);
}
