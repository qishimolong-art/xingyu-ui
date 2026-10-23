<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Empty,
  Input,
  InputNumber,
  Menu,
  message,
  Modal,
  Popconfirm,
  Switch,
  Table,
} from 'ant-design-vue';

import {
  batchUpdateFieldConfig,
  type ErpFieldConfigApi,
  getFieldConfigList,
} from '#/api/erp/config/field';
import {
  clearFieldPermissionCache,
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import { clearFieldConfigCache } from '#/views/erp/composables/useFieldConfig';

import { useModuleGroups } from './data';

defineOptions({ name: 'ErpFieldConfig' });

interface FieldConfigRow extends ErpFieldConfigApi.FieldConfig {
  localKey: string;
}

const moduleGroups = useModuleGroups();
const openKeys = ref(moduleGroups.map((g) => g.groupKey));
const route = useRoute();
const rowSeed = ref(0);

function findModuleGroupKey(moduleKey: string) {
  return moduleGroups.find((group) =>
    group.children.some((item) => item.key === moduleKey),
  )?.groupKey;
}

function getInitialModuleKey() {
  const queryModuleKey = Array.isArray(route.query.moduleKey)
    ? route.query.moduleKey[0]
    : route.query.moduleKey;
  if (queryModuleKey && findModuleGroupKey(queryModuleKey)) {
    return queryModuleKey;
  }
  return moduleGroups[0]!.children[0]!.key;
}

const currentKey = ref(getInitialModuleKey());
const initialGroupKey = findModuleGroupKey(currentKey.value);
if (initialGroupKey && !openKeys.value.includes(initialGroupKey)) {
  openKeys.value.push(initialGroupKey);
}

const tableData = ref<FieldConfigRow[]>([]);
const dirty = ref(false);
const loading = ref(false);
const saving = ref(false);
const pendingDeletedCustomFields = ref<string[]>([]);

const PRODUCT_MODULE_KEY = 'erp_product';
const FIELD_CONFIG_PERMISSION_MODULE = 'erp_system_field_config';
const PROTECTED_COLUMN_KEYS = new Set([
  'action',
  'fieldLabel',
  'fieldName',
  'index',
  'visible',
]);
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_CONFIG_PERMISSION_MODULE,
);

const currentModuleName = computed(() => {
  for (const group of moduleGroups) {
    const found = group.children.find((c) => c.key === currentKey.value);
    if (found) return found.label;
  }
  return '';
});

const isProductModule = computed(() => currentKey.value === PRODUCT_MODULE_KEY);

const tableColumns: TableColumnsType<FieldConfigRow> = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    customRender: ({ index }) => index + 1,
  },
  {
    title: '字段名',
    dataIndex: 'fieldName',
    key: 'fieldName',
    width: 240,
  },
  {
    title: '字段中文名',
    dataIndex: 'fieldLabel',
    key: 'fieldLabel',
    width: 220,
  },
  {
    title: '是否显示',
    dataIndex: 'visible',
    key: 'visible',
    width: 120,
    align: 'center',
  },
  {
    title: '是否必填',
    dataIndex: 'required',
    key: 'required',
    width: 120,
    align: 'center',
  },
  {
    title: '排序',
    dataIndex: 'sort',
    key: 'sort',
    width: 140,
    align: 'center',
  },
  {
    title: '操作',
    key: 'action',
    width: 90,
    align: 'center',
  },
];

const effectiveTableColumns = computed(() =>
  tableColumns.filter((column) => {
    const columnKey = String(column.key ?? column.dataIndex ?? '');
    return (
      PROTECTED_COLUMN_KEYS.has(columnKey) ||
      !isFieldHidden(hiddenFields.value, columnKey)
    );
  }),
);

function createLocalKey() {
  rowSeed.value += 1;
  return `field_config_${Date.now()}_${rowSeed.value}`;
}

function normalizeText(value?: string) {
  return (value ?? '').trim();
}

async function loadData(key: string) {
  loading.value = true;
  try {
    const list = await getFieldConfigList(key);
    tableData.value = (list ?? []).map((row) => ({
      ...row,
      localKey: createLocalKey(),
      required: Boolean(row.required),
      visible: row.visible !== false,
      sort: row.sort ?? 0,
      fieldLabel: row.fieldLabel ?? '',
    }));
    dirty.value = false;
    pendingDeletedCustomFields.value = [];
  } finally {
    loading.value = false;
  }
}

function handleMenuClick({ key }: { key: number | string }) {
  const nextKey = String(key);
  if (nextKey === currentKey.value) return;
  if (dirty.value) {
    Modal.confirm({
      title: '有未保存的改动',
      content: '切换模块后当前改动会丢失，确认切换吗？',
      okText: '确认切换',
      cancelText: '取消',
      onOk: async () => {
        currentKey.value = nextKey;
        await loadData(nextKey);
      },
    });
    return;
  }
  currentKey.value = nextKey;
  loadData(nextKey);
}

function handleRemoveField(record: FieldConfigRow | Record<string, any>) {
  if (!isProductModule.value || record.fieldSource !== 'CUSTOM' || !record.id) {
    return;
  }
  if (!record.localKey) return;
  const fieldName = normalizeText(record.fieldName);
  if (record.id && record.fieldSource === 'CUSTOM' && fieldName) {
    pendingDeletedCustomFields.value = [
      ...new Set([...pendingDeletedCustomFields.value, fieldName]),
    ];
  }
  tableData.value = tableData.value.filter(
    (row) => row.localKey !== record.localKey,
  );
  dirty.value = true;
}

function buildSaveItems(): ErpFieldConfigApi.BatchUpdateReq['items'] | null {
  const seen = new Set<string>();
  const items: ErpFieldConfigApi.BatchUpdateReq['items'] = [];

  for (const row of tableData.value) {
    const fieldName = normalizeText(row.fieldName);
    const fieldLabel = normalizeText(row.fieldLabel);
    if (!fieldName) {
      message.warning('字段名不能为空');
      return null;
    }
    if (seen.has(fieldName)) {
      message.warning(`字段名重复：${fieldName}`);
      return null;
    }
    seen.add(fieldName);
    items.push({
      componentType: row.componentType,
      decimalPrecision: row.decimalPrecision,
      decimalScale: row.decimalScale,
      defaultValue: row.defaultValue,
      fieldName,
      fieldLabel,
      fieldGroup: row.fieldGroup,
      fieldSource: row.fieldSource,
      fieldType: row.fieldType,
      listVisible: row.listVisible,
      maxLength: row.maxLength,
      physicalColumn: row.physicalColumn,
      readonly: row.readonly,
      required: Boolean(row.required),
      searchable: row.searchable,
      visible: row.visible !== false,
      sort: row.sort,
    });
  }

  return items;
}

async function handleSave() {
  const items = buildSaveItems();
  if (!items) return;
  saving.value = true;
  try {
    await batchUpdateFieldConfig({
      moduleKey: currentKey.value,
      deletedCustomFields: pendingDeletedCustomFields.value,
      items,
    });
    clearFieldConfigCache(currentKey.value);
    clearFieldPermissionCache(currentKey.value);
    message.success('保存成功，请关闭并重新打开表单，配置即可生效。');
    await loadData(currentKey.value);
  } finally {
    saving.value = false;
  }
}

function handleOpenChange(keys: (number | string)[]) {
  openKeys.value = keys.map(String);
}

function markDirty() {
  dirty.value = true;
}

onMounted(() => {
  void Promise.all([loadHiddenFields(), loadData(currentKey.value)]);
});
</script>

<template>
  <Page auto-content-height>
    <div class="bg-white p-4">
      <Alert
        class="mb-3"
        type="info"
        show-icon
        message="说明：字段名需对应表单 schema 的 fieldName；关闭必填只会移除红星和空值校验，字段本身的格式校验仍会保留。"
      />
      <div class="flex gap-4" style="height: calc(100vh - 200px)">
        <div class="w-[200px] flex-shrink-0 overflow-auto border-r pr-2">
          <Menu
            mode="inline"
            :selected-keys="[currentKey]"
            :open-keys="openKeys"
            @click="handleMenuClick"
            @open-change="handleOpenChange"
          >
            <Menu.SubMenu
              v-for="group in moduleGroups"
              :key="group.groupKey"
              :title="group.groupLabel"
            >
              <Menu.Item v-for="item in group.children" :key="item.key">
                {{ item.label }}
              </Menu.Item>
            </Menu.SubMenu>
          </Menu>
        </div>

        <div class="flex min-w-0 flex-1 flex-col">
          <div class="mb-3 flex items-center justify-between">
            <span class="text-base font-medium">{{ currentModuleName }}</span>
            <div class="space-x-2">
              <Button
                type="primary"
                :loading="saving"
                :disabled="loading"
                @click="handleSave"
              >
                保存
              </Button>
            </div>
          </div>

          <Empty
            v-if="!loading && tableData.length === 0"
            :description="
              isProductModule
                ? '该模块暂无字段配置，请先补充字段配置数据。'
                : '该表单尚未初始化字段配置，请先补充字段配置种子数据。'
            "
          />

          <Table
            v-else
            :data-source="tableData"
            :columns="effectiveTableColumns"
            :pagination="false"
            :loading="loading"
            row-key="localKey"
            size="middle"
            bordered
            :scroll="{ y: 'calc(100vh - 320px)' }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'fieldName'">
                <Input
                  v-model:value="record.fieldName"
                  placeholder="请输入字段名"
                  allow-clear
                  @change="markDirty"
                />
              </template>
              <template v-else-if="column.key === 'fieldLabel'">
                <Input
                  v-model:value="record.fieldLabel"
                  placeholder="请输入字段中文名"
                  allow-clear
                  @change="markDirty"
                />
              </template>
              <template v-else-if="column.key === 'required'">
                <Switch
                  v-model:checked="record.required"
                  checked-children="必填"
                  un-checked-children="可空"
                  @change="markDirty"
                />
              </template>
              <template v-else-if="column.key === 'visible'">
                <Switch
                  v-model:checked="record.visible"
                  checked-children="显示"
                  un-checked-children="隐藏"
                  @change="markDirty"
                />
              </template>
              <template v-else-if="column.key === 'sort'">
                <InputNumber
                  v-model:value="record.sort"
                  :min="0"
                  style="width: 100%"
                  @change="markDirty"
                />
              </template>
              <template v-else-if="column.key === 'action'">
                <Popconfirm
                  v-if="
                    isProductModule &&
                    record.fieldSource === 'CUSTOM' &&
                    record.id
                  "
                  title="确认删除该字段配置吗？"
                  ok-text="删除"
                  cancel-text="取消"
                  @confirm="handleRemoveField(record)"
                >
                  <Button danger type="link">删除</Button>
                </Popconfirm>
                <span v-else class="text-gray-400">--</span>
              </template>
            </template>
          </Table>
        </div>
      </div>
    </div>
  </Page>
</template>
