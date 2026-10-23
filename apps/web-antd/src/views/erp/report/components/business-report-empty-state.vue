<script setup lang="ts">
withDefaults(
  defineProps<{
    description?: string;
    status?: 'NO_DATA' | 'NO_PERMISSION' | 'PENDING_INTERFACE' | 'PENDING_RULE';
    title?: string;
  }>(),
  {
    description: '当前页面结构已准备，等待真实接口、权限或规则确认后展示数据。',
    status: 'NO_DATA',
    title: '暂无可展示数据',
  },
);
</script>

<template>
  <div class="erp-business-report-empty" :data-status="status">
    <span class="erp-business-report-empty__icon">📊</span>
    <strong>{{ title }}</strong>
    <p>{{ description }}</p>
  </div>
</template>

<style scoped>
.erp-business-report-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 6px;
  min-height: 180px;
  padding: 28px;
  color: #64748b;
  background: #f8fbff;
  border: 1px dashed #bfd0e8;
  border-radius: 12px;
  text-align: center;
}

.erp-business-report-empty__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: #eaf2ff;
  border-radius: 999px;
  font-size: 22px;
}

.erp-business-report-empty strong {
  color: #173461;
  font-size: 15px;
}

.erp-business-report-empty p {
  max-width: 560px;
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
}
</style>
