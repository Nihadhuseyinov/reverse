import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Sparkles,
  Download,
  Share2,
  FileArchive,
  Volume2,
  Layers,
  ArrowRight,
  ShieldCheck,
  Lock,
  Headphones,
  Info,
} from 'lucide-react';
import { AudioUploader } from './components/AudioUploader';
import { WaveformPlayer } from './components/WaveformPlayer';
import { QRCodeDesigner } from './components/QRCodeDesigner';
import { AdminPanel } from './components/AdminPanel';
import { DirectListenView } from './components/DirectListenView';
import { AudioTrack } from './types';
import { formatTime, formatBytes } from './utils/audioProcessor';

export default function App() {
  // Check for direct QR scan url param: e.g. ?track=nix_123
  const [directTrackId, setDirectTrackId] = useState<string | null>(null);

  // Active processed track state
  const [activeTrack, setActiveTrack] = useState<AudioTrack | null>(null);
  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(null);
  const [reversedBuffer, setReversedBuffer] = useState<AudioBuffer | null>(null);
  const [originalPeaks, setOriginalPeaks] = useState<number[]>([]);
  const [reversedPeaks, setReversedPeaks] = useState<number[]>([]);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [reversedUrl, setReversedUrl] = useState<string | null>(null);

  // Active sub-tab in studio
  const [activeTab, setActiveTab] = useState<'studio' | 'qr'>('studio');

  // Secret Admin modal state
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  useEffect(() => {
    // Check URL parameters on mount
    const params = new URLSearchParams(window.location.search);
    const trackParam = params.get('track');
    if (trackParam) {
      setDirectTrackId(trackParam);
    }

    // Keyboard shortcut for secret admin: Ctrl + Shift + A
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setIsAdminOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleProcessedAudio = (data: {
    track: AudioTrack;
    originalBuffer: AudioBuffer;
    reversedBuffer: AudioBuffer;
    originalPeaks: number[];
    reversedPeaks: number[];
    originalUrl: string;
    reversedUrl: string;
    reversedBlob: Blob;
  }) => {
    setActiveTrack(data.track);
    setOriginalBuffer(data.originalBuffer);
    setReversedBuffer(data.reversedBuffer);
    setOriginalPeaks(data.originalPeaks);
    setReversedPeaks(data.reversedPeaks);
    setOriginalUrl(data.originalUrl);
    setReversedUrl(data.reversedUrl);
    setActiveTab('studio');
  };

  const handleReset = () => {
    setActiveTrack(null);
    setOriginalBuffer(null);
    setReversedBuffer(null);
    setOriginalPeaks([]);
    setReversedPeaks([]);
    setOriginalUrl(null);
    setReversedUrl(null);
    setActiveTab('studio');
  };

  // If viewing via QR direct scan link
  if (directTrackId) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500/30">
        <DirectListenView
          trackId={directTrackId}
          onReturnToStudio={() => {
            // Remove query parameter without reload
            window.history.pushState({}, '', window.location.pathname);
            setDirectTrackId(null);
          }}
        />
        <AdminPanel isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500/30">
      {/* 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 lg:px-12 py-4 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="/"
          onClick={(e) => {
            if (activeTrack) {
              e.preventDefault();
              handleReset();
            }
          }}
          className="text-xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-2"
        >
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <RotateCcw className="w-4 h-4" />
          </div>
          <span>NixReverse</span>
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
          <button
            onClick={() => setActiveTab('studio')}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'studio' ? 'text-white' : 'hover:text-slate-200'
            }`}
          >
            Səs Studiyası
          </button>
          <button
            onClick={() => activeTrack && setActiveTab('qr')}
            disabled={!activeTrack}
            className={`transition-colors whitespace-nowrap shrink-0 ${
              !activeTrack
                ? 'opacity-40 cursor-not-allowed'
                : activeTab === 'qr'
                ? 'text-white'
                : 'hover:text-slate-200'
            }`}
          >
            QR Kod Dizayneri
          </button>
          <a
            href="#info"
            className="hover:text-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            İmkanlar & Formatlar
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          {activeTrack ? (
            <button
              onClick={handleReset}
              className="px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all whitespace-nowrap shrink-0 shadow-sm"
            >
              Yeni Səs Yüklə
            </button>
          ) : (
            <span className="text-xs font-mono text-slate-400 hidden sm:inline">
              Bütün formatlar dəstəklənir
            </span>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {!activeTrack ? (
          /* Step 1: Landing & Upload View */
          <div className="flex flex-col gap-10">
            {/* Hero Section */}
            <div className="flex flex-col items-center text-center max-w-3xl mx-auto gap-4 pt-4">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-indigo-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Professional Audio Tərsinə Çevirmə Mühərriki</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white max-w-2xl text-balance">
                İstənilən səs faylını dərhal <span className="text-indigo-400">tərsinə çevirin</span>
              </h1>

              <p className="text-sm sm:text-base text-slate-400 max-w-xl text-balance leading-relaxed">
                MP3, WAV, AAC, FLAC, M4A, OGG və digər bütün formatlar üçün 1 saatdan uzun səs fayllarını
                yüksək dəqiqliklə tərsinə çevirin, fərdiləşdirilmiş QR kod yaradın və birbaşa paylaşın.
              </p>
            </div>

            {/* Uploader Component */}
            <AudioUploader onProcessed={handleProcessedAudio} />

            {/* Capability Feature Strip */}
            <div id="info" className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
              <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-2">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/15 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-1">
                  <Volume2 className="w-4 h-4" />
                </div>
                <h4 className="font-semibold text-slate-200 text-sm">Bütün Formatlar & Uzun Səslər</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  MP3, WAV, AAC, OGG, FLAC, M4A, WMA, AIFF, OPUS dəstəyi. 10 dəqiqədən uzun, hətta 1 saatlıq səs faylları rahatlıqla emal olunur.
                </p>
              </div>

              <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-2">
                <div className="w-9 h-9 rounded-xl bg-purple-600/15 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-1">
                  <Layers className="w-4 h-4" />
                </div>
                <h4 className="font-semibold text-slate-200 text-sm">Real-Time Web Audio</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  32-bit float audio kanalları sıfır keyfiyyət itkisi ilə tərsinə çevrilir. İnteraktiv dalğa qrafiki və sürət tənzimləyicisi ilə dinləyin.
                </p>
              </div>

              <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 flex flex-col gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-600/15 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-1">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="font-semibold text-slate-200 text-sm">QR Kod & Dizayn Studiyası</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Oxunduğu zaman birbaşa səsi açan QR kodlar. Rənglər, loqolar seçin və hazır PNG və ya çap üçün PDF kimi yükləyin.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Step 2: Audio Workspace (Reversed Player, Comparison, & QR Designer) */
          <div className="flex flex-col gap-6">
            {/* Top Workspace Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm md:text-base">{activeTrack.name}</h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <span>Müddət: {formatTime(activeTrack.duration)}</span>
                    <span aria-hidden="true">·</span>
                    <span>Həcm: {formatBytes(activeTrack.reversedSize || activeTrack.originalSize)}</span>
                  </div>
                </div>
              </div>

              {/* Tab Navigation & ZIP Download */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setActiveTab('studio')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      activeTab === 'studio'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Səs Studiyası
                  </button>
                  <button
                    onClick={() => setActiveTab('qr')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      activeTab === 'qr'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    QR Kod Dizaynı
                  </button>
                </div>

                <a
                  href={`/api/audio/${activeTrack.id}/download?type=zip`}
                  className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors flex items-center gap-1.5"
                  title="Orijinal və Tərsinə səsləri ZIP paketində yüklə"
                >
                  <FileArchive className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">ZIP Paket</span>
                </a>
              </div>
            </div>

            {/* Sub-view: Audio Studio Player vs QR Designer */}
            {activeTab === 'studio' ? (
              <div className="flex flex-col gap-6">
                {/* 1. Primary: Reversed Audio Player */}
                <WaveformPlayer
                  title="Tərsinə Çevrilmiş Səs (Reversed)"
                  badgeText="Yüksək Keyfiyyətli WAV"
                  audioBuffer={reversedBuffer}
                  audioUrl={reversedUrl}
                  peaks={reversedPeaks}
                  accentColor="#6366f1"
                  onDownload={() => {
                    window.location.href = `/api/audio/${activeTrack.id}/download?type=reversed`;
                  }}
                  downloadLabel="WAV Yüklə"
                />

                {/* 2. Secondary: Original Audio Player for comparison */}
                <WaveformPlayer
                  title="Orijinal Səs (Original)"
                  badgeText={activeTrack.originalFileName}
                  audioBuffer={originalBuffer}
                  audioUrl={originalUrl}
                  peaks={originalPeaks}
                  accentColor="#10b981"
                  onDownload={() => {
                    window.location.href = `/api/audio/${activeTrack.id}/download?type=original`;
                  }}
                  downloadLabel="Orijinalı Yüklə"
                />

                {/* Action card leading to QR Designer */}
                <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900 border border-indigo-500/20 rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <h4 className="font-bold text-slate-100 text-sm md:text-base">
                      Bu səs üçün avtomatik QR kod hazırdır
                    </h4>
                    <p className="text-xs text-slate-400">
                      Rənglərini fərdiləşdirin, loqo əlavə edin və birbaşa dinlənilə bilən QR kod yükləyin.
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveTab('qr')}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/25 flex items-center gap-2 active:scale-95"
                  >
                    <span>QR Kod Dizaynerinə Keç</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* QR Code Designer Sub-view */
              <QRCodeDesigner track={activeTrack} />
            )}
          </div>
        )}
      </main>

      {/* Footer with Invisible / Discreet Admin Entry */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 px-6 lg:px-12 py-6 text-xs text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">NixReverse</span>
            <span>· Professional Audio Reverser & QR Studio</span>
          </div>

          <div className="flex items-center gap-4">
            <span>Bütün hüquqlar qorunur © {new Date().getFullYear()}</span>

            {/* Discreet / Invisible Admin Entry Button */}
            <button
              onClick={() => setIsAdminOpen(true)}
              className="p-1 text-slate-600 hover:text-slate-400 transition-colors opacity-30 hover:opacity-100 focus:opacity-100 rounded"
              title="Sistem İdarəetmə Girişi"
              aria-label="Admin Girişi"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </footer>

      {/* Secret Admin Panel Modal */}
      <AdminPanel isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} />
    </div>
  );
}
