<script lang="ts" setup>
import { financeListMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpReceivableReportApi } from '#/api/erp/finance/receivable/report';

import { computed, onMounted, ref, watchEffect } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenDrawer } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Alert, TabPane, Tabs } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportReceivableReport,
  getReceivableReportPage,
} from '#/api/erp/finance/receivable/report';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import BusinessReportShell from '#/views/erp/report/components/business-report-shell.vue';
import MiscReadonlyTable from '#/views/erp/report/counterparty/modules/misc-readonly-table.vue';
import PreSettlementReadonlyTable from '#/views/erp/report/counterparty/modules/pre-settlement-readonly-table.vue';
import SettlementOffsetReadonlyTable from '#/views/erp/report/counterparty/modules/settlement-offset-readonly-table.vue';
import CustomerReceivableOverviewTable from '#/views/erp/sale/report/modules/customer-receivable-overview-table.vue';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import { withErpKeywordSearchSchema } from '#/views/erp/utils/form-defaults';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { queueFocusFinanceKeywordSearchInput } from '../../utils/keyword-search-focus';
import {
  RECEIVABLE_REPORT_SORT_FIELD_MAP,
  useGridColumns,
  useGridFormSchema,
} from './data';
import DetailDrawer from './modules/detail-drawer.vue';
import { sumReceivableReportAmount } from './report-ui';

defineOptions({ name: 'ErpReceivableReport' });

const { hasAccessByCodes } = useAccess();
const canQuerySummary = computed(() =>
  hasAccessByCodes(['erp:receivable-report:query']),
);
const canQueryAccount = computed(() =>
  hasAccessByCodes(['erp:receivable-account:query']),
);
const canQueryMisc = computed(() =>
  hasAccessByCodes(['erp:receivable-misc:query']),
);
const canQueryOffset = computed(() =>
  hasAccessByCodes(['erp:settlement-offset:query']),
);
const canQueryPreReceipt = computed(() =>
  hasAccessByCodes(['erp:pre-receipt:query']),
);
const canQueryPreReceivable = computed(() =>
  hasAccessByCodes(['erp:pre-receivable:query']),
);
const canQuery = computed(
  () =>
    canQuerySummary.value ||
    canQueryAccount.value ||
    canQueryMisc.value ||
    canQueryOffset.value ||
    canQueryPreReceipt.value ||
    canQueryPreReceivable.value,
);
const activeTab = ref('summary');

function getDefaultActiveTab() {
  if (canQueryAccount.value) return 'account';
  if (canQuerySummary.value) return 'summary';
  if (canQueryMisc.value) return 'misc';
  if (canQueryPreReceipt.value) return 'preReceipt';
  if (canQueryPreReceivable.value) return 'preReceivable';
  return 'offset';
}

function canShowActiveTab() {
  if (activeTab.value === 'account') return canQueryAccount.value;
  if (activeTab.value === 'summary') return canQuerySummary.value;
  if (activeTab.value === 'misc') return canQueryMisc.value;
  if (activeTab.value === 'offset') return canQueryOffset.value;
  if (activeTab.value === 'preReceipt') return canQueryPreReceipt.value;
  if (activeTab.value === 'preReceivable') return canQueryPreReceivable.value;
  return false;
}

watchEffect(() => {
  if (canQuery.value && !canShowActiveTab()) {
    activeTab.value = getDefaultActiveTab();
  }
});
const receivableReportGridShellRef = ref<HTMLElement>();
const currentCustomerId = ref<number>();
const currentBizTime = ref<string[]>([]);
const exportLoading = ref(false);
const pageRows = ref<ErpReceivableReportApi.ReceivableReport[]>([]);

const [Drawer, drawerApi] = useVbenDrawer({
  title: '应收报表明细',
  footer: false,
  destroyOnClose: true,
});

const pageSummary = computed(() => ({
  customerCount: pageRows.value.length,
  otherReceivableAmount: sumReceivableReportAmount(
    pageRows.value,
    'otherReceivableAmount',
  ),
}));

const summaryItems = computed(() => [
  { label: '客户数', value: `${pageSummary.value.customerCount}` },
  {
    label: '其他应收金额',
    value: erpPriceInputFormatter(pageSummary.value.otherReceivableAmount),
  },
]);

const RECEIVABLE_REPORT_AMOUNT_FIELDS = new Set(['otherReceivableAmount']);

function buildReceivableReportFooter({
  columns,
  data,
}: {
  columns: any[];
  data: ErpReceivableReportApi.ReceivableReport[];
}) {
  return [
    columns.map((column) => {
      if (column.field === 'customerName') return '本页小计';
      if (RECEIVABLE_REPORT_AMOUNT_FIELDS.has(column.field)) {
        return erpPriceInputFormatter(
          sumReceivableReportAmount(data, column.field),
        );
      }
      return '';
    }),
  ];
}

async function handleOpenDetail(row: ErpReceivableReportApi.ReceivableReport) {
  currentCustomerId.value = row.customerId;
  const formValues = await gridApi.formApi.getValues();
  currentBizTime.value = formValues.bizTime || [];
  drawerApi
    .setState({
      title: row.customerName
        ? `应收报表明细 - ${row.customerName}`
        : '应收报表明细',
    })
    .open();
}

function handleCellClick({
  column,
  row,
}: {
  column: any;
  row: ErpReceivableReportApi.ReceivableReport;
}) {
  if (
    !column?.field ||
    column?.type === 'checkbox' ||
    column?.slots?.default === 'actions'
  ) {
    return;
  }
  handleOpenDetail(row);
}

async function handleExport() {
  exportLoading.value = true;
  try {
    const formValues = await gridApi.formApi.getValues();
    const data = await exportReceivableReport({
      ...formValues,
      ...buildSortParams(),
    });
    downloadFileFromBlobPart({ fileName: '应收报表.xls', source: data });
  } finally {
    exportLoading.value = false;
  }
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(RECEIVABLE_REPORT_SORT_FIELD_MAP);

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 76 },
    schema: withErpKeywordSearchSchema(useGridFormSchema()),
    collapsed: true,
    collapsedRows: 1,
  },
  gridOptions: {
    columns: useGridColumns(),
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    footerMethod: buildReceivableReportFooter,
    height: 'auto',
    id: 'erp-finance-receivable-report-list-v2',
    keepSource: true,
    showFooter: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 10 },
    scrollY: { enabled: true, gt: 10 },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          try {
            const result = await getReceivableReportPage({
              pageNo: page.currentPage,
              pageSize: page.pageSize,
              ...formValues,
              ...buildSortParams(sorts, sort),
            });
            pageRows.value = result.list || [];
            return result;
          } catch (error) {
            pageRows.value = [];
            throw error;
          }
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
    rowConfig: {
      keyField: 'customerId',
      isHover: true,
      isCurrent: true,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpReceivableReportApi.ReceivableReport>,
  gridEvents: {
    sortChange: handleSortChange,
    cellClick: handleCellClick,
  },
});

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpReceivableReportApi.ReceivableReport>({
    errorMessage: 'Error occurred while refreshing receivable report page:',
    gridApi,
    onAfterRefresh: () =>
      queueFocusFinanceKeywordSearchInput(receivableReportGridShellRef),
    onFirstActivated: () =>
      queueFocusFinanceKeywordSearchInput(receivableReportGridShellRef),
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: getReceivableReportPage,
    onSuccess: (rows) => {
      pageRows.value = rows;
      void restoreSortState(gridApi);
    },
  });

onMounted(() =>
  queueFocusFinanceKeywordSearchInput(receivableReportGridShellRef),
);
</script>

<template>
  <BusinessReportShell
    title="经营报表 · 05 销售应收及其他应收"
    :denied="!canQuery"
    no-permission-message="没有销售应收账户、其他应收、预收款、预收账款或应收冲应付查询权限"
  >
    <Drawer class="w-[85vw]">
      <DetailDrawer
        :customer-id="currentCustomerId"
        :biz-time="currentBizTime"
      />
    </Drawer>
    <Alert
      class="mb-2"
      type="info"
      show-icon
      message="第一阶段复用现有分页接口，只读展示销售应收账户、其他应收、预收款、预收账款和应收冲应付参考。"
      description="销售应收汇总按销售侧业务发生与核销结果展示；销售应收账户页签复用既有账户分页，只作旧口径核对参考，正式新口径不能把其他应收串入销售应收余额。其他应收按独立往来闭环改造，与销售应收隔离。应收冲应付只展示轧抵参考，不直接调整余额，也不替代对账单确认、历史截止余额或差异待办。草稿、待审核单据仅用于过程核对，只有已审核且有效的其他应收进入正式余额；预收独立列示，预收账款独立列示，退款、优惠调账和跨期核销需要按明细继续核对；账龄和逾期按真实往来事件及核销结果判断；对账差异生成待办，不直接调整余额；完整余额仍需完成期初核对、收回、核销、冲销和调整台账。"
    />
    <Tabs
      v-if="canQuery"
      v-model:active-key="activeTab"
      class="erp-business-report-tabs receivable-report-tabs"
      size="small"
    >
      <TabPane v-if="canQueryAccount" key="account" tab="05 · 销售应收账户">
        <CustomerReceivableOverviewTable
          v-if="activeTab === 'account' && canQueryAccount"
        />
      </TabPane>
      <TabPane v-if="canQuerySummary" key="summary" tab="05 · 销售应收汇总">
        <div
          v-if="activeTab === 'summary'"
          ref="receivableReportGridShellRef"
          class="receivable-report-grid-shell"
        >
          <Grid
            table-title="销售应收汇总"
            @keydown.enter.capture="handleSearchEnter"
          >
            <template #toolbar-tools>
              <TableAction
                :actions="[
                  {
                    label: '导出',
                    type: 'primary',
                    icon: ACTION_ICON.DOWNLOAD,
                    auth: ['erp:receivable-report:export'],
                    loading: exportLoading,
                    onClick: handleExport,
                  },
                ]"
              />
            </template>
            <template #customerName="{ row }">
              <button
                type="button"
                class="receivable-report-link"
                :title="row.customerName || ''"
                @click.stop="handleOpenDetail(row)"
              >
                {{ row.customerName || '-' }}
              </button>
            </template>
            <template #actions="{ row }">
              <TableAction
                :actions="[
                  {
                    label: '明细',
                    type: 'link',
                    icon: ACTION_ICON.VIEW,
                    auth: ['erp:receivable-report:query'],
                    onClick: handleOpenDetail.bind(null, row),
                  },
                ]"
              />
            </template>
            <template #bottom>
              <div class="receivable-report-bottom-summary">
                <b>本页合计：</b>
                <span
                  v-for="item in summaryItems"
                  :key="item.label"
                  class="receivable-report-summary-item"
                >
                  {{ item.label }}：<b>{{ item.value }}</b>
                </span>
              </div>
            </template>
          </Grid>
          <ErpActivationRefreshMask
            v-if="activationRefreshMaskVisible"
            class="receivable-report-activation-mask"
          />
        </div>
      </TabPane>
      <TabPane v-if="canQueryMisc" key="misc" tab="05 · 其他应收">
        <MiscReadonlyTable
          v-if="activeTab === 'misc'"
          report-type="receivable"
        />
      </TabPane>
      <TabPane v-if="canQueryPreReceipt" key="preReceipt" tab="预收款只读参考">
        <PreSettlementReadonlyTable
          v-if="activeTab === 'preReceipt'"
          report-type="preReceipt"
        />
      </TabPane>
      <TabPane
        v-if="canQueryPreReceivable"
        key="preReceivable"
        tab="预收账款只读参考"
      >
        <PreSettlementReadonlyTable
          v-if="activeTab === 'preReceivable'"
          report-type="preReceivable"
        />
      </TabPane>
      <TabPane v-if="canQueryOffset" key="offset" tab="应收冲应付参考">
        <SettlementOffsetReadonlyTable v-if="activeTab === 'offset'" />
      </TabPane>
    </Tabs>
  </BusinessReportShell>
</template>

<style scoped>
.receivable-report-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

.receivable-report-tabs {
  flex: 1 1 auto;
  min-height: 0;
}

:deep(.vxe-table--render-default),
:deep(.vxe-grid--form-wrapper) {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.vxe-grid--form-wrapper label),
:deep(.vxe-grid--form-wrapper .ant-input),
:deep(.vxe-grid--form-wrapper .ant-picker),
:deep(.vxe-grid--form-wrapper .ant-picker-input > input),
:deep(.vxe-grid--form-wrapper .ant-select),
:deep(.vxe-grid--form-wrapper .ant-switch),
:deep(.vxe-grid--form-wrapper .ant-btn),
:deep(.vxe-grid--form-wrapper .vben-link) {
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper .ant-input-affix-wrapper),
:deep(.vxe-grid--form-wrapper .ant-picker),
:deep(.vxe-grid--form-wrapper .ant-select-single) {
  min-height: 28px;
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper .ant-input-affix-wrapper),
:deep(.vxe-grid--form-wrapper .ant-picker) {
  padding: 2px 8px;
}

:deep(.vxe-grid--form-wrapper .ant-select-single),
:deep(.vxe-grid--form-wrapper .ant-select-single .ant-select-selector) {
  height: 28px;
}

:deep(.vxe-grid--form-wrapper .ant-select-single .ant-select-selector) {
  padding: 0 8px;
}

:deep(.vxe-grid--form-wrapper .ant-select-single .ant-select-selection-item),
:deep(
  .vxe-grid--form-wrapper .ant-select-single .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:global(.receivable-report-search-select-dropdown .ant-select-item),
:global(.receivable-report-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper .ant-btn),
:deep(.vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
}

:deep(.vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(.vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

.receivable-report-link {
  display: block;
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font: inherit;
  color: hsl(var(--primary));
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.receivable-report-link:hover,
.receivable-report-link:focus-visible {
  text-decoration: underline;
}

:deep(.vxe-grid--bottom-wrapper) {
  position: sticky;
  bottom: 36px;
  z-index: 4;
  background: hsl(var(--card));
}

:deep(.vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

.receivable-report-bottom-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  align-items: center;
  justify-content: flex-end;
  min-height: 40px;
  padding: 5px 8px;
  font-size: 12px;
  line-height: 18px;
  color: hsl(var(--muted-foreground));
  border-top: 1px solid hsl(var(--border));
}

.receivable-report-bottom-summary > b,
.receivable-report-summary-item b {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}
</style>
