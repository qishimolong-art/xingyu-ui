import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readSource(relativePath: string) {
  return readFileSync(join(currentDir, relativePath), 'utf8');
}

function readFunctionBlock(source: string, functionName: string) {
  const start = source.indexOf(`function ${functionName}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const nextFunction = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, nextFunction === -1 ? undefined : nextFunction);
}

describe('ERP remote item summary contract', () => {
  it.each([
    ['purchase/in/modules/form.vue', 'handleUpdateSummary'],
    ['purchase/order/modules/form.vue', 'handleUpdateDiscountPrice'],
    ['purchase/order/modules/form.vue', 'handleUpdateTotalPrice'],
    ['purchase/priceadjust/modules/form.vue', 'handleUpdateTotalAdjustPrice'],
    ['purchase/return/modules/form.vue', 'handleUpdateSummary'],
    ['sale/cart/modules/form.vue', 'handleUpdateSummary'],
    ['sale/order/modules/form.vue', 'handleUpdateDiscountPrice'],
    ['sale/order/modules/form.vue', 'handleUpdateTotalPrice'],
    ['sale/priceadjust/modules/form.vue', 'handleUpdateTotalAdjustPrice'],
    ['sale/quote/modules/form.vue', 'handleUpdateSummary'],
    ['sale/return/modules/form.vue', 'handleUpdateFeeAmount'],
    ['sale/return/modules/form.vue', 'handleUpdateDiscountPrice'],
    ['sale/return/modules/form.vue', 'handleUpdateTotalPrice'],
  ])('%s keeps page totals out of %s', (relativePath, functionName) => {
    const block = readFunctionBlock(readSource(relativePath), functionName);
    expect(block).toContain('if (isRemoteItemPaging.value)');
    expect(block).toContain('return;');
  });

  it('does not recalculate a sale return document count from the current page', () => {
    const source = readSource('sale/return/modules/form.vue');
    const block = readFunctionBlock(source, 'handleUpdateItems');
    const guardIndex = block.indexOf('if (isRemoteItemPaging.value)');
    const calculationIndex = block.indexOf('calculateTotalCount(items)');

    expect(guardIndex).toBeGreaterThanOrEqual(0);
    expect(calculationIndex).toBeGreaterThan(guardIndex);
  });

  it.each([
    'purchase/order/modules/item-form.vue',
    'sale/order/modules/item-form.vue',
    'sale/priceadjust/modules/item-form.vue',
    'sale/return/modules/item-form.vue',
  ])('%s guards its page-only aggregate emit', (relativePath) => {
    expect(readSource(relativePath)).toContain('if (props.remotePaging)');
  });

  it.each([
    'sale/cart/modules/item-form.vue',
    'sale/order/modules/item-form.vue',
    'sale/quote/modules/item-form.vue',
  ])(
    '%s labels a retained remote aggregate as current-page total',
    (relativePath) => {
      expect(readSource(relativePath)).toContain(
        "props.remotePaging ? '本页合计：' : '合计：'",
      );
    },
  );

  it.each([
    'sale/priceadjust/modules/item-form.vue',
    'sale/return/modules/item-form.vue',
    'stock/check/modules/item-form.vue',
    'stock/in/modules/item-form.vue',
    'stock/move/modules/item-form.vue',
    'stock/out/modules/item-form.vue',
    'stock/transfer-out/modules/item-form.vue',
    'stock/warehouse-move/modules/item-form.vue',
  ])('%s leaves summary rendering to the document form', (relativePath) => {
    const source = readSource(relativePath);
    expect(source).not.toContain('本页合计');
    expect(source).not.toContain('<template #bottom>');
  });

  it.each([
    'finance/settlement/payment/index.vue',
    'finance/settlement/receipt/index.vue',
    'sale/cart/index.vue',
    'sale/out/index.vue',
    'sale/quote/index.vue',
    'sale/return/index.vue',
  ])(
    '%s identifies its list aggregate as current-page total',
    (relativePath) => {
      expect(readSource(relativePath)).toContain('<b>本页合计：</b>');
    },
  );

  it('keeps query-wide stock summaries identified as whole-result totals', () => {
    const stockSource = readSource('stock/stock/index.vue');
    const warehouseMoveSource = readSource('stock/warehouse-move/index.vue');

    expect(stockSource).toContain('getStockSummary(params)');
    expect(stockSource).toContain('<b>合计：</b>');
    expect(warehouseMoveSource).toContain('getWarehouseMoveSummary(params)');
    expect(warehouseMoveSource).toContain('<b>合计：</b>');
  });

  it.each([
    'stock/check/modules/form.vue',
    'stock/in/modules/form.vue',
    'stock/move/modules/form.vue',
    'stock/out/modules/form.vue',
    'stock/transfer-out/modules/form.vue',
    'stock/warehouse-move/modules/form.vue',
  ])('%s renders the whole-document summary', (relativePath) => {
    const source = readSource(relativePath);
    expect(source).toContain('buildRemoteDocumentSummary');
    expect(source).toContain('<StockDocumentSummary');
  });

  it('keeps the shared stock document summary flush and compact', () => {
    const stockSource = readSource('stock/components/StockDocumentSummary.vue');
    const source = readSource('components/ErpDocumentSummaryBar.vue');

    expect(stockSource).toContain('<ErpDocumentSummaryBar');
    expect(stockSource).toContain('inset');
    expect(source).toContain('gap: 8px 20px;');
    expect(source).toContain('min-height: 44px;');
    expect(source).toContain('padding: 8px 12px;');
    expect(source).toContain('margin: 0 -12px -12px;');
  });

  it('uses the shared whole-document summary on the stock transfer-in detail', () => {
    const source = readSource('stock/transfer-in/modules/form.vue');

    expect(source).toContain('<StockDocumentSummary');
    expect(source).toContain("label: '数量'");
    expect(source).toContain("label: '金额'");
    expect(source).toContain("label: '总重'");
    expect(source).not.toContain('<template #bottom>');
    expect(source).not.toContain('stock-transfer-in-item-summary');
  });

  it.each([
    'sale/priceadjust/modules/form.vue',
    'sale/return/modules/form.vue',
  ])(
    '%s applies unsaved cross-page changes to the document summary',
    (relativePath) => {
      expect(readSource(relativePath)).toContain('buildRemoteDocumentSummary');
    },
  );
});
