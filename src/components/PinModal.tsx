import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  KeyRound,
  Check,
  Copy,
  ArrowRight,
  Loader2,
  Smartphone,
  Laptop,
  Tablet,
  CheckCircle2,
  AlertCircle,
  Share2,
} from 'lucide-react';
import { Peer } from '../types/transfer';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  selfPeer: Peer;
  stagedFilesCount?: number;
  onConnectByPin: (pin: string) => Promise<{ success: boolean; peer?: Peer; error?: string }>;
  onSuccess?: (peer: Peer) => void;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  onClose,
  selfPeer,
  stagedFilesCount = 0,
  onConnectByPin,
  onSuccess,
}) => {
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [matchedPeer, setMatchedPeer] = useState<Peer | null>(null);

  const inputRefs = [
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
  ];

  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '']);
      setStatus('idle');
      setStatusMessage('');
      setMatchedPeer(null);
      setTimeout(() => {
        inputRefs[0].current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentPin = digits.join('');

  const handleDigitChange = (index: number, val: string) => {
    // If multiple characters pasted
    if (val.length > 1) {
      const clean = val.replace(/\D/g, '').slice(0, 4);
      if (clean.length > 0) {
        const newDigits = ['', '', '', ''];
        for (let i = 0; i < clean.length; i++) {
          newDigits[i] = clean[i];
        }
        setDigits(newDigits);
        const nextIdx = Math.min(clean.length, 3);
        inputRefs[nextIdx].current?.focus();
        if (clean.length === 4) {
          submitPin(clean);
        }
        return;
      }
    }

    const singleDigit = val.slice(-1).replace(/\D/g, '');
    const newDigits = [...digits];
    newDigits[index] = singleDigit;
    setDigits(newDigits);
    setStatus('idle');
    setStatusMessage('');

    if (singleDigit && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto submit if all 4 digits are filled
    const full = newDigits.join('');
    if (full.length === 4) {
      submitPin(full);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const submitPin = async (pinToSubmit: string) => {
    const clean = pinToSubmit.trim();
    if (clean.length < 4) {
      setStatus('error');
      setStatusMessage('Please enter all 4 digits of the PIN.');
      return;
    }

    if (clean === selfPeer.pin) {
      setStatus('error');
      setStatusMessage("That is this device's own PIN. Enter the PIN shown on the receiver device.");
      return;
    }

    setStatus('connecting');
    setStatusMessage(`Locating and pairing with device PIN ${clean}...`);

    try {
      const result = await onConnectByPin(clean);
      if (result.success && result.peer) {
        setStatus('success');
        setMatchedPeer(result.peer);
        setStatusMessage(`Connected to ${result.peer.name}!`);
        setTimeout(() => {
          onSuccess?.(result.peer!);
          onClose();
        }, 1200);
      } else {
        setStatus('error');
        setStatusMessage(
          result.error || `Could not find a device with PIN ${clean}. Ensure receiver has Receive mode open.`
        );
      }
    } catch {
      setStatus('error');
      setStatusMessage(`Failed to connect to PIN ${clean}. Please check your connection.`);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitPin(currentPin);
  };

  const handleCopySelfPin = () => {
    navigator.clipboard.writeText(selfPeer.pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-5 h-5" />;
      case 'tablet':
        return <Tablet className="w-5 h-5" />;
      default:
        return <Laptop className="w-5 h-5" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 max-w-md w-full p-6 sm:p-7 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-xl transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <KeyRound className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
              Connect via 4-Digit PIN
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Direct peer connection without scanning QR
            </p>
          </div>
        </div>

        {/* 4-Digit Inputs */}
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="flex justify-center items-center gap-3 my-2">
            {[0, 1, 2, 3].map((idx) => (
              <input
                key={idx}
                ref={inputRefs[idx]}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digits[idx]}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                disabled={status === 'connecting' || status === 'success'}
                aria-label={`Digit ${idx + 1}`}
                className="w-13 h-16 sm:w-15 sm:h-18 text-center text-2xl sm:text-3xl font-mono font-extrabold bg-neutral-100 dark:bg-neutral-800 border-2 border-neutral-200 dark:border-neutral-700 rounded-2xl text-neutral-900 dark:text-neutral-100 focus:outline-hidden focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/20 transition-all shadow-inner disabled:opacity-60"
              />
            ))}
          </div>

          {/* Status / Feedback message */}
          {statusMessage && (
            <div
              className={`p-3 rounded-2xl text-xs flex items-center gap-2.5 transition-all ${
                status === 'connecting'
                  ? 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800'
                  : status === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {status === 'connecting' && <Loader2 className="w-4 h-4 animate-spin shrink-0 text-cyan-600 dark:text-cyan-400" />}
              {status === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />}
              {status === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />}
              <span className="font-medium">{statusMessage}</span>
            </div>
          )}

          {/* Success peer badge */}
          {status === 'success' && matchedPeer && (
            <div className="p-3.5 bg-neutral-50 dark:bg-neutral-800/80 rounded-2xl border border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                  style={{ backgroundColor: matchedPeer.avatarColor }}
                >
                  {getDeviceIcon(matchedPeer.deviceType)}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    {matchedPeer.name}
                  </h4>
                  <p className="text-[11px] text-neutral-500 font-mono">
                    {matchedPeer.browser} · PIN {matchedPeer.pin}
                  </p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                Paired
              </span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={status === 'connecting' || status === 'success' || currentPin.length < 4}
            className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-neutral-300 disabled:to-neutral-400 dark:disabled:from-neutral-800 dark:disabled:to-neutral-800 text-white rounded-2xl font-bold text-sm shadow-md shadow-cyan-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {status === 'connecting' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : status === 'success' ? (
              <>
                <Check className="w-4 h-4" />
                <span>Connected!</span>
              </>
            ) : stagedFilesCount > 0 ? (
              <>
                <Share2 className="w-4 h-4" />
                <span>Send {stagedFilesCount} File{stagedFilesCount > 1 ? 's' : ''} to PIN</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Connect Device</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* This device's own PIN callout */}
        <div className="mt-5 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-2">
            <span>This Device's PIN:</span>
            <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              {selfPeer.pin}
            </span>
          </div>

          <button
            onClick={handleCopySelfPin}
            className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
