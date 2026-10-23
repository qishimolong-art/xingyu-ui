import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPinia, setActivePinia } from 'pinia';
import { beforeAll, describe, expect, it } from 'vitest';

import { useFormItemColumns, useGridColumns, useGridFormSchema } from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const itemSource = readFileSync(
  join(currentDir, 'modules/item-form.vue'),
  'utf8',
);

beforeAll(() => {
  setActivePinia(createPinia());
});

describe('stock out sales-cart UI contract', () => {
  it('uses a compact list with only the operation column fixed', () => {
    const columns = useGridColumns() || [];
    const actionColumn = columns.find((column) => column.field === 'actions');
    const leadingColumns = columns.filter(
      (column) => column.field !== 'actions',
    );
    const titles = columns.map((column) => column.title);
    const fields = columns.map((column) => column.field);

    expect(leadingColumns.every((column) => !column.fixed)).toBe(true);
    expect(actionColumn?.fixed).toBe('right');
    expect(actionColumn?.width).toBeLessThanOrEqual(220);
    expect(titles).toEqual([
      undefined,
      '删除',
      '打印',
      '单号',
      '继续选购',
      '仓库',
      '日期',
      '相关对象',
      '总数量',
      '总金额',
      '状态',
      '项数',
      '拣货进度',
      '备注',
      '部门',
      '制单人',
      '操作',
    ]);
    expect(fields).toContain('deleteAction');
    expect(fields).toContain('printAction');
    expect(fields).toContain('continueBuyAction');
    expect(fields).toContain('warehouseNames');
    expect(fields).toContain('itemCount');
    expect(fields).not.toContain('printCount');
    expect(fields).not.toContain('printTime');
    expect(titles).not.toContain('已确认');
    expect(titles).not.toContain('确认时间');
    expect(titles).not.toContain('调入连锁店');
    expect(columns.find((column) => column.field === 'no')?.slots).toEqual({
      default: 'no',
    });
    expect(indexSource).toContain('class="stock-out-number-link"');
    expect(indexSource).toContain('class="stock-out-action-link"');
    expect(indexSource).toContain('StockListQuerySummary');
    expect(indexSource).toContain('<template #bottom>');
    expect(indexSource).toContain(':items="querySummaryItems"');
  });

  it('keeps search controls dense and protects operation eligibility', () => {
    const selectFields = useGridFormSchema().filter((field) =>
      ['ApiSelect', 'CustomerLazySelect', 'Select'].includes(
        String(field.component),
      ),
    );

    expect(selectFields.length).toBeGreaterThan(0);
    expect(
      selectFields.every(
        (field) =>
          (field.componentProps as Record<string, any>)?.popupClassName ===
          'stock-out-search-select-dropdown erp-candidate-focus-popup',
      ),
    ).toBe(true);
    expect(indexSource).toContain('@keydown.enter.capture="handleSearchEnter"');
    expect(indexSource).toContain("auth: ['erp:stock-out:create']");
    expect(indexSource).toContain("auth: ['erp:stock-out:import']");
    expect(indexSource).toContain("auth: ['erp:stock-out:export']");
    expect(indexSource).toContain("auth: ['erp:stock-out:print-template']");
    expect(indexSource).toContain('v-access:code="[\'erp:stock-out:print\']"');
    expect(indexSource).toContain("auth: ['erp:stock-out:update']");
    expect(indexSource).toContain("auth: ['erp:stock-out:confirm']");
    expect(indexSource).toContain("auth: ['erp:stock-out:cancel-confirm']");
    expect(indexSource).toContain("auth: ['erp:stock-out:delete']");
    expect(indexSource).toContain(
      'const canBatchDelete = computed(() => checkedRows.value.length > 0);',
    );
    expect(indexSource).toContain('function isDeleteAllowed');
    expect(indexSource).toContain(
      'rows.filter((item) => isDeleteAllowed(item))',
    );
    expect(indexSource).toContain('await deleteStockOut(targetIds)');
    expect(indexSource).toContain('当前勾选数据没有可删除项');
    expect(indexSource).toContain('不可删除数据将自动跳过');
    expect(indexSource).toMatch(
      /`已删除 \$\{targetIds\.length\} 条，已跳过 \$\{skippedCount\} 条`/,
    );
    expect(indexSource).toContain('ifShow: () => isDeleteAllowed(row)');
    expect(indexSource).toContain('ifShow: shouldShowBatchDelete');
    expect(indexSource).toContain('handleContinueBuy.bind(null, row)');
    expect(indexSource).toContain('handleDelete.bind(null, [row.id!], [row])');
    expect(indexSource).toContain('handlePrint(row)');
    expect(indexSource).toContain('PrintTemplateSelector');
    expect(indexSource).not.toContain(
      'checkedRows.value.every((item) => item.status !== 20)',
    );
  });

  it('uses confirm, cancel-confirm and picking workflow states', () => {
    expect(indexSource).toContain('await confirmStockOut(row.id!)');
    expect(indexSource).toContain('await cancelConfirmStockOut(row.id!)');
    expect(indexSource).toContain("label: '下单确认'");
    expect(indexSource).toContain("label: '撤销确认'");
    expect(indexSource).toContain('row.status === 15');
    expect(formSource).toContain('formData.value?.status === 10');
  });

  it('defaults the outbound time only when creating a document', () => {
    expect(formSource).toMatch(
      /if \(!data\?\.id\) \{[\s\S]*?outTime: Date\.now\(\),[\s\S]*?return;[\s\S]*?getStockOut\(data\.id/,
    );
    expect(formSource.match(/outTime: Date\.now\(\)/g)).toHaveLength(1);
  });

  it('keeps all item business columns sortable and row actions fixed', () => {
    const columns = useFormItemColumns(false) || [];
    const sequenceColumn = columns.find((column) => column.type === 'seq');
    const actionColumn = columns.find(
      (column) => column.slots?.default === 'actions',
    );
    const businessColumns = columns.filter(
      (column) => column.field && column.slots?.default !== 'actions',
    );

    expect(sequenceColumn?.sortable).not.toBe(true);
    expect(businessColumns.every((column) => column.sortable)).toBe(true);
    expect(actionColumn?.fixed).toBe('right');
    expect(actionColumn?.sortable).not.toBe(true);
    expect(itemSource).toContain('sortStockOutItems');
    expect(itemSource).toContain("orders: ['asc', 'desc', null]");
  });

  it('preserves decimal text without a quantity precision cap', () => {
    expect(itemSource).toContain(
      "import { useOtherStockDecimalInputs } from '#/views/erp/stock/utils/other-stock-input';",
    );
    expect(itemSource).toMatch(
      /:value="decimalValue\(row, 'count'\)"[\s\S]*?inputmode="decimal"/,
    );
  });

  it('lazy-loads item warehouse selects with current-value hydration', () => {
    expect(itemSource).toContain('<ErpLazyPageSelect');
    expect(itemSource).toContain('getCurrentWarehouseOption(row)');
    expect(itemSource).toContain('hydrateMissingWarehouseNamesFromApi');
    expect(itemSource).toContain('mergeResolvedStockDocumentOptions');
    expect(itemSource).not.toContain('await getWarehouseSimpleList()');
  });

  it('uses fullscreen detail loading exits and page-matched item typography', () => {
    expect(formSource).toContain('modalApi.setState({ fullscreen: true })');
    expect(formSource).toContain(
      "wrapperClass: 'stock-document-basic-grid grid-cols-4'",
    );
    expect(formSource).toContain('<StockDocumentFormLayout');
    expect(formSource).toContain('<ErpAuditInfo');
    expect(formSource).toContain(':items="formData?.items ?? EMPTY_ITEMS"');
    expect(formSource).toContain('includeItems: false');
    expect(formSource).toContain('await loadStockOutItemPage({ pageNo: 1 })');
    expect(formSource).toContain('detailLoadSequence += 1');
    expect(formSource).toContain('detailLoading.value = false');
    expect(formSource).toContain('getErpDetailLoadError(');
    expect(formSource).toContain('其它出库单加载失败，请关闭后重试');
    expect(itemSource).toContain('class="stock-out-item-grid w-full"');
    expect(itemSource).toContain('() => props.items');
    expect(itemSource).toMatch(/\.stock-out-item-form[\s\S]*?font-size: 11px;/);
    expect(itemSource).toContain('class="stock-out-item-pager"');
    expect(itemSource).toContain('await refreshItemGrid()');
  });
});
