<script lang="ts" setup>
import type { SystemRoleApi } from '#/api/system/role';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { CommonStatusEnum, SystemRoleTypeEnum } from '@vben/constants';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createRole, getRole, updateRole } from '#/api/system/role';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

type FormType = 'create' | 'detail' | 'edit';

const ASSIGN_PERMISSION_AUTH_CODES = [
  'system:permission:assign-role-menu',
  'system:permission:assign-role-field-permission',
  'system:permission:assign-role-data-scope',
];

const emit = defineEmits<{
  (e: 'assignPermission', role: SystemRoleApi.Role): void;
  (e: 'edit', role: SystemRoleApi.Role): void;
  (e: 'success'): void;
}>();
const formData = ref<SystemRoleApi.Role>();
const formType = ref<FormType>('create');
const isDetail = computed(() => formType.value === 'detail');
const canSubmit = computed(() => formType.value !== 'detail');
const isSystemRole = computed(
  () => formData.value?.type === SystemRoleTypeEnum.SYSTEM,
);
const { hasAccessByCodes } = useAccess();
const canEditFromDetail = computed(
  () =>
    isDetail.value &&
    !!formData.value?.id &&
    !isSystemRole.value &&
    hasAccessByCodes(['system:role:update']),
);
const canAssignPermissionFromDetail = computed(
  () =>
    isDetail.value &&
    !!formData.value?.id &&
    hasAccessByCodes(ASSIGN_PERMISSION_AUTH_CODES),
);
const getTitle = computed(() => {
  if (formType.value === 'detail') {
    return $t('common.detail');
  }
  return formType.value === 'edit'
    ? $t('ui.actionTitle.edit', ['角色'])
    : $t('ui.actionTitle.create', ['角色']);
});

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-1',
    labelClass: '!justify-start !text-left',
    labelWidth: 82,
  },
  compact: true,
  layout: 'horizontal',
  schema: useFormSchema(),
  showDefaultActions: false,
  wrapperClass: 'role-form-grid grid-cols-1 sm:grid-cols-2',
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (!canSubmit.value) {
      await modalApi.close();
      return;
    }
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    modalApi.lock();
    // 提交表单
    const data = (await formApi.getValues()) as SystemRoleApi.Role;
    try {
      await (formData.value?.id ? updateRole(data) : createRole(data));
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
      formType.value = 'create';
      formApi.setDisabled(false);
      await formApi.resetForm();
      return;
    }
    // 加载数据
    const data = modalApi.getData<SystemRoleApi.Role & { mode?: FormType }>();
    formType.value = data?.mode ?? (data?.id ? 'edit' : 'create');
    formApi.setDisabled(isDetail.value);
    if (!data || !data.id) {
      formData.value = undefined;
      await formApi.resetForm();
      await formApi.setValues({ status: CommonStatusEnum.ENABLE });
      return;
    }
    modalApi.lock();
    try {
      await formApi.resetForm();
      formData.value = await getRole(data.id);
      formApi.setDisabled(isDetail.value);
      // 设置到 values
      await formApi.setValues(formData.value);
    } finally {
      modalApi.unlock();
    }
  },
});

async function handleEditFromDetail() {
  if (!canEditFromDetail.value || !formData.value) return;
  const role = { ...formData.value };
  await modalApi.close();
  emit('edit', role);
}

async function handleAssignPermissionFromDetail() {
  if (!canAssignPermissionFromDetail.value || !formData.value) return;
  const role = { ...formData.value };
  await modalApi.close();
  emit('assignPermission', role);
}
</script>

<template>
  <Modal :title="getTitle" class="w-[680px]" :show-confirm-button="canSubmit">
    <div class="role-form-view">
      <section class="role-form-section">
        <header class="role-form-section__header">
          <span class="role-form-section__title">基本信息</span>
        </header>
        <Form
          class="role-edit-form"
          :class="{
            'role-edit-form--editable': !isDetail,
            'role-edit-form--readonly': isDetail,
          }"
        />
      </section>
    </div>
    <template #cancelText>
      {{ isDetail ? '关闭' : '取消' }}
    </template>
    <template #prepend-footer>
      <Button
        v-if="canAssignPermissionFromDetail"
        @click="handleAssignPermissionFromDetail"
      >
        权限配置
      </Button>
      <Button
        v-if="canEditFromDetail"
        type="primary"
        @click="handleEditFromDetail"
      >
        编辑
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
.role-form-view {
  padding: 12px;
  font-size: 12px;
  background: hsl(var(--muted) / 28%);
}

.role-form-section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.role-form-section__header {
  display: flex;
  align-items: center;
  min-height: 40px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.role-form-section__title {
  position: relative;
  padding-left: 10px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.role-form-section__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  content: '';
  background: hsl(var(--primary));
  border-radius: 3px;
}

.role-edit-form :deep(.role-form-grid) {
  gap: 0 12px;
  padding: 12px;
}

.role-edit-form :deep(.role-form-grid > div) {
  min-width: 0;
}

.role-edit-form :deep(.role-form-grid > div > label) {
  padding-right: 10px;
  margin-right: 0;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.role-edit-form :deep(.role-form-grid > div > .flex-auto) {
  min-width: 0;
}

.role-edit-form :deep(.ant-input),
.role-edit-form :deep(.ant-input-affix-wrapper),
.role-edit-form :deep(.ant-radio-button-wrapper) {
  min-height: 32px;
  font-size: 12px;
  border-color: hsl(var(--border)) !important;
  border-radius: 6px !important;
}

.role-edit-form :deep(.ant-input:not(textarea)),
.role-edit-form :deep(.ant-input-affix-wrapper),
.role-edit-form :deep(.ant-radio-button-wrapper) {
  height: 32px;
}

.role-edit-form :deep(textarea.ant-input) {
  min-height: 68px;
  resize: vertical;
}

.role-edit-form :deep(.ant-radio-group) {
  display: flex;
  width: 100%;
}

.role-edit-form :deep(.ant-radio-button-wrapper) {
  flex: 1;
  padding-inline: 8px;
  line-height: 30px;
  text-align: center;
}

.role-edit-form--editable :deep(.ant-input:not([readonly]):not(:disabled)),
.role-edit-form--editable
  :deep(.ant-input-affix-wrapper:not(.ant-input-affix-wrapper-disabled)) {
  background: hsl(var(--background)) !important;
}

.role-edit-form :deep(.ant-input[readonly]),
.role-edit-form :deep(.ant-input:disabled),
.role-edit-form--readonly :deep(.ant-input),
.role-edit-form--readonly :deep(.ant-input-affix-wrapper),
.role-edit-form--readonly :deep(.ant-radio-button-wrapper) {
  color: hsl(var(--muted-foreground)) !important;
  cursor: not-allowed;
  background: hsl(var(--muted-foreground) / 14%) !important;
  border-color: hsl(var(--muted-foreground) / 28%) !important;
}

.role-edit-form :deep(.ant-form-item-explain) {
  font-size: 12px;
}

@media (max-width: 639px) {
  .role-form-view {
    padding: 8px;
  }
}
</style>
