<script lang="ts" setup>import { financeAdd, financeValue, financeSubtract, financeMax, financeDivide } from '#/views/erp/finance/utils/finance-decimal';

import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import { useFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { ErpPayableExpenseApi } from '#/api/erp/finance/payable/expense';

import { computed, nextTick, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';


import { Modal as AntModal, Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getAccountSimpleList } from '#/api/erp/finance/account';
import {
  createAndSubmitPayableExpense,
  createPayableExpenseDraft,
  getPayableExpense,
  getPayableExpenseItemPage,
  postPayableExpenseItemPage,
  submitPayableExpense,
  updateAndSubmitPayableExpense,
  updatePayableExpense,
  updatePayableExpenseDraft,
} from '#/api/erp/finance/payable/expense';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import ErpDocumentSummaryBar from '#/views/erp/components/ErpDocumentSummaryBar.vue';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import FinanceDocumentRemarkForm from '#/views/erp/finance/components/FinanceDocumentRemarkForm.vue';
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
import { createFinanceItemClientRowKeyManager } from '#/views/erp/finance/utils/item-row-key';
import {
  clampFinanceRemoteItemPageNo,
  composeFinanceRemoteItemPage,
  financePageHasPersistedRows,
  getFinanceCreatedRowPageNo,
} from '#/views/erp/finance/utils/remote-item-paging';
import { getCurrentLocalDate } from '#/views/erp/utils/form-defaults';
import '#/views/erp/styles/form-focus.css';

import { useReportViewOnly } from '#/views/erp/report/components/report-view-only';

import { useFormSchema } from '../data';
import { normalizePayableExpenseDate } from '../ui';
import ItemForm from './item-form.vue';
const { candidateSchema } = useFinanceCandidateFocus();

defineOptions({ name: 'ErpPayableExpenseForm' });

const emit = defineEmits(['success', 'audit']);
const reportViewOnly = useReportViewOnly();
const formType = ref('create');
const strictReadonly = ref(false);
const detailLoading = ref(false);
const detailLoadError = ref('');
const basicFormRef = ref<HTMLElement | null>(null);
const tableData = ref<ErpPayableExpenseApi.PayableExpenseItem[]>([]);
const itemLoading = ref(false);
const itemPagination = reactive({ pageNo: 1, pageSize: 10, total: 0 });
const itemSort = ref<{ field?: string; order?: 'asc' | 'desc' }>({});
const itemFormRef = ref<InstanceType<typeof ItemForm>>();
let openRequestId = 0;
let itemPageRequestId = 0;
let skipDraftOnClose = false;
let draftSaving = false;
let draftSaved = false;
const remoteItemCache = new Map<
  string,
  ErpPayableExpenseApi.PayableExpenseItem[]
>();
const remoteDeletedItemIds = new Set<number>();
const remoteOriginalItemMap = new Map<
  number,
  ErpPayableExpenseApi.PayableExpenseItem
>();
const remoteItemEdits = new Map<
  number,
  ErpPayableExpenseApi.PayableExpenseItem
>();
const remoteItemCreates = new Map<
  string,
  ErpPayableExpenseApi.PayableExpenseItem
>();
const remotePageCreateKeys = new Map<string, Set<string>>();
const remoteNewItems = ref<ErpPayableExpenseApi.PayableExpenseItem[]>([]);
const itemRowKeyManager = createFinanceItemClientRowKeyManager(
  'payable-expense-item',
);

function createDefaultFormData(): ErpPayableExpenseApi.PayableExpense {
  return {
    no: '',
    bizTime: getCurrentLocalDate(),
    docType: '正常单据',
    status: 0,
    items: [],
    totalAmount: 0,
  };
}

const formData = ref<ErpPayableExpenseApi.PayableExpense>(
  createDefaultFormData(),
);
const { hasAccessByCodes } = useAccess();
const userStore = useUserStore();
const { hiddenFields, isHidden, loadHiddenFields } = useFieldPermission(
  'erp_finance_payable_expense',
);

const isDetail = computed(() => formType.value === 'detail');
const isEditingDraft = computed(
  () => formType.value === 'edit' && formData.value.status === 0,
);
const canConfirmForm = computed(() => {
  if (isDetail.value || detailLoading.value || detailLoadError.value) {
    return false;
  }
  if (formType.value === 'create') {
    return (
      hasAccessByCodes(['erp:payable-expense:create']) &&
      hasAccessByCodes(['erp:payable-expense:update-status'])
    );
  }
  if (isEditingDraft.value) {
    return (
      hasAccessByCodes(['erp:payable-expense:update']) &&
      hasAccessByCodes(['erp:payable-expense:update-status'])
    );
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
    !strictReadonly.value &&
    isDetail.value &&
    !detailLoading.value &&
    !detailLoadError.value &&
    Boolean(formData.value.id) &&
    formData.value.status === 0 &&
    hasAccessByCodes(['erp:payable-expense:update-status']),
);
const canEditFromDetail = computed(
  () =>
    !strictReadonly.value &&
    isDetail.value &&
    !detailLoading.value &&
    !detailLoadError.value &&
    Boolean(formData.value.id) &&
    [0, 10].includes(Number(formData.value.status)) &&
    hasAccessByCodes(['erp:payable-expense:update']),
);
const useRemoteItemPagination = computed(
  () => Boolean(formData.value.id) && formType.value !== 'create',
);
const itemCount = computed(() =>
  useRemoteItemPagination.value
    ? financeAdd(itemPagination.total, remoteItemCreates.size)
    : tableData.value.length,
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
const canCopy = computed(
  () =>
    !strictReadonly.value &&
    isDetail.value &&
    Boolean(formData.value.id) &&
    hasAccessByCodes(['erp:payable-expense:create']),
);
const canAudit = computed(
  () =>
    !strictReadonly.value &&
    isDetail.value &&
    Boolean(formData.value.id) &&
    formData.value.status === 10 &&
    hasAccessByCodes(['erp:payable-expense:update-status']),
);
const canEditRemark = computed(
  () =>
    !strictReadonly.value &&
    isDetail.value &&
    Boolean(formData.value.id) &&
    hasAccessByCodes(['erp:payable-expense:update']),
);
const [RemarkModal, remarkModalApi] = useVbenModal({
  connectedComponent: FinanceDocumentRemarkForm,
  destroyOnClose: true,
});

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

function queueFocusFirstBasicFormControl(requestId = openRequestId) {
  queueFocusFirstFinanceEditableFormControl(
    basicFormRef,
    canFocusBasicForm,
    () => requestId === openRequestId,
  );
}

function handleEditRemark() {
  remarkModalApi
    .setData({
      documentName: '支出单',
      documentType: 'payable-expense',
      id: formData.value.id,
      no: formData.value.no,
      remark: formData.value.remark,
    })
    .open();
}

async function handleRemarkSuccess(remark: string) {
  formData.value.remark = remark;
  await formApi.setValues({ remark }, false);
  emit('success');
}
const detailStatus = computed(() => {
  if (formData.value.status === 0) {
    return { className: 'is-draft', label: '草稿' };
  }
  if (formData.value.status === 10) {
    return { className: 'is-pending', label: '未审核' };
  }
  if (formData.value.status === 20) {
    return { className: 'is-success', label: '已审核' };
  }
  return { className: 'is-muted', label: '状态未知' };
});

const title = computed(() => {
  if (formType.value === 'create') {
    return $t('ui.actionTitle.create', ['费用支付']);
  }
  if (formType.value === 'edit') {
    return $t('ui.actionTitle.edit', ['费用支付']);
  }
  return '费用支付详情';
});

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    labelClass: '!justify-start !text-left',
    labelWidth: 82,
  },
  compact: true,
  wrapperClass:
    'payable-expense-basic-grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
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

function syncTotalAmount() {
  if (useRemoteItemPagination.value) {
    formData.value.items = [...tableData.value];
    return;
  }
  const totalAmount = tableData.value.reduce(
    (sum, item) => financeAdd(sum, financeValue(item.amount || 0)),
    0,
  );
  formData.value.items = [...tableData.value];
  formData.value.totalAmount = Number(totalAmount.toFixed(2));
  void formApi.setValues({ totalAmount: formData.value.totalAmount });
}

function getCurrentApplicantDefaults() {
  const userInfo = userStore.userInfo;
  return {
    deptId: userInfo?.deptId,
    handlerId: userInfo?.id,
  };
}

function getSubmitItemId(id?: number) {
  return id && id > 0 ? id : undefined;
}

function handleAddItem() {
  itemFormRef.value?.addRow();
}

function ensureItemRowKeys(items: ErpPayableExpenseApi.PayableExpenseItem[]) {
  return itemRowKeyManager.ensureRowKeys(items);
}

function composeCurrentRemotePage(
  pageNo: number,
  pageSize: number,
  persistedRows: ErpPayableExpenseApi.PayableExpenseItem[],
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
  const row: ErpPayableExpenseApi.PayableExpenseItem = {
    amount: undefined,
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
      const persistedRows = tableData.value.filter((item) => Boolean(item.id));
      tableData.value = composeCurrentRemotePage(
        targetPage,
        itemPagination.pageSize,
        persistedRows,
      );
      formData.value.items = [...tableData.value];
    } else if (
      financePageHasPersistedRows(
        targetPage,
        itemPagination.pageSize,
        itemPagination.total,
      )
    ) {
      await loadPayableExpenseItemsPage({
        pageNo: targetPage,
        cacheCurrent: false,
      });
    } else {
      itemPagination.pageNo = targetPage;
      tableData.value = composeCurrentRemotePage(
        targetPage,
        itemPagination.pageSize,
        [],
      );
      formData.value.items = [...tableData.value];
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

async function handleRemoteDeleteItem(
  row: ErpPayableExpenseApi.PayableExpenseItem,
) {
  cacheCurrentRemoteItems();
  if (row.id && row.id > 0) {
    const previousPageNo = itemPagination.pageNo;
    const previousTotal = itemPagination.total;
    const previousRows = [...tableData.value];
    const previousEdit = remoteItemEdits.get(row.id);
    remoteDeletedItemIds.add(row.id);
    remoteItemEdits.delete(row.id);
    const targetPage = clampFinanceRemoteItemPageNo(
      itemPagination.pageNo,
      itemPagination.pageSize,
      financeAdd(financeMax(0, financeSubtract(itemPagination.total, 1)), remoteItemCreates.size),
    );
    try {
      await loadPayableExpenseItemsPage({
        pageNo: targetPage,
        cacheCurrent: false,
      });
    } catch {
      remoteDeletedItemIds.delete(row.id);
      if (previousEdit) remoteItemEdits.set(row.id, previousEdit);
      itemPagination.pageNo = previousPageNo;
      itemPagination.total = previousTotal;
      tableData.value = previousRows;
      formData.value.items = [...previousRows];
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
  const persistedRows = tableData.value.filter((item) => Boolean(item.id));
  tableData.value = composeCurrentRemotePage(
    targetPage,
    itemPagination.pageSize,
    persistedRows,
  );
  formData.value.items = [...tableData.value];
}

function handleItemsUpdate(items: ErpPayableExpenseApi.PayableExpenseItem[]) {
  if (useRemoteItemPagination.value) {
    cacheCurrentRemoteItems(items);
    tableData.value = items;
    formData.value.items = [...items];
    return;
  }
  tableData.value = items;
  syncTotalAmount();
}

async function handleCopy() {
  if (!canCopy.value) {
    return;
  }
  const allItems = await fetchAllPayableExpenseItems(formData.value.id);
  const copyData = buildFinanceCopyDraft(
    { ...formData.value, items: allItems },
    {
      itemKey: 'items',
      overrides: {
        bizTime: getCurrentLocalDate(),
        docType: '正常单据',
      },
    },
  );
  detailLoadError.value = '';
  detailLoading.value = false;
  await applyFormMode('create');
  await formApi.resetForm();
  formData.value = copyData;
  tableData.value = copyData.items || [];
  formData.value.items = [...tableData.value];
  await formApi.setValues(copyData, false);
  syncTotalAmount();
  queueFocusFirstBasicFormControl();
}

async function buildCurrentPayload() {
  const values =
    (await formApi.getValues()) as ErpPayableExpenseApi.PayableExpense;
  const items = useRemoteItemPagination.value
    ? getIncrementalRemoteItems()
    : tableData.value;
  const totalAmount = useRemoteItemPagination.value
    ? calculateRemoteTotalAmount()
    : Number(
        items
          .reduce((sum, item) => financeAdd(sum, financeValue(item.amount || 0)), 0)
          .toFixed(2),
      );
  return {
    ...formData.value,
    ...values,
    id: formType.value === 'create' ? undefined : formData.value.id,
    totalAmount,
    items: items.map((item) => ({
      id: getSubmitItemId(item.id),
      itemName: item.itemName,
      amount: item.amount,
      invoiceNo: item.invoiceNo,
      party: item.party,
      deptId: item.deptId,
      bizDate: item.bizDate,
      handlerId: item.handlerId,
      qty: item.qty,
      expenseCategory: item.expenseCategory,
      remark: item.remark,
      fileUrl: item.fileUrl,
    })),
  } as ErpPayableExpenseApi.PayableExpense;
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
  items = itemFormRef.value?.getItems?.() || tableData.value,
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
    items.filter((item) => Boolean(item.id && item.id > 0)),
  );
}

async function loadPayableExpenseItemsPage(
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
      expenseId: formData.value.id,
      pageNo,
      pageSize,
      mask: formType.value === 'detail',
      orderField: itemSort.value.field,
      orderDirection: itemSort.value.order,
      excludedItemIds: [...remoteDeletedItemIds],
    };
    const page =
      formType.value === 'detail'
        ? await getPayableExpenseItemPage(request)
        : await postPayableExpenseItemPage(request);
    if (requestId !== itemPageRequestId) return;
    itemPagination.pageNo = pageNo;
    itemPagination.pageSize = pageSize;
    itemPagination.total = financeValue(page.total || 0);
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
    tableData.value = composeCurrentRemotePage(
      pageNo,
      pageSize,
      persistedRows.filter(
        (item) => !item.id || !remoteDeletedItemIds.has(item.id),
      ),
    );
    formData.value.items = [...tableData.value];
  } finally {
    if (requestId === itemPageRequestId) itemLoading.value = false;
  }
}

async function fetchAllPayableExpenseItems(id = formData.value.id) {
  if (!id) {
    return tableData.value;
  }
  const pageSize = 200;
  const firstPage = await getPayableExpenseItemPage({
    expenseId: id,
    pageNo: 1,
    pageSize,
    mask: false,
  });
  const items = [...(firstPage.list || [])];
  const total = financeValue(firstPage.total || 0);
  const pageCount = Math.ceil(financeDivide(total, pageSize));
  for (let pageNo = 2; pageNo <= pageCount; pageNo++) {
    const page = await getPayableExpenseItemPage({
      expenseId: id,
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
    totalAmount -= financeValue(remoteOriginalItemMap.get(id)?.amount || 0);
  });
  remoteItemEdits.forEach((item, id) => {
    totalAmount +=
      financeSubtract(financeValue(item.amount || 0), financeValue(remoteOriginalItemMap.get(id)?.amount || 0));
  });
  remoteItemCreates.forEach((item) => {
    totalAmount += financeValue(item.amount || 0);
  });
  return Number(totalAmount.toFixed(2));
}

function handleItemPageChange(page: { pageNo: number; pageSize: number }) {
  void loadPayableExpenseItemsPage(page);
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
  void loadPayableExpenseItemsPage({ pageNo: 1 });
}

async function saveCurrentDraft(options: { explicit?: boolean } = {}) {
  const isCreatingDraft = formType.value === 'create';
  const isUpdatingDraft = isEditingDraft.value && Boolean(formData.value.id);
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
    await (isCreatingDraft
      ? createPayableExpenseDraft(payload)
      : updatePayableExpenseDraft(payload));
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
  const requestId = ++openRequestId;
  detailLoading.value = true;
  detailLoadError.value = '';
  modalApi.lock();
  try {
    await loadHiddenFields();
    if (requestId !== openRequestId) {
      return;
    }
    const detail = await getPayableExpense(id, { includeItems: false });
    if (requestId !== openRequestId) {
      return;
    }
    resetRemoteItemState();
    formData.value = await hydrateFinanceDocumentFormSelectLabels({
      ...detail,
      items: [],
    });
    await applyFormMode('edit');
    await formApi.resetForm();
    tableData.value = [];
    formData.value.items = [...tableData.value];
    await formApi.setValues(
      buildFinanceDocumentDetailFormValues(formData.value, formType.value),
      false,
    );
    await loadPayableExpenseItemsPage({
      cacheCurrent: false,
      pageNo: 1,
      pageSize: 10,
    });
  } catch {
    if (requestId === openRequestId) {
      formData.value = createDefaultFormData();
      tableData.value = [];
      detailLoadError.value = '费用支付表单加载失败，请关闭后重试';
      message.error(detailLoadError.value);
    }
  } finally {
    if (requestId === openRequestId) {
      detailLoading.value = false;
      modalApi.unlock();
      queueFocusFirstBasicFormControl(requestId);
    }
  }
}

function handleSubmitDraftFromDetail() {
  if (!formData.value.id) {
    return;
  }
  const id = formData.value.id;
  AntModal.confirm({
    title: `确认提交费用支付草稿${formData.value.no ? ` ${formData.value.no}` : ''}吗？`,
    content: '提交后将进入待审核状态，不能再按草稿方式修改。',
    async onOk() {
      modalApi.lock();
      try {
        await submitPayableExpense(id);
        skipDraftOnClose = true;
        emit('success');
        await modalApi.close();
        message.success('费用支付草稿已提交，下一步可进行审核');
      } finally {
        modalApi.unlock();
      }
    },
  });
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
    if (tableData.value.length === 0) {
      message.error('请至少添加一条费用明细');
      return;
    }
    try {
      itemFormRef.value?.validate();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '明细校验失败');
      return;
    }
    modalApi.lock();
    try {
      const data = await buildCurrentPayload();
      if (formType.value === 'create') {
        await createAndSubmitPayableExpense(data);
      } else if (isEditingDraft.value) {
        await updateAndSubmitPayableExpense(data);
      } else {
        await updatePayableExpense(data);
      }
      skipDraftOnClose = true;
      message.success($t('ui.actionMessage.operationSuccess'));
      emit('success');
      await modalApi.close();
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      ++openRequestId;
      strictReadonly.value = false;
      return;
    }

    const requestId = ++openRequestId;
    skipDraftOnClose = false;
    draftSaving = false;
    draftSaved = false;
    const modalData = modalApi.getData<{
      id?: number;
      strictReadonly?: boolean;
      type: string;
    }>();
    strictReadonly.value = Boolean(modalData?.strictReadonly);
    const nextFormType =
      modalData?.type === 'copy' ? 'create' : modalData?.type || 'create';
    detailLoading.value = Boolean(modalData?.id);
    detailLoadError.value = '';
    modalApi.setState({ fullscreen: true });
    modalApi.lock();

    try {
      await loadHiddenFields();
      if (requestId !== openRequestId) {
        return;
      }
      await applyFormMode(nextFormType);
      await formApi.resetForm();
      const baseDefaultValues = {
        ...createDefaultFormData(),
        ...getCurrentApplicantDefaults(),
      };
      formData.value = baseDefaultValues;
      tableData.value = [];
      resetRemoteItemState();
      await formApi.setValues(baseDefaultValues, false);

      if (!modalData?.id) {
        let accountList: Awaited<ReturnType<typeof getAccountSimpleList>> = [];
        try {
          accountList = await getAccountSimpleList();
        } catch {
          // The account selector can still load its options on user interaction.
        }
        if (requestId !== openRequestId) {
          return;
        }
        const defaultAccount = accountList.find((item) => item.defaultStatus);
        const defaultValues = {
          ...baseDefaultValues,
          accountId: defaultAccount?.id,
        };
        formData.value = defaultValues;
        await formApi.setValues(defaultValues, false);
        detailLoading.value = false;
        return;
      }

      const detail = await getPayableExpense(modalData.id, {
        includeItems: false,
      });
      if (requestId !== openRequestId) {
        return;
      }
      if (modalData.type === 'copy') {
        formData.value = await hydrateFinanceDocumentFormSelectLabels(
          buildFinanceCopyDraft(
            {
              ...detail,
              items: await fetchAllPayableExpenseItems(modalData.id),
            },
            {
              itemKey: 'items',
              overrides: {
                bizTime: getCurrentLocalDate(),
                docType: '正常单据',
                ...getCurrentApplicantDefaults(),
              },
            },
          ),
        );
        tableData.value = formData.value.items || [];
        itemPagination.total = tableData.value.length;
      } else {
        resetRemoteItemState();
        formData.value = await hydrateFinanceDocumentFormSelectLabels({
          ...detail,
          bizTime: normalizePayableExpenseDate(detail.bizTime),
          items: [],
        });
        tableData.value = [];
      }
      formData.value.items = [...tableData.value];
      await applyFormMode(nextFormType);
      await formApi.setValues(
        buildFinanceDocumentDetailFormValues(formData.value, formType.value),
        false,
      );
      detailLoading.value = false;
      if (modalData.type === 'copy') {
        syncTotalAmount();
      } else {
        await loadPayableExpenseItemsPage({
          cacheCurrent: false,
          pageNo: 1,
          pageSize: 10,
        });
      }
    } catch {
      if (requestId === openRequestId) {
        formData.value = createDefaultFormData();
        tableData.value = [];
        detailLoadError.value = modalData?.id
          ? '费用支付详情加载失败，请关闭后重试'
          : '费用支付表单加载失败，请关闭后重试';
        message.error(detailLoadError.value);
      }
    } finally {
      if (requestId === openRequestId) {
        detailLoading.value = false;
        modalApi.unlock();
        queueFocusFirstBasicFormControl(requestId);
      }
    }
  },
});
</script>

<template>
  <Modal
    :title="title"
    class="payable-expense-document-modal"
    :confirm-text="confirmText"
    :show-confirm-button="canConfirmForm"
  >
    <template #title>
      <div class="payable-expense-document-title">
        <div class="payable-expense-document-title__text">
          <span>{{ title }}</span>
          <small v-if="isDetail && formData.no">{{ formData.no }}</small>
        </div>
        <span
          v-if="isDetail && !detailLoadError && formData.status !== undefined"
          class="payable-expense-document-status"
          :class="detailStatus.className"
        >
          {{ detailStatus.label }}
        </span>
      </div>
    </template>

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
      <Button v-if="canEditRemark" type="primary" @click="handleEditRemark">
        修改备注
      </Button>
      <Button v-if="canCopy" ghost type="primary" @click="handleCopy">
        复制
      </Button>
      <Button v-if="canAudit" type="primary" @click="emit('audit', formData)">
        审核
      </Button>
    </template>

    <div
      class="payable-expense-document-form"
      :class="{
        'payable-expense-document-form--editable': !isDetail,
        'erp-form-focus-highlight': formType !== 'detail',
      }"
    >
      <div v-if="detailLoading" class="payable-expense-document-load-state">
        费用支付详情加载中...
      </div>
      <div
        v-else-if="detailLoadError"
        class="payable-expense-document-load-state is-error"
        role="alert"
      >
        {{ detailLoadError }}
      </div>

      <div
        v-show="!detailLoading && !detailLoadError"
        class="payable-expense-document-form__content"
      >
        <section ref="basicFormRef" class="payable-expense-document-section">
          <header class="payable-expense-document-section__header">
            <span class="payable-expense-document-section__title">
              基本信息
            </span>
          </header>
          <Form
            class="payable-expense-document-basic-form"
            @keydown.enter.capture="handleBasicFormEnter"
          />
        </section>

        <section class="payable-expense-document-section">
          <template v-if="!isHidden('items')">
            <header class="payable-expense-document-section__header">
              <span class="payable-expense-document-section__title">
                费用明细
              </span>
              <div class="payable-expense-document-section__tools">
                <span>{{ itemCount }} 项</span>
              </div>
            </header>
            <div class="payable-expense-document-section__body">
              <div
                v-if="!isDetail"
                class="payable-expense-document-table-toolbar"
              >
                <Button
                  class="payable-expense-document-section__add-button"
                  type="primary"
                  size="small"
                  @click="handleAddItem"
                >
                  新增明细
                </Button>
              </div>
              <ItemForm
                ref="itemFormRef"
                :disabled="isDetail"
                :hidden-fields="hiddenFields"
                :items="tableData"
                :loading="itemLoading"
                :pagination="displayItemPagination"
                :pagination-mode="useRemoteItemPagination ? 'remote' : 'local'"
                class="payable-expense-item-grid"
                @page-change="handleItemPageChange"
                @request-add="handleRemoteAddItem"
                @request-delete="handleRemoteDeleteItem"
                @sort-change="handleItemSortChange"
                @update:items="handleItemsUpdate"
                @update:total-amount="syncTotalAmount"
                @request-submit="handleLastInputEnterConfirm"
              />
            </div>
          </template>
          <ErpDocumentSummaryBar :entries="documentSummaryEntries" />
        </section>

        <section
          v-if="isDetail && formData.id"
          class="payable-expense-document-section payable-expense-document-audit"
        >
          <header class="payable-expense-document-section__header">
            <span class="payable-expense-document-section__title">
              审计信息
            </span>
          </header>
          <ErpAuditInfo title="" :record="formData" />
        </section>
      </div>
    </div>

    <template #cancelText>
      {{ isDetail ? '关闭' : '取消' }}
    </template>
  </Modal>
  <RemarkModal @success="handleRemarkSuccess" />
</template>

<style scoped>
.payable-expense-document-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.payable-expense-document-title__text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.payable-expense-document-title__text > span {
  line-height: 1.25;
}

.payable-expense-document-title__text small {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.payable-expense-document-status {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  padding: 2px 9px;
  border: 1px solid currentcolor;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}

.payable-expense-document-status::before {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentcolor;
  content: '';
}

.payable-expense-document-status.is-pending {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 10%);
}

.payable-expense-document-status.is-draft {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.payable-expense-document-status.is-success {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
}

.payable-expense-document-status.is-muted {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
}

.payable-expense-document-form {
  --payable-expense-main-font-size: 12px;

  height: calc(100vh - 112px);
  overflow: auto;
  padding: 10px;
  color: hsl(var(--foreground));
  font-size: var(--payable-expense-main-font-size);
  background: hsl(var(--muted) / 24%);
}

.payable-expense-document-form__content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.payable-expense-document-load-state {
  display: grid;
  min-height: 260px;
  place-items: center;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
}

.payable-expense-document-load-state.is-error {
  color: hsl(var(--destructive));
}

.payable-expense-document-section {
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--card));
}

.payable-expense-document-section__header {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--muted) / 24%);
}

.payable-expense-document-section__title {
  position: relative;
  padding-left: 10px;
  font-size: 13px;
  font-weight: 600;
}

.payable-expense-document-section__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  border-radius: 3px;
  background: hsl(var(--primary));
  content: '';
}

.payable-expense-document-section__tools {
  display: flex;
  align-items: center;
  gap: 10px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.payable-expense-document-basic-form,
.payable-expense-document-section__body {
  padding: 10px 12px 2px;
}

.payable-expense-document-table-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

:deep(.payable-expense-document-basic-form .ant-form-item) {
  margin-bottom: 8px;
}

:deep(.payable-expense-document-basic-form .payable-expense-basic-grid) {
  gap: 0 12px;
}

:deep(.payable-expense-document-basic-form .payable-expense-basic-grid > div) {
  min-width: 0;
}

:deep(
  .payable-expense-document-basic-form .payable-expense-basic-grid > div > label
) {
  margin-right: 0;
  padding-right: 10px;
  color: hsl(var(--muted-foreground));
  font-size: var(--payable-expense-main-font-size);
  font-weight: 400;
  line-height: 1.2;
  white-space: nowrap;
}

:deep(
  .payable-expense-document-basic-form
    .payable-expense-basic-grid
    > div
    > .flex-auto
) {
  min-width: 0;
}

:deep(.payable-expense-document-basic-form .ant-form-item-label > label),
:deep(.payable-expense-document-basic-form .ant-input),
:deep(.payable-expense-document-basic-form .ant-input-number),
:deep(.payable-expense-document-basic-form .ant-input-number-input),
:deep(.payable-expense-document-basic-form .ant-picker),
:deep(.payable-expense-document-basic-form .ant-picker-input > input),
:deep(.payable-expense-document-basic-form .ant-select),
:deep(.payable-expense-document-basic-form .ant-select-selector),
:deep(.payable-expense-document-basic-form .ant-select-selection-item),
:deep(.payable-expense-document-basic-form .ant-select-selection-placeholder),
:deep(.payable-expense-document-basic-form .ant-form-item-explain),
:deep(.payable-expense-document-basic-form .ant-form-item-extra),
:deep(.payable-expense-document-basic-form .ant-upload),
:deep(.payable-expense-document-basic-form .ant-upload-list-item),
:deep(.payable-expense-document-basic-form .ant-btn),
:deep(.payable-expense-document-basic-form textarea) {
  font-size: var(--payable-expense-main-font-size);
}

:deep(.payable-expense-document-basic-form .ant-input),
:deep(.payable-expense-document-basic-form .ant-input-number),
:deep(.payable-expense-document-basic-form .ant-picker),
:deep(.payable-expense-document-basic-form .ant-select-single),
:deep(
  .payable-expense-document-basic-form .ant-select-single .ant-select-selector
) {
  min-height: 32px;
}

:deep(.payable-expense-document-basic-form .ant-input),
:deep(.payable-expense-document-basic-form .ant-input-number),
:deep(.payable-expense-document-basic-form .ant-picker),
:deep(.payable-expense-document-basic-form .ant-select-single) {
  height: 32px;
}

:deep(
  .payable-expense-document-basic-form
    .finance-document-form-readonly-text.ant-input-affix-wrapper
) {
  box-sizing: border-box;
  height: 32px !important;
  min-height: 32px !important;
  padding: 4px 11px;
  font-size: var(--payable-expense-main-font-size);
}

:deep(
  .payable-expense-document-basic-form
    .finance-document-form-readonly-text.ant-input-affix-wrapper
    > input.ant-input
) {
  height: 22px !important;
  min-height: 0;
  padding: 0;
  line-height: 22px;
  background: transparent !important;
}

:deep(.payable-expense-document-basic-form textarea.ant-input) {
  height: auto;
  min-height: 32px !important;
}

:deep(
  .payable-expense-document-basic-form
    .relative.flex.w-full.items-center:has(.ant-upload-wrapper)
    > div
),
:deep(.payable-expense-document-basic-form .ant-upload-wrapper) {
  display: block;
  width: 100%;
}

:deep(
  .payable-expense-document-basic-form
    .ant-upload-picture-card-wrapper
    .ant-upload-list-item-container
),
:deep(
  .payable-expense-document-basic-form
    .ant-upload-picture-card-wrapper
    .ant-upload-select
) {
  width: 100% !important;
  height: 32px !important;
  margin: 0 !important;
  border-radius: 6px;
}

:deep(
  .payable-expense-document-basic-form
    .ant-upload-picture-card-wrapper
    .ant-upload-select
    .flex-col
) {
  flex-direction: row;
  gap: 6px;
  font-size: var(--payable-expense-main-font-size);
}

:deep(
  .payable-expense-document-basic-form
    .ant-upload-picture-card-wrapper
    .ant-upload-select
    .mt-2
) {
  margin-top: 0;
}

.payable-expense-document-form--editable :deep(.ant-input:not(:disabled)),
.payable-expense-document-form--editable
  :deep(.ant-picker:not(.ant-picker-disabled)),
.payable-expense-document-form--editable
  :deep(.ant-select:not(.ant-select-disabled) .ant-select-selector),
.payable-expense-document-form--editable
  :deep(.ant-input-number:not(.ant-input-number-disabled)),
.payable-expense-document-form--editable
  :deep(.ant-upload-picture-card-wrapper .ant-upload-select) {
  background: hsl(var(--background)) !important;
}

.payable-expense-document-form--editable :deep(.ant-input:disabled),
.payable-expense-document-form--editable :deep(.ant-picker-disabled),
.payable-expense-document-form--editable
  :deep(.ant-select-disabled .ant-select-selector),
.payable-expense-document-form--editable :deep(.ant-input-number-disabled),
.payable-expense-document-form--editable
  :deep(.ant-upload-wrapper .ant-upload-disabled) {
  border-color: hsl(var(--muted-foreground) / 28%) !important;
  color: hsl(var(--muted-foreground)) !important;
  background: hsl(var(--muted-foreground) / 14%) !important;
}

:deep(.payable-expense-document-section__add-button.ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
}

:deep(.payable-expense-item-grid .vxe-table--render-default) {
  font-size: var(--payable-expense-main-font-size);
  font-variant-numeric: tabular-nums;
}

:deep(.payable-expense-item-grid .vxe-header--column) {
  height: 34px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 600;
}

:deep(.payable-expense-item-grid .vxe-body--column) {
  height: 36px;
  font-size: var(--payable-expense-main-font-size);
  line-height: 20px;
}

:deep(.payable-expense-item-grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(
  .payable-expense-item-grid .vxe-header--column.is--sortable .vxe-cell--title
) {
  color: #1677ff;
}

:deep(.payable-expense-item-grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(
  .payable-expense-item-grid .vxe-body--column .table-actions .ant-btn-link
) {
  height: auto;
  padding: 0;
  font-size: var(--payable-expense-main-font-size);
}

.payable-expense-document-audit :deep(.erp-audit-info) {
  padding: 10px 12px 12px;
}

.payable-expense-document-audit :deep(.text-sm) {
  font-size: 12px;
}

:global(.payable-expense-form-select-dropdown .ant-select-item),
:global(.payable-expense-form-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

@media (max-width: 768px) {
  .payable-expense-document-form {
    padding: 8px;
  }
}
</style>
