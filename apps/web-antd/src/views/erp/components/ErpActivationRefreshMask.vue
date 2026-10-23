<script lang="ts" setup>
import { Spin } from 'ant-design-vue';
</script>

<template>
  <div class="erp-activation-refresh-mask">
    <div class="erp-activation-refresh-mask__content">
      <Spin size="small" />
      <span>同步最新数据中...</span>
    </div>
  </div>
</template>

<style scoped>
.erp-activation-refresh-mask {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  background: hsl(var(--background) / 58%);
}

.erp-activation-refresh-mask__content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--card) / 92%);
  box-shadow: 0 8px 24px rgb(15 23 42 / 12%);
  color: hsl(var(--foreground));
  font-size: 13px;
  line-height: 20px;
}
</style>
