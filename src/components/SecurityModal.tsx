import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Lock,
  Trash2,
  HardDriveDownload,
  Cpu,
  CheckCircle,
} from 'lucide-react';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurgeMemory: () => void;
}

export const SecurityModal: React.FC<SecurityModalProps> = ({
  isOpen,
  onClose,
  onPurgeMemory,
}) => {
  const [purged, setPurged] = useState(false);

  if (!isOpen) return null;

  const handlePurge = () => {
    onPurgeMemory();
    setPurged(true);
    setTimeout(() => setPurged(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 max-w-md w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Zero-Cache & Privacy Architecture
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Ephemeral in-memory data transmission
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3 text-xs text-neutral-600 dark:text-neutral-400">
          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 flex items-start gap-3">
            <Lock className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                ⚡ Hardware-Accelerated DTLS AES-256-GCM
              </p>
              <p className="mt-0.5 leading-relaxed text-neutral-500 dark:text-neutral-400">
                WebRTC DataChannels natively enforce end-to-end transport encryption via DTLS 1.2/1.3 with AES-128/256-GCM. Executed directly in the native C++ browser engine with CPU hardware acceleration (AES-NI / ARM Crypto), this achieves full local Wi-Fi speeds of <strong>15 to 40+ MB/s (120 to 320+ Mbps)</strong> with zero JS event-loop bottlenecks. Full SHA-256 integrity checksums verify every byte.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 flex items-start gap-3">
            <HardDriveDownload className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                Zero Local Caching & Storage
              </p>
              <p className="mt-0.5 leading-relaxed text-neutral-500 dark:text-neutral-400">
                No file chunks or file metadata are ever written to browser LocalStorage, IndexedDB, CacheStorage, or cookies. Files exist purely in ephemeral JavaScript ArrayBuffer RAM and are revoked immediately.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-800 flex items-start gap-3">
            <Cpu className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                Direct WebRTC P2P DataChannel
              </p>
              <p className="mt-0.5 leading-relaxed text-neutral-500 dark:text-neutral-400">
                Transfers flow directly between devices over the local Wi-Fi / LAN connection. No file bytes or content ever pass through or get stored on any remote cloud server.
              </p>
            </div>
          </div>
        </div>

        {/* Purge Memory Button */}
        <div className="mt-5 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex flex-col gap-2">
          <button
            onClick={handlePurge}
            disabled={purged}
            className="w-full py-2.5 px-3 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-colors flex items-center justify-center gap-2"
          >
            {purged ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>In-Memory Buffers Purged Successfully</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Purge Memory Buffers & Wipe Session</span>
              </>
            )}
          </button>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 text-center">
            Instantly clears all in-memory ArrayBuffers and revokes existing blob download URLs.
          </p>
        </div>
      </div>
    </div>
  );
};
