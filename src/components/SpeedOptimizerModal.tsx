import React, { useState } from 'react';
import {
  X,
  Zap,
  Gauge,
  Wifi,
  Radio,
  Cpu,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  Play,
  RotateCcw,
} from 'lucide-react';
import { SpeedProfile, EncryptionMode } from '../types/transfer';

interface SpeedOptimizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  speedProfile: SpeedProfile;
  onChangeSpeedProfile: (profile: SpeedProfile) => void;
  isTetherMode: boolean;
  onToggleTetherMode: (enabled: boolean) => void;
  encryptionMode: EncryptionMode;
  onChangeEncryptionMode: (mode: EncryptionMode) => void;
  onRunSpeedTest: () => void;
  activePeakSpeed?: number;
  activeChannelCount?: number;
}

export const SpeedOptimizerModal: React.FC<SpeedOptimizerModalProps> = ({
  isOpen,
  onClose,
  speedProfile,
  onChangeSpeedProfile,
  isTetherMode,
  onToggleTetherMode,
  encryptionMode,
  onChangeEncryptionMode,
  onRunSpeedTest,
  activePeakSpeed = 0,
  activeChannelCount = 8,
}) => {
  const [testing, setTesting] = useState(false);

  if (!isOpen) return null;

  const handleTriggerTest = () => {
    setTesting(true);
    onRunSpeedTest();
    setTimeout(() => setTesting(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg transition-colors cursor-pointer"
          aria-label="Close speed optimizer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-cyan-500/20">
            <Gauge className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Speed & Pipeline Optimizer
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 font-mono">
                10 Gbps Uncapped
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              High-throughput SCTP multi-channel acceleration & low-latency tuning
            </p>
          </div>
        </div>

        {/* Speed Profile Selector */}
        <div className="mt-5 space-y-3">
          <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-500" />
            <span>SCTP Multi-Channel Concurrency Profile</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Turbo 8x Profile */}
            <button
              type="button"
              onClick={() => onChangeSpeedProfile('turbo-8x')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                speedProfile === 'turbo-8x'
                  ? 'border-cyan-500 bg-cyan-50/80 dark:bg-cyan-950/50 shadow-xs ring-1 ring-cyan-500/30'
                  : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-850/50 hover:border-neutral-300 dark:hover:border-neutral-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-neutral-900 dark:text-neutral-100 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-cyan-500 fill-current" />
                    <span>Ultra Turbo (8x)</span>
                  </span>
                  {speedProfile === 'turbo-8x' && (
                    <CheckCircle2 className="w-4 h-4 text-cyan-500" />
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-snug">
                  8 parallel SCTP streams with unordered zero-HOL delivery. Saturates full 5GHz/6GHz Wi-Fi (80–180+ MB/s).
                </p>
              </div>
              <div className="mt-2 text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                Recommended for Fast LAN
              </div>
            </button>

            {/* Balanced 4x Profile */}
            <button
              type="button"
              onClick={() => onChangeSpeedProfile('balanced-4x')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                speedProfile === 'balanced-4x'
                  ? 'border-cyan-500 bg-cyan-50/80 dark:bg-cyan-950/50 shadow-xs ring-1 ring-cyan-500/30'
                  : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-850/50 hover:border-neutral-300 dark:hover:border-neutral-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-neutral-900 dark:text-neutral-100 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-blue-500" />
                    <span>Balanced (4x)</span>
                  </span>
                  {speedProfile === 'balanced-4x' && (
                    <CheckCircle2 className="w-4 h-4 text-cyan-500" />
                  )}
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-snug">
                  4 parallel streams with balanced memory footprint. Optimized for 2.4GHz Wi-Fi or older budget routers.
                </p>
              </div>
              <div className="mt-2 text-[10px] font-mono text-neutral-400 font-semibold">
                Conservative Mode
              </div>
            </button>
          </div>
        </div>

        {/* Hotspot Tethering Toggle */}
        <div className="mt-4">
          <label
            className={`flex items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer select-none text-left ${
              isTetherMode
                ? 'border-cyan-500 bg-cyan-50/80 dark:bg-cyan-950/40 text-cyan-950 dark:text-cyan-100 shadow-xs'
                : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-850/50 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <input
                type="checkbox"
                checked={isTetherMode}
                onChange={(e) => onToggleTetherMode(e.target.checked)}
                className="mt-0.5 sm:mt-0 w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 accent-cyan-500 cursor-pointer shrink-0"
              />
              <div className="min-w-0">
                <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 flex-wrap">
                  <Wifi className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Wi-Fi Tethering & Hotspot 1-Hop Boost</span>
                  <span
                    className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
                      isTetherMode
                        ? 'bg-emerald-600 text-white animate-pulse'
                        : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    {isTetherMode ? 'Active' : 'Off'}
                  </span>
                </span>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug mt-0.5">
                  Connect receiver directly to phone personal hotspot. Bypasses router hops and enables 64 MB memory prefetching.
                </p>
              </div>
            </div>
          </label>
        </div>

        {/* Hardware DTLS vs Dual-Layer Crypto */}
        <div className="mt-4">
          <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 mb-2">
            <Cpu className="w-3.5 h-3.5 text-emerald-500" />
            <span>Encryption Acceleration Engine</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onChangeEncryptionMode('turbo-dtls')}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                encryptionMode === 'turbo-dtls'
                  ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100'
                  : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/40 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1">
                  <span>⚡ Turbo DTLS (Native AES-NI)</span>
                </span>
                {encryptionMode === 'turbo-dtls' && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                )}
              </div>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 leading-snug">
                WebRTC native C++ hardware acceleration. Zero JS thread overhead, maximum speed (150+ MB/s).
              </p>
            </button>

            <button
              type="button"
              onClick={() => onChangeEncryptionMode('dual-crypto')}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                encryptionMode === 'dual-crypto'
                  ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100'
                  : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-850/40 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1">
                  <span>🔒 Dual WebCrypto</span>
                </span>
                {encryptionMode === 'dual-crypto' && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                )}
              </div>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 leading-snug">
                WebCrypto AES-256-GCM layered over DTLS. Maximum cryptographic redundancy.
              </p>
            </button>
          </div>
        </div>

        {/* Live Engine Pipeline Diagnostics */}
        <div className="mt-5 p-4 rounded-2xl bg-neutral-900 text-neutral-100 dark:bg-neutral-950 dark:border dark:border-neutral-800 space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800 text-xs">
            <span className="font-bold flex items-center gap-1.5 text-neutral-200">
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>Real-Time Engine Pipeline</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">
              OPTIMIZED
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div>
              <span className="text-neutral-400">SCTP Channels:</span>
              <p className="font-bold text-cyan-300">{speedProfile === 'turbo-8x' ? '8x Striped Streams' : '4x Striped Streams'}</p>
            </div>
            <div>
              <span className="text-neutral-400">Head-of-Line (HoL):</span>
              <p className="font-bold text-emerald-300">Unordered (Zero-Wait)</p>
            </div>
            <div>
              <span className="text-neutral-400">Chunk MTU Size:</span>
              <p className="font-bold text-neutral-200">60 KB (Clean MTU)</p>
            </div>
            <div>
              <span className="text-neutral-400">Prefetch Cache:</span>
              <p className="font-bold text-neutral-200">{isTetherMode ? '64 MB RAM' : '32 MB RAM'}</p>
            </div>
            <div>
              <span className="text-neutral-400">Backpressure:</span>
              <p className="font-bold text-neutral-200">{isTetherMode ? '16 MB Window' : '8 MB Window'}</p>
            </div>
            <div>
              <span className="text-neutral-400">Relay Transport:</span>
              <p className="font-bold text-cyan-300">WebSocket Direct Push</p>
            </div>
          </div>
        </div>

        {/* Speed Test Action */}
        <div className="mt-5 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-3">
          <div className="text-xs text-neutral-500">
            {activePeakSpeed > 0 ? (
              <span>Peak Recorded: <strong className="text-cyan-600 dark:text-cyan-400 font-mono">{(activePeakSpeed / (1024 * 1024)).toFixed(1)} MB/s</strong></span>
            ) : (
              <span>Test pipeline throughput locally</span>
            )}
          </div>

          <button
            type="button"
            onClick={handleTriggerTest}
            disabled={testing}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
          >
            {testing ? (
              <>
                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                <span>Running Test...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>⚡ Run Speed Test</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
