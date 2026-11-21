const { app, BrowserWindow, ipcMain, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const cheerio = require('cheerio');

const PARTITION_NAME = 'persist:reader-browser';
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

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

let preferredLang = 'en';

function extractBaseDomain(urlOrHost) {
  let host = String(urlOrHost || '').trim().toLowerCase();
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

function assertPublicHttpUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    throw new Error('URL không hợp lệ. Vui lòng nhập đầy đủ http:// hoặc https://');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Chỉ hỗ trợ giao thức HTTP và HTTPS.');
  }
  return parsed;
}

function getBrowserSession() {
  return session.fromPartition(PARTITION_NAME);
}

async function listGroupedCookieJars() {
  const browserSession = getBrowserSession();
  const cookies = await browserSession.cookies.get({});
  const nowSec = Date.now() / 1000;
  const map = new Map();

  for (const c of cookies) {
    if (c.expirationDate && c.expirationDate <= nowSec) continue;
    const baseDomain = extractBaseDomain(c.domain || '');
    if (!baseDomain) continue;
    const jar = map.get(baseDomain) || {
      domain: baseDomain,
      cookies: [],
      updatedAt: Date.now(),
    };
    jar.cookies.push({
      name: c.name,
      value: c.value,
      domain: (c.domain || baseDomain).replace(/^\.+/, ''),
      path: c.path || '/',
      expiresAt: c.expirationDate ? Math.round(c.expirationDate * 1000) : undefined,
      httpOnly: Boolean(c.httpOnly),
      secure: Boolean(c.secure),
    });
    map.set(baseDomain, jar);
  }

  return Array.from(map.values());
}

async function buildCookieHeaderForUrl(targetUrl, overrideCookie) {
  const parsed = new URL(targetUrl);
  const browserSession = getBrowserSession();
  const sessionCookies = await browserSession.cookies.get({ url: parsed.toString() });
  const cookieMap = new Map();

  for (const c of sessionCookies) {
    cookieMap.set(c.name, c.value);
  }

  if (overrideCookie && String(overrideCookie).trim()) {
    const trimmed = String(overrideCookie).trim();
    const base = extractBaseDomain(parsed.hostname);
    const normalized = !trimmed.includes('=') && base === 'pixiv.net' ? `PHPSESSID=${trimmed}` : trimmed;
    for (const part of normalized.split(';')) {
      const p = part.trim();
      const eqIdx = p.indexOf('=');
      if (eqIdx > 0) {
        const k = p.slice(0, eqIdx).trim();
        const v = p.slice(eqIdx + 1).trim();
        if (k) cookieMap.set(k, v);
      }
    }
  }

  if (cookieMap.size === 0) return undefined;
  return Array.from(cookieMap.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function mergeSetCookiesIntoSession(resp, requestUrl) {
  const browserSession = getBrowserSession();
  let setCookies = [];
  if (typeof resp.headers.getSetCookie === 'function') {
    setCookies = resp.headers.getSetCookie();
  } else {
    const single = resp.headers.get('set-cookie');
    if (single) setCookies = [single];
  }
  for (const raw of setCookies) {
    const parts = raw.split(';').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) continue;
    const eqIdx = parts[0].indexOf('=');
    if (eqIdx <= 0) continue;
    const name = parts[0].slice(0, eqIdx).trim();
    const value = parts[0].slice(eqIdx + 1).trim();
    let domain = requestUrl.hostname;
    let cookiePath = '/';
    let expirationDate;
    let httpOnly = false;
    let secure = requestUrl.protocol === 'https:';

    for (let i = 1; i < parts.length; i++) {
      const attr = parts[i];
      const aEq = attr.indexOf('=');
      const k = (aEq >= 0 ? attr.slice(0, aEq) : attr).trim().toLowerCase();
      const v = aEq >= 0 ? attr.slice(aEq + 1).trim() : '';
      if (k === 'domain' && v) domain = v;
      else if (k === 'path' && v) cookiePath = v.startsWith('/') ? v : '/';
      else if (k === 'max-age' && v && !Number.isNaN(Number(v))) {
        expirationDate = Math.floor(Date.now() / 1000) + Number(v);
      } else if (k === 'expires' && v && expirationDate === undefined) {
        const ms = Date.parse(v);
        if (!Number.isNaN(ms)) expirationDate = Math.floor(ms / 1000);
      } else if (k === 'httponly') httpOnly = true;
      else if (k === 'secure') secure = true;
    }

    const hostNoDot = domain.replace(/^\.+/, '');
    try {
      await browserSession.cookies.set({
        url: `${requestUrl.protocol}//${hostNoDot}${cookiePath}`,
        name,
        value,
        domain: domain.startsWith('.') ? domain : undefined,
        path: cookiePath,
        httpOnly,
        secure,
        expirationDate,
      });
    } catch {
      // Ignore invalid cookie attributes
    }
  }
}

function stripHtmlToText(html) {
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

function countWordsSimple(text) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const spaceWords = trimmed.split(/\s+/).filter(Boolean);
  if (spaceWords.length < trimmed.length / 8) {
    return trimmed.replace(/\s+/g, '').length;
  }
  return spaceWords.length;
}

function cleanPixivNovelContent(raw) {
  if (!raw) return '';
  let text = raw.replace(/\r\n/g, '\n');
  text = text.replace(/\[\[rb:([^\]>]+?)\s*>\s*([^\]]+?)\]\]/g, '$1 ($2)');
  text = text.replace(/\[\[jumpuri:([^\]>]+?)\s*>\s*[^\]]+?\]\]/g, '$1');
  text = text.replace(/\[chapter:([^\]]+?)\]/g, '\n\n$1\n\n');
  text = text.replace(/\[newpage\]/g, '\n\n');
  text = text.replace(/\[jump:\d+\]/g, '');
  text = text.replace(/\[pixivimage:([^\]]+?)\]/g, '\n[Ảnh minh họa #$1]\n');
  text = text.replace(/\[uploadedimage:([^\]]+?)\]/g, '\n[Ảnh đính kèm #$1]\n');
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

function splitPixivInlineChapters(rawContent, fallbackTitle) {
  const normalized = rawContent.replace(/\r\n/g, '\n');
  const matches = [...normalized.matchAll(/^\[chapter:([^\]]+)\]\s*$/gm)];
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
  const chapters = [];
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
    const end = i + 1 < matches.length ? matches[i + 1].index ?? normalized.length : normalized.length;
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

function getPixivRestrictionReason(detail) {
  if (typeof detail?.content === 'string' && detail.content.trim().length > 0) return undefined;
  if (Number(detail?.xRestrict) >= 1) {
    return 'Truyện Pixiv này gắn nhãn R-18/R-18G nên cần đăng nhập Pixiv và bật xem R-18 trong trình duyệt.';
  }
  if (detail?.isLoginOnly) {
    return 'Truyện Pixiv này yêu cầu đăng nhập mới xem được nội dung.';
  }
  return 'Pixiv không trả về nội dung văn bản cho chương này.';
}

async function fetchImageAsDataUrl(imageUrl, referer = 'https://www.pixiv.net/', cookie) {
  if (!imageUrl) return undefined;
  try {
    const parsed = assertPublicHttpUrl(imageUrl);
    const headers = { 'User-Agent': DEFAULT_USER_AGENT, Referer: referer };
    const effectiveCookie = await buildCookieHeaderForUrl(parsed.toString(), cookie);
    if (effectiveCookie) headers['Cookie'] = effectiveCookie;
    const resp = await fetch(parsed.toString(), { headers, signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return undefined;
    const ct = resp.headers.get('content-type') || 'image/jpeg';
    if (!ct.startsWith('image/')) return undefined;
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.byteLength > 3 * 1024 * 1024) return undefined;
    return `data:${ct.split(';')[0]};base64,${buf.toString('base64')}`;
  } catch {
    return undefined;
  }
}

async function fetchPixivNovelDetail(novelId, cookie) {
  const url = `https://www.pixiv.net/ajax/novel/${novelId}`;
  const headers = {
    'User-Agent': DEFAULT_USER_AGENT,
    Referer: 'https://www.pixiv.net/',
    Origin: 'https://www.pixiv.net',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'ja,vi;q=0.9,en-US;q=0.8,en;q=0.7',
  };
  const ck = await buildCookieHeaderForUrl(url, cookie);
  if (ck) headers['Cookie'] = ck;
  const resp = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  await mergeSetCookiesIntoSession(resp, new URL(url));
  if (!resp.ok) throw new Error(`Không thể tải truyện Pixiv #${novelId} (HTTP ${resp.status}).`);
  const json = await resp.json();
  if (json.error || !json.body) {
    throw new Error(json.message || `Không thể truy cập truyện Pixiv #${novelId}.`);
  }
  return json.body;
}

async function inspectPixivSeries(seriesId, cookie) {
  const headers = {
    'User-Agent': DEFAULT_USER_AGENT,
    Referer: 'https://www.pixiv.net/',
    Origin: 'https://www.pixiv.net',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'ja,vi;q=0.9,en-US;q=0.8,en;q=0.7',
  };
  const ck = await buildCookieHeaderForUrl('https://www.pixiv.net/', cookie);
  if (ck) headers['Cookie'] = ck;

  const seriesResp = await fetch(`https://www.pixiv.net/ajax/novel/series/${seriesId}`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!seriesResp.ok) throw new Error(`Không tìm thấy series Pixiv #${seriesId} (HTTP ${seriesResp.status}).`);
  const seriesJson = await seriesResp.json();
  if (seriesJson.error || !seriesJson.body) {
    throw new Error(seriesJson.message || 'Không thể đọc thông tin series Pixiv.');
  }

  const sBody = seriesJson.body;
  const totalCount = Number(sBody.total || sBody.publishedContentCount || 0);
  const tagSet = new Set(Array.isArray(sBody.tags) ? sBody.tags.filter(Boolean) : []);
  const contentEntries = [];
  const thumbnailMap = new Map();
  let lastOrder = 0;
  let safetyLoop = 0;

  while (safetyLoop < 50) {
    safetyLoop++;
    const contentUrl = `https://www.pixiv.net/ajax/novel/series_content/${seriesId}?limit=30&last_order=${lastOrder}&order_by=asc`;
    const cResp = await fetch(contentUrl, { headers, signal: AbortSignal.timeout(15000) });
    if (!cResp.ok) break;
    const cJson = await cResp.json();
    if (cJson.error || !cJson.body) break;
    for (const tn of cJson.body.thumbnails?.novel || []) {
      if (tn?.id) thumbnailMap.set(String(tn.id), tn);
    }
    const pageItems = cJson.body.page?.seriesContents || [];
    if (pageItems.length === 0) break;
    for (const item of pageItems) {
      const id = String(item.id);
      const order = Number(item.series?.contentOrder ?? contentEntries.length + 1);
      if (!contentEntries.some((e) => e.id === id)) contentEntries.push({ id, order });
      lastOrder = Math.max(lastOrder + 1, order);
    }
    if (pageItems.length < 30 || (totalCount > 0 && contentEntries.length >= totalCount)) break;
  }

  contentEntries.sort((a, b) => a.order - b.order);
  let fallbackCoverUrl = sBody.cover?.urls?.['480mw'] || sBody.cover?.urls?.original || sBody.cover?.urls?.['240mw'];
  let requiresCookie = false;
  let restrictionNotice;

  const chapters = contentEntries.map((entry, idx) => {
    const thumb = thumbnailMap.get(entry.id);
    if (thumb && Array.isArray(thumb.tags)) thumb.tags.forEach((t) => t && tagSet.add(t));
    if (!fallbackCoverUrl && thumb?.url) fallbackCoverUrl = thumb.url;
    if (Number(thumb?.xRestrict || 0) >= 1 && !ck) requiresCookie = true;
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

  if (chapters.length > 0) {
    try {
      const detail = await fetchPixivNovelDetail(chapters[0].id, cookie);
      if (detail.title) chapters[0].title = detail.title;
      if (!detail.content) {
        restrictionNotice = getPixivRestrictionReason(detail);
        chapters[0].available = false;
        chapters[0].requiresCookie = true;
        requiresCookie = true;
      } else {
        chapters[0].wordCount = countWordsSimple(detail.content);
      }
      if (!fallbackCoverUrl && detail.coverUrl) fallbackCoverUrl = detail.coverUrl;
    } catch {
      // ignore
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

async function inspectPixivSingleNovel(novelId, cookie) {
  const detail = await fetchPixivNovelDetail(novelId, cookie);
  const tags = detail.tags?.tags?.map((t) => t?.tag).filter(Boolean) || [];
  const restriction = getPixivRestrictionReason(detail);
  const rawContent = typeof detail.content === 'string' ? detail.content : '';
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

async function fetchHtmlWithCharset(targetUrl, cookie) {
  const parsed = assertPublicHttpUrl(targetUrl);
  const headers = {
    'User-Agent': DEFAULT_USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'vi,ja;q=0.9,en-US;q=0.8,en;q=0.7',
    Referer: parsed.origin + '/',
  };
  const ck = await buildCookieHeaderForUrl(parsed.toString(), cookie);
  if (ck) headers['Cookie'] = ck;

  const resp = await fetch(parsed.toString(), { headers, signal: AbortSignal.timeout(15000) });
  await mergeSetCookiesIntoSession(resp, parsed);
  if (!resp.ok) throw new Error(`Không thể truy cập trang web (HTTP ${resp.status}).`);

  const buffer = Buffer.from(await resp.arrayBuffer());
  const ct = resp.headers.get('content-type') || '';
  let charset = 'utf-8';
  const ctMatch = ct.match(/charset=([^;\s]+)/i);
  if (ctMatch) charset = ctMatch[1].replace(/['"]/g, '').toLowerCase();
  else {
    const metaMatch = buffer.subarray(0, 4096).toString('latin1').match(/charset=["']?([a-zA-Z0-9_-]+)/i);
    if (metaMatch) charset = metaMatch[1].toLowerCase();
  }
  let html;
  try {
    html = new TextDecoder(charset).decode(buffer);
  } catch {
    html = new TextDecoder('utf-8').decode(buffer);
  }
  return { html, finalUrl: resp.url || parsed.toString() };
}

function extractArticleText($) {
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
  let targetEl = null;
  for (const sel of prioritySelectors) {
    const found = $(sel).first();
    if (found.length && found.text().trim().length > 150) {
      targetEl = found;
      break;
    }
  }
  if (!targetEl) targetEl = $('body');
  const clone = targetEl.clone();
  clone.find('script, style, noscript, iframe, nav, header, footer, aside, .ads, .advertisement').remove();
  const blocks = [];
  const pNodes = clone.find('p');
  if (pNodes.length >= 2) {
    pNodes.each((_, el) => {
      const txt = stripHtmlToText($(el).html() || '');
      if (txt) blocks.push(txt);
    });
    if (blocks.length > 0) return blocks.join('\n\n');
  }
  return stripHtmlToText(clone.html() || '');
}

async function inspectGenericWebUrl(rawUrl, cookie) {
  const { html, finalUrl } = await fetchHtmlWithCharset(rawUrl, cookie);
  const $ = cheerio.load(html);
  const baseUrl = new URL(finalUrl);
  const h1Title = $('h1').first().text().trim();
  const title = h1Title || $('meta[property="og:title"]').attr('content')?.trim() || $('title').text().trim() || baseUrl.hostname;
  const author =
    $('meta[name="author"]').attr('content')?.trim() ||
    $('.novel_writername a').first().text().trim() ||
    $('[itemprop="author"]').first().text().trim() ||
    'Khuyết danh';
  const description =
    $('meta[property="og:description"]').attr('content')?.trim() ||
    $('meta[name="description"]').attr('content')?.trim() ||
    '';

  const tocSelectors = [
    '.index_box .novel_sublist2 a',
    '.p-eplist__sublist a.p-eplist__subtitle',
    '.widget-toc-episode a',
    '#list-chapter .list-chapter a',
    '.list-chapter a',
    '.chapter-list a',
    '#chapters a',
  ];
  const foundLinks = [];
  const seenUrls = new Set();
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
        } catch {}
      });
      if (foundLinks.length >= 2) break;
    }
  }

  const rawCover = $('meta[property="og:image"]').attr('content')?.trim();
  const coverDataUrl = rawCover ? await fetchImageAsDataUrl(new URL(rawCover, baseUrl).toString(), baseUrl.origin + '/', cookie) : undefined;

  if (foundLinks.length >= 2) {
    return {
      sourceType: 'web-toc',
      normalizedUrl: finalUrl,
      title,
      author,
      description,
      tags: [],
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
    tags: [],
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

function setupIpcHandlers() {
  ipcMain.handle('desktop:getAllCookies', async () => listGroupedCookieJars());

  ipcMain.handle('desktop:syncCookieJars', async (_e, jars) => {
    const browserSession = getBrowserSession();
    if (Array.isArray(jars)) {
      for (const jar of jars) {
        for (const c of jar?.cookies || []) {
          if (!c?.name) continue;
          const host = (c.domain || jar.domain).replace(/^\.+/, '');
          try {
            await browserSession.cookies.set({
              url: `https://${host}${c.path || '/'}`,
              name: c.name,
              value: c.value || '',
              path: c.path || '/',
              httpOnly: Boolean(c.httpOnly),
              secure: Boolean(c.secure),
              expirationDate: c.expiresAt ? Math.round(c.expiresAt / 1000) : undefined,
            });
          } catch {}
        }
      }
    }
    return listGroupedCookieJars();
  });

  ipcMain.handle('desktop:setManualCookie', async (_e, { domainOrUrl, cookieString }) => {
    const baseDomain = extractBaseDomain(domainOrUrl);
    const trimmed = String(cookieString || '').trim();
    const normalized = !trimmed.includes('=') && baseDomain === 'pixiv.net' ? `PHPSESSID=${trimmed}` : trimmed;
    const browserSession = getBrowserSession();
    for (const part of normalized.split(';')) {
      const p = part.trim();
      const eqIdx = p.indexOf('=');
      if (eqIdx <= 0) continue;
      const name = p.slice(0, eqIdx).trim();
      const value = p.slice(eqIdx + 1).trim();
      if (!name) continue;
      await browserSession.cookies.set({
        url: `https://${baseDomain}/`,
        name,
        value,
        domain: `.${baseDomain}`,
        path: '/',
        secure: true,
      });
    }
    return listGroupedCookieJars();
  });

  ipcMain.handle('desktop:clearDomainCookies', async (_e, domain) => {
    const base = extractBaseDomain(domain);
    const browserSession = getBrowserSession();
    const cookies = await browserSession.cookies.get({});
    for (const c of cookies) {
      if (extractBaseDomain(c.domain || '') === base) {
        const cleanHost = (c.domain || base).replace(/^\.+/, '');
        const scheme = c.secure ? 'https' : 'http';
        await browserSession.cookies.remove(`${scheme}://${cleanHost}${c.path || '/'}`, c.name).catch(() => {});
      }
    }
    return listGroupedCookieJars();
  });

  ipcMain.handle('desktop:getPreferredLang', async () => preferredLang);
  ipcMain.handle('desktop:setPreferredLang', async (_e, lang) => {
    preferredLang = lang === 'ja' ? 'ja' : 'en';
    return preferredLang;
  });

  ipcMain.handle('desktop:inspectUrl', async (_e, { url, cookie }) => {
    const parsed = assertPublicHttpUrl(url);
    const urlStr = parsed.toString();
    const seriesMatch = urlStr.match(/pixiv\.net\/(?:[a-z]{2}\/)?novel\/series\/(\d+)/i);
    if (seriesMatch) return inspectPixivSeries(seriesMatch[1], cookie);
    const novelMatch = urlStr.match(/pixiv\.net\/(?:[a-z]{2}\/)?novel\/show\.php\?.*id=(\d+)/i);
    if (novelMatch) return inspectPixivSingleNovel(novelMatch[1], cookie);
    return inspectGenericWebUrl(urlStr, cookie);
  });

  ipcMain.handle('desktop:fetchChapter', async (_e, { url, sourceType, novelId, cookie }) => {
    assertPublicHttpUrl(url);
    if (sourceType === 'pixiv-novel') {
      const resolvedId = novelId || url.match(/id=(\d+)/i)?.[1] || url.match(/(\d+)/)?.[1];
      if (!resolvedId) throw new Error('Không xác định được ID chương Pixiv.');
      const detail = await fetchPixivNovelDetail(resolvedId, cookie);
      const restriction = getPixivRestrictionReason(detail);
      if (restriction) throw new Error(restriction);
      const cleaned = cleanPixivNovelContent(detail.content || '');
      if (!cleaned.trim()) throw new Error('Nội dung chương Pixiv trống.');
      const tags = detail.tags?.tags?.map((t) => t?.tag).filter(Boolean) || [];
      return {
        title: detail.title || `Chương ${resolvedId}`,
        content: cleaned,
        wordCount: countWordsSimple(cleaned),
        tags,
      };
    }
    const { html } = await fetchHtmlWithCharset(url, cookie);
    const $ = cheerio.load(html);
    const h1Title = $('h1').first().text().trim() || $('.chapter-title').first().text().trim();
    const content = extractArticleText($);
    if (!content || !content.trim()) throw new Error('Không trích xuất được nội dung văn bản từ trang chương này.');
    return {
      title: h1Title || $('title').text().trim() || 'Chương',
      content,
      wordCount: countWordsSimple(content),
      tags: [],
    };
  });

  ipcMain.handle('desktop:translate', async (_e, joinedPayload) => {
    const upstreamBody = new URLSearchParams({
      sajax: 'trans',
      content: joinedPayload,
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
    if (
      cfMitigated === 'challenge' ||
      /^\s*<!doctype html/i.test(rawText) ||
      rawText.includes('_cf_chl_opt') ||
      rawText.includes('Just a moment...')
    ) {
      throw new Error('Máy chủ dịch đang bật xác minh bảo mật (HTTP 403) đối với IP hiện tại.');
    }
    if (!upstreamRes.ok) throw new Error(`Dịch vụ dịch trả về lỗi HTTP ${upstreamRes.status}.`);
    if (!rawText || !rawText.trim()) throw new Error('Dịch vụ dịch trả về phản hồi rỗng.');
    return rawText;
  });

  ipcMain.handle('desktop:analyzePhrase', async (_e, phrase) => {
    const rawPhrase = typeof phrase === 'string' ? phrase.trim() : '';
    if (!rawPhrase || rawPhrase.length > 160) return {};

    const fetchGtx = async (tl) => {
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=${tl}&dt=t&q=${encodeURIComponent(rawPhrase)}`;
        const r = await fetch(url, {
          headers: { 'User-Agent': DEFAULT_USER_AGENT },
          signal: AbortSignal.timeout(4500),
        });
        if (!r.ok) return undefined;
        const text = await r.text();
        if (!text.trim().startsWith('[')) return undefined;
        const data = JSON.parse(text);
        if (Array.isArray(data?.[0])) {
          const joined = data[0].map((part) => (Array.isArray(part) ? part[0] || '' : '')).join('').trim();
          return joined || undefined;
        }
      } catch {
        return undefined;
      }
      return undefined;
    };

    const fetchStvVi = async () => {
      try {
        const body = new URLSearchParams({ sajax: 'trans', content: rawPhrase }).toString();
        const r = await fetch('https://comic.sangtacvietcdn.xyz/tsm.php?cdn=/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': DEFAULT_USER_AGENT,
            Accept: 'text/plain, */*',
          },
          body,
          signal: AbortSignal.timeout(5000),
        });
        if (!r.ok) return undefined;
        const t = await r.text();
        if (!t.trim() || /^\s*<!doctype/i.test(t) || t.includes('_cf_chl_opt')) return undefined;
        return t.trim();
      } catch {
        return undefined;
      }
    };

    const [nameEng, viStv, viGtx] = await Promise.all([
      fetchGtx('en'),
      fetchStvVi(),
      fetchGtx('vi'),
    ]);
    return {
      ...(viStv || viGtx ? { vi: viStv || viGtx } : {}),
      ...(nameEng ? { nameEng } : {}),
    };
  });
}

function createWindow() {
  const browserSession = getBrowserSession();
  browserSession.setUserAgent(DEFAULT_USER_AGENT);
  browserSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const reqHeaders = { ...details.requestHeaders };
    reqHeaders['Accept-Language'] =
      preferredLang === 'ja' ? 'ja,en-US;q=0.8,en;q=0.7' : 'en-US,en;q=0.9,vi;q=0.8,ja;q=0.5';
    callback({ requestHeaders: reqHeaders });
  });

  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#171717',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  win.webContents.on('did-attach-webview', (_event, webContents) => {
    webContents.setWindowOpenHandler(({ url }) => {
      if (url && /^https?:\/\//i.test(url)) {
        webContents.loadURL(url).catch(() => {});
      }
      return { action: 'deny' };
    });
  });

  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function checkForUpdates() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('error', (error) => {
    console.warn('VBook update check failed:', error.message);
  });
  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    console.warn('VBook update check failed:', error.message);
  });
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();
  checkForUpdates();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
