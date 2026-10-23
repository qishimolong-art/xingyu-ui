<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';
import type { ErpCustomerApi } from '#/api/erp/sale/customer';
import type { MemberUserApi } from '#/api/member/user';

import { computed, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';

import {
  Form as AForm,
  Alert,
  Button,
  FormItem,
  Input,
  message,
  Popconfirm,
  Select,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  createCustomerMember,
  deleteCustomerMember,
  getCustomerMemberListByMember,
  getCustomerSimpleList,
  updateCustomerMemberStatus,
} from '#/api/erp/sale/customer';

const emit = defineEmits(['success']);

const ENABLE_STATUS = 0;
const DISABLE_STATUS = 1;
const { hasAccessByCodes } = useAccess();

const canCreate = computed(() =>
  hasAccessByCodes(['erp:customer-member:create']),
);
const canUpdate = computed(() =>
  hasAccessByCodes(['erp:customer-member:update']),
);
const canDelete = computed(() =>
  hasAccessByCodes(['erp:customer-member:delete']),
);
const hasRowActions = computed(() => canUpdate.value || canDelete.value);

const memberUser = ref<MemberUserApi.User>();
const loading = ref(false);
const saving = ref(false);
const list = ref<ErpCustomerApi.CustomerMember[]>([]);
const customerOptions = ref<ErpCustomerApi.Customer[]>([]);
const customerLoading = ref(false);
const formState = reactive({
  customerId: undefined as number | undefined,
  remark: '',
});

const modalTitle = computed(() => {
  const label =
    memberUser.value?.mobile ||
    memberUser.value?.nickname ||
    memberUser.value?.id;
  return label ? `客户会员授权 - ${label}` : '客户会员授权';
});

const columns = computed<TableColumnsType<ErpCustomerApi.CustomerMember>>(
  () => {
    const baseColumns: TableColumnsType<ErpCustomerApi.CustomerMember> = [
      { title: '客户ID', dataIndex: 'customerId', width: 90 },
      { title: '客户名称', dataIndex: 'customerName', width: 180 },
      { title: '手机号快照', dataIndex: 'mobile', width: 130 },
      { title: '状态', dataIndex: 'status', width: 90 },
      { title: '备注', dataIndex: 'remark', width: 180 },
      { title: '创建时间', dataIndex: 'createTime', width: 165 },
    ];
    if (hasRowActions.value) {
      baseColumns.push({
        title: '操作',
        dataIndex: 'actions',
        fixed: 'right',
        width: 150,
      });
    }
    return baseColumns;
  },
);

const [Modal, modalApi] = useVbenModal({
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      memberUser.value = undefined;
      list.value = [];
      formState.customerId = undefined;
      formState.remark = '';
      return;
    }
    memberUser.value = modalApi.getData<MemberUserApi.User>();
    await Promise.all([loadData(), loadCustomerOptions()]);
  },
});

function statusLabel(status?: number) {
  return status === ENABLE_STATUS ? '启用' : '停用';
}

function statusColor(status?: number) {
  return status === ENABLE_STATUS ? 'green' : 'default';
}

function customerOptionLabel(customer: ErpCustomerApi.Customer) {
  const code = customer.code ? `${customer.code} / ` : '';
  const disabled = customer.status === DISABLE_STATUS ? ' / 已停用' : '';
  return `${code}${customer.name} / ID:${customer.id}${disabled}`;
}

function filterCustomerOption(input: string, option: any) {
  return String(option?.label ?? '')
    .toLowerCase()
    .includes(input.toLowerCase());
}

async function loadData() {
  if (!memberUser.value?.id) {
    list.value = [];
    return;
  }
  loading.value = true;
  try {
    list.value = await getCustomerMemberListByMember(memberUser.value.id);
  } finally {
    loading.value = false;
  }
}

async function loadCustomerOptions() {
  if (customerOptions.value.length > 0) {
    return;
  }
  customerLoading.value = true;
  try {
    customerOptions.value = await getCustomerSimpleList();
  } finally {
    customerLoading.value = false;
  }
}

async function handleCreate() {
  if (!memberUser.value?.id || !formState.customerId) {
    message.warning('请选择 ERP 客户');
    return;
  }
  saving.value = true;
  try {
    await createCustomerMember({
      customerId: formState.customerId,
      memberUserId: memberUser.value.id,
      remark: formState.remark,
    });
    formState.customerId = undefined;
    formState.remark = '';
    message.success('绑定成功');
    await loadData();
    emit('success');
  } finally {
    saving.value = false;
  }
}

async function handleToggleStatus(record: Record<string, any>) {
  if (!record.id) return;
  await updateCustomerMemberStatus({
    id: record.id,
    status: record.status === ENABLE_STATUS ? DISABLE_STATUS : ENABLE_STATUS,
  });
  message.success(record.status === ENABLE_STATUS ? '已停用' : '已启用');
  await loadData();
  emit('success');
}

async function handleDelete(record: Record<string, any>) {
  if (!record.id) return;
  await deleteCustomerMember(record.id);
  message.success('删除成功');
  await loadData();
  emit('success');
}
</script>

<template>
  <Modal :footer="false" :title="modalTitle" class="!w-[900px] max-w-[96vw]">
    <div class="member-customer-member-form">
      <Alert
        class="member-customer-member-form__notice"
        message="同一会员暂只支持启用绑定一个客户；如需更换客户，请先停用或删除原授权。"
        show-icon
        type="info"
      />
      <AForm
        v-if="canCreate"
        :label-col="{ style: { width: '76px' } }"
        :model="formState"
        class="member-customer-member-form__create"
        layout="inline"
      >
        <FormItem label="ERP客户" required>
          <Select
            v-model:value="formState.customerId"
            :filter-option="filterCustomerOption"
            :loading="customerLoading"
            class="member-customer-member-form__customer"
            option-label-prop="label"
            placeholder="请选择 ERP 客户"
            show-search
            @focus="loadCustomerOptions"
          >
            <Select.Option
              v-for="customer in customerOptions"
              :key="customer.id"
              :label="customerOptionLabel(customer)"
              :value="customer.id"
            >
              <div class="member-customer-member-form__option">
                <span>{{ customerOptionLabel(customer) }}</span>
                <Tag
                  v-if="customer.status === DISABLE_STATUS"
                  class="member-customer-member-form__tag"
                >
                  已停用
                </Tag>
              </div>
            </Select.Option>
          </Select>
        </FormItem>
        <FormItem label="备注">
          <Input
            v-model:value="formState.remark"
            class="member-customer-member-form__remark"
            placeholder="请输入备注"
          />
        </FormItem>
        <Button :loading="saving" type="primary" @click="handleCreate">
          新增绑定
        </Button>
      </AForm>

      <Table
        :columns="columns"
        :data-source="list"
        :loading="loading"
        :locale="{ emptyText: '暂无客户会员授权' }"
        :pagination="false"
        :row-key="(row) => row.id"
        :scroll="{ x: 'max-content', y: 'calc(70vh - 240px)' }"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'status'">
            <Tag :color="statusColor(record.status)">
              {{ statusLabel(record.status) }}
            </Tag>
          </template>
          <template v-else-if="column.dataIndex === 'customerName'">
            {{ record.customerName || '-' }}
          </template>
          <template v-else-if="column.dataIndex === 'remark'">
            {{ record.remark || '-' }}
          </template>
          <template v-else-if="column.dataIndex === 'actions'">
            <Popconfirm
              v-if="canUpdate"
              :title="
                record.status === ENABLE_STATUS
                  ? '确认停用该授权？'
                  : '确认启用该授权？'
              "
              @confirm="handleToggleStatus(record)"
            >
              <Button size="small" type="link">
                {{ record.status === ENABLE_STATUS ? '停用' : '启用' }}
              </Button>
            </Popconfirm>
            <Popconfirm
              v-if="canDelete"
              title="确认删除该授权关系？"
              @confirm="handleDelete(record)"
            >
              <Button danger size="small" type="link">删除</Button>
            </Popconfirm>
          </template>
        </template>
      </Table>
    </div>
  </Modal>
</template>

<style scoped>
.member-customer-member-form {
  min-width: 0;
}

.member-customer-member-form__notice {
  margin-bottom: 12px;
}

.member-customer-member-form__create {
  margin-bottom: 12px;
}

.member-customer-member-form__customer {
  width: min(360px, 52vw);
}

.member-customer-member-form__remark {
  width: min(220px, 34vw);
}

.member-customer-member-form__option {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.member-customer-member-form__option > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-customer-member-form__tag {
  flex-shrink: 0;
  margin-inline-end: 0;
}
</style>
