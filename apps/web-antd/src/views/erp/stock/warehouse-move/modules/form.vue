<script lang="ts" setup>
import { provide as provideStockDecimalMode } from 'vue';
const emit = defineEmits(['edit', 'print', 'success']);
provideStockDecimalMode('stock-decimal-context', true);
import type { ErpWarehouseMoveApi } from '#/api/erp/stock/warehouse-move';
import type { ErpItemRowFocusField } from '#/views/erp/utils/item-row-focus';

import { computed, nextTick, provide, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Modal as AntModal, Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  cancelConfirmWarehouseMove,
  confirmWarehouseMove,
  createWarehouseMove,
  createWarehouseMoveDraft,
  getWarehouseMove,
  getWarehouseMoveEditItemPage,
  getWarehouseMoveItemPage,
  matchWarehouseMoveItems,
  submitWarehouseMove,
  updateAndSubmitWarehouseMoveDraft,
  updateWarehouseMove,
  updateWarehouseMoveDraft,
  WAREHOUSE_MOVE_STATUS,
} from '#/api/erp/stock/warehouse-move';
import {
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import DetailLinkInput from '#/views/erp/components/DetailLinkInput.vue';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import StockDocumentFormLayout from '#/views/erp/stock/components/StockDocumentFormLayout.vue';
import StockDocumentRemarkForm from '#/views/erp/stock/components/StockDocumentRemarkForm.vue';
import StockDocumentSummary from '#/views/erp/stock/components/StockDocumentSummary.vue';
import {
  buildStockDocumentDetailFormValues,
  buildStockDocumentFormSchema,
  hydrateStockDocumentFormSelectLabels,
  mergeResolvedStockDocumentOptions,
} from '#/views/erp/stock/utils/document-form-ui';
import { hasValidWarehouseMoveDraftItems } from '#/views/erp/stock/utils/draft-items';
import {
  buildStockDetailPrintPayload,
  getStockDetailPrintTooltip,
} from '#/views/erp/stock/utils/item-print-sort';
import {
  createStockItemClientRowKeyManager,
  stripStockItemClientFields,
} from '#/views/erp/stock/utils/item-row-key';
import {
  buildIncrementalRemoteItems,
  isSameRemoteItem,
} from '#/views/erp/stock/utils/remote-item-incremental';
import {
  clampRemoteStockItemPageNo,
  composeRemoteStockItemPage,
  createRemoteStockItemOperationQueue,
  getRemoteStockItemTotal,
  stockPageHasPersistedRows,
} from '#/views/erp/stock/utils/remote-item-paging';
import SourceDocumentModal from '#/views/erp/stock/utils/source-document-modal.vue';
import { canNavigateStockSourceDocument } from '#/views/erp/stock/utils/source-document-navigation';
import { stockMultiply } from '#/views/erp/stock/utils/stock-decimal';
import { buildRemoteDocumentSummary } from '#/views/erp/stock/utils/stock-document-summary';
import { CANDIDATE_FOCUS_KEY } from '#/views/erp/utils/candidate-focus';
import { getErpDetailLoadError } from '#/views/erp/utils/detail-load-error';
import {
  focusFirstEditableFormControl,
  focusNextEditableFormControlOnEnter,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';
import { PRICE_REFERENCE_FIELD_NAMES } from '#/views/erp/utils/price-reference';

import { useFormSchema } from '../data';
import ItemForm from './item-form.vue';

import '#/views/erp/styles/form-focus.css';

provide(CANDIDATE_FOCUS_KEY, ref(true));

const FIELD_PERMISSION_MODULE = 'erp_warehouse_move';
const EMPTY_ITEMS: ErpWarehouseMoveApi.WarehouseMoveItem[] = [];
const DEFAULT_ITEM_PAGE_SIZE = 10;
const formType = ref('');
const formData = ref<ErpWarehouseMoveApi.WarehouseMove>();
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
let skipDraftOnClose = false;
let draftSaved = false;
let draftSaving = false;
const draftGenerateLoading = ref(false);
let itemsHydrated = false;
const itemFormRef = ref<InstanceType<typeof ItemForm>>();
const isRemoteItemPaging = computed(
  () =>
    Boolean(formData.value?.id) && ['detail', 'edit'].includes(formType.value),
);
const remoteItemEdits = new Map<
  number,
  ErpWarehouseMoveApi.WarehouseMoveItem
>();
const remoteItemDeletes = new Set<number>();
const remoteItemCreates = new Map<
  string,
  ErpWarehouseMoveApi.WarehouseMoveItem
>();
const remoteItemOriginals = new Map<
  number,
  ErpWarehouseMoveApi.WarehouseMoveItem
>();
const itemRowKeyManager = createStockItemClientRowKeyManager('warehouse-move');
const enqueueRemoteItemOperation = createRemoteStockItemOperationQueue();
const documentSummary = computed(() =>
  buildRemoteDocumentSummary({
    base: {
      totalCostAmount: formData.value?.totalCostAmount ?? '0',
      totalCount: formData.value?.totalCount ?? '0',
      totalPrice: formData.value?.totalPrice ?? '0',
      totalWeight: formData.value?.totalWeight ?? '0',
    },
    calculate: (item: ErpWarehouseMoveApi.WarehouseMoveItem) => ({
      totalCostAmount:
        item.costAmount ?? stockMultiply(item.costPrice ?? 0, item.count ?? 0),
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
const documentSummaryEntries = computed(() => [
  {
    format: 'count' as const,
    label: '数量',
    value: documentSummary.value.totalCount,
  },
  {
    format: 'price' as const,
    hidden: isFieldHidden(hiddenFields.value, 'totalCostAmount'),
    label: '成本金额',
    value: documentSummary.value.totalCostAmount,
  },
  {
    emphasized: true,
    format: 'price' as const,
    hidden: isFieldHidden(hiddenFields.value, 'totalPrice'),
    label: '移货金额',
    value: documentSummary.value.totalPrice,
  },
  {
    format: 'weight' as const,
    label: '总重',
    value: documentSummary.value.totalWeight,
  },
]);
const warehouseOptions = ref<any[]>([]);
const basicFormRef = ref<HTMLElement>();
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const userStore = useUserStore();
const { hasAccessByCodes } = useAccess();
const isEditingDraft = computed(
  () =>
    formType.value === 'edit' &&
    formData.value?.status === WAREHOUSE_MOVE_STATUS.DRAFT,
);
const canSubmitDraft = computed(
  () =>
    formType.value === 'detail' &&
    formData.value?.status === WAREHOUSE_MOVE_STATUS.DRAFT &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:warehouse-move:update-status']),
);
const canGenerateDraft = computed(
  () => formType.value === 'create' || isEditingDraft.value,
);
const generateDraftButtonText = computed(() =>
  isEditingDraft.value ? '保存草稿' : '生成草稿',
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
    hasAccessByCodes(['erp:warehouse-move:update-status'])
  );
});
const confirmText = computed(() =>
  isEditingDraft.value ? '确认提交' : $t('common.confirm'),
);
const canEditRemark = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    formData.value?.sourceType !== 30 &&
    hasAccessByCodes(['erp:warehouse-move:update']),
);
const canPrintFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:warehouse-move:print']),
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
    [WAREHOUSE_MOVE_STATUS.DRAFT, WAREHOUSE_MOVE_STATUS.PROCESS].includes(
      formData.value?.status as 0 | 10,
    ) &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:warehouse-move:update']),
);
const canConfirmFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    formData.value?.status === WAREHOUSE_MOVE_STATUS.PROCESS &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:warehouse-move:confirm']),
);
const canCancelConfirmFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    formData.value?.status === WAREHOUSE_MOVE_STATUS.PICKING &&
    Number(formData.value?.pickedItemCount || 0) === 0 &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:warehouse-move:cancel-confirm']),
);
const [RemarkModal, remarkModalApi] = useVbenModal({
  connectedComponent: StockDocumentRemarkForm,
  destroyOnClose: true,
});

function handleEditRemark() {
  if (!formData.value?.id) return;
  remarkModalApi
    .setData({
      documentName: '仓库移货单',
      documentType: 'warehouse-move',
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
const sourceDocumentModalRef = ref<InstanceType<typeof SourceDocumentModal>>();
const canOpenSourceDocument = computed(() =>
  Boolean(
    formData.value?.sourceNo &&
    canNavigateStockSourceDocument(
      formData.value?.sourceType,
      formData.value?.sourceId,
    ),
  ),
);

function handleOpenSourceDocument() {
  sourceDocumentModalRef.value?.open(
    formData.value?.sourceType,
    formData.value?.sourceId,
  );
}

const getTitle = computed(() => {
  if (formType.value === 'create') {
    return $t('ui.actionTitle.create', ['仓库移货单']);
  }
  if (formType.value === 'edit') {
    return $t('ui.actionTitle.edit', ['仓库移货单']);
  }
  return '仓库移货单详情';
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
    componentProps: { class: 'w-full' },
    labelClass: '!justify-start !text-left',
    labelWidth: 82,
  },
  compact: true,
  layout: 'horizontal',
  schema: buildStockDocumentFormSchema(
    useFormSchema(formType.value, [], {
      onWarehouseChange: handleWarehouseChange,
    }),
    {
      data: formData.value,
      formType: formType.value,
    },
  ),
  showDefaultActions: false,
  wrapperClass: 'stock-document-basic-grid grid-cols-4',
});

async function applyFormMode(type: string, data = formData.value) {
  formType.value = type;
  modalApi.setState({ fullscreen: true });
  formApi.setDisabled(type === 'detail');
  formApi.updateSchema(
    buildStockDocumentFormSchema(
      useFormSchema(type, hiddenFields.value, {
        onWarehouseChange: handleWarehouseChange,
        onWarehouseOptionsChange: handleWarehouseOptionsChange,
      }),
      {
        data,
        formType: type,
      },
    ),
  );
  await nextTick();
}

function findWarehouseName(id?: number) {
  return warehouseOptions.value.find((item) => String(item.id) === String(id))
    ?.name;
}

function handleWarehouseOptionsChange(options: any[]) {
  const nextOptions = mergeResolvedStockDocumentOptions(
    warehouseOptions.value,
    options,
  );
  if (nextOptions !== warehouseOptions.value) {
    warehouseOptions.value = nextOptions;
  }
}

function buildFormValues(
  data: ErpWarehouseMoveApi.WarehouseMove,
): Record<string, any> {
  if (formType.value !== 'detail') {
    return data as Record<string, any>;
  }
  const values = {
    ...data,
    fromWarehouseName:
      data.fromWarehouseName || findWarehouseName(data.fromWarehouseId),
    toWarehouseName:
      data.toWarehouseName || findWarehouseName(data.toWarehouseId),
  };
  return buildStockDocumentDetailFormValues(values, formType.value);
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

function rememberRemoteItemOriginals(
  rows: ErpWarehouseMoveApi.WarehouseMoveItem[] = [],
) {
  rows.forEach((item) => {
    if (item.id && !remoteItemOriginals.has(item.id)) {
      remoteItemOriginals.set(item.id, { ...item });
    }
  });
}

function getRemoteLocalItemKey(item: ErpWarehouseMoveApi.WarehouseMoveItem) {
  return itemRowKeyManager.ensureRowKey(item);
}

function applyRemoteItemCache(
  rows: ErpWarehouseMoveApi.WarehouseMoveItem[] = [],
) {
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

function businessItem(row: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(row).filter(
      ([key]) =>
        !(PRICE_REFERENCE_FIELD_NAMES as readonly string[]).includes(key),
    ),
  );
}
function recordRemoteItemChanges(
  rows: ErpWarehouseMoveApi.WarehouseMoveItem[],
) {
  if (!isRemoteItemPaging.value) {
    return;
  }
  itemRowKeyManager.ensureRowKeys(rows);
  const previousDeleteCount = remoteItemDeletes.size;
  const previousRows = formData.value?.items ?? [];
  const nextIds = new Set(rows.map((item) => item.id).filter(Boolean));
  const nextLocalKeys = new Set(
    rows.filter((item) => !item.id).map((row) => getRemoteLocalItemKey(row)),
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
        original &&
        isSameRemoteItem(businessItem(original), businessItem(item))
      ) {
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
  itemPageState.value.total = getRemoteStockItemTotal(
    remotePersistedItemTotal,
    remoteItemCreates.size,
  );
}

async function loadWarehouseMoveItemPage(
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
      if (requestSequence !== itemPageLoadSequence) return;
      itemPageState.value = { ...nextState, total };
      formData.value.items = applyRemoteItemCache([]);
      await nextTick();
      return;
    }
    const request = {
      excludedItemIds: [...remoteItemDeletes],
      mask: formType.value === 'detail',
      moveId: formData.value.id,
      orderDirection: nextState.orderDirection,
      orderField: nextState.orderField,
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
    };
    const result = await (formType.value === 'edit'
      ? getWarehouseMoveEditItemPage(request)
      : getWarehouseMoveItemPage(request));
    if (requestSequence !== itemPageLoadSequence) return;
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

async function buildMergedRemoteItemsForSubmit(): Promise<
  ErpWarehouseMoveApi.WarehouseMoveItem[]
> {
  if (!isRemoteItemPaging.value || !formData.value?.id) {
    return (
      getItemFormInstance()?.getItems?.() ??
      formData.value?.items ??
      []
    ).map((item: ErpWarehouseMoveApi.WarehouseMoveItem) =>
      stripStockItemClientFields(item),
    );
  }
  getItemFormInstance()?.flushInputs?.();
  await enqueueRemoteItemOperation(() => undefined);
  recordRemoteItemChanges(
    getItemFormInstance()?.getItems?.() ?? formData.value.items ?? [],
  );
  return buildIncrementalRemoteItems(
    remoteItemEdits,
    remoteItemDeletes,
    remoteItemCreates,
  );
}

async function reloadItemForm() {
  await nextTick();
  const itemFormInstance = getItemFormInstance();
  if (!itemFormInstance) {
    throw new Error('仓库移货单明细表格尚未就绪');
  }
  await itemFormInstance.reloadItems(formData.value?.items ?? []);
  formData.value = {
    ...formData.value,
    items: itemFormInstance.getItems(),
  } as ErpWarehouseMoveApi.WarehouseMove;
  itemsHydrated = true;
}

async function refreshWarehouseNames() {
  const values = await formApi.getValues();
  formData.value = {
    ...formData.value,
    ...values,
    fromWarehouseName:
      findWarehouseName(values.fromWarehouseId) ||
      formData.value?.fromWarehouseName,
    toWarehouseName:
      findWarehouseName(values.toWarehouseId) ||
      formData.value?.toWarehouseName,
  } as ErpWarehouseMoveApi.WarehouseMove;
}

async function handleUpdateItems(
  items: ErpWarehouseMoveApi.WarehouseMoveItem[],
) {
  const previousDeleteCount = remoteItemDeletes.size;
  recordRemoteItemChanges(items);
  const currentValues = await formApi.getValues();
  const nextItems = isRemoteItemPaging.value
    ? applyRemoteItemCache(items.filter((item) => Boolean(item.id)))
    : items;
  formData.value = {
    ...formData.value,
    ...currentValues,
    items: nextItems,
  } as ErpWarehouseMoveApi.WarehouseMove;
  await formApi.setValues({ items: nextItems });
  if (
    isRemoteItemPaging.value &&
    remoteItemDeletes.size > previousDeleteCount
  ) {
    await loadWarehouseMoveItemPage({
      pageNo: clampRemoteStockItemPageNo(
        itemPageState.value.pageNo,
        itemPageState.value.pageSize,
        itemPageState.value.total,
      ),
    });
  }
}

function buildWarehouseMoveDuplicateKey(
  item: ErpWarehouseMoveApi.WarehouseMoveItem,
) {
  if (!item.productId || !item.fromWarehouseId || !item.toWarehouseId)
    return '';
  return `${item.productId}|${item.fromWarehouseId}|${item.toWarehouseId}|${String(item.fromShelf ?? '').trim()}`;
}

async function handleAppendItems(
  items: ErpWarehouseMoveApi.WarehouseMoveItem[],
  focusField: ErpItemRowFocusField = 'count',
  preferredFocusItem?: ErpWarehouseMoveApi.WarehouseMoveItem,
) {
  if (!isRemoteItemPaging.value || items.length === 0) return;
  const previousPage = { ...itemPageState.value };
  const existingLocalKeys = new Set(
    [...remoteItemCreates.values(), ...remoteItemEdits.values()]
      .map((row) => buildWarehouseMoveDuplicateKey(row))
      .filter(Boolean),
  );
  let appendItems = items.filter((item) => {
    const key = buildWarehouseMoveDuplicateKey(item);
    if (key && existingLocalKeys.has(key)) return false;
    if (key) existingLocalKeys.add(key);
    return true;
  });
  const matchCandidates = appendItems
    .map((item, itemIndex) => ({ item, itemIndex }))
    .filter(({ item }) => Boolean(buildWarehouseMoveDuplicateKey(item)));
  let firstMatch: undefined | { itemId: number; pageNo: number };
  if (matchCandidates.length > 0 && formData.value?.id) {
    const matchResult = await matchWarehouseMoveItems({
      documentId: formData.value.id,
      excludedItemIds: [
        ...new Set([...remoteItemDeletes, ...remoteItemEdits.keys()]),
      ],
      keys: matchCandidates.map(({ item }) => ({
        fromShelf: item.fromShelf,
        fromWarehouseId: item.fromWarehouseId,
        productId: item.productId,
        toWarehouseId: item.toWarehouseId,
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
      await loadWarehouseMoveItemPage({
        orderDirection: undefined,
        orderField: undefined,
        pageNo: previousPage.pageNo,
      });
      await getItemFormInstance()?.focusItemRow?.(
        preferredFocusItem,
        focusField,
      );
    } else if (firstMatch) {
      await loadWarehouseMoveItemPage({
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
      if (!currentFormData) throw new Error('仓库移货单已关闭');
      currentFormData.items = applyRemoteItemCache(
        (currentFormData.items ?? []).filter((item) => Boolean(item.id)),
      );
      await nextTick();
    } else {
      await loadWarehouseMoveItemPage({
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
    await loadWarehouseMoveItemPage(previousPage);
    message.error('新增明细定位失败，请重试');
    throw error;
  }
}

function queueUpdateItems(items: ErpWarehouseMoveApi.WarehouseMoveItem[]) {
  return enqueueRemoteItemOperation(() => handleUpdateItems(items));
}

function queueAppendItems(
  items: ErpWarehouseMoveApi.WarehouseMoveItem[],
  focusField: ErpItemRowFocusField = 'count',
  preferredFocusItem?: ErpWarehouseMoveApi.WarehouseMoveItem,
) {
  return enqueueRemoteItemOperation(() =>
    handleAppendItems(items, focusField, preferredFocusItem),
  );
}

async function handleWarehouseChange() {
  const oldItems = formData.value?.items || [];
  await refreshWarehouseNames();
  if (oldItems.length === 0) {
    return;
  }
  AntModal.confirm({
    title: '仓库已变更，是否清空明细？',
    content: '移出或移入仓库变化后，原明细中的库存来源不再可靠。',
    onOk: async () => {
      formData.value = { ...formData.value, items: [] };
      await formApi.setValues({ items: [] });
    },
  });
}

async function buildCurrentWarehouseMovePayload() {
  const itemFormInstance = Array.isArray(itemFormRef.value)
    ? itemFormRef.value[0]
    : itemFormRef.value;
  if (!itemsHydrated || !itemFormInstance) {
    throw new Error('仓库移货单明细尚未加载完成，请稍后重试');
  }
  const values =
    (await formApi.getValues()) as ErpWarehouseMoveApi.WarehouseMove;
  const currentItems = await buildMergedRemoteItemsForSubmit();
  const payload = {
    ...formData.value,
    ...values,
    id: formData.value?.id,
    deptId:
      values.deptId ?? formData.value?.deptId ?? userStore.userInfo?.deptId,
    handlerId:
      values.handlerId ?? formData.value?.handlerId ?? userStore.userInfo?.id,
    items: currentItems,
  } as ErpWarehouseMoveApi.WarehouseMove;
  if (Array.isArray(payload.fileUrl)) {
    payload.fileUrl = payload.fileUrl[0] || '';
  }
  return payload;
}

function handleSubmitDraft() {
  if (!formData.value?.id) return;
  const id = formData.value.id;
  const no = formData.value.no;
  AntModal.confirm({
    title: `确认提交仓库移货单${no ? ` ${no}` : ''}吗？`,
    content: '提交后将进入待下单确认状态，不能再按草稿方式修改。',
    async onOk() {
      modalApi.lock();
      try {
        await submitWarehouseMove(id);
        skipDraftOnClose = true;
        emit('success');
        await modalApi.close();
        message.success('仓库移货单已提交，下一步可进行下单确认');
      } finally {
        modalApi.unlock();
      }
    },
  });
}

function handleConfirmWarehouseMove() {
  if (!formData.value?.id) return;
  const id = formData.value.id;
  const no = formData.value.no;
  AntModal.confirm({
    title: `确认仓库移货单${no ? ` ${no}` : ''}吗？`,
    content: '确认后将锁定业务数据并生成拣货任务。',
    async onOk() {
      modalApi.lock();
      try {
        await confirmWarehouseMove(id);
        emit('success');
        await modalApi.close();
        message.success('下单确认成功，已生成拣货任务');
      } finally {
        modalApi.unlock();
      }
    },
  });
}

function handleCancelConfirmWarehouseMove() {
  if (!formData.value?.id) return;
  const id = formData.value.id;
  const no = formData.value.no;
  AntModal.confirm({
    title: `确认撤销${no ? ` ${no}` : ''}的下单确认吗？`,
    content: '仅完全未开始拣货的任务可以撤销。',
    async onOk() {
      modalApi.lock();
      try {
        await cancelConfirmWarehouseMove(id);
        emit('success');
        await modalApi.close();
        message.success('已撤销下单确认');
      } finally {
        modalApi.unlock();
      }
    },
  });
}

async function saveWarehouseMoveDraft({
  closeWhenEmpty = true,
  failureMessage,
  successMessage,
}: {
  closeWhenEmpty?: boolean;
  failureMessage?: string;
  successMessage?: string;
} = {}) {
  const isCreatingDraft = formType.value === 'create';
  const isUpdatingDraft = isEditingDraft.value && Boolean(formData.value?.id);
  if (
    (!isCreatingDraft && !isUpdatingDraft) ||
    skipDraftOnClose ||
    draftSaved ||
    detailLoading.value ||
    detailLoadError.value
  ) {
    return true;
  }
  if (draftSaving) {
    return false;
  }
  if (isUpdatingDraft && !itemsHydrated) {
    message.error('明细尚未加载完成，已阻止草稿覆盖，请稍后再试');
    return false;
  }
  draftSaving = true;
  modalApi.lock();
  try {
    const data = await buildCurrentWarehouseMovePayload();
    if (
      isCreatingDraft &&
      !hasValidWarehouseMoveDraftItems(
        data.items ?? [],
        data.fromWarehouseId,
        data.toWarehouseId,
      )
    ) {
      draftSaved = closeWhenEmpty;
      message.warning('未选择明细，不生成草稿');
      return closeWhenEmpty;
    }
    await (isCreatingDraft
      ? createWarehouseMoveDraft(data, {
          decimalHiddenFields: hiddenFields.value,
        })
      : updateWarehouseMoveDraft(data, {
          decimalHiddenFields: hiddenFields.value,
        }));
    draftSaved = true;
    emit('success');
    message.success(
      successMessage ??
        (isCreatingDraft ? '未提交内容已自动保存为草稿' : '草稿修改已自动保存'),
    );
    return true;
  } catch {
    message.error(
      failureMessage ??
        (isCreatingDraft
          ? '草稿自动保存失败，新增页面已保留，请稍后重试'
          : '草稿修改保存失败，编辑页面已保留，请稍后重试'),
    );
    return false;
  } finally {
    draftSaving = false;
    modalApi.unlock();
  }
}

async function handleGenerateDraft() {
  if (!canGenerateDraft.value || draftGenerateLoading.value) return;
  const isSavingDraft = isEditingDraft.value;
  draftGenerateLoading.value = true;
  try {
    const saved = await saveWarehouseMoveDraft({
      closeWhenEmpty: false,
      failureMessage: isSavingDraft
        ? '草稿保存失败，请稍后重试'
        : '草稿生成失败，请稍后重试',
      successMessage: isSavingDraft ? '草稿保存成功' : '草稿生成成功',
    });
    if (!saved) return;
    skipDraftOnClose = true;
    await modalApi.close();
  } finally {
    draftGenerateLoading.value = false;
  }
}

const [Modal, modalApi] = useVbenModal({
  async onBeforeClose() {
    return saveWarehouseMoveDraft();
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
    const itemFormInstance = Array.isArray(itemFormRef.value)
      ? itemFormRef.value[0]
      : itemFormRef.value;
    try {
      itemFormInstance?.validate(undefined, {
        requireItems: !isRemoteItemPaging.value,
      });
      const submitItems = await buildMergedRemoteItemsForSubmit();
      if (
        isRemoteItemPaging.value &&
        formData.value?.id &&
        itemPageState.value.total <= 0
      ) {
        throw new Error('请至少选择一条库存明细');
      }
      itemFormInstance?.validate(
        submitItems.filter((item) => item.operation !== 'delete'),
        { requireItems: !isRemoteItemPaging.value },
      );
      formData.value = {
        ...formData.value,
        items: submitItems,
      } as ErpWarehouseMoveApi.WarehouseMove;
    } catch (error: any) {
      message.error(error.message || '明细校验失败');
      return;
    }

    modalApi.lock();
    try {
      const submitData = await buildCurrentWarehouseMovePayload();
      if (formType.value === 'create') {
        await createWarehouseMove(submitData, {
          decimalHiddenFields: hiddenFields.value,
        });
      } else if (isEditingDraft.value) {
        await updateAndSubmitWarehouseMoveDraft(submitData, {
          decimalHiddenFields: hiddenFields.value,
        });
      } else {
        await updateWarehouseMove(submitData, {
          decimalHiddenFields: hiddenFields.value,
        });
      }
      skipDraftOnClose = true;
      emit('success');
      await modalApi.close();
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
      itemsHydrated = false;
      resetRemoteItemState();
      return;
    }
    const data = modalApi.getData<{ id?: number; type: string }>();
    const sequence = ++detailLoadSequence;
    skipDraftOnClose = false;
    draftSaved = false;
    draftSaving = false;
    itemsHydrated = false;
    resetRemoteItemState();
    detailLoadError.value = '';
    detailLoading.value = Boolean(data?.id);
    modalApi.setState({ fullscreen: true });
    modalApi.lock();
    try {
      await loadHiddenFields();
      if (sequence !== detailLoadSequence) return;
      await applyFormMode(data?.type || (data?.id ? 'edit' : 'create'));
      await formApi.resetForm();
      if (data?.id) {
        formData.value = await hydrateStockDocumentFormSelectLabels(
          await getWarehouseMove(data.id, {
            includeItems: !['detail', 'edit'].includes(data.type),
          }),
        );
        if (['detail', 'edit'].includes(data.type)) {
          formData.value.items = [];
        }
      } else {
        const now = Date.now();
        formData.value = await hydrateStockDocumentFormSelectLabels({
          deptId: userStore.userInfo?.deptId,
          handlerId: userStore.userInfo?.id,
          items: [],
          moveTime: now,
        } as ErpWarehouseMoveApi.WarehouseMove);
      }
      if (sequence !== detailLoadSequence) return;
      await applyFormMode(formType.value, formData.value);
      await formApi.setValues(buildFormValues(formData.value));
      if (data?.id && ['detail', 'edit'].includes(data.type)) {
        await loadWarehouseMoveItemPage({ pageNo: 1 });
        if (sequence !== detailLoadSequence) return;
        await reloadItemForm();
      } else {
        await reloadItemForm();
      }
    } catch (error) {
      if (sequence === detailLoadSequence) {
        formData.value = undefined;
        detailLoadError.value = getErpDetailLoadError(
          error,
          '仓库移货单加载失败，请关闭后重试',
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
  getItemFormInstance()?.flushInputs?.();
  await enqueueRemoteItemOperation(() => undefined);
  recordRemoteItemChanges(
    getItemFormInstance()?.getItems?.() ?? formData.value?.items ?? [],
  );
  await loadWarehouseMoveItemPage(payload);
}
</script>

<template>
  <Modal
    :show-confirm-button="canConfirmForm"
    :confirm-text="confirmText"
    :title="getTitle"
    class="!w-full"
    :class="{ 'erp-form-focus-highlight': formType !== 'detail' }"
    bordered
    content-class="p-0"
  >
    <StockDocumentFormLayout
      :editable="formType !== 'detail'"
      :error="detailLoadError"
      item-title="移货产品清单"
      :loading="detailLoading"
    >
      <template #basic>
        <div ref="basicFormRef" @keydown.capture="handleBasicFormEnter">
          <Form>
            <template #sourceNo>
              <DetailLinkInput
                :navigable="canOpenSourceDocument"
                :value="formData?.sourceNo"
                @open="handleOpenSourceDocument"
              />
            </template>
          </Form>
        </div>
      </template>
      <template #items>
        <ItemForm
          ref="itemFormRef"
          :disabled="formType === 'detail'"
          :from-warehouse-id="formData?.fromWarehouseId"
          :from-warehouse-name="formData?.fromWarehouseName"
          :hidden-fields="hiddenFields"
          :item-page-loading="itemPageLoading"
          :item-pagination="itemPageState"
          :items="formData?.items ?? EMPTY_ITEMS"
          :remote-paging="isRemoteItemPaging"
          @append-items="queueAppendItems"
          :to-warehouse-id="formData?.toWarehouseId"
          :to-warehouse-name="formData?.toWarehouseName"
          @page-change="handleItemPageChange"
          @refresh-items="handleItemPageChange"
          :dept-id="formData?.deptId"
          @request-submit="handleLastInputEnterConfirm"
          @update:items="queueUpdateItems"
        />
        <StockDocumentSummary
          natural-numbers
          :entries="documentSummaryEntries"
        />
      </template>
      <template v-if="formType === 'detail'" #audit>
        <div
          v-if="formData?.confirmTime || formData?.pickProgress"
          class="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-sm"
        >
          <span v-if="formData?.confirmUserName">
            下单确认人：{{ formData.confirmUserName }}
          </span>
          <span v-if="formData?.confirmTime">
            下单确认时间：{{ formData.confirmTime }}
          </span>
          <span v-if="formData?.pickProgress">
            拣货进度：{{ formData.pickProgress }}
          </span>
        </div>
        <ErpAuditInfo class="erp-audit-info" title="" :record="formData" />
      </template>
    </StockDocumentFormLayout>
    <template #center-footer>
      <Button
        v-if="canGenerateDraft"
        :loading="draftGenerateLoading"
        @click="handleGenerateDraft"
      >
        {{ generateDraftButtonText }}
      </Button>
    </template>
    <template #prepend-footer>
      <Button
        v-if="canConfirmFromDetail"
        type="primary"
        @click="handleConfirmWarehouseMove"
      >
        下单确认
      </Button>
      <Button
        v-if="canCancelConfirmFromDetail"
        @click="handleCancelConfirmWarehouseMove"
      >
        撤销确认
      </Button>
      <Button v-if="canSubmitDraft" type="primary" @click="handleSubmitDraft">
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
        type="default"
        :title="detailPrintTooltip"
        @click="handlePrintFromDetail"
      >
        打印
      </Button>
    </template>
  </Modal>
  <RemarkModal @success="handleRemarkSuccess" />
  <SourceDocumentModal ref="sourceDocumentModalRef" />
</template>

<style scoped>
:deep(.flex-auto.overflow-hidden:has(> .relative > .erp-detail-link-field)) {
  overflow: visible;
}
</style>
