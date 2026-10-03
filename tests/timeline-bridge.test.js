import { describe, it, expect } from 'vitest';
import {
  resolveExpressionObject,
  jsonToTimelineClips,
  insertSequenceAtPlayhead,
} from '../src/utils/timelineBridge.js';

describe('Timeline Bridge - Expression Resolution', () => {
  const mockExpressions = [
    { id: '1', name: 'angry', filename: 'angry.png', url: '/expressions/angry.png' },
    { id: '2', name: 'blush', filename: 'blush.png', url: '/expressions/blush.png' },
    { id: '3', name: 'smile', filename: 'smile.png', url: '/expressions/smile.png' },
    { id: '4', name: 'wink', filename: 'wink.png', url: '/expressions/wink.png' },
  ];

  it('matches exact expression names case-insensitively', () => {
    const res = resolveExpressionObject('WINK', mockExpressions);
    expect(res).toEqual(mockExpressions[3]);
  });

  it('matches filenames with extension', () => {
    const res = resolveExpressionObject('angry.png', mockExpressions);
    expect(res).toEqual(mockExpressions[0]);
  });

  it('matches by substring', () => {
    const res = resolveExpressionObject('blushing', mockExpressions);
    expect(res).toEqual(mockExpressions[1]);
  });

  it('falls back to smile if expression is unknown', () => {
    const res = resolveExpressionObject('totally_unknown_pose', mockExpressions);
    expect(res.name).toBe('smile');
  });

  it('falls back to first available if smile does not exist', () => {
    const limited = [
      { id: '1', name: 'cry', filename: 'cry.png', url: '/expressions/cry.png' },
    ];
    const res = resolveExpressionObject('something_else', limited);
    expect(res.name).toBe('cry');
  });

  it('creates safe synthetic expression object when available list is empty', () => {
    const res = resolveExpressionObject('smile', []);
    expect(res).toEqual({
      id: 'smile',
      name: 'smile',
      filename: 'smile.png',
      url: '/expressions/smile.png',
    });
  });
});

describe('Timeline Bridge - JSON to Timeline Clips', () => {
  const mockExpressions = [
    { id: '1', name: 'smile', filename: 'smile.png', url: '/expressions/smile.png' },
    { id: '2', name: 'wink', filename: 'wink.png', url: '/expressions/wink.png' },
  ];

  it('converts array of items into hydrated timeline clips with clamped durations', () => {
    const items = [
      { expression: 'smile', duration: 0.5 },
      { expression: 'wink', duration: 3.5 }, // clamped to 2.0s
      { expression: 'unknown', duration: 0.05 }, // clamped to 0.2s
    ];

    const clips = jsonToTimelineClips(items, mockExpressions);
    expect(clips).toHaveLength(3);

    expect(clips[0].id).toMatch(/^clip_/);
    expect(clips[0].expression.name).toBe('smile');
    expect(clips[0].duration).toBe(0.5);

    expect(clips[1].expression.name).toBe('wink');
    expect(clips[1].duration).toBe(2.0);

    expect(clips[2].expression.name).toBe('smile'); // fallback
    expect(clips[2].duration).toBe(0.2);
  });

  it('parses raw JSON strings into timeline clips', () => {
    const jsonStr = JSON.stringify([
      { expression: 'smile', duration: 0.6 },
      { expression: 'wink', duration: 0.4 },
    ]);

    const clips = jsonToTimelineClips(jsonStr, mockExpressions);
    expect(clips).toHaveLength(2);
    expect(clips[0].expression.name).toBe('smile');
    expect(clips[0].duration).toBe(0.6);
    expect(clips[1].expression.name).toBe('wink');
    expect(clips[1].duration).toBe(0.4);
  });

  it('parses delimited sequence strings into timeline clips as fallback', () => {
    const seqStr = 'smile, 0.7; wink, 0.4';
    const clips = jsonToTimelineClips(seqStr, mockExpressions);
    expect(clips).toHaveLength(2);
    expect(clips[0].expression.name).toBe('smile');
    expect(clips[0].duration).toBe(0.7);
    expect(clips[1].expression.name).toBe('wink');
    expect(clips[1].duration).toBe(0.4);
  });

  it('handles invalid or empty input gracefully', () => {
    expect(jsonToTimelineClips(null, mockExpressions)).toEqual([]);
    expect(jsonToTimelineClips([], mockExpressions)).toEqual([]);
    expect(jsonToTimelineClips('invalid json or sequence', mockExpressions)).toEqual([]);
  });
});

describe('Timeline Bridge - Sequence Splicing at Playhead', () => {
  it('appends to an empty timeline', () => {
    const newClips = [{ id: 'c1', duration: 0.5 }, { id: 'c2', duration: 0.5 }];
    const result = insertSequenceAtPlayhead([], newClips, 0);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('c1');
  });

  it('splices new clips directly after the clip under the playhead', () => {
    // Existing timeline: [clipA: 0.0s - 1.0s], [clipB: 1.0s - 2.0s]
    const existing = [
      { id: 'clipA', duration: 1.0 },
      { id: 'clipB', duration: 1.0 },
    ];
    const newClips = [
      { id: 'clipNew1', duration: 0.4 },
      { id: 'clipNew2', duration: 0.4 },
    ];

    // Playhead is at 0.5s (inside clipA). New clips should insert right after clipA (index 1).
    const result = insertSequenceAtPlayhead(existing, newClips, 0.5);
    expect(result).toHaveLength(4);
    expect(result.map((c) => c.id)).toEqual(['clipA', 'clipNew1', 'clipNew2', 'clipB']);
  });

  it('appends to the end when playhead is past all clips', () => {
    const existing = [{ id: 'clipA', duration: 1.0 }];
    const newClips = [{ id: 'clipNew', duration: 0.5 }];

    const result = insertSequenceAtPlayhead(existing, newClips, 5.0);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual(['clipA', 'clipNew']);
  });
});
