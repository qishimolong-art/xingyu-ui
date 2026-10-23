<script lang="ts" setup>
import { provide as provideStockDecimalMode } from 'vue';
provideStockDecimalMode('stock-decimal-context', true);
import type { TransferInItemSortOrder } from './transfer-in-item-sort';

import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpStockTransferInApi } from '#/api/erp/stock/transfer-in';

import { computed, nextTick, onBeforeUnmount, provide, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Pagination } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getStockTransferInItemPage,
  getStockTransferInWithOptions,
} from '#/api/erp/stock/transfer-in';
import {
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import DetailLinkInput from '#/views/erp/components/DetailLinkInput.vue';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import ItemPriceReferenceOverlay from '#/views/erp/components/ItemPriceReferenceOverlay.vue';
import StockDocumentFormLayout from '#/views/erp/stock/components/StockDocumentFormLayout.vue';
import StockDocumentSummary from '#/views/erp/stock/components/StockDocumentSummary.vue';
import StockItemDetailActions from '#/views/erp/stock/components/StockItemDetailActions.vue';
import { useFormSchema } from '#/views/erp/stock/move/data';
import { useStockDocumentColumns } from '#/views/erp/stock/utils/document-columns';
import {
  buildStockDocumentDetailFormValues,
  buildStockDocumentFormSchema,
  hydrateStockDocumentFormSelectLabels,
} from '#/views/erp/stock/utils/document-form-ui';
import { prepareStockDocumentItemColumns } from '#/views/erp/stock/utils/document-item-table';
import SourceDocumentModal from '#/views/erp/stock/utils/source-document-modal.vue';
import { canNavigateStockSourceDocument } from '#/views/erp/stock/utils/source-document-navigation';
import { CANDIDATE_FOCUS_KEY } from '#/views/erp/utils/candidate-focus';
import { useItemPriceReferenceShortcut } from '#/views/erp/utils/price-reference';

import StockMoveForm from '../../move/modules/form.vue';
import { useFormItemColumns } from '../data';
import { isTransferInItemSortField } from './transfer-in-item-sort';

provide(CANDIDATE_FOCUS_KEY, ref(true));

const FIELD_PERMISSION_MODULE = 'erp_stock_transfer_in';
const DEFAULT_ITEM_PAGE_SIZE = 10;
const ITEM_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];
const ITEM_TABLE_VISIBLE_ROWS = 10;
const ITEM_TABLE_HEADER_HEIGHT = 40;
const ITEM_TABLE_ROW_HEIGHT = 40;
const ITEM_TABLE_HEIGHT =
  ITEM_TABLE_HEADER_HEIGHT + ITEM_TABLE_ROW_HEIGHT * ITEM_TABLE_VISIBLE_ROWS;
const formData = ref<ErpStockTransferInApi.StockTransferIn>();
const detailLoading = ref(false);
const detailLoadError = ref('');
const itemPageLoading = ref(false);
const itemPageState = ref({
  orderDirection: undefined as 'asc' | 'desc' | undefined,
  orderField: undefined as string | undefined,
  pageNo: 1,
  pageSize: DEFAULT_ITEM_PAGE_SIZE,
  total: 0,
});
let detailLoadSequence = 0;
const activeItemSort = ref<null | {
  field: string;
  order: TransferInItemSortOrder;
}>(null);
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const detailActions = ref<InstanceType<typeof StockItemDetailActions>>();
const activeItemRow = ref<any>();
const renderedItemRows = ref<any[]>([]);
const sourceDocumentModalRef = ref<InstanceType<typeof SourceDocumentModal>>();
const {
  itemTableWrapRef,
  priceReferenceOpen,
  startPriceReferenceShortcutListening,
  stopPriceReferenceShortcutListening,
} = useItemPriceReferenceShortcut({
  autoStart: false,
  isBlocked: () => Boolean(detailActions.value?.isBlockedForPrice()),
});
const canOpenSourceOut = computed(() =>
  Boolean(formData.value?.relatedMoveId && formData.value?.relatedMoveNo),
);
const canOpenSourceDocument = computed(() =>
  Boolean(
    formData.value?.sourceNo &&
    canNavigateStockSourceDocument(
      formData.value?.sourceType,
      formData.value?.sourceId,
    ),
  ),
);

const [SourceOutModal, sourceOutModalApi] = useVbenModal({
  connectedComponent: StockMoveForm,
  destroyOnClose: true,
});

function handleOpenSourceOut() {
  if (!formData.value?.relatedMoveId) return;
  sourceOutModalApi
    .setData({ type: 'detail', id: formData.value.relatedMoveId })
    .open();
}

function handleOpenSourceDocument() {
  sourceDocumentModalRef.value?.open(
    formData.value?.sourceType,
    formData.value?.sourceId,
  );
}

const getTitle = computed(() => '调拨入库单详情');
const documentSummaryEntries = computed(() => [
  {
    format: 'count' as const,
    hidden: isFieldHidden(hiddenFields.value, 'item_count'),
    label: '数量',
    value: formData.value?.totalCount ?? '0',
  },
  {
    format: 'price' as const,
    hidden:
      isFieldHidden(hiddenFields.value, 'totalPrice') ||
      isFieldHidden(hiddenFields.value, 'item_totalPrice'),
    label: '金额',
    value: formData.value?.totalPrice ?? '0',
  },
  {
    format: 'weight' as const,
    hidden: isFieldHidden(hiddenFields.value, 'item_totalWeight'),
    label: '总重',
    value: formData.value?.totalWeight ?? '0',
  },
]);

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    labelClass: '!justify-start !text-left',
    labelWidth: 82,
  },
  compact: true,
  wrapperClass: 'stock-document-basic-grid grid-cols-4',
  layout: 'horizontal',
  schema: buildStockDocumentFormSchema(
    useFormSchema('detail', hiddenFields.value).map((item) => {
      if (item.fieldName === 'no') {
        return { ...item, label: '调拨入库单号' };
      }
      if (item.fieldName === 'moveTime') {
        return { ...item, label: '入库日期' };
      }
      return item;
    }),
    {
      data: formData.value,
      formType: 'detail',
    },
  ),
  showDefaultActions: false,
});

const itemColumns = useStockDocumentColumns({
  columns: () =>
    buildItemColumns().filter((column: any) => column.visible !== false),
  grid: () => gridApi,
  wrapper: () => itemTableWrapRef.value,
});
const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: buildItemColumns(),
    customConfig: {
      restoreStore: itemColumns.restoreStore,
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    data: [],
    fit: false,
    height: ITEM_TABLE_HEIGHT,
    id: 'erp-stock-transfer-in-item-list-v2',
    autoResize: true,
    border: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: {
      enabled: true,
      gt: 8,
    },
    rowConfig: {
      keyField: 'id',
      isHover: true,
    },
    pagerConfig: {
      enabled: false,
    },
    toolbarConfig: {
      custom: true,
      enabled: true,
      refresh: {
        queryMethod: () => handleItemToolbarRefresh(),
      },
      slots: { buttons: 'toolbar-buttons', tools: 'toolbar-tools' },
      zoom: true,
    },
    sortConfig: {
      remote: true,
      multiple: false,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
      allowBtn: false,
    },
  } as VxeTableGridOptions<ErpStockTransferInApi.StockTransferInItem>,
  gridEvents: {
    cellClick: ({ row }: any) => {
      activeItemRow.value = row;
    },
    resizableChange: itemColumns.queue,
    zoom: itemColumns.queue,
    custom: itemColumns.custom,
    sortChange: handleItemSortChange,
  },
});

function getDisplayedItems() {
  const items = formData.value?.items ?? [];
  return [...items];
}

function buildItemColumns(rows = getDisplayedItems()) {
  return prepareStockDocumentItemColumns(
    (useFormItemColumns(hiddenFields.value) || []) as any[],
    {
      editable: false,
      rows,
      trailingFlexibleColumnMinWidth: 150,
    },
  );
}

async function refreshItemGrid() {
  await nextTick();
  const displayData = getDisplayedItems();
  renderedItemRows.value = displayData;
  activeItemRow.value =
    displayData.find((row) =>
      row.id ? row.id === activeItemRow.value?.id : row === activeItemRow.value,
    ) ?? displayData[0];
  gridApi.setGridOptions({ data: displayData, fit: false });
  await itemColumns.reload();
  await gridApi.grid.loadData(displayData);
}

async function handleItemSortChange({ field, order }: any) {
  activeItemSort.value =
    isTransferInItemSortField(field) && (order === 'asc' || order === 'desc')
      ? { field, order }
      : null;
  await loadStockTransferInItemPage({
    orderDirection: activeItemSort.value?.order,
    orderField: activeItemSort.value?.field,
    pageNo: 1,
    pageSize: itemPageState.value.pageSize,
  });
}

async function handleItemToolbarRefresh() {
  await loadStockTransferInItemPage({
    orderDirection: activeItemSort.value?.order,
    orderField: activeItemSort.value?.field,
    pageNo: itemPageState.value.pageNo,
    pageSize: itemPageState.value.pageSize,
  });
}

async function loadStockTransferInItemPage(
  options: {
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    pageNo?: number;
    pageSize?: number;
  } = {},
) {
  if (!formData.value?.id) {
    formData.value = formData.value ?? { items: [] };
    formData.value.items = [];
    return;
  }
  itemPageLoading.value = true;
  gridApi.setLoading(true);
  try {
    const nextState = {
      ...itemPageState.value,
      ...options,
      pageNo: options.pageNo ?? itemPageState.value.pageNo,
      pageSize: options.pageSize ?? itemPageState.value.pageSize,
    };
    const result = await getStockTransferInItemPage({
      mask: true,
      moveId: formData.value.id,
      orderDirection: nextState.orderDirection,
      orderField: nextState.orderField,
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
    });
    itemPageState.value = {
      ...nextState,
      total: result.total ?? 0,
    };
    formData.value.items = result.list ?? [];
    await refreshItemGrid();
  } finally {
    itemPageLoading.value = false;
    gridApi.setLoading(false);
  }
}

async function handleItemPageChange(pageNo: number, pageSize: number) {
  await loadStockTransferInItemPage({
    orderDirection: activeItemSort.value?.order,
    orderField: activeItemSort.value?.field,
    pageNo,
    pageSize,
  });
}

function buildSchema() {
  const schema = useFormSchema('detail', hiddenFields.value)
    .filter((item) => item.fieldName !== 'items')
    .map((item) => {
      if (item.fieldName === 'no') {
        return { ...item, label: '调拨入库单号' };
      }
      if (item.fieldName === 'moveTime') {
        return { ...item, label: '入库日期' };
      }
      return item;
    });
  const sourceFields: VbenFormSchema[] = [
    {
      component: 'Input',
      componentProps: { disabled: true },
      fieldName: 'relatedMoveNo',
      label: '来源出库单号',
    },
    {
      component: 'Input',
      componentProps: { disabled: true },
      fieldName: 'sourceNo',
      label: '来源单号',
    },
  ].filter(
    (item) => !isFieldHidden(hiddenFields.value, item.fieldName),
  ) as VbenFormSchema[];
  const insertIndex = schema.findIndex((item) => item.fieldName === 'remark');
  schema.splice(
    insertIndex === -1 ? schema.length : insertIndex,
    0,
    ...sourceFields,
  );
  return buildStockDocumentFormSchema(schema, {
    data: formData.value,
    formType: 'detail',
  });
}

const [Modal, modalApi] = useVbenModal({
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      stopPriceReferenceShortcutListening();
      detailLoadSequence += 1;
      detailLoading.value = false;
      detailLoadError.value = '';
      formData.value = undefined;
      itemPageState.value = {
        orderDirection: undefined,
        orderField: undefined,
        pageNo: 1,
        pageSize: DEFAULT_ITEM_PAGE_SIZE,
        total: 0,
      };
      return;
    }
    startPriceReferenceShortcutListening();
    const data = modalApi.getData<{ id?: number }>();
    const sequence = ++detailLoadSequence;
    detailLoadError.value = '';
    detailLoading.value = true;
    modalApi.setState({ fullscreen: true });
    if (!data?.id) {
      detailLoading.value = false;
      detailLoadError.value = '调拨入库单参数无效，请关闭后重试';
      return;
    }
    modalApi.lock();
    try {
      await loadHiddenFields();
      if (sequence !== detailLoadSequence) return;
      formApi.setDisabled(true);
      formApi.updateSchema(buildSchema());
      await nextTick();
      formData.value = await hydrateStockDocumentFormSelectLabels(
        await getStockTransferInWithOptions(data.id, {
          includeItems: false,
        }),
      );
      formData.value.items = [];
      if (sequence !== detailLoadSequence) return;
      formApi.updateSchema(buildSchema());
      await formApi.setValues(
        buildStockDocumentDetailFormValues(formData.value, 'detail'),
      );
      await itemColumns.reload();
      if (activeItemSort.value) {
        await gridApi.grid.setSort(activeItemSort.value);
      }
      await loadStockTransferInItemPage({ pageNo: 1 });
    } catch {
      if (sequence === detailLoadSequence) {
        formData.value = undefined;
        detailLoadError.value = '调拨入库单加载失败，请关闭后重试';
      }
    } finally {
      if (sequence === detailLoadSequence) {
        detailLoading.value = false;
      }
      modalApi.unlock();
    }
  },
});

onBeforeUnmount(stopPriceReferenceShortcutListening);
</script>

<template>
  <Modal
    :title="getTitle"
    class="!w-full"
    bordered
    content-class="p-0"
    :show-confirm-button="false"
  >
    <StockDocumentFormLayout
      :error="detailLoadError"
      item-title="调拨入库产品清单"
      :loading="detailLoading"
    >
      <template #basic>
        <Form>
          <template #relatedMoveNo>
            <DetailLinkInput
              :navigable="canOpenSourceOut"
              :value="formData?.relatedMoveNo"
              @open="handleOpenSourceOut"
            />
          </template>
          <template #sourceNo>
            <DetailLinkInput
              :navigable="canOpenSourceDocument"
              :value="formData?.sourceNo"
              @open="handleOpenSourceDocument"
            />
          </template>
        </Form>
      </template>
      <template #items>
        <div
          ref="itemTableWrapRef"
          tabindex="-1"
          @mousedown="detailActions?.pointer($event)"
          class="stock-transfer-in-item-table-wrap relative"
        >
          <Grid class="stock-transfer-in-item-grid">
            <template #toolbar-buttons>
              <StockItemDetailActions
                ref="detailActions"
                :active-row="activeItemRow"
                :dept-id="formData?.deptId"
                :hidden-fields="hiddenFields"
                :wrapper="itemTableWrapRef"
                :blocked="false"
                :enabled="Boolean(formData?.id)"
                @product-updated="itemColumns.reload()"
              />
              <div class="stock-document-item-shortcut-hint">
                <span class="page-label">当前页</span>
                <span><kbd>W</kbd><b>全部价格</b></span>
              </div>
            </template>
            <template #toolbar-tools>
              <span aria-hidden="true"></span>
            </template>
          </Grid>
          <ItemPriceReferenceOverlay
            preserve-decimal-precision
            :hidden-fields="hiddenFields"
            :open="priceReferenceOpen"
            :rows="renderedItemRows"
            :table-header-height="ITEM_TABLE_HEADER_HEIGHT"
            :table-row-height="ITEM_TABLE_ROW_HEIGHT"
            :table-wrapper="itemTableWrapRef"
            :visible-rows="ITEM_TABLE_VISIBLE_ROWS"
          />
        </div>
        <div class="stock-transfer-in-item-pager">
          <Pagination
            class="erp-candidate-focus-popup"
            :current="itemPageState.pageNo"
            :disabled="itemPageLoading"
            :page-size="itemPageState.pageSize"
            :page-size-options="ITEM_PAGE_SIZE_OPTIONS"
            :show-quick-jumper="true"
            :show-size-changer="true"
            :show-total="(total) => `共 ${total} 条明细`"
            :total="itemPageState.total"
            size="small"
            @change="handleItemPageChange"
            @show-size-change="handleItemPageChange"
          />
        </div>
        <StockDocumentSummary
          natural-numbers
          :entries="documentSummaryEntries"
        />
      </template>
      <template #audit>
        <ErpAuditInfo class="erp-audit-info" title="" :record="formData" />
      </template>
    </StockDocumentFormLayout>
  </Modal>
  <SourceOutModal />
  <SourceDocumentModal ref="sourceDocumentModalRef" />
</template>

<style scoped>
.page-label {
  color: #64748b;
}
:deep(.flex-auto.overflow-hidden:has(> .relative > .erp-detail-link-field)) {
  overflow: visible;
}

:deep(.stock-transfer-in-item-grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(
  .stock-transfer-in-item-grid .vxe-header--column.is--sortable .vxe-cell--title
) {
  color: #1677ff;
}

.stock-document-item-shortcut-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  color: #475569;
  font-size: 12px;
}

.stock-document-item-shortcut-hint__label {
  color: #64748b;
}

.stock-document-item-shortcut-hint b {
  font-weight: 600;
}

.stock-document-item-shortcut-hint kbd {
  min-width: 24px;
  padding: 1px 7px;
  color: #334155;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  box-shadow: inset 0 -1px 0 rgb(15 23 42 / 10%);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
}

:deep(.stock-transfer-in-item-grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.stock-transfer-in-item-grid .vxe-table--render-default),
:deep(.stock-transfer-in-item-grid .vxe-cell),
:deep(.stock-transfer-in-item-grid .ant-input) {
  font-size: 11px;
}

.stock-transfer-in-item-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.stock-transfer-in-item-pager :deep(.ant-pagination),
.stock-transfer-in-item-pager :deep(.ant-pagination-item),
.stock-transfer-in-item-pager :deep(.ant-pagination-total-text),
.stock-transfer-in-item-pager :deep(.ant-pagination-options),
.stock-transfer-in-item-pager :deep(.ant-select),
.stock-transfer-in-item-pager :deep(.ant-input) {
  font-size: 11px;
}

.stock-transfer-in-item-pager :deep(.ant-pagination-item),
.stock-transfer-in-item-pager :deep(.ant-pagination-prev),
.stock-transfer-in-item-pager :deep(.ant-pagination-next),
.stock-transfer-in-item-pager :deep(.ant-pagination-jump-prev),
.stock-transfer-in-item-pager :deep(.ant-pagination-jump-next) {
  min-width: 24px;
  height: 24px;
  line-height: 22px;
}

.stock-transfer-in-item-pager :deep(.ant-pagination-item a),
.stock-transfer-in-item-pager :deep(.ant-pagination-prev button),
.stock-transfer-in-item-pager :deep(.ant-pagination-next button) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.stock-transfer-in-item-pager :deep(.ant-pagination-options-size-changer),
.stock-transfer-in-item-pager :deep(.ant-select-single),
.stock-transfer-in-item-pager :deep(.ant-select-selector) {
  height: 24px;
  line-height: 22px;
}

.stock-transfer-in-item-pager
  :deep(.ant-pagination-options-size-changer .ant-select-selector) {
  box-sizing: border-box;
  align-items: center;
  min-height: 24px;
  padding: 0 24px 0 8px;
}

.stock-transfer-in-item-pager
  :deep(.ant-select-single .ant-select-selector .ant-select-selection-item) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.stock-transfer-in-item-pager :deep(.ant-select-arrow) {
  margin-top: -5px;
  font-size: 10px;
}

.stock-transfer-in-item-pager
  :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 22px;
}
</style>
