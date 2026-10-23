import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const erpDir = join(currentDir, '..');

const stockGridConfigs = [
  { file: 'in/index.vue', id: 'erp-stock-in-list-v2' },
  { file: 'out/index.vue', id: 'erp-stock-out-list-v2' },
  { file: 'check/index.vue', id: 'erp-stock-check-list-v2' },
  { file: 'move/index.vue', id: 'erp-stock-move-list-v2' },
  {
    file: 'warehouse-move/index.vue',
    id: 'erp-stock-warehouse-move-list-v2',
  },
  {
    file: 'transfer-out/index.vue',
    id: 'erp-stock-transfer-out-list-v2',
  },
  {
    file: 'transfer-in/index.vue',
    id: 'erp-stock-transfer-in-list-v2',
  },
  { file: 'inbill/index.vue', id: 'erp-stock-in-bill-list-v2' },
  { file: 'outbill/index.vue', id: 'erp-stock-out-bill-list-v2' },
  { file: 'warehouse/index.vue', id: 'erp-stock-warehouse-list-v2' },
  { file: 'stock/index.vue', id: 'erp-stock-list-v1' },
  {
    file: 'record/modules/stock-record-tab.vue',
    id: 'erp-stock-record-list-v1',
  },
  {
    file: 'record/modules/stock-record-tab.vue',
    id: 'erp-stock-record-detail-list-v1',
  },
  {
    file: 'transfer-ledger/index.vue',
    id: 'erp-stock-transfer-ledger-list',
  },
  {
    file: 'transfer-ledger/modules/transfer-document-readonly-table.vue',
    id: 'erp-business-report-transfer-out-readonly-list-v1',
  },
  {
    file: 'transfer-ledger/modules/transfer-document-readonly-table.vue',
    id: 'erp-business-report-transfer-in-readonly-list-v1',
  },
  {
    file: 'in/modules/item-form.vue',
    id: 'erp-stock-in-item-list-v2',
  },
  {
    file: 'out/modules/item-form.vue',
    id: 'erp-stock-out-item-list-v2',
  },
  {
    file: 'check/modules/item-form.vue',
    id: 'erp-stock-check-item-list-v2',
  },
  {
    file: 'move/modules/item-form.vue',
    id: 'erp-stock-move-item-list-v1',
  },
  {
    file: 'warehouse-move/modules/item-form.vue',
    id: 'erp-stock-warehouse-move-item-list-v1',
  },
  {
    file: 'transfer-out/modules/item-form.vue',
    id: 'erp-stock-transfer-out-item-list-v2',
  },
  {
    file: 'transfer-in/modules/form.vue',
    id: 'erp-stock-transfer-in-item-list-v2',
  },
  {
    file: 'report/modules/stock-age-table.vue',
    id: 'erp-stock-age-report-list-v2',
  },
  {
    file: 'report/modules/stock-check-readonly-table.vue',
    id: 'erp-stock-profit-loss-detail-list-v2',
  },
  {
    file: 'report/modules/stock-in-detail-report-table.vue',
    id: 'erp-stock-in-detail-report-list',
  },
  {
    file: 'report/modules/stock-out-detail-report-table.vue',
    id: 'erp-stock-out-detail-report-list',
  },
  {
    file: 'report/modules/stock-transfer-in-detail-report-table.vue',
    id: 'erp-stock-transfer-in-detail-report-list',
  },
  {
    file: 'report/modules/stock-transfer-out-detail-report-table.vue',
    id: 'erp-stock-transfer-out-detail-report-list',
  },
  {
    file: 'report/modules/stock-realtime-table.vue',
    id: 'erp-business-report-realtime-stock-list-v1',
  },
] as const;

const editableItemDirs = [
  'in',
  'out',
  'check',
  'move',
  'warehouse-move',
  'transfer-out',
] as const;

const newlyPersistedFiles = [
  'out/index.vue',
  'check/index.vue',
  'move/index.vue',
  'inbill/index.vue',
  'outbill/index.vue',
  'warehouse/index.vue',
  'stock/index.vue',
  'record/modules/stock-record-tab.vue',
  'in/modules/item-form.vue',
  'out/modules/item-form.vue',
  'check/modules/item-form.vue',
  'move/modules/item-form.vue',
  'warehouse-move/modules/item-form.vue',
  'transfer-out/modules/item-form.vue',
  'transfer-in/modules/form.vue',
  'report/modules/stock-age-table.vue',
  'report/modules/stock-check-readonly-table.vue',
  'report/modules/stock-in-detail-report-table.vue',
  'report/modules/stock-out-detail-report-table.vue',
  'report/modules/stock-transfer-in-detail-report-table.vue',
  'report/modules/stock-transfer-out-detail-report-table.vue',
] as const;

function readStockSource(file: string) {
  return readFileSync(join(currentDir, file), 'utf8');
}

function collectVueSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return collectVueSources(path);
    return name.endsWith('.vue') ? [readFileSync(path, 'utf8')] : [];
  });
}

describe('stock column settings persistence', () => {
  it('keeps all stock VXE storage ids unique and isolated', () => {
    const ids = stockGridConfigs.map(({ id }) => id);
    expect(ids).toHaveLength(30);
    expect(new Set(ids).size).toBe(ids.length);

    const otherModuleSources = [
      ...collectVueSources(join(erpDir, 'purchase')),
      ...collectVueSources(join(erpDir, 'sale')),
    ].join('\n');
    ids.forEach((id) => {
      expect(otherModuleSources).not.toContain(`id: '${id}'`);
    });
  });

  it('enables all four storage options for every stock VXE grid', () => {
    stockGridConfigs.forEach(({ file, id }) => {
      const source = readStockSource(file);
      expect(source).toContain(`'${id}'`);
      expect(source).toContain('customConfig: {');
      expect(source).toContain('storage: {');
      expect(source).toContain('fixed: true');
      expect(source).toContain('resizable: true');
      expect(source).toContain('sort: true');
      expect(source).toContain('visible: true');
    });
  });

  it('covers the planned 22 newly persisted storage keys', () => {
    const newIds = stockGridConfigs.filter(({ file }) =>
      newlyPersistedFiles.includes(
        file as (typeof newlyPersistedFiles)[number],
      ),
    );
    expect(newIds).toHaveLength(22);
  });

  it('shares one stable id across every document item mode', () => {
    editableItemDirs.forEach((dir) => {
      const itemSource = readStockSource(`${dir}/modules/item-form.vue`);
      expect(
        itemSource.match(/id: 'erp-stock-[^']+-item-list-v\d+'/g),
      ).toHaveLength(1);
      expect(itemSource).toContain('enabled: true');
      expect(itemSource).toMatch(/reloadColumn|itemColumns.reload/);
    });

    const transferInSource = readStockSource('transfer-in/modules/form.vue');
    expect(transferInSource).toContain(
      "id: 'erp-stock-transfer-in-item-list-v2'",
    );
    expect(transferInSource).toMatch(/reloadColumn|itemColumns.reload/);
  });

  it('keeps editable item action columns stable and non-configurable', () => {
    editableItemDirs.forEach((dir) => {
      const source = readStockSource(`${dir}/data.ts`);
      expect(source).toMatch(/field: 'actions',\s*title: '操作'/);
    });
  });

  it('isolates record scenes and reloads final dynamic columns', () => {
    const recordSource = readStockSource('record/modules/stock-record-tab.vue');
    expect(recordSource).toContain("props.scene === 'stockDetailModal'");
    expect(recordSource).toContain("'erp-stock-record-detail-list-v1'");
    expect(recordSource).toContain("'erp-stock-record-list-v1'");
    expect(recordSource).toContain('useReportGridColumns');
    expect(recordSource).toContain('reloadColumn(columns)');

    const stockSource = readStockSource('stock/index.vue');
    expect(stockSource).toContain('productPricePermission.hiddenFields.value');
    expect(stockSource).toContain('productCustomFields.value');
    expect(stockSource).toContain('reloadStockListColumns');
    expect(stockSource).toContain('reloadColumn?.(columns');
  });

  it('preserves report ids and dynamic report column reloads', () => {
    stockGridConfigs
      .filter(({ file }) => file.includes('detail-report-table.vue'))
      .forEach(({ file, id }) => {
        const source = readStockSource(file);
        expect(source).toContain(`id: '${id}'`);
        expect(source).toContain('reloadColumn');
      });

    const transferSource = readStockSource(
      'transfer-ledger/modules/transfer-document-readonly-table.vue',
    );
    expect(transferSource).toContain(
      "'erp-business-report-transfer-out-readonly-list-v1'",
    );
    expect(transferSource).toContain(
      "'erp-business-report-transfer-in-readonly-list-v1'",
    );
  });
});
