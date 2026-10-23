import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  resolveCurrentFinancePaymentItems,
  validateFinancePaymentWriteOffItems,
} from './payment-item-selection';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'form.vue'), 'utf8');

describe('finance payment current item selection', () => {
  it('treats an empty live selection as authoritative', () => {
    const staleCachedItems = [
      { paidPrice: 0, paymentPrice: 100, totalPrice: 14 },
    ];

    const currentItems = resolveCurrentFinancePaymentItems(
      [],
      staleCachedItems,
    );

    expect(currentItems).toEqual([]);
    expect(() =>
      validateFinancePaymentWriteOffItems(currentItems),
    ).not.toThrow();
  });

  it('falls back to cached items only before the selector is available', () => {
    const cachedItems = [{ paidPrice: 20, paymentPrice: 30, totalPrice: 100 }];

    expect(resolveCurrentFinancePaymentItems(undefined, cachedItems)).toBe(
      cachedItems,
    );
    expect(() =>
      validateFinancePaymentWriteOffItems(cachedItems),
    ).not.toThrow();
  });

  it('still rejects amounts outside the remaining write-off range', () => {
    expect(() =>
      validateFinancePaymentWriteOffItems([
        { paidPrice: 0, paymentPrice: 100, totalPrice: 14 },
      ]),
    ).toThrow('第 1 行：核销金额必须在未核销金额范围内');
    expect(() =>
      validateFinancePaymentWriteOffItems([
        { paidPrice: 0, paymentPrice: -10, totalPrice: 14 },
      ]),
    ).toThrow('第 1 行：核销金额必须在未核销金额范围内');
  });

  it('validates and submits the same editable-item snapshot', () => {
    expect(formSource).toContain(': getCurrentEditablePaymentItems();');
    expect(formSource).toContain(
      'validateFinancePaymentWriteOffItems(currentItemsSnapshot);',
    );
    expect(formSource).toContain(
      'buildCurrentPaymentPayload(currentItemsSnapshot)',
    );
    expect(formSource).toContain(': buildLocalIncrementalItems(submitItems)');
  });
});
