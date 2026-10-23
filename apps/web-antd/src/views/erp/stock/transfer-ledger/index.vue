<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpStockTransferLedgerApi } from '#/api/erp/stock/transfer-ledger';

import { computed, onMounted, ref, watchEffect } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Alert, TabPane, Tabs, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportStockTransferLedger,
  getStockTransferLedgerPage,
  getStockTransferLedgerTotal,
  normalizeStockTransferLedgerDate,
} from '#/api/erp/stock/transfer-ledger';
import { useFieldPermission } from '#/composables/useFieldPermission';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import BusinessReportShell from '#/views/erp/report/components/business-report-shell.vue';
import { isSameFieldSet } from '#/views/erp/stock/utils/field-permission';
import { queueFocusStockKeywordSearchInput } from '#/views/erp/stock/utils/keyword-search-focus';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';

import TransferInForm from '../transfer-in/modules/form.vue';
import TransferOutForm from '../transfer-out/modules/form.vue';
import { useGridColumns, useGridFormSchema } from './data';
import DetailModalComponent from './modules/detail-modal.vue';
import { getLedgerStatusMeta } from './modules/status';
import TransferDocumentReadonlyTable from './modules/transfer-document-readonly-table.vue';

defineOptions({ name: 'ErpStockTransferLedger' });

const { hasAccessByCodes } = useAccess();
const canQueryLedger = computed(() =>
  hasAccessByCodes(['erp:stock-transfer-ledger:query']),
);
const canQueryTransferOut = computed(() =>
  hasAccessByCodes(['erp:stock-transfer-out:query']),
);
const canQueryTransferIn = computed(() =>
  hasAccessByCodes(['erp:stock-transfer-in:query']),
);
const canQueryAnyTransferReport = computed(
  () =>
    canQueryLedger.value ||
    canQueryTransferOut.value ||
    canQueryTransferIn.value,
);
const activeReportTab = ref('ledger');

function getDefaultActiveReportTab() {
  if (canQueryLedger.value) return 'ledger';
  if (canQueryTransferOut.value) return 'transferOut';
  return 'transferIn';
}

function canShowActiveReportTab() {
  if (activeReportTab.value === 'ledger') return canQueryLedger.value;
  if (activeReportTab.value === 'transferOut') return canQueryTransferOut.value;
  if (activeReportTab.value === 'transferIn') return canQueryTransferIn.value;
  return false;
}

watchEffect(() => {
  if (canQueryAnyTransferReport.value && !canShowActiveReportTab()) {
    activeReportTab.value = getDefaultActiveReportTab();
  }
});

const FIELD_PERMISSION_MODULE = 'erp_stock_transfer_ledger';
const { hiddenFields, isHidden, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const total = ref<ErpStockTransferLedgerApi.Total>({
  transferOutCount: 0,
  transferInCount: 0,
  differenceCount: 0,
  abnormalGroupCount: 0,
});
const latestQuery = ref<ErpStockTransferLedgerApi.QueryParams>();
const stockTransferLedgerGridShellRef = ref<HTMLElement>();
const ledgerStageSections = [
  {
    title: '调拨出入库核对',
    status: '已复用现有台账',
    description:
      '按调拨日期汇总出库、入库、差异和异常组数，用于日常核对和异常识别。',
  },
  {
    title: '分批收货与在途金额',
    status: '待后端核算接入',
    description:
      '第一阶段先展示出入库数量差异；调出过账与调入收货拆分、正式在途结算成本后续由核算服务提供。',
  },
  {
    title: '多级变价调拨利润',
    status: '待后端核算接入',
    description: '总部到门店、多级部门只赚本级差价的利润计算暂不在前端写死。',
  },
  {
    title: '同部门移仓',
    status: '口径已标注',
    description:
      '第一阶段沿用现有台账口径，不启用双成本新核算，也不产生调拨收入或调拨利润。',
  },
  {
    title: '手推车自动调拨链',
    status: '口径已标注',
    description:
      '销售手推车自动调拨链只做来源追踪，不重复生成调拨或重复占用库存。',
  },
  {
    title: '内部利润分配',
    status: '待后端核算接入',
    description: '对外销售后的内部利润实现、未实现抵销后续由正式核算接口提供。',
  },
];

const [DetailModal, detailModalApi] = useVbenModal({
  connectedComponent: DetailModalComponent,
  destroyOnClose: true,
});
const [TransferOutModal, transferOutModalApi] = useVbenModal({
  connectedComponent: TransferOutForm,
  destroyOnClose: true,
});
const [TransferInModal, transferInModalApi] = useVbenModal({
  connectedComponent: TransferInForm,
  destroyOnClose: true,
});

function openDetail(row: ErpStockTransferLedgerApi.Summary) {
  if (!latestQuery.value) return;
  detailModalApi
    .setData({
      ...latestQuery.value,
      businessDate: normalizeStockTransferLedgerDate(
        row.businessDate,
        'YYYY-MM-DD',
      ),
      pageNo: 1,
      pageSize: 20,
    })
    .open();
}

function openTransferOut(id: number) {
  transferOutModalApi.setData({ id, type: 'detail' }).open();
}

function openTransferIn(id: number) {
  transferInModalApi.setData({ id, type: 'detail' }).open();
}

function openTransferDocument(type: 'transferIn' | 'transferOut', id: number) {
  if (type === 'transferOut') {
    openTransferOut(id);
    return;
  }
  openTransferIn(id);
}

async function handleExport() {
  const params = {
    ...(await gridApi.formApi.getValues()),
    orderField: 'businessDate',
    orderDirection: 'desc',
  } as ErpStockTransferLedgerApi.QueryParams;
  const data = await exportStockTransferLedger(params);
  downloadFileFromBlobPart({ fileName: '调拨出入库台账.xls', source: data });
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 82 },
    schema: useGridFormSchema(hiddenFields.value),
  },
  gridOptions: {
    columns: useGridColumns(hiddenFields.value),
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    height: 'auto',
    id: 'erp-stock-transfer-ledger-list',
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: {
      enabled: true,
      gt: 8,
    },
    scrollY: {
      enabled: true,
      gt: 10,
    },
    rowClassName: ({ row }) =>
      row.ledgerStatus === 'ABNORMAL' ||
      Number(row.abnormalGroupCount) > 0 ||
      Number(row.differenceCount) !== 0
        ? 'ledger-abnormal-row'
        : '',
    proxyConfig: {
      ajax: {
        query: async ({ page, sort }, formValues) => {
          const params = {
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            orderField: sort?.field || 'businessDate',
            orderDirection: sort?.order || 'desc',
          } as ErpStockTransferLedgerApi.QueryParams;
          latestQuery.value = params;
          const [pageResult, totalResult] = await Promise.all([
            getStockTransferLedgerPage(params),
            getStockTransferLedgerTotal(params),
          ]);
          total.value = totalResult;
          return pageResult;
        },
      },
      sort: true,
    },
    sortConfig: {
      remote: true,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
    },
    rowConfig: { keyField: 'businessDate', isHover: true },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ErpStockTransferLedgerApi.Summary>,
  gridEvents: {
    cellClick: ({
      row,
      column,
    }: {
      column: { field?: string };
      row: ErpStockTransferLedgerApi.Summary;
    }) => {
      if (column.field !== 'action') {
        openDetail(row);
      }
    },
  },
});

let appliedHiddenFields = [...hiddenFields.value];

function getCurrentLedgerSortParams() {
  const sortColumn = gridApi.grid?.getSortColumns?.()?.[0];
  return {
    orderField: sortColumn?.field || 'businessDate',
    orderDirection: sortColumn?.order || 'desc',
  };
}

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpStockTransferLedgerApi.Summary>({
    gridApi,
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...getCurrentLedgerSortParams(),
    }),
    queryPage: async (params) => {
      latestQuery.value = params as ErpStockTransferLedgerApi.QueryParams;
      const [pageResult, totalResult] = await Promise.all([
        getStockTransferLedgerPage(
          params as ErpStockTransferLedgerApi.QueryParams,
        ),
        getStockTransferLedgerTotal(
          params as ErpStockTransferLedgerApi.QueryParams,
        ),
      ]);
      total.value = totalResult;
      return pageResult;
    },
    onAfterRefresh: () => {
      queueFocusStockKeywordSearchInput(stockTransferLedgerGridShellRef);
    },
    onFirstActivated: () => {
      queueFocusStockKeywordSearchInput(stockTransferLedgerGridShellRef);
    },
    errorMessage: 'Error occurred while refreshing stock transfer ledger page:',
  });

onMounted(async () => {
  queueFocusStockKeywordSearchInput(stockTransferLedgerGridShellRef);
  await loadHiddenFields();
  const fields = hiddenFields.value;
  if (isSameFieldSet(appliedHiddenFields, fields)) {
    return;
  }
  appliedHiddenFields = [...fields];
  gridApi.formApi?.setState?.({
    schema: useGridFormSchema(fields),
  });
  await gridApi.grid.reloadColumn(useGridColumns(fields) || []);
  queueFocusStockKeywordSearchInput(stockTransferLedgerGridShellRef);
});
</script>

<template>
  <BusinessReportShell
    title="经营报表 · 调拨、移仓及在途"
    :denied="!canQueryAnyTransferReport"
    :notices="ledgerStageSections"
  >
    <DetailModal
      @open-transfer-in="openTransferIn"
      @open-transfer-out="openTransferOut"
    />
    <TransferOutModal />
    <TransferInModal />

    <Tabs
      v-if="canQueryAnyTransferReport"
      v-model:active-key="activeReportTab"
      class="erp-business-report-tabs stock-transfer-ledger-report-tabs"
      size="small"
    >
      <TabPane v-if="canQueryLedger" key="ledger" tab="调拨出入库台账">
        <div
          v-if="activeReportTab === 'ledger' && canQueryLedger"
          ref="stockTransferLedgerGridShellRef"
          class="stock-transfer-ledger-grid-shell"
        >
          <Alert
            class="mb-2"
            type="info"
            show-icon
            message="第一阶段复用现有调拨出入库台账展示发出、入库、差异和异常。"
            description="真实多级变价调拨利润、调出过账与调入收货拆分、在途结算成本、内部利润实现/未实现抵销仍待后续核算服务；当前不启用双成本新核算，不新增调拨、收货或结算业务动作。"
          />
          <Grid table-title="调拨出入库台账">
            <template #toolbar-tools>
              <TableAction
                :actions="[
                  {
                    label: '导出明细',
                    type: 'primary',
                    icon: ACTION_ICON.DOWNLOAD,
                    auth: ['erp:stock-transfer-ledger:export'],
                    onClick: handleExport,
                  },
                ]"
              />
            </template>
            <template #businessDate="{ row }">
              <button
                class="ledger-link"
                type="button"
                @click.stop="openDetail(row)"
              >
                {{ row.businessDate }}
              </button>
            </template>
            <template #abnormalGroupCount="{ row }">
              <button
                v-if="row.abnormalGroupCount"
                class="ledger-link ledger-link--danger"
                type="button"
                @click.stop="openDetail(row)"
              >
                {{ row.abnormalGroupCount }}
              </button>
              <span v-else>0</span>
            </template>
            <template #ledgerStatus="{ row }">
              <Tag :color="getLedgerStatusMeta(row.ledgerStatus).color">
                {{ getLedgerStatusMeta(row.ledgerStatus).label }}
              </Tag>
            </template>
            <template #action="{ row }">
              <TableAction
                :actions="[
                  { label: '查看明细', onClick: () => openDetail(row) },
                ]"
              />
            </template>
            <template #bottom>
              <div class="ledger-bottom-summary">
                <div class="ledger-row-legend">
                  <span
                    class="ledger-row-legend__swatch"
                    aria-hidden="true"
                  ></span>
                  <span>
                    浅红色行表示调拨出入库数据不匹配，包括出库单未审批、尚未生成入库单
                  </span>
                </div>
                <div class="ledger-total-line">
                  <b>筛选结果：</b>
                  <span v-if="!isHidden('report_transferOutCount')">
                    出库数量 {{ total.transferOutCount }}
                  </span>
                  <span v-if="!isHidden('report_transferInCount')">
                    入库数量 {{ total.transferInCount }}
                  </span>
                  <span v-if="!isHidden('report_differenceCount')">
                    数量差异 {{ total.differenceCount }}
                  </span>
                  <span
                    v-if="!isHidden('report_abnormalGroupCount')"
                    :class="{
                      'ledger-total--danger': total.abnormalGroupCount,
                    }"
                  >
                    异常组数 {{ total.abnormalGroupCount }}
                  </span>
                </div>
              </div>
            </template>
          </Grid>
          <ErpActivationRefreshMask
            v-if="activationRefreshMaskVisible"
            class="stock-transfer-ledger-activation-mask"
          />
        </div>
      </TabPane>
      <TabPane
        v-if="canQueryTransferOut"
        key="transferOut"
        tab="调拨出库单只读参考"
      >
        <TransferDocumentReadonlyTable
          v-if="activeReportTab === 'transferOut' && canQueryTransferOut"
          report-type="transferOut"
          @open-document="openTransferDocument"
        />
      </TabPane>
      <TabPane
        v-if="canQueryTransferIn"
        key="transferIn"
        tab="调拨入库单只读参考"
      >
        <TransferDocumentReadonlyTable
          v-if="activeReportTab === 'transferIn' && canQueryTransferIn"
          report-type="transferIn"
          @open-document="openTransferDocument"
        />
      </TabPane>
    </Tabs>
    <Alert
      v-else
      type="info"
      show-icon
      message="没有调拨台账、调拨出库或调拨入库查询权限。"
      description="请给当前角色配置 erp:stock-transfer-ledger:query、erp:stock-transfer-out:query 或 erp:stock-transfer-in:query 后查看对应只读数据。"
    />
  </BusinessReportShell>
</template>

<style scoped>
.stock-transfer-ledger-report-tabs {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.stock-transfer-ledger-report-tabs :deep(.ant-tabs-content-holder),
.stock-transfer-ledger-report-tabs :deep(.ant-tabs-content),
.stock-transfer-ledger-report-tabs :deep(.ant-tabs-tabpane) {
  min-height: 0;
}

.stock-transfer-ledger-report-tabs :deep(.ant-tabs-content-holder) {
  flex: 1 1 auto;
}

.stock-transfer-ledger-report-tabs :deep(.ant-tabs-content),
.stock-transfer-ledger-report-tabs :deep(.ant-tabs-tabpane-active) {
  height: 100%;
}

.stock-transfer-ledger-grid-shell {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  position: relative;
  height: 100%;
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
:deep(.vxe-grid--form-wrapper .ant-btn) {
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper .ant-input-affix-wrapper) {
  min-height: 28px;
  padding: 2px 8px;
}

:deep(.vxe-grid--form-wrapper .ant-select-single),
:deep(.vxe-grid--form-wrapper .ant-picker) {
  height: 28px;
}

:deep(.vxe-grid--form-wrapper .ant-select-single .ant-select-selector) {
  height: 28px;
  padding: 0 8px;
}

:deep(.vxe-grid--form-wrapper .ant-select-single .ant-select-selection-item),
:deep(
  .vxe-grid--form-wrapper .ant-select-single .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:global(.transfer-ledger-search-select-dropdown .ant-select-item),
:global(.transfer-ledger-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper .ant-picker) {
  padding: 2px 8px;
}

:deep(.vxe-grid--form-wrapper .ant-btn),
:deep(.vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
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

:deep(.vxe-body--row) {
  cursor: pointer;
}

:deep(.vxe-body--column.col--fixed) {
  cursor: default;
}

.ledger-link {
  display: block;
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  color: hsl(var(--primary));
  font: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.ledger-link:hover,
.ledger-link:focus-visible {
  text-decoration: underline;
}

.ledger-link--danger {
  color: #cf1322;
  font-weight: 600;
}

:deep(.ledger-abnormal-row .vxe-body--column) {
  background-color: rgb(254 242 242) !important;
}

:deep(.ledger-abnormal-row.row--hover .vxe-body--column) {
  background-color: rgb(254 226 226) !important;
}

:deep(.vxe-grid--bottom-wrapper) {
  position: sticky;
  z-index: 4;
  bottom: 36px;
  background: hsl(var(--card));
}

:deep(.vxe-grid--pager-wrapper) {
  position: sticky;
  z-index: 5;
  bottom: 0;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

.ledger-bottom-summary {
  display: flex;
  min-height: 40px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px 20px;
  border-top: 1px solid hsl(var(--border));
  padding: 5px 8px;
  font-size: 12px;
  line-height: 18px;
}

.ledger-row-legend,
.ledger-total-line {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
}

.ledger-row-legend {
  margin-right: auto;
  color: hsl(var(--muted-foreground));
}

.ledger-row-legend__swatch {
  width: 18px;
  height: 10px;
  background: rgb(254 242 242);
  border: 1px solid rgb(252 165 165);
  border-radius: 2px;
}

.ledger-total--danger {
  color: #cf1322;
  font-weight: 600;
}

@media (max-width: 768px) {
  .ledger-bottom-summary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
