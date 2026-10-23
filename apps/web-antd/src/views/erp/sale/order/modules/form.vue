<script lang="ts" setup>
import type {
  ErpSaleOrderApi,
  SaleOrderImportResp,
} from '#/api/erp/sale/order';

import { computed, defineAsyncComponent, nextTick, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getAccountSimpleList } from '#/api/erp/finance/account';
import { getCustomerSalePriceLevel } from '#/api/erp/sale/customer';
import {
  createSaleOrder,
  getSaleOrder,
  getSaleOrderCustomerDeptSimplePage,
  getSaleOrderEditItemPage,
  getSaleOrderItemPage,
  matchSaleOrderItems,
  updateSaleOrder,
} from '#/api/erp/sale/order';
import {
  applyFieldPermission,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import { applyFieldConfig } from '#/views/erp/composables/useFieldConfig';
import DetailLinkInput from '#/views/erp/components/DetailLinkInput.vue';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import { replaceDetailFieldWithLinkSlot } from '#/views/erp/components/detail-link-schema';
import { useReportViewOnly } from '#/views/erp/report/components/report-view-only';
import CustomerReceivableSummary from '#/views/erp/sale/components/CustomerReceivableSummary.vue';
import SaleDocumentRemarkForm from '#/views/erp/sale/components/SaleDocumentRemarkForm.vue';
import { buildSaleCopyDraft } from '#/views/erp/sale/utils/copy-draft';
import {
  createSaleItemClientRowKeyManager,
  stripSaleItemClientFields,
} from '#/views/erp/sale/utils/item-row-key';
import {
  buildSaleDocumentDetailFormValues,
  hydrateCurrentSaleFormSelectNames,
  withCurrentSaleFormSelectOptions,
} from '#/views/erp/sale/utils/document-form';
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
import ImportForm from './import-form.vue';
import ItemForm from './item-form.vue';

const emit = defineEmits(['success', 'print']);
const reportViewOnly = useReportViewOnly();
const FIELD_CONFIG_MODULE = 'sale_order';
const FIELD_PERMISSION_MODULE = 'erp_sale_order';
const DEFAULT_ITEM_PAGE_SIZE = 10;
const userStore = useUserStore();
const formData = ref<ErpSaleOrderApi.SaleOrder>();
const formType = ref('');
const isSaleOrderFormOpen = ref(false);
const canOpenCustomerDetail = computed(() =>
  Boolean(formData.value?.customerId && formData.value?.customerName),
);
const itemFormRef = ref<InstanceType<typeof ItemForm>>();
const basicFormRef = ref<HTMLElement | null>(null);
let formFocusSequence = 0;
const CustomerDetail = defineAsyncComponent(
  () => import('#/views/erp/sale/customer/modules/detail.vue'),
);
const [CustomerDetailModal, customerDetailModalApi] = useVbenModal({
  connectedComponent: CustomerDetail,
  destroyOnClose: true,
});
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
const [RemarkModal, remarkModalApi] = useVbenModal({
  connectedComponent: SaleDocumentRemarkForm,
  destroyOnClose: true,
});
const { hasAccessByCodes } = useAccess();

function handleOpenCustomerDetail() {
  if (!formData.value?.customerId) return;
  customerDetailModalApi.setData({ id: formData.value.customerId }).open();
}
const saleDeptOptions = ref<any[]>([]);
let saleDeptLoadSeq = 0;
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
  { customerPriceLevel: currentCustomerPriceLevel },
);
const isHydratingFormValues = ref(false);
const canEditRemark = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    hasAccessByCodes(['erp:sale-order:update']),
);
const canPrintFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    hasAccessByCodes(['erp:sale-order:print']),
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

function canFocusBasicForm() {
  return formType.value !== 'detail';
}

function handleLastInputEnterConfirm(event: KeyboardEvent) {
  if (
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    !canFocusBasicForm()
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

async function queueFocusFirstBasicFormControl(sequence = formFocusSequence) {
  await nextTick();
  if (sequence !== formFocusSequence || !canFocusBasicForm()) {
    return;
  }
  queueAfterEditableControlRender(() => {
    if (sequence === formFocusSequence) {
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

const canBatchUpdateItems = computed(
  () =>
    !reportViewOnly &&
    formType.value !== 'detail' &&
    hasAccessByCodes([
      formData.value?.id ? 'erp:sale-order:update' : 'erp:sale-order:create',
    ]),
);
const isRemoteItemPaging = computed(
  () =>
    Boolean(formData.value?.id) && ['detail', 'edit'].includes(formType.value),
);
const remoteItemEdits = new Map<number, ErpSaleOrderApi.SaleOrderItem>();
const remoteItemDeletes = new Set<number>();
const itemRowKeyManager = createSaleItemClientRowKeyManager('sale-order-item');
const remoteItemCreates = new Map<string, ErpSaleOrderApi.SaleOrderItem>();
const remoteItemOriginals = new Map<number, ErpSaleOrderApi.SaleOrderItem>();
const REMOTE_ITEM_COMPARE_IGNORED_FIELDS = new Set([
  'clientRowKey',
  'operation',
  'seq',
  'orderId',
  'productCode',
  'productName',
  'productBarCode',
  'productUnitName',
  'warehouseName',
  'warehouseDeptId',
  'warehouseDeptName',
  'deptName',
  'stockCount',
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
  'saleCostAmount',
  'saleCostPrice',
  'taxPrice',
  'totalTaxPrice',
  'totalWeight',
]);

function handleEditRemark() {
  if (!formData.value?.id) return;
  remarkModalApi
    .setData({
      documentName: '销售订单',
      documentType: 'sale-order',
      id: formData.value.id,
      no: formData.value.no,
      remark: formData.value.remark,
    })
    .open();
}

function getItemFormInstance() {
  const instance = itemFormRef.value;
  return Array.isArray(instance) ? instance[0] : instance;
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

function normalizeRemoteItemForCompare(item: ErpSaleOrderApi.SaleOrderItem) {
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
  current: ErpSaleOrderApi.SaleOrderItem,
  original?: ErpSaleOrderApi.SaleOrderItem,
) {
  if (!original) {
    return false;
  }
  return (
    JSON.stringify(normalizeRemoteItemForCompare(current)) ===
    JSON.stringify(normalizeRemoteItemForCompare(original))
  );
}

function rememberRemoteItemOriginals(rows: ErpSaleOrderApi.SaleOrderItem[]) {
  rows.forEach((item) => {
    if (item.id) {
      remoteItemOriginals.set(item.id, { ...item });
    }
  });
}

function getRemoteLocalItemKey(item: ErpSaleOrderApi.SaleOrderItem) {
  return itemRowKeyManager.ensureRowKey(item);
}

function applyRemoteItemCache(rows: ErpSaleOrderApi.SaleOrderItem[] = []) {
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

function recordRemoteItemChanges(rows: ErpSaleOrderApi.SaleOrderItem[]) {
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

async function loadSaleOrderItemPage(
  options: {
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    pageNo?: number;
    pageSize?: number;
  } = {},
) {
  if (!formData.value?.id) {
    formData.value = (formData.value ?? {}) as ErpSaleOrderApi.SaleOrder;
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
      orderId: formData.value.id,
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
    };
    const result = await (formType.value === 'edit'
      ? getSaleOrderEditItemPage(request)
      : getSaleOrderItemPage(request));
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

async function loadAllSaleOrderItems(
  orderId: number,
  options: { mask?: boolean } = {},
) {
  const pageSize = 200;
  const firstPage = await getSaleOrderItemPage({
    mask: options.mask ?? false,
    orderId,
    pageNo: 1,
    pageSize,
  });
  const rows = [...(firstPage.list ?? [])];
  const total = firstPage.total ?? rows.length;
  const pageCount = Math.ceil(total / pageSize);
  for (let pageNo = 2; pageNo <= pageCount; pageNo++) {
    const page = await getSaleOrderItemPage({
      mask: options.mask ?? false,
      orderId,
      pageNo,
      pageSize,
    });
    rows.push(...(page.list ?? []));
  }
  return rows;
}

async function buildMergedRemoteItemsForSubmit() {
  if (!isRemoteItemPaging.value || !formData.value?.id) {
    return (formData.value?.items ?? []).map(stripSaleOrderItemDisplayFields);
  }
  recordRemoteItemChanges(
    getItemFormInstance()?.getDraftItems?.() ?? formData.value.items ?? [],
  );
  const updateItems = [...remoteItemEdits.values()].map((item) => ({
    ...stripSaleItemClientFields(item),
    operation: 'update' as const,
  }));
  const insertItems = [...remoteItemCreates.values()].map((item) => {
    const next = { ...item };
    delete next.id;
    delete next.orderId;
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
  return [...updateItems, ...insertItems, ...deleteItems].map(
    stripSaleOrderItemDisplayFields,
  );
}

function stripSaleOrderItemDisplayFields(
  item: ErpSaleOrderApi.SaleOrderItem,
): ErpSaleOrderApi.SaleOrderItem {
  const next = { ...item };
  delete next.saleCostAmount;
  delete next.saleCostPrice;
  return next;
}

async function handleRemarkSuccess(remark: string) {
  if (!formData.value) return;
  formData.value.remark = remark;
  await formApi.setValues({ remark });
  emit('success');
}

const [ImportFormModal, importFormModalApi] = useVbenModal({
  connectedComponent: ImportForm,
});

const getTitle = computed(() => {
  if (formType.value === 'create') {
    return $t('ui.actionTitle.create', ['销售订单']);
  } else if (formType.value === 'edit') {
    return $t('ui.actionTitle.edit', ['销售订单']);
  } else {
    return '销售订单详情';
  }
});

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    labelWidth: 120,
  },
  wrapperClass: 'grid-cols-3',
  layout: 'vertical',
  schema: useFormSchema(formType.value),
  showDefaultActions: false,
  handleValuesChange: (values, changedFields) => {
    if (isHydratingFormValues.value) return;
    if (changedFields.includes('customerId')) {
      if (!formData.value) {
        formData.value = {} as ErpSaleOrderApi.SaleOrder;
      }
      formData.value.customerId = values.customerId;
      void loadSaleDeptOptions(values.customerId);
      void loadCustomerPriceLevel(values.customerId);
    }
    if (formData.value && changedFields.includes('discountPercent')) {
      formData.value.discountPercent = toOptionalNumberValue(
        values.discountPercent,
      );
    }
    if (formData.value && changedFields.includes('feeAmount')) {
      formData.value.feeAmount = toOptionalNumberValue(values.feeAmount) ?? 0;
    }
    if (changedFields.includes('deptId')) {
      if (!formData.value) {
        formData.value = {} as ErpSaleOrderApi.SaleOrder;
      }
      formData.value.deptId = values.deptId;
    }
  },
});

type SaleDeptFieldRef = {
  updateParam?: (newParams: Record<string, any>) => void;
};

function updateDeptFieldCustomerParam(customerId?: number) {
  formApi
    .getFieldComponentRef<SaleDeptFieldRef>('deptId')
    ?.updateParam?.(customerId ? { customerId } : {});
}

async function refreshFormSchema(customerData = formData.value) {
  const hydratedCustomerData =
    await hydrateCurrentSaleFormSelectNames(customerData);
  const configuredSchema = await applyFieldConfig(
    useFormSchema(formType.value, hiddenFields.value, saleDeptOptions.value),
    FIELD_CONFIG_MODULE,
  );
  formApi.setState({
    schema: replaceDetailFieldWithLinkSlot(
      withCurrentSaleFormSelectOptions(
        applyFieldPermission(configuredSchema, hiddenFields.value),
        hydratedCustomerData,
        formType.value,
      ),
      formType.value,
      'customerId',
      'customerDetail',
    ),
  });
}

async function applyFormMode(type: string) {
  formType.value = type;
  formApi.setDisabled(type === 'detail');
  await refreshFormSchema();
  await nextTick();
}

/** 按客户加载可选部门树，与报价订单表单的逻辑保持一致 */
async function loadSaleDeptOptions(
  customerId?: number,
  preferredDeptId?: number,
) {
  const seq = ++saleDeptLoadSeq;
  updateDeptFieldCustomerParam(customerId);
  if (seq !== saleDeptLoadSeq) {
    return;
  }
  if (!customerId) {
    saleDeptOptions.value = [];
    if (formData.value) {
      formData.value.deptId = undefined;
    }
    await formApi.setValues({ deptId: undefined });
    return;
  }
  const page = await getSaleOrderCustomerDeptSimplePage({
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
      componentProps: {
        options: saleDeptOptions.value,
      },
    },
  ]);
  const currentUserDeptId = userStore.userInfo?.deptId;
  const deptId =
    saleDeptOptions.value.find((dept) => dept.id === preferredDeptId)?.id ??
    saleDeptOptions.value.find((dept) => dept.id === currentUserDeptId)?.id ??
    saleDeptOptions.value[0]?.id;
  formData.value = formData.value || ({} as ErpSaleOrderApi.SaleOrder);
  formData.value.deptId = deptId;
  await formApi.setValues({ deptId });
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

function handleImport() {
  importFormModalApi.open();
}

function handleImportSuccess(data: SaleOrderImportResp) {
  resetRemoteItemState();
  const importValues = {
    items: data.items ?? [],
  } as ErpSaleOrderApi.SaleOrder;
  formData.value = {
    ...formData.value,
    ...importValues,
  };
  formApi.setValues(importValues);
}

async function handleUpdateItems(items: ErpSaleOrderApi.SaleOrderItem[]) {
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
    formData.value = {
      ...formData.value,
      items: isRemoteItemPaging.value
        ? applyRemoteItemCache(items.filter((item) => Boolean(item.id)))
        : items,
    } as ErpSaleOrderApi.SaleOrder;
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
        (entry): entry is readonly [string, ErpSaleOrderApi.SaleOrderItem] =>
          Boolean(entry[1]?.productId),
      );
    let firstMatchedItemId: number | undefined;
    let firstMatchedPageNo: number | undefined;
    if (matchCandidates.length > 0 && formData.value.id) {
      const matchResult = await matchSaleOrderItems({
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
      await loadSaleOrderItemPage({
        orderDirection: undefined,
        orderField: undefined,
        pageNo: snapshot.pageState.pageNo,
      });
      await focusRemoteItemByKey(replacedBlankCreateKey, 'count');
    } else if (firstRemainingAddedKey) {
      await loadSaleOrderItemPage({
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
      await loadSaleOrderItemPage({
        orderDirection: undefined,
        orderField: undefined,
        pageNo: firstMatchedPageNo,
      });
      await focusRemoteItemByKey(
        itemRowKeyManager.ensureRowKey({ id: firstMatchedItemId }),
      );
    } else if (remoteItemDeletes.size > previousDeleteCount) {
      await loadSaleOrderItemPage({
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
    formData.value = {
      ...formData.value,
      items: snapshot.items,
    } as ErpSaleOrderApi.SaleOrder;
    await formApi.setValues({ items: snapshot.items });
    message.error('明细处理失败，已恢复操作前状态，请重试');
  }
}

function handleUpdateDiscountPrice(discountPrice: number) {
  if (isRemoteItemPaging.value) {
    return;
  }
  formApi.setValues({
    discountPrice,
  });
}

function handleUpdateTotalPrice(totalPrice: number) {
  if (isRemoteItemPaging.value) {
    return;
  }
  formApi.setValues({
    totalPrice,
  });
}

async function handleCopy() {
  if (!formData.value?.id) return;
  const sourceData = {
    ...formData.value,
    items: await loadAllSaleOrderItems(formData.value.id, { mask: false }),
  };
  const copyData = buildSaleCopyDraft(sourceData, {
    extraCleanKeys: ['outCount', 'inCount', 'returnCount'],
    extraItemCleanKeys: ['orderId'],
  });
  isHydratingFormValues.value = true;
  try {
    copyData.orderTime = getCurrentTimestamp() as any;
    resetRemoteItemState();
    await applyFormMode('create');
    formData.value = copyData as ErpSaleOrderApi.SaleOrder;
    await loadSaleDeptOptions(copyData.customerId, copyData.deptId);
    await loadCustomerPriceLevel(copyData.customerId);
    copyData.deptId = formData.value?.deptId;
    await formApi.setValues(copyData);
    await nextTick();
  } finally {
    isHydratingFormValues.value = false;
    const sequence = ++formFocusSequence;
    void queueFocusFirstBasicFormControl(sequence);
  }
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    const itemFormInstance = Array.isArray(itemFormRef.value)
      ? itemFormRef.value[0]
      : itemFormRef.value;
    try {
      const submitItems = await buildMergedRemoteItemsForSubmit();
      if (
        isRemoteItemPaging.value &&
        formData.value?.id &&
        itemPageState.value.total <= 0
      ) {
        throw new Error('请先添加销售产品');
      }
      itemFormInstance.validate(
        submitItems.filter((item) => item.operation !== 'delete'),
        { requireItems: !isRemoteItemPaging.value },
      );
      formData.value = {
        ...formData.value,
        items: submitItems,
      } as ErpSaleOrderApi.SaleOrder;
    } catch (error: any) {
      message.error(error.message || '子表单校验失败');
      return;
    }

    modalApi.lock();
    const data = (await formApi.getValues()) as ErpSaleOrderApi.SaleOrder;
    data.items = (formData.value?.items ?? []).map((item) =>
      stripSaleItemClientFields(item),
    );
    data.discountPercent = toOptionalNumberValue(data.discountPercent);
    data.discountPrice = toOptionalNumberValue(data.discountPrice);
    data.feeAmount = toOptionalNumberValue(data.feeAmount);
    data.totalPrice = toOptionalNumberValue(data.totalPrice) ?? 0;
    data.depositPrice = toOptionalNumberValue(data.depositPrice);
    delete (data as unknown as Record<string, unknown>).customerReceivableInfo;
    if (data.fileUrl && Array.isArray(data.fileUrl)) {
      data.fileUrl = data.fileUrl.length > 0 ? data.fileUrl[0] : '';
    }
    try {
      await (formType.value === 'create'
        ? createSaleOrder(data)
        : updateSaleOrder(data));
      await modalApi.close();
      emit('success');
      message.success($t('ui.actionMessage.operationSuccess'));
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    isSaleOrderFormOpen.value = isOpen;
    const sequence = ++formFocusSequence;
    if (!isOpen) {
      formData.value = undefined;
      resetRemoteItemState();
      saleDeptOptions.value = [];
      currentCustomerPriceLevel.value = undefined;
      isHydratingFormValues.value = false;
      return;
    }
    const data = modalApi.getData<{
      id?: number;
      importData?: SaleOrderImportResp;
      type: string;
    }>();
    await loadHiddenFields();
    await applyFormMode(data.type);
    if (!data || !data.id) {
      resetRemoteItemState();
      saleDeptOptions.value = [];
      currentCustomerPriceLevel.value = undefined;
      await refreshFormSchema();
      const accountList = await getAccountSimpleList();
      const defaultAccount = accountList.find((item) => item.defaultStatus);
      const importValues = {
        items: data.importData?.items ?? [],
      } as ErpSaleOrderApi.SaleOrder;
      const createValues = {
        ...importValues,
        deptId: undefined,
        feeAmount: 0,
        orderTime: getCurrentTimestamp() as any,
      } as ErpSaleOrderApi.SaleOrder;
      const initialValues =
        defaultAccount?.id === undefined
          ? createValues
          : ({
              ...createValues,
              accountId: defaultAccount.id,
            } as ErpSaleOrderApi.SaleOrder);
      formData.value = createValues;
      await formApi.setValues(initialValues);
      void queueFocusFirstBasicFormControl(sequence);
      return;
    }
    modalApi.lock();
    isHydratingFormValues.value = true;
    try {
      resetRemoteItemState();
      formData.value = await getSaleOrder(data.id, {
        includeItems: !['detail', 'edit'].includes(data.type),
        mask: data.type === 'detail',
      });
      if (['detail', 'edit'].includes(data.type)) {
        formData.value.items = [];
      }
      await loadSaleDeptOptions(
        formData.value.customerId,
        formData.value.deptId,
      );
      await loadCustomerPriceLevel(formData.value.customerId);
      await formApi.setValues(
        buildSaleDocumentDetailFormValues(formData.value, formType.value),
      );
      if (['detail', 'edit'].includes(data.type)) {
        await loadSaleOrderItemPage({ pageNo: 1 });
      }
      await nextTick();
    } catch (error) {
      if (!reportViewOnly) throw error;
      formData.value = undefined;
      message.error('单据已删除、不可用或无权访问，请关闭后重试');
    } finally {
      isHydratingFormValues.value = false;
      modalApi.unlock();
      void queueFocusFirstBasicFormControl(sequence);
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
  await loadSaleOrderItemPage(payload);
}
</script>

<template>
  <Modal
    :title="getTitle"
    class="w-3/4"
    :show-confirm-button="formType !== 'detail'"
  >
    <template v-if="!reportViewOnly" #prepend-footer>
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
    </template>
    <div v-if="formType === 'create'" class="mx-3 mb-2 flex justify-end">
      <Button type="primary" ghost @click="handleImport">导入</Button>
    </div>
    <div ref="basicFormRef" @keydown.capture="handleBasicFormEnter">
      <Form class="mx-3">
        <template #customerDetail>
          <DetailLinkInput
            :navigable="canOpenCustomerDetail"
            :value="formData?.customerName"
            @open="handleOpenCustomerDetail"
          />
        </template>
        <template #customerReceivableInfo>
          <CustomerReceivableSummary :customer-id="formData?.customerId" />
        </template>
        <template #items>
          <ItemForm
            ref="itemFormRef"
            :items="formData?.items ?? []"
            :disabled="formType === 'detail'"
            :discount-percent="formData?.discountPercent ?? 0"
            :fee-amount="formData?.feeAmount ?? 0"
            :hidden-fields="hiddenFields"
            :main-dept-id="formData?.deptId"
            :customer-price-level="currentCustomerPriceLevel"
            :document-id="formData?.id"
            :enable-batch-edit="canBatchUpdateItems"
            :item-page-loading="itemPageLoading"
            :item-pagination="itemPageState"
            :remote-paging="isRemoteItemPaging"
            :shortcut-active="isSaleOrderFormOpen"
            :suspend-price-auto-refresh="isHydratingFormValues"
            @page-change="handleItemPageChange"
            @request-submit="handleLastInputEnterConfirm"
            @update:items="handleUpdateItems"
            @update:discount-price="handleUpdateDiscountPrice"
            @update:total-price="handleUpdateTotalPrice"
          />
        </template>
      </Form>
    </div>
    <ErpAuditInfo
      v-if="formType === 'detail'"
      class="mx-3 mt-4"
      :record="formData"
    />
  </Modal>
  <RemarkModal @success="handleRemarkSuccess" />
  <ImportFormModal @success="handleImportSuccess" />
  <CustomerDetailModal />
</template>

<style scoped>
:deep(.flex-auto.overflow-hidden:has(> .relative > .erp-detail-link-field)) {
  overflow: visible;
}
</style>
