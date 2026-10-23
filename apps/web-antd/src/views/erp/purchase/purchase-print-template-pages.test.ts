import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  buildPurchaseDetailPrintPayload,
  getPurchaseDetailPrintTooltip,
} from './utils/item-print-sort';

const purchaseDir = dirname(fileURLToPath(import.meta.url));

const pages = [
  {
    file: 'order/index.vue',
    form: 'order/modules/form.vue',
    moduleKey: 'purchase_order',
    printPermission: 'erp:purchase-order:print',
    templatePermission: 'erp:purchase-order:print-template',
  },
  {
    file: 'in/index.vue',
    form: 'in/modules/form.vue',
    moduleKey: 'purchase_in',
    printPermission: 'erp:purchase-in:print',
    templatePermission: 'erp:purchase-in:print-template',
  },
  {
    file: 'return/index.vue',
    form: 'return/modules/form.vue',
    moduleKey: 'purchase_return',
    printPermission: 'erp:purchase-return:print',
    templatePermission: 'erp:purchase-return:print-template',
  },
  {
    file: 'invoice/index.vue',
    form: 'invoice/modules/form.vue',
    moduleKey: 'purchase_invoice',
    printPermission: 'erp:purchase-invoice:print',
    templatePermission: 'erp:purchase-invoice:print-template',
  },
  {
    file: 'priceadjust/index.vue',
    form: 'priceadjust/modules/form.vue',
    moduleKey: 'purchase_price_adjust',
    printPermission: 'erp:purchase-price-adjust:print',
    templatePermission: 'erp:purchase-price-adjust:print-template',
  },
];

describe('purchase print template pages', () => {
  it.each(pages)(
    'wires multi-template print entry for $moduleKey',
    ({ file, moduleKey, printPermission, templatePermission }) => {
      const source = readFileSync(join(purchaseDir, file), 'utf8');

      expect(source).toContain('import PrintTemplateModal');
      expect(source).toContain('import PrintTemplateSelector');
      expect(source).toContain('useErpPrintTemplate');
      expect(source).toContain(`const PRINT_TEMPLATE_MODULE = '${moduleKey}'`);
      expect(source).toContain('PrintTemplateDesignModal');
      expect(source).toContain('PrintTemplateSelector');
      expect(source).toContain('handleOpenPrintTemplateDesigner');
      expect(source).toContain('handlePrint.bind(null, row)');
      expect(source).toContain(`auth: ['${printPermission}']`);
      expect(source).toContain(`auth: ['${templatePermission}']`);
      expect(source).toContain('@printed="handleRefresh"');
      expect(source).not.toContain('打印功能待接入');
      expect(source).not.toContain('打印模板正在配置中');
    },
  );

  it.each(pages)(
    'passes the detail sort state through the print entry for $moduleKey',
    ({ file, form, printPermission }) => {
      const pageSource = readFileSync(join(purchaseDir, file), 'utf8');
      const formSource = readFileSync(join(purchaseDir, form), 'utf8');
      const itemFormSource = readFileSync(
        join(purchaseDir, form.replace('form.vue', 'item-form.vue')),
        'utf8',
      );

      expect(pageSource).toContain('@print="handlePrint"');
      expect(pageSource).toContain("itemOrderDirection?: 'asc' | 'desc'");
      expect(pageSource).toContain('itemOrderField?: string');
      expect(formSource).toContain("['edit', 'print', 'success']");
      expect(formSource).toContain(`hasAccessByCodes(['${printPermission}'])`);
      expect(formSource).toContain('buildPurchaseDetailPrintPayload(');
      expect(formSource).toContain('itemPageState.value.orderField');
      expect(formSource).toContain('itemPageState.value.orderDirection');
      expect(formSource).toContain('v-if="canPrintFromDetail"');
      expect(formSource).toContain(':title="detailPrintTooltip"');
      expect(formSource).toContain('存在未保存新增明细，保存后可进行全局排序');
      expect(formSource).toContain('await itemFormRef.value?.clearItemSort()');
      expect(itemFormSource).toContain('await gridApi.grid.setSort(nextSort)');
      expect(itemFormSource).toContain('await gridApi.grid.clearSort()');
      expect(itemFormSource).toContain('clearItemSort,');
    },
  );

  it('keeps sort parameters paired and describes both directions', () => {
    expect(
      buildPurchaseDetailPrintPayload({ id: 1 }, 'productId', 'desc'),
    ).toEqual({
      id: 1,
      itemOrderDirection: 'desc',
      itemOrderField: 'productId',
    });
    expect(buildPurchaseDetailPrintPayload({ id: 1 }, 'productId')).toEqual({
      id: 1,
      itemOrderDirection: undefined,
      itemOrderField: undefined,
    });
    expect(getPurchaseDetailPrintTooltip()).toBe('按原始顺序打印');
    expect(getPurchaseDetailPrintTooltip('productId', 'asc')).toBe(
      '按产品名称升序打印',
    );
    expect(getPurchaseDetailPrintTooltip('productId', 'desc')).toBe(
      '按产品名称降序打印',
    );
  });

  it('keeps the common print branch responsible for no, single, and multiple templates', () => {
    const source = readFileSync(
      join(purchaseDir, '../utils/print-template.ts'),
      'utf8',
    );

    expect(source).toContain('getPrintTemplateList(moduleKey)');
    expect(source).toContain('message.warning');
    expect(source).toContain('templates.length === 1');
    expect(source).toContain('selectorOpen.value = true');
    expect(source).toMatch(
      /pendingTemplateHandler\.value\(\s*pendingRow\.value,\s*selectedTemplateId\.value,?\s*\)/u,
    );
  });
});
