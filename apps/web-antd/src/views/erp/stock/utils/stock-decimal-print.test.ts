import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext, Script } from 'node:vm';

import { expect, it } from 'vitest';

const html = readFileSync(
  resolve('apps/web-antd/public/static/erp/purchase-print-template.html'),
  'utf8',
);
const formatter = html.match(
  /function formatPrintValue\(code, value\) \{[\s\S]*?\n      \}/,
)?.[0];
function format(stock: boolean, code: string, value: unknown) {
  return runInNewContext(`(${formatter})`, {
    preserveStockDecimals: stock,
    normalizeFieldCode: (field: string) => field,
    isAmountPrintFieldCode: (field: string) => /price|amount/i.test(field),
  })(code, value);
}
it('prints stock saved precision and keeps purchase/sale two-place defaults', () => {
  expect(format(true, 'items.totalPrice', '5.055556')).toBe('5.055556');
  expect(format(true, 'items.productPrice', '10.111111')).toBe('10.111111');
  expect(format(true, 'items.count', '0.500000')).toBe('0.5');
  expect(format(true, 'items.totalPrice', '****')).toBe('****');
  expect(format(false, 'items.totalPrice', '5.055556')).toBe('5.06');
  expect(format(true, 'items.productCode', '000123')).toBe('000123');
  expect(html).toContain(
    "if (preserveStockDecimals) params.set('decimalMode', 'string')",
  );
});
it('parses every embedded script after the print change', () => {
  for (const block of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) {
    if (block[1]?.trim())
      expect(() => new Script(block[1] || '')).not.toThrow();
  }
});
