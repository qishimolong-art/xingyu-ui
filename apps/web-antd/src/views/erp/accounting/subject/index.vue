<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';
import type { Key } from 'ant-design-vue/es/table/interface';

import type { ErpAccountingSubjectApi } from '#/api/erp/finance/accounting/subject';

import { computed, h, onMounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import {
  Alert,
  Button,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tabs,
  Tag,
} from 'ant-design-vue';

import {
  batchUpdateOpeningBalance,
  deleteAccountingSubject,
  exportAccountingSubject,
  getAccountingSubjectList,
} from '#/api/erp/finance/accounting/subject';
import { useAccountingShortcut } from '#/views/erp/composables/useAccountingShortcut';

import {
  AUXILIARY_TYPE_MAP,
  BALANCE_DIRECTION_MAP,
  formatAuxiliaryTypes,
  SUBJECT_CATEGORY_OPTIONS,
} from './data';
import Form from './modules/form.vue';
import ImportModal from './modules/import-modal.vue';

defineOptions({ name: 'ErpAccountingSubject' });

interface SubjectRow extends ErpAccountingSubjectApi.Subject {
  __dirty?: boolean;
}

const currentCategory = ref<number>(SUBJECT_CATEGORY_OPTIONS[0]!.value);
const tableData = ref<SubjectRow[]>([]);
const loading = ref(false);
const saving = ref(false);
const selectedRowKeys = ref<Key[]>([]);

const dirtyCount = computed(
  () => tableData.value.filter((r) => r.__dirty).length,
);

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [ImportFormModal, importFormModalApi] = useVbenModal({
  connectedComponent: ImportModal,
  destroyOnClose: true,
});

/** 把后端树形结构展平成有缩进信息的列表 */
function flattenTree(
  list: ErpAccountingSubjectApi.Subject[] | undefined,
): SubjectRow[] {
  if (!list || list.length === 0) return [];
  const out: SubjectRow[] = [];
  const walk = (items: ErpAccountingSubjectApi.Subject[]) => {
    for (const item of items) {
      const { children, ...rest } = item;
      out.push({ ...rest, __dirty: false });
      if (children && children.length > 0) {
        walk(children);
      }
    }
  };
  walk(list);
  return out;
}

/** 加载当前类目的科目数据 */
async function loadData() {
  loading.value = true;
  try {
    const list = await getAccountingSubjectList(currentCategory.value);
    tableData.value = flattenTree(list);
    selectedRowKeys.value = [];
  } finally {
    loading.value = false;
  }
}

/** 切换类目 Tab */
function handleCategoryChange(key: number | string) {
  const cat = Number(key);
  if (cat === currentCategory.value) return;
  if (dirtyCount.value > 0) {
    Modal.confirm({
      title: '有未保存的改动',
      content: `当前 Tab 有 ${dirtyCount.value} 行期初余额未保存，切换后会丢失，确认切换吗？`,
      okText: '确认切换',
      cancelText: '取消',
      onOk: async () => {
        currentCategory.value = cat;
        await loadData();
      },
    });
  } else {
    currentCategory.value = cat;
    loadData();
  }
}

/** 期初余额变更标 dirty */
function handleOpeningBalanceChange(row: SubjectRow) {
  row.__dirty = true;
}

/** 批量保存期初余额 */
async function handleSave() {
  const dirtyRows = tableData.value.filter((r) => r.__dirty && r.id);
  if (dirtyRows.length === 0) {
    message.warning('没有需要保存的改动');
    return;
  }
  saving.value = true;
  try {
    await batchUpdateOpeningBalance({
      items: dirtyRows.map((r) => ({
        id: r.id!,
        openingBalance: r.openingBalance ?? 0,
      })),
    });
    message.success(`保存成功（共 ${dirtyRows.length} 条）`);
    await loadData();
  } finally {
    saving.value = false;
  }
}

/** 新增一级科目（不带父编码） */
function handleCreate() {
  formModalApi
    .setData({
      subjectCategory: currentCategory.value,
      subjectLevel: 1,
      enable: true,
    })
    .open();
}

/** 新增子科目（带父编码） */
function handleCreateChild(row: SubjectRow) {
  formModalApi
    .setData({
      subjectCategory: row.subjectCategory ?? currentCategory.value,
      parentCode: row.subjectCode,
      subjectLevel: (row.subjectLevel ?? 1) + 1,
      balanceDirection: row.balanceDirection,
      enable: true,
    })
    .open();
}

/** 编辑科目 */
function handleEdit(row: SubjectRow) {
  formModalApi.setData({ id: row.id }).open();
}

/** 删除科目 */
async function handleDelete(row: SubjectRow) {
  if (!row.id) return;
  await deleteAccountingSubject(row.id);
  message.success('删除成功');
  await loadData();
}

/** 导出当前类目 */
async function handleExport() {
  const selectedIds = selectedRowKeys.value
    .map((id) => Number(id))
    .filter((id) => !Number.isNaN(id));
  const data = await exportAccountingSubject(
    selectedIds.length > 0
      ? { ids: selectedIds }
      : { category: currentCategory.value },
  );
  downloadFileFromBlobPart({ fileName: '会计科目.xls', source: data });
}

function handleSelectionChange(keys: Key[]) {
  selectedRowKeys.value = keys;
}

/** 打开 Excel 导入弹窗 */
function handleImport() {
  importFormModalApi.open();
}

useAccountingShortcut({
  onCreate: handleCreate,
  onImport: handleImport,
});

/** 表格列定义 */
const tableColumns = computed<TableColumnsType<SubjectRow>>(() => [
  {
    title: '序号',
    key: 'index',
    width: 60,
    align: 'center',
    customRender: ({ index }) => index + 1,
  },
  {
    title: '科目编码',
    dataIndex: 'subjectCode',
    key: 'subjectCode',
    width: 240,
    customRender: ({ record }) => {
      const level = record.subjectLevel ?? 1;
      const indent = (level - 1) * 24;
      const isTop = level === 1;
      const children: any[] = [];
      if (!isTop) {
        children.push(
          h(
            'span',
            {
              style: {
                color: '#bfbfbf',
                fontFamily: 'monospace',
                marginRight: '4px',
              },
            },
            '└─',
          ),
        );
      }
      children.push(
        h(
          'span',
          {
            style: {
              fontWeight: isTop ? 600 : 400,
              color: isTop ? '#1677ff' : 'inherit',
            },
          },
          record.subjectCode,
        ),
      );
      children.push(
        h(
          Tag,
          { color: isTop ? 'blue' : 'default', style: { marginLeft: '6px' } },
          () => (isTop ? '一级' : `${level}级`),
        ),
      );
      return h(
        'span',
        {
          style: {
            paddingLeft: `${indent}px`,
            display: 'inline-flex',
            alignItems: 'center',
          },
        },
        children,
      );
    },
  },
  {
    title: '科目名称',
    dataIndex: 'subjectName',
    key: 'subjectName',
    width: 240,
    customRender: ({ record }) => {
      const isTop = (record.subjectLevel ?? 1) === 1;
      const text =
        record.shortName && record.shortName !== record.subjectName
          ? `${record.subjectName}（${record.shortName}）`
          : record.subjectName;
      return h(
        'span',
        {
          style: {
            fontWeight: isTop ? 600 : 400,
            color: isTop ? '#1677ff' : 'inherit',
          },
        },
        text,
      );
    },
  },
  {
    title: '余额方向',
    dataIndex: 'balanceDirection',
    key: 'balanceDirection',
    width: 100,
    align: 'center',
    customRender: ({ record }) =>
      BALANCE_DIRECTION_MAP[record.balanceDirection ?? 0] ?? '-',
  },
  {
    title: '期初余额',
    dataIndex: 'openingBalance',
    key: 'openingBalance',
    width: 180,
    align: 'right',
  },
  {
    title: '辅助核算',
    dataIndex: 'auxiliaryTypes',
    key: 'auxiliaryTypes',
    width: 200,
    customRender: ({ record }) => formatAuxiliaryTypes(record.auxiliaryTypes),
  },
  {
    title: '是否启用',
    dataIndex: 'enable',
    key: 'enable',
    width: 100,
    align: 'center',
  },
  {
    title: '操作',
    key: 'actions',
    width: 220,
    fixed: 'right',
  },
]);

onMounted(() => loadData());
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="loadData" />
    <ImportFormModal @success="loadData" />

    <div class="bg-white p-4">
      <Alert
        class="mb-3"
        type="info"
        show-icon
        message="试算期初余额导入：先按科目大类切换 Tab，再录入或通过 Excel 导入期初余额；编辑后点击保存提交。新增 / 编辑科目使用顶部「新增科目」按钮或行内「新增子级 / 编辑」按钮。"
      />

      <Tabs
        :active-key="currentCategory"
        type="card"
        @change="handleCategoryChange"
      >
        <Tabs.TabPane
          v-for="opt in SUBJECT_CATEGORY_OPTIONS"
          :key="opt.value"
          :tab="opt.label"
        />
      </Tabs>

      <div class="mb-3 flex items-center justify-between">
        <Space title="Insert 新增 / I 导入">
          <Button type="primary" @click="handleCreate">新增科目</Button>
          <Button @click="handleImport">导入 Excel</Button>
          <Button @click="handleExport">导出当前类目</Button>
        </Space>
        <Space>
          <span v-if="dirtyCount > 0" class="text-orange-500">
            待保存 {{ dirtyCount }} 行
          </span>
          <Button type="primary" :loading="saving" @click="handleSave">
            保存期初余额
          </Button>
        </Space>
      </div>

      <Table
        :data-source="tableData"
        :columns="tableColumns"
        :pagination="false"
        :loading="loading"
        row-key="id"
        :row-selection="{
          selectedRowKeys,
          onChange: handleSelectionChange,
        }"
        size="middle"
        bordered
        :scroll="{ x: 'max-content', y: 'calc(100vh - 380px)' }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'openingBalance'">
            <InputNumber
              v-model:value="record.openingBalance"
              :precision="2"
              :step="0.01"
              :min="0"
              style="width: 100%"
              placeholder="0.00"
              @change="handleOpeningBalanceChange(record)"
            />
          </template>
          <template v-else-if="column.key === 'enable'">
            <Tag :color="record.enable ? 'green' : 'default'">
              {{ record.enable ? '启用' : '禁用' }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'actions'">
            <Space>
              <a @click="handleCreateChild(record)">新增子级</a>
              <a @click="handleEdit(record)">编辑</a>
              <Popconfirm
                title="确定删除该科目吗？"
                ok-text="确定"
                cancel-text="取消"
                @confirm="handleDelete(record)"
              >
                <a class="text-red-500">删除</a>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>
    </div>
  </Page>
</template>
