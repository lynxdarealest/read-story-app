declare module 'hanviet-pinyin-words' {
  export function getHanviet(
    tradHanzi: string,
    pinyinWords: string[],
    firstCharUpperCase?: boolean
  ): string;
  export function getAllHanvietsOfChar(tradHanzi: string): string[];
  export function isPrintableAscii(str: string): boolean;
  export const hanvietData: Record<string, Record<string, string[]>>;
}

declare module 'chinese-conv' {
  export function tify(text: string): string;
  export function sify(text: string): string;
}
