<script lang="ts" setup>import { financeValue } from '#/views/erp/finance/utils/finance-decimal';

import { financeListMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import { provideFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPayableAccountApi } from '#/api/erp/finance/payable/account';
import type { PageParam } from '@vben/request';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Button } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportPayableAccount,
  getPayableAccountExportFields,
  getPayableAccountPage,
  getPayableAccountSummary,
} from '#/api/erp/finance/payable/account';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import FinanceListQuerySummary from '#/views/erp/finance/components/FinanceListQuerySummary.vue';
import { fitFinanceDocumentListColumnsToWidth } from '#/views/erp/finance/utils/document-list-table';
import { useFinanceQuerySummary } from '#/views/erp/finance/utils/use-finance-query-summary';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import { withErpKeywordSearchSchema } from '#/views/erp/utils/form-defaults';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { useGridColumns, useGridFormSchema } from './data';
import DetailDrawer from './modules/detail-drawer.vue';
const props = withDefaults(
  defineProps<{ candidateFocusHighlight?: boolean }>(),
  { candidateFocusHighlight: true },
);
const { candidateSchema, candidatePagerConfig } = provideFinanceCandidateFocus(
  computed(() => props.candidateFocusHighlight),
);

defineOptions({ name: 'ErpPayableAccount' });

const { hasAccessByCodes } = useAccess();
const payableAccountGridShellRef = ref<HTMLElement>();
const currentSupplierId = ref<number>();
const currentSupplierName = ref('');
const currentDeptName = ref('');
const currentApproveTime = ref<string[]>([]);
const currentDetailType =
  ref<ErpPayableAccountApi.PayableDrilldownType>('BALANCE');
const currentDetailLabel = ref('应付余额');
const pageRows = ref<ErpPayableAccountApi.PayableAccount[]>([]);
const querySummaryState = useFinanceQuerySummary((params, signal) =>
  getPayableAccountSummary(params, signal),
);

const [Drawer, drawerApi] = useVbenDrawer({
  title: '应付明细',
  footer: false,
  destroyOnClose: true,
});

const [ExportFieldModal, exportFieldModalApi] = useVbenModal({
  connectedComponent: ExportFieldModalComponent,
  destroyOnClose: true,
});
const pendingExportParams = ref<Record<string, any>>({});

async function handleExport() {
  pendingExportParams.value = {
    ...(await gridApi.formApi.getValues()),
    ...buildSortParams(),
    dateBasis: 'approveTime',
  };
  exportFieldModalApi
    .setData({
      loadFields: () => getPayableAccountExportFields('overview'),
      moduleKey: 'erp_finance_payable_account',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  const data = await exportPayableAccount({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '应付账款概览.xls', source: data });
}

const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  if (!value) return [];
  return [
    {
      key: 'supplierCount',
      label: '供应商数',
      value: `${value.supplierCount ?? 0}`,
    },
    {
      key: 'purchaseInAmount',
      label: '采购金额',
      value: erpPriceInputFormatter(financeValue(value.purchaseInAmount ?? 0)),
    },
    {
      key: 'paymentAmount',
      label: '付款金额',
      value: erpPriceInputFormatter(financeValue(value.paymentAmount ?? 0)),
    },
    {
      key: 'balance',
      label: '应付金额',
      value: erpPriceInputFormatter(financeValue(value.balance ?? 0)),
    },
    {
      key: 'openingPayableBalance',
      label: '此前应付',
      value: erpPriceInputFormatter(financeValue(value.openingPayableBalance ?? 0)),
    },
    {
      key: 'miscPayableAmount',
      label: '其他应付款',
      value: erpPriceInputFormatter(financeValue(value.miscPayableAmount ?? 0)),
    },
    {
      key: 'unclearedPrepayment',
      label: '未核销预付',
      value: erpPriceInputFormatter(Number(value.unclearedPrepayment ?? 0)),
    },
  ];
});

const PAYABLE_DRILLDOWN_MAP: Record<
  string,
  {
    label: string;
    permission?: string;
    type: ErpPayableAccountApi.PayableDrilldownType;
  }
> = {
  balance: { label: '应付余额', type: 'BALANCE' },
  miscPayableAmount: {
    label: '其他应付款',
    permission: 'erp:payable-misc:query',
    type: 'MISC_PAYABLE',
  },
  openingPayableBalance: { label: '此前应付', type: 'OPENING_BALANCE' },
  otherPayableAmount: { label: '应付调账', type: 'PAYABLE_ADJUST' },
  paymentAmount: { label: '付款', type: 'PAYMENT' },
  priceAdjustAmount: { label: '采购调价', type: 'PRICE_ADJUST' },
  purchaseInAmount: { label: '采购入库', type: 'PURCHASE_IN' },
  purchaseReturnAmount: { label: '采购退货', type: 'PURCHASE_RETURN' },
  writeOffAmount: { label: '核销', type: 'WRITE_OFF' },
};

async function handleOpenDetail(
  row: ErpPayableAccountApi.PayableAccount,
  detailType: ErpPayableAccountApi.PayableDrilldownType = 'BALANCE',
  detailLabel = '应付余额',
) {
  currentSupplierId.value = row.supplierId;
  currentSupplierName.value = row.supplierName || '';
  currentDeptName.value = row.deptName || '';
  const formValues = await gridApi.formApi.getValues();
  currentApproveTime.value = formValues.approveTime || [];
  currentDetailType.value = detailType;
  currentDetailLabel.value = detailLabel;
  drawerApi
    .setState({
      title: row.supplierName
        ? `${detailLabel}明细 - ${row.supplierName}`
        : `${detailLabel}明细`,
    })
    .open();
}

function handleCellClick({
  column,
  row,
}: {
  column: any;
  row: ErpPayableAccountApi.PayableAccount;
}) {
  if (
    !column?.field ||
    column?.type === 'checkbox' ||
    column?.slots?.default === 'actions'
  ) {
    return;
  }
  const drilldown = PAYABLE_DRILLDOWN_MAP[column.field];
  if (!drilldown || !canOpenDrilldown(drilldown)) return;
  handleOpenDetail(row, drilldown.type, drilldown.label);
}

function canOpenDrilldown(drilldown: (typeof PAYABLE_DRILLDOWN_MAP)[string]) {
  return !drilldown.permission || hasAccessByCodes([drilldown.permission]);
}

function getDrilldownByField(field?: string) {
  return field ? PAYABLE_DRILLDOWN_MAP[field] : undefined;
}

function canOpenDrilldownField(field?: string) {
  const drilldown = getDrilldownByField(field);
  return Boolean(drilldown && canOpenDrilldown(drilldown));
}

function handleAmountDrilldown(
  row: ErpPayableAccountApi.PayableAccount,
  field?: string,
) {
  const drilldown = getDrilldownByField(field);
  if (!drilldown || !canOpenDrilldown(drilldown)) return;
  void handleOpenDetail(row, drilldown.type, drilldown.label);
}

function getRowAmount(
  row: ErpPayableAccountApi.PayableAccount,
  field?: string,
) {
  const value = field
    ? row[field as keyof ErpPayableAccountApi.PayableAccount]
    : 0;
  return erpPriceInputFormatter(Number(value ?? 0));
}

function handleRefresh() {
  querySummaryState.invalidate();
  return gridApi.query();
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

const payableAccountSortFieldMap = {
  supplierName: 'supplierName',
  balance: 'balance',
  openingPayableBalance: 'openingPayableBalance',
  miscPayableAmount: 'miscPayableAmount',
  paymentAmount: 'paymentAmount',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(payableAccountSortFieldMap);

function buildGridColumns(
  rows: ErpPayableAccountApi.PayableAccount[] = pageRows.value,
) {
  return fitFinanceDocumentListColumnsToWidth(
    (useGridColumns(rows) || []).map((column) =>
      column.field && column.field in payableAccountSortFieldMap
        ? { ...column, sortable: true }
        : column,
    ),
    payableAccountGridShellRef.value?.clientWidth ?? 0,
  );
}

async function queryPayableAccountPage(
  params: PageParam & Record<string, any>,
) {
  const approvalParams = { ...params, dateBasis: 'approveTime' };
  const summaryChanged = querySummaryState.prepare(approvalParams);
  let pageRequestFailed = false;
  const result = await getPayableAccountPage(approvalParams).catch((error) => {
    pageRequestFailed = true;
    querySummaryState.cancelPending();
    if (pageRows.value.length > 0) {
      return {
        list: pageRows.value,
        total:
          gridApi.grid?.getProxyInfo?.()?.pager?.total ?? pageRows.value.length,
      };
    }
    throw error;
  });
  if (!pageRequestFailed)
    void querySummaryState.load(approvalParams, summaryChanged);
  return result;
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 76 },
    schema: candidateSchema(withErpKeywordSearchSchema(useGridFormSchema())),
    collapsed: true,
    collapsedRows: 1,
  },
  gridOptions: {
    pagerConfig: candidatePagerConfig(),
    columns: buildGridColumns([]),
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    fit: false,
    height: 'auto',
    id: 'erp-finance-payable-account-list-v2',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 10 },
    scrollY: { enabled: true, gt: 10 },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const result = await queryPayableAccountPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            ...buildSortParams(sorts, sort),
          });
          pageRows.value = result.list || [];
          void gridApi.grid?.reloadColumn?.(buildGridColumns(pageRows.value));
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
    rowConfig: {
      keyField: 'supplierId',
      isHover: true,
      isCurrent: true,
    },
    toolbarConfig: {
      custom: true,
      refresh: { queryMethod: handleRefresh },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ErpPayableAccountApi.PayableAccount>,
  gridEvents: {
    sortChange: handleSortChange,
    cellClick: handleCellClick,
  },
});

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpPayableAccountApi.PayableAccount>({
    gridApi,
    errorMessage: 'Error occurred while refreshing payable account page:',
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: (params) => {
      querySummaryState.invalidate();
      return queryPayableAccountPage(params);
    },
    onSuccess: (rows) => {
      pageRows.value = rows;
      void gridApi.grid?.reloadColumn?.(buildGridColumns(rows));
      void restoreSortState(gridApi);
    },
  });

function handleGridResize() {
  void gridApi.grid?.reloadColumn?.(buildGridColumns(pageRows.value));
}

onMounted(() => window.addEventListener('resize', handleGridResize));
onBeforeUnmount(() => window.removeEventListener('resize', handleGridResize));
</script>

<template>
  <Page auto-content-height>
    <Drawer class="w-[85vw]">
      <DetailDrawer
        :supplier-id="currentSupplierId"
        :supplier-name="currentSupplierName"
        :dept-name="currentDeptName"
        :approve-time="currentApproveTime"
        date-basis="approveTime"
        :detail-label="currentDetailLabel"
        :detail-type="currentDetailType"
        @writeoff-success="handleRefresh"
      />
    </Drawer>
    <ExportFieldModal @confirm="handleExportConfirm" />
    <div ref="payableAccountGridShellRef" class="payable-account-grid-shell">
      <Grid
        table-title="应付账户列表"
        @keydown.enter.capture="handleSearchEnter"
      >
        <template #toolbar-actions>
          <Button
            v-if="hasAccessByCodes(['erp:payable-account:query'])"
            @click="handleExport"
          >
            导出
          </Button>
        </template>
        <template #supplierName="{ row }">
          <span class="payable-supplier-name" :title="row.supplierName || ''">
            {{ row.supplierName || '-' }}
          </span>
        </template>
        <template #amountDrilldown="{ row, column }">
          <button
            v-if="canOpenDrilldownField(column.field)"
            type="button"
            class="payable-amount-link"
            :aria-label="`查看${row.supplierName || '供应商'}${getDrilldownByField(column.field)?.label || ''}明细`"
            @click.stop="handleAmountDrilldown(row, column.field)"
          >
            {{ getRowAmount(row, column.field) }}
          </button>
          <span v-else>{{ getRowAmount(row, column.field) }}</span>
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: '明细',
                type: 'link',
                icon: ACTION_ICON.VIEW,
                auth: ['erp:payable-account:query'],
                onClick: handleOpenDetail.bind(null, row),
              },
            ]"
          />
        </template>
        <template #bottom>
          <FinanceListQuerySummary
            :error="querySummaryState.error.value"
            :items="querySummaryItems"
            :loading="querySummaryState.loading.value"
            @retry="querySummaryState.retry"
          />
        </template>
      </Grid>
      <ErpActivationRefreshMask
        v-if="activationRefreshMaskVisible"
        class="payable-account-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.payable-account-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
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

:global(.payable-account-search-select-dropdown .ant-select-item),
:global(.payable-account-search-select-dropdown .ant-empty-description) {
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

.payable-supplier-name,
.payable-amount-link {
  display: block;
  width: 100%;
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font: inherit;
  text-align: center;
  white-space: nowrap;
  background: transparent;
  border: 0;
}

.payable-amount-link {
  color: hsl(var(--primary));
  cursor: pointer;
}

.payable-amount-link:hover,
.payable-amount-link:focus-visible {
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
</style>
