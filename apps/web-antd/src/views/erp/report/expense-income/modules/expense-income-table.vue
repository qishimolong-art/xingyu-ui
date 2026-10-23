<script lang="ts" setup>
import {
  financeValue,
  financeAdd,
} from '#/views/erp/finance/utils/finance-decimal';

import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { computed, ref } from 'vue';

import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportPayableExpense,
  getPayableExpensePage,
} from '#/api/erp/finance/payable/expense';
import {
  exportOtherIncome,
  getOtherIncomePage,
} from '#/api/erp/finance/receivable/other-income';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import {
  useGridColumns as usePayableExpenseColumns,
  useGridFormSchema as usePayableExpenseFormSchema,
} from '../../../finance/payable/expense/data';
import { normalizePayableExpenseListRow } from '../../../finance/payable/expense/ui';
import {
  useGridColumns as useOtherIncomeColumns,
  useGridFormSchema as useOtherIncomeFormSchema,
} from '../../../finance/receivable/other-income/data';
import { normalizeOtherIncomeListRow } from '../../../finance/receivable/other-income/ui';

const props = withDefaults(
  defineProps<{
    compact?: boolean;
    reportType: 'expense' | 'income';
    title?: string;
  }>(),
  {
    compact: false,
    title: undefined,
  },
);

const expenseSortFieldMap: Record<string, string> = {
  no: 'no',
  bizTime: 'bizTime',
  totalAmount: 'totalAmount',
  accountName: 'accountId',
  settleMethod: 'settleMethod',
  voucherNo: 'voucherNo',
  docType: 'docType',
  status: 'status',
  handlerName: 'handlerId',
  auditTime: 'auditTime',
  creatorName: 'creator',
  deptName: 'deptId',
  auditorName: 'auditorName',
};

const pageRows = ref<any[]>([]);
const exportLoading = ref(false);

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(expenseSortFieldMap);

const pageSummary = computed(() => ({
  documentCount: pageRows.value.length,
  totalAmount: pageRows.value.reduce(
    (sum, row) => financeAdd(sum, financeValue(row.totalAmount || 0)),
    '0',
  ),
}));

const tableTitle = computed(
  () =>
    props.title ||
    (props.reportType === 'expense' ? '费用支付明细' : '其他经营收支明细'),
);

const gridId = computed(() =>
  props.reportType === 'expense'
    ? 'erp-business-report-payable-expense-list-v1'
    : 'erp-business-report-other-income-list-v1',
);

function readonlyColumns(columns: NonNullable<VxeTableGridOptions['columns']>) {
  return columns
    .filter((column: any) => column.type !== 'checkbox')
    .filter(
      (column: any) =>
        !['actions', 'deleteAction', 'printAction'].includes(column.field),
    )
    .map((column: any) => {
      const nextColumn = { ...column };
      if (nextColumn.field !== 'status') {
        delete nextColumn.slots;
      }
      if (nextColumn.fixed === 'right') delete nextColumn.fixed;
      return nextColumn;
    });
}

function appendReportReadonlyColumns(
  columns: NonNullable<VxeTableGridOptions['columns']>,
) {
  const existingFields = new Set(columns.map((column: any) => column.field));
  const reportColumns = [
    { field: 'settleMethod', title: '结算方式', width: 110 },
    { field: 'voucherNo', title: '凭证号', width: 132 },
    { field: 'docType', title: '单据类型', width: 110 },
  ].filter((column) => !existingFields.has(column.field));
  if (reportColumns.length === 0) return columns;

  const accountIndex = columns.findIndex(
    (column: any) => column.field === 'accountName',
  );
  if (accountIndex === -1) return [...columns, ...reportColumns];

  return [
    ...columns.slice(0, accountIndex + 1),
    ...reportColumns,
    ...columns.slice(accountIndex + 1),
  ];
}

function useCurrentFormSchema() {
  return props.reportType === 'expense'
    ? usePayableExpenseFormSchema()
    : useOtherIncomeFormSchema();
}

function useCurrentColumns() {
  return appendReportReadonlyColumns(
    readonlyColumns(
      (props.reportType === 'expense'
        ? usePayableExpenseColumns()
        : useOtherIncomeColumns()) || [],
    ),
  );
}

function statusTag(status: unknown) {
  if (Number(status) === 0) return { color: 'warning', label: '草稿' };
  if (Number(status) === 10) return { color: 'processing', label: '待审核' };
  if (Number(status) === 20) return { color: 'success', label: '已审核' };
  return { color: 'default', label: '状态未知' };
}

async function queryPage(params: Record<string, any>) {
  if (props.reportType === 'expense') {
    const result = await getPayableExpensePage(params);
    pageRows.value = (result.list || []).map((row) =>
      normalizePayableExpenseListRow(row),
    );
    return { ...result, list: pageRows.value };
  }
  const result = await getOtherIncomePage(params);
  pageRows.value = (result.list || []).map((row) =>
    normalizeOtherIncomeListRow(row),
  );
  return { ...result, list: pageRows.value };
}

function handleSearchEnter(event: KeyboardEvent) {
  if (event.isComposing) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.closest('.ant-picker, .ant-select')) return;
  event.preventDefault();
  event.stopPropagation();
  void gridApi.formApi.submitForm();
}

async function handleExport() {
  exportLoading.value = true;
  try {
    const formValues = (await gridApi.formApi?.getValues?.()) ?? {};
    const params = { ...formValues, ...buildSortParams() };
    const data =
      props.reportType === 'expense'
        ? await exportPayableExpense(params)
        : await exportOtherIncome(params);
    downloadFileFromBlobPart({
      fileName: `${tableTitle.value}.xls`,
      source: data,
    });
  } catch (error) {
    console.error(error);
    message.error('导出失败，请稍后重试');
  } finally {
    exportLoading.value = false;
  }
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 80 },
    schema: useCurrentFormSchema(),
    collapsed: true,
    collapsedRows: 1,
  },
  gridOptions: {
    columns: useCurrentColumns(),
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    height: 'auto',
    id: gridId.value,
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 8 },
    scrollY: { enabled: true, gt: 10 },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) =>
          queryPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            ...buildSortParams(sorts, sort),
          }),
        querySuccess: () => void restoreSortState(gridApi),
      },
      sort: true,
    },
    sortConfig: {
      remote: true,
      multiple: false,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
      allowBtn: false,
    },
    rowConfig: { keyField: 'id', isHover: true, isCurrent: true },
    pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] },
    toolbarConfig: { refresh: true, search: true, custom: true },
  } as VxeTableGridOptions<any>,
  gridEvents: { sortChange: handleSortChange },
});
</script>

<template>
  <div
    class="expense-income-report-table"
    :class="{ 'expense-income-report-table--compact': props.compact }"
  >
    <Grid
      class="expense-income-report-table__grid"
      :table-title="tableTitle"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #toolbar-tools>
        <Button size="small" :loading="exportLoading" @click="handleExport"
          >导出</Button
        >
      </template>
      <template #status="{ row }">
        <Tag :color="statusTag(row.status).color">
          {{ statusTag(row.status).label }}
        </Tag>
      </template>
      <template #bottom>
        <div class="expense-income-report-table__summary">
          <b>本页合计：</b>
          <span
            >单据数：<b>{{ pageSummary.documentCount }}</b></span
          >
          <span>
            金额：<b>{{ erpPriceInputFormatter(pageSummary.totalAmount) }}</b>
          </span>
        </div>
      </template>
    </Grid>
  </div>
</template>

<style scoped>
.expense-income-report-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.expense-income-report-table__grid {
  flex: 1 1 auto;
  min-height: 0;
}

.expense-income-report-table__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  align-items: center;
  justify-content: flex-end;
  min-height: 40px;
  padding: 5px 8px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 18px;
  border-top: 1px solid hsl(var(--border));
}

.expense-income-report-table__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

:deep(.expense-income-report-table__grid .vxe-table--render-default),
:deep(.expense-income-report-table__grid .vxe-grid--form-wrapper),
:deep(.expense-income-report-table__grid .vxe-toolbar) {
  font-size: 12px;
}

:deep(.expense-income-report-table__grid .vxe-grid--form-wrapper form > .grid) {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

:deep(
  .expense-income-report-table__grid .vxe-grid--form-wrapper .ant-form-item
) {
  margin-bottom: 8px;
}

:deep(.expense-income-report-table__grid .vxe-grid--form-wrapper label),
:deep(.expense-income-report-table__grid .vxe-grid--form-wrapper .ant-input),
:deep(.expense-income-report-table__grid .vxe-grid--form-wrapper .ant-picker),
:deep(.expense-income-report-table__grid .vxe-grid--form-wrapper .ant-select),
:deep(.expense-income-report-table__grid .vxe-grid--form-wrapper .ant-btn) {
  font-size: 12px;
}

:deep(
  .expense-income-report-table__grid
    .vxe-grid--form-wrapper
    .ant-input-affix-wrapper
),
:deep(.expense-income-report-table__grid .vxe-grid--form-wrapper .ant-picker) {
  min-height: 28px;
  padding: 2px 8px;
}

:deep(
  .expense-income-report-table__grid .vxe-grid--form-wrapper .ant-select-single
),
:deep(.expense-income-report-table__grid .vxe-grid--form-wrapper .ant-picker),
:deep(
  .expense-income-report-table__grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
  min-height: 28px;
}

:deep(.expense-income-report-table__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

@media (max-width: 1280px) {
  :deep(
    .expense-income-report-table__grid .vxe-grid--form-wrapper form > .grid
  ) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
