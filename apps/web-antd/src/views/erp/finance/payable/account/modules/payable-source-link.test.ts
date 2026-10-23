import type { ErpPayableAccountApi } from '#/api/erp/finance/payable/account';

import { describe, expect, it, vi } from 'vitest';

import { getPayableSourceTarget } from './payable-source-link';

const row: ErpPayableAccountApi.PayableDetail = {
  bizId: 1,
  docNo: 'RK-1',
  sourceId: 81,
  sourceNo: 'CGDD-81',
  sourceType: 'PURCHASE_ORDER',
};

describe('payable source document navigation', () => {
  it.each([
    ['PURCHASE_ORDER', 'erp:purchase-order:query'],
    ['FINANCE_PAYMENT', 'erp:finance-payment:query'],
  ] as const)(
    'opens the source ID with %s permission',
    (sourceType, permission) => {
      const access = vi.fn(() => true);
      expect(
        getPayableSourceTarget({ ...row, sourceType }, false, access),
      ).toEqual({
        id: 81,
        type: sourceType,
      });
      expect(access).toHaveBeenCalledExactlyOnceWith([permission]);
    },
  );

  it('does not link without target query permission', () => {
    expect(getPayableSourceTarget(row, false, () => false)).toBeUndefined();
  });

  it('keeps readonly overview non-interactive even with permissions', () => {
    expect(getPayableSourceTarget(row, true, () => true)).toBeUndefined();
  });

  it.each([
    { sourceNo: undefined },
    { sourceNo: '' },
    { sourceNo: '  ' },
    { sourceId: undefined },
    { sourceId: 0 },
    { sourceId: -1 },
    { sourceType: undefined },
    { sourceType: 'UNKNOWN' },
  ])('keeps incomplete or unknown sources as text: %j', (patch) => {
    const incomplete = {
      ...row,
      ...patch,
    } as ErpPayableAccountApi.PayableDetail;
    expect(
      getPayableSourceTarget(incomplete, false, () => true),
    ).toBeUndefined();
  });

  it('resolves each successive source independently without mutating detail rows', () => {
    const first = Object.freeze({ ...row });
    const second = Object.freeze({ ...row, sourceId: 82, sourceNo: 'CGDD-82' });
    expect(getPayableSourceTarget(first, false, () => true)?.id).toBe(81);
    expect(getPayableSourceTarget(second, false, () => true)?.id).toBe(82);
    expect(first.bizId).toBe(1);
  });
});
