import React, { useState } from 'react';
import {
  ArrowLeft,
  Camera,
  RefreshCw,
  KeyRound,
  ArrowRight,
  Laptop,
  Smartphone,
  Tablet,
  Radio,
  Zap,
  Loader2,
} from 'lucide-react';
import { Peer } from '../types/transfer';
import { formatBytes } from '../utils/formatters';

interface ShareItRadarScannerProps {
  selfPeer: Peer;
  stagedFiles: File[];
  peers: Peer[];
  onBack: () => void;
  onSelectReceiver: (peer: Peer) => void;
  onOpenScanner: () => void;
  onRefresh: () => void;
  onConnectByPin: (pin: string) => void | Promise<any>;
  signalingStatus: 'connected' | 'connecting' | 'offline';
  signalingMessage?: string;
  isTetherMode?: boolean;
}

export const ShareItRadarScanner: React.FC<ShareItRadarScannerProps> = ({
  selfPeer,
  stagedFiles,
  peers,
  onBack,
  onSelectReceiver,
  onOpenScanner,
  onRefresh,
  onConnectByPin,
  signalingStatus,
  signalingMessage,
  isTetherMode = false,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [pinNotice, setPinNotice] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPinSubmitting, setIsPinSubmitting] = useState(false);

  const totalSize = stagedFiles.reduce((acc, f) => acc + f.size, 0);

  const handleRefresh = () => {
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pinInput.trim();
    if (!clean) return;
    if (clean === selfPeer.pin) {
      setPinNotice("That is this device's own PIN. Enter the PIN shown on the receiver's screen.");
      return;
    }
    const matched = peers.find((p) => p.pin === clean);
    if (matched) {
      onSelectReceiver(matched);
      return;
    }
    setIsPinSubmitting(true);
    setPinNotice(`Connecting and transmitting ${stagedFiles.length} file(s) to PIN ${clean}...`);
    try {
      await onConnectByPin(clean);
    } catch {
      setPinNotice(`Unable to connect to PIN ${clean}. Please verify the receiver is in Receive mode.`);
    } finally {
      setIsPinSubmitting(false);
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-5 h-5" />;
      case 'tablet':
        return <Tablet className="w-5 h-5" />;
      default:
        return <Laptop className="w-5 h-5" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={onBack}
          className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Change Files</span>
        </button>

        <div className="text-center">
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Searching for Receivers...
          </h2>
          <p className="text-[11px] text-neutral-500 font-mono">
            {stagedFiles.length} {stagedFiles.length === 1 ? 'file' : 'files'} ({formatBytes(totalSize)}) ready
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className={`p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            title="Scan again"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenScanner}
            className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs"
          >
            <Camera className="w-4 h-4" />
            <span>Scan QR</span>
          </button>
        </div>
      </div>

      {/* Manual PIN Fallback Form */}
      <div className="p-3 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-cyan-500" />
          <span className="text-neutral-600 dark:text-neutral-400">
            Receiver's PIN:
          </span>
        </div>

        <form onSubmit={handlePinSubmit} className="flex items-center gap-2">
          <input
            type="text"
            maxLength={6}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="e.g. 8492"
            className="w-32 px-2.5 py-1 text-xs font-mono bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
          />
          <button
            type="submit"
            disabled={isPinSubmitting || !pinInput.trim()}
            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
          >
            {isPinSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <span>Send to PIN</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </div>

      {pinNotice && (
        <div className="px-3 py-2 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 rounded-xl text-xs text-cyan-700 dark:text-cyan-300">
          {pinNotice}
        </div>
      )}

      {isTetherMode && (
        <div className="px-4 py-2 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-400 dark:border-cyan-800 rounded-2xl flex items-center justify-between gap-2 text-xs shadow-2xs">
          <span className="flex items-center gap-1.5 font-bold text-cyan-800 dark:text-cyan-200">
            <Zap className="w-4 h-4 text-cyan-500 fill-current" />
            <span>Wi-Fi Tethering Boost: Direct 1-Hop 4x Striped Link Active</span>
          </span>
          <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
            50–120+ MB/s
          </span>
        </div>
      )}

      {/* Iconic Sonar Radar Arena */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-8 sm:p-12 relative flex flex-col items-center justify-center min-h-[380px] overflow-hidden shadow-xs">
        {/* Animated Sonar Rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 dark:opacity-20">
          <div className="w-48 h-48 sm:w-60 sm:h-60 rounded-full border border-cyan-400 dark:border-cyan-500 animate-ping duration-1000" />
          <div className="absolute w-72 h-72 sm:w-88 sm:h-88 rounded-full border border-neutral-300 dark:border-neutral-700" />
          <div className="absolute w-96 h-96 sm:w-[440px] sm:h-[440px] rounded-full border border-neutral-200 dark:border-neutral-800" />
        </div>

        {/* Center Sender Avatar */}
        <div className="relative z-10 flex flex-col items-center mb-8">
          <div
            className="w-18 h-18 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-cyan-500/25 ring-4 ring-white dark:ring-neutral-900"
            style={{ backgroundColor: selfPeer.avatarColor }}
          >
            {getDeviceIcon(selfPeer.deviceType)}
          </div>
          <span className="mt-2 text-xs font-bold text-neutral-900 dark:text-neutral-100">
            {selfPeer.name} (Sender)
          </span>
          <span className="text-[11px] font-mono text-neutral-400">
            PIN: {selfPeer.pin}
          </span>
        </div>

        {/* Discovered Receivers Grid / Satellites */}
        {peers.length === 0 ? (
          <div className="relative z-10 max-w-sm text-center px-4 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500 dark:text-neutral-400">
            <p className="font-bold text-neutral-800 dark:text-neutral-200 mb-1">
              Tap "RECEIVE" on the other device
            </p>
            <p className="leading-relaxed">
              When the other device opens Receive Mode, its avatar will appear here. Or tap <strong className="text-cyan-600">Scan QR</strong> above to scan the receiver's screen.
            </p>
          </div>
        ) : (
          <div className="relative z-10 w-full max-w-xl">
            <p className="text-center text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-4">
              Tap a receiver to start transmitting:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {peers.map((peer) => (
                <button
                  key={peer.id}
                  onClick={() => onSelectReceiver(peer)}
                  className="group p-4 rounded-2xl border-2 border-cyan-500/40 hover:border-cyan-500 bg-cyan-50/20 dark:bg-cyan-950/20 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/40 transition-all text-left flex items-center justify-between gap-3 shadow-xs cursor-pointer active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm"
                      style={{ backgroundColor: peer.avatarColor }}
                    >
                      {getDeviceIcon(peer.deviceType)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                        {peer.name}
                      </h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                        PIN: <span className="font-bold text-cyan-600 dark:text-cyan-400">{peer.pin}</span> · {peer.deviceType}
                      </p>
                    </div>
                  </div>

                  <div className="px-3 py-1.5 rounded-xl bg-cyan-600 group-hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1 shrink-0 shadow-xs">
                    <span>Send</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
