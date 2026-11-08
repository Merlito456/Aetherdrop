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
import { joinRoom as joinNostrRoom } from '@trystero-p2p/nostr';

const CHUNK_SIZE = 64 * 1024; // 64 KB chunks for optimal WebRTC throughput

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
  onStatusChange?: (status: { connectedRelays: number; mode: string }) => void;
}

export class WebRTCManager {
  private selfPeer: Peer;
  private roomId: string;
  private callbacks: WebRTCManagerCallbacks;

  // Trystero P2P Room instance & actions
  private room: any = null;
  private presenceAction: any = null;
  private fileOfferAction: any = null;
  private fileChunkAction: any = null;
  private fileControlAction: any = null;
  private fileCompleteAction: any = null;

  // Active state
  private peers = new Map<string, Peer>();
  private activeTransfers = new Map<string, TransferTask>();
  private pausedTransfers = new Set<string>();
  private cancelledTransfers = new Set<string>();
  private speedTrackers = new Map<string, { lastBytes: number; lastTime: number }>();
  private simulatedPeerActive: boolean = false;
  private presenceInterval: any = null;
  private localPollInterval: any = null;

  constructor(selfPeer: Peer, roomId: string, callbacks: WebRTCManagerCallbacks) {
    this.selfPeer = selfPeer;
    this.roomId = roomId;
    this.callbacks = callbacks;
  }

  public init() {
    this.joinMeshRoom();
    this.startLocalSignalingFallback();
  }

  public destroy() {
    if (this.presenceInterval) clearInterval(this.presenceInterval);
    if (this.localPollInterval) clearInterval(this.localPollInterval);
    if (this.room) {
      try {
        this.room.leave();
      } catch {}
      this.room = null;
    }
  }

  public setRoomId(newRoom: string) {
    if (this.roomId === newRoom && this.room) return;
    this.roomId = newRoom;
    if (this.room) {
      try {
        this.room.leave();
      } catch {}
      this.room = null;
    }
    this.peers.clear();
    this.broadcastPeersList();
    this.joinMeshRoom();
  }

  // Connects to global decentralized WebRTC discovery mesh
  private joinMeshRoom() {
    try {
      const sanitizedRoom = (this.roomId || 'default-lan').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const room = joinNostrRoom(
        { appId: 'aetherdrop-p2p-transfer-v1' },
        `aetherdrop-${sanitizedRoom}`
      );
      this.room = room;

      // 1. Setup Presence Action
      this.presenceAction = room.makeAction('presence');
      this.presenceAction.onReceive = (data: any, peerId: string) => {
        if (!data || !data.peer) return;
        const incomingPeer: Peer = {
          ...data.peer,
          id: peerId, // Map to trystero peer identifier
          status: 'connected',
          connectionType: 'webrtc-direct',
        };
        this.peers.set(peerId, incomingPeer);
        this.broadcastPeersList();
      };

      // 2. Setup File Offer Action
      this.fileOfferAction = room.makeAction('file-offer');
      this.fileOfferAction.onReceive = async (msg: any, peerId: string) => {
        if (!msg || !msg.transferId) return;
        try {
          const rawKeyBuffer = new Uint8Array(msg.rawKey).buffer;
          const chunkKey = await importKeyRaw(rawKeyBuffer);
          const senderPeer = this.peers.get(peerId);

          const task: TransferTask = {
            id: msg.transferId,
            fileName: msg.fileName,
            fileSize: msg.fileSize,
            mimeType: msg.mimeType,
            direction: 'receive',
            peerId,
            peerName: senderPeer ? senderPeer.name : 'Nearby Peer',
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
        } catch (err) {
          console.error('Failed to parse incoming file offer:', err);
        }
      };

      // 3. Setup File Chunk Action (AES-256-GCM Encrypted Chunks)
      this.fileChunkAction = room.makeAction('file-chunk');
      this.fileChunkAction.onReceive = async (msg: any) => {
        if (!msg || !msg.transferId) return;
        const task = this.activeTransfers.get(msg.transferId);
        if (!task || !task.chunkKey) return;

        try {
          const iv = new Uint8Array(msg.iv);
          const encryptedBuffer = msg.data instanceof ArrayBuffer
            ? msg.data
            : new Uint8Array(msg.data).buffer;

          const decrypted = await decryptChunk(task.chunkKey, encryptedBuffer, iv);
          if (!task.receivedChunks) task.receivedChunks = [];
          task.receivedChunks[msg.chunkIdx] = decrypted;
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
      };

      // 4. Setup File Control Action (Pause / Resume / Cancel)
      this.fileControlAction = room.makeAction('file-control');
      this.fileControlAction.onReceive = (msg: any) => {
        if (!msg || !msg.transferId) return;
        const task = this.activeTransfers.get(msg.transferId);
        if (!task) return;

        if (msg.type === 'PAUSE') {
          this.pausedTransfers.add(msg.transferId);
          task.status = 'paused';
          task.speed = 0;
          this.callbacks.onTransferUpdated(task);
        } else if (msg.type === 'RESUME') {
          this.pausedTransfers.delete(msg.transferId);
          task.status = 'transferring';
          this.callbacks.onTransferUpdated(task);
        } else if (msg.type === 'CANCEL') {
          this.cancelledTransfers.add(msg.transferId);
          task.status = 'cancelled';
          task.speed = 0;
          task.eta = 0;
          if (task.receivedChunks) task.receivedChunks = [];
          this.callbacks.onTransferUpdated(task);
          playErrorTone();
        }
      };

      // 5. Setup File Complete Action
      this.fileCompleteAction = room.makeAction('file-complete');
      this.fileCompleteAction.onReceive = (msg: any) => {
        if (!msg || !msg.transferId) return;
        const task = this.activeTransfers.get(msg.transferId);
        if (task && task.receivedChunks) {
          this.finalizeReceivedFile(task, msg.checksum);
        }
      };

      // Event: Peer Joined room
      room.onPeerJoin = (peerId: string) => {
        console.log(`[AetherDrop] Peer joined room: ${peerId}`);
        // Immediately announce self to this peer
        this.sendPresenceInfo(peerId);
      };

      // Event: Peer Left room
      room.onPeerLeave = (peerId: string) => {
        console.log(`[AetherDrop] Peer left room: ${peerId}`);
        this.peers.delete(peerId);
        this.broadcastPeersList();
      };

      // Periodic presence broadcast every 3.5s
      this.sendPresenceInfo();
      this.presenceInterval = setInterval(() => {
        this.sendPresenceInfo();
      }, 3500);

    } catch (err) {
      console.warn('Failed to initialize mesh room:', err);
    }
  }

  private sendPresenceInfo(targetPeerId?: string) {
    if (!this.presenceAction) return;
    try {
      const payload = {
        peer: {
          id: this.selfPeer.id,
          name: this.selfPeer.name,
          deviceType: this.selfPeer.deviceType,
          browser: this.selfPeer.browser,
          avatarColor: this.selfPeer.avatarColor,
        },
      };
      if (targetPeerId) {
        this.presenceAction.send(payload, targetPeerId);
      } else {
        this.presenceAction.send(payload);
      }
    } catch {}
  }

  // Local Express server fallback (for localhost / LAN dev)
  private startLocalSignalingFallback() {
    this.localPollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/signal/peers?roomId=${encodeURIComponent(this.roomId)}&excludeId=${encodeURIComponent(this.selfPeer.id)}`);
        if (res.ok) {
          const data = await res.json();
          for (const sp of data.peers || []) {
            if (!this.peers.has(sp.id)) {
              this.peers.set(sp.id, {
                ...sp,
                status: 'available',
                connectionType: 'webrtc-lan',
              });
            }
          }
          this.broadcastPeersList();
        }
      } catch {}
    }, 4000);
  }

  private broadcastPeersList() {
    const list = Array.from(this.peers.values());
    if (this.simulatedPeerActive) {
      list.push({
        id: 'simulated_peer_test',
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
    this.sendPresenceInfo();
    this.broadcastPeersList();
  }

  public toggleSimulatedPeer(enable: boolean) {
    this.simulatedPeerActive = enable;
    this.broadcastPeersList();
  }

  // Send a file to a peer over WebRTC with AES-256-GCM encryption
  public async sendFile(file: File, targetPeer: Peer): Promise<string> {
    const transferId = 'xfer_' + Math.random().toString(36).slice(2, 10);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // Ephemeral 256-bit AES-GCM session key
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

    // Send file offer metadata
    const offerPayload = {
      transferId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      totalChunks,
      rawKey: Array.from(new Uint8Array(rawKey)),
      fingerprint,
    };

    if (this.fileOfferAction) {
      await this.fileOfferAction.send(offerPayload, targetPeer.id);
    }

    // Begin chunk streaming
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
        this.fileControlAction?.send({ type: 'CANCEL', transferId: task.id }, targetPeerId);
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

      // Send chunk over WebRTC DataChannel
      if (this.fileChunkAction) {
        await this.fileChunkAction.send(
          {
            transferId: task.id,
            chunkIdx,
            iv: Array.from(iv),
            data: encrypted,
          },
          targetPeerId
        );
      }

      bytesSent += (end - start);
      task.bytesTransferred = bytesSent;
      task.progress = Math.min(100, Math.round((bytesSent / file.size) * 100));

      this.updateMetrics(task);
      this.callbacks.onTransferUpdated(task);

      // Yield control slightly to maintain 60fps UI smoothness
      if (chunkIdx % 4 === 0) {
        await new Promise((r) => setTimeout(r, 4));
      }
    }

    // Verify complete file checksum
    const fullBuffer = await file.arrayBuffer();
    const checksum = await computeSHA256(fullBuffer);
    task.checksum = checksum;

    if (this.fileCompleteAction) {
      await this.fileCompleteAction.send(
        {
          transferId: task.id,
          checksum,
        },
        targetPeerId
      );
    }

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

    // Ephemeral download trigger (zero-caching)
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
      this.fileControlAction?.send({ type: 'PAUSE', transferId }, task.peerId);
    }
  }

  public resumeTransfer(transferId: string) {
    this.pausedTransfers.delete(transferId);
    const task = this.activeTransfers.get(transferId);
    if (task) {
      task.status = 'transferring';
      this.callbacks.onTransferUpdated(task);
      this.fileControlAction?.send({ type: 'RESUME', transferId }, task.peerId);
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
      this.fileControlAction?.send({ type: 'CANCEL', transferId }, task.peerId);
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
