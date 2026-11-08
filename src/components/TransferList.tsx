import React, { useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Pause,
  Play,
  X,
  CheckCircle2,
  AlertCircle,
  Download,
  Lock,
  File as FileIcon,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  FileArchive,
  Code,
  Clock,
  Zap,
} from 'lucide-react';
import { TransferTask } from '../types/transfer';
import { formatBytes, formatSpeed, formatETA, getFileCategory } from '../utils/formatters';

interface TransferListProps {
  transfers: TransferTask[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onClearCompleted: () => void;
}

export const TransferList: React.FC<TransferListProps> = ({
  transfers,
  onPause,
  onResume,
  onCancel,
  onClearCompleted,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'paused'>('all');

  const filteredTransfers = transfers.filter((t) => {
    if (filter === 'active') return t.status === 'transferring' || t.status === 'encrypting';
    if (filter === 'completed') return t.status === 'completed';
    if (filter === 'paused') return t.status === 'paused' || t.status === 'cancelled';
    return true;
  });

  const activeCount = transfers.filter(
    (t) => t.status === 'transferring' || t.status === 'encrypting'
  ).length;

  const completedCount = transfers.filter((t) => t.status === 'completed').length;

  const getFileCategoryIcon = (mimeType: string, name: string) => {
    const category = getFileCategory(mimeType, name);
    switch (category) {
      case 'image':
        return <ImageIcon className="w-4 h-4 text-emerald-500" />;
      case 'video':
        return <Video className="w-4 h-4 text-purple-500" />;
      case 'audio':
        return <Music className="w-4 h-4 text-amber-500" />;
      case 'document':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'archive':
        return <FileArchive className="w-4 h-4 text-rose-500" />;
      case 'code':
        return <Code className="w-4 h-4 text-cyan-500" />;
      default:
        return <FileIcon className="w-4 h-4 text-neutral-400" />;
    }
  };

  const getStatusBadge = (task: TransferTask) => {
    switch (task.status) {
      case 'encrypting':
        return (
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <Lock className="w-3 h-3 animate-pulse" />
            <span>Encrypting</span>
          </span>
        );
      case 'transferring':
        return (
          <span className="text-[11px] font-medium text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
            <Zap className="w-3 h-3 animate-bounce" />
            <span>Active</span>
          </span>
        );
      case 'paused':
        return (
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
            <Pause className="w-3 h-3" />
            <span>Paused</span>
          </span>
        );
      case 'completed':
        return (
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Completed</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
            Cancelled
          </span>
        );
      case 'error':
        return (
          <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            <span>{task.errorReason || 'Failed'}</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 shadow-xs transition-colors">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800/80">
        <div>
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Transfers Management
          </h2>
          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            <span>{transfers.length} total tasks</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{activeCount} active</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{completedCount} finished</span>
          </div>
        </div>

        {/* Action and Filter strip */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Segmented Filter Controls */}
          <div className="flex items-center p-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-xs font-medium">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                filter === 'all'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              All ({transfers.length})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                filter === 'active'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                filter === 'completed'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Completed ({completedCount})
            </button>
          </div>

          {completedCount > 0 && (
            <button
              onClick={onClearCompleted}
              className="text-xs px-2.5 py-1 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
            >
              Clear Completed
            </button>
          )}
        </div>
      </div>

      {/* Transfer Items List */}
      <div className="mt-4 flex flex-col gap-3">
        {filteredTransfers.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center text-neutral-400 dark:text-neutral-500">
            <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
              <Zap className="w-5 h-5 text-neutral-400" />
            </div>
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              No transfers in this view
            </p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              Select or drop files above to start a secure peer-to-peer transmission.
            </p>
          </div>
        ) : (
          filteredTransfers.map((task) => (
            <div
              key={task.id}
              className="group border border-neutral-200 dark:border-neutral-800/90 rounded-xl p-4 bg-neutral-50/40 dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-200"
            >
              {/* Row 1: File Info & Controls */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
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
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-xs sm:max-w-md">
                        {task.fileName}
                      </h3>
                      {task.isEncrypted && (
                        <span
                          title={`Encrypted with AES-256-GCM. Fingerprint: ${task.fingerprint || 'Verified'}`}
                          className="shrink-0 text-emerald-600 dark:text-emerald-400"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      <span>{task.direction === 'send' ? `To: ${task.peerName}` : `From: ${task.peerName}`}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{formatBytes(task.fileSize)}</span>
                      {task.fingerprint && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[11px] font-mono text-neutral-400 dark:text-neutral-500">
                            {task.fingerprint}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status and Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {getStatusBadge(task)}

                  {/* Pause / Resume button */}
                  {(task.status === 'transferring' || task.status === 'paused') && (
                    <button
                      onClick={() =>
                        task.status === 'paused' ? onResume(task.id) : onPause(task.id)
                      }
                      title={task.status === 'paused' ? 'Resume transfer' : 'Pause transfer'}
                      className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors"
                      aria-label={task.status === 'paused' ? 'Resume transfer' : 'Pause transfer'}
                    >
                      {task.status === 'paused' ? (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Pause className="w-3.5 h-3.5 fill-current" />
                      )}
                    </button>
                  )}

                  {/* Cancel button */}
                  {(task.status === 'transferring' ||
                    task.status === 'paused' ||
                    task.status === 'encrypting') && (
                    <button
                      onClick={() => onCancel(task.id)}
                      title="Cancel transfer"
                      className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                      aria-label="Cancel transfer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Manual download button if completed and downloadUrl exists */}
                  {task.status === 'completed' && task.downloadUrl && (
                    <a
                      href={task.downloadUrl}
                      download={task.fileName}
                      className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow-2xs transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Row 2: Real-time Progress Bar */}
              <div className="mt-3">
                <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ease-out rounded-full ${
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
              </div>

              {/* Row 3: Real-time Metrics (Bytes, Speed, ETA) */}
              <div className="mt-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 font-mono tabular-nums">
                <div className="flex items-center gap-2">
                  <span>
                    {formatBytes(task.bytesTransferred)} of {formatBytes(task.fileSize)}
                  </span>
                  <span>({task.progress}%)</span>
                </div>

                <div className="flex items-center gap-3">
                  {task.status === 'transferring' && task.speed > 0 && (
                    <span className="text-cyan-600 dark:text-cyan-400 font-medium">
                      {formatSpeed(task.speed)}
                    </span>
                  )}
                  {task.status === 'transferring' && task.eta > 0 && (
                    <span className="flex items-center gap-1 text-neutral-400 dark:text-neutral-500">
                      <Clock className="w-3 h-3" />
                      <span>{formatETA(task.eta)}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
