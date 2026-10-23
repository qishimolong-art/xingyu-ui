import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  normalizeGridSearchValues,
  useGridFormSchema,
  withProductArchiveKeywordSearchMode,
} from './data';

describe('配件资料搜索参数', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('keeps keyword spaces for backend compatible multi-keyword parsing', () => {
    const values = normalizeGridSearchValues({
      keyword: '  ILK 7B11  ',
      code: '  A  001  ',
      name: '  刹车  片  ',
    });

    expect(values.keyword).toBe('ILK 7B11');
    expect(values.code).toBe('A%001');
    expect(values.name).toBe('刹车%片');
  });

  it('describes the narrowed product archive keyword fields', () => {
    const keywordSchema = useGridFormSchema().find(
      (item) => item.fieldName === 'keyword',
    ) as any;

    const placeholder = keywordSchema?.componentProps?.placeholder ?? '';
    expect(placeholder).toContain('配件编码、名称、拼音码、五笔码');
    expect(placeholder).toContain('车型、条形码、厂家编码、图号');
    expect(placeholder).toContain('支持空格组合搜索');
    expect(placeholder).not.toContain('品牌');
  });

  it('marks only the product archive list with its keyword mode', () => {
    expect(withProductArchiveKeywordSearchMode({ keyword: '145988' })).toEqual({
      keyword: '145988',
      keywordSearchMode: 'PRODUCT_ARCHIVE',
    });
  });
});
