<script lang="ts" setup generic="T extends Record<string, any>">
import { computed } from 'vue';

import { buildErpItemSummary, type ErpSummaryField } from './erpItemSummary';

const SUMMARY_TITLE = '\u5408\u8ba1';

const props = withDefaults(
  defineProps<{
    fields: ErpSummaryField<T>[];
    rows?: T[];
    title?: string;
  }>(),
  {
    rows: () => [],
    title: SUMMARY_TITLE,
  },
);

const summaryItems = computed(() =>
  buildErpItemSummary(props.rows || [], props.fields || []),
);
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-6 gap-y-2 py-2 text-sm">
    <span class="font-medium text-gray-700 dark:text-gray-200">{{
      title
    }}</span>
    <span
      v-for="item in summaryItems"
      :key="String(item.field)"
      class="inline-flex items-center gap-1"
    >
      <span class="text-gray-500">{{ item.label }}:</span>
      <span class="font-medium text-gray-900 dark:text-gray-100">
        {{ item.value }}
      </span>
    </span>
  </div>
</template>
