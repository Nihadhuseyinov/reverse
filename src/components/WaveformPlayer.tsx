import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, FastForward, Repeat } from 'lucide-react';
import { formatTime } from '../utils/audioProcessor';

interface WaveformPlayerProps {
  title: string;
  badgeText?: string;
  audioBuffer?: AudioBuffer | null;
  audioUrl?: string | null;
  peaks?: number[];
  accentColor?: string; // e.g. '#6366f1' or '#10b981'
  onDownload?: () => void;
  downloadLabel?: string;
}

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({
  title,
  badgeText,
  audioBuffer,
  audioUrl,
  peaks = [],
  accentColor = '#6366f1',
  onDownload,
  downloadLabel = 'Yüklə',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  // If audioBuffer is provided but no audioUrl, create object URL
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (audioUrl) {
      setBlobUrl(audioUrl);
    }
  }, [audioUrl]);

  // Handle duration from buffer or audio element
  useEffect(() => {
    if (audioBuffer) {
      setDuration(audioBuffer.duration);
    }
  }, [audioBuffer]);

  const activeSrc = audioUrl || blobUrl;

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !activeSrc) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.error('Audio play error:', err));
    }
  }, [isPlaying, activeSrc]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (!duration && audioRef.current.duration) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const seekTo = (percent: number) => {
    if (!audioRef.current || !duration) return;
    const newTime = Math.max(0, Math.min(duration, percent * duration));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    setIsMuted(v === 0);
    if (audioRef.current) {
      audioRef.current.volume = v;
    }
  };

  // Generate fallback peaks if empty
  const displayPeaks = peaks.length > 0 ? peaks : Array.from({ length: 80 }, (_, i) => Math.sin(i * 0.2) * 0.4 + 0.5);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-xl backdrop-blur-md">
      {/* Hidden audio element */}
      {activeSrc && (
        <audio
          ref={audioRef}
          src={activeSrc}
          loop={isLooping}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onLoadedMetadata={(e) => {
            const target = e.currentTarget;
            if (target.duration && !isNaN(target.duration)) {
              setDuration(target.duration);
            }
          }}
        />
      )}

      {/* Header zone */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: accentColor }}
          />
          <h3 className="font-semibold text-slate-100 text-sm md:text-base truncate">{title}</h3>
          {badgeText && (
            <span className="text-xs text-slate-400 font-mono shrink-0">
              · {badgeText}
            </span>
          )}
        </div>

        {onDownload && (
          <button
            onClick={onDownload}
            className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <span>{downloadLabel}</span>
          </button>
        )}
      </div>

      {/* Waveform Bar Canvas / Interactive Scrubber */}
      <div
        className="relative h-20 bg-slate-950/80 rounded-xl p-2.5 flex items-center gap-1 cursor-pointer select-none group border border-slate-800/80 overflow-hidden"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const pct = clickX / rect.width;
          seekTo(pct);
        }}
      >
        {/* Animated playback line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white z-20 shadow-md transition-all pointer-events-none"
          style={{ left: `${progressPct}%` }}
        />

        {/* Waveform Bars */}
        <div className="w-full h-full flex items-center justify-between gap-[2px]">
          {displayPeaks.map((peak, idx) => {
            const barPct = (idx / displayPeaks.length) * 100;
            const isPlayed = barPct <= progressPct;
            const heightPct = Math.max(12, Math.min(100, peak * 100));

            return (
              <div
                key={idx}
                className="flex-1 rounded-full transition-all duration-75"
                style={{
                  height: `${heightPct}%`,
                  backgroundColor: isPlayed ? accentColor : '#334155',
                  opacity: isPlayed ? 1 : 0.45,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Play / Pause & Rewind */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            disabled={!activeSrc}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-all transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
            style={{ backgroundColor: accentColor }}
            title={isPlaying ? 'Dayandır' : 'Oynat'}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          <button
            onClick={() => seekTo(0)}
            className="p-2 text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-800"
            title="Əvvələ qaytar"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`p-2 rounded-lg transition-colors ${
              isLooping ? 'text-indigo-400 bg-indigo-950/60' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="Təkrar oxutma"
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Time display (tabular numbers) */}
        <div className="text-xs font-mono tabular-nums text-slate-400 tracking-tight">
          <span className="text-slate-200 font-semibold">{formatTime(currentTime)}</span>
          <span className="mx-1">/</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Playback speed buttons */}
        <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800/80">
          {[0.5, 1, 1.5, 2].map((rate) => (
            <button
              key={rate}
              onClick={() => handleRateChange(rate)}
              className={`px-2 py-0.5 text-xs font-mono rounded transition-colors ${
                playbackRate === rate
                  ? 'bg-indigo-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>

        {/* Volume control */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-16 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
