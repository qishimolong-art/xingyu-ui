import { describe, expect, it } from 'vitest';

import { buildPurchaseInCopiedDraft } from './copy';

describe('purchase in copy helper', () => {
  it('clears copy-blocked fields and keeps business fields', () => {
    const draft = buildPurchaseInCopiedDraft({
      id: 11,
      no: 'IN-001',
      status: 20,
      inTime: 1710000000000,
      supplierId: 3,
      accountId: 8,
      orderId: 99,
      orderNo: 'PO-001',
      purchaser: 100,
      accountant: 101,
      handler: 102,
      deptId: 103,
      feeAmount: 66,
      otherPrice: 77,
      discountPercent: 13,
      fileUrl: 'a,b,c',
      remark: 'keep me',
      createTime: 1710000001000,
      updateTime: 1710000002000,
      updater: '9',
      adjusted: true,
      hasInvoice: true,
      returnCount: 2,
      returnStatus: 1,
      transferOutCount: 1,
      transferOutStatus: 1,
      order: { id: 99, no: 'PO-001' },
      items: [
        {
          id: 21,
          seq: 1,
          productId: 1001,
          productName: 'Item A',
          productPrice: 12.5,
          remark: 'line remark',
          warehouseId: 88,
          createTime: 1710000003000,
          adjusted: true,
          hasInvoice: true,
          returnCount: 2,
          returnStatus: 1,
          hasStockInBill: true,
        },
      ],
    } as any);

    expect(draft.id).toBeUndefined();
    expect(draft.no).toBeUndefined();
    expect(draft.status).toBeUndefined();
    expect(draft.inTime).toBeUndefined();
    expect(draft.createTime).toBeUndefined();
    expect(draft.updateTime).toBeUndefined();
    expect(draft.adjusted).toBeUndefined();
    expect(draft.hasInvoice).toBeUndefined();
    expect(draft.returnCount).toBeUndefined();
    expect(draft.returnStatus).toBeUndefined();
    expect(draft.transferOutCount).toBeUndefined();
    expect(draft.transferOutStatus).toBeUndefined();
    expect(draft.order).toBeUndefined();
    expect(draft.customerId).toBeUndefined();
    expect(draft.feeAmount).toBeUndefined();
    expect(draft.otherPrice).toBeUndefined();
    expect(draft.supplierId).toBe(3);
    expect(draft.accountId).toBe(8);
    expect(draft.fileUrl).toBe('a,b,c');
    expect(draft.items?.[0]?.id).toBeUndefined();
    expect(draft.items?.[0]?.productId).toBe(1001);
    expect(draft.items?.[0]?.warehouseId).toBe(88);
    expect(draft.items?.[0]?.seq).toBe(1);
    expect(draft.items?.[0]?.adjusted).toBeUndefined();
    expect(draft.items?.[0]?.hasInvoice).toBeUndefined();
    expect(draft.items?.[0]?.returnCount).toBeUndefined();
    expect(draft.items?.[0]?.returnStatus).toBeUndefined();
    expect(draft.items?.[0]?.hasStockInBill).toBeUndefined();
  });
});
