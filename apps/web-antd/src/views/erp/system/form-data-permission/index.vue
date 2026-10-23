<script lang="ts" setup>
import type { SelectValue } from 'ant-design-vue/es/select';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemFormDataPermissionApi } from '#/api/system/form-data-permission';

import { computed, reactive, ref } from 'vue';

import { confirm, Page } from '@vben/common-ui';

import {
  Alert,
  message,
  Modal,
  Select,
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getCandidateColumns,
  getCandidateTables,
  getFormDataPermissionConfig,
  getFormDataPermissionPage,
  rebuildFormDataPermission,
  saveFormDataPermissionConfig,
} from '#/api/system/form-data-permission';
import { $t } from '#/locales';

const valueTypeOptions = [
  { label: '额外可见：字段等于本人', value: 'single_id' },
  { label: '额外可见：CSV 包含本人', value: 'csv_ids' },
  { label: '额外可见：JSON 包含本人', value: 'json_ids' },
];

const editorVisible = ref(false);
const editorLoading = ref(false);
const candidateTables = ref<SystemFormDataPermissionApi.CandidateTable[]>([]);
const candidateColumns = ref<SystemFormDataPermissionApi.CandidateColumn[]>([]);
const selectedColumnNames = ref<string[]>([]);
const editingFormType = ref('');
const editorForm = reactive<SystemFormDataPermissionApi.Config>({
  enabled: true,
  fields: [],
  formType: '',
  tableDesc: '',
});

const tableOptions = computed(() =>
  candidateTables.value.map((item) => ({
    disabled: !editingFormType.value && item.configured,
    label: item.tableDesc || '未命名表单',
    value: item.formType,
  })),
);

const editorTitle = computed(() =>
  editingFormType.value ? '编辑ERP系统表单' : '新增ERP系统表单',
);

const rowSelection = computed(() => ({
  selectedRowKeys: selectedColumnNames.value,
  onChange: (keys: Array<number | string>) => {
    selectedColumnNames.value = keys.map(String);
  },
}));

const columnTableColumns = [
  { dataIndex: 'columnName', title: '列名', width: 180 },
  { dataIndex: 'columnDesc', title: '说明', width: 180 },
  { dataIndex: 'dataType', title: '类型', width: 120 },
  { dataIndex: 'recommended', title: '推荐', width: 90 },
  { dataIndex: 'valueType', title: '额外可见规则', width: 240 },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: [
      {
        component: 'Input',
        componentProps: { allowClear: true, placeholder: '请输入表单关键字' },
        fieldName: 'formType',
        label: '表单',
      },
      {
        component: 'Select',
        componentProps: {
          allowClear: true,
          options: [
            { label: '启用', value: true },
            { label: '停用', value: false },
          ],
          placeholder: '请选择状态',
        },
        fieldName: 'enabled',
        label: '状态',
      },
    ],
  },
  gridOptions: {
    columns: [
      {
        field: 'tableDesc',
        minWidth: 220,
        slots: { default: 'formName' },
        title: '表单名称',
      },
      { field: 'fieldCount', minWidth: 100, title: '字段数' },
      {
        field: 'enabled',
        minWidth: 100,
        slots: { default: 'enabled' },
        title: '状态',
      },
      {
        field: 'createTime',
        formatter: 'formatDateTime',
        minWidth: 180,
        title: '创建时间',
      },
      {
        fixed: 'right',
        slots: { default: 'actions' },
        title: '操作',
        width: 220,
      },
    ],
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getFormDataPermissionPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          });
        },
      },
    },
    rowConfig: { isHover: true, keyField: 'id' },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<SystemFormDataPermissionApi.Config>,
});

function resetEditor() {
  editingFormType.value = '';
  editorForm.id = undefined;
  editorForm.formType = '';
  editorForm.tableDesc = '';
  editorForm.enabled = true;
  editorForm.fields = [];
  candidateColumns.value = [];
  selectedColumnNames.value = [];
}

async function handleCreate() {
  resetEditor();
  editorVisible.value = true;
  candidateTables.value = await getCandidateTables();
}

async function handleEdit(row: SystemFormDataPermissionApi.Config) {
  resetEditor();
  editorVisible.value = true;
  editorLoading.value = true;
  try {
    candidateTables.value = await getCandidateTables();
    const config = await getFormDataPermissionConfig(row.formType);
    editingFormType.value = config.formType;
    Object.assign(editorForm, config);
    await loadColumns(config);
  } finally {
    editorLoading.value = false;
  }
}

async function handleTableChange(value: SelectValue) {
  if (typeof value !== 'string') {
    return;
  }
  const formType = value;
  const table = candidateTables.value.find(
    (item) => item.formType === formType,
  );
  editorForm.formType = formType;
  editorForm.tableDesc = table?.tableDesc || '';
  editorForm.fields = [];
  await loadColumns({
    enabled: editorForm.enabled,
    fields: [],
    formType,
    tableDesc: editorForm.tableDesc,
  });
}

async function loadColumns(config: SystemFormDataPermissionApi.Config) {
  if (!config.formType) {
    candidateColumns.value = [];
    selectedColumnNames.value = [];
    return;
  }
  const columns = await getCandidateColumns(config.formType);
  const fieldValueTypeMap = new Map(
    (config.fields || []).map((field) => [field.columnName, field.valueType]),
  );
  candidateColumns.value = columns.map((column) => {
    return {
      ...column,
      valueType:
        fieldValueTypeMap.get(column.columnName) ||
        column.valueType ||
        ('single_id' as const),
    };
  });
  selectedColumnNames.value =
    config.fields && config.fields.length > 0
      ? config.fields
          .filter((field) => field.enabled)
          .map((field) => field.columnName)
      : candidateColumns.value
          .filter((column) => column.recommended)
          .map((column) => column.columnName);
}

async function handleSave() {
  if (!editorForm.formType) {
    message.warning('请选择ERP系统表单');
    return;
  }
  editorLoading.value = true;
  try {
    await saveFormDataPermissionConfig({
      enabled: editorForm.enabled,
      fields: candidateColumns.value
        .filter((column) =>
          selectedColumnNames.value.includes(column.columnName),
        )
        .map((column) => ({
          columnDesc: column.columnDesc,
          columnName: column.columnName,
          enabled: true,
          valueType: column.valueType || 'single_id',
        })),
      formType: editorForm.formType,
      tableDesc: editorForm.tableDesc,
    });
    message.success($t('ui.actionMessage.operationSuccess'));
    editorVisible.value = false;
    gridApi.query();
  } finally {
    editorLoading.value = false;
  }
}

async function handleRebuild(row: SystemFormDataPermissionApi.Config) {
  await confirm(`确认重建 ${row.tableDesc || '未命名表单'} 的存量权限关系？`);
  await rebuildFormDataPermission(row.formType);
  message.success('重建任务已提交');
}
</script>

<template>
  <Page auto-content-height>
    <Alert
      class="mb-3"
      show-icon
      type="info"
      message="表单数据权限是额外可见条件"
      description="这里配置的字段规则会与角色/部门的数据范围取并集：不会缩小原有本部门、本部门及以下、指定部门或仅本人等基础范围，只会额外放开命中字段规则或显式授权的数据。"
    />
    <Grid table-title="表单数据权限配置">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: '新增自定义权限',
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['system:form-data-permission:config'],
              onClick: handleCreate,
            },
          ]"
        />
      </template>

      <template #enabled="{ row }">
        <Tag :color="row.enabled ? 'success' : 'default'">
          {{ row.enabled ? '启用' : '停用' }}
        </Tag>
      </template>

      <template #formName="{ row }">
        {{ row.tableDesc || '未命名表单' }}
      </template>

      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: $t('common.edit'),
              type: 'link',
              icon: ACTION_ICON.EDIT,
              auth: ['system:form-data-permission:config'],
              onClick: handleEdit.bind(null, row),
            },
            {
              label: '重建',
              type: 'link',
              icon: ACTION_ICON.REFRESH,
              auth: ['system:form-data-permission:rebuild'],
              onClick: handleRebuild.bind(null, row),
            },
          ]"
        />
      </template>
    </Grid>

    <Modal
      v-model:open="editorVisible"
      class="!w-[85vw]"
      :confirm-loading="editorLoading"
      :title="editorTitle"
      @ok="handleSave"
    >
      <div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-[1fr_160px]">
        <div>
          <div class="mb-1 text-sm text-gray-500">ERP系统表单</div>
          <Select
            v-model:value="editorForm.formType"
            :disabled="!!editingFormType"
            :loading="editorLoading"
            :options="tableOptions"
            show-search
            option-filter-prop="label"
            placeholder="请选择ERP系统表单"
            class="w-full"
            @change="handleTableChange"
          />
        </div>
        <Switch
          v-model:checked="editorForm.enabled"
          checked-children="启用"
          un-checked-children="停用"
        />
      </div>
      <Alert
        class="mb-3"
        show-icon
        type="warning"
        message="字段规则说明"
        description="勾选字段后，表示“字段值命中当前用户时额外可见”。例如销售人员=本人、创建者=本人；多个字段之间取并集。JSON 类型主要依赖新增/编辑/重建后同步到显式授权表生效。"
      />
      <Table
        :columns="columnTableColumns"
        :data-source="candidateColumns"
        :loading="editorLoading"
        :pagination="false"
        :row-key="(record) => record.columnName"
        :row-selection="rowSelection"
        :scroll="{ x: 'max-content', y: 'calc(70vh - 190px)' }"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'recommended'">
            <Tag v-if="record.recommended" color="blue">推荐</Tag>
          </template>
          <template v-if="column.dataIndex === 'valueType'">
            <Select
              v-model:value="record.valueType"
              :options="valueTypeOptions"
              class="w-full"
              size="small"
            />
          </template>
        </template>
      </Table>
    </Modal>
  </Page>
</template>
