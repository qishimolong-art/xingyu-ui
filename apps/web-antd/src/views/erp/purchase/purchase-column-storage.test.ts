import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const erpDir = join(currentDir, '..');

const purchaseGridConfigs = [
  { file: 'order/index.vue', id: 'erp-purchase-order-list-v4' },
  { file: 'in/index.vue', id: 'erp-purchase-in-list-v2' },
  { file: 'return/index.vue', id: 'erp-purchase-return-list-v2' },
  { file: 'invoice/index.vue', id: 'erp-purchase-invoice-list-v2' },
  {
    file: 'priceadjust/index.vue',
    id: 'erp-purchase-price-adjust-list-v2',
  },
  { file: 'supplier/index.vue', id: 'erp-purchase-supplier-list-v2' },
  { file: 'inbill/index.vue', id: 'erp-purchase-in-bill-list-v1' },
  {
    file: 'order/modules/item-form.vue',
    id: 'erp-purchase-order-item-list-v1',
  },
  {
    file: 'in/modules/item-form.vue',
    id: 'erp-purchase-in-item-list-v1',
  },
  {
    file: 'return/modules/item-form.vue',
    id: 'erp-purchase-return-item-list-v1',
  },
  {
    file: 'invoice/modules/item-form.vue',
    id: 'erp-purchase-invoice-item-list-v1',
  },
  {
    file: 'priceadjust/modules/item-form.vue',
    id: 'erp-purchase-price-adjust-item-list-v1',
  },
  {
    file: 'report/modules/purchase-order-detail-report-table.vue',
    id: 'erp-purchase-order-detail-report-list-v2',
  },
  {
    file: 'report/modules/purchase-in-detail-report-table.vue',
    id: 'erp-purchase-in-detail-report-list-v2',
  },
  {
    file: 'report/modules/purchase-invoice-detail-report-table.vue',
    id: 'erp-purchase-invoice-detail-report-list',
  },
  { file: 'report/legacy.vue', id: 'erp-purchase-report-list-v2' },
  {
    file: 'report/legacy.vue',
    id: 'erp-purchase-report-product-list-v2',
  },
  { file: 'report/legacy.vue', id: 'erp-purchase-report-dept-list-v1' },
  { file: 'report/legacy.vue', id: 'erp-purchase-report-detail-list-v2' },
] as const;

const sharedItemForms = [
  { dir: 'order', component: 'PurchaseOrderItemForm' },
  { dir: 'in', component: 'ItemForm' },
  { dir: 'return', component: 'ItemForm' },
  { dir: 'invoice', component: 'ItemForm' },
  { dir: 'priceadjust', component: 'ItemForm' },
] as const;

function readPurchaseSource(file: string) {
  return readFileSync(join(currentDir, file), 'utf8');
}

function collectVueSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return collectVueSources(path);
    return name.endsWith('.vue') ? [readFileSync(path, 'utf8')] : [];
  });
}

function getStorageConfigBeforeId(source: string, id: string) {
  const idIndex = source.indexOf(`id: '${id}'`);
  expect(idIndex).toBeGreaterThanOrEqual(0);
  return source.slice(Math.max(0, idIndex - 500), idIndex);
}

describe('purchase column settings persistence', () => {
  it('keeps all purchase VXE storage ids unique and isolated', () => {
    const ids = purchaseGridConfigs.map(({ id }) => id);
    expect(ids).toHaveLength(19);
    expect(new Set(ids).size).toBe(ids.length);

    const otherModuleSources = [
      ...collectVueSources(join(erpDir, 'sale')),
      ...collectVueSources(join(erpDir, 'stock')),
    ].join('\n');
    ids.forEach((id) => {
      expect(otherModuleSources).not.toContain(`id: '${id}'`);
    });
  });

  it('enables all four local storage options for every purchase VXE grid', () => {
    purchaseGridConfigs.forEach(({ file, id }) => {
      const source = readPurchaseSource(file);
      const storageConfig = getStorageConfigBeforeId(source, id);

      expect(storageConfig).toContain('customConfig: {');
      expect(storageConfig).toContain('storage: {');
      expect(storageConfig).toContain('fixed: true');
      expect(storageConfig).toContain('resizable: true');
      expect(storageConfig).toContain('sort: true');
      expect(storageConfig).toContain('visible: true');
    });
  });

  it('shares one item-grid id across create, edit, copy, and detail modes', () => {
    sharedItemForms.forEach(({ component, dir }) => {
      const formSource = readPurchaseSource(`${dir}/modules/form.vue`);
      const itemSource = readPurchaseSource(`${dir}/modules/item-form.vue`);

      expect(formSource).toContain(`<${component}`);
      expect(formSource).toMatch(
        /:disabled="(?:formType === 'detail'|isDetailMode|itemDisabled)"/,
      );
      expect(
        itemSource.match(/id: 'erp-purchase-[^']+-item-list-v1'/g),
      ).toHaveLength(1);
      expect(itemSource).toContain('enabled: true');
      expect(itemSource).toContain('reloadColumn');
      if (dir === 'invoice') {
        expect(itemSource).toContain('custom: true');
        expect(itemSource).toContain('refresh: {');
        expect(itemSource).toContain('queryMethod: () => refreshItemGrid()');
        expect(itemSource).toContain('zoom: true');
        expect(itemSource).toContain("tools: 'toolbar-tools'");
        expect(itemSource).toContain('<template #toolbar-tools>');
      }
      if (dir === 'priceadjust') {
        expect(itemSource).toContain('refresh: true');
        expect(itemSource).toContain('zoom: true');
        expect(itemSource).toContain('custom: true');
        expect(itemSource).toContain("tools: 'toolbar-tools'");
      }
    });
  });

  it('keeps editable item action columns stable and non-configurable', () => {
    sharedItemForms.forEach(({ dir }) => {
      const source = readPurchaseSource(`${dir}/data.ts`);
      expect(source).toMatch(/field: 'actions',\s*title: '操作'/);
    });
  });

  it('preserves dynamic report column reloads under stable report ids', () => {
    purchaseGridConfigs
      .filter(({ file }) => file.includes('detail-report-table.vue'))
      .forEach(({ file, id }) => {
        const source = readPurchaseSource(file);
        expect(source).toContain(`id: '${id}'`);
        expect(source).toContain('reloadColumn');
      });
  });
});
