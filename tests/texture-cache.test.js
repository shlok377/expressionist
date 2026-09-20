import { describe, it, expect, vi } from 'vitest';
import { ExpressionTextureCache } from '../src/core/ExpressionTextureCache.js';

describe('ExpressionTextureCache Module', () => {
  it('loads, decodes, and caches textures using bitmapCreator', async () => {
    const mockBitmap = {
      width: 720,
      height: 960,
      close: vi.fn(),
    };

    const mockFetcher = vi.fn().mockResolvedValue({
      blob: () => Promise.resolve(new Blob(['fake-image-bytes'], { type: 'image/png' })),
    });

    const mockBitmapCreator = vi.fn().mockResolvedValue(mockBitmap);

    const cache = new ExpressionTextureCache({
      fetcher: mockFetcher,
      bitmapCreator: mockBitmapCreator,
    });

    expect(cache.has('/expressions/smile.png')).toBe(false);
    expect(cache.getTexture('/expressions/smile.png')).toBeNull();

    const loaded = await cache.loadTexture('/expressions/smile.png');
    expect(loaded).toBe(mockBitmap);
    expect(cache.has('/expressions/smile.png')).toBe(true);
    expect(cache.getTexture('/expressions/smile.png')).toBe(mockBitmap);
    expect(mockFetcher).toHaveBeenCalledWith('/expressions/smile.png');
    expect(mockBitmapCreator).toHaveBeenCalled();

    // Deduplication: second call returns cached instance without fetching again
    const cached = await cache.loadTexture('/expressions/smile.png');
    expect(cached).toBe(mockBitmap);
    expect(mockFetcher).toHaveBeenCalledTimes(1);
  });

  it('preloads multiple expressions concurrently', async () => {
    const mockBitmap = { width: 720, height: 960 };
    const mockFetcher = vi.fn().mockResolvedValue({
      blob: () => Promise.resolve(new Blob(['bytes'])),
    });
    const mockBitmapCreator = vi.fn().mockResolvedValue(mockBitmap);

    const cache = new ExpressionTextureCache({
      fetcher: mockFetcher,
      bitmapCreator: mockBitmapCreator,
    });

    const clips = [
      { expression: { url: '/expressions/1.png' } },
      { expression: { url: '/expressions/2.png' } },
    ];

    await cache.preloadExpressions(clips);
    expect(cache.has('/expressions/1.png')).toBe(true);
    expect(cache.has('/expressions/2.png')).toBe(true);
    expect(mockFetcher).toHaveBeenCalledTimes(2);
  });

  it('calculates aspect-ratio preserving letterbox dimensions correctly', () => {
    const cache = new ExpressionTextureCache({ width: 720, height: 960 });

    // Exact 3:4 aspect ratio image
    const exact = cache.calculateLetterbox(720, 960, 720, 960);
    expect(exact.drawWidth).toBe(720);
    expect(exact.drawHeight).toBe(960);
    expect(exact.offsetX).toBe(0);
    expect(exact.offsetY).toBe(0);

    // Square image (1:1 aspect ratio) in 3:4 container
    // Square image is wider than 3:4 container, so width is constrained
    const square = cache.calculateLetterbox(500, 500, 720, 960);
    expect(square.drawWidth).toBe(720);
    expect(square.drawHeight).toBe(720);
    expect(square.offsetX).toBe(0);
    expect(square.offsetY).toBe(120); // (960 - 720) / 2
  });

  it('clears cache and closes GPU textures', async () => {
    const mockBitmap = {
      width: 720,
      height: 960,
      close: vi.fn(),
    };

    const mockFetcher = vi.fn().mockResolvedValue({
      blob: () => Promise.resolve(new Blob(['bytes'])),
    });
    const mockBitmapCreator = vi.fn().mockResolvedValue(mockBitmap);

    const cache = new ExpressionTextureCache({
      fetcher: mockFetcher,
      bitmapCreator: mockBitmapCreator,
    });

    await cache.loadTexture('/expressions/wink.png');
    expect(cache.has('/expressions/wink.png')).toBe(true);

    cache.clear();
    expect(mockBitmap.close).toHaveBeenCalled();
    expect(cache.has('/expressions/wink.png')).toBe(false);
    expect(cache.getTexture('/expressions/wink.png')).toBeNull();
  });
});
