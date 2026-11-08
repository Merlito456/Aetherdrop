import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle } from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'qr-reader-container';

  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).finally(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        });
      }
      return;
    }

    setErrorMsg(null);
    let isCancelled = false;

    // Small delay to ensure DOM element is mounted
    const timer = setTimeout(() => {
      if (isCancelled) return;
      try {
        const html5QrCode = new Html5Qrcode(containerId);
        scannerRef.current = html5QrCode;

        html5QrCode
          .start(
            { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: { width: 220, height: 220 },
            },
            (decodedText) => {
              // Successfully decoded QR Code
              onScanSuccess(decodedText);
              onClose();
            },
            () => {
              // Ignore frame decode misses
            }
          )
          .catch((err) => {
            console.warn('Camera scan error:', err);
            setErrorMsg('Unable to access camera. Please allow camera permissions or enter PIN manually.');
          });
      } catch (e: any) {
        setErrorMsg(e?.message || 'Camera initialization error');
      }
    }, 200);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).finally(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        });
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 max-w-sm w-full p-5 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg transition-colors z-10"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="w-9 h-9 rounded-xl bg-cyan-100 dark:bg-cyan-950/70 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Scan Peer QR Code
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Point your camera at the other screen
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col items-center">
          <div
            id={containerId}
            className="w-full aspect-square max-w-[260px] bg-neutral-950 rounded-xl overflow-hidden relative"
          />

          {errorMsg && (
            <div className="mt-3 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center mt-3">
            Position the QR code inside the frame to connect instantly.
          </p>
        </div>
      </div>
    </div>
  );
};
