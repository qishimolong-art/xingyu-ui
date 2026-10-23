<script lang="ts" setup>
import type { ErpPurchaseInApi } from '#/api/erp/purchase/in';
import type { ErpPurchasePriceAdjustApi } from '#/api/erp/purchase/priceadjust';

import { computed, defineAsyncComponent, nextTick, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Modal as AntdModal, Button, message, Tabs } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getApprovedPurchaseInItemPage } from '#/api/erp/purchase/in';
import {
  createAndSubmitPurchasePriceAdjust,
  createPurchasePriceAdjustDraft,
  getPurchasePriceAdjust,
  getPurchasePriceAdjustItemPage,
  getPurchasePriceAdjustItemPageForEdit,
  matchPurchasePriceAdjustItems,
  getPurchasePriceAdjustSupplierDeptSimpleList,
  submitPurchasePriceAdjust,
  updateAndSubmitPurchasePriceAdjust,
  updatePurchasePriceAdjust,
  updatePurchasePriceAdjustDraft,
  updatePurchasePriceAdjustStatus,
} from '#/api/erp/purchase/priceadjust';
import { getStockCount } from '#/api/erp/stock/stock';
import {
  applyFieldPermission,
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import DetailLinkInput from '#/views/erp/components/DetailLinkInput.vue';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import { applyFieldConfig } from '#/views/erp/composables/useFieldConfig';
import PurchaseDocumentRemarkForm from '#/views/erp/purchase/components/PurchaseDocumentRemarkForm.vue';
import PurchaseDocumentSummary from '#/views/erp/purchase/components/PurchaseDocumentSummary.vue';
import SupplierPaymentSummary from '#/views/erp/purchase/components/SupplierPaymentSummary.vue';
import {
  buildPurchaseCurrentUserFormDefaults,
  buildPurchaseDocumentDetailFormValues,
  hydratePurchaseDocumentFormSelectLabels,
  hydratePurchaseSupplierFromFallback,
  preparePurchaseDocumentFormSchema,
  withCurrentPurchaseFormSelectOptions,
  withCurrentPurchaseSupplierOption,
} from '#/views/erp/purchase/utils/document-form';
import { hasValidPurchaseDraftItems } from '#/views/erp/purchase/utils/draft-items';
import {
  showPurchaseFormActionError,
  showPurchaseFormOpenError,
} from '#/views/erp/purchase/utils/form-error';
import { ensurePurchaseModalReady } from '#/views/erp/purchase/utils/lazy-modal';
import {
  createPurchaseItemClientRowKeyManager,
  stripPurchaseItemClientFields,
} from '#/views/erp/purchase/utils/item-row-key';
import {
  purchaseDecimalAdd,
  purchaseDecimalDivide,
  purchaseDecimalMultiply,
  purchaseDecimalSubtract,
} from '#/views/erp/purchase/utils/decimal';
import {
  clampRemoteItemPageNo,
  composeRemoteItemPage,
  getRemoteItemTotal,
  pageHasPersistedRows,
} from '#/views/erp/purchase/utils/remote-item-paging';
import { getErpDetailLoadError } from '#/views/erp/utils/detail-load-error';
import {
  buildPurchaseDetailPrintPayload,
  getPurchaseDetailPrintTooltip,
} from '#/views/erp/purchase/utils/item-print-sort';
import {
  focusFirstEditableFormControl,
  focusNextEditableFormControlOnEnter,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';

import { useReportViewOnly } from '#/views/erp/report/components/report-view-only';

import { useFormSchema } from '../data';
import { buildPurchasePriceAdjustCopyDraft } from './copy';
import ImportForm from './import-form.vue';
import ItemForm from './item-form.vue';
import PurchaseInItemSelectModal from './purchase-in-item-select-modal.vue';
import PurchaseInSelectModal from './purchase-in-select-modal.vue';
import SettlementWriteOffTab from './settlement-writeoff-tab.vue';

import '#/views/erp/purchase/styles/document-form.css';

const emit = defineEmits(['edit', 'print', 'success']);
const reportViewOnly = useReportViewOnly();
const FIELD_PERMISSION_MODULE = 'erp_purchase_price_adjust';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const { hasAccessByCodes } = useAccess();
const loadSupplierDetailComponent = () =>
  import('#/views/erp/purchase/supplier/modules/detail.vue');
const SupplierDetail = defineAsyncComponent(loadSupplierDetailComponent);
const loadPurchaseInDetailComponent = () =>
  import('#/views/erp/purchase/in/modules/form.vue');
const PurchaseInDetail = defineAsyncComponent(loadPurchaseInDetailComponent);
const [SupplierDetailModal, supplierDetailModalApi] = useVbenModal({
  connectedComponent: SupplierDetail,
  destroyOnClose: true,
});
const shouldRenderSupplierDetail = ref(false);
const [PurchaseInDetailModal, purchaseInDetailModalApi] = useVbenModal({
  connectedComponent: PurchaseInDetail,
  destroyOnClose: true,
});
const [RemarkModal, remarkModalApi] = useVbenModal({
  connectedComponent: PurchaseDocumentRemarkForm,
  destroyOnClose: true,
});
const shouldRenderPurchaseInDetail = ref(false);

async function handleOpenSupplierDetail() {
  if (!formData.value?.supplierId) return;
  await ensurePurchaseModalReady(
    shouldRenderSupplierDetail,
    supplierDetailModalApi,
    loadSupplierDetailComponent,
  );
  supplierDetailModalApi.setData({ id: formData.value.supplierId }).open();
}

async function handleOpenPurchaseInDetail(inId?: number) {
  if (!inId) return;
  await ensurePurchaseModalReady(
    shouldRenderPurchaseInDetail,
    purchaseInDetailModalApi,
    loadPurchaseInDetailComponent,
  );
  purchaseInDetailModalApi.setData({ type: 'detail', id: inId }).open();
}

const formData = ref<ErpPurchasePriceAdjustApi.PurchasePriceAdjust>({
  items: [],
  totalAdjustPrice: 0,
  adjustType: 10,
} as ErpPurchasePriceAdjustApi.PurchasePriceAdjust);
const formType = ref('');
const isPurchasePriceAdjustFormOpen = ref(false);
const detailLoading = ref(false);
const detailLoadError = ref('');
const itemPageLoading = ref(false);
const DEFAULT_ITEM_PAGE_SIZE = 10;
const DETAIL_TAB_KEY = 'detail';
const SETTLEMENT_TAB_KEY = 'settlement';
const detailActiveTab = ref(DETAIL_TAB_KEY);
const settlementTabReloadKey = ref(0);
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
    hasAccessByCodes(['erp:purchase-price-adjust:print']),
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
let supplierDeptLoadSequence = 0;
let skipDraftOnClose = false;
let draftSaved = false;
let draftSaving = false;
const canOpenSupplierDetail = computed(() =>
  Boolean(formData.value?.supplierId && formData.value?.supplierName),
);
const supplierFieldSlotName = computed(() =>
  formType.value === 'detail' ? 'supplierId' : 'supplierIdDisplay',
);
let isInitializing = false;
const itemFormRef = ref<InstanceType<typeof ItemForm>>();
const basicFormRef = ref<HTMLElement>();
const purchaseInSelectModalRef =
  ref<InstanceType<typeof PurchaseInSelectModal>>();
const purchaseInItemSelectModalRef =
  ref<InstanceType<typeof PurchaseInItemSelectModal>>();
const [ImportFormModal, importFormModalApi] = useVbenModal({
  connectedComponent: ImportForm,
  destroyOnClose: true,
});
const userStore = useUserStore();
const isRemoteItemPaging = computed(
  () =>
    Boolean(formData.value?.id) && ['detail', 'edit'].includes(formType.value),
);
const remoteItemEdits = new Map<
  number,
  ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem
>();
const remoteItemDeletes = new Set<number>();
const remoteItemCreates = new Map<
  string,
  ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem
>();
const remoteItemOriginals = new Map<
  number,
  ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem
>();
const itemRowKeyManager = createPurchaseItemClientRowKeyManager(
  'purchase-price-adjust',
);

function getItemFormInstance() {
  const instance = itemFormRef.value;
  return Array.isArray(instance) ? instance[0] : instance;
}

async function buildPermissionSchema(
  type: string,
  supplierData?: ErpPurchasePriceAdjustApi.PurchasePriceAdjust,
) {
  const configuredSchema = await applyFieldConfig(
    useFormSchema(type, [], (supplierData ?? formData.value)?.supplierId),
    'purchase_price_adjust',
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

function getCurrentTimestamp() {
  return String(Date.now());
}

const getTitle = computed(() => {
  if (formType.value === 'create') {
    return $t('ui.actionTitle.create', ['采购调价单']);
  }
  if (formType.value === 'edit') {
    return $t('ui.actionTitle.edit', ['采购调价单']);
  }
  return '采购调价单详情';
});

const canApprove = computed(
  () =>
    formType.value === 'detail' &&
    formData.value.status === 10 &&
    hasAccessByCodes(['erp:purchase-price-adjust:update-status']),
);
const isEditingDraft = computed(
  () => formType.value === 'edit' && formData.value.status === 0,
);
const canConfirmForm = computed(() => {
  if (
    formType.value === 'detail' ||
    detailLoading.value ||
    detailLoadError.value
  ) {
    return false;
  }
  if (formType.value === 'create' || isEditingDraft.value) {
    return hasAccessByCodes(['erp:purchase-price-adjust:update-status']);
  }
  return true;
});
const confirmText = computed(() =>
  formType.value === 'create' || isEditingDraft.value ? '确认提交' : '确定',
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

const canGenerateDraft = computed(
  () => formType.value === 'create' || isEditingDraft.value,
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
    hasAccessByCodes(['erp:purchase-price-adjust:update-status']),
);
const canEditFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !detailLoading.value &&
    !detailLoadError.value &&
    Boolean(formData.value.id) &&
    (formData.value.status === 0 || formData.value.status === 10) &&
    hasAccessByCodes(['erp:purchase-price-adjust:update']),
);
const canEditRemark = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    hasAccessByCodes(['erp:purchase-price-adjust:update']),
);
const canViewFinancePaymentItems = computed(() =>
  hasAccessByCodes(['erp:finance-payment:query']),
);

function getPurchasePriceAdjustLoadOptions(type = formType.value) {
  return {
    includeItems: !['copy', 'detail', 'edit'].includes(type),
    mask: type === 'detail',
  };
}

function resetRemoteItemState() {
  remoteItemEdits.clear();
  remoteItemDeletes.clear();
  remoteItemCreates.clear();
  remoteItemOriginals.clear();
  itemRowKeyManager.reset();
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

function normalizeRemoteItemForCompare(
  item: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem,
) {
  const {
    clientRowKey: _clientRowKey,
    operation: _operation,
    productUnitName: _productUnitName,
    seq: _seq,
    stockCount: _stockCount,
    totalAdjustPrice: _totalAdjustPrice,
    warehouseName: _warehouseName,
    ...rest
  } = item as any;
  rest.packageQty =
    rest.packageQty === undefined ||
    rest.packageQty === null ||
    rest.packageQty <= 0
      ? 1
      : rest.packageQty;
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

function isSameRemoteItem(
  current: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem,
  original?: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem,
) {
  if (!original) {
    return false;
  }
  return (
    JSON.stringify(normalizeRemoteItemForCompare(current)) ===
    JSON.stringify(normalizeRemoteItemForCompare(original))
  );
}

function rememberRemoteItemOriginals(
  rows: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem[] = [],
) {
  rows.forEach((item) => {
    if (item.id) {
      remoteItemOriginals.set(item.id, { ...item });
    }
  });
}

function getRemoteLocalItemKey(
  item: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem,
) {
  return itemRowKeyManager.ensureRowKey(item);
}

function applyRemoteItemCache(
  rows: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem[] = [],
) {
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

function recordRemoteItemChanges(
  rows: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem[],
) {
  if (!isRemoteItemPaging.value) {
    return;
  }
  itemRowKeyManager.ensureRowKeys(rows);
  const previousDeleteCount = remoteItemDeletes.size;
  const previousRows = formData.value?.items ?? [];
  const nextIds = new Set(rows.map((item) => item.id).filter(Boolean));
  const nextLocalKeys = new Set(
    rows.filter((item) => !item.id).map((item) => getRemoteLocalItemKey(item)),
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

async function loadPurchasePriceAdjustItemPage(
  options: {
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    pageNo?: number;
    pageSize?: number;
  } = {},
) {
  if (!formData.value?.id) {
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
      adjustId: formData.value.id,
      excludedItemIds: Array.from(remoteItemDeletes),
      mask: formType.value === 'detail',
      orderDirection: nextState.orderDirection,
      orderField: nextState.orderField,
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
    };
    const result = await (formType.value === 'edit'
      ? getPurchasePriceAdjustItemPageForEdit(request)
      : getPurchasePriceAdjustItemPage(request));
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

async function loadAllPurchasePriceAdjustItems(
  adjustId: number,
  options: { mask?: boolean } = {},
) {
  const pageSize = 200;
  const firstPage = await getPurchasePriceAdjustItemPage({
    adjustId,
    mask: options.mask ?? false,
    pageNo: 1,
    pageSize,
  });
  const rows = [...(firstPage.list ?? [])];
  const total = firstPage.total ?? rows.length;
  const pageCount = Math.ceil(total / pageSize);
  for (let pageNo = 2; pageNo <= pageCount; pageNo++) {
    const page = await getPurchasePriceAdjustItemPage({
      adjustId,
      mask: options.mask ?? false,
      pageNo,
      pageSize,
    });
    rows.push(...(page.list ?? []));
  }
  return rows;
}

async function buildMergedRemoteItemsForSubmit() {
  const currentItems = getItemFormInstance()?.getItems?.();
  if (currentItems) {
    recordRemoteItemChanges(currentItems);
  }
  if (!isRemoteItemPaging.value || !formData.value?.id) {
    return currentItems ?? formData.value?.items ?? [];
  }
  const updateItems = Array.from(remoteItemEdits.values()).map((item) => ({
    ...item,
    operation: 'update' as const,
  }));
  const insertItems = Array.from(remoteItemCreates.values()).map((item) => ({
    ...item,
    adjustId: undefined,
    id: undefined,
    operation: 'insert' as const,
  }));
  const deleteItems = Array.from(remoteItemDeletes.values()).map((id) => ({
    id,
    operation: 'delete' as const,
  })) as ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem[];
  return [...deleteItems, ...updateItems, ...insertItems];
}

function getMaskedSummaryValue(field: string, value?: number | string) {
  return formType.value === 'detail' && isFieldHidden(hiddenFields.value, field)
    ? '****'
    : value;
}

function handleEditRemark() {
  if (!formData.value?.id) return;
  remarkModalApi
    .setData({
      documentName: '采购调价单',
      documentType: 'purchase-price-adjust',
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

const calculatedOriginalTotal = computed(() =>
  purchaseDecimalAdd(
    ...(formData.value.items ?? []).map((item) =>
      purchaseDecimalMultiply(item.oldPrice || 0, item.count || 0),
    ),
  ),
);
const calculatedAdjustedTotal = computed(() =>
  purchaseDecimalAdd(
    ...(formData.value.items ?? []).map((item) =>
      purchaseDecimalMultiply(item.newPrice || 0, item.count || 0),
    ),
  ),
);
const documentSummaryItems = computed(() => [
  {
    label: '原金额',
    value: getMaskedSummaryValue(
      'oldPrice',
      formData.value.originalTotalPrice ?? calculatedOriginalTotal.value,
    ),
    kind: 'amount' as const,
  },
  {
    label: '调整后金额',
    value: getMaskedSummaryValue(
      'newPrice',
      formData.value.adjustedTotalPrice ?? calculatedAdjustedTotal.value,
    ),
    kind: 'amount' as const,
  },
  {
    label: '调价金额',
    value: getMaskedSummaryValue(
      'totalAdjustPrice',
      formData.value.totalAdjustPrice,
    ),
    kind: 'amount' as const,
    emphasis: true,
  },
]);

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    labelWidth: 82,
  },
  wrapperClass: 'purchase-document-basic-grid grid-cols-4',
  layout: 'horizontal',
  schema: preparePurchaseDocumentFormSchema(
    withCurrentPurchaseFormSelectOptions(
      useFormSchema(formType.value, [], formData.value?.supplierId),
      formData.value,
    ),
    { data: formData.value, formType: formType.value },
  ),
  showDefaultActions: false,
  handleValuesChange: async (values, changedFields) => {
    if (isInitializing) {
      if (changedFields.includes('adjustType')) {
        formData.value.adjustType = values.adjustType;
      }
      if (changedFields.includes('supplierId')) {
        formData.value.supplierId = values.supplierId;
      }
      return;
    }
    if (changedFields.includes('adjustType')) {
      formData.value.adjustType = values.adjustType;
      if (formType.value === 'create') {
        formData.value.items = [];
        formApi.setValues({ items: [] });
      }
    }
    if (changedFields.includes('supplierId')) {
      await handleSupplierChange(values.supplierId);
    }
    if (changedFields.includes('deptId')) {
      formData.value.deptId = values.deptId;
    }
  },
});

type PurchasePriceAdjustDeptFieldRef = {
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
    .getFieldComponentRef<PurchasePriceAdjustDeptFieldRef>('deptId')
    ?.updateParam?.(supplierId ? { supplierId } : {});
}

async function clearSelectedDept(warnOnClear = false) {
  await formApi.setValues({ deptId: undefined }, false);
  formData.value.deptId = undefined;
  formData.value.deptName = undefined;
  if (warnOnClear) {
    message.warning('当前部门不在该供应商可用部门范围内，已清空');
  }
}

async function refreshSupplierDeptOptions(
  supplierId?: number,
  options: {
    clearInvalidDept?: boolean;
    selectedDeptId?: number;
    warnOnClear?: boolean;
  } = {},
) {
  const sequence = ++supplierDeptLoadSequence;
  const normalizedSupplierId = normalizeOptionalNumber(supplierId);
  const selectedDeptId = normalizeOptionalNumber(options.selectedDeptId);
  updateDeptFieldSupplierParam(normalizedSupplierId);
  if (!normalizedSupplierId) {
    if (options.clearInvalidDept && selectedDeptId !== undefined) {
      await clearSelectedDept(false);
    }
    return;
  }
  if (!options.clearInvalidDept || selectedDeptId === undefined) {
    return;
  }
  const departments =
    await getPurchasePriceAdjustSupplierDeptSimpleList(normalizedSupplierId);
  if (sequence !== supplierDeptLoadSequence) {
    return;
  }
  const availableDeptIds = new Set(
    departments
      .map((dept) => normalizeOptionalNumber(dept.id))
      .filter((id): id is number => id !== undefined),
  );
  if (!availableDeptIds.has(selectedDeptId)) {
    await clearSelectedDept(Boolean(options.warnOnClear));
  }
}

async function handleSupplierChange(supplierId?: number) {
  const normalizedSupplierId = normalizeOptionalNumber(supplierId);
  const supplierChanged =
    normalizedSupplierId !==
    normalizeOptionalNumber(formData.value?.supplierId);
  const values = await formApi.getValues();
  formData.value.supplierId = normalizedSupplierId;
  await refreshSupplierDeptOptions(normalizedSupplierId, {
    clearInvalidDept: supplierChanged,
    selectedDeptId: normalizeOptionalNumber(values.deptId),
    warnOnClear:
      supplierChanged && Boolean(normalizedSupplierId && values.deptId),
  });
}

async function handleUpdateItems(
  items: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem[],
) {
  const previousDeleteCount = remoteItemDeletes.size;
  const previousCreateCount = remoteItemCreates.size;
  recordRemoteItemChanges(items);
  formData.value.items = isRemoteItemPaging.value
    ? applyRemoteItemCache(items.filter((item) => Boolean(item.id)))
    : items;
  formApi.setValues({ items: formData.value.items });
  if (
    isRemoteItemPaging.value &&
    remoteItemCreates.size > previousCreateCount
  ) {
    await loadPurchasePriceAdjustItemPage({
      orderDirection: undefined,
      orderField: undefined,
      pageNo: clampRemoteItemPageNo(
        Number.MAX_SAFE_INTEGER,
        itemPageState.value.pageSize,
        itemPageState.value.total,
      ),
    });
  } else if (
    isRemoteItemPaging.value &&
    remoteItemDeletes.size > previousDeleteCount
  ) {
    await loadPurchasePriceAdjustItemPage({
      pageNo: clampRemoteItemPageNo(
        itemPageState.value.pageNo,
        itemPageState.value.pageSize,
        itemPageState.value.total,
      ),
    });
  }
}

function handleUpdateTotalAdjustPrice(totalAdjustPrice: number) {
  if (isRemoteItemPaging.value) {
    return;
  }
  formData.value.totalAdjustPrice = totalAdjustPrice;
  formApi.setValues({ totalAdjustPrice });
}

async function handleOpenInSelect() {
  const values = await formApi.getValues();
  if (!values.supplierId) {
    message.warning('请先选择供应商');
    return;
  }
  formData.value.supplierId = values.supplierId;
  purchaseInSelectModalRef.value?.open();
}

async function handleOpenItemSelect() {
  const values = await formApi.getValues();
  if (!values.supplierId) {
    message.warning('请先选择供应商');
    return;
  }
  formData.value.supplierId = values.supplierId;
  purchaseInItemSelectModalRef.value?.open();
}

function handleOpenImport() {
  importFormModalApi.open();
}

async function reloadDetail(id: number) {
  formData.value = await hydratePurchaseDocumentFormSelectLabels(
    await getPurchasePriceAdjust(id, getPurchasePriceAdjustLoadOptions()),
  );
  if (isRemoteItemPaging.value) {
    formData.value.items = [];
  }
  formApi.setState({
    schema: await buildPermissionSchema(formType.value, formData.value),
  });
  await formApi.setValues(
    buildPurchaseDocumentDetailFormValues(formData.value, formType.value),
    false,
  );
  await refreshSupplierDeptOptions(formData.value.supplierId, {
    clearInvalidDept: formType.value !== 'detail',
    selectedDeptId: formData.value.deptId,
  });
  if (isRemoteItemPaging.value) {
    await loadPurchasePriceAdjustItemPage();
  }
}

async function handleUpdateStatus(status: number) {
  if (!formData.value.id) return;
  modalApi.lock();
  try {
    await updatePurchasePriceAdjustStatus(formData.value.id, status);
    await reloadDetail(formData.value.id);
    settlementTabReloadKey.value += 1;
    emit('success');
    message.success(status === 20 ? '审批成功' : '已驳回');
  } catch (error) {
    showPurchaseFormActionError('采购调价单', error, '审批失败，请稍后重试');
  } finally {
    modalApi.unlock();
  }
}

async function appendRemotePriceAdjustItems(
  items: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem[],
) {
  let appendItems = items;
  if (formData.value?.id) {
    const matchResult = await matchPurchasePriceAdjustItems({
      documentId: formData.value.id,
      excludedItemIds: Array.from(remoteItemDeletes),
      keys: items.map((item) => ({
        productId: item.productId,
        sourceItemId: item.inItemId,
      })),
      pageSize: itemPageState.value.pageSize,
    });
    const duplicateIndexes = new Set(
      matchResult.matches.map((match) => match.keyIndex),
    );
    appendItems = items.filter((_, index) => !duplicateIndexes.has(index));
    if (duplicateIndexes.size > 0) {
      message.warning(`已阻止 ${duplicateIndexes.size} 条整单重复明细`);
    }
    if (appendItems.length === 0) {
      const targetPage = matchResult.matches[0]?.pageNo;
      if (targetPage) {
        await loadPurchasePriceAdjustItemPage({
          orderDirection: undefined,
          orderField: undefined,
          pageNo: targetPage,
        });
      }
      return;
    }
  }
  const previousCreates = new Map(remoteItemCreates);
  const previousPage = { ...itemPageState.value };
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
    });
    itemPageState.value.total = getRemoteItemTotal(
      remotePersistedItemTotal,
      remoteItemCreates.size,
    );
    await loadPurchasePriceAdjustItemPage({
      orderDirection: undefined,
      orderField: undefined,
      pageNo: clampRemoteItemPageNo(
        Number.MAX_SAFE_INTEGER,
        itemPageState.value.pageSize,
        itemPageState.value.total,
      ),
    });
  } catch (error) {
    remoteItemCreates.clear();
    previousCreates.forEach((item, key) => remoteItemCreates.set(key, item));
    itemPageState.value = previousPage;
    await loadPurchasePriceAdjustItemPage(previousPage);
    message.error('新增明细定位失败，请重试');
    throw error;
  }
}

async function handleImportSuccess(
  data: ErpPurchasePriceAdjustApi.PurchasePriceAdjustImportResult,
) {
  const rows = data?.items || [];
  if (rows.length === 0) return;
  const existKeys = new Set(
    (formData.value.items || []).map((item) => `${item.productId}`),
  );
  const newRows: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem[] = [];
  rows.forEach((item) => {
    if (
      item.productId !== null &&
      item.productId !== undefined &&
      existKeys.has(`${item.productId}`)
    )
      return;
    newRows.push({
      productId: item.productId,
      productCode: item.productCode,
      productName: item.productName,
      productUnitName: item.productUnitName,
      weight: item.weight,
      packageQty: item.packageQty,
      vehicleModel: item.vehicleModel,
      standard: item.standard,
      featureCode: item.featureCode,
      originPlace: item.originPlace,
      brand: item.brand,
      drawingNo: item.drawingNo,
      count: item.count,
      oldPrice: item.oldPrice,
      newPrice: item.newPrice,
      remark: item.remark,
      adjustPrice: purchaseDecimalMultiply(
        purchaseDecimalSubtract(item.newPrice || 0, item.oldPrice || 0),
        item.count || 0,
      ),
    });
  });
  if (newRows.length === 0) {
    message.warning('导入明细均已存在');
    return;
  }
  if (isRemoteItemPaging.value) {
    await appendRemotePriceAdjustItems(newRows);
  } else {
    const merged = [...(formData.value.items || []), ...newRows];
    formData.value.items = merged;
    formApi.setValues({ items: merged });
  }
  message.success(`已导入 ${newRows.length} 条明细`);
}

async function resolveStockCount(productId?: number, warehouseId?: number) {
  if (!productId) return undefined;
  return (await getStockCount(productId, warehouseId)) || 0;
}

async function loadSelectedPurchaseInAdjustItems(
  supplierId: number,
  inIds: number[],
) {
  const pageSize = 200;
  let pageNo = 1;
  const rows: ErpPurchaseInApi.PurchaseInItemForAdjust[] = [];
  while (true) {
    const pageResult = await getApprovedPurchaseInItemPage({
      supplierId,
      inIds,
      excludeAdjusted: false,
      excludeInvoiced: true,
      pageNo,
      pageSize,
    });
    rows.push(...(pageResult?.list || []));
    if (rows.length >= (pageResult?.total || 0)) {
      break;
    }
    pageNo += 1;
  }
  return rows;
}

async function handleSelectPurchaseIn(
  rows: Array<{
    adjustRatio: number;
    inRow: ErpPurchaseInApi.PurchaseInForAdjust;
  }>,
) {
  if (!formData.value.supplierId) return;
  const alreadyInIds = new Set(usedInIds.value);
  const uninvoicedRows = rows.filter(({ inRow }) => !inRow.hasInvoice);
  if (uninvoicedRows.length < rows.length) {
    message.warning(
      `已忽略 ${rows.length - uninvoicedRows.length} 张已开票入库单（已完成采购票据开具后不能调价）`,
    );
  }
  const filtered = uninvoicedRows.filter(
    ({ inRow }) => !alreadyInIds.has(inRow.id),
  );
  if (filtered.length < rows.length) {
    message.warning(
      `已忽略 ${rows.length - filtered.length} 张重复的入库单（同一入库单只能加入一次）`,
    );
  }
  if (filtered.length === 0) return;
  const ratioByInId: Record<number, number> = {};
  const inNoByInId: Record<number, string> = {};
  const inIds = new Set<number>();
  filtered.forEach(({ inRow, adjustRatio }) => {
    inIds.add(inRow.id);
    ratioByInId[inRow.id] = adjustRatio;
    inNoByInId[inRow.id] = inRow.no;
  });
  const allItems = await loadSelectedPurchaseInAdjustItems(
    formData.value.supplierId,
    [...inIds],
  );
  const newRows: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem[] = [];
  for (const item of (allItems || []).filter(
    (item) => inIds.has(item.inId) && !item.hasInvoice,
  )) {
    const ratio = ratioByInId[item.inId] ?? 100;
    const oldPrice = Number(item.productPrice) || 0;
    const newPrice = purchaseDecimalMultiply(
      oldPrice,
      purchaseDecimalDivide(ratio, 100),
    );
    const count = Number(item.count) || 0;
    const adjustPrice = purchaseDecimalMultiply(
      purchaseDecimalSubtract(newPrice, oldPrice),
      count,
    );
    const stockCount =
      item.stockCount ??
      (await resolveStockCount(item.productId, item.warehouseId));
    newRows.push({
      inId: item.inId,
      inNo: inNoByInId[item.inId] || item.inNo,
      inItemId: item.id,
      batchNo: item.batchNo,
      productId: item.productId,
      warehouseId: item.warehouseId,
      deptId: item.deptId,
      oldPrice,
      newPrice,
      stockCount,
      count,
      adjustRatio: ratio,
      adjustPrice,
      productCode: item.productCode,
      productName: item.productName,
      productUnitId: item.productUnitId,
      productUnitName: item.productUnitName,
      weight: item.weight,
      packageQty: item.packageQty,
      vehicleModel: item.vehicleModel,
      standard: item.standard,
      featureCode: item.featureCode,
      originPlace: item.originPlace,
      brand: item.brand,
      drawingNo: item.drawingNo,
      warehousePosition: item.warehousePosition,
      remark: undefined,
    });
  }
  if (newRows.length === 0) {
    message.warning('所选入库单没有可用明细');
    return;
  }
  if (isRemoteItemPaging.value) {
    await appendRemotePriceAdjustItems(newRows);
  } else {
    const merged = [...(formData.value.items || []), ...newRows];
    formData.value.items = merged;
    formApi.setValues({ items: merged });
  }
  message.success(`已加载 ${newRows.length} 条明细`);
}

async function handleSelectPurchaseInItem(
  rows: Array<{
    itemRow: ErpPurchaseInApi.PurchaseInItemForAdjust;
    newPrice: number;
  }>,
) {
  const existKeys = new Set(
    (formData.value.items || []).map((item) => `${item.inItemId}`),
  );
  const newRows: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem[] = [];
  for (const { itemRow, newPrice } of rows) {
    if (existKeys.has(`${itemRow.id}`)) continue;
    const oldPrice = Number(itemRow.productPrice) || 0;
    const count = Number(itemRow.count) || 0;
    const np = Number(newPrice) || 0;
    const adjustPrice = purchaseDecimalMultiply(
      purchaseDecimalSubtract(np, oldPrice),
      count,
    );
    const stockCount =
      itemRow.stockCount ??
      (await resolveStockCount(itemRow.productId, itemRow.warehouseId));
    newRows.push({
      inId: itemRow.inId,
      inNo: itemRow.inNo,
      inItemId: itemRow.id,
      batchNo: itemRow.batchNo,
      productId: itemRow.productId,
      warehouseId: itemRow.warehouseId,
      deptId: itemRow.deptId,
      oldPrice,
      newPrice: np,
      stockCount,
      count,
      adjustRatio: undefined,
      adjustPrice,
      productCode: itemRow.productCode,
      productName: itemRow.productName,
      productUnitId: itemRow.productUnitId,
      productUnitName: itemRow.productUnitName,
      weight: itemRow.weight,
      packageQty: itemRow.packageQty,
      vehicleModel: itemRow.vehicleModel,
      standard: itemRow.standard,
      featureCode: itemRow.featureCode,
      originPlace: itemRow.originPlace,
      brand: itemRow.brand,
      drawingNo: itemRow.drawingNo,
      warehousePosition: itemRow.warehousePosition,
      remark: undefined,
    });
  }
  if (newRows.length === 0) {
    message.warning('所选明细均已在子表中');
    return;
  }
  if (isRemoteItemPaging.value) {
    await appendRemotePriceAdjustItems(newRows);
  } else {
    const merged = [...(formData.value.items || []), ...newRows];
    formData.value.items = merged;
    formApi.setValues({ items: merged });
  }
  message.success(`已加载 ${newRows.length} 条明细`);
}

async function buildCurrentPriceAdjustPayload() {
  const data =
    (await formApi.getValues()) as ErpPurchasePriceAdjustApi.PurchasePriceAdjust;
  const currentItems = await buildMergedRemoteItemsForSubmit();
  delete (data as Record<string, unknown>).supplierPayableInfo;
  data.items = ((currentItems ?? formData.value.items) || []).map(
    (item: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem) => ({
      ...stripPurchaseItemClientFields(item),
      id: formType.value === 'create' ? undefined : item.id,
    }),
  );
  return data;
}

function handleSubmitDraftFromDetail() {
  if (!formData.value.id) return;
  const id = formData.value.id;
  AntdModal.confirm({
    title: `确认提交草稿 ${formData.value.no || ''} 吗？`,
    content: '提交后将进入待审批状态，不能再按草稿方式修改。',
    async onOk() {
      modalApi.lock();
      try {
        await submitPurchasePriceAdjust(id);
        skipDraftOnClose = true;
        await modalApi.close();
        emit('success');
        message.success('草稿已提交，当前状态为待审批');
      } catch (error) {
        showPurchaseFormActionError(
          '采购调价单',
          error,
          '草稿提交失败，请稍后重试',
        );
      } finally {
        modalApi.unlock();
      }
    },
  });
}

async function handleEditFromDetail() {
  if (!canEditFromDetail.value) return;
  await switchDetailToEdit({ ...formData.value });
}

async function switchDetailToEdit(
  initialData: ErpPurchasePriceAdjustApi.PurchasePriceAdjust,
) {
  if (!initialData.id) return;
  const sequence = ++detailLoadSequence;
  detailLoadError.value = '';
  detailLoading.value = true;
  skipDraftOnClose = false;
  draftSaved = false;
  draftSaving = false;
  modalApi.lock();
  isInitializing = true;
  try {
    formType.value = 'edit';
    await loadHiddenFields();
    formApi.setDisabled(false);
    formApi.setState({
      schema: await buildPermissionSchema('edit', initialData),
    });
    await nextTick();
    if (sequence !== detailLoadSequence) return;
    const loaded = await hydratePurchaseDocumentFormSelectLabels(
      hydratePurchaseSupplierFromFallback(
        await getPurchasePriceAdjust(initialData.id, {
          includeItems: false,
          mask: false,
        }),
        initialData,
      ),
    );
    if (sequence !== detailLoadSequence) return;
    resetRemoteItemState();
    loaded.items = [];
    formData.value = loaded;
    formApi.setState({
      schema: await buildPermissionSchema(formType.value, formData.value),
    });
    detailLoading.value = false;
    await nextTick();
    if (sequence !== detailLoadSequence) return;
    await formApi.setValues(
      buildPurchaseDocumentDetailFormValues(formData.value, formType.value),
      false,
    );
    await refreshSupplierDeptOptions(formData.value.supplierId, {
      clearInvalidDept: true,
      selectedDeptId: formData.value.deptId,
      warnOnClear: Boolean(formData.value.deptId),
    });
    await nextTick();
    if (sequence !== detailLoadSequence) return;
    await loadPurchasePriceAdjustItemPage({ pageNo: 1 });
  } catch (error) {
    if (sequence !== detailLoadSequence) return;
    detailLoadError.value = '采购调价详情加载失败，请关闭后重试';
    showPurchaseFormOpenError('采购调价', error);
  } finally {
    if (sequence === detailLoadSequence) {
      isInitializing = false;
      detailLoading.value = false;
      modalApi.unlock();
      void queueFocusFirstBasicFormControl(sequence);
    }
  }
}

async function savePurchasePriceAdjustDraft(
  options: {
    closeOnSuccess?: boolean;
    stayOpenWhenEmpty?: boolean;
    successMessage?: string;
  } = {},
) {
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
    const data = await buildCurrentPriceAdjustPayload();
    if (
      isCreatingDraft &&
      !hasValidPurchaseDraftItems(data.items, {
        requireNewPrice: true,
        requireSourceInItem: (data.adjustType ?? 10) === 10,
        requireWarehouse: false,
      })
    ) {
      if (!options.stayOpenWhenEmpty) {
        draftSaved = true;
      }
      message.warning('未选择明细，不生成草稿');
      return !options.stayOpenWhenEmpty;
    }
    if (isCreatingDraft) {
      await createPurchasePriceAdjustDraft(data);
    } else {
      data.id = formData.value.id;
      await updatePurchasePriceAdjustDraft(data);
    }
    draftSaved = true;
    emit('success');
    message.success(
      options.successMessage ??
        (isCreatingDraft ? '未提交内容已自动保存为草稿' : '草稿修改已自动保存'),
    );
    if (options.closeOnSuccess) {
      skipDraftOnClose = true;
      await modalApi.close();
    }
    return true;
  } catch (error) {
    showPurchaseFormActionError(
      '采购调价单',
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
  await savePurchasePriceAdjustDraft({
    closeOnSuccess: true,
    stayOpenWhenEmpty: true,
    successMessage: isEditingDraft.value ? '草稿保存成功' : '草稿生成成功',
  });
}

const [Modal, modalApi] = useVbenModal({
  async onBeforeClose() {
    return savePurchasePriceAdjustDraft();
  },
  async onCancel() {
    skipDraftOnClose = true;
    await modalApi.close();
  },
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    const itemFormInstance = getItemFormInstance();
    try {
      itemFormInstance?.validate();
    } catch (error: any) {
      message.error(error.message || '子表校验失败');
      return;
    }

    modalApi.lock();
    try {
      const data = await buildCurrentPriceAdjustPayload();
      if (formType.value === 'create') {
        await createAndSubmitPurchasePriceAdjust(data);
      } else if (isEditingDraft.value) {
        data.id = formData.value.id;
        await updateAndSubmitPurchasePriceAdjust(data);
      } else {
        await updatePurchasePriceAdjust(data);
      }
      skipDraftOnClose = true;
      await modalApi.close();
      emit('success');
      message.success($t('ui.actionMessage.operationSuccess'));
    } catch (error) {
      showPurchaseFormActionError('采购调价单', error);
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    isPurchasePriceAdjustFormOpen.value = isOpen;
    const sequence = ++detailLoadSequence;
    detailLoading.value = false;
    detailLoadError.value = '';
    if (!isOpen) {
      supplierDeptLoadSequence += 1;
      isInitializing = false;
      resetRemoteItemState();
      detailActiveTab.value = DETAIL_TAB_KEY;
      settlementTabReloadKey.value += 1;
      formData.value = {
        items: [],
        totalAdjustPrice: 0,
        adjustType: 10,
      } as ErpPurchasePriceAdjustApi.PurchasePriceAdjust;
      return;
    }
    skipDraftOnClose = false;
    draftSaved = false;
    draftSaving = false;
    resetRemoteItemState();
    detailActiveTab.value = DETAIL_TAB_KEY;
    settlementTabReloadKey.value += 1;
    modalApi.setState({ fullscreen: true });
    const data = modalApi.getData<{
      id?: number;
      initialData?: ErpPurchasePriceAdjustApi.PurchasePriceAdjust;
      sourcePurchaseIn?: ErpPurchaseInApi.PurchaseIn;
      type: string;
    }>();
    detailLoading.value = Boolean(data?.id);
    isInitializing = Boolean(data?.id);
    if (data?.id) {
      modalApi.lock();
    }
    try {
      formType.value = data.type;
      await loadHiddenFields();
      formApi.setDisabled(formType.value === 'detail');
      formApi.setState({
        schema: await buildPermissionSchema(formType.value, data.initialData),
      });
      await nextTick();
      if (sequence !== detailLoadSequence) return;

      if (!data || !data.id) {
        const userInfo = userStore.userInfo;
        const defaultUserValues = buildPurchaseCurrentUserFormDefaults(
          userInfo,
          ['adjuster'],
          { includeDept: true },
        );
        formData.value = {
          items: [],
          totalAdjustPrice: 0,
          adjustType: 10,
          adjustTime: getCurrentTimestamp(),
          ...defaultUserValues,
          supplierId: data?.sourcePurchaseIn?.supplierId,
          supplierName: data?.sourcePurchaseIn?.supplierName,
          deptId: data?.sourcePurchaseIn?.deptId ?? defaultUserValues.deptId,
          deptName:
            data?.sourcePurchaseIn?.deptName ?? defaultUserValues.deptName,
        } as ErpPurchasePriceAdjustApi.PurchasePriceAdjust;
        isInitializing = true;
        try {
          formApi.setState({
            schema: await buildPermissionSchema(formType.value, formData.value),
          });
          await formApi.setValues(
            {
              adjustType: 10,
              adjustTime: formData.value.adjustTime,
              ...defaultUserValues,
              supplierId: data?.sourcePurchaseIn?.supplierId,
              supplierName: data?.sourcePurchaseIn?.supplierName,
              deptId: formData.value.deptId,
              deptName: formData.value.deptName,
              totalAdjustPrice: 0,
              items: [],
            },
            false,
          );
          await nextTick();
        } finally {
          isInitializing = false;
        }
        await refreshSupplierDeptOptions(formData.value.supplierId, {
          clearInvalidDept: true,
          selectedDeptId: formData.value.deptId,
          warnOnClear: Boolean(
            formData.value.supplierId && formData.value.deptId,
          ),
        });
        if (data?.sourcePurchaseIn) {
          await handleSelectPurchaseIn([
            {
              adjustRatio: 100,
              inRow: {
                id: data.sourcePurchaseIn.id!,
                no: data.sourcePurchaseIn.no!,
                supplierId: data.sourcePurchaseIn.supplierId!,
              } as ErpPurchaseInApi.PurchaseInForAdjust,
            },
          ]);
        }
        return;
      }
      const loaded = await hydratePurchaseDocumentFormSelectLabels(
        hydratePurchaseSupplierFromFallback(
          await getPurchasePriceAdjust(
            data.id,
            getPurchasePriceAdjustLoadOptions(data.type),
          ),
          data.initialData,
        ),
      );
      if (sequence !== detailLoadSequence) return;
      formData.value = loaded;
      if (['copy', 'detail', 'edit'].includes(data.type)) {
        formData.value.items = [];
      }
      formApi.setState({
        schema: await buildPermissionSchema(formType.value, formData.value),
      });
      // The form and item grid are rendered behind the loading branch. Reveal
      // them before hydrating detail/edit/copy data so their instances mount.
      detailLoading.value = false;
      await nextTick();
      if (sequence !== detailLoadSequence) return;
      await formApi.setValues(
        buildPurchaseDocumentDetailFormValues(formData.value, formType.value),
        false,
      );
      await refreshSupplierDeptOptions(formData.value.supplierId, {
        clearInvalidDept: data.type !== 'detail',
        selectedDeptId: formData.value.deptId,
        warnOnClear: data.type !== 'detail' && Boolean(formData.value.deptId),
      });
      await nextTick();
      if (data.type === 'copy') {
        const sourceItems = await loadAllPurchasePriceAdjustItems(data.id, {
          mask: false,
        });
        const draft = buildPurchasePriceAdjustCopyDraft({
          ...formData.value,
          items: sourceItems,
        });
        formType.value = 'create';
        resetRemoteItemState();
        formApi.setDisabled(false);
        formData.value = draft;
        isInitializing = true;
        try {
          await formApi.setState({
            schema: await buildPermissionSchema('create'),
          });
          await formApi.setValues(draft, false);
          await refreshSupplierDeptOptions(draft.supplierId, {
            clearInvalidDept: true,
            selectedDeptId: draft.deptId,
            warnOnClear: Boolean(draft.deptId),
          });
          await nextTick();
        } finally {
          isInitializing = false;
        }
      } else if (isRemoteItemPaging.value) {
        await loadPurchasePriceAdjustItemPage({ pageNo: 1 });
      }
    } catch (error) {
      if (sequence !== detailLoadSequence) return;
      detailLoadError.value = getErpDetailLoadError(
        error,
        '采购调价单详情加载失败，请关闭后重试',
      );
      showPurchaseFormOpenError('采购调价单', error);
    } finally {
      if (sequence === detailLoadSequence) {
        isInitializing = false;
        detailLoading.value = false;
        modalApi.unlock();
        void queueFocusFirstBasicFormControl(sequence);
      }
    }
  },
});

const itemDisabled = computed(() => formType.value === 'detail');
const isByInOrder = computed(() => (formData.value.adjustType ?? 10) === 10);

const usedInIds = computed<number[]>(() => {
  const ids = new Set<number>();
  const items = [
    ...(formData.value.items || []),
    ...remoteItemOriginals.values(),
    ...remoteItemEdits.values(),
    ...remoteItemCreates.values(),
  ];
  items.forEach((item) => {
    if (item.id && remoteItemDeletes.has(item.id)) return;
    if (item.inId !== null && item.inId !== undefined) ids.add(item.inId);
  });
  return [...ids];
});
</script>

<template>
  <Modal
    :title="getTitle"
    class="purchase-document-modal"
    :confirm-text="confirmText"
    :show-confirm-button="canConfirmForm && !detailLoading && !detailLoadError"
  >
    <template v-if="!reportViewOnly" #center-footer>
      <Button
        v-if="canGenerateDraft"
        type="default"
        @click="handleGenerateDraft"
      >
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
      <Button v-if="canApprove" type="primary" @click="handleUpdateStatus(20)">
        审批
      </Button>
      <Button v-if="canEditRemark" type="primary" @click="handleEditRemark">
        修改备注
      </Button>
      <Button
        v-if="canPrintFromDetail"
        type="default"
        :title="detailPrintTooltip"
        @click="handlePrintFromDetail"
      >
        打印
      </Button>
    </template>
    <div
      class="purchase-document-form"
      :class="{
        'erp-form-focus-highlight': formType !== 'detail',
        'purchase-document-form--editable': formType !== 'detail',
      }"
    >
      <div v-if="detailLoading" class="purchase-document-load-state">
        采购调价单详情加载中...
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
        class="purchase-price-adjust-detail-tabs"
        :class="{
          'purchase-price-adjust-detail-tabs--hidden-nav':
            formType !== 'detail',
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
              </Form>
              <div
                v-if="formType !== 'detail'"
                class="purchase-document-payment-summary"
              >
                <SupplierPaymentSummary :supplier-id="formData?.supplierId" />
              </div>
            </section>

            <section class="purchase-document-section">
              <header class="purchase-document-section__header">
                <span class="purchase-document-section__title">调价明细</span>
              </header>
              <div class="purchase-document-items">
                <ItemForm
                  ref="itemFormRef"
                  :items="formData?.items ?? []"
                  :disabled="itemDisabled"
                  :adjust-type="formData?.adjustType ?? 10"
                  :form-type="formType"
                  :hidden-fields="hiddenFields"
                  :item-page-loading="itemPageLoading"
                  :item-pagination="itemPageState"
                  :remote-paging="isRemoteItemPaging"
                  :shortcut-active="isPurchasePriceAdjustFormOpen"
                  @page-change="loadPurchasePriceAdjustItemPage"
                  @update:items="handleUpdateItems"
                  @update:total-adjust-price="handleUpdateTotalAdjustPrice"
                  @open-in-detail="handleOpenPurchaseInDetail"
                >
                  <template #toolbar>
                    <Button
                      v-if="!itemDisabled && isByInOrder"
                      type="primary"
                      @click="handleOpenInSelect"
                    >
                      选择入库单
                    </Button>
                    <Button
                      v-if="!itemDisabled && !isByInOrder"
                      type="primary"
                      ghost
                      @click="handleOpenImport"
                    >
                      导入明细
                    </Button>
                    <Button
                      v-if="!itemDisabled && !isByInOrder"
                      type="primary"
                      @click="handleOpenItemSelect"
                    >
                      添加明细
                    </Button>
                  </template>
                </ItemForm>
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
          :key="SETTLEMENT_TAB_KEY"
          tab="结算核销"
        >
          <SettlementWriteOffTab
            :active="detailActiveTab === SETTLEMENT_TAB_KEY"
            :adjust-id="formData?.id"
            :can-view-payment-items="canViewFinancePaymentItems"
            :reload-key="settlementTabReloadKey"
            :supplier-id="formData?.supplierId"
          />
        </Tabs.TabPane>
      </Tabs>
    </div>
    <PurchaseInSelectModal
      ref="purchaseInSelectModalRef"
      :supplier-id="formData?.supplierId"
      :used-in-ids="usedInIds"
      @select="handleSelectPurchaseIn"
    />
    <PurchaseInItemSelectModal
      ref="purchaseInItemSelectModalRef"
      :supplier-id="formData?.supplierId"
      @select="handleSelectPurchaseInItem"
    />
    <ImportFormModal @success="handleImportSuccess" />
  </Modal>
  <RemarkModal @success="handleRemarkSuccess" />
  <SupplierDetailModal v-if="shouldRenderSupplierDetail" />
  <PurchaseInDetailModal v-if="shouldRenderPurchaseInDetail" />
</template>

<style scoped>
:deep(.flex-auto.overflow-hidden:has(> .relative > .erp-detail-link-field)) {
  overflow: visible;
}

:deep(.purchase-price-adjust-type-radio .ant-radio-wrapper),
:deep(.purchase-price-adjust-type-radio .ant-radio-wrapper span) {
  font-size: 12px;
}

.purchase-price-adjust-detail-tabs {
  min-width: 0;
}

.purchase-price-adjust-detail-tabs :deep(.ant-tabs-nav) {
  margin: 0 0 12px;
  padding: 0 12px;
}

.purchase-price-adjust-detail-tabs :deep(.ant-tabs-content-holder) {
  min-width: 0;
}

.purchase-price-adjust-detail-tabs--hidden-nav :deep(.ant-tabs-content-holder) {
  padding-top: 0;
}
</style>
