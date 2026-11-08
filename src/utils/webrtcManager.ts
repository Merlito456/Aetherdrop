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

const CHUNK_SIZE = 64 * 1024; // 64 KB per chunk (standard safe WebRTC MTU)
const MAX_BUFFERED_AMOUNT = 1024 * 1024; // 1 MB backpressure ceiling

export interface WebRTCManagerCallbacks {
  onPeersUpdated: (peers: Peer[]) => void;
  onTransferUpdated: (transfer: TransferTask) => void;
  onTransferCompleted: (transfer: TransferTask) => void;
  onIncomingOffer: (transfer: TransferTask) => void;
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
  private dataChannelWaiters = new Map<string, Array<(dc: RTCDataChannel) => void>>();
  private fileAcceptWaiters = new Map<string, (accepted: boolean) => void>();

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

  private initMqttSignaling() {
    this.callbacks.onSignalingStatus?.('connecting', 'Connecting to discovery network...');

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
        this.callbacks.onSignalingStatus?.('connected', `Online (Room: ${this.roomId})`);

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
        this.callbacks.onSignalingStatus?.('offline', 'Signaling offline');
      });

      this.mqttClient.on('offline', () => {
        this.callbacks.onSignalingStatus?.('connecting', 'Reconnecting to network...');
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

    try {
      this.localBroadcastChannel?.postMessage(packet);
    } catch {}

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
    } else if (type === 'FILE_OFFER_SIGNAL') {
      await this.handleFileOfferMessage(sender.id, packet.payload);
    } else if (type === 'FILE_ACCEPT_SIGNAL') {
      const waiter = this.fileAcceptWaiters.get(packet.transferId);
      if (waiter) {
        waiter(true);
        this.fileAcceptWaiters.delete(packet.transferId);
      }
    }
  }

  public connectByPin(pin: string) {
    if (!pin) return;
    const cleanPin = pin.trim();
    if (cleanPin === this.selfPeer.pin) return;

    this.sendSignalingMessage({ pin: cleanPin }, {
      type: 'CONNECT_REQUEST',
    });
  }

  // Ensure DataChannel is completely open before sending any chunks
  private ensureDataChannelConnected(targetPeerId: string): Promise<RTCDataChannel> {
    const existing = this.dataChannels.get(targetPeerId);
    if (existing && existing.readyState === 'open') {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timed out. Peer may be unreachable.'));
      }, 8000);

      if (!this.dataChannelWaiters.has(targetPeerId)) {
        this.dataChannelWaiters.set(targetPeerId, []);
      }

      this.dataChannelWaiters.get(targetPeerId)!.push((dc) => {
        clearTimeout(timeout);
        resolve(dc);
      });

      this.initiateWebRTCConnection(targetPeerId, true);
    });
  }

  public async initiateWebRTCConnection(targetPeerId: string, isInitiator: boolean = true) {
    if (this.dataChannels.has(targetPeerId) && this.dataChannels.get(targetPeerId)!.readyState === 'open') {
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
      const dc = pc.createDataChannel('aetherdrop_transfer', {
        ordered: true,
      });
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
    dc.bufferedAmountLowThreshold = 256 * 1024; // 256 KB

    dc.onopen = () => {
      console.log(`[AetherDrop] Direct WebRTC DataChannel OPEN with peer ${peerId}`);
      this.dataChannels.set(peerId, dc);
      const peer = this.peers.get(peerId);
      if (peer) {
        peer.status = 'connected';
      }
      this.broadcastPeersList();

      // Resolve any pending connection promises
      const waiters = this.dataChannelWaiters.get(peerId);
      if (waiters) {
        for (const resolve of waiters) {
          resolve(dc);
        }
        this.dataChannelWaiters.delete(peerId);
      }
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

    try {
      // 1. Ensure DataChannel is connected before streaming
      const dc = await this.ensureDataChannelConnected(targetPeer.id);

      // 2. Prepare metadata offer
      const offer = {
        type: 'FILE_OFFER',
        transferId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        totalChunks,
        rawKey: Array.from(new Uint8Array(rawKey)),
        fingerprint,
      };

      // 3. Await receiver confirmation with timeout
      const acceptPromise = new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(true), 2500); // Proceed anyway after 2.5s
        this.fileAcceptWaiters.set(transferId, (acc) => {
          clearTimeout(timer);
          resolve(acc);
        });
      });

      dc.send(JSON.stringify(offer));

      // Also send over signaling as backup
      this.sendSignalingMessage({ peerId: targetPeer.id }, {
        type: 'FILE_OFFER_SIGNAL',
        payload: offer,
      });

      await acceptPromise;

      // 4. Stream binary chunks directly over DataChannel
      this.streamFileChunks(task, file, key, targetPeer.id, dc);
    } catch (err: any) {
      console.error('Send file failed:', err);
      task.status = 'error';
      task.errorReason = err?.message || 'Failed to establish peer connection';
      this.callbacks.onTransferUpdated(task);
      playErrorTone();
    }

    return transferId;
  }

  // High-Speed Binary Streaming (No JSON stringification overhead per chunk)
  private async streamFileChunks(
    task: TransferTask,
    file: File,
    key: CryptoKey,
    targetPeerId: string,
    dc: RTCDataChannel
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
        await new Promise((r) => setTimeout(r, 300));
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

      // Pure Binary Packet Layout:
      // [4 bytes chunkIndex (Uint32)] [12 bytes IV] [Encrypted Bytes]
      const packet = new Uint8Array(16 + encrypted.byteLength);
      const view = new DataView(packet.buffer);
      view.setUint32(0, chunkIdx, false);
      packet.set(iv, 4);
      packet.set(new Uint8Array(encrypted), 16);

      // High-performance backpressure flow control
      if (dc.bufferedAmount > MAX_BUFFERED_AMOUNT) {
        await new Promise<void>((resolve) => {
          const onLow = () => {
            dc.removeEventListener('bufferedamountlow', onLow);
            resolve();
          };
          dc.addEventListener('bufferedamountlow', onLow);
        });
      }

      dc.send(packet.buffer);

      bytesSent += (end - start);
      task.bytesTransferred = bytesSent;
      task.progress = Math.min(100, Math.round((bytesSent / file.size) * 100));

      this.updateMetrics(task);
      this.callbacks.onTransferUpdated(task);
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
    }
    // Also send over signaling as safety net
    this.sendSignalingMessage({ peerId: targetPeerId }, {
      type: 'CONTROL_SIGNAL',
      payload,
    });
  }

  private async handleFileOfferMessage(peerId: string, offer: any) {
    if (!offer || !offer.transferId) return;
    if (this.activeTransfers.has(offer.transferId)) return; // Prevent duplicate registration

    try {
      const rawKeyBuffer = new Uint8Array(offer.rawKey).buffer;
      const chunkKey = await importKeyRaw(rawKeyBuffer);
      const peer = this.peers.get(peerId);

      const task: TransferTask = {
        id: offer.transferId,
        fileName: offer.fileName,
        fileSize: offer.fileSize,
        mimeType: offer.mimeType,
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
        fingerprint: offer.fingerprint,
        chunkKey,
        totalChunks: offer.totalChunks,
        receivedChunks: new Array(offer.totalChunks),
      };

      this.activeTransfers.set(task.id, task);
      this.speedTrackers.set(task.id, { lastBytes: 0, lastTime: Date.now() });

      // Notify UI immediately!
      this.callbacks.onIncomingOffer(task);
      this.callbacks.onTransferUpdated(task);
      playStartTone();

      sendTransferNotification('Incoming File Transfer', {
        body: `Receiving ${task.fileName} (${formatBytes(task.fileSize)}) from ${task.peerName}...`,
      });

      // Send acceptance confirmation back
      const dc = this.dataChannels.get(peerId);
      const acceptMsg = JSON.stringify({ type: 'FILE_ACCEPT', transferId: task.id });
      if (dc && dc.readyState === 'open') {
        dc.send(acceptMsg);
      }
      this.sendSignalingMessage({ peerId }, {
        type: 'FILE_ACCEPT_SIGNAL',
        transferId: task.id,
      });
    } catch (e) {
      console.warn('Failed to parse file offer:', e);
    }
  }

  private async handleDataChannelMessage(peerId: string, data: any) {
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'FILE_OFFER') {
          await this.handleFileOfferMessage(peerId, msg);
        } else if (msg.type === 'FILE_ACCEPT') {
          const waiter = this.fileAcceptWaiters.get(msg.transferId);
          if (waiter) {
            waiter(true);
            this.fileAcceptWaiters.delete(msg.transferId);
          }
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
      // Pure Binary Chunk Packet Layout:
      // [4 bytes chunkIndex (UInt32)] [12 bytes IV] [Ciphertext bytes]
      if (data.byteLength < 16) return;

      const view = new DataView(data);
      const chunkIdx = view.getUint32(0, false);
      const iv = new Uint8Array(data, 4, 12);
      const ciphertext = data.slice(16);

      // Find the receiving task for this peer
      for (const task of this.activeTransfers.values()) {
        if (task.peerId === peerId && task.direction === 'receive' && task.status === 'transferring' && task.chunkKey) {
          try {
            const decrypted = await decryptChunk(task.chunkKey, ciphertext, iv);
            if (!task.receivedChunks) task.receivedChunks = [];
            task.receivedChunks[chunkIdx] = decrypted;
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
          break;
        }
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
    if (elapsed >= 0.3) {
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
      const decrypted = await decryptChunk(key, encrypted, iv);
      receivedChunks.push(decrypted);

      bytesSent += (end - start);
      task.bytesTransferred = bytesSent;
      task.progress = Math.min(100, Math.round((bytesSent / file.size) * 100));

      this.updateMetrics(task);
      this.callbacks.onTransferUpdated(task);

      // Smooth simulated pacing
      if (i % 2 === 0) {
        await new Promise((r) => setTimeout(r, 2));
      }
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
