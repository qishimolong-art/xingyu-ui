import { describe, expect, it } from 'vitest';

import { buildFinanceCopyDraft } from './copy-draft';

describe('buildFinanceCopyDraft', () => {
  it('clears identity, audit and display-only fields while preserving business data', () => {
    const source: Record<string, any> = {
      id: 1,
      no: 'FK20260531001',
      status: 20,
      creator: 'u1',
      creatorName: 'creator',
      createTime: 1717111111111,
      updater: 'u2',
      updaterName: 'updater',
      updateTime: 1717222222222,
      auditorId: 3,
      auditTime: 1717333333333,
      accountName: 'cash',
      supplierName: 'supplier',
      supplierId: 10,
      accountId: 20,
      remark: 'keep',
      totalPrice: 100,
      items: [
        {
          id: 11,
          paymentId: 1,
          bizId: 100,
          bizType: 1,
          bizNo: 'SRC-001',
          paymentPrice: 90,
          creatorName: 'item creator',
        },
      ],
    };

    const draft = buildFinanceCopyDraft(source);

    expect(source.id).toBe(1);
    expect(source.items[0]?.id).toBe(11);
    expect(draft).not.toHaveProperty('id');
    expect(draft).not.toHaveProperty('no');
    expect(draft.status).toBe(10);
    expect(draft).not.toHaveProperty('creator');
    expect(draft).not.toHaveProperty('creatorName');
    expect(draft).not.toHaveProperty('createTime');
    expect(draft).not.toHaveProperty('updater');
    expect(draft).not.toHaveProperty('updaterName');
    expect(draft).not.toHaveProperty('updateTime');
    expect(draft).not.toHaveProperty('auditorId');
    expect(draft).not.toHaveProperty('auditTime');
    expect(draft).not.toHaveProperty('accountName');
    expect(draft).not.toHaveProperty('supplierName');
    expect(draft.supplierId).toBe(10);
    expect(draft.accountId).toBe(20);
    expect(draft.remark).toBe('keep');
    expect(draft.totalPrice).toBe(100);
    expect(draft.items?.[0]).not.toHaveProperty('id');
    expect(draft.items?.[0]).not.toHaveProperty('paymentId');
    expect(draft.items?.[0]).not.toHaveProperty('creatorName');
    expect(draft.items?.[0]?.bizId).toBe(100);
    expect(draft.items?.[0]?.paymentPrice).toBe(90);
    expect(draft.items?.[0]?.row_id).toEqual(expect.any(Number));
  });

  it('supports custom clean keys and overrides', () => {
    const draft = buildFinanceCopyDraft<Record<string, any>>(
      {
        id: 1,
        custom: 'remove',
        detailList: [{ id: 2, parentId: 1, amount: 30 }],
      },
      {
        itemKey: 'detailList',
        extraCleanKeys: ['custom'],
        extraItemCleanKeys: ['parentId'],
        overrides: { remark: 'copied' } as any,
      },
    );

    expect(draft).not.toHaveProperty('id');
    expect(draft).not.toHaveProperty('custom');
    expect(draft.status).toBe(10);
    expect(draft.remark).toBe('copied');
    expect(draft.detailList?.[0]).not.toHaveProperty('id');
    expect(draft.detailList?.[0]).not.toHaveProperty('parentId');
    expect(draft.detailList?.[0]?.amount).toBe(30);
  });
});
