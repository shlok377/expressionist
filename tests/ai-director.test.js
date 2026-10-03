import { describe, it, expect, vi } from 'vitest';
import {
  clampDuration,
  matchExpression,
  formatSequenceString,
  RateLimiter,
  AiDirector,
} from '../server/AiDirector.js';
import {
  estimateScriptDuration,
  formatSequence,
  parseSequenceString,
} from '../src/utils/aiDirector.js';

describe('AI Director Utilities & Clamping', () => {
  it('clamps durations strictly between 0.2s and 2.0s with 1 decimal precision', () => {
    expect(clampDuration(0.05)).toBe(0.2);
    expect(clampDuration(0.19)).toBe(0.2);
    expect(clampDuration(0.6)).toBe(0.6);
    expect(clampDuration(0.74)).toBe(0.7);
    expect(clampDuration(0.76)).toBe(0.8);
    expect(clampDuration(2.5)).toBe(2.0);
    expect(clampDuration('1.45')).toBe(1.5);
    expect(clampDuration('invalid')).toBe(0.6);
  });

  it('sanitizes and matches expression names with fallback', () => {
    const vocab = ['angry', 'blush', 'blush with ring', 'laughing', 'smile', 'wink'];

    // Exact match
    expect(matchExpression('smile', vocab)).toBe('smile');
    expect(matchExpression('WINK', vocab)).toBe('wink');
    expect(matchExpression('angry.png', vocab)).toBe('angry');

    // Substring match
    expect(matchExpression('blushing', vocab)).toBe('blush');

    // Fallback to "smile" if in vocab
    expect(matchExpression('nonexistent_pose', vocab)).toBe('smile');

    // Fallback to first available if smile not in vocab
    expect(matchExpression('nonexistent_pose', ['cry', 'mad'])).toBe('cry');
  });

  it('formats sequence into clean delimited string', () => {
    const items = [
      { expression: 'happy', duration: 0.5 },
      { expression: 'wink', duration: 0.2 },
      { expression: 'jump', duration: 0.6 },
    ];

    expect(formatSequenceString(items)).toBe('happy, 0.5; wink, 0.2; jump, 0.6');
    expect(formatSequenceString(items, { withExtension: true })).toBe(
      'happy.png, 0.5; wink.png, 0.2; jump.png, 0.6'
    );
  });
});

describe('RateLimiter', () => {
  it('allows requests within limits and enforces cooldown and rate limit', () => {
    const limiter = new RateLimiter({ maxRequests: 3, windowMs: 10000, cooldownMs: 100 });
    const ip = '192.168.1.1';

    // 1st request succeeds
    const res1 = limiter.isAllowed(ip);
    expect(res1.allowed).toBe(true);

    // Immediate 2nd request hits cooldown (< 100ms)
    const res2 = limiter.isAllowed(ip);
    expect(res2.allowed).toBe(false);
    expect(res2.error).toContain('Please wait');
  });
});

describe('AiDirector Service Module', () => {
  it('throws 401 when API key is missing', async () => {
    const director = new AiDirector();
    await expect(
      director.processScript({
        script: 'Hello world',
        apiKey: '',
      })
    ).rejects.toMatchObject({ status: 401 });
  });

  it('throws 400 when script text is empty', async () => {
    const director = new AiDirector();
    await expect(
      director.processScript({
        script: '   ',
        apiKey: 'test-key',
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('calls Gemini REST API with schema and returns validated sequence', async () => {
    const mockApiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify([
                  { expression: 'smile', duration: 0.6, scriptSegment: 'Welcome back!' },
                  { expression: 'wink', duration: 0.3, scriptSegment: 'Check this out' },
                  { expression: 'unknown_hallucinated', duration: 2.8, scriptSegment: 'Whoa!' },
                ]),
              },
            ],
          },
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    });

    const director = new AiDirector({
      rateLimiter: new RateLimiter({ maxRequests: 10, cooldownMs: 0 }),
      fetchImpl: mockFetch,
    });

    const result = await director.processScript({
      script: 'Welcome back! Check this out. Whoa!',
      targetDuration: 3.0,
      personality: 'High-Energy Mascot',
      availableExpressions: ['smile', 'wink', 'laughing'],
      apiKey: 'test-api-key',
    });

    expect(result.success).toBe(true);
    expect(result.count).toBe(3);
    // smile, 0.6; wink, 0.3; smile (fallback), 2.0 (clamped from 2.8)
    expect(result.items[0]).toEqual({ expression: 'smile', duration: 0.6, scriptSegment: 'Welcome back!' });
    expect(result.items[1]).toEqual({ expression: 'wink', duration: 0.3, scriptSegment: 'Check this out' });
    expect(result.items[2].expression).toBe('smile'); // fuzzy fallback
    expect(result.items[2].duration).toBe(2.0); // clamped max 2.0s
    expect(result.sequenceString).toBe('smile, 0.6; wink, 0.3; smile, 2.0');
    expect(result.sequenceStringWithExt).toBe('smile.png, 0.6; wink.png, 0.3; smile.png, 2.0');
  });

  it('handles Gemini 429 quota errors gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => JSON.stringify({ error: { message: 'Quota exceeded' } }),
    });

    const director = new AiDirector({
      rateLimiter: new RateLimiter({ maxRequests: 10, cooldownMs: 0 }),
      fetchImpl: mockFetch,
    });

    await expect(
      director.processScript({
        script: 'Test script',
        apiKey: 'test-key',
      })
    ).rejects.toMatchObject({ status: 429 });
  });
});

describe('Client-side Script Helpers', () => {
  it('estimates script duration from word count and pacing', () => {
    // 30 words at 150 WPM = 12 seconds
    const words30 = new Array(30).fill('word').join(' ');
    expect(estimateScriptDuration(words30, 'normal')).toBe(12);

    // At 120 WPM (slow) = 15 seconds
    expect(estimateScriptDuration(words30, 'slow')).toBe(15);

    // At 180 WPM (fast) = 10 seconds
    expect(estimateScriptDuration(words30, 'fast')).toBe(10);
  });

  it('formats and parses sequence strings reversibly', () => {
    const items = [
      { expression: 'angry', duration: 0.8 },
      { expression: 'smile', duration: 1.2 },
    ];

    const cleanStr = formatSequence(items, 'clean');
    expect(cleanStr).toBe('angry, 0.8; smile, 1.2');

    const extStr = formatSequence(items, 'extension');
    expect(extStr).toBe('angry.png, 0.8; smile.png, 1.2');

    const parsed = parseSequenceString(cleanStr);
    expect(parsed).toEqual(items);

    const parsedExt = parseSequenceString(extStr);
    expect(parsedExt).toEqual(items);
  });
});
