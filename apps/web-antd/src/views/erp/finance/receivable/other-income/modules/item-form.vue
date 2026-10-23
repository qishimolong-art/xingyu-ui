<script lang="ts" setup>import { financeValue, financeAdd, financeCompare } from '#/views/erp/finance/utils/finance-decimal';

import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import { useFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { OtherIncomeItemSortOrder } from './other-income-item-sort';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpReceivableOtherIncomeApi } from '#/api/erp/finance/receivable/other-income';

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
import CustomerLazySelect from '#/views/erp/sale/components/CustomerLazySelect.vue';
import { mergeCustomerOption } from '#/views/erp/sale/utils/customer-select';
import {
  focusFirstEditableInput,
  focusNextInputOnEnter,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';

import { OTHER_INCOME_ITEM_PROJECT, useFormItemColumns } from '../data';
import { normalizeOtherIncomeItemBizDateForPicker } from '../ui';
import {
  formatOtherIncomeAmountInput,
  formatOtherIncomeQtyInput,
  normalizeOtherIncomeAmount,
  parseOtherIncomeAmountText,
  parseOtherIncomeQtyText,
} from './other-income-item-input';
import { sortOtherIncomeItems } from './other-income-item-sort';
const { candidatePopupClass } = useFinanceCandidateFocus();

type EditableOtherIncomeItem = ErpReceivableOtherIncomeApi.Item & {
  amountText?: string;
  qtyText?: string;
};

interface Props {
  items?: ErpReceivableOtherIncomeApi.Item[];
  disabled?: boolean;
  hiddenFields?: string[];
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
  hiddenFields: () => [],
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

const OTHER_INCOME_AMOUNT_INPUT_SELECTOR =
  '[data-other-income-amount-input="true"]';
const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];
const ITEM_TABLE_HEIGHT = 414;
const tableData = ref<ErpReceivableOtherIncomeApi.Item[]>([]);
const itemTableWrapRef = ref<HTMLElement | null>(null);
const localPagination = ref({ pageNo: 1, pageSize: 10 });
const projectOptions = ref<{ label: string; value: string }[]>([]);
const customerOptions = ref<
  Array<Record<string, any> & { label: string; value: number }>
>([]);
const deptOptions = ref<{ label: string; value: number }[]>([]);
const userOptions = ref<{ label: string; value: number }[]>([]);
const activeItemSort = ref<
  undefined | { field: string; order: OtherIncomeItemSortOrder }
>();
let syncingFromProps = false;
let editingNumberText = false;
const itemRowKeyManager = createFinanceItemClientRowKeyManager(
  'receivable-other-income-item',
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
    0,
  ),
}));

function buildItemColumns(
  disabled = props.disabled,
  hiddenFields = props.hiddenFields,
  rows: ErpReceivableOtherIncomeApi.Item[] = getDisplayTableData(),
) {
  return (
    useFormItemColumns(disabled, hiddenFields, {
      editable: !disabled,
      rows,
      trailingFlexibleColumnMinWidth: 150,
    }) || []
  ).map((column) => (column.field ? { ...column, sortable: true } : column));
}

function buildCustomizedItemColumns(
  rows: ErpReceivableOtherIncomeApi.Item[] = getDisplayTableData(),
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
      : sortOtherIncomeItems(
          tableData.value,
          activeSort.field,
          activeSort.order,
          {
            deptOptions: deptOptions.value,
            userOptions: userOptions.value,
            customerOptions: customerOptions.value,
          },
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
    id: 'erp-finance-receivable-other-income-item-list-v2',
    minHeight: 250,
    autoResize: true,
    border: true,
    fit: false,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 0 },
    rowConfig: {
      keyField: 'clientRowKey',
      isCurrent: true,
      isHover: true,
    },
    pagerConfig: {
      enabled: false,
    },
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
  } as VxeTableGridOptions<ErpReceivableOtherIncomeApi.Item>,
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
      const normalizedItem: EditableOtherIncomeItem = {
        qty: 1,
        ...item,
        bizDate:
          normalizeOtherIncomeItemBizDateForPicker(item.bizDate) ??
          item.bizDate,
      };
      setQtyText(normalizedItem);
      setAmountText(normalizedItem);
      return normalizedItem;
    });
    itemRowKeyManager.ensureRowKeys(normalizedItems);
    tableData.value = await hydrateOtherIncomeItemLabels(normalizedItems);
    syncItemCustomerOptions(tableData.value);
    await nextTick();
    await refreshItemGrid();
    syncingFromProps = false;
  },
  { immediate: true },
);

async function hydrateOtherIncomeItemLabels(
  items: ErpReceivableOtherIncomeApi.Item[],
) {
  const hydratedItems = await Promise.all(
    items.map((item) =>
      hydrateFinanceDocumentFormSelectLabels(item, {
        customerOptions: customerOptions.value,
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
    if (syncingFromProps || editingNumberText) {
      return;
    }
    emit('update:items', tableData.value.map(toBusinessItem));
    emit('update:total-amount', summaries.value.totalAmount);
  },
  { deep: true },
);

async function initOptions() {
  const [projectList, deptList, userList] = await Promise.all([
    getBaseDataSimpleList(OTHER_INCOME_ITEM_PROJECT),
    getSimpleDeptList(),
    getSimpleUserList(),
  ]);
  projectOptions.value = (projectList || []).map((item) => ({
    label: item.name,
    value: item.name,
  }));
  deptOptions.value = (deptList || []).map((item) => ({
    label: item.name,
    value: item.id!,
  }));
  userOptions.value = (userList || []).map((item) => ({
    label: item.nickname,
    value: item.id!,
  }));
  tableData.value.forEach((item) => syncItemDisplayNames(item));
  if (activeItemSort.value) {
    await refreshItemGrid();
  }
}

void initOptions();

function handleCustomerOptionsChange(options: any[]) {
  customerOptions.value = options || [];
}

function syncItemCustomerOptions(items: ErpReceivableOtherIncomeApi.Item[]) {
  let options = customerOptions.value;
  for (const item of items) {
    if (!item.customerId || !item.customerName) {
      continue;
    }
    options = mergeCustomerOption(options, {
      id: item.customerId,
      label: item.customerName,
      name: item.customerName,
      value: item.customerId,
    }) as any[];
  }
  customerOptions.value = options;
}

function addRow() {
  if (isRemotePagination.value) {
    emit('request-add');
    return;
  }
  const row = {
    itemName: '',
    amount: 0,
    qty: 1,
  } as EditableOtherIncomeItem;
  setQtyText(row);
  setAmountText(row);
  itemRowKeyManager.ensureRowKey(row);
  tableData.value.push(row);
  if (!isRemotePagination.value) {
    localPagination.value.pageNo = Math.max(
      1,
      Math.ceil(tableData.value.length / localPagination.value.pageSize),
    );
  }
  const rowKey = row.clientRowKey!;
  void (
    activeItemSort.value ? nextTick(refreshItemGrid) : refreshItemGrid()
  ).then(() => queueFocusRowAmountInput(rowKey));
}

function getItemsSignature(items: ErpReceivableOtherIncomeApi.Item[]) {
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

function handleDelete(row: ErpReceivableOtherIncomeApi.Item) {
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

function handleRowChange(row?: ErpReceivableOtherIncomeApi.Item) {
  if (row) {
    syncItemDisplayNames(row);
  }
  if (activeItemSort.value) {
    void nextTick(refreshItemGrid);
  }
}

function toBusinessItem(row: ErpReceivableOtherIncomeApi.Item) {
  const {
    amountText: _amountText,
    qtyText: _qtyText,
    ...businessItem
  } = row as EditableOtherIncomeItem;
  return businessItem;
}

function setQtyText(row: ErpReceivableOtherIncomeApi.Item) {
  (row as EditableOtherIncomeItem).qtyText = formatOtherIncomeQtyInput(row.qty);
}

function setAmountText(row: ErpReceivableOtherIncomeApi.Item) {
  (row as EditableOtherIncomeItem).amountText = formatOtherIncomeAmountInput(
    row.amount,
  );
}

function getQtyText(row: ErpReceivableOtherIncomeApi.Item) {
  return (row as EditableOtherIncomeItem).qtyText ?? '';
}

function getAmountText(row: ErpReceivableOtherIncomeApi.Item) {
  return (row as EditableOtherIncomeItem).amountText ?? '';
}

function handleNumberTextInput(
  row: ErpReceivableOtherIncomeApi.Item,
  field: 'amountText' | 'qtyText',
  value: unknown,
) {
  editingNumberText = true;
  (row as EditableOtherIncomeItem)[field] = String(value ?? '');
  void nextTick(() => {
    editingNumberText = false;
  });
}

function handleQtyBlur(row: ErpReceivableOtherIncomeApi.Item) {
  const parsed = parseOtherIncomeQtyText(getQtyText(row));
  if (!parsed.ok) {
    message.warning(parsed.message);
    setQtyText(row);
    return;
  }
  if (parsed.value <= 0) {
    message.warning('单据数量必须大于 0');
    setQtyText(row);
    return;
  }
  row.qty = parsed.value;
  setQtyText(row);
  handleRowChange(row);
}

function handleAmountBlur(row: ErpReceivableOtherIncomeApi.Item) {
  const parsed = parseOtherIncomeAmountText(getAmountText(row));
  if (!parsed.ok) {
    message.warning(parsed.message);
    setAmountText(row);
    return;
  }
  row.amount = normalizeOtherIncomeAmount(parsed.value);
  setAmountText(row);
  handleRowChange(row);
}

function materializeValidNumberText(row: ErpReceivableOtherIncomeApi.Item) {
  const qty = parseOtherIncomeQtyText(getQtyText(row));
  if (qty.ok) {
    row.qty = qty.value;
  }
  const amount = parseOtherIncomeAmountText(getAmountText(row));
  if (amount.ok) {
    row.amount = normalizeOtherIncomeAmount(amount.value);
  }
}

function syncItemDisplayNames(row: ErpReceivableOtherIncomeApi.Item) {
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
  row: ErpReceivableOtherIncomeApi.Item,
  fieldName: 'customerId' | 'deptId' | 'handlerId',
) {
  const text = getFinanceDocumentDisplayText(row, fieldName);
  return text || (fieldName === 'customerId' ? row.party : '') || '-';
}

function handleCustomerChange(
  row: ErpReceivableOtherIncomeApi.Item,
  customerId?: number,
) {
  const customer = customerOptions.value.find(
    (option) => option.value === customerId,
  );
  row.customerName = customer?.label;
  syncItemDisplayNames(row);
  handleRowChange();
}

function validate() {
  if (tableData.value.length === 0) {
    throw new Error('请添加收入明细');
  }
  for (let i = 0; i < tableData.value.length; i++) {
    const item = tableData.value[i];
    if (!item) {
      continue;
    }
    const qty = parseOtherIncomeQtyText(
      (item as EditableOtherIncomeItem).qtyText ?? item.qty,
    );
    if (!qty.ok) {
      throw new Error(`第 ${i + 1} 行：${qty.message}`);
    }
    item.qty = qty.value;
    setQtyText(item);
    if (item.qty <= 0) {
      throw new Error(`第 ${i + 1} 行：单据数量必须大于 0`);
    }
    if (!isFieldHidden(props.hiddenFields, 'item_itemName') && !item.itemName) {
      throw new Error(`第 ${i + 1} 行：项目名称不能为空`);
    }
    if (!isFieldHidden(props.hiddenFields, 'item_amount')) {
      const amount = parseOtherIncomeAmountText(
        (item as EditableOtherIncomeItem).amountText ?? item.amount,
      );
      if (!amount.ok) {
        throw new Error(`第 ${i + 1} 行：${amount.message}`);
      }
      item.amount = normalizeOtherIncomeAmount(amount.value);
      setAmountText(item);
      if ((financeCompare(item.amount, 0) <= 0)) {
        throw new Error(`第 ${i + 1} 行：金额必须大于 0`);
      }
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
    OTHER_INCOME_AMOUNT_INPUT_SELECTOR,
  );
}

function focusRowAmountInput(clientRowKey: string) {
  const targetRow = tableData.value.find(
    (item) => item.clientRowKey === clientRowKey,
  );
  if (!targetRow) return false;
  gridApi.grid?.setCurrentRow?.(targetRow);
  const selector = `[data-other-income-row-key="${CSS.escape(clientRowKey)}"]`;
  return focusFirstEditableInput(itemTableWrapRef.value, selector);
}

function queueFocusFirstAmountInput() {
  void nextTick(() => {
    queueAfterEditableControlRender(() => {
      focusFirstAmountInput();
    });
  });
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
    class="other-income-item-form overflow-hidden rounded border"
  >
    <Grid class="w-full">
      <template #toolbar-tools>
        <span aria-hidden="true"></span>
      </template>
      <template #itemName="{ row }">
        <Select
          v-model:value="row.itemName"
          :disabled="disabled"
          :options="projectOptions"
          allow-clear
          show-search
          option-filter-prop="label"
          :popup-class-name="
            candidatePopupClass('other-income-item-select-dropdown')
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
          data-other-income-amount-input="true"
          :data-other-income-row-key="row.clientRowKey"
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
      <template #customerId="{ row }">
        <span v-if="disabled" class="other-income-item-text">
          {{ getItemDisplayText(row, 'customerId') }}
        </span>
        <CustomerLazySelect
          v-else
          v-model:value="row.customerId"
          :options="customerOptions"
          allow-clear
          :popup-class-name="
            candidatePopupClass('other-income-item-select-dropdown')
          "
          :placeholder="row.party || '请选择客户'"
          @options-change="handleCustomerOptionsChange"
          @change="
            (value) =>
              handleCustomerChange(
                row,
                value === undefined || value === null
                  ? undefined
                  : Number(value),
              )
          "
        />
      </template>
      <template #deptId="{ row }">
        <span v-if="disabled" class="other-income-item-text">
          {{ getItemDisplayText(row, 'deptId') }}
        </span>
        <Select
          v-else
          v-model:value="row.deptId"
          :options="deptOptions"
          allow-clear
          show-search
          :popup-class-name="
            candidatePopupClass('other-income-item-select-dropdown')
          "
          placeholder="请选择部门"
          @change="handleRowChange(row)"
        />
      </template>
      <template #bizDate="{ row }">
        <DatePicker
          v-model:value="row.bizDate"
          :disabled="disabled"
          show-time
          format="YYYY-MM-DD HH:mm:ss"
          popup-class-name="other-income-item-date-picker-dropdown"
          value-format="YYYY-MM-DD HH:mm:ss"
          placeholder="请选择发生日期"
          @change="handleRowChange(row)"
        />
      </template>
      <template #handlerId="{ row }">
        <span v-if="disabled" class="other-income-item-text">
          {{ getItemDisplayText(row, 'handlerId') }}
        </span>
        <Select
          v-else
          v-model:value="row.handlerId"
          :options="userOptions"
          allow-clear
          show-search
          :popup-class-name="
            candidatePopupClass('other-income-item-select-dropdown')
          "
          placeholder="请选择经手人"
          @change="handleRowChange(row)"
        />
      </template>
      <template #qty="{ row }">
        <Input
          :value="getQtyText(row)"
          :disabled="disabled"
          placeholder="单据数量"
          inputmode="numeric"
          @blur="handleQtyBlur(row)"
          @press-enter="handleItemInputPressEnter"
          @update:value="
            (value) => handleNumberTextInput(row, 'qtyText', value)
          "
        />
      </template>
      <template #freightType="{ row }">
        <Input
          v-model:value="row.freightType"
          :disabled="disabled"
          placeholder="请输入运费类型"
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
                title: '确认删除该收入明细吗？',
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>

      <template #bottom>
        <div class="other-income-item-form__summary">
          <span>明细项数：{{ currentTotal }}</span>
          <span>
            金额：<b>¥{{ erpPriceInputFormatter(summaries.totalAmount) }}</b>
          </span>
        </div>
      </template>
    </Grid>
    <div class="other-income-item-form__pager">
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
.other-income-item-form {
  border-color: hsl(var(--border));
  background: hsl(var(--background));
}

:deep(.vxe-table) {
  height: 414px !important;
}

:deep(.vxe-table),
:deep(.ant-input),
:deep(.ant-picker),
:deep(.ant-picker-input > input),
:deep(.ant-select),
:deep(.ant-select-single .ant-select-selector),
:deep(.ant-select-selection-item),
:deep(.ant-select-selection-placeholder),
:deep(.ant-upload),
:deep(.ant-upload-list-item) {
  font-size: 12px;
}

:deep(.ant-picker),
:deep(.ant-select) {
  width: 100%;
}

:deep(.ant-input),
:deep(.ant-picker),
:deep(.ant-select-single),
:deep(.ant-select-single .ant-select-selector) {
  box-sizing: border-box;
  height: 28px !important;
  min-height: 28px !important;
}

:deep(.ant-select-single .ant-select-selector),
:deep(.ant-select-single .ant-select-selection-item),
:deep(.ant-select-single .ant-select-selection-placeholder) {
  line-height: 26px;
}

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

.other-income-item-form__summary {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: flex-end;
  gap: 20px;
  padding: 6px 10px;
  border-top: 1px solid hsl(var(--border));
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.other-income-item-form__summary b {
  color: hsl(var(--primary));
  font-size: 14px;
}

:global(.other-income-item-select-dropdown .ant-select-item),
:global(.other-income-item-select-dropdown .ant-empty-description),
:global(.other-income-item-date-picker-dropdown) {
  font-size: 12px;
}

.other-income-item-form__pager {
  display: flex;
  justify-content: flex-end;
  padding: 8px 0 2px;
  font-size: 11px;
}

.other-income-item-form__pager :deep(.ant-pagination),
.other-income-item-form__pager :deep(.ant-pagination-item),
.other-income-item-form__pager :deep(.ant-pagination-options),
.other-income-item-form__pager :deep(.ant-pagination-options-quick-jumper),
.other-income-item-form__pager :deep(.ant-select),
.other-income-item-form__pager :deep(.ant-select-selection-item),
.other-income-item-form__pager :deep(.ant-select-selection-placeholder),
.other-income-item-form__pager :deep(.ant-input) {
  font-size: 11px;
}

.other-income-item-form__pager :deep(.ant-select-single),
.other-income-item-form__pager :deep(.ant-select-selector) {
  box-sizing: border-box;
  height: 24px !important;
  min-height: 24px !important;
  line-height: 22px !important;
}

.other-income-item-form__pager :deep(.ant-select-selection-item),
.other-income-item-form__pager :deep(.ant-select-selection-placeholder) {
  line-height: 22px !important;
}

.other-income-item-form__pager
  :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  font-size: 11px;
}
</style>
