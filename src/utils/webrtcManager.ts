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

const CHUNK_SIZE = 64 * 1024; // 64 KB per chunk for optimal WebRTC throughput
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
}

export class WebRTCManager {
  private selfPeer: Peer;
  private roomId: string;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  private activeTransfers = new Map<string, TransferTask>();
  private pausedTransfers = new Set<string>();
  private cancelledTransfers = new Set<string>();
  private callbacks: WebRTCManagerCallbacks;
  private pollInterval: any = null;
  private heartbeatInterval: any = null;
  private simulatedPeerActive: boolean = false;
  private speedTrackers = new Map<string, { lastBytes: number; lastTime: number }>();

  constructor(selfPeer: Peer, roomId: string, callbacks: WebRTCManagerCallbacks) {
    this.selfPeer = selfPeer;
    this.roomId = roomId;
    this.callbacks = callbacks;
  }

  public init() {
    this.registerSelf();
    this.startHeartbeat();
    this.startMessagePolling();
    this.fetchPeers();
  }

  public destroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    for (const dc of this.dataChannels.values()) {
      try { dc.close(); } catch { }
    }
    for (const pc of this.peerConnections.values()) {
      try { pc.close(); } catch { }
    }
    this.leaveRoom();
  }

  public setRoomId(newRoom: string) {
    this.roomId = newRoom;
    this.registerSelf();
    this.fetchPeers();
  }

  private async registerSelf() {
    try {
      await fetch('/api/signal/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: this.selfPeer.id,
          name: this.selfPeer.name,
          deviceType: this.selfPeer.deviceType,
          browser: this.selfPeer.browser,
          avatarColor: this.selfPeer.avatarColor,
          roomId: this.roomId,
        }),
      });
    } catch (err) {
      console.warn('Signaling registration offline/skipped:', err);
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await fetch('/api/signal/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: this.selfPeer.id }),
        });
        this.fetchPeers();
      } catch { }
    }, 4000);
  }

  private startMessagePolling() {
    this.pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/signal/messages?peerId=${encodeURIComponent(this.selfPeer.id)}`);
        if (res.ok) {
          const data = await res.json();
          for (const msg of data.messages || []) {
            this.handleSignalMessage(msg);
          }
        }
      } catch { }
    }, 1500);
  }

  public async fetchPeers() {
    try {
      const res = await fetch(`/api/signal/peers?roomId=${encodeURIComponent(this.roomId)}&excludeId=${encodeURIComponent(this.selfPeer.id)}`);
      if (res.ok) {
        const data = await res.json();
        const serverPeers: Peer[] = (data.peers || []).map((p: any) => ({
          ...p,
          status: this.dataChannels.has(p.id) ? 'connected' : 'available',
        }));

        if (this.simulatedPeerActive) {
          serverPeers.push({
            id: 'simulated_peer_test',
            name: 'Pixel 9 Pro (Simulated Wi-Fi Peer)',
            deviceType: 'mobile',
            browser: 'Chrome Mobile',
            avatarColor: '#10b981',
            status: 'connected',
            connectionType: 'simulated',
          });
        }

        this.callbacks.onPeersUpdated(serverPeers);
      }
    } catch {
      if (this.simulatedPeerActive) {
        this.callbacks.onPeersUpdated([{
          id: 'simulated_peer_test',
          name: 'Pixel 9 Pro (Simulated Wi-Fi Peer)',
          deviceType: 'mobile',
          browser: 'Chrome Mobile',
          avatarColor: '#10b981',
          status: 'connected',
          connectionType: 'simulated',
        }]);
      }
    }
  }

  public toggleSimulatedPeer(enable: boolean) {
    this.simulatedPeerActive = enable;
    this.fetchPeers();
  }

  private async leaveRoom() {
    try {
      await fetch('/api/signal/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: this.selfPeer.id }),
      });
    } catch { }
  }

  private async sendSignal(targetId: string, type: string, payload: any) {
    try {
      await fetch('/api/signal/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: this.selfPeer.id,
          targetId,
          type,
          payload,
        }),
      });
    } catch (err) {
      console.warn('Failed to send signaling message:', err);
    }
  }

  // Connect to a peer via WebRTC offer/answer
  public async connectToPeer(targetPeerId: string): Promise<boolean> {
    if (targetPeerId === 'simulated_peer_test') {
      return true;
    }

    if (this.dataChannels.has(targetPeerId)) {
      return true;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
      ],
    });
    this.peerConnections.set(targetPeerId, pc);

    const dc = pc.createDataChannel('aetherdrop_transfer', { ordered: true });
    this.setupDataChannel(targetPeerId, dc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(targetPeerId, 'ice-candidate', event.candidate);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.sendSignal(targetPeerId, 'offer', offer);
    return true;
  }

  private setupDataChannel(peerId: string, dc: RTCDataChannel) {
    dc.binaryType = 'arraybuffer';
    dc.bufferedAmountLowThreshold = 64 * 1024;

    dc.onopen = () => {
      this.dataChannels.set(peerId, dc);
      this.fetchPeers();
    };

    dc.onclose = () => {
      this.dataChannels.delete(peerId);
      this.fetchPeers();
    };

    dc.onerror = (e) => {
      console.error(`DataChannel error with peer ${peerId}:`, e);
    };

    dc.onmessage = (event) => {
      this.handleDataChannelMessage(peerId, event.data);
    };
  }

  private async handleSignalMessage(msg: { senderId: string; type: string; payload: any }) {
    const { senderId, type, payload } = msg;

    if (type === 'offer') {
      let pc = this.peerConnections.get(senderId);
      if (!pc) {
        pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        });
        this.peerConnections.set(senderId, pc);

        pc.ondatachannel = (e) => {
          this.setupDataChannel(senderId, e.channel);
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            this.sendSignal(senderId, 'ice-candidate', event.candidate);
          }
        };
      }

      await pc.setRemoteDescription(new RTCSessionDescription(payload));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.sendSignal(senderId, 'answer', answer);
    } else if (type === 'answer') {
      const pc = this.peerConnections.get(senderId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
      }
    } else if (type === 'ice-candidate') {
      const pc = this.peerConnections.get(senderId);
      if (pc && payload) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload));
        } catch (err) {
          console.warn('ICE candidate addition failed:', err);
        }
      }
    }
  }

  // Send a file to a peer
  public async sendFile(file: File, targetPeer: Peer): Promise<string> {
    const transferId = 'xfer_' + Math.random().toString(36).slice(2, 10);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // Generate ephemeral 256-bit AES-GCM key for this transfer
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

    // Ensure connection is established
    await this.connectToPeer(targetPeer.id);
    const dc = this.dataChannels.get(targetPeer.id);

    // Send metadata header over control
    const metaPayload = {
      type: 'FILE_OFFER',
      transferId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      totalChunks,
      rawKey: Array.from(new Uint8Array(rawKey)),
      fingerprint,
    };

    if (dc && dc.readyState === 'open') {
      dc.send(JSON.stringify(metaPayload));
    } else {
      // Send via signaling as fallback
      await this.sendSignal(targetPeer.id, 'file-offer', metaPayload);
    }

    // Start streaming chunks
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
        this.sendControlMessage(targetPeerId, 'TRANSFER_CANCEL', { transferId: task.id });
        return;
      }

      while (this.pausedTransfers.has(task.id)) {
        task.status = 'paused';
        task.speed = 0;
        this.callbacks.onTransferUpdated(task);
        await new Promise(r => setTimeout(r, 400));
        if (this.cancelledTransfers.has(task.id)) return;
      }

      if (task.status === 'paused') {
        task.status = 'transferring';
      }

      const start = chunkIdx * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const slice = file.slice(start, end);
      const buffer = await slice.arrayBuffer();

      // Encrypt chunk using AES-GCM
      const { encrypted, iv } = await encryptChunk(key, buffer, chunkIdx);

      // Check DataChannel backpressure
      const dc = this.dataChannels.get(targetPeerId);
      if (dc && dc.readyState === 'open') {
        if (dc.bufferedAmount > MAX_BUFFERED_AMOUNT) {
          await new Promise<void>((resolve) => {
            const onLow = () => {
              dc.removeEventListener('bufferedamountlow', onLow);
              resolve();
            };
            dc.addEventListener('bufferedamountlow', onLow);
          });
        }

        // Send chunk message header + encrypted payload
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
    }

    // Compute entire file checksum for end-to-end verification
    const fullBuffer = await file.arrayBuffer();
    const checksum = await computeSHA256(fullBuffer);
    task.checksum = checksum;

    this.sendControlMessage(targetPeerId, 'FILE_COMPLETE', {
      transferId: task.id,
      checksum,
    });

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

  // Handle messages received over RTCDataChannel
  private async handleDataChannelMessage(peerId: string, data: any) {
    if (typeof data === 'string') {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'FILE_OFFER') {
          const rawKeyBuffer = new Uint8Array(msg.rawKey).buffer;
          const chunkKey = await importKeyRaw(rawKeyBuffer);

          const task: TransferTask = {
            id: msg.transferId,
            fileName: msg.fileName,
            fileSize: msg.fileSize,
            mimeType: msg.mimeType,
            direction: 'receive',
            peerId,
            peerName: 'Remote Peer',
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
          // Store pending header for next binary data
          (this as any).pendingChunkHeader = msg;
        } else if (msg.type === 'TRANSFER_PAUSE') {
          this.pausedTransfers.add(msg.transferId);
          const task = this.activeTransfers.get(msg.transferId);
          if (task) {
            task.status = 'paused';
            this.callbacks.onTransferUpdated(task);
          }
        } else if (msg.type === 'TRANSFER_RESUME') {
          this.pausedTransfers.delete(msg.transferId);
          const task = this.activeTransfers.get(msg.transferId);
          if (task) {
            task.status = 'transferring';
            this.callbacks.onTransferUpdated(task);
          }
        } else if (msg.type === 'TRANSFER_CANCEL') {
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
      } catch (err) {
        console.warn('Error processing data channel text message:', err);
      }
    } else if (data instanceof ArrayBuffer) {
      const header = (this as any).pendingChunkHeader;
      if (header) {
        const task = this.activeTransfers.get(header.transferId);
        if (task && task.chunkKey) {
          const iv = new Uint8Array(header.iv);
          try {
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
        (this as any).pendingChunkHeader = null;
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

    // In-memory zero-caching URL (never persistent)
    const downloadUrl = URL.createObjectURL(blob);
    task.downloadUrl = downloadUrl;
    task.status = 'completed';
    task.completedAt = Date.now();
    task.progress = 100;
    task.speed = 0;
    task.eta = 0;

    // Immediately trigger browser download for seamless local sharing
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

  // Update transfer speed and ETA calculation
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
      // Exponential moving average for smooth display
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
      this.sendControlMessage(task.peerId, 'TRANSFER_PAUSE', { transferId });
    }
  }

  public resumeTransfer(transferId: string) {
    this.pausedTransfers.delete(transferId);
    const task = this.activeTransfers.get(transferId);
    if (task) {
      task.status = 'transferring';
      this.callbacks.onTransferUpdated(task);
      this.sendControlMessage(task.peerId, 'TRANSFER_RESUME', { transferId });
    }
  }

  public cancelTransfer(transferId: string) {
    this.cancelledTransfers.add(transferId);
    const task = this.activeTransfers.get(transferId);
    if (task) {
      task.status = 'cancelled';
      task.speed = 0;
      task.eta = 0;
      // Wipe received chunks from memory immediately for zero-caching security
      if (task.receivedChunks) {
        task.receivedChunks = [];
      }
      if (task.downloadUrl) {
        URL.revokeObjectURL(task.downloadUrl);
        delete task.downloadUrl;
      }
      this.callbacks.onTransferUpdated(task);
      this.sendControlMessage(task.peerId, 'TRANSFER_CANCEL', { transferId });
      playErrorTone();
    }
  }

  private sendControlMessage(targetPeerId: string, type: string, payload: any) {
    const dc = this.dataChannels.get(targetPeerId);
    if (dc && dc.readyState === 'open') {
      dc.send(JSON.stringify({ type, ...payload }));
    } else {
      this.sendSignal(targetPeerId, type.toLowerCase(), payload);
    }
  }

  // Simulated peer transfer for immediate demo and testing in a single tab
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

    // Simulate high-speed local Wi-Fi transfer (~18-35 MB/s)
    const simulatedChunkDelayMs = Math.max(8, Math.min(35, Math.floor(250 / totalChunks)));

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
        await new Promise(r => setTimeout(r, 300));
        if (this.cancelledTransfers.has(task.id)) return;
      }

      if (task.status === 'paused') {
        task.status = 'transferring';
      }

      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const slice = file.slice(start, end);
      const rawChunk = await slice.arrayBuffer();

      // Real encryption on sender side
      const { encrypted, iv } = await encryptChunk(key, rawChunk, i);

      await new Promise(r => setTimeout(r, simulatedChunkDelayMs));

      // Real decryption on simulated peer side
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

    // Assemble blob and verify download capability
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

  // Purge all in-memory buffers for privacy
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
