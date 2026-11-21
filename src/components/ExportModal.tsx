import React from 'react';
import {
  X,
  Download,
  FileText,
  BookOpen,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Book, Chapter } from '../types';
import { exportBookToTXT, exportBookToEPUB } from '../services/exporter';
import { getBookTranslations } from '../services/storage';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  chapters: Chapter[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  book,
  chapters,
}) => {
  const [format, setFormat] = React.useState<'TXT' | 'EPUB'>('EPUB');
  const [preferTranslated, setPreferTranslated] = React.useState(true);
  const [translatedCount, setTranslatedCount] = React.useState(0);
  const [isExporting, setIsExporting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    getBookTranslations(book.id)
      .then((list) => setTranslatedCount(list.length))
      .catch(() => setTranslatedCount(0));
  }, [isOpen, book.id]);

  if (!isOpen) return null;

  const totalWords = chapters.reduce((acc, ch) => acc + (ch.wordCount || 0), 0);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    setSuccess(false);

    try {
      let chaptersToExport = chapters;
      if (preferTranslated && translatedCount > 0) {
        const translations = await getBookTranslations(book.id);
        const transMap = new Map(translations.map((t) => [t.chapterId, t]));
        chaptersToExport = chapters.map((ch) => {
          const tr = transMap.get(ch.id);
          return tr
            ? {
                ...ch,
                title: tr.translatedTitle || ch.title,
                content: tr.translatedContent || ch.content,
              }
            : ch;
        });
      }

      if (format === 'TXT') {
        exportBookToTXT(book, chaptersToExport);
      } else {
        await exportBookToEPUB(book, chaptersToExport);
      }
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Không thể xuất file');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden select-none animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <div className="flex items-center space-x-2">
            <Download className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-neutral-100">Xuất file truyện</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Book Info Summary */}
          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center space-x-3">
            <div className="w-10 h-14 bg-neutral-800 rounded flex items-center justify-center font-bold text-amber-500 border border-neutral-700 shrink-0">
              {book.title.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-neutral-100 truncate text-sm">{book.title}</h3>
              <p className="text-[11px] text-neutral-400 truncate">{book.author || 'Khuyết danh'}</p>
              <div className="flex items-center space-x-2 text-[10px] text-neutral-400 mt-1 font-mono">
                <span>{chapters.length} chương</span>
                <span>•</span>
                <span>{totalWords.toLocaleString()} từ</span>
              </div>
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <label className="text-neutral-300 font-medium block">Chọn định dạng xuất:</label>
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setFormat('EPUB')}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  format === 'EPUB'
                    ? 'bg-amber-600/15 border-amber-500 text-amber-200 shadow-md'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-neutral-100">EPUB</span>
                  <BookOpen className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-[11px] text-neutral-400">
                  Sách điện tử chuẩn, giữ mục lục, đọc tốt trên mọi máy đọc sách.
                </p>
              </div>

              <div
                onClick={() => setFormat('TXT')}
                className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  format === 'TXT'
                    ? 'bg-amber-600/15 border-amber-500 text-amber-200 shadow-md'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-neutral-100">TXT</span>
                  <FileText className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-[11px] text-neutral-400">
                  Văn bản thuần UTF-8, nhẹ nhàng và tương thích tối đa.
                </p>
              </div>
            </div>
          </div>

          {translatedCount > 0 && (
            <label className="flex items-center space-x-2.5 p-3 rounded-xl bg-emerald-950/30 border border-emerald-700/40 text-neutral-200 cursor-pointer">
              <input
                type="checkbox"
                checked={preferTranslated}
                onChange={(e) => setPreferTranslated(e.target.checked)}
                className="accent-emerald-500 rounded"
              />
              <span className="text-[11px]">
                Xuất theo bản dịch đã lưu &amp; chỉnh sửa ({translatedCount} chương)
              </span>
            </label>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs flex items-center space-x-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Đã xuất file thành công!</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium cursor-pointer"
          >
            Đóng
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>{isExporting ? 'Đang tạo file...' : `Tải về file .${format.toLowerCase()}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
