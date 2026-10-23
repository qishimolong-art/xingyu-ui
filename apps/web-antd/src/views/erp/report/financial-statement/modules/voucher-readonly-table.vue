<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpVoucherApi } from '#/api/erp/finance/accounting/voucher';

import { computed, ref } from 'vue';

import { downloadFileFromBlobPart, erpPriceInputFormatter } from '@vben/utils';

import { Button, message, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportFinancialVoucher,
  getFinancialVoucherPage,
} from '#/api/erp/report/financial-statement';

import { useGridFormSchema } from '../../../accounting/voucher/data';

const pageRows = ref<ErpVoucherApi.Voucher[]>([]);
const exportLoading = ref(false);

const voucherColumns: VxeTableGridOptions<ErpVoucherApi.Voucher>['columns'] = [
  { type: 'seq', title: '序号', width: 54 },
  {
    field: 'voucherWord',
    title: '凭证字',
    width: 90,
    showOverflow: 'tooltip',
  },
  {
    field: 'voucherNo',
    title: '凭证号',
    width: 130,
    showOverflow: 'tooltip',
  },
  {
    field: 'voucherDate',
    title: '凭证日期',
    width: 126,
    formatter: 'formatDate',
  },
  {
    field: 'period',
    title: '会计期间',
    width: 96,
    showOverflow: 'tooltip',
  },
  {
    field: 'summary',
    title: '摘要',
    minWidth: 180,
    showOverflow: 'tooltip',
  },
  {
    field: 'totalDebit',
    title: '借方合计',
    width: 112,
    align: 'right',
    headerAlign: 'right',
    formatter: 'formatAmount2',
  },
  {
    field: 'totalCredit',
    title: '贷方合计',
    width: 112,
    align: 'right',
    headerAlign: 'right',
    formatter: 'formatAmount2',
  },
  {
    field: 'attachmentCount',
    title: '附件数',
    width: 84,
    align: 'right',
    headerAlign: 'right',
  },
  {
    field: 'auditStatus',
    title: '审核状态',
    width: 92,
    slots: { default: 'auditStatus' },
  },
  {
    field: 'sourceBizType',
    title: '来源类型',
    width: 120,
    showOverflow: 'tooltip',
  },
  {
    field: 'sourceBizNo',
    title: '来源单号',
    width: 150,
    showOverflow: 'tooltip',
  },
  {
    field: 'sourceBizAmount',
    title: '来源金额',
    width: 112,
    align: 'right',
    headerAlign: 'right',
    formatter: 'formatAmount2',
  },
  {
    field: 'bizDocType',
    title: '业务单据类型',
    width: 130,
    showOverflow: 'tooltip',
  },
  {
    field: 'deptName',
    title: '辅助部门',
    width: 120,
    showOverflow: 'tooltip',
  },
  {
    field: 'customerName',
    title: '辅助客户',
    width: 130,
    showOverflow: 'tooltip',
  },
  {
    field: 'personUserName',
    title: '辅助人员',
    width: 110,
    showOverflow: 'tooltip',
  },
  {
    field: 'makerUserName',
    title: '制单人',
    width: 96,
    showOverflow: 'tooltip',
  },
  {
    field: 'bookkeeper',
    title: '记账人',
    width: 96,
    showOverflow: 'tooltip',
  },
  {
    field: 'cashier',
    title: '出纳',
    width: 90,
    showOverflow: 'tooltip',
  },
  {
    field: 'supervisor',
    title: '主管',
    width: 90,
    showOverflow: 'tooltip',
  },
  {
    field: 'auditorUserName',
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
    field: 'creatorName',
    title: '创建人',
    width: 96,
    showOverflow: 'tooltip',
  },
  {
    field: 'createTime',
    title: '创建时间',
    width: 150,
    formatter: 'formatDateTime',
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
  totalDebit: pageRows.value.reduce(
    (sum, row) => sum + Number(row.totalDebit || 0),
    0,
  ),
  totalCredit: pageRows.value.reduce(
    (sum, row) => sum + Number(row.totalCredit || 0),
    0,
  ),
}));

function getAuditStatusLabel(status?: number) {
  if (status === 10) return '未审核';
  if (status === 20) return '已审核';
  if (status === 30) return '已反审';
  return '未知';
}

function getAuditStatusColor(status?: number) {
  if (status === 10) return 'orange';
  if (status === 20) return 'green';
  if (status === 30) return 'blue';
  return 'default';
}

async function handleExport() {
  exportLoading.value = true;
  try {
    const formValues = (await gridApi.formApi?.getValues?.()) ?? {};
    const data = await exportFinancialVoucher(formValues);
    downloadFileFromBlobPart({ fileName: '凭证明细.xls', source: data });
  } catch (error) {
    console.error(error);
    message.error('导出失败，请稍后重试');
  } finally {
    exportLoading.value = false;
  }
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
    columns: voucherColumns,
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        visible: true,
      },
    },
    height: 'auto',
    id: 'erp-business-report-voucher-readonly-list-v1',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 8 },
    scrollY: { enabled: true, gt: 10 },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const result = await getFinancialVoucherPage({
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
    pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] },
    toolbarConfig: { refresh: true, search: true, custom: true },
  } as VxeTableGridOptions<ErpVoucherApi.Voucher>,
});
</script>

<template>
  <div class="voucher-readonly-table">
    <Grid
      class="voucher-readonly-table__grid"
      table-title="凭证明细"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #toolbar-tools>
        <Button size="small" :loading="exportLoading" @click="handleExport"
          >导出</Button
        >
      </template>
      <template #auditStatus="{ row }">
        <Tag :color="getAuditStatusColor(row.auditStatus)">
          {{ getAuditStatusLabel(row.auditStatus) }}
        </Tag>
      </template>
      <template #bottom>
        <div class="voucher-readonly-table__summary">
          <b>本页合计：</b>
          <span
            >记录数：<b>{{ pageSummary.count }}</b></span
          >
          <span>
            借方合计：<b>{{
              erpPriceInputFormatter(pageSummary.totalDebit)
            }}</b>
          </span>
          <span>
            贷方合计：<b>{{
              erpPriceInputFormatter(pageSummary.totalCredit)
            }}</b>
          </span>
        </div>
      </template>
    </Grid>
  </div>
</template>

<style scoped>
.voucher-readonly-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.voucher-readonly-table__grid {
  flex: 1 1 auto;
  min-height: 0;
}

.voucher-readonly-table__summary {
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

.voucher-readonly-table__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

:deep(.voucher-readonly-table__grid .vxe-table--render-default),
:deep(.voucher-readonly-table__grid .vxe-grid--form-wrapper),
:deep(.voucher-readonly-table__grid .vxe-toolbar) {
  font-size: 12px;
}

:deep(.voucher-readonly-table__grid .vxe-grid--form-wrapper form > .grid) {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

:deep(.voucher-readonly-table__grid .vxe-grid--form-wrapper .ant-form-item) {
  margin-bottom: 8px;
}

:deep(.voucher-readonly-table__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

@media (max-width: 1280px) {
  :deep(.voucher-readonly-table__grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
