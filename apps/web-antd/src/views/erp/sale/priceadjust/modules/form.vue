<script lang="ts" setup>
import { CANDIDATE_FOCUS_KEY } from '#/views/erp/utils/candidate-focus';

import type { VbenFormSchema } from '#/adapter/form';
import type { ErpSaleOutApi } from '#/api/erp/sale/out';
import type { ErpSalePriceAdjustApi } from '#/api/erp/sale/priceadjust';

import {
  computed,
  defineAsyncComponent,
  nextTick,
  ref,
  watch,
  provide,
} from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { $t } from '@vben/locales';
import { formatDateTime } from '@vben/utils';

import {
  Modal as AntdModal,
  Button,
  message,
  Tabs,
  Tooltip,
} from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getCustomerSalePriceLevel } from '#/api/erp/sale/customer';
import { getSaleOut } from '#/api/erp/sale/out';
import {
  createSalePriceAdjust,
  createSalePriceAdjustDraft,
  exportSalePriceAdjustImportTemplate,
  getSalePriceAdjust,
  getSalePriceAdjustCustomerDeptSimplePage,
  getSalePriceAdjustEditItemPage,
  getSalePriceAdjustItemPage,
  importSalePriceAdjust,
  matchSalePriceAdjustItems,
  submitSalePriceAdjust,
  updateSalePriceAdjust,
  updateSalePriceAdjustDraft,
  updateSalePriceAdjustStatus,
} from '#/api/erp/sale/priceadjust';
import { getStockCount } from '#/api/erp/stock/stock';
import {
  applyFieldPermission,
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import { useUserStore } from '@vben/stores';
import { applyFieldConfig } from '#/views/erp/composables/useFieldConfig';
import DetailLinkInput from '#/views/erp/components/DetailLinkInput.vue';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import { useReportViewOnly } from '#/views/erp/report/components/report-view-only';
import { replaceDetailFieldWithLinkSlot } from '#/views/erp/components/detail-link-schema';
import CustomerReceivableSummary from '#/views/erp/sale/components/CustomerReceivableSummary.vue';
import SaleDetailImportModal from '#/views/erp/sale/components/sale-detail-import-modal.vue';
import SaleDocumentRemarkForm from '#/views/erp/sale/components/SaleDocumentRemarkForm.vue';
import { buildSaleCopyDraft } from '#/views/erp/sale/utils/copy-draft';
import {
  formatSaleAmount,
  saleDecimalMultiply,
} from '#/views/erp/sale/utils/decimal';
import {
  createSaleItemClientRowKeyManager,
  stripSaleItemClientFields,
} from '#/views/erp/sale/utils/item-row-key';
import {
  buildSaleCurrentUserFormDefaults,
  buildSaleDocumentDetailFormValues,
  hydrateCurrentSaleFormSelectNames,
  hydrateSaleCustomerFromFallback,
  withCurrentSaleFormSelectOptions,
  withSaleCustomerFromSource,
} from '#/views/erp/sale/utils/document-form';
import { hasValidSaleDraftItems } from '#/views/erp/sale/utils/draft-items';
import { getCurrentTimestamp } from '#/views/erp/sale/utils/form-defaults';
import { getItemPrintSortTitle } from '#/views/erp/sale/utils/item-print-sort';
import {
  clampRemoteItemPageNo,
  composeRemoteItemPage,
  getRemoteItemTotal,
  pageHasPersistedRows,
} from '#/views/erp/sale/utils/remote-item-paging';
import { getErpDetailLoadError } from '#/views/erp/utils/detail-load-error';
import { buildRemoteDocumentSummary } from '#/views/erp/utils/remote-document-summary';
import {
  focusFirstEditableFormControl,
  focusNextEditableFormControlOnEnter,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';
import { ensureModalReady } from '#/views/erp/utils/lazy-modal';

import { priceAdjustTypeOptions, useFormSchema } from '../data';
import ItemForm from './item-form.vue';
import SaleOutItemSelectModal from './sale-out-item-select-modal.vue';
import SettlementWriteOffTab from './settlement-writeoff-tab.vue';

import '#/views/erp/styles/form-focus.css';

provide(CANDIDATE_FOCUS_KEY, ref(true));

const emit = defineEmits(['success', 'print']);
const reportViewOnly = useReportViewOnly();
const userStore = useUserStore();
const FIELD_CONFIG_MODULE = 'sale_price_adjust';
const FIELD_PERMISSION_MODULE = 'erp_sale_price_adjust';
const DEFAULT_ITEM_PAGE_SIZE = 10;
const DETAIL_TAB_KEY = 'detail';
const SETTLEMENT_TAB_KEY = 'settlement';
const currentCustomerPriceLevel = ref<number | undefined>();
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
  { customerPriceLevel: currentCustomerPriceLevel },
);
const { hasAccessByCodes } = useAccess();
const CustomerDetail = defineAsyncComponent(
  () => import('#/views/erp/sale/customer/modules/detail.vue'),
);
const loadSaleOutDetail = () => import('#/views/erp/sale/out/modules/form.vue');
const SaleOutDetail = defineAsyncComponent(loadSaleOutDetail);
const [CustomerDetailModal, customerDetailModalApi] = useVbenModal({
  connectedComponent: CustomerDetail,
  destroyOnClose: true,
});
const [SaleOutDetailModal, saleOutDetailModalApi] = useVbenModal({
  connectedComponent: SaleOutDetail,
  destroyOnClose: true,
});
const [RemarkModal, remarkModalApi] = useVbenModal({
  connectedComponent: SaleDocumentRemarkForm,
  destroyOnClose: true,
});
const shouldRenderSaleOutDetail = ref(false);
const itemPageLoading = ref(false);
let itemPageLoadSequence = 0;
let itemMutationSequence = 0;
let remotePersistedItemTotal = 0;
let remotePersistedItemTotalKnown = false;
const detailActiveTab = ref(DETAIL_TAB_KEY);
const settlementTabReloadKey = ref(0);
const itemPageState = ref({
  orderDirection: undefined as 'asc' | 'desc' | undefined,
  orderField: undefined as string | undefined,
  pageNo: 1,
  pageSize: DEFAULT_ITEM_PAGE_SIZE,
  total: 0,
});

function handleOpenCustomerDetail() {
  if (!formData.value.customerId) return;
  customerDetailModalApi.setData({ id: formData.value.customerId }).open();
}

async function handleOpenSourceOutDetail(saleOutId?: number) {
  if (!saleOutId) return;
  await ensureModalReady(
    shouldRenderSaleOutDetail,
    saleOutDetailModalApi,
    loadSaleOutDetail,
  );
  saleOutDetailModalApi.setData({ type: 'detail', id: saleOutId }).open();
}

const sourceSaleOutLinks = computed(() => {
  const uniqueLinks = new Map<number, string>();
  for (const item of formData.value.items ?? []) {
    if (item.saleOutId && item.saleOutNo) {
      uniqueLinks.set(item.saleOutId, item.saleOutNo);
    }
  }
  return [...uniqueLinks].map(([id, no]) => ({ id, no }));
});

const formData = ref<ErpSalePriceAdjustApi.PriceAdjust>({
  id: undefined,
  no: undefined,
  adjustDate: undefined,
  customerId: undefined,
  deptId: undefined,
  adjustUserId: undefined,
  adjustType: undefined,
  remark: undefined,
  settleMethod: undefined,
  deliveryMethod: undefined,
  logisticsCompany: undefined,
  totalAdjustPrice: 0,
  items: [],
});
const formType = ref('');
const isSalePriceAdjustFormOpen = ref(false);
const isRemoteItemPaging = computed(
  () =>
    Boolean(formData.value?.id) && ['detail', 'edit'].includes(formType.value),
);
const remoteItemEdits = new Map<
  number,
  ErpSalePriceAdjustApi.PriceAdjustItem
>();
const remoteItemDeletes = new Set<number>();
const itemRowKeyManager = createSaleItemClientRowKeyManager(
  'sale-price-adjust-item',
);
const remoteItemCreates = new Map<
  string,
  ErpSalePriceAdjustApi.PriceAdjustItem
>();
const remoteItemOriginals = new Map<
  number,
  ErpSalePriceAdjustApi.PriceAdjustItem
>();
const REMOTE_ITEM_COMPARE_IGNORED_FIELDS = new Set([
  'clientRowKey',
  'operation',
  'seq',
  'saleOutNo',
  'partCode',
  'partName',
  'vehicleModel',
  'originPlace',
  'brand',
  'unit',
  'stockCount',
  'warehouseName',
  'warehouseDeptId',
  'warehouseDeptName',
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
  'adjustPrice',
]);
const detailLoading = ref(false);
const detailLoadError = ref('');
const detailEditLoading = ref(false);
let detailLoadSequence = 0;
let formLoadSequence = 0;
let skipDraftOnClose = false;
let draftSaved = false;
let draftSaving = false;
let isHydratingFormValues = false;
let formFocusSequence = 0;
const canOpenCustomerDetail = computed(() =>
  Boolean(formData.value.customerId && formData.value.customerName),
);
const itemFormRef = ref<InstanceType<typeof ItemForm>>();
const basicFormRef = ref<HTMLElement | null>(null);
const selectModalOpen = ref(false);
const currentCustomerId = ref<number | undefined>();
const currentSaleOutId = ref<number | undefined>();

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
  }
}

watch(
  () => currentCustomerId.value,
  (customerId) => {
    void loadCustomerPriceLevel(customerId);
  },
);
const saleDeptOptions = ref<any[]>([]);
let saleDeptLoadSeq = 0;
let skipCustomerWatch = false;
const [ImportFormModal, importFormModalApi] = useVbenModal({
  connectedComponent: SaleDetailImportModal,
  destroyOnClose: true,
});

const getTitle = computed(() => {
  if (formType.value === 'create') {
    return $t('ui.actionTitle.create', ['销售调价单']);
  }
  if (formType.value === 'edit') {
    return $t('ui.actionTitle.edit', ['销售调价单']);
  }
  return '销售调价单详情';
});

const showDetailAudit = computed(() => formType.value === 'detail');
const canApprove = computed(
  () =>
    formType.value === 'detail' &&
    formData.value.status === 10 &&
    hasAccessByCodes(['erp:sale-price-adjust:update-status']),
);
const isEditingDraft = computed(
  () => formType.value === 'edit' && formData.value.status === 0,
);
const canGenerateDraft = computed(
  () =>
    !detailEditLoading.value &&
    (formType.value === 'create' || isEditingDraft.value),
);
const generateDraftButtonText = computed(() =>
  isEditingDraft.value ? '保存草稿' : '生成草稿',
);
const canConfirmForm = computed(
  () =>
    formType.value !== 'detail' &&
    !detailEditLoading.value &&
    (!isEditingDraft.value ||
      hasAccessByCodes(['erp:sale-price-adjust:update-status'])),
);
const confirmText = computed(() =>
  isEditingDraft.value ? '确认提交' : '确定',
);
const canSubmitDraftFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !detailLoading.value &&
    !detailLoadError.value &&
    Boolean(formData.value.id) &&
    formData.value.status === 0 &&
    hasAccessByCodes(['erp:sale-price-adjust:update-status']),
);
const canEditFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !detailLoading.value &&
    !detailLoadError.value &&
    Boolean(formData.value.id) &&
    [0, 10, 30].includes(Number(formData.value.status)) &&
    hasAccessByCodes(['erp:sale-price-adjust:update']),
);
const canEditRemark = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value.id &&
    hasAccessByCodes(['erp:sale-price-adjust:update']),
);
const canPrintFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:sale-price-adjust:print']),
);
const printSortTitle = computed(() =>
  getItemPrintSortTitle(
    itemPageState.value.orderField,
    itemPageState.value.orderDirection,
  ),
);
function handleDetailPrint() {
  emit('print', {
    row: formData.value,
    itemOrderField: itemPageState.value.orderField,
    itemOrderDirection: itemPageState.value.orderDirection,
  });
}
const canViewFinanceReceiptItems = computed(() =>
  hasAccessByCodes(['erp:finance-receipt:query']),
);

function canFocusBasicForm() {
  return (
    canConfirmForm.value &&
    !detailLoading.value &&
    !detailLoadError.value &&
    !selectModalOpen.value
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

function handleEditRemark() {
  if (!formData.value.id) return;
  remarkModalApi
    .setData({
      documentName: '销售调价单',
      documentType: 'sale-price-adjust',
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

const EMBEDDED_SECTION_FIELDS = new Set(['customerReceivableInfo', 'items']);

/** 基本信息区只保留四列表单字段，应收信息和产品明细由独立区块渲染。 */
function buildBasicFormSchema(schema: VbenFormSchema[]) {
  return schema.filter((item) => !EMBEDDED_SECTION_FIELDS.has(item.fieldName));
}

const PRICE_ADJUST_STATUS_META: Record<
  number,
  { className: string; label: string }
> = {
  0: { className: 'is-draft', label: '草稿' },
  10: { className: 'is-pending', label: '未审核' },
  20: { className: 'is-success', label: '已审核' },
  30: { className: 'is-muted', label: '已驳回' },
};

const detailStatus = computed(
  () =>
    PRICE_ADJUST_STATUS_META[Number(formData.value.status)] || {
      className: 'is-muted',
      label: '未知状态',
    },
);

const detailItemCount = computed(() =>
  isRemoteItemPaging.value
    ? itemPageState.value.total
    : (formData.value.items?.length ?? 0),
);

const documentAmountSummary = computed(() =>
  buildRemoteDocumentSummary({
    base: {
      adjustedAmount: Number(formData.value.totalAdjustedPrice ?? 0),
      originalAmount: Number(formData.value.totalOriginalPrice ?? 0),
    },
    calculate: (item: ErpSalePriceAdjustApi.PriceAdjustItem) => ({
      adjustedAmount: Number(
        saleDecimalMultiply(item.newPrice || 0, item.outCount || 0) || 0,
      ),
      originalAmount: Number(
        saleDecimalMultiply(item.oldPrice || 0, item.outCount || 0) || 0,
      ),
    }),
    creates: remoteItemCreates,
    deletes: remoteItemDeletes,
    edits: remoteItemEdits,
    localItems: formData.value.items ?? [],
    originals: remoteItemOriginals,
    remotePaging: isRemoteItemPaging.value,
  }),
);

const detailOriginalAmount = computed(
  () => documentAmountSummary.value.originalAmount ?? 0,
);

const detailAdjustedAmount = computed(
  () => documentAmountSummary.value.adjustedAmount ?? 0,
);

const detailAdjustAmount = computed(
  () => detailAdjustedAmount.value - detailOriginalAmount.value,
);

function isDetailFieldVisible(fieldName: string) {
  return !isFieldHidden(hiddenFields.value, fieldName);
}

function isDetailPriceFieldHidden(fieldName: string) {
  void fieldName;
  return false;
}

function formatDetailText(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  return String(value);
}

function formatDetailDate(value?: Date | number | string) {
  return value ? formatDateTime(value) || '-' : '-';
}

function formatDetailAmount(value?: number) {
  return `¥${formatSaleAmount(value || 0, '0.00')}`;
}

function formatDetailPriceAmount(fieldName: string, value?: number) {
  return isDetailPriceFieldHidden(fieldName)
    ? '****'
    : formatDetailAmount(value);
}

function formatAdjustType(value?: number) {
  return (
    priceAdjustTypeOptions.find((item) => item.value === value)?.label ?? '-'
  );
}

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    labelClass: '!justify-start !text-left',
    labelWidth: 82,
  },
  compact: true,
  wrapperClass: 'sale-price-adjust-basic-grid grid-cols-4',
  layout: 'horizontal',
  schema: buildBasicFormSchema(useFormSchema(formType.value)),
  showDefaultActions: false,
  handleValuesChange: (values, changedFields) => {
    if (isHydratingFormValues) return;
    if (changedFields.includes('customerId')) {
      formData.value.customerId = values.customerId;
      currentCustomerId.value = values.customerId;
      if (!skipCustomerWatch) {
        void loadSaleDeptOptions(values.customerId);
      }
    }
  },
});

async function refreshPriceAdjustFormSchema(
  customerData: ErpSalePriceAdjustApi.PriceAdjust | undefined = formData.value,
  targetType = formType.value,
  shouldApply?: () => boolean,
) {
  const hydratedCustomerData =
    await hydrateCurrentSaleFormSelectNames(customerData);
  const configuredSchema = await applyFieldConfig(
    useFormSchema(targetType, hiddenFields.value, saleDeptOptions.value),
    FIELD_CONFIG_MODULE,
  );
  if (shouldApply && !shouldApply()) {
    return false;
  }
  formApi.setState({
    schema: buildBasicFormSchema(
      withCurrentSaleFormSelectOptions(
        replaceDetailFieldWithLinkSlot(
          applyFieldPermission(configuredSchema, hiddenFields.value),
          targetType,
          'customerId',
          'customerDetail',
        ),
        hydratedCustomerData,
        targetType,
      ),
    ),
  });
  return true;
}

/** 更新调价明细 */
async function applyPriceAdjustFormMode(
  type: string,
  customerData: ErpSalePriceAdjustApi.PriceAdjust | undefined = formData.value,
  options: {
    deferTypeCommit?: boolean;
    shouldCommit?: () => boolean;
  } = {},
) {
  if (!options.deferTypeCommit) {
    formType.value = type;
  }
  modalApi.setState({ fullscreen: true });
  if (type !== 'detail') {
    const schemaApplied = await refreshPriceAdjustFormSchema(
      customerData,
      type,
      options.shouldCommit,
    );
    if (!schemaApplied) {
      return false;
    }
  }
  if (options.deferTypeCommit) {
    if (options.shouldCommit && !options.shouldCommit()) {
      return false;
    }
    formType.value = type;
  }
  formApi.setDisabled(type === 'detail');
  await nextTick();
  return true;
}

type SaleDeptFieldRef = {
  updateParam?: (newParams: Record<string, any>) => void;
};

function updateDeptFieldCustomerParam(customerId?: number) {
  formApi
    .getFieldComponentRef<SaleDeptFieldRef>('deptId')
    ?.updateParam?.(customerId ? { customerId } : {});
}

/** 按客户分页加载可选部门，避免一次性拉取客户全部销售部门 */
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
    formData.value.deptId = undefined;
    await formApi.setValues({ deptId: undefined });
    return;
  }
  const page = await getSalePriceAdjustCustomerDeptSimplePage({
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
      componentProps: { options: saleDeptOptions.value },
    },
  ]);
  const deptId = resolveSaleDeptId(
    saleDeptOptions.value,
    preferredDeptId,
    formData.value?.deptId,
  );
  formData.value.deptId = deptId;
  await formApi.setValues({ deptId });
}

function resolveSaleDeptId(
  options: any[],
  preferredDeptId?: number,
  fallbackDeptId?: number,
) {
  const currentUserDeptId = userStore.userInfo?.deptId;
  return (
    options.find((dept) => dept.id === preferredDeptId)?.id ??
    options.find((dept) => dept.id === fallbackDeptId)?.id ??
    options.find((dept) => dept.id === currentUserDeptId)?.id ??
    options[0]?.id
  );
}

function buildPriceAdjustCopyData() {
  const sourceItems = formData.value.items ?? [];
  const copyData = buildSaleCopyDraft(formData.value, {
    extraCleanKeys: [
      'approveBy',
      'approveTime',
      'auditBy',
      'auditTime',
      'checkBy',
      'checkTime',
      'writeBackStatus',
      'writeBackTime',
      'writeBackBy',
      'writeBackNo',
    ],
    extraItemCleanKeys: ['priceAdjustId'],
  }) as ErpSalePriceAdjustApi.PriceAdjust & Record<string, any>;
  copyData.adjustDate = getCurrentTimestamp();
  copyData.items = (copyData.items ?? []).map((item, index) => {
    const sourceItem = sourceItems[index] ?? {};
    return {
      ...item,
      id: undefined,
      priceAdjustId: undefined,
      saleOutId: sourceItem.saleOutId ?? item.saleOutId,
      saleOutItemId: sourceItem.saleOutItemId ?? item.saleOutItemId,
      saleOutNo: sourceItem.saleOutNo ?? item.saleOutNo,
      oldPrice: sourceItem.oldPrice ?? item.oldPrice,
      newPrice: sourceItem.newPrice ?? item.newPrice,
      adjustPrice: sourceItem.adjustPrice ?? item.adjustPrice,
      adjustReason: sourceItem.adjustReason ?? item.adjustReason,
      itemRemark: sourceItem.itemRemark ?? item.itemRemark,
      seq: item.seq ?? index + 1,
    };
  });
  return copyData;
}

async function handleCopy() {
  if (!formData.value?.id) return;
  formData.value.items = await loadAllSalePriceAdjustItems(formData.value.id, {
    mask: false,
  });
  const copyData = buildPriceAdjustCopyData();
  resetRemoteItemState();
  const sequence = ++formFocusSequence;
  modalApi.lock();
  skipCustomerWatch = true;
  try {
    await applyPriceAdjustFormMode('create');
    formData.value = copyData as any;
    currentCustomerId.value = copyData.customerId;
    currentSaleOutId.value = copyData.saleOutId;
    await loadSaleDeptOptions(copyData.customerId, copyData.deptId);
    copyData.deptId = formData.value.deptId;
    await formApi.setValues(copyData, false);
    await nextTick();
  } finally {
    skipCustomerWatch = false;
    modalApi.unlock();
    void queueFocusFirstBasicFormControl(sequence);
  }
}

function getItemFormInstance() {
  return Array.isArray(itemFormRef.value)
    ? itemFormRef.value[0]
    : itemFormRef.value;
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

function normalizeRemoteItemForCompare(
  item: ErpSalePriceAdjustApi.PriceAdjustItem,
) {
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
  current: ErpSalePriceAdjustApi.PriceAdjustItem,
  original?: ErpSalePriceAdjustApi.PriceAdjustItem,
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
  rows: ErpSalePriceAdjustApi.PriceAdjustItem[],
) {
  rows.forEach((item) => {
    if (item.id) {
      remoteItemOriginals.set(item.id, { ...item });
    }
  });
}

function getRemoteLocalItemKey(item: ErpSalePriceAdjustApi.PriceAdjustItem) {
  return itemRowKeyManager.ensureRowKey(item);
}

function applyRemoteItemCache(
  rows: ErpSalePriceAdjustApi.PriceAdjustItem[] = [],
) {
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

function recordRemoteItemChanges(
  rows: ErpSalePriceAdjustApi.PriceAdjustItem[],
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

async function loadSalePriceAdjustItemPage(
  options: {
    mask?: boolean;
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
      adjustId: formData.value.id,
      excludedItemIds: [...remoteItemDeletes],
      mask: formType.value === 'detail',
      orderDirection: nextState.orderDirection,
      orderField: nextState.orderField,
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
    };
    const result = await (formType.value === 'edit'
      ? getSalePriceAdjustEditItemPage(request)
      : getSalePriceAdjustItemPage(request));
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

async function loadAllSalePriceAdjustItems(
  adjustId: number,
  options: { mask?: boolean } = {},
) {
  const pageSize = 200;
  const firstPage = await getSalePriceAdjustItemPage({
    adjustId,
    mask: options.mask ?? false,
    pageNo: 1,
    pageSize,
  });
  const rows = [...(firstPage.list ?? [])];
  const total = firstPage.total ?? rows.length;
  const pageCount = Math.ceil(total / pageSize);
  for (let pageNo = 2; pageNo <= pageCount; pageNo++) {
    const page = await getSalePriceAdjustItemPage({
      adjustId,
      mask: options.mask ?? false,
      pageNo,
      pageSize,
    });
    rows.push(...(page.list ?? []));
  }
  return rows;
}

async function buildMergedRemoteItemsForSubmit() {
  const itemFormInstance = getItemFormInstance();
  if (!isRemoteItemPaging.value || !formData.value?.id) {
    return itemFormInstance?.getDraftItems?.() ?? formData.value.items ?? [];
  }
  recordRemoteItemChanges(
    itemFormInstance?.getDraftItems?.() ?? formData.value.items ?? [],
  );
  const updateItems = [...remoteItemEdits.values()].map((item) => ({
    ...stripSaleItemClientFields(item),
    operation: 'update' as const,
  }));
  const insertItems = [...remoteItemCreates.values()].map((item) => {
    const next = { ...item };
    delete next.id;
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
  return [...updateItems, ...insertItems, ...deleteItems];
}

async function handleUpdateItems(
  items: ErpSalePriceAdjustApi.PriceAdjustItem[],
) {
  const previousDeleteCount = remoteItemDeletes.size;
  const previousCreateCount = remoteItemCreates.size;
  recordRemoteItemChanges(items);
  formData.value.items = isRemoteItemPaging.value
    ? applyRemoteItemCache(items.filter((item) => Boolean(item.id)))
    : items;
  formApi.setValues({ items: formData.value.items });
  if (!isRemoteItemPaging.value) return;
  if (remoteItemCreates.size > previousCreateCount) {
    await loadSalePriceAdjustItemPage({
      orderDirection: undefined,
      orderField: undefined,
      pageNo: clampRemoteItemPageNo(
        Number.MAX_SAFE_INTEGER,
        itemPageState.value.pageSize,
        itemPageState.value.total,
      ),
    });
  } else if (remoteItemDeletes.size > previousDeleteCount) {
    await loadSalePriceAdjustItemPage({
      pageNo: clampRemoteItemPageNo(
        itemPageState.value.pageNo,
        itemPageState.value.pageSize,
        itemPageState.value.total,
      ),
    });
  }
}

/** 更新合计调价金额 */
function handleUpdateTotalAdjustPrice(totalAdjustPrice: number) {
  if (isRemoteItemPaging.value) {
    return;
  }
  formData.value.totalAdjustPrice = totalAdjustPrice;
  formApi.setValues({ totalAdjustPrice });
}

/** 监听客户变更 - 自动弹出明细选择弹窗 */
watch(
  () => currentCustomerId.value,
  (newVal, oldVal) => {
    if (skipCustomerWatch || isHydratingFormValues) return;
    if (newVal && newVal !== oldVal && formType.value === 'create') {
      // 切换客户时清空子表
      formData.value.items = [];
      formApi.setValues({ items: [] });
      // 自动弹出选择弹窗
      selectModalOpen.value = true;
    }
  },
);

function handleImport() {
  importFormModalApi
    .setData({
      title: '导入销售调价明细',
      templateFileName: '销售调价导入模板.xls',
      importRequest: importSalePriceAdjust,
      exportTemplateRequest: exportSalePriceAdjustImportTemplate,
      templateGuideSummary:
        '销售调价明细导入模板用于解析当前调价单明细，上传后系统会按销售单号、产品、仓库、调后价等字段回填到当前表单。',
      templateGuideTips: [
        '销售单号、仓库必填；配件编码、配件名称、厂家编码三选一填写即可；如果多列都填，必须对应同一条已审核销售出库明细。',
        '调后价、调价原因、备注等明细字段请按模板示例填写。',
      ],
    })
    .open();
}

async function applyImportData(
  importData?: ErpSalePriceAdjustApi.PriceAdjustImportResp,
) {
  resetRemoteItemState();
  const importValues = {
    customerId: importData?.customerId,
    items: importData?.items ?? [],
  } as ErpSalePriceAdjustApi.PriceAdjust;
  skipCustomerWatch = true;
  try {
    formData.value = {
      ...formData.value,
      ...importValues,
    };
    await formApi.setValues(importValues, false);
    currentCustomerId.value = importValues.customerId;
    currentSaleOutId.value = undefined;
    await loadSaleDeptOptions(importValues.customerId);
  } finally {
    await nextTick();
    skipCustomerWatch = false;
  }
}

async function handleImportSuccess(
  data: ErpSalePriceAdjustApi.PriceAdjustImportResp,
) {
  await applyImportData(data);
}

/** 手动打开新增明细弹窗 */
function handleAddItems() {
  if (!currentCustomerId.value) {
    message.warning('请先选择客户');
    return;
  }
  selectModalOpen.value = true;
}

async function resolveStockCount(productId?: number, warehouseId?: number) {
  if (!productId) return undefined;
  return (await getStockCount(productId, warehouseId)) || 0;
}

/** 明细选择弹窗确认 */
async function handleItemsSelected(
  selectedItems: ErpSalePriceAdjustApi.SaleOutItemForAdjust[],
) {
  if (!selectedItems || selectedItems.length === 0) return;
  const mutationSequence = ++itemMutationSequence;
  const snapshot = {
    creates: new Map(remoteItemCreates),
    items: [...(formData.value.items || [])],
    pageState: { ...itemPageState.value },
  };
  try {
    const existingItems = formData.value.items || [];
    const existingKeys = new Set(
      existingItems.map((i) => `${i.saleOutId}_${i.saleOutItemId}`),
    );
    const newItems: ErpSalePriceAdjustApi.PriceAdjustItem[] = await Promise.all(
      selectedItems
        .filter(
          (item) =>
            !existingKeys.has(`${item.saleOutId}_${item.saleOutItemId}`),
        )
        .map(async (item) => ({
          id: undefined,
          seq: undefined,
          saleOutId: item.saleOutId,
          saleOutItemId: item.saleOutItemId,
          saleOutNo: item.saleOutNo,
          productId: item.productId,
          partCode: item.productCode,
          partName: item.productName,
          unit: item.unitName,
          weight: item.weight,
          packageQty: item.packageQty,
          brand: item.brand,
          vehicleModel: item.vehicleModel,
          originPlace: item.originPlace,
          outCount: item.count,
          stockCount:
            item.stockCount ??
            (await resolveStockCount(item.productId, item.warehouseId)),
          oldPrice: item.productPrice,
          newPrice: item.productPrice,
          adjustPrice: 0,
          deptId: item.deptId,
          warehouseId: item.warehouseId,
          warehouseName: item.warehouseName,
          warehouseDeptId: item.warehouseDeptId,
          warehouseDeptName: item.warehouseDeptName,
          batchNo: item.batchNo,
          adjustReason: undefined,
          itemRemark: undefined,
        })),
    );
    if (mutationSequence !== itemMutationSequence) return;
    if (isRemoteItemPaging.value && formData.value.id) {
      const localKeys = new Set(
        [...remoteItemCreates.values()].map(
          (item) => `${item.saleOutId}_${item.saleOutItemId}`,
        ),
      );
      let appendItems = newItems.filter(
        (item) => !localKeys.has(`${item.saleOutId}_${item.saleOutItemId}`),
      );
      const matchResult = appendItems.length
        ? await matchSalePriceAdjustItems({
            documentId: formData.value.id,
            excludedItemIds: [...remoteItemDeletes],
            keys: appendItems.map((item) => ({
              saleOutId: item.saleOutId,
              saleOutItemId: item.saleOutItemId,
            })),
            pageSize: itemPageState.value.pageSize,
          })
        : { matches: [] };
      if (mutationSequence !== itemMutationSequence) return;
      const duplicateIndexes = new Set(
        matchResult.matches.map((match) => match.keyIndex),
      );
      appendItems = appendItems.filter(
        (_, index) => !duplicateIndexes.has(index),
      );
      if (duplicateIndexes.size > 0 || appendItems.length < newItems.length) {
        message.warning('已过滤整单中重复的销售出库明细');
      }
      if (appendItems.length === 0) {
        const targetPage = matchResult.matches[0]?.pageNo;
        if (targetPage) {
          await loadSalePriceAdjustItemPage({
            orderDirection: undefined,
            orderField: undefined,
            pageNo: targetPage,
          });
        }
        return;
      }
      const usedKeys = new Set(remoteItemCreates.keys());
      appendItems.forEach((item) => {
        itemRowKeyManager.ensureRowKey(item, { forceNew: true, usedKeys });
        remoteItemCreates.set(getRemoteLocalItemKey(item), item);
      });
      itemPageState.value.total = getRemoteItemTotal(
        remotePersistedItemTotal,
        remoteItemCreates.size,
      );
      await loadSalePriceAdjustItemPage({
        orderDirection: undefined,
        orderField: undefined,
        pageNo: clampRemoteItemPageNo(
          Number.MAX_SAFE_INTEGER,
          itemPageState.value.pageSize,
          itemPageState.value.total,
        ),
      });
      getItemFormInstance()?.queueFocusNewlyAddedPriceInput?.();
      return;
    }
    const merged = [...existingItems, ...newItems];
    formData.value.items = merged;
    formApi.setValues({ items: merged });
    if (newItems.length > 0) {
      getItemFormInstance()?.queueFocusNewlyAddedPriceInput?.();
    }
  } catch {
    if (mutationSequence !== itemMutationSequence) return;
    remoteItemCreates.clear();
    snapshot.creates.forEach((value, key) => remoteItemCreates.set(key, value));
    itemPageState.value = snapshot.pageState;
    formData.value.items = snapshot.items;
    await formApi.setValues({ items: snapshot.items });
    message.error('新增调价明细失败，已恢复操作前状态，请重试');
  }
}

async function applySourceSaleOut(
  sourceSaleOut?: ErpSaleOutApi.SaleOut,
  sourceSaleOutId?: number,
) {
  const saleOutId = sourceSaleOut?.id ?? sourceSaleOutId;
  const saleOut =
    sourceSaleOut?.id && sourceSaleOut.customerId
      ? sourceSaleOut
      : saleOutId
        ? await getSaleOut(saleOutId, { includeItems: false, mask: false })
        : undefined;
  if (!saleOut?.id) return;

  formData.value = withSaleCustomerFromSource(formData.value, saleOut);
  currentSaleOutId.value = saleOut.id;
  await loadSaleDeptOptions(saleOut.customerId, saleOut.deptId);
  await refreshPriceAdjustFormSchema(formData.value);
  skipCustomerWatch = true;
  try {
    await formApi.setValues({ customerId: saleOut.customerId }, false);
    currentCustomerId.value = saleOut.customerId;
  } finally {
    await nextTick();
    skipCustomerWatch = false;
  }
  selectModalOpen.value = true;
}

function normalizeLoadedPriceAdjust(
  sourceData?: ErpSalePriceAdjustApi.PriceAdjust | null,
) {
  if (!sourceData) {
    throw new Error('未找到该销售调价单，可能已被删除');
  }
  return {
    ...sourceData,
    items: Array.isArray(sourceData.items) ? sourceData.items : [],
  };
}

async function loadDetailData(id: number, sequence: number) {
  try {
    const [sourceData] = await Promise.all([
      getSalePriceAdjust(id, { includeItems: false, mask: true }),
      loadHiddenFields(),
    ]);
    if (sequence !== detailLoadSequence) {
      return;
    }
    formData.value = normalizeLoadedPriceAdjust(sourceData);
    formData.value.items = [];
    resetRemoteItemState();
    currentCustomerId.value = formData.value.customerId;
    currentSaleOutId.value = undefined;
    // 详情内容位于 loading 分支之后，先显示并等待子表完成挂载，
    // 避免明细数据早于 VXE Grid 初始化而丢失首次同步。
    detailLoading.value = false;
    await nextTick();
    await loadSalePriceAdjustItemPage({ pageNo: 1 });
  } catch (error) {
    if (sequence !== detailLoadSequence) {
      return;
    }
    detailLoadError.value = getErpDetailLoadError(
      error,
      reportViewOnly
        ? '单据已删除、不可用或无权访问，请关闭后重试'
        : error instanceof Error && error.message
          ? error.message
          : '销售调价单详情加载失败，请关闭后重试',
    );
  } finally {
    if (sequence === detailLoadSequence) {
      detailLoading.value = false;
      modalApi.unlock();
    }
  }
}

async function reloadDetail(id: number) {
  formData.value = normalizeLoadedPriceAdjust(
    await getSalePriceAdjust(id, {
      includeItems: !isRemoteItemPaging.value,
      mask: formType.value === 'detail',
    }),
  );
  if (isRemoteItemPaging.value) {
    formData.value.items = [];
  }
  currentCustomerId.value = formData.value.customerId;
  if (isRemoteItemPaging.value) {
    await loadSalePriceAdjustItemPage({ pageNo: itemPageState.value.pageNo });
  }
  settlementTabReloadKey.value += 1;
}

async function handleUpdateStatus(status: number) {
  if (!formData.value.id) return;
  modalApi.lock();
  try {
    await updateSalePriceAdjustStatus(formData.value.id, status);
    await reloadDetail(formData.value.id);
    emit('success');
    message.success(status === 20 ? '审核成功' : '驳回成功');
  } finally {
    modalApi.unlock();
  }
}

async function buildCurrentPriceAdjustPayload() {
  const data = (await formApi.getValues()) as ErpSalePriceAdjustApi.PriceAdjust;
  data.items = (await buildMergedRemoteItemsForSubmit()).map(
    (item: ErpSalePriceAdjustApi.PriceAdjustItem) =>
      stripSaleItemClientFields(item),
  );
  delete (data as unknown as Record<string, unknown>).customerReceivableInfo;
  return data;
}

async function saveSalePriceAdjustDraft(
  isCreatingDraft: boolean,
  options: { explicit?: boolean } = {},
) {
  if (draftSaving) {
    return false;
  }

  draftSaving = true;
  modalApi.lock();
  try {
    const data = await buildCurrentPriceAdjustPayload();
    if (
      isCreatingDraft &&
      !hasValidSaleDraftItems(data.items ?? [], {
        countField: 'outCount',
        priceMode: 'none',
        requireSaleOutItem: true,
        requireWarehouse: false,
      })
    ) {
      draftSaved = !options.explicit;
      message.warning('未选择明细，不生成草稿');
      return !options.explicit;
    }
    if (isCreatingDraft) {
      await createSalePriceAdjustDraft(data);
    } else {
      data.id = formData.value.id;
      await updateSalePriceAdjustDraft(data);
    }
    draftSaved = true;
    if (options.explicit) {
      skipDraftOnClose = true;
    }
    message.success(
      options.explicit
        ? isCreatingDraft
          ? '草稿生成成功'
          : '草稿保存成功'
        : isCreatingDraft
          ? '未提交内容已自动保存为草稿'
          : '草稿修改已自动保存',
    );
    emit('success');
    if (options.explicit) {
      await modalApi.close();
    }
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
  if (!canGenerateDraft.value) return;
  await saveSalePriceAdjustDraft(formType.value === 'create', {
    explicit: true,
  });
}

async function switchDetailToEdit(
  initialData?: ErpSalePriceAdjustApi.PriceAdjust,
) {
  if (!initialData?.id || detailEditLoading.value) return;
  const id = initialData.id;
  const sequence = ++formLoadSequence;
  formFocusSequence = sequence;
  detailLoadSequence += 1;
  detailEditLoading.value = true;
  skipDraftOnClose = false;
  draftSaved = false;
  draftSaving = false;
  isHydratingFormValues = true;
  skipCustomerWatch = true;
  let switchedToEdit = false;
  const detailSnapshot = {
    creates: new Map(remoteItemCreates),
    deletes: new Set(remoteItemDeletes),
    edits: new Map(remoteItemEdits),
    formData: {
      ...formData.value,
      items: (formData.value.items ?? []).map((item) => ({ ...item })),
    } as ErpSalePriceAdjustApi.PriceAdjust,
    originals: new Map(remoteItemOriginals),
    pageState: { ...itemPageState.value },
    persistedTotal: remotePersistedItemTotal,
    persistedTotalKnown: remotePersistedItemTotalKnown,
    saleDeptOptions: [...saleDeptOptions.value],
  };
  try {
    const [sourceData] = await Promise.all([
      getSalePriceAdjust(id, { includeItems: false, mask: false }),
      loadHiddenFields(),
    ]);
    if (sequence !== formLoadSequence) return;
    const loadedData = hydrateSaleCustomerFromFallback(
      normalizeLoadedPriceAdjust(sourceData),
      initialData,
    );
    loadedData.items = [];
    const pageSize = itemPageState.value.pageSize || DEFAULT_ITEM_PAGE_SIZE;
    const [deptPage, itemPage] = await Promise.all([
      loadedData.customerId
        ? getSalePriceAdjustCustomerDeptSimplePage({
            customerId: loadedData.customerId,
            pageNo: 1,
            pageSize: 10,
          })
        : Promise.resolve({ list: [] }),
      getSalePriceAdjustEditItemPage({
        adjustId: id,
        excludedItemIds: [],
        mask: false,
        pageNo: 1,
        pageSize,
      }),
    ]);
    if (sequence !== formLoadSequence) return;
    const nextSaleDeptOptions = deptPage?.list ?? [];
    loadedData.deptId = resolveSaleDeptId(
      nextSaleDeptOptions,
      loadedData.deptId,
    );
    saleDeptOptions.value = nextSaleDeptOptions;
    updateDeptFieldCustomerParam(loadedData.customerId);
    const modeApplied = await applyPriceAdjustFormMode('edit', loadedData, {
      deferTypeCommit: true,
      shouldCommit: () => sequence === formLoadSequence,
    });
    if (!modeApplied || sequence !== formLoadSequence) return;
    formData.value = loadedData;
    await formApi.setValues(
      buildSaleDocumentDetailFormValues(formData.value, 'edit'),
      false,
    );
    if (sequence !== formLoadSequence) return;
    currentCustomerId.value = formData.value.customerId;
    currentSaleOutId.value = undefined;
    resetRemoteItemState();
    remotePersistedItemTotal = itemPage.total ?? 0;
    remotePersistedItemTotalKnown = true;
    itemPageState.value = {
      orderDirection: undefined,
      orderField: undefined,
      pageNo: 1,
      pageSize,
      total: getRemoteItemTotal(remotePersistedItemTotal, 0),
    };
    rememberRemoteItemOriginals(itemPage.list ?? []);
    formData.value.items = applyRemoteItemCache(itemPage.list ?? []);
    await nextTick();
    if (sequence !== formLoadSequence) return;
    await getItemFormInstance()?.reloadItemsFromProps?.();
    switchedToEdit = true;
  } catch {
    if (sequence === formLoadSequence) {
      formType.value = 'detail';
      formApi.setDisabled(true);
      formData.value = detailSnapshot.formData;
      saleDeptOptions.value = detailSnapshot.saleDeptOptions;
      remotePersistedItemTotal = detailSnapshot.persistedTotal;
      remotePersistedItemTotalKnown = detailSnapshot.persistedTotalKnown;
      itemPageState.value = detailSnapshot.pageState;
      remoteItemEdits.clear();
      detailSnapshot.edits.forEach((value, key) =>
        remoteItemEdits.set(key, value),
      );
      remoteItemDeletes.clear();
      detailSnapshot.deletes.forEach((value) => remoteItemDeletes.add(value));
      remoteItemCreates.clear();
      detailSnapshot.creates.forEach((value, key) =>
        remoteItemCreates.set(key, value),
      );
      remoteItemOriginals.clear();
      detailSnapshot.originals.forEach((value, key) =>
        remoteItemOriginals.set(key, value),
      );
      try {
        await formApi.setValues(
          buildSaleDocumentDetailFormValues(formData.value, 'detail'),
          false,
        );
        await nextTick();
        await getItemFormInstance()?.reloadItemsFromProps?.();
      } catch {
        // 恢复详情的核心状态已完成，辅助视图同步失败也不能再次切走详情。
      } finally {
        message.error('销售调价单编辑数据加载失败，请重试');
      }
    }
  } finally {
    if (sequence === formLoadSequence) {
      detailEditLoading.value = false;
      isHydratingFormValues = false;
      skipCustomerWatch = false;
      if (switchedToEdit) {
        void queueFocusFirstBasicFormControl(sequence);
      }
    }
  }
}

async function handleEditFromDetail() {
  if (!canEditFromDetail.value) return;
  await switchDetailToEdit(formData.value);
}

function handleSubmitDraftFromDetail() {
  if (!formData.value.id) return;
  const id = formData.value.id;
  AntdModal.confirm({
    title: `确认提交草稿 ${formData.value.no || ''} 吗？`,
    content: '提交后将进入未审核状态，不能再按草稿方式修改。',
    async onOk() {
      modalApi.lock();
      try {
        await submitSalePriceAdjust(id);
        skipDraftOnClose = true;
        await modalApi.close();
        emit('success');
        message.success('草稿已提交，当前状态为未审核');
      } finally {
        modalApi.unlock();
      }
    },
  });
}

const [Modal, modalApi] = useVbenModal({
  async onBeforeClose() {
    if (detailEditLoading.value) {
      return true;
    }
    const isCreatingDraft = formType.value === 'create';
    const isUpdatingDraft = isEditingDraft.value && Boolean(formData.value.id);
    if (
      (!isCreatingDraft && !isUpdatingDraft) ||
      skipDraftOnClose ||
      draftSaved
    ) {
      return true;
    }
    return saveSalePriceAdjustDraft(isCreatingDraft);
  },
  async onCancel() {
    skipDraftOnClose = true;
    await modalApi.close();
  },
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;

    const itemFormInstance = Array.isArray(itemFormRef.value)
      ? itemFormRef.value[0]
      : itemFormRef.value;
    let data: ErpSalePriceAdjustApi.PriceAdjust;
    try {
      data = await buildCurrentPriceAdjustPayload();
      if (
        isRemoteItemPaging.value &&
        formData.value?.id &&
        itemPageState.value.total <= 0
      ) {
        throw new Error('调价明细不能为空，请先选择客户并新增明细');
      }
      itemFormInstance?.validate(
        (data.items ?? []).filter((item) => item.operation !== 'delete'),
        { requireItems: !isRemoteItemPaging.value },
      );
    } catch (error: any) {
      message.error(error.message || '子表单验证失败');
      return;
    }

    modalApi.lock();
    try {
      if (formType.value === 'create') {
        await createSalePriceAdjust(data);
      } else if (isEditingDraft.value) {
        data.id = formData.value.id;
        await updateSalePriceAdjustDraft(data);
        await submitSalePriceAdjust(formData.value.id!);
      } else {
        await updateSalePriceAdjust(data);
      }
      skipDraftOnClose = true;
      await modalApi.close();
      emit('success');
      message.success($t('ui.actionMessage.operationSuccess'));
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    isSalePriceAdjustFormOpen.value = isOpen;
    if (!isOpen) {
      detailLoadSequence += 1;
      formLoadSequence += 1;
      formFocusSequence += 1;
      detailLoading.value = false;
      detailEditLoading.value = false;
      detailLoadError.value = '';
      isHydratingFormValues = false;
      skipCustomerWatch = false;
      detailActiveTab.value = DETAIL_TAB_KEY;
      settlementTabReloadKey.value += 1;
      formData.value = {
        items: [],
        totalAdjustPrice: 0,
      } as ErpSalePriceAdjustApi.PriceAdjust;
      resetRemoteItemState();
      currentCustomerId.value = undefined;
      currentSaleOutId.value = undefined;
      saleDeptOptions.value = [];
      return;
    }
    const data = modalApi.getData<{
      id?: number;
      type: string;
      customerId?: string;
      saleOutId?: string;
      sourceSaleOut?: ErpSaleOutApi.SaleOut;
      initialData?: ErpSalePriceAdjustApi.PriceAdjust;
      importData?: ErpSalePriceAdjustApi.PriceAdjustImportResp;
    }>() ?? { type: 'create' };
    skipDraftOnClose = false;
    draftSaved = false;
    draftSaving = false;
    detailActiveTab.value = DETAIL_TAB_KEY;
    settlementTabReloadKey.value += 1;
    detailLoading.value = false;
    detailEditLoading.value = false;
    detailLoadError.value = '';

    if (data.type === 'detail') {
      modalApi.lock();
      await applyPriceAdjustFormMode('detail');
      formData.value = {
        items: [],
        totalAdjustPrice: 0,
      } as ErpSalePriceAdjustApi.PriceAdjust;
      if (!data.id) {
        modalApi.unlock();
        detailLoadError.value = '缺少销售调价单编号，无法加载详情';
        return;
      }
      detailLoading.value = true;
      const sequence = ++detailLoadSequence;
      void loadDetailData(data.id, sequence);
      return;
    }

    const sequence = ++formLoadSequence;
    formFocusSequence = sequence;
    modalApi.lock();
    try {
      await loadHiddenFields();
      if (sequence !== formLoadSequence) return;
      await applyPriceAdjustFormMode(data.type, data.initialData);
      if (sequence !== formLoadSequence) return;

      if (!data.id) {
        resetRemoteItemState();
        // 新增模式：设置默认值
        const now = getCurrentTimestamp();
        saleDeptOptions.value = [];
        await refreshPriceAdjustFormSchema();
        formData.value = {
          items: [],
          totalAdjustPrice: 0,
          adjustDate: now,
          ...buildSaleCurrentUserFormDefaults(userStore.userInfo, [
            'adjustUserId',
          ]),
          deptId: undefined,
          settleMethod: '挂账',
          adjustType: 10,
        } as ErpSalePriceAdjustApi.PriceAdjust;
        // 如果从销售单页面跳转过来，预填客户
        if (data.customerId) {
          formData.value.customerId = Number(data.customerId);
        }
        // 如果从销售单页面跳转过来，记录销售单 ID 供弹窗按单过滤
        if (data.saleOutId) {
          currentSaleOutId.value = Number(data.saleOutId);
        } else {
          currentSaleOutId.value = undefined;
        }
        skipCustomerWatch = true;
        try {
          await refreshPriceAdjustFormSchema();
          await formApi.setValues(
            buildSaleDocumentDetailFormValues(formData.value, formType.value),
            false,
          );
          currentCustomerId.value = formData.value.customerId;
        } finally {
          await nextTick();
          skipCustomerWatch = false;
        }
        if (formData.value.customerId) {
          await loadSaleDeptOptions(formData.value.customerId);
        }
        if (data.importData) {
          await applyImportData(data.importData);
        }
        await applySourceSaleOut(
          data.sourceSaleOut,
          data.saleOutId ? Number(data.saleOutId) : undefined,
        );
        return;
      }

      isHydratingFormValues = true;
      formData.value = hydrateSaleCustomerFromFallback(
        normalizeLoadedPriceAdjust(
          await getSalePriceAdjust(data.id, {
            includeItems: false,
            mask: data.type === 'detail',
          }),
        ),
        data.initialData,
      );
      formData.value.items = [];
      resetRemoteItemState();
      if (sequence !== formLoadSequence) return;
      await loadSaleDeptOptions(
        formData.value.customerId,
        formData.value.deptId,
      );
      if (sequence !== formLoadSequence) return;
      await formApi.setValues(
        buildSaleDocumentDetailFormValues(formData.value, formType.value),
        false,
      );
      await loadSalePriceAdjustItemPage({ pageNo: 1 });
      currentCustomerId.value = formData.value.customerId;
      currentSaleOutId.value = undefined;
    } finally {
      if (sequence === formLoadSequence) {
        isHydratingFormValues = false;
        skipCustomerWatch = false;
        modalApi.unlock();
        void queueFocusFirstBasicFormControl(sequence);
      }
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
  await loadSalePriceAdjustItemPage(payload);
}
</script>

<template>
  <Modal
    :title="getTitle"
    class="!w-full"
    bordered
    content-class="p-0"
    :confirm-text="confirmText"
    :show-confirm-button="canConfirmForm"
  >
    <template #title>
      <div class="sale-price-adjust-detail-title">
        <div class="sale-price-adjust-detail-title__text">
          <span>{{ getTitle }}</span>
          <small
            v-if="
              formType !== 'create' && formData.no && isDetailFieldVisible('no')
            "
          >
            {{ formatDetailText(formData.no) }}
          </small>
        </div>
        <span
          v-if="
            formType !== 'create' &&
            formData.status !== undefined &&
            isDetailFieldVisible('status')
          "
          class="sale-price-adjust-status"
          :class="detailStatus.className"
        >
          {{ detailStatus.label }}
        </span>
      </div>
    </template>

    <div
      class="sale-price-adjust-detail-view"
      :class="{ 'erp-form-focus-highlight': formType !== 'detail' }"
    >
      <div v-if="detailLoading" class="sale-price-adjust-detail-load-state">
        正在加载完整明细，请稍候…
      </div>
      <div
        v-else-if="detailLoadError"
        class="sale-price-adjust-detail-load-state is-error"
      >
        {{ detailLoadError }}
      </div>

      <Tabs
        v-else
        v-model:active-key="detailActiveTab"
        class="sale-price-adjust-detail-tabs"
        :class="{
          'sale-price-adjust-detail-tabs--hidden-nav': formType !== 'detail',
        }"
        :tab-bar-style="formType === 'detail' ? undefined : { display: 'none' }"
      >
        <Tabs.TabPane :key="DETAIL_TAB_KEY" tab="单据详情" force-render>
          <div class="sale-price-adjust-detail-content">
            <section
              ref="basicFormRef"
              class="sale-price-adjust-detail-section"
              @keydown.capture="handleBasicFormEnter"
            >
              <header class="sale-price-adjust-detail-section__header">
                <span class="sale-price-adjust-detail-section__title"
                  >基本信息</span
                >
              </header>

              <div
                v-if="formType === 'detail'"
                class="sale-price-adjust-detail-grid"
              >
                <div
                  v-if="isDetailFieldVisible('no')"
                  class="sale-price-adjust-detail-field"
                >
                  <span class="sale-price-adjust-detail-field__label"
                    >调价单号</span
                  >
                  <span
                    class="sale-price-adjust-detail-field__value"
                    :title="formatDetailText(formData.no)"
                  >
                    {{ formatDetailText(formData.no) }}
                  </span>
                </div>
                <div
                  v-if="isDetailFieldVisible('adjustDate')"
                  class="sale-price-adjust-detail-field"
                >
                  <span class="sale-price-adjust-detail-field__label"
                    >调价日期</span
                  >
                  <span
                    class="sale-price-adjust-detail-field__value"
                    :title="formatDetailDate(formData.adjustDate)"
                  >
                    {{ formatDetailDate(formData.adjustDate) }}
                  </span>
                </div>
                <div
                  v-if="isDetailFieldVisible('customerId')"
                  class="sale-price-adjust-detail-field"
                >
                  <span class="sale-price-adjust-detail-field__label"
                    >客户</span
                  >
                  <button
                    v-if="canOpenCustomerDetail"
                    type="button"
                    class="sale-price-adjust-detail-field__value sale-price-adjust-detail-field__link"
                    :title="formatDetailText(formData.customerName)"
                    @click="handleOpenCustomerDetail"
                  >
                    <span>{{ formatDetailText(formData.customerName) }}</span>
                    <span aria-hidden="true">↗</span>
                  </button>
                  <span v-else class="sale-price-adjust-detail-field__value"
                    >-</span
                  >
                </div>
                <div
                  v-if="isDetailFieldVisible('adjustUserId')"
                  class="sale-price-adjust-detail-field"
                >
                  <span class="sale-price-adjust-detail-field__label"
                    >调价人</span
                  >
                  <span
                    class="sale-price-adjust-detail-field__value"
                    :title="formatDetailText(formData.adjustUserName)"
                  >
                    {{ formatDetailText(formData.adjustUserName) }}
                  </span>
                </div>
                <div
                  v-if="isDetailFieldVisible('settleMethod')"
                  class="sale-price-adjust-detail-field"
                >
                  <span class="sale-price-adjust-detail-field__label"
                    >结算方式</span
                  >
                  <span
                    class="sale-price-adjust-detail-field__value"
                    :title="formatDetailText(formData.settleMethod)"
                  >
                    {{ formatDetailText(formData.settleMethod) }}
                  </span>
                </div>
                <div
                  v-if="isDetailFieldVisible('deliveryMethod')"
                  class="sale-price-adjust-detail-field"
                >
                  <span class="sale-price-adjust-detail-field__label"
                    >送货方式</span
                  >
                  <span
                    class="sale-price-adjust-detail-field__value"
                    :title="formatDetailText(formData.deliveryMethod)"
                  >
                    {{ formatDetailText(formData.deliveryMethod) }}
                  </span>
                </div>
                <div
                  v-if="isDetailFieldVisible('logisticsCompany')"
                  class="sale-price-adjust-detail-field"
                >
                  <span class="sale-price-adjust-detail-field__label"
                    >物流公司</span
                  >
                  <span
                    class="sale-price-adjust-detail-field__value"
                    :title="formatDetailText(formData.logisticsCompany)"
                  >
                    {{ formatDetailText(formData.logisticsCompany) }}
                  </span>
                </div>
                <div
                  v-if="isDetailFieldVisible('adjustType')"
                  class="sale-price-adjust-detail-field"
                >
                  <span class="sale-price-adjust-detail-field__label"
                    >调价类型</span
                  >
                  <span class="sale-price-adjust-detail-field__value">
                    {{ formatAdjustType(formData.adjustType) }}
                  </span>
                </div>
                <div
                  v-if="isDetailFieldVisible('deptId')"
                  class="sale-price-adjust-detail-field"
                >
                  <span class="sale-price-adjust-detail-field__label"
                    >部门</span
                  >
                  <span
                    class="sale-price-adjust-detail-field__value"
                    :title="formatDetailText(formData.deptName)"
                  >
                    {{ formatDetailText(formData.deptName) }}
                  </span>
                </div>
                <div
                  v-if="isDetailFieldVisible('remark')"
                  class="sale-price-adjust-detail-field"
                >
                  <span class="sale-price-adjust-detail-field__label"
                    >备注</span
                  >
                  <span
                    class="sale-price-adjust-detail-field__value"
                    :title="formatDetailText(formData.remark)"
                  >
                    {{ formatDetailText(formData.remark) }}
                  </span>
                </div>
              </div>

              <Form
                v-else
                class="sale-price-adjust-edit-form sale-price-adjust-edit-form--editable"
              >
                <template #customerDetail>
                  <DetailLinkInput
                    :navigable="canOpenCustomerDetail"
                    :value="formData.customerName"
                    @open="handleOpenCustomerDetail"
                  />
                </template>
              </Form>

              <div
                v-if="
                  formType !== 'detail' &&
                  formData.customerId &&
                  isDetailFieldVisible('customerId') &&
                  isDetailFieldVisible('customerReceivableInfo')
                "
                class="sale-price-adjust-detail-receivable"
              >
                <CustomerReceivableSummary :customer-id="formData.customerId" />
              </div>
            </section>

            <section
              v-if="isDetailFieldVisible('items')"
              class="sale-price-adjust-detail-section"
            >
              <header class="sale-price-adjust-detail-section__header">
                <span class="sale-price-adjust-detail-section__title">
                  调价产品清单
                </span>
                <span class="sale-price-adjust-detail-count">
                  {{ detailItemCount }} 项产品
                </span>
              </header>
              <div class="sale-price-adjust-detail-items">
                <ItemForm
                  ref="itemFormRef"
                  :items="formData.items ?? []"
                  :customer-price-level="currentCustomerPriceLevel"
                  :disabled="formType === 'detail'"
                  :hidden-fields="hiddenFields"
                  :item-page-loading="itemPageLoading"
                  :item-pagination="itemPageState"
                  :main-dept-id="formData.deptId"
                  :remote-paging="isRemoteItemPaging"
                  :shortcut-active="isSalePriceAdjustFormOpen"
                  @page-change="handleItemPageChange"
                  @request-add-items="handleAddItems"
                  @request-submit="handleLastInputEnterConfirm"
                  @update:items="handleUpdateItems"
                  @update:total-adjust-price="handleUpdateTotalAdjustPrice"
                >
                  <template #toolbar>
                    <template v-if="formType !== 'detail'">
                      <Button
                        v-if="formType === 'create'"
                        type="primary"
                        ghost
                        @click="handleImport"
                      >
                        导入明细
                      </Button>
                      <Tooltip
                        :title="
                          !currentCustomerId
                            ? '请先选择客户'
                            : '从该客户的销售单中选择明细'
                        "
                      >
                        <Button
                          type="primary"
                          :disabled="!currentCustomerId"
                          @click="handleAddItems"
                        >
                          新增明细
                        </Button>
                      </Tooltip>
                    </template>
                  </template>
                </ItemForm>
              </div>
              <div class="sale-price-adjust-document-summary">
                <strong>单据合计</strong>
                <span
                  v-if="isDetailFieldVisible('sourceNo')"
                  class="sale-price-adjust-document-summary__source"
                >
                  关联销售单
                  <template v-if="sourceSaleOutLinks.length">
                    <template
                      v-for="(source, index) in sourceSaleOutLinks"
                      :key="source.id"
                    >
                      <span v-if="index"> / </span>
                      <a @click.stop="handleOpenSourceOutDetail(source.id)">
                        {{ source.no }}
                      </a>
                    </template>
                  </template>
                  <b v-else>{{ formData.sourceNo || '-' }}</b>
                </span>
                <span
                  v-if="
                    isDetailFieldVisible('totalOriginalPrice') ||
                    isDetailPriceFieldHidden('totalOriginalPrice')
                  "
                >
                  调价前金额
                  <b>{{
                    formatDetailPriceAmount(
                      'totalOriginalPrice',
                      detailOriginalAmount,
                    )
                  }}</b>
                </span>
                <span
                  v-if="
                    isDetailFieldVisible('totalAdjustedPrice') ||
                    isDetailPriceFieldHidden('totalAdjustedPrice')
                  "
                >
                  调价后金额
                  <b>{{
                    formatDetailPriceAmount(
                      'totalAdjustedPrice',
                      detailAdjustedAmount,
                    )
                  }}</b>
                </span>
                <span
                  v-if="
                    isDetailFieldVisible('totalAdjustPrice') ||
                    isDetailPriceFieldHidden('totalAdjustPrice')
                  "
                  class="sale-price-adjust-document-summary__difference"
                >
                  调价差额
                  <b>{{
                    formatDetailPriceAmount(
                      'totalAdjustPrice',
                      detailAdjustAmount,
                    )
                  }}</b>
                </span>
              </div>
            </section>

            <section
              v-if="showDetailAudit"
              class="sale-price-adjust-detail-section sale-price-adjust-detail-audit"
            >
              <header class="sale-price-adjust-detail-section__header">
                <span class="sale-price-adjust-detail-section__title"
                  >审计信息</span
                >
              </header>
              <ErpAuditInfo title="" :record="formData" />
            </section>
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane
          v-if="formType === 'detail'"
          :key="SETTLEMENT_TAB_KEY"
          tab="结算核销"
        >
          <SettlementWriteOffTab
            :active="detailActiveTab === SETTLEMENT_TAB_KEY"
            :adjust-id="formData?.id"
            :can-view-receipt-items="canViewFinanceReceiptItems"
            :customer-id="formData?.customerId"
            :reload-key="settlementTabReloadKey"
          />
        </Tabs.TabPane>
      </Tabs>
    </div>
    <SaleOutItemSelectModal
      v-model:open="selectModalOpen"
      :customer-id="currentCustomerId"
      :hidden-fields="hiddenFields"
      :sale-out-id="currentSaleOutId"
      :main-dept-id="formData?.deptId"
      @select="handleItemsSelected"
    />
    <ImportFormModal @success="handleImportSuccess" />
    <template #cancelText>
      {{ formType === 'detail' ? '关闭' : '取消' }}
    </template>
    <template v-if="!reportViewOnly" #center-footer>
      <Button
        v-if="canGenerateDraft"
        :loading="draftSaving"
        @click="handleGenerateDraft"
      >
        {{ generateDraftButtonText }}
      </Button>
    </template>
    <template v-if="!reportViewOnly" #prepend-footer>
      <Button
        v-if="canEditRemark"
        :disabled="detailEditLoading"
        type="primary"
        @click="handleEditRemark"
      >
        修改备注
      </Button>
      <Button
        v-if="canPrintFromDetail"
        :disabled="detailEditLoading"
        :title="printSortTitle"
        @click="handleDetailPrint"
      >
        打印
      </Button>
      <Button
        v-if="canSubmitDraftFromDetail"
        :disabled="detailEditLoading"
        type="primary"
        @click="handleSubmitDraftFromDetail"
      >
        提交
      </Button>
      <Button
        v-if="canEditFromDetail"
        :disabled="detailEditLoading"
        :loading="detailEditLoading"
        type="primary"
        @click="handleEditFromDetail"
      >
        编辑
      </Button>
      <Button
        v-if="formType === 'detail' && formData.id"
        :disabled="detailEditLoading"
        @click="handleCopy"
      >
        复制
      </Button>
      <Button
        v-if="canApprove"
        :disabled="detailEditLoading"
        type="primary"
        @click="handleUpdateStatus(20)"
      >
        审核
      </Button>
    </template>
  </Modal>
  <RemarkModal @success="handleRemarkSuccess" />
  <CustomerDetailModal />
  <SaleOutDetailModal v-if="shouldRenderSaleOutDetail" />
</template>

<style scoped>
.sale-price-adjust-detail-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.sale-price-adjust-detail-title__text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.sale-price-adjust-detail-title__text > span {
  line-height: 1.25;
}

.sale-price-adjust-detail-title__text small {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-price-adjust-status {
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

.sale-price-adjust-status::before {
  width: 6px;
  height: 6px;
  background: currentcolor;
  border-radius: 50%;
  content: '';
}

.sale-price-adjust-status.is-pending {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 10%);
}

.sale-price-adjust-status.is-draft {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
  border-color: hsl(var(--primary) / 25%);
}

.sale-price-adjust-status.is-success {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
}

.sale-price-adjust-status.is-muted {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
}

.sale-price-adjust-detail-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: hsl(var(--muted) / 28%);
  font-size: 12px;
}

.sale-price-adjust-detail-load-state {
  display: flex;
  min-height: 72px;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.sale-price-adjust-detail-load-state.is-error {
  color: hsl(var(--destructive));
}

.sale-price-adjust-detail-section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.sale-price-adjust-detail-section__header {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.sale-price-adjust-detail-section__title {
  position: relative;
  padding-left: 10px;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
}

.sale-price-adjust-detail-section__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  background: hsl(var(--primary));
  border-radius: 3px;
  content: '';
}

.sale-price-adjust-detail-count {
  padding: 2px 8px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
}

.sale-price-adjust-detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px 12px;
  padding: 12px;
}

.sale-price-adjust-detail-field {
  display: grid;
  min-width: 0;
  align-items: center;
  grid-template-columns: 82px minmax(0, 1fr);
}

.sale-price-adjust-detail-field__label {
  min-width: 0;
  padding-right: 10px;
  color: hsl(var(--muted-foreground));
  line-height: 1.2;
  text-align: left;
  white-space: nowrap;
}

.sale-price-adjust-detail-field__value {
  display: flex;
  min-width: 0;
  height: 32px;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  overflow: hidden;
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 48%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  line-height: 1.4;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-price-adjust-detail-field__value > span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-price-adjust-detail-field__value > span:last-child {
  margin-left: auto;
}

.sale-price-adjust-detail-field__link {
  width: 100%;
  color: hsl(var(--primary));
  cursor: pointer;
}

.sale-price-adjust-detail-field__link:hover {
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary) / 55%);
}

.sale-price-adjust-edit-form :deep(.sale-price-adjust-basic-grid) {
  gap: 0 12px;
  padding: 12px;
}

.sale-price-adjust-edit-form :deep(.sale-price-adjust-basic-grid > div) {
  min-width: 0;
}

.sale-price-adjust-edit-form
  :deep(.sale-price-adjust-basic-grid > div > label) {
  margin-right: 0;
  padding-right: 10px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  white-space: nowrap;
}

.sale-price-adjust-edit-form {
  font-size: 12px;
}

.sale-price-adjust-edit-form :deep(.ant-input),
.sale-price-adjust-edit-form :deep(.ant-picker),
.sale-price-adjust-edit-form :deep(.ant-select-selector),
.sale-price-adjust-edit-form :deep(.ant-tree-select .ant-select-selector),
.sale-price-adjust-edit-form :deep(.ant-input-number),
.sale-price-adjust-edit-form :deep(textarea) {
  min-height: 32px;
  background: hsl(var(--muted) / 48%) !important;
  border-color: hsl(var(--border)) !important;
  border-radius: 6px !important;
  font-size: 12px;
}

.sale-price-adjust-edit-form :deep(.ant-input),
.sale-price-adjust-edit-form :deep(.ant-picker-input > input),
.sale-price-adjust-edit-form :deep(.ant-select-selection-item),
.sale-price-adjust-edit-form :deep(.ant-select-selection-placeholder),
.sale-price-adjust-edit-form :deep(.ant-input-number-input) {
  font-size: 12px;
}

.sale-price-adjust-edit-form :deep(.ant-input),
.sale-price-adjust-edit-form :deep(.ant-picker),
.sale-price-adjust-edit-form :deep(.ant-input-number) {
  height: 32px;
}

.sale-price-adjust-edit-form :deep(.ant-select-single) {
  height: 32px;
}

.sale-price-adjust-edit-form :deep(textarea) {
  min-height: 32px !important;
  resize: none;
  white-space: nowrap;
}

.sale-price-adjust-edit-form--editable :deep(.ant-input:not(:disabled)),
.sale-price-adjust-edit-form--editable
  :deep(.ant-picker:not(.ant-picker-disabled)),
.sale-price-adjust-edit-form--editable
  :deep(.ant-select:not(.ant-select-disabled) .ant-select-selector),
.sale-price-adjust-edit-form--editable
  :deep(.ant-input-number:not(.ant-input-number-disabled)),
.sale-price-adjust-edit-form--editable :deep(textarea:not(:disabled)) {
  background: hsl(var(--background)) !important;
}

.sale-price-adjust-edit-form--editable :deep(.ant-input:disabled),
.sale-price-adjust-edit-form--editable :deep(.ant-picker-disabled),
.sale-price-adjust-edit-form--editable
  :deep(.ant-select-disabled .ant-select-selector),
.sale-price-adjust-edit-form--editable :deep(.ant-input-number-disabled),
.sale-price-adjust-edit-form--editable :deep(textarea:disabled) {
  color: hsl(var(--muted-foreground)) !important;
  background: hsl(var(--muted-foreground) / 14%) !important;
  border-color: hsl(var(--muted-foreground) / 28%) !important;
}

.sale-price-adjust-detail-receivable {
  padding: 0 12px 12px;
}

.sale-price-adjust-detail-receivable :deep(> div) {
  background: hsl(var(--primary) / 7%);
  border-color: hsl(var(--primary) / 20%);
}

.sale-price-adjust-detail-items {
  padding: 10px 10px 0;
}

.sale-price-adjust-detail-items :deep(.vxe-table) {
  font-size: 11px;
}

.sale-price-adjust-detail-items :deep(.vxe-header--column .vxe-cell),
.sale-price-adjust-detail-items :deep(.vxe-body--column .vxe-cell) {
  overflow: hidden;
  padding-right: 4px;
  padding-left: 4px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-price-adjust-detail-items :deep(.vxe-header--column .vxe-cell) {
  white-space: nowrap;
}

.sale-price-adjust-detail-items :deep(.vxe-body--column) {
  white-space: nowrap;
}

.sale-price-adjust-detail-items :deep(.ant-input),
.sale-price-adjust-detail-items :deep(.ant-input-number-input) {
  white-space: nowrap;
}

.sale-price-adjust-document-summary {
  display: flex;
  min-height: 44px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px 20px;
  padding: 8px 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 20%);
  border-top: 1px solid hsl(var(--border));
}

.sale-price-adjust-document-summary strong {
  margin-right: auto;
  color: hsl(var(--foreground));
}

.sale-price-adjust-document-summary b {
  margin-left: 5px;
  color: hsl(var(--foreground));
  font-variant-numeric: tabular-nums;
}

.sale-price-adjust-document-summary__source a {
  margin-left: 5px;
  color: hsl(var(--primary));
  cursor: pointer;
}

.sale-price-adjust-document-summary__difference b {
  color: hsl(var(--success));
}

.sale-price-adjust-detail-audit :deep(.erp-audit-info) {
  padding: 12px;
  font-size: 12px;
}

.sale-price-adjust-detail-audit :deep(.erp-audit-info .text-sm) {
  font-size: 12px;
}

.sale-price-adjust-detail-audit :deep(.erp-audit-info > div:first-child) {
  display: none;
}

:global(.sale-price-adjust-form-select-dropdown .ant-select-item),
:global(.sale-price-adjust-form-select-dropdown .ant-select-tree),
:global(.sale-price-adjust-form-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

@media (max-width: 1200px) {
  .sale-price-adjust-detail-grid,
  .sale-price-adjust-edit-form :deep(.sale-price-adjust-basic-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .sale-price-adjust-detail-view {
    padding: 8px;
  }

  .sale-price-adjust-detail-grid,
  .sale-price-adjust-edit-form :deep(.sale-price-adjust-basic-grid) {
    grid-template-columns: minmax(0, 1fr);
  }

  .sale-price-adjust-detail-section__header {
    align-items: flex-start;
    flex-direction: column;
    justify-content: center;
    padding-top: 8px;
    padding-bottom: 8px;
  }

  .sale-price-adjust-document-summary {
    align-items: flex-start;
    flex-direction: column;
  }

  .sale-price-adjust-document-summary strong {
    margin-right: 0;
  }
}

:deep(.flex-auto.overflow-hidden:has(> .relative > .erp-detail-link-field)) {
  overflow: visible;
}
</style>
