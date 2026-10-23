import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const readSaleFile = (...segments: string[]) =>
  readFileSync(join(currentDir, ...segments), 'utf8');

const returnItemSource = readSaleFile('return/modules/item-form.vue');
const returnFormSource = readSaleFile('return/modules/form.vue');
const priceAdjustItemSource = readSaleFile('priceadjust/modules/item-form.vue');
const priceAdjustFormSource = readSaleFile('priceadjust/modules/form.vue');
const saleOutDetailSource = readSaleFile('out/modules/form.vue');

function expectHistoryShortcutContract(source: string) {
  expect(source).toContain('<kbd>Space</kbd><b>销售历史</b>');
  expect(source).toContain('<kbd>Shift</kbd><b>报价订单历史</b>');
  expect(source).toContain('<kbd>W</kbd><b>全部价格</b>');
  expect(source).toContain("void openSaleShortcutHistory('history')");
  expect(source).toContain("void openSaleShortcutHistory('order')");
  expect(source).toContain('pendingQuoteOrderHistoryShift');
  expect(source).toContain(
    'function handleShortcutKeyup(event: KeyboardEvent)',
  );
  expect(source).toContain(
    "window.addEventListener('keydown', handleShortcut, true)",
  );
  expect(source).toContain(
    "window.addEventListener('keyup', handleShortcutKeyup, true)",
  );
  expect(source).toContain(
    "window.removeEventListener('keydown', handleShortcut, true)",
  );
  expect(source).toContain(
    "window.removeEventListener('keyup', handleShortcutKeyup, true)",
  );
  expect(source).toContain('isSaleShortcutOwnerActive');
  expect(source).toContain('isShortcutDialogOpen()');
}

describe('expanded sale document shortcuts', () => {
  it('adds the full five-key contract to sale return create and edit modes', () => {
    expectHistoryShortcutContract(returnItemSource);
    expect(returnItemSource).toContain('<template v-if="!disabled">');
    expect(returnItemSource).toContain('<kbd>F</kbd><b>修改商品</b>');
    expect(returnItemSource).toContain('<kbd>Insert</kbd><b>新增行</b>');
    expect(returnItemSource).toContain('isCreateShortcutKey(event)');
    expect(returnItemSource).toContain("if (event.key.toLowerCase() === 'f')");
    expect(returnItemSource).toContain('rowClassName: getItemRowClassName');
    expect(returnItemSource).toContain('<SaleStockProductSelectModal');
    expect(returnItemSource).toContain('enable-sale-stock-shortcuts');
    expect(returnItemSource).toContain('<ProductFormModal');
    expect(returnFormSource).toContain(
      ':shortcut-active="isSaleReturnFormOpen"',
    );
    expect(returnFormSource).not.toContain('handleSaleReturnCreateShortcut');
  });

  it('adds the full five-key contract to sale price-adjust create and edit modes', () => {
    expectHistoryShortcutContract(priceAdjustItemSource);
    expect(priceAdjustItemSource).toContain('<template v-if="!disabled">');
    expect(priceAdjustItemSource).toContain('<kbd>F</kbd><b>修改商品</b>');
    expect(priceAdjustItemSource).toContain('<kbd>Insert</kbd><b>新增明细</b>');
    expect(priceAdjustItemSource).toContain('isCreateShortcutKey(event)');
    expect(priceAdjustItemSource).toContain("emit('request-add-items')");
    expect(priceAdjustItemSource).toContain(
      "if (event.key.toLowerCase() === 'f')",
    );
    expect(priceAdjustItemSource).toContain(
      'rowClassName: getItemRowClassName',
    );
    expect(priceAdjustItemSource).toContain('<SaleStockProductSelectModal');
    expect(priceAdjustItemSource).toContain('enable-sale-stock-shortcuts');
    expect(priceAdjustItemSource).toContain('<ProductFormModal');
    expect(priceAdjustFormSource).toContain(
      ':shortcut-active="isSalePriceAdjustFormOpen"',
    );
    expect(priceAdjustFormSource).toContain(
      '@request-add-items="handleAddItems"',
    );
    expect(priceAdjustFormSource).not.toContain(
      'handleSalePriceAdjustCreateShortcut',
    );
  });

  it('adds sale, quote, purchase, product-edit and price shortcuts to sale-out detail', () => {
    expectHistoryShortcutContract(saleOutDetailSource);
    expect(saleOutDetailSource).toContain('row.id === activeItemId.value');
    expect(saleOutDetailSource).toContain('<SaleStockProductSelectModal');
    expect(saleOutDetailSource).toContain('enable-sale-stock-shortcuts');
    const shortcutHint = saleOutDetailSource.slice(
      saleOutDetailSource.indexOf('sale-out-detail-shortcut-hint'),
      saleOutDetailSource.indexOf(
        'sale-out-detail-count',
        saleOutDetailSource.indexOf('sale-out-detail-shortcut-hint'),
      ),
    );
    expect(shortcutHint).toContain('<kbd>P</kbd><b>采购订单历史</b>');
    expect(shortcutHint).toContain('<kbd>I</kbd><b>采购入库记录</b>');
    expect(shortcutHint).toContain('<kbd>F</kbd><b>修改商品</b>');
    expect(shortcutHint).not.toContain('<kbd>Insert</kbd>');
    expect(saleOutDetailSource).toContain('<PurchaseItemDetailShortcuts');
    expect(saleOutDetailSource).toContain('<ProductFormModal');
    expect(saleOutDetailSource).toContain("key === 'p'");
    expect(saleOutDetailSource).toContain("key === 'i'");
    expect(saleOutDetailSource).toContain("key === 'f'");
    expect(saleOutDetailSource).toContain("mode: 'in' | 'order'");
    expect(saleOutDetailSource).toContain("['erp:purchase-in:query']");
    expect(saleOutDetailSource).toContain("['erp:product:update']");
  });
});
