import { describe, expect, it } from 'vitest';

import {
  formatStockReportMoney,
  formatStockReportQuantity,
} from './modules/stock-report-number-format';

describe('库存报表数字显示格式', () => {
  it('数量保留指定有效精度并删除无意义末尾零', () => {
    expect(formatStockReportQuantity(19, 3)).toBe('19');
    expect(formatStockReportQuantity('19.00', 2)).toBe('19');
    expect(formatStockReportQuantity('19.50', 2)).toBe('19.5');
    expect(formatStockReportQuantity('1.2345', 3)).toBe('1.2345');
    expect(formatStockReportQuantity('1,234.5'.replace(',', ''), 2)).toBe(
      '1,234.5',
    );
    expect(formatStockReportQuantity(-19.5, 3)).toBe('-19.5');
    expect(formatStockReportQuantity(0, 3)).toBe('0');
  });

  it('金额保留完整业务精度及负数', () => {
    expect(formatStockReportMoney(19)).toBe('19');
    expect(formatStockReportMoney(19.5)).toBe('19.5');
    expect(formatStockReportMoney(19.555)).toBe('19.555');
    expect(formatStockReportMoney(1234.5)).toBe('1,234.5');
    expect(formatStockReportMoney(-19.5)).toBe('-19.5');
    expect(formatStockReportMoney(0)).toBe('0');
  });

  it('空值和无效数字继续显示短横线', () => {
    for (const value of [null, undefined, '', 'not-a-number']) {
      expect(formatStockReportQuantity(value, 3)).toBe('-');
      expect(formatStockReportMoney(value)).toBe('-');
    }
  });
});
