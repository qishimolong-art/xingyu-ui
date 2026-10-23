import { describe, expect, it } from 'vitest';

import { buildSaleCopyDraft } from './copy-draft';

describe('buildSaleCopyDraft', () => {
  it('deep clones and clears common sale identity fields', () => {
    const source = {
      id: 11,
      no: 'SO20260531001',
      status: 20,
      creator: 'u1',
      creatorName: '张三',
      createTime: 1717111111111,
      updater: 'u2',
      updaterName: '李四',
      updateTime: 1717222222222,
      auditorId: 9,
      auditorName: '审核人',
      approveTime: 1717333333333,
      printCount: 3,
      printTime: 1717444444444,
      sourceType: 1,
      sourceId: 22,
      sourceNo: 'SRC-001',
      sourceCreateTime: 1717555555555,
      generatedSaleOutNo: 'OUT-001',
      remark: 'keep',
      discountPercent: 12,
      items: [
        {
          id: 101,
          orderId: 11,
          sourceItemId: 201,
          executedCount: 2,
          creator: 'u1',
          creatorName: '张三',
          createTime: 1717111111111,
          updater: 'u2',
          updaterName: '李四',
          updateTime: 1717222222222,
          productId: 500,
        },
      ],
    };

    const draft = buildSaleCopyDraft(source);

    expect(source.id).toBe(11);
    expect(source.items?.[0]?.id).toBe(101);
    expect(draft).not.toHaveProperty('id');
    expect(draft).not.toHaveProperty('no');
    expect(draft).toHaveProperty('status', 10);
    expect(draft).not.toHaveProperty('creator');
    expect(draft).not.toHaveProperty('creatorName');
    expect(draft).not.toHaveProperty('createTime');
    expect(draft).not.toHaveProperty('updater');
    expect(draft).not.toHaveProperty('updaterName');
    expect(draft).not.toHaveProperty('updateTime');
    expect(draft).not.toHaveProperty('auditorId');
    expect(draft).not.toHaveProperty('auditorName');
    expect(draft).not.toHaveProperty('approveTime');
    expect(draft).toHaveProperty('printCount', 0);
    expect(draft).not.toHaveProperty('printTime');
    expect(draft).not.toHaveProperty('sourceType');
    expect(draft).not.toHaveProperty('sourceId');
    expect(draft).not.toHaveProperty('sourceNo');
    expect(draft).not.toHaveProperty('sourceCreateTime');
    expect(draft).not.toHaveProperty('generatedSaleOutNo');
    expect(draft).toHaveProperty('remark', 'keep');
    expect(draft).toHaveProperty('discountPercent', 12);
    expect(draft.items?.[0]).not.toHaveProperty('id');
    expect(draft.items?.[0]).not.toHaveProperty('orderId');
    expect(draft.items?.[0]).not.toHaveProperty('sourceItemId');
    expect(draft.items?.[0]).not.toHaveProperty('executedCount');
    expect(draft.items?.[0]).not.toHaveProperty('creator');
    expect(draft.items?.[0]).not.toHaveProperty('creatorName');
    expect(draft.items?.[0]).not.toHaveProperty('createTime');
    expect(draft.items?.[0]).not.toHaveProperty('updater');
    expect(draft.items?.[0]).not.toHaveProperty('updaterName');
    expect(draft.items?.[0]).not.toHaveProperty('updateTime');
    expect(draft.items?.[0]).toHaveProperty('productId', 500);
  });

  it('supports custom clean keys and custom detail key', () => {
    const source = {
      id: 1,
      detailList: [
        {
          id: 2,
          parentId: 1,
          sourceItemId: 3,
          extra: 'keep',
        },
      ],
      customField: 'remove me',
    };

    const draft = buildSaleCopyDraft(source, {
      itemKey: 'detailList',
      extraCleanKeys: ['customField'],
      extraItemCleanKeys: ['parentId'],
      overrides: { remark: 'draft' } as any,
    });

    expect(draft.customField).toBeUndefined();
    expect(draft.remark).toBe('draft');
    expect(draft.detailList?.[0]).not.toHaveProperty('id');
    expect(draft.detailList?.[0]).not.toHaveProperty('parentId');
    expect(draft.detailList?.[0]).not.toHaveProperty('sourceItemId');
    expect(draft.detailList?.[0]).toHaveProperty('extra', 'keep');
  });
});
