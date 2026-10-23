import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { useFormItemColumns, useGridColumns } from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const dataSource = readFileSync(join(currentDir, 'data.ts'), 'utf8');

describe('sale order grid data', () => {
  it('renders order number column through the detail link slot', () => {
    const noColumn = useGridColumns()?.find(
      (column) => !('children' in column) && column.field === 'no',
    );

    expect(noColumn).toMatchObject({
      field: 'no',
      slots: { default: 'no' },
    });
  });

  it('enables sorting only for columns with a stable backend mapping', () => {
    const columns = useGridColumns() || [];
    const sortableFields = columns
      .filter((column) => !('children' in column) && column.sortable)
      .map((column) => ('field' in column ? column.field : undefined));

    expect(sortableFields).toEqual([
      'no',
      'orderType',
      'customerName',
      'orderTime',
      'creatorName',
      'totalCount',
      'outCount',
      'returnCount',
      'totalProductPrice',
      'totalPrice',
      'depositPrice',
      'status',
    ]);
    expect(sortableFields).not.toContain('productNames');
  });

  it('keeps hidden price item columns in detail mode and renders values', () => {
    const columns = useFormItemColumns(true, [
      'item_productPrice',
      'item_totalProductPrice',
      'item_totalPrice',
    ]) as any[];

    expect(
      columns.find((column) => column.field === 'productPrice'),
    ).toBeTruthy();
    expect(
      columns.find((column) => column.field === 'totalProductPrice')?.formatter,
    ).toBe('formatSaleAmount6');
    expect(
      columns.find((column) => column.field === 'totalPrice')?.formatter,
    ).toBe('formatSaleAmount6');
  });

  it('uses lightweight search controls for list performance', () => {
    const searchSource = dataSource.slice(
      dataSource.indexOf('export function useGridFormSchema()'),
    );

    expect(searchSource).toContain("fieldName: 'productKeyword'");
    expect(searchSource).toContain("component: 'Input'");
    expect(searchSource).toContain(
      '请输入配件编码、名称、单位等，多个条件可用 / 或空格分隔',
    );
    expect(searchSource).toContain('api: getSaleOrderDeptSimplePage');
    expect(searchSource).toContain('api: getSaleOrderUserSimplePage');
    expect(searchSource).toContain('pageSize: 10');
    expect(searchSource).not.toContain("fieldName: 'productId'");
    expect(searchSource).not.toContain('getProductSimpleList');
  });
});
