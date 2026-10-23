<script lang="ts" setup>
import type { ErpPrintApi } from '#/api/erp/print';

import { computed } from 'vue';

import { Modal as AntModal, Radio, RadioGroup, Tag } from 'ant-design-vue';

const props = defineProps<{
  open: boolean;
  selectedId?: number | string;
  templates: ErpPrintApi.Template[];
}>();

const emit = defineEmits<{
  cancel: [];
  confirm: [];
  'update:open': [value: boolean];
  'update:selectedId': [value: number | string | undefined];
}>();

const selectedValue = computed({
  get: () => props.selectedId,
  set: (value) => emit('update:selectedId', value),
});

function formatTime(value?: Date | string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', { hour12: false });
}
</script>

<template>
  <AntModal
    :open="open"
    title="选择打印模板"
    :ok-button-props="{ disabled: !selectedId }"
    @cancel="emit('cancel')"
    @ok="emit('confirm')"
    @update:open="emit('update:open', $event)"
  >
    <RadioGroup
      v-model:value="selectedValue"
      class="purchase-print-template-select"
    >
      <Radio
        v-for="template in templates"
        :key="template.id"
        :value="template.id"
        class="purchase-print-template-option"
      >
        <span class="purchase-print-template-option__name">
          {{ template.name || '未命名模板' }}
        </span>
        <Tag v-if="template.defaulted" color="blue">默认</Tag>
        <span class="purchase-print-template-option__time">
          {{ formatTime(template.updateTime) }}
        </span>
      </Radio>
    </RadioGroup>
  </AntModal>
</template>

<style scoped>
.purchase-print-template-select {
  display: grid;
  gap: 8px;
  width: 100%;
}

.purchase-print-template-option {
  display: flex;
  width: 100%;
  min-height: 40px;
  align-items: center;
  gap: 8px;
  margin-inline-end: 0;
  padding: 6px 8px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.purchase-print-template-option__name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.purchase-print-template-option__time {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}
</style>
