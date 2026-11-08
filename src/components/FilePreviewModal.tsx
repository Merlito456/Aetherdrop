import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  File as FileIcon,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  FileArchive,
  Code,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { formatBytes, getFileCategory } from '../utils/formatters';

export interface PreviewableFile {
  name: string;
  size: number;
  type: string;
  url?: string;
  file?: File;
}

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PreviewableFile | null;
  onDownload?: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  onClose,
  item,
  onDownload,
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [copiedText, setCopiedText] = useState(false);

  useEffect(() => {
    if (!isOpen || !item) {
      setObjectUrl(null);
      setTextContent(null);
      setZoomLevel(1);
      return;
    }

    let createdUrl: string | null = null;
    let effectiveUrl = item.url || null;

    if (!effectiveUrl && item.file) {
      createdUrl = URL.createObjectURL(item.file);
      effectiveUrl = createdUrl;
    }

    setObjectUrl(effectiveUrl);

    // If text or code, attempt to read first 64KB for safe in-browser display
    const category = getFileCategory(item.type, item.name);
    const isTextLike =
      category === 'code' ||
      category === 'document' ||
      item.type.startsWith('text/') ||
      item.name.endsWith('.txt') ||
      item.name.endsWith('.json') ||
      item.name.endsWith('.md') ||
      item.name.endsWith('.ts') ||
      item.name.endsWith('.tsx') ||
      item.name.endsWith('.js') ||
      item.name.endsWith('.css') ||
      item.name.endsWith('.html') ||
      item.name.endsWith('.csv') ||
      item.name.endsWith('.log');

    if (isTextLike && item.file) {
      setLoadingText(true);
      const slice = item.file.slice(0, 64 * 1024);
      slice
        .text()
        .then((txt) => {
          setTextContent(txt);
        })
        .catch(() => {
          setTextContent(null);
        })
        .finally(() => {
          setLoadingText(false);
        });
    } else if (isTextLike && effectiveUrl) {
      setLoadingText(true);
      fetch(effectiveUrl)
        .then((r) => r.text())
        .then((txt) => {
          setTextContent(txt.slice(0, 64 * 1024));
        })
        .catch(() => {})
        .finally(() => setLoadingText(false));
    }

    return () => {
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const category = getFileCategory(item.type, item.name);

  const handleCopyText = () => {
    if (textContent) {
      navigator.clipboard.writeText(textContent);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              {category === 'image' && <ImageIcon className="w-5 h-5 text-emerald-500" />}
              {category === 'video' && <Video className="w-5 h-5 text-purple-500" />}
              {category === 'audio' && <Music className="w-5 h-5 text-amber-500" />}
              {category === 'document' && <FileText className="w-5 h-5 text-blue-500" />}
              {category === 'code' && <Code className="w-5 h-5 text-cyan-500" />}
              {category === 'archive' && <FileArchive className="w-5 h-5 text-rose-500" />}
              {category === 'other' && <FileIcon className="w-5 h-5 text-neutral-400" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate max-w-md">
                {item.name}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                {formatBytes(item.size)} · {item.type || 'Unknown MIME'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onDownload && (
              <button
                onClick={onDownload}
                className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Save</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              aria-label="Close preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Viewer */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950/60 min-h-[300px]">
          {/* 1. Image Viewer */}
          {category === 'image' && objectUrl && (
            <div className="flex flex-col items-center justify-center w-full h-full space-y-3">
              <div className="relative max-h-[60vh] max-w-full overflow-auto flex items-center justify-center rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-black/5 dark:bg-black/30 p-2">
                <img
                  src={objectUrl}
                  alt={item.name}
                  style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.15s ease' }}
                  className="max-h-[55vh] max-w-full object-contain rounded-xl select-none"
                />
              </div>
              <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-3 py-1.5 rounded-xl text-xs shadow-xs">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                  className="p-1 hover:text-cyan-600 cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="font-mono text-[11px] font-bold text-neutral-600 dark:text-neutral-300 w-12 text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                  className="p-1 hover:text-cyan-600 cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="text-[11px] px-2 py-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer font-medium ml-1"
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {/* 2. Video Player */}
          {category === 'video' && objectUrl && (
            <div className="w-full max-w-2xl flex flex-col items-center">
              <video
                src={objectUrl}
                controls
                autoPlay
                className="w-full max-h-[60vh] rounded-2xl border border-neutral-300 dark:border-neutral-800 shadow-lg bg-black"
              />
            </div>
          )}

          {/* 3. Audio Player */}
          {category === 'audio' && objectUrl && (
            <div className="w-full max-w-md p-6 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-md flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-500 flex items-center justify-center shadow-xs">
                <Music className="w-10 h-10 stroke-[2.2]" />
              </div>
              <div>
                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100 truncate max-w-xs">
                  {item.name}
                </h4>
                <p className="text-xs text-neutral-500 font-mono mt-0.5">{formatBytes(item.size)}</p>
              </div>
              <audio src={objectUrl} controls className="w-full mt-2" autoPlay />
            </div>
          )}

          {/* 4. Text / Code Viewer */}
          {textContent !== null && (
            <div className="w-full h-full flex flex-col space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
                <span>File Text Preview (First 64 KB)</span>
                <button
                  onClick={handleCopyText}
                  className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-medium hover:underline cursor-pointer"
                >
                  {copiedText ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="w-full max-h-[55vh] overflow-auto p-4 rounded-2xl bg-neutral-900 text-neutral-100 font-mono text-xs leading-relaxed border border-neutral-800 selection:bg-cyan-500 selection:text-white">
                {textContent}
              </pre>
            </div>
          )}

          {/* 5. Fallback for binary / archive / unsupported preview */}
          {category !== 'image' && category !== 'video' && category !== 'audio' && textContent === null && (
            <div className="text-center p-8 max-w-sm space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 mx-auto">
                <FileIcon className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  {item.name}
                </h4>
                <p className="text-xs text-neutral-500 mt-1">
                  Preview is not supported for this file format in-browser. You can download and open it in your system viewer.
                </p>
              </div>
              {onDownload && (
                <button
                  onClick={onDownload}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 mx-auto shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File ({formatBytes(item.size)})</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
