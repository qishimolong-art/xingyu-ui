<script lang="ts" setup>
import type { ErpFinanceReceiptApi } from '#/api/erp/finance/receipt';
import type { ErpSaleOutApi } from '#/api/erp/sale/out';

import { computed, ref, watch } from 'vue';

import { formatDateTime } from '@vben/utils';

import { formatSaleAmount } from '../../utils/decimal';

import { getFinanceReceiptWriteOffItems } from '#/api/erp/finance/receipt';
import { getSaleOutReceiptSummary } from '#/api/erp/sale/out';
import CustomerReceivableSummary from '#/views/erp/sale/components/CustomerReceivableSummary.vue';

const props = withDefaults(
  defineProps<{
    active?: boolean;
    canViewReceiptItems?: boolean;
    customerId?: number;
    outId?: number;
    reloadKey?: number;
  }>(),
  {
    active: false,
    canViewReceiptItems: false,
    customerId: undefined,
    outId: undefined,
    reloadKey: 0,
  },
);

const SALE_OUT_BIZ_TYPE = 21;

const summary = ref<ErpSaleOutApi.SaleOutReceiptSummary>();
const receiptItems = ref<ErpFinanceReceiptApi.FinanceReceiptWriteOffItem[]>([]);
const summaryLoading = ref(false);
const detailLoading = ref(false);
const summaryLoadError = ref('');
const detailLoadError = ref('');
let loadSequence = 0;

const summaryItems = computed(() => [
  {
    label: '应收金额',
    value: formatAmount(summary.value?.receivableAmount),
  },
  {
    label: '已核销金额',
    value: formatAmount(summary.value?.receivedAmount),
    primary: true,
  },
  {
    label: '未收金额',
    value: formatAmount(summary.value?.unreceivedAmount),
  },
  {
    label: '收款状态',
    status: summary.value?.receiptStatus,
    value: getReceiptStatusText(summary.value?.receiptStatus),
  },
]);

watch(
  () => [props.active, props.canViewReceiptItems, props.outId, props.reloadKey],
  () => {
    if (props.active) {
      void loadReceiptData();
    }
  },
  { immediate: true },
);

async function loadReceiptData() {
  const outId = props.outId;
  const sequence = ++loadSequence;
  summaryLoadError.value = '';
  detailLoadError.value = '';
  if (!outId) {
    summary.value = undefined;
    receiptItems.value = [];
    return;
  }

  summaryLoading.value = true;
  try {
    summary.value = await getSaleOutReceiptSummary(outId);
  } catch {
    if (sequence === loadSequence) {
      summaryLoadError.value = '收款摘要加载失败';
      summary.value = undefined;
    }
  } finally {
    if (sequence === loadSequence) {
      summaryLoading.value = false;
    }
  }

  if (!props.canViewReceiptItems) {
    receiptItems.value = [];
    return;
  }

  detailLoading.value = true;
  try {
    const rows = await getFinanceReceiptWriteOffItems({
      bizId: outId,
      bizType: SALE_OUT_BIZ_TYPE,
    });
    if (sequence === loadSequence) {
      receiptItems.value = rows ?? [];
    }
  } catch {
    if (sequence === loadSequence) {
      detailLoadError.value = '收款核销明细加载失败';
      receiptItems.value = [];
    }
  } finally {
    if (sequence === loadSequence) {
      detailLoading.value = false;
    }
  }
}

function formatAmount(value?: number) {
  return `¥${formatSaleAmount(value || 0, '0.00')}`;
}

function formatTime(value?: Date | number | string) {
  return value ? formatDateTime(value) || '-' : '-';
}

function getReceiptStatusText(status?: number) {
  switch (status) {
    case 1: {
      return '部分收款';
    }
    case 2: {
      return '已收款';
    }
    default: {
      return '未收款';
    }
  }
}

function getWriteOffStatusText(status?: number) {
  switch (status) {
    case 1: {
      return '已生效';
    }
    case 2: {
      return '已撤销';
    }
    default: {
      return '待生效';
    }
  }
}
</script>

<template>
  <div class="sale-receipt-tab">
    <section class="sale-receipt-section">
      <header class="sale-receipt-section__header">
        <span class="sale-receipt-section__title">收款摘要</span>
      </header>
      <div v-if="summaryLoading" class="sale-receipt-state">
        收款摘要加载中...
      </div>
      <div v-else-if="summaryLoadError" class="sale-receipt-state is-error">
        {{ summaryLoadError }}
      </div>
      <div v-else class="sale-receipt-summary-grid">
        <div
          v-for="item in summaryItems"
          :key="item.label"
          class="sale-receipt-summary-card"
          :class="{
            'is-primary': item.primary,
            'is-paid': item.status === 2,
            'is-part': item.status === 1,
          }"
        >
          <span class="sale-receipt-summary-card__label">
            {{ item.label }}
          </span>
          <strong class="sale-receipt-summary-card__value">
            {{ item.value }}
          </strong>
        </div>
      </div>
    </section>

    <section class="sale-receipt-section">
      <header class="sale-receipt-section__header">
        <span class="sale-receipt-section__title">收款核销明细</span>
      </header>
      <div v-if="!canViewReceiptItems" class="sale-receipt-state">
        无收款单查询权限
      </div>
      <div v-else-if="detailLoading" class="sale-receipt-state">
        收款核销明细加载中...
      </div>
      <div v-else-if="detailLoadError" class="sale-receipt-state is-error">
        {{ detailLoadError }}
      </div>
      <div v-else-if="receiptItems.length === 0" class="sale-receipt-state">
        暂无收款核销明细
      </div>
      <div v-else class="sale-receipt-table-wrap">
        <table class="sale-receipt-table">
          <thead>
            <tr>
              <th>收款单号</th>
              <th>收款时间</th>
              <th>收款账户</th>
              <th>经办人</th>
              <th>本次收款</th>
              <th>核销时间</th>
              <th>核销状态</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in receiptItems" :key="item.receiptItemId">
              <td>{{ item.receiptNo || '-' }}</td>
              <td>{{ formatTime(item.receiptTime) }}</td>
              <td>{{ item.accountName || '-' }}</td>
              <td>{{ item.financeUserName || '-' }}</td>
              <td class="sale-receipt-table__amount">
                {{ formatAmount(item.receiptPrice) }}
              </td>
              <td>{{ formatTime(item.writeOffTime) }}</td>
              <td>{{ getWriteOffStatusText(item.writeOffStatus) }}</td>
              <td>{{ item.remark || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="sale-receipt-section">
      <header class="sale-receipt-section__header">
        <span class="sale-receipt-section__title">客户应收信息</span>
      </header>
      <CustomerReceivableSummary :customer-id="customerId" />
    </section>
  </div>
</template>

<style scoped>
.sale-receipt-tab {
  display: grid;
  gap: 12px;
}

.sale-receipt-section {
  padding: 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--background));
}

.sale-receipt-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.sale-receipt-section__title {
  color: hsl(var(--foreground));
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.sale-receipt-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.sale-receipt-summary-card {
  min-width: 0;
  padding: 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--background));
}

.sale-receipt-summary-card.is-primary {
  border-color: rgb(20 130 125 / 35%);
  background: rgb(20 130 125 / 7%);
}

.sale-receipt-summary-card.is-paid {
  border-color: rgb(22 163 74 / 35%);
}

.sale-receipt-summary-card.is-part {
  border-color: rgb(217 119 6 / 35%);
}

.sale-receipt-summary-card__label {
  display: block;
  margin-bottom: 6px;
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-receipt-summary-card__value {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
  color: hsl(var(--foreground));
  font-size: 16px;
  line-height: 22px;
}

.sale-receipt-state {
  min-height: 46px;
  padding: 14px 12px;
  border: 1px dashed hsl(var(--border));
  border-radius: 8px;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  line-height: 18px;
}

.sale-receipt-state.is-error {
  border-color: rgb(220 38 38 / 35%);
  color: rgb(185 28 28);
}

.sale-receipt-table-wrap {
  overflow-x: auto;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.sale-receipt-table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
  font-size: 12px;
}

.sale-receipt-table th,
.sale-receipt-table td {
  padding: 9px 10px;
  border-bottom: 1px solid hsl(var(--border));
  color: hsl(var(--foreground));
  line-height: 18px;
  text-align: left;
  vertical-align: middle;
}

.sale-receipt-table th {
  background: hsl(var(--muted) / 0.45);
  color: hsl(var(--muted-foreground));
  font-weight: 500;
  white-space: nowrap;
}

.sale-receipt-table tbody tr:last-child td {
  border-bottom: 0;
}

.sale-receipt-table__amount {
  color: rgb(20 130 125);
  font-weight: 600;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .sale-receipt-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .sale-receipt-summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
