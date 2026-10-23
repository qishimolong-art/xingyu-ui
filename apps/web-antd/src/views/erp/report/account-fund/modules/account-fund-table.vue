<script lang="ts" setup>
import {
  financeValue,
  financeAdd,
} from '#/views/erp/finance/utils/finance-decimal';

import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpAccountApi } from '#/api/erp/finance/account';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { exportAccount, getAccountPage } from '#/api/erp/finance/account';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import {
  ACCOUNT_SORT_FIELD_MAP,
  useGridFormSchema,
} from '../../../finance/cash-bank/account/data';
import TransactionDrawer from '../../../finance/cash-bank/account/modules/transaction-drawer.vue';

const props = defineProps<{
  title?: string;
}>();

const pageRows = ref<ErpAccountApi.Account[]>([]);
const exportLoading = ref(false);
const currentAccountId = ref<number>();

const [TransactionDrawerModal, transactionDrawerApi] = useVbenDrawer({
  title: '账户交易流水',
  footer: false,
  destroyOnClose: false,
});

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(ACCOUNT_SORT_FIELD_MAP);

function isDraftAccount(row: ErpAccountApi.Account) {
  return Number(row.documentStatus) === 0;
}

const accountFundColumns: VxeTableGridOptions<ErpAccountApi.Account>['columns'] =
  [
    { type: 'seq', title: '序号', width: 54 },
    { field: 'name', title: '账户名称', minWidth: 140, sortable: true },
    { field: 'no', title: '编码', width: 108, sortable: true },
    {
      field: 'accountType',
      title: '账户类型',
      width: 96,
      sortable: true,
      cellRender: { name: 'CellDict', props: { type: 'erp_account_type' } },
    },
    { field: 'bankName', title: '开户行', width: 132, sortable: true },
    { field: 'bankAccount', title: '银行账号', width: 148 },
    { field: 'deptName', title: '账户管理部门', width: 120 },
    {
      field: 'currentBalance',
      title: '账面余额',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      formatter: 'formatAmount2',
      sortable: false,
    },
    {
      field: 'status',
      title: '启用状态',
      width: 88,
      sortable: true,
      cellRender: { name: 'CellDict', props: { type: 'common_status' } },
    },
    {
      field: 'documentStatus',
      title: '提交状态',
      width: 88,
      sortable: true,
      slots: { default: 'documentStatus' },
    },
    {
      field: 'defaultStatus',
      title: '默认账户',
      width: 88,
      sortable: true,
      formatter: ({ cellValue }) => (cellValue ? '是' : '否'),
    },
    { field: 'sort', title: '排序', width: 72, align: 'right', sortable: true },
    { field: 'remark', title: '备注', minWidth: 160, showOverflow: 'tooltip' },
    {
      field: 'creatorName',
      title: '创建人',
      width: 88,
      showOverflow: 'tooltip',
    },
    {
      field: 'createTime',
      title: '创建时间',
      width: 148,
      formatter: 'formatDateTime',
      sortable: true,
    },
    {
      field: 'updaterName',
      title: '修改人',
      width: 88,
      showOverflow: 'tooltip',
    },
    {
      field: 'updateTime',
      title: '修改时间',
      width: 148,
      formatter: 'formatDateTime',
      sortable: true,
    },
    {
      field: 'actions',
      title: '操作',
      width: 90,
      fixed: 'right',
      slots: { default: 'actions' },
    },
  ];

const pageSummary = computed(() => ({
  accountCount: pageRows.value.length,
  currentBalance: pageRows.value.reduce(
    (sum, row) => financeAdd(sum, financeValue(row.currentBalance || 0)),
    '0',
  ),
}));

function handleOpenTransactions(row: ErpAccountApi.Account) {
  currentAccountId.value = row.id;
  transactionDrawerApi
    .setState({
      title: row.name ? `账户交易流水 - ${row.name}` : '账户交易流水',
    })
    .open();
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
    const formValues = await gridApi.formApi.getValues();
    const data = await exportAccount(formValues);
    downloadFileFromBlobPart({
      fileName: `${props.title || '账户余额及对账表'}.xls`,
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
    schema: useGridFormSchema(),
    collapsed: true,
    collapsedRows: 1,
  },
  gridOptions: {
    columns: accountFundColumns,
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    height: 'auto',
    id: 'erp-business-report-account-fund-list-v1',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 8 },
    scrollY: { enabled: true, gt: 10 },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const result = await getAccountPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            ...buildSortParams(sorts, sort),
          });
          pageRows.value = result.list || [];
          return result;
        },
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
  } as VxeTableGridOptions<ErpAccountApi.Account>,
  gridEvents: { sortChange: handleSortChange },
});
</script>

<template>
  <div class="account-fund-report-table">
    <TransactionDrawerModal class="w-[75vw]">
      <TransactionDrawer :account-id="currentAccountId" />
    </TransactionDrawerModal>
    <Grid
      class="account-fund-report-table__grid"
      :table-title="props.title || '账户资金余额'"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #toolbar-tools>
        <Button size="small" :loading="exportLoading" @click="handleExport"
          >导出</Button
        >
      </template>
      <template #documentStatus="{ row }">
        <Tag :color="isDraftAccount(row) ? 'blue' : 'green'" class="m-0">
          {{ isDraftAccount(row) ? '草稿' : '正式' }}
        </Tag>
      </template>
      <template #actions="{ row }">
        <Button
          type="link"
          size="small"
          @click.stop="handleOpenTransactions(row)"
        >
          流水
        </Button>
      </template>
      <template #bottom>
        <div class="account-fund-report-table__summary">
          <b>本页合计：</b>
          <span>仅统计当前分页数据，不代表全量资金余额。</span>
          <span
            >账户数：<b>{{ pageSummary.accountCount }}</b></span
          >
          <span>
            账面余额：<b>{{
              erpPriceInputFormatter(pageSummary.currentBalance)
            }}</b>
          </span>
        </div>
      </template>
    </Grid>
  </div>
</template>

<style scoped>
.account-fund-report-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.account-fund-report-table__grid {
  flex: 1 1 auto;
  min-height: 0;
}

.account-fund-report-table__summary {
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

.account-fund-report-table__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

:deep(.account-fund-report-table__grid .vxe-table--render-default),
:deep(.account-fund-report-table__grid .vxe-grid--form-wrapper),
:deep(.account-fund-report-table__grid .vxe-toolbar) {
  font-size: 12px;
}

:deep(.account-fund-report-table__grid .vxe-grid--form-wrapper form > .grid) {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

:deep(.account-fund-report-table__grid .vxe-grid--form-wrapper .ant-form-item) {
  margin-bottom: 8px;
}

:deep(.account-fund-report-table__grid .vxe-grid--form-wrapper label),
:deep(.account-fund-report-table__grid .vxe-grid--form-wrapper .ant-input),
:deep(.account-fund-report-table__grid .vxe-grid--form-wrapper .ant-select),
:deep(.account-fund-report-table__grid .vxe-grid--form-wrapper .ant-btn) {
  font-size: 12px;
}

:deep(
  .account-fund-report-table__grid
    .vxe-grid--form-wrapper
    .ant-input-affix-wrapper
) {
  min-height: 28px;
  padding: 2px 8px;
}

:deep(
  .account-fund-report-table__grid .vxe-grid--form-wrapper .ant-select-single
),
:deep(
  .account-fund-report-table__grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
  min-height: 28px;
}

:deep(.account-fund-report-table__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

@media (max-width: 1280px) {
  :deep(.account-fund-report-table__grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
