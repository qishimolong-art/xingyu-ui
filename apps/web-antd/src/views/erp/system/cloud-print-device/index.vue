<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';
import type { FormInstance } from 'ant-design-vue/es/form';

import type { ErpPrintApi } from '#/api/erp/print';
import type { SystemDeptApi } from '#/api/system/dept';

import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { CommonStatusEnum } from '@vben/constants';

import {
  Alert,
  Button,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  RadioButton,
  RadioGroup,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  TreeSelect,
} from 'ant-design-vue';

import {
  createCloudPrintDevice,
  deleteCloudPrintDevice,
  getCloudPrintDevice,
  getCloudPrintDevicePage,
  refreshCloudPrintDeviceStatus,
  resumeCloudPrintQueue,
  setDefaultCloudPrintDevice,
  updateCloudPrintDevice,
  updateCloudPrintDeviceStatus,
} from '#/api/erp/print';
import { getSimpleDeptList } from '#/api/system/dept';

defineOptions({ name: 'ErpCloudPrintDevice' });

type Device = ErpPrintApi.CloudPrintDevice;

const DEV_TYPE_DOT_MATRIX = 4;
const CONTENT_TYPE_PDF = 7;

const { hasAccessByCodes } = useAccess();
const formRef = ref<FormInstance>();
const loading = ref(false);
const saving = ref(false);
const modalOpen = ref(false);
const resumeModalOpen = ref(false);
const resumeSaving = ref(false);
const resumeDevice = ref<Device>();
const resumeAction = ref<'RETRY' | 'SKIP'>('RETRY');
const editingId = ref<number>();
const devices = ref<Device[]>([]);
const deptTree = ref<SystemDeptApi.Dept[]>([]);
const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
});
const query = reactive({
  keyword: '',
  devType: undefined as number | undefined,
  contentType: undefined as number | undefined,
  status: undefined as number | undefined,
  onlineState: undefined as number | undefined,
  deptId: undefined as number | undefined,
});
const formModel = reactive<Device>({
  contentType: CONTENT_TYPE_PDF,
  copies: 1,
  defaulted: false,
  devType: DEV_TYPE_DOT_MATRIX,
  paperType: 4,
  printHeight: 140,
  printWidth: 241,
  rotate: 0,
  status: CommonStatusEnum.ENABLE,
});

const canCreate = computed(() =>
  hasAccessByCodes(['erp:cloud-print-device:create']),
);
const canUpdate = computed(() =>
  hasAccessByCodes(['erp:cloud-print-device:update']),
);
const canDelete = computed(() =>
  hasAccessByCodes(['erp:cloud-print-device:delete']),
);
const canStatus = computed(() =>
  hasAccessByCodes(['erp:cloud-print-device:status']),
);
const canDefault = computed(() =>
  hasAccessByCodes(['erp:cloud-print-device:default']),
);
const canRefresh = computed(() =>
  hasAccessByCodes(['erp:cloud-print-device:refresh']),
);
const modalTitle = computed(() =>
  editingId.value ? '编辑云打印设备' : '新增云打印设备',
);

const devTypeOptions = [
  { label: '80mm热敏', value: 1 },
  { label: '标签', value: 2 },
  { label: 'A4盒子', value: 3 },
  { label: '针式', value: DEV_TYPE_DOT_MATRIX },
];
const contentTypeOptions = [
  { label: 'PDF', value: CONTENT_TYPE_PDF },
  { label: 'HTML', value: 9 },
];
const statusOptions = [
  { label: '启用', value: CommonStatusEnum.ENABLE },
  { label: '停用', value: CommonStatusEnum.DISABLE },
];
const onlineOptions = [
  { label: '在线', value: 1 },
  { label: '离线', value: 0 },
];
const columns: TableColumnsType<Device> = [
  { dataIndex: 'nickname', key: 'nickname', title: '设备别名', width: 180 },
  { dataIndex: 'devid', key: 'devid', title: '机械码', width: 160 },
  { key: 'devType', title: '设备类型', width: 110 },
  { key: 'contentType', title: '内容类型', width: 100 },
  { key: 'paperSize', title: '纸张尺寸', width: 120 },
  { dataIndex: 'copies', key: 'copies', title: '份数', width: 80 },
  { dataIndex: 'deptName', key: 'deptName', title: '所属部门', width: 130 },
  { key: 'defaulted', title: '默认', width: 90 },
  { key: 'status', title: '启用状态', width: 100 },
  { key: 'onlineState', title: '在线状态', width: 110 },
  { key: 'deviceFault', title: '设备故障状态', width: 180 },
  { key: 'queueState', title: '队列状态', width: 130 },
  {
    dataIndex: 'currentTask',
    key: 'currentTask',
    title: '当前任务',
    width: 210,
  },
  {
    dataIndex: 'pendingCount',
    key: 'pendingCount',
    title: '待打印',
    width: 90,
  },
  {
    dataIndex: 'lastCallbackTime',
    key: 'lastCallbackTime',
    title: '最后回调时间',
    width: 170,
  },
  {
    dataIndex: 'lastStatusTime',
    key: 'lastStatusTime',
    title: '最近检查时间',
    width: 170,
  },
  {
    dataIndex: 'remark',
    ellipsis: true,
    key: 'remark',
    title: '备注',
    width: 180,
  },
  { fixed: 'right', key: 'actions', title: '操作', width: 340 },
];

function optionLabel(
  options: { label: string; value: number }[],
  value?: number,
) {
  return options.find((item) => item.value === value)?.label || '-';
}

function onlineMeta(value?: number) {
  if (value === 1) return { color: 'green', text: '在线' };
  if (value === 0) return { color: 'red', text: '离线' };
  return { color: 'default', text: '未知' };
}

function resetFormModel() {
  Object.assign(formModel, {
    contentType: CONTENT_TYPE_PDF,
    copies: 1,
    defaulted: false,
    deptId: undefined,
    devid: '',
    devKey: '',
    devType: DEV_TYPE_DOT_MATRIX,
    id: undefined,
    nickname: '',
    paperType: 4,
    printHeight: 140,
    printWidth: 241,
    remark: '',
    rotate: 0,
    status: CommonStatusEnum.ENABLE,
  });
}

async function loadDevices(
  pageNo = pagination.current,
  pageSize = pagination.pageSize,
) {
  loading.value = true;
  try {
    const result = await getCloudPrintDevicePage({
      pageNo,
      pageSize,
      ...query,
    });
    devices.value = result.list || [];
    pagination.current = pageNo;
    pagination.pageSize = pageSize;
    pagination.total = Number(result.total || 0);
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  void loadDevices(1, pagination.pageSize);
}

function handleResetSearch() {
  Object.assign(query, {
    contentType: undefined,
    deptId: undefined,
    devType: undefined,
    keyword: '',
    onlineState: undefined,
    status: undefined,
  });
  handleSearch();
}

function handleCreate() {
  editingId.value = undefined;
  resetFormModel();
  formRef.value?.resetFields();
  modalOpen.value = true;
}

async function handleEdit(row: Device) {
  editingId.value = row.id;
  resetFormModel();
  modalOpen.value = true;
  const detail = await getCloudPrintDevice(row.id!);
  Object.assign(formModel, detail, { devKey: '' });
  formRef.value?.clearValidate();
}

async function handleSubmit() {
  await formRef.value?.validate();
  saving.value = true;
  try {
    const data: Device = { ...formModel, id: editingId.value };
    if (!data.devKey) {
      delete data.devKey;
    }
    await (editingId.value
      ? updateCloudPrintDevice(data)
      : createCloudPrintDevice(data));
    message.success('云打印设备已保存');
    modalOpen.value = false;
    await loadDevices();
  } finally {
    saving.value = false;
  }
}

async function handleDelete(row: Device) {
  await deleteCloudPrintDevice(row.id!);
  message.success('云打印设备已删除');
  await loadDevices();
}

async function handleStatusChange(row: Device, checked: boolean) {
  await updateCloudPrintDeviceStatus(
    row.id!,
    checked ? CommonStatusEnum.ENABLE : CommonStatusEnum.DISABLE,
  );
  message.success(checked ? '设备已启用' : '设备已停用');
  await loadDevices();
}

async function handleSetDefault(row: Device) {
  await setDefaultCloudPrintDevice(row.id!);
  message.success('默认云打印设备已更新');
  await loadDevices();
}

async function handleRefreshStatus(row: Device) {
  await refreshCloudPrintDeviceStatus(row.id!);
  message.success('在线状态已刷新');
  await loadDevices();
}

function handleOpenResume(row: Device) {
  resumeDevice.value = row;
  resumeAction.value = 'RETRY';
  resumeModalOpen.value = true;
}

async function handleResumeQueue() {
  if (!resumeDevice.value?.id) return;
  resumeSaving.value = true;
  try {
    await resumeCloudPrintQueue({
      deviceId: resumeDevice.value.id,
      failedTaskAction: resumeAction.value,
    });
    message.success(
      resumeAction.value === 'RETRY'
        ? '已生成重试任务并恢复队列'
        : '已跳过故障任务并恢复队列',
    );
    resumeModalOpen.value = false;
    await loadDevices();
  } finally {
    resumeSaving.value = false;
  }
}

function handleTableChange(page: any) {
  void loadDevices(page.current, page.pageSize);
}

onMounted(async () => {
  const [depts] = await Promise.all([getSimpleDeptList(), loadDevices(1)]);
  deptTree.value = depts;
});
</script>

<template>
  <Page auto-content-height title="云打印设备">
    <div class="cloud-print-device-page">
      <div class="query-bar">
        <Input
          v-model:value="query.keyword"
          allow-clear
          class="w-[230px]"
          placeholder="搜索设备别名或机械码"
          @press-enter="handleSearch"
        />
        <Select
          v-model:value="query.devType"
          allow-clear
          class="w-[130px]"
          :options="devTypeOptions"
          placeholder="设备类型"
        />
        <Select
          v-model:value="query.contentType"
          allow-clear
          class="w-[120px]"
          :options="contentTypeOptions"
          placeholder="内容类型"
        />
        <Select
          v-model:value="query.status"
          allow-clear
          class="w-[110px]"
          :options="statusOptions"
          placeholder="启用状态"
        />
        <Select
          v-model:value="query.onlineState"
          allow-clear
          class="w-[110px]"
          :options="onlineOptions"
          placeholder="在线状态"
        />
        <TreeSelect
          v-model:value="query.deptId"
          allow-clear
          class="w-[180px]"
          :field-names="{ children: 'children', label: 'name', value: 'id' }"
          :tree-data="deptTree"
          tree-default-expand-all
          placeholder="所属部门"
        />
        <Button type="primary" @click="handleSearch">查询</Button>
        <Button @click="handleResetSearch">重置</Button>
        <Button
          v-if="canCreate"
          type="primary"
          class="ml-auto"
          @click="handleCreate"
        >
          新增
        </Button>
      </div>

      <Table
        bordered
        class="device-table"
        :columns="columns"
        :data-source="devices"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        :scroll="{ x: 2470, y: 'calc(100vh - 310px)' }"
        size="middle"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'devType'">
            {{ optionLabel(devTypeOptions, record.devType) }}
          </template>
          <template v-else-if="column.key === 'contentType'">
            <Tag
              :color="
                record.contentType === CONTENT_TYPE_PDF ? 'blue' : 'orange'
              "
            >
              {{ optionLabel(contentTypeOptions, record.contentType) }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'paperSize'">
            {{ record.printWidth || '-' }} x {{ record.printHeight || '-' }}mm
          </template>
          <template v-else-if="column.key === 'defaulted'">
            <Tag v-if="record.defaulted" color="blue">默认</Tag>
            <span v-else>-</span>
          </template>
          <template v-else-if="column.key === 'status'">
            <Switch
              :checked="record.status === CommonStatusEnum.ENABLE"
              :disabled="!canStatus"
              checked-children="启用"
              un-checked-children="停用"
              @change="
                (checked: boolean) => handleStatusChange(record, checked)
              "
            />
          </template>
          <template v-else-if="column.key === 'onlineState'">
            <Tag :color="onlineMeta(record.onlineState).color">
              {{ onlineMeta(record.onlineState).text }}
            </Tag>
          </template>
          <template v-else-if="column.key === 'deviceFault'">
            <Tag
              :color="
                record.lastStatusCode === 0
                  ? 'green'
                  : record.lastStatusCode == null
                    ? 'default'
                    : 'red'
              "
            >
              {{
                record.lastStatusCode == null
                  ? '未知'
                  : `状态 ${record.lastStatusCode}`
              }}
            </Tag>
            <div v-if="record.lastStatusMessage" class="status-message">
              {{ record.lastStatusMessage }}
            </div>
          </template>
          <template v-else-if="column.key === 'queueState'">
            <Tag v-if="record.queuePaused" color="red">已暂停</Tag>
            <Tag v-else-if="record.currentTask" color="blue">打印中</Tag>
            <Tag v-else-if="record.pendingCount" color="orange">等待中</Tag>
            <Tag v-else color="green">正常</Tag>
            <div v-if="record.queuePauseReason" class="queue-pause-reason">
              {{ record.queuePauseReason }}
            </div>
          </template>
          <template v-else-if="column.key === 'actions'">
            <Space>
              <Button
                v-if="record.queuePaused && (canUpdate || canRefresh)"
                danger
                size="small"
                type="link"
                @click="handleOpenResume(record)"
              >
                恢复队列
              </Button>
              <Button
                v-if="canRefresh"
                size="small"
                type="link"
                @click="handleRefreshStatus(record)"
              >
                刷新
              </Button>
              <Button
                v-if="canDefault && !record.defaulted"
                size="small"
                type="link"
                @click="handleSetDefault(record)"
              >
                设默认
              </Button>
              <Button
                v-if="canUpdate"
                size="small"
                type="link"
                @click="handleEdit(record)"
              >
                编辑
              </Button>
              <Popconfirm
                v-if="canDelete"
                title="确认删除该云打印设备？"
                @confirm="handleDelete(record)"
              >
                <Button danger size="small" type="link">删除</Button>
              </Popconfirm>
            </Space>
          </template>
        </template>
      </Table>

      <Modal
        v-model:open="modalOpen"
        :confirm-loading="saving"
        :title="modalTitle"
        width="720px"
        @ok="handleSubmit"
      >
        <Form
          ref="formRef"
          :model="formModel"
          :label-col="{ span: 6 }"
          :wrapper-col="{ span: 17 }"
        >
          <div class="form-grid">
            <FormItem
              label="设备别名"
              name="nickname"
              :rules="[{ required: true, message: '请输入设备别名' }]"
            >
              <Input
                v-model:value="formModel.nickname"
                placeholder="请输入设备别名"
              />
            </FormItem>
            <FormItem
              label="机械码"
              name="devid"
              :rules="[{ required: true, message: '请输入机械码' }]"
            >
              <Input
                v-model:value="formModel.devid"
                placeholder="请输入设备机械码"
              />
            </FormItem>
            <FormItem label="校验码" name="devKey">
              <Input.Password
                v-model:value="formModel.devKey"
                :placeholder="
                  editingId ? '留空表示不修改校验码' : '请输入设备绑定校验码'
                "
              />
            </FormItem>
            <FormItem
              label="设备类型"
              name="devType"
              :rules="[{ required: true, message: '请选择设备类型' }]"
            >
              <Select
                v-model:value="formModel.devType"
                :options="devTypeOptions"
              />
            </FormItem>
            <FormItem
              label="内容类型"
              name="contentType"
              :rules="[{ required: true, message: '请选择内容类型' }]"
            >
              <Select
                v-model:value="formModel.contentType"
                :options="contentTypeOptions"
              />
            </FormItem>
            <FormItem
              label="打印宽度"
              name="printWidth"
              :rules="[{ required: true, message: '请输入打印宽度' }]"
            >
              <InputNumber
                v-model:value="formModel.printWidth"
                class="w-full"
                :min="1"
                addon-after="mm"
              />
            </FormItem>
            <FormItem
              label="纸张高度"
              name="printHeight"
              :rules="[
                {
                  required: formModel.devType === DEV_TYPE_DOT_MATRIX,
                  message: '针式打印机必须填写纸张高度',
                },
              ]"
            >
              <InputNumber
                v-model:value="formModel.printHeight"
                class="w-full"
                :min="1"
                addon-after="mm"
              />
            </FormItem>
            <FormItem label="纸张类型" name="paperType">
              <InputNumber
                v-model:value="formModel.paperType"
                class="w-full"
                :min="0"
              />
            </FormItem>
            <FormItem label="旋转参数" name="rotate">
              <InputNumber
                v-model:value="formModel.rotate"
                class="w-full"
                :min="0"
              />
            </FormItem>
            <FormItem
              label="默认份数"
              name="copies"
              :rules="[{ required: true, message: '请输入默认份数' }]"
            >
              <InputNumber
                v-model:value="formModel.copies"
                class="w-full"
                :min="1"
              />
            </FormItem>
            <FormItem label="所属部门" name="deptId">
              <TreeSelect
                v-model:value="formModel.deptId"
                allow-clear
                :field-names="{
                  children: 'children',
                  label: 'name',
                  value: 'id',
                }"
                :tree-data="deptTree"
                tree-default-expand-all
                placeholder="请选择所属部门"
              />
            </FormItem>
            <FormItem label="启用状态" name="status">
              <RadioGroup
                v-model:value="formModel.status"
                button-style="solid"
                option-type="button"
                :options="statusOptions"
              />
            </FormItem>
            <FormItem label="默认设备" name="defaulted">
              <Switch v-model:checked="formModel.defaulted" />
            </FormItem>
            <FormItem class="form-span-2" label="备注" name="remark">
              <Input.TextArea
                v-model:value="formModel.remark"
                :rows="3"
                placeholder="请输入备注"
              />
            </FormItem>
          </div>
        </Form>
      </Modal>

      <Modal
        v-model:open="resumeModalOpen"
        :confirm-loading="resumeSaving"
        title="处理故障任务并恢复队列"
        width="620px"
        @ok="handleResumeQueue"
      >
        <Alert
          class="mb-4"
          message="重试可能产生重复打印"
          :description="`设备【${resumeDevice?.nickname || '-'}】的原任务可能已经被云平台接收，尤其是超时或结果未知时，迟到回调或迟到出纸仍可能发生。请现场确认后选择。`"
          show-icon
          type="warning"
        />
        <div class="mb-3">
          暂停原因：{{ resumeDevice?.queuePauseReason || '未知' }}
        </div>
        <RadioGroup v-model:value="resumeAction">
          <Space direction="vertical">
            <RadioButton value="RETRY">重试故障任务并恢复</RadioButton>
            <RadioButton value="SKIP">跳过故障任务并恢复</RadioButton>
          </Space>
        </RadioGroup>
      </Modal>
    </div>
  </Page>
</template>

<style scoped>
.cloud-print-device-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
}

.query-bar {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.device-table {
  flex: 1 1 auto;
  min-height: 0;
}

.device-table :deep(.ant-spin-nested-loading),
.device-table :deep(.ant-spin-container) {
  height: 100%;
}

.device-table :deep(.ant-table-body) {
  min-height: max(320px, calc(100vh - 395px));
}

.device-table :deep(.ant-pagination) {
  margin-bottom: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 10px;
}

.form-span-2 {
  grid-column: span 2;
}

.status-message,
.queue-pause-reason {
  margin-top: 4px;
  color: #8c8c8c;
  font-size: 12px;
  line-height: 1.35;
  white-space: normal;
}

.queue-pause-reason {
  color: #cf1322;
}

@media (max-width: 900px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .form-span-2 {
    grid-column: span 1;
  }
}
</style>
