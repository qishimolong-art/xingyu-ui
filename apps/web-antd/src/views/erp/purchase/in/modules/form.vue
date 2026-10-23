<script lang="ts" setup>
import type { ErpPurchaseInApi } from '#/api/erp/purchase/in';
import type { ErpPurchaseOrderApi, InableItem } from '#/api/erp/purchase/order';
import type { ErpItemRowFocusField } from '#/views/erp/utils/item-row-focus';

import { computed, defineAsyncComponent, nextTick, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';
import { useUserStore } from '@vben/stores';

import { Modal as AntModal, message, Tabs } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createPurchaseIn,
  createPurchaseInDraft,
  getPurchaseIn,
  getPurchaseInItemPage,
  getPurchaseInItemPageForEdit,
  matchPurchaseInItems,
  PURCHASE_IN_STATUS,
  submitPurchaseIn,
  updateAndSubmitPurchaseInDraft,
  updatePurchaseIn,
  updatePurchaseInDraft,
  updatePurchaseInStatus,
} from '#/api/erp/purchase/in';
import { getPurchaseOrder } from '#/api/erp/purchase/order';
import {
  applyFieldPermission,
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import { applyFieldConfig } from '#/views/erp/composables/useFieldConfig';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import DetailLinkInput from '#/views/erp/components/DetailLinkInput.vue';
import PurchaseDocumentRemarkForm from '#/views/erp/purchase/components/PurchaseDocumentRemarkForm.vue';
import PurchaseDocumentSummary from '#/views/erp/purchase/components/PurchaseDocumentSummary.vue';
import PurchaseOrderInableItemSelectModal from '#/views/erp/purchase/components/PurchaseOrderInableItemSelectModal.vue';
import SupplierPaymentSummary from '#/views/erp/purchase/components/SupplierPaymentSummary.vue';
import PurchaseInvoiceForm from '#/views/erp/purchase/invoice/modules/form.vue';
import PurchasePriceAdjustForm from '#/views/erp/purchase/priceadjust/modules/form.vue';
import PurchaseReturnForm from '#/views/erp/purchase/return/modules/form.vue';
import PurchaseReturnableItemSelectModal from '#/views/erp/purchase/return/modules/purchase-returnable-item-select-modal.vue';
import '#/views/erp/purchase/styles/document-form.css';
import {
  buildPurchaseCurrentUserFormDefaults,
  buildPurchaseDocumentDetailFormValues,
  hydratePurchaseDocumentFormSelectLabels,
  hydratePurchaseSupplierFromFallback,
  preparePurchaseDocumentFormSchema,
  withCurrentPurchaseFormSelectOptions,
  withCurrentPurchaseSupplierOption,
} from '#/views/erp/purchase/utils/document-form';
import {
  showPurchaseFormActionError,
  showPurchaseFormOpenError,
} from '#/views/erp/purchase/utils/form-error';
import { getErpDetailLoadError } from '#/views/erp/utils/detail-load-error';
import { hasValidPurchaseDraftItems } from '#/views/erp/purchase/utils/draft-items';
import { ensurePurchaseModalReady } from '#/views/erp/purchase/utils/lazy-modal';
import {
  createPurchaseItemClientRowKeyManager,
  stripPurchaseItemClientFields,
} from '#/views/erp/purchase/utils/item-row-key';
import {
  clampRemoteItemPageNo,
  composeRemoteItemPage,
  getRemoteItemTotal,
  pageHasPersistedRows,
} from '#/views/erp/purchase/utils/remote-item-paging';
import {
  focusFirstEditableFormControl,
  focusNextEditableFormControlOnEnter,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';

import { useReportViewOnly } from '#/views/erp/report/components/report-view-only';

import { useFormSchema } from '../data';
import { buildPurchaseInCopiedDraft } from './copy';
import ImportForm from './import-form.vue';
import ItemForm from './item-form.vue';
import PaymentWriteOffTab from './payment-writeoff-tab.vue';
import CostConfirmationTab from './cost-confirmation-tab.vue';
import PurchaseInTransferOutForm from './purchase-in-transfer-out-form.vue';
import PurchaseInStatusDots from './purchase-in-status-dots.vue';
import PurchaseInToSaleCartForm from './purchase-in-to-sale-cart-form.vue';
import PurchaseOrderSelect from './purchase-order-select.vue';
import { parsePurchaseInQtyText } from '#/views/erp/purchase/order/modules/purchase-order-form-utils';
import { toOptionalNumberValue } from '#/views/erp/purchase/utils/text-number';
import {
  buildPurchaseDetailPrintPayload,
  getPurchaseDetailPrintTooltip,
} from '#/views/erp/purchase/utils/item-print-sort';

const emit = defineEmits(['edit', 'print', 'success']);
const reportViewOnly = useReportViewOnly();
const FIELD_PERMISSION_MODULE = 'erp_purchase_in';
const userStore = useUserStore();
const { hasAccessByCodes } = useAccess();
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const loadSupplierDetailComponent = () =>
  import('#/views/erp/purchase/supplier/modules/detail.vue');
const SupplierDetail = defineAsyncComponent(loadSupplierDetailComponent);
const loadPurchaseOrderDetailComponent = () =>
  import('#/views/erp/purchase/order/modules/form.vue');
const PurchaseOrderDetail = defineAsyncComponent(
  loadPurchaseOrderDetailComponent,
);
const [SupplierDetailModal, supplierDetailModalApi] = useVbenModal({
  connectedComponent: SupplierDetail,
  destroyOnClose: true,
});
const shouldRenderSupplierDetail = ref(false);
const [PurchaseOrderDetailModal, purchaseOrderDetailModalApi] = useVbenModal({
  connectedComponent: PurchaseOrderDetail,
  destroyOnClose: true,
});
const [RemarkModal, remarkModalApi] = useVbenModal({
  connectedComponent: PurchaseDocumentRemarkForm,
  destroyOnClose: true,
});
const shouldRenderPurchaseOrderDetail = ref(false);

async function handleOpenSupplierDetail() {
  if (!formData.value?.supplierId) return;
  await ensurePurchaseModalReady(
    shouldRenderSupplierDetail,
    supplierDetailModalApi,
    loadSupplierDetailComponent,
  );
  supplierDetailModalApi.setData({ id: formData.value.supplierId }).open();
}

async function handleOpenOrderDetail() {
  if (!formData.value?.orderId) return;
  await ensurePurchaseModalReady(
    shouldRenderPurchaseOrderDetail,
    purchaseOrderDetailModalApi,
    loadPurchaseOrderDetailComponent,
  );
  purchaseOrderDetailModalApi
    .setData({ type: 'detail', id: formData.value.orderId })
    .open();
}

type PurchaseInFormData = ErpPurchaseInApi.PurchaseIn & {
  customerId?: number;
  order?: ErpPurchaseOrderApi.PurchaseOrder;
};
type SelectedReturnableRows = Array<{
  count: number;
  itemRow: ErpPurchaseInApi.ReturnableItem;
}>;

const DEFAULT_ITEM_PAGE_SIZE = 10;
const DETAIL_TAB_KEY = 'detail';
const PAYMENT_TAB_KEY = 'payment';

const formData = ref<PurchaseInFormData>({
  items: [],
});
const formType = ref('');
const detailActiveTab = ref(DETAIL_TAB_KEY);
const paymentTabReloadKey = ref(0);
const detailLoading = ref(false);
const detailLoadError = ref('');
const itemPageLoading = ref(false);
const orderInableItemSelectRef =
  ref<InstanceType<typeof PurchaseOrderInableItemSelectModal>>();
const itemPageState = ref({
  orderDirection: undefined as 'asc' | 'desc' | undefined,
  orderField: undefined as string | undefined,
  pageNo: 1,
  pageSize: DEFAULT_ITEM_PAGE_SIZE,
  total: 0,
});
const canPrintFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:purchase-in:print']),
);
const detailPrintTooltip = computed(() =>
  getPurchaseDetailPrintTooltip(
    itemPageState.value.orderField,
    itemPageState.value.orderDirection,
  ),
);
function handlePrintFromDetail() {
  emit(
    'print',
    buildPurchaseDetailPrintPayload(
      formData.value,
      itemPageState.value.orderField,
      itemPageState.value.orderDirection,
    ),
  );
}
let detailLoadSequence = 0;
let itemPageLoadSequence = 0;
let remotePersistedItemTotal = 0;
let remotePersistedItemTotalKnown = false;
const basicFormRef = ref<HTMLElement | null>(null);
let skipDraftOnClose = false;
let draftSaved = false;
let draftSaving = false;
let supplierDeptLoadSequence = 0;
let isHydratingFormValues = false;
const canOpenSupplierDetail = computed(() =>
  Boolean(formData.value?.supplierId && formData.value?.supplierName),
);
const canOpenOrderDetail = computed(() =>
  Boolean(formData.value?.orderId && formData.value?.orderNo),
);
const canViewFinancePaymentItems = computed(() =>
  hasAccessByCodes(['erp:finance-payment:query']),
);
const supplierFieldSlotName = computed(() =>
  formType.value === 'detail' ? 'supplierId' : 'supplierIdDisplay',
);
const isRemoteItemPaging = computed(
  () =>
    Boolean(formData.value?.id) && ['detail', 'edit'].includes(formType.value),
);
const itemFormRef = ref<InstanceType<typeof ItemForm>>();
const transferOutFormRef =
  ref<InstanceType<typeof PurchaseInTransferOutForm>>();
const toSaleCartFormRef = ref<InstanceType<typeof PurchaseInToSaleCartForm>>();
const returnableItemSelectRef =
  ref<InstanceType<typeof PurchaseReturnableItemSelectModal>>();

function getItemFormInstance() {
  const instance = itemFormRef.value;
  return Array.isArray(instance) ? instance[0] : instance;
}

const remoteItemEdits = new Map<number, ErpPurchaseInApi.PurchaseInItem>();
const remoteItemDeletes = new Set<number>();
const remoteItemCreates = new Map<string, ErpPurchaseInApi.PurchaseInItem>();
const remoteItemOriginals = new Map<number, ErpPurchaseInApi.PurchaseInItem>();
const itemRowKeyManager = createPurchaseItemClientRowKeyManager('purchase-in');

function clearRemoteItemCaches() {
  remoteItemEdits.clear();
  remoteItemDeletes.clear();
  remoteItemCreates.clear();
  remoteItemOriginals.clear();
  itemRowKeyManager.reset();
}

function resetRemoteItemState() {
  clearRemoteItemCaches();
  itemPageLoadSequence++;
  remotePersistedItemTotal = 0;
  remotePersistedItemTotalKnown = false;
  itemPageState.value = {
    orderDirection: undefined,
    orderField: undefined,
    pageNo: 1,
    pageSize: DEFAULT_ITEM_PAGE_SIZE,
    total: 0,
  };
}

function getRemoteLocalItemKey(item: ErpPurchaseInApi.PurchaseInItem) {
  return itemRowKeyManager.ensureRowKey(item);
}

function normalizeRemoteItemForCompare(item: ErpPurchaseInApi.PurchaseInItem) {
  const {
    batchNoEnabled: _batchNoEnabled,
    clientRowKey: _clientRowKey,
    countText: _countText,
    inCount: _inCount,
    operation: _operation,
    productUnitName: _productUnitName,
    seq: _seq,
    stockCount: _stockCount,
    taxPrice: _taxPrice,
    totalPrice: _totalPrice,
    totalProductPrice: _totalProductPrice,
    warehouseName: _warehouseName,
    ...rest
  } = item as any;
  rest.gift = Boolean(rest.gift);
  rest.packageQty =
    rest.packageQty === undefined ||
    rest.packageQty === null ||
    rest.packageQty <= 0
      ? 1
      : rest.packageQty;
  if (
    rest.gift &&
    (rest.productPrice === undefined || rest.productPrice === null)
  ) {
    rest.productPrice = 0;
  }
  const normalized: Record<string, unknown> = {};
  Object.keys(rest)
    .toSorted()
    .forEach((key) => {
      const value = rest[key];
      if (value === undefined || value === null || value === '') {
        return;
      }
      normalized[key] = value;
    });
  return normalized;
}

function stringifyRemoteItemForCompare(item: ErpPurchaseInApi.PurchaseInItem) {
  return JSON.stringify(normalizeRemoteItemForCompare(item));
}

function isSameRemoteItem(
  current: ErpPurchaseInApi.PurchaseInItem,
  original?: ErpPurchaseInApi.PurchaseInItem,
) {
  if (!original) {
    return false;
  }
  return (
    stringifyRemoteItemForCompare(current) ===
    stringifyRemoteItemForCompare(original)
  );
}

function rememberRemoteItemOriginals(
  rows: ErpPurchaseInApi.PurchaseInItem[] = [],
) {
  rows.forEach((item) => {
    if (item.id) {
      remoteItemOriginals.set(item.id, { ...item });
    }
  });
}

function applyRemoteItemCache(rows: ErpPurchaseInApi.PurchaseInItem[] = []) {
  itemRowKeyManager.ensureRowKeys(rows);
  const persistedRows = rows
    .filter((item) => !item.id || !remoteItemDeletes.has(item.id))
    .map((item) => (item.id && remoteItemEdits.get(item.id)) || item);
  const pageRows = composeRemoteItemPage({
    createdRows: Array.from(remoteItemCreates.values()),
    pageNo: itemPageState.value.pageNo,
    pageSize: itemPageState.value.pageSize,
    persistedRows,
    persistedTotal: remotePersistedItemTotal,
  });
  return itemRowKeyManager.ensureRowKeys(pageRows);
}

function recordRemoteItemChanges(rows: ErpPurchaseInApi.PurchaseInItem[]) {
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
      } else {
        remoteItemEdits.set(item.id, { ...item });
      }
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

function normalizeUserField(value: unknown): number | string | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : value;
  }
  return value as number | string | undefined;
}

type PurchaseInDeptFieldRef = {
  updateParam?: (newParams: Record<string, any>) => void;
};

function normalizeOptionalNumber(value?: null | number | string) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
}

function updateDeptFieldSupplierParam(supplierId?: number) {
  formApi
    .getFieldComponentRef<PurchaseInDeptFieldRef>('deptId')
    ?.updateParam?.(supplierId ? { supplierId } : {});
}

async function refreshSupplierDeptOptions(
  supplierId?: number,
  options: {
    clearInvalidDept?: boolean;
    selectedDeptId?: number;
    warnOnClear?: boolean;
  } = {},
) {
  supplierDeptLoadSequence++;
  const normalizedSupplierId = normalizeOptionalNumber(supplierId);
  updateDeptFieldSupplierParam(normalizedSupplierId);
  if (!normalizedSupplierId) {
    if (options.clearInvalidDept && options.selectedDeptId !== undefined) {
      await formApi.setValues({ deptId: undefined }, false);
      if (formData.value) {
        formData.value.deptId = undefined;
      }
    }
    return new Set<number>();
  }
  const selectedDeptId = normalizeOptionalNumber(options.selectedDeptId);
  if (options.clearInvalidDept && selectedDeptId !== undefined) {
    await formApi.setValues({ deptId: undefined }, false);
    if (formData.value) {
      formData.value.deptId = undefined;
    }
    if (options.warnOnClear) {
      message.warning('当前部门不在该供应商可用部门范围内，已清空');
    }
  }
  return new Set<number>();
}

async function handleSupplierChange(supplierId?: number) {
  const values = (await formApi.getValues()) as ErpPurchaseInApi.PurchaseIn;
  const supplierChanged = supplierId !== formData.value?.supplierId;
  if (formData.value) {
    formData.value.supplierId = supplierId;
  }
  if (supplierChanged && (formData.value.orderId || formData.value.orderNo)) {
    formData.value.orderId = undefined;
    formData.value.orderNo = undefined;
    formData.value.items = [];
    await formApi.setValues(
      { orderId: undefined, orderNo: undefined, items: [] },
      false,
    );
  }
  await refreshSupplierDeptOptions(supplierId, {
    clearInvalidDept: true,
    selectedDeptId: values.deptId,
    warnOnClear: Boolean(supplierId && values.deptId),
  });
}

function getCurrentInTime() {
  return String(Date.now());
}

function getFeeAmountFallback(data?: {
  feeAmount?: unknown;
  otherPrice?: unknown;
}) {
  return (
    toOptionalNumberValue(data?.feeAmount) ??
    toOptionalNumberValue(data?.otherPrice) ??
    0
  );
}

function normalizeFeeAmount<
  T extends { feeAmount?: unknown; otherPrice?: unknown },
>(data: T): T & { feeAmount: number } {
  return {
    ...data,
    feeAmount: getFeeAmountFallback(data),
  };
}

function syncFeeAmountForSubmit(values: Record<string, unknown>) {
  const feeAmount = getFeeAmountFallback(values);
  values.feeAmount = feeAmount;
  values.otherPrice = feeAmount;
}

function getTotalWithFreight(data?: {
  totalFreight1?: unknown;
  totalPrice?: unknown;
}) {
  return (
    (toOptionalNumberValue(data?.totalPrice) ?? 0) +
    (toOptionalNumberValue(data?.totalFreight1) ?? 0)
  );
}

const [ImportFormModal, importFormModalApi] = useVbenModal({
  connectedComponent: ImportForm,
});
const [PurchaseReturnModal, purchaseReturnModalApi] = useVbenModal({
  connectedComponent: PurchaseReturnForm,
  destroyOnClose: true,
});
const shouldRenderPurchaseReturn = ref(false);
const [PurchaseInvoiceModal, purchaseInvoiceModalApi] = useVbenModal({
  connectedComponent: PurchaseInvoiceForm,
  destroyOnClose: true,
});
const shouldRenderPurchaseInvoice = ref(false);
const [PurchasePriceAdjustModal, purchasePriceAdjustModalApi] = useVbenModal({
  connectedComponent: PurchasePriceAdjustForm,
  destroyOnClose: true,
});
const shouldRenderPurchasePriceAdjust = ref(false);

const getTitle = computed(() => {
  if (formType.value === 'create')
    return $t('ui.actionTitle.create', ['采购入库']);
  if (formType.value === 'edit') return $t('ui.actionTitle.edit', ['采购入库']);
  return '采购入库详情';
});

const canApprove = computed(
  () =>
    formType.value === 'detail' &&
    formData.value?.status === 10 &&
    hasAccessByCodes(['erp:purchase-in:update-status']),
);
const isEditingDraft = computed(
  () =>
    formType.value === 'edit' &&
    formData.value?.status === PURCHASE_IN_STATUS.DRAFT,
);
const canSubmitDraft = computed(
  () =>
    formType.value === 'detail' &&
    formData.value?.status === PURCHASE_IN_STATUS.DRAFT &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:purchase-in:update-status']),
);
const canGenerateDraft = computed(
  () => formType.value === 'create' || isEditingDraft.value,
);
const generateDraftButtonText = computed(() =>
  isEditingDraft.value ? '保存草稿' : '生成草稿',
);
const canEditFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    formData.value?.status !== PURCHASE_IN_STATUS.APPROVE &&
    hasAccessByCodes(['erp:purchase-in:update']),
);
const canConfirmForm = computed(() => {
  if (
    formType.value === 'detail' ||
    detailLoading.value ||
    detailLoadError.value
  ) {
    return false;
  }
  return (
    !isEditingDraft.value || hasAccessByCodes(['erp:purchase-in:update-status'])
  );
});
const confirmText = computed(() =>
  isEditingDraft.value ? '确认提交' : '确定',
);
function canFocusBasicForm() {
  return canConfirmForm.value;
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

async function queueFocusFirstBasicFormControl(sequence = detailLoadSequence) {
  await nextTick();
  if (sequence !== detailLoadSequence || !canFocusBasicForm()) {
    return;
  }
  queueAfterEditableControlRender(() => {
    if (sequence === detailLoadSequence) {
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

const canEditRemark = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    hasAccessByCodes(['erp:purchase-in:update']),
);

function getPurchaseInLoadOptions(type = formType.value) {
  return {
    includeItems: !['detail', 'edit', 'copy'].includes(type),
    mask: type === 'detail',
  };
}

async function loadPurchaseInItemPage(
  options: {
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    pageNo?: number;
    pageSize?: number;
  } = {},
) {
  if (!formData.value?.id) {
    formData.value = formData.value ?? { items: [] };
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
      if (options.orderField || options.orderDirection) {
        message.warning('存在未保存新增明细，保存后可进行全局排序');
        await itemFormRef.value?.clearItemSort();
      }
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
      await nextTick();
      await getItemFormInstance()?.reloadItemsFromProps?.();
      return;
    }
    const request = {
      excludedItemIds: Array.from(remoteItemDeletes),
      inId: formData.value.id,
      mask: formType.value === 'detail',
      orderDirection: nextState.orderDirection,
      orderField: nextState.orderField,
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
    };
    const result = await (formType.value === 'edit'
      ? getPurchaseInItemPageForEdit(request)
      : getPurchaseInItemPage(request));
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
    if (requestSequence === itemPageLoadSequence) itemPageLoading.value = false;
  }
}

async function loadAllPurchaseInItems(
  inId: number,
  options: { mask?: boolean } = {},
) {
  const pageSize = 200;
  const firstPage = await getPurchaseInItemPage({
    inId,
    mask: options.mask ?? false,
    pageNo: 1,
    pageSize,
  });
  const rows = [...(firstPage.list ?? [])];
  const total = firstPage.total ?? rows.length;
  const pageCount = Math.ceil(total / pageSize);
  for (let pageNo = 2; pageNo <= pageCount; pageNo++) {
    const page = await getPurchaseInItemPage({
      inId,
      mask: options.mask ?? false,
      pageNo,
      pageSize,
    });
    rows.push(...(page.list ?? []));
  }
  return rows;
}

function normalizePurchaseInSubmitItems(
  items: ErpPurchaseInApi.PurchaseInItem[],
) {
  return items.map((item) => {
    const businessItem = stripPurchaseItemClientFields(item);
    return {
      ...businessItem,
      countText:
        item.count === null || item.count === undefined
          ? ''
          : String(item.count),
    };
  });
}

function buildRemoteItemChangeSetForSubmit() {
  const updateItems = Array.from(remoteItemEdits.values()).map((item) => ({
    ...item,
    operation: 'update' as const,
  }));
  const insertItems = Array.from(remoteItemCreates.values()).map((item) => ({
    ...item,
    id: undefined,
    inId: undefined,
    operation: 'insert' as const,
  }));
  const deleteItems = Array.from(remoteItemDeletes.values()).map((id) => ({
    id,
    operation: 'delete' as const,
  })) as ErpPurchaseInApi.PurchaseInItem[];
  return normalizePurchaseInSubmitItems([
    ...deleteItems,
    ...updateItems,
    ...insertItems,
  ]);
}

function buildItemsForValidation() {
  if (!isRemoteItemPaging.value || !formData.value?.id) {
    return normalizePurchaseInSubmitItems(formData.value?.items ?? []);
  }
  return normalizePurchaseInSubmitItems([
    ...Array.from(remoteItemEdits.values()),
    ...Array.from(remoteItemCreates.values()),
  ]);
}

async function buildMergedRemoteItemsForSubmit() {
  if (!isRemoteItemPaging.value || !formData.value?.id) {
    return normalizePurchaseInSubmitItems(formData.value?.items ?? []);
  }
  return buildRemoteItemChangeSetForSubmit();
}

function hasPurchaseInItemsForSubmit() {
  if (isRemoteItemPaging.value && formData.value?.id) {
    return itemPageState.value.total > 0;
  }
  return (formData.value?.items ?? []).some((item) => Boolean(item));
}

function getMaskedSummaryValue(field: string, value?: number | string) {
  return formType.value === 'detail' && isFieldHidden(hiddenFields.value, field)
    ? '****'
    : value;
}
const canBatchUpdateItems = computed(
  () =>
    formType.value !== 'detail' ||
    (!!formData.value?.id &&
      formData.value?.status !== PURCHASE_IN_STATUS.APPROVE),
);

function handleEditRemark() {
  if (!formData.value?.id) return;
  remarkModalApi
    .setData({
      documentName: '采购入库',
      documentType: 'purchase-in',
      id: formData.value.id,
      no: formData.value.no,
      remark: formData.value.remark,
    })
    .open();
}

async function handleRemarkSuccess(remark: string) {
  formData.value.remark = remark;
  await formApi.setValues({ remark });
  emit('success');
}

const documentSummaryItems = computed(() => [
  {
    label: '入库数量',
    value: formData.value?.totalCount,
    kind: 'count' as const,
  },
  {
    label: '商品金额',
    value: getMaskedSummaryValue(
      'totalProductPrice',
      formData.value?.totalProductPrice,
    ),
    kind: 'amount' as const,
  },
  {
    label: '含税金额',
    value: getMaskedSummaryValue(
      'totalTaxPrice',
      formData.value?.totalTaxPrice,
    ),
    kind: 'amount' as const,
  },
  {
    label: '运费',
    value: formData.value?.totalFreight1,
    kind: 'amount' as const,
  },
  {
    label: '入库总额',
    value: getMaskedSummaryValue('totalPrice', formData.value?.totalPrice),
    kind: 'amount' as const,
    emphasis: true,
  },
  {
    label: '含运费合计',
    value: getTotalWithFreight(formData.value),
    kind: 'amount' as const,
  },
]);

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    labelWidth: 82,
  },
  wrapperClass: 'purchase-document-basic-grid grid-cols-4',
  layout: 'horizontal',
  showDefaultActions: false,
  handleValuesChange: async (values, changedFields) => {
    if (isHydratingFormValues) return;
    if (formData.value && changedFields.includes('freightType1')) {
      formData.value.freightType1 = values.freightType1 as string | undefined;
    }
    if (formData.value && changedFields.includes('totalFreight1')) {
      formData.value.totalFreight1 =
        toOptionalNumberValue(values.totalFreight1) ?? 0;
    }
    if (formData.value && changedFields.includes('supplierId')) {
      await handleSupplierChange(values.supplierId);
    }
    if (formData.value && changedFields.includes('deptId')) {
      formData.value.deptId = values.deptId;
    }
  },
});

async function buildPermissionSchema(
  type: string,
  supplierData?: ErpPurchaseInApi.PurchaseIn,
) {
  const configuredSchema = await applyFieldConfig(
    useFormSchema(type),
    'purchase_in',
  );
  return preparePurchaseDocumentFormSchema(
    withCurrentPurchaseFormSelectOptions(
      withCurrentPurchaseSupplierOption(
        applyFieldPermission(configuredSchema, hiddenFields.value),
        supplierData ?? formData.value,
      ),
      supplierData ?? formData.value,
    ),
    { data: supplierData ?? formData.value, formType: type },
  );
}

async function applyFormMode(
  type: string,
  supplierData?: ErpPurchaseInApi.PurchaseIn,
) {
  formType.value = type;
  modalApi.setState({ fullscreen: true });
  formApi.setDisabled(type === 'detail');
  await loadHiddenFields();
  formApi.setState({
    schema: await buildPermissionSchema(type, supplierData),
  });
  await nextTick();
}

function handleOpenImport() {
  importFormModalApi.open();
}

async function handleOpenPurchaseReturn() {
  await ensurePurchaseModalReady(
    shouldRenderPurchaseReturn,
    purchaseReturnModalApi,
  );
  purchaseReturnModalApi
    .setData({
      fillReturnableItems: true,
      type: 'create',
      sourcePurchaseIn: formData.value,
    })
    .open();
}

function handleOpenPartialPurchaseReturn() {
  if (!formData.value?.id) return;
  returnableItemSelectRef.value?.open(formData.value);
}

async function handleSelectPartialReturnableItems(
  rows: SelectedReturnableRows,
  sourcePurchaseIn: ErpPurchaseInApi.PurchaseIn,
) {
  await ensurePurchaseModalReady(
    shouldRenderPurchaseReturn,
    purchaseReturnModalApi,
  );
  purchaseReturnModalApi
    .setData({
      type: 'create',
      sourcePurchaseIn,
      selectedReturnableRows: rows,
    })
    .open();
}

function handleOpenTransferOut() {
  if (!formData.value?.id) return;
  transferOutFormRef.value?.open({
    sourcePurchaseIn: formData.value,
  });
}

function handleOpenToSaleCart() {
  if (!formData.value?.id) return;
  toSaleCartFormRef.value?.open({
    sourcePurchaseIn: formData.value,
  });
}

async function handleOpenPurchaseInvoice() {
  await ensurePurchaseModalReady(
    shouldRenderPurchaseInvoice,
    purchaseInvoiceModalApi,
  );
  purchaseInvoiceModalApi
    .setData({
      type: 'create',
      sourcePurchaseIn: formData.value,
    })
    .open();
}

async function handleOpenPurchasePriceAdjust() {
  await ensurePurchaseModalReady(
    shouldRenderPurchasePriceAdjust,
    purchasePriceAdjustModalApi,
  );
  purchasePriceAdjustModalApi
    .setData({
      type: 'create',
      sourcePurchaseIn: formData.value,
    })
    .open();
}

async function handleLinkedBusinessSuccess() {
  if (formData.value?.id) {
    clearRemoteItemCaches();
    formData.value = await hydratePurchaseDocumentFormSelectLabels(
      normalizeFeeAmount(
        await getPurchaseIn(formData.value.id, getPurchaseInLoadOptions()),
      ),
    );
    formData.value.items = [];
    await formApi.setValues(
      buildPurchaseDocumentDetailFormValues(formData.value, formType.value),
      false,
    );
    await nextTick();
    if (isRemoteItemPaging.value) {
      await loadPurchaseInItemPage({ pageNo: itemPageState.value.pageNo });
    } else {
      await getItemFormInstance()?.reloadItemsFromProps?.();
    }
    paymentTabReloadKey.value += 1;
  }
  emit('success');
}

async function handleCopy() {
  if (!formData.value) return;
  const fullItems = formData.value.id
    ? await loadAllPurchaseInItems(formData.value.id, { mask: false })
    : (formData.value.items ?? []);
  const draft = normalizeFeeAmount({
    ...buildPurchaseInCopiedDraft({
      ...formData.value,
      items: fullItems,
    }),
    inTime: getCurrentInTime(),
  });
  await applyFormMode('create');
  resetRemoteItemState();
  formData.value = draft;
  await refreshSupplierDeptOptions(draft.supplierId, {
    clearInvalidDept: true,
    selectedDeptId: draft.deptId,
  });
  await formApi.setValues(draft, false);
  void queueFocusFirstBasicFormControl();
}

function handleImportSuccess(data: ErpPurchaseInApi.PurchaseInImportResult) {
  const inTime = getCurrentInTime();
  const nextItems = (data.items ?? []).map((item, index) => ({
    ...item,
    seq: index + 1,
  }));
  formData.value = {
    ...formData.value,
    orderNo: data.orderNo,
    inTime,
    feeAmount: getFeeAmountFallback(formData.value),
    items: nextItems,
  };
  formApi.setValues({
    orderNo: data.orderNo,
    inTime,
    feeAmount: formData.value.feeAmount,
    items: nextItems,
  });
}

const handleUpdateItems = async (items: ErpPurchaseInApi.PurchaseInItem[]) => {
  const previousDeleteCount = remoteItemDeletes.size;
  const previousCreateCount = remoteItemCreates.size;
  recordRemoteItemChanges(items);
  formData.value.items = isRemoteItemPaging.value
    ? applyRemoteItemCache(items.filter((item) => Boolean(item.id)))
    : items;
  formApi.setValues({ items: formData.value.items });
  if (!isRemoteItemPaging.value) return;
  if (remoteItemCreates.size > previousCreateCount) {
    await loadPurchaseInItemPage({
      orderDirection: undefined,
      orderField: undefined,
      pageNo: clampRemoteItemPageNo(
        Number.MAX_SAFE_INTEGER,
        itemPageState.value.pageSize,
        itemPageState.value.total,
      ),
    });
  } else if (remoteItemDeletes.size > previousDeleteCount) {
    await loadPurchaseInItemPage({
      pageNo: clampRemoteItemPageNo(
        itemPageState.value.pageNo,
        itemPageState.value.pageSize,
        itemPageState.value.total,
      ),
    });
  }
};

async function handleAppendItems(
  items: ErpPurchaseInApi.PurchaseInItem[],
  focusField: ErpItemRowFocusField = 'count',
  preferredFocusItem?: ErpPurchaseInApi.PurchaseInItem,
) {
  if (!isRemoteItemPaging.value || items.length === 0) return;
  const previousPage = { ...itemPageState.value };
  let appendItems = items;
  const matchCandidates = items
    .map((item, itemIndex) => ({ item, itemIndex }))
    .filter(({ item }) => Boolean(item.productId));
  if (matchCandidates.length > 0 && formData.value?.id) {
    const matchResult = await matchPurchaseInItems({
      documentId: formData.value.id,
      excludedItemIds: Array.from(remoteItemDeletes),
      keys: matchCandidates.map(({ item }) => ({
        gift: Boolean(item.gift),
        productId: item.productId,
        warehouseId: item.warehouseId,
      })),
      pageSize: itemPageState.value.pageSize,
    });
    const duplicateIndexes = new Set(
      matchResult.matches.map(
        (match) => matchCandidates[match.keyIndex]?.itemIndex,
      ),
    );
    appendItems = items.filter((_, index) => !duplicateIndexes.has(index));
    if (duplicateIndexes.size > 0) {
      message.warning(`已阻止 ${duplicateIndexes.size} 条整单重复明细`);
    }
    if (appendItems.length === 0) {
      if (preferredFocusItem) {
        await loadPurchaseInItemPage({
          orderDirection: undefined,
          orderField: undefined,
          pageNo: previousPage.pageNo,
        });
        await getItemFormInstance()?.focusItemRow?.(
          preferredFocusItem,
          focusField,
        );
        return;
      }
      const targetPage = matchResult.matches[0]?.pageNo;
      if (targetPage) {
        await loadPurchaseInItemPage({
          orderDirection: undefined,
          orderField: undefined,
          pageNo: targetPage,
        });
      }
      return;
    }
  }
  const previousCreates = new Map(remoteItemCreates);
  let focusItem: ErpPurchaseInApi.PurchaseInItem | undefined;
  try {
    appendItems.forEach((sourceItem) => {
      const item = {
        ...sourceItem,
        clientRowKey: undefined,
      };
      itemRowKeyManager.ensureRowKey(item, {
        forceNew: true,
        usedKeys: new Set(remoteItemCreates.keys()),
      });
      remoteItemCreates.set(getRemoteLocalItemKey(item), item);
      focusItem ??= item;
    });
    itemPageState.value.total = getRemoteItemTotal(
      remotePersistedItemTotal,
      remoteItemCreates.size,
    );
    if (preferredFocusItem) {
      await loadPurchaseInItemPage({
        orderDirection: undefined,
        orderField: undefined,
        pageNo: previousPage.pageNo,
      });
      await getItemFormInstance()?.focusItemRow?.(
        preferredFocusItem,
        focusField,
      );
    } else {
      await loadPurchaseInItemPage({
        orderDirection: undefined,
        orderField: undefined,
        pageNo: clampRemoteItemPageNo(
          Number.MAX_SAFE_INTEGER,
          itemPageState.value.pageSize,
          itemPageState.value.total,
        ),
      });
    }
    if (!preferredFocusItem && focusItem) {
      await getItemFormInstance()?.focusItemRow?.(focusItem, focusField);
    }
  } catch (error) {
    remoteItemCreates.clear();
    previousCreates.forEach((item, key) => remoteItemCreates.set(key, item));
    itemPageState.value = previousPage;
    await loadPurchaseInItemPage(previousPage);
    message.error('新增明细定位失败，请重试');
    throw error;
  }
}

async function handleItemPageChange(payload: {
  orderDirection?: 'asc' | 'desc';
  orderField?: string;
  pageNo: number;
  pageSize: number;
}) {
  if (!isRemoteItemPaging.value) {
    return;
  }
  await loadPurchaseInItemPage(payload);
}

function handleUpdateSummary(summary: {
  totalCount: number;
  totalProductPrice: number;
  totalTaxPrice: number;
  totalPrice: number;
}) {
  // 远程分页时子表只持有当前页，不能用页小计覆盖主表的整单汇总。
  if (isRemoteItemPaging.value) {
    return;
  }
  formData.value = {
    ...formData.value,
    ...summary,
  };
  formApi.setValues(summary);
}

const handleUpdateOrder = async (order: ErpPurchaseOrderApi.PurchaseOrder) => {
  const sourceOrder = order.id
    ? await getPurchaseOrder(order.id, { includeItems: false, mask: false })
    : order;
  formData.value = {
    ...formData.value,
    orderId: sourceOrder.id,
    orderNo: sourceOrder.no,
    supplierId: sourceOrder.supplierId,
    deptId: sourceOrder.deptId,
    deptName: sourceOrder.deptName,
    accountId: sourceOrder.accountId,
    purchaser: normalizeUserField(sourceOrder.purchaser),
    purchaserName: sourceOrder.purchaserName,
    feeAmount: 0,
    otherPrice: 0,
    factoryOrderNo: sourceOrder.factoryOrderNo,
    remark: sourceOrder.remark,
    fileUrl: sourceOrder.fileUrl,
    items: [],
  };
  await refreshSupplierDeptOptions(sourceOrder.supplierId, {
    clearInvalidDept: true,
    selectedDeptId: sourceOrder.deptId,
  });
  formApi.setState({
    schema: await buildPermissionSchema(formType.value, formData.value),
  });
  await formApi.setValues(formData.value, false);
  if (sourceOrder.id) {
    orderInableItemSelectRef.value?.open(sourceOrder.id);
  }
};

async function handleSelectOrderInableItems(
  rows: (InableItem & { inQty?: string })[],
) {
  const nextItems = rows.map((item, index) => {
    const parsedInQty = parsePurchaseInQtyText(item.inQty, {
      max: item.inableCount,
    });
    const orderedCount = Number(item.orderCount || 0);
    const inCount = Number(item.inCount || 0);
    return {
      ...item,
      seq: index + 1,
      totalCount: orderedCount,
      count: parsedInQty.ok ? parsedInQty.value : Number(item.inableCount || 0),
      inCount,
      orderItemId: item.orderItemId,
      id: undefined,
      remark: item.remark ?? '',
      packageQty: item.packageQty && item.packageQty > 0 ? item.packageQty : 1,
      wholeQty: undefined,
    };
  }) as ErpPurchaseInApi.PurchaseInItem[];
  formData.value = {
    ...formData.value,
    items: nextItems,
  };
  await formApi.setValues({ items: nextItems }, false);
  await getItemFormInstance()?.reloadItemsFromProps?.();
  orderInableItemSelectRef.value?.close();
}

async function handleApprove() {
  if (!formData.value?.id) return;
  modalApi.lock();
  try {
    await updatePurchaseInStatus(formData.value.id, 20);
    message.success('审核成功');
    formData.value = await hydratePurchaseDocumentFormSelectLabels(
      normalizeFeeAmount(
        await getPurchaseIn(formData.value.id, getPurchaseInLoadOptions()),
      ),
    );
    formData.value.items = [];
    await formApi.setValues(
      buildPurchaseDocumentDetailFormValues(formData.value, formType.value),
      false,
    );
    await loadPurchaseInItemPage({ pageNo: itemPageState.value.pageNo });
    paymentTabReloadKey.value += 1;
    emit('success');
  } catch (error) {
    showPurchaseFormActionError('采购入库审核', error, '审核失败，请稍后重试');
  } finally {
    modalApi.unlock();
  }
}

function handleSubmitDraft() {
  if (!formData.value?.id) return;
  const inId = formData.value.id;
  const inNo = formData.value.no;
  AntModal.confirm({
    title: `确认提交采购入库${inNo ? ` ${inNo}` : ''}吗？`,
    content: '提交后将进入待审核状态，不能再按草稿方式修改。',
    async onOk() {
      modalApi.lock();
      try {
        await submitPurchaseIn(inId);
        skipDraftOnClose = true;
        await modalApi.close();
        emit('success');
        message.success('采购入库已提交，下一步可进行审核');
      } catch (error) {
        showPurchaseFormActionError(
          '采购入库',
          error,
          '采购入库提交失败，请稍后重试',
        );
        throw error;
      } finally {
        modalApi.unlock();
      }
    },
  });
}

async function handleEditFromDetail() {
  if (!canEditFromDetail.value || !formData.value) return;
  await switchDetailToEdit({ ...formData.value });
}

async function switchDetailToEdit(initialData: ErpPurchaseInApi.PurchaseIn) {
  if (!initialData.id) return;
  const sequence = ++detailLoadSequence;
  detailLoadError.value = '';
  detailLoading.value = true;
  skipDraftOnClose = false;
  draftSaved = false;
  draftSaving = false;
  modalApi.lock();
  isHydratingFormValues = true;
  try {
    resetRemoteItemState();
    await applyFormMode('edit', initialData);
    if (sequence !== detailLoadSequence) return;
    const loaded = await hydratePurchaseDocumentFormSelectLabels(
      hydratePurchaseSupplierFromFallback(
        normalizeFeeAmount(
          await getPurchaseIn(initialData.id, {
            includeItems: false,
            mask: false,
          }),
        ),
        initialData,
      ),
    );
    if (sequence !== detailLoadSequence) return;
    formData.value = {
      ...loaded,
      purchaser: normalizeUserField(loaded.purchaser),
      accountant: normalizeUserField(loaded.accountant),
      handler: normalizeUserField(loaded.handler),
    };
    formData.value.items = [];
    detailLoading.value = false;
    await nextTick();
    if (sequence !== detailLoadSequence) return;
    await refreshSupplierDeptOptions(formData.value.supplierId, {
      clearInvalidDept: false,
      selectedDeptId: formData.value.deptId,
    });
    if (sequence !== detailLoadSequence) return;
    formApi.setState({
      schema: await buildPermissionSchema(formType.value, formData.value),
    });
    await formApi.setValues(
      buildPurchaseDocumentDetailFormValues(formData.value, formType.value),
      false,
    );
    await loadPurchaseInItemPage({ pageNo: 1 });
    await nextTick();
  } catch (error) {
    if (sequence !== detailLoadSequence) return;
    detailLoadError.value = getErpDetailLoadError(
      error,
      '采购入库详情加载失败，请关闭后重试',
    );
    showPurchaseFormOpenError('采购入库', error);
  } finally {
    if (sequence === detailLoadSequence) {
      isHydratingFormValues = false;
      detailLoading.value = false;
      modalApi.unlock();
      void queueFocusFirstBasicFormControl(sequence);
    }
  }
}

async function buildCurrentPurchaseInPayload(
  submitItems?: ErpPurchaseInApi.PurchaseInItem[],
) {
  const values = (await formApi.getValues()) as Record<string, unknown>;
  const itemFormInstance = getItemFormInstance();
  const currentItems =
    submitItems ?? itemFormInstance?.getItems?.() ?? formData.value?.items;
  const submitValues = {
    ...formData.value,
    ...values,
    id: formData.value?.id,
    items: (currentItems ?? values.items ?? []).map((item: any) => ({
      ...stripPurchaseItemClientFields(item),
      id: formType.value === 'create' ? undefined : item.id,
      inId: formType.value === 'create' ? undefined : item.inId,
      countText: undefined,
      productCostAmount: undefined,
      productCostPrice: undefined,
      stockCount: undefined,
    })),
  } as Record<string, unknown>;
  delete submitValues.supplierPayableInfo;
  for (const field of [
    'totalCount',
    'totalProductPrice',
    'totalTaxPrice',
    'feeAmount',
    'totalFreight1',
    'totalPrice',
  ]) {
    submitValues[field] = toOptionalNumberValue(submitValues[field]);
  }
  syncFeeAmountForSubmit(submitValues);
  if (submitValues.fileUrl && Array.isArray(submitValues.fileUrl)) {
    submitValues.fileUrl =
      submitValues.fileUrl.length > 0 ? submitValues.fileUrl[0] : '';
  }
  return normalizeFeeAmount(submitValues as ErpPurchaseInApi.PurchaseIn);
}

async function savePurchaseInDraft(
  options: {
    closeOnSuccess?: boolean;
    stayOpenWhenEmpty?: boolean;
    successMessage?: string;
  } = {},
) {
  const isCreatingDraft = formType.value === 'create';
  const isUpdatingDraft = isEditingDraft.value && Boolean(formData.value?.id);
  if (
    (!isCreatingDraft && !isUpdatingDraft) ||
    skipDraftOnClose ||
    draftSaved
  ) {
    return true;
  }
  if (draftSaving) {
    return false;
  }
  draftSaving = true;
  modalApi.lock();
  try {
    const data = await buildCurrentPurchaseInPayload(
      await buildMergedRemoteItemsForSubmit(),
    );
    if (isCreatingDraft && !hasValidPurchaseDraftItems(data.items)) {
      if (!options.stayOpenWhenEmpty) {
        draftSaved = true;
      }
      message.warning('未选择明细，不生成草稿');
      return !options.stayOpenWhenEmpty;
    }
    await (isCreatingDraft
      ? createPurchaseInDraft(data)
      : updatePurchaseInDraft(data));
    draftSaved = true;
    message.success(
      options.successMessage ??
        (isCreatingDraft ? '未提交内容已自动保存为草稿' : '草稿修改已自动保存'),
    );
    emit('success');
    if (options.closeOnSuccess) {
      skipDraftOnClose = true;
      await modalApi.close();
    }
    return true;
  } catch (error) {
    showPurchaseFormActionError(
      '采购入库草稿',
      error,
      isCreatingDraft
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
  await savePurchaseInDraft({
    closeOnSuccess: true,
    stayOpenWhenEmpty: true,
    successMessage: isEditingDraft.value ? '草稿保存成功' : '草稿生成成功',
  });
}

const [Modal, modalApi] = useVbenModal({
  async onBeforeClose() {
    return savePurchaseInDraft();
  },
  async onCancel() {
    skipDraftOnClose = true;
    await modalApi.close();
  },
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    if (!hasPurchaseInItemsForSubmit()) {
      message.error('请先添加入库明细');
      return;
    }
    const itemFormInstance = getItemFormInstance();
    try {
      if (isRemoteItemPaging.value) {
        itemFormInstance?.validate(undefined, { requireItems: false });
      }
      const itemsForValidation = buildItemsForValidation();
      itemFormInstance?.validate(itemsForValidation, {
        requireItems: !isRemoteItemPaging.value,
      });
    } catch (error: any) {
      message.error(error.message || '请检查采购入库明细');
      return;
    }

    modalApi.lock();
    try {
      const submitItems = await buildMergedRemoteItemsForSubmit();
      const data = await buildCurrentPurchaseInPayload(submitItems);
      if (formType.value === 'create') {
        await createPurchaseIn(data);
      } else if (isEditingDraft.value) {
        await updateAndSubmitPurchaseInDraft(data);
      } else {
        await updatePurchaseIn(data);
      }
      skipDraftOnClose = true;
      await modalApi.close();
      emit('success');
      message.success($t('ui.actionMessage.operationSuccess'));
    } catch (error) {
      showPurchaseFormActionError(
        '采购入库',
        error,
        '采购入库保存失败，请稍后重试',
      );
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    const sequence = ++detailLoadSequence;
    detailLoading.value = false;
    detailLoadError.value = '';
    if (!isOpen) {
      formData.value = { items: [] };
      detailActiveTab.value = DETAIL_TAB_KEY;
      paymentTabReloadKey.value += 1;
      supplierDeptLoadSequence++;
      isHydratingFormValues = false;
      resetRemoteItemState();
      return;
    }
    const data = modalApi.getData<{
      id?: number;
      importData?: ErpPurchaseInApi.PurchaseInImportResult;
      initialData?: ErpPurchaseInApi.PurchaseIn;
      type: string;
    }>();
    skipDraftOnClose = false;
    draftSaved = false;
    draftSaving = false;
    detailActiveTab.value = DETAIL_TAB_KEY;
    paymentTabReloadKey.value += 1;
    detailLoading.value = Boolean(data?.id);
    modalApi.lock();
    isHydratingFormValues = Boolean(data?.id);
    try {
      await applyFormMode(data.type, data.initialData);
      if (sequence !== detailLoadSequence) return;

      if (!data?.id) {
        resetRemoteItemState();
        formData.value = {
          ...formData.value,
          inTime: getCurrentInTime(),
          feeAmount: 0,
          totalFreight1: 0,
        };
        await formApi.setValues(
          { inTime: formData.value.inTime, feeAmount: 0, totalFreight1: 0 },
          false,
        );
        const userInfo = userStore.userInfo;
        if (userInfo) {
          const defaultUserValues = buildPurchaseCurrentUserFormDefaults(
            userInfo,
            ['purchaser', 'accountant', 'handler'],
            { includeDept: true },
          );
          formData.value = {
            ...formData.value,
            ...defaultUserValues,
          };
          formApi.setState({
            schema: await buildPermissionSchema(formType.value, formData.value),
          });
          await formApi.setValues(defaultUserValues, false);
        }
        await refreshSupplierDeptOptions(formData.value.supplierId, {
          clearInvalidDept: false,
          selectedDeptId: formData.value.deptId,
        });
        if (data?.importData) {
          handleImportSuccess(data.importData);
        }
        return;
      }

      const loaded = await hydratePurchaseDocumentFormSelectLabels(
        hydratePurchaseSupplierFromFallback(
          normalizeFeeAmount(
            await getPurchaseIn(data.id, getPurchaseInLoadOptions(data.type)),
          ),
          data.initialData,
        ),
      );
      if (sequence !== detailLoadSequence) return;
      formData.value = {
        ...loaded,
        purchaser: normalizeUserField(loaded.purchaser),
        accountant: normalizeUserField(loaded.accountant),
        handler: normalizeUserField(loaded.handler),
      };
      formData.value.items = [];
      formApi.setState({
        schema: await buildPermissionSchema(formType.value, formData.value),
      });
      // The form is conditionally rendered behind the loading state. Reveal it
      // before hydrating detail/edit/copy data so the form instance can mount.
      detailLoading.value = false;
      await nextTick();
      if (sequence !== detailLoadSequence) return;
      await refreshSupplierDeptOptions(formData.value.supplierId, {
        clearInvalidDept: false,
        selectedDeptId: formData.value.deptId,
      });
      if (sequence !== detailLoadSequence) return;
      await formApi.setValues(
        buildPurchaseDocumentDetailFormValues(formData.value, formType.value),
        false,
      );
      if (['detail', 'edit'].includes(data.type)) {
        await loadPurchaseInItemPage({ pageNo: 1 });
      }
      if (data.type === 'copy') {
        await handleCopy();
      }
      await nextTick();
    } catch (error) {
      if (sequence !== detailLoadSequence) return;
      detailLoadError.value = getErpDetailLoadError(
        error,
        '采购入库详情加载失败，请关闭后重试',
      );
      showPurchaseFormOpenError('采购入库', error);
    } finally {
      if (sequence === detailLoadSequence) {
        isHydratingFormValues = false;
        detailLoading.value = false;
        modalApi.unlock();
        void queueFocusFirstBasicFormControl(sequence);
      }
    }
  },
});
</script>

<template>
  <Modal
    :title="getTitle"
    class="purchase-document-modal"
    :show-confirm-button="canConfirmForm"
    :confirm-text="confirmText"
  >
    <template v-if="!reportViewOnly" #center-footer>
      <a-button
        v-if="canGenerateDraft"
        type="default"
        @click="handleGenerateDraft"
      >
        {{ generateDraftButtonText }}
      </a-button>
    </template>
    <template v-if="!reportViewOnly" #prepend-footer>
      <a-button
        v-if="canEditFromDetail"
        type="primary"
        @click="handleEditFromDetail"
      >
        编辑
      </a-button>
      <a-button
        v-if="formType === 'detail' && formData?.status === 20"
        type="primary"
        ghost
        @click="handleOpenPurchaseInvoice"
      >
        采购票据
      </a-button>
      <a-button
        v-if="formType === 'detail' && formData?.status === 20"
        type="primary"
        ghost
        @click="handleOpenPurchasePriceAdjust"
      >
        采购调价
      </a-button>
      <a-button
        v-if="formType === 'detail' && formData?.status === 20"
        type="primary"
        ghost
        @click="handleOpenPurchaseReturn"
      >
        整单退货
      </a-button>
      <a-button
        v-if="formType === 'detail' && formData?.status === 20"
        type="primary"
        ghost
        @click="handleOpenPartialPurchaseReturn"
      >
        部分退货
      </a-button>
      <a-button
        v-if="
          formType === 'detail' &&
          formData?.status === 20 &&
          hasAccessByCodes(['erp:purchase-in:transfer-out'])
        "
        type="primary"
        ghost
        @click="handleOpenTransferOut"
      >
        调拨出库
      </a-button>
      <a-button
        v-if="
          formType === 'detail' &&
          formData?.status === 20 &&
          hasAccessByCodes(['erp:purchase-in:to-sale-cart'])
        "
        type="primary"
        ghost
        @click="handleOpenToSaleCart"
      >
        销售手推车
      </a-button>
      <a-button v-if="canApprove" type="primary" @click="handleApprove">
        审核
      </a-button>
      <a-button v-if="canSubmitDraft" type="primary" @click="handleSubmitDraft">
        提交
      </a-button>
      <a-button v-if="canEditRemark" type="primary" @click="handleEditRemark">
        修改备注
      </a-button>
      <a-button
        v-if="canPrintFromDetail"
        type="default"
        :title="detailPrintTooltip"
        @click="handlePrintFromDetail"
      >
        打印
      </a-button>
      <a-button
        v-if="formType === 'detail'"
        type="primary"
        ghost
        @click="handleCopy"
      >
        复制
      </a-button>
    </template>
    <div
      class="purchase-document-form"
      :class="{
        'purchase-document-form--editable': formType !== 'detail',
        'erp-form-focus-highlight': formType !== 'detail',
      }"
    >
      <div v-if="detailLoading" class="purchase-document-load-state">
        采购入库详情加载中...
      </div>
      <div
        v-else-if="detailLoadError"
        class="purchase-document-load-state is-error"
      >
        {{ detailLoadError }}
      </div>
      <Tabs
        v-else
        v-model:active-key="detailActiveTab"
        class="purchase-in-detail-tabs"
        :class="{
          'purchase-in-detail-tabs--hidden-nav': formType !== 'detail',
        }"
        :tab-bar-style="formType === 'detail' ? undefined : { display: 'none' }"
      >
        <Tabs.TabPane :key="DETAIL_TAB_KEY" tab="单据详情" force-render>
          <div class="purchase-document-form__content">
            <section
              ref="basicFormRef"
              class="purchase-document-section"
              @keydown.capture="handleBasicFormEnter"
            >
              <header class="purchase-document-section__header">
                <span class="purchase-document-section__title">基本信息</span>
              </header>
              <Form>
                <template #[supplierFieldSlotName]>
                  <DetailLinkInput
                    :navigable="canOpenSupplierDetail"
                    :value="formData?.supplierName"
                    @open="handleOpenSupplierDetail"
                  />
                </template>
                <template #orderNo>
                  <DetailLinkInput
                    v-if="formType === 'detail'"
                    :navigable="canOpenOrderDetail"
                    :value="formData?.orderNo"
                    @open="handleOpenOrderDetail"
                  />
                  <PurchaseOrderSelect
                    v-else
                    :order-no="formData?.orderNo"
                    :supplier-id="formData?.supplierId"
                    @update:order="handleUpdateOrder"
                  />
                </template>
              </Form>
              <div
                v-if="formType === 'detail'"
                class="purchase-in-business-status"
              >
                <span class="purchase-in-business-status__label">业务状态</span>
                <PurchaseInStatusDots :row="formData" mode="detail" />
              </div>
              <div
                v-if="formType !== 'detail'"
                class="purchase-document-payment-summary"
              >
                <SupplierPaymentSummary :supplier-id="formData?.supplierId" />
              </div>
            </section>

            <section class="purchase-document-section">
              <header class="purchase-document-section__header">
                <span class="purchase-document-section__title">入库明细</span>
              </header>
              <div class="purchase-document-items">
                <ItemForm
                  ref="itemFormRef"
                  :items="formData?.items ?? []"
                  :disabled="formType === 'detail'"
                  :enable-batch-edit="canBatchUpdateItems"
                  :in-id="formData?.id"
                  :fee-amount="getFeeAmountFallback(formData)"
                  :freight-type="formData?.freightType1"
                  :total-freight="formData?.totalFreight1 ?? 0"
                  :hidden-fields="hiddenFields"
                  :dept-id="formData?.deptId"
                  :show-import="formType === 'create'"
                  :item-page-loading="itemPageLoading"
                  :item-pagination="itemPageState"
                  :remote-paging="isRemoteItemPaging"
                  @append-items="handleAppendItems"
                  @batch-update-success="handleLinkedBusinessSuccess"
                  @page-change="handleItemPageChange"
                  @request-submit="handleLastInputEnterConfirm"
                  @update:items="handleUpdateItems"
                  @update:summary="handleUpdateSummary"
                  @import="handleOpenImport"
                />
              </div>
              <PurchaseDocumentSummary :items="documentSummaryItems" />
            </section>

            <section
              v-if="formType === 'detail' && formData"
              class="purchase-document-section purchase-document-audit"
            >
              <header class="purchase-document-section__header">
                <span class="purchase-document-section__title">审核信息</span>
              </header>
              <ErpAuditInfo :record="formData" />
            </section>
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane
          v-if="formType === 'detail'"
          :key="PAYMENT_TAB_KEY"
          tab="付款核销"
        >
          <PaymentWriteOffTab
            :active="detailActiveTab === PAYMENT_TAB_KEY"
            :can-view-payment-items="canViewFinancePaymentItems"
            :purchase-in-id="formData?.id"
            :reload-key="paymentTabReloadKey"
            :supplier-id="formData?.supplierId"
          />
        </Tabs.TabPane>
        <Tabs.TabPane
          v-if="
            formType === 'detail' &&
            formData?.id &&
            hasAccessByCodes(['erp:purchase-cost-confirmation:query'])
          "
          key="cost"
          tab="核算成本"
        >
          <CostConfirmationTab
            :active="detailActiveTab === 'cost'"
            :purchase-in-id="formData?.id"
            :reload-key="paymentTabReloadKey"
            @success="emit('success')"
          />
        </Tabs.TabPane>
      </Tabs>
    </div>
  </Modal>
  <RemarkModal @success="handleRemarkSuccess" />
  <ImportFormModal @success="handleImportSuccess" />
  <PurchaseReturnModal
    v-if="shouldRenderPurchaseReturn"
    @success="handleLinkedBusinessSuccess"
  />
  <PurchaseInvoiceModal
    v-if="shouldRenderPurchaseInvoice"
    @success="handleLinkedBusinessSuccess"
  />
  <PurchasePriceAdjustModal
    v-if="shouldRenderPurchasePriceAdjust"
    @success="handleLinkedBusinessSuccess"
  />
  <PurchaseInTransferOutForm
    ref="transferOutFormRef"
    @success="handleLinkedBusinessSuccess"
  />
  <PurchaseInToSaleCartForm
    ref="toSaleCartFormRef"
    @success="handleLinkedBusinessSuccess"
  />
  <PurchaseReturnableItemSelectModal
    ref="returnableItemSelectRef"
    @select="handleSelectPartialReturnableItems"
  />
  <PurchaseOrderInableItemSelectModal
    ref="orderInableItemSelectRef"
    @select="handleSelectOrderInableItems"
  />
  <SupplierDetailModal v-if="shouldRenderSupplierDetail" />
  <PurchaseOrderDetailModal v-if="shouldRenderPurchaseOrderDetail" />
</template>

<style scoped>
:deep(.flex-auto.overflow-hidden:has(> .relative > .erp-detail-link-field)) {
  overflow: visible;
}

.purchase-in-business-status {
  display: grid;
  min-height: 28px;
  grid-template-columns: 82px minmax(0, 1fr);
  align-items: center;
  padding: 2px 8px 4px 0;
  font-size: 12px;
}

.purchase-in-business-status__label {
  padding-right: 8px;
  color: hsl(var(--muted-foreground));
  text-align: right;
  white-space: nowrap;
}

.purchase-in-detail-tabs {
  min-width: 0;
}

.purchase-in-detail-tabs :deep(.ant-tabs-nav) {
  margin: 0 0 12px;
  padding: 0 12px;
}

.purchase-in-detail-tabs :deep(.ant-tabs-content-holder) {
  min-width: 0;
}

.purchase-in-detail-tabs--hidden-nav :deep(.ant-tabs-content-holder) {
  padding-top: 0;
}
</style>
