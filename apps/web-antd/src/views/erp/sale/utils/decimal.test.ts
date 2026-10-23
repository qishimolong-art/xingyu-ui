import { describe, expect, it } from 'vitest';

import {
  formatSaleAmount,
  formatSaleDecimal,
  formatSaleListDecimal,
  parseSaleDecimal,
  saleDecimalAdd,
  saleDecimalMultiply,
} from './decimal';

describe('销售六位小数工具', () => {
  it('允许六位小数和 0.5，拒绝第七位及科学计数法', () => {
    expect(parseSaleDecimal('0.5', '数量', { min: 0 })).toMatchObject({
      ok: true,
      value: 0.5,
    });
    expect(parseSaleDecimal('0.123456', '单价', { min: 0 })).toMatchObject({
      ok: true,
      value: 0.123456,
    });
    expect(parseSaleDecimal('0.1234567', '单价')).toMatchObject({
      ok: false,
      message: '单价必须为数字，最多 6 位小数',
    });
    expect(parseSaleDecimal('1e2', '单价')).toMatchObject({ ok: false });
  });

  it('使用六位十进制精度进行乘加', () => {
    expect(saleDecimalMultiply('0.123456', '100000')).toBe(12_345.6);
    expect(saleDecimalMultiply('0.123456', '0.123456')).toBe(0.015241);
    expect(saleDecimalAdd('0.1', '0.2')).toBe(0.3);
  });

  it('金额至少两位，自然小数最多六位，列表固定两位', () => {
    expect(formatSaleAmount('1')).toBe('1.00');
    expect(formatSaleAmount('0.1')).toBe('0.10');
    expect(formatSaleAmount('1.234567')).toBe('1.234567');
    expect(formatSaleAmount('1.230000')).toBe('1.23');
    expect(formatSaleDecimal('0.500000')).toBe('0.5');
    expect(formatSaleListDecimal('123.456789')).toBe('123.46');
  });
});
