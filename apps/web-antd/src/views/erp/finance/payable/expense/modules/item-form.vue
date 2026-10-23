<script lang="ts" setup>
import {
  financeValue,
  financeAdd,
} from '#/views/erp/finance/utils/finance-decimal';

import { useFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { PayableExpenseItemSortOrder } from '../item-sort';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPayableExpenseApi } from '#/api/erp/finance/payable/expense';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

import { DatePicker, Input, message, Pagination, Select } from 'ant-design-vue';

import { TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getBaseDataSimpleList } from '#/api/erp/base';
import { getSimpleDeptList } from '#/api/system/dept';
import { getSimpleUserList } from '#/api/system/user';
import { FileUpload } from '#/components/upload';
import { isFieldHidden } from '#/composables/useFieldPermission';
import {
  getFinanceDocumentDisplayText,
  hydrateFinanceDocumentFormSelectLabels,
} from '#/views/erp/finance/utils/document-form-ui';
import {
  applyFinanceDocumentItemColumnCustomization,
  fitFinanceDocumentItemColumnsToWidth,
} from '#/views/erp/finance/utils/document-item-table';
import { createFinanceItemClientRowKeyManager } from '#/views/erp/finance/utils/item-row-key';
import {
  focusFirstEditableInput,
  focusNextInputOnEnter,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';

import { PAYABLE_EXPENSE_ITEM_PROJECT, useItemColumns } from '../data';
import { sortPayableExpenseItems } from '../item-sort';
import { normalizePayableExpenseDate } from '../ui';
import {
  formatPayableExpenseAmountInput,
  formatPayableExpenseQtyInput,
  normalizePayableExpenseAmount,
  parsePayableExpenseAmountText,
  parsePayableExpenseQtyText,
} from './payable-expense-item-input';
const { candidatePopupClass } = useFinanceCandidateFocus();

type EditablePayableExpenseItem = ErpPayableExpenseApi.PayableExpenseItem & {
  amountText?: string;
  qtyText?: string;
};

interface Props {
  disabled?: boolean;
  hiddenFields?: string[];
  items?: ErpPayableExpenseApi.PayableExpenseItem[];
  loading?: boolean;
  pagination?: {
    pageNo: number;
    pageSize: number;
    total: number;
  };
  paginationMode?: 'local' | 'remote';
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  hiddenFields: () => [],
  items: () => [],
  loading: false,
  pagination: () => ({ pageNo: 1, pageSize: 10, total: 0 }),
  paginationMode: 'local',
});

const emit = defineEmits([
  'page-change',
  'request-add',
  'request-delete',
  'request-submit',
  'sort-change',
  'update:items',
  'update:total-amount',
]);

const PAYABLE_EXPENSE_AMOUNT_INPUT_SELECTOR =
  '[data-payable-expense-amount-input="true"]';
const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];
const ITEM_TABLE_HEIGHT = 414;
const tableData = ref<ErpPayableExpenseApi.PayableExpenseItem[]>([]);
const itemTableWrapRef = ref<HTMLElement | null>(null);
const localPagination = ref({ pageNo: 1, pageSize: 10 });
const deptOptions = ref<{ label: string; value: number }[]>([]);
const userOptions = ref<{ label: string; value: number }[]>([]);
const itemProjectOptions = ref<{ label: string; value: string }[]>([]);
const activeItemSort = ref<
  undefined | { field: string; order: PayableExpenseItemSortOrder }
>();
let syncingFromProps = false;
let editingNumberText = false;
const itemRowKeyManager = createFinanceItemClientRowKeyManager(
  'payable-expense-item',
);
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

const summaries = computed(() => ({
  totalAmount: tableData.value.reduce(
    (sum, item) => financeAdd(sum, financeValue(item.amount || 0)),
    '0',
  ),
}));

function normalizeItem(
  item: ErpPayableExpenseApi.PayableExpenseItem,
): ErpPayableExpenseApi.PayableExpenseItem {
  const normalized = {
    qty: 1,
    ...item,
    bizDate: normalizePayableExpenseDate(item.bizDate),
  };
  itemRowKeyManager.ensureRowKey(normalized);
  return normalized;
}

function buildItemColumns(
  disabled = props.disabled,
  hiddenFields = props.hiddenFields,
  rows: ErpPayableExpenseApi.PayableExpenseItem[] = getDisplayTableData(),
) {
  return (
    useItemColumns(disabled, hiddenFields, {
      editable: !disabled,
      rows,
      trailingFlexibleColumnMinWidth: 150,
    }) || []
  ).map((column) => (column.field ? { ...column, sortable: true } : column));
}

function buildCustomizedItemColumns(
  rows: ErpPayableExpenseApi.PayableExpenseItem[] = getDisplayTableData(),
) {
  return fitFinanceDocumentItemColumnsToWidth(
    applyFinanceDocumentItemColumnCustomization(
      buildItemColumns(props.disabled, props.hiddenFields, rows),
      gridApi.grid.getFullColumns?.() ?? [],
      150,
    ),
    itemTableWrapRef.value?.clientWidth ?? 0,
  );
}

function getDisplayTableData() {
  const activeSort = activeItemSort.value;
  const displayItems =
    !activeSort || isRemotePagination.value
      ? [...tableData.value]
      : sortPayableExpenseItems(
          tableData.value,
          activeSort.field,
          activeSort.order,
        );
  if (isRemotePagination.value) {
    return displayItems;
  }
  return displayItems.slice(
    (currentPageNo.value - 1) * currentPageSize.value,
    currentPageNo.value * currentPageSize.value,
  );
}

async function refreshItemGrid() {
  const displayData = getDisplayTableData();
  await nextTick();
  await gridApi.grid.reloadColumn(buildCustomizedItemColumns(displayData));
  await gridApi.grid.reloadData(displayData);
  if (activeItemSort.value) {
    await gridApi.grid.setSort(activeItemSort.value);
  }
}

async function handleItemColumnCustom({ type }: { type?: string }) {
  if (type !== 'confirm' && type !== 'reset') return;
  await nextTick();
  await gridApi.grid.reloadColumn(buildCustomizedItemColumns());
  if (activeItemSort.value) {
    await gridApi.grid.setSort(activeItemSort.value);
  }
}

async function handleItemSortChange({ field, order }: any) {
  activeItemSort.value =
    field && (order === 'asc' || order === 'desc')
      ? { field, order }
      : undefined;
  if (isRemotePagination.value) {
    emit('sort-change', activeItemSort.value);
    return;
  }
  localPagination.value.pageNo = 1;
  await refreshItemGrid();
}

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: buildItemColumns(props.disabled, props.hiddenFields, []),
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
    id: 'erp-finance-payable-expense-item-list-v2',
    minHeight: 250,
    autoResize: true,
    border: true,
    fit: false,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 0 },
    rowConfig: { keyField: 'clientRowKey', isCurrent: true, isHover: true },
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
      refresh: {
        queryMethod: () => refreshItemGrid(),
      },
      search: false,
      zoom: true,
    },
  } as VxeTableGridOptions<ErpPayableExpenseApi.PayableExpenseItem>,
  gridEvents: {
    custom: handleItemColumnCustom,
    sortChange: handleItemSortChange,
  },
});

watch(
  () => [props.disabled, props.hiddenFields],
  async () => {
    await nextTick();
    await gridApi.grid.reloadColumn(buildCustomizedItemColumns());
  },
  { deep: true },
);

watch(
  () => props.items,
  async (items) => {
    if (!items) {
      return;
    }
    const incomingSignature = getItemsSignature(items);
    const currentSignature = getItemsSignature(
      tableData.value.map(toBusinessItem),
    );
    if (incomingSignature === currentSignature) return;
    syncingFromProps = true;
    const normalizedItems = items.map((item) => {
      const normalized = normalizeItem(item) as EditablePayableExpenseItem;
      setQtyText(normalized);
      setAmountText(normalized);
      return normalized;
    });
    tableData.value = await hydratePayableExpenseItemLabels(normalizedItems);
    await refreshItemGrid();
    syncingFromProps = false;
  },
  { immediate: true },
);

async function hydratePayableExpenseItemLabels(
  items: ErpPayableExpenseApi.PayableExpenseItem[],
) {
  const hydratedItems = await Promise.all(
    items.map((item) =>
      hydrateFinanceDocumentFormSelectLabels(item, {
        deptOptions: deptOptions.value,
        userOptions: userOptions.value,
      }),
    ),
  );
  hydratedItems.forEach((item) => syncItemDisplayNames(item));
  return hydratedItems;
}

watch(
  () => tableData.value,
  () => {
    if (syncingFromProps || editingNumberText) return;
    emit('update:items', tableData.value.map(toBusinessItem));
    emit('update:total-amount', summaries.value.totalAmount);
  },
  { deep: true },
);

async function initOptions() {
  const [deptList, userList, itemProjectList] = await Promise.all([
    getSimpleDeptList(),
    getSimpleUserList(),
    getBaseDataSimpleList(PAYABLE_EXPENSE_ITEM_PROJECT),
  ]);
  deptOptions.value = (deptList || []).map((item) => ({
    label: item.name,
    value: item.id!,
  }));
  userOptions.value = (userList || []).map((item) => ({
    label: item.nickname,
    value: item.id!,
  }));
  itemProjectOptions.value = (itemProjectList || []).map((item) => ({
    label: item.name,
    value: item.name,
  }));
  tableData.value.forEach((item) => syncItemDisplayNames(item));
  if (activeItemSort.value) {
    await refreshItemGrid();
  }
}

void initOptions();

function addRow() {
  if (isRemotePagination.value) {
    emit('request-add');
    return;
  }
  tableData.value.push(
    normalizeItem({
      amount: undefined,
      itemName: '',
      qty: 1,
    }) as EditablePayableExpenseItem,
  );
  const row = tableData.value.at(-1)!;
  setQtyText(row);
  setAmountText(row);
  const clientRowKey = row.clientRowKey!;
  if (!isRemotePagination.value) {
    localPagination.value.pageNo = Math.max(
      1,
      Math.ceil(tableData.value.length / localPagination.value.pageSize),
    );
  }
  void refreshItemGrid().then(() => queueFocusRowAmountInput(clientRowKey));
}

function handleDelete(row: ErpPayableExpenseApi.PayableExpenseItem) {
  if (isRemotePagination.value) {
    emit('request-delete', row);
    return;
  }
  tableData.value = tableData.value.filter(
    (item) => item.clientRowKey !== row.clientRowKey,
  );
  const maxPage = Math.max(
    1,
    Math.ceil(tableData.value.length / localPagination.value.pageSize),
  );
  if (!isRemotePagination.value && localPagination.value.pageNo > maxPage) {
    localPagination.value.pageNo = maxPage;
  }
  void refreshItemGrid();
}

function handleRowChange(row?: ErpPayableExpenseApi.PayableExpenseItem) {
  if (row) {
    syncItemDisplayNames(row);
  }
  if (activeItemSort.value) {
    void nextTick(refreshItemGrid);
  }
}

function getItemsSignature(items: ErpPayableExpenseApi.PayableExpenseItem[]) {
  return JSON.stringify(
    items.map((item) => {
      const businessItem = toBusinessItem(item);
      return Object.keys(businessItem)
        .toSorted()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = (businessItem as Record<string, unknown>)[key];
          return result;
        }, {});
    }),
  );
}

function toBusinessItem(row: ErpPayableExpenseApi.PayableExpenseItem) {
  const {
    amountText: _amountText,
    qtyText: _qtyText,
    ...businessItem
  } = row as EditablePayableExpenseItem;
  return businessItem;
}

function setQtyText(row: ErpPayableExpenseApi.PayableExpenseItem) {
  (row as EditablePayableExpenseItem).qtyText = formatPayableExpenseQtyInput(
    row.qty,
  );
}

function setAmountText(row: ErpPayableExpenseApi.PayableExpenseItem) {
  (row as EditablePayableExpenseItem).amountText =
    formatPayableExpenseAmountInput(row.amount);
}

function getQtyText(row: ErpPayableExpenseApi.PayableExpenseItem) {
  return (row as EditablePayableExpenseItem).qtyText ?? '';
}

function getAmountText(row: ErpPayableExpenseApi.PayableExpenseItem) {
  return (row as EditablePayableExpenseItem).amountText ?? '';
}

function handleNumberTextInput(
  row: ErpPayableExpenseApi.PayableExpenseItem,
  field: 'amountText' | 'qtyText',
  value: unknown,
) {
  editingNumberText = true;
  (row as EditablePayableExpenseItem)[field] = String(value ?? '');
  void nextTick(() => {
    editingNumberText = false;
  });
}

function handleQtyBlur(row: ErpPayableExpenseApi.PayableExpenseItem) {
  const parsed = parsePayableExpenseQtyText(getQtyText(row));
  if (!parsed.ok) {
    message.warning(parsed.message);
    setQtyText(row);
    return;
  }
  row.qty = parsed.value;
  setQtyText(row);
  handleRowChange(row);
}

function handleAmountBlur(row: ErpPayableExpenseApi.PayableExpenseItem) {
  const parsed = parsePayableExpenseAmountText(getAmountText(row));
  if (!parsed.ok) {
    message.warning(parsed.message);
    setAmountText(row);
    return;
  }
  row.amount = normalizePayableExpenseAmount(parsed.value);
  setAmountText(row);
  handleRowChange(row);
}

function materializeValidNumberText(
  row: ErpPayableExpenseApi.PayableExpenseItem,
) {
  const qty = parsePayableExpenseQtyText(getQtyText(row));
  if (qty.ok) row.qty = qty.value;
  const amount = parsePayableExpenseAmountText(getAmountText(row));
  if (amount.ok) row.amount = normalizePayableExpenseAmount(amount.value);
}

function syncItemDisplayNames(row: ErpPayableExpenseApi.PayableExpenseItem) {
  const deptName = deptOptions.value.find(
    (item) => item.value === row.deptId,
  )?.label;
  const handlerName = userOptions.value.find(
    (item) => item.value === row.handlerId,
  )?.label;
  if (deptName) {
    row.deptName = deptName;
  }
  if (handlerName) {
    row.handlerName = handlerName;
  }
}

function getItemDisplayText(
  row: ErpPayableExpenseApi.PayableExpenseItem,
  fieldName: 'deptId' | 'handlerId',
) {
  return getFinanceDocumentDisplayText(row, fieldName) || '-';
}

function validate() {
  if (tableData.value.length === 0) {
    throw new Error('请至少添加一条费用明细');
  }
  for (let i = 0; i < tableData.value.length; i++) {
    const item = tableData.value[i];
    if (!item) {
      continue;
    }
    const qty = parsePayableExpenseQtyText(
      (item as EditablePayableExpenseItem).qtyText ?? item.qty,
    );
    if (!qty.ok) throw new Error(`第 ${i + 1} 行：${qty.message}`);
    item.qty = qty.value;
    setQtyText(item);
    if (!isFieldHidden(props.hiddenFields, 'item_itemName') && !item.itemName) {
      throw new Error(`第 ${i + 1} 行：项目名称不能为空`);
    }
    if (
      !isFieldHidden(props.hiddenFields, 'item_amount') &&
      !parsePayableExpenseAmountText(
        (item as EditablePayableExpenseItem).amountText ?? item.amount,
      ).ok
    ) {
      const amount = parsePayableExpenseAmountText(
        (item as EditablePayableExpenseItem).amountText ?? item.amount,
      );
      throw new Error(
        `第 ${i + 1} 行：${amount.ok ? '金额必须大于 0' : amount.message}`,
      );
    }
    const amount = parsePayableExpenseAmountText(
      (item as EditablePayableExpenseItem).amountText ?? item.amount,
    );
    if (amount.ok) {
      item.amount = normalizePayableExpenseAmount(amount.value);
      setAmountText(item);
    }
  }
}

function getItems() {
  return tableData.value.map((item) => {
    materializeValidNumberText(item);
    return toBusinessItem(item);
  });
}

function handlePageChange(pageNo: number, pageSize: number) {
  if (isRemotePagination.value) {
    emit('page-change', { pageNo, pageSize });
    return;
  }
  localPagination.value = { pageNo, pageSize };
  void refreshItemGrid();
}

function focusFirstAmountInput() {
  if (props.disabled) {
    return false;
  }
  const [firstRow] = getDisplayTableData();
  if (firstRow) {
    gridApi.grid?.setCurrentRow?.(firstRow);
  }
  return focusFirstEditableInput(
    itemTableWrapRef.value,
    PAYABLE_EXPENSE_AMOUNT_INPUT_SELECTOR,
  );
}

function focusRowAmountInput(clientRowKey: string) {
  const targetRow = tableData.value.find(
    (item) => item.clientRowKey === clientRowKey,
  );
  if (!targetRow) return false;
  gridApi.grid?.setCurrentRow?.(targetRow);
  const selector = `[data-payable-expense-row-key="${CSS.escape(clientRowKey)}"]`;
  return focusFirstEditableInput(itemTableWrapRef.value, selector);
}

function queueFocusRowAmountInput(clientRowKey: string) {
  void nextTick(() => {
    queueAfterEditableControlRender(() => {
      focusRowAmountInput(clientRowKey);
    });
  });
}

function handleItemTableResize() {
  void gridApi.grid.reloadColumn(buildCustomizedItemColumns());
}

onMounted(() => window.addEventListener('resize', handleItemTableResize));
onBeforeUnmount(() =>
  window.removeEventListener('resize', handleItemTableResize),
);

function handleItemInputPressEnter(event: KeyboardEvent) {
  const result = focusNextInputOnEnter(event);
  if (result === 'last-input') {
    emit('request-submit', event);
  }
}

defineExpose({
  addRow,
  focusFirstAmountInput,
  focusRowAmountInput,
  getItems,
  validate,
});
</script>

<template>
  <div
    ref="itemTableWrapRef"
    class="payable-expense-inline-item-form overflow-hidden rounded border"
  >
    <Grid class="w-full">
      <template #toolbar-tools>
        <span aria-hidden="true"></span>
      </template>
      <template #itemName="{ row }">
        <Select
          v-model:value="row.itemName"
          :disabled="disabled"
          :options="itemProjectOptions"
          allow-clear
          show-search
          :popup-class-name="
            candidatePopupClass('payable-expense-inline-item-select-dropdown')
          "
          placeholder="请选择项目名称"
          @change="handleRowChange(row)"
        />
      </template>
      <template #amount="{ row }">
        <Input
          :value="getAmountText(row)"
          :disabled="disabled"
          placeholder="请输入金额"
          data-payable-expense-amount-input="true"
          :data-payable-expense-row-key="row.clientRowKey"
          inputmode="decimal"
          @blur="handleAmountBlur(row)"
          @press-enter="handleItemInputPressEnter"
          @update:value="
            (value) => handleNumberTextInput(row, 'amountText', value)
          "
        />
      </template>
      <template #invoiceNo="{ row }">
        <Input
          v-model:value="row.invoiceNo"
          :disabled="disabled"
          placeholder="请输入发票号"
          @change="handleRowChange(row)"
          @press-enter="handleItemInputPressEnter"
        />
      </template>
      <template #party="{ row }">
        <Input
          v-model:value="row.party"
          :disabled="disabled"
          placeholder="请输入对象"
          @change="handleRowChange(row)"
          @press-enter="handleItemInputPressEnter"
        />
      </template>
      <template #deptId="{ row }">
        <span v-if="disabled" class="payable-expense-inline-item-text">
          {{ getItemDisplayText(row, 'deptId') }}
        </span>
        <Select
          v-else
          v-model:value="row.deptId"
          :options="deptOptions"
          allow-clear
          show-search
          :popup-class-name="
            candidatePopupClass('payable-expense-inline-item-select-dropdown')
          "
          placeholder="请选择部门"
          @change="handleRowChange(row)"
        />
      </template>
      <template #bizDate="{ row }">
        <DatePicker
          v-model:value="row.bizDate"
          :disabled="disabled"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          placeholder="请选择发生日期"
          popup-class-name="payable-expense-inline-item-date-picker-dropdown"
          @change="handleRowChange(row)"
        />
      </template>
      <template #handlerId="{ row }">
        <span v-if="disabled" class="payable-expense-inline-item-text">
          {{ getItemDisplayText(row, 'handlerId') }}
        </span>
        <Select
          v-else
          v-model:value="row.handlerId"
          :options="userOptions"
          allow-clear
          show-search
          :popup-class-name="
            candidatePopupClass('payable-expense-inline-item-select-dropdown')
          "
          placeholder="请选择申请人"
          @change="handleRowChange(row)"
        />
      </template>
      <template #qty="{ row }">
        <Input
          :value="getQtyText(row)"
          :disabled="disabled"
          placeholder="数量"
          inputmode="numeric"
          @blur="handleQtyBlur(row)"
          @press-enter="handleItemInputPressEnter"
          @update:value="
            (value) => handleNumberTextInput(row, 'qtyText', value)
          "
        />
      </template>
      <template #expenseCategory="{ row }">
        <Input
          v-model:value="row.expenseCategory"
          :disabled="disabled"
          placeholder="请输入费用分类"
          @change="handleRowChange(row)"
          @press-enter="handleItemInputPressEnter"
        />
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
      <template #fileUrl="{ row }">
        <FileUpload
          v-model:value="row.fileUrl"
          :accept="[
            'pdf',
            'doc',
            'docx',
            'xls',
            'xlsx',
            'txt',
            'jpg',
            'jpeg',
            'png',
          ]"
          :disabled="disabled"
          :max-number="1"
          :max-size="10"
          @change="handleRowChange(row)"
        />
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '删除',
              type: 'link',
              danger: true,
              popConfirm: {
                title: '确认删除该费用明细吗？',
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </Grid>
    <div class="payable-expense-inline-item-form__pager">
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
.payable-expense-inline-item-form {
  background: hsl(var(--background));
  border-color: hsl(var(--border));
}

:deep(.vxe-table) {
  height: 414px !important;
}

:deep(.vxe-table),
:deep(.ant-input),
:deep(.ant-input-number),
:deep(.ant-input-number-input),
:deep(.ant-picker),
:deep(.ant-picker-input > input),
:deep(.ant-select),
:deep(.ant-select-selection-item),
:deep(.ant-select-selection-placeholder),
:deep(.ant-upload),
:deep(.ant-upload-list-item),
.payable-expense-inline-item-text {
  font-size: 12px;
}

:deep(.ant-input-number),
:deep(.ant-picker),
:deep(.ant-select) {
  width: 100%;
}

:deep(.ant-input),
:deep(.ant-input-number),
:deep(.ant-input-number-input),
:deep(.ant-picker),
:deep(.ant-select-single),
:deep(.ant-select-single .ant-select-selector) {
  box-sizing: border-box;
  height: 28px !important;
  min-height: 28px !important;
}

:deep(.ant-select-single .ant-select-selector),
:deep(.ant-select-single .ant-select-selection-item),
:deep(.ant-select-single .ant-select-selection-placeholder),
:deep(.ant-picker-input > input) {
  line-height: 26px;
}

:deep(.ant-upload-wrapper) {
  display: block;
  min-width: 150px;
}

:deep(.ant-upload-wrapper .ant-btn) {
  height: 28px;
  padding: 0 8px;
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

:global(.payable-expense-inline-item-select-dropdown .ant-select-item),
:global(.payable-expense-inline-item-select-dropdown .ant-empty-description),
:global(.payable-expense-inline-item-date-picker-dropdown),
:global(.payable-expense-inline-item-date-picker-dropdown .ant-picker-cell),
:global(.payable-expense-inline-item-date-picker-dropdown .ant-picker-header),
:global(
  .payable-expense-inline-item-date-picker-dropdown .ant-picker-content th
) {
  font-size: 12px;
}

.payable-expense-inline-item-form__pager {
  display: flex;
  justify-content: flex-end;
  padding: 8px 0 2px;
  font-size: 12px;
}

.payable-expense-inline-item-form__pager :deep(.ant-pagination),
.payable-expense-inline-item-form__pager :deep(.ant-pagination-item),
.payable-expense-inline-item-form__pager :deep(.ant-pagination-options),
.payable-expense-inline-item-form__pager
  :deep(.ant-pagination-options-quick-jumper),
.payable-expense-inline-item-form__pager :deep(.ant-select),
.payable-expense-inline-item-form__pager :deep(.ant-select-selection-item),
.payable-expense-inline-item-form__pager
  :deep(.ant-select-selection-placeholder),
.payable-expense-inline-item-form__pager :deep(.ant-input) {
  font-size: 12px;
}

.payable-expense-inline-item-form__pager :deep(.ant-select-single),
.payable-expense-inline-item-form__pager :deep(.ant-select-selector) {
  box-sizing: border-box;
  height: 24px !important;
  min-height: 24px !important;
  line-height: 22px !important;
}

.payable-expense-inline-item-form__pager :deep(.ant-select-selection-item),
.payable-expense-inline-item-form__pager
  :deep(.ant-select-selection-placeholder) {
  line-height: 22px !important;
}

.payable-expense-inline-item-form__pager
  :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  font-size: 12px;
}
</style>
