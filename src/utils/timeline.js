export const MIN_CLIP_DURATION = 0.2;
export const MAX_CLIP_DURATION = 2.0;
export const DEFAULT_CLIP_DURATION = 0.6;

export const DEFAULT_TRANSITION_DURATION = 0.30; // 300ms (0.30s)
export const DEFAULT_BOUNCE_INTENSITY = 0.04;     // 4% overshoot
export const DEFAULT_SQUASH_FACTOR = 0.18;        // 18% horizontal squash/stretch
export const MIN_TRANSITION_DURATION = 0.03;      // 30ms
export const MAX_TRANSITION_DURATION = 0.30;      // 300ms

export const DEFAULT_GLOBAL_SCALE = 1.0;
export const MIN_GLOBAL_SCALE = 0.1;
export const MAX_GLOBAL_SCALE = 3.0;
export const GLOBAL_SCALE_STEP = 0.05;

/**
 * Clamps global expression scale between 0.1 and 3.0 with 2 decimal precision.
 */
export function clampGlobalScale(scale) {
  const rounded = Math.round(scale * 100) / 100;
  return Math.min(MAX_GLOBAL_SCALE, Math.max(MIN_GLOBAL_SCALE, rounded));
}

export const TRANSITION_PRESETS = [
  { id: 'smooth-squash', name: 'Default (Smooth Squash)', duration: 0.30, intensity: 0.04, squash: 0.18 },
  { id: 'snappy', name: 'Snappy Spring', duration: 0.10, intensity: 0.08, squash: 0.06 },
  { id: 'bouncy', name: 'Super Bouncy', duration: 0.14, intensity: 0.15, squash: 0.10 },
  { id: 'cartoon', name: 'Cartoon Rubber', duration: 0.18, intensity: 0.20, squash: 0.18 },
  { id: 'subtle', name: 'Subtle Pop', duration: 0.06, intensity: 0.04, squash: 0.03 },
];

/**
 * Clamps duration between MIN_CLIP_DURATION and MAX_CLIP_DURATION with 1 decimal precision.
 */
export function clampDuration(duration) {
  const rounded = Math.round(duration * 10) / 10;
  return Math.min(MAX_CLIP_DURATION, Math.max(MIN_CLIP_DURATION, rounded));
}

/**
 * Clamps transition duration between 0.03s and 0.30s with 2 decimal precision.
 */
export function clampTransitionDuration(duration) {
  const rounded = Math.round(duration * 100) / 100;
  return Math.min(MAX_TRANSITION_DURATION, Math.max(MIN_TRANSITION_DURATION, rounded));
}

/**
 * Calculates the Scale Pop easing factor for a given local clip time.
 */
export function calculateScalePop(localTime, transitionDuration = DEFAULT_TRANSITION_DURATION, popIntensity = 0.06) {
  if (localTime >= transitionDuration || transitionDuration <= 0) return 1.0;
  const progress = Math.max(0, Math.min(1, localTime / transitionDuration));
  return 1.0 + popIntensity * Math.pow(1 - progress, 2);
}

/**
 * Calculates bouncy squash & stretch scaleX and scaleY over the transition window.
 * - Uses a damped harmonic bounce with horizontal stretch phase.
 * - Volume is conserved by inversely scaling vertical height.
 */
export function calculateBouncySquash(
  localTime,
  duration = DEFAULT_TRANSITION_DURATION,
  intensity = DEFAULT_BOUNCE_INTENSITY,
  squash = DEFAULT_SQUASH_FACTOR
) {
  if (localTime >= duration || duration <= 0) {
    return { scaleX: 1.0, scaleY: 1.0 };
  }

  const u = Math.max(0, Math.min(1, localTime / duration));

  // Damped cosine bounce
  const bounce = 1.0 + intensity * Math.exp(-5 * u) * Math.cos(u * Math.PI * 2);
  // Damped sine stretch (peaking around 25% into the transition)
  const stretch = squash * Math.exp(-6 * u) * Math.sin(u * Math.PI * 2.5);

  const scaleX = bounce * (1.0 + stretch);
  const scaleY = bounce * (1.0 - stretch * 0.75);

  return { scaleX, scaleY };
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
 * Inserts a new clip immediately after the clip under the playhead.
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
