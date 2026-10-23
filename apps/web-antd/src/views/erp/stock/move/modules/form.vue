<script lang="ts" setup>
import { provide as provideStockDecimalMode } from 'vue';
const emit = defineEmits(['success']);
provideStockDecimalMode('stock-decimal-context', true);
import type { ErpStockMoveApi } from '#/api/erp/stock/move';
import type { ErpItemRowFocusField } from '#/views/erp/utils/item-row-focus';

import { computed, nextTick, provide, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createStockMove,
  getStockMove,
  getStockMoveEditItemPage,
  getStockMoveItemPage,
  matchStockMoveItems,
  updateStockMove,
} from '#/api/erp/stock/move';
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

const FIELD_PERMISSION_MODULE = 'erp_stock_move';
const EMPTY_ITEMS: ErpStockMoveApi.StockMoveItem[] = [];
const DEFAULT_ITEM_PAGE_SIZE = 10;
const formData = ref<ErpStockMoveApi.StockMove>();
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
const remoteItemEdits = new Map<number, ErpStockMoveApi.StockMoveItem>();
const remoteItemDeletes = new Set<number>();
const remoteItemCreates = new Map<string, ErpStockMoveApi.StockMoveItem>();
const remoteItemOriginals = new Map<number, ErpStockMoveApi.StockMoveItem>();
const itemRowKeyManager = createStockItemClientRowKeyManager('stock-move');
const enqueueRemoteItemOperation = createRemoteStockItemOperationQueue();
const documentSummary = computed(() =>
  buildRemoteDocumentSummary({
    base: {
      totalCount: formData.value?.totalCount ?? '0',
      totalPrice: formData.value?.totalPrice ?? '0',
      totalWeight: formData.value?.totalWeight ?? '0',
    },
    calculate: (item: ErpStockMoveApi.StockMoveItem) => ({
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
const canEditRemark = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    hasAccessByCodes(['erp:stock-move:update']),
);
const [RemarkModal, remarkModalApi] = useVbenModal({
  connectedComponent: StockDocumentRemarkForm,
  destroyOnClose: true,
});

function handleEditRemark() {
  if (!formData.value?.id) return;
  remarkModalApi
    .setData({
      documentName: '库存调拨单',
      documentType: 'stock-move',
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
  if (formType.value === 'create') {
    return $t('ui.actionTitle.create', ['库存调拨单']);
  } else if (formType.value === 'edit') {
    return $t('ui.actionTitle.edit', ['库存调拨单']);
  } else {
    return '库存调拨单详情';
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
  formApi.updateSchema(
    buildStockDocumentFormSchema(useFormSchema(type, hiddenFields.value), {
      data,
      formType: type,
    }),
  );
  await nextTick();
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
  rows: ErpStockMoveApi.StockMoveItem[] = [],
) {
  rows.forEach((item) => {
    if (item.id && !remoteItemOriginals.has(item.id)) {
      remoteItemOriginals.set(item.id, { ...item });
    }
  });
}

function getRemoteLocalItemKey(item: ErpStockMoveApi.StockMoveItem) {
  return itemRowKeyManager.ensureRowKey(item);
}

function applyRemoteItemCache(rows: ErpStockMoveApi.StockMoveItem[] = []) {
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

function recordRemoteItemChanges(rows: ErpStockMoveApi.StockMoveItem[]) {
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
      if (original && isSameRemoteItem(original, item)) {
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

async function loadStockMoveItemPage(
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
      ? getStockMoveEditItemPage(request)
      : getStockMoveItemPage(request));
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
  } finally {
    if (requestSequence === itemPageLoadSequence) {
      itemPageLoading.value = false;
    }
  }
}

async function buildMergedRemoteItemsForSubmit(): Promise<
  ErpStockMoveApi.StockMoveItem[]
> {
  if (!isRemoteItemPaging.value || !formData.value?.id) {
    return (
      getItemFormInstance()?.getItems?.() ??
      formData.value?.items ??
      []
    ).map((item: ErpStockMoveApi.StockMoveItem) =>
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

/** 更新调拨单项 */
async function handleUpdateItems(items: ErpStockMoveApi.StockMoveItem[]) {
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
  } as ErpStockMoveApi.StockMove;
  await formApi.setValues({
    items: nextItems,
  });
  if (
    isRemoteItemPaging.value &&
    remoteItemDeletes.size > previousDeleteCount
  ) {
    await loadStockMoveItemPage({
      pageNo: clampRemoteStockItemPageNo(
        itemPageState.value.pageNo,
        itemPageState.value.pageSize,
        itemPageState.value.total,
      ),
    });
  }
}

function buildStockMoveDuplicateKey(item: ErpStockMoveApi.StockMoveItem) {
  if (!item.productId || !item.fromWarehouseId || !item.toWarehouseId)
    return '';
  return `${item.productId}|${item.fromWarehouseId}|${item.toWarehouseId}`;
}

async function handleAppendItems(
  items: ErpStockMoveApi.StockMoveItem[],
  focusField: ErpItemRowFocusField = 'count',
  preferredFocusItem?: ErpStockMoveApi.StockMoveItem,
) {
  if (!isRemoteItemPaging.value || items.length === 0) return;
  const previousPage = { ...itemPageState.value };
  const existingLocalKeys = new Set(
    [...remoteItemCreates.values(), ...remoteItemEdits.values()]
      .map((value) => buildStockMoveDuplicateKey(value))
      .filter(Boolean),
  );
  let appendItems = items.filter((item) => {
    const key = buildStockMoveDuplicateKey(item);
    if (key && existingLocalKeys.has(key)) return false;
    if (key) existingLocalKeys.add(key);
    return true;
  });
  const matchCandidates = appendItems
    .map((item, itemIndex) => ({ item, itemIndex }))
    .filter(({ item }) => Boolean(buildStockMoveDuplicateKey(item)));
  let firstMatch: undefined | { itemId: number; pageNo: number };
  if (matchCandidates.length > 0 && formData.value?.id) {
    const matchResult = await matchStockMoveItems({
      documentId: formData.value.id,
      excludedItemIds: [
        ...new Set([...remoteItemDeletes, ...remoteItemEdits.keys()]),
      ],
      keys: matchCandidates.map(({ item }) => ({
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
      await loadStockMoveItemPage({
        orderDirection: undefined,
        orderField: undefined,
        pageNo: previousPage.pageNo,
      });
      await getItemFormInstance()?.focusItemRow?.(
        preferredFocusItem,
        focusField,
      );
    } else if (firstMatch) {
      await loadStockMoveItemPage({
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
      if (!currentFormData) throw new Error('调拨单已关闭');
      currentFormData.items = applyRemoteItemCache(
        (currentFormData.items ?? []).filter((item) => Boolean(item.id)),
      );
      await nextTick();
    } else {
      await loadStockMoveItemPage({
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
    await loadStockMoveItemPage(previousPage);
    message.error('新增明细定位失败，请重试');
    throw error;
  }
}

function queueUpdateItems(items: ErpStockMoveApi.StockMoveItem[]) {
  return enqueueRemoteItemOperation(() => handleUpdateItems(items));
}

function queueAppendItems(
  items: ErpStockMoveApi.StockMoveItem[],
  focusField?: ErpItemRowFocusField,
  preferredFocusItem?: ErpStockMoveApi.StockMoveItem,
) {
  return enqueueRemoteItemOperation(() =>
    handleAppendItems(items, focusField, preferredFocusItem),
  );
}

/** 创建或更新库存调拨单 */
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
        throw new Error('调拨出库单明细不能为空');
      }
      itemFormInstance.validate(
        submitItems.filter((item) => item.operation !== 'delete'),
        { requireItems: !isRemoteItemPaging.value },
      );
      formData.value = {
        ...formData.value,
        items: submitItems,
      } as ErpStockMoveApi.StockMove;
    } catch (error: any) {
      message.error(error.message || '子表单验证失败');
      return;
    }

    modalApi.lock();
    // 提交表单
    const submitData = {
      ...((await formApi.getValues()) as ErpStockMoveApi.StockMove),
      items: formData.value?.items ?? [],
    };
    submitData.deptId =
      submitData.deptId ?? formData.value?.deptId ?? userStore.userInfo?.deptId;
    try {
      await (formType.value === 'create'
        ? createStockMove(submitData, {
            decimalHiddenFields: hiddenFields.value,
          })
        : updateStockMove(submitData, {
            decimalHiddenFields: hiddenFields.value,
          }));
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
      if (!data?.id) {
        resetRemoteItemState();
        formData.value = await hydrateStockDocumentFormSelectLabels({
          deptId: userStore.userInfo?.deptId,
          items: [],
        } as ErpStockMoveApi.StockMove);
        if (sequence !== detailLoadSequence) return;
        await applyFormMode(formType.value, formData.value);
        await formApi.setValues(formData.value);
        return;
      }
      resetRemoteItemState();
      formData.value = await hydrateStockDocumentFormSelectLabels(
        await getStockMove(data.id, {
          includeItems: !['detail', 'edit'].includes(data.type),
        }),
      );
      if (['detail', 'edit'].includes(data.type)) {
        formData.value.items = [];
      }
      if (sequence !== detailLoadSequence) return;
      await applyFormMode(formType.value, formData.value);
      await formApi.setValues(
        buildStockDocumentDetailFormValues(formData.value, formType.value),
      );
      if (['detail', 'edit'].includes(data.type)) {
        await loadStockMoveItemPage({ pageNo: 1 });
      }
    } catch (error) {
      if (sequence === detailLoadSequence) {
        formData.value = undefined;
        detailLoadError.value = getErpDetailLoadError(
          error,
          '库存调拨单加载失败，请关闭后重试',
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
  recordRemoteItemChanges(
    getItemFormInstance()?.getItems?.() ?? formData.value?.items ?? [],
  );
  await loadStockMoveItemPage(payload);
}
</script>

<template>
  <Modal
    :title="getTitle"
    class="!w-full"
    bordered
    content-class="p-0"
    :show-confirm-button="formType !== 'detail'"
  >
    <StockDocumentFormLayout
      :editable="formType !== 'detail'"
      :error="detailLoadError"
      item-title="调拨产品清单"
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
          :items="formData?.items ?? EMPTY_ITEMS"
          :disabled="formType === 'detail'"
          :hidden-fields="hiddenFields"
          :item-page-loading="itemPageLoading"
          :item-pagination="itemPageState"
          :remote-paging="isRemoteItemPaging"
          @append-items="queueAppendItems"
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
    <template #prepend-footer>
      <Button v-if="canEditRemark" type="primary" @click="handleEditRemark">
        修改备注
      </Button>
    </template>
  </Modal>
  <RemarkModal @success="handleRemarkSuccess" />
</template>
