<script lang="ts" setup>
import type { ErpWarehouseApi } from '#/api/erp/stock/warehouse';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';

import { Alert, Button, message } from 'ant-design-vue';

import {
  getWarehouseAssignableUsersPage,
  getWarehouseUserPermissions,
  saveWarehouseUserPermissions,
} from '#/api/erp/stock/warehouse';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';

import '#/views/erp/styles/form-focus.css';

const emit = defineEmits(['success']);
const { hasAccessByCodes } = useAccess();
const warehouse = ref<ErpWarehouseApi.Warehouse>();
const selectedUserIds = ref<number[]>([]);
const knownUsers = ref<
  Array<{ disabled?: boolean; label: string; value: number }>
>([]);
const userOptions = computed(() =>
  knownUsers.value.filter((option) =>
    selectedUserIds.value.includes(option.value),
  ),
);
const loading = ref(false);
const loaded = ref(false);
const error = ref('');
const saving = ref(false);
let sequence = 0;
const canSave = computed(
  () =>
    loaded.value &&
    !loading.value &&
    !saving.value &&
    !error.value &&
    hasAccessByCodes(['erp:warehouse-permission:update']),
);
const invalidSelected = computed(() =>
  selectedUserIds.value.some(
    (id) =>
      !knownUsers.value.some(
        (option) => option.value === id && !option.disabled,
      ),
  ),
);
function removeInvalidSelected() {
  if (!canSave.value) return;
  selectedUserIds.value = selectedUserIds.value.filter((id) =>
    knownUsers.value.some((option) => option.value === id && !option.disabled),
  );
}
function rememberOptions(options: Array<Record<string, any>>) {
  const map = new Map(
    knownUsers.value
      .filter((option) => selectedUserIds.value.includes(option.value))
      .map((option) => [option.value, option]),
  );
  options.forEach((option) => {
    const id = Number(option.value ?? option.id);
    if (Number.isFinite(id))
      map.set(id, {
        label: String(option.label ?? option.nickname ?? `用户 #${id}`),
        value: id,
        disabled: Boolean(option.disabled),
      });
  });
  knownUsers.value = [...map.values()];
}
async function loadUserPage(params: {
  keyword?: string;
  pageNo: number;
  pageSize: number;
}) {
  const page = await getWarehouseAssignableUsersPage(params);
  return {
    ...page,
    list: (page.list || []).map((user) => ({
      ...user,
      label:
        [user.nickname, user.mobile].filter(Boolean).join(' / ') ||
        `用户 #${user.id}`,
      value: user.id,
    })),
  };
}
const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (!canSave.value || !warehouse.value?.id) return;
    if (invalidSelected.value) {
      message.warning('请先移除已停用或已不存在的人员，再保存');
      return;
    }
    saving.value = true;
    modalApi.lock();
    try {
      await saveWarehouseUserPermissions({
        warehouseId: warehouse.value.id,
        userIds: [...selectedUserIds.value],
      });
      await modalApi.close();
      emit('success');
      message.success('保存成功');
    } finally {
      saving.value = false;
      modalApi.unlock();
    }
  },
  async onOpenChange(open: boolean) {
    const current = ++sequence;
    loaded.value = false;
    selectedUserIds.value = [];
    knownUsers.value = [];
    error.value = '';
    if (!open) {
      warehouse.value = undefined;
      loading.value = false;
      return;
    }
    warehouse.value = modalApi.getData<ErpWarehouseApi.Warehouse>();
    if (!warehouse.value?.id) return;
    loading.value = true;
    try {
      const data = await getWarehouseUserPermissions(warehouse.value.id);
      if (current !== sequence) return;
      selectedUserIds.value = [...(data.userIds || [])];
      const users = new Map(
        (data.selectedUsers || []).map((user) => [user.id, user]),
      );
      knownUsers.value = selectedUserIds.value.map((id) => {
        const user = users.get(id);
        const disabled = !user || user.status !== 0;
        return {
          value: id,
          disabled,
          label: `${user?.nickname || `用户 #${id}`}${disabled ? '（已停用或不存在，请移除）' : ''}`,
        };
      });
      loaded.value = true;
    } catch {
      if (current === sequence)
        error.value = '原配置加载失败，请关闭后重试；当前无法保存。';
    } finally {
      if (current === sequence) loading.value = false;
    }
  },
});
</script>
<template>
  <Modal
    :title="`人员权限 - ${warehouse?.name ?? ''}`"
    class="w-[640px] max-w-[calc(100vw-32px)]"
    :confirm-disabled="!canSave"
  >
    <div class="erp-form-focus-highlight mx-4 my-4 space-y-3 text-xs">
      <Alert v-if="error" type="error" :message="error" show-icon />
      <Alert
        v-if="invalidSelected"
        type="warning"
        message="已选人员中存在停用或缺失账号，请明确移除后保存。"
        show-icon
      />
      <Button
        v-if="invalidSelected"
        size="small"
        :disabled="!canSave"
        @click="removeInvalidSelected"
      >
        移除已停用或不存在的已选人员
      </Button>
      <ErpLazyPageSelect
        v-model:value="selectedUserIds"
        :api="loadUserPage"
        :options="userOptions"
        :disabled="!loaded || loading || saving"
        :page-size="20"
        class="w-full"
        mode="multiple"
        max-tag-count="responsive"
        placeholder="搜索并选择人员"
        @options-change="rememberOptions"
      />
      <div>已选 {{ selectedUserIds.length }} 人</div>
      <div class="text-gray-400">
        维护额外查看授权；用户本部门仓库的可见规则不受影响。
      </div>
    </div>
  </Modal>
</template>
