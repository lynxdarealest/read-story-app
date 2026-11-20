import React from 'react';
import {
  X,
  Type,
  AlignJustify,
  AlignLeft,
  AlignCenter,
  ScrollText,
  BookOpen,
  ChevronsDown,
  Columns2,
  Focus,
  Play,
  Square,
  Plus,
  Palette,
  Minus,
  Edit2
} from 'lucide-react';
import { ReaderSettings, ReaderFont, ReadingMode } from '../types';

interface ReaderSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onUpdateSettings: (newSettings: Partial<ReaderSettings>) => void;
  onOpenThemeManager: () => void;
}

export const ReaderSettingsPanel: React.FC<ReaderSettingsPanelProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onOpenThemeManager,
}) => {
  if (!isOpen) return null;

  const defaultThemes = [
    { id: 'paper', label: 'Paper', bg: '#f4ecd8', text: '#2c251e' },
    { id: 'sepia', label: 'Sepia', bg: '#fbf0d9', text: '#3c2f1f' },
    { id: 'light', label: 'Light', bg: '#f8fafc', text: '#1e293b' },
    { id: 'dark', label: 'Dark', bg: '#121214', text: '#e2e8f0' },
    { id: 'oled', label: 'OLED', bg: '#000000', text: '#d4d4d8' },
    { id: 'eink', label: 'E-ink', bg: '#ffffff', text: '#000000' },
  ];

  const fonts: Array<{ id: ReaderFont; name: string }> = [
    { id: 'font-literata', name: 'Literata' },
    { id: 'font-bevietnam', name: 'Be Vietnam Pro' },
    { id: 'font-merriweather', name: 'Merriweather' },
    { id: 'font-lora', name: 'Lora' },
    { id: 'font-system-serif', name: 'Times / Serif' },
    { id: 'font-system-sans', name: 'Segoe / Sans' },
  ];

  // Select a theme (standard or custom)
  const handleSelectTheme = (themeId: string) => {
    const custom = settings.customThemes?.find((t) => t.id === themeId);
    if (custom) {
      onUpdateSettings({
        theme: themeId,
        textColor: custom.textColor,
        backgroundColor: custom.backgroundColor,
        backgroundImageUrl: custom.backgroundImageUrl,
        fontFamily: custom.fontFamily,
        fontSize: custom.fontSize,
        fontWeight: custom.fontWeight,
        lineHeight: custom.lineHeight,
        paragraphSpacing: custom.paragraphSpacing,
        containerWidth: custom.containerWidth,
        textAlign: custom.textAlign,
        textIndent: custom.textIndent,
      });
    } else {
      onUpdateSettings({
        theme: themeId,
        textColor: undefined,
        backgroundColor: undefined,
        backgroundImageUrl: undefined,
      });
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-84 bg-neutral-900 border-l border-neutral-800 shadow-2xl flex flex-col select-none animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
        <div className="flex items-center space-x-2">
          <Type className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
            Giao diện đọc
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body Controls */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Reading Mode */}
        <div>
          <label className="block text-neutral-400 font-semibold mb-1.5">Chế độ đọc & cuộn trang</label>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                { id: 'scroll', label: 'Cuộn chương', desc: 'Cuộn dọc từng chương', icon: ScrollText },
                { id: 'continuous', label: 'Cuộn liền mạch', desc: 'Tự nối tiếp chương', icon: ChevronsDown },
                { id: 'paginated', label: 'Lật trang', desc: '1 trang vừa khung', icon: BookOpen },
                { id: 'two-column', label: 'Sách 2 trang', desc: '2 cột như sách giấy', icon: Columns2 },
                { id: 'focus', label: 'Tập trung', desc: 'Nổi bật từng đoạn', icon: Focus },
              ] as Array<{ id: ReadingMode; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }>
            ).map((mode, idx) => {
              const Icon = mode.icon;
              const isSelected = settings.readingMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onUpdateSettings({ readingMode: mode.id })}
                  className={`flex items-start space-x-2 p-2 rounded-lg border text-left cursor-pointer transition-colors ${
                    idx === 4 ? 'col-span-2' : ''
                  } ${
                    isSelected
                      ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:text-white'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isSelected ? 'text-amber-400' : 'text-neutral-400'}`} />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold leading-tight">{mode.label}</div>
                    <div className="text-[10px] text-neutral-500 leading-tight mt-0.5 truncate">{mode.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Auto-Scroll Speed */}
        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-neutral-300 font-semibold flex items-center space-x-1.5">
              {settings.autoScrollSpeed > 0 ? (
                <Play className="w-3.5 h-3.5 text-emerald-400 fill-current" />
              ) : (
                <Square className="w-3.5 h-3.5 text-neutral-500" />
              )}
              <span>Tự động cuộn</span>
            </span>
            <span className="font-mono font-bold text-amber-400">
              {settings.autoScrollSpeed > 0 ? `Mức ${settings.autoScrollSpeed}/10` : 'Tắt'}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={settings.autoScrollSpeed || 0}
            onChange={(e) => onUpdateSettings({ autoScrollSpeed: Number(e.target.value) })}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="grid grid-cols-4 gap-1">
            {[
              { label: 'Tắt', val: 0 },
              { label: 'Chậm', val: 2 },
              { label: 'Vừa', val: 4 },
              { label: 'Nhanh', val: 7 },
            ].map((preset) => (
              <button
                key={preset.val}
                type="button"
                onClick={() => onUpdateSettings({ autoScrollSpeed: preset.val })}
                className={`py-1 rounded text-[10px] font-medium border cursor-pointer transition-colors ${
                  (settings.autoScrollSpeed || 0) === preset.val
                    ? 'bg-amber-600/25 border-amber-500 text-amber-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Themes Engine (Default + Custom) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-neutral-400 font-semibold">Chủ đề màu sắc</label>
            <button
              onClick={onOpenThemeManager}
              className="flex items-center space-x-1 text-amber-400 hover:text-amber-300 text-[11px] font-medium cursor-pointer"
            >
              <Palette className="w-3 h-3" />
              <span>Tạo chủ đề</span>
            </button>
          </div>

          {/* Default theme buttons */}
          <div className="grid grid-cols-3 gap-1.5">
            {defaultThemes.map((theme) => {
              const isSelected = settings.theme === theme.id;
              return (
                <button
                  key={theme.id}
                  onClick={() => handleSelectTheme(theme.id)}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium cursor-pointer text-center transition-all ${
                    isSelected
                      ? 'ring-2 ring-amber-500 border-amber-500 font-bold'
                      : 'border-neutral-800 hover:border-neutral-700'
                  }`}
                  style={{ backgroundColor: theme.bg, color: theme.text }}
                >
                  {theme.label}
                </button>
              );
            })}
          </div>

          {/* User Custom Themes */}
          {settings.customThemes && settings.customThemes.length > 0 && (
            <div className="mt-2 space-y-1">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">
                Chủ đề cá nhân
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {settings.customThemes.map((ct) => {
                  const isSelected = settings.theme === ct.id;
                  return (
                    <div
                      key={ct.id}
                      onClick={() => handleSelectTheme(ct.id)}
                      className={`flex items-center justify-between p-1.5 rounded-lg border text-[11px] cursor-pointer transition-all ${
                        isSelected
                          ? 'ring-2 ring-amber-500 border-amber-500 font-bold'
                          : 'border-neutral-800 hover:border-neutral-700'
                      }`}
                      style={{ backgroundColor: ct.backgroundColor, color: ct.textColor }}
                    >
                      <span className="truncate">{ct.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenThemeManager();
                        }}
                        className="p-1 opacity-60 hover:opacity-100"
                        title="Sửa chủ đề"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Font Family */}
        <div>
          <label className="block text-neutral-400 font-semibold mb-1.5">Phông chữ</label>
          <div className="grid grid-cols-2 gap-1.5">
            {fonts.map((f) => {
              const isSelected = settings.fontFamily === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => onUpdateSettings({ fontFamily: f.id })}
                  className={`py-1.5 px-2 rounded-lg border text-left cursor-pointer transition-colors ${f.id} ${
                    isSelected
                      ? 'bg-amber-600/20 border-amber-500 text-amber-300 font-semibold'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                  }`}
                >
                  <span className="text-xs truncate block">{f.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Font Size & Weight */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-neutral-400 font-semibold">Cỡ chữ</span>
            <span className="text-amber-400 font-mono font-bold">{settings.fontSize} px</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onUpdateSettings({ fontSize: Math.max(14, settings.fontSize - 1) })}
              className="p-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-300 hover:bg-neutral-800 cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              min={14}
              max={34}
              value={settings.fontSize}
              onChange={(e) => onUpdateSettings({ fontSize: Number(e.target.value) })}
              className="flex-1 accent-amber-500 cursor-pointer"
            />
            <button
              onClick={() => onUpdateSettings({ fontSize: Math.min(34, settings.fontSize + 1) })}
              className="p-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-300 hover:bg-neutral-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Line Height & Margins */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-neutral-400 font-semibold mb-1">Khoảng cách dòng</label>
            <select
              value={settings.lineHeight}
              onChange={(e) => onUpdateSettings({ lineHeight: Number(e.target.value) })}
              className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 text-xs focus:outline-none"
            >
              <option value={1.5}>1.5x (Hẹp)</option>
              <option value={1.8}>1.8x (Chuẩn)</option>
              <option value={2.0}>2.0x (Thoáng)</option>
              <option value={2.3}>2.3x (Rộng)</option>
            </select>
          </div>

          <div>
            <label className="block text-neutral-400 font-semibold mb-1">Khổ trang đọc</label>
            <select
              value={settings.containerWidth}
              onChange={(e) => onUpdateSettings({ containerWidth: e.target.value as any })}
              className="w-full px-2 py-1 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 text-xs focus:outline-none"
            >
              <option value="compact">Gọn</option>
              <option value="medium">Vừa</option>
              <option value="wide">Rộng</option>
              <option value="full">Tối đa</option>
            </select>
          </div>
        </div>

        {/* Alignment */}
        <div>
          <label className="block text-neutral-400 font-semibold mb-1">Căn chỉnh lề</label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'justify', icon: AlignJustify, label: 'Đều' },
              { id: 'left', icon: AlignLeft, label: 'Trái' },
              { id: 'center', icon: AlignCenter, label: 'Giữa' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onUpdateSettings({ textAlign: item.id as any })}
                  className={`flex items-center justify-center space-x-1 py-1 rounded border text-xs cursor-pointer ${
                    settings.textAlign === item.id
                      ? 'bg-amber-600/20 border-amber-500 text-amber-400 font-bold'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-2 pt-2 border-t border-neutral-800">
          <label className="flex items-center justify-between text-neutral-300 cursor-pointer">
            <span>Thụt lề đầu dòng</span>
            <input
              type="checkbox"
              checked={settings.textIndent}
              onChange={(e) => onUpdateSettings({ textIndent: e.target.checked })}
              className="accent-amber-500 rounded"
            />
          </label>

          <label className="flex items-center justify-between text-neutral-300 cursor-pointer">
            <span>Chạm cạnh trái/phải để lật trang</span>
            <input
              type="checkbox"
              checked={settings.tapToTurnPage !== false}
              onChange={(e) => onUpdateSettings({ tapToTurnPage: e.target.checked })}
              className="accent-amber-500 rounded"
            />
          </label>

          <label className="flex items-center justify-between text-neutral-300 cursor-pointer">
            <span>Lăn chuột để lật trang (khi lật trang)</span>
            <input
              type="checkbox"
              checked={settings.wheelToTurnPage !== false}
              onChange={(e) => onUpdateSettings({ wheelToTurnPage: e.target.checked })}
              className="accent-amber-500 rounded"
            />
          </label>

          <label className="flex items-center justify-between text-neutral-300 cursor-pointer">
            <span>Cuộn mượt khi điều hướng phím</span>
            <input
              type="checkbox"
              checked={settings.smoothScroll !== false}
              onChange={(e) => onUpdateSettings({ smoothScroll: e.target.checked })}
              className="accent-amber-500 rounded"
            />
          </label>

          <label className="flex items-center justify-between text-neutral-300 cursor-pointer">
            <span>Áp dụng từ điển riêng</span>
            <input
              type="checkbox"
              checked={settings.applyDictionary}
              onChange={(e) => onUpdateSettings({ applyDictionary: e.target.checked })}
              className="accent-amber-500 rounded"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
