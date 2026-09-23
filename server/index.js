import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const EXPRESSIONS_DIR = path.join(ROOT_DIR, 'expressions');
const TEMP_DIR = path.join(ROOT_DIR, 'temp files');

// Ensure directories exist
if (!fs.existsSync(EXPRESSIONS_DIR)) {
  fs.mkdirSync(EXPRESSIONS_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static expressions and temp files
app.use('/expressions', express.static(EXPRESSIONS_DIR));
app.use('/temp', express.static(TEMP_DIR));

const SUPPORTED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);

/**
 * Reads and returns expressions from the directory.
 */
function getExpressionsList() {
  try {
    const files = fs.readdirSync(EXPRESSIONS_DIR);
    return files
      .filter(file => SUPPORTED_EXTS.has(path.extname(file).toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .map(file => {
        const filePath = path.join(EXPRESSIONS_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          url: `/expressions/${encodeURIComponent(file)}`,
          size: stats.size,
          updatedAt: stats.mtimeMs,
        };
      });
  } catch (err) {
    console.error('Error reading expressions dir:', err);
    return [];
  }
}

// GET /api/expressions
app.get('/api/expressions', (req, res) => {
  const expressions = getExpressionsList();
  res.json({ expressions, count: expressions.length });
});

// SSE endpoint for live file watching
const sseClients = new Set();

app.get('/api/expressions/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const initialData = JSON.stringify({
    event: 'init',
    expressions: getExpressionsList(),
  });
  res.write(`data: ${initialData}\n\n`);

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

function broadcastExpressionsUpdate() {
  const list = getExpressionsList();
  const payload = JSON.stringify({
    event: 'update',
    expressions: list,
    count: list.length,
  });
  for (const client of sseClients) {
    client.write(`data: ${payload}\n\n`);
  }
}

// Watch expressions directory
const watcher = chokidar.watch(EXPRESSIONS_DIR, {
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 300,
    pollInterval: 100,
  },
});

watcher.on('add', () => broadcastExpressionsUpdate());
watcher.on('unlink', () => broadcastExpressionsUpdate());
watcher.on('change', () => broadcastExpressionsUpdate());

// POST /api/export with Bouncy Squash & Stretch Transition support
app.post('/api/export', async (req, res) => {
  try {
    const { clips, transitionSettings = {}, transitionDuration } = req.body;
    if (!Array.isArray(clips) || clips.length === 0) {
      return res.status(400).json({ error: 'No clips provided for export' });
    }

    const duration = Math.max(
      0.03,
      Math.min(0.30, parseFloat(transitionSettings.duration || transitionDuration) || 0.30)
    );
    const intensity = Math.max(
      0,
      Math.min(0.30, isNaN(parseFloat(transitionSettings.intensity)) ? 0.04 : parseFloat(transitionSettings.intensity))
    );
    const squash = Math.max(
      0,
      Math.min(0.25, isNaN(parseFloat(transitionSettings.squash)) ? 0.18 : parseFloat(transitionSettings.squash))
    );

    const timestamp = Date.now();
    const outputFileName = `export_${timestamp}.mp4`;
    const outputFilePath = path.join(TEMP_DIR, outputFileName);

    // Validate images exist
    for (const clip of clips) {
      const imageName = clip.expression?.name;
      if (!imageName) continue;
      const fullImagePath = path.join(EXPRESSIONS_DIR, imageName);
      if (!fs.existsSync(fullImagePath)) {
        return res.status(400).json({ error: `Image not found: ${imageName}` });
      }
    }

    // Build FFmpeg inputs & filter_complex for Bouncy Squash & Stretch
    const ffmpegArgs = ['-y', '-loglevel', 'error'];
    const filterChains = [];
    const concatInputs = [];

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const fullImagePath = path.join(EXPRESSIONS_DIR, clip.expression.name);
      
      ffmpegArgs.push('-loop', '1', '-t', clip.duration.toString(), '-i', fullImagePath);

      // Truncate to even dimensions to ensure strict YUV420p alignment
      const wExpr = `trunc(1792*(1+${intensity}*exp(-5*t/${duration})*cos(t/${duration}*3.14159*2))*(1+${squash}*exp(-6*t/${duration})*sin(t/${duration}*3.14159*2.5))/2)*2`;
      const hExpr = `trunc(2400*(1+${intensity}*exp(-5*t/${duration})*cos(t/${duration}*3.14159*2))*(1-${squash}*exp(-6*t/${duration})*sin(t/${duration}*3.14159*2.5)*0.75)/2)*2`;

      // Use a #0000ff (blue) 1792x2400 canvas and overlay centered to eliminate out-of-bounds crop errors
      filterChains.push(
        `color=c=0x0000ff:s=1792x2400:r=60:d=${clip.duration}[bg${i}]`,
        `[${i}:v]scale=${wExpr}:${hExpr}:eval=frame[sc${i}]`,
        `[bg${i}][sc${i}]overlay=(W-w)/2:(H-h)/2:eval=frame[v${i}]`
      );
      concatInputs.push(`[v${i}]`);
    }

    let filterComplex = filterChains.join('; ');
    if (clips.length > 1) {
      filterComplex += `; ${concatInputs.join('')}concat=n=${clips.length}:v=1:a=0[outv]`;
    } else {
      filterComplex += `; [v0]copy[outv]`;
    }

    ffmpegArgs.push(
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      '-r', '60',
      '-pix_fmt', 'yuv420p',
      '-c:v', 'libx264',
      outputFilePath
    );

    await execFileAsync('ffmpeg', ffmpegArgs, { maxBuffer: 10 * 1024 * 1024 });

    const stats = fs.statSync(outputFilePath);
    res.json({
      success: true,
      filename: outputFileName,
      downloadUrl: `/api/download/${outputFileName}`,
      streamUrl: `/temp/${encodeURIComponent(outputFileName)}`,
      size: stats.size,
      totalDuration: clips.reduce((acc, c) => acc + (c.duration || 0), 0),
      transitionSettings: { duration, intensity, squash },
    });
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message || 'Export failed' });
  }
});

// GET /api/download/:filename
app.get('/api/download/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(TEMP_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.download(filePath, filename);
});

// Serve frontend dist if available
const DIST_DIR = path.join(ROOT_DIR, 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log(`Expressionist backend running at http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`Port ${PORT} is in use, trying ${PORT + 1}...`);
    app.listen(PORT + 1, () => {
      console.log(`Expressionist backend running at http://localhost:${PORT + 1}`);
    });
  } else {
    console.error('Server error:', err);
  }
});
