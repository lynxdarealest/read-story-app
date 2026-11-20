import React from 'react';
import {
  X,
  Replace,
  Search,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Check,
  AlertCircle
} from 'lucide-react';
import { Chapter } from '../types';

interface ReaderFindReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentChapter: Chapter;
  chapters: Chapter[];
  initialSearchText?: string;
  onUpdateChapterContent: (chapterId: string, newContent: string, summary: string) => Promise<void>;
  onBatchUpdateChapters: (updatedChapters: Chapter[], summary: string) => Promise<void>;
}

export const ReaderFindReplaceModal: React.FC<ReaderFindReplaceModalProps> = ({
  isOpen,
  onClose,
  currentChapter,
  chapters,
  initialSearchText = '',
  onUpdateChapterContent,
  onBatchUpdateChapters,
}) => {
  const [searchTerm, setSearchTerm] = React.useState(initialSearchText);
  const [replaceTerm, setReplaceTerm] = React.useState('');
  const [matchCase, setMatchCase] = React.useState(false);
  const [useRegex, setUseRegex] = React.useState(false);
  const [scope, setScope] = React.useState<'chapter' | 'book'>('chapter');

  // Match statistics & navigation
  const [currentMatchIndex, setCurrentMatchIndex] = React.useState(0);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  // Undo stack for replacements made in this session
  const [undoSnapshot, setUndoSnapshot] = React.useState<{
    scope: 'chapter' | 'book';
    chapters: Chapter[];
  } | null>(null);

  React.useEffect(() => {
    if (initialSearchText) {
      setSearchTerm(initialSearchText);
    }
  }, [initialSearchText]);

  // Compute matches
  const matchResults = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return { total: 0, byChapter: new Map<string, number>() };
    }

    try {
      let regex: RegExp;
      const flags = matchCase ? 'g' : 'gi';
      if (useRegex) {
        regex = new RegExp(searchTerm, flags);
      } else {
        const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(escaped, flags);
      }

      const byChapter = new Map<string, number>();
      let total = 0;

      const targetList = scope === 'chapter' ? [currentChapter] : chapters;

      for (const ch of targetList) {
        const matches = ch.content.match(regex);
        const count = matches ? matches.length : 0;
        if (count > 0) {
          byChapter.set(ch.id, count);
          total += count;
        }
      }

      return { total, byChapter };
    } catch {
      return { total: 0, byChapter: new Map<string, number>(), error: 'Regex không hợp lệ' };
    }
  }, [searchTerm, matchCase, useRegex, scope, currentChapter, chapters]);

  if (!isOpen) return null;

  // Single replace
  const handleReplaceSingle = async () => {
    if (!searchTerm.trim()) return;

    try {
      const flags = matchCase ? '' : 'i';
      const regex = useRegex
        ? new RegExp(searchTerm, flags)
        : new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

      if (!regex.test(currentChapter.content)) {
        setStatusMessage('Không còn kết quả nào trong chương này');
        return;
      }

      // Save undo snapshot
      setUndoSnapshot({
        scope: 'chapter',
        chapters: [{ ...currentChapter }],
      });

      const newContent = currentChapter.content.replace(regex, replaceTerm);
      await onUpdateChapterContent(currentChapter.id, newContent, `Thay thế "${searchTerm}" -> "${replaceTerm}"`);
      setStatusMessage('Đã thay thế 1 vị trí');
    } catch (err: any) {
      setStatusMessage(`Lỗi: ${err.message}`);
    }
  };

  // Replace all in scope
  const handleReplaceAll = async () => {
    if (!searchTerm.trim()) return;
    if (matchResults.total === 0) {
      setStatusMessage('Không tìm thấy kết quả để thay thế');
      return;
    }

    try {
      const flags = matchCase ? 'g' : 'gi';
      const regex = useRegex
        ? new RegExp(searchTerm, flags)
        : new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

      if (scope === 'chapter') {
        setUndoSnapshot({
          scope: 'chapter',
          chapters: [{ ...currentChapter }],
        });

        const newContent = currentChapter.content.replace(regex, replaceTerm);
        await onUpdateChapterContent(
          currentChapter.id,
          newContent,
          `Thay thế ${matchResults.total} vị trí "${searchTerm}" -> "${replaceTerm}"`
        );
        setStatusMessage(`Đã thay thế ${matchResults.total} vị trí trong chương`);
      } else {
        // Entire book
        setUndoSnapshot({
          scope: 'book',
          chapters: chapters.map((c) => ({ ...c })),
        });

        const updatedChapters: Chapter[] = [];
        for (const ch of chapters) {
          if (regex.test(ch.content)) {
            updatedChapters.push({
              ...ch,
              content: ch.content.replace(regex, replaceTerm),
            });
          }
        }

        await onBatchUpdateChapters(
          updatedChapters,
          `Thay thế ${matchResults.total} vị trí trong toàn bộ truyện`
        );
        setStatusMessage(`Đã thay thế ${matchResults.total} vị trí trong ${updatedChapters.length} chương`);
      }
    } catch (err: any) {
      setStatusMessage(`Lỗi: ${err.message}`);
    }
  };

  // Undo last replacement batch
  const handleUndo = async () => {
    if (!undoSnapshot) return;

    try {
      if (undoSnapshot.scope === 'chapter' && undoSnapshot.chapters.length > 0) {
        const prev = undoSnapshot.chapters[0];
        await onUpdateChapterContent(prev.id, prev.content, 'Hoàn tác thay thế');
      } else if (undoSnapshot.scope === 'book') {
        await onBatchUpdateChapters(undoSnapshot.chapters, 'Hoàn tác thay thế toàn bộ');
      }
      setUndoSnapshot(null);
      setStatusMessage('Đã hoàn tác thao tác thay thế vừa rồi');
    } catch (err: any) {
      setStatusMessage(`Lỗi khi hoàn tác: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden select-none animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <div className="flex items-center space-x-2">
            <Replace className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-neutral-100">Tìm kiếm & Thay thế</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Search Input */}
          <div className="space-y-1.5">
            <label className="text-neutral-300 font-medium flex items-center justify-between">
              <span>Tìm kiếm</span>
              <span className="text-[11px] text-amber-400 font-mono">
                {matchResults.total > 0
                  ? `Tìm thấy ${matchResults.total} kết quả`
                  : searchTerm
                  ? '0 kết quả'
                  : ''}
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setStatusMessage(null);
                }}
                placeholder="Nhập từ hoặc cụm từ cần tìm..."
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
                autoFocus
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Replace Input */}
          <div className="space-y-1.5">
            <label className="text-neutral-300 font-medium">Thay thế bằng</label>
            <input
              type="text"
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              placeholder="Nhập văn bản thay thế (hoặc để trống để xóa)..."
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-amber-500"
            />
          </div>

          {/* Options & Scope */}
          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Phạm vi:</span>
              <div className="flex rounded-lg bg-neutral-900 border border-neutral-800 p-0.5">
                <button
                  type="button"
                  onClick={() => setScope('chapter')}
                  className={`px-3 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    scope === 'chapter' ? 'bg-amber-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Chương này
                </button>
                <button
                  type="button"
                  onClick={() => setScope('book')}
                  className={`px-3 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    scope === 'book' ? 'bg-amber-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Toàn bộ truyện ({chapters.length} chương)
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-6 pt-1 text-neutral-300">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={matchCase}
                  onChange={(e) => setMatchCase(e.target.checked)}
                  className="accent-amber-500 rounded"
                />
                <span>Phân biệt hoa / thường (Aa)</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useRegex}
                  onChange={(e) => setUseRegex(e.target.checked)}
                  className="accent-amber-500 rounded"
                />
                <span>Biểu thức chính quy (Regex)</span>
              </label>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div className="p-2.5 rounded-lg bg-neutral-800/80 border border-neutral-700 text-neutral-200 flex items-center justify-between">
              <span>{statusMessage}</span>
              {undoSnapshot && (
                <button
                  onClick={handleUndo}
                  className="flex items-center space-x-1 text-amber-400 hover:underline font-semibold cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Hoàn tác</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between">
          <div>
            {undoSnapshot && (
              <button
                onClick={handleUndo}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 text-xs font-medium cursor-pointer"
                title="Hoàn tác lần thay thế trước"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Hoàn tác</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium cursor-pointer"
            >
              Đóng
            </button>
            <button
              onClick={handleReplaceSingle}
              disabled={matchResults.total === 0 || scope !== 'chapter'}
              className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold disabled:opacity-40 cursor-pointer"
            >
              Thay thế 1
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={matchResults.total === 0}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold disabled:opacity-40 shadow-md cursor-pointer"
            >
              <Replace className="w-3.5 h-3.5" />
              <span>Thay thế tất cả ({matchResults.total})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
