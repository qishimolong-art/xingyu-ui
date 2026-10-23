<script lang="ts" setup>
import type { ErpFinancePaymentApi } from '#/api/erp/finance/payment';
import type { ErpPurchasePriceAdjustApi } from '#/api/erp/purchase/priceadjust';

import { computed, ref, watch } from 'vue';

import { formatDateTime } from '@vben/utils';
import { formatPurchaseAmount, formatPurchaseDecimal } from '#/views/erp/purchase/utils/decimal';

import { getFinancePaymentWriteOffItems } from '#/api/erp/finance/payment';
import { getPurchasePriceAdjustPaymentSummary } from '#/api/erp/purchase/priceadjust';
import SupplierPaymentSummary from '#/views/erp/purchase/components/SupplierPaymentSummary.vue';

const props = withDefaults(
  defineProps<{
    active?: boolean;
    adjustId?: number;
    canViewPaymentItems?: boolean;
    reloadKey?: number;
    supplierId?: number;
  }>(),
  {
    active: false,
    adjustId: undefined,
    canViewPaymentItems: false,
    reloadKey: 0,
    supplierId: undefined,
  },
);

const PURCHASE_PRICE_ADJUST_BIZ_TYPE = 13;

const summary =
  ref<ErpPurchasePriceAdjustApi.PurchasePriceAdjustSettlementSummary>();
const paymentItems = ref<ErpFinancePaymentApi.FinancePaymentWriteOffItem[]>([]);
const summaryLoading = ref(false);
const detailLoading = ref(false);
const summaryLoadError = ref('');
const detailLoadError = ref('');
let loadSequence = 0;

const summaryItems = computed(() => [
  {
    label: '应结算金额',
    value: formatAmount(summary.value?.settlementAmount),
  },
  {
    label: '已核销金额',
    value: formatAmount(summary.value?.writtenOffAmount),
    primary: true,
  },
  {
    label: '未核销金额',
    value: formatAmount(summary.value?.unwrittenOffAmount),
  },
  {
    label: '核销状态',
    status: summary.value?.settlementStatus,
    value: getSettlementStatusText(summary.value?.settlementStatus),
  },
]);

watch(
  () => [
    props.active,
    props.adjustId,
    props.canViewPaymentItems,
    props.reloadKey,
  ],
  () => {
    if (props.active) {
      void loadPaymentData();
    }
  },
  { immediate: true },
);

async function loadPaymentData() {
  const adjustId = props.adjustId;
  const sequence = ++loadSequence;
  summaryLoadError.value = '';
  detailLoadError.value = '';
  if (!adjustId) {
    summary.value = undefined;
    paymentItems.value = [];
    detailLoading.value = false;
    return;
  }

  summaryLoading.value = true;
  try {
    summary.value = await getPurchasePriceAdjustPaymentSummary(adjustId);
  } catch {
    if (sequence === loadSequence) {
      summaryLoadError.value = '结算摘要加载失败';
      summary.value = undefined;
    }
  } finally {
    if (sequence === loadSequence) {
      summaryLoading.value = false;
    }
  }

  if (!props.canViewPaymentItems) {
    paymentItems.value = [];
    detailLoading.value = false;
    return;
  }

  detailLoading.value = true;
  try {
    const rows = await getFinancePaymentWriteOffItems({
      bizId: adjustId,
      bizType: PURCHASE_PRICE_ADJUST_BIZ_TYPE,
    });
    if (sequence === loadSequence) {
      paymentItems.value = rows ?? [];
    }
  } catch {
    if (sequence === loadSequence) {
      detailLoadError.value = '结算核销明细加载失败';
      paymentItems.value = [];
    }
  } finally {
    if (sequence === loadSequence) {
      detailLoading.value = false;
    }
  }
}

function formatAmount(value?: number) {
  return `¥${formatPurchaseAmount(value, '0')}`;
}

function formatTime(value?: Date | number | string) {
  return value ? formatDateTime(value) || '-' : '-';
}

function getSettlementStatusText(status?: number) {
  switch (status) {
    case 1: {
      return '部分核销';
    }
    case 2: {
      return '已核销';
    }
    default: {
      return '未核销';
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
  <div class="purchase-payment-tab">
    <section class="purchase-document-section purchase-payment-summary-section">
      <header class="purchase-document-section__header">
        <span class="purchase-document-section__title">结算摘要</span>
      </header>
      <div v-if="summaryLoading" class="purchase-payment-state">
        结算摘要加载中...
      </div>
      <div v-else-if="summaryLoadError" class="purchase-payment-state is-error">
        {{ summaryLoadError }}
      </div>
      <div v-else class="purchase-payment-summary-grid">
        <div
          v-for="item in summaryItems"
          :key="item.label"
          class="purchase-payment-summary-card"
          :class="{
            'is-primary': item.primary,
            'is-paid': item.status === 2,
            'is-part': item.status === 1,
          }"
        >
          <span class="purchase-payment-summary-card__label">
            {{ item.label }}
          </span>
          <strong class="purchase-payment-summary-card__value">
            {{ item.value }}
          </strong>
        </div>
      </div>
    </section>

    <section class="purchase-document-section purchase-payment-detail-section">
      <header class="purchase-document-section__header">
        <span class="purchase-document-section__title">结算核销明细</span>
      </header>
      <div v-if="!canViewPaymentItems" class="purchase-payment-state">
        无付款单查询权限
      </div>
      <div v-else-if="detailLoading" class="purchase-payment-state">
        结算核销明细加载中...
      </div>
      <div v-else-if="detailLoadError" class="purchase-payment-state is-error">
        {{ detailLoadError }}
      </div>
      <div v-else-if="paymentItems.length === 0" class="purchase-payment-state">
        暂无结算核销明细
      </div>
      <div v-else class="purchase-payment-table-wrap">
        <table class="purchase-payment-table">
          <thead>
            <tr>
              <th>付款单号</th>
              <th>付款时间</th>
              <th>付款账户</th>
              <th>经办人</th>
              <th>本次核销</th>
              <th>核销时间</th>
              <th>核销状态</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in paymentItems" :key="item.paymentItemId">
              <td>{{ item.paymentNo || '-' }}</td>
              <td>{{ formatTime(item.paymentTime) }}</td>
              <td>{{ item.accountName || '-' }}</td>
              <td>{{ item.financeUserName || '-' }}</td>
              <td class="purchase-payment-table__amount">
                {{ formatAmount(item.paymentPrice) }}
              </td>
              <td>{{ formatTime(item.writeOffTime) }}</td>
              <td>{{ getWriteOffStatusText(item.writeOffStatus) }}</td>
              <td>{{ item.remark || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section
      class="purchase-document-section purchase-payment-supplier-section"
    >
      <header class="purchase-document-section__header">
        <span class="purchase-document-section__title">供应商付款信息</span>
      </header>
      <SupplierPaymentSummary :supplier-id="supplierId" />
    </section>
  </div>
</template>

<style scoped>
.purchase-payment-tab {
  display: grid;
  gap: 12px;
}

.purchase-payment-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.purchase-payment-summary-card {
  min-width: 0;
  padding: 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--background));
}

.purchase-payment-summary-card.is-primary {
  border-color: rgb(20 130 125 / 35%);
  background: rgb(20 130 125 / 7%);
}

.purchase-payment-summary-card.is-paid {
  border-color: rgb(22 163 74 / 35%);
}

.purchase-payment-summary-card.is-part {
  border-color: rgb(217 119 6 / 35%);
}

.purchase-payment-summary-card__label {
  display: block;
  margin-bottom: 6px;
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.purchase-payment-summary-card__value {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
  color: hsl(var(--foreground));
  font-size: 16px;
  line-height: 22px;
}

.purchase-payment-state {
  min-height: 46px;
  padding: 14px 12px;
  border: 1px dashed hsl(var(--border));
  border-radius: 8px;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  line-height: 18px;
}

.purchase-payment-state.is-error {
  border-color: rgb(220 38 38 / 35%);
  color: rgb(185 28 28);
}

.purchase-payment-table-wrap {
  overflow-x: auto;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.purchase-payment-table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
  font-size: 12px;
}

.purchase-payment-table th,
.purchase-payment-table td {
  padding: 9px 10px;
  border-bottom: 1px solid hsl(var(--border));
  color: hsl(var(--foreground));
  line-height: 18px;
  text-align: left;
  vertical-align: middle;
}

.purchase-payment-table th {
  background: hsl(var(--muted) / 0.45);
  color: hsl(var(--muted-foreground));
  font-weight: 500;
  white-space: nowrap;
}

.purchase-payment-table tbody tr:last-child td {
  border-bottom: 0;
}

.purchase-payment-table__amount {
  color: rgb(20 130 125);
  font-weight: 600;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .purchase-payment-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .purchase-payment-summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
