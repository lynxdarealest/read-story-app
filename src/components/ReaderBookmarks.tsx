import React from 'react';
import { X, Bookmark, Trash2, ExternalLink, Download, FileText, Plus, MessageSquare } from 'lucide-react';
import { Bookmark as BookmarkType } from '../types';

interface ReaderBookmarksProps {
  isOpen: boolean;
  onClose: () => void;
  bookmarks: BookmarkType[];
  onSelectBookmark: (bookmark: BookmarkType) => void;
  onDeleteBookmark: (bookmarkId: string) => void;
  onAddBookmarkCurrent: () => void;
}

export const ReaderBookmarks: React.FC<ReaderBookmarksProps> = ({
  isOpen,
  onClose,
  bookmarks,
  onSelectBookmark,
  onDeleteBookmark,
  onAddBookmarkCurrent,
}) => {
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
            Dấu trang & Ghi chú ({bookmarks.length})
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

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
              Nhấn nút phía trên hoặc phím tắt <kbd className="px-1 py-0.5 bg-neutral-800 rounded font-mono text-neutral-400">B</kbd> khi đang đọc.
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
                    className="flex items-center space-x-1 px-2 py-0.5 rounded bg-neutral-800 hover:bg-amber-600 text-neutral-200 hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Tới vị trí</span>
                  </button>
                  <button
                    onClick={() => onDeleteBookmark(bm.id)}
                    className="p-1 rounded hover:bg-red-900/40 text-neutral-500 hover:text-red-400 transition-colors"
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
    </div>
  );
};
