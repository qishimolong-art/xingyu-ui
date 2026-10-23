<script lang="ts" setup>
import { computed } from 'vue';

import { formatPurchaseAmount, formatPurchaseDecimal } from '../utils/decimal';

import ErpDocumentSummaryBar from '#/views/erp/components/ErpDocumentSummaryBar.vue';

type PurchaseDocumentSummaryItem = {
  emphasis?: boolean;
  kind?: 'amount' | 'count' | 'percent' | 'text';
  label: string;
  value?: number | string;
};

const props = withDefaults(
  defineProps<{
    items?: PurchaseDocumentSummaryItem[];
  }>(),
  {
    items: () => [],
  },
);

function formatValue(item: PurchaseDocumentSummaryItem) {
  if (item.value === '****') {
    return '****';
  }
  if (item.kind === 'amount') {
    return formatPurchaseAmount(item.value, '0.00');
  }
  if (item.kind === 'count') {
    return formatPurchaseDecimal(item.value || 0, '0');
  }
  if (item.kind === 'percent') {
    return `${formatPurchaseDecimal(item.value || 0, '0')}%`;
  }
  return item.value ?? '-';
}

const entries = computed(() =>
  props.items.map((item) => ({
    emphasized: item.emphasis,
    label: item.label,
    value: formatValue(item),
  })),
);
</script>

<template>
  <ErpDocumentSummaryBar :entries="entries" />
</template>
