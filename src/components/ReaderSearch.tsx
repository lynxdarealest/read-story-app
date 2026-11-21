import React from 'react';
import { X, Search, BookOpen, Layers, ArrowRight } from 'lucide-react';
import { Chapter } from '../types';

interface SearchResult {
  chapterIndex: number;
  chapterTitle: string;
  snippet: string;
  matchIndex: number;
}

interface ReaderSearchProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: Chapter[];
  currentChapterIndex: number;
  initialQuery?: string;
  onJumpToResult: (chapterIndex: number, textSnippet: string) => void;
}

export const ReaderSearch: React.FC<ReaderSearchProps> = ({
  isOpen,
  onClose,
  chapters,
  currentChapterIndex,
  initialQuery,
  onJumpToResult,
}) => {
  const [searchQuery, setSearchQuery] = React.useState(initialQuery || '');
  const [searchScope, setSearchScope] = React.useState<'chapter' | 'book'>('chapter');
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      if (initialQuery) {
        setSearchQuery(initialQuery);
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, initialQuery]);

  // Execute search
  const handleSearch = () => {
    const q = searchQuery.trim();
    if (!q) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const matches: SearchResult[] = [];
    const targetChapters =
      searchScope === 'chapter'
        ? [chapters[currentChapterIndex]].filter(Boolean)
        : chapters;

    const lowerQ = q.toLowerCase();

    for (const ch of targetChapters) {
      const text = ch.content;
      const lowerText = text.toLowerCase();
      let startIndex = 0;

      while (startIndex < lowerText.length) {
        const found = lowerText.indexOf(lowerQ, startIndex);
        if (found === -1) break;

        // Extract surrounding sentence/context
        const snippetStart = Math.max(0, found - 45);
        const snippetEnd = Math.min(text.length, found + q.length + 55);
        const snippet =
          (snippetStart > 0 ? '...' : '') +
          text.slice(snippetStart, snippetEnd).replace(/\n/g, ' ') +
          (snippetEnd < text.length ? '...' : '');

        matches.push({
          chapterIndex: ch.chapterIndex,
          chapterTitle: ch.title,
          snippet,
          matchIndex: found,
        });

        startIndex = found + q.length;
        if (matches.length >= 100) break; // Limit 100 matches for performance
      }

      if (matches.length >= 100) break;
    }

    setResults(matches);
    setIsSearching(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-84 bg-neutral-900 border-l border-neutral-800 shadow-2xl flex flex-col select-none animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
        <div className="flex items-center space-x-2">
          <Search className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
            Tìm kiếm nội dung
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input & Scope Toggle */}
      <div className="p-3 border-b border-neutral-800 bg-neutral-900 space-y-2.5">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            placeholder="Nhập từ hoặc cụm từ cần tìm..."
            className="w-full pr-8 pl-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={handleSearch}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-amber-500 hover:text-amber-400"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scope selector */}
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <button
            onClick={() => setSearchScope('chapter')}
            className={`py-1.5 px-2 rounded border text-center transition-colors cursor-pointer flex items-center justify-center space-x-1 ${
              searchScope === 'chapter'
                ? 'bg-amber-600/20 border-amber-500 text-amber-400 font-semibold'
                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3 h-3" />
            <span>Chương này</span>
          </button>
          <button
            onClick={() => setSearchScope('book')}
            className={`py-1.5 px-2 rounded border text-center transition-colors cursor-pointer flex items-center justify-center space-x-1 ${
              searchScope === 'book'
                ? 'bg-amber-600/20 border-amber-500 text-amber-400 font-semibold'
                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Toàn bộ truyện</span>
          </button>
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="text-[11px] text-neutral-500 font-medium">
          {results.length > 0
            ? `Tìm thấy ${results.length} kết quả:`
            : searchQuery && !isSearching
            ? 'Không tìm thấy kết quả phù hợp.'
            : 'Nhập từ khóa và nhấn Enter để tìm.'}
        </div>

        {results.map((res, i) => (
          <div
            key={i}
            onClick={() => {
              onJumpToResult(res.chapterIndex, res.snippet);
              onClose();
            }}
            className="p-2.5 bg-neutral-950 border border-neutral-800 hover:border-amber-500/50 rounded-lg cursor-pointer transition-all hover:bg-neutral-850 group"
          >
            <div className="text-[10px] font-semibold text-amber-400 truncate mb-1">
              {res.chapterTitle}
            </div>
            <p className="text-xs text-neutral-300 font-serif leading-relaxed line-clamp-3">
              {res.snippet}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
