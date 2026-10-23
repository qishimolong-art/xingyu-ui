<script lang="ts" setup>
interface SummaryEntry {
  emphasized?: boolean;
  hidden?: boolean;
  label: string;
  value?: null | number | string;
}

withDefaults(
  defineProps<{
    entries: SummaryEntry[];
    inset?: boolean;
    title?: string;
  }>(),
  {
    inset: false,
    title: '单据汇总',
  },
);
</script>

<template>
  <div
    :class="{ 'erp-document-summary-bar--inset': inset }"
    class="erp-document-summary-bar"
  >
    <strong>{{ title }}</strong>
    <template v-for="entry in entries" :key="entry.label">
      <span
        v-if="!entry.hidden"
        :class="{ 'erp-document-summary-bar__emphasized': entry.emphasized }"
      >
        {{ entry.label }}：<b>{{ entry.value ?? '-' }}</b>
      </span>
    </template>
  </div>
</template>

<style scoped>
.erp-document-summary-bar {
  display: flex;
  min-height: 44px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px 20px;
  padding: 8px 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 20%);
  border-top: 1px solid hsl(var(--border));
}

.erp-document-summary-bar--inset {
  margin: 0 -12px -12px;
}

.erp-document-summary-bar strong {
  margin-right: auto;
  color: hsl(var(--foreground));
}

.erp-document-summary-bar b {
  margin-left: 5px;
  color: hsl(var(--foreground));
  font-variant-numeric: tabular-nums;
}

.erp-document-summary-bar__emphasized b {
  color: hsl(var(--primary));
}

@media (max-width: 768px) {
  .erp-document-summary-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .erp-document-summary-bar strong {
    margin-right: 0;
  }
}
</style>
