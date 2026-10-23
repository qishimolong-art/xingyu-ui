<script lang="ts" setup>
import { provide as provideStockDecimalMode } from 'vue';
const emit = defineEmits(['edit', 'print', 'success']);
provideStockDecimalMode('stock-decimal-context', true);
import type { ErpStockCheckApi as ErpStockCheckApiType } from '#/api/erp/stock/check';
import type { ErpItemRowFocusField } from '#/views/erp/utils/item-row-focus';

import { computed, nextTick, provide, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Modal as AntModal, Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createStockCheck,
  createStockCheckDraft,
  ErpStockCheckApi,
  getStockCheck,
  getStockCheckEditItemPage,
  getStockCheckItemPage,
  matchStockCheckItems,
  submitStockCheck,
  updateAndSubmitStockCheckDraft,
  updateStockCheck,
  updateStockCheckDraft,
} from '#/api/erp/stock/check';
import {
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import StockDocumentFormLayout from '#/views/erp/stock/components/StockDocumentFormLayout.vue';
import StockDocumentRemarkForm from '#/views/erp/stock/components/StockDocumentRemarkForm.vue';
import StockDocumentSummary from '#/views/erp/stock/components/StockDocumentSummary.vue';
import {
  buildStockDocumentDetailFormValues,
  buildStockDocumentFormSchema,
  hydrateStockDocumentFormSelectLabels,
} from '#/views/erp/stock/utils/document-form-ui';
import { hasValidStockCheckDraftItems } from '#/views/erp/stock/utils/draft-items';
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
import { PRICE_REFERENCE_FIELD_NAMES } from '#/views/erp/utils/price-reference';

import { useFormSchema } from '../data';
import ItemForm from './item-form.vue';

import '#/views/erp/styles/form-focus.css';

provide(CANDIDATE_FOCUS_KEY, ref(true));

const FIELD_PERMISSION_MODULE = 'erp_stock_check';
const EMPTY_ITEMS: ErpStockCheckApiType.StockCheckItem[] = [];
const DEFAULT_ITEM_PAGE_SIZE = 10;
const formData = ref<ErpStockCheckApiType.StockCheck>();
const checkType = ref(ErpStockCheckApi.CHECK_TYPE_COUNT);
const formType = ref('');
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
const itemFormRef = ref<InstanceType<typeof ItemForm>>();
const basicFormRef = ref<HTMLElement | null>(null);
const isRemoteItemPaging = computed(
  () =>
    Boolean(formData.value?.id) && ['detail', 'edit'].includes(formType.value),
);
const remoteItemEdits = new Map<number, ErpStockCheckApiType.StockCheckItem>();
const remoteItemDeletes = new Set<number>();
const remoteItemCreates = new Map<
  string,
  ErpStockCheckApiType.StockCheckItem
>();
const remoteItemOriginals = new Map<
  number,
  ErpStockCheckApiType.StockCheckItem
>();
const itemRowKeyManager = createStockItemClientRowKeyManager('stock-check');
const enqueueRemoteItemOperation = createRemoteStockItemOperationQueue();
const documentSummary = computed(() =>
  buildRemoteDocumentSummary({
    base: {
      totalCount: formData.value?.totalCount ?? '0',
      totalPrice: formData.value?.totalPrice ?? '0',
      totalWeight: formData.value?.totalWeight ?? '0',
    },
    calculate: (item: ErpStockCheckApiType.StockCheckItem) => ({
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
    hidden: isFieldHidden(hiddenFields.value, 'totalPrice'),
    label: '金额',
    value: documentSummary.value.totalPrice,
  },
  {
    format: 'weight' as const,
    label: '总重',
    value: documentSummary.value.totalWeight,
  },
]);
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const userStore = useUserStore();
const { hasAccessByCodes } = useAccess();
const isEditingDraft = computed(
  () =>
    formType.value === 'edit' &&
    formData.value?.status === ErpStockCheckApi.STATUS_DRAFT,
);
const canSubmitDraft = computed(
  () =>
    formType.value === 'detail' &&
    formData.value?.status === ErpStockCheckApi.STATUS_DRAFT &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:stock-check:update-status']),
);
const canGenerateDraft = computed(
  () => formType.value === 'create' || isEditingDraft.value,
);
const generateDraftButtonText = computed(() =>
  isEditingDraft.value ? '保存草稿' : '生成草稿',
);
const confirmText = computed(() =>
  isEditingDraft.value ? '确认提交' : $t('common.confirm'),
);
const canConfirmForm = computed(
  () =>
    formType.value !== 'detail' &&
    (!isEditingDraft.value ||
      hasAccessByCodes(['erp:stock-check:update-status'])),
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
    hasAccessByCodes(['erp:stock-check:update']),
);
const canPrintFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:stock-check:print']),
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
    formData.value?.status !== ErpStockCheckApi.STATUS_APPROVE &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:stock-check:update']),
);
const canBatchUpdateItems = computed(() => {
  if (detailLoading.value || detailLoadError.value) {
    return false;
  }
  if (formType.value === 'detail') {
    return (
      !!formData.value?.id &&
      formData.value?.status !== ErpStockCheckApi.STATUS_APPROVE &&
      hasAccessByCodes(['erp:stock-check:update'])
    );
  }
  if (formType.value === 'create' || formType.value === 'edit') {
    return (
      formData.value?.status !== ErpStockCheckApi.STATUS_APPROVE &&
      hasAccessByCodes([
        formData.value?.id
          ? 'erp:stock-check:update'
          : 'erp:stock-check:create',
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
      documentName: '库存盘点单',
      documentType: 'stock-check',
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

function rememberRemoteItemOriginals(
  rows: ErpStockCheckApiType.StockCheckItem[] = [],
) {
  rows.forEach((item) => {
    if (item.id) {
      remoteItemOriginals.set(item.id, { ...item });
    }
  });
}

function getRemoteLocalItemKey(item: ErpStockCheckApiType.StockCheckItem) {
  return itemRowKeyManager.ensureRowKey(item);
}

function applyRemoteItemCache(
  rows: ErpStockCheckApiType.StockCheckItem[] = [],
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

function stockCheckBusinessFields(row: ErpStockCheckApiType.StockCheckItem) {
  return Object.fromEntries(
    Object.entries(row).filter(
      ([key]) =>
        !(PRICE_REFERENCE_FIELD_NAMES as readonly string[]).includes(key),
    ),
  );
}

function recordRemoteItemChanges(rows: ErpStockCheckApiType.StockCheckItem[]) {
  if (!isRemoteItemPaging.value) {
    return;
  }
  itemRowKeyManager.ensureRowKeys(rows);
  const previousDeleteCount = remoteItemDeletes.size;
  const previousRows = formData.value?.items ?? [];
  const nextIds = new Set(rows.map((item) => item.id).filter(Boolean));
  const nextLocalKeys = new Set(
    rows
      .filter((item) => !item.id)
      .map((value) => getRemoteLocalItemKey(value)),
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
          stockCheckBusinessFields(item),
          stockCheckBusinessFields(original),
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

async function loadStockCheckItemPage(
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
      checkId: formData.value.id,
      mask: formType.value === 'detail',
      orderDirection: nextState.orderDirection,
      orderField: nextState.orderField,
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
    };
    const result = await (formType.value === 'edit'
      ? getStockCheckEditItemPage(request)
      : getStockCheckItemPage(request));
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

async function buildMergedRemoteItemsForSubmit() {
  getItemFormInstance()?.flushDecimalInputs?.();
  await enqueueRemoteItemOperation(() => undefined);
  if (!isRemoteItemPaging.value || !formData.value?.id) {
    return (formData.value?.items ?? []).map((item) =>
      stripStockItemClientFields(item),
    );
  }
  recordRemoteItemChanges(
    getItemFormInstance()?.getItems?.() ?? formData.value.items ?? [],
  );
  return buildIncrementalRemoteItems(
    remoteItemEdits,
    remoteItemDeletes,
    remoteItemCreates,
  );
}

async function handleBatchUpdateItemsSuccess() {
  if (!formData.value?.id) return;
  resetRemoteItemState();
  formData.value = await hydrateStockDocumentFormSelectLabels(
    await getStockCheck(formData.value.id, { includeItems: false }),
  );
  formData.value.checkType =
    formData.value.checkType ?? ErpStockCheckApi.CHECK_TYPE_COUNT;
  checkType.value = formData.value.checkType;
  await applyFormMode(formType.value, formData.value);
  await formApi.setValues(
    buildStockDocumentDetailFormValues(formData.value, formType.value),
  );
  await loadStockCheckItemPage({ pageNo: itemPageState.value.pageNo });
  emit('success');
}

const getTitle = computed(() => {
  if (formType.value === 'create') {
    return $t('ui.actionTitle.create', ['库存盘点单']);
  }
  if (formType.value === 'edit') {
    return $t('ui.actionTitle.edit', ['库存盘点单']);
  }
  return '库存盘点单详情';
});

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
  handleValuesChange(values, changedFields) {
    if ('checkType' in changedFields) {
      checkType.value = values.checkType ?? ErpStockCheckApi.CHECK_TYPE_COUNT;
      formData.value = {
        ...formData.value,
        checkType: checkType.value,
      } as ErpStockCheckApiType.StockCheck;
    }
  },
});

async function applyFormMode(type: string, data = formData.value) {
  formType.value = type;
  modalApi.setState({ fullscreen: true });
  formApi.setDisabled(type === 'detail');
  formApi.updateSchema(
    buildStockDocumentFormSchema(useFormSchema(type, hiddenFields.value), {
      data,
      formType: type,
    }),
  );
  await nextTick();
}

watch(
  () => formData.value?.checkType,
  (value) => {
    checkType.value = value ?? ErpStockCheckApi.CHECK_TYPE_COUNT;
  },
);

async function handleUpdateItems(items: ErpStockCheckApiType.StockCheckItem[]) {
  const previousDeleteCount = remoteItemDeletes.size;
  recordRemoteItemChanges(items);
  const nextItems = isRemoteItemPaging.value
    ? applyRemoteItemCache(items.filter((item) => Boolean(item.id)))
    : items;
  formData.value = {
    ...formData.value,
    items: nextItems,
  } as ErpStockCheckApiType.StockCheck;
  formApi.setValues({
    items: nextItems,
  });
  if (
    isRemoteItemPaging.value &&
    remoteItemDeletes.size > previousDeleteCount
  ) {
    await loadStockCheckItemPage({
      pageNo: clampRemoteStockItemPageNo(
        itemPageState.value.pageNo,
        itemPageState.value.pageSize,
        itemPageState.value.total,
      ),
    });
  }
}

function buildStockCheckDuplicateKey(
  item: ErpStockCheckApiType.StockCheckItem,
) {
  if (!item.productId || !item.warehouseId) return '';
  return `${item.productId}|${item.warehouseId}|${String(item.batchNo ?? '').trim()}`;
}

async function validateStockCheckBatchWarehouseUpdate(
  rows: ErpStockCheckApiType.StockCheckItem[],
  warehouseId: number,
) {
  const selectedRowKeys = new Set(
    rows.map((value) => getRemoteLocalItemKey(value)),
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
      candidates.map((value) => buildStockCheckDuplicateKey(value)),
      existingRows.map((value) => buildStockCheckDuplicateKey(value)),
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
    const result = await matchStockCheckItems({
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
  items: ErpStockCheckApiType.StockCheckItem[],
  focusField: ErpItemRowFocusField = 'count',
  preferredFocusItem?: ErpStockCheckApiType.StockCheckItem,
) {
  if (!isRemoteItemPaging.value || items.length === 0) return;
  const previousPage = { ...itemPageState.value };
  const existingLocalKeys = new Set(
    [...remoteItemCreates.values(), ...remoteItemEdits.values()]
      .map((value) => buildStockCheckDuplicateKey(value))
      .filter(Boolean),
  );
  let appendItems = items.filter((item) => {
    const key = buildStockCheckDuplicateKey(item);
    if (key && existingLocalKeys.has(key)) return false;
    if (key) existingLocalKeys.add(key);
    return true;
  });
  const matchCandidates = appendItems
    .map((item, itemIndex) => ({ item, itemIndex }))
    .filter(({ item }) => Boolean(buildStockCheckDuplicateKey(item)));
  let firstMatch: undefined | { itemId: number; pageNo: number };
  if (matchCandidates.length > 0 && formData.value?.id) {
    const matchResult = await matchStockCheckItems({
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
      await loadStockCheckItemPage({
        orderDirection: undefined,
        orderField: undefined,
        pageNo: previousPage.pageNo,
      });
      await getItemFormInstance()?.focusItemRow?.(
        preferredFocusItem,
        focusField,
      );
    } else if (firstMatch) {
      await loadStockCheckItemPage({
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
      if (!currentFormData) throw new Error('盘点单已关闭');
      currentFormData.items = applyRemoteItemCache(
        (currentFormData.items ?? []).filter((item) => Boolean(item.id)),
      );
      await nextTick();
    } else {
      await loadStockCheckItemPage({
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
    await loadStockCheckItemPage(previousPage);
    message.error('新增明细定位失败，请重试');
    throw error;
  }
}

function queueUpdateItems(items: ErpStockCheckApiType.StockCheckItem[]) {
  return enqueueRemoteItemOperation(() => handleUpdateItems(items));
}

function queueAppendItems(
  items: ErpStockCheckApiType.StockCheckItem[],
  focusField: ErpItemRowFocusField = 'count',
  preferredFocusItem?: ErpStockCheckApiType.StockCheckItem,
) {
  return enqueueRemoteItemOperation(() =>
    handleAppendItems(items, focusField, preferredFocusItem),
  );
}

async function buildCurrentStockCheckPayload() {
  const values = (await formApi.getValues()) as ErpStockCheckApiType.StockCheck;
  const payload = {
    ...formData.value,
    ...values,
    id: formData.value?.id,
    checkType: values.checkType ?? checkType.value,
    deptId:
      values.deptId ?? formData.value?.deptId ?? userStore.userInfo?.deptId,
    items: await buildMergedRemoteItemsForSubmit(),
  } as ErpStockCheckApiType.StockCheck;
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
    title: `确认提交库存盘点单${no ? ` ${no}` : ''}吗？`,
    content: '提交后将进入待审核状态，不能再按草稿方式修改。',
    async onOk() {
      modalApi.lock();
      try {
        await submitStockCheck(id);
        skipDraftOnClose = true;
        emit('success');
        await modalApi.close();
        message.success('库存盘点单已提交，下一步可进行审核');
      } finally {
        modalApi.unlock();
      }
    },
  });
}

async function saveStockCheckDraft({
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
    const data = await buildCurrentStockCheckPayload();
    if (
      isCreatingDraft &&
      !hasValidStockCheckDraftItems(data.items ?? [], data.checkType)
    ) {
      draftSaved = closeWhenEmpty;
      message.warning('未选择明细，不生成草稿');
      return closeWhenEmpty;
    }
    await (isCreatingDraft
      ? createStockCheckDraft(data, { decimalHiddenFields: hiddenFields.value })
      : updateStockCheckDraft(data, {
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
    const saved = await saveStockCheckDraft({
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
    return saveStockCheckDraft();
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
      const submitItems = await buildMergedRemoteItemsForSubmit();
      if (
        isRemoteItemPaging.value &&
        formData.value?.id &&
        itemPageState.value.total <= 0
      ) {
        throw new Error('盘点明细不能为空');
      }
      itemFormInstance.validate(
        submitItems.filter((item) => item.operation !== 'delete'),
        { requireItems: !isRemoteItemPaging.value },
      );
      formData.value = {
        ...formData.value,
        items: submitItems,
      } as ErpStockCheckApiType.StockCheck;
    } catch (error: any) {
      message.error(error.message || '子表单验证失败');
      return;
    }

    modalApi.lock();
    try {
      const submitData = await buildCurrentStockCheckPayload();
      if (formType.value === 'create') {
        await createStockCheck(submitData, {
          decimalHiddenFields: hiddenFields.value,
        });
      } else if (isEditingDraft.value) {
        await updateAndSubmitStockCheckDraft(submitData, {
          decimalHiddenFields: hiddenFields.value,
        });
      } else {
        await updateStockCheck(submitData, {
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
      resetRemoteItemState();
      return;
    }
    const data = modalApi.getData<{ id?: number; type: string }>();
    const sequence = ++detailLoadSequence;
    skipDraftOnClose = false;
    draftSaved = false;
    draftSaving = false;
    detailLoadError.value = '';
    detailLoading.value = Boolean(data?.id);
    modalApi.setState({ fullscreen: true });
    modalApi.lock();
    try {
      await loadHiddenFields();
      if (sequence !== detailLoadSequence) return;
      await applyFormMode(data?.type || (data?.id ? 'edit' : 'create'));
      await formApi.resetForm();
      if (!data?.id) {
        resetRemoteItemState();
        formData.value = await hydrateStockDocumentFormSelectLabels({
          deptId: userStore.userInfo?.deptId,
          checkType: ErpStockCheckApi.CHECK_TYPE_COUNT,
          checkTime: Date.now(),
          items: [],
        } as ErpStockCheckApiType.StockCheck);
        if (sequence !== detailLoadSequence) return;
        checkType.value = ErpStockCheckApi.CHECK_TYPE_COUNT;
        await applyFormMode(formType.value, formData.value);
        await formApi.setValues(formData.value);
        return;
      }
      resetRemoteItemState();
      formData.value = await hydrateStockDocumentFormSelectLabels(
        await getStockCheck(data.id, {
          includeItems: !['detail', 'edit'].includes(data.type),
        }),
      );
      if (['detail', 'edit'].includes(data.type)) {
        formData.value.items = [];
      }
      if (sequence !== detailLoadSequence) return;
      formData.value.checkType =
        formData.value.checkType ?? ErpStockCheckApi.CHECK_TYPE_COUNT;
      checkType.value = formData.value.checkType;
      await applyFormMode(formType.value, formData.value);
      await formApi.setValues(
        buildStockDocumentDetailFormValues(formData.value, formType.value),
      );
      if (['detail', 'edit'].includes(data.type)) {
        await loadStockCheckItemPage({ pageNo: 1 });
      }
    } catch (error) {
      if (sequence === detailLoadSequence) {
        formData.value = undefined;
        detailLoadError.value = getErpDetailLoadError(
          error,
          '库存盘点单加载失败，请关闭后重试',
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
  getItemFormInstance()?.flushDecimalInputs?.();
  await enqueueRemoteItemOperation(() => undefined);
  recordRemoteItemChanges(
    getItemFormInstance()?.getItems?.() ?? formData.value?.items ?? [],
  );
  await loadStockCheckItemPage(payload);
}
</script>

<template>
  <Modal
    :title="getTitle"
    class="!w-full"
    bordered
    content-class="p-0"
    :class="{ 'erp-form-focus-highlight': formType !== 'detail' }"
    :show-confirm-button="canConfirmForm"
    :confirm-text="confirmText"
  >
    <StockDocumentFormLayout
      :editable="formType !== 'detail'"
      :error="detailLoadError"
      item-title="盘点产品清单"
      :loading="detailLoading"
    >
      <template #basic>
        <div ref="basicFormRef" @keydown.capture="handleBasicFormEnter">
          <Form />
        </div>
      </template>
      <template #items>
        <ItemForm
          ref="itemFormRef"
          :before-batch-warehouse-update="
            validateStockCheckBatchWarehouseUpdate
          "
          :items="formData?.items ?? EMPTY_ITEMS"
          :check-id="formData?.id"
          :check-type="checkType"
          :dept-id="formData?.deptId"
          :disabled="formType === 'detail'"
          :enable-batch-edit="canBatchUpdateItems"
          :hidden-fields="hiddenFields"
          :item-page-loading="itemPageLoading"
          :item-pagination="itemPageState"
          :remote-paging="isRemoteItemPaging"
          @append-items="queueAppendItems"
          @batch-update-success="handleBatchUpdateItemsSuccess"
          @refresh-items="handleItemPageChange(itemPageState)"
          @page-change="handleItemPageChange"
          @request-submit="handleLastInputEnterConfirm"
          @update:items="queueUpdateItems"
        />
        <StockDocumentSummary :entries="documentSummaryEntries" />
      </template>
      <template v-if="formType === 'detail'" #audit>
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
</template>
