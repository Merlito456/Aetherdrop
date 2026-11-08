// In-memory peer store for Cloudflare edge worker instance
interface PeerInfo {
  id: string;
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

// Global scope memory on edge worker
const peers = new Map<string, PeerInfo>();
const messageQueues = new Map<string, SignalMessage[]>();

const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequest(context: any): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // Health check / info
  if (url.pathname === '/api/info') {
    return new Response(
      JSON.stringify({
        status: 'online',
        host: 'Cloudflare Pages Edge',
        encryption: 'AES-256-GCM / WebRTC DTLS',
        zeroCache: true,
      }),
      { headers }
    );
  }

  // Clean inactive peers (>25s)
  const now = Date.now();
  for (const [id, peer] of peers.entries()) {
    if (now - peer.lastSeen > 25000) {
      peers.delete(id);
      messageQueues.delete(id);
    }
  }

  // POST /api/signal/register
  if (url.pathname === '/api/signal/register' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { id, name, deviceType, browser, avatarColor, roomId } = body;
      peers.set(id, {
        id,
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
      return new Response(JSON.stringify({ success: true, peerId: id }), { headers });
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers });
    }
  }

  // POST /api/signal/heartbeat
  if (url.pathname === '/api/signal/heartbeat' && request.method === 'POST') {
    try {
      const body = await request.json();
      if (body.id && peers.has(body.id)) {
        const peer = peers.get(body.id)!;
        peer.lastSeen = Date.now();
        peers.set(body.id, peer);
      }
      return new Response(JSON.stringify({ ok: true }), { headers });
    } catch {
      return new Response(JSON.stringify({ ok: true }), { headers });
    }
  }

  // GET /api/signal/peers
  if (url.pathname === '/api/signal/peers' && request.method === 'GET') {
    const roomId = url.searchParams.get('roomId') || 'default-lan';
    const excludeId = url.searchParams.get('excludeId');

    const peerList = Array.from(peers.values())
      .filter((p) => p.roomId === roomId && p.id !== excludeId && now - p.lastSeen < 25000)
      .map(({ id, name, deviceType, browser, avatarColor }) => ({
        id,
        name,
        deviceType,
        browser,
        avatarColor,
      }));

    return new Response(JSON.stringify({ peers: peerList }), { headers });
  }

  // POST /api/signal/send
  if (url.pathname === '/api/signal/send' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { senderId, targetId, type, payload } = body;
      if (!targetId || !type) {
        return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers });
      }

      if (!messageQueues.has(targetId)) {
        messageQueues.set(targetId, []);
      }

      const msg: SignalMessage = {
        id: Math.random().toString(36).slice(2, 10),
        senderId,
        targetId,
        type,
        payload,
        timestamp: Date.now(),
      };

      messageQueues.get(targetId)?.push(msg);
      return new Response(JSON.stringify({ success: true }), { headers });
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to send' }), { status: 400, headers });
    }
  }

  // GET /api/signal/messages
  if (url.pathname === '/api/signal/messages' && request.method === 'GET') {
    const peerId = url.searchParams.get('peerId');
    if (!peerId) {
      return new Response(JSON.stringify({ error: 'Missing peerId' }), { status: 400, headers });
    }

    const queue = messageQueues.get(peerId) || [];
    messageQueues.set(peerId, []);
    return new Response(JSON.stringify({ messages: queue }), { headers });
  }

  // POST /api/signal/leave
  if (url.pathname === '/api/signal/leave' && request.method === 'POST') {
    try {
      const body = await request.json();
      if (body.id) {
        peers.delete(body.id);
        messageQueues.delete(body.id);
      }
    } catch {}
    return new Response(JSON.stringify({ ok: true }), { headers });
  }

  return new Response(JSON.stringify({ error: 'Endpoint not found' }), { status: 404, headers });
}
