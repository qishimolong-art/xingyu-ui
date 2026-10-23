<script lang="ts" setup>
import type { ErpReceivableAccountApi } from '#/api/erp/finance/receivable/account';

import { computed, ref, watch } from 'vue';

import { formatDate } from '@vben/utils';

import { formatSaleAmount } from '../utils/decimal';

import { getReceivableAccountPage } from '#/api/erp/finance/receivable/account';

interface Props {
  customerId?: number | string;
}

const props = defineProps<Props>();

const loading = ref(false);
const loadFailed = ref(false);
const summary = ref<ErpReceivableAccountApi.ReceivableAccount>();
let requestSeq = 0;

const receivableItems = computed(() => [
  { label: '销售总额', value: summary.value?.receivableAmount },
  {
    label: '应收余额',
    value: summary.value?.unreceivedAmount ?? summary.value?.receivableBalance,
    emphasis: true,
  },
  { label: '已收金额', value: summary.value?.receivedAmount },
  { label: '其他应收', value: summary.value?.miscReceivableAmount },
]);

function formatAmount(value?: number) {
  return formatSaleAmount(value || 0, '0.00');
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

async function loadSummary(customerId?: number | string) {
  const seq = ++requestSeq;
  if (!customerId) {
    summary.value = undefined;
    loadFailed.value = false;
    loading.value = false;
    return;
  }

  loading.value = true;
  loadFailed.value = false;
  try {
    const result = await getReceivableAccountPage({
      pageNo: 1,
      pageSize: 1,
      customerId,
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
  () => props.customerId,
  (customerId) => {
    loadSummary(customerId);
  },
  { immediate: true },
);
</script>

<template>
  <div
    v-if="customerId"
    class="rounded border border-blue-100 bg-blue-50 px-4 py-3"
  >
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <span class="font-medium text-blue-700">客户应收信息</span>
      <template v-if="loading">
        <span class="text-muted-foreground">加载中...</span>
      </template>
      <template v-else-if="loadFailed">
        <span class="text-orange-600">暂无法获取</span>
      </template>
      <template v-else-if="summary">
        <span
          v-for="item in receivableItems"
          :key="item.label"
          class="inline-flex items-center gap-1"
        >
          <span class="text-muted-foreground">{{ item.label }}</span>
          <b :class="item.emphasis ? 'text-red-600' : 'text-slate-800'">
            {{ formatAmount(item.value) }}
          </b>
        </span>
        <span v-if="summary.lastBizTime" class="inline-flex items-center gap-1">
          <span class="text-muted-foreground">最近业务时间</span>
          <b class="text-slate-800">{{ formatBizDate(summary.lastBizTime) }}</b>
        </span>
      </template>
      <template v-else>
        <span class="text-muted-foreground">暂无应收记录</span>
      </template>
    </div>
  </div>
</template>
