<script lang="ts" setup>import { financeValue } from '#/views/erp/finance/utils/finance-decimal';

import { financeListMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import { provideFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpReceivableAccountApi } from '#/api/erp/finance/receivable/account';
import type { PageParam } from '@vben/request';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Button } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getBaseDataSimpleList } from '#/api/erp/base';
import {
  exportReceivableAccount,
  getReceivableAccountExportFields,
  getReceivableAccountPage,
  getReceivableAccountSummary,
} from '#/api/erp/finance/receivable/account';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import FinanceListQuerySummary from '#/views/erp/finance/components/FinanceListQuerySummary.vue';
import { fitFinanceDocumentListColumnsToWidth } from '#/views/erp/finance/utils/document-list-table';
import { useFinanceQuerySummary } from '#/views/erp/finance/utils/use-finance-query-summary';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import { withErpKeywordSearchSchema } from '#/views/erp/utils/form-defaults';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import {
  RECEIVABLE_ACCOUNT_SORT_FIELD_MAP,
  useGridColumns,
  useGridFormSchema,
} from './data';
import DetailDrawer from './modules/detail-drawer.vue';

defineOptions({ name: 'ErpReceivableAccount' });

const props = withDefaults(
  defineProps<{
    candidateFocusHighlight?: boolean;
    reportMode?: boolean;
  }>(),
  {
    candidateFocusHighlight: true,
    reportMode: false,
  },
);
const { candidateSchema, candidatePagerConfig } = provideFinanceCandidateFocus(
  computed(() => props.candidateFocusHighlight),
);

const route = useRoute();
const { hasAccessByCodes } = useAccess();
const receivableAccountGridShellRef = ref<HTMLElement>();
const currentCustomerId = ref<number>();
const currentDeptId = ref<number>();
const currentDeptUnassigned = ref(false);
const currentCustomerName = ref('');
const currentDeptName = ref('');
const currentApproveTime = ref<string[]>([]);
const currentDetailType =
  ref<ErpReceivableAccountApi.ReceivableDrilldownType>('BALANCE');
const currentDetailLabel = ref('余额');
const pageRows = ref<ErpReceivableAccountApi.ReceivableAccount[]>([]);
const querySummaryState = useFinanceQuerySummary((params, signal) =>
  getReceivableAccountSummary(params, signal),
);
const areaNameMap = ref<Record<number, string>>({});
const customerTypeNameMap = ref<Record<number, string>>({});
const routeNameMap = ref<Record<number, string>>({});
let displayOptionsLoadedPromise: null | Promise<void> = null;

const [Drawer, drawerApi] = useVbenDrawer({
  title: '应收明细',
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
      loadFields: () => getReceivableAccountExportFields('overview'),
      moduleKey: 'erp_finance_receivable_account',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  const data = await exportReceivableAccount({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '应收账款概览.xls', source: data });
}

const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  if (!value) return [];
  return [
    {
      key: 'comboCount',
      label: '组合数',
      value: `${value.comboCount ?? 0}`,
    },
    {
      key: 'customerCount',
      label: '客户数',
      value: `${value.customerCount ?? 0}`,
    },
    {
      key: 'receivableBalance',
      label: '余额',
      value: erpPriceInputFormatter(financeValue(value.receivableBalance ?? 0)),
    },
    {
      key: 'openingReceivableBalance',
      label: '此前应收',
      value: erpPriceInputFormatter(
        financeValue(value.openingReceivableBalance ?? 0),
      ),
    },
    {
      key: 'preAdvanceAmount',
      label: '未核销预收金额',
      value: erpPriceInputFormatter(financeValue(value.preAdvanceAmount ?? 0)),
    },
    {
      key: 'receiptAmount',
      label: '明细收款',
      value: erpPriceInputFormatter(financeValue(value.receiptAmount ?? 0)),
    },
    {
      key: 'miscReceivableAmount',
      label: '其他应收款',
      value: erpPriceInputFormatter(financeValue(value.miscReceivableAmount ?? 0)),
    },
    {
      key: 'creditBalance',
      label: '信用余额',
      value: erpPriceInputFormatter(financeValue(value.creditBalance ?? 0)),
    },
  ];
});

const RECEIVABLE_DRILLDOWN_MAP: Record<
  string,
  {
    label: string;
    permission?: string;
    type: ErpReceivableAccountApi.ReceivableDrilldownType;
  }
> = {
  miscReceivableAmount: {
    label: '其他应收款',
    permission: 'erp:receivable-misc:query',
    type: 'MISC_RECEIVABLE',
  },
  openingReceivableBalance: { label: '此前应收', type: 'OPENING_BALANCE' },
  receiptAmount: { label: '明细收款', type: 'RECEIPT' },
  receivableBalance: { label: '余额', type: 'BALANCE' },
  saleOutAmount: { label: '销售增加', type: 'SALE_OUT' },
  saleReturnAmount: { label: '退货增加', type: 'SALE_RETURN' },
};

const CUSTOMER_TYPE_VALUE_MAP: Record<string, number> = {
  car_owner: 1,
  customer_supplier: 4,
  dealer: 7,
  repair_factory: 2,
  store: 6,
  supplier: 5,
  terminal_customer: 3,
};

const routeCustomerId = computed(() =>
  parseQueryNumber(route.query.customerId),
);
const routeCustomerName = computed(() =>
  parseQueryString(route.query.customerName),
);
const routeOpenDetail = computed(() => route.query.openDetail === '1');

function parseQueryNumber(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return undefined;
  }
  const numberValue = Number(rawValue);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function parseQueryString(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return typeof rawValue === 'string' ? rawValue : '';
}

function buildGridSearchSchema() {
  const customerId = routeCustomerId.value;
  return withErpKeywordSearchSchema(
    useGridFormSchema().map((field) =>
      field.fieldName === 'customerId' && customerId
        ? { ...field, defaultValue: customerId }
        : field,
    ),
  );
}

async function loadDisplayOptions() {
  if (displayOptionsLoadedPromise) return displayOptionsLoadedPromise;
  displayOptionsLoadedPromise = (async () => {
    const [areas, customerTypes, routes] = await Promise.all([
      getBaseDataSimpleList('sales_area'),
      getBaseDataSimpleList('customer_type'),
      getBaseDataSimpleList('route'),
    ]);
    areaNameMap.value = Object.fromEntries(
      (areas || []).map((item) => [item.id, item.name]),
    );
    customerTypeNameMap.value = Object.fromEntries(
      (customerTypes || [])
        .map((item) => [CUSTOMER_TYPE_VALUE_MAP[item.code || ''], item.name])
        .filter(([value]) => value !== undefined),
    );
    routeNameMap.value = Object.fromEntries(
      (routes || []).map((item) => [item.id, item.name]),
    );
  })();
  return displayOptionsLoadedPromise;
}

function formatMappedName(
  value: null | number | undefined,
  names: Record<number, string>,
) {
  if (value === undefined || value === null) return '-';
  return names[value] || String(value);
}

function isUnassignedDept(deptId: null | number | undefined) {
  return deptId === undefined || deptId === null;
}

function mapReceivableDisplayFields(
  row: ErpReceivableAccountApi.ReceivableAccount,
) {
  const deptKey =
    row.deptKey || (isUnassignedDept(row.deptId) ? 'none' : String(row.deptId));
  return {
    ...row,
    accountKey: row.accountKey || `${row.customerId || 'none'}:${deptKey}`,
    deptKey,
    areaName: formatMappedName(row.areaId, areaNameMap.value),
    customerTypeName: formatMappedName(
      row.customerType,
      customerTypeNameMap.value,
    ),
    deptName:
      row.deptName || (isUnassignedDept(row.deptId) ? '未归属部门' : '-'),
    routeName: formatMappedName(row.routeId, routeNameMap.value),
  };
}

async function handleOpenDetail(
  row: ErpReceivableAccountApi.ReceivableAccount,
  detailType: ErpReceivableAccountApi.ReceivableDrilldownType = 'BALANCE',
  detailLabel = '余额',
) {
  currentCustomerId.value = row.customerId;
  currentDeptId.value = row.deptId;
  currentDeptUnassigned.value = isUnassignedDept(row.deptId);
  currentCustomerName.value = row.customerName || '';
  currentDeptName.value =
    row.deptName || (isUnassignedDept(row.deptId) ? '未归属部门' : '');
  const formValues = await gridApi.formApi.getValues();
  currentApproveTime.value = formValues.approveTime || [];
  currentDetailType.value = detailType;
  currentDetailLabel.value = detailLabel;
  const titleParts = [row.customerName, row.deptName || '未归属部门'].filter(
    Boolean,
  );
  drawerApi
    .setState({
      title:
        titleParts.length > 0
          ? `${detailLabel}明细 - ${titleParts.join(' / ')}`
          : `${detailLabel}明细`,
    })
    .open();
}

function handleCellClick({
  column,
  row,
}: {
  column: any;
  row: ErpReceivableAccountApi.ReceivableAccount;
}) {
  if (
    !column?.field ||
    column?.type === 'checkbox' ||
    column?.slots?.default === 'actions'
  ) {
    return;
  }
  const drilldown = RECEIVABLE_DRILLDOWN_MAP[column.field];
  if (!drilldown || !canOpenDrilldown(drilldown)) return;
  handleOpenDetail(row, drilldown.type, drilldown.label);
}

function canOpenDrilldown(
  drilldown: (typeof RECEIVABLE_DRILLDOWN_MAP)[string],
) {
  return !drilldown.permission || hasAccessByCodes([drilldown.permission]);
}

function getDrilldownByField(field?: string) {
  return field ? RECEIVABLE_DRILLDOWN_MAP[field] : undefined;
}

function canOpenDrilldownField(field?: string) {
  const drilldown = getDrilldownByField(field);
  return Boolean(drilldown && canOpenDrilldown(drilldown));
}

function handleAmountDrilldown(
  row: ErpReceivableAccountApi.ReceivableAccount,
  field?: string,
) {
  const drilldown = getDrilldownByField(field);
  if (!drilldown || !canOpenDrilldown(drilldown)) return;
  void handleOpenDetail(row, drilldown.type, drilldown.label);
}

function getRowAmount(
  row: ErpReceivableAccountApi.ReceivableAccount,
  field?: string,
) {
  const value = field
    ? row[field as keyof ErpReceivableAccountApi.ReceivableAccount]
    : 0;
  return erpPriceInputFormatter(Number(value ?? 0));
}

function handleRefresh() {
  querySummaryState.invalidate();
  return gridApi.query();
}

async function applyRouteCustomerFilter(customerId?: number) {
  if (!customerId) return;
  await gridApi.formApi.setValues({ customerId }, false);
  void gridApi.formApi.submitForm();
}

function openRouteCustomerReceivableDetail() {
  const customerId = routeCustomerId.value;
  if (!customerId || !routeOpenDetail.value) return;
  currentCustomerId.value = customerId;
  currentDeptId.value = undefined;
  currentDeptUnassigned.value = false;
  currentCustomerName.value = routeCustomerName.value;
  currentDeptName.value = '';
  currentApproveTime.value = [];
  currentDetailType.value = 'BALANCE';
  currentDetailLabel.value = '余额';
  drawerApi
    .setState({
      title: currentCustomerName.value
        ? `余额明细 - ${currentCustomerName.value}`
        : '余额明细',
    })
    .open();
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(RECEIVABLE_ACCOUNT_SORT_FIELD_MAP);

function buildGridColumns(
  rows: ErpReceivableAccountApi.ReceivableAccount[] = pageRows.value,
) {
  return fitFinanceDocumentListColumnsToWidth(
    useGridColumns(rows) || [],
    receivableAccountGridShellRef.value?.clientWidth ?? 0,
  );
}

async function queryReceivableAccountPage(
  params: PageParam & Record<string, any>,
) {
  const approvalParams = { ...params, dateBasis: 'approveTime' };
  const summaryChanged = querySummaryState.prepare(approvalParams);
  let pageRequestFailed = false;
  const result = await getReceivableAccountPage(approvalParams).catch(
    (error) => {
      pageRequestFailed = true;
      querySummaryState.cancelPending();
      if (pageRows.value.length > 0) {
        return {
          list: pageRows.value,
          total:
            gridApi.grid?.getProxyInfo?.()?.pager?.total ??
            pageRows.value.length,
        };
      }
      throw error;
    },
  );
  if (!pageRequestFailed)
    void querySummaryState.load(approvalParams, summaryChanged);
  return result;
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 76 },
    schema: candidateSchema(buildGridSearchSchema()),
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
    id: 'erp-finance-receivable-account-list-v2',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 10 },
    scrollY: { enabled: true, gt: 10 },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          await loadDisplayOptions();
          const result = await queryReceivableAccountPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            ...buildSortParams(sorts, sort),
          });
          const rows = (result.list || []).map((row) =>
            mapReceivableDisplayFields(row),
          );
          pageRows.value = rows;
          void gridApi.grid?.reloadColumn?.(buildGridColumns(rows));
          return { ...result, list: rows };
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
      keyField: 'accountKey',
      isHover: true,
      isCurrent: true,
    },
    toolbarConfig: {
      custom: true,
      refresh: { queryMethod: handleRefresh },
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ErpReceivableAccountApi.ReceivableAccount>,
  gridEvents: {
    sortChange: handleSortChange,
    cellClick: handleCellClick,
  },
});

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpReceivableAccountApi.ReceivableAccount>({
    errorMessage: 'Error occurred while refreshing receivable account page:',
    gridApi,
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: async (params) => {
      await loadDisplayOptions();
      querySummaryState.invalidate();
      const result = await queryReceivableAccountPage(params);
      const rows = (result.list || []).map((row) =>
        mapReceivableDisplayFields(row),
      );
      return { ...result, list: rows };
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

onMounted(() => {
  window.addEventListener('resize', handleGridResize);
  openRouteCustomerReceivableDetail();
});
onBeforeUnmount(() => window.removeEventListener('resize', handleGridResize));

watch(
  () => [
    route.query.customerId,
    route.query.customerName,
    route.query.openDetail,
  ],
  () => {
    void applyRouteCustomerFilter(routeCustomerId.value);
    openRouteCustomerReceivableDetail();
  },
);
</script>

<template>
  <Page auto-content-height>
    <Drawer class="w-[85vw]">
      <DetailDrawer
        :customer-id="currentCustomerId"
        :customer-name="currentCustomerName"
        :dept-id="currentDeptId"
        :dept-name="currentDeptName"
        :dept-unassigned="currentDeptUnassigned"
        :approve-time="currentApproveTime"
        date-basis="approveTime"
        :detail-label="currentDetailLabel"
        :detail-type="currentDetailType"
        :readonly="props.reportMode"
        :report-mode="props.reportMode"
        @writeoff-success="handleRefresh"
      />
    </Drawer>
    <ExportFieldModal @confirm="handleExportConfirm" />
    <div
      ref="receivableAccountGridShellRef"
      class="receivable-account-grid-shell"
    >
      <Grid
        table-title="应收账户列表"
        @keydown.enter.capture="handleSearchEnter"
      >
        <template #toolbar-actions>
          <Button
            v-if="hasAccessByCodes(['erp:receivable-account:query'])"
            @click="handleExport"
          >
            导出
          </Button>
        </template>
        <template #customerName="{ row }">
          <span
            class="receivable-customer-name"
            :title="row.customerName || ''"
          >
            {{ row.customerName || '-' }}
          </span>
        </template>
        <template #amountDrilldown="{ row, column }">
          <button
            v-if="canOpenDrilldownField(column.field)"
            type="button"
            class="receivable-amount-link"
            :aria-label="`查看${row.customerName || '客户'}${getDrilldownByField(column.field)?.label || ''}明细`"
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
                auth: ['erp:receivable-account:query'],
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
        class="receivable-account-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.receivable-account-grid-shell {
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

:global(.receivable-account-search-select-dropdown .ant-select-item),
:global(.receivable-account-search-select-dropdown .ant-empty-description) {
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

.receivable-customer-name,
.receivable-amount-link {
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

.receivable-amount-link {
  color: hsl(var(--primary));
  cursor: pointer;
}

.receivable-amount-link:hover,
.receivable-amount-link:focus-visible {
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
