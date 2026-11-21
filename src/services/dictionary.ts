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

const HIGHLIGHT_COLOR_CLASSES: Record<'yellow' | 'green' | 'blue' | 'pink' | 'purple', string> = {
  yellow: 'bg-amber-400/35 text-inherit rounded px-0.5 border-b border-amber-400/70',
  green: 'bg-emerald-400/30 text-inherit rounded px-0.5 border-b border-emerald-400/70',
  blue: 'bg-sky-400/30 text-inherit rounded px-0.5 border-b border-sky-400/70',
  pink: 'bg-pink-400/30 text-inherit rounded px-0.5 border-b border-pink-400/70',
  purple: 'bg-purple-400/30 text-inherit rounded px-0.5 border-b border-purple-400/70',
};

/**
 * Overlay saved text highlights onto already-escaped HTML (preserving existing <span> tags).
 */
export function applyHighlightsToHtml(
  safeHtml: string,
  highlights: Array<{ id: string; text: string; color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple' }>
): string {
  if (!safeHtml || !highlights || highlights.length === 0) return safeHtml;

  const uniqueMap = new Map<string, { id: string; escaped: string; color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple' }>();
  for (const hl of highlights) {
    const clean = hl.text.trim();
    if (!clean || clean.length < 2) continue;
    const escaped = escapeHtml(clean);
    if (!uniqueMap.has(escaped)) {
      uniqueMap.set(escaped, { id: hl.id, escaped, color: hl.color });
    }
  }

  const items = Array.from(uniqueMap.values()).sort((a, b) => b.escaped.length - a.escaped.length);
  if (items.length === 0) return safeHtml;

  const pattern = items.map((item) => escapeRegExp(item.escaped)).join('|');
  const regex = new RegExp(pattern, 'g');

  // Split by HTML tags so we only replace inside text nodes
  const parts = safeHtml.split(/(<[^>]+>)/g);
  for (let i = 0; i < parts.length; i += 2) {
    const segment = parts[i];
    if (!segment) continue;
    parts[i] = segment.replace(regex, (matched) => {
      const found = uniqueMap.get(matched);
      if (!found) return matched;
      const cls = HIGHLIGHT_COLOR_CLASSES[found.color] || HIGHLIGHT_COLOR_CLASSES.yellow;
      return `<mark data-hl-id="${escapeHtml(found.id)}" class="${cls}">${matched}</mark>`;
    });
  }

  return parts.join('');
}

/**
 * Export dictionary entries to VietPhrase compatible TXT format (A=B)
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
