import { Peer, TransferTask } from '../types/transfer';
import {
  generateTransferKey,
  exportKeyRaw,
  importKeyRaw,
  encryptChunk,
  decryptChunk,
  computeSHA256,
  generateFingerprint,
} from './crypto';
import { playSuccessChime, playStartTone, playErrorTone } from './audio';
import { sendTransferNotification } from './notifications';
import { formatBytes } from './formatters';
import mqtt, { MqttClient } from 'mqtt';

const CHUNK_SIZE = 64 * 1024; // 64 KB per chunk
const MAX_BUFFERED_AMOUNT = 512 * 1024; // 512 KB backpressure ceiling

export interface WebRTCManagerCallbacks {
  onPeersUpdated: (peers: Peer[]) => void;
  onTransferUpdated: (transfer: TransferTask) => void;
  onTransferCompleted: (transfer: TransferTask) => void;
  onIncomingOffer: (transfer: {
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    peerId: string;
    peerName: string;
    fingerprint?: string;
  }) => void;
  onSignalingStatus?: (status: 'connected' | 'connecting' | 'offline', message?: string) => void;
}

export class WebRTCManager {
  private selfPeer: Peer;
  private roomId: string;
  private callbacks: WebRTCManagerCallbacks;

  // Real-time MQTT signaling client
  private mqttClient: MqttClient | null = null;
  private localBroadcastChannel: BroadcastChannel | null = null;

  // WebRTC PeerConnections & DataChannels
  private peerConnections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();

  // Peers & Active Transfers
  private peers = new Map<string, Peer>();
  private peerHeartbeats = new Map<string, number>();
  private activeTransfers = new Map<string, TransferTask>();
  private pausedTransfers = new Set<string>();
  private cancelledTransfers = new Set<string>();
  private speedTrackers = new Map<string, { lastBytes: number; lastTime: number }>();
  private simulatedPeerActive: boolean = false;
  private presenceInterval: any = null;
  private pruneInterval: any = null;

  constructor(selfPeer: Peer, roomId: string, callbacks: WebRTCManagerCallbacks) {
    this.selfPeer = selfPeer;
    this.roomId = (roomId || 'default-lan').toLowerCase().trim();
    this.callbacks = callbacks;
  }

  public init() {
    this.initBroadcastChannel();
    this.initMqttSignaling();
    this.startPresenceHeartbeat();
    this.startPeerPruning();
  }

  public destroy() {
    if (this.presenceInterval) clearInterval(this.presenceInterval);
    if (this.pruneInterval) clearInterval(this.pruneInterval);

    this.sendSignalingMessage('room', { type: 'PEER_LEAVE', peerId: this.selfPeer.id });

    if (this.mqttClient) {
      try {
        this.mqttClient.end(true);
      } catch {}
      this.mqttClient = null;
    }

    if (this.localBroadcastChannel) {
      try {
        this.localBroadcastChannel.close();
      } catch {}
      this.localBroadcastChannel = null;
    }

    for (const dc of this.dataChannels.values()) {
      try { dc.close(); } catch {}
    }
    for (const pc of this.peerConnections.values()) {
      try { pc.close(); } catch {}
    }
  }

  public setRoomId(newRoom: string) {
    const clean = (newRoom || 'default-lan').toLowerCase().trim();
    if (this.roomId === clean) return;

    // Unsubscribe from old room
    if (this.mqttClient && this.mqttClient.connected) {
      this.mqttClient.unsubscribe(`aetherdrop/rooms/${this.roomId}/broadcast`);
    }

    this.roomId = clean;
    this.peers.clear();
    this.peerHeartbeats.clear();
    this.broadcastPeersList();

    if (this.mqttClient && this.mqttClient.connected) {
      this.mqttClient.subscribe(`aetherdrop/rooms/${this.roomId}/broadcast`);
      this.announcePresence();
    }
  }

  // Cross-tab discovery on same machine via BroadcastChannel
  private initBroadcastChannel() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.localBroadcastChannel = new BroadcastChannel(`aetherdrop_bus_${this.roomId}`);
        this.localBroadcastChannel.onmessage = (event) => {
          this.handleSignalingPacket(event.data);
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }
  }

  // Fast, reliable MQTT WebSocket pub/sub signaling
  private initMqttSignaling() {
    this.callbacks.onSignalingStatus?.('connecting', 'Connecting to real-time discovery relay...');

    const clientId = `aether_${this.selfPeer.pin}_${Math.random().toString(36).substring(2, 7)}`;
    const brokerUrl = 'wss://broker.emqx.io:8084/mqtt';

    try {
      this.mqttClient = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 3000,
        keepalive: 30,
      });

      this.mqttClient.on('connect', () => {
        console.log('[AetherDrop] Connected to signaling broker');
        this.callbacks.onSignalingStatus?.('connected', `Online (Room: ${this.roomId})`);

        // Subscribe to Room Broadcast + Personal Inbox + PIN Inbox
        const topics = [
          `aetherdrop/rooms/${this.roomId}/broadcast`,
          `aetherdrop/peers/${this.selfPeer.id}/inbox`,
          `aetherdrop/pins/${this.selfPeer.pin}/inbox`,
        ];

        this.mqttClient?.subscribe(topics, (err) => {
          if (!err) {
            this.announcePresence();
          }
        });
      });

      this.mqttClient.on('message', (_topic, payload) => {
        try {
          const data = JSON.parse(payload.toString());
          this.handleSignalingPacket(data);
        } catch (e) {
          console.warn('Failed to parse signaling packet:', e);
        }
      });

      this.mqttClient.on('error', (err) => {
        console.warn('[AetherDrop] Signaling broker error:', err);
        this.callbacks.onSignalingStatus?.('offline', 'Signaling offline (Direct PIN/QR available)');
      });

      this.mqttClient.on('offline', () => {
        this.callbacks.onSignalingStatus?.('connecting', 'Reconnecting to discovery relay...');
      });
    } catch (err) {
      console.warn('MQTT init failed:', err);
      this.callbacks.onSignalingStatus?.('offline', 'Signaling offline');
    }
  }

  private sendSignalingMessage(target: 'room' | { peerId?: string; pin?: string }, data: any) {
    const packet = {
      ...data,
      sender: this.selfPeer,
      timestamp: Date.now(),
    };

    // 1. Broadcast locally across tabs
    try {
      this.localBroadcastChannel?.postMessage(packet);
    } catch {}

    // 2. Publish to MQTT Broker
    if (this.mqttClient && this.mqttClient.connected) {
      if (target === 'room') {
        this.mqttClient.publish(
          `aetherdrop/rooms/${this.roomId}/broadcast`,
          JSON.stringify(packet)
        );
      } else if (target.peerId) {
        this.mqttClient.publish(
          `aetherdrop/peers/${target.peerId}/inbox`,
          JSON.stringify(packet)
        );
      } else if (target.pin) {
        this.mqttClient.publish(
          `aetherdrop/pins/${target.pin}/inbox`,
          JSON.stringify(packet)
        );
      }
    }
  }

  public announcePresence() {
    this.sendSignalingMessage('room', {
      type: 'PEER_PRESENCE',
      peer: this.selfPeer,
    });
  }

  private startPresenceHeartbeat() {
    this.presenceInterval = setInterval(() => {
      this.announcePresence();
    }, 2500);
  }

  private startPeerPruning() {
    this.pruneInterval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, lastTime] of this.peerHeartbeats.entries()) {
        if (now - lastTime > 8000) {
          this.peers.delete(id);
          this.peerHeartbeats.delete(id);
          changed = true;
        }
      }
      if (changed) {
        this.broadcastPeersList();
      }
    }, 3000);
  }

  // Handle incoming signaling packets
  private async handleSignalingPacket(packet: any) {
    if (!packet || !packet.sender || packet.sender.id === this.selfPeer.id) {
      return;
    }

    const { type, sender } = packet;

    if (type === 'PEER_PRESENCE') {
      const incomingPeer: Peer = {
        ...sender,
        status: this.dataChannels.has(sender.id) ? 'connected' : 'available',
        connectionType: 'webrtc-direct',
      };
      this.peers.set(sender.id, incomingPeer);
      this.peerHeartbeats.set(sender.id, Date.now());
      this.broadcastPeersList();
    } else if (type === 'PEER_LEAVE') {
      this.peers.delete(sender.id);
      this.peerHeartbeats.delete(sender.id);
      this.broadcastPeersList();
    } else if (type === 'CONNECT_REQUEST') {
      // Incoming connection request (from direct PIN or Radar click)
      await this.initiateWebRTCConnection(sender.id, true);
    } else if (type === 'OFFER') {
      await this.handleWebRTCOffer(sender.id, packet.sdp);
    } else if (type === 'ANSWER') {
      const pc = this.peerConnections.get(sender.id);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(packet.sdp));
      }
    } else if (type === 'ICE_CANDIDATE') {
      const pc = this.peerConnections.get(sender.id);
      if (pc && packet.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(packet.candidate));
        } catch (e) {
          console.warn('Failed to add ICE candidate:', e);
        }
      }
    }
  }

  // Direct connection by 4-digit PIN
  public connectByPin(pin: string) {
    if (!pin) return;
    const cleanPin = pin.trim();
    if (cleanPin === this.selfPeer.pin) return;

    this.sendSignalingMessage({ pin: cleanPin }, {
      type: 'CONNECT_REQUEST',
    });
  }

  // Establish WebRTC DataConnection
  public async initiateWebRTCConnection(targetPeerId: string, isInitiator: boolean = true) {
    if (this.dataChannels.has(targetPeerId)) {
      return;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
      ],
    });

    this.peerConnections.set(targetPeerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({ peerId: targetPeerId }, {
          type: 'ICE_CANDIDATE',
          candidate: event.candidate,
        });
      }
    };

    if (isInitiator) {
      const dc = pc.createDataChannel('aetherdrop_transfer', { ordered: true });
      this.setupDataChannel(targetPeerId, dc);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.sendSignalingMessage({ peerId: targetPeerId }, {
        type: 'OFFER',
        sdp: offer,
      });
    } else {
      pc.ondatachannel = (event) => {
        this.setupDataChannel(targetPeerId, event.channel);
      };
    }
  }

  private async handleWebRTCOffer(senderId: string, sdp: RTCSessionDescriptionInit) {
    let pc = this.peerConnections.get(senderId);
    if (!pc) {
      pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
      });
      this.peerConnections.set(senderId, pc);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignalingMessage({ peerId: senderId }, {
            type: 'ICE_CANDIDATE',
            candidate: event.candidate,
          });
        }
      };

      pc.ondatachannel = (event) => {
        this.setupDataChannel(senderId, event.channel);
      };
    }

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendSignalingMessage({ peerId: senderId }, {
      type: 'ANSWER',
      sdp: answer,
    });
  }

  private setupDataChannel(peerId: string, dc: RTCDataChannel) {
    dc.binaryType = 'arraybuffer';
    dc.bufferedAmountLowThreshold = 64 * 1024;

    dc.onopen = () => {
      console.log(`[AetherDrop] Direct WebRTC DataChannel OPEN with peer ${peerId}`);
      this.dataChannels.set(peerId, dc);
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.status = 'connected';
      }
      this.broadcastPeersList();
    };

    dc.onclose = () => {
      this.dataChannels.delete(peerId);
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.status = 'available';
      }
      this.broadcastPeersList();
    };

    dc.onmessage = (event) => {
      this.handleDataChannelMessage(peerId, event.data);
    };
  }

  private broadcastPeersList() {
    const list = Array.from(this.peers.values());
    if (this.simulatedPeerActive) {
      list.push({
        id: 'simulated_peer_test',
        pin: '9999',
        name: 'Pixel 9 Pro (Simulated Wi-Fi Peer)',
        deviceType: 'mobile',
        browser: 'Chrome Mobile',
        avatarColor: '#10b981',
        status: 'connected',
        connectionType: 'simulated',
      });
    }
    this.callbacks.onPeersUpdated(list);
  }

  public fetchPeers() {
    this.announcePresence();
    this.broadcastPeersList();
  }

  public toggleSimulatedPeer(enable: boolean) {
    this.simulatedPeerActive = enable;
    this.broadcastPeersList();
  }

  // High-Speed Encrypted File Send
  public async sendFile(file: File, targetPeer: Peer): Promise<string> {
    const transferId = 'xfer_' + Math.random().toString(36).slice(2, 10);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // Ephemeral 256-bit AES-GCM key
    const key = await generateTransferKey();
    const rawKey = await exportKeyRaw(key);
    const fingerprint = await generateFingerprint(rawKey);

    const task: TransferTask = {
      id: transferId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      direction: 'send',
      peerId: targetPeer.id,
      peerName: targetPeer.name,
      bytesTransferred: 0,
      progress: 0,
      speed: 0,
      eta: 0,
      status: 'encrypting',
      startedAt: Date.now(),
      updatedAt: Date.now(),
      isEncrypted: true,
      fingerprint,
      rawFile: file,
      chunkKey: key,
    };

    this.activeTransfers.set(transferId, task);
    this.speedTrackers.set(transferId, { lastBytes: 0, lastTime: Date.now() });
    this.callbacks.onTransferUpdated(task);
    playStartTone();

    if (targetPeer.id === 'simulated_peer_test') {
      this.runSimulatedTransfer(task, file, key, rawKey, fingerprint);
      return transferId;
    }

    // Ensure connection
    let dc = this.dataChannels.get(targetPeer.id);
    if (!dc || dc.readyState !== 'open') {
      await this.initiateWebRTCConnection(targetPeer.id, true);
      // Wait briefly for open
      await new Promise((r) => setTimeout(r, 600));
      dc = this.dataChannels.get(targetPeer.id);
    }

    const offerPayload = JSON.stringify({
      type: 'FILE_OFFER',
      transferId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      totalChunks,
      rawKey: Array.from(new Uint8Array(rawKey)),
      fingerprint,
    });

    if (dc && dc.readyState === 'open') {
      dc.send(offerPayload);
    } else {
      // Fallback over signaling
      this.sendSignalingMessage({ peerId: targetPeer.id }, {
        type: 'FILE_OFFER_SIGNAL',
        payload: offerPayload,
      });
    }

    this.streamFileChunks(task, file, key, targetPeer.id);
    return transferId;
  }

  private async streamFileChunks(
    task: TransferTask,
    file: File,
    key: CryptoKey,
    targetPeerId: string
  ) {
    task.status = 'transferring';
    task.updatedAt = Date.now();
    this.callbacks.onTransferUpdated(task);

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let bytesSent = 0;

    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      if (this.cancelledTransfers.has(task.id)) {
        task.status = 'cancelled';
        this.callbacks.onTransferUpdated(task);
        this.sendControlMessage(targetPeerId, 'CANCEL', task.id);
        return;
      }

      while (this.pausedTransfers.has(task.id)) {
        task.status = 'paused';
        task.speed = 0;
        this.callbacks.onTransferUpdated(task);
        await new Promise((r) => setTimeout(r, 400));
        if (this.cancelledTransfers.has(task.id)) return;
      }

      if (task.status === 'paused') {
        task.status = 'transferring';
      }

      const start = chunkIdx * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const slice = file.slice(start, end);
      const buffer = await slice.arrayBuffer();

      // Encrypt chunk using AES-256-GCM
      const { encrypted, iv } = await encryptChunk(key, buffer, chunkIdx);

      const dc = this.dataChannels.get(targetPeerId);
      if (dc && dc.readyState === 'open') {
        if (dc.bufferedAmount > MAX_BUFFERED_AMOUNT) {
          await new Promise<void>((resolve) => {
            const onLow = () => {
              dc?.removeEventListener('bufferedamountlow', onLow);
              resolve();
            };
            dc?.addEventListener('bufferedamountlow', onLow);
          });
        }

        const header = JSON.stringify({
          type: 'CHUNK_HEADER',
          transferId: task.id,
          chunkIdx,
          iv: Array.from(iv),
          size: encrypted.byteLength,
        });

        dc.send(header);
        dc.send(encrypted);
      }

      bytesSent += (end - start);
      task.bytesTransferred = bytesSent;
      task.progress = Math.min(100, Math.round((bytesSent / file.size) * 100));

      this.updateMetrics(task);
      this.callbacks.onTransferUpdated(task);

      if (chunkIdx % 4 === 0) {
        await new Promise((r) => setTimeout(r, 4));
      }
    }

    const fullBuffer = await file.arrayBuffer();
    const checksum = await computeSHA256(fullBuffer);
    task.checksum = checksum;

    this.sendControlMessage(targetPeerId, 'FILE_COMPLETE', task.id, { checksum });

    task.status = 'completed';
    task.completedAt = Date.now();
    task.speed = 0;
    task.eta = 0;
    this.callbacks.onTransferUpdated(task);
    this.callbacks.onTransferCompleted(task);
    playSuccessChime();
    sendTransferNotification('File Sent Successfully', {
      body: `${task.fileName} (${formatBytes(task.fileSize)}) delivered to ${task.peerName}`,
    });
  }

  private sendControlMessage(targetPeerId: string, type: string, transferId: string, extra: any = {}) {
    const payload = JSON.stringify({ type, transferId, ...extra });
    const dc = this.dataChannels.get(targetPeerId);
    if (dc && dc.readyState === 'open') {
      dc.send(payload);
    } else {
      this.sendSignalingMessage({ peerId: targetPeerId }, {
        type: 'CONTROL_SIGNAL',
        payload,
      });
    }
  }

  private pendingChunkHeaders = new Map<string, any>();

  private async handleDataChannelMessage(peerId: string, data: any) {
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'FILE_OFFER') {
          const rawKeyBuffer = new Uint8Array(msg.rawKey).buffer;
          const chunkKey = await importKeyRaw(rawKeyBuffer);
          const peer = this.peers.get(peerId);

          const task: TransferTask = {
            id: msg.transferId,
            fileName: msg.fileName,
            fileSize: msg.fileSize,
            mimeType: msg.mimeType,
            direction: 'receive',
            peerId,
            peerName: peer ? peer.name : 'Nearby Peer',
            bytesTransferred: 0,
            progress: 0,
            speed: 0,
            eta: 0,
            status: 'transferring',
            startedAt: Date.now(),
            updatedAt: Date.now(),
            isEncrypted: true,
            fingerprint: msg.fingerprint,
            chunkKey,
            totalChunks: msg.totalChunks,
            receivedChunks: [],
          };

          this.activeTransfers.set(task.id, task);
          this.speedTrackers.set(task.id, { lastBytes: 0, lastTime: Date.now() });
          this.callbacks.onTransferUpdated(task);
          playStartTone();
        } else if (msg.type === 'CHUNK_HEADER') {
          this.pendingChunkHeaders.set(peerId, msg);
        } else if (msg.type === 'PAUSE') {
          this.pausedTransfers.add(msg.transferId);
          const task = this.activeTransfers.get(msg.transferId);
          if (task) {
            task.status = 'paused';
            this.callbacks.onTransferUpdated(task);
          }
        } else if (msg.type === 'RESUME') {
          this.pausedTransfers.delete(msg.transferId);
          const task = this.activeTransfers.get(msg.transferId);
          if (task) {
            task.status = 'transferring';
            this.callbacks.onTransferUpdated(task);
          }
        } else if (msg.type === 'CANCEL') {
          this.cancelledTransfers.add(msg.transferId);
          const task = this.activeTransfers.get(msg.transferId);
          if (task) {
            task.status = 'cancelled';
            this.callbacks.onTransferUpdated(task);
            playErrorTone();
          }
        } else if (msg.type === 'FILE_COMPLETE') {
          const task = this.activeTransfers.get(msg.transferId);
          if (task && task.receivedChunks) {
            this.finalizeReceivedFile(task, msg.checksum);
          }
        }
      } catch (e) {
        console.warn('DataChannel message parse error:', e);
      }
    } else if (data instanceof ArrayBuffer) {
      const header = this.pendingChunkHeaders.get(peerId);
      if (header) {
        const task = this.activeTransfers.get(header.transferId);
        if (task && task.chunkKey) {
          try {
            const iv = new Uint8Array(header.iv);
            const decrypted = await decryptChunk(task.chunkKey, data, iv);
            if (!task.receivedChunks) task.receivedChunks = [];
            task.receivedChunks[header.chunkIdx] = decrypted;
            task.bytesTransferred += decrypted.byteLength;
            task.progress = Math.min(100, Math.round((task.bytesTransferred / task.fileSize) * 100));

            this.updateMetrics(task);
            this.callbacks.onTransferUpdated(task);
          } catch (err) {
            console.error('Decryption failed for chunk:', err);
            task.status = 'error';
            task.errorReason = 'Cryptographic verification failed';
            this.callbacks.onTransferUpdated(task);
          }
        }
        this.pendingChunkHeaders.delete(peerId);
      }
    }
  }

  private async finalizeReceivedFile(task: TransferTask, expectedChecksum?: string) {
    if (!task.receivedChunks) return;

    const blob = new Blob(task.receivedChunks, { type: task.mimeType });
    const buffer = await blob.arrayBuffer();
    const actualChecksum = await computeSHA256(buffer);

    task.checksum = actualChecksum;

    if (expectedChecksum && expectedChecksum !== actualChecksum) {
      task.status = 'error';
      task.errorReason = 'Integrity checksum mismatch. Data was corrupted.';
      this.callbacks.onTransferUpdated(task);
      playErrorTone();
      return;
    }

    const downloadUrl = URL.createObjectURL(blob);
    task.downloadUrl = downloadUrl;
    task.status = 'completed';
    task.completedAt = Date.now();
    task.progress = 100;
    task.speed = 0;
    task.eta = 0;

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = task.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    this.callbacks.onTransferUpdated(task);
    this.callbacks.onTransferCompleted(task);
    playSuccessChime();
    sendTransferNotification('File Received', {
      body: `${task.fileName} (${formatBytes(task.fileSize)}) received and saved.`,
    });
  }

  private updateMetrics(task: TransferTask) {
    const now = Date.now();
    const tracker = this.speedTrackers.get(task.id);
    if (!tracker) {
      this.speedTrackers.set(task.id, { lastBytes: task.bytesTransferred, lastTime: now });
      return;
    }

    const elapsed = (now - tracker.lastTime) / 1000;
    if (elapsed >= 0.5) {
      const bytesDiff = task.bytesTransferred - tracker.lastBytes;
      const currentSpeed = bytesDiff / elapsed;
      task.speed = task.speed === 0 ? currentSpeed : Math.round(task.speed * 0.4 + currentSpeed * 0.6);

      const remainingBytes = Math.max(0, task.fileSize - task.bytesTransferred);
      task.eta = task.speed > 0 ? remainingBytes / task.speed : 0;
      task.updatedAt = now;

      tracker.lastBytes = task.bytesTransferred;
      tracker.lastTime = now;
    }
  }

  public pauseTransfer(transferId: string) {
    this.pausedTransfers.add(transferId);
    const task = this.activeTransfers.get(transferId);
    if (task) {
      task.status = 'paused';
      task.speed = 0;
      this.callbacks.onTransferUpdated(task);
      this.sendControlMessage(task.peerId, 'PAUSE', transferId);
    }
  }

  public resumeTransfer(transferId: string) {
    this.pausedTransfers.delete(transferId);
    const task = this.activeTransfers.get(transferId);
    if (task) {
      task.status = 'transferring';
      this.callbacks.onTransferUpdated(task);
      this.sendControlMessage(task.peerId, 'RESUME', transferId);
    }
  }

  public cancelTransfer(transferId: string) {
    this.cancelledTransfers.add(transferId);
    const task = this.activeTransfers.get(transferId);
    if (task) {
      task.status = 'cancelled';
      task.speed = 0;
      task.eta = 0;
      if (task.receivedChunks) task.receivedChunks = [];
      if (task.downloadUrl) {
        URL.revokeObjectURL(task.downloadUrl);
        delete task.downloadUrl;
      }
      this.callbacks.onTransferUpdated(task);
      this.sendControlMessage(task.peerId, 'CANCEL', transferId);
      playErrorTone();
    }
  }

  private async runSimulatedTransfer(
    task: TransferTask,
    file: File,
    key: CryptoKey,
    _rawKey: ArrayBuffer,
    _fingerprint: string
  ) {
    task.status = 'transferring';
    task.updatedAt = Date.now();
    this.callbacks.onTransferUpdated(task);

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    let bytesSent = 0;
    const receivedChunks: ArrayBuffer[] = [];
    const simulatedChunkDelayMs = Math.max(8, Math.min(30, Math.floor(200 / totalChunks)));

    for (let i = 0; i < totalChunks; i++) {
      if (this.cancelledTransfers.has(task.id)) {
        task.status = 'cancelled';
        this.callbacks.onTransferUpdated(task);
        return;
      }

      while (this.pausedTransfers.has(task.id)) {
        task.status = 'paused';
        task.speed = 0;
        this.callbacks.onTransferUpdated(task);
        await new Promise((r) => setTimeout(r, 300));
        if (this.cancelledTransfers.has(task.id)) return;
      }

      if (task.status === 'paused') {
        task.status = 'transferring';
      }

      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const slice = file.slice(start, end);
      const rawChunk = await slice.arrayBuffer();

      const { encrypted, iv } = await encryptChunk(key, rawChunk, i);
      await new Promise((r) => setTimeout(r, simulatedChunkDelayMs));
      const decrypted = await decryptChunk(key, encrypted, iv);
      receivedChunks.push(decrypted);

      bytesSent += (end - start);
      task.bytesTransferred = bytesSent;
      task.progress = Math.min(100, Math.round((bytesSent / file.size) * 100));

      this.updateMetrics(task);
      this.callbacks.onTransferUpdated(task);
    }

    const fullBuffer = await file.arrayBuffer();
    task.checksum = await computeSHA256(fullBuffer);

    const simulatedBlob = new Blob(receivedChunks, { type: file.type });
    const blobUrl = URL.createObjectURL(simulatedBlob);
    task.downloadUrl = blobUrl;
    task.status = 'completed';
    task.completedAt = Date.now();
    task.speed = 0;
    task.eta = 0;

    this.callbacks.onTransferUpdated(task);
    this.callbacks.onTransferCompleted(task);
    playSuccessChime();
    sendTransferNotification('Local Wi-Fi Transfer Complete', {
      body: `${task.fileName} (${formatBytes(task.fileSize)}) encrypted & delivered to Pixel 9 Pro.`,
    });
  }

  public purgeAllCaches() {
    for (const task of this.activeTransfers.values()) {
      if (task.downloadUrl) {
        URL.revokeObjectURL(task.downloadUrl);
        delete task.downloadUrl;
      }
      if (task.receivedChunks) {
        task.receivedChunks = [];
      }
      delete task.rawFile;
    }
  }
}
