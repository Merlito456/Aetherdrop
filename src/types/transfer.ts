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
  | 'queued'
  | 'encrypting'
  | 'transferring'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'error';

export type EncryptionMode = 'turbo-dtls' | 'dual-crypto';

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
  eta: number; // seconds remaining
  status: TransferStatus;
  errorReason?: string;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  downloadUrl?: string; // in-memory ObjectURL (revoked on purge/dismiss)
  isEncrypted: boolean;
  encryptionMode?: EncryptionMode;
  fingerprint?: string;
  checksum?: string;
  // File object reference when sending
  rawFile?: File;
  // Chunks storage when receiving
  receivedChunks?: ArrayBuffer[];
  totalChunks?: number;
  chunkKey?: CryptoKey;
}

export interface RoomConfig {
  roomId: string;
  encryptionMode: EncryptionMode;
  e2eEncryptionEnabled: boolean;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
}
