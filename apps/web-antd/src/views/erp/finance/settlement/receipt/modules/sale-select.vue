<script lang="ts" setup>import { financeValue, financeSubtract, financeCompare } from '#/views/erp/finance/utils/finance-decimal';

import DecimalAmountInput from '#/views/erp/components/DecimalAmountInput.vue';
import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import { useFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpFinanceReceiptApi } from '#/api/erp/finance/receipt';

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';



import { Button, Input, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getFinanceReceiptFormCandidatePage } from '#/api/erp/finance/receipt';
import {
  acceptFinanceDecimalInput,
  normalizeFinanceDecimalInput,
} from '#/views/erp/finance/utils/text-number';
import {
  focusFirstEditableInput,
  focusNextInputOnEnter,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';

import {
  normalizeFinanceAmount,
  subtractFinanceAmounts,
  sumFinanceAmounts,
} from '../../money';
import { formatFinanceReceiptAmount } from '../ui';
const { candidatePagerConfig } = useFinanceCandidateFocus();

interface Props {
  customerId?: number;
  deptId?: number;
  disabled?: boolean;
  currentItems?: ErpFinanceReceiptApi.FinanceReceiptItem[];
  documentTotalPrice?: number | string;
  receiptContext?: Partial<ErpFinanceReceiptApi.FinanceReceiptItem>;
  autoWriteOffPreviewDisabled?: boolean;
}

type SaleBillRow = ErpFinanceReceiptApi.FinanceReceiptItem & {
  autoWriteOffPreviewAmount?: number | string | null;
  createTime?: Date | number | string;
  id: number;
  clientRowKey: string;
  available: boolean;
  selected: boolean;
  status?: number;
  unReceiptedPrice: number | string | null;
};

const props = withDefaults(defineProps<Props>(), {
  customerId: undefined,
  deptId: undefined,
  disabled: false,
  currentItems: () => [],
  documentTotalPrice: undefined,
  receiptContext: () => ({}),
  autoWriteOffPreviewDisabled: false,
});

const emit = defineEmits<{
  change: [items: ErpFinanceReceiptApi.FinanceReceiptItem[]];
  detail: [item: ErpFinanceReceiptApi.FinanceReceiptItem];
  'request-submit': [event?: KeyboardEvent];
}>();

const RECEIPT_PRICE_INPUT_SELECTOR =
  '[data-finance-receipt-price-input="true"]';
const tableRows = ref<SaleBillRow[]>([]);
const selectWrapRef = ref<HTMLElement | null>(null);
const selectedRowMap = new Map<string, SaleBillRow>();
const candidateTotal = ref(0);
const globalAutoWriteOffCount = ref(0);
const globalAutoWriteOffAmount = ref(0);
let loadRequestId = 0;
let previewRefreshTimer: ReturnType<typeof setTimeout> | undefined;

function getCandidateKey(bizType: number, bizId: number) {
  return `finance-receipt:source:${bizType}:${bizId}`;
}

function getCurrentItem(bizType: number, bizId: number) {
  const cached = selectedRowMap.get(getCandidateKey(bizType, bizId));
  if (cached) return cached;
  return props.currentItems.find(
    (item) => item.bizType === bizType && item.bizId === bizId,
  );
}

function createRow(
  row: ErpFinanceReceiptApi.FinanceReceiptFormCandidate,
): SaleBillRow {
  const id = row.bizId;
  const current = getCurrentItem(row.bizType, id);
  const {
    customerName: _contextCustomerName,
    deptName: _contextDeptName,
    ...receiptDocumentContext
  } = props.receiptContext;
  const normalizedTotalPrice = normalizeFinanceAmount(
    financeValue(row.totalPrice || 0),
  );
  const normalizedReceiptedPrice = normalizeFinanceAmount(
    financeValue(row.allocatedPrice || 0),
  );
  const outstandingPrice = normalizeFinanceAmount(
    financeValue(row.unallocatedPrice ?? financeSubtract(normalizedTotalPrice, normalizedReceiptedPrice)),
  );
  return {
    id,
    clientRowKey: getCandidateKey(row.bizType, id),
    available: row.available !== false,
    selected: !!current,
    bizId: id,
    bizType: row.bizType,
    bizNo: row.bizNo || '',
    bizTime: row.bizTime,
    createTime: row.createTime,
    totalPrice: normalizedTotalPrice,
    receiptedPrice: normalizedReceiptedPrice,
    receiptPrice: normalizeFinanceAmount(
      current?.receiptPrice ?? outstandingPrice,
    ),
    unReceiptedPrice: subtractFinanceAmounts(
      outstandingPrice,
      normalizeFinanceAmount(current?.receiptPrice ?? 0),
    ),
    remark: current?.remark || '',
    customerName:
      row.customerName || current?.customerName || _contextCustomerName,
    deptName: row.deptName || current?.deptName || _contextDeptName,
    ...receiptDocumentContext,
  };
}

function getOutstandingPrice(row: SaleBillRow) {
  return subtractFinanceAmounts(row.totalPrice, row.receiptedPrice);
}

const autoWriteOffPreviewMap = computed(() => {
  const result = new Map<string, number>();
  if (props.autoWriteOffPreviewDisabled) return result;
  tableRows.value.forEach((row) => {
    const amount = normalizeFinanceAmount(row.autoWriteOffPreviewAmount || 0);
    if ((financeCompare(amount, 0) !== 0)) result.set(row.clientRowKey, amount);
  });
  return result;
});

function getAutoWriteOffPreviewAmount(row: SaleBillRow) {
  return autoWriteOffPreviewMap.value.get(row.clientRowKey) || 0;
}

function getAutoWriteOffPreviewTitle(row: SaleBillRow) {
  const amount = getAutoWriteOffPreviewAmount(row);
  return (financeCompare(amount, 0) === 0)
    ? undefined
    : `审核通过后预计由系统自动核销 ￥${formatFinanceReceiptAmount(amount)}`;
}

function getSaleBillRowClass(row: SaleBillRow) {
  return getAutoWriteOffPreviewAmount(row) === 0
    ? ''
    : 'receipt-sale-select__auto-writeoff-row';
}

function syncSelectedRowsFromProps() {
  selectedRowMap.clear();
  props.currentItems.forEach((item) => {
    if (!item.bizType || !item.bizId) return;
    const totalPrice = normalizeFinanceAmount(financeValue(item.totalPrice || 0));
    const receiptedPrice = normalizeFinanceAmount(
      financeValue(item.receiptedPrice || 0),
    );
    const receiptPrice = normalizeFinanceAmount(financeValue(item.receiptPrice || 0));
    const row = {
      ...item,
      id: item.bizId,
      clientRowKey: getCandidateKey(item.bizType, item.bizId),
      selected: true,
      available: (item as { available?: boolean }).available !== false,
      totalPrice,
      receiptedPrice,
      receiptPrice,
      unReceiptedPrice: subtractFinanceAmounts(
        subtractFinanceAmounts(totalPrice, receiptedPrice),
        receiptPrice,
      ),
    } as SaleBillRow;
    selectedRowMap.set(row.clientRowKey, row);
  });
}

function getCandidateSelections() {
  return [...selectedRowMap.values()].map((row) => ({
    bizType: row.bizType,
    bizId: row.bizId,
    amount: normalizeFinanceAmount(row.receiptPrice),
  }));
}

async function loadRows(
  formValues: Record<string, any>,
  page: { currentPage: number; pageSize: number },
  sort?: { field?: string; order?: string },
) {
  const requestId = (loadRequestId += 1);
  const customerId = props.customerId;
  const deptId = props.deptId;
  if (!customerId) return { list: [], total: 0 };
  const response = await getFinanceReceiptFormCandidatePage({
    customerId,
    deptId,
    documentTotalPrice: financeValue(props.documentTotalPrice || 0),
    no: formValues.no,
    orderField: sort?.field,
    orderDirection: sort?.order,
    pageNo: page.currentPage,
    pageSize: page.pageSize,
    selectedItems: getCandidateSelections(),
  });
  const unavailableKeys = new Set(
    (response.unavailableSelectedItems || []).map((item) =>
      getCandidateKey(item.bizType, item.bizId),
    ),
  );
  selectedRowMap.forEach((row, key) => {
    row.available = !unavailableKeys.has(key);
  });
  const rows = response.list.map((row) => createRow(row));
  if (
    requestId !== loadRequestId ||
    customerId !== props.customerId ||
    deptId !== props.deptId
  ) {
    return { list: tableRows.value, total: candidateTotal.value };
  }
  rows.forEach((row) => {
    const selected = selectedRowMap.get(row.clientRowKey);
    if (!selected) return;
    Object.assign(row, selected, {
      available: row.available && selected.available,
      autoWriteOffPreviewAmount: row.autoWriteOffPreviewAmount,
      clientRowKey: row.clientRowKey,
      selected: true,
    });
    selectedRowMap.set(row.clientRowKey, row);
  });
  tableRows.value = rows;
  candidateTotal.value = financeValue(response.total || 0);
  globalAutoWriteOffCount.value = Number(response.autoWriteOffCount || 0);
  globalAutoWriteOffAmount.value = normalizeFinanceAmount(
    response.autoWriteOffAmount || 0,
  );
  return { list: rows, total: candidateTotal.value };
}

function getSelectedRows() {
  return [...selectedRowMap.values()];
}

const selectionSummary = computed(() => {
  const selectedRows = getSelectedRows();
  return {
    availableCount: candidateTotal.value,
    selectedCount: selectedRows.length,
    outstandingPrice: formatFinanceReceiptAmount(
      sumFinanceAmounts(selectedRows.map((row) => getOutstandingPrice(row))),
    ),
    receiptPrice: formatFinanceReceiptAmount(
      sumFinanceAmounts(selectedRows.map((row) => row.receiptPrice)),
    ),
    autoWriteOffCount: globalAutoWriteOffCount.value,
    autoWriteOffAmount: formatFinanceReceiptAmount(
      globalAutoWriteOffAmount.value,
    ),
  };
});

const unavailableSelectedCount = computed(
  () => getSelectedRows().filter((row) => row.available === false).length,
);

function removeUnavailableSelectedItems() {
  selectedRowMap.forEach((row, key) => {
    if (row.available === false) selectedRowMap.delete(key);
  });
  tableRows.value.forEach((row) => {
    if (row.available === false) row.selected = false;
  });
  emitSelectedItems();
  queuePreviewRefresh();
}

function emitSelectedItems() {
  emit(
    'change',
    getSelectedRows().map(
      ({
        id: _id,
        clientRowKey: _clientRowKey,
        available: _available,
        autoWriteOffPreviewAmount: _autoWriteOffPreviewAmount,
        selected: _selected,
        createTime: _createTime,
        status: _status,
        unReceiptedPrice: _unReceiptedPrice,
        ...item
      }) => item,
    ),
  );
}

function focusFirstReceiptPriceInput() {
  if (props.disabled) {
    return false;
  }
  const firstSelectedRow = tableRows.value.find((row) => row.selected);
  if (firstSelectedRow) {
    billGridApi.grid?.setCurrentRow?.(firstSelectedRow);
  }
  return focusFirstEditableInput(
    selectWrapRef.value,
    RECEIPT_PRICE_INPUT_SELECTOR,
  );
}

function queueFocusReceiptPriceInput(row: SaleBillRow) {
  void nextTick(() => {
    queueAfterEditableControlRender(() => {
      billGridApi.grid?.setCurrentRow?.(row);
      const input = selectWrapRef.value?.querySelector<HTMLInputElement>(
        `[data-finance-receipt-row-key="${row.clientRowKey}"]`,
      );
      input?.focus();
      input?.select();
    });
  });
}

function queuePreviewRefresh() {
  if (previewRefreshTimer) clearTimeout(previewRefreshTimer);
  previewRefreshTimer = setTimeout(() => {
    previewRefreshTimer = undefined;
    void billGridApi.grid?.commitProxy?.('query');
  }, 120);
}

function handleItemInputPressEnter(event: KeyboardEvent) {
  const result = focusNextInputOnEnter(event);
  if (result === 'last-input') {
    emit('request-submit', event);
  }
}

function handleCheckboxChange(changedRow?: SaleBillRow) {
  tableRows.value.forEach((row) => {
    if (row.selected && !row.receiptPrice) {
      row.receiptPrice = getOutstandingPrice(row);
    }
    row.receiptPrice = normalizeFinanceAmount(row.receiptPrice);
    row.unReceiptedPrice = subtractFinanceAmounts(
      getOutstandingPrice(row),
      row.selected ? row.receiptPrice : 0,
    );
    if (row.selected) {
      selectedRowMap.set(row.clientRowKey, row);
    } else {
      selectedRowMap.delete(row.clientRowKey);
    }
  });
  emitSelectedItems();
  queuePreviewRefresh();
  if (changedRow?.selected) {
    queueFocusReceiptPriceInput(changedRow);
  }
}

function handleReceiptPriceInput(row: SaleBillRow, value: string) {
  const accepted = acceptFinanceDecimalInput(value);
  if (accepted === undefined) return;
  (row as any).receiptPrice = accepted;
}

function handleReceiptPriceBlur(row: SaleBillRow) {
  const normalized = normalizeFinanceDecimalInput(row.receiptPrice);
  const outstanding = getOutstandingPrice(row);
  if (
    normalized !== undefined &&
    (Math.sign(normalized) !== Math.sign(outstanding) ||
      Math.abs(normalized) > Math.abs(outstanding))
  ) {
    row.receiptPrice = outstanding;
    message.warning('本次收款必须与来源方向一致，且不能超过剩余可核销金额');
  } else {
    (row as any).receiptPrice = normalized;
  }
  handleRowChange(row);
}

function handleRowChange(row: SaleBillRow) {
  if (!row.selected) return;
  row.receiptPrice = normalizeFinanceAmount(row.receiptPrice);
  row.unReceiptedPrice = subtractFinanceAmounts(
    getOutstandingPrice(row),
    row.receiptPrice,
  );
  selectedRowMap.set(row.clientRowKey, row);
  emitSelectedItems();
  queuePreviewRefresh();
}

function handleBizDetail(row: SaleBillRow) {
  if (!row.bizId) return;
  emit('detail', row);
}

const [BillGrid, billGridApi] = useVbenVxeGrid({
  formOptions: {
    schema: [
      {
        fieldName: 'no',
        label: '单据编号',
        component: 'Input',
        componentProps: { placeholder: '请输入业务单据编号', allowClear: true },
      },
    ],
  },
  gridOptions: {
    pagerConfig: candidatePagerConfig(),
    columns: [
      { type: 'checkbox', width: 50, fixed: 'left' },
      {
        field: 'bizNo',
        title: '关联销售单或应收单',
        width: 190,
        fixed: 'left',
        slots: { default: 'bizNo' },
      },
      { field: 'customerName', title: '收款客户', minWidth: 130 },
      { field: 'deptName', title: '所属部门', minWidth: 120 },
      {
        field: 'receiptPrice',
        title: '收款/核销金额',
        minWidth: 140,
        align: 'right',
        headerAlign: 'right',
        slots: { default: 'receiptPrice' },
      },
      {
        field: 'receiptTime',
        title: '收款日期',
        minWidth: 160,
        formatter: 'formatDateTime',
      },
      {
        field: 'totalPrice',
        title: '应收金额',
        minWidth: 110,
        align: 'right',
        headerAlign: 'right',
        formatter: 'formatAmount2',
      },
      {
        field: 'receiptedPrice',
        title: '已核销金额',
        minWidth: 110,
        align: 'right',
        headerAlign: 'right',
        formatter: 'formatAmount2',
      },
      {
        field: 'unReceiptedPrice',
        title: '未核销金额',
        minWidth: 110,
        align: 'right',
        headerAlign: 'right',
        formatter: ({ row }) =>
          erpPriceInputFormatter(financeValue(row.unReceiptedPrice || 0)),
      },
      {
        field: 'remark',
        title: '备注',
        minWidth: 160,
        slots: { default: 'remark' },
      },
      { field: 'receiptMethod', title: '收款方式', minWidth: 110 },
      { field: 'accountName', title: '收款账户', minWidth: 130 },
      { field: 'financeUserName', title: '经办人', minWidth: 110 },
    ],
    height: 440,
    keepSource: true,
    rowClassName: ({ row }) => getSaleBillRowClass(row),
    proxyConfig: {
      ajax: {
        query: async ({ page, sort }, formValues) => {
          const result = await loadRows(formValues, page, sort);
          await nextTick();
          return result;
        },
      },
      sort: true,
    },
    rowConfig: { keyField: 'clientRowKey', isCurrent: true, isHover: true },
    checkboxConfig: {
      checkField: 'selected',
      highlight: true,
      checkMethod: ({ row }) =>
        !props.disabled && getOutstandingPrice(row) !== 0,
    },
    toolbarConfig: { custom: true, refresh: true, search: true, zoom: true },
  } as VxeTableGridOptions<SaleBillRow>,
  gridEvents: {
    checkboxChange: ({ row }: { row: SaleBillRow }) =>
      handleCheckboxChange(row),
    checkboxAll: () => handleCheckboxChange(),
  },
});

async function reloadData() {
  loadRequestId += 1;
  tableRows.value = [];
  candidateTotal.value = 0;
  globalAutoWriteOffCount.value = 0;
  globalAutoWriteOffAmount.value = 0;
  syncSelectedRowsFromProps();
  await nextTick();
  await billGridApi.grid.reloadData?.([]);
  if (!props.customerId) {
    return;
  }
  await billGridApi.query();
  emitSelectedItems();
}

watch(() => [props.customerId, props.deptId], reloadData, { immediate: true });
watch(
  () => props.receiptContext,
  (context) => {
    const {
      customerName: _contextCustomerName,
      deptName: _contextDeptName,
      ...receiptDocumentContext
    } = context;
    tableRows.value.forEach((row) =>
      Object.assign(row, receiptDocumentContext),
    );
    selectedRowMap.forEach((row) => Object.assign(row, receiptDocumentContext));
  },
  { deep: true },
);

onBeforeUnmount(() => {
  if (previewRefreshTimer) clearTimeout(previewRefreshTimer);
});

function validateSelectedItemsAvailable() {
  const unavailable = getSelectedRows().filter(
    (row) => row.available === false,
  );
  if (unavailable.length === 0) return true;
  message.error(
    '存在已失效或核销金额已变化的来源单据，请刷新或取消勾选后再提交',
  );
  return false;
}

defineExpose({ focusFirstReceiptPriceInput, validateSelectedItemsAvailable });
</script>

<template>
  <div ref="selectWrapRef" class="receipt-sale-select">
    <div v-if="!customerId" class="receipt-sale-select__empty">
      <span class="receipt-sale-select__empty-index">01</span>
      <div>
        <strong>请先选择客户</strong>
        <p>系统将自动查询该客户已审核且尚未完成收款的业务单据。</p>
      </div>
    </div>
    <BillGrid class="receipt-sale-select__grid" table-title="待收款业务单据">
      <template #bizNo="{ row }">
        <span class="receipt-sale-select__biz-no-cell">
          <a
            v-if="row.bizNo && row.bizId"
            class="cursor-pointer text-primary"
            @click.stop="handleBizDetail(row)"
          >
            {{ row.bizNo }}
          </a>
          <span v-else>{{ row.bizNo || '-' }}</span>
          <span
            v-if="getAutoWriteOffPreviewAmount(row) !== 0"
            class="receipt-sale-select__auto-tag"
            :title="getAutoWriteOffPreviewTitle(row)"
          >
            预计自动
          </span>
          <span v-if="row.available === false" class="text-error">已失效</span>
        </span>
      </template>
      <template #receiptPrice="{ row }">
        <DecimalAmountInput
          :value="
            row.receiptPrice === undefined ? '' : String(row.receiptPrice)
          "
          class="w-full"
          :disabled="disabled || !row.selected || row.available === false"
          inputmode="decimal"
          placeholder="勾选后填写"
          data-finance-receipt-price-input="true"
          :data-finance-receipt-row-key="row.clientRowKey"
          @blur="handleReceiptPriceBlur(row)"
          @press-enter="handleItemInputPressEnter"
          @update:value="handleReceiptPriceInput(row, $event)"
        />
      </template>
      <template #remark="{ row }">
        <Input
          v-model:value="row.remark"
          :disabled="disabled || !row.selected"
          placeholder="勾选后填写备注"
          @change="handleRowChange(row)"
          @press-enter="handleItemInputPressEnter"
        />
      </template>
      <template #bottom>
        <div class="receipt-sale-select__summary">
          <span>
            可核销 <b>{{ selectionSummary.availableCount }}</b> 单
          </span>
          <span>
            已勾选 <b>{{ selectionSummary.selectedCount }}</b> 单
          </span>
          <span>
            选中未核销
            <b>¥{{ selectionSummary.outstandingPrice }}</b>
          </span>
          <span class="receipt-sale-select__summary-actual">
            本次核销 <b>¥{{ selectionSummary.receiptPrice }}</b>
          </span>
          <span
            v-if="selectionSummary.autoWriteOffCount > 0"
            class="receipt-sale-select__summary-auto"
          >
            预计自动核销
            <b>{{ selectionSummary.autoWriteOffCount }}</b>
            单 / ¥{{ selectionSummary.autoWriteOffAmount }}
          </span>
          <Button
            v-if="unavailableSelectedCount > 0"
            danger
            size="small"
            type="link"
            @click="removeUnavailableSelectedItems"
          >
            取消失效来源（{{ unavailableSelectedCount }}）
          </Button>
          <span
            v-if="!autoWriteOffPreviewDisabled"
            class="receipt-sale-select__legend"
          >
            <i aria-hidden="true"></i>
            浅橙色行表示审核后预计自动核销
          </span>
        </div>
      </template>
    </BillGrid>
  </div>
</template>

<style scoped>
.receipt-sale-select__empty {
  display: flex;
  gap: 12px;
  align-items: center;
  min-height: 74px;
  padding: 14px 18px;
  margin-bottom: 10px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 36%);
  border: 1px dashed hsl(var(--border));
  border-radius: 7px;
}

.receipt-sale-select__empty-index {
  display: grid;
  flex: 0 0 34px;
  place-items: center;
  width: 34px;
  height: 34px;
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 9%);
  border-radius: 50%;
}

.receipt-sale-select__empty strong {
  font-size: 13px;
  color: hsl(var(--foreground));
}

.receipt-sale-select__empty p {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 18px;
}

:deep(.receipt-sale-select__grid .vxe-table--render-default) {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

:deep(.receipt-sale-select__grid .vxe-header--column) {
  height: 34px;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.01em;
}

:deep(.receipt-sale-select__grid .vxe-body--column) {
  height: 36px;
  font-size: 11px;
  line-height: 18px;
}

:deep(.receipt-sale-select__grid .ant-input),
:deep(.receipt-sale-select__grid .ant-input-number-input) {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

:deep(.receipt-sale-select__grid .row--checked) {
  background: hsl(var(--primary) / 7%);
}

:deep(.receipt-sale-select__auto-writeoff-row .vxe-body--column) {
  background-color: hsl(31 92% 45% / 9%) !important;
}

:deep(.receipt-sale-select__auto-writeoff-row.row--hover .vxe-body--column) {
  background-color: hsl(31 92% 45% / 15%) !important;
}

.receipt-sale-select__biz-no-cell {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 6px;
}

.receipt-sale-select__auto-tag {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  height: 18px;
  padding: 0 5px;
  color: hsl(31 92% 38%);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  background: hsl(31 92% 45% / 12%);
  border: 1px solid hsl(31 92% 45% / 30%);
  border-radius: 4px;
}

.receipt-sale-select__summary {
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

.receipt-sale-select__summary b {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}

.receipt-sale-select__summary-actual {
  padding: 4px 9px;
  font-weight: 600;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 9%);
  border-radius: 5px;
}

.receipt-sale-select__summary-actual b {
  font-size: 13px;
  color: hsl(var(--primary));
}

.receipt-sale-select__summary-auto {
  padding: 4px 9px;
  color: hsl(31 92% 38%);
  font-weight: 600;
  background: hsl(31 92% 45% / 10%);
  border-radius: 5px;
}

.receipt-sale-select__summary-auto b {
  color: hsl(31 92% 38%);
}

.receipt-sale-select__legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.receipt-sale-select__legend i {
  width: 14px;
  height: 10px;
  background: hsl(31 92% 45% / 12%);
  border: 1px solid hsl(31 92% 45% / 30%);
  border-radius: 2px;
}
</style>
