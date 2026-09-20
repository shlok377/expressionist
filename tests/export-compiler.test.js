import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import { ExportCompiler } from '../server/ExportCompiler.js';

describe('ExportCompiler Module', () => {
  const mockExpressionsDir = '/app/expressions';
  const mockTempDir = '/app/temp';

  it('builds concat demuxer script with single-quote escaping and repeats last file', () => {
    const existingFiles = new Set([
      path.join(mockExpressionsDir, 'smile.png'),
      path.join(mockExpressionsDir, "it's cool.png"),
    ]);

    const mockFs = {
      existsSync: vi.fn((p) => existingFiles.has(p)),
    };

    const compiler = new ExportCompiler({
      expressionsDir: mockExpressionsDir,
      tempDir: mockTempDir,
      fileSystem: mockFs,
    });

    const clips = [
      { expression: { name: 'smile.png' }, duration: 0.6 },
      { expression: { name: "it's cool.png" }, duration: 1.2 },
    ];

    const script = compiler.buildConcatScript(clips);
    const lines = script.split('\n');

    expect(lines).toEqual([
      `file '${path.join(mockExpressionsDir, 'smile.png')}'`,
      'duration 0.6',
      `file '${path.join(mockExpressionsDir, "it'\\''s cool.png")}'`,
      'duration 1.2',
      `file '${path.join(mockExpressionsDir, "it'\\''s cool.png")}'`, // repeated without duration
    ]);
  });

  it('throws an error if an expression image is missing on disk', () => {
    const mockFs = {
      existsSync: vi.fn(() => false),
    };

    const compiler = new ExportCompiler({
      expressionsDir: mockExpressionsDir,
      tempDir: mockTempDir,
      fileSystem: mockFs,
    });

    const clips = [{ expression: { name: 'missing.png' }, duration: 0.6 }];
    expect(() => compiler.buildConcatScript(clips)).toThrow(/Image not found: missing\.png/);
  });

  it('compiles clips, invokes ffmpeg, and cleans up temp files', async () => {
    const writtenFiles = new Map();
    const mockFs = {
      existsSync: vi.fn(() => true),
      writeFileSync: vi.fn((p, content) => writtenFiles.set(p, content)),
      unlinkSync: vi.fn((p) => writtenFiles.delete(p)),
      statSync: vi.fn(() => ({ size: 1048576 })),
    };

    const mockExecutor = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });

    const compiler = new ExportCompiler({
      expressionsDir: mockExpressionsDir,
      tempDir: mockTempDir,
      executor: mockExecutor,
      fileSystem: mockFs,
    });

    const clips = [
      { expression: { name: 'smile.png' }, duration: 0.8 },
      { expression: { name: 'laugh.png' }, duration: 1.2 },
    ];

    const result = await compiler.compile(clips);

    expect(result.success).toBe(true);
    expect(result.filename).toMatch(/^export_\d+\.mp4$/);
    expect(result.downloadUrl).toBe(`/api/download/${result.filename}`);
    expect(result.totalDuration).toBe(2.0);
    expect(result.size).toBe(1048576);

    // Verify FFmpeg invocation
    expect(mockExecutor).toHaveBeenCalledTimes(1);
    const [command, args] = mockExecutor.mock.calls[0];
    expect(command).toBe('ffmpeg');
    expect(args).toContain('-f');
    expect(args).toContain('concat');
    expect(args).toContain('-safe');
    expect(args).toContain('0');
    expect(args).toContain('libx264');

    // Verify temp concat file was unlinked
    expect(mockFs.unlinkSync).toHaveBeenCalledTimes(1);
  });

  it('ensures temp concat file cleanup even if ffmpeg fails', async () => {
    const mockFs = {
      existsSync: vi.fn(() => true),
      writeFileSync: vi.fn(),
      unlinkSync: vi.fn(),
      statSync: vi.fn(),
    };

    const mockExecutor = vi.fn().mockRejectedValue(new Error('FFmpeg encoding failed'));

    const compiler = new ExportCompiler({
      expressionsDir: mockExpressionsDir,
      tempDir: mockTempDir,
      executor: mockExecutor,
      fileSystem: mockFs,
    });

    const clips = [{ expression: { name: 'smile.png' }, duration: 0.5 }];

    await expect(compiler.compile(clips)).rejects.toThrow('FFmpeg encoding failed');
    // Cleanup must run in finally block
    expect(mockFs.unlinkSync).toHaveBeenCalledTimes(1);
  });
});
