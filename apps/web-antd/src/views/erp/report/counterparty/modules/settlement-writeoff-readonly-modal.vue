<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';

import type { ErpFinancePaymentApi } from '#/api/erp/finance/payment';
import type { ErpFinanceReceiptApi } from '#/api/erp/finance/receipt';

import { computed, ref } from 'vue';

import { formatDateTime } from '@vben/utils';

import { Alert, Modal, Table, Tag } from 'ant-design-vue';

import { getFinancePaymentWriteOffItems } from '#/api/erp/finance/payment';
import { getFinanceReceiptWriteOffItems } from '#/api/erp/finance/receipt';

defineOptions({ name: 'ErpSettlementWriteoffReadonlyModal' });

type Flow = 'payment' | 'receipt';

type ShowPayload = {
  bizId?: number;
  bizNo?: string;
  bizType: number;
  flow: Flow;
};

type ReadonlyWriteOffRow = {
  accountName?: string;
  amount?: number;
  financeUserName?: string;
  id?: number;
  no?: string;
  remark?: string;
  time?: Date | number | string;
  writeOffStatus?: number;
  writeOffTime?: Date | number | string;
};

const open = ref(false);
const loading = ref(false);
const loadError = ref('');
const rows = ref<ReadonlyWriteOffRow[]>([]);
const current = ref<ShowPayload>({ bizType: 0, flow: 'receipt' });
let loadSequence = 0;

const title = computed(() =>
  current.value.flow === 'receipt'
    ? '收款核销明细（只读）'
    : '付款核销明细（只读）',
);
const documentLabel = computed(() =>
  current.value.flow === 'receipt' ? '收款单号' : '付款单号',
);
const timeLabel = computed(() =>
  current.value.flow === 'receipt' ? '收款时间' : '付款时间',
);
const amountLabel = computed(() =>
  current.value.flow === 'receipt' ? '本次收/退款' : '本次付/退款',
);

const columns = computed<TableColumnsType<ReadonlyWriteOffRow>>(() => [
  { title: documentLabel.value, dataIndex: 'no', width: 170 },
  { title: timeLabel.value, dataIndex: 'time', width: 160 },
  { title: '账户', dataIndex: 'accountName', width: 140 },
  { title: '经办人', dataIndex: 'financeUserName', width: 110 },
  {
    title: amountLabel.value,
    dataIndex: 'amount',
    width: 130,
    align: 'right' as const,
  },
  { title: '核销时间', dataIndex: 'writeOffTime', width: 160 },
  { title: '核销状态', dataIndex: 'writeOffStatus', width: 100 },
  { title: '备注', dataIndex: 'remark', width: 220 },
]);

const summary = computed(() => {
  let amount = 0;
  for (const row of rows.value) {
    amount += Number(row.amount || 0);
  }
  return { amount, count: rows.value.length };
});

function normalizeReceiptRow(
  item: ErpFinanceReceiptApi.FinanceReceiptWriteOffItem,
): ReadonlyWriteOffRow {
  return {
    accountName: item.accountName,
    amount: item.receiptPrice,
    financeUserName: item.financeUserName,
    id: item.receiptItemId,
    no: item.receiptNo,
    remark: item.remark,
    time: item.receiptTime,
    writeOffStatus: item.writeOffStatus,
    writeOffTime: item.writeOffTime,
  };
}

function normalizePaymentRow(
  item: ErpFinancePaymentApi.FinancePaymentWriteOffItem,
): ReadonlyWriteOffRow {
  return {
    accountName: item.accountName,
    amount: item.paymentPrice,
    financeUserName: item.financeUserName,
    id: item.paymentItemId,
    no: item.paymentNo,
    remark: item.remark,
    time: item.paymentTime,
    writeOffStatus: item.writeOffStatus,
    writeOffTime: item.writeOffTime,
  };
}

async function loadData() {
  const { bizId, bizType, flow } = current.value;
  const sequence = ++loadSequence;
  loadError.value = '';
  rows.value = [];
  if (!bizId || !bizType) {
    loadError.value = '当前业务单据缺少 ID 或业务类型，无法查看核销明细';
    return;
  }
  loading.value = true;
  try {
    if (flow === 'receipt') {
      const result = await getFinanceReceiptWriteOffItems({ bizId, bizType });
      if (sequence === loadSequence)
        rows.value = (result || []).map((row) => normalizeReceiptRow(row));
    } else {
      const result = await getFinancePaymentWriteOffItems({ bizId, bizType });
      if (sequence === loadSequence)
        rows.value = (result || []).map((row) => normalizePaymentRow(row));
    }
  } catch {
    if (sequence === loadSequence) {
      loadError.value = '核销明细加载失败';
      rows.value = [];
    }
  } finally {
    if (sequence === loadSequence) loading.value = false;
  }
}

function formatMoney(value: unknown) {
  const next = Number(value || 0);
  if (!Number.isFinite(next)) return '-';
  return next.toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function formatTime(value: unknown) {
  if (!value) return '-';
  return formatDateTime(value as string) || String(value);
}

function getWriteOffStatus(status?: number) {
  if (status === 1) return { color: 'success', label: '已生效' };
  if (status === 2) return { color: 'default', label: '已撤销' };
  return { color: 'processing', label: '待生效' };
}

function show(payload: ShowPayload) {
  current.value = payload;
  open.value = true;
  void loadData();
}

defineExpose({ show });
</script>

<template>
  <Modal
    v-model:open="open"
    :footer="null"
    width="980px"
    class="settlement-writeoff-readonly-modal"
    :title="title"
  >
    <Alert
      class="mb-2"
      show-icon
      type="info"
      message="本弹窗按现有核销关系只读展示。"
      :description="`业务单据：${current.bizNo || '-'}；数据来自现有${current.flow === 'receipt' ? '收款' : '付款'}核销明细读取接口，只读展示当前核销关系，不重算历史截止余额/账龄，不提供核销、反核销、编辑、删除、导出；本页参考核销合计仅用于追溯当前业务核销关系。`"
    />
    <Alert
      v-if="loadError"
      class="mb-2"
      :message="loadError"
      show-icon
      type="error"
    />
    <Table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="false"
      row-key="id"
      size="small"
      :scroll="{ x: 1190, y: 360 }"
    >
      <template #bodyCell="{ column, text }">
        <template
          v-if="['time', 'writeOffTime'].includes(String(column.dataIndex))"
        >
          {{ formatTime(text) }}
        </template>
        <template v-else-if="column.dataIndex === 'amount'">
          {{ formatMoney(text) }}
        </template>
        <template v-else-if="column.dataIndex === 'writeOffStatus'">
          <Tag :color="getWriteOffStatus(Number(text)).color">
            {{ getWriteOffStatus(Number(text)).label }}
          </Tag>
        </template>
        <template v-else>
          {{ text || '-' }}
        </template>
      </template>
    </Table>
    <div class="settlement-writeoff-readonly-modal__summary">
      <span>明细数：{{ summary.count }}</span>
      <span>本页参考核销合计：{{ formatMoney(summary.amount) }}</span>
    </div>
  </Modal>
</template>

<style scoped>
.settlement-writeoff-readonly-modal :deep(.ant-modal-body) {
  max-height: 70vh;
  overflow: hidden;
}

.settlement-writeoff-readonly-modal__summary {
  display: flex;
  justify-content: flex-end;
  gap: 20px;
  margin-top: 10px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.settlement-writeoff-readonly-modal__summary span:last-child {
  color: hsl(var(--primary));
  font-weight: 600;
}
</style>
