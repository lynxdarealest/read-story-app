import React from 'react';
import {
  X,
  Palette,
  Plus,
  Trash2,
  Check,
  Type,
  AlignJustify,
  AlignLeft,
  AlignCenter,
  Upload,
  RotateCcw,
  Sparkles,
  Sliders
} from 'lucide-react';
import { CustomTheme, ReaderSettings, ReaderFont, StandardThemeId } from '../types';

interface ThemeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReaderSettings;
  onSaveTheme: (theme: CustomTheme) => void;
  onDeleteTheme: (themeId: string) => void;
  onApplyTheme: (themeId: string, customThemeData?: CustomTheme) => void;
}

export const ThemeManagerModal: React.FC<ThemeManagerModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveTheme,
  onDeleteTheme,
  onApplyTheme,
}) => {
  const [themeName, setThemeName] = React.useState('');
  const [textColor, setTextColor] = React.useState('#e2e8f0');
  const [backgroundColor, setBackgroundColor] = React.useState('#18181b');
  const [backgroundImageUrl, setBackgroundImageUrl] = React.useState('');
  const [fontFamily, setFontFamily] = React.useState<ReaderFont>('font-literata');
  const [fontSize, setFontSize] = React.useState(19);
  const [fontWeight, setFontWeight] = React.useState<'normal' | 'medium' | 'semibold'>('normal');
  const [lineHeight, setLineHeight] = React.useState(1.8);
  const [paragraphSpacing, setParagraphSpacing] = React.useState(1.25);
  const [containerWidth, setContainerWidth] = React.useState<'compact' | 'medium' | 'wide' | 'full'>('medium');
  const [textAlign, setTextAlign] = React.useState<'justify' | 'left' | 'center'>('justify');
  const [textIndent, setTextIndent] = React.useState(true);
  const [editingThemeId, setEditingThemeId] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Initialize draft with active theme settings
  React.useEffect(() => {
    if (isOpen) {
      const activeCustom = settings.customThemes.find((t) => t.id === settings.theme);
      if (activeCustom) {
        setThemeName(activeCustom.name);
        setTextColor(activeCustom.textColor);
        setBackgroundColor(activeCustom.backgroundColor);
        setBackgroundImageUrl(activeCustom.backgroundImageUrl || '');
        setFontFamily(activeCustom.fontFamily);
        setFontSize(activeCustom.fontSize);
        setFontWeight(activeCustom.fontWeight);
        setLineHeight(activeCustom.lineHeight);
        setParagraphSpacing(activeCustom.paragraphSpacing);
        setContainerWidth(activeCustom.containerWidth);
        setTextAlign(activeCustom.textAlign);
        setTextIndent(activeCustom.textIndent);
        setEditingThemeId(activeCustom.id);
      } else {
        setThemeName('');
        setTextColor('#d6c5af');
        setBackgroundColor('#1c1917');
        setBackgroundImageUrl('');
        setFontFamily(settings.fontFamily);
        setFontSize(settings.fontSize);
        setFontWeight(settings.fontWeight);
        setLineHeight(settings.lineHeight);
        setParagraphSpacing(settings.paragraphSpacing);
        setContainerWidth(settings.containerWidth);
        setTextAlign(settings.textAlign);
        setTextIndent(settings.textIndent);
        setEditingThemeId(null);
      }
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!themeName.trim()) return;

    const themeId = editingThemeId || `custom-${Date.now()}`;
    const newTheme: CustomTheme = {
      id: themeId,
      name: themeName.trim(),
      textColor,
      backgroundColor,
      backgroundImageUrl: backgroundImageUrl || undefined,
      fontFamily,
      fontSize,
      fontWeight,
      lineHeight,
      paragraphSpacing,
      containerWidth,
      textAlign,
      textIndent,
    };

    onSaveTheme(newTheme);
    onApplyTheme(themeId, newTheme);
    onClose();
  };

  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setBackgroundImageUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const fontOptions: Array<{ id: ReaderFont; name: string }> = [
    { id: 'font-literata', name: 'Literata (Văn học)' },
    { id: 'font-bevietnam', name: 'Be Vietnam Pro' },
    { id: 'font-merriweather', name: 'Merriweather' },
    { id: 'font-lora', name: 'Lora' },
    { id: 'font-system-serif', name: 'Times / Serif' },
    { id: 'font-system-sans', name: 'Segoe / Sans' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden select-none">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <div className="flex items-center space-x-2.5">
            <Palette className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-neutral-100">
              {editingThemeId ? 'Chỉnh sửa chủ đề đọc' : 'Tạo chủ đề đọc mới'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-200 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-12 gap-5 text-xs">
          {/* Controls Column */}
          <div className="md:col-span-7 space-y-4">
            <div>
              <label className="block text-neutral-400 font-medium mb-1">Tên chủ đề</label>
              <input
                type="text"
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
                placeholder="Nhập tên chủ đề..."
                className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2">
                <label className="block text-neutral-400 font-medium">Màu nền</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-8 h-8 rounded border border-neutral-700 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="flex-1 px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs font-mono text-neutral-200"
                  />
                </div>
              </div>

              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2">
                <label className="block text-neutral-400 font-medium">Màu chữ</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-8 h-8 rounded border border-neutral-700 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="flex-1 px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs font-mono text-neutral-200"
                  />
                </div>
              </div>
            </div>

            {/* Background image / Texture */}
            <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-neutral-400 font-medium">Ảnh nền / Họa tiết giấy</label>
                {backgroundImageUrl && (
                  <button
                    onClick={() => setBackgroundImageUrl('')}
                    className="text-[11px] text-red-400 hover:text-red-300"
                  >
                    Xóa ảnh nền
                  </button>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Chọn ảnh từ máy</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBgImageUpload}
                />
                <span className="text-[11px] text-neutral-500 truncate flex-1">
                  {backgroundImageUrl ? 'Đã tải ảnh nền' : 'Chưa chọn ảnh nền'}
                </span>
              </div>
            </div>

            {/* Font Family & Weight */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-400 font-medium mb-1">Phông chữ</label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value as ReaderFont)}
                  className="w-full px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none"
                >
                  {fontOptions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-neutral-400 font-medium mb-1">Độ đậm chữ</label>
                <select
                  value={fontWeight}
                  onChange={(e) => setFontWeight(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none"
                >
                  <option value="normal">Bình thường (400)</option>
                  <option value="medium">Vừa (500)</option>
                  <option value="semibold">Đậm (600)</option>
                </select>
              </div>
            </div>

            {/* Typography Sliders */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-neutral-400 font-medium">Cỡ chữ</span>
                  <span className="text-amber-400 font-mono">{fontSize}px</span>
                </div>
                <input
                  type="range"
                  min={14}
                  max={34}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-neutral-400 font-medium">Khoảng cách dòng</span>
                  <span className="text-amber-400 font-mono">{lineHeight}x</span>
                </div>
                <input
                  type="range"
                  min={1.4}
                  max={2.4}
                  step={0.1}
                  value={lineHeight}
                  onChange={(e) => setLineHeight(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Paragraph Spacing & Alignment */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-400 font-medium mb-1">Căn lề</label>
                <div className="flex border border-neutral-800 rounded-lg overflow-hidden bg-neutral-950">
                  {[
                    { id: 'justify', icon: AlignJustify, label: 'Đều' },
                    { id: 'left', icon: AlignLeft, label: 'Trái' },
                    { id: 'center', icon: AlignCenter, label: 'Giữa' },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTextAlign(item.id as any)}
                        className={`flex-1 py-1.5 flex items-center justify-center transition-colors cursor-pointer ${
                          textAlign === item.id ? 'bg-amber-600 text-white' : 'text-neutral-400 hover:text-white'
                        }`}
                        title={item.label}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 font-medium mb-1">Khổ trang</label>
                <select
                  value={containerWidth}
                  onChange={(e) => setContainerWidth(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none"
                >
                  <option value="compact">Gọn (580px)</option>
                  <option value="medium">Vừa (680px)</option>
                  <option value="wide">Rộng (900px)</option>
                  <option value="full">Tối đa</option>
                </select>
              </div>
            </div>

            <label className="flex items-center space-x-2 text-neutral-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={textIndent}
                onChange={(e) => setTextIndent(e.target.checked)}
                className="accent-amber-500 rounded"
              />
              <span>Thụt lề đầu dòng đoạn văn</span>
            </label>
          </div>

          {/* Live Preview Column */}
          <div className="md:col-span-5 flex flex-col space-y-2">
            <span className="text-neutral-400 font-medium text-xs">Xem trước trang đọc</span>

            <div
              className={`flex-1 rounded-xl p-5 overflow-y-auto border border-neutral-700 shadow-inner ${fontFamily}`}
              style={{
                backgroundColor,
                color: textColor,
                backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                fontSize: `${fontSize}px`,
                lineHeight,
                textAlign,
                fontWeight: fontWeight === 'semibold' ? 600 : fontWeight === 'medium' ? 500 : 400,
              }}
            >
              <div className="border-b border-current opacity-20 pb-2 mb-4 text-center">
                <span className="text-[10px] tracking-widest uppercase block opacity-60">
                  Xem trước chủ đề
                </span>
                <h4 className="font-bold text-base mt-1">Tiêu đề xem trước</h4>
              </div>

              <div className="space-y-3">
                <p className={textIndent ? 'indent-6' : ''}>
                  Đoạn văn bản hiển thị thử giúp bạn kiểm tra màu nền, màu chữ, cỡ chữ và khoảng cách dòng trước khi lưu chủ đề đọc.
                </p>
                <p className={textIndent ? 'indent-6' : ''}>
                  Bạn có thể tùy chỉnh độ tương phản, phông chữ, căn lề và độ rộng khung đọc sao cho dễ chịu nhất cho mắt.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between">
          <div>
            {editingThemeId && (
              <button
                type="button"
                onClick={() => {
                  onDeleteTheme(editingThemeId);
                  onClose();
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa chủ đề này</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-neutral-200"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!themeName.trim()}
              className="flex items-center space-x-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Lưu & Áp dụng chủ đề</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
