<script lang="ts" setup>
import type { ErpProductApi } from '#/api/erp/product/product';
import type { ErpPurchaseOrderApi } from '#/api/erp/purchase/order';
import type { ErpItemRowFocusField } from '#/views/erp/utils/item-row-focus';

import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
} from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Modal as AntModal, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getProduct, getProductSimpleList } from '#/api/erp/product/product';
import {
  createAndSubmitPurchaseOrder,
  createPurchaseOrderDraft,
  getPurchaseOrder,
  getPurchaseOrderItemPage,
  getPurchaseOrderItemPageForEdit,
  matchPurchaseOrderItems,
  PURCHASE_ORDER_STATUS,
  reverseSubmitPurchaseOrder,
  submitPurchaseOrder,
  updateAndSubmitPurchaseOrder,
  updatePurchaseOrder,
  updatePurchaseOrderDraft,
} from '#/api/erp/purchase/order';
import {
  applyFieldPermission,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import DetailLinkInput from '#/views/erp/components/DetailLinkInput.vue';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import { useReportViewOnly } from '#/views/erp/report/components/report-view-only';
import { applyFieldConfig } from '#/views/erp/composables/useFieldConfig';
import {
  focusFirstEditableFormControl,
  focusNextEditableFormControlOnEnter,
  shouldConfirmOnEnter,
} from '#/views/erp/utils/keyboard';
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
import { ensurePurchaseModalReady } from '#/views/erp/purchase/utils/lazy-modal';
import {
  clampRemoteItemPageNo,
  composeRemoteItemPage,
  getRemoteItemTotal,
  pageHasPersistedRows,
} from '#/views/erp/purchase/utils/remote-item-paging';
import {
  createPurchaseItemClientRowKeyManager,
  stripPurchaseItemClientFields,
} from '#/views/erp/purchase/utils/item-row-key';
import {
  buildPurchaseDetailPrintPayload,
  getPurchaseDetailPrintTooltip,
} from '#/views/erp/purchase/utils/item-print-sort';

import { useFormSchema } from '../data';
import DetailImportForm from './detail-import-form.vue';
import PurchaseOrderItemForm from './item-form.vue';
import PurchaseInModal from './purchase-in-modal.vue';
import {
  buildCopyPurchaseOrderDraft,
  hasValidPurchaseOrderDraftItems,
  normalizePurchaseOrderFormData,
  normalizePurchaseOrderGiftItems,
  normalizePurchaseOrderSubmitData,
} from './purchase-order-form-utils';
import RemarkForm from './remark-form.vue';

import '#/views/erp/purchase/styles/document-form.css';

const emit = defineEmits(['edit', 'print', 'success']);
const reportViewOnly = useReportViewOnly();
const FIELD_PERMISSION_MODULE = 'erp_purchase_order';
const DEFAULT_ITEM_PAGE_SIZE = 10;
const formData = ref<ErpPurchaseOrderApi.PurchaseOrder>();
const formType = ref(''); // 表单类型：'create' | 'edit' | 'detail'
const detailLoading = ref(false);
const detailLoadError = ref('');
const itemPageLoading = ref(false);
const itemPageState = ref({
  orderDirection: undefined as 'asc' | 'desc' | undefined,
  orderField: undefined as string | undefined,
  pageNo: 1,
  pageSize: DEFAULT_ITEM_PAGE_SIZE,
  total: 0,
});
let detailLoadSequence = 0;
let itemPageLoadSequence = 0;
let remotePersistedItemTotal = 0;
let remotePersistedItemTotalKnown = false;
let supplierDeptLoadSequence = 0;
let skipDraftOnClose = false;
let draftSaved = false;
let draftSaving = false;
let confirmingForm = false;
let isHydratingFormValues = false;
const currentSupplierId = ref<number>();
const isPurchaseOrderFormOpen = ref(false);
const purchaseOrderBasicFormRef = ref<HTMLElement>();
const itemFormRef = ref<InstanceType<typeof PurchaseOrderItemForm>>();
const purchaseInModalRef = ref<InstanceType<typeof PurchaseInModal>>();
const userStore = useUserStore();
const { hasAccessByCodes } = useAccess();
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const isDetailMode = computed(() => formType.value === 'detail');
const canPrintFromDetail = computed(
  () =>
    isDetailMode.value &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:purchase-order:print']),
);
const detailPrintTooltip = computed(() =>
  getPurchaseDetailPrintTooltip(
    itemPageState.value.orderField,
    itemPageState.value.orderDirection,
  ),
);
function handlePrintFromDetail() {
  if (!formData.value) return;
  emit(
    'print',
    buildPurchaseDetailPrintPayload(
      formData.value,
      itemPageState.value.orderField,
      itemPageState.value.orderDirection,
    ),
  );
}
const isRemoteItemPaging = computed(
  () =>
    Boolean(formData.value?.id) && ['detail', 'edit'].includes(formType.value),
);
const isEditingDraft = computed(
  () =>
    formType.value === 'edit' &&
    formData.value?.status === PURCHASE_ORDER_STATUS.DRAFT,
);
const canConfirmForm = computed(() => {
  if (isDetailMode.value || detailLoading.value || detailLoadError.value) {
    return false;
  }
  if (formType.value === 'create' || isEditingDraft.value) {
    return hasAccessByCodes(['erp:purchase-order:update-status']);
  }
  return true;
});
const confirmText = computed(() =>
  formType.value === 'create' || isEditingDraft.value ? '确认提交' : '确定',
);
const canOpenSupplierDetail = computed(() =>
  Boolean(currentSupplierId.value && formData.value?.supplierName),
);
const supplierFieldSlotName = computed(() =>
  isDetailMode.value ? 'supplierId' : 'supplierIdDisplay',
);
const loadSupplierDetailComponent = () =>
  import('#/views/erp/purchase/supplier/modules/detail.vue');
const SupplierDetail = defineAsyncComponent(loadSupplierDetailComponent);
const [SupplierDetailModal, supplierDetailModalApi] = useVbenModal({
  connectedComponent: SupplierDetail,
  destroyOnClose: true,
});
const shouldRenderSupplierDetail = ref(false);

function getItemFormInstance() {
  const instance = itemFormRef.value;
  return Array.isArray(instance) ? instance[0] : instance;
}

async function handleOpenSupplierDetail() {
  if (!currentSupplierId.value) return;
  await ensurePurchaseModalReady(
    shouldRenderSupplierDetail,
    supplierDetailModalApi,
    loadSupplierDetailComponent,
  );
  supplierDetailModalApi.setData({ id: currentSupplierId.value }).open();
}

function pickDefinedValues<T extends Record<string, any>>(values: T) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

const remoteItemEdits = new Map<
  number,
  ErpPurchaseOrderApi.PurchaseOrderItem
>();
const remoteItemDeletes = new Set<number>();
const remoteItemCreates = new Map<
  string,
  ErpPurchaseOrderApi.PurchaseOrderItem
>();
const remoteItemOriginals = new Map<
  number,
  ErpPurchaseOrderApi.PurchaseOrderItem
>();
const itemRowKeyManager =
  createPurchaseItemClientRowKeyManager('purchase-order');

function getPurchaseOrderLoadOptions() {
  return { includeItems: !isRemoteItemPaging.value, mask: isDetailMode.value };
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
  item: ErpPurchaseOrderApi.PurchaseOrderItem,
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

function stringifyRemoteItemForCompare(
  item: ErpPurchaseOrderApi.PurchaseOrderItem,
) {
  return JSON.stringify(normalizeRemoteItemForCompare(item));
}

function isSameRemoteItem(
  current: ErpPurchaseOrderApi.PurchaseOrderItem,
  original?: ErpPurchaseOrderApi.PurchaseOrderItem,
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
  rows: ErpPurchaseOrderApi.PurchaseOrderItem[] = [],
) {
  rows.forEach((item) => {
    if (item.id) {
      remoteItemOriginals.set(item.id, { ...item });
    }
  });
}

function getRemoteLocalItemKey(item: ErpPurchaseOrderApi.PurchaseOrderItem) {
  return itemRowKeyManager.ensureRowKey(item);
}

function applyRemoteItemCache(
  rows: ErpPurchaseOrderApi.PurchaseOrderItem[] = [],
) {
  itemRowKeyManager.ensureRowKeys(rows);
  const persistedRows = rows
    .filter((item) => !item.id || !remoteItemDeletes.has(item.id))
    .map((item) => (item.id && remoteItemEdits.get(item.id)) || item);
  const pageRows = normalizePurchaseOrderGiftItems(
    composeRemoteItemPage({
      createdRows: Array.from(remoteItemCreates.values()),
      pageNo: itemPageState.value.pageNo,
      pageSize: itemPageState.value.pageSize,
      persistedRows,
      persistedTotal: remotePersistedItemTotal,
    }),
  );
  return itemRowKeyManager.ensureRowKeys(pageRows);
}

function recordRemoteItemChanges(
  rows: ErpPurchaseOrderApi.PurchaseOrderItem[],
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

async function loadPurchaseOrderItemPage(
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
      return;
    }
    const request = {
      excludedItemIds: Array.from(remoteItemDeletes),
      mask: isDetailMode.value,
      orderDirection: nextState.orderDirection,
      orderField: nextState.orderField,
      orderId: formData.value.id,
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
    };
    const result = await (formType.value === 'edit'
      ? getPurchaseOrderItemPageForEdit(request)
      : getPurchaseOrderItemPage(request));
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
  } finally {
    if (requestSequence === itemPageLoadSequence) {
      itemPageLoading.value = false;
    }
  }
}

async function loadAllPurchaseOrderItems(
  orderId: number,
  options: { mask?: boolean } = {},
) {
  const pageSize = 200;
  const firstPage = await getPurchaseOrderItemPage({
    mask: options.mask ?? false,
    orderId,
    pageNo: 1,
    pageSize,
  });
  const rows = [...(firstPage.list ?? [])];
  const total = firstPage.total ?? rows.length;
  const pageCount = Math.ceil(total / pageSize);
  for (let pageNo = 2; pageNo <= pageCount; pageNo++) {
    const page = await getPurchaseOrderItemPage({
      mask: options.mask ?? false,
      orderId,
      pageNo,
      pageSize,
    });
    rows.push(...(page.list ?? []));
  }
  return normalizePurchaseOrderGiftItems(rows);
}

async function buildMergedRemoteItemsForSubmit() {
  if (!isRemoteItemPaging.value || !formData.value?.id) {
    return normalizePurchaseOrderGiftItems(formData.value?.items ?? []);
  }
  const sourceItems = await loadAllPurchaseOrderItems(formData.value.id, {
    mask: false,
  });
  const mergedItems = sourceItems
    .filter((item) => !item.id || !remoteItemDeletes.has(item.id))
    .map((item) => (item.id && remoteItemEdits.get(item.id)) || item);
  mergedItems.push(
    ...Array.from(remoteItemCreates.values()).map((item) => ({
      ...item,
      id: undefined,
      orderId: undefined,
    })),
  );
  return normalizePurchaseOrderGiftItems(mergedItems);
}

function getCurrentTimestamp() {
  return String(Date.now());
}

function syncCurrentSupplierId(supplierId?: number) {
  currentSupplierId.value = supplierId;
  if (formData.value) {
    formData.value.supplierId = supplierId;
  }
}

type PurchaseOrderDeptFieldRef = {
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
    .getFieldComponentRef<PurchaseOrderDeptFieldRef>('deptId')
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
  const normalizedSupplierId = normalizeOptionalNumber(supplierId);
  const supplierChanged =
    normalizedSupplierId !==
    normalizeOptionalNumber(formData.value?.supplierId);
  syncCurrentSupplierId(normalizedSupplierId);
  const values =
    (await formApi.getValues()) as ErpPurchaseOrderApi.PurchaseOrder;
  await refreshSupplierDeptOptions(normalizedSupplierId, {
    clearInvalidDept: supplierChanged,
    selectedDeptId: values.deptId,
    warnOnClear:
      supplierChanged && Boolean(normalizedSupplierId && values.deptId),
  });
}

async function switchToCreateDraft(draft: ErpPurchaseOrderApi.PurchaseOrder) {
  formType.value = 'create';
  formData.value = draft;
  currentSupplierId.value = draft.supplierId;
  formApi.setDisabled(false);
  formApi.setState({
    schema: await buildPermissionSchema(formType.value, draft),
  });
  await nextTick();
}

async function buildPermissionSchema(
  type: string,
  supplierData?: ErpPurchaseOrderApi.PurchaseOrder,
) {
  const baseSchema = useFormSchema(type);
  const configuredSchema = await applyFieldConfig(baseSchema, 'purchase_order');
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

async function applyCreateDefaults(
  overrides: Partial<ErpPurchaseOrderApi.PurchaseOrder> = {},
) {
  const nowTs = getCurrentTimestamp();
  const userInfo = userStore.userInfo;
  const currentUserDefaults =
    overrides.purchaser === undefined
      ? buildPurchaseCurrentUserFormDefaults(userInfo, ['purchaser'], {
          includeDept: overrides.deptId === undefined,
        })
      : {};
  const defaults = pickDefinedValues({
    orderTime: nowTs,
    ...currentUserDefaults,
    ...overrides,
  });
  formData.value = {
    ...formData.value,
    ...defaults,
  };
  formApi.setState({
    schema: await buildPermissionSchema(formType.value, formData.value),
  });
  await formApi.setValues(defaults, false);
}

async function handleCopy() {
  if (!formData.value) {
    return;
  }
  const sourceItems = formData.value.id
    ? await loadAllPurchaseOrderItems(formData.value.id, {
        mask: isDetailMode.value,
      })
    : (formData.value.items ?? []);
  const draft = buildCopyPurchaseOrderDraft({
    ...formData.value,
    items: sourceItems,
  });
  resetRemoteItemState();
  await switchToCreateDraft(draft);
  await formApi.resetForm();
  await applyCreateDefaults({
    deptId: draft.deptId,
    purchaser: draft.purchaser,
  });
  formData.value = {
    ...draft,
    items: draft.items ?? [],
  };
  await refreshSupplierDeptOptions(formData.value.supplierId, {
    clearInvalidDept: false,
    selectedDeptId: formData.value.deptId,
  });
  formApi.setState({
    schema: await buildPermissionSchema(formType.value, formData.value),
  });
  const formValues = pickDefinedValues({
    ...formData.value,
    items: formData.value.items ?? [],
  });
  await formApi.setValues(
    formValues as ErpPurchaseOrderApi.PurchaseOrder,
    false,
  );
  currentSupplierId.value = draft.supplierId;
  await queueFocusFirstPurchaseOrderFormControl();
}

/** 导入弹窗 */
const [ImportFormModal, importFormModalApi] = useVbenModal({
  connectedComponent: DetailImportForm,
});
const [RemarkModal, remarkModalApi] = useVbenModal({
  connectedComponent: RemarkForm,
  destroyOnClose: true,
});

/** 打开导入弹窗 */
function handleImport() {
  importFormModalApi.open();
}

function handleOpenPurchaseIn() {
  if (!formData.value?.id) {
    return;
  }
  purchaseInModalRef.value?.open(formData.value.id);
}

function handleEditRemark() {
  if (!formData.value?.id) {
    return;
  }
  remarkModalApi.setData(formData.value).open();
}

async function handleRemarkSuccess(remark: string) {
  if (formData.value) {
    formData.value.remark = remark;
    await formApi.setValues({ remark });
  }
  emit('success');
}

function pickFirstDefined<T>(...values: T[]) {
  return values.find(
    (value) => value !== null && value !== undefined && value !== '',
  );
}

function resolveProductFromMaps(
  item: ErpPurchaseOrderApi.PurchaseOrderItem,
  productMapById: Map<number, ErpProductApi.Product>,
  productMapByCode: Map<string, ErpProductApi.Product>,
) {
  if (item.productId) {
    const product = productMapById.get(item.productId);
    if (product) {
      return product;
    }
  }
  return item.productCode ? productMapByCode.get(item.productCode) : undefined;
}

/** 导入成功回调 */
async function handleImportSuccess(
  data: ErpPurchaseOrderApi.PurchaseOrderImportResp,
) {
  const productList = await getProductSimpleList();
  const productMapById = new Map(
    productList.filter((item) => item.id).map((item) => [item.id!, item]),
  );
  const productMapByCode = new Map(
    productList.filter((item) => item.code).map((item) => [item.code!, item]),
  );
  const matchedProducts = (data.items ?? [])
    .map((item) =>
      resolveProductFromMaps(item, productMapById, productMapByCode),
    )
    .filter((item): item is NonNullable<typeof item> => !!item);
  const matchedProductIds = [
    ...new Set(matchedProducts.map((item) => item.id).filter(Boolean)),
  ];
  const productDetailList = await Promise.all(
    matchedProductIds.map((id) => getProduct(id!)),
  );
  const productDetailMap = new Map(
    productDetailList.filter((item) => item.id).map((item) => [item.id!, item]),
  );
  const normalizedItems = normalizePurchaseOrderGiftItems(
    (data.items ?? []).map((item) => {
      const matchedProduct = resolveProductFromMaps(
        item,
        productMapById,
        productMapByCode,
      );
      const product =
        (matchedProduct?.id && productDetailMap.get(matchedProduct.id)) ||
        matchedProduct;
      if (!product) {
        return item;
      }
      return {
        ...item,
        productCode: item.productCode ?? product.code,
        productName: item.productName ?? product.name,
        productBarCode: item.productBarCode ?? product.barCode,
        productUnitId: item.productUnitId ?? product.unitId,
        productUnitName: item.productUnitName ?? product.unitName,
        vehicleModel: pickFirstDefined(
          item.vehicleModel,
          product.vehicleModel,
          product.vehicleModelText,
        ),
        originPlace: pickFirstDefined(item.originPlace, product.originPlace),
        standard: pickFirstDefined(item.standard, product.standard),
        featureCode: pickFirstDefined(item.featureCode, product.featureCode),
        drawingNo: pickFirstDefined(item.drawingNo, product.drawingNo),
        factoryCode: pickFirstDefined(item.factoryCode, product.factoryCode),
        brand: pickFirstDefined(item.brand, product.brand),
        warehouseId: item.warehouseId ?? product.defaultWarehouseId,
        batchNoEnabled: item.batchNoEnabled ?? product.batchNoEnabled,
        productPurchasePrice:
          item.productPurchasePrice ?? product.purchasePrice,
        salePrice: item.salePrice ?? product.salePrice,
        minPrice: item.minPrice ?? product.minPrice,
        referencePrice: item.referencePrice ?? product.referencePrice,
        retailPrice: item.retailPrice ?? product.retailPrice,
        lastPurchasePrice: item.lastPurchasePrice ?? product.lastPurchasePrice,
        grossProfitRate: item.grossProfitRate ?? product.grossProfitRate,
        backupPrice1: item.backupPrice1 ?? product.backupPrice1,
        wholesalePrice: item.wholesalePrice ?? product.wholesalePrice,
        sharePrice: item.sharePrice ?? product.sharePrice,
        productPrice: item.productPrice ?? product.purchasePrice ?? 0,
      };
    }),
  );
  formData.value = formData.value ?? {};
  formData.value.items = normalizedItems;
  formApi.setValues({ items: normalizedItems });
}

const getTitle = computed(() => {
  if (formType.value === 'create') {
    return $t('ui.actionTitle.create', ['采购订单']);
  } else if (formType.value === 'edit') {
    return $t('ui.actionTitle.edit', ['采购订单']);
  } else {
    return '采购订单详情';
  }
});

const calculatedItemCount = computed(() =>
  (formData.value?.items ?? []).reduce(
    (sum, item) => sum + Number(item.count || 0),
    0,
  ),
);
const calculatedProductAmount = computed(() =>
  (formData.value?.items ?? []).reduce(
    (sum, item) => sum + Number(item.totalProductPrice || 0),
    0,
  ),
);

const documentSummaryItems = computed(() => [
  {
    label: '商品数量',
    value: formData.value?.totalCount ?? calculatedItemCount.value,
    kind: 'count' as const,
  },
  {
    label: '商品金额',
    value: formData.value?.totalProductPrice ?? calculatedProductAmount.value,
    kind: 'amount' as const,
  },
  {
    label: '折扣率',
    value: formData.value?.discountPercent,
    kind: 'percent' as const,
  },
  {
    label: '优惠金额',
    value: formData.value?.discountPrice,
    kind: 'amount' as const,
  },
  {
    label: '其他费用',
    value: formData.value?.feeAmount,
    kind: 'amount' as const,
  },
  {
    label: '订单总额',
    value: formData.value?.totalPrice,
    kind: 'amount' as const,
    emphasis: true,
  },
]);

const canSubmitOrder = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    formData.value?.status === PURCHASE_ORDER_STATUS.DRAFT &&
    hasAccessByCodes(['erp:purchase-order:update-status']),
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
    formData.value?.status !== PURCHASE_ORDER_STATUS.APPROVE &&
    hasAccessByCodes(['erp:purchase-order:update']),
);

const canReverseSubmitOrder = computed(
  () =>
    formType.value === 'detail' &&
    formData.value?.status === PURCHASE_ORDER_STATUS.APPROVE &&
    !hasPurchaseOrderInbound(formData.value) &&
    !hasPurchaseOrderReturn(formData.value) &&
    hasAccessByCodes(['erp:purchase-order:update-status']),
);

const canPurchaseIn = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    formData.value?.status === PURCHASE_ORDER_STATUS.APPROVE &&
    !isPurchaseOrderInCompleted(formData.value) &&
    hasAccessByCodes(['erp:purchase-in:create']),
);

const canEditRemark = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    hasAccessByCodes(['erp:purchase-order:update']),
);
const canEnableItemBatchEdit = computed(
  () =>
    !reportViewOnly &&
    (formType.value !== 'detail' || Boolean(formData.value?.id)),
);

function isPurchaseOrderInCompleted(order?: ErpPurchaseOrderApi.PurchaseOrder) {
  const totalCount = order?.totalCount ?? order?.count ?? 0;
  const inCount = order?.inCount ?? 0;
  return order?.inStatus === 2 || (totalCount > 0 && inCount >= totalCount);
}

function hasPurchaseOrderInbound(order?: ErpPurchaseOrderApi.PurchaseOrder) {
  return Number(order?.inCount ?? 0) > 0;
}

function hasPurchaseOrderReturn(order?: ErpPurchaseOrderApi.PurchaseOrder) {
  return Number(order?.returnCount ?? 0) > 0;
}

function handleLastInputEnterConfirm(event: KeyboardEvent) {
  if (
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    !canConfirmForm.value ||
    confirmingForm
  ) {
    return;
  }
  event.preventDefault();
  void handleConfirmPurchaseOrderForm();
}

function canFocusPurchaseOrderBasicForm() {
  return (
    isPurchaseOrderFormOpen.value &&
    !isDetailMode.value &&
    !detailLoading.value &&
    !detailLoadError.value
  );
}

function focusFirstPurchaseOrderFormControl() {
  if (!canFocusPurchaseOrderBasicForm()) {
    return;
  }
  const scope = purchaseOrderBasicFormRef.value;
  if (!scope) {
    return;
  }
  focusFirstEditableFormControl(scope);
}

async function queueFocusFirstPurchaseOrderFormControl(
  sequence = detailLoadSequence,
) {
  await nextTick();
  if (sequence !== detailLoadSequence || !canFocusPurchaseOrderBasicForm()) {
    return;
  }
  const focus = () => {
    if (sequence !== detailLoadSequence) {
      return;
    }
    focusFirstPurchaseOrderFormControl();
  };
  if (typeof window !== 'undefined' && window.requestAnimationFrame) {
    window.requestAnimationFrame(() => window.requestAnimationFrame(focus));
    return;
  }
  focus();
}

function handlePurchaseOrderBasicFormEnter(event: KeyboardEvent) {
  if (!canFocusPurchaseOrderBasicForm()) {
    return;
  }
  const scope = purchaseOrderBasicFormRef.value;
  if (!scope) {
    return;
  }
  focusNextEditableFormControlOnEnter(event, scope, {
    onLastControlEnter: handleLastInputEnterConfirm,
  });
}

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    labelWidth: 82,
  },
  wrapperClass: 'purchase-document-basic-grid grid-cols-4',
  layout: 'horizontal',
  schema: preparePurchaseDocumentFormSchema(
    withCurrentPurchaseFormSelectOptions(
      useFormSchema(formType.value),
      formData.value,
    ),
    { data: formData.value, formType: formType.value },
  ),
  showDefaultActions: false,
  async handleValuesChange(values, changedFields) {
    if (isHydratingFormValues) return;
    if (changedFields.includes('supplierId')) {
      await handleSupplierChange(values.supplierId);
    }
    if (formData.value && changedFields.includes('deptId')) {
      formData.value.deptId = values.deptId;
    }
  },
});

/** 更新采购订单项 */
async function handleUpdateItems(
  items: ErpPurchaseOrderApi.PurchaseOrderItem[],
) {
  const normalizedItems = normalizePurchaseOrderGiftItems(items);
  formData.value =
    formData.value ?? modalApi.getData<ErpPurchaseOrderApi.PurchaseOrder>();
  const previousDeleteCount = remoteItemDeletes.size;
  const previousCreateCount = remoteItemCreates.size;
  recordRemoteItemChanges(normalizedItems);
  formData.value.items = isRemoteItemPaging.value
    ? applyRemoteItemCache(normalizedItems.filter((item) => Boolean(item.id)))
    : normalizedItems;
  formApi.setValues({
    items: formData.value.items,
  });
  if (!isRemoteItemPaging.value) return;
  const created = remoteItemCreates.size > previousCreateCount;
  const deleted = remoteItemDeletes.size > previousDeleteCount;
  if (created) {
    await loadPurchaseOrderItemPage({
      orderDirection: undefined,
      orderField: undefined,
      pageNo: clampRemoteItemPageNo(
        Number.MAX_SAFE_INTEGER,
        itemPageState.value.pageSize,
        itemPageState.value.total,
      ),
    });
  } else if (deleted) {
    await loadPurchaseOrderItemPage({
      pageNo: clampRemoteItemPageNo(
        itemPageState.value.pageNo,
        itemPageState.value.pageSize,
        itemPageState.value.total,
      ),
    });
  }
}

async function handleAppendItems(
  items: ErpPurchaseOrderApi.PurchaseOrderItem[],
  focusField: ErpItemRowFocusField = 'count',
  preferredFocusItem?: ErpPurchaseOrderApi.PurchaseOrderItem,
) {
  if (!isRemoteItemPaging.value || items.length === 0) return;
  const previousPage = { ...itemPageState.value };
  let appendItems = items;
  const matchCandidates = items
    .map((item, itemIndex) => ({ item, itemIndex }))
    .filter(({ item }) => Boolean(item.productId));
  if (matchCandidates.length > 0 && formData.value?.id) {
    const matchResult = await matchPurchaseOrderItems({
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
        await loadPurchaseOrderItemPage({
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
        await loadPurchaseOrderItemPage({
          orderDirection: undefined,
          orderField: undefined,
          pageNo: targetPage,
        });
      }
      return;
    }
  }
  const previousCreates = new Map(remoteItemCreates);
  let focusItem: ErpPurchaseOrderApi.PurchaseOrderItem | undefined;
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
      await loadPurchaseOrderItemPage({
        orderDirection: undefined,
        orderField: undefined,
        pageNo: previousPage.pageNo,
      });
      await getItemFormInstance()?.focusItemRow?.(
        preferredFocusItem,
        focusField,
      );
    } else {
      await loadPurchaseOrderItemPage({
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
    await loadPurchaseOrderItemPage(previousPage);
    message.error('新增明细定位失败，请重试');
    throw error;
  }
}

/** 更新优惠金额 */
function handleUpdateDiscountPrice(discountPrice: number) {
  if (isRemoteItemPaging.value) {
    return;
  }
  formData.value =
    formData.value ?? modalApi.getData<ErpPurchaseOrderApi.PurchaseOrder>();
  formData.value.discountPrice = discountPrice;
  formApi.setValues({
    discountPrice,
  });
}

/** 更新总金额 */
function handleUpdateTotalPrice(totalPrice: number) {
  if (isRemoteItemPaging.value) {
    return;
  }
  formData.value =
    formData.value ?? modalApi.getData<ErpPurchaseOrderApi.PurchaseOrder>();
  formData.value.totalPrice = totalPrice;
  formApi.setValues({
    totalPrice,
  });
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
  await loadPurchaseOrderItemPage(payload);
}

async function reloadPurchaseOrderDetail() {
  if (!formData.value?.id) return;
  formData.value = await hydratePurchaseDocumentFormSelectLabels(
    normalizePurchaseOrderFormData(
      await getPurchaseOrder(formData.value.id, getPurchaseOrderLoadOptions()),
    ),
  );
  formData.value.items = [];
  currentSupplierId.value = formData.value.supplierId;
  await refreshSupplierDeptOptions(formData.value.supplierId, {
    clearInvalidDept: false,
    selectedDeptId: formData.value.deptId,
  });
  await formApi.setValues(
    buildPurchaseDocumentDetailFormValues(formData.value, formType.value),
  );
  await loadPurchaseOrderItemPage({ pageNo: itemPageState.value.pageNo });
}

async function handleSubmitOrder() {
  if (!formData.value?.id) return;
  AntModal.confirm({
    title: '确认提交采购订单？',
    content: '提交后订单将进入未下订状态，后续需要人工点击下订。',
    async onOk() {
      modalApi.lock();
      try {
        await submitPurchaseOrder(formData.value!.id!);
        message.success('采购订单提交成功');
        skipDraftOnClose = true;
        await modalApi.close();
        emit('success');
      } catch (error) {
        showPurchaseFormActionError(
          '采购订单',
          error,
          '采购订单提交失败，请稍后重试',
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

async function switchDetailToEdit(
  initialData: ErpPurchaseOrderApi.PurchaseOrder,
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
        normalizePurchaseOrderFormData(
          await getPurchaseOrder(initialData.id, {
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
    currentSupplierId.value = formData.value.supplierId;
    formApi.setState({
      schema: await buildPermissionSchema('edit', formData.value),
    });
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
    await loadPurchaseOrderItemPage({ pageNo: 1 });
    await nextTick();
    await queueFocusFirstPurchaseOrderFormControl(sequence);
  } catch (error) {
    if (sequence !== detailLoadSequence) return;
    detailLoadError.value = '采购订单详情加载失败，请关闭后重试';
    showPurchaseFormOpenError('采购订单', error);
  } finally {
    if (sequence === detailLoadSequence) {
      isHydratingFormValues = false;
      detailLoading.value = false;
      modalApi.unlock();
    }
  }
}

async function handleReverseSubmitOrder() {
  if (!formData.value?.id) return;
  modalApi.lock();
  try {
    await reverseSubmitPurchaseOrder(formData.value.id);
    message.success('反下订成功');
    await reloadPurchaseOrderDetail();
    emit('success');
  } finally {
    modalApi.unlock();
  }
}

async function handlePurchaseInSuccess() {
  if (!formData.value?.id) {
    emit('success');
    return;
  }
  formData.value = await hydratePurchaseDocumentFormSelectLabels(
    normalizePurchaseOrderFormData(
      await getPurchaseOrder(formData.value.id, getPurchaseOrderLoadOptions()),
    ),
  );
  formData.value.items = [];
  currentSupplierId.value = formData.value.supplierId;
  await refreshSupplierDeptOptions(formData.value.supplierId, {
    clearInvalidDept: false,
    selectedDeptId: formData.value.deptId,
  });
  await formApi.setValues(
    buildPurchaseDocumentDetailFormValues(formData.value, formType.value),
  );
  await loadPurchaseOrderItemPage({ pageNo: 1 });
  emit('success');
}

/** 创建或更新采购订单 */
async function buildCurrentPurchaseOrderPayload(
  submitItems?: ErpPurchaseOrderApi.PurchaseOrderItem[],
) {
  const values = (await formApi.getValues()) as Record<string, unknown>;
  const allItems = submitItems ?? (await buildMergedRemoteItemsForSubmit());
  const data = normalizePurchaseOrderSubmitData(
    normalizePurchaseOrderFormData(values as ErpPurchaseOrderApi.PurchaseOrder),
  );
  if (formData.value?.discountPrice !== undefined) {
    data.discountPrice = formData.value.discountPrice;
  }
  if (formData.value?.totalPrice !== undefined) {
    data.totalPrice = formData.value.totalPrice;
  }
  delete (data as Record<string, unknown>).supplierPayableInfo;
  data.items = normalizePurchaseOrderGiftItems(allItems).map((item) => ({
    ...stripPurchaseItemClientFields(item),
    id: formType.value === 'create' ? undefined : item.id,
    orderId: formType.value === 'create' ? undefined : item.orderId,
    countText: undefined,
    productPurchasePrice: undefined,
    salePrice: undefined,
    lastSalePrice: undefined,
    minPrice: undefined,
    referencePrice: undefined,
    retailPrice: undefined,
    lastPurchasePrice: undefined,
    grossProfitRate: undefined,
    backupPrice1: undefined,
    wholesalePrice: undefined,
    sharePrice: undefined,
    priceVisible: undefined,
  }));
  if (data.fileUrl && Array.isArray(data.fileUrl)) {
    data.fileUrl = data.fileUrl.length > 0 ? data.fileUrl[0] : '';
  }
  return data;
}

async function savePurchaseOrderDraft(
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
    const data = await buildCurrentPurchaseOrderPayload();
    if (isCreatingDraft && !hasValidPurchaseOrderDraftItems(data.items)) {
      if (!options.stayOpenWhenEmpty) {
        draftSaved = true;
      }
      message.warning('未选择明细，不生成草稿');
      return !options.stayOpenWhenEmpty;
    }
    if (isCreatingDraft) {
      await createPurchaseOrderDraft(data);
    } else {
      data.id = formData.value!.id;
      await updatePurchaseOrderDraft(data);
    }
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
      '采购订单',
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
  await savePurchaseOrderDraft({
    closeOnSuccess: true,
    stayOpenWhenEmpty: true,
    successMessage: isEditingDraft.value ? '草稿保存成功' : '草稿生成成功',
  });
}

async function handleConfirmPurchaseOrderForm() {
  if (!canConfirmForm.value || confirmingForm) {
    return;
  }
  const { valid } = await formApi.validate();
  if (!valid) {
    return;
  }
  const itemFormInstance = getItemFormInstance();
  const allItems = await buildMergedRemoteItemsForSubmit();
  try {
    itemFormInstance.validate(
      allItems.filter((item) => item.operation !== 'delete'),
    );
  } catch (error: any) {
    message.error(error.message || '子表单验证失败');
    return;
  }

  confirmingForm = true;
  modalApi.lock();
  try {
    const data = await buildCurrentPurchaseOrderPayload(allItems);
    const submittingDraft = formType.value === 'create' || isEditingDraft.value;
    if (formType.value === 'create') {
      await createAndSubmitPurchaseOrder(data);
    } else if (isEditingDraft.value) {
      data.id = formData.value!.id;
      await updateAndSubmitPurchaseOrder(data);
    } else {
      await updatePurchaseOrder(data);
    }
    skipDraftOnClose = true;
    await modalApi.close();
    emit('success');
    message.success(
      submittingDraft
        ? '采购订单提交成功'
        : $t('ui.actionMessage.operationSuccess'),
    );
  } catch (error) {
    showPurchaseFormActionError(
      '采购订单',
      error,
      '采购订单保存失败，请稍后重试',
    );
  } finally {
    confirmingForm = false;
    modalApi.unlock();
  }
}

function handleWindowEnterConfirm(event: KeyboardEvent) {
  if (
    !shouldConfirmOnEnter(event, isPurchaseOrderFormOpen.value) ||
    event.shiftKey ||
    !isPurchaseOrderFormTarget(event.target) ||
    !canConfirmForm.value ||
    confirmingForm
  ) {
    return;
  }
  event.preventDefault();
  void handleConfirmPurchaseOrderForm();
}

function isPurchaseOrderFormTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    !!target.closest('.purchase-document-modal')
  );
}

onMounted(() => {
  window.addEventListener('keydown', handleWindowEnterConfirm, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowEnterConfirm, true);
});

const [Modal, modalApi] = useVbenModal({
  async onBeforeClose() {
    return savePurchaseOrderDraft();
  },
  async onCancel() {
    skipDraftOnClose = true;
    await modalApi.close();
  },
  async onConfirm() {
    await handleConfirmPurchaseOrderForm();
  },
  async onOpenChange(isOpen: boolean) {
    isPurchaseOrderFormOpen.value = isOpen;
    const sequence = ++detailLoadSequence;
    detailLoading.value = false;
    detailLoadError.value = '';
    if (!isOpen) {
      confirmingForm = false;
      isHydratingFormValues = false;
      formData.value = undefined;
      currentSupplierId.value = undefined;
      supplierDeptLoadSequence++;
      resetRemoteItemState();
      return;
    }
    modalApi.setState({ fullscreen: true });
    // 加载数据
    const data = modalApi.getData<{
      id?: number;
      importData?: ErpPurchaseOrderApi.PurchaseOrderImportResp;
      initialData?: ErpPurchaseOrderApi.PurchaseOrder;
      type: string;
    }>();
    skipDraftOnClose = false;
    draftSaved = false;
    draftSaving = false;
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
      // Wait for the schema to mount before updating the dept field params.
      await nextTick();
      if (sequence !== detailLoadSequence) return;
      if (!data || !data.id) {
        resetRemoteItemState();
        formData.value = { items: [] };
        currentSupplierId.value = undefined;
        await refreshSupplierDeptOptions(undefined);
        await formApi.resetForm();
        await applyCreateDefaults();
        if (data.importData) {
          await handleImportSuccess(data.importData);
        }
        await queueFocusFirstPurchaseOrderFormControl(sequence);
        return;
      }
      const loaded = await hydratePurchaseDocumentFormSelectLabels(
        hydratePurchaseSupplierFromFallback(
          normalizePurchaseOrderFormData(
            await getPurchaseOrder(data.id, {
              includeItems: false,
              mask: data.type === 'detail',
            }),
          ),
          data.initialData,
        ),
      );
      if (sequence !== detailLoadSequence) return;
      formData.value = loaded;
      formData.value.items = [];
      currentSupplierId.value = formData.value.supplierId;
      formApi.setState({
        schema: await buildPermissionSchema(formType.value, formData.value),
      });
      // The form is rendered behind the loading branch. Reveal it first so
      // setValues can bind to a mounted form instance in detail/edit/copy.
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
      );
      await loadPurchaseOrderItemPage({ pageNo: 1 });
      if (data.type === 'copy') {
        await handleCopy();
      }
      await nextTick();
      await queueFocusFirstPurchaseOrderFormControl(sequence);
    } catch (error) {
      if (sequence !== detailLoadSequence) return;
      detailLoadError.value = '采购订单详情加载失败，请关闭后重试';
      showPurchaseFormOpenError('采购订单', error);
    } finally {
      if (sequence === detailLoadSequence) {
        isHydratingFormValues = false;
        detailLoading.value = false;
        modalApi.unlock();
      }
    }
  },
});
</script>

<template>
  <Modal
    :title="getTitle"
    class="purchase-document-modal"
    :confirm-text="confirmText"
    :show-confirm-button="canConfirmForm"
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
      <a-button v-if="canSubmitOrder" type="primary" @click="handleSubmitOrder">
        提交
      </a-button>
      <a-button
        v-if="canReverseSubmitOrder"
        type="default"
        @click="handleReverseSubmitOrder"
      >
        反下订
      </a-button>
      <a-button
        v-if="canPurchaseIn"
        type="default"
        @click="handleOpenPurchaseIn"
      >
        入库处理
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
      <a-button v-if="formType === 'detail'" type="default" @click="handleCopy">
        复制
      </a-button>
    </template>
    <div
      class="purchase-document-form"
      :class="{
        'purchase-document-form--editable': !isDetailMode,
        'erp-form-focus-highlight': !isDetailMode,
      }"
    >
      <div v-if="detailLoading" class="purchase-document-load-state">
        采购订单详情加载中...
      </div>
      <div
        v-else-if="detailLoadError"
        class="purchase-document-load-state is-error"
      >
        {{ detailLoadError }}
      </div>
      <div v-else class="purchase-document-form__content">
        <section class="purchase-document-section">
          <header class="purchase-document-section__header">
            <span class="purchase-document-section__title">基本信息</span>
          </header>
          <div
            ref="purchaseOrderBasicFormRef"
            @keydown.capture="handlePurchaseOrderBasicFormEnter"
          >
            <Form>
              <template #[supplierFieldSlotName]>
                <DetailLinkInput
                  :navigable="canOpenSupplierDetail"
                  :value="formData?.supplierName"
                  @open="handleOpenSupplierDetail"
                />
              </template>
            </Form>
          </div>
          <div class="purchase-document-payment-summary">
            <SupplierPaymentSummary :supplier-id="currentSupplierId" />
          </div>
        </section>

        <section class="purchase-document-section">
          <header class="purchase-document-section__header">
            <span class="purchase-document-section__title">采购商品</span>
          </header>
          <div class="purchase-document-items">
            <PurchaseOrderItemForm
              ref="itemFormRef"
              :items="formData?.items ?? []"
              :disabled="isDetailMode"
              :order-id="formData?.id"
              :item-page-loading="itemPageLoading"
              :item-pagination="itemPageState"
              :remote-paging="isRemoteItemPaging"
              @append-items="handleAppendItems"
              :discount-percent="formData?.discountPercent ?? 0"
              :fee-amount="formData?.feeAmount ?? 0"
              :hidden-fields="hiddenFields"
              :dept-id="formData?.deptId"
              :enable-batch-edit="canEnableItemBatchEdit"
              :supplier-id="currentSupplierId"
              :show-import-button="formType === 'create'"
              @batch-update-success="reloadPurchaseOrderDetail"
              @page-change="handleItemPageChange"
              @refresh-page="
                loadPurchaseOrderItemPage({ pageNo: itemPageState.pageNo })
              "
              @request-submit="handleLastInputEnterConfirm"
              @update:items="handleUpdateItems"
              @update:discount-price="handleUpdateDiscountPrice"
              @update:total-price="handleUpdateTotalPrice"
              @import="handleImport"
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
    </div>
  </Modal>
  <ImportFormModal @success="handleImportSuccess" />
  <RemarkModal @success="handleRemarkSuccess" />
  <PurchaseInModal
    ref="purchaseInModalRef"
    @success="handlePurchaseInSuccess"
  />
  <SupplierDetailModal v-if="shouldRenderSupplierDetail" />
</template>

<style scoped>
:deep(.flex-auto.overflow-hidden:has(> .relative > .erp-detail-link-field)) {
  overflow: visible;
}
</style>
