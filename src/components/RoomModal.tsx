import React, { useState } from 'react';
import { X, KeyRound, Wifi, ArrowRight } from 'lucide-react';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoom: string;
  onSwitchRoom: (room: string) => void;
  encryptionMode?: 'turbo-dtls' | 'dual-crypto';
  onSwitchEncryptionMode?: (mode: 'turbo-dtls' | 'dual-crypto') => void;
  isTetherMode?: boolean;
  onSwitchTetherMode?: (enabled: boolean) => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({
  isOpen,
  onClose,
  currentRoom,
  onSwitchRoom,
  encryptionMode = 'turbo-dtls',
  onSwitchEncryptionMode,
  isTetherMode = false,
  onSwitchTetherMode,
}) => {
  const [roomInput, setRoomInput] = useState(currentRoom);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = roomInput.trim() || 'default-lan';
    onSwitchRoom(clean);
    onClose();
  };

  const setRandomPin = () => {
    const pin = 'PIN-' + Math.floor(100000 + Math.random() * 900000);
    setRoomInput(pin);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 max-w-sm w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950/70 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
            <Wifi className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Pairing Rooms & Subnet
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Isolate discovery to a custom PIN room
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Room Identifier or PIN
            </label>
            <div className="relative">
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder="e.g. default-lan or 6-digit PIN"
                className="w-full text-xs font-mono bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={setRandomPin}
                className="absolute right-2 top-1.5 p-1 text-neutral-400 hover:text-cyan-600 dark:hover:text-cyan-400 text-xs flex items-center gap-1"
                title="Generate random PIN"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Random PIN</span>
              </button>
            </div>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1.5">
              Devices using the same room identifier on the same network will instantly discover each other.
            </p>
          </div>

          {/* Wi-Fi Acceleration Mode Selection */}
          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
              Transfer Acceleration & Security
            </label>
            <div className="space-y-2">
              <label
                className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors ${
                  encryptionMode === 'turbo-dtls'
                    ? 'border-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/40 text-cyan-900 dark:text-cyan-100'
                    : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850'
                }`}
              >
                <input
                  type="radio"
                  name="speedMode"
                  checked={encryptionMode === 'turbo-dtls'}
                  onChange={() => onSwitchEncryptionMode?.('turbo-dtls')}
                  className="mt-0.5 text-cyan-600 focus:ring-cyan-500"
                />
                <div className="text-xs">
                  <div className="font-bold flex items-center gap-1 text-cyan-700 dark:text-cyan-300">
                    <span>⚡ Uncapped Wire Speed (25 - 60+ MB/s)</span>
                    <span className="text-[10px] bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 px-1.5 py-0.2 rounded font-bold">Recommended</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
                    Uncaps WebRTC SCTP bandwidth to 2 Gbps. Direct hardware DTLS AES-256-GCM encryption with zero-copy binary streaming and background discovery suspension.
                  </p>
                </div>
              </label>

              <label
                className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors ${
                  encryptionMode === 'dual-crypto'
                    ? 'border-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/40 text-cyan-900 dark:text-cyan-100'
                    : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850'
                }`}
              >
                <input
                  type="radio"
                  name="speedMode"
                  checked={encryptionMode === 'dual-crypto'}
                  onChange={() => onSwitchEncryptionMode?.('dual-crypto')}
                  className="mt-0.5 text-cyan-600 focus:ring-cyan-500"
                />
                <div className="text-xs">
                  <div className="font-bold text-neutral-800 dark:text-neutral-200">
                    🔒 Dual-Layer Mode (DTLS + WebCrypto)
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
                    Double-layer encryption using native DTLS and application-layer WebCrypto AES-GCM chunk keys.
                  </p>
                </div>
              </label>
            </div>

            {/* Direct Wi-Fi Tethering Boost Checkbox */}
            <label className={`mt-2.5 p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-colors ${
              isTetherMode
                ? 'border-cyan-500 bg-cyan-50/70 dark:bg-cyan-950/40 text-cyan-900 dark:text-cyan-100'
                : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850'
            }`}>
              <input
                type="checkbox"
                checked={isTetherMode}
                onChange={(e) => onSwitchTetherMode?.(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 accent-cyan-500 cursor-pointer"
              />
              <div className="text-xs">
                <div className="font-bold flex items-center gap-1.5 text-neutral-900 dark:text-neutral-100">
                  <span>⚡ Wi-Fi Tethering / Mobile Hotspot Boost</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                    isTetherMode
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400'
                  }`}>
                    {isTetherMode ? '⚡ Unlimited 4x Striped Boost' : 'Off'}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
                  Use when client PC/laptop connects directly to sender's phone hotspot. Enables 4 parallel SCTP channels and 16 MB in-memory prefetch for line-rate Wi-Fi speed.
                </p>
              </div>
            </label>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setRoomInput('default-lan');
              }}
              className="px-3 py-2 text-xs font-medium border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 transition-colors"
            >
              Default LAN
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-3 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-cyan-600/20"
            >
              <span>Save & Reconnect</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
