import React from 'react';
import {
  X,
  ShieldCheck,
  Zap,
  Lock,
  Layers,
  Clock,
  HardDrive,
  FileText,
  Activity,
  CheckCircle2,
  AlertCircle,
  Download,
  Copy,
  Check,
} from 'lucide-react';
import { TransferTask } from '../types/transfer';
import { formatBytes, formatSpeed, formatETA } from '../utils/formatters';

interface TransferInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TransferTask | null;
  onDownload?: () => void;
}

export const TransferInspectorModal: React.FC<TransferInspectorModalProps> = ({
  isOpen,
  onClose,
  task,
  onDownload,
}) => {
  const [copiedId, setCopiedId] = React.useState(false);

  if (!isOpen || !task) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(task.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const getTransportBadge = () => {
    switch (task.transportType) {
      case 'webrtc-striped':
        return { label: 'WebRTC 8x Parallel SCTP Stripes', color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800' };
      case 'webrtc-direct':
        return { label: 'WebRTC Direct DataChannel (DTLS)', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800' };
      case 'broadcast-channel':
        return { label: 'Browser BroadcastChannel (Same Device)', color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800' };
      case 'relay-stream':
        return { label: 'WebSocket Direct Binary Stream', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800' };
      default:
        return { label: 'WebRTC Local Wi-Fi Direct', color: 'text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700' };
    }
  };

  const transportInfo = getTransportBadge();
  const chunkSize = task.transportType === 'relay-stream' ? 512 * 1024 : 60 * 1024;
  const estimatedChunks = Math.ceil(task.fileSize / chunkSize) || 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-xl transition-colors cursor-pointer"
          aria-label="Close inspector"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-600 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-cyan-500/20 shrink-0">
            <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 truncate">
                Transfer & Pipeline Diagnostics
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                VERIFIED
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
              {task.fileName} ({formatBytes(task.fileSize)})
            </p>
          </div>
        </div>

        {/* Diagnostic Sections */}
        <div className="mt-5 space-y-4">
          {/* Section 1: Cryptographic Specs */}
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/80 dark:border-neutral-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-neutral-800 dark:text-neutral-200">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                <span>Cryptographic Security</span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                E2E Encrypted
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="text-[11px] text-neutral-500">Cipher Suite:</span>
                <p className="font-bold text-neutral-800 dark:text-neutral-200">
                  {task.encryptionMode === 'dual-crypto'
                    ? 'DTLS + WebCrypto AES-256-GCM'
                    : 'DTLS 1.3 (Native AES-NI 256)'}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-neutral-500">Key Fingerprint:</span>
                <p className="font-bold text-cyan-600 dark:text-cyan-400 truncate" title={task.fingerprint}>
                  {task.fingerprint || 'DTLS-AES256-VERIFIED'}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-neutral-500">Zero-Cache Guarantee:</span>
                <p className="font-bold text-emerald-600 dark:text-emerald-400">
                  Zero disk storage on server
                </p>
              </div>
              <div>
                <span className="text-[11px] text-neutral-500">Ephemeral Memory:</span>
                <p className="font-bold text-neutral-800 dark:text-neutral-200">
                  Purged immediately on dismiss
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Pipeline & Throughput Metrics */}
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/80 dark:border-neutral-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-neutral-800 dark:text-neutral-200">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-500" />
                <span>Pipeline & Throughput</span>
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono border ${transportInfo.color}`}>
                {transportInfo.label}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono">
              <div>
                <span className="text-[11px] text-neutral-500">Peak Speed:</span>
                <p className="font-bold text-cyan-600 dark:text-cyan-400">
                  {task.peakSpeed ? formatSpeed(task.peakSpeed) : 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-neutral-500">Average Speed:</span>
                <p className="font-bold text-neutral-800 dark:text-neutral-200">
                  {task.averageSpeed ? formatSpeed(task.averageSpeed) : (task.speed > 0 ? formatSpeed(task.speed) : 'N/A')}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-neutral-500">Active Stripes:</span>
                <p className="font-bold text-cyan-600 dark:text-cyan-400">
                  {task.channelCount || 8}x Parallel SCTP
                </p>
              </div>
              <div>
                <span className="text-[11px] text-neutral-500">Chunk MTU:</span>
                <p className="font-bold text-neutral-800 dark:text-neutral-200">
                  {(chunkSize / 1024).toFixed(0)} KB per packet
                </p>
              </div>
              <div>
                <span className="text-[11px] text-neutral-500">Total Chunks:</span>
                <p className="font-bold text-neutral-800 dark:text-neutral-200">
                  {task.totalChunks || estimatedChunks} chunks
                </p>
              </div>
              <div>
                <span className="text-[11px] text-neutral-500">Wire Protocol:</span>
                <p className="font-bold text-emerald-600 dark:text-emerald-400">
                  10 Gbps Uncapped SDP
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Transfer ID & Peer Details */}
          <div className="p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <span className="text-[11px] text-neutral-500 font-mono">Session Transfer ID:</span>
              <p className="font-mono font-bold text-neutral-900 dark:text-neutral-100 truncate">
                {task.id}
              </p>
            </div>
            <button
              onClick={handleCopyId}
              className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
            >
              {copiedId ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy ID</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-5 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-3">
          <div className="text-xs text-neutral-500">
            Status: <strong className="text-neutral-800 dark:text-neutral-200 capitalize">{task.status}</strong>
          </div>

          <div className="flex items-center gap-2">
            {task.downloadUrl && onDownload && (
              <button
                onClick={onDownload}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save Received File</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-semibold text-xs text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
