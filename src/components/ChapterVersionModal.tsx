import React from 'react';
import {
  X,
  History,
  RotateCcw,
  Trash2,
  Calendar,
  FileText,
  Check,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { Chapter, ChapterVersion } from '../types';
import { getChapterVersions, deleteChapterVersion } from '../services/storage';

interface ChapterVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapter: Chapter;
  onRestoreVersion: (content: string, title?: string, summary?: string) => void;
  onRestoreOriginal: () => void;
}

export const ChapterVersionModal: React.FC<ChapterVersionModalProps> = ({
  isOpen,
  onClose,
  chapter,
  onRestoreVersion,
  onRestoreOriginal,
}) => {
  const [versions, setVersions] = React.useState<ChapterVersion[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedVersionId, setSelectedVersionId] = React.useState<string | 'original'>('original');
  const [diffMode, setDiffMode] = React.useState<'diff' | 'full'>('diff');

  React.useEffect(() => {
    if (!isOpen) return;
    loadVersions();
  }, [isOpen, chapter.id]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const list = await getChapterVersions(chapter.id);
      setVersions(list);
      if (list.length > 0) {
        setSelectedVersionId(list[0].id);
      } else {
        setSelectedVersionId('original');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const originalContent = chapter.originalContent || chapter.content;
  const originalTitle = chapter.originalTitle || chapter.title;

  const selectedVersion =
    selectedVersionId === 'original'
      ? {
          id: 'original',
          chapterId: chapter.id,
          bookId: chapter.bookId,
          chapterIndex: chapter.chapterIndex,
          title: originalTitle,
          content: originalContent,
          timestamp: 0,
          summary: 'Bản gốc ban đầu (khi nhập truyện)',
        }
      : versions.find((v) => v.id === selectedVersionId);

  const selectedContent = selectedVersion?.content || '';

  // Generate lightweight paragraph-level diff
  const diffLines = React.useMemo(() => {
    if (!selectedContent) return [];
    const sourceParas = selectedContent.split(/\r?\n+/).map((p) => p.trim()).filter(Boolean);
    const currentParas = chapter.content.split(/\r?\n+/).map((p) => p.trim()).filter(Boolean);

    const result: Array<{ type: 'same' | 'added' | 'removed'; text: string }> = [];
    const maxLen = Math.max(sourceParas.length, currentParas.length);

    for (let i = 0; i < maxLen; i++) {
      const s = sourceParas[i];
      const c = currentParas[i];
      if (s === c && s) {
        result.push({ type: 'same', text: s });
      } else {
        if (s && !currentParas.includes(s)) {
          result.push({ type: 'removed', text: s });
        }
        if (c && !sourceParas.includes(c)) {
          result.push({ type: 'added', text: c });
        } else if (s && c && s !== c) {
          result.push({ type: 'removed', text: s });
          result.push({ type: 'added', text: c });
        }
      }
    }
    return result;
  }, [selectedContent, chapter.content]);

  const handleDeleteVersion = async (verId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bản lưu này không?')) return;
    await deleteChapterVersion(verId);
    await loadVersions();
  };

  const handleApplyRestore = () => {
    if (selectedVersionId === 'original') {
      onRestoreOriginal();
    } else if (selectedVersion) {
      onRestoreVersion(selectedVersion.content, selectedVersion.title, `Khôi phục từ bản lưu ${new Date(selectedVersion.timestamp).toLocaleString('vi-VN')}`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden select-none">
        {/* Header */}
        <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <div className="flex items-center space-x-2">
            <History className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-neutral-100">Lịch sử phiên bản chương</h2>
            <span className="text-xs text-neutral-400 font-normal">({chapter.title})</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body: Left sidebar version list, Right diff preview */}
        <div className="flex-1 flex min-h-0 divide-x divide-neutral-800">
          {/* Left: Versions List */}
          <div className="w-64 bg-neutral-950/60 overflow-y-auto p-3 space-y-2 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-1">
              Các bản lưu
            </span>

            {/* Original Snapshot */}
            <div
              onClick={() => setSelectedVersionId('original')}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                selectedVersionId === 'original'
                  ? 'bg-amber-600/15 border-amber-500/50 text-amber-200'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs">Bản gốc ban đầu</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">
                  Gốc
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1 truncate">
                {originalTitle}
              </p>
              <span className="text-[10px] text-neutral-400 mt-1 block">
                {originalContent.trim().split(/\s+/).filter(Boolean).length} từ
              </span>
            </div>

            {/* Version List */}
            {versions.map((ver, idx) => {
              const isSelected = selectedVersionId === ver.id;
              const dateStr = new Date(ver.timestamp).toLocaleString('vi-VN', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });
              const wordCount = ver.content.trim().split(/\s+/).filter(Boolean).length;
              const diffWord = wordCount - chapter.wordCount;

              return (
                <div
                  key={ver.id}
                  onClick={() => setSelectedVersionId(ver.id)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-amber-600/15 border-amber-500/50 text-amber-200'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs">Bản #{versions.length - idx}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVersion(ver.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-red-400 transition-opacity"
                      title="Xóa bản lưu này"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <p className="text-[11px] text-neutral-300 mt-0.5 truncate">{ver.summary}</p>

                  <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-1.5 font-mono">
                    <span>{dateStr}</span>
                    <span>
                      {wordCount} từ{' '}
                      {diffWord !== 0 && (
                        <span className={diffWord > 0 ? 'text-emerald-400' : 'text-red-400'}>
                          ({diffWord > 0 ? `+${diffWord}` : diffWord})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}

            {versions.length === 0 && (
              <div className="p-3 text-center text-neutral-400 text-xs">
                Chưa có lịch sử chỉnh sửa nào được lưu thêm.
              </div>
            )}
          </div>

          {/* Right: Diff & Preview Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-neutral-900">
            {/* Diff Toolbar */}
            <div className="px-4 py-2 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80 text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-neutral-400">Xem so sánh:</span>
                <div className="flex rounded-lg bg-neutral-900 border border-neutral-800 p-0.5">
                  <button
                    onClick={() => setDiffMode('diff')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      diffMode === 'diff' ? 'bg-amber-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Khác biệt (Diff)
                  </button>
                  <button
                    onClick={() => setDiffMode('full')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      diffMode === 'full' ? 'bg-amber-600 text-white' : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    Văn bản bản này
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2 text-[11px] text-neutral-400">
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500/50" />
                  <span>Đã thêm</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span className="w-2.5 h-2.5 rounded bg-red-500/20 border border-red-500/50" />
                  <span>Đã bớt</span>
                </span>
              </div>
            </div>

            {/* Comparison Content */}
            <div className="flex-1 overflow-y-auto p-5 text-sm font-serif leading-relaxed text-neutral-300">
              {diffMode === 'diff' ? (
                <div className="space-y-2">
                  {diffLines.length === 0 ? (
                    <div className="text-center py-12 text-neutral-400 text-xs font-sans">
                      Nội dung bản này hoàn toàn trùng khớp với nội dung hiện tại.
                    </div>
                  ) : (
                    diffLines.map((line, idx) => {
                      if (line.type === 'same') {
                        return (
                          <p key={idx} className="opacity-75 pl-2">
                            {line.text}
                          </p>
                        );
                      }
                      if (line.type === 'added') {
                        return (
                          <div
                            key={idx}
                            className="p-1.5 rounded bg-emerald-950/40 border-l-2 border-emerald-500 text-emerald-200 text-xs font-sans"
                          >
                            + {line.text}
                          </div>
                        );
                      }
                      return (
                        <div
                          key={idx}
                          className="p-1.5 rounded bg-red-950/40 border-l-2 border-red-500 text-red-300 text-xs font-sans line-through opacity-75"
                        >
                          - {line.text}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="space-y-3 whitespace-pre-wrap">
                  {selectedContent}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between">
          <div className="text-xs text-neutral-400 flex items-center space-x-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>Khôi phục sẽ thay thế nội dung chương hiện tại bằng bản được chọn.</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={handleApplyRestore}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Khôi phục bản này</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
