import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  File as FileIcon,
  X,
  Lock,
  ArrowRight,
  FolderUp,
  Image as ImageIcon,
  FileText,
  FileArchive,
  Music,
  Video,
  Code,
} from 'lucide-react';
import { Peer } from '../types/transfer';
import { formatBytes, getFileCategory } from '../utils/formatters';

interface DropzoneProps {
  availablePeers: Peer[];
  selectedPeerId: string | null;
  setSelectedPeerId: (id: string | null) => void;
  onSendFiles: (files: File[], targetPeer: Peer) => void;
  onOpenRadar: () => void;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  availablePeers,
  selectedPeerId,
  setSelectedPeerId,
  onSendFiles,
  onOpenRadar,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setStagedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setStagedFiles((prev) => [...prev, ...newFiles]);
    }
    // Reset so same file can be selected again
    e.target.value = '';
  };

  const removeStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearStagedFiles = () => {
    setStagedFiles([]);
  };

  const handleSend = () => {
    if (stagedFiles.length === 0) return;

    let targetPeer: Peer | undefined;
    if (selectedPeerId) {
      targetPeer = availablePeers.find((p) => p.id === selectedPeerId);
    } else if (availablePeers.length > 0) {
      targetPeer = availablePeers[0];
    }

    if (!targetPeer) {
      onOpenRadar();
      return;
    }

    onSendFiles(stagedFiles, targetPeer);
    setStagedFiles([]);
  };

  const totalStagedSize = stagedFiles.reduce((acc, f) => acc + f.size, 0);

  const getFileCategoryIcon = (file: File) => {
    const category = getFileCategory(file.type, file.name);
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

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 shadow-xs transition-colors">
      <div className="flex flex-col gap-4">
        {/* Header row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800/80">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Direct Peer Transfer
            </h2>
            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              <span>Local Wi-Fi Network</span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <Lock className="w-3 h-3" />
                <span>AES-256-GCM Encrypted</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>Zero-Storage Memory Pipeline</span>
            </div>
          </div>

          {/* Target Peer Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
              Send To:
            </label>
            {availablePeers.length === 0 ? (
              <button
                onClick={onOpenRadar}
                className="text-xs px-2.5 py-1 text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 rounded-lg hover:underline"
              >
                Find Devices on Radar →
              </button>
            ) : (
              <select
                value={selectedPeerId || availablePeers[0]?.id || ''}
                onChange={(e) => setSelectedPeerId(e.target.value)}
                className="text-xs font-medium bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-cyan-500 cursor-pointer"
              >
                {availablePeers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.deviceType})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
            isDragOver
              ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/30 scale-[1.005]'
              : 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-900/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            // @ts-ignore
            webkitdirectory="true"
            className="hidden"
            onChange={handleFileInputChange}
          />

          <div className="w-12 h-12 rounded-full bg-cyan-100 dark:bg-cyan-950/70 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-3">
            <UploadCloud className="w-6 h-6 stroke-[1.8]" />
          </div>

          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Drop files here or click to browse
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm">
            Any file type and size. Chunks are encrypted on your device and transmitted directly over WebRTC.
          </p>

          {/* Quick Upload Buttons */}
          <div className="flex items-center gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs px-3 py-1.5 font-medium bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/60 transition-colors shadow-2xs"
            >
              Choose Files
            </button>
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="text-xs px-3 py-1.5 font-medium bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/60 transition-colors shadow-2xs flex items-center gap-1.5"
            >
              <FolderUp className="w-3.5 h-3.5" />
              <span>Upload Folder</span>
            </button>
          </div>
        </div>

        {/* Staged Files Preview */}
        {stagedFiles.length > 0 && (
          <div className="mt-1 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-400 px-1">
              <span>
                {stagedFiles.length} {stagedFiles.length === 1 ? 'file' : 'files'} selected (
                <span className="font-mono tabular-nums">{formatBytes(totalStagedSize)}</span>)
              </span>
              <button
                onClick={clearStagedFiles}
                className="text-neutral-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
              >
                Clear all
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/80 border border-neutral-200 dark:border-neutral-800 rounded-lg">
              {stagedFiles.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="px-3 py-2 flex items-center justify-between gap-3 text-xs bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {getFileCategoryIcon(file)}
                    <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                      {file.name}
                    </span>
                    <span className="text-neutral-400 dark:text-neutral-500 font-mono text-[11px] tabular-nums shrink-0">
                      {formatBytes(file.size)}
                    </span>
                  </div>
                  <button
                    onClick={() => removeStagedFile(idx)}
                    className="p-1 text-neutral-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-md transition-colors"
                    aria-label="Remove file"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Send CTA Action */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSend}
                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm shadow-cyan-600/20 transition-all flex items-center gap-2"
              >
                <span>Transmit {stagedFiles.length} {stagedFiles.length === 1 ? 'File' : 'Files'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
