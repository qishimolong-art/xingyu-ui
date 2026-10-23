import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { withCandidateFocus } from '../../utils/candidate-focus';
import { useGridFormSchema as useTransferInFormSchema } from '../transfer-in/data';
import {
  useFormItemColumns,
  useFormSchema,
  useGridColumns,
  useGridFormSchema,
} from './data';

vi.mock('@vben/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vben/hooks')>()),
  getDictOptions: () => [],
}));

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const dataSource = readFileSync(join(currentDir, 'data.ts'), 'utf8');
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const itemFormSource = readFileSync(
  join(currentDir, 'modules/item-form.vue'),
  'utf8',
);
const batchUpdateItemsSource = readFileSync(
  join(currentDir, 'modules/batch-update-items-form.vue'),
  'utf8',
);

describe('transfer-out page sales-cart UI contract', () => {
  it('keeps shared transfer-ledger search schemas unchanged until a document entrypoint opts in', () => {
    for (const schema of [useTransferInFormSchema(), useGridFormSchema()]) {
      const single = schema.filter((field) =>
        ['Select', 'ApiSelect', 'ErpLazyPageSelect'].includes(
          String(field.component),
        ),
      );
      expect(single.length).toBeGreaterThan(0);
      const marked = withCandidateFocus(single);
      single.forEach((field, index) => {
        const original = field.componentProps as Record<string, unknown>;
        expect(original.popupClassName).not.toContain(
          'erp-candidate-focus-popup',
        );
        expect(marked[index]?.componentProps).toEqual({
          ...original,
          popupClassName: `${original.popupClassName} erp-candidate-focus-popup`,
        });
      });
    }
    const ledger = readFileSync(
      join(
        currentDir,
        '../transfer-ledger/modules/transfer-document-readonly-table.vue',
      ),
      'utf8',
    );
    expect(ledger).not.toContain('withCandidateFocus');
    expect(ledger).toContain('useTransferOutFormSchema()');
    expect(ledger).toContain('useTransferInFormSchema()');
    expect(indexSource).toContain('withCandidateFocus(useGridFormSchema(');
  });
  it('keeps the requested transfer-out fields in the exact order', () => {
    const titles = (useGridColumns() as any[])
      .filter((column) => column.type !== 'checkbox')
      .map((column) => column.title);

    expect(titles).toEqual([
      '删除',
      '打印(次数)',
      '微信通知',
      '单号',
      '结算状态',
      '日期',
      '继续选购',
      '调出部门',
      '调出仓库',
      '调入部门',
      '调入仓库',
      '来源单号',
      '状态',
      '调出数量',
      '调出金额',
      '调拨类型',
      '直发客户',
      '付款方式',
      '优先级别',
      '开票类型',
      '票据号',
      '运输方式',
      '项数',
      '备注',
      '物流单号',
      '物流公司',
      '签收图片',
      '经手人',
      '审核人',
      '审核时间',
      '建立人',
      '建立时间',
      '修改人',
      '修改时间',
      '打印时间',
      '直发结算方式',
      '业务员',
      '操作',
    ]);

    const columns = useGridColumns() as any[];
    const fromWarehouseColumn = columns.find(
      (column) => column.field === 'fromWarehouseNames',
    );
    const toWarehouseColumn = columns.find(
      (column) => column.field === 'toWarehouseNames',
    );
    const row = {
      items: [
        { fromWarehouseName: '上海仓', toWarehouseName: '广州仓' },
        { fromWarehouseName: '上海仓', toWarehouseName: '深圳仓' },
      ],
    };
    expect(fromWarehouseColumn.formatter({ row })).toBe('上海仓');
    expect(toWarehouseColumn.formatter({ row })).toBe('广州仓、深圳仓');
  });

  it('keeps transfer department and warehouse columns field-permission aware', () => {
    const titles = (
      useGridColumns([
        'col_fromDeptName',
        'col_fromWarehouseNames',
        'col_toWarehouseNames',
        'col_toDeptName',
      ]) as any[]
    ).map((column) => column.title);

    expect(titles).not.toContain('调出部门');
    expect(titles).not.toContain('调出仓库');
    expect(titles).not.toContain('调入仓库');
    expect(titles).not.toContain('调入部门');
  });

  it('keeps price and quantity immediately after stock in item details', () => {
    const fields = (useFormItemColumns(false) as any[]).map(
      (column) => column.field || column.type || column.slots?.default,
    );

    expect(fields).toEqual([
      'seq',
      'fromWarehouseId',
      'fromWarehouseDeptName',
      'toWarehouseId',
      'toWarehouseDeptName',
      'productId',
      'stockCount',
      'batchNo',
      'productPrice',
      'count',
      'productCode',
      'productBarCode',
      'productUnitName',
      'packageQty',
      'pieceCount',
      'weight',
      'totalWeight',
      'totalPrice',
      'remark',
      'actions',
    ]);
  });

  it('keeps the dense list scrollable with only the operation column fixed', () => {
    expect(dataSource).toContain('autoFixed: false');
    expect(dataSource).not.toContain("fixed: 'left'");
    expect(dataSource).toMatch(
      /title: '操作',[\s\S]*?width: 72,[\s\S]*?fixed: 'right'/,
    );
    expect(indexSource).toContain("showHeaderOverflow: 'tooltip'");
    expect(indexSource).toContain("showOverflow: 'tooltip'");
  });

  it('uses compact search, Enter submit and an explicit dropdown class', () => {
    expect(indexSource).toContain('commonConfig: { labelWidth: 68 }');
    expect(indexSource).toContain('@keydown.enter.capture="handleSearchEnter"');
    expect(indexSource).toContain('submitSearchFormOnEnterAndBlur');
    expect(indexSource).toContain(
      'submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm())',
    );
    expect(dataSource).toContain(
      "popupClassName: 'transfer-out-search-select-dropdown'",
    );
  });

  it('renders the document number as a link and hides unavailable actions', () => {
    expect(dataSource).toContain("slots: { default: 'no' }");
    expect(indexSource).toContain('class="transfer-out-number-link"');
    expect(indexSource).toMatch(
      /label: '批量删除',[\s\S]*?ifShow: \(\) => canBatchDelete/,
    );
    expect(indexSource).toContain(
      'const canBatchDelete = computed(() => checkedRows.value.length > 0);',
    );
    expect(indexSource).toContain('rows.filter((row) => isDeleteAllowed(row))');
    expect(indexSource).toContain('await deleteStockTransferOut(targetIds)');
    expect(indexSource).toContain('当前勾选数据没有可删除项');
    expect(indexSource).toContain('不可删除数据将自动跳过');
    expect(indexSource).toMatch(
      /`已删除 \$\{targetIds\.length\} 条，已跳过 \$\{skippedCount\} 条`/,
    );
    expect(indexSource).toContain('ifShow: () => isDeleteAllowed(row)');
    expect(indexSource).not.toContain('batchDeleteDisabledReason');
    expect(indexSource).toContain(
      'row.status === 10 && row.approveAllowed !== false',
    );
  });

  it('shows page subtotals above a sticky pager', () => {
    expect(indexSource).toContain('StockListQuerySummary');
    expect(indexSource).toContain('<template #bottom>');
    expect(indexSource).toContain(':items="querySummaryItems"');
    expect(indexSource).toContain('@retry="querySummaryState.retry"');
    expect(indexSource).toContain(':deep(.vxe-grid--pager-wrapper)');
  });

  it('keeps fullscreen four-column detail, loading exits and item hydration', () => {
    const formFields = (useFormSchema('detail') as any[]).map(
      (schema) => schema.fieldName,
    );
    expect(formFields).toContain('directCustomerName');
    expect(dataSource).toMatch(
      /fieldName: 'directCustomerName',[\s\S]*?label: '直发客户',[\s\S]*?disabled: true/,
    );
    expect(formSource).toContain(
      "wrapperClass: 'stock-document-basic-grid grid-cols-4'",
    );
    expect(formSource).toContain('modalApi.setState({ fullscreen: true })');
    expect(formSource).toContain(':loading="detailLoading"');
    expect(formSource).toContain(':error="detailLoadError"');
    expect(formSource).toContain(':items="formData?.items ?? EMPTY_ITEMS"');
    expect(itemFormSource).toContain(
      'gridApi.setGridOptions({ data: displayData, fit: false });',
    );
    expect(itemFormSource).toContain(
      'await gridApi.grid.loadData(displayData)',
    );
    expect(itemFormSource).toContain('immediate: true');
  });

  it('provides stable three-state sorting without sorting sequence or actions', () => {
    expect(dataSource).toMatch(/field: 'productId',[\s\S]*?sortable: true/);
    expect(dataSource).toMatch(
      /field: 'fromWarehouseId',[\s\S]*?sortable: true/,
    );
    expect(dataSource).toMatch(/field: 'count',[\s\S]*?sortable: true/);
    expect(itemFormSource).toContain("orders: ['asc', 'desc', null]");
    expect(itemFormSource).toContain('sortChange: handleItemSortChange');
    expect(itemFormSource).toContain('sortTransferOutItems');
    expect(dataSource).toMatch(
      /title: '操作',[\s\S]*?fixed: 'right',[\s\S]*?visible: !disabled/,
    );
    expect(itemFormSource).not.toContain('选择配件');
  });

  it('reuses the sales-cart stock selector with price permissions and stock context', () => {
    expect(itemFormSource).toContain('<ErpInlineStockSelect');
    expect(itemFormSource).toContain(':stock-page-api="getStockPage"');
    expect(itemFormSource).toContain(':hidden-fields="hiddenFields"');
    expect(itemFormSource).toContain('getAvailableBatchNoList');
    expect(itemFormSource).toContain("bizType: 'stock'");
    expect(dataSource).toContain("field: 'batchNo'");
    expect(dataSource).toContain("slots: { default: 'batchNo' }");
    expect(itemFormSource).toContain('<ErpLazyPageSelect');
    expect(itemFormSource).toContain(
      ':api="getStockMoveFromWarehouseSimplePage"',
    );
    expect(itemFormSource).toContain("getCurrentWarehouseOption(row, 'from')");
    expect(itemFormSource).toContain("getCurrentWarehouseOption(row, 'to')");
    expect(itemFormSource).toContain('hydrateMissingWarehouseNamesFromApi');
    expect(itemFormSource).toContain('mergeResolvedStockDocumentOptions');
    expect(itemFormSource).not.toContain(
      'await getStockMoveFromWarehouseSimpleList()',
    );
    expect(itemFormSource).not.toContain('source="product"');
    expect(itemFormSource).toContain('fromWarehouseId: product.warehouseId');
    expect(itemFormSource).toContain(
      'stockCount: product.availableCount ?? product.count ?? 0',
    );
    expect(itemFormSource).toContain(
      'batchNoEnabled: isBatchNoEnabled(product.batchNoEnabled)',
    );
  });

  it('does not load batch options while showing a read-only detail', () => {
    expect(itemFormSource).toContain('if (!props.disabled) {');
    expect(itemFormSource).toContain('void loadBatchNoOptions(row);');
    expect(itemFormSource).toContain('await loadBatchNoOptions(row);');
  });

  it('renders add row before batch delete as a blue primary action', () => {
    expect(itemFormSource).toContain('新增行');
    expect(itemFormSource).toContain('批量删除');
    expect(itemFormSource).toMatch(/新增行[\s\S]*批量删除/);
    expect(itemFormSource).toContain('type="primary"');
    expect(itemFormSource).toContain('background: #1677ff');
    expect(itemFormSource).toContain('border-color: #1677ff');
    expect(itemFormSource).toContain('background: #4096ff');
  });

  it('supports local batch warehouse and department updates while editing', () => {
    expect(formSource).toContain('const canBatchUpdateItems = computed');
    expect(formSource).toContain(':enable-batch-edit="canBatchUpdateItems"');
    expect(formSource).toContain(':document-id="formData?.id"');
    expect(itemFormSource).toContain("type: 'checkbox'");
    expect(itemFormSource).toContain('canBatchUpdateItemRow');
    expect(itemFormSource).toContain('批量修改仓库/部门');
    expect(itemFormSource).toContain(
      "slots: { buttons: 'toolbar-buttons', tools: 'toolbar-tools' }",
    );
    expect(itemFormSource).toContain('transfer-out-item-batch-summary');
    expect(itemFormSource).toContain('applyLocalBatchUpdateItems');
    expect(itemFormSource).toContain('item_fromWarehouseId');
    expect(itemFormSource).toContain('item_toWarehouseId');
    expect(itemFormSource).toContain("['erp:stock-transfer-out:create']");
    expect(itemFormSource).toContain("['erp:stock-transfer-out:update']");
    expect(itemFormSource).toContain('row.stockCount =');
    expect(itemFormSource).toContain('await loadBatchNoOptions(row)');
    expect(itemFormSource).toContain('批量修改后存在调出仓库和调入仓库相同');
  });

  it('lets users choose whether to batch update from or to warehouse', () => {
    expect(batchUpdateItemsSource).toContain('调出仓库/部门');
    expect(batchUpdateItemsSource).toContain('调入仓库/部门');
    expect(batchUpdateItemsSource).toContain(
      'getStockMoveFromWarehouseSimpleList',
    );
    expect(batchUpdateItemsSource).toContain('getWarehouseSimpleList');
    expect(batchUpdateItemsSource).toContain('item_fromWarehouseId');
    expect(batchUpdateItemsSource).toContain('item_toWarehouseId');
    expect(batchUpdateItemsSource).toContain('请选择需要修改的仓库方向');
    expect(batchUpdateItemsSource).toContain(
      'const currentItemCount = itemCount.value',
    );
    expect(batchUpdateItemsSource).toContain(
      'const currentSide = formData.value.side',
    );
    expect(batchUpdateItemsSource).toContain(
      'const currentWarehouseId = formData.value.warehouseId',
    );
    expect(batchUpdateItemsSource).toContain('const payload = {');
    expect(batchUpdateItemsSource).toContain('side: currentSide');
    expect(batchUpdateItemsSource).toContain('warehouseId: currentWarehouseId');
    expect(batchUpdateItemsSource).toContain("emit('success', payload)");
    expect(batchUpdateItemsSource).not.toContain('side: formData.value.side');
  });
});
