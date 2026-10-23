import { describe, expect, it } from 'vitest';

import {
  formatPurchaseAmount,
  formatPurchaseDecimal,
  formatPurchaseListDecimal,
  parsePurchaseDecimal,
  purchaseDecimalAdd,
  purchaseDecimalDivide,
  purchaseDecimalMultiply,
} from './decimal';

describe('采购六位小数工具', () => {
  it('允许六位小数和 0.5，拒绝第七位及科学计数法', () => {
    expect(parsePurchaseDecimal('0.5', '数量', { min: 0 })).toMatchObject({
      ok: true,
      value: 0.5,
    });
    expect(parsePurchaseDecimal('0.123456', '单价', { min: 0 })).toMatchObject({
      ok: true,
      value: 0.123456,
    });
    expect(parsePurchaseDecimal('0.1234567', '单价')).toMatchObject({
      ok: false,
      message: '单价必须为数字，最多 6 位小数',
    });
    expect(parsePurchaseDecimal('1e2', '单价')).toMatchObject({ ok: false });
  });

  it('按六位精度进行十进制乘加除运算', () => {
    expect(purchaseDecimalMultiply('0.123456', '100000')).toBe(12_345.6);
    expect(purchaseDecimalMultiply('0.123456', '0.123456')).toBe(0.015241);
    expect(purchaseDecimalAdd('0.1', '0.2')).toBe(0.3);
    expect(purchaseDecimalDivide('1', '3')).toBe(0.333333);
  });

  it('业务场景显示自然小数，主列表固定两位', () => {
    expect(formatPurchaseDecimal('123.456789')).toBe('123.456789');
    expect(formatPurchaseDecimal('1.230000')).toBe('1.23');
    expect(formatPurchaseAmount('1')).toBe('1.00');
    expect(formatPurchaseAmount('0.1')).toBe('0.10');
    expect(formatPurchaseAmount('1.234567')).toBe('1.234567');
    expect(formatPurchaseAmount('1.230000')).toBe('1.23');
    expect(formatPurchaseListDecimal('123.456789')).toBe('123.46');
  });
});
