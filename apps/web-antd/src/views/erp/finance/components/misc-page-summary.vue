<script setup lang="ts">
import type { MiscPageSummary } from '../utils/misc-page-summary';

defineProps<{
  direction: 'payable' | 'receivable';
  summary: MiscPageSummary;
}>();
</script>

<template>
  <div class="misc-bottom-summary" aria-label="本页合计">
    <b>本页合计：</b>
    <span>原金额：{{ summary.amount }}</span>
    <span>
      {{ direction === 'receivable' ? '已收金额' : '已付金额' }}：{{
        summary.settledAmount
      }}
    </span>
    <span>剩余金额：{{ summary.balanceAmount }}</span>
    <span>待审批占用：{{ summary.pendingTransferAmount }}</span>
    <span>剩余可转金额：{{ summary.transferAvailableAmount }}</span>
  </div>
</template>

<style scoped>
.misc-bottom-summary {
  display: flex;
  min-height: 40px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px 14px;
  padding: 5px 8px;
  border-top: 1px solid hsl(var(--border));
  font-size: 12px;
  line-height: 18px;
}

@media (max-width: 768px) {
  .misc-bottom-summary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
