import express from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = 'nixsite9303';

// Storage directories
const STORAGE_DIR = path.join(__dirname, 'storage');
const AUDIO_DIR = path.join(STORAGE_DIR, 'audio');
const DB_FILE = path.join(STORAGE_DIR, 'db.json');

if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

// JSON database interface
interface AudioTrack {
  id: string;
  name: string;
  originalFileName: string;
  originalFilePath: string;
  reversedFilePath?: string;
  originalSize: number;
  reversedSize?: number;
  mimeType: string;
  duration: number; // in seconds
  createdAt: string;
  scanCount: number;
  downloadCount: number;
}

interface Database {
  tracks: AudioTrack[];
}

function loadDB(): Database {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading db.json:', err);
  }
  return { tracks: [] };
}

function saveDB(db: Database) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving db.json:', err);
  }
}

// Multer setup for large audio files (up to 500MB)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, AUDIO_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.audio';
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Health / Ping
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', name: 'NixReverse Engine' });
});

// Upload audio track
app.post('/api/upload', upload.single('audio'), (req: Request, res: Response): void => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'Səs faylı tapılmadı.' });
    return;
  }

  const { title, duration } = req.body;
  const id = 'nix_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

  const track: AudioTrack = {
    id,
    name: title || file.originalname,
    originalFileName: file.originalname,
    originalFilePath: file.filename,
    originalSize: file.size,
    mimeType: file.mimetype || 'audio/wav',
    duration: duration ? parseFloat(duration) : 0,
    createdAt: new Date().toISOString(),
    scanCount: 0,
    downloadCount: 0,
  };

  const db = loadDB();
  db.tracks.unshift(track);
  saveDB(db);

  res.json({ success: true, track });
});

// Save reversed audio track (either uploaded as blob or created)
app.post('/api/save-reversed', upload.single('reversedAudio'), (req: Request, res: Response): void => {
  const file = req.file;
  const { trackId, duration } = req.body;

  if (!file || !trackId) {
    res.status(400).json({ error: 'Məlumatlar natamamdır.' });
    return;
  }

  const db = loadDB();
  const track = db.tracks.find((t) => t.id === trackId);
  if (!track) {
    // If original track wasn't saved separately, register this as the full track
    const newTrack: AudioTrack = {
      id: trackId,
      name: req.body.title || 'Tərsinə Səs',
      originalFileName: file.originalname,
      originalFilePath: file.filename,
      reversedFilePath: file.filename,
      originalSize: file.size,
      reversedSize: file.size,
      mimeType: file.mimetype || 'audio/wav',
      duration: duration ? parseFloat(duration) : 0,
      createdAt: new Date().toISOString(),
      scanCount: 0,
      downloadCount: 0,
    };
    db.tracks.unshift(newTrack);
    saveDB(db);
    res.json({ success: true, track: newTrack });
    return;
  }

  track.reversedFilePath = file.filename;
  track.reversedSize = file.size;
  if (duration) track.duration = parseFloat(duration);
  saveDB(db);

  res.json({ success: true, track });
});

// Get single track info
app.get('/api/tracks/:id', (req: Request, res: Response): void => {
  const { id } = req.params;
  const db = loadDB();
  const track = db.tracks.find((t) => t.id === id);

  if (!track) {
    res.status(404).json({ error: 'Səs faylı tapılmadı.' });
    return;
  }

  res.json({ success: true, track });
});

// Increment scan count when QR code is scanned
app.post('/api/tracks/:id/scan', (req: Request, res: Response): void => {
  const { id } = req.params;
  const db = loadDB();
  const track = db.tracks.find((t) => t.id === id);

  if (track) {
    track.scanCount = (track.scanCount || 0) + 1;
    saveDB(db);
  }

  res.json({ success: true, scanCount: track ? track.scanCount : 0 });
});

// Audio stream with HTTP Range support (scrubbing, seeking, 1h+ support)
app.get('/api/audio/:id/stream', (req: Request, res: Response): void => {
  const { id } = req.params;
  const type = req.query.type === 'original' ? 'original' : 'reversed';

  const db = loadDB();
  const track = db.tracks.find((t) => t.id === id);

  if (!track) {
    res.status(404).send('Track not found');
    return;
  }

  const filename = type === 'original' ? track.originalFilePath : (track.reversedFilePath || track.originalFilePath);
  const filePath = path.join(AUDIO_DIR, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).send('File on disk not found');
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  let contentType = 'audio/wav';
  if (filename.endsWith('.mp3')) contentType = 'audio/mpeg';
  else if (filename.endsWith('.ogg')) contentType = 'audio/ogg';
  else if (filename.endsWith('.m4a') || filename.endsWith('.aac')) contentType = 'audio/mp4';
  else if (filename.endsWith('.flac')) contentType = 'audio/flac';

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    });
    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// Download audio file or ZIP bundle
app.get('/api/audio/:id/download', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const type = req.query.type as string; // 'reversed' | 'original' | 'zip'

  const db = loadDB();
  const track = db.tracks.find((t) => t.id === id);

  if (!track) {
    res.status(404).send('Səs faylı tapılmadı');
    return;
  }

  // Increment download count
  track.downloadCount = (track.downloadCount || 0) + 1;
  saveDB(db);

  if (type === 'zip') {
    const zip = new JSZip();
    const cleanName = track.name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

    // Add reversed audio
    const revFilename = track.reversedFilePath || track.originalFilePath;
    const revPath = path.join(AUDIO_DIR, revFilename);
    if (fs.existsSync(revPath)) {
      const revData = fs.readFileSync(revPath);
      const ext = path.extname(revFilename) || '.wav';
      zip.file(`${cleanName}_reversed${ext}`, revData);
    }

    // Add original audio if different
    if (track.originalFilePath && track.originalFilePath !== track.reversedFilePath) {
      const origPath = path.join(AUDIO_DIR, track.originalFilePath);
      if (fs.existsSync(origPath)) {
        const origData = fs.readFileSync(origPath);
        const ext = path.extname(track.originalFilePath) || '.wav';
        zip.file(`${cleanName}_original${ext}`, origData);
      }
    }

    // Add info README text
    zip.file('info.txt', `NixReverse Audio Package\nTrack: ${track.name}\nCreated: ${track.createdAt}\nDuration: ${track.duration.toFixed(1)}s\nGenerated with NixReverse`);

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanName}_reversed.zip"`);
    res.send(zipBuffer);
    return;
  }

  // Single file download
  const isOriginal = type === 'original';
  const targetFilename = isOriginal ? track.originalFilePath : (track.reversedFilePath || track.originalFilePath);
  const filePath = path.join(AUDIO_DIR, targetFilename);

  if (!fs.existsSync(filePath)) {
    res.status(404).send('Fayl mövcud deyil');
    return;
  }

  const ext = path.extname(targetFilename) || '.wav';
  const downloadName = isOriginal ? track.name : `${path.parse(track.name).name}_reversed${ext}`;

  res.download(filePath, downloadName);
});

// Admin Authentication
app.post('/api/admin/login', (req: Request, res: Response): void => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    // Generate a simple secure token based on timestamp and secret
    const token = Buffer.from(`${ADMIN_PASSWORD}_${Date.now()}`).toString('base64');
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, error: 'Parol yanlışdır!' });
  }
});

// Middleware to verify admin token
function requireAdmin(req: Request, res: Response, next: () => void): void {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'İcazə verilmədi.' });
    return;
  }

  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    if (decoded.startsWith(ADMIN_PASSWORD)) {
      next();
      return;
    }
  } catch (_e) {
    // Invalid token format
  }

  res.status(401).json({ error: 'Sessiyanın vaxtı bitib və ya parol yanlışdır.' });
}

// Admin: Get all tracks and stats
app.get('/api/admin/tracks', requireAdmin, (_req: Request, res: Response): void => {
  const db = loadDB();
  res.json({ success: true, tracks: db.tracks });
});

// Admin: Get dashboard overview stats
app.get('/api/admin/stats', requireAdmin, (_req: Request, res: Response): void => {
  const db = loadDB();
  const totalTracks = db.tracks.length;
  const totalDuration = db.tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  const totalStorageBytes = db.tracks.reduce((acc, t) => acc + (t.originalSize || 0) + (t.reversedSize || 0), 0);
  const totalScans = db.tracks.reduce((acc, t) => acc + (t.scanCount || 0), 0);
  const totalDownloads = db.tracks.reduce((acc, t) => acc + (t.downloadCount || 0), 0);

  res.json({
    success: true,
    stats: {
      totalTracks,
      totalDuration,
      totalStorageBytes,
      totalScans,
      totalDownloads,
    },
  });
});

// Admin: Delete track
app.delete('/api/admin/tracks/:id', requireAdmin, (req: Request, res: Response): void => {
  const { id } = req.params;
  const db = loadDB();
  const trackIndex = db.tracks.findIndex((t) => t.id === id);

  if (trackIndex === -1) {
    res.status(404).json({ error: 'Track tapılmadı.' });
    return;
  }

  const track = db.tracks[trackIndex];

  // Remove files
  try {
    if (track.originalFilePath) {
      const p1 = path.join(AUDIO_DIR, track.originalFilePath);
      if (fs.existsSync(p1)) fs.unlinkSync(p1);
    }
    if (track.reversedFilePath && track.reversedFilePath !== track.originalFilePath) {
      const p2 = path.join(AUDIO_DIR, track.reversedFilePath);
      if (fs.existsSync(p2)) fs.unlinkSync(p2);
    }
  } catch (err) {
    console.error('Error deleting files from disk:', err);
  }

  db.tracks.splice(trackIndex, 1);
  saveDB(db);

  res.json({ success: true });
});

// Admin: Clear all tracks
app.delete('/api/admin/clear-all', requireAdmin, (_req: Request, res: Response): void => {
  const db = loadDB();

  // Remove all files
  for (const track of db.tracks) {
    try {
      if (track.originalFilePath) {
        const p1 = path.join(AUDIO_DIR, track.originalFilePath);
        if (fs.existsSync(p1)) fs.unlinkSync(p1);
      }
      if (track.reversedFilePath && track.reversedFilePath !== track.originalFilePath) {
        const p2 = path.join(AUDIO_DIR, track.reversedFilePath);
        if (fs.existsSync(p2)) fs.unlinkSync(p2);
      }
    } catch (_e) {
      // Ignore
    }
  }

  db.tracks = [];
  saveDB(db);

  res.json({ success: true });
});

// Mount Vite or static server
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 NixReverse Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup error:', err);
});
