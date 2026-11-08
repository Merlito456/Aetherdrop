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

interface RelayTransfer {
  transferId: string;
  senderId: string;
  targetId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  mimeType: string;
  encryptionMode: string;
  isTetherMode: boolean;
  fingerprint?: string;
  rawKey?: number[];
  chunks: Map<number, Buffer>;
  acknowledgedChunks: Set<number>;
  completed: boolean;
  lastActive: number;
}

const peers = new Map<string, PeerInfo>();
const messageQueues = new Map<string, SignalMessage[]>();
const relayTransfers = new Map<string, RelayTransfer>();

// Prune inactive peers & expired relay transfers
setInterval(() => {
  const now = Date.now();
  for (const [id, peer] of peers.entries()) {
    if (now - peer.lastSeen > 25000) {
      peers.delete(id);
      messageQueues.delete(id);
    }
  }
  for (const [xferId, xfer] of relayTransfers.entries()) {
    if (now - xfer.lastActive > 45000) {
      relayTransfers.delete(xferId);
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

// Direct Peer lookup by PIN
app.get('/api/signal/peer-by-pin', (req, res) => {
  const pin = req.query.pin as string;
  if (!pin) {
    res.status(400).json({ error: 'Missing PIN parameter' });
    return;
  }
  const cleanPin = pin.trim();
  const now = Date.now();
  for (const peer of peers.values()) {
    if (peer.pin === cleanPin && now - peer.lastSeen < 25000) {
      res.json({
        peer: {
          id: peer.id,
          pin: peer.pin,
          name: peer.name,
          deviceType: peer.deviceType,
          browser: peer.browser,
          avatarColor: peer.avatarColor,
        },
      });
      return;
    }
  }
  res.status(404).json({ error: 'Peer with PIN not found' });
});

// High-Speed Relay Stream Endpoints (Guaranteed fallback for tether/hotspot mDNS drop)
app.post('/api/relay/init', (req, res) => {
  const {
    transferId,
    senderId,
    targetId,
    fileName,
    fileSize,
    totalChunks,
    mimeType,
    encryptionMode,
    isTetherMode,
    fingerprint,
    rawKey,
  } = req.body;

  if (!transferId || !senderId) {
    res.status(400).json({ error: 'Missing required transfer fields' });
    return;
  }

  const relay: RelayTransfer = {
    transferId,
    senderId,
    targetId: targetId || '',
    fileName: fileName || 'file',
    fileSize: fileSize || 0,
    totalChunks: totalChunks || 1,
    mimeType: mimeType || 'application/octet-stream',
    encryptionMode: encryptionMode || 'turbo-dtls',
    isTetherMode: Boolean(isTetherMode),
    fingerprint,
    rawKey,
    chunks: new Map(),
    acknowledgedChunks: new Set(),
    completed: false,
    lastActive: Date.now(),
  };

  relayTransfers.set(transferId, relay);

  // Notify target peer immediately through their message queue
  if (targetId) {
    const notifyMsg: SignalMessage = {
      id: Math.random().toString(36).slice(2, 10),
      senderId,
      targetId,
      type: 'FILE_OFFER_SIGNAL',
      payload: {
        type: 'FILE_OFFER',
        transferId,
        fileName,
        fileSize,
        mimeType,
        totalChunks,
        encryptionMode,
        isTetherMode,
        rawKey,
        fingerprint,
        viaRelay: true,
      },
      timestamp: Date.now(),
    };
    if (!messageQueues.has(targetId)) {
      messageQueues.set(targetId, []);
    }
    messageQueues.get(targetId)!.push(notifyMsg);
  }

  res.json({ ok: true, transferId });
});

app.post(
  '/api/relay/chunk',
  express.raw({ type: '*/*', limit: '10mb' }),
  (req, res) => {
    const transferId = req.query.transferId as string;
    const chunkIdx = parseInt(req.query.chunkIdx as string, 10);

    if (!transferId || isNaN(chunkIdx)) {
      res.status(400).json({ error: 'Missing transferId or chunkIdx' });
      return;
    }

    const relay = relayTransfers.get(transferId);
    if (!relay) {
      res.status(404).json({ error: 'Relay transfer not found' });
      return;
    }

    const bodyBuf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
    relay.chunks.set(chunkIdx, bodyBuf);
    relay.lastActive = Date.now();

    res.json({ ok: true, chunkIdx });
  }
);

app.get('/api/relay/pull', (req, res) => {
  const transferId = req.query.transferId as string;
  const afterIdx = parseInt((req.query.afterIdx as string) || '-1', 10);
  const limit = Math.min(parseInt((req.query.limit as string) || '16', 10), 32);

  if (!transferId) {
    res.status(400).json({ error: 'Missing transferId' });
    return;
  }

  const relay = relayTransfers.get(transferId);
  if (!relay) {
    res.status(404).json({ error: 'Relay transfer not found' });
    return;
  }

  relay.lastActive = Date.now();

  const available: Array<{ chunkIdx: number; data: string }> = [];
  const chunkKeys = Array.from(relay.chunks.keys()).sort((a, b) => a - b);

  for (const idx of chunkKeys) {
    if (idx > afterIdx) {
      const buf = relay.chunks.get(idx);
      if (buf) {
        available.push({
          chunkIdx: idx,
          data: buf.toString('base64'),
        });
        if (available.length >= limit) break;
      }
    }
  }

  res.json({
    transferId,
    totalChunks: relay.totalChunks,
    completed: relay.completed,
    chunks: available,
  });
});

app.post('/api/relay/ack', (req, res) => {
  const { transferId, chunkIndices } = req.body;
  if (transferId && Array.isArray(chunkIndices)) {
    const relay = relayTransfers.get(transferId);
    if (relay) {
      relay.lastActive = Date.now();
      for (const idx of chunkIndices) {
        relay.chunks.delete(idx);
        relay.acknowledgedChunks.add(idx);
      }
    }
  }
  res.json({ ok: true });
});

app.post('/api/relay/complete', (req, res) => {
  const { transferId } = req.body;
  if (transferId) {
    const relay = relayTransfers.get(transferId);
    if (relay) {
      relay.completed = true;
      relay.chunks.clear();
      setTimeout(() => relayTransfers.delete(transferId), 5000);
    }
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
