<script lang="ts" setup>
import {
  financeValue,
  financeDivide,
} from '#/views/erp/finance/utils/finance-decimal';

import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import { useFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { ErpPayableMiscApi } from '#/api/erp/finance/payable/misc';
import type { ErpFinancePaymentApi } from '#/api/erp/finance/payment';

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
import { getPayableMisc } from '#/api/erp/finance/payable/misc';
import {
  createAndSubmitFinancePayment,
  createFinancePaymentDraft,
  getFinancePayment,
  getFinancePaymentItemPage,
  reverseFinancePaymentWriteOff,
  submitFinancePayment,
  updateAndSubmitFinancePayment,
  updateFinancePayment,
  updateFinancePaymentDraft,
} from '#/api/erp/finance/payment';
import { getSimpleDeptList } from '#/api/system/dept';
import { getSimpleUserList } from '#/api/system/user';
import { useFieldPermission } from '#/composables/useFieldPermission';
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
import { hasValidFinancePaymentDraftItems } from '#/views/erp/finance/utils/draft-items';
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
import PurchaseInForm from '#/views/erp/purchase/in/modules/form.vue';
import PurchasePriceAdjustForm from '#/views/erp/purchase/priceadjust/modules/form.vue';
import PurchaseReturnForm from '#/views/erp/purchase/return/modules/form.vue';
import { getErpDetailLoadError } from '#/views/erp/utils/detail-load-error';

import '#/views/erp/styles/form-focus.css';

import {
  calculateSettlementDocumentAmounts,
  createProgrammaticFinanceAmountGuard,
  normalizeFinanceAmount,
  subtractFinanceAmounts,
} from '../../money';
import { useReportViewOnly } from '#/views/erp/report/components/report-view-only';

import { useFormSchema } from '../data';
import ItemForm from './item-form.vue';
import {
  resolveCurrentFinancePaymentItems,
  validateFinancePaymentWriteOffItems,
} from './payment-item-selection';
import PurchaseSelect from './purchase-select.vue';
const { candidateSchema } = useFinanceCandidateFocus();

const emit = defineEmits(['success', 'audit', 'writeoff']);
const reportViewOnly = useReportViewOnly();

const formType = ref('create');
const itemFormRef = ref<InstanceType<typeof ItemForm>>();
const purchaseSelectRef = ref<InstanceType<typeof PurchaseSelect>>();
const suppressSupplierClearConfirm = ref(false);
const isPopulatingForm = ref(false);
const supplierClearConfirm = ref<any>();
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  'erp_finance_payment',
);
const accountOptions = ref<any[]>([]);
const supplierOptions = ref<any[]>([]);
const deptOptions = ref<any[]>([]);
const userOptions = ref<any[]>([]);
const effectiveAutoWriteOffDisabledDeptIds = ref<number[]>([]);
const detailLoading = ref(false);
const itemLoading = ref(false);
const detailLoadError = ref('');
const basicFormRef = ref<HTMLElement | null>(null);
const itemPagination = reactive({ pageNo: 1, pageSize: 10, total: 0 });
const itemSort = ref<{ field?: string; order?: 'asc' | 'desc' }>({});
let openRequestId = 0;
let skipDraftOnClose = false;
let draftSaved = false;
let draftSaving = false;
const totalPriceManuallyEdited = ref(false);
const totalPriceProgrammaticGuard = createProgrammaticFinanceAmountGuard();
const originalItemMap = new Map<
  number,
  ErpFinancePaymentApi.FinancePaymentItem
>();

type PaymentModalData = {
  id?: number;
  sourcePayableMisc?: ErpPayableMiscApi.PayableMisc;
  type?: string;
};

const [PurchaseInModal, purchaseInModalApi] = useVbenModal({
  connectedComponent: PurchaseInForm,
  destroyOnClose: true,
});
const [PurchaseReturnModal, purchaseReturnModalApi] = useVbenModal({
  connectedComponent: PurchaseReturnForm,
  destroyOnClose: true,
});
const [PurchasePriceAdjustModal, purchasePriceAdjustModalApi] = useVbenModal({
  connectedComponent: PurchasePriceAdjustForm,
  destroyOnClose: true,
});
const SupplierDetail = defineAsyncComponent(
  () => import('#/views/erp/purchase/supplier/modules/detail.vue'),
);
const [SupplierDetailModal, supplierDetailModalApi] = useVbenModal({
  connectedComponent: SupplierDetail,
  destroyOnClose: true,
});

function handleOpenSupplierDetail() {
  if (!formData.value.supplierId) return;
  supplierDetailModalApi.setData({ id: formData.value.supplierId }).open();
}

function handleBizDetail(item: ErpFinancePaymentApi.FinancePaymentItem) {
  if (!item.bizId) return;
  const modalMap: Record<number, any> = {
    [ErpBizType.PURCHASE_IN]: purchaseInModalApi,
    [ErpBizType.PURCHASE_RETURN]: purchaseReturnModalApi,
    [ErpBizType.PURCHASE_PRICE_ADJUST]: purchasePriceAdjustModalApi,
  };
  modalMap[item.bizType]?.setData({ type: 'detail', id: item.bizId }).open();
}

function createDefaultFormData(): ErpFinancePaymentApi.FinancePayment {
  return {
    id: undefined,
    no: '',
    supplierId: undefined,
    paymentTime: undefined,
    totalPrice: undefined as any,
    discountPrice: undefined as any,
    paymentPrice: 0,
    paymentVoucherNo: '',
    remark: '',
    sourcePayableMiscId: undefined,
    sourcePayableMiscNo: undefined,
    status: 10,
    items: [],
  };
}

const transferLimit = ref<null | number | string>(null);
const transferLimitError = ref('');

async function refreshTransferLimit() {
  const sourceId = formData.value.sourcePayableMiscId;
  if (!sourceId) return;
  const requestId = openRequestId;
  const documentId = formData.value.id;
  try {
    let amount: number | string | null | undefined;
    if (documentId) {
      const document = await getFinancePayment(documentId, {
        includeItems: false,
      });
      amount = document.sourceTransferAvailableAmount;
    } else {
      const source = await getPayableMisc(sourceId);
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
  if (!formData.value.sourcePayableMiscId) return;
  const requestId = openRequestId;
  await refreshTransferLimit();
  if (!isLatestOpen(requestId)) throw new Error('页面已切换，请重新操作');
  const error =
    transferLimitError.value ||
    getTransferAmountError(value, transferLimit.value);
  formApi.form.setFieldError('paymentPrice', error || undefined);
  if (error) throw new Error(error);
}

function buildSourcePayableMiscDefaults(
  source: ErpPayableMiscApi.PayableMisc,
  defaults: ErpFinancePaymentApi.FinancePayment,
): ErpFinancePaymentApi.FinancePayment {
  const amount = normalizeFinanceAmount(source.transferAvailableAmount);
  const remark = source.no
    ? `由其他应付单 ${source.no} 转入`
    : '由其他应付单转入';
  return {
    ...defaults,
    accountId: source.accountId,
    accountName: source.accountName,
    deptId: source.deptId,
    deptName: source.deptName,
    financeUserId: source.handlerId,
    financeUserName: source.handlerName,
    items: [],
    remark,
    sourcePayableMiscId: source.id,
    sourceTransferAvailableAmount: source.transferAvailableAmount,
    sourcePayableMiscNo: source.no,
    supplierId: source.supplierId,
    supplierName: source.supplierName,
    totalPrice: amount as any,
    discountPrice: 0 as any,
    paymentPrice: amount,
  };
}

function isLatestOpen(requestId: number) {
  return requestId === openRequestId;
}

const formData = ref<ErpFinancePaymentApi.FinancePayment>(
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
    Boolean(formData.value.id) &&
    hasAccessByCodes(['erp:finance-payment:update']),
);
const isEditingDraft = computed(
  () => formType.value === 'edit' && formData.value.status === 0,
);
const canConfirmForm = computed(() => {
  if (formType.value === 'detail') return false;
  if (formType.value === 'create' || isEditingDraft.value) {
    return hasAccessByCodes(['erp:finance-payment:update-status']);
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
    formData.value.status === 0 &&
    hasAccessByCodes(['erp:finance-payment:update-status']),
);
const canEditFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !detailLoading.value &&
    !detailLoadError.value &&
    Boolean(formData.value.id) &&
    formData.value.status !== 20 &&
    hasAccessByCodes(['erp:finance-payment:update']),
);
const canApprove = computed(
  () =>
    formType.value === 'detail' &&
    formData.value.status === 10 &&
    hasAccessByCodes(['erp:finance-payment:update-status']),
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
      documentName: '付款单',
      documentType: 'finance-payment',
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

function findOptionName(list: any[], id: number | undefined, field = 'name') {
  return list.find((item) => item.id === id)?.[field];
}

function handleSupplierOptionsChange(options: any[]) {
  supplierOptions.value = options || [];
}

function syncCurrentSupplierOption(supplier?: {
  supplierId?: number;
  supplierName?: string;
}) {
  if (!supplier?.supplierId || !supplier.supplierName) {
    return;
  }
  if (supplierOptions.value.some((item) => item.id === supplier.supplierId)) {
    return;
  }
  supplierOptions.value = [
    ...supplierOptions.value,
    {
      id: supplier.supplierId,
      label: supplier.supplierName,
      name: supplier.supplierName,
      value: supplier.supplierId,
    },
  ];
}

const paymentContext = computed<
  Partial<ErpFinancePaymentApi.FinancePaymentItem>
>(() => {
  const account = accountOptions.value.find(
    (item) => item.id === formData.value.accountId,
  );
  return {
    supplierName:
      formData.value.supplierName ||
      findOptionName(supplierOptions.value, formData.value.supplierId),
    deptName:
      formData.value.deptName ||
      findOptionName(deptOptions.value, formData.value.deptId),
    paymentMethod: account?.accountType
      ? getDictLabel(DICT_TYPE.ERP_ACCOUNT_TYPE, account.accountType)
      : account?.name,
    accountName: formData.value.accountName || account?.name,
    paymentTime: formData.value.paymentTime,
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
    ...paymentContext.value,
  })),
);

const AUDIT_FIELDS = new Set([
  'createTime',
  'creatorName',
  'updaterName',
  'updateTime',
]);

const canOpenSupplierDetail = computed(() =>
  Boolean(formData.value?.supplierId && formData.value?.supplierName),
);
const documentSummary = computed(() => ({
  count:
    formType.value === 'detail' && formData.value.id
      ? itemPagination.total
      : formData.value.items?.length || 0,
  discountPrice: formData.value.discountPrice,
  paymentPrice: financeValue(formData.value.paymentPrice || 0),
  totalPrice: formData.value.totalPrice,
}));
const auditRecord = computed(() => {
  const record = { ...formData.value } as Record<string, any>;
  for (const field of AUDIT_FIELDS) {
    if (hiddenFields.value.includes(field)) delete record[field];
  }
  if (hiddenFields.value.includes('deptId')) {
    delete record.deptId;
    delete record.deptName;
  }
  return record;
});

function formatAmount(value?: number) {
  if (value === undefined || value === null) return '';
  return `\u00A5${erpPriceInputFormatter(Number(value))}`;
}
const getTitle = computed(() => {
  if (formType.value === 'create') {
    return $t('ui.actionTitle.create', ['付款单']);
  }
  if (formType.value === 'copy') {
    return $t('ui.actionTitle.create', ['付款单']);
  }
  if (formType.value === 'edit') {
    return $t('ui.actionTitle.edit', ['付款单']);
  }
  return '付款单详情';
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
    schema: buildBasicFormSchema(
      replaceDetailFieldWithLinkSlot(
        candidateSchema(
          buildFinanceDocumentFormSchema(
            useFormSchema(
              formType.value,
              hiddenFields.value,
              handleSupplierOptionsChange,
            ),
            { data: formData.value, formType: formType.value },
          ),
        ),
        formType.value,
        'supplierId',
        'supplierDetail',
      ),
    ),
  });
}

function buildBasicFormSchema(schema: ReturnType<typeof useFormSchema>) {
  return schema.filter((item) => !AUDIT_FIELDS.has(item.fieldName));
}

async function clearPaymentItemsAfterSupplierChange(supplierId?: number) {
  suppressSupplierClearConfirm.value = true;
  totalPriceManuallyEdited.value = false;
  formData.value.supplierId = supplierId;
  formData.value.supplierName = findOptionName(
    supplierOptions.value,
    supplierId,
  );
  formData.value.items = [];
  formData.value.totalPrice = undefined as any;
  formData.value.paymentPrice = 0;
  await itemFormRef.value?.setImportedItems([]);
  refreshFormSchema();
  await setCalculatedAmounts({
    supplierId,
    totalPrice: undefined,
    paymentPrice: 0,
  });
  suppressSupplierClearConfirm.value = false;
}

function destroySupplierClearConfirm() {
  const confirmInstance = supplierClearConfirm.value;
  if (typeof confirmInstance === 'function') {
    confirmInstance();
  } else {
    confirmInstance?.destroy?.();
  }
  supplierClearConfirm.value = undefined;
}

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    labelClass: '!justify-start !text-left',
    labelWidth: 82,
  },
  wrapperClass: 'payment-form__basic-grid grid-cols-4',
  layout: 'horizontal',
  schema: buildBasicFormSchema(
    candidateSchema(
      buildFinanceDocumentFormSchema(
        useFormSchema(
          formType.value,
          hiddenFields.value,
          handleSupplierOptionsChange,
        ),
        { data: formData.value, formType: formType.value },
      ),
    ),
  ),
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
      formData.value.paymentPrice = subtractFinanceAmounts(
        totalPrice,
        discountPrice,
      );
      await formApi.setValues({ paymentPrice: formData.value.paymentPrice });
    }
    if (changedFields.includes('discountPrice')) {
      const discountPrice = normalizeFinanceAmount(
        toOptionalNumberValue(values.discountPrice),
      );
      formData.value.discountPrice = discountPrice;
      formData.value.paymentPrice = subtractFinanceAmounts(
        formData.value.totalPrice,
        discountPrice,
      );
      await formApi.setValues({ paymentPrice: formData.value.paymentPrice });
    }
    if (changedFields.includes('supplierId')) {
      if (suppressSupplierClearConfirm.value) {
        formData.value.supplierId = values.supplierId;
        return;
      }
      const nextSupplierId = values.supplierId;
      const previousSupplierId = formData.value.supplierId;
      if (previousSupplierId === nextSupplierId) {
        formData.value.supplierId = nextSupplierId;
        return;
      }
      if (
        previousSupplierId &&
        previousSupplierId !== nextSupplierId &&
        (formData.value.items?.length || 0) > 0
      ) {
        destroySupplierClearConfirm();
        supplierClearConfirm.value = Modal.confirm({
          title: '切换供应商',
          content: '切换供应商后会清空已引入的付款明细，确认切换吗？',
          okText: '确认切换',
          cancelText: '取消',
          onOk: async () => {
            supplierClearConfirm.value = undefined;
            await clearPaymentItemsAfterSupplierChange(nextSupplierId);
          },
          onCancel: async () => {
            supplierClearConfirm.value = undefined;
            suppressSupplierClearConfirm.value = true;
            await formApi.setValues({ supplierId: previousSupplierId });
            suppressSupplierClearConfirm.value = false;
          },
        });
        return;
      }
      formData.value.supplierId = nextSupplierId;
      formData.value.supplierName = findOptionName(
        supplierOptions.value,
        nextSupplierId,
      );
      if ((formData.value.items?.length || 0) > 0) {
        await clearPaymentItemsAfterSupplierChange(nextSupplierId);
      }
    }
    for (const field of [
      'accountId',
      'deptId',
      'financeUserId',
      'paymentTime',
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
  () => [formData.value.paymentPrice, transferLimit.value],
  () => {
    if (
      formType.value === 'detail' ||
      !formData.value.sourcePayableMiscId ||
      transferLimit.value === null
    )
      return;
    formApi.form.setFieldError(
      'paymentPrice',
      getTransferAmountError(
        formData.value.paymentPrice,
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
  items: ErpFinancePaymentApi.FinancePaymentItem[],
) {
  formData.value.items = items.map((item) => ({
    ...item,
    paymentPrice: normalizeFinanceAmount(item.paymentPrice),
  }));
  refreshFormSchema();
  const { actualPrice, totalPrice } = calculateSettlementDocumentAmounts(
    formData.value.items.map((item) => item.paymentPrice),
    formData.value.discountPrice,
    {
      currentTotalPrice: formData.value.totalPrice,
      totalPriceManuallyEdited: totalPriceManuallyEdited.value,
    },
  );
  formData.value.totalPrice = totalPrice;
  formData.value.paymentPrice = actualPrice;
  await setCalculatedAmounts({
    totalPrice,
    paymentPrice: formData.value.paymentPrice,
  });
}

async function loadFinancePaymentItemsPage(
  options: { pageNo?: number; pageSize?: number } = {},
) {
  if (!formData.value.id) {
    return;
  }
  const pageNo = options.pageNo ?? itemPagination.pageNo;
  const pageSize = options.pageSize ?? itemPagination.pageSize;
  itemLoading.value = true;
  try {
    const page = await getFinancePaymentItemPage({
      paymentId: formData.value.id,
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

async function fetchAllFinancePaymentItems(id = formData.value.id) {
  if (!id) {
    return formData.value.items || [];
  }
  const pageSize = 200;
  const firstPage = await getFinancePaymentItemPage({
    paymentId: id,
    pageNo: 1,
    pageSize,
    mask: false,
  });
  const items = [...(firstPage.list || [])];
  const total = Number(firstPage.total || 0);
  const pageCount = Math.ceil(financeDivide(total, pageSize));
  for (let pageNo = 2; pageNo <= pageCount; pageNo++) {
    const page = await getFinancePaymentItemPage({
      paymentId: id,
      pageNo,
      pageSize,
      mask: false,
    });
    items.push(...(page.list || []));
  }
  return items;
}

function handleItemPageChange(page: { pageNo: number; pageSize: number }) {
  void loadFinancePaymentItemsPage(page);
}

function handleItemSortChange(sort: { field?: string; order?: null | string }) {
  itemSort.value = {
    field: sort.field,
    order:
      sort.order === 'desc' ? 'desc' : sort.order === 'asc' ? 'asc' : undefined,
  };
  void loadFinancePaymentItemsPage({ pageNo: 1 });
}

async function handleUpdateTotalPrice(totalPrice: number | string | null) {
  formData.value.totalPrice = normalizeFinanceAmount(totalPrice);
  await setCalculatedAmounts({ totalPrice: formData.value.totalPrice });
}

async function handleUpdatePaymentPrice(paymentPrice: number | string | null) {
  formData.value.paymentPrice = normalizeFinanceAmount(paymentPrice);
  await setCalculatedAmounts({ paymentPrice: formData.value.paymentPrice });
}

async function reloadCurrentDetail() {
  if (!formData.value.id) return;
  const detail = await getFinancePayment(formData.value.id, {
    includeItems: false,
  });
  isPopulatingForm.value = true;
  try {
    formData.value = await hydrateFinanceDocumentFormSelectLabels(
      { ...detail, items: formData.value.items || [] },
      {
        accountOptions: accountOptions.value,
        deptOptions: deptOptions.value,
        supplierOptions: supplierOptions.value,
        userOptions: userOptions.value,
      },
    );
    await loadFinancePaymentItemsPage();
    refreshFormSchema();
    await formApi.setValues(
      buildFinanceDocumentDetailFormValues(formData.value, formType.value),
      false,
    );
  } finally {
    isPopulatingForm.value = false;
  }
}

function handleReverseWriteOff(item: ErpFinancePaymentApi.FinancePaymentItem) {
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
      await reverseFinancePaymentWriteOff({ itemId: item.id!, reason });
      message.success('核销已撤销');
      await reloadCurrentDetail();
      emit('success');
    },
  });
}

function getCurrentEditablePaymentItems() {
  return resolveCurrentFinancePaymentItems(
    purchaseSelectRef.value?.getSelectedItems(),
    formData.value.items,
  );
}

async function buildCurrentPaymentPayload(
  currentItemsSnapshot?: ErpFinancePaymentApi.FinancePaymentItem[],
) {
  const values =
    (await formApi.getValues()) as ErpFinancePaymentApi.FinancePayment;
  normalizeOptionalNumberFields(values as any, [
    'discountPrice',
    'paymentPrice',
    'totalPrice',
  ]);
  values.discountPrice = normalizeFinanceAmount(values.discountPrice);
  values.paymentPrice = normalizeFinanceAmount(values.paymentPrice);
  values.totalPrice = normalizeFinanceAmount(values.totalPrice);
  const selectedItems =
    currentItemsSnapshot ??
    (formType.value === 'detail'
      ? await fetchAllFinancePaymentItems()
      : getCurrentEditablePaymentItems());
  const submitItems = selectedItems.map((item) => ({
    id: formType.value === 'create' ? undefined : item.id,
    bizId: item.bizId,
    bizType: item.bizType,
    bizNo: item.bizNo,
    totalPrice: normalizeFinanceAmount(item.totalPrice),
    paidPrice: normalizeFinanceAmount(item.paidPrice),
    paymentPrice: normalizeFinanceAmount(item.paymentPrice),
    remark: item.remark,
  }));
  return {
    ...values,
    sourcePayableMiscId: formData.value.sourcePayableMiscId,
    sourcePayableMiscNo: formData.value.sourcePayableMiscNo,
    items:
      formType.value === 'create'
        ? submitItems
        : buildLocalIncrementalItems(submitItems),
  };
}

function rememberOriginalItems(
  items: ErpFinancePaymentApi.FinancePaymentItem[] = [],
) {
  originalItemMap.clear();
  items.forEach((item) => {
    if (item.id && item.id > 0) {
      originalItemMap.set(item.id, { ...item });
    }
  });
}

function buildLocalIncrementalItems(
  items: ErpFinancePaymentApi.FinancePaymentItem[],
) {
  const edits = new Map<number, ErpFinancePaymentApi.FinancePaymentItem>();
  const deletes = new Set<number>();
  const creates = new Map<string, ErpFinancePaymentApi.FinancePaymentItem>();
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
        `finance-payment:source:${item.bizType}:${item.bizId}`,
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
    draftSaved
  ) {
    return true;
  }
  if (draftSaving) return false;
  draftSaving = true;
  modalApi.lock();
  try {
    const payload = await buildCurrentPaymentPayload();
    await validateTransferAmount(payload.paymentPrice);
    if (isCreatingDraft) {
      if (
        !payload.sourcePayableMiscId &&
        !hasValidFinancePaymentDraftItems(payload.items ?? [])
      ) {
        if (!options.explicit) {
          draftSaved = true;
        }
        message.warning('未选择明细，不生成草稿');
        return !options.explicit;
      }
      await createFinancePaymentDraft(payload);
    } else {
      payload.id = formData.value.id;
      await updateFinancePaymentDraft(payload);
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
    const detail = await getFinancePayment(id, { includeItems: false });
    if (!isLatestOpen(requestId)) return;
    isPopulatingForm.value = true;
    totalPriceManuallyEdited.value = true;
    formData.value = await hydrateFinanceDocumentFormSelectLabels(
      { ...detail, items: await fetchAllFinancePaymentItems(id) },
      {
        accountOptions: accountOptions.value,
        deptOptions: deptOptions.value,
        supplierOptions: supplierOptions.value,
        userOptions: userOptions.value,
      },
    );
    await applyFormMode('edit');
    await formApi.resetForm();
    await nextTick();
    if (!isLatestOpen(requestId)) return;
    await formApi.setValues(formData.value, false);
  } catch (error) {
    if (isLatestOpen(requestId)) {
      detailLoadError.value = getErpDetailLoadError(
        error,
        '付款单加载失败，请关闭后重试',
      );
    }
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
        await validateTransferAmount(formData.value.paymentPrice);
        await submitFinancePayment(id);
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
    const currentItemsSnapshot =
      formType.value === 'detail'
        ? undefined
        : getCurrentEditablePaymentItems();
    try {
      if (currentItemsSnapshot === undefined) {
        itemFormRef.value?.validate();
      } else {
        if (
          purchaseSelectRef.value &&
          !purchaseSelectRef.value.validateSelectedItemsAvailable()
        ) {
          return;
        }
        validateFinancePaymentWriteOffItems(currentItemsSnapshot);
      }
    } catch (error: any) {
      message.error(error.message || '明细校验失败');
      return;
    }
    modalApi.lock();
    try {
      const payload = await buildCurrentPaymentPayload(currentItemsSnapshot);
      await validateTransferAmount(payload.paymentPrice);
      if (formType.value === 'create') {
        await createAndSubmitFinancePayment(payload);
      } else if (isEditingDraft.value) {
        payload.id = formData.value.id;
        await updateAndSubmitFinancePayment(payload);
      } else {
        await updateFinancePayment(payload);
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
      destroySupplierClearConfirm();
      isPopulatingForm.value = false;
      totalPriceManuallyEdited.value = false;
      totalPriceProgrammaticGuard.clear();
      detailLoading.value = false;
      detailLoadError.value = '';
      originalItemMap.clear();
      return;
    }
    const requestId = (openRequestId += 1);
    transferLimit.value = null;
    transferLimitError.value = '';
    skipDraftOnClose = false;
    draftSaved = false;
    draftSaving = false;
    destroySupplierClearConfirm();
    const data = modalApi.getData<PaymentModalData>();
    const formMode = getFormMode(data?.type);
    formType.value = formMode;
    modalApi.setState({ fullscreen: true });
    detailLoading.value = true;
    detailLoadError.value = '';
    if (data?.id) {
      modalApi.lock();
    }
    try {
      const [accounts, depts, users, , autoWriteOffConfig] = await Promise.all([
        getAccountSimpleList(),
        getSimpleDeptList(),
        getSimpleUserList(),
        loadHiddenFields(),
        getAutoWriteOffConfig(),
      ]);
      if (!isLatestOpen(requestId)) return;
      accountOptions.value = accounts;
      supplierOptions.value = [];
      deptOptions.value = depts;
      userOptions.value = users;
      effectiveAutoWriteOffDisabledDeptIds.value =
        autoWriteOffConfig.effectiveDisabledDeptIds || [];
      await applyFormMode(formMode);
      if (!isLatestOpen(requestId)) return;

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
      if (!isLatestOpen(requestId)) return;

      if (!data?.id) {
        const defaultAccount = accountOptions.value.find(
          (item) => item.defaultStatus,
        );
        const defaults = {
          ...createDefaultFormData(),
          accountId: defaultAccount?.id,
          accountName: defaultAccount?.name,
          paymentTime: Date.now() as any,
        };
        const source = data?.sourcePayableMisc
          ? await getPayableMisc(data.sourcePayableMisc.id!)
          : undefined;
        if (!isLatestOpen(requestId)) return;
        totalPriceManuallyEdited.value = Boolean(source);
        formData.value = source
          ? buildSourcePayableMiscDefaults(source, defaults)
          : defaults;
        transferLimit.value = source?.transferAvailableAmount ?? null;
        syncCurrentSupplierOption(formData.value);
        refreshFormSchema();
        if (data?.sourcePayableMisc) {
          await itemFormRef.value?.setImportedItems(formData.value.items || []);
          itemPagination.total = formData.value.items?.length || 0;
        }
        await setCalculatedAmounts({
          accountId: formData.value.accountId,
          deptId: formData.value.deptId,
          financeUserId: formData.value.financeUserId,
          paymentTime: formData.value.paymentTime,
          paymentVoucherNo: formData.value.paymentVoucherNo,
          remark: formData.value.remark,
          supplierId: formData.value.supplierId,
          totalPrice: formData.value.totalPrice,
          discountPrice: formData.value.discountPrice,
          paymentPrice: formData.value.paymentPrice,
        });
        return;
      }

      totalPriceManuallyEdited.value = true;

      const detail = await getFinancePayment(data.id, { includeItems: false });
      transferLimit.value = detail.sourceTransferAvailableAmount ?? null;
      if (!isLatestOpen(requestId)) return;
      if (data.type === 'copy') {
        originalItemMap.clear();
        formData.value = await hydrateFinanceDocumentFormSelectLabels(
          buildFinanceCopyDraft(
            {
              ...detail,
              items: await fetchAllFinancePaymentItems(data.id),
            },
            { extraCleanKeys: ['paymentVoucherNo'] },
          ),
          {
            accountOptions: accountOptions.value,
            deptOptions: deptOptions.value,
            supplierOptions: supplierOptions.value,
            userOptions: userOptions.value,
          },
        );
      } else if (formMode === 'detail') {
        formData.value = await hydrateFinanceDocumentFormSelectLabels(
          { ...detail, items: [] },
          {
            accountOptions: accountOptions.value,
            deptOptions: deptOptions.value,
            supplierOptions: supplierOptions.value,
            userOptions: userOptions.value,
          },
        );
      } else {
        const allItems = await fetchAllFinancePaymentItems(data.id);
        rememberOriginalItems(allItems);
        formData.value = await hydrateFinanceDocumentFormSelectLabels(
          {
            ...detail,
            items: allItems,
          },
          {
            accountOptions: accountOptions.value,
            deptOptions: deptOptions.value,
            supplierOptions: supplierOptions.value,
            userOptions: userOptions.value,
          },
        );
      }
      refreshFormSchema();
      await formApi.setValues(
        buildFinanceDocumentDetailFormValues(formData.value, formType.value),
        false,
      );
      if (formMode === 'detail' && data.type !== 'copy') {
        await loadFinancePaymentItemsPage({ pageNo: 1, pageSize: 10 });
      } else {
        itemPagination.pageNo = 1;
        itemPagination.pageSize = 10;
        itemPagination.total = formData.value.items?.length || 0;
        await itemFormRef.value?.setImportedItems(formData.value.items || []);
      }
    } catch (error) {
      if (isLatestOpen(requestId)) {
        detailLoadError.value = getErpDetailLoadError(
          error,
          data?.id
            ? '付款单加载失败，请关闭后重试'
            : '付款单初始化失败，请关闭后重试',
        );
      }
    } finally {
      if (isLatestOpen(requestId)) {
        isPopulatingForm.value = false;
        detailLoading.value = false;
        modalApi.unlock();
        queueFocusFirstBasicFormControl(requestId);
      }
    }
  },
});
</script>

<template>
  <ModalApi
    :title="getTitle"
    :confirm-text="confirmText"
    :show-confirm-button="canConfirmForm && !detailLoading && !detailLoadError"
  >
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
      class="payment-form"
      :class="{
        'erp-form-focus-highlight': formType !== 'detail',
        'payment-form--editable': formType !== 'detail',
      }"
    >
      <div v-if="detailLoading" class="payment-form__load-state">
        正在加载付款单…
      </div>
      <div
        v-else-if="detailLoadError"
        class="payment-form__load-state is-error"
      >
        {{ detailLoadError }}
      </div>
      <div
        v-show="!detailLoading && !detailLoadError"
        class="payment-form__content"
      >
        <section ref="basicFormRef" class="payment-form__section">
          <header class="payment-form__section-heading">
            <span class="payment-form__section-title">基础信息</span>
          </header>
          <div
            v-if="formData.sourcePayableMiscId && formType !== 'detail'"
            class="mb-2 text-sm"
            role="status"
          >
            {{
              transferLimitError ||
              (transferLimit === null
                ? '可转额度暂不可用'
                : `剩余可转金额：${formatAmount(transferLimit)}`)
            }}
            <div
              v-if="
                transferLimit !== null &&
                getTransferAmountError(formData.paymentPrice, transferLimit)
              "
              class="text-destructive"
              role="alert"
            >
              {{ getTransferAmountError(formData.paymentPrice, transferLimit) }}
            </div>
          </div>
          <Form
            class="payment-form__base-form"
            @keydown.enter.capture="handleBasicFormEnter"
          >
            <template #supplierDetail>
              <DetailLinkInput
                :navigable="canOpenSupplierDetail"
                :value="formData?.supplierName"
                @open="handleOpenSupplierDetail"
              />
            </template>
          </Form>
        </section>

        <section class="payment-form__section payment-form__section--detail">
          <header class="payment-form__section-heading">
            <span class="payment-form__section-title">付款明细</span>
            <span class="payment-form__section-count">
              {{ documentSummary.count }} 笔已选
            </span>
          </header>
          <ItemForm
            v-if="formType === 'detail'"
            ref="itemFormRef"
            class="payment-form__detail-table"
            :items="displayItems"
            :disabled="formType === 'detail'"
            :discount-price="Number(formData.discountPrice || 0)"
            :hidden-fields="hiddenFields"
            :loading="itemLoading"
            pagination-mode="remote"
            :pagination="itemPagination"
            :allow-reverse="!reportViewOnly && formData?.status === 20"
            @update:items="handleUpdateItems"
            @update:total-price="handleUpdateTotalPrice"
            @update:payment-price="handleUpdatePaymentPrice"
            @page-change="handleItemPageChange"
            @sort-change="handleItemSortChange"
            @detail="handleBizDetail"
            @reverse="handleReverseWriteOff"
            @request-submit="handleLastInputEnterConfirm"
          />
          <PurchaseSelect
            v-else
            ref="purchaseSelectRef"
            class="payment-form__detail-table"
            :supplier-id="formData.supplierId"
            :dept-id="formData.deptId"
            :current-items="formData.items || []"
            :document-total-price="formData.totalPrice"
            :payment-context="paymentContext"
            :auto-write-off-preview-disabled="autoWriteOffPreviewDisabled"
            :disabled="formType === 'detail'"
            @change="handleUpdateItems"
            @detail="handleBizDetail"
            @request-submit="handleLastInputEnterConfirm"
          />
          <div class="payment-form__document-summary">
            <strong>单据合计</strong>
            <span>
              明细 <b>{{ documentSummary.count }}</b> 笔
            </span>
            <span>
              合计付款 <b>{{ formatAmount(documentSummary.totalPrice) }}</b>
            </span>
            <span>
              优惠金额
              <b>{{ formatAmount(documentSummary.discountPrice) }}</b>
            </span>
            <span class="payment-form__document-summary-actual">
              实际付款
              <b>{{ formatAmount(documentSummary.paymentPrice) }}</b>
            </span>
          </div>
        </section>

        <section
          v-if="formType === 'detail' && formData?.id"
          class="payment-form__section payment-form__audit"
        >
          <header class="payment-form__section-heading">
            <span class="payment-form__section-title">审计信息</span>
          </header>
          <ErpAuditInfo title="" :record="auditRecord" />
        </section>
      </div>
    </div>
  </ModalApi>
  <RemarkModal @success="handleRemarkSuccess" />
  <PurchaseInModal />
  <PurchaseReturnModal />
  <PurchasePriceAdjustModal />
  <SupplierDetailModal />
</template>

<style scoped>
:deep(.flex-auto.overflow-hidden:has(> .relative > .erp-detail-link-field)) {
  overflow: visible;
}

.payment-form {
  --payment-form-accent: 24 82% 42%;

  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 12px;
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 24%);
  font-size: 12px;
}

:global(.dark) .payment-form {
  --payment-form-accent: 27 92% 64%;
}

.payment-form__content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.payment-form__load-state {
  display: flex;
  min-height: 96px;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.payment-form__load-state.is-error {
  color: hsl(var(--destructive));
}

.payment-form__section {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--card));
}

.payment-form__section-heading {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.payment-form__section-title {
  position: relative;
  padding-left: 10px;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
}

.payment-form__section-title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  background: hsl(var(--primary));
  border-radius: 3px;
  content: '';
}

.payment-form__section-count {
  flex: none;
  padding: 2px 8px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
}

.payment-form__base-form,
.payment-form__detail-table {
  min-width: 0;
}

.payment-form__base-form :deep(.payment-form__basic-grid) {
  gap: 0 12px;
  padding: 12px;
}

:deep(.payment-form__basic-grid > div) {
  min-width: 0;
}

:deep(.payment-form__basic-grid > .payment-form__full-row) {
  grid-column: 1 / -1;
}

:deep(.payment-form__base-form .ant-form-item) {
  margin-bottom: 10px;
}

:deep(.payment-form__basic-grid > div > label),
:deep(.payment-form__base-form .ant-form-item-label > label) {
  margin-right: 0;
  padding-right: 10px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  white-space: nowrap;
}

:deep(.payment-form__base-form .ant-input),
:deep(.payment-form__base-form .ant-picker),
:deep(.payment-form__base-form .ant-select-selector),
:deep(.payment-form__base-form .ant-input-number),
:deep(.payment-form__base-form .ant-picker-input > input),
:deep(.payment-form__base-form .ant-select-selection-item),
:deep(.payment-form__base-form .ant-select-selection-placeholder) {
  font-size: 12px;
}

:deep(.payment-form__base-form .ant-input),
:deep(.payment-form__base-form .ant-picker),
:deep(.payment-form__base-form .ant-select-selector),
:deep(.payment-form__base-form .ant-input-number) {
  min-height: 32px;
  background: hsl(var(--muted) / 48%) !important;
  border-color: hsl(var(--border)) !important;
  border-radius: 6px !important;
}

:deep(.payment-form__base-form .ant-select-single),
:deep(.payment-form__base-form .ant-picker),
:deep(.payment-form__base-form > .ant-input) {
  height: 32px;
}

:deep(.payment-form__base-form textarea) {
  min-height: 32px !important;
  resize: none;
  white-space: nowrap;
}

:deep(.payment-form__base-form .ant-upload-wrapper),
:deep(.payment-form__base-form .ant-upload-wrapper > div) {
  width: 100%;
}

:deep(.payment-form__base-form .ant-upload-select),
:deep(.payment-form__base-form .ant-upload-list-item) {
  min-height: 32px;
  background: hsl(var(--muted) / 48%);
  border-color: hsl(var(--border));
  border-radius: 6px;
  font-size: 12px;
}

.payment-form--editable
  :deep(.payment-form__base-form .ant-input:not(:disabled)),
.payment-form--editable
  :deep(.payment-form__base-form .ant-picker:not(.ant-picker-disabled)),
.payment-form--editable
  :deep(
    .payment-form__base-form
      .ant-select:not(.ant-select-disabled)
      .ant-select-selector
  ),
.payment-form--editable
  :deep(
    .payment-form__base-form .ant-input-number:not(.ant-input-number-disabled)
  ),
.payment-form--editable
  :deep(.payment-form__base-form .ant-upload-select:not(.ant-upload-disabled)) {
  background: hsl(var(--background)) !important;
}

.payment-form--editable :deep(.payment-form__base-form .ant-input:disabled),
.payment-form--editable :deep(.payment-form__base-form .ant-picker-disabled),
.payment-form--editable
  :deep(.payment-form__base-form .ant-select-disabled .ant-select-selector),
.payment-form--editable
  :deep(.payment-form__base-form .ant-input-number-disabled),
.payment-form--editable :deep(.payment-form__base-form .ant-upload-disabled) {
  color: hsl(var(--muted-foreground)) !important;
  background: hsl(var(--muted-foreground) / 14%) !important;
  border-color: hsl(var(--muted-foreground) / 28%) !important;
}

:deep(.payment-form__amount-field .ant-input) {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

:deep(.payment-form__amount-field--actual .ant-input) {
  border-color: hsl(var(--payment-form-accent) / 40%);
  color: hsl(var(--payment-form-accent));
  background: hsl(var(--payment-form-accent) / 6%);
}

.payment-form__detail-table {
  padding: 10px 10px 0;
}

.payment-form__document-summary {
  display: flex;
  min-height: 44px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px 20px;
  padding: 8px 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 20%);
  border-top: 1px solid hsl(var(--border));
}

.payment-form__document-summary strong {
  margin-right: auto;
  color: hsl(var(--foreground));
}

.payment-form__document-summary b {
  margin-left: 5px;
  color: hsl(var(--foreground));
  font-variant-numeric: tabular-nums;
}

.payment-form__document-summary-actual b {
  color: hsl(var(--payment-form-accent));
}

.payment-form__audit :deep(.erp-audit-info) {
  padding: 12px;
}

.payment-form__audit :deep(.erp-audit-info .text-sm) {
  font-size: 12px;
}

.payment-form__audit :deep(.erp-audit-info > div:first-child) {
  display: none;
}

:global(.finance-payment-form-select-dropdown .ant-select-item),
:global(.finance-payment-form-select-dropdown .ant-select-tree),
:global(.finance-payment-form-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

@media (max-width: 960px) {
  .payment-form__base-form :deep(.payment-form__basic-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .payment-form {
    padding: 8px;
  }

  .payment-form__section-heading {
    align-items: flex-start;
    flex-direction: column;
    justify-content: center;
    padding-top: 8px;
    padding-bottom: 8px;
  }

  .payment-form__base-form :deep(.payment-form__basic-grid) {
    grid-template-columns: minmax(0, 1fr);
  }

  .payment-form__document-summary {
    align-items: flex-start;
    flex-direction: column;
  }

  .payment-form__document-summary strong {
    margin-right: 0;
  }
}
</style>
