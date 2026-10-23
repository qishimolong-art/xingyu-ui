import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readStockSource(path: string) {
  return readFileSync(join(currentDir, path), 'utf8');
}

function readItemColumnSource(dir: 'in' | 'out') {
  const source = readStockSource(`${dir}/data.ts`);
  const start = source.indexOf('export function useFormItemColumns(');
  const end = source.indexOf('/** 列表的搜索表单 */', start);
  return source.slice(start, end);
}

describe('stock in/out adaptive list and item tables', () => {
  it.each([
    ['stock in', 'in', 'erp-stock-in-list-v2'],
    ['stock out', 'out', 'erp-stock-out-list-v2'],
  ] as const)(
    '%s list keeps its storage id and enables trailing-column adaptation',
    (_, dir, listId) => {
      const indexSource = readStockSource(`${dir}/index.vue`);
      const dataSource = readStockSource(`${dir}/data.ts`);

      expect(indexSource).toContain(`id: '${listId}'`);
      expect(indexSource).toContain('autoResize: true');
      expect(indexSource).toContain('fit: false');
      expect(indexSource).toContain('useStockDocumentColumns');
      expect(indexSource).toContain('fill: false');
      expect(dataSource).toContain('{ trailingFlexibleColumnMinWidth: 72 }');
    },
  );

  it.each([
    ['stock in', 'in', 'erp-stock-in-item-list-v2'],
    ['stock out', 'out', 'erp-stock-out-item-list-v2'],
  ] as const)(
    '%s item table puts remark last and enables adaptive runtime columns',
    (_, dir, itemId) => {
      const columnSource = readItemColumnSource(dir);
      const itemSource = readStockSource(`${dir}/modules/item-form.vue`);
      const totalPriceIndex = columnSource.indexOf("field: 'totalPrice'");
      const remarkIndex = columnSource.indexOf("field: 'remark'");
      const actionsIndex = columnSource.indexOf("field: 'actions'");

      expect(totalPriceIndex).toBeGreaterThanOrEqual(0);
      expect(remarkIndex).toBeGreaterThan(totalPriceIndex);
      expect(actionsIndex).toBeGreaterThan(remarkIndex);
      expect(itemSource).toContain('trailingFlexibleColumnMinWidth: 150');
      expect(itemSource).toContain('useStockDocumentColumns');
      expect(itemSource).toContain('fit: false');
      expect(itemSource).toContain(`id: '${itemId}'`);
      expect(itemSource).toContain('custom: itemColumns.custom');
    },
  );
});
