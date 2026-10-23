<script lang="ts" setup>
import type { CSSProperties } from 'vue';

import type { PageResult } from '@vben/request';

import type { InlineColumnPreference } from '../composables/useInlineColumnSettings';

import type { ErpStockApi } from '#/api/erp/stock/stock';

import { inject } from 'vue';

import { stockNatural } from '#/views/erp/stock/utils/stock-decimal';
const props = withDefaults(defineProps<Props>(), {
  candidateFocusHighlight: false,
  preserveQuantityPrecision: false,
  settingsScope: undefined,
  beforeOpen: undefined,
  deptId: undefined,
  rowKey: undefined,
  disabled: false,
  filterByDept: true,
  hiddenFields: () => [],
  placeholder: '配件编码/名称（支持空格组合搜索）',
  requireDept: true,
  requireDeptMessage: '请先选择部门，再选择库存',
  stockPageParams: () => ({}),
  value: '',
});
const emit = defineEmits<{
  'open-change': [open: boolean];
  select: [rows: ErpStockApi.Stock[], row: Record<string, any>];
  'update:value': [value: string];
}>();
const stockDecimalContext = inject('stock-decimal-context', false);
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { useAccessStore, useUserStore } from '@vben/stores';
import { erpCountInputFormatter, erpPriceInputFormatter } from '@vben/utils';

import {
  Button,
  Input,
  message,
  Pagination,
  Popover,
  Select,
  Spin,
} from 'ant-design-vue';

import { isFieldHidden } from '#/composables/useFieldPermission';
import { formatStockNaturalNumber } from '#/views/erp/stock/utils/document-number';

import { useBottomDropdownLayout } from '../composables/useBottomDropdownLayout';
import {
  columnStorageKey,
  useInlineColumnSettings,
} from '../composables/useInlineColumnSettings';
import {
  INLINE_STOCK_DEFAULT_PAGE_SIZE,
  INLINE_STOCK_PAGE_SIZE_OPTIONS,
  inlineStockPageSizeStorageKey,
  useInlineStockPageSize,
} from '../composables/useInlineStockPageSize';
import { CANDIDATE_POPUP_CLASS } from '../utils/candidate-focus';
import {
  inlineStockColumns,
  inlineStockFilterFields,
  inlineStockSortFields,
} from './inline-stock-columns';
import InlineColumnSettingsModal from './InlineColumnSettingsModal.vue';
import InlineStockHeaderCell from './InlineStockHeaderCell.vue';

const INLINE_STOCK_DEBOUNCE_DELAY = 300;
const INLINE_STOCK_TABLE_MAX_HEIGHT = 224;
const INLINE_STOCK_PRICE_FIELDS = new Set([
  'backupPrice1',
  'grossProfitRate',
  'lastPurchasePrice',
  'lastSalePrice',
  'minPrice',
  'productPurchasePrice',
  'referencePrice',
  'retailPrice',
  'salePrice',
  'sharePrice',
  'wholesalePrice',
]);

type StockPageApi = (params: any) => Promise<PageResult<ErpStockApi.Stock>>;

interface Props {
  candidateFocusHighlight?: boolean;
  preserveQuantityPrecision?: boolean;
  settingsScope?:
    | 'sale-cart'
    | 'sale-order'
    | 'sale-quote'
    | 'sale-return'
    | 'stock-check'
    | 'stock-in'
    | 'stock-move'
    | 'stock-out'
    | 'stock-transfer-out'
    | 'stock-warehouse-move';
  beforeOpen?: () => boolean;
  deptId?: number;
  disabled?: boolean;
  filterByDept?: boolean;
  hiddenFields?: string[];
  placeholder?: string;
  requireDept?: boolean;
  requireDeptMessage?: string;
  row: Record<string, any>;
  rowKey?: string;
  stockPageApi: StockPageApi;
  stockPageParams?: Record<string, any>;
  value?: string;
}

type InlineStockDropdownState = {
  activeIndex: number;
  keyword: string;
  loading: boolean;
  open: boolean;
  pageNo: number;
  pageSize: number;
  querySeq: number;
  rows: ErpStockApi.Stock[];
  selectedKeys: string[];
  selectedRows: ErpStockApi.Stock[];
  total: number;
};

const enhanced = computed(() => Boolean(props.settingsScope));

const dropdown = ref<InlineStockDropdownState>({
  activeIndex: 0,
  keyword: props.value || '',
  loading: false,
  open: false,
  pageNo: 1,
  pageSize: INLINE_STOCK_DEFAULT_PAGE_SIZE,
  querySeq: 0,
  rows: [],
  selectedKeys: [],
  selectedRows: [],
  total: 0,
});
const settingsOpen = ref(false);
const pageSizeSelecting = ref(false);
const activeColumnFilters = ref<Record<string, string>>({});
const activeSort = ref<{ direction: 'asc' | 'desc'; field: string }>({
  direction: 'desc',
  field: 'count',
});
const explicitSort = ref(false);
const openColumnFilterField = ref('');
const userStore = useUserStore();
const accessStore = useAccessStore();
const pageSizeStorageKey = computed(() =>
  inlineStockPageSizeStorageKey(
    accessStore.tenantId,
    userStore.userInfo?.id ?? userStore.userInfo?.userId,
  ),
);
const { pageSize: rememberedPageSize, save: savePageSize } =
  useInlineStockPageSize(() => pageSizeStorageKey.value);
const storageKey = computed(() =>
  enhanced.value
    ? columnStorageKey(
        accessStore.tenantId,
        userStore.userInfo?.id ?? userStore.userInfo?.userId,
        props.settingsScope!,
      )
    : '',
);
const { applied: columnPreferences, save: saveColumns } =
  useInlineColumnSettings(() => storageKey.value, inlineStockColumns);
const visibleColumns = computed(() => {
  const columns = columnPreferences.value.filter((column) => column.visible);
  return ['left', '', 'right']
    .flatMap((fixed) => columns.filter((column) => column.fixed === fixed))
    .map((column) => ({
      ...inlineStockColumns.find((item) => item.field === column.field)!,
      ...column,
    }));
});
const tableWidth = computed(() =>
  visibleColumns.value.reduce((sum, column) => sum + column.width, 42),
);
function columnStyle(column: InlineColumnPreference): CSSProperties {
  const index = visibleColumns.value.indexOf(
    column as (typeof visibleColumns.value)[number],
  );
  if (column.fixed === 'left')
    return {
      position: 'sticky',
      left: `${
        42 +
        visibleColumns.value
          .slice(0, index)
          .filter((item) => item.fixed === 'left')
          .reduce((sum, item) => sum + item.width, 0)
      }px`,
    };
  if (column.fixed === 'right')
    return {
      position: 'sticky',
      right: `${visibleColumns.value
        .slice(index + 1)
        .filter((item) => item.fixed === 'right')
        .reduce((sum, item) => sum + item.width, 0)}px`,
    };
  return {};
}
function panelWidth() {
  return tableWrapRef.value?.clientWidth || Math.max(0, window.innerWidth - 48);
}
async function closeSettings() {
  settingsOpen.value = false;
  await nextTick();
  focusKeyboardSurface();
}
function applyColumns(columns: InlineColumnPreference[]) {
  if (!saveColumns(columns))
    message.warning('列设置已应用，但未能保存到当前浏览器');
}
watch(storageKey, () => {
  settingsOpen.value = false;
  if (dropdown.value.open) closeDropdown();
});
const failedImageUrls = ref(new Set<string>());
const inputRef = ref<{ $el: HTMLElement }>();
const tableWrapRef = ref<HTMLElement>();
const footerRef = ref<HTMLElement>();
const { align: dropdownAlign, tableMaxHeight } = useBottomDropdownLayout({
  anchor: () => inputRef.value?.$el,
  contentVersion: () => [
    dropdown.value.rows,
    columnPreferences.value,
    settingsOpen.value,
  ],
  footer: footerRef,
  loading: () => dropdown.value.loading,
  maxTableHeight: INLINE_STOCK_TABLE_MAX_HEIGHT,
  open: () => enhanced.value && dropdown.value.open,
  reservedTableHeight: INLINE_STOCK_TABLE_MAX_HEIGHT,
  table: tableWrapRef,
});
let queryTimer: ReturnType<typeof setTimeout> | undefined;
const pointerFocusing = ref(false);
let isKeyboardListening = false;
let shouldFocusKeyboardSurfaceAfterQuery = false;

onBeforeUnmount(() => {
  stopKeyboardListening();
  // A warehouse change can replace an open picker. Release the parent shortcut guard.
  if (dropdown.value.open) closeDropdown();
  else {
    clearQueryTimer();
    dropdown.value.querySeq += 1;
  }
});

watch(
  () => [dropdown.value.activeIndex, dropdown.value.rows],
  async () => {
    await nextTick();
    const table = tableWrapRef.value;
    const row = table?.querySelector<HTMLElement>(
      '.sale-inline-stock-select-row--active',
    );
    const header = table?.querySelector('thead');
    if (!enhanced.value || !dropdown.value.open || !table || !row) return;
    const rowRect = row.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const top = tableRect.top + (header?.getBoundingClientRect().height ?? 0);
    const bottom = tableRect.top + table.clientHeight;
    if (rowRect.top < top) table.scrollTop -= top - rowRect.top;
    else if (rowRect.bottom > bottom)
      table.scrollTop += rowRect.bottom - bottom;
  },
);

const inputRowKey = computed(() => props.rowKey || '');

watch(
  () => props.value,
  (value) => {
    if (!dropdown.value.open) {
      dropdown.value = {
        ...dropdown.value,
        keyword: value || '',
      };
    }
  },
);

function clearQueryTimer() {
  if (queryTimer) {
    clearTimeout(queryTimer);
    queryTimer = undefined;
  }
}

function getStockRowKey(row?: ErpStockApi.Stock) {
  if (!row) return '';
  return [
    row.id ?? row.productId,
    row.productId,
    row.warehouseId,
    row.deptId ?? '',
    row.batchNo ?? '',
    row.rowKey ?? '',
  ].join('_');
}

function hasStockImage(row?: ErpStockApi.Stock) {
  return !!row?.mainImage && !failedImageUrls.value.has(row.mainImage);
}

function handleImageError(imageUrl?: string) {
  if (!imageUrl) return;
  failedImageUrls.value = new Set([...failedImageUrls.value, imageUrl]);
}

function canOpenDropdown() {
  if (props.requireDept && !props.deptId) {
    message.warning(props.requireDeptMessage);
    return false;
  }
  if (props.beforeOpen && props.beforeOpen() === false) {
    return false;
  }
  return true;
}

async function queryStock(pageNo = 1) {
  if (!dropdown.value.open || (props.requireDept && !props.deptId)) {
    return;
  }
  const querySeq = dropdown.value.querySeq + 1;
  dropdown.value = {
    ...dropdown.value,
    activeIndex: 0,
    loading: true,
    pageNo,
    querySeq,
  };
  try {
    const keyword = String(dropdown.value.keyword || '').trim();
    const result = await props.stockPageApi({
      ...(stockDecimalContext ? { decimalMode: 'string' } : {}),
      ...props.stockPageParams,
      ...(props.filterByDept ? { deptId: props.deptId } : {}),
      ...activeColumnFilters.value,
      productCodeNameKeyword: keyword || undefined,
      orderDirection: activeSort.value.direction,
      orderField: activeSort.value.field,
      pageNo,
      pageSize: dropdown.value.pageSize,
      showBatchNo: true,
    });
    if (dropdown.value.querySeq !== querySeq) {
      return;
    }
    dropdown.value = {
      ...dropdown.value,
      activeIndex: 0,
      loading: false,
      rows: result.list ?? [],
      total: result.total ?? 0,
    };
    void nextTick(resetTableVerticalScroll);
    restoreKeyboardSurfaceAfterQuery();
  } catch {
    if (dropdown.value.querySeq !== querySeq) return;
    if (dropdown.value.querySeq === querySeq) {
      dropdown.value = {
        ...dropdown.value,
        loading: false,
        rows: [],
        total: 0,
      };
    }
    restoreKeyboardSurfaceAfterQuery();
    message.error('库存查询失败，请稍后重试');
  }
}

function scheduleQuery(pageNo = 1) {
  clearQueryTimer();
  if (enhanced.value) {
    dropdown.value.querySeq += 1;
    dropdown.value.loading = true;
  }
  queryTimer = setTimeout(() => {
    void queryStock(pageNo);
  }, INLINE_STOCK_DEBOUNCE_DELAY);
}

function openDropdown() {
  if (dropdown.value.open || props.disabled || !canOpenDropdown()) {
    return;
  }
  const keyword = props.value || '';
  activeColumnFilters.value = {};
  activeSort.value = { direction: 'desc', field: 'count' };
  explicitSort.value = false;
  openColumnFilterField.value = '';
  dropdown.value = {
    activeIndex: 0,
    keyword,
    loading: false,
    open: true,
    pageNo: 1,
    pageSize: rememberedPageSize.value,
    querySeq: dropdown.value.querySeq,
    rows: [],
    selectedKeys: [],
    selectedRows: [],
    total: 0,
  };
  // eslint-disable-next-line vue/custom-event-name-casing -- Preserve the public event contract.
  emit('open-change', true);
  void queryStock(1);
}

function closeDropdown() {
  shouldFocusKeyboardSurfaceAfterQuery = false;
  pageSizeSelecting.value = false;
  settingsOpen.value = false;
  openColumnFilterField.value = '';
  clearQueryTimer();
  dropdown.value = {
    ...dropdown.value,
    open: false,
    querySeq: dropdown.value.querySeq + 1,
    selectedKeys: [],
    selectedRows: [],
  };
  // eslint-disable-next-line vue/custom-event-name-casing -- Preserve the public event contract.
  emit('open-change', false);
}

function handleOpenChange(open: boolean) {
  if (
    settingsOpen.value ||
    openColumnFilterField.value ||
    (!open && pageSizeSelecting.value)
  )
    return;
  pointerFocusing.value = false;
  if (open) {
    openDropdown();
    return;
  }
  closeDropdown();
}

function handleInputFocus() {
  if (!pointerFocusing.value) openDropdown();
}

function handleInput(value: string) {
  emit('update:value', value);
  if (!dropdown.value.open) {
    dropdown.value = {
      ...dropdown.value,
      keyword: value,
    };
    openDropdown();
    return;
  }
  dropdown.value = {
    ...dropdown.value,
    keyword: value,
    pageNo: 1,
  };
  scheduleQuery(1);
}

function clearSelectionForQuery() {
  dropdown.value = {
    ...dropdown.value,
    activeIndex: 0,
    pageNo: 1,
    selectedKeys: [],
    selectedRows: [],
  };
}

function queryFromFirstPage() {
  clearQueryTimer();
  clearSelectionForQuery();
  void queryStock(1);
}

function focusKeyboardSurface() {
  if (
    !dropdown.value.open ||
    settingsOpen.value ||
    openColumnFilterField.value
  ) {
    return;
  }
  tableWrapRef.value?.focus({ preventScroll: true });
}

function queueKeyboardSurfaceFocus() {
  void nextTick().then(focusKeyboardSurface);
}

function restoreKeyboardSurfaceAfterQuery() {
  if (!shouldFocusKeyboardSurfaceAfterQuery) return;
  shouldFocusKeyboardSurfaceAfterQuery = false;
  queueKeyboardSurfaceFocus();
}

function canSortColumn(field: string) {
  return inlineStockSortFields.has(field) && !isPriceHidden(field);
}

function handleColumnSort(field: string) {
  if (!canSortColumn(field)) return;
  if (activeSort.value.field !== field || !explicitSort.value) {
    activeSort.value = { direction: 'asc', field };
    explicitSort.value = true;
  } else if (activeSort.value.direction === 'asc') {
    activeSort.value = { direction: 'desc', field };
  } else {
    activeSort.value = { direction: 'desc', field: 'count' };
    explicitSort.value = false;
  }
  shouldFocusKeyboardSurfaceAfterQuery = true;
  queryFromFirstPage();
}

function handleColumnFilterOpenChange(field: string, open: boolean) {
  if (open) openColumnFilterField.value = field;
  else if (openColumnFilterField.value === field)
    openColumnFilterField.value = '';
  if (!open) queueKeyboardSurfaceFocus();
}

function applyColumnFilter(field: string, rawValue: string) {
  if (!inlineStockFilterFields.has(field)) return;
  const value = rawValue.trim();
  const next = { ...activeColumnFilters.value };
  if (value) next[field] = value;
  else delete next[field];
  activeColumnFilters.value = next;
  shouldFocusKeyboardSurfaceAfterQuery = true;
  queryFromFirstPage();
}

function clearAllColumnFilters() {
  activeColumnFilters.value = {};
  activeSort.value = { direction: 'desc', field: 'count' };
  explicitSort.value = false;
  shouldFocusKeyboardSurfaceAfterQuery = true;
  queryFromFirstPage();
}

function getStockSelected(row: ErpStockApi.Stock) {
  return dropdown.value.selectedKeys.includes(getStockRowKey(row));
}

function setStockSelection(row: ErpStockApi.Stock, checked: boolean) {
  const key = getStockRowKey(row);
  const selectedMap = new Map(
    dropdown.value.selectedRows.map((item) => [getStockRowKey(item), item]),
  );
  if (checked) {
    selectedMap.set(key, row);
  } else {
    selectedMap.delete(key);
  }
  dropdown.value = {
    ...dropdown.value,
    selectedKeys: [...selectedMap.keys()],
    selectedRows: [...selectedMap.values()],
  };
}

function handleCheckboxChange(row: ErpStockApi.Stock, event: Event) {
  setStockSelection(row, (event.target as HTMLInputElement)?.checked);
  const activeIndex = dropdown.value.rows.findIndex(
    (item) => getStockRowKey(item) === getStockRowKey(row),
  );
  if (activeIndex !== -1) dropdown.value.activeIndex = activeIndex;
  focusKeyboardSurface();
}

function handleRowClick(index: number) {
  dropdown.value.activeIndex = index;
  focusKeyboardSurface();
}

function handleRowPointerMove(index: number) {
  if (props.candidateFocusHighlight && dropdown.value.activeIndex !== index) {
    dropdown.value.activeIndex = index;
  }
}

function getActiveRow() {
  return dropdown.value.rows[dropdown.value.activeIndex];
}

function toggleActiveSelection() {
  const row = getActiveRow();
  if (!row) return;
  setStockSelection(row, !getStockSelected(row));
}

function moveActiveRow(offset: number) {
  const rows = dropdown.value.rows;
  if (rows.length === 0) return;
  dropdown.value = {
    ...dropdown.value,
    activeIndex:
      (dropdown.value.activeIndex + offset + rows.length) % rows.length,
  };
}

function handlePageChange(
  pageNo: number,
  requestedPageSize = dropdown.value.pageSize,
) {
  dropdown.value = {
    ...dropdown.value,
    pageNo,
    pageSize: requestedPageSize,
    selectedKeys: [],
    selectedRows: [],
  };
  shouldFocusKeyboardSurfaceAfterQuery = true;
  void queryStock(pageNo);
}

function handlePageSizeChange(value: Event | number) {
  clearQueryTimer();
  const next = Number(
    typeof value === 'number'
      ? value
      : (value.target as HTMLSelectElement).value,
  );
  if (!savePageSize(next))
    message.warning('每页条数已应用，但未能保存到当前浏览器');
  dropdown.value = {
    ...dropdown.value,
    activeIndex: 0,
    pageNo: 1,
    pageSize: rememberedPageSize.value,
    selectedKeys: [],
    selectedRows: [],
  };
  shouldFocusKeyboardSurfaceAfterQuery = false;
  void queryStock(1);
}

function resetTableVerticalScroll() {
  const table = tableWrapRef.value;
  if (table) table.scrollTop = 0;
}

function confirmSelection() {
  if (settingsOpen.value || dropdown.value.loading) return;
  let rows = dropdown.value.selectedRows;
  if (rows.length === 0) {
    const activeRow = getActiveRow();
    rows = activeRow ? [activeRow] : [];
  }
  if (rows.length === 0) {
    message.warning('请先选择库存明细');
    return;
  }
  emit('select', rows, props.row);
  closeDropdown();
}

function handleKeydown(event: KeyboardEvent) {
  if (
    settingsOpen.value ||
    Boolean(openColumnFilterField.value) ||
    !dropdown.value.open ||
    dropdown.value.loading ||
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    isInlineStockEditingTarget(event.target)
  ) {
    return;
  }
  if (event.key === 'ArrowDown') {
    consumeKeyboardEvent(event);
    moveActiveRow(1);
    return;
  }
  if (event.key === 'ArrowUp') {
    consumeKeyboardEvent(event);
    moveActiveRow(-1);
    return;
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    const pageCount = Math.max(
      1,
      Math.ceil(dropdown.value.total / dropdown.value.pageSize),
    );
    const targetPage = dropdown.value.pageNo + direction;
    if (targetPage >= 1 && targetPage <= pageCount) {
      consumeKeyboardEvent(event);
      handlePageChange(targetPage, dropdown.value.pageSize);
    }
    return;
  }
  if (event.key === 'Insert' || event.code === 'Insert') {
    consumeKeyboardEvent(event);
    toggleActiveSelection();
    return;
  }
  if (event.key === 'Enter') {
    consumeKeyboardEvent(event);
    confirmSelection();
  }
}

function getInlineStockAnchorInput() {
  const element = inputRef.value?.$el;
  return element?.matches('input')
    ? element
    : element?.querySelector<HTMLInputElement>('input');
}

function isInlineStockEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const anchorInput = getInlineStockAnchorInput();
  if (target === anchorInput || anchorInput?.contains(target)) return false;
  return Boolean(
    target.closest(
      'input, textarea, select, button, a, [role="button"], .ant-select, .ant-picker, .ant-input-number, .inline-stock-header-filter-panel, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
    ),
  );
}

function consumeKeyboardEvent(event: KeyboardEvent) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function startKeyboardListening() {
  if (isKeyboardListening) return;
  window.addEventListener('keydown', handleKeydown, true);
  isKeyboardListening = true;
}

function stopKeyboardListening() {
  if (!isKeyboardListening) return;
  window.removeEventListener('keydown', handleKeydown, true);
  isKeyboardListening = false;
}

watch(
  () => dropdown.value.open,
  (visible) => {
    if (visible) startKeyboardListening();
    else stopKeyboardListening();
  },
  { flush: 'sync' },
);

function formatStockCount(value: unknown) {
  if (stockDecimalContext || props.preserveQuantityPrecision)
    return formatStockNaturalNumber(value);
  return erpCountInputFormatter(value as number | string | undefined);
}

function isPriceHidden(field: string) {
  return (
    INLINE_STOCK_PRICE_FIELDS.has(field) &&
    isFieldHidden(props.hiddenFields, `item_${field}`)
  );
}

function formatStockPrice(row: ErpStockApi.Stock, field: string) {
  if (isPriceHidden(field)) {
    return '****';
  }
  return stockDecimalContext
    ? stockNatural((row as any)[field])
    : erpPriceInputFormatter((row as any)[field]) || '-';
}

function getStockCellText(row: ErpStockApi.Stock, field: string) {
  const value = (row as any)[field];
  return value === undefined || value === null || value === '' ? '-' : value;
}

function cellText(
  stock: ErpStockApi.Stock,
  column: (typeof visibleColumns.value)[number],
) {
  if (column.kind === 'price') return formatStockPrice(stock, column.field);
  if (column.kind === 'amount')
    return formatStockCount((stock as any)[column.field]);
  if (column.field === 'batchNo') return stock.batchNo || '未指定批次';
  return String(getStockCellText(stock, column.field));
}

defineExpose({
  close: closeDropdown,
  isOpen: () => dropdown.value.open,
  open: openDropdown,
});
</script>

<template>
  <Popover
    v-if="!enhanced"
    :open="dropdown.open"
    placement="bottomLeft"
    trigger="click"
    overlay-class-name="erp-inline-stock-select-popover"
    @open-change="handleOpenChange"
  >
    <template #content>
      <div
        class="erp-inline-stock-select-panel"
        :class="{ 'erp-candidate-focus-inline': candidateFocusHighlight }"
      >
        <Spin :spinning="dropdown.loading">
          <div
            ref="tableWrapRef"
            class="erp-inline-stock-select-table-wrap"
            tabindex="-1"
          >
            <table class="erp-inline-stock-select-table">
              <thead>
                <tr>
                  <th class="erp-inline-stock-select-check">
                    <input type="checkbox" disabled aria-label="库存选择" />
                  </th>
                  <th
                    v-for="column in inlineStockColumns"
                    :key="column.field"
                    :data-field="column.field"
                  >
                    <InlineStockHeaderCell
                      :field="column.field"
                      :filter-open="openColumnFilterField === column.field"
                      :filter-value="activeColumnFilters[column.field]"
                      :filterable="inlineStockFilterFields.has(column.field)"
                      :sort-active="activeSort.field === column.field"
                      :sort-direction="activeSort.direction"
                      :sortable="canSortColumn(column.field)"
                      :title="column.title"
                      @apply-filter="applyColumnFilter"
                      @clear-all-filters="clearAllColumnFilters"
                      @filter-open-change="handleColumnFilterOpenChange"
                      @sort="handleColumnSort"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(stock, index) in dropdown.rows"
                  :key="getStockRowKey(stock)"
                  :class="{
                    'erp-inline-stock-select-row--active':
                      index === dropdown.activeIndex,
                  }"
                  @pointermove="handleRowPointerMove(index)"
                  @click="handleRowClick(index)"
                  @dblclick="confirmSelection"
                >
                  <td class="erp-inline-stock-select-check">
                    <input
                      type="checkbox"
                      :checked="getStockSelected(stock)"
                      @change="(event) => handleCheckboxChange(stock, event)"
                      @click.stop
                    />
                  </td>
                  <td>{{ stock.batchNo || '未指定批次' }}</td>
                  <td>{{ stock.warehouseName || '-' }}</td>
                  <td>{{ stock.deptName || '-' }}</td>
                  <td class="erp-inline-stock-select-image-cell">
                    <Popover
                      v-if="hasStockImage(stock)"
                      placement="right"
                      trigger="hover"
                      overlay-class-name="erp-inline-stock-image-preview-popover"
                    >
                      <template #content>
                        <img
                          :src="stock.mainImage"
                          :alt="stock.productName || '配件图片'"
                          class="erp-inline-stock-image-preview"
                          @error="handleImageError(stock.mainImage)"
                        />
                      </template>
                      <img
                        :src="stock.mainImage"
                        :alt="stock.productName || '配件图片'"
                        class="erp-inline-stock-select-thumb"
                        @error="handleImageError(stock.mainImage)"
                      />
                    </Popover>
                    <span v-else class="erp-inline-stock-select-no-image">
                      无图
                    </span>
                  </td>
                  <td>{{ stock.productCode || '-' }}</td>
                  <td>{{ stock.productName || '-' }}</td>
                  <td>{{ formatStockCount(stock.count) }}</td>
                  <td>{{ formatStockCount(stock.occupiedCount) }}</td>
                  <td>{{ formatStockCount(stock.pendingInCount) }}</td>
                  <td>{{ formatStockCount(stock.availableCount) }}</td>
                  <td>{{ formatStockCount(stock.inTransitCount) }}</td>
                  <td>{{ stock.unitName || '-' }}</td>
                  <td>{{ formatStockPrice(stock, 'productPurchasePrice') }}</td>
                  <td>{{ formatStockPrice(stock, 'salePrice') }}</td>
                  <td>{{ formatStockPrice(stock, 'lastSalePrice') }}</td>
                  <td>{{ formatStockPrice(stock, 'minPrice') }}</td>
                  <td>{{ formatStockPrice(stock, 'referencePrice') }}</td>
                  <td>{{ formatStockPrice(stock, 'retailPrice') }}</td>
                  <td>{{ formatStockPrice(stock, 'lastPurchasePrice') }}</td>
                  <td>{{ formatStockPrice(stock, 'grossProfitRate') }}</td>
                  <td>{{ formatStockPrice(stock, 'backupPrice1') }}</td>
                  <td>{{ formatStockPrice(stock, 'wholesalePrice') }}</td>
                  <td>{{ formatStockPrice(stock, 'sharePrice') }}</td>
                  <td>{{ getStockCellText(stock, 'brand') }}</td>
                  <td>{{ getStockCellText(stock, 'vehicleModel') }}</td>
                  <td>{{ getStockCellText(stock, 'originPlace') }}</td>
                  <td>{{ getStockCellText(stock, 'standard') }}</td>
                  <td>{{ getStockCellText(stock, 'drawingNo') }}</td>
                  <td>{{ getStockCellText(stock, 'factoryCode') }}</td>
                  <td>{{ getStockCellText(stock, 'shelf') }}</td>
                </tr>
                <tr v-if="dropdown.rows.length === 0">
                  <td colspan="31" class="erp-inline-stock-select-empty">
                    暂无库存数据
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="erp-inline-stock-select-footer">
            <Pagination
              :current="dropdown.pageNo"
              :page-size="dropdown.pageSize"
              :show-size-changer="false"
              :show-total="(total) => `共 ${total} 条`"
              :total="dropdown.total"
              size="small"
              @change="handlePageChange"
            />
            <div class="erp-inline-stock-select-footer__actions">
              <span>已选 {{ dropdown.selectedRows.length }} 条</span>
              <Button size="small" @click="closeDropdown">取消</Button>
              <Button type="primary" size="small" @click="confirmSelection">
                加入明细
              </Button>
            </div>
          </div>
        </Spin>
      </div>
    </template>
    <Input
      ref="inputRef"
      :value="props.value"
      class="erp-inline-stock-select-input"
      data-erp-inline-stock-select-input="true"
      :data-erp-inline-stock-row-key="inputRowKey"
      :placeholder="props.placeholder"
      allow-clear
      @focus="openDropdown"
      @update:value="handleInput"
    />
  </Popover>

  <Popover
    v-else
    :open="dropdown.open"
    :align="dropdownAlign"
    :arrow="false"
    :auto-adjust-overflow="{ adjustX: 1, adjustY: 0 }"
    placement="bottomLeft"
    trigger="click"
    overlay-class-name="sale-inline-stock-select-popover"
    @open-change="handleOpenChange"
  >
    <template #content>
      <div
        class="sale-inline-stock-select-panel"
        :class="{ 'erp-candidate-focus-inline': candidateFocusHighlight }"
      >
        <Spin :spinning="dropdown.loading">
          <div
            ref="tableWrapRef"
            class="sale-inline-stock-select-table-wrap"
            :style="{ maxHeight: `${tableMaxHeight}px` }"
            tabindex="-1"
          >
            <table
              class="sale-inline-stock-select-table"
              :style="{ width: `${tableWidth}px` }"
            >
              <colgroup>
                <col style="width: 42px" />
                <col
                  v-for="column in visibleColumns"
                  :key="column.field"
                  :style="{ width: `${column.width}px` }"
                />
              </colgroup>
              <thead>
                <tr>
                  <th class="sale-inline-stock-select-check">
                    <input type="checkbox" disabled aria-label="库存选择" />
                  </th>
                  <th
                    v-for="column in visibleColumns"
                    :key="column.field"
                    :data-field="column.field"
                    :class="{
                      'sale-inline-stock-select-fixed': column.fixed,
                    }"
                    :style="columnStyle(column)"
                    :title="column.title"
                  >
                    <InlineStockHeaderCell
                      :field="column.field"
                      :filter-open="openColumnFilterField === column.field"
                      :filter-value="activeColumnFilters[column.field]"
                      :filterable="inlineStockFilterFields.has(column.field)"
                      :sort-active="activeSort.field === column.field"
                      :sort-direction="activeSort.direction"
                      :sortable="canSortColumn(column.field)"
                      :title="column.title"
                      @apply-filter="applyColumnFilter"
                      @clear-all-filters="clearAllColumnFilters"
                      @filter-open-change="handleColumnFilterOpenChange"
                      @sort="handleColumnSort"
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(stock, index) in dropdown.rows"
                  :key="getStockRowKey(stock)"
                  :class="{
                    'sale-inline-stock-select-row--active':
                      index === dropdown.activeIndex,
                  }"
                  @pointermove="handleRowPointerMove(index)"
                  @click="handleRowClick(index)"
                  @dblclick="confirmSelection"
                >
                  <td class="sale-inline-stock-select-check">
                    <input
                      type="checkbox"
                      :checked="getStockSelected(stock)"
                      @change="(event) => handleCheckboxChange(stock, event)"
                      @click.stop
                    />
                  </td>
                  <td
                    v-for="column in visibleColumns"
                    :key="column.field"
                    :data-field="column.field"
                    :class="{
                      'sale-inline-stock-select-fixed': column.fixed,
                      'sale-inline-stock-select-image-cell':
                        column.kind === 'image',
                    }"
                    :style="columnStyle(column)"
                    :title="
                      column.kind === 'image'
                        ? undefined
                        : cellText(stock, column)
                    "
                  >
                    <template v-if="column.kind === 'image'">
                      <Popover
                        v-if="hasStockImage(stock)"
                        placement="right"
                        trigger="hover"
                        overlay-class-name="sale-inline-stock-image-preview-popover"
                      >
                        <template #content>
                          <img
                            :src="stock.mainImage"
                            :alt="stock.productName || '配件图片'"
                            class="sale-inline-stock-image-preview"
                            @error="handleImageError(stock.mainImage)"
                          />
                        </template>
                        <img
                          :src="stock.mainImage"
                          :alt="stock.productName || '配件图片'"
                          class="sale-inline-stock-select-thumb"
                          @error="handleImageError(stock.mainImage)"
                        />
                      </Popover>
                      <span v-else class="sale-inline-stock-select-no-image">
                        无图
                      </span>
                    </template>
                    <template v-else>{{ cellText(stock, column) }}</template>
                  </td>
                </tr>
                <tr v-if="dropdown.rows.length === 0">
                  <td
                    :colspan="visibleColumns.length + 1"
                    class="sale-inline-stock-select-empty"
                  >
                    暂无库存数据
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div ref="footerRef" class="sale-inline-stock-select-footer">
            <div class="sale-inline-stock-select-footer__paging">
              <label class="sale-inline-stock-select-page-size">
                <span>每页</span>
                <Select
                  v-if="candidateFocusHighlight"
                  :value="dropdown.pageSize"
                  :options="
                    INLINE_STOCK_PAGE_SIZE_OPTIONS.map((value) => ({
                      value,
                      label: `${value} 条`,
                    }))
                  "
                  :popup-class-name="CANDIDATE_POPUP_CLASS"
                  :get-popup-container="
                    (trigger) => trigger.parentElement ?? trigger
                  "
                  size="small"
                  style="width: 82px"
                  aria-label="每页候选库存条数"
                  @dropdown-visible-change="
                    (open) => (pageSizeSelecting = open)
                  "
                  @change="(value) => handlePageSizeChange(Number(value))"
                  @click.stop
                  @pointerdown.stop
                />
                <select
                  v-else
                  :value="dropdown.pageSize"
                  data-inline-stock-page-size="true"
                  aria-label="每页候选库存条数"
                  @blur="pageSizeSelecting = false"
                  @change="handlePageSizeChange"
                  @click.stop
                  @focus="pageSizeSelecting = true"
                  @pointerdown.stop
                >
                  <option
                    v-for="option in INLINE_STOCK_PAGE_SIZE_OPTIONS"
                    :key="option"
                    :value="option"
                  >
                    {{ option }} 条
                  </option>
                </select>
              </label>
              <Pagination
                :current="dropdown.pageNo"
                :page-size="dropdown.pageSize"
                :show-size-changer="false"
                :show-total="(total) => `共 ${total} 条`"
                :total="dropdown.total"
                size="small"
                @change="handlePageChange"
              />
            </div>
            <div class="sale-inline-stock-select-footer__actions">
              <Button size="small" @click.stop="settingsOpen = true">
                列设置
              </Button>
              <span>已选 {{ dropdown.selectedRows.length }} 条</span>
              <Button size="small" @click="closeDropdown">取消</Button>
              <Button type="primary" size="small" @click="confirmSelection">
                加入明细
              </Button>
            </div>
          </div>
        </Spin>
      </div>
    </template>
    <Input
      ref="inputRef"
      :value="props.value"
      class="erp-inline-stock-select-input"
      data-erp-inline-stock-select-input="true"
      :data-erp-inline-stock-row-key="inputRowKey"
      :placeholder="props.placeholder"
      allow-clear
      @pointerdown="pointerFocusing = true"
      @blur="pointerFocusing = false"
      @focus="handleInputFocus"
      @update:value="handleInput"
    />
  </Popover>
  <InlineColumnSettingsModal
    v-if="settingsOpen"
    :columns="inlineStockColumns"
    :value="columnPreferences"
    :panel-width="panelWidth"
    @closed="closeSettings"
    @confirm="applyColumns"
  />
</template>

<style scoped>
:global(.erp-inline-stock-select-popover) {
  max-width: calc(100vw - 48px);
}

:global(.erp-inline-stock-select-popover .ant-popover-inner) {
  padding: 0;
}

:global(.erp-inline-stock-select-panel) {
  width: calc(100vw - 48px);
  overflow: hidden;
  font-size: 12px;
}

:global(.erp-inline-stock-select-table-wrap) {
  max-height: 360px;
  overflow: auto;
  border-bottom: 1px solid #e5e7eb;
}

:global(.erp-inline-stock-select-table) {
  min-width: 2680px;
  border-collapse: separate;
  border-spacing: 0;
  color: #1f2937;
  white-space: nowrap;
}

:global(.erp-inline-stock-select-table th),
:global(.erp-inline-stock-select-table td) {
  height: 32px;
  padding: 4px 8px;
  border-right: 1px solid #e5e7eb;
  border-bottom: 1px solid #eef2f7;
  text-align: left;
}

:global(.erp-inline-stock-select-table th) {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
}

:global(.erp-inline-stock-select-table tbody tr) {
  cursor: pointer;
}

:global(.erp-inline-stock-select-table tbody tr:hover),
:global(.erp-inline-stock-select-row--active) {
  background: #eaf2ff;
}

:global(.erp-inline-stock-select-check) {
  width: 42px;
  text-align: center !important;
}

:global(.erp-inline-stock-select-image-cell) {
  width: 64px;
  padding-top: 2px !important;
  padding-bottom: 2px !important;
  text-align: center !important;
}

:global(.erp-inline-stock-select-thumb) {
  display: block;
  width: 28px;
  height: 28px;
  margin: 0 auto;
  object-fit: contain;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}

:global(.erp-inline-stock-select-no-image) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 22px;
  color: #94a3b8;
  font-size: 11px;
}

:global(.erp-inline-stock-image-preview-popover .ant-popover-inner) {
  padding: 6px;
}

:global(.erp-inline-stock-image-preview) {
  display: block;
  width: 220px;
  max-width: 220px;
  max-height: 220px;
  object-fit: contain;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}

:global(.erp-inline-stock-select-empty) {
  height: 96px !important;
  color: #94a3b8;
  text-align: center !important;
}

:global(.erp-inline-stock-select-footer) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  background: #fff;
}

:global(.erp-inline-stock-select-footer__actions) {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #64748b;
  white-space: nowrap;
}

:global(.sale-inline-stock-select-footer__paging),
:global(.sale-inline-stock-select-page-size) {
  display: flex;
  align-items: center;
  gap: 8px;
}

:global(.sale-inline-stock-select-page-size) {
  color: #64748b;
  white-space: nowrap;
}

:global(.sale-inline-stock-select-page-size select) {
  height: 24px;
  padding: 0 22px 0 8px;
  color: #334155;
  font-size: 12px;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
}

:global(.erp-inline-stock-select-input.ant-input) {
  width: 100%;
  height: 32px;
  min-height: 32px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 30px;
  background: hsl(var(--background)) !important;
  border-color: #d8e0ea !important;
  border-radius: 4px !important;
  box-shadow: none;
}

:global(.erp-inline-stock-select-input.ant-input-affix-wrapper) {
  display: inline-flex;
  align-items: center;
  width: 100%;
  height: 32px;
  min-height: 32px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 30px;
  background: hsl(var(--background)) !important;
  border-color: #d8e0ea !important;
  border-radius: 4px !important;
  box-shadow: none;
}

:global(.erp-inline-stock-select-input.ant-input-affix-wrapper .ant-input) {
  height: 30px;
  min-height: 30px;
  padding: 0;
  font-size: 11px;
  line-height: 30px;
  background: transparent;
}

:global(
  .erp-inline-stock-select-input.ant-input-affix-wrapper .ant-input-clear-icon
) {
  font-size: 11px;
}

:global(.erp-inline-stock-select-input.ant-input:hover),
:global(.erp-inline-stock-select-input.ant-input-affix-wrapper:hover) {
  border-color: #9db5d6 !important;
}

:global(.erp-inline-stock-select-input.ant-input:focus),
:global(.erp-inline-stock-select-input.ant-input-affix-wrapper-focused) {
  border-color: #1677ff !important;
  box-shadow: 0 0 0 1px rgba(22, 119, 255, 0.12);
}

:global(.erp-inline-stock-select-input.ant-input::placeholder),
:global(
  .erp-inline-stock-select-input.ant-input-affix-wrapper .ant-input::placeholder
) {
  color: #94a3b8;
  font-size: 11px;
  line-height: 30px;
}

:global(.sale-inline-stock-select-popover) {
  max-width: calc(100vw - 48px);
}

:global(.sale-inline-stock-select-popover .ant-popover-inner) {
  padding: 0;
}

:global(.sale-inline-stock-select-panel) {
  width: calc(100vw - 48px);
  overflow: hidden;
  font-size: 12px;
}

:global(.sale-inline-stock-select-table-wrap) {
  max-height: 360px;
  overflow: auto;
  border-bottom: 1px solid #e5e7eb;
}

:global(.sale-inline-stock-select-table) {
  table-layout: fixed;
  border-collapse: separate;
  border-spacing: 0;
  color: #1f2937;
  white-space: nowrap;
}

:global(.sale-inline-stock-select-table th),
:global(.sale-inline-stock-select-table td) {
  height: 32px;
  padding: 4px 8px;
  border-right: 1px solid #e5e7eb;
  border-bottom: 1px solid #eef2f7;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  box-sizing: border-box;
}

:global(.sale-inline-stock-select-table th) {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
}

:global(.sale-inline-stock-select-table tbody tr) {
  cursor: pointer;
  background: #fff;
}

:global(.sale-inline-stock-select-table tbody tr:hover) {
  background: #eaf2ff;
}

:global(
  .sale-inline-stock-select-table tbody tr.sale-inline-stock-select-row--active
),
:global(
  .sale-inline-stock-select-table
    tbody
    tr.sale-inline-stock-select-row--active:hover
) {
  background: #fff1b8;
}

:global(.sale-inline-stock-select-table td) {
  background: inherit;
}
:global(.sale-inline-stock-select-fixed),
:global(.sale-inline-stock-select-check) {
  z-index: 2;
}
:global(.sale-inline-stock-select-table th.sale-inline-stock-select-fixed),
:global(.sale-inline-stock-select-table th.sale-inline-stock-select-check) {
  z-index: 3;
}
:global(.sale-inline-stock-select-check) {
  position: sticky;
  left: 0;
  width: 42px;
  text-align: center !important;
}

:global(.sale-inline-stock-select-image-cell) {
  padding-top: 2px !important;
  padding-bottom: 2px !important;
  text-align: center !important;
}

:global(.sale-inline-stock-select-thumb) {
  display: block;
  width: 28px;
  height: 28px;
  margin: 0 auto;
  object-fit: contain;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}

:global(.sale-inline-stock-select-no-image) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 22px;
  color: #94a3b8;
  font-size: 11px;
}

:global(.sale-inline-stock-image-preview-popover .ant-popover-inner) {
  padding: 6px;
}

:global(.sale-inline-stock-image-preview) {
  display: block;
  width: 220px;
  max-width: 220px;
  max-height: 220px;
  object-fit: contain;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}

:global(.sale-inline-stock-select-empty) {
  height: 96px !important;
  color: #94a3b8;
  text-align: center !important;
}

:global(.sale-inline-stock-select-footer) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 10px;
  background: #fff;
}

:global(.sale-inline-stock-select-footer__actions) {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  color: #64748b;
  white-space: nowrap;
}
</style>
