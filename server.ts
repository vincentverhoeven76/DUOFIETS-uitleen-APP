import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import type { DuofietsStatus } from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'duofiets-status.json');

function getCurrentTimeHHMM(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function loadStatus(): DuofietsStatus {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw) as DuofietsStatus;
    }
  } catch (err) {
    console.error('Kon statusbestand niet lezen:', err);
  }

  // Standaard staat de fiets klaar in de stalling (aanwezig)
  const initial: DuofietsStatus = {
    isAvailable: true,
    updatedAt: new Date().toISOString(),
  };
  saveStatus(initial);
  return initial;
}

function saveStatus(status: DuofietsStatus): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(status, null, 2), 'utf-8');
  } catch (err) {
    console.error('Kon status niet opslaan:', err);
  }
}

let currentStatus: DuofietsStatus = loadStatus();
const sseClients = new Set<express.Response>();

function broadcastStatus() {
  const payload = `data: ${JSON.stringify(currentStatus)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Real-time server-sent events for all open browser tabs/phones
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`data: ${JSON.stringify(currentStatus)}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
  });

  // Huidige status ophalen
  app.get('/api/status', (_req, res) => {
    res.json(currentStatus);
  });

  // Fiets meenemen / geleend melden (tot wanneer)
  app.post('/api/borrow', (req, res) => {
    const { expectedReturnTime } = req.body;
    if (!expectedReturnTime || typeof expectedReturnTime !== 'string') {
      res.status(400).json({ error: 'Geef aan tot hoe laat de fiets weg is.' });
      return;
    }

    currentStatus = {
      isAvailable: false,
      expectedReturnTime: expectedReturnTime.trim(),
      borrowedAt: getCurrentTimeHHMM(),
      updatedAt: new Date().toISOString(),
    };

    saveStatus(currentStatus);
    broadcastStatus();
    res.json(currentStatus);
  });

  // Terugkomsttijd aanpassen
  app.post('/api/extend', (req, res) => {
    const { expectedReturnTime } = req.body;
    if (!expectedReturnTime || typeof expectedReturnTime !== 'string') {
      res.status(400).json({ error: 'Geef een nieuwe verwachte terugkomsttijd op.' });
      return;
    }

    currentStatus = {
      ...currentStatus,
      isAvailable: false,
      expectedReturnTime: expectedReturnTime.trim(),
      updatedAt: new Date().toISOString(),
    };

    saveStatus(currentStatus);
    broadcastStatus();
    res.json(currentStatus);
  });

  // Fiets teruggebracht melden
  app.post('/api/return', (_req, res) => {
    currentStatus = {
      isAvailable: true,
      expectedReturnTime: undefined,
      borrowedAt: undefined,
      updatedAt: new Date().toISOString(),
    };

    saveStatus(currentStatus);
    broadcastStatus();
    res.json(currentStatus);
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Duofiets server draait op http://0.0.0.0:${PORT}`);
  });
}

startServer();
