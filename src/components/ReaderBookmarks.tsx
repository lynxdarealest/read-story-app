import React from 'react';
import { X, Bookmark, Trash2, ExternalLink, Download, Plus, MessageSquare, Highlighter } from 'lucide-react';
import { Bookmark as BookmarkType, Highlight } from '../types';

interface ReaderBookmarksProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: BookmarkType[];
  highlights?: Highlight[];
  onSelectBookmark: (bookmark: BookmarkType) => void;
  onDeleteBookmark: (bookmarkId: string) => void;
  onSelectHighlight?: (highlight: Highlight) => void;
  onDeleteHighlight?: (highlightId: string) => void;
  onAddBookmarkCurrent: () => void;
}

const HL_BADGE_CLASSES: Record<Highlight['color'], string> = {
  yellow: 'border-amber-400 bg-amber-500/15',
  green: 'border-emerald-400 bg-emerald-500/15',
  blue: 'border-sky-400 bg-sky-500/15',
  pink: 'border-pink-400 bg-pink-500/15',
  purple: 'border-purple-400 bg-purple-500/15',
};

export const ReaderBookmarks: React.FC<ReaderBookmarksProps> = ({
  isOpen,
  onClose,
  bookmarks,
  highlights = [],
  onSelectBookmark,
  onDeleteBookmark,
  onSelectHighlight,
  onDeleteHighlight,
  onAddBookmarkCurrent,
}) => {
  const [activeTab, setActiveTab] = React.useState<'bookmarks' | 'highlights'>('bookmarks');

  if (!isOpen) return null;

  const handleExportBookmarks = () => {
    if (bookmarks.length === 0) return;
    const text = bookmarks
      .map(
        (b, i) =>
          `### ${i + 1}. ${b.chapterTitle} (${b.progressPercent}%)\n> ${b.textSnippet}\n${
            b.note ? `*Ghi chú: ${b.note}*\n` : ''
          }*Thời gian: ${new Date(b.createdAt).toLocaleString('vi-VN')}*\n`
      )
      .join('\n---\n\n');

    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bookmarks_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-84 bg-neutral-900 border-l border-neutral-800 shadow-2xl flex flex-col select-none animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
        <div className="flex items-center space-x-2">
          <Bookmark className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
            Dấu trang & Tô sáng
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="p-2 border-b border-neutral-800 bg-neutral-950/70">
        <div className="grid grid-cols-2 gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('bookmarks')}
            className={`flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === 'bookmarks'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Dấu trang ({bookmarks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('highlights')}
            className={`flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-md font-medium transition-colors cursor-pointer ${
              activeTab === 'highlights'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Highlighter className="w-3.5 h-3.5" />
            <span>Tô sáng ({highlights.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'bookmarks' ? (
        <>
          {/* Action Bar */}
          <div className="p-2.5 border-b border-neutral-800 bg-neutral-900 flex items-center space-x-2">
            <button
              onClick={onAddBookmarkCurrent}
              className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Đánh dấu vị trí hiện tại</span>
            </button>

            {bookmarks.length > 0 && (
              <button
                onClick={handleExportBookmarks}
                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors cursor-pointer"
                title="Xuất danh sách dấu trang (Markdown)"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Bookmarks List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {bookmarks.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-center text-xs text-neutral-500">
                <Bookmark className="w-8 h-8 text-neutral-700 mb-2" />
                <p>Chưa có dấu trang nào được lưu.</p>
                <p className="text-[11px] text-neutral-600 mt-1">
                  Nhấn nút phía trên hoặc phím tắt{' '}
                  <kbd className="px-1 py-0.5 bg-neutral-800 rounded font-mono text-neutral-400">B</kbd> khi đang đọc.
                </p>
              </div>
            ) : (
              bookmarks.map((bm) => (
                <div
                  key={bm.id}
                  className="p-3 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 rounded-xl space-y-2 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-amber-400 truncate max-w-[190px]">
                      {bm.chapterTitle}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {bm.progressPercent}%
                    </span>
                  </div>

                  {bm.textSnippet && (
                    <p className="text-xs text-neutral-300 italic line-clamp-2 font-serif border-l-2 border-amber-500/40 pl-2 leading-relaxed">
                      "{bm.textSnippet}"
                    </p>
                  )}

                  {bm.note && (
                    <div className="flex items-start space-x-1.5 text-[11px] text-neutral-400 bg-neutral-900 p-2 rounded">
                      <MessageSquare className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                      <span>{bm.note}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-neutral-900 text-[10px] text-neutral-500">
                    <span>{new Date(bm.createdAt).toLocaleDateString('vi-VN')}</span>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => {
                          onSelectBookmark(bm);
                          onClose();
                        }}
                        className="flex items-center space-x-1 px-2 py-0.5 rounded bg-neutral-800 hover:bg-amber-600 text-neutral-200 hover:text-white transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Tới vị trí</span>
                      </button>
                      <button
                        onClick={() => onDeleteBookmark(bm.id)}
                        className="p-1 rounded hover:bg-red-900/40 text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                        title="Xóa dấu trang"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* Highlights List */
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {highlights.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-center text-xs text-neutral-500 px-4">
              <Highlighter className="w-8 h-8 text-neutral-700 mb-2" />
              <p>Chưa có đoạn văn nào được tô sáng.</p>
              <p className="text-[11px] text-neutral-600 mt-1">
                Bôi đen đoạn văn bất kỳ khi đang đọc và chọn biểu tượng bút tô màu.
              </p>
            </div>
          ) : (
            highlights.map((hl) => (
              <div
                key={hl.id}
                className="p-3 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 rounded-xl space-y-2 transition-colors"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-amber-400">
                    Chương {hl.chapterIndex + 1}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    {new Date(hl.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                <p className={`text-xs text-neutral-200 font-serif border-l-2 pl-2 py-1 rounded-r leading-relaxed line-clamp-3 ${HL_BADGE_CLASSES[hl.color] || HL_BADGE_CLASSES.yellow}`}>
                  {hl.text}
                </p>

                <div className="flex items-center justify-end space-x-1 pt-1 border-t border-neutral-900 text-[10px]">
                  {onSelectHighlight && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectHighlight(hl);
                        onClose();
                      }}
                      className="flex items-center space-x-1 px-2 py-0.5 rounded bg-neutral-800 hover:bg-amber-600 text-neutral-200 hover:text-white transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Tới vị trí</span>
                    </button>
                  )}
                  {onDeleteHighlight && (
                    <button
                      type="button"
                      onClick={() => onDeleteHighlight(hl.id)}
                      className="p-1 rounded hover:bg-red-900/40 text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                      title="Xóa tô sáng"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
