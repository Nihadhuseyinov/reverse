import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import {
  Download,
  Copy,
  Check,
  ExternalLink,
  Sliders,
  Palette,
  Image as ImageIcon,
  Sparkles,
  FileText,
  RotateCcw,
  Music,
  Share2,
} from 'lucide-react';
import { AudioTrack, QRDesignConfig } from '../types';
import { formatTime } from '../utils/audioProcessor';

interface QRCodeDesignerProps {
  track: AudioTrack;
}

const COLOR_PRESETS = [
  { name: 'Klassik Ağ-Qara', fg: '#000000', bg: '#ffffff' },
  { name: 'Gecə İndiqosu', fg: '#6366f1', bg: '#0b0f19' },
  { name: 'Kiber Zümrüd', fg: '#10b981', bg: '#051811' },
  { name: 'Qızılı Parıltı', fg: '#f59e0b', bg: '#171206' },
  { name: 'Neon Qırmızı', fg: '#f43f5e', bg: '#1c070c' },
  { name: 'Bənövşəyi Dalğa', fg: '#a855f7', bg: '#130924' },
  { name: 'Polad Boz', fg: '#cbd5e1', bg: '#0f172a' },
];

export const QRCodeDesigner: React.FC<QRCodeDesignerProps> = ({ track }) => {
  const [config, setConfig] = useState<QRDesignConfig>({
    fgColor: '#6366f1',
    bgColor: '#0b0f19',
    size: 380,
    errorCorrectionLevel: 'H',
    margin: 2,
    logoType: 'nix',
    customLogoUrl: null,
    logoSizePercent: 22,
    centerBadgeShape: 'rounded',
    centerBadgeColor: '#0b0f19',
  });

  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Generate target playback link
  const listenUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?track=${track.id}`
    : `https://nixreverse.com/?track=${track.id}`;

  // Draw the QR code with custom colors, margins, and center logo
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    QRCode.toCanvas(
      canvas,
      listenUrl,
      {
        width: config.size,
        margin: config.margin,
        color: {
          dark: config.fgColor,
          light: config.bgColor,
        },
        errorCorrectionLevel: config.errorCorrectionLevel,
      },
      (err) => {
        if (err) {
          console.error('QR render error:', err);
          return;
        }

        // Draw center logo if enabled
        if (config.logoType !== 'none') {
          drawCenterLogo(canvas);
        }
      }
    );
  }, [config, listenUrl]);

  const drawCenterLogo = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const logoSize = Math.floor(canvasWidth * (config.logoSizePercent / 100));
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const badgePadding = 8;
    const badgeSize = logoSize + badgePadding * 2;

    // Draw center badge background
    ctx.save();
    ctx.fillStyle = config.bgColor;
    ctx.strokeStyle = config.fgColor;
    ctx.lineWidth = 2;

    const badgeX = centerX - badgeSize / 2;
    const badgeY = centerY - badgeSize / 2;

    if (config.centerBadgeShape === 'circle') {
      ctx.beginPath();
      ctx.arc(centerX, centerY, badgeSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      const radius = config.centerBadgeShape === 'rounded' ? 12 : 2;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeSize, badgeSize, radius);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // Render chosen logo
    if (config.logoType === 'custom' && config.customLogoUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.save();
        if (config.centerBadgeShape === 'circle') {
          ctx.beginPath();
          ctx.arc(centerX, centerY, logoSize / 2, 0, Math.PI * 2);
          ctx.clip();
        }
        ctx.drawImage(img, centerX - logoSize / 2, centerY - logoSize / 2, logoSize, logoSize);
        ctx.restore();
      };
      img.src = config.customLogoUrl;
    } else {
      // Draw procedural high-res vector logos
      ctx.save();
      ctx.fillStyle = config.fgColor;
      ctx.strokeStyle = config.fgColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (config.logoType === 'nix') {
        // Monogram "NIX" / Reverse Emblem
        ctx.font = `bold ${Math.floor(logoSize * 0.45)}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('NIX', centerX, centerY);
      } else if (config.logoType === 'reverse') {
        // Reverse arrows
        const r = logoSize * 0.35;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, Math.PI * 0.2, Math.PI * 1.8);
        ctx.stroke();

        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(centerX + r - 5, centerY - 6);
        ctx.lineTo(centerX + r, centerY);
        ctx.lineTo(centerX + r + 5, centerY - 6);
        ctx.stroke();
      } else if (config.logoType === 'waveform') {
        // Sound wave bars
        const barCount = 5;
        const totalW = logoSize * 0.7;
        const barW = totalW / (barCount * 1.6);
        const heights = [0.4, 0.8, 1.0, 0.7, 0.3];
        const startX = centerX - totalW / 2;

        for (let i = 0; i < barCount; i++) {
          const bx = startX + i * barW * 1.6;
          const bh = logoSize * 0.7 * heights[i];
          const by = centerY - bh / 2;
          ctx.fillRect(bx, by, barW, bh);
        }
      } else if (config.logoType === 'music') {
        // Music Note symbol
        ctx.font = `${Math.floor(logoSize * 0.7)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♫', centerX, centerY);
      }
      ctx.restore();
    }
  };

  const handleCustomLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setConfig((prev) => ({
            ...prev,
            logoType: 'custom',
            customLogoUrl: event.target?.result as string,
            errorCorrectionLevel: 'H',
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const copyListenUrl = () => {
    navigator.clipboard.writeText(listenUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export full design card as high-res PNG
  const downloadPNG = () => {
    const qrCanvas = canvasRef.current;
    if (!qrCanvas) return;

    // Create a master export card canvas
    const cardCanvas = document.createElement('canvas');
    const padding = 40;
    const headerHeight = 110;
    const footerHeight = 70;
    cardCanvas.width = qrCanvas.width + padding * 2;
    cardCanvas.height = qrCanvas.height + headerHeight + footerHeight;

    const ctx = cardCanvas.getContext('2d');
    if (!ctx) return;

    // Card background
    ctx.fillStyle = config.bgColor;
    ctx.fillRect(0, 0, cardCanvas.width, cardCanvas.height);

    // Subtle outer border
    ctx.strokeStyle = config.fgColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.25;
    ctx.strokeRect(10, 10, cardCanvas.width - 20, cardCanvas.height - 20);
    ctx.globalAlpha = 1.0;

    // Brand and track title in header
    ctx.fillStyle = config.fgColor;
    ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NIXREVERSE AUDIO', cardCanvas.width / 2, 45);

    ctx.fillStyle = config.fgColor;
    ctx.globalAlpha = 0.8;
    ctx.font = '500 15px "Plus Jakarta Sans", sans-serif';
    const truncatedTitle = track.name.length > 32 ? track.name.substring(0, 30) + '...' : track.name;
    ctx.fillText(`« ${truncatedTitle} (Tərsinə) »`, cardCanvas.width / 2, 75);

    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText(`Müddət: ${formatTime(track.duration)} · Dinləmək üçün oxudun`, cardCanvas.width / 2, 98);
    ctx.globalAlpha = 1.0;

    // Draw the QR canvas in center
    ctx.drawImage(qrCanvas, padding, headerHeight);

    // Card footer
    ctx.fillStyle = config.fgColor;
    ctx.globalAlpha = 0.6;
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText('nixreverse.studio · Scan & Listen Directly', cardCanvas.width / 2, cardCanvas.height - 30);
    ctx.globalAlpha = 1.0;

    // Download trigger
    const link = document.createElement('a');
    link.download = `${track.name}_NixReverse_QR.png`;
    link.href = cardCanvas.toDataURL('image/png');
    link.click();
  };

  // Export as formatted printable PDF using jsPDF
  const downloadPDF = () => {
    setIsExporting(true);
    try {
      const qrCanvas = canvasRef.current;
      if (!qrCanvas) return;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a5', // A5 card format
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Background color
      pdf.setFillColor(config.bgColor === '#ffffff' ? '#ffffff' : '#0f172a');
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');

      // Title & Header text
      pdf.setTextColor(config.bgColor === '#ffffff' ? '#0f172a' : '#f8fafc');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text('NixReverse Audio Card', pageWidth / 2, 25, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(config.bgColor === '#ffffff' ? '#475569' : '#94a3b8');
      const cleanTrackName = track.name.length > 40 ? track.name.substring(0, 37) + '...' : track.name;
      pdf.text(`Səs faylı: ${cleanTrackName}`, pageWidth / 2, 33, { align: 'center' });
      pdf.text(`Müddət: ${formatTime(track.duration)} · Format: WAV/MP3`, pageWidth / 2, 39, { align: 'center' });

      // Embed QR Code image
      const qrDataUrl = qrCanvas.toDataURL('image/png');
      const qrDisplaySize = 80; // 80mm
      const qrX = (pageWidth - qrDisplaySize) / 2;
      const qrY = 48;
      pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrDisplaySize, qrDisplaySize);

      // Call to action / instruction
      pdf.setFontSize(10);
      pdf.setTextColor(config.bgColor === '#ffffff' ? '#2563eb' : '#818cf8');
      pdf.text('Kameranızı QR koda tutaraq səsi birbaşa dinləyin', pageWidth / 2, 140, { align: 'center' });

      pdf.setFontSize(8);
      pdf.setTextColor(config.bgColor === '#ffffff' ? '#94a3b8' : '#64748b');
      pdf.text(listenUrl, pageWidth / 2, 147, { align: 'center' });

      pdf.save(`${track.name}_NixReverse_QR.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-2xl backdrop-blur-md">
      {/* Top heading */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <span>QR Kod Dizayn Studiyası</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Tərsinə çevrilmiş səs üçün unikal rəng və logolu QR kod hazırlayın
          </p>
        </div>

        {/* Direct Link Share Pill */}
        <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 max-w-sm">
          <span className="text-xs font-mono text-slate-400 truncate select-all">{listenUrl}</span>
          <button
            onClick={copyListenUrl}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            title="Linki kopyala"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <a
            href={listenUrl}
            target="_blank"
            rel="noreferrer"
            className="p-1 text-slate-400 hover:text-white transition-colors"
            title="Birbaşa dinləmə səhifəsini aç"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: QR Code Live Preview */}
        <div className="lg:col-span-5 flex flex-col items-center gap-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6">
          <div
            className="p-4 rounded-2xl shadow-2xl transition-all flex items-center justify-center border border-slate-800"
            style={{ backgroundColor: config.bgColor }}
          >
            <canvas ref={canvasRef} className="max-w-full h-auto rounded-lg shadow-sm" />
          </div>

          <div className="text-center">
            <span className="text-xs font-mono text-slate-400">
              Oxunduğu halda birbaşa səs pleyeri açılır
            </span>
          </div>

          {/* Export Buttons */}
          <div className="w-full grid grid-cols-2 gap-2.5 pt-2">
            <button
              onClick={downloadPNG}
              className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>PNG Kart Yüklə</span>
            </button>

            <button
              onClick={downloadPDF}
              disabled={isExporting}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-medium text-xs rounded-xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <FileText className="w-4 h-4 text-rose-400" />
              <span>PDF Çap Yüklə</span>
            </button>
          </div>
        </div>

        {/* Right Column: Customizer Controls */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* 1. Color Presets */}
          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-indigo-400" />
              <span>Rəng Presetləri</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      fgColor: preset.fg,
                      bgColor: preset.bg,
                      centerBadgeColor: preset.bg,
                    }))
                  }
                  className={`p-2 rounded-xl border text-left text-xs transition-all flex items-center gap-2 ${
                    config.fgColor === preset.fg && config.bgColor === preset.bg
                      ? 'border-indigo-500 bg-indigo-950/40 text-white'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center -space-x-1 shrink-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-slate-700"
                      style={{ backgroundColor: preset.bg }}
                    />
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-slate-700"
                      style={{ backgroundColor: preset.fg }}
                    />
                  </div>
                  <span className="truncate">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Custom Hex Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                QR Xətlər (Ön rəng)
              </label>
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
                <input
                  type="color"
                  value={config.fgColor}
                  onChange={(e) => setConfig((prev) => ({ ...prev, fgColor: e.target.value }))}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={config.fgColor}
                  onChange={(e) => setConfig((prev) => ({ ...prev, fgColor: e.target.value }))}
                  className="bg-transparent text-xs font-mono text-slate-200 uppercase w-full focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Fon Rəngi (Arxa fon)
              </label>
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5">
                <input
                  type="color"
                  value={config.bgColor}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      bgColor: e.target.value,
                      centerBadgeColor: e.target.value,
                    }))
                  }
                  className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={config.bgColor}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      bgColor: e.target.value,
                      centerBadgeColor: e.target.value,
                    }))
                  }
                  className="bg-transparent text-xs font-mono text-slate-200 uppercase w-full focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 3. Center Logo Selection */}
          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                <span>Mərkəz Loqosu / Simvolu</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                (Kameranın oxumasını təmin edir)
              </span>
            </label>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { id: 'none', label: 'Yoxdur' },
                { id: 'nix', label: 'NIX' },
                { id: 'reverse', label: 'Tərs Ox' },
                { id: 'waveform', label: 'Dalğa' },
                { id: 'music', label: 'Not' },
                { id: 'custom', label: 'Öz Şəklin' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    if (opt.id === 'custom') {
                      fileInputRef.current?.click();
                    } else {
                      setConfig((prev) => ({
                        ...prev,
                        logoType: opt.id as QRDesignConfig['logoType'],
                        errorCorrectionLevel: opt.id === 'none' ? 'M' : 'H',
                      }));
                    }
                  }}
                  className={`py-2 px-2.5 rounded-xl border text-center text-xs font-medium transition-all ${
                    config.logoType === opt.id
                      ? 'border-indigo-500 bg-indigo-950/40 text-white'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCustomLogoUpload}
            />
          </div>

          {/* 4. Sliders: Size and Logo Scale */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>QR Ölçüsü</span>
                <span className="font-mono tabular-nums text-slate-200">{config.size}px</span>
              </div>
              <input
                type="range"
                min="240"
                max="560"
                step="20"
                value={config.size}
                onChange={(e) => setConfig((prev) => ({ ...prev, size: parseInt(e.target.value) }))}
                className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>Loqo Ölçüsü</span>
                <span className="font-mono tabular-nums text-slate-200">
                  {config.logoSizePercent}%
                </span>
              </div>
              <input
                type="range"
                min="14"
                max="28"
                step="2"
                disabled={config.logoType === 'none'}
                value={config.logoSizePercent}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, logoSizePercent: parseInt(e.target.value) }))
                }
                className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer disabled:opacity-40"
              />
            </div>
          </div>

          {/* 5. Center Badge Shape */}
          {config.logoType !== 'none' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Loqo Ətrafı Forma
              </label>
              <div className="flex items-center gap-2">
                {[
                  { id: 'rounded', label: 'Yuvarlaq Düzbucaqlı' },
                  { id: 'circle', label: 'Dairəvi' },
                  { id: 'square', label: 'Kvadrat' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        centerBadgeShape: s.id as QRDesignConfig['centerBadgeShape'],
                      }))
                    }
                    className={`px-3 py-1.5 text-xs rounded-xl border transition-colors ${
                      config.centerBadgeShape === s.id
                        ? 'border-indigo-500 bg-indigo-950/40 text-indigo-200'
                        : 'border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
