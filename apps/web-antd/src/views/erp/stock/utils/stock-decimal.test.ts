import { describe, expect, it } from 'vitest';

import {
  stockAdd,
  stockInput,
  stockListNumber,
  stockMultiply,
  stockNatural,
  stockProduct,
  stockRoundingRows,
  stockSum,
  validateStockStorage,
} from './stock-decimal';
import { buildRemoteDocumentSummary } from './stock-document-summary';

describe('stock decimal precision', () => {
  it('calculates the confirmed manufacturer example without rounding the unit price', () => {
    expect(stockProduct('0.5', '10.111111')).toBe('5.0555555');
    expect(stockMultiply('0.5', '10.111111')).toBe('5.055556');
    expect(stockListNumber('5.055556')).toBe('5.06');
    expect(stockNatural('10.111111')).toBe('10.111111');
  });
  it('avoids floating point loss and retains eighteen integer digits', () => {
    expect(stockAdd('0.1', '0.2')).toBe('0.3');
    expect(stockSum(['999999999999999999.000001', '0.000001'])).toBe(
      '999999999999999999.000002',
    );
    expect(stockMultiply('-0.5', '10.111111')).toBe('-5.055556');
    expect(stockMultiply('1', '10')).toBe('10');
    expect(stockMultiply('999999999999.999999', '0.000001')).toBe('1000000');
  });
  it('accepts multi-decimal input but validates actual persisted boundaries', () => {
    expect(stockInput('0.123456789')).toBe('0.123456789');
    expect(() => validateStockStorage('0.123456789', '数量')).toThrow('6 位');
    expect(() => validateStockStorage('1.123456000', '数量')).not.toThrow();
    expect(() =>
      validateStockStorage('1.123400', '旧成本金额', 4, 16),
    ).not.toThrow();
    expect(() => validateStockStorage('1.12345', '旧成本金额', 4, 16)).toThrow(
      '4 位',
    );
    expect(() =>
      validateStockStorage('1.1200', '仓库额度', 2, 10),
    ).not.toThrow();
    expect(() => validateStockStorage('1.123', '仓库额度', 2, 10)).toThrow(
      '2 位',
    );
    expect(() => validateStockStorage('1000000000000000000', '数量')).toThrow(
      '18 位',
    );
    for (const invalid of ['1e3', '-1', '1a', '.'])
      expect(() => stockInput(invalid)).toThrow();
  });
  it('keeps missing, masked and zero values distinct', () => {
    expect(stockNatural(null)).toBe('-');
    expect(stockListNumber('****')).toBe('****');
    expect(stockNatural('0')).toBe('0');
    expect(stockListNumber('0')).toBe('0.00');
  });
  it('reports rounding changes and preserves cross-page exact totals', () => {
    expect(
      stockRoundingRows([{ count: '0.5', productPrice: '10.111111' }]),
    ).toEqual([{ label: '第 1 行金额', raw: '5.0555555', saved: '5.055556' }]);
    const result = buildRemoteDocumentSummary({
      base: { amount: '5.055556' },
      calculate: (item: { amount: string }) => item,
      creates: new Map([['new', { amount: '0.000001' }]]),
      deletes: new Set<number>(),
      edits: new Map(),
      localItems: [],
      originals: new Map(),
      remotePaging: true,
    });
    expect(result.amount).toBe('5.055557');
  });
});
