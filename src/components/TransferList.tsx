import React, { useState, useMemo } from 'react';
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
  Search,
  Trash2,
  HardDrive,
  Eye,
  Info,
  FileDown,
  RotateCcw,
} from 'lucide-react';
import { TransferTask } from '../types/transfer';
import { formatBytes, formatSpeed, formatETA, getFileCategory } from '../utils/formatters';
import { FilePreviewModal, PreviewableFile } from './FilePreviewModal';
import { TransferInspectorModal } from './TransferInspectorModal';
import { triggerHaptic } from '../utils/systemWorkflows';

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
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'paused' | 'sent' | 'received'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [previewItem, setPreviewItem] = useState<PreviewableFile | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [inspectTask, setInspectTask] = useState<TransferTask | null>(null);
  const [isInspectOpen, setIsInspectOpen] = useState(false);

  const activeCount = useMemo(
    () =>
      transfers.filter(
        (t) => t.status === 'transferring' || t.status === 'encrypting' || t.status === 'connecting'
      ).length,
    [transfers]
  );

  const completedCount = useMemo(
    () => transfers.filter((t) => t.status === 'completed').length,
    [transfers]
  );

  const sentCount = useMemo(() => transfers.filter((t) => t.direction === 'send').length, [transfers]);
  const receivedCount = useMemo(() => transfers.filter((t) => t.direction === 'receive').length, [transfers]);

  const totalTransferredBytes = useMemo(
    () => transfers.reduce((sum, t) => sum + t.bytesTransferred, 0),
    [transfers]
  );

  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      // Status & Direction filters
      if (statusFilter === 'active' && !(t.status === 'transferring' || t.status === 'encrypting' || t.status === 'connecting')) return false;
      if (statusFilter === 'completed' && t.status !== 'completed') return false;
      if (statusFilter === 'paused' && !(t.status === 'paused' || t.status === 'cancelled' || t.status === 'error')) return false;
      if (statusFilter === 'sent' && t.direction !== 'send') return false;
      if (statusFilter === 'received' && t.direction !== 'receive') return false;

      // Category filter
      if (categoryFilter !== 'all') {
        const cat = getFileCategory(t.mimeType, t.fileName);
        if (cat !== categoryFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (!t.fileName.toLowerCase().includes(q) && !t.peerName.toLowerCase().includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [transfers, statusFilter, categoryFilter, searchQuery]);

  const handleDownloadAllCompleted = () => {
    triggerHaptic('tap');
    const downloadable = transfers.filter((t) => t.status === 'completed' && t.downloadUrl && t.direction === 'receive');
    downloadable.forEach((task, idx) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = task.downloadUrl!;
        a.download = task.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, idx * 250);
    });
  };

  const handleExportLog = () => {
    triggerHaptic('tap');
    const logData = transfers.map((t) => ({
      id: t.id,
      fileName: t.fileName,
      fileSize: t.fileSize,
      fileSizeFormatted: formatBytes(t.fileSize),
      mimeType: t.mimeType,
      direction: t.direction,
      peerName: t.peerName,
      status: t.status,
      speedPeak: t.peakSpeed ? formatSpeed(t.peakSpeed) : undefined,
      speedAverage: t.averageSpeed ? formatSpeed(t.averageSpeed) : undefined,
      transportType: t.transportType,
      encryptionMode: t.encryptionMode,
      fingerprint: t.fingerprint,
      startedAt: new Date(t.startedAt).toISOString(),
      completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : undefined,
    }));

    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AetherDrop_TransferLog_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const openPreview = (task: TransferTask) => {
    setPreviewItem({
      name: task.fileName,
      size: task.fileSize,
      type: task.mimeType,
      url: task.downloadUrl,
      file: task.rawFile,
    });
    setIsPreviewOpen(true);
  };

  const openInspector = (task: TransferTask) => {
    setInspectTask(task);
    setIsInspectOpen(true);
  };

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
      case 'connecting':
        return (
          <span className="text-[11px] font-medium text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
            <span>Connecting...</span>
          </span>
        );
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
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 shadow-xs transition-colors space-y-4">
      {/* Summary Metrics Banner */}
      <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/80 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Transfer History & Performance
            </h3>
            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 flex-wrap">
              <span>{transfers.length} total tasks</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">{formatBytes(totalTransferredBytes)} moved</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{completedCount} finished</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {transfers.length > 0 && (
            <button
              onClick={handleExportLog}
              className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Export complete transfer history as JSON log"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Export Log</span>
            </button>
          )}

          {transfers.some((t) => t.status === 'completed' && t.downloadUrl && t.direction === 'receive') && (
            <button
              onClick={handleDownloadAllCompleted}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save All Received</span>
            </button>
          )}

          {completedCount > 0 && (
            <button
              onClick={onClearCompleted}
              className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-600 dark:text-neutral-400 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Completed</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status segmented buttons */}
        <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs font-bold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            All ({transfers.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs font-bold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              statusFilter === 'completed'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs font-bold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Completed ({completedCount})
          </button>
          <button
            onClick={() => setStatusFilter('sent')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              statusFilter === 'sent'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs font-bold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Sent ({sentCount})
          </button>
          <button
            onClick={() => setStatusFilter('received')}
            className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              statusFilter === 'received'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-2xs font-bold'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Received ({receivedCount})
          </button>
        </div>

        {/* Search input */}
        <div className="relative max-w-xs w-full">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search filename or peer..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
          />
        </div>
      </div>

      {/* Transfer Items List */}
      <div className="flex flex-col gap-3">
        {filteredTransfers.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center text-neutral-400 dark:text-neutral-500">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-3">
              <Zap className="w-5 h-5 text-neutral-400" />
            </div>
            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              No transfers match your criteria
            </p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 max-w-xs">
              Select or drop files on the Home screen to begin a fast, encrypted transfer.
            </p>
          </div>
        ) : (
          filteredTransfers.map((task) => (
            <div
              key={task.id}
              className="group border border-neutral-200 dark:border-neutral-800/90 rounded-2xl p-4 bg-neutral-50/40 dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-200"
            >
              {/* Row 1: File Info & Controls */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
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
                        <button
                          type="button"
                          onClick={() => openInspector(task)}
                          title={`Encrypted with AES-256-GCM. Fingerprint: ${task.fingerprint || 'Verified'}`}
                          className="shrink-0 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 cursor-pointer"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 flex-wrap">
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

                  {/* Diagnostic Inspector Button */}
                  <button
                    type="button"
                    onClick={() => openInspector(task)}
                    className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-cyan-600 transition-colors cursor-pointer"
                    title="Inspect transfer diagnostics"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>

                  {/* In-app preview button */}
                  {(task.downloadUrl || task.rawFile) && (
                    <button
                      type="button"
                      onClick={() => openPreview(task)}
                      className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-neutral-500 hover:text-cyan-600 transition-colors cursor-pointer"
                      title="Preview file"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Pause / Resume button */}
                  {(task.status === 'transferring' || task.status === 'paused') && (
                    <button
                      onClick={() =>
                        task.status === 'paused' ? onResume(task.id) : onPause(task.id)
                      }
                      title={task.status === 'paused' ? 'Resume transfer' : 'Pause transfer'}
                      className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
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
                      className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
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
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow-2xs transition-colors"
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
              <div className="mt-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 font-mono tabular-nums flex-wrap gap-2">
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

      {/* In-App File Preview Modal */}
      <FilePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        item={previewItem}
        onDownload={
          previewItem?.url
            ? () => {
                const a = document.createElement('a');
                a.href = previewItem.url!;
                a.download = previewItem.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }
            : undefined
        }
      />

      {/* Transfer Inspector Modal */}
      <TransferInspectorModal
        isOpen={isInspectOpen}
        onClose={() => setIsInspectOpen(false)}
        task={inspectTask}
        onDownload={
          inspectTask?.downloadUrl
            ? () => {
                const a = document.createElement('a');
                a.href = inspectTask.downloadUrl!;
                a.download = inspectTask.fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }
            : undefined
        }
      />
    </div>
  );
};
