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
} from 'lucide-react';
import { Peer } from '../types/transfer';

interface NearbyRadarProps {
  selfPeer: Peer;
  peers: Peer[];
  selectedPeerId: string | null;
  onSelectPeer: (id: string) => void;
  onOpenQR: () => void;
  onRefresh: () => void;
  simulatedPeerEnabled: boolean;
  onToggleSimulatedPeer: (enable: boolean) => void;
  onDirectSendFiles: (peer: Peer) => void;
}

export const NearbyRadar: React.FC<NearbyRadarProps> = ({
  selfPeer,
  peers,
  selectedPeerId,
  onSelectPeer,
  onOpenQR,
  onRefresh,
  simulatedPeerEnabled,
  onToggleSimulatedPeer,
  onDirectSendFiles,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 800);
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
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <Radio className="w-3.5 h-3.5" />
              <span>Scanning Wi-Fi</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            <span>Devices on the same network appear automatically</span>
            <span aria-hidden="true">·</span>
            <span>Zero internet required</span>
          </div>
        </div>

        {/* Toolbar actions */}
        <div className="flex items-center gap-2">
          {/* Refresh discovery */}
          <button
            onClick={handleRefreshClick}
            className={`p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors ${
              isRefreshing ? 'animate-spin' : ''
            }`}
            title="Scan for new local peers"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* QR Code quick mobile pairing */}
          <button
            onClick={onOpenQR}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1.5 font-medium"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Pair Phone</span>
          </button>

          {/* Test peer toggle for quick local testing */}
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

      {/* Radar Center Stage */}
      <div className="relative py-10 sm:py-14 flex flex-col items-center justify-center overflow-hidden">
        {/* Subtle Radar Ring Waves */}
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
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
            {selfPeer.browser} · Ready to broadcast
          </span>
        </div>

        {/* Discovered Peers Grid / Satellite */}
        {peers.length === 0 ? (
          <div className="relative z-10 max-w-sm text-center px-4 py-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500 dark:text-neutral-400">
            <p className="font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              No other devices detected on this network yet
            </p>
            <p>
              Open this URL on your phone or another laptop on the same Wi-Fi, or click{' '}
              <button
                onClick={() => onToggleSimulatedPeer(true)}
                className="text-cyan-600 dark:text-cyan-400 underline font-medium"
              >
                Add Test Peer
              </button>{' '}
              to test transfers right now.
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
                        {peer.browser} · {peer.deviceType}
                      </p>
                    </div>
                  </div>

                  {/* Send Direct Action */}
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
