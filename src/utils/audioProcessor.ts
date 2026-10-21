import { ProcessingStep } from '../types';

let audioCtxInstance: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioCtxInstance) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtxInstance = new AudioContextClass();
  }
  if (audioCtxInstance.state === 'suspended') {
    audioCtxInstance.resume();
  }
  return audioCtxInstance;
}

/**
 * Encodes an AudioBuffer into a WAV Blob (16-bit PCM RIFF)
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const numSamples = buffer.length;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // Write RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // Write fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // Write data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channel samples & clamp to 16-bit PCM
  let offset = 44;
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channels[ch][i];
      // Clamp between -1 and 1
      sample = Math.max(-1, Math.min(1, sample));
      // Scale to 16-bit signed integer
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Extract normalized peaks for waveform rendering
 */
export function extractPeaks(buffer: AudioBuffer, numPeaks = 120): number[] {
  const peaks: number[] = [];
  const channelData = buffer.getChannelData(0);
  const totalLength = channelData.length;
  const step = Math.max(1, Math.floor(totalLength / numPeaks));

  for (let i = 0; i < numPeaks; i++) {
    const start = i * step;
    const end = Math.min(start + step, totalLength);
    let max = 0;
    for (let j = start; j < end; j += 10) {
      const val = Math.abs(channelData[j]);
      if (val > max) max = val;
    }
    peaks.push(Math.min(1, Math.max(0.08, max)));
  }

  return peaks;
}

/**
 * Reverses an AudioBuffer and creates an independent clone
 */
export function reverseAudioBuffer(ctx: AudioContext, originalBuffer: AudioBuffer): AudioBuffer {
  const numChannels = originalBuffer.numberOfChannels;
  const length = originalBuffer.length;
  const sampleRate = originalBuffer.sampleRate;

  const reversedBuffer = ctx.createBuffer(numChannels, length, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const origData = originalBuffer.getChannelData(ch);
    const revData = reversedBuffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      revData[i] = origData[length - 1 - i];
    }
  }

  return reversedBuffer;
}

/**
 * Complete processor that reads, decodes, reverses, and encodes an audio file
 */
export async function processAudioFile(
  file: File | Blob,
  onProgress?: (step: ProcessingStep, pct: number, label: string) => void
): Promise<{
  originalBuffer: AudioBuffer;
  reversedBuffer: AudioBuffer;
  originalPeaks: number[];
  reversedPeaks: number[];
  reversedBlob: Blob;
  duration: number;
}> {
  const ctx = getAudioContext();

  onProgress?.('reading', 15, 'Səs faylı oxunur...');
  const arrayBuffer = await file.arrayBuffer();

  onProgress?.('decoding', 40, 'Audio dalğaları deşifrə edilir...');
  // decodeAudioData returns an AudioBuffer
  const originalBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

  onProgress?.('reversing', 70, 'Səs tərsinə çevrilir...');
  const reversedBuffer = reverseAudioBuffer(ctx, originalBuffer);

  onProgress?.('encoding', 85, 'Yüksək keyfiyyətli WAV hazırlanır...');
  const reversedBlob = audioBufferToWav(reversedBuffer);

  const originalPeaks = extractPeaks(originalBuffer);
  const reversedPeaks = extractPeaks(reversedBuffer);

  onProgress?.('completed', 100, 'Tamamlandı!');

  return {
    originalBuffer,
    reversedBuffer,
    originalPeaks,
    reversedPeaks,
    reversedBlob,
    duration: originalBuffer.duration,
  };
}

/**
 * Format seconds into HH:MM:SS or MM:SS
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Format bytes into human-readable size
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
