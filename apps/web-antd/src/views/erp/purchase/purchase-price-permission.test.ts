import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const readPurchaseFile = (...segments: string[]) =>
  readFileSync(join(currentDir, ...segments), 'utf8');

describe('purchase price permission loading contract', () => {
  it('loads document details masked only in detail mode', () => {
    const purchaseInForm = readPurchaseFile('in', 'modules', 'form.vue');
    const purchaseReturnForm = readPurchaseFile(
      'return',
      'modules',
      'form.vue',
    );
    const purchaseInvoiceForm = readPurchaseFile(
      'invoice',
      'modules',
      'form.vue',
    );
    const purchasePriceAdjustForm = readPurchaseFile(
      'priceadjust',
      'modules',
      'form.vue',
    );

    expect(purchaseInForm).toContain(
      'await getPurchaseIn(data.id, getPurchaseInLoadOptions(data.type))',
    );
    expect(purchaseReturnForm).toContain('await getPurchaseReturn(');
    expect(purchaseReturnForm).toContain(
      'getPurchaseReturnLoadOptions(data.type)',
    );
    expect(purchaseInvoiceForm).toContain('await getPurchaseInvoice(');
    expect(purchaseInvoiceForm).toContain(
      'getPurchaseInvoiceLoadOptions(data.type)',
    );
    expect(purchasePriceAdjustForm).toContain('await getPurchasePriceAdjust(');
    expect(purchasePriceAdjustForm).toContain(
      'getPurchasePriceAdjustLoadOptions(data.type)',
    );
  });

  it('imports source documents with unmasked detail data for editable forms', () => {
    const purchaseInForm = readPurchaseFile('in', 'modules', 'form.vue');
    const purchaseReturnForm = readPurchaseFile(
      'return',
      'modules',
      'form.vue',
    );
    const purchaseInvoiceForm = readPurchaseFile(
      'invoice',
      'modules',
      'form.vue',
    );

    expect(purchaseInForm).toMatch(
      /await getPurchaseOrder\(order\.id,\s*\{[^}]*mask: false[^}]*\}\)/,
    );
    expect(purchaseReturnForm).toMatch(
      /await getPurchaseIn\(purchaseIn\.id,\s*\{[^}]*mask: false[^}]*\}\)/,
    );
    expect(purchaseInvoiceForm).toContain(
      'getPurchaseInvoiceMixedSourceItemPage({',
    );
    expect(purchaseInvoiceForm).toContain("mask: formType.value === 'detail'");
  });

  it('keeps unauthorized price columns visible and masks them only when disabled', () => {
    const purchaseInData = readPurchaseFile('in', 'data.ts');
    const purchaseReturnData = readPurchaseFile('return', 'data.ts');
    const purchaseInvoiceData = readPurchaseFile('invoice', 'data.ts');
    const purchasePriceAdjustData = readPurchaseFile('priceadjust', 'data.ts');

    expect(purchaseInData).toContain(
      'getColumnPermissionHiddenFields(hiddenFields)',
    );
    expect(purchaseReturnData).toContain(
      'getColumnPermissionHiddenFields(hiddenFields)',
    );
    expect(purchaseInvoiceData).toContain(
      'getColumnPermissionHiddenFields(hiddenFields)',
    );
    expect(purchasePriceAdjustData).toContain(
      'getColumnPermissionHiddenFields(hiddenFields)',
    );
    expect(purchaseInData.replace(/\s+/g, ' ')).toContain(
      "disabled && isPurchaseInPriceItemHidden(hiddenFields, 'lastPurchasePrice')",
    );
    expect(purchaseReturnData.replace(/\s+/g, ' ')).toContain(
      "disabled && isPurchaseReturnPriceItemHidden(hiddenFields, 'lastPurchasePrice')",
    );
    expect(purchaseInvoiceData.replace(/\s+/g, ' ')).toContain(
      "disabled && isPurchaseInvoicePriceItemHidden(hiddenFields, 'totalPrice')",
    );
    expect(purchasePriceAdjustData.replace(/\s+/g, ' ')).toContain(
      "disabled && isPurchasePriceAdjustPriceItemHidden(hiddenFields, 'oldPrice')",
    );
  });
});
