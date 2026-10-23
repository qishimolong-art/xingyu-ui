<script lang="ts" setup>
import type { ErpPurchaseInApi } from '#/api/erp/purchase/in';
import type { ErpPurchaseInvoiceApi } from '#/api/erp/purchase/invoice';

import { computed, defineAsyncComponent, nextTick, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';
import { useUserStore } from '@vben/stores';

import { Modal as AntModal, message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { useVbenForm } from '#/adapter/form';
import {
  createPurchaseInvoice,
  createPurchaseInvoiceDraft,
  getPurchaseInvoice,
  getPurchaseInvoiceItemPage,
  getPurchaseInvoiceItemPageForEdit,
  getPurchaseInvoiceMixedSourceItemPage,
  getPurchaseInvoiceSupplierDeptSimpleList,
  PURCHASE_INVOICE_SOURCE_TYPE,
  PURCHASE_INVOICE_STATUS,
  submitPurchaseInvoice,
  updateAndSubmitPurchaseInvoiceDraft,
  updatePurchaseInvoice,
  updatePurchaseInvoiceDraft,
  updatePurchaseInvoiceStatus,
} from '#/api/erp/purchase/invoice';
import {
  applyFieldPermission,
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
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
import {
  showPurchaseFormActionError,
  showPurchaseFormOpenError,
} from '#/views/erp/purchase/utils/form-error';
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
import { toOptionalNumberValue } from '#/views/erp/purchase/utils/text-number';
import {
  focusFirstEditableFormControl,
  focusNextEditableFormControlOnEnter,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';
import { getCurrentLocalDate } from '#/views/erp/utils/form-defaults';
import {
  buildPurchaseDetailPrintPayload,
  getPurchaseDetailPrintTooltip,
} from '#/views/erp/purchase/utils/item-print-sort';

import { useReportViewOnly } from '#/views/erp/report/components/report-view-only';

import { useFormSchema } from '../data';
import ItemForm from './item-form.vue';
import PurchaseInSelect from './purchase-in-select.vue';
import { normalizePurchaseInvoiceSourceRefs } from './source-selection';

import '#/views/erp/purchase/styles/document-form.css';

const emit = defineEmits(['edit', 'print', 'success']);
const reportViewOnly = useReportViewOnly();
const FIELD_PERMISSION_MODULE = 'erp_purchase_invoice';
const userStore = useUserStore();
const { hasAccessByCodes } = useAccess();
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
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

const formData = ref<ErpPurchaseInvoiceApi.PurchaseInvoice>({
  invoiceCount: 1,
  items: [],
});
const formType = ref('');
const isPurchaseInvoiceFormOpen = ref(false);
const detailLoading = ref(false);
const detailLoadError = ref('');
const itemPageLoading = ref(false);
const DEFAULT_ITEM_PAGE_SIZE = 10;
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
    hasAccessByCodes(['erp:purchase-invoice:print']),
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
let isHydratingFormValues = false;
const canOpenSupplierDetail = computed(() =>
  Boolean(formData.value?.supplierId && formData.value?.supplierName),
);
const supplierFieldSlotName = computed(() =>
  formType.value === 'detail' ? 'supplierId' : 'supplierIdDisplay',
);
const itemFormRef = ref<InstanceType<typeof ItemForm>>();
const basicFormRef = ref<HTMLElement>();
const purchaseInSelectRef = ref<InstanceType<typeof PurchaseInSelect>>();
const selectedSourceRefs = ref<
  ErpPurchaseInvoiceApi.PurchaseInvoiceSourceRef[]
>([]);
const persistedSourceRefs = ref<
  ErpPurchaseInvoiceApi.PurchaseInvoiceSourceRef[]
>([]);
let syncPurchaseInRevision = 0;
const isRemoteItemPaging = computed(
  () =>
    Boolean(formData.value?.id) && ['detail', 'edit'].includes(formType.value),
);
const isSourceSelectionActive = computed(
  () => formType.value !== 'detail' && selectedSourceRefs.value.length > 0,
);
const isSourceInItemPaging = computed(
  () => !formData.value?.id && isSourceSelectionActive.value,
);
const isItemRemotePaging = computed(
  () => isRemoteItemPaging.value || isSourceInItemPaging.value,
);
const remoteItemEdits = new Map<
  number,
  ErpPurchaseInvoiceApi.PurchaseInvoiceItem
>();
const remoteItemDeletes = new Set<number>();
const remoteItemCreates = new Map<
  string,
  ErpPurchaseInvoiceApi.PurchaseInvoiceItem
>();
const remoteItemOriginals = new Map<
  number,
  ErpPurchaseInvoiceApi.PurchaseInvoiceItem
>();
const itemRowKeyManager =
  createPurchaseItemClientRowKeyManager('purchase-invoice');
const persistedSourceSelectionDeleteIds = new Set<number>();
let existingInvoiceItemsCache:
  | ErpPurchaseInvoiceApi.PurchaseInvoiceItem[]
  | undefined;
let existingInvoiceItemsLoadPromise:
  | Promise<ErpPurchaseInvoiceApi.PurchaseInvoiceItem[]>
  | undefined;
let persistedSourceSelectionRevision = 0;
const sourceDocumentMap = new Map<
  string,
  ErpPurchaseInvoiceApi.PurchaseInvoiceSourceDocument
>();
const sourceItemOriginals = new Map<
  string,
  ErpPurchaseInvoiceApi.PurchaseInvoiceItem
>();
const sourceItemEdits = new Map<
  string,
  ErpPurchaseInvoiceApi.PurchaseInvoiceItem
>();
const sourceItemDeletes = new Set<string>();
const sourceManualItems = new Map<
  string,
  ErpPurchaseInvoiceApi.PurchaseInvoiceItem
>();
const existingSourceDocumentAmounts = new Map<string, number>();
const sourceAppendBaseTotalAmount = ref(0);

function getItemFormInstance() {
  const instance = itemFormRef.value;
  return Array.isArray(instance) ? instance[0] : instance;
}

function normalizeInvoiceDate(value: unknown) {
  if (value === null || value === undefined || value === '') return value;
  if (dayjs.isDayjs(value)) {
    return value.isValid() ? value.format('YYYY-MM-DD') : undefined;
  }
  if (value instanceof Date) {
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined;
  }
  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day] = value;
    if ([year, month, day].every((item) => typeof item === 'number')) {
      const parsed = dayjs(new Date(year, month - 1, day));
      return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined;
    }
  }
  if (typeof value === 'number') {
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return value;
    const parsed = /^\d+$/.test(trimmed)
      ? dayjs(Number(trimmed))
      : dayjs(trimmed.replace(' ', 'T'));
    return parsed.isValid() ? parsed.format('YYYY-MM-DD') : trimmed;
  }
  const parsed = dayjs(value as any);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : value;
}

function buildFormValues(data: ErpPurchaseInvoiceApi.PurchaseInvoice) {
  const { items: _items, ...mainValues } = data;
  return {
    ...mainValues,
    invoiceDate: normalizeInvoiceDate(mainValues.invoiceDate),
  };
}

function buildCopyDraft(data: ErpPurchaseInvoiceApi.PurchaseInvoice) {
  return {
    ...data,
    id: undefined,
    no: undefined,
    status: undefined,
    creator: undefined,
    creatorName: undefined,
    createTime: undefined,
    updater: undefined,
    updaterName: undefined,
    updateTime: undefined,
    items: (data.items ?? []).map((item, index) => ({
      ...item,
      clientRowKey: undefined,
      id: undefined,
      seq: index + 1,
    })),
  } as ErpPurchaseInvoiceApi.PurchaseInvoice;
}

const formRenderKey = computed(
  () => `${formType.value}-${formData.value?.id ?? 'new'}`,
);

const getTitle = computed(() => {
  if (formType.value === 'create')
    return $t('ui.actionTitle.create', ['采购票据']);
  if (formType.value === 'edit') return $t('ui.actionTitle.edit', ['采购票据']);
  return '采购票据详情';
});

const canApprove = computed(
  () =>
    formType.value === 'detail' &&
    formData.value?.status === PURCHASE_INVOICE_STATUS.PROCESS &&
    hasAccessByCodes(['erp:purchase-invoice:update-status']),
);
const isEditingDraft = computed(
  () =>
    formType.value === 'edit' &&
    formData.value?.status === PURCHASE_INVOICE_STATUS.DRAFT,
);
const canSubmitDraft = computed(
  () =>
    formType.value === 'detail' &&
    formData.value?.status === PURCHASE_INVOICE_STATUS.DRAFT &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:purchase-invoice:update-status']),
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
    (formData.value?.status === PURCHASE_INVOICE_STATUS.DRAFT ||
      formData.value?.status === PURCHASE_INVOICE_STATUS.PROCESS) &&
    hasAccessByCodes(['erp:purchase-invoice:update']),
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
    !isEditingDraft.value ||
    hasAccessByCodes(['erp:purchase-invoice:update-status'])
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
    hasAccessByCodes(['erp:purchase-invoice:update']),
);

function getPurchaseInvoiceLoadOptions(type = formType.value) {
  return {
    includeItems: !['detail', 'edit', 'copy'].includes(type),
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
  persistedSourceSelectionDeleteIds.clear();
  existingInvoiceItemsCache = undefined;
  existingInvoiceItemsLoadPromise = undefined;
  persistedSourceSelectionRevision += 1;
  persistedSourceRefs.value = [];
  resetSourceInItemState();
  itemPageState.value = {
    orderDirection: undefined,
    orderField: undefined,
    pageNo: 1,
    pageSize: DEFAULT_ITEM_PAGE_SIZE,
    total: 0,
  };
}

function normalizeRemoteItemForCompare(
  item: ErpPurchaseInvoiceApi.PurchaseInvoiceItem,
) {
  const {
    clientRowKey: _clientRowKey,
    operation: _operation,
    productUnitName: _productUnitName,
    seq: _seq,
    stockCount: _stockCount,
    taxExclusiveAmount: _taxExclusiveAmount,
    taxExclusivePrice: _taxExclusivePrice,
    taxPrice: _taxPrice,
    totalPrice: _totalPrice,
    warehouseName: _warehouseName,
    ...rest
  } = item as any;
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
  current: ErpPurchaseInvoiceApi.PurchaseInvoiceItem,
  original?: ErpPurchaseInvoiceApi.PurchaseInvoiceItem,
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
  rows: ErpPurchaseInvoiceApi.PurchaseInvoiceItem[] = [],
) {
  rows.forEach((item) => {
    if (item.id) {
      remoteItemOriginals.set(item.id, { ...item });
    }
  });
}

function resetSourceInItemState() {
  sourceDocumentMap.clear();
  sourceItemOriginals.clear();
  sourceItemEdits.clear();
  sourceItemDeletes.clear();
  sourceManualItems.clear();
  existingSourceDocumentAmounts.clear();
  sourceAppendBaseTotalAmount.value = 0;
}

function getSourceDocumentKey(sourceType?: number, sourceDocId?: number) {
  return `${sourceType ?? 'none'}:${sourceDocId ?? 'none'}`;
}

function getSourceItemKey(item: ErpPurchaseInvoiceApi.PurchaseInvoiceItem) {
  return `${item.sourceType ?? PURCHASE_INVOICE_SOURCE_TYPE.PURCHASE_IN}:${
    item.sourceItemId ?? item.sourceInItemId ?? 'none'
  }`;
}

function getRemoteLocalItemKey(
  item: ErpPurchaseInvoiceApi.PurchaseInvoiceItem,
) {
  return itemRowKeyManager.ensureRowKey(item);
}

function applyRemoteItemCache(
  rows: ErpPurchaseInvoiceApi.PurchaseInvoiceItem[] = [],
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
  rows: ErpPurchaseInvoiceApi.PurchaseInvoiceItem[],
) {
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

function applySourceInItemCache(
  rows: ErpPurchaseInvoiceApi.PurchaseInvoiceItem[] = [],
) {
  itemRowKeyManager.ensureRowKeys(rows);
  const result: ErpPurchaseInvoiceApi.PurchaseInvoiceItem[] = [];
  for (const item of rows) {
    const itemKey = getSourceItemKey(item);
    if (
      item.sourceItemId === undefined &&
      (item.sourceInItemId === undefined || item.sourceInItemId === null)
    ) {
      result.push(item);
      continue;
    }
    if (!sourceItemOriginals.has(itemKey)) {
      sourceItemOriginals.set(itemKey, { ...item });
    }
    if (sourceItemDeletes.has(itemKey)) {
      continue;
    }
    result.push(sourceItemEdits.get(itemKey) || item);
  }
  return itemRowKeyManager.ensureRowKeys(result);
}

function recordSourceInItemChanges(
  rows: ErpPurchaseInvoiceApi.PurchaseInvoiceItem[],
) {
  if (!isSourceInItemPaging.value && selectedSourceRefs.value.length === 0) {
    return;
  }
  itemRowKeyManager.ensureRowKeys(rows);
  const previousDeleteCount = sourceItemDeletes.size;
  const previousRows = formData.value?.items ?? [];
  const nextSourceItemIds = new Set(rows.map(getSourceItemKey));
  previousRows.forEach((item) => {
    const itemKey = getSourceItemKey(item);
    if (item.sourceItemId !== undefined && !nextSourceItemIds.has(itemKey)) {
      sourceItemDeletes.add(itemKey);
      sourceItemEdits.delete(itemKey);
    }
  });
  rows.forEach((item) => {
    if (item.sourceItemId === undefined && item.sourceInItemId === undefined) {
      return;
    }
    const itemKey = getSourceItemKey(item);
    sourceItemDeletes.delete(itemKey);
    sourceItemEdits.set(itemKey, { ...item });
  });
  itemPageState.value.total =
    itemPageState.value.total - (sourceItemDeletes.size - previousDeleteCount);
}

async function loadPurchaseInvoiceItemPage(
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
      excludedItemIds: Array.from(remoteItemDeletes),
      invoiceId: formData.value.id,
      mask: formType.value === 'detail',
      orderDirection: nextState.orderDirection,
      orderField: nextState.orderField,
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
    };
    const result = await (formType.value === 'edit'
      ? getPurchaseInvoiceItemPageForEdit(request)
      : getPurchaseInvoiceItemPage(request));
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

async function loadSelectedSourceItemPage(
  options: {
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    pageNo?: number;
    pageSize?: number;
  } = {},
) {
  if (selectedSourceRefs.value.length === 0) {
    formData.value.items = [];
    itemPageState.value.total = 0;
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
    const result = await getPurchaseInvoiceMixedSourceItemPage({
      excludedSourceItemKeys: Array.from(sourceItemDeletes),
      mask: formType.value === 'detail',
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
      sourceRefs: [...selectedSourceRefs.value],
      supplierId: Number(formData.value.supplierId),
    });
    if (requestSequence !== itemPageLoadSequence) return;
    itemPageState.value = {
      ...nextState,
      total: result.total ?? 0,
    };
    formData.value.items = applySourceInItemCache(result.list ?? []);
    syncSourceInTotalAmount();
    await nextTick();
    await getItemFormInstance()?.reloadItemsFromProps?.();
  } finally {
    if (requestSequence === itemPageLoadSequence) itemPageLoading.value = false;
  }
}

async function loadInvoiceDisplayItemPage(
  options: {
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    pageNo?: number;
    pageSize?: number;
  } = {},
) {
  if (isSourceSelectionActive.value) {
    await loadSelectedSourceItemPage(options);
    return;
  }
  await loadPurchaseInvoiceItemPage(options);
}

async function loadAllPurchaseInvoiceItems(
  invoiceId: number,
  options: { mask?: boolean } = {},
) {
  const pageSize = 200;
  const firstPage = await getPurchaseInvoiceItemPage({
    invoiceId,
    mask: options.mask ?? false,
    pageNo: 1,
    pageSize,
  });
  const rows = [...(firstPage.list ?? [])];
  const total = firstPage.total ?? rows.length;
  const pageCount = Math.ceil(total / pageSize);
  for (let pageNo = 2; pageNo <= pageCount; pageNo++) {
    const page = await getPurchaseInvoiceItemPage({
      invoiceId,
      mask: options.mask ?? false,
      pageNo,
      pageSize,
    });
    rows.push(...(page.list ?? []));
  }
  return rows;
}

async function loadExistingInvoiceItemsOnce(invoiceId: number) {
  if (existingInvoiceItemsCache) {
    return existingInvoiceItemsCache;
  }
  existingInvoiceItemsLoadPromise ??= loadAllPurchaseInvoiceItems(invoiceId, {
    mask: false,
  })
    .then((items) => {
      existingInvoiceItemsCache = items;
      rememberRemoteItemOriginals(items);
      return items;
    })
    .finally(() => {
      existingInvoiceItemsLoadPromise = undefined;
    });
  return existingInvoiceItemsLoadPromise;
}

function restorePersistedSourceSelection(
  sourceRefs?: ErpPurchaseInvoiceApi.PurchaseInvoiceSourceRef[],
) {
  persistedSourceRefs.value = normalizePurchaseInvoiceSourceRefs(sourceRefs);
}

async function buildMergedRemoteItemsForSubmit() {
  const currentItems = getItemFormInstance()?.getItems?.();
  if (currentItems) {
    recordRemoteItemChanges(currentItems);
    recordSourceInItemChanges(currentItems);
  }
  if (isSourceInItemPaging.value) {
    return [
      ...Array.from(sourceItemEdits.values()).filter(
        (item) => !sourceItemDeletes.has(getSourceItemKey(item)),
      ),
      ...sourceManualItems.values(),
    ];
  }
  if (!isRemoteItemPaging.value || !formData.value?.id) {
    return currentItems ?? formData.value?.items ?? [];
  }
  return buildRemoteIncrementalItems();
}

function buildRemoteIncrementalItems() {
  const updateItems = Array.from(remoteItemEdits.values()).map((item) => ({
    ...item,
    operation: 'update' as const,
  }));
  const insertItems = Array.from(remoteItemCreates.values()).map((item) => ({
    ...item,
    id: undefined,
    invoiceId: undefined,
    operation: 'insert' as const,
  }));
  const deleteItems = Array.from(remoteItemDeletes.values()).map((id) => ({
    id,
    operation: 'delete' as const,
  })) as ErpPurchaseInvoiceApi.PurchaseInvoiceItem[];
  return [...deleteItems, ...updateItems, ...insertItems];
}

function hasPurchaseInvoicePayloadItems(
  data: ErpPurchaseInvoiceApi.PurchaseInvoice,
) {
  return (
    hasValidPurchaseDraftItems(data.items) ||
    (Array.isArray(data.sourceRefs) && data.sourceRefs.length > 0)
  );
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
      documentName: '采购票据',
      documentType: 'purchase-invoice',
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
    label: '发票张数',
    value: formData.value?.invoiceCount,
    kind: 'count' as const,
  },
  {
    label: '不含税金额',
    value: getMaskedSummaryValue(
      'taxExclusiveAmount',
      formData.value?.taxExclusiveAmount,
    ),
    kind: 'amount' as const,
  },
  {
    label: '税额',
    value: getMaskedSummaryValue('taxAmount', formData.value?.taxAmount),
    kind: 'amount' as const,
  },
  {
    label: '价税合计',
    value: getMaskedSummaryValue('totalAmount', formData.value?.totalAmount),
    kind: 'amount' as const,
    emphasis: true,
  },
]);

async function buildPermissionSchema(
  type: string,
  supplierData?: ErpPurchaseInvoiceApi.PurchaseInvoice,
) {
  const configuredSchema = await applyFieldConfig(
    useFormSchema(type, [], (supplierData ?? formData.value)?.supplierId),
    'purchase_invoice',
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
    if (isHydratingFormValues) return;
    if (changedFields.includes('supplierId')) {
      await handleSupplierChange(values.supplierId);
    }
    if (changedFields.includes('deptId')) {
      formData.value.deptId = values.deptId;
    }
  },
});

type PurchaseInvoiceDeptFieldRef = {
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
    .getFieldComponentRef<PurchaseInvoiceDeptFieldRef>('deptId')
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
    await getPurchaseInvoiceSupplierDeptSimpleList(normalizedSupplierId);
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
  if (!supplierChanged) {
    return;
  }
  selectedSourceRefs.value = [];
  persistedSourceRefs.value = [];
  purchaseInSelectRef.value?.clearSelection();
  resetSourceInItemState();
  syncAmounts([]);
}

function syncAmounts(items: ErpPurchaseInvoiceApi.PurchaseInvoiceItem[]) {
  formData.value.items = items;
  if (isRemoteItemPaging.value) {
    if (selectedSourceRefs.value.length > 0) {
      syncSourceInTotalAmount();
    }
    return;
  }
  if (isSourceInItemPaging.value) {
    syncSourceInTotalAmount();
    return;
  }
  formData.value.taxExclusiveAmount = undefined;
  formData.value.taxAmount = 0;
  formData.value.totalAmount = items.reduce(
    (sum, item) => sum + Number(item.totalPrice || 0),
    0,
  );
}

async function handleUpdateItems(
  items: ErpPurchaseInvoiceApi.PurchaseInvoiceItem[],
) {
  const previousDeleteCount = remoteItemDeletes.size;
  const previousCreateCount = remoteItemCreates.size;
  const previousSourceDeleteCount = sourceItemDeletes.size;
  recordRemoteItemChanges(items);
  recordSourceInItemChanges(items);
  const displayedItems = isRemoteItemPaging.value
    ? applyRemoteItemCache(items.filter((item) => Boolean(item.id)))
    : items;
  syncAmounts(displayedItems);
  if (
    isRemoteItemPaging.value &&
    remoteItemCreates.size > previousCreateCount
  ) {
    await loadPurchaseInvoiceItemPage({
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
    await loadPurchaseInvoiceItemPage({
      pageNo: clampRemoteItemPageNo(
        itemPageState.value.pageNo,
        itemPageState.value.pageSize,
        itemPageState.value.total,
      ),
    });
  } else if (
    isSourceSelectionActive.value &&
    sourceItemDeletes.size > previousSourceDeleteCount
  ) {
    await loadSelectedSourceItemPage({
      pageNo: clampRemoteItemPageNo(
        itemPageState.value.pageNo,
        itemPageState.value.pageSize,
        itemPageState.value.total,
      ),
    });
  }
}

function calcItemTotal(item?: ErpPurchaseInvoiceApi.PurchaseInvoiceItem) {
  return Number(item?.totalPrice ?? 0);
}

function getSelectedSourceBaseTotalAmount() {
  return selectedSourceRefs.value.reduce((sum, ref) => {
    const sourceDocumentKey = getSourceDocumentKey(
      ref.sourceType,
      ref.sourceDocId,
    );
    const sourceDocument = sourceDocumentMap.get(sourceDocumentKey);
    const existingAmount =
      existingSourceDocumentAmounts.get(sourceDocumentKey) ?? 0;
    return sum + Number(sourceDocument?.totalAmount ?? 0) - existingAmount;
  }, sourceAppendBaseTotalAmount.value);
}

function rememberManualItemsBeforeSourceSelection() {
  sourceManualItems.clear();
  const items: ErpPurchaseInvoiceApi.PurchaseInvoiceItem[] =
    getItemFormInstance()?.getItems?.() ?? formData.value?.items ?? [];
  items
    .filter(
      (item) =>
        (item.sourceType === undefined || item.sourceType === null) &&
        (item.sourceItemId === undefined || item.sourceItemId === null) &&
        (item.sourceInItemId === undefined || item.sourceInItemId === null),
    )
    .forEach((item) =>
      sourceManualItems.set(getRemoteLocalItemKey(item), { ...item }),
    );
  sourceAppendBaseTotalAmount.value = Array.from(
    sourceManualItems.values(),
  ).reduce((sum, item) => sum + calcItemTotal(item), 0);
}

async function rememberExistingSourceAmounts(invoiceId: number) {
  existingSourceDocumentAmounts.clear();
  const existingItems = await loadExistingInvoiceItemsOnce(invoiceId);
  existingItems.forEach((item) => {
    if (
      item.sourceType === undefined ||
      item.sourceType === null ||
      item.sourceDocId === undefined ||
      item.sourceDocId === null
    ) {
      return;
    }
    const key = getSourceDocumentKey(item.sourceType, item.sourceDocId);
    existingSourceDocumentAmounts.set(
      key,
      (existingSourceDocumentAmounts.get(key) ?? 0) + calcItemTotal(item),
    );
  });
}

function getRemotePendingTotalAmount() {
  if (existingInvoiceItemsCache) {
    let cachedTotalAmount = 0;
    existingInvoiceItemsCache.forEach((item) => {
      if (item.id && remoteItemDeletes.has(item.id)) return;
      cachedTotalAmount += calcItemTotal(
        item.id ? remoteItemEdits.get(item.id) || item : item,
      );
    });
    remoteItemCreates.forEach((item) => {
      cachedTotalAmount += calcItemTotal(item);
    });
    return cachedTotalAmount;
  }
  let totalAmount = Number(formData.value?.totalAmount ?? 0);
  remoteItemDeletes.forEach((id) => {
    totalAmount -= calcItemTotal(remoteItemOriginals.get(id));
  });
  remoteItemEdits.forEach((item, id) => {
    totalAmount -= calcItemTotal(remoteItemOriginals.get(id));
    totalAmount += calcItemTotal(item);
  });
  remoteItemCreates.forEach((item) => {
    totalAmount += calcItemTotal(item);
  });
  return totalAmount;
}

function getPersistedSourceItemDocumentKey(
  item: ErpPurchaseInvoiceApi.PurchaseInvoiceItem,
) {
  const sourceType =
    item.sourceType ??
    (item.sourceInId ? PURCHASE_INVOICE_SOURCE_TYPE.PURCHASE_IN : undefined);
  const sourceDocId = item.sourceDocId ?? item.sourceInId;
  if (sourceType === undefined || sourceDocId === undefined) {
    return undefined;
  }
  return getSourceDocumentKey(sourceType, sourceDocId);
}

async function handlePersistedSourceRefsChange(
  activeSourceRefs: ErpPurchaseInvoiceApi.PurchaseInvoiceSourceRef[],
) {
  if (!formData.value?.id) return;
  const revision = ++persistedSourceSelectionRevision;
  const currentItems = getItemFormInstance()?.getItems?.();
  if (currentItems) {
    recordRemoteItemChanges(currentItems);
  }
  const existingItems = await loadExistingInvoiceItemsOnce(formData.value.id);
  if (revision !== persistedSourceSelectionRevision) return;

  const persistedKeySet = new Set(
    persistedSourceRefs.value.map((sourceRef) =>
      getSourceDocumentKey(sourceRef.sourceType, sourceRef.sourceDocId),
    ),
  );
  const activeKeySet = new Set(
    activeSourceRefs.map((sourceRef) =>
      getSourceDocumentKey(sourceRef.sourceType, sourceRef.sourceDocId),
    ),
  );
  existingItems.forEach((item) => {
    if (!item.id) return;
    const documentKey = getPersistedSourceItemDocumentKey(item);
    if (!documentKey || !persistedKeySet.has(documentKey)) return;
    if (!activeKeySet.has(documentKey)) {
      if (!remoteItemDeletes.has(item.id)) {
        persistedSourceSelectionDeleteIds.add(item.id);
      }
      remoteItemDeletes.add(item.id);
      remoteItemEdits.delete(item.id);
      return;
    }
    if (persistedSourceSelectionDeleteIds.delete(item.id)) {
      remoteItemDeletes.delete(item.id);
    }
  });

  const pendingTotalAmount = getRemotePendingTotalAmount();
  if (selectedSourceRefs.value.length > 0) {
    sourceAppendBaseTotalAmount.value = pendingTotalAmount;
    syncSourceInTotalAmount();
  } else {
    formData.value.taxExclusiveAmount = undefined;
    formData.value.taxAmount = 0;
    formData.value.totalAmount = pendingTotalAmount;
  }
  await loadInvoiceDisplayItemPage({ pageNo: 1 });
}

function syncSourceInTotalAmount() {
  let totalAmount = getSelectedSourceBaseTotalAmount();
  sourceItemDeletes.forEach((sourceItemKey) => {
    totalAmount -= calcItemTotal(sourceItemOriginals.get(sourceItemKey));
  });
  sourceItemEdits.forEach((item, sourceItemKey) => {
    totalAmount -= calcItemTotal(sourceItemOriginals.get(sourceItemKey));
    totalAmount += calcItemTotal(item);
  });
  formData.value.taxExclusiveAmount = undefined;
  formData.value.taxAmount = 0;
  formData.value.totalAmount = totalAmount;
}

async function syncSelectedPurchaseIns(
  rows: ErpPurchaseInvoiceApi.PurchaseInvoiceSourceDocument[],
) {
  const revision = ++syncPurchaseInRevision;
  const requestedRefs = rows.map((row) => ({
    sourceDocId: Number(row.id),
    sourceType: Number(row.sourceType),
  }));
  const requestedKeySet = new Set(
    requestedRefs.map((ref) =>
      getSourceDocumentKey(ref.sourceType, ref.sourceDocId),
    ),
  );
  const preservedRefs = selectedSourceRefs.value.filter((ref) =>
    requestedKeySet.has(getSourceDocumentKey(ref.sourceType, ref.sourceDocId)),
  );
  const preservedKeySet = new Set(
    preservedRefs.map((ref) =>
      getSourceDocumentKey(ref.sourceType, ref.sourceDocId),
    ),
  );
  const nextRefs = [
    ...preservedRefs,
    ...requestedRefs.filter(
      (ref) =>
        !preservedKeySet.has(
          getSourceDocumentKey(ref.sourceType, ref.sourceDocId),
        ),
    ),
  ];
  if (selectedSourceRefs.value.length === 0 && nextRefs.length > 0) {
    if (formData.value?.id) {
      sourceAppendBaseTotalAmount.value = getRemotePendingTotalAmount();
      await rememberExistingSourceAmounts(formData.value.id);
      if (revision !== syncPurchaseInRevision) return;
    } else {
      rememberManualItemsBeforeSourceSelection();
    }
  }
  const nextKeySet = new Set(
    nextRefs.map((ref) =>
      getSourceDocumentKey(ref.sourceType, ref.sourceDocId),
    ),
  );
  const removedKeys = selectedSourceRefs.value
    .map((ref) => getSourceDocumentKey(ref.sourceType, ref.sourceDocId))
    .filter((key) => !nextKeySet.has(key));
  removedKeys.forEach((sourceDocumentKey) => {
    const removedDocument = sourceDocumentMap.get(sourceDocumentKey);
    sourceDocumentMap.delete(sourceDocumentKey);
    Array.from(sourceItemOriginals.entries())
      .filter(
        ([, item]) =>
          item.sourceType === removedDocument?.sourceType &&
          item.sourceDocId === removedDocument?.id,
      )
      .forEach(([sourceItemKey]) => {
        sourceItemOriginals.delete(sourceItemKey);
        sourceItemEdits.delete(sourceItemKey);
        sourceItemDeletes.delete(sourceItemKey);
      });
    Array.from(remoteItemCreates.entries())
      .filter(
        ([, item]) =>
          item.sourceType === removedDocument?.sourceType &&
          item.sourceDocId === removedDocument?.id,
      )
      .forEach(([localItemKey]) => remoteItemCreates.delete(localItemKey));
  });
  rows.forEach((row) => {
    sourceDocumentMap.set(getSourceDocumentKey(row.sourceType, row.id), row);
  });
  if (revision !== syncPurchaseInRevision) return;
  selectedSourceRefs.value = nextRefs;
  if (formData.value?.id && nextRefs.length === 0) {
    const restoredTotalAmount = sourceAppendBaseTotalAmount.value;
    resetSourceInItemState();
    formData.value.taxExclusiveAmount = restoredTotalAmount;
    formData.value.taxAmount = 0;
    formData.value.totalAmount = restoredTotalAmount;
    await loadPurchaseInvoiceItemPage({ pageNo: 1 });
    return;
  }
  if (!formData.value?.id && nextRefs.length === 0) {
    const restoredItems = Array.from(sourceManualItems.values());
    const restoredTotalAmount = sourceAppendBaseTotalAmount.value;
    resetSourceInItemState();
    formData.value.items = restoredItems;
    formData.value.taxExclusiveAmount = undefined;
    formData.value.taxAmount = 0;
    formData.value.totalAmount = restoredTotalAmount;
    itemPageState.value.total = restoredItems.length;
    await nextTick();
    await getItemFormInstance()?.reloadItemsFromProps?.();
    return;
  }
  const firstRow = rows[0];
  if (firstRow?.deptId && !formData.value.deptId) {
    formData.value.deptId = firstRow.deptId;
    await formApi.setValues({ deptId: firstRow.deptId }, false);
    await refreshSupplierDeptOptions(formData.value.supplierId, {
      clearInvalidDept: true,
      selectedDeptId: firstRow.deptId,
      warnOnClear: true,
    });
  }
  await loadSelectedSourceItemPage({ pageNo: 1 });
}

async function handleSelectSourcePurchaseIn(
  sourcePurchaseIn: ErpPurchaseInApi.PurchaseIn,
) {
  formData.value = {
    ...formData.value,
    supplierId: sourcePurchaseIn.supplierId,
    supplierName: sourcePurchaseIn.supplierName,
    deptId: sourcePurchaseIn.deptId ?? formData.value?.deptId,
    deptName: sourcePurchaseIn.deptName ?? formData.value?.deptName,
  };
  formApi.setState({
    schema: await buildPermissionSchema(formType.value, formData.value),
  });
  await formApi.setValues(
    {
      supplierId: sourcePurchaseIn.supplierId,
      supplierName: sourcePurchaseIn.supplierName,
      deptId: formData.value.deptId,
      deptName: formData.value.deptName,
    },
    false,
  );
  await refreshSupplierDeptOptions(formData.value.supplierId, {
    clearInvalidDept: true,
    selectedDeptId: formData.value.deptId,
    warnOnClear: Boolean(formData.value.deptId),
  });
  await syncSelectedPurchaseIns([
    {
      id: Number(sourcePurchaseIn.id),
      no: sourcePurchaseIn.no,
      sourceType: PURCHASE_INVOICE_SOURCE_TYPE.PURCHASE_IN,
      sourceTypeName: '采购入库',
      supplierId: sourcePurchaseIn.supplierId,
      deptId: sourcePurchaseIn.deptId,
      totalAmount: Number(
        sourcePurchaseIn.totalProductPrice ?? sourcePurchaseIn.totalPrice ?? 0,
      ),
      totalCount: Number(sourcePurchaseIn.totalCount ?? 0),
      remainingCount: Number(sourcePurchaseIn.totalCount ?? 0),
      invoiceStatus: '未开票',
    },
  ]);
}

function handleSelectedPurchaseIns(
  rows: ErpPurchaseInvoiceApi.PurchaseInvoiceSourceDocument[],
) {
  void syncSelectedPurchaseIns(rows);
}

async function reloadDetail() {
  if (!formData.value?.id) return;
  modalApi.lock();
  try {
    formData.value = await hydratePurchaseDocumentFormSelectLabels(
      await getPurchaseInvoice(
        formData.value.id,
        getPurchaseInvoiceLoadOptions(),
      ),
    );
    formData.value.items = [];
    formApi.setState({
      schema: await buildPermissionSchema(formType.value, formData.value),
    });
    await formApi.setValues(
      buildPurchaseDocumentDetailFormValues(
        buildFormValues(formData.value),
        formType.value,
      ),
      false,
    );
    await refreshSupplierDeptOptions(formData.value.supplierId, {
      clearInvalidDept: formType.value !== 'detail',
      selectedDeptId: formData.value.deptId,
    });
    if (isRemoteItemPaging.value) {
      await loadPurchaseInvoiceItemPage();
    }
  } finally {
    modalApi.unlock();
  }
}

async function handleApprove() {
  if (!formData.value?.id) return;
  try {
    await updatePurchaseInvoiceStatus(formData.value.id, 20);
    message.success('审批成功');
    await reloadDetail();
    emit('success');
  } catch (error) {
    showPurchaseFormActionError('采购票据', error, '审批失败，请稍后重试');
  }
}

function handleSubmitDraft() {
  if (!formData.value?.id) return;
  const invoiceId = formData.value.id;
  const invoiceNo = formData.value.no;
  AntModal.confirm({
    title: `确认提交采购票据${invoiceNo ? ` ${invoiceNo}` : ''}吗？`,
    content: '提交后将进入待审核状态，不能再按草稿方式修改。',
    async onOk() {
      modalApi.lock();
      try {
        await submitPurchaseInvoice(invoiceId);
        skipDraftOnClose = true;
        emit('success');
        await modalApi.close();
        message.success('采购票据已提交，下一步可进行审核');
      } catch (error) {
        showPurchaseFormActionError(
          '采购票据',
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
  if (!canEditFromDetail.value || !formData.value) return;
  await switchDetailToEdit({ ...formData.value });
}

async function switchDetailToEdit(
  initialData: ErpPurchaseInvoiceApi.PurchaseInvoice,
) {
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
        await getPurchaseInvoice(initialData.id, {
          includeItems: false,
          mask: false,
        }),
        initialData,
      ),
    );
    if (sequence !== detailLoadSequence) return;
    restorePersistedSourceSelection(loaded.sourceRefs);
    formData.value = loaded;
    formData.value.items = [];
    formApi.setState({
      schema: await buildPermissionSchema(formType.value, formData.value),
    });
    detailLoading.value = false;
    await nextTick();
    if (sequence !== detailLoadSequence) return;
    await formApi.setValues(
      buildPurchaseDocumentDetailFormValues(
        buildFormValues(formData.value),
        formType.value,
      ),
      false,
    );
    await refreshSupplierDeptOptions(formData.value.supplierId, {
      clearInvalidDept: true,
      selectedDeptId: formData.value.deptId,
      warnOnClear: Boolean(formData.value.deptId),
    });
    await loadPurchaseInvoiceItemPage({ pageNo: 1 });
    await nextTick();
  } catch (error) {
    if (sequence !== detailLoadSequence) return;
    detailLoadError.value = '采购票据详情加载失败，请关闭后重试';
    showPurchaseFormOpenError('采购票据', error);
  } finally {
    if (sequence === detailLoadSequence) {
      isHydratingFormValues = false;
      detailLoading.value = false;
      modalApi.unlock();
      void queueFocusFirstBasicFormControl(sequence);
    }
  }
}

async function buildCurrentPurchaseInvoicePayload() {
  const values = (await formApi.getValues()) as Record<string, unknown>;
  const submitItems = await buildMergedRemoteItemsForSubmit();
  for (const field of ['invoiceCount', 'taxExclusiveAmount', 'taxAmount']) {
    values[field] = toOptionalNumberValue(values[field]);
  }
  delete values.supplierPayableInfo;
  if (values.fileUrl && Array.isArray(values.fileUrl)) {
    values.fileUrl = values.fileUrl.length > 0 ? values.fileUrl[0] : '';
  }
  return {
    ...formData.value,
    ...values,
    excludedSourceItemKeys:
      selectedSourceRefs.value.length > 0
        ? Array.from(sourceItemDeletes)
        : undefined,
    id: formData.value?.id,
    sourceRefs:
      selectedSourceRefs.value.length > 0
        ? [...selectedSourceRefs.value]
        : undefined,
    totalAmount: formData.value.totalAmount,
    items: submitItems.map(
      (item: ErpPurchaseInvoiceApi.PurchaseInvoiceItem) => ({
        ...stripPurchaseItemClientFields(item),
      }),
    ),
  } as ErpPurchaseInvoiceApi.PurchaseInvoice;
}

async function savePurchaseInvoiceDraft(
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
    const data = await buildCurrentPurchaseInvoicePayload();
    if (isCreatingDraft && !hasPurchaseInvoicePayloadItems(data)) {
      if (!options.stayOpenWhenEmpty) {
        draftSaved = true;
      }
      message.warning('未选择明细，不生成草稿');
      return !options.stayOpenWhenEmpty;
    }
    await (isCreatingDraft
      ? createPurchaseInvoiceDraft(data)
      : updatePurchaseInvoiceDraft(data));
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
      '采购票据',
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
  await savePurchaseInvoiceDraft({
    closeOnSuccess: true,
    stayOpenWhenEmpty: true,
    successMessage: isEditingDraft.value ? '草稿保存成功' : '草稿生成成功',
  });
}

const [Modal, modalApi] = useVbenModal({
  async onBeforeClose() {
    return savePurchaseInvoiceDraft();
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
      if (
        !isSourceSelectionActive.value ||
        (formData.value.items?.length ?? 0) > 0
      ) {
        itemFormInstance?.validate();
      }
    } catch (error: any) {
      message.error(error.message || '子表校验失败');
      return;
    }

    modalApi.lock();
    try {
      const data = await buildCurrentPurchaseInvoicePayload();
      if (formType.value === 'create') {
        await createPurchaseInvoice(data);
      } else if (isEditingDraft.value) {
        await updateAndSubmitPurchaseInvoiceDraft(data);
      } else {
        await updatePurchaseInvoice(data);
      }
      skipDraftOnClose = true;
      emit('success');
      await modalApi.close();
      message.success($t('ui.actionMessage.operationSuccess'));
    } catch (error) {
      showPurchaseFormActionError('采购票据', error);
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    isPurchaseInvoiceFormOpen.value = isOpen;
    const sequence = ++detailLoadSequence;
    detailLoading.value = false;
    detailLoadError.value = '';
    if (!isOpen) {
      supplierDeptLoadSequence += 1;
      resetRemoteItemState();
      formData.value = { invoiceCount: 1, items: [] };
      selectedSourceRefs.value = [];
      syncPurchaseInRevision += 1;
      isHydratingFormValues = false;
      return;
    }
    modalApi.setState({ fullscreen: true });
    const data = modalApi.getData<{
      id?: number;
      initialData?: ErpPurchaseInvoiceApi.PurchaseInvoice;
      sourcePurchaseIn?: ErpPurchaseInApi.PurchaseIn;
      type: string;
    }>();
    skipDraftOnClose = false;
    draftSaved = false;
    draftSaving = false;
    resetRemoteItemState();
    detailLoading.value = Boolean(data?.id);
    modalApi.lock();
    isHydratingFormValues = Boolean(data?.id);
    try {
      formType.value = data.type;
      await loadHiddenFields();
      formApi.setDisabled(formType.value === 'detail');
      formApi.setState({
        schema: await buildPermissionSchema(formType.value, data.initialData),
      });
      await nextTick();
      if (sequence !== detailLoadSequence) return;

      if (!data?.id) {
        await formApi.resetForm();
        const userInfo = userStore.userInfo;
        const defaultUserValues = buildPurchaseCurrentUserFormDefaults(
          userInfo,
          ['handlerId'],
          { includeDept: true },
        );
        const today = getCurrentLocalDate();
        formData.value = {
          invoiceDate: today,
          invoiceCount: 1,
          ...defaultUserValues,
          items: [],
        };
        formApi.setState({
          schema: await buildPermissionSchema(formType.value, formData.value),
        });
        await formApi.setValues(
          buildPurchaseDocumentDetailFormValues(
            buildFormValues(formData.value),
            formType.value,
          ),
          false,
        );
        await refreshSupplierDeptOptions(formData.value.supplierId, {
          clearInvalidDept: true,
          selectedDeptId: formData.value.deptId,
          warnOnClear: Boolean(
            formData.value.supplierId && formData.value.deptId,
          ),
        });
        if (data?.sourcePurchaseIn) {
          await handleSelectSourcePurchaseIn(data.sourcePurchaseIn);
        }
        return;
      }

      const loaded = await hydratePurchaseDocumentFormSelectLabels(
        hydratePurchaseSupplierFromFallback(
          await getPurchaseInvoice(
            data.id,
            getPurchaseInvoiceLoadOptions(data.type),
          ),
          data.initialData,
        ),
      );
      if (sequence !== detailLoadSequence) return;
      restorePersistedSourceSelection(loaded.sourceRefs);
      formData.value = loaded;
      formData.value.items = [];
      formApi.setState({
        schema: await buildPermissionSchema(formType.value, formData.value),
      });
      // The form and item grid live behind the loading branch. Reveal them
      // before hydrating values so their instance APIs are mounted.
      detailLoading.value = false;
      await nextTick();
      if (sequence !== detailLoadSequence) return;
      await formApi.setValues(
        buildPurchaseDocumentDetailFormValues(
          buildFormValues(formData.value),
          formType.value,
        ),
        false,
      );
      await refreshSupplierDeptOptions(formData.value.supplierId, {
        clearInvalidDept: data.type !== 'detail',
        selectedDeptId: formData.value.deptId,
        warnOnClear: data.type !== 'detail' && Boolean(formData.value.deptId),
      });
      if (data.type === 'copy') {
        const sourceItems = await loadAllPurchaseInvoiceItems(
          formData.value.id!,
          {
            mask: formType.value === 'detail',
          },
        );
        const draft = buildCopyDraft({ ...formData.value, items: sourceItems });
        resetRemoteItemState();
        formType.value = 'create';
        formApi.setDisabled(false);
        formData.value = draft;
        selectedSourceRefs.value = [];
        formApi.setState({ schema: await buildPermissionSchema('create') });
        await formApi.setValues(buildFormValues(draft), false);
        await refreshSupplierDeptOptions(draft.supplierId, {
          clearInvalidDept: true,
          selectedDeptId: draft.deptId,
          warnOnClear: Boolean(draft.deptId),
        });
      } else {
        await loadPurchaseInvoiceItemPage({ pageNo: 1 });
      }
      await nextTick();
    } catch (error) {
      if (sequence !== detailLoadSequence) return;
      detailLoadError.value = '采购票据详情加载失败，请关闭后重试';
      showPurchaseFormOpenError('采购票据', error);
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
      <a-button v-if="canApprove" type="primary" @click="handleApprove">
        审批
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
    </template>
    <div
      class="purchase-document-form"
      :class="{
        'erp-form-focus-highlight': formType !== 'detail',
        'purchase-document-form--editable': formType !== 'detail',
      }"
    >
      <div v-if="detailLoading" class="purchase-document-load-state">
        采购票据详情加载中...
      </div>
      <div
        v-else-if="detailLoadError"
        class="purchase-document-load-state is-error"
      >
        {{ detailLoadError }}
      </div>
      <div v-else class="purchase-invoice-document-layout">
        <div class="purchase-document-form__content">
          <section
            ref="basicFormRef"
            class="purchase-document-section"
            @keydown.capture="handleBasicFormEnter"
          >
            <header class="purchase-document-section__header">
              <span class="purchase-document-section__title">基本信息</span>
            </header>
            <Form :key="formRenderKey">
              <template #[supplierFieldSlotName]>
                <DetailLinkInput
                  :navigable="canOpenSupplierDetail"
                  :value="formData?.supplierName"
                  @open="handleOpenSupplierDetail"
                />
              </template>
              <template #invoiceDate>
                <a-input
                  v-if="formType === 'detail'"
                  :value="normalizeInvoiceDate(formData?.invoiceDate)"
                  disabled
                />
              </template>
            </Form>
            <div class="purchase-document-payment-summary">
              <SupplierPaymentSummary :supplier-id="formData?.supplierId" />
            </div>
          </section>

          <section class="purchase-document-section">
            <header class="purchase-document-section__header">
              <span class="purchase-document-section__title">票据明细</span>
            </header>
            <div class="purchase-document-items">
              <ItemForm
                :key="formRenderKey"
                ref="itemFormRef"
                :items="formData?.items ?? []"
                :disabled="formType === 'detail'"
                :hidden-fields="hiddenFields"
                :item-page-loading="itemPageLoading"
                :item-pagination="itemPageState"
                :remote-paging="isItemRemotePaging"
                :shortcut-active="isPurchaseInvoiceFormOpen"
                @page-change="loadInvoiceDisplayItemPage"
                @update:items="handleUpdateItems"
                @open-in-detail="handleOpenPurchaseInDetail"
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

        <aside
          v-if="formType !== 'detail'"
          class="purchase-invoice-document-source"
        >
          <PurchaseInSelect
            ref="purchaseInSelectRef"
            :supplier-id="formData?.supplierId"
            :hidden-fields="hiddenFields"
            :persisted-source-refs="persistedSourceRefs"
            @update:persisted-source-refs="handlePersistedSourceRefsChange"
            @update:selected-rows="handleSelectedPurchaseIns"
          />
        </aside>
      </div>
    </div>
  </Modal>
  <RemarkModal @success="handleRemarkSuccess" />
  <SupplierDetailModal v-if="shouldRenderSupplierDetail" />
  <PurchaseInDetailModal v-if="shouldRenderPurchaseInDetail" />
</template>

<style scoped>
:deep(.flex-auto.overflow-hidden:has(> .relative > .erp-detail-link-field)) {
  overflow: visible;
}
</style>
