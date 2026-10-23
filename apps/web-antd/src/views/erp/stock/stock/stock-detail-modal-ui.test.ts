import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';

import { useReportGridColumns, useReportGridFormSchema } from '../record/data';
import { buildStockRecordQueryParams } from '../record/stock-record-query';

const currentDir = dirname(fileURLToPath(import.meta.url));
const modulesDir = join(currentDir, 'modules');
const quantityDetailTableSource = readFileSync(
  join(modulesDir, 'stock-quantity-detail-table.vue'),
  'utf8',
);
const stockRecordModalSource = readFileSync(
  join(modulesDir, 'stock-record-modal.vue'),
  'utf8',
);
const stockRecordTabSource = readFileSync(
  join(currentDir, '..', 'record', 'modules', 'stock-record-tab.vue'),
  'utf8',
);
const stockRecordDataSource = readFileSync(
  join(currentDir, '..', 'record', 'data.ts'),
  'utf8',
);
const pendingInModalSource = readFileSync(
  join(modulesDir, 'pending-in-detail-modal.vue'),
  'utf8',
);

const quantityModalDefinitions: [string, string][] = [
  ['在途明细', 'in-transit-detail-modal.vue'],
  ['未入明细', 'pending-in-detail-modal.vue'],
  ['占用明细', 'occupied-detail-modal.vue'],
];
const quantityModalSources = quantityModalDefinitions.map(([label, file]) => ({
  label,
  source: readFileSync(join(modulesDir, file), 'utf8'),
}));

describe('product stock detail modal UI contract', () => {
  it('unifies all quantity detail entries on the fullscreen shared table', () => {
    quantityModalSources.forEach(({ label, source }) => {
      expect(source).toContain('modalApi.setState({ fullscreen: true })');
      expect(source).toContain('<StockQuantityDetailTable');
      expect(source).toContain('content-class="p-0"');
      expect(source).toContain(`${label}加载失败，请关闭后重试`);
      expect(source).toContain('loadSequence += 1');
      expect(source).toContain('if (sequence !== loadSequence) return');
      expect(source).toContain('batchNo: data.batchNo');
      expect(source).toContain(
        'unassignedBatch: data.batchRow === true && !data.batchNo',
      );
      expect(source).toContain("'未指定批次'");
    });
  });

  it('keeps quantity headers sortable without fixing leading columns', () => {
    expect(quantityDetailTableSource).not.toContain("fixed: 'left'");
    expect(quantityDetailTableSource).toContain("title: '序号'");
    expect(quantityDetailTableSource).toContain("title: '单号'");
    expect(quantityDetailTableSource).toContain("title: '批次号'");
    expect(quantityDetailTableSource).toContain('sorter: true');
    expect(quantityDetailTableSource).toContain(
      '.ant-table-column-has-sorters',
    );
    expect(quantityDetailTableSource).toContain('.ant-table-column-sorter)');
    expect(quantityDetailTableSource).toContain('@change="handleTableChange"');
  });

  it('opens transfer-in pending rows in a child detail modal above the inventory modal', () => {
    expect(pendingInModalSource).toContain(
      "import StockTransferInForm from '#/views/erp/stock/transfer-in/modules/form.vue'",
    );
    expect(pendingInModalSource).toContain(
      'STOCK_TRANSFER_IN: stockTransferInModalApi',
    );
    expect(pendingInModalSource).toContain(
      'connectedComponent: StockTransferInForm',
    );
    expect(pendingInModalSource).toContain('destroyOnClose: true');
    expect(
      pendingInModalSource.indexOf('<StockTransferInModal />'),
    ).toBeGreaterThan(pendingInModalSource.indexOf('</Modal>'));
  });

  it('makes the stock record detail fullscreen and leaves all columns scrollable', () => {
    expect(stockRecordModalSource).toContain(
      'modalApi.setState({ fullscreen: true })',
    );
    const columns = useReportGridColumns() ?? [];
    expect(columns.every((column) => !column.fixed)).toBe(true);
    expect(columns[0]).toMatchObject({
      title: '序号',
      type: 'seq',
    });
    expect(columns[1]).toMatchObject({
      field: 'bizDate',
      title: '发生日期',
    });
    const detailColumns = useReportGridColumns([], 'stockDetailModal') as any[];
    expect(detailColumns[1]).toMatchObject({
      field: 'approveTime',
      title: '审批日期',
      sortable: true,
    });
    expect(detailColumns.at(-1)).toMatchObject({
      field: 'bizDate',
      title: '单据时间',
      sortable: true,
    });
  });

  it('uses compact sorting and search interactions in stock records', () => {
    expect(stockRecordTabSource).toContain(
      '@keydown.enter.capture="handleSearchEnter"',
    );
    expect(stockRecordTabSource).toContain(
      '.vxe-header--column.is--sortable .vxe-cell--title',
    );
    expect(stockRecordTabSource).toContain(
      '.vxe-header--column .vxe-cell--sort',
    );
    expect(
      stockRecordDataSource.match(
        /popupClassName: 'stock-record-search-select-dropdown'/g,
      ),
    ).toHaveLength(4);
    expect(stockRecordTabSource).toContain(
      "{ field: 'approveTime', order: 'desc' }",
    );
    expect(stockRecordTabSource).toContain("{ dateBasis: 'approveTime' }");
    expect(stockRecordTabSource).toContain("approveTime: 'approveTime'");
  });

  it('uses the stock detail modal stock record scene without changing default report schema', () => {
    setActivePinia(createPinia());

    expect(stockRecordModalSource).toContain('scene="stockDetailModal"');

    const detailSchema = useReportGridFormSchema('stockDetailModal');
    expect(detailSchema.map((schema) => schema.fieldName)).toEqual([
      'keyword',
      'approveTime',
      'bizTypes',
      'warehouseId',
      'deptId',
    ]);

    const defaultSchema = useReportGridFormSchema();
    expect(defaultSchema.map((schema) => schema.fieldName)).toContain(
      'productKeyword',
    );
    expect(defaultSchema.map((schema) => schema.fieldName)).not.toEqual([
      'keyword',
      'approveTime',
      'bizTypes',
      'warehouseId',
      'deptId',
    ]);
  });

  it('adds the department column only in the stock detail modal record scene', () => {
    const defaultColumns = useReportGridColumns() ?? [];
    const detailColumns = useReportGridColumns([], 'stockDetailModal') as any[];

    expect(defaultColumns.some((column) => column.field === 'deptName')).toBe(
      false,
    );
    expect(
      detailColumns.find((column) => column.field === 'deptName'),
    ).toMatchObject({
      title: '部门',
      sortable: true,
    });
  });

  it('passes stock detail modal keyword and department filters to report requests', () => {
    expect(
      buildStockRecordQueryParams(
        { deptId: 66, keyword: '销售一部' },
        {
          productId: 100,
          stockView: true,
          warehouseId: 3,
        },
        { shouldUseInitialParams: true },
      ),
    ).toMatchObject({
      deptId: 66,
      keyword: '销售一部',
      productId: 100,
      stockView: true,
      warehouseId: 3,
    });
  });

  it('lets the stock record detail warehouse filter override the opening warehouse', () => {
    expect(
      buildStockRecordQueryParams(
        { warehouseId: 8 },
        {
          productId: 100,
          stockView: true,
          warehouseId: 3,
          batchNo: 'B001',
        },
        { shouldUseInitialParams: true },
      ),
    ).toMatchObject({
      productId: 100,
      stockView: true,
      warehouseId: 8,
      batchNo: 'B001',
    });
  });

  it('falls back to the opening warehouse when stock record detail warehouse is cleared', () => {
    expect(
      buildStockRecordQueryParams(
        { warehouseId: undefined },
        {
          productId: 100,
          stockView: true,
          warehouseId: 3,
        },
        { shouldUseInitialParams: true },
      ),
    ).toMatchObject({
      productId: 100,
      stockView: true,
      warehouseId: 3,
    });
  });

  it('keeps stock record price columns visible and masks unauthorized values', () => {
    const columns = useReportGridColumns(['lastPurchasePrice']) as any[];
    const inUnitPriceColumn = columns.find(
      (column) => column.field === 'inUnitPrice',
    );
    const costAmountColumn = columns.find(
      (column) => column.field === 'costAmount',
    );

    expect(
      inUnitPriceColumn?.formatter({ row: { bizType: 70, inUnitPrice: 2 } }),
    ).toBe('****');
    expect(costAmountColumn?.formatter({ row: { costAmount: 20 } })).toBe(
      '****',
    );
  });

  it('uses the latest price permission when stock record columns were created before permission loaded', () => {
    let hiddenFields: string[] = [];
    const columns = useReportGridColumns(() => hiddenFields) as any[];
    const inUnitPriceColumn = columns.find(
      (column) => column.field === 'inUnitPrice',
    );

    expect(
      inUnitPriceColumn?.formatter({ row: { bizType: 70, inUnitPrice: null } }),
    ).toBe('-');

    hiddenFields = ['lastPurchasePrice'];

    expect(
      inUnitPriceColumn?.formatter({ row: { bizType: 70, inUnitPrice: null } }),
    ).toBe('****');
  });
});
