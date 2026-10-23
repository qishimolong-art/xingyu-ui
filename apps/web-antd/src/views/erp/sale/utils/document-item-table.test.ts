import { describe, expect, it } from 'vitest';

import { fitSaleDocumentItemColumnsToWidth } from './document-item-table';

describe('fitSaleDocumentItemColumnsToWidth', () => {
  it('lets the last visible business column absorb only the remaining width', () => {
    const columns = [
      { field: 'code', width: 120 },
      { field: 'remark', minWidth: 150 },
      { field: 'actions', fixed: 'right', width: 80 },
    ] as any[];

    expect(fitSaleDocumentItemColumnsToWidth(columns, 600)).toMatchObject([
      { field: 'code', width: 120 },
      { field: 'remark', minWidth: 400, width: 400 },
      { field: 'actions', width: 80 },
    ]);
  });

  it('preserves minimum widths on narrow containers so horizontal scrolling remains', () => {
    const columns = [
      { field: 'code', width: 180 },
      { field: 'remark', minWidth: 200 },
      { field: 'actions', fixed: 'right', width: 80 },
    ] as any[];

    const fitted = fitSaleDocumentItemColumnsToWidth(columns, 300) as any[];
    expect(fitted.find((column) => column.field === 'remark')).toMatchObject({
      minWidth: 200,
      width: 200,
    });
  });
});
