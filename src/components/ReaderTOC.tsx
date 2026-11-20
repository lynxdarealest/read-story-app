import React from 'react';
import { X, Search, Check, Hash } from 'lucide-react';
import { Chapter } from '../types';

interface ReaderTOCProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: Chapter[];
  currentChapterIndex: number;
  onSelectChapter: (index: number) => void;
  onOpenChapterManager?: () => void;
}

export const ReaderTOC: React.FC<ReaderTOCProps> = ({
  isOpen,
  onClose,
  chapters,
  currentChapterIndex,
  onSelectChapter,
  onOpenChapterManager,
}) => {
  const [search, setSearch] = React.useState('');
  const activeItemRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (isOpen && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredChapters = chapters.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-80 bg-neutral-900 border-r border-neutral-800 shadow-2xl flex flex-col select-none animate-in slide-in-from-left duration-200">
      {/* Header */}
      <div className="p-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
        <div className="flex items-center space-x-2">
          <Hash className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
            Mục lục ({chapters.length})
          </h3>
        </div>
        <div className="flex items-center space-x-1">
          {onOpenChapterManager && (
            <button
              onClick={() => {
                onClose();
                onOpenChapterManager();
              }}
              className="text-[11px] text-amber-400 hover:text-amber-300 px-2 py-0.5 rounded hover:bg-neutral-800 cursor-pointer"
              title="Quản lý & Tách chương"
            >
              Chỉnh sửa
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="p-2.5 border-b border-neutral-800 bg-neutral-900">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tên hoặc số chương..."
            className="w-full pl-8 pr-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Chapter List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filteredChapters.map((chapter) => {
          const isCurrent = chapter.chapterIndex === currentChapterIndex;
          const isRead = chapter.chapterIndex < currentChapterIndex;

          return (
            <button
              key={chapter.id}
              ref={isCurrent ? activeItemRef : null}
              onClick={() => {
                onSelectChapter(chapter.chapterIndex);
                onClose();
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                isCurrent
                  ? 'bg-amber-600/20 text-amber-300 font-semibold border border-amber-500/30'
                  : 'text-neutral-300 hover:bg-neutral-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0 flex-1 pr-2">
                <span className={`text-[10px] font-mono shrink-0 ${isCurrent ? 'text-amber-400' : 'text-neutral-500'}`}>
                  #{chapter.chapterIndex + 1}
                </span>
                <span className="truncate">{chapter.title}</span>
              </div>

              <div className="flex items-center space-x-1.5 shrink-0">
                {isRead && <Check className="w-3 h-3 text-neutral-600" />}
                <span className="text-[10px] text-neutral-500 font-mono">
                  {chapter.wordCount > 0 ? `${chapter.wordCount}t` : ''}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
