<script lang="ts" setup>
import { computed } from 'vue';

import ErpDocumentSummaryBar from '#/views/erp/components/ErpDocumentSummaryBar.vue';
import { stockNatural as erpCountInputFormatter } from '#/views/erp/stock/utils/stock-decimal';

import { formatStockNaturalNumber } from '../utils/document-number';

interface SummaryEntry {
  emphasized?: boolean;
  format?: 'count' | 'price' | 'weight';
  hidden?: boolean;
  label: string;
  value?: null | number | string;
}

const props = defineProps<{
  entries: SummaryEntry[];
  naturalNumbers?: boolean;
}>();

function formatValue(entry: SummaryEntry) {
  if (entry.value === '****') return '****';
  if (entry.value === null || entry.value === undefined) return '-';
  if (entry.format === 'price') {
    return `¥${formatStockNaturalNumber(entry.value)}`;
  }
  return props.naturalNumbers
    ? formatStockNaturalNumber(entry.value)
    : erpCountInputFormatter(entry.value);
}

const formattedEntries = computed(() =>
  props.entries.map((entry) => ({
    emphasized: entry.emphasized,
    hidden: entry.hidden,
    label: entry.label,
    value: formatValue(entry),
  })),
);
</script>

<template>
  <ErpDocumentSummaryBar :entries="formattedEntries" inset />
</template>
