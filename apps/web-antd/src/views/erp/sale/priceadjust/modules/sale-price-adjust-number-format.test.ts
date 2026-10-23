import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatSaleDecimal, formatSaleAmount } from '../../utils/decimal';
import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const dataSource = readFileSync(join(currentDir, '../data.ts'), 'utf8');
const itemFormSource = readFileSync(join(currentDir, 'item-form.vue'), 'utf8');

describe('sale price adjust number formats', () => {
  it.each([
    ['1.000', '1'],
    ['1.250', '1.25'],
    ['0.000', '0'],
    ['-2.500', '-2.5'],
  ])('formats quantity %s as %s', (value, expected) => {
    expect(formatSaleDecimal(value)).toBe(expected);
  });

  it.each([
    [20, '20.00'],
    [20.5, '20.50'],
    [20.567, '20.567'],
    [0, '0.00'],
  ])('formats price %s as %s', (value, expected) => {
    expect(formatSaleAmount(value)).toBe(expected);
  });

  it('keeps price masking and the existing amount/quantity column formatters', () => {
    expect(dataSource).toContain("field: 'oldPrice'");
    expect(dataSource).toContain("formatter: 'formatSaleDecimal6'");
    expect(dataSource).toContain("? () => '****'");
    expect(dataSource).toContain(": 'formatSaleAmount6'");
    expect(itemFormSource).toContain('inputmode="decimal"');
    expect(itemFormSource).toContain('normalizeNewPrice(row)');
    expect(itemFormSource).toContain("formatSaleAmount(row.newPrice, '-')");
    expect(itemFormSource).toContain(
      'v-else-if="isPriceItemHidden(\'newPrice\')">****',
    );
  });
});
