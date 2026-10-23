import { describe, expect, it } from 'vitest';

import { formatPurchaseInvoiceSourceBizTime } from './source-display';

describe('purchase invoice source display', () => {
  it('formats date strings and timestamps to second precision', () => {
    expect(formatPurchaseInvoiceSourceBizTime('2026-10-12 14:30:25')).toBe(
      '2026-10-12 14:30:25',
    );
    expect(formatPurchaseInvoiceSourceBizTime(1_797_498_625_000)).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
    );
    expect(formatPurchaseInvoiceSourceBizTime('1797498625')).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
    );
  });

  it('uses a placeholder for empty or invalid values', () => {
    expect(formatPurchaseInvoiceSourceBizTime()).toBe('-');
    expect(formatPurchaseInvoiceSourceBizTime('invalid')).toBe('-');
  });
});
