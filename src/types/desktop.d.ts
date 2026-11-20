import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import type { SiteCookieJar, WebNovelInspectResult } from './index';

export interface DesktopFetchChapterResult {
  title: string;
  content: string;
  wordCount: number;
  tags: string[];
}

export interface DesktopBridgeApi {
  isElectron: boolean;
  translate: (joinedPayload: string) => Promise<string>;
  inspectUrl: (url: string, cookie?: string) => Promise<WebNovelInspectResult>;
  fetchChapter: (params: {
    url: string;
    sourceType?: string;
    novelId?: string;
    cookie?: string;
  }) => Promise<DesktopFetchChapterResult>;
  getAllCookies: () => Promise<SiteCookieJar[]>;
  syncCookieJars: (jars: SiteCookieJar[]) => Promise<SiteCookieJar[]>;
  setManualCookie: (domainOrUrl: string, cookieString: string) => Promise<SiteCookieJar[]>;
  clearDomainCookies: (domain: string) => Promise<SiteCookieJar[]>;
  getPreferredLang: () => Promise<'en' | 'ja'>;
  setPreferredLang: (lang: 'en' | 'ja') => Promise<'en' | 'ja'>;
}

export interface ElectronWebviewElement extends HTMLElement {
  src: string;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  getURL: () => string;
  getTitle: () => string;
  loadURL: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    desktopBridge?: DesktopBridgeApi;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      webview: DetailedHTMLProps<
        HTMLAttributes<ElectronWebviewElement> & {
          src?: string;
          partition?: string;
          allowpopups?: boolean;
          useragent?: string;
        },
        ElectronWebviewElement
      >;
    }
  }
}
