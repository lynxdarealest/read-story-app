import { WebNovelInspectResult, WebNovelChapterMeta, Chapter, SiteCookieJar } from '../types';
import { countWords } from './parser';
import {
  getAllSiteCookies,
  saveSiteCookieJar,
  deleteSiteCookieJar,
  getCookieHeaderForUrl,
  extractBaseDomain,
} from './storage';

export interface FetchWebChapterResult {
  title: string;
  content: string;
  wordCount: number;
  tags: string[];
}

export class WebChapterFetchError extends Error {
  requiresCookie?: boolean;
  constructor(message: string, requiresCookie?: boolean) {
    super(message);
    this.requiresCookie = requiresCookie;
  }
}

let hasHydratedCookies = false;

function getBridge() {
  return typeof window !== 'undefined' ? window.desktopBridge : undefined;
}

export async function hydrateServerCookiesFromIndexedDB(force = false): Promise<void> {
  if (hasHydratedCookies && !force) return;
  try {
    const localJars = await getAllSiteCookies();
    const bridge = getBridge();
    if (bridge?.syncCookieJars) {
      if (localJars.length > 0) {
        await bridge.syncCookieJars(localJars);
      }
      hasHydratedCookies = true;
      return;
    }
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
      hasHydratedCookies = true;
      return;
    }
    if (localJars.length > 0) {
      await fetch('/api/browser/cookies/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jars: localJars }),
      });
    }
    hasHydratedCookies = true;
  } catch {
    // Non-fatal
  }
}

export async function syncServerCookiesToIndexedDB(): Promise<SiteCookieJar[]> {
  try {
    const bridge = getBridge();
    if (bridge?.getAllCookies) {
      const jars = await bridge.getAllCookies();
      for (const jar of jars) {
        await saveSiteCookieJar(jar);
      }
      return await getAllSiteCookies();
    }
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
      return await getAllSiteCookies();
    }
    const resp = await fetch('/api/browser/cookies');
    if (!resp.ok) return await getAllSiteCookies();
    const data = (await resp.json()) as { jars?: SiteCookieJar[] };
    const serverJars = data.jars || [];
    for (const jar of serverJars) {
      await saveSiteCookieJar(jar);
    }
    return await getAllSiteCookies();
  } catch {
    return await getAllSiteCookies();
  }
}

export async function saveManualDomainCookie(
  domainOrUrl: string,
  cookieString: string
): Promise<SiteCookieJar[]> {
  const domain = extractBaseDomain(domainOrUrl);
  const bridge = getBridge();
  if (bridge?.setManualCookie) {
    const jars = await bridge.setManualCookie(domainOrUrl, cookieString);
    for (const jar of jars) {
      await saveSiteCookieJar(jar);
    }
    return await getAllSiteCookies();
  }

  const resp = await fetch('/api/browser/cookies/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, cookieString }),
  });
  if (!resp.ok) {
    throw new Error('Không thể lưu cookie cho trang web này.');
  }
  const data = (await resp.json()) as { jars?: SiteCookieJar[] };
  for (const jar of data.jars || []) {
    await saveSiteCookieJar(jar);
  }
  return await getAllSiteCookies();
}

export async function clearDomainCookies(domainOrUrl: string): Promise<SiteCookieJar[]> {
  const domain = extractBaseDomain(domainOrUrl);
  await deleteSiteCookieJar(domain);
  try {
    const bridge = getBridge();
    if (bridge?.clearDomainCookies) {
      await bridge.clearDomainCookies(domain);
    } else if (typeof window === 'undefined' || window.location.protocol !== 'file:') {
      await fetch(`/api/browser/cookies/${encodeURIComponent(domain)}`, { method: 'DELETE' });
    }
  } catch {
    // Ignore network error
  }
  return await getAllSiteCookies();
}

async function resolveEffectiveCookie(url: string, explicitCookie?: string): Promise<string | undefined> {
  if (explicitCookie && explicitCookie.trim()) {
    return explicitCookie.trim();
  }
  await hydrateServerCookiesFromIndexedDB();
  return await getCookieHeaderForUrl(url);
}

export async function inspectWebNovelUrl(
  url: string,
  cookie?: string
): Promise<WebNovelInspectResult> {
  const effectiveCookie = await resolveEffectiveCookie(url.trim(), cookie);
  const bridge = getBridge();
  if (bridge?.inspectUrl) {
    const result = await bridge.inspectUrl(url.trim(), effectiveCookie);
    syncServerCookiesToIndexedDB().catch(() => {});
    return result;
  }

  const resp = await fetch('/api/web-novel/inspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url.trim(), cookie: effectiveCookie }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error || 'Không thể phân tích URL.');
  }
  // Sync any new Set-Cookies captured during inspection
  syncServerCookiesToIndexedDB().catch(() => {});
  return data as WebNovelInspectResult;
}

export async function fetchWebNovelChapter(
  chapter: WebNovelChapterMeta,
  cookie?: string
): Promise<FetchWebChapterResult> {
  if (chapter.sourceType === 'inline') {
    if (typeof chapter.content === 'string' && chapter.content.trim().length > 0) {
      return {
        title: chapter.title,
        content: chapter.content,
        wordCount: chapter.wordCount || countWords(chapter.content),
        tags: chapter.tags || [],
      };
    }
    throw new WebChapterFetchError(
      'Chương này chưa có nội dung (có thể yêu cầu Cookie đăng nhập).',
      chapter.requiresCookie
    );
  }

  const effectiveCookie = await resolveEffectiveCookie(chapter.url, cookie);
  const bridge = getBridge();
  if (bridge?.fetchChapter) {
    return await bridge.fetchChapter({
      url: chapter.url,
      sourceType: chapter.sourceType,
      novelId: chapter.id,
      cookie: effectiveCookie,
    });
  }

  const resp = await fetch('/api/web-novel/fetch-chapter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: chapter.url,
      sourceType: chapter.sourceType,
      novelId: chapter.id,
      cookie: effectiveCookie,
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new WebChapterFetchError(
      data.error || `Lỗi khi tải "${chapter.title}"`,
      Boolean(data.requiresCookie)
    );
  }
  if (!data.content || typeof data.content !== 'string' || !data.content.trim()) {
    throw new WebChapterFetchError(
      `Chương "${chapter.title}" không có nội dung văn bản.`,
      Boolean(data.requiresCookie)
    );
  }
  return data as FetchWebChapterResult;
}

export interface BatchDownloadProgress {
  completed: number;
  total: number;
  currentTitle: string;
}

export async function downloadSelectedWebChapters(
  selectedChapters: WebNovelChapterMeta[],
  cookie: string | undefined,
  onProgress?: (progress: BatchDownloadProgress) => void,
  shouldAbort?: () => boolean
): Promise<{
  chapters: Array<{ title: string; content: string; wordCount: number; sourceId?: string; failed?: boolean }>;
  collectedTags: string[];
  successCount: number;
  failedCount: number;
  firstError?: string;
  requiresCookie?: boolean;
}> {
  const results: Array<{
    title: string;
    content: string;
    wordCount: number;
    sourceId?: string;
    failed?: boolean;
  }> = [];
  const tagSet = new Set<string>();
  let successCount = 0;
  let failedCount = 0;
  let firstError: string | undefined;
  let requiresCookie = false;

  for (let i = 0; i < selectedChapters.length; i++) {
    if (shouldAbort && shouldAbort()) {
      break;
    }
    const meta = selectedChapters[i];
    onProgress?.({
      completed: i,
      total: selectedChapters.length,
      currentTitle: meta.title,
    });

    try {
      const fetched = await fetchWebNovelChapter(meta, cookie);
      if (Array.isArray(fetched.tags)) {
        fetched.tags.forEach((t) => t && tagSet.add(t));
      }
      results.push({
        title: fetched.title || meta.title,
        content: fetched.content,
        wordCount: fetched.wordCount || countWords(fetched.content),
        sourceId: meta.id,
      });
      successCount++;
    } catch (err: any) {
      failedCount++;
      const errMsg = err?.message || 'Lỗi mạng';
      if (!firstError) firstError = errMsg;
      if (err?.requiresCookie) requiresCookie = true;

      results.push({
        title: meta.title,
        content: `[Không tải được nội dung chương này: ${errMsg}]`,
        wordCount: 0,
        sourceId: meta.id,
        failed: true,
      });
    }

    onProgress?.({
      completed: i + 1,
      total: selectedChapters.length,
      currentTitle: meta.title,
    });

    // Brief polite delay between remote chapter fetches
    if (meta.sourceType !== 'inline' && i + 1 < selectedChapters.length) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  return {
    chapters: results,
    collectedTags: Array.from(tagSet),
    successCount,
    failedCount,
    firstError,
    requiresCookie: requiresCookie || undefined,
  };
}

export function buildChaptersBackupText(
  chapters: Array<{ title: string; content: string }>
): string {
  return chapters.map((ch) => `${ch.title}\n\n${ch.content}`).join('\n\n\n');
}

export function normalizeBookChapters(
  bookId: string,
  drafts: Array<{ title: string; content: string; wordCount: number }>,
  startIndex = 0
): Chapter[] {
  return drafts.map((ch, idx) => ({
    id: `${bookId}-ch-${startIndex + idx}-${Date.now().toString(36).slice(-4)}`,
    bookId,
    chapterIndex: startIndex + idx,
    title: ch.title || `Chương ${startIndex + idx + 1}`,
    wordCount: ch.wordCount || countWords(ch.content),
    content: ch.content,
    originalContent: ch.content,
    originalTitle: ch.title || `Chương ${startIndex + idx + 1}`,
  }));
}
