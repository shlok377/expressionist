import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Deep Export Compiler Module.
 * Encapsulates FFmpeg concat demuxer script generation, quote escaping,
 * subprocess execution, and temp file lifecycle behind a single compilation interface.
 */
export class ExportCompiler {
  constructor({
    expressionsDir,
    tempDir,
    executor = execFileAsync,
    fileSystem = fs,
  } = {}) {
    this.expressionsDir = expressionsDir;
    this.tempDir = tempDir;
    this.executor = executor;
    this.fs = fileSystem;
  }

  /**
   * Generates valid FFmpeg concat demuxer script text from clips.
   * Handles single-quote escaping and repeats the final entry per FFmpeg spec.
   */
  buildConcatScript(clips) {
    if (!Array.isArray(clips) || clips.length === 0) {
      throw new Error('No clips provided for export');
    }

    const concatLines = [];

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const imageName = clip.expression?.name;
      if (!imageName) continue;

      const fullImagePath = path.join(this.expressionsDir, imageName);
      if (!this.fs.existsSync(fullImagePath)) {
        throw new Error(`Image not found: ${imageName}`);
      }

      // Escape single quotes for ffmpeg concat demuxer syntax
      const escapedPath = fullImagePath.replace(/'/g, "'\\''");
      concatLines.push(`file '${escapedPath}'`);
      concatLines.push(`duration ${clip.duration}`);
    }

    // FFmpeg concat demuxer requirement: repeat the last file without duration
    if (clips.length > 0) {
      const lastImageName = clips[clips.length - 1].expression?.name;
      if (lastImageName) {
        const fullImagePath = path.join(this.expressionsDir, lastImageName);
        const escapedPath = fullImagePath.replace(/'/g, "'\\''");
        concatLines.push(`file '${escapedPath}'`);
      }
    }

    return concatLines.join('\n');
  }

  /**
   * Compiles clips into an MP4 video file.
   * Cleans up the temporary concat file in a finally block.
   */
  async compile(clips) {
    if (!Array.isArray(clips) || clips.length === 0) {
      throw new Error('No clips provided for export');
    }

    const timestamp = Date.now();
    const concatFilePath = path.join(this.tempDir, `concat_${timestamp}.txt`);
    const outputFileName = `export_${timestamp}.mp4`;
    const outputFilePath = path.join(this.tempDir, outputFileName);

    const concatScript = this.buildConcatScript(clips);
    this.fs.writeFileSync(concatFilePath, concatScript);

    const ffmpegArgs = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatFilePath,
      '-fps_mode', 'vfr',
      '-pix_fmt', 'yuv420p',
      '-c:v', 'libx264',
      outputFilePath,
    ];

    try {
      await this.executor('ffmpeg', ffmpegArgs);
    } finally {
      // Guaranteed cleanup of temp concat script
      try {
        if (this.fs.existsSync(concatFilePath)) {
          this.fs.unlinkSync(concatFilePath);
        }
      } catch (cleanupErr) {
        console.warn('Failed to unlink concat temp file:', concatFilePath, cleanupErr);
      }
    }

    const stats = this.fs.statSync(outputFilePath);
    const totalDuration = clips.reduce((acc, c) => acc + (c.duration || 0), 0);

    return {
      success: true,
      filename: outputFileName,
      filePath: outputFilePath,
      downloadUrl: `/api/download/${outputFileName}`,
      streamUrl: `/temp/${encodeURIComponent(outputFileName)}`,
      size: stats.size,
      totalDuration,
    };
  }
}
