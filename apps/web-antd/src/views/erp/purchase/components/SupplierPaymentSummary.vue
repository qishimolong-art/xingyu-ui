<script lang="ts" setup>
import type { ErpPayableAccountApi } from '#/api/erp/finance/payable/account';

import { computed, ref, watch } from 'vue';

import { formatDate } from '@vben/utils';
import { formatPurchaseAmount } from '../utils/decimal';

import { getPayableAccountPage } from '#/api/erp/finance/payable/account';

interface Props {
  supplierId?: number | string;
}

const props = defineProps<Props>();

const loading = ref(false);
const loadFailed = ref(false);
const summary = ref<ErpPayableAccountApi.PayableAccount>();
let requestSeq = 0;

const paymentItems = computed(() => [
  { label: '待付金额', value: summary.value?.balance, emphasis: true },
  { label: '已付金额', value: summary.value?.paymentAmount },
  { label: '已核销金额', value: summary.value?.writeOffAmount },
  { label: '未核销预付款', value: summary.value?.unclearedPrepayment },
  { label: '其他应付', value: summary.value?.miscPayableAmount },
]);

function formatAmount(value?: number) {
  return formatPurchaseAmount(value, '0.00');
}

function formatBizDate(value?: string) {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  if (/^\d+$/.test(trimmed)) {
    const timestamp = Number(trimmed);
    return formatDate(trimmed.length === 10 ? timestamp * 1000 : timestamp);
  }
  return formatDate(trimmed);
}

async function loadSummary(supplierId?: number | string) {
  const seq = ++requestSeq;
  if (!supplierId) {
    summary.value = undefined;
    loadFailed.value = false;
    loading.value = false;
    return;
  }

  loading.value = true;
  loadFailed.value = false;
  try {
    const result = await getPayableAccountPage({
      pageNo: 1,
      pageSize: 1,
      supplierId,
      showZeroBalance: true,
    });
    if (seq !== requestSeq) {
      return;
    }
    summary.value = result.list?.[0];
  } catch {
    if (seq !== requestSeq) {
      return;
    }
    summary.value = undefined;
    loadFailed.value = true;
  } finally {
    if (seq === requestSeq) {
      loading.value = false;
    }
  }
}

watch(
  () => props.supplierId,
  (supplierId) => {
    loadSummary(supplierId);
  },
  { immediate: true },
);
</script>

<template>
  <div
    v-if="supplierId"
    class="rounded border border-blue-100 bg-blue-50 px-4 py-3"
  >
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <span class="font-medium text-blue-700">供应商付款信息</span>
      <template v-if="loading">
        <span class="text-muted-foreground">加载中...</span>
      </template>
      <template v-else-if="loadFailed">
        <span class="text-orange-600">暂无法获取</span>
      </template>
      <template v-else-if="summary">
        <span
          v-for="item in paymentItems"
          :key="item.label"
          class="inline-flex items-center gap-1"
        >
          <span class="text-muted-foreground">{{ item.label }}</span>
          <b :class="item.emphasis ? 'text-red-600' : 'text-slate-800'">
            {{ formatAmount(item.value) }}
          </b>
        </span>
        <span v-if="summary.lastBizTime" class="inline-flex items-center gap-1">
          <span class="text-muted-foreground">最近业务</span>
          <b class="text-slate-800">{{ formatBizDate(summary.lastBizTime) }}</b>
        </span>
      </template>
      <template v-else>
        <span class="text-muted-foreground">暂无付款记录</span>
      </template>
    </div>
  </div>
</template>
