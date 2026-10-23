import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const readPurchaseFile = (...segments: string[]) =>
  readFileSync(join(currentDir, ...segments), 'utf8');

const returnItemSource = readPurchaseFile('return/modules/item-form.vue');
const returnFormSource = readPurchaseFile('return/modules/form.vue');
const priceAdjustItemSource = readPurchaseFile(
  'priceadjust/modules/item-form.vue',
);
const priceAdjustFormSource = readPurchaseFile('priceadjust/modules/form.vue');

function expectScopedShortcutLifecycle(source: string) {
  expect(source).toContain('isPurchaseShortcutOwnerActive');
  expect(source).toContain('focusPurchaseShortcutOwner');
  expect(source).toContain('props.shortcutActive');
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
  expect(source).toContain('resetPendingShortcutState()');
}

describe('purchase return and price-adjust detail history shortcuts', () => {
  it('scopes purchase-return shortcuts to its open top-most form', () => {
    expectScopedShortcutLifecycle(returnItemSource);
    expect(returnFormSource).toContain(
      ':shortcut-active="isPurchaseReturnFormOpen"',
    );
    expect(returnFormSource).toContain(
      'isPurchaseReturnFormOpen.value = isOpen',
    );
    expect(returnItemSource).toContain('<kbd>Space</kbd><b>采购历史</b>');
    expect(returnItemSource).toContain('<kbd>Shift</kbd><b>采购订单历史</b>');
  });

  it('adds only Space and Shift history actions beside W in price-adjust detail', () => {
    expectScopedShortcutLifecycle(priceAdjustItemSource);
    expect(priceAdjustFormSource).toContain(
      ':shortcut-active="isPurchasePriceAdjustFormOpen"',
    );
    expect(priceAdjustFormSource).toContain(
      'isPurchasePriceAdjustFormOpen.value = isOpen',
    );
    expect(priceAdjustItemSource).toContain('PurchaseItemDetailShortcuts');
    expect(priceAdjustItemSource).toContain(
      ':history-enabled="props.formType === \'detail\'"',
    );
    expect(priceAdjustItemSource).toContain(':product-edit-enabled="false"');
    expect(priceAdjustItemSource).toContain(
      '<span><kbd>Space</kbd><b>采购历史</b></span>',
    );
    expect(priceAdjustItemSource).toContain(
      '<span><kbd>Shift</kbd><b>采购订单历史</b></span>',
    );
    expect(priceAdjustItemSource).toContain(
      '<span><kbd>W</kbd><b>全部价格</b></span>',
    );
    expect(priceAdjustItemSource).toContain("if (props.formType === 'detail')");
    expect(priceAdjustItemSource).toContain(
      'rowClassName: getItemRowClassName',
    );
    expect(priceAdjustItemSource).toContain('cellClick:');
  });
});
