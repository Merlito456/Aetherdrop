import React from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownLeft,
  Pause,
  Play,
  X,
  CheckCircle2,
  AlertCircle,
  Download,
  Lock,
  Plus,
  Clock,
  Zap,
  File as FileIcon,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  FileArchive,
  Code,
  RotateCcw,
} from 'lucide-react';
import { TransferTask, Peer } from '../types/transfer';
import { formatBytes, formatSpeed, formatETA, getFileCategory } from '../utils/formatters';

interface ShareItSessionViewProps {
  selfPeer: Peer;
  transfers: TransferTask[];
  encryptionMode?: 'turbo-dtls' | 'dual-crypto';
  onToggleEncryptionMode?: (mode: 'turbo-dtls' | 'dual-crypto') => void;
  isTetherMode?: boolean;
  onToggleTetherMode?: (enabled: boolean) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry?: (id: string) => void;
  onSendMore: () => void;
  onExitSession: () => void;
  onTestTetherTransfer?: () => void;
}

export const ShareItSessionView: React.FC<ShareItSessionViewProps> = ({
  selfPeer,
  transfers,
  encryptionMode = 'turbo-dtls',
  onToggleEncryptionMode,
  isTetherMode = false,
  onToggleTetherMode,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onSendMore,
  onExitSession,
  onTestTetherTransfer,
}) => {
  const activeTransfers = transfers.filter(
    (t) => t.status === 'transferring' || t.status === 'encrypting' || t.status === 'paused'
  );
  const completedTransfers = transfers.filter((t) => t.status === 'completed');

  // Overall batch statistics
  const totalBytes = transfers.reduce((sum, t) => sum + t.fileSize, 0);
  const transferredBytes = transfers.reduce((sum, t) => sum + t.bytesTransferred, 0);
  const overallProgress = totalBytes > 0 ? Math.round((transferredBytes / totalBytes) * 100) : 0;
  const currentSpeed = activeTransfers.reduce((sum, t) => sum + t.speed, 0);
  const maxEta = activeTransfers.reduce((max, t) => Math.max(max, t.eta), 0);
  const maxPeakSpeed = transfers.reduce((max, t) => Math.max(max, t.peakSpeed || 0), 0);
  const activeChannelCount = transfers.find((t) => t.status === 'transferring')?.channelCount || (isTetherMode ? 4 : 1);

  // Identify remote peer
  const remotePeerName = transfers[0]?.peerName || 'Connected Device';

  const getFileCategoryIcon = (mimeType: string, name: string) => {
    const category = getFileCategory(mimeType, name);
    switch (category) {
      case 'image':
        return <ImageIcon className="w-5 h-5 text-emerald-500" />;
      case 'video':
        return <Video className="w-5 h-5 text-purple-500" />;
      case 'audio':
        return <Music className="w-5 h-5 text-amber-500" />;
      case 'document':
        return <FileText className="w-5 h-5 text-blue-500" />;
      case 'archive':
        return <FileArchive className="w-5 h-5 text-rose-500" />;
      case 'code':
        return <Code className="w-5 h-5 text-cyan-500" />;
      default:
        return <FileIcon className="w-5 h-5 text-neutral-400" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={onExitSession}
          className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Home</span>
        </button>

        <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
          Transfer Session
        </h2>

        <button
          onClick={onSendMore}
          className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Send More</span>
        </button>
      </div>

      {/* SHAREit Bilateral Device Connection Strip */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-xs">
        <div className="flex items-center justify-between gap-4">
          {/* Sender / Left Device */}
          <div className="flex flex-col items-center text-center">
            <div
              className="w-13 h-13 rounded-2xl flex items-center justify-center text-white shadow-md text-sm font-bold"
              style={{ backgroundColor: selfPeer.avatarColor }}
            >
              {selfPeer.name.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mt-1.5 max-w-[90px] truncate">
              {selfPeer.name} (You)
            </span>
          </div>

          {/* Animated Flow Pulse Line & Speedometer */}
          <div className="flex-1 flex flex-col items-center px-4">
            <div className="flex items-center gap-2 mb-1.5 text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 flex-wrap justify-center">
              <Zap className="w-3.5 h-3.5 animate-pulse text-cyan-500" />
              <span>{currentSpeed > 0 ? formatSpeed(currentSpeed) : 'Direct P2P Link (Ready)'}</span>
              {maxPeakSpeed > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 font-semibold">
                  Peak: {formatSpeed(maxPeakSpeed)}
                </span>
              )}
            </div>

            <div className="w-full relative flex items-center">
              <div className="w-full h-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden shadow-inner">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    currentSpeed > 30 * 1024 * 1024
                      ? 'bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 animate-pulse'
                      : 'bg-gradient-to-r from-cyan-500 via-emerald-400 to-teal-400'
                  }`}
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-2 text-[11px] font-mono text-neutral-500">
              <span>{formatBytes(transferredBytes)} / {formatBytes(totalBytes)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-bold text-neutral-800 dark:text-neutral-200">{overallProgress}%</span>
              {maxEta > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-semibold">
                    <Clock className="w-3 h-3" />
                    <span>{formatETA(maxEta)}</span>
                  </span>
                </>
              )}
              {activeChannelCount > 1 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {activeChannelCount}x Striped SCTP
                  </span>
                </>
              )}
            </div>

            {/* Turbo Hardware Acceleration Mode Badge */}
            <div className="mt-3 flex items-center gap-2 flex-wrap justify-center">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <Lock className="w-3 h-3 text-emerald-500" />
                <span>
                  {encryptionMode === 'turbo-dtls'
                    ? '⚡ Hardware DTLS AES-256-GCM (5 Gbps Uncapped Wire Speed)'
                    : '🔒 Dual-Layer Mode: DTLS + WebCrypto AES-GCM'}
                </span>
              </span>

              {onToggleEncryptionMode && (
                <button
                  type="button"
                  onClick={() => onToggleEncryptionMode(encryptionMode === 'turbo-dtls' ? 'dual-crypto' : 'turbo-dtls')}
                  className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline font-semibold"
                >
                  Switch
                </button>
              )}
            </div>

            {/* User-Requested Wi-Fi Tethering / Direct Hotspot Connection Mode Checkbox */}
            <div className="mt-3.5 w-full max-w-lg">
              <label
                className={`flex items-start sm:items-center justify-between gap-3 p-3 rounded-2xl border transition-all cursor-pointer select-none text-left ${
                  isTetherMode
                    ? 'border-cyan-500 bg-cyan-500/10 dark:bg-cyan-950/50 text-cyan-950 dark:text-cyan-100 shadow-xs'
                    : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-850/60 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={isTetherMode}
                    onChange={(e) => onToggleTetherMode?.(e.target.checked)}
                    className="mt-0.5 sm:mt-0 w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 accent-cyan-500 cursor-pointer shrink-0"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 flex-wrap">
                      <span>⚡ Wi-Fi Tethering Link (Connected via Sender Hotspot)</span>
                      <span
                        className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
                          isTetherMode
                            ? 'bg-emerald-600 text-white animate-pulse'
                            : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                        }`}
                      >
                        {isTetherMode ? 'Unlimited 4x Striped Boost Active' : 'Off'}
                      </span>
                    </span>
                    <span className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug mt-0.5">
                      Direct local host connection with 4 parallel SCTP channels and 16 MB in-memory prefetch for maximum uncapped line rate (50–120+ MB/s).
                    </span>
                  </div>
                </div>
                <div className="hidden sm:block text-right shrink-0">
                  <span
                    className={`text-[11px] font-mono font-bold ${
                      isTetherMode ? 'text-cyan-600 dark:text-cyan-400' : 'text-neutral-400'
                    }`}
                  >
                    {isTetherMode ? '4x Striped Streams' : 'Standard LAN'}
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Receiver / Right Device */}
          <div className="flex flex-col items-center text-center">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md text-sm font-bold">
              {remotePeerName.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mt-1.5 max-w-[90px] truncate">
              {remotePeerName}
            </span>
          </div>
        </div>
      </div>

      {/* Files in Transmission */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-neutral-100 dark:border-neutral-800">
          <span className="font-bold text-neutral-900 dark:text-neutral-100">
            Files ({transfers.length})
          </span>
          <span className="text-neutral-500">
            {completedTransfers.length} of {transfers.length} finished
          </span>
        </div>

        {transfers.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <p className="text-xs text-neutral-500">No active files in this transfer session.</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={onSendMore}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                Select Files to Send
              </button>
              {onTestTetherTransfer && (
                <button
                  onClick={onTestTetherTransfer}
                  className="px-4 py-2 rounded-xl border border-cyan-500 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>⚡ Test Tether Transfer</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
            {transfers.map((task) => (
              <div key={task.id} className="py-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      task.direction === 'send'
                        ? 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400'
                        : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {task.direction === 'send' ? (
                      <ArrowUpRight className="w-5 h-5" />
                    ) : (
                      <ArrowDownLeft className="w-5 h-5" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {getFileCategoryIcon(task.mimeType, task.fileName)}
                      <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate max-w-xs sm:max-w-md">
                        {task.fileName}
                      </h4>
                      {task.isEncrypted && (
                        <span
                          title={task.encryptionMode === 'turbo-dtls' ? 'Hardware-Accelerated WebRTC DTLS AES-256-GCM (Zero JS CPU contention)' : 'Dual-Layer AES-256-GCM'}
                          className="flex items-center gap-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800"
                        >
                          <Lock className="w-3 h-3" />
                          <span>{task.encryptionMode === 'turbo-dtls' ? 'Turbo DTLS' : 'Dual-Crypto'}</span>
                        </span>
                      )}
                      {(task.isTetherMode || isTetherMode) && (
                        <span
                          title="1-Hop Direct Wi-Fi Tether Hotspot Active (Local Host ICE Routing)"
                          className="flex items-center gap-1 text-[10px] font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-200 dark:border-cyan-800"
                        >
                          <Zap className="w-3 h-3 text-cyan-500" />
                          <span>Tether 1-Hop</span>
                        </span>
                      )}
                      {task.transportType && (
                        <span
                          title={`Transport: ${task.transportType}`}
                          className={`flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                            task.transportType === 'webrtc-striped'
                              ? 'text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 border-cyan-300 dark:border-cyan-800'
                              : task.transportType === 'relay-stream'
                              ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800'
                              : 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800'
                          }`}
                        >
                          <span>
                            {task.transportType === 'webrtc-striped'
                              ? '4x SCTP'
                              : task.transportType === 'relay-stream'
                              ? 'Instant Relay'
                              : task.transportType === 'broadcast-channel'
                              ? 'Tab Direct'
                              : 'WebRTC Direct'}
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5 flex-wrap">
                      <span>{task.direction === 'send' ? 'Sending' : 'Receiving'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{formatBytes(task.fileSize)}</span>
                      {task.status === 'connecting' && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-cyan-600 dark:text-cyan-400 font-semibold animate-pulse flex items-center gap-1">
                            <span>Connecting direct line...</span>
                          </span>
                        </>
                      )}
                      {task.status === 'transferring' && task.speed > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                            {formatSpeed(task.speed)}
                          </span>
                        </>
                      )}
                      {task.peakSpeed && task.peakSpeed > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-neutral-400">
                            Peak: {formatSpeed(task.peakSpeed)}
                          </span>
                        </>
                      )}
                      {task.channelCount && task.channelCount > 1 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                            {task.channelCount}x SCTP
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {task.status === 'completed' ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Finished</span>
                      </span>
                      {task.downloadUrl && (
                        <a
                          href={task.downloadUrl}
                          download={task.fileName}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </a>
                      )}
                    </div>
                  ) : task.status === 'cancelled' ? (
                    <span className="text-xs text-neutral-400 font-medium">Cancelled</span>
                  ) : task.status === 'error' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-rose-500 font-medium flex items-center gap-1 max-w-[180px] sm:max-w-xs truncate" title={task.errorReason || 'Failed'}>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{task.errorReason || 'Failed'}</span>
                      </span>
                      {onRetry && task.direction === 'send' && task.rawFile && (
                        <button
                          onClick={() => onRetry(task.id)}
                          className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-2xs shrink-0"
                          title="Retry file transfer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() =>
                          task.status === 'paused' ? onResume(task.id) : onPause(task.id)
                        }
                        className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                        title={task.status === 'paused' ? 'Resume' : 'Pause'}
                      >
                        {task.status === 'paused' ? (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        )}
                      </button>

                      <button
                        onClick={() => onCancel(task.id)}
                        className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-rose-50 text-neutral-400 hover:text-rose-600"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Individual Progress Bar */}
              <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    task.status === 'completed'
                      ? 'bg-emerald-500'
                      : task.status === 'paused'
                      ? 'bg-amber-400'
                      : task.status === 'cancelled' || task.status === 'error'
                      ? 'bg-rose-500'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                  }`}
                  style={{ width: `${task.progress}%` }}
                />
              </div>

              {/* Bytes & ETA row */}
              <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 tabular-nums">
                <span>
                  {formatBytes(task.bytesTransferred)} / {formatBytes(task.fileSize)} ({task.progress}%)
                </span>
                {task.status === 'transferring' && task.eta > 0 && (
                  <span>{formatETA(task.eta)}</span>
                )}
              </div>
            </div>
          ))}
          </div>
        )}
      </div>
    </div>
  );
};
