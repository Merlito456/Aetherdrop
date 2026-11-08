import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  Search,
  CheckCircle2,
  HardDrive,
  Files,
  Eye,
  ArrowUpDown,
  Clipboard,
  AlertTriangle,
  Send,
  Sparkles,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Peer } from '../types/transfer';
import { formatBytes, getFileCategory } from '../utils/formatters';
import { extractFilesFromClipboard, triggerHaptic } from '../utils/systemWorkflows';
import { FilePreviewModal, PreviewableFile } from './FilePreviewModal';

interface ShareItFileSelectorProps {
  onBack: () => void;
  onProceedToRadar: (files: File[]) => void;
  onDirectSend?: (files: File[], peer: Peer) => void;
  connectedPeers?: Peer[];
  initialFiles?: File[];
}

type FileCategoryFilter = 'all' | 'image' | 'video' | 'audio' | 'document' | 'archive' | 'code';
type SortField = 'default' | 'name-asc' | 'name-desc' | 'size-desc' | 'size-asc' | 'type';

export const ShareItFileSelector: React.FC<ShareItFileSelectorProps> = ({
  onBack,
  onProceedToRadar,
  onDirectSend,
  connectedPeers = [],
  initialFiles = [],
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>(() => initialFiles);
  const [activeCategory, setActiveCategory] = useState<FileCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('default');
  const [isDragOver, setIsDragOver] = useState(false);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [checkedIndices, setCheckedIndices] = useState<Set<number>>(new Set());
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null);

  // File Preview Modal state
  const [previewItem, setPreviewItem] = useState<PreviewableFile | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Clipboard Paste Support: press Ctrl+V / Cmd+V to stage files or images instantly
  const handlePaste = useCallback((e: ClipboardEvent) => {
    // Only capture if not focused inside search input
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const pasted = extractFilesFromClipboard(e);
    if (pasted.length > 0) {
      e.preventDefault();
      setSelectedFiles((prev) => [...prev, ...pasted]);
      triggerHaptic('tap');
      setClipboardNotice(`Pasted ${pasted.length} file(s) from clipboard!`);
      setTimeout(() => setClipboardNotice(null), 3500);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // Generate and manage image thumbnail object URLs
  useEffect(() => {
    const newThumbnails: Record<string, string> = {};
    const urlsToRevoke: string[] = [];

    selectedFiles.forEach((file, idx) => {
      if (file.type.startsWith('image/')) {
        const key = `${file.name}-${file.size}-${idx}`;
        const url = URL.createObjectURL(file);
        newThumbnails[key] = url;
        urlsToRevoke.push(url);
      }
    });

    setThumbnails(newThumbnails);

    return () => {
      urlsToRevoke.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
    };
  }, [selectedFiles]);

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
      triggerHaptic('tap');
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
      triggerHaptic('tap');
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setCheckedIndices((prev) => {
      const updated = new Set<number>();
      for (const idx of prev) {
        if (idx < index) updated.add(idx);
        else if (idx > index) updated.add(idx - 1);
      }
      return updated;
    });
  };

  const clearAll = () => {
    setSelectedFiles([]);
    setCheckedIndices(new Set());
  };

  // Duplicate files detection
  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    const dupIndices = new Set<number>();

    selectedFiles.forEach((f, idx) => {
      const key = `${f.name}_${f.size}`;
      if (seen.has(key)) {
        dupIndices.add(idx);
      } else {
        seen.set(key, idx);
      }
    });
    return dupIndices;
  }, [selectedFiles]);

  const handleDeduplicate = () => {
    const seen = new Set<string>();
    const uniqueFiles: File[] = [];
    selectedFiles.forEach((f) => {
      const key = `${f.name}_${f.size}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueFiles.push(f);
      }
    });
    setSelectedFiles(uniqueFiles);
    setCheckedIndices(new Set());
    triggerHaptic('tap');
  };

  // Multi-selection controls
  const toggleSelectAll = () => {
    if (checkedIndices.size === selectedFiles.length) {
      setCheckedIndices(new Set());
    } else {
      setCheckedIndices(new Set(selectedFiles.map((_, i) => i)));
    }
  };

  const toggleCheck = (index: number) => {
    setCheckedIndices((prev) => {
      const updated = new Set(prev);
      if (updated.has(index)) updated.delete(index);
      else updated.add(index);
      return updated;
    });
  };

  const removeSelectedChecked = () => {
    setSelectedFiles((prev) => prev.filter((_, i) => !checkedIndices.has(i)));
    setCheckedIndices(new Set());
    triggerHaptic('tap');
  };

  const totalSize = useMemo(() => {
    return selectedFiles.reduce((sum, f) => sum + f.size, 0);
  }, [selectedFiles]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<FileCategoryFilter, number> = {
      all: selectedFiles.length,
      image: 0,
      video: 0,
      audio: 0,
      document: 0,
      archive: 0,
      code: 0,
    };
    for (const f of selectedFiles) {
      const cat = getFileCategory(f.type, f.name) as FileCategoryFilter;
      if (counts[cat] !== undefined) {
        counts[cat] += 1;
      }
    }
    return counts;
  }, [selectedFiles]);

  // Filtered & Sorted files
  const processedFiles = useMemo(() => {
    let items = selectedFiles.map((file, originalIndex) => ({ file, originalIndex }));

    // 1. Category Filter
    if (activeCategory !== 'all') {
      items = items.filter(({ file }) => getFileCategory(file.type, file.name) === activeCategory);
    }

    // 2. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(({ file }) => file.name.toLowerCase().includes(q));
    }

    // 3. Sorting
    switch (sortBy) {
      case 'name-asc':
        items.sort((a, b) => a.file.name.localeCompare(b.file.name));
        break;
      case 'name-desc':
        items.sort((a, b) => b.file.name.localeCompare(a.file.name));
        break;
      case 'size-desc':
        items.sort((a, b) => b.file.size - a.file.size);
        break;
      case 'size-asc':
        items.sort((a, b) => a.file.size - b.file.size);
        break;
      case 'type':
        items.sort((a, b) => (a.file.type || '').localeCompare(b.file.type || ''));
        break;
      default:
        break;
    }

    return items;
  }, [selectedFiles, activeCategory, searchQuery, sortBy]);

  const openPreview = (file: File) => {
    setPreviewItem({
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      file,
    });
    setIsPreviewOpen(true);
  };

  const getFileCategoryIcon = (file: File, index: number) => {
    const key = `${file.name}-${file.size}-${index}`;
    if (thumbnails[key]) {
      return (
        <img
          src={thumbnails[key]}
          alt=""
          onClick={(e) => {
            e.stopPropagation();
            openPreview(file);
          }}
          className="w-10 h-10 object-cover rounded-lg border border-neutral-200 dark:border-neutral-700 shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
        />
      );
    }

    const category = getFileCategory(file.type, file.name);
    switch (category) {
      case 'image':
        return (
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ImageIcon className="w-5 h-5" />
          </div>
        );
      case 'video':
        return (
          <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Video className="w-5 h-5" />
          </div>
        );
      case 'audio':
        return (
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Music className="w-5 h-5" />
          </div>
        );
      case 'document':
        return (
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
        );
      case 'archive':
        return (
          <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <FileArchive className="w-5 h-5" />
          </div>
        );
      case 'code':
        return (
          <div className="w-10 h-10 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <Code className="w-5 h-5" />
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-500 flex items-center justify-center shrink-0">
            <FileIcon className="w-5 h-5" />
          </div>
        );
    }
  };

  // Connected direct receiver shortcut
  const activeTargetPeer = connectedPeers.find((p) => p.status === 'connected' && !p.isSelf);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Hidden file & folder inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleAddFiles}
      />
      <input
        ref={mediaInputRef}
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
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={onBack}
          className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Home</span>
        </button>

        <div className="text-center">
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Select Files to Send
          </h2>
          <div className="flex items-center justify-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            <span>{selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-medium">{formatBytes(totalSize)} total</span>
          </div>
        </div>

        {selectedFiles.length > 0 ? (
          <button
            onClick={clearAll}
            className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear All</span>
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      {/* Clipboard Toast Banner */}
      {clipboardNotice && (
        <div className="px-4 py-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-800 text-xs font-semibold text-cyan-800 dark:text-cyan-200 flex items-center justify-between gap-2 shadow-xs animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Clipboard className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <span>{clipboardNotice}</span>
          </div>
          <button onClick={() => setClipboardNotice(null)} className="text-cyan-600 hover:text-cyan-900">
            ✕
          </button>
        </div>
      )}

      {/* Modern Drag & Drop / Browse Station */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          isDragOver
            ? 'border-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/40 scale-[1.005]'
            : 'border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-cyan-400 dark:hover:border-cyan-600 shadow-xs'
        }`}
      >
        <div className="w-14 h-14 rounded-2xl bg-cyan-50 dark:bg-cyan-950/70 border border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-3 shadow-xs">
          <UploadCloud className="w-7 h-7 stroke-[2]" />
        </div>
        <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
          Drop files, folders, or paste images (Ctrl+V)
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm">
          No file size limits. Transferred peer-to-peer at full Wi-Fi line speed.
        </p>

        {/* Action Buttons inside Dropzone */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl text-neutral-800 dark:text-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Files className="w-3.5 h-3.5 text-neutral-500" />
            <span>Browse Files</span>
          </button>
          <button
            type="button"
            onClick={() => mediaInputRef.current?.click()}
            className="px-3.5 py-1.5 text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl text-neutral-800 dark:text-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
            <span>Photos & Videos</span>
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="px-3.5 py-1.5 text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl text-neutral-800 dark:text-neutral-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <FolderUp className="w-3.5 h-3.5 text-blue-500" />
            <span>Upload Folder</span>
          </button>
        </div>
      </div>

      {/* Selected Files Hub (When files exist) */}
      {selectedFiles.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 shadow-xs space-y-3">
          {/* Header row: Duplicate alert + Batch Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-neutral-100 dark:border-neutral-800 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="font-medium text-neutral-600 dark:text-neutral-400 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center gap-1.5 cursor-pointer"
              >
                {checkedIndices.size === selectedFiles.length ? (
                  <CheckSquare className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                ) : (
                  <Square className="w-4 h-4 text-neutral-400" />
                )}
                <span>
                  {checkedIndices.size > 0 ? `${checkedIndices.size} selected` : 'Select All'}
                </span>
              </button>

              {checkedIndices.size > 0 && (
                <button
                  type="button"
                  onClick={removeSelectedChecked}
                  className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove ({checkedIndices.size})</span>
                </button>
              )}
            </div>

            {/* Duplicates notice */}
            {duplicates.size > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{duplicates.size} duplicate{duplicates.size > 1 ? 's' : ''} detected</span>
                <button
                  onClick={handleDeduplicate}
                  className="font-bold underline ml-1 hover:text-amber-900 cursor-pointer"
                >
                  Deduplicate
                </button>
              </div>
            )}

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 text-neutral-500">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortField)}
                className="bg-transparent text-neutral-700 dark:text-neutral-300 font-medium focus:outline-hidden cursor-pointer"
              >
                <option value="default" className="dark:bg-neutral-800">Sort: Default</option>
                <option value="name-asc" className="dark:bg-neutral-800">Name (A-Z)</option>
                <option value="name-desc" className="dark:bg-neutral-800">Name (Z-A)</option>
                <option value="size-desc" className="dark:bg-neutral-800">Size (Largest)</option>
                <option value="size-asc" className="dark:bg-neutral-800">Size (Smallest)</option>
                <option value="type" className="dark:bg-neutral-800">Type</option>
              </select>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 font-medium ${
                activeCategory === 'all'
                  ? 'bg-cyan-600 text-white font-semibold shadow-xs'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <span>All</span>
              <span className="text-[11px] opacity-80">({categoryCounts.all})</span>
            </button>

            {categoryCounts.image > 0 && (
              <button
                onClick={() => setActiveCategory('image')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 font-medium ${
                  activeCategory === 'image'
                    ? 'bg-cyan-600 text-white font-semibold shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                <span>Photos ({categoryCounts.image})</span>
              </button>
            )}

            {categoryCounts.video > 0 && (
              <button
                onClick={() => setActiveCategory('video')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 font-medium ${
                  activeCategory === 'video'
                    ? 'bg-cyan-600 text-white font-semibold shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Video className="w-3.5 h-3.5 text-purple-500" />
                <span>Videos ({categoryCounts.video})</span>
              </button>
            )}

            {categoryCounts.audio > 0 && (
              <button
                onClick={() => setActiveCategory('audio')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 font-medium ${
                  activeCategory === 'audio'
                    ? 'bg-cyan-600 text-white font-semibold shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Music className="w-3.5 h-3.5 text-amber-500" />
                <span>Music ({categoryCounts.audio})</span>
              </button>
            )}

            {categoryCounts.document > 0 && (
              <button
                onClick={() => setActiveCategory('document')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 font-medium ${
                  activeCategory === 'document'
                    ? 'bg-cyan-600 text-white font-semibold shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                <span>Docs ({categoryCounts.document})</span>
              </button>
            )}

            {categoryCounts.archive > 0 && (
              <button
                onClick={() => setActiveCategory('archive')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 font-medium ${
                  activeCategory === 'archive'
                    ? 'bg-cyan-600 text-white font-semibold shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <FileArchive className="w-3.5 h-3.5 text-rose-500" />
                <span>Archives ({categoryCounts.archive})</span>
              </button>
            )}

            {categoryCounts.code > 0 && (
              <button
                onClick={() => setActiveCategory('code')}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 font-medium ${
                  activeCategory === 'code'
                    ? 'bg-cyan-600 text-white font-semibold shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Code className="w-3.5 h-3.5 text-cyan-500" />
                <span>Code ({categoryCounts.code})</span>
              </button>
            )}
          </div>

          {/* Search bar inside selection if 4+ files */}
          {selectedFiles.length >= 4 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search selected files by name..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          )}

          {/* Files List Scroll Area */}
          <div className="max-h-72 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/80 pr-1">
            {processedFiles.length === 0 ? (
              <p className="py-6 text-center text-xs text-neutral-400">
                No files match the current filter.
              </p>
            ) : (
              processedFiles.map(({ file, originalIndex }) => {
                const isChecked = checkedIndices.has(originalIndex);
                const isDuplicate = duplicates.has(originalIndex);

                return (
                  <div
                    key={`${file.name}-${originalIndex}`}
                    className={`py-2.5 px-2 flex items-center justify-between gap-3 text-xs rounded-xl transition-colors ${
                      isChecked
                        ? 'bg-cyan-50/70 dark:bg-cyan-950/40'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-850'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCheck(originalIndex)}
                        className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 accent-cyan-500 cursor-pointer shrink-0"
                      />

                      {getFileCategoryIcon(file, originalIndex)}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-xs sm:max-w-md">
                            {file.name}
                          </p>
                          {isDuplicate && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-bold">
                              Duplicate
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                          <span className="font-mono">{formatBytes(file.size)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{file.type || 'Binary'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Preview Button */}
                      <button
                        type="button"
                        onClick={() => openPreview(file)}
                        className="p-1.5 text-neutral-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Preview file"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeFile(originalIndex)}
                        className="p-1.5 text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Floating Bottom Sticky Bar */}
      <div className="sticky bottom-4 z-30 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
            {selectedFiles.length === 0 ? 'No files selected' : `${selectedFiles.length} ${selectedFiles.length === 1 ? 'file' : 'files'} selected`}
          </p>
          <p className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
            {formatBytes(totalSize)} cumulative size
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          {/* Direct Send Shortcut if a connected peer exists */}
          {activeTargetPeer && onDirectSend && selectedFiles.length > 0 && (
            <button
              onClick={() => onDirectSend(selectedFiles, activeTargetPeer)}
              className="px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-[0.98] cursor-pointer"
              title={`Send directly to ${activeTargetPeer.name}`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send to {activeTargetPeer.name}</span>
            </button>
          )}

          <button
            onClick={() => onProceedToRadar(selectedFiles)}
            disabled={selectedFiles.length === 0}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all ${
              selectedFiles.length > 0
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-600/25 active:scale-[0.98] cursor-pointer'
                : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed shadow-none'
            }`}
          >
            <span>Next: Scan for Receivers</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* In-App File Preview Modal */}
      <FilePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        item={previewItem}
      />
    </div>
  );
};
