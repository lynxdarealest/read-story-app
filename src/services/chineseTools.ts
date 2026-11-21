import { pinyin } from 'pinyin-pro';
import { getHanviet, hanvietData } from 'hanviet-pinyin-words';
import { tify } from 'chinese-conv';
import { DictionaryEntry } from '../types';

const CJK_REGEX = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

export function containsCjk(text: string): boolean {
  return CJK_REGEX.test(text);
}

/**
 * Normalize Vietnamese / Latin string for alignment matching
 */
function normalizeMatchToken(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFC')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/**
 * Common Western / Anime / Light-Novel Chinese transliterations -> English Name
 */
const WESTERN_NAME_MAP: Record<string, string> = {
  亚瑟: 'Arthur',
  爱丽丝: 'Alice',
  艾丽丝: 'Alice',
  艾莉丝: 'Alice',
  克莱恩: 'Klein',
  艾伦: 'Allen',
  阿伦: 'Alan',
  路飞: 'Luffy',
  索隆: 'Zoro',
  山治: 'Sanji',
  娜美: 'Nami',
  罗宾: 'Robin',
  威廉: 'William',
  查理: 'Charlie',
  查尔斯: 'Charles',
  杰克: 'Jack',
  汤姆: 'Tom',
  托马斯: 'Thomas',
  玛丽: 'Mary',
  露西: 'Lucy',
  凯瑟琳: 'Catherine',
  安娜: 'Anna',
  米娅: 'Mia',
  诺亚: 'Noah',
  莱恩: 'Ryan',
  瑞安: 'Ryan',
  塞巴斯蒂安: 'Sebastian',
  赫敏: 'Hermione',
  哈利: 'Harry',
  罗恩: 'Ron',
  伊丽莎白: 'Elizabeth',
  维多利亚: 'Victoria',
  奥利弗: 'Oliver',
  奥莉薇亚: 'Olivia',
  莉莉: 'Lily',
  艾米丽: 'Emily',
  艾玛: 'Emma',
  索菲亚: 'Sophia',
  苏菲: 'Sophie',
  夏洛特: 'Charlotte',
  夏洛克: 'Sherlock',
  约翰: 'John',
  约瑟夫: 'Joseph',
  大卫: 'David',
  迈克尔: 'Michael',
  丹尼尔: 'Daniel',
  詹姆斯: 'James',
  罗伯特: 'Robert',
  理查德: 'Richard',
  爱德华: 'Edward',
  亨利: 'Henry',
  乔治: 'George',
  亚历山大: 'Alexander',
  卢卡斯: 'Lucas',
  里昂: 'Leon',
  雷恩: 'Rein',
  莱昂: 'Leon',
  卡尔: 'Carl',
  凯文: 'Kevin',
  布莱恩: 'Brian',
  史蒂夫: 'Steve',
  彼得: 'Peter',
  保罗: 'Paul',
  马克: 'Mark',
  马修: 'Matthew',
  安德鲁: 'Andrew',
  尼古拉斯: 'Nicholas',
  埃里克: 'Eric',
  弗兰克: 'Frank',
  菲利普: 'Philip',
  斯蒂芬: 'Stephen',
  克里斯: 'Chris',
  克里斯蒂安: 'Christian',
  格蕾丝: 'Grace',
  克洛伊: 'Chloe',
  海伦: 'Helen',
  莎拉: 'Sarah',
  瑞秋: 'Rachel',
  劳拉: 'Laura',
  汉娜: 'Hannah',
  佐伊: 'Zoe',
  伊娃: 'Eva',
  伊芙: 'Eve',
  贝拉: 'Bella',
  玫瑰: 'Rose',
  卡卡西: 'Kakashi',
  鸣人: 'Naruto',
  佐助: 'Sasuke',
  五条悟: 'Gojo Satoru',
  五条: 'Gojo',
  炭治郎: 'Tanjiro',
  祢豆子: 'Nezuko',
  利威尔: 'Levi',
  三笠: 'Mikasa',
  阿明: 'Armin',
  夜神月: 'Light Yagami',
  亚丝娜: 'Asuna',
  桐人: 'Kirito',
  蕾姆: 'Rem',
  拉姆: 'Ram',
  艾米莉亚: 'Emilia',
  爱蜜莉雅: 'Emilia',
  莱茵哈鲁特: 'Reinhard',
  奥黛丽: 'Audrey',
  阿尔杰: 'Alger',
  戴里克: 'Derrick',
  佛尔思: 'Fors',
  休: 'Xio',
  伦纳德: 'Leonard',
  埃姆林: 'Emlyn',
  嘉德丽雅: 'Cattleya',
  阿蒙: 'Amon',
  亚当: 'Adam',
  罗塞尔: 'Roselle',
  梅林: 'Merlin',
  兰斯洛特: 'Lancelot',
  高文: 'Gawain',
  莫德雷德: 'Mordred',
  加拉哈德: 'Galahad',
  阿波罗: 'Apollo',
  宙斯: 'Zeus',
  雅典娜: 'Athena',
  赫拉: 'Hera',
  波塞冬: 'Poseidon',
  哈迪斯: 'Hades',
  阿瑞斯: 'Ares',
  路西法: 'Lucifer',
  加百列: 'Gabriel',
  拉斐尔: 'Raphael',
  米迦勒: 'Michael',
  乌列尔: 'Uriel',
  撒旦: 'Satan',
  德古拉: 'Dracula',
  福尔摩斯: 'Holmes',
  华生: 'Watson',
  莫里亚蒂: 'Moriarty',
  先生: 'Mr.',
  小姐: 'Miss',
  夫人: 'Mrs.',
  博士: 'Dr.',
  教授: 'Prof.',
  公爵: 'Duke',
  伯爵: 'Count',
  子爵: 'Viscount',
  男爵: 'Baron',
  国王: 'King',
  王后: 'Queen',
  王子: 'Prince',
  公主: 'Princess',
  骑士: 'Knight',
  法师: 'Mage',
  魔法师: 'Wizard',
  魔王: 'Demon Lord',
  勇者: 'Hero',
};

/**
 * Common Chinese character -> Vietnamese glosses for phrase alignment
 */
const COMMON_CHAR_GLOSSES: Record<string, string[]> = {
  的: ['của'],
  有: ['có', 'hữu'],
  没: ['không', 'chưa'],
  不: ['không', 'bất'],
  是: ['là', 'thị'],
  在: ['ở', 'tại', 'đang'],
  了: ['rồi', 'đã'],
  人: ['người', 'nhân'],
  他: ['hắn', 'anh', 'y', 'gã'],
  她: ['nàng', 'cô', 'chị'],
  它: ['nó'],
  我: ['ta', 'tôi', 'mình'],
  你: ['ngươi', 'bạn', 'anh', 'cậu'],
  们: ['các', 'bọn', 'chúng'],
  说: ['nói', 'thuyết'],
  看: ['nhìn', 'xem'],
  想: ['nghĩ', 'muốn', 'tưởng'],
  好: ['tốt', 'được', 'hảo'],
  大: ['lớn', 'to', 'đại'],
  小: ['nhỏ', 'bé', 'tiểu'],
  上: ['trên', 'lên', 'thượng'],
  下: ['dưới', 'xuống', 'hạ'],
  里: ['trong', 'lý'],
  中: ['trong', 'giữa', 'trung'],
  和: ['và', 'cùng', 'hòa'],
  与: ['cùng', 'và', 'với'],
  也: ['cũng', 'dã'],
  都: ['đều', 'đô'],
  就: ['liền', 'thì', 'tựu'],
  被: ['bị', 'được'],
  把: ['đem', 'lấy', 'bắt'],
  让: ['khiến', 'để', 'nhượng'],
  给: ['cho', 'đưa'],
  到: ['đến', 'tới', 'đáo'],
  去: ['đi', 'khứ'],
  来: ['đến', 'lại', 'tới', 'lai'],
  个: ['cái', 'người', 'một'],
  这: ['này', 'đây'],
  那: ['kia', 'đó'],
  什: ['gì', 'cái'],
  么: ['gì', 'sao'],
  为: ['vì', 'làm', 'vi'],
  可: ['có', 'thể', 'khả'],
  能: ['thể', 'năng'],
  读: ['đọc', 'độc'],
  者: ['người', 'giả'],
  会: ['sẽ', 'biết', 'hội'],
  要: ['muốn', 'cần', 'phải', 'yếu'],
  只: ['chỉ', 'chích'],
  还: ['còn', 'vẫn', 'hoàn'],
  很: ['rất', 'ngận'],
  太: ['quá', 'thái'],
  最: ['nhất', 'tối'],
  更: ['càng', 'hơn', 'canh'],
  才: ['mới', 'tài'],
  又: ['lại', 'hựu'],
  却: ['lại', 'nhưng', 'khước'],
  但: ['nhưng', 'đãn'],
  而: ['mà', 'nhưng', 'nhi'],
  因: ['vì', 'bởi', 'nhân'],
  所: ['nên', 'nơi', 'sở'],
  以: ['để', 'lấy', 'dĩ'],
  如: ['như', 'nếu'],
  果: ['quả', 'nếu'],
  虽: ['tuy', 'dù'],
  然: ['nhiên', 'vậy'],
  后: ['sau', 'hậu'],
  前: ['trước', 'tiền'],
  时: ['lúc', 'khi', 'thời'],
  候: ['lúc', 'khi', 'hậu'],
  天: ['ngày', 'trời', 'thiên'],
  年: ['năm', 'niên'],
  手: ['tay', 'thủ'],
  眼: ['mắt', 'nhãn'],
  心: ['lòng', 'tim', 'tâm'],
  头: ['đầu', 'đầu'],
  话: ['lời', 'nói', 'thoại'],
  事: ['chuyện', 'việc', 'sự'],
  知: ['biết', 'tri'],
  道: ['biết', 'đạo', 'nói'],
  觉: ['cảm', 'giác', 'thấy'],
  得: ['được', 'thấy', 'đắc'],
  明: ['rõ', 'sáng', 'minh'],
  白: ['rõ', 'trắng', 'bạch'],
  清: ['rõ', 'trong', 'thanh'],
  楚: ['rõ', 'sở'],
  剧: ['kịch'],
  情: ['tình', 'cảm'],
};

/**
 * Convert a single Chinese character + numbered pinyin to its primary clean Hán Việt syllable.
 */
function getCleanHanVietTokens(chineseText: string): string[] {
  if (!chineseText) return [];
  const trad = tify(chineseText);
  const pyArray = pinyin(chineseText, { toneType: 'num', type: 'array', nonZh: 'consecutive' });

  const tokens: string[] = [];
  for (let i = 0; i < chineseText.length; i++) {
    const rawChar = chineseText[i];
    const tradChar = trad[i] || rawChar;
    if (!CJK_REGEX.test(rawChar)) {
      if (rawChar.trim()) tokens.push(rawChar.trim());
      continue;
    }

    const py = pyArray[i] || `${rawChar}`;
    let hv = '';
    try {
      const rawHv = getHanviet(tradChar, [py], false);
      if (rawHv && rawHv !== '_') {
        // getHanviet returns comma or pipe separated variants for polyphones
        const firstChoice = rawHv.split(/\s*[,|]\s*/)[0]?.trim();
        if (firstChoice && firstChoice !== '_') {
          hv = firstChoice;
        }
      }
    } catch {
      // Fallback below
    }

    if (!hv && hanvietData[tradChar]) {
      const all = Object.values(hanvietData[tradChar]).flat().filter(Boolean);
      if (all.length > 0) hv = all[0];
    }

    if (!hv) {
      // Fallback to toneless pinyin syllable so never outputs broken underscore
      hv = pinyin(rawChar, { toneType: 'none' }).trim() || rawChar;
    }

    tokens.push(hv);
  }

  return tokens;
}

/**
 * Convert Simplified/Traditional Chinese phrase to Hán Việt.
 */
export function toHanViet(chineseText: string, capitalizeEachWord = true): string {
  const cleaned = chineseText.trim();
  if (!cleaned) return '';
  if (!containsCjk(cleaned)) {
    return capitalizeEachWord ? toTitleCase(cleaned) : cleaned.toLowerCase();
  }

  const tokens = getCleanHanVietTokens(cleaned);
  const formatted = tokens.map((tok) =>
    capitalizeEachWord
      ? tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase()
      : tok.toLowerCase()
  );

  return formatted
    .join(' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

/**
 * Convert any string to Title Case word-by-word (safe for Vietnamese diacritics).
 */
export function toTitleCase(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Convert Chinese phrase to Title-Case Pinyin romanization (e.g. "林凡" -> "Lin Fan").
 */
export function toTitleCasePinyin(chineseText: string): string {
  const cleaned = chineseText.trim();
  if (!cleaned) return '';
  if (!containsCjk(cleaned)) return toTitleCase(cleaned);

  const arr = pinyin(cleaned, { toneType: 'none', type: 'array', nonZh: 'consecutive' });
  return arr
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/^[a-zA-Z]/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s))
    .join(' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

/**
 * Generate an immediate offline Name Eng suggestion using Western/Anime transliteration map + Title-Case Pinyin fallback.
 */
export function toEnglishNameSuggestion(chineseText: string): string {
  const cleaned = chineseText.trim();
  if (!cleaned) return '';
  if (!containsCjk(cleaned)) return toTitleCase(cleaned);

  if (WESTERN_NAME_MAP[cleaned]) {
    return WESTERN_NAME_MAP[cleaned];
  }

  // Check if phrase ends/starts with known Western name or title (longest first)
  const sortedKeys = Object.keys(WESTERN_NAME_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (key.length >= 2 && cleaned.includes(key)) {
      const idx = cleaned.indexOf(key);
      const before = cleaned.slice(0, idx);
      const after = cleaned.slice(idx + key.length);
      const parts = [
        before ? toTitleCasePinyin(before) : '',
        WESTERN_NAME_MAP[key],
        after ? (WESTERN_NAME_MAP[after] || toTitleCasePinyin(after)) : '',
      ].filter(Boolean);
      return parts.join(' ').trim();
    }
  }

  return toTitleCasePinyin(cleaned);
}

/**
 * Get all possible Han-Viet + gloss candidates for a single Chinese character (for alignment scoring).
 */
function getAlignmentCandidatesForChar(ch: string, tradChar: string, pyNum: string, pyNoTone: string): Set<string> {
  const set = new Set<string>();
  const hvEntry = hanvietData[tradChar];
  if (hvEntry) {
    const exact = hvEntry[pyNum.toLowerCase()];
    if (exact) {
      for (const h of exact) set.add(normalizeMatchToken(h));
    }
    for (const arr of Object.values(hvEntry)) {
      for (const h of arr) set.add(normalizeMatchToken(h));
    }
  }
  const glosses = COMMON_CHAR_GLOSSES[ch] || COMMON_CHAR_GLOSSES[tradChar];
  if (glosses) {
    for (const g of glosses) set.add(normalizeMatchToken(g));
  }
  if (pyNoTone) {
    set.add(normalizeMatchToken(pyNoTone));
  }
  return set;
}

export interface AlignedChineseResult {
  zhPhrase: string;
  zhStart: number;
  zhEnd: number;
}

/**
 * Align a selected Vietnamese phrase back to its most likely Chinese source substring
 * inside the corresponding Chinese paragraph.
 */
export function alignVietnameseToChinese(opts: {
  selectedVi: string;
  viParagraph: string;
  selectionStartInPara: number;
  selectionEndInPara: number;
  zhParagraph: string;
  dictionaries?: DictionaryEntry[];
}): AlignedChineseResult {
  const {
    selectedVi,
    viParagraph,
    selectionStartInPara,
    selectionEndInPara,
    zhParagraph,
    dictionaries = [],
  } = opts;

  const trimmedVi = selectedVi.trim();
  if (!zhParagraph.trim()) {
    return { zhPhrase: containsCjk(trimmedVi) ? trimmedVi : '', zhStart: 0, zhEnd: 0 };
  }

  // If selected text itself is already Chinese
  if (containsCjk(trimmedVi)) {
    const idx = zhParagraph.indexOf(trimmedVi);
    if (idx >= 0) {
      return { zhPhrase: trimmedVi, zhStart: idx, zhEnd: idx + trimmedVi.length };
    }
    return { zhPhrase: trimmedVi, zhStart: 0, zhEnd: trimmedVi.length };
  }

  // 1. Exact Dictionary match check first
  const lowVi = trimmedVi.toLowerCase();
  const sortedDicts = [...dictionaries]
    .filter((d) => d.enabled && d.original.trim() && d.replacement.trim())
    .sort((a, b) => b.replacement.length - a.replacement.length);

  for (const d of sortedDicts) {
    if (d.replacement.trim().toLowerCase() === lowVi && containsCjk(d.original)) {
      const idx = zhParagraph.indexOf(d.original.trim());
      if (idx >= 0) {
        return {
          zhPhrase: d.original.trim(),
          zhStart: idx,
          zhEnd: idx + d.original.trim().length,
        };
      }
    }
  }

  // 2. Build character table for zhParagraph (map Hanzi/alphanumeric positions)
  const zhTrad = tify(zhParagraph);
  const pyNums = pinyin(zhParagraph, { toneType: 'num', type: 'array', nonZh: 'consecutive' });
  const pyNones = pinyin(zhParagraph, { toneType: 'none', type: 'array', nonZh: 'consecutive' });

  const charCandidates: Array<Set<string>> = [];
  for (let i = 0; i < zhParagraph.length; i++) {
    const c = zhParagraph[i];
    if (CJK_REGEX.test(c)) {
      charCandidates.push(
        getAlignmentCandidatesForChar(c, zhTrad[i] || c, pyNums[i] || '', pyNones[i] || '')
      );
    } else if (/[\p{L}\p{N}]/u.test(c)) {
      charCandidates.push(new Set([normalizeMatchToken(c)]));
    } else {
      charCandidates.push(new Set());
    }
  }

  // Tokenize selected Vietnamese phrase
  const viTokens = trimmedVi
    .split(/[\s,.;:!?'"“”‘’()[\]{}—\-/]+/)
    .map(normalizeMatchToken)
    .filter(Boolean);

  // Also strip common translation filler words for secondary weighting
  const FILLER_WORDS = new Set(['có', 'bị', 'được', 'là', 'ở', 'một', 'những', 'các', 'của', 'và', 'rồi', 'đã', 'này', 'kia']);

  // Compute expected relative position in zhParagraph
  const safeViLen = Math.max(1, viParagraph.length);
  const startRatio = Math.max(0, Math.min(1, selectionStartInPara / safeViLen));
  const endRatio = Math.max(startRatio, Math.min(1, selectionEndInPara / safeViLen));
  const midRatio = (startRatio + endRatio) / 2;
  const expectedMidZh = Math.round(midRatio * zhParagraph.length);
  const expectedLenZh = Math.max(
    1,
    Math.min(24, Math.round(viTokens.length * 1.15) || 2)
  );

  // Search window around proportional position (or whole paragraph if concise)
  const windowMargin = zhParagraph.length <= 260 ? zhParagraph.length : Math.max(45, expectedLenZh * 4);
  const searchMin = Math.max(0, expectedMidZh - windowMargin);
  const searchMax = Math.min(zhParagraph.length, expectedMidZh + windowMargin);

  let bestScore = -Infinity;
  let bestStart = Math.max(0, expectedMidZh - Math.floor(expectedLenZh / 2));
  let bestEnd = Math.min(zhParagraph.length, bestStart + expectedLenZh);

  if (viTokens.length > 0) {
    const minSpan = 1;
    const maxSpan = Math.min(26, Math.max(4, viTokens.length * 2 + 2));

    for (let s = searchMin; s < searchMax; s++) {
      if (!CJK_REGEX.test(zhParagraph[s]) && !/[\p{L}\p{N}]/u.test(zhParagraph[s])) continue;

      for (let len = minSpan; len <= maxSpan && s + len <= zhParagraph.length; len++) {
        const e = s + len;
        // Do not cross sentence-ending Chinese punctuation unless inside expected span
        const sliceText = zhParagraph.slice(s, e);
        if (/[。！？\n]/.test(sliceText)) break;
        if (!CJK_REGEX.test(zhParagraph[e - 1]) && !/[\p{L}\p{N}]/u.test(zhParagraph[e - 1])) continue;

        let hits = 0;
        let lastMatchedTokIdx = -1;
        let orderedBonus = 0;
        let cjkCount = 0;

        const usedViIdx = new Set<number>();
        for (let k = s; k < e; k++) {
          if (CJK_REGEX.test(zhParagraph[k])) cjkCount++;
          const cand = charCandidates[k];
          if (!cand || cand.size === 0) continue;

          // Find matching viToken
          let matchedAt = -1;
          for (let ti = 0; ti < viTokens.length; ti++) {
            if (usedViIdx.has(ti)) continue;
            if (cand.has(viTokens[ti])) {
              matchedAt = ti;
              break;
            }
          }
          if (matchedAt >= 0) {
            usedViIdx.add(matchedAt);
            const weight = FILLER_WORDS.has(viTokens[matchedAt]) ? 1.4 : 3.2;
            hits += weight;
            if (matchedAt > lastMatchedTokIdx) {
              orderedBonus += 0.8;
              lastMatchedTokIdx = matchedAt;
            }
          }
        }

        if (cjkCount === 0) continue;

        // Penalize unmatched extra characters at edges or length mismatch
        const unmatchedChars = Math.max(0, cjkCount - usedViIdx.size);
        const unmatchedVi = Math.max(0, viTokens.length - usedViIdx.size);
        const spanMid = (s + e) / 2;
        const distPenalty = (Math.abs(spanMid - expectedMidZh) / Math.max(20, zhParagraph.length)) * 2.5;

        // Edge penalty so we don't include irrelevant punctuation/particles on ends
        let edgeBonus = 0;
        const firstCand = charCandidates[s];
        const lastCand = charCandidates[e - 1];
        if (viTokens.some((t) => firstCand.has(t))) edgeBonus += 1.0;
        if (viTokens.some((t) => lastCand.has(t))) edgeBonus += 1.0;

        const score =
          hits +
          orderedBonus +
          edgeBonus -
          unmatchedChars * 0.95 -
          unmatchedVi * 0.65 -
          distPenalty;

        if (score > bestScore) {
          bestScore = score;
          bestStart = s;
          bestEnd = e;
        }
      }
    }
  }

  // If no positive match found, fall back cleanly to proportional CJK span
  if (bestScore <= 0.5) {
    let s = Math.max(0, Math.min(zhParagraph.length - 1, Math.round(startRatio * zhParagraph.length)));
    let e = Math.max(s + 1, Math.min(zhParagraph.length, Math.round(endRatio * zhParagraph.length)));
    while (s < e && !CJK_REGEX.test(zhParagraph[s])) s++;
    while (e > s && !CJK_REGEX.test(zhParagraph[e - 1])) e--;
    if (s >= e) {
      s = Math.max(0, Math.min(zhParagraph.length - 1, expectedMidZh - 1));
      e = Math.min(zhParagraph.length, s + Math.max(2, expectedLenZh));
    }
    bestStart = s;
    bestEnd = e;
  }

  return {
    zhPhrase: zhParagraph.slice(bestStart, bestEnd).trim(),
    zhStart: bestStart,
    zhEnd: bestEnd,
  };
}

/**
 * Expand a selection inside a paragraph by 1 word/character leftward or rightward.
 */
export function expandSelectionInParagraph(opts: {
  paragraph: string;
  startOffset: number;
  endOffset: number;
  direction: 'left' | 'right';
}): { text: string; startOffset: number; endOffset: number } {
  const { paragraph, direction } = opts;
  let start = Math.max(0, Math.min(paragraph.length, opts.startOffset));
  let end = Math.max(start, Math.min(paragraph.length, opts.endOffset));

  const isCjkMode = containsCjk(paragraph.slice(start, end)) || containsCjk(paragraph);

  if (direction === 'left' && start > 0) {
    if (isCjkMode && CJK_REGEX.test(paragraph[start - 1])) {
      start -= 1;
    } else {
      // Skip whitespace/punctuation leftward then grab previous word
      let cur = start - 1;
      while (cur > 0 && /[\s,.;:!?'"“”‘’()[\]{}—\-]/.test(paragraph[cur])) {
        cur--;
      }
      if (CJK_REGEX.test(paragraph[cur])) {
        start = cur;
      } else {
        while (cur > 0 && !/[\s,.;:!?'"“”‘’()[\]{}—\-]/.test(paragraph[cur - 1])) {
          cur--;
        }
        start = cur;
      }
    }
  } else if (direction === 'right' && end < paragraph.length) {
    if (isCjkMode && CJK_REGEX.test(paragraph[end])) {
      end += 1;
    } else {
      let cur = end;
      while (cur < paragraph.length && /[\s,.;:!?'"“”‘’()[\]{}—\-]/.test(paragraph[cur])) {
        cur++;
      }
      if (cur < paragraph.length) {
        if (CJK_REGEX.test(paragraph[cur])) {
          cur++;
        } else {
          while (cur < paragraph.length && !/[\s,.;:!?'"“”‘’()[\]{}—\-]/.test(paragraph[cur])) {
            cur++;
          }
        }
      }
      end = cur;
    }
  }

  return {
    text: paragraph.slice(start, end).trim(),
    startOffset: start,
    endOffset: end,
  };
}

export interface PhraseOnlineLookupResult {
  vi?: string;
  nameEng?: string;
}

/**
 * Optional online lookup for Vietnamese meaning + Name Eng suggestion (never throws, fast fallback).
 */
export async function lookupChinesePhraseOnline(
  zhPhrase: string,
  signal?: AbortSignal
): Promise<PhraseOnlineLookupResult> {
  const clean = zhPhrase.trim();
  if (!clean || !containsCjk(clean)) return {};

  try {
    if (typeof window !== 'undefined' && window.desktopBridge?.analyzePhrase) {
      const res = await window.desktopBridge.analyzePhrase(clean);
      return res || {};
    }

    const resp = await fetch('/api/phrase-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phrase: clean }),
      signal,
    });
    if (!resp.ok) return {};
    const data = (await resp.json()) as PhraseOnlineLookupResult;
    return data || {};
  } catch {
    return {};
  }
}
