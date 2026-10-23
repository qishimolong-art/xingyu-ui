import { describe, expect, it } from 'vitest';

import { useGridFormSchema } from './data';
import { normalizePriceAdjustListRow } from './sale-price-adjust-list';

describe('normalizePriceAdjustListRow', () => {
  it('无税销售调价按不含税差额展示并将税额补为零', () => {
    expect(
      normalizePriceAdjustListRow({ totalAdjustPrice: 125.5 }),
    ).toMatchObject({
      taxExclusiveAdjustPrice: 125.5,
      taxPrice: 0,
      totalAdjustPrice: 125.5,
    });
  });

  it('接口返回税额时按总差额拆分不含税差额', () => {
    expect(
      normalizePriceAdjustListRow({ taxPrice: 13, totalAdjustPrice: 113 }),
    ).toMatchObject({
      taxExclusiveAdjustPrice: 100,
      taxPrice: 13,
    });
  });

  it('仅为已审核单回退审核人和审核日期且不覆盖显式值', () => {
    const updateTime = '2026-07-18 12:00:00';
    expect(
      normalizePriceAdjustListRow({
        status: 20,
        updaterName: '审核用户',
        updateTime,
      }),
    ).toMatchObject({ auditorName: '审核用户', approveTime: updateTime });
    expect(
      normalizePriceAdjustListRow({
        status: 10,
        updaterName: '修改用户',
        updateTime,
      }),
    ).toMatchObject({ auditorName: undefined, approveTime: undefined });
    expect(
      normalizePriceAdjustListRow({
        status: 20,
        auditorName: '独立审核人',
        approveTime: '2026-07-18 13:00:00',
        updaterName: '修改用户',
        updateTime,
      }),
    ).toMatchObject({
      auditorName: '独立审核人',
      approveTime: '2026-07-18 13:00:00',
    });
  });

  it('列表搜索使用分页懒加载下拉和产品关键词', () => {
    const schema = useGridFormSchema();
    const productSchema = schema.find(
      (item) => item.fieldName === 'productKeyword',
    );
    const deptSchema = schema.find((item) => item.fieldName === 'deptId');
    const adjustUserSchema = schema.find(
      (item) => item.fieldName === 'adjustUserId',
    );

    expect(productSchema).toMatchObject({
      component: 'Input',
      componentProps: {
        placeholder: '请输入配件编码、名称、单位等，多个条件可用 / 或空格分隔',
      },
    });
    expect(deptSchema).toMatchObject({
      component: 'ErpLazyPageSelect',
      componentProps: { pageSize: 10 },
    });
    expect(adjustUserSchema).toMatchObject({
      component: 'ErpLazyPageSelect',
      componentProps: { pageSize: 10 },
    });
    expect(schema.some((item) => item.fieldName === 'productId')).toBe(false);
  });
});
