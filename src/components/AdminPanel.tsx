import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Lock,
  LogOut,
  Trash2,
  Download,
  Copy,
  Check,
  Play,
  Pause,
  RefreshCw,
  Search,
  HardDrive,
  Clock,
  QrCode,
  Music2,
  FileSpreadsheet,
  X,
  AlertTriangle,
} from 'lucide-react';
import { AudioTrack, AdminStats } from '../types';
import { formatTime, formatBytes } from '../utils/audioProcessor';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Audio preview state inside admin table
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Check saved session
  useEffect(() => {
    const savedToken = sessionStorage.getItem('nix_admin_token');
    if (savedToken) {
      setAdminToken(savedToken);
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch admin data when authenticated & open
  useEffect(() => {
    if (isOpen && isAuthenticated && adminToken) {
      fetchAdminData();
    }
  }, [isOpen, isAuthenticated, adminToken]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAdminToken(data.token);
        sessionStorage.setItem('nix_admin_token', data.token);
        setIsAuthenticated(true);
        setPasswordInput('');
      } else {
        setAuthError(data.error || 'Parol yanlışdır');
      }
    } catch (_err) {
      setAuthError('Serverlə əlaqə kəsildi');
    }
  };

  const handleLogout = () => {
    if (previewAudio) {
      previewAudio.pause();
    }
    sessionStorage.removeItem('nix_admin_token');
    setAdminToken(null);
    setIsAuthenticated(false);
  };

  const fetchAdminData = async () => {
    if (!adminToken) return;
    setIsLoading(true);
    try {
      const [tracksRes, statsRes] = await Promise.all([
        fetch('/api/admin/tracks', {
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
      ]);

      if (tracksRes.ok && statsRes.ok) {
        const tracksData = await tracksRes.json();
        const statsData = await statsRes.json();
        setTracks(tracksData.tracks || []);
        setStats(statsData.stats || null);
      } else if (tracksRes.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error('Fetch admin data error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (!window.confirm('Bu səs faylını silmək istədiyinizdən əminsiniz?')) return;
    if (!adminToken) return;

    try {
      const res = await fetch(`/api/admin/tracks/${trackId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (res.ok) {
        setTracks((prev) => prev.filter((t) => t.id !== trackId));
        fetchAdminData();
      }
    } catch (err) {
      console.error('Delete track error:', err);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('DİQQƏT: Bütün səs faylları və QR məlumatları birdəfəlik silinəcək. Davam edilsin?')) return;
    if (!adminToken) return;

    try {
      const res = await fetch('/api/admin/clear-all', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      if (res.ok) {
        setTracks([]);
        fetchAdminData();
      }
    } catch (err) {
      console.error('Clear all error:', err);
    }
  };

  const toggleTablePreview = (track: AudioTrack) => {
    if (activePreviewId === track.id) {
      previewAudio?.pause();
      setActivePreviewId(null);
      return;
    }

    if (previewAudio) {
      previewAudio.pause();
    }

    const audio = new Audio(`/api/audio/${track.id}/stream?type=reversed`);
    audio.play();
    audio.onended = () => setActivePreviewId(null);
    setPreviewAudio(audio);
    setActivePreviewId(track.id);
  };

  const copyTrackLink = (trackId: string) => {
    const url = `${window.location.origin}/?track=${trackId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(trackId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(tracks, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `NixReverse_Backup_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (!isOpen) return null;

  const filteredTracks = tracks.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Top bar modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm md:text-base font-bold text-slate-100 flex items-center gap-2">
                <span>NixReverse Gizli İdarəetmə Paneli</span>
                <span className="text-xs text-rose-400 font-mono">· Giriş Məxfidir</span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                title="Çıxış et"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Çıxış</span>
              </button>
            )}
            <button
              onClick={() => {
                if (previewAudio) previewAudio.pause();
                onClose();
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {!isAuthenticated ? (
            /* Login Form */
            <div className="max-w-md mx-auto py-12 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                <Lock className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-100">Admin Girişi</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Yüklənmiş səs fayllarını və statistikaları idarə etmək üçün təsdiq kodunu daxil edin
                </p>
              </div>

              <form onSubmit={handleLogin} className="w-full flex flex-col gap-3 mt-2">
                <input
                  type="password"
                  placeholder="Giriş parolu..."
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  autoFocus
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
                />

                {authError && (
                  <div className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900/50 py-2 px-3 rounded-lg text-left">
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                >
                  Daxil Ol
                </button>
              </form>
            </div>
          ) : (
            /* Dashboard View */
            <div className="flex flex-col gap-6">
              {/* Stats Overview Grid */}
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex flex-col">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Music2 className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Ümumi Səslər</span>
                    </span>
                    <span className="text-xl font-bold font-mono tabular-nums text-slate-100 mt-1">
                      {stats.totalTracks}
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex flex-col">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Ümumi Müddət</span>
                    </span>
                    <span className="text-xl font-bold font-mono tabular-nums text-slate-100 mt-1">
                      {formatTime(stats.totalDuration)}
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex flex-col">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                      <span>Disk Həcmi</span>
                    </span>
                    <span className="text-xl font-bold font-mono tabular-nums text-slate-100 mt-1">
                      {formatBytes(stats.totalStorageBytes)}
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex flex-col">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-amber-400" />
                      <span>QR Oxunma</span>
                    </span>
                    <span className="text-xl font-bold font-mono tabular-nums text-slate-100 mt-1">
                      {stats.totalScans}
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex flex-col col-span-2 md:col-span-1">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Yükləmələr</span>
                    </span>
                    <span className="text-xl font-bold font-mono tabular-nums text-slate-100 mt-1">
                      {stats.totalDownloads}
                    </span>
                  </div>
                </div>
              )}

              {/* Action and Search Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                  <div className="relative w-full">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Səs adı və ya ID ilə axtarış..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchAdminData}
                    disabled={isLoading}
                    className="p-2 text-slate-400 hover:text-slate-200 bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
                    title="Yenilə"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    onClick={exportJSON}
                    className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>JSON İxrac</span>
                  </button>

                  <button
                    onClick={handleClearAll}
                    className="px-3 py-1.5 text-xs font-medium text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 rounded-xl border border-rose-800/80 flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hamısını Sil</span>
                  </button>
                </div>
              </div>

              {/* Tracks Data Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/90 text-slate-400 uppercase font-mono text-[11px] border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Pleyer</th>
                        <th className="px-4 py-3">Səs Adı / Fayl</th>
                        <th className="px-4 py-3 text-right">Müddət</th>
                        <th className="px-4 py-3 text-right">Həcm</th>
                        <th className="px-4 py-3 text-center">QR Oxunma</th>
                        <th className="px-4 py-3 text-center">Yükləmə</th>
                        <th className="px-4 py-3">Tarix</th>
                        <th className="px-4 py-3 text-right">Əməliyyatlar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {filteredTracks.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-slate-500 font-mono">
                            Heç bir səs faylı tapılmadı
                          </td>
                        </tr>
                      ) : (
                        filteredTracks.map((track) => {
                          const isPlayingThis = activePreviewId === track.id;
                          return (
                            <tr key={track.id} className="hover:bg-slate-900/50 transition-colors">
                              {/* Preview Play/Pause button */}
                              <td className="px-4 py-2.5">
                                <button
                                  onClick={() => toggleTablePreview(track)}
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                                    isPlayingThis
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600 hover:text-white'
                                  }`}
                                  title="Tərsinə dinlə"
                                >
                                  {isPlayingThis ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                                </button>
                              </td>

                              {/* Title & ID */}
                              <td className="px-4 py-2.5">
                                <div className="font-semibold text-slate-100 max-w-xs truncate">
                                  {track.name}
                                </div>
                                <div className="text-[10px] font-mono text-slate-500 truncate">
                                  ID: {track.id}
                                </div>
                              </td>

                              {/* Duration */}
                              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-300">
                                {formatTime(track.duration)}
                              </td>

                              {/* Size */}
                              <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-400">
                                {formatBytes(track.reversedSize || track.originalSize)}
                              </td>

                              {/* QR Scan count */}
                              <td className="px-4 py-2.5 text-center font-mono tabular-nums text-amber-400">
                                {track.scanCount || 0}
                              </td>

                              {/* Download count */}
                              <td className="px-4 py-2.5 text-center font-mono tabular-nums text-cyan-400">
                                {track.downloadCount || 0}
                              </td>

                              {/* Date */}
                              <td className="px-4 py-2.5 text-[11px] text-slate-400 whitespace-nowrap">
                                {new Date(track.createdAt).toLocaleDateString('az-AZ')}
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => copyTrackLink(track.id)}
                                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                                    title="QR Dinləmə Linkini Kopyala"
                                  >
                                    {copiedId === track.id ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>

                                  <a
                                    href={`/api/audio/${track.id}/download?type=zip`}
                                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                                    title="ZIP Paket Yüklə (Orijinal + Tərs)"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>

                                  <button
                                    onClick={() => handleDeleteTrack(track.id)}
                                    className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 rounded-lg transition-colors"
                                    title="Səsi Sil"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
