import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  getStockCheckBalanceType,
  useFormItemColumns,
  useGridColumns,
  useGridFormSchema,
} from './data';
import { formatStockCheckCountInput } from './modules/stock-check-item-number';
import {
  formatStockCheckSummaryAmount,
  formatStockCheckSummaryCount,
  isStockCheckRowDeletable,
  STOCK_CHECK_APPROVED_STATUS,
} from './stock-check-list-ui';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const itemSource = readFileSync(
  join(currentDir, 'modules/item-form.vue'),
  'utf8',
);

function getTemplateSlot(source: string, name: string) {
  const start = source.indexOf(`<template #${name}>`);
  if (start === -1) return '';
  const end = source.indexOf('</template>', start);
  return source.slice(start, end);
}

const centerFooterSource = getTemplateSlot(formSource, 'center-footer');
const prependFooterSource = getTemplateSlot(formSource, 'prepend-footer');

describe('stock check page UI contract', () => {
  beforeEach(() => setActivePinia(createPinia()));

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

  it('keeps the stock-check list headers complete and business-focused', () => {
    const columns = useGridColumns() as any[];

    expect(columns.map((column) => column.title || column.type)).toEqual([
      'checkbox',
      '删除',
      '打印',
      '单号',
      '日期',
      '状态',
      '仓库',
      '盘点类型',
      '类型',
      '盈亏数',
      '盈亏金额',
      '盘点人',
      '部门',
      '备注',
      '审核人',
      '审核时间',
      '建立人',
      '建立时间',
      '修改人',
      '修改时间',
      '项数',
      '打印次数',
      '打印时间',
      '操作',
    ]);
    expect(columns.some((column) => column.title === '关联单号')).toBe(false);
    expect(columns.some((column) => column.title === '继续选购')).toBe(false);
    expect(columns.some((column) => column.title === '已确认')).toBe(false);
    expect(columns.some((column) => column.title === '复核人')).toBe(false);
    expect(columns.find((column) => column.title === '打印')).toMatchObject({
      field: 'printAction',
      slots: { default: 'printAction' },
    });
    expect(columns.find((column) => column.title === '删除')).toMatchObject({
      field: 'deleteAction',
      slots: { default: 'deleteAction' },
    });
    expect(
      columns
        .find((column) => column.title === '打印次数')
        ?.formatter({ cellValue: 2 }),
    ).toBe(2);
    expect(
      columns
        .find((column) => column.title === '打印次数')
        ?.formatter({ cellValue: undefined }),
    ).toBe(0);
    const printTimeColumn = columns.find(
      (column) => column.title === '打印时间',
    );
    expect(printTimeColumn).toMatchObject({ field: 'printTime' });
    expect(printTimeColumn?.formatter({ cellValue: undefined })).toBe('-');
  });

  it('derives stock-check balance type from list totals', () => {
    expect(getStockCheckBalanceType({ totalCount: 1, totalPrice: 10 })).toBe(
      '盘盈',
    );
    expect(getStockCheckBalanceType({ totalCount: -1, totalPrice: -10 })).toBe(
      '盘亏',
    );
    expect(getStockCheckBalanceType({ totalCount: 0, totalPrice: 10 })).toBe(
      '成本调整',
    );
    expect(getStockCheckBalanceType({ totalCount: 0, totalPrice: 0 })).toBe(
      '无差异',
    );
  });

  it('formats stock-check query summary counts without meaningless trailing zeros', () => {
    expect(formatStockCheckSummaryCount(1)).toBe('1.00');
    expect(formatStockCheckSummaryCount(1.25)).toBe('1.25');
    expect(formatStockCheckSummaryCount(0)).toBe('0.00');
    expect(formatStockCheckSummaryCount(-2.5)).toBe('-2.50');
    expect(formatStockCheckSummaryCount(1234.5)).toBe('1234.50');
    expect(formatStockCheckSummaryCount(null)).toBe('****');
    expect(formatStockCheckSummaryCount(undefined)).toBe('****');
  });

  it('keeps stock-check query summary amounts at two decimal places', () => {
    expect(formatStockCheckSummaryAmount(20)).toBe('20.00');
    expect(formatStockCheckSummaryAmount(20.5)).toBe('20.50');
    expect(formatStockCheckSummaryAmount(20.567)).toBe('20.57');
    expect(formatStockCheckSummaryAmount(0)).toBe('0.00');
    expect(formatStockCheckSummaryAmount(null)).toBe('****');
    expect(formatStockCheckSummaryAmount(undefined)).toBe('****');
  });

  it('formats editable stock-check counts without blocking decimal typing', () => {
    expect(formatStockCheckCountInput('-11904.000')).toBe('-11904');
    expect(formatStockCheckCountInput('-9510.125')).toBe('-9510.125');
    expect(formatStockCheckCountInput('0.000')).toBe('0');
    expect(
      formatStockCheckCountInput(1, { input: '1.', userTyping: true }),
    ).toBe('1.');
    expect(
      formatStockCheckCountInput(1.2, {
        input: '1.20',
        userTyping: true,
      }),
    ).toBe('1.20');
    expect(formatStockCheckCountInput(null)).toBe('');
    expect(itemSource.match(/inputmode="decimal"/g)).toHaveLength(4);
  });

  it('styles all teleported search options at the compact scale', () => {
    const selectSchemas = useGridFormSchema().filter((schema) =>
      ['ApiSelect', 'Select'].includes(schema.component as string),
    );

    expect(selectSchemas.length).toBeGreaterThan(0);
    selectSchemas.forEach((schema) => {
      expect(schema.componentProps).toMatchObject({
        popupClassName:
          'stock-search-select-dropdown erp-candidate-focus-popup',
      });
    });
  });

  it('communicates product keyword search supports unit tokens', () => {
    const productKeywordSchema = useGridFormSchema().find(
      (schema) => schema.fieldName === 'productKeyword',
    );

    expect(productKeywordSchema?.componentProps).toMatchObject({
      placeholder: '请输入配件编码、名称、单位等，多个条件可用 / 或空格分隔',
    });
  });

  it('lazy-loads item warehouse selects and filters unresolved labels', () => {
    expect(itemSource).toContain('<ErpLazyPageSelect');
    expect(itemSource).toContain('getCurrentWarehouseOption(row)');
    expect(itemSource).toContain('hydrateMissingWarehouseNamesFromApi');
    expect(itemSource).toContain('mergeResolvedStockDocumentOptions');
    expect(itemSource).not.toContain('await getWarehouseSimpleList()');
  });

  it('sorts business item columns but not sequence or operations', () => {
    const columns = useFormItemColumns(false, 1) as any[];
    const businessColumns = columns.filter(
      (column) => column.field && column.title !== '操作',
    );

    expect(businessColumns.length).toBeGreaterThan(0);
    businessColumns.forEach((column) => expect(column.sortable).toBe(true));
    expect(columns.find((column) => column.type === 'seq')?.sortable).not.toBe(
      true,
    );
    expect(
      columns.find((column) => column.title === '操作')?.sortable,
    ).not.toBe(true);
  });

  it('keeps remark last and enables the adaptive trailing item column', () => {
    const columns = useFormItemColumns(false, 1) as any[];
    const businessTitles = columns
      .filter((column) => column.field && column.title !== '操作')
      .map((column) => column.title);

    expect(businessTitles.slice(-2)).toEqual(['金额', '备注']);
    expect(columns.find((column) => column.field === 'remark')).toMatchObject({
      minWidth: 150,
    });
    expect(itemSource).toContain('trailingFlexibleColumnMinWidth: 150');
    expect(itemSource).toContain("id: 'erp-stock-check-item-list-v2'");
    expect(itemSource).not.toContain("id: 'erp-stock-check-item-list-v1'");
    expect(itemSource).not.toContain('fit: true');
    expect(itemSource).toContain('fit: false');
    expect(itemSource).toContain('useStockCheckColumns');
  });

  it('shows the list delete action without a leading icon', () => {
    const deleteActionStart = indexSource.indexOf(
      '<template #deleteAction="{ row }">',
    );
    const deleteActionEnd = indexSource.indexOf(
      '</template>',
      deleteActionStart,
    );
    const deleteActionSource = indexSource.slice(
      deleteActionStart,
      deleteActionEnd,
    );

    expect(deleteActionStart).toBeGreaterThan(-1);
    expect(deleteActionSource).toContain("label: '删除'");
    expect(deleteActionSource).not.toContain('icon: ACTION_ICON.DELETE');
    expect(deleteActionSource).toContain("auth: ['erp:stock-check:delete']");
    expect(deleteActionSource).toContain('popConfirm:');
  });

  it('allows selecting approved rows for export and skips unavailable batch deletes', () => {
    expect(
      isStockCheckRowDeletable({ status: STOCK_CHECK_APPROVED_STATUS }),
    ).toBe(false);
    expect(isStockCheckRowDeletable({ status: 10 })).toBe(true);
    expect(indexSource).toContain('ifShow: () => batchDeleteAllowed');
    expect(indexSource).toContain(
      'const batchDeleteAllowed = computed(() => checkedRows.value.length > 0);',
    );
    expect(indexSource).toContain(
      'rows.length > 0 ? rows.filter(isStockCheckRowDeletable) : []',
    );
    expect(indexSource).toContain('await deleteStockCheck(targetIds)');
    expect(indexSource).toContain('当前勾选数据没有可删除项');
    expect(indexSource).toContain('不可删除数据将自动跳过');
    expect(indexSource).toContain('已删除');
    expect(indexSource).toContain('targetIds.length');
    expect(indexSource).toContain('已跳过');
    expect(indexSource).toContain('skippedCount');
    expect(indexSource).not.toContain('checkMethod:');
    expect(indexSource).toContain('selectedIds.length > 0');
    expect(indexSource).toContain("ids: selectedIds.join(',')");
    expect(indexSource).toContain('@keydown.enter.capture="handleSearchEnter"');
    expect(indexSource).toContain('handlePrint(row)');
    expect(indexSource).toContain('useErpPrintTemplate');
    expect(indexSource).toContain('PrintTemplateDesignModal');
    expect(indexSource).toContain('PrintTemplateSelector');
    expect(indexSource).toContain(
      "const PRINT_TEMPLATE_MODULE = 'stock_check'",
    );
    expect(indexSource).toContain("auth: ['erp:stock-check:print-template']");
    expect(indexSource).toContain('handleOpenPrintTemplateDesigner');
    expect(indexSource).toContain(
      'v-access:code="[\'erp:stock-check:print\']"',
    );
    expect(indexSource).toContain('打印({{ row.printCount ?? 0 }})');
    expect(indexSource).not.toContain('打印模板暂未接入');
    expect(indexSource).toContain('formatApprovedTime(row)');
  });

  it('keeps detail item hydration and stale-request exits intact', () => {
    expect(formSource).toContain('hydrateStockDocumentFormSelectLabels');
    expect(formSource).toContain('await getStockCheck(data.id,');
    expect(formSource).toContain(
      "includeItems: !['detail', 'edit'].includes(data.type)",
    );
    expect(formSource).toContain('await loadStockCheckItemPage({ pageNo: 1 })');
    expect(formSource).toContain('buildStockDocumentDetailFormValues');
    expect(formSource).toContain(':items="formData?.items ?? EMPTY_ITEMS"');
    expect(formSource).toContain('sequence !== detailLoadSequence');
    expect(formSource).toContain('detailLoading.value = false');
  });

  it('keeps stock-check detail rows visible after column recalculation', () => {
    const itemsSyncIndex = itemSource.indexOf(
      'async function syncItemsFromProps',
    );
    expect(itemsSyncIndex).toBeGreaterThan(-1);
    expect(itemSource).toContain('await syncItemsFromProps(items)');
    expect(itemSource).toContain('options.force');
    expect(itemSource).toContain('reloadItemsFromProps');
    expect(
      itemSource.indexOf(
        'await gridApi.grid.reloadColumn(buildItemColumns());',
        itemsSyncIndex,
      ),
    ).toBeLessThan(
      itemSource.indexOf('await refreshItemGrid();', itemsSyncIndex),
    );

    const modeWatchIndex = itemSource.indexOf(
      '() => [props.disabled, props.enableBatchEdit, props.checkId]',
    );
    expect(modeWatchIndex).toBeGreaterThan(-1);
    expect(
      itemSource.indexOf(
        'await gridApi.grid.reloadColumn(buildItemColumns());',
        modeWatchIndex,
      ),
    ).toBeLessThan(
      itemSource.indexOf('await refreshItemGrid();', modeWatchIndex),
    );
  });

  it('implements the stock-check draft action matrix', () => {
    expect(formSource).toContain('async onBeforeClose()');
    expect(formSource).toContain('return saveStockCheckDraft()');
    expect(formSource).toContain('async onCancel()');
    expect(formSource).toContain('skipDraftOnClose = true');
    expect(formSource).toContain('createStockCheckDraft(');
    expect(formSource).toContain('updateStockCheckDraft(');
    expect(formSource).toContain('hasValidStockCheckDraftItems');
    expect(formSource).toContain('未选择明细，不生成草稿');
    expect(formSource).toContain('async function handleGenerateDraft()');
    expect(formSource).toContain(
      "() => formType.value === 'create' || isEditingDraft.value",
    );
    expect(formSource).toContain(
      "isEditingDraft.value ? '保存草稿' : '生成草稿'",
    );
    expect(formSource).toContain('草稿生成成功');
    expect(formSource).toContain('草稿保存成功');
    expect(formSource).toContain('生成草稿');
    expect(formSource).toContain('保存草稿');
    expect(centerFooterSource).toContain('v-if="canGenerateDraft"');
    expect(centerFooterSource).toContain('handleGenerateDraft');
    expect(centerFooterSource).toContain('generateDraftButtonText');
    expect(prependFooterSource).not.toContain('handleGenerateDraft');
    expect(prependFooterSource).not.toContain('canGenerateDraft');
    expect(formSource).toContain('updateAndSubmitStockCheckDraft(');
    expect(formSource).toContain('submitStockCheck(id)');
    expect(formSource).toContain('formData.value?.status ===');
    expect(formSource).toContain('ErpStockCheckApi.STATUS_DRAFT');
    const closeIndex = formSource.indexOf('async function saveStockCheckDraft');
    expect(
      formSource.indexOf('hasValidStockCheckDraftItems', closeIndex),
    ).toBeLessThan(
      formSource.indexOf('createStockCheckDraft(', closeIndex),
    );
  });

  it('communicates draft state and keeps approval limited to submitted rows', () => {
    expect(indexSource).toContain('stock-check-draft-row');
    expect(indexSource).toContain('未正式提交');
    expect(indexSource).toContain('浅蓝色行表示未正式提交的草稿');
    expect(indexSource).toContain('ifShow: () => row.status === 10');
  });
});
