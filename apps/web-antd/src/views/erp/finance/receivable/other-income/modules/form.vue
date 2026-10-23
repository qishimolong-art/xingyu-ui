<script lang="ts" setup>
import {
  financeSubtract,
  financeAdd,
} from '#/views/erp/finance/utils/finance-decimal';
import {
  financeAdd,
  financeSubtract,
  financeMax,
  financeValue,
  financeDivide,
} from '#/views/erp/finance/utils/finance-decimal';

import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import { useFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { ErpReceivableOtherIncomeApi } from '#/api/erp/finance/receivable/other-income';

import { computed, nextTick, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';

import { Modal as AntModal, Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createAndSubmitOtherIncome,
  createOtherIncomeDraft,
  getOtherIncome,
  getOtherIncomeItemPage,
  postOtherIncomeItemPage,
  submitOtherIncome,
  updateAndSubmitOtherIncome,
  updateOtherIncome,
  updateOtherIncomeDraft,
} from '#/api/erp/finance/receivable/other-income';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import ErpDocumentSummaryBar from '#/views/erp/components/ErpDocumentSummaryBar.vue';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import { buildFinanceCopyDraft } from '#/views/erp/finance/utils/copy-draft';
import {
  buildFinanceDocumentDetailFormValues,
  buildFinanceDocumentFormSchema,
  hydrateFinanceDocumentFormSelectLabels,
} from '#/views/erp/finance/utils/document-form-ui';
import { hasValidFinanceNamedAmountDraftItems } from '#/views/erp/finance/utils/draft-items';
import {
  handleFinanceEditableFormEnter,
  queueFocusFirstFinanceEditableFormControl,
} from '#/views/erp/finance/utils/form-enter-focus';
import {
  buildIncrementalRemoteItems,
  isSameRemoteItem,
} from '#/views/erp/finance/utils/remote-item-incremental';
import {
  createFinanceItemClientRowKeyManager,
  stripFinanceItemClientFields,
} from '#/views/erp/finance/utils/item-row-key';
import {
  clampFinanceRemoteItemPageNo,
  composeFinanceRemoteItemPage,
  financePageHasPersistedRows,
  getFinanceCreatedRowPageNo,
} from '#/views/erp/finance/utils/remote-item-paging';
import { getCurrentLocalDateTime } from '#/views/erp/utils/form-defaults';

import { useReportViewOnly } from '#/views/erp/report/components/report-view-only';

import { useFormSchema } from '../data';
import {
  normalizeOtherIncomeBizTime,
  normalizeOtherIncomeBizTimeForPicker,
} from '../ui';
import ItemForm from './item-form.vue';
import '#/views/erp/styles/form-focus.css';
const { candidateSchema } = useFinanceCandidateFocus();

const emit = defineEmits(['success', 'audit']);
const reportViewOnly = useReportViewOnly();
const formType = ref('');
const itemFormRef = ref<InstanceType<typeof ItemForm>>();
const itemLoading = ref(false);
const itemPagination = reactive({ pageNo: 1, pageSize: 10, total: 0 });
const itemSort = ref<{ field?: string; order?: 'asc' | 'desc' }>({});
const detailLoading = ref(false);
const detailLoadError = ref('');
const basicFormRef = ref<HTMLElement | null>(null);
let detailLoadSequence = 0;
let itemPageRequestId = 0;
let skipDraftOnClose = false;
let draftSaved = false;
let draftSaving = false;
const remoteItemCache = new Map<string, ErpReceivableOtherIncomeApi.Item[]>();
const remoteDeletedItemIds = new Set<number>();
const remoteOriginalItemMap = new Map<
  number,
  ErpReceivableOtherIncomeApi.Item
>();
const remoteItemEdits = new Map<number, ErpReceivableOtherIncomeApi.Item>();
const remoteItemCreates = new Map<string, ErpReceivableOtherIncomeApi.Item>();
const remotePageCreateKeys = new Map<string, Set<string>>();
const remoteNewItems = ref<ErpReceivableOtherIncomeApi.Item[]>([]);
const itemRowKeyManager = createFinanceItemClientRowKeyManager(
  'receivable-other-income-item',
);

function createDefaultFormData(): ErpReceivableOtherIncomeApi.OtherIncome {
  return {
    no: '',
    bizTime: normalizeOtherIncomeBizTimeForPicker(getCurrentLocalDateTime()),
    totalAmount: 0,
    docType: '正常单据',
    status: 10,
    items: [],
  };
}

const formData = ref<ErpReceivableOtherIncomeApi.OtherIncome>(
  createDefaultFormData(),
);
const { hasAccessByCodes } = useAccess();
const { hiddenFields, isHidden, loadHiddenFields } = useFieldPermission(
  'erp_finance_receivable_other_income',
);

function canFocusBasicForm() {
  return (
    formType.value !== 'detail' &&
    !detailLoading.value &&
    !detailLoadError.value
  );
}

function handleLastInputEnterConfirm(event?: KeyboardEvent) {
  if (!canFocusBasicForm() || !canConfirmForm.value) {
    return;
  }
  event?.preventDefault();
  void modalApi.onConfirm();
}

function handleBasicFormEnter(event: KeyboardEvent) {
  handleFinanceEditableFormEnter(
    event,
    basicFormRef,
    canFocusBasicForm,
    handleLastInputEnterConfirm,
  );
}

function queueFocusFirstBasicFormControl(sequence = detailLoadSequence) {
  queueFocusFirstFinanceEditableFormControl(
    basicFormRef,
    canFocusBasicForm,
    () => sequence === detailLoadSequence,
  );
}

const isEditingDraft = computed(
  () => formType.value === 'edit' && formData.value.status === 0,
);
const canConfirmForm = computed(() => {
  if (formType.value === 'detail') return false;
  if (formType.value === 'create' || isEditingDraft.value) {
    return hasAccessByCodes(['erp:receivable-other-income:update-status']);
  }
  return true;
});
const confirmText = computed(() =>
  formType.value === 'create' || isEditingDraft.value ? '确认提交' : '确定',
);
const canGenerateDraft = computed(
  () =>
    (formType.value === 'create' || isEditingDraft.value) &&
    !detailLoading.value &&
    !detailLoadError.value,
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
    hasAccessByCodes(['erp:receivable-other-income:update-status']),
);
const canEditFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !detailLoading.value &&
    !detailLoadError.value &&
    Boolean(formData.value.id) &&
    formData.value.status !== 20 &&
    hasAccessByCodes(['erp:receivable-other-income:update']),
);
const useRemoteItemPagination = computed(
  () => Boolean(formData.value.id) && formType.value !== 'create',
);
const itemCount = computed(() =>
  useRemoteItemPagination.value
    ? financeAdd(itemPagination.total, remoteItemCreates.size)
    : formData.value.items?.length || 0,
);
const displayItemPagination = computed(() => ({
  ...itemPagination,
  total: itemCount.value,
}));
const documentSummaryEntries = computed(() => [
  { label: '明细项数', value: itemCount.value },
  {
    emphasized: true,
    label: '总金额',
    value: `¥${erpPriceInputFormatter(formData.value.totalAmount || 0)}`,
  },
]);

const title = computed(() => {
  if (formType.value === 'create') {
    return $t('ui.actionTitle.create', ['其他收入']);
  }
  if (formType.value === 'edit') {
    return $t('ui.actionTitle.edit', ['其他收入']);
  }
  return '其他收入详情';
});

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    labelClass: '!justify-start !text-left',
    labelWidth: 82,
  },
  compact: true,
  wrapperClass:
    'other-income-basic-grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
  layout: 'horizontal',
  schema: buildFormSchema(formType.value),
  showDefaultActions: false,
});

function buildFormSchema(type: string) {
  return candidateSchema(
    buildFinanceDocumentFormSchema(useFormSchema(type, hiddenFields.value), {
      data: formData.value,
      formType: type,
    }),
  );
}

async function applyFormMode(type: string) {
  formType.value = type;
  modalApi.setState({ fullscreen: true });
  formApi.setDisabled(type === 'detail');
  formApi.updateSchema(buildFormSchema(type));
  await nextTick();
}

function handleUpdateItems(items: ErpReceivableOtherIncomeApi.Item[]) {
  if (useRemoteItemPagination.value) {
    cacheCurrentRemoteItems(items);
    formData.value.items = items;
    return;
  }
  formData.value.items = items;
}

function handleUpdateTotalAmount(totalAmount: number | string | null) {
  if (useRemoteItemPagination.value) {
    return;
  }
  formData.value.totalAmount = totalAmount;
  void formApi.setValues({ totalAmount });
}

function handleAddItem() {
  itemFormRef.value?.addRow();
}

function ensureItemRowKeys(items: ErpReceivableOtherIncomeApi.Item[]) {
  return itemRowKeyManager.ensureRowKeys(items);
}

function composeCurrentRemotePage(
  pageNo: number,
  pageSize: number,
  persistedRows: ErpReceivableOtherIncomeApi.Item[],
) {
  return ensureItemRowKeys(
    composeFinanceRemoteItemPage({
      createdRows: remoteNewItems.value,
      pageNo,
      pageSize,
      persistedRows,
      persistedTotal: itemPagination.total,
    }),
  );
}

async function handleRemoteAddItem() {
  if (!useRemoteItemPagination.value) return;
  cacheCurrentRemoteItems();
  const previousSort = { ...itemSort.value };
  const row: ErpReceivableOtherIncomeApi.Item = {
    amount: 0,
    itemName: '',
    qty: 1,
  };
  const rowKey = itemRowKeyManager.ensureRowKey(row, { forceNew: true });
  remoteNewItems.value.push(row);
  remoteItemCreates.set(rowKey, row);
  if (itemSort.value.field) {
    itemSort.value = {};
    remoteItemCache.clear();
  }
  const targetPage = getFinanceCreatedRowPageNo(
    itemPagination.total,
    remoteNewItems.value.length - 1,
    itemPagination.pageSize,
  );
  try {
    if (targetPage === itemPagination.pageNo && !previousSort.field) {
      const persistedRows = (formData.value.items || []).filter((item) =>
        Boolean(item.id),
      );
      formData.value.items = composeCurrentRemotePage(
        targetPage,
        itemPagination.pageSize,
        persistedRows,
      );
    } else if (
      financePageHasPersistedRows(
        targetPage,
        itemPagination.pageSize,
        itemPagination.total,
      )
    ) {
      await loadOtherIncomeItemsPage({
        pageNo: targetPage,
        cacheCurrent: false,
      });
    } else {
      itemPagination.pageNo = targetPage;
      formData.value.items = composeCurrentRemotePage(
        targetPage,
        itemPagination.pageSize,
        [],
      );
    }
    await nextTick();
    itemFormRef.value?.focusRowAmountInput?.(rowKey);
  } catch {
    remoteItemCreates.delete(rowKey);
    remoteNewItems.value = remoteNewItems.value.filter(
      (item) => item.clientRowKey !== rowKey,
    );
    itemSort.value = previousSort;
    message.error('新增明细失败，请重试');
  }
}

async function handleRemoteDeleteItem(row: ErpReceivableOtherIncomeApi.Item) {
  cacheCurrentRemoteItems();
  if (row.id && row.id > 0) {
    const previousPageNo = itemPagination.pageNo;
    const previousTotal = itemPagination.total;
    const previousRows = [...(formData.value.items || [])];
    const previousEdit = remoteItemEdits.get(row.id);
    remoteDeletedItemIds.add(row.id);
    remoteItemEdits.delete(row.id);
    const targetPage = clampFinanceRemoteItemPageNo(
      itemPagination.pageNo,
      itemPagination.pageSize,
      financeAdd(
        financeMax(0, financeSubtract(itemPagination.total, 1)),
        remoteItemCreates.size,
      ),
    );
    try {
      await loadOtherIncomeItemsPage({
        pageNo: targetPage,
        cacheCurrent: false,
      });
    } catch {
      remoteDeletedItemIds.delete(row.id);
      if (previousEdit) remoteItemEdits.set(row.id, previousEdit);
      itemPagination.pageNo = previousPageNo;
      itemPagination.total = previousTotal;
      formData.value.items = previousRows;
      message.error('删除明细失败，请重试');
    }
    return;
  }
  const rowKey = row.clientRowKey || '';
  remoteItemCreates.delete(rowKey);
  remoteNewItems.value = remoteNewItems.value.filter(
    (item) => item.clientRowKey !== rowKey,
  );
  const targetPage = clampFinanceRemoteItemPageNo(
    itemPagination.pageNo,
    itemPagination.pageSize,
    financeAdd(itemPagination.total, remoteItemCreates.size),
  );
  itemPagination.pageNo = targetPage;
  const persistedRows = (formData.value.items || []).filter((item) =>
    Boolean(item.id),
  );
  formData.value.items = composeCurrentRemotePage(
    targetPage,
    itemPagination.pageSize,
    persistedRows,
  );
}

async function buildCurrentPayload() {
  const values =
    (await formApi.getValues()) as ErpReceivableOtherIncomeApi.OtherIncome;
  const itemFormInstance = Array.isArray(itemFormRef.value)
    ? itemFormRef.value[0]
    : itemFormRef.value;
  const items = (
    useRemoteItemPagination.value
      ? getIncrementalRemoteItems()
      : itemFormInstance?.getItems?.() || formData.value.items || []
  ) as ErpReceivableOtherIncomeApi.Item[];
  const totalAmount = useRemoteItemPagination.value
    ? calculateRemoteTotalAmount()
    : items.reduce(
        (sum, item) => financeAdd(sum, financeValue(item.amount || 0)),
        '0',
      );
  return {
    ...values,
    id: formData.value.id,
    bizTime: normalizeBizTime(values.bizTime, formData.value.bizTime),
    items: items.map((item) => stripFinanceItemClientFields(item)),
    totalAmount,
  };
}

function resetRemoteItemState() {
  itemPagination.pageNo = 1;
  itemPagination.pageSize = 10;
  itemPagination.total = 0;
  itemSort.value = {};
  remoteItemCache.clear();
  remoteDeletedItemIds.clear();
  remoteOriginalItemMap.clear();
  remoteItemEdits.clear();
  remoteItemCreates.clear();
  remotePageCreateKeys.clear();
  remoteNewItems.value = [];
  itemPageRequestId += 1;
  itemRowKeyManager.reset();
}

function getRemoteItemCacheKey(
  pageNo = itemPagination.pageNo,
  pageSize = itemPagination.pageSize,
) {
  return `${pageNo}:${pageSize}:${itemSort.value.field || ''}:${itemSort.value.order || ''}`;
}

function cacheCurrentRemoteItems(
  items = itemFormRef.value?.getItems?.() || formData.value.items || [],
) {
  if (!useRemoteItemPagination.value) {
    return;
  }
  const key = getRemoteItemCacheKey();
  const previousItems = remoteItemCache.get(key) || [];
  const currentPersistedIds = new Set(
    items
      .map((item) => item.id)
      .filter((id): id is number => Boolean(id && id > 0)),
  );
  previousItems.forEach((item) => {
    if (item.id && item.id > 0 && !currentPersistedIds.has(item.id)) {
      remoteDeletedItemIds.add(item.id);
      remoteItemEdits.delete(item.id);
    }
  });
  const currentCreateKeys = new Set<string>();
  const pageItems = items.filter((item) => Boolean(item.id));
  const newItems = items.filter((item) => !item.id);
  newItems.forEach((item) => {
    const createKey = itemRowKeyManager.ensureRowKey(item);
    currentCreateKeys.add(createKey);
    remoteItemCreates.set(createKey, item);
    const index = remoteNewItems.value.findIndex(
      (newItem) => newItem.clientRowKey === createKey,
    );
    if (index >= 0) {
      remoteNewItems.value[index] = item;
    } else {
      remoteNewItems.value.push(item);
    }
  });
  const previousCreateKeys = remotePageCreateKeys.get(key) || new Set<string>();
  previousCreateKeys.forEach((createKey) => {
    if (!currentCreateKeys.has(createKey)) {
      remoteItemCreates.delete(createKey);
      remoteNewItems.value = remoteNewItems.value.filter(
        (item) => item.clientRowKey !== createKey,
      );
    }
  });
  remotePageCreateKeys.set(key, currentCreateKeys);
  items.forEach((item) => {
    if (!item.id || item.id <= 0 || remoteDeletedItemIds.has(item.id)) {
      return;
    }
    const original = remoteOriginalItemMap.get(item.id);
    if (isSameRemoteItem(original, item)) {
      remoteItemEdits.delete(item.id);
    } else {
      remoteItemEdits.set(item.id, item);
    }
  });
  remoteItemCache.set(
    key,
    pageItems.filter((item) => !item.id || item.id > 0),
  );
}

async function loadOtherIncomeItemsPage(
  options: { cacheCurrent?: boolean; pageNo?: number; pageSize?: number } = {},
) {
  if (!formData.value.id) {
    return;
  }
  if (options.cacheCurrent !== false) {
    cacheCurrentRemoteItems();
  }
  const pageNo = options.pageNo ?? itemPagination.pageNo;
  const pageSize = options.pageSize ?? itemPagination.pageSize;
  const requestId = ++itemPageRequestId;
  itemLoading.value = true;
  try {
    const request = {
      incomeId: formData.value.id,
      pageNo,
      pageSize,
      mask: formType.value === 'detail',
      orderField: itemSort.value.field,
      orderDirection: itemSort.value.order,
      excludedItemIds: [...remoteDeletedItemIds],
    };
    const page =
      formType.value === 'detail'
        ? await getOtherIncomeItemPage(request)
        : await postOtherIncomeItemPage(request);
    if (requestId !== itemPageRequestId) return;
    itemPagination.pageNo = pageNo;
    itemPagination.pageSize = pageSize;
    itemPagination.total = Number(page.total || 0);
    const key = getRemoteItemCacheKey(pageNo, pageSize);
    const persistedRows = ensureItemRowKeys(
      (page.list || []).map((item) =>
        item.id && remoteItemEdits.has(item.id)
          ? remoteItemEdits.get(item.id)!
          : item,
      ),
    );
    remoteItemCache.set(key, persistedRows);
    (page.list || []).forEach((item) => {
      if (item.id && item.id > 0 && !remoteOriginalItemMap.has(item.id)) {
        remoteOriginalItemMap.set(item.id, { ...item });
      }
    });
    formData.value.items = composeCurrentRemotePage(
      pageNo,
      pageSize,
      persistedRows.filter(
        (item) => !item.id || !remoteDeletedItemIds.has(item.id),
      ),
    );
  } finally {
    if (requestId === itemPageRequestId) itemLoading.value = false;
  }
}

async function fetchAllOtherIncomeItems(id = formData.value.id) {
  if (!id) {
    return formData.value.items || [];
  }
  const pageSize = 200;
  const firstPage = await getOtherIncomeItemPage({
    incomeId: id,
    pageNo: 1,
    pageSize,
    mask: false,
  });
  const items = [...(firstPage.list || [])];
  const total = Number(firstPage.total || 0);
  const pageCount = Math.ceil(financeDivide(total, pageSize));
  for (let pageNo = 2; pageNo <= pageCount; pageNo++) {
    const page = await getOtherIncomeItemPage({
      incomeId: id,
      pageNo,
      pageSize,
      mask: false,
    });
    items.push(...(page.list || []));
  }
  return items;
}

function getIncrementalRemoteItems() {
  cacheCurrentRemoteItems();
  return buildIncrementalRemoteItems(
    remoteItemEdits,
    remoteDeletedItemIds,
    remoteItemCreates,
  );
}

function calculateRemoteTotalAmount() {
  cacheCurrentRemoteItems();
  let totalAmount = financeValue(formData.value.totalAmount || 0);
  remoteDeletedItemIds.forEach((id) => {
    totalAmount = financeSubtract(
      totalAmount,
      financeValue(remoteOriginalItemMap.get(id)?.amount || 0),
    );
  });
  remoteItemEdits.forEach((item, id) => {
    totalAmount = financeAdd(
      totalAmount,
      financeSubtract(
        financeValue(item.amount || 0),
        financeValue(remoteOriginalItemMap.get(id)?.amount || 0),
      ),
    );
  });
  remoteItemCreates.forEach((item) => {
    totalAmount = financeAdd(totalAmount, financeValue(item.amount || 0));
  });
  return financeValue(totalAmount);
}

function handleItemPageChange(page: { pageNo: number; pageSize: number }) {
  void loadOtherIncomeItemsPage(page);
}

function handleItemSortChange(sort?: { field?: string; order?: string }) {
  itemSort.value = {
    field: sort?.field,
    order:
      sort?.order === 'desc'
        ? 'desc'
        : sort?.order === 'asc'
          ? 'asc'
          : undefined,
  };
  remoteItemCache.clear();
  void loadOtherIncomeItemsPage({ pageNo: 1 });
}

async function saveCurrentDraft(options: { explicit?: boolean } = {}) {
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
    const payload = await buildCurrentPayload();
    if (
      isCreatingDraft &&
      !hasValidFinanceNamedAmountDraftItems(payload.items ?? [])
    ) {
      if (!options.explicit) {
        draftSaved = true;
      }
      message.warning('未选择明细，不生成草稿');
      return !options.explicit;
    }
    if (isCreatingDraft) {
      await createOtherIncomeDraft(payload);
    } else {
      await updateOtherIncomeDraft(payload);
    }
    draftSaved = true;
    emit('success');
    message.success(
      options.explicit
        ? isCreatingDraft
          ? '草稿生成成功'
          : '草稿保存成功'
        : isCreatingDraft
          ? '未提交内容已自动保存为草稿'
          : '草稿修改已自动保存',
    );
    return true;
  } catch {
    message.error(
      options.explicit
        ? isCreatingDraft
          ? '草稿生成失败，请稍后重试'
          : '草稿保存失败，请稍后重试'
        : isCreatingDraft
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
  if (!canGenerateDraft.value) {
    return;
  }
  const saved = await saveCurrentDraft({ explicit: true });
  if (!saved) {
    return;
  }
  skipDraftOnClose = true;
  await modalApi.close();
}

async function handleEditFromDetail() {
  if (!canEditFromDetail.value || !formData.value.id) {
    return;
  }
  const id = formData.value.id;
  const sequence = ++detailLoadSequence;
  detailLoading.value = true;
  detailLoadError.value = '';
  modalApi.lock();
  try {
    await loadHiddenFields();
    if (sequence !== detailLoadSequence) return;
    const detail = await getOtherIncome(id, { includeItems: false });
    if (sequence !== detailLoadSequence) return;
    resetRemoteItemState();
    formData.value = await hydrateFinanceDocumentFormSelectLabels(
      normalizeOtherIncomeFormData({ ...detail, items: [] }),
    );
    await applyFormMode('edit');
    await formApi.resetForm();
    await formApi.setValues(
      buildFinanceDocumentDetailFormValues(formData.value, formType.value),
      false,
    );
    await loadOtherIncomeItemsPage({
      cacheCurrent: false,
      pageNo: 1,
      pageSize: 10,
    });
  } catch {
    if (sequence === detailLoadSequence) {
      detailLoadError.value = '其他收入详情加载失败，请关闭后重试';
      message.error(detailLoadError.value);
    }
  } finally {
    if (sequence === detailLoadSequence) {
      detailLoading.value = false;
      modalApi.unlock();
      queueFocusFirstBasicFormControl(sequence);
    }
  }
}

function handleSubmitDraftFromDetail() {
  if (!formData.value.id) return;
  const id = formData.value.id;
  AntModal.confirm({
    title: `确认提交其他收入草稿${formData.value.no ? ` ${formData.value.no}` : ''}吗？`,
    content: '提交后将进入待审核状态，不能再按草稿方式修改。',
    async onOk() {
      modalApi.lock();
      try {
        await submitOtherIncome(id);
        skipDraftOnClose = true;
        emit('success');
        await modalApi.close();
        message.success('其他收入草稿已提交，下一步可进行审核');
      } finally {
        modalApi.unlock();
      }
    },
  });
}

function normalizeBizTime(value?: unknown, fallback?: unknown) {
  return (
    normalizeOtherIncomeBizTime(value) ||
    normalizeOtherIncomeBizTime(fallback) ||
    getCurrentLocalDateTime()
  );
}

function normalizeOtherIncomeFormData(
  data: ErpReceivableOtherIncomeApi.OtherIncome,
) {
  return {
    ...data,
    bizTime: normalizeOtherIncomeBizTimeForPicker(data.bizTime) ?? data.bizTime,
  };
}

const [Modal, modalApi] = useVbenModal({
  async onBeforeClose() {
    return saveCurrentDraft();
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
      itemFormInstance?.validate();
    } catch (error: any) {
      message.error(error.message || '子表单校验失败');
      return;
    }

    modalApi.lock();
    try {
      const data = await buildCurrentPayload();
      if (formType.value === 'create') {
        await createAndSubmitOtherIncome(data);
      } else if (isEditingDraft.value) {
        await updateAndSubmitOtherIncome(data);
      } else {
        await updateOtherIncome(data);
      }
      message.success($t('ui.actionMessage.operationSuccess'));
      // The connected modal is destroyed when it closes, so notify the list
      // before unmounting to guarantee the post-save query is delivered.
      emit('success');
      skipDraftOnClose = true;
      await modalApi.close();
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      detailLoadSequence += 1;
      detailLoading.value = false;
      detailLoadError.value = '';
      formData.value = createDefaultFormData();
      resetRemoteItemState();
      return;
    }

    const data = modalApi.getData<{ id?: number; type: string }>();
    const sequence = ++detailLoadSequence;
    skipDraftOnClose = false;
    draftSaved = false;
    draftSaving = false;
    const nextFormType = data.type === 'copy' ? 'create' : data.type;
    detailLoading.value = true;
    detailLoadError.value = '';
    modalApi.lock();
    try {
      await loadHiddenFields();
      if (sequence !== detailLoadSequence) return;
      await applyFormMode(nextFormType);
      await formApi.resetForm();
      formData.value = createDefaultFormData();
      resetRemoteItemState();
      await formApi.setValues(formData.value, false);
      if (sequence !== detailLoadSequence || !data.id) return;

      const detail = await getOtherIncome(data.id, { includeItems: false });
      if (sequence !== detailLoadSequence) return;
      if (data.type === 'copy') {
        formData.value = await hydrateFinanceDocumentFormSelectLabels(
          normalizeOtherIncomeFormData(
            buildFinanceCopyDraft({
              ...detail,
              items: await fetchAllOtherIncomeItems(data.id),
            }),
          ),
        );
        itemPagination.total = formData.value.items?.length || 0;
      } else {
        resetRemoteItemState();
        formData.value = await hydrateFinanceDocumentFormSelectLabels(
          normalizeOtherIncomeFormData({ ...detail, items: [] }),
        );
      }
      await applyFormMode(nextFormType);
      await nextTick();
      if (sequence !== detailLoadSequence) return;
      await formApi.setValues(
        buildFinanceDocumentDetailFormValues(formData.value, formType.value),
        false,
      );
      if (data.type !== 'copy') {
        await loadOtherIncomeItemsPage({
          cacheCurrent: false,
          pageNo: 1,
          pageSize: 10,
        });
      }
    } catch {
      if (sequence !== detailLoadSequence) return;
      if (data.id) {
        detailLoadError.value = '其他收入详情加载失败，请关闭后重试';
      } else {
        detailLoadError.value = '其他收入初始化失败，请关闭后重试';
      }
      message.error(detailLoadError.value);
    } finally {
      if (sequence === detailLoadSequence) {
        detailLoading.value = false;
        modalApi.unlock();
        queueFocusFirstBasicFormControl(sequence);
      }
    }
  },
});
</script>

<template>
  <Modal
    :title="title"
    class="other-income-document-modal"
    :confirm-text="confirmText"
    :show-confirm-button="canConfirmForm && !detailLoading && !detailLoadError"
  >
    <template v-if="!reportViewOnly" #center-footer>
      <Button v-if="canGenerateDraft" @click="handleGenerateDraft">
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
    </template>
    <div
      class="other-income-document-form"
      :class="{
        'other-income-document-form--editable': formType !== 'detail',
        'erp-form-focus-highlight': formType !== 'detail',
      }"
    >
      <div v-if="detailLoading" class="other-income-document-load-state">
        其他收入详情加载中...
      </div>
      <div
        v-else-if="detailLoadError"
        class="other-income-document-load-state is-error"
      >
        {{ detailLoadError }}
      </div>

      <div
        v-show="!detailLoading && !detailLoadError"
        class="other-income-document-form__content"
      >
        <section ref="basicFormRef" class="other-income-document-section">
          <header class="other-income-document-section__header">
            <span class="other-income-document-section__title">基本信息</span>
          </header>
          <Form
            class="other-income-document-basic-form"
            @keydown.enter.capture="handleBasicFormEnter"
          />
        </section>

        <section class="other-income-document-section">
          <template v-if="!isHidden('items')">
            <header class="other-income-document-section__header">
              <span class="other-income-document-section__title">收入明细</span>
              <div class="other-income-document-section__actions">
                <span class="other-income-document-section__meta">
                  {{ itemCount }} 项
                </span>
                <Button
                  v-if="formType !== 'detail'"
                  size="small"
                  type="primary"
                  @click="handleAddItem"
                >
                  添加收入明细
                </Button>
              </div>
            </header>
            <div class="other-income-document-section__body">
              <ItemForm
                ref="itemFormRef"
                :items="formData.items ?? []"
                :disabled="formType === 'detail'"
                :hidden-fields="hiddenFields"
                :loading="itemLoading"
                :pagination="displayItemPagination"
                :pagination-mode="useRemoteItemPagination ? 'remote' : 'local'"
                @page-change="handleItemPageChange"
                @request-add="handleRemoteAddItem"
                @request-delete="handleRemoteDeleteItem"
                @sort-change="handleItemSortChange"
                @update:items="handleUpdateItems"
                @update:total-amount="handleUpdateTotalAmount"
                @request-submit="handleLastInputEnterConfirm"
              />
            </div>
          </template>
          <ErpDocumentSummaryBar :entries="documentSummaryEntries" />
        </section>

        <section
          v-if="formType === 'detail' && formData.id"
          class="other-income-document-section other-income-document-audit"
        >
          <header class="other-income-document-section__header">
            <span class="other-income-document-section__title">审计信息</span>
          </header>
          <ErpAuditInfo title="" :record="formData" />
        </section>
      </div>
    </div>

    <template #cancelText>
      {{ formType === 'detail' ? '关闭' : '取消' }}
    </template>
  </Modal>
</template>

<style scoped>
.other-income-document-form {
  --other-income-main-font-size: 12px;

  height: calc(100vh - 112px);
  overflow: auto;
  padding: 10px;
  color: hsl(var(--foreground));
  font-size: var(--other-income-main-font-size);
  background: hsl(var(--muted) / 24%);
}

.other-income-document-form__content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.other-income-document-load-state {
  display: grid;
  min-height: 260px;
  place-items: center;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
}

.other-income-document-load-state.is-error {
  color: hsl(var(--destructive));
}

.other-income-document-section {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--card));
}

.other-income-document-section__header {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 24%);
}

.other-income-document-section__title {
  position: relative;
  padding-left: 10px;
  font-size: 13px;
  font-weight: 600;
}

.other-income-document-section__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  border-radius: 3px;
  background: hsl(var(--primary));
  content: '';
}

.other-income-document-section__meta {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.other-income-document-section__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.other-income-document-section__actions :deep(.ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
}

.other-income-document-basic-form,
.other-income-document-section__body {
  padding: 10px 12px 2px;
}

:deep(.other-income-document-basic-form .ant-form-item) {
  margin-bottom: 8px;
}

:deep(.other-income-document-basic-form .other-income-basic-grid) {
  gap: 0 12px;
}

:deep(.other-income-document-basic-form .other-income-basic-grid > div) {
  min-width: 0;
}

:deep(
  .other-income-document-basic-form .other-income-basic-grid > div > label
) {
  margin-right: 0;
  padding-right: 10px;
  color: hsl(var(--muted-foreground));
  font-size: var(--other-income-main-font-size);
  font-weight: 400;
  line-height: 1.2;
  white-space: nowrap;
}

:deep(
  .other-income-document-basic-form .other-income-basic-grid > div > .flex-auto
) {
  min-width: 0;
}

:deep(.other-income-document-basic-form .ant-form-item-label > label),
:deep(.other-income-document-basic-form .ant-input),
:deep(.other-income-document-basic-form .ant-input-number),
:deep(.other-income-document-basic-form .ant-input-number-input),
:deep(.other-income-document-basic-form .ant-picker),
:deep(.other-income-document-basic-form .ant-picker-input > input),
:deep(.other-income-document-basic-form .ant-select),
:deep(.other-income-document-basic-form .ant-select-selector),
:deep(.other-income-document-basic-form .ant-select-selection-item),
:deep(.other-income-document-basic-form .ant-select-selection-placeholder),
:deep(.other-income-document-basic-form .ant-form-item-explain),
:deep(.other-income-document-basic-form .ant-form-item-extra),
:deep(.other-income-document-basic-form .ant-upload),
:deep(.other-income-document-basic-form .ant-upload-list-item),
:deep(.other-income-document-basic-form .ant-btn),
:deep(.other-income-document-basic-form textarea) {
  font-size: var(--other-income-main-font-size);
}

:deep(.other-income-document-basic-form .ant-input),
:deep(.other-income-document-basic-form .ant-input-number),
:deep(.other-income-document-basic-form .ant-picker),
:deep(.other-income-document-basic-form .ant-select-single),
:deep(
  .other-income-document-basic-form .ant-select-single .ant-select-selector
) {
  min-height: 32px;
}

:deep(.other-income-document-basic-form .ant-input),
:deep(.other-income-document-basic-form .ant-input-number),
:deep(.other-income-document-basic-form .ant-picker),
:deep(.other-income-document-basic-form .ant-select-single) {
  height: 32px;
}

:deep(
  .other-income-document-basic-form
    .finance-document-form-readonly-text.ant-input-affix-wrapper
) {
  box-sizing: border-box;
  height: 32px !important;
  min-height: 32px !important;
  padding: 4px 11px;
  font-size: var(--other-income-main-font-size);
}

:deep(
  .other-income-document-basic-form
    .finance-document-form-readonly-text.ant-input-affix-wrapper
    > input.ant-input
) {
  height: 22px !important;
  min-height: 0;
  padding: 0;
  line-height: 22px;
  background: transparent !important;
}

:deep(.other-income-document-basic-form textarea.ant-input) {
  min-height: 32px !important;
  height: auto;
}

:deep(
  .other-income-document-basic-form
    .ant-upload-picture-card-wrapper
    .ant-upload-list-picture-card
) {
  display: block;
}

:deep(
  .other-income-document-basic-form
    .relative.flex.w-full.items-center:has(.ant-upload-wrapper)
    > div
),
:deep(.other-income-document-basic-form .ant-upload-wrapper) {
  display: block;
  width: 100%;
}

:deep(
  .other-income-document-basic-form
    .ant-upload-picture-card-wrapper
    .ant-upload-list-item-container
),
:deep(
  .other-income-document-basic-form
    .ant-upload-picture-card-wrapper
    .ant-upload-select
) {
  width: 100% !important;
  height: 32px !important;
  margin: 0 !important;
  border-radius: 6px;
}

:deep(
  .other-income-document-basic-form
    .ant-upload-picture-card-wrapper
    .ant-upload-select
    .flex-col
) {
  flex-direction: row;
  gap: 6px;
  font-size: var(--other-income-main-font-size);
}

:deep(
  .other-income-document-basic-form
    .ant-upload-picture-card-wrapper
    .ant-upload-select
    .mt-2
) {
  margin-top: 0;
}

.other-income-document-form--editable :deep(.ant-input:not(:disabled)),
.other-income-document-form--editable
  :deep(.ant-picker:not(.ant-picker-disabled)),
.other-income-document-form--editable
  :deep(.ant-select:not(.ant-select-disabled) .ant-select-selector),
.other-income-document-form--editable
  :deep(.ant-input-number:not(.ant-input-number-disabled)),
.other-income-document-form--editable
  :deep(.ant-upload-picture-card-wrapper .ant-upload-select) {
  background: hsl(var(--background)) !important;
}

.other-income-document-form--editable :deep(.ant-input:disabled),
.other-income-document-form--editable :deep(.ant-picker-disabled),
.other-income-document-form--editable
  :deep(.ant-select-disabled .ant-select-selector),
.other-income-document-form--editable :deep(.ant-input-number-disabled),
.other-income-document-form--editable
  :deep(.ant-upload-wrapper .ant-upload-disabled) {
  border-color: hsl(var(--muted-foreground) / 28%) !important;
  color: hsl(var(--muted-foreground)) !important;
  background: hsl(var(--muted-foreground) / 14%) !important;
}

.other-income-document-audit :deep(.erp-audit-info) {
  padding: 10px 12px 12px;
}

.other-income-document-audit :deep(.text-sm) {
  font-size: 12px;
}

:global(.other-income-form-select-dropdown .ant-select-item),
:global(.other-income-form-select-dropdown .ant-select-tree),
:global(.other-income-form-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

@media (max-width: 768px) {
  .other-income-document-form {
    padding: 8px;
  }
}
</style>
