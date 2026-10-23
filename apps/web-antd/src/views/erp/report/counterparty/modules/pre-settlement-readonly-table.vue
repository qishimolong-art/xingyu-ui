<script setup lang="ts">
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { computed, ref } from 'vue';

import { erpPriceInputFormatter } from '@vben/utils';

import { Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getPrePaymentPage } from '#/api/erp/finance/accounting/pre-payment';
import { getPreReceiptPage } from '#/api/erp/finance/accounting/pre-receipt';
import { getPreReceivablePage } from '#/api/erp/finance/accounting/pre-receivable';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import {
  useGridColumns as usePrePaymentColumns,
  useGridFormSchema as usePrePaymentFormSchema,
} from '../../../accounting/pre-payment/data';
import {
  useGridColumns as usePreReceiptColumns,
  useGridFormSchema as usePreReceiptFormSchema,
} from '../../../accounting/pre-receipt/data';
import {
  useGridColumns as usePreReceivableColumns,
  useGridFormSchema as usePreReceivableFormSchema,
} from '../../../accounting/pre-receivable/data';

type ReportType = 'prePayment' | 'preReceipt' | 'preReceivable';
type ReadonlyPageParam = Record<string, any> & {
  pageNo: number;
  pageSize: number;
};

const props = defineProps<{
  reportType: ReportType;
}>();

const pageRows = ref<any[]>([]);

const sortFieldMap: Record<string, string> = {
  actualAmount: 'actualAmount',
  bizTime: 'bizTime',
  createTime: 'createTime',
  discountAmount: 'discountAmount',
  no: 'no',
  partyName: 'partyName',
  partyType: 'partyType',
  status: 'status',
  totalAmount: 'totalAmount',
};

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(sortFieldMap);

const tableTitle = computed(() => {
  if (props.reportType === 'preReceipt') return '预收款只读参考';
  if (props.reportType === 'preReceivable') return '预收账款只读参考';
  return '预付款只读参考';
});

const gridId = computed(() => {
  if (props.reportType === 'preReceipt') {
    return 'erp-business-report-pre-receipt-readonly-list-v1';
  }
  if (props.reportType === 'preReceivable') {
    return 'erp-business-report-pre-receivable-readonly-list-v1';
  }
  return 'erp-business-report-pre-payment-readonly-list-v1';
});

const helpText = computed(() => {
  if (props.reportType === 'preReceipt') {
    return '只读复用预收款分页，展示客户、供应商或员工预收业务；不提供新增、修改、审核、反审、删除或详情维护动作；本页为参考合计，预收预付独立列示，不并入销售应收/采购应付正式余额，历史截止余额和账龄待新核算台账。';
  }
  if (props.reportType === 'preReceivable') {
    return '只读复用预收账款分页，展示独立预收账款业务；不提供新增、修改、审核、反审、删除或详情维护动作；本页为参考合计，预收预付独立列示，不并入销售应收/采购应付正式余额，历史截止余额和账龄待新核算台账。';
  }
  return '只读复用预付款分页，展示客户、供应商或员工预付业务；不提供新增、修改、审核、反审、删除或详情维护动作；本页为参考合计，预收预付独立列示，不并入销售应收/采购应付正式余额，历史截止余额和账龄待新核算台账。';
});

const pageSummary = computed(() => {
  let totalAmount = 0;
  let discountAmount = 0;
  let actualAmount = 0;
  for (const row of pageRows.value) {
    totalAmount += Number(row.totalAmount || 0);
    discountAmount += Number(row.discountAmount || 0);
    actualAmount += Number(row.actualAmount || 0);
  }
  return {
    actualAmount,
    count: pageRows.value.length,
    discountAmount,
    totalAmount,
  };
});

function readonlyColumns(columns: NonNullable<VxeTableGridOptions['columns']>) {
  const readonly = columns
    .filter((column: any) => column.type !== 'checkbox')
    .filter(
      (column: any) => column.field !== 'actions' && column.title !== '操作',
    )
    .map((column: any) => {
      const nextColumn = { ...column };
      if (!['fileUrl', 'partyType', 'status'].includes(nextColumn.field)) {
        delete nextColumn.slots;
      }
      if (nextColumn.fixed === 'right') delete nextColumn.fixed;
      return nextColumn;
    });
  const actualAmountIndex = readonly.findIndex(
    (column: any) => column.field === 'actualAmount',
  );
  readonly.splice(
    actualAmountIndex === -1 ? readonly.length : actualAmountIndex + 1,
    0,
    {
      field: 'remark',
      title: '备注',
      minWidth: 180,
      showOverflow: 'tooltip' as const,
    },
    {
      field: 'fileUrl',
      title: '附件',
      minWidth: 80,
      slots: { default: 'fileUrl' },
    },
  );
  return readonly;
}

function useCurrentFormSchema() {
  if (props.reportType === 'preReceipt') return usePreReceiptFormSchema();
  if (props.reportType === 'preReceivable') return usePreReceivableFormSchema();
  return usePrePaymentFormSchema();
}

function useCurrentColumns() {
  if (props.reportType === 'preReceipt') {
    return readonlyColumns(usePreReceiptColumns() || []);
  }
  if (props.reportType === 'preReceivable') {
    return readonlyColumns(usePreReceivableColumns() || []);
  }
  return readonlyColumns(usePrePaymentColumns() || []);
}

function getStatusLabel(status?: number) {
  if (status === 10) return '未审核';
  if (status === 20) return '已审核';
  if (status === 30) return '已反审';
  return '未知';
}

function getStatusColor(status?: number) {
  if (status === 10) return 'orange';
  if (status === 20) return 'green';
  if (status === 30) return 'blue';
  return 'default';
}

function getPartyTypeLabel(partyType?: number) {
  if (partyType === 1) return '客户';
  if (partyType === 2) return '供应商';
  if (partyType === 3) return '员工';
  return '未知';
}

async function queryPage(params: ReadonlyPageParam) {
  let result;
  if (props.reportType === 'preReceipt') {
    result = await getPreReceiptPage(params);
  } else if (props.reportType === 'preReceivable') {
    result = await getPreReceivablePage(params);
  } else {
    result = await getPrePaymentPage(params);
  }
  pageRows.value = result.list || [];
  return result;
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

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 76 },
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
    toolbarConfig: { refresh: true, search: true, custom: true },
  } as VxeTableGridOptions<any>,
  gridEvents: { sortChange: handleSortChange },
});
</script>

<template>
  <div class="pre-settlement-readonly-table">
    <Grid
      class="pre-settlement-readonly-table__grid"
      :table-title="tableTitle"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #status="{ row }">
        <Tag :color="getStatusColor(row.status)">
          {{ getStatusLabel(row.status) }}
        </Tag>
      </template>
      <template #partyType="{ row }">
        {{ getPartyTypeLabel(row.partyType) }}
      </template>
      <template #fileUrl="{ row }">
        <a
          v-if="row.fileUrl"
          :href="row.fileUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          查看
        </a>
        <span v-else>-</span>
      </template>
      <template #bottom>
        <div class="pre-settlement-readonly-table__summary">
          <b>本页参考合计：</b>
          <span
            >单据数：<b>{{ pageSummary.count }}</b></span
          >
          <span>
            合计金额：<b>{{
              erpPriceInputFormatter(pageSummary.totalAmount)
            }}</b>
          </span>
          <span>
            折让金额：<b>{{
              erpPriceInputFormatter(pageSummary.discountAmount)
            }}</b>
          </span>
          <span>
            实际金额：<b>{{
              erpPriceInputFormatter(pageSummary.actualAmount)
            }}</b>
          </span>
        </div>
      </template>
    </Grid>
    <p class="pre-settlement-readonly-table__hint">{{ helpText }}</p>
  </div>
</template>

<style scoped>
.pre-settlement-readonly-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.pre-settlement-readonly-table__grid {
  flex: 1 1 auto;
  min-height: 0;
}

.pre-settlement-readonly-table__summary {
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

.pre-settlement-readonly-table__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.pre-settlement-readonly-table__hint {
  flex: 0 0 auto;
  margin: 6px 0 0;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

:deep(.pre-settlement-readonly-table__grid .vxe-table--render-default),
:deep(.pre-settlement-readonly-table__grid .vxe-grid--form-wrapper),
:deep(.pre-settlement-readonly-table__grid .vxe-toolbar) {
  font-size: 12px;
}

:deep(
  .pre-settlement-readonly-table__grid .vxe-grid--form-wrapper form > .grid
) {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

:deep(
  .pre-settlement-readonly-table__grid .vxe-grid--form-wrapper .ant-form-item
) {
  margin-bottom: 8px;
}

:deep(.pre-settlement-readonly-table__grid .vxe-grid--form-wrapper label),
:deep(.pre-settlement-readonly-table__grid .vxe-grid--form-wrapper .ant-input),
:deep(.pre-settlement-readonly-table__grid .vxe-grid--form-wrapper .ant-picker),
:deep(
  .pre-settlement-readonly-table__grid
    .vxe-grid--form-wrapper
    .ant-picker-input
    > input
),
:deep(.pre-settlement-readonly-table__grid .vxe-grid--form-wrapper .ant-select),
:deep(.pre-settlement-readonly-table__grid .vxe-grid--form-wrapper .ant-btn) {
  font-size: 12px;
}

:deep(
  .pre-settlement-readonly-table__grid
    .vxe-grid--form-wrapper
    .ant-input-affix-wrapper
),
:deep(.pre-settlement-readonly-table__grid .vxe-grid--form-wrapper .ant-picker),
:deep(
  .pre-settlement-readonly-table__grid
    .vxe-grid--form-wrapper
    .ant-select-single
) {
  min-height: 28px;
  font-size: 12px;
}

:deep(
  .pre-settlement-readonly-table__grid
    .vxe-grid--form-wrapper
    .ant-input-affix-wrapper
),
:deep(
  .pre-settlement-readonly-table__grid .vxe-grid--form-wrapper .ant-picker
) {
  padding: 2px 8px;
}

:deep(
  .pre-settlement-readonly-table__grid
    .vxe-grid--form-wrapper
    .ant-select-single
),
:deep(
  .pre-settlement-readonly-table__grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
}

:deep(.pre-settlement-readonly-table__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

@media (max-width: 1280px) {
  :deep(
    .pre-settlement-readonly-table__grid .vxe-grid--form-wrapper form > .grid
  ) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
