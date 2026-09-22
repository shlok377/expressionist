import { describe, it, expect } from 'vitest';
import {
  MIN_CLIP_DURATION,
  MAX_CLIP_DURATION,
  DEFAULT_CLIP_DURATION,
  DEFAULT_TRANSITION_DURATION,
  DEFAULT_BOUNCE_INTENSITY,
  DEFAULT_SQUASH_FACTOR,
  MIN_TRANSITION_DURATION,
  MAX_TRANSITION_DURATION,
  clampDuration,
  clampTransitionDuration,
  calculateScalePop,
  calculateBouncySquash,
  calculateTotalDuration,
  findClipAtTime,
  insertClipAfterPlayhead,
  reorderClips,
  updateClipDuration,
  duplicateClip,
  deleteClip,
  PlayheadController,
} from '../src/utils/timeline.js';

describe('Timeline Logic', () => {
  it('clamps durations within bounds [0.2, 2.0] with 1 decimal precision', () => {
    expect(clampDuration(0.1)).toBe(0.2);
    expect(clampDuration(0.6)).toBe(0.6);
    expect(clampDuration(2.5)).toBe(2.0);
    expect(clampDuration(0.7000000000000001)).toBe(0.7);
  });

  it('calculates total duration correctly', () => {
    const clips = [
      { id: '1', duration: 0.6 },
      { id: '2', duration: 1.2 },
      { id: '3', duration: 0.4 },
    ];
    expect(calculateTotalDuration(clips)).toBe(2.2);
  });

  it('finds the active clip and local time for a given playhead timestamp', () => {
    const clips = [
      { id: '1', name: 'clip 1', duration: 0.6 },
      { id: '2', name: 'clip 2', duration: 1.0 },
      { id: '3', name: 'clip 3', duration: 0.4 },
    ];

    const match1 = findClipAtTime(clips, 0.3);
    expect(match1).not.toBeNull();
    expect(match1.clip.id).toBe('1');
    expect(match1.index).toBe(0);
    expect(match1.startTime).toBe(0);
    expect(match1.localTime).toBeCloseTo(0.3);

    const match2 = findClipAtTime(clips, 0.8);
    expect(match2).not.toBeNull();
    expect(match2.clip.id).toBe('2');
    expect(match2.index).toBe(1);
    expect(match2.startTime).toBe(0.6);
    expect(match2.localTime).toBeCloseTo(0.2);

    const matchEnd = findClipAtTime(clips, 2.0);
    expect(matchEnd.clip.id).toBe('3');

    const matchBeyond = findClipAtTime(clips, 3.5);
    expect(matchBeyond).toBeNull();
  });

  it('inserts clip immediately after the clip currently under playhead', () => {
    const clips = [
      { id: '1', expression: { name: 'first.png' }, duration: 0.6 },
      { id: '2', expression: { name: 'second.png' }, duration: 0.6 },
    ];

    const newExp = { name: 'inserted.png' };
    const result = insertClipAfterPlayhead(clips, newExp, 0.3);

    expect(result.length).toBe(3);
    expect(result[0].id).toBe('1');
    expect(result[1].expression.name).toBe('inserted.png');
    expect(result[1].duration).toBe(DEFAULT_CLIP_DURATION);
    expect(result[2].id).toBe('2');
  });

  it('inserts clip at end if playhead is at or after total duration', () => {
    const clips = [
      { id: '1', expression: { name: 'first.png' }, duration: 0.6 },
    ];
    const newExp = { name: 'second.png' };
    const result = insertClipAfterPlayhead(clips, newExp, 0.6);
    expect(result.length).toBe(2);
    expect(result[1].expression.name).toBe('second.png');
  });

  it('inserts clip as first clip if timeline is empty', () => {
    const newExp = { name: 'initial.png' };
    const result = insertClipAfterPlayhead([], newExp, 0);
    expect(result.length).toBe(1);
    expect(result[0].expression.name).toBe('initial.png');
    expect(result[0].duration).toBe(0.6);
  });

  it('reorders clips correctly', () => {
    const clips = [
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ];
    const reordered = reorderClips(clips, 0, 2);
    expect(reordered.map(c => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('updates clip duration with clamping', () => {
    const clips = [
      { id: '1', duration: 0.6 },
      { id: '2', duration: 1.0 },
    ];
    const updated = updateClipDuration(clips, '1', 2.5);
    expect(updated[0].duration).toBe(2.0);

    const updatedMin = updateClipDuration(clips, '2', 0.05);
    expect(updatedMin[1].duration).toBe(0.2);
  });

  it('duplicates clip directly after original', () => {
    const clips = [
      { id: '1', expression: { name: 'smile.png' }, duration: 0.8 },
      { id: '2', expression: { name: 'frown.png' }, duration: 0.4 },
    ];
    const duplicated = duplicateClip(clips, '1');
    expect(duplicated.length).toBe(3);
    expect(duplicated[0].id).toBe('1');
    expect(duplicated[1].id).not.toBe('1');
    expect(duplicated[1].expression.name).toBe('smile.png');
    expect(duplicated[1].duration).toBe(0.8);
    expect(duplicated[2].id).toBe('2');
  });

  it('deletes clip correctly', () => {
    const clips = [
      { id: '1' },
      { id: '2' },
      { id: '3' },
    ];
    const afterDelete = deleteClip(clips, '2');
    expect(afterDelete.map(c => c.id)).toEqual(['1', '3']);
  });

  it('manages playhead state and notifies subscribers outside React lifecycle', () => {
    const controller = new PlayheadController(0.5);
    expect(controller.getTime()).toBe(0.5);

    let notifiedTime = null;
    const unsubscribe = controller.subscribe((time) => {
      notifiedTime = time;
    });

    controller.setTime(1.2);
    expect(controller.getTime()).toBe(1.2);
    expect(notifiedTime).toBe(1.2);

    unsubscribe();
    controller.setTime(1.8);
    expect(notifiedTime).toBe(1.2);
  });
});

describe('Transition Logic', () => {
  it('clamps transition duration between 0.03s and 0.30s with 2 decimal precision', () => {
    expect(clampTransitionDuration(0.01)).toBe(0.03);
    expect(clampTransitionDuration(0.10)).toBe(0.10);
    expect(clampTransitionDuration(0.25)).toBe(0.25);
    expect(clampTransitionDuration(0.35)).toBe(0.30);
    expect(clampTransitionDuration(0.089999999)).toBe(0.09);
  });

  it('calculates scale pop smoothly easing from 1.06 to 1.0', () => {
    expect(calculateScalePop(0, 0.10)).toBeCloseTo(1.06);
    const midScale = calculateScalePop(0.05, 0.10);
    expect(midScale).toBeGreaterThan(1.0);
    expect(midScale).toBeLessThan(1.06);
    expect(calculateScalePop(0.10, 0.10)).toBe(1.0);
    expect(calculateScalePop(0.15, 0.10)).toBe(1.0);
  });

  it('calculates scaleX and scaleY with horizontal squash and stretch', () => {
    const start = calculateBouncySquash(0, 0.10, 0.08, 0.06);
    expect(start.scaleX).toBeGreaterThan(1.0);
    expect(start.scaleY).toBeGreaterThan(1.0);

    const mid = calculateBouncySquash(0.03, 0.10, 0.08, 0.06);
    expect(mid.scaleX).toBeGreaterThan(mid.scaleY); // Horizontally stretched

    const end = calculateBouncySquash(0.10, 0.10, 0.08, 0.06);
    expect(end.scaleX).toBe(1.0);
    expect(end.scaleY).toBe(1.0);
  });
});
