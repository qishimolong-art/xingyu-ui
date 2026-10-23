<script lang="ts" setup>
import type { StockRecordReportScene } from '../data';
import type { StockRecordQueryParams } from '../stock-record-query';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpStockRecordApi } from '#/api/erp/stock/record';

import { onMounted, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { DICT_TYPE } from '@vben/constants';
import { getDictLabel } from '@vben/hooks';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportStockRecordReport,
  getStockRecordReportPage,
  getStockRecordSummary,
} from '#/api/erp/stock/record';
import { useFieldPermission } from '#/composables/useFieldPermission';
import AssemblyOrderForm from '#/views/erp/assembly/order/modules/form.vue';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import PurchaseInForm from '#/views/erp/purchase/in/modules/form.vue';
import PurchasePriceAdjustForm from '#/views/erp/purchase/priceadjust/modules/form.vue';
import PurchaseReturnForm from '#/views/erp/purchase/return/modules/form.vue';
import SaleOutForm from '#/views/erp/sale/out/modules/form.vue';
import SalePriceAdjustForm from '#/views/erp/sale/priceadjust/modules/form.vue';
import SaleReturnForm from '#/views/erp/sale/return/modules/form.vue';
import StockCheckForm from '#/views/erp/stock/check/modules/form.vue';
import StockInForm from '#/views/erp/stock/in/modules/form.vue';
import StockMoveForm from '#/views/erp/stock/move/modules/form.vue';
import StockOutForm from '#/views/erp/stock/out/modules/form.vue';
import { queueFocusStockKeywordSearchInput } from '#/views/erp/stock/utils/keyword-search-focus';
import { stockNatural } from '#/views/erp/stock/utils/stock-decimal';
import WarehouseMoveForm from '#/views/erp/stock/warehouse-move/modules/form.vue';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { useReportGridColumns, useReportGridFormSchema } from '../data';
import {
  buildStockRecordQueryParams,
  cleanStockRecordQueryParams,
} from '../stock-record-query';

const props = withDefaults(
  defineProps<{
    fixedHeight?: boolean;
    initialParams?: StockRecordQueryParams;
    pageSize?: number;
    scene?: StockRecordReportScene;
    tableTitle?: string;
  }>(),
  {
    fixedHeight: false,
    initialParams: () => ({}),
    pageSize: 10,
    scene: 'default',
    tableTitle: '库存流水明细账',
  },
);

const stockRecordGridId =
  props.scene === 'stockDetailModal'
    ? 'erp-stock-record-detail-list-v1'
    : 'erp-stock-record-list-v1';

const stockRecordSortFieldMap: Record<string, string> = {
  approveTime: 'approveTime',
  bizDate: 'bizDate',
  bizType: 'bizType',
  bizNo: 'bizNo',
  productCode: 'productCode',
  productName: 'productName',
  warehouseName: 'warehouseName',
  deptName: 'deptName',
  inCount: 'inCount',
  inUnitPrice: 'inUnitPrice',
  inAmount: 'inAmount',
  outCount: 'outCount',
  outUnitPrice: 'outUnitPrice',
  outAmount: 'outAmount',
  totalCount: 'totalCount',
  costPrice: 'costPrice',
  costAmount: 'costAmount',
};
const stockRecordDefaultSort =
  props.scene === 'stockDetailModal'
    ? ({ field: 'approveTime', order: 'desc' } as const)
    : null;
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(stockRecordSortFieldMap, stockRecordDefaultSort);
const productPricePermission = useFieldPermission('erp_product');
const getProductPriceHiddenFields = () =>
  productPricePermission.hiddenFields.value;

const summary = ref<ErpStockRecordApi.StockRecordSummary>({
  balanceAmount: 0,
  balanceCount: 0,
  totalInCount: 0,
  totalInAmount: 0,
  totalOutCount: 0,
  totalOutAmount: 0,
  recordCount: 0,
});
const stockRecordGridShellRef = ref<HTMLElement>();

let currentInitialParams = cleanQueryParams(props.initialParams);
let shouldUseInitialParams = Object.keys(currentInitialParams).length > 0;

const [StockInModal, stockInModalApi] = useVbenModal({
  connectedComponent: StockInForm,
  destroyOnClose: true,
});
const [StockOutModal, stockOutModalApi] = useVbenModal({
  connectedComponent: StockOutForm,
  destroyOnClose: true,
});
const [StockMoveModal, stockMoveModalApi] = useVbenModal({
  connectedComponent: StockMoveForm,
  destroyOnClose: true,
});
const [WarehouseMoveModal, warehouseMoveModalApi] = useVbenModal({
  connectedComponent: WarehouseMoveForm,
  destroyOnClose: true,
});
const [StockCheckModal, stockCheckModalApi] = useVbenModal({
  connectedComponent: StockCheckForm,
  destroyOnClose: true,
});
const [PurchaseInModal, purchaseInModalApi] = useVbenModal({
  connectedComponent: PurchaseInForm,
  destroyOnClose: true,
});
const [PurchaseReturnModal, purchaseReturnModalApi] = useVbenModal({
  connectedComponent: PurchaseReturnForm,
  destroyOnClose: true,
});
const [PurchasePriceAdjustModal, purchasePriceAdjustModalApi] = useVbenModal({
  connectedComponent: PurchasePriceAdjustForm,
  destroyOnClose: true,
});
const [SaleOutModal, saleOutModalApi] = useVbenModal({
  connectedComponent: SaleOutForm,
  destroyOnClose: true,
});
const [SaleReturnModal, saleReturnModalApi] = useVbenModal({
  connectedComponent: SaleReturnForm,
  destroyOnClose: true,
});
const [SalePriceAdjustModal, salePriceAdjustModalApi] = useVbenModal({
  connectedComponent: SalePriceAdjustForm,
  destroyOnClose: true,
});
const [AssemblyOrderModal, assemblyOrderModalApi] = useVbenModal({
  connectedComponent: AssemblyOrderForm,
  destroyOnClose: true,
});

function cleanQueryParams(params: StockRecordQueryParams = {}) {
  return cleanStockRecordQueryParams(params);
}

function buildQueryParams(
  formValues: StockRecordQueryParams = {},
  options: { useInitialParams?: boolean } = {},
) {
  return {
    ...buildStockRecordQueryParams(formValues, currentInitialParams, {
      shouldUseInitialParams:
        options.useInitialParams && shouldUseInitialParams,
    }),
    ...(props.scene === 'stockDetailModal' ? { dateBasis: 'approveTime' } : {}),
  };
}

async function getCurrentQueryParams() {
  const values = await gridApi.formApi.getValues();
  return {
    ...buildQueryParams(values),
    ...buildSortParams(),
  };
}

async function handleExport() {
  const params = await getCurrentQueryParams();
  const data = await exportStockRecordReport(params);
  downloadFileFromBlobPart({
    fileName: '库存流水明细账.xlsx',
    source: data,
  });
}

function formatQuantity(value: unknown, _precision?: number) {
  return stockNatural(value as null | number | string | undefined);
}

function formatAmount(value: unknown, _precision?: number) {
  return stockNatural(value as null | number | string | undefined);
}

function isStockRecordSummaryAmountHidden() {
  return (
    productPricePermission.isHidden('lastPurchasePrice') ||
    productPricePermission.isHidden('purchasePrice') ||
    productPricePermission.isHidden('salePrice')
  );
}

function formatSummaryAmount(value?: number) {
  return isStockRecordSummaryAmountHidden() ? '****' : formatAmount(value);
}

function getStockRecordBizTypeLabel(bizType?: number) {
  if (bizType === undefined || bizType === null) {
    return '-';
  }
  if (Number(bizType) === 34) {
    return '仓库移货入库';
  }
  if (Number(bizType) === 35) {
    return '仓库移货出库';
  }
  return (
    getDictLabel(DICT_TYPE.ERP_STOCK_RECORD_BIZ_TYPE, bizType) ||
    String(bizType)
  );
}

function handleBizDetail(row: ErpStockRecordApi.StockRecordReport) {
  if (!row.bizId) {
    message.warning('当前流水缺少业务编号，无法查看源单据');
    return;
  }
  const modalData = { type: 'detail', id: row.bizId };
  const bizType = Number(row.bizType);
  if ([10, 11].includes(bizType)) {
    stockInModalApi.setData(modalData).open();
    return;
  }
  if ([20, 21].includes(bizType)) {
    stockOutModalApi.setData(modalData).open();
    return;
  }
  if ([30, 31, 32, 33].includes(bizType)) {
    stockMoveModalApi.setData(modalData).open();
    return;
  }
  if ([34, 35].includes(bizType)) {
    warehouseMoveModalApi.setData(modalData).open();
    return;
  }
  if ([40, 41, 42, 43].includes(bizType)) {
    stockCheckModalApi.setData(modalData).open();
    return;
  }
  if ([50, 51].includes(bizType)) {
    saleOutModalApi.setData({ id: row.bizId }).open();
    return;
  }
  if ([60, 61].includes(bizType)) {
    saleReturnModalApi.setData(modalData).open();
    return;
  }
  if ([70, 71].includes(bizType)) {
    purchaseInModalApi.setData(modalData).open();
    return;
  }
  if ([80, 81].includes(bizType)) {
    purchaseReturnModalApi.setData(modalData).open();
    return;
  }
  if ([90, 91].includes(bizType)) {
    purchasePriceAdjustModalApi.setData(modalData).open();
    return;
  }
  if (bizType === 92) {
    salePriceAdjustModalApi.setData(modalData).open();
    return;
  }
  if ([100, 101, 102, 103].includes(bizType)) {
    assemblyOrderModalApi.setData({ type: 'detail', id: row.bizId }).open();
    return;
  }
  message.warning('当前业务类型暂不支持查看源单据');
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

async function applyInitialParams(params: StockRecordQueryParams = {}) {
  currentInitialParams = cleanQueryParams(params);
  shouldUseInitialParams = Object.keys(currentInitialParams).length > 0;
  await gridApi.formApi.setValues({
    productId: undefined,
    warehouseId: undefined,
    bizId: undefined,
    bizItemId: undefined,
    bizNo: undefined,
    bizTypes: undefined,
    approveTime: undefined,
    deptId: undefined,
    keyword: undefined,
    productKeyword: undefined,
    ...currentInitialParams,
  });
  gridApi.formApi.setLatestSubmissionValues(currentInitialParams);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useReportGridFormSchema(props.scene),
  },
  gridOptions: {
    columns: useReportGridColumns(getProductPriceHiddenFields, props.scene),
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    height: props.fixedHeight ? '100%' : 'auto',
    id: stockRecordGridId,
    keepSource: true,
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
    pagerConfig: {
      pageSize: props.pageSize,
      pageSizes: [10, 20, 50, 100],
    },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const queryParams = buildQueryParams(formValues, {
            useInitialParams: true,
          });
          shouldUseInitialParams = false;
          const [pageResult, summaryResult] = await Promise.all([
            getStockRecordReportPage({
              pageNo: page.currentPage,
              pageSize: page.pageSize,
              ...queryParams,
              ...buildSortParams(sorts, sort),
            }),
            getStockRecordSummary(queryParams),
          ]);
          summary.value = summaryResult;
          return pageResult;
        },
        querySuccess: () => {
          void restoreSortState(gridApi);
        },
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
      keyField: 'id',
      isHover: true,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
      custom: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ErpStockRecordApi.StockRecordReport>,
  gridEvents: {
    sortChange: handleSortChange,
  },
});

watch(
  productPricePermission.hiddenFields,
  async () => {
    const columns =
      useReportGridColumns(getProductPriceHiddenFields, props.scene) || [];
    gridApi.setGridOptions({ columns });
    await gridApi.grid.reloadColumn(columns);
  },
  { deep: true },
);

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpStockRecordApi.StockRecordReport>({
    gridApi,
    getParams: async () => ({
      ...buildQueryParams(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: async (params) => {
      const {
        orderDirection: _orderDirection,
        orderField: _orderField,
        pageNo: _pageNo,
        pageSize: _pageSize,
        ...summaryParams
      } = params as Record<string, unknown>;
      const [pageResult, summaryResult] = await Promise.all([
        getStockRecordReportPage(params),
        getStockRecordSummary(summaryParams),
      ]);
      summary.value = summaryResult;
      return pageResult;
    },
    onSuccess: () => restoreSortState(gridApi),
    onAfterRefresh: () => {
      queueFocusStockKeywordSearchInput(stockRecordGridShellRef);
    },
    onFirstActivated: () => {
      queueFocusStockKeywordSearchInput(stockRecordGridShellRef);
    },
    errorMessage: 'Error occurred while refreshing stock record page:',
  });

async function reload(params: StockRecordQueryParams = props.initialParams) {
  await applyInitialParams(params);
  gridApi.query();
}

onMounted(() => {
  void reload();
  queueFocusStockKeywordSearchInput(stockRecordGridShellRef);
});

watch(
  () => props.initialParams,
  (params) => {
    void reload(params);
  },
  { deep: true },
);

defineExpose({ reload });
</script>

<template>
  <StockInModal />
  <StockOutModal />
  <StockMoveModal />
  <WarehouseMoveModal />
  <StockCheckModal />
  <PurchaseInModal />
  <PurchaseReturnModal />
  <PurchasePriceAdjustModal />
  <SaleOutModal />
  <SaleReturnModal />
  <SalePriceAdjustModal />
  <AssemblyOrderModal />

  <div
    class="stock-record-tab"
    :class="{ 'flex h-full min-h-0 flex-col': fixedHeight }"
  >
    <div
      ref="stockRecordGridShellRef"
      class="stock-record-grid-shell"
      :class="{ 'min-h-0 flex-1': fixedHeight }"
    >
      <Grid
        :class="{ 'h-full': fixedHeight }"
        :table-title="tableTitle"
        @keydown.enter.capture="handleSearchEnter"
      >
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:stock-record:export'],
                onClick: handleExport,
              },
            ]"
          />
        </template>

        <template #bizType="{ row }">
          <Tag
            v-if="row.bizType !== undefined"
            :color="row.bizType % 10 === 0 ? 'blue' : 'default'"
          >
            {{ getStockRecordBizTypeLabel(row.bizType) }}
          </Tag>
          <span v-else>-</span>
        </template>

        <template #bizNo="{ row }">
          <a
            v-if="row.bizNo && row.bizId"
            class="text-primary cursor-pointer"
            @click.stop="handleBizDetail(row)"
          >
            {{ row.bizNo }}
          </a>
          <span v-else>{{ row.bizNo || '-' }}</span>
        </template>
      </Grid>
      <ErpActivationRefreshMask
        v-if="activationRefreshMaskVisible"
        class="stock-record-activation-mask"
      />
    </div>

    <div class="stock-record-summary">
      <span class="font-medium text-foreground">合计：</span>
      <span>
        总入库数：<span class="text-primary font-medium">
          {{ formatQuantity(summary.totalInCount) }}
        </span>
      </span>
      <span>
        总入库金额：<span class="text-primary font-medium">
          {{ formatSummaryAmount(summary.totalInAmount) }}
        </span>
      </span>
      <span>
        总出库数：<span class="text-warning font-medium">
          {{ formatQuantity(summary.totalOutCount) }}
        </span>
      </span>
      <span>
        总出库成本金额：<span class="text-warning font-medium">
          {{ formatSummaryAmount(summary.totalOutAmount) }}
        </span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.stock-record-tab {
  min-height: 0;
  font-size: 12px;
}

.stock-record-grid-shell {
  position: relative;
}

.stock-record-grid-shell:not(.flex-1) {
  height: auto;
  min-height: 0;
}

:deep(.vxe-table--render-default),
:deep(.vxe-grid--form-wrapper),
:deep(.vxe-toolbar),
:deep(.vxe-pager) {
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper label),
:deep(.vxe-grid--form-wrapper .ant-input),
:deep(.vxe-grid--form-wrapper .ant-select),
:deep(.vxe-grid--form-wrapper .ant-picker),
:deep(.vxe-grid--form-wrapper .ant-btn),
:deep(.vxe-toolbar .ant-btn) {
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper .ant-input-affix-wrapper),
:deep(.vxe-grid--form-wrapper .ant-picker),
:deep(.vxe-grid--form-wrapper .ant-select-single),
:deep(.vxe-grid--form-wrapper .ant-btn),
:deep(.vxe-toolbar .ant-btn) {
  min-height: 28px;
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

:global(.stock-record-search-select-dropdown .ant-select-item),
:global(.stock-record-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

.stock-record-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 20px;
  min-height: 40px;
  margin-top: 8px;
  padding: 8px 12px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}
</style>
