import { describe, expect, it } from 'vitest';

import { CommonStatusEnum } from '@vben/constants';

import { buildSupplierCopyDraft } from './copy-draft';

describe('buildSupplierCopyDraft', () => {
  it('clones supplier data and clears identity fields', () => {
    const source = {
      id: 12,
      code: 'S20260601001',
      memberCode: 'M-001',
      name: '测试供应商',
      shortName: '测试',
      contact: '张三',
      mobile: '13800000000',
      status: 0,
      creator: 'u1',
      creatorName: '创建人',
      createTime: '2026-06-01 10:00:00',
      updater: 'u2',
      updaterName: '更新人',
      updateTime: '2026-06-01 11:00:00',
      bankName: '测试银行',
      remark: 'retain',
    };

    const draft = buildSupplierCopyDraft(source as any);

    expect(draft).not.toHaveProperty('id');
    expect(draft).not.toHaveProperty('code');
    expect(draft).not.toHaveProperty('memberCode');
    expect(draft).not.toHaveProperty('creator');
    expect(draft).not.toHaveProperty('creatorName');
    expect(draft).not.toHaveProperty('createTime');
    expect(draft).not.toHaveProperty('updater');
    expect(draft).not.toHaveProperty('updaterName');
    expect(draft).not.toHaveProperty('updateTime');
    expect(draft).toHaveProperty('name', '测试供应商');
    expect(draft).toHaveProperty('contact', '张三');
    expect(draft).toHaveProperty('bankName', '测试银行');
    expect(draft).toHaveProperty('remark', 'retain');
    expect(draft).toHaveProperty('status', CommonStatusEnum.ENABLE);
  });
});
