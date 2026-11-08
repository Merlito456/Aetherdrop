import { useState, useEffect, useRef } from 'react';
import { Peer, TransferTask, EncryptionMode, SpeedProfile } from './types/transfer';
import { getOrCreatePeerIdentity } from './utils/device';
import { WebRTCManager } from './utils/webrtcManager';
import {
  requestNotificationPermission,
  getNotificationStatus,
} from './utils/notifications';
import { formatBytes } from './utils/formatters';
import { TopBar } from './components/TopBar';
import { ShareItHome } from './components/ShareItHome';
import { ShareItFileSelector } from './components/ShareItFileSelector';
import { ShareItRadarScanner } from './components/ShareItRadarScanner';
import { ShareItReceiveMode } from './components/ShareItReceiveMode';
import { ShareItSessionView } from './components/ShareItSessionView';
import { TransferList } from './components/TransferList';
import { NearbyRadar } from './components/NearbyRadar';
import { QRCodeModal } from './components/QRCodeModal';
import { QRScannerModal } from './components/QRScannerModal';
import { SecurityModal } from './components/SecurityModal';
import { RoomModal } from './components/RoomModal';
import { SpeedOptimizerModal } from './components/SpeedOptimizerModal';
import { Lock, ArrowDownLeft, X } from 'lucide-react';

type ShareItView =
  | 'home'
  | 'send-select'
  | 'send-radar'
  | 'receive-beacon'
  | 'session'
  | 'radar-all'
  | 'transfers-history';

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

  // Encryption mode: defaults to Turbo DTLS (Hardware Accelerated 10 Gbps uncapped wire speed)
  const [encryptionMode, setEncryptionMode] = useState<EncryptionMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('aetherdrop_encryption_mode');
      if (stored === 'dual-crypto') return 'dual-crypto';
    }
    return 'turbo-dtls';
  });

  // High-Throughput Concurrency Profile: defaults to Turbo 8x Parallel SCTP Stripes
  const [speedProfile, setSpeedProfile] = useState<SpeedProfile>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('aetherdrop_speed_profile');
      if (stored === 'balanced-4x') return 'balanced-4x';
    }
    return 'turbo-8x';
  });

  const handleChangeSpeedProfile = (profile: SpeedProfile) => {
    setSpeedProfile(profile);
    localStorage.setItem('aetherdrop_speed_profile', profile);
    managerRef.current?.setSpeedProfile(profile);
  };

  // Wi-Fi Tethering / Mobile Hotspot Boost Mode (Client connected directly to sender hotspot)
  const [isTetherMode, setIsTetherMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('aetherdrop_tether_mode');
      return stored === 'true';
    }
    return false;
  });

  const handleToggleTetherMode = (enabled: boolean) => {
    setIsTetherMode(enabled);
    localStorage.setItem('aetherdrop_tether_mode', String(enabled));
    managerRef.current?.setTetherMode(enabled);
  };

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

  // Navigation state (SHAREit flow)
  const [currentView, setCurrentView] = useState<ShareItView>('home');
  const [stagedFilesToSend, setStagedFilesToSend] = useState<File[]>([]);

  // Modals state
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isSpeedModalOpen, setIsSpeedModalOpen] = useState(false);
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

        // Update live incoming alert toast
        setIncomingAlert((current) => {
          if (current && current.id === updatedTask.id) {
            if (updatedTask.status === 'completed' || updatedTask.status === 'error' || updatedTask.status === 'cancelled') {
              setTimeout(() => setIncomingAlert(null), 3500);
            }
            return updatedTask;
          }
          return current;
        });
      },
      onIncomingOffer: (incomingTask) => {
        // Automatically switch receiver into the active SHAREit transfer session!
        setIncomingAlert(incomingTask);
        setCurrentView('session');
      },
      onTransferCompleted: () => {},
      onSignalingStatus: (status, msg) => {
        setSignalingStatus(status);
        if (msg) setSignalingMessage(msg);
      },
    }, encryptionMode, isTetherMode, speedProfile);

    managerRef.current = manager;
    manager.init();

    // Auto-pair if URL has ?pin=...
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

  const handleRequestNotification = async () => {
    const granted = await requestNotificationPermission();
    setNotificationStatus(granted ? 'granted' : 'denied');
  };

  const handleSwitchRoom = (newRoom: string) => {
    setRoomId(newRoom);
    managerRef.current?.setRoomId(newRoom);
    const newUrl = `${window.location.pathname}?room=${encodeURIComponent(newRoom)}`;
    window.history.replaceState(null, '', newUrl);
  };

  // SHAREit SEND Flow Handlers
  const handleStartSend = () => {
    setStagedFilesToSend([]);
    setCurrentView('send-select');
  };

  const handleProceedToRadar = (files: File[]) => {
    setStagedFilesToSend(files);
    setCurrentView('send-radar');
  };

  const handleSelectReceiverAndSend = async (targetPeer: Peer) => {
    if (!managerRef.current || stagedFilesToSend.length === 0) return;
    setCurrentView('session');
    for (const file of stagedFilesToSend) {
      await managerRef.current.sendFile(file, targetPeer);
    }
  };

  // SHAREit RECEIVE Flow Handlers
  const handleStartReceive = () => {
    setCurrentView('receive-beacon');
  };

  // Direct connect or transmit staged files by PIN
  const handleConnectByPin = async (pin: string) => {
    if (!pin) return;
    if (stagedFilesToSend.length > 0) {
      setCurrentView('session');
      await managerRef.current?.sendFilesToPin(stagedFilesToSend, pin);
    } else {
      managerRef.current?.connectByPin(pin);
    }
  };

  const handleTestTetherTransfer = async () => {
    handleToggleTetherMode(true);
    setCurrentView('session');
    await managerRef.current?.testTetherTransfer();
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

  const handleRetry = (id: string) => {
    managerRef.current?.retryTransfer(id);
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
    (t) => t.status === 'transferring' || t.status === 'encrypting' || t.status === 'paused' || t.status === 'connecting'
  ).length;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Bar */}
      <TopBar
        currentTab={currentView === 'transfers-history' ? 'transfers' : currentView === 'radar-all' ? 'radar' : 'transfers'}
        setCurrentTab={(tab) => {
          if (tab === 'transfers') setCurrentView(activeTransfersCount > 0 ? 'session' : 'transfers-history');
          else if (tab === 'radar') setCurrentView('radar-all');
          else if (tab === 'security') setIsSecurityModalOpen(true);
          else if (tab === 'rooms') setIsRoomModalOpen(true);
        }}
        activeTransferCount={activeTransfersCount}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onOpenQR={() => setIsQRModalOpen(true)}
        onOpenRooms={() => setIsRoomModalOpen(true)}
        onOpenSecurity={() => setIsSecurityModalOpen(true)}
        onOpenSpeedOptimizer={() => setIsSpeedModalOpen(true)}
        speedProfile={speedProfile}
        notificationStatus={notificationStatus}
        onRequestNotification={handleRequestNotification}
        selfPeer={selfPeer}
      />

      {/* Floating Incoming Toast */}
      {incomingAlert && currentView !== 'session' && (
        <div
          onClick={() => setCurrentView('session')}
          className="fixed bottom-4 right-4 z-50 max-w-sm w-full bg-white dark:bg-neutral-900 border border-emerald-500/40 rounded-2xl p-4 shadow-xl shadow-emerald-500/10 cursor-pointer animate-in slide-in-from-bottom-5 duration-200"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ArrowDownLeft className="w-5 h-5 animate-bounce" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    {incomingAlert.status === 'completed' ? 'Transfer Complete' : 'Incoming Transfer'}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-emerald-600">
                    {incomingAlert.progress}%
                  </span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 truncate">
                  {incomingAlert.fileName} ({formatBytes(incomingAlert.fileSize)})
                </p>
                <p className="text-[11px] text-neutral-400">
                  Tap to view live transfer session
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIncomingAlert(null);
              }}
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* SHAREit Screen 1: Home (Big Send & Receive Buttons) */}
        {currentView === 'home' && (
          <ShareItHome
            selfPeer={selfPeer}
            roomId={roomId}
            peersCount={peers.length}
            activeTransfersCount={activeTransfersCount}
            onStartSend={handleStartSend}
            onStartReceive={handleStartReceive}
            onOpenQR={() => setIsQRModalOpen(true)}
            onOpenScanner={() => setIsScannerModalOpen(true)}
            onOpenRooms={() => setIsRoomModalOpen(true)}
            onViewTransfers={() => setCurrentView(activeTransfersCount > 0 ? 'session' : 'transfers-history')}
            simulatedPeerEnabled={simulatedPeerActive}
            onToggleSimulatedPeer={handleToggleSimulatedPeer}
            isTetherMode={isTetherMode}
            onToggleTetherMode={handleToggleTetherMode}
            onTestTetherTransfer={handleTestTetherTransfer}
            speedProfile={speedProfile}
            onOpenSpeedOptimizer={() => setIsSpeedModalOpen(true)}
          />
        )}

        {/* SHAREit Screen 2: Select Files to Send */}
        {currentView === 'send-select' && (
          <ShareItFileSelector
            onBack={() => setCurrentView('home')}
            onProceedToRadar={handleProceedToRadar}
          />
        )}

        {/* SHAREit Screen 3: Sonar Radar Scanning for Receivers */}
        {currentView === 'send-radar' && (
          <ShareItRadarScanner
            selfPeer={selfPeer}
            stagedFiles={stagedFilesToSend}
            peers={peers}
            onBack={() => setCurrentView('send-select')}
            onSelectReceiver={handleSelectReceiverAndSend}
            onOpenScanner={() => setIsScannerModalOpen(true)}
            onRefresh={() => managerRef.current?.fetchPeers()}
            onConnectByPin={handleConnectByPin}
            signalingStatus={signalingStatus}
            signalingMessage={signalingMessage}
            isTetherMode={isTetherMode}
          />
        )}

        {/* SHAREit Screen 4: Receive Mode (Beacon & Receiver QR) */}
        {currentView === 'receive-beacon' && (
          <ShareItReceiveMode
            selfPeer={selfPeer}
            roomId={roomId}
            onBack={() => setCurrentView('home')}
            signalingStatus={signalingStatus}
          />
        )}

        {/* SHAREit Screen 5: Active Bilateral Transfer Session */}
        {currentView === 'session' && (
          <ShareItSessionView
            selfPeer={selfPeer}
            transfers={transfers}
            encryptionMode={encryptionMode}
            onToggleEncryptionMode={(mode) => {
              setEncryptionMode(mode);
              localStorage.setItem('aetherdrop_encryption_mode', mode);
              managerRef.current?.setEncryptionMode(mode);
            }}
            speedProfile={speedProfile}
            onOpenSpeedOptimizer={() => setIsSpeedModalOpen(true)}
            isTetherMode={isTetherMode}
            onToggleTetherMode={handleToggleTetherMode}
            onPause={handlePause}
            onResume={handleResume}
            onCancel={handleCancel}
            onRetry={handleRetry}
            onSendMore={handleStartSend}
            onExitSession={() => setCurrentView('home')}
            onTestTetherTransfer={handleTestTetherTransfer}
          />
        )}

        {/* Fallback View: Classic Radar View */}
        {currentView === 'radar-all' && (
          <div className="space-y-6">
            <NearbyRadar
              selfPeer={selfPeer}
              peers={peers}
              selectedPeerId={selectedPeerId}
              onSelectPeer={(id) => {
                setSelectedPeerId(id);
                setCurrentView('transfers-history');
              }}
              onOpenQR={() => setIsQRModalOpen(true)}
              onOpenScanner={() => setIsScannerModalOpen(true)}
              onRefresh={() => managerRef.current?.fetchPeers()}
              simulatedPeerEnabled={simulatedPeerActive}
              onToggleSimulatedPeer={handleToggleSimulatedPeer}
              onDirectSendFiles={(peer) => {
                setSelectedPeerId(peer.id);
                handleStartSend();
              }}
              onConnectByPin={handleConnectByPin}
              signalingStatus={signalingStatus}
              signalingMessage={signalingMessage}
            />
          </div>
        )}

        {/* Fallback View: Transfers History */}
        {currentView === 'transfers-history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-800">
              <button
                onClick={() => setCurrentView('home')}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
              >
                ← Back to Home
              </button>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Transfer Management
              </h2>
              <button
                onClick={handleStartSend}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs"
              >
                + Send Files
              </button>
            </div>

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
            <span>SHAREit-Style P2P Local Transfer</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">PIN: {selfPeer.pin}</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSpeedModalOpen(true)}
              className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline flex items-center gap-1"
            >
              <span>⚡ Speed Optimizer</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-100 dark:bg-cyan-950 font-mono">
                {speedProfile === 'turbo-8x' ? '8x SCTP' : '4x'}
              </span>
            </button>
            <button
              onClick={() => setIsSecurityModalOpen(true)}
              className="hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
            >
              Zero-Cache Security
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

      <SpeedOptimizerModal
        isOpen={isSpeedModalOpen}
        onClose={() => setIsSpeedModalOpen(false)}
        speedProfile={speedProfile}
        onChangeSpeedProfile={handleChangeSpeedProfile}
        isTetherMode={isTetherMode}
        onToggleTetherMode={handleToggleTetherMode}
        encryptionMode={encryptionMode}
        onChangeEncryptionMode={(mode) => {
          setEncryptionMode(mode);
          localStorage.setItem('aetherdrop_encryption_mode', mode);
          managerRef.current?.setEncryptionMode(mode);
        }}
        onRunSpeedTest={handleTestTetherTransfer}
        activePeakSpeed={transfers.reduce((max, t) => Math.max(max, t.peakSpeed || 0), 0)}
        activeChannelCount={transfers.find((t) => t.status === 'transferring')?.channelCount || (speedProfile === 'turbo-8x' || isTetherMode ? 8 : 4)}
      />

      <RoomModal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        currentRoom={roomId}
        onSwitchRoom={handleSwitchRoom}
        encryptionMode={encryptionMode}
        onSwitchEncryptionMode={(mode) => {
          setEncryptionMode(mode);
          localStorage.setItem('aetherdrop_encryption_mode', mode);
          managerRef.current?.setEncryptionMode(mode);
        }}
        isTetherMode={isTetherMode}
        onSwitchTetherMode={handleToggleTetherMode}
      />
    </div>
  );
}
