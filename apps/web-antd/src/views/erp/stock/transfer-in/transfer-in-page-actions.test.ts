import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { useGridColumns } from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');

describe('transfer-in page row actions', () => {
  it('keeps the requested transfer-in fields in the exact order', () => {
    const columns = useGridColumns() as any[];
    const titles = columns.map((column) => column.title);

    expect(titles).toEqual([
      '单号',
      '调出仓库',
      '调出部门',
      '日期',
      '调入仓库',
      '调入部门',
      '调出数量',
      '调出金额',
      '调拨类型',
      '付款方式',
      '运输',
      '项数',
      '经手人',
      '审核人',
      '审核时间',
      '建立人',
      '备注',
      '创建时间',
      '修改人',
      '修改时间',
    ]);

    const fromWarehouseColumn = columns.find(
      (column) => column.field === 'fromWarehouseNames',
    );
    const itemCountColumn = columns.find(
      (column) => column.field === 'itemCount',
    );
    const row = {
      items: [
        { fromWarehouseName: '上海仓' },
        { fromWarehouseName: '上海仓' },
        { fromWarehouseName: '苏州仓' },
      ],
    };
    expect(fromWarehouseColumn.formatter({ row })).toBe('上海仓、苏州仓');
    expect(itemCountColumn.formatter({ row })).toBe(3);
  });

  it('removes the outbound-document action while keeping number detail navigation', () => {
    expect(indexSource).not.toContain('<template #actions');
    expect(indexSource).not.toContain('handleSourceOut');
    expect(indexSource).not.toContain('查看出库单');
    expect(indexSource).toContain('@click.stop="handleDetail(row)"');
  });
});
