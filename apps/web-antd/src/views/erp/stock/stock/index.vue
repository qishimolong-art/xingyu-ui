<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpFieldConfigApi } from '#/api/erp/config/field';
import type { ErpStockApi } from '#/api/erp/stock/stock';

import { computed, nextTick, onMounted, ref, watch } from 'vue';

import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart, formatDateTime } from '@vben/utils';

import { message, Popover, Switch, Table } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportStock,
  getStockPage,
  getStockSummary,
  updateStockShelf,
} from '#/api/erp/stock/stock';
import { useFieldPermission } from '#/composables/useFieldPermission';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import ProductForm from '#/views/erp/product/product/modules/form.vue';
import { getProductCustomFieldConfigs } from '#/views/erp/product/product/utils/custom-fields';
import StockListQuerySummary from '#/views/erp/stock/components/StockListQuerySummary.vue';
import { applyStockDocumentListColumnCustomization } from '#/views/erp/stock/utils/document-list-table';
import { queueFocusStockKeywordSearchInput } from '#/views/erp/stock/utils/keyword-search-focus';
import { stockListNumber } from '#/views/erp/stock/utils/stock-decimal';
import { useStockQuerySummary } from '#/views/erp/stock/utils/use-stock-query-summary';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { useGridColumns, useGridFormSchema } from './data';
import InTransitDetailModal from './modules/in-transit-detail-modal.vue';
import OccupiedDetailModal from './modules/occupied-detail-modal.vue';
import PendingInDetailModal from './modules/pending-in-detail-modal.vue';
import StockAdjustModal from './modules/stock-adjust-form.vue';
import StockFieldEditModal from './modules/stock-field-edit-form.vue';
import StockRecordModal from './modules/stock-record-modal.vue';

/** 库存管理 */
defineOptions({ name: 'ErpStock' });

const editableStockFields = [
  'shelf',
  'purchasePrice',
  'costPrice',
  'costAmount',
] as const;
type EditableStockField = (typeof editableStockFields)[number];
const productPricePermission = useFieldPermission('erp_product');
const productCustomFields = ref<ErpFieldConfigApi.FieldConfig[]>([]);
const stockSortFieldMap: Record<string, string> = {
  warehouseName: 'warehouseId',
  deptName: 'deptId',
  productName: 'productName',
  unitName: 'unitName',
  categoryName: 'categoryName',
  shelf: 'shelf',
  count: 'count',
  batchNoSummary: 'batchNo',
  productCode: 'productCode',
  drawingNo: 'drawingNo',
  standard: 'standard',
  featureCode: 'featureCode',
  vehicleModel: 'vehicleModel',
  brand: 'brand',
  originPlace: 'originPlace',
  purchasePrice: 'purchasePrice',
  occupiedCount: 'occupiedCount',
  pendingInCount: 'pendingInCount',
  inTransitCount: 'inTransitCount',
  stockMin: 'stockMin',
  stockMax: 'stockMax',
  stockStandard: 'stockStandard',
  costPrice: 'costPrice',
  costAmount: 'costAmount',
  productPurchasePrice: 'productPurchasePrice',
  salePrice: 'salePrice',
  minPrice: 'minPrice',
  referencePrice: 'referencePrice',
  retailPrice: 'retailPrice',
  lastPurchasePrice: 'lastPurchasePrice',
  grossProfitRate: 'grossProfitRate',
  backupPrice1: 'backupPrice1',
  wholesalePrice: 'wholesalePrice',
  sharePrice: 'sharePrice',
  currentPrice: 'currentPrice',
  currentPriceAmount: 'currentPriceAmount',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(stockSortFieldMap);

const checkedStockRows = ref<ErpStockApi.Stock[]>([]);
const currentPageRows = ref<ErpStockApi.Stock[]>([]);
const stockListGridShellRef = ref<HTMLElement>();
const showBatchNo = ref(false);

function formatNumber(value?: null | number | string, _fractionDigits = 2) {
  return stockListNumber(value);
}

function formatRows(value?: number) {
  return `${Number(value ?? 0).toFixed(0)}`;
}

function isCostAmountHidden() {
  return productPricePermission.isHidden('lastPurchasePrice');
}

function isCurrentPriceAmountHidden() {
  return productPricePermission.isHidden('backupPrice1');
}

function formatSummaryPrice(value?: null | number | string, hidden = false) {
  return hidden ? '****' : formatNumber(value);
}

const querySummaryState = useStockQuerySummary((params, signal) =>
  getStockSummary({ ...params, decimalMode: 'string' }, signal),
);
const summaryItems = computed(() => {
  const stockSummary = querySummaryState.summary.value;
  if (!stockSummary) return [];
  return [
    {
      key: 'totalStockCount',
      label: '总库存数',
      value: formatNumber(stockSummary.totalStockCount),
    },
    {
      key: 'totalCostAmount',
      label: '总成本金额',
      value: formatSummaryPrice(
        stockSummary.totalCostAmount,
        isCostAmountHidden(),
      ),
    },
    {
      key: 'totalCurrentPriceAmount',
      label: '总当前售价金额',
      value: formatSummaryPrice(
        stockSummary.totalCurrentPriceAmount,
        isCurrentPriceAmountHidden(),
      ),
    },
    {
      key: 'totalPendingInCount',
      label: '总未入数',
      value: formatNumber(stockSummary.totalPendingInCount),
    },
    {
      key: 'totalOccupiedCount',
      label: '总占用数',
      value: formatNumber(stockSummary.totalOccupiedCount),
    },
    {
      key: 'totalInTransitCount',
      label: '总在途数',
      value: formatNumber(stockSummary.totalInTransitCount),
    },
    {
      key: 'totalWeight',
      label: '总重量',
      value: `${formatNumber(stockSummary.totalWeight, 0)}Kg`,
    },
    {
      key: 'totalRows',
      label: '总行数',
      value: formatRows(stockSummary.totalRows),
    },
  ];
});

function handleRefresh() {
  querySummaryState.invalidate();
  gridApi.query();
}

/** 导出表格 */
async function handleExport() {
  const data = await exportStock({
    ...(await gridApi.formApi.getValues()),
    ...buildSortParams(),
    showBatchNo: showBatchNo.value,
  });
  downloadFileFromBlobPart({ fileName: '库存查询.xls', source: data });
}

/** 库存调整弹窗 */
const [AdjustModal, adjustModalApi] = useVbenModal({
  connectedComponent: StockAdjustModal,
  destroyOnClose: true,
});

/** 库存字段编辑弹窗 */
const [FieldEditModal, fieldEditModalApi] = useVbenModal({
  connectedComponent: StockFieldEditModal,
  destroyOnClose: true,
});

const [ProductModal, productModalApi] = useVbenModal({
  connectedComponent: ProductForm,
  destroyOnClose: true,
});

const [InTransitModal, inTransitModalApi] = useVbenModal({
  connectedComponent: InTransitDetailModal,
  destroyOnClose: true,
});

const [PendingInModal, pendingInModalApi] = useVbenModal({
  connectedComponent: PendingInDetailModal,
  destroyOnClose: true,
});

const [OccupiedModal, occupiedModalApi] = useVbenModal({
  connectedComponent: OccupiedDetailModal,
  destroyOnClose: true,
});

const [StockRecordModalComp, stockRecordModalApi] = useVbenModal({
  connectedComponent: StockRecordModal,
  destroyOnClose: true,
});

function isBatchDetailRow(row: ErpStockApi.Stock) {
  return row.batchRow === true;
}

function isStockRowReadonly(row: ErpStockApi.Stock) {
  return isBatchDetailRow(row);
}

function isEditableStockFieldHidden(field: EditableStockField) {
  if (field === 'shelf') {
    return false;
  }
  if (field === 'purchasePrice') {
    return (
      productPricePermission.isHidden('purchasePrice') ||
      productPricePermission.isHidden('lastPurchasePrice')
    );
  }
  return productPricePermission.isHidden('lastPurchasePrice');
}

function canEditStockField(row: ErpStockApi.Stock, field: EditableStockField) {
  return !isStockRowReadonly(row) && !isEditableStockFieldHidden(field);
}

function formatEditableStockField(
  row: ErpStockApi.Stock,
  field: EditableStockField,
) {
  if (isEditableStockFieldHidden(field)) {
    return '****';
  }
  return row[field] ?? '-';
}

/** 打开库存调整弹窗 */
function handleAdjustStock(row: ErpStockApi.Stock) {
  if (isBatchDetailRow(row)) {
    message.warning('批次明细行仅支持查看，不可调整库存');
    return;
  }
  adjustModalApi.setData(row).open();
}

/** 打开库存字段编辑弹窗 */
function handleEditStockField(
  row: ErpStockApi.Stock,
  field: EditableStockField,
) {
  if (isBatchDetailRow(row)) {
    message.warning('批次明细行仅支持查看，不可编辑库存字段');
    return;
  }
  if (!row.id) {
    message.warning('当前库存行缺少库存编号，无法修改');
    return;
  }
  if (isEditableStockFieldHidden(field)) {
    message.warning('当前用户没有该价格字段权限，不能修改');
    return;
  }
  fieldEditModalApi.setData({ row, field }).open();
}

/** 查看库存流水明细 */
function handleViewDetail(row: ErpStockApi.Stock) {
  if (!row.productId || !row.warehouseId) {
    message.warning('当前库存行缺少商品或仓库信息，无法查看库存流水明细');
    return;
  }
  stockRecordModalApi.setData(row).open();
}

/** 打开商品信息弹窗 */
function handleViewProduct(row: ErpStockApi.Stock) {
  if (!row.productId) return;
  productModalApi.setData({ type: 'detail', id: row.productId }).open();
}

function handleViewInTransitDetail(row: ErpStockApi.Stock) {
  if (!row.productId || !row.warehouseId) {
    message.warning('当前库存行缺少商品或仓库信息，无法查看在途数量');
    return;
  }
  inTransitModalApi.setData(row).open();
}

function handleViewPendingInDetail(row: ErpStockApi.Stock) {
  if (!row.productId || !row.warehouseId) {
    message.warning('当前库存行缺少商品或仓库信息，无法查看未入数量');
    return;
  }
  pendingInModalApi.setData(row).open();
}

function handleViewOccupiedDetail(row: ErpStockApi.Stock) {
  if (!row.productId || !row.warehouseId) {
    message.warning('当前库存行缺少商品或仓库信息，无法查看占用数量');
    return;
  }
  occupiedModalApi.setData(row).open();
}

function handleCellClick({
  column,
  row,
}: {
  column: any;
  row: ErpStockApi.Stock;
}) {
  if (
    column?.type === 'checkbox' ||
    column?.field === 'actions' ||
    column?.slots?.default === 'actions' ||
    column?.field === 'count' ||
    column?.field === 'productName' ||
    column?.field === 'batchNoSummary' ||
    column?.field === 'occupiedCount' ||
    column?.field === 'pendingInCount' ||
    column?.field === 'inTransitCount' ||
    editableStockFields.includes(column?.field as EditableStockField)
  ) {
    return;
  }
  handleViewDetail(row);
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

async function reloadStockListColumns(
  rows = currentPageRows.value,
  hiddenFields = productPricePermission.hiddenFields.value,
  customFields = productCustomFields.value,
) {
  const columns = applyStockDocumentListColumnCustomization(
    (useGridColumns(hiddenFields, customFields, rows) || []) as any[],
    gridApi.grid?.getFullColumns?.() ?? [],
    72,
  );
  gridApi.setGridOptions({ columns });
  await gridApi.grid?.reloadColumn?.(columns as any[]);
  await gridApi.grid?.recalculate?.(true);
}

async function handleStockColumnCustom({ type }: { type?: string }) {
  if (type !== 'confirm' && type !== 'reset') return;
  await nextTick();
  await reloadStockListColumns();
  await restoreSortState(gridApi);
}

function handleRowCheckboxChange({
  records,
}: {
  records: ErpStockApi.Stock[];
}) {
  checkedStockRows.value = records.filter((row) => !isStockRowReadonly(row));
}

function handleShowBatchNoChange() {
  checkedStockRows.value = [];
  void gridApi.reload();
}

/** 批量修改货架 */
async function handleBatchUpdateShelf() {
  const rows = gridApi.grid.getCheckboxRecords() as ErpStockApi.Stock[];
  const editableRows = (rows || []).filter((row) => !isStockRowReadonly(row));
  if (editableRows.length === 0) {
    message.warning('请先勾选要修改的库存');
    return;
  }
  const stockIds = [
    ...new Set(editableRows.map((row) => row.id).filter(Boolean)),
  ] as number[];
  if (stockIds.length === 0) {
    message.warning('选中行未包含有效的库存编号');
    return;
  }
  // oxlint-disable-next-line no-alert -- 批量修改货架沿用快捷录入交互
  const shelf = window.prompt(
    `请输入新的货架号，共 ${stockIds.length} 条库存，留空将清空货架号：`,
    '',
  );
  if (shelf === null) {
    return;
  }
  await updateStockShelf(stockIds, shelf.trim());
  message.success('修改成功');
  handleRefresh();
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 84 },
    schema: useGridFormSchema(),
    collapsed: true,
    collapsedRows: 2,
  },
  gridOptions: {
    columns: useGridColumns(
      productPricePermission.hiddenFields.value,
      productCustomFields.value,
      currentPageRows.value,
    ),
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    autoResize: true,
    fit: true,
    height: 'auto',
    id: 'erp-stock-list-v1',
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
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const summaryChanged = querySummaryState.prepare(formValues);
          const queryParams = {
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            ...buildSortParams(sorts, sort),
            showBatchNo: showBatchNo.value,
          };
          try {
            const result = await getStockPage({
              ...queryParams,
              decimalMode: 'string',
            });
            currentPageRows.value = result.list || [];
            await reloadStockListColumns();
            void querySummaryState.load(formValues, summaryChanged);
            return result;
          } catch (error) {
            querySummaryState.cancelPending();
            throw error;
          }
        },
        querySuccess: () => {
          checkedStockRows.value = [];
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
      keyField: 'rowKey',
      isHover: true,
      isCurrent: true,
    },
    checkboxConfig: {
      checkMethod: ({ row }: { row: ErpStockApi.Stock }) =>
        !isStockRowReadonly(row),
    },
    toolbarConfig: {
      refresh: true,
      search: true,
      custom: true,
    },
  } as VxeTableGridOptions<ErpStockApi.Stock>,
  gridEvents: {
    sortChange: handleSortChange,
    cellClick: handleCellClick,
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
    custom: handleStockColumnCustom,
  },
});

watch(
  [productPricePermission.hiddenFields, productCustomFields],
  async () => {
    await reloadStockListColumns();
  },
  { deep: true },
);

getProductCustomFieldConfigs()
  .then((fields) => {
    productCustomFields.value = fields;
  })
  .catch((error) => {
    console.error('Error occurred while loading product price fields:', error);
  });

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpStockApi.Stock>({
    gridApi,
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
      showBatchNo: showBatchNo.value,
    }),
    queryPage: async (params) => {
      return getStockPage({ ...params, decimalMode: 'string' });
    },
    onSuccess: async (rows) => {
      currentPageRows.value = rows;
      checkedStockRows.value = [];
      await reloadStockListColumns(rows);
      gridApi.grid?.clearCheckboxRow?.();
      gridApi.grid?.clearCheckboxReserve?.();
      await restoreSortState(gridApi);
    },
    onAfterRefresh: () => {
      querySummaryState.invalidate();
      void gridApi.formApi
        .getValues()
        .then((params) => querySummaryState.load(params));
      queueFocusStockKeywordSearchInput(stockListGridShellRef);
    },
    onFirstActivated: () => {
      queueFocusStockKeywordSearchInput(stockListGridShellRef);
    },
    errorMessage: 'Error occurred while refreshing stock page:',
  });

onMounted(() => {
  queueFocusStockKeywordSearchInput(stockListGridShellRef);
});

function formatBatchNoCount(value?: number) {
  return value ?? '-';
}
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【库存】库存查询、库存流水"
        url="https://doc.iocoder.cn/erp/stock/"
      />
    </template>

    <AdjustModal @success="handleRefresh" />
    <FieldEditModal @success="handleRefresh" />
    <ProductModal />
    <InTransitModal />
    <PendingInModal />
    <OccupiedModal />
    <StockRecordModalComp />
    <div ref="stockListGridShellRef" class="stock-list-grid-shell">
      <Grid
        table-title="库存查询列表"
        @keydown.enter.capture="handleSearchEnter"
      >
        <template #toolbar-tools>
          <div class="stock-batch-toggle">
            <span>展示批次</span>
            <Switch
              v-model:checked="showBatchNo"
              size="small"
              @change="handleShowBatchNoChange"
            />
          </div>
          <TableAction
            :actions="[
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:stock:export'],
                onClick: handleExport,
              },
              {
                label: '批量修改',
                type: 'primary',
                auth: ['erp:stock:update'],
                ifShow: () => checkedStockRows.length > 0,
                onClick: handleBatchUpdateShelf,
              },
            ]"
          />
        </template>
        <template #productName="{ row }">
          <a
            class="text-primary cursor-pointer"
            @click.stop="handleViewProduct(row)"
          >
            {{ row.productName ?? '-' }}
          </a>
        </template>
        <template #count="{ row }">
          <a
            class="text-primary cursor-pointer font-medium"
            @click.stop="
              isStockRowReadonly(row)
                ? handleViewDetail(row)
                : handleAdjustStock(row)
            "
          >
            {{ row.count ?? '-' }}
          </a>
        </template>
        <template #shelf="{ row }">
          <a
            v-if="!isStockRowReadonly(row)"
            class="text-primary cursor-pointer font-medium"
            @click.stop="handleEditStockField(row, 'shelf')"
          >
            {{ row.shelf || '-' }}
          </a>
          <span v-else>{{ row.shelf || '-' }}</span>
        </template>
        <template #purchasePrice="{ row }">
          <a
            v-if="canEditStockField(row, 'purchasePrice')"
            class="text-primary cursor-pointer font-medium"
            @click.stop="handleEditStockField(row, 'purchasePrice')"
          >
            {{ formatEditableStockField(row, 'purchasePrice') }}
          </a>
          <span v-else>{{
            formatEditableStockField(row, 'purchasePrice')
          }}</span>
        </template>
        <template #occupiedCount="{ row }">
          <a
            class="text-primary cursor-pointer font-medium"
            @click.stop="handleViewOccupiedDetail(row)"
          >
            {{ row.occupiedCount ?? '-' }}
          </a>
        </template>
        <template #pendingInCount="{ row }">
          <a
            class="text-primary cursor-pointer font-medium"
            @click.stop="handleViewPendingInDetail(row)"
          >
            {{ row.pendingInCount ?? '-' }}
          </a>
        </template>
        <template #inTransitCount="{ row }">
          <a
            class="text-primary cursor-pointer font-medium"
            @click.stop="handleViewInTransitDetail(row)"
          >
            {{ row.inTransitCount ?? '-' }}
          </a>
        </template>
        <template #costPrice="{ row }">
          <a
            v-if="canEditStockField(row, 'costPrice')"
            class="text-primary cursor-pointer font-medium"
            @click.stop="handleEditStockField(row, 'costPrice')"
          >
            {{ formatEditableStockField(row, 'costPrice') }}
          </a>
          <span v-else>{{ formatEditableStockField(row, 'costPrice') }}</span>
        </template>
        <template #costAmount="{ row }">
          <a
            v-if="canEditStockField(row, 'costAmount')"
            class="text-primary cursor-pointer font-medium"
            @click.stop="handleEditStockField(row, 'costAmount')"
          >
            {{ formatEditableStockField(row, 'costAmount') }}
          </a>
          <span v-else>{{ formatEditableStockField(row, 'costAmount') }}</span>
        </template>
        <template #batchNoSummary="{ row }">
          <a
            v-if="showBatchNo && row.batchRow"
            class="text-primary cursor-pointer"
            @click.stop="handleViewDetail(row)"
          >
            {{ row.batchNo || '未指定批次' }}
          </a>
          <span v-else-if="showBatchNo || !row.batchNoEnabled">-</span>
          <span v-else-if="!row.batchNoList?.length" class="text-gray-400">
            暂无批次库存
          </span>
          <Popover v-else placement="left" trigger="click">
            <template #content>
              <Table
                :columns="[
                  { title: '批次号', dataIndex: 'batchNo', width: 140 },
                  {
                    title: '可用库存',
                    dataIndex: 'availableCount',
                    width: 100,
                  },
                  {
                    title: '首次入库时间',
                    dataIndex: 'firstInTime',
                    width: 170,
                  },
                ]"
                :data-source="row.batchNoList"
                :pagination="false"
                :row-key="(record) => record.batchNo"
                size="small"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.dataIndex === 'availableCount'">
                    {{ formatBatchNoCount(record.availableCount) }}
                  </template>
                  <template v-if="column.dataIndex === 'firstInTime'">
                    {{
                      record.firstInTime
                        ? formatDateTime(record.firstInTime)
                        : '-'
                    }}
                  </template>
                </template>
              </Table>
            </template>
            <a class="text-primary cursor-pointer" @click.stop>
              {{ row.batchNoSummary || `${row.batchNoCount ?? 0} 个批次` }}
            </a>
          </Popover>
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: '查看明细',
                type: 'link',
                onClick: () => handleViewDetail(row),
              },
              {
                label: '编辑库存',
                type: 'link',
                auth: ['erp:stock:update'],
                ifShow: !isStockRowReadonly(row),
                onClick: () => handleAdjustStock(row),
              },
            ]"
          />
        </template>
        <template #bottom>
          <StockListQuerySummary
            :error="querySummaryState.error.value"
            :items="summaryItems"
            :loading="querySummaryState.loading.value"
            @retry="querySummaryState.retry"
          />
        </template>
      </Grid>
      <ErpActivationRefreshMask
        v-if="activationRefreshMaskVisible"
        class="stock-list-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.stock-list-grid-shell {
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
:deep(.vxe-grid--form-wrapper .ant-input-number),
:deep(.vxe-grid--form-wrapper .ant-input-number-input),
:deep(.vxe-grid--form-wrapper .ant-select),
:deep(.vxe-grid--form-wrapper .ant-checkbox-wrapper),
:deep(.vxe-grid--form-wrapper .ant-btn),
:deep(.vxe-grid--form-wrapper .vben-link) {
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper label) {
  line-height: 20px;
}

:deep(.vxe-grid--form-wrapper .ant-input-affix-wrapper) {
  min-height: 28px;
  padding: 2px 8px;
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper .ant-input-affix-wrapper .ant-input) {
  line-height: 22px;
}

:deep(.vxe-grid--form-wrapper .ant-input-number),
:deep(.vxe-grid--form-wrapper .ant-select-single) {
  height: 28px;
}

:deep(.vxe-grid--form-wrapper .ant-input-number-input) {
  height: 26px;
  padding: 0 8px;
}

:deep(.vxe-grid--form-wrapper .ant-select-single .ant-select-selector) {
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
}

:deep(
  .vxe-grid--form-wrapper .ant-select-single .ant-select-selection-search-input
) {
  height: 26px;
}

:deep(.vxe-grid--form-wrapper .ant-select-single .ant-select-selection-item),
:deep(
  .vxe-grid--form-wrapper .ant-select-single .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:global(.stock-search-select-dropdown .ant-select-item),
:global(.stock-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper .ant-btn),
:deep(.vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.vxe-toolbar .vxe-tool--item-wrapper) {
  font-size: 12px;
}

:deep(.vxe-toolbar .table-actions .ant-btn .anticon) {
  font-size: 12px;
}

:deep(.vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
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

:deep(.vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
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

.stock-batch-toggle {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 55%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}
</style>
