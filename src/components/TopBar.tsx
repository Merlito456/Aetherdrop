import {
  ShieldCheck,
  Moon,
  Sun,
  Bell,
  BellRing,
  QrCode,
  Laptop,
  Smartphone,
  Tablet,
  Share2,
  Gauge,
  Zap,
  KeyRound,
} from 'lucide-react';
import { Peer, SpeedProfile } from '../types/transfer';

interface TopBarProps {
  currentTab: 'transfers' | 'radar' | 'security' | 'rooms';
  setCurrentTab: (tab: 'transfers' | 'radar' | 'security' | 'rooms') => void;
  activeTransferCount: number;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  onOpenQR: () => void;
  onOpenRooms: () => void;
  onOpenSecurity: () => void;
  onOpenSpeedOptimizer?: () => void;
  onOpenPinModal?: () => void;
  speedProfile?: SpeedProfile;
  notificationStatus: NotificationPermission | 'unsupported';
  onRequestNotification: () => void;
  selfPeer: Peer;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
  setCurrentTab,
  activeTransferCount,
  darkMode,
  setDarkMode,
  onOpenQR,
  onOpenRooms,
  onOpenSecurity,
  onOpenSpeedOptimizer,
  onOpenPinModal,
  speedProfile = 'turbo-8x',
  notificationStatus,
  onRequestNotification,
  selfPeer,
}) => {
  const getDeviceIcon = () => {
    switch (selfPeer.deviceType) {
      case 'mobile':
        return <Smartphone className="w-3.5 h-3.5" />;
      case 'tablet':
        return <Tablet className="w-3.5 h-3.5" />;
      default:
        return <Laptop className="w-3.5 h-3.5" />;
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
        
        {/* Zone 1: Brand Wordmark (Single Line) */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white shadow-sm shadow-cyan-500/20">
            <Share2 className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-bold tracking-tight text-neutral-900 dark:text-white leading-none whitespace-nowrap">
              AetherDrop
            </span>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="inline-flex items-center gap-1">
                {getDeviceIcon()}
                <span className="font-medium text-neutral-700 dark:text-neutral-300 max-w-[110px] sm:max-w-[150px] truncate">
                  {selfPeer.name}
                </span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-medium">Local P2P</span>
            </div>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => setCurrentTab('transfers')}
            className={`transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 py-1 ${
              currentTab === 'transfers'
                ? 'text-cyan-600 dark:text-cyan-400 font-semibold border-b-2 border-cyan-500'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            <span>Transfers</span>
            {activeTransferCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[11px] font-mono bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300">
                {activeTransferCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentTab('radar')}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 ${
              currentTab === 'radar'
                ? 'text-cyan-600 dark:text-cyan-400 font-semibold border-b-2 border-cyan-500'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            Nearby Radar
          </button>

          <button
            onClick={onOpenRooms}
            className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors whitespace-nowrap shrink-0 py-1"
          >
            Pairing Rooms
          </button>

          <button
            onClick={onOpenSecurity}
            className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 py-1"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Zero-Cache</span>
          </button>

          {onOpenSpeedOptimizer && (
            <button
              onClick={onOpenSpeedOptimizer}
              className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 py-1 font-semibold"
            >
              <Zap className="w-4 h-4 text-cyan-500 fill-current" />
              <span>Speed Optimizer</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-100 dark:bg-cyan-950 font-mono font-bold">
                {speedProfile === 'turbo-8x' ? '8x SCTP' : '4x'}
              </span>
            </button>
          )}
        </nav>

        {/* Zone 3: Primary Actions & Utilities */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Speed Optimizer quick button */}
          {onOpenSpeedOptimizer && (
            <button
              onClick={onOpenSpeedOptimizer}
              title="Speed & Pipeline Optimizer"
              className="p-2 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 rounded-lg transition-colors flex items-center gap-1"
              aria-label="Speed Optimizer"
            >
              <Gauge className="w-4 h-4" />
            </button>
          )}

          {/* PIN Quick Pair Button */}
          {onOpenPinModal && (
            <button
              onClick={onOpenPinModal}
              title="Connect via 4-digit PIN"
              className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-cyan-600 dark:hover:text-cyan-400 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              aria-label="Connect via PIN"
            >
              <KeyRound className="w-4 h-4" />
            </button>
          )}

          {/* QR Code Quick Pair Button */}
          <button
            onClick={onOpenQR}
            title="Scan QR Code to connect mobile device"
            className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            aria-label="Show QR Code"
          >
            <QrCode className="w-4 h-4" />
          </button>

          {/* Notifications Permission Toggle */}
          {notificationStatus !== 'unsupported' && (
            <button
              onClick={onRequestNotification}
              title={
                notificationStatus === 'granted'
                  ? 'Notifications enabled'
                  : 'Enable background transfer notifications'
              }
              className={`p-2 rounded-lg transition-colors ${
                notificationStatus === 'granted'
                  ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
              aria-label="Transfer notifications"
            >
              {notificationStatus === 'granted' ? (
                <BellRing className="w-4 h-4" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Dark Mode Switch */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Primary Action Button */}
          <button
            onClick={() => setCurrentTab('radar')}
            className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 active:scale-[0.98] rounded-lg shadow-sm shadow-cyan-600/20 transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Send Files</span>
          </button>
        </div>

      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden flex items-center justify-around border-t border-neutral-200 dark:border-neutral-800 py-2 bg-neutral-50/90 dark:bg-neutral-900/90 text-xs">
        <button
          onClick={() => setCurrentTab('transfers')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-md ${
            currentTab === 'transfers'
              ? 'text-cyan-600 dark:text-cyan-400 font-semibold'
              : 'text-neutral-600 dark:text-neutral-400'
          }`}
        >
          <span>Transfers</span>
          {activeTransferCount > 0 && (
            <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400">
              ({activeTransferCount})
            </span>
          )}
        </button>

        <button
          onClick={() => setCurrentTab('radar')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-md ${
            currentTab === 'radar'
              ? 'text-cyan-600 dark:text-cyan-400 font-semibold'
              : 'text-neutral-600 dark:text-neutral-400'
          }`}
        >
          <span>Nearby Radar</span>
        </button>

        {onOpenSpeedOptimizer && (
          <button
            onClick={onOpenSpeedOptimizer}
            className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-md text-cyan-600 dark:text-cyan-400 font-semibold"
          >
            <span>Speed ⚡</span>
          </button>
        )}

        <button
          onClick={onOpenRooms}
          className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-md text-neutral-600 dark:text-neutral-400"
        >
          <span>Rooms</span>
        </button>

        <button
          onClick={onOpenSecurity}
          className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-md text-neutral-600 dark:text-neutral-400"
        >
          <span>Zero-Cache</span>
        </button>
      </div>
    </header>
  );
};
