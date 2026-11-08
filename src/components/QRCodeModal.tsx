import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, Smartphone, Wifi } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  roomId,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const fullUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`
    : '';

  useEffect(() => {
    if (isOpen && fullUrl) {
      QRCode.toDataURL(fullUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR:', err));
    }
  }, [isOpen, fullUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 max-w-sm w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950/70 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-3">
            <Smartphone className="w-5 h-5" />
          </div>

          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Scan to Pair Mobile Device
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xs">
            Open your phone's camera to join this local Wi-Fi transfer room instantly.
          </p>

          {/* QR Code Container */}
          <div className="mt-5 p-3 bg-white rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-xs">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Room Connection QR Code"
                className="w-56 h-56 rounded-lg"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center text-xs text-neutral-400">
                Generating QR...
              </div>
            )}
          </div>

          {/* Room PIN Code info */}
          <div className="mt-4 flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
            <Wifi className="w-3.5 h-3.5 text-cyan-500" />
            <span>Room Code:</span>
            <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md">
              {roomId}
            </span>
          </div>

          {/* Copy link button */}
          <button
            onClick={handleCopy}
            className="mt-4 w-full py-2 px-3 text-xs font-semibold rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 transition-colors flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Link Copied to Clipboard</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Direct Link</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
