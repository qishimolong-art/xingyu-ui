import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readSaleSource(path: string) {
  return readFileSync(join(currentDir, path), 'utf8');
}

describe('sale detail grids keep wrapper data synchronized', () => {
  it.each([
    [
      '销售购物车',
      'cart/modules/item-form.vue',
      'getDisplayedItems()',
      'loadData(displayData)',
    ],
    [
      '销售报价',
      'quote/modules/item-form.vue',
      'getDisplayedItems()',
      'loadData(displayData)',
    ],
    [
      '销售订单',
      'order/modules/item-form.vue',
      'getDisplayTableData()',
      'reloadData(displayData)',
    ],
    [
      '销售退货',
      'return/modules/item-form.vue',
      'getDisplayTableData()',
      'reloadData(displayData)',
    ],
    [
      '销售调价',
      'priceadjust/modules/item-form.vue',
      'getDisplayedItems()',
      'loadData(displayData)',
    ],
  ])(
    '%s 明细刷新前同步 gridOptions.data',
    (_name, file, sourceGetter, refreshCall) => {
      const source = readSaleSource(file);

      expect(source).toContain(`const displayData = ${sourceGetter};`);
      expect(source).toContain(
        'gridApi.setGridOptions({ data: displayData });',
      );
      expect(source).toContain(`await gridApi.grid.${refreshCall};`);
    },
  );

  it('销售订单所有本地明细刷新入口复用同步后的 refreshItemGrid', () => {
    const source = readSaleSource('order/modules/item-form.vue');
    expect(source).toContain('async function refreshItemGrid()');
    expect(source).not.toContain(
      'await gridApi.grid.reloadData(tableData.value);',
    );
  });

  it('销售调价选择出库明细弹窗清空和加载数据时同步 gridOptions.data', () => {
    const source = readSaleSource(
      'priceadjust/modules/sale-out-item-select-modal.vue',
    );

    expect(source).toContain(
      'gridApi.setGridOptions({ data: dataSource.value });',
    );
    expect(source).toContain(
      'await gridApi.grid.reloadData(dataSource.value);',
    );
    expect(
      source.indexOf('gridApi.setGridOptions({ data: dataSource.value });'),
    ).toBeLessThan(
      source.indexOf('await gridApi.grid.reloadData(dataSource.value);'),
    );
  });

  it.each([
    ['销售购物车', 'cart/modules/item-form.vue'],
    ['销售报价', 'quote/modules/item-form.vue'],
    ['销售退货', 'return/modules/item-form.vue'],
  ])(
    '%s 详情态明细部门列使用文本展示，避免禁用懒加载下拉递归更新',
    (_name, file) => {
      const source = readSaleSource(file);
      const deptSlotIndex = source.indexOf('<template #deptId="{ row }">');
      const countSlotIndex = source.indexOf(
        '<template #count="{ row }">',
        deptSlotIndex,
      );
      const deptSlotSource = source.slice(deptSlotIndex, countSlotIndex);

      if (file.startsWith('return/')) {
        expect(deptSlotSource).toContain(
          'v-if="!disabled && !stockLocationReadonly"',
        );
        expect(deptSlotSource).toContain('v-else');
      } else {
        expect(deptSlotSource).not.toContain('ErpLazyPageSelect');
      }
      expect(deptSlotSource).toContain('<span');
    },
  );
});
