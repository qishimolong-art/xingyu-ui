<script lang="ts" setup>
import type { SystemDeptApi } from '#/api/system/dept';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createDept, getDept, updateDept } from '#/api/system/dept';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

type FormType = 'create' | 'detail' | 'edit';

const emit = defineEmits<{
  (e: 'append', dept: SystemDeptApi.Dept): void;
  (e: 'edit', dept: SystemDeptApi.Dept): void;
  (e: 'success'): void;
}>();
const formData = ref<SystemDeptApi.Dept>();
const hiddenFields = ref<string[]>([]);
const formType = ref<FormType>('create');
const isDetail = computed(() => formType.value === 'detail');
const canSubmit = computed(() => formType.value !== 'detail');
const { hasAccessByCodes } = useAccess();
const canEditFromDetail = computed(
  () =>
    isDetail.value &&
    !!formData.value?.id &&
    hasAccessByCodes(['system:dept:update']),
);
const canAppendFromDetail = computed(
  () =>
    isDetail.value &&
    !!formData.value?.id &&
    hasAccessByCodes(['system:dept:create']),
);
const getTitle = computed(() => {
  if (formType.value === 'detail') {
    return $t('common.detail');
  }
  return formType.value === 'edit'
    ? $t('ui.actionTitle.edit', ['部门'])
    : $t('ui.actionTitle.create', ['部门']);
});

function normalizeFormValues(data?: Partial<SystemDeptApi.Dept>) {
  return {
    ...data,
    leaderUserId: data?.leaderUserId ?? undefined,
  };
}

function normalizeSubmitValues(data: SystemDeptApi.Dept) {
  return {
    ...data,
    leaderUserId: data.leaderUserId ?? null,
  };
}

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
  wrapperClass: 'department-basic-grid grid-cols-4',
  schema: useFormSchema(hiddenFields.value),
  showDefaultActions: false,
});

function removeHiddenValues(data: SystemDeptApi.Dept) {
  hiddenFields.value.forEach((fieldKey) => {
    const normalizedKey = fieldKey.startsWith('col_')
      ? fieldKey.slice(4)
      : fieldKey;
    if (normalizedKey in data) {
      delete (data as Record<string, any>)[normalizedKey];
    }
  });
  return data;
}

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
    const data = removeHiddenValues(
      normalizeSubmitValues((await formApi.getValues()) as SystemDeptApi.Dept),
    );
    try {
      await (formData.value?.id ? updateDept(data) : createDept(data));
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
      return;
    }
    modalApi.setState({ fullscreen: true });
    // 加载数据
    const modalData = modalApi.getData<
      | SystemDeptApi.Dept
      | {
          hiddenFields?: string[];
          row?: SystemDeptApi.Dept;
          type?: FormType;
        }
    >();
    const data =
      (modalData as { row?: SystemDeptApi.Dept })?.row ??
      (modalData as SystemDeptApi.Dept);
    hiddenFields.value =
      (modalData as { hiddenFields?: string[] })?.hiddenFields ?? [];
    formType.value =
      (modalData as { type?: FormType })?.type ??
      (data?.id ? 'edit' : 'create');
    formApi.setState({ schema: useFormSchema(hiddenFields.value) });
    formApi.setDisabled(isDetail.value);
    if (!data || !data.id) {
      // 设置上级
      await formApi.resetForm({
        values: normalizeFormValues(data),
      });
      return;
    }
    modalApi.lock();
    try {
      formData.value = await getDept(data.id);
      formApi.setDisabled(isDetail.value);
      // 设置到 values
      await formApi.resetForm({
        values: normalizeFormValues(formData.value),
      });
    } finally {
      modalApi.unlock();
    }
  },
});

async function handleEditFromDetail() {
  if (!canEditFromDetail.value || !formData.value) return;
  const dept = { ...formData.value };
  await modalApi.close();
  emit('edit', dept);
}

async function handleAppendFromDetail() {
  if (!canAppendFromDetail.value || !formData.value) return;
  const dept = { ...formData.value };
  await modalApi.close();
  emit('append', dept);
}
</script>

<template>
  <Modal
    :title="getTitle"
    class="!w-full"
    bordered
    content-class="p-0"
    :show-confirm-button="canSubmit"
  >
    <div class="department-form-view">
      <section class="department-form-section">
        <header class="department-form-section__header">
          <span class="department-form-section__title">基本信息</span>
        </header>
        <Form
          class="department-edit-form"
          :class="{
            'department-edit-form--editable': !isDetail,
            'department-edit-form--readonly': isDetail,
          }"
        />
      </section>
    </div>
    <template #cancelText>
      {{ isDetail ? '关闭' : '取消' }}
    </template>
    <template #prepend-footer>
      <Button v-if="canAppendFromDetail" @click="handleAppendFromDetail">
        新增下级
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
.department-form-view {
  min-height: 100%;
  padding: 12px;
  background: hsl(var(--muted) / 28%);
  font-size: 12px;
}

.department-form-section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.department-form-section__header {
  display: flex;
  min-height: 40px;
  align-items: center;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.department-form-section__title {
  position: relative;
  padding-left: 10px;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
}

.department-form-section__title::before {
  position: absolute;
  top: 50%;
  left: 0;
  width: 3px;
  height: 14px;
  background: hsl(var(--primary));
  border-radius: 999px;
  content: '';
  transform: translateY(-50%);
}

.department-edit-form :deep(.department-basic-grid) {
  gap: 0 12px;
  padding: 12px;
}

.department-edit-form :deep(.department-basic-grid > div) {
  min-width: 0;
}

.department-edit-form :deep(.department-basic-grid > div > label) {
  margin-right: 0;
  padding-right: 10px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  white-space: nowrap;
}

.department-edit-form :deep(.department-basic-grid > div > .flex-auto) {
  min-width: 0;
}

.department-edit-form :deep(.ant-input),
.department-edit-form :deep(.ant-input-number),
.department-edit-form :deep(.ant-select-selector),
.department-edit-form :deep(.ant-tree-select .ant-select-selector) {
  min-height: 32px;
  border-color: hsl(var(--border)) !important;
  border-radius: 6px !important;
  font-size: 12px;
}

.department-edit-form :deep(.ant-input),
.department-edit-form :deep(.ant-input-number-input),
.department-edit-form :deep(.ant-select-selection-item),
.department-edit-form :deep(.ant-select-selection-placeholder) {
  font-size: 12px;
}

.department-edit-form :deep(.ant-input),
.department-edit-form :deep(.ant-input-number),
.department-edit-form :deep(.ant-input-number-input),
.department-edit-form :deep(.ant-select-single) {
  height: 32px;
}

.department-edit-form :deep(.ant-radio-button-wrapper) {
  height: 32px;
  font-size: 12px;
  line-height: 30px;
}

.department-edit-form--editable :deep(.ant-input:not(:disabled)),
.department-edit-form--editable
  :deep(.ant-input-number:not(.ant-input-number-disabled)),
.department-edit-form--editable
  :deep(.ant-select:not(.ant-select-disabled) .ant-select-selector) {
  background: hsl(var(--background)) !important;
}

.department-edit-form--editable :deep(.ant-input:disabled),
.department-edit-form--editable :deep(.ant-input-number-disabled),
.department-edit-form--editable
  :deep(.ant-select-disabled .ant-select-selector),
.department-edit-form--readonly :deep(.ant-input),
.department-edit-form--readonly :deep(.ant-input-number),
.department-edit-form--readonly :deep(.ant-select-selector),
.department-edit-form--readonly :deep(.ant-tree-select .ant-select-selector),
.department-edit-form--readonly :deep(.ant-radio-button-wrapper) {
  color: hsl(var(--muted-foreground)) !important;
  background: hsl(var(--muted-foreground) / 14%) !important;
  border-color: hsl(var(--muted-foreground) / 28%) !important;
}

@media (max-width: 1199px) {
  .department-edit-form :deep(.department-basic-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 639px) {
  .department-edit-form :deep(.department-basic-grid) {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

<style>
.department-form-select-dropdown,
.department-form-select-dropdown .ant-select-item,
.department-form-select-dropdown .ant-select-tree {
  font-size: 12px;
}
</style>
