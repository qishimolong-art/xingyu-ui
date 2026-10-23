<script lang="ts" setup>
import type { SystemDeptApi } from '#/api/system/dept';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { CommonStatusEnum } from '@vben/constants';
import { handleTree } from '@vben/utils';

import {
  Form as AForm,
  Checkbox,
  FormItem,
  message,
  Radio,
  RadioGroup,
  Select,
  TreeSelect,
} from 'ant-design-vue';

import { batchUpdateDept, getDeptList } from '#/api/system/dept';
import { getSimpleUserList } from '#/api/system/user';
import { useFieldPermission } from '#/composables/useFieldPermission';

const emit = defineEmits(['success']);

interface BatchEditFormData {
  parentId?: number;
  leaderUserId?: number;
  status?: number;
}

const ids = ref<number[]>([]);
const formData = ref<BatchEditFormData>({});
const updateParent = ref(false);
const updateLeader = ref(false);
const updateStatus = ref(false);
const clearLeader = ref(false);
const userOptions = ref<{ label: string; value: number }[]>([]);
const deptTreeData = ref<any[]>([]);
const { isHidden, loadHiddenFields } = useFieldPermission('system_dept');

function filterSelectOption(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  const label = String(
    option?.label ?? option?.name ?? option?.nickname ?? option?.value ?? '',
  );
  return label.toLowerCase().includes(keyword);
}

function collectDisabledDeptIds(
  rows: SystemDeptApi.Dept[],
  selectedIds: number[],
) {
  const childrenMap = new Map<number, number[]>();
  rows.forEach((row) => {
    const parentId = row.parentId ?? 0;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(row.id!);
  });

  const disabledIds = new Set<number>();
  const appendWithChildren = (id: number) => {
    if (disabledIds.has(id)) {
      return;
    }
    disabledIds.add(id);
    (childrenMap.get(id) || []).forEach((childId) =>
      appendWithChildren(childId),
    );
  };
  selectedIds.forEach((selectedId) => appendWithChildren(selectedId));
  return disabledIds;
}

function markDisabled(nodes: any[], disabledIds: Set<number>): any[] {
  return nodes.map((node) => ({
    ...node,
    disabled: disabledIds.has(node.id),
    children: node.children
      ? markDisabled(node.children, disabledIds)
      : undefined,
  }));
}

async function loadOptions() {
  const [users, depts] = await Promise.all([
    getSimpleUserList(),
    getDeptList(),
  ]);
  userOptions.value = (users || []).map((user: any) => ({
    label: user.nickname || user.name,
    value: user.id,
  }));

  const deptRows = (depts || []) as SystemDeptApi.Dept[];
  const disabledIds = collectDisabledDeptIds(deptRows, ids.value);
  deptTreeData.value = [
    {
      id: 0,
      name: '顶级部门',
      children: markDisabled(handleTree(deptRows), disabledIds),
    },
  ];
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (ids.value.length === 0) {
      message.warning('请先选择要批量修改的部门');
      return;
    }

    const payload: SystemDeptApi.DeptBatchUpdateReq = { ids: ids.value };
    if (!isHidden('parentId') && updateParent.value) {
      payload.updateParentId = true;
      payload.parentId = formData.value.parentId;
    }
    if (!isHidden('leaderUserId') && updateLeader.value) {
      payload.updateLeaderUserId = true;
      if (clearLeader.value) {
        payload.leaderUserId = null;
      } else if (formData.value.leaderUserId === undefined) {
        message.warning('请选择负责人，或勾选清空负责人');
        return;
      } else {
        payload.leaderUserId = formData.value.leaderUserId;
      }
    }
    if (!isHidden('status') && updateStatus.value) {
      if (formData.value.status === undefined) {
        message.warning('请选择要修改的状态');
        return;
      }
      payload.updateStatus = true;
      payload.status = formData.value.status;
    }

    if (
      !payload.updateParentId &&
      !payload.updateLeaderUserId &&
      !payload.updateStatus
    ) {
      message.warning('请至少选择一个需要修改的字段');
      return;
    }

    modalApi.lock();
    try {
      await batchUpdateDept(payload);
      await modalApi.close();
      emit('success');
      message.success(`已批量更新 ${ids.value.length} 个部门`);
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      ids.value = [];
      formData.value = {};
      updateParent.value = false;
      updateLeader.value = false;
      updateStatus.value = false;
      clearLeader.value = false;
      return;
    }
    const data = modalApi.getData<{ ids: number[] }>();
    ids.value = data?.ids || [];
    formData.value = {};
    updateParent.value = false;
    updateLeader.value = false;
    updateStatus.value = false;
    clearLeader.value = false;
    await Promise.all([loadHiddenFields(), loadOptions()]);
  },
});
</script>

<template>
  <Modal :title="`批量修改部门（已选 ${ids.length} 个）`" class="w-[600px]">
    <AForm
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 16 }"
      class="mx-4 my-4"
    >
      <p class="mb-4 text-gray-500">
        勾选需要批量修改的字段，未勾选代表不修改；上级部门勾选后留空表示调整为顶级部门。
      </p>
      <FormItem v-if="!isHidden('parentId')" label="上级部门">
        <Checkbox v-model:checked="updateParent" class="mb-2">
          修改上级部门
        </Checkbox>
        <TreeSelect
          v-model:value="formData.parentId"
          :disabled="!updateParent"
          :tree-data="deptTreeData"
          :field-names="{ label: 'name', value: 'id', children: 'children' }"
          allow-clear
          show-search
          tree-default-expand-all
          tree-node-filter-prop="name"
          placeholder="请选择上级部门"
          class="w-full"
        />
      </FormItem>
      <FormItem v-if="!isHidden('leaderUserId')" label="负责人">
        <Checkbox v-model:checked="updateLeader" class="mb-2">
          修改负责人
        </Checkbox>
        <Select
          v-model:value="formData.leaderUserId"
          :disabled="!updateLeader || clearLeader"
          :filter-option="filterSelectOption"
          :options="userOptions"
          allow-clear
          show-search
          placeholder="请选择负责人"
          class="w-full"
        />
        <Checkbox
          v-model:checked="clearLeader"
          :disabled="!updateLeader"
          class="mt-2"
          @change="formData.leaderUserId = undefined"
        >
          清空负责人
        </Checkbox>
      </FormItem>
      <FormItem v-if="!isHidden('status')" label="状态">
        <Checkbox v-model:checked="updateStatus" class="mb-2">
          修改状态
        </Checkbox>
        <RadioGroup v-model:value="formData.status">
          <Radio :disabled="!updateStatus" :value="CommonStatusEnum.ENABLE"
            >启用</Radio
          >
          <Radio :disabled="!updateStatus" :value="CommonStatusEnum.DISABLE"
            >禁用</Radio
          >
        </RadioGroup>
      </FormItem>
    </AForm>
  </Modal>
</template>
