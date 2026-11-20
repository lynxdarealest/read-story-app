import React from 'react';
import {
  X,
  Upload,
  FileText,
  Check,
  AlertCircle,
  Scissors,
  Plus,
  Trash2,
  Merge,
  Split,
  Eye,
  Edit2,
  RefreshCw,
  Globe,
  Link2,
  Tag,
  Download,
  Loader2,
  BookOpen,
} from 'lucide-react';
import { Book, Chapter, BookFormat, WebNovelInspectResult } from '../types';
import {
  DEFAULT_CHAPTER_RULES,
  readFileAsText,
  splitTextByRule,
  testRegexPattern,
  parseEpubFile,
  parseHtmlOrMdFile,
  countWords,
  RegexTestResult,
} from '../services/parser';
import { saveBook, saveChapters, getSiteCookieJar, extractBaseDomain } from '../services/storage';
import {
  inspectWebNovelUrl,
  downloadSelectedWebChapters,
  buildChaptersBackupText,
  saveManualDomainCookie,
  BatchDownloadProgress,
} from '../services/webScraper';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBookImported: (book: Book) => void;
  initialWebUrl?: string;
  onOpenBrowser?: (currentUrl?: string) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onBookImported,
  initialWebUrl,
  onOpenBrowser,
}) => {
  const [importSource, setImportSource] = React.useState<'file' | 'web'>('file');
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Web Novel URL state
  const [webUrlInput, setWebUrlInput] = React.useState('');
  const [webCookie, setWebCookie] = React.useState('');
  const [savedCookieInfo, setSavedCookieInfo] = React.useState<{ domain: string; count: number } | null>(null);
  const [showAdvancedWeb, setShowAdvancedWeb] = React.useState(false);
  const [isInspectingWeb, setIsInspectingWeb] = React.useState(false);
  const [webInspectResult, setWebInspectResult] = React.useState<WebNovelInspectResult | null>(null);
  const [selectedWebChapterIndices, setSelectedWebChapterIndices] = React.useState<Set<number>>(new Set());
  const [webDownloadProgress, setWebDownloadProgress] = React.useState<BatchDownloadProgress | null>(null);
  const abortWebDownloadRef = React.useRef(false);

  // Metadata
  const [bookTitle, setBookTitle] = React.useState('');
  const [bookAuthor, setBookAuthor] = React.useState('');
  const [bookDescription, setBookDescription] = React.useState('');
  const [bookTagsInput, setBookTagsInput] = React.useState('');
  const [bookFormat, setBookFormat] = React.useState<BookFormat>('TXT');
  const [coverUrl, setCoverUrl] = React.useState<string>('');
  const [sourceUrl, setSourceUrl] = React.useState<string>('');

  // TXT-specific state
  const [rawTextContent, setRawTextContent] = React.useState<string>('');
  const [selectedEncoding, setSelectedEncoding] = React.useState('auto');
  const [selectedRuleId, setSelectedRuleId] = React.useState(DEFAULT_CHAPTER_RULES[0].id);
  const [customRegexPattern, setCustomRegexPattern] = React.useState(DEFAULT_CHAPTER_RULES[0].pattern);
  const [customRegexFlags, setCustomRegexFlags] = React.useState('gi');
  const [regexTestResult, setRegexTestResult] = React.useState<RegexTestResult | null>(null);

  // Chapters list
  const [draftChapters, setDraftChapters] = React.useState<
    Array<{ title: string; wordCount: number; content: string }>
  >([]);

  // Editing single chapter
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [editContent, setEditContent] = React.useState('');

  // Add chapter
  const [isAddingChapter, setIsAddingChapter] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState('');
  const [newContent, setNewContent] = React.useState('');

  // Split single chapter
  const [splittingIndex, setSplittingIndex] = React.useState<number | null>(null);
  const [splitKeyword, setSplitKeyword] = React.useState('');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setRawTextContent('');
      setDraftChapters([]);
      setErrorMessage(null);
      setEditingIndex(null);
      setIsAddingChapter(false);
      setSplittingIndex(null);
      setCoverUrl('');
      setBookTitle('');
      setBookAuthor('');
      setBookDescription('');
      setBookTagsInput('');
      setSourceUrl('');
      setWebInspectResult(null);
      setWebDownloadProgress(null);
      setIsInspectingWeb(false);
      abortWebDownloadRef.current = false;
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen || importSource !== 'web') {
      setSavedCookieInfo(null);
      return;
    }
    const trimmed = webUrlInput.trim();
    if (!trimmed) {
      setSavedCookieInfo(null);
      return;
    }
    let cancelled = false;
    const base = extractBaseDomain(trimmed);
    if (!base || !base.includes('.')) {
      setSavedCookieInfo(null);
      return;
    }
    getSiteCookieJar(trimmed).then((jar) => {
      if (cancelled) return;
      const now = Date.now();
      const activeCount = jar ? jar.cookies.filter((c) => !c.expiresAt || c.expiresAt > now).length : 0;
      setSavedCookieInfo(activeCount > 0 ? { domain: base, count: activeCount } : null);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, importSource, webUrlInput, webInspectResult]);

  React.useEffect(() => {
    if (isOpen && initialWebUrl) {
      setImportSource('web');
      setWebUrlInput(initialWebUrl);
      handleInspectWebUrl(initialWebUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialWebUrl]);

  if (!isOpen) return null;

  const handleFileChange = async (file: File) => {
    setSelectedFile(file);
    setIsProcessing(true);
    setErrorMessage(null);

    const ext = file.name.split('.').pop()?.toLowerCase();
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    setBookTitle(cleanName);

    try {
      if (ext === 'epub') {
        setBookFormat('EPUB');
        const parsed = await parseEpubFile(file);
        setBookTitle(parsed.title);
        setBookAuthor(parsed.author);
        setBookDescription(parsed.description);
        if (parsed.coverUrl) setCoverUrl(parsed.coverUrl);
        setDraftChapters(parsed.chapters);
      } else if (ext === 'md' || ext === 'html' || ext === 'htm') {
        setBookFormat(ext === 'md' ? 'MD' : 'HTML');
        const parsed = await parseHtmlOrMdFile(file);
        setDraftChapters(parsed.chapters);
      } else {
        // TXT file
        setBookFormat('TXT');
        const text = await readFileAsText(file, selectedEncoding);
        setRawTextContent(text);
        const testRes = testRegexPattern(customRegexPattern, customRegexFlags, text);
        setRegexTestResult(testRes);
        const chapters = splitTextByRule(text, customRegexPattern, customRegexFlags, cleanName);
        setDraftChapters(chapters);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể đọc file.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePatternChange = (pat: string) => {
    setCustomRegexPattern(pat);
    if (rawTextContent) {
      const res = testRegexPattern(pat, customRegexFlags, rawTextContent);
      setRegexTestResult(res);
      if (res.isValid) {
        const chapters = splitTextByRule(rawTextContent, pat, customRegexFlags, bookTitle);
        setDraftChapters(chapters);
      }
    }
  };

  const handleRulePresetChange = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    const rule = DEFAULT_CHAPTER_RULES.find((r) => r.id === ruleId);
    if (rule) {
      setCustomRegexPattern(rule.pattern);
      setCustomRegexFlags(rule.flags);
      if (rawTextContent) {
        const res = testRegexPattern(rule.pattern, rule.flags, rawTextContent);
        setRegexTestResult(res);
        if (res.isValid) {
          const chapters = splitTextByRule(rawTextContent, rule.pattern, rule.flags, bookTitle);
          setDraftChapters(chapters);
        }
      }
    }
  };

  const handleEncodingChange = async (enc: string) => {
    setSelectedEncoding(enc);
    if (selectedFile && bookFormat === 'TXT') {
      setIsProcessing(true);
      try {
        const text = await readFileAsText(selectedFile, enc);
        setRawTextContent(text);
        const res = testRegexPattern(customRegexPattern, customRegexFlags, text);
        setRegexTestResult(res);
        const chapters = splitTextByRule(text, customRegexPattern, customRegexFlags, bookTitle);
        setDraftChapters(chapters);
      } catch (err: any) {
        setErrorMessage(err.message || 'Lỗi bảng mã.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  // Chapter operations
  const handleDeleteChapter = (index: number) => {
    setDraftChapters((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  };

  const handleMergeWithPrevious = (index: number) => {
    if (index === 0) return;
    setDraftChapters((prev) => {
      const copy = [...prev];
      const prevCh = copy[index - 1];
      const currCh = copy[index];

      prevCh.content = prevCh.content + '\n\n' + currCh.content;
      prevCh.wordCount = countWords(prevCh.content);

      copy.splice(index, 1);
      return copy;
    });
  };

  const handleStartEdit = (index: number) => {
    const ch = draftChapters[index];
    setEditingIndex(index);
    setEditTitle(ch.title);
    setEditContent(ch.content);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;
    setDraftChapters((prev) =>
      prev.map((ch, i) =>
        i === editingIndex
          ? {
              ...ch,
              title: editTitle.trim() || ch.title,
              content: editContent,
              wordCount: countWords(editContent),
            }
          : ch
      )
    );
    setEditingIndex(null);
  };

  const handleAddNewChapter = () => {
    if (!newTitle.trim()) return;
    const newCh = {
      title: newTitle.trim(),
      content: newContent.trim(),
      wordCount: countWords(newContent),
    };
    setDraftChapters((prev) => [...prev, newCh]);
    setNewTitle('');
    setNewContent('');
    setIsAddingChapter(false);
  };

  const handleSplitChapter = () => {
    if (splittingIndex === null || !splitKeyword.trim()) return;
    const target = draftChapters[splittingIndex];
    const pos = target.content.indexOf(splitKeyword);
    if (pos === -1) {
      alert('Không tìm thấy từ khóa tách trong nội dung chương.');
      return;
    }

    const part1Content = target.content.slice(0, pos).trim();
    const part2Content = target.content.slice(pos).trim();

    const part1 = { ...target, content: part1Content, wordCount: countWords(part1Content) };
    const part2 = {
      title: `${target.title} (Phần 2)`,
      content: part2Content,
      wordCount: countWords(part2Content),
    };

    setDraftChapters((prev) => {
      const copy = [...prev];
      copy.splice(splittingIndex, 1, part1, part2);
      return copy;
    });

    setSplittingIndex(null);
    setSplitKeyword('');
  };

  const handleInspectWebUrl = async (overrideUrl?: string) => {
    const targetUrl = (overrideUrl ?? webUrlInput).trim();
    if (!targetUrl) {
      setErrorMessage('Vui lòng nhập đường dẫn URL.');
      return;
    }
    if (overrideUrl) {
      setWebUrlInput(overrideUrl);
    }

    setIsInspectingWeb(true);
    setErrorMessage(null);
    setWebInspectResult(null);
    setDraftChapters([]);

    try {
      // Persist any manually entered cookie into the domain's Cookie Vault for future visits
      if (webCookie.trim()) {
        await saveManualDomainCookie(targetUrl, webCookie.trim()).catch(() => {});
      }
      const result = await inspectWebNovelUrl(targetUrl, webCookie);
      setWebInspectResult(result);
      setBookTitle(result.title);
      setBookAuthor(result.author);
      setBookDescription(result.description);
      setBookFormat('WEB');
      setSourceUrl(result.normalizedUrl);
      setCoverUrl(result.coverDataUrl || '');
      setBookTagsInput((result.tags || []).join(', '));
      setSelectedWebChapterIndices(new Set(result.chapters.map((c) => c.index)));
      if (result.requiresCookie) {
        setShowAdvancedWeb(true);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể lấy thông tin từ URL.');
    } finally {
      setIsInspectingWeb(false);
    }
  };

  const handleDownloadWebChapters = async (autoImportAfterDownload: boolean) => {
    if (!webInspectResult) return;
    const chosen = webInspectResult.chapters.filter((c) => selectedWebChapterIndices.has(c.index));
    if (chosen.length === 0) {
      setErrorMessage('Vui lòng chọn ít nhất 1 chương.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    abortWebDownloadRef.current = false;

    try {
      const {
        chapters,
        collectedTags,
        successCount,
        failedCount,
        firstError,
        requiresCookie,
      } = await downloadSelectedWebChapters(
        chosen,
        webCookie,
        (prog) => setWebDownloadProgress(prog),
        () => abortWebDownloadRef.current
      );

      if (abortWebDownloadRef.current || chapters.length === 0) {
        setIsProcessing(false);
        setWebDownloadProgress(null);
        return;
      }

      if (successCount === 0) {
        if (requiresCookie) {
          setShowAdvancedWeb(true);
        }
        setErrorMessage(
          firstError ||
            'Không tải được nội dung văn bản từ liên kết này. Nếu đây là truyện Pixiv R-18, hãy nhập Cookie Pixiv (PHPSESSID) rồi thử lại.'
        );
        setWebDownloadProgress(null);
        return;
      }

      // Merge initial tags with any per-chapter tags discovered
      const existingTags = bookTagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const mergedTagSet = new Set<string>([...existingTags, ...collectedTags]);
      const finalTagsArray = Array.from(mergedTagSet);
      setBookTagsInput(finalTagsArray.join(', '));

      const backupRaw = buildChaptersBackupText(chapters);
      setRawTextContent(backupRaw);
      setDraftChapters(
        chapters.map((c) => ({
          title: c.title,
          content: c.content,
          wordCount: c.wordCount,
        }))
      );
      setWebDownloadProgress(null);

      if (failedCount > 0) {
        setErrorMessage(
          `Đã tải ${successCount}/${chosen.length} chương (${failedCount} chương bị lỗi: ${firstError || 'không rõ'}). Vui lòng kiểm tra trước khi lưu.`
        );
        return;
      }

      if (autoImportAfterDownload) {
        await finalizeBookImport(
          chapters.map((c) => ({ title: c.title, content: c.content, wordCount: c.wordCount })),
          finalTagsArray,
          backupRaw
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Lỗi khi tải nội dung chương.');
    } finally {
      setIsProcessing(false);
      setWebDownloadProgress(null);
    }
  };

  const finalizeBookImport = async (
    chaptersToSave: Array<{ title: string; wordCount: number; content: string }>,
    tagsToSave?: string[],
    rawBackupOverride?: string
  ) => {
    const parsedTags =
      tagsToSave ??
      bookTagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

    const finalTags = parsedTags.length > 0 ? parsedTags : [bookFormat];
    const backup = rawBackupOverride ?? rawTextContent;
    const bookId = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const totalSize =
      selectedFile?.size ||
      new Blob([chaptersToSave.map((c) => c.content).join('\n')]).size;

    const newBook: Book = {
      id: bookId,
      title: bookTitle.trim(),
      author: bookAuthor.trim() || 'Khuyết danh',
      description: bookDescription.trim(),
      coverUrl: coverUrl || '',
      format: bookFormat,
      totalChapters: chaptersToSave.length,
      currentChapterIndex: 0,
      scrollProgress: 0,
      lastReadTimestamp: Date.now(),
      addedTimestamp: Date.now(),
      status: 'reading',
      fileSize: totalSize,
      sourceFileName: selectedFile?.name || sourceUrl || 'web-novel.txt',
      sourceUrl: sourceUrl || undefined,
      rawTextBackup: backup || undefined,
      tags: finalTags,
    };

    const finalChapters: Chapter[] = chaptersToSave.map((ch, idx) => ({
      id: `${bookId}-ch-${idx}`,
      bookId,
      chapterIndex: idx,
      title: ch.title || `Chương ${idx + 1}`,
      wordCount: ch.wordCount,
      content: ch.content,
      originalContent: ch.content,
      originalTitle: ch.title || `Chương ${idx + 1}`,
    }));

    await saveBook(newBook);
    await saveChapters(finalChapters);

    onBookImported(newBook);
    onClose();
  };

  const handleConfirmImport = async () => {
    if (!bookTitle.trim()) {
      setErrorMessage('Vui lòng nhập tên truyện.');
      return;
    }
    if (draftChapters.length === 0) {
      setErrorMessage('Chưa có chương nào được phân tích.');
      return;
    }

    setIsProcessing(true);
    try {
      await finalizeBookImport(draftChapters);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi khi lưu sách.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden select-none">
        {/* Header */}
        <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Upload className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-neutral-100">Thêm truyện</h2>
            </div>

            {/* Source Switcher Tabs */}
            <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  if (importSource === 'file') return;
                  setImportSource('file');
                  setSelectedFile(null);
                  setRawTextContent('');
                  setDraftChapters([]);
                  setWebInspectResult(null);
                  setWebDownloadProgress(null);
                  setSourceUrl('');
                  setBookTitle('');
                  setBookAuthor('');
                  setBookDescription('');
                  setBookTagsInput('');
                  setCoverUrl('');
                  setErrorMessage(null);
                }}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  importSource === 'file'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Từ tệp máy tính</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (importSource === 'web') return;
                  setImportSource('web');
                  setSelectedFile(null);
                  setRawTextContent('');
                  setDraftChapters([]);
                  setWebInspectResult(null);
                  setWebDownloadProgress(null);
                  setSourceUrl('');
                  setBookTitle('');
                  setBookAuthor('');
                  setBookDescription('');
                  setBookTagsInput('');
                  setCoverUrl('');
                  setErrorMessage(null);
                }}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                  importSource === 'web'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Từ trang web</span>
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {errorMessage && (
            <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-xs text-red-300 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {importSource === 'web' && draftChapters.length === 0 ? (
            <div className="space-y-4">
              {/* URL Input Box */}
              <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3">
                <label className="block text-xs font-semibold text-neutral-200">
                  Nhập liên kết truyện hoặc danh sách chương
                </label>
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="url"
                      value={webUrlInput}
                      onChange={(e) => setWebUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleInspectWebUrl();
                      }}
                      placeholder="Nhập địa chỉ URL truyện..."
                      className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isInspectingWeb || isProcessing}
                    onClick={() => handleInspectWebUrl()}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shrink-0"
                  >
                    {isInspectingWeb ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Globe className="w-4 h-4" />
                    )}
                    <span>{isInspectingWeb ? 'Đang phân tích...' : 'Phân tích URL'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Hỗ trợ: Pixiv Series, Pixiv Novel, Syosetsu, Kakuyomu, trang web chữ</span>
                    {savedCookieInfo && (
                      <span className="px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-700/50 text-emerald-300 font-mono text-[10px]">
                        Đã lưu {savedCookieInfo.count} cookies ({savedCookieInfo.domain})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    {onOpenBrowser && (
                      <button
                        type="button"
                        onClick={() => onOpenBrowser(webUrlInput.trim() || undefined)}
                        className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Mở trình duyệt (tự lưu Cookie)</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowAdvancedWeb((prev) => !prev)}
                      className="text-amber-400 hover:text-amber-300 cursor-pointer"
                    >
                      {showAdvancedWeb ? 'Ẩn tùy chọn Cookie' : 'Cookie (tùy chọn)'}
                    </button>
                  </div>
                </div>

                {showAdvancedWeb && (
                  <div className="pt-2 border-t border-neutral-800 space-y-1.5">
                    <label className="block text-[11px] text-neutral-400">
                      Cookie Pixiv / trang web (tự động lưu lại theo tên miền cho các lần tải sau)
                    </label>
                    <input
                      type="password"
                      value={webCookie}
                      onChange={(e) => setWebCookie(e.target.value)}
                      placeholder="Nhập Cookie (tùy chọn)..."
                      className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-200 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>

              {/* Inspected Web Novel Preview */}
              {webInspectResult && (
                <div className="space-y-4">
                  {/* Restriction / Missing Cookie Warning */}
                  {webInspectResult.requiresCookie && (
                    <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start space-x-2.5 text-xs text-amber-200">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-semibold text-amber-300">
                            Pixiv đang ẩn nội dung chữ (R-18 / yêu cầu đăng nhập)
                          </p>
                          <p className="text-[11px] text-amber-200/90 leading-relaxed">
                            {webInspectResult.restrictionNotice ||
                              'Pixiv chỉ trả về tiêu đề và tag, còn nội dung văn bản bị đặt thành trống khi chưa đăng nhập. Hãy đăng nhập trong Trình duyệt Web hoặc dán Cookie PHPSESSID rồi phân tích lại.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        {onOpenBrowser && (
                          <button
                            type="button"
                            onClick={() => onOpenBrowser(webInspectResult.normalizedUrl)}
                            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-cyan-300 border border-cyan-700/50 rounded-lg text-xs font-medium cursor-pointer"
                          >
                            Mở trình duyệt
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isInspectingWeb || !webCookie.trim()}
                          onClick={() => handleInspectWebUrl()}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          Thử lại với Cookie
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Series quick jump banner if inspected a single chapter of a series */}
                  {webInspectResult.seriesInfo && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                      <div className="text-xs text-amber-200">
                        Truyện này thuộc bộ <span className="font-bold">{webInspectResult.seriesInfo.title}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleInspectWebUrl(webInspectResult.seriesInfo!.url)}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
                      >
                        Lấy cả bộ truyện
                      </button>
                    </div>
                  )}

                  {/* Metadata + Cover card */}
                  <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 flex flex-col sm:flex-row gap-4">
                    {coverUrl && (
                      <div className="w-24 h-36 rounded-lg overflow-hidden border border-neutral-800 shrink-0 bg-neutral-900">
                        <img src={coverUrl} alt={bookTitle} className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="flex-1 space-y-3 min-w-0">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-neutral-400 font-medium mb-1">Tên truyện *</label>
                          <input
                            type="text"
                            value={bookTitle}
                            onChange={(e) => setBookTitle(e.target.value)}
                            className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-neutral-400 font-medium mb-1">Tác giả</label>
                          <input
                            type="text"
                            value={bookAuthor}
                            onChange={(e) => setBookAuthor(e.target.value)}
                            className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-neutral-400 font-medium mb-1 flex items-center space-x-1">
                          <Tag className="w-3 h-3 text-amber-500" />
                          <span>Thẻ (Tags - phân cách bằng dấu phẩy)</span>
                        </label>
                        <input
                          type="text"
                          value={bookTagsInput}
                          onChange={(e) => setBookTagsInput(e.target.value)}
                          placeholder="Nhập thẻ, phân cách bằng dấu phẩy..."
                          className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-amber-300 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {bookDescription && (
                        <div>
                          <label className="block text-neutral-400 font-medium mb-1">Giới thiệu</label>
                          <textarea
                            rows={2}
                            value={bookDescription}
                            onChange={(e) => setBookDescription(e.target.value)}
                            className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-300 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Chapter Selection List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-200">
                        Danh sách chương ({selectedWebChapterIndices.size}/{webInspectResult.chapters.length} đã chọn)
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedWebChapterIndices(new Set(webInspectResult.chapters.map((c) => c.index)))
                          }
                          className="text-amber-400 hover:text-amber-300 cursor-pointer"
                        >
                          Chọn tất cả
                        </button>
                        <span className="text-neutral-600">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedWebChapterIndices(new Set())}
                          className="text-neutral-400 hover:text-neutral-200 cursor-pointer"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    </div>

                    <div className="border border-neutral-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto bg-neutral-950 divide-y divide-neutral-900">
                      {webInspectResult.chapters.map((ch) => {
                        const checked = selectedWebChapterIndices.has(ch.index);
                        return (
                          <label
                            key={ch.id}
                            className="flex items-center justify-between px-3 py-2 hover:bg-neutral-900/70 cursor-pointer"
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setSelectedWebChapterIndices((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(ch.index)) next.delete(ch.index);
                                    else next.add(ch.index);
                                    return next;
                                  });
                                }}
                                className="accent-amber-500 rounded"
                              />
                              <span className="text-[11px] font-mono text-neutral-500 w-7 shrink-0">
                                #{ch.index + 1}
                              </span>
                              <span className="text-xs text-neutral-200 truncate">{ch.title}</span>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0 ml-2">
                              {ch.requiresCookie && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">
                                  Cần Cookie
                                </span>
                              )}
                              {ch.wordCount ? (
                                <span className="text-[11px] font-mono text-neutral-500">
                                  {ch.wordCount.toLocaleString()} từ
                                </span>
                              ) : null}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Download Progress Bar */}
                  {webDownloadProgress && (
                    <div className="p-3 bg-neutral-950 border border-amber-500/40 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-amber-300 font-medium truncate pr-4">
                          Đang tải ({webDownloadProgress.completed}/{webDownloadProgress.total}):{' '}
                          {webDownloadProgress.currentTitle}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            abortWebDownloadRef.current = true;
                          }}
                          className="text-red-400 hover:underline shrink-0 cursor-pointer"
                        >
                          Dừng
                        </button>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 transition-all duration-200"
                          style={{
                            width: `${Math.round(
                              (webDownloadProgress.completed / Math.max(1, webDownloadProgress.total)) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : importSource === 'file' && !selectedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileChange(e.dataTransfer.files[0]);
                }
              }}
              className="border-2 border-dashed border-neutral-700 hover:border-amber-500/70 bg-neutral-950/50 rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all text-center group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.epub,.md,.html,.htm"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 rounded-xl bg-neutral-800 group-hover:bg-amber-600/20 text-neutral-400 group-hover:text-amber-400 flex items-center justify-center mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-neutral-200 group-hover:text-amber-400">
                Chọn file truyện hoặc kéo thả vào đây
              </p>
              <p className="text-neutral-500 text-[11px] mt-1 font-mono">
                TXT • EPUB • Markdown • HTML
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File or Web Source Info */}
              <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between gap-3">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold text-xs shrink-0">
                    {bookFormat}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-neutral-200 truncate">
                      {selectedFile ? selectedFile.name : sourceUrl || bookTitle}
                    </h4>
                    <p className="text-[11px] text-neutral-400 font-mono">
                      {selectedFile
                        ? `${(selectedFile.size / 1024).toFixed(1)} KB • `
                        : ''}
                      {draftChapters.length} chương
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (importSource === 'web') {
                      setDraftChapters([]);
                    } else {
                      setSelectedFile(null);
                    }
                  }}
                  className="text-xs text-neutral-400 hover:text-white px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 cursor-pointer shrink-0"
                >
                  {importSource === 'web' ? 'Chọn lại chương' : 'Chọn file khác'}
                </button>
              </div>

              {/* Metadata Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-400 font-medium mb-1">Tên truyện *</label>
                  <input
                    type="text"
                    value={bookTitle}
                    onChange={(e) => setBookTitle(e.target.value)}
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 font-medium mb-1">Tác giả</label>
                  <input
                    type="text"
                    value={bookAuthor}
                    onChange={(e) => setBookAuthor(e.target.value)}
                    className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 font-medium mb-1 flex items-center space-x-1">
                  <Tag className="w-3 h-3 text-amber-500" />
                  <span>Thẻ (Tags - phân cách bằng dấu phẩy)</span>
                </label>
                <input
                  type="text"
                  value={bookTagsInput}
                  onChange={(e) => setBookTagsInput(e.target.value)}
                  placeholder="Nhập thẻ, phân cách bằng dấu phẩy..."
                  className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-amber-300 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* TXT / Web Chapter Separation Controls */}
              {(bookFormat === 'TXT' || (bookFormat === 'WEB' && rawTextContent)) && (
                <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 font-semibold text-neutral-200">
                      <Scissors className="w-3.5 h-3.5 text-amber-500" />
                      <span>Quy tắc tách chương</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-neutral-400 text-[11px]">Bảng mã:</span>
                      <select
                        value={selectedEncoding}
                        onChange={(e) => handleEncodingChange(e.target.value)}
                        className="bg-neutral-900 border border-neutral-700 text-neutral-200 rounded px-2 py-0.5 text-xs focus:outline-none"
                      >
                        <option value="auto">Tự động</option>
                        <option value="utf-8">UTF-8</option>
                        <option value="windows-1258">Windows-1258 (Tiếng Việt)</option>
                        <option value="utf-16le">UTF-16 LE</option>
                        <option value="gbk">GBK</option>
                        <option value="big5">Big5</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-neutral-400 text-[11px] mb-1">Quy tắc nhận diện</label>
                      <select
                        value={selectedRuleId}
                        onChange={(e) => handleRulePresetChange(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                      >
                        {DEFAULT_CHAPTER_RULES.map((rule) => (
                          <option key={rule.id} value={rule.id}>
                            {rule.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-neutral-400 text-[11px] mb-1">
                        Biểu thức RegEx tùy chỉnh
                      </label>
                      <input
                        type="text"
                        value={customRegexPattern}
                        onChange={(e) => handlePatternChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono text-amber-300 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Regex Diagnostics Preview */}
                  {regexTestResult && (
                    <div className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-800 text-[11px] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400">Kết quả phân tích mẫu:</span>
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded ${
                            regexTestResult.isValid && regexTestResult.matchCount > 0
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {regexTestResult.isValid
                            ? `Tìm thấy ${regexTestResult.matchCount} chương`
                            : regexTestResult.error}
                        </span>
                      </div>

                      {regexTestResult.sampleMatches.length > 0 && (
                        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pt-1">
                          {regexTestResult.sampleMatches.slice(0, 10).map((m, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 bg-neutral-950 rounded text-neutral-300 font-mono text-[10px]"
                            >
                              #{i + 1} {m.text}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Edit Single Chapter Form */}
              {editingIndex !== null && (
                <div className="p-3 bg-neutral-950 border border-amber-500/50 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-amber-400">Sửa nội dung chương</span>
                    <button onClick={() => setEditingIndex(null)} className="text-neutral-400 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-100 font-semibold focus:outline-none"
                  />
                  <textarea
                    rows={6}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-200 font-serif leading-relaxed focus:outline-none"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setEditingIndex(null)}
                      className="px-3 py-1 rounded bg-neutral-800 text-neutral-300"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium"
                    >
                      Lưu
                    </button>
                  </div>
                </div>
              )}

              {/* Split Single Chapter Form */}
              {splittingIndex !== null && (
                <div className="p-3 bg-neutral-950 border border-amber-500/50 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-amber-400">Tách chương làm đôi</span>
                    <button onClick={() => setSplittingIndex(null)} className="text-neutral-400 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={splitKeyword}
                    onChange={(e) => setSplitKeyword(e.target.value)}
                    placeholder="Nhập cụm từ bắt đầu phần 2..."
                    className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-200 focus:outline-none"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setSplittingIndex(null)}
                      className="px-3 py-1 rounded bg-neutral-800 text-neutral-300"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={handleSplitChapter}
                      disabled={!splitKeyword.trim()}
                      className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium disabled:opacity-50"
                    >
                      Xác nhận tách
                    </button>
                  </div>
                </div>
              )}

              {/* Add Chapter Form */}
              {isAddingChapter && (
                <div className="p-3 bg-neutral-950 border border-amber-500/50 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-amber-400">Thêm chương mới</span>
                    <button onClick={() => setIsAddingChapter(false)} className="text-neutral-400 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Tên chương..."
                    className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-200 focus:outline-none"
                  />
                  <textarea
                    rows={4}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Nội dung chương..."
                    className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-200 focus:outline-none"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setIsAddingChapter(false)}
                      className="px-3 py-1 rounded bg-neutral-800 text-neutral-300"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={handleAddNewChapter}
                      disabled={!newTitle.trim()}
                      className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium disabled:opacity-50"
                    >
                      Thêm vào cuối
                    </button>
                  </div>
                </div>
              )}

              {/* Chapter Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-200">
                    Danh sách chương ({draftChapters.length})
                  </span>
                  <button
                    onClick={() => setIsAddingChapter(true)}
                    className="flex items-center space-x-1 text-amber-400 hover:text-amber-300 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm chương</span>
                  </button>
                </div>

                <div className="border border-neutral-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto bg-neutral-950">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-900 text-neutral-400 uppercase text-[10px] font-semibold sticky top-0 border-b border-neutral-800">
                      <tr>
                        <th className="py-2 px-3 w-12 text-center">STT</th>
                        <th className="py-2 px-3">Tên chương</th>
                        <th className="py-2 px-3 w-20 text-right">Số từ</th>
                        <th className="py-2 px-3 w-32 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-850">
                      {draftChapters.map((ch, idx) => (
                        <tr key={idx} className="hover:bg-neutral-900/60 transition-colors">
                          <td className="py-2 px-3 text-center text-neutral-500 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 text-neutral-200">
                            <span
                              onClick={() => handleStartEdit(idx)}
                              className="truncate block max-w-sm cursor-pointer hover:text-amber-400"
                              title="Nhấn để sửa chương"
                            >
                              {ch.title}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-neutral-400 font-mono text-[11px]">
                            {ch.wordCount.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                onClick={() => handleStartEdit(idx)}
                                className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
                                title="Sửa nội dung"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setSplittingIndex(idx)}
                                className="p-1 text-neutral-400 hover:text-amber-400 rounded hover:bg-neutral-800"
                                title="Tách làm đôi"
                              >
                                <Split className="w-3.5 h-3.5" />
                              </button>
                              {idx > 0 && (
                                <button
                                  onClick={() => handleMergeWithPrevious(idx)}
                                  className="p-1 text-neutral-400 hover:text-amber-400 rounded hover:bg-neutral-800"
                                  title="Gộp với chương trước"
                                >
                                  <Merge className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteChapter(idx)}
                                className="p-1 text-neutral-400 hover:text-red-400 rounded hover:bg-neutral-800"
                                title="Xóa chương"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white cursor-pointer"
          >
            Hủy
          </button>

          {importSource === 'web' && draftChapters.length === 0 ? (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={!webInspectResult || selectedWebChapterIndices.size === 0 || isProcessing}
                onClick={() => handleDownloadWebChapters(false)}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 rounded-lg text-xs font-medium cursor-pointer transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Tải để sửa chương</span>
              </button>
              <button
                type="button"
                disabled={!webInspectResult || selectedWebChapterIndices.size === 0 || isProcessing}
                onClick={() => handleDownloadWebChapters(true)}
                className="flex items-center space-x-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-colors"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>
                  {isProcessing
                    ? 'Đang tải...'
                    : `Tải & Thêm (${selectedWebChapterIndices.size} chương)`}
                </span>
              </button>
            </div>
          ) : (
            <button
              disabled={(!selectedFile && importSource !== 'web') || draftChapters.length === 0 || isProcessing}
              onClick={handleConfirmImport}
              className="flex items-center space-x-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-colors"
            >
              {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Thêm {draftChapters.length} chương vào Thư viện</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
