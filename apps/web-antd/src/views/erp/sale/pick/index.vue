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
  exportSalePick,
  getSalePick,
  getSalePickItemPage,
  getSalePickPage,
  getSalePickSubmitPage,
  submitSalePick,
  uploadSalePickVoucher,
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

defineOptions({ name: 'ErpSalePick' });

const route = useRoute();
const DETAIL_PAGE_SIZE = 10;
const LIST_AUTO_REFRESH_INTERVAL = 10_000;
const MOBILE_LIST_MEDIA_QUERY = '(max-width: 768px)';

const pickStatusOptions = [
  { label: '待拣货', value: 10 },
  { label: '部分拣货', value: 20 },
  { label: '已拣货', value: 30 },
];

const pickSourceTypeOptions = [
  { label: '销售手推车', value: 30 },
  { label: '销售退货', value: 70 },
  { label: '仓库移货', value: 80 },
  { label: '其它入库', value: 90 },
  { label: '其它出库', value: 100 },
];

const pickSourceTypeNameMap: Record<number, string> = {
  0: '销售单',
  30: '销售手推车',
  70: '销售退货',
  80: '仓库移货',
  90: '其它入库',
  100: '其它出库',
};

const sourceTypeColorMap: Record<number, string> = {
  0: 'default',
  30: 'blue',
  70: 'orange',
  80: 'purple',
  90: 'cyan',
  100: 'geekblue',
};

const statusColorMap: Record<number, string> = {
  10: 'default',
  20: 'processing',
  30: 'success',
};

const statusTextMap: Record<number, string> = {
  10: '待拣货',
  20: '部分拣货',
  30: '已拣货',
};

const query = reactive({
  saleOutNo: '',
  sourceType: undefined as number | undefined,
  warehouseId: undefined as number | undefined,
  status: undefined as number | undefined,
});
const sourceTypeChooserOpen = ref(false);
const sourceTypeSelectionRequired = ref(true);
const sourceTypeChanging = ref(false);
const pageNo = ref(1);
const pageSize = ref(20);
const total = ref(0);
const loading = ref(false);
const rows = ref<ErpSalePickDeliveryApi.PickTask[]>([]);
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
const detail = ref<ErpSalePickDeliveryApi.PickTask>();
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
const quantityDraft = usePickDeliveryQuantities('pick');
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
const currentSourceTypeName = computed(() =>
  getSourceTypeName({ sourceType: query.sourceType }),
);
let mobileListMediaQuery: MediaQueryList | undefined;
let listAutoRefreshTimer: number | undefined;
let listAutoRefreshing = false;
let listRequestToken = 0;
let adaptiveResizeFrame = 0;
let adaptiveResizeObserver: ResizeObserver | undefined;
let lastDesktopGridWidth = 0;

const DETAIL_SELECTION_WIDTH = 48;

const pickGridColumns: any[] = [
  { type: 'checkbox', width: 44 },
  {
    field: 'displayNo',
    slots: { default: 'displayNo' },
    title: '业务单号',
    width: 150,
  },
  {
    field: 'sourceTypeName',
    slots: { default: 'sourceTypeName' },
    title: '拣货来源',
    width: 120,
  },
  { field: 'customerName', title: '往来单位', width: 180 },
  { field: 'warehouseName', title: '仓库', width: 140 },
  {
    field: 'status',
    slots: { default: 'status' },
    title: '拣货状态',
    width: 110,
  },
  {
    field: 'pickProgress',
    slots: { default: 'pickProgress' },
    title: '拣货进度',
    width: 150,
  },
  {
    field: 'latestPickTime',
    formatter: 'formatDateTime',
    title: '最近拣货时间',
    width: 170,
  },
  {
    field: 'completeTime',
    formatter: 'formatDateTime',
    title: '拣货完成时间',
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
  { title: '配件编码', dataIndex: 'productCode', width: 120 },
  { title: '规格', dataIndex: 'standard', width: 120 },
  { title: '仓位', dataIndex: 'warehousePosition', width: 120 },
  { title: '数量', dataIndex: 'count', width: 90 },
  { title: '已拣数量', dataIndex: 'pickedCount', width: 100 },
  { title: '剩余数量', dataIndex: 'remainingPickCount', width: 100 },
  { title: '本次拣货数量', dataIndex: 'submitQuantity', width: 150 },
  { title: '包装数', dataIndex: 'packageQty', width: 90 },
  { title: '件数', dataIndex: 'pieceCount', width: 90 },
  { title: '状态', dataIndex: 'pickStatus', width: 90 },
  { title: '拣货人', dataIndex: 'pickUserName', width: 110 },
  { title: '拣货时间', dataIndex: 'pickTime', width: 170 },
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

function buildAdaptivePickGridColumns(
  currentRows: ErpSalePickDeliveryApi.PickTask[] = rows.value,
) {
  const prepared = prepareSaleDocumentListColumns(
    pickGridColumns,
    currentRows,
  ) as any[];
  const customized = applySaleDocumentListColumnCustomization(
    prepared,
    gridApi.grid?.getFullColumns?.() ?? [],
    90,
  );
  return fitPickDeliveryTableColumns(customized, getDesktopGridWidth());
}

async function reloadAdaptivePickGridColumns() {
  if (isMobileListMode.value || !gridApi.grid) return;
  const columns = buildAdaptivePickGridColumns();
  gridApi.setGridOptions({ columns });
  await gridApi.grid.reloadColumn?.(columns);
  await gridApi.grid.refreshColumn?.();
  await gridApi.grid.recalculate?.(true);
}

function refreshAdaptiveTableWidths() {
  const desktopWidth = getDesktopGridWidth();
  if (desktopWidth > 0 && desktopWidth !== lastDesktopGridWidth) {
    lastDesktopGridWidth = desktopWidth;
    void reloadAdaptivePickGridColumns();
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
    disabled: submitLoading.value || !canSelectPickItem(record),
  }),
  onChange: (keys: number[]) => {
    updateDetailSelection(keys);
  },
}));

function canSelectPickItem(record: ErpSalePickDeliveryApi.ItemResp) {
  return (
    !!record.id &&
    hasAccessByCodes(['erp:sale-pick:pick']) &&
    detail.value?.warehouseOperable === true &&
    Number(quantityDraft.remaining(record)) > 0
  );
}

function updateDetailSelection(keys: number[]) {
  if (!submitLoading.value)
    quantityDraft.setSelection(keys, detailItems.value, canSelectPickItem);
}

const pendingItemCount = computed(() =>
  Math.max(
    (detail.value?.totalItemCount || 0) - (detail.value?.pickedItemCount || 0),
    0,
  ),
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

const canSubmitPick = computed(
  () =>
    !!detail.value?.id &&
    hasAccessByCodes(['erp:sale-pick:pick']) &&
    detail.value?.warehouseOperable === true &&
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

function getSourceTypeName(record?: {
  sourceType?: number;
  sourceTypeName?: string;
}) {
  if (record?.sourceTypeName) return record.sourceTypeName;
  return pickSourceTypeNameMap[record?.sourceType ?? 0] || '其他来源';
}

function normalizePickSourceType(sourceType?: number) {
  const normalizedSourceType = sourceType ?? 0;
  return pickSourceTypeNameMap[normalizedSourceType]
    ? normalizedSourceType
    : undefined;
}

function getRouteTaskId() {
  const routeValue = Array.isArray(route.query.taskId)
    ? route.query.taskId[0]
    : route.query.taskId;
  if (routeValue === undefined || routeValue === null || routeValue === '') {
    return { provided: false, taskId: undefined };
  }
  if (typeof routeValue !== 'string' || !/^\d+$/.test(routeValue)) {
    return { provided: true, taskId: undefined };
  }
  const taskId = Number(routeValue);
  return {
    provided: true,
    taskId: Number.isSafeInteger(taskId) && taskId > 0 ? taskId : undefined,
  };
}

function isDetailItemSelected(id?: number) {
  return !!id && selectedItemIds.value.includes(id);
}

function buildParams(page = pageNo.value, size = pageSize.value) {
  return {
    pageNo: page,
    pageSize: size,
    saleOutNo: query.saleOutNo?.trim() || undefined,
    sourceType: query.sourceType,
    warehouseId: query.warehouseId,
    status: query.status,
  };
}

function normalizeDesktopSearchParams(formValues: Record<string, any> = {}) {
  return {
    completeTime: formValues.completeTime,
    createTime: formValues.createTime,
    saleOutNo: String(formValues.keyword || '').trim() || undefined,
    sourceType: query.sourceType,
    status: formValues.status,
    warehouseId: formValues.warehouseId,
  };
}

function handleGridCheckboxChange({
  records,
}: {
  records: ErpSalePickDeliveryApi.PickTask[];
}) {
  checkedIds.value = records
    .map((item) => item.id)
    .filter((id): id is number => id !== undefined);
}

function handlePickCellClick({
  column,
  row,
}: {
  column: { field?: string; type?: string };
  row: ErpSalePickDeliveryApi.PickTask;
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
          placeholder: '请输入业务单号',
          'data-erp-keyword-search-input': 'true',
        },
        fieldName: 'keyword',
        label: '关键词',
      },
      {
        component: 'Input',
        componentProps: {
          disabled: true,
          placeholder: '请先选择拣货类型',
        },
        fieldName: 'sourceTypeName',
        label: '拣货来源',
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
        fieldName: 'status',
        label: '拣货状态',
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
        fieldName: 'completeTime',
        label: '完成时间',
      },
    ],
  },
  gridOptions: {
    checkboxConfig: { reserve: true },
    columns: pickGridColumns,
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
    id: 'erp-sale-pick-list-v2',
    pagerConfig: {
      pageSize: 20,
      pageSizes: [10, 20, 50, 100],
    },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          if (formValues.sourceTypeName !== currentSourceTypeName.value) {
            await syncDesktopSourceTypeForm(query.sourceType);
          }
          const result = await getSalePickPage({
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
            message.success(`发现 ${newRowCount} 个新拣货单`);
          }
          await nextTick();
          await reloadAdaptivePickGridColumns();
          return result;
        },
      },
    },
    rowClassName: () => 'sale-pick-clickable-row',
    rowConfig: { isHover: true, keyField: 'id' },
    scrollX: { enabled: true, gt: 8 },
    scrollY: { enabled: true, gt: 10 },
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ErpSalePickDeliveryApi.PickTask>,
  gridEvents: {
    cellClick: handlePickCellClick,
    checkboxAll: handleGridCheckboxChange,
    checkboxChange: handleGridCheckboxChange,
  },
});

function countNewRows(
  currentRows: ErpSalePickDeliveryApi.PickTask[],
  nextRows: ErpSalePickDeliveryApi.PickTask[],
) {
  const currentIds = new Set(currentRows.map((row) => row.id).filter(Boolean));
  return nextRows.filter((row) => row.id && !currentIds.has(row.id)).length;
}

function mergeMobileAutoRefreshRows(
  currentRows: ErpSalePickDeliveryApi.PickTask[],
  nextRows: ErpSalePickDeliveryApi.PickTask[],
  nextTotal: number,
) {
  const nextIds = new Set(nextRows.map((row) => row.id).filter(Boolean));
  const preservedRows = currentRows.filter(
    (row) => row.id && !nextIds.has(row.id),
  );
  return [...nextRows, ...preservedRows].slice(0, nextTotal);
}

async function loadMobileData(append = false, silentRefresh = false) {
  if (query.sourceType === undefined) {
    return;
  }
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
    const result = await getSalePickPage(buildParams(nextPage, pageSize.value));
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
      message.success(`发现 ${newRowCount} 个新拣货单`);
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
  if (query.sourceType === undefined) {
    return;
  }
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
  query.warehouseId = undefined;
  query.status = undefined;
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

async function resetListForSourceChange() {
  listRequestToken += 1;
  pageNo.value = 1;
  mobilePageNo.value = 1;
  mobileHasMore.value = true;
  mobileLoadingMore.value = false;
  rows.value = [];
  total.value = 0;
  checkedIds.value = [];
  await gridApi.grid?.clearCheckboxRow?.();
  await gridApi.grid?.clearCheckboxReserve?.();
}

function showInitialSourceTypeChooser() {
  stopListAutoRefresh();
  sourceTypeSelectionRequired.value = true;
  sourceTypeChooserOpen.value = true;
}

function showSourceTypeSwitcher() {
  sourceTypeSelectionRequired.value = false;
  sourceTypeChooserOpen.value = true;
}

function handleSourceTypeChooserCancel() {
  if (!sourceTypeSelectionRequired.value) {
    sourceTypeChooserOpen.value = false;
  }
}

async function syncDesktopSourceTypeForm(sourceType?: number) {
  if (
    isMobileListMode.value ||
    typeof gridApi.formApi?.setValues !== 'function'
  ) {
    return;
  }
  await gridApi.formApi.setValues(
    {
      sourceTypeName:
        sourceType === undefined
          ? undefined
          : getSourceTypeName({ sourceType }),
    },
    false,
  );
}

async function activateSourceType(sourceType: number) {
  query.sourceType = sourceType;
  await syncDesktopSourceTypeForm(sourceType);
  await resetListForSourceChange();
  sourceTypeSelectionRequired.value = false;
  sourceTypeChooserOpen.value = false;
  try {
    await loadData();
  } finally {
    startListAutoRefresh();
  }
}

async function handleSourceTypeSelect(sourceType: number) {
  if (sourceTypeChanging.value) {
    return;
  }
  sourceTypeChanging.value = true;
  try {
    await activateSourceType(sourceType);
  } finally {
    sourceTypeChanging.value = false;
  }
}

async function handleExport() {
  if (isMobileListMode.value) {
    return;
  }
  if (query.sourceType === undefined) {
    message.warning('请先选择拣货类型');
    return;
  }
  const formValues = await gridApi.formApi.getValues();
  const data = await exportSalePick({
    ...normalizeDesktopSearchParams(formValues),
    ids: checkedIds.value.length > 0 ? checkedIds.value : undefined,
  });
  downloadFileFromBlobPart({ fileName: '销售拣货单.xls', source: data });
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
    const result = await getSalePickItemPage({
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
    const result = await getSalePickSubmitPage({
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

async function openDetail(
  row: ErpSalePickDeliveryApi.PickTask,
  prefetchedDetail?: ErpSalePickDeliveryApi.PickTask,
) {
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
    detail.value = prefetchedDetail || (await getSalePick(row.id, false));
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
  if (submitLoading.value || !itemId || !canSelectPickItem(record)) {
    return;
  }
  if (selectedItemIds.value.includes(itemId)) {
    updateDetailSelection(selectedItemIds.value.filter((id) => id !== itemId));
  } else {
    updateDetailSelection([...selectedItemIds.value, itemId]);
  }
}

function buildDetailItemCustomRow(record: ErpSalePickDeliveryApi.ItemResp) {
  const selectable = canSelectPickItem(record);
  return {
    class: selectable
      ? 'sale-pick-detail-row sale-pick-detail-row--available'
      : 'sale-pick-detail-row sale-pick-detail-row--disabled',
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
    message.error('拣货凭证仅支持 jpg、jpeg、png 格式');
    return Upload.LIST_IGNORE;
  }
  if (file.size > 5 * 1024 * 1024) {
    message.error('拣货凭证图片不能超过 5MB');
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
    const fileUrl = await uploadSalePickVoucher(rawFile);
    files.push({
      fileName: rawFile.name,
      fileType: rawFile.type,
      fileUrl,
    });
  }
  return files;
}

async function handleSubmitPick() {
  if (!detail.value?.id) {
    message.warning('拣货单数据不存在');
    return;
  }
  if (selectedItemIds.value.length === 0) {
    message.warning('请先勾选本次已拣货的配件');
    return;
  }
  if (voucherFileList.value.length === 0) {
    message.warning('请先上传本次拣货凭证');
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
      message.warning('请先上传本次拣货凭证');
      return;
    }
    await submitSalePick({
      taskId: submittedTaskId,
      ...payload,
    });
    message.success('拣货提交成功');
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

async function initializePickPage() {
  const { provided, taskId } = getRouteTaskId();
  if (!provided) {
    showInitialSourceTypeChooser();
    return;
  }
  if (!taskId) {
    message.error('通知中的拣货任务参数无效，请重新选择拣货类型');
    showInitialSourceTypeChooser();
    return;
  }

  let directTask: ErpSalePickDeliveryApi.PickTask;
  try {
    directTask = await getSalePick(taskId, false);
  } catch {
    message.error('无法打开该拣货任务，请重新选择拣货类型');
    showInitialSourceTypeChooser();
    return;
  }
  const sourceType = normalizePickSourceType(directTask.sourceType);
  if (sourceType === undefined) {
    message.error('该拣货任务的来源类型无效，请重新选择拣货类型');
    showInitialSourceTypeChooser();
    return;
  }

  try {
    await activateSourceType(sourceType);
  } catch {
    // 列表请求失败时，请求客户端已经提示；仍继续打开通知指定的任务。
  }
  try {
    await openDetail(directTask, directTask);
  } catch {
    closeDetail();
    message.error('拣货任务详情加载失败，请稍后重试');
  }
}

function handleMobileListMediaChange(event: MediaQueryListEvent) {
  isNarrowScreen.value = event.matches;
}

function shouldSkipListAutoRefresh() {
  return (
    query.sourceType === undefined ||
    (typeof document !== 'undefined' && document.hidden) ||
    sourceTypeChooserOpen.value ||
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
  await Promise.all([loadWarehouseOptions(), initializePickPage()]);
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
      class="sale-pick-page"
      :class="{
        'sale-pick-page--mobile': isMobileListMode,
        'sale-pick-page--workbench': isWeComWorkbench,
      }"
    >
      <div
        v-if="!isMobileListMode"
        ref="desktopGridShellRef"
        class="sale-pick-grid-shell"
      >
        <Grid table-title="销售拣货单列表">
          <template #toolbar-tools>
            <div class="sale-pick-source-toolbar">
              <div
                v-if="query.sourceType !== undefined"
                class="sale-pick-current-source"
              >
                <span>当前拣货类型</span>
                <Tag :color="sourceTypeColorMap[query.sourceType] || 'default'">
                  {{ currentSourceTypeName }}
                </Tag>
                <Button size="small" @click="showSourceTypeSwitcher">
                  切换拣货类型
                </Button>
              </div>
              <TableAction
                :actions="[
                  {
                    label:
                      checkedIds.length > 0
                        ? `导出（${checkedIds.length}）`
                        : '导出',
                    type: 'primary',
                    icon: ACTION_ICON.DOWNLOAD,
                    auth: ['erp:sale-pick:export'],
                    onClick: handleExport,
                  },
                ]"
              />
            </div>
          </template>
          <template #displayNo="{ row }">
            <button
              type="button"
              class="sale-pick-number-link"
              :title="getDisplayNo(row)"
              @click.stop="openDetail(row)"
            >
              {{ getDisplayNo(row) }}
            </button>
          </template>
          <template #sourceTypeName="{ row }">
            <Tag :color="sourceTypeColorMap[row.sourceType ?? 0] || 'default'">
              {{ getSourceTypeName(row) }}
            </Tag>
          </template>
          <template #status="{ row }">
            <Tag :color="statusColorMap[row.status || 0]">
              {{ statusTextMap[row.status || 0] || row.status }}
            </Tag>
          </template>
          <template #pickProgress="{ row }">
            <div class="sale-pick-progress-cell">
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
        class="sale-pick-list-card sale-pick-list-card--mobile"
      >
        <div class="sale-pick-mobile-panel" @scroll="handleMobileListScroll">
          <div class="sale-pick-mobile-toolbar">
            <div>
              <div class="sale-pick-mobile-toolbar__title">销售拣货单</div>
              <div class="sale-pick-mobile-toolbar__count">
                共 {{ total }} 条数据
              </div>
              <div
                v-if="query.sourceType !== undefined"
                class="sale-pick-mobile-toolbar__source"
              >
                <span>当前类型</span>
                <Tag :color="sourceTypeColorMap[query.sourceType] || 'default'">
                  {{ currentSourceTypeName }}
                </Tag>
              </div>
            </div>
            <div class="sale-pick-mobile-toolbar__actions">
              <Button size="small" @click="showSourceTypeSwitcher">
                切换类型
              </Button>
              <Button
                class="sale-pick-mobile-filter-btn"
                size="small"
                @click="mobileFilterOpen = true"
              >
                筛选
              </Button>
            </div>
          </div>
          <div v-if="rows.length > 0" class="sale-pick-mobile-list">
            <div
              v-for="row in rows"
              :key="row.id"
              class="sale-pick-mobile-card"
              @click="openDetail(row)"
            >
              <div class="sale-pick-mobile-card__head">
                <div class="sale-pick-mobile-card__main">
                  <div class="sale-pick-mobile-card__no">
                    {{ getDisplayNo(row) }}
                  </div>
                  <div class="sale-pick-mobile-card__customer">
                    {{ row.customerName || '-' }}
                  </div>
                </div>
                <Space :size="4">
                  <Tag
                    :color="
                      sourceTypeColorMap[row.sourceType ?? 0] || 'default'
                    "
                  >
                    {{ getSourceTypeName(row) }}
                  </Tag>
                  <Tag :color="statusColorMap[row.status || 0]">
                    {{ statusTextMap[row.status || 0] || row.status }}
                  </Tag>
                </Space>
              </div>
              <div class="sale-pick-mobile-card__grid">
                <div>
                  <span>仓库</span>
                  <strong>{{ row.warehouseName || '-' }}</strong>
                </div>
                <div>
                  <span>进度</span>
                  <strong>{{ row.pickProgress || '-' }}</strong>
                </div>
                <div>
                  <span>最近拣货</span>
                  <strong>{{ formatTime(row.latestPickTime) || '-' }}</strong>
                </div>
                <div>
                  <span>创建时间</span>
                  <strong>{{ formatTime(row.createTime) || '-' }}</strong>
                </div>
              </div>
            </div>
          </div>
          <div v-else-if="!loading" class="sale-pick-mobile-empty">
            暂无数据
          </div>
          <div class="sale-pick-mobile-list-state">
            <span v-if="loading">加载中...</span>
            <span v-else-if="mobileLoadingMore">加载更多...</span>
            <span v-else-if="rows.length > 0 && !mobileHasMore"
              >已全部加载</span
            >
          </div>
        </div>
      </Card>
    </div>

    <Modal
      v-model:open="sourceTypeChooserOpen"
      :closable="!sourceTypeSelectionRequired"
      :footer="null"
      :keyboard="!sourceTypeSelectionRequired"
      :mask-closable="!sourceTypeSelectionRequired"
      :width="640"
      title="选择拣货类型"
      wrap-class-name="sale-pick-source-type-modal-wrap"
      @cancel="handleSourceTypeChooserCancel"
    >
      <div class="sale-pick-source-type-hint">请选择本次需要处理的单据来源</div>
      <div class="sale-pick-source-type-grid">
        <button
          v-for="option in pickSourceTypeOptions"
          :key="option.value"
          type="button"
          class="sale-pick-source-type-card"
          :class="{
            'sale-pick-source-type-card--active':
              query.sourceType === option.value,
          }"
          :disabled="sourceTypeChanging"
          @click="handleSourceTypeSelect(option.value)"
        >
          <span>{{ option.label }}</span>
          <small>进入拣货列表</small>
        </button>
      </div>
    </Modal>

    <Drawer
      v-model:open="mobileFilterOpen"
      class="sale-pick-mobile-filter-drawer"
      placement="right"
      title="筛选"
      width="86vw"
    >
      <Form layout="vertical">
        <FormItem label="业务单号">
          <Input
            v-model:value="query.saleOutNo"
            allow-clear
            placeholder="请输入业务单号"
            @press-enter="handleMobileSearch"
          />
        </FormItem>
        <FormItem label="拣货来源">
          <Input
            :value="currentSourceTypeName"
            disabled
            placeholder="请先选择拣货类型"
          />
        </FormItem>
        <FormItem label="仓库">
          <Select
            v-model:value="query.warehouseId"
            allow-clear
            :options="warehouseOptions"
            placeholder="请选择仓库"
            show-search
          />
        </FormItem>
        <FormItem label="状态">
          <Select
            v-model:value="query.status"
            allow-clear
            :options="pickStatusOptions"
            placeholder="请选择状态"
          />
        </FormItem>
      </Form>
      <template #footer>
        <div class="sale-pick-mobile-filter-actions">
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
      wrap-class-name="sale-pick-detail-modal-wrap"
      width="min(2200px, calc(100vw - 48px))"
      title="销售拣货单详情"
      @after-close="handleDetailAfterClose"
      @cancel="closeDetail"
    >
      <div
        v-if="detail"
        v-loading="detailLoading"
        class="sale-pick-detail-content"
      >
        <div class="sale-pick-detail-scroll">
          <Descriptions
            class="sale-pick-detail-summary"
            bordered
            size="small"
            :column="3"
          >
            <DescriptionsItem label="业务单号">{{
              getDisplayNo(detail)
            }}</DescriptionsItem>
            <DescriptionsItem label="拣货来源">
              <Tag
                :color="sourceTypeColorMap[detail.sourceType ?? 0] || 'default'"
              >
                {{ getSourceTypeName(detail) }}
              </Tag>
            </DescriptionsItem>
            <DescriptionsItem label="往来单位">{{
              detail.customerName
            }}</DescriptionsItem>
            <DescriptionsItem label="仓库">{{
              detail.warehouseName
            }}</DescriptionsItem>
            <DescriptionsItem label="状态">
              <Tag :color="statusColorMap[detail.status || 0]">
                {{ statusTextMap[detail.status || 0] || detail.status }}
              </Tag>
            </DescriptionsItem>
            <DescriptionsItem label="进度">{{
              detail.pickProgress
            }}</DescriptionsItem>
            <DescriptionsItem label="件数合计">
              {{ formatTotalPieceCount(detail.totalPieceCount) }}
            </DescriptionsItem>
            <DescriptionsItem label="最近拣货">{{
              formatTime(detail.latestPickTime)
            }}</DescriptionsItem>
          </Descriptions>
          <div class="sale-pick-mobile-summary">
            <div class="sale-pick-mobile-summary__head">
              <div>
                <div class="sale-pick-mobile-summary__no">
                  {{ getDisplayNo(detail) }}
                </div>
                <div class="sale-pick-mobile-summary__customer">
                  {{ detail.customerName || '-' }}
                </div>
              </div>
              <Space :size="4">
                <Tag
                  :color="
                    sourceTypeColorMap[detail.sourceType ?? 0] || 'default'
                  "
                >
                  {{ getSourceTypeName(detail) }}
                </Tag>
                <Tag :color="statusColorMap[detail.status || 0]">
                  {{ statusTextMap[detail.status || 0] || detail.status }}
                </Tag>
              </Space>
            </div>
            <div class="sale-pick-mobile-summary__grid">
              <div>
                <span>仓库</span>
                <strong>{{ detail.warehouseName || '-' }}</strong>
              </div>
              <div>
                <span>进度</span>
                <strong>{{ detail.pickProgress || '-' }}</strong>
              </div>
              <div>
                <span>件数合计</span>
                <strong>{{
                  formatTotalPieceCount(detail.totalPieceCount)
                }}</strong>
              </div>
              <div class="sale-pick-mobile-summary__wide">
                <span>最近拣货</span>
                <strong>{{ formatTime(detail.latestPickTime) || '-' }}</strong>
              </div>
            </div>
          </div>
          <Space v-if="detailUseMobileMode" class="sale-pick-mobile-tabs">
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
            class="sale-pick-mobile-section-head"
          >
            <div>
              <strong>配件明细</strong>
              <span>点击明细卡片即可选择或取消</span>
            </div>
            <Tag :color="selectedItemIds.length > 0 ? 'processing' : 'default'">
              已选 {{ selectedItemIds.length }} 条
            </Tag>
          </div>
          <div ref="detailTableWrapRef">
            <Tabs
              class="sale-pick-detail-tabs"
              :active-key="detailActiveTab"
              @change="handleDetailTabChange"
            >
              <Tabs.TabPane key="items" tab="配件明细">
                <Table
                  class="sale-pick-detail-table"
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
                    <template v-if="column.dataIndex === 'pickStatus'">
                      <Tag :color="statusColorMap[record.pickStatus]">
                        {{
                          statusTextMap[record.pickStatus] || record.pickStatus
                        }}
                      </Tag>
                    </template>
                    <template v-else-if="column.dataIndex === 'pickTime'">
                      {{ formatTime(text) }}
                    </template>
                    <template
                      v-else-if="
                        ['count', 'pickedCount', 'remainingPickCount'].includes(
                          String(column.dataIndex || ''),
                        )
                      "
                    >
                      {{ formatPickDeliveryQuantity(text) }}
                    </template>
                    <template v-else-if="column.dataIndex === 'submitQuantity'">
                      <Input
                        v-model:value="quantities[record.id]"
                        inputmode="decimal"
                        :aria-label="`${record.productName || '配件'}本次拣货数量`"
                        :disabled="
                          submitLoading ||
                          !canSelectPickItem(record) ||
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
                  class="sale-pick-submit-table"
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
                      kind="pick"
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
            class="sale-pick-mobile-detail-list"
          >
            <div
              v-for="item in detailItems"
              :key="item.id"
              class="sale-pick-mobile-detail-card"
              :class="{
                'sale-pick-mobile-detail-card--available':
                  canSelectPickItem(item),
                'sale-pick-mobile-detail-card--selected': isDetailItemSelected(
                  item.id,
                ),
                'sale-pick-mobile-detail-card--disabled':
                  !canSelectPickItem(item),
              }"
              @click="toggleDetailItem(item)"
            >
              <div class="sale-pick-mobile-detail-card__head">
                <Checkbox
                  :checked="isDetailItemSelected(item.id)"
                  :disabled="submitLoading || !canSelectPickItem(item)"
                  @click.stop
                  @change="toggleDetailItem(item)"
                />
                <div class="sale-pick-mobile-detail-card__main">
                  <div class="sale-pick-mobile-detail-card__name">
                    {{ item.productName || '-' }}
                  </div>
                  <div class="sale-pick-mobile-detail-card__code">
                    {{ item.productCode || '-' }}
                  </div>
                </div>
                <Tag :color="statusColorMap[item.pickStatus || 0]">
                  {{ statusTextMap[item.pickStatus || 0] || item.pickStatus }}
                </Tag>
              </div>
              <div class="sale-pick-mobile-detail-card__grid">
                <div>
                  <span>规格</span>
                  <strong>{{ item.standard || '-' }}</strong>
                </div>
                <div>
                  <span>仓位</span>
                  <strong>{{ item.warehousePosition || '-' }}</strong>
                </div>
                <div>
                  <span>数量</span>
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
                  <span>剩余数量</span
                  ><strong>{{ quantityDraft.remaining(item) }}</strong>
                </div>
                <div class="sale-pick-quantity-input" @click.stop>
                  <span>本次拣货数量</span>
                  <Input
                    v-if="item.id"
                    v-model:value="quantities[item.id]"
                    inputmode="decimal"
                    :aria-label="`${item.productName || '配件'}本次拣货数量`"
                    :disabled="
                      submitLoading ||
                      !canSelectPickItem(item) ||
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
                  <span>拣货人</span>
                  <strong>{{ item.pickUserName || '-' }}</strong>
                </div>
                <div>
                  <span>拣货时间</span>
                  <strong>{{ formatTime(item.pickTime) || '-' }}</strong>
                </div>
              </div>
            </div>
            <div
              v-if="!detailItemsLoading && detailItems.length === 0"
              class="sale-pick-mobile-empty"
            >
              暂无明细
            </div>
            <div v-if="detailItemsTotal > 0" class="sale-pick-mobile-load-more">
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
            class="sale-pick-mobile-submit-list"
          >
            <div
              v-for="record in detailSubmits"
              :key="record.id"
              class="sale-pick-mobile-submit-card"
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
                kind="pick"
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
        <div class="sale-pick-submit-panel">
          <div class="sale-pick-submit-panel__header">
            <div>
              <div class="sale-pick-submit-panel__title">本次拣货提交</div>
              <div class="sale-pick-submit-panel__hint">
                勾选黄色明细，填写本次拣货数量并上传凭证；剩余数量可分批继续拣货。
              </div>
            </div>
            <div class="sale-pick-submit-panel__tags">
              <Tag
                :color="selectedItemIds.length > 0 ? 'processing' : 'default'"
              >
                已选 {{ selectedItemIds.length }} 条
              </Tag>
              <Tag :color="pendingItemCount > 0 ? 'processing' : 'success'">
                待拣 {{ pendingItemCount }} 条
              </Tag>
            </div>
          </div>
          <div class="sale-pick-submit-panel__body">
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
                class="sale-pick-submit-panel__upload"
                :disabled="pendingItemCount === 0"
              >
                上传凭证（{{ voucherFileList.length }}/9）
              </Button>
            </Upload>
            <Input
              v-model:value="submitRemark"
              allow-clear
              placeholder="备注，可选"
            />
            <Space class="sale-pick-submit-panel__actions">
              <Button
                class="sale-pick-submit-panel__primary"
                type="primary"
                :disabled="!canSubmitPick"
                :loading="submitLoading"
                @click="handleSubmitPick"
              >
                {{
                  selectedItemIds.length > 0
                    ? `提交拣货（${selectedItemIds.length}）`
                    : '提交拣货'
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
.sale-pick-page {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
}

.sale-pick-grid-shell {
  position: relative;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
}

.sale-pick-grid-shell :deep(.vxe-table--render-default),
.sale-pick-grid-shell :deep(.vxe-grid--form-wrapper) {
  font-size: 12px;
}

.sale-pick-source-toolbar,
.sale-pick-current-source {
  display: flex;
  align-items: center;
}

.sale-pick-source-toolbar {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}

.sale-pick-current-source {
  gap: 6px;
  color: #4b5563;
  font-size: 13px;
}

.sale-pick-source-type-hint {
  margin-bottom: 16px;
  color: #6b7280;
  font-size: 14px;
}

.sale-pick-source-type-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.sale-pick-source-type-card {
  display: flex;
  min-height: 92px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 6px;
  padding: 14px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 10px;
  color: #111827;
  cursor: pointer;
  background: #fff;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.sale-pick-source-type-card:hover,
.sale-pick-source-type-card:focus-visible,
.sale-pick-source-type-card--active {
  border-color: #1677ff;
  background: #f0f7ff;
  box-shadow: 0 6px 18px rgb(22 119 255 / 12%);
  outline: none;
  transform: translateY(-1px);
}

.sale-pick-source-type-card:disabled {
  cursor: wait;
  opacity: 0.64;
}

.sale-pick-source-type-card span {
  font-size: 16px;
  font-weight: 600;
}

.sale-pick-source-type-card small {
  color: #6b7280;
  font-size: 12px;
}

.sale-pick-number-link {
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

.sale-pick-number-link:hover {
  color: #4096ff;
  text-decoration: underline;
}

.sale-pick-progress-cell {
  display: grid;
  grid-template-columns: minmax(62px, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-width: 118px;
}

.sale-pick-progress-cell :deep(.ant-progress) {
  margin: 0;
  line-height: 1;
}

.sale-pick-progress-cell span {
  min-width: 32px;
  color: #595959;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.sale-pick-search-card {
  flex: 0 0 auto;
}

.sale-pick-search-control {
  width: 180px;
}

.sale-pick-search-control--short {
  width: 140px;
}

.sale-pick-list-card {
  min-height: 0;
  flex: 1 1 auto;
}

.sale-pick-list-card :deep(.ant-card-body) {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.sale-pick-list-table {
  min-height: 0;
  flex: 1 1 auto;
}

.sale-pick-list-table :deep(.ant-spin-nested-loading),
.sale-pick-list-table :deep(.ant-spin-container),
.sale-pick-list-table :deep(.ant-table),
.sale-pick-list-table :deep(.ant-table-container) {
  height: 100%;
}

.sale-pick-list-table :deep(.ant-spin-container),
.sale-pick-list-table :deep(.ant-table-container) {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.sale-pick-list-table :deep(.ant-table-header) {
  flex: 0 0 auto;
}

.sale-pick-list-table :deep(.ant-table-body) {
  min-height: 0;
  flex: 1 1 0;
}

.sale-pick-list-table :deep(.ant-table-placeholder) {
  height: 100%;
}

.sale-pick-list-table :deep(.ant-table-placeholder .ant-table-cell) {
  height: 100%;
}

.sale-pick-pagination {
  display: flex;
  flex: 0 0 auto;
  justify-content: flex-end;
  padding-top: 12px;
}

.sale-pick-mobile-list,
.sale-pick-mobile-summary,
.sale-pick-mobile-section-head,
.sale-pick-mobile-detail-list,
.sale-pick-mobile-submit-list,
.sale-pick-mobile-empty {
  display: none;
}

.sale-pick-mobile-card,
.sale-pick-mobile-summary,
.sale-pick-mobile-detail-card,
.sale-pick-mobile-submit-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.sale-pick-mobile-card {
  padding: 12px;
  cursor: pointer;
}

.sale-pick-mobile-card__head,
.sale-pick-mobile-summary__head,
.sale-pick-mobile-detail-card__head,
.sale-pick-mobile-submit-card__head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.sale-pick-mobile-card__main,
.sale-pick-mobile-detail-card__main {
  min-width: 0;
  flex: 1;
}

.sale-pick-mobile-card__no,
.sale-pick-mobile-summary__no,
.sale-pick-mobile-detail-card__name {
  overflow: hidden;
  color: #1f2937;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-pick-mobile-card__customer,
.sale-pick-mobile-summary__customer,
.sale-pick-mobile-detail-card__code,
.sale-pick-mobile-submit-card__head span,
.sale-pick-mobile-submit-card__meta,
.sale-pick-mobile-submit-card__remark {
  margin-top: 2px;
  color: #6b7280;
  font-size: 12px;
}

.sale-pick-mobile-card__grid,
.sale-pick-mobile-summary__grid,
.sale-pick-mobile-detail-card__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  margin-top: 10px;
}

.sale-pick-mobile-card__grid span,
.sale-pick-mobile-summary__grid span,
.sale-pick-mobile-detail-card__grid span {
  display: block;
  color: #8c8c8c;
  font-size: 12px;
}

.sale-pick-mobile-card__grid strong,
.sale-pick-mobile-summary__grid strong,
.sale-pick-mobile-detail-card__grid strong {
  display: block;
  overflow-wrap: anywhere;
  color: #1f2937;
  font-size: 13px;
  font-weight: 500;
}

.sale-pick-mobile-summary {
  padding: 14px;
  border: 0;
  background: linear-gradient(135deg, #f7fbff 0%, #ffffff 56%, #f7fdf9 100%);
  box-shadow: inset 0 0 0 1px #e5edf7;
}

.sale-pick-mobile-summary__head {
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.sale-pick-mobile-summary__head > div {
  min-width: 0;
}

.sale-pick-mobile-summary__no {
  font-size: 15px;
  line-height: 22px;
}

.sale-pick-mobile-summary__customer {
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-pick-mobile-summary__grid {
  padding-top: 10px;
  border-top: 1px solid #eef2f7;
}

.sale-pick-mobile-summary__wide {
  grid-column: 1 / -1;
}

.sale-pick-mobile-section-head {
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
}

.sale-pick-mobile-section-head > div {
  min-width: 0;
}

.sale-pick-mobile-section-head strong {
  display: block;
  color: #111827;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
}

.sale-pick-mobile-section-head span {
  display: block;
  overflow: hidden;
  color: #6b7280;
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-pick-list-table :deep(.sale-pick-clickable-row) {
  cursor: pointer;
}

.sale-pick-list-table :deep(.sale-pick-clickable-row:hover > td) {
  background: #f5f8ff;
}

.sale-pick-page :deep(.sale-pick-detail-row) {
  cursor: pointer;
}

.sale-pick-page :deep(.sale-pick-detail-row:hover > td) {
  background: #f5f8ff;
}

.sale-pick-page :deep(.sale-pick-detail-row--disabled) {
  cursor: not-allowed;
}

.sale-pick-page :deep(.sale-pick-detail-row--disabled:hover > td) {
  background: inherit;
}

:global(.sale-pick-detail-modal-wrap .ant-modal-body) {
  max-height: calc(100vh - 180px);
  overflow-y: auto;
  padding-bottom: 0;
}

.sale-pick-detail-content,
.sale-pick-detail-scroll {
  min-height: 0;
}

.sale-pick-detail-tabs {
  margin-top: 12px;
}

.sale-pick-submit-panel {
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

.sale-pick-submit-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.sale-pick-submit-panel__title {
  color: #1f2937;
  font-weight: 600;
}

.sale-pick-submit-panel__hint {
  margin-top: 4px;
  color: #6b7280;
  font-size: 12px;
}

.sale-pick-submit-panel__tags {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.sale-pick-submit-panel__body {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(220px, 1fr) auto;
  gap: 12px;
  align-items: flex-start;
  margin-top: 12px;
}

.sale-pick-submit-panel__body :deep(.ant-upload-wrapper) {
  width: 100%;
}

.sale-pick-submit-panel__upload,
.sale-pick-submit-panel__actions {
  width: 100%;
}

.sale-pick-submit-panel__primary {
  min-height: 36px;
  font-weight: 600;
}

.sale-pick-mobile-detail-card {
  position: relative;
  padding: 12px;
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.sale-pick-mobile-detail-card--selected {
  border-color: #1677ff;
  background: #fffbe6;
  box-shadow: 0 8px 20px rgb(22 119 255 / 10%);
}

.sale-pick-mobile-detail-card--disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.sale-pick-mobile-submit-card {
  padding: 10px 12px;
}

.sale-pick-mobile-submit-card__head {
  justify-content: space-between;
}

.sale-pick-mobile-submit-card__files {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin-top: 8px;
}

.sale-pick-mobile-submit-card__files a,
.sale-pick-mobile-submit-card__remark {
  overflow-wrap: anywhere;
}

.sale-pick-mobile-load-more {
  display: grid;
  gap: 8px;
  justify-items: center;
  padding: 4px 0 2px;
  color: #6b7280;
  font-size: 12px;
}

@media (max-width: 960px) {
  .sale-pick-submit-panel__body {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  :global(.sale-pick-source-type-modal-wrap .ant-modal) {
    max-width: calc(100vw - 24px);
    margin: 12px auto;
  }

  .sale-pick-source-type-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .sale-pick-source-type-card {
    min-height: 82px;
  }

  .sale-pick-page {
    min-height: calc(100dvh - 190px);
    gap: 8px;
  }

  .sale-pick-search-card :deep(.ant-card-body),
  .sale-pick-list-card :deep(.ant-card-body) {
    padding: 10px;
  }

  .sale-pick-search-card :deep(.ant-form) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .sale-pick-search-card :deep(.ant-form-item) {
    margin-right: 0;
    margin-bottom: 0;
  }

  .sale-pick-search-item--wide,
  .sale-pick-search-actions {
    grid-column: 1 / -1;
  }

  .sale-pick-search-card :deep(.ant-form-item-label) {
    display: none;
  }

  .sale-pick-search-card :deep(.ant-form-item-control) {
    width: 100%;
  }

  .sale-pick-search-actions :deep(.ant-space) {
    display: grid;
    width: 100%;
    grid-template-columns: 1.15fr 1fr 1fr;
    gap: 8px;
  }

  .sale-pick-search-actions :deep(.ant-space-item),
  .sale-pick-search-actions :deep(.ant-btn) {
    width: 100%;
  }

  .sale-pick-search-control,
  .sale-pick-search-control--short,
  .sale-pick-search-card :deep(.ant-input),
  .sale-pick-search-card :deep(.ant-select) {
    width: 100%;
  }

  .sale-pick-list-table {
    display: none;
  }

  .sale-pick-mobile-list {
    display: grid;
    flex: 1 1 auto;
    align-content: start;
    gap: 8px;
  }

  .sale-pick-mobile-empty {
    display: flex;
    min-height: 120px;
    align-items: center;
    justify-content: center;
    color: #8c8c8c;
  }

  .sale-pick-pagination {
    justify-content: center;
    overflow-x: auto;
    padding-top: 8px;
  }

  .sale-pick-pagination :deep(.ant-pagination-options-quick-jumper) {
    display: none;
  }

  .sale-pick-pagination :deep(.ant-pagination-options) {
    margin-inline-start: 4px;
  }

  :global(.sale-pick-detail-modal-wrap .ant-modal) {
    top: 0;
    width: 100vw !important;
    max-width: 100vw;
    margin: 0 auto;
  }

  :global(.sale-pick-detail-modal-wrap .ant-modal-content) {
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
    overflow: hidden;
  }

  :global(.sale-pick-detail-modal-wrap .ant-modal-header) {
    margin-bottom: 0;
    padding: 14px 16px 10px;
    border-bottom: 1px solid #eef2f7;
  }

  :global(.sale-pick-detail-modal-wrap .ant-modal-close) {
    top: 8px;
  }

  :global(.sale-pick-detail-modal-wrap .ant-modal-body) {
    height: calc(100dvh - 54px);
    max-height: none;
    overflow: hidden;
    padding: 0;
    background: #f5f7fb;
  }

  .sale-pick-detail-content {
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
  }

  .sale-pick-detail-scroll {
    flex: 1 1 auto;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 12px 12px 10px;
    scrollbar-width: none;
  }

  .sale-pick-detail-scroll::-webkit-scrollbar {
    display: none;
  }

  .sale-pick-detail-summary {
    display: none;
  }

  .sale-pick-mobile-summary {
    display: block;
  }

  .sale-pick-mobile-section-head {
    display: flex;
  }

  .sale-pick-detail-table,
  .sale-pick-submit-table,
  .sale-pick-detail-tabs {
    display: none;
  }

  .sale-pick-mobile-detail-list,
  .sale-pick-mobile-submit-list {
    display: grid;
    gap: 8px;
    margin-top: 8px;
    padding-bottom: 8px;
  }

  .sale-pick-submit-panel {
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

  .sale-pick-submit-panel__header {
    flex-direction: column;
    gap: 6px;
  }

  .sale-pick-submit-panel__hint {
    display: none;
  }

  .sale-pick-submit-panel__tags {
    width: 100%;
    justify-content: flex-start;
  }

  .sale-pick-submit-panel__body {
    gap: 10px;
    margin-top: 10px;
  }

  .sale-pick-submit-panel__body :deep(.ant-upload-select),
  .sale-pick-submit-panel__body :deep(.ant-upload-list),
  .sale-pick-submit-panel__body :deep(.ant-upload-list-item-container) {
    width: 100%;
  }

  .sale-pick-submit-panel__body :deep(.ant-upload-list-item-name) {
    overflow-wrap: anywhere;
  }

  .sale-pick-mobile-detail-card__head {
    align-items: flex-start;
  }

  .sale-pick-mobile-detail-card__name {
    display: -webkit-box;
    overflow: hidden;
    line-height: 20px;
    text-overflow: initial;
    white-space: normal;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .sale-pick-mobile-detail-card__grid {
    padding-top: 8px;
    border-top: 1px dashed #e5e7eb;
  }

  .sale-pick-submit-panel__body :deep(.ant-input) {
    min-height: 44px;
  }

  .sale-pick-submit-panel__body :deep(.ant-btn) {
    width: 100%;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
  }

  .sale-pick-submit-panel__actions {
    display: grid !important;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    gap: 12px;
  }

  .sale-pick-submit-panel__actions :deep(.ant-space-item) {
    min-width: 0;
  }

  .sale-pick-submit-panel__primary {
    min-height: 44px;
  }
}

.sale-pick-page--mobile {
  height: calc(100dvh - 112px);
  min-height: 0;
  gap: 0;
  background: #f2f4f7;
}

.sale-pick-page--workbench {
  height: 100dvh;
}

.sale-pick-list-card--mobile {
  overflow: hidden;
  background: #f2f4f7;
}

.sale-pick-list-card--mobile :deep(.ant-card-body) {
  height: 100%;
  padding: 0;
  background: #f2f4f7;
}

.sale-pick-mobile-panel {
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

.sale-pick-mobile-toolbar {
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

.sale-pick-mobile-toolbar__title {
  color: #111827;
  font-size: 17px;
  font-weight: 700;
  line-height: 24px;
}

.sale-pick-mobile-toolbar__count {
  margin-top: 2px;
  color: #6b7280;
  font-size: 13px;
  line-height: 18px;
}

.sale-pick-mobile-toolbar__source {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  color: #6b7280;
  font-size: 12px;
}

.sale-pick-mobile-toolbar__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
}

.sale-pick-mobile-filter-btn {
  flex: 0 0 auto;
}

.sale-pick-page--mobile .sale-pick-mobile-list {
  display: grid;
  flex: 0 0 auto;
  align-content: start;
  gap: 10px;
}

.sale-pick-page--mobile .sale-pick-mobile-card {
  background: #fff;
  box-shadow: 0 1px 4px rgb(15 23 42 / 6%);
}

.sale-pick-page--mobile .sale-pick-mobile-empty {
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
  color: #8c8c8c;
}

.sale-pick-mobile-list-state {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  font-size: 12px;
}

.sale-pick-mobile-filter-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.sale-pick-mobile-filter-actions .ant-btn {
  width: 100%;
}

:global(.ant-table-tbody > tr.sale-pick-detail-row--available > td),
:global(.ant-table-tbody > tr.sale-pick-detail-row--available:hover > td),
:global(
  .ant-table-tbody
    > tr.sale-pick-detail-row--available.ant-table-row-selected
    > td
) {
  color: #3d2e00;
  background: #fffbe6 !important;
}

.sale-pick-mobile-detail-card--available {
  color: #3d2e00;
  background: #fffbe6;
}

.sale-pick-mobile-detail-card--available strong,
.sale-pick-mobile-detail-card--available .sale-pick-mobile-detail-card__name {
  color: #3d2e00;
}

.sale-pick-quantity-input {
  grid-column: 1 / -1;
}

:global(.ant-table-tbody > tr.sale-pick-detail-row--available .ant-tag-default),
.sale-pick-mobile-detail-card--available :deep(.ant-tag-default) {
  color: #614700;
  background: #fff1b8;
  border-color: #e8c95a;
}
</style>
