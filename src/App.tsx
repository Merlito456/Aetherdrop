import { useState, useEffect, useRef } from 'react';
import { Peer, TransferTask } from './types/transfer';
import { getOrCreatePeerIdentity } from './utils/device';
import { WebRTCManager } from './utils/webrtcManager';
import {
  requestNotificationPermission,
  getNotificationStatus,
} from './utils/notifications';
import { TopBar } from './components/TopBar';
import { Dropzone } from './components/Dropzone';
import { TransferList } from './components/TransferList';
import { NearbyRadar } from './components/NearbyRadar';
import { QRCodeModal } from './components/QRCodeModal';
import { SecurityModal } from './components/SecurityModal';
import { RoomModal } from './components/RoomModal';
import { Lock, Wifi, Zap, ShieldCheck } from 'lucide-react';

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

  // Sync dark class with documentElement
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
  const [currentTab, setCurrentTab] = useState<'transfers' | 'radar' | 'security' | 'rooms'>('transfers');
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission | 'unsupported'>('default');

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
        // If selected peer disappeared, reset selection
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
      },
      onTransferCompleted: () => {
        // Notification & Audio are handled inside manager
      },
      onIncomingOffer: () => {
        // Automatically accept or update
      },
    });

    managerRef.current = manager;
    manager.init();

    return () => {
      manager.destroy();
    };
  }, [selfPeer, roomId]);

  // Request notifications
  const handleRequestNotification = async () => {
    const granted = await requestNotificationPermission();
    setNotificationStatus(granted ? 'granted' : 'denied');
  };

  // Switch Room / PIN
  const handleSwitchRoom = (newRoom: string) => {
    setRoomId(newRoom);
    managerRef.current?.setRoomId(newRoom);
    // Update URL query string without reloading
    const newUrl = `${window.location.pathname}?room=${encodeURIComponent(newRoom)}`;
    window.history.replaceState(null, '', newUrl);
  };

  // Send files handler
  const handleSendFiles = async (files: File[], targetPeer: Peer) => {
    if (!managerRef.current || files.length === 0) return;
    for (const file of files) {
      await managerRef.current.sendFile(file, targetPeer);
    }
    // Switch to transfers view so user immediately sees real-time progress
    setCurrentTab('transfers');
  };

  // Direct send files to a specific peer
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

      {/* Top Bar with Zone Contract */}
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

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        
        {/* Network & Security Status Ribbon */}
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
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>AES-256-GCM / WebRTC DTLS Active</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
            <button
              onClick={() => setIsSecurityModalOpen(true)}
              className="hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors flex items-center gap-1"
            >
              <Lock className="w-3 h-3 text-emerald-500" />
              <span>Zero-Storage Policy Verified</span>
            </button>
          </div>
        </div>

        {/* View Switcher: Transfers View vs Nearby Radar View */}
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
              onRefresh={() => managerRef.current?.fetchPeers()}
              simulatedPeerEnabled={simulatedPeerActive}
              onToggleSimulatedPeer={handleToggleSimulatedPeer}
              onDirectSendFiles={handleDirectSendFiles}
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
            {/* Drag & Drop Upload Zone */}
            <Dropzone
              availablePeers={peers}
              selectedPeerId={selectedPeerId}
              setSelectedPeerId={setSelectedPeerId}
              onSendFiles={handleSendFiles}
              onOpenRadar={() => setCurrentTab('radar')}
            />

            {/* Real-time Transfers Management with Progress, ETA, Speed & Controls */}
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
            <span>Zero-Storage Ephemeral RAM</span>
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
