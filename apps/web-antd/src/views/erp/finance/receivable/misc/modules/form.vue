<script lang="ts" setup>import { financeValue } from '#/views/erp/finance/utils/finance-decimal';

import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import { useFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { ErpReceivableMiscApi } from '#/api/erp/finance/receivable/misc';

import { computed, defineAsyncComponent, nextTick, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';


import { Modal as AntModal, Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { useFieldPermission } from '#/composables/useFieldPermission';
import {
  createAndSubmitReceivableMisc,
  createReceivableMiscDraft,
  getReceivableMisc,
  submitReceivableMisc,
  updateAndSubmitReceivableMisc,
  updateReceivableMisc,
  updateReceivableMiscDraft,
} from '#/api/erp/finance/receivable/misc';
import { $t } from '#/locales';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import { useReportViewOnly } from '#/views/erp/report/components/report-view-only';
import MiscSettlementTable from '#/views/erp/finance/components/misc-settlement-table.vue';
import {
  buildFinanceDocumentDetailFormValues,
  buildFinanceDocumentFormSchema,
  hydrateFinanceDocumentFormSelectLabels,
} from '#/views/erp/finance/utils/document-form-ui';
import {
  handleFinanceEditableFormEnter,
  queueFocusFirstFinanceEditableFormControl,
} from '#/views/erp/finance/utils/form-enter-focus';
import { ensureModalReady } from '#/views/erp/utils/lazy-modal';

import { useFormSchema } from '../data';
import { normalizeReceivableMiscFormValues } from '../ui';
import '#/views/erp/styles/form-focus.css';
const { candidateSchema } = useFinanceCandidateFocus();

defineOptions({ name: 'ErpReceivableMiscForm' });

const emit = defineEmits(['success', 'audit']);
const reportViewOnly = useReportViewOnly();
const formType = ref('create');
const formData = ref<ErpReceivableMiscApi.ReceivableMisc>({});
const detailLoading = ref(false);
const settlementRevision = ref(0);
const detailLoadError = ref('');
const basicFormRef = ref<HTMLElement | null>(null);
const { hasAccessByCodes } = useAccess();
const userStore = useUserStore();
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  'erp_finance_receivable_misc',
);
let openRequestId = 0;
const DETAIL_REQUEST_TIMEOUT = 15_000;

const isDetail = computed(() => formType.value === 'detail');
const isEditingDraft = computed(
  () => formType.value === 'edit' && Number(formData.value.status) === 0,
);
const canConfirmForm = computed(() => {
  if (isDetail.value || detailLoading.value || detailLoadError.value)
    return false;
  if (formType.value === 'create' || isEditingDraft.value) {
    return hasAccessByCodes(['erp:receivable-misc:update-status']);
  }
  return hasAccessByCodes(['erp:receivable-misc:update']);
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
const canEditFromDetail = computed(
  () =>
    isDetail.value &&
    !detailLoading.value &&
    !detailLoadError.value &&
    Boolean(formData.value.id) &&
    [0, 10].includes(Number(formData.value.status)) &&
    hasAccessByCodes(['erp:receivable-misc:update']),
);
const canSubmitDraftFromDetail = computed(
  () =>
    isDetail.value &&
    !detailLoading.value &&
    !detailLoadError.value &&
    Number(formData.value.status) === 0 &&
    hasAccessByCodes(['erp:receivable-misc:update-status']),
);
const canAudit = computed(
  () =>
    isDetail.value &&
    Number(formData.value.status) === 10 &&
    hasAccessByCodes(['erp:receivable-misc:update-status']),
);
const canShowSettledTransferState = computed(
  () =>
    isDetail.value &&
    !detailLoading.value &&
    !detailLoadError.value &&
    Boolean(formData.value.id) &&
    Number(formData.value.status) === 20 &&
    !formData.value.generatedOffset &&
    formData.value.transferAvailableAmount !== null &&
    formData.value.transferAvailableAmount !== undefined &&
    getTransferAvailableAmount() === 0 &&
    hasAccessByCodes(['erp:finance-receipt:create']),
);
const canTransferToReceivable = computed(
  () =>
    isDetail.value &&
    !detailLoading.value &&
    !detailLoadError.value &&
    Boolean(formData.value.id) &&
    Number(formData.value.status) === 20 &&
    !formData.value.generatedOffset &&
    formData.value.transferAvailableAmount !== null &&
    formData.value.transferAvailableAmount !== undefined &&
    getTransferAvailableAmount() !== 0 &&
    hasAccessByCodes(['erp:finance-receipt:create']),
);

const shouldRenderReceipt = ref(false);
const settlementOpening = ref(false);
const loadReceiptForm = () =>
  import('#/views/erp/finance/settlement/receipt/modules/form.vue');
const ReceiptForm = defineAsyncComponent(loadReceiptForm);
const [ReceiptModal, receiptModalApi] = useVbenModal({
  connectedComponent: ReceiptForm,
  destroyOnClose: false,
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

const title = computed(() => {
  if (formType.value === 'create')
    return $t('ui.actionTitle.create', ['其他应收']);
  if (formType.value === 'edit') return $t('ui.actionTitle.edit', ['其他应收']);
  return '其他应收详情';
});

const detailStatus = computed(() => {
  if (formData.value.generatedOffset)
    return { className: 'is-success', label: '系统冲减单' };
  if (Number(formData.value.status) === 0)
    return { className: 'is-draft', label: '草稿' };
  if (Number(formData.value.status) === 10)
    return { className: 'is-pending', label: '待审核' };
  if (Number(formData.value.status) === 20)
    return { className: 'is-success', label: '已审核' };
  return { className: 'is-muted', label: '状态未知' };
});

const detailSummaryItems = computed(() =>
  formData.value.generatedOffset
    ? [
        {
          emphasis: false,
          label: '来源类型',
          value: formatDetailText(formData.value.sourceType),
        },
        {
          emphasis: false,
          label: '来源单号',
          value: formatDetailText(formData.value.sourceNo),
        },
        {
          emphasis: false,
          label: '冲减原单号',
          value: formatDetailText(formData.value.sourceMiscNo),
        },
      ]
    : [
        {
          emphasis: false,
          label: '原金额',
          value: formatDetailAmount(formData.value.amount),
        },
        {
          emphasis: false,
          label: '已收金额',
          value: formatDetailAmount(formData.value.settledAmount),
        },
        {
          emphasis: true,
          label: '剩余金额',
          value: formatDetailAmount(
            formData.value.balanceAmount ?? formData.value.amount,
          ),
        },
        {
          emphasis: false,
          label: '待审批占用',
          value: formatDetailAmount(formData.value.pendingTransferAmount),
        },
        {
          emphasis: false,
          label: '剩余可转金额',
          value: formatDetailAmount(formData.value.transferAvailableAmount),
        },
      ],
);

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    labelClass: '!justify-start !text-left',
    labelWidth: 82,
  },
  wrapperClass: 'receivable-misc-basic-grid grid-cols-4',
  layout: 'horizontal',
  schema: buildFormSchema(formType.value),
  showDefaultActions: false,
});

function buildFormSchema(type: string) {
  return candidateSchema(
    buildFinanceDocumentFormSchema(
      useFormSchema(type).filter(
        (field) => !hiddenFields.value.includes(field.fieldName),
      ),
      {
        data: formData.value,
        formType: type,
      },
    ),
  );
}

function createDefaultFormData(): ErpReceivableMiscApi.ReceivableMisc {
  return {
    deptId: userStore.userInfo?.deptId,
  };
}

async function applyFormMode(type: string) {
  formType.value = type;
  modalApi.setState({ fullscreen: true });
  formApi.setDisabled(type === 'detail');
  formApi.updateSchema(buildFormSchema(type));
  await nextTick();
}

function formatDetailText(value: unknown) {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function formatDetailAmount(value: unknown) {
  if (value === undefined || value === null) return '—';
  return `¥${erpPriceInputFormatter(Number(value || 0)) || '0.00'}`;
}

function getTransferAvailableAmount() {
  return financeValue(formData.value.transferAvailableAmount ?? 0);
}

function withDetailRequestTimeout<T>(request: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('详情请求超时')),
      DETAIL_REQUEST_TIMEOUT,
    );
  });
  return Promise.race([request, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function buildPayload(values: ErpReceivableMiscApi.ReceivableMisc) {
  return {
    id: formData.value.id,
    customerId: values.customerId,
    accountId: values.accountId,
    deptId: values.deptId,
    amount:
      values.amount === undefined || values.amount === null
        ? undefined
        : financeValue(values.amount),
    remark: values.remark,
    fileUrl: values.fileUrl,
  };
}

async function saveDraft(closeAfterSave: boolean) {
  const { valid } = await formApi.validate();
  if (!valid) return;
  const isCreatingDraft = formType.value === 'create';
  modalApi.lock();
  try {
    const payload = buildPayload(await formApi.getValues());
    await (isCreatingDraft
      ? createReceivableMiscDraft(payload)
      : updateReceivableMiscDraft(payload));
    message.success(isCreatingDraft ? '草稿生成成功' : '草稿保存成功');
    emit('success');
    if (closeAfterSave) await modalApi.close();
  } catch {
    message.error(
      isCreatingDraft ? '草稿生成失败，请稍后重试' : '草稿保存失败，请稍后重试',
    );
  } finally {
    modalApi.unlock();
  }
}

async function handleSaveDraft() {
  if (!canGenerateDraft.value) return;
  await saveDraft(true);
}

async function handleEditFromDetail() {
  await applyFormMode('edit');
  await formApi.resetForm();
  await formApi.setValues(formData.value, false);
  queueFocusFirstBasicFormControl();
}

function handleSubmitDraftFromDetail() {
  if (!formData.value.id) return;
  const id = formData.value.id;
  AntModal.confirm({
    title: `确认提交其他应收草稿${formData.value.no ? ` ${formData.value.no}` : ''}吗？`,
    content: '提交后将进入待审核状态，不能再按草稿方式修改。',
    async onOk() {
      modalApi.lock();
      try {
        await submitReceivableMisc(id);
        message.success('其他应收草稿已提交，下一步可进行审核');
        emit('success');
        await modalApi.close();
      } finally {
        modalApi.unlock();
      }
    },
  });
}

async function openSettlementModal(data: Record<string, unknown>) {
  if (settlementOpening.value) return;
  const requestId = openRequestId;
  settlementOpening.value = true;
  try {
    await ensureModalReady(
      shouldRenderReceipt,
      receiptModalApi,
      loadReceiptForm,
    );
    if (requestId !== openRequestId) return;
    receiptModalApi.setData(data).open();
  } catch {
    message.error('收款单窗口加载失败，请重试');
  } finally {
    settlementOpening.value = false;
  }
}

function handleTransferToReceivable() {
  if (!canTransferToReceivable.value) return;
  return openSettlementModal({
    type: 'create',
    sourceReceivableMisc: {
      ...formData.value,
      amount: getTransferAvailableAmount(),
    },
  });
}

function openSettlementDocument(id: number) {
  if (!hasAccessByCodes(['erp:finance-receipt:query'])) return;
  return openSettlementModal({ id, type: 'detail' });
}

async function refreshSettlement() {
  const id = formData.value.id;
  const requestId = openRequestId;
  if (!id || !isDetail.value) return;
  try {
    const detail = await getReceivableMisc(id);
    if (requestId !== openRequestId || formData.value.id !== id) return;
    formData.value = normalizeReceivableMiscFormValues(detail);
    ++settlementRevision.value;
    emit('success');
  } catch {
    if (requestId === openRequestId) message.error('结算信息刷新失败，请重试');
  }
}

const [Modal, modalApi] = useVbenModal({
  async onCancel() {
    await modalApi.close();
  },
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    modalApi.lock();
    try {
      const payload = buildPayload(await formApi.getValues());
      if (formType.value === 'create') {
        await createAndSubmitReceivableMisc(payload);
      } else if (isEditingDraft.value) {
        await updateAndSubmitReceivableMisc(payload);
      } else {
        await updateReceivableMisc(payload);
      }
      message.success($t('ui.actionMessage.operationSuccess'));
      emit('success');
      await modalApi.close();
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      ++openRequestId;
      detailLoading.value = false;
      detailLoadError.value = '';
      formData.value = {};
      modalApi.unlock();
      return;
    }

    const requestId = ++openRequestId;
    const modalData = modalApi.getData<{ id?: number; type: string }>();
    const nextFormType = modalData?.type || 'create';
    const isDetailMode = nextFormType === 'detail';
    detailLoading.value = Boolean(modalData?.id);
    detailLoadError.value = '';
    try {
      await loadHiddenFields();
      await applyFormMode(nextFormType);
      formData.value = {};
      if (!isDetailMode) {
        await formApi.resetForm();
        const defaults = createDefaultFormData();
        formData.value = defaults;
        await formApi.setValues(defaults, false);
      }
      if (!modalData?.id) return;

      const detail = await withDetailRequestTimeout(
        getReceivableMisc(modalData.id),
      );
      if (requestId !== openRequestId) return;
      formData.value = await hydrateFinanceDocumentFormSelectLabels(
        normalizeReceivableMiscFormValues(detail || {}),
      );
      await applyFormMode(nextFormType);
      await formApi.setValues(
        buildFinanceDocumentDetailFormValues(formData.value, nextFormType),
        false,
      );
    } catch {
      if (requestId === openRequestId) {
        detailLoadError.value = modalData?.id
          ? '其他应收详情加载失败，请关闭后重试'
          : '其他应收表单加载失败，请关闭后重试';
        message.error(detailLoadError.value);
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
    class="!w-full receivable-misc-document-modal"
    bordered
    content-class="p-0"
    :confirm-text="confirmText"
    :show-confirm-button="canConfirmForm"
  >
    <template v-if="!reportViewOnly" #center-footer>
      <Button v-if="canGenerateDraft" @click="handleSaveDraft">
        {{ generateDraftButtonText }}
      </Button>
    </template>

    <template v-if="!reportViewOnly" #prepend-footer>
      <Button
        v-if="canSubmitDraftFromDetail"
        type="primary"
        @click="handleSubmitDraftFromDetail"
      >
        提交
      </Button>
      <Button
        v-if="canEditFromDetail"
        type="primary"
        ghost
        @click="handleEditFromDetail"
      >
        编辑
      </Button>
      <Button
        v-if="canTransferToReceivable"
        :loading="settlementOpening"
        type="primary"
        ghost
        @click="handleTransferToReceivable"
      >
        转收款
      </Button>
      <Button v-if="canShowSettledTransferState" disabled>
        {{ Number(formData.balanceAmount) === 0 ? '已结清' : '暂无可转金额' }}
      </Button>
      <Button v-if="canAudit" type="primary" @click="emit('audit', formData)">
        审核
      </Button>
    </template>

    <div
      class="misc-document-view"
      :class="{ 'erp-form-focus-highlight': formType !== 'detail' }"
    >
      <div v-if="detailLoading" class="misc-document-load-state">
        其他应收详情加载中...
      </div>
      <div
        v-else-if="detailLoadError"
        class="misc-document-load-state is-error"
      >
        {{ detailLoadError }}
      </div>
      <section
        v-show="!detailLoading && !detailLoadError"
        ref="basicFormRef"
        class="misc-document-section"
      >
        <header class="misc-document-section__header">
          <span class="misc-document-section__title">基础信息</span>
          <span
            v-if="
              formType !== 'create' &&
              formData.status !== undefined &&
              !detailLoadError
            "
            class="misc-document-status"
            :class="detailStatus.className"
          >
            {{ detailStatus.label }}
          </span>
        </header>
        <Form
          class="misc-document-edit-form"
          :class="{ 'misc-document-edit-form--editable': !isDetail }"
          @keydown.enter.capture="handleBasicFormEnter"
        />
      </section>

      <MiscSettlementTable
        v-if="
          isDetail &&
          !detailLoading &&
          !detailLoadError &&
          formData.id &&
          !formData.generatedOffset
        "
        :id="formData.id"
        class="misc-document-settlement"
        direction="receivable"
        :revision="settlementRevision"
        @open="openSettlementDocument"
        @refresh="refreshSettlement"
      />

      <section
        v-if="isDetail && !detailLoading && !detailLoadError"
        class="misc-document-section misc-document-summary-section"
      >
        <header class="misc-document-section__header">
          <span class="misc-document-section__title">
            {{ formData.generatedOffset ? '来源信息' : '单据合计' }}
          </span>
        </header>
        <div class="misc-document-summary">
          <span
            v-for="item in detailSummaryItems"
            :key="item.label"
            :class="{ 'is-emphasis': item.emphasis }"
          >
            {{ item.label }}
            <b>{{ item.value }}</b>
          </span>
        </div>
      </section>

      <section
        v-if="isDetail && !detailLoading && !detailLoadError"
        class="misc-document-section"
      >
        <header class="misc-document-section__header">
          <span class="misc-document-section__title">审计信息</span>
        </header>
        <ErpAuditInfo title="" :record="formData" />
      </section>
    </div>

    <template #cancelText>
      {{ isDetail ? '关闭' : '取消' }}
    </template>
  </Modal>
  <ReceiptModal v-if="shouldRenderReceipt" @success="refreshSettlement" />
</template>

<style scoped>
.misc-document-status {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 6px;
  align-items: center;
  padding: 2px 9px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid hsl(var(--border));
  border-color: currentcolor;
  border-radius: 999px;
}

.misc-document-status::before {
  width: 6px;
  height: 6px;
  content: '';
  background: currentcolor;
  border-radius: 50%;
}

.misc-document-status.is-draft,
.misc-document-status.is-pending {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 10%);
}

.misc-document-status.is-success {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
}

.misc-document-status.is-muted {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
}

.misc-document-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 220px;
  padding: 12px;
  font-size: 12px;
  background: hsl(var(--muted) / 28%);
}

.misc-document-load-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.misc-document-load-state.is-error {
  color: hsl(var(--destructive));
}

.misc-document-section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.misc-document-section__header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.misc-document-section__title {
  position: relative;
  padding-left: 10px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.misc-document-section__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  content: '';
  background: hsl(var(--primary));
  border-radius: 3px;
}

.misc-document-edit-form :deep(.receivable-misc-basic-grid) {
  gap: 0 12px;
  padding: 12px;
}

.misc-document-edit-form :deep(.receivable-misc-basic-grid > div) {
  min-width: 0;
}

.misc-document-edit-form :deep(.receivable-misc-basic-grid > div > label) {
  padding-right: 10px;
  margin-right: 0;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.misc-document-edit-form :deep(.receivable-misc-basic-grid > div > .flex-auto) {
  min-width: 0;
}

.misc-document-edit-form
  :deep(.receivable-misc-basic-grid > .receivable-misc-full-row) {
  grid-column: 1 / -1;
}

.misc-document-edit-form :deep(.ant-form-item) {
  margin-bottom: 10px;
}

.misc-document-edit-form :deep(.ant-input),
.misc-document-edit-form :deep(.ant-input-affix-wrapper),
.misc-document-edit-form :deep(.ant-picker),
.misc-document-edit-form :deep(.ant-select-selector),
.misc-document-edit-form :deep(.ant-input-number) {
  min-height: 32px;
  font-size: 12px;
  background: hsl(var(--muted) / 48%) !important;
  border-color: hsl(var(--border)) !important;
  border-radius: 6px !important;
}

.misc-document-edit-form :deep(.ant-input),
.misc-document-edit-form :deep(.ant-input-number),
.misc-document-edit-form :deep(.ant-picker-input > input),
.misc-document-edit-form :deep(.ant-select-selection-item),
.misc-document-edit-form :deep(.ant-select-selection-placeholder) {
  font-size: 12px;
}

.misc-document-edit-form :deep(input.ant-input),
.misc-document-edit-form :deep(.ant-picker) {
  height: 32px;
}

.misc-document-edit-form :deep(.ant-select-single),
.misc-document-edit-form :deep(.ant-select-single .ant-select-selector) {
  height: 32px !important;
}

.misc-document-edit-form
  :deep(.ant-select-single .ant-select-selection-search-input) {
  height: 30px;
}

.misc-document-edit-form :deep(.ant-select-single .ant-select-selection-item),
.misc-document-edit-form
  :deep(.ant-select-single .ant-select-selection-placeholder) {
  line-height: 30px;
}

.misc-document-edit-form
  :deep(.finance-document-form-readonly-text.ant-input-affix-wrapper) {
  box-sizing: border-box;
  height: 32px !important;
  min-height: 32px !important;
  padding: 4px 11px;
  font-size: 12px;
}

.misc-document-edit-form
  :deep(
    .finance-document-form-readonly-text.ant-input-affix-wrapper
      > input.ant-input
  ) {
  height: 22px !important;
  min-height: 0;
  padding: 0;
  line-height: 22px;
  background: transparent !important;
}

.misc-document-edit-form :deep(textarea) {
  min-height: 32px !important;
  resize: none;
}

.misc-document-edit-form :deep(.ant-upload-wrapper),
.misc-document-edit-form :deep(.ant-upload-wrapper > div) {
  width: 100%;
}

.misc-document-edit-form--editable :deep(.ant-input:not(:disabled)),
.misc-document-edit-form--editable :deep(.ant-picker:not(.ant-picker-disabled)),
.misc-document-edit-form--editable
  :deep(.ant-select:not(.ant-select-disabled) .ant-select-selector),
.misc-document-edit-form--editable
  :deep(.ant-upload-select:not(.ant-upload-disabled)) {
  background: hsl(var(--background)) !important;
}

.misc-document-edit-form--editable :deep(.ant-input:disabled),
.misc-document-edit-form--editable :deep(.ant-input-disabled),
.misc-document-edit-form--editable :deep(.ant-picker-disabled),
.misc-document-edit-form--editable
  :deep(.ant-select-disabled .ant-select-selector),
.misc-document-edit-form--editable :deep(.ant-upload-disabled) {
  color: hsl(var(--muted-foreground)) !important;
  cursor: not-allowed;
  background: hsl(var(--muted-foreground) / 14%) !important;
  border-color: hsl(var(--muted-foreground) / 28%) !important;
}

.misc-document-settlement {
  padding: 0;
  overflow: hidden;
}

.misc-document-settlement :deep(header) {
  min-height: 40px;
  padding: 0 12px;
  margin: 0;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.misc-document-settlement :deep(header > span) {
  position: relative;
  padding-left: 10px;
  font-size: 13px;
}

.misc-document-settlement :deep(header > span::before) {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  content: '';
  background: hsl(var(--primary));
  border-radius: 3px;
}

.misc-document-settlement :deep(.ant-alert) {
  margin: 10px 10px 0;
}

.misc-document-settlement :deep(.ant-table-wrapper) {
  padding: 10px 10px 0;
}

.misc-document-settlement :deep(.ant-table),
.misc-document-settlement :deep(.ant-table-cell),
.misc-document-settlement :deep(.ant-table-cell > *),
.misc-document-settlement :deep(.ant-pagination),
.misc-document-settlement :deep(.ant-pagination-item),
.misc-document-settlement :deep(.ant-pagination-options),
.misc-document-settlement :deep(.ant-pagination .ant-select),
.misc-document-settlement :deep(.ant-pagination .ant-select-selection-item) {
  font-size: 12px !important;
}

.misc-document-summary-section .misc-document-section__header {
  border-bottom: 0;
}

.misc-document-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  align-items: center;
  justify-content: flex-end;
  min-height: 44px;
  padding: 8px 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 20%);
  border-top: 1px solid hsl(var(--border));
}

.misc-document-summary b {
  margin-left: 5px;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}

.misc-document-summary .is-emphasis b {
  color: hsl(var(--primary));
}

.misc-document-section :deep(.erp-audit-info) {
  padding: 12px;
}

.misc-document-section :deep(.erp-audit-info .text-sm) {
  font-size: 12px;
}

.misc-document-section :deep(.erp-audit-info > div:first-child) {
  display: none;
}

@media (max-width: 960px) {
  .misc-document-edit-form :deep(.receivable-misc-basic-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .misc-document-view {
    padding: 8px;
  }

  .misc-document-edit-form :deep(.receivable-misc-basic-grid) {
    grid-template-columns: 1fr;
  }

  .misc-document-summary {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
