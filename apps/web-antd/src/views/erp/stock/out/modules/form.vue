<script lang="ts" setup>
import { provide as provideStockDecimalMode } from 'vue';
const emit = defineEmits(['edit', 'print', 'success']);
provideStockDecimalMode('stock-decimal-context', true);
import type { ErpStockOutApi } from '#/api/erp/stock/out';
import type { ErpItemRowFocusField } from '#/views/erp/utils/item-row-focus';

import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  provide,
  ref,
  watch,
} from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createStockOut,
  getStockOut,
  getStockOutEditItemPage,
  getStockOutItemPage,
  matchStockOutItems,
  updateStockOut,
} from '#/api/erp/stock/out';
import {
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import { replaceDetailFieldWithLinkSlot } from '#/views/erp/components/detail-link-schema';
import DetailLinkInput from '#/views/erp/components/DetailLinkInput.vue';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import StockDocumentFormLayout from '#/views/erp/stock/components/StockDocumentFormLayout.vue';
import StockDocumentRemarkForm from '#/views/erp/stock/components/StockDocumentRemarkForm.vue';
import StockDocumentSummary from '#/views/erp/stock/components/StockDocumentSummary.vue';
import {
  buildStockDocumentDetailFormValues,
  buildStockDocumentFormSchema,
  hydrateStockDocumentFormSelectLabels,
} from '#/views/erp/stock/utils/document-form-ui';
import {
  buildStockDetailPrintPayload,
  getStockDetailPrintTooltip,
} from '#/views/erp/stock/utils/item-print-sort';
import {
  createStockItemClientRowKeyManager,
  stripStockItemClientFields,
} from '#/views/erp/stock/utils/item-row-key';
import { cleanOtherStockItem } from '#/views/erp/stock/utils/other-stock-item';
import {
  buildIncrementalRemoteItems,
  isSameRemoteItem,
} from '#/views/erp/stock/utils/remote-item-incremental';
import {
  clampRemoteStockItemPageNo,
  composeRemoteStockItemPage,
  createRemoteStockItemOperationQueue,
  findFirstDuplicateStockItemKey,
  getRemoteStockItemTotal,
  stockPageHasPersistedRows,
} from '#/views/erp/stock/utils/remote-item-paging';
import { stockMultiply } from '#/views/erp/stock/utils/stock-decimal';
import { buildRemoteDocumentSummary } from '#/views/erp/stock/utils/stock-document-summary';
import { CANDIDATE_FOCUS_KEY } from '#/views/erp/utils/candidate-focus';
import { getErpDetailLoadError } from '#/views/erp/utils/detail-load-error';
import {
  focusFirstEditableFormControl,
  focusNextEditableFormControlOnEnter,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';

import { useFormSchema } from '../data';
import ItemForm from './item-form.vue';

provide(CANDIDATE_FOCUS_KEY, ref(true));

const FIELD_PERMISSION_MODULE = 'erp_stock_out';
const EMPTY_ITEMS: ErpStockOutApi.StockOutItem[] = [];
const DEFAULT_ITEM_PAGE_SIZE = 10;
const formData = ref<ErpStockOutApi.StockOut>();
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
const itemFormRef = ref<InstanceType<typeof ItemForm>>();
const basicFormRef = ref<HTMLElement | null>(null);
const isRemoteItemPaging = computed(
  () =>
    Boolean(formData.value?.id) && ['detail', 'edit'].includes(formType.value),
);
const remoteItemEdits = new Map<number, ErpStockOutApi.StockOutItem>();
const remoteItemDeletes = new Set<number>();
const remoteItemCreates = new Map<string, ErpStockOutApi.StockOutItem>();
const remoteItemOriginals = new Map<number, ErpStockOutApi.StockOutItem>();
const itemRowKeyManager = createStockItemClientRowKeyManager('stock-out');
const enqueueRemoteItemOperation = createRemoteStockItemOperationQueue();
const documentSummary = computed(() =>
  buildRemoteDocumentSummary({
    base: {
      totalCount: formData.value?.totalCount ?? '0',
      totalPrice: formData.value?.totalPrice ?? '0',
      totalWeight: formData.value?.totalWeight ?? '0',
    },
    calculate: (item: ErpStockOutApi.StockOutItem) => ({
      totalCount: item.count ?? '0',
      totalPrice:
        item.totalPrice ??
        stockMultiply(item.productPrice ?? 0, item.count ?? 0),
      totalWeight:
        item.totalWeight ?? stockMultiply(item.weight ?? 0, item.count ?? 0),
    }),
    creates: remoteItemCreates,
    deletes: remoteItemDeletes,
    edits: remoteItemEdits,
    localItems: formData.value?.items ?? [],
    originals: remoteItemOriginals,
    remotePaging: isRemoteItemPaging.value,
  }),
);
function protectedSummaryValue(
  value: null | number | string | undefined,
  fields: string[],
): '****' | null | number | string | undefined {
  return fields.some(
    (field) =>
      isFieldHidden(hiddenFields.value, field) ||
      isFieldHidden(hiddenFields.value, `col_${field}`),
  )
    ? '****'
    : value;
}
const documentSummaryEntries = computed(() => [
  {
    format: 'count' as const,
    label: '数量',
    value: protectedSummaryValue(documentSummary.value.totalCount, [
      'totalCount',
      'item_count',
    ]),
  },
  {
    format: 'price' as const,
    label: '金额',
    value: protectedSummaryValue(documentSummary.value.totalPrice, [
      'totalPrice',
      'item_totalPrice',
      'item_productPrice',
      'item_count',
    ]),
  },
  {
    format: 'weight' as const,
    label: '总重',
    value: protectedSummaryValue(documentSummary.value.totalWeight, [
      'totalWeight',
      'item_totalWeight',
      'item_weight',
      'item_count',
    ]),
  },
]);
const canOpenCustomerDetail = computed(() =>
  Boolean(formData.value?.customerId && formData.value?.customerName),
);
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const userStore = useUserStore();
const canQueryDocument = computed(() =>
  hasAccessByCodes(['erp:stock-out:query']),
);
const { hasAccessByCodes } = useAccess();
const canEditRemark = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    hasAccessByCodes(['erp:stock-out:update']),
);
const canPrintFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:stock-out:print']),
);
const detailPrintTooltip = computed(() =>
  getStockDetailPrintTooltip(
    itemPageState.value.orderField,
    itemPageState.value.orderDirection,
  ),
);
function handlePrintFromDetail() {
  if (!formData.value) return;
  emit(
    'print',
    buildStockDetailPrintPayload(
      formData.value,
      itemPageState.value.orderField,
      itemPageState.value.orderDirection,
    ),
  );
}
const canEditFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    formData.value?.status === 10 &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:stock-out:update']),
);
const canBatchUpdateItems = computed(() => {
  if (detailLoading.value || detailLoadError.value) {
    return false;
  }
  if (formType.value === 'detail') {
    return (
      !!formData.value?.id &&
      formData.value?.status === 10 &&
      hasAccessByCodes(['erp:stock-out:update'])
    );
  }
  if (formType.value === 'create' || formType.value === 'edit') {
    return (
      (formData.value?.status === undefined || formData.value?.status === 10) &&
      hasAccessByCodes([
        formData.value?.id ? 'erp:stock-out:update' : 'erp:stock-out:create',
      ])
    );
  }
  return false;
});
const [RemarkModal, remarkModalApi] = useVbenModal({
  connectedComponent: StockDocumentRemarkForm,
  destroyOnClose: true,
});

function handleEditRemark() {
  if (!formData.value?.id) return;
  remarkModalApi
    .setData({
      documentName: '其它出库单',
      documentType: 'stock-out',
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

async function handleEditFromDetail() {
  if (!canEditFromDetail.value || !formData.value) return;
  const row = { ...formData.value };
  await modalApi.close();
  emit('edit', row);
}

function getItemFormInstance() {
  return Array.isArray(itemFormRef.value)
    ? itemFormRef.value[0]
    : itemFormRef.value;
}

function resetRemoteItemState() {
  remoteItemEdits.clear();
  remoteItemDeletes.clear();
  remoteItemCreates.clear();
  remoteItemOriginals.clear();
  itemRowKeyManager.reset();
  itemPageLoadSequence += 1;
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

function rememberRemoteItemOriginals(rows: ErpStockOutApi.StockOutItem[] = []) {
  rows.forEach((item) => {
    if (item.id) {
      remoteItemOriginals.set(item.id, { ...item });
    }
  });
}

function getRemoteLocalItemKey(item: ErpStockOutApi.StockOutItem) {
  return itemRowKeyManager.ensureRowKey(item);
}

function applyRemoteItemCache(rows: ErpStockOutApi.StockOutItem[] = []) {
  itemRowKeyManager.ensureRowKeys(rows);
  const persistedRows = rows
    .filter((item) => !item.id || !remoteItemDeletes.has(item.id))
    .map((item) => (item.id && remoteItemEdits.get(item.id)) || item);
  return itemRowKeyManager.ensureRowKeys(
    composeRemoteStockItemPage({
      createdRows: [...remoteItemCreates.values()],
      pageNo: itemPageState.value.pageNo,
      pageSize: itemPageState.value.pageSize,
      persistedRows,
      persistedTotal: remotePersistedItemTotal,
    }),
  );
}

function recordRemoteItemChanges(rows: ErpStockOutApi.StockOutItem[]) {
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
      const original = remoteItemOriginals.get(item.id);
      if (
        !original ||
        !isSameRemoteItem(
          cleanOtherStockItem(item),
          cleanOtherStockItem(original ?? {}),
        )
      ) {
        remoteItemEdits.set(item.id, { ...item });
      } else {
        remoteItemEdits.delete(item.id);
      }
      return;
    }
    remoteItemCreates.set(getRemoteLocalItemKey(item), { ...item });
  });
  remotePersistedItemTotal = Math.max(
    0,
    remotePersistedItemTotal - (remoteItemDeletes.size - previousDeleteCount),
  );
  itemPageState.value.total = getRemoteStockItemTotal(
    remotePersistedItemTotal,
    remoteItemCreates.size,
  );
}

async function loadStockOutItemPage(
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
  const requestDocumentId = formData.value.id;
  itemPageLoading.value = true;
  try {
    const nextState = {
      ...itemPageState.value,
      ...options,
      pageNo: options.pageNo ?? itemPageState.value.pageNo,
      pageSize: options.pageSize ?? itemPageState.value.pageSize,
    };
    if (remoteItemCreates.size > 0) {
      if (nextState.orderField && nextState.orderDirection) {
        message.warning('存在未保存新增明细，保存后可进行全局排序');
      }
      nextState.orderDirection = undefined;
      nextState.orderField = undefined;
    }
    const total = getRemoteStockItemTotal(
      remotePersistedItemTotal,
      remoteItemCreates.size,
    );
    nextState.pageNo = clampRemoteStockItemPageNo(
      nextState.pageNo,
      nextState.pageSize,
      total,
    );
    if (
      remotePersistedItemTotalKnown &&
      !stockPageHasPersistedRows(
        nextState.pageNo,
        nextState.pageSize,
        remotePersistedItemTotal,
      )
    ) {
      if (
        requestSequence !== itemPageLoadSequence ||
        formData.value?.id !== requestDocumentId ||
        !canQueryDocument.value
      )
        return;
      itemPageState.value = { ...nextState, total };
      formData.value.items = applyRemoteItemCache([]);
      await nextTick();
      return;
    }
    const request = {
      excludedItemIds: [...remoteItemDeletes],
      outId: formData.value.id,
      mask: formType.value === 'detail',
      orderDirection: nextState.orderDirection,
      orderField: nextState.orderField,
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
    };
    const result = await (formType.value === 'edit'
      ? getStockOutEditItemPage(request)
      : getStockOutItemPage(request));
    if (
      requestSequence !== itemPageLoadSequence ||
      formData.value?.id !== requestDocumentId ||
      !canQueryDocument.value
    )
      return;
    remotePersistedItemTotal = result.total ?? 0;
    remotePersistedItemTotalKnown = true;
    itemPageState.value = {
      ...nextState,
      total: getRemoteStockItemTotal(
        remotePersistedItemTotal,
        remoteItemCreates.size,
      ),
    };
    rememberRemoteItemOriginals(result.list ?? []);
    formData.value.items = applyRemoteItemCache(result.list ?? []);
    await nextTick();
  } finally {
    if (requestSequence === itemPageLoadSequence) {
      itemPageLoading.value = false;
    }
  }
}

async function buildMergedRemoteItemsForSubmit() {
  const currentRows: ErpStockOutApi.StockOutItem[] =
    getItemFormInstance()?.getItems?.() ?? formData.value?.items ?? [];
  if (!isRemoteItemPaging.value || !formData.value?.id) {
    return currentRows.map((item) =>
      stripStockItemClientFields(cleanOtherStockItem(item)),
    );
  }
  recordRemoteItemChanges(
    getItemFormInstance()?.getItems?.() ?? formData.value.items ?? [],
  );
  return buildIncrementalRemoteItems(
    remoteItemEdits,
    remoteItemDeletes,
    remoteItemCreates,
  ).map((item) => cleanOtherStockItem(item));
}

async function handleBatchUpdateItemsSuccess() {
  if (!formData.value?.id) return;
  resetRemoteItemState();
  formData.value = await hydrateStockDocumentFormSelectLabels(
    await getStockOut(formData.value.id, { includeItems: false }),
  );
  await applyFormMode(formType.value, formData.value);
  await formApi.setValues(
    buildStockDocumentDetailFormValues(formData.value, formType.value),
  );
  await loadStockOutItemPage({ pageNo: itemPageState.value.pageNo });
  emit('success');
}
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

const getTitle = computed(() => {
  if (formType.value === 'create') {
    return $t('ui.actionTitle.create', ['其它出库单']);
  } else if (formType.value === 'edit') {
    return $t('ui.actionTitle.edit', ['其它出库单']);
  } else {
    return '其它出库单详情';
  }
});

function canFocusBasicForm() {
  return (
    formType.value !== 'detail' &&
    !detailLoading.value &&
    !detailLoadError.value
  );
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

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    labelClass: '!justify-start !text-left',
    labelWidth: 82,
  },
  compact: true,
  wrapperClass: 'stock-document-basic-grid grid-cols-4',
  layout: 'horizontal',
  schema: buildStockDocumentFormSchema(useFormSchema(formType.value), {
    data: formData.value,
    formType: formType.value,
  }),
  showDefaultActions: false,
});

async function applyFormMode(type: string, data = formData.value) {
  formType.value = type;
  modalApi.setState({ fullscreen: true });
  formApi.setDisabled(type === 'detail');
  const schema = replaceDetailFieldWithLinkSlot(
    buildStockDocumentFormSchema(useFormSchema(type, hiddenFields.value), {
      data,
      formType: type,
    }),
    type,
    'customerId',
    'customerDetail',
  );
  formApi.setState({ schema });
  await nextTick();
}

/** 更新出库单项 */
async function handleUpdateItems(items: ErpStockOutApi.StockOutItem[]) {
  const previousDeleteCount = remoteItemDeletes.size;
  recordRemoteItemChanges(items);
  formData.value = {
    ...formData.value,
    items: isRemoteItemPaging.value
      ? applyRemoteItemCache(items.filter((item) => Boolean(item.id)))
      : items,
  } as ErpStockOutApi.StockOut;
  if (
    isRemoteItemPaging.value &&
    remoteItemDeletes.size > previousDeleteCount
  ) {
    await loadStockOutItemPage({
      pageNo: clampRemoteStockItemPageNo(
        itemPageState.value.pageNo,
        itemPageState.value.pageSize,
        itemPageState.value.total,
      ),
    });
  }
}

function buildStockOutDuplicateKey(item: ErpStockOutApi.StockOutItem) {
  if (!item.productId || !item.warehouseId) return '';
  return `${item.productId}|${item.warehouseId}|${String(item.batchNo ?? '').trim()}`;
}

async function validateStockOutBatchWarehouseUpdate(
  rows: ErpStockOutApi.StockOutItem[],
  warehouseId: number,
) {
  const selectedRowKeys = new Set(
    rows.map((item) => getRemoteLocalItemKey(item)),
  );
  const existingRows = isRemoteItemPaging.value
    ? [...remoteItemCreates.values(), ...remoteItemEdits.values()].filter(
        (item) => !selectedRowKeys.has(getRemoteLocalItemKey(item)),
      )
    : (formData.value?.items ?? []).filter(
        (item) => !selectedRowKeys.has(getRemoteLocalItemKey(item)),
      );
  const candidates = rows.map((item) => ({ ...item, warehouseId }));
  if (
    findFirstDuplicateStockItemKey(
      candidates.map((item) => buildStockOutDuplicateKey(item)),
      existingRows.map((item) => buildStockOutDuplicateKey(item)),
    )
  ) {
    message.warning('批量修改后会产生整单重复明细，已取消修改');
    return false;
  }
  if (!isRemoteItemPaging.value || !formData.value?.id) return true;
  try {
    const excludedItemIds = new Set(remoteItemDeletes);
    rows.forEach((item) => item.id && excludedItemIds.add(item.id));
    remoteItemEdits.forEach((_, itemId) => excludedItemIds.add(itemId));
    const result = await matchStockOutItems({
      documentId: formData.value.id,
      excludedItemIds: [...excludedItemIds],
      keys: candidates.map((item) => ({
        batchNo: item.batchNo,
        productId: item.productId,
        warehouseId: item.warehouseId,
      })),
      pageSize: itemPageState.value.pageSize,
    });
    if (result.matches.length > 0) {
      message.warning('批量修改后会与其它页面明细重复，已取消修改');
      return false;
    }
    return true;
  } catch {
    message.error('整单重复校验失败，本次批量修改未执行');
    return false;
  }
}

async function handleAppendItems(
  items: ErpStockOutApi.StockOutItem[],
  focusField: ErpItemRowFocusField = 'count',
  preferredFocusItem?: ErpStockOutApi.StockOutItem,
) {
  if (!isRemoteItemPaging.value || items.length === 0) return;
  const previousPage = { ...itemPageState.value };
  const existingLocalKeys = new Set(
    [...remoteItemCreates.values(), ...remoteItemEdits.values()]
      .map((item) => buildStockOutDuplicateKey(item))
      .filter(Boolean),
  );
  let appendItems = items.filter((item) => {
    const key = buildStockOutDuplicateKey(item);
    if (key && existingLocalKeys.has(key)) return false;
    if (key) existingLocalKeys.add(key);
    return true;
  });
  const matchCandidates = appendItems
    .map((item, itemIndex) => ({ item, itemIndex }))
    .filter(({ item }) => Boolean(buildStockOutDuplicateKey(item)));
  let firstMatch: undefined | { itemId: number; pageNo: number };
  if (matchCandidates.length > 0 && formData.value?.id) {
    const matchResult = await matchStockOutItems({
      documentId: formData.value.id,
      excludedItemIds: [
        ...new Set([...remoteItemDeletes, ...remoteItemEdits.keys()]),
      ],
      keys: matchCandidates.map(({ item }) => ({
        batchNo: item.batchNo,
        productId: item.productId,
        warehouseId: item.warehouseId,
      })),
      pageSize: itemPageState.value.pageSize,
    });
    firstMatch = matchResult.matches[0];
    const duplicateIndexes = new Set(
      matchResult.matches.map(
        (match) => matchCandidates[match.keyIndex]?.itemIndex,
      ),
    );
    appendItems = appendItems.filter(
      (_, index) => !duplicateIndexes.has(index),
    );
    if (duplicateIndexes.size > 0) {
      message.warning(`已阻止 ${duplicateIndexes.size} 条整单重复明细`);
    }
  }
  if (appendItems.length === 0) {
    if (preferredFocusItem) {
      await loadStockOutItemPage({
        orderDirection: undefined,
        orderField: undefined,
        pageNo: previousPage.pageNo,
      });
      await getItemFormInstance()?.focusItemRow?.(
        preferredFocusItem,
        focusField,
      );
    } else if (firstMatch) {
      await loadStockOutItemPage({
        orderDirection: undefined,
        orderField: undefined,
        pageNo: firstMatch.pageNo,
      });
      const target = formData.value?.items?.find(
        (item) => item.id === firstMatch?.itemId,
      );
      if (target)
        await getItemFormInstance()?.focusItemRow?.(target, focusField);
    } else {
      message.warning('选中的明细已存在');
    }
    return;
  }
  const previousCreates = new Map(remoteItemCreates);
  try {
    const usedKeys = new Set(remoteItemCreates.keys());
    appendItems.forEach((sourceItem) => {
      const item = { ...sourceItem, clientRowKey: undefined };
      itemRowKeyManager.ensureRowKey(item, { forceNew: true, usedKeys });
      remoteItemCreates.set(getRemoteLocalItemKey(item), item);
    });
    itemPageState.value.total = getRemoteStockItemTotal(
      remotePersistedItemTotal,
      remoteItemCreates.size,
    );
    const targetPage = preferredFocusItem
      ? previousPage.pageNo
      : clampRemoteStockItemPageNo(
          Number.MAX_SAFE_INTEGER,
          itemPageState.value.pageSize,
          itemPageState.value.total,
        );
    if (
      targetPage === previousPage.pageNo &&
      !previousPage.orderField &&
      !previousPage.orderDirection
    ) {
      itemPageState.value = {
        ...previousPage,
        orderDirection: undefined,
        orderField: undefined,
        pageNo: targetPage,
        total: itemPageState.value.total,
      };
      const currentFormData = formData.value;
      if (!currentFormData) throw new Error('出库单已关闭');
      currentFormData.items = applyRemoteItemCache(
        (currentFormData.items ?? []).filter((item) => Boolean(item.id)),
      );
      await nextTick();
    } else {
      await loadStockOutItemPage({
        orderDirection: undefined,
        orderField: undefined,
        pageNo: targetPage,
      });
    }
    if (preferredFocusItem) {
      await getItemFormInstance()?.focusItemRow?.(
        preferredFocusItem,
        focusField,
      );
    } else {
      const createdStartIndex = Math.max(
        0,
        (targetPage - 1) * itemPageState.value.pageSize -
          remotePersistedItemTotal,
      );
      const focusItem = [...remoteItemCreates.values()][createdStartIndex];
      if (focusItem) {
        await getItemFormInstance()?.focusItemRow?.(focusItem, focusField);
      }
    }
  } catch (error) {
    remoteItemCreates.clear();
    previousCreates.forEach((item, key) => remoteItemCreates.set(key, item));
    itemPageState.value = previousPage;
    await loadStockOutItemPage(previousPage);
    message.error('新增明细定位失败，请重试');
    throw error;
  }
}

function queueUpdateItems(items: ErpStockOutApi.StockOutItem[]) {
  return enqueueRemoteItemOperation(() => handleUpdateItems(items));
}

function queueAppendItems(
  items: ErpStockOutApi.StockOutItem[],
  focusField?: ErpItemRowFocusField,
  preferredFocusItem?: ErpStockOutApi.StockOutItem,
) {
  return enqueueRemoteItemOperation(() =>
    handleAppendItems(items, focusField, preferredFocusItem),
  );
}

/** 创建或更新其它出库单 */
const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (formType.value === 'detail') return;
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
        throw new Error('出库明细不能为空');
      }
      itemFormInstance.validate(
        submitItems.filter(
          (item: { operation?: string }) => item.operation !== 'delete',
        ),
        { requireItems: !isRemoteItemPaging.value },
      );
      formData.value = {
        ...formData.value,
        items: submitItems,
      } as ErpStockOutApi.StockOut;
    } catch (error: any) {
      message.error(error.message || '子表单验证失败');
      return;
    }

    modalApi.lock();
    // 提交表单
    const data = (await formApi.getValues()) as ErpStockOutApi.StockOut;
    data.items = formData.value?.items ?? [];
    try {
      await (formType.value === 'create'
        ? createStockOut(data, { decimalHiddenFields: hiddenFields.value })
        : updateStockOut(data, { decimalHiddenFields: hiddenFields.value }));
      // 关闭并提示
      await modalApi.close();
      emit('success');
      message.success($t('ui.actionMessage.operationSuccess'));
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      detailLoadSequence += 1;
      detailLoading.value = false;
      detailLoadError.value = '';
      formData.value = undefined;
      resetRemoteItemState();
      return;
    }
    const data = modalApi.getData<{ id?: number; type: string }>();
    const sequence = ++detailLoadSequence;
    detailLoadError.value = '';
    detailLoading.value = Boolean(data?.id);
    modalApi.setState({ fullscreen: true });
    modalApi.lock();
    try {
      await loadHiddenFields();
      if (sequence !== detailLoadSequence) return;
      await applyFormMode(data?.type || (data?.id ? 'edit' : 'create'));
      await formApi.resetForm();
      if (data?.id && !canQueryDocument.value) return;
      if (!data?.id) {
        resetRemoteItemState();
        formData.value = await hydrateStockDocumentFormSelectLabels({
          deptId: userStore.userInfo?.deptId,
          items: [],
          outTime: Date.now(),
        } as ErpStockOutApi.StockOut);
        if (sequence !== detailLoadSequence) return;
        await applyFormMode(formType.value, formData.value);
        await formApi.setValues(formData.value);
        return;
      }
      resetRemoteItemState();
      const loaded = await hydrateStockDocumentFormSelectLabels(
        await getStockOut(data.id, { includeItems: false }),
      );
      if (sequence !== detailLoadSequence || !canQueryDocument.value) return;
      formData.value = loaded;
      if (['detail', 'edit'].includes(data.type)) {
        formData.value.items = [];
      }
      if (sequence !== detailLoadSequence) return;
      await applyFormMode(formType.value, formData.value);
      await formApi.setValues(
        buildStockDocumentDetailFormValues(formData.value, formType.value),
      );
      if (['detail', 'edit'].includes(data.type)) {
        await loadStockOutItemPage({ pageNo: 1 });
      }
    } catch (error) {
      if (sequence === detailLoadSequence) {
        formData.value = undefined;
        detailLoadError.value = getErpDetailLoadError(
          error,
          '其它出库单加载失败，请关闭后重试',
        );
      }
    } finally {
      if (sequence === detailLoadSequence) {
        detailLoading.value = false;
        void queueFocusFirstBasicFormControl(sequence);
      }
      modalApi.unlock();
    }
  },
});

async function handleItemPageChange(payload: {
  orderDirection?: 'asc' | 'desc';
  orderField?: string;
  pageNo?: number;
  pageSize?: number;
}) {
  try {
    recordRemoteItemChanges(
      getItemFormInstance()?.getItems?.() ?? formData.value?.items ?? [],
    );
    await loadStockOutItemPage(payload);
  } catch (error) {
    message.error(getErpDetailLoadError(error, '明细加载失败，请重试'));
  }
}
watch(canQueryDocument, (allowed) => {
  if (allowed || formType.value === 'create') return;
  detailLoadSequence += 1;
  itemPageLoadSequence += 1;
  resetRemoteItemState();
  formData.value = undefined;
  detailLoading.value = false;
  modalApi.unlock();
  void modalApi.close();
});
onBeforeUnmount(() => {
  detailLoadSequence += 1;
  itemPageLoadSequence += 1;
});
</script>

<template>
  <Modal
    :title="getTitle"
    :class="{ 'erp-form-focus-highlight': formType !== 'detail' }"
    class="!w-full"
    bordered
    content-class="p-0"
    :show-confirm-button="formType !== 'detail'"
  >
    <StockDocumentFormLayout
      :editable="formType !== 'detail'"
      :error="detailLoadError"
      item-title="出库产品清单"
      :loading="detailLoading"
    >
      <template #basic>
        <div ref="basicFormRef" @keydown.capture="handleBasicFormEnter">
          <Form>
            <template #customerDetail>
              <DetailLinkInput
                :navigable="canOpenCustomerDetail"
                :value="formData?.customerName"
                @open="handleOpenCustomerDetail"
              />
            </template>
          </Form>
        </div>
      </template>
      <template #items>
        <ItemForm
          ref="itemFormRef"
          :dept-id="formData?.deptId"
          :enabled="
            !detailLoading &&
            !detailLoadError &&
            (formType === 'create' || canQueryDocument)
          "
          :before-batch-warehouse-update="validateStockOutBatchWarehouseUpdate"
          :items="formData?.items ?? EMPTY_ITEMS"
          :disabled="formType === 'detail'"
          :enable-batch-edit="canBatchUpdateItems"
          :hidden-fields="hiddenFields"
          :item-page-loading="itemPageLoading"
          :item-pagination="itemPageState"
          :out-id="formData?.id"
          :remote-paging="isRemoteItemPaging"
          @append-items="queueAppendItems"
          @batch-update-success="handleBatchUpdateItemsSuccess"
          @page-change="handleItemPageChange"
          @refresh-items="handleItemPageChange"
          @request-submit="handleLastInputEnterConfirm"
          @update:items="queueUpdateItems"
        />
        <StockDocumentSummary
          :entries="documentSummaryEntries"
          natural-numbers
        />
      </template>
      <template v-if="formType === 'detail'" #audit>
        <ErpAuditInfo class="erp-audit-info" title="" :record="formData" />
      </template>
    </StockDocumentFormLayout>
    <template #prepend-footer>
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
        type="default"
        :title="detailPrintTooltip"
        @click="handlePrintFromDetail"
      >
        打印
      </Button>
    </template>
  </Modal>
  <RemarkModal @success="handleRemarkSuccess" />
  <CustomerDetailModal />
</template>

<style scoped>
:deep(.flex-auto.overflow-hidden:has(> .relative > .erp-detail-link-field)) {
  overflow: visible;
}
</style>
