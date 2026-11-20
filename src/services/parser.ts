import JSZip from 'jszip';
import { Chapter, ChapterSplitRule, BookFormat } from '../types';

export const DEFAULT_CHAPTER_RULES: ChapterSplitRule[] = [
  {
    id: 'vietnamese-standard',
    name: 'Tiêu chuẩn Tiếng Việt (Chương, Hồi, Quyển, Tiết)',
    pattern: '(?:^|\\n)\\s*(?:Hồi|Chương|Quyển|Tiết|Mục|Bài)\\s+([0-9IVXLCDMivxlcdm一二三四五六七八九十百千万]+|[0-9]+)\\s*[:：.-]?\\s*([^\\n]{0,100})',
    flags: 'i',
    example: 'Chương 1: Khởi đầu mới | Hồi thứ 12: Đại náo',
  },
  {
    id: 'chinese-qt',
    name: 'Truyện chữ / QT / Tiên hiệp (Chương, Đệ, Hồi)',
    pattern: '(?:^|\\n)\\s*(?:第\\s*[0-9一二三四五六七八九十百千万]+\\s*[章回节卷]|Chương\\s+[0-9]+|Hồi\\s+[0-9]+|Đệ\\s+[0-9]+\\s*chương)\\s*[:：.-]?\\s*([^\\n]{0,100})',
    flags: 'i',
    example: 'Chương 123: Đột phá Trúc Cơ | 第5章 逆天改命',
  },
  {
    id: 'english-format',
    name: 'Tiếng Anh (Chapter, Book, Part)',
    pattern: '(?:^|\\n)\\s*(?:Chapter|Book|Part|Act|Volume)\\s+([0-9IVXLCDM]+|[0-9]+)\\s*[:：.-]?\\s*([^\\n]{0,100})',
    flags: 'i',
    example: 'Chapter 1: The Beginning | Part II: The Journey',
  },
  {
    id: 'numeric-prefix',
    name: 'Số thứ tự đầu dòng (1. 2. 3...)',
    pattern: '(?:^|\\n)\\s*([0-9]{1,4})\\s*[.、\\s-]\\s*([^\\n]{2,80})',
    flags: 'i',
    example: '1. Mở màn | 2. Gặp gỡ bất ngờ',
  },
];

export interface ParsedBookDraft {
  title: string;
  author: string;
  description: string;
  coverUrl?: string;
  format: BookFormat;
  sourceFileName: string;
  fileSize: number;
  rawText?: string;
  chapters: Array<{
    title: string;
    wordCount: number;
    content: string;
  }>;
}

export interface RegexTestResult {
  isValid: boolean;
  error?: string;
  matchCount: number;
  sampleMatches: Array<{
    index: number;
    lineNumber: number;
    text: string;
  }>;
}

// Read raw text with multiple encoding fallbacks
export async function readFileAsText(file: File, selectedEncoding = 'auto'): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // If user forced encoding
  if (selectedEncoding !== 'auto') {
    try {
      const decoder = new TextDecoder(selectedEncoding);
      return decoder.decode(bytes);
    } catch {
      // Fallback to utf-8 if encoding not supported
    }
  }

  // Auto detection
  // 1. Try UTF-8 first (strict fatal flag to check if valid UTF-8)
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    return utf8Decoder.decode(bytes);
  } catch {
    // UTF-8 failed, test UTF-16LE or Windows-1258 / GBK
  }

  // 2. Check UTF-16 BOM
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      return new TextDecoder('utf-16le').decode(bytes);
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return new TextDecoder('utf-16be').decode(bytes);
    }
  }

  // 3. Fallback to Windows-1258 (Vietnamese ANSI) or GBK
  try {
    return new TextDecoder('windows-1258').decode(bytes);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}

// Count Vietnamese/English/CJK words
export function countWords(text: string): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const matches = trimmed.match(/\S+/g);
  const spaceCount = matches ? matches.length : 0;
  if (spaceCount < trimmed.length / 8) {
    return trimmed.replace(/\s+/g, '').length;
  }
  return spaceCount;
}

// Test a custom regular expression against text with detailed diagnostics
export function testRegexPattern(
  pattern: string,
  flags = 'gi',
  text: string
): RegexTestResult {
  if (!pattern || !pattern.trim()) {
    return {
      isValid: false,
      error: 'Biểu thức chính quy không được để trống.',
      matchCount: 0,
      sampleMatches: [],
    };
  }

  const effectiveFlags = flags.includes('g') ? flags : flags + 'g';
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, effectiveFlags);
  } catch (err: any) {
    return {
      isValid: false,
      error: err.message || 'Cú pháp RegEx không hợp lệ.',
      matchCount: 0,
      sampleMatches: [],
    };
  }

  const cleanedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const sampleMatches: Array<{ index: number; lineNumber: number; text: string }> = [];
  let matchCount = 0;
  let m: RegExpExecArray | null;

  // Track line numbers
  const lineBreaks: number[] = [];
  for (let i = 0; i < cleanedText.length; i++) {
    if (cleanedText[i] === '\n') {
      lineBreaks.push(i);
    }
  }

  const getLineNumber = (charIndex: number): number => {
    let low = 0;
    let high = lineBreaks.length - 1;
    let line = 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lineBreaks[mid] < charIndex) {
        line = mid + 2;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return line;
  };

  try {
    while ((m = regex.exec(cleanedText)) !== null) {
      matchCount++;
      if (sampleMatches.length < 50) {
        const fullMatch = m[0].trim();
        const startChar = m.index + (m[0].indexOf(fullMatch));
        sampleMatches.push({
          index: startChar,
          lineNumber: getLineNumber(startChar),
          text: fullMatch.slice(0, 80),
        });
      }
      // Safety guard against infinite loops on zero-length matches
      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }
  } catch (err: any) {
    return {
      isValid: false,
      error: 'Lỗi thực thi: ' + (err.message || 'Timeout / Lỗi lặp'),
      matchCount,
      sampleMatches,
    };
  }

  return {
    isValid: true,
    matchCount,
    sampleMatches,
  };
}

// Split TXT content by regex rule
export function splitTextByRule(
  rawText: string,
  rulePattern: string,
  ruleFlags = 'gi',
  bookTitleFallback = 'Chương mở đầu'
): Array<{ title: string; content: string; wordCount: number }> {
  const cleanedText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  let regex: RegExp;
  try {
    regex = new RegExp(rulePattern, ruleFlags.includes('g') ? ruleFlags : ruleFlags + 'g');
  } catch {
    // If user typed invalid regex, use default
    regex = new RegExp(DEFAULT_CHAPTER_RULES[0].pattern, 'gi');
  }

  const matches: Array<{ index: number; fullMatch: string; title: string }> = [];
  let m: RegExpExecArray | null;

  while ((m = regex.exec(cleanedText)) !== null) {
    // The match could start with a newline, trim it for clean title
    const fullMatch = m[0].trim();
    matches.push({
      index: m.index + (m[0].indexOf(fullMatch)),
      fullMatch,
      title: fullMatch,
    });
  }

  // If no matches found, return whole text as one chapter or split by word blocks
  if (matches.length === 0) {
    const wordCount = countWords(cleanedText);
    // If text is very long (> 6,000 words), split into comfortable chunks
    if (wordCount > 6000) {
      return splitIntoChunks(cleanedText, 3500);
    }
    return [
      {
        title: bookTitleFallback || 'Toàn bộ nội dung',
        content: cleanedText.trim(),
        wordCount,
      },
    ];
  }

  const chapters: Array<{ title: string; content: string; wordCount: number }> = [];

  // Preamble before first chapter (e.g. Introduction, prologue)
  if (matches[0].index > 0) {
    const preambleText = cleanedText.slice(0, matches[0].index).trim();
    if (preambleText.length > 50) {
      chapters.push({
        title: 'Lời giới thiệu / Mở đầu',
        content: preambleText,
        wordCount: countWords(preambleText),
      });
    }
  }

  // Iterate over matches
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const startIndex = current.index;
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : cleanedText.length;
    
    // Chapter content is between current match and next match
    const slice = cleanedText.slice(startIndex, nextIndex).trim();
    
    // First line of slice is usually the chapter title
    const firstLineEnd = slice.indexOf('\n');
    let title = current.title;
    let body = slice;

    if (firstLineEnd !== -1) {
      title = slice.slice(0, firstLineEnd).trim();
      body = slice.slice(firstLineEnd + 1).trim();
    }

    // Clean up title
    if (title.length > 100) {
      title = title.slice(0, 100) + '...';
    }

    chapters.push({
      title: title || `Chương ${i + 1}`,
      content: body || 'Nội dung đang cập nhật...',
      wordCount: countWords(body),
    });
  }

  return chapters;
}

// Split large text into word-based chunks if no headers exist
function splitIntoChunks(text: string, targetWordsPerChunk = 3500): Array<{ title: string; content: string; wordCount: number }> {
  const paragraphs = text.split('\n');
  const chapters: Array<{ title: string; content: string; wordCount: number }> = [];
  let currentChunk: string[] = [];
  let currentWords = 0;
  let chunkIndex = 1;

  for (const para of paragraphs) {
    const pWords = countWords(para);
    currentChunk.push(para);
    currentWords += pWords;

    if (currentWords >= targetWordsPerChunk) {
      const content = currentChunk.join('\n').trim();
      chapters.push({
        title: `Phần ${chunkIndex}`,
        content,
        wordCount: currentWords,
      });
      chunkIndex++;
      currentChunk = [];
      currentWords = 0;
    }
  }

  if (currentChunk.length > 0) {
    const content = currentChunk.join('\n').trim();
    chapters.push({
      title: `Phần ${chunkIndex}`,
      content,
      wordCount: countWords(content),
    });
  }

  return chapters;
}

// EPUB Parser
export async function parseEpubFile(file: File): Promise<ParsedBookDraft> {
  const zip = await JSZip.loadAsync(file);

  // 1. Locate container.xml
  const containerXmlStr = await zip.file('META-INF/container.xml')?.async('text');
  if (!containerXmlStr) {
    throw new Error('File EPUB không đúng cấu trúc (thiếu META-INF/container.xml)');
  }

  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXmlStr, 'application/xml');
  const rootfile = containerDoc.querySelector('rootfile');
  const opfPath = rootfile?.getAttribute('full-path') || 'content.opf';
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

  // 2. Read OPF file
  const opfStr = await zip.file(opfPath)?.async('text');
  if (!opfStr) {
    throw new Error(`Không tìm thấy file OPF tại: ${opfPath}`);
  }

  const opfDoc = parser.parseFromString(opfStr, 'application/xml');

  // Metadata
  const title = opfDoc.querySelector('title')?.textContent?.trim() || file.name.replace(/\.[^/.]+$/, '');
  const author = opfDoc.querySelector('creator')?.textContent?.trim() || 'Khuyết danh';
  const description = opfDoc.querySelector('description')?.textContent?.trim() || '';

  // Manifest items
  const manifestItems: Record<string, { href: string; mediaType: string }> = {};
  opfDoc.querySelectorAll('manifest > item').forEach((item) => {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    const mediaType = item.getAttribute('media-type');
    if (id && href && mediaType) {
      manifestItems[id] = { href, mediaType };
    }
  });

  // Extract cover image if available
  let coverUrl: string | undefined;
  const coverMeta = opfDoc.querySelector('meta[name="cover"]');
  const coverItemId = coverMeta?.getAttribute('content');
  if (coverItemId && manifestItems[coverItemId]) {
    const coverPath = opfDir + manifestItems[coverItemId].href;
    const coverFile = zip.file(coverPath);
    if (coverFile) {
      const coverBase64 = await coverFile.async('base64');
      coverUrl = `data:${manifestItems[coverItemId].mediaType};base64,${coverBase64}`;
    }
  }

  // Spine items in reading order
  const spineItemRefs = Array.from(opfDoc.querySelectorAll('spine > itemref'))
    .map((el) => el.getAttribute('idref'))
    .filter(Boolean) as string[];

  // Chapters list
  const chapters: Array<{ title: string; wordCount: number; content: string }> = [];

  for (let i = 0; i < spineItemRefs.length; i++) {
    const idref = spineItemRefs[i];
    const manifestItem = manifestItems[idref];
    if (!manifestItem) continue;

    const filePath = opfDir + manifestItem.href;
    const chapterFile = zip.file(filePath);
    if (!chapterFile) continue;

    const htmlStr = await chapterFile.async('text');
    const doc = parser.parseFromString(htmlStr, 'text/html');

    // Extract title
    let chapterTitle = doc.querySelector('h1, h2, h3, title')?.textContent?.trim();
    if (!chapterTitle) {
      chapterTitle = `Chương ${chapters.length + 1}`;
    }

    // Clean body text / paragraphs
    const bodyEl = doc.body;
    let cleanText = '';
    if (bodyEl) {
      // Collect paragraphs
      const pElements = Array.from(bodyEl.querySelectorAll('p, div, h1, h2, h3, h4, blockquote'));
      if (pElements.length > 0) {
        cleanText = pElements
          .map((el) => el.textContent?.trim())
          .filter((t) => t && t.length > 0)
          .join('\n\n');
      } else {
        cleanText = bodyEl.textContent?.trim() || '';
      }
    }

    if (cleanText.length > 20) {
      chapters.push({
        title: chapterTitle,
        wordCount: countWords(cleanText),
        content: cleanText,
      });
    }
  }

  if (chapters.length === 0) {
    chapters.push({
      title: title,
      wordCount: 0,
      content: 'Không tìm thấy nội dung văn bản trong file EPUB này.',
    });
  }

  return {
    title,
    author,
    description,
    coverUrl,
    format: 'EPUB',
    sourceFileName: file.name,
    fileSize: file.size,
    chapters,
  };
}

// HTML / Markdown parser
export async function parseHtmlOrMdFile(file: File): Promise<ParsedBookDraft> {
  const text = await readFileAsText(file);
  const title = file.name.replace(/\.[^/.]+$/, '');
  const chapters = splitTextByRule(text, DEFAULT_CHAPTER_RULES[0].pattern, 'gi', title);

  return {
    title,
    author: 'Khuyết danh',
    description: '',
    format: file.name.endsWith('.md') ? 'MD' : 'HTML',
    sourceFileName: file.name,
    fileSize: file.size,
    chapters,
  };
}
