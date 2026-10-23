<script lang="ts" setup>
import { useFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { ErpAccountApi } from '#/api/erp/finance/account';

import { computed, nextTick, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { CommonStatusEnum } from '@vben/constants';
import { formatDateTime } from '@vben/utils';

import { Modal as AntModal, Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  ACCOUNT_DOCUMENT_STATUS,
  createAccountDraft,
  createAndSubmitAccount,
  getAccount,
  submitAccountDraft,
  updateAccount,
  updateAccountDraft,
  updateAndSubmitAccount,
} from '#/api/erp/finance/account';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import { buildFinanceCopyDraft } from '#/views/erp/finance/utils/copy-draft';
import {
  handleFinanceEditableFormEnter,
  queueFocusFirstFinanceEditableFormControl,
} from '#/views/erp/finance/utils/form-enter-focus';
import {
  formatOptionalNumberInput,
  normalizeOptionalNumberFields,
} from '#/views/erp/finance/utils/text-number';

import { useFormSchema } from '../data';

import '#/views/erp/styles/form-focus.css';
const { candidateSchema } = useFinanceCandidateFocus();

type FormType = 'create' | 'detail' | 'edit';
type ModalData = Partial<ErpAccountApi.Account> & {
  type?: FormType;
};

const emit = defineEmits(['success']);
const basicFormRef = ref<HTMLElement>();
const formData = ref<ErpAccountApi.Account>();
const formType = ref<FormType>('create');
const isDetail = computed(() => formType.value === 'detail');
const dataLoading = ref(false);
const dataLoadError = ref('');
let dataLoadSequence = 0;
let skipDraftOnClose = false;
let draftSaved = false;
let draftSaving = false;
const { hasAccessByCodes } = useAccess();
const isEditingDraft = computed(
  () =>
    formType.value === 'edit' &&
    formData.value?.documentStatus === ACCOUNT_DOCUMENT_STATUS.DRAFT,
);
const canSubmit = computed(
  () => !isDetail.value && !dataLoading.value && !dataLoadError.value,
);
const confirmText = computed(() =>
  formType.value === 'create' || isEditingDraft.value ? '确认提交' : '确定',
);
const canGenerateDraft = computed(
  () =>
    (formType.value === 'create' || isEditingDraft.value) &&
    !dataLoading.value &&
    !dataLoadError.value,
);
const generateDraftButtonText = computed(() =>
  isEditingDraft.value ? '保存草稿' : '生成草稿',
);
const canSubmitDraftFromDetail = computed(
  () =>
    isDetail.value &&
    !dataLoading.value &&
    !dataLoadError.value &&
    Boolean(formData.value?.id) &&
    formData.value?.documentStatus === ACCOUNT_DOCUMENT_STATUS.DRAFT &&
    hasAccessByCodes(['erp:account:update']),
);
const canEditFromDetail = computed(
  () =>
    isDetail.value &&
    !dataLoading.value &&
    !dataLoadError.value &&
    Boolean(formData.value?.id) &&
    hasAccessByCodes(['erp:account:update']),
);
const { hiddenFields, isHidden, loadHiddenFields } =
  useFieldPermission('erp_account');

const auditItems = computed(() =>
  [
    {
      field: 'creatorName',
      label: '创建人',
      value: formData.value?.creatorName || '-',
    },
    {
      field: 'createTime',
      label: '创建时间',
      value: formData.value?.createTime
        ? formatDateTime(formData.value.createTime)
        : '-',
    },
    {
      field: 'updaterName',
      label: '修改人',
      value: formData.value?.updaterName || '-',
    },
    {
      field: 'updateTime',
      label: '修改时间',
      value: formData.value?.updateTime
        ? formatDateTime(formData.value.updateTime)
        : '-',
    },
  ].filter((item) => !isHidden(item.field)),
);

const getTitle = computed(() => {
  if (formType.value === 'detail') {
    return '账户详情';
  }
  if (formType.value === 'edit') {
    return isEditingDraft.value
      ? '编辑账户草稿'
      : $t('ui.actionTitle.edit', ['账户']);
  }
  return $t('ui.actionTitle.create', ['账户']);
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
  schema: candidateSchema(useFormSchema(hiddenFields.value)),
  showDefaultActions: false,
  wrapperClass: 'account-basic-grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
});

function canFocusBasicForm() {
  return !isDetail.value && !dataLoading.value && !dataLoadError.value;
}

function handleBasicFormEnter(event: KeyboardEvent) {
  handleFinanceEditableFormEnter(
    event,
    basicFormRef,
    canFocusBasicForm,
    () => void modalApi.onConfirm(),
  );
}

function queueFocusFirstBasicFormControl(sequence = dataLoadSequence) {
  queueFocusFirstFinanceEditableFormControl(
    basicFormRef,
    canFocusBasicForm,
    () => sequence === dataLoadSequence,
  );
}

async function handleCopy() {
  if (!formData.value?.id) {
    return;
  }
  const copyData = buildFinanceCopyDraft(formData.value, {
    overrides: {
      status: CommonStatusEnum.ENABLE,
      defaultStatus: false,
      documentStatus: undefined,
    } as any,
  });
  formType.value = 'create';
  formApi.setDisabled(false);
  const formValues = {
    ...copyData,
    sort: formatOptionalNumberInput(copyData.sort),
  };
  await formApi.setValues(formValues, false);
  formData.value = copyData;
  dataLoadError.value = '';
  queueFocusFirstBasicFormControl();
}

async function resetFormValues() {
  formData.value = undefined;
  formApi.setDisabled(false);
  await formApi.resetForm();
}

async function buildCurrentAccountPayload() {
  const data = (await formApi.getValues()) as ErpAccountApi.Account;
  normalizeOptionalNumberFields(data as any, ['sort']);
  if (formData.value?.id) {
    data.id = formData.value.id;
  }
  return data;
}

async function saveCurrentDraft(options: { explicit?: boolean } = {}) {
  const isCreatingDraft = formType.value === 'create';
  const isUpdatingDraft = isEditingDraft.value && Boolean(formData.value?.id);
  if (
    (!isCreatingDraft && !isUpdatingDraft) ||
    skipDraftOnClose ||
    draftSaved ||
    dataLoading.value ||
    dataLoadError.value
  ) {
    return true;
  }
  if (draftSaving) {
    return false;
  }
  draftSaving = true;
  modalApi.lock();
  try {
    const data = await buildCurrentAccountPayload();
    await (isCreatingDraft
      ? createAccountDraft(data)
      : updateAccountDraft(data));
    draftSaved = true;
    emit('success');
    message.success(
      options.explicit
        ? isCreatingDraft
          ? '草稿生成成功'
          : '草稿保存成功'
        : isCreatingDraft
          ? '未提交内容已自动保存为草稿'
          : '草稿修改已自动保存',
    );
    return true;
  } catch {
    message.error(
      options.explicit
        ? isCreatingDraft
          ? '草稿生成失败，请稍后重试'
          : '草稿保存失败，请稍后重试'
        : isCreatingDraft
          ? '草稿自动保存失败，新增页面已保留，请稍后重试'
          : '草稿修改保存失败，编辑页面已保留，请稍后重试',
    );
    return false;
  } finally {
    draftSaving = false;
    modalApi.unlock();
  }
}

async function handleGenerateDraft() {
  if (!canGenerateDraft.value) {
    return;
  }
  const saved = await saveCurrentDraft({ explicit: true });
  if (!saved) {
    return;
  }
  skipDraftOnClose = true;
  await modalApi.close();
}

async function handleEditFromDetail() {
  if (!canEditFromDetail.value || !formData.value?.id) {
    return;
  }
  const id = formData.value.id;
  const sequence = ++dataLoadSequence;
  dataLoading.value = true;
  dataLoadError.value = '';
  modalApi.lock();
  try {
    await loadHiddenFields();
    if (sequence !== dataLoadSequence) {
      return;
    }
    const account = await getAccount(id);
    if (sequence !== dataLoadSequence) {
      return;
    }
    formType.value = 'edit';
    formApi.setDisabled(false);
    formApi.updateSchema(candidateSchema(useFormSchema(hiddenFields.value)));
    await nextTick();
    formData.value = account;
    await formApi.setValues(
      {
        ...account,
        sort: formatOptionalNumberInput(account.sort),
      },
      false,
    );
  } catch {
    if (sequence === dataLoadSequence) {
      dataLoadError.value = '账户信息加载失败，请关闭后重试';
    }
  } finally {
    if (sequence === dataLoadSequence) {
      dataLoading.value = false;
      modalApi.unlock();
      queueFocusFirstBasicFormControl(sequence);
    }
  }
}

function handleSubmitDraftFromDetail() {
  if (!formData.value?.id) {
    return;
  }
  const id = formData.value.id;
  AntModal.confirm({
    title: `确认提交账户草稿“${formData.value.name || `#${id}`}”吗？`,
    content: '提交后将成为正式账户，并按当前启用状态参与业务选择。',
    async onOk() {
      modalApi.lock();
      try {
        await submitAccountDraft(id);
        skipDraftOnClose = true;
        await modalApi.close();
        emit('success');
        message.success('账户草稿已正式提交');
      } finally {
        modalApi.unlock();
      }
    },
  });
}

const [Modal, modalApi] = useVbenModal({
  async onBeforeClose() {
    return saveCurrentDraft();
  },
  async onCancel() {
    skipDraftOnClose = true;
    await modalApi.close();
  },
  async onConfirm() {
    if (!canSubmit.value) {
      return;
    }
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    modalApi.lock();
    try {
      const data = await buildCurrentAccountPayload();
      if (formType.value === 'create') {
        await createAndSubmitAccount(data);
      } else if (isEditingDraft.value) {
        await updateAndSubmitAccount(data);
      } else {
        await updateAccount(data);
      }
      skipDraftOnClose = true;
      await modalApi.close();
      emit('success');
      message.success($t('ui.actionMessage.operationSuccess'));
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      dataLoadSequence += 1;
      dataLoading.value = false;
      dataLoadError.value = '';
      formData.value = undefined;
      formType.value = 'create';
      formApi.setDisabled(false);
      return;
    }
    skipDraftOnClose = false;
    draftSaved = false;
    draftSaving = false;
    modalApi.setState({ fullscreen: true });
    const data = modalApi.getData<ModalData>();
    formType.value = data?.type || 'create';
    dataLoadError.value = '';
    dataLoading.value = true;
    const sequence = ++dataLoadSequence;
    modalApi.lock();
    try {
      await loadHiddenFields();
      if (sequence !== dataLoadSequence) {
        return;
      }
      await resetFormValues();
      formApi.setDisabled(isDetail.value);
      formApi.updateSchema(candidateSchema(useFormSchema(hiddenFields.value)));
      await nextTick();
      if (!data || !data.id) {
        const createData = {
          accountType: 1,
          status: CommonStatusEnum.ENABLE,
          defaultStatus: false,
          sort: '0',
        } as unknown as ErpAccountApi.Account;
        formData.value = createData;
        await formApi.setValues(createData, false);
        return;
      }
      const account = await getAccount(data.id);
      if (sequence !== dataLoadSequence) {
        return;
      }
      formData.value = account;
      await formApi.setValues(
        {
          ...formData.value,
          sort: formatOptionalNumberInput(formData.value.sort),
        },
        false,
      );
    } catch {
      if (sequence === dataLoadSequence) {
        formData.value = undefined;
        dataLoadError.value = '账户信息加载失败，请关闭后重试';
      }
    } finally {
      if (sequence === dataLoadSequence) {
        dataLoading.value = false;
        modalApi.unlock();
        queueFocusFirstBasicFormControl(sequence);
      }
    }
  },
});
</script>

<template>
  <Modal
    bordered
    class="!w-full"
    content-class="p-0"
    :confirm-text="confirmText"
    :show-confirm-button="canSubmit"
    :title="getTitle"
  >
    <template #center-footer>
      <Button v-if="canGenerateDraft" @click="handleGenerateDraft">
        {{ generateDraftButtonText }}
      </Button>
    </template>

    <template #prepend-footer>
      <Button
        v-if="canEditFromDetail"
        type="primary"
        @click="handleEditFromDetail"
      >
        编辑
      </Button>
      <Button
        v-if="canSubmitDraftFromDetail"
        type="primary"
        @click="handleSubmitDraftFromDetail"
      >
        提交
      </Button>
      <Button
        v-if="isDetail && formData?.id"
        type="primary"
        ghost
        @click="handleCopy"
      >
        复制
      </Button>
    </template>
    <div class="account-form-view">
      <div v-if="dataLoading" class="account-form-load-state">
        正在加载账户信息，请稍候…
      </div>
      <div v-else-if="dataLoadError" class="account-form-load-state is-error">
        {{ dataLoadError }}
      </div>

      <section
        ref="basicFormRef"
        v-show="!dataLoading && !dataLoadError"
        class="account-form-section"
      >
        <header class="account-form-section__header">
          <span class="account-form-section__title">基本信息</span>
        </header>
        <Form
          class="account-edit-form erp-form-focus-highlight"
          :class="{
            'account-edit-form--editable': !isDetail,
            'account-edit-form--readonly': isDetail,
          }"
          @keydown.enter.capture="handleBasicFormEnter"
        />
      </section>

      <section
        v-if="formData?.id && auditItems.length > 0"
        v-show="!dataLoading && !dataLoadError"
        class="account-form-section account-form-audit"
      >
        <header class="account-form-section__header">
          <span class="account-form-section__title">审计信息</span>
        </header>
        <div class="account-form-audit__grid">
          <div
            v-for="item in auditItems"
            :key="item.field"
            class="account-form-audit__item"
          >
            <span>{{ item.label }}</span>
            <strong :title="String(item.value)">{{ item.value }}</strong>
          </div>
        </div>
      </section>
    </div>
    <template #cancelText>
      {{ isDetail ? '关闭' : '取消' }}
    </template>
  </Modal>
</template>

<style scoped>
.account-form-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: calc(100vh - 132px);
  padding: 12px;
  overflow: auto;
  font-size: 12px;
  background: hsl(var(--muted) / 28%);
}

.account-form-load-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.account-form-load-state.is-error {
  color: hsl(var(--destructive));
}

.account-form-section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.account-form-section__header {
  display: flex;
  align-items: center;
  min-height: 40px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.account-form-section__title {
  position: relative;
  padding-left: 10px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.account-form-section__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  content: '';
  background: hsl(var(--primary));
  border-radius: 3px;
}

.account-edit-form :deep(.account-basic-grid) {
  gap: 0 12px;
  padding: 12px;
}

.account-edit-form :deep(.account-basic-grid > div) {
  min-width: 0;
}

.account-edit-form :deep(.account-basic-grid > div > label) {
  padding-right: 10px;
  margin-right: 0;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.account-edit-form :deep(.account-basic-grid > div > .flex-auto) {
  min-width: 0;
}

.account-edit-form :deep(.ant-input),
.account-edit-form :deep(.ant-input-affix-wrapper),
.account-edit-form :deep(.ant-select-selector),
.account-edit-form :deep(.ant-radio-button-wrapper) {
  min-height: 32px;
  font-size: 12px;
  border-color: hsl(var(--border)) !important;
  border-radius: 6px !important;
}

.account-edit-form :deep(.ant-input),
.account-edit-form :deep(.ant-select-selection-item),
.account-edit-form :deep(.ant-select-selection-placeholder),
.account-edit-form :deep(.ant-radio-wrapper),
.account-edit-form :deep(.ant-radio-button-wrapper),
.account-edit-form :deep(.ant-switch),
.account-edit-form :deep(.ant-form-item-explain) {
  font-size: 12px;
}

.account-edit-form :deep(.ant-input:not(textarea)),
.account-edit-form :deep(.ant-input-affix-wrapper),
.account-edit-form :deep(.ant-select-single),
.account-edit-form :deep(.ant-radio-button-wrapper) {
  height: 32px;
}

.account-edit-form--editable :deep(.ant-input:not(:disabled)),
.account-edit-form--editable
  :deep(.ant-input-affix-wrapper:not(.ant-input-affix-wrapper-disabled)),
.account-edit-form--editable
  :deep(.ant-select:not(.ant-select-disabled) .ant-select-selector),
.account-edit-form--editable
  :deep(.ant-radio-button-wrapper:not(.ant-radio-button-wrapper-disabled)) {
  background: hsl(var(--background)) !important;
}

.account-edit-form--editable :deep(.ant-input:disabled),
.account-edit-form--editable :deep(.ant-input-affix-wrapper-disabled),
.account-edit-form--editable :deep(.ant-select-disabled .ant-select-selector),
.account-edit-form--readonly :deep(.ant-input),
.account-edit-form--readonly :deep(.ant-input-affix-wrapper),
.account-edit-form--readonly :deep(.ant-select-selector),
.account-edit-form--readonly :deep(.ant-radio-button-wrapper) {
  color: hsl(var(--muted-foreground)) !important;
  background: hsl(var(--muted-foreground) / 14%) !important;
  border-color: hsl(var(--muted-foreground) / 28%) !important;
}

.account-edit-form :deep(.ant-switch-disabled) {
  cursor: not-allowed;
  opacity: 0.72;
}

.account-form-audit__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px 20px;
  padding: 12px;
}

.account-form-audit__item {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.account-form-audit__item span {
  flex: none;
  color: hsl(var(--muted-foreground));
}

.account-form-audit__item strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

:global(.account-form-select-dropdown .ant-select-item),
:global(.account-form-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

@media (max-width: 1279px) {
  .account-form-audit__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .account-form-view {
    padding: 8px;
  }

  .account-form-audit__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
