<script lang="ts" setup>
import {
  financeAdd,
  financeValue,
  financeSubtract,
  financeCompare,
  financeSign,
  financeAbs,
} from '#/views/erp/finance/utils/finance-decimal';

import DecimalAmountInput from '#/views/erp/components/DecimalAmountInput.vue';
import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import { useFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { ErpFinanceReceiptApi } from '#/api/erp/finance/receipt';

import { computed, nextTick, ref, watch } from 'vue';

import { Input, Pagination } from 'ant-design-vue';

import { TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { createFinanceItemClientRowKeyManager } from '#/views/erp/finance/utils/item-row-key';
import {
  acceptFinanceDecimalInput,
  normalizeFinanceDecimalInput,
} from '#/views/erp/finance/utils/text-number';
import { focusNextInputOnEnter } from '#/views/erp/utils/keyboard';

import { useFormItemColumns } from '../data';
const { candidatePopupClass } = useFinanceCandidateFocus();

type ReceiptItemSortOrder = 'asc' | 'desc';

interface Props {
  items?: ErpFinanceReceiptApi.FinanceReceiptItem[];
  disabled?: boolean;
  discountPrice?: number | string | null;
  hiddenFields?: string[];
  allowReverse?: boolean;
  loading?: boolean;
  pagination?: {
    pageNo: number;
    pageSize: number;
    total: number;
  };
  paginationMode?: 'local' | 'remote';
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  disabled: false,
  discountPrice: 0,
  hiddenFields: () => [],
  allowReverse: false,
  loading: false,
  pagination: () => ({ pageNo: 1, pageSize: 10, total: 0 }),
  paginationMode: 'local',
});

const emit = defineEmits<{
  detail: [item: ErpFinanceReceiptApi.FinanceReceiptItem];
  'page-change': [page: { pageNo: number; pageSize: number }];
  'request-submit': [event?: KeyboardEvent];
  reverse: [item: ErpFinanceReceiptApi.FinanceReceiptItem];
  'sort-change': [sort: { field?: string; order?: ReceiptItemSortOrder }];
  'update:items': [items: ErpFinanceReceiptApi.FinanceReceiptItem[]];
  'update:receipt-price': [amount: number | string | null];
  'update:total-price': [amount: number | string | null];
}>();

const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];
const ITEM_TABLE_HEIGHT = 414;
const tableData = ref<ErpFinanceReceiptApi.FinanceReceiptItem[]>([]);
let lastEmittedItemsSignature = '';
const itemRowKeyManager = createFinanceItemClientRowKeyManager(
  'finance-receipt-item',
);
const localPagination = ref({ pageNo: 1, pageSize: 10 });
const activeSort = ref<{
  field?: string;
  order?: ReceiptItemSortOrder;
}>({});
const isRemotePagination = computed(() => props.paginationMode === 'remote');
const currentPageNo = computed(() =>
  isRemotePagination.value
    ? props.pagination.pageNo
    : localPagination.value.pageNo,
);
const currentPageSize = computed(() =>
  isRemotePagination.value
    ? props.pagination.pageSize
    : localPagination.value.pageSize,
);
const currentTotal = computed(() =>
  isRemotePagination.value ? props.pagination.total : tableData.value.length,
);

function compareValue(a: unknown, b: unknown) {
  const aText = a === undefined || a === null ? '' : String(a);
  const bText = b === undefined || b === null ? '' : String(b);
  const aNumber = Number(aText);
  const bNumber = Number(bText);
  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
    return financeCompare(aText, bText);
  }
  return aText.localeCompare(bText, 'zh-Hans-CN');
}

function sortFinanceReceiptItems(
  items: ErpFinanceReceiptApi.FinanceReceiptItem[],
  field?: string,
  order?: ReceiptItemSortOrder,
) {
  if (!field || !order) {
    return [...items];
  }
  const direction = order === 'desc' ? -1 : 1;
  return items.toSorted(
    (a, b) => compareValue((a as any)[field], (b as any)[field]) * direction,
  );
}

function handleBizDetail(row: ErpFinanceReceiptApi.FinanceReceiptItem) {
  if (!row.bizId) return;
  emit('detail', row);
}

function normalizeTableItems(
  items: ErpFinanceReceiptApi.FinanceReceiptItem[] = [],
) {
  return itemRowKeyManager.ensureRowKeys(items.map((item) => ({ ...item })));
}

function getCurrentDisplayItems() {
  const sortedItems = isRemotePagination.value
    ? [...tableData.value]
    : sortFinanceReceiptItems(
        tableData.value,
        activeSort.value.field,
        activeSort.value.order,
      );
  return isRemotePagination.value
    ? sortedItems
    : sortedItems.slice(
        (currentPageNo.value - 1) * currentPageSize.value,
        currentPageNo.value * currentPageSize.value,
      );
}

function buildItemColumns(rows?: ErpFinanceReceiptApi.FinanceReceiptItem[]) {
  return useFormItemColumns(
    props.disabled,
    props.hiddenFields,
    props.allowReverse,
    { rows: rows ?? getCurrentDisplayItems(), editable: !props.disabled },
  );
}

async function reloadTableData(
  items: ErpFinanceReceiptApi.FinanceReceiptItem[] = [],
) {
  tableData.value = normalizeTableItems(items);
  await reloadDisplayData();
}

async function reloadDisplayData() {
  const displayItems = getCurrentDisplayItems();
  await nextTick();
  await gridApi.grid.reloadColumn(buildItemColumns(displayItems));
  await gridApi.grid.reloadData(displayItems);
}

const summaries = computed(() => ({
  totalPrice: tableData.value.reduce(
    (sum, item) => financeAdd(sum, item.totalPrice || 0),
    '0',
  ),
  receiptedPrice: tableData.value.reduce(
    (sum, item) => financeAdd(sum, item.receiptedPrice || 0),
    '0',
  ),
  receiptPrice: tableData.value.reduce(
    (sum, item) => financeAdd(sum, financeValue(item.receiptPrice || 0)),
    '0',
  ),
}));

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: buildItemColumns([]),
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    data: tableData.value,
    height: ITEM_TABLE_HEIGHT,
    id: 'erp-finance-settlement-receipt-item-list-v1',
    minHeight: 260,
    autoResize: true,
    border: true,
    fit: false,
    rowConfig: {
      keyField: 'clientRowKey',
      isHover: true,
    },
    pagerConfig: { enabled: false },
    sortConfig: {
      remote: true,
      multiple: false,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
      allowBtn: false,
    },
    toolbarConfig: {
      custom: true,
      enabled: true,
      refresh: false,
      search: false,
      zoom: true,
    },
  },
  gridEvents: {
    sortChange: ({ field, order }: any) => {
      activeSort.value =
        field && (order === 'asc' || order === 'desc') ? { field, order } : {};
      if (isRemotePagination.value) {
        emit('sort-change', activeSort.value);
        return;
      }
      localPagination.value.pageNo = 1;
      void reloadDisplayData();
    },
  },
});

watch(
  () => [props.disabled, props.hiddenFields, props.allowReverse],
  async () => {
    await nextTick();
    await gridApi.grid.reloadColumn(buildItemColumns());
  },
  { deep: true },
);

watch(
  () => props.items,
  async (items) => {
    const signature = getItemsSignature(items || []);
    if (signature === lastEmittedItemsSignature) return;
    await reloadTableData(items || []);
  },
  { immediate: true, deep: true },
);

watch(
  () => [tableData.value, props.discountPrice],
  () => {
    if (props.disabled || tableData.value.length === 0) {
      return;
    }
    emit('update:total-price', summaries.value.totalPrice);
    emit(
      'update:receipt-price',
      financeSubtract(summaries.value.receiptPrice, props.discountPrice || 0),
    );
  },
  { deep: true },
);

function handleRowChange(row: ErpFinanceReceiptApi.FinanceReceiptItem) {
  const index = tableData.value.findIndex(
    (item) => item.bizId === row.bizId && item.bizType === row.bizType,
  );
  if (index !== -1) {
    tableData.value[index] = row;
  }
  lastEmittedItemsSignature = getItemsSignature(tableData.value);
  emit('update:items', [...tableData.value]);
}

function getItemsSignature(
  items: ErpFinanceReceiptApi.FinanceReceiptItem[] = [],
) {
  return JSON.stringify(
    items.map((item) => [
      item.bizType,
      item.bizId,
      item.receiptPrice,
      item.remark,
      item.writeOffStatus,
    ]),
  );
}

function handleReceiptPriceInput(
  row: ErpFinanceReceiptApi.FinanceReceiptItem,
  value: string,
) {
  const accepted = acceptFinanceDecimalInput(value);
  if (accepted === undefined) return;
  (row as any).receiptPrice = accepted;
}

function handleReceiptPriceBlur(row: ErpFinanceReceiptApi.FinanceReceiptItem) {
  const normalized = normalizeFinanceDecimalInput(row.receiptPrice);
  if (normalized === undefined) return;
  (row as any).receiptPrice = normalized;
  handleRowChange(row);
}

function handleDelete(row: ErpFinanceReceiptApi.FinanceReceiptItem) {
  tableData.value = tableData.value.filter(
    (item) => !(item.bizId === row.bizId && item.bizType === row.bizType),
  );
  const maxPage = Math.max(
    1,
    Math.ceil(tableData.value.length / localPagination.value.pageSize),
  );
  if (!isRemotePagination.value && localPagination.value.pageNo > maxPage) {
    localPagination.value.pageNo = maxPage;
  }
  emit('update:items', [...tableData.value]);
  void reloadDisplayData();
}

async function setImportedItems(
  items: ErpFinanceReceiptApi.FinanceReceiptItem[],
) {
  await reloadTableData(items);
}

function validate() {
  if (tableData.value.length === 0) {
    return;
  }
  for (let i = 0; i < tableData.value.length; i++) {
    const item = tableData.value[i];
    const remaining = financeSubtract(
      financeValue(item?.totalPrice || 0),
      financeValue(item?.receiptedPrice || 0),
    );
    const amount = financeValue(item?.receiptPrice || 0);
    if (
      financeCompare(amount, 0) === 0 ||
      financeCompare(financeSign(amount), financeSign(remaining)) !== 0 ||
      financeCompare(financeAbs(amount), financeAbs(remaining)) > 0
    ) {
      throw new Error(`第 ${i + 1} 行：核销金额必须在未核销金额范围内`);
    }
  }
}

function getItems() {
  return [...tableData.value];
}

function handlePageChange(pageNo: number, pageSize: number) {
  if (isRemotePagination.value) {
    emit('page-change', { pageNo, pageSize });
    return;
  }
  localPagination.value = { pageNo, pageSize };
  void reloadDisplayData();
}

function handleItemInputPressEnter(event: KeyboardEvent) {
  const result = focusNextInputOnEnter(event);
  if (result === 'last-input') {
    emit('request-submit', event);
  }
}

defineExpose({ getItems, validate, setImportedItems });
</script>

<template>
  <div class="receipt-item-form">
    <Grid class="receipt-item-form__grid w-full">
      <template #bizNo="{ row }">
        <a
          v-if="row.bizNo && row.bizId"
          class="cursor-pointer text-primary"
          @click.stop="handleBizDetail(row)"
        >
          {{ row.bizNo }}
        </a>
        <span v-else>{{ row.bizNo || '-' }}</span>
      </template>
      <template #receiptPrice="{ row }">
        <DecimalAmountInput
          :value="
            row.receiptPrice === undefined ? '' : String(row.receiptPrice)
          "
          :disabled="disabled"
          inputmode="decimal"
          placeholder="请输入本次收款"
          @blur="handleReceiptPriceBlur(row)"
          @press-enter="handleItemInputPressEnter"
          @update:value="handleReceiptPriceInput(row, $event)"
        />
      </template>
      <template #writeOffStatus="{ row }">
        {{ ['待生效', '已生效', '已撤销'][Number(row.writeOffStatus)] || '-' }}
      </template>
      <template #remark="{ row }">
        <Input
          v-model:value="row.remark"
          :disabled="disabled"
          placeholder="请输入备注"
          @change="handleRowChange(row)"
          @press-enter="handleItemInputPressEnter"
        />
      </template>
      <template #actions="{ row }">
        <TableAction
          v-if="disabled"
          :actions="[
            {
              label: '撤销',
              type: 'link',
              danger: true,
              auth: ['erp:finance-receipt:writeoff-reverse'],
              ifShow: () => allowReverse && row.writeOffStatus === 1,
              onClick: () => emit('reverse', row),
            },
          ]"
        />
        <TableAction
          v-else
          :actions="[
            {
              label: '删除',
              type: 'link',
              danger: true,
              popConfirm: {
                title: '确认删除该明细吗？',
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
      <template #bottom>
        <div class="receipt-item-form__summary">
          <span class="receipt-item-form__summary-label">明细合计</span>
          <span>
            应收 <b>{{ erpPriceInputFormatter(summaries.totalPrice) }}</b>
          </span>
          <span>
            已核销 <b>{{ erpPriceInputFormatter(summaries.receiptedPrice) }}</b>
          </span>
          <span class="receipt-item-form__summary-actual">
            本次核销 <b>{{ erpPriceInputFormatter(summaries.receiptPrice) }}</b>
          </span>
        </div>
      </template>
    </Grid>
    <div class="receipt-item-form__pager">
      <Pagination
        :class="candidatePopupClass()"
        size="small"
        :current="currentPageNo"
        :page-size="currentPageSize"
        :page-size-options="PAGE_SIZE_OPTIONS"
        :show-total="(total: number) => `共 ${total} 条明细`"
        :total="currentTotal"
        :disabled="loading"
        show-quick-jumper
        show-size-changer
        @change="handlePageChange"
        @show-size-change="handlePageChange"
      />
    </div>
  </div>
</template>

<style scoped>
:deep(.receipt-item-form__grid .vxe-table--render-default) {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

:deep(.receipt-item-form__grid .vxe-table) {
  height: 414px !important;
}

:deep(.receipt-item-form__grid .vxe-header--column) {
  height: 34px;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.01em;
}

:deep(.receipt-item-form__grid .vxe-body--column) {
  height: 36px;
  font-size: 11px;
  line-height: 18px;
}

:deep(.receipt-item-form__grid .ant-input),
:deep(.receipt-item-form__grid .ant-input-number-input) {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.receipt-item-form__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 22px;
  align-items: center;
  justify-content: flex-end;
  min-height: 44px;
  padding: 8px 14px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 28%);
  border-top: 1px solid hsl(var(--border));
}

.receipt-item-form__summary-label {
  margin-right: auto;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.receipt-item-form__summary b {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}

.receipt-item-form__summary-actual {
  padding: 4px 9px;
  font-weight: 600;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 9%);
  border-radius: 5px;
}

.receipt-item-form__summary-actual b {
  font-size: 13px;
  color: hsl(var(--primary));
}

:deep(
  .receipt-item-form__grid .vxe-header--column.is--sortable .vxe-cell--title
) {
  color: #1677ff;
}

:deep(.receipt-item-form__grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

.receipt-item-form__pager {
  display: flex;
  justify-content: flex-end;
  padding: 8px 0 2px;
  font-size: 11px;
}

.receipt-item-form__pager :deep(.ant-pagination),
.receipt-item-form__pager :deep(.ant-pagination-item),
.receipt-item-form__pager :deep(.ant-pagination-options),
.receipt-item-form__pager :deep(.ant-pagination-options-quick-jumper),
.receipt-item-form__pager :deep(.ant-select),
.receipt-item-form__pager :deep(.ant-select-selection-item),
.receipt-item-form__pager :deep(.ant-select-selection-placeholder),
.receipt-item-form__pager :deep(.ant-input) {
  font-size: 11px;
}

.receipt-item-form__pager :deep(.ant-select-single),
.receipt-item-form__pager :deep(.ant-select-selector) {
  box-sizing: border-box;
  height: 24px !important;
  min-height: 24px !important;
  line-height: 22px !important;
}

.receipt-item-form__pager :deep(.ant-select-selection-item),
.receipt-item-form__pager :deep(.ant-select-selection-placeholder) {
  line-height: 22px !important;
}

.receipt-item-form__pager :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  font-size: 11px;
}
</style>
