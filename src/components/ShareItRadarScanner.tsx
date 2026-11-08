import React, { useState, useEffect } from 'react';
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
  Sparkles,
  ShieldCheck,
  History,
  Send,
  Users,
  Wifi,
} from 'lucide-react';
import { Peer, RecentPeer } from '../types/transfer';
import { formatBytes } from '../utils/formatters';
import { getRecentPeers, triggerHaptic } from '../utils/systemWorkflows';

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
  const [recentPeers, setRecentPeers] = useState<RecentPeer[]>([]);

  useEffect(() => {
    const list = getRecentPeers().filter((p) => p.pin !== selfPeer.pin);
    setRecentPeers(list);
  }, [selfPeer.pin]);

  const totalSize = stagedFiles.reduce((acc, f) => acc + f.size, 0);

  const handleRefresh = () => {
    setIsRefreshing(true);
    triggerHaptic('tap');
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
      triggerHaptic('tap');
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

  const handleSelectRecent = async (recent: RecentPeer) => {
    triggerHaptic('tap');
    const onlineMatch = peers.find((p) => p.pin === recent.pin);
    if (onlineMatch) {
      onSelectReceiver(onlineMatch);
    } else {
      setIsPinSubmitting(true);
      setPinNotice(`Connecting to recent device ${recent.name} (PIN: ${recent.pin})...`);
      try {
        await onConnectByPin(recent.pin);
      } catch {
        setPinNotice(`Unable to reach ${recent.name}. Ensure it has AetherDrop open.`);
      } finally {
        setIsPinSubmitting(false);
      }
    }
  };

  // Broadcast to all nearby discovered receivers
  const handleBroadcastToAll = async () => {
    if (peers.length === 0) return;
    triggerHaptic('connect');
    for (const peer of peers) {
      onSelectReceiver(peer);
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
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={onBack}
          className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Change Files</span>
        </button>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Radio className="w-4 h-4 text-cyan-500 animate-pulse" />
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Nearby Receiver Radar
            </h2>
          </div>
          <p className="text-[11px] text-neutral-500 font-mono mt-0.5">
            {stagedFiles.length} {stagedFiles.length === 1 ? 'file' : 'files'} ({formatBytes(totalSize)}) ready to transmit
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className={`p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            title="Scan again"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenScanner}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Scan QR</span>
          </button>
        </div>
      </div>

      {/* Manual PIN Form Ribbon */}
      <div className="p-3.5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              Connect via 4-Digit PIN
            </span>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Type the receiver's PIN to initiate immediate transmission
            </p>
          </div>
        </div>

        <form onSubmit={handlePinSubmit} className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="e.g. 8492"
            className="w-28 px-3 py-1.5 text-xs font-mono font-bold bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 text-center"
          />
          <button
            type="submit"
            disabled={isPinSubmitting || !pinInput.trim()}
            className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-neutral-200 dark:disabled:bg-neutral-800 text-white rounded-xl font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shadow-xs"
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

      {/* Recent Devices Quick-Tap Strip */}
      {recentPeers.length > 0 && (
        <div className="p-3 bg-neutral-50/80 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center gap-2 overflow-x-auto text-xs">
          <span className="flex items-center gap-1 text-[11px] text-neutral-500 font-semibold shrink-0 pl-1">
            <History className="w-3.5 h-3.5 text-cyan-500" />
            <span>Recent:</span>
          </span>
          <div className="flex items-center gap-1.5">
            {recentPeers.map((r) => {
              const isOnline = peers.some((p) => p.pin === r.pin);
              return (
                <button
                  key={r.pin}
                  onClick={() => handleSelectRecent(r)}
                  className={`px-3 py-1 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                    isOnline
                      ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 font-semibold shadow-2xs'
                      : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100'
                  }`}
                  title={`Send directly to ${r.name} (PIN: ${r.pin})`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: isOnline ? '#10b981' : r.avatarColor }}
                  />
                  <span>{r.name}</span>
                  <span className="font-mono text-[10px] opacity-75">({r.pin})</span>
                  {isOnline && <span className="text-[10px] text-emerald-500 font-bold">Online</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {pinNotice && (
        <div className="px-4 py-2.5 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 rounded-xl text-xs text-cyan-800 dark:text-cyan-200 flex items-center justify-between">
          <span>{pinNotice}</span>
          <button
            onClick={() => setPinNotice(null)}
            className="text-cyan-600 hover:text-cyan-900 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {isTetherMode && (
        <div className="px-4 py-2.5 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-300 dark:border-cyan-800 rounded-2xl flex items-center justify-between gap-2 text-xs shadow-2xs">
          <span className="flex items-center gap-2 font-bold text-cyan-900 dark:text-cyan-100">
            <Zap className="w-4 h-4 text-cyan-500 fill-current" />
            <span>Wi-Fi Tethering Boost: Direct 1-Hop 8x Striped Link Ready</span>
          </span>
          <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
            80–180+ MB/s
          </span>
        </div>
      )}

      {/* Iconic Sonar Radar Arena */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-8 sm:p-12 relative flex flex-col items-center justify-center min-h-[380px] overflow-hidden shadow-xs">
        {/* Animated Sonar Rings and Sweep */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 dark:opacity-20">
          <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-full border border-cyan-400 dark:border-cyan-500 animate-ping duration-1000" />
          <div className="absolute w-72 h-72 sm:w-88 sm:h-88 rounded-full border border-neutral-300 dark:border-neutral-700" />
          <div className="absolute w-96 h-96 sm:w-[460px] sm:h-[460px] rounded-full border border-neutral-200 dark:border-neutral-800" />
        </div>

        {/* Center Sender Avatar */}
        <div className="relative z-10 flex flex-col items-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-cyan-500/25 ring-4 ring-white dark:ring-neutral-900"
            style={{ backgroundColor: selfPeer.avatarColor }}
          >
            {getDeviceIcon(selfPeer.deviceType)}
          </div>
          <span className="mt-2 text-xs font-bold text-neutral-900 dark:text-neutral-100">
            {selfPeer.name} (Sender)
          </span>
          <span className="text-[11px] font-mono text-neutral-400">
            Your PIN: <strong className="text-cyan-600 dark:text-cyan-400">{selfPeer.pin}</strong>
          </span>
        </div>

        {/* Discovered Receivers Grid */}
        {peers.length === 0 ? (
          <div className="relative z-10 max-w-sm text-center px-5 py-4 rounded-2xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500 dark:text-neutral-400 space-y-2">
            <p className="font-bold text-neutral-800 dark:text-neutral-200">
              Waiting for Receiver to Open App
            </p>
            <p className="leading-relaxed">
              Open AetherDrop on the receiving device and tap <strong className="text-emerald-600 dark:text-emerald-400">RECEIVE</strong>, or scan its QR code.
            </p>
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={onOpenScanner}
                className="px-3.5 py-1.5 rounded-xl border border-cyan-300 dark:border-cyan-800 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-cyan-700 dark:text-cyan-300 font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Scan Receiver QR</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="relative z-10 w-full max-w-xl">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <span>Discovered {peers.length} nearby {peers.length === 1 ? 'receiver' : 'receivers'}</span>
                <span aria-hidden="true">·</span>
                <span className="text-cyan-600 dark:text-cyan-400">Tap to transmit:</span>
              </p>

              {peers.length > 1 && (
                <button
                  type="button"
                  onClick={handleBroadcastToAll}
                  className="px-3 py-1 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Send to All ({peers.length})</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {peers.map((peer) => (
                <button
                  key={peer.id}
                  onClick={() => {
                    triggerHaptic('tap');
                    onSelectReceiver(peer);
                  }}
                  className="group p-4 rounded-2xl border-2 border-cyan-500/30 hover:border-cyan-500 bg-cyan-50/20 dark:bg-cyan-950/20 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/40 transition-all text-left flex items-center justify-between gap-3 shadow-xs cursor-pointer active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm"
                      style={{ backgroundColor: peer.avatarColor }}
                    >
                      {getDeviceIcon(peer.deviceType)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                          {peer.name}
                        </h4>
                        {peer.latency && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                            {peer.latency}ms
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">
                        PIN: <span className="font-bold text-cyan-600 dark:text-cyan-400">{peer.pin}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{peer.deviceType}</span>
                      </p>
                    </div>
                  </div>

                  <div className="px-3.5 py-1.5 rounded-xl bg-cyan-600 group-hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1 shrink-0 shadow-xs">
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
