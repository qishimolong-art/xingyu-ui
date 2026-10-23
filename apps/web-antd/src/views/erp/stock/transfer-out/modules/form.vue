<script lang="ts" setup>
import { provide as provideStockDecimalMode } from 'vue';
const emit = defineEmits(['edit', 'print', 'success']);
provideStockDecimalMode('stock-decimal-context', true);
import type { ErpStockTransferOutApi } from '#/api/erp/stock/transfer-out';
import type { ErpItemRowFocusField } from '#/views/erp/utils/item-row-focus';

import { computed, nextTick, provide, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Modal as AntdModal, Button, message, Tooltip } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createAndSubmitStockTransferOut,
  createStockTransferOutDraft,
  getStockTransferOutEditItemPage,
  getStockTransferOutItemPage,
  getStockTransferOutWithOptions,
  matchStockTransferOutItems,
  STOCK_TRANSFER_OUT_STATUS,
  submitStockTransferOutDraft,
  unlockSaleCart,
  updateAndSubmitStockTransferOutDraft,
  updateStockTransferOut,
  updateStockTransferOutDraft,
} from '#/api/erp/stock/transfer-out';
import {
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import DetailLinkInput from '#/views/erp/components/DetailLinkInput.vue';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import { useReportViewOnly } from '#/views/erp/report/components/report-view-only';
import StockDocumentFormLayout from '#/views/erp/stock/components/StockDocumentFormLayout.vue';
import StockDocumentRemarkForm from '#/views/erp/stock/components/StockDocumentRemarkForm.vue';
import StockDocumentSummary from '#/views/erp/stock/components/StockDocumentSummary.vue';
import {
  buildStockDocumentDetailFormValues,
  buildStockDocumentFormSchema,
  hydrateStockDocumentFormSelectLabels,
} from '#/views/erp/stock/utils/document-form-ui';
import { hasValidStockTransferDraftItems } from '#/views/erp/stock/utils/draft-items';
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

const FIELD_PERMISSION_MODULE = 'erp_stock_transfer_out';
const EMPTY_ITEMS: ErpStockTransferOutApi.StockTransferOutItem[] = [];
const DEFAULT_ITEM_PAGE_SIZE = 10;
const formData = ref<ErpStockTransferOutApi.StockTransferOut>();
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
const unlocking = ref(false);
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
const remoteItemEdits = new Map<
  number,
  ErpStockTransferOutApi.StockTransferOutItem
>();
const remoteItemDeletes = new Set<number>();
const remoteItemCreates = new Map<
  string,
  ErpStockTransferOutApi.StockTransferOutItem
>();
const remoteItemOriginals = new Map<
  number,
  ErpStockTransferOutApi.StockTransferOutItem
>();
const itemRowKeyManager =
  createStockItemClientRowKeyManager('stock-transfer-out');
const enqueueRemoteItemOperation = createRemoteStockItemOperationQueue();
const documentSummary = computed(() =>
  buildRemoteDocumentSummary({
    base: {
      totalCount: formData.value?.totalCount ?? '0',
      totalPrice: formData.value?.totalPrice ?? '0',
      totalWeight: formData.value?.totalWeight ?? '0',
    },
    calculate: (item: ErpStockTransferOutApi.StockTransferOutItem) => ({
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
const reportViewOnly = useReportViewOnly();
const isEditingDraft = computed(
  () =>
    formType.value === 'edit' &&
    formData.value?.status === STOCK_TRANSFER_OUT_STATUS.DRAFT,
);
const canSubmitDraft = computed(
  () =>
    !reportViewOnly &&
    formType.value === 'detail' &&
    formData.value?.status === STOCK_TRANSFER_OUT_STATUS.DRAFT &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:stock-transfer-out:update']),
);
const canGenerateDraft = computed(
  () =>
    !reportViewOnly && (formType.value === 'create' || isEditingDraft.value),
);
const generateDraftButtonText = computed(() =>
  isEditingDraft.value ? '保存草稿' : '生成草稿',
);
const canConfirmForm = computed(() => {
  if (
    reportViewOnly ||
    formType.value === 'detail' ||
    detailLoading.value ||
    detailLoadError.value
  ) {
    return false;
  }
  return (
    !isEditingDraft.value || hasAccessByCodes(['erp:stock-transfer-out:update'])
  );
});
const confirmText = computed(() =>
  formType.value === 'create' || isEditingDraft.value
    ? '确认提交'
    : $t('common.confirm'),
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
    !reportViewOnly &&
    formType.value === 'detail' &&
    !!formData.value?.id &&
    hasAccessByCodes(['erp:stock-transfer-out:update']),
);
const canPrintFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:stock-transfer-out:print']),
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
    !reportViewOnly &&
    formType.value === 'detail' &&
    !!formData.value?.id &&
    formData.value?.status !== STOCK_TRANSFER_OUT_STATUS.APPROVE &&
    formData.value?.sourceType !== 30 &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:stock-transfer-out:update']),
);
const canBatchUpdateItems = computed(() => {
  if (
    reportViewOnly ||
    formType.value === 'detail' ||
    detailLoading.value ||
    detailLoadError.value
  ) {
    return false;
  }
  return hasAccessByCodes([
    formData.value?.id
      ? 'erp:stock-transfer-out:update'
      : 'erp:stock-transfer-out:create',
  ]);
});
const [RemarkModal, remarkModalApi] = useVbenModal({
  connectedComponent: StockDocumentRemarkForm,
  destroyOnClose: true,
});
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

function handleEditRemark() {
  if (!formData.value?.id) return;
  remarkModalApi
    .setData({
      documentName: '调拨出库单',
      documentType: 'stock-transfer-out',
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

const getTitle = computed(() => {
  if (formType.value === 'create') {
    return $t('ui.actionTitle.create', ['调拨出库单']);
  } else if (formType.value === 'edit') {
    return $t('ui.actionTitle.edit', ['调拨出库单']);
  } else {
    return '调拨出库单详情';
  }
});

const showUnlockCartButton = computed(() => {
  return (
    !reportViewOnly &&
    formType.value === 'detail' &&
    !!formData.value?.id &&
    formData.value?.transferDirection !== 20 &&
    formData.value?.sourceType === 30 &&
    !!formData.value?.sourceId &&
    formData.value?.status === 10 &&
    hasAccessByCodes(['erp:stock-transfer-out:unlock-cart'])
  );
});

const unlockCartDisabledReason = computed(() => {
  if (formData.value?.unlockCartAllowed !== false) {
    return '';
  }
  return (
    formData.value.unlockCartDisabledReason ||
    '当前用户不能解锁该调拨出库单的来源手推车'
  );
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
  rows: ErpStockTransferOutApi.StockTransferOutItem[] = [],
) {
  rows.forEach((item) => {
    if (item.id && !remoteItemOriginals.has(item.id)) {
      remoteItemOriginals.set(item.id, { ...item });
    }
  });
}

function getRemoteLocalItemKey(
  item: ErpStockTransferOutApi.StockTransferOutItem,
) {
  return itemRowKeyManager.ensureRowKey(item);
}

function applyRemoteItemCache(
  rows: ErpStockTransferOutApi.StockTransferOutItem[] = [],
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
  rows: ErpStockTransferOutApi.StockTransferOutItem[],
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

async function loadStockTransferOutItemPage(
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
      ? getStockTransferOutEditItemPage(request)
      : getStockTransferOutItemPage(request));
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
  ErpStockTransferOutApi.StockTransferOutItem[]
> {
  if (!isRemoteItemPaging.value || !formData.value?.id) {
    return (
      getItemFormInstance()?.getItems?.() ??
      formData.value?.items ??
      []
    ).map((item: ErpStockTransferOutApi.StockTransferOutItem) =>
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

async function buildCurrentTransferOutPayload() {
  return buildCurrentTransferOutPayloadWithItems(
    await buildMergedRemoteItemsForSubmit(),
  );
}

async function buildCurrentTransferOutPayloadWithItems(
  items: ErpStockTransferOutApi.StockTransferOutItem[],
) {
  const values =
    (await formApi.getValues()) as ErpStockTransferOutApi.StockTransferOut;
  const payload = {
    ...formData.value,
    ...values,
    id: formData.value?.id,
    deptId:
      values.deptId ?? formData.value?.deptId ?? userStore.userInfo?.deptId,
    items,
  } as ErpStockTransferOutApi.StockTransferOut;
  if (Array.isArray(payload.fileUrl)) {
    payload.fileUrl = payload.fileUrl[0] || '';
  }
  return payload;
}

function handleSubmitDraft() {
  const id = formData.value?.id;
  if (!id) return;
  const no = formData.value?.no;
  AntdModal.confirm({
    title: `确认提交调拨出库单${no ? ` ${no}` : ''}吗？`,
    content: '提交后将进入待审批状态，不能再按草稿方式修改。',
    okText: '确认提交',
    cancelText: '取消',
    async onOk() {
      modalApi.lock();
      try {
        await submitStockTransferOutDraft(id);
        skipDraftOnClose = true;
        emit('success');
        await modalApi.close();
        message.success('调拨出库单已提交，下一步可进行审批');
      } finally {
        modalApi.unlock();
      }
    },
  });
}

function handleUnlockCart() {
  const transferOutId = formData.value?.id;
  if (!transferOutId || unlockCartDisabledReason.value) {
    return;
  }
  const sourceNo = formData.value?.sourceNo || '-';
  AntdModal.confirm({
    title: `确认解锁来源手推车【${sourceNo}】吗？`,
    content:
      '此操作将删除当前未审核调拨出库单、释放库存占用，并将手推车退回待初审状态。解锁后可返回销售手推车修改信息。',
    okText: '确认解锁',
    okButtonProps: { danger: true },
    cancelText: '取消',
    async onOk() {
      unlocking.value = true;
      modalApi.lock();
      try {
        await unlockSaleCart(transferOutId);
        message.success(
          '手推车已解锁，当前调拨出库单已删除，可返回销售手推车修改。',
        );
        await modalApi.close();
        emit('success', { id: transferOutId, type: 'unlock-cart' });
      } finally {
        unlocking.value = false;
        modalApi.unlock();
      }
    },
  });
}

/** 创建或更新调拨出库单 */
async function saveStockTransferOutDraft({
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
    detailLoadError.value
  ) {
    return true;
  }
  if (draftSaving) {
    return false;
  }
  draftSaving = true;
  modalApi.lock();
  try {
    const data = await buildCurrentTransferOutPayload();
    if (isCreatingDraft && !hasValidStockTransferDraftItems(data.items ?? [])) {
      draftSaved = closeWhenEmpty;
      message.warning('未选择明细，不生成草稿');
      return closeWhenEmpty;
    }
    await (isCreatingDraft
      ? createStockTransferOutDraft(data, {
          decimalHiddenFields: hiddenFields.value,
        })
      : updateStockTransferOutDraft(data, {
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
    const saved = await saveStockTransferOutDraft({
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
    return saveStockTransferOutDraft();
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
    let submitData: ErpStockTransferOutApi.StockTransferOut;
    try {
      const submitItems = await buildMergedRemoteItemsForSubmit();
      if (
        isRemoteItemPaging.value &&
        formData.value?.id &&
        itemPageState.value.total <= 0
      ) {
        throw new Error('产品清单不能为空');
      }
      itemFormInstance?.validate(
        submitItems.filter((item) => item.operation !== 'delete'),
        { requireItems: !isRemoteItemPaging.value },
      );
      submitData = await buildCurrentTransferOutPayloadWithItems(submitItems);
    } catch (error: any) {
      message.error(error.message || '子表单验证失败');
      return;
    }

    modalApi.lock();
    try {
      if (formType.value === 'create') {
        await createAndSubmitStockTransferOut(submitData, {
          decimalHiddenFields: hiddenFields.value,
        });
      } else if (isEditingDraft.value) {
        await updateAndSubmitStockTransferOutDraft(submitData, {
          decimalHiddenFields: hiddenFields.value,
        });
      } else {
        await updateStockTransferOut(submitData, {
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
          items: [],
          moveTime: Date.now(),
        } as ErpStockTransferOutApi.StockTransferOut);
        if (sequence !== detailLoadSequence) return;
        await applyFormMode(formType.value, formData.value);
        await formApi.setValues(formData.value);
        return;
      }
      resetRemoteItemState();
      formData.value = await hydrateStockDocumentFormSelectLabels(
        await getStockTransferOutWithOptions(data.id, {
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
        await loadStockTransferOutItemPage({ pageNo: 1 });
      }
    } catch {
      if (sequence === detailLoadSequence) {
        formData.value = undefined;
        detailLoadError.value = '调拨出库单加载失败，请关闭后重试';
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
  await loadStockTransferOutItemPage(payload);
}

async function handleUpdateItems(
  items: ErpStockTransferOutApi.StockTransferOutItem[],
) {
  const previousDeleteCount = remoteItemDeletes.size;
  recordRemoteItemChanges(items);
  formData.value = {
    ...formData.value,
    items: isRemoteItemPaging.value
      ? applyRemoteItemCache(items.filter((item) => Boolean(item.id)))
      : items,
  } as ErpStockTransferOutApi.StockTransferOut;
  if (
    isRemoteItemPaging.value &&
    remoteItemDeletes.size > previousDeleteCount
  ) {
    await loadStockTransferOutItemPage({
      pageNo: clampRemoteStockItemPageNo(
        itemPageState.value.pageNo,
        itemPageState.value.pageSize,
        itemPageState.value.total,
      ),
    });
  }
}

function buildStockTransferOutDuplicateKey(
  item: ErpStockTransferOutApi.StockTransferOutItem,
) {
  if (!item.productId || !item.fromWarehouseId || !item.toWarehouseId)
    return '';
  return `${item.productId}|${item.fromWarehouseId}|${item.toWarehouseId}`;
}

async function handleAppendItems(
  items: ErpStockTransferOutApi.StockTransferOutItem[],
  focusField: ErpItemRowFocusField = 'count',
  preferredFocusItem?: ErpStockTransferOutApi.StockTransferOutItem,
) {
  if (!isRemoteItemPaging.value || items.length === 0) return;
  const previousPage = { ...itemPageState.value };
  const existingLocalKeys = new Set(
    [...remoteItemCreates.values(), ...remoteItemEdits.values()]
      .map((row) => buildStockTransferOutDuplicateKey(row))
      .filter(Boolean),
  );
  let appendItems = items.filter((item) => {
    const key = buildStockTransferOutDuplicateKey(item);
    if (key && existingLocalKeys.has(key)) return false;
    if (key) existingLocalKeys.add(key);
    return true;
  });
  const matchCandidates = appendItems
    .map((item, itemIndex) => ({ item, itemIndex }))
    .filter(({ item }) => Boolean(buildStockTransferOutDuplicateKey(item)));
  let firstMatch: undefined | { itemId: number; pageNo: number };
  if (matchCandidates.length > 0 && formData.value?.id) {
    const matchResult = await matchStockTransferOutItems({
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
      await loadStockTransferOutItemPage({
        orderDirection: undefined,
        orderField: undefined,
        pageNo: previousPage.pageNo,
      });
      await getItemFormInstance()?.focusItemRow?.(
        preferredFocusItem,
        focusField,
      );
    } else if (firstMatch) {
      await loadStockTransferOutItemPage({
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
      if (!currentFormData) throw new Error('调拨出库单已关闭');
      currentFormData.items = applyRemoteItemCache(
        (currentFormData.items ?? []).filter((item) => Boolean(item.id)),
      );
      await nextTick();
    } else {
      await loadStockTransferOutItemPage({
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
    await loadStockTransferOutItemPage(previousPage);
    message.error('新增明细定位失败，请重试');
    throw error;
  }
}

function queueUpdateItems(
  items: ErpStockTransferOutApi.StockTransferOutItem[],
) {
  return enqueueRemoteItemOperation(() => handleUpdateItems(items));
}

function queueAppendItems(
  items: ErpStockTransferOutApi.StockTransferOutItem[],
  focusField: ErpItemRowFocusField = 'count',
  preferredFocusItem?: ErpStockTransferOutApi.StockTransferOutItem,
) {
  return enqueueRemoteItemOperation(() =>
    handleAppendItems(items, focusField, preferredFocusItem),
  );
}
</script>

<template>
  <Modal
    :confirm-text="confirmText"
    :show-confirm-button="canConfirmForm"
    :title="getTitle"
    class="!w-full"
    :class="{ 'erp-form-focus-highlight': formType !== 'detail' }"
    bordered
    content-class="p-0"
  >
    <StockDocumentFormLayout
      :editable="formType !== 'detail'"
      :error="detailLoadError"
      item-title="调拨出库产品清单"
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
          :items="formData?.items ?? EMPTY_ITEMS"
          :disabled="formType === 'detail'"
          :document-id="formData?.id"
          :enable-batch-edit="canBatchUpdateItems"
          :hidden-fields="hiddenFields"
          :item-page-loading="itemPageLoading"
          :item-pagination="itemPageState"
          :remote-paging="isRemoteItemPaging"
          @append-items="queueAppendItems"
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
        <ErpAuditInfo class="erp-audit-info" title="" :record="formData" />
      </template>
    </StockDocumentFormLayout>
    <template v-if="!reportViewOnly" #center-footer>
      <Button
        v-if="canGenerateDraft"
        :loading="draftGenerateLoading"
        @click="handleGenerateDraft"
      >
        {{ generateDraftButtonText }}
      </Button>
    </template>
    <template v-if="!reportViewOnly" #prepend-footer>
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
      <Tooltip
        v-if="showUnlockCartButton"
        :title="unlockCartDisabledReason || undefined"
      >
        <Button
          danger
          :disabled="!!unlockCartDisabledReason"
          :loading="unlocking"
          @click="handleUnlockCart"
        >
          解锁手推车
        </Button>
      </Tooltip>
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
