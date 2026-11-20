import React from 'react';
import {
  Edit3,
  Copy,
  Highlighter,
  FileText,
  BookA,
  Search,
  Replace,
  Bookmark as BookmarkIcon,
  Check
} from 'lucide-react';
import { Highlight } from '../types';

interface SelectionActionMenuProps {
  position: { x: number; y: number } | null;
  selectedText: string;
  disableEditActions?: boolean;
  onEdit: () => void;
  onCopy: () => void;
  onHighlight: (color: Highlight['color']) => void;
  onAddNote: () => void;
  onAddToDictionary: () => void;
  onSearch: () => void;
  onReplace: () => void;
  onBookmark: () => void;
  onClose: () => void;
}

export const SelectionActionMenu: React.FC<SelectionActionMenuProps> = ({
  position,
  selectedText,
  disableEditActions = false,
  onEdit,
  onCopy,
  onHighlight,
  onAddNote,
  onAddToDictionary,
  onSearch,
  onReplace,
  onBookmark,
  onClose,
}) => {
  const [showColorPicker, setShowColorPicker] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  if (!position || !selectedText.trim()) return null;

  const handleCopyClick = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 800);
  };

  const highlightColors: Array<{ color: Highlight['color']; bg: string; title: string }> = [
    { color: 'yellow', bg: 'bg-amber-400', title: 'Vàng' },
    { color: 'green', bg: 'bg-emerald-400', title: 'Xanh lá' },
    { color: 'blue', bg: 'bg-sky-400', title: 'Xanh dương' },
    { color: 'pink', bg: 'bg-pink-400', title: 'Hồng' },
    { color: 'purple', bg: 'bg-purple-400', title: 'Tím' },
  ];

  // Keep menu inside viewport boundaries
  const menuWidth = 340;
  const menuHeight = 44;
  const clampedX = Math.max(16, Math.min(window.innerWidth - menuWidth - 16, position.x - menuWidth / 2));
  const clampedY = position.y - menuHeight - 12 < 10 ? position.y + 24 : position.y - menuHeight - 12;

  return (
    <div
      className="fixed z-50 transition-all duration-150 select-none animate-in fade-in zoom-in-95"
      style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center space-x-0.5 p-1 bg-neutral-900/95 border border-neutral-700/80 rounded-xl shadow-2xl backdrop-blur-md text-neutral-200 text-xs">
        {/* Chỉnh sửa */}
        <button
          onClick={onEdit}
          disabled={disableEditActions}
          className="flex items-center space-x-1 px-2 py-1 rounded-lg hover:bg-neutral-800 hover:text-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title={
            disableEditActions
              ? 'Chuyển về Nguyên văn để sửa chương gốc'
              : 'Chỉnh sửa đoạn này'
          }
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sửa</span>
        </button>

        {/* Sao chép */}
        <button
          onClick={handleCopyClick}
          className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-amber-400 transition-colors cursor-pointer"
          title="Sao chép văn bản"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        {/* Tô sáng */}
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              showColorPicker ? 'bg-amber-600/30 text-amber-400' : 'hover:bg-neutral-800 hover:text-amber-400'
            }`}
            title="Tô sáng văn bản"
          >
            <Highlighter className="w-3.5 h-3.5" />
          </button>

          {showColorPicker && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 p-1.5 bg-neutral-950 border border-neutral-700 rounded-lg shadow-xl flex items-center space-x-1.5 z-50">
              {highlightColors.map((c) => (
                <button
                  key={c.color}
                  onClick={() => {
                    onHighlight(c.color);
                    setShowColorPicker(false);
                    onClose();
                  }}
                  className={`w-4 h-4 rounded-full ${c.bg} hover:scale-125 transition-transform cursor-pointer shadow-xs`}
                  title={`Tô màu ${c.title}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Thêm ghi chú */}
        <button
          onClick={onAddNote}
          className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-amber-400 transition-colors cursor-pointer"
          title="Thêm ghi chú"
        >
          <FileText className="w-3.5 h-3.5" />
        </button>

        {/* Thêm vào từ điển */}
        <button
          onClick={onAddToDictionary}
          className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-amber-400 transition-colors cursor-pointer"
          title="Thêm vào từ điển"
        >
          <BookA className="w-3.5 h-3.5" />
        </button>

        {/* Tìm kiếm */}
        <button
          onClick={onSearch}
          className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-amber-400 transition-colors cursor-pointer"
          title="Tìm trong truyện"
        >
          <Search className="w-3.5 h-3.5" />
        </button>

        {/* Thay thế */}
        <button
          onClick={onReplace}
          disabled={disableEditActions}
          className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          title={
            disableEditActions
              ? 'Chuyển về Nguyên văn để thay thế văn bản gốc'
              : 'Tìm & Thay thế từ này'
          }
        >
          <Replace className="w-3.5 h-3.5" />
        </button>

        {/* Đánh dấu vị trí */}
        <button
          onClick={onBookmark}
          className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-amber-400 transition-colors cursor-pointer"
          title="Đánh dấu đoạn văn (Bookmark)"
        >
          <BookmarkIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
