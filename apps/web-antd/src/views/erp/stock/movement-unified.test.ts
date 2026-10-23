import { describe, expect, it } from 'vitest';

import { fitStockDocumentColumns } from './utils/document-columns';
import {
  formatStockNaturalNumber,
  parseStockDocumentDecimal,
} from './utils/document-number';
describe('movement numeric and column contracts', () => {
  it('accepts many quantity decimals but keeps business constraints and two-decimal price', () => {
    expect(parseStockDocumentDecimal('01.12345678')).toBe('1.12345678');
    expect(parseStockDocumentDecimal('1.')).toBe('1');
    for (const value of ['', '-', '-1', '0', '1e2', 'abc'])
      expect(() => parseStockDocumentDecimal(value)).toThrow();
    expect(parseStockDocumentDecimal('1.234', true)).toBe('1.234');
    expect(parseStockDocumentDecimal('1.20', true)).toBe('1.2');
    expect(formatStockNaturalNumber('1.123456')).toBe('1.123456');
    expect(formatStockNaturalNumber('1.200000')).toBe('1.2');
    expect(formatStockNaturalNumber('****')).toBe('****');
    expect(formatStockNaturalNumber(null)).toBe('-');
  });
  it.each([1280, 1920, 2560])(
    'fills real container %s after saved visibility and order changes',
    (width) => {
      const columns = [
        { field: 'productName', title: '产品', width: 200 },
        { field: 'count', title: '数量', width: 90 },
        { field: 'remark', title: '备注', minWidth: 150 },
        { field: 'actions', title: '操作', width: 100, fixed: 'right' },
      ];
      const result = fitStockDocumentColumns(
        columns,
        [
          { ...columns[2], visible: false },
          columns[0]!,
          columns[1]!,
          columns[3]!,
        ],
        width,
      );
      expect(result.find((row) => row.field === 'actions')?.fixed).toBe(
        'right',
      );
      expect(
        result.find((row) => row.field === 'count')?.width,
      ).toBeGreaterThan(90);
      expect(
        result
          .filter((row) => row.visible !== false)
          .reduce((total, row) => total + Number(row.width), 0),
      ).toBe(width);
    },
  );
});
