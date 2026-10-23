<script lang="ts" setup>
import { useFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { ErpFinanceTransferApi } from '#/api/erp/finance/transfer';

import { computed, nextTick, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Button, message, Modal as AntModal } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import type { ErpAccountApi } from '#/api/erp/finance/account';
import { getAccountSimple, getDefaultAccount } from '#/api/erp/finance/account';
import {
  createAndSubmitFinanceTransfer,
  createFinanceTransferDraft,
  getFinanceTransfer,
  submitFinanceTransfer,
  updateAndSubmitFinanceTransfer,
  updateFinanceTransfer,
  updateFinanceTransferDraft,
} from '#/api/erp/finance/transfer';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import FinanceDocumentRemarkForm from '#/views/erp/finance/components/FinanceDocumentRemarkForm.vue';
import { buildFinanceCopyDraft } from '#/views/erp/finance/utils/copy-draft';
import {
  buildFinanceDocumentDetailFormValues,
  buildFinanceDocumentFormSchema,
  hydrateFinanceDocumentFormSelectLabels,
} from '#/views/erp/finance/utils/document-form-ui';
import {
  handleFinanceEditableFormEnter,
  queueFocusFirstFinanceEditableFormControl,
} from '#/views/erp/finance/utils/form-enter-focus';
import { normalizeOptionalNumberFields } from '#/views/erp/finance/utils/text-number';
import { hasOpenFormControlPopup } from '#/views/erp/utils/keyboard';

import { useReportViewOnly } from '#/views/erp/report/components/report-view-only';

import { useFormSchema } from '../data';

import '#/views/erp/styles/form-focus.css';
const { candidateSchema } = useFinanceCandidateFocus();

defineOptions({ name: 'ErpFinanceTransferForm' });

type FinanceTransferFormData = ErpFinanceTransferApi.FinanceTransfer & {
  inAccountBalance?: number | string | null;
  inAccountBankAccount?: string;
  inAccountBankName?: string;
  outAccountBalance?: number | string | null;
  outAccountBankAccount?: string;
  outAccountBankName?: string;
};

const emit = defineEmits(['success', 'audit']);
const reportViewOnly = useReportViewOnly();
const formData = ref<FinanceTransferFormData>({});
const formType = ref('create');
const detailLoading = ref(false);
const detailLoadError = ref('');
const basicFormRef = ref<HTMLElement | null>(null);
let openRequestId = 0;
let balanceRequestId = 0;
let skipDraftOnClose = false;
let draftSaved = false;
let draftSaving = false;

const { hasAccessByCodes } = useAccess();
const userStore = useUserStore();
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  'erp_finance_transfer',
);

const isDetail = computed(() => formType.value === 'detail');
const canCopy = computed(
  () =>
    isDetail.value &&
    Boolean(formData.value?.id) &&
    hasAccessByCodes(['erp:finance-transfer:create']),
);
const canAudit = computed(
  () =>
    isDetail.value &&
    Boolean(formData.value?.id) &&
    formData.value?.status === 10 &&
    hasAccessByCodes(['erp:finance-transfer:update-status']),
);
const canEditRemark = computed(
  () =>
    isDetail.value &&
    Boolean(formData.value?.id) &&
    hasAccessByCodes(['erp:finance-transfer:update']),
);
const isEditingDraft = computed(
  () => formType.value === 'edit' && formData.value.status === 0,
);
const canConfirmForm = computed(() => {
  if (isDetail.value) return false;
  if (formType.value === 'create' || isEditingDraft.value) {
    return hasAccessByCodes(['erp:finance-transfer:update-status']);
  }
  return true;
});
const confirmText = computed(() =>
  formType.value === 'create' || isEditingDraft.value ? '确认提交' : '确定',
);
const canGenerateDraft = computed(
  () =>
    (formType.value === 'create' || isEditingDraft.value) &&
    !detailLoading.value &&
    !detailLoadError.value,
);
const generateDraftButtonText = computed(() =>
  isEditingDraft.value ? '保存草稿' : '生成草稿',
);
const canSubmitDraftFromDetail = computed(
  () =>
    isDetail.value &&
    !detailLoading.value &&
    !detailLoadError.value &&
    Boolean(formData.value.id) &&
    formData.value.status === 0 &&
    hasAccessByCodes(['erp:finance-transfer:update-status']),
);
const canEditFromDetail = computed(
  () =>
    isDetail.value &&
    !detailLoading.value &&
    !detailLoadError.value &&
    Boolean(formData.value.id) &&
    formData.value.status !== 20 &&
    hasAccessByCodes(['erp:finance-transfer:update']),
);
const [RemarkModal, remarkModalApi] = useVbenModal({
  connectedComponent: FinanceDocumentRemarkForm,
  destroyOnClose: true,
});

function canFocusBasicForm() {
  return (
    formType.value !== 'detail' &&
    !detailLoading.value &&
    !detailLoadError.value
  );
}

function handleLastInputEnterConfirm(event?: KeyboardEvent) {
  if (!canFocusBasicForm() || !canConfirmForm.value) {
    return;
  }
  event?.preventDefault();
  void modalApi.onConfirm();
}

function handleBasicFormEscape(event: KeyboardEvent) {
  if (event.isComposing || hasOpenFormControlPopup()) {
    event.preventDefault();
  }
}

function handleBasicFormEnter(event: KeyboardEvent) {
  handleFinanceEditableFormEnter(
    event,
    basicFormRef,
    canFocusBasicForm,
    handleLastInputEnterConfirm,
  );
}

function queueFocusFirstBasicFormControl(requestId = openRequestId) {
  queueFocusFirstFinanceEditableFormControl(
    basicFormRef,
    canFocusBasicForm,
    () => requestId === openRequestId,
  );
}

function handleEditRemark() {
  remarkModalApi
    .setData({
      documentName: '银行转账单',
      documentType: 'finance-transfer',
      id: formData.value!.id,
      no: formData.value?.no,
      remark: formData.value?.remark,
    })
    .open();
}

async function handleRemarkSuccess(remark: string) {
  if (formData.value) formData.value.remark = remark;
  await formApi.setValues({ remark }, false);
  emit('success');
}

const title = computed(() => {
  if (formType.value === 'create') {
    return $t('ui.actionTitle.create', ['银行转账']);
  }
  if (formType.value === 'edit') {
    return $t('ui.actionTitle.edit', ['银行转账']);
  }
  return '银行转账详情';
});

const detailStatus = computed(() => {
  if (formData.value?.status === 0) {
    return { className: 'is-draft', label: '草稿' };
  }
  if (formData.value?.status === 10) {
    return { className: 'is-pending', label: '待审批' };
  }
  if (formData.value?.status === 20) {
    return { className: 'is-success', label: '已审批' };
  }
  return { className: 'is-muted', label: '状态未知' };
});

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    labelClass: '!justify-start !text-left',
    labelWidth: 82,
  },
  compact: true,
  wrapperClass: 'bank-transfer-basic-grid grid-cols-4',
  layout: 'horizontal',
  schema: buildFormSchema(formType.value),
  showDefaultActions: false,
  handleValuesChange: async (values, changedFields) => {
    if (isDetail.value) {
      return;
    }
    if (
      changedFields.includes('outAccountId') ||
      changedFields.includes('inAccountId')
    ) {
      await updateAccountInfo(values.outAccountId, values.inAccountId);
    }
  },
});

function buildFormSchema(type: string) {
  return candidateSchema(
    buildFinanceDocumentFormSchema(useFormSchema(type, hiddenFields.value), {
      data: formData.value,
      formType: type,
    }),
  );
}

function createDefaultFormData(): FinanceTransferFormData {
  const userInfo = userStore.userInfo;
  return {
    exchangeRate: 1,
    feePrice: 0,
    financeUserId: userInfo?.id,
    deptId: userInfo?.deptId,
    transferTime: String(Date.now()) as any,
  };
}

function buildCopyFormData(source: FinanceTransferFormData) {
  const copyData = buildFinanceCopyDraft(source);
  const defaults = createDefaultFormData();
  return {
    ...copyData,
    transferTime: defaults.transferTime,
    financeUserId: defaults.financeUserId,
    deptId: defaults.deptId,
    exchangeRate: copyData.exchangeRate ?? defaults.exchangeRate,
    feePrice: copyData.feePrice ?? defaults.feePrice,
  };
}

function buildAccountDisplayFields(
  account: ErpAccountApi.Account | undefined,
  prefix: 'in' | 'out',
) {
  const upperPrefix = prefix === 'in' ? 'inAccount' : 'outAccount';
  return {
    [`${upperPrefix}Balance`]: account?.currentBalance ?? undefined,
    [`${upperPrefix}BankName`]: account?.bankName || undefined,
    [`${upperPrefix}BankAccount`]: account?.bankAccount || undefined,
  };
}

async function applyFormMode(type: string) {
  formType.value = type;
  formApi.setDisabled(type === 'detail');
  formApi.setState({
    schema: buildFormSchema(type),
  });
  await nextTick();
}

async function updateAccountInfo(outAccountId?: number, inAccountId?: number) {
  const requestId = ++balanceRequestId;
  const ids = [
    ...new Set([outAccountId, inAccountId].filter(Boolean)),
  ] as number[];
  const accountList = await Promise.all(ids.map((id) => getAccountSimple(id)));
  if (requestId !== balanceRequestId) return;
  const outAccount = accountList.find((item) => item.id === outAccountId);
  const inAccount = accountList.find((item) => item.id === inAccountId);
  await formApi.setValues(
    {
      ...buildAccountDisplayFields(outAccount, 'out'),
      ...buildAccountDisplayFields(inAccount, 'in'),
    },
    false,
  );
}

async function handleCopy() {
  if (!formData.value?.id) return;
  const copyData = buildCopyFormData(formData.value);
  formType.value = 'create';
  formApi.setDisabled(false);
  formApi.setState({
    schema: buildFormSchema('create'),
  });
  await nextTick();
  await formApi.resetForm();
  formData.value = copyData;
  await formApi.setValues(copyData, false);
  await updateAccountInfo(copyData.outAccountId, copyData.inAccountId);
  queueFocusFirstBasicFormControl();
}

async function buildCurrentPayload() {
  const data = (await formApi.getValues()) as FinanceTransferFormData;
  normalizeOptionalNumberFields(data as any, [
    'exchangeRate',
    'feePrice',
    'transferPrice',
  ]);
  data.id = formData.value.id ?? data.id;
  delete data.inAccountBalance;
  delete data.inAccountBankAccount;
  delete data.inAccountBankName;
  delete data.outAccountBalance;
  delete data.outAccountBankAccount;
  delete data.outAccountBankName;
  return data;
}

async function saveCurrentDraft(options: { explicit?: boolean } = {}) {
  const isCreatingDraft = formType.value === 'create';
  const isUpdatingDraft = isEditingDraft.value && Boolean(formData.value.id);
  if (
    (!isCreatingDraft && !isUpdatingDraft) ||
    skipDraftOnClose ||
    draftSaved ||
    detailLoadError.value
  ) {
    return true;
  }
  if (draftSaving) return false;
  draftSaving = true;
  modalApi.lock();
  try {
    const { valid } = await formApi.validate();
    if (!valid) {
      message.warning('请完善必填项并修正输入后再保存草稿');
      return false;
    }
    const payload = await buildCurrentPayload();
    if (payload.outAccountId === payload.inAccountId) {
      message.error('转出账户和转入账户不能相同');
      return false;
    }
    if (isCreatingDraft) {
      await createFinanceTransferDraft(payload);
    } else {
      await updateFinanceTransferDraft(payload);
    }
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
  if (!canEditFromDetail.value || !formData.value.id) {
    return;
  }
  const id = formData.value.id;
  const requestId = ++openRequestId;
  detailLoading.value = true;
  detailLoadError.value = '';
  modalApi.lock();
  try {
    await loadHiddenFields();
    if (requestId !== openRequestId) return;
    const detail = await getFinanceTransfer(id);
    if (requestId !== openRequestId) return;
    formData.value = await hydrateFinanceDocumentFormSelectLabels(detail);
    await applyFormMode('edit');
    await formApi.resetForm();
    await formApi.setValues(
      buildFinanceDocumentDetailFormValues(formData.value, formType.value),
      false,
    );
    await updateAccountInfo(
      formData.value.outAccountId,
      formData.value.inAccountId,
    );
  } catch {
    if (requestId === openRequestId) {
      detailLoadError.value = '银行转账表单加载失败，请关闭后重试';
    }
  } finally {
    if (requestId === openRequestId) {
      detailLoading.value = false;
      modalApi.unlock();
      queueFocusFirstBasicFormControl(requestId);
    }
  }
}

function handleSubmitDraftFromDetail() {
  if (!formData.value.id) return;
  const id = formData.value.id;
  AntModal.confirm({
    title: `确认提交草稿 ${formData.value.no || ''} 吗？`,
    content: '提交后将进入待审核状态，不能再按草稿方式修改。',
    async onOk() {
      modalApi.lock();
      try {
        await submitFinanceTransfer(id);
        skipDraftOnClose = true;
        emit('success');
        await modalApi.close();
        message.success('草稿已提交，当前状态为待审核');
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
    const { valid } = await formApi.validate();
    if (!valid) return;
    const data = await buildCurrentPayload();
    if (data.outAccountId === data.inAccountId) {
      message.error('转出账户和转入账户不能相同');
      return;
    }
    modalApi.lock();
    try {
      if (formType.value === 'create') {
        await createAndSubmitFinanceTransfer(data);
      } else if (isEditingDraft.value) {
        await updateAndSubmitFinanceTransfer(data);
      } else {
        await updateFinanceTransfer(data);
      }
      message.success($t('ui.actionMessage.operationSuccess'));
      emit('success');
      skipDraftOnClose = true;
      await modalApi.close();
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      ++openRequestId;
      ++balanceRequestId;
      detailLoading.value = false;
      detailLoadError.value = '';
      modalApi.unlock();
      formData.value = {};
      await formApi.resetValidate();
      return;
    }

    const requestId = ++openRequestId;
    const data = modalApi.getData<{ id?: number; type?: string }>();
    const requestedType = data?.type || 'create';
    skipDraftOnClose = false;
    draftSaved = false;
    draftSaving = false;
    modalApi.setState({ fullscreen: true });
    formType.value = requestedType === 'copy' ? 'create' : requestedType;
    detailLoading.value = true;
    detailLoadError.value = '';
    modalApi.lock();

    try {
      await loadHiddenFields();
      if (requestId !== openRequestId) return;
      formApi.setDisabled(isDetail.value);
      formApi.setState({
        schema: buildFormSchema(formType.value),
      });
      await nextTick();
      await formApi.resetForm();
      formData.value = {};

      if (!data?.id) {
        let defaultAccount: ErpAccountApi.Account | null = null;
        try {
          defaultAccount = await getDefaultAccount();
        } catch {
          // Account selectors still fetch their own options when opened.
        }
        if (requestId !== openRequestId) return;
        const defaultValues = {
          ...createDefaultFormData(),
          outAccountId: defaultAccount?.id,
        };
        formData.value = defaultValues;
        await formApi.setValues(defaultValues, false);
        await updateAccountInfo(defaultValues.outAccountId, undefined);
        return;
      }

      const detail = await getFinanceTransfer(data.id);
      if (requestId !== openRequestId) return;
      formData.value = await hydrateFinanceDocumentFormSelectLabels(
        requestedType === 'copy' ? buildCopyFormData(detail) : detail,
      );
      formApi.setState({
        schema: buildFormSchema(formType.value),
      });
      await formApi.setValues(
        buildFinanceDocumentDetailFormValues(formData.value, formType.value),
        false,
      );
      await updateAccountInfo(
        formData.value.outAccountId,
        formData.value.inAccountId,
      );
    } catch {
      if (requestId === openRequestId) {
        formData.value = {};
        detailLoadError.value =
          requestedType === 'detail'
            ? '银行转账详情加载失败，请关闭后重试'
            : '银行转账表单加载失败，请关闭后重试';
      }
    } finally {
      if (requestId === openRequestId) {
        detailLoading.value = false;
        modalApi.unlock();
        queueFocusFirstBasicFormControl(requestId);
      }
    }
  },
});
</script>

<template>
  <Modal
    :title="title"
    class="!w-full"
    bordered
    content-class="p-0"
    :confirm-text="confirmText"
    :show-confirm-button="canConfirmForm && !detailLoading && !detailLoadError"
  >
    <template #title>
      <div class="bank-transfer-form__title">
        <div class="bank-transfer-form__title-text">
          <span>{{ title }}</span>
          <small v-if="isDetail && formData?.no">{{ formData.no }}</small>
        </div>
        <span
          v-if="isDetail && formData?.status !== undefined"
          class="bank-transfer-form__status"
          :class="detailStatus.className"
        >
          {{ detailStatus.label }}
        </span>
      </div>
    </template>

    <template v-if="!reportViewOnly" #center-footer>
      <Button v-if="canGenerateDraft" @click="handleGenerateDraft">
        {{ generateDraftButtonText }}
      </Button>
    </template>

    <template v-if="!reportViewOnly" #prepend-footer>
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
      <Button v-if="canEditRemark" type="primary" @click="handleEditRemark">
        修改备注
      </Button>
      <Button v-if="canCopy" type="primary" ghost @click="handleCopy">
        复制
      </Button>
      <Button v-if="canAudit" type="primary" @click="emit('audit', formData)">
        审批
      </Button>
    </template>

    <div class="bank-transfer-form__view">
      <div
        v-if="detailLoading"
        class="bank-transfer-form__load-state"
        role="status"
      >
        {{ isDetail ? '银行转账详情加载中...' : '银行转账表单初始化中...' }}
      </div>
      <div
        v-else-if="detailLoadError"
        class="bank-transfer-form__load-state is-error"
        role="alert"
      >
        {{ detailLoadError }}
      </div>

      <section
        ref="basicFormRef"
        v-show="!detailLoading && !detailLoadError"
        class="bank-transfer-form__section"
        @keydown.esc.capture="handleBasicFormEscape"
      >
        <header class="bank-transfer-form__section-header">
          <span class="bank-transfer-form__section-title">基本信息</span>
        </header>
        <Form
          class="bank-transfer-form__base-form erp-form-focus-highlight"
          :class="{
            'bank-transfer-form__base-form--editable': !isDetail,
          }"
          @keydown.enter.capture="handleBasicFormEnter"
        />
      </section>

      <section
        v-if="!detailLoading && !detailLoadError && isDetail && formData"
        class="bank-transfer-form__section bank-transfer-form__audit"
      >
        <header class="bank-transfer-form__section-header">
          <span class="bank-transfer-form__section-title">审计信息</span>
        </header>
        <ErpAuditInfo title="" :record="formData" />
      </section>
    </div>

    <template #cancelText>
      {{ isDetail ? '关闭' : '取消' }}
    </template>
  </Modal>
  <RemarkModal @success="handleRemarkSuccess" />
</template>

<style scoped>
.bank-transfer-form__title {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.bank-transfer-form__title-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.bank-transfer-form__title-text > span {
  line-height: 1.25;
}

.bank-transfer-form__title-text small {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.bank-transfer-form__status {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 6px;
  align-items: center;
  padding: 2px 9px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid currentcolor;
  border-radius: 999px;
}

.bank-transfer-form__status::before {
  width: 6px;
  height: 6px;
  content: '';
  background: currentcolor;
  border-radius: 50%;
}

.bank-transfer-form__status.is-draft {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.bank-transfer-form__status.is-pending {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 10%);
}

.bank-transfer-form__status.is-success {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
}

.bank-transfer-form__status.is-muted {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
}

.bank-transfer-form__view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100vh - 112px);
  min-height: 100%;
  padding: 12px;
  overflow: auto;
  font-size: 12px;
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 28%);
}

.bank-transfer-form__load-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.bank-transfer-form__load-state.is-error {
  color: hsl(var(--destructive));
}

.bank-transfer-form__section {
  overflow: visible;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.bank-transfer-form__section-header {
  display: flex;
  align-items: center;
  min-height: 40px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.bank-transfer-form__section-title {
  position: relative;
  padding-left: 10px;
  font-size: 13px;
  font-weight: 600;
}

.bank-transfer-form__section-title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  content: '';
  background: hsl(var(--primary));
  border-radius: 3px;
}

.bank-transfer-form__base-form :deep(.bank-transfer-basic-grid) {
  gap: 0 12px;
  padding: 12px;
}

.bank-transfer-form__base-form :deep(.bank-transfer-basic-grid > div) {
  min-width: 0;
}

.bank-transfer-form__base-form :deep(.bank-transfer-basic-grid > div > label) {
  padding-right: 10px;
  margin-right: 0;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.bank-transfer-form__base-form
  :deep(.bank-transfer-basic-grid .bank-transfer-form__divider) {
  min-height: 28px;
  margin: 4px 0 2px;
}

.bank-transfer-form__base-form
  :deep(
    .bank-transfer-basic-grid
      .bank-transfer-form__divider
      .ant-form-item-control-input
  ) {
  min-height: 28px;
}

.bank-transfer-form__base-form
  :deep(.bank-transfer-basic-grid .bank-transfer-form__divider .ant-divider) {
  margin: 4px 0;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.bank-transfer-form__base-form
  :deep(.bank-transfer-basic-grid > div > .flex-auto) {
  min-width: 0;
}

.bank-transfer-form__base-form :deep(.ant-input),
.bank-transfer-form__base-form :deep(.ant-picker),
.bank-transfer-form__base-form :deep(.ant-select-selector) {
  min-height: 32px;
  font-size: 12px;
  background: hsl(var(--muted) / 48%) !important;
  border-color: hsl(var(--border)) !important;
  border-radius: 6px !important;
}

.bank-transfer-form__base-form :deep(.ant-input),
.bank-transfer-form__base-form :deep(.ant-picker-input > input),
.bank-transfer-form__base-form :deep(.ant-select-selection-item),
.bank-transfer-form__base-form :deep(.ant-select-selection-placeholder) {
  font-size: 12px;
}

.bank-transfer-form__base-form :deep(.ant-input),
.bank-transfer-form__base-form :deep(.ant-picker),
.bank-transfer-form__base-form :deep(.ant-select-single) {
  min-height: 32px;
}

.bank-transfer-form__base-form :deep(textarea.ant-input) {
  min-height: 72px !important;
  resize: vertical;
}

.bank-transfer-form__base-form--editable :deep(.ant-input:not(:disabled)),
.bank-transfer-form__base-form--editable
  :deep(.ant-picker:not(.ant-picker-disabled)),
.bank-transfer-form__base-form--editable
  :deep(.ant-select:not(.ant-select-disabled) .ant-select-selector),
.bank-transfer-form__base-form--editable
  :deep(.ant-upload-picture-card-wrapper .ant-upload-select) {
  background: hsl(var(--background)) !important;
}

.bank-transfer-form__base-form--editable :deep(.ant-input:disabled),
.bank-transfer-form__base-form--editable :deep(.ant-picker-disabled),
.bank-transfer-form__base-form--editable
  :deep(.ant-select-disabled .ant-select-selector),
.bank-transfer-form__base-form--editable
  :deep(.ant-upload-wrapper .ant-upload-disabled) {
  color: hsl(var(--muted-foreground)) !important;
  background: hsl(var(--muted-foreground) / 14%) !important;
  border-color: hsl(var(--muted-foreground) / 28%) !important;
}

.bank-transfer-form__base-form
  :deep(.ant-upload-picture-card-wrapper .ant-upload-list-item-container),
.bank-transfer-form__base-form
  :deep(.ant-upload-picture-card-wrapper .ant-upload-select) {
  width: 100% !important;
  height: 32px !important;
  margin: 0 !important;
  border-radius: 6px;
}

.bank-transfer-form__audit :deep(.erp-audit-info) {
  padding: 12px;
}

.bank-transfer-form__audit :deep(.erp-audit-info .text-sm) {
  font-size: 12px;
}

.bank-transfer-form__audit :deep(.erp-audit-info > div:first-child) {
  display: none;
}

:global(.bank-transfer-form-select-dropdown .ant-select-item),
:global(.bank-transfer-form-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

@media (max-width: 900px) {
  .bank-transfer-form__base-form :deep(.bank-transfer-basic-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .bank-transfer-form__base-form :deep(.bank-transfer-basic-grid .col-span-4) {
    grid-column: span 2 / span 2;
  }
}

@media (max-width: 640px) {
  .bank-transfer-form__view {
    padding: 8px;
  }

  .bank-transfer-form__base-form :deep(.bank-transfer-basic-grid) {
    grid-template-columns: minmax(0, 1fr);
    padding: 8px;
  }

  .bank-transfer-form__base-form :deep(.bank-transfer-basic-grid .col-span-4) {
    grid-column: span 1 / span 1;
  }
}
</style>
