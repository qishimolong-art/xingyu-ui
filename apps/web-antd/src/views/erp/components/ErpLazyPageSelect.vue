<script lang="ts" setup>
import type { DefaultOptionType, SelectValue } from 'ant-design-vue/es/select';

import { computed, ref, useAttrs, watch } from 'vue';

import { useDebounceFn } from '@vueuse/core';

import { message, Select } from 'ant-design-vue';

type PageSelectApi = (params: {
  keyword?: string;
  pageNo: number;
  pageSize: number;
  [key: string]: any;
}) => Promise<{ list?: Record<string, any>[]; total?: number }>;

type PageSelectOption = Record<string, any> & {
  label?: string;
  value?: number | string;
};

defineOptions({ name: 'ErpLazyPageSelect', inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    allowClear?: boolean;
    api: PageSelectApi;
    disabled?: boolean;
    labelField?: string;
    loadErrorMessage?: string;
    options?: PageSelectOption[];
    pageSize?: number;
    params?: Record<string, any>;
    placeholder?: string;
    popupClassName?: string;
    showSearch?: boolean;
    shouldFetch?: (params: Record<string, any>) => boolean;
    value?: SelectValue;
    valueField?: string;
  }>(),
  {
    allowClear: true,
    disabled: false,
    labelField: 'label',
    loadErrorMessage: '选项加载失败，请重试',
    options: () => [],
    pageSize: 10,
    params: () => ({}),
    placeholder: '请选择',
    popupClassName: undefined,
    showSearch: true,
    shouldFetch: undefined,
    value: undefined,
    valueField: 'value',
  },
);

const emit = defineEmits<{
  change: [value: SelectValue, option: DefaultOptionType | DefaultOptionType[]];
  optionsChange: [options: PageSelectOption[]];
  search: [keyword: string];
  'update:value': [value: SelectValue];
  visibleChange: [open: boolean];
}>();

const attrs = useAttrs();
const loadedOptions = ref<PageSelectOption[]>([]);
const loading = ref(false);
const pageNo = ref(0);
const total = ref(0);
const keyword = ref('');
const runtimeParams = ref<Record<string, any>>({});
const loadedOnce = ref(false);
let requestSeq = 0;
let lastEmittedOptionsSignature = '';

const hasMore = computed(() => loadedOptions.value.length < total.value);

const selectAttrs = computed(() => {
  const {
    api,
    labelField,
    loadErrorMessage,
    options,
    pageSize,
    params,
    shouldFetch,
    valueField,
    ...rest
  } = attrs as Record<string, unknown>;
  void api;
  void labelField;
  void loadErrorMessage;
  void options;
  void pageSize;
  void params;
  void shouldFetch;
  void valueField;
  return rest;
});

function formatOption(item: Record<string, any>): PageSelectOption {
  const value = item.value ?? item[props.valueField] ?? item.id;
  const label =
    item.label ??
    item[props.labelField] ??
    item.name ??
    item.nickname ??
    item.username ??
    value ??
    '';
  return {
    ...item,
    label,
    value,
  };
}

const currentOptions = computed(() => (props.options || []).map(formatOption));

const mergedOptions = computed(() => {
  const loadedValues = new Set(
    loadedOptions.value.map((item) =>
      String(item.value ?? item[props.valueField]),
    ),
  );
  return [
    ...currentOptions.value.filter(
      (item) => !loadedValues.has(String(item.value ?? item[props.valueField])),
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
          value: item.value ?? '',
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

function mergeByValue(
  oldOptions: PageSelectOption[],
  nextOptions: PageSelectOption[],
) {
  const map = new Map<string, PageSelectOption>();
  oldOptions.forEach((item) => map.set(String(item.value), item));
  nextOptions.forEach((item) => map.set(String(item.value), item));
  return Array.from(map.values());
}

function resetLoadedState() {
  requestSeq += 1;
  loading.value = false;
  pageNo.value = 0;
  total.value = 0;
  loadedOnce.value = false;
  loadedOptions.value = [];
}

async function loadPage(nextPageNo: number, append = false) {
  if (loading.value || props.disabled) {
    return;
  }
  const apiParams = {
    ...props.params,
    ...runtimeParams.value,
    keyword: keyword.value || undefined,
    pageNo: nextPageNo,
    pageSize: props.pageSize,
  };
  if (props.shouldFetch && !props.shouldFetch(apiParams)) {
    loadedOptions.value = [];
    total.value = 0;
    loadedOnce.value = true;
    return;
  }
  const seq = ++requestSeq;
  loading.value = true;
  try {
    const page = await props.api(apiParams);
    if (seq !== requestSeq) {
      return;
    }
    loadedOnce.value = true;
    pageNo.value = nextPageNo;
    total.value = Number(page?.total || 0);
    const list = (page?.list || []).map(formatOption);
    loadedOptions.value = append
      ? mergeByValue(loadedOptions.value, list)
      : list;
  } catch {
    message.warning(props.loadErrorMessage);
  } finally {
    if (seq === requestSeq) {
      loading.value = false;
    }
  }
}

function handleVisibleChange(open: boolean) {
  emit('visibleChange', open);
  if (open && !loadedOnce.value) {
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

const searchOptions = useDebounceFn((input: string) => {
  keyword.value = input.trim();
  resetLoadedState();
  void loadPage(1);
}, 300);

function handleSearch(input: string) {
  emit('search', input);
  searchOptions(input);
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

watch(
  () => JSON.stringify(props.params || {}),
  () => {
    runtimeParams.value = {};
    resetLoadedState();
  },
);

defineExpose({
  getOptions: () => mergedOptions.value,
  getValue: () => props.value,
  reloadOptions: () => loadPage(1),
  updateParam: (params: Record<string, any>) => {
    runtimeParams.value = params || {};
    resetLoadedState();
  },
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
