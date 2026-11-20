import React from 'react';
import { X, BookOpen, Edit2, Check, Image, Trash2, Tag, Scissors, RefreshCw, Globe, Loader2 } from 'lucide-react';
import { Book, BookStatus, Chapter } from '../types';
import { saveBook, getChaptersByBookId, saveChapters } from '../services/storage';
import {
  inspectWebNovelUrl,
  downloadSelectedWebChapters,
  normalizeBookChapters,
  buildChaptersBackupText,
} from '../services/webScraper';

interface BookDetailModalProps {
  book: Book | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenReader: (book: Book) => void;
  onBookUpdated: (updatedBook: Book) => void;
  onChaptersUpdated?: (chapters: Chapter[], updatedBook: Book) => void;
  onOpenChapterManager?: (book: Book) => void;
  onDeleteBook?: (bookId: string, e: React.MouseEvent) => void;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  book,
  isOpen,
  onClose,
  onOpenReader,
  onBookUpdated,
  onChaptersUpdated,
  onOpenChapterManager,
  onDeleteBook,
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [author, setAuthor] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [status, setStatus] = React.useState<BookStatus>('reading');
  const [tagsStr, setTagsStr] = React.useState('');
  const [coverUrl, setCoverUrl] = React.useState('');
  const [isUpdatingWeb, setIsUpdatingWeb] = React.useState(false);
  const [webUpdateStatus, setWebUpdateStatus] = React.useState<string | null>(null);
  const fileCoverInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (book) {
      setTitle(book.title);
      setAuthor(book.author || '');
      setDescription(book.description || '');
      setStatus(book.status);
      setTagsStr((book.tags || []).join(', '));
      setCoverUrl(book.coverUrl || '');
      setIsEditing(false);
      setWebUpdateStatus(null);
    }
  }, [book, isOpen]);

  if (!isOpen || !book) return null;

  const handleSave = async () => {
    const updated: Book = {
      ...book,
      title: title.trim() || book.title,
      author: author.trim(),
      description: description.trim(),
      status,
      tags: tagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      coverUrl: coverUrl.trim(),
    };

    await saveBook(updated);
    onBookUpdated(updated);
    setIsEditing(false);
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCoverUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCheckWebUpdates = async () => {
    if (!book?.sourceUrl || isUpdatingWeb) return;
    setIsUpdatingWeb(true);
    setWebUpdateStatus('Đang kiểm tra chương mới...');

    try {
      const [inspectRes, existingChapters] = await Promise.all([
        inspectWebNovelUrl(book.sourceUrl),
        getChaptersByBookId(book.id),
      ]);

      const newChaptersMeta = inspectRes.chapters.slice(existingChapters.length);
      if (newChaptersMeta.length === 0) {
        setWebUpdateStatus('Đã là bản mới nhất, chưa có chương mới.');
        return;
      }

      if (inspectRes.requiresCookie) {
        setWebUpdateStatus(
          inspectRes.restrictionNotice ||
            'Truyện Pixiv này yêu cầu Cookie đăng nhập (R-18). Vui lòng nhập lại qua mục Thêm truyện từ trang web với Cookie PHPSESSID.'
        );
        return;
      }

      setWebUpdateStatus(`Tìm thấy ${newChaptersMeta.length} chương mới. Đang tải...`);
      const downloadRes = await downloadSelectedWebChapters(
        newChaptersMeta,
        undefined,
        (prog) => {
          setWebUpdateStatus(`Đang tải ${prog.completed}/${prog.total}: ${prog.currentTitle}`);
        }
      );

      if (downloadRes.successCount === 0) {
        setWebUpdateStatus(
          downloadRes.firstError || 'Không tải được nội dung các chương mới.'
        );
        return;
      }

      const validDrafts = downloadRes.chapters.filter((ch) => !ch.failed);
      const addedChapters = normalizeBookChapters(
        book.id,
        validDrafts,
        existingChapters.length
      );
      await saveChapters(addedChapters);

      const allChapters = [...existingChapters, ...addedChapters];
      const mergedTags = Array.from(
        new Set([...(book.tags || []), ...(inspectRes.tags || []), ...downloadRes.collectedTags])
      );
      const backupText = buildChaptersBackupText(allChapters);
      const updatedBook: Book = {
        ...book,
        totalChapters: allChapters.length,
        tags: mergedTags,
        fileSize: new Blob([backupText]).size,
        rawTextBackup: backupText,
      };

      await saveBook(updatedBook);
      setTagsStr(mergedTags.join(', '));
      setWebUpdateStatus(
        downloadRes.failedCount > 0
          ? `Đã cập nhật ${addedChapters.length} chương (${downloadRes.failedCount} chương lỗi bị bỏ qua).`
          : `Đã cập nhật thêm ${addedChapters.length} chương mới.`
      );

      if (onChaptersUpdated) {
        onChaptersUpdated(allChapters, updatedBook);
      } else {
        onBookUpdated(updatedBook);
      }
    } catch (err: any) {
      setWebUpdateStatus(err?.message || 'Không thể kiểm tra cập nhật.');
    } finally {
      setIsUpdatingWeb(false);
    }
  };

  const progressPercent = Math.min(
    100,
    Math.max(
      0,
      book.totalChapters > 0
        ? Math.round(((book.currentChapterIndex + (book.scrollProgress || 0)) / book.totalChapters) * 100)
        : 0
    )
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden select-none">
        {/* Header */}
        <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <h3 className="text-sm font-bold text-neutral-200 flex items-center space-x-2">
            <span>Chi tiết truyện</span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-neutral-800 text-amber-400 font-mono">
              {book.format}
            </span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-200 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Book Cover */}
            <div className="w-36 shrink-0 flex flex-col items-center">
              <div className="w-36 h-52 rounded-xl overflow-hidden shadow-lg bg-neutral-950 border border-neutral-800 relative group flex items-center justify-center">
                {coverUrl ? (
                  <img src={coverUrl} alt={book.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-amber-950 via-neutral-900 to-black p-3 flex flex-col justify-between text-center">
                    <span className="text-[10px] text-amber-500 font-mono uppercase font-bold">{book.format}</span>
                    <span className="text-xs text-neutral-200 font-serif font-bold line-clamp-3">{title || book.title}</span>
                    <span className="text-[10px] text-neutral-400 truncate">{author || 'Khuyết danh'}</span>
                  </div>
                )}

                {/* Upload overlay */}
                {isEditing && (
                  <div
                    onClick={() => fileCoverInputRef.current?.click()}
                    className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white text-xs cursor-pointer opacity-90 hover:opacity-100 transition-opacity"
                  >
                    <Image className="w-6 h-6 mb-1 text-amber-400" />
                    <span>Đổi ảnh bìa</span>
                  </div>
                )}
                <input
                  ref={fileCoverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverUpload}
                />
              </div>

              {isEditing && coverUrl && (
                <button
                  onClick={() => setCoverUrl('')}
                  className="mt-2 text-[11px] text-red-400 hover:text-red-300 flex items-center space-x-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Xóa ảnh bìa</span>
                </button>
              )}
            </div>

            {/* Information / Edit Form */}
            <div className="flex-1 space-y-3">
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">Tên truyện</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">Tác giả</label>
                    <input
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">Trạng thái</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as BookStatus)}
                      className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="reading">Đang đọc</option>
                      <option value="unread">Chưa đọc</option>
                      <option value="completed">Đã hoàn thành</option>
                      <option value="favorite">Yêu thích</option>
                      <option value="archived">Đã lưu trữ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">Tags (cách nhau bằng dấu phẩy)</label>
                    <input
                      type="text"
                      value={tagsStr}
                      onChange={(e) => setTagsStr(e.target.value)}
                      className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                      placeholder="Nhập thẻ, phân cách bằng dấu phẩy..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1">Mô tả / Giới thiệu</label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <h2 className="text-lg font-bold text-neutral-100">{book.title}</h2>
                    <p className="text-xs text-amber-400 font-medium mt-0.5">
                      {book.author || 'Khuyết danh'}
                    </p>
                  </div>

                  {book.description && (
                    <p className="text-xs text-neutral-300 leading-relaxed bg-neutral-950 p-3 rounded-lg border border-neutral-850">
                      {book.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-neutral-950 rounded-lg border border-neutral-850">
                      <span className="text-neutral-500 text-[11px] block">Tổng số chương</span>
                      <span className="font-semibold text-neutral-200 font-mono">{book.totalChapters} chương</span>
                    </div>

                    <div className="p-2.5 bg-neutral-950 rounded-lg border border-neutral-850">
                      <span className="text-neutral-500 text-[11px] block">Tiến độ đọc</span>
                      <span className="font-semibold text-amber-400 font-mono">
                        Chương {book.currentChapterIndex + 1} ({progressPercent}%)
                      </span>
                    </div>

                    <div className="p-2.5 bg-neutral-950 rounded-lg border border-neutral-850">
                      <span className="text-neutral-500 text-[11px] block">File gốc</span>
                      <span className="font-medium text-neutral-300 truncate block" title={book.sourceFileName}>
                        {book.sourceFileName}
                      </span>
                    </div>

                    <div className="p-2.5 bg-neutral-950 rounded-lg border border-neutral-850">
                      <span className="text-neutral-500 text-[11px] block">Dung lượng</span>
                      <span className="font-medium text-neutral-300 font-mono">
                        {(book.fileSize / 1024).toFixed(1)} KB
                      </span>
                    </div>

                    {book.sourceUrl && (
                      <div className="col-span-2 p-2.5 bg-neutral-950 rounded-lg border border-neutral-850 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-neutral-500 text-[11px] flex items-center space-x-1">
                            <Globe className="w-3 h-3 text-cyan-400" />
                            <span>Nguồn web</span>
                          </span>
                          <span className="font-mono text-[11px] text-cyan-400 truncate block" title={book.sourceUrl}>
                            {book.sourceUrl}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleCheckWebUpdates}
                          disabled={isUpdatingWeb}
                          className="shrink-0 flex items-center space-x-1 px-2.5 py-1 bg-cyan-950/60 hover:bg-cyan-900/70 border border-cyan-700/40 text-cyan-300 rounded-md text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isUpdatingWeb ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          <span>Cập nhật chương mới</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {webUpdateStatus && (
                    <div className="px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-[11px] text-neutral-300">
                      {webUpdateStatus}
                    </div>
                  )}

                  {book.tags && book.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {book.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded text-[11px] flex items-center space-x-1"
                        >
                          <Tag className="w-2.5 h-2.5 text-neutral-400" />
                          <span>{tag}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between">
          {isEditing ? (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs"
              >
                Hủy sửa
              </button>
              <button
                onClick={handleSave}
                className="flex items-center space-x-1 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Lưu thay đổi</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Sửa thông tin</span>
              </button>
              {onOpenChapterManager && (
                <button
                  onClick={() => {
                    onOpenChapterManager(book);
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  <Scissors className="w-3.5 h-3.5 text-amber-500" />
                  <span>Quản lý chương</span>
                </button>
              )}
              {onDeleteBook && (
                <button
                  onClick={(e) => onDeleteBook(book.id, e)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-red-950/70 text-red-400 hover:text-red-300 border border-transparent hover:border-red-800/50 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa</span>
                </button>
              )}
            </div>
          )}

          <button
            onClick={() => {
              onClose();
              onOpenReader(book);
            }}
            className="flex items-center space-x-1.5 px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-md transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            <span>Tiếp tục đọc</span>
          </button>
        </div>
      </div>
    </div>
  );
};
