export type DeviceType = 'desktop' | 'mobile' | 'tablet';

export interface Peer {
  id: string;
  pin: string;
  name: string;
  deviceType: DeviceType;
  browser: string;
  avatarColor: string;
  isSelf?: boolean;
  status: 'available' | 'connecting' | 'connected' | 'busy';
  connectionType?: 'webrtc-direct' | 'webrtc-lan' | 'simulated';
}

export type TransferStatus =
  | 'connecting'
  | 'queued'
  | 'encrypting'
  | 'transferring'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'error';

export type EncryptionMode = 'turbo-dtls' | 'dual-crypto';
export type TransportType = 'webrtc-striped' | 'webrtc-direct' | 'relay-stream' | 'broadcast-channel' | 'simulated';

export interface TransferTask {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  direction: 'send' | 'receive';
  peerId: string;
  peerName: string;
  bytesTransferred: number;
  progress: number; // 0 - 100
  speed: number; // bytes/sec
  peakSpeed?: number; // highest bytes/sec attained
  channelCount?: number; // active parallel SCTP stripes
  transportType?: TransportType;
  eta: number; // seconds remaining
  status: TransferStatus;
  errorReason?: string;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  downloadUrl?: string; // in-memory ObjectURL (revoked on purge/dismiss)
  isEncrypted: boolean;
  encryptionMode?: EncryptionMode;
  isTetherMode?: boolean;
  fingerprint?: string;
  checksum?: string;
  // File object reference when sending
  rawFile?: File;
  // Chunks storage when receiving
  receivedChunks?: (ArrayBuffer | Uint8Array)[];
  totalChunks?: number;
  chunkKey?: CryptoKey;
}

export interface RoomConfig {
  roomId: string;
  encryptionMode: EncryptionMode;
  isTetherMode: boolean;
  e2eEncryptionEnabled: boolean;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
}
