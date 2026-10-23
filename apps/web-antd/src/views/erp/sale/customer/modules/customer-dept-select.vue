<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';

import { Checkbox, Empty, message, Select, Spin } from 'ant-design-vue';

import { getCustomerFormDeptOptions } from '#/api/erp/sale/customer';

const props = defineProps<{ disabled?: boolean; value?: any[] }>();
const emit = defineEmits<{
  change: [value: number[]];
  'update:value': [value: number[]];
}>();
const departments = ref<any[]>([]);
const keyword = ref('');
const loading = ref(false);
let sequence = 0;
let loaded = false;
const selected = computed(() =>
  (props.value ?? [])
    .map((item) => Number(item?.value ?? item))
    .filter((id) => Number.isFinite(id)),
);
const options = computed(() => {
  const result = departments.value.map((dept) => ({
    label: `${dept.name}${dept.status === 0 ? '' : '（已停用）'}`,
    value: dept.id,
    disabled: dept.status !== 0,
  }));
  for (const item of props.value ?? []) {
    const id = Number(item?.value ?? item);
    if (!result.some((option) => option.value === id))
      result.push({
        label: String(item?.label ?? id),
        value: id,
        disabled: true,
      });
  }
  return result;
});
const groups = computed(() => {
  const names = new Map(departments.value.map((dept) => [dept.id, dept.name]));
  const result = new Map<string, any[]>();
  for (const dept of departments.value) {
    if (
      keyword.value &&
      !`${dept.name} ${names.get(dept.parentId) ?? ''}`.includes(keyword.value)
    )
      continue;
    const group = String(names.get(dept.parentId) ?? '部门');
    result.set(group, [...(result.get(group) ?? []), dept]);
  }
  return [...result].map(([name, children]) => ({ name, children }));
});
const selectable = computed(() =>
  groups.value
    .flatMap((group) => group.children)
    .filter((dept) => dept.status === 0)
    .map((dept) => dept.id),
);
const checked = computed(
  () =>
    selectable.value.length > 0 &&
    selectable.value.every((id) => selected.value.includes(id)),
);
const indeterminate = computed(
  () =>
    !checked.value &&
    selectable.value.some((id) => selected.value.includes(id)),
);
function update(value: any) {
  if (!Array.isArray(value)) return;
  emit('update:value', value);
  emit('change', value);
}
function toggle(id: number, enabled: boolean) {
  update(
    enabled
      ? [...new Set([...selected.value, id])]
      : selected.value.filter((item) => item !== id),
  );
}
function selectAll(enabled: boolean) {
  update(
    enabled
      ? [...new Set([...selected.value, ...selectable.value])]
      : selected.value.filter((id) => !selectable.value.includes(id)),
  );
}
async function onOpen(open: boolean) {
  if (!open || loaded || loading.value) return;
  const current = ++sequence;
  loading.value = true;
  try {
    const result = await getCustomerFormDeptOptions();
    if (current !== sequence) return;
    departments.value = result;
    loaded = true;
  } catch {
    if (current === sequence) message.error('部门加载失败，请重新打开重试');
  } finally {
    if (current === sequence) loading.value = false;
  }
}
onBeforeUnmount(() => {
  sequence += 1;
});
</script>

<template>
  <Select
    :value="selected"
    :options="options"
    :disabled="disabled"
    mode="multiple"
    class="w-full"
    :max-tag-count="2"
    :filter-option="false"
    show-search
    placeholder="请选择适用部门"
    popup-class-name="erp-candidate-focus-popup"
    @search="keyword = $event"
    @change="update"
    @dropdown-visible-change="onOpen"
  >
    <template #dropdownRender>
      <Spin :spinning="loading">
        <div class="max-h-72 overflow-auto p-2" @mousedown.prevent>
          <Checkbox
            :disabled="!loaded || disabled || selectable.length === 0"
            :checked="checked"
            :indeterminate="indeterminate"
            @change="selectAll($event.target.checked)"
          >
            全选可选部门
          </Checkbox>
          <section v-for="group in groups" :key="group.name" class="mt-2">
            <div class="mb-1 text-xs text-gray-500">{{ group.name }}</div>
            <div class="grid grid-cols-2 gap-2">
              <Checkbox
                v-for="dept in group.children"
                :key="dept.id"
                :checked="selected.includes(dept.id)"
                :disabled="disabled || dept.status !== 0"
                @change="toggle(dept.id, $event.target.checked)"
              >
                {{ dept.name }}{{ dept.status === 0 ? '' : '（已停用）' }}
              </Checkbox>
            </div>
          </section>
          <Empty
            v-if="!loading && groups.length === 0"
            :image="Empty.PRESENTED_IMAGE_SIMPLE"
          />
        </div>
      </Spin>
    </template>
  </Select>
</template>
