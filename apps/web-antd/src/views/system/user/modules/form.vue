<script lang="ts" setup>
import type { SystemUserApi } from '#/api/system/user';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getDeptList } from '#/api/system/dept';
import { createUser, getUser, updateUser } from '#/api/system/user';
import { $t } from '#/locales';

import { formatDeptTreeSelectValues, useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<SystemUserApi.User>();
const hiddenFields = ref<string[]>([]);
const getTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', ['用户'])
    : $t('ui.actionTitle.create', ['用户']);
});

type DeptSelectValue =
  | Array<number | string | { value?: number | string }>
  | null
  | number
  | string
  | undefined
  | { value?: number | string };
type UserDeptFormValues = Partial<
  Omit<SystemUserApi.User, 'deptId' | 'deptIds'>
> & {
  deptId?: DeptSelectValue;
  deptIds?: DeptSelectValue;
};

function normalizeDeptIds(value: DeptSelectValue): number[] {
  const values = Array.isArray(value) ? value : [];
  if (!Array.isArray(value) && value !== undefined && value !== null) {
    values.push(value);
  }
  return [
    ...new Set(
      values
        .map((item) => (typeof item === 'object' ? item.value : item))
        .map(Number)
        .filter((item) => Number.isFinite(item)),
    ),
  ];
}

function normalizeUserDept(data: UserDeptFormValues): SystemUserApi.User {
  const deptIds = normalizeDeptIds(data.deptIds ?? data.deptId);
  return {
    ...data,
    deptId: deptIds[0],
    deptIds,
  } as SystemUserApi.User;
}

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-2',
    labelWidth: 80,
  },
  layout: 'horizontal',
  schema: useFormSchema(hiddenFields.value),
  showDefaultActions: false,
});

function isHidden(fieldKey: string) {
  return (
    hiddenFields.value.includes(fieldKey) ||
    hiddenFields.value.includes(`col_${fieldKey}`)
  );
}

function removeHiddenValues(data: SystemUserApi.User) {
  hiddenFields.value.forEach((fieldKey) => {
    const normalizedKey = fieldKey.startsWith('col_')
      ? fieldKey.slice(4)
      : fieldKey;
    if (normalizedKey in data) {
      delete (data as Record<string, any>)[normalizedKey];
    }
  });
  if (isHidden('deptIds')) {
    delete (data as Record<string, any>).deptId;
  }
  return data;
}

function buildSubmitData(data: SystemUserApi.User) {
  const submitData = removeHiddenValues(data);
  delete (submitData as Record<string, any>).dataScope;
  delete (submitData as Record<string, any>).dataScopeDeptIds;
  if (submitData.mobile) {
    submitData.username = submitData.mobile;
  }
  return submitData;
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    // 提交表单
    const data = normalizeUserDept(
      (await formApi.getValues()) as SystemUserApi.User,
    ) as SystemUserApi.User;
    const submitData = buildSubmitData(data);
    if (!submitData) {
      return;
    }
    modalApi.lock();
    try {
      await (formData.value?.id
        ? updateUser(submitData)
        : createUser(submitData));
      // 关闭并提示
      await modalApi.close();
      emit('success');
      message.success($t('ui.actionMessage.operationSuccess'));
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      formData.value = undefined;
      hiddenFields.value = [];
      await formApi.resetForm();
      return;
    }
    // 加载数据
    const modalData = modalApi.getData<
      | SystemUserApi.User
      | {
          hiddenFields?: string[];
          row?: SystemUserApi.User;
        }
    >();
    const data =
      (modalData as { row?: SystemUserApi.User })?.row ??
      (modalData as SystemUserApi.User);
    hiddenFields.value =
      (modalData as { hiddenFields?: string[] })?.hiddenFields ?? [];
    formApi.setState({ schema: useFormSchema(hiddenFields.value) });
    if (!data || !data.id) {
      formData.value = undefined;
      await formApi.resetForm();
      return;
    }
    modalApi.lock();
    try {
      const [user, departments] = await Promise.all([
        getUser(data.id),
        getDeptList(),
      ]);
      formData.value = normalizeUserDept(user);
      // 设置到 values
      await formApi.setValues({
        ...formData.value,
        deptIds: formatDeptTreeSelectValues(
          formData.value.deptIds || [],
          departments,
        ),
      });
    } finally {
      modalApi.unlock();
    }
  },
});
</script>

<template>
  <Modal :title="getTitle" class="w-1/3">
    <Form class="mx-4" />
  </Modal>
</template>
