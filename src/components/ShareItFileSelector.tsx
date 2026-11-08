import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  UploadCloud,
  File as FileIcon,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  FileArchive,
  Code,
  FolderUp,
  X,
  Trash2,
} from 'lucide-react';
import { formatBytes, getFileCategory } from '../utils/formatters';

interface ShareItFileSelectorProps {
  onBack: () => void;
  onProceedToRadar: (files: File[]) => void;
}

export const ShareItFileSelector: React.FC<ShareItFileSelectorProps> = ({
  onBack,
  onProceedToRadar,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [activeCategory, setActiveCategory] = useState<'all' | 'image' | 'video' | 'audio' | 'document'>('all');
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setSelectedFiles([]);
  };

  const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);

  const filteredFiles = selectedFiles.filter((f) => {
    if (activeCategory === 'all') return true;
    return getFileCategory(f.type, f.name) === activeCategory;
  });

  const getFileCategoryIcon = (file: File) => {
    const category = getFileCategory(file.type, file.name);
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
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleAddFiles}
      />
      <input
        ref={imageInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={handleAddFiles}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-ignore
        webkitdirectory="true"
        className="hidden"
        onChange={handleAddFiles}
      />

      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={onBack}
          className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
          Select Files to Send
        </h2>

        {selectedFiles.length > 0 ? (
          <button
            onClick={clearAll}
            className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-medium">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors ${
            activeCategory === 'all'
              ? 'bg-cyan-600 text-white font-semibold shadow-xs'
              : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          All ({selectedFiles.length})
        </button>
        <button
          onClick={() => setActiveCategory('image')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1 ${
            activeCategory === 'image'
              ? 'bg-cyan-600 text-white font-semibold shadow-xs'
              : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Photos</span>
        </button>
        <button
          onClick={() => setActiveCategory('video')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1 ${
            activeCategory === 'video'
              ? 'bg-cyan-600 text-white font-semibold shadow-xs'
              : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>Videos</span>
        </button>
        <button
          onClick={() => setActiveCategory('audio')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1 ${
            activeCategory === 'audio'
              ? 'bg-cyan-600 text-white font-semibold shadow-xs'
              : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Music className="w-3.5 h-3.5" />
          <span>Music</span>
        </button>
        <button
          onClick={() => setActiveCategory('document')}
          className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1 ${
            activeCategory === 'document'
              ? 'bg-cyan-600 text-white font-semibold shadow-xs'
              : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Docs</span>
        </button>
      </div>

      {/* Main Drag & Drop / Browse Box */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/40 scale-[1.005]'
            : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-neutral-400 dark:hover:border-neutral-600'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-cyan-100 dark:bg-cyan-950/70 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-3">
          <UploadCloud className="w-6 h-6 stroke-[2]" />
        </div>
        <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
          Drop files or click to add
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          Photos, videos, documents, music, or entire folders
        </p>

        <div className="flex items-center gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 transition-colors"
          >
            Browse Files
          </button>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="px-3 py-1.5 text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 transition-colors"
          >
            Photos / Media
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="px-3 py-1.5 text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg text-neutral-800 dark:text-neutral-200 transition-colors flex items-center gap-1"
          >
            <FolderUp className="w-3.5 h-3.5" />
            <span>Folder</span>
          </button>
        </div>
      </div>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-500 pb-2 border-b border-neutral-100 dark:border-neutral-800">
            <span>
              Selected ({selectedFiles.length})
            </span>
            <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-200">
              Total: {formatBytes(totalSize)}
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/80 mt-2">
            {filteredFiles.map((file, idx) => (
              <div
                key={`${file.name}-${idx}`}
                className="py-2 px-1 flex items-center justify-between gap-3 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-850 rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getFileCategoryIcon(file)}
                  <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate max-w-xs sm:max-w-md">
                    {file.name}
                  </span>
                  <span className="text-[11px] font-mono text-neutral-400 shrink-0">
                    {formatBytes(file.size)}
                  </span>
                </div>
                <button
                  onClick={() => removeFile(idx)}
                  className="p-1 text-neutral-400 hover:text-rose-500 rounded-md transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SHAREit Floating Bottom Action Bar */}
      <div className="sticky bottom-4 z-30 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 shadow-lg flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
            {selectedFiles.length === 0 ? 'No files selected' : `${selectedFiles.length} ${selectedFiles.length === 1 ? 'file' : 'files'} selected`}
          </p>
          <p className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
            {formatBytes(totalSize)} total
          </p>
        </div>

        <button
          onClick={() => onProceedToRadar(selectedFiles)}
          disabled={selectedFiles.length === 0}
          className={`px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all ${
            selectedFiles.length > 0
              ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/25 active:scale-[0.98] cursor-pointer'
              : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed shadow-none'
          }`}
        >
          <span>Next: Find Receiver</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
