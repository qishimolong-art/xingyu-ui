import { describe, expect, it } from 'vitest';

import { useReportGridColumns } from '../record/data';

describe('库存进出流水明细账金额显示', () => {
  it('六个单价和金额列保留业务精度', () => {
    const columns = useReportGridColumns() ?? [];
    const moneyFields = [
      'inUnitPrice',
      'inAmount',
      'outUnitPrice',
      'outAmount',
      'costPrice',
      'costAmount',
    ];
    const cases = [
      [0, '0'],
      [5, '5'],
      [19.5, '19.5'],
      [234.6, '234.6'],
      [184_962.55, '184962.55'],
      [-3.456, '-3.456'],
      [null, '-'],
    ] as const;

    for (const field of moneyFields) {
      const column = columns.find((item) => item.field === field);
      const formatter = column?.formatter as
        | ((params: { row: Record<string, unknown> }) => unknown)
        | undefined;
      expect(column, field).toBeDefined();
      expect(formatter, field).toBeTypeOf('function');
      for (const [value, expected] of cases) {
        expect(
          formatter?.({
            row: { bizType: 70, [field]: value },
          }),
          `${field}: ${String(value)}`,
        ).toBe(expected);
      }
    }
  });

  it('数量和重量列继续使用原有自然数字格式', () => {
    const columns = useReportGridColumns() ?? [];
    for (const field of [
      'weight',
      'totalWeight',
      'inCount',
      'outCount',
      'totalCount',
    ]) {
      const formatter = columns.find((item) => item.field === field)
        ?.formatter as (args: any) => unknown;
      expect(formatter({ cellValue: '0.123456' })).toBe('0.123456');
    }
  });
});
