import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Download,
  Wifi,
  KeyRound,
  ShieldCheck,
  Copy,
  Check,
  Smartphone,
  Laptop,
  Tablet,
  Radio,
} from 'lucide-react';
import { Peer } from '../types/transfer';

interface ShareItReceiveModeProps {
  selfPeer: Peer;
  roomId: string;
  onBack: () => void;
  signalingStatus: 'connected' | 'connecting' | 'offline';
}

export const ShareItReceiveMode: React.FC<ShareItReceiveModeProps> = ({
  selfPeer,
  roomId,
  onBack,
  signalingStatus,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const fullUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}&pin=${encodeURIComponent(selfPeer.pin)}`
    : '';

  useEffect(() => {
    if (fullUrl) {
      QRCode.toDataURL(fullUrl, {
        width: 260,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate receiver QR:', err));
    }
  }, [fullUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getDeviceIcon = () => {
    switch (selfPeer.deviceType) {
      case 'mobile':
        return <Smartphone className="w-5 h-5" />;
      case 'tablet':
        return <Tablet className="w-5 h-5" />;
      default:
        return <Laptop className="w-5 h-5" />;
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={onBack}
          className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit Receive Mode</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
          <Radio className="w-4 h-4 animate-pulse" />
          <span>Ready to Receive</span>
        </div>
      </div>

      {/* Main Receiver Beacon Card */}
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-6 sm:p-8 shadow-md flex flex-col items-center text-center relative overflow-hidden">
        {/* Pulsing Beacon Wave */}
        <div className="absolute top-12 flex items-center justify-center pointer-events-none opacity-30 dark:opacity-15">
          <div className="w-36 h-36 rounded-full border-2 border-emerald-500 animate-ping duration-1000" />
          <div className="absolute w-52 h-52 rounded-full border border-emerald-400" />
        </div>

        {/* Device Avatar */}
        <div className="relative z-10 flex flex-col items-center mb-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 ring-4 ring-white dark:ring-neutral-900"
            style={{ backgroundColor: selfPeer.avatarColor }}
          >
            {getDeviceIcon()}
          </div>
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-2">
            {selfPeer.name}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Waiting for sender to transmit files...
          </p>
        </div>

        {/* Prominent QR Code */}
        <div className="relative z-10 p-3 bg-white rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm mt-1">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Scan to Send QR"
              className="w-52 h-52 rounded-xl"
            />
          ) : (
            <div className="w-52 h-52 flex items-center justify-center text-xs text-neutral-400">
              Generating Beacon QR...
            </div>
          )}
        </div>

        {/* Receiver PIN Callout */}
        <div className="relative z-10 mt-5 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl max-w-sm w-full">
          <p className="text-xs text-emerald-800 dark:text-emerald-200 font-semibold mb-1">
            Receiver's Device PIN
          </p>
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-2xl font-extrabold tracking-widest text-emerald-600 dark:text-emerald-400">
              {selfPeer.pin}
            </span>
          </div>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-1">
            Sender can type this PIN on their radar to connect directly
          </p>
        </div>

        {/* Network & Security specs */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-cyan-500" />
            <span>Room: <strong className="font-mono text-neutral-800 dark:text-neutral-200">{roomId}</strong></span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>AES-256-GCM Encrypted</span>
          </span>
        </div>

        {/* Copy Direct Link Button */}
        <button
          onClick={handleCopy}
          className="mt-4 px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-2"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>Link Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Receiver Link</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
