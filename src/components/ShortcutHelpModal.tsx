import React from 'react';
import { X, Keyboard, ArrowRight, BookOpen, Palette, Sliders, Volume2 } from 'lucide-react';

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutHelpModal: React.FC<ShortcutHelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const categories = [
    {
      title: 'Điều hướng chương & trang',
      icon: BookOpen,
      items: [
        { key: '] hoặc Shift + N', desc: 'Chương tiếp theo' },
        { key: '[ hoặc Shift + P', desc: 'Chương trước' },
        { key: '→ hoặc D', desc: 'Trang tiếp / Chương tiếp theo' },
        { key: '← hoặc A', desc: 'Trang trước / Chương trước' },
        { key: 'Phím cách / ↑↓', desc: 'Cuộn trang hoặc lật trang' },
        { key: 'Shift + Cách', desc: 'Cuộn lên / lật trang trước' },
        { key: 'J / K', desc: 'Cuộn hoặc chuyển đoạn (chế độ Tập trung)' },
        { key: 'Chạm cạnh / Lăn chuột', desc: 'Lật trang hoặc cuộn nửa trang nhanh' },
        { key: 'Home / End', desc: 'Về đầu / xuống cuối chương' },
      ],
    },
    {
      title: 'Chủ đề & Phông chữ',
      icon: Palette,
      items: [
        { key: 'C', desc: 'Chuyển chủ đề tiếp theo' },
        { key: 'L', desc: 'Chuyển nhanh Sáng / Tối' },
        { key: '1 - 6', desc: 'Chọn nhanh: Paper, Sepia, Light, Dark, OLED, E-ink' },
        { key: '+ hoặc =', desc: 'Tăng cỡ chữ (+1px)' },
        { key: '- hoặc _', desc: 'Giảm cỡ chữ (-1px)' },
        { key: 'R', desc: 'Đổi chế độ đọc (Cuộn / Liền mạch / Lật / 2 trang / Tập trung)' },
      ],
    },
    {
      title: 'Menu & Tiện ích',
      icon: Sliders,
      items: [
        { key: 'E', desc: 'Chỉnh sửa toàn bộ chương' },
        { key: 'Ctrl + H', desc: 'Tìm kiếm & Thay thế nâng cao' },
        { key: 'Bôi đen văn bản', desc: 'Mở menu thao tác nhanh (Sửa, Tô sáng...)' },
        { key: 'H', desc: 'Ẩn / Hiện thanh công cụ (Zen)' },
        { key: 'M', desc: 'Mục lục chương' },
        { key: 'S', desc: 'Cài đặt giao diện đọc' },
        { key: '/ hoặc Ctrl + F', desc: 'Tìm kiếm nội dung' },
        { key: 'B', desc: 'Đánh dấu vị trí (Bookmark)' },
        { key: 'Shift + B', desc: 'Mở danh sách dấu trang' },
        { key: 'W', desc: 'Từ điển riêng & Thay thế từ' },
        { key: 'T', desc: 'Thanh đọc thành tiếng (TTS)' },
        { key: 'P', desc: 'Phát / Tạm dừng đọc TTS' },
        { key: 'F11', desc: 'Bật / Tắt Toàn màn hình' },
        { key: '? hoặc F1', desc: 'Mở bảng phím tắt này' },
        { key: 'Esc', desc: 'Đóng menu / Thoát về thư viện' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden select-none">
        {/* Header */}
        <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <div className="flex items-center space-x-2">
            <Keyboard className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-neutral-100">Phím tắt điều hướng</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {categories.map((cat, idx) => {
            const Icon = cat.icon;
            return (
              <div key={idx} className="space-y-2">
                <div className="flex items-center space-x-2 text-neutral-300 font-semibold border-b border-neutral-800 pb-1.5">
                  <Icon className="w-3.5 h-3.5 text-amber-500" />
                  <span>{cat.title}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {cat.items.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-neutral-950 border border-neutral-850"
                    >
                      <span className="text-neutral-300 text-[11px]">{item.desc}</span>
                      <kbd className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 font-mono text-[10px] text-amber-400 font-semibold shadow-xs">
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between text-neutral-500 text-[11px]">
          <span>Mẹo: Nhấn phím <kbd className="px-1 py-0.5 bg-neutral-800 rounded font-mono text-neutral-300">?</kbd> bất kỳ lúc nào khi đọc để mở bảng này.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
