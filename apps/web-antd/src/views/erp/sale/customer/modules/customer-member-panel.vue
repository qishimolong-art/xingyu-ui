<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';
import type { ErpCustomerApi } from '#/api/erp/sale/customer';
import type { MemberUserApi } from '#/api/member/user';

import { computed, reactive, ref, onBeforeUnmount } from 'vue';
import CustomerItemGrid from './customer-item-grid.vue';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';

import { useAccess } from '@vben/access';

import {
  Form as AForm,
  Modal as AModal,
  Button,
  Empty,
  FormItem,
  Input,
  message,
  Popconfirm,
  Tag,
} from 'ant-design-vue';

import {
  createCustomerMember,
  deleteCustomerMember,
  getCustomerMemberPage,
  updateCustomerMemberStatus,
} from '#/api/erp/sale/customer';
import { getUserPage } from '#/api/member/user';

const props = defineProps<{
  customerId?: number;
}>();

const emit = defineEmits<{
  success: [];
}>();

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

const memberGrid = ref<InstanceType<typeof CustomerItemGrid>>();
let sequence = 0;
onBeforeUnmount(() => {
  sequence += 1;
});
const saving = ref(false);
const modalVisible = ref(false);
const memberOptions = ref<MemberUserApi.User[]>([]);
const memberLoading = ref(false);
const formState = reactive({
  memberUserId: undefined as number | undefined,
  remark: '',
});

const columns = computed<TableColumnsType<ErpCustomerApi.CustomerMember>>(
  () => {
    const baseColumns: TableColumnsType<ErpCustomerApi.CustomerMember> = [
      { title: '会员ID', dataIndex: 'memberUserId', width: 100 },
      { title: '手机号快照', dataIndex: 'mobile', width: 140 },
      { title: '会员昵称', dataIndex: 'memberNickname', width: 140 },
      { title: '状态', dataIndex: 'status', width: 90 },
      { title: '备注', dataIndex: 'remark', width: 220 },
      { title: '创建时间', dataIndex: 'createTime', width: 170 },
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

function statusLabel(status?: number) {
  return status === ENABLE_STATUS ? '启用' : '停用';
}

function statusColor(status?: number) {
  return status === ENABLE_STATUS ? 'green' : 'default';
}

function memberOptionLabel(member: MemberUserApi.User) {
  const mobile = member.mobile || '无手机号';
  const nickname = member.nickname || member.name || '未设置昵称';
  return `${mobile} / ${nickname} / ID:${member.id}${member.status === DISABLE_STATUS ? ' / 已停用' : ''}`;
}

async function loadData(deleted = false) {
  await memberGrid.value?.refreshCurrent(deleted);
}
async function getMemberOptionsPage(params: any) {
  const search = String(params.keyword ?? '').trim();
  const page = await getUserPage({
    pageNo: params.pageNo,
    pageSize: params.pageSize,
    ...(search
      ? /^\d+$/.test(search)
        ? { mobile: search }
        : { nickname: search }
      : {}),
  });
  return {
    ...page,
    list: (page.list ?? []).map((member) => ({
      ...member,
      label: memberOptionLabel(member),
      disabled: member.status === DISABLE_STATUS,
    })),
  };
}

function openCreateModal() {
  formState.memberUserId = undefined;
  formState.remark = '';
  modalVisible.value = true;
}

async function handleCreate() {
  if (saving.value || !canCreate.value) return;
  const current = sequence;
  const id = props.customerId;
  if (!props.customerId || !formState.memberUserId) {
    message.warning('请选择会员用户');
    return;
  }
  saving.value = true;
  try {
    await createCustomerMember({
      customerId: props.customerId,
      memberUserId: formState.memberUserId,
      remark: formState.remark,
    });
    if (current !== sequence || id !== props.customerId) return;
    modalVisible.value = false;
    message.success('绑定成功');
    await loadData();
    emit('success');
  } finally {
    if (current === sequence) saving.value = false;
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
  if (!record.id || !canDelete.value || saving.value) return;
  await deleteCustomerMember(record.id);
  message.success('删除成功');
  await loadData(true);
  emit('success');
}
</script>

<template>
  <div class="customer-member-panel erp-form-focus-highlight">
    <div class="customer-detail-tab-toolbar">
      <Button v-if="canCreate" type="primary" @click="openCreateModal">
        新增授权会员
      </Button>
    </div>
    <CustomerItemGrid
      ref="memberGrid"
      :active="true"
      :api="getCustomerMemberPage"
      :customer-id="customerId"
      :can-maintain="hasRowActions"
      :action-width="canUpdate && canDelete ? 106 : 62"
      grid-key="members"
      :columns="columns"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'status'">
          <Tag :color="statusColor(record.status)">
            {{ statusLabel(record.status) }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'memberNickname'">
          {{ record.memberNickname || '-' }}
        </template>
        <template v-else-if="column.dataIndex === 'remark'">
          {{ record.remark || '-' }}
        </template>
        <template v-else-if="column.dataIndex === 'actions'">
          <Popconfirm
            v-if="canUpdate"
            :title="
              record.status === ENABLE_STATUS
                ? '确认停用该授权会员？'
                : '确认启用该授权会员？'
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
    </CustomerItemGrid>

    <AModal
      @cancel="
        sequence += 1;
        saving = false;
      "
      v-model:open="modalVisible"
      :confirm-loading="saving"
      destroy-on-close
      title="新增小程序授权会员"
      @ok="handleCreate"
    >
      <AForm :label-col="{ style: { width: '96px' } }" :model="formState">
        <FormItem label="会员用户" required>
          <ErpLazyPageSelect
            v-model:value="formState.memberUserId"
            :api="getMemberOptionsPage"
            label-field="label"
            value-field="id"
            :page-size="20"
            placeholder="请输入手机号或昵称搜索"
            class="w-full"
          />
        </FormItem>
        <FormItem label="备注">
          <Input.TextArea
            v-model:value="formState.remark"
            :rows="3"
            placeholder="请输入备注"
          />
        </FormItem>
        <Empty
          v-if="!memberLoading && memberOptions.length === 0"
          description="没有可选择的会员"
        />
      </AForm>
    </AModal>
  </div>
</template>

<style scoped>
.customer-member-panel {
  min-width: 0;
}

.customer-member-option {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.customer-member-option > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.customer-member-option__tag {
  flex-shrink: 0;
  margin-inline-end: 0;
}
</style>
