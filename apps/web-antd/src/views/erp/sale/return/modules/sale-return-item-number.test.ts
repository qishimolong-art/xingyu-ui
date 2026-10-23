import { describe, expect, it } from 'vitest';

import {
  formatSaleReturnCountInput,
  formatSaleReturnPriceInput,
  normalizeSaleReturnCount,
  normalizeSaleReturnPrice,
  parseSaleReturnNumberText,
} from './sale-return-item-number';

describe('sale return item number formatting', () => {
  it.each([
    [1, '1'],
    ['1.000', '1'],
    ['1.250', '1.25'],
    [0, '0'],
  ])('formats count %s as %s', (value, expected) => {
    expect(formatSaleReturnCountInput(value)).toBe(expected);
  });

  it.each([
    [20, '20.00'],
    ['20.5', '20.50'],
    ['20.567', '20.57'],
    [0, '0.00'],
  ])('formats price %s as %s', (value, expected) => {
    expect(formatSaleReturnPriceInput(value)).toBe(expected);
  });

  it('keeps the existing two-decimal input precision', () => {
    expect(normalizeSaleReturnCount(1.256)).toBe(1.26);
    expect(normalizeSaleReturnPrice(20.567)).toBe(20.57);
  });

  it('allows decimal typing and rejects empty or invalid values', () => {
    expect(parseSaleReturnNumberText('1.', '数量')).toEqual({
      ok: true,
      value: 1,
    });
    expect(parseSaleReturnNumberText('1.25', '数量')).toEqual({
      ok: true,
      value: 1.25,
    });
    expect(parseSaleReturnNumberText('', '数量')).toEqual({
      ok: false,
      message: '数量不能为空',
    });
    expect(parseSaleReturnNumberText('abc', '单价')).toEqual({
      ok: false,
      message: '单价必须为数字',
    });
    expect(parseSaleReturnNumberText('1.234', '数量')).toEqual({
      ok: false,
      message: '数量最多保留2位小数',
    });
    expect(parseSaleReturnNumberText('1e2', '单价')).toEqual({
      ok: false,
      message: '单价必须为数字',
    });
  });
});
