import { RecentPeer, Peer } from '../types/transfer';

// 1. Screen Wake Lock Management: Keeps screen awake during transfers and receive mode
let wakeLockSentinel: any = null;

export async function requestWakeLock(): Promise<boolean> {
  if (typeof window === 'undefined' || !('wakeLock' in navigator)) {
    return false;
  }
  try {
    if (!wakeLockSentinel) {
      // @ts-ignore
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null;
      });
      return true;
    }
    return true;
  } catch (err) {
    console.warn('[AetherDrop] Wake Lock request skipped or denied:', err);
    return false;
  }
}

export async function releaseWakeLock(): Promise<void> {
  try {
    if (wakeLockSentinel) {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
    }
  } catch {}
}

export function isWakeLockSupported(): boolean {
  return typeof window !== 'undefined' && 'wakeLock' in navigator;
}

// 2. Mobile Haptic Feedback API
export function triggerHaptic(type: 'tap' | 'success' | 'warning' | 'connect') {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return;
  try {
    switch (type) {
      case 'tap':
        navigator.vibrate(15);
        break;
      case 'connect':
        navigator.vibrate([25, 40, 35]);
        break;
      case 'success':
        navigator.vibrate([30, 50, 40, 50, 60]);
        break;
      case 'warning':
        navigator.vibrate([60, 40, 60]);
        break;
    }
  } catch {}
}

// 3. Browser Storage Quota Estimator
export interface StorageEstimateResult {
  quota: number; // in bytes
  usage: number; // in bytes
  available: number; // in bytes
  formattedAvailable: string;
  percentUsed: number;
}

export async function getStorageEstimate(): Promise<StorageEstimateResult | null> {
  if (typeof window === 'undefined' || !navigator.storage || !navigator.storage.estimate) {
    return null;
  }
  try {
    const est = await navigator.storage.estimate();
    const quota = est.quota || 0;
    const usage = est.usage || 0;
    const available = Math.max(0, quota - usage);
    const percentUsed = quota > 0 ? Math.round((usage / quota) * 100) : 0;

    let formattedAvailable = 'Unknown';
    if (available > 1024 * 1024 * 1024) {
      formattedAvailable = `${(available / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    } else if (available > 1024 * 1024) {
      formattedAvailable = `${(available / (1024 * 1024)).toFixed(0)} MB`;
    }

    return {
      quota,
      usage,
      available,
      formattedAvailable,
      percentUsed,
    };
  } catch {
    return null;
  }
}

// 4. Recent Peers Persistence
const RECENT_PEERS_KEY = 'aetherdrop_recent_peers_v1';

export function getRecentPeers(): RecentPeer[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_PEERS_KEY);
    if (!raw) return [];
    const list: RecentPeer[] = JSON.parse(raw);
    return Array.isArray(list) ? list.slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function saveRecentPeer(peer: Peer | RecentPeer) {
  if (typeof window === 'undefined' || !peer || !peer.pin) return;
  try {
    const current = getRecentPeers();
    const updated: RecentPeer[] = [
      {
        id: peer.id,
        pin: peer.pin,
        name: peer.name,
        deviceType: peer.deviceType,
        browser: peer.browser,
        avatarColor: peer.avatarColor,
        lastSeen: Date.now(),
      },
      ...current.filter((p) => p.pin !== peer.pin && p.id !== peer.id),
    ].slice(0, 6);

    localStorage.setItem(RECENT_PEERS_KEY, JSON.stringify(updated));
  } catch {}
}

export function removeRecentPeer(pin: string) {
  if (typeof window === 'undefined') return;
  try {
    const current = getRecentPeers();
    const filtered = current.filter((p) => p.pin !== pin);
    localStorage.setItem(RECENT_PEERS_KEY, JSON.stringify(filtered));
  } catch {}
}

export function clearRecentPeers() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(RECENT_PEERS_KEY);
}

// 5. Clipboard file extractor
export function extractFilesFromClipboard(event: ClipboardEvent): File[] {
  const items = event.clipboardData?.items;
  if (!items) return [];

  const files: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) {
        // Name unnamed pasted images
        if (file.name === 'image.png' || !file.name) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const namedFile = new File([file], `Pasted_Image_${timestamp}.png`, {
            type: file.type || 'image/png',
          });
          files.push(namedFile);
        } else {
          files.push(file);
        }
      }
    }
  }
  return files;
}
