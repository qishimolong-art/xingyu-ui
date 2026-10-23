<script lang="ts" setup>
import {
  financeSign,
  financeAbs,
  financeCompare,
} from '#/views/erp/finance/utils/finance-decimal';
import {
  financeValue,
  financeSubtract,
  financeCompare,
} from '#/views/erp/finance/utils/finance-decimal';

import DecimalAmountInput from '#/views/erp/components/DecimalAmountInput.vue';
import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import { useFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpFinancePaymentApi } from '#/api/erp/finance/payment';

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { Button, Input, message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getFinancePaymentFormCandidatePage } from '#/api/erp/finance/payment';
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
const { candidatePagerConfig } = useFinanceCandidateFocus();

interface Props {
  supplierId?: number;
  deptId?: number;
  disabled?: boolean;
  currentItems?: ErpFinancePaymentApi.FinancePaymentItem[];
  documentTotalPrice?: number | string;
  paymentContext?: Partial<ErpFinancePaymentApi.FinancePaymentItem>;
  autoWriteOffPreviewDisabled?: boolean;
}

type PurchaseBillRow = ErpFinancePaymentApi.FinancePaymentItem & {
  autoWriteOffPreviewAmount?: number | string | null;
  createTime?: Date | number | string;
  id: number;
  clientRowKey: string;
  available: boolean;
  selected: boolean;
  status?: number;
  unPaymentPrice: number | string | null;
};

const props = withDefaults(defineProps<Props>(), {
  supplierId: undefined,
  deptId: undefined,
  disabled: false,
  currentItems: () => [],
  documentTotalPrice: undefined,
  paymentContext: () => ({}),
  autoWriteOffPreviewDisabled: false,
});

const emit = defineEmits<{
  change: [items: ErpFinancePaymentApi.FinancePaymentItem[]];
  detail: [item: ErpFinancePaymentApi.FinancePaymentItem];
  'request-submit': [event?: KeyboardEvent];
}>();

const PAYMENT_PRICE_INPUT_SELECTOR =
  '[data-finance-payment-price-input="true"]';
const tableRows = ref<PurchaseBillRow[]>([]);
const selectWrapRef = ref<HTMLElement | null>(null);
const selectedRowMap = new Map<string, PurchaseBillRow>();
const candidateTotal = ref(0);
const globalAutoWriteOffCount = ref(0);
const globalAutoWriteOffAmount = ref(0);
let loadRequestId = 0;
let previewRefreshTimer: ReturnType<typeof setTimeout> | undefined;

function getCandidateKey(bizType: number, bizId: number) {
  return `finance-payment:source:${bizType}:${bizId}`;
}

function getCurrentItem(bizType: number, bizId: number) {
  const cached = selectedRowMap.get(getCandidateKey(bizType, bizId));
  if (cached) return cached;
  return props.currentItems.find(
    (item) => item.bizType === bizType && item.bizId === bizId,
  );
}

function createRow(
  row: ErpFinancePaymentApi.FinancePaymentFormCandidate,
): PurchaseBillRow {
  const id = row.bizId;
  const current = getCurrentItem(row.bizType, id);
  const {
    deptName: _contextDeptName,
    supplierName: _contextSupplierName,
    ...paymentDocumentContext
  } = props.paymentContext;
  const normalizedTotalPrice = normalizeFinanceAmount(
    financeValue(row.totalPrice || 0),
  );
  const normalizedPaidPrice = normalizeFinanceAmount(
    financeValue(row.allocatedPrice || 0),
  );
  const outstandingPrice = normalizeFinanceAmount(
    financeValue(
      row.unallocatedPrice ??
        financeSubtract(normalizedTotalPrice, normalizedPaidPrice),
    ),
  );
  const paymentPrice = normalizeFinanceAmount(
    current?.paymentPrice ?? outstandingPrice,
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
    paidPrice: normalizedPaidPrice,
    paymentPrice,
    unPaymentPrice: subtractFinanceAmounts(outstandingPrice, paymentPrice),
    remark: current?.remark || '',
    supplierName:
      row.supplierName || current?.supplierName || _contextSupplierName,
    deptName: row.deptName || current?.deptName || _contextDeptName,
    ...paymentDocumentContext,
  };
}

function getOutstandingPrice(row: PurchaseBillRow) {
  return subtractFinanceAmounts(row.totalPrice, row.paidPrice);
}

const autoWriteOffPreviewMap = computed(() => {
  const result = new Map<string, number | string>();
  if (props.autoWriteOffPreviewDisabled) return result;
  tableRows.value.forEach((row) => {
    const amount = normalizeFinanceAmount(row.autoWriteOffPreviewAmount || 0);
    if (financeCompare(amount, 0) !== 0) result.set(row.clientRowKey, amount);
  });
  return result;
});

function getAutoWriteOffPreviewAmount(row: PurchaseBillRow) {
  return autoWriteOffPreviewMap.value.get(row.clientRowKey) || 0;
}

function getAutoWriteOffPreviewTitle(row: PurchaseBillRow) {
  const amount = getAutoWriteOffPreviewAmount(row);
  return financeCompare(amount, 0) === 0
    ? undefined
    : `审核通过后预计由系统自动核销 ￥${erpPriceInputFormatter(amount)}`;
}

function getPurchaseBillRowClass(row: PurchaseBillRow) {
  return financeCompare(getAutoWriteOffPreviewAmount(row), 0) === 0
    ? ''
    : 'payment-purchase-select__auto-writeoff-row';
}

function syncSelectedRowsFromProps() {
  selectedRowMap.clear();
  props.currentItems.forEach((item) => {
    if (!item.bizType || !item.bizId) return;
    const totalPrice = normalizeFinanceAmount(
      financeValue(item.totalPrice || 0),
    );
    const paidPrice = normalizeFinanceAmount(financeValue(item.paidPrice || 0));
    const paymentPrice = normalizeFinanceAmount(
      financeValue(item.paymentPrice || 0),
    );
    const row = {
      ...item,
      id: item.bizId,
      clientRowKey: getCandidateKey(item.bizType, item.bizId),
      selected: true,
      available: (item as { available?: boolean }).available !== false,
      totalPrice,
      paidPrice,
      paymentPrice,
      unPaymentPrice: subtractFinanceAmounts(
        subtractFinanceAmounts(totalPrice, paidPrice),
        paymentPrice,
      ),
    } as PurchaseBillRow;
    selectedRowMap.set(row.clientRowKey, row);
  });
}

function getCandidateSelections() {
  return [...selectedRowMap.values()].map((row) => ({
    bizType: row.bizType,
    bizId: row.bizId,
    amount: normalizeFinanceAmount(row.paymentPrice),
  }));
}

async function loadRows(
  formValues: Record<string, any>,
  page: { currentPage: number; pageSize: number },
  sort?: { field?: string; order?: string },
) {
  const requestId = (loadRequestId += 1);
  const supplierId = props.supplierId;
  const deptId = props.deptId;
  if (!supplierId) {
    return { list: [], total: 0 };
  }

  try {
    const response = await getFinancePaymentFormCandidatePage({
      supplierId,
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
      supplierId !== props.supplierId ||
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
    candidateTotal.value = Number(response.total || 0);
    globalAutoWriteOffCount.value = Number(response.autoWriteOffCount || 0);
    globalAutoWriteOffAmount.value = normalizeFinanceAmount(
      response.autoWriteOffAmount || 0,
    );
    return { list: rows, total: candidateTotal.value };
  } catch (error) {
    if (requestId !== loadRequestId) {
      return { list: tableRows.value, total: candidateTotal.value };
    }
    tableRows.value = [];
    message.error('付款明细加载失败，请检查网络后重试');
    throw error;
  }
}

function getSelectedRows() {
  return [...selectedRowMap.values()];
}

const selectionSummary = computed(() => {
  const rows = getSelectedRows();
  return {
    availableCount: candidateTotal.value,
    count: rows.length,
    totalPrice: sumFinanceAmounts(rows.map((row) => row.totalPrice)),
    paidPrice: sumFinanceAmounts(rows.map((row) => row.paidPrice)),
    paymentPrice: sumFinanceAmounts(rows.map((row) => row.paymentPrice)),
    autoWriteOffCount: globalAutoWriteOffCount.value,
    autoWriteOffAmount: globalAutoWriteOffAmount.value,
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

const remainingPrice = computed(() =>
  subtractFinanceAmounts(
    selectionSummary.value.totalPrice,
    selectionSummary.value.paidPrice,
    selectionSummary.value.paymentPrice,
  ),
);

function getSelectedItems(): ErpFinancePaymentApi.FinancePaymentItem[] {
  return getSelectedRows().map(
    ({
      id: _id,
      clientRowKey: _clientRowKey,
      available: _available,
      autoWriteOffPreviewAmount: _autoWriteOffPreviewAmount,
      selected: _selected,
      createTime: _createTime,
      status: _status,
      unPaymentPrice: _unPaymentPrice,
      ...item
    }) => item,
  );
}

function emitSelectedItems() {
  emit('change', getSelectedItems());
}

function focusFirstPaymentPriceInput() {
  if (props.disabled) {
    return false;
  }
  const firstSelectedRow = getDisplayRows().find((row) => row.selected);
  if (firstSelectedRow) {
    billGridApi.grid?.setCurrentRow?.(firstSelectedRow);
  }
  return focusFirstEditableInput(
    selectWrapRef.value,
    PAYMENT_PRICE_INPUT_SELECTOR,
  );
}

function queueFocusPaymentPriceInput(row: PurchaseBillRow) {
  void nextTick(() => {
    queueAfterEditableControlRender(() => {
      billGridApi.grid?.setCurrentRow?.(row);
      const input = selectWrapRef.value?.querySelector<HTMLInputElement>(
        `[data-finance-payment-row-key="${row.clientRowKey}"]`,
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

function getDisplayRows() {
  return tableRows.value;
}

function handleCheckboxChange(changedRow?: PurchaseBillRow) {
  tableRows.value.forEach((row) => {
    if (row.selected && !row.paymentPrice) {
      row.paymentPrice = getOutstandingPrice(row);
    }
    row.paymentPrice = normalizeFinanceAmount(row.paymentPrice);
    row.unPaymentPrice = subtractFinanceAmounts(
      row.totalPrice,
      row.paidPrice,
      row.selected ? row.paymentPrice : 0,
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
    queueFocusPaymentPriceInput(changedRow);
  }
}

function handlePaymentPriceInput(row: PurchaseBillRow, value: string) {
  const accepted = acceptFinanceDecimalInput(value);
  if (accepted === undefined) return;
  (row as any).paymentPrice = accepted;
}

function handlePaymentPriceBlur(row: PurchaseBillRow) {
  const normalized = normalizeFinanceDecimalInput(row.paymentPrice);
  const outstanding = getOutstandingPrice(row);
  if (
    normalized !== undefined &&
    (financeSign(normalized) !== financeSign(outstanding) ||
      financeCompare(financeAbs(normalized), financeAbs(outstanding)) > 0)
  ) {
    message.warning('本次付款必须与来源方向一致，且不能超过剩余可核销金额');
    return;
  } else {
    if (normalized === undefined) return;
    (row as any).paymentPrice = normalized;
  }
  handleRowChange(row);
}

function handleRowChange(row: PurchaseBillRow) {
  if (!row.selected) return;
  row.paymentPrice = normalizeFinanceAmount(row.paymentPrice);
  row.unPaymentPrice = subtractFinanceAmounts(
    row.totalPrice,
    row.paidPrice,
    row.paymentPrice,
  );
  selectedRowMap.set(row.clientRowKey, row);
  emitSelectedItems();
  queuePreviewRefresh();
}

function handleBizDetail(row: PurchaseBillRow) {
  if (!row.bizId) return;
  emit('detail', row);
}

function handleCellClick({
  column,
  row,
}: {
  column: any;
  row: PurchaseBillRow;
}) {
  if (
    props.disabled ||
    column?.type === 'checkbox' ||
    ['bizNo', 'paymentPrice', 'remark'].includes(column?.field)
  ) {
    return;
  }
  billGridApi.grid.toggleCheckboxRow(row);
}

const [BillGrid, billGridApi] = useVbenVxeGrid({
  formOptions: {
    schema: [
      {
        fieldName: 'no',
        label: '单据编号',
        component: 'Input',
        componentProps: {
          placeholder: '请输入业务单据编号',
          allowClear: true,
        },
      },
    ],
  },
  gridOptions: {
    pagerConfig: candidatePagerConfig(),
    columns: [
      { type: 'checkbox', width: 36 },
      {
        field: 'bizNo',
        title: '关联采购单或应付单',
        width: 190,
        sortable: true,
        slots: { default: 'bizNo' },
      },
      {
        field: 'supplierName',
        title: '付款供应商',
        minWidth: 130,
      },
      {
        field: 'deptName',
        title: '所属部门',
        minWidth: 120,
      },
      {
        field: 'paymentPrice',
        title: '付款/核销金额',
        minWidth: 140,
        align: 'right',
        headerAlign: 'right',
        slots: { default: 'paymentPrice' },
      },
      {
        field: 'paymentTime',
        title: '付款日期',
        minWidth: 160,
        formatter: 'formatDateTime',
      },
      {
        field: 'bizTime',
        title: '单据时间',
        width: 150,
        sortable: true,
        formatter: 'formatDate',
      },
      {
        field: 'totalPrice',
        title: '应付金额',
        minWidth: 110,
        align: 'right',
        headerAlign: 'right',
        formatter: 'formatAmount2',
      },
      {
        field: 'paidPrice',
        title: '已核销金额',
        minWidth: 110,
        align: 'right',
        headerAlign: 'right',
        formatter: 'formatAmount2',
      },
      {
        field: 'unPaymentPrice',
        title: '未核销金额',
        minWidth: 110,
        align: 'right',
        headerAlign: 'right',
        formatter: ({ row }) =>
          erpPriceInputFormatter(financeValue(row.unPaymentPrice || 0)),
      },
      {
        field: 'remark',
        title: '备注',
        minWidth: 160,
        slots: { default: 'remark' },
      },
      {
        field: 'paymentMethod',
        title: '付款方式',
        minWidth: 110,
      },
      {
        field: 'accountName',
        title: '付款账户',
        minWidth: 130,
      },
      {
        field: 'financeUserName',
        title: '经办人',
        minWidth: 110,
      },
    ],
    height: 420,
    keepSource: true,
    rowClassName: ({ row }) => getPurchaseBillRowClass(row),
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
        !props.disabled &&
        Boolean(row.bizId) &&
        financeCompare(getOutstandingPrice(row), 0) !== 0,
    },
    sortConfig: {
      remote: true,
      multiple: false,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
      allowBtn: false,
    },
    toolbarConfig: { custom: true, refresh: true, search: true, zoom: true },
  } as VxeTableGridOptions<PurchaseBillRow>,
  gridEvents: {
    cellClick: handleCellClick,
    checkboxChange: ({ row }: { row: PurchaseBillRow }) =>
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
  if (!props.supplierId) {
    return;
  }
  await nextTick();
  await billGridApi.query();
  emitSelectedItems();
}

watch(() => [props.supplierId, props.deptId], reloadData, { immediate: true });
watch(
  () => props.paymentContext,
  (context) => {
    const {
      deptName: _contextDeptName,
      supplierName: _contextSupplierName,
      ...paymentDocumentContext
    } = context;
    tableRows.value.forEach((row) =>
      Object.assign(row, paymentDocumentContext),
    );
    selectedRowMap.forEach((row) => Object.assign(row, paymentDocumentContext));
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

defineExpose({
  focusFirstPaymentPriceInput,
  getSelectedItems,
  validateSelectedItemsAvailable,
});
</script>

<template>
  <div ref="selectWrapRef" class="payment-purchase-select">
    <div v-if="!supplierId" class="payment-purchase-select__empty">
      请先选择供应商后加载待付款业务单据
    </div>
    <BillGrid
      class="payment-purchase-select__grid"
      table-title="待付款业务单据"
    >
      <template #bizNo="{ row }">
        <span class="payment-purchase-select__biz-no-cell">
          <a
            v-if="row.bizNo && row.bizId"
            class="cursor-pointer text-primary"
            @click.stop="handleBizDetail(row)"
          >
            {{ row.bizNo }}
          </a>
          <span v-else>{{ row.bizNo || '-' }}</span>
          <span
            v-if="financeCompare(getAutoWriteOffPreviewAmount(row), 0) !== 0"
            class="payment-purchase-select__auto-tag"
            :title="getAutoWriteOffPreviewTitle(row)"
          >
            预计自动
          </span>
          <span v-if="row.available === false" class="text-error">已失效</span>
        </span>
      </template>
      <template #paymentPrice="{ row }">
        <DecimalAmountInput
          :value="
            row.paymentPrice === undefined ? '' : String(row.paymentPrice)
          "
          class="w-full"
          :disabled="disabled || !row.selected || row.available === false"
          inputmode="decimal"
          placeholder="勾选后填写"
          data-finance-payment-price-input="true"
          :data-finance-payment-row-key="row.clientRowKey"
          @blur="handlePaymentPriceBlur(row)"
          @press-enter="handleItemInputPressEnter"
          @update:value="handlePaymentPriceInput(row, $event)"
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
        <div class="payment-purchase-select__summary" aria-live="polite">
          <span>
            可核销 <b>{{ selectionSummary.availableCount }}</b> 单
          </span>
          <span>
            已勾选 <b>{{ selectionSummary.count }}</b> 单
          </span>
          <span>
            选中应付
            <b>¥{{ erpPriceInputFormatter(selectionSummary.totalPrice) }}</b>
          </span>
          <span>
            历史核销
            <b>¥{{ erpPriceInputFormatter(selectionSummary.paidPrice) }}</b>
          </span>
          <span class="payment-purchase-select__summary-actual">
            本次付款
            <b>¥{{ erpPriceInputFormatter(selectionSummary.paymentPrice) }}</b>
          </span>
          <span>
            付款后未核销
            <b>¥{{ erpPriceInputFormatter(remainingPrice) }}</b>
          </span>
          <span
            v-if="selectionSummary.autoWriteOffCount > 0"
            class="payment-purchase-select__summary-auto"
          >
            预计自动核销
            <b>{{ selectionSummary.autoWriteOffCount }}</b>
            单 / ¥{{
              erpPriceInputFormatter(selectionSummary.autoWriteOffAmount)
            }}
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
            class="payment-purchase-select__legend"
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
.payment-purchase-select {
  --payment-select-accent: 24 82% 42%;
}

:global(.dark) .payment-purchase-select {
  --payment-select-accent: 27 92% 64%;
}

.payment-purchase-select__empty {
  display: flex;
  min-height: 56px;
  align-items: center;
  justify-content: center;
  padding: 10px 14px;
  margin-bottom: 10px;
  border: 1px dashed hsl(var(--border));
  border-radius: 7px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 36%);
  font-size: 12px;
}

:deep(.payment-purchase-select__grid .vxe-table--render-default) {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

:deep(.payment-purchase-select__grid .vxe-header--column) {
  height: 34px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

:deep(.payment-purchase-select__grid .vxe-body--column) {
  height: 38px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.payment-purchase-select__grid .ant-input),
:deep(.payment-purchase-select__grid .ant-input-number-input) {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

:deep(.payment-purchase-select__grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(
  .payment-purchase-select__grid
    .vxe-header--column.is--sortable
    .vxe-cell--title
) {
  color: #1677ff;
}

:deep(.payment-purchase-select__grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.payment-purchase-select__grid .vxe-grid--form-wrapper),
:deep(.payment-purchase-select__grid .vxe-toolbar) {
  font-size: 12px;
}

:deep(.payment-purchase-select__grid .vxe-grid--form-wrapper .ant-input),
:deep(.payment-purchase-select__grid .vxe-grid--form-wrapper .ant-btn),
:deep(.payment-purchase-select__grid .vxe-toolbar .vxe-button) {
  height: 28px;
  font-size: 12px;
}

:deep(.payment-purchase-select__grid .row--checked) {
  background: hsl(var(--payment-select-accent) / 7%);
}

:deep(.payment-purchase-select__auto-writeoff-row .vxe-body--column) {
  background-color: hsl(var(--payment-select-accent) / 9%) !important;
}

:deep(
  .payment-purchase-select__auto-writeoff-row.row--hover .vxe-body--column
) {
  background-color: hsl(var(--payment-select-accent) / 15%) !important;
}

.payment-purchase-select__biz-no-cell {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 6px;
}

.payment-purchase-select__auto-tag {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  height: 18px;
  padding: 0 5px;
  color: hsl(var(--payment-select-accent));
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  background: hsl(var(--payment-select-accent) / 12%);
  border: 1px solid hsl(var(--payment-select-accent) / 30%);
  border-radius: 4px;
}

.payment-purchase-select__summary {
  display: flex;
  min-height: 44px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px 20px;
  padding: 8px 14px;
  border-top: 1px solid hsl(var(--border));
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  background: hsl(var(--muted) / 28%);
}

.payment-purchase-select__summary b {
  color: hsl(var(--foreground));
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.payment-purchase-select__summary-actual {
  padding: 4px 9px;
  border-radius: 5px;
  color: hsl(var(--payment-select-accent));
  font-weight: 600;
  background: hsl(var(--payment-select-accent) / 9%);
}

.payment-purchase-select__summary-actual b {
  color: hsl(var(--payment-select-accent));
  font-size: 15px;
}

.payment-purchase-select__summary-auto {
  padding: 4px 9px;
  border-radius: 5px;
  color: hsl(var(--payment-select-accent));
  font-weight: 600;
  background: hsl(var(--payment-select-accent) / 10%);
}

.payment-purchase-select__summary-auto b {
  color: hsl(var(--payment-select-accent));
}

.payment-purchase-select__legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.payment-purchase-select__legend i {
  width: 14px;
  height: 10px;
  background: hsl(var(--payment-select-accent) / 12%);
  border: 1px solid hsl(var(--payment-select-accent) / 30%);
  border-radius: 2px;
}
</style>
