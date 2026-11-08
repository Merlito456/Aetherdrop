import React, { useState } from 'react';
import {
  Laptop,
  Smartphone,
  Tablet,
  Radio,
  Sparkles,
  QrCode,
  ShieldCheck,
  Send,
  RefreshCw,
  KeyRound,
  Camera,
  ArrowRight,
} from 'lucide-react';
import { Peer } from '../types/transfer';

interface NearbyRadarProps {
  selfPeer: Peer;
  peers: Peer[];
  selectedPeerId: string | null;
  onSelectPeer: (id: string) => void;
  onOpenQR: () => void;
  onOpenScanner: () => void;
  onRefresh: () => void;
  simulatedPeerEnabled: boolean;
  onToggleSimulatedPeer: (enable: boolean) => void;
  onDirectSendFiles: (peer: Peer) => void;
  onConnectByPin: (pin: string) => void;
  signalingStatus: 'connected' | 'connecting' | 'offline';
  signalingMessage?: string;
}

export const NearbyRadar: React.FC<NearbyRadarProps> = ({
  selfPeer,
  peers,
  selectedPeerId,
  onSelectPeer,
  onOpenQR,
  onOpenScanner,
  onRefresh,
  simulatedPeerEnabled,
  onToggleSimulatedPeer,
  onDirectSendFiles,
  onConnectByPin,
  signalingStatus,
  signalingMessage,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinNotice, setPinNotice] = useState<string | null>(null);

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pinInput.trim();
    if (!clean) return;
    if (clean === selfPeer.pin) {
      setPinNotice("That is this device's own PIN. Enter the PIN shown on the other device.");
      return;
    }
    onConnectByPin(clean);
    setPinNotice(`Connecting to device with PIN ${clean}...`);
    setPinInput('');
    setTimeout(() => setPinNotice(null), 4000);
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
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 shadow-xs transition-colors">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Nearby Devices Radar
            </h2>
            <span
              className={`flex items-center gap-1.5 text-[11px] font-medium ${
                signalingStatus === 'connected'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : signalingStatus === 'connecting'
                  ? 'text-amber-600 dark:text-amber-400 animate-pulse'
                  : 'text-neutral-500'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{signalingMessage || 'Mesh Discovery Active'}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            <span>Devices on this network appear automatically</span>
            <span aria-hidden="true">·</span>
            <span>Direct WebRTC Local Transfer</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Refresh button */}
          <button
            onClick={handleRefreshClick}
            className={`p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            title="Scan for local peers"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Camera Scanner */}
          <button
            onClick={onOpenScanner}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1.5 font-medium"
            title="Scan peer QR code using camera"
          >
            <Camera className="w-3.5 h-3.5 text-cyan-500" />
            <span>Scan Camera QR</span>
          </button>

          {/* Show My QR */}
          <button
            onClick={onOpenQR}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1.5 font-medium"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Show QR</span>
          </button>

          {/* Simulated Peer toggle */}
          <button
            onClick={() => onToggleSimulatedPeer(!simulatedPeerEnabled)}
            className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              simulatedPeerEnabled
                ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800'
                : 'border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
            <span>{simulatedPeerEnabled ? 'Test Peer Active' : 'Add Test Peer'}</span>
          </button>
        </div>
      </div>

      {/* Direct PIN Quick Pairing Bar */}
      <div className="my-3 p-3 bg-neutral-50 dark:bg-neutral-850/80 rounded-xl border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-cyan-500" />
          <span className="text-neutral-600 dark:text-neutral-400">This Device's PIN:</span>
          <span className="font-mono font-bold text-neutral-900 dark:text-white bg-white dark:bg-neutral-800 px-2 py-0.5 rounded-md border border-neutral-200 dark:border-neutral-700 text-sm tracking-wider">
            {selfPeer.pin}
          </span>
        </div>

        <form onSubmit={handlePinSubmit} className="flex items-center gap-2">
          <input
            type="text"
            maxLength={6}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="Enter Peer's 4-digit PIN"
            className="w-44 px-2.5 py-1 text-xs font-mono bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
          />
          <button
            type="submit"
            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold transition-colors flex items-center gap-1 shadow-2xs"
          >
            <span>Connect</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {pinNotice && (
        <div className="mb-3 px-3 py-2 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 rounded-lg text-xs text-cyan-700 dark:text-cyan-300">
          {pinNotice}
        </div>
      )}

      {/* Radar Center Stage */}
      <div className="relative py-10 sm:py-12 flex flex-col items-center justify-center overflow-hidden">
        {/* Radar Rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 dark:opacity-20">
          <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-full border border-cyan-400 dark:border-cyan-600" />
          <div className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full border border-neutral-300 dark:border-neutral-700" />
          <div className="absolute w-96 h-96 sm:w-[460px] sm:h-[460px] rounded-full border border-neutral-200 dark:border-neutral-800" />
        </div>

        {/* Self Peer Center Avatar */}
        <div className="relative z-10 flex flex-col items-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 ring-4 ring-white dark:ring-neutral-900"
            style={{ backgroundColor: selfPeer.avatarColor }}
          >
            {getDeviceIcon(selfPeer.deviceType)}
          </div>
          <span className="mt-2 text-xs font-semibold text-neutral-900 dark:text-neutral-100">
            {selfPeer.name} (You)
          </span>
          <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 font-medium">
            PIN: {selfPeer.pin} · {selfPeer.browser}
          </span>
        </div>

        {/* Discovered Peers Grid */}
        {peers.length === 0 ? (
          <div className="relative z-10 max-w-sm text-center px-4 py-4 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500 dark:text-neutral-400">
            <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
              Scanning for devices...
            </p>
            <p className="leading-relaxed">
              Open this app on your phone or another laptop, or enter the other device's{' '}
              <strong className="text-neutral-700 dark:text-neutral-300">4-digit PIN</strong> above, or click{' '}
              <button
                type="button"
                onClick={() => onToggleSimulatedPeer(true)}
                className="text-cyan-600 dark:text-cyan-400 underline font-semibold"
              >
                Add Test Peer
              </button>{' '}
              to test immediately.
            </p>
          </div>
        ) : (
          <div className="relative z-10 w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {peers.map((peer) => {
              const isSelected = selectedPeerId === peer.id;
              return (
                <div
                  key={peer.id}
                  onClick={() => onSelectPeer(peer.id)}
                  className={`group relative p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-50/40 dark:bg-cyan-950/30 ring-2 ring-cyan-500/20'
                      : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs"
                      style={{ backgroundColor: peer.avatarColor }}
                    >
                      {getDeviceIcon(peer.deviceType)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                          {peer.name}
                        </h4>
                        {peer.connectionType === 'simulated' ? (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-mono">
                            TEST
                          </span>
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                        <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                          PIN: {peer.pin}
                        </span>{' '}
                        · {peer.deviceType}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
                    <span className="text-neutral-500 dark:text-neutral-400 text-[11px] flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-500" />
                      <span>Direct WebRTC</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDirectSendFiles(peer);
                      }}
                      className="px-2 py-1 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 rounded-md font-semibold transition-colors flex items-center gap-1"
                    >
                      <span>Send</span>
                      <Send className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
