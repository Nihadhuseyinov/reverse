import React, { useState, useRef, useCallback } from 'react';
import { Upload, Mic, MicOff, Music, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { processAudioFile, formatBytes, formatTime } from '../utils/audioProcessor';
import { AudioTrack, ProcessingStep } from '../types';

interface AudioUploaderProps {
  onProcessed: (data: {
    track: AudioTrack;
    originalBuffer: AudioBuffer;
    reversedBuffer: AudioBuffer;
    originalPeaks: number[];
    reversedPeaks: number[];
    originalUrl: string;
    reversedUrl: string;
    reversedBlob: Blob;
  }) => void;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({ onProcessed }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('idle');
  const [progressPercent, setProgressPercent] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Microphone recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleSelectedFile(e.target.files[0]);
    }
  };

  const handleSelectedFile = async (file: File) => {
    setErrorMessage(null);
    setIsProcessing(true);
    setProgressPercent(5);
    setStatusMessage('Səs faylı qəbul olunur...');

    try {
      // 1. Process client-side via Web Audio API
      const result = await processAudioFile(file, (step, pct, label) => {
        setProcessingStep(step);
        setProgressPercent(pct);
        setStatusMessage(label);
      });

      setStatusMessage('Serverə sinxronlaşdırılır...');
      setProgressPercent(90);

      // 2. Upload original to server
      const uploadFormData = new FormData();
      uploadFormData.append('audio', file);
      uploadFormData.append('title', file.name.replace(/\.[^/.]+$/, ''));
      uploadFormData.append('duration', result.duration.toString());

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!uploadRes.ok) {
        throw new Error('Serverə yükləmə zamanı xəta baş verdi');
      }

      const uploadJson = await uploadRes.json();
      const serverTrack: AudioTrack = uploadJson.track;

      // 3. Upload reversed WAV to server
      const reversedFormData = new FormData();
      reversedFormData.append('reversedAudio', result.reversedBlob, `${serverTrack.name}_reversed.wav`);
      reversedFormData.append('trackId', serverTrack.id);
      reversedFormData.append('duration', result.duration.toString());

      const revRes = await fetch('/api/save-reversed', {
        method: 'POST',
        body: reversedFormData,
      });

      if (!revRes.ok) {
        throw new Error('Tərsinə çevrilmiş səs qeyd olunarkən xəta baş verdi');
      }

      const revJson = await revRes.json();
      const finalTrack: AudioTrack = revJson.track || serverTrack;

      setProgressPercent(100);
      setStatusMessage('Hazırdır!');

      // Create streamable URLs
      const originalUrl = `/api/audio/${finalTrack.id}/stream?type=original`;
      const reversedUrl = `/api/audio/${finalTrack.id}/stream?type=reversed`;

      onProcessed({
        track: finalTrack,
        originalBuffer: result.originalBuffer,
        reversedBuffer: result.reversedBuffer,
        originalPeaks: result.originalPeaks,
        reversedPeaks: result.reversedPeaks,
        originalUrl,
        reversedUrl,
        reversedBlob: result.reversedBlob,
      });
    } catch (err) {
      console.error('Processing error:', err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Səs faylı emal edilərkən xəta baş verdi. Zəhmət olmasa başqa formatda yoxlayın.'
      );
      setProcessingStep('error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Live microphone recorder
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const recordedFile = new File([audioBlob], `Ses_Yazisi_${Date.now()}.webm`, {
          type: 'audio/webm',
        });
        stream.getTracks().forEach((track) => track.stop());
        handleSelectedFile(recordedFile);
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      setErrorMessage('Mikrofona giriş icazəsi verilmədi. Zəhmət olmasa brauzer tənzimləmələrini yoxlayın.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Drag & Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-3xl p-8 md:p-12 text-center transition-all cursor-pointer select-none overflow-hidden group ${
          isDragging
            ? 'border-indigo-400 bg-indigo-950/30 scale-[1.01]'
            : 'border-slate-800 hover:border-indigo-500/50 bg-slate-900/60 hover:bg-slate-900/90'
        } ${isProcessing ? 'pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*, .mp3, .wav, .aac, .ogg, .flac, .m4a, .wma, .aiff, .opus, .webm"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={isProcessing}
        />

        {/* Ambient background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 group-hover:text-indigo-300 transition-all shadow-inner">
            <Upload className="w-7 h-7" />
          </div>

          <div className="flex flex-col gap-1 max-w-md">
            <h3 className="text-lg md:text-xl font-bold text-slate-100 tracking-tight">
              Səs faylını buraya sürükləyin və ya seçin
            </h3>
            <p className="text-sm text-slate-400">
              MP3, WAV, AAC, OGG, FLAC, M4A, WMA, AIFF, OPUS dəstəklənir
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span>Maksimum 500 MB</span>
            <span aria-hidden="true">·</span>
            <span>1 saatdan çox səs faylları</span>
            <span aria-hidden="true">·</span>
            <span className="text-indigo-400">Yüksək Dəqiqlik</span>
          </div>

          <div className="pt-2">
            <button
              type="button"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/25 active:scale-95"
            >
              Kompüterdən Səs Seçin
            </button>
          </div>
        </div>
      </div>

      {/* Alternative: Live Voice Recording Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-300">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-200">Canlı Mikrofon Yazılışı</h4>
            <p className="text-xs text-slate-400">
              Öz səsinizi yazın və dərhal tərsinə çevirib qulaq asın
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-950/60 border border-red-800/80 rounded-lg text-red-400 text-xs font-mono tabular-nums">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>{formatTime(recordingSeconds)}</span>
            </div>
          )}

          {!isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              disabled={isProcessing}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-medium transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <Mic className="w-4 h-4 text-rose-400" />
              <span>Yazmağa Başla</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl text-xs transition-all flex items-center gap-2 shadow-lg shadow-red-600/30 active:scale-95"
            >
              <MicOff className="w-4 h-4" />
              <span>Dayandır və Çevir</span>
            </button>
          )}
        </div>
      </div>

      {/* Processing Progress Status */}
      {isProcessing && (
        <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-5 flex flex-col gap-3 shadow-2xl">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-indigo-300 font-medium">
              <Sparkles className="w-4 h-4 animate-spin text-indigo-400" />
              <span>{statusMessage}</span>
            </div>
            <span className="font-mono tabular-nums text-slate-400">{progressPercent}%</span>
          </div>

          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-400 h-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Web Audio 32-bit Float Emalı</span>
            <span>Tərsinə Çevirmə Alqoritmi</span>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-2xl flex items-start gap-3 text-red-200 text-xs">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">{errorMessage}</div>
        </div>
      )}
    </div>
  );
};
