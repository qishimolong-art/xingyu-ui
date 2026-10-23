<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { useDebounceFn } from '@vueuse/core';

import {
  Alert,
  Form as AForm,
  FormItem,
  message,
  Select,
} from 'ant-design-vue';
import type { DefaultOptionType, SelectValue } from 'ant-design-vue/es/select';

interface ArchiveOption {
  id?: number;
  code?: string;
  contact?: string;
  memberCode?: string;
  mobile?: string;
  name?: string;
  pinyinCode?: string;
  platformCode?: string;
  shortName?: string;
  telephone?: string;
  wubiCode?: string;
}

interface ModalData {
  title: string;
  archiveName: string;
  loadOptions: () => Promise<ArchiveOption[]>;
  loadPage?: (params: {
    keyword?: string;
    pageNo: number;
    pageSize?: number;
  }) => Promise<{ list?: ArchiveOption[]; total?: number }>;
  mergeApi: (data: { keepId: number; sourceId: number }) => Promise<unknown>;
}

const emit = defineEmits<{
  success: [];
}>();

const modalTitle = ref('');
const archiveName = ref('');
const loading = ref(false);
const options = ref<
  Array<ArchiveOption & { label: string; searchText: string; value: number }>
>([]);
const selectedOptions = ref<
  Array<ArchiveOption & { label: string; searchText: string; value: number }>
>([]);
const formData = ref<{ keepId?: number; sourceId?: number }>({});
const pageNo = ref(0);
const total = ref(0);
const keyword = ref('');
const loadedOnce = ref(false);
let mergeApi: ModalData['mergeApi'] | undefined;
let loadPageApi: ModalData['loadPage'] | undefined;
let requestSeq = 0;

const selectedConflict = computed(
  () =>
    formData.value.sourceId !== undefined &&
    formData.value.sourceId === formData.value.keepId,
);
const hasMore = computed(() => options.value.length < total.value);
const displayOptions = computed(() => {
  const values = new Set(options.value.map((item) => String(item.value)));
  return [
    ...selectedOptions.value.filter((item) => !values.has(String(item.value))),
    ...options.value,
  ];
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (!formData.value.sourceId || !formData.value.keepId) {
      message.warning('请选择被合并数据和保留数据');
      return;
    }
    if (selectedConflict.value) {
      message.warning('被合并数据和保留数据不能相同');
      return;
    }
    if (!mergeApi) {
      return;
    }
    modalApi.lock();
    try {
      await mergeApi({
        sourceId: formData.value.sourceId,
        keepId: formData.value.keepId,
      });
      message.success('合并成功');
      await modalApi.close();
      emit('success');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      formData.value = {};
      options.value = [];
      selectedOptions.value = [];
      pageNo.value = 0;
      total.value = 0;
      keyword.value = '';
      loadedOnce.value = false;
      mergeApi = undefined;
      loadPageApi = undefined;
      return;
    }
    const data = modalApi.getData<ModalData>();
    modalTitle.value = data.title;
    archiveName.value = data.archiveName;
    mergeApi = data.mergeApi;
    loadPageApi = data.loadPage;
    if (!loadPageApi) {
      await loadArchiveOptions(data.loadOptions);
    }
  },
});

function formatArchiveOption(item: ArchiveOption) {
  const label =
    [item.code, item.name].filter(Boolean).join(' - ') || String(item.id);
  return {
    ...item,
    label,
    searchText: [
      item.code,
      item.name,
      item.shortName,
      item.contact,
      item.mobile,
      item.telephone,
      item.pinyinCode,
      item.wubiCode,
      item.memberCode,
      item.platformCode,
      item.id,
    ]
      .filter(Boolean)
      .join(' '),
    value: item.id!,
  };
}

async function loadArchiveOptions(loader: ModalData['loadOptions']) {
  loading.value = true;
  try {
    const list = await loader();
    options.value = (list || [])
      .filter((item) => item.id !== undefined)
      .map(formatArchiveOption);
  } finally {
    loading.value = false;
  }
}

async function loadArchivePage(nextPageNo: number, append = false) {
  if (!loadPageApi || loading.value) {
    return;
  }
  const seq = ++requestSeq;
  loading.value = true;
  try {
    const page = await loadPageApi({
      keyword: keyword.value || undefined,
      pageNo: nextPageNo,
      pageSize: 10,
    });
    if (seq !== requestSeq) {
      return;
    }
    loadedOnce.value = true;
    pageNo.value = nextPageNo;
    total.value = Number(page?.total || 0);
    const list = (page?.list || [])
      .filter((item) => item.id !== undefined)
      .map(formatArchiveOption);
    options.value = append ? mergeOptions(options.value, list) : list;
  } catch {
    message.warning(`${archiveName.value || '档案'}列表加载失败，请重试`);
  } finally {
    if (seq === requestSeq) {
      loading.value = false;
    }
  }
}

function mergeOptions(
  oldOptions: Array<
    ArchiveOption & { label: string; searchText: string; value: number }
  >,
  nextOptions: Array<
    ArchiveOption & { label: string; searchText: string; value: number }
  >,
) {
  const map = new Map<
    string,
    ArchiveOption & { label: string; searchText: string; value: number }
  >();
  oldOptions.forEach((item) => map.set(String(item.value), item));
  nextOptions.forEach((item) => map.set(String(item.value), item));
  return Array.from(map.values());
}

function handleDropdownVisibleChange(open: boolean) {
  if (open && loadPageApi && !loadedOnce.value) {
    void loadArchivePage(1);
  }
}

function handlePopupScroll(event: Event) {
  const target = event.target as HTMLElement | null;
  if (!target || !loadPageApi || loading.value || !hasMore.value) {
    return;
  }
  const remaining =
    target.scrollHeight - target.scrollTop - target.clientHeight;
  if (remaining <= 24) {
    void loadArchivePage(pageNo.value + 1, true);
  }
}

const searchArchiveOptions = useDebounceFn((input: string) => {
  if (!loadPageApi) {
    return;
  }
  keyword.value = input.trim();
  requestSeq += 1;
  loading.value = false;
  pageNo.value = 0;
  total.value = 0;
  loadedOnce.value = false;
  void loadArchivePage(1);
}, 300);

function handleSearch(input: string) {
  searchArchiveOptions(input);
}

function handleSelectChange(
  value: SelectValue,
  option: DefaultOptionType | DefaultOptionType[],
) {
  const currentValue =
    value === undefined || value === null || value === ''
      ? undefined
      : Number(value);
  if (!currentValue) {
    selectedOptions.value = selectedOptions.value.filter(
      (item) =>
        item.value === formData.value.sourceId ||
        item.value === formData.value.keepId,
    );
    return;
  }
  const selected = (Array.isArray(option) ? option[0] : option) as
    | (ArchiveOption & { label: string; searchText: string; value: number })
    | undefined;
  if (selected) {
    selectedOptions.value = mergeOptions(selectedOptions.value, [selected]);
  }
}

function filterSelectOption(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  const text = String(option?.searchText ?? option?.label ?? '');
  return text.toLowerCase().includes(keyword);
}
</script>

<template>
  <Modal :title="modalTitle || `合并${archiveName}`" class="w-[560px]">
    <div class="px-4 py-3">
      <Alert
        class="mb-4"
        type="warning"
        show-icon
        :message="`合并后，被合并${archiveName}将不再显示，相关单据会替换为保留${archiveName}。`"
      />
      <AForm :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <FormItem label="被合并数据" required>
          <Select
            v-model:value="formData.sourceId"
            :filter-option="loadPageApi ? false : filterSelectOption"
            :loading="loading"
            :options="displayOptions"
            allow-clear
            show-search
            placeholder="请选择被合并数据"
            @change="handleSelectChange"
            @dropdown-visible-change="handleDropdownVisibleChange"
            @popup-scroll="handlePopupScroll"
            @search="handleSearch"
          />
        </FormItem>
        <FormItem label="保留数据" required>
          <Select
            v-model:value="formData.keepId"
            :filter-option="loadPageApi ? false : filterSelectOption"
            :loading="loading"
            :options="displayOptions"
            allow-clear
            show-search
            placeholder="请选择保留数据"
            @change="handleSelectChange"
            @dropdown-visible-change="handleDropdownVisibleChange"
            @popup-scroll="handlePopupScroll"
            @search="handleSearch"
          />
        </FormItem>
      </AForm>
    </div>
  </Modal>
</template>
