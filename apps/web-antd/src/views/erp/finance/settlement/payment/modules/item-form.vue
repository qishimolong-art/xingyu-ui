<script lang="ts" setup>
import {
  financeAdd,
  financeValue,
  financeSubtract,
  financeCompare,
} from '#/views/erp/finance/utils/finance-decimal';

import DecimalAmountInput from '#/views/erp/components/DecimalAmountInput.vue';
import { useFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { PaymentItemSortOrder } from '../item-sort';

import type { ErpFinancePaymentApi } from '#/api/erp/finance/payment';

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
import { sortFinancePaymentItems } from '../item-sort';
const { candidatePopupClass } = useFinanceCandidateFocus();

interface Props {
  items?: ErpFinancePaymentApi.FinancePaymentItem[];
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
  detail: [item: ErpFinancePaymentApi.FinancePaymentItem];
  'page-change': [page: { pageNo: number; pageSize: number }];
  'request-submit': [event?: KeyboardEvent];
  reverse: [item: ErpFinancePaymentApi.FinancePaymentItem];
  'sort-change': [sort: { field?: string; order?: PaymentItemSortOrder }];
  'update:items': [items: ErpFinancePaymentApi.FinancePaymentItem[]];
  'update:payment-price': [amount: number | string | null];
  'update:total-price': [amount: number | string | null];
}>();

const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];
const ITEM_TABLE_HEIGHT = 414;
const tableData = ref<ErpFinancePaymentApi.FinancePaymentItem[]>([]);
let lastEmittedItemsSignature = '';
const itemRowKeyManager = createFinanceItemClientRowKeyManager(
  'finance-payment-item',
);
const localPagination = ref({ pageNo: 1, pageSize: 10 });
const activeSort = ref<{
  field?: string;
  order?: PaymentItemSortOrder;
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

function handleBizDetail(row: ErpFinancePaymentApi.FinancePaymentItem) {
  if (!row.bizId) return;
  emit('detail', row);
}

function normalizeTableItems(
  items: ErpFinancePaymentApi.FinancePaymentItem[] = [],
) {
  return itemRowKeyManager.ensureRowKeys(items.map((item) => ({ ...item })));
}

function getCurrentDisplayItems() {
  const sortedItems = isRemotePagination.value
    ? [...tableData.value]
    : sortFinancePaymentItems(
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

function buildItemColumns(rows?: ErpFinancePaymentApi.FinancePaymentItem[]) {
  return useFormItemColumns(
    props.disabled,
    props.hiddenFields,
    props.allowReverse,
    { rows: rows ?? getCurrentDisplayItems(), editable: !props.disabled },
  );
}

async function reloadTableData(
  items: ErpFinancePaymentApi.FinancePaymentItem[] = [],
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

function handleSortChange({
  field,
  order,
}: {
  field?: string;
  order?: PaymentItemSortOrder;
}) {
  activeSort.value = { field, order };
  if (isRemotePagination.value) {
    emit('sort-change', activeSort.value);
    return;
  }
  localPagination.value.pageNo = 1;
  void reloadDisplayData();
}

function handlePageChange(pageNo: number, pageSize: number) {
  if (isRemotePagination.value) {
    emit('page-change', { pageNo, pageSize });
    return;
  }
  localPagination.value = { pageNo, pageSize };
  void reloadDisplayData();
}

const summaries = computed(() => ({
  totalPrice: tableData.value.reduce(
    (sum, item) => financeAdd(sum, item.totalPrice || 0),
    '0',
  ),
  paidPrice: tableData.value.reduce(
    (sum, item) => financeAdd(sum, item.paidPrice || 0),
    '0',
  ),
  paymentPrice: tableData.value.reduce(
    (sum, item) => financeAdd(sum, financeValue(item.paymentPrice || 0)),
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
    id: 'erp-finance-settlement-payment-item-list-v1',
    minHeight: 260,
    autoResize: true,
    border: true,
    fit: false,
    rowConfig: { keyField: 'clientRowKey', isHover: true },
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
  gridEvents: { sortChange: handleSortChange },
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
      'update:payment-price',
      financeSubtract(summaries.value.paymentPrice, props.discountPrice || 0),
    );
  },
  { deep: true },
);

function handleRowChange(row: ErpFinancePaymentApi.FinancePaymentItem) {
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
  items: ErpFinancePaymentApi.FinancePaymentItem[] = [],
) {
  return JSON.stringify(
    items.map((item) => [
      item.bizType,
      item.bizId,
      item.paymentPrice,
      item.remark,
      item.writeOffStatus,
    ]),
  );
}

function handlePaymentPriceInput(
  row: ErpFinancePaymentApi.FinancePaymentItem,
  value: string,
) {
  const accepted = acceptFinanceDecimalInput(value);
  if (accepted === undefined) return;
  (row as any).paymentPrice = accepted;
}

function handlePaymentPriceBlur(row: ErpFinancePaymentApi.FinancePaymentItem) {
  const normalized = normalizeFinanceDecimalInput(row.paymentPrice);
  if (normalized === undefined) return;
  (row as any).paymentPrice = normalized;
  handleRowChange(row);
}

function handleDelete(row: ErpFinancePaymentApi.FinancePaymentItem) {
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
  items: ErpFinancePaymentApi.FinancePaymentItem[],
) {
  await reloadTableData(items);
}

function validate() {
  if (tableData.value.length === 0) {
    return;
  }
  for (let i = 0; i < tableData.value.length; i++) {
    const item = tableData.value[i];
    if (
      item?.paymentPrice === undefined ||
      item.paymentPrice === null ||
      financeCompare(item.paymentPrice, 0) === 0
    ) {
      throw new Error(`第 ${i + 1} 行：本次结算金额不能为 0`);
    }
    if (
      financeCompare(item.totalPrice || 0, 0) > 0 &&
      financeCompare(item.paymentPrice, 0) < 0
    ) {
      throw new Error(`第 ${i + 1} 行：正向单据的本次付款不能小于 0`);
    }
    if (
      financeCompare(item.totalPrice || 0, 0) < 0 &&
      financeCompare(item.paymentPrice, 0) > 0
    ) {
      throw new Error(`第 ${i + 1} 行：负向单据的本次结算金额不能大于 0`);
    }
  }
}

function getItems() {
  return [...tableData.value];
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
  <div class="payment-item-form">
    <Grid class="payment-item-form__grid w-full">
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
      <template #paymentPrice="{ row }">
        <DecimalAmountInput
          :value="
            row.paymentPrice === undefined ? '' : String(row.paymentPrice)
          "
          :disabled="disabled"
          inputmode="decimal"
          placeholder="请输入本次付款"
          @blur="handlePaymentPriceBlur(row)"
          @press-enter="handleItemInputPressEnter"
          @update:value="handlePaymentPriceInput(row, $event)"
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
              auth: ['erp:finance-payment:writeoff-reverse'],
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
    </Grid>
    <div class="payment-item-form__pager">
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
.payment-item-form__grid {
  --payment-item-accent: 24 82% 42%;
}

:deep(.payment-item-form__grid .vxe-table) {
  height: 414px !important;
}

:global(.dark) .payment-item-form__grid {
  --payment-item-accent: 27 92% 64%;
}

:deep(.payment-item-form__grid .vxe-table--render-default) {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

:deep(.payment-item-form__grid .vxe-header--column) {
  height: 34px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

:deep(.payment-item-form__grid .vxe-body--column) {
  height: 38px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.payment-item-form__grid .ant-input),
:deep(.payment-item-form__grid .ant-input-number-input) {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

:deep(.payment-item-form__grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(
  .payment-item-form__grid .vxe-header--column.is--sortable .vxe-cell--title
) {
  color: #1677ff;
}

:deep(.payment-item-form__grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

.payment-item-form__pager {
  display: flex;
  justify-content: flex-end;
  padding: 8px 0 2px;
  font-size: 11px;
}

.payment-item-form__pager :deep(.ant-pagination),
.payment-item-form__pager :deep(.ant-pagination-item),
.payment-item-form__pager :deep(.ant-pagination-options),
.payment-item-form__pager :deep(.ant-pagination-options-quick-jumper),
.payment-item-form__pager :deep(.ant-select),
.payment-item-form__pager :deep(.ant-select-selection-item),
.payment-item-form__pager :deep(.ant-select-selection-placeholder),
.payment-item-form__pager :deep(.ant-input) {
  font-size: 11px;
}

.payment-item-form__pager :deep(.ant-select-single),
.payment-item-form__pager :deep(.ant-select-selector) {
  box-sizing: border-box;
  height: 24px !important;
  min-height: 24px !important;
  line-height: 22px !important;
}

.payment-item-form__pager :deep(.ant-select-selection-item),
.payment-item-form__pager :deep(.ant-select-selection-placeholder) {
  line-height: 22px !important;
}

.payment-item-form__pager :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  font-size: 11px;
}
</style>
