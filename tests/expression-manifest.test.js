import { describe, it, expect, vi } from 'vitest';
import { getCleanExpressionNames, syncExpressionManifest } from '../server/expressionManifest.js';

describe('Expression Manifest Module', () => {
  it('strips supported image extensions and sorts names alphabetically', () => {
    const mockFiles = [
      'wink.png',
      'angry.jpg',
      'blush with ring.png',
      'smile.webp',
      'ignore-me.txt',
      'NAUSIA.PNG',
    ];

    const mockFs = {
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => mockFiles),
    };

    const names = getCleanExpressionNames('/mock/dir', mockFs);

    expect(names).toEqual([
      'angry',
      'blush with ring',
      'NAUSIA',
      'smile',
      'wink',
    ]);
  });

  it('returns empty array if directory does not exist or errors', () => {
    const mockFs = {
      existsSync: vi.fn(() => false),
      readdirSync: vi.fn(() => []),
    };

    const names = getCleanExpressionNames('/nonexistent', mockFs);
    expect(names).toEqual([]);
  });

  it('syncs manifest by writing valid JSON array to disk', () => {
    let writtenPath = null;
    let writtenContent = null;

    const mockFs = {
      existsSync: vi.fn(() => true),
      readdirSync: vi.fn(() => ['smile.png', 'bruh.png']),
      mkdirSync: vi.fn(),
      writeFileSync: vi.fn((filePath, content) => {
        writtenPath = filePath;
        writtenContent = content;
      }),
    };

    const names = syncExpressionManifest('/mock/dir', '/mock/expressions_list.json', mockFs);

    expect(names).toEqual(['bruh', 'smile']);
    expect(writtenPath).toBe('/mock/expressions_list.json');
    expect(JSON.parse(writtenContent)).toEqual(['bruh', 'smile']);
  });
});
