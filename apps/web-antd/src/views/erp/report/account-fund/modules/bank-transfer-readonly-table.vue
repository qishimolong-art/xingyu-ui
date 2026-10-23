<script lang="ts" setup>
import {
  financeValue,
  financeAdd,
} from '#/views/erp/finance/utils/finance-decimal';

import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpFinanceTransferApi } from '#/api/erp/finance/transfer';

import { computed, ref } from 'vue';

import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportFinanceTransfer,
  getFinanceTransferPage,
} from '#/api/erp/finance/transfer';

import { useGridFormSchema } from '../../../finance/cash-bank/transfer/data';

const props = withDefaults(defineProps<{ title?: string }>(), {
  title: '银行转账记录',
});

const pageRows = ref<ErpFinanceTransferApi.FinanceTransfer[]>([]);
const exportLoading = ref(false);

const bankTransferColumns: VxeTableGridOptions<ErpFinanceTransferApi.FinanceTransfer>['columns'] =
  [
    { type: 'seq', title: '序号', width: 54 },
    {
      field: 'no',
      title: '转账单号',
      width: 140,
      showOverflow: 'tooltip',
    },
    {
      field: 'transferTime',
      title: '转账时间',
      width: 150,
      formatter: 'formatDateTime',
    },
    {
      field: 'outAccountName',
      title: '转出账户',
      minWidth: 140,
      showOverflow: 'tooltip',
    },
    {
      field: 'inAccountName',
      title: '转入账户',
      minWidth: 140,
      showOverflow: 'tooltip',
    },
    {
      field: 'transferPrice',
      title: '转账金额',
      width: 112,
      align: 'right',
      headerAlign: 'right',
      formatter: 'formatAmount2',
    },
    {
      field: 'exchangeRate',
      title: '汇率',
      width: 84,
      align: 'right',
      headerAlign: 'right',
    },
    {
      field: 'feePrice',
      title: '手续费',
      width: 96,
      align: 'right',
      headerAlign: 'right',
      formatter: 'formatAmount2',
    },
    {
      field: 'feeExpenseCategory',
      title: '手续费项目',
      width: 124,
      showOverflow: 'tooltip',
    },
    {
      field: 'status',
      title: '状态',
      width: 84,
      slots: { default: 'status' },
    },
    {
      field: 'deptName',
      title: '所属部门',
      width: 120,
      showOverflow: 'tooltip',
    },
    {
      field: 'financeUserName',
      title: '经手人',
      width: 96,
      showOverflow: 'tooltip',
    },
    {
      field: 'auditorName',
      title: '审核人',
      width: 96,
      showOverflow: 'tooltip',
    },
    {
      field: 'auditTime',
      title: '审核时间',
      width: 150,
      formatter: 'formatDateTime',
    },
    {
      field: 'voucherNo',
      title: '凭证号',
      width: 120,
      showOverflow: 'tooltip',
    },
    {
      field: 'remark',
      title: '备注',
      minWidth: 160,
      showOverflow: 'tooltip',
    },
  ];

const pageSummary = computed(() => ({
  count: pageRows.value.length,
  transferPrice: pageRows.value.reduce(
    (sum, row) => financeAdd(sum, financeValue(row.transferPrice || 0)),
    '0',
  ),
  feePrice: pageRows.value.reduce(
    (sum, row) => financeAdd(sum, financeValue(row.feePrice || 0)),
    '0',
  ),
}));

function getStatusLabel(status?: number) {
  if (status === 0) return '草稿';
  if (status === 10) return '待审核';
  if (status === 20) return '已审核';
  return '未知';
}

function getStatusColor(status?: number) {
  if (status === 0) return 'blue';
  if (status === 10) return 'orange';
  if (status === 20) return 'green';
  return 'default';
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
    commonConfig: { labelWidth: 72 },
    schema: useGridFormSchema(),
    collapsed: true,
    collapsedRows: 1,
  },
  gridOptions: {
    columns: bankTransferColumns,
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        visible: true,
      },
    },
    height: 'auto',
    id: 'erp-business-report-bank-transfer-readonly-list-v1',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 8 },
    scrollY: { enabled: true, gt: 10 },
    pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const result = await getFinanceTransferPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          });
          pageRows.value = result.list || [];
          return result;
        },
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    toolbarConfig: { refresh: true, search: true, custom: true },
  } as VxeTableGridOptions<ErpFinanceTransferApi.FinanceTransfer>,
});

async function handleExport() {
  exportLoading.value = true;
  try {
    const formValues = await gridApi.formApi.getValues();
    const data = await exportFinanceTransfer(formValues);
    downloadFileFromBlobPart({ fileName: `${props.title}.xls`, source: data });
  } catch (error) {
    console.error(error);
    message.error('导出失败，请稍后重试');
  } finally {
    exportLoading.value = false;
  }
}
</script>

<template>
  <div class="bank-transfer-readonly-table">
    <Grid
      class="bank-transfer-readonly-table__grid"
      :table-title="props.title"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #toolbar-tools>
        <Button size="small" :loading="exportLoading" @click="handleExport"
          >导出</Button
        >
      </template>
      <template #status="{ row }">
        <Tag :color="getStatusColor(row.status)">
          {{ getStatusLabel(row.status) }}
        </Tag>
      </template>
      <template #bottom>
        <div class="bank-transfer-readonly-table__summary">
          <b>本页合计：</b>
          <span
            >记录数：<b>{{ pageSummary.count }}</b></span
          >
          <span>
            转账金额：<b>{{
              erpPriceInputFormatter(pageSummary.transferPrice)
            }}</b>
          </span>
          <span>
            手续费：<b>{{ erpPriceInputFormatter(pageSummary.feePrice) }}</b>
          </span>
        </div>
      </template>
    </Grid>
  </div>
</template>

<style scoped>
.bank-transfer-readonly-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.bank-transfer-readonly-table__grid {
  flex: 1 1 auto;
  min-height: 0;
}

.bank-transfer-readonly-table__summary {
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

.bank-transfer-readonly-table__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

:deep(.bank-transfer-readonly-table__grid .vxe-table--render-default),
:deep(.bank-transfer-readonly-table__grid .vxe-grid--form-wrapper),
:deep(.bank-transfer-readonly-table__grid .vxe-toolbar) {
  font-size: 12px;
}

:deep(
  .bank-transfer-readonly-table__grid .vxe-grid--form-wrapper form > .grid
) {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

:deep(
  .bank-transfer-readonly-table__grid .vxe-grid--form-wrapper .ant-form-item
) {
  margin-bottom: 8px;
}

:deep(.bank-transfer-readonly-table__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

@media (max-width: 1280px) {
  :deep(
    .bank-transfer-readonly-table__grid .vxe-grid--form-wrapper form > .grid
  ) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
