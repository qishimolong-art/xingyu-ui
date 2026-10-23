import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const erpDir = join(currentDir, '..');

function readErpSource(...segments: string[]) {
  return readFileSync(join(erpDir, ...segments), 'utf8');
}

const archives = [
  {
    name: '配件档案',
    index: readErpSource('product/product/index.vue'),
    data: readErpSource('product/product/data.ts'),
    nameSlot: 'productName',
    keyActions: ['批量修改', '批量停用', '合并', 'handleImport'],
  },
  {
    name: '客户档案',
    index: readErpSource('sale/customer/index.vue'),
    data: readErpSource('sale/customer/data.ts'),
    nameSlot: 'name',
    keyActions: [
      '分部门授信',
      'handleContactDetail',
      'handleEnterpriseMatch',
      '合并',
    ],
  },
  {
    name: '供应商档案',
    index: readErpSource('purchase/supplier/index.vue'),
    data: readErpSource('purchase/supplier/data.ts'),
    nameSlot: 'name',
    keyActions: [
      'handleContactDetail',
      '供应商门户',
      'handleEnterpriseMatch',
      '微信客服',
    ],
  },
  {
    name: '仓库资料',
    index: readErpSource('stock/warehouse/index.vue'),
    data: readErpSource('stock/warehouse/data.ts'),
    nameSlot: 'name',
    keyActions: ['人员权限', '拣货员设置', '批量删除', '批量停用'],
  },
] as const;

describe('base archive list detail entry contract', () => {
  it.each(archives)(
    'removes ordinary cell-click detail from $name',
    ({ index }) => {
      expect(index).not.toContain('function handleCellClick');
      expect(index).not.toContain('cellClick: handleCellClick');
      expect(index).not.toMatch(/cellClick:\s*\(/);
      expect(index).not.toContain('rowActionColumnFields');
      expect(index).not.toContain('linkColumnFields');
    },
  );

  it.each(archives)(
    'keeps the name column as explicit detail entry for $name',
    ({ data, index, nameSlot }) => {
      expect(data).toContain(`slots: { default: '${nameSlot}' }`);
      expect(index).toContain(`<template #${nameSlot}="{ row }">`);
      expect(index).toContain('@click.stop="handleDetail(row)"');
    },
  );

  it.each(archives)(
    'keeps nearby archive actions for $name',
    ({ index, keyActions }) => {
      keyActions.forEach((action) => {
        expect(index).toContain(action);
      });
    },
  );

  it('keeps the common base option grid free of row detail clicks', () => {
    const baseDataGrid = readErpSource('base/components/BaseDataGrid.vue');

    expect(baseDataGrid).not.toContain('function handleCellClick');
    expect(baseDataGrid).not.toContain('cellClick: handleCellClick');
    expect(baseDataGrid).not.toMatch(/cellClick:\s*\(/);
    expect(baseDataGrid).toContain('sortChange: handleSortChange');
    expect(baseDataGrid).toContain('handleEdit.bind(null, row)');
    expect(baseDataGrid).toContain('handleDelete.bind(null, row)');
  });
});
