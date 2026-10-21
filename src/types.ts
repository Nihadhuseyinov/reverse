export interface AudioTrack {
  id: string;
  name: string;
  originalFileName: string;
  originalFilePath: string;
  reversedFilePath?: string;
  originalSize: number;
  reversedSize?: number;
  mimeType: string;
  duration: number; // in seconds
  createdAt: string;
  scanCount: number;
  downloadCount: number;
}

export interface QRDesignConfig {
  fgColor: string;
  bgColor: string;
  size: number;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  margin: number;
  logoType: 'none' | 'nix' | 'reverse' | 'waveform' | 'music' | 'custom';
  customLogoUrl: string | null;
  logoSizePercent: number; // 10% - 30%
  centerBadgeShape: 'circle' | 'rounded' | 'square';
  centerBadgeColor: string;
}

export interface AdminStats {
  totalTracks: number;
  totalDuration: number;
  totalStorageBytes: number;
  totalScans: number;
  totalDownloads: number;
}

export type ProcessingStep =
  | 'idle'
  | 'reading'
  | 'decoding'
  | 'reversing'
  | 'encoding'
  | 'uploading'
  | 'completed'
  | 'error';
