export type BookStatus = 'unread' | 'reading' | 'completed' | 'favorite' | 'archived';

export type BookFormat = 'TXT' | 'EPUB' | 'HTML' | 'MD' | 'WEB';

export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  coverUrl?: string;
  format: BookFormat;
  totalChapters: number;
  currentChapterIndex: number;
  scrollProgress: number; // 0 to 1
  pageIndex?: number;
  lastReadTimestamp: number;
  addedTimestamp: number;
  status: BookStatus;
  fileSize: number;
  sourceFileName: string;
  sourceUrl?: string;
  rawTextBackup?: string; // Cached raw text for TXT/WEB files to allow re-parsing chapters anytime
  tags: string[];
}

export interface WebNovelChapterMeta {
  index: number;
  id: string;
  title: string;
  url: string;
  sourceType: 'pixiv-novel' | 'web-chapter' | 'inline';
  wordCount?: number;
  content?: string;
  tags?: string[];
  available?: boolean;
  requiresCookie?: boolean;
}

export interface WebNovelInspectResult {
  sourceType: 'pixiv-series' | 'pixiv-novel' | 'web-toc' | 'web-article';
  normalizedUrl: string;
  title: string;
  author: string;
  description: string;
  tags: string[];
  coverDataUrl?: string;
  chapters: WebNovelChapterMeta[];
  requiresCookie?: boolean;
  restrictionNotice?: string;
  seriesInfo?: {
    seriesId: string;
    title: string;
    url: string;
  };
}

export interface StoredCookieEntry {
  name: string;
  value: string;
  domain: string;
  path: string;
  expiresAt?: number;
  httpOnly?: boolean;
  secure?: boolean;
}

export interface SiteCookieJar {
  domain: string;
  cookies: StoredCookieEntry[];
  updatedAt: number;
}

export interface Chapter {
  id: string;
  bookId: string;
  chapterIndex: number;
  title: string;
  wordCount: number;
  content: string;
  originalContent?: string; // Pristine content from initial import for reset
  originalTitle?: string;
  lastEditedTimestamp?: number;
}

export interface ChapterTranslation {
  chapterId: string;
  bookId: string;
  chapterIndex: number;
  translatedTitle: string;
  translatedContent: string;
  sourceTitle: string;
  sourceContent: string;
  sourceHash: string;
  dictionarySignature?: string;
  provider: 'sangtacviet';
  translatedAt: number;
}

export interface ChapterVersion {
  id: string;
  chapterId: string;
  bookId: string;
  chapterIndex: number;
  title: string;
  content: string;
  timestamp: number;
  summary?: string;
}

export interface Bookmark {
  id: string;
  bookId: string;
  chapterIndex: number;
  chapterTitle: string;
  progressPercent: number;
  textSnippet: string;
  note?: string;
  createdAt: number;
}

export interface Highlight {
  id: string;
  bookId: string;
  chapterIndex: number;
  text: string;
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple';
  note?: string;
  createdAt: number;
}

export const GLOBAL_DICTIONARY_BOOK_ID = '__global__';

export type DictionaryEntryType = 'character' | 'location' | 'term' | 'pronoun' | 'replace';

export interface DictionaryEntry {
  id: string;
  bookId: string; // '__global__' for shared scope or book.id for book-specific scope
  type: DictionaryEntryType;
  original: string;
  replacement: string;
  note?: string;
  enabled: boolean;
}

export type StandardThemeId = 'light' | 'dark' | 'sepia' | 'paper' | 'eink' | 'oled' | 'nightblue';

export type ReaderFont = 
  | 'font-bevietnam'
  | 'font-literata'
  | 'font-merriweather'
  | 'font-lora'
  | 'font-system-serif'
  | 'font-system-sans';

export type ReadingMode = 'scroll' | 'continuous' | 'paginated' | 'two-column' | 'focus';

export interface CustomTheme {
  id: string;
  name: string;
  textColor: string;
  backgroundColor: string;
  backgroundImageUrl?: string;
  fontFamily: ReaderFont;
  fontSize: number;
  fontWeight: 'normal' | 'medium' | 'semibold';
  lineHeight: number;
  paragraphSpacing: number;
  containerWidth: 'compact' | 'medium' | 'wide' | 'full';
  textAlign: 'justify' | 'left' | 'center';
  textIndent: boolean;
}

export interface ReaderSettings {
  theme: string; // standard theme id or custom theme id
  textColor?: string;
  backgroundColor?: string;
  backgroundImageUrl?: string;
  fontFamily: ReaderFont;
  fontSize: number; // in px
  fontWeight: 'normal' | 'medium' | 'semibold';
  lineHeight: number;
  letterSpacing: number;
  paragraphSpacing: number;
  textIndent: boolean;
  textAlign: 'justify' | 'left' | 'center';
  containerWidth: 'compact' | 'medium' | 'wide' | 'full';
  readingMode: ReadingMode;
  autoScrollSpeed: number;
  tapToTurnPage?: boolean;
  wheelToTurnPage?: boolean;
  smoothScroll?: boolean;
  applyDictionary: boolean;
  highlightReplacements: boolean;
  customThemes: CustomTheme[];
  // TTS settings
  ttsVoiceURI: string;
  ttsRate: number;
  ttsPitch: number;
  ttsAutoNextChapter: boolean;
}

export interface ChapterSplitRule {
  id: string;
  name: string;
  pattern: string;
  flags: string;
  example: string;
}
