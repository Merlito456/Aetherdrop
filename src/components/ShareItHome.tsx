import React, { useEffect, useState, useCallback } from 'react';
import {
  Send,
  Download,
  Wifi,
  QrCode,
  ShieldCheck,
  Smartphone,
  Laptop,
  Tablet,
  Sparkles,
  ArrowRight,
  History,
  Zap,
  Gauge,
  KeyRound,
  HardDrive,
  Clipboard,
} from 'lucide-react';
import { Peer, RecentPeer, SpeedProfile } from '../types/transfer';
import { getRecentPeers, getStorageEstimate, StorageEstimateResult, extractFilesFromClipboard, triggerHaptic } from '../utils/systemWorkflows';

interface ShareItHomeProps {
  selfPeer: Peer;
  roomId: string;
  peersCount: number;
  activeTransfersCount: number;
  onStartSend: () => void;
  onStartReceive: () => void;
  onOpenQR: () => void;
  onOpenScanner: () => void;
  onOpenRooms: () => void;
  onViewTransfers: () => void;
  simulatedPeerEnabled: boolean;
  onToggleSimulatedPeer: (enable: boolean) => void;
  isTetherMode?: boolean;
  onToggleTetherMode?: (enabled: boolean) => void;
  onTestTetherTransfer?: () => void;
  speedProfile?: SpeedProfile;
  onOpenSpeedOptimizer?: () => void;
  onOpenPinModal?: () => void;
  onPasteFiles?: (files: File[]) => void;
  onConnectRecentPeer?: (recent: RecentPeer) => void;
}

export const ShareItHome: React.FC<ShareItHomeProps> = ({
  selfPeer,
  roomId,
  peersCount,
  activeTransfersCount,
  onStartSend,
  onStartReceive,
  onOpenQR,
  onOpenRooms,
  onViewTransfers,
  simulatedPeerEnabled,
  onToggleSimulatedPeer,
  isTetherMode = false,
  onToggleTetherMode,
  onTestTetherTransfer,
  speedProfile = 'turbo-8x',
  onOpenSpeedOptimizer,
  onOpenPinModal,
  onPasteFiles,
  onConnectRecentPeer,
}) => {
  const [recentPeers, setRecentPeers] = useState<RecentPeer[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageEstimateResult | null>(null);

  useEffect(() => {
    const list = getRecentPeers().filter((p) => p.pin !== selfPeer.pin);
    setRecentPeers(list);
    getStorageEstimate().then((info) => setStorageInfo(info));
  }, [selfPeer.pin]);

  // Global paste handler on Home screen
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const files = extractFilesFromClipboard(e);
    if (files.length > 0) {
      e.preventDefault();
      triggerHaptic('tap');
      if (onPasteFiles) {
        onPasteFiles(files);
      }
    }
  }, [onPasteFiles]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const getDeviceIcon = () => {
    switch (selfPeer.deviceType) {
      case 'mobile':
        return <Smartphone className="w-5 h-5" />;
      case 'tablet':
        return <Tablet className="w-5 h-5" />;
      default:
        return <Laptop className="w-5 h-5" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Device Info & Status Banner */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className="w-13 h-13 rounded-2xl flex items-center justify-center text-white shadow-md shadow-cyan-500/20"
            style={{ backgroundColor: selfPeer.avatarColor }}
          >
            {getDeviceIcon()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                {selfPeer.name}
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-semibold text-cyan-600 dark:text-cyan-400">
                PIN: {selfPeer.pin}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mt-1 flex-wrap">
              <span className="flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5 text-cyan-500" />
                <span>Room:</span>
                <button
                  onClick={onOpenRooms}
                  className="font-mono text-cyan-600 dark:text-cyan-400 hover:underline font-medium cursor-pointer"
                >
                  {roomId}
                </button>
              </span>
              <span aria-hidden="true">·</span>
              <span>{peersCount} {peersCount === 1 ? 'device nearby' : 'devices nearby'}</span>
              {storageInfo && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-[11px] text-neutral-400">
                    {storageInfo.formattedAvailable} free
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Connect by PIN Button */}
          {onOpenPinModal && (
            <button
              onClick={onOpenPinModal}
              className="px-3 py-1.5 rounded-xl border border-cyan-300 dark:border-cyan-800 bg-cyan-50/80 dark:bg-cyan-950/60 hover:bg-cyan-100 text-xs font-semibold text-cyan-700 dark:text-cyan-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Connect with nearby peer's 4-digit PIN"
            >
              <KeyRound className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>Connect PIN</span>
            </button>
          )}

          {/* Show QR Button */}
          <button
            onClick={onOpenQR}
            className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>My QR</span>
          </button>

          {/* Test peer toggle for quick local testing */}
          <button
            onClick={() => onToggleSimulatedPeer(!simulatedPeerEnabled)}
            className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              simulatedPeerEnabled
                ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800'
                : 'border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
            <span>{simulatedPeerEnabled ? 'Test Peer On' : 'Simulate Peer'}</span>
          </button>
        </div>
      </div>

      {/* Recent Devices Strip on Home */}
      {recentPeers.length > 0 && (
        <div className="p-3.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-neutral-900 dark:text-neutral-100">
                Recent Paired Devices
              </span>
              <p className="text-[11px] text-neutral-400">
                Tap any device to reconnect immediately
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            {recentPeers.map((r) => (
              <button
                key={r.pin}
                onClick={() => onConnectRecentPeer?.(r)}
                className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:border-cyan-400 dark:hover:border-cyan-600 bg-neutral-50 dark:bg-neutral-800 text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.avatarColor }} />
                <span>{r.name}</span>
                <span className="font-mono text-[10px] text-cyan-600 dark:text-cyan-400 font-bold">
                  ({r.pin})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Wi-Fi Tethering / Mobile Hotspot Quick-Enable Banner */}
      <div className={`p-4 rounded-2xl border transition-all ${
        isTetherMode
          ? 'bg-cyan-50/80 dark:bg-cyan-950/40 border-cyan-400 dark:border-cyan-700 shadow-xs'
          : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="flex items-start sm:items-center gap-3 cursor-pointer select-none min-w-0">
            <input
              type="checkbox"
              checked={isTetherMode}
              onChange={(e) => onToggleTetherMode?.(e.target.checked)}
              className="mt-0.5 sm:mt-0 w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 accent-cyan-500 cursor-pointer shrink-0"
            />
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-cyan-500" />
                  <span>Wi-Fi Tethering & Hotspot Boost</span>
                </span>
                <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
                  isTetherMode
                    ? 'bg-emerald-600 text-white animate-pulse'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}>
                  {isTetherMode ? '⚡ 8x Striped Boost Active' : `${speedProfile === 'turbo-8x' ? '8x Turbo' : '4x'} LAN Ready`}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-snug">
                Uncapped 10 Gbps SDP with 8 parallel SCTP channels and zero-wait memory streaming (80–180+ MB/s).
              </p>
            </div>
          </label>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
            {onOpenSpeedOptimizer && (
              <button
                type="button"
                onClick={onOpenSpeedOptimizer}
                className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                title="Open Speed & Pipeline Optimizer settings"
              >
                <Gauge className="w-3.5 h-3.5 text-cyan-500" />
                <span>Optimize Speed</span>
              </button>
            )}

            {onTestTetherTransfer && (
              <button
                type="button"
                onClick={onTestTetherTransfer}
                className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                title="Immediately run benchmark tether file transfer"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Test Speed</span>
              </button>
            )}
            <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 hidden md:inline">
              {isTetherMode ? '80–180+ MB/s' : '40–100+ MB/s'}
            </span>
          </div>
        </div>

        {isTetherMode && (
          <div className="mt-3 pt-3 border-t border-cyan-200/60 dark:border-cyan-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-cyan-900 dark:text-cyan-200">
            <span className="flex items-center gap-1 font-medium">
              <span>📱 Hotspot Setup:</span>
              <span className="text-neutral-600 dark:text-neutral-400">1. Turn on Phone Hotspot</span>
              <span aria-hidden="true">→</span>
              <span className="text-neutral-600 dark:text-neutral-400">2. Connect second device to Wi-Fi</span>
              <span aria-hidden="true">→</span>
              <span className="text-neutral-600 dark:text-neutral-400">3. Tap SEND or RECEIVE</span>
            </span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              1-Hop Ready
            </span>
          </div>
        )}
      </div>

      {/* SHAREit Two Big Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {/* SEND BUTTON */}
        <button
          onClick={onStartSend}
          className="group relative overflow-hidden bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white p-7 sm:p-9 rounded-3xl shadow-lg shadow-blue-500/25 transition-all duration-200 text-left flex flex-col justify-between min-h-[220px] active:scale-[0.99] cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-xs group-hover:scale-110 transition-transform">
              <Send className="w-7 h-7 stroke-[2.2] translate-x-0.5" />
            </div>
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
              <ArrowRight className="w-5 h-5 text-white" />
            </div>
          </div>

          <div>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              SEND
            </h3>
            <p className="text-xs sm:text-sm text-cyan-100/90 mt-1 max-w-xs font-medium">
              Select files, photos, videos, or folders and send to a nearby device.
            </p>
          </div>
        </button>

        {/* RECEIVE BUTTON */}
        <button
          onClick={onStartReceive}
          className="group relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 hover:from-emerald-400 hover:via-teal-500 hover:to-cyan-600 text-white p-7 sm:p-9 rounded-3xl shadow-lg shadow-emerald-500/25 transition-all duration-200 text-left flex flex-col justify-between min-h-[220px] active:scale-[0.99] cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-xs group-hover:scale-110 transition-transform">
              <Download className="w-7 h-7 stroke-[2.2]" />
            </div>
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
              <ArrowRight className="w-5 h-5 text-white" />
            </div>
          </div>

          <div>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              RECEIVE
            </h3>
            <p className="text-xs sm:text-sm text-emerald-100/90 mt-1 max-w-xs font-medium">
              Wait for incoming files, show receiver QR beacon, and accept transfers.
            </p>
          </div>
        </button>
      </div>

      {/* Ongoing / Recent Transfers Ribbon */}
      {activeTransfersCount > 0 ? (
        <div
          onClick={onViewTransfers}
          className="p-4 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 flex items-center justify-between cursor-pointer hover:bg-cyan-100/60 dark:hover:bg-cyan-950/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-600 text-white flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                {activeTransfersCount} Active {activeTransfersCount === 1 ? 'Transfer' : 'Transfers'} in Progress
              </p>
              <p className="text-[11px] text-cyan-700 dark:text-cyan-300">
                Tap to view live progress bar, speed, and ETA
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>WebRTC Direct Wire Speed</span>
            <span aria-hidden="true">·</span>
            <span>AES-256-GCM Ephemeral Encryption</span>
            <span aria-hidden="true">·</span>
            <span>Zero Server Caching</span>
          </div>
          <button
            onClick={onViewTransfers}
            className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline cursor-pointer"
          >
            View History →
          </button>
        </div>
      )}
    </div>
  );
};
