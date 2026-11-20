import React from 'react';
import {
  X,
  Scissors,
  Plus,
  Trash2,
  Merge,
  Split,
  Edit2,
  Check,
  RefreshCw,
  Search,
  Eye,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Book, Chapter } from '../types';
import {
  DEFAULT_CHAPTER_RULES,
  testRegexPattern,
  splitTextByRule,
  countWords,
  RegexTestResult,
} from '../services/parser';
import { replaceBookChapters, saveBook } from '../services/storage';

interface ChapterManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  chapters: Chapter[];
  onChaptersUpdated: (updatedChapters: Chapter[], updatedBook: Book) => void;
}

export const ChapterManagerModal: React.FC<ChapterManagerModalProps> = ({
  isOpen,
  onClose,
  book,
  chapters,
  onChaptersUpdated,
}) => {
  const [draftChapters, setDraftChapters] = React.useState<Chapter[]>([]);
  const [selectedRuleId, setSelectedRuleId] = React.useState<string>(DEFAULT_CHAPTER_RULES[0].id);
  const [customPattern, setCustomPattern] = React.useState<string>(DEFAULT_CHAPTER_RULES[0].pattern);
  const [customFlags, setCustomFlags] = React.useState<string>('gi');
  const [testResult, setTestResult] = React.useState<RegexTestResult | null>(null);
  const [activeTab, setActiveTab] = React.useState<'list' | 'resplit'>('list');

  // Editing single chapter
  const [editingChapterId, setEditingChapterId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [editContent, setEditContent] = React.useState('');

  // Add chapter state
  const [isAddingNew, setIsAddingNew] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState('');
  const [newContent, setNewContent] = React.useState('');
  const [insertPosition, setInsertPosition] = React.useState<number>(0);

  // Split chapter at cursor / text state
  const [splittingChapterId, setSplittingChapterId] = React.useState<string | null>(null);
  const [splitKeyword, setSplitKeyword] = React.useState('');

  const [searchFilter, setSearchFilter] = React.useState('');

  // Initialize draft chapters
  React.useEffect(() => {
    if (isOpen) {
      setDraftChapters([...chapters]);
      setEditingChapterId(null);
      setIsAddingNew(false);
      setSplittingChapterId(null);
      setActiveTab('list');

      // Test default regex on full content if available
      const fullText = book.rawTextBackup || chapters.map((c) => `${c.title}\n${c.content}`).join('\n\n');
      const res = testRegexPattern(customPattern, customFlags, fullText);
      setTestResult(res);
    }
  }, [isOpen, chapters, book]);

  if (!isOpen) return null;

  const fullBookText =
    book.rawTextBackup || draftChapters.map((c) => `${c.title}\n${c.content}`).join('\n\n');

  // Test regex live on pattern change
  const handlePatternChange = (pat: string) => {
    setCustomPattern(pat);
    const res = testRegexPattern(pat, customFlags, fullBookText);
    setTestResult(res);
  };

  const handlePresetChange = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    const preset = DEFAULT_CHAPTER_RULES.find((r) => r.id === ruleId);
    if (preset) {
      setCustomPattern(preset.pattern);
      setCustomFlags(preset.flags);
      const res = testRegexPattern(preset.pattern, preset.flags, fullBookText);
      setTestResult(res);
    }
  };

  // Re-split chapters using the regex
  const handleExecuteResplit = () => {
    if (!testResult?.isValid) return;

    const parsed = splitTextByRule(fullBookText, customPattern, customFlags, book.title);
    const newChapters: Chapter[] = parsed.map((item, idx) => ({
      id: `${book.id}-ch-${Date.now()}-${idx}`,
      bookId: book.id,
      chapterIndex: idx,
      title: item.title,
      wordCount: item.wordCount,
      content: item.content,
    }));

    setDraftChapters(newChapters);
    setActiveTab('list');
  };

  // Edit chapter
  const handleStartEdit = (ch: Chapter) => {
    setEditingChapterId(ch.id);
    setEditTitle(ch.title);
    setEditContent(ch.content);
  };

  const handleSaveEdit = () => {
    if (!editingChapterId) return;

    setDraftChapters((prev) =>
      prev.map((c) =>
        c.id === editingChapterId
          ? {
              ...c,
              title: editTitle.trim() || c.title,
              content: editContent,
              wordCount: countWords(editContent),
            }
          : c
      )
    );
    setEditingChapterId(null);
  };

  // Delete chapter
  const handleDeleteChapter = (chId: string) => {
    setDraftChapters((prev) => {
      const filtered = prev.filter((c) => c.id !== chId);
      return filtered.map((c, idx) => ({ ...c, chapterIndex: idx }));
    });
    if (editingChapterId === chId) setEditingChapterId(null);
  };

  // Merge with previous chapter
  const handleMergeWithPrev = (index: number) => {
    if (index <= 0) return;
    setDraftChapters((prev) => {
      const copy = [...prev];
      const prevCh = copy[index - 1];
      const currentCh = copy[index];

      prevCh.content = prevCh.content + '\n\n' + currentCh.content;
      prevCh.wordCount = countWords(prevCh.content);

      copy.splice(index, 1);
      return copy.map((c, idx) => ({ ...c, chapterIndex: idx }));
    });
  };

  // Add new chapter
  const handleAddNewChapter = () => {
    if (!newTitle.trim()) return;

    const newCh: Chapter = {
      id: `${book.id}-ch-${Date.now()}`,
      bookId: book.id,
      chapterIndex: insertPosition,
      title: newTitle.trim(),
      content: newContent.trim(),
      wordCount: countWords(newContent),
    };

    setDraftChapters((prev) => {
      const copy = [...prev];
      copy.splice(insertPosition, 0, newCh);
      return copy.map((c, idx) => ({ ...c, chapterIndex: idx }));
    });

    setNewTitle('');
    setNewContent('');
    setIsAddingNew(false);
  };

  // Split single chapter in two
  const handleExecuteSplitChapter = () => {
    if (!splittingChapterId || !splitKeyword.trim()) return;

    const targetIndex = draftChapters.findIndex((c) => c.id === splittingChapterId);
    if (targetIndex === -1) return;

    const currentCh = draftChapters[targetIndex];
    const splitIndex = currentCh.content.indexOf(splitKeyword);
    if (splitIndex === -1) {
      alert('Không tìm thấy từ khóa tách trong nội dung chương.');
      return;
    }

    const part1Content = currentCh.content.slice(0, splitIndex).trim();
    const part2Content = currentCh.content.slice(splitIndex).trim();

    const part1: Chapter = {
      ...currentCh,
      content: part1Content,
      wordCount: countWords(part1Content),
    };

    const part2: Chapter = {
      id: `${book.id}-ch-${Date.now()}-part2`,
      bookId: book.id,
      chapterIndex: targetIndex + 1,
      title: `${currentCh.title} (Phần 2)`,
      content: part2Content,
      wordCount: countWords(part2Content),
    };

    setDraftChapters((prev) => {
      const copy = [...prev];
      copy.splice(targetIndex, 1, part1, part2);
      return copy.map((c, idx) => ({ ...c, chapterIndex: idx }));
    });

    setSplittingChapterId(null);
    setSplitKeyword('');
  };

  // Save all changes to IndexedDB
  const handleSaveAll = async () => {
    const updatedBook: Book = {
      ...book,
      totalChapters: draftChapters.length,
      currentChapterIndex: Math.min(book.currentChapterIndex, Math.max(0, draftChapters.length - 1)),
    };

    await replaceBookChapters(book.id, draftChapters);
    await saveBook(updatedBook);

    onChaptersUpdated(draftChapters, updatedBook);
    onClose();
  };

  const filteredChapters = draftChapters.filter((c) =>
    c.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden select-none">
        {/* Header */}
        <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <div className="flex items-center space-x-2.5">
            <Scissors className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-neutral-100">
              Quản lý & Tách chương: <span className="text-amber-400">{book.title}</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center space-x-1 px-4 pt-2 border-b border-neutral-800 bg-neutral-950/60 text-xs">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3 py-1.5 rounded-t-lg transition-colors cursor-pointer font-medium ${
              activeTab === 'list'
                ? 'bg-neutral-900 text-amber-400 border-t-2 border-amber-500'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Danh sách chương ({draftChapters.length})
          </button>
          <button
            onClick={() => setActiveTab('resplit')}
            className={`px-3 py-1.5 rounded-t-lg transition-colors cursor-pointer font-medium ${
              activeTab === 'resplit'
                ? 'bg-neutral-900 text-amber-400 border-t-2 border-amber-500'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Tách chương tự động (RegEx)
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 text-xs">
          {activeTab === 'resplit' ? (
            /* Advanced TXT Parser & RegEx Test View */
            <div className="space-y-4">
              <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-200">Mẫu nhận diện tiêu đề chương</span>
                  <select
                    value={selectedRuleId}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1 text-neutral-200 focus:outline-none"
                  >
                    {DEFAULT_CHAPTER_RULES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-400 text-[11px] mb-1">
                    Biểu thức Regular Expression (có thể tùy biến):
                  </label>
                  <input
                    type="text"
                    value={customPattern}
                    onChange={(e) => handlePatternChange(e.target.value)}
                    className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* Diagnostics & Live Preview */}
                {testResult && (
                  <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-neutral-300">
                        Kết quả nhận diện:
                      </span>
                      <span
                        className={`font-mono px-2 py-0.5 rounded text-[11px] font-bold ${
                          testResult.isValid && testResult.matchCount > 0
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {testResult.isValid
                          ? `Tìm thấy ${testResult.matchCount} chương`
                          : testResult.error}
                      </span>
                    </div>

                    {testResult.sampleMatches.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[11px] text-neutral-500 block">
                          Tiêu đề các chương phát hiện đầu tiên:
                        </span>
                        <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                          {testResult.sampleMatches.slice(0, 15).map((m, i) => (
                            <div
                              key={i}
                              className="flex items-center space-x-2 text-[11px] font-mono text-neutral-300 py-0.5 px-2 bg-neutral-950 rounded border border-neutral-850"
                            >
                              <span className="text-amber-500 font-bold">#{i + 1}</span>
                              <span className="text-neutral-500">Dòng {m.lineNumber}:</span>
                              <span className="truncate">{m.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleExecuteResplit}
                  disabled={!testResult?.isValid || testResult.matchCount === 0}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-lg font-semibold transition-colors cursor-pointer"
                >
                  Tách lại toàn bộ {testResult?.matchCount || 0} chương theo quy tắc này
                </button>
              </div>
            </div>
          ) : (
            /* Chapters List and Operations */
            <div className="space-y-4">
              {/* Action Bar */}
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Tìm chương..."
                    className="w-full pl-8 pr-3 py-1 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none"
                  />
                </div>

                <button
                  onClick={() => {
                    setIsAddingNew(true);
                    setInsertPosition(draftChapters.length);
                  }}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm chương mới</span>
                </button>
              </div>

              {/* Add New Chapter Form */}
              {isAddingNew && (
                <div className="p-3 bg-neutral-950 border border-amber-500/40 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-amber-400">Thêm chương mới</span>
                    <button
                      onClick={() => setIsAddingNew(false)}
                      className="text-neutral-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Tên chương..."
                      className="col-span-2 px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-200 focus:outline-none"
                    />
                    <select
                      value={insertPosition}
                      onChange={(e) => setInsertPosition(Number(e.target.value))}
                      className="px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-300 focus:outline-none"
                    >
                      <option value={0}>Chèn vào đầu sách</option>
                      <option value={draftChapters.length}>Chèn vào cuối sách</option>
                    </select>
                  </div>
                  <textarea
                    rows={4}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="Nội dung chương..."
                    className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-200 focus:outline-none"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setIsAddingNew(false)}
                      className="px-3 py-1 rounded bg-neutral-800 text-neutral-300"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={handleAddNewChapter}
                      disabled={!newTitle.trim()}
                      className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium disabled:opacity-50"
                    >
                      Xác nhận thêm
                    </button>
                  </div>
                </div>
              )}

              {/* Single Chapter Editor Form */}
              {editingChapterId && (
                <div className="p-3 bg-neutral-950 border border-amber-500/50 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-amber-400">Chỉnh sửa nội dung chương</span>
                    <button
                      onClick={() => setEditingChapterId(null)}
                      className="text-neutral-400 hover:text-white"
                    >
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
                    rows={8}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-200 font-serif leading-relaxed focus:outline-none"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setEditingChapterId(null)}
                      className="px-3 py-1 rounded bg-neutral-800 text-neutral-300"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium"
                    >
                      Lưu thay đổi
                    </button>
                  </div>
                </div>
              )}

              {/* Split Chapter Form */}
              {splittingChapterId && (
                <div className="p-3 bg-neutral-950 border border-amber-500/50 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-amber-400">Tách chương làm đôi</span>
                    <button
                      onClick={() => setSplittingChapterId(null)}
                      className="text-neutral-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={splitKeyword}
                    onChange={(e) => setSplitKeyword(e.target.value)}
                    placeholder="Nhập cụm từ bắt đầu của phần 2..."
                    className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-200 focus:outline-none"
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setSplittingChapterId(null)}
                      className="px-3 py-1 rounded bg-neutral-800 text-neutral-300"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={handleExecuteSplitChapter}
                      disabled={!splitKeyword.trim()}
                      className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium disabled:opacity-50"
                    >
                      Tách chương
                    </button>
                  </div>
                </div>
              )}

              {/* Chapters List Table */}
              <div className="border border-neutral-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto bg-neutral-950">
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
                    {filteredChapters.map((ch, idx) => (
                      <tr key={ch.id} className="hover:bg-neutral-900/60 transition-colors">
                        <td className="py-2 px-3 text-center text-neutral-500 font-mono text-[11px]">
                          {ch.chapterIndex + 1}
                        </td>
                        <td className="py-2 px-3 text-neutral-200 font-medium">
                          <span
                            onClick={() => handleStartEdit(ch)}
                            className="cursor-pointer hover:text-amber-400 truncate block max-w-sm"
                            title="Nhấn để chỉnh sửa nội dung"
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
                              onClick={() => handleStartEdit(ch)}
                              className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
                              title="Sửa chương"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setSplittingChapterId(ch.id)}
                              className="p-1 text-neutral-400 hover:text-amber-400 rounded hover:bg-neutral-800"
                              title="Tách chương làm đôi"
                            >
                              <Split className="w-3.5 h-3.5" />
                            </button>
                            {idx > 0 && (
                              <button
                                onClick={() => handleMergeWithPrev(idx)}
                                className="p-1 text-neutral-400 hover:text-amber-400 rounded hover:bg-neutral-800"
                                title="Gộp với chương trước"
                              >
                                <Merge className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteChapter(ch.id)}
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
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white"
          >
            Hủy
          </button>

          <button
            onClick={handleSaveAll}
            className="flex items-center space-x-1.5 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-sm transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Lưu thay đổi ({draftChapters.length} chương)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
