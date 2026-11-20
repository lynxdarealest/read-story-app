import React from 'react';
import {
  X,
  BookA,
  Plus,
  Trash2,
  Download,
  Upload,
  ToggleLeft,
  ToggleRight,
  Globe,
  BookOpen,
} from 'lucide-react';
import {
  DictionaryEntry,
  DictionaryEntryType,
  GLOBAL_DICTIONARY_BOOK_ID,
} from '../types';
import {
  exportDictionaryToTxt,
  parseDictionaryFromTxt,
} from '../services/dictionary';
import {
  saveDictionaryEntry,
  deleteDictionaryEntry,
  getDictionaries,
} from '../services/storage';

export type DictionaryScope = 'book' | 'global';

interface ReaderDictionaryProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: string;
  bookEntries: DictionaryEntry[];
  globalEntries: DictionaryEntry[];
  onEntriesUpdated: (updated: {
    bookEntries: DictionaryEntry[];
    globalEntries: DictionaryEntry[];
  }) => void;
  initialOriginalWord?: string;
}

export const ReaderDictionary: React.FC<ReaderDictionaryProps> = ({
  isOpen,
  onClose,
  bookId,
  bookEntries,
  globalEntries,
  onEntriesUpdated,
  initialOriginalWord,
}) => {
  const [activeScope, setActiveScope] = React.useState<DictionaryScope>('book');
  const [filterType, setFilterType] = React.useState<string>('all');
  const [isAdding, setIsAdding] = React.useState(false);
  const [original, setOriginal] = React.useState(initialOriginalWord || '');
  const [replacement, setReplacement] = React.useState('');
  const [note, setNote] = React.useState('');
  const [type, setType] = React.useState<DictionaryEntryType>('character');
  const [formScope, setFormScope] = React.useState<DictionaryScope>('book');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (initialOriginalWord) {
      setOriginal(initialOriginalWord);
      setFormScope(activeScope);
      setIsAdding(true);
    }
  }, [initialOriginalWord, activeScope]);

  if (!isOpen) return null;

  const targetBookIdForScope = (scope: DictionaryScope) =>
    scope === 'global' ? GLOBAL_DICTIONARY_BOOK_ID : bookId;

  const reloadAllScopes = async () => {
    const [nextBook, nextGlobal] = await Promise.all([
      getDictionaries(bookId),
      getDictionaries(GLOBAL_DICTIONARY_BOOK_ID),
    ]);
    onEntriesUpdated({ bookEntries: nextBook, globalEntries: nextGlobal });
  };

  const handleSaveEntry = async () => {
    if (!original.trim()) return;

    const scopedBookId = targetBookIdForScope(formScope);
    const newEntry: DictionaryEntry = {
      id: `dict-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      bookId: scopedBookId,
      type,
      original: original.trim(),
      replacement: replacement.trim() || original.trim(),
      note: note.trim() || undefined,
      enabled: true,
    };

    await saveDictionaryEntry(newEntry);
    await reloadAllScopes();

    setActiveScope(formScope);
    setOriginal('');
    setReplacement('');
    setNote('');
    setIsAdding(false);
  };

  const handleToggleEntry = async (entry: DictionaryEntry) => {
    const updatedEntry = { ...entry, enabled: !entry.enabled };
    await saveDictionaryEntry(updatedEntry);
    await reloadAllScopes();
  };

  const handleDeleteEntry = async (id: string) => {
    await deleteDictionaryEntry(id);
    await reloadAllScopes();
  };

  const currentScopeEntries = activeScope === 'global' ? globalEntries : bookEntries;

  const handleExportTxt = () => {
    if (currentScopeEntries.length === 0) return;
    const txt = exportDictionaryToTxt(currentScopeEntries);
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      activeScope === 'global' ? 'TuDien_MoiTruyen.txt' : `TuDien_${bookId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const scopedBookId = targetBookIdForScope(activeScope);
    const text = await file.text();
    let parsed: DictionaryEntry[] = [];

    if (file.name.toLowerCase().endsWith('.json')) {
      try {
        const raw = JSON.parse(text);
        if (Array.isArray(raw)) {
          parsed = raw
            .filter((item) => item && typeof item.original === 'string' && item.original.trim())
            .map((item, idx) => ({
              id: `dict-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
              bookId: scopedBookId,
              type: (['character', 'location', 'term', 'pronoun', 'replace'].includes(item.type)
                ? item.type
                : 'replace') as DictionaryEntryType,
              original: item.original.trim(),
              replacement:
                typeof item.replacement === 'string' && item.replacement.trim()
                  ? item.replacement.trim()
                  : item.original.trim(),
              note: typeof item.note === 'string' && item.note.trim() ? item.note.trim() : undefined,
              enabled: item.enabled !== false,
            }));
        }
      } catch {
        // Fallback to line-based A=B parser if JSON invalid
        parsed = parseDictionaryFromTxt(text, scopedBookId, 'replace');
      }
    } else {
      parsed = parseDictionaryFromTxt(text, scopedBookId, 'replace');
    }

    for (const item of parsed) {
      await saveDictionaryEntry(item);
    }

    await reloadAllScopes();
    e.target.value = '';
  };

  const filtered = currentScopeEntries.filter((e) =>
    filterType === 'all' ? true : e.type === filterType
  );

  const typeLabels: Record<DictionaryEntryType, string> = {
    character: 'Nhân vật',
    location: 'Địa danh',
    pronoun: 'Xưng hô',
    term: 'Thuật ngữ',
    replace: 'Thay thế từ',
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 max-w-full bg-neutral-900 border-l border-neutral-800 shadow-2xl flex flex-col select-none animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
        <div className="flex items-center space-x-2">
          <BookA className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
            Từ điển ({bookEntries.length + globalEntries.length})
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scope Switcher: Truyện này vs Mọi truyện */}
      <div className="p-2 border-b border-neutral-800 bg-neutral-950/70">
        <div className="grid grid-cols-2 gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 text-xs">
          <button
            type="button"
            onClick={() => {
              setActiveScope('book');
              setFormScope('book');
            }}
            className={`flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-md font-medium transition-colors cursor-pointer ${
              activeScope === 'book'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Truyện này ({bookEntries.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveScope('global');
              setFormScope('global');
            }}
            className={`flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-md font-medium transition-colors cursor-pointer ${
              activeScope === 'global'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Mọi truyện ({globalEntries.length})</span>
          </button>
        </div>
        <p className="text-[10px] text-neutral-500 mt-1.5 px-1">
          {activeScope === 'book'
            ? 'Ưu tiên áp dụng cho truyện đang đọc (ghi đè mục trùng từ gốc ở phạm vi Mọi truyện).'
            : 'Từ điển dùng chung cho toàn bộ truyện khi dịch và đọc.'}
        </p>
      </div>

      {/* Top Bar: Add & Import/Export */}
      <div className="p-2.5 border-b border-neutral-800 bg-neutral-900 flex items-center justify-between gap-2">
        <button
          onClick={() => {
            setFormScope(activeScope);
            setIsAdding(!isAdding);
          }}
          className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isAdding ? 'Đóng form' : 'Thêm mục từ'}</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors cursor-pointer"
          title={`Nhập từ điển (.TXT A=B hoặc .JSON) vào phạm vi ${
            activeScope === 'global' ? 'Mọi truyện' : 'Truyện này'
          }`}
        >
          <Upload className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.json"
          className="hidden"
          onChange={handleImportFile}
        />

        <button
          onClick={handleExportTxt}
          disabled={currentScopeEntries.length === 0}
          className="p-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-300 rounded-lg transition-colors cursor-pointer"
          title={`Xuất từ điển phạm vi ${
            activeScope === 'global' ? 'Mọi truyện' : 'Truyện này'
          } (.TXT)`}
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* Add Entry Form Drawer */}
      {isAdding && (
        <div className="p-3 bg-neutral-950 border-b border-neutral-800 space-y-2.5 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">Từ gốc *</label>
              <input
                type="text"
                value={original}
                onChange={(e) => setOriginal(e.target.value)}
                placeholder="Nhập từ gốc..."
                className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">Cách gọi / Nghĩa *</label>
              <input
                type="text"
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
                placeholder="Nhập nghĩa hoặc cách gọi..."
                className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">Phân loại</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as DictionaryEntryType)}
                className="w-full px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-300 focus:outline-none"
              >
                <option value="character">Nhân vật</option>
                <option value="location">Địa danh</option>
                <option value="pronoun">Xưng hô</option>
                <option value="term">Thuật ngữ</option>
                <option value="replace">Thay thế từ</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-neutral-400 mb-1">Phạm vi lưu</label>
              <select
                value={formScope}
                onChange={(e) => setFormScope(e.target.value as DictionaryScope)}
                className="w-full px-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-300 focus:outline-none"
              >
                <option value="book">Truyện này</option>
                <option value="global">Mọi truyện</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-neutral-400 mb-1">Ghi chú (tùy chọn)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú thêm..."
              className="w-full px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            onClick={handleSaveEntry}
            disabled={!original.trim()}
            className="w-full py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded font-medium transition-colors cursor-pointer"
          >
            Lưu vào từ điển ({formScope === 'global' ? 'Mọi truyện' : 'Truyện này'})
          </button>
        </div>
      )}

      {/* Filter Chips */}
      <div className="p-2 border-b border-neutral-800 flex items-center space-x-1 overflow-x-auto text-[11px]">
        {(['all', 'character', 'location', 'pronoun', 'term', 'replace'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-2 py-0.5 rounded whitespace-nowrap transition-colors cursor-pointer ${
              filterType === t
                ? 'bg-amber-600/20 text-amber-400 font-semibold border border-amber-500/30'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {t === 'all' ? 'Tất cả' : typeLabels[t]}
          </button>
        ))}
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center text-xs text-neutral-500 px-4">
            <BookA className="w-8 h-8 text-neutral-700 mb-2" />
            <p>
              {activeScope === 'global'
                ? 'Chưa có mục từ dùng chung.'
                : 'Chưa có mục từ riêng cho truyện này.'}
            </p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`p-2.5 rounded-lg border text-xs transition-colors ${
                item.enabled
                  ? 'bg-neutral-950 border-neutral-800'
                  : 'bg-neutral-950/40 border-neutral-900 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center flex-wrap gap-1.5">
                    <span className="font-semibold text-neutral-200 break-all">{item.original}</span>
                    <span className="text-neutral-500">→</span>
                    <span className="font-semibold text-amber-400 break-all">{item.replacement}</span>
                  </div>
                  <div className="flex items-center flex-wrap gap-1.5 mt-1 text-[10px] text-neutral-500">
                    <span className="px-1.5 py-0.2 rounded bg-neutral-900 text-neutral-400">
                      {typeLabels[item.type]}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-neutral-900 text-neutral-400">
                      {item.bookId === GLOBAL_DICTIONARY_BOOK_ID ? 'Mọi truyện' : 'Truyện này'}
                    </span>
                    {item.note && <span className="italic">({item.note})</span>}
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => handleToggleEntry(item)}
                    className="p-1 text-neutral-400 hover:text-amber-400 cursor-pointer"
                    title={item.enabled ? 'Đang bật' : 'Đang tắt'}
                  >
                    {item.enabled ? (
                      <ToggleRight className="w-4 h-4 text-amber-500" />
                    ) : (
                      <ToggleLeft className="w-4 h-4 text-neutral-600" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteEntry(item.id)}
                    className="p-1 text-neutral-500 hover:text-red-400 cursor-pointer"
                    title="Xóa mục này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
