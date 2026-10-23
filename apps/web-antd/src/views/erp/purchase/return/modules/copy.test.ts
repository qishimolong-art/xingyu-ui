import { describe, expect, it } from 'vitest';

import { buildPurchaseReturnCopiedDraft } from './copy';

describe('purchase return copy helper', () => {
  it('clears copy-blocked fields and keeps business fields', () => {
    const draft = buildPurchaseReturnCopiedDraft({
      id: 11,
      no: 'PR-001',
      status: 20,
      returnTime: 1710000000000,
      supplierId: 3,
      taxRate: 13,
      fileUrl: 'a,b,c',
      remark: 'keep me',
      createTime: 1710000001000,
      updateTime: 1710000002000,
      updater: 99,
      items: [
        {
          id: 21,
          seq: 1,
          productId: 1001,
          productName: 'Item A',
          productPrice: 12.5,
          remark: 'line remark',
          sourceInId: 88,
          sourceInItemId: 89,
          sourceInNo: 'IN-001',
          createTime: 1710000003000,
        },
      ],
    } as any);

    expect(draft.id).toBeUndefined();
    expect(draft.no).toBeUndefined();
    expect(draft.status).toBeUndefined();
    expect(draft.returnTime).toBeUndefined();
    expect(draft.createTime).toBeUndefined();
    expect(draft.updateTime).toBeUndefined();
    expect(draft.supplierId).toBe(3);
    expect(draft.taxRate).toBe(13);
    expect(draft.fileUrl).toBe('a,b,c');
    expect(draft.remark).toBe('keep me');
    expect(draft.items?.[0]?.id).toBeUndefined();
    expect(draft.items?.[0]?.productId).toBe(1001);
    expect(draft.items?.[0]?.sourceInNo).toBe('IN-001');
    expect(draft.items?.[0]?.seq).toBe(1);
  });
});
