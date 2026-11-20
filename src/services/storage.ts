import {
  Book,
  Chapter,
  ChapterTranslation,
  Bookmark,
  Highlight,
  DictionaryEntry,
  ReaderSettings,
  ChapterVersion,
  SiteCookieJar,
  GLOBAL_DICTIONARY_BOOK_ID,
} from '../types';
import { countWords } from './parser';
import { mergeDictionariesByPrecedence } from './dictionary';

const DB_NAME = 'VBookDesktopDB';
const DB_VERSION = 4;

export const DEFAULT_SETTINGS: ReaderSettings = {
  theme: 'paper',
  fontFamily: 'font-literata',
  fontSize: 19,
  fontWeight: 'normal',
  lineHeight: 1.8,
  letterSpacing: 0,
  paragraphSpacing: 1.25,
  textIndent: true,
  textAlign: 'justify',
  containerWidth: 'medium',
  readingMode: 'scroll',
  autoScrollSpeed: 0,
  tapToTurnPage: true,
  wheelToTurnPage: true,
  smoothScroll: true,
  applyDictionary: true,
  highlightReplacements: true,
  customThemes: [
    {
      id: 'custom-emerald',
      name: 'Rừng thông',
      backgroundColor: '#0f1f17',
      textColor: '#d1e7dd',
      fontFamily: 'font-lora',
      fontSize: 19,
      fontWeight: 'normal',
      lineHeight: 1.85,
      paragraphSpacing: 1.2,
      containerWidth: 'medium',
      textAlign: 'justify',
      textIndent: true,
    },
    {
      id: 'custom-sunset',
      name: 'Hổ phách',
      backgroundColor: '#231812',
      textColor: '#edd6c8',
      fontFamily: 'font-merriweather',
      fontSize: 18,
      fontWeight: 'normal',
      lineHeight: 1.8,
      paragraphSpacing: 1.3,
      containerWidth: 'medium',
      textAlign: 'justify',
      textIndent: true,
    },
  ],
  ttsVoiceURI: '',
  ttsRate: 1.0,
  ttsPitch: 1.0,
  ttsAutoNextChapter: true,
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('books')) {
        const bookStore = db.createObjectStore('books', { keyPath: 'id' });
        bookStore.createIndex('status', 'status', { unique: false });
        bookStore.createIndex('lastReadTimestamp', 'lastReadTimestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains('chapters')) {
        const chapterStore = db.createObjectStore('chapters', { keyPath: 'id' });
        chapterStore.createIndex('bookId', 'bookId', { unique: false });
        chapterStore.createIndex('bookId_chapterIndex', ['bookId', 'chapterIndex'], { unique: true });
      }

      if (!db.objectStoreNames.contains('bookmarks')) {
        const bookmarkStore = db.createObjectStore('bookmarks', { keyPath: 'id' });
        bookmarkStore.createIndex('bookId', 'bookId', { unique: false });
      }

      if (!db.objectStoreNames.contains('highlights')) {
        const highlightStore = db.createObjectStore('highlights', { keyPath: 'id' });
        highlightStore.createIndex('bookId', 'bookId', { unique: false });
      }

      if (!db.objectStoreNames.contains('dictionaries')) {
        const dictStore = db.createObjectStore('dictionaries', { keyPath: 'id' });
        dictStore.createIndex('bookId', 'bookId', { unique: false });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('chapter_versions')) {
        const versionStore = db.createObjectStore('chapter_versions', { keyPath: 'id' });
        versionStore.createIndex('chapterId', 'chapterId', { unique: false });
        versionStore.createIndex('bookId', 'bookId', { unique: false });
        versionStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains('chapter_translations')) {
        const transStore = db.createObjectStore('chapter_translations', { keyPath: 'chapterId' });
        transStore.createIndex('bookId', 'bookId', { unique: false });
        transStore.createIndex('bookId_chapterIndex', ['bookId', 'chapterIndex'], { unique: false });
      }

      if (!db.objectStoreNames.contains('site_cookies')) {
        db.createObjectStore('site_cookies', { keyPath: 'domain' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

// Generic transaction helpers
async function executeTransaction<T>(
  storeNames: string[],
  mode: IDBTransactionMode,
  callback: (transaction: IDBTransaction) => Promise<T>
): Promise<T> {
  const db = await getDB();
  const tx = db.transaction(storeNames, mode);
  return callback(tx);
}

// Book operations
export async function getAllBooks(): Promise<Book[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('books', 'readonly');
    const store = tx.objectStore('books');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getBookById(id: string): Promise<Book | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('books', 'readonly');
    const store = tx.objectStore('books');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveBook(book: Book): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('books', 'readwrite');
    const store = tx.objectStore('books');
    const request = store.put(book);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteBook(bookId: string): Promise<void> {
  const db = await getDB();
  const targetStores = [
    'books',
    'chapters',
    'bookmarks',
    'highlights',
    'dictionaries',
    'chapter_versions',
    'chapter_translations',
  ].filter((name) => db.objectStoreNames.contains(name));

  if (targetStores.length === 0) return;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(targetStores, 'readwrite');

    if (targetStores.includes('books')) {
      tx.objectStore('books').delete(bookId);
    }

    const deleteByBookIdIndex = (storeName: string) => {
      if (!targetStores.includes(storeName)) return;
      const store = tx.objectStore(storeName);
      if (!store.indexNames.contains('bookId')) return;
      const index = store.index('bookId');
      const req = index.openCursor(IDBKeyRange.only(bookId));
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    };

    deleteByBookIdIndex('chapters');
    deleteByBookIdIndex('bookmarks');
    deleteByBookIdIndex('highlights');
    deleteByBookIdIndex('dictionaries');
    deleteByBookIdIndex('chapter_versions');
    deleteByBookIdIndex('chapter_translations');

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Không thể xóa truyện khỏi cơ sở dữ liệu'));
    tx.onabort = () => reject(tx.error || new Error('Thao tác xóa truyện bị hủy'));
  });
}

// Chapter operations
export async function getChaptersByBookId(bookId: string): Promise<Chapter[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chapters', 'readonly');
    const store = tx.objectStore('chapters');
    const index = store.index('bookId');
    const request = index.getAll(IDBKeyRange.only(bookId));
    request.onsuccess = () => {
      const list: Chapter[] = request.result || [];
      list.sort((a, b) => a.chapterIndex - b.chapterIndex);
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getChapter(bookId: string, chapterIndex: number): Promise<Chapter | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chapters', 'readonly');
    const store = tx.objectStore('chapters');
    const index = store.index('bookId_chapterIndex');
    const request = index.get([bookId, chapterIndex]);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveChapters(chapters: Chapter[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chapters', 'readwrite');
    const store = tx.objectStore('chapters');
    for (const chapter of chapters) {
      const normalizedChapter: Chapter = {
        ...chapter,
        originalContent: chapter.originalContent || chapter.content,
        originalTitle: chapter.originalTitle || chapter.title,
        wordCount: chapter.wordCount || countWords(chapter.content),
      };
      store.put(normalizedChapter);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function updateChapter(chapter: Chapter, createVersionSnapshot = false, versionSummary?: string): Promise<void> {
  const db = await getDB();
  const wordCount = countWords(chapter.content);
  const normalizedChapter: Chapter = {
    ...chapter,
    wordCount,
    lastEditedTimestamp: Date.now(),
    originalContent: chapter.originalContent || chapter.content,
    originalTitle: chapter.originalTitle || chapter.title,
  };

  return new Promise((resolve, reject) => {
    const stores = createVersionSnapshot ? ['chapters', 'chapter_versions'] : ['chapters'];
    const tx = db.transaction(stores, 'readwrite');
    const store = tx.objectStore('chapters');
    store.put(normalizedChapter);

    if (createVersionSnapshot) {
      const vStore = tx.objectStore('chapter_versions');
      const versionId = `v-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const snapshot: ChapterVersion = {
        id: versionId,
        chapterId: normalizedChapter.id,
        bookId: normalizedChapter.bookId,
        chapterIndex: normalizedChapter.chapterIndex,
        title: normalizedChapter.title,
        content: normalizedChapter.content,
        timestamp: Date.now(),
        summary: versionSummary || 'Đã chỉnh sửa nội dung',
      };
      vStore.put(snapshot);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function batchUpdateChapters(chapters: Chapter[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chapters', 'readwrite');
    const store = tx.objectStore('chapters');
    for (const ch of chapters) {
      const wordCount = ch.content.trim().split(/\s+/).filter(Boolean).length;
      store.put({
        ...ch,
        wordCount,
        lastEditedTimestamp: Date.now(),
        originalContent: ch.originalContent || ch.content,
        originalTitle: ch.originalTitle || ch.title,
      });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteChapterById(chapterId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['chapters', 'chapter_versions', 'chapter_translations'], 'readwrite');
    const store = tx.objectStore('chapters');
    store.delete(chapterId);
    tx.objectStore('chapter_translations').delete(chapterId);

    // Delete versions for this chapter
    const vStore = tx.objectStore('chapter_versions');
    const vIndex = vStore.index('chapterId');
    const vReq = vIndex.openCursor(IDBKeyRange.only(chapterId));
    vReq.onsuccess = () => {
      const cursor = vReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function replaceBookChapters(bookId: string, chapters: Chapter[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['chapters', 'chapter_translations'], 'readwrite');
    const store = tx.objectStore('chapters');
    const index = store.index('bookId');
    const req = index.openCursor(IDBKeyRange.only(bookId));
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        // Insert new chapters
        for (const ch of chapters) {
          const normalized: Chapter = {
            ...ch,
            originalContent: ch.originalContent || ch.content,
            originalTitle: ch.originalTitle || ch.title,
            wordCount: ch.wordCount || countWords(ch.content),
          };
          store.put(normalized);
        }
      }
    };

    const tStore = tx.objectStore('chapter_translations');
    const tIndex = tStore.index('bookId');
    const tReq = tIndex.openCursor(IDBKeyRange.only(bookId));
    tReq.onsuccess = () => {
      const cursor = tReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Chapter Translations (Separate store; never mutates original chapters)
export async function getChapterTranslation(chapterId: string): Promise<ChapterTranslation | undefined> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chapter_translations', 'readonly');
    const store = tx.objectStore('chapter_translations');
    const request = store.get(chapterId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getBookTranslations(bookId: string): Promise<ChapterTranslation[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chapter_translations', 'readonly');
    const store = tx.objectStore('chapter_translations');
    const index = store.index('bookId');
    const request = index.getAll(IDBKeyRange.only(bookId));
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function saveChapterTranslation(translation: ChapterTranslation): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chapter_translations', 'readwrite');
    const store = tx.objectStore('chapter_translations');
    const request = store.put(translation);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteChapterTranslation(chapterId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chapter_translations', 'readwrite');
    const store = tx.objectStore('chapter_translations');
    const request = store.delete(chapterId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Chapter Versions
export async function getChapterVersions(chapterId: string): Promise<ChapterVersion[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chapter_versions', 'readonly');
    const store = tx.objectStore('chapter_versions');
    const index = store.index('chapterId');
    const request = index.getAll(IDBKeyRange.only(chapterId));
    request.onsuccess = () => {
      const list: ChapterVersion[] = request.result || [];
      list.sort((a, b) => b.timestamp - a.timestamp);
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveChapterVersion(version: ChapterVersion): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chapter_versions', 'readwrite');
    const store = tx.objectStore('chapter_versions');
    const request = store.put(version);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteChapterVersion(versionId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chapter_versions', 'readwrite');
    const store = tx.objectStore('chapter_versions');
    const request = store.delete(versionId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Bookmarks
export async function getBookmarks(bookId: string): Promise<Bookmark[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bookmarks', 'readonly');
    const store = tx.objectStore('bookmarks');
    const index = store.index('bookId');
    const request = index.getAll(IDBKeyRange.only(bookId));
    request.onsuccess = () => {
      const res: Bookmark[] = request.result || [];
      res.sort((a, b) => b.createdAt - a.createdAt);
      resolve(res);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveBookmark(bookmark: Bookmark): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bookmarks', 'readwrite');
    const store = tx.objectStore('bookmarks');
    const request = store.put(bookmark);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteBookmark(bookmarkId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bookmarks', 'readwrite');
    const store = tx.objectStore('bookmarks');
    const request = store.delete(bookmarkId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Highlights
export async function getHighlights(bookId: string): Promise<Highlight[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('highlights', 'readonly');
    const store = tx.objectStore('highlights');
    const index = store.index('bookId');
    const request = index.getAll(IDBKeyRange.only(bookId));
    request.onsuccess = () => {
      const res: Highlight[] = request.result || [];
      res.sort((a, b) => b.createdAt - a.createdAt);
      resolve(res);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveHighlight(highlight: Highlight): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('highlights', 'readwrite');
    const store = tx.objectStore('highlights');
    const request = store.put(highlight);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteHighlight(highlightId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('highlights', 'readwrite');
    const store = tx.objectStore('highlights');
    const request = store.delete(highlightId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Dictionaries
export async function getDictionaries(bookId: string): Promise<DictionaryEntry[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('dictionaries', 'readonly');
    const store = tx.objectStore('dictionaries');
    const index = store.index('bookId');
    const request = index.getAll(IDBKeyRange.only(bookId));
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getMergedDictionaries(bookId: string): Promise<{
  globalEntries: DictionaryEntry[];
  bookEntries: DictionaryEntry[];
  merged: DictionaryEntry[];
}> {
  const [globalEntries, bookEntries] = await Promise.all([
    getDictionaries(GLOBAL_DICTIONARY_BOOK_ID),
    getDictionaries(bookId),
  ]);
  return {
    globalEntries,
    bookEntries,
    merged: mergeDictionariesByPrecedence(globalEntries, bookEntries),
  };
}

export async function saveDictionaryEntry(entry: DictionaryEntry): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('dictionaries', 'readwrite');
    const store = tx.objectStore('dictionaries');
    const request = store.put(entry);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteDictionaryEntry(entryId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('dictionaries', 'readwrite');
    const store = tx.objectStore('dictionaries');
    const request = store.delete(entryId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Settings
export async function getSettings(): Promise<ReaderSettings> {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const request = store.get('readerSettings');
    request.onsuccess = () => {
      if (request.result && request.result.value) {
        resolve({ ...DEFAULT_SETTINGS, ...request.result.value });
      } else {
        resolve(DEFAULT_SETTINGS);
      }
    };
    request.onerror = () => resolve(DEFAULT_SETTINGS);
  });
}

export async function saveSettings(settings: ReaderSettings): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const request = store.put({ key: 'readerSettings', value: settings });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Site Cookies (Per-Domain Browser Cookie Vault)
const TWO_PART_TLDS = new Set([
  'co.jp',
  'ne.jp',
  'or.jp',
  'ac.jp',
  'com.vn',
  'net.vn',
  'org.vn',
  'edu.vn',
  'co.uk',
  'org.uk',
  'com.cn',
  'com.tw',
  'com.hk',
  'com.au',
]);

export function extractBaseDomain(urlOrHost: string): string {
  let host = urlOrHost.trim().toLowerCase();
  if (host.includes('://')) {
    try {
      host = new URL(host).hostname.toLowerCase();
    } catch {
      // keep as-is
    }
  }
  host = host.replace(/^\.+/, '').split(':')[0];
  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return host;
  const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  if (TWO_PART_TLDS.has(lastTwo) && parts.length >= 3) {
    return `${parts[parts.length - 3]}.${lastTwo}`;
  }
  return lastTwo;
}

export async function getAllSiteCookies(): Promise<SiteCookieJar[]> {
  const db = await getDB();
  return new Promise((resolve) => {
    const tx = db.transaction('site_cookies', 'readonly');
    const store = tx.objectStore('site_cookies');
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []) as SiteCookieJar[]);
    req.onerror = () => resolve([]);
  });
}

export async function getSiteCookieJar(domainOrUrl: string): Promise<SiteCookieJar | undefined> {
  const baseDomain = extractBaseDomain(domainOrUrl);
  if (!baseDomain) return undefined;
  const db = await getDB();
  return new Promise((resolve) => {
    const tx = db.transaction('site_cookies', 'readonly');
    const store = tx.objectStore('site_cookies');
    const req = store.get(baseDomain);
    req.onsuccess = () => resolve(req.result as SiteCookieJar | undefined);
    req.onerror = () => resolve(undefined);
  });
}

export async function saveSiteCookieJar(jar: SiteCookieJar): Promise<void> {
  const baseDomain = extractBaseDomain(jar.domain);
  if (!baseDomain) return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('site_cookies', 'readwrite');
    const store = tx.objectStore('site_cookies');
    const req = store.put({ ...jar, domain: baseDomain });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSiteCookieJar(domainOrUrl: string): Promise<void> {
  const baseDomain = extractBaseDomain(domainOrUrl);
  if (!baseDomain) return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('site_cookies', 'readwrite');
    const store = tx.objectStore('site_cookies');
    const req = store.delete(baseDomain);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getCookieHeaderForUrl(url: string): Promise<string | undefined> {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname || '/';
    const jar = await getSiteCookieJar(hostname);
    if (!jar || jar.cookies.length === 0) return undefined;

    const now = Date.now();
    const matching = jar.cookies.filter((c) => {
      if (c.expiresAt && c.expiresAt <= now) return false;
      const cDom = c.domain.toLowerCase().replace(/^\.+/, '');
      const domainMatch = hostname === cDom || hostname.endsWith(`.${cDom}`);
      const cPath = c.path || '/';
      const pathMatch = pathname.startsWith(cPath);
      return domainMatch && pathMatch;
    });

    if (matching.length === 0) return undefined;
    return matching.map((c) => `${c.name}=${c.value}`).join('; ');
  } catch {
    return undefined;
  }
}

// Export / Import Full Database Backup
export async function exportDatabaseBackup(): Promise<string> {
  const db = await getDB();
  const backup: Record<string, unknown> = {
    version: 1,
    exportedAt: new Date().toISOString(),
    books: await getAllBooks(),
  };

  const allChapters: Chapter[] = [];
  const allBookmarks: Bookmark[] = [];
  const allHighlights: Highlight[] = [];
  const allDictionaries: DictionaryEntry[] = [...(await getDictionaries(GLOBAL_DICTIONARY_BOOK_ID))];
  const allTranslations: ChapterTranslation[] = [];

  for (const book of (backup.books as Book[])) {
    const chapters = await getChaptersByBookId(book.id);
    allChapters.push(...chapters);
    const bookmarks = await getBookmarks(book.id);
    allBookmarks.push(...bookmarks);
    const highlights = await getHighlights(book.id);
    allHighlights.push(...highlights);
    const dicts = await getDictionaries(book.id);
    allDictionaries.push(...dicts);
    const translations = await getBookTranslations(book.id);
    allTranslations.push(...translations);
  }

  backup.chapters = allChapters;
  backup.bookmarks = allBookmarks;
  backup.highlights = allHighlights;
  backup.dictionaries = allDictionaries;
  backup.chapter_translations = allTranslations;
  backup.settings = await getSettings();

  return JSON.stringify(backup, null, 2);
}

export async function restoreDatabaseBackup(jsonString: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonString);
    if (!data.books || !Array.isArray(data.books)) {
      throw new Error('Dữ liệu sao lưu không hợp lệ');
    }

    const db = await getDB();
    const tx = db.transaction(
      ['books', 'chapters', 'bookmarks', 'highlights', 'dictionaries', 'chapter_translations', 'settings'],
      'readwrite'
    );

    // Restore books
    const bookStore = tx.objectStore('books');
    for (const b of data.books) {
      bookStore.put(b);
    }

    // Restore chapters
    if (data.chapters && Array.isArray(data.chapters)) {
      const chStore = tx.objectStore('chapters');
      for (const ch of data.chapters) {
        chStore.put(ch);
      }
    }

    // Restore bookmarks
    if (data.bookmarks && Array.isArray(data.bookmarks)) {
      const bStore = tx.objectStore('bookmarks');
      for (const bm of data.bookmarks) {
        bStore.put(bm);
      }
    }

    // Restore highlights
    if (data.highlights && Array.isArray(data.highlights)) {
      const hStore = tx.objectStore('highlights');
      for (const h of data.highlights) {
        hStore.put(h);
      }
    }

    // Restore dictionaries
    if (data.dictionaries && Array.isArray(data.dictionaries)) {
      const dStore = tx.objectStore('dictionaries');
      for (const d of data.dictionaries) {
        dStore.put(d);
      }
    }

    // Restore chapter translations
    if (data.chapter_translations && Array.isArray(data.chapter_translations)) {
      const tStore = tx.objectStore('chapter_translations');
      for (const tr of data.chapter_translations) {
        tStore.put(tr);
      }
    }

    // Restore settings
    if (data.settings) {
      const sStore = tx.objectStore('settings');
      sStore.put({ key: 'readerSettings', value: data.settings });
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Lỗi khôi phục sao lưu:', err);
    throw err;
  }
}

