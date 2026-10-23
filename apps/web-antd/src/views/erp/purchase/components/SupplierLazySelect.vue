<script lang="ts" setup>
import type { SupplierOption } from '#/views/erp/purchase/utils/supplier-select';
import type { DefaultOptionType, SelectValue } from 'ant-design-vue/es/select';

import { computed, ref, useAttrs, watch } from 'vue';

import { useDebounceFn } from '@vueuse/core';

import { message, Select } from 'ant-design-vue';

import {
  getSupplierSelectPage,
  SUPPLIER_SELECT_PAGE_SIZE,
} from '#/views/erp/purchase/utils/supplier-select';

defineOptions({ name: 'SupplierLazySelect', inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    allowClear?: boolean;
    disabled?: boolean;
    options?: SupplierOption[];
    pageSize?: number;
    placeholder?: string;
    popupClassName?: string;
    showSearch?: boolean;
    value?: SelectValue;
  }>(),
  {
    allowClear: true,
    disabled: false,
    options: () => [],
    pageSize: SUPPLIER_SELECT_PAGE_SIZE,
    placeholder: '请选择供应商',
    popupClassName: undefined,
    showSearch: true,
    value: undefined,
  },
);

const emit = defineEmits<{
  change: [value: SelectValue, option: DefaultOptionType | DefaultOptionType[]];
  optionsChange: [options: SupplierOption[]];
  search: [keyword: string];
  'update:value': [value: SelectValue];
  visibleChange: [open: boolean];
}>();

const attrs = useAttrs();
const loadedOptions = ref<SupplierOption[]>([]);
const loading = ref(false);
const pageNo = ref(0);
const total = ref(0);
const keyword = ref('');
const loadedOnce = ref(false);
let requestSeq = 0;
let lastEmittedOptionsSignature = '';

const hasMore = computed(() => loadedOptions.value.length < total.value);

const selectAttrs = computed(() => {
  const {
    afterFetch,
    api,
    beforeFetch,
    labelField,
    resultField,
    valueField,
    ...rest
  } = attrs as Record<string, unknown>;
  void afterFetch;
  void api;
  void beforeFetch;
  void labelField;
  void resultField;
  void valueField;
  return rest;
});

function formatOption(item: SupplierOption): SupplierOption {
  const value = item.value ?? item.id;
  const label =
    item.label ?? item.name ?? (value === undefined ? '' : `${value}`);
  return {
    ...item,
    label,
    value,
  };
}

const currentOptions = computed(() => (props.options || []).map(formatOption));

const mergedOptions = computed(() => {
  const loadedValues = new Set(
    loadedOptions.value.map((item) => String(item.value ?? item.id)),
  );
  return [
    ...currentOptions.value.filter(
      (item) => !loadedValues.has(String(item.value ?? item.id)),
    ),
    ...loadedOptions.value,
  ];
});

watch(
  mergedOptions,
  (options) => {
    const signature = options
      .map((item) =>
        JSON.stringify({
          label: item.label ?? '',
          value: item.value ?? item.id ?? '',
        }),
      )
      .join('|');
    if (signature === lastEmittedOptionsSignature) {
      return;
    }
    lastEmittedOptionsSignature = signature;
    emit('optionsChange', options);
  },
  { immediate: true },
);

async function loadPage(nextPageNo: number, append = false) {
  if (loading.value || props.disabled) {
    return;
  }
  const seq = ++requestSeq;
  loading.value = true;
  try {
    const page = await getSupplierSelectPage({
      keyword: keyword.value || undefined,
      pageNo: nextPageNo,
      pageSize: props.pageSize,
    });
    if (seq !== requestSeq) {
      return;
    }
    loadedOnce.value = true;
    pageNo.value = nextPageNo;
    total.value = Number(page?.total || 0);
    const list = page?.list || [];
    loadedOptions.value = append
      ? mergeByValue(loadedOptions.value, list)
      : list;
  } catch {
    message.warning('供应商列表加载失败，请重试');
  } finally {
    if (seq === requestSeq) {
      loading.value = false;
    }
  }
}

function mergeByValue(
  oldOptions: SupplierOption[],
  nextOptions: SupplierOption[],
) {
  const map = new Map<string, SupplierOption>();
  oldOptions.forEach((item) => map.set(String(item.value ?? item.id), item));
  nextOptions.forEach((item) => map.set(String(item.value ?? item.id), item));
  return Array.from(map.values());
}

function handleVisibleChange(open: boolean) {
  emit('visibleChange', open);
  if (open && !loadedOnce.value && !props.disabled) {
    void loadPage(1);
  }
}

function handlePopupScroll(event: Event) {
  const target = event.target as HTMLElement | null;
  if (!target || loading.value || !hasMore.value || props.disabled) {
    return;
  }
  const remaining =
    target.scrollHeight - target.scrollTop - target.clientHeight;
  if (remaining <= 24) {
    void loadPage(pageNo.value + 1, true);
  }
}

const searchSupplier = useDebounceFn((input: string) => {
  keyword.value = input.trim();
  requestSeq += 1;
  loading.value = false;
  pageNo.value = 0;
  total.value = 0;
  loadedOnce.value = false;
  void loadPage(1);
}, 300);

function handleSearch(input: string) {
  emit('search', input);
  searchSupplier(input);
}

function handleUpdateValue(value: SelectValue) {
  emit('update:value', value);
}

function handleChange(
  value: SelectValue,
  option: DefaultOptionType | DefaultOptionType[],
) {
  emit('change', value, option);
}

defineExpose({
  getOptions: () => mergedOptions.value,
  getValue: () => props.value,
  reloadOptions: () => loadPage(1),
});
</script>

<template>
  <Select
    v-bind="selectAttrs"
    :allow-clear="allowClear"
    :disabled="disabled"
    :filter-option="false"
    :loading="loading"
    :not-found-content="loading ? '加载中...' : undefined"
    option-filter-prop="label"
    :options="mergedOptions"
    :placeholder="placeholder"
    :popup-class-name="popupClassName"
    :show-search="showSearch"
    :value="value"
    @change="handleChange"
    @dropdown-visible-change="handleVisibleChange"
    @popup-scroll="handlePopupScroll"
    @search="handleSearch"
    @update:value="handleUpdateValue"
  />
</template>
