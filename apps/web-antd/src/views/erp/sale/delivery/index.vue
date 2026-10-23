<script lang="ts" setup>
import type { UploadFile, UploadProps } from 'ant-design-vue';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpSalePickDeliveryApi } from '#/api/erp/sale/pick-delivery';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { downloadFileFromBlobPart, formatDateTime } from '@vben/utils';

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  DescriptionsItem,
  Drawer,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Pagination,
  Progress,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Upload,
} from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportSaleDelivery,
  getSaleDelivery,
  getSaleDeliveryItemPage,
  getSaleDeliveryPage,
  getSaleDeliverySubmitPage,
  submitSaleDelivery,
  uploadSaleDeliveryVoucher,
} from '#/api/erp/sale/pick-delivery';
import { getSaleWarehouseSimpleList } from '#/api/erp/stock/warehouse';
import { formatSaleItemPieceCount } from '#/views/erp/sale/utils/item-piece-count';
import {
  applySaleDocumentListColumnCustomization,
  prepareSaleDocumentListColumns,
} from '#/views/erp/sale/utils/document-list-table';
import {
  fitPickDeliveryTableColumns,
  getPickDeliveryTableScrollWidth,
} from '#/views/erp/sale/utils/pick-delivery-table-layout';

import SubmitItems from '../pick-delivery-submit-items.vue';
import {
  formatPickDeliveryQuantity,
  usePickDeliveryQuantities,
} from '../utils/pick-delivery-quantity';

defineOptions({ name: 'ErpSaleDelivery' });

const route = useRoute();
const DETAIL_PAGE_SIZE = 10;
const LIST_AUTO_REFRESH_INTERVAL = 10_000;
const MOBILE_LIST_MEDIA_QUERY = '(max-width: 768px)';

const pickStatusOptions = [
  { label: '待拣货', value: 10 },
  { label: '部分拣货', value: 20 },
  { label: '已拣货', value: 30 },
];
const deliveryStatusOptions = [
  { label: '待拣货', value: 5 },
  { label: '待送货', value: 10 },
  { label: '部分送货', value: 20 },
  { label: '已送货', value: 30 },
];
const pickStatusTextMap: Record<number, string> = {
  10: '待拣货',
  20: '部分拣货',
  30: '已拣货',
};
const deliveryStatusTextMap: Record<number, string> = {
  5: '待拣货',
  10: '待送货',
  20: '部分送货',
  30: '已送货',
};
const statusColorMap: Record<number, string> = {
  5: 'default',
  10: 'default',
  20: 'processing',
  30: 'success',
};

const query = reactive({
  deliveryStatus: undefined as number | undefined,
  pickStatus: undefined as number | undefined,
  saleOutNo: '',
  warehouseId: undefined as number | undefined,
});
const pageNo = ref(1);
const pageSize = ref(20);
const total = ref(0);
const loading = ref(false);
const rows = ref<ErpSalePickDeliveryApi.DeliveryOrder[]>([]);
const checkedIds = ref<number[]>([]);
const warehouseOptions = ref<{ label: string; value: number }[]>([]);
const mobileFilterOpen = ref(false);
const mobilePageNo = ref(1);
const mobileHasMore = ref(true);
const mobileLoadingMore = ref(false);
const detailOpen = ref(false);
const detailActiveTab = ref('items');
const expandedSubmitId = ref<number>();
const detailUseMobileMode = ref(false);
const detailLoading = ref(false);
const detail = ref<ErpSalePickDeliveryApi.DeliveryOrder>();
const detailItems = ref<ErpSalePickDeliveryApi.ItemResp[]>([]);
const detailItemsLoading = ref(false);
const detailItemsPageNo = ref(1);
const detailItemsTotal = ref(0);
const detailSubmits = ref<ErpSalePickDeliveryApi.SubmitResp[]>([]);
const detailSubmitsLoading = ref(false);
const detailSubmitsLoaded = ref(false);
const detailSubmitsPageNo = ref(1);
const detailSubmitsTotal = ref(0);
const { hasAccessByCodes } = useAccess();
const quantityDraft = usePickDeliveryQuantities('delivery');
const { selectedItemIds, quantities } = quantityDraft;
const voucherFileList = ref<UploadFile[]>([]);
const submitRemark = ref('');
const submitLoading = ref(false);
const isWeComWorkbench = computed(
  () =>
    route.query.wecomWorkbench === '1' || route.query.wecomWorkbench === 'true',
);
const isNarrowScreen = ref(
  typeof window !== 'undefined' &&
    window.matchMedia(MOBILE_LIST_MEDIA_QUERY).matches,
);
const isMobileListMode = computed(
  () => isWeComWorkbench.value || isNarrowScreen.value,
);
const desktopGridShellRef = ref<HTMLElement | null>(null);
const detailTableWrapRef = ref<HTMLElement | null>(null);
const detailTableWidth = ref(0);
let mobileListMediaQuery: MediaQueryList | undefined;
let listAutoRefreshTimer: number | undefined;
let listAutoRefreshing = false;
let listRequestToken = 0;
let adaptiveResizeFrame = 0;
let adaptiveResizeObserver: ResizeObserver | undefined;
let lastDesktopGridWidth = 0;

const DETAIL_SELECTION_WIDTH = 48;

const deliveryGridColumns: any[] = [
  { type: 'checkbox', width: 44 },
  {
    field: 'displayNo',
    slots: { default: 'displayNo' },
    title: '销售单号',
    width: 150,
  },
  { field: 'customerName', title: '客户', width: 180 },
  { field: 'warehouseName', title: '仓库', width: 140 },
  {
    field: 'pickStatus',
    slots: { default: 'pickStatus' },
    title: '拣货状态',
    width: 110,
  },
  {
    field: 'deliveryStatus',
    slots: { default: 'deliveryStatus' },
    title: '送货状态',
    width: 120,
  },
  {
    field: 'pickProgress',
    slots: { default: 'pickProgress' },
    title: '拣货进度',
    width: 150,
  },
  {
    field: 'deliveryProgress',
    slots: { default: 'deliveryProgress' },
    title: '送货进度',
    width: 150,
  },
  {
    field: 'latestDeliveryTime',
    formatter: 'formatDateTime',
    title: '最近送货时间',
    width: 170,
  },
  {
    field: 'deliveryCompleteTime',
    formatter: 'formatDateTime',
    title: '送货完成时间',
    width: 170,
  },
  {
    field: 'createTime',
    formatter: 'formatDateTime',
    title: '创建时间',
    width: 170,
  },
  {
    field: 'actions',
    fixed: 'right',
    slots: { default: 'actions' },
    title: '操作',
    width: 90,
  },
];

const itemColumns: any[] = [
  { title: '配件名称', dataIndex: 'productName', width: 180 },
  { title: '仓库', dataIndex: 'warehouseName', width: 130 },
  { title: '配件编码', dataIndex: 'productCode', width: 120 },
  { title: '规格', dataIndex: 'standard', width: 120 },
  { title: '仓位', dataIndex: 'warehousePosition', width: 120 },
  { title: '应发数量', dataIndex: 'count', width: 100 },
  { title: '已拣数量', dataIndex: 'pickedCount', width: 100 },
  { title: '已送数量', dataIndex: 'deliveredCount', width: 100 },
  { title: '当前可送', dataIndex: 'availableDeliveryCount', width: 100 },
  { title: '剩余未送', dataIndex: 'remainingDeliveryCount', width: 100 },
  { title: '本次送货数量', dataIndex: 'submitQuantity', width: 150 },
  { title: '包装数', dataIndex: 'packageQty', width: 90 },
  { title: '件数', dataIndex: 'pieceCount', width: 90 },
  { title: '送货状态', dataIndex: 'deliveryStatus', width: 100 },
  { title: '送货人', dataIndex: 'deliveryUserName', width: 110 },
  { title: '送货时间', dataIndex: 'deliveryTime', width: 170 },
];

const submitColumns: any[] = [
  { title: '提交人', dataIndex: 'submitUserName', width: 120 },
  { title: '提交时间', dataIndex: 'submitTime', width: 170 },
  { title: '明细数', dataIndex: 'itemCount', width: 80 },
  { title: '凭证', dataIndex: 'files', width: 220 },
  { title: '备注', dataIndex: 'remark', width: 180 },
];

const adaptiveItemColumns = computed(() =>
  fitPickDeliveryTableColumns(
    itemColumns,
    detailTableWidth.value,
    DETAIL_SELECTION_WIDTH,
  ),
);
const adaptiveSubmitColumns = computed(() =>
  fitPickDeliveryTableColumns(submitColumns, detailTableWidth.value),
);
const detailItemScrollX = computed(() =>
  getPickDeliveryTableScrollWidth(
    adaptiveItemColumns.value,
    DETAIL_SELECTION_WIDTH,
  ),
);
const detailSubmitScrollX = computed(() =>
  getPickDeliveryTableScrollWidth(adaptiveSubmitColumns.value),
);

function getDesktopGridWidth() {
  const grid = desktopGridShellRef.value?.querySelector('.vxe-grid');
  return Math.floor(
    grid?.getBoundingClientRect().width ??
      desktopGridShellRef.value?.getBoundingClientRect().width ??
      0,
  );
}

function buildAdaptiveDeliveryGridColumns(
  currentRows: ErpSalePickDeliveryApi.DeliveryOrder[] = rows.value,
) {
  const prepared = prepareSaleDocumentListColumns(
    deliveryGridColumns,
    currentRows,
  ) as any[];
  const customized = applySaleDocumentListColumnCustomization(
    prepared,
    gridApi.grid?.getFullColumns?.() ?? [],
    90,
  );
  return fitPickDeliveryTableColumns(customized, getDesktopGridWidth());
}

async function reloadAdaptiveDeliveryGridColumns() {
  if (isMobileListMode.value || !gridApi.grid) return;
  const columns = buildAdaptiveDeliveryGridColumns();
  gridApi.setGridOptions({ columns });
  await gridApi.grid.reloadColumn?.(columns);
  await gridApi.grid.refreshColumn?.();
  await gridApi.grid.recalculate?.(true);
}

function refreshAdaptiveTableWidths() {
  const desktopWidth = getDesktopGridWidth();
  if (desktopWidth > 0 && desktopWidth !== lastDesktopGridWidth) {
    lastDesktopGridWidth = desktopWidth;
    void reloadAdaptiveDeliveryGridColumns();
  }
  detailTableWidth.value = Math.floor(
    detailTableWrapRef.value?.getBoundingClientRect().width ?? 0,
  );
}

function queueAdaptiveTableWidths() {
  if (typeof window === 'undefined') return;
  window.cancelAnimationFrame(adaptiveResizeFrame);
  adaptiveResizeFrame = window.requestAnimationFrame(() => {
    adaptiveResizeFrame = 0;
    refreshAdaptiveTableWidths();
  });
}

function observeAdaptiveTableContainers() {
  adaptiveResizeObserver?.disconnect();
  if (!adaptiveResizeObserver) return;
  if (desktopGridShellRef.value) {
    adaptiveResizeObserver.observe(desktopGridShellRef.value);
  }
  if (detailTableWrapRef.value) {
    adaptiveResizeObserver.observe(detailTableWrapRef.value);
  }
  queueAdaptiveTableWidths();
}

const detailItemRowSelection = computed<any>(() => ({
  preserveSelectedRowKeys: true,
  selectedRowKeys: selectedItemIds.value,
  getCheckboxProps: (record: ErpSalePickDeliveryApi.ItemResp) => ({
    disabled: submitLoading.value || !canSelectDeliveryItem(record),
  }),
  onChange: (keys: number[]) => {
    updateDetailSelection(keys);
  },
}));

function canSelectDeliveryItem(record: ErpSalePickDeliveryApi.ItemResp) {
  return (
    !!record.id &&
    hasAccessByCodes(['erp:sale-delivery:delivery']) &&
    Number(quantityDraft.remaining(record)) > 0
  );
}

function updateDetailSelection(keys: number[]) {
  if (!submitLoading.value)
    quantityDraft.setSelection(keys, detailItems.value, canSelectDeliveryItem);
}

const deliverableItemCount = computed(
  () =>
    detail.value?.deliverableItemCount ??
    detailItems.value.filter(
      (item) => Number(quantityDraft.remaining(item)) > 0,
    ).length,
);

const detailItemPagination = computed<any>(() => ({
  current: detailItemsPageNo.value,
  pageSize: DETAIL_PAGE_SIZE,
  showSizeChanger: false,
  total: detailItemsTotal.value,
  showTotal: (value: number) => `共 ${value} 条`,
  onChange: handleDetailItemsPageChange,
}));

const detailSubmitPagination = computed<any>(() => ({
  current: detailSubmitsPageNo.value,
  pageSize: DETAIL_PAGE_SIZE,
  showSizeChanger: false,
  total: detailSubmitsTotal.value,
  showTotal: (value: number) => `共 ${value} 条`,
  onChange: handleDetailSubmitsPageChange,
}));

const canLoadMoreDetailItems = computed(
  () => detailItems.value.length < detailItemsTotal.value,
);

const canSubmitDelivery = computed(
  () =>
    !!detail.value?.id &&
    hasAccessByCodes(['erp:sale-delivery:delivery']) &&
    selectedItemIds.value.length > 0 &&
    voucherFileList.value.length > 0 &&
    !submitLoading.value,
);

function formatTime(value?: string) {
  return value ? formatDateTime(value) : '';
}

function formatPieceCount(record: Partial<ErpSalePickDeliveryApi.ItemResp>) {
  const pieceCount = record.pieceCount;
  return pieceCount === undefined || pieceCount === null || pieceCount === ''
    ? formatSaleItemPieceCount(record)
    : pieceCount;
}

function formatTotalPieceCount(value?: number | string) {
  return value === undefined || value === null || value === '' ? '-' : value;
}

function getProgressPercent(value?: string) {
  const [currentText, totalText] = String(value || '').split('/');
  const current = Number(currentText);
  const progressTotal = Number(totalText);
  if (
    !Number.isFinite(current) ||
    !Number.isFinite(progressTotal) ||
    progressTotal <= 0
  ) {
    return 0;
  }
  return Math.min(
    100,
    Math.max(0, Math.round((current / progressTotal) * 100)),
  );
}

function getDisplayNo(record?: {
  displayNo?: string;
  saleOutNo?: string;
  sourceNo?: string;
}) {
  return record?.displayNo || record?.saleOutNo || record?.sourceNo || '-';
}

function isDetailItemSelected(id?: number) {
  return !!id && selectedItemIds.value.includes(id);
}

function isQuantityColumn(dataIndex: unknown) {
  return (
    typeof dataIndex === 'string' &&
    [
      'availableDeliveryCount',
      'count',
      'deliveredCount',
      'pickedCount',
      'remainingDeliveryCount',
    ].includes(dataIndex)
  );
}

function buildParams(page = pageNo.value, size = pageSize.value) {
  return {
    deliveryStatus: query.deliveryStatus,
    pageNo: page,
    pageSize: size,
    pickStatus: query.pickStatus,
    saleOutNo: query.saleOutNo?.trim() || undefined,
    warehouseId: query.warehouseId,
  };
}

function normalizeDesktopSearchParams(formValues: Record<string, any> = {}) {
  return {
    createTime: formValues.createTime,
    deliveryCompleteTime: formValues.deliveryCompleteTime,
    deliveryStatus: formValues.deliveryStatus,
    pickStatus: formValues.pickStatus,
    saleOutNo: String(formValues.keyword || '').trim() || undefined,
    warehouseId: formValues.warehouseId,
  };
}

function handleGridCheckboxChange({
  records,
}: {
  records: ErpSalePickDeliveryApi.DeliveryOrder[];
}) {
  checkedIds.value = records
    .map((item) => item.id)
    .filter((id): id is number => id !== undefined);
}

function handleDeliveryCellClick({
  column,
  row,
}: {
  column: { field?: string; type?: string };
  row: ErpSalePickDeliveryApi.DeliveryOrder;
}) {
  if (column.type === 'checkbox' || column.field === 'actions') {
    return;
  }
  openDetail(row);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 80 },
    schema: [
      {
        component: 'Input',
        componentProps: {
          allowClear: true,
          placeholder: '请输入销售单号',
          'data-erp-keyword-search-input': 'true',
        },
        fieldName: 'keyword',
        label: '关键词',
      },
      {
        component: 'Select',
        componentProps: () => ({
          allowClear: true,
          options: warehouseOptions.value,
          placeholder: '请选择仓库',
          showSearch: true,
          optionFilterProp: 'label',
        }),
        fieldName: 'warehouseId',
        label: '仓库',
      },
      {
        component: 'Select',
        componentProps: {
          allowClear: true,
          options: pickStatusOptions,
          placeholder: '请选择拣货状态',
        },
        fieldName: 'pickStatus',
        label: '拣货状态',
      },
      {
        component: 'Select',
        componentProps: {
          allowClear: true,
          options: deliveryStatusOptions,
          placeholder: '请选择送货状态',
        },
        fieldName: 'deliveryStatus',
        label: '送货状态',
      },
      {
        component: 'RangePicker',
        componentProps: {
          allowClear: true,
          placeholder: ['开始时间', '结束时间'],
          showTime: true,
          valueFormat: 'YYYY-MM-DD HH:mm:ss',
        },
        fieldName: 'createTime',
        label: '创建时间',
      },
      {
        component: 'RangePicker',
        componentProps: {
          allowClear: true,
          placeholder: ['开始时间', '结束时间'],
          showTime: true,
          valueFormat: 'YYYY-MM-DD HH:mm:ss',
        },
        fieldName: 'deliveryCompleteTime',
        label: '完成时间',
      },
    ],
  },
  gridOptions: {
    checkboxConfig: { reserve: true },
    columns: deliveryGridColumns,
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
    id: 'erp-sale-delivery-list-v2',
    pagerConfig: {
      pageSize: 20,
      pageSizes: [10, 20, 50, 100],
    },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const result = await getSaleDeliveryPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...normalizeDesktopSearchParams(formValues),
          });
          const nextRows = result.list || [];
          const newRowCount = listAutoRefreshing
            ? countNewRows(rows.value, nextRows)
            : 0;
          rows.value = nextRows;
          total.value = result.total || 0;
          checkedIds.value = checkedIds.value.filter((id) =>
            nextRows.some((row) => row.id === id),
          );
          if (newRowCount > 0) {
            message.success(`发现 ${newRowCount} 个新送货单`);
          }
          await nextTick();
          await reloadAdaptiveDeliveryGridColumns();
          return result;
        },
      },
    },
    rowClassName: () => 'sale-delivery-clickable-row',
    rowConfig: { isHover: true, keyField: 'id' },
    scrollX: { enabled: true, gt: 8 },
    scrollY: { enabled: true, gt: 10 },
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ErpSalePickDeliveryApi.DeliveryOrder>,
  gridEvents: {
    cellClick: handleDeliveryCellClick,
    checkboxAll: handleGridCheckboxChange,
    checkboxChange: handleGridCheckboxChange,
  },
});

function countNewRows(
  currentRows: ErpSalePickDeliveryApi.DeliveryOrder[],
  nextRows: ErpSalePickDeliveryApi.DeliveryOrder[],
) {
  const currentIds = new Set(currentRows.map((row) => row.id).filter(Boolean));
  return nextRows.filter((row) => row.id && !currentIds.has(row.id)).length;
}

function mergeMobileAutoRefreshRows(
  currentRows: ErpSalePickDeliveryApi.DeliveryOrder[],
  nextRows: ErpSalePickDeliveryApi.DeliveryOrder[],
  nextTotal: number,
) {
  const nextIds = new Set(nextRows.map((row) => row.id).filter(Boolean));
  const preservedRows = currentRows.filter(
    (row) => row.id && !nextIds.has(row.id),
  );
  return [...nextRows, ...preservedRows].slice(0, nextTotal);
}

async function loadMobileData(append = false, silentRefresh = false) {
  if (
    append &&
    (!mobileHasMore.value || mobileLoadingMore.value || loading.value)
  ) {
    return;
  }
  if (silentRefresh && listAutoRefreshing) {
    return;
  }
  const nextPage = append ? mobilePageNo.value + 1 : 1;
  const requestToken = ++listRequestToken;
  if (append) {
    mobileLoadingMore.value = true;
  } else if (silentRefresh) {
    listAutoRefreshing = true;
  } else {
    loading.value = true;
    mobileHasMore.value = true;
    mobileLoadingMore.value = false;
  }
  try {
    const result = await getSaleDeliveryPage(
      buildParams(nextPage, pageSize.value),
    );
    if (requestToken !== listRequestToken) {
      return;
    }
    const nextRows = result.list || [];
    const nextTotal = result.total || 0;
    const newRowCount =
      silentRefresh && !append ? countNewRows(rows.value, nextRows) : 0;
    rows.value = append
      ? [...rows.value, ...nextRows]
      : silentRefresh
        ? mergeMobileAutoRefreshRows(rows.value, nextRows, nextTotal)
        : nextRows;
    total.value = nextTotal;
    if (!silentRefresh || append) {
      mobilePageNo.value = nextPage;
    }
    mobileHasMore.value = rows.value.length < total.value;
    checkedIds.value = checkedIds.value.filter((id) =>
      rows.value.some((row) => row.id === id),
    );
    if (newRowCount > 0) {
      message.success(`发现 ${newRowCount} 个新送货单`);
    }
  } finally {
    if (requestToken === listRequestToken) {
      if (append) {
        mobileLoadingMore.value = false;
      } else if (!silentRefresh) {
        loading.value = false;
      }
    }
    if (silentRefresh) {
      listAutoRefreshing = false;
    }
  }
}

async function loadData(silentRefresh = false) {
  if (isMobileListMode.value) {
    await loadMobileData(false, silentRefresh);
    return;
  }
  if (silentRefresh && listAutoRefreshing) {
    return;
  }
  const requestToken = ++listRequestToken;
  if (silentRefresh) {
    listAutoRefreshing = true;
  } else {
    loading.value = true;
  }
  try {
    await gridApi.query();
  } finally {
    if (requestToken === listRequestToken && !silentRefresh) {
      loading.value = false;
    }
    if (silentRefresh) {
      listAutoRefreshing = false;
    }
  }
}

function handleSearch() {
  pageNo.value = 1;
  loadData();
}

function handleReset() {
  query.saleOutNo = '';
  query.pickStatus = undefined;
  query.deliveryStatus = undefined;
  query.warehouseId = undefined;
  handleSearch();
}

function handleMobileSearch() {
  mobileFilterOpen.value = false;
  handleSearch();
}

function handleMobileReset() {
  mobileFilterOpen.value = false;
  handleReset();
}

function handleMobileListScroll(event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }
  const distanceToBottom =
    target.scrollHeight - target.scrollTop - target.clientHeight;
  if (distanceToBottom <= 96) {
    loadMobileData(true);
  }
}

async function handleExport() {
  if (isMobileListMode.value) {
    return;
  }
  const formValues = await gridApi.formApi.getValues();
  const data = await exportSaleDelivery({
    ...normalizeDesktopSearchParams(formValues),
    ids: checkedIds.value.length > 0 ? checkedIds.value : undefined,
  });
  downloadFileFromBlobPart({ fileName: '销售送货单.xls', source: data });
}

function resetSubmitForm() {
  quantityDraft.reset();
  voucherFileList.value = [];
  submitRemark.value = '';
}

function resetDetailPagination() {
  expandedSubmitId.value = undefined;
  detailItems.value = [];
  detailItemsPageNo.value = 1;
  detailItemsTotal.value = 0;
  detailSubmits.value = [];
  detailSubmitsLoaded.value = false;
  detailSubmitsPageNo.value = 1;
  detailSubmitsTotal.value = 0;
}

async function loadDetailItems(page = 1, append = false) {
  if (!detail.value?.id) {
    return;
  }
  detailItemsLoading.value = true;
  try {
    const result = await getSaleDeliveryItemPage({
      taskId: detail.value.id,
      pageNo: page,
      pageSize: DETAIL_PAGE_SIZE,
    });
    detailItemsPageNo.value = page;
    detailItemsTotal.value = result.total || 0;
    detailItems.value = append
      ? [...detailItems.value, ...(result.list || [])]
      : result.list || [];
  } finally {
    detailItemsLoading.value = false;
  }
}

async function loadDetailSubmits(page = 1, append = false) {
  if (!detail.value?.id) {
    return;
  }
  detailSubmitsLoading.value = true;
  try {
    const result = await getSaleDeliverySubmitPage({
      taskId: detail.value.id,
      pageNo: page,
      pageSize: DETAIL_PAGE_SIZE,
    });
    detailSubmitsPageNo.value = page;
    detailSubmitsTotal.value = result.total || 0;
    detailSubmits.value = append
      ? [...detailSubmits.value, ...(result.list || [])]
      : result.list || [];
    detailSubmitsLoaded.value = true;
  } finally {
    detailSubmitsLoading.value = false;
  }
}

function handleDetailItemsPageChange(current: number) {
  loadDetailItems(current);
}

function handleDetailSubmitsPageChange(current: number) {
  loadDetailSubmits(current);
}

function loadMoreDetailItems() {
  if (canLoadMoreDetailItems.value && !detailItemsLoading.value) {
    loadDetailItems(detailItemsPageNo.value + 1, true);
  }
}

function refreshDetailDisplayMode() {
  detailUseMobileMode.value = isMobileListMode.value;
}

function handleDetailTabChange(key: number | string) {
  const activeKey = String(key);
  detailActiveTab.value = activeKey;
  if (activeKey === 'submits' && !detailSubmitsLoaded.value) {
    loadDetailSubmits(1);
  }
}

async function openDetail(row: ErpSalePickDeliveryApi.DeliveryOrder) {
  if (!row.id) {
    return;
  }
  detailOpen.value = true;
  detailActiveTab.value = 'items';
  refreshDetailDisplayMode();
  detailLoading.value = true;
  try {
    resetSubmitForm();
    resetDetailPagination();
    detail.value = await getSaleDelivery(row.id, false);
    await (detailUseMobileMode.value
      ? loadDetailItems()
      : Promise.all([loadDetailItems(), loadDetailSubmits()]));
  } finally {
    detailLoading.value = false;
  }
}

function isInteractiveClick(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }
  return !!target.closest(
    'a,button,input,textarea,.ant-input-number,.ant-checkbox-wrapper,.ant-table-selection-column,.ant-select,.ant-pagination,.ant-upload',
  );
}

function toggleDetailItem(record: ErpSalePickDeliveryApi.ItemResp) {
  const itemId = record.id;
  if (submitLoading.value || !itemId || !canSelectDeliveryItem(record)) {
    return;
  }
  if (selectedItemIds.value.includes(itemId)) {
    updateDetailSelection(selectedItemIds.value.filter((id) => id !== itemId));
  } else {
    updateDetailSelection([...selectedItemIds.value, itemId]);
  }
}

function buildDetailItemCustomRow(record: ErpSalePickDeliveryApi.ItemResp) {
  const selectable = canSelectDeliveryItem(record);
  return {
    class: selectable
      ? 'sale-delivery-detail-row sale-delivery-detail-row--available'
      : 'sale-delivery-detail-row sale-delivery-detail-row--disabled',
    onClick: (event: MouseEvent) => {
      if (!isInteractiveClick(event)) {
        toggleDetailItem(record);
      }
    },
  };
}

const beforeVoucherUpload: UploadProps['beforeUpload'] = (file) => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !['jpeg', 'jpg', 'png'].includes(extension)) {
    message.error('快递单仅支持 jpg、jpeg、png 格式');
    return Upload.LIST_IGNORE;
  }
  if (file.size > 5 * 1024 * 1024) {
    message.error('快递单图片不能超过 5MB');
    return Upload.LIST_IGNORE;
  }
  voucherFileList.value = [
    ...voucherFileList.value,
    file as unknown as UploadFile,
  ];
  return false;
};

function handleVoucherRemove(file: UploadFile) {
  voucherFileList.value = voucherFileList.value.filter(
    (item) => item.uid !== file.uid,
  );
  return true;
}

async function uploadVoucherFiles() {
  const files: ErpSalePickDeliveryApi.SubmitFile[] = [];
  for (const item of voucherFileList.value) {
    const rawFile = (item.originFileObj || item) as unknown as File | undefined;
    if (!rawFile) {
      continue;
    }
    const fileUrl = await uploadSaleDeliveryVoucher(rawFile);
    files.push({
      fileName: rawFile.name,
      fileType: rawFile.type,
      fileUrl,
    });
  }
  return files;
}

async function handleSubmitDelivery() {
  if (!detail.value?.id) {
    message.warning('送货单数据不存在');
    return;
  }
  if (selectedItemIds.value.length === 0) {
    message.warning('请先勾选本次已送货的配件');
    return;
  }
  if (voucherFileList.value.length === 0) {
    message.warning('请先上传本次送货快递单');
    return;
  }
  try {
    quantityDraft.getItems();
  } catch (error) {
    message.warning((error as Error).message);
    return;
  }
  const submittedTaskId = detail.value.id;
  submitLoading.value = true;
  try {
    const payload = await quantityDraft.prepareSubmission(
      submitRemark.value.trim(),
      voucherFileList.value.map((file) => file.uid),
      uploadVoucherFiles,
    );
    const files = payload.files;
    if (files.length === 0) {
      message.warning('请先上传本次送货快递单');
      return;
    }
    await submitSaleDelivery({
      taskId: submittedTaskId,
      ...payload,
    });
    message.success('送货提交成功');
    if (detail.value?.id === submittedTaskId) {
      closeDetail();
    }
    await loadData();
  } finally {
    submitLoading.value = false;
  }
}

function closeDetail() {
  detailOpen.value = false;
}

function handleDetailAfterClose() {
  detail.value = undefined;
  detailActiveTab.value = 'items';
  detailUseMobileMode.value = false;
  resetSubmitForm();
  resetDetailPagination();
}

async function loadWarehouseOptions() {
  try {
    const warehouses = await getSaleWarehouseSimpleList();
    warehouseOptions.value = (warehouses || []).map((item: any) => ({
      label: item.name,
      value: item.id,
    }));
  } catch (error) {
    if (!isWeComWorkbench.value) {
      throw error;
    }
  }
}

function handleMobileListMediaChange(event: MediaQueryListEvent) {
  isNarrowScreen.value = event.matches;
}

function shouldSkipListAutoRefresh() {
  return (
    (typeof document !== 'undefined' && document.hidden) ||
    mobileFilterOpen.value ||
    detailOpen.value ||
    submitLoading.value ||
    mobileLoadingMore.value ||
    loading.value ||
    listAutoRefreshing
  );
}

function stopListAutoRefresh() {
  if (!listAutoRefreshTimer) {
    return;
  }
  window.clearInterval(listAutoRefreshTimer);
  listAutoRefreshTimer = undefined;
}

function startListAutoRefresh() {
  if (typeof window === 'undefined' || listAutoRefreshTimer) {
    return;
  }
  listAutoRefreshTimer = window.setInterval(() => {
    if (!shouldSkipListAutoRefresh()) {
      loadData(true).catch(() => {});
    }
  }, LIST_AUTO_REFRESH_INTERVAL);
}

watch(isMobileListMode, (current, previous) => {
  if (current === previous) {
    return;
  }
  pageNo.value = 1;
  mobilePageNo.value = 1;
  mobileHasMore.value = true;
  rows.value = [];
  checkedIds.value = [];
  loadData();
});

watch([desktopGridShellRef, detailTableWrapRef], async () => {
  await nextTick();
  observeAdaptiveTableContainers();
});

watch(detailOpen, async (open) => {
  if (!open) return;
  await nextTick();
  queueAdaptiveTableWidths();
});

onMounted(async () => {
  if (typeof window !== 'undefined') {
    if (typeof ResizeObserver !== 'undefined') {
      adaptiveResizeObserver = new ResizeObserver(queueAdaptiveTableWidths);
    }
    mobileListMediaQuery = window.matchMedia(MOBILE_LIST_MEDIA_QUERY);
    isNarrowScreen.value = mobileListMediaQuery.matches;
    if (mobileListMediaQuery.addEventListener) {
      mobileListMediaQuery.addEventListener(
        'change',
        handleMobileListMediaChange,
      );
    } else {
      mobileListMediaQuery.addListener(handleMobileListMediaChange);
    }
  }
  await loadWarehouseOptions();
  await loadData();
  startListAutoRefresh();
  await nextTick();
  observeAdaptiveTableContainers();
});

onBeforeUnmount(() => {
  stopListAutoRefresh();
  adaptiveResizeObserver?.disconnect();
  if (adaptiveResizeFrame) window.cancelAnimationFrame(adaptiveResizeFrame);
  if (!mobileListMediaQuery) {
    return;
  }
  if (mobileListMediaQuery.removeEventListener) {
    mobileListMediaQuery.removeEventListener(
      'change',
      handleMobileListMediaChange,
    );
  } else {
    mobileListMediaQuery.removeListener(handleMobileListMediaChange);
  }
});
</script>

<template>
  <Page auto-content-height>
    <div
      class="sale-delivery-page"
      :class="{
        'sale-delivery-page--mobile': isMobileListMode,
        'sale-delivery-page--workbench': isWeComWorkbench,
      }"
    >
      <div
        v-if="!isMobileListMode"
        ref="desktopGridShellRef"
        class="sale-delivery-grid-shell"
      >
        <Grid table-title="销售送货单列表">
          <template #toolbar-tools>
            <TableAction
              :actions="[
                {
                  label:
                    checkedIds.length > 0
                      ? `导出（${checkedIds.length}）`
                      : '导出',
                  type: 'primary',
                  icon: ACTION_ICON.DOWNLOAD,
                  auth: ['erp:sale-delivery:export'],
                  onClick: handleExport,
                },
              ]"
            />
          </template>
          <template #displayNo="{ row }">
            <button
              type="button"
              class="sale-delivery-number-link"
              :title="getDisplayNo(row)"
              @click.stop="openDetail(row)"
            >
              {{ getDisplayNo(row) }}
            </button>
          </template>
          <template #pickStatus="{ row }">
            <Tag :color="statusColorMap[row.pickStatus || 0]">
              {{ pickStatusTextMap[row.pickStatus || 0] || row.pickStatus }}
            </Tag>
          </template>
          <template #deliveryStatus="{ row }">
            <Tag :color="statusColorMap[row.deliveryStatus || 0]">
              {{
                deliveryStatusTextMap[row.deliveryStatus || 0] ||
                row.deliveryStatus
              }}
            </Tag>
          </template>
          <template #pickProgress="{ row }">
            <div class="sale-delivery-progress-cell">
              <Progress
                :percent="getProgressPercent(row.pickProgress)"
                :show-info="false"
                size="small"
                :status="
                  getProgressPercent(row.pickProgress) >= 100
                    ? 'success'
                    : 'active'
                "
              />
              <span>{{ row.pickProgress || '-' }}</span>
            </div>
          </template>
          <template #deliveryProgress="{ row }">
            <div class="sale-delivery-progress-cell">
              <Progress
                :percent="getProgressPercent(row.deliveryProgress)"
                :show-info="false"
                size="small"
                :status="
                  getProgressPercent(row.deliveryProgress) >= 100
                    ? 'success'
                    : 'active'
                "
              />
              <span>{{ row.deliveryProgress || '-' }}</span>
            </div>
          </template>
          <template #actions="{ row }">
            <Button type="link" size="small" @click.stop="openDetail(row)">
              详情
            </Button>
          </template>
        </Grid>
      </div>

      <Card
        v-if="isMobileListMode"
        :bordered="false"
        class="sale-delivery-list-card sale-delivery-list-card--mobile"
      >
        <div
          class="sale-delivery-mobile-panel"
          @scroll="handleMobileListScroll"
        >
          <div class="sale-delivery-mobile-toolbar">
            <div>
              <div class="sale-delivery-mobile-toolbar__title">销售送货单</div>
              <div class="sale-delivery-mobile-toolbar__count">
                共 {{ total }} 条数据
              </div>
            </div>
            <Button
              class="sale-delivery-mobile-filter-btn"
              @click="mobileFilterOpen = true"
            >
              筛选
            </Button>
          </div>
          <div v-if="rows.length > 0" class="sale-delivery-mobile-list">
            <div
              v-for="row in rows"
              :key="row.id"
              class="sale-delivery-mobile-card"
              @click="openDetail(row)"
            >
              <div class="sale-delivery-mobile-card__head">
                <div class="sale-delivery-mobile-card__main">
                  <div class="sale-delivery-mobile-card__no">
                    {{ getDisplayNo(row) }}
                  </div>
                  <div class="sale-delivery-mobile-card__customer">
                    {{ row.customerName || '-' }}
                  </div>
                  <div class="sale-delivery-mobile-card__customer">
                    仓库：{{ row.warehouseName || '-' }}
                  </div>
                </div>
                <Tag :color="statusColorMap[row.deliveryStatus || 0]">
                  {{
                    deliveryStatusTextMap[row.deliveryStatus || 0] ||
                    row.deliveryStatus
                  }}
                </Tag>
              </div>
              <div class="sale-delivery-mobile-card__grid">
                <div>
                  <span>拣货进度</span>
                  <strong>{{ row.pickProgress || '-' }}</strong>
                </div>
                <div>
                  <span>送货进度</span>
                  <strong>{{ row.deliveryProgress || '-' }}</strong>
                </div>
                <div>
                  <span>最近送货</span>
                  <strong>{{
                    formatTime(row.latestDeliveryTime) || '-'
                  }}</strong>
                </div>
                <div>
                  <span>创建时间</span>
                  <strong>{{ formatTime(row.createTime) || '-' }}</strong>
                </div>
              </div>
            </div>
          </div>
          <div v-else-if="!loading" class="sale-delivery-mobile-empty">
            暂无数据
          </div>
          <div class="sale-delivery-mobile-list-state">
            <span v-if="loading">加载中...</span>
            <span v-else-if="mobileLoadingMore">加载更多...</span>
            <span v-else-if="rows.length > 0 && !mobileHasMore"
              >已全部加载</span
            >
          </div>
        </div>
      </Card>
    </div>

    <Drawer
      v-model:open="mobileFilterOpen"
      class="sale-delivery-mobile-filter-drawer"
      placement="right"
      title="筛选"
      width="86vw"
    >
      <Form layout="vertical">
        <FormItem label="销售单号">
          <Input
            v-model:value="query.saleOutNo"
            allow-clear
            placeholder="请输入销售单号"
            @press-enter="handleMobileSearch"
          />
        </FormItem>
        <FormItem label="仓库">
          <Select
            v-model:value="query.warehouseId"
            allow-clear
            :options="warehouseOptions"
            placeholder="请选择仓库"
          />
        </FormItem>
        <FormItem label="拣货状态">
          <Select
            v-model:value="query.pickStatus"
            allow-clear
            :options="pickStatusOptions"
            placeholder="请选择拣货状态"
          />
        </FormItem>
        <FormItem label="送货状态">
          <Select
            v-model:value="query.deliveryStatus"
            allow-clear
            :options="deliveryStatusOptions"
            placeholder="请选择送货状态"
          />
        </FormItem>
      </Form>
      <template #footer>
        <div class="sale-delivery-mobile-filter-actions">
          <Button @click="handleMobileReset">重置</Button>
          <Button type="primary" @click="handleMobileSearch">查询</Button>
        </div>
      </template>
    </Drawer>

    <Modal
      v-model:open="detailOpen"
      :footer="null"
      :keyboard="true"
      :mask-closable="true"
      wrap-class-name="sale-delivery-detail-modal-wrap"
      width="min(2200px, calc(100vw - 48px))"
      title="销售送货单详情"
      @after-close="handleDetailAfterClose"
      @cancel="closeDetail"
    >
      <div
        v-if="detail"
        v-loading="detailLoading"
        class="sale-delivery-detail-content"
      >
        <div class="sale-delivery-detail-scroll">
          <Descriptions
            class="sale-delivery-detail-summary"
            bordered
            size="small"
            :column="3"
          >
            <DescriptionsItem label="销售单号">{{
              getDisplayNo(detail)
            }}</DescriptionsItem>
            <DescriptionsItem label="客户">{{
              detail.customerName
            }}</DescriptionsItem>
            <DescriptionsItem label="仓库">{{
              detail.warehouseName || '-'
            }}</DescriptionsItem>
            <DescriptionsItem label="拣货进度">{{
              detail.pickProgress
            }}</DescriptionsItem>
            <DescriptionsItem label="送货状态">
              <Tag :color="statusColorMap[detail.deliveryStatus || 0]">
                {{
                  deliveryStatusTextMap[detail.deliveryStatus || 0] ||
                  detail.deliveryStatus
                }}
              </Tag>
            </DescriptionsItem>
            <DescriptionsItem label="送货进度">{{
              detail.deliveryProgress
            }}</DescriptionsItem>
            <DescriptionsItem label="件数合计">
              {{ formatTotalPieceCount(detail.totalPieceCount) }}
            </DescriptionsItem>
            <DescriptionsItem label="最近送货">{{
              formatTime(detail.latestDeliveryTime)
            }}</DescriptionsItem>
          </Descriptions>
          <div class="sale-delivery-mobile-summary">
            <div class="sale-delivery-mobile-summary__head">
              <div>
                <div class="sale-delivery-mobile-summary__no">
                  {{ getDisplayNo(detail) }}
                </div>
                <div class="sale-delivery-mobile-summary__customer">
                  {{ detail.customerName || '-' }}
                </div>
                <div class="sale-delivery-mobile-summary__customer">
                  仓库：{{ detail.warehouseName || '-' }}
                </div>
              </div>
              <Tag :color="statusColorMap[detail.deliveryStatus || 0]">
                {{
                  deliveryStatusTextMap[detail.deliveryStatus || 0] ||
                  detail.deliveryStatus
                }}
              </Tag>
            </div>
            <div class="sale-delivery-mobile-summary__grid">
              <div>
                <span>拣货进度</span>
                <strong>{{ detail.pickProgress || '-' }}</strong>
              </div>
              <div>
                <span>送货进度</span>
                <strong>{{ detail.deliveryProgress || '-' }}</strong>
              </div>
              <div>
                <span>件数合计</span>
                <strong>{{
                  formatTotalPieceCount(detail.totalPieceCount)
                }}</strong>
              </div>
              <div class="sale-delivery-mobile-summary__wide">
                <span>最近送货</span>
                <strong>{{
                  formatTime(detail.latestDeliveryTime) || '-'
                }}</strong>
              </div>
            </div>
          </div>
          <Alert
            v-if="detail.legacyHistoryWarning"
            class="sale-delivery-history-warning"
            message="历史提交未记录逐配件数量，无法准确归属到当前仓库；请以销售单累计履约明细和整单提交记录为准。"
            show-icon
            type="warning"
          />
          <Space v-if="detailUseMobileMode" class="sale-delivery-mobile-tabs">
            <Button
              :type="detailActiveTab === 'items' ? 'primary' : 'default'"
              @click="handleDetailTabChange('items')"
              >配件明细</Button
            >
            <Button
              :type="detailActiveTab === 'submits' ? 'primary' : 'default'"
              @click="handleDetailTabChange('submits')"
              >提交记录</Button
            >
          </Space>
          <div
            v-if="detailActiveTab === 'items'"
            class="sale-delivery-mobile-section-head"
          >
            <div>
              <strong>送货明细</strong>
              <span>点击明细卡片即可选择或取消</span>
            </div>
            <Tag :color="selectedItemIds.length > 0 ? 'processing' : 'default'">
              已选 {{ selectedItemIds.length }} 条
            </Tag>
          </div>
          <div ref="detailTableWrapRef">
            <Tabs
              class="sale-delivery-detail-tabs"
              :active-key="detailActiveTab"
              @change="handleDetailTabChange"
            >
              <Tabs.TabPane key="items" tab="配件明细">
                <Table
                  class="sale-delivery-detail-table"
                  bordered
                  row-key="id"
                  size="small"
                  :columns="adaptiveItemColumns"
                  :data-source="detailItems"
                  :loading="detailItemsLoading"
                  :pagination="detailItemPagination"
                  :row-selection="detailItemRowSelection"
                  :scroll="{ x: detailItemScrollX }"
                  :custom-row="buildDetailItemCustomRow"
                >
                  <template #bodyCell="{ column, record, text }">
                    <template v-if="column.dataIndex === 'deliveryStatus'">
                      <Tag :color="statusColorMap[record.deliveryStatus]">
                        {{
                          deliveryStatusTextMap[record.deliveryStatus] ||
                          record.deliveryStatus
                        }}
                      </Tag>
                    </template>
                    <template v-else-if="column.dataIndex === 'deliveryTime'">
                      {{ formatTime(text) }}
                    </template>
                    <template v-else-if="isQuantityColumn(column.dataIndex)">
                      {{ formatPickDeliveryQuantity(text) }}
                    </template>
                    <template v-else-if="column.dataIndex === 'submitQuantity'">
                      <Input
                        v-model:value="quantities[record.id]"
                        inputmode="decimal"
                        :aria-label="`${record.productName || '配件'}本次送货数量`"
                        :disabled="
                          submitLoading ||
                          !canSelectDeliveryItem(record) ||
                          !isDetailItemSelected(record.id)
                        "
                        placeholder="最多6位小数"
                        @click.stop
                      />
                    </template>
                    <template v-else-if="column.dataIndex === 'pieceCount'">
                      {{ formatPieceCount(record) }}
                    </template>
                  </template>
                </Table>
              </Tabs.TabPane>
              <Tabs.TabPane key="submits" tab="提交记录">
                <Table
                  class="sale-delivery-submit-table"
                  bordered
                  row-key="id"
                  size="small"
                  :columns="adaptiveSubmitColumns"
                  :data-source="detailSubmits"
                  :loading="detailSubmitsLoading"
                  :pagination="detailSubmitPagination"
                  :scroll="{ x: detailSubmitScrollX }"
                >
                  <template #expandedRowRender="{ record }">
                    <SubmitItems
                      v-if="detail?.id"
                      kind="delivery"
                      :parent-id="detail.id"
                      :submit="record"
                    />
                  </template>
                  <template #bodyCell="{ column, record, text }">
                    <template v-if="column.dataIndex === 'submitTime'">
                      {{ formatTime(text) }}
                    </template>
                    <template v-else-if="column.dataIndex === 'files'">
                      <Space wrap>
                        <a
                          v-for="file in record.files || []"
                          :key="file.id || file.fileUrl"
                          :href="file.fileUrl"
                          target="_blank"
                        >
                          {{ file.fileName || '凭证' }}
                        </a>
                      </Space>
                    </template>
                  </template>
                </Table>
              </Tabs.TabPane>
            </Tabs>
          </div>
          <div
            v-show="detailActiveTab === 'items'"
            class="sale-delivery-mobile-detail-list"
          >
            <div
              v-for="item in detailItems"
              :key="item.id"
              class="sale-delivery-mobile-detail-card"
              :class="{
                'sale-delivery-mobile-detail-card--available':
                  canSelectDeliveryItem(item),
                'sale-delivery-mobile-detail-card--selected':
                  isDetailItemSelected(item.id),
                'sale-delivery-mobile-detail-card--disabled':
                  !canSelectDeliveryItem(item),
              }"
              @click="toggleDetailItem(item)"
            >
              <div class="sale-delivery-mobile-detail-card__head">
                <Checkbox
                  :checked="isDetailItemSelected(item.id)"
                  :disabled="submitLoading || !canSelectDeliveryItem(item)"
                  @click.stop
                  @change="toggleDetailItem(item)"
                />
                <div class="sale-delivery-mobile-detail-card__main">
                  <div class="sale-delivery-mobile-detail-card__name">
                    {{ item.productName || '-' }}
                  </div>
                  <div class="sale-delivery-mobile-detail-card__code">
                    {{ item.productCode || '-' }}
                  </div>
                </div>
                <Tag :color="statusColorMap[item.deliveryStatus || 0]">
                  {{
                    deliveryStatusTextMap[item.deliveryStatus || 0] ||
                    item.deliveryStatus
                  }}
                </Tag>
              </div>
              <div class="sale-delivery-mobile-detail-card__grid">
                <div>
                  <span>仓库</span>
                  <strong>{{ item.warehouseName || '-' }}</strong>
                </div>
                <div>
                  <span>仓位</span>
                  <strong>{{ item.warehousePosition || '-' }}</strong>
                </div>
                <div>
                  <span>应发数量</span>
                  <strong>{{
                    formatPickDeliveryQuantity(item.count ?? '-')
                  }}</strong>
                </div>
                <div>
                  <span>已拣数量</span
                  ><strong>{{
                    formatPickDeliveryQuantity(item.pickedCount)
                  }}</strong>
                </div>
                <div>
                  <span>已送数量</span
                  ><strong>{{
                    formatPickDeliveryQuantity(item.deliveredCount)
                  }}</strong>
                </div>
                <div>
                  <span>当前可送</span
                  ><strong>{{ quantityDraft.remaining(item) }}</strong>
                </div>
                <div>
                  <span>剩余未送</span
                  ><strong>{{
                    formatPickDeliveryQuantity(item.remainingDeliveryCount)
                  }}</strong>
                </div>
                <div class="sale-delivery-quantity-input" @click.stop>
                  <span>本次送货数量</span>
                  <Input
                    v-if="item.id"
                    v-model:value="quantities[item.id]"
                    inputmode="decimal"
                    :aria-label="`${item.productName || '配件'}本次送货数量`"
                    :disabled="
                      submitLoading ||
                      !canSelectDeliveryItem(item) ||
                      !isDetailItemSelected(item.id)
                    "
                    placeholder="最多6位小数"
                  />
                </div>
                <div>
                  <span>包装数</span>
                  <strong>{{ item.packageQty ?? '-' }}</strong>
                </div>
                <div>
                  <span>件数</span>
                  <strong>{{ formatPieceCount(item) }}</strong>
                </div>
                <div>
                  <span>送货人</span>
                  <strong>{{ item.deliveryUserName || '-' }}</strong>
                </div>
                <div>
                  <span>送货时间</span>
                  <strong>{{ formatTime(item.deliveryTime) || '-' }}</strong>
                </div>
              </div>
            </div>
            <div
              v-if="!detailItemsLoading && detailItems.length === 0"
              class="sale-delivery-mobile-empty"
            >
              暂无明细
            </div>
            <div
              v-if="detailItemsTotal > 0"
              class="sale-delivery-mobile-load-more"
            >
              <span
                >已显示 {{ detailItems.length }}/{{ detailItemsTotal }} 条</span
              >
              <Button
                v-if="canLoadMoreDetailItems"
                block
                :loading="detailItemsLoading"
                @click="loadMoreDetailItems"
              >
                加载更多
              </Button>
            </div>
          </div>
          <div
            v-if="detailUseMobileMode && detailActiveTab === 'submits'"
            class="sale-delivery-mobile-submit-list"
          >
            <div
              v-for="record in detailSubmits"
              :key="record.id"
              class="sale-delivery-mobile-submit-card"
            >
              <div>
                {{ record.submitUserName || '-' }} ·
                {{ formatTime(record.submitTime) }}
              </div>
              <div>
                明细 {{ record.itemCount }} 条 · {{ record.remark || '无备注' }}
              </div>
              <Space wrap>
                <a
                  v-for="file in record.files || []"
                  :key="file.id || file.fileUrl"
                  :href="file.fileUrl"
                  target="_blank"
                  >{{ file.fileName || '凭证' }}</a
                >
                <Button
                  size="small"
                  @click="
                    expandedSubmitId =
                      expandedSubmitId === record.id ? undefined : record.id
                  "
                  >{{
                    expandedSubmitId === record.id
                      ? '收起数量明细'
                      : '查看数量明细'
                  }}</Button
                >
              </Space>
              <SubmitItems
                v-if="expandedSubmitId === record.id && detail?.id"
                kind="delivery"
                :parent-id="detail.id"
                :submit="record"
              />
            </div>
            <div v-if="!detailSubmitsLoading && detailSubmits.length === 0">
              暂无提交记录
            </div>
            <Pagination
              size="small"
              :current="detailSubmitsPageNo"
              :page-size="DETAIL_PAGE_SIZE"
              :total="detailSubmitsTotal"
              :show-size-changer="false"
              @change="handleDetailSubmitsPageChange"
            />
          </div>
        </div>
        <div class="sale-delivery-submit-panel">
          <div class="sale-delivery-submit-panel__header">
            <div>
              <div class="sale-delivery-submit-panel__title">本次送货提交</div>
              <div class="sale-delivery-submit-panel__hint">
                已拣数量可立即分批送货；勾选黄色明细并填写本次数量，上传快递单后提交。
              </div>
            </div>
            <div class="sale-delivery-submit-panel__tags">
              <Tag
                :color="selectedItemIds.length > 0 ? 'processing' : 'default'"
              >
                已选 {{ selectedItemIds.length }} 条
              </Tag>
              <Tag :color="deliverableItemCount > 0 ? 'processing' : 'success'">
                可送 {{ deliverableItemCount }} 条
              </Tag>
            </div>
          </div>
          <div class="sale-delivery-submit-panel__body">
            <Upload
              :before-upload="beforeVoucherUpload"
              :file-list="voucherFileList"
              :max-count="9"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              list-type="picture"
              multiple
              @remove="handleVoucherRemove"
            >
              <Button
                class="sale-delivery-submit-panel__upload"
                :disabled="deliverableItemCount === 0"
              >
                上传快递单（{{ voucherFileList.length }}/9）
              </Button>
            </Upload>
            <Input
              v-model:value="submitRemark"
              allow-clear
              placeholder="备注，可选"
            />
            <Space class="sale-delivery-submit-panel__actions">
              <Button
                class="sale-delivery-submit-panel__primary"
                type="primary"
                :disabled="!canSubmitDelivery"
                :loading="submitLoading"
                @click="handleSubmitDelivery"
              >
                {{
                  selectedItemIds.length > 0
                    ? `提交送货（${selectedItemIds.length}）`
                    : '提交送货'
                }}
              </Button>
              <Button :disabled="submitLoading" @click="resetSubmitForm"
                >清空</Button
              >
            </Space>
          </div>
        </div>
      </div>
    </Modal>
  </Page>
</template>

<style scoped>
.sale-delivery-page {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
}

.sale-delivery-grid-shell {
  position: relative;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
}

.sale-delivery-grid-shell :deep(.vxe-table--render-default),
.sale-delivery-grid-shell :deep(.vxe-grid--form-wrapper) {
  font-size: 12px;
}

.sale-delivery-search-card {
  flex: 0 0 auto;
}

.sale-delivery-search-card :deep(.ant-card-body) {
  padding: 16px 20px 4px;
}

.sale-delivery-search-form {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr)) auto;
  gap: 0 16px;
  align-items: end;
}

.sale-delivery-search-form :deep(.ant-form-item) {
  margin-bottom: 12px;
}

.sale-delivery-search-form :deep(.ant-form-item-label) {
  padding-bottom: 6px;
}

.sale-delivery-search-control {
  width: 100%;
}

.sale-delivery-search-actions {
  min-width: 144px;
}

.sale-delivery-search-actions :deep(.ant-space) {
  width: 100%;
  justify-content: flex-end;
}

.sale-delivery-list-card {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
}

.sale-delivery-list-card :deep(.ant-card-head) {
  min-height: 54px;
  flex: 0 0 auto;
  padding: 0 16px;
  border-bottom-color: #e5e7eb;
}

.sale-delivery-list-card :deep(.ant-card-head-title) {
  padding: 14px 0;
}

.sale-delivery-list-card :deep(.ant-card-extra) {
  padding: 10px 0;
}

.sale-delivery-list-card :deep(.ant-card-body) {
  display: flex;
  min-height: 0;
  flex-direction: column;
  flex: 1 1 auto;
  padding: 0 16px 12px;
}

.sale-delivery-list-title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  color: #1f2937;
  font-weight: 600;
}

.sale-delivery-list-count,
.sale-delivery-selected-count {
  color: #8c8c8c;
  font-size: 12px;
  font-weight: 400;
}

.sale-delivery-number-link {
  max-width: 100%;
  padding: 0;
  border: 0;
  color: #1677ff;
  cursor: pointer;
  background: transparent;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-delivery-number-link:hover {
  color: #4096ff;
  text-decoration: underline;
}

.sale-delivery-progress-cell {
  display: grid;
  grid-template-columns: minmax(62px, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-width: 118px;
}

.sale-delivery-progress-cell :deep(.ant-progress) {
  margin: 0;
  line-height: 1;
}

.sale-delivery-progress-cell span {
  min-width: 32px;
  color: #595959;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.sale-delivery-list-table {
  min-height: 0;
  flex: 1 1 auto;
  margin-top: 12px;
}

.sale-delivery-list-table :deep(.ant-spin-nested-loading),
.sale-delivery-list-table :deep(.ant-spin-container),
.sale-delivery-list-table :deep(.ant-table),
.sale-delivery-list-table :deep(.ant-table-container) {
  height: 100%;
}

.sale-delivery-list-table :deep(.ant-spin-container),
.sale-delivery-list-table :deep(.ant-table-container) {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.sale-delivery-list-table :deep(.ant-table-header) {
  flex: 0 0 auto;
}

.sale-delivery-list-table :deep(.ant-table-body) {
  min-height: 0;
  flex: 1 1 0;
}

.sale-delivery-list-table :deep(.ant-table-placeholder) {
  height: 100%;
}

.sale-delivery-list-table :deep(.ant-table-placeholder .ant-table-cell) {
  height: 100%;
}

.sale-delivery-pagination {
  display: flex;
  flex: 0 0 auto;
  justify-content: flex-end;
  padding-top: 12px;
}

.sale-delivery-mobile-list,
.sale-delivery-mobile-summary,
.sale-delivery-mobile-section-head,
.sale-delivery-mobile-detail-list,
.sale-delivery-mobile-submit-list,
.sale-delivery-mobile-empty {
  display: none;
}

.sale-delivery-mobile-card,
.sale-delivery-mobile-summary,
.sale-delivery-mobile-detail-card,
.sale-delivery-mobile-submit-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.sale-delivery-mobile-card {
  padding: 12px;
  cursor: pointer;
}

.sale-delivery-mobile-card__head,
.sale-delivery-mobile-summary__head,
.sale-delivery-mobile-detail-card__head,
.sale-delivery-mobile-submit-card__head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.sale-delivery-mobile-card__main,
.sale-delivery-mobile-detail-card__main {
  min-width: 0;
  flex: 1;
}

.sale-delivery-mobile-card__no,
.sale-delivery-mobile-summary__no,
.sale-delivery-mobile-detail-card__name {
  overflow: hidden;
  color: #1f2937;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-delivery-mobile-card__customer,
.sale-delivery-mobile-summary__customer,
.sale-delivery-mobile-detail-card__code,
.sale-delivery-mobile-submit-card__head span,
.sale-delivery-mobile-submit-card__meta,
.sale-delivery-mobile-submit-card__remark {
  margin-top: 2px;
  color: #6b7280;
  font-size: 12px;
}

.sale-delivery-mobile-card__grid,
.sale-delivery-mobile-summary__grid,
.sale-delivery-mobile-detail-card__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  margin-top: 10px;
}

.sale-delivery-mobile-card__grid span,
.sale-delivery-mobile-summary__grid span,
.sale-delivery-mobile-detail-card__grid span {
  display: block;
  color: #8c8c8c;
  font-size: 12px;
}

.sale-delivery-mobile-card__grid strong,
.sale-delivery-mobile-summary__grid strong,
.sale-delivery-mobile-detail-card__grid strong {
  display: block;
  overflow-wrap: anywhere;
  color: #1f2937;
  font-size: 13px;
  font-weight: 500;
}

.sale-delivery-mobile-summary {
  padding: 14px;
  border: 0;
  background: linear-gradient(135deg, #f7fbff 0%, #ffffff 56%, #f8fbff 100%);
  box-shadow: inset 0 0 0 1px #e5edf7;
}

.sale-delivery-mobile-summary__head {
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.sale-delivery-mobile-summary__head > div {
  min-width: 0;
}

.sale-delivery-mobile-summary__no {
  font-size: 15px;
  line-height: 22px;
}

.sale-delivery-mobile-summary__customer {
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-delivery-mobile-summary__grid {
  padding-top: 10px;
  border-top: 1px solid #eef2f7;
}

.sale-delivery-mobile-summary__wide {
  grid-column: 1 / -1;
}

.sale-delivery-mobile-section-head {
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
}

.sale-delivery-mobile-section-head > div {
  min-width: 0;
}

.sale-delivery-mobile-section-head strong {
  display: block;
  color: #111827;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

.sale-delivery-mobile-section-head span {
  display: block;
  overflow: hidden;
  color: #6b7280;
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-delivery-grid-shell :deep(.sale-delivery-clickable-row) {
  cursor: pointer;
}

.sale-delivery-grid-shell
  :deep(.sale-delivery-clickable-row.row--hover .vxe-body--column) {
  background: #f5f8ff;
}

.sale-delivery-page :deep(.sale-delivery-detail-row) {
  cursor: pointer;
}

.sale-delivery-page :deep(.sale-delivery-detail-row:hover > td) {
  background: #f5f8ff;
}

.sale-delivery-page :deep(.sale-delivery-detail-row--disabled) {
  cursor: not-allowed;
}

.sale-delivery-page :deep(.sale-delivery-detail-row--disabled:hover > td) {
  background: inherit;
}

:global(.sale-delivery-detail-modal-wrap .ant-modal-body) {
  max-height: calc(100vh - 180px);
  overflow-y: auto;
  padding-bottom: 0;
}

.sale-delivery-detail-content,
.sale-delivery-detail-scroll {
  min-height: 0;
}

.sale-delivery-detail-tabs {
  margin-top: 12px;
}

.sale-delivery-submit-panel {
  position: sticky;
  z-index: 3;
  bottom: 0;
  margin: 12px -24px 0;
  padding: 12px 24px;
  border: 1px solid #e5e7eb;
  border-width: 1px 0 0;
  border-radius: 0 0 8px 8px;
  background: #fafafa;
  box-shadow: 0 -8px 20px rgb(15 23 42 / 8%);
}

.sale-delivery-submit-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.sale-delivery-submit-panel__title {
  color: #1f2937;
  font-weight: 600;
}

.sale-delivery-submit-panel__hint {
  margin-top: 4px;
  color: #6b7280;
  font-size: 12px;
}

.sale-delivery-submit-panel__tags {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.sale-delivery-submit-panel__body {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(220px, 1fr) auto;
  gap: 12px;
  align-items: flex-start;
  margin-top: 12px;
}

.sale-delivery-submit-panel__body :deep(.ant-upload-wrapper) {
  width: 100%;
}

.sale-delivery-submit-panel__upload,
.sale-delivery-submit-panel__actions {
  width: 100%;
}

.sale-delivery-submit-panel__primary {
  min-height: 36px;
  font-weight: 600;
}

.sale-delivery-mobile-detail-card {
  position: relative;
  padding: 12px;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.sale-delivery-mobile-detail-card--selected {
  border-color: #1677ff;
  background: #fffbe6;
  box-shadow: 0 8px 20px rgb(22 119 255 / 10%);
}

.sale-delivery-mobile-detail-card--disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.sale-delivery-mobile-submit-card {
  padding: 10px 12px;
}

.sale-delivery-mobile-submit-card__head {
  justify-content: space-between;
}

.sale-delivery-mobile-submit-card__files {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin-top: 8px;
}

.sale-delivery-mobile-submit-card__files a,
.sale-delivery-mobile-submit-card__remark {
  overflow-wrap: anywhere;
}

.sale-delivery-mobile-load-more {
  display: grid;
  gap: 8px;
  justify-items: center;
  padding: 4px 0 2px;
  color: #6b7280;
  font-size: 12px;
}

@media (max-width: 960px) {
  .sale-delivery-submit-panel__body {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .sale-delivery-page {
    min-height: calc(100dvh - 190px);
    gap: 8px;
  }

  .sale-delivery-search-card :deep(.ant-card-body),
  .sale-delivery-list-card :deep(.ant-card-body) {
    padding: 10px;
  }

  .sale-delivery-search-card :deep(.ant-form) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .sale-delivery-search-card :deep(.ant-form-item) {
    margin-right: 0;
    margin-bottom: 0;
  }

  .sale-delivery-search-item--wide,
  .sale-delivery-search-actions {
    grid-column: 1 / -1;
  }

  .sale-delivery-search-card :deep(.ant-form-item-label) {
    display: none;
  }

  .sale-delivery-search-card :deep(.ant-form-item-control) {
    width: 100%;
  }

  .sale-delivery-search-actions :deep(.ant-space) {
    display: grid;
    width: 100%;
    grid-template-columns: 1.15fr 1fr 1fr;
    gap: 8px;
  }

  .sale-delivery-search-actions :deep(.ant-space-item),
  .sale-delivery-search-actions :deep(.ant-btn) {
    width: 100%;
  }

  .sale-delivery-search-control,
  .sale-delivery-search-card :deep(.ant-input),
  .sale-delivery-search-card :deep(.ant-select) {
    width: 100%;
  }

  .sale-delivery-list-table {
    display: none;
  }

  .sale-delivery-mobile-list {
    display: grid;
    flex: 1 1 auto;
    align-content: start;
    gap: 8px;
  }

  .sale-delivery-mobile-empty {
    display: flex;
    min-height: 120px;
    align-items: center;
    justify-content: center;
    color: #8c8c8c;
  }

  .sale-delivery-pagination {
    justify-content: center;
    overflow-x: auto;
    padding-top: 8px;
  }

  .sale-delivery-pagination :deep(.ant-pagination-options-quick-jumper) {
    display: none;
  }

  .sale-delivery-pagination :deep(.ant-pagination-options) {
    margin-inline-start: 4px;
  }

  :global(.sale-delivery-detail-modal-wrap .ant-modal) {
    top: 0;
    width: 100vw !important;
    max-width: 100vw;
    margin: 0 auto;
  }

  :global(.sale-delivery-detail-modal-wrap .ant-modal-content) {
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
    overflow: hidden;
  }

  :global(.sale-delivery-detail-modal-wrap .ant-modal-header) {
    margin-bottom: 0;
    padding: 14px 16px 10px;
    border-bottom: 1px solid #eef2f7;
  }

  :global(.sale-delivery-detail-modal-wrap .ant-modal-close) {
    top: 8px;
  }

  :global(.sale-delivery-detail-modal-wrap .ant-modal-body) {
    height: calc(100dvh - 54px);
    max-height: none;
    overflow: hidden;
    padding: 0;
    background: #f5f7fb;
  }

  .sale-delivery-detail-content {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
  }

  .sale-delivery-detail-scroll {
    flex: 1 1 auto;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 12px 12px 10px;
    scrollbar-width: none;
  }

  .sale-delivery-detail-scroll::-webkit-scrollbar {
    display: none;
  }

  .sale-delivery-detail-summary {
    display: none;
  }

  .sale-delivery-mobile-summary {
    display: block;
  }

  .sale-delivery-mobile-section-head {
    display: flex;
  }

  .sale-delivery-detail-table,
  .sale-delivery-submit-table,
  .sale-delivery-detail-tabs {
    display: none;
  }

  .sale-delivery-mobile-detail-list,
  .sale-delivery-mobile-submit-list {
    display: grid;
    gap: 8px;
    margin-top: 8px;
    padding-bottom: 8px;
  }

  .sale-delivery-submit-panel {
    position: relative;
    bottom: auto;
    flex: 0 0 auto;
    margin: 0;
    box-sizing: border-box;
    padding: 10px 12px calc(56px + env(safe-area-inset-bottom));
    border: 0;
    border-radius: 12px 12px 0 0;
    background: #fff;
    box-shadow:
      0 -10px 24px rgb(15 23 42 / 12%),
      inset 0 1px 0 #e5e7eb;
    overflow: visible;
  }

  .sale-delivery-submit-panel__header {
    flex-direction: column;
    gap: 6px;
  }

  .sale-delivery-submit-panel__hint {
    display: none;
  }

  .sale-delivery-submit-panel__tags {
    width: 100%;
    justify-content: flex-start;
  }

  .sale-delivery-submit-panel__body {
    gap: 10px;
    margin-top: 10px;
  }

  .sale-delivery-submit-panel__body :deep(.ant-upload-select),
  .sale-delivery-submit-panel__body :deep(.ant-upload-list),
  .sale-delivery-submit-panel__body :deep(.ant-upload-list-item-container) {
    width: 100%;
  }

  .sale-delivery-submit-panel__body :deep(.ant-upload-list-item-name) {
    overflow-wrap: anywhere;
  }

  .sale-delivery-mobile-detail-card__head {
    align-items: flex-start;
  }

  .sale-delivery-mobile-detail-card__name {
    display: -webkit-box;
    overflow: hidden;
    line-height: 20px;
    text-overflow: initial;
    white-space: normal;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .sale-delivery-mobile-detail-card__grid {
    padding-top: 8px;
    border-top: 1px dashed #e5e7eb;
  }

  .sale-delivery-submit-panel__body :deep(.ant-input) {
    min-height: 44px;
  }

  .sale-delivery-submit-panel__body :deep(.ant-btn) {
    width: 100%;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
  }

  .sale-delivery-submit-panel__actions {
    display: grid !important;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    gap: 12px;
  }

  .sale-delivery-submit-panel__actions :deep(.ant-space-item) {
    min-width: 0;
  }

  .sale-delivery-submit-panel__primary {
    min-height: 44px;
  }
}

.sale-delivery-page--mobile {
  height: calc(100dvh - 112px);
  min-height: 0;
  gap: 0;
  background: #f2f4f7;
}

.sale-delivery-page--workbench {
  height: 100dvh;
}

.sale-delivery-list-card--mobile {
  overflow: hidden;
  background: #f2f4f7;
}

.sale-delivery-list-card--mobile :deep(.ant-card-body) {
  height: 100%;
  padding: 0;
  background: #f2f4f7;
}

.sale-delivery-mobile-panel {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  overflow-y: auto;
  padding: 0 12px 14px;
  background: #f2f4f7;
}

.sale-delivery-mobile-toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 -12px 12px;
  padding: 12px;
  background: #fff;
  box-shadow: 0 1px 6px rgb(15 23 42 / 8%);
}

.sale-delivery-mobile-toolbar__title {
  color: #111827;
  font-size: 17px;
  font-weight: 700;
  line-height: 24px;
}

.sale-delivery-mobile-toolbar__count {
  margin-top: 2px;
  color: #6b7280;
  font-size: 13px;
  line-height: 18px;
}

.sale-delivery-mobile-filter-btn {
  flex: 0 0 auto;
}

.sale-delivery-page--mobile .sale-delivery-mobile-list {
  display: grid;
  flex: 0 0 auto;
  align-content: start;
  gap: 10px;
}

.sale-delivery-page--mobile .sale-delivery-mobile-card {
  background: #fff;
  box-shadow: 0 1px 4px rgb(15 23 42 / 6%);
}

.sale-delivery-page--mobile .sale-delivery-mobile-empty {
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
  color: #8c8c8c;
}

.sale-delivery-mobile-list-state {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  font-size: 12px;
}

.sale-delivery-mobile-filter-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.sale-delivery-mobile-filter-actions .ant-btn {
  width: 100%;
}

:global(.ant-table-tbody > tr.sale-delivery-detail-row--available > td),
:global(.ant-table-tbody > tr.sale-delivery-detail-row--available:hover > td),
:global(
  .ant-table-tbody
    > tr.sale-delivery-detail-row--available.ant-table-row-selected
    > td
) {
  color: #3d2e00;
  background: #fffbe6 !important;
}

.sale-delivery-mobile-detail-card--available {
  color: #3d2e00;
  background: #fffbe6;
}

.sale-delivery-mobile-detail-card--available strong,
.sale-delivery-mobile-detail-card--available
  .sale-delivery-mobile-detail-card__name {
  color: #3d2e00;
}

.sale-delivery-quantity-input {
  grid-column: 1 / -1;
}

:global(
  .ant-table-tbody > tr.sale-delivery-detail-row--available .ant-tag-default
),
.sale-delivery-mobile-detail-card--available :deep(.ant-tag-default) {
  color: #614700;
  background: #fff1b8;
  border-color: #e8c95a;
}
</style>
