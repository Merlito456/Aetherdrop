import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';

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
  targetPin?: string;
  roomId?: string;
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
  senderCompleted: boolean;
  receiverCompleted: boolean;
  lastActive: number;
}

const peers = new Map<string, PeerInfo>();
const peerSockets = new Map<string, WebSocket>();
const messageQueues = new Map<string, SignalMessage[]>();
const relayTransfers = new Map<string, RelayTransfer>();

// Fast WebSocket server mounted on same HTTP server
const wss = new WebSocketServer({ server, path: '/api/ws' });

function broadcastToRoom(roomId: string, message: any, excludePeerId?: string) {
  const payload = JSON.stringify(message);
  for (const [id, peer] of peers.entries()) {
    if (peer.roomId === roomId && id !== excludePeerId) {
      const ws = peerSockets.get(id);
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(payload); } catch {}
      }
    }
  }
}

function sendToPeer(targetId: string, message: any) {
  const ws = peerSockets.get(targetId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
      return true;
    } catch {}
  }
  return false;
}

function routeSignalMessage(msg: SignalMessage, targetId?: string, targetPin?: string, roomId?: string) {
  const currentRoom = roomId || 'default-lan';
  const deliveredPeerIds = new Set<string>();

  // Extract PIN if targetId is formatted as peer_pin_XXXX
  const effectivePin = (targetPin || (targetId && String(targetId).startsWith('peer_pin_') ? String(targetId).replace('peer_pin_', '') : undefined))?.trim();

  // 1. Direct delivery by targetId if specified and not 'room'
  if (targetId && targetId !== 'room') {
    if (peers.has(targetId) || peerSockets.has(targetId)) {
      if (!messageQueues.has(targetId)) messageQueues.set(targetId, []);
      messageQueues.get(targetId)!.push(msg);
      sendToPeer(targetId, msg);
      deliveredPeerIds.add(targetId);
    }
  }

  // 2. Direct delivery by effective PIN (across all rooms)
  if (effectivePin) {
    for (const [id, peer] of peers.entries()) {
      if (peer.pin === effectivePin && id !== msg.senderId) {
        if (!messageQueues.has(id)) messageQueues.set(id, []);
        messageQueues.get(id)!.push(msg);
        sendToPeer(id, msg);
        deliveredPeerIds.add(id);
      }
    }
  }

  // 3. Room broadcast if explicitly addressed to room or untargeted
  if (targetId === 'room' || (!targetId && !effectivePin) || (targetId === 'room' && deliveredPeerIds.size === 0)) {
    for (const [id, peer] of peers.entries()) {
      if (peer.roomId === currentRoom && id !== msg.senderId && !deliveredPeerIds.has(id)) {
        if (!messageQueues.has(id)) messageQueues.set(id, []);
        messageQueues.get(id)!.push(msg);
        sendToPeer(id, msg);
        deliveredPeerIds.add(id);
      }
    }
  }

  return deliveredPeerIds.size > 0;
}

wss.on('connection', (ws) => {
  let clientPeerId: string | null = null;

  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      if (parsed.type === 'WS_REGISTER') {
        const { id, pin, name, deviceType, browser, avatarColor, roomId } = parsed;
        if (id) {
          clientPeerId = id;
          peerSockets.set(id, ws);
          peers.set(id, {
            id,
            pin: pin || '',
            name: name || 'User',
            deviceType: deviceType || 'desktop',
            browser: browser || 'Unknown',
            avatarColor: avatarColor || '#06b6d4',
            roomId: roomId || 'default-lan',
            lastSeen: Date.now(),
          });
          if (!messageQueues.has(id)) messageQueues.set(id, []);

          // Flush any pending messages that arrived before WS connection
          const pending = messageQueues.get(id) || [];
          if (pending.length > 0) {
            for (const m of pending) {
              try { ws.send(JSON.stringify(m)); } catch {}
            }
            messageQueues.set(id, []);
          }

          // Acknowledge connection
          ws.send(JSON.stringify({ type: 'WS_REGISTER_ACK', peerId: id }));
        }
      } else if (parsed.type === 'WS_SIGNAL') {
        const { senderId, targetId, targetPin, roomId, payload } = parsed;
        if (senderId) {
          const msg: SignalMessage = {
            id: Math.random().toString(36).slice(2, 10),
            senderId,
            targetId: targetId || '',
            type: payload?.type || 'SIGNAL',
            payload,
            timestamp: Date.now(),
          };
          routeSignalMessage(msg, targetId, targetPin, roomId);
        }
      } else if (parsed.type === 'WS_RELAY_CHUNK') {
        // Fast-path WebSocket binary chunk relay: route directly to target peer socket or by targetPin
        const { targetId, targetPin, transferId, chunkIdx, data } = parsed;
        if (data) {
          let targetWs = targetId && targetId !== 'room' && !String(targetId).startsWith('peer_pin_') ? peerSockets.get(targetId) : undefined;
          const effectiveTargetPin = (targetPin || (targetId && String(targetId).startsWith('peer_pin_') ? String(targetId).replace('peer_pin_', '') : undefined))?.trim();
          
          // Fallback: look up socket by effective PIN
          if (!targetWs && effectiveTargetPin) {
            for (const [id, peer] of peers.entries()) {
              if (peer.pin === effectiveTargetPin && id !== clientPeerId) {
                targetWs = peerSockets.get(id);
                if (targetWs) break;
              }
            }
          }

          // Fallback: lookup from relayTransfers
          if (!targetWs && transferId && relayTransfers.has(transferId)) {
            const relay = relayTransfers.get(transferId)!;
            if (relay.targetId && !relay.targetId.startsWith('peer_pin_')) targetWs = peerSockets.get(relay.targetId);
            const relayPin = (relay.targetPin || (relay.targetId && relay.targetId.startsWith('peer_pin_') ? relay.targetId.replace('peer_pin_', '') : undefined))?.trim();
            if (!targetWs && relayPin) {
              for (const [id, peer] of peers.entries()) {
                if (peer.pin === relayPin && id !== relay.senderId) {
                  targetWs = peerSockets.get(id);
                  if (targetWs) break;
                }
              }
            }
          }

          if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            try {
              targetWs.send(JSON.stringify({
                type: 'WS_INCOMING_CHUNK',
                transferId,
                chunkIdx,
                data,
              }));
            } catch {}
          }
        }
      } else if (parsed.type === 'WS_HEARTBEAT') {
        if (clientPeerId && peers.has(clientPeerId)) {
          const p = peers.get(clientPeerId)!;
          p.lastSeen = Date.now();
          peers.set(clientPeerId, p);
        }
      }
    } catch (e) {
      console.warn('WS message error:', e);
    }
  });

  ws.on('close', () => {
    if (clientPeerId) {
      peerSockets.delete(clientPeerId);
    }
  });

  ws.on('error', () => {
    if (clientPeerId) {
      peerSockets.delete(clientPeerId);
    }
  });
});

// Prune inactive peers & expired relay transfers (generous 90s window for mobile screen sleep)
setInterval(() => {
  const now = Date.now();
  for (const [id, peer] of peers.entries()) {
    const isSocketOpen = peerSockets.has(id) && peerSockets.get(id)?.readyState === WebSocket.OPEN;
    if (!isSocketOpen && now - peer.lastSeen > 90000) {
      peers.delete(id);
      messageQueues.delete(id);
      peerSockets.delete(id);
    }
  }
  for (const [xferId, xfer] of relayTransfers.entries()) {
    if (now - xfer.lastActive > 90000) {
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

  routeSignalMessage(msg, targetId, targetPin, roomId);

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
    const ws = peerSockets.get(id);
    if (ws) {
      try { ws.close(); } catch {}
      peerSockets.delete(id);
    }
  }
  res.json({ ok: true });
});

// Direct Peer lookup by PIN (Works across all rooms with active socket or recent heartbeat)
app.get('/api/signal/peer-by-pin', (req, res) => {
  const pin = req.query.pin as string;
  if (!pin) {
    res.status(400).json({ error: 'Missing PIN parameter' });
    return;
  }
  const cleanPin = pin.trim();
  const now = Date.now();
  let candidate: PeerInfo | null = null;

  for (const peer of peers.values()) {
    if (peer.pin === cleanPin) {
      if (!candidate || peer.lastSeen > candidate.lastSeen) {
        candidate = peer;
      }
    }
  }

  // Found if active socket exists OR seen within last 90 seconds
  if (candidate) {
    const isSocketOpen = peerSockets.has(candidate.id) && peerSockets.get(candidate.id)?.readyState === WebSocket.OPEN;
    if (isSocketOpen || (now - candidate.lastSeen < 90000)) {
      candidate.lastSeen = now;
      res.json({
        peer: {
          id: candidate.id,
          pin: candidate.pin,
          name: candidate.name,
          deviceType: candidate.deviceType,
          browser: candidate.browser,
          avatarColor: candidate.avatarColor,
          roomId: candidate.roomId,
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
    targetPin,
    roomId,
  } = req.body;

  if (!transferId || !senderId) {
    res.status(400).json({ error: 'Missing required transfer fields' });
    return;
  }

  const relay: RelayTransfer = {
    transferId,
    senderId,
    targetId: targetId || '',
    targetPin: targetPin || '',
    roomId: roomId || 'default-lan',
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
    senderCompleted: false,
    receiverCompleted: false,
    lastActive: Date.now(),
  };

  relayTransfers.set(transferId, relay);

  // Notify target peer immediately through WebSocket and message queue with full sender identity
  const senderPeer = peers.get(senderId);
  const senderInfo = senderPeer ? {
    id: senderPeer.id,
    name: senderPeer.name,
    pin: senderPeer.pin,
    deviceType: senderPeer.deviceType,
    browser: senderPeer.browser,
    avatarColor: senderPeer.avatarColor,
  } : {
    id: senderId,
    name: 'Nearby Sender',
  };

  const notifyPayload = {
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
    sender: senderInfo,
  };

  const notifyMsg: SignalMessage = {
    id: Math.random().toString(36).slice(2, 10),
    senderId,
    targetId: targetId || '',
    type: 'FILE_OFFER_SIGNAL',
    payload: notifyPayload,
    timestamp: Date.now(),
  };

  routeSignalMessage(notifyMsg, targetId, targetPin, roomId);

  res.json({ ok: true, transferId });
});

// Endpoint for receivers to check if any active transfer is intended for them or their room
app.get('/api/relay/active-for-peer', (req, res) => {
  const peerId = (req.query.peerId as string) || '';
  const pin = ((req.query.pin as string) || '').trim();
  const roomId = ((req.query.roomId as string) || 'default-lan').toLowerCase().trim();

  const activeOffers: any[] = [];
  const now = Date.now();

  for (const [transferId, relay] of relayTransfers.entries()) {
    // Only skip if the receiver has already finished downloading this transfer
    if (relay.receiverCompleted) continue;
    // Expire old uncollected transfers after 4 minutes
    if (now - relay.lastActive > 240000) continue;

    // Check if this transfer is addressed to this peer
    const relayRoom = (relay.roomId || 'default-lan').toLowerCase().trim();
    const relayPin = (relay.targetPin || '').trim();
    const matchesTargetId = Boolean(peerId && relay.targetId === peerId);
    const matchesTargetPin = Boolean(pin && relayPin && relayPin === pin);
    const matchesRoom = relayRoom === roomId;
    const isBroadcast = !relay.targetId || relay.targetId === 'room';

    if (relay.senderId !== peerId && (matchesTargetId || matchesTargetPin || (isBroadcast && matchesRoom) || matchesRoom)) {
      const senderPeer = peers.get(relay.senderId);
      activeOffers.push({
        type: 'FILE_OFFER',
        transferId: relay.transferId,
        senderId: relay.senderId,
        senderName: senderPeer ? senderPeer.name : 'Nearby Sender',
        senderPin: senderPeer ? senderPeer.pin : '',
        fileName: relay.fileName,
        fileSize: relay.fileSize,
        totalChunks: relay.totalChunks,
        mimeType: relay.mimeType,
        encryptionMode: relay.encryptionMode,
        isTetherMode: relay.isTetherMode,
        fingerprint: relay.fingerprint,
        rawKey: relay.rawKey,
        startedAt: relay.lastActive,
        senderCompleted: Boolean(relay.senderCompleted),
      });
    }
  }

  res.json({ offers: activeOffers });
});

app.post(
  '/api/relay/chunk',
  express.raw({ type: '*/*', limit: '50mb' }),
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

    // Instant WebSocket push to receiver if connected: resolve target socket by ID, PIN, or room
    let targetWs = relay.targetId && !relay.targetId.startsWith('peer_pin_') ? peerSockets.get(relay.targetId) : undefined;
    const effectiveTargetPin = (relay.targetPin || (relay.targetId && relay.targetId.startsWith('peer_pin_') ? relay.targetId.replace('peer_pin_', '') : undefined))?.trim();
    if (!targetWs && effectiveTargetPin) {
      for (const [id, peer] of peers.entries()) {
        if (peer.pin === effectiveTargetPin && id !== relay.senderId) {
          targetWs = peerSockets.get(id);
          if (targetWs) break;
        }
      }
    }
    if (!targetWs && relay.roomId) {
      for (const [id, peer] of peers.entries()) {
        if (peer.roomId === relay.roomId && id !== relay.senderId) {
          targetWs = peerSockets.get(id);
          if (targetWs) break;
        }
      }
    }

    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
      try {
        targetWs.send(JSON.stringify({
          type: 'WS_INCOMING_CHUNK',
          transferId,
          chunkIdx,
          data: bodyBuf.toString('base64'),
        }));
      } catch {}
    }

    res.json({ ok: true, chunkIdx });
  }
);

// High-speed raw binary chunk endpoint: zero base64 CPU overhead
app.get('/api/relay/chunk-binary', (req, res) => {
  const transferId = req.query.transferId as string;
  const chunkIdx = parseInt(req.query.chunkIdx as string, 10);

  if (!transferId || isNaN(chunkIdx)) {
    res.status(400).send('Missing transferId or chunkIdx');
    return;
  }

  const relay = relayTransfers.get(transferId);
  if (!relay || !relay.chunks.has(chunkIdx)) {
    res.status(404).send('Chunk not ready');
    return;
  }

  const buf = relay.chunks.get(chunkIdx)!;
  relay.lastActive = Date.now();
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', String(buf.byteLength));
  res.setHeader('X-Chunk-Index', String(chunkIdx));
  res.send(buf);
});

// Lightweight index discovery for parallel binary pulling
app.get('/api/relay/available-indices', (req, res) => {
  const transferId = req.query.transferId as string;
  const afterIdx = parseInt((req.query.afterIdx as string) || '-1', 10);
  const limit = Math.min(parseInt((req.query.limit as string) || '32', 10), 64);

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
  const chunkKeys = Array.from(relay.chunks.keys()).sort((a, b) => a - b);

  res.json({
    transferId,
    totalChunks: relay.totalChunks,
    senderCompleted: Boolean(relay.senderCompleted),
    indices: chunkKeys,
  });
});

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
    senderCompleted: Boolean(relay.senderCompleted),
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

// Sender calls complete when it finishes uploading all its chunks
app.post('/api/relay/complete', (req, res) => {
  const { transferId } = req.body;
  if (transferId) {
    const relay = relayTransfers.get(transferId);
    if (relay) {
      relay.senderCompleted = true;
      relay.lastActive = Date.now();
      // Chunks are NOT deleted here so the receiver can download them
    }
  }
  res.json({ ok: true });
});

// Receiver calls receiver-done when it has assembled the complete file
app.post('/api/relay/receiver-done', (req, res) => {
  const { transferId } = req.body;
  if (transferId) {
    const relay = relayTransfers.get(transferId);
    if (relay) {
      relay.receiverCompleted = true;
      relay.chunks.clear();
      setTimeout(() => relayTransfers.delete(transferId), 20000);
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
