import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Strict no-caching middleware for privacy & data security
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

app.use(express.json({ limit: '1mb' }));

// In-memory peer signaling store (never stores any file data!)
interface PeerInfo {
  id: string;
  pin: string;
  name: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  avatarColor: string;
  roomId: string;
  lastSeen: number;
}

interface SignalMessage {
  id: string;
  senderId: string;
  targetId: string;
  type: string;
  payload: any;
  timestamp: number;
}

const peers = new Map<string, PeerInfo>();
const messageQueues = new Map<string, SignalMessage[]>();

// Prune inactive peers every 15 seconds
setInterval(() => {
  const now = Date.now();
  for (const [id, peer] of peers.entries()) {
    if (now - peer.lastSeen > 25000) {
      peers.delete(id);
      messageQueues.delete(id);
    }
  }
}, 10000);

// API Routes for WebRTC Signaling & Local Peer Discovery
app.post('/api/signal/register', (req, res) => {
  const { id, pin, name, deviceType, browser, avatarColor, roomId } = req.body;
  if (!id || !name) {
    res.status(400).json({ error: 'Missing required peer fields' });
    return;
  }
  peers.set(id, {
    id,
    pin: pin || '',
    name,
    deviceType: deviceType || 'desktop',
    browser: browser || 'Unknown',
    avatarColor: avatarColor || '#06b6d4',
    roomId: roomId || 'default-lan',
    lastSeen: Date.now(),
  });
  if (!messageQueues.has(id)) {
    messageQueues.set(id, []);
  }
  res.json({ success: true, peerId: id });
});

app.post('/api/signal/heartbeat', (req, res) => {
  const { id } = req.body;
  if (id && peers.has(id)) {
    const peer = peers.get(id)!;
    peer.lastSeen = Date.now();
    peers.set(id, peer);
  }
  res.json({ ok: true });
});

app.get('/api/signal/peers', (req, res) => {
  const roomId = (req.query.roomId as string) || 'default-lan';
  const excludeId = req.query.excludeId as string;
  const now = Date.now();

  const peerList = Array.from(peers.values())
    .filter(p => p.roomId === roomId && p.id !== excludeId && (now - p.lastSeen < 25000))
    .map(({ id, pin, name, deviceType, browser, avatarColor }) => ({
      id,
      pin,
      name,
      deviceType,
      browser,
      avatarColor,
    }));

  res.json({ peers: peerList });
});

app.post('/api/signal/send', (req, res) => {
  const { senderId, targetId, targetPin, roomId, type, payload, data } = req.body;
  if (!senderId) {
    res.status(400).json({ error: 'Invalid signal payload: missing senderId' });
    return;
  }

  const packet = data || payload || req.body;
  const msg: SignalMessage = {
    id: Math.random().toString(36).slice(2, 10),
    senderId,
    targetId: targetId || '',
    type: type || packet.type || 'SIGNAL',
    payload: packet,
    timestamp: Date.now(),
  };

  // Route to target peer by PIN
  if (targetPin) {
    for (const [id, peer] of peers.entries()) {
      if (peer.pin === targetPin && id !== senderId) {
        if (!messageQueues.has(id)) messageQueues.set(id, []);
        messageQueues.get(id)!.push(msg);
      }
    }
  } else if (targetId === 'room' || !targetId) {
    // Room broadcast
    const currentRoom = roomId || 'default-lan';
    for (const [id, peer] of peers.entries()) {
      if (peer.roomId === currentRoom && id !== senderId) {
        if (!messageQueues.has(id)) messageQueues.set(id, []);
        messageQueues.get(id)!.push(msg);
      }
    }
  } else {
    // Direct peer delivery
    if (!messageQueues.has(targetId)) {
      messageQueues.set(targetId, []);
    }
    messageQueues.get(targetId)!.push(msg);
  }

  res.json({ success: true });
});

app.get('/api/signal/messages', (req, res) => {
  const peerId = req.query.peerId as string;
  if (!peerId) {
    res.status(400).json({ error: 'Missing peerId parameter' });
    return;
  }

  const queue = messageQueues.get(peerId) || [];
  messageQueues.set(peerId, []); // flush polled messages
  res.json({ messages: queue });
});

app.post('/api/signal/leave', (req, res) => {
  const { id } = req.body;
  if (id) {
    peers.delete(id);
    messageQueues.delete(id);
  }
  res.json({ ok: true });
});

// App URL info
app.get('/api/info', (_req, res) => {
  res.json({
    status: 'online',
    encryption: 'AES-256-GCM / WebRTC DTLS',
    zeroCache: true,
    localSignaling: true,
  });
});

async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`AetherDrop server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
