import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  formatStockWarehouseDisplayName,
  getStockWarehouseFilterOptionPage,
  getStockWarehouseOwnerDeptSimplePage,
} from '#/api/erp/stock/warehouse';
import { applyStockDocumentListColumnCustomization } from '#/views/erp/stock/utils/document-list-table';

import { useGridColumns, useGridFormSchema } from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const recordModalSource = readFileSync(
  join(currentDir, 'modules/stock-record-modal.vue'),
  'utf8',
);

describe('product stock list UI contract', () => {
  it('measures all business columns from the current page and keeps only the trailing data column flexible', () => {
    const columns = useGridColumns(
      [],
      [
        {
          fieldGroup: 'price_info',
          fieldLabel: '超长自定义价格字段',
          fieldName: 'customLongPrice',
          sort: 10,
          visible: true,
        } as any,
      ],
      [
        {
          warehouseName: '超长仓库名称用于验证当前页内容测宽',
          productName: '超长配件名称 LTY999-适配多个车型-当前页完整显示',
          productCode: 'PRODUCT-CODE-202610210001',
          vehicleModel: '别克雪佛兰凯迪拉克多车型适用',
          customFields: { customLongPrice: 123456.78 },
          costAmount: 987654.32,
        },
      ],
    ) as any[];

    expect(
      columns.find((column) => column.field === 'productName')?.width,
    ).toBeGreaterThan(144);
    expect(
      columns.find((column) => column.field === 'warehouseName')?.width,
    ).toBeGreaterThan(112);
    expect(
      columns.find((column) => column.field === 'productCode')?.width,
    ).toBeGreaterThan(104);
    expect(
      columns.find((column) => column.field === 'vehicleModel')?.width,
    ).toBeGreaterThan(120);
    expect(
      columns.find((column) => column.field === 'customFields__customLongPrice')
        ?.width,
    ).toBeGreaterThanOrEqual(120);

    const trailingColumn = columns.find(
      (column) => column.field === 'costAmount',
    );
    expect(trailingColumn?.width).toBeUndefined();
    expect(trailingColumn?.minWidth).toBeGreaterThanOrEqual(104);
    expect(columns.at(-1)).toMatchObject({
      field: 'actions',
      fixed: 'right',
      width: 132,
    });
  });

  it('keeps leading columns scrollable and fixes only operations', () => {
    const columns = useGridColumns() as any[];

    expect(columns[0]).toMatchObject({
      autoFixed: false,
      type: 'checkbox',
      width: 36,
    });
    expect(
      columns
        .filter((column) => column.fixed)
        .map((column) => ({ fixed: column.fixed, title: column.title })),
    ).toEqual([{ fixed: 'right', title: '操作' }]);
  });

  it('uses the confirmed compact default for fixed price columns', () => {
    const columns = useGridColumns() as any[];
    const hiddenByDefault = [
      'purchasePrice',
      'productPurchasePrice',
      'salePrice',
      'minPrice',
      'backupPrice1',
      'wholesalePrice',
      'currentPrice',
      'currentPriceAmount',
    ];
    const visibleByDefault = [
      'referencePrice',
      'retailPrice',
      'grossProfitRate',
      'sharePrice',
      'lastPurchasePrice',
      'costPrice',
      'costAmount',
    ];

    hiddenByDefault.forEach((field) => {
      expect(columns.find((column) => column.field === field)).toMatchObject({
        visible: false,
      });
    });
    visibleByDefault.forEach((field) => {
      expect(
        columns.find((column) => column.field === field)?.visible,
      ).not.toBe(false);
    });
  });

  it('lets saved column settings reveal default-hidden prices without changing masks', () => {
    const preparedColumns = useGridColumns(['salePrice']) as any[];
    const columns = applyStockDocumentListColumnCustomization(
      preparedColumns,
      [
        {
          field: 'salePrice',
          renderVisible: true,
          resizeWidth: 136,
        },
      ],
      72,
    ) as any[];
    const salePriceColumn = columns.find(
      (column) => column.field === 'salePrice',
    );

    expect(salePriceColumn).toMatchObject({ visible: true, width: 136 });
    expect(salePriceColumn?.formatter({ row: { salePrice: 88 } })).toBe('****');
    expect(
      (useGridColumns() as any[]).find(
        (column) => column.field === 'salePrice',
      ),
    ).toMatchObject({ visible: false });
  });

  it('keeps dynamic price visibility driven by field configuration', () => {
    const columns = useGridColumns(
      [],
      [
        {
          fieldGroup: 'price_info',
          fieldLabel: '启用动态价',
          fieldName: 'enabledPrice',
          visible: true,
        } as any,
        {
          fieldGroup: 'price_info',
          fieldLabel: '停用动态价',
          fieldName: 'disabledPrice',
          visible: false,
        } as any,
      ],
    ) as any[];

    expect(
      columns.some((column) => column.field === 'customFields__enabledPrice'),
    ).toBe(true);
    expect(
      columns.some((column) => column.field === 'customFields__disabledPrice'),
    ).toBe(false);
  });

  it('styles teleported search options at the compact list scale', () => {
    const selectSchemas = useGridFormSchema().filter((schema) =>
      ['ApiSelect', 'Select'].includes(schema.component as string),
    );

    expect(selectSchemas.length).toBeGreaterThan(0);
    selectSchemas.forEach((schema) => {
      expect(schema.componentProps).toMatchObject({
        popupClassName: 'stock-search-select-dropdown',
      });
    });
  });

  it('identifies direct warehouses by their owning department', () => {
    const warehouseSchema = useGridFormSchema().find(
      (schema) => schema.fieldName === 'warehouseId',
    );
    expect(warehouseSchema?.componentProps).toMatchObject({
      labelField: 'displayName',
      valueField: 'id',
    });
    expect(
      formatStockWarehouseDisplayName({
        id: 10,
        name: '普通直发仓',
        directWarehouse: false,
      }),
    ).toBe('普通直发仓');
    expect(
      formatStockWarehouseDisplayName({
        id: 20,
        name: '部门一直发仓',
        deptName: '部门一',
        directWarehouse: true,
      }),
    ).toBe('【直发仓】部门一');
    expect(
      formatStockWarehouseDisplayName({
        id: 30,
        name: '直发仓',
        directWarehouse: true,
      }),
    ).toBe('【直发仓】直发仓');
  });

  it('lazy-loads stock-visible warehouses and owner departments for filters', () => {
    const schemas = useGridFormSchema();
    const deptSchema = schemas.find((schema) => schema.fieldName === 'deptId');
    const warehouseSchema = schemas.find(
      (schema) => schema.fieldName === 'warehouseId',
    );
    const productKeywordSchema = schemas.find(
      (schema) => schema.fieldName === 'productKeyword',
    );

    expect(deptSchema?.component).toBe('ErpLazyPageSelect');
    expect(deptSchema?.componentProps).toMatchObject({
      api: getStockWarehouseOwnerDeptSimplePage,
      labelField: 'name',
      pageSize: 10,
      valueField: 'id',
    });
    expect(warehouseSchema?.component).toBe('ErpLazyPageSelect');
    expect(warehouseSchema?.componentProps).toMatchObject({
      api: getStockWarehouseFilterOptionPage,
      labelField: 'displayName',
      pageSize: 10,
      valueField: 'id',
    });
    const productKeywordProps = productKeywordSchema?.componentProps as any;
    expect(productKeywordProps?.placeholder).toContain(
      '多个条件可用 / 或空格分隔',
    );
  });

  it('removes the obsolete sale-distribution read-only marker', () => {
    expect(indexSource).not.toContain('readonlyBySaleDistribution');
    expect(indexSource).not.toContain('stock-sale-distribution-row');
    expect(indexSource).not.toContain('浅蓝色行表示销售分配仓库仅可查看');
    expect(indexSource).toContain('@keydown.enter.capture="handleSearchEnter"');
  });

  it('keeps batch expansion server-paged and batch rows read-only', () => {
    const columns = useGridColumns() as any[];
    expect(
      columns.find((column) => column.field === 'batchNoSummary'),
    ).toMatchObject({ sortable: true });
    expect(indexSource).toContain('v-model:checked="showBatchNo"');
    expect(indexSource).toContain('showBatchNo: showBatchNo.value');
    expect(indexSource).toContain("keyField: 'rowKey'");
    expect(indexSource).toContain('void gridApi.reload()');
    expect(indexSource).toContain('return isBatchDetailRow(row);');
    expect(indexSource).toContain("row.batchNo || '未指定批次'");
    expect(indexSource).not.toContain('v-if="!isBatchDetailRow(row)"');
  });

  it('recalculates adaptive columns after queries, activation refresh and column settings', () => {
    expect(indexSource).toContain('autoResize: true');
    expect(indexSource).toContain('fit: true');
    expect(indexSource).toContain('currentPageRows.value = result.list || []');
    expect(indexSource).toContain('await reloadStockListColumns();');
    expect(indexSource).toContain('custom: handleStockColumnCustom');
    expect(indexSource).toContain("type !== 'confirm' && type !== 'reset'");
    expect(indexSource).toContain('currentPageRows.value = rows');
    expect(indexSource).toContain('await reloadStockListColumns(rows)');
  });

  it('loads and handles the slow summary independently from the stock page', () => {
    expect(indexSource).toContain('useStockQuerySummary((params, signal) =>');
    expect(indexSource).toContain("getStockSummary({ ...params, decimalMode: 'string' }, signal)");
    expect(indexSource).toContain(
      'const summaryChanged = querySummaryState.prepare(formValues);',
    );
    expect(indexSource).toContain(
      'void querySummaryState.load(formValues, summaryChanged);',
    );
    expect(indexSource).toContain('querySummaryState.cancelPending();');
    expect(indexSource).toContain('@retry="querySummaryState.retry"');
    expect(indexSource).toContain('querySummaryState.invalidate();');
    expect(indexSource).toContain('<AdjustModal @success="handleRefresh" />');
    expect(indexSource).toContain(
      '<FieldEditModal @success="handleRefresh" />',
    );
    expect(indexSource).not.toContain('Promise.all');
  });

  it('opens stock records with the selected batch filter', () => {
    expect(recordModalSource).toContain('batchNo: modalData.value?.batchNo');
    expect(recordModalSource).toContain('unassignedBatch:');
    expect(recordModalSource).toContain("'未指定批次'");
  });
  it('keeps product price columns visible and masks unauthorized values', () => {
    const columns = useGridColumns(
      ['referencePrice', 'col_vipPrice'],
      [
        {
          fieldGroup: 'price_info',
          fieldLabel: 'VIP价',
          fieldName: 'vipPrice',
          sort: 10,
          visible: true,
        } as any,
      ],
    ) as any[];

    expect(columns.some((column) => column.field === 'lastPurchasePrice')).toBe(
      true,
    );
    const referencePriceColumn = columns.find(
      (column) => column.field === 'referencePrice',
    );
    const customPriceColumn = columns.find(
      (column) => column.field === 'customFields__vipPrice',
    );

    expect(
      referencePriceColumn?.formatter({ row: { referencePrice: 12 } }),
    ).toBe('****');
    expect(
      customPriceColumn?.formatter({
        row: { customFields: { vipPrice: 88 } },
      }),
    ).toBe('****');
  });
});
