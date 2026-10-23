<script lang="ts" setup>import { financeValue } from '#/views/erp/finance/utils/finance-decimal';

import { useFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { ErpReceivableMiscApi } from '#/api/erp/finance/receivable/misc';
import type { ErpReceivableOtherApi } from '#/api/erp/finance/receivable/other-receivable';

import { computed, defineAsyncComponent, nextTick, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Modal as AntModal, Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createAndSubmitOtherReceivable,
  createOtherReceivableDraft,
  getOtherReceivable,
  submitOtherReceivable,
  updateAndSubmitOtherReceivable,
  updateOtherReceivable,
  updateOtherReceivableDraft,
} from '#/api/erp/finance/receivable/other-receivable';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import { replaceDetailFieldWithLinkSlot } from '#/views/erp/components/detail-link-schema';
import DetailLinkInput from '#/views/erp/components/DetailLinkInput.vue';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import FinanceDocumentRemarkForm from '#/views/erp/finance/components/FinanceDocumentRemarkForm.vue';
import { buildFinanceCopyDraft } from '#/views/erp/finance/utils/copy-draft';
import {
  buildFinanceDocumentDetailFormValues,
  buildFinanceDocumentFormSchema,
  hydrateFinanceDocumentFormSelectLabels,
} from '#/views/erp/finance/utils/document-form-ui';
import {
  collectFinanceDeptIds,
  getOtherReceivableCustomerDeptTree,
} from '#/views/erp/finance/utils/dept';
import {
  handleFinanceEditableFormEnter,
  queueFocusFirstFinanceEditableFormControl,
} from '#/views/erp/finance/utils/form-enter-focus';
import { normalizeOptionalNumberFields } from '#/views/erp/finance/utils/text-number';
import '#/views/erp/styles/form-focus.css';
import { useReportViewOnly } from '#/views/erp/report/components/report-view-only';
import { getErpDetailLoadError } from '#/views/erp/utils/detail-load-error';
import { getCurrentLocalDate } from '#/views/erp/utils/form-defaults';

import { useFormSchema } from '../data';
import { normalizeOtherReceivableBizDate } from '../ui';
const { candidateSchema } = useFinanceCandidateFocus();

defineOptions({ name: 'ErpReceivableOtherForm' });

interface OtherReceivableModalData {
  id?: number;
  sourceReceivableMisc?: ErpReceivableMiscApi.ReceivableMisc;
  type: string;
}

const emit = defineEmits(['success', 'audit']);
const formType = ref('create');
const formData = ref<ErpReceivableOtherApi.OtherReceivable>();
const { hasAccessByCodes } = useAccess();
const reportViewOnly = useReportViewOnly();
const userStore = useUserStore();
const detailLoading = ref(false);
const detailLoadError = ref('');
const basicFormRef = ref<HTMLElement | null>(null);
let openRequestId = 0;
let skipDraftOnClose = false;
let draftSaving = false;
let draftSaved = false;
let customerDeptLoadSequence = 0;
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  'erp_finance_receivable_other',
);

const isDetail = computed(() => formType.value === 'detail');
const isEditingDraft = computed(
  () => formType.value === 'edit' && formData.value?.status === 0,
);
const canConfirmForm = computed(() => {
  if (isDetail.value || detailLoadError.value) return false;
  if (formType.value === 'create' || isEditingDraft.value) {
    return hasAccessByCodes(['erp:receivable-other:update-status']);
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
    Boolean(formData.value?.id) &&
    formData.value?.status === 0 &&
    hasAccessByCodes(['erp:receivable-other:update-status']),
);
const canEditFromDetail = computed(
  () =>
    isDetail.value &&
    !detailLoading.value &&
    !detailLoadError.value &&
    Boolean(formData.value?.id) &&
    [0, 10].includes(Number(formData.value?.status)) &&
    hasAccessByCodes(['erp:receivable-other:update']),
);
const canApprove = computed(
  () =>
    isDetail.value &&
    formData.value?.status === 10 &&
    hasAccessByCodes(['erp:receivable-other:update-status']),
);
const canEditRemark = computed(
  () =>
    isDetail.value &&
    Boolean(formData.value?.id) &&
    hasAccessByCodes(['erp:receivable-other:update']),
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
      documentName: '应收调账单',
      documentType: 'other-receivable',
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
const canOpenCustomerDetail = computed(() =>
  Boolean(formData.value?.customerId && formData.value?.customerName),
);
const CustomerDetail = defineAsyncComponent(
  () => import('#/views/erp/sale/customer/modules/detail.vue'),
);
const [CustomerDetailModal, customerDetailModalApi] = useVbenModal({
  connectedComponent: CustomerDetail,
  destroyOnClose: true,
});

function handleOpenCustomerDetail() {
  if (!formData.value?.customerId) return;
  customerDetailModalApi.setData({ id: formData.value.customerId }).open();
}

const title = computed(() => {
  if (formType.value === 'create')
    return $t('ui.actionTitle.create', ['应收调账']);
  if (formType.value === 'copy')
    return $t('ui.actionTitle.create', ['应收调账']);
  if (formType.value === 'edit') return $t('ui.actionTitle.edit', ['应收调账']);
  return '应收调账详情';
});

const detailStatus = computed(() => {
  if (formData.value?.status === 0) {
    return { className: 'is-draft', label: '草稿' };
  }
  if (formData.value?.status === 10) {
    return { className: 'is-pending', label: '未审核' };
  }
  if (formData.value?.status === 20) {
    return { className: 'is-success', label: '已审核' };
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
  wrapperClass: 'other-receivable-basic-grid grid-cols-4',
  layout: 'horizontal',
  schema: buildFormSchema(formType.value),
  showDefaultActions: false,
  handleValuesChange: async (values, changedFields) => {
    if (changedFields.includes('customerId')) {
      const nextCustomerId = normalizeOptionalId(values.customerId);
      const previousCustomerId = normalizeOptionalId(
        formData.value?.customerId,
      );
      if (!formData.value) {
        formData.value = {} as ErpReceivableOtherApi.OtherReceivable;
      }
      formData.value.customerId = nextCustomerId;
      await refreshCustomerDeptOptions(nextCustomerId, {
        clearInvalidDept: previousCustomerId !== nextCustomerId,
        selectedDeptId: normalizeOptionalId(values.deptId),
        warnOnClear: Boolean(
          nextCustomerId &&
          values.deptId &&
          previousCustomerId !== nextCustomerId,
        ),
      });
    }
    if (formData.value && changedFields.includes('deptId')) {
      formData.value.deptId = normalizeOptionalId(values.deptId);
    }
  },
});

type OtherReceivableDeptFieldRef = {
  updateParam?: (newParams: Record<string, any>) => void;
};

function normalizeOptionalId(value?: null | number | string) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
}

function updateDeptFieldCustomerParam(customerId?: number) {
  formApi
    .getFieldComponentRef<OtherReceivableDeptFieldRef>('deptId')
    ?.updateParam?.(customerId ? { customerId } : {});
}

async function refreshCustomerDeptOptions(
  customerId?: number,
  options: {
    clearInvalidDept?: boolean;
    selectedDeptId?: number;
    warnOnClear?: boolean;
  } = {},
) {
  const sequence = ++customerDeptLoadSequence;
  const normalizedCustomerId = normalizeOptionalId(customerId);
  updateDeptFieldCustomerParam(normalizedCustomerId);
  if (!normalizedCustomerId) {
    if (options.clearInvalidDept && options.selectedDeptId !== undefined) {
      await formApi.setValues({ deptId: undefined }, false);
      if (formData.value) {
        formData.value.deptId = undefined;
        formData.value.deptName = undefined;
      }
    }
    return new Set<number>();
  }

  const tree = await getOtherReceivableCustomerDeptTree({
    customerId: normalizedCustomerId,
  });
  if (sequence !== customerDeptLoadSequence) {
    return new Set<number>();
  }
  const availableDeptIds = collectFinanceDeptIds(tree);
  const selectedDeptId = normalizeOptionalId(options.selectedDeptId);
  if (
    options.clearInvalidDept &&
    selectedDeptId !== undefined &&
    !availableDeptIds.has(selectedDeptId)
  ) {
    await formApi.setValues({ deptId: undefined }, false);
    if (formData.value) {
      formData.value.deptId = undefined;
      formData.value.deptName = undefined;
    }
    if (options.warnOnClear) {
      message.warning('当前部门不在该客户可用部门范围内，已清空');
    }
  }
  return availableDeptIds;
}

function buildFormSchema(
  type: string,
  customerData:
    | ErpReceivableOtherApi.OtherReceivable
    | undefined = formData.value,
) {
  return candidateSchema(
    buildFinanceDocumentFormSchema(useFormSchema(type, hiddenFields.value), {
      data: customerData,
      formType: type,
    }),
  );
}

function getDefaultValues() {
  const userInfo = userStore.userInfo;
  return {
    bizTime: getCurrentLocalDate(),
    creatorName: userInfo?.nickname,
    settledAmount: 0,
    costAmount: 0,
    deptId: userInfo?.deptId,
    sourceType: '调账',
    receivableType: '普通应收',
    isPaperNote: false,
  };
}

function buildSourceReceivableMiscDefaults(
  source: ErpReceivableMiscApi.ReceivableMisc,
) {
  const defaults = getDefaultValues();
  return {
    ...defaults,
    customerId: source.customerId,
    customerName: source.customerName,
    deptId: source.deptId ?? defaults.deptId,
    deptName: source.deptName,
    handlerId: source.handlerId,
    handlerName: source.handlerName,
    remark: source.no ? `由其他应收单 ${source.no} 转入` : '由其他应收单转入',
    sourceNo: source.no,
    sourceType: '其他应收',
  } as ErpReceivableOtherApi.OtherReceivable;
}

function applyCreateReadonlyDefaults(
  values: ErpReceivableOtherApi.OtherReceivable,
): ErpReceivableOtherApi.OtherReceivable {
  const userInfo = userStore.userInfo;
  return {
    ...values,
    bizTime: getCurrentLocalDate(),
    creatorName: userInfo?.nickname,
    deptId: userInfo?.deptId,
    sourceType: '调账',
    receivableType: values.receivableType || '普通应收',
  };
}

function normalizeFormValues(
  values: ErpReceivableOtherApi.OtherReceivable,
): ErpReceivableOtherApi.OtherReceivable {
  return {
    ...values,
    bizTime: normalizeOtherReceivableBizDate(values.bizTime),
    settledAmount: financeValue(values.settledAmount || 0),
    receivableAmount:
      values.receivableAmount === null || values.receivableAmount === undefined
        ? undefined
        : financeValue(values.receivableAmount),
    costAmount: financeValue(values.costAmount || 0),
    isPaperNote: Boolean(values.isPaperNote),
  };
}

async function handleCopy() {
  if (!formData.value?.id) {
    return;
  }
  const copyData = applyCreateReadonlyDefaults(
    buildFinanceCopyDraft(formData.value),
  );
  await applyFormMode('create', copyData);
  await formApi.resetForm();
  await formApi.setValues(copyData, false);
  formData.value = copyData;
}

async function applyFormMode(
  type: string,
  customerData:
    | ErpReceivableOtherApi.OtherReceivable
    | undefined = formData.value,
) {
  formType.value = type;
  formApi.setDisabled(type === 'detail');
  formApi.setState({
    schema: replaceDetailFieldWithLinkSlot(
      buildFormSchema(type, customerData),
      type,
      'customerId',
      'customerDetail',
    ),
  });
  await nextTick();
}

async function buildCurrentPayload() {
  const values =
    (await formApi.getValues()) as ErpReceivableOtherApi.OtherReceivable;
  normalizeOptionalNumberFields(values as any, [
    'settledAmount',
    'receivableAmount',
    'costAmount',
  ]);
  const payload = {
    ...formData.value,
    ...values,
    id: formType.value === 'create' ? undefined : formData.value?.id,
  } as ErpReceivableOtherApi.OtherReceivable;
  delete payload.creatorName;
  return payload;
}

async function saveCurrentDraft(options: { explicit?: boolean } = {}) {
  const isCreatingDraft = formType.value === 'create';
  const isUpdatingDraft = isEditingDraft.value && Boolean(formData.value?.id);
  if (
    (!isCreatingDraft && !isUpdatingDraft) ||
    skipDraftOnClose ||
    draftSaved ||
    detailLoadError.value
  ) {
    return true;
  }
  if (draftSaving) return false;
  try {
    const payload = await buildCurrentPayload();
    if (!payload.customerId) {
      message.warning('请选择客户后再保存草稿');
      return false;
    }
    draftSaving = true;
    modalApi.lock();
    await (isCreatingDraft
      ? createOtherReceivableDraft(payload)
      : updateOtherReceivableDraft(payload));
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
  const requestId = ++openRequestId;
  detailLoading.value = true;
  detailLoadError.value = '';
  modalApi.lock();
  try {
    await loadHiddenFields();
    if (requestId !== openRequestId) return;
    const detail = await getOtherReceivable(id);
    if (requestId !== openRequestId) return;
    const nextFormData = await hydrateFinanceDocumentFormSelectLabels(
      normalizeFormValues(detail),
    );
    await applyFormMode('edit', nextFormData);
    await formApi.resetForm();
    formData.value = nextFormData;
    await formApi.setValues(
      buildFinanceDocumentDetailFormValues(formData.value, formType.value),
      false,
    );
  } catch (error) {
    if (requestId === openRequestId) {
      detailLoadError.value = getErpDetailLoadError(
        error,
        '应收调账表单加载失败，请关闭后重试',
      );
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
  if (!formData.value?.id) return;
  const id = formData.value.id;
  AntModal.confirm({
    title: `确认提交应收调账草稿${formData.value.no ? ` ${formData.value.no}` : ''}吗？`,
    content: '提交后将进入待审核状态，不能再按草稿方式修改。',
    async onOk() {
      modalApi.lock();
      try {
        await submitOtherReceivable(id);
        skipDraftOnClose = true;
        emit('success');
        await modalApi.close();
        message.success('应收调账草稿已提交，下一步可进行审核');
      } finally {
        modalApi.unlock();
      }
    },
  });
}

async function handleEscapeClose() {
  await modalApi.close();
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
    modalApi.lock();
    try {
      const values = await buildCurrentPayload();
      if (formType.value === 'create') {
        await createAndSubmitOtherReceivable(values);
      } else if (isEditingDraft.value) {
        await updateAndSubmitOtherReceivable(values);
      } else {
        await updateOtherReceivable(values);
      }
      skipDraftOnClose = true;
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
      modalApi.unlock();
      formData.value = undefined;
      await formApi.resetValidate();
      return;
    }
    const requestId = ++openRequestId;
    skipDraftOnClose = false;
    draftSaving = false;
    draftSaved = false;
    const data = modalApi.getData<OtherReceivableModalData>();
    modalApi.setState({ fullscreen: true });
    formType.value = data?.type === 'copy' ? 'create' : data?.type || 'create';
    detailLoading.value = Boolean(data?.id);
    detailLoadError.value = '';
    if (data?.id) modalApi.lock();
    try {
      await loadHiddenFields();
      if (requestId !== openRequestId) return;
      if (!data?.id) {
        if (requestId !== openRequestId) return;
        formData.value = data?.sourceReceivableMisc
          ? buildSourceReceivableMiscDefaults(data.sourceReceivableMisc)
          : getDefaultValues();
        await applyFormMode(formType.value, formData.value);
        await formApi.resetForm();
        await formApi.setValues(formData.value, false);
        return;
      }
      if (requestId !== openRequestId) return;
      const detail = await getOtherReceivable(data.id);
      if (requestId !== openRequestId) return;
      formData.value = await hydrateFinanceDocumentFormSelectLabels(
        normalizeFormValues(
          data?.type === 'copy'
            ? applyCreateReadonlyDefaults(buildFinanceCopyDraft(detail))
            : detail,
        ),
      );
      await applyFormMode(formType.value, formData.value);
      await formApi.resetForm();
      await formApi.setValues(
        buildFinanceDocumentDetailFormValues(formData.value, formType.value),
        false,
      );
    } catch (error) {
      if (requestId === openRequestId) {
        formData.value = undefined;
        detailLoadError.value = getErpDetailLoadError(
          error,
          data?.type === 'detail'
            ? '应收调账详情加载失败，请关闭后重试'
            : '应收调账表单加载失败，请关闭后重试',
        );
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
    @keydown.esc.stop.prevent="handleEscapeClose"
    :show-confirm-button="canConfirmForm"
  >
    <template #title>
      <div class="other-receivable-form__title">
        <div class="other-receivable-form__title-text">
          <span>{{ title }}</span>
          <small v-if="isDetail && formData?.no">{{ formData.no }}</small>
        </div>
        <span
          v-if="isDetail && formData?.status !== undefined"
          class="other-receivable-form__status"
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
      <Button
        v-if="isDetail && formData?.id"
        type="primary"
        ghost
        @click="handleCopy"
      >
        复制
      </Button>
      <Button v-if="canApprove" type="primary" @click="emit('audit', formData)">
        审核
      </Button>
    </template>
    <div
      class="other-receivable-form__view"
      :class="{ 'erp-form-focus-highlight': formType !== 'detail' }"
    >
      <div
        v-if="detailLoading"
        class="other-receivable-form__load-state"
        role="status"
      >
        应收调账详情加载中...
      </div>
      <div
        v-else-if="detailLoadError"
        class="other-receivable-form__load-state is-error"
        role="alert"
      >
        {{ detailLoadError }}
      </div>
      <section
        ref="basicFormRef"
        v-show="!detailLoading && !detailLoadError"
        class="other-receivable-form__section"
      >
        <header class="other-receivable-form__section-header">
          <span class="other-receivable-form__section-title">基本信息</span>
        </header>
        <Form
          class="other-receivable-form__base-form"
          :class="{
            'other-receivable-form__base-form--editable': !isDetail,
          }"
          @keydown.enter.capture="handleBasicFormEnter"
        >
          <template #customerDetail>
            <DetailLinkInput
              :navigable="canOpenCustomerDetail"
              :value="formData?.customerName"
              @open="handleOpenCustomerDetail"
            />
          </template>
        </Form>
      </section>

      <section
        v-if="!detailLoading && !detailLoadError && isDetail && formData"
        class="other-receivable-form__section other-receivable-form__audit"
      >
        <header class="other-receivable-form__section-header">
          <span class="other-receivable-form__section-title">审计信息</span>
        </header>
        <ErpAuditInfo title="" :record="formData" />
      </section>
    </div>
    <template #cancelText>
      {{ isDetail ? '关闭' : '取消' }}
    </template>
  </Modal>
  <RemarkModal @success="handleRemarkSuccess" />
  <CustomerDetailModal />
</template>

<style scoped>
:deep(.flex-auto.overflow-hidden:has(> .relative > .erp-detail-link-field)) {
  overflow: visible;
}

.other-receivable-form__title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.other-receivable-form__title-text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.other-receivable-form__title-text > span {
  line-height: 1.25;
}

.other-receivable-form__title-text small {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.other-receivable-form__status {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  padding: 2px 9px;
  border: 1px solid currentcolor;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}

.other-receivable-form__status::before {
  width: 6px;
  height: 6px;
  background: currentcolor;
  border-radius: 50%;
  content: '';
}

.other-receivable-form__status.is-pending {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 10%);
}

.other-receivable-form__status.is-draft {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.other-receivable-form__status.is-success {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
}

.other-receivable-form__status.is-muted {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
}

.other-receivable-form__view {
  display: flex;
  height: calc(100vh - 112px);
  min-height: 100%;
  flex-direction: column;
  gap: 12px;
  overflow: auto;
  padding: 12px;
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 28%);
  font-size: 12px;
}

.other-receivable-form__load-state {
  display: flex;
  min-height: 88px;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.other-receivable-form__load-state.is-error {
  color: hsl(var(--destructive));
}

.other-receivable-form__section {
  overflow: visible;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.other-receivable-form__section-header {
  display: flex;
  min-height: 40px;
  align-items: center;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.other-receivable-form__section-title {
  position: relative;
  padding-left: 10px;
  font-size: 13px;
  font-weight: 600;
}

.other-receivable-form__section-title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  background: hsl(var(--primary));
  border-radius: 3px;
  content: '';
}

.other-receivable-form__base-form :deep(.other-receivable-basic-grid) {
  gap: 0 12px;
  padding: 12px;
}

.other-receivable-form__base-form :deep(.other-receivable-basic-grid > div) {
  min-width: 0;
}

.other-receivable-form__base-form
  :deep(.other-receivable-basic-grid > div > label) {
  padding-right: 10px;
  margin-right: 0;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  white-space: nowrap;
}

.other-receivable-form__base-form
  :deep(.other-receivable-basic-grid > div > .flex-auto) {
  min-width: 0;
}

.other-receivable-form__base-form :deep(.ant-input),
.other-receivable-form__base-form :deep(.ant-picker),
.other-receivable-form__base-form :deep(.ant-select-selector) {
  min-height: 32px;
  background: hsl(var(--muted) / 48%) !important;
  border-color: hsl(var(--border)) !important;
  border-radius: 6px !important;
  font-size: 12px;
}

.other-receivable-form__base-form :deep(.ant-input),
.other-receivable-form__base-form :deep(.ant-picker-input > input),
.other-receivable-form__base-form :deep(.ant-select-selection-item),
.other-receivable-form__base-form :deep(.ant-select-selection-placeholder) {
  font-size: 12px;
}

.other-receivable-form__base-form :deep(.ant-input),
.other-receivable-form__base-form :deep(.ant-picker),
.other-receivable-form__base-form :deep(.ant-select-single) {
  min-height: 32px;
}

.other-receivable-form__base-form :deep(textarea.ant-input) {
  min-height: 72px !important;
  resize: vertical;
}

.other-receivable-form__base-form--editable :deep(.ant-input:not(:disabled)),
.other-receivable-form__base-form--editable
  :deep(.ant-picker:not(.ant-picker-disabled)),
.other-receivable-form__base-form--editable
  :deep(.ant-select:not(.ant-select-disabled) .ant-select-selector),
.other-receivable-form__base-form--editable
  :deep(.ant-upload-picture-card-wrapper .ant-upload-select) {
  background: hsl(var(--background)) !important;
}

.other-receivable-form__base-form--editable :deep(.ant-input:disabled),
.other-receivable-form__base-form--editable :deep(.ant-picker-disabled),
.other-receivable-form__base-form--editable
  :deep(.ant-select-disabled .ant-select-selector),
.other-receivable-form__base-form--editable
  :deep(.ant-upload-wrapper .ant-upload-disabled) {
  color: hsl(var(--muted-foreground)) !important;
  background: hsl(var(--muted-foreground) / 14%) !important;
  border-color: hsl(var(--muted-foreground) / 28%) !important;
}

.other-receivable-form__base-form
  :deep(.ant-upload-picture-card-wrapper .ant-upload-list-item-container),
.other-receivable-form__base-form
  :deep(.ant-upload-picture-card-wrapper .ant-upload-select) {
  width: 100% !important;
  height: 32px !important;
  margin: 0 !important;
  border-radius: 6px;
}

.other-receivable-form__audit :deep(.erp-audit-info) {
  padding: 12px;
}

.other-receivable-form__audit :deep(.erp-audit-info .text-sm) {
  font-size: 12px;
}

.other-receivable-form__audit :deep(.erp-audit-info > div:first-child) {
  display: none;
}

:global(.other-receivable-form-select-dropdown .ant-select-item),
:global(.other-receivable-form-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

@media (max-width: 900px) {
  .other-receivable-form__base-form :deep(.other-receivable-basic-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .other-receivable-form__base-form
    :deep(.other-receivable-basic-grid .col-span-4) {
    grid-column: span 2 / span 2;
  }
}

@media (max-width: 640px) {
  .other-receivable-form__view {
    padding: 8px;
  }

  .other-receivable-form__base-form :deep(.other-receivable-basic-grid) {
    grid-template-columns: minmax(0, 1fr);
    padding: 8px;
  }

  .other-receivable-form__base-form
    :deep(.other-receivable-basic-grid .col-span-2),
  .other-receivable-form__base-form
    :deep(.other-receivable-basic-grid .col-span-4) {
    grid-column: span 1 / span 1;
  }
}
</style>
