import { describe, expect, it } from 'vitest';

import { buildCustomerCopyDraft } from './copy-draft';

describe('buildCustomerCopyDraft', () => {
  it('clones customer data and clears identity fields', () => {
    const source = {
      id: 11,
      code: 'C20260531001',
      memberCode: 'M-001',
      platformCode: 'P-001',
      name: '测试客户',
      status: 0,
      creator: 'u1',
      creatorName: '张三',
      createTime: '2026-05-31 10:00:00',
      updateTime: '2026-05-31 11:00:00',
      followUpStatus: true,
      contactLastTime: '2026-05-30 09:00:00',
      contactLastContent: 'keep me out',
      contactNextTime: '2026-06-01 09:00:00',
      lockStatus: true,
      dealStatus: true,
      poolDay: 3,
      ownerUserName: '李四',
      ownerUserDept: '销售部',
      areaName: '华东',
      totalSaleAmount: 1000,
      receivableBalance: 200,
      lastSaleDate: '2026-05-20',
      remark: 'retain',
    };

    const draft = buildCustomerCopyDraft(source as any);

    expect(draft).not.toHaveProperty('id');
    expect(draft).not.toHaveProperty('code');
    expect(draft).not.toHaveProperty('memberCode');
    expect(draft).not.toHaveProperty('platformCode');
    expect(draft).not.toHaveProperty('creator');
    expect(draft).not.toHaveProperty('creatorName');
    expect(draft).not.toHaveProperty('createTime');
    expect(draft).not.toHaveProperty('updateTime');
    expect(draft).not.toHaveProperty('followUpStatus');
    expect(draft).not.toHaveProperty('contactLastTime');
    expect(draft).not.toHaveProperty('contactLastContent');
    expect(draft).not.toHaveProperty('contactNextTime');
    expect(draft).not.toHaveProperty('lockStatus');
    expect(draft).not.toHaveProperty('dealStatus');
    expect(draft).not.toHaveProperty('poolDay');
    expect(draft).not.toHaveProperty('ownerUserName');
    expect(draft).not.toHaveProperty('ownerUserDept');
    expect(draft).not.toHaveProperty('areaName');
    expect(draft).not.toHaveProperty('totalSaleAmount');
    expect(draft).not.toHaveProperty('receivableBalance');
    expect(draft).not.toHaveProperty('lastSaleDate');
    expect(draft).toHaveProperty('name', '测试客户');
    expect(draft).toHaveProperty('remark', 'retain');
    expect(draft).toHaveProperty('status', 0);
  });
});
