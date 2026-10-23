<script lang="ts" setup>
import { CANDIDATE_FOCUS_KEY } from '#/views/erp/utils/candidate-focus';

import type { VbenFormSchema } from '#/adapter/form';
import type {
  ErpSaleQuoteApi,
  SaleQuoteImportResp,
} from '#/api/erp/sale/quote';

import { computed, defineAsyncComponent, nextTick, ref, provide } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';
import { formatDateTime } from '@vben/utils';

import { Modal as AntdModal, Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { formatSaleDecimal, formatSaleAmount } from '#/views/erp/sale/utils/decimal';
import { getCustomerSalePriceLevel } from '#/api/erp/sale/customer';
import {
  approveSaleQuote,
  createSaleQuote,
  createSaleQuoteDraft,
  exportSaleQuoteImportTemplate,
  getSaleQuote,
  getSaleQuoteCustomerDeptSimplePage,
  getSaleQuoteEditItemPage,
  getSaleQuoteItemPage,
  importSaleQuote,
  matchSaleQuoteItems,
  reverseOrderSaleQuote,
  submitSaleQuote,
  updateSaleQuote,
  updateSaleQuoteDraft,
} from '#/api/erp/sale/quote';
import {
  applyFieldPermission,
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import { applyFieldConfig } from '#/views/erp/composables/useFieldConfig';
import { useReportViewOnly } from '#/views/erp/report/components/report-view-only';
import CustomerReceivableSummary from '#/views/erp/sale/components/CustomerReceivableSummary.vue';
import SaleDetailImportModal from '#/views/erp/sale/components/sale-detail-import-modal.vue';
import SaleDocumentRemarkForm from '#/views/erp/sale/components/SaleDocumentRemarkForm.vue';
import { buildSaleCopyDraft } from '#/views/erp/sale/utils/copy-draft';
import {
  createSaleItemClientRowKeyManager,
  stripSaleItemClientFields,
} from '#/views/erp/sale/utils/item-row-key';
import {
  buildSaleCurrentUserFormDefaults,
  buildSaleDocumentDetailFormValues,
  hydrateCurrentSaleFormSelectNames,
  hydrateSaleCustomerFromFallback,
  withCurrentSaleFormSelectOptions,
} from '#/views/erp/sale/utils/document-form';
import { hasValidSaleDraftItems } from '#/views/erp/sale/utils/draft-items';
import { getCurrentTimestamp } from '#/views/erp/sale/utils/form-defaults';
import { toOptionalNumberValue } from '#/views/erp/sale/utils/text-number';
import { getItemPrintSortTitle } from '#/views/erp/sale/utils/item-print-sort';
import {
  clampRemoteItemPageNo,
  composeRemoteItemPage,
  getRemoteItemTotal,
  pageHasPersistedRows,
} from '#/views/erp/sale/utils/remote-item-paging';
import {
  focusFirstEditableFormControl,
  focusNextEditableFormControlOnEnter,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';

import { useFormSchema } from '../data';
import ConvertCartModal from './convert-cart-modal.vue';
import ItemForm from './item-form.vue';

import '#/views/erp/styles/form-focus.css';

provide(CANDIDATE_FOCUS_KEY, ref(true));

const emit = defineEmits(['success', 'print']);
const reportViewOnly = useReportViewOnly();
const FIELD_PERMISSION_MODULE = 'erp_sale_quote';
const DEFAULT_ITEM_PAGE_SIZE = 10;
const formData = ref<ErpSaleQuoteApi.SaleQuote>();
const formType = ref('');
const isSaleQuoteFormOpen = ref(false);
const detailLoading = ref(false);
const detailLoadError = ref('');
const editLoadError = ref('');
let detailLoadSequence = 0;
let formLoadSequence = 0;
let skipDraftOnClose = false;
let draftSaved = false;
let draftSaving = false;
const isHydratingFormValues = ref(false);
const canOpenCustomerDetail = computed(() =>
  Boolean(formData.value?.customerId && formData.value?.customerName),
);
const itemFormRef = ref<InstanceType<typeof ItemForm>>();
const basicFormRef = ref<HTMLElement | null>(null);
const convertCartModalRef = ref<InstanceType<typeof ConvertCartModal>>();
const CustomerDetail = defineAsyncComponent(
  () => import('#/views/erp/sale/customer/modules/detail.vue'),
);
const [CustomerDetailModal, customerDetailModalApi] = useVbenModal({
  connectedComponent: CustomerDetail,
  destroyOnClose: true,
});
const [RemarkModal, remarkModalApi] = useVbenModal({
  connectedComponent: SaleDocumentRemarkForm,
  destroyOnClose: true,
});

function handleOpenCustomerDetail() {
  if (!formData.value?.customerId) return;
  customerDetailModalApi.setData({ id: formData.value.customerId }).open();
}
const [ImportFormModal, importFormModalApi] = useVbenModal({
  connectedComponent: SaleDetailImportModal,
});
const { hasAccessByCodes } = useAccess();
const userStore = useUserStore();
const currentPriceType = ref<string | undefined>();
const currentCustomerPriceLevel = ref<number | undefined>();
const itemPageLoading = ref(false);
let itemPageLoadSequence = 0;
let itemMutationSequence = 0;
let remotePersistedItemTotal = 0;
let remotePersistedItemTotalKnown = false;
const itemPageState = ref({
  orderDirection: undefined as 'asc' | 'desc' | undefined,
  orderField: undefined as string | undefined,
  pageNo: 1,
  pageSize: DEFAULT_ITEM_PAGE_SIZE,
  total: 0,
});
const saleDeptOptions = ref<any[]>([]);
let saleDeptLoadSeq = 0;
let saleDeptSyncing = false;
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
  { customerPriceLevel: currentCustomerPriceLevel },
);
const canEditRemark = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    hasAccessByCodes(['erp:sale-quote:update']),
);
const canPrintFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:sale-quote:print']),
);
const printSortTitle = computed(() =>
  getItemPrintSortTitle(
    itemPageState.value.orderField,
    itemPageState.value.orderDirection,
  ),
);
function handleDetailPrint() {
  if (!formData.value) return;
  emit('print', {
    row: formData.value,
    itemOrderField: itemPageState.value.orderField,
    itemOrderDirection: itemPageState.value.orderDirection,
  });
}
const canBatchUpdateItems = computed(() => {
  if (reportViewOnly) return false;
  if (formType.value !== 'detail') {
    return hasAccessByCodes([
      formData.value?.id ? 'erp:sale-quote:update' : 'erp:sale-quote:create',
    ]);
  }
  return (
    !!formData.value?.id &&
    [0, 10, 90].includes(Number(formData.value?.status)) &&
    hasAccessByCodes(['erp:sale-quote:update'])
  );
});
const isRemoteItemPaging = computed(
  () =>
    Boolean(formData.value?.id) && ['detail', 'edit'].includes(formType.value),
);
const remoteItemEdits = new Map<number, ErpSaleQuoteApi.SaleQuoteItem>();
const remoteItemDeletes = new Set<number>();
const itemRowKeyManager = createSaleItemClientRowKeyManager('sale-quote-item');
const remoteItemCreates = new Map<string, ErpSaleQuoteApi.SaleQuoteItem>();
const remoteItemOriginals = new Map<number, ErpSaleQuoteApi.SaleQuoteItem>();
const REMOTE_ITEM_COMPARE_IGNORED_FIELDS = new Set([
  'operation',
  'clientRowKey',
  'seq',
  'quoteId',
  'productCode',
  'productName',
  'productBarCode',
  'productUnitName',
  'warehouseName',
  'warehouseDeptId',
  'warehouseDeptName',
  'deptName',
  'stockCount',
  'convertedCount',
  'productPurchasePrice',
  'salePrice',
  'lastSalePrice',
  'minPrice',
  'referencePrice',
  'retailPrice',
  'lastPurchasePrice',
  'grossProfitRate',
  'backupPrice1',
  'wholesalePrice',
  'sharePrice',
  'priceVisible',
  'batchNoEnabled',
  'totalProductPrice',
  'totalPrice',
  'taxPrice',
  'totalTaxPrice',
]);

function handleEditRemark() {
  if (!formData.value?.id) return;
  remarkModalApi
    .setData({
      documentName: '销售报价单',
      documentType: 'sale-quote',
      id: formData.value.id,
      no: formData.value.no,
      remark: formData.value.remark,
    })
    .open();
}

async function handleRemarkSuccess(remark: string) {
  if (!formData.value) return;
  formData.value.remark = remark;
  await formApi.setValues({ remark });
  emit('success');
}

const getTitle = computed(() => {
  if (formType.value === 'create') return '新增报价订单';
  if (formType.value === 'edit') return '编辑报价订单';
  return '报价订单详情';
});

const QUOTE_STATUS_META: Record<number, { className: string; label: string }> =
  {
    0: { className: 'is-draft', label: '草稿' },
    10: { className: 'is-info', label: '待下订' },
    20: { className: 'is-success', label: '已下订' },
    30: { className: 'is-info', label: '部分转手推车' },
    40: { className: 'is-success', label: '全部转手推车' },
    50: { className: 'is-success', label: '已出库' },
    90: { className: 'is-muted', label: '已作废' },
  };

const detailStatus = computed(
  () =>
    QUOTE_STATUS_META[Number(formData.value?.status)] || {
      className: 'is-muted',
      label: '未知状态',
    },
);

const detailItemCount = computed(() =>
  isRemoteItemPaging.value
    ? itemPageState.value.total
    : (formData.value?.items?.length ?? 0),
);

const detailProductAmount = computed(() => {
  if (formData.value?.totalProductPrice !== undefined) {
    return Number(formData.value.totalProductPrice || 0);
  }
  return (formData.value?.items ?? []).reduce(
    (sum, item) => sum + Number(item.totalPrice || 0),
    0,
  );
});

const detailDiscountAmount = computed(() =>
  Number(formData.value?.discountPrice ?? formData.value?.allowancePrice ?? 0),
);

const detailExtraCost = computed(() => {
  const labels: string[] = [];
  let amount = 0;
  if (isDetailFieldVisible('freightAmount')) {
    labels.push('运费');
    amount += Number(formData.value?.freightAmount || 0);
  }
  if (isDetailFieldVisible('feeAmount')) {
    labels.push('费用');
    amount += Number(
      formData.value?.feeAmount ?? formData.value?.otherPrice ?? 0,
    );
  }
  return { amount, label: labels.join('及') };
});

function isDetailFieldVisible(fieldName: string) {
  return !isFieldHidden(hiddenFields.value, fieldName);
}

function isDetailPriceFieldHidden(fieldName: string) {
  void fieldName;
  return false;
}

function formatDetailText(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  return String(value);
}

function formatDetailDate(value?: Date | number | string) {
  return value ? formatDateTime(value) || '-' : '-';
}

function formatDetailAmount(value?: number) {
  return `¥${formatSaleAmount(value || 0, '0.00')}`;
}

function formatDetailPriceAmount(fieldName: string, value?: number) {
  return isDetailPriceFieldHidden(fieldName)
    ? '****'
    : formatDetailAmount(value);
}

const hiddenCreateDefaults: Partial<ErpSaleQuoteApi.SaleQuote> = {
  priority: '正常件',
  deliveryMethod: '客户自提',
  invoiceType: '收据',
  billingMethod: '正常单',
  businessType: '普通销售',
  allowancePrice: 0,
  freightAmount: 0,
  feeAmount: 0,
  otherPrice: 0,
};

const showConvertCartBtn = computed(() => {
  return (
    formType.value !== 'create' &&
    !!formData.value?.id &&
    (formData.value.status === 20 || formData.value.status === 30) &&
    hasAccessByCodes(['erp:sale-quote:convert-cart'])
  );
});

const showApproveBtn = computed(() => {
  return (
    formType.value === 'detail' &&
    formData.value?.status === 10 &&
    !!formData.value?.id &&
    hasAccessByCodes(['erp:sale-quote:approve'])
  );
});

const showReverseOrderBtn = computed(() => {
  return (
    formType.value === 'detail' &&
    formData.value?.status === 20 &&
    !!formData.value?.id &&
    hasAccessByCodes(['erp:sale-quote:approve'])
  );
});

const showSubmitDraftBtn = computed(
  () =>
    formType.value === 'detail' &&
    formData.value?.status === 0 &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:sale-quote:create']),
);

const canEditFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    [0, 10, 90].includes(Number(formData.value?.status)) &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:sale-quote:update']),
);

const isEditingDraft = computed(
  () => formType.value === 'edit' && formData.value?.status === 0,
);

const canGenerateDraft = computed(
  () => formType.value === 'create' || isEditingDraft.value,
);

const generateDraftButtonText = computed(() =>
  isEditingDraft.value ? '保存草稿' : '生成草稿',
);

const canConfirmForm = computed(() => {
  if (formType.value === 'detail' || editLoadError.value) {
    return false;
  }
  return !isEditingDraft.value || hasAccessByCodes(['erp:sale-quote:create']);
});

const confirmText = computed(() =>
  isEditingDraft.value ? '确认提交' : '确定',
);

function canFocusBasicForm() {
  return canConfirmForm.value && !detailLoading.value && !detailLoadError.value;
}

function handleLastInputEnterConfirm(event: KeyboardEvent) {
  if (
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    !canConfirmForm.value
  ) {
    return;
  }
  event.preventDefault();
  void modalApi.onConfirm();
}

function focusFirstBasicFormControl() {
  if (!canFocusBasicForm()) {
    return;
  }
  const scope = basicFormRef.value;
  if (!scope) {
    return;
  }
  focusFirstEditableFormControl(scope);
}

async function queueFocusFirstBasicFormControl(sequence = formLoadSequence) {
  await nextTick();
  if (sequence !== formLoadSequence || !canFocusBasicForm()) {
    return;
  }
  queueAfterEditableControlRender(() => {
    if (sequence === formLoadSequence) {
      focusFirstBasicFormControl();
    }
  });
}

function handleBasicFormEnter(event: KeyboardEvent) {
  if (!canFocusBasicForm()) {
    return;
  }
  const scope = basicFormRef.value;
  if (!scope) {
    return;
  }
  focusNextEditableFormControlOnEnter(event, scope, {
    onLastControlEnter: handleLastInputEnterConfirm,
  });
}

const EMBEDDED_SECTION_FIELDS = new Set(['customerReceivableInfo', 'items']);

function buildBasicFormSchema(schema: VbenFormSchema[]) {
  return schema.filter((item) => !EMBEDDED_SECTION_FIELDS.has(item.fieldName));
}

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    labelClass: '!justify-start !text-left',
    labelWidth: 82,
  },
  compact: true,
  wrapperClass: 'sale-quote-basic-grid grid-cols-4',
  layout: 'horizontal',
  schema: buildBasicFormSchema(useFormSchema(formType.value)),
  showDefaultActions: false,
  handleValuesChange(values: any, changedFields) {
    if (isHydratingFormValues.value) return;
    const previousCustomerId = formData.value?.customerId;
    if (
      changedFields.includes('customerId') &&
      values.customerId !== previousCustomerId
    ) {
      if (!formData.value) {
        formData.value = {} as ErpSaleQuoteApi.SaleQuote;
      }
      formData.value.customerId = values.customerId;
      void loadCustomerSaleDeptOptions(values.customerId);
      void loadCustomerPriceLevel(values.customerId);
    }
    if (changedFields.includes('deptId') && !saleDeptSyncing) {
      if (!formData.value) {
        formData.value = {} as ErpSaleQuoteApi.SaleQuote;
      }
      formData.value.deptId = values.deptId;
    }
    if (values.priceType !== undefined) {
      currentPriceType.value = values.priceType;
    }
    if (formData.value && changedFields.includes('feeAmount')) {
      const feeAmount = toOptionalNumberValue(values.feeAmount) ?? 0;
      formData.value.feeAmount = feeAmount;
      formData.value.otherPrice = feeAmount;
    }
  },
});

async function applyFormMode(
  type: string,
  customerData: ErpSaleQuoteApi.SaleQuote | undefined = formData.value,
) {
  formType.value = type;
  modalApi.setState({ fullscreen: true });
  formApi.setDisabled(type === 'detail');
  if (type !== 'detail') {
    await refreshFormSchema(customerData);
  }
  await nextTick();
}

async function refreshFormSchema(
  customerData: ErpSaleQuoteApi.SaleQuote | undefined = formData.value,
) {
  const hydratedCustomerData =
    await hydrateCurrentSaleFormSelectNames(customerData);
  const baseSchema = useFormSchema(
    formType.value,
    hiddenFields.value,
    saleDeptOptions.value,
  );
  const configuredSchema = await applyFieldConfig(baseSchema, 'sale_quote');
  formApi.setState({
    schema: buildBasicFormSchema(
      withCurrentSaleFormSelectOptions(
        applyFieldPermission(configuredSchema, hiddenFields.value),
        hydratedCustomerData,
        formType.value,
      ),
    ),
  });
}

type SaleDeptFieldRef = {
  updateParam?: (newParams: Record<string, any>) => void;
};

function updateDeptFieldCustomerParam(customerId?: number) {
  formApi
    .getFieldComponentRef<SaleDeptFieldRef>('deptId')
    ?.updateParam?.(customerId ? { customerId } : {});
}

async function loadCustomerSaleDeptOptions(
  customerId?: number,
  preferredDeptId?: number,
) {
  if (hiddenFields.value.includes('deptId')) {
    return;
  }
  const seq = ++saleDeptLoadSeq;
  saleDeptSyncing = true;
  try {
    const preservedValues =
      (await formApi.getValues()) as ErpSaleQuoteApi.SaleQuote;
    updateDeptFieldCustomerParam(customerId);
    if (!customerId) {
      saleDeptOptions.value = [];
      formApi.updateSchema([
        {
          fieldName: 'deptId',
          componentProps: { options: [] },
        },
      ]);
      if (formData.value) {
        formData.value.customerId = undefined;
        formData.value.deptId = undefined;
      }
      await formApi.setValues({
        ...preservedValues,
        customerId: undefined,
        deptId: undefined,
      });
      return;
    }

    const page = await getSaleQuoteCustomerDeptSimplePage({
      customerId,
      pageNo: 1,
      pageSize: 10,
    });
    if (seq !== saleDeptLoadSeq) {
      return;
    }
    saleDeptOptions.value = page?.list || [];
    formApi.updateSchema([
      {
        fieldName: 'deptId',
        componentProps: { options: saleDeptOptions.value },
      },
    ]);
    await nextTick();
    if (seq !== saleDeptLoadSeq) {
      return;
    }
    const userDeptId = userStore.userInfo?.deptId;
    const deptId =
      saleDeptOptions.value.find((dept) => dept.id === preferredDeptId)?.id ??
      saleDeptOptions.value.find((dept) => dept.id === formData.value?.deptId)
        ?.id ??
      saleDeptOptions.value.find((dept) => dept.id === userDeptId)?.id ??
      saleDeptOptions.value[0]?.id;
    formData.value = formData.value || {};
    formData.value.customerId = customerId;
    formData.value.deptId = deptId;
    await formApi.setValues({
      ...preservedValues,
      customerId,
      deptId,
    });
  } finally {
    if (seq === saleDeptLoadSeq) {
      saleDeptSyncing = false;
    }
  }
}

async function loadCustomerPriceLevel(customerId?: number) {
  if (!customerId) {
    currentCustomerPriceLevel.value = undefined;
    return;
  }
  try {
    currentCustomerPriceLevel.value =
      await getCustomerSalePriceLevel(customerId);
  } catch {
    currentCustomerPriceLevel.value = undefined;
    message.warning('客户价格级别加载失败，售价将按默认价格显示');
  }
}

async function handleUpdateItems(items: ErpSaleQuoteApi.SaleQuoteItem[]) {
  const mutationSequence = ++itemMutationSequence;
  const snapshot = {
    creates: new Map(remoteItemCreates),
    deletes: new Set(remoteItemDeletes),
    edits: new Map(remoteItemEdits),
    items: [...(formData.value?.items ?? [])],
    pageState: { ...itemPageState.value },
    persistedTotal: remotePersistedItemTotal,
    persistedTotalKnown: remotePersistedItemTotalKnown,
  };
  const previousDeleteCount = remoteItemDeletes.size;
  const previousCreateKeys = new Set(remoteItemCreates.keys());
  try {
    recordRemoteItemChanges(items);
    formData.value = formData.value || {};
    formData.value.items = isRemoteItemPaging.value
      ? applyRemoteItemCache(items.filter((item) => Boolean(item.id)))
      : items;
    formApi.setValues({ items: formData.value.items });
    if (!isRemoteItemPaging.value) return;
    const addedCreateKeys = [...remoteItemCreates.keys()].filter(
      (key) => !previousCreateKeys.has(key),
    );
    const replacedBlankCreateKey = [...previousCreateKeys].find(
      (key) =>
        !snapshot.creates.get(key)?.productId &&
        Boolean(remoteItemCreates.get(key)?.productId),
    );
    const localBusinessKeys = new Set<string>();
    let localDuplicateCount = 0;
    [...remoteItemCreates.entries()].forEach(([localKey, item]) => {
      if (!item.productId) return;
      const businessKey = [
        item.productId,
        item.warehouseId ?? '',
        item.batchNo?.trim() ?? '',
        Boolean(item.giftFlag),
      ].join('|');
      if (localBusinessKeys.has(businessKey)) {
        remoteItemCreates.delete(localKey);
        localDuplicateCount += 1;
      } else {
        localBusinessKeys.add(businessKey);
      }
    });
    if (localDuplicateCount > 0) {
      itemPageState.value.total = getRemoteItemTotal(
        remotePersistedItemTotal,
        remoteItemCreates.size,
      );
      message.warning(`已阻止 ${localDuplicateCount} 条新增重复明细`);
    }
    const matchCandidates = addedCreateKeys
      .map((key) => [key, remoteItemCreates.get(key)] as const)
      .filter(
        (entry): entry is readonly [string, ErpSaleQuoteApi.SaleQuoteItem] =>
          Boolean(entry[1]?.productId),
      );
    let firstMatchedItemId: number | undefined;
    let firstMatchedPageNo: number | undefined;
    if (matchCandidates.length > 0 && formData.value.id) {
      const matchResult = await matchSaleQuoteItems({
        documentId: formData.value.id,
        excludedItemIds: [...remoteItemDeletes],
        keys: matchCandidates.map(([, item]) => ({
          batchNo: item.batchNo,
          giftFlag: Boolean(item.giftFlag),
          productId: item.productId,
          warehouseId: item.warehouseId,
        })),
        pageSize: itemPageState.value.pageSize,
      });
      if (mutationSequence !== itemMutationSequence) return;
      matchResult.matches.forEach((match) => {
        const localKey = matchCandidates[match.keyIndex]?.[0];
        if (localKey) remoteItemCreates.delete(localKey);
      });
      firstMatchedItemId = matchResult.matches[0]?.itemId;
      firstMatchedPageNo = matchResult.matches[0]?.pageNo;
      if (matchResult.matches.length > 0) {
        itemPageState.value.total = getRemoteItemTotal(
          remotePersistedItemTotal,
          remoteItemCreates.size,
        );
        message.warning(`已阻止 ${matchResult.matches.length} 条整单重复明细`);
      }
    }
    formData.value.items = applyRemoteItemCache(
      items.filter((item) => Boolean(item.id)),
    );
    formApi.setValues({ items: formData.value.items });
    const firstRemainingAddedKey = addedCreateKeys.find((key) =>
      remoteItemCreates.has(key),
    );
    if (
      replacedBlankCreateKey &&
      remoteItemCreates.has(replacedBlankCreateKey)
    ) {
      await loadSaleQuoteItemPage({
        orderDirection: undefined,
        orderField: undefined,
        pageNo: snapshot.pageState.pageNo,
      });
      await focusRemoteItemByKey(replacedBlankCreateKey, 'count');
    } else if (firstRemainingAddedKey) {
      await loadSaleQuoteItemPage({
        orderDirection: undefined,
        orderField: undefined,
        pageNo: clampRemoteItemPageNo(
          Number.MAX_SAFE_INTEGER,
          itemPageState.value.pageSize,
          itemPageState.value.total,
        ),
      });
      await focusRemoteItemByKey(
        firstRemainingAddedKey,
        remoteItemCreates.get(firstRemainingAddedKey)?.productId
          ? 'count'
          : 'product',
      );
    } else if (addedCreateKeys.length > 0 && firstMatchedPageNo) {
      await loadSaleQuoteItemPage({
        orderDirection: undefined,
        orderField: undefined,
        pageNo: firstMatchedPageNo,
      });
      await focusRemoteItemByKey(
        itemRowKeyManager.ensureRowKey({ id: firstMatchedItemId }),
      );
    } else if (remoteItemDeletes.size > previousDeleteCount) {
      await loadSaleQuoteItemPage({
        pageNo: clampRemoteItemPageNo(
          itemPageState.value.pageNo,
          itemPageState.value.pageSize,
          itemPageState.value.total,
        ),
      });
    }
  } catch {
    if (mutationSequence !== itemMutationSequence) return;
    remoteItemCreates.clear();
    snapshot.creates.forEach((value, key) => remoteItemCreates.set(key, value));
    remoteItemEdits.clear();
    snapshot.edits.forEach((value, key) => remoteItemEdits.set(key, value));
    remoteItemDeletes.clear();
    snapshot.deletes.forEach((value) => remoteItemDeletes.add(value));
    remotePersistedItemTotal = snapshot.persistedTotal;
    remotePersistedItemTotalKnown = snapshot.persistedTotalKnown;
    itemPageState.value = snapshot.pageState;
    formData.value = formData.value || {};
    formData.value.items = snapshot.items;
    await formApi.setValues({ items: snapshot.items });
    message.error('明细处理失败，已恢复操作前状态，请重试');
  }
}

function handleUpdateSummary(summary: {
  totalCount: number;
  totalPrice: number;
  totalProductPrice: number;
  totalTaxPrice: number;
}) {
  // 远程分页时子表只持有当前页，不能用页小计覆盖主表的整单汇总。
  if (isRemoteItemPaging.value) {
    return;
  }
  formData.value = {
    ...formData.value,
    ...summary,
  } as ErpSaleQuoteApi.SaleQuote;
  formApi.setValues(summary);
}

function handleImport() {
  importFormModalApi
    .setData({
      title: '导入报价产品明细',
      templateFileName: '报价订单明细导入模板.xls',
      importRequest: importSaleQuote,
      exportTemplateRequest: exportSaleQuoteImportTemplate,
      templateGuideSummary:
        '报价明细导入模板用于解析当前报价单明细，上传后系统会按产品、仓库、数量、价格、赠品及备注等字段回填到当前表单。',
      templateGuideTips: [
        '配件编码、配件名称、厂家编码是三选一字段：填写其中任意一个即可；如果多列都填，必须对应同一配件。',
        '仓库、数量、单价、赠品等明细字段请按模板示例填写。',
      ],
    })
    .open();
}

function handleImportSuccess(data: SaleQuoteImportResp) {
  resetRemoteItemState();
  const importValues = {
    items: data.items ?? [],
  } as ErpSaleQuoteApi.SaleQuote;
  formData.value = {
    ...formData.value,
    ...importValues,
  };
  formApi.setValues(importValues);
}

async function handleConvertCart() {
  if (!formData.value?.id) return;
  convertCartModalRef.value?.open(formData.value.id, hiddenFields.value);
}

async function handleCopy() {
  if (!formData.value?.id) return;
  const copyData = buildSaleCopyDraft(
    {
      ...formData.value,
      items: await loadAllSaleQuoteItems(formData.value.id, { mask: false }),
    },
    {
      extraCleanKeys: ['generatedSaleOutNo'],
      extraItemCleanKeys: ['quoteId', 'convertedCount'],
    },
  );
  copyData.quoteTime = getCurrentTimestamp();
  resetRemoteItemState();
  await applyFormMode('create');
  currentPriceType.value = copyData.priceType;
  formData.value = copyData;
  await loadCustomerPriceLevel(copyData.customerId);
  await loadCustomerSaleDeptOptions(copyData.customerId, copyData.deptId);
  copyData.deptId = formData.value?.deptId;
  await formApi.setValues(copyData);
  const sequence = ++formLoadSequence;
  void queueFocusFirstBasicFormControl(sequence);
}

async function handleApprove() {
  if (!formData.value?.id) return;
  modalApi.lock();
  try {
    await approveSaleQuote(formData.value.id);
    message.success('下订成功');
    formData.value = {
      ...(await getSaleQuote(formData.value.id, {
        includeItems: false,
        mask: formType.value === 'detail',
      })),
      items: [],
    };
    currentPriceType.value = formData.value.priceType;
    await loadCustomerPriceLevel(formData.value.customerId);
    await formApi.setValues(
      buildSaleDocumentDetailFormValues(formData.value, formType.value),
    );
    resetRemoteItemState();
    await loadSaleQuoteItemPage({ pageNo: 1 });
    emit('success');
  } finally {
    modalApi.unlock();
  }
}

function handleReverseOrder() {
  if (!formData.value?.id) return;
  const quoteId = formData.value.id;
  const quoteNo = formData.value.no;
  AntdModal.confirm({
    title: `确认反下订报价订单${quoteNo ? ` ${quoteNo}` : ''}吗？`,
    content: '只有尚未生成销售手推车的报价订单可以反下订。',
    async onOk() {
      modalApi.lock();
      try {
        await reverseOrderSaleQuote(quoteId);
        await reloadSaleQuoteDetail();
        emit('success');
        message.success('反下订成功');
      } finally {
        modalApi.unlock();
      }
    },
  });
}

function handleSubmitDraft() {
  if (!formData.value?.id) return;
  const quoteId = formData.value.id;
  const quoteNo = formData.value.no;
  AntdModal.confirm({
    title: `确认提交报价订单${quoteNo ? ` ${quoteNo}` : ''}吗？`,
    content: '提交后将进入待下订状态，不能再按草稿方式修改。',
    async onOk() {
      modalApi.lock();
      try {
        await submitSaleQuote(quoteId);
        skipDraftOnClose = true;
        await modalApi.close();
        emit('success');
        message.success('报价订单已提交，下一步可进行下订');
      } finally {
        modalApi.unlock();
      }
    },
  });
}

function handleConvertCartSuccess() {
  modalApi.close();
  emit('success');
}

function normalizeImportData(importData?: SaleQuoteImportResp) {
  return {
    items: importData?.items ?? [],
  } as ErpSaleQuoteApi.SaleQuote;
}

function normalizeHiddenAmountFields(data: ErpSaleQuoteApi.SaleQuote) {
  if (data.allowancePrice !== undefined) {
    data.allowancePrice = toOptionalNumberValue(data.allowancePrice);
  }
  if (data.freightAmount !== undefined) {
    data.freightAmount = toOptionalNumberValue(data.freightAmount);
  }
  if (data.feeAmount !== undefined || data.otherPrice !== undefined) {
    data.feeAmount = toOptionalNumberValue(data.feeAmount ?? data.otherPrice);
    data.otherPrice = data.feeAmount;
  }
}

function normalizeLoadedSaleQuote(sourceData: ErpSaleQuoteApi.SaleQuote) {
  normalizeHiddenAmountFields(sourceData);
  return sourceData;
}

async function reloadSaleQuoteDetail() {
  if (!formData.value?.id) return;
  formData.value = normalizeLoadedSaleQuote(
    await getSaleQuote(formData.value.id, {
      includeItems: !isRemoteItemPaging.value,
      mask: formType.value === 'detail',
    }),
  );
  if (isRemoteItemPaging.value) {
    formData.value.items = [];
  }
  currentPriceType.value = formData.value.priceType;
  await loadCustomerPriceLevel(formData.value.customerId);
  await formApi.setValues(
    buildSaleDocumentDetailFormValues(formData.value, formType.value),
  );
  if (isRemoteItemPaging.value) {
    await loadSaleQuoteItemPage({ pageNo: itemPageState.value.pageNo });
  }
  await nextTick();
  await getItemFormInstance()?.reloadItemsFromProps?.();
  await getItemFormInstance()?.waitForItemsReady?.();
}

function getItemFormInstance() {
  return Array.isArray(itemFormRef.value)
    ? itemFormRef.value[0]
    : itemFormRef.value;
}

async function focusRemoteItemByKey(
  rowKey?: string,
  field: 'count' | 'product' = 'count',
) {
  if (!rowKey) return false;
  await nextTick();
  return getItemFormInstance()?.focusItemByRowKey?.(rowKey, field) ?? false;
}

function resetRemoteItemState() {
  itemRowKeyManager.reset();
  itemPageLoadSequence += 1;
  itemMutationSequence += 1;
  remotePersistedItemTotal = 0;
  remotePersistedItemTotalKnown = false;
  remoteItemEdits.clear();
  remoteItemDeletes.clear();
  remoteItemCreates.clear();
  remoteItemOriginals.clear();
  itemPageState.value = {
    orderDirection: undefined,
    orderField: undefined,
    pageNo: 1,
    pageSize: DEFAULT_ITEM_PAGE_SIZE,
    total: 0,
  };
}

function normalizeRemoteComparableValue(value: unknown): unknown {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeRemoteComparableValue);
  }
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .toSorted()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = normalizeRemoteComparableValue(source[key]);
        return result;
      }, {});
  }
  return value;
}

function normalizeRemoteItemForCompare(item: ErpSaleQuoteApi.SaleQuoteItem) {
  const source = item as Record<string, unknown>;
  return Object.keys(source)
    .toSorted()
    .reduce<Record<string, unknown>>((result, key) => {
      if (!REMOTE_ITEM_COMPARE_IGNORED_FIELDS.has(key)) {
        result[key] = normalizeRemoteComparableValue(source[key]);
      }
      return result;
    }, {});
}

function isSameRemoteItem(
  current: ErpSaleQuoteApi.SaleQuoteItem,
  original?: ErpSaleQuoteApi.SaleQuoteItem,
) {
  if (!original) {
    return false;
  }
  return (
    JSON.stringify(normalizeRemoteItemForCompare(current)) ===
    JSON.stringify(normalizeRemoteItemForCompare(original))
  );
}

function rememberRemoteItemOriginals(rows: ErpSaleQuoteApi.SaleQuoteItem[]) {
  rows.forEach((item) => {
    if (item.id) {
      remoteItemOriginals.set(item.id, { ...item });
    }
  });
}

function getRemoteLocalItemKey(item: ErpSaleQuoteApi.SaleQuoteItem) {
  return itemRowKeyManager.ensureRowKey(item);
}

function applyRemoteItemCache(rows: ErpSaleQuoteApi.SaleQuoteItem[] = []) {
  itemRowKeyManager.ensureRowKeys(rows);
  const persistedRows = rows
    .filter((item) => !item.id || !remoteItemDeletes.has(item.id))
    .map((item) => (item.id && remoteItemEdits.get(item.id)) || item);
  return itemRowKeyManager.ensureRowKeys(
    composeRemoteItemPage({
      createdRows: [...remoteItemCreates.values()],
      pageNo: itemPageState.value.pageNo,
      pageSize: itemPageState.value.pageSize,
      persistedRows,
      persistedTotal: remotePersistedItemTotal,
    }),
  );
}

function recordRemoteItemChanges(rows: ErpSaleQuoteApi.SaleQuoteItem[]) {
  if (!isRemoteItemPaging.value) {
    return;
  }
  itemRowKeyManager.ensureRowKeys(rows);
  const previousDeleteCount = remoteItemDeletes.size;
  const previousRows = formData.value?.items ?? [];
  const nextIds = new Set(rows.map((item) => item.id).filter(Boolean));
  const nextLocalKeys = new Set(
    rows.filter((item) => !item.id).map(getRemoteLocalItemKey),
  );
  previousRows.forEach((item) => {
    if (item.id && !nextIds.has(item.id)) {
      remoteItemDeletes.add(item.id);
      remoteItemEdits.delete(item.id);
      return;
    }
    if (!item.id) {
      const key = getRemoteLocalItemKey(item);
      if (!nextLocalKeys.has(key)) {
        remoteItemCreates.delete(key);
      }
    }
  });
  rows.forEach((item) => {
    if (item.id) {
      remoteItemDeletes.delete(item.id);
      if (isSameRemoteItem(item, remoteItemOriginals.get(item.id))) {
        remoteItemEdits.delete(item.id);
        return;
      }
      remoteItemEdits.set(item.id, { ...item });
      return;
    }
    remoteItemCreates.set(getRemoteLocalItemKey(item), { ...item });
  });
  remotePersistedItemTotal = Math.max(
    0,
    remotePersistedItemTotal - (remoteItemDeletes.size - previousDeleteCount),
  );
  itemPageState.value.total = getRemoteItemTotal(
    remotePersistedItemTotal,
    remoteItemCreates.size,
  );
}

async function loadSaleQuoteItemPage(
  options: {
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    pageNo?: number;
    pageSize?: number;
  } = {},
) {
  if (!formData.value?.id) {
    formData.value = formData.value ?? {};
    formData.value.items = [];
    return;
  }
  const requestSequence = ++itemPageLoadSequence;
  itemPageLoading.value = true;
  try {
    const nextState = {
      ...itemPageState.value,
      ...options,
      pageNo: options.pageNo ?? itemPageState.value.pageNo,
      pageSize: options.pageSize ?? itemPageState.value.pageSize,
    };
    if (remoteItemCreates.size > 0) {
      nextState.orderField = undefined;
      nextState.orderDirection = undefined;
    }
    const total = getRemoteItemTotal(
      remotePersistedItemTotal,
      remoteItemCreates.size,
    );
    nextState.pageNo = clampRemoteItemPageNo(
      nextState.pageNo,
      nextState.pageSize,
      total,
    );
    if (
      remotePersistedItemTotalKnown &&
      !pageHasPersistedRows(
        nextState.pageNo,
        nextState.pageSize,
        remotePersistedItemTotal,
      )
    ) {
      if (requestSequence !== itemPageLoadSequence) return;
      itemPageState.value = { ...nextState, total };
      formData.value.items = applyRemoteItemCache([]);
      return;
    }
    const request = {
      excludedItemIds: [...remoteItemDeletes],
      mask: formType.value === 'detail',
      orderDirection: nextState.orderDirection,
      orderField: nextState.orderField,
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
      quoteId: formData.value.id,
    };
    const result = await (formType.value === 'edit'
      ? getSaleQuoteEditItemPage(request)
      : getSaleQuoteItemPage(request));
    if (requestSequence !== itemPageLoadSequence) return;
    remotePersistedItemTotal = result.total ?? 0;
    remotePersistedItemTotalKnown = true;
    itemPageState.value = {
      ...nextState,
      total: getRemoteItemTotal(
        remotePersistedItemTotal,
        remoteItemCreates.size,
      ),
    };
    rememberRemoteItemOriginals(result.list ?? []);
    formData.value.items = applyRemoteItemCache(result.list ?? []);
    await nextTick();
    await getItemFormInstance()?.reloadItemsFromProps?.();
  } finally {
    if (requestSequence === itemPageLoadSequence) {
      itemPageLoading.value = false;
    }
  }
}

async function loadAllSaleQuoteItems(
  quoteId: number,
  options: { mask?: boolean } = {},
) {
  const pageSize = 200;
  const firstPage = await getSaleQuoteItemPage({
    mask: options.mask ?? false,
    pageNo: 1,
    pageSize,
    quoteId,
  });
  const rows = [...(firstPage.list ?? [])];
  const total = firstPage.total ?? rows.length;
  const pageCount = Math.ceil(total / pageSize);
  for (let pageNo = 2; pageNo <= pageCount; pageNo++) {
    const page = await getSaleQuoteItemPage({
      mask: options.mask ?? false,
      pageNo,
      pageSize,
      quoteId,
    });
    rows.push(...(page.list ?? []));
  }
  return rows;
}

async function buildMergedRemoteItemsForSubmit(
  options: { draft?: boolean } = {},
) {
  const itemFormInstance = getItemFormInstance();
  if (!isRemoteItemPaging.value || !formData.value?.id) {
    return (
      (options.draft
        ? itemFormInstance?.getDraftItems?.()
        : itemFormInstance?.getSubmitItems?.()) ??
      formData.value?.items ??
      []
    );
  }
  recordRemoteItemChanges(
    itemFormInstance?.getDraftItems?.() ?? formData.value.items ?? [],
  );
  const updateItems = [...remoteItemEdits.values()].map((item) => ({
    ...stripSaleItemClientFields(item),
    operation: 'update' as const,
  }));
  const insertItems = [...remoteItemCreates.values()].map((item) => {
    const next = { ...item };
    delete next.id;
    delete next.quoteId;
    delete next.seq;
    delete next.clientRowKey;
    delete next.operation;
    return {
      ...next,
      operation: 'insert' as const,
    };
  });
  const deleteItems = [...remoteItemDeletes].map((id) => ({
    id,
    operation: 'delete' as const,
  }));
  return [...updateItems, ...insertItems, ...deleteItems];
}

async function buildCurrentSaleQuotePayload(options: { draft?: boolean } = {}) {
  const formValues = (await formApi.getValues()) as ErpSaleQuoteApi.SaleQuote;
  const data = {
    ...(formType.value === 'create' ? hiddenCreateDefaults : {}),
    ...formData.value,
    ...formValues,
  } as ErpSaleQuoteApi.SaleQuote;
  normalizeHiddenAmountFields(data);
  data.totalCount = toOptionalNumberValue(data.totalCount);
  data.totalProductPrice = toOptionalNumberValue(data.totalProductPrice);
  data.totalTaxPrice = toOptionalNumberValue(data.totalTaxPrice);
  data.totalPrice = toOptionalNumberValue(data.totalPrice);
  data.items = (await buildMergedRemoteItemsForSubmit(options)).map(
    (item: ErpSaleQuoteApi.SaleQuoteItem) => stripSaleItemClientFields(item),
  );
  delete (data as unknown as Record<string, unknown>).customerReceivableInfo;
  return data;
}

async function saveSaleQuoteDraft(
  isCreatingDraft: boolean,
  options: { explicit?: boolean } = {},
) {
  if (draftSaving) {
    return false;
  }

  draftSaving = true;
  modalApi.lock();
  try {
    const data = await buildCurrentSaleQuotePayload({ draft: true });
    if (
      isCreatingDraft &&
      !hasValidSaleDraftItems(data.items ?? [], { priceMode: 'none' })
    ) {
      draftSaved = !options.explicit;
      message.warning('未选择明细，不生成草稿');
      return !options.explicit;
    }
    if (isCreatingDraft) {
      await createSaleQuoteDraft(data);
    } else {
      data.id = formData.value!.id;
      await updateSaleQuoteDraft(data);
    }
    draftSaved = true;
    if (options.explicit) {
      skipDraftOnClose = true;
    }
    message.success(
      options.explicit
        ? isCreatingDraft
          ? '草稿生成成功'
          : '草稿保存成功'
        : isCreatingDraft
          ? '未提交内容已自动保存为草稿'
          : '草稿修改已自动保存',
    );
    emit('success');
    if (options.explicit) {
      await modalApi.close();
    }
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
  if (!canGenerateDraft.value) return;
  await saveSaleQuoteDraft(formType.value === 'create', { explicit: true });
}

async function switchDetailToEdit(initialData?: ErpSaleQuoteApi.SaleQuote) {
  if (!initialData?.id) return;
  const quoteId = initialData.id;
  const sequence = ++formLoadSequence;
  detailLoadSequence += 1;
  detailLoading.value = true;
  detailLoadError.value = '';
  editLoadError.value = '';
  skipDraftOnClose = false;
  draftSaved = false;
  draftSaving = false;
  isHydratingFormValues.value = true;
  modalApi.lock();
  try {
    const [sourceData] = await Promise.all([
      getSaleQuote(quoteId, { includeItems: false, mask: false }),
      loadHiddenFields(),
    ]);
    if (sequence !== formLoadSequence) return;
    const loadedData = hydrateSaleCustomerFromFallback(
      normalizeLoadedSaleQuote(sourceData),
      initialData,
    );
    loadedData.items = [];
    resetRemoteItemState();
    await applyFormMode('edit', loadedData);
    if (sequence !== formLoadSequence) return;
    await formApi.resetForm();
    formData.value = loadedData;
    currentPriceType.value = formData.value.priceType;
    await loadCustomerPriceLevel(formData.value.customerId);
    await loadCustomerSaleDeptOptions(
      formData.value.customerId,
      formData.value.deptId,
    );
    if (sequence !== formLoadSequence) return;
    await formApi.setValues(
      buildSaleDocumentDetailFormValues(formData.value, formType.value),
      false,
    );
    await loadSaleQuoteItemPage({ pageNo: 1 });
    await nextTick();
    if (sequence !== formLoadSequence) return;
    await getItemFormInstance()?.waitForItemsReady?.();
  } catch {
    if (sequence === formLoadSequence) {
      editLoadError.value = '报价订单草稿加载失败，请关闭页面后重新进入';
    }
  } finally {
    if (sequence === formLoadSequence) {
      detailLoading.value = false;
      isHydratingFormValues.value = false;
      modalApi.unlock();
      void queueFocusFirstBasicFormControl(sequence);
    }
  }
}

async function handleEditFromDetail() {
  if (!canEditFromDetail.value) return;
  await switchDetailToEdit(formData.value);
}

async function loadDetailData(id: number, sequence: number) {
  try {
    const [sourceData] = await Promise.all([
      getSaleQuote(id, { includeItems: false, mask: true }),
      loadHiddenFields(),
    ]);
    if (sequence !== detailLoadSequence) {
      return;
    }
    formData.value = normalizeLoadedSaleQuote(sourceData);
    formData.value.items = [];
    resetRemoteItemState();
    currentPriceType.value = formData.value.priceType;
    await loadCustomerPriceLevel(formData.value.customerId);
    await loadSaleQuoteItemPage({ pageNo: 1 });
  } catch {
    if (sequence === detailLoadSequence) {
      detailLoadError.value = reportViewOnly
        ? '单据已删除、不可用或无权访问，请关闭后重试'
        : '详情加载失败，请关闭后重试';
    }
  } finally {
    if (sequence === detailLoadSequence) {
      detailLoading.value = false;
    }
  }
}

const [Modal, modalApi] = useVbenModal({
  async onBeforeClose() {
    const isCreatingDraft = formType.value === 'create';
    const isUpdatingDraft = isEditingDraft.value && Boolean(formData.value?.id);
    if (
      (!isCreatingDraft && !isUpdatingDraft) ||
      skipDraftOnClose ||
      draftSaved
    ) {
      return true;
    }
    return saveSaleQuoteDraft(isCreatingDraft);
  },
  async onCancel() {
    skipDraftOnClose = true;
    await modalApi.close();
  },
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const itemFormInstance = getItemFormInstance();
    let data: ErpSaleQuoteApi.SaleQuote;
    try {
      data = await buildCurrentSaleQuotePayload();
      if (
        isRemoteItemPaging.value &&
        formData.value?.id &&
        itemPageState.value.total <= 0
      ) {
        throw new Error('请先添加报价产品');
      }
      itemFormInstance?.validate(
        (data.items ?? []).filter((item) => item.operation !== 'delete'),
        { requireItems: !isRemoteItemPaging.value },
      );
    } catch (error: any) {
      message.error(error.message || '子表单校验失败');
      return;
    }

    modalApi.lock();
    const shouldSubmitDraft = isEditingDraft.value;
    const editingQuoteId = formData.value?.id;
    try {
      if (formType.value === 'create') {
        await createSaleQuote(data);
      } else if (shouldSubmitDraft) {
        if (!editingQuoteId) {
          message.error('报价订单编号缺失，请关闭后重新打开再试');
          return;
        }
        await updateSaleQuoteDraft(data);
        await submitSaleQuote(editingQuoteId);
      } else {
        await updateSaleQuote(data);
      }
      skipDraftOnClose = true;
      await modalApi.close();
      emit('success');
      message.success(
        shouldSubmitDraft
          ? '报价订单已提交，下一步可进行下订'
          : $t('ui.actionMessage.operationSuccess'),
      );
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    isSaleQuoteFormOpen.value = isOpen;
    if (!isOpen) {
      detailLoadSequence += 1;
      formLoadSequence += 1;
      saleDeptLoadSeq += 1;
      saleDeptSyncing = false;
      isHydratingFormValues.value = false;
      detailLoading.value = false;
      detailLoadError.value = '';
      editLoadError.value = '';
      formData.value = undefined;
      resetRemoteItemState();
      currentPriceType.value = undefined;
      currentCustomerPriceLevel.value = undefined;
      saleDeptOptions.value = [];
      return;
    }
    const data = modalApi.getData<{
      id?: number;
      importData?: SaleQuoteImportResp;
      initialData?: ErpSaleQuoteApi.SaleQuote;
      type: string;
    }>();
    skipDraftOnClose = false;
    draftSaved = false;
    draftSaving = false;
    const isCopy = data.type === 'copy';
    editLoadError.value = '';

    if (data.type === 'detail' && data.id) {
      await applyFormMode('detail');
      detailLoading.value = true;
      detailLoadError.value = '';
      formData.value = undefined;
      const sequence = ++detailLoadSequence;
      void loadDetailData(data.id, sequence);
      return;
    }

    const sequence = ++formLoadSequence;
    modalApi.lock();
    try {
      await loadHiddenFields();
      if (sequence !== formLoadSequence) return;
      await applyFormMode(isCopy ? 'create' : data.type, data.initialData);
      if (sequence !== formLoadSequence) return;
      await formApi.resetForm();

      if (!data.id) {
        resetRemoteItemState();
        const userInfo = userStore.userInfo;
        saleDeptOptions.value = [];
        saleDeptLoadSeq += 1;
        const importValues = normalizeImportData(data.importData);
        const createValues = {
          quoteTime: getCurrentTimestamp(),
          ...importValues,
        };
        const defaultUserValues = buildSaleCurrentUserFormDefaults(userInfo, [
          'saleUserId',
        ]);
        formData.value = {
          ...hiddenCreateDefaults,
          ...createValues,
          ...defaultUserValues,
        };
        await refreshFormSchema(formData.value);
        currentPriceType.value = undefined;
        currentCustomerPriceLevel.value = undefined;
        await formApi.setValues({
          ...formData.value,
          deptId: undefined,
        });
        void queueFocusFirstBasicFormControl(sequence);
        return;
      }

      isHydratingFormValues.value = true;
      const sourceData = normalizeLoadedSaleQuote(
        await getSaleQuote(data.id, {
          includeItems: isCopy,
          mask: false,
        }),
      );
      if (sequence !== formLoadSequence) return;
      formData.value = isCopy
        ? buildSaleCopyDraft(sourceData, {
            extraCleanKeys: ['generatedSaleOutNo'],
            extraItemCleanKeys: ['quoteId', 'convertedCount'],
          })
        : hydrateSaleCustomerFromFallback(sourceData, data.initialData);
      if (isCopy) {
        formData.value.quoteTime = getCurrentTimestamp();
        resetRemoteItemState();
      } else {
        formData.value.items = [];
        resetRemoteItemState();
      }
      currentPriceType.value = formData.value.priceType;
      await loadCustomerPriceLevel(formData.value.customerId);
      await loadCustomerSaleDeptOptions(
        formData.value.customerId,
        formData.value.deptId,
      );
      if (sequence !== formLoadSequence) return;
      await formApi.setValues(
        buildSaleDocumentDetailFormValues(formData.value, formType.value),
      );
      if (!isCopy) {
        await loadSaleQuoteItemPage({ pageNo: 1 });
      }
      await nextTick();
      if (sequence !== formLoadSequence) return;
      await getItemFormInstance()?.waitForItemsReady?.();
    } catch {
      if (sequence === formLoadSequence) {
        formData.value = undefined;
        editLoadError.value =
          data.id && !isCopy
            ? '报价订单草稿加载失败，请关闭页面后重新进入'
            : '报价订单加载失败，请关闭页面后重新进入';
      }
    } finally {
      if (sequence === formLoadSequence) {
        isHydratingFormValues.value = false;
        modalApi.unlock();
        void queueFocusFirstBasicFormControl(sequence);
      }
    }
  },
});

async function handleItemPageChange(payload: {
  orderDirection?: 'asc' | 'desc';
  orderField?: string;
  pageNo?: number;
  pageSize?: number;
}) {
  recordRemoteItemChanges(
    getItemFormInstance()?.getDraftItems?.() ?? formData.value?.items ?? [],
  );
  await loadSaleQuoteItemPage(payload);
}
</script>

<template>
  <Modal
    :title="getTitle"
    class="!w-full"
    bordered
    content-class="p-0"
    :confirm-text="confirmText"
    :show-confirm-button="canConfirmForm"
  >
    <template #title>
      <div class="sale-quote-detail-title">
        <div class="sale-quote-detail-title__text">
          <span>{{ getTitle }}</span>
          <small
            v-if="
              formType !== 'create' &&
              formData?.no &&
              isDetailFieldVisible('no')
            "
          >
            {{ formatDetailText(formData?.no) }}
          </small>
        </div>
        <span
          v-if="
            formType !== 'create' &&
            formData?.status !== undefined &&
            isDetailFieldVisible('status')
          "
          class="sale-quote-status"
          :class="detailStatus.className"
        >
          {{ detailStatus.label }}
        </span>
      </div>
    </template>

    <div
      class="sale-quote-detail-view"
      :class="{ 'erp-form-focus-highlight': formType !== 'detail' }"
    >
      <div
        v-if="formType === 'detail' && detailLoading"
        class="sale-quote-detail-load-state"
      >
        正在加载完整明细，请稍候…
      </div>
      <div
        v-else-if="formType === 'detail' && detailLoadError"
        class="sale-quote-detail-load-state is-error"
      >
        {{ detailLoadError }}
      </div>
      <div
        v-else-if="formType !== 'detail' && editLoadError"
        class="sale-quote-detail-load-state is-error"
      >
        {{ editLoadError }}
      </div>

      <section
        v-if="!editLoadError && (formType !== 'detail' || formData)"
        ref="basicFormRef"
        class="sale-quote-detail-section"
        @keydown.capture="handleBasicFormEnter"
      >
        <header class="sale-quote-detail-section__header">
          <span class="sale-quote-detail-section__title">基本信息</span>
        </header>

        <div v-if="formType === 'detail'" class="sale-quote-detail-grid">
          <div
            v-if="isDetailFieldVisible('no')"
            class="sale-quote-detail-field"
          >
            <span class="sale-quote-detail-field__label">报价单号</span>
            <span
              class="sale-quote-detail-field__value"
              :title="formatDetailText(formData?.no)"
            >
              {{ formatDetailText(formData?.no) }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('quoteTime')"
            class="sale-quote-detail-field"
          >
            <span class="sale-quote-detail-field__label">报价时间</span>
            <span
              class="sale-quote-detail-field__value"
              :title="formatDetailDate(formData?.quoteTime)"
            >
              {{ formatDetailDate(formData?.quoteTime) }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('customerId')"
            class="sale-quote-detail-field"
          >
            <span class="sale-quote-detail-field__label">客户</span>
            <button
              v-if="canOpenCustomerDetail"
              type="button"
              class="sale-quote-detail-field__value sale-quote-detail-field__link"
              :title="formatDetailText(formData?.customerName)"
              @click="handleOpenCustomerDetail"
            >
              <span>{{ formatDetailText(formData?.customerName) }}</span>
              <span aria-hidden="true">↗</span>
            </button>
            <span v-else class="sale-quote-detail-field__value">-</span>
          </div>
          <div
            v-if="isDetailFieldVisible('saleUserId')"
            class="sale-quote-detail-field"
          >
            <span class="sale-quote-detail-field__label">业务员</span>
            <span
              class="sale-quote-detail-field__value"
              :title="formatDetailText(formData?.saleUserName)"
            >
              {{ formatDetailText(formData?.saleUserName) }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('deptId')"
            class="sale-quote-detail-field"
          >
            <span class="sale-quote-detail-field__label">部门</span>
            <span
              class="sale-quote-detail-field__value"
              :title="formatDetailText(formData?.deptName)"
            >
              {{ formatDetailText(formData?.deptName) }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('deliveryAddress')"
            class="sale-quote-detail-field"
          >
            <span class="sale-quote-detail-field__label">收货地址</span>
            <span
              class="sale-quote-detail-field__value"
              :title="formatDetailText(formData?.deliveryAddress)"
            >
              {{ formatDetailText(formData?.deliveryAddress) }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('receiverName')"
            class="sale-quote-detail-field"
          >
            <span class="sale-quote-detail-field__label">收货人</span>
            <span
              class="sale-quote-detail-field__value"
              :title="formatDetailText(formData?.receiverName)"
            >
              {{ formatDetailText(formData?.receiverName) }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('receiverPhone')"
            class="sale-quote-detail-field"
          >
            <span class="sale-quote-detail-field__label">收货电话</span>
            <span
              class="sale-quote-detail-field__value"
              :title="formatDetailText(formData?.receiverPhone)"
            >
              {{ formatDetailText(formData?.receiverPhone) }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('expectedDeliveryTime')"
            class="sale-quote-detail-field"
          >
            <span class="sale-quote-detail-field__label">预计发货时间</span>
            <span
              class="sale-quote-detail-field__value"
              :title="formatDetailDate(formData?.expectedDeliveryTime)"
            >
              {{ formatDetailDate(formData?.expectedDeliveryTime) }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('vin')"
            class="sale-quote-detail-field"
          >
            <span class="sale-quote-detail-field__label">VIN车架号</span>
            <span
              class="sale-quote-detail-field__value"
              :title="formatDetailText(formData?.vin)"
            >
              {{ formatDetailText(formData?.vin) }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('remark')"
            class="sale-quote-detail-field"
          >
            <span class="sale-quote-detail-field__label">备注</span>
            <span
              class="sale-quote-detail-field__value"
              :title="formatDetailText(formData?.remark)"
            >
              {{ formatDetailText(formData?.remark) }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('internalRemark')"
            class="sale-quote-detail-field"
          >
            <span class="sale-quote-detail-field__label">内部说明</span>
            <span
              class="sale-quote-detail-field__value"
              :title="formatDetailText(formData?.internalRemark)"
            >
              {{ formatDetailText(formData?.internalRemark) }}
            </span>
          </div>
        </div>

        <Form
          v-else
          class="sale-quote-edit-form sale-quote-edit-form--editable"
        />

        <div
          v-if="
            formData?.customerId &&
            isDetailFieldVisible('customerId') &&
            isDetailFieldVisible('customerReceivableInfo')
          "
          class="sale-quote-detail-receivable"
        >
          <CustomerReceivableSummary :customer-id="formData?.customerId" />
        </div>
      </section>

      <section
        v-if="
          !editLoadError &&
          (formType !== 'detail' || formData) &&
          isDetailFieldVisible('items')
        "
        class="sale-quote-detail-section"
      >
        <header class="sale-quote-detail-section__header">
          <span class="sale-quote-detail-section__title">报价产品清单</span>
          <div class="sale-quote-detail-section__tools">
            <span class="sale-quote-detail-count">
              {{ detailItemCount }} 项产品
            </span>
          </div>
        </header>
        <div class="sale-quote-detail-items">
          <ItemForm
            v-if="formData"
            ref="itemFormRef"
            :items="formData?.items ?? []"
            :disabled="formType === 'detail'"
            compact
            :document-id="formData?.id"
            :enable-batch-edit="canBatchUpdateItems"
            :fee-amount="formData?.feeAmount ?? formData?.otherPrice ?? 0"
            :hidden-fields="hiddenFields"
            :item-page-loading="itemPageLoading"
            :item-pagination="itemPageState"
            :main-dept-id="formData?.deptId"
            :customer-price-level="currentCustomerPriceLevel"
            :price-type="currentPriceType"
            :remote-paging="isRemoteItemPaging"
            :shortcut-active="isSaleQuoteFormOpen"
            :suspend-price-auto-refresh="isHydratingFormValues"
            @batch-update-success="reloadSaleQuoteDetail"
            @import="handleImport"
            @page-change="handleItemPageChange"
            @request-submit="handleLastInputEnterConfirm"
            @update:items="handleUpdateItems"
            @update:summary="handleUpdateSummary"
          />
        </div>
        <div class="sale-quote-document-summary">
          <strong>单据合计</strong>
          <span v-if="isDetailFieldVisible('totalCount')">
            数量
            <b>{{ formatSaleDecimal(formData?.totalCount || 0) }}</b>
          </span>
          <span
            v-if="
              isDetailFieldVisible('totalProductPrice') ||
              isDetailPriceFieldHidden('totalProductPrice')
            "
          >
            总金额
            <b>{{
              formatDetailPriceAmount('totalProductPrice', detailProductAmount)
            }}</b>
          </span>
          <span
            v-if="
              isDetailFieldVisible('allowancePrice') ||
              isDetailPriceFieldHidden('allowancePrice')
            "
          >
            折让金额
            <b>{{
              isDetailPriceFieldHidden('allowancePrice')
                ? '****'
                : `-${formatDetailAmount(detailDiscountAmount)}`
            }}</b>
          </span>
          <span v-if="detailExtraCost.label">
            {{ detailExtraCost.label }}
            <b>{{ formatDetailAmount(detailExtraCost.amount) }}</b>
          </span>
          <span
            v-if="
              isDetailFieldVisible('totalPrice') ||
              isDetailPriceFieldHidden('totalPrice')
            "
            class="sale-quote-document-summary__paid"
          >
            实收金额
            <b>{{
              formatDetailPriceAmount('totalPrice', formData?.totalPrice)
            }}</b>
          </span>
        </div>
      </section>

      <section
        v-if="formType === 'detail' && formData"
        class="sale-quote-detail-section sale-quote-detail-audit"
      >
        <header class="sale-quote-detail-section__header">
          <span class="sale-quote-detail-section__title">审计信息</span>
        </header>
        <ErpAuditInfo title="" :record="formData" />
      </section>
    </div>

    <template #cancelText>
      {{ formType === 'detail' ? '关闭' : '取消' }}
    </template>
    <template v-if="!reportViewOnly" #center-footer>
      <Button
        v-if="canGenerateDraft"
        :loading="draftSaving"
        @click="handleGenerateDraft"
      >
        {{ generateDraftButtonText }}
      </Button>
    </template>
    <template v-if="!reportViewOnly" #prepend-footer>
      <Button
        v-if="showSubmitDraftBtn"
        type="primary"
        @click="handleSubmitDraft"
      >
        提交
      </Button>
      <Button
        v-if="canEditFromDetail"
        type="primary"
        @click="handleEditFromDetail"
      >
        编辑
      </Button>
      <Button v-if="canEditRemark" type="primary" @click="handleEditRemark">
        修改备注
      </Button>
      <Button
        v-if="canPrintFromDetail"
        :title="printSortTitle"
        @click="handleDetailPrint"
      >
        打印
      </Button>
      <Button
        v-if="formType === 'detail' && formData?.id"
        type="primary"
        ghost
        @click="handleCopy"
      >
        复制
      </Button>
      <Button
        v-if="showConvertCartBtn"
        type="primary"
        ghost
        @click="handleConvertCart"
      >
        出库
      </Button>
      <Button v-if="showApproveBtn" type="primary" @click="handleApprove">
        下订
      </Button>
      <Button
        v-if="showReverseOrderBtn"
        type="primary"
        ghost
        @click="handleReverseOrder"
      >
        反下订
      </Button>
    </template>
    <ConvertCartModal
      ref="convertCartModalRef"
      @success="handleConvertCartSuccess"
    />
  </Modal>
  <RemarkModal @success="handleRemarkSuccess" />
  <ImportFormModal @success="handleImportSuccess" />
  <CustomerDetailModal />
</template>

<style scoped>
.sale-quote-detail-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.sale-quote-detail-title__text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.sale-quote-detail-title__text > span {
  line-height: 1.25;
}

.sale-quote-detail-title__text small {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-quote-status {
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

.sale-quote-status::before {
  width: 6px;
  height: 6px;
  background: currentcolor;
  border-radius: 50%;
  content: '';
}

.sale-quote-status.is-draft {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 10%);
}

.sale-quote-status.is-success {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
}

.sale-quote-status.is-info {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.sale-quote-status.is-muted {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
}

.sale-quote-detail-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: hsl(var(--muted) / 28%);
  font-size: 12px;
}

.sale-quote-detail-load-state {
  display: flex;
  min-height: 72px;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.sale-quote-detail-load-state.is-error {
  color: hsl(var(--destructive));
}

.sale-quote-edit-form :deep(.sale-quote-basic-grid) {
  gap: 0 12px;
  padding: 12px;
}

.sale-quote-edit-form :deep(.sale-quote-basic-grid > div) {
  min-width: 0;
}

.sale-quote-edit-form :deep(.sale-quote-basic-grid > div > label) {
  margin-right: 0;
  padding-right: 10px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  white-space: nowrap;
}

.sale-quote-edit-form :deep(.sale-quote-basic-grid > div > .flex-auto) {
  min-width: 0;
}

.sale-quote-edit-form :deep(.ant-input),
.sale-quote-edit-form :deep(.ant-picker),
.sale-quote-edit-form :deep(.ant-select-selector),
.sale-quote-edit-form :deep(.ant-tree-select .ant-select-selector) {
  min-height: 32px;
  background: hsl(var(--muted) / 48%) !important;
  border-color: hsl(var(--border)) !important;
  border-radius: 6px !important;
  font-size: 12px;
}

.sale-quote-edit-form :deep(.ant-input),
.sale-quote-edit-form :deep(.ant-picker-input > input),
.sale-quote-edit-form :deep(.ant-select-selection-item),
.sale-quote-edit-form :deep(.ant-select-selection-placeholder) {
  font-size: 12px;
}

.sale-quote-edit-form :deep(.ant-input),
.sale-quote-edit-form :deep(.ant-picker) {
  height: 32px;
}

.sale-quote-edit-form :deep(.ant-select-single) {
  height: 32px;
}

.sale-quote-edit-form :deep(textarea) {
  min-height: 32px !important;
  resize: none;
  white-space: nowrap;
}

.sale-quote-edit-form--editable :deep(.ant-input:not(:disabled)),
.sale-quote-edit-form--editable :deep(.ant-picker:not(.ant-picker-disabled)),
.sale-quote-edit-form--editable
  :deep(.ant-select:not(.ant-select-disabled) .ant-select-selector) {
  background: hsl(var(--background)) !important;
}

.sale-quote-edit-form--editable :deep(.ant-input:disabled),
.sale-quote-edit-form--editable :deep(.ant-picker-disabled),
.sale-quote-edit-form--editable
  :deep(.ant-select-disabled .ant-select-selector) {
  color: hsl(var(--muted-foreground)) !important;
  background: hsl(var(--muted-foreground) / 14%) !important;
  border-color: hsl(var(--muted-foreground) / 28%) !important;
}

.sale-quote-detail-section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.sale-quote-detail-section__header {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.sale-quote-detail-section__title {
  position: relative;
  padding-left: 10px;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
}

.sale-quote-detail-section__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  background: hsl(var(--primary));
  border-radius: 3px;
  content: '';
}

.sale-quote-detail-section__tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sale-quote-detail-count {
  padding: 2px 8px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
}

.sale-quote-detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px 12px;
  padding: 12px;
}

.sale-quote-detail-field {
  display: grid;
  min-width: 0;
  align-items: center;
  grid-template-columns: 82px minmax(0, 1fr);
}

.sale-quote-detail-field__label {
  min-width: 0;
  padding-right: 10px;
  color: hsl(var(--muted-foreground));
  line-height: 1.2;
  text-align: left;
  white-space: nowrap;
}

.sale-quote-detail-field__value {
  display: flex;
  min-width: 0;
  height: 32px;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  overflow: hidden;
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 48%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  line-height: 1.4;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-quote-detail-field__value > span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-quote-detail-field__value > span:last-child {
  margin-left: auto;
}

.sale-quote-detail-field__link {
  width: 100%;
  color: hsl(var(--primary));
  cursor: pointer;
}

.sale-quote-detail-field__link:hover {
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary) / 55%);
}

.sale-quote-detail-receivable {
  padding: 0 12px 12px;
}

.sale-quote-detail-receivable :deep(> div) {
  border-color: hsl(var(--primary) / 20%);
  background: hsl(var(--primary) / 7%);
}

.sale-quote-detail-items {
  padding: 10px 10px 0;
}

.sale-quote-detail-items :deep(.vxe-table) {
  font-size: 11px;
}

.sale-quote-detail-items :deep(.vxe-header--column .vxe-cell),
.sale-quote-detail-items :deep(.vxe-body--column .vxe-cell) {
  padding-right: 4px;
  padding-left: 4px;
}

.sale-quote-detail-items :deep(.vxe-header--column .vxe-cell) {
  white-space: nowrap;
}

.sale-quote-document-summary {
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

.sale-quote-document-summary strong {
  margin-right: auto;
  color: hsl(var(--foreground));
}

.sale-quote-document-summary b {
  margin-left: 5px;
  color: hsl(var(--foreground));
  font-variant-numeric: tabular-nums;
}

.sale-quote-document-summary__paid b {
  color: hsl(var(--success));
}

.sale-quote-detail-audit :deep(.erp-audit-info) {
  padding: 12px;
}

.sale-quote-detail-audit :deep(.erp-audit-info .text-sm) {
  font-size: 12px;
}

.sale-quote-detail-audit :deep(.erp-audit-info > div:first-child) {
  display: none;
}

:global(.sale-quote-form-select-dropdown .ant-select-item),
:global(.sale-quote-form-select-dropdown .ant-select-tree),
:global(.sale-quote-form-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

@media (max-width: 640px) {
  .sale-quote-detail-view {
    padding: 8px;
  }

  .sale-quote-detail-section__header {
    align-items: flex-start;
    flex-direction: column;
    justify-content: center;
    padding-top: 8px;
    padding-bottom: 8px;
  }

  .sale-quote-document-summary {
    align-items: flex-start;
    flex-direction: column;
  }

  .sale-quote-document-summary strong {
    margin-right: 0;
  }
}
</style>
