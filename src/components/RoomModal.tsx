import React, { useState } from 'react';
import { X, KeyRound, Wifi, ArrowRight } from 'lucide-react';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoom: string;
  onSwitchRoom: (room: string) => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({
  isOpen,
  onClose,
  currentRoom,
  onSwitchRoom,
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
              <span>Join Room</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
