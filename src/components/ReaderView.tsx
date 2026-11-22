import React from 'react';
import {
  ArrowLeft,
  List,
  Search,
  Bookmark as BookmarkIcon,
  BookA,
  Volume2,
  Settings as SettingsIcon,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Sliders,
  Sparkles,
  Keyboard,
  Edit3,
  Replace,
  Download,
  History,
  Save,
  RotateCcw,
  Check,
  Copy,
  FileText,
  Highlighter,
  Languages,
  RefreshCw,
  AlertTriangle,
  Lock,
  Loader2,
  MoreVertical,
  Scissors,
  ChevronsDown,
  Columns2,
  Focus,
  Play,
  Pause,
  Plus,
  Minus,
  X
} from 'lucide-react';
import {
  Book,
  Chapter,
  ChapterTranslation,
  Bookmark,
  Highlight,
  DictionaryEntry,
  ReaderSettings,
  ReadingMode,
  CustomTheme,
  GLOBAL_DICTIONARY_BOOK_ID
} from '../types';
import {
  applyDictionaryToText,
  applyHighlightsToHtml,
  computeDictionarySignature,
  escapeHtml,
  mergeDictionariesByPrecedence
} from '../services/dictionary';
import {
  isTranslationStale,
  translateChapterWithSangTacViet,
  TranslationProgress
} from '../services/translator';
import { containsCjk, findBestMatchingSourceParagraph } from '../services/chineseTools';
import { ttsService, TTSState } from '../services/tts';
import {
  saveBook,
  saveBookmark,
  getBookmarks,
  deleteBookmark,
  getDictionaries,
  saveDictionaryEntry,
  getChapterTranslation,
  getBookTranslations,
  saveChapterTranslation,
  updateChapter,
  batchUpdateChapters,
  saveHighlight,
  getHighlights,
  deleteHighlight
} from '../services/storage';
import { ReaderTOC } from './ReaderTOC';
import { ReaderSettingsPanel } from './ReaderSettings';
import { ReaderSearch } from './ReaderSearch';
import { ReaderBookmarks } from './ReaderBookmarks';
import { ReaderDictionary } from './ReaderDictionary';
import { ReaderTTSBar } from './ReaderTTSBar';
import { ThemeManagerModal } from './ThemeManagerModal';
import { ChapterManagerModal } from './ChapterManagerModal';
import { ShortcutHelpModal } from './ShortcutHelpModal';
import { SelectionActionMenu } from './SelectionActionMenu';
import { QuickNameEditModal, QuickDictScope, QuickReplaceScope } from './QuickNameEditModal';
import { ReaderFindReplaceModal } from './ReaderFindReplaceModal';
import { ChapterVersionModal } from './ChapterVersionModal';
import { ChapterEditorModal } from './ChapterEditorModal';
import { ExportModal } from './ExportModal';

interface ReaderViewProps {
  book: Book;
  chapters: Chapter[];
  settings: ReaderSettings;
  onUpdateSettings: (newSettings: Partial<ReaderSettings>) => void;
  onBackToLibrary: () => void;
  onChaptersUpdated?: (updatedChapters: Chapter[], updatedBook: Book) => void;
}

export const ReaderView: React.FC<ReaderViewProps> = ({
  book,
  chapters,
  settings,
  onUpdateSettings,
  onBackToLibrary,
  onChaptersUpdated,
}) => {
  const [localChapters, setLocalChapters] = React.useState<Chapter[]>(chapters);
  React.useEffect(() => {
    setLocalChapters(chapters);
  }, [chapters]);

  const [currentChapterIndex, setCurrentChapterIndex] = React.useState(
    Math.min(book.currentChapterIndex || 0, Math.max(0, chapters.length - 1))
  );
  const [showUI, setShowUI] = React.useState(true);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // Drawers & Modals
  const [showTOC, setShowTOC] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [showSearch, setShowSearch] = React.useState(false);
  const [showBookmarks, setShowBookmarks] = React.useState(false);
  const [showDictionary, setShowDictionary] = React.useState(false);
  const [showTTS, setShowTTS] = React.useState(false);
  const [showThemeManager, setShowThemeManager] = React.useState(false);
  const [showChapterManager, setShowChapterManager] = React.useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = React.useState(false);

  // Text Editing & Versioning Modals
  const [showChapterEditor, setShowChapterEditor] = React.useState(false);
  const [showFindReplace, setShowFindReplace] = React.useState(false);
  const [showVersions, setShowVersions] = React.useState(false);
  const [showExport, setShowExport] = React.useState(false);
  const [findReplaceInitialText, setFindReplaceInitialText] = React.useState('');
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);
  const moreMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!showMoreMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreMenu]);

  // Inline paragraph editing
  const [editingParagraphIndex, setEditingParagraphIndex] = React.useState<number | null>(null);
  const [paragraphEditText, setParagraphEditText] = React.useState('');
  const [confirmDeleteParaIdx, setConfirmDeleteParaIdx] = React.useState<number | null>(null);
  const [isAutoSaving, setIsAutoSaving] = React.useState(false);
  const [lastSavedTimestamp, setLastSavedTimestamp] = React.useState<number | null>(null);

  // Highlights & in-app Add Note modal
  const [highlights, setHighlights] = React.useState<Highlight[]>([]);
  const [pendingNoteModal, setPendingNoteModal] = React.useState<{ text: string; note: string } | null>(null);
  const pendingSearchJumpRef = React.useRef<{ chapterIndex: number; snippet: string } | null>(null);

  // HUD Toast indicator
  const [hudToast, setHudToast] = React.useState<string | null>(null);
  const hudToastTimeoutRef = React.useRef<number | null>(null);

  const showHUDToast = React.useCallback((text: string) => {
    if (hudToastTimeoutRef.current) clearTimeout(hudToastTimeoutRef.current);
    setHudToast(text);
    hudToastTimeoutRef.current = window.setTimeout(() => {
      setHudToast(null);
    }, 1200);
  }, []);

  // Custom theme handlers
  const handleSaveTheme = (newTheme: CustomTheme) => {
    const existingIndex = settings.customThemes?.findIndex((t) => t.id === newTheme.id) ?? -1;
    let updatedThemes: CustomTheme[] = [];
    if (existingIndex >= 0) {
      updatedThemes = (settings.customThemes || []).map((t) => (t.id === newTheme.id ? newTheme : t));
    } else {
      updatedThemes = [...(settings.customThemes || []), newTheme];
    }
    onUpdateSettings({ customThemes: updatedThemes });
  };

  const handleDeleteTheme = (themeId: string) => {
    const updatedThemes = (settings.customThemes || []).filter((t) => t.id !== themeId);
    onUpdateSettings({
      customThemes: updatedThemes,
      theme: settings.theme === themeId ? 'paper' : settings.theme,
    });
  };

  const handleApplyCustomTheme = React.useCallback(
    (themeId: string, customThemeData?: CustomTheme) => {
      if (customThemeData) {
        onUpdateSettings({
          theme: themeId,
          textColor: customThemeData.textColor,
          backgroundColor: customThemeData.backgroundColor,
          backgroundImageUrl: customThemeData.backgroundImageUrl,
          fontFamily: customThemeData.fontFamily,
          fontSize: customThemeData.fontSize,
          fontWeight: customThemeData.fontWeight,
          lineHeight: customThemeData.lineHeight,
          paragraphSpacing: customThemeData.paragraphSpacing,
          containerWidth: customThemeData.containerWidth,
          textAlign: customThemeData.textAlign,
          textIndent: customThemeData.textIndent,
        });
      } else {
        onUpdateSettings({
          theme: themeId,
          textColor: undefined,
          backgroundColor: undefined,
          backgroundImageUrl: undefined,
        });
      }
    },
    [onUpdateSettings]
  );

  // Theme cycle list for keyboard shortcut 'C'
  const allThemesList = React.useMemo(() => {
    const standard: Array<{ id: string; name: string }> = [
      { id: 'paper', name: 'Paper' },
      { id: 'sepia', name: 'Sepia' },
      { id: 'light', name: 'Light' },
      { id: 'dark', name: 'Dark' },
      { id: 'oled', name: 'OLED' },
      { id: 'eink', name: 'E-ink' },
    ];
    const custom = (settings.customThemes || []).map((t) => ({ id: t.id, name: t.name }));
    return [...standard, ...custom];
  }, [settings.customThemes]);

  const cycleNextTheme = React.useCallback(() => {
    const currentIndex = allThemesList.findIndex((t) => t.id === settings.theme);
    const nextIndex = (currentIndex + 1) % allThemesList.length;
    const next = allThemesList[nextIndex];
    handleApplyCustomTheme(next.id, settings.customThemes?.find((t) => t.id === next.id));
    showHUDToast(`Chủ đề: ${next.name}`);
  }, [allThemesList, settings.theme, settings.customThemes, handleApplyCustomTheme, showHUDToast]);

  const toggleLightDark = React.useCallback(() => {
    const isDarkish =
      ['dark', 'oled', 'nightblue'].includes(settings.theme) ||
      settings.customThemes?.find((t) => t.id === settings.theme)?.backgroundColor.startsWith('#0') ||
      settings.customThemes?.find((t) => t.id === settings.theme)?.backgroundColor.startsWith('#1');
    const target = isDarkish ? 'light' : 'dark';
    handleApplyCustomTheme(target);
    showHUDToast(`Chủ đề: ${target === 'light' ? 'Light' : 'Dark'}`);
  }, [settings.theme, settings.customThemes, handleApplyCustomTheme, showHUDToast]);

  // Data
  const [bookmarks, setBookmarks] = React.useState<Bookmark[]>([]);
  const [bookDictionaries, setBookDictionaries] = React.useState<DictionaryEntry[]>([]);
  const [globalDictionaries, setGlobalDictionaries] = React.useState<DictionaryEntry[]>([]);
  const [selectedTextForDict, setSelectedTextForDict] = React.useState<string>('');

  const dictionaries = React.useMemo(
    () => mergeDictionariesByPrecedence(globalDictionaries, bookDictionaries),
    [globalDictionaries, bookDictionaries]
  );

  // Translation state (whole book online + IndexedDB cache)
  const [currentTranslation, setCurrentTranslation] = React.useState<ChapterTranslation | null>(null);
  const [readingViewMode, setReadingViewMode] = React.useState<'original' | 'translated'>('original');
  const [isTranslating, setIsTranslating] = React.useState(false);
  const [translationProgress, setTranslationProgress] = React.useState<{
    completedChapters: number;
    totalChapters: number;
    currentChapterNumber: number;
    chunkProgress?: TranslationProgress | null;
  } | null>(null);
  const [bookTranslatedCount, setBookTranslatedCount] = React.useState(0);
  const [translationError, setTranslationError] = React.useState<string | null>(null);
  const translationAbortRef = React.useRef<AbortController | null>(null);

  // Floating text selection tooltip / quick name editor
  const [selectionTooltip, setSelectionTooltip] = React.useState<{
    x: number;
    y: number;
    text: string;
    paragraphIndex?: number;
    startInPara?: number;
    endInPara?: number;
    mode: 'quick-name' | 'menu';
  } | null>(null);
  const [searchInitialQuery, setSearchInitialQuery] = React.useState('');
  const [translatedChaptersForReplace, setTranslatedChaptersForReplace] = React.useState<Chapter[] | null>(null);

  // Paginated / two-column mode state
  const [currentPageIndex, setCurrentPageIndex] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const pagedViewportRef = React.useRef<HTMLDivElement>(null);
  const pagedTrackRef = React.useRef<HTMLDivElement>(null);
  const [pagedBoxSize, setPagedBoxSize] = React.useState<{ width: number; height: number }>({
    width: 672,
    height: 520,
  });
  const jumpToLastPageOnLoadRef = React.useRef(false);
  const lastWheelFlipRef = React.useRef(0);
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);

  // Continuous scroll mode state
  const [continuousRange, setContinuousRange] = React.useState<{ start: number; end: number }>(() => ({
    start: Math.min(book.currentChapterIndex || 0, Math.max(0, chapters.length - 1)),
    end: Math.min(Math.max(0, chapters.length - 1), (book.currentChapterIndex || 0) + 1),
  }));
  const [continuousTranslations, setContinuousTranslations] = React.useState<Record<string, ChapterTranslation | null>>({});
  const skipContinuousResetRef = React.useRef(false);

  // Focus mode & auto-scroll state
  const [focusedParaIndex, setFocusedParaIndex] = React.useState(0);
  const [isAutoScrollPaused, setIsAutoScrollPaused] = React.useState(false);
  const scrollAccumRef = React.useRef(0);
  const restoredInitialScrollRef = React.useRef(false);

  // TTS tracking
  const [ttsState, setTtsState] = React.useState<TTSState>(ttsService.getState());

  const contentContainerRef = React.useRef<HTMLDivElement>(null);
  const saveTimeoutRef = React.useRef<number | null>(null);

  const currentChapter = localChapters[currentChapterIndex] || {
    id: 'empty',
    bookId: book.id,
    chapterIndex: 0,
    title: 'Chương trống',
    wordCount: 0,
    content: 'Nội dung chương chưa được tải.',
  };

  const translationIsStale = React.useMemo(
    () => isTranslationStale(currentChapter, currentTranslation),
    [currentChapter, currentTranslation]
  );

  const dictionaryChangedSinceTranslation = React.useMemo(() => {
    if (!currentTranslation || translationIsStale || !currentTranslation.dictionarySignature) {
      return false;
    }
    return currentTranslation.dictionarySignature !== computeDictionarySignature(dictionaries);
  }, [currentTranslation, translationIsStale, dictionaries]);

  const isViewingTranslation = readingViewMode === 'translated' && !!currentTranslation;
  const displayedTitle = isViewingTranslation
    ? currentTranslation!.translatedTitle
    : currentChapter.title;
  const displayedContent = isViewingTranslation
    ? currentTranslation!.translatedContent
    : currentChapter.content;

  // Load bookmarks, dictionaries (both book & global scopes) & highlights
  React.useEffect(() => {
    let isMounted = true;
    getBookmarks(book.id).then((bm) => {
      if (isMounted) setBookmarks(bm);
    });
    Promise.all([getDictionaries(book.id), getDictionaries(GLOBAL_DICTIONARY_BOOK_ID)]).then(
      ([bookDict, globalDict]) => {
        if (isMounted) {
          setBookDictionaries(bookDict);
          setGlobalDictionaries(globalDict);
        }
      }
    );
    getHighlights(book.id).then((hl) => {
      if (isMounted) setHighlights(hl);
    });
    return () => {
      isMounted = false;
    };
  }, [book.id]);

  const currentChapterIdRef = React.useRef(currentChapter.id);
  React.useEffect(() => {
    currentChapterIdRef.current = currentChapter.id;
  }, [currentChapter.id]);

  // Refresh saved translated chapter count for this book
  const refreshBookTranslatedCount = React.useCallback(async () => {
    try {
      const list = await getBookTranslations(book.id);
      setBookTranslatedCount(list.length);
    } catch {
      // Ignore read failures
    }
  }, [book.id]);

  React.useEffect(() => {
    refreshBookTranslatedCount();
  }, [refreshBookTranslatedCount, localChapters.length]);

  // Load saved chapter translation from IndexedDB when switching chapters
  // (Keep any in-progress whole-book translation running when user navigates chapters)
  React.useEffect(() => {
    let isMounted = true;
    setTranslationError(null);
    setEditingParagraphIndex(null);

    if (!currentChapter?.id || currentChapter.id === 'empty') {
      setCurrentTranslation(null);
      setReadingViewMode('original');
      return;
    }

    getChapterTranslation(currentChapter.id)
      .then((saved) => {
        if (!isMounted) return;
        setCurrentTranslation(saved || null);
        if (saved && !isTranslationStale(currentChapter, saved)) {
          setReadingViewMode('translated');
        } else {
          setReadingViewMode('original');
        }
      })
      .catch(() => {
        if (isMounted) {
          setCurrentTranslation(null);
          setReadingViewMode('original');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentChapter.id]);

  React.useEffect(() => {
    return () => {
      translationAbortRef.current?.abort();
    };
  }, []);

  const handleTranslateBook = async (options?: { retranslateAll?: boolean }) => {
    const validChapters = localChapters.filter((ch) => ch.id && ch.id !== 'empty' && ch.content.trim());
    if (validChapters.length === 0) {
      showHUDToast('Truyện chưa có nội dung để dịch');
      return;
    }

    if (translationAbortRef.current) {
      translationAbortRef.current.abort();
    }
    const controller = new AbortController();
    translationAbortRef.current = controller;

    setIsTranslating(true);
    setTranslationError(null);

    let completedCount = 0;
    let totalToTranslate = 0;

    try {
      const [latestGlobal, latestBook, existingList] = await Promise.all([
        getDictionaries(GLOBAL_DICTIONARY_BOOK_ID),
        getDictionaries(book.id),
        getBookTranslations(book.id),
      ]);
      setGlobalDictionaries(latestGlobal);
      setBookDictionaries(latestBook);

      const existingMap = new Map(existingList.map((t) => [t.chapterId, t]));

      // Start from the chapter the user is currently reading so it updates immediately, then wrap around
      const startPos = Math.max(
        0,
        validChapters.findIndex((c) => c.id === currentChapter.id)
      );
      const orderedChapters = [
        ...validChapters.slice(startPos),
        ...validChapters.slice(0, startPos),
      ];

      const retranslateAll = Boolean(options?.retranslateAll);
      const queue = retranslateAll
        ? orderedChapters
        : orderedChapters.filter((ch) => {
            const existing = existingMap.get(ch.id);
            return !existing || isTranslationStale(ch, existing);
          });

      if (queue.length === 0) {
        setBookTranslatedCount(existingList.length);
        showHUDToast('Toàn bộ truyện đã có bản dịch mới nhất');
        return;
      }

      totalToTranslate = queue.length;
      setTranslationProgress({
        completedChapters: 0,
        totalChapters: totalToTranslate,
        currentChapterNumber: (queue[0]?.chapterIndex ?? 0) + 1,
        chunkProgress: null,
      });

      const savedIds = new Set(existingList.map((t) => t.chapterId));

      for (let i = 0; i < queue.length; i++) {
        if (controller.signal.aborted) {
          throw new Error('Đã hủy yêu cầu dịch.');
        }

        const ch = queue[i];
        setTranslationProgress({
          completedChapters: completedCount,
          totalChapters: totalToTranslate,
          currentChapterNumber: ch.chapterIndex + 1,
          chunkProgress: null,
        });

        let result: ChapterTranslation | null = null;
        let lastErr: any = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          if (controller.signal.aborted) {
            throw new Error('Đã hủy yêu cầu dịch.');
          }
          try {
            result = await translateChapterWithSangTacViet({
              chapter: ch,
              globalEntries: latestGlobal,
              bookEntries: latestBook,
              onProgress: (chunkProg) => {
                setTranslationProgress({
                  completedChapters: completedCount,
                  totalChapters: totalToTranslate,
                  currentChapterNumber: ch.chapterIndex + 1,
                  chunkProgress: chunkProg,
                });
              },
              signal: controller.signal,
            });
            break;
          } catch (err: any) {
            if (controller.signal.aborted || err?.message?.includes('Đã hủy')) {
              throw err;
            }
            lastErr = err;
            if (attempt === 0) {
              await new Promise((r) => setTimeout(r, 600));
            }
          }
        }

        if (!result) {
          throw lastErr || new Error(`Không thể dịch chương ${ch.chapterIndex + 1}`);
        }

        await saveChapterTranslation(result);
        savedIds.add(result.chapterId);
        completedCount++;

        setBookTranslatedCount(savedIds.size);
        setContinuousTranslations((prev) => ({ ...prev, [result!.chapterId]: result! }));

        if (result.chapterId === currentChapterIdRef.current) {
          setCurrentTranslation(result);
          setReadingViewMode('translated');
          setCurrentPageIndex(0);
          setEditingParagraphIndex(null);
        }

        setTranslationProgress({
          completedChapters: completedCount,
          totalChapters: totalToTranslate,
          currentChapterNumber: ch.chapterIndex + 1,
          chunkProgress: null,
        });
      }

      showHUDToast(`Đã dịch xong toàn truyện (${completedCount} chương)`);
    } catch (err: any) {
      if (controller.signal.aborted || err?.message?.includes('Đã hủy')) {
        showHUDToast(
          completedCount > 0
            ? `Đã dừng dịch (đã lưu ${completedCount}/${totalToTranslate} chương)`
            : 'Đã hủy dịch truyện'
        );
      } else {
        const prefix =
          completedCount > 0 ? `Đã lưu ${completedCount}/${totalToTranslate} chương. ` : '';
        setTranslationError(`${prefix}${err?.message || 'Lỗi không xác định khi dịch truyện.'}`);
      }
    } finally {
      setIsTranslating(false);
      setTranslationProgress(null);
      if (translationAbortRef.current === controller) {
        translationAbortRef.current = null;
      }
    }
  };

  // Chapter Content Editing & Saving Handlers
  const handleSaveChapterContent = async (
    chapterId: string,
    updatedTitle: string,
    updatedContent: string,
    summary: string
  ) => {
    setIsAutoSaving(true);
    try {
      const targetChapter = localChapters.find((c) => c.id === chapterId) || currentChapter;
      const wordCount = updatedContent.trim().split(/\s+/).filter(Boolean).length;
      const updatedChapter: Chapter = {
        ...targetChapter,
        title: updatedTitle,
        content: updatedContent,
        wordCount,
        originalContent: targetChapter.originalContent || targetChapter.content,
        originalTitle: targetChapter.originalTitle || targetChapter.title,
        lastEditedTimestamp: Date.now(),
      };

      await updateChapter(updatedChapter, true, summary);

      const nextChapters = localChapters.map((c) => (c.id === chapterId ? updatedChapter : c));
      setLocalChapters(nextChapters);
      setContinuousTranslations((prev) => {
        if (!(chapterId in prev)) return prev;
        const copy = { ...prev };
        delete copy[chapterId];
        return copy;
      });

      if (onChaptersUpdated) {
        onChaptersUpdated(nextChapters, book);
      }

      setLastSavedTimestamp(Date.now());
      showHUDToast('Đã lưu nội dung');
    } catch (err: any) {
      showHUDToast(`Lỗi khi lưu: ${err.message}`);
    } finally {
      setIsAutoSaving(false);
    }
  };

  const handleSaveTranslatedChapterContent = async (
    chapterId: string,
    updatedTitle: string,
    updatedContent: string
  ) => {
    setIsAutoSaving(true);
    try {
      const existing =
        (chapterId === currentChapter.id ? currentTranslation : continuousTranslations[chapterId]) ||
        (await getChapterTranslation(chapterId));

      if (!existing) {
        showHUDToast('Chưa có bản dịch để lưu');
        return;
      }

      const nextTranslation: ChapterTranslation = {
        ...existing,
        translatedTitle: updatedTitle.trim() || existing.translatedTitle,
        translatedContent: updatedContent,
        translatedAt: Date.now(),
      };

      await saveChapterTranslation(nextTranslation);

      if (chapterId === currentChapter.id) {
        setCurrentTranslation(nextTranslation);
      }
      setContinuousTranslations((prev) => ({
        ...prev,
        [chapterId]: nextTranslation,
      }));
      setLastSavedTimestamp(Date.now());
      showHUDToast('Đã lưu chỉnh sửa bản dịch');
    } catch (err: any) {
      showHUDToast(`Lỗi khi lưu bản dịch: ${err.message}`);
    } finally {
      setIsAutoSaving(false);
    }
  };

  const handleBatchUpdateTranslatedChapters = async (updatedChapters: Chapter[]) => {
    setIsAutoSaving(true);
    try {
      const existingList = await getBookTranslations(book.id);
      const transMap = new Map(existingList.map((t) => [t.chapterId, t]));
      const updatedMap = new Map<string, ChapterTranslation>();

      for (const ch of updatedChapters) {
        const prev = transMap.get(ch.id);
        if (!prev) continue;
        const next: ChapterTranslation = {
          ...prev,
          translatedTitle: ch.title || prev.translatedTitle,
          translatedContent: ch.content,
          translatedAt: Date.now(),
        };
        await saveChapterTranslation(next);
        updatedMap.set(ch.id, next);
      }

      if (updatedMap.has(currentChapter.id)) {
        setCurrentTranslation(updatedMap.get(currentChapter.id)!);
      }
      setContinuousTranslations((prev) => {
        const next = { ...prev };
        for (const [id, tr] of updatedMap.entries()) {
          next[id] = tr;
        }
        return next;
      });
      setTranslatedChaptersForReplace((prev) =>
        prev
          ? prev.map((c) => {
              const updated = updatedMap.get(c.id);
              return updated
                ? { ...c, title: updated.translatedTitle, content: updated.translatedContent }
                : c;
            })
          : prev
      );
      setLastSavedTimestamp(Date.now());
      showHUDToast(`Đã lưu bản dịch ${updatedMap.size} chương`);
    } catch (err: any) {
      showHUDToast(`Lỗi: ${err.message}`);
    } finally {
      setIsAutoSaving(false);
    }
  };

  const openFindReplaceModal = async () => {
    if (isViewingTranslation) {
      try {
        const list = await getBookTranslations(book.id);
        const transMap = new Map(list.map((t) => [t.chapterId, t]));
        const mapped = localChapters
          .filter((ch) => transMap.has(ch.id))
          .map((ch) => {
            const tr = transMap.get(ch.id)!;
            return {
              ...ch,
              title: tr.translatedTitle || ch.title,
              content: tr.translatedContent,
            };
          });
        setTranslatedChaptersForReplace(mapped.length > 0 ? mapped : null);
      } catch {
        setTranslatedChaptersForReplace(null);
      }
    } else {
      setTranslatedChaptersForReplace(null);
    }
    setShowFindReplace(true);
  };

  const handleBatchUpdateChapters = async (updatedChapters: Chapter[], _summary: string) => {
    setIsAutoSaving(true);
    try {
      await batchUpdateChapters(updatedChapters);

      const updatedMap = new Map(updatedChapters.map((c) => [c.id, c]));
      const nextChapters = localChapters.map((c) => (updatedMap.has(c.id) ? updatedMap.get(c.id)! : c));
      setLocalChapters(nextChapters);
      setContinuousTranslations((prev) => {
        const copy = { ...prev };
        for (const ch of updatedChapters) delete copy[ch.id];
        return copy;
      });

      if (onChaptersUpdated) {
        onChaptersUpdated(nextChapters, book);
      }

      setLastSavedTimestamp(Date.now());
      showHUDToast(`Đã lưu ${updatedChapters.length} chương`);
    } catch (err: any) {
      showHUDToast(`Lỗi: ${err.message}`);
    } finally {
      setIsAutoSaving(false);
    }
  };

  const handleRestoreOriginalChapter = async () => {
    const origContent = currentChapter.originalContent || currentChapter.content;
    const origTitle = currentChapter.originalTitle || currentChapter.title;
    await handleSaveChapterContent(currentChapter.id, origTitle, origContent, 'Khôi phục về bản gốc ban đầu');
    showHUDToast('Đã khôi phục về bản gốc ban đầu');
  };

  // Helper to replace text cleanly in a chapter's displayed translation (1 occurrence or whole chapter)
  const applyNameReplacement = async (params: {
    oldText: string;
    newText: string;
    scope: QuickReplaceScope;
    paragraphIndex: number;
    startInPara: number;
    endInPara: number;
  }) => {
    const { oldText, newText, scope, paragraphIndex, startInPara } = params;
    if (!oldText || !newText) return;

    if (isViewingTranslation && currentTranslation) {
      let nextContent = currentTranslation.translatedContent;
      let nextTitle = currentTranslation.translatedTitle;

      if (scope === 'chapter') {
        nextContent = nextContent.split(oldText).join(newText);
        nextTitle = nextTitle.split(oldText).join(newText);
      } else {
        const paras = [...paragraphs];
        const targetPara = paras[paragraphIndex] || '';
        let replacedPara = targetPara;

        if (targetPara.slice(startInPara, startInPara + oldText.length) === oldText) {
          replacedPara =
            targetPara.slice(0, startInPara) + newText + targetPara.slice(startInPara + oldText.length);
        } else {
          const nearIdx = targetPara.indexOf(oldText, Math.max(0, startInPara - 10));
          const fallbackIdx = nearIdx >= 0 ? nearIdx : targetPara.indexOf(oldText);
          if (fallbackIdx >= 0) {
            replacedPara =
              targetPara.slice(0, fallbackIdx) + newText + targetPara.slice(fallbackIdx + oldText.length);
          }
        }
        paras[paragraphIndex] = replacedPara;
        nextContent = paras.join('\n\n');
      }

      await handleSaveTranslatedChapterContent(currentChapter.id, nextTitle, nextContent);
      setSelectionTooltip(null);
      window.getSelection()?.removeAllRanges();
      showHUDToast(`Đã dùng: "${newText}"`);
      return;
    }

    // Raw original mode (Chinese/non-translated): update chapter directly if non-CJK or save dictionary if CJK
    if (containsCjk(oldText)) {
      const existing = bookDictionaries.find((d) => d.original.trim() === oldText.trim());
      const entry: DictionaryEntry = existing
        ? { ...existing, replacement: newText, enabled: true }
        : {
            id: `dict-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            bookId: book.id,
            type: 'character',
            original: oldText.trim(),
            replacement: newText.trim(),
            enabled: true,
          };
      await saveDictionaryEntry(entry);
      const nextBookDict = await getDictionaries(book.id);
      setBookDictionaries(nextBookDict);
      if (!settings.applyDictionary) {
        onUpdateSettings({ applyDictionary: true });
      }
      setSelectionTooltip(null);
      window.getSelection()?.removeAllRanges();
      showHUDToast(`Đã áp dụng name: "${newText}"`);
    } else {
      const nextContent =
        scope === 'chapter'
          ? currentChapter.content.split(oldText).join(newText)
          : (() => {
              const paras = [...paragraphs];
              const p = paras[paragraphIndex] || '';
              const idx = p.indexOf(oldText, Math.max(0, startInPara - 10));
              const useIdx = idx >= 0 ? idx : p.indexOf(oldText);
              if (useIdx >= 0) {
                paras[paragraphIndex] = p.slice(0, useIdx) + newText + p.slice(useIdx + oldText.length);
              }
              return paras.join('\n\n');
            })();
      const nextTitle =
        scope === 'chapter' ? currentChapter.title.split(oldText).join(newText) : currentChapter.title;
      await handleSaveChapterContent(currentChapter.id, nextTitle, nextContent, `Sửa nhanh "${oldText}" -> "${newText}"`);
      setSelectionTooltip(null);
      window.getSelection()?.removeAllRanges();
      showHUDToast(`Đã dùng: "${newText}"`);
    }
  };

  const handleQuickSaveDictionary = async (params: {
    originalZh: string;
    oldDisplayedText: string;
    replacement: string;
    dictScope: QuickDictScope;
    replaceScope: QuickReplaceScope;
    paragraphIndex: number;
    startInPara: number;
    endInPara: number;
  }) => {
    const {
      originalZh,
      oldDisplayedText,
      replacement,
      dictScope,
      replaceScope,
      paragraphIndex,
      startInPara,
      endInPara,
    } = params;
    const targetBookId = dictScope === 'global' ? GLOBAL_DICTIONARY_BOOK_ID : book.id;
    const scopeList = dictScope === 'global' ? globalDictionaries : bookDictionaries;
    const keyOrig = (originalZh || oldDisplayedText).trim();
    const existing = scopeList.find((d) => d.original.trim() === keyOrig);

    const entry: DictionaryEntry = existing
      ? { ...existing, replacement: replacement.trim(), enabled: true }
      : {
          id: `dict-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          bookId: targetBookId,
          type: 'character',
          original: keyOrig,
          replacement: replacement.trim(),
          enabled: true,
        };

    await saveDictionaryEntry(entry);
    const [nextBookDict, nextGlobalDict] = await Promise.all([
      getDictionaries(book.id),
      getDictionaries(GLOBAL_DICTIONARY_BOOK_ID),
    ]);
    setBookDictionaries(nextBookDict);
    setGlobalDictionaries(nextGlobalDict);

    if (isViewingTranslation && currentTranslation) {
      let nextContent = currentTranslation.translatedContent;
      let nextTitle = currentTranslation.translatedTitle;
      if (replaceScope === 'chapter') {
        if (oldDisplayedText) {
          nextContent = nextContent.split(oldDisplayedText).join(replacement);
          nextTitle = nextTitle.split(oldDisplayedText).join(replacement);
        }
        if (keyOrig && keyOrig !== oldDisplayedText) {
          nextContent = nextContent.split(keyOrig).join(replacement);
          nextTitle = nextTitle.split(keyOrig).join(replacement);
        }
        await handleSaveTranslatedChapterContent(currentChapter.id, nextTitle, nextContent);
      } else {
        await applyNameReplacement({
          oldText: oldDisplayedText,
          newText: replacement,
          scope: 'once',
          paragraphIndex,
          startInPara,
          endInPara,
        });
      }
    } else if (!settings.applyDictionary) {
      onUpdateSettings({ applyDictionary: true });
    }

    setSelectionTooltip(null);
    window.getSelection()?.removeAllRanges();
    showHUDToast(`Đã lưu từ điển (${dictScope === 'global' ? 'Mọi truyện' : 'Truyện này'}): ${replacement}`);
  };

  // Inline Paragraph Operations (works on both original & translated text)
  const handleStartInlineEdit = (idx: number) => {
    const targetPara = paragraphs[idx] || '';
    setEditingParagraphIndex(idx);
    setConfirmDeleteParaIdx(null);
    setParagraphEditText(targetPara);
  };

  const saveActiveParagraphsList = async (updatedParas: string[], summary: string) => {
    const newContent = updatedParas.join('\n\n');
    if (isViewingTranslation && currentTranslation) {
      await handleSaveTranslatedChapterContent(
        currentChapter.id,
        currentTranslation.translatedTitle,
        newContent
      );
    } else {
      await handleSaveChapterContent(currentChapter.id, currentChapter.title, newContent, summary);
    }
  };

  const handleSaveInlineParagraph = async (idx: number) => {
    const updatedParas = [...paragraphs];
    const newItems = paragraphEditText.split(/\r?\n+/).map((p) => p.trim()).filter(Boolean);
    if (newItems.length > 0) {
      updatedParas.splice(idx, 1, ...newItems);
    } else {
      updatedParas.splice(idx, 1);
    }
    await saveActiveParagraphsList(updatedParas, `Sửa đoạn ${idx + 1}`);
    setEditingParagraphIndex(null);
    setConfirmDeleteParaIdx(null);
  };

  const handleCancelInlineParagraph = () => {
    setEditingParagraphIndex(null);
    setConfirmDeleteParaIdx(null);
    setParagraphEditText('');
  };

  const handleSplitParagraph = () => {
    setParagraphEditText((prev) => prev + '\n\n');
  };

  const handleMergeWithPrevParagraph = async (idx: number) => {
    if (idx <= 0) return;
    const updatedParas = [...paragraphs];
    updatedParas[idx - 1] = `${updatedParas[idx - 1]} ${paragraphEditText.trim()}`;
    updatedParas.splice(idx, 1);
    await saveActiveParagraphsList(updatedParas, `Gộp đoạn ${idx + 1} với đoạn trước`);
    setEditingParagraphIndex(null);
    setConfirmDeleteParaIdx(null);
  };

  const handleMergeWithNextParagraph = async (idx: number) => {
    if (idx >= paragraphs.length - 1) return;
    const updatedParas = [...paragraphs];
    updatedParas[idx] = `${paragraphEditText.trim()} ${updatedParas[idx + 1]}`;
    updatedParas.splice(idx + 1, 1);
    await saveActiveParagraphsList(updatedParas, `Gộp đoạn ${idx + 1} với đoạn sau`);
    setEditingParagraphIndex(null);
    setConfirmDeleteParaIdx(null);
  };

  const handleDeleteParagraph = async (idx: number) => {
    const updatedParas = [...paragraphs];
    updatedParas.splice(idx, 1);
    await saveActiveParagraphsList(updatedParas, `Xóa đoạn ${idx + 1}`);
    setEditingParagraphIndex(null);
    setConfirmDeleteParaIdx(null);
  };

  const handleHighlightSelection = async (color: Highlight['color']) => {
    if (!selectionTooltip) return;
    const newHighlight: Highlight = {
      id: `hl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      bookId: book.id,
      chapterIndex: currentChapterIndex,
      text: selectionTooltip.text,
      color,
      createdAt: Date.now(),
    };
    await saveHighlight(newHighlight);
    const updated = await getHighlights(book.id);
    setHighlights(updated);
    showHUDToast('Đã tô sáng đoạn văn');
    setSelectionTooltip(null);
  };

  // Subscribe to TTS
  React.useEffect(() => {
    const unsub = ttsService.subscribe((st) => setTtsState(st));
    // Auto advance chapter on TTS finish
    ttsService.setOnChapterFinished(() => {
      if (settings.ttsAutoNextChapter && currentChapterIndex < localChapters.length - 1) {
        handleGoToChapter(currentChapterIndex + 1);
        setTimeout(() => ttsService.play(0), 400);
      }
    });

    return () => {
      unsub();
      ttsService.stop();
    };
  }, [currentChapterIndex, localChapters.length, settings.ttsAutoNextChapter]);

  // Load currently displayed text (original or translated) into TTS engine
  React.useEffect(() => {
    ttsService.loadChapterText(displayedContent, 0);
  }, [currentChapterIndex, displayedContent]);

  // Debounced auto-save reading progress
  const saveReadingProgress = React.useCallback(
    (chapterIdx: number, progress: number) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = window.setTimeout(async () => {
        const updatedBook: Book = {
          ...book,
          currentChapterIndex: chapterIdx,
          scrollProgress: progress,
          lastReadTimestamp: Date.now(),
          status: chapterIdx === localChapters.length - 1 && progress > 0.9 ? 'completed' : 'reading',
        };
        await saveBook(updatedBook);
      }, 500);
    },
    [book, localChapters.length]
  );

  // Load saved translations for adjacent chapters in continuous mode
  React.useEffect(() => {
    if (settings.readingMode !== 'continuous') return;
    let cancelled = false;
    const toLoad: Chapter[] = [];
    for (let i = continuousRange.start; i <= continuousRange.end; i++) {
      const ch = localChapters[i];
      if (ch && !(ch.id in continuousTranslations)) {
        toLoad.push(ch);
      }
    }
    if (toLoad.length === 0) return;

    Promise.all(
      toLoad.map(async (ch) => {
        try {
          const saved = await getChapterTranslation(ch.id);
          return [ch.id, saved || null] as const;
        } catch {
          return [ch.id, null] as const;
        }
      })
    ).then((pairs) => {
      if (cancelled) return;
      setContinuousTranslations((prev) => {
        const next = { ...prev };
        for (const [id, val] of pairs) next[id] = val;
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [settings.readingMode, continuousRange, localChapters, continuousTranslations]);

  // Keep continuousRange anchored when user jumps via TOC or chapter buttons
  React.useEffect(() => {
    if (settings.readingMode !== 'continuous') return;
    if (skipContinuousResetRef.current) {
      skipContinuousResetRef.current = false;
      return;
    }
    setContinuousRange({
      start: currentChapterIndex,
      end: Math.min(localChapters.length - 1, currentChapterIndex + 1),
    });
  }, [currentChapterIndex, settings.readingMode, localChapters.length]);

  // Restore or reset scroll position when chapter/mode loads
  React.useEffect(() => {
    setFocusedParaIndex(0);
    if (!contentContainerRef.current) return;
    if (settings.readingMode === 'scroll') {
      if (!restoredInitialScrollRef.current && book.scrollProgress > 0 && currentChapterIndex === (book.currentChapterIndex || 0)) {
        restoredInitialScrollRef.current = true;
        requestAnimationFrame(() => {
          const el = contentContainerRef.current;
          if (!el) return;
          const maxScroll = el.scrollHeight - el.clientHeight;
          if (maxScroll > 0) {
            el.scrollTop = Math.round(maxScroll * Math.min(0.98, book.scrollProgress));
          }
        });
      } else {
        restoredInitialScrollRef.current = true;
        contentContainerRef.current.scrollTop = 0;
      }
    } else if (settings.readingMode === 'continuous' && !skipContinuousResetRef.current) {
      contentContainerRef.current.scrollTop = 0;
    } else if (settings.readingMode === 'focus') {
      contentContainerRef.current.scrollTop = 0;
    }
  }, [currentChapterIndex, settings.readingMode]);

  // Auto-scroll loop (smooth fractional rAF accumulation for scroll, continuous & focus modes)
  React.useEffect(() => {
    const speed = settings.autoScrollSpeed || 0;
    const isPaged = settings.readingMode === 'paginated' || settings.readingMode === 'two-column';
    const anyModalOpen =
      showTOC ||
      showSettings ||
      showSearch ||
      showBookmarks ||
      showDictionary ||
      showThemeManager ||
      showChapterManager ||
      showShortcutHelp ||
      showChapterEditor ||
      showFindReplace ||
      showVersions ||
      showExport;

    if (
      speed <= 0 ||
      isAutoScrollPaused ||
      isPaged ||
      editingParagraphIndex !== null ||
      !!selectionTooltip ||
      anyModalOpen
    ) {
      return;
    }

    let rafId = 0;
    let lastTime = performance.now();
    scrollAccumRef.current = 0;

    const tick = (now: number) => {
      const dt = Math.min(100, now - lastTime);
      lastTime = now;

      const el = contentContainerRef.current;
      if (el) {
        const pxPerSec = speed * 22;
        scrollAccumRef.current += (pxPerSec * dt) / 1000;
        const wholePx = Math.floor(scrollAccumRef.current);
        if (wholePx >= 1) {
          scrollAccumRef.current -= wholePx;
          el.scrollTop += wholePx;
          // Stop cleanly at end in single-chapter scroll mode
          if (
            settings.readingMode !== 'continuous' &&
            el.scrollTop + el.clientHeight >= el.scrollHeight - 1
          ) {
            setIsAutoScrollPaused(true);
            return;
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    settings.autoScrollSpeed,
    settings.readingMode,
    isAutoScrollPaused,
    editingParagraphIndex,
    selectionTooltip,
    showTOC,
    showSettings,
    showSearch,
    showBookmarks,
    showDictionary,
    showThemeManager,
    showChapterManager,
    showShortcutHelp,
    showChapterEditor,
    showFindReplace,
    showVersions,
    showExport,
  ]);

  // Handle scroll event (progress saving + continuous mode chapter append/tracking)
  const handleScroll = () => {
    const el = contentContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScroll = scrollHeight - clientHeight;

    if (settings.readingMode === 'scroll' || settings.readingMode === 'focus') {
      const progress = maxScroll > 0 ? scrollTop / maxScroll : 0;
      saveReadingProgress(currentChapterIndex, progress);
      return;
    }

    if (settings.readingMode === 'continuous') {
      // Append next chapter near bottom
      if (maxScroll - scrollTop < 550 && continuousRange.end < localChapters.length - 1) {
        setContinuousRange((prev) => ({
          ...prev,
          end: Math.min(localChapters.length - 1, prev.end + 1),
        }));
      }

      // Detect which chapter is currently active in viewport
      const blocks = el.querySelectorAll<HTMLElement>('[data-continuous-ch]');
      const containerTop = el.getBoundingClientRect().top;
      const thresholdY = containerTop + Math.min(180, clientHeight * 0.3);
      let activeIdx = currentChapterIndex;
      let activeBlock: HTMLElement | null = null;

      blocks.forEach((blk) => {
        const rect = blk.getBoundingClientRect();
        if (rect.top <= thresholdY) {
          const parsed = Number(blk.getAttribute('data-continuous-ch'));
          if (!Number.isNaN(parsed)) {
            activeIdx = parsed;
            activeBlock = blk;
          }
        }
      });

      if (activeIdx !== currentChapterIndex) {
        skipContinuousResetRef.current = true;
        setCurrentChapterIndex(activeIdx);
      }

      if (activeBlock) {
        const bRect = (activeBlock as HTMLElement).getBoundingClientRect();
        const chProg = bRect.height > 0 ? Math.min(1, Math.max(0, (thresholdY - bRect.top) / bRect.height)) : 0;
        saveReadingProgress(activeIdx, chProg);
      }
    }
  };

  // Auto-append next chapter in continuous mode if current content doesn't fill viewport yet
  React.useEffect(() => {
    if (settings.readingMode !== 'continuous') return;
    if (continuousRange.end >= localChapters.length - 1) return;
    const raf = requestAnimationFrame(() => {
      const el = contentContainerRef.current;
      if (el && el.scrollHeight - el.clientHeight < 300) {
        setContinuousRange((prev) => ({
          ...prev,
          end: Math.min(localChapters.length - 1, prev.end + 1),
        }));
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [settings.readingMode, continuousRange, localChapters.length]);

  const handleLoadPrevContinuousChapter = () => {
    const el = contentContainerRef.current;
    if (!el || continuousRange.start <= 0) return;
    const prevHeight = el.scrollHeight;
    const prevTop = el.scrollTop;
    setContinuousRange((prev) => ({ ...prev, start: Math.max(0, prev.start - 1) }));
    requestAnimationFrame(() => {
      const nextEl = contentContainerRef.current;
      if (!nextEl) return;
      const diff = nextEl.scrollHeight - prevHeight;
      if (diff > 0) {
        nextEl.scrollTop = prevTop + diff;
      }
    });
  };

  // Chapter Navigation
  const handleGoToChapter = (newIndex: number) => {
    if (newIndex >= 0 && newIndex < localChapters.length) {
      skipContinuousResetRef.current = false;
      setCurrentChapterIndex(newIndex);
      setCurrentPageIndex(0);
      setFocusedParaIndex(0);
      saveReadingProgress(newIndex, 0);
    }
  };

  // Paragraphs list (follows currently displayed original or translation)
  const paragraphs = React.useMemo(() => {
    return displayedContent.split('\n').filter((p) => p.trim().length > 0);
  }, [displayedContent]);

  const jumpToSnippetInCurrentView = React.useCallback((snippet: string) => {
    const cleanCore = snippet
      .replace(/^\.\.\./, '')
      .replace(/\.\.\.$/, '')
      .trim()
      .toLowerCase();
    if (!cleanCore) return;

    const probe = cleanCore.slice(0, Math.min(36, cleanCore.length));
    const container = contentContainerRef.current;
    if (!container) return;
    const paraNodes = Array.from(container.querySelectorAll<HTMLElement>('[data-para-idx]'));
    const matchedEl = paraNodes.find((el) =>
      (el.textContent || '').toLowerCase().includes(probe)
    );
    if (!matchedEl) return;

    const idxAttr = Number(matchedEl.getAttribute('data-para-idx'));
    if (!Number.isNaN(idxAttr)) {
      setFocusedParaIndex(idxAttr);
    }

    if (settings.readingMode === 'paginated' || settings.readingMode === 'two-column') {
      const track = pagedTrackRef.current;
      if (track && pagedBoxSize.width > 0) {
        const effTwoCol = settings.readingMode === 'two-column' && pagedBoxSize.width >= 720;
        const colGap = effTwoCol ? 56 : 48;
        const stepW = pagedBoxSize.width + colGap;
        const trackRect = track.getBoundingClientRect();
        const elRect = matchedEl.getBoundingClientRect();
        const relLeft = elRect.left - trackRect.left + currentPageIndex * stepW;
        const targetPage = Math.max(0, Math.floor(relLeft / stepW));
        setCurrentPageIndex(targetPage);
      }
    } else {
      matchedEl.scrollIntoView({
        block: 'center',
        behavior: settings.smoothScroll === false ? 'auto' : 'smooth',
      });
    }
  }, [settings.readingMode, settings.smoothScroll, pagedBoxSize.width, currentPageIndex]);

  // Execute deferred jump to matched paragraph/page after Search, Bookmark, or Highlight selection
  React.useEffect(() => {
    const pending = pendingSearchJumpRef.current;
    if (!pending || pending.chapterIndex !== currentChapterIndex) return;
    pendingSearchJumpRef.current = null;

    const raf = requestAnimationFrame(() => {
      jumpToSnippetInCurrentView(pending.snippet);
    });

    return () => cancelAnimationFrame(raf);
  }, [currentChapterIndex, paragraphs, jumpToSnippetInCurrentView]);

  // Global Keyboard Navigation & Shortcut System
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input / textarea / select
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Help Modal: ? or F1
      if (e.key === '?' || e.key === 'F1') {
        e.preventDefault();
        setShowShortcutHelp((prev) => !prev);
        return;
      }

      // Escape: Close open drawers or back to library
      if (e.key === 'Escape') {
        if (pendingNoteModal) {
          setPendingNoteModal(null);
          return;
        }
        if (showMoreMenu) {
          setShowMoreMenu(false);
          return;
        }
        if (showShortcutHelp) {
          setShowShortcutHelp(false);
          return;
        }
        if (
          showTOC ||
          showSettings ||
          showSearch ||
          showBookmarks ||
          showDictionary ||
          showTTS ||
          showThemeManager ||
          showChapterManager ||
          showChapterEditor ||
          showFindReplace ||
          showVersions ||
          showExport
        ) {
          setShowTOC(false);
          setShowSettings(false);
          setShowSearch(false);
          setShowBookmarks(false);
          setShowDictionary(false);
          setShowTTS(false);
          setShowThemeManager(false);
          setShowChapterManager(false);
          setShowChapterEditor(false);
          setShowFindReplace(false);
          setShowVersions(false);
          setShowExport(false);
        } else {
          onBackToLibrary();
        }
        return;
      }

      // Next Chapter: ] or Shift + N
      if (e.key === ']' || (e.shiftKey && e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        if (currentChapterIndex < localChapters.length - 1) {
          handleGoToChapter(currentChapterIndex + 1);
          showHUDToast(`Chương ${currentChapterIndex + 2} / ${localChapters.length}`);
        } else {
          showHUDToast('Đã ở chương cuối');
        }
        return;
      }

      // Previous Chapter: [ or Shift + P
      if (e.key === '[' || (e.shiftKey && e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        if (currentChapterIndex > 0) {
          handleGoToChapter(currentChapterIndex - 1);
          showHUDToast(`Chương ${currentChapterIndex} / ${localChapters.length}`);
        } else {
          showHUDToast('Đã ở chương đầu');
        }
        return;
      }

      // Toggle Theme: C (cycle next theme)
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        cycleNextTheme();
        return;
      }

      // Light / Dark toggle: L
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        toggleLightDark();
        return;
      }

      // Direct Theme Numbers 1-6
      const themeKeyMap: Record<string, string> = {
        '1': 'paper',
        '2': 'sepia',
        '3': 'light',
        '4': 'dark',
        '5': 'oled',
        '6': 'eink',
      };
      if (themeKeyMap[e.key]) {
        e.preventDefault();
        const tId = themeKeyMap[e.key];
        const tLabels: Record<string, string> = {
          paper: 'Paper (Giấy)',
          sepia: 'Sepia (Ấm)',
          light: 'Light (Sáng)',
          dark: 'Dark (Tối)',
          oled: 'OLED (Đen sâu)',
          eink: 'E-ink (Đơn sắc)',
        };
        handleApplyCustomTheme(tId);
        showHUDToast(`Chủ đề: ${tLabels[tId]}`);
        return;
      }

      // Font Size: + / = or - / _
      if (e.key === '+' || e.key === '=' || (e.ctrlKey && e.key === '=')) {
        e.preventDefault();
        const nextSize = Math.min(34, settings.fontSize + 1);
        onUpdateSettings({ fontSize: nextSize });
        showHUDToast(`Cỡ chữ: ${nextSize}px`);
        return;
      }
      if (e.key === '-' || e.key === '_' || (e.ctrlKey && e.key === '-')) {
        e.preventDefault();
        const nextSize = Math.max(14, settings.fontSize - 1);
        onUpdateSettings({ fontSize: nextSize });
        showHUDToast(`Cỡ chữ: ${nextSize}px`);
        return;
      }

      // Reading Mode Cycle: R
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        const modeOrder: ReadingMode[] = ['scroll', 'continuous', 'paginated', 'two-column', 'focus'];
        const modeLabels: Record<ReadingMode, string> = {
          scroll: 'Cuộn chương',
          continuous: 'Cuộn liền mạch',
          paginated: 'Lật trang (1 cột)',
          'two-column': 'Sách 2 trang',
          focus: 'Tập trung từng đoạn',
        };
        const curIdx = modeOrder.indexOf(settings.readingMode);
        const nextMode = modeOrder[(curIdx + 1) % modeOrder.length];
        onUpdateSettings({ readingMode: nextMode });
        showHUDToast(`Chế độ: ${modeLabels[nextMode]}`);
        return;
      }

      // Find & Replace: Ctrl + H
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        openFindReplaceModal();
        return;
      }

      // Search: / or Ctrl + F
      if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f')) {
        e.preventDefault();
        setShowSearch((prev) => !prev);
        return;
      }

      // Guard remaining single-letter shortcuts against Ctrl/Meta browser/app combos
      const hasModifier = e.ctrlKey || e.metaKey || e.altKey;

      // H: Toggle Toolbar / Zen mode
      if (!hasModifier && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        setShowUI((prev) => {
          const next = !prev;
          showHUDToast(next ? 'Hiện thanh công cụ' : 'Ẩn thanh công cụ (Zen)');
          return next;
        });
        return;
      }

      // M: Table of Contents
      if (!hasModifier && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        setShowTOC((prev) => !prev);
        return;
      }

      // S: Settings drawer
      if (!hasModifier && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setShowSettings((prev) => !prev);
        return;
      }

      // Edit Chapter / Translation: E
      if (!hasModifier && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        setShowChapterEditor((prev) => !prev);
        return;
      }

      // Bookmarks: B (save) or Shift + B (open drawer)
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        if (e.shiftKey) {
          setShowBookmarks((prev) => !prev);
        } else {
          handleAddBookmark();
          showHUDToast('Đã lưu dấu trang');
        }
        return;
      }

      // Dictionary: W
      if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        setShowDictionary((prev) => !prev);
        return;
      }

      // TTS: T
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setShowTTS((prev) => !prev);
        return;
      }

      // TTS Play / Pause: P
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        if (ttsState.isPlaying && !ttsState.isPaused) {
          ttsService.pause();
          showHUDToast('TTS: Tạm dừng');
        } else {
          ttsService.play();
          showHUDToast('TTS: Đang phát');
        }
        return;
      }

      // Fullscreen: F11
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // ArrowRight / D
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        if (settings.readingMode === 'paginated' || settings.readingMode === 'two-column') {
          handleNextPage();
        } else if (currentChapterIndex < localChapters.length - 1) {
          handleGoToChapter(currentChapterIndex + 1);
          showHUDToast(`Chương ${currentChapterIndex + 2} / ${localChapters.length}`);
        } else {
          showHUDToast('Đã ở chương cuối');
        }
        return;
      }

      // ArrowLeft / A
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        if (settings.readingMode === 'paginated' || settings.readingMode === 'two-column') {
          handlePrevPage();
        } else if (currentChapterIndex > 0) {
          handleGoToChapter(currentChapterIndex - 1);
          showHUDToast(`Chương ${currentChapterIndex} / ${localChapters.length}`);
        } else {
          showHUDToast('Đã ở chương đầu');
        }
        return;
      }

      // Space: Page / Scroll / Focus step
      if (e.key === ' ') {
        e.preventDefault();
        const behavior: ScrollBehavior = settings.smoothScroll === false ? 'auto' : 'smooth';
        if (e.shiftKey) {
          if (settings.readingMode === 'paginated' || settings.readingMode === 'two-column') {
            handlePrevPage();
          } else if (settings.readingMode === 'focus') {
            stepFocusParagraph(-1);
          } else if (contentContainerRef.current) {
            contentContainerRef.current.scrollBy({
              top: -window.innerHeight * 0.75,
              behavior,
            });
          }
        } else {
          if (settings.readingMode === 'paginated' || settings.readingMode === 'two-column') {
            handleNextPage();
          } else if (settings.readingMode === 'focus') {
            stepFocusParagraph(1);
          } else if (contentContainerRef.current) {
            contentContainerRef.current.scrollBy({
              top: window.innerHeight * 0.75,
              behavior,
            });
          }
        }
        return;
      }

      // J / K / ArrowDown / ArrowUp scrolling or focus stepping
      if (e.key === 'j' || e.key === 'J' || (settings.readingMode === 'focus' && e.key === 'ArrowDown')) {
        if (settings.readingMode === 'focus') {
          e.preventDefault();
          stepFocusParagraph(1);
        } else if (contentContainerRef.current) {
          contentContainerRef.current.scrollBy({
            top: 140,
            behavior: settings.smoothScroll === false ? 'auto' : 'smooth',
          });
        }
        return;
      }
      if (e.key === 'k' || e.key === 'K' || (settings.readingMode === 'focus' && e.key === 'ArrowUp')) {
        if (settings.readingMode === 'focus') {
          e.preventDefault();
          stepFocusParagraph(-1);
        } else if (contentContainerRef.current) {
          contentContainerRef.current.scrollBy({
            top: -140,
            behavior: settings.smoothScroll === false ? 'auto' : 'smooth',
          });
        }
        return;
      }

      // Home / End
      if (e.key === 'Home') {
        e.preventDefault();
        if (settings.readingMode === 'paginated' || settings.readingMode === 'two-column') {
          setCurrentPageIndex(0);
          showHUDToast('Trang đầu chương');
        } else if (contentContainerRef.current) {
          contentContainerRef.current.scrollTo({
            top: 0,
            behavior: settings.smoothScroll === false ? 'auto' : 'smooth',
          });
          setFocusedParaIndex(0);
          showHUDToast('Đầu chương');
        }
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        if (settings.readingMode === 'paginated' || settings.readingMode === 'two-column') {
          setCurrentPageIndex(Math.max(0, totalPages - 1));
          showHUDToast('Trang cuối chương');
        } else if (contentContainerRef.current) {
          contentContainerRef.current.scrollTo({
            top: contentContainerRef.current.scrollHeight,
            behavior: settings.smoothScroll === false ? 'auto' : 'smooth',
          });
          setFocusedParaIndex(Math.max(0, paragraphs.length - 1));
          showHUDToast('Cuối chương');
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentChapterIndex,
    localChapters.length,
    totalPages,
    paragraphs.length,
    settings,
    showTOC,
    showSettings,
    showSearch,
    showBookmarks,
    showDictionary,
    showTTS,
    showThemeManager,
    showChapterManager,
    showChapterEditor,
    showFindReplace,
    showVersions,
    showExport,
    showShortcutHelp,
    showMoreMenu,
    pendingNoteModal,
    ttsState,
    isViewingTranslation,
    cycleNextTheme,
    toggleLightDark,
    handleApplyCustomTheme,
    onUpdateSettings,
    showHUDToast,
    onBackToLibrary,
  ]);

  const isPagedMode = settings.readingMode === 'paginated' || settings.readingMode === 'two-column';
  const effectiveTwoColumn = settings.readingMode === 'two-column' && pagedBoxSize.width >= 720;
  const pagedColumnGap = effectiveTwoColumn ? 56 : 48;

  // Observe viewport box size for true column pagination
  React.useEffect(() => {
    if (!isPagedMode) return;
    const el = pagedViewportRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 100 && rect.height > 100) {
        setPagedBoxSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
      }
    };
    updateSize();

    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isPagedMode, showUI, settings.containerWidth]);

  // Measure real CSS column pages whenever content, typography, or viewport changes
  React.useLayoutEffect(() => {
    if (!isPagedMode) return;
    const track = pagedTrackRef.current;
    if (!track || pagedBoxSize.width <= 0) return;

    const stepWidth = pagedBoxSize.width + pagedColumnGap;
    const calculatedTotal = Math.max(1, Math.ceil((track.scrollWidth - 4) / stepWidth));
    setTotalPages(calculatedTotal);

    if (jumpToLastPageOnLoadRef.current) {
      jumpToLastPageOnLoadRef.current = false;
      setCurrentPageIndex(Math.max(0, calculatedTotal - 1));
    } else {
      setCurrentPageIndex((prev) => Math.min(prev, Math.max(0, calculatedTotal - 1)));
    }
  }, [
    isPagedMode,
    pagedBoxSize.width,
    pagedBoxSize.height,
    pagedColumnGap,
    paragraphs.length,
    displayedContent,
    displayedTitle,
    settings.fontSize,
    settings.lineHeight,
    settings.paragraphSpacing,
    settings.fontFamily,
    settings.textAlign,
    settings.textIndent,
    settings.containerWidth,
    settings.applyDictionary,
    currentChapterIndex,
    readingViewMode,
  ]);

  const handleNextPage = () => {
    if (currentPageIndex < totalPages - 1) {
      const next = currentPageIndex + 1;
      setCurrentPageIndex(next);
      saveReadingProgress(currentChapterIndex, totalPages > 1 ? next / (totalPages - 1) : 1);
    } else if (currentChapterIndex < localChapters.length - 1) {
      handleGoToChapter(currentChapterIndex + 1);
    } else {
      showHUDToast('Đã ở trang cuối cùng');
    }
  };

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      const prev = currentPageIndex - 1;
      setCurrentPageIndex(prev);
      saveReadingProgress(currentChapterIndex, totalPages > 1 ? prev / (totalPages - 1) : 0);
    } else if (currentChapterIndex > 0) {
      jumpToLastPageOnLoadRef.current = true;
      handleGoToChapter(currentChapterIndex - 1);
    } else {
      showHUDToast('Đã ở trang đầu tiên');
    }
  };

  const stepFocusParagraph = (delta: number) => {
    setFocusedParaIndex((prev) => {
      const next = Math.max(0, Math.min(Math.max(0, paragraphs.length - 1), prev + delta));
      requestAnimationFrame(() => {
        const el = contentContainerRef.current?.querySelector<HTMLElement>(`[data-para-idx="${next}"]`);
        el?.scrollIntoView({
          block: 'center',
          behavior: settings.smoothScroll === false ? 'auto' : 'smooth',
        });
      });
      return next;
    });
  };

  // Text Selection Menu / Quick Name Analyzer for Translated & Chinese Novels
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionTooltip(null);
      return;
    }

    const text = selection.toString().trim();
    if (text.length > 0 && text.length < 500) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const startEl =
        range.startContainer instanceof Element
          ? range.startContainer
          : range.startContainer.parentElement;
      const paraEl = startEl?.closest('[data-para-idx]');
      const paraIdxAttr = paraEl?.getAttribute('data-para-idx');
      const parsedIdx = paraIdxAttr !== null && paraIdxAttr !== undefined ? Number(paraIdxAttr) : undefined;
      const paragraphIndex = parsedIdx !== undefined && !Number.isNaN(parsedIdx) ? parsedIdx : undefined;

      let startInPara: number | undefined;
      let endInPara: number | undefined;
      if (paragraphIndex !== undefined && paraEl) {
        const paraRaw = paragraphs[paragraphIndex] || '';
        try {
          const preRange = range.cloneRange();
          preRange.selectNodeContents(paraEl);
          preRange.setEnd(range.startContainer, range.startOffset);
          const rawStart = preRange.toString().length;
          if (paraRaw.slice(rawStart, rawStart + text.length) === text) {
            startInPara = rawStart;
            endInPara = rawStart + text.length;
          } else {
            const near = paraRaw.indexOf(text, Math.max(0, rawStart - 12));
            const fallback = near >= 0 ? near : paraRaw.indexOf(text);
            if (fallback >= 0) {
              startInPara = fallback;
              endInPara = fallback + text.length;
            }
          }
        } catch {
          const idx = paraRaw.indexOf(text);
          if (idx >= 0) {
            startInPara = idx;
            endInPara = idx + text.length;
          }
        }
      }

      const preferQuickName =
        isViewingTranslation ||
        containsCjk(text) ||
        containsCjk(currentChapter.content);

      setSelectionTooltip({
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
        text,
        paragraphIndex,
        startInPara,
        endInPara,
        mode: preferQuickName ? 'quick-name' : 'menu',
      });
    } else {
      setSelectionTooltip(null);
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Bookmark current position
  const handleAddBookmark = async (noteText?: string, excerpt?: string) => {
    const textSnippet =
      excerpt ||
      currentChapter.content.slice(0, 150).replace(/\n/g, ' ') + '...';

    const newBookmark: Bookmark = {
      id: `bm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      bookId: book.id,
      chapterIndex: currentChapterIndex,
      chapterTitle: currentChapter.title,
      progressPercent: Math.round(((currentChapterIndex + 1) / Math.max(1, localChapters.length)) * 100),
      textSnippet,
      note: noteText || undefined,
      createdAt: Date.now(),
    };

    await saveBookmark(newBookmark);
    const updated = await getBookmarks(book.id);
    setBookmarks(updated);
    setSelectionTooltip(null);
  };

  // Container width styling
  const containerWidthClass = {
    compact: 'max-w-xl', // ~576px
    medium: 'max-w-2xl', // ~672px
    wide: 'max-w-4xl', // ~896px
    full: 'max-w-5xl', // ~1024px
  }[settings.containerWidth] || 'max-w-2xl';

  const currentChapterHighlights = React.useMemo(
    () => highlights.filter((h) => h.chapterIndex === currentChapterIndex),
    [highlights, currentChapterIndex]
  );

  // Apply dictionary replacements cleanly, escape HTML, and overlay highlights
  const processedParagraphs = React.useMemo(() => {
    return paragraphs.map((para) => {
      const baseHtml = isViewingTranslation
        ? escapeHtml(para)
        : settings.applyDictionary && dictionaries.length > 0
        ? applyDictionaryToText(para, dictionaries, settings.highlightReplacements)
        : escapeHtml(para);
      return applyHighlightsToHtml(baseHtml, currentChapterHighlights);
    });
  }, [
    isViewingTranslation,
    paragraphs,
    settings.applyDictionary,
    settings.highlightReplacements,
    dictionaries,
    currentChapterHighlights,
  ]);

  const visibleParagraphs = processedParagraphs;

  const currentOverallPercent = Math.min(
    100,
    Math.max(
      0,
      localChapters.length > 0
        ? Math.round(((currentChapterIndex + 1) / localChapters.length) * 100)
        : 0
    )
  );

  const activeCustomTheme = settings.customThemes?.find((t) => t.id === settings.theme);
  const containerBg = activeCustomTheme
    ? activeCustomTheme.backgroundColor
    : settings.backgroundColor || 'var(--reader-bg)';
  const containerText = activeCustomTheme
    ? activeCustomTheme.textColor
    : settings.textColor || 'var(--reader-text)';
  const containerBgImage = activeCustomTheme?.backgroundImageUrl || settings.backgroundImageUrl;

  return (
    <div
      className={`relative w-full h-full flex flex-col overflow-hidden theme-${settings.theme} ${settings.fontFamily}`}
      style={{
        backgroundColor: containerBg,
        color: containerText,
        backgroundImage: containerBgImage ? `url(${containerBgImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Top Floating Header HUD */}
      {showUI && (
        <header
          className="h-12 border-b border-neutral-800/40 px-4 flex items-center justify-between gap-3 shrink-0 select-none backdrop-blur-md z-30 transition-all duration-200"
          style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
        >
          {/* Left: Back & Chapter/Book Identity */}
          <div className="flex items-center space-x-2.5 min-w-0">
            <button
              onClick={onBackToLibrary}
              className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title="Quay lại Kệ sách (Esc)"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-xs font-bold truncate max-w-[180px] sm:max-w-sm md:max-w-md">
                  {displayedTitle}
                </h2>
                {isAutoSaving ? (
                  <span className="flex items-center space-x-1 text-[10px] text-amber-400 font-mono shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="hidden sm:inline">Đang lưu...</span>
                  </span>
                ) : lastSavedTimestamp ? (
                  <span className="flex items-center space-x-1 text-[10px] text-emerald-400 font-mono shrink-0">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="hidden sm:inline">Đã lưu</span>
                  </span>
                ) : null}
              </div>
              <span className="text-[10px] opacity-60 font-mono truncate block">
                {book.title}{book.author ? ` • ${book.author}` : ''}
              </span>
            </div>
          </div>

          {/* Right: Reading Progress, Navigation & Single Corner Popover */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Compact Reading Progress */}
            <div
              className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/15 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[11px] font-mono"
              title={`Tiến trình đọc: Chương ${currentChapterIndex + 1} / ${localChapters.length} (${currentOverallPercent}%)`}
            >
              <span className="opacity-75">
                Ch. {currentChapterIndex + 1}/{localChapters.length}
              </span>
              <span className="opacity-30">•</span>
              <span className="font-semibold text-amber-500">{currentOverallPercent}%</span>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center bg-black/15 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl p-0.5">
              <button
                disabled={currentChapterIndex === 0}
                onClick={() => handleGoToChapter(currentChapterIndex - 1)}
                className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Chương trước (←)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowTOC(true)}
                className={`flex items-center space-x-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  showTOC ? 'bg-amber-600 text-white' : 'hover:bg-black/10 dark:hover:bg-white/10'
                }`}
                title="Mục lục chương (M)"
              >
                <List className="w-4 h-4" />
                <span className="hidden md:inline">Mục lục</span>
              </button>

              <button
                disabled={currentChapterIndex >= localChapters.length - 1}
                onClick={() => handleGoToChapter(currentChapterIndex + 1)}
                className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Chương sau (→)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Single Corner Actions Popover */}
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setShowMoreMenu((prev) => !prev)}
                className={`relative p-2 rounded-xl border border-black/10 dark:border-white/10 transition-colors cursor-pointer ${
                  showMoreMenu
                    ? 'bg-amber-600 text-white border-amber-500'
                    : 'bg-black/15 dark:bg-white/5 hover:bg-black/25 dark:hover:bg-white/10'
                }`}
                title="Tùy chọn & Công cụ"
                aria-expanded={showMoreMenu}
                aria-haspopup="menu"
              >
                {isTranslating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                ) : (
                  <MoreVertical className="w-4 h-4" />
                )}
                {!isTranslating && (isViewingTranslation || showTTS) && (
                  <span
                    className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
                      isViewingTranslation ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                )}
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 top-full mt-2 w-72 max-h-[calc(100vh-4.5rem)] overflow-y-auto bg-neutral-900/98 border border-neutral-700/80 rounded-xl shadow-2xl py-1.5 text-xs text-neutral-200 z-50 backdrop-blur-md">
                  {/* Section 1: Translation & Dictionary */}
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    Dịch & Từ điển
                  </div>

                  {isTranslating ? (
                    <div className="px-3 py-2 space-y-1.5 bg-neutral-800/60 mx-1.5 rounded-lg">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center space-x-2 text-cyan-300">
                          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                          <span>
                            Đang dịch truyện
                            {translationProgress
                              ? ` (${translationProgress.completedChapters}/${translationProgress.totalChapters} ch.)`
                              : '...'}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            translationAbortRef.current?.abort();
                            setShowMoreMenu(false);
                          }}
                          className="px-2 py-0.5 rounded bg-red-900/60 hover:bg-red-800 text-red-200 text-[11px] cursor-pointer"
                        >
                          Hủy
                        </button>
                      </div>
                      {translationProgress && translationProgress.totalChapters > 0 && (
                        <div className="w-full h-1.5 rounded-full bg-neutral-900 overflow-hidden">
                          <div
                            className="h-full bg-cyan-400 transition-all duration-200"
                            style={{
                              width: `${Math.round(
                                (translationProgress.completedChapters /
                                  Math.max(1, translationProgress.totalChapters)) *
                                  100
                              )}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {currentTranslation && !translationIsStale && (
                        <button
                          type="button"
                          onClick={() => {
                            setReadingViewMode((prev) => {
                              const next = prev === 'translated' ? 'original' : 'translated';
                              setCurrentPageIndex(0);
                              setEditingParagraphIndex(null);
                              return next;
                            });
                            setShowMoreMenu(false);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                        >
                          <span className="flex items-center space-x-2">
                            <Languages className="w-3.5 h-3.5 text-emerald-400" />
                            <span>
                              {isViewingTranslation ? 'Chuyển sang Nguyên văn' : 'Xem Bản dịch đã lưu'}
                            </span>
                          </span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              isViewingTranslation
                                ? 'bg-emerald-600/30 text-emerald-300'
                                : 'bg-neutral-800 text-neutral-400'
                            }`}
                          >
                            {isViewingTranslation ? 'Bản dịch' : 'Nguyên văn'}
                          </span>
                        </button>
                      )}

                      {bookTranslatedCount < localChapters.length && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMoreMenu(false);
                            handleTranslateBook({ retranslateAll: false });
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                        >
                          <span className="flex items-center space-x-2">
                            <Languages className="w-3.5 h-3.5 text-cyan-400" />
                            <span>
                              {bookTranslatedCount > 0 ? 'Dịch tiếp toàn truyện' : 'Dịch truyện'}
                            </span>
                          </span>
                          <span className="text-[10px] font-mono text-cyan-300/90">
                            {bookTranslatedCount > 0
                              ? `${bookTranslatedCount}/${localChapters.length}`
                              : `${localChapters.length} ch.`}
                          </span>
                        </button>
                      )}

                      {(bookTranslatedCount > 0 || translationIsStale) && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMoreMenu(false);
                            handleTranslateBook({ retranslateAll: true });
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                        >
                          <span className="flex items-center space-x-2">
                            <RefreshCw
                              className={`w-3.5 h-3.5 ${
                                dictionaryChangedSinceTranslation || translationIsStale
                                  ? 'text-amber-400'
                                  : 'text-neutral-400'
                              }`}
                            />
                            <span>
                              {translationIsStale
                                ? 'Dịch lại toàn truyện (bản cũ hết hạn)'
                                : 'Dịch lại toàn truyện'}
                            </span>
                          </span>
                          {dictionaryChangedSinceTranslation && (
                            <span className="text-[10px] text-amber-400 font-medium">Từ điển mới</span>
                          )}
                        </button>
                      )}
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowDictionary(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                  >
                    <span className="flex items-center space-x-2">
                      <BookA className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Từ điển riêng</span>
                    </span>
                    <kbd className="text-[10px] font-mono text-neutral-500">W</kbd>
                  </button>

                  <div className="my-1 border-t border-neutral-800" />

                  {/* Section 2: Reading Settings & Utilities */}
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    Hiển thị & Tiện ích
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const modeOrder: ReadingMode[] = ['scroll', 'continuous', 'paginated', 'two-column', 'focus'];
                      const modeLabels: Record<ReadingMode, string> = {
                        scroll: 'Cuộn chương',
                        continuous: 'Cuộn liền mạch',
                        paginated: 'Lật trang',
                        'two-column': 'Sách 2 trang',
                        focus: 'Tập trung',
                      };
                      const nextMode = modeOrder[(modeOrder.indexOf(settings.readingMode) + 1) % modeOrder.length];
                      onUpdateSettings({ readingMode: nextMode });
                      showHUDToast(`Chế độ: ${modeLabels[nextMode]}`);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                  >
                    <span className="flex items-center space-x-2">
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        Chế độ:{' '}
                        <strong className="text-amber-300">
                          {{
                            scroll: 'Cuộn chương',
                            continuous: 'Cuộn liền mạch',
                            paginated: 'Lật trang',
                            'two-column': 'Sách 2 trang',
                            focus: 'Tập trung',
                          }[settings.readingMode]}
                        </strong>
                      </span>
                    </span>
                    <kbd className="text-[10px] font-mono text-neutral-500">R</kbd>
                  </button>

                  {!isPagedMode && (
                    <button
                      type="button"
                      onClick={() => {
                        if ((settings.autoScrollSpeed || 0) > 0) {
                          onUpdateSettings({ autoScrollSpeed: 0 });
                          setIsAutoScrollPaused(false);
                        } else {
                          onUpdateSettings({ autoScrollSpeed: 3 });
                          setIsAutoScrollPaused(false);
                        }
                        setShowMoreMenu(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                    >
                      <span className="flex items-center space-x-2">
                        {(settings.autoScrollSpeed || 0) > 0 ? (
                          <Pause className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Play className="w-3.5 h-3.5 text-neutral-400" />
                        )}
                        <span>
                          {(settings.autoScrollSpeed || 0) > 0
                            ? `Tắt tự động cuộn (${settings.autoScrollSpeed}x)`
                            : 'Bật tự động cuộn'}
                        </span>
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowSettings(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                  >
                    <span className="flex items-center space-x-2">
                      <SettingsIcon className="w-3.5 h-3.5 text-amber-400" />
                      <span>Giao diện & Phông chữ</span>
                    </span>
                    <kbd className="text-[10px] font-mono text-neutral-500">S</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowTTS((prev) => !prev);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                  >
                    <span className="flex items-center space-x-2">
                      <Volume2 className={`w-3.5 h-3.5 ${showTTS ? 'text-amber-400' : 'text-neutral-400'}`} />
                      <span>{showTTS ? 'Ẩn trình đọc TTS' : 'Đọc thành tiếng (TTS)'}</span>
                    </span>
                    <kbd className="text-[10px] font-mono text-neutral-500">T</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowSearch(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                  >
                    <span className="flex items-center space-x-2">
                      <Search className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Tìm kiếm trong truyện</span>
                    </span>
                    <kbd className="text-[10px] font-mono text-neutral-500">/</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowBookmarks(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                  >
                    <span className="flex items-center space-x-2">
                      <BookmarkIcon className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Dấu trang & Ghi chú</span>
                      {bookmarks.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-600/30 text-amber-300 font-mono">
                          {bookmarks.length}
                        </span>
                      )}
                    </span>
                    <kbd className="text-[10px] font-mono text-neutral-500">Shift+B</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      toggleFullscreen();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                  >
                    <span className="flex items-center space-x-2">
                      {isFullscreen ? (
                        <Minimize2 className="w-3.5 h-3.5 text-neutral-400" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5 text-neutral-400" />
                      )}
                      <span>{isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}</span>
                    </span>
                    <kbd className="text-[10px] font-mono text-neutral-500">F11</kbd>
                  </button>

                  <div className="my-1 border-t border-neutral-800" />

                  {/* Section 3: Editing & Files */}
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    Soạn thảo & Tệp
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowChapterEditor(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                  >
                    <span className="flex items-center space-x-2">
                      <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isViewingTranslation ? 'Chỉnh sửa bản dịch' : 'Chỉnh sửa chương'}</span>
                    </span>
                    <kbd className="text-[10px] font-mono text-neutral-500">E</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      openFindReplaceModal();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                  >
                    <span className="flex items-center space-x-2">
                      <Replace className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{isViewingTranslation ? 'Tìm & Thay thế (Bản dịch)' : 'Tìm & Thay thế'}</span>
                    </span>
                    <kbd className="text-[10px] font-mono text-neutral-500">Ctrl+H</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      if (isViewingTranslation) {
                        showHUDToast('Chuyển về Nguyên văn để xem lịch sử phiên bản gốc');
                        return;
                      }
                      setShowVersions(true);
                    }}
                    disabled={isViewingTranslation}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed text-left transition-colors cursor-pointer"
                  >
                    <span className="flex items-center space-x-2">
                      <History className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Lịch sử phiên bản</span>
                    </span>
                    {isViewingTranslation && (
                      <kbd className="text-[10px] font-mono text-neutral-500">Khóa</kbd>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowChapterManager(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                  >
                    <span className="flex items-center space-x-2">
                      <Scissors className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Quản lý chương</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowExport(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                  >
                    <span className="flex items-center space-x-2">
                      <Download className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Xuất TXT / EPUB</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowShortcutHelp(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-800 text-left transition-colors cursor-pointer"
                  >
                    <span className="flex items-center space-x-2">
                      <Keyboard className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Phím tắt điều hướng</span>
                    </span>
                    <kbd className="text-[10px] font-mono text-neutral-500">?</kbd>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Floating HUD Toast for Keyboard Navigation */}
      {hudToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-200">
          <div className="px-3.5 py-1.5 rounded-full bg-neutral-900/95 text-amber-300 text-xs font-medium border border-amber-500/40 shadow-2xl backdrop-blur-md flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>{hudToast}</span>
          </div>
        </div>
      )}

      {/* Main Reading Canvas */}
      <main
        ref={contentContainerRef}
        onScroll={handleScroll}
        onMouseUp={handleMouseUp}
        onWheel={(e) => {
          if (!isPagedMode || settings.wheelToTurnPage === false) return;
          const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
          if (Math.abs(delta) < 8) return;
          const now = Date.now();
          if (now - lastWheelFlipRef.current < 220) return;
          lastWheelFlipRef.current = now;
          if (delta > 0) handleNextPage();
          else handlePrevPage();
        }}
        onTouchStart={(e) => {
          if (!isPagedMode || e.touches.length !== 1) return;
          touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchEnd={(e) => {
          if (!isPagedMode || !touchStartRef.current || e.changedTouches.length !== 1) return;
          const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
          const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
          touchStartRef.current = null;
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            if (dx < 0) handleNextPage();
            else handlePrevPage();
          }
        }}
        onClick={(e) => {
          if (showMoreMenu) {
            setShowMoreMenu(false);
            return;
          }
          if (window.getSelection()?.toString().trim()) {
            return;
          }
          const target = e.target as HTMLElement;
          if (
            target.closest('button') ||
            target.closest('input') ||
            target.closest('textarea') ||
            target.closest('a') ||
            target.closest('.dict-replaced') ||
            selectionTooltip ||
            editingParagraphIndex !== null
          ) {
            return;
          }

          if (settings.tapToTurnPage !== false) {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5;
            if (relX < 0.22) {
              if (isPagedMode) {
                handlePrevPage();
              } else if (settings.readingMode === 'focus') {
                stepFocusParagraph(-1);
              } else if (contentContainerRef.current) {
                contentContainerRef.current.scrollBy({
                  top: -contentContainerRef.current.clientHeight * 0.65,
                  behavior: settings.smoothScroll === false ? 'auto' : 'smooth',
                });
              }
              return;
            }
            if (relX > 0.78) {
              if (isPagedMode) {
                handleNextPage();
              } else if (settings.readingMode === 'focus') {
                stepFocusParagraph(1);
              } else if (contentContainerRef.current) {
                contentContainerRef.current.scrollBy({
                  top: contentContainerRef.current.clientHeight * 0.65,
                  behavior: settings.smoothScroll === false ? 'auto' : 'smooth',
                });
              }
              return;
            }
          }

          // Zen mode toggle on center tap
          setShowUI((prev) => !prev);
        }}
        className={`flex-1 relative reader-content ${
          isPagedMode
            ? 'overflow-hidden px-4 sm:px-8 py-4 flex flex-col items-center'
            : 'overflow-y-auto px-6 py-8'
        }`}
      >
        {isPagedMode ? (
          /* True Viewport-Fit CSS Multi-Column Pagination (1-Page & 2-Column Book Spread) */
          <div
            className={`w-full flex-1 min-h-0 flex flex-col mx-auto ${
              effectiveTwoColumn ? 'max-w-6xl' : containerWidthClass
            }`}
            style={{
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight,
              textAlign: settings.textAlign,
              fontWeight: settings.fontWeight === 'semibold' ? 600 : settings.fontWeight === 'medium' ? 500 : 400,
            }}
          >
            <div ref={pagedViewportRef} className="relative flex-1 min-h-0 w-full overflow-hidden">
              {effectiveTwoColumn && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-4 left-1/2 -translate-x-1/2 w-px bg-black/15 dark:bg-white/15 z-10"
                />
              )}

              <div
                ref={pagedTrackRef}
                className="transition-transform duration-200 ease-out"
                style={{
                  width: `${pagedBoxSize.width}px`,
                  height: `${Math.max(200, pagedBoxSize.height)}px`,
                  columnCount: effectiveTwoColumn ? 2 : 1,
                  columnGap: `${pagedColumnGap}px`,
                  columnFill: 'auto',
                  transform: `translate3d(-${currentPageIndex * (pagedBoxSize.width + pagedColumnGap)}px, 0, 0)`,
                }}
              >
                {/* Chapter Header inside column flow */}
                <div
                  className="mb-6 pb-4 border-b border-black/10 dark:border-white/10 text-center select-none group relative"
                  style={{ breakInside: 'avoid' }}
                >
                  <span className="text-xs uppercase tracking-widest font-mono opacity-60 block mb-1">
                    {book.title}
                  </span>
                  <div className="flex items-center justify-center space-x-2">
                    <h1 className="text-2xl font-bold tracking-tight">{displayedTitle}</h1>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowChapterEditor(true);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-neutral-400 hover:text-amber-500 transition-all cursor-pointer"
                      title={
                        isViewingTranslation
                          ? 'Chỉnh sửa tiêu đề hoặc nội dung bản dịch (E)'
                          : 'Chỉnh sửa tiêu đề hoặc nội dung chương (E)'
                      }
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>

                  {(currentTranslation || isTranslating || translationError) && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 flex flex-col items-center gap-2 font-sans text-xs"
                    >
                      {currentTranslation && (
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <div className="inline-flex items-center rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 p-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setReadingViewMode('original');
                                setCurrentPageIndex(0);
                                setEditingParagraphIndex(null);
                              }}
                              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                                readingViewMode === 'original'
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'opacity-75 hover:opacity-100'
                              }`}
                            >
                              Nguyên văn
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReadingViewMode('translated');
                                setCurrentPageIndex(0);
                                setEditingParagraphIndex(null);
                              }}
                              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                                readingViewMode === 'translated'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'opacity-75 hover:opacity-100'
                              }`}
                            >
                              Bản dịch
                            </button>
                          </div>

                          {(translationIsStale || dictionaryChangedSinceTranslation) && (
                            <button
                              type="button"
                              onClick={() => handleTranslateBook({ retranslateAll: true })}
                              disabled={isTranslating}
                              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 border border-amber-500 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Dịch lại toàn truyện</span>
                            </button>
                          )}
                        </div>
                      )}
                      {isTranslating && (
                        <div className="flex items-center space-x-2 text-[11px] opacity-85">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>
                            {translationProgress
                              ? `Đang dịch truyện (${translationProgress.completedChapters}/${translationProgress.totalChapters} ch. • Chương ${translationProgress.currentChapterNumber})`
                              : 'Đang dịch truyện...'}
                          </span>
                          <button
                            type="button"
                            onClick={() => translationAbortRef.current?.abort()}
                            className="px-2 py-0.5 rounded bg-red-900/40 border border-red-700/40 text-red-300 hover:bg-red-900/60 cursor-pointer"
                          >
                            Hủy
                          </button>
                        </div>
                      )}
                      {translationError && (
                        <div className="text-[11px] text-red-400">{translationError}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Paragraphs flowing across CSS columns */}
                {visibleParagraphs.map((paraHtml, idx) => {
                  const isTTSSpeakingThis =
                    ttsState.isPlaying &&
                    ttsState.currentSentenceText &&
                    paraHtml.includes(ttsState.currentSentenceText);

                  if (editingParagraphIndex === idx) {
                    return (
                      <div
                        key={idx}
                        style={{ breakInside: 'avoid' }}
                        onClick={(e) => e.stopPropagation()}
                        className="my-3 p-3.5 rounded-xl bg-neutral-900/95 border border-amber-500/60 shadow-2xl text-neutral-100 font-sans text-xs space-y-2.5"
                      >
                        <textarea
                          value={paragraphEditText}
                          onChange={(e) => setParagraphEditText(e.target.value)}
                          className="w-full p-3 bg-neutral-950 border border-neutral-700 rounded-lg text-sm font-serif leading-relaxed text-neutral-100 focus:outline-hidden focus:border-amber-500 resize-y min-h-[100px]"
                          autoFocus
                        />
                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleSaveInlineParagraph(idx)}
                            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Lưu đoạn</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelInlineParagraph}
                            className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <p
                      key={idx}
                      data-para-idx={idx}
                      className={`leading-relaxed transition-colors rounded px-1 -mx-1 group relative ${
                        settings.textIndent ? 'indent-8' : ''
                      } ${isTTSSpeakingThis ? 'tts-speaking-sentence p-1' : ''}`}
                      style={{ marginBottom: `${settings.paragraphSpacing}rem` }}
                      dangerouslySetInnerHTML={{ __html: paraHtml }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Compact Paged Footer */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="pt-3 mt-2 border-t border-black/10 dark:border-white/10 flex items-center justify-between text-xs select-none shrink-0 font-sans"
            >
              <button
                disabled={currentPageIndex === 0 && currentChapterIndex === 0}
                onClick={handlePrevPage}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-black/20 dark:border-white/20 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Trang trước</span>
              </button>

              <div className="flex items-center space-x-2 font-mono opacity-70 text-[11px]">
                <span>
                  Trang {currentPageIndex + 1} / {totalPages}
                </span>
                <span>•</span>
                <span>Chương {currentChapterIndex + 1}</span>
                {effectiveTwoColumn && (
                  <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[10px]">
                    2 trang
                  </span>
                )}
              </div>

              <button
                disabled={currentPageIndex >= totalPages - 1 && currentChapterIndex >= localChapters.length - 1}
                onClick={handleNextPage}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-black/20 dark:border-white/20 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <span>Trang tiếp</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : settings.readingMode === 'continuous' ? (
          /* Endless Continuous Multi-Chapter Stream */
          <div
            className={`mx-auto ${containerWidthClass} transition-all duration-150`}
            style={{
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight,
              textAlign: settings.textAlign,
              fontWeight: settings.fontWeight === 'semibold' ? 600 : settings.fontWeight === 'medium' ? 500 : 400,
            }}
          >
            {continuousRange.start > 0 && (
              <div className="mb-8 flex justify-center font-sans">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLoadPrevContinuousChapter();
                  }}
                  className="px-4 py-2 rounded-xl border border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-medium cursor-pointer transition-colors"
                >
                  ↑ Tải thêm chương trước ({localChapters[continuousRange.start - 1]?.title || `Chương ${continuousRange.start}`})
                </button>
              </div>
            )}

            {Array.from(
              { length: Math.max(0, continuousRange.end - continuousRange.start + 1) },
              (_, offset) => continuousRange.start + offset
            ).map((chIdx, offset) => {
              const ch = localChapters[chIdx];
              if (!ch) return null;
              const isActiveChapter = chIdx === currentChapterIndex;
              const cachedAdjTrans = continuousTranslations[ch.id];
              const chTranslation = isActiveChapter ? currentTranslation : cachedAdjTrans;
              const chHasValidTrans = !!chTranslation && !isTranslationStale(ch, chTranslation);
              const chViewingTrans = readingViewMode === 'translated' && chHasValidTrans;
              const chTitle = chViewingTrans ? chTranslation!.translatedTitle : ch.title;
              const chContent = chViewingTrans ? chTranslation!.translatedContent : ch.content;
              const chParas = chContent.split('\n').filter((p) => p.trim().length > 0);
              const chHighlights = highlights.filter((h) => h.chapterIndex === chIdx);
              const chRenderedParas = chParas.map((para) => {
                const baseHtml = chViewingTrans
                  ? escapeHtml(para)
                  : settings.applyDictionary && dictionaries.length > 0
                  ? applyDictionaryToText(para, dictionaries, settings.highlightReplacements)
                  : escapeHtml(para);
                return applyHighlightsToHtml(baseHtml, chHighlights);
              });

              return (
                <section
                  key={ch.id}
                  data-continuous-ch={chIdx}
                  className={offset > 0 ? 'mt-16 pt-10 border-t-2 border-dashed border-black/15 dark:border-white/15' : ''}
                >
                  <div className="mb-8 pb-4 border-b border-black/10 dark:border-white/10 text-center select-none group relative">
                    <span className="text-xs uppercase tracking-widest font-mono opacity-60 block mb-1">
                      {book.title} • Chương {chIdx + 1}/{localChapters.length}
                    </span>
                    <div className="flex items-center justify-center space-x-2">
                      <h2 className="text-2xl font-bold tracking-tight">{chTitle}</h2>
                      {isActiveChapter && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowChapterEditor(true);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-neutral-400 hover:text-amber-500 transition-all cursor-pointer"
                          title={
                            isViewingTranslation
                              ? 'Chỉnh sửa tiêu đề hoặc nội dung bản dịch (E)'
                              : 'Chỉnh sửa tiêu đề hoặc nội dung chương (E)'
                          }
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {isActiveChapter && (currentTranslation || isTranslating || translationError) && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="mt-4 flex flex-col items-center gap-2 font-sans text-xs"
                      >
                        {currentTranslation && (
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <div className="inline-flex items-center rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 p-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setReadingViewMode('original');
                                  setEditingParagraphIndex(null);
                                }}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                                  readingViewMode === 'original'
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'opacity-75 hover:opacity-100'
                                }`}
                              >
                                Nguyên văn
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReadingViewMode('translated');
                                  setEditingParagraphIndex(null);
                                }}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                                  readingViewMode === 'translated'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'opacity-75 hover:opacity-100'
                                }`}
                              >
                                Bản dịch
                              </button>
                            </div>

                            {(translationIsStale || dictionaryChangedSinceTranslation) && (
                              <button
                                type="button"
                                onClick={() => handleTranslateBook({ retranslateAll: true })}
                                disabled={isTranslating}
                                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 border border-amber-500 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                                title="Dịch lại toàn bộ truyện từ nguyên văn"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Dịch lại toàn truyện</span>
                              </button>
                            )}
                          </div>
                        )}

                        {isTranslating && (
                          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] opacity-90">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>
                              {translationProgress
                                ? `Đang dịch truyện (${translationProgress.completedChapters}/${translationProgress.totalChapters} chương • Chương ${translationProgress.currentChapterNumber})`
                                : 'Đang dịch truyện...'}
                            </span>
                            <button
                              type="button"
                              onClick={() => translationAbortRef.current?.abort()}
                              className="px-2 py-0.5 rounded bg-red-900/40 border border-red-700/40 text-red-300 hover:bg-red-900/60 cursor-pointer"
                            >
                              Hủy
                            </button>
                          </div>
                        )}

                        {translationError && (
                          <div className="max-w-lg w-full px-3 py-2 rounded-lg bg-red-950/70 border border-red-700/50 text-red-200 text-[11px] flex items-center justify-between gap-3 text-left">
                            <div className="flex items-start space-x-2 min-w-0">
                              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                              <span className="break-words">{translationError}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleTranslateBook({ retranslateAll: false })}
                              className="px-2.5 py-1 rounded bg-red-800/70 hover:bg-red-700 text-white font-semibold shrink-0 cursor-pointer"
                            >
                              Thử lại
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {chRenderedParas.map((paraHtml, idx) => {
                      const isTTSSpeakingThis =
                        isActiveChapter &&
                        ttsState.isPlaying &&
                        ttsState.currentSentenceText &&
                        paraHtml.includes(ttsState.currentSentenceText);

                      if (isActiveChapter && editingParagraphIndex === idx) {
                        return (
                          <div
                            key={idx}
                            onClick={(e) => e.stopPropagation()}
                            className="my-3 p-3.5 rounded-xl bg-neutral-900/95 border border-amber-500/60 shadow-2xl text-neutral-100 font-sans text-xs space-y-2.5"
                          >
                            <textarea
                              value={paragraphEditText}
                              onChange={(e) => setParagraphEditText(e.target.value)}
                              className="w-full p-3 bg-neutral-950 border border-neutral-700 rounded-lg text-sm font-serif leading-relaxed text-neutral-100 focus:outline-hidden focus:border-amber-500 resize-y min-h-[100px]"
                              autoFocus
                            />
                            <div className="flex items-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => handleSaveInlineParagraph(idx)}
                                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold cursor-pointer"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>Lưu đoạn</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelInlineParagraph}
                                className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <p
                          key={idx}
                          data-para-idx={isActiveChapter ? idx : undefined}
                          className={`leading-relaxed transition-colors rounded px-1 -mx-1 group relative ${
                            settings.textIndent ? 'indent-8' : ''
                          } ${isTTSSpeakingThis ? 'tts-speaking-sentence p-1' : ''}`}
                          style={{ marginBottom: `${settings.paragraphSpacing}rem` }}
                          dangerouslySetInnerHTML={{ __html: paraHtml }}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}

            <div className="mt-14 pt-6 border-t border-black/10 dark:border-white/10 text-center font-sans text-xs select-none">
              {continuousRange.end < localChapters.length - 1 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setContinuousRange((prev) => ({
                      ...prev,
                      end: Math.min(localChapters.length - 1, prev.end + 1),
                    }));
                  }}
                  className="px-4 py-2 rounded-xl border border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/5 opacity-80 hover:opacity-100 cursor-pointer transition-all"
                >
                  ↓ Cuộn xuống hoặc bấm để nạp tiếp {localChapters[continuousRange.end + 1]?.title || 'chương sau'}
                </button>
              ) : (
                <span className="opacity-50 font-mono">— Đã đến chương cuối cùng của truyện —</span>
              )}
            </div>
          </div>
        ) : (
          /* Single Chapter Vertical Flow: 'scroll' & 'focus' */
          <div
            className={`mx-auto ${containerWidthClass} transition-all duration-150`}
            style={{
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight,
              textAlign: settings.textAlign,
              fontWeight: settings.fontWeight === 'semibold' ? 600 : settings.fontWeight === 'medium' ? 500 : 400,
            }}
          >
            {/* Chapter Header Title */}
            <div className="mb-8 pb-4 border-b border-black/10 dark:border-white/10 text-center select-none group relative">
              <span className="text-xs uppercase tracking-widest font-mono opacity-60 block mb-1">
                {book.title}
              </span>
              <div className="flex items-center justify-center space-x-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {displayedTitle}
                </h1>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowChapterEditor(true);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-neutral-400 hover:text-amber-500 transition-all cursor-pointer"
                  title={
                    isViewingTranslation
                      ? 'Chỉnh sửa tiêu đề hoặc nội dung bản dịch (E)'
                      : 'Chỉnh sửa tiêu đề hoặc nội dung chương (E)'
                  }
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              {settings.readingMode === 'focus' && paragraphs.length > 0 && (
                <div className="mt-2 text-[11px] font-sans opacity-60">
                  Chế độ Tập trung • Đoạn {Math.min(focusedParaIndex + 1, paragraphs.length)} / {paragraphs.length} (Nhấn vào đoạn hoặc phím J / K)
                </div>
              )}

              {/* Compact Translation Status / Switcher (only shown when active, translated, or errored) */}
              {(currentTranslation || isTranslating || translationError) && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="mt-4 flex flex-col items-center gap-2 font-sans text-xs"
                >
                  {currentTranslation && (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <div className="inline-flex items-center rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 p-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setReadingViewMode('original');
                            setCurrentPageIndex(0);
                            setEditingParagraphIndex(null);
                          }}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                            readingViewMode === 'original'
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'opacity-75 hover:opacity-100'
                          }`}
                        >
                          Nguyên văn
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReadingViewMode('translated');
                            setCurrentPageIndex(0);
                            setEditingParagraphIndex(null);
                          }}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                            readingViewMode === 'translated'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'opacity-75 hover:opacity-100'
                          }`}
                        >
                          Bản dịch
                        </button>
                      </div>

                      {(translationIsStale || dictionaryChangedSinceTranslation) && (
                        <button
                          type="button"
                          onClick={() => handleTranslateBook({ retranslateAll: true })}
                          disabled={isTranslating}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 border border-amber-500 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                          title="Dịch lại toàn bộ truyện từ nguyên văn"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Dịch lại toàn truyện</span>
                        </button>
                      )}
                    </div>
                  )}

                  {isTranslating && (
                    <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] opacity-90">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>
                        {translationProgress
                          ? `Đang dịch truyện (${translationProgress.completedChapters}/${translationProgress.totalChapters} chương • Chương ${translationProgress.currentChapterNumber})`
                          : 'Đang dịch truyện...'}
                      </span>
                      <button
                        type="button"
                        onClick={() => translationAbortRef.current?.abort()}
                        className="px-2 py-0.5 rounded bg-red-900/40 border border-red-700/40 text-red-300 hover:bg-red-900/60 cursor-pointer"
                      >
                        Hủy
                      </button>
                    </div>
                  )}

                  {isViewingTranslation && !isTranslating && (
                    <div className="inline-flex items-center space-x-1 text-[11px] opacity-70">
                      <span>Bôi đen cụm từ để chỉnh Name (Trung / Việt / Hán Việt / Eng) hoặc bấm Sửa</span>
                    </div>
                  )}

                  {translationIsStale && !isTranslating && (
                    <div className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 text-[11px] flex items-center space-x-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Nguyên văn đã thay đổi — bấm Dịch lại toàn truyện để cập nhật bản dịch.</span>
                    </div>
                  )}

                  {!translationIsStale && dictionaryChangedSinceTranslation && !isTranslating && (
                    <div className="text-[11px] text-amber-400/90">
                      Từ điển đã cập nhật — bấm Dịch lại toàn truyện để áp dụng thuật ngữ mới.
                    </div>
                  )}

                  {translationError && (
                    <div className="max-w-lg w-full px-3 py-2 rounded-lg bg-red-950/70 border border-red-700/50 text-red-200 text-[11px] flex items-center justify-between gap-3 text-left">
                      <div className="flex items-start space-x-2 min-w-0">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <span className="break-words">{translationError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTranslateBook({ retranslateAll: false })}
                        className="px-2.5 py-1 rounded bg-red-800/70 hover:bg-red-700 text-white font-semibold shrink-0 cursor-pointer"
                      >
                        Thử lại
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reading Paragraphs */}
            <div className="space-y-4">
              {visibleParagraphs.map((paraHtml, idx) => {
                const actualParaIdx = idx;
                const isFocusMode = settings.readingMode === 'focus';
                const isFocusedPara = isFocusMode && focusedParaIndex === actualParaIdx;

                // Highlight sentence if TTS is actively speaking it
                const isTTSSpeakingThis =
                  ttsState.isPlaying &&
                  ttsState.currentSentenceText &&
                  paraHtml.includes(ttsState.currentSentenceText);

                // If currently inline editing this paragraph
                if (editingParagraphIndex === actualParaIdx) {
                  return (
                    <div
                      key={actualParaIdx}
                      onClick={(e) => e.stopPropagation()}
                      className="my-3 p-3.5 rounded-xl bg-neutral-900/95 border border-amber-500/60 shadow-2xl text-neutral-100 font-sans text-xs space-y-2.5 animate-in fade-in"
                    >
                      <textarea
                        value={paragraphEditText}
                        onChange={(e) => setParagraphEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveInlineParagraph(actualParaIdx);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            handleCancelInlineParagraph();
                          }
                        }}
                        className="w-full p-3 bg-neutral-950 border border-neutral-700 rounded-lg text-sm font-serif leading-relaxed text-neutral-100 focus:outline-hidden focus:border-amber-500 resize-y min-h-[100px]"
                        autoFocus
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleSaveInlineParagraph(actualParaIdx)}
                            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold cursor-pointer shadow-xs"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Lưu đoạn</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelInlineParagraph}
                            className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
                          >
                            Hủy
                          </button>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={handleSplitParagraph}
                            className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] cursor-pointer"
                            title="Tách đoạn (xuống dòng)"
                          >
                            Tách đoạn
                          </button>
                          {actualParaIdx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleMergeWithPrevParagraph(actualParaIdx)}
                              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] cursor-pointer"
                              title="Gộp với đoạn trước"
                            >
                              Gộp đoạn trước
                            </button>
                          )}
                          {actualParaIdx < paragraphs.length - 1 && (
                            <button
                              type="button"
                              onClick={() => handleMergeWithNextParagraph(actualParaIdx)}
                              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] cursor-pointer"
                              title="Gộp với đoạn sau"
                            >
                              Gộp đoạn sau
                            </button>
                          )}
                          {confirmDeleteParaIdx === actualParaIdx ? (
                            <div className="flex items-center space-x-1 bg-red-950/80 border border-red-700/60 rounded px-1.5 py-0.5">
                              <span className="text-[10px] text-red-200">Xóa?</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteParagraph(actualParaIdx)}
                                className="px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-[10px] font-semibold cursor-pointer"
                              >
                                Xác nhận
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteParaIdx(null)}
                                className="px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] cursor-pointer"
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteParaIdx(actualParaIdx)}
                              className="px-2 py-1 rounded bg-red-950/60 border border-red-800/40 hover:bg-red-900/60 text-red-300 text-[11px] cursor-pointer"
                              title="Xóa đoạn này"
                            >
                              Xóa đoạn
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <p
                    key={actualParaIdx}
                    data-para-idx={actualParaIdx}
                    onClick={
                      isFocusMode && !isFocusedPara
                        ? (e) => {
                            if (window.getSelection()?.toString().trim()) return;
                            e.stopPropagation();
                            setFocusedParaIndex(actualParaIdx);
                          }
                        : undefined
                    }
                    className={`leading-relaxed transition-all duration-200 rounded px-1 -mx-1 group relative ${
                      settings.textIndent ? 'indent-8' : ''
                    } ${isTTSSpeakingThis ? 'tts-speaking-sentence p-1' : ''} ${
                      isFocusMode
                        ? isFocusedPara
                          ? 'opacity-100 border-l-2 border-amber-500/80 pl-4 -ml-4'
                          : 'opacity-30 hover:opacity-75 cursor-pointer'
                        : ''
                    }`}
                    style={{ marginBottom: `${settings.paragraphSpacing}rem` }}
                    dangerouslySetInnerHTML={{ __html: paraHtml }}
                  />
                );
              })}
            </div>

            {/* End of Chapter Navigation in Scroll & Focus mode */}
            <div className="mt-16 pt-8 border-t border-black/10 dark:border-white/10 flex items-center justify-between select-none">
              <button
                disabled={currentChapterIndex === 0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleGoToChapter(currentChapterIndex - 1);
                }}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl border border-black/20 dark:border-white/20 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-xs font-medium"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Chương trước</span>
              </button>

              <span className="text-xs opacity-60 font-mono">
                {currentChapterIndex + 1} / {localChapters.length}
              </span>

              <button
                disabled={currentChapterIndex >= localChapters.length - 1}
                onClick={(e) => {
                  e.stopPropagation();
                  handleGoToChapter(currentChapterIndex + 1);
                }}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl border border-black/20 dark:border-white/20 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-xs font-medium"
              >
                <span>Chương tiếp theo</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Floating Auto-Scroll Mini Controller */}
      {(settings.autoScrollSpeed || 0) > 0 && !isPagedMode && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`fixed right-5 z-40 flex items-center space-x-1.5 px-2.5 py-1.5 rounded-full bg-neutral-900/95 border border-neutral-700/80 text-neutral-100 shadow-2xl backdrop-blur-md text-xs select-none transition-all ${
            showUI ? 'bottom-16' : 'bottom-5'
          }`}
        >
          <button
            type="button"
            onClick={() => setIsAutoScrollPaused((p) => !p)}
            className="p-1.5 rounded-full bg-amber-600 hover:bg-amber-500 text-white transition-colors cursor-pointer"
            title={isAutoScrollPaused ? 'Tiếp tục cuộn' : 'Tạm dừng cuộn'}
          >
            {isAutoScrollPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() =>
              onUpdateSettings({
                autoScrollSpeed: Math.max(1, (settings.autoScrollSpeed || 1) - 1),
              })
            }
            disabled={(settings.autoScrollSpeed || 1) <= 1}
            className="p-1 rounded-full hover:bg-neutral-800 disabled:opacity-30 cursor-pointer"
            title="Giảm tốc độ cuộn"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <span className="px-1.5 font-mono font-semibold text-amber-300 min-w-[28px] text-center">
            {settings.autoScrollSpeed}x
          </span>

          <button
            type="button"
            onClick={() =>
              onUpdateSettings({
                autoScrollSpeed: Math.min(10, (settings.autoScrollSpeed || 1) + 1),
              })
            }
            disabled={(settings.autoScrollSpeed || 1) >= 10}
            className="p-1 rounded-full hover:bg-neutral-800 disabled:opacity-30 cursor-pointer"
            title="Tăng tốc độ cuộn"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-neutral-700 mx-0.5" />

          <button
            type="button"
            onClick={() => {
              onUpdateSettings({ autoScrollSpeed: 0 });
              setIsAutoScrollPaused(false);
            }}
            className="p-1 rounded-full hover:bg-red-900/60 text-neutral-400 hover:text-red-300 transition-colors cursor-pointer"
            title="Tắt tự động cuộn"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Floating Quick Name & Manual Translation Editor Popup */}
      {selectionTooltip?.mode === 'quick-name' && (
        <QuickNameEditModal
          position={selectionTooltip}
          selectedText={selectionTooltip.text}
          paragraphIndex={selectionTooltip.paragraphIndex ?? 0}
          displayedParagraph={
            selectionTooltip.paragraphIndex !== undefined
              ? paragraphs[selectionTooltip.paragraphIndex] || selectionTooltip.text
              : selectionTooltip.text
          }
          sourceParagraph={(() => {
            const srcRaw = (currentTranslation?.sourceContent || currentChapter.content || '')
              .split('\n')
              .filter((p) => p.trim().length > 0);
            if (selectionTooltip.paragraphIndex === undefined) {
              return currentChapter.content;
            }
            const dispPara = paragraphs[selectionTooltip.paragraphIndex] || selectionTooltip.text;
            return (
              findBestMatchingSourceParagraph({
                viParagraph: dispPara,
                paragraphIndex: selectionTooltip.paragraphIndex,
                totalViParagraphs: paragraphs.length,
                sourceParagraphs: srcRaw,
              }) || currentChapter.content
            );
          })()}
          selectionStartInPara={selectionTooltip.startInPara ?? 0}
          selectionEndInPara={
            selectionTooltip.endInPara ?? selectionTooltip.text.length
          }
          isViewingTranslation={isViewingTranslation}
          dictionaries={dictionaries}
          onUpdateSelection={(next) => {
            setSelectionTooltip((prev) =>
              prev
                ? {
                    ...prev,
                    text: next.text,
                    startInPara: next.startInPara,
                    endInPara: next.endInPara,
                  }
                : null
            );
          }}
          onApplyValue={applyNameReplacement}
          onSaveDictionary={handleQuickSaveDictionary}
          onOpenDictionaryManager={() => {
            setSelectedTextForDict(selectionTooltip.text);
            setShowDictionary(true);
            setSelectionTooltip(null);
          }}
          onOpenInlineParagraphEdit={() => {
            if (selectionTooltip.paragraphIndex !== undefined) {
              handleStartInlineEdit(selectionTooltip.paragraphIndex);
            } else {
              setShowChapterEditor(true);
            }
            setSelectionTooltip(null);
            window.getSelection()?.removeAllRanges();
          }}
          onSearchInBook={(q) => {
            setSearchInitialQuery(q);
            setShowSearch(true);
            setSelectionTooltip(null);
          }}
          onSpeakPhrase={(phrase) => {
            if ('speechSynthesis' in window) {
              window.speechSynthesis.cancel();
              const utt = new SpeechSynthesisUtterance(phrase);
              utt.rate = settings.ttsRate || 1;
              utt.pitch = settings.ttsPitch || 1;
              window.speechSynthesis.speak(utt);
            }
          }}
          onHighlight={async (color, text) => {
            const newHighlight: Highlight = {
              id: `hl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              bookId: book.id,
              chapterIndex: currentChapterIndex,
              text,
              color,
              createdAt: Date.now(),
            };
            await saveHighlight(newHighlight);
            const updated = await getHighlights(book.id);
            setHighlights(updated);
            showHUDToast('Đã tô sáng đoạn văn');
            setSelectionTooltip(null);
          }}
          onAddNote={(text) => {
            setPendingNoteModal({ text, note: '' });
            setSelectionTooltip(null);
          }}
          onClose={() => setSelectionTooltip(null)}
        />
      )}

      {/* Floating Text Selection Mini Action Menu */}
      {selectionTooltip?.mode === 'menu' && (
        <SelectionActionMenu
          position={selectionTooltip}
          selectedText={selectionTooltip.text}
          disableEditActions={false}
          onOpenQuickName={() =>
            setSelectionTooltip((prev) => (prev ? { ...prev, mode: 'quick-name' } : null))
          }
          onEdit={() => {
            if (selectionTooltip.paragraphIndex !== undefined) {
              handleStartInlineEdit(selectionTooltip.paragraphIndex);
            } else {
              setShowChapterEditor(true);
            }
            setSelectionTooltip(null);
            window.getSelection()?.removeAllRanges();
          }}
          onCopy={() => {
            navigator.clipboard.writeText(selectionTooltip.text).catch(() => {});
            showHUDToast('Đã sao chép vào bộ nhớ tạm');
          }}
          onHighlight={handleHighlightSelection}
          onAddNote={() => {
            setPendingNoteModal({ text: selectionTooltip.text, note: '' });
            setSelectionTooltip(null);
          }}
          onAddToDictionary={() => {
            setSelectedTextForDict(selectionTooltip.text);
            setShowDictionary(true);
            setSelectionTooltip(null);
          }}
          onSearch={() => {
            setSearchInitialQuery(selectionTooltip.text);
            setShowSearch(true);
            setSelectionTooltip(null);
          }}
          onReplace={() => {
            setFindReplaceInitialText(selectionTooltip.text);
            openFindReplaceModal();
            setSelectionTooltip(null);
          }}
          onBookmark={() => {
            handleAddBookmark(undefined, selectionTooltip.text);
            showHUDToast('Đã đánh dấu đoạn văn');
            setSelectionTooltip(null);
          }}
          onClose={() => setSelectionTooltip(null)}
        />
      )}

      {/* In-App Add Note Dialog (iframe & desktop safe) */}
      {pendingNoteModal && (
        <div
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPendingNoteModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-xs text-neutral-200 select-none"
          >
            <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-950 flex items-center justify-between">
              <div className="flex items-center space-x-2 font-semibold text-neutral-100">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Thêm ghi chú cho đoạn văn</span>
              </div>
              <button
                type="button"
                onClick={() => setPendingNoteModal(null)}
                className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <blockquote className="p-2.5 rounded-lg bg-neutral-950 border-l-2 border-amber-500/60 text-neutral-300 italic font-serif line-clamp-3">
                "{pendingNoteModal.text}"
              </blockquote>
              <textarea
                rows={3}
                value={pendingNoteModal.note}
                onChange={(e) =>
                  setPendingNoteModal((prev) => (prev ? { ...prev, note: e.target.value } : null))
                }
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && pendingNoteModal.note.trim()) {
                    e.preventDefault();
                    handleAddBookmark(pendingNoteModal.note.trim(), pendingNoteModal.text);
                    setPendingNoteModal(null);
                    showHUDToast('Đã thêm ghi chú');
                  }
                }}
                placeholder="Nhập ghi chú..."
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
                autoFocus
              />
            </div>
            <div className="px-4 py-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setPendingNoteModal(null)}
                className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!pendingNoteModal.note.trim()}
                onClick={() => {
                  if (!pendingNoteModal.note.trim()) return;
                  handleAddBookmark(pendingNoteModal.note.trim(), pendingNoteModal.text);
                  setPendingNoteModal(null);
                  showHUDToast('Đã thêm ghi chú');
                }}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-semibold cursor-pointer"
              >
                Lưu ghi chú
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Floating Navigation HUD */}
      {showUI && (
        <footer
          className="h-12 border-t border-neutral-800/40 px-5 flex items-center justify-between shrink-0 select-none backdrop-blur-md z-30 transition-all duration-200"
          style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
        >
          <button
            disabled={currentChapterIndex === 0}
            onClick={() => handleGoToChapter(currentChapterIndex - 1)}
            className="flex items-center space-x-1 text-xs font-medium disabled:opacity-30 hover:text-amber-400 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Chương trước</span>
          </button>

          {/* Chapter slider & stats */}
          <div className="flex-1 max-w-md mx-6 flex items-center space-x-3">
            <span className="text-[11px] font-mono opacity-60 shrink-0">
              {currentChapterIndex + 1}/{localChapters.length}
            </span>
            <input
              type="range"
              min={0}
              max={Math.max(0, localChapters.length - 1)}
              value={currentChapterIndex}
              onChange={(e) => handleGoToChapter(Number(e.target.value))}
              className="flex-1 accent-amber-500 cursor-pointer h-1.5"
            />
            <span className="text-[11px] font-mono font-bold text-amber-500 shrink-0">
              {currentOverallPercent}%
            </span>
          </div>

          <button
            disabled={currentChapterIndex >= localChapters.length - 1}
            onClick={() => handleGoToChapter(currentChapterIndex + 1)}
            className="flex items-center space-x-1 text-xs font-medium disabled:opacity-30 hover:text-amber-400 transition-colors cursor-pointer"
          >
            <span>Chương sau</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </footer>
      )}

      {/* Floating Offline TTS Control Bar */}
      <ReaderTTSBar
        isOpen={showTTS}
        onClose={() => setShowTTS(false)}
        chapterTitle={displayedTitle}
      />

      {/* Drawers */}
      <ReaderTOC
        isOpen={showTOC}
        onClose={() => setShowTOC(false)}
        chapters={localChapters}
        currentChapterIndex={currentChapterIndex}
        onSelectChapter={handleGoToChapter}
        onOpenChapterManager={() => setShowChapterManager(true)}
      />

      <ReaderSettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
        onOpenThemeManager={() => setShowThemeManager(true)}
      />

      <ReaderSearch
        isOpen={showSearch}
        onClose={() => {
          setShowSearch(false);
          setSearchInitialQuery('');
        }}
        chapters={
          isViewingTranslation && currentTranslation
            ? localChapters.map((ch) =>
                ch.id === currentChapter.id
                  ? {
                      ...ch,
                      title: currentTranslation.translatedTitle,
                      content: currentTranslation.translatedContent,
                    }
                  : ch
              )
            : localChapters
        }
        currentChapterIndex={currentChapterIndex}
        initialQuery={searchInitialQuery}
        onJumpToResult={(chIdx, snippet) => {
          if (chIdx !== currentChapterIndex) {
            pendingSearchJumpRef.current = { chapterIndex: chIdx, snippet };
            handleGoToChapter(chIdx);
          } else {
            jumpToSnippetInCurrentView(snippet);
          }
        }}
      />

      <ReaderBookmarks
        isOpen={showBookmarks}
        onClose={() => setShowBookmarks(false)}
        bookmarks={bookmarks}
        highlights={highlights}
        onSelectBookmark={(bm) => {
          if (bm.chapterIndex !== currentChapterIndex) {
            pendingSearchJumpRef.current = { chapterIndex: bm.chapterIndex, snippet: bm.textSnippet };
            handleGoToChapter(bm.chapterIndex);
          } else {
            jumpToSnippetInCurrentView(bm.textSnippet);
          }
        }}
        onDeleteBookmark={async (bmId) => {
          await deleteBookmark(bmId);
          const updated = bookmarks.filter((b) => b.id !== bmId);
          setBookmarks(updated);
          showHUDToast('Đã xóa dấu trang');
        }}
        onSelectHighlight={(hl) => {
          if (hl.chapterIndex !== currentChapterIndex) {
            pendingSearchJumpRef.current = { chapterIndex: hl.chapterIndex, snippet: hl.text };
            handleGoToChapter(hl.chapterIndex);
          } else {
            jumpToSnippetInCurrentView(hl.text);
          }
        }}
        onDeleteHighlight={async (hlId) => {
          await deleteHighlight(hlId);
          const updated = highlights.filter((h) => h.id !== hlId);
          setHighlights(updated);
          showHUDToast('Đã xóa tô sáng');
        }}
        onAddBookmarkCurrent={() => handleAddBookmark()}
      />

      <ReaderDictionary
        isOpen={showDictionary}
        onClose={() => {
          setShowDictionary(false);
          setSelectedTextForDict('');
        }}
        bookId={book.id}
        bookEntries={bookDictionaries}
        globalEntries={globalDictionaries}
        onEntriesUpdated={({ bookEntries, globalEntries }) => {
          setBookDictionaries(bookEntries);
          setGlobalDictionaries(globalEntries);
        }}
        initialOriginalWord={selectedTextForDict}
      />

      {/* Theme Manager Modal */}
      <ThemeManagerModal
        isOpen={showThemeManager}
        onClose={() => setShowThemeManager(false)}
        settings={settings}
        onSaveTheme={handleSaveTheme}
        onDeleteTheme={handleDeleteTheme}
        onApplyTheme={handleApplyCustomTheme}
      />

      {/* Chapter Manager Modal */}
      <ChapterManagerModal
        isOpen={showChapterManager}
        onClose={() => setShowChapterManager(false)}
        book={book}
        chapters={localChapters}
        onChaptersUpdated={(updatedChapters, updatedBook) => {
          setLocalChapters(updatedChapters);
          if (onChaptersUpdated) {
            onChaptersUpdated(updatedChapters, updatedBook);
          }
        }}
      />

      {/* Global Shortcut Help Modal */}
      <ShortcutHelpModal
        isOpen={showShortcutHelp}
        onClose={() => setShowShortcutHelp(false)}
      />

      {/* Chapter Direct Editor Modal (supports both Original and Translated views) */}
      <ChapterEditorModal
        isOpen={showChapterEditor}
        onClose={() => setShowChapterEditor(false)}
        chapter={currentChapter}
        isTranslationMode={isViewingTranslation}
        titleOverride={isViewingTranslation ? currentTranslation?.translatedTitle : undefined}
        contentOverride={isViewingTranslation ? currentTranslation?.translatedContent : undefined}
        onSaveChapter={async (chId, updatedTitle, updatedContent, summary) => {
          if (isViewingTranslation && currentTranslation) {
            await handleSaveTranslatedChapterContent(chId, updatedTitle, updatedContent);
          } else {
            await handleSaveChapterContent(chId, updatedTitle, updatedContent, summary);
          }
        }}
        onOpenVersions={() => {
          setShowChapterEditor(false);
          setShowVersions(true);
        }}
        onRestoreOriginal={handleRestoreOriginalChapter}
      />

      {/* Advanced Find & Replace Modal (supports both Original and Translated views) */}
      <ReaderFindReplaceModal
        isOpen={showFindReplace}
        onClose={() => {
          setShowFindReplace(false);
          setFindReplaceInitialText('');
          setTranslatedChaptersForReplace(null);
        }}
        currentChapter={
          isViewingTranslation && currentTranslation
            ? {
                ...currentChapter,
                title: currentTranslation.translatedTitle,
                content: currentTranslation.translatedContent,
              }
            : currentChapter
        }
        chapters={
          isViewingTranslation
            ? translatedChaptersForReplace ||
              (currentTranslation
                ? [
                    {
                      ...currentChapter,
                      title: currentTranslation.translatedTitle,
                      content: currentTranslation.translatedContent,
                    },
                  ]
                : [])
            : localChapters
        }
        isTranslationMode={isViewingTranslation}
        initialSearchText={findReplaceInitialText}
        onUpdateChapterContent={async (chId, content, summary) => {
          if (isViewingTranslation) {
            const targetTitle =
              (chId === currentChapter.id ? currentTranslation?.translatedTitle : undefined) ||
              translatedChaptersForReplace?.find((c) => c.id === chId)?.title ||
              currentChapter.title;
            await handleSaveTranslatedChapterContent(chId, targetTitle, content);
          } else {
            const chTitle = localChapters.find((c) => c.id === chId)?.title || currentChapter.title;
            await handleSaveChapterContent(chId, chTitle, content, summary);
          }
        }}
        onBatchUpdateChapters={async (updatedChapters, summary) => {
          if (isViewingTranslation) {
            await handleBatchUpdateTranslatedChapters(updatedChapters);
          } else {
            await handleBatchUpdateChapters(updatedChapters, summary);
          }
        }}
      />

      {/* Chapter Version History & Diff Modal */}
      <ChapterVersionModal
        isOpen={showVersions}
        onClose={() => setShowVersions(false)}
        chapter={currentChapter}
        onRestoreVersion={(restoredContent, restoredTitle, summary) => {
          handleSaveChapterContent(
            currentChapter.id,
            restoredTitle || currentChapter.title,
            restoredContent,
            summary || 'Khôi phục từ bản lưu'
          );
        }}
        onRestoreOriginal={handleRestoreOriginalChapter}
      />

      {/* Export Novel Modal */}
      <ExportModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        book={book}
        chapters={localChapters}
      />
    </div>
  );
};
