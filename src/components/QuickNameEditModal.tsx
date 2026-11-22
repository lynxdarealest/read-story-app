import React from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Save,
  Copy,
  Check,
  Search,
  Languages,
  Settings,
  Play,
  Edit3,
  Plus,
  Highlighter,
  FileText,
  Loader2,
  CaseSensitive,
} from 'lucide-react';
import { DictionaryEntry, Highlight } from '../types';
import {
  alignVietnameseToChinese,
  containsCjk,
  expandSelectionInParagraph,
  lookupChinesePhraseOnline,
  toEnglishNameSuggestion,
  toHanViet,
} from '../services/chineseTools';

export type QuickReplaceScope = 'chapter' | 'once';
export type QuickDictScope = 'book' | 'global';

interface QuickNameEditModalProps {
  position: { x: number; y: number } | null;
  selectedText: string;
  paragraphIndex: number;
  displayedParagraph: string;
  sourceParagraph: string;
  selectionStartInPara: number;
  selectionEndInPara: number;
  isViewingTranslation: boolean;
  dictionaries: DictionaryEntry[];
  onUpdateSelection: (next: {
    text: string;
    startInPara: number;
    endInPara: number;
  }) => void;
  onApplyValue: (params: {
    oldText: string;
    newText: string;
    scope: QuickReplaceScope;
    paragraphIndex: number;
    startInPara: number;
    endInPara: number;
  }) => Promise<void> | void;
  onSaveDictionary: (params: {
    originalZh: string;
    oldDisplayedText: string;
    replacement: string;
    dictScope: QuickDictScope;
    replaceScope: QuickReplaceScope;
    paragraphIndex: number;
    startInPara: number;
    endInPara: number;
  }) => Promise<void> | void;
  onOpenDictionaryManager: () => void;
  onOpenInlineParagraphEdit: () => void;
  onSearchInBook: (query: string) => void;
  onSpeakPhrase: (text: string) => void;
  onHighlight: (color: Highlight['color'], text: string) => void;
  onAddNote: (text: string) => void;
  onClose: () => void;
}

export const QuickNameEditModal: React.FC<QuickNameEditModalProps> = ({
  position,
  selectedText,
  paragraphIndex,
  displayedParagraph,
  sourceParagraph,
  selectionStartInPara,
  selectionEndInPara,
  isViewingTranslation,
  dictionaries,
  onUpdateSelection,
  onApplyValue,
  onSaveDictionary,
  onOpenDictionaryManager,
  onOpenInlineParagraphEdit,
  onSearchInBook,
  onSpeakPhrase,
  onHighlight,
  onAddNote,
  onClose,
}) => {
  const [zhValue, setZhValue] = React.useState('');
  const [viValue, setViValue] = React.useState('');
  const [hvValue, setHvValue] = React.useState('');
  const [engValue, setEngValue] = React.useState('');

  const [hvUppercase, setHvUppercase] = React.useState(true);
  const [replaceScope, setReplaceScope] = React.useState<QuickReplaceScope>('chapter');
  const [dictScope, setDictScope] = React.useState<QuickDictScope>('book');

  const [isLookingUp, setIsLookingUp] = React.useState(false);
  const [copiedZh, setCopiedZh] = React.useState(false);
  const [showHighlightColors, setShowHighlightColors] = React.useState(false);
  const [lastActiveRow, setLastActiveRow] = React.useState<'vi' | 'hv' | 'eng'>('hv');
  const [manualEdits, setManualEdits] = React.useState<{
    vi: boolean;
    hv: boolean;
    eng: boolean;
  }>({ vi: false, hv: false, eng: false });
  const manualEditsRef = React.useRef(manualEdits);
  React.useEffect(() => {
    manualEditsRef.current = manualEdits;
  }, [manualEdits]);

  // Draggable offset so user can reposition if desired
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const dragStartRef = React.useRef<{ mouseX: number; mouseY: number; origX: number; origY: number } | null>(null);

  React.useEffect(() => {
    setDragOffset({ x: 0, y: 0 });
  }, [position?.x, position?.y]);

  // Re-align & recompute 4 rows whenever the selected phrase or offsets change
  React.useEffect(() => {
    const cleanSel = selectedText.trim();
    if (!cleanSel) return;

    const aligned = alignVietnameseToChinese({
      selectedVi: cleanSel,
      viParagraph: displayedParagraph,
      selectionStartInPara,
      selectionEndInPara,
      zhParagraph: sourceParagraph || displayedParagraph,
      dictionaries,
    });

    const nextZh = aligned.zhPhrase || (containsCjk(cleanSel) ? cleanSel : '');
    setZhValue(nextZh);
    setViValue(cleanSel);
    setHvValue(nextZh ? toHanViet(nextZh, hvUppercase) : toHanViet(cleanSel, hvUppercase));
    setEngValue(nextZh ? toEnglishNameSuggestion(nextZh) : toEnglishNameSuggestion(cleanSel));
    setManualEdits({ vi: false, hv: false, eng: false });
  }, [selectedText, displayedParagraph, sourceParagraph, selectionStartInPara, selectionEndInPara, dictionaries]);

  // Reformat HanViet when toggling Aa uppercase/lowercase if user hasn't manually overwritten hvValue
  const handleToggleHvCase = () => {
    const nextCap = !hvUppercase;
    setHvUppercase(nextCap);
    const basis = zhValue.trim() || viValue.trim();
    if (basis) {
      setHvValue(toHanViet(basis, nextCap));
    }
  };

  // Update HanViet & Name Eng automatically when user edits Tiếng Trung input directly
  const handleZhInputChange = (nextZh: string) => {
    setZhValue(nextZh);
    setHvValue(toHanViet(nextZh, hvUppercase));
    setEngValue(toEnglishNameSuggestion(nextZh));
    setManualEdits((prev) => ({ ...prev, hv: false, eng: false }));
  };

  // Background lookup for cleaner Name Eng (never overwrites user manual edits)
  React.useEffect(() => {
    const cleanZh = zhValue.trim();
    if (!cleanZh || !containsCjk(cleanZh)) return;

    const controller = new AbortController();
    let cancelled = false;

    lookupChinesePhraseOnline(cleanZh, controller.signal).then((res) => {
      if (cancelled) return;
      if (res.nameEng && !manualEditsRef.current.eng) {
        setEngValue(res.nameEng);
      }
      // If user selected raw Chinese (no translation yet), fill Tiếng Việt suggestion
      if (res.vi && !isViewingTranslation && !manualEditsRef.current.vi && containsCjk(selectedText)) {
        setViValue(res.vi);
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [zhValue, isViewingTranslation, selectedText]);

  const handleManualLookupOnline = async () => {
    const targetZh = zhValue.trim();
    if (!targetZh) return;
    setIsLookingUp(true);
    try {
      const res = await lookupChinesePhraseOnline(targetZh);
      if (res.vi) {
        setViValue(res.vi);
        setManualEdits((prev) => ({ ...prev, vi: true }));
      }
      if (res.nameEng) {
        setEngValue(res.nameEng);
        setManualEdits((prev) => ({ ...prev, eng: true }));
      }
      setHvValue(toHanViet(targetZh, hvUppercase));
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleExpand = (direction: 'left' | 'right') => {
    const next = expandSelectionInParagraph({
      paragraph: displayedParagraph,
      startOffset: selectionStartInPara,
      endOffset: selectionEndInPara,
      direction,
    });
    if (next.text && next.text !== selectedText.trim()) {
      onUpdateSelection({
        text: next.text,
        startInPara: next.startOffset,
        endInPara: next.endOffset,
      });
    }
  };

  const handleDragMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      origX: dragOffset.x,
      origY: dragOffset.y,
    };

    const onMove = (ev: MouseEvent) => {
      if (!dragStartRef.current) return;
      setDragOffset({
        x: dragStartRef.current.origX + (ev.clientX - dragStartRef.current.mouseX),
        y: dragStartRef.current.origY + (ev.clientY - dragStartRef.current.mouseY),
      });
    };
    const onUp = () => {
      dragStartRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (!position || !selectedText.trim()) return null;

  const panelWidth = Math.min(400, window.innerWidth - 24);
  const estHeight = 310;
  const baseLeft = Math.max(
    12,
    Math.min(window.innerWidth - panelWidth - 12, position.x - panelWidth / 2)
  );
  const baseTop =
    position.y + 28 + estHeight > window.innerHeight - 12
      ? Math.max(12, position.y - estHeight - 12)
      : Math.max(12, position.y + 24);

  const highlightColors: Array<{ color: Highlight['color']; bg: string; title: string }> = [
    { color: 'yellow', bg: 'bg-amber-400', title: 'Vàng' },
    { color: 'green', bg: 'bg-emerald-400', title: 'Xanh lá' },
    { color: 'blue', bg: 'bg-sky-400', title: 'Xanh dương' },
    { color: 'pink', bg: 'bg-pink-400', title: 'Hồng' },
    { color: 'purple', bg: 'bg-purple-400', title: 'Tím' },
  ];

  const handleApplyRow = async (value: string) => {
    const cleanVal = value.trim();
    if (!cleanVal) return;
    await onApplyValue({
      oldText: selectedText.trim(),
      newText: cleanVal,
      scope: replaceScope,
      paragraphIndex,
      startInPara: selectionStartInPara,
      endInPara: selectionEndInPara,
    });
  };

  const handleSaveRow = async (value: string) => {
    const cleanVal = value.trim();
    if (!cleanVal) return;
    const origKey = zhValue.trim() || selectedText.trim();
    await onSaveDictionary({
      originalZh: origKey,
      oldDisplayedText: selectedText.trim(),
      replacement: cleanVal,
      dictScope,
      replaceScope,
      paragraphIndex,
      startInPara: selectionStartInPara,
      endInPara: selectionEndInPara,
    });
  };

  const activeAddValue =
    lastActiveRow === 'eng'
      ? engValue
      : lastActiveRow === 'vi'
      ? viValue
      : hvValue;

  return (
    <div
      className="fixed z-50 select-none animate-in fade-in zoom-in-95 duration-150"
      style={{
        left: `${baseLeft + dragOffset.x}px`,
        top: `${baseTop + dragOffset.y}px`,
        width: `${panelWidth}px`,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="rounded-xl overflow-hidden shadow-2xl border border-teal-500/40 bg-[#0d6f7d] text-white">
        {/* Top Row: Close | < Mở rộng | Mở rộng > | Close */}
        <div
          onMouseDown={handleDragMouseDown}
          className="flex items-stretch bg-[#0a7f8f] border-b border-teal-400/25 cursor-move text-xs font-semibold"
        >
          <button
            type="button"
            onClick={onClose}
            className="w-10 flex items-center justify-center bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer shrink-0"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => handleExpand('left')}
            disabled={selectionStartInPara <= 0}
            className="flex-1 flex items-center justify-center space-x-1 py-2 hover:bg-teal-600/60 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
            title="Mở rộng vùng chọn sang trái 1 từ"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Mở rộng</span>
          </button>

          <div className="w-px bg-teal-300/20" />

          <button
            type="button"
            onClick={() => handleExpand('right')}
            disabled={selectionEndInPara >= displayedParagraph.length}
            className="flex-1 flex items-center justify-center space-x-1 py-2 hover:bg-teal-600/60 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
            title="Mở rộng vùng chọn sang phải 1 từ"
          >
            <span>Mở rộng</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-10 flex items-center justify-center bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer shrink-0"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scope & Selected Preview Bar */}
        <div className="px-2.5 py-1.5 bg-[#095965] border-b border-teal-400/20 flex items-center justify-between gap-2 text-[11px]">
          <span className="truncate text-teal-100/90 font-medium max-w-[155px]" title={selectedText}>
            “{selectedText}”
          </span>

          <div className="flex items-center space-x-1 shrink-0">
            <button
              type="button"
              onClick={() => setReplaceScope((s) => (s === 'chapter' ? 'once' : 'chapter'))}
              className="px-2 py-0.5 rounded bg-teal-950/60 hover:bg-teal-900 border border-teal-400/30 text-teal-100 cursor-pointer whitespace-nowrap"
              title="Phạm vi khi bấm tích ✓"
            >
              {replaceScope === 'chapter' ? 'Áp dụng: Cả chương' : 'Áp dụng: 1 vị trí'}
            </button>
            <button
              type="button"
              onClick={() => setDictScope((d) => (d === 'book' ? 'global' : 'book'))}
              className="px-2 py-0.5 rounded bg-teal-950/60 hover:bg-teal-900 border border-teal-400/30 text-amber-200 cursor-pointer whitespace-nowrap"
              title="Phạm vi khi bấm lưu từ điển 💾"
            >
              {dictScope === 'book' ? 'Truyện này' : 'Mọi truyện'}
            </button>
          </div>
        </div>

        {/* 4 Core Rows: Trung | Việt | Hán Việt | Name Eng */}
        <div className="p-2 space-y-1.5 text-xs">
          {/* Row 1: Tiếng Trung */}
          <div className="flex items-center gap-1.5">
            <div className="w-16 shrink-0 h-8 rounded-l bg-emerald-800 border border-emerald-600/60 flex items-center justify-center text-[11px] font-bold text-emerald-50">
              Trung
            </div>
            <input
              type="text"
              value={zhValue}
              onChange={(e) => handleZhInputChange(e.target.value)}
              placeholder="Chữ Trung gốc..."
              className="flex-1 min-w-0 h-8 px-2 bg-white text-neutral-900 rounded-r border border-neutral-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 select-text"
            />
            <button
              type="button"
              onClick={handleManualLookupOnline}
              disabled={isLookingUp || !zhValue.trim()}
              className="w-8 h-8 rounded bg-teal-800/80 hover:bg-teal-700 disabled:opacity-40 flex items-center justify-center cursor-pointer shrink-0"
              title="Dịch / đối chiếu lại cụm tiếng Trung này"
            >
              {isLookingUp ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Languages className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                const textCopy = zhValue.trim() || selectedText.trim();
                navigator.clipboard.writeText(textCopy).catch(() => {});
                setCopiedZh(true);
                setTimeout(() => setCopiedZh(false), 900);
              }}
              className="w-8 h-8 rounded bg-teal-800/80 hover:bg-teal-700 flex items-center justify-center cursor-pointer shrink-0"
              title="Sao chép tiếng Trung"
            >
              {copiedZh ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => onSearchInBook(zhValue.trim() || selectedText.trim())}
              className="w-8 h-8 rounded bg-teal-800/80 hover:bg-teal-700 flex items-center justify-center cursor-pointer shrink-0"
              title="Tìm cụm từ này trong truyện"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Row 2: Tiếng Việt */}
          <div className="flex items-center gap-1.5">
            <div className="w-16 shrink-0 h-8 rounded-l bg-emerald-800 border border-emerald-600/60 flex items-center justify-center text-[11px] font-bold text-emerald-50">
              Việt
            </div>
            <input
              type="text"
              value={viValue}
              onFocus={() => setLastActiveRow('vi')}
              onChange={(e) => {
                setViValue(e.target.value);
                setManualEdits((prev) => ({ ...prev, vi: true }));
                setLastActiveRow('vi');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyRow(viValue);
                }
              }}
              placeholder="Nghĩa tiếng Việt / tự sửa..."
              className="flex-1 min-w-0 h-8 px-2 bg-white text-neutral-900 rounded-r border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 select-text"
            />
            <button
              type="button"
              onClick={() => handleApplyRow(viValue)}
              disabled={!viValue.trim()}
              className="w-8 h-8 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 flex items-center justify-center cursor-pointer shrink-0 shadow-xs"
              title="Tích: lập tức dùng dòng Tiếng Việt này"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
            </button>
            <button
              type="button"
              onClick={() => handleSaveRow(viValue)}
              disabled={!viValue.trim()}
              className="w-8 h-8 rounded bg-teal-800/80 hover:bg-teal-700 disabled:opacity-40 flex items-center justify-center cursor-pointer shrink-0"
              title="Lưu Tiếng Việt này vào Từ điển"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Row 3: Hán Việt */}
          <div className="flex items-center gap-1.5">
            <div className="w-16 shrink-0 h-8 rounded-l bg-emerald-800 border border-emerald-600/60 flex items-center justify-center text-[11px] font-bold text-emerald-50">
              Hán Việt
            </div>
            <div className="flex-1 min-w-0 flex items-center bg-white rounded-r border border-neutral-300 overflow-hidden focus-within:ring-2 focus-within:ring-amber-400">
              <input
                type="text"
                value={hvValue}
                onFocus={() => setLastActiveRow('hv')}
                onChange={(e) => {
                  setHvValue(e.target.value);
                  setManualEdits((prev) => ({ ...prev, hv: true }));
                  setLastActiveRow('hv');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyRow(hvValue);
                  }
                }}
                placeholder="Âm Hán Việt..."
                className="flex-1 min-w-0 h-8 px-2 bg-white text-neutral-900 text-xs focus:outline-none select-text"
              />
              <button
                type="button"
                onClick={handleToggleHvCase}
                className="h-8 px-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 border-l border-neutral-200 cursor-pointer shrink-0"
                title={hvUppercase ? 'Đang viết hoa đầu từ (bấm đổi chữ thường)' : 'Đang chữ thường (bấm viết hoa đầu từ)'}
              >
                <CaseSensitive className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleApplyRow(hvValue)}
              disabled={!hvValue.trim()}
              className="w-8 h-8 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 flex items-center justify-center cursor-pointer shrink-0 shadow-xs"
              title="Tích: lập tức dùng Name Hán Việt này"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
            </button>
            <button
              type="button"
              onClick={() => handleSaveRow(hvValue)}
              disabled={!hvValue.trim()}
              className="w-8 h-8 rounded bg-teal-800/80 hover:bg-teal-700 disabled:opacity-40 flex items-center justify-center cursor-pointer shrink-0"
              title="Lưu Name Hán Việt vào Từ điển"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Row 4: Name Eng */}
          <div className="flex items-center gap-1.5">
            <div className="w-16 shrink-0 h-8 rounded-l bg-emerald-800 border border-emerald-600/60 flex items-center justify-center text-[11px] font-bold text-emerald-50">
              Name Eng
            </div>
            <input
              type="text"
              value={engValue}
              onFocus={() => setLastActiveRow('eng')}
              onChange={(e) => {
                setEngValue(e.target.value);
                setManualEdits((prev) => ({ ...prev, eng: true }));
                setLastActiveRow('eng');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyRow(engValue);
                }
              }}
              placeholder="Tên / nghĩa tiếng Anh..."
              className="flex-1 min-w-0 h-8 px-2 bg-white text-neutral-900 rounded-r border border-neutral-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 select-text"
            />
            <button
              type="button"
              onClick={() => handleApplyRow(engValue)}
              disabled={!engValue.trim()}
              className="w-8 h-8 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 flex items-center justify-center cursor-pointer shrink-0 shadow-xs"
              title="Tích: lập tức dùng Name Eng này"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
            </button>
            <button
              type="button"
              onClick={() => handleSaveRow(engValue)}
              disabled={!engValue.trim()}
              className="w-8 h-8 rounded bg-teal-800/80 hover:bg-teal-700 disabled:opacity-40 flex items-center justify-center cursor-pointer shrink-0"
              title="Lưu Name Eng vào Từ điển"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Bottom Footer Actions */}
        <div className="px-2.5 py-2 bg-[#0a6370] border-t border-teal-400/20 flex items-center justify-between gap-1.5 text-xs">
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={onOpenDictionaryManager}
              className="flex items-center space-x-1 px-2 py-1 rounded hover:bg-teal-700/80 text-teal-50 font-medium cursor-pointer"
              title="Mở trình quản lý Từ điển"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Quản lý</span>
            </button>

            <button
              type="button"
              onClick={() => onSpeakPhrase(selectedText)}
              className="p-1.5 rounded hover:bg-teal-700/80 text-teal-50 cursor-pointer"
              title="Đọc thử cụm này"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>

            <button
              type="button"
              onClick={onOpenInlineParagraphEdit}
              className="flex items-center space-x-1 px-2 py-1 rounded hover:bg-teal-700/80 text-teal-50 font-medium cursor-pointer"
              title="Chỉnh sửa thủ công đoạn văn này"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Sửa đoạn</span>
            </button>
          </div>

          <div className="flex items-center space-x-1 relative">
            <button
              type="button"
              onClick={() => setShowHighlightColors((prev) => !prev)}
              className="p-1.5 rounded hover:bg-teal-700/80 text-teal-50 cursor-pointer"
              title="Tô sáng"
            >
              <Highlighter className="w-3.5 h-3.5" />
            </button>

            {showHighlightColors && (
              <div className="absolute right-12 bottom-full mb-1.5 p-1.5 bg-neutral-950 border border-neutral-700 rounded-lg shadow-xl flex items-center space-x-1.5 z-50">
                {highlightColors.map((c) => (
                  <button
                    key={c.color}
                    type="button"
                    onClick={() => {
                      onHighlight(c.color, selectedText.trim());
                      setShowHighlightColors(false);
                    }}
                    className={`w-4 h-4 rounded-full ${c.bg} hover:scale-125 transition-transform cursor-pointer`}
                    title={`Tô màu ${c.title}`}
                  />
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => onAddNote(selectedText.trim())}
              className="p-1.5 rounded hover:bg-teal-700/80 text-teal-50 cursor-pointer"
              title="Thêm ghi chú"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleSaveRow(activeAddValue)}
              disabled={!activeAddValue.trim()}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold cursor-pointer whitespace-nowrap"
              title="Lưu vào từ điển và thay thế trong chương"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm name</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
