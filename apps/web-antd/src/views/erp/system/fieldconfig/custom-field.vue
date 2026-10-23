<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';
import type { ErpFieldConfigApi } from '#/api/erp/config/field';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Switch,
  Table,
  Tabs,
  Tag,
} from 'ant-design-vue';

import {
  batchUpdateFieldConfig,
  createCustomField,
  getFieldConfigList,
} from '#/api/erp/config/field';
import { clearFieldPermissionCache } from '#/composables/useFieldPermission';
import { clearFieldConfigCache } from '#/views/erp/composables/useFieldConfig';

defineOptions({ name: 'ErpProductCustomFieldCreate' });

const PRODUCT_MODULE_KEY = 'erp_product';
const PAGE_SIZE = 20;
const FIELD_CONFIG_CREATE_PERMISSION = 'erp:field-config:create-custom-field';
const FIELD_CONFIG_UPDATE_PERMISSION = 'erp:field-config:update';

type CustomFieldGroup = ErpFieldConfigApi.CustomFieldGroup;

interface FieldTableRow extends ErpFieldConfigApi.FieldConfig {
  rowKey: string;
}

const router = useRouter();
const { hasAccessByCodes } = useAccess();
const loading = ref(false);
const submitting = ref(false);
const editSubmitting = ref(false);
const deletingFieldName = ref('');
const keyword = ref('');
const sourceFilter = ref<'ALL' | 'CUSTOM' | 'SYSTEM'>('ALL');
const activeGroup = ref<CustomFieldGroup>('base_info');
const currentPages = reactive<Record<CustomFieldGroup, number>>({
  base_info: 1,
  price_info: 1,
  extend_info: 1,
});
const createModalOpen = ref(false);
const editModalOpen = ref(false);
const existingFields = ref<FieldTableRow[]>([]);

const editFormState = reactive({
  fieldName: '',
  fieldLabel: '',
});

const formState = reactive<ErpFieldConfigApi.CreateCustomFieldReq>({
  moduleKey: PRODUCT_MODULE_KEY,
  fieldLabel: '',
  fieldType: 'TEXT',
  fieldGroup: 'base_info',
  required: false,
  visible: true,
  listVisible: false,
  searchable: false,
  readonly: false,
  maxLength: undefined,
  decimalPrecision: 18,
  decimalScale: 2,
  sort: undefined,
});

const fieldTypeOptions = [
  { label: '单行文本', value: 'TEXT' },
  { label: '多行文本', value: 'TEXTAREA' },
  { label: '整数', value: 'INTEGER' },
  { label: '小数', value: 'DECIMAL' },
  { label: '日期', value: 'DATE' },
  { label: '日期时间', value: 'DATETIME' },
  { label: '是否', value: 'BOOLEAN' },
];

const fieldGroupOptions: Array<{
  description: string;
  label: string;
  value: CustomFieldGroup;
}> = [
  {
    label: '基础档案',
    value: 'base_info',
    description: '配件的名称、编码、品牌与基础属性',
  },
  {
    label: '价格列表',
    value: 'price_info',
    description: '配件的采购价、销售价与价格相关字段',
  },
  {
    label: '扩展信息',
    value: 'extend_info',
    description: '包装、重量及其他补充业务信息',
  },
];

const sourceFilterOptions = [
  { label: '全部字段', value: 'ALL' },
  { label: '系统字段', value: 'SYSTEM' },
  { label: '自定义字段', value: 'CUSTOM' },
];

const tablePagination = computed(() => ({
  current: currentPages[activeGroup.value],
  pageSize: PAGE_SIZE,
  showSizeChanger: false,
  showTotal: (total: number) => `共 ${total} 条`,
}));

const canUpdateFieldConfig = computed(() =>
  hasAccessByCodes([FIELD_CONFIG_UPDATE_PERMISSION]),
);

const tableColumns = computed<TableColumnsType<FieldTableRow>>(() => {
  const columns: TableColumnsType<FieldTableRow> = [
    {
      title: '序号',
      key: 'index',
      width: 64,
      customRender: ({ index }) =>
        (currentPages[activeGroup.value] - 1) * PAGE_SIZE + index + 1,
    },
    {
      title: '字段名称',
      dataIndex: 'fieldLabel',
      key: 'fieldLabel',
      width: 180,
    },
    {
      title: '字段编码',
      dataIndex: 'fieldName',
      key: 'fieldName',
      width: 180,
    },
    {
      title: '来源',
      dataIndex: 'fieldSource',
      key: 'fieldSource',
      width: 110,
      align: 'center',
    },
    {
      title: '类型',
      dataIndex: 'fieldType',
      key: 'fieldType',
      width: 120,
    },
    {
      title: '表单显示',
      dataIndex: 'visible',
      key: 'visible',
      width: 110,
      align: 'center',
    },
    {
      title: '必填',
      dataIndex: 'required',
      key: 'required',
      width: 90,
      align: 'center',
    },
    {
      title: '列表显示',
      dataIndex: 'listVisible',
      key: 'listVisible',
      width: 110,
      align: 'center',
    },
    {
      title: '可搜索',
      dataIndex: 'searchable',
      key: 'searchable',
      width: 100,
      align: 'center',
    },
    {
      title: '只读',
      dataIndex: 'readonly',
      key: 'readonly',
      width: 90,
      align: 'center',
    },
    {
      title: '排序',
      dataIndex: 'sort',
      key: 'sort',
      width: 90,
      align: 'right',
    },
  ];
  if (canUpdateFieldConfig.value) {
    columns.push({
      title: '操作',
      key: 'action',
      width: 150,
      align: 'center',
      fixed: 'right',
    });
  }
  return columns;
});

const customFields = computed(() =>
  existingFields.value.filter(
    (field) => String(field.fieldSource ?? '').toUpperCase() === 'CUSTOM',
  ),
);

const systemFields = computed(() =>
  existingFields.value.filter(
    (field) => String(field.fieldSource ?? '').toUpperCase() !== 'CUSTOM',
  ),
);

const groupCounts = computed<Record<CustomFieldGroup, number>>(() => ({
  base_info: getFieldsByGroup('base_info').length,
  price_info: getFieldsByGroup('price_info').length,
  extend_info: getFieldsByGroup('extend_info').length,
}));

const unassignedSystemFieldCount = computed(
  () =>
    existingFields.value.filter(
      (field) =>
        normalizeSource(field.fieldSource) === 'SYSTEM' &&
        !fieldGroupOptions.some((group) => group.value === field.fieldGroup),
    ).length,
);

const filteredFields = computed(() => {
  const query = normalizeText(keyword.value).toLowerCase();
  return getFieldsByGroup(activeGroup.value)
    .filter((field) => {
      const source = normalizeSource(field.fieldSource);
      if (sourceFilter.value !== 'ALL' && source !== sourceFilter.value) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [field.fieldName, field.fieldLabel, field.physicalColumn].some(
        (value) => normalizeText(value).toLowerCase().includes(query),
      );
    })
    .toSorted(compareFields);
});

function getFieldsByGroup(group: CustomFieldGroup) {
  return existingFields.value.filter((field) => field.fieldGroup === group);
}

function compareFields(left: FieldTableRow, right: FieldTableRow) {
  const leftSort = left.sort ?? Number.MAX_SAFE_INTEGER;
  const rightSort = right.sort ?? Number.MAX_SAFE_INTEGER;
  if (leftSort !== rightSort) {
    return leftSort - rightSort;
  }
  return normalizeText(left.fieldName).localeCompare(
    normalizeText(right.fieldName),
    'zh-CN',
  );
}

function normalizeText(value?: string) {
  return (value ?? '').trim();
}

function normalizeSource(value?: string) {
  return String(value ?? '').toUpperCase() === 'CUSTOM' ? 'CUSTOM' : 'SYSTEM';
}

function isCustomField(
  field?: Pick<FieldTableRow, 'fieldSource'> | Record<string, any>,
) {
  return normalizeSource(field?.fieldSource) === 'CUSTOM';
}

function getFieldTypeLabel(value?: string) {
  return (
    fieldTypeOptions.find((item) => item.value === value)?.label ??
    value ??
    '--'
  );
}

function getBooleanText(value?: boolean) {
  return value ? '是' : '否';
}

function resetForm(group: CustomFieldGroup = activeGroup.value) {
  formState.moduleKey = PRODUCT_MODULE_KEY;
  formState.fieldLabel = '';
  formState.fieldType = 'TEXT';
  formState.fieldGroup = group;
  formState.required = false;
  formState.visible = true;
  formState.listVisible = false;
  formState.searchable = false;
  formState.readonly = false;
  formState.maxLength = undefined;
  formState.decimalPrecision = 18;
  formState.decimalScale = 2;
  formState.defaultValue = undefined;
  formState.sort = undefined;
}

async function loadExistingFields() {
  loading.value = true;
  try {
    const list = await getFieldConfigList(PRODUCT_MODULE_KEY);
    existingFields.value = (list ?? []).map((field, index) => ({
      ...field,
      rowKey: `${field.fieldName || 'field'}_${field.id || index}`,
    }));
    clampCurrentPage();
  } finally {
    loading.value = false;
  }
}

function clampCurrentPage() {
  const total = filteredFields.value.length;
  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentPages[activeGroup.value] > maxPage) {
    currentPages[activeGroup.value] = maxPage;
  }
}

function buildPayload() {
  const fieldLabel = normalizeText(formState.fieldLabel);
  if (!fieldLabel) {
    message.warning('请输入字段名称');
    return null;
  }

  const payload: ErpFieldConfigApi.CreateCustomFieldReq = {
    moduleKey: PRODUCT_MODULE_KEY,
    fieldLabel,
    fieldType: formState.fieldType,
    fieldGroup: formState.fieldGroup,
    required: Boolean(formState.required),
    visible: formState.visible !== false,
    listVisible: Boolean(formState.listVisible),
    searchable: Boolean(formState.searchable),
    readonly: Boolean(formState.readonly),
    defaultValue: normalizeText(formState.defaultValue) || undefined,
  };

  if (formState.sort !== undefined && formState.sort !== null) {
    payload.sort = formState.sort;
  }
  if (payload.fieldType === 'TEXT') {
    payload.maxLength = formState.maxLength ?? undefined;
  }
  if (payload.fieldType === 'DECIMAL') {
    payload.decimalPrecision = formState.decimalPrecision ?? 18;
    payload.decimalScale = formState.decimalScale ?? 2;
  }
  return payload;
}

function buildBatchUpdateItems(
  fields: FieldTableRow[] = existingFields.value,
): ErpFieldConfigApi.BatchUpdateReq['items'] | null {
  const seen = new Set<string>();
  const items: ErpFieldConfigApi.BatchUpdateReq['items'] = [];

  for (const field of fields) {
    const fieldName = normalizeText(field.fieldName);
    const fieldLabel = normalizeText(field.fieldLabel);
    if (!fieldName) {
      message.warning('字段编码不能为空');
      return null;
    }
    if (seen.has(fieldName)) {
      message.warning(`字段编码重复：${fieldName}`);
      return null;
    }
    seen.add(fieldName);
    items.push({
      componentType: field.componentType,
      decimalPrecision: field.decimalPrecision,
      decimalScale: field.decimalScale,
      defaultValue: field.defaultValue,
      fieldName,
      fieldLabel,
      fieldGroup: field.fieldGroup,
      fieldSource: field.fieldSource,
      fieldType: field.fieldType,
      listVisible: field.listVisible,
      maxLength: field.maxLength,
      physicalColumn: field.physicalColumn,
      readonly: field.readonly,
      required: Boolean(field.required),
      searchable: field.searchable,
      visible: field.visible !== false,
      sort: field.sort,
    });
  }

  return items;
}

function backToFieldConfig() {
  router.push({
    path: '/erp/system/fieldconfig',
    query: { moduleKey: PRODUCT_MODULE_KEY },
  });
}

function openCreateModal() {
  resetForm(activeGroup.value);
  createModalOpen.value = true;
}

function closeCreateModal() {
  if (submitting.value) return;
  createModalOpen.value = false;
  resetForm();
}

function openEditModal(record: FieldTableRow | Record<string, any>) {
  if (!canUpdateFieldConfig.value) return;
  editFormState.fieldName = normalizeText(record.fieldName);
  editFormState.fieldLabel = record.fieldLabel ?? '';
  editModalOpen.value = true;
}

function closeEditModal() {
  if (editSubmitting.value) return;
  editModalOpen.value = false;
  resetEditForm();
}

function resetEditForm() {
  editFormState.fieldName = '';
  editFormState.fieldLabel = '';
}

function handleTableChange(pagination: { current?: number }) {
  currentPages[activeGroup.value] = pagination.current ?? 1;
}

async function handleSubmit() {
  const payload = buildPayload();
  if (!payload) return;
  submitting.value = true;
  try {
    const createdField = await createCustomField(payload);
    clearFieldConfigCache(PRODUCT_MODULE_KEY);
    clearFieldPermissionCache(PRODUCT_MODULE_KEY);
    message.success('自定义字段创建成功');
    await loadExistingFields();
    activeGroup.value = payload.fieldGroup;
    keyword.value = '';
    sourceFilter.value = 'ALL';
    const createdIndex = getFieldsByGroup(payload.fieldGroup)
      .toSorted(compareFields)
      .findIndex((field) => field.fieldName === createdField.fieldName);
    currentPages[payload.fieldGroup] =
      createdIndex === -1 ? 1 : Math.floor(createdIndex / PAGE_SIZE) + 1;
    createModalOpen.value = false;
    resetForm(payload.fieldGroup);
  } finally {
    submitting.value = false;
  }
}

async function handleEditSubmit() {
  if (!canUpdateFieldConfig.value) {
    message.warning('暂无修改字段名称权限');
    return;
  }
  const fieldName = normalizeText(editFormState.fieldName);
  const fieldLabel = normalizeText(editFormState.fieldLabel);
  if (!fieldName) return;
  if (!fieldLabel) {
    message.warning('请输入字段名称');
    return;
  }

  const target = existingFields.value.find(
    (field) => field.fieldName === fieldName,
  );
  if (!target) {
    message.warning('字段不存在');
    return;
  }
  if (normalizeText(target.fieldLabel) === fieldLabel) {
    closeEditModal();
    return;
  }

  const nextFields = existingFields.value.map((field) =>
    field.fieldName === fieldName ? { ...field, fieldLabel } : field,
  );
  const items = buildBatchUpdateItems(nextFields);
  if (!items) return;

  editSubmitting.value = true;
  try {
    await batchUpdateFieldConfig({
      moduleKey: PRODUCT_MODULE_KEY,
      items,
    });
    clearFieldConfigCache(PRODUCT_MODULE_KEY);
    clearFieldPermissionCache(PRODUCT_MODULE_KEY);
    message.success('字段名称修改成功，请关闭并重新打开表单，配置即可生效。');
    await loadExistingFields();
    editModalOpen.value = false;
    resetEditForm();
  } finally {
    editSubmitting.value = false;
  }
}

function handleDeleteField(record: FieldTableRow | Record<string, any>) {
  if (!canUpdateFieldConfig.value || deletingFieldName.value) return;
  if (!isCustomField(record)) return;
  const fieldName = normalizeText(record.fieldName);
  if (!fieldName) return;
  Modal.confirm({
    title: '确认删除该自定义字段吗？',
    content: `删除后字段配置将不再显示“${record.fieldLabel || fieldName}”，历史数据列会保留。`,
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: () => deleteField(fieldName),
  });
}

async function deleteField(fieldName: string) {
  if (!canUpdateFieldConfig.value || deletingFieldName.value) return;
  const target = existingFields.value.find(
    (field) => field.fieldName === fieldName,
  );
  if (!target || !isCustomField(target)) {
    message.warning('只能删除自定义字段');
    return;
  }
  const nextFields = existingFields.value.filter(
    (field) => field.fieldName !== fieldName,
  );
  const items = buildBatchUpdateItems(nextFields);
  if (!items) return;

  deletingFieldName.value = fieldName;
  try {
    await batchUpdateFieldConfig({
      moduleKey: PRODUCT_MODULE_KEY,
      deletedCustomFields: [fieldName],
      items,
    });
    clearFieldConfigCache(PRODUCT_MODULE_KEY);
    clearFieldPermissionCache(PRODUCT_MODULE_KEY);
    message.success('自定义字段已删除，请关闭并重新打开表单，配置即可生效。');
    await loadExistingFields();
    clampCurrentPage();
  } finally {
    deletingFieldName.value = '';
  }
}

watch([keyword, sourceFilter], () => {
  currentPages[activeGroup.value] = 1;
});

onMounted(loadExistingFields);
</script>

<template>
  <Page auto-content-height>
    <div class="field-custom-page">
      <header class="page-heading">
        <div class="heading-copy">
          <span class="title-mark"></span>
          <div>
            <h1>配件自定义字段</h1>
            <p>查看配件字段，并按业务需要创建自定义字段</p>
          </div>
        </div>
        <Button type="link" @click="backToFieldConfig"> 查看字段配置 → </Button>
      </header>

      <section class="field-overview" aria-label="字段概览">
        <div class="overview-label"><span></span>字段概览</div>
        <div class="overview-metric">
          <strong>{{ existingFields.length }}</strong>
          <span>全部字段</span>
        </div>
        <div class="overview-metric">
          <strong>{{ systemFields.length }}</strong>
          <span>系统字段</span>
        </div>
        <div class="overview-metric">
          <strong>{{ customFields.length }}</strong>
          <span>自定义字段</span>
        </div>
        <div class="overview-note">
          三个表单独立管理，新增字段自动归入当前表单
        </div>
      </section>

      <Tabs v-model:active-key="activeGroup" class="group-tabs">
        <Tabs.TabPane v-for="group in fieldGroupOptions" :key="group.value">
          <template #tab>
            <span class="group-tab-label">
              {{ group.label }}
              <span class="group-count">{{ groupCounts[group.value] }}</span>
            </span>
          </template>
          <template #default></template>
        </Tabs.TabPane>
      </Tabs>

      <div class="group-description">
        <span class="group-description-dot"></span>
        <span>
          {{
            fieldGroupOptions.find((group) => group.value === activeGroup)
              ?.description
          }}
        </span>
      </div>

      <div class="field-toolbar">
        <div class="toolbar-filters">
          <Input.Search
            v-model:value="keyword"
            class="field-search"
            placeholder="搜索当前表单的字段名称、编码或物理列"
            allow-clear
          />
          <Select
            v-model:value="sourceFilter"
            class="field-filter"
            :options="sourceFilterOptions"
          />
          <span class="result-count">
            当前显示 {{ filteredFields.length }} 个字段
          </span>
        </div>
        <div class="toolbar-actions">
          <Button :loading="loading" @click="loadExistingFields">刷新</Button>
          <Button
            v-access:code="[FIELD_CONFIG_CREATE_PERMISSION]"
            type="primary"
            @click="openCreateModal"
          >
            <span class="add-icon">＋</span>
            新增自定义字段
          </Button>
        </div>
      </div>

      <Table
        class="field-table"
        :data-source="filteredFields"
        :columns="tableColumns"
        :pagination="tablePagination"
        :loading="loading"
        row-key="rowKey"
        size="small"
        bordered
        :scroll="{ x: 1380, y: 'calc(100vh - 455px)' }"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'fieldLabel'">
            {{ record.fieldLabel || '--' }}
          </template>
          <template v-else-if="column.key === 'fieldName'">
            <span class="field-code">{{ record.fieldName }}</span>
          </template>
          <template v-else-if="column.key === 'fieldSource'">
            <Tag
              :color="
                normalizeSource(record.fieldSource) === 'CUSTOM'
                  ? 'blue'
                  : 'default'
              "
            >
              {{
                normalizeSource(record.fieldSource) === 'CUSTOM'
                  ? '自定义'
                  : '系统'
              }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'fieldType'">
            {{ getFieldTypeLabel(record.fieldType) }}
          </template>
          <template v-else-if="column.key === 'visible'">
            <Tag :color="record.visible !== false ? 'green' : 'default'">
              {{ getBooleanText(record.visible !== false) }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'required'">
            <Tag :color="record.required ? 'red' : 'default'">
              {{ getBooleanText(record.required) }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'listVisible'">
            <Tag :color="record.listVisible ? 'blue' : 'default'">
              {{ getBooleanText(record.listVisible) }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'searchable'">
            <Tag :color="record.searchable ? 'purple' : 'default'">
              {{ getBooleanText(record.searchable) }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'readonly'">
            <Tag :color="record.readonly ? 'orange' : 'default'">
              {{ getBooleanText(record.readonly) }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'sort'">
            {{ record.sort ?? '--' }}
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="table-actions">
              <Button
                v-access:code="[FIELD_CONFIG_UPDATE_PERMISSION]"
                type="link"
                size="small"
                :disabled="Boolean(deletingFieldName) || editSubmitting"
                @click="openEditModal(record)"
              >
                编辑名称
              </Button>
              <Button
                v-if="isCustomField(record)"
                v-access:code="[FIELD_CONFIG_UPDATE_PERMISSION]"
                type="link"
                size="small"
                danger
                :loading="deletingFieldName === record.fieldName"
                :disabled="Boolean(deletingFieldName) || editSubmitting"
                @click="handleDeleteField(record)"
              >
                删除
              </Button>
            </div>
          </template>
        </template>
      </Table>

      <div v-if="unassignedSystemFieldCount" class="system-field-note">
        另有 {{ unassignedSystemFieldCount }}
        个库存、图片或详情系统字段，请在“字段配置”中查看。
      </div>

      <Modal
        v-model:open="editModalOpen"
        width="520px"
        title="编辑字段名称"
        :confirm-loading="editSubmitting"
        :closable="!editSubmitting"
        :mask-closable="!editSubmitting"
        :keyboard="!editSubmitting"
        ok-text="保存"
        cancel-text="取消"
        @ok="handleEditSubmit"
        @cancel="closeEditModal"
      >
        <Form class="edit-field-form" layout="vertical">
          <Form.Item label="字段编码">
            <div class="auto-code-preview">{{ editFormState.fieldName }}</div>
            <div class="field-note">
              字段编码和物理列由系统维护，创建后不可修改。
            </div>
          </Form.Item>
          <Form.Item label="字段名称" required>
            <Input
              v-model:value="editFormState.fieldLabel"
              placeholder="请输入字段名称"
              allow-clear
              @press-enter="handleEditSubmit"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        v-model:open="createModalOpen"
        width="760px"
        :closable="!submitting"
        :mask-closable="!submitting"
        :keyboard="!submitting"
        :footer="null"
        @cancel="closeCreateModal"
      >
        <template #title>
          <div class="modal-heading">
            <span class="modal-title-icon">＋</span>
            <span>新增自定义字段</span>
          </div>
        </template>

        <Alert
          class="field-code-alert"
          type="info"
          show-icon
          message="字段编码由系统自动生成，创建后不可修改。"
        />

        <Form class="custom-field-form" layout="vertical">
          <section>
            <h2 class="form-section-title">基本信息</h2>
            <div class="form-grid">
              <Form.Item label="字段名称" required>
                <Input
                  v-model:value="formState.fieldLabel"
                  placeholder="例如：供应商等级"
                  allow-clear
                />
              </Form.Item>
              <Form.Item label="字段编码">
                <div class="auto-code-preview">
                  由系统自动生成，创建后不可修改
                </div>
                <div class="field-note">
                  创建成功后可在字段列表中查看最终编码
                </div>
              </Form.Item>
              <Form.Item label="字段类型" required>
                <Select
                  v-model:value="formState.fieldType"
                  :options="fieldTypeOptions"
                />
              </Form.Item>
              <Form.Item label="字段分组" required>
                <Select
                  v-model:value="formState.fieldGroup"
                  :options="fieldGroupOptions"
                />
              </Form.Item>
              <Form.Item v-if="formState.fieldType === 'TEXT'" label="最大长度">
                <InputNumber
                  v-model:value="formState.maxLength"
                  :min="1"
                  :max="500"
                  placeholder="可不填，默认 255"
                  style="width: 100%"
                />
              </Form.Item>
              <template v-if="formState.fieldType === 'DECIMAL'">
                <Form.Item label="总位数">
                  <InputNumber
                    v-model:value="formState.decimalPrecision"
                    :min="1"
                    :max="38"
                    style="width: 100%"
                  />
                </Form.Item>
                <Form.Item label="小数位数">
                  <InputNumber
                    v-model:value="formState.decimalScale"
                    :min="0"
                    :max="10"
                    style="width: 100%"
                  />
                </Form.Item>
              </template>
              <Form.Item label="排序">
                <InputNumber
                  v-model:value="formState.sort"
                  :min="0"
                  placeholder="可不填，自动排到最后"
                  style="width: 100%"
                />
              </Form.Item>
              <Form.Item label="默认值">
                <Input
                  v-model:value="formState.defaultValue"
                  placeholder="可选"
                  allow-clear
                />
              </Form.Item>
            </div>
          </section>

          <section class="rule-section">
            <h2 class="form-section-title">显示与填写规则</h2>
            <div class="switch-grid">
              <div class="switch-item">
                <span>表单显示</span>
                <Switch v-model:checked="formState.visible" />
              </div>
              <div class="switch-item">
                <span>是否必填</span>
                <Switch v-model:checked="formState.required" />
              </div>
              <div class="switch-item">
                <span>列表显示</span>
                <Switch v-model:checked="formState.listVisible" />
              </div>
              <div class="switch-item">
                <span>可搜索</span>
                <Switch v-model:checked="formState.searchable" />
              </div>
              <div class="switch-item">
                <span>只读</span>
                <Switch v-model:checked="formState.readonly" />
              </div>
            </div>
          </section>
        </Form>

        <div class="modal-actions">
          <Button :disabled="submitting" @click="closeCreateModal">取消</Button>
          <Button
            type="primary"
            :loading="submitting"
            :disabled="loading"
            @click="handleSubmit"
          >
            创建字段
          </Button>
        </div>
      </Modal>
    </div>
  </Page>
</template>

<style scoped>
.field-custom-page {
  min-height: calc(100vh - 120px);
  padding: 16px;
  overflow: hidden;
  color: #172033;
  background: #fff;
  border: 1px solid #edf0f5;
  border-radius: 5px;
}

.page-heading,
.heading-copy,
.field-toolbar,
.toolbar-filters,
.toolbar-actions,
.field-overview,
.overview-label,
.overview-metric,
.modal-heading,
.switch-item,
.modal-actions {
  display: flex;
  align-items: center;
}

.page-heading,
.field-toolbar {
  justify-content: space-between;
}

.page-heading {
  margin-bottom: 14px;
}

.heading-copy {
  gap: 12px;
}

.title-mark {
  width: 4px;
  height: 30px;
  background: #1677ff;
  border-radius: 3px;
}

.page-heading h1 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
}

.page-heading p {
  margin: 0;
  color: #7b8497;
  font-size: 12px;
}

.field-overview {
  height: 52px;
  margin-bottom: 12px;
  background: #f8faff;
  border: 1px solid #e7edf7;
  border-radius: 4px;
}

.overview-label {
  width: 122px;
  align-self: stretch;
  gap: 8px;
  padding: 0 16px;
  font-weight: 600;
  border-right: 1px solid #e3e9f2;
}

.overview-label > span {
  width: 6px;
  height: 6px;
  background: #1677ff;
  border-radius: 50%;
  box-shadow: 0 0 0 4px #dceaff;
}

.overview-metric {
  min-width: 116px;
  align-self: stretch;
  gap: 7px;
  padding: 0 18px;
  border-right: 1px solid #e3e9f2;
}

.overview-metric strong {
  font-family: 'Segoe UI', Arial, sans-serif;
  font-size: 20px;
  font-weight: 600;
}

.overview-metric span,
.overview-note,
.result-count {
  color: #7b8497;
}

.overview-note {
  flex: 1;
  justify-content: flex-end;
  padding: 0 16px;
  text-align: right;
}

.field-toolbar {
  gap: 12px;
  margin-bottom: 10px;
}

.group-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 10px;
}

.group-tabs :deep(.ant-tabs-tab) {
  min-width: 150px;
  justify-content: center;
  padding: 10px 16px;
}

.group-tabs :deep(.ant-tabs-tab:not(.ant-tabs-tab-active)) {
  color: #4a5467;
}

.group-tabs :deep(.ant-tabs-content-holder) {
  min-height: 0;
}

.group-tab-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
}

.group-count {
  min-width: 22px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  color: #7b8497;
  background: #f0f2f5;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 400;
}

.group-tabs :deep(.ant-tabs-tab-active) .group-count {
  color: #1677ff;
  background: #eaf3ff;
}

.group-description {
  height: 34px;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding: 0 12px;
  color: #647086;
  background: #fafbfc;
  border: 1px solid #edf0f5;
  border-radius: 4px;
  font-size: 12px;
}

.group-description-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  background: #1677ff;
  border-radius: 50%;
}

.toolbar-filters,
.toolbar-actions {
  gap: 8px;
}

.field-search {
  width: 330px;
}

.field-filter {
  width: 140px;
}

.result-count {
  margin-left: 4px;
  white-space: nowrap;
}

.add-icon {
  position: relative;
  top: -1px;
  font-size: 17px;
  font-weight: 300;
  line-height: 1;
}

.field-table :deep(.ant-table) {
  font-size: 12px;
}

.field-table :deep(.ant-table-thead > tr > th) {
  height: 40px;
  padding: 8px 11px;
  color: #273248;
  font-weight: 600;
  white-space: nowrap;
  background: #f7f9fc;
}

.field-table :deep(.ant-table-tbody > tr > td) {
  height: 42px;
  padding: 8px 11px;
  white-space: nowrap;
}

.field-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #f6faff;
}

.field-table :deep(.ant-pagination) {
  margin: 12px 0 0;
}

.field-code {
  color: #344158;
  font-family: Consolas, 'SFMono-Regular', monospace;
  font-size: 12px;
}

.table-actions {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 112px;
}

.table-actions :deep(.ant-btn-sm) {
  padding-inline: 4px;
}

.system-field-note {
  margin-top: 8px;
  color: #98a0ae;
  font-size: 11px;
  text-align: right;
}

.modal-heading {
  gap: 9px;
  font-size: 15px;
  font-weight: 600;
}

.modal-title-icon {
  width: 25px;
  height: 25px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #1677ff;
  background: #eaf3ff;
  border-radius: 4px;
  font-size: 17px;
  font-weight: 300;
}

.field-code-alert {
  margin-bottom: 18px;
}

.custom-field-form {
  font-size: 12px;
}

.edit-field-form {
  padding-top: 8px;
}

.form-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
}

.form-section-title::before {
  width: 3px;
  height: 13px;
  background: #1677ff;
  border-radius: 2px;
  content: '';
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 20px;
  row-gap: 0;
}

.custom-field-form :deep(.ant-form-item) {
  margin-bottom: 14px;
}

.custom-field-form :deep(.ant-form-item-label) {
  padding-bottom: 5px;
}

.custom-field-form :deep(.ant-form-item-label > label) {
  height: auto;
  color: #414c61;
  font-size: 12px;
}

.custom-field-form :deep(.ant-input),
.custom-field-form :deep(.ant-input-number),
.custom-field-form :deep(.ant-select-selector) {
  font-size: 12px;
}

.field-note {
  margin-top: 5px;
  color: #98a0ae;
  font-size: 11px;
}

.auto-code-preview {
  height: 32px;
  display: flex;
  align-items: center;
  padding: 0 11px;
  color: #647086;
  background: #f7f9fc;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 12px;
}

.rule-section {
  margin-top: 6px;
  padding-top: 16px;
  border-top: 1px solid #edf0f5;
}

.switch-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.switch-item {
  justify-content: space-between;
  min-width: 0;
  height: 40px;
  padding: 0 10px;
  color: #414c61;
  background: #f8f9fb;
  border: 1px solid #ebeff4;
  border-radius: 4px;
}

.modal-actions {
  justify-content: flex-end;
  gap: 8px;
  margin: 20px -24px -20px;
  padding: 12px 24px 0;
  border-top: 1px solid #e3e8f0;
}

@media (max-width: 1100px) {
  .field-toolbar {
    align-items: flex-start;
  }

  .toolbar-filters {
    flex-wrap: wrap;
  }

  .overview-note {
    display: none;
  }
}

@media (max-width: 768px) {
  .field-custom-page {
    padding: 12px;
  }

  .field-overview {
    height: auto;
    flex-wrap: wrap;
  }

  .overview-label {
    width: 100%;
    height: 38px;
    border-right: 0;
    border-bottom: 1px solid #e3e9f2;
  }

  .overview-metric {
    flex: 1;
    min-width: 100px;
    height: 48px;
    padding: 0 10px;
  }

  .field-toolbar {
    flex-direction: column;
  }

  .group-tabs :deep(.ant-tabs-tab) {
    min-width: 0;
    padding: 9px 10px;
  }

  .toolbar-actions {
    align-self: flex-end;
  }

  .field-search {
    width: min(100%, 330px);
  }

  .form-grid,
  .switch-grid {
    grid-template-columns: 1fr;
  }
}
</style>
