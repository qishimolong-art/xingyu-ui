<script lang="ts" setup>
import { financeListMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPayableReportApi } from '#/api/erp/finance/payable/report';

import { computed, onMounted, ref, watchEffect } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenDrawer } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Alert, TabPane, Tabs } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportPayableReport,
  getPayableReportPage,
} from '#/api/erp/finance/payable/report';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import SupplierPayableOverviewTable from '#/views/erp/purchase/report/modules/supplier-payable-overview-table.vue';
import BusinessReportShell from '#/views/erp/report/components/business-report-shell.vue';
import MiscReadonlyTable from '#/views/erp/report/counterparty/modules/misc-readonly-table.vue';
import PreSettlementReadonlyTable from '#/views/erp/report/counterparty/modules/pre-settlement-readonly-table.vue';
import SettlementOffsetReadonlyTable from '#/views/erp/report/counterparty/modules/settlement-offset-readonly-table.vue';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import { withErpKeywordSearchSchema } from '#/views/erp/utils/form-defaults';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { queueFocusFinanceKeywordSearchInput } from '../../utils/keyword-search-focus';
import {
  PAYABLE_REPORT_SORT_FIELD_MAP,
  useGridColumns,
  useGridFormSchema,
} from './data';
import DetailDrawer from './modules/detail-drawer.vue';
import { sumPayableReportAmount } from './report-ui';

defineOptions({ name: 'ErpPayableReport' });

const { hasAccessByCodes } = useAccess();
const canQuerySummary = computed(() =>
  hasAccessByCodes(['erp:payable-report:query']),
);
const canQueryAccount = computed(() =>
  hasAccessByCodes(['erp:payable-account:query']),
);
const canQueryMisc = computed(() =>
  hasAccessByCodes(['erp:payable-misc:query']),
);
const canQueryOffset = computed(() =>
  hasAccessByCodes(['erp:settlement-offset:query']),
);
const canQueryPrePayment = computed(() =>
  hasAccessByCodes(['erp:pre-payment:query']),
);
const canQuery = computed(
  () =>
    canQuerySummary.value ||
    canQueryAccount.value ||
    canQueryMisc.value ||
    canQueryOffset.value ||
    canQueryPrePayment.value,
);
const activeTab = ref('summary');

function getDefaultActiveTab() {
  if (canQueryAccount.value) return 'account';
  if (canQuerySummary.value) return 'summary';
  if (canQueryMisc.value) return 'misc';
  if (canQueryPrePayment.value) return 'prePayment';
  return 'offset';
}

function canShowActiveTab() {
  if (activeTab.value === 'account') return canQueryAccount.value;
  if (activeTab.value === 'summary') return canQuerySummary.value;
  if (activeTab.value === 'misc') return canQueryMisc.value;
  if (activeTab.value === 'offset') return canQueryOffset.value;
  if (activeTab.value === 'prePayment') return canQueryPrePayment.value;
  return false;
}

watchEffect(() => {
  if (canQuery.value && !canShowActiveTab()) {
    activeTab.value = getDefaultActiveTab();
  }
});
const payableReportGridShellRef = ref<HTMLElement>();
const currentSupplierId = ref<number>();
const currentBizTime = ref<string[]>([]);
const exportLoading = ref(false);
const pageRows = ref<ErpPayableReportApi.PayableReport[]>([]);

const [Drawer, drawerApi] = useVbenDrawer({
  title: '应付报表明细',
  footer: false,
  destroyOnClose: true,
});

const pageSummary = computed(() => ({
  supplierCount: pageRows.value.length,
  otherPayableAmount: sumPayableReportAmount(
    pageRows.value,
    'otherPayableAmount',
  ),
}));

const summaryItems = computed(() => [
  { label: '供应商数', value: `${pageSummary.value.supplierCount}` },
  {
    label: '其他应付金额',
    value: erpPriceInputFormatter(pageSummary.value.otherPayableAmount),
  },
]);

const PAYABLE_REPORT_AMOUNT_FIELDS = new Set(['otherPayableAmount']);

function buildPayableReportFooter({
  columns,
  data,
}: {
  columns: any[];
  data: ErpPayableReportApi.PayableReport[];
}) {
  return [
    columns.map((column) => {
      if (column.field === 'supplierName') return '本页小计';
      if (PAYABLE_REPORT_AMOUNT_FIELDS.has(column.field)) {
        return erpPriceInputFormatter(
          sumPayableReportAmount(data, column.field),
        );
      }
      return '';
    }),
  ];
}

async function handleOpenDetail(row: ErpPayableReportApi.PayableReport) {
  currentSupplierId.value = row.supplierId;
  const formValues = await gridApi.formApi.getValues();
  currentBizTime.value = formValues.bizTime || [];
  drawerApi
    .setState({
      title: row.supplierName
        ? `应付报表明细 - ${row.supplierName}`
        : '应付报表明细',
    })
    .open();
}

function handleCellClick({
  column,
  row,
}: {
  column: any;
  row: ErpPayableReportApi.PayableReport;
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
    const data = await exportPayableReport({
      ...formValues,
      ...buildSortParams(),
    });
    downloadFileFromBlobPart({ fileName: '应付报表.xls', source: data });
  } finally {
    exportLoading.value = false;
  }
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(PAYABLE_REPORT_SORT_FIELD_MAP);

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
    footerMethod: buildPayableReportFooter,
    height: 'auto',
    id: 'erp-finance-payable-report-list-v2',
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
            const result = await getPayableReportPage({
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
      keyField: 'supplierId',
      isHover: true,
      isCurrent: true,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpPayableReportApi.PayableReport>,
  gridEvents: {
    sortChange: handleSortChange,
    cellClick: handleCellClick,
  },
});

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpPayableReportApi.PayableReport>({
    errorMessage: 'Error occurred while refreshing payable report page:',
    gridApi,
    onAfterRefresh: () =>
      queueFocusFinanceKeywordSearchInput(payableReportGridShellRef),
    onFirstActivated: () =>
      queueFocusFinanceKeywordSearchInput(payableReportGridShellRef),
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: getPayableReportPage,
    onSuccess: (rows) => {
      pageRows.value = rows;
      void restoreSortState(gridApi);
    },
  });

onMounted(() => queueFocusFinanceKeywordSearchInput(payableReportGridShellRef));
</script>

<template>
  <BusinessReportShell
    title="经营报表 · 06 采购应付及其他应付"
    :denied="!canQuery"
    no-permission-message="没有采购应付账户、其他应付、预付款或应收冲应付查询权限"
  >
    <Drawer class="w-[85vw]">
      <DetailDrawer
        :supplier-id="currentSupplierId"
        :biz-time="currentBizTime"
      />
    </Drawer>
    <Alert
      class="mb-2"
      type="info"
      show-icon
      message="第一阶段复用现有分页接口，只读展示采购应付账户、其他应付、预付款和应收冲应付参考。"
      description="采购应付汇总按采购侧业务发生与核销结果展示；采购应付账户页签复用既有账户分页，只作旧口径核对参考，正式新口径不能把其他应付串入采购应付余额。其他应付按独立往来闭环改造，与采购应付隔离。应收冲应付只展示轧抵参考，不直接调整余额，也不替代对账单确认、历史截止余额或差异待办。草稿、待审核单据仅用于过程核对，只有已审核且有效的其他应付进入正式余额；预付独立列示，退款、优惠调账和跨期核销需要按明细继续核对；账龄和逾期按真实往来事件及核销结果判断；对账差异生成待办，不直接调整余额；完整余额仍需完成期初核对、支付、核销、冲销和调整台账。"
    />
    <Tabs
      v-if="canQuery"
      v-model:active-key="activeTab"
      class="erp-business-report-tabs payable-report-tabs"
      size="small"
    >
      <TabPane v-if="canQueryAccount" key="account" tab="06 · 采购应付账户">
        <SupplierPayableOverviewTable
          v-if="activeTab === 'account' && canQueryAccount"
        />
      </TabPane>
      <TabPane v-if="canQuerySummary" key="summary" tab="06 · 采购应付汇总">
        <div
          v-if="activeTab === 'summary'"
          ref="payableReportGridShellRef"
          class="payable-report-grid-shell"
        >
          <Grid
            table-title="采购应付汇总"
            @keydown.enter.capture="handleSearchEnter"
          >
            <template #toolbar-tools>
              <TableAction
                :actions="[
                  {
                    label: '导出',
                    type: 'primary',
                    icon: ACTION_ICON.DOWNLOAD,
                    auth: ['erp:payable-report:export'],
                    loading: exportLoading,
                    onClick: handleExport,
                  },
                ]"
              />
            </template>
            <template #supplierName="{ row }">
              <button
                type="button"
                class="payable-report-link"
                :title="row.supplierName || ''"
                @click.stop="handleOpenDetail(row)"
              >
                {{ row.supplierName || '-' }}
              </button>
            </template>
            <template #actions="{ row }">
              <TableAction
                :actions="[
                  {
                    label: '明细',
                    type: 'link',
                    icon: ACTION_ICON.VIEW,
                    auth: ['erp:payable-report:query'],
                    onClick: handleOpenDetail.bind(null, row),
                  },
                ]"
              />
            </template>
            <template #bottom>
              <div class="payable-report-bottom-summary">
                <b>本页合计：</b>
                <span
                  v-for="item in summaryItems"
                  :key="item.label"
                  class="payable-report-summary-item"
                >
                  {{ item.label }}：<b>{{ item.value }}</b>
                </span>
              </div>
            </template>
          </Grid>
          <ErpActivationRefreshMask
            v-if="activationRefreshMaskVisible"
            class="payable-report-activation-mask"
          />
        </div>
      </TabPane>
      <TabPane v-if="canQueryMisc" key="misc" tab="06 · 其他应付">
        <MiscReadonlyTable v-if="activeTab === 'misc'" report-type="payable" />
      </TabPane>
      <TabPane v-if="canQueryPrePayment" key="prePayment" tab="预付款只读参考">
        <PreSettlementReadonlyTable
          v-if="activeTab === 'prePayment'"
          report-type="prePayment"
        />
      </TabPane>
      <TabPane v-if="canQueryOffset" key="offset" tab="应收冲应付参考">
        <SettlementOffsetReadonlyTable v-if="activeTab === 'offset'" />
      </TabPane>
    </Tabs>
  </BusinessReportShell>
</template>

<style scoped>
.payable-report-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

.payable-report-tabs {
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

:global(.payable-report-search-select-dropdown .ant-select-item),
:global(.payable-report-search-select-dropdown .ant-empty-description) {
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

.payable-report-link {
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

.payable-report-link:hover,
.payable-report-link:focus-visible {
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

.payable-report-bottom-summary {
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

.payable-report-bottom-summary > b,
.payable-report-summary-item b {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}
</style>
