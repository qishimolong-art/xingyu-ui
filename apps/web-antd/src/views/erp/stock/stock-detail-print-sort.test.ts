import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  buildStockDetailPrintPayload,
  getStockDetailPrintTooltip,
} from './utils/item-print-sort';

const currentDir = dirname(fileURLToPath(import.meta.url));
const modules = [
  ['in', 'erp:stock-in:print'],
  ['out', 'erp:stock-out:print'],
  ['check', 'erp:stock-check:print'],
  ['transfer-out', 'erp:stock-transfer-out:print'],
  ['warehouse-move', 'erp:warehouse-move:print'],
] as const;

describe('stock detail sorted print contract', () => {
  it('keeps sort parameters only when field and direction are paired', () => {
    expect(
      buildStockDetailPrintPayload({ id: 1 }, 'productName', 'desc'),
    ).toMatchObject({
      id: 1,
      itemOrderDirection: 'desc',
      itemOrderField: 'productName',
    });
    expect(buildStockDetailPrintPayload({ id: 1 })).toEqual({
      id: 1,
      itemOrderDirection: undefined,
      itemOrderField: undefined,
    });
    expect(getStockDetailPrintTooltip()).toBe('按原始顺序打印');
    expect(getStockDetailPrintTooltip('count', 'asc')).toBe('按数量升序打印');
  });

  it.each(modules)(
    '%s detail uses its existing print permission and list bridge',
    (folder, permission) => {
      const form = readFileSync(
        join(currentDir, folder, 'modules/form.vue'),
        'utf8',
      );
      const index = readFileSync(join(currentDir, folder, 'index.vue'), 'utf8');

      expect(form).toContain("defineEmits(['edit', 'print', 'success'])");
      expect(form).toContain(`hasAccessByCodes(['${permission}'])`);
      expect(form).toContain('buildStockDetailPrintPayload(');
      expect(form).toContain(':title="detailPrintTooltip"');
      expect(index).toContain('@print="handlePrint"');
      expect(index).toContain("itemOrderDirection?: 'asc' | 'desc'");
      expect(index).toContain('itemOrderField?: string');
    },
  );

  it('places transfer-out print before unlock-cart action', () => {
    const source = readFileSync(
      join(currentDir, 'transfer-out/modules/form.vue'),
      'utf8',
    );
    expect(source.indexOf('@click="handlePrintFromDetail"')).toBeLessThan(
      source.indexOf('@click="handleUnlockCart"'),
    );
  });
});
