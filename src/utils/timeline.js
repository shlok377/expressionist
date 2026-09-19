export const MIN_CLIP_DURATION = 0.2;
export const MAX_CLIP_DURATION = 2.0;
export const DEFAULT_CLIP_DURATION = 0.6;

/**
 * Clamps duration between MIN_CLIP_DURATION and MAX_CLIP_DURATION with 1 decimal precision.
 */
export function clampDuration(duration) {
  const rounded = Math.round(duration * 10) / 10;
  return Math.min(MAX_CLIP_DURATION, Math.max(MIN_CLIP_DURATION, rounded));
}

/**
 * Calculates the total duration of an array of clips.
 */
export function calculateTotalDuration(clips) {
  if (!clips || clips.length === 0) return 0;
  const sum = clips.reduce((acc, clip) => acc + (clip.duration || 0), 0);
  return Math.round(sum * 10) / 10;
}

/**
 * Finds the active clip at a given playhead timestamp.
 */
export function findClipAtTime(clips, time) {
  if (!clips || clips.length === 0) return null;

  let elapsed = 0;
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const nextElapsed = Math.round((elapsed + clip.duration) * 10) / 10;

    // Check if time is within this clip's interval
    // For the last clip, include exact end time
    if (time >= elapsed && (time < nextElapsed || (i === clips.length - 1 && time <= nextElapsed))) {
      return {
        clip,
        index: i,
        startTime: elapsed,
        localTime: Math.round((time - elapsed) * 100) / 100,
      };
    }
    elapsed = nextElapsed;
  }

  return null;
}

/**
 * Generates a unique ID for clips.
 */
export function generateId() {
  return 'clip_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
}

/**
 * Inserts a new clip immediately after the clip under the playhead,
 * or at the end if playhead is past the end, or as the first clip if empty.
 */
export function insertClipAfterPlayhead(clips, expression, playhead) {
  const newClip = {
    id: generateId(),
    expression,
    duration: DEFAULT_CLIP_DURATION,
  };

  if (!clips || clips.length === 0) {
    return [newClip];
  }

  const active = findClipAtTime(clips, playhead);
  const insertIndex = active ? active.index + 1 : clips.length;

  const nextClips = [...clips];
  nextClips.splice(insertIndex, 0, newClip);
  return nextClips;
}

/**
 * Reorders clips by moving a clip from sourceIndex to destinationIndex.
 */
export function reorderClips(clips, sourceIndex, destinationIndex) {
  if (
    sourceIndex < 0 ||
    sourceIndex >= clips.length ||
    destinationIndex < 0 ||
    destinationIndex >= clips.length ||
    sourceIndex === destinationIndex
  ) {
    return clips;
  }

  const nextClips = [...clips];
  const [removed] = nextClips.splice(sourceIndex, 1);
  nextClips.splice(destinationIndex, 0, removed);
  return nextClips;
}

/**
 * Updates a clip's duration with boundary clamping.
 */
export function updateClipDuration(clips, clipId, newDuration) {
  const clamped = clampDuration(newDuration);
  return clips.map(clip => {
    if (clip.id === clipId) {
      return { ...clip, duration: clamped };
    }
    return clip;
  });
}

/**
 * Duplicates a clip and inserts it immediately after the original.
 */
export function duplicateClip(clips, clipId) {
  const index = clips.findIndex(c => c.id === clipId);
  if (index === -1) return clips;

  const original = clips[index];
  const duplicate = {
    ...original,
    id: generateId(),
  };

  const nextClips = [...clips];
  nextClips.splice(index + 1, 0, duplicate);
  return nextClips;
}

/**
 * Deletes a clip by ID.
 */
export function deleteClip(clips, clipId) {
  return clips.filter(c => c.id !== clipId);
}

/**
 * Replaces the expression of a clip while preserving its duration.
 */
export function replaceClipExpression(clips, clipId, newExpression) {
  return clips.map(clip => {
    if (clip.id === clipId) {
      return { ...clip, expression: newExpression };
    }
    return clip;
  });
}

/**
 * Lightweight PlayheadController for high-performance decoupled 60 FPS playback.
 * Avoids triggering full React tree re-renders on every animation frame.
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
