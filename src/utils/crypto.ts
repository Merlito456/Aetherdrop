/**
 * Web Crypto API implementation for end-to-end peer encryption
 * Uses AES-GCM 256-bit with authenticated integrity tags and unique IVs per chunk.
 */

// Generate a random 256-bit AES-GCM key for a file transfer session
export async function generateTransferKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable for key exchange
    ['encrypt', 'decrypt']
  );
}

// Export CryptoKey to raw binary (ArrayBuffer)
export async function exportKeyRaw(key: CryptoKey): Promise<ArrayBuffer> {
  return await window.crypto.subtle.exportKey('raw', key);
}

// Import raw binary key back into CryptoKey
export async function importKeyRaw(rawKey: ArrayBuffer): Promise<CryptoKey> {
  return await window.crypto.subtle.importKey(
    'raw',
    rawKey,
    {
      name: 'AES-GCM',
    },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt a chunk using AES-GCM with a fresh 12-byte IV
export async function encryptChunk(
  key: CryptoKey,
  plainChunk: ArrayBuffer,
  chunkIndex: number
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
  // 12-byte initialization vector: 4-byte chunk index + 8 bytes cryptographically secure random
  const iv = new Uint8Array(12);
  const view = new DataView(iv.buffer);
  view.setUint32(0, chunkIndex, false);
  window.crypto.getRandomValues(iv.subarray(4));

  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    plainChunk
  );

  return { encrypted, iv };
}

// Decrypt a chunk using AES-GCM with the corresponding IV
export async function decryptChunk(
  key: CryptoKey,
  encryptedChunk: ArrayBuffer,
  iv: Uint8Array
): Promise<ArrayBuffer> {
  return await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    encryptedChunk
  );
}

// Compute SHA-256 hash of an entire file or buffer for integrity verification
export async function computeSHA256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a human-readable 4-symbol security fingerprint for visual verification
export async function generateFingerprint(keyRaw: ArrayBuffer): Promise<string> {
  const hash = await window.crypto.subtle.digest('SHA-256', keyRaw);
  const bytes = new Uint8Array(hash);
  const symbols = ['🔒', '🛡️', '⚡', '✨', '🔑', '💎', '🪐', '🌊', '⚓', '🍀', '🎯', '🚀'];
  const p1 = symbols[bytes[0] % symbols.length];
  const p2 = symbols[bytes[1] % symbols.length];
  const p3 = symbols[bytes[2] % symbols.length];
  const p4 = symbols[bytes[3] % symbols.length];
  const hexPart = bytes[4].toString(16).toUpperCase().padStart(2, '0') + bytes[5].toString(16).toUpperCase().padStart(2, '0');
  return `${p1} ${p2} ${p3} ${p4} (${hexPart})`;
}

// ArrayBuffer to Base64
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Base64 to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}
