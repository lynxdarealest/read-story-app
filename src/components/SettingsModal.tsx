import React from 'react';
import {
  X,
  Settings,
  Download,
  Upload,
  HardDrive,
  Keyboard,
  Info,
  RotateCcw,
  Check,
  AlertTriangle,
  Type
} from 'lucide-react';
import { ReaderSettings } from '../types';
import {
  exportDatabaseBackup,
  restoreDatabaseBackup,
} from '../services/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onUpdateSettings: (newSettings: Partial<ReaderSettings>) => void;
  onDataRestored: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onDataRestored,
}) => {
  const [activeTab, setActiveTab] = React.useState<'general' | 'storage' | 'shortcuts' | 'about'>('storage');
  const [isExporting, setIsExporting] = React.useState(false);
  const [isRestoring, setIsRestoring] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ text: string; isError?: boolean } | null>(null);
  const fileRestoreInputRef = React.useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleExportBackup = async () => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      const json = await exportDatabaseBackup();
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Backup_ThuVien_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage({ text: 'Đã xuất file sao lưu thư viện thành công!' });
    } catch (err: any) {
      setStatusMessage({ text: 'Lỗi khi sao lưu dữ liệu: ' + err.message, isError: true });
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    setStatusMessage(null);
    try {
      const text = await file.text();
      await restoreDatabaseBackup(text);
      setStatusMessage({ text: 'Khôi phục thư viện thành công!' });
      onDataRestored();
    } catch (err: any) {
      setStatusMessage({ text: 'Không thể khôi phục: ' + err.message, isError: true });
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden select-none">
        {/* Header */}
        <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <div className="flex items-center space-x-2">
            <Settings className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-neutral-100">Cài đặt</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-200 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-1 px-4 pt-2 border-b border-neutral-800 bg-neutral-950/60 text-xs">
          {[
            { id: 'storage', label: 'Dữ liệu', icon: HardDrive },
            { id: 'general', label: 'Tùy chọn', icon: Type },
            { id: 'shortcuts', label: 'Phím tắt', icon: Keyboard },
            { id: 'about', label: 'Thông tin', icon: Info },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-t-lg transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-neutral-900 text-amber-400 border-t-2 border-amber-500 font-semibold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {statusMessage && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center space-x-2 ${
                statusMessage.isError
                  ? 'bg-red-900/30 border-red-700/50 text-red-300'
                  : 'bg-emerald-900/30 border-emerald-700/50 text-emerald-300'
              }`}
            >
              {statusMessage.isError ? (
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              ) : (
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3">
                <div>
                  <h3 className="font-semibold text-neutral-200 text-sm">Sao lưu & Khôi phục</h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Xuất hoặc nhập toàn bộ dữ liệu sách, dấu trang và từ điển.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={handleExportBackup}
                    disabled={isExporting}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-500" />
                    <span>Xuất file sao lưu (.json)</span>
                  </button>

                  <button
                    onClick={() => fileRestoreInputRef.current?.click()}
                    disabled={isRestoring}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Khôi phục dữ liệu</span>
                  </button>
                  <input
                    ref={fileRestoreInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleRestoreBackup}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3">
                <h4 className="font-semibold text-neutral-200">Tùy chọn đọc</h4>

                <label className="flex items-center justify-between text-neutral-300 cursor-pointer">
                  <span>Tự động chuyển chương khi đọc hết (TTS)</span>
                  <input
                    type="checkbox"
                    checked={settings.ttsAutoNextChapter}
                    onChange={(e) => onUpdateSettings({ ttsAutoNextChapter: e.target.checked })}
                    className="accent-amber-500 rounded"
                  />
                </label>

                <label className="flex items-center justify-between text-neutral-300 cursor-pointer pt-2 border-t border-neutral-850">
                  <span>Áp dụng từ điển riêng khi đọc truyện</span>
                  <input
                    type="checkbox"
                    checked={settings.applyDictionary}
                    onChange={(e) => onUpdateSettings({ applyDictionary: e.target.checked })}
                    className="accent-amber-500 rounded"
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold text-neutral-200">Phím tắt</h4>
                <span className="text-[11px] text-neutral-400">Nhấn <kbd className="px-1 py-0.5 bg-neutral-800 rounded font-mono text-amber-400 font-bold">?</kbd> khi đọc để xem chi tiết</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { key: '] / [', desc: 'Chương sau / Chương trước' },
                  { key: '→ / ← / Cách', desc: 'Trang tiếp / Trang trước' },
                  { key: 'J / K', desc: 'Cuộn từng đoạn xuống / lên' },
                  { key: 'C', desc: 'Đổi chủ đề tiếp theo' },
                  { key: 'L', desc: 'Chuyển nhanh Sáng / Tối' },
                  { key: '1 - 6', desc: 'Chọn nhanh Paper, Sepia, Light...' },
                  { key: '+ / -', desc: 'Tăng / Giảm cỡ chữ' },
                  { key: 'R', desc: 'Chuyển đổi chế độ đọc' },
                  { key: 'H', desc: 'Ẩn / Hiện thanh công cụ (Zen)' },
                  { key: 'M / S', desc: 'Mục lục chương / Cài đặt' },
                  { key: 'B / Shift+B', desc: 'Đánh dấu / Danh sách bookmark' },
                  { key: 'T / P', desc: 'Bật TTS / Phát & Tạm dừng đọc' },
                  { key: 'F11 / F', desc: 'Toàn màn hình' },
                  { key: 'Esc', desc: 'Thoát về thư viện' },
                ].map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                    <span className="text-neutral-300 text-[11px]">{s.desc}</span>
                    <kbd className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[10px] text-amber-400 font-semibold">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3 text-neutral-300 leading-relaxed">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-amber-600/20 text-amber-500 border border-amber-500/30 flex items-center justify-center font-bold text-sm">
                  TR
                </div>
                <div>
                  <h3 className="font-bold text-neutral-100 text-sm">Trình Đọc Truyện</h3>
                  <p className="text-[11px] text-neutral-400 font-mono">Phiên bản 1.0</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
