import React from 'react';
import {
  X,
  Save,
  Undo2,
  Redo2,
  History,
  RotateCcw,
  Sparkles,
  AlignLeft,
  Scissors,
  Check,
  AlertCircle
} from 'lucide-react';
import { Chapter } from '../types';

interface ChapterEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  chapter: Chapter;
  isTranslationMode?: boolean;
  titleOverride?: string;
  contentOverride?: string;
  initialParagraphIndex?: number;
  onSaveChapter: (chapterId: string, updatedTitle: string, updatedContent: string, summary: string) => Promise<void>;
  onOpenVersions: () => void;
  onRestoreOriginal: () => void;
}

export const ChapterEditorModal: React.FC<ChapterEditorModalProps> = ({
  isOpen,
  onClose,
  chapter,
  isTranslationMode = false,
  titleOverride,
  contentOverride,
  initialParagraphIndex,
  onSaveChapter,
  onOpenVersions,
  onRestoreOriginal,
}) => {
  const effectiveTitle = isTranslationMode && titleOverride !== undefined ? titleOverride : chapter.title;
  const effectiveContent = isTranslationMode && contentOverride !== undefined ? contentOverride : chapter.content;

  const [title, setTitle] = React.useState(effectiveTitle);
  const [content, setContent] = React.useState(effectiveContent);
  const [isSaving, setIsSaving] = React.useState(false);
  const [savedSuccess, setSavedSuccess] = React.useState(false);
  const [confirmRestoreOriginal, setConfirmRestoreOriginal] = React.useState(false);

  // Undo / Redo history
  const [history, setHistory] = React.useState<string[]>([effectiveContent]);
  const [historyIndex, setHistoryIndex] = React.useState(0);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setTitle(effectiveTitle);
      setContent(effectiveContent);
      setHistory([effectiveContent]);
      setHistoryIndex(0);
      setSavedSuccess(false);
      setConfirmRestoreOriginal(false);

      // If initialParagraphIndex specified, scroll to that paragraph
      if (initialParagraphIndex !== undefined && textareaRef.current) {
        setTimeout(() => {
          if (!textareaRef.current) return;
          const paras = effectiveContent.split(/\r?\n+/);
          let charOffset = 0;
          for (let i = 0; i < Math.min(initialParagraphIndex, paras.length); i++) {
            charOffset += paras[i].length + 2;
          }
          textareaRef.current.setSelectionRange(charOffset, charOffset);
          textareaRef.current.focus();
        }, 100);
      }
    }
  }, [isOpen, chapter.id, effectiveTitle, effectiveContent, initialParagraphIndex]);

  if (!isOpen) return null;

  const pushHistory = (newContent: string) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    updatedHistory.push(newContent);
    setHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length - 1);
    setContent(newContent);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
  };

  const handleBlur = () => {
    if (content !== history[historyIndex]) {
      pushHistory(content);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setContent(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setContent(next);
    }
  };

  // Keyboard shortcut for Undo / Redo and Save in modal
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      handleRedo();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  // Quick text formatting tools
  const handleCleanSpaces = () => {
    const lines = content.split(/\r?\n/);
    const cleaned = lines
      .map((l) => l.trim())
      .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
      .join('\n\n');
    pushHistory(cleaned);
  };

  const handleMergeShortParagraphs = () => {
    const lines = content.split(/\r?\n+/).map((l) => l.trim()).filter(Boolean);
    const merged: string[] = [];
    let buffer = '';

    for (const line of lines) {
      if (!buffer) {
        buffer = line;
      } else if (
        buffer.length < 80 &&
        !['.', '!', '?', ':', '"', '”', '»'].some((c) => buffer.endsWith(c))
      ) {
        buffer += ' ' + line;
      } else {
        merged.push(buffer);
        buffer = line;
      }
    }
    if (buffer) merged.push(buffer);

    pushHistory(merged.join('\n\n'));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveChapter(
        chapter.id,
        title.trim() || effectiveTitle,
        content,
        isTranslationMode ? 'Chỉnh sửa thủ công bản dịch' : 'Chỉnh sửa trực tiếp'
      );
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const originalContent = chapter.originalContent || chapter.content;
  const isModified = !isTranslationMode && (content !== originalContent || title !== (chapter.originalTitle || chapter.title));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden select-none animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <div className="flex items-center space-x-3 flex-1 min-w-0 mr-4">
            <span className="text-xs font-bold text-amber-500 uppercase tracking-wide shrink-0">
              {isTranslationMode ? 'Chỉnh sửa bản dịch:' : 'Chỉnh sửa chương:'}
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="px-3 py-1 bg-neutral-900 border border-neutral-700 rounded-lg text-sm font-semibold text-neutral-100 focus:outline-hidden focus:border-amber-500 flex-1 min-w-[200px]"
              placeholder="Tiêu đề chương..."
            />
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-neutral-800 bg-neutral-950/70 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Left Actions: Undo / Redo & Clean */}
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              disabled={historyIndex <= 0}
              onClick={handleUndo}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 disabled:opacity-30 transition-colors cursor-pointer"
              title="Hoàn tác (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Hoàn tác</span>
            </button>

            <button
              type="button"
              disabled={historyIndex >= history.length - 1}
              onClick={handleRedo}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 disabled:opacity-30 transition-colors cursor-pointer"
              title="Làm lại (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
              <span>Làm lại</span>
            </button>

            <div className="h-4 w-px bg-neutral-800 mx-1" />

            <button
              type="button"
              onClick={handleCleanSpaces}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 transition-colors cursor-pointer"
              title="Chuẩn hóa khoảng trắng và dòng trống thừa"
            >
              <AlignLeft className="w-3.5 h-3.5 text-amber-500" />
              <span>Dọn khoảng trắng</span>
            </button>

            <button
              type="button"
              onClick={handleMergeShortParagraphs}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 transition-colors cursor-pointer"
              title="Gộp các dòng văn bản ngắn bị ngắt giữa chừng"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Gộp đoạn ngắn</span>
            </button>
          </div>

          {/* Right Actions: Versions & Reset Original */}
          <div className="flex items-center space-x-2">
            {!isTranslationMode && (
              <button
                type="button"
                onClick={onOpenVersions}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-amber-400 font-medium transition-colors cursor-pointer"
                title="Xem các bản lưu lịch sử"
              >
                <History className="w-3.5 h-3.5" />
                <span>Lịch sử phiên bản</span>
              </button>
            )}

            {isModified && (
              confirmRestoreOriginal ? (
                <div className="flex items-center space-x-1.5 px-2 py-1 rounded-lg bg-red-950/50 border border-red-700/50">
                  <span className="text-[11px] text-red-200">Khôi phục gốc?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onRestoreOriginal();
                      setContent(originalContent);
                      setTitle(chapter.originalTitle || chapter.title);
                      setConfirmRestoreOriginal(false);
                    }}
                    className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold cursor-pointer"
                  >
                    Xác nhận
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRestoreOriginal(false)}
                    className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRestoreOriginal(true)}
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 transition-colors cursor-pointer"
                  title="Khôi phục nguyên bản"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Khôi phục gốc</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Textarea Editor Area */}
        <div className="flex-1 min-h-0 p-4 bg-neutral-900 flex flex-col">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="Nội dung chương..."
            className="w-full flex-1 p-4 bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-100 font-serif text-base leading-relaxed resize-none focus:outline-hidden focus:border-amber-500/80 shadow-inner select-text"
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-3 text-neutral-400 font-mono text-[11px]">
            <span>{wordCount.toLocaleString()} từ</span>
            <span>•</span>
            <span>{content.length.toLocaleString()} ký tự</span>
            {savedSuccess && (
              <span className="text-emerald-400 flex items-center space-x-1 font-sans font-medium">
                <Check className="w-3.5 h-3.5" />
                <span>Đã lưu thành công</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium transition-colors cursor-pointer"
            >
              Đóng
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-md transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu nội dung'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
