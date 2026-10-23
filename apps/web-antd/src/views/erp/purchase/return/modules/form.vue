<script lang="ts" setup>
import type { ErpPurchaseInApi } from '#/api/erp/purchase/in';
import type { ErpPurchaseReturnApi } from '#/api/erp/purchase/return';
import type { ErpItemRowFocusField } from '#/views/erp/utils/item-row-focus';

import { computed, defineAsyncComponent, nextTick, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';
import { useUserStore } from '@vben/stores';

import { Modal as AntModal, message, Tabs } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getPurchaseIn, getReturnableItemsByInId } from '#/api/erp/purchase/in';
import {
  createPurchaseReturn,
  createPurchaseReturnDraft,
  getPurchaseReturn,
  getPurchaseReturnItemPage,
  getPurchaseReturnItemPageForEdit,
  matchPurchaseReturnItems,
  getPurchaseReturnSupplierDeptSimpleList,
  PURCHASE_RETURN_STATUS,
  submitPurchaseReturn,
  updateAndSubmitPurchaseReturnDraft,
  updatePurchaseReturn,
  updatePurchaseReturnDraft,
  updatePurchaseReturnStatus,
} from '#/api/erp/purchase/return';
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
  clampRemoteItemPageNo,
  composeRemoteItemPage,
  getRemoteItemTotal,
  pageHasPersistedRows,
} from '#/views/erp/purchase/utils/remote-item-paging';
import { toOptionalNumberValue } from '#/views/erp/purchase/utils/text-number';
import {
  buildPurchaseDetailPrintPayload,
  getPurchaseDetailPrintTooltip,
} from '#/views/erp/purchase/utils/item-print-sort';
import { getErpDetailLoadError } from '#/views/erp/utils/detail-load-error';
import {
  focusFirstEditableFormControl,
  focusNextEditableFormControlOnEnter,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';

import { useReportViewOnly } from '#/views/erp/report/components/report-view-only';

import { useFormSchema } from '../data';
import { buildPurchaseReturnCopiedDraft } from './copy';
import ImportForm from './import-form.vue';
import ItemForm from './item-form.vue';
import PurchaseInSelect from './purchase-in-select.vue';
import PurchaseReturnableItemSelectModal from './purchase-returnable-item-select-modal.vue';
import RefundWriteOffTab from './refund-writeoff-tab.vue';

import '#/views/erp/purchase/styles/document-form.css';

const emit = defineEmits(['edit', 'print', 'success']);
const reportViewOnly = useReportViewOnly();
const FIELD_PERMISSION_MODULE = 'erp_purchase_return';
const userStore = useUserStore();
const { hasAccessByCodes } = useAccess();
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);

type PurchaseReturnFormData = Omit<
  ErpPurchaseReturnApi.PurchaseReturn,
  'handler'
> & {
  handler?: number | string;
  sourceInId?: number;
  sourceInNo?: string;
};
type SelectedReturnableRows = Array<{
  count: number;
  itemRow: ErpPurchaseInApi.ReturnableItem;
}>;

const loadSupplierDetailComponent = () =>
  import('#/views/erp/purchase/supplier/modules/detail.vue');
const SupplierDetail = defineAsyncComponent(loadSupplierDetailComponent);
const [SupplierDetailModal, supplierDetailModalApi] = useVbenModal({
  connectedComponent: SupplierDetail,
  destroyOnClose: true,
});
const shouldRenderSupplierDetail = ref(false);

const loadPurchaseInDetailComponent = () =>
  import('#/views/erp/purchase/in/modules/form.vue');
const PurchaseInDetail = defineAsyncComponent(loadPurchaseInDetailComponent);
const [PurchaseInDetailModal, purchaseInDetailModalApi] = useVbenModal({
  connectedComponent: PurchaseInDetail,
  destroyOnClose: true,
});
const shouldRenderPurchaseInDetail = ref(false);

const [RemarkModal, remarkModalApi] = useVbenModal({
  connectedComponent: PurchaseDocumentRemarkForm,
  destroyOnClose: true,
});
const [ImportFormModal, importFormModalApi] = useVbenModal({
  connectedComponent: ImportForm,
});

const formData = ref<PurchaseReturnFormData>({ items: [], returnMode: 10 });
const formType = ref('');
const isPurchaseReturnFormOpen = ref(false);
const detailLoading = ref(false);
const detailLoadError = ref('');
const itemPageLoading = ref(false);
const DEFAULT_ITEM_PAGE_SIZE = 10;
const DETAIL_TAB_KEY = 'detail';
const REFUND_TAB_KEY = 'refund';
const detailActiveTab = ref(DETAIL_TAB_KEY);
const refundTabReloadKey = ref(0);
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
    hasAccessByCodes(['erp:purchase-return:print']),
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
const itemFormRef = ref<InstanceType<typeof ItemForm>>();
const returnableItemSelectRef =
  ref<InstanceType<typeof PurchaseReturnableItemSelectModal>>();
const basicFormRef = ref<HTMLElement | null>(null);
let detailLoadSequence = 0;
let itemPageLoadSequence = 0;
let remotePersistedItemTotal = 0;
let remotePersistedItemTotalKnown = false;
let supplierDeptLoadSequence = 0;
let skipDraftOnClose = false;
let draftSaved = false;
let draftSaving = false;
let isHydratingFormValues = false;
const isRemoteItemPaging = computed(
  () =>
    Boolean(formData.value?.id) && ['detail', 'edit'].includes(formType.value),
);
const remoteItemEdits = new Map<
  number,
  ErpPurchaseReturnApi.PurchaseReturnItem
>();
const remoteItemDeletes = new Set<number>();
const remoteItemCreates = new Map<
  string,
  ErpPurchaseReturnApi.PurchaseReturnItem
>();
const remoteItemOriginals = new Map<
  number,
  ErpPurchaseReturnApi.PurchaseReturnItem
>();
const itemRowKeyManager =
  createPurchaseItemClientRowKeyManager('purchase-return');

function getItemFormInstance() {
  const instance = itemFormRef.value;
  return Array.isArray(instance) ? instance[0] : instance;
}

const getTitle = computed(() => {
  if (formType.value === 'create')
    return $t('ui.actionTitle.create', ['采购退货']);
  if (formType.value === 'edit') return $t('ui.actionTitle.edit', ['采购退货']);
  return '采购退货详情';
});

const isEditingDraft = computed(
  () =>
    formType.value === 'edit' &&
    formData.value?.status === PURCHASE_RETURN_STATUS.DRAFT,
);
const canApprove = computed(
  () =>
    formType.value === 'detail' &&
    formData.value?.status === PURCHASE_RETURN_STATUS.PROCESS &&
    Boolean(formData.value?.id) &&
    hasAccessByCodes(['erp:purchase-return:update-status']),
);
const canSubmitDraft = computed(
  () =>
    formType.value === 'detail' &&
    formData.value?.status === PURCHASE_RETURN_STATUS.DRAFT &&
    Boolean(formData.value?.id) &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:purchase-return:update-status']),
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
    Boolean(formData.value?.id) &&
    !detailLoading.value &&
    !detailLoadError.value &&
    formData.value?.status !== PURCHASE_RETURN_STATUS.APPROVE &&
    hasAccessByCodes(['erp:purchase-return:update']),
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
    hasAccessByCodes(['erp:purchase-return:update-status'])
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
    Boolean(formData.value?.id) &&
    hasAccessByCodes(['erp:purchase-return:update']),
);
const canViewFinancePaymentItems = computed(() =>
  hasAccessByCodes(['erp:finance-payment:query']),
);

function getPurchaseReturnLoadOptions(type = formType.value) {
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
  item: ErpPurchaseReturnApi.PurchaseReturnItem,
) {
  const {
    clientRowKey: _clientRowKey,
    countText: _countText,
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
  current: ErpPurchaseReturnApi.PurchaseReturnItem,
  original?: ErpPurchaseReturnApi.PurchaseReturnItem,
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
  rows: ErpPurchaseReturnApi.PurchaseReturnItem[] = [],
) {
  rows.forEach((item) => {
    if (item.id) {
      remoteItemOriginals.set(item.id, { ...item });
    }
  });
}

function getRemoteLocalItemKey(item: ErpPurchaseReturnApi.PurchaseReturnItem) {
  return itemRowKeyManager.ensureRowKey(item);
}

function applyRemoteItemCache(
  rows: ErpPurchaseReturnApi.PurchaseReturnItem[] = [],
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
  rows: ErpPurchaseReturnApi.PurchaseReturnItem[],
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

async function loadPurchaseReturnItemPage(
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
      mask: formType.value === 'detail',
      orderDirection: nextState.orderDirection,
      orderField: nextState.orderField,
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
      returnId: formData.value.id,
    };
    const result = await (formType.value === 'edit'
      ? getPurchaseReturnItemPageForEdit(request)
      : getPurchaseReturnItemPage(request));
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

async function loadAllPurchaseReturnItems(
  returnId: number,
  options: { mask?: boolean } = {},
) {
  const pageSize = 200;
  const firstPage = await getPurchaseReturnItemPage({
    mask: options.mask ?? false,
    pageNo: 1,
    pageSize,
    returnId,
  });
  const rows = [...(firstPage.list ?? [])];
  const total = firstPage.total ?? rows.length;
  const pageCount = Math.ceil(total / pageSize);
  for (let pageNo = 2; pageNo <= pageCount; pageNo++) {
    const page = await getPurchaseReturnItemPage({
      mask: options.mask ?? false,
      pageNo,
      pageSize,
      returnId,
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
    id: undefined,
    returnId: undefined,
    operation: 'insert' as const,
  }));
  const deleteItems = Array.from(remoteItemDeletes.values()).map((id) => ({
    id,
    operation: 'delete' as const,
  })) as ErpPurchaseReturnApi.PurchaseReturnItem[];
  return [...deleteItems, ...updateItems, ...insertItems];
}

function getMaskedSummaryValue(field: string, value?: number | string) {
  return formType.value === 'detail' && isFieldHidden(hiddenFields.value, field)
    ? '****'
    : value;
}
const canBatchUpdateItems = computed(
  () =>
    formType.value !== 'detail' ||
    (Boolean(formData.value?.id) &&
      formData.value?.status !== PURCHASE_RETURN_STATUS.APPROVE),
);
const canOpenSupplierDetail = computed(() =>
  Boolean(formData.value?.supplierId && formData.value?.supplierName),
);
const canOpenSourceInDetail = computed(() =>
  Boolean(formData.value?.sourceInId && formData.value?.sourceInNo),
);
const supplierFieldSlotName = computed(() =>
  formType.value === 'detail' ? 'supplierId' : 'supplierIdDisplay',
);

const documentSummaryItems = computed(() => [
  {
    label: '退货数量',
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
    label: '其他费用',
    value: getFeeAmountFallback(formData.value),
    kind: 'amount' as const,
  },
  {
    label: '退货总额',
    value: getMaskedSummaryValue('totalPrice', formData.value?.totalPrice),
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
  showDefaultActions: false,
  handleValuesChange: async (values, changedFields) => {
    if (isHydratingFormValues) return;
    if (!formData.value) return;
    if (changedFields.includes('feeAmount')) {
      formData.value.feeAmount = toOptionalNumberValue(values.feeAmount) ?? 0;
      formData.value.otherPrice = formData.value.feeAmount;
    }
    if (changedFields.includes('supplierId')) {
      await handleSupplierChange(values.supplierId);
    }
    if (changedFields.includes('deptId')) {
      formData.value.deptId = values.deptId;
    }
    if (changedFields.includes('returnMode')) {
      formData.value.returnMode = values.returnMode;
    }
  },
});

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

type PurchaseReturnDeptFieldRef = {
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
    .getFieldComponentRef<PurchaseReturnDeptFieldRef>('deptId')
    ?.updateParam?.(supplierId ? { supplierId } : {});
}

async function clearSelectedDept(warnOnClear = false) {
  await formApi.setValues({ deptId: undefined }, false);
  if (formData.value) {
    formData.value.deptId = undefined;
    formData.value.deptName = undefined;
  }
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
    return new Set<number>();
  }
  if (!options.clearInvalidDept || selectedDeptId === undefined) {
    return new Set<number>();
  }
  const departments =
    await getPurchaseReturnSupplierDeptSimpleList(normalizedSupplierId);
  if (sequence !== supplierDeptLoadSequence) {
    return new Set<number>();
  }
  const availableDeptIds = new Set(
    departments
      .map((dept) => normalizeOptionalNumber(dept.id))
      .filter((id): id is number => id !== undefined),
  );
  if (!availableDeptIds.has(selectedDeptId)) {
    await clearSelectedDept(Boolean(options.warnOnClear));
  }
  return availableDeptIds;
}

async function handleSupplierChange(supplierId?: number) {
  const normalizedSupplierId = normalizeOptionalNumber(supplierId);
  const supplierChanged =
    normalizedSupplierId !==
    normalizeOptionalNumber(formData.value?.supplierId);
  const values = (await formApi.getValues()) as PurchaseReturnFormData;
  formData.value.supplierId = normalizedSupplierId;
  await refreshSupplierDeptOptions(normalizedSupplierId, {
    clearInvalidDept: supplierChanged,
    selectedDeptId: normalizeOptionalNumber(values.deptId),
    warnOnClear:
      supplierChanged && Boolean(normalizedSupplierId && values.deptId),
  });
}

function getCurrentReturnTime() {
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
>(data: T): T & { feeAmount: number; otherPrice: number } {
  const feeAmount = getFeeAmountFallback(data);
  return {
    ...data,
    feeAmount,
    otherPrice: feeAmount,
  };
}

function getSourceInFromItems(data: ErpPurchaseReturnApi.PurchaseReturn) {
  return (data.items ?? []).find((item) => item.sourceInId || item.sourceInNo);
}

function syncFeeAmountForSubmit(values: Record<string, unknown>) {
  const feeAmount = getFeeAmountFallback(values);
  values.feeAmount = feeAmount;
  values.otherPrice = feeAmount;
}

function normalizeReturnData(data: ErpPurchaseReturnApi.PurchaseReturn) {
  const sourceIn = getSourceInFromItems(data);
  return normalizeFeeAmount({
    ...data,
    sourceInId: data.sourceInId ?? sourceIn?.sourceInId,
    sourceInNo: data.sourceInNo ?? sourceIn?.sourceInNo,
    purchaser: normalizeUserField(data.purchaser),
    handler: normalizeUserField(data.handler),
  });
}

async function applyFormMode(
  type: string,
  supplierData?: PurchaseReturnFormData,
) {
  formType.value = type;
  modalApi.setState({ fullscreen: true });
  formApi.setDisabled(type === 'detail');
  await loadHiddenFields();
  const configuredSchema = await applyFieldConfig(
    useFormSchema(type, hiddenFields.value),
    'purchase_return',
  );
  formApi.setState({
    schema: preparePurchaseDocumentFormSchema(
      withCurrentPurchaseFormSelectOptions(
        withCurrentPurchaseSupplierOption(
          applyFieldPermission(configuredSchema, hiddenFields.value),
          supplierData ?? formData.value,
        ),
        supplierData ?? formData.value,
      ),
      { data: supplierData ?? formData.value, formType: type },
    ),
  });
  await nextTick();
}

function handleOpenImport() {
  importFormModalApi.open();
}

async function handleUpdateItems(
  items: ErpPurchaseReturnApi.PurchaseReturnItem[],
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
    await loadPurchaseReturnItemPage({
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
    await loadPurchaseReturnItemPage({
      pageNo: clampRemoteItemPageNo(
        itemPageState.value.pageNo,
        itemPageState.value.pageSize,
        itemPageState.value.total,
      ),
    });
  }
}

async function handleAppendItems(
  items: ErpPurchaseReturnApi.PurchaseReturnItem[],
  focusField: ErpItemRowFocusField = 'count',
  preferredFocusItem?: ErpPurchaseReturnApi.PurchaseReturnItem,
) {
  if (!isRemoteItemPaging.value || items.length === 0) return;
  const previousPage = { ...itemPageState.value };
  let appendItems = items;
  const matchCandidates = items
    .map((item, itemIndex) => ({ item, itemIndex }))
    .filter(({ item }) => Boolean(item.productId));
  if (matchCandidates.length > 0 && formData.value?.id) {
    const matchResult = await matchPurchaseReturnItems({
      documentId: formData.value.id,
      excludedItemIds: Array.from(remoteItemDeletes),
      keys: matchCandidates.map(({ item }) => ({
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
        await loadPurchaseReturnItemPage({
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
        await loadPurchaseReturnItemPage({
          orderDirection: undefined,
          orderField: undefined,
          pageNo: targetPage,
        });
      }
      return;
    }
  }
  const previousCreates = new Map(remoteItemCreates);
  let focusItem: ErpPurchaseReturnApi.PurchaseReturnItem | undefined;
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
      await loadPurchaseReturnItemPage({
        orderDirection: undefined,
        orderField: undefined,
        pageNo: previousPage.pageNo,
      });
      await getItemFormInstance()?.focusItemRow?.(
        preferredFocusItem,
        focusField,
      );
    } else {
      await loadPurchaseReturnItemPage({
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
    await loadPurchaseReturnItemPage(previousPage);
    message.error('新增明细定位失败，请重试');
    throw error;
  }
}

function handleUpdateSummary(summary: {
  totalCount: number;
  totalPrice: number;
  totalProductPrice: number;
  totalTaxPrice: number;
}) {
  if (isRemoteItemPaging.value) {
    return;
  }
  const totalPrice =
    summary.totalProductPrice + getFeeAmountFallback(formData.value);
  formData.value = {
    ...formData.value,
    ...summary,
    totalPrice,
  };
  formApi.setValues({ ...summary, totalPrice });
}

function toReturnItemsFromSelectedRows(
  rows: Array<{
    count: number;
    itemRow: ErpPurchaseInApi.ReturnableItem;
  }>,
  purchaseIn: ErpPurchaseInApi.PurchaseIn,
) {
  return rows
    .map(({ itemRow, count }, index) => {
      const inCount = Number(itemRow.inCount || 0);
      const returnedCount = Number(itemRow.returnedCount || 0);
      return {
        ...itemRow,
        seq: index + 1,
        count,
        inCount,
        returnedCount,
        productPrice: itemRow.productPrice,
        warehouseName: itemRow.warehouseName,
        deptName: itemRow.deptName,
        sourceInId: purchaseIn.id,
        sourceInItemId: itemRow.sourceInItemId,
        sourceInNo: purchaseIn.no,
        id: undefined,
        weight: itemRow.weight,
        packageQty:
          itemRow.packageQty && itemRow.packageQty > 0 ? itemRow.packageQty : 1,
        wholeQty: undefined,
      };
    })
    .filter(
      (item) => item.count && item.count > 0,
    ) as ErpPurchaseReturnApi.PurchaseReturnItem[];
}

async function handleUpdatePurchaseIn(
  purchaseIn: ErpPurchaseInApi.PurchaseIn,
  options: { fillReturnableItems?: boolean; openItemSelector?: boolean } = {
    openItemSelector: true,
  },
) {
  const sourcePurchaseIn = purchaseIn.id
    ? await getPurchaseIn(purchaseIn.id, { includeItems: false, mask: false })
    : purchaseIn;
  resetRemoteItemState();
  formData.value = {
    ...formData.value,
    returnMode: 10,
    sourceInId: sourcePurchaseIn.id,
    sourceInNo: sourcePurchaseIn.no,
    supplierId: sourcePurchaseIn.supplierId,
    supplierName: sourcePurchaseIn.supplierName,
    purchaser: normalizeUserField(sourcePurchaseIn.purchaser),
    purchaserName: sourcePurchaseIn.purchaserName,
    deptId: sourcePurchaseIn.deptId,
    deptName: sourcePurchaseIn.deptName,
    feeAmount: getFeeAmountFallback(sourcePurchaseIn as any),
    remark: sourcePurchaseIn.remark,
    fileUrl: sourcePurchaseIn.fileUrl,
    items: [],
  };
  await applyFormMode(formType.value, formData.value);
  await refreshSupplierDeptOptions(formData.value.supplierId, {
    clearInvalidDept: formType.value !== 'detail',
    selectedDeptId: formData.value.deptId,
    warnOnClear: formType.value !== 'detail' && Boolean(formData.value.deptId),
  });
  await formApi.setValues(formData.value, false);
  if (options.fillReturnableItems) {
    const returnableItems = sourcePurchaseIn.id
      ? await getReturnableItemsByInId(sourcePurchaseIn.id)
      : [];
    handleSelectReturnableItems(
      returnableItems.map((itemRow) => ({
        itemRow,
        count: Number(itemRow.returnableCount || 0),
      })),
      sourcePurchaseIn,
    );
  } else if (options.openItemSelector ?? true) {
    returnableItemSelectRef.value?.open(sourcePurchaseIn);
  }
  return sourcePurchaseIn;
}

function handleSelectReturnableItems(
  rows: Array<{
    count: number;
    itemRow: ErpPurchaseInApi.ReturnableItem;
  }>,
  sourcePurchaseIn: ErpPurchaseInApi.PurchaseIn,
) {
  const nextItems = toReturnItemsFromSelectedRows(rows, sourcePurchaseIn);
  if (nextItems.length === 0) {
    message.warning('未选择可退明细');
    return;
  }
  recordRemoteItemChanges(nextItems);
  formData.value = {
    ...formData.value,
    items: nextItems,
  };
  formApi.setValues({ items: nextItems }, false);
}

async function handleImportSuccess(
  data: ErpPurchaseReturnApi.PurchaseReturnImportResult,
) {
  const nextItems = (data.items ?? []).map((item, index) => ({
    ...item,
    seq: index + 1,
  }));
  formData.value = {
    ...formData.value,
    returnMode: data.returnMode ?? formData.value.returnMode ?? 10,
    supplierId: data.supplierId ?? formData.value.supplierId,
    items: nextItems,
  };
  await refreshSupplierDeptOptions(formData.value.supplierId, {
    clearInvalidDept: true,
    selectedDeptId: formData.value.deptId,
    warnOnClear: Boolean(formData.value.deptId),
  });
  await formApi.setValues({
    returnMode: formData.value.returnMode,
    supplierId: formData.value.supplierId,
    deptId: formData.value.deptId,
    items: nextItems,
  });
}

async function handleOpenSupplierDetail() {
  if (!formData.value?.supplierId) return;
  await ensurePurchaseModalReady(
    shouldRenderSupplierDetail,
    supplierDetailModalApi,
    loadSupplierDetailComponent,
  );
  supplierDetailModalApi.setData({ id: formData.value.supplierId }).open();
}

async function handleOpenSourceInDetail() {
  if (!formData.value?.sourceInId) return;
  await ensurePurchaseModalReady(
    shouldRenderPurchaseInDetail,
    purchaseInDetailModalApi,
    loadPurchaseInDetailComponent,
  );
  purchaseInDetailModalApi
    .setData({ type: 'detail', id: formData.value.sourceInId })
    .open();
}

function handleEditRemark() {
  if (!formData.value?.id) return;
  remarkModalApi
    .setData({
      documentName: '采购退货',
      documentType: 'purchase-return',
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

async function reloadCurrentPurchaseReturnDetail() {
  if (!formData.value?.id) return;
  formData.value = await hydratePurchaseDocumentFormSelectLabels(
    normalizeReturnData(
      await getPurchaseReturn(
        formData.value.id,
        getPurchaseReturnLoadOptions(),
      ),
    ),
  );
  formData.value.items = [];
  await applyFormMode(formType.value, formData.value);
  await refreshSupplierDeptOptions(formData.value.supplierId, {
    clearInvalidDept: formType.value !== 'detail',
    selectedDeptId: formData.value.deptId,
  });
  await formApi.setValues(
    buildPurchaseDocumentDetailFormValues(formData.value, formType.value),
    false,
  );
  if (isRemoteItemPaging.value) {
    await loadPurchaseReturnItemPage();
  } else {
    await nextTick();
    await getItemFormInstance()?.reloadItemsFromProps?.();
  }
}

async function handleBatchUpdateItemsSuccess() {
  await reloadCurrentPurchaseReturnDetail();
  emit('success');
}

async function handleApprove() {
  if (!formData.value?.id) return;
  modalApi.lock();
  try {
    await updatePurchaseReturnStatus(formData.value.id, 20);
    message.success('审核成功');
    emit('success');
    formData.value = await hydratePurchaseDocumentFormSelectLabels(
      normalizeReturnData(
        await getPurchaseReturn(
          formData.value.id,
          getPurchaseReturnLoadOptions(),
        ),
      ),
    );
    formData.value.items = [];
    await applyFormMode(formType.value, formData.value);
    await refreshSupplierDeptOptions(formData.value.supplierId, {
      clearInvalidDept: false,
      selectedDeptId: formData.value.deptId,
    });
    await formApi.setValues(
      buildPurchaseDocumentDetailFormValues(formData.value, formType.value),
      false,
    );
    if (isRemoteItemPaging.value) {
      await loadPurchaseReturnItemPage();
    }
    refundTabReloadKey.value += 1;
  } catch (error) {
    showPurchaseFormActionError('采购退货审核', error, '审核失败，请稍后重试');
  } finally {
    modalApi.unlock();
  }
}

function handleSubmitDraft() {
  if (!formData.value?.id) return;
  const returnId = formData.value.id;
  const returnNo = formData.value.no;
  AntModal.confirm({
    title: `确认提交采购退货${returnNo ? ` ${returnNo}` : ''}吗？`,
    content: '提交后将进入待审核状态，不能再按草稿方式修改。',
    async onOk() {
      modalApi.lock();
      try {
        await submitPurchaseReturn(returnId);
        skipDraftOnClose = true;
        await modalApi.close();
        emit('success');
        message.success('采购退货已提交，下一步可进行审核');
      } catch (error) {
        showPurchaseFormActionError(
          '采购退货',
          error,
          '采购退货提交失败，请稍后重试',
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

async function switchDetailToEdit(initialData: PurchaseReturnFormData) {
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
    await applyFormMode('edit', initialData);
    if (sequence !== detailLoadSequence) return;
    const loaded = await hydratePurchaseDocumentFormSelectLabels(
      hydratePurchaseSupplierFromFallback(
        normalizeReturnData(
          await getPurchaseReturn(initialData.id, {
            includeItems: false,
            mask: false,
          }),
        ),
        initialData,
      ),
    );
    if (sequence !== detailLoadSequence) return;
    formData.value = loaded;
    formData.value.items = [];
    await applyFormMode(formType.value, formData.value);
    detailLoading.value = false;
    await nextTick();
    if (sequence !== detailLoadSequence) return;
    await refreshSupplierDeptOptions(formData.value.supplierId, {
      clearInvalidDept: true,
      selectedDeptId: formData.value.deptId,
      warnOnClear: Boolean(formData.value.deptId),
    });
    if (sequence !== detailLoadSequence) return;
    await formApi.setValues(
      buildPurchaseDocumentDetailFormValues(formData.value, formType.value),
      false,
    );
    await loadPurchaseReturnItemPage({ pageNo: 1 });
    await nextTick();
  } catch (error) {
    if (sequence !== detailLoadSequence) return;
    detailLoadError.value = getErpDetailLoadError(
      error,
      '采购退货详情加载失败，请关闭后重试',
    );
    showPurchaseFormOpenError('采购退货', error);
  } finally {
    if (sequence === detailLoadSequence) {
      isHydratingFormValues = false;
      detailLoading.value = false;
      modalApi.unlock();
      void queueFocusFirstBasicFormControl(sequence);
    }
  }
}

async function handleCopy() {
  if (!formData.value) return;
  const sourceItems = formData.value.id
    ? await loadAllPurchaseReturnItems(formData.value.id, {
        mask: formType.value === 'detail',
      })
    : (formData.value.items ?? []);
  const draft = normalizeReturnData({
    ...buildPurchaseReturnCopiedDraft({
      ...formData.value,
      items: sourceItems,
    } as ErpPurchaseReturnApi.PurchaseReturn),
    returnTime: getCurrentReturnTime(),
  });
  resetRemoteItemState();
  await applyFormMode('create');
  formData.value = draft;
  await refreshSupplierDeptOptions(draft.supplierId, {
    clearInvalidDept: true,
    selectedDeptId: draft.deptId,
    warnOnClear: Boolean(draft.deptId),
  });
  await formApi.setValues(draft, false);
  void queueFocusFirstBasicFormControl();
}

async function buildCurrentPurchaseReturnPayload() {
  const values = (await formApi.getValues()) as Record<string, unknown>;
  const submitItems = await buildMergedRemoteItemsForSubmit();
  const submitValues = {
    ...formData.value,
    ...values,
    id: formData.value?.id,
    items: submitItems.map((item: ErpPurchaseReturnApi.PurchaseReturnItem) => ({
      ...stripPurchaseItemClientFields(item),
    })),
  } as Record<string, unknown>;
  delete submitValues.supplierPayableInfo;
  for (const field of [
    'totalCount',
    'totalProductPrice',
    'totalTaxPrice',
    'feeAmount',
    'totalPrice',
  ]) {
    submitValues[field] = toOptionalNumberValue(submitValues[field]);
  }
  syncFeeAmountForSubmit(submitValues);
  if (submitValues.fileUrl && Array.isArray(submitValues.fileUrl)) {
    submitValues.fileUrl =
      submitValues.fileUrl.length > 0 ? submitValues.fileUrl[0] : '';
  }
  return normalizeFeeAmount(
    submitValues as ErpPurchaseReturnApi.PurchaseReturn,
  );
}

async function savePurchaseReturnDraft(
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
    const data = await buildCurrentPurchaseReturnPayload();
    if (
      !hasValidPurchaseDraftItems(data.items, {
        requireSourceInItem: (data.returnMode ?? 10) === 10,
      })
    ) {
      if (!options.stayOpenWhenEmpty) {
        draftSaved = true;
      }
      message.warning('未选择明细，不生成草稿');
      return !options.stayOpenWhenEmpty;
    }
    await (isCreatingDraft
      ? createPurchaseReturnDraft(data)
      : updatePurchaseReturnDraft(data));
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
      '采购退货草稿',
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
  await savePurchaseReturnDraft({
    closeOnSuccess: true,
    stayOpenWhenEmpty: true,
    successMessage: isEditingDraft.value ? '草稿保存成功' : '草稿生成成功',
  });
}

const [Modal, modalApi] = useVbenModal({
  async onBeforeClose() {
    return savePurchaseReturnDraft();
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
      message.error(error.message || '请检查采购退货明细');
      return;
    }

    modalApi.lock();
    try {
      const data = await buildCurrentPurchaseReturnPayload();
      if (formType.value === 'create') {
        await createPurchaseReturn(data);
      } else if (isEditingDraft.value) {
        await updateAndSubmitPurchaseReturnDraft(data);
      } else {
        await updatePurchaseReturn(data);
      }
      skipDraftOnClose = true;
      emit('success');
      await modalApi.close();
      message.success($t('ui.actionMessage.operationSuccess'));
    } catch (error) {
      showPurchaseFormActionError(
        '采购退货',
        error,
        '采购退货保存失败，请稍后重试',
      );
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    isPurchaseReturnFormOpen.value = isOpen;
    const sequence = ++detailLoadSequence;
    detailLoading.value = false;
    detailLoadError.value = '';
    if (!isOpen) {
      supplierDeptLoadSequence++;
      resetRemoteItemState();
      formData.value = { items: [], returnMode: 10 };
      detailActiveTab.value = DETAIL_TAB_KEY;
      refundTabReloadKey.value += 1;
      isHydratingFormValues = false;
      return;
    }
    const data = modalApi.getData<{
      id?: number;
      fillReturnableItems?: boolean;
      importData?: ErpPurchaseReturnApi.PurchaseReturnImportResult;
      initialData?: ErpPurchaseReturnApi.PurchaseReturn;
      selectedReturnableRows?: SelectedReturnableRows;
      sourcePurchaseIn?: ErpPurchaseInApi.PurchaseIn;
      type: string;
    }>();
    skipDraftOnClose = false;
    draftSaved = false;
    draftSaving = false;
    resetRemoteItemState();
    detailActiveTab.value = DETAIL_TAB_KEY;
    refundTabReloadKey.value += 1;
    detailLoading.value = Boolean(data?.id);
    modalApi.lock();
    isHydratingFormValues = Boolean(data?.id);
    try {
      await applyFormMode(data.type, data.initialData);
      if (sequence !== detailLoadSequence) return;

      if (!data?.id) {
        detailLoading.value = false;
        await nextTick();
        if (sequence !== detailLoadSequence) return;
        await formApi.resetForm();
        const defaults = {
          returnMode: 10,
          returnTime: getCurrentReturnTime(),
          feeAmount: 0,
          otherPrice: 0,
        };
        formData.value = { ...formData.value, ...defaults, items: [] };
        const userInfo = userStore.userInfo;
        if (userInfo) {
          const defaultUserValues = buildPurchaseCurrentUserFormDefaults(
            userInfo,
            ['purchaser', 'handler'],
            { includeDept: true },
          );
          Object.assign(defaults, defaultUserValues);
          Object.assign(formData.value, defaultUserValues);
          await applyFormMode(formType.value, formData.value);
        }
        await formApi.setValues(defaults);
        await refreshSupplierDeptOptions(undefined, {
          clearInvalidDept: true,
          selectedDeptId: normalizeOptionalNumber(formData.value.deptId),
        });
        if (data?.sourcePurchaseIn) {
          const sourcePurchaseIn = await handleUpdatePurchaseIn(
            data.sourcePurchaseIn,
            {
              fillReturnableItems: data.fillReturnableItems,
              openItemSelector:
                !data.selectedReturnableRows?.length &&
                !data.fillReturnableItems,
            },
          );
          if (data.selectedReturnableRows?.length) {
            handleSelectReturnableItems(
              data.selectedReturnableRows,
              sourcePurchaseIn,
            );
          }
        }
        if (data?.importData) {
          await handleImportSuccess(data.importData);
        }
        return;
      }

      const loaded = await hydratePurchaseDocumentFormSelectLabels(
        hydratePurchaseSupplierFromFallback(
          normalizeReturnData(
            await getPurchaseReturn(
              data.id,
              getPurchaseReturnLoadOptions(data.type),
            ),
          ),
          data.initialData,
        ),
      );
      if (sequence !== detailLoadSequence) return;
      formData.value = loaded;
      formData.value.items = [];
      await applyFormMode(formType.value, formData.value);
      detailLoading.value = false;
      await nextTick();
      if (sequence !== detailLoadSequence) return;
      await refreshSupplierDeptOptions(formData.value.supplierId, {
        clearInvalidDept: data.type !== 'detail',
        selectedDeptId: formData.value.deptId,
        warnOnClear: data.type !== 'detail' && Boolean(formData.value.deptId),
      });
      if (sequence !== detailLoadSequence) return;
      await formApi.setValues(
        buildPurchaseDocumentDetailFormValues(formData.value, formType.value),
        false,
      );
      await (data.type === 'copy'
        ? handleCopy()
        : loadPurchaseReturnItemPage({ pageNo: 1 }));
      await nextTick();
    } catch (error) {
      if (sequence !== detailLoadSequence) return;
      detailLoadError.value = getErpDetailLoadError(
        error,
        '采购退货详情加载失败，请关闭后重试',
      );
      showPurchaseFormOpenError('采购退货', error);
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
        'purchase-document-form--focus-highlight': formType !== 'detail',
      }"
    >
      <div v-if="detailLoading" class="purchase-document-load-state">
        采购退货详情加载中...
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
        class="purchase-return-detail-tabs"
        :class="{
          'purchase-return-detail-tabs--hidden-nav': formType !== 'detail',
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
                <template #sourceInNo>
                  <DetailLinkInput
                    v-if="formType === 'detail'"
                    :navigable="canOpenSourceInDetail"
                    :value="formData?.sourceInNo"
                    @open="handleOpenSourceInDetail"
                  />
                  <PurchaseInSelect
                    v-else
                    :in-no="formData?.sourceInNo"
                    :supplier-id="formData?.supplierId"
                    :disabled="formType === 'detail'"
                    :hidden-fields="hiddenFields"
                    @update:in="handleUpdatePurchaseIn"
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
                <span class="purchase-document-section__title">退货明细</span>
              </header>
              <div class="purchase-document-items">
                <ItemForm
                  ref="itemFormRef"
                  :items="formData?.items ?? []"
                  :disabled="formType === 'detail'"
                  :fee-amount="getFeeAmountFallback(formData)"
                  :hidden-fields="hiddenFields"
                  :dept-id="formData?.deptId"
                  :enable-batch-edit="canBatchUpdateItems"
                  :item-page-loading="itemPageLoading"
                  :item-pagination="itemPageState"
                  :remote-paging="isRemoteItemPaging"
                  :shortcut-active="isPurchaseReturnFormOpen"
                  @append-items="handleAppendItems"
                  :return-id="formData?.id"
                  :return-mode="formData?.returnMode ?? 10"
                  @batch-update-success="handleBatchUpdateItemsSuccess"
                  @page-change="loadPurchaseReturnItemPage"
                  @request-submit="handleLastInputEnterConfirm"
                  @update:items="handleUpdateItems"
                  @update:summary="handleUpdateSummary"
                >
                  <template #toolbar>
                    <a-button
                      v-if="formType === 'create'"
                      class="purchase-return-detail-action"
                      size="small"
                      type="primary"
                      ghost
                      @click="handleOpenImport"
                    >
                      导入明细
                    </a-button>
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
          :key="REFUND_TAB_KEY"
          tab="退款核销"
        >
          <RefundWriteOffTab
            :active="detailActiveTab === REFUND_TAB_KEY"
            :can-view-payment-items="canViewFinancePaymentItems"
            :reload-key="refundTabReloadKey"
            :return-id="formData?.id"
            :supplier-id="formData?.supplierId"
          />
        </Tabs.TabPane>
      </Tabs>
    </div>
  </Modal>
  <RemarkModal @success="handleRemarkSuccess" />
  <ImportFormModal @success="handleImportSuccess" />
  <PurchaseReturnableItemSelectModal
    ref="returnableItemSelectRef"
    @select="handleSelectReturnableItems"
  />
  <SupplierDetailModal v-if="shouldRenderSupplierDetail" />
  <PurchaseInDetailModal v-if="shouldRenderPurchaseInDetail" />
</template>

<style scoped>
:deep(.flex-auto.overflow-hidden:has(> .relative > .erp-detail-link-field)) {
  overflow: visible;
}

.purchase-return-detail-action {
  min-width: 72px;
  height: 28px;
  padding-inline: 10px;
  font-size: 12px;
  line-height: 20px;
}

.purchase-return-detail-tabs {
  min-width: 0;
}

.purchase-return-detail-tabs :deep(.ant-tabs-nav) {
  margin: 0 0 12px;
  padding: 0 12px;
}

.purchase-return-detail-tabs :deep(.ant-tabs-content-holder) {
  min-width: 0;
}

.purchase-return-detail-tabs--hidden-nav :deep(.ant-tabs-content-holder) {
  padding-top: 0;
}
</style>
