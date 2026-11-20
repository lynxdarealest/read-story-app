/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Trash2, X, Loader2 } from 'lucide-react';
import { Book, Chapter, ReaderSettings, BookStatus } from './types';
import {
  getAllBooks,
  getChaptersByBookId,
  saveBook,
  deleteBook,
  getSettings,
  saveSettings,
  DEFAULT_SETTINGS,
} from './services/storage';
import { TitleBar } from './components/TitleBar';
import { Sidebar, LibraryFilter } from './components/Sidebar';
import { BookGrid } from './components/BookGrid';
import { ImportModal } from './components/ImportModal';
import { BookDetailModal } from './components/BookDetailModal';
import { ReaderView } from './components/ReaderView';
import { SettingsModal } from './components/SettingsModal';
import { ChapterManagerModal } from './components/ChapterManagerModal';
import { BrowserModal } from './components/BrowserModal';
import { hydrateServerCookiesFromIndexedDB } from './services/webScraper';

export default function App() {
  const [books, setBooks] = React.useState<Book[]>([]);
  const [currentFilter, setCurrentFilter] = React.useState<LibraryFilter>('all');
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');

  // Reader state
  const [activeBook, setActiveBook] = React.useState<Book | null>(null);
  const [activeChapters, setActiveChapters] = React.useState<Chapter[]>([]);
  const [isLoadingChapters, setIsLoadingChapters] = React.useState(false);

  // Settings
  const [settings, setSettings] = React.useState<ReaderSettings>(DEFAULT_SETTINGS);

  // Modals
  const [isImportOpen, setIsImportOpen] = React.useState(false);
  const [importInitialWebUrl, setImportInitialWebUrl] = React.useState<string | undefined>(undefined);
  const [isBrowserOpen, setIsBrowserOpen] = React.useState(false);
  const [browserInitialUrl, setBrowserInitialUrl] = React.useState<string | undefined>(undefined);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [detailBook, setDetailBook] = React.useState<Book | null>(null);
  const [chapterManagerBook, setChapterManagerBook] = React.useState<Book | null>(null);
  const [chapterManagerChapters, setChapterManagerChapters] = React.useState<Chapter[]>([]);
  const [pendingDeleteBook, setPendingDeleteBook] = React.useState<Book | null>(null);
  const [isDeletingBook, setIsDeletingBook] = React.useState(false);
  const [deleteBookError, setDeleteBookError] = React.useState<string | null>(null);

  // Initial load
  const loadLibrary = React.useCallback(async () => {
    try {
      if (!localStorage.getItem('vbook_removed_seeded_samples_v1')) {
        await Promise.all([
          deleteBook('sample-so-do').catch(() => {}),
          deleteBook('sample-tat-den').catch(() => {}),
        ]);
        localStorage.setItem('vbook_removed_seeded_samples_v1', '1');
      }
      const loadedBooks = await getAllBooks();
      setBooks(loadedBooks);
      const loadedSettings = await getSettings();
      setSettings(loadedSettings);
      await hydrateServerCookiesFromIndexedDB();
    } catch (err) {
      console.error('Failed to load library:', err);
    }
  }, []);

  React.useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  // Handle open reader for a book
  const handleOpenReader = async (book: Book) => {
    setIsLoadingChapters(true);
    try {
      const chapters = await getChaptersByBookId(book.id);
      setActiveBook(book);
      setActiveChapters(chapters);
    } catch (err) {
      console.error('Failed to load chapters:', err);
    } finally {
      setIsLoadingChapters(false);
    }
  };

  const handleBackToLibrary = async () => {
    setActiveBook(null);
    setActiveChapters([]);
    // Refresh books list to get updated progress & lastReadTimestamp
    const updated = await getAllBooks();
    setBooks(updated);
  };

  const handleUpdateSettings = async (newSettings: Partial<ReaderSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    await saveSettings(updated);
  };

  const handleToggleFavorite = async (book: Book, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus: BookStatus = book.status === 'favorite' ? 'reading' : 'favorite';
    const updatedBook: Book = { ...book, status: newStatus };
    await saveBook(updatedBook);
    setBooks((prev) => prev.map((b) => (b.id === book.id ? updatedBook : b)));
  };

  const handleDeleteBook = (bookId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = books.find((b) => b.id === bookId) || (detailBook?.id === bookId ? detailBook : null);
    if (!target) return;
    setDeleteBookError(null);
    setPendingDeleteBook(target);
  };

  const handleConfirmDeleteBook = async () => {
    if (!pendingDeleteBook || isDeletingBook) return;
    const bookId = pendingDeleteBook.id;
    setIsDeletingBook(true);
    setDeleteBookError(null);
    try {
      await deleteBook(bookId);
      setBooks((prev) => prev.filter((b) => b.id !== bookId));
      if (activeBook?.id === bookId) {
        setActiveBook(null);
        setActiveChapters([]);
      }
      if (detailBook?.id === bookId) {
        setDetailBook(null);
      }
      if (chapterManagerBook?.id === bookId) {
        setChapterManagerBook(null);
      }
      setPendingDeleteBook(null);
    } catch (err) {
      console.error('Failed to delete book:', err);
      setDeleteBookError(err instanceof Error ? err.message : 'Không thể xóa truyện. Vui lòng thử lại.');
    } finally {
      setIsDeletingBook(false);
    }
  };

  const handleBookImported = (newBook: Book) => {
    setBooks((prev) => [newBook, ...prev]);
    // Immediately offer or open newly imported book
    handleOpenReader(newBook);
  };

  const handleBookUpdated = (updated: Book) => {
    setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    if (activeBook?.id === updated.id) {
      setActiveBook(updated);
    }
    setDetailBook(null);
  };

  const handleOpenChapterManager = async (book: Book) => {
    try {
      const chs = await getChaptersByBookId(book.id);
      setChapterManagerBook(book);
      setChapterManagerChapters(chs);
    } catch (err) {
      console.error('Failed to load chapters:', err);
    }
  };

  const handleChaptersUpdated = (updatedChapters: Chapter[], updatedBook: Book) => {
    setBooks((prev) => prev.map((b) => (b.id === updatedBook.id ? updatedBook : b)));
    if (activeBook?.id === updatedBook.id) {
      setActiveBook(updatedBook);
      setActiveChapters(updatedChapters);
    }
    if (detailBook?.id === updatedBook.id) {
      setDetailBook(updatedBook);
    }
    setChapterManagerBook(null);
  };

  // Calculate counts for sidebar badges
  const counts = React.useMemo(() => {
    const res: Record<string, number> = {
      all: books.length,
      reading: books.filter((b) => b.status === 'reading').length,
      unread: books.filter((b) => b.status === 'unread').length,
      completed: books.filter((b) => b.status === 'completed').length,
      favorite: books.filter((b) => b.status === 'favorite').length,
      archived: books.filter((b) => b.status === 'archived').length,
      history: books.filter((b) => (b.lastReadTimestamp || 0) > 0).length,
    };
    return res;
  }, [books]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 font-sans">
      {/* Windows 11 Desktop Title Bar */}
      <TitleBar
        currentBookTitle={activeBook?.title}
        onBackToLibrary={activeBook ? handleBackToLibrary : undefined}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {activeBook && activeChapters.length > 0 ? (
          <ReaderView
            book={activeBook}
            chapters={activeChapters}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onBackToLibrary={handleBackToLibrary}
            onChaptersUpdated={handleChaptersUpdated}
          />
        ) : (
          <>
            {/* Library Sidebar */}
            <Sidebar
              currentFilter={currentFilter}
              onSelectFilter={(filter) => setCurrentFilter(filter)}
              counts={counts}
              onOpenImport={() => {
                setImportInitialWebUrl(undefined);
                setIsImportOpen(true);
              }}
              onOpenBrowser={() => {
                setBrowserInitialUrl(undefined);
                setIsBrowserOpen(true);
              }}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />

            {/* Library Shelf Grid / List */}
            <BookGrid
              books={books}
              currentFilter={currentFilter}
              viewMode={viewMode}
              onToggleViewMode={(mode) => setViewMode(mode)}
              onOpenReader={handleOpenReader}
              onOpenDetails={(book) => setDetailBook(book)}
              onToggleFavorite={handleToggleFavorite}
              onDeleteBook={handleDeleteBook}
              onOpenImport={() => {
                setImportInitialWebUrl(undefined);
                setIsImportOpen(true);
              }}
            />
          </>
        )}
      </div>

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => {
          setIsImportOpen(false);
          setImportInitialWebUrl(undefined);
        }}
        onBookImported={handleBookImported}
        initialWebUrl={importInitialWebUrl}
        onOpenBrowser={(url) => {
          setIsImportOpen(false);
          setBrowserInitialUrl(url);
          setIsBrowserOpen(true);
        }}
      />

      {/* In-App Browser Modal (Auto Cookie Capture) */}
      <BrowserModal
        isOpen={isBrowserOpen}
        initialUrl={browserInitialUrl}
        onClose={() => setIsBrowserOpen(false)}
        onImportFromUrl={(url) => {
          setIsBrowserOpen(false);
          setImportInitialWebUrl(url);
          setIsImportOpen(true);
        }}
      />

      {/* Book Detail / Edit Modal */}
      <BookDetailModal
        book={detailBook}
        isOpen={!!detailBook}
        onClose={() => setDetailBook(null)}
        onOpenReader={handleOpenReader}
        onBookUpdated={handleBookUpdated}
        onChaptersUpdated={handleChaptersUpdated}
        onOpenChapterManager={handleOpenChapterManager}
        onDeleteBook={handleDeleteBook}
      />

      {/* Chapter Manager Modal */}
      {chapterManagerBook && (
        <ChapterManagerModal
          isOpen={!!chapterManagerBook}
          onClose={() => setChapterManagerBook(null)}
          book={chapterManagerBook}
          chapters={chapterManagerChapters}
          onChaptersUpdated={handleChaptersUpdated}
        />
      )}

      {/* Settings & Backup Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onDataRestored={loadLibrary}
      />

      {/* Delete Book Confirmation Modal (in-app dialog for iframe compatibility) */}
      {pendingDeleteBook && (
        <div
          className="fixed inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            if (!isDeletingBook) {
              setPendingDeleteBook(null);
              setDeleteBookError(null);
            }
          }}
        >
          <div
            className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
              <div className="flex items-center space-x-2">
                <Trash2 className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-semibold text-neutral-100">Xóa khỏi thư viện</h3>
              </div>
              <button
                type="button"
                disabled={isDeletingBook}
                onClick={() => {
                  setPendingDeleteBook(null);
                  setDeleteBookError(null);
                }}
                className="p-1 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-neutral-300 leading-relaxed">
                Bạn có chắc chắn muốn xóa{' '}
                <span className="font-semibold text-neutral-100">“{pendingDeleteBook.title}”</span>{' '}
                khỏi kệ sách không? Toàn bộ chương, ghi chú, đánh dấu, bản dịch và từ điển riêng của truyện này sẽ bị xóa.
              </p>

              {deleteBookError && (
                <div className="px-3 py-2 bg-red-950/50 border border-red-800/60 rounded-lg text-xs text-red-300">
                  {deleteBookError}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-end space-x-2">
              <button
                type="button"
                disabled={isDeletingBook}
                onClick={() => {
                  setPendingDeleteBook(null);
                  setDeleteBookError(null);
                }}
                className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDeletingBook}
                onClick={handleConfirmDeleteBook}
                className="flex items-center space-x-1.5 px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
              >
                {isDeletingBook ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa khỏi thư viện</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
