export const MIN_CLIP_DURATION = 0.2;
export const MAX_CLIP_DURATION = 2.0;
export const DEFAULT_CLIP_DURATION = 0.6;
export const STORAGE_KEY_CLIPS = 'expressionist_clips';

/**
 * Clamps duration between MIN_CLIP_DURATION and MAX_CLIP_DURATION with 1 decimal precision.
 */
export function clampDuration(duration) {
  const rounded = Math.round(duration * 10) / 10;
  return Math.min(MAX_CLIP_DURATION, Math.max(MIN_CLIP_DURATION, rounded));
}

/**
 * Calculates total sequence duration rounded to 1 decimal place.
 */
export function calculateTotalDuration(clips) {
  if (!clips || clips.length === 0) return 0;
  const sum = clips.reduce((acc, clip) => acc + (clip.duration || 0), 0);
  return Math.round(sum * 10) / 10;
}

/**
 * Generates a unique clip ID.
 */
export function generateId() {
  return 'clip_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
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
 * Deep Timeline Sequence Module.
 * Encapsulates Clips, Selection, undo/redo history, duration clamping,
 * and storage persistence behind a unified stateful interface.
 */
export class TimelineSequence {
  constructor({
    initialClips = null,
    storage = typeof window !== 'undefined' && window.localStorage ? window.localStorage : null,
    storageKey = STORAGE_KEY_CLIPS,
  } = {}) {
    this.storage = storage;
    this.storageKey = storageKey;
    this.subscribers = new Set();

    // Initialize clips from initialClips or storage
    if (Array.isArray(initialClips)) {
      this.clips = initialClips;
    } else if (this.storage) {
      try {
        const saved = this.storage.getItem(this.storageKey);
        this.clips = saved ? JSON.parse(saved) : [];
      } catch {
        this.clips = [];
      }
    } else {
      this.clips = [];
    }

    this.selectedClipId = null;
    this.past = [];
    this.future = [];
  }

  /**
   * Internal helper to commit a new clip array with undo history and auto-persistence.
   */
  _commit(newClips, nextSelectedClipId = this.selectedClipId) {
    this.past.push({
      clips: this.clips,
      selectedClipId: this.selectedClipId,
    });
    this.future = [];
    this.clips = newClips;

    // Ensure selectedClipId still exists in new clips
    if (nextSelectedClipId && !this.clips.some((c) => c.id === nextSelectedClipId)) {
      this.selectedClipId = null;
    } else {
      this.selectedClipId = nextSelectedClipId;
    }

    this._persist();
    this._notify();
  }

  _persist() {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.clips));
    } catch (err) {
      console.error('Failed to persist clips to storage:', err);
    }
  }

  _notify() {
    const state = this.getState();
    for (const listener of this.subscribers) {
      try {
        listener(state);
      } catch (err) {
        console.error('TimelineSequence subscriber error:', err);
      }
    }
  }

  /**
   * Returns current sequence state snapshot.
   */
  getState() {
    const selectedClip = this.clips.find((c) => c.id === this.selectedClipId) || null;
    return {
      clips: [...this.clips],
      selectedClipId: this.selectedClipId,
      selectedClip,
      totalDuration: calculateTotalDuration(this.clips),
      canUndo: this.past.length > 0,
      canRedo: this.future.length > 0,
    };
  }

  getClips() {
    return this.clips;
  }

  getTotalDuration() {
    return calculateTotalDuration(this.clips);
  }

  getSelectedClip() {
    return this.clips.find((c) => c.id === this.selectedClipId) || null;
  }

  findClipAt(time) {
    return findClipAtTime(this.clips, time);
  }

  /**
   * Inserts a new clip immediately after the active playhead position.
   * Automatically selects the newly inserted clip.
   */
  insert(expression, playhead = 0) {
    const newClip = {
      id: generateId(),
      expression,
      duration: DEFAULT_CLIP_DURATION,
    };

    if (this.clips.length === 0) {
      this._commit([newClip], newClip.id);
      return newClip;
    }

    const active = findClipAtTime(this.clips, playhead);
    const insertIndex = active ? active.index + 1 : this.clips.length;

    const nextClips = [...this.clips];
    nextClips.splice(insertIndex, 0, newClip);
    this._commit(nextClips, newClip.id);
    return newClip;
  }

  /**
   * Deletes a clip by ID. If the deleted clip was selected, clears selection.
   */
  remove(clipId) {
    const nextClips = this.clips.filter((c) => c.id !== clipId);
    const nextSelectedId = this.selectedClipId === clipId ? null : this.selectedClipId;
    this._commit(nextClips, nextSelectedId);
  }

  /**
   * Updates a clip's duration with clamping [0.2, 2.0].
   */
  updateDuration(clipId, duration) {
    const clamped = clampDuration(duration);
    const nextClips = this.clips.map((clip) => {
      if (clip.id === clipId) {
        return { ...clip, duration: clamped };
      }
      return clip;
    });
    this._commit(nextClips);
  }

  /**
   * Duplicates a clip and inserts it immediately after the original.
   * Selects the new duplicated clip.
   */
  duplicate(clipId) {
    const index = this.clips.findIndex((c) => c.id === clipId);
    if (index === -1) return null;

    const original = this.clips[index];
    const duplicateClip = {
      ...original,
      id: generateId(),
    };

    const nextClips = [...this.clips];
    nextClips.splice(index + 1, 0, duplicateClip);
    this._commit(nextClips, duplicateClip.id);
    return duplicateClip;
  }

  /**
   * Replaces the expression of a clip while retaining its duration.
   */
  replaceExpression(clipId, newExpression) {
    const nextClips = this.clips.map((clip) => {
      if (clip.id === clipId) {
        return { ...clip, expression: newExpression };
      }
      return clip;
    });
    this._commit(nextClips);
  }

  /**
   * Reorders clips by moving a clip from sourceIndex to destinationIndex.
   */
  reorder(sourceIndex, destinationIndex) {
    if (
      sourceIndex < 0 ||
      sourceIndex >= this.clips.length ||
      destinationIndex < 0 ||
      destinationIndex >= this.clips.length ||
      sourceIndex === destinationIndex
    ) {
      return;
    }

    const nextClips = [...this.clips];
    const [removed] = nextClips.splice(sourceIndex, 1);
    nextClips.splice(destinationIndex, 0, removed);
    this._commit(nextClips);
  }

  /**
   * Sets the active selection.
   */
  select(clipId) {
    if (this.selectedClipId === clipId) return;
    this.selectedClipId = clipId;
    this._notify();
  }

  /**
   * Clears selection.
   */
  clearSelection() {
    if (this.selectedClipId === null) return;
    this.selectedClipId = null;
    this._notify();
  }

  /**
   * Undoes the last clip modification.
   */
  undo() {
    if (this.past.length === 0) return false;

    const previous = this.past.pop();
    this.future.unshift({
      clips: this.clips,
      selectedClipId: this.selectedClipId,
    });

    this.clips = previous.clips;
    this.selectedClipId = previous.selectedClipId && this.clips.some((c) => c.id === previous.selectedClipId)
      ? previous.selectedClipId
      : null;

    this._persist();
    this._notify();
    return true;
  }

  /**
   * Redoes the last undone clip modification.
   */
  redo() {
    if (this.future.length === 0) return false;

    const next = this.future.shift();
    this.past.push({
      clips: this.clips,
      selectedClipId: this.selectedClipId,
    });

    this.clips = next.clips;
    this.selectedClipId = next.selectedClipId && this.clips.some((c) => c.id === next.selectedClipId)
      ? next.selectedClipId
      : null;

    this._persist();
    this._notify();
    return true;
  }

  /**
   * Resets the project: clears clips, history, selection, and storage.
   */
  reset() {
    this.clips = [];
    this.past = [];
    this.future = [];
    this.selectedClipId = null;

    if (this.storage) {
      try {
        this.storage.removeItem(this.storageKey);
      } catch (err) {
        console.error('Failed to remove clips from storage:', err);
      }
    }

    this._notify();
  }

  /**
   * Subscribes a listener to state changes.
   * Returns an unsubscribe function.
   */
  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }
}
