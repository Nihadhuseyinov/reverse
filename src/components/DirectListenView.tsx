import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  Download,
  Share2,
  RotateCcw,
  Volume2,
  VolumeX,
  Repeat,
  Sparkles,
  ArrowLeft,
  Check,
  Music,
  Headphones,
} from 'lucide-react';
import { AudioTrack } from '../types';
import { formatTime, formatBytes } from '../utils/audioProcessor';

interface DirectListenViewProps {
  trackId: string;
  onReturnToStudio: () => void;
}

export const DirectListenView: React.FC<DirectListenViewProps> = ({
  trackId,
  onReturnToStudio,
}) => {
  const [track, setTrack] = useState<AudioTrack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Playback state
  const [activeMode, setActiveMode] = useState<'reversed' | 'original'>('reversed');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [copied, setCopied] = useState(false);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Fetch track & record QR scan
  useEffect(() => {
    let isMounted = true;
    async function loadTrack() {
      try {
        setLoading(true);
        // Record scan event
        fetch(`/api/tracks/${trackId}/scan`, { method: 'POST' }).catch(() => {});

        const res = await fetch(`/api/tracks/${trackId}`);
        if (!res.ok) {
          throw new Error('Səs faylı tapılmadı və ya silinib.');
        }
        const data = await res.json();
        if (isMounted) {
          setTrack(data.track);
          if (data.track.duration) {
            setDuration(data.track.duration);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Səs faylı yüklənərkən xəta baş verdi');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadTrack();
    return () => {
      isMounted = false;
    };
  }, [trackId]);

  const streamUrl = `/api/audio/${trackId}/stream?type=${activeMode}`;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.error(e));
    }
  };

  const seekTo = (percent: number) => {
    if (!audioRef.current || !duration) return;
    const newTime = percent * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const copyPageUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <Sparkles className="w-8 h-8 text-indigo-400 animate-spin mb-4" />
        <h3 className="text-lg font-semibold text-slate-200">Səs Faylı Yüklənir...</h3>
        <p className="text-xs text-slate-400 mt-1">QR kod məlumatları oxunur və audio hazırlanır</p>
      </div>
    );
  }

  if (error || !track) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
          <Music className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-100">Səs Faylı Tapılmadı</h3>
        <p className="text-xs text-slate-400 mt-2 mb-6">{error || 'Bu səs faylı artıq mövcud deyil.'}</p>
        <button
          onClick={onReturnToStudio}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/25 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>NixReverse Studiyasına Keç</span>
        </button>
      </div>
    );
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  // Fallback procedural waveform peaks
  const peaks = Array.from({ length: 60 }, (_, i) => Math.sin(i * 0.3) * 0.35 + 0.55);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 flex flex-col gap-6">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={streamUrl}
        loop={isLooping}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (d && !isNaN(d)) setDuration(d);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />

      {/* Top Bar / Navigation */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onReturnToStudio}
          className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors py-1.5 px-3 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>NixReverse Studiyası</span>
        </button>

        <button
          onClick={copyPageUrl}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 py-1.5 px-3 rounded-lg transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
          <span>{copied ? 'Kopyalandı' : 'Paylaş'}</span>
        </button>
      </div>

      {/* Hero Track Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-2xl backdrop-blur-md relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-2 shadow-inner">
            <Headphones className="w-8 h-8" />
          </div>
          <span className="text-xs font-mono text-indigo-400 uppercase tracking-wider">
            QR Kodla Açılan Səs
          </span>
          <h2 className="text-2xl font-bold text-slate-100 tracking-tight max-w-lg">
            {track.name}
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-1">
            <span>{formatTime(track.duration)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatBytes(track.reversedSize || track.originalSize)}</span>
            <span aria-hidden="true">·</span>
            <span>{new Date(track.createdAt).toLocaleDateString('az-AZ')}</span>
          </div>
        </div>

        {/* Audio Mode Switcher (Tərsinə Səs vs Orijinal) */}
        <div className="flex items-center justify-center p-1 bg-slate-950 rounded-xl border border-slate-800 max-w-xs mx-auto w-full">
          <button
            onClick={() => {
              if (isPlaying) audioRef.current?.pause();
              setIsPlaying(false);
              setActiveMode('reversed');
            }}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeMode === 'reversed'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tərsinə Səs
          </button>
          <button
            onClick={() => {
              if (isPlaying) audioRef.current?.pause();
              setIsPlaying(false);
              setActiveMode('original');
            }}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
              activeMode === 'original'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Orijinal Səs
          </button>
        </div>

        {/* Interactive Waveform Display */}
        <div
          className="h-24 bg-slate-950/80 rounded-2xl p-3 flex items-center gap-1 cursor-pointer select-none relative border border-slate-800/80 overflow-hidden"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            seekTo(clickX / rect.width);
          }}
        >
          {/* Playhead bar */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none"
            style={{ left: `${progressPct}%` }}
          />

          {/* Bar peaks */}
          <div className="w-full h-full flex items-center justify-between gap-[3px]">
            {peaks.map((peak, idx) => {
              const barPct = (idx / peaks.length) * 100;
              const isPlayed = barPct <= progressPct;
              const height = Math.max(14, peak * 90);

              return (
                <div
                  key={idx}
                  className="flex-1 rounded-full transition-all duration-75"
                  style={{
                    height: `${height}%`,
                    backgroundColor: isPlayed ? (activeMode === 'reversed' ? '#6366f1' : '#10b981') : '#334155',
                    opacity: isPlayed ? 1 : 0.45,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Big Control Strip */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white transition-all transform active:scale-95 shadow-xl ${
                  activeMode === 'reversed'
                    ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                }`}
              >
                {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
              </button>

              <button
                onClick={() => seekTo(0)}
                className="p-3 text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors"
                title="Əvvələ qaytar"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                onClick={() => setIsLooping(!isLooping)}
                className={`p-3 rounded-xl border transition-colors ${
                  isLooping
                    ? 'bg-indigo-950/60 border-indigo-500 text-indigo-400'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Təkrar oxutma"
              >
                <Repeat className="w-5 h-5" />
              </button>
            </div>

            {/* Speed selector */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {[0.5, 1, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  onClick={() => {
                    setPlaybackRate(rate);
                    if (audioRef.current) audioRef.current.playbackRate = rate;
                  }}
                  className={`px-2.5 py-1 text-xs font-mono rounded-lg transition-colors ${
                    playbackRate === rate
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (audioRef.current) {
                    if (isMuted) {
                      audioRef.current.volume = volume;
                      setIsMuted(false);
                    } else {
                      audioRef.current.volume = 0;
                      setIsMuted(true);
                    }
                  }
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  setIsMuted(val === 0);
                  if (audioRef.current) audioRef.current.volume = val;
                }}
                className="w-20 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Download Buttons Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-800">
          <a
            href={`/api/audio/${track.id}/download?type=reversed`}
            className="py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Tərsinə Səsi Yüklə (WAV)</span>
          </a>

          <a
            href={`/api/audio/${track.id}/download?type=zip`}
            className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-medium text-xs rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Download className="w-4 h-4 text-purple-400" />
            <span>ZIP Paket Yüklə (Tam Arxiv)</span>
          </a>
        </div>
      </div>
    </div>
  );
};
