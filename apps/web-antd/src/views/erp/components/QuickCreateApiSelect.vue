<script lang="ts" setup>
import { computed, ref, useAttrs, useSlots } from 'vue';

import { ApiComponent } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, Divider, Select } from 'ant-design-vue';

defineOptions({ name: 'QuickCreateApiSelect', inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    canQuickCreate?: boolean;
    disabled?: boolean;
    onQuickCreate?: () => void;
    quickCreateText?: string;
    quickCreateTitle?: string;
  }>(),
  {
    canQuickCreate: true,
    disabled: false,
    onQuickCreate: undefined,
    quickCreateText: '新增',
    quickCreateTitle: '可选项',
  },
);

const attrs = useAttrs();
const slots = useSlots();
const apiSelectRef = ref<InstanceType<typeof ApiComponent>>();
const reloadToken = ref(0);

const forwardedSlotNames = computed(() =>
  Object.keys(slots).filter((name) => name !== 'dropdownRender'),
);

const mergedParams = computed(() => ({
  ...(attrs.params as Record<string, any> | undefined),
  __quickCreateReloadAt: reloadToken.value,
}));

const showQuickCreate = computed(
  () => props.canQuickCreate && !props.disabled && Boolean(props.onQuickCreate),
);

function handleQuickCreate(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  props.onQuickCreate?.();
}

function reloadOptions() {
  reloadToken.value = Date.now();
}

defineExpose({
  getOptions: () => apiSelectRef.value?.getOptions?.(),
  getValue: () => apiSelectRef.value?.getValue?.(),
  reloadOptions,
});
</script>

<template>
  <ApiComponent
    ref="apiSelectRef"
    v-bind="attrs"
    :component="Select"
    :disabled="disabled"
    loading-slot="suffixIcon"
    model-prop-name="value"
    option-filter-prop="label"
    :params="mergedParams"
    visible-event="onVisibleChange"
  >
    <template
      v-for="name in forwardedSlotNames"
      :key="name"
      #[name]="slotProps"
    >
      <slot :name="name" v-bind="slotProps || {}"></slot>
    </template>

    <template #dropdownRender="{ menuNode }">
      <div
        v-if="showQuickCreate"
        class="quick-create-api-select__header"
        @mousedown.prevent.stop
      >
        <span class="quick-create-api-select__title">
          {{ quickCreateTitle }}
        </span>
        <Button
          class="quick-create-api-select__button"
          size="small"
          type="link"
          @click="handleQuickCreate"
          @mousedown.prevent.stop
        >
          <template #icon>
            <IconifyIcon class="size-4" icon="ant-design:plus-outlined" />
          </template>
          {{ quickCreateText }}
        </Button>
      </div>
      <Divider
        v-if="showQuickCreate"
        class="quick-create-api-select__divider"
      />
      <component :is="menuNode" />
    </template>
  </ApiComponent>
</template>

<style scoped>
.quick-create-api-select__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px 4px;
}

.quick-create-api-select__title {
  min-width: 0;
  overflow: hidden;
  color: rgb(107 114 128);
  font-size: 12px;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-create-api-select__button {
  flex: 0 0 auto;
  padding-inline: 4px;
}

.quick-create-api-select__divider {
  margin: 4px 0;
}
</style>
