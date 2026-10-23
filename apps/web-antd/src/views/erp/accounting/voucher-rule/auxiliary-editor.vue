<script setup lang="ts">
import { reactive } from 'vue';
import { Button, Select } from 'ant-design-vue';
import type { Auxiliary } from '#/api/erp/finance/accounting/voucher-rule';
import {
  AUX_LABELS,
  getAuxiliaryOptions,
} from '#/api/erp/finance/accounting/voucher-rule';
const props = withDefaults(
  defineProps<{
    modelValue?: Auxiliary[];
    disabled?: boolean;
    legacyName?: string;
  }>(),
  { modelValue: () => [], disabled: false },
);
const emit = defineEmits<{ 'update:modelValue': [Auxiliary[]] }>();
const options = reactive<Record<string, Auxiliary[]>>({});
async function load(type: string) {
  if (!options[type]) options[type] = await getAuxiliaryOptions(type);
}
function change(index: number, patch: Partial<Auxiliary>) {
  const list = props.modelValue.map((a, i) =>
    i === index ? { ...a, ...patch } : a,
  );
  emit('update:modelValue', list);
}
function add() {
  const type = Object.keys(AUX_LABELS).find(
    (t) => !props.modelValue.some((a) => a.type === t),
  );
  if (type) {
    emit('update:modelValue', [...props.modelValue, { type }]);
    void load(type);
  }
}
</script>
<template>
  <span v-if="disabled">{{
    modelValue.length
      ? modelValue
          .map((a) => `${AUX_LABELS[a.type]}：${a.name || a.id || '未选择'}`)
          .join(' / ')
      : legacyName || '—'
  }}</span>
  <div v-else>
    <div
      v-for="(a, i) in modelValue"
      :key="i"
      class="mb-1 flex items-center gap-1"
    >
      <Select
        :value="a.type"
        class="w-24"
        :options="
          Object.entries(AUX_LABELS).map(([value, label]) => ({ value, label }))
        "
        @change="
          (value) => {
            change(i, { type: String(value), id: undefined, name: undefined });
            load(String(value));
          }
        "
      />
      <Select
        :value="a.id"
        class="w-52"
        show-search
        option-filter-prop="label"
        :options="
          (options[a.type] || (a.id ? [a] : [])).map((o) => ({
            value: o.id,
            label: o.name || String(o.id),
          }))
        "
        @dropdown-visible-change="(open) => open && load(a.type)"
        @change="
          (value) =>
            change(i, {
              id: Number(value),
              name: options[a.type]?.find((o) => o.id === Number(value))?.name,
            })
        "
      />
      <Button
        type="link"
        danger
        @click="
          emit(
            'update:modelValue',
            modelValue.filter((_, j) => j !== i),
          )
        "
        >移除</Button
      >
    </div>
    <Button v-if="modelValue.length < 5" size="small" @click="add"
      >添加辅助核算</Button
    >
    <span v-if="!modelValue.length && legacyName" class="ml-2 text-gray-500"
      >历史信息：{{ legacyName }}</span
    >
  </div>
</template>
