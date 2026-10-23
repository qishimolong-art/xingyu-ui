<script lang="ts" setup>
import {
  financeValue,
  financeDivide,
  financeSubtract,
  financeCompare,
  financeSign,
  financeAbs,
} from '#/views/erp/finance/utils/finance-decimal';

import { useFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { ErpFinanceReceiptApi } from '#/api/erp/finance/receipt';
import type { ErpReceivableMiscApi } from '#/api/erp/finance/receivable/misc';

import {
  computed,
  defineAsyncComponent,
  h,
  nextTick,
  reactive,
  ref,
  watch,
} from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { DICT_TYPE, ErpBizType } from '@vben/constants';
import { getDictLabel } from '@vben/hooks';
import { $t } from '@vben/locales';

import { Button, Input, message, Modal } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getAutoWriteOffConfig } from '#/api/erp/config/auto-write-off';
import { getAccountSimpleList } from '#/api/erp/finance/account';
import {
  createAndSubmitFinanceReceipt,
  createFinanceReceiptDraft,
  FINANCE_RECEIPT_STATUS,
  getFinanceReceipt,
  getFinanceReceiptItemPage,
  reverseFinanceReceiptWriteOff,
  submitFinanceReceipt,
  updateAndSubmitFinanceReceipt,
  updateFinanceReceipt,
  updateFinanceReceiptDraft,
} from '#/api/erp/finance/receipt';
import { getReceivableMisc } from '#/api/erp/finance/receivable/misc';
import { getSimpleUserList } from '#/api/system/user';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { replaceDetailFieldWithLinkSlot } from '#/views/erp/components/detail-link-schema';
import DetailLinkInput from '#/views/erp/components/DetailLinkInput.vue';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import FinanceDocumentRemarkForm from '#/views/erp/finance/components/FinanceDocumentRemarkForm.vue';
import { buildFinanceCopyDraft } from '#/views/erp/finance/utils/copy-draft';
import {
  collectFinanceDeptIds,
  flattenFinanceDeptTree,
  getFinanceReceiptCustomerDeptTree,
} from '#/views/erp/finance/utils/dept';
import {
  buildFinanceDocumentDetailFormValues,
  buildFinanceDocumentFormSchema,
  hydrateFinanceDocumentFormSelectLabels,
} from '#/views/erp/finance/utils/document-form-ui';
import { hasValidFinanceReceiptDraftItems } from '#/views/erp/finance/utils/draft-items';
import {
  handleFinanceEditableFormEnter,
  queueFocusFirstFinanceEditableFormControl,
} from '#/views/erp/finance/utils/form-enter-focus';
import { getTransferAmountError } from '#/views/erp/finance/utils/misc-transfer-amount';
import {
  buildIncrementalRemoteItems,
  isSameRemoteItem,
} from '#/views/erp/finance/utils/remote-item-incremental';
import {
  normalizeOptionalNumberFields,
  toOptionalNumberValue,
} from '#/views/erp/finance/utils/text-number';
import SaleOutForm from '#/views/erp/sale/out/modules/form.vue';

import '#/views/erp/styles/form-focus.css';
import SalePriceAdjustForm from '#/views/erp/sale/priceadjust/modules/form.vue';
import SaleReturnForm from '#/views/erp/sale/return/modules/form.vue';
import { mergeCustomerOption } from '#/views/erp/sale/utils/customer-select';
import { getErpDetailLoadError } from '#/views/erp/utils/detail-load-error';

import {
  calculateSettlementDocumentAmounts,
  createProgrammaticFinanceAmountGuard,
  normalizeFinanceAmount,
  subtractFinanceAmounts,
} from '../../money';
import { useReportViewOnly } from '#/views/erp/report/components/report-view-only';

import { useFormSchema } from '../data';
import {
  formatFinanceReceiptAmount,
  normalizeFinanceReceiptFormDates,
  toFinanceReceiptDisplayDate,
} from '../ui';
import ItemForm from './item-form.vue';
import SaleSelect from './sale-select.vue';
const { candidateSchema } = useFinanceCandidateFocus();

const emit = defineEmits(['success', 'audit', 'writeoff']);
const reportViewOnly = useReportViewOnly();

const formType = ref('create');
const detailLoading = ref(false);
const itemLoading = ref(false);
const detailLoadError = ref('');
const basicFormRef = ref<HTMLElement | null>(null);
const itemPagination = reactive({ pageNo: 1, pageSize: 10, total: 0 });
const itemSort = ref<{ field?: string; order?: 'asc' | 'desc' }>({});
const itemFormRef = ref<InstanceType<typeof ItemForm>>();
const saleSelectRef = ref<InstanceType<typeof SaleSelect>>();
const suppressCustomerClearConfirm = ref(false);
const isPopulatingForm = ref(false);
const customerClearConfirm = ref<any>();
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  'erp_finance_receipt',
);
const accountOptions = ref<any[]>([]);
const customerOptions = ref<any[]>([]);
const deptOptions = ref<any[]>([]);
const userOptions = ref<any[]>([]);
const effectiveAutoWriteOffDisabledDeptIds = ref<number[]>([]);
let openRequestId = 0;
let skipDraftOnClose = false;
let draftSaved = false;
let draftSaving = false;
let customerDeptLoadSequence = 0;
const totalPriceManuallyEdited = ref(false);
const totalPriceProgrammaticGuard = createProgrammaticFinanceAmountGuard();
const originalItemMap = new Map<
  number,
  ErpFinanceReceiptApi.FinanceReceiptItem
>();

type ReceiptModalData = {
  id?: number;
  sourceReceivableMisc?: ErpReceivableMiscApi.ReceivableMisc;
  type?: string;
};

const [SaleOutModal, saleOutModalApi] = useVbenModal({
  connectedComponent: SaleOutForm,
  destroyOnClose: true,
});
const [SaleReturnModal, saleReturnModalApi] = useVbenModal({
  connectedComponent: SaleReturnForm,
  destroyOnClose: true,
});
const [SalePriceAdjustModal, salePriceAdjustModalApi] = useVbenModal({
  connectedComponent: SalePriceAdjustForm,
  destroyOnClose: true,
});
const CustomerDetail = defineAsyncComponent(
  () => import('#/views/erp/sale/customer/modules/detail.vue'),
);
const CustomerReceivableDetail = defineAsyncComponent(
  () =>
    import('#/views/erp/finance/receivable/account/modules/detail-drawer.vue'),
);
const [CustomerDetailModal, customerDetailModalApi] = useVbenModal({
  connectedComponent: CustomerDetail,
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

function handleOpenCustomerDetail() {
  if (!formData.value.customerId) return;
  customerDetailModalApi.setData({ id: formData.value.customerId }).open();
}

function handleBizDetail(item: ErpFinanceReceiptApi.FinanceReceiptItem) {
  if (!item.bizId) return;
  const modalMap: Record<number, any> = {
    [ErpBizType.SALE_OUT]: saleOutModalApi,
    [ErpBizType.SALE_RETURN]: saleReturnModalApi,
    [ErpBizType.SALE_PRICE_ADJUST]: salePriceAdjustModalApi,
  };
  modalMap[item.bizType]?.setData({ type: 'detail', id: item.bizId }).open();
}

function createDefaultFormData(): ErpFinanceReceiptApi.FinanceReceipt {
  return {
    id: undefined,
    no: '',
    customerId: undefined as any,
    receiptTime: undefined as any,
    totalPrice: undefined as any,
    discountPrice: undefined as any,
    receiptPrice: 0,
    paymentVoucherNo: '',
    remark: '',
    sourceReceivableMiscId: undefined,
    sourceReceivableMiscNo: undefined,
    status: FINANCE_RECEIPT_STATUS.PROCESS,
    items: [],
  };
}

const transferLimit = ref<null | number | string>(null);
const transferLimitError = ref('');

async function refreshTransferLimit() {
  const sourceId = formData.value.sourceReceivableMiscId;
  if (!sourceId) return;
  const requestId = openRequestId;
  const documentId = formData.value.id;
  try {
    let amount: number | string | null | undefined;
    if (documentId) {
      const document = await getFinanceReceipt(documentId, {
        includeItems: false,
      });
      amount = document.sourceTransferAvailableAmount;
    } else {
      const source = await getReceivableMisc(sourceId);
      amount = source.transferAvailableAmount;
    }
    if (!isLatestOpen(requestId) || formData.value.id !== documentId) return;
    transferLimit.value =
      amount === null || amount === undefined ? null : financeValue(amount);
    transferLimitError.value =
      amount === null || amount === undefined
        ? '无法获取可转额度，请检查金额权限后重试'
        : '';
  } catch {
    if (!isLatestOpen(requestId)) return;
    transferLimit.value = null;
    transferLimitError.value = '可转额度加载失败，请重试';
  }
}

async function validateTransferAmount(value: unknown) {
  if (!formData.value.sourceReceivableMiscId) return;
  const requestId = openRequestId;
  await refreshTransferLimit();
  if (!isLatestOpen(requestId)) throw new Error('页面已切换，请重新操作');
  const error =
    transferLimitError.value ||
    getTransferAmountError(value, transferLimit.value);
  formApi.form.setFieldError('receiptPrice', error || undefined);
  if (error) throw new Error(error);
}

function buildSourceReceivableMiscDefaults(
  source: ErpReceivableMiscApi.ReceivableMisc,
  defaults: ErpFinanceReceiptApi.FinanceReceipt,
): ErpFinanceReceiptApi.FinanceReceipt {
  const amount = normalizeFinanceAmount(source.transferAvailableAmount);
  const remark = source.no
    ? `由其他应收单 ${source.no} 转入`
    : '由其他应收单转入';
  return {
    ...defaults,
    accountId: source.accountId,
    accountName: source.accountName,
    customerId: source.customerId as any,
    customerName: source.customerName,
    deptId: source.deptId,
    deptName: source.deptName,
    financeUserId: source.handlerId,
    financeUserName: source.handlerName,
    items: [],
    remark,
    sourceReceivableMiscId: source.id,
    sourceTransferAvailableAmount: source.transferAvailableAmount,
    sourceReceivableMiscNo: source.no,
    totalPrice: amount as any,
    discountPrice: 0 as any,
    receiptPrice: amount,
  };
}

function isLatestOpen(requestId: number) {
  return requestId === openRequestId;
}

const formData = ref<ErpFinanceReceiptApi.FinanceReceipt>(
  createDefaultFormData(),
);
const { hasAccessByCodes } = useAccess();
const autoWriteOffPreviewDisabled = computed(() => {
  const deptId = formData.value.deptId;
  return (
    !deptId ||
    effectiveAutoWriteOffDisabledDeptIds.value.includes(Number(deptId))
  );
});
const canEditRemark = computed(
  () =>
    formType.value === 'detail' &&
    !detailLoading.value &&
    !detailLoadError.value &&
    Boolean(formData.value.id) &&
    hasAccessByCodes(['erp:finance-receipt:update']),
);
const isEditingDraft = computed(
  () =>
    formType.value === 'edit' &&
    formData.value.status === FINANCE_RECEIPT_STATUS.DRAFT,
);
const canConfirmForm = computed(() => {
  if (formType.value === 'detail') return false;
  if (formType.value === 'create' || isEditingDraft.value) {
    return hasAccessByCodes(['erp:finance-receipt:update-status']);
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
    formType.value === 'detail' &&
    !detailLoading.value &&
    !detailLoadError.value &&
    Boolean(formData.value.id) &&
    formData.value.status === FINANCE_RECEIPT_STATUS.DRAFT &&
    hasAccessByCodes(['erp:finance-receipt:update-status']),
);
const canEditFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !detailLoading.value &&
    !detailLoadError.value &&
    Boolean(formData.value.id) &&
    formData.value.status !== FINANCE_RECEIPT_STATUS.APPROVE &&
    hasAccessByCodes(['erp:finance-receipt:update']),
);
const canApprove = computed(
  () =>
    formType.value === 'detail' &&
    !detailLoading.value &&
    !detailLoadError.value &&
    Boolean(formData.value.id) &&
    formData.value.status === FINANCE_RECEIPT_STATUS.PROCESS &&
    hasAccessByCodes(['erp:finance-receipt:update-status']),
);
const [RemarkModal, remarkModalApi] = useVbenModal({
  connectedComponent: FinanceDocumentRemarkForm,
  destroyOnClose: true,
});

function handleEditRemark() {
  remarkModalApi
    .setData({
      documentName: '收款单',
      documentType: 'finance-receipt',
      id: formData.value.id,
      no: formData.value.no,
      remark: formData.value.remark,
    })
    .open();
}

async function handleRemarkSuccess(remark: string) {
  formData.value.remark = remark;
  await formApi.setValues({ remark }, false);
  emit('success');
}

function formatSummaryAmount(value?: number, prefix = '\u00A5') {
  const amount = formatFinanceReceiptAmount(value);
  return amount ? `${prefix}${amount}` : '';
}

function findOptionName(list: any[], id: number | undefined, field = 'name') {
  return list.find((item) => item.id === id)?.[field];
}

type FinanceReceiptDeptFieldRef = {
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
    .getFieldComponentRef<FinanceReceiptDeptFieldRef>('deptId')
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
    deptOptions.value = [];
    if (options.clearInvalidDept && options.selectedDeptId !== undefined) {
      await formApi.setValues({ deptId: undefined }, false);
      formData.value.deptId = undefined;
      formData.value.deptName = undefined;
    }
    return new Set<number>();
  }

  const tree = await getFinanceReceiptCustomerDeptTree({
    customerId: normalizedCustomerId,
  });
  if (sequence !== customerDeptLoadSequence) {
    return new Set<number>();
  }
  const availableDeptIds = collectFinanceDeptIds(tree);
  deptOptions.value = flattenFinanceDeptTree(tree);
  const selectedDeptId = normalizeOptionalId(options.selectedDeptId);
  if (
    options.clearInvalidDept &&
    selectedDeptId !== undefined &&
    !availableDeptIds.has(selectedDeptId)
  ) {
    await formApi.setValues({ deptId: undefined }, false);
    formData.value.deptId = undefined;
    formData.value.deptName = undefined;
    if (options.warnOnClear) {
      message.warning('当前部门不在该客户可用部门范围内，已清空');
    }
  }
  return availableDeptIds;
}

const receiptContext = computed<
  Partial<ErpFinanceReceiptApi.FinanceReceiptItem>
>(() => {
  const account = accountOptions.value.find(
    (item) => item.id === formData.value.accountId,
  );
  return {
    customerName:
      formData.value.customerName ||
      findOptionName(customerOptions.value, formData.value.customerId),
    deptName:
      formData.value.deptName ||
      findOptionName(deptOptions.value, formData.value.deptId),
    receiptMethod: account?.accountType
      ? getDictLabel(DICT_TYPE.ERP_ACCOUNT_TYPE, account.accountType)
      : account?.name,
    accountName: formData.value.accountName || account?.name,
    receiptTime: toFinanceReceiptDisplayDate(formData.value.receiptTime),
    financeUserName:
      formData.value.financeUserName ||
      findOptionName(
        userOptions.value,
        formData.value.financeUserId,
        'nickname',
      ),
  };
});

const displayItems = computed(() =>
  (formData.value.items || []).map((item) => ({
    ...item,
    ...receiptContext.value,
  })),
);

const canOpenCustomerDetail = computed(() =>
  Boolean(formData.value?.customerId && formData.value?.customerName),
);
const canShowCustomerReceivableAction = computed(() =>
  Boolean(
    formType.value !== 'detail' &&
    hasAccessByCodes(['erp:receivable-account:query']),
  ),
);
const canOpenCustomerReceivableDetail = computed(() =>
  Boolean(canShowCustomerReceivableAction.value && formData.value?.customerId),
);
const customerReceivableDetailOpen = ref(false);
const customerReceivableDetailTitle = computed(() =>
  formData.value?.customerName
    ? `应收明细 - ${formData.value.customerName}`
    : '应收明细',
);
const detailItemCount = computed(() =>
  formType.value === 'detail' && formData.value.id
    ? itemPagination.total
    : formData.value.items?.length || 0,
);
const receiptStatus = computed(() => {
  if (formData.value.status === FINANCE_RECEIPT_STATUS.DRAFT) {
    return { className: 'is-draft', label: '草稿' };
  }
  return {
    className:
      formData.value.status === FINANCE_RECEIPT_STATUS.APPROVE
        ? 'is-success'
        : 'is-pending',
    label:
      getDictLabel(DICT_TYPE.ERP_AUDIT_STATUS, formData.value.status) ||
      '未知状态',
  };
});
const getTitle = computed(() => {
  if (formType.value === 'create') {
    return $t('ui.actionTitle.create', ['收款单']);
  }
  if (formType.value === 'copy') {
    return $t('ui.actionTitle.create', ['收款单']);
  }
  if (formType.value === 'edit') {
    return $t('ui.actionTitle.edit', ['收款单']);
  }
  return '收款单详情';
});

function getFormMode(type?: string) {
  return type === 'copy' ? 'create' : type || 'create';
}

async function applyFormMode(type: string) {
  formType.value = type;
  modalApi.setState({ fullscreen: true });
  formApi.setDisabled(type === 'detail');
  refreshFormSchema();
  await nextTick();
}

function refreshFormSchema() {
  formApi.setState({
    schema: replaceDetailFieldWithLinkSlot(
      buildFormSchema(),
      formType.value,
      'customerId',
      'customerDetail',
    ),
  });
}

function buildFormSchema() {
  const schema = useFormSchema(formType.value, hiddenFields.value).map(
    (field) => {
      if (field.fieldName !== 'customerId') {
        return field;
      }
      return {
        ...field,
        componentProps: {
          ...(field.componentProps as Record<string, unknown> | undefined),
          options: customerOptions.value,
          onOptionsChange: handleCustomerOptionsChange,
        },
      };
    },
  );
  return candidateSchema(
    buildFinanceDocumentFormSchema(schema, {
      data: formData.value,
      formType: formType.value,
    }),
  );
}

function handleCustomerOptionsChange(options: any[]) {
  customerOptions.value = options || [];
}

function handleOpenCustomerReceivableDetail() {
  if (!formData.value.customerId) return;
  customerReceivableDetailOpen.value = true;
}

function syncCurrentCustomerOption(customer?: {
  customerCode?: string;
  customerId?: number | string;
  customerName?: string;
}) {
  if (!customer?.customerId || !customer.customerName) {
    return;
  }
  customerOptions.value = mergeCustomerOption(customerOptions.value, {
    code: customer.customerCode,
    id: customer.customerId,
    label: customer.customerName,
    name: customer.customerName,
    value: customer.customerId,
  }) as any[];
}

async function clearReceiptItemsAfterCustomerChange(customerId?: number) {
  suppressCustomerClearConfirm.value = true;
  totalPriceManuallyEdited.value = false;
  formData.value.customerId = customerId || 0;
  formData.value.customerName = findOptionName(
    customerOptions.value,
    customerId,
  );
  formData.value.items = [];
  formData.value.totalPrice = undefined as any;
  formData.value.receiptPrice = 0;
  await itemFormRef.value?.setImportedItems([]);
  refreshFormSchema();
  await nextTick();
  const values =
    (await formApi.getValues()) as ErpFinanceReceiptApi.FinanceReceipt;
  await refreshCustomerDeptOptions(customerId, {
    clearInvalidDept: true,
    selectedDeptId: values.deptId,
    warnOnClear: Boolean(customerId && values.deptId),
  });
  await setCalculatedAmounts({
    customerId,
    totalPrice: undefined,
    receiptPrice: 0,
  });
  suppressCustomerClearConfirm.value = false;
}

function destroyCustomerClearConfirm() {
  const confirmInstance = customerClearConfirm.value;
  if (typeof confirmInstance === 'function') {
    confirmInstance();
  } else {
    confirmInstance?.destroy?.();
  }
  customerClearConfirm.value = undefined;
}

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    labelClass: '!justify-start !text-left',
    labelWidth: 82,
  },
  compact: true,
  wrapperClass: 'receipt-form__basic-grid grid-cols-4',
  layout: 'horizontal',
  schema: buildFormSchema(),
  showDefaultActions: false,
  handleValuesChange: async (values, changedFields) => {
    if (isPopulatingForm.value) {
      return;
    }
    if (
      changedFields.includes('totalPrice') &&
      !totalPriceProgrammaticGuard.isExpected(values.totalPrice)
    ) {
      totalPriceProgrammaticGuard.clear();
      totalPriceManuallyEdited.value = true;
      const totalPrice = normalizeFinanceAmount(
        toOptionalNumberValue(values.totalPrice),
      );
      const discountPrice = normalizeFinanceAmount(
        toOptionalNumberValue(values.discountPrice),
      );
      formData.value.totalPrice = totalPrice;
      formData.value.receiptPrice = subtractFinanceAmounts(
        totalPrice,
        discountPrice,
      );
      await formApi.setValues({ receiptPrice: formData.value.receiptPrice });
    }
    if (changedFields.includes('discountPrice')) {
      const discountPrice = normalizeFinanceAmount(
        toOptionalNumberValue(values.discountPrice),
      );
      formData.value.discountPrice = discountPrice;
      formData.value.receiptPrice = subtractFinanceAmounts(
        formData.value.totalPrice,
        discountPrice,
      );
      await formApi.setValues({ receiptPrice: formData.value.receiptPrice });
    }
    if (changedFields.includes('customerId')) {
      if (suppressCustomerClearConfirm.value) {
        formData.value.customerId = values.customerId || 0;
        return;
      }
      const nextCustomerId = values.customerId || 0;
      const previousCustomerId = formData.value.customerId || 0;
      if (previousCustomerId === nextCustomerId) {
        formData.value.customerId = nextCustomerId;
        return;
      }
      if (
        previousCustomerId > 0 &&
        previousCustomerId !== nextCustomerId &&
        (formData.value.items?.length || 0) > 0
      ) {
        destroyCustomerClearConfirm();
        customerClearConfirm.value = Modal.confirm({
          title: '切换客户',
          content: '切换客户后会清空已引入的收款明细，确认切换吗？',
          okText: '确认切换',
          cancelText: '取消',
          onOk: async () => {
            customerClearConfirm.value = undefined;
            await clearReceiptItemsAfterCustomerChange(nextCustomerId);
          },
          onCancel: async () => {
            customerClearConfirm.value = undefined;
            suppressCustomerClearConfirm.value = true;
            await formApi.setValues({ customerId: previousCustomerId });
            suppressCustomerClearConfirm.value = false;
          },
        });
        return;
      }
      formData.value.customerId = nextCustomerId;
      formData.value.customerName = findOptionName(
        customerOptions.value,
        nextCustomerId,
      );
      await refreshCustomerDeptOptions(nextCustomerId, {
        clearInvalidDept: true,
        selectedDeptId: values.deptId,
        warnOnClear: Boolean(nextCustomerId && values.deptId),
      });
      if ((formData.value.items?.length || 0) > 0) {
        await clearReceiptItemsAfterCustomerChange(nextCustomerId);
      }
    }
    for (const field of [
      'accountId',
      'deptId',
      'financeUserId',
      'receiptTime',
      'paymentVoucherNo',
      'remark',
    ]) {
      if (changedFields.includes(field)) {
        (formData.value as any)[field] = values[field];
      }
    }
    if (changedFields.includes('accountId')) {
      formData.value.accountName = findOptionName(
        accountOptions.value,
        values.accountId,
      );
    }
    if (changedFields.includes('deptId')) {
      formData.value.deptName = findOptionName(
        deptOptions.value,
        values.deptId,
      );
    }
    if (changedFields.includes('financeUserId')) {
      formData.value.financeUserName = findOptionName(
        userOptions.value,
        values.financeUserId,
        'nickname',
      );
    }
  },
});

watch(
  () => [formData.value.receiptPrice, transferLimit.value],
  () => {
    if (
      formType.value === 'detail' ||
      !formData.value.sourceReceivableMiscId ||
      transferLimit.value === null
    )
      return;
    formApi.form.setFieldError(
      'receiptPrice',
      getTransferAmountError(
        formData.value.receiptPrice,
        transferLimit.value,
      ) || undefined,
    );
  },
);

async function setCalculatedAmounts(values: Record<string, any>) {
  if (Object.prototype.hasOwnProperty.call(values, 'totalPrice')) {
    totalPriceProgrammaticGuard.expect(values.totalPrice);
  }
  await formApi.setValues(values);
}

async function handleUpdateItems(
  items: ErpFinanceReceiptApi.FinanceReceiptItem[],
) {
  formData.value.items = items.map((item) => ({
    ...item,
    receiptPrice: normalizeFinanceAmount(item.receiptPrice),
  }));
  refreshFormSchema();
  const { actualPrice, totalPrice } = calculateSettlementDocumentAmounts(
    formData.value.items.map((item) => item.receiptPrice),
    formData.value.discountPrice,
    {
      currentTotalPrice: formData.value.totalPrice,
      totalPriceManuallyEdited: totalPriceManuallyEdited.value,
    },
  );
  formData.value.totalPrice = totalPrice;
  formData.value.receiptPrice = actualPrice;
  await setCalculatedAmounts({
    totalPrice,
    receiptPrice: formData.value.receiptPrice,
  });
}

async function handleUpdateTotalPrice(totalPrice: number | string | null) {
  formData.value.totalPrice = normalizeFinanceAmount(totalPrice);
  await setCalculatedAmounts({ totalPrice: formData.value.totalPrice });
}

async function handleUpdateReceiptPrice(receiptPrice: number | string | null) {
  formData.value.receiptPrice = normalizeFinanceAmount(receiptPrice);
  await setCalculatedAmounts({
    receiptPrice: formData.value.receiptPrice,
  });
}

async function loadFinanceReceiptItemsPage(
  options: { pageNo?: number; pageSize?: number } = {},
) {
  if (!formData.value.id) {
    return;
  }
  const pageNo = options.pageNo ?? itemPagination.pageNo;
  const pageSize = options.pageSize ?? itemPagination.pageSize;
  itemLoading.value = true;
  try {
    const page = await getFinanceReceiptItemPage({
      receiptId: formData.value.id,
      pageNo,
      pageSize,
      mask: formType.value === 'detail',
      orderField: itemSort.value.field,
      orderDirection: itemSort.value.order,
    });
    itemPagination.pageNo = pageNo;
    itemPagination.pageSize = pageSize;
    itemPagination.total = Number(page.total || 0);
    formData.value.items = page.list || [];
    await itemFormRef.value?.setImportedItems(formData.value.items);
  } finally {
    itemLoading.value = false;
  }
}

async function fetchAllFinanceReceiptItems(id = formData.value.id) {
  if (!id) {
    return formData.value.items || [];
  }
  const pageSize = 200;
  const firstPage = await getFinanceReceiptItemPage({
    receiptId: id,
    pageNo: 1,
    pageSize,
    mask: false,
  });
  const items = [...(firstPage.list || [])];
  const total = Number(firstPage.total || 0);
  const pageCount = Math.ceil(financeDivide(total, pageSize));
  for (let pageNo = 2; pageNo <= pageCount; pageNo++) {
    const page = await getFinanceReceiptItemPage({
      receiptId: id,
      pageNo,
      pageSize,
      mask: false,
    });
    items.push(...(page.list || []));
  }
  return items;
}

function handleItemPageChange(page: { pageNo: number; pageSize: number }) {
  void loadFinanceReceiptItemsPage(page);
}

function handleItemSortChange(sort: { field?: string; order?: string }) {
  itemSort.value = {
    field: sort.field,
    order:
      sort.order === 'desc' ? 'desc' : sort.order === 'asc' ? 'asc' : undefined,
  };
  void loadFinanceReceiptItemsPage({ pageNo: 1 });
}

async function reloadCurrentDetail() {
  if (!formData.value.id) return;
  const detail = await getFinanceReceipt(formData.value.id, {
    includeItems: false,
  });
  isPopulatingForm.value = true;
  try {
    formData.value = await hydrateFinanceDocumentFormSelectLabels(
      normalizeFinanceReceiptFormDates({
        ...detail,
        items: formData.value.items || [],
      }),
      {
        accountOptions: accountOptions.value,
        customerOptions: customerOptions.value,
        deptOptions: deptOptions.value,
        userOptions: userOptions.value,
      },
    );
    syncCurrentCustomerOption(formData.value);
    await refreshCustomerDeptOptions(formData.value.customerId, {
      clearInvalidDept: false,
      selectedDeptId: formData.value.deptId,
    });
    await loadFinanceReceiptItemsPage();
    refreshFormSchema();
    await formApi.setValues(
      buildFinanceDocumentDetailFormValues(formData.value, formType.value),
      false,
    );
  } finally {
    isPopulatingForm.value = false;
  }
}

function handleReverseWriteOff(item: ErpFinanceReceiptApi.FinanceReceiptItem) {
  if (!item.id) return;
  let reason = '';
  Modal.confirm({
    title: `撤销核销 ${item.bizNo || item.id}`,
    content: h(Input.TextArea, {
      placeholder: '请填写撤销原因',
      rows: 3,
      onChange: (event: Event) => {
        reason = (event.target as HTMLTextAreaElement).value;
      },
    }),
    okText: '确认撤销',
    okButtonProps: { danger: true },
    async onOk() {
      if (!reason.trim()) {
        message.error('请填写撤销原因');
        throw new Error('撤销原因不能为空');
      }
      await reverseFinanceReceiptWriteOff({ itemId: item.id!, reason });
      message.success('核销已撤销');
      await reloadCurrentDetail();
      emit('success');
    },
  });
}

async function buildCurrentReceiptPayload() {
  const values =
    (await formApi.getValues()) as ErpFinanceReceiptApi.FinanceReceipt;
  normalizeOptionalNumberFields(values as any, [
    'discountPrice',
    'receiptPrice',
    'totalPrice',
  ]);
  values.discountPrice = normalizeFinanceAmount(values.discountPrice);
  values.receiptPrice = normalizeFinanceAmount(values.receiptPrice);
  values.totalPrice = normalizeFinanceAmount(values.totalPrice);
  const submitItems = (formData.value.items || []).map((item) => ({
    id: formType.value === 'create' ? undefined : item.id,
    bizId: item.bizId,
    bizType: item.bizType,
    bizNo: item.bizNo,
    totalPrice: normalizeFinanceAmount(item.totalPrice),
    receiptedPrice: normalizeFinanceAmount(item.receiptedPrice),
    receiptPrice: normalizeFinanceAmount(item.receiptPrice),
    remark: item.remark,
  }));
  return {
    ...values,
    sourceReceivableMiscId: formData.value.sourceReceivableMiscId,
    sourceReceivableMiscNo: formData.value.sourceReceivableMiscNo,
    items:
      formType.value === 'create'
        ? submitItems
        : buildLocalIncrementalItems(submitItems),
  };
}

function rememberOriginalItems(
  items: ErpFinanceReceiptApi.FinanceReceiptItem[] = [],
) {
  originalItemMap.clear();
  items.forEach((item) => {
    if (item.id && item.id > 0) {
      originalItemMap.set(item.id, { ...item });
    }
  });
}

function buildLocalIncrementalItems(
  items: ErpFinanceReceiptApi.FinanceReceiptItem[],
) {
  const edits = new Map<number, ErpFinanceReceiptApi.FinanceReceiptItem>();
  const deletes = new Set<number>();
  const creates = new Map<string, ErpFinanceReceiptApi.FinanceReceiptItem>();
  const currentIds = new Set<number>();
  items.forEach((item) => {
    if (item.id && item.id > 0) {
      currentIds.add(item.id);
      const original = originalItemMap.get(item.id);
      if (!isSameRemoteItem(original, item)) {
        edits.set(item.id, item);
      }
      return;
    }
    creates.set(
      item.clientRowKey ||
        `finance-receipt:source:${item.bizType}:${item.bizId}`,
      item,
    );
  });
  originalItemMap.forEach((_, id) => {
    if (!currentIds.has(id)) {
      deletes.add(id);
    }
  });
  return buildIncrementalRemoteItems(edits, deletes, creates);
}

async function saveCurrentDraft(options: { explicit?: boolean } = {}) {
  const isCreatingDraft = formType.value === 'create';
  const isUpdatingDraft = isEditingDraft.value && Boolean(formData.value.id);
  if (
    (!isCreatingDraft && !isUpdatingDraft) ||
    skipDraftOnClose ||
    draftSaved ||
    detailLoading.value ||
    Boolean(detailLoadError.value)
  ) {
    return true;
  }
  if (draftSaving) return false;
  draftSaving = true;
  modalApi.lock();
  try {
    const payload = await buildCurrentReceiptPayload();
    await validateTransferAmount(payload.receiptPrice);
    if (isCreatingDraft) {
      if (
        !payload.sourceReceivableMiscId &&
        !hasValidFinanceReceiptDraftItems(payload.items ?? [])
      ) {
        if (!options.explicit) {
          draftSaved = true;
        }
        message.warning('未选择明细，不生成草稿');
        return !options.explicit;
      }
      await createFinanceReceiptDraft(payload);
    } else {
      payload.id = formData.value.id;
      await updateFinanceReceiptDraft(payload);
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
  } catch (error) {
    await refreshTransferLimit();
    if (error instanceof Error) message.error(error.message);
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
  const requestId = (openRequestId += 1);
  detailLoading.value = true;
  detailLoadError.value = '';
  modalApi.lock();
  try {
    const detail = await getFinanceReceipt(id, { includeItems: false });
    if (!isLatestOpen(requestId)) {
      return;
    }
    isPopulatingForm.value = true;
    totalPriceManuallyEdited.value = true;
    formData.value = await hydrateFinanceDocumentFormSelectLabels(
      normalizeFinanceReceiptFormDates({
        ...detail,
        items: await fetchAllFinanceReceiptItems(id),
      }),
      {
        accountOptions: accountOptions.value,
        customerOptions: customerOptions.value,
        deptOptions: deptOptions.value,
        userOptions: userOptions.value,
      },
    );
    syncCurrentCustomerOption(formData.value);
    await applyFormMode('edit');
    await formApi.resetForm();
    await refreshCustomerDeptOptions(formData.value.customerId, {
      clearInvalidDept: false,
      selectedDeptId: formData.value.deptId,
    });
    await nextTick();
    if (!isLatestOpen(requestId)) {
      return;
    }
    await formApi.setValues(formData.value, false);
  } catch (error) {
    if (!isLatestOpen(requestId)) {
      return;
    }
    detailLoadError.value = getErpDetailLoadError(
      error,
      '收款单详情加载失败，请关闭后重试',
    );
  } finally {
    isPopulatingForm.value = false;
    if (isLatestOpen(requestId)) {
      detailLoading.value = false;
      modalApi.unlock();
      queueFocusFirstBasicFormControl(requestId);
    }
  }
}

function handleSubmitDraftFromDetail() {
  if (!formData.value.id) return;
  const id = formData.value.id;
  Modal.confirm({
    title: `确认提交草稿 ${formData.value.no || ''} 吗？`,
    content: '提交后将进入待审核状态，不能再按草稿方式修改。',
    async onOk() {
      modalApi.lock();
      try {
        await validateTransferAmount(formData.value.receiptPrice);
        await submitFinanceReceipt(id);
        skipDraftOnClose = true;
        await modalApi.close();
        emit('success');
        message.success('草稿已提交，当前状态为待审核');
      } catch (error) {
        await refreshTransferLimit();
        if (error instanceof Error) message.error(error.message);
      } finally {
        modalApi.unlock();
      }
    },
  });
}

async function handleEscapeClose() {
  await modalApi.close();
}

const [ModalApi, modalApi] = useVbenModal({
  async onBeforeClose() {
    return saveCurrentDraft();
  },
  async onCancel() {
    skipDraftOnClose = true;
    await modalApi.close();
  },
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    try {
      if (formType.value === 'detail') {
        itemFormRef.value?.validate();
      } else {
        if (
          saleSelectRef.value &&
          !saleSelectRef.value.validateSelectedItemsAvailable()
        ) {
          return;
        }
        (formData.value.items || []).forEach((item, index) => {
          const remaining = financeSubtract(
            financeValue(item.totalPrice || 0),
            financeValue(item.receiptedPrice || 0),
          );
          const amount = financeValue(item.receiptPrice || 0);
          if (
            financeCompare(amount, 0) === 0 ||
            financeCompare(financeSign(amount), financeSign(remaining)) !== 0 ||
            financeCompare(financeAbs(amount), financeAbs(remaining)) > 0
          ) {
            throw new Error(
              `第 ${index + 1} 行：核销金额必须在未核销金额范围内`,
            );
          }
        });
      }
    } catch (error: any) {
      message.error(error.message || '明细校验失败');
      return;
    }
    modalApi.lock();
    try {
      const payload = await buildCurrentReceiptPayload();
      await validateTransferAmount(payload.receiptPrice);
      if (formType.value === 'create') {
        await createAndSubmitFinanceReceipt(payload);
      } else if (isEditingDraft.value) {
        payload.id = formData.value.id;
        await updateAndSubmitFinanceReceipt(payload);
      } else {
        await updateFinanceReceipt(payload);
      }
      skipDraftOnClose = true;
      await modalApi.close();
      emit('success');
      message.success($t('ui.actionMessage.operationSuccess'));
    } catch (error) {
      await refreshTransferLimit();
      if (error instanceof Error) message.error(error.message);
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      openRequestId += 1;
      destroyCustomerClearConfirm();
      detailLoading.value = false;
      detailLoadError.value = '';
      isPopulatingForm.value = false;
      totalPriceManuallyEdited.value = false;
      totalPriceProgrammaticGuard.clear();
      customerDeptLoadSequence += 1;
      deptOptions.value = [];
      return;
    }
    const requestId = (openRequestId += 1);
    transferLimit.value = null;
    transferLimitError.value = '';
    skipDraftOnClose = false;
    draftSaved = false;
    draftSaving = false;
    destroyCustomerClearConfirm();
    const data = modalApi.getData<ReceiptModalData>();
    const formMode = getFormMode(data?.type);
    formType.value = formMode;
    detailLoading.value = true;
    detailLoadError.value = '';
    modalApi.lock();
    try {
      const [accounts, users, , autoWriteOffConfig] = await Promise.all([
        getAccountSimpleList(),
        getSimpleUserList(),
        loadHiddenFields(),
        getAutoWriteOffConfig(),
      ]);
      accountOptions.value = accounts;
      deptOptions.value = [];
      userOptions.value = users;
      effectiveAutoWriteOffDisabledDeptIds.value =
        autoWriteOffConfig.effectiveDisabledDeptIds || [];
      if (!isLatestOpen(requestId)) {
        return;
      }
      await applyFormMode(formMode);
      if (!isLatestOpen(requestId)) {
        return;
      }
      isPopulatingForm.value = true;
      totalPriceProgrammaticGuard.clear();
      await formApi.resetForm();
      formData.value = createDefaultFormData();
      originalItemMap.clear();
      itemPagination.pageNo = 1;
      itemPagination.pageSize = 10;
      itemPagination.total = 0;
      itemSort.value = {};
      await itemFormRef.value?.setImportedItems([]);
      await formApi.setValues(formData.value, false);
      isPopulatingForm.value = false;
      if (!isLatestOpen(requestId)) {
        return;
      }
      if (!data?.id) {
        isPopulatingForm.value = true;
        const defaultAccount = accountOptions.value.find(
          (item) => item.defaultStatus,
        );
        const receiptTime = String(Date.now());
        const defaults = {
          ...createDefaultFormData(),
          accountId: defaultAccount?.id,
          accountName: defaultAccount?.name,
          receiptTime,
        };
        const source = data?.sourceReceivableMisc
          ? await getReceivableMisc(data.sourceReceivableMisc.id!)
          : undefined;
        if (!isLatestOpen(requestId)) return;
        totalPriceManuallyEdited.value = Boolean(source);
        formData.value = source
          ? buildSourceReceivableMiscDefaults(source, defaults)
          : defaults;
        transferLimit.value = source?.transferAvailableAmount ?? null;
        syncCurrentCustomerOption(formData.value);
        refreshFormSchema();
        await nextTick();
        if (data?.sourceReceivableMisc) {
          await refreshCustomerDeptOptions(formData.value.customerId, {
            clearInvalidDept: true,
            selectedDeptId: formData.value.deptId,
          });
          await itemFormRef.value?.setImportedItems(formData.value.items || []);
          itemPagination.total = formData.value.items?.length || 0;
        }
        await setCalculatedAmounts({
          accountId: formData.value.accountId,
          customerId: formData.value.customerId,
          deptId: formData.value.deptId,
          financeUserId: formData.value.financeUserId,
          receiptTime: formData.value.receiptTime,
          paymentVoucherNo: formData.value.paymentVoucherNo,
          remark: formData.value.remark,
          totalPrice: formData.value.totalPrice,
          discountPrice: formData.value.discountPrice,
          receiptPrice: formData.value.receiptPrice,
        });
        isPopulatingForm.value = false;
        return;
      }
      totalPriceManuallyEdited.value = true;
      const detail = await getFinanceReceipt(data.id, { includeItems: false });
      transferLimit.value = detail.sourceTransferAvailableAmount ?? null;
      if (!isLatestOpen(requestId)) {
        return;
      }
      isPopulatingForm.value = true;
      if (data.type === 'copy') {
        originalItemMap.clear();
        formData.value = await hydrateFinanceDocumentFormSelectLabels(
          normalizeFinanceReceiptFormDates(
            buildFinanceCopyDraft(
              {
                ...detail,
                items: await fetchAllFinanceReceiptItems(data.id),
              },
              { extraCleanKeys: ['paymentVoucherNo'] },
            ),
          ),
          {
            accountOptions: accountOptions.value,
            customerOptions: customerOptions.value,
            deptOptions: deptOptions.value,
            userOptions: userOptions.value,
          },
        );
      } else if (formMode === 'detail') {
        formData.value = await hydrateFinanceDocumentFormSelectLabels(
          normalizeFinanceReceiptFormDates({
            ...detail,
            items: [],
          }),
          {
            accountOptions: accountOptions.value,
            customerOptions: customerOptions.value,
            deptOptions: deptOptions.value,
            userOptions: userOptions.value,
          },
        );
      } else {
        const allItems = await fetchAllFinanceReceiptItems(data.id);
        rememberOriginalItems(allItems);
        formData.value = await hydrateFinanceDocumentFormSelectLabels(
          normalizeFinanceReceiptFormDates({
            ...detail,
            items: allItems,
          }),
          {
            accountOptions: accountOptions.value,
            customerOptions: customerOptions.value,
            deptOptions: deptOptions.value,
            userOptions: userOptions.value,
          },
        );
      }
      syncCurrentCustomerOption(formData.value);
      refreshFormSchema();
      await nextTick();
      await refreshCustomerDeptOptions(formData.value.customerId, {
        clearInvalidDept: false,
        selectedDeptId: formData.value.deptId,
      });
      if (!isLatestOpen(requestId)) {
        return;
      }
      await formApi.setValues(
        buildFinanceDocumentDetailFormValues(formData.value, formType.value),
        false,
      );
      if (formMode === 'detail' && data.type !== 'copy') {
        await loadFinanceReceiptItemsPage({ pageNo: 1, pageSize: 10 });
      } else {
        itemPagination.pageNo = 1;
        itemPagination.pageSize = 10;
        itemPagination.total = formData.value.items?.length || 0;
        await itemFormRef.value?.setImportedItems(formData.value.items || []);
      }
    } catch (error) {
      if (!isLatestOpen(requestId)) {
        return;
      }
      detailLoadError.value = getErpDetailLoadError(
        error,
        data?.id
          ? '收款单详情加载失败，请关闭后重试'
          : '收款单初始化失败，请关闭后重试',
      );
    } finally {
      isPopulatingForm.value = false;
      if (isLatestOpen(requestId)) {
        detailLoading.value = false;
        queueFocusFirstBasicFormControl(requestId);
      }
      if (isLatestOpen(requestId)) {
        modalApi.unlock();
      }
    }
  },
});
</script>

<template>
  <ModalApi
    class="!w-full"
    bordered
    content-class="p-0"
    :confirm-text="confirmText"
    @keydown.esc.stop.prevent="handleEscapeClose"
    :show-confirm-button="canConfirmForm && !detailLoading && !detailLoadError"
  >
    <template #title>
      <div class="receipt-form__title">
        <div class="receipt-form__title-text">
          <span>{{ getTitle }}</span>
          <small v-if="formType !== 'create' && formData?.no">
            {{ formData.no }}
          </small>
        </div>
        <span
          v-if="
            formType === 'detail' &&
            !detailLoading &&
            !detailLoadError &&
            formData?.id
          "
          class="receipt-form__status"
          :class="receiptStatus.className"
        >
          {{ receiptStatus.label }}
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
        v-if="
          formType === 'detail' &&
          formData?.id &&
          formData?.status === 20 &&
          Number(formData?.unallocatedPrice || 0) !== 0
        "
        type="primary"
        @click="emit('writeoff', formData)"
      >
        继续核销
      </Button>
      <Button v-if="canApprove" type="primary" @click="emit('audit', formData)">
        审核
      </Button>
    </template>
    <div
      class="receipt-form"
      :class="{ 'erp-form-focus-highlight': formType !== 'detail' }"
    >
      <div v-if="detailLoading" class="receipt-form__load-state">
        正在加载完整明细，请稍候…
      </div>
      <div
        v-else-if="detailLoadError"
        class="receipt-form__load-state is-error"
      >
        {{ detailLoadError }}
      </div>
      <div
        v-show="!detailLoading && !detailLoadError"
        class="receipt-form__content"
      >
        <section ref="basicFormRef" class="receipt-form__section">
          <header class="receipt-form__section-header">
            <span class="receipt-form__section-title">基础信息</span>
          </header>
          <div
            v-if="formData.sourceReceivableMiscId && formType !== 'detail'"
            class="mb-2 text-sm"
            role="status"
          >
            {{
              transferLimitError ||
              (transferLimit === null
                ? '可转额度暂不可用'
                : `剩余可转金额：${formatSummaryAmount(transferLimit)}`)
            }}
            <div
              v-if="
                transferLimit !== null &&
                getTransferAmountError(formData.receiptPrice, transferLimit)
              "
              class="text-destructive"
              role="alert"
            >
              {{ getTransferAmountError(formData.receiptPrice, transferLimit) }}
            </div>
          </div>
          <Form
            class="receipt-form__base-form"
            :class="{
              'receipt-form__base-form--editable': formType !== 'detail',
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
          v-if="canShowCustomerReceivableAction"
          class="receipt-form__section receipt-form__action-section"
        >
          <header class="receipt-form__section-header">
            <span class="receipt-form__section-title">功能操作</span>
          </header>
          <div class="receipt-form__action-body">
            <Button
              class="receipt-form__receivable-link"
              :disabled="!canOpenCustomerReceivableDetail"
              type="primary"
              @click="handleOpenCustomerReceivableDetail"
            >
              查看应收明细
            </Button>
            <span class="receipt-form__action-tip">
              收款前可先核对当前客户应收、收款和未核销流水
            </span>
          </div>
        </section>

        <section class="receipt-form__section">
          <header class="receipt-form__section-header">
            <span class="receipt-form__section-title">收款明细</span>
            <span class="receipt-form__item-count">
              {{ detailItemCount }} 笔单据
            </span>
          </header>
          <div class="receipt-form__items">
            <ItemForm
              v-if="formType === 'detail'"
              ref="itemFormRef"
              :items="displayItems"
              disabled
              :discount-price="Number(formData.discountPrice || 0)"
              :hidden-fields="hiddenFields"
              :loading="itemLoading"
              pagination-mode="remote"
              :pagination="itemPagination"
              :allow-reverse="!reportViewOnly && formData?.status === 20"
              @update:items="handleUpdateItems"
              @update:total-price="handleUpdateTotalPrice"
              @update:receipt-price="handleUpdateReceiptPrice"
              @page-change="handleItemPageChange"
              @sort-change="handleItemSortChange"
              @detail="handleBizDetail"
              @reverse="handleReverseWriteOff"
              @request-submit="handleLastInputEnterConfirm"
            />
            <SaleSelect
              ref="saleSelectRef"
              v-else
              :customer-id="formData.customerId"
              :dept-id="formData.deptId"
              :current-items="formData.items || []"
              :document-total-price="formData.totalPrice"
              :receipt-context="receiptContext"
              :auto-write-off-preview-disabled="autoWriteOffPreviewDisabled"
              @change="handleUpdateItems"
              @detail="handleBizDetail"
              @request-submit="handleLastInputEnterConfirm"
            />
          </div>
          <div class="receipt-form__document-summary">
            <strong>单据合计</strong>
            <span>
              合计收款
              <b>{{ formatSummaryAmount(formData.totalPrice) }}</b>
            </span>
            <span>
              优惠金额
              <b>{{
                formatSummaryAmount(formData.discountPrice, '-\u00a5')
              }}</b>
            </span>
            <span
              v-if="formType === 'detail'"
              class="receipt-form__document-summary-secondary"
            >
              已核销
              <b>{{ formatSummaryAmount(formData.allocatedPrice) }}</b>
            </span>
            <span
              v-if="formType === 'detail'"
              class="receipt-form__document-summary-secondary"
            >
              未核销
              <b>{{ formatSummaryAmount(formData.unallocatedPrice) }}</b>
            </span>
            <span class="receipt-form__document-summary-actual">
              实际收款
              <b>{{ formatSummaryAmount(formData.receiptPrice) }}</b>
            </span>
          </div>
        </section>

        <section
          v-if="formType === 'detail' && formData?.id"
          class="receipt-form__section receipt-form__audit"
        >
          <header class="receipt-form__section-header">
            <span class="receipt-form__section-title">审计信息</span>
          </header>
          <ErpAuditInfo title="" :record="formData" />
        </section>
      </div>
    </div>
    <template #cancelText>
      {{ formType === 'detail' ? '关闭' : '取消' }}
    </template>
  </ModalApi>
  <Modal
    v-model:open="customerReceivableDetailOpen"
    :title="customerReceivableDetailTitle"
    class="receipt-form__receivable-detail-modal !w-[92vw] max-w-[1500px]"
    :footer="null"
    destroy-on-close
  >
    <CustomerReceivableDetail
      v-if="customerReceivableDetailOpen"
      display-mode="modal"
      :customer-id="Number(formData.customerId)"
      :customer-name="formData.customerName || ''"
    />
  </Modal>
  <RemarkModal @success="handleRemarkSuccess" />
  <SaleOutModal />
  <SaleReturnModal />
  <SalePriceAdjustModal />
  <CustomerDetailModal />
</template>

<style scoped>
:deep(.flex-auto.overflow-hidden:has(> .relative > .erp-detail-link-field)) {
  overflow: visible;
}

.receipt-form__title {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.receipt-form__title-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.receipt-form__title-text > span {
  line-height: 1.25;
}

.receipt-form__title-text small {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.receipt-form__status {
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

.receipt-form__status::before {
  width: 6px;
  height: 6px;
  content: '';
  background: currentcolor;
  border-radius: 50%;
}

.receipt-form__status.is-pending {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 10%);
}

.receipt-form__status.is-draft {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.receipt-form__status.is-success {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
}

.receipt-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  font-size: 12px;
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 28%);
}

.receipt-form__content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.receipt-form__load-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.receipt-form__load-state.is-error {
  color: hsl(var(--destructive));
}

.receipt-form__section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.receipt-form__section--detail {
  padding-bottom: 14px;
}

.receipt-form__section-heading {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 11px;
  margin-bottom: 12px;
  border-bottom: 1px solid hsl(var(--border));
}

.receipt-form__section-heading > div {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.receipt-form__section-index {
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--primary));
  letter-spacing: 0.08em;
}

.receipt-form__section-heading h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  line-height: 20px;
}

.receipt-form__section-heading p {
  margin: 1px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: hsl(var(--muted-foreground));
}

.receipt-form__section-note {
  flex: none;
  font-size: 11px;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
}

.receipt-form__section-header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.receipt-form__section-title {
  position: relative;
  padding-left: 10px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.receipt-form__section-title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  content: '';
  background: hsl(var(--primary));
  border-radius: 3px;
}

.receipt-form__action-section {
  border-color: hsl(var(--primary) / 24%);
}

.receipt-form__action-body {
  display: flex;
  gap: 12px;
  align-items: center;
  min-height: 52px;
  padding: 10px 14px;
}

.receipt-form__receivable-link {
  height: 32px;
  padding: 0 14px;
  font-size: 12px;
  border-radius: 6px;
}

.receipt-form__action-tip {
  color: hsl(var(--muted-foreground));
}

:global(.receipt-form__receivable-detail-modal .ant-modal-body) {
  padding: 14px 16px 16px;
}

.receipt-form__item-count {
  padding: 2px 8px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
}

.receipt-form__base-form,
.receipt-form__detail-table {
  min-width: 0;
}

:deep(.receipt-form__base-form .ant-form-item) {
  margin-bottom: 8px;
}

:deep(.receipt-form__base-form .ant-form-item-label > label) {
  height: 18px;
  font-size: 12px;
  font-weight: 400;
  color: hsl(var(--muted-foreground));
}

:deep(.receipt-form__base-form .ant-input),
:deep(.receipt-form__base-form .ant-picker-input > input),
:deep(.receipt-form__base-form .ant-select-selection-item),
:deep(.receipt-form__base-form .ant-select-selection-placeholder) {
  font-size: 12px;
}

:deep(.receipt-form__amount-field .ant-input) {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

:deep(.receipt-form__amount-field--actual .ant-input) {
  color: hsl(var(--primary));
}

.receipt-form__base-form :deep(.receipt-form__basic-grid) {
  gap: 0 12px;
  padding: 12px 12px 4px;
}

.receipt-form__base-form :deep(.receipt-form__basic-grid > div) {
  min-width: 0;
}

.receipt-form__base-form :deep(.receipt-form__full-row) {
  grid-column: 1 / -1;
}

.receipt-form__base-form :deep(.receipt-form__basic-grid > div > label) {
  padding-right: 10px;
  margin-right: 0;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.receipt-form__base-form :deep(.receipt-form__basic-grid > div > .flex-auto) {
  min-width: 0;
}

.receipt-form__base-form :deep(.ant-input),
.receipt-form__base-form :deep(.ant-input-affix-wrapper),
.receipt-form__base-form :deep(.ant-picker),
.receipt-form__base-form :deep(.ant-select-selector) {
  min-height: 32px;
  font-size: 12px;
  background: hsl(var(--muted) / 48%) !important;
  border-color: hsl(var(--border)) !important;
  border-radius: 6px !important;
}

.receipt-form__base-form :deep(.ant-input),
.receipt-form__base-form :deep(.ant-picker-input > input),
.receipt-form__base-form :deep(.ant-select-selection-item),
.receipt-form__base-form :deep(.ant-select-selection-placeholder),
.receipt-form__base-form :deep(textarea) {
  font-size: 12px;
}

.receipt-form__base-form :deep(.ant-input),
.receipt-form__base-form :deep(.ant-picker),
.receipt-form__base-form :deep(.ant-select-single) {
  height: 32px;
}

.receipt-form__base-form--editable :deep(.ant-input:not(:disabled)),
.receipt-form__base-form--editable
  :deep(.ant-input-affix-wrapper:not(.ant-input-affix-wrapper-disabled)),
.receipt-form__base-form--editable :deep(.ant-picker:not(.ant-picker-disabled)),
.receipt-form__base-form--editable
  :deep(.ant-select:not(.ant-select-disabled) .ant-select-selector),
.receipt-form__base-form--editable
  :deep(.ant-upload-picture-card-wrapper .ant-upload-select) {
  background: hsl(var(--background)) !important;
}

.receipt-form__base-form--editable :deep(.ant-input:disabled),
.receipt-form__base-form--editable :deep(.ant-input-affix-wrapper-disabled),
.receipt-form__base-form--editable :deep(.ant-picker-disabled),
.receipt-form__base-form--editable
  :deep(.ant-select-disabled .ant-select-selector),
.receipt-form__base-form--editable
  :deep(.ant-upload-wrapper .ant-upload-disabled) {
  color: hsl(var(--muted-foreground)) !important;
  background: hsl(var(--muted-foreground) / 14%) !important;
  border-color: hsl(var(--muted-foreground) / 28%) !important;
}

.receipt-form__items {
  padding: 10px 10px 0;
}

.receipt-form__items :deep(.vxe-table) {
  font-size: 11px;
}

.receipt-form__items :deep(.vxe-header--column .vxe-cell),
.receipt-form__items :deep(.vxe-body--column .vxe-cell) {
  padding-right: 4px;
  padding-left: 4px;
}

.receipt-form__document-summary {
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

.receipt-form__document-summary strong {
  margin-right: auto;
  color: hsl(var(--foreground));
}

.receipt-form__document-summary b {
  margin-left: 5px;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}

.receipt-form__document-summary-actual b {
  color: hsl(var(--success));
}

.receipt-form__audit :deep(.erp-audit-info) {
  padding: 12px;
}

.receipt-form__audit :deep(.erp-audit-info .text-sm) {
  font-size: 12px;
}

.receipt-form__audit :deep(.erp-audit-info > div:first-child) {
  display: none;
}

:global(.finance-receipt-form-select-dropdown .ant-select-item),
:global(.finance-receipt-form-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

@media (max-width: 1024px) {
  .receipt-form__base-form :deep(.receipt-form__basic-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .receipt-form {
    padding: 8px;
  }

  .receipt-form__base-form :deep(.receipt-form__basic-grid) {
    grid-template-columns: minmax(0, 1fr);
  }

  .receipt-form__section-header,
  .receipt-form__document-summary {
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    padding-top: 8px;
    padding-bottom: 8px;
  }

  .receipt-form__document-summary strong {
    margin-right: 0;
  }
}
</style>
