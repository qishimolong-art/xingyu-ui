import { describe, expect, it, vi } from 'vitest';

import { getCategoryList } from '#/api/mall/product/category';

import { useGridColumns, useGridFormSchema } from './data';

vi.mock('#/api/mall/product/category', () => ({
  getCategoryList: vi.fn(() => Promise.resolve([])),
}));

const getCategoryListMock = vi.mocked(getCategoryList);

describe('mall product spu data', () => {
  it('loads the search category tree through the ApiTreeSelect api', async () => {
    getCategoryListMock.mockResolvedValue([
      {
        id: 1,
        parentId: 0,
        name: '轮胎',
        picUrl: '',
        sort: 1,
        status: 0,
      },
      {
        id: 2,
        parentId: 1,
        name: '乘用车轮胎',
        picUrl: '',
        sort: 2,
        status: 0,
      },
    ]);

    const categorySchema = useGridFormSchema().find(
      (schema) => schema.fieldName === 'categoryId',
    );
    const componentProps = categorySchema?.componentProps as Record<
      string,
      any
    >;

    expect(categorySchema?.component).toBe('ApiTreeSelect');
    expect(componentProps.options).toBeUndefined();
    expect(componentProps.api).toEqual(expect.any(Function));

    const tree = await componentProps.api();
    expect(tree).toMatchObject([
      {
        id: 1,
        name: '轮胎',
        children: [{ id: 2, name: '乘用车轮胎' }],
      },
    ]);

    const categoryColumn = (useGridColumns() ?? []).find(
      (column) => column.field === 'categoryId',
    );
    expect(categoryColumn?.formatter).toEqual(expect.any(Function));
    expect(categoryColumn).toBeDefined();
    const formatter = categoryColumn?.formatter as (params: {
      row: { categoryId: number };
    }) => string;
    expect(formatter({ row: { categoryId: 2 } })).toBe('轮胎 / 乘用车轮胎');
  });

  it('labels SPU list stock as mall stock with ERP mini-app hint', () => {
    const stockColumn = (useGridColumns() ?? []).find(
      (column) => column.field === 'stock',
    );

    expect(stockColumn?.title).toBe('商城库存（小程序以 ERP 为准）');
  });

  it('labels SPU list price as the mini-app retail price', () => {
    const priceColumn = (useGridColumns() ?? []).find(
      (column) => column.field === 'price',
    );

    expect(priceColumn?.title).toBe('小程序价格');
    expect(priceColumn?.formatter).toEqual(expect.any(Function));

    const formatter = priceColumn?.formatter as (params: {
      row: { price: number };
    }) => string;
    expect(formatter({ row: { price: 100_000 } })).toBe('1000.00 元');
  });
});
