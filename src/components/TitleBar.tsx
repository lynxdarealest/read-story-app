import React from 'react';
import { BookOpen, Minus, Square, X } from 'lucide-react';

interface TitleBarProps {
  currentBookTitle?: string;
  onBackToLibrary?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({ currentBookTitle, onBackToLibrary }) => {
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div className="h-9 bg-neutral-950 text-neutral-300 border-b border-neutral-800 flex items-center justify-between px-3 select-none text-xs z-50">
      {/* Left: App icon & Title */}
      <div className="flex items-center space-x-2.5">
        <button
          onClick={onBackToLibrary}
          className="flex items-center space-x-2 text-neutral-300 hover:text-white transition-colors cursor-pointer group"
          title="Về kệ sách"
        >
          <div className="w-5 h-5 rounded bg-amber-600/20 text-amber-500 border border-amber-500/30 flex items-center justify-center group-hover:bg-amber-600/30">
            <BookOpen className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold tracking-wide text-neutral-200">Trình Đọc Truyện</span>
        </button>

        {currentBookTitle && (
          <>
            <span className="text-neutral-600">/</span>
            <span className="text-neutral-300 font-medium truncate max-w-[280px]">
              {currentBookTitle}
            </span>
          </>
        )}
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center space-x-1 -mr-1">
        <button
          onClick={handleToggleFullscreen}
          className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200 transition-colors"
          title="Thu nhỏ / Phóng to (F11)"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={handleToggleFullscreen}
          className="p-1.5 hover:bg-neutral-800 rounded text-neutral-400 hover:text-neutral-200 transition-colors"
          title="Toàn màn hình"
        >
          <Minus className="w-3 h-3" />
        </button>
        <button
          onClick={() => {
            if (onBackToLibrary) onBackToLibrary();
          }}
          className="p-1.5 hover:bg-red-900/60 hover:text-red-300 rounded text-neutral-400 transition-colors"
          title="Đóng / Về Kệ sách"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
