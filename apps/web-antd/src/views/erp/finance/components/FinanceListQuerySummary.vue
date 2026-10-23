<script setup lang="ts">
export interface QuerySummaryItem {
  key: string;
  label: string;
  value: string;
}

defineProps<{
  error?: boolean;
  items: QuerySummaryItem[];
  loading?: boolean;
}>();

defineEmits<{ retry: [] }>();
</script>

<template>
  <div class="finance-query-summary">
    <b class="finance-query-summary__title">查询汇总</b>
    <div v-if="loading" class="finance-query-summary__state">汇总加载中...</div>
    <div
      v-else-if="error"
      class="finance-query-summary__state finance-query-summary__state--error"
    >
      <span>汇总加载失败</span>
      <a-button size="small" type="link" @click="$emit('retry')">
        重新加载
      </a-button>
    </div>
    <div v-else class="finance-query-summary__items">
      <span v-for="item in items" :key="item.key">
        {{ item.label }}：<strong>{{ item.value }}</strong>
      </span>
    </div>
  </div>
</template>

<style scoped>
.finance-query-summary {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 8px 20px;
  padding: 8px 12px;
  border-top: 1px solid var(--el-border-color-lighter, #e5e7eb);
  background: var(--el-fill-color-light, #fafafa);
}
.finance-query-summary__title {
  flex: none;
}
.finance-query-summary__items {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px 20px;
  font-variant-numeric: tabular-nums;
}
.finance-query-summary__state {
  margin-left: auto;
  color: #8c8c8c;
}
.finance-query-summary__state--error {
  display: flex;
  align-items: center;
  color: #ff4d4f;
}
@media (max-width: 768px) {
  .finance-query-summary {
    align-items: flex-start;
    flex-direction: column;
  }
  .finance-query-summary__items {
    justify-content: flex-start;
  }
  .finance-query-summary__state {
    margin-left: 0;
  }
}
</style>
