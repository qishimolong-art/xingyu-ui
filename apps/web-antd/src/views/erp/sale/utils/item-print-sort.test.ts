import { describe, expect, it } from 'vitest';

import { getItemPrintSortTitle } from './item-print-sort';

describe('item print sort title', () => {
  it('describes original, ascending and descending print order', () => {
    expect(getItemPrintSortTitle()).toBe('按原始顺序打印');
    expect(getItemPrintSortTitle('productName', 'asc')).toBe(
      '按产品名称升序打印',
    );
    expect(getItemPrintSortTitle('count', 'desc')).toBe('按数量降序打印');
  });
});
