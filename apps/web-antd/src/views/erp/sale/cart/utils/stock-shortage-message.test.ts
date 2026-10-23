import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildSaleCartStockShortageText } from './stock-shortage-message';

describe('sale cart stock shortage messages', () => {
  it('formats quantities without meaningless trailing zeroes', () => {
    expect(
      buildSaleCartStockShortageText(
        [
          {
            productName: '产品一',
            requiredCount: '1.000',
            shortageCount: '0.000',
            stockCount: '1.250',
            warehouseName: '主仓',
          },
          {
            productCode: 'P-2',
            requiredCount: '0.000',
            shortageCount: '2.500',
            stockCount: '-2.500',
          },
        ],
        5,
      ),
    ).toBe(
      [
        '产品一（主仓）：需要 1，库存 1.25，缺 0',
        'P-2（当前仓库）：需要 0，库存 -2.5，缺 2.5',
      ].join('\n'),
    );
  });

  it('keeps each popup limit while sharing the same formatter', () => {
    const shortages = Array.from({ length: 6 }, (_, index) => ({
      productName: `产品${index + 1}`,
      requiredCount: '1.000',
      shortageCount: '1.000',
      stockCount: '0.000',
    }));

    expect(buildSaleCartStockShortageText(shortages, 2)).toContain(
      '另有 4 项库存不足',
    );
    expect(buildSaleCartStockShortageText(shortages, 5)).toContain(
      '另有 1 项库存不足',
    );

    const formSource = readFileSync(
      resolve(process.cwd(), 'src/views/erp/sale/cart/modules/form.vue'),
      'utf8',
    );
    const itemFormSource = readFileSync(
      resolve(process.cwd(), 'src/views/erp/sale/cart/modules/item-form.vue'),
      'utf8',
    );
    expect(formSource).toContain(
      'buildSaleCartStockShortageText(shortages, 5)',
    );
    expect(itemFormSource).toContain(
      'buildSaleCartStockShortageText(shortages, 2)',
    );
  });
});
