import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { syncExpressionManifest } from './expressionManifest.js';
import { AiDirector } from './AiDirector.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const EXPRESSIONS_DIR = path.join(ROOT_DIR, 'expressions');
const TEMP_DIR = path.join(ROOT_DIR, 'temp files');
const MANIFEST_PATH = path.join(ROOT_DIR, 'expressions_list.json');

// Ensure directories exist and sync initial expressions manifest
if (!fs.existsSync(EXPRESSIONS_DIR)) {
  fs.mkdirSync(EXPRESSIONS_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}
syncExpressionManifest(EXPRESSIONS_DIR, MANIFEST_PATH);

const aiDirector = new AiDirector();

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

// GET /api/expressions/manifest
app.get('/api/expressions/manifest', (req, res) => {
  try {
    if (fs.existsSync(MANIFEST_PATH)) {
      const content = fs.readFileSync(MANIFEST_PATH, 'utf-8');
      return res.json({ names: JSON.parse(content) });
    }
  } catch (err) {
    console.error('Error reading manifest file:', err);
  }
  const names = syncExpressionManifest(EXPRESSIONS_DIR, MANIFEST_PATH);
  res.json({ names });
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
  syncExpressionManifest(EXPRESSIONS_DIR, MANIFEST_PATH);
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

// POST /api/ai/director
app.post('/api/ai/director', async (req, res) => {
  try {
    const apiKey = req.headers['x-gemini-api-key'];
    const { script, targetDuration, personality, customPrompt, model } = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    let availableExpressions = [];
    try {
      if (fs.existsSync(MANIFEST_PATH)) {
        availableExpressions = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
      }
    } catch {
      availableExpressions = syncExpressionManifest(EXPRESSIONS_DIR, MANIFEST_PATH);
    }
    if (!availableExpressions || availableExpressions.length === 0) {
      availableExpressions = syncExpressionManifest(EXPRESSIONS_DIR, MANIFEST_PATH);
    }

    const result = await aiDirector.processScript({
      script,
      targetDuration: targetDuration ? parseFloat(targetDuration) : null,
      personality,
      customPrompt,
      availableExpressions,
      apiKey,
      model,
      ip: clientIp,
    });

    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    const message = err.message || 'AI Director generation failed';
    res.status(status).json({
      error: message,
      retryAfter: err.retryAfter,
    });
  }
});

// POST /api/export with Bouncy Squash & Stretch Transition support
app.post('/api/export', async (req, res) => {
  try {
    const {
      clips,
      transitionSettings = {},
      transitionDuration,
      bounceIntensity,
      squashFactor,
      globalScale = 1.0,
    } = req.body;

    if (!Array.isArray(clips) || clips.length === 0) {
      return res.status(400).json({ error: 'No clips provided for export' });
    }

    const duration = Math.max(
      0.03,
      Math.min(0.30, parseFloat(transitionSettings.duration || transitionDuration) || 0.30)
    );
    const intensity = Math.max(
      0,
      Math.min(
        0.30,
        isNaN(parseFloat(transitionSettings.intensity ?? bounceIntensity))
          ? 0.04
          : parseFloat(transitionSettings.intensity ?? bounceIntensity)
      )
    );
    const squash = Math.max(
      0,
      Math.min(
        0.25,
        isNaN(parseFloat(transitionSettings.squash ?? squashFactor))
          ? 0.18
          : parseFloat(transitionSettings.squash ?? squashFactor)
      )
    );
    const scale = Math.max(0.1, Math.min(3.0, parseFloat(globalScale) || 1.0));

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
      const wExpr = `trunc(1792*${scale}*(1+${intensity}*exp(-5*t/${duration})*cos(t/${duration}*3.14159*2))*(1+${squash}*exp(-6*t/${duration})*sin(t/${duration}*3.14159*2.5))/2)*2`;
      const hExpr = `trunc(2400*${scale}*(1+${intensity}*exp(-5*t/${duration})*cos(t/${duration}*3.14159*2))*(1-${squash}*exp(-6*t/${duration})*sin(t/${duration}*3.14159*2.5)*0.75)/2)*2`;

      // Use a #00ff00 (green) 1792x2400 canvas and overlay centered to eliminate out-of-bounds crop errors
      filterChains.push(
        `color=c=0x00ff00:s=1792x2400:r=60:d=${clip.duration}[bg${i}]`,
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
      globalScale: scale,
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
