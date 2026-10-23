import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(
  join(currentDir, 'PurchaseStockProductSelectModal.vue'),
  'utf8',
);
const stockApiSource = readFileSync(
  join(
    currentDir,
    '..',
    '..',
    '..',
    '..',
    'api',
    'erp',
    'stock',
    'stock',
    'index.ts',
  ),
  'utf8',
);
const warehouseApiSource = readFileSync(
  join(
    currentDir,
    '..',
    '..',
    '..',
    '..',
    'api',
    'erp',
    'stock',
    'warehouse',
    'index.ts',
  ),
  'utf8',
);
const purchaseRoot = join(currentDir, '..');
const purchaseOrderFormSource = readFileSync(
  join(purchaseRoot, 'order', 'modules', 'form.vue'),
  'utf8',
);
const purchaseInFormSource = readFileSync(
  join(purchaseRoot, 'in', 'modules', 'form.vue'),
  'utf8',
);
const purchaseOrderItemForm = readFileSync(
  join(purchaseRoot, 'order', 'modules', 'item-form.vue'),
  'utf8',
);
const purchaseInItemForm = readFileSync(
  join(purchaseRoot, 'in', 'modules', 'item-form.vue'),
  'utf8',
);
const purchaseReturnForm = readFileSync(
  join(purchaseRoot, 'return', 'modules', 'form.vue'),
  'utf8',
);
const purchaseReturnItemForm = readFileSync(
  join(purchaseRoot, 'return', 'modules', 'item-form.vue'),
  'utf8',
);
const inlineSource = readFileSync(
  join(currentDir, 'PurchaseInlineStockSelect.vue'),
  'utf8',
);
const callerSources = [
  purchaseOrderItemForm,
  purchaseInItemForm,
  purchaseReturnForm,
];
const stockProductSelectModalSource = readFileSync(
  join(purchaseRoot, '..', 'components', 'StockProductSelectModal.vue'),
  'utf8',
);

describe('purchase stock product selector contract', () => {
  it('owns fixed purchase-only data providers without sale parameters', () => {
    expect(componentSource).toContain('getPurchaseStockPage');
    expect(componentSource).toContain('getPurchaseWarehouseSimpleList');
    expect(componentSource).toContain(
      'getPurchaseWarehouseOwnerDeptSimpleList',
    );
    expect(componentSource).not.toContain('bizType');
    expect(componentSource).not.toContain('saleDeptId');
  });

  it('opens the shared selector in stock mode so effective price permissions load', () => {
    expect(componentSource).toContain('biz-type="purchase"');
    expect(componentSource).toContain('source="stock"');
  });

  it('forces purchase semantics after all caller parameters', () => {
    const purchaseApi = stockApiSource.slice(
      stockApiSource.indexOf('export function getPurchaseStockPage'),
      stockApiSource.indexOf('export interface SaleStockPageReqVO'),
    );
    expect(purchaseApi.indexOf('...params')).toBeLessThan(
      purchaseApi.indexOf("bizType: 'purchase'"),
    );
    expect(purchaseApi).not.toContain('saleDeptId');
  });

  it('uses the inline picker in purchase order, purchase in, and stock-based purchase return', () => {
    [purchaseOrderItemForm, purchaseInItemForm, purchaseReturnItemForm].forEach(
      (source) => {
        expect(source).toContain('PurchaseInlineStockSelect');
        expect(source).not.toContain(
          '#/views/erp/components/StockProductSelectModal.vue',
        );
      },
    );
  });

  it('keeps purchase selector department out of default filtering', () => {
    expect(componentSource).toContain('deptId?: number');
    expect(componentSource).toContain(':dept-id="props.deptId"');
    const purchaseReturnForm = callerSources[2];
    expect(purchaseReturnForm).toContain("changedFields.includes('deptId')");
    expect(purchaseReturnForm).toContain(':dept-id="formData?.deptId"');
  });

  it('keeps purchase order and purchase in departments as context only', () => {
    const purchaseOrderItemForm = callerSources[0];
    const purchaseInItemForm = callerSources[1];

    expect(purchaseOrderItemForm).toContain('deptId?: number');
    expect(purchaseOrderItemForm).toContain(':dept-id="props.deptId"');
    expect(purchaseInItemForm).toContain('deptId?: number');
    expect(purchaseInItemForm).toContain(':dept-id="props.deptId"');
    expect(purchaseOrderFormSource).toContain(
      "changedFields.includes('deptId')",
    );
    expect(purchaseOrderFormSource).toContain(':dept-id="formData?.deptId"');
    expect(purchaseInFormSource).toContain("changedFields.includes('deptId')");
    expect(purchaseInFormSource).toContain(':dept-id="formData?.deptId"');
  });

  it('uses purchase-visible warehouse selectors with optional document department params', () => {
    const purchaseWarehouseApi = warehouseApiSource.slice(
      warehouseApiSource.indexOf('export const getPurchaseWarehouseSimpleList'),
      warehouseApiSource.indexOf('export const getSaleWarehouseSimpleList'),
    );

    expect(purchaseWarehouseApi).toContain("bizType: 'purchase'");
    expect(purchaseWarehouseApi).toContain('params?: Record<string, any>');
    expect(purchaseWarehouseApi).toContain('deptId: params?.deptId');
    expect(purchaseWarehouseApi).toContain(
      '/erp/warehouse/purchase-owner-dept-simple-list',
    );
    expect(purchaseWarehouseApi).not.toContain('saleDeptId');
  });

  it('enables purchase stock shortcuts from related purchase stock selectors', () => {
    expect(componentSource).toContain('enablePurchaseOrderShortcuts?: boolean');
    expect(componentSource).toContain(
      ':enable-purchase-order-shortcuts="props.enablePurchaseOrderShortcuts"',
    );
    expect(inlineSource).toContain(
      "window.addEventListener('keydown', handleKeydown, true)",
    );
    expect(inlineSource).toContain(
      "window.removeEventListener('keydown', handleKeydown, true)",
    );
    expect(inlineSource).toContain('event.stopImmediatePropagation();');
    expect(inlineSource).toContain("event.key === 'Insert'");
    expect(inlineSource).toContain("event.key === 'Enter'");
  });

  it('preserves inline and legacy modal arrow-key pagination contracts', () => {
    [purchaseInItemForm, purchaseReturnItemForm].forEach((source) => {
      expect(source).toContain('PurchaseInlineStockSelect');
    });
    expect(inlineSource).toContain(
      "event.key === 'ArrowLeft' || event.key === 'ArrowRight'",
    );
    expect(inlineSource).toContain('handlePageChange(targetPage)');
    expect(componentSource).toContain('biz-type="purchase"');
    expect(componentSource).toContain('source="stock"');
    expect(componentSource).toContain(
      ':enable-purchase-order-shortcuts="props.enablePurchaseOrderShortcuts"',
    );
    expect(stockProductSelectModalSource).toContain(
      'props.enablePurchaseOrderShortcuts === true',
    );
    expect(stockProductSelectModalSource).toContain("props.source === 'stock'");
    expect(stockProductSelectModalSource).toContain(
      "props.bizType === 'purchase'",
    );
    expect(stockProductSelectModalSource).toContain(
      'function getStockSelectionPageTarget(direction: -1 | 1)',
    );
    expect(stockProductSelectModalSource).toContain(
      'await grid.setCurrentPage(targetPage);',
    );
    expect(stockProductSelectModalSource).toContain(
      "await grid.commitProxy?.('query');",
    );
    expect(stockProductSelectModalSource).not.toContain("commitProxy?.('page'");
  });
});
