import type { Express, Request, Response } from 'express';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

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

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COOKIE_STORE_FILE = path.resolve(__dirname, '.browser-cookies.json');

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

const serverCookieStore = new Map<string, SiteCookieJar>();

function loadCookiesFromDisk() {
  try {
    if (!fs.existsSync(COOKIE_STORE_FILE)) return;
    const raw = fs.readFileSync(COOKIE_STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const jar of parsed) {
        if (jar?.domain && Array.isArray(jar.cookies)) {
          serverCookieStore.set(extractBaseDomain(jar.domain), jar);
        }
      }
    }
  } catch {
    // Ignore corrupt or unavailable cookie store file
  }
}

let persistTimer: NodeJS.Timeout | null = null;
function schedulePersistToDisk() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      const list = Array.from(serverCookieStore.values());
      fs.writeFileSync(COOKIE_STORE_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch {
      // Best-effort persistence (e.g. read-only FS safe)
    }
  }, 150);
}

loadCookiesFromDisk();

function parseSetCookieHeader(raw: string, requestUrl: URL): StoredCookieEntry | null {
  const parts = raw.split(';').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const eqIdx = parts[0].indexOf('=');
  if (eqIdx <= 0) return null;

  const name = parts[0].slice(0, eqIdx).trim();
  const value = parts[0].slice(eqIdx + 1).trim();

  let domain = requestUrl.hostname.toLowerCase();
  let cookiePath = '/';
  let expiresAt: number | undefined;
  let httpOnly = false;
  let secure = false;

  for (let i = 1; i < parts.length; i++) {
    const attr = parts[i];
    const attrEq = attr.indexOf('=');
    const key = (attrEq >= 0 ? attr.slice(0, attrEq) : attr).trim().toLowerCase();
    const val = attrEq >= 0 ? attr.slice(attrEq + 1).trim() : '';

    if (key === 'domain' && val) {
      domain = val.replace(/^\.+/, '').toLowerCase();
    } else if (key === 'path' && val) {
      cookiePath = val.startsWith('/') ? val : '/';
    } else if (key === 'max-age' && val) {
      const secs = Number(val);
      if (!Number.isNaN(secs)) {
        expiresAt = secs <= 0 ? 1 : Date.now() + secs * 1000;
      }
    } else if (key === 'expires' && val && expiresAt === undefined) {
      const ts = Date.parse(val);
      if (!Number.isNaN(ts)) {
        expiresAt = ts;
      }
    } else if (key === 'httponly') {
      httpOnly = true;
    } else if (key === 'secure') {
      secure = true;
    }
  }

  return {
    name,
    value,
    domain,
    path: cookiePath,
    expiresAt,
    httpOnly,
    secure,
  };
}

function upsertCookieEntry(baseDomain: string, entry: StoredCookieEntry) {
  const existing = serverCookieStore.get(baseDomain) || {
    domain: baseDomain,
    cookies: [],
    updatedAt: Date.now(),
  };

  const now = Date.now();
  // Remove expired or matching cookie slot
  const filtered = existing.cookies.filter((c) => {
    if (c.expiresAt && c.expiresAt <= now) return false;
    return !(
      c.name === entry.name &&
      c.domain.toLowerCase() === entry.domain.toLowerCase() &&
      c.path === entry.path
    );
  });

  // Only keep if not explicitly deleted/expired (Max-Age=0 or empty expired)
  if (!entry.expiresAt || entry.expiresAt > now) {
    filtered.push(entry);
  }

  serverCookieStore.set(baseDomain, {
    domain: baseDomain,
    cookies: filtered,
    updatedAt: now,
  });
}

export function mergeCookiesFromResponse(resp: globalThis.Response, requestUrl: URL): number {
  const headersAny = resp.headers as unknown as {
    getSetCookie?: () => string[];
    raw?: () => Record<string, string[]>;
  };

  let setCookies: string[] = [];
  if (typeof headersAny.getSetCookie === 'function') {
    setCookies = headersAny.getSetCookie();
  } else {
    const single = resp.headers.get('set-cookie');
    if (single) setCookies = [single];
  }

  if (setCookies.length === 0) return 0;

  let added = 0;
  for (const raw of setCookies) {
    const entry = parseSetCookieHeader(raw, requestUrl);
    if (!entry) continue;
    const baseDomain = extractBaseDomain(entry.domain || requestUrl.hostname);
    upsertCookieEntry(baseDomain, entry);
    added++;
  }

  if (added > 0) {
    schedulePersistToDisk();
  }
  return added;
}

function parseManualCookieString(cookieString: string, targetHostOrDomain: string): StoredCookieEntry[] {
  const trimmed = cookieString.trim();
  if (!trimmed) return [];

  const baseDomain = extractBaseDomain(targetHostOrDomain);
  // If user pasted raw PHPSESSID token without '=' on pixiv.net
  const normalized =
    !trimmed.includes('=') && baseDomain === 'pixiv.net' ? `PHPSESSID=${trimmed}` : trimmed;

  const entries: StoredCookieEntry[] = [];
  for (const part of normalized.split(';')) {
    const p = part.trim();
    if (!p) continue;
    const eqIdx = p.indexOf('=');
    if (eqIdx <= 0) continue;
    const name = p.slice(0, eqIdx).trim();
    const value = p.slice(eqIdx + 1).trim();
    if (!name) continue;
    entries.push({
      name,
      value,
      domain: baseDomain,
      path: '/',
    });
  }
  return entries;
}

export function getServerCookieHeaderForUrl(targetUrl: string, overrideCookie?: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return overrideCookie?.trim() || undefined;
  }

  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname || '/';
  const baseDomain = extractBaseDomain(hostname);
  const jar = serverCookieStore.get(baseDomain);

  const cookieMap = new Map<string, string>();
  const now = Date.now();

  if (jar) {
    for (const c of jar.cookies) {
      if (c.expiresAt && c.expiresAt <= now) continue;
      const cDom = c.domain.toLowerCase().replace(/^\.+/, '');
      const domainMatch = hostname === cDom || hostname.endsWith(`.${cDom}`);
      const cPath = c.path || '/';
      const pathMatch = pathname.startsWith(cPath);
      if (domainMatch && pathMatch) {
        cookieMap.set(c.name, c.value);
      }
    }
  }

  if (overrideCookie && overrideCookie.trim()) {
    const manualEntries = parseManualCookieString(overrideCookie, hostname);
    for (const m of manualEntries) {
      cookieMap.set(m.name, m.value);
    }
  }

  if (cookieMap.size === 0) return undefined;
  return Array.from(cookieMap.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function toProxyUrl(rawRef: string, baseUrl: URL): string {
  const trimmed = rawRef.trim();
  if (
    !trimmed ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('/api/browser/proxy')
  ) {
    return rawRef;
  }

  try {
    const abs = new URL(trimmed, baseUrl);
    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') {
      return rawRef;
    }
    return `/api/browser/proxy?url=${encodeURIComponent(abs.toString())}`;
  } catch {
    return rawRef;
  }
}

function rewriteCssUrls(css: string, baseUrl: URL): string {
  let out = css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, _quote, ref) => {
    const rewritten = toProxyUrl(ref, baseUrl);
    return rewritten === ref ? full : `url("${rewritten}")`;
  });
  out = out.replace(/@import\s+(['"])([^'"]+)\1/gi, (full, quote, ref) => {
    const rewritten = toProxyUrl(ref, baseUrl);
    return rewritten === ref ? full : `@import ${quote}${rewritten}${quote}`;
  });
  return out;
}

function getClientReadableCookiesForUrl(targetUrl: URL): Array<{ name: string; value: string }> {
  const hostname = targetUrl.hostname.toLowerCase();
  const pathname = targetUrl.pathname || '/';
  const baseDomain = extractBaseDomain(hostname);
  const jar = serverCookieStore.get(baseDomain);
  if (!jar) return [];

  const now = Date.now();
  const map = new Map<string, string>();
  for (const c of jar.cookies) {
    if (c.httpOnly) continue;
    if (c.expiresAt && c.expiresAt <= now) continue;
    const cDom = c.domain.toLowerCase().replace(/^\.+/, '');
    const domainMatch = hostname === cDom || hostname.endsWith(`.${cDom}`);
    const cPath = c.path || '/';
    const pathMatch = pathname.startsWith(cPath);
    if (domainMatch && pathMatch) {
      map.set(c.name, c.value);
    }
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

function buildInjectedProxyScript(finalUrl: string, initialCookies: Array<{ name: string; value: string }>): string {
  const safeTargetJson = JSON.stringify(finalUrl);
  const safeCookiesJson = JSON.stringify(initialCookies);
  return `<script data-reader-proxy="1">
(function() {
  var TARGET_URL = ${safeTargetJson};
  var PROXY_PREFIX = '/api/browser/proxy?url=';
  var SEEDED_COOKIES = {};
  try {
    (${safeCookiesJson}).forEach(function(item) {
      if (item && item.name) SEEDED_COOKIES[item.name] = item.value || '';
    });
  } catch (e) {}

  function toProxy(raw) {
    if (!raw || typeof raw !== 'string') return raw;
    var t = raw.trim();
    if (!t || t[0] === '#' || t.indexOf('data:') === 0 || t.indexOf('blob:') === 0 || t.indexOf('javascript:') === 0 || t.indexOf('mailto:') === 0 || t.indexOf('tel:') === 0 || t.indexOf('/api/browser/') === 0) {
      return raw;
    }
    try {
      var u = new URL(t, window.location.origin);
      if (u.pathname === '/api/browser/proxy') return raw;
    } catch (e) {}
    try {
      var abs = new URL(t, TARGET_URL);
      if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return raw;
      return PROXY_PREFIX + encodeURIComponent(abs.toString());
    } catch (e) {
      return raw;
    }
  }

  function rewriteSrcsetClient(srcset) {
    if (!srcset || typeof srcset !== 'string') return srcset;
    return srcset.split(/,(?=\\s*(?:https?:|\\/\\/|\\/|data:|blob:|[^\\s,]+\\s+\\d+[wx]))/i).map(function(part) {
      var trimmed = part.trim();
      if (!trimmed) return part;
      var firstSpace = trimmed.search(/\\s/);
      if (firstSpace === -1) return toProxy(trimmed);
      var urlPart = trimmed.slice(0, firstSpace);
      var descPart = trimmed.slice(firstSpace);
      return toProxy(urlPart) + descPart;
    }).join(', ');
  }

  function rewriteStyleClient(css) {
    if (!css || typeof css !== 'string' || css.indexOf('url(') === -1) return css;
    return css.replace(/url\\(\\s*(['"]?)([^'")]+)\\1\\s*\\)/gi, function(full, _q, ref) {
      var rw = toProxy(ref);
      return rw === ref ? full : 'url("' + rw + '")';
    });
  }

  function unwrapProxy(maybeProxied) {
    if (!maybeProxied || typeof maybeProxied !== 'string') return TARGET_URL;
    try {
      var u = new URL(maybeProxied, window.location.origin);
      if (u.pathname === '/api/browser/proxy') {
        return u.searchParams.get('url') || TARGET_URL;
      }
    } catch (e) {}
    try {
      return new URL(maybeProxied, TARGET_URL).toString();
    } catch (e) {}
    return maybeProxied;
  }

  function notifyParent(url) {
    try {
      window.parent.postMessage({
        type: 'reader-browser-state',
        url: url || TARGET_URL,
        title: document.title || ''
      }, '*');
    } catch (e) {}
  }

  // Prevent proxied sites from registering service workers on app origin
  try {
    if (navigator && navigator.serviceWorker && navigator.serviceWorker.register) {
      navigator.serviceWorker.register = function() {
        return Promise.reject(new Error('ServiceWorker disabled in proxy browser'));
      };
    }
  } catch (e) {}

  // Intercept document.cookie reads & writes so JS CSRF/auth cookies work and sync to cookie jar
  try {
    var cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') || Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
    if (cookieDesc && cookieDesc.set && cookieDesc.get) {
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        enumerable: true,
        get: function() {
          var merged = Object.assign({}, SEEDED_COOKIES);
          try {
            var nativeStr = cookieDesc.get.call(document) || '';
            nativeStr.split(';').forEach(function(p) {
              var idx = p.indexOf('=');
              if (idx > 0) {
                merged[p.slice(0, idx).trim()] = p.slice(idx + 1).trim();
              }
            });
          } catch (e) {}
          return Object.keys(merged).map(function(k) { return k + '=' + merged[k]; }).join('; ');
        },
        set: function(val) {
          try {
            var rawStr = String(val);
            var firstPart = rawStr.split(';')[0] || '';
            var eqIdx = firstPart.indexOf('=');
            if (eqIdx > 0) {
              SEEDED_COOKIES[firstPart.slice(0, eqIdx).trim()] = firstPart.slice(eqIdx + 1).trim();
            }
            fetch('/api/browser/cookies/client-set', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: TARGET_URL, cookie: rawStr })
            }).then(function() { notifyParent(TARGET_URL); }).catch(function() {});
          } catch (e) {}
          return cookieDesc.set.call(document, val);
        }
      });
    }
  } catch (e) {}

  // Hook property setters on dynamic DOM elements (fixes React/Next.js images, scripts, stylesheets)
  function hookUrlProp(proto, prop, transformer) {
    try {
      if (!proto) return;
      var desc = Object.getOwnPropertyDescriptor(proto, prop);
      if (!desc || !desc.set || !desc.get) return;
      Object.defineProperty(proto, prop, {
        configurable: true,
        enumerable: true,
        get: function() {
          return desc.get.call(this);
        },
        set: function(val) {
          var next = typeof val === 'string' ? transformer(val) : val;
          return desc.set.call(this, next);
        }
      });
    } catch (e) {}
  }

  hookUrlProp(HTMLImageElement.prototype, 'src', toProxy);
  hookUrlProp(HTMLImageElement.prototype, 'srcset', rewriteSrcsetClient);
  hookUrlProp(HTMLScriptElement.prototype, 'src', toProxy);
  hookUrlProp(HTMLLinkElement.prototype, 'href', toProxy);
  hookUrlProp(HTMLSourceElement.prototype, 'src', toProxy);
  hookUrlProp(HTMLSourceElement.prototype, 'srcset', rewriteSrcsetClient);
  hookUrlProp(HTMLVideoElement.prototype, 'src', toProxy);
  hookUrlProp(HTMLVideoElement.prototype, 'poster', toProxy);
  hookUrlProp(HTMLAudioElement.prototype, 'src', toProxy);
  hookUrlProp(HTMLIFrameElement.prototype, 'src', toProxy);
  hookUrlProp(HTMLFormElement.prototype, 'action', toProxy);

  // Hook Element.prototype.setAttribute for React / DOM hydration / dynamic attributes
  var origSetAttr = Element.prototype.setAttribute;
  try {
    Element.prototype.setAttribute = function(name, value) {
      try {
        var lower = String(name).toLowerCase();
        var strVal = String(value);
        if (lower === 'src' || lower === 'poster' || lower === 'action' || lower === 'data-src' || lower === 'data-original') {
          value = toProxy(strVal);
        } else if (lower === 'srcset') {
          value = rewriteSrcsetClient(strVal);
        } else if (lower === 'href' && this.tagName !== 'BASE') {
          value = toProxy(strVal);
        } else if (lower === 'style') {
          value = rewriteStyleClient(strVal);
        }
      } catch (e) {}
      return origSetAttr.call(this, name, value);
    };
  } catch (e) {}

  // Hook CSSStyleDeclaration.setProperty & backgroundImage for React style={{ backgroundImage: 'url(...)' }}
  try {
    if (window.CSSStyleDeclaration && CSSStyleDeclaration.prototype) {
      var origCssSetProp = CSSStyleDeclaration.prototype.setProperty;
      CSSStyleDeclaration.prototype.setProperty = function(prop, val, priority) {
        if (typeof val === 'string' && val.indexOf('url(') !== -1) {
          val = rewriteStyleClient(val);
        }
        return origCssSetProp.call(this, prop, val, priority);
      };
      ['backgroundImage', 'background'].forEach(function(prop) {
        var desc = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, prop);
        if (desc && desc.set && desc.get) {
          Object.defineProperty(CSSStyleDeclaration.prototype, prop, {
            configurable: true,
            enumerable: true,
            get: function() { return desc.get.call(this); },
            set: function(val) {
              if (typeof val === 'string' && val.indexOf('url(') !== -1) {
                val = rewriteStyleClient(val);
              }
              return desc.set.call(this, val);
            }
          });
        }
      });
    }
  } catch (e) {}

  // Rewrite any dynamically inserted elements via innerHTML / React portals
  function fixElementTree(node) {
    if (!node || node.nodeType !== 1) return;
    try {
      if (node.hasAttribute && node.hasAttribute('src')) {
        var s = node.getAttribute('src');
        var ns = toProxy(s);
        if (ns !== s) origSetAttr.call(node, 'src', ns);
      }
      if (node.hasAttribute && node.hasAttribute('srcset')) {
        var ss = node.getAttribute('srcset');
        var nss = rewriteSrcsetClient(ss);
        if (nss !== ss) origSetAttr.call(node, 'srcset', nss);
      }
      if (node.hasAttribute && node.hasAttribute('style')) {
        var st = node.getAttribute('style');
        var nst = rewriteStyleClient(st);
        if (nst !== st) origSetAttr.call(node, 'style', nst);
      }
      if (node.querySelectorAll) {
        var kids = node.querySelectorAll('[src],[srcset],[style*="url("],link[href],form[action]');
        for (var i = 0; i < kids.length; i++) {
          var k = kids[i];
          var ks = k.getAttribute('src');
          if (ks) { var kns = toProxy(ks); if (kns !== ks) origSetAttr.call(k, 'src', kns); }
          var kss = k.getAttribute('srcset');
          if (kss) { var knss = rewriteSrcsetClient(kss); if (knss !== kss) origSetAttr.call(k, 'srcset', knss); }
          var kst = k.getAttribute('style');
          if (kst && kst.indexOf('url(') !== -1) { var knst = rewriteStyleClient(kst); if (knst !== kst) origSetAttr.call(k, 'style', knst); }
          if (k.tagName === 'LINK') {
            var kh = k.getAttribute('href');
            if (kh) { var knh = toProxy(kh); if (knh !== kh) origSetAttr.call(k, 'href', knh); }
          }
          if (k.tagName === 'FORM') {
            var ka = k.getAttribute('action');
            if (ka) { var kna = toProxy(ka); if (kna !== ka) origSetAttr.call(k, 'action', kna); }
          }
        }
      }
    } catch (e) {}
  }

  try {
    var mo = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === 'childList') {
          for (var j = 0; j < m.addedNodes.length; j++) {
            fixElementTree(m.addedNodes[j]);
          }
        } else if (m.type === 'attributes' && m.target) {
          fixElementTree(m.target);
        }
      }
    });
    mo.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'srcset', 'style']
    });
  } catch (e) {}

  // Intercept fetch (strings, URLs, and Request objects)
  if (typeof window.fetch === 'function') {
    var origFetch = window.fetch.bind(window);
    window.fetch = function(input, init) {
      try {
        if (typeof input === 'string') {
          if (input.indexOf('/api/browser/') !== 0) {
            input = toProxy(input);
          }
        } else if (input instanceof URL) {
          var urlStr = input.toString();
          if (urlStr.indexOf(window.location.origin + '/api/browser/') !== 0) {
            input = toProxy(urlStr);
          }
        } else if (input && typeof input === 'object' && input.url && input.url.indexOf('/api/browser/') === -1) {
          var nextUrl = toProxy(input.url);
          if (nextUrl !== input.url) {
            var clonedHeaders = {};
            if (input.headers && input.headers.forEach) {
              input.headers.forEach(function(v, k) { clonedHeaders[k] = v; });
            }
            var reqInit = Object.assign({
              method: input.method,
              headers: clonedHeaders,
              credentials: 'same-origin',
              redirect: input.redirect
            }, init || {});
            if (input.method !== 'GET' && input.method !== 'HEAD' && !reqInit.body) {
              return input.clone().arrayBuffer().then(function(buf) {
                if (buf && buf.byteLength > 0) reqInit.body = buf;
                return origFetch(nextUrl, reqInit);
              }).then(function(resp) {
                notifyParent(TARGET_URL);
                return resp;
              });
            }
            input = nextUrl;
            init = reqInit;
          }
        }
      } catch (e) {}
      return origFetch(input, init).then(function(resp) {
        notifyParent(TARGET_URL);
        return resp;
      });
    };
  }

  // Intercept XMLHttpRequest
  if (window.XMLHttpRequest) {
    var origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      var args = Array.prototype.slice.call(arguments);
      if (url != null) {
        var uStr = String(url);
        if (uStr.indexOf('/api/browser/') !== 0) {
          args[1] = toProxy(uStr);
        }
      }
      return origOpen.apply(this, args);
    };
  }

  // Track SPA pushState / replaceState WITHOUT losing /api/browser/proxy path
  ['pushState', 'replaceState'].forEach(function(fn) {
    var orig = history[fn];
    history[fn] = function(state, title, url) {
      if (url != null) {
        var resolved = unwrapProxy(String(url));
        TARGET_URL = resolved;
        notifyParent(resolved);
        return orig.call(this, state, title, toProxy(resolved));
      }
      return orig.apply(this, arguments);
    };
  });

  // Intercept Navigation API (catches location.href = 'https://...' / location.assign / location.replace in Chromium)
  try {
    if (window.navigation && window.navigation.addEventListener) {
      window.navigation.addEventListener('navigate', function(event) {
        try {
          if (!event.cancelable || !event.destination || !event.destination.url) return;
          var dest = event.destination.url;
          var parsed = new URL(dest, window.location.origin);
          if (parsed.origin === window.location.origin && parsed.pathname === '/api/browser/proxy') {
            return;
          }
          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            event.preventDefault();
            var realDest = parsed.origin === window.location.origin
              ? new URL(parsed.pathname + parsed.search + parsed.hash, TARGET_URL).toString()
              : dest;
            window.location.replace(toProxy(realDest));
          }
        } catch (e) {}
      });
    }
  } catch (e) {}

  // Intercept window.open so popups stay inside the iframe
  try {
    window.open = function(url) {
      if (url) {
        window.location.href = toProxy(String(url));
      }
      return window;
    };
  } catch (e) {}

  // Intercept <form> submissions (fixes GET forms whose query params would wipe ?url=...)
  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    try {
      var method = (form.getAttribute('method') || 'GET').toUpperCase();
      var rawAction = form.getAttribute('action') || TARGET_URL;
      var realAction = unwrapProxy(rawAction);
      if (method === 'GET') {
        e.preventDefault();
        var actionUrl = new URL(realAction, TARGET_URL);
        var fd = new FormData(form);
        fd.forEach(function(val, key) {
          if (typeof val === 'string') {
            actionUrl.searchParams.append(key, val);
          }
        });
        window.location.href = toProxy(actionUrl.toString());
      } else {
        origSetAttr.call(form, 'action', toProxy(realAction));
        form.removeAttribute('target');
      }
    } catch (err) {}
  }, true);

  // Intercept dynamic anchor clicks (force stay inside iframe, handle _blank)
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el || !el.getAttribute) return;
    var href = el.getAttribute('href');
    if (!href || href[0] === '#' || href.indexOf('javascript:') === 0) return;
    e.preventDefault();
    var resolved = unwrapProxy(href);
    window.location.href = toProxy(resolved);
  }, true);

  document.addEventListener('DOMContentLoaded', function() {
    fixElementTree(document.documentElement);
    notifyParent(TARGET_URL);
  });
  window.addEventListener('load', function() {
    fixElementTree(document.documentElement);
    notifyParent(TARGET_URL);
  });
  notifyParent(TARGET_URL);
})();
</script>`;
}

function rewriteHtmlForProxy(html: string, finalUrl: URL): string {
  const $ = cheerio.load(html);

  // Remove CSP / frame-blocking meta tags & base tags case-insensitively
  $('meta[http-equiv]').each((_, el) => {
    const eq = ($(el).attr('http-equiv') || '').trim().toLowerCase();
    if (
      eq === 'content-security-policy' ||
      eq === 'content-security-policy-report-only' ||
      eq === 'x-frame-options'
    ) {
      $(el).remove();
    }
  });
  $('base').remove();

  // Rewrite attributes pointing to remote resources or links
  $('[href]').each((_, el) => {
    const val = $(el).attr('href');
    if (val) $(el).attr('href', toProxyUrl(val, finalUrl));
  });

  $('[xlink\\:href]').each((_, el) => {
    const val = $(el).attr('xlink:href');
    if (val) $(el).attr('xlink:href', toProxyUrl(val, finalUrl));
  });

  $('[src]').each((_, el) => {
    const val = $(el).attr('src');
    if (val) $(el).attr('src', toProxyUrl(val, finalUrl));
  });

  $('[poster]').each((_, el) => {
    const val = $(el).attr('poster');
    if (val) $(el).attr('poster', toProxyUrl(val, finalUrl));
  });

  $('[data-src], [data-original], [data-lazy-src]').each((_, el) => {
    for (const attr of ['data-src', 'data-original', 'data-lazy-src']) {
      const val = $(el).attr(attr);
      if (val) {
        const proxied = toProxyUrl(val, finalUrl);
        $(el).attr(attr, proxied);
        if (el.tagName === 'img' && !$(el).attr('src')) {
          $(el).attr('src', proxied);
        }
      }
    }
  });

  $('[action]').each((_, el) => {
    const val = $(el).attr('action');
    if (val) {
      $(el).attr('action', toProxyUrl(val, finalUrl));
    } else {
      $(el).attr('action', `/api/browser/proxy?url=${encodeURIComponent(finalUrl.toString())}`);
    }
  });

  $('form').each((_, el) => {
    if (!$(el).attr('action')) {
      $(el).attr('action', `/api/browser/proxy?url=${encodeURIComponent(finalUrl.toString())}`);
    }
    const target = $(el).attr('target');
    if (target === '_blank' || target === '_top' || target === '_parent') {
      $(el).removeAttr('target');
    }
  });

  $('a[target="_blank"], a[target="_top"], a[target="_parent"]').removeAttr('target');

  $('[srcset]').each((_, el) => {
    const srcset = $(el).attr('srcset');
    if (!srcset) return;
    const rewritten = srcset
      .split(/,(?=\s*(?:https?:|\/\/|\/|data:|blob:|[^\s,]+\s+\d+[wx]))/i)
      .map((part) => {
        const trimmed = part.trim();
        if (!trimmed) return part;
        const firstSpace = trimmed.search(/\s/);
        if (firstSpace === -1) return toProxyUrl(trimmed, finalUrl);
        const urlPart = trimmed.slice(0, firstSpace);
        const descPart = trimmed.slice(firstSpace);
        return `${toProxyUrl(urlPart, finalUrl)}${descPart}`;
      })
      .join(', ');
    $(el).attr('srcset', rewritten);
  });

  $('[style]').each((_, el) => {
    const styleVal = $(el).attr('style');
    if (styleVal && styleVal.includes('url(')) {
      $(el).attr('style', rewriteCssUrls(styleVal, finalUrl));
    }
  });

  $('style').each((_, el) => {
    const css = $(el).html();
    if (css) $(el).html(rewriteCssUrls(css, finalUrl));
  });

  $('[integrity]').removeAttr('integrity');
  $('[crossorigin]').removeAttr('crossorigin');

  const initialCookies = getClientReadableCookiesForUrl(finalUrl);
  const shim = buildInjectedProxyScript(finalUrl.toString(), initialCookies);
  const head = $('head').first();
  if (head.length > 0) {
    head.prepend(shim);
  } else {
    $.root().prepend(shim);
  }

  return $.html();
}

export function mountBrowserProxyRoutes(
  app: Express,
  assertPublicHttpUrl: (rawUrl: string) => URL
) {
  // List all saved cookie jars
  app.get('/api/browser/cookies', (_req: Request, res: Response) => {
    const now = Date.now();
    const jars = Array.from(serverCookieStore.values()).map((jar) => ({
      ...jar,
      cookies: jar.cookies.filter((c) => !c.expiresAt || c.expiresAt > now),
    }));
    res.json({ jars });
  });

  // Sync cookie jars from client IndexedDB OR save manual cookie string for a domain
  app.post('/api/browser/cookies/sync', express.json({ limit: '1mb' }), (req: Request, res: Response) => {
    try {
      const { jars, domain, cookieString } = req.body as {
        jars?: SiteCookieJar[];
        domain?: string;
        cookieString?: string;
      };

      if (Array.isArray(jars)) {
        for (const jar of jars) {
          if (!jar?.domain || !Array.isArray(jar.cookies)) continue;
          const base = extractBaseDomain(jar.domain);
          const existing = serverCookieStore.get(base);
          // Merge without clobbering newer server cookies
          for (const c of jar.cookies) {
            if (!existing || (jar.updatedAt || 0) >= existing.updatedAt) {
              upsertCookieEntry(base, c);
            }
          }
        }
      }

      if (domain && typeof cookieString === 'string') {
        const base = extractBaseDomain(domain);
        const parsed = parseManualCookieString(cookieString, base);
        for (const entry of parsed) {
          upsertCookieEntry(base, entry);
        }
      }

      schedulePersistToDisk();
      res.json({ jars: Array.from(serverCookieStore.values()) });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Không thể đồng bộ cookies.' });
    }
  });

  // Capture cookies written by client-side JS inside the proxied iframe
  app.post('/api/browser/cookies/client-set', express.json({ limit: '256kb' }), (req: Request, res: Response) => {
    try {
      const { url, cookie } = req.body as { url?: string; cookie?: string };
      if (!url || !cookie) {
        res.status(400).json({ ok: false });
        return;
      }
      const parsedUrl = assertPublicHttpUrl(url);
      const entry = parseSetCookieHeader(cookie, parsedUrl);
      if (entry) {
        const baseDomain = extractBaseDomain(entry.domain || parsedUrl.hostname);
        upsertCookieEntry(baseDomain, entry);
        schedulePersistToDisk();
      }
      res.json({ ok: true });
    } catch {
      res.status(400).json({ ok: false });
    }
  });

  // Delete saved cookies for a domain
  app.delete('/api/browser/cookies/:domain', (req: Request, res: Response) => {
    const rawParam = Array.isArray(req.params.domain) ? req.params.domain[0] : req.params.domain;
    const base = extractBaseDomain(decodeURIComponent(rawParam || ''));
    if (base) {
      serverCookieStore.delete(base);
      schedulePersistToDisk();
    }
    res.json({ ok: true, domain: base });
  });

  let browserPreferredLang: 'en' | 'ja' = 'en';

  app.get('/api/browser/preferences', (_req: Request, res: Response) => {
    res.json({ lang: browserPreferredLang });
  });

  app.post('/api/browser/preferences', express.json({ limit: '16kb' }), (req: Request, res: Response) => {
    const lang = req.body?.lang === 'ja' ? 'ja' : 'en';
    browserPreferredLang = lang;
    res.json({ ok: true, lang: browserPreferredLang });
  });

  // Same-origin HTTP Reverse Proxy for Browser Mode
  app.all(
    '/api/browser/proxy',
    express.raw({ type: '*/*', limit: '5mb' }),
    async (req: Request, res: Response) => {
      try {
        const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
        if (!rawUrl) {
          res.status(400).send('Thiếu tham số url.');
          return;
        }

        let currentUrl = assertPublicHttpUrl(rawUrl);
        let method = req.method.toUpperCase();
        let bodyBuffer: Buffer | undefined =
          method !== 'GET' && method !== 'HEAD' && Buffer.isBuffer(req.body) && req.body.length > 0
            ? req.body
            : undefined;

        // Extract true upstream parent page URL from browser Referer so CDN hotlink & CSRF checks pass
        let parentTargetUrl: URL | null = null;
        const browserReferer = req.get('referer');
        if (browserReferer) {
          try {
            const refParsed = new URL(browserReferer);
            const innerUrl = refParsed.searchParams.get('url');
            if (innerUrl) {
              parentTargetUrl = assertPublicHttpUrl(innerUrl);
            }
          } catch {
            // ignore
          }
        }

        const maxRedirects = 8;
        let upstreamResp: globalThis.Response | null = null;

        for (let hop = 0; hop <= maxRedirects; hop++) {
          let effectiveReferer = parentTargetUrl?.toString() || `${currentUrl.origin}/`;
          if (
            currentUrl.hostname.toLowerCase().endsWith('pximg.net') &&
            (!parentTargetUrl || !extractBaseDomain(parentTargetUrl.hostname).endsWith('pixiv.net'))
          ) {
            effectiveReferer = 'https://www.pixiv.net/';
          }

          const acceptLangHeader =
            browserPreferredLang === 'ja'
              ? 'ja,en-US;q=0.8,en;q=0.7'
              : 'en-US,en;q=0.9,vi;q=0.8,ja;q=0.5';

          const headers: Record<string, string> = {
            'User-Agent': DEFAULT_USER_AGENT,
            Accept: req.get('accept') || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': acceptLangHeader,
            Referer: effectiveReferer,
          };

          // Forward safe CSRF/AJAX headers required by web login forms & SPAs
          for (const [hdrKey, hdrVal] of Object.entries(req.headers)) {
            if (typeof hdrVal !== 'string') continue;
            const low = hdrKey.toLowerCase();
            if (
              low === 'x-csrf-token' ||
              low === 'x-xsrf-token' ||
              low === 'x-requested-with' ||
              low === 'authorization' ||
              low === 'x-user-id' ||
              (low.startsWith('x-') &&
                !low.startsWith('x-forwarded-') &&
                !low.startsWith('x-reader-proxy-') &&
                low !== 'x-real-ip')
            ) {
              headers[hdrKey] = hdrVal;
            }
          }

          const contentTypeHeader = req.get('content-type');
          if (contentTypeHeader && bodyBuffer) {
            headers['Content-Type'] = contentTypeHeader;
          }
          if (bodyBuffer && method !== 'GET' && method !== 'HEAD') {
            headers['Origin'] = parentTargetUrl?.origin || currentUrl.origin;
          }

          const cookieHeader = getServerCookieHeaderForUrl(currentUrl.toString());
          if (cookieHeader) {
            headers['Cookie'] = cookieHeader;
          }

          upstreamResp = await fetch(currentUrl.toString(), {
            method,
            headers,
            body: bodyBuffer ? new Uint8Array(bodyBuffer) : undefined,
            redirect: 'manual',
            signal: AbortSignal.timeout(20000),
          });

          // Capture Set-Cookie from every hop!
          mergeCookiesFromResponse(upstreamResp, currentUrl);

          const isRedirect =
            upstreamResp.status >= 300 &&
            upstreamResp.status < 400 &&
            upstreamResp.headers.has('location');

          if (!isRedirect) {
            break;
          }

          const loc = upstreamResp.headers.get('location') || '';
          const nextUrl = assertPublicHttpUrl(new URL(loc, currentUrl).toString());

          // On POST/PUT/PATCH 301/302/303, return a 303 redirect to the browser iframe so it converts to GET and updates location
          if (
            (method !== 'GET' && method !== 'HEAD') &&
            (upstreamResp.status === 301 || upstreamResp.status === 302 || upstreamResp.status === 303)
          ) {
            res.redirect(303, `/api/browser/proxy?url=${encodeURIComponent(nextUrl.toString())}`);
            return;
          }

          currentUrl = nextUrl;
          if (upstreamResp.status === 303) {
            method = 'GET';
            bodyBuffer = undefined;
          }
        }

        if (!upstreamResp) {
          res.status(502).send('Không nhận được phản hồi từ trang web.');
          return;
        }

        const rawContentType = upstreamResp.headers.get('content-type') || 'application/octet-stream';
        const lowerCt = rawContentType.toLowerCase();

        // Forward non-blocking headers cleanly
        res.status(upstreamResp.status);
        res.setHeader('X-Reader-Final-Url', currentUrl.toString());

        const rawBytes = Buffer.from(await upstreamResp.arrayBuffer());

        if (lowerCt.includes('text/html') || lowerCt.includes('application/xhtml+xml')) {
          let charset = 'utf-8';
          const ctMatch = rawContentType.match(/charset=([^;\s]+)/i);
          if (ctMatch) {
            charset = ctMatch[1].replace(/['"]/g, '').toLowerCase();
          } else {
            const headLatin = rawBytes.subarray(0, 4096).toString('latin1');
            const metaMatch = headLatin.match(/charset=["']?([a-zA-Z0-9_-]+)/i);
            if (metaMatch) charset = metaMatch[1].toLowerCase();
          }

          let htmlText: string;
          try {
            htmlText = new TextDecoder(charset).decode(rawBytes);
          } catch {
            htmlText = new TextDecoder('utf-8').decode(rawBytes);
          }

          const cfMitigated = (upstreamResp.headers.get('cf-mitigated') || '').toLowerCase();
          const isCloudflareChallenge =
            cfMitigated === 'challenge' ||
            /cdn-cgi\/challenge-platform|_cf_chl_opt|Performing security verification|Just a moment\.\.\./i.test(
              htmlText
            );

          if (isCloudflareChallenge) {
            const targetUrlStr = currentUrl.toString();
            const safeUrlHtml = targetUrlStr
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;');
            const safeHostHtml = currentUrl.hostname
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
            const safeTargetJson = JSON.stringify(targetUrlStr);

            res.status(200);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.send(`<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Yêu cầu xác minh bảo mật — ${safeHostHtml}</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #0d0d0f; color: #e5e7eb; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; box-sizing: border-box; }
    .card { max-width: 560px; width: 100%; background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.45); }
    h2 { margin: 0 0 8px; font-size: 18px; color: #fbbf24; }
    p { margin: 8px 0; font-size: 13px; line-height: 1.6; color: #a1a1aa; }
    code { background: #09090b; padding: 2px 6px; border-radius: 4px; color: #f4f4f5; font-size: 12px; }
    .actions { margin-top: 18px; display: flex; flex-wrap: wrap; gap: 10px; }
    .btn-primary { display: inline-flex; align-items: center; padding: 9px 16px; background: #d97706; color: #fff; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600; }
    .btn-primary:hover { background: #f59e0b; }
    .btn-secondary { display: inline-flex; align-items: center; padding: 9px 14px; background: #27272a; color: #e4e4e7; text-decoration: none; border-radius: 8px; font-size: 13px; border: 1px solid #3f3f46; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Trang ${safeHostHtml} đang yêu cầu xác minh Cloudflare</h2>
    <p>Khi mở qua máy chủ proxy trên web, Cloudflare chặn bước kiểm tra bảo mật vì tên miền khác với trang gốc (<code>${safeHostHtml}</code>).</p>
    <p><strong>Cách khắc phục nhanh:</strong></p>
    <p>1. Nhấn nút bên dưới để mở trực tiếp <code>${safeHostHtml}</code> trong trình duyệt ngoài và xác minh / đăng nhập.</p>
    <p>2. Sau đó bấm vào biểu tượng <strong>Cookies</strong> ở thanh trên để dán cookie phiên (ví dụ <code>cf_clearance</code> hoặc <code>PHPSESSID</code>), hoặc dùng bản ứng dụng desktop đóng gói với Electron để duyệt trực tiếp không qua proxy.</p>
    <div class="actions">
      <a class="btn-primary" href="${safeUrlHtml}" target="_blank" rel="noopener noreferrer">Mở trực tiếp trên trình duyệt</a>
      <button class="btn-secondary" type="button" onclick="window.location.reload()">Thử tải lại</button>
    </div>
  </div>
  <script>
    try {
      window.parent.postMessage({
        type: 'reader-browser-state',
        url: ${safeTargetJson},
        title: 'Yêu cầu xác minh bảo mật',
        challengeBlocked: true
      }, '*');
    } catch (e) {}
  </script>
</body>
</html>`);
            return;
          }

          const rewrittenHtml = rewriteHtmlForProxy(htmlText, currentUrl);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.send(rewrittenHtml);
          return;
        }

        if (lowerCt.includes('text/css')) {
          const cssText = new TextDecoder('utf-8').decode(rawBytes);
          res.setHeader('Content-Type', 'text/css; charset=utf-8');
          res.send(rewriteCssUrls(cssText, currentUrl));
          return;
        }

        res.setHeader('Content-Type', rawContentType);
        res.send(rawBytes);
      } catch (err: any) {
        res.status(502).send(
          `<!doctype html><html><body style="font-family:sans-serif;background:#111;color:#eee;padding:24px;"><h3>Không thể tải trang trong trình duyệt</h3><p style="color:#f87171;">${
            err?.message || 'Lỗi kết nối'
          }</p></body></html>`
        );
      }
    }
  );
}
