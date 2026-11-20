import React from 'react';
import { Search, LayoutGrid, List, SlidersHorizontal, BookPlus, UploadCloud } from 'lucide-react';
import { Book, BookStatus } from '../types';
import { BookCard } from './BookCard';
import { LibraryFilter } from './Sidebar';

interface BookGridProps {
  books: Book[];
  currentFilter: LibraryFilter;
  viewMode: 'grid' | 'list';
  onToggleViewMode: (mode: 'grid' | 'list') => void;
  onOpenReader: (book: Book) => void;
  onOpenDetails: (book: Book) => void;
  onToggleFavorite: (book: Book, e: React.MouseEvent) => void;
  onDeleteBook: (bookId: string, e: React.MouseEvent) => void;
  onOpenImport: () => void;
}

export const BookGrid: React.FC<BookGridProps> = ({
  books,
  currentFilter,
  viewMode,
  onToggleViewMode,
  onOpenReader,
  onOpenDetails,
  onToggleFavorite,
  onDeleteBook,
  onOpenImport,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'recent' | 'title' | 'progress' | 'date'>('recent');
  const [formatFilter, setFormatFilter] = React.useState<string>('all');

  // Filter books
  const filteredBooks = React.useMemo(() => {
    return books.filter((b) => {
      // Sidebar filter
      if (currentFilter === 'history') {
        if (!b.lastReadTimestamp || b.lastReadTimestamp === 0) return false;
      } else if (currentFilter !== 'all') {
        if (b.status !== currentFilter) return false;
      }

      // Format filter
      if (formatFilter !== 'all' && b.format !== formatFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = b.title.toLowerCase().includes(q);
        const matchAuthor = b.author?.toLowerCase().includes(q);
        const matchTag = b.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchAuthor && !matchTag) return false;
      }

      return true;
    });
  }, [books, currentFilter, formatFilter, searchQuery]);

  // Sort books
  const sortedBooks = React.useMemo(() => {
    const list = [...filteredBooks];
    list.sort((a, b) => {
      if (sortBy === 'recent') {
        return (b.lastReadTimestamp || 0) - (a.lastReadTimestamp || 0);
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title, 'vi');
      }
      if (sortBy === 'progress') {
        const progA = a.totalChapters > 0 ? (a.currentChapterIndex + a.scrollProgress) / a.totalChapters : 0;
        const progB = b.totalChapters > 0 ? (b.currentChapterIndex + b.scrollProgress) / b.totalChapters : 0;
        return progB - progA;
      }
      if (sortBy === 'date') {
        return (b.addedTimestamp || 0) - (a.addedTimestamp || 0);
      }
      return 0;
    });
    return list;
  }, [filteredBooks, sortBy]);

  const filterTitles: Record<LibraryFilter, string> = {
    all: 'Thư viện',
    reading: 'Đang đọc',
    unread: 'Chưa đọc',
    completed: 'Đã hoàn thành',
    favorite: 'Yêu thích',
    archived: 'Đã lưu trữ',
    history: 'Lịch sử',
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden select-none">
      {/* Top action bar: Search, filters, sort, view toggles */}
      <div className="p-4 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 bg-neutral-900/60 backdrop-blur-md">
        <div>
          <h1 className="text-lg font-bold text-neutral-100 flex items-center space-x-2">
            <span>{filterTitles[currentFilter]}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-mono">
              {sortedBooks.length} truyện
            </span>
          </h1>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-3">
          {/* Search bar */}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên truyện, tác giả..."
              className="w-full pl-9 pr-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Format filter */}
          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-300 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="all">Định dạng: Tất cả</option>
            <option value="TXT">TXT</option>
            <option value="EPUB">EPUB</option>
            <option value="MD">Markdown</option>
            <option value="HTML">HTML</option>
            <option value="WEB">WEB (URL)</option>
          </select>

          {/* Sort order */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-300 focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="recent">Đọc gần nhất</option>
            <option value="title">Tên truyện A-Z</option>
            <option value="progress">Tiến độ cao nhất</option>
            <option value="date">Ngày thêm mới</option>
          </select>

          {/* View mode toggle */}
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
            <button
              onClick={() => onToggleViewMode('grid')}
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-neutral-800 text-amber-400' : 'text-neutral-400 hover:text-white'
              }`}
              title="Dạng lưới"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onToggleViewMode('list')}
              className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-neutral-800 text-amber-400' : 'text-neutral-400 hover:text-white'
              }`}
              title="Dạng danh sách"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-5">
        {sortedBooks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-sm mx-auto">
            <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500 mb-3">
              <UploadCloud className="w-6 h-6 text-amber-500/80" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-200">
              {searchQuery ? 'Không tìm thấy kết quả' : 'Chưa có truyện'}
            </h3>
            <button
              onClick={onOpenImport}
              className="mt-3 flex items-center space-x-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm cursor-pointer"
            >
              <BookPlus className="w-3.5 h-3.5" />
              <span>Thêm truyện</span>
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {sortedBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                viewMode="grid"
                onOpenReader={onOpenReader}
                onOpenDetails={onOpenDetails}
                onToggleFavorite={onToggleFavorite}
                onDeleteBook={onDeleteBook}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2 max-w-4xl mx-auto">
            {sortedBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                viewMode="list"
                onOpenReader={onOpenReader}
                onOpenDetails={onOpenDetails}
                onToggleFavorite={onToggleFavorite}
                onDeleteBook={onDeleteBook}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
