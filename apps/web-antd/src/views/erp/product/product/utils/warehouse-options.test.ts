import { describe, expect, it } from 'vitest';

import {
  includeSelectedWarehouseOption,
  shouldUseStockVisibleWarehouseOptions,
} from './warehouse-options';

describe('includeSelectedWarehouseOption', () => {
  it('为未出现在可选列表中的已选仓库补齐名称', () => {
    expect(
      includeSelectedWarehouseOption([{ id: 1, name: '一号仓' }], {
        defaultWarehouseId: 2,
        defaultWarehouseName: '二号仓',
      }),
    ).toEqual([
      { id: 2, name: '二号仓' },
      { id: 1, name: '一号仓' },
    ]);
  });

  it('已选仓库存在时不重复追加', () => {
    const options = [{ id: 2, name: '二号仓' }];
    expect(
      includeSelectedWarehouseOption(options, {
        defaultWarehouseId: 2,
        defaultWarehouseName: '二号仓',
      }),
    ).toBe(options);
  });

  it('详情态即使同时有本部门数据权限也使用库存可见仓库', () => {
    expect(
      shouldUseStockVisibleWarehouseOptions({
        readonly: true,
        readonlyBySaleDistribution: false,
      }),
    ).toBe(true);
  });

  it('编辑态仍只使用可编辑仓库', () => {
    expect(
      shouldUseStockVisibleWarehouseOptions({
        readonly: false,
        readonlyBySaleDistribution: false,
      }),
    ).toBe(false);
  });
});
