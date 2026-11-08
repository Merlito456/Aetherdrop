import { useState, useEffect, useRef } from 'react';
import { Peer, TransferTask } from './types/transfer';
import { getOrCreatePeerIdentity } from './utils/device';
import { WebRTCManager } from './utils/webrtcManager';
import {
  requestNotificationPermission,
  getNotificationStatus,
} from './utils/notifications';
import { formatBytes } from './utils/formatters';
import { TopBar } from './components/TopBar';
import { Dropzone } from './components/Dropzone';
import { TransferList } from './components/TransferList';
import { NearbyRadar } from './components/NearbyRadar';
import { QRCodeModal } from './components/QRCodeModal';
import { QRScannerModal } from './components/QRScannerModal';
import { SecurityModal } from './components/SecurityModal';
import { RoomModal } from './components/RoomModal';
import { Lock, Wifi, Zap, ShieldCheck, Radio, ArrowDownLeft, X } from 'lucide-react';

export default function App() {
  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('aetherdrop_theme');
      if (stored) return stored === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('aetherdrop_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('aetherdrop_theme', 'light');
    }
  }, [darkMode]);

  // Peer & Room State
  const [selfPeer] = useState<Peer>(() => {
    const info = getOrCreatePeerIdentity();
    return {
      ...info,
      isSelf: true,
      status: 'available',
    };
  });

  const [roomId, setRoomId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('room') || 'default-lan';
    }
    return 'default-lan';
  });

  // UI Navigation & Modals
  const [currentTab, setCurrentTab] = useState<'transfers' | 'radar' | 'security' | 'rooms'>('radar');
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission | 'unsupported'>('default');

  // Real-time incoming transfer alert banner
  const [incomingAlert, setIncomingAlert] = useState<TransferTask | null>(null);

  // Signaling status
  const [signalingStatus, setSignalingStatus] = useState<'connected' | 'connecting' | 'offline'>('connecting');
  const [signalingMessage, setSignalingMessage] = useState<string>('Connecting to discovery network...');

  // Transfers & Peers
  const [peers, setPeers] = useState<Peer[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<TransferTask[]>([]);
  const [simulatedPeerActive, setSimulatedPeerActive] = useState<boolean>(false);

  // Hidden file input for direct-to-peer transmission
  const directPeerRef = useRef<Peer | null>(null);
  const directFileInputRef = useRef<HTMLInputElement>(null);

  // Manager reference
  const managerRef = useRef<WebRTCManager | null>(null);

  // Initialize WebRTC and Local Discovery
  useEffect(() => {
    setNotificationStatus(getNotificationStatus());

    const manager = new WebRTCManager(selfPeer, roomId, {
      onPeersUpdated: (updatedPeers) => {
        setPeers(updatedPeers);
        setSelectedPeerId((curr) => {
          if (curr && !updatedPeers.some((p) => p.id === curr)) {
            return updatedPeers[0]?.id || null;
          }
          return curr || (updatedPeers[0]?.id || null);
        });
      },
      onTransferUpdated: (updatedTask) => {
        setTransfers((prev) => {
          const index = prev.findIndex((t) => t.id === updatedTask.id);
          if (index === -1) {
            return [updatedTask, ...prev];
          }
          const copy = [...prev];
          copy[index] = { ...updatedTask };
          return copy;
        });

        // Update live incoming alert banner if it matches
        setIncomingAlert((current) => {
          if (current && current.id === updatedTask.id) {
            if (updatedTask.status === 'completed' || updatedTask.status === 'error' || updatedTask.status === 'cancelled') {
              setTimeout(() => setIncomingAlert(null), 3000);
            }
            return updatedTask;
          }
          return current;
        });
      },
      onIncomingOffer: (incomingTask) => {
        // 1. Immediately notify receiving device in real-time!
        setIncomingAlert(incomingTask);
        // 2. Automatically switch receiver to Transfers view so they see live progress bar!
        setCurrentTab('transfers');
      },
      onTransferCompleted: (_task) => {},
      onSignalingStatus: (status, msg) => {
        setSignalingStatus(status);
        if (msg) setSignalingMessage(msg);
      },
    });

    managerRef.current = manager;
    manager.init();

    // Check if URL has ?pin=... for automatic pairing
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const targetPin = params.get('pin');
      if (targetPin && targetPin !== selfPeer.pin) {
        setTimeout(() => {
          manager.connectByPin(targetPin);
        }, 1200);
      }
    }

    return () => {
      manager.destroy();
    };
  }, [selfPeer, roomId]);

  // Request notifications
  const handleRequestNotification = async () => {
    const granted = await requestNotificationPermission();
    setNotificationStatus(granted ? 'granted' : 'denied');
  };

  // Switch Room
  const handleSwitchRoom = (newRoom: string) => {
    setRoomId(newRoom);
    managerRef.current?.setRoomId(newRoom);
    const newUrl = `${window.location.pathname}?room=${encodeURIComponent(newRoom)}`;
    window.history.replaceState(null, '', newUrl);
  };

  // Send files
  const handleSendFiles = async (files: File[], targetPeer: Peer) => {
    if (!managerRef.current || files.length === 0) return;
    for (const file of files) {
      await managerRef.current.sendFile(file, targetPeer);
    }
    setCurrentTab('transfers');
  };

  const handleDirectSendFiles = (peer: Peer) => {
    directPeerRef.current = peer;
    directFileInputRef.current?.click();
  };

  const handleDirectFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && directPeerRef.current) {
      const files = Array.from(e.target.files);
      handleSendFiles(files, directPeerRef.current);
    }
    e.target.value = '';
  };

  // Direct connect by PIN
  const handleConnectByPin = (pin: string) => {
    managerRef.current?.connectByPin(pin);
  };

  // Handle scanned QR code
  const handleScanSuccess = (decodedText: string) => {
    try {
      if (decodedText.startsWith('http://') || decodedText.startsWith('https://')) {
        const url = new URL(decodedText);
        const pin = url.searchParams.get('pin');
        const room = url.searchParams.get('room');
        if (room && room !== roomId) {
          handleSwitchRoom(room);
        }
        if (pin) {
          setTimeout(() => handleConnectByPin(pin), 600);
        }
      } else {
        handleConnectByPin(decodedText.trim());
      }
    } catch {
      handleConnectByPin(decodedText.trim());
    }
  };

  // Transfer actions
  const handlePause = (id: string) => {
    managerRef.current?.pauseTransfer(id);
  };

  const handleResume = (id: string) => {
    managerRef.current?.resumeTransfer(id);
  };

  const handleCancel = (id: string) => {
    managerRef.current?.cancelTransfer(id);
  };

  const handleClearCompleted = () => {
    setTransfers((prev) => prev.filter((t) => t.status !== 'completed' && t.status !== 'cancelled'));
  };

  const handlePurgeMemory = () => {
    managerRef.current?.purgeAllCaches();
    setTransfers((prev) =>
      prev.map((t) => {
        if (t.downloadUrl) {
          return { ...t, downloadUrl: undefined, receivedChunks: [] };
        }
        return t;
      })
    );
  };

  const handleToggleSimulatedPeer = (enable: boolean) => {
    setSimulatedPeerActive(enable);
    managerRef.current?.toggleSimulatedPeer(enable);
  };

  const activeTransfersCount = transfers.filter(
    (t) => t.status === 'transferring' || t.status === 'encrypting'
  ).length;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans transition-colors duration-200">
      {/* Hidden file input for direct peer transfers */}
      <input
        ref={directFileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleDirectFileInputChange}
      />

      {/* Top Bar */}
      <TopBar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          if (tab === 'security') setIsSecurityModalOpen(true);
          else if (tab === 'rooms') setIsRoomModalOpen(true);
          else setCurrentTab(tab);
        }}
        activeTransferCount={activeTransfersCount}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onOpenQR={() => setIsQRModalOpen(true)}
        onOpenRooms={() => setIsRoomModalOpen(true)}
        onOpenSecurity={() => setIsSecurityModalOpen(true)}
        notificationStatus={notificationStatus}
        onRequestNotification={handleRequestNotification}
        selfPeer={selfPeer}
      />

      {/* Real-time Floating Incoming Transfer Toast / Alert Banner */}
      {incomingAlert && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full bg-white dark:bg-neutral-900 border border-cyan-500/30 rounded-2xl p-4 shadow-xl shadow-cyan-500/10 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-cyan-100 dark:bg-cyan-950/70 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                <ArrowDownLeft className="w-5 h-5 animate-bounce" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate">
                    {incomingAlert.status === 'completed' ? 'Transfer Completed' : 'Incoming File Transfer'}
                  </span>
                  <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                    {incomingAlert.progress}%
                  </span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 truncate">
                  {incomingAlert.fileName} ({formatBytes(incomingAlert.fileSize)})
                </p>
                <p className="text-[11px] text-neutral-400">
                  From: {incomingAlert.peerName}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIncomingAlert(null)}
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mini progress bar */}
          <div className="mt-3 w-full bg-neutral-200 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-200"
              style={{ width: `${incomingAlert.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        
        {/* Network & Signaling Ribbon */}
        <div className="p-3.5 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 font-medium text-neutral-800 dark:text-neutral-200">
              <Wifi className="w-3.5 h-3.5 text-cyan-500" />
              <span>Room:</span>
              <button
                onClick={() => setIsRoomModalOpen(true)}
                className="font-mono font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                {roomId}
              </button>
            </span>
            <span className="hidden sm:inline text-neutral-300 dark:text-neutral-700">|</span>
            <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>{peers.length} {peers.length === 1 ? 'device' : 'devices'} in range</span>
            </span>
            <span className="hidden sm:inline text-neutral-300 dark:text-neutral-700">|</span>
            <span
              className={`flex items-center gap-1 font-medium ${
                signalingStatus === 'connected'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : signalingStatus === 'connecting'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-neutral-500'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{signalingMessage}</span>
            </span>
            <span className="hidden sm:inline text-neutral-300 dark:text-neutral-700">|</span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>AES-256-GCM Direct Channel</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
            <button
              onClick={() => setIsSecurityModalOpen(true)}
              className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors flex items-center gap-1"
            >
              <Lock className="w-3 h-3 text-emerald-500" />
              <span>Zero-Storage Memory Verified</span>
            </button>
          </div>
        </div>

        {/* View Switcher: Nearby Radar View vs Transfers View */}
        {currentTab === 'radar' ? (
          <div className="space-y-6">
            <NearbyRadar
              selfPeer={selfPeer}
              peers={peers}
              selectedPeerId={selectedPeerId}
              onSelectPeer={(id) => {
                setSelectedPeerId(id);
                setCurrentTab('transfers');
              }}
              onOpenQR={() => setIsQRModalOpen(true)}
              onOpenScanner={() => setIsScannerModalOpen(true)}
              onRefresh={() => managerRef.current?.fetchPeers()}
              simulatedPeerEnabled={simulatedPeerActive}
              onToggleSimulatedPeer={handleToggleSimulatedPeer}
              onDirectSendFiles={handleDirectSendFiles}
              onConnectByPin={handleConnectByPin}
              signalingStatus={signalingStatus}
              signalingMessage={signalingMessage}
            />

            <Dropzone
              availablePeers={peers}
              selectedPeerId={selectedPeerId}
              setSelectedPeerId={setSelectedPeerId}
              onSendFiles={handleSendFiles}
              onOpenRadar={() => setCurrentTab('radar')}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <Dropzone
              availablePeers={peers}
              selectedPeerId={selectedPeerId}
              setSelectedPeerId={setSelectedPeerId}
              onSendFiles={handleSendFiles}
              onOpenRadar={() => setCurrentTab('radar')}
            />

            <TransferList
              transfers={transfers}
              onPause={handlePause}
              onResume={handleResume}
              onCancel={handleCancel}
              onClearCompleted={handleClearCompleted}
            />
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 dark:border-neutral-800 py-4 bg-white/50 dark:bg-neutral-950/50 text-xs text-neutral-500 dark:text-neutral-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>AetherDrop</span>
            <span aria-hidden="true">·</span>
            <span>Local P2P WebRTC File Transfer</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">PIN: {selfPeer.pin}</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSecurityModalOpen(true)}
              className="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
            >
              Security Architecture
            </button>
            <button
              onClick={() => setIsRoomModalOpen(true)}
              className="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
            >
              Room Settings
            </button>
            <button
              onClick={handlePurgeMemory}
              className="text-rose-600 dark:text-rose-400 hover:underline"
            >
              Purge Memory
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <QRCodeModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        roomId={roomId}
        peerPin={selfPeer.pin}
      />

      <QRScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        onScanSuccess={handleScanSuccess}
      />

      <SecurityModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        onPurgeMemory={handlePurgeMemory}
      />

      <RoomModal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        currentRoom={roomId}
        onSwitchRoom={handleSwitchRoom}
      />
    </div>
  );
}
