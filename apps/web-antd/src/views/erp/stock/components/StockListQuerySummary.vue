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
  <div class="stock-query-summary">
    <b class="stock-query-summary__title">查询汇总</b>
    <div v-if="loading" class="stock-query-summary__state">汇总加载中...</div>
    <div
      v-else-if="error"
      class="stock-query-summary__state stock-query-summary__state--error"
    >
      <span>汇总加载失败</span>
      <a-button size="small" type="link" @click="$emit('retry')">
        重新加载
      </a-button>
    </div>
    <div v-else class="stock-query-summary__items">
      <span v-for="item in items" :key="item.key">
        {{ item.label }}：<strong>{{ item.value }}</strong>
      </span>
    </div>
  </div>
</template>

<style scoped>
.stock-query-summary {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 8px 20px;
  padding: 8px 12px;
  border-top: 1px solid var(--el-border-color-lighter, #e5e7eb);
  background: var(--el-fill-color-light, #fafafa);
}
.stock-query-summary__title {
  flex: none;
}
.stock-query-summary__items {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px 20px;
  font-variant-numeric: tabular-nums;
}
.stock-query-summary__state {
  margin-left: auto;
  color: #8c8c8c;
}
.stock-query-summary__state--error {
  display: flex;
  align-items: center;
  color: #ff4d4f;
}
@media (max-width: 768px) {
  .stock-query-summary {
    align-items: flex-start;
    flex-direction: column;
  }
  .stock-query-summary__items {
    justify-content: flex-start;
  }
  .stock-query-summary__state {
    margin-left: 0;
  }
}
</style>
