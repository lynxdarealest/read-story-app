import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import {
  getServerCookieHeaderForUrl,
  mergeCookiesFromResponse,
  mountBrowserProxyRoutes,
} from './serverBrowserProxy.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface WebChapterMeta {
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

interface InspectPayload {
  sourceType: 'pixiv-series' | 'pixiv-novel' | 'web-toc' | 'web-article';
  normalizedUrl: string;
  title: string;
  author: string;
  description: string;
  tags: string[];
  coverDataUrl?: string;
  chapters: WebChapterMeta[];
  requiresCookie?: boolean;
  restrictionNotice?: string;
  seriesInfo?: {
    seriesId: string;
    title: string;
    url: string;
  };
}

function assertPublicHttpUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('URL không hợp lệ. Vui lòng nhập đầy đủ http:// hoặc https://');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Chỉ hỗ trợ giao thức HTTP và HTTPS.');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    throw new Error('Không được phép truy cập địa chỉ mạng nội bộ.');
  }

  return parsed;
}

function stripHtmlToText(html: string): string {
  if (!html) return '';
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n\n');
  const $ = cheerio.load(withBreaks);
  return $.text()
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function countWordsSimple(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  // Handle CJK characters gracefully alongside spaced words
  const spaceWords = trimmed.split(/\s+/).filter(Boolean);
  if (spaceWords.length < trimmed.length / 8) {
    // Likely CJK (Japanese/Chinese) without spaces between words
    return trimmed.replace(/\s+/g, '').length;
  }
  return spaceWords.length;
}

function normalizePixivCookie(cookie?: string): string | undefined {
  const trimmed = cookie?.trim();
  if (!trimmed) return undefined;
  // If user pasted only the PHPSESSID token value without key=, normalize automatically
  if (!trimmed.includes('=')) {
    return `PHPSESSID=${trimmed}`;
  }
  return trimmed;
}

function buildPixivHeaders(
  cookie?: string,
  targetUrl = 'https://www.pixiv.net/'
): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': DEFAULT_USER_AGENT,
    Referer: 'https://www.pixiv.net/',
    Origin: 'https://www.pixiv.net',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'ja,vi;q=0.9,en-US;q=0.8,en;q=0.7',
  };
  const effectiveCookie = getServerCookieHeaderForUrl(targetUrl, normalizePixivCookie(cookie));
  if (effectiveCookie) {
    headers['Cookie'] = effectiveCookie;
  }
  return headers;
}

function getPixivRestrictionReason(detail: any): string | undefined {
  if (typeof detail?.content === 'string' && detail.content.trim().length > 0) {
    return undefined;
  }
  if (Number(detail?.xRestrict) >= 1) {
    return 'Truyện Pixiv này gắn nhãn R-18/R-18G nên Pixiv ẩn toàn bộ nội dung chữ khi chưa đăng nhập. Vui lòng dán Cookie Pixiv (PHPSESSID=...) từ tài khoản đã bật xem R-18 rồi phân tích lại.';
  }
  if (detail?.isLoginOnly) {
    return 'Truyện Pixiv này yêu cầu đăng nhập mới xem được nội dung. Vui lòng nhập Cookie Pixiv (PHPSESSID=...) rồi phân tích lại.';
  }
  return 'Pixiv không trả về nội dung văn bản cho chương này (có thể Cookie đã hết hạn hoặc tài khoản chưa bật chế độ hiển thị nội dung giới hạn).';
}

function cleanPixivNovelContent(raw: string): string {
  if (!raw) return '';
  let text = raw.replace(/\r\n/g, '\n');
  // Ruby annotations: [[rb:Kanji > Furigana]] -> Kanji (Furigana)
  text = text.replace(/\[\[rb:([^\]>]+?)\s*>\s*([^\]]+?)\]\]/g, '$1 ($2)');
  // Jump URI: [[jumpuri:Title > URL]] -> Title
  text = text.replace(/\[\[jumpuri:([^\]>]+?)\s*>\s*[^\]]+?\]\]/g, '$1');
  // Chapter headings inside a single novel
  text = text.replace(/\[chapter:([^\]]+?)\]/g, '\n\n$1\n\n');
  // Page breaks
  text = text.replace(/\[newpage\]/g, '\n\n');
  // Jump markers
  text = text.replace(/\[jump:\d+\]/g, '');
  // Embedded Pixiv images
  text = text.replace(/\[pixivimage:([^\]]+?)\]/g, '\n[Ảnh minh họa #$1]\n');
  // Embedded uploaded images
  text = text.replace(/\[uploadedimage:([^\]]+?)\]/g, '\n[Ảnh đính kèm #$1]\n');
  // Normalize blank lines
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

function splitPixivInlineChapters(
  rawContent: string,
  fallbackTitle: string
): Array<{ title: string; content: string; wordCount: number }> {
  const normalized = rawContent.replace(/\r\n/g, '\n');
  const chapterTagRegex = /^\[chapter:([^\]]+)\]\s*$/gm;
  const matches = [...normalized.matchAll(chapterTagRegex)];

  if (matches.length <= 1) {
    const cleaned = cleanPixivNovelContent(normalized);
    return [
      {
        title: matches.length === 1 ? matches[0][1].trim() : fallbackTitle,
        content: cleaned,
        wordCount: countWordsSimple(cleaned),
      },
    ];
  }

  const chapters: Array<{ title: string; content: string; wordCount: number }> = [];
  const firstIdx = matches[0].index ?? 0;
  if (firstIdx > 0) {
    const preface = cleanPixivNovelContent(normalized.slice(0, firstIdx));
    if (preface.length > 20) {
      chapters.push({
        title: `${fallbackTitle} - Mở đầu`,
        content: preface,
        wordCount: countWordsSimple(preface),
      });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? normalized.length) : normalized.length;
    const chTitle = matches[i][1].trim();
    const chBody = cleanPixivNovelContent(normalized.slice(start, end));
    if (chBody) {
      chapters.push({
        title: chTitle || `Phần ${i + 1}`,
        content: chBody,
        wordCount: countWordsSimple(chBody),
      });
    }
  }

  return chapters;
}

async function fetchImageAsDataUrl(
  imageUrl?: string,
  referer = 'https://www.pixiv.net/',
  cookie?: string
): Promise<string | undefined> {
  if (!imageUrl) return undefined;
  try {
    const parsed = assertPublicHttpUrl(imageUrl);
    const headers: Record<string, string> = {
      'User-Agent': DEFAULT_USER_AGENT,
      Referer: referer,
    };
    const effectiveCookie = getServerCookieHeaderForUrl(parsed.toString(), cookie);
    if (effectiveCookie) {
      headers['Cookie'] = effectiveCookie;
    }
    const resp = await fetch(parsed.toString(), {
      headers,
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return undefined;
    const contentType = resp.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return undefined;
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.byteLength > 3 * 1024 * 1024) return undefined; // Cap cover at 3MB
    return `data:${contentType.split(';')[0]};base64,${buf.toString('base64')}`;
  } catch {
    return undefined;
  }
}

async function fetchPixivNovelDetail(novelId: string, cookie?: string) {
  const url = `https://www.pixiv.net/ajax/novel/${novelId}`;
  const headers = buildPixivHeaders(cookie, url);
  const resp = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  mergeCookiesFromResponse(resp, new URL(url));
  if (!resp.ok) {
    throw new Error(`Không thể tải truyện Pixiv #${novelId} (HTTP ${resp.status}).`);
  }
  const json = (await resp.json()) as { error?: boolean; message?: string; body?: any };
  if (json.error || !json.body) {
    throw new Error(json.message || `Không thể truy cập truyện Pixiv #${novelId} (có thể yêu cầu Cookie đăng nhập).`);
  }
  return json.body;
}

async function inspectPixivSeries(seriesId: string, cookie?: string): Promise<InspectPayload> {
  const headers = buildPixivHeaders(cookie);

  const seriesResp = await fetch(`https://www.pixiv.net/ajax/novel/series/${seriesId}`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!seriesResp.ok) {
    throw new Error(`Không tìm thấy series Pixiv #${seriesId} (HTTP ${seriesResp.status}).`);
  }
  const seriesJson = (await seriesResp.json()) as { error?: boolean; message?: string; body?: any };
  if (seriesJson.error || !seriesJson.body) {
    throw new Error(seriesJson.message || 'Không thể đọc thông tin series Pixiv.');
  }

  const sBody = seriesJson.body;
  const totalCount = Number(sBody.total || sBody.publishedContentCount || 0);
  const tagSet = new Set<string>(Array.isArray(sBody.tags) ? sBody.tags.filter(Boolean) : []);

  // Paginate series_content to gather all chapter entries
  const contentEntries: Array<{ id: string; order: number }> = [];
  const thumbnailMap = new Map<string, any>();
  let lastOrder = 0;
  let safetyLoop = 0;

  while (safetyLoop < 50) {
    safetyLoop++;
    const contentUrl = `https://www.pixiv.net/ajax/novel/series_content/${seriesId}?limit=30&last_order=${lastOrder}&order_by=asc`;
    const cResp = await fetch(contentUrl, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
    if (!cResp.ok) break;
    const cJson = (await cResp.json()) as { error?: boolean; body?: any };
    if (cJson.error || !cJson.body) break;

    const thumbNovels: any[] = cJson.body.thumbnails?.novel || [];
    for (const tn of thumbNovels) {
      if (tn?.id) thumbnailMap.set(String(tn.id), tn);
    }

    const pageItems: any[] = cJson.body.page?.seriesContents || [];
    if (pageItems.length === 0) break;

    for (const item of pageItems) {
      const id = String(item.id);
      const order = Number(item.series?.contentOrder ?? contentEntries.length + 1);
      if (!contentEntries.some((e) => e.id === id)) {
        contentEntries.push({ id, order });
      }
      lastOrder = Math.max(lastOrder + 1, order);
    }

    if (pageItems.length < 30 || (totalCount > 0 && contentEntries.length >= totalCount)) {
      break;
    }
  }

  contentEntries.sort((a, b) => a.order - b.order);

  // Build initial chapter metadata; resolve missing titles & verify content accessibility
  let fallbackCoverUrl: string | undefined =
    sBody.cover?.urls?.['480mw'] || sBody.cover?.urls?.original || sBody.cover?.urls?.['240mw'];

  let requiresCookie = false;
  let restrictionNotice: string | undefined;

  const chapters: WebChapterMeta[] = contentEntries.map((entry, idx) => {
    const thumb = thumbnailMap.get(entry.id);
    if (thumb && Array.isArray(thumb.tags)) {
      thumb.tags.forEach((t: string) => t && tagSet.add(t));
    }
    if (!fallbackCoverUrl && thumb?.url) {
      fallbackCoverUrl = thumb.url;
    }
    const thumbRestricted = Number(thumb?.xRestrict || 0) >= 1;
    if (thumbRestricted && !normalizePixivCookie(cookie)) {
      requiresCookie = true;
    }
    return {
      index: idx,
      id: entry.id,
      title: thumb?.title || `Chương ${entry.order}`,
      url: `https://www.pixiv.net/novel/show.php?id=${entry.id}`,
      sourceType: 'pixiv-novel',
      wordCount: thumb?.wordCount || thumb?.characterCount || thumb?.textCount || undefined,
      available: thumb?.available ?? true,
    };
  });

  // Fetch novel detail for missing thumbnails AND always verify chapter 0 content availability
  const indicesToInspect = new Set<number>();
  if (chapters.length > 0) {
    indicesToInspect.add(0);
  }
  chapters.forEach((c, idx) => {
    if (!thumbnailMap.has(c.id) && indicesToInspect.size < 15) {
      indicesToInspect.add(idx);
    }
  });

  const inspectList = Array.from(indicesToInspect);
  if (inspectList.length > 0) {
    const batchSize = 4;
    for (let i = 0; i < inspectList.length; i += batchSize) {
      const slice = inspectList.slice(i, i + batchSize);
      await Promise.all(
        slice.map(async (chIdx) => {
          try {
            const detail = await fetchPixivNovelDetail(chapters[chIdx].id, cookie);
            if (detail.title) chapters[chIdx].title = detail.title;
            if (detail.content) {
              chapters[chIdx].wordCount = countWordsSimple(detail.content);
              chapters[chIdx].available = true;
              chapters[chIdx].requiresCookie = false;
            } else {
              const restriction = getPixivRestrictionReason(detail);
              chapters[chIdx].wordCount =
                Number(detail.wordCount) || Number(detail.characterCount) || chapters[chIdx].wordCount;
              chapters[chIdx].available = false;
              chapters[chIdx].requiresCookie = true;
              requiresCookie = true;
              if (!restrictionNotice && restriction) {
                restrictionNotice = restriction;
              }
            }
            if (!fallbackCoverUrl && detail.coverUrl) {
              fallbackCoverUrl = detail.coverUrl;
            }
            const novelTags = detail.tags?.tags?.map((t: any) => t?.tag).filter(Boolean) || [];
            if (novelTags.length > 0) {
              chapters[chIdx].tags = novelTags;
              novelTags.forEach((t: string) => tagSet.add(t));
            }
          } catch {
            // Keep fallback title
          }
        })
      );
    }
  }

  // Propagate restriction notice to chapters without thumbnails if chapter 0 failed content check
  if (requiresCookie) {
    chapters.forEach((ch) => {
      if (ch.requiresCookie === undefined && !thumbnailMap.has(ch.id)) {
        ch.requiresCookie = true;
        ch.available = false;
      }
    });
    if (!restrictionNotice) {
      restrictionNotice =
        'Series này có chương R-18 hoặc yêu cầu đăng nhập Pixiv. Vui lòng nhập Cookie Pixiv (PHPSESSID=...) để tải nội dung văn bản.';
    }
  }

  const coverDataUrl = await fetchImageAsDataUrl(fallbackCoverUrl, 'https://www.pixiv.net/', cookie);

  return {
    sourceType: 'pixiv-series',
    normalizedUrl: `https://www.pixiv.net/novel/series/${seriesId}`,
    title: sBody.title || `Pixiv Series #${seriesId}`,
    author: sBody.userName || 'Khuyết danh',
    description: stripHtmlToText(sBody.caption || ''),
    tags: Array.from(tagSet),
    coverDataUrl,
    chapters,
    requiresCookie: requiresCookie || undefined,
    restrictionNotice,
  };
}

async function inspectPixivSingleNovel(novelId: string, cookie?: string): Promise<InspectPayload> {
  const detail = await fetchPixivNovelDetail(novelId, cookie);
  const tags: string[] = detail.tags?.tags?.map((t: any) => t?.tag).filter(Boolean) || [];
  const restriction = getPixivRestrictionReason(detail);
  const rawContent: string = typeof detail.content === 'string' ? detail.content : '';
  const coverDataUrl = await fetchImageAsDataUrl(detail.coverUrl, 'https://www.pixiv.net/', cookie);

  const seriesNav = detail.seriesNavData;
  const seriesInfo =
    seriesNav && seriesNav.seriesId
      ? {
          seriesId: String(seriesNav.seriesId),
          title: seriesNav.title || `Series #${seriesNav.seriesId}`,
          url: `https://www.pixiv.net/novel/series/${seriesNav.seriesId}`,
        }
      : undefined;

  if (restriction) {
    return {
      sourceType: 'pixiv-novel',
      normalizedUrl: `https://www.pixiv.net/novel/show.php?id=${novelId}`,
      title: detail.title || `Pixiv #${novelId}`,
      author: detail.userName || 'Khuyết danh',
      description: stripHtmlToText(detail.description || ''),
      tags,
      coverDataUrl,
      requiresCookie: true,
      restrictionNotice: restriction,
      chapters: [
        {
          index: 0,
          id: novelId,
          title: detail.title || `Pixiv #${novelId}`,
          url: `https://www.pixiv.net/novel/show.php?id=${novelId}`,
          sourceType: 'pixiv-novel',
          wordCount: Number(detail.wordCount) || Number(detail.characterCount) || undefined,
          tags,
          available: false,
          requiresCookie: true,
        },
      ],
      seriesInfo,
    };
  }

  const splitChapters = splitPixivInlineChapters(rawContent, detail.title || `Pixiv #${novelId}`);

  return {
    sourceType: 'pixiv-novel',
    normalizedUrl: `https://www.pixiv.net/novel/show.php?id=${novelId}`,
    title: detail.title || `Pixiv #${novelId}`,
    author: detail.userName || 'Khuyết danh',
    description: stripHtmlToText(detail.description || ''),
    tags,
    coverDataUrl,
    chapters: splitChapters.map((ch, idx) => ({
      index: idx,
      id: `${novelId}-${idx}`,
      title: ch.title,
      url: `https://www.pixiv.net/novel/show.php?id=${novelId}`,
      sourceType: 'inline',
      wordCount: ch.wordCount,
      content: ch.content,
      tags,
      available: true,
    })),
    seriesInfo,
  };
}

async function fetchHtmlWithCharset(targetUrl: string, cookie?: string): Promise<{ html: string; finalUrl: string }> {
  const parsed = assertPublicHttpUrl(targetUrl);
  const headers: Record<string, string> = {
    'User-Agent': DEFAULT_USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'vi,ja;q=0.9,en-US;q=0.8,en;q=0.7',
    Referer: parsed.origin + '/',
  };
  const effectiveCookie = getServerCookieHeaderForUrl(parsed.toString(), cookie);
  if (effectiveCookie) {
    headers['Cookie'] = effectiveCookie;
  }

  const resp = await fetch(parsed.toString(), {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  mergeCookiesFromResponse(resp, parsed);
  if (!resp.ok) {
    throw new Error(`Không thể truy cập trang web (HTTP ${resp.status}).`);
  }

  const buffer = Buffer.from(await resp.arrayBuffer());
  const contentType = resp.headers.get('content-type') || '';
  let charset = 'utf-8';
  const ctMatch = contentType.match(/charset=([^;\s]+)/i);
  if (ctMatch) {
    charset = ctMatch[1].replace(/['"]/g, '').toLowerCase();
  } else {
    const headLatin = buffer.subarray(0, 4096).toString('latin1');
    const metaMatch = headLatin.match(/charset=["']?([a-zA-Z0-9_-]+)/i);
    if (metaMatch) {
      charset = metaMatch[1].toLowerCase();
    }
  }

  let html: string;
  try {
    html = new TextDecoder(charset).decode(buffer);
  } catch {
    html = new TextDecoder('utf-8').decode(buffer);
  }

  return { html, finalUrl: resp.url || parsed.toString() };
}

function extractArticleText($: cheerio.CheerioAPI): string {
  // Known novel body selectors (Syosetsu, Kakuyomu, TruyenFull, Wikidich, generic blogs)
  const prioritySelectors = [
    '#novel_honbun',
    '.p-novel__text',
    '.js-novel-text',
    '.widget-episodeBody',
    '#chapter-c',
    '.chapter-c',
    '.chapter-content',
    '#chapter-content',
    '.reading-content',
    '.entry-content',
    'article .content',
    'article',
    'main',
  ];

  let targetEl: cheerio.Cheerio<any> | null = null;
  for (const sel of prioritySelectors) {
    const found = $(sel).first();
    if (found.length && found.text().trim().length > 150) {
      targetEl = found;
      break;
    }
  }

  if (!targetEl) {
    // Heuristic fallback: pick div/section with largest paragraph text length
    let bestLen = 0;
    $('div, section').each((_, el) => {
      const $el = $(el);
      const pCount = $el.children('p').length;
      if (pCount >= 3) {
        const len = $el.children('p').text().trim().length;
        if (len > bestLen) {
          bestLen = len;
          targetEl = $el;
        }
      }
    });
  }

  if (!targetEl) {
    targetEl = $('body');
  }

  const clone = targetEl.clone();
  clone.find('script, style, noscript, iframe, nav, header, footer, aside, .ads, .advertisement').remove();

  // Preserve paragraph breaks cleanly
  const blocks: string[] = [];
  const pNodes = clone.find('p');
  if (pNodes.length >= 2) {
    pNodes.each((_, el) => {
      const innerHtml = $(el).html() || '';
      const txt = stripHtmlToText(innerHtml);
      if (txt) blocks.push(txt);
    });
    if (blocks.length > 0) {
      return blocks.join('\n\n');
    }
  }

  return stripHtmlToText(clone.html() || '');
}

async function inspectGenericWebUrl(rawUrl: string, cookie?: string): Promise<InspectPayload> {
  const { html, finalUrl } = await fetchHtmlWithCharset(rawUrl, cookie);
  const $ = cheerio.load(html);
  const baseUrl = new URL(finalUrl);

  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim();
  const h1Title = $('h1').first().text().trim();
  const docTitle = $('title').text().trim();
  const title = h1Title || ogTitle || docTitle || baseUrl.hostname;

  const author =
    $('meta[name="author"]').attr('content')?.trim() ||
    $('.novel_writername a').first().text().trim() ||
    $('.novel_writername').first().text().replace(/^作者[：:]\s*/, '').trim() ||
    $('[itemprop="author"]').first().text().trim() ||
    $('.p-novel__author a').first().text().trim() ||
    'Khuyết danh';

  const description =
    $('meta[property="og:description"]').attr('content')?.trim() ||
    $('meta[name="description"]').attr('content')?.trim() ||
    $('#novel_ex').text().trim() ||
    $('.p-novel__summary').text().trim() ||
    '';

  const tagSet = new Set<string>();
  const keywordsMeta = $('meta[name="keywords"]').attr('content');
  if (keywordsMeta) {
    keywordsMeta
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length < 40)
      .forEach((t) => tagSet.add(t));
  }
  $('a[rel="tag"], .tag a, .tags a, .p-novel__tags a').each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length < 40) tagSet.add(t);
  });

  const rawCover = $('meta[property="og:image"]').attr('content')?.trim();
  let coverUrlResolved: string | undefined;
  if (rawCover) {
    try {
      coverUrlResolved = new URL(rawCover, baseUrl).toString();
    } catch {
      coverUrlResolved = undefined;
    }
  }
  const coverDataUrl = await fetchImageAsDataUrl(coverUrlResolved, baseUrl.origin + '/', cookie);

  // Detect Table of Contents links
  const tocSelectors = [
    '.index_box .novel_sublist2 a',
    '.p-eplist__sublist a.p-eplist__subtitle',
    '.widget-toc-episode a',
    '#list-chapter .list-chapter a',
    '.list-chapter a',
    '.chapter-list a',
    '#chapters a',
  ];

  const foundLinks: Array<{ title: string; url: string }> = [];
  const seenUrls = new Set<string>();

  for (const sel of tocSelectors) {
    const links = $(sel);
    if (links.length >= 2) {
      links.each((_, el) => {
        const href = $(el).attr('href');
        const linkTitle = $(el).text().replace(/\s+/g, ' ').trim();
        if (!href || !linkTitle) return;
        try {
          const absUrl = new URL(href, baseUrl).toString();
          if (!seenUrls.has(absUrl)) {
            seenUrls.add(absUrl);
            foundLinks.push({ title: linkTitle, url: absUrl });
          }
        } catch {
          // Ignore malformed href
        }
      });
      if (foundLinks.length >= 2) break;
    }
  }

  // Heuristic TOC check if known selectors didn't trigger
  if (foundLinks.length < 2) {
    const chapterRegex = /(chương|chuong|chapter|phần|tập|episode|第.+話|話|ch\.\s*\d+)/i;
    $('main a, article a, #content a, .content a, ul a').each((_, el) => {
      const href = $(el).attr('href');
      const linkTitle = $(el).text().replace(/\s+/g, ' ').trim();
      if (!href || !linkTitle || linkTitle.length > 120) return;
      if (!chapterRegex.test(linkTitle)) return;
      try {
        const absUrl = new URL(href, baseUrl);
        if (absUrl.origin !== baseUrl.origin) return;
        if (absUrl.pathname === baseUrl.pathname && absUrl.hash) return;
        const absStr = absUrl.toString();
        if (!seenUrls.has(absStr)) {
          seenUrls.add(absStr);
          foundLinks.push({ title: linkTitle, url: absStr });
        }
      } catch {
        // Ignore
      }
    });
  }

  if (foundLinks.length >= 2) {
    return {
      sourceType: 'web-toc',
      normalizedUrl: finalUrl,
      title,
      author,
      description,
      tags: Array.from(tagSet),
      coverDataUrl,
      chapters: foundLinks.map((lnk, idx) => ({
        index: idx,
        id: `web-${idx}`,
        title: lnk.title,
        url: lnk.url,
        sourceType: 'web-chapter',
        available: true,
      })),
    };
  }

  // Single article/chapter page
  const extractedText = extractArticleText($);
  if (!extractedText || extractedText.length < 30) {
    throw new Error('Không trích xuất được nội dung văn bản từ trang web này.');
  }

  return {
    sourceType: 'web-article',
    normalizedUrl: finalUrl,
    title,
    author,
    description,
    tags: Array.from(tagSet),
    coverDataUrl,
    chapters: [
      {
        index: 0,
        id: 'web-0',
        title: h1Title || title,
        url: finalUrl,
        sourceType: 'inline',
        content: extractedText,
        wordCount: countWordsSimple(extractedText),
        available: true,
      },
    ],
  };
}

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  // Mount browser mode proxy & cookie jar routes BEFORE global express.json() so raw POST bodies pass through untouched
  mountBrowserProxyRoutes(app, assertPublicHttpUrl);

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Inspect a web novel / series URL
  app.post('/api/web-novel/inspect', async (req: Request, res: Response) => {
    try {
      const { url, cookie } = req.body as { url?: string; cookie?: string };
      if (!url || typeof url !== 'string') {
        res.status(400).json({ error: 'Vui lòng nhập đường dẫn URL hợp lệ.' });
        return;
      }

      const parsed = assertPublicHttpUrl(url);
      const urlStr = parsed.toString();

      // Detect Pixiv Novel Series
      const seriesMatch = urlStr.match(/pixiv\.net\/(?:[a-z]{2}\/)?novel\/series\/(\d+)/i);
      if (seriesMatch) {
        const result = await inspectPixivSeries(seriesMatch[1], cookie);
        res.json(result);
        return;
      }

      // Detect Pixiv Single Novel
      const novelMatch = urlStr.match(/pixiv\.net\/(?:[a-z]{2}\/)?novel\/show\.php\?.*id=(\d+)/i);
      if (novelMatch) {
        const result = await inspectPixivSingleNovel(novelMatch[1], cookie);
        res.json(result);
        return;
      }

      // Generic Web Novel / HTML Article
      const result = await inspectGenericWebUrl(urlStr, cookie);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Không thể phân tích đường dẫn URL.' });
    }
  });

  // Fetch content of a single chapter URL
  app.post('/api/web-novel/fetch-chapter', async (req: Request, res: Response) => {
    try {
      const { url, sourceType, novelId, cookie } = req.body as {
        url?: string;
        sourceType?: 'pixiv-novel' | 'web-chapter';
        novelId?: string;
        cookie?: string;
      };

      if (!url || typeof url !== 'string') {
        res.status(400).json({ error: 'Thiếu URL chương.' });
        return;
      }
      assertPublicHttpUrl(url);

      if (sourceType === 'pixiv-novel') {
        const resolvedId =
          novelId || url.match(/id=(\d+)/i)?.[1] || url.match(/(\d+)/)?.[1];
        if (!resolvedId) {
          res.status(400).json({ error: 'Không xác định được ID chương Pixiv.' });
          return;
        }
        const detail = await fetchPixivNovelDetail(resolvedId, cookie);
        const restriction = getPixivRestrictionReason(detail);
        if (restriction) {
          res.status(403).json({
            error: restriction,
            requiresCookie: true,
          });
          return;
        }
        const cleaned = cleanPixivNovelContent(detail.content || '');
        if (!cleaned.trim()) {
          res.status(422).json({
            error: 'Nội dung chương Pixiv trống.',
          });
          return;
        }
        const tags: string[] = detail.tags?.tags?.map((t: any) => t?.tag).filter(Boolean) || [];
        res.json({
          title: detail.title || `Chương ${resolvedId}`,
          content: cleaned,
          wordCount: countWordsSimple(cleaned),
          tags,
        });
        return;
      }

      // Generic HTML chapter
      const { html } = await fetchHtmlWithCharset(url, cookie);
      const $ = cheerio.load(html);
      const h1Title = $('h1').first().text().trim() || $('.chapter-title').first().text().trim();
      const content = extractArticleText($);
      if (!content || !content.trim()) {
        res.status(422).json({ error: 'Không trích xuất được nội dung văn bản từ trang chương này.' });
        return;
      }
      res.json({
        title: h1Title || $('title').text().trim() || 'Chương',
        content,
        wordCount: countWordsSimple(content),
        tags: [],
      });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Lỗi khi tải nội dung chương.' });
    }
  });

  // Fixed same-origin proxy for SangTacViet translation service
  app.post(
    '/api/sangtacviet',
    express.urlencoded({ extended: false, limit: '256kb' }),
    async (req: Request, res: Response) => {
      try {
        const sajax = req.body?.sajax;
        const content = req.body?.content;

        if (sajax !== 'trans' || typeof content !== 'string' || content.trim().length === 0) {
          res.status(400).json({ error: 'Yêu cầu dịch không hợp lệ (thiếu sajax=trans hoặc content).' });
          return;
        }

        if (content.length > 200000) {
          res.status(413).json({ error: 'Nội dung gửi dịch vượt quá giới hạn cho phép (200.000 ký tự).' });
          return;
        }

        const upstreamBody = new URLSearchParams({
          sajax: 'trans',
          content,
        }).toString();

        const upstreamRes = await fetch('https://comic.sangtacvietcdn.xyz/tsm.php?cdn=/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': DEFAULT_USER_AGENT,
            Accept: 'text/plain, */*',
          },
          body: upstreamBody,
          signal: AbortSignal.timeout(25000),
        });

        const rawText = await upstreamRes.text();
        const cfMitigated = upstreamRes.headers.get('cf-mitigated');
        const looksLikeHtmlChallenge =
          cfMitigated === 'challenge' ||
          /^\s*<!doctype html/i.test(rawText) ||
          rawText.includes('_cf_chl_opt') ||
          rawText.includes('Just a moment...');

        if (looksLikeHtmlChallenge) {
          res.status(502).json({
            error:
              'Máy chủ dịch đang bật xác minh bảo mật (HTTP 403) đối với IP hiện tại nên chưa thể trả về bản dịch.',
          });
          return;
        }

        if (!upstreamRes.ok) {
          res.status(upstreamRes.status).json({
            error: `Dịch vụ dịch trả về lỗi HTTP ${upstreamRes.status}.`,
          });
          return;
        }

        if (!rawText || !rawText.trim()) {
          res.status(502).json({
            error: 'Dịch vụ dịch trả về phản hồi rỗng.',
          });
          return;
        }

        res.status(200).type('text/plain; charset=utf-8').send(rawText);
      } catch (err: any) {
        const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
        res.status(isTimeout ? 504 : 502).json({
          error: isTimeout
            ? 'Hết thời gian chờ phản hồi từ dịch vụ dịch (25 giây).'
            : 'Không thể kết nối tới máy chủ dịch. Vui lòng kiểm tra kết nối Internet.',
        });
      }
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
