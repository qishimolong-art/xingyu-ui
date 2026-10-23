import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  filterPriceTypeOptions,
  sourcePriceTypeOptions,
  targetPriceTypeOptions,
  useGridColumns,
} from './data';

describe('parts price adjust field permission', () => {
  it('masks unauthorized price columns and disables editing', () => {
    const columns = useGridColumns(['branch_price', 'col_retail_price']) || [];
    const referencePriceColumn = columns.find(
      (column: any) => column.field === 'referencePrice',
    ) as any;
    const retailPriceColumn = columns.find(
      (column: any) => column.field === 'retailPrice',
    ) as any;
    const wholesalePriceColumn = columns.find(
      (column: any) => column.field === 'wholesalePrice',
    ) as any;

    expect(referencePriceColumn).toBeTruthy();
    expect(referencePriceColumn.editRender).toBeUndefined();
    expect(
      referencePriceColumn.formatter({ row: { referencePrice: 12.345 } }),
    ).toBe('****');

    expect(retailPriceColumn).toBeTruthy();
    expect(retailPriceColumn.editRender).toBeUndefined();
    expect(retailPriceColumn.formatter({ row: { retailPrice: 23.456 } })).toBe(
      '****',
    );

    expect(wholesalePriceColumn).toBeTruthy();
    expect(wholesalePriceColumn.editRender).toBeTruthy();
    expect(
      wholesalePriceColumn.formatter({ row: { wholesalePrice: 34.567 } }),
    ).toBe(34.567);
  });

  it('filters unauthorized batch-adjust price options', () => {
    const hiddenFields = ['referencePrice', 'col_purchasePrice'];

    expect(
      filterPriceTypeOptions(targetPriceTypeOptions, hiddenFields).some(
        (option) => option.value === 'REFERENCE_PRICE',
      ),
    ).toBe(false);
    expect(
      filterPriceTypeOptions(sourcePriceTypeOptions, hiddenFields).some(
        (option) => option.value === 'PURCHASE_PRICE',
      ),
    ).toBe(false);
    expect(
      filterPriceTypeOptions(sourcePriceTypeOptions, hiddenFields).some(
        (option) => option.value === 'RETAIL_PRICE',
      ),
    ).toBe(true);
  });

  it('reloads grid columns after hidden price permissions change', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'apps/web-antd/src/views/erp/parts/price-adjust/index.vue',
      ),
      'utf8',
    );

    expect(source).toContain('reloadColumn');
    expect(source.indexOf('reloadColumn')).toBeGreaterThan(
      source.indexOf('useGridColumns(fields)'),
    );
  });
});
