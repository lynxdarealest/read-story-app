import React from 'react';
import { BookOpen, MoreVertical, Heart, Bookmark, CheckCircle, Trash2, Edit3, Eye } from 'lucide-react';
import { Book } from '../types';

interface BookCardProps {
  book: Book;
  viewMode: 'grid' | 'list';
  onOpenReader: (book: Book) => void;
  onOpenDetails: (book: Book) => void;
  onToggleFavorite: (book: Book, e: React.MouseEvent) => void;
  onDeleteBook: (bookId: string, e: React.MouseEvent) => void;
}

// Procedural book cover colors based on title hash for books without cover image
const COVER_GRADIENTS = [
  'from-amber-900 via-amber-800 to-amber-950',
  'from-emerald-900 via-teal-900 to-slate-950',
  'from-indigo-950 via-slate-900 to-neutral-950',
  'from-rose-950 via-red-900 to-neutral-950',
  'from-cyan-950 via-blue-900 to-slate-950',
  'from-amber-950 via-stone-900 to-stone-950',
];

function getCoverGradient(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COVER_GRADIENTS.length;
  return COVER_GRADIENTS[index];
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  viewMode,
  onOpenReader,
  onOpenDetails,
  onToggleFavorite,
  onDeleteBook,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const progressPercent = Math.min(
    100,
    Math.max(
      0,
      book.totalChapters > 0
        ? Math.round(((book.currentChapterIndex + (book.scrollProgress || 0)) / book.totalChapters) * 100)
        : 0
    )
  );

  const formatBadgeColors: Record<string, string> = {
    TXT: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    EPUB: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    HTML: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    MD: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    WEB: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  };

  if (viewMode === 'list') {
    return (
      <div
        onClick={() => onOpenReader(book)}
        className="group relative flex items-center justify-between p-3 bg-neutral-900 hover:bg-neutral-800/90 border border-neutral-800 hover:border-neutral-700 rounded-xl transition-all cursor-pointer select-none"
      >
        <div className="flex items-center space-x-3.5 min-w-0 flex-1">
          {/* Small thumbnail */}
          <div className="w-12 h-16 rounded-md overflow-hidden shrink-0 shadow bg-neutral-950 flex items-center justify-center relative border border-neutral-700/50">
            {book.coverUrl ? (
              <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${getCoverGradient(book.title)} p-1 flex flex-col justify-between text-center`}>
                <div className="text-[7px] text-amber-300 font-bold uppercase tracking-wider truncate">
                  {book.format}
                </div>
                <div className="text-[9px] text-neutral-200 font-semibold line-clamp-2 leading-tight">
                  {book.title}
                </div>
                <div className="text-[6px] text-neutral-400 truncate">{book.author}</div>
              </div>
            )}
          </div>

          {/* Book Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono font-medium ${formatBadgeColors[book.format] || 'bg-neutral-800 text-neutral-300'}`}>
                {book.format}
              </span>
              <h3 className="text-sm font-semibold text-neutral-100 group-hover:text-amber-400 truncate transition-colors">
                {book.title}
              </h3>
            </div>

            <div className="flex items-center space-x-3 mt-1 text-xs text-neutral-400">
              <span className="truncate max-w-[140px]">{book.author || 'Khuyết danh'}</span>
              <span>•</span>
              <span>Chương {book.currentChapterIndex + 1}/{book.totalChapters}</span>
              <span>•</span>
              <span className="text-neutral-500 text-[11px]">
                {new Date(book.lastReadTimestamp).toLocaleDateString('vi-VN')}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-48 bg-neutral-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 shrink-0 ml-4" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => onToggleFavorite(book, e)}
            className={`p-2 rounded-lg hover:bg-neutral-700/60 transition-colors ${
              book.status === 'favorite' ? 'text-rose-500' : 'text-neutral-500 hover:text-neutral-300'
            }`}
            title="Yêu thích"
          >
            <Heart className={`w-4 h-4 ${book.status === 'favorite' ? 'fill-current' : ''}`} />
          </button>

          <button
            onClick={() => onOpenReader(book)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-neutral-800 group-hover:bg-amber-600 text-neutral-200 group-hover:text-white rounded-lg text-xs font-medium transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Đọc</span>
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl py-1 text-xs text-neutral-200 z-30">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenDetails(book);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 hover:bg-neutral-700 text-left"
                >
                  <Eye className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Chi tiết truyện</span>
                </button>
                <button
                  onClick={(e) => {
                    setMenuOpen(false);
                    onDeleteBook(book.id, e);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 hover:bg-red-900/40 text-red-400 text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa khỏi thư viện</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      onClick={() => onOpenReader(book)}
      className="group relative flex flex-col bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer select-none"
    >
      {/* Cover representation */}
      <div className="relative aspect-[3/4.2] w-full overflow-hidden bg-neutral-950 flex items-center justify-center">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${getCoverGradient(
              book.title
            )} p-4 flex flex-col justify-between text-white border-l-4 border-amber-500/40 relative shadow-inner`}
          >
            {/* Book spine line styling */}
            <div className="absolute top-0 bottom-0 left-0 w-2.5 bg-black/25 border-r border-white/10" />

            <div className="flex items-center justify-between text-xs pl-2">
              <span className="text-[10px] font-mono tracking-widest text-amber-400 uppercase font-bold">
                {book.format}
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">
                {book.totalChapters} CH
              </span>
            </div>

            <div className="my-auto pl-2">
              <h3 className="font-serif font-bold text-base line-clamp-3 leading-snug drop-shadow-md text-amber-50 group-hover:text-amber-300 transition-colors">
                {book.title}
              </h3>
              <p className="text-xs text-amber-200/80 mt-1 font-serif italic truncate">
                {book.author || 'Khuyết danh'}
              </p>
            </div>

            <div className="text-[10px] text-neutral-400/90 font-mono pl-2 truncate">
              {book.sourceFileName}
            </div>
          </div>
        )}

        {/* Floating Quick Action Overlay */}
        <div
          className="absolute top-2 right-2 flex items-center space-x-1 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => onToggleFavorite(book, e)}
            className={`p-1.5 rounded-full backdrop-blur-md transition-all ${
              book.status === 'favorite'
                ? 'bg-rose-500/80 text-white'
                : 'bg-black/50 text-neutral-300 hover:text-white hover:bg-black/80'
            }`}
            title="Yêu thích"
          >
            <Heart className={`w-3.5 h-3.5 ${book.status === 'favorite' ? 'fill-current' : ''}`} />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 rounded-full bg-black/50 backdrop-blur-md text-neutral-300 hover:text-white hover:bg-black/80 transition-all"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl py-1 text-xs text-neutral-200 z-40">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenDetails(book);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 hover:bg-neutral-800 text-left"
                >
                  <Eye className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Chi tiết & Đổi bìa</span>
                </button>
                <button
                  onClick={(e) => {
                    setMenuOpen(false);
                    onDeleteBook(book.id, e);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 hover:bg-red-900/40 text-red-400 text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa khỏi thư viện</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar at bottom of cover */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60">
          <div
            className="h-full bg-amber-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Book title & details below */}
      <div className="p-2.5 flex flex-col justify-between flex-1">
        <div>
          <h4 className="font-medium text-xs text-neutral-100 group-hover:text-amber-400 line-clamp-1 transition-colors" title={book.title}>
            {book.title}
          </h4>
          <p className="text-[11px] text-neutral-400 truncate mt-0.5">
            {book.author || 'Khuyết danh'}
          </p>
        </div>

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-800/80 text-[10px] text-neutral-500">
          <span>Chương {book.currentChapterIndex + 1}/{book.totalChapters}</span>
          <span className="font-mono text-amber-500/90 font-medium">{progressPercent}%</span>
        </div>
      </div>
    </div>
  );
};
