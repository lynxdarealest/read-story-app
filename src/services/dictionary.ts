import { DictionaryEntry, DictionaryEntryType } from '../types';

export interface ProcessedTextSegment {
  text: string;
  isReplaced?: boolean;
  originalText?: string;
  replacement?: string;
  entryType?: DictionaryEntryType;
  note?: string;
}

// Escape HTML special characters safely before injecting into dangerouslySetInnerHTML
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Escape regex special chars
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Merge global (__global__) and book-specific dictionary entries.
 * - Filters only enabled entries with non-empty original phrases.
 * - Book-specific entries override global entries when `original.trim()` matches.
 * - Sorted longest-first so overlapping terms match the longest phrase first.
 */
export function mergeDictionariesByPrecedence(
  globalEntries: DictionaryEntry[],
  bookEntries: DictionaryEntry[]
): DictionaryEntry[] {
  const byOriginal = new Map<string, DictionaryEntry>();

  for (const entry of globalEntries) {
    const key = entry.original.trim();
    if (entry.enabled && key.length > 0) {
      byOriginal.set(key, { ...entry, original: key });
    }
  }

  for (const entry of bookEntries) {
    const key = entry.original.trim();
    if (entry.enabled && key.length > 0) {
      byOriginal.set(key, { ...entry, original: key });
    }
  }

  return Array.from(byOriginal.values()).sort(
    (a, b) => b.original.length - a.original.length
  );
}

/**
 * Deterministic fingerprint for a merged active dictionary list.
 */
export function computeDictionarySignature(entries: DictionaryEntry[]): string {
  if (entries.length === 0) return 'empty';
  return entries
    .map((e) => `${e.original}=>${e.replacement}`)
    .sort()
    .join('\u0001');
}

/**
 * Apply dictionary replacements to raw text and return XSS-safe HTML.
 * - Uses single-pass combined regex sorted longest-first to handle overlapping terms without colliding.
 * - Escapes HTML in both plain segments and highlighted spans.
 */
export function applyDictionaryToText(
  text: string,
  entries: DictionaryEntry[],
  highlightMode = true
): string {
  const byOriginal = new Map<string, DictionaryEntry>();
  for (const e of entries) {
    const key = e.original.trim();
    if (e.enabled && key.length > 0) {
      byOriginal.set(key, { ...e, original: key });
    }
  }

  const activeEntries = Array.from(byOriginal.values()).sort(
    (a, b) => b.original.length - a.original.length
  );

  if (activeEntries.length === 0) {
    return escapeHtml(text);
  }

  const pattern = activeEntries.map((e) => escapeRegExp(e.original)).join('|');
  const combinedRegex = new RegExp(pattern, 'g');

  if (!highlightMode) {
    const replaced = text.replace(combinedRegex, (matched) => {
      const entry = byOriginal.get(matched);
      return entry ? entry.replacement : matched;
    });
    return escapeHtml(replaced);
  }

  // Build HTML incrementally in a single pass so neither plain text nor spans collide
  let out = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out += escapeHtml(text.slice(lastIndex, match.index));
    }
    const matchedText = match[0];
    const entry = byOriginal.get(matchedText);
    if (entry) {
      const tooltipText = escapeHtml(
        `${entry.original} → ${entry.replacement}${entry.note ? ` (${entry.note})` : ''}`
      );
      const safeReplacement = escapeHtml(entry.replacement);
      out += `<span class="dict-replaced font-medium text-amber-500 underline decoration-amber-400 decoration-dotted cursor-help" title="${tooltipText}">${safeReplacement}</span>`;
    } else {
      out += escapeHtml(matchedText);
    }
    lastIndex = match.index + matchedText.length;
  }

  if (lastIndex < text.length) {
    out += escapeHtml(text.slice(lastIndex));
  }

  return out;
}

/**
 * Export dictionary entries to VietPhrase / VBook compatible TXT format (A=B)
 */
export function exportDictionaryToTxt(entries: DictionaryEntry[]): string {
  return entries
    .map((e) => `${e.original}=${e.replacement}${e.note ? `\t# ${e.note}` : ''}`)
    .join('\n');
}

/**
 * Parse VietPhrase / VBook compatible TXT format (A=B)
 */
export function parseDictionaryFromTxt(
  txtContent: string,
  bookId: string,
  defaultType: DictionaryEntryType = 'replace'
): DictionaryEntry[] {
  const lines = txtContent.split('\n');
  const results: DictionaryEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    let note = '';
    let cleanLine = line;

    if (line.includes('\t#')) {
      const parts = line.split('\t#');
      cleanLine = parts[0].trim();
      note = parts[1]?.trim() || '';
    } else if (line.includes('//')) {
      const parts = line.split('//');
      cleanLine = parts[0].trim();
      note = parts[1]?.trim() || '';
    }

    const eqIndex = cleanLine.indexOf('=');
    if (eqIndex !== -1) {
      const original = cleanLine.slice(0, eqIndex).trim();
      const replacement = cleanLine.slice(eqIndex + 1).trim();

      if (original) {
        results.push({
          id: `dict-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          bookId,
          type: defaultType,
          original,
          replacement: replacement || original,
          note: note || undefined,
          enabled: true,
        });
      }
    }
  }

  return results;
}
