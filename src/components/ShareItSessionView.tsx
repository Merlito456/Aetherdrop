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
} from 'lucide-react';
import { TransferTask, Peer } from '../types/transfer';
import { formatBytes, formatSpeed, formatETA, getFileCategory } from '../utils/formatters';

interface ShareItSessionViewProps {
  selfPeer: Peer;
  transfers: TransferTask[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onSendMore: () => void;
  onExitSession: () => void;
}

export const ShareItSessionView: React.FC<ShareItSessionViewProps> = ({
  selfPeer,
  transfers,
  onPause,
  onResume,
  onCancel,
  onSendMore,
  onExitSession,
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

          {/* Animated Flow Pulse Line */}
          <div className="flex-1 flex flex-col items-center px-4">
            <div className="flex items-center gap-2 mb-1.5 text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
              <Zap className="w-3.5 h-3.5" />
              <span>{currentSpeed > 0 ? formatSpeed(currentSpeed) : 'Direct P2P Link'}</span>
            </div>

            <div className="w-full relative flex items-center">
              <div className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-1.5 text-[11px] font-mono text-neutral-500">
              <span>{formatBytes(transferredBytes)} / {formatBytes(totalBytes)}</span>
              <span aria-hidden="true">·</span>
              <span>{overallProgress}%</span>
              {maxEta > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
                    <Clock className="w-3 h-3" />
                    <span>{formatETA(maxEta)}</span>
                  </span>
                </>
              )}
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
                        <span title="AES-256-GCM Encrypted" className="text-emerald-500">
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                      <span>{task.direction === 'send' ? 'Sending' : 'Receiving'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{formatBytes(task.fileSize)}</span>
                      {task.status === 'transferring' && task.speed > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                            {formatSpeed(task.speed)}
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
                    <span className="text-xs text-rose-500 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{task.errorReason || 'Failed'}</span>
                    </span>
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
      </div>
    </div>
  );
};
