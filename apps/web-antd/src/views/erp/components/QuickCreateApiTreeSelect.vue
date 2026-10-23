<script lang="ts" setup>
import { computed, h, ref, useAttrs, useSlots } from 'vue';

import { ApiComponent } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, Divider, TreeSelect } from 'ant-design-vue';

defineOptions({ name: 'QuickCreateApiTreeSelect', inheritAttrs: false });

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
const apiTreeSelectRef = ref<InstanceType<typeof ApiComponent>>();
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

function renderDropdown({ menuNode }: { menuNode: any }) {
  if (!showQuickCreate.value) {
    return menuNode;
  }
  return h('div', [
    h(
      'div',
      {
        class: 'quick-create-api-tree-select__header',
        onMousedown: (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
        },
      },
      [
        h(
          'span',
          { class: 'quick-create-api-tree-select__title' },
          props.quickCreateTitle,
        ),
        h(
          Button,
          {
            class: 'quick-create-api-tree-select__button',
            size: 'small',
            type: 'link',
            onClick: handleQuickCreate,
            onMousedown: (event: MouseEvent) => {
              event.preventDefault();
              event.stopPropagation();
            },
          },
          {
            default: () => props.quickCreateText,
            icon: () =>
              h(IconifyIcon, {
                class: 'size-4',
                icon: 'ant-design:plus-outlined',
              }),
          },
        ),
      ],
    ),
    h(Divider, { class: 'quick-create-api-tree-select__divider' }),
    menuNode,
  ]);
}

function handleQuickCreate(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  props.onQuickCreate?.();
}

function reloadOptions() {
  reloadToken.value = Date.now();
}

defineExpose({
  getOptions: () => apiTreeSelectRef.value?.getOptions?.(),
  getValue: () => apiTreeSelectRef.value?.getValue?.(),
  reloadOptions,
});
</script>

<template>
  <ApiComponent
    ref="apiTreeSelectRef"
    v-bind="attrs"
    :component="TreeSelect"
    :disabled="disabled"
    :dropdown-render="renderDropdown"
    :field-names="{ label: 'label', value: 'value', children: 'children' }"
    loading-slot="suffixIcon"
    model-prop-name="value"
    options-prop-name="treeData"
    :params="mergedParams"
    tree-node-filter-prop="label"
    visible-event="onVisibleChange"
  >
    <template
      v-for="name in forwardedSlotNames"
      :key="name"
      #[name]="slotProps"
    >
      <slot :name="name" v-bind="slotProps || {}"></slot>
    </template>
  </ApiComponent>
</template>

<style scoped>
.quick-create-api-tree-select__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px 4px;
}

.quick-create-api-tree-select__title {
  min-width: 0;
  overflow: hidden;
  color: rgb(107 114 128);
  font-size: 12px;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-create-api-tree-select__button {
  flex: 0 0 auto;
  padding-inline: 4px;
}

.quick-create-api-tree-select__divider {
  margin: 4px 0;
}
</style>
