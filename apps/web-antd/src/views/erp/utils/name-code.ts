import { WUBI86_INITIAL_GROUPS } from '../sale/customer/utils/wubi-code-map';

const WUBI86_INITIALS = new Map<string, string>();

for (const [initial, chars] of Object.entries(WUBI86_INITIAL_GROUPS)) {
  for (const char of chars) {
    if (!WUBI86_INITIALS.has(char)) {
      WUBI86_INITIALS.set(char, initial);
    }
  }
}

const PINYIN_BOUNDARIES = [
  ['A', '啊'],
  ['B', '芭'],
  ['C', '擦'],
  ['D', '搭'],
  ['E', '蛾'],
  ['F', '发'],
  ['G', '噶'],
  ['H', '哈'],
  ['J', '击'],
  ['K', '喀'],
  ['L', '垃'],
  ['M', '妈'],
  ['N', '拿'],
  ['O', '哦'],
  ['P', '啪'],
  ['Q', '期'],
  ['R', '然'],
  ['S', '撒'],
  ['T', '塌'],
  ['W', '挖'],
  ['X', '昔'],
  ['Y', '压'],
  ['Z', '匝'],
] as const;

const PINYIN_COLLATOR = new Intl.Collator('zh-Hans-CN-u-co-pinyin');
const HAN_CHAR_REGEXP = /[\u3400-\u9fff]/;

function pinyinInitialFromChar(char: string) {
  if (!HAN_CHAR_REGEXP.test(char)) {
    return '';
  }
  for (let index = PINYIN_BOUNDARIES.length - 1; index >= 0; index -= 1) {
    const [initial, boundary] = PINYIN_BOUNDARIES[index]!;
    if (PINYIN_COLLATOR.compare(char, boundary) >= 0) {
      return initial;
    }
  }
  return '';
}

function buildCode(
  name: string | undefined,
  resolveInitial: (char: string) => string,
  maxLength: number,
) {
  return String(name || '')
    .trim()
    .split('')
    .map((char) => {
      if (/^[a-z\d]$/i.test(char)) {
        return char;
      }
      if (/[\s\-_.]/.test(char)) {
        return '';
      }
      return resolveInitial(char);
    })
    .join('')
    .slice(0, maxLength)
    .toUpperCase();
}

export function buildPinyinCode(name?: string) {
  return buildCode(name, pinyinInitialFromChar, 64);
}

export function buildWubiCode(name?: string) {
  return buildCode(name, (char) => WUBI86_INITIALS.get(char) || '', 32);
}
