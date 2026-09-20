import { describe, it, expect, vi } from 'vitest';
import {
  MIN_CLIP_DURATION,
  MAX_CLIP_DURATION,
  DEFAULT_CLIP_DURATION,
  clampDuration,
  calculateTotalDuration,
  findClipAtTime,
  insertClipAfterPlayhead,
  reorderClips,
  updateClipDuration,
  duplicateClip,
  deleteClip,
  PlayheadController,
  TimelineSequence,
  PlaybackEngine,
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

    // Time 0.3 should be in clip 1
    const match1 = findClipAtTime(clips, 0.3);
    expect(match1).not.toBeNull();
    expect(match1.clip.id).toBe('1');
    expect(match1.index).toBe(0);
    expect(match1.startTime).toBe(0);
    expect(match1.localTime).toBeCloseTo(0.3);

    // Time 0.8 should be in clip 2 (starts at 0.6, ends at 1.6)
    const match2 = findClipAtTime(clips, 0.8);
    expect(match2).not.toBeNull();
    expect(match2.clip.id).toBe('2');
    expect(match2.index).toBe(1);
    expect(match2.startTime).toBe(0.6);
    expect(match2.localTime).toBeCloseTo(0.2);

    // Time equal to total duration should return the last clip
    const matchEnd = findClipAtTime(clips, 2.0);
    expect(matchEnd.clip.id).toBe('3');

    // Time beyond total duration
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

describe('TimelineSequence Module', () => {
  function createStorageMock(initial = {}) {
    const map = new Map(Object.entries(initial));
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    };
  }

  it('initializes from storage or initialClips and computes total duration', () => {
    const storage = createStorageMock({
      expressionist_clips: JSON.stringify([
        { id: 'c1', duration: 0.8, expression: { name: 'a.png' } },
        { id: 'c2', duration: 1.2, expression: { name: 'b.png' } },
      ]),
    });

    const seq = new TimelineSequence({ storage });
    const state = seq.getState();
    expect(state.clips.length).toBe(2);
    expect(state.totalDuration).toBe(2.0);
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
  });

  it('inserts clip, auto-selects it, records undo step, and persists', () => {
    const storage = createStorageMock();
    const seq = new TimelineSequence({ storage });

    const inserted = seq.insert({ name: 'smile.png' }, 0);
    expect(inserted.id).toBeDefined();
    expect(inserted.duration).toBe(0.6);

    const state = seq.getState();
    expect(state.clips.length).toBe(1);
    expect(state.selectedClipId).toBe(inserted.id);
    expect(state.canUndo).toBe(true);

    // Verify storage persistence
    const saved = JSON.parse(storage.getItem('expressionist_clips'));
    expect(saved.length).toBe(1);
    expect(saved[0].id).toBe(inserted.id);
  });

  it('removes clip and clears selectedClipId if deleted clip was selected', () => {
    const storage = createStorageMock();
    const seq = new TimelineSequence({
      storage,
      initialClips: [
        { id: 'c1', duration: 0.5, expression: { name: '1.png' } },
        { id: 'c2', duration: 0.5, expression: { name: '2.png' } },
      ],
    });

    seq.select('c1');
    expect(seq.getState().selectedClipId).toBe('c1');

    seq.remove('c1');
    const state = seq.getState();
    expect(state.clips.length).toBe(1);
    expect(state.clips[0].id).toBe('c2');
    expect(state.selectedClipId).toBeNull();
  });

  it('updates duration with clamping and persists', () => {
    const seq = new TimelineSequence({
      initialClips: [{ id: 'c1', duration: 0.6, expression: { name: '1.png' } }],
    });

    seq.updateDuration('c1', 3.0);
    expect(seq.getState().clips[0].duration).toBe(2.0);

    seq.updateDuration('c1', 0.05);
    expect(seq.getState().clips[0].duration).toBe(0.2);
  });

  it('supports undo and redo preserving selection and clips history', () => {
    const seq = new TimelineSequence({ initialClips: [] });

    const clipA = seq.insert({ name: 'a.png' }, 0);
    const clipB = seq.insert({ name: 'b.png' }, 0.6);
    expect(seq.getState().clips.length).toBe(2);

    // Undo clipB insertion
    expect(seq.undo()).toBe(true);
    expect(seq.getState().clips.length).toBe(1);
    expect(seq.getState().clips[0].id).toBe(clipA.id);
    expect(seq.getState().canRedo).toBe(true);

    // Redo clipB insertion
    expect(seq.redo()).toBe(true);
    expect(seq.getState().clips.length).toBe(2);
    expect(seq.getState().clips[1].id).toBe(clipB.id);
  });

  it('resets project and clears storage', () => {
    const storage = createStorageMock({
      expressionist_clips: JSON.stringify([{ id: 'c1', duration: 1.0 }]),
    });
    const seq = new TimelineSequence({ storage });
    expect(seq.getState().clips.length).toBe(1);

    seq.reset();
    expect(seq.getState().clips.length).toBe(0);
    expect(seq.getState().selectedClipId).toBeNull();
    expect(storage.getItem('expressionist_clips')).toBeNull();
  });
});

describe('PlaybackEngine Module', () => {
  function createVirtualClock() {
    let currentTime = 0;
    let nextId = 1;
    const callbacks = new Map();

    return {
      now: () => currentTime,
      requestFrame: (cb) => {
        const id = nextId++;
        callbacks.set(id, cb);
        return id;
      },
      cancelFrame: (id) => callbacks.delete(id),
      tick: (deltaMs) => {
        currentTime += deltaMs;
        const currentCallbacks = Array.from(callbacks.values());
        callbacks.clear();
        for (const cb of currentCallbacks) {
          cb(currentTime);
        }
      },
    };
  }

  it('seeks and steps within clamped bounds [0, totalDuration]', () => {
    const engine = new PlaybackEngine({ totalDuration: 5.0 });

    engine.seek(2.5);
    expect(engine.getTime()).toBe(2.5);

    // Clamps to total duration
    engine.seek(10.0);
    expect(engine.getTime()).toBe(5.0);

    // Clamps to 0
    engine.seek(-2.0);
    expect(engine.getTime()).toBe(0);

    // Steps
    engine.step(0.4);
    expect(engine.getTime()).toBe(0.4);

    engine.step(-0.2);
    expect(engine.getTime()).toBe(0.2);
  });

  it('plays, pauses, and notifies state subscribers', () => {
    const engine = new PlaybackEngine({ totalDuration: 3.0 });
    let lastState = null;
    engine.subscribe((state) => {
      lastState = state;
    });

    engine.play();
    expect(engine.getState().isPlaying).toBe(true);
    expect(lastState.isPlaying).toBe(true);

    engine.pause();
    expect(engine.getState().isPlaying).toBe(false);
    expect(lastState.isPlaying).toBe(false);
  });

  it('advances playhead on clock ticks and delivers 60 FPS frame notifications', () => {
    const clock = createVirtualClock();
    const engine = new PlaybackEngine({ totalDuration: 2.0, clock });

    const frameTicks = [];
    engine.subscribeFrame((time) => {
      frameTicks.push(time);
    });

    engine.play();
    clock.tick(500); // 0.5s
    expect(engine.getTime()).toBeCloseTo(0.5);
    expect(frameTicks.length).toBeGreaterThan(0);

    clock.tick(500); // 1.0s
    expect(engine.getTime()).toBeCloseTo(1.0);
  });

  it('halts and resets to 0:00 when reaching sequence end (boundary invariant)', () => {
    const clock = createVirtualClock();
    const engine = new PlaybackEngine({ initialTime: 0.8, totalDuration: 1.0, clock });

    engine.play();
    clock.tick(300); // Advances past 1.0s

    expect(engine.getState().isPlaying).toBe(false);
    expect(engine.getTime()).toBe(0);
  });
});
