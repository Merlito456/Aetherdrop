import { DeviceType } from '../types/transfer';

const ADJECTIVES = [
  'Swift', 'Silent', 'Cobalt', 'Cosmic', 'Golden', 'Hyper', 'Lunar', 'Neon',
  'Solar', 'Quantum', 'Shadow', 'Velvet', 'Vivid', 'Electric', 'Arctic', 'Zenith'
];

const ANIMALS = [
  'Falcon', 'Otter', 'Lynx', 'Fox', 'Cheetah', 'Eagle', 'Panda', 'Dolphin',
  'Osprey', 'Wolf', 'Badger', 'Kestrel', 'Raven', 'Tiger', 'Hawk', 'Leopard'
];

const AVATAR_COLORS = [
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f97316', // orange
  '#10b981', // emerald
  '#14b8a6', // teal
];

export function getOrCreatePeerIdentity(): {
  id: string;
  pin: string;
  name: string;
  deviceType: DeviceType;
  browser: string;
  avatarColor: string;
} {
  // We use sessionStorage (memory-only per session) or generate fresh
  const key = 'aetherdrop_peer_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = 'peer_' + Math.random().toString(36).substring(2, 10);
    sessionStorage.setItem(key, id);
  }

  let pin = sessionStorage.getItem('aetherdrop_peer_pin');
  if (!pin) {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
    sessionStorage.setItem('aetherdrop_peer_pin', pin);
  }

  let name = sessionStorage.getItem('aetherdrop_peer_name');
  if (!name) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const anim = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    name = `${adj} ${anim}`;
    sessionStorage.setItem('aetherdrop_peer_name', name);
  }

  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const deviceType = detectDeviceType();
  const browser = detectBrowser();

  return { id, pin, name, deviceType, browser, avatarColor: color };
}

export function detectDeviceType(): DeviceType {
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk/i.test(ua)) {
    return 'tablet';
  }
  if (/mobi|iphone|ipod|android/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

export function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome/')) return 'Chrome';
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('OPR/') || ua.includes('Opera/')) return 'Opera';
  return 'Browser';
}
