<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, Checkbox, Input, message, Spin } from 'ant-design-vue';

const emit = defineEmits<{
  confirm: [fields: string[]];
}>();

const CheckboxGroup = Checkbox.Group;

interface ExportField {
  field: string;
  label: string;
  group?: string;
  groupLabel?: string;
  required?: boolean;
  sort?: number;
}

interface ModalData {
  preserveDecimalPrecision?: boolean;
  loadFields: () => Promise<ExportField[]>;
  moduleKey: string;
}

const fields = ref<ExportField[]>([]);
const checkedFields = ref<string[]>([]);
const keyword = ref('');
const loading = ref(false);
const moduleKey = ref('');
const preserveDecimalPrecision = ref(false);

const storageKey = computed(() =>
  moduleKey.value ? `erp_export_fields:${moduleKey.value}` : '',
);

const filteredGroups = computed(() => {
  const text = keyword.value.trim().toLowerCase();
  const groups = new Map<
    string,
    { group: string; groupLabel: string; items: ExportField[] }
  >();
  for (const field of fields.value) {
    if (
      text &&
      !field.label.toLowerCase().includes(text) &&
      !field.field.toLowerCase().includes(text)
    ) {
      continue;
    }
    const group = field.group || 'other';
    if (!groups.has(group)) {
      groups.set(group, {
        group,
        groupLabel: field.groupLabel || '其他信息',
        items: [],
      });
    }
    groups.get(group)!.items.push(field);
  }
  return [...groups.values()];
});

const checkedCountText = computed(
  () => `已选 ${checkedFields.value.length}/${fields.value.length}`,
);

const allFieldKeys = computed(() => fields.value.map((item) => item.field));

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (checkedFields.value.length === 0) {
      message.warning('请至少选择一个导出字段');
      return;
    }
    saveCheckedFields();
    emit('confirm', checkedFields.value);
    await modalApi.close();
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      fields.value = [];
      checkedFields.value = [];
      keyword.value = '';
      return;
    }
    const data = modalApi.getData<ModalData>();
    moduleKey.value = data.moduleKey;
    preserveDecimalPrecision.value = data.preserveDecimalPrecision === true;
    await loadFields(data.loadFields);
  },
});

async function loadFields(loader: () => Promise<ExportField[]>) {
  loading.value = true;
  try {
    const list = await loader();
    fields.value = (list || []).toSorted(
      (a, b) => (a.sort || 0) - (b.sort || 0),
    );
    restoreCheckedFields();
  } finally {
    loading.value = false;
  }
}

function restoreCheckedFields() {
  const validFields = new Set(allFieldKeys.value);
  if (!storageKey.value) {
    checkedFields.value = allFieldKeys.value;
    return;
  }
  try {
    const cached = JSON.parse(localStorage.getItem(storageKey.value) || '[]');
    const restored = Array.isArray(cached)
      ? cached.filter((field) => validFields.has(field))
      : [];
    checkedFields.value = restored.length > 0 ? restored : allFieldKeys.value;
  } catch {
    checkedFields.value = allFieldKeys.value;
  }
}

function saveCheckedFields() {
  if (!storageKey.value) {
    return;
  }
  localStorage.setItem(storageKey.value, JSON.stringify(checkedFields.value));
}

function selectAll() {
  checkedFields.value = allFieldKeys.value;
}

function clearAll() {
  checkedFields.value = fields.value
    .filter((item) => item.required)
    .map((item) => item.field);
}

function restoreDefault() {
  checkedFields.value = allFieldKeys.value;
}
</script>

<template>
  <Modal title="选择导出字段" class="!w-[1120px] max-w-[calc(100vw-32px)]">
    <div class="min-w-0 px-4 py-3">
      <p v-if="preserveDecimalPrecision" class="mb-3 text-sm text-gray-500">
        数字按实际保存精度导出；超过 Excel 15
        位有效数字的值以文本保留，避免丢失精度。
      </p>
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <Input
          v-model:value="keyword"
          allow-clear
          placeholder="搜索字段"
          class="min-w-[220px] max-w-[320px] flex-1"
        />
        <Button @click="selectAll">全选</Button>
        <Button @click="clearAll">取消全选</Button>
        <Button @click="restoreDefault">恢复默认</Button>
        <span class="ml-auto shrink-0 text-sm text-gray-500">{{
          checkedCountText
        }}</span>
      </div>
      <Spin :spinning="loading">
        <div
          v-if="fields.length === 0 && !loading"
          class="py-8 text-center text-gray-400"
        >
          暂无可导出字段
        </div>
        <CheckboxGroup
          v-else
          v-model:value="checkedFields"
          class="export-field-checkbox-group w-full"
        >
          <div class="max-h-[440px] min-w-0 overflow-auto pr-1">
            <section
              v-for="group in filteredGroups"
              :key="group.group"
              class="mb-4"
            >
              <div class="mb-2 text-sm font-medium text-gray-700">
                {{ group.groupLabel }}
              </div>
              <div
                class="grid w-full grid-cols-1 gap-x-4 gap-y-3 pr-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              >
                <Checkbox
                  v-for="item in group.items"
                  :key="item.field"
                  class="export-field-checkbox-item min-w-0"
                  :disabled="item.required"
                  :value="item.field"
                >
                  {{ item.label }}
                </Checkbox>
              </div>
            </section>
          </div>
        </CheckboxGroup>
      </Spin>
    </div>
  </Modal>
</template>

<style scoped>
:deep(.export-field-checkbox-group) {
  display: block;
}

:deep(.export-field-checkbox-item.ant-checkbox-wrapper) {
  align-items: flex-start;
  margin-inline-start: 0;
  width: 100%;
}

:deep(.export-field-checkbox-item .ant-checkbox + span) {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
