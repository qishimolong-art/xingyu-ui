<script lang="ts" setup>
import { CANDIDATE_FOCUS_KEY } from '#/views/erp/utils/candidate-focus';

import type { ErpSaleOutApi } from '#/api/erp/sale/out';
import type {
  ErpSaleReturnApi,
  SaleReturnImportResp,
} from '#/api/erp/sale/return';

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
import { useUserStore } from '@vben/stores';


import { Modal as AntdModal, Button, message, Tabs } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { formatSaleDecimal,
  formatSaleAmount,
  saleDecimalAdd,
  saleDecimalDivide,
  saleDecimalMultiply,
  saleDecimalSubtract,
} from '#/views/erp/sale/utils/decimal';
import { getCustomerSalePriceLevel } from '#/api/erp/sale/customer';
import { getReturnableItemsByOutId, getSaleOut } from '#/api/erp/sale/out';
import {
  cancelConfirmSaleReturn,
  confirmSaleReturn,
  createSaleReturn,
  createSaleReturnDraft,
  exportSaleReturnImportTemplate,
  getSaleReturn,
  getSaleReturnCustomerDeptSimplePage,
  getSaleReturnEditItemPage,
  getSaleReturnItemPage,
  importSaleReturn,
  matchSaleReturnItems,
  submitSaleReturn,
  updateSaleReturn,
  updateSaleReturnDraft,
} from '#/api/erp/sale/return';
import {
  applyFieldPermission,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import { replaceDetailFieldWithLinkSlot } from '#/views/erp/components/detail-link-schema';
import DetailLinkInput from '#/views/erp/components/DetailLinkInput.vue';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import { useReportViewOnly } from '#/views/erp/report/components/report-view-only';
import { applyFieldConfig } from '#/views/erp/composables/useFieldConfig';
import CustomerReceivableSummary from '#/views/erp/sale/components/CustomerReceivableSummary.vue';
import SaleDetailImportModal from '#/views/erp/sale/components/sale-detail-import-modal.vue';
import SaleDocumentRemarkForm from '#/views/erp/sale/components/SaleDocumentRemarkForm.vue';
import { buildSaleCopyDraft } from '#/views/erp/sale/utils/copy-draft';
import {
  createSaleItemClientRowKeyManager,
  stripSaleItemClientFields,
} from '#/views/erp/sale/utils/item-row-key';
import {
  buildSaleDocumentDetailFormValues,
  hydrateCurrentSaleFormSelectNames,
  hydrateSaleCustomerFromFallback,
  withCurrentSaleFormSelectOptions,
  withSaleCustomerFromSource,
} from '#/views/erp/sale/utils/document-form';
import { hasValidSaleDraftItems } from '#/views/erp/sale/utils/draft-items';
import { getCurrentTimestamp } from '#/views/erp/sale/utils/form-defaults';
import { toOptionalNumberValue } from '#/views/erp/sale/utils/text-number';
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

import { useFormSchema } from '../data';
import ItemForm from './item-form.vue';
import CurrentCostReview from './current-cost-review.vue';
import RefundWriteOffTab from './refund-writeoff-tab.vue';
import SaleOutSelect from './sale-out-select.vue';
import SaleReturnableItemSelectModal from './sale-returnable-item-select-modal.vue';
import SaleReturnPurchaseReturnForm from './sale-return-purchase-return-form.vue';
import SaleReturnTransferOutForm from './sale-return-transfer-out-form.vue';

import '#/views/erp/styles/form-focus.css';

provide(CANDIDATE_FOCUS_KEY, ref(true));

const emit = defineEmits(['success', 'print']);
const reportViewOnly = useReportViewOnly();
const FIELD_PERMISSION_MODULE = 'erp_sale_return';
const DEFAULT_ITEM_PAGE_SIZE = 10;
const DETAIL_TAB_KEY = 'detail';
const REFUND_TAB_KEY = 'refund';
const userStore = useUserStore();
const { hasAccessByCodes } = useAccess();
const currentCostReview = ref<InstanceType<typeof CurrentCostReview>>();
const basicFormRef = ref<HTMLElement | null>(null);
const canPreviewCurrentCost = computed(
  () =>
    hasAccessByCodes(['erp:sale-return-current-cost:query']) ||
    hasAccessByCodes(['erp:sale-return:confirm']) ||
    hasAccessByCodes(['erp:sale-return:update-status']),
);
const currentCustomerPriceLevel = ref<number | undefined>();
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
  { customerPriceLevel: currentCustomerPriceLevel },
);
let isLoadingFormData = false;
const detailLoading = ref(false);
const detailLoadError = ref('');
const editLoadError = ref('');
const itemPageLoading = ref(false);
let itemPageLoadSequence = 0;
let itemMutationSequence = 0;
let remotePersistedItemTotal = 0;
let remotePersistedItemTotalKnown = false;
const detailActiveTab = ref(DETAIL_TAB_KEY);
const refundTabReloadKey = ref(0);
const itemPageState = ref({
  orderDirection: undefined as 'asc' | 'desc' | undefined,
  orderField: undefined as string | undefined,
  pageNo: 1,
  pageSize: DEFAULT_ITEM_PAGE_SIZE,
  total: 0,
});
let formLoadSequence = 0;
let skipDraftOnClose = false;
let draftSaved = false;
let draftSaving = false;

function isDetailPriceFieldHidden(fieldName: string) {
  void fieldName;
  return false;
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
  }
}

function formatDetailPriceAmount(fieldName: string, value?: number) {
  return isDetailPriceFieldHidden(fieldName)
    ? '****'
    : formatSaleAmount(value);
}

function getDetailLoadErrorMessage(error: unknown) {
  const fallback = reportViewOnly
    ? '单据已删除、不可用或无权访问，请关闭后重试'
    : error instanceof Error && error.message
      ? `销售退货详情加载失败：${error.message}`
      : '销售退货详情加载失败，请稍后重试';
  return getErpDetailLoadError(error, fallback);
}

const formData = ref<
  ErpSaleReturnApi.SaleReturn & {
    accountId?: number;
    customerId?: number;
    discountPercent?: number;
    fileUrl?: string;
    returnMode?: number;
    sourceOutId?: number;
    sourceOutNo?: string;
  }
>({
  id: undefined,
  no: undefined,
  accountId: undefined,
  returnTime: undefined,
  remark: undefined,
  fileUrl: undefined,
  returnMode: 10,
  discountPercent: 0,
  customerId: undefined,
  discountPrice: 0,
  deptId: undefined,
  totalPrice: 0,
  feeAmount: 0,
  otherPrice: 0,
  items: [],
});
type SelectedReturnableRows = Array<{
  count: number;
  itemRow: ErpSaleOutApi.SaleReturnableItem;
}>;

const formType = ref('');
const isSaleReturnFormOpen = ref(false);
watch(
  () => formData.value?.customerId,
  (customerId) => {
    void loadCustomerPriceLevel(customerId);
  },
);
const canOpenCustomerDetail = computed(() =>
  Boolean(formData.value?.customerId && formData.value?.customerName),
);
const canOpenSourceOutDetail = computed(() =>
  Boolean(formData.value?.sourceOutId && formData.value?.sourceOutNo),
);
const itemFormRef = ref<InstanceType<typeof ItemForm>>();
const transferOutFormRef =
  ref<InstanceType<typeof SaleReturnTransferOutForm>>();
const returnableItemSelectRef =
  ref<InstanceType<typeof SaleReturnableItemSelectModal>>();
const purchaseReturnFormRef =
  ref<InstanceType<typeof SaleReturnPurchaseReturnForm>>();
const saleDeptOptions = ref<any[]>([]);
const isRemoteItemPaging = computed(
  () =>
    Boolean(formData.value?.id) && ['detail', 'edit'].includes(formType.value),
);
const remoteItemEdits = new Map<number, ErpSaleReturnApi.SaleReturnItem>();
const remoteItemDeletes = new Set<number>();
const itemRowKeyManager = createSaleItemClientRowKeyManager('sale-return-item');
const remoteItemCreates = new Map<string, ErpSaleReturnApi.SaleReturnItem>();
const remoteItemOriginals = new Map<number, ErpSaleReturnApi.SaleReturnItem>();
const REMOTE_ITEM_COMPARE_IGNORED_FIELDS = new Set([
  'clientRowKey',
  'operation',
  'seq',
  'productCode',
  'productName',
  'productBarCode',
  'productUnitName',
  'warehouseName',
  'warehouseDeptId',
  'warehouseDeptName',
  'deptName',
  'stockCount',
  'outCount',
  'returnCount',
  'returnableCount',
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
  'totalProductPrice',
  'totalPrice',
  'taxPrice',
  'totalTaxPrice',
]);
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

function handleOpenCustomerDetail() {
  if (!formData.value.customerId) return;
  customerDetailModalApi.setData({ id: formData.value.customerId }).open();
}

async function handleOpenSourceOutDetail() {
  if (!formData.value.sourceOutId) return;
  await ensureModalReady(
    shouldRenderSaleOutDetail,
    saleOutDetailModalApi,
    loadSaleOutDetail,
  );
  saleOutDetailModalApi
    .setData({ type: 'detail', id: formData.value.sourceOutId })
    .open();
}
let saleDeptLoadSeq = 0;

const [ImportFormModal, importFormModalApi] = useVbenModal({
  connectedComponent: SaleDetailImportModal,
});

const getTitle = computed(() => {
  if (formType.value === 'create') {
    return $t('ui.actionTitle.create', ['销售退货']);
  } else if (formType.value === 'edit') {
    return $t('ui.actionTitle.edit', ['销售退货']);
  } else {
    return '销售退货详情';
  }
});

const canOrderConfirm = computed(
  () =>
    formType.value === 'detail' &&
    formData.value?.status === 10 &&
    hasAccessByCodes(['erp:sale-return:confirm']),
);
const canCancelOrderConfirm = computed(
  () =>
    formType.value === 'detail' &&
    formData.value?.status === 15 &&
    Number(formData.value?.pickedItemCount || 0) === 0 &&
    hasAccessByCodes(['erp:sale-return:cancel-confirm']),
);
const isEditingDraft = computed(
  () => formType.value === 'edit' && formData.value?.status === 0,
);
const canGenerateDraft = computed(
  () => formType.value === 'create' || isEditingDraft.value,
);
const generateDraftButtonText = computed(() =>
  isEditingDraft.value ? '保存草稿' : '生成草稿',
);
const canSubmitDraft = computed(
  () =>
    formType.value === 'detail' &&
    formData.value?.status === 0 &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:sale-return:update-status']),
);
const canEditFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    [0, 10].includes(Number(formData.value?.status)) &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:sale-return:update']),
);
const canBatchUpdateItems = computed(() => {
  if (formType.value !== 'detail') {
    return hasAccessByCodes([
      formData.value?.id ? 'erp:sale-return:update' : 'erp:sale-return:create',
    ]);
  }
  return (
    !!formData.value?.id &&
    [0, 10].includes(Number(formData.value?.status)) &&
    hasAccessByCodes(['erp:sale-return:update'])
  );
});
const canConfirmForm = computed(() => {
  if (formType.value === 'detail' || editLoadError.value) {
    return false;
  }
  return (
    !isEditingDraft.value || hasAccessByCodes(['erp:sale-return:update-status'])
  );
});
const confirmText = computed(() =>
  isEditingDraft.value ? '确认提交' : '确定',
);
function canFocusBasicForm() {
  return canConfirmForm.value && !detailLoading.value && !detailLoadError.value;
}

function getDetailStatusText() {
  const status = Number(formData.value?.status);
  if (status === 0) return '草稿';
  if (status === 10) return '待下单确认';
  if (status === 15)
    return formData.value?.pickStatus === 20 ? '部分拣货' : '待拣货';
  if (status === 20) return '已审批';
  return '-';
}

function getDetailConfirmTimeText() {
  if (!formData.value?.confirmTime) return '-';
  const value = new Date(formData.value.confirmTime);
  return Number.isNaN(value.getTime())
    ? String(formData.value.confirmTime)
    : value.toLocaleString('zh-CN');
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

async function queueFocusFirstBasicFormControl(sequence = formLoadSequence) {
  await nextTick();
  if (sequence !== formLoadSequence || !canFocusBasicForm()) {
    return;
  }
  queueAfterEditableControlRender(() => {
    if (sequence === formLoadSequence) {
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
    hasAccessByCodes(['erp:sale-return:update']),
);
const canPrintFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:sale-return:print']),
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
const canViewFinanceReceiptItems = computed(() =>
  hasAccessByCodes(['erp:finance-receipt:query']),
);
const canCreateTransferOut = computed(
  () =>
    formType.value === 'detail' &&
    Number(formData.value?.status) === 20 &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:sale-return:transfer-out']),
);
const canCreatePurchaseReturn = computed(
  () =>
    formType.value === 'detail' &&
    Number(formData.value?.status) === 20 &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:sale-return:purchase-return']),
);

function handleEditRemark() {
  if (!formData.value?.id) return;
  remarkModalApi
    .setData({
      documentName: '销售退货',
      documentType: 'sale-return',
      id: formData.value.id,
      no: formData.value.no,
      remark: formData.value.remark,
    })
    .open();
}

function handleOpenTransferOut() {
  transferOutFormRef.value?.open({ sourceSaleReturn: formData.value });
}

function handleOpenPurchaseReturn() {
  purchaseReturnFormRef.value?.open({ sourceSaleReturn: formData.value });
}

async function handleRemarkSuccess(remark: string) {
  formData.value.remark = remark;
  await formApi.setValues({ remark });
  emit('success');
}

const documentSummary = computed(() => {
  const itemSummary = buildRemoteDocumentSummary({
    base: {
      totalCount: Number(formData.value.totalCount ?? 0),
      totalProductPrice: Number(formData.value.totalProductPrice ?? 0),
    },
    calculate: (item: ErpSaleReturnApi.SaleReturnItem) => ({
      totalCount: Number(item.count ?? 0),
      totalProductPrice: Number(
        item.totalProductPrice ??
          item.totalPrice ??
          saleDecimalMultiply(
            Number(item.productPrice ?? 0),
            Number(item.count ?? 0),
          ) ??
          0,
      ),
    }),
    creates: remoteItemCreates,
    deletes: remoteItemDeletes,
    edits: remoteItemEdits,
    localItems: formData.value.items ?? [],
    originals: remoteItemOriginals,
    remotePaging: isRemoteItemPaging.value,
  });
  const totalCount = itemSummary.totalCount ?? 0;
  const totalProductPrice = itemSummary.totalProductPrice ?? 0;
  const discountPrice = Number(
    saleDecimalMultiply(
      totalProductPrice,
      saleDecimalDivide(formData.value.discountPercent ?? 0, 100),
    ) ?? 0,
  );
  const feeAmount = Number(
    formData.value.feeAmount ?? formData.value.otherPrice ?? 0,
  );
  return {
    discountPrice,
    feeAmount,
    totalCount,
    totalPrice: saleDecimalAdd(
      saleDecimalSubtract(totalProductPrice, discountPrice),
      feeAmount,
    ),
    totalProductPrice,
  };
});

const EMBEDDED_SECTION_FIELDS = new Set(['customerReceivableInfo', 'items']);

/** 基本信息只保留四列表单字段，应收信息和产品明细由独立区块渲染。 */
function buildBasicFormSchema(schema: ReturnType<typeof useFormSchema>) {
  return schema.filter((item) => !EMBEDDED_SECTION_FIELDS.has(item.fieldName));
}

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    labelWidth: 82,
  },
  wrapperClass: 'grid-cols-4 sale-return-basic-grid',
  layout: 'horizontal',
  schema: buildBasicFormSchema(
    useFormSchema(formType.value, hiddenFields.value),
  ),
  showDefaultActions: false,
  handleValuesChange: (values, changedFields) => {
    if (isLoadingFormData) return;
    if (formData.value) {
      if (changedFields.includes('customerId')) {
        formData.value.customerId = values.customerId;
        // 仅按库存退货（手动选客户+部门）时才需要按客户过滤部门下拉；
        // 按销售退货时 deptId 由源单带出，见 handleUpdateSaleOut
        if (formData.value.returnMode === 20) {
          void loadSaleDeptOptions(values.customerId);
        }
      }
      if (changedFields.includes('deptId')) {
        formData.value.deptId = values.deptId;
      }
      if (changedFields.includes('feeAmount')) {
        const feeAmount = toOptionalNumberValue(values.feeAmount) ?? 0;
        formData.value.feeAmount = feeAmount;
        formData.value.otherPrice = feeAmount;
      }
      if (changedFields.includes('discountPercent')) {
        formData.value.discountPercent = toOptionalNumberValue(
          values.discountPercent,
        );
      }
      if (changedFields.includes('returnMode')) {
        formData.value.returnMode = values.returnMode;
        formData.value.sourceOutId = undefined;
        formData.value.sourceOutNo = undefined;
        formData.value.items = [];
        formApi.setValues({
          sourceOutId: undefined,
          sourceOutNo: undefined,
          items: [],
        });
        if (values.returnMode === 20) {
          void loadSaleDeptOptions(formData.value.customerId);
        }
      }
    }
  },
});

function keepReturnModeVisible(
  schema: ReturnType<typeof useFormSchema>,
  type: string,
) {
  if (schema.some((item) => item.fieldName === 'returnMode')) {
    return schema;
  }
  const returnModeSchema = useFormSchema(type).find(
    (item) => item.fieldName === 'returnMode',
  );
  if (!returnModeSchema) {
    return schema;
  }
  const insertIndex = schema.findIndex(
    (item) => item.fieldName === 'sourceOutNo',
  );
  if (insertIndex === -1) {
    return [...schema, returnModeSchema];
  }
  return [
    ...schema.slice(0, insertIndex),
    returnModeSchema,
    ...schema.slice(insertIndex),
  ];
}

async function refreshSaleReturnFormSchema(
  customerData: ErpSaleReturnApi.SaleReturn | undefined = formData.value,
) {
  const hydratedCustomerData =
    await hydrateCurrentSaleFormSelectNames(customerData);
  const baseSchema = useFormSchema(
    formType.value,
    hiddenFields.value,
    saleDeptOptions.value,
  );
  const configuredSchema = await applyFieldConfig(baseSchema, 'sale_return');
  formApi.setState({
    schema: buildBasicFormSchema(
      withCurrentSaleFormSelectOptions(
        replaceDetailFieldWithLinkSlot(
          applyFieldPermission(
            keepReturnModeVisible(configuredSchema, formType.value),
            hiddenFields.value,
          ),
          formType.value,
          'customerId',
          'customerDetail',
        ),
        hydratedCustomerData,
        formType.value,
      ),
    ),
  });
}

async function applySaleReturnFormMode(
  type: string,
  customerData: ErpSaleReturnApi.SaleReturn | undefined = formData.value,
) {
  formType.value = type;
  formApi.setDisabled(type === 'detail');
  await refreshSaleReturnFormSchema(customerData);
  await nextTick();
}

type SaleDeptFieldRef = {
  updateParam?: (newParams: Record<string, any>) => void;
};

function updateDeptFieldCustomerParam(customerId?: number) {
  formApi
    .getFieldComponentRef<SaleDeptFieldRef>('deptId')
    ?.updateParam?.(customerId ? { customerId } : {});
}

/**
 * 按客户分页加载可选部门。
 * 仅用于按库存退货模式；按销售退货时 deptId 直接从源销售单带出，不受当前登录人部门数据权限影响。
 */
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
  const page = await getSaleReturnCustomerDeptSimplePage({
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
  const currentUserDeptId = userStore.userInfo?.deptId;
  const deptId =
    saleDeptOptions.value.find((dept) => dept.id === preferredDeptId)?.id ??
    saleDeptOptions.value.find((dept) => dept.id === formData.value?.deptId)
      ?.id ??
    saleDeptOptions.value.find((dept) => dept.id === currentUserDeptId)?.id ??
    saleDeptOptions.value[0]?.id;
  if (formData.value) {
    formData.value.deptId = deptId;
  }
  await formApi.setValues({ deptId });
}

function buildSaleReturnCopyData() {
  const sourceItems = formData.value.items ?? [];
  const copyData = buildSaleCopyDraft(formData.value, {
    extraCleanKeys: [
      'returnTime',
      'approveBy',
      'approveTime',
      'auditBy',
      'auditTime',
      'checkBy',
      'checkTime',
      'stockRecordId',
      'stockRecordNo',
      'stockFlowId',
      'stockFlowNo',
      'stockExecutionId',
      'stockExecutionNo',
      'voucherId',
      'voucherNo',
      'settlementId',
      'settlementNo',
      'settleId',
      'settleNo',
      'refundId',
      'refundNo',
      'refundStatus',
      'refundPrice',
      'paymentId',
      'paymentNo',
    ],
    extraItemCleanKeys: [
      'stockRecordId',
      'stockRecordItemId',
      'stockFlowId',
      'stockFlowItemId',
      'stockExecutionId',
      'stockExecutionItemId',
      'executionId',
      'executionItemId',
      'voucherId',
      'voucherItemId',
      'settlementId',
      'settlementItemId',
      'settleId',
      'settleItemId',
      'refundId',
      'refundItemId',
    ],
  }) as ErpSaleReturnApi.SaleReturn & Record<string, any>;
  copyData.returnTime = getCurrentTimestamp() as any;
  copyData.items = (copyData.items ?? []).map((item, index) => ({
    ...item,
    id: undefined,
    outId: (sourceItems[index] as any)?.outId,
    sourceOutId: (sourceItems[index] as any)?.sourceOutId,
    sourceOutItemId: sourceItems[index]?.sourceOutItemId,
    seq: item.seq ?? index + 1,
  }));
  return copyData;
}

async function handleCopy() {
  if (!formData.value?.id) return;
  const copyData = buildSaleReturnCopyData();
  modalApi.lock();
  isLoadingFormData = true;
  try {
    await applySaleReturnFormMode('create');
    formData.value = copyData as any;
    await loadSaleDeptOptions(copyData.customerId, copyData.deptId);
    copyData.deptId = formData.value.deptId;
    await formApi.setValues(copyData, false);
    await nextTick();
  } finally {
    isLoadingFormData = false;
    modalApi.unlock();
    const sequence = ++formLoadSequence;
    void queueFocusFirstBasicFormControl(sequence);
  }
}

function handleImport() {
  importFormModalApi
    .setData({
      title: '导入销售退货明细',
      templateFileName: '销售退货导入模板.xls',
      importRequest: importSaleReturn,
      exportTemplateRequest: exportSaleReturnImportTemplate,
      templateGuideSummary:
        '销售退货明细导入模板用于解析当前退货单明细，上传后系统会按产品、仓库、数量、价格等字段回填到当前表单。',
      templateGuideTips: [
        '配件编码、配件名称、厂家编码是三选一字段：填写其中任意一个即可；如果多列都填，必须对应同一配件；仓库需能匹配到系统中已启用的资料。',
        '退货数量、退货单价、退货原因等明细字段请按模板示例填写。',
      ],
    })
    .open();
}

function handleImportSuccess(data: SaleReturnImportResp) {
  resetRemoteItemState();
  const totalCount = calculateTotalCount(data.items ?? []);
  const importValues = {
    items: data.items ?? [],
    returnMode: data.returnMode ?? 20,
    totalCount,
  } as ErpSaleReturnApi.SaleReturn;
  formData.value = {
    ...formData.value,
    ...importValues,
  };
  formApi.setValues(importValues, false);
}

function calculateTotalCount(items: ErpSaleReturnApi.SaleReturnItem[] = []) {
  return items.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
}

async function handleUpdateItems(items: ErpSaleReturnApi.SaleReturnItem[]) {
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
    formData.value.items = isRemoteItemPaging.value
      ? applyRemoteItemCache(items.filter((item) => Boolean(item.id)))
      : items;
    if (!isRemoteItemPaging.value) {
      const totalCount = calculateTotalCount(items);
      formData.value.totalCount = totalCount;
      formApi.setValues({ items, totalCount });
      return;
    }
    formApi.setValues({ items: formData.value.items });
    const addedCreateKeys = [...remoteItemCreates.keys()].filter(
      (key) => !previousCreateKeys.has(key),
    );
    const replacedBlankCreateKey = [...previousCreateKeys].find(
      (key) =>
        !snapshot.creates.get(key)?.productId &&
        Boolean(remoteItemCreates.get(key)?.productId),
    );
    if (formData.value.returnMode === 20) {
      const localBusinessKeys = new Set<string>();
      let localDuplicateCount = 0;
      [...remoteItemCreates.entries()].forEach(([localKey, item]) => {
        if (!item.productId) return;
        const businessKey = [
          item.productId,
          item.warehouseId ?? '',
          item.batchNo?.trim() ?? '',
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
    }
    const matchCandidates =
      formData.value.returnMode === 20
        ? addedCreateKeys
            .map((key) => [key, remoteItemCreates.get(key)] as const)
            .filter(
              (
                entry,
              ): entry is readonly [string, ErpSaleReturnApi.SaleReturnItem] =>
                Boolean(entry[1]?.productId),
            )
        : [];
    let firstMatchedItemId: number | undefined;
    let firstMatchedPageNo: number | undefined;
    if (matchCandidates.length > 0 && formData.value.id) {
      const matchResult = await matchSaleReturnItems({
        documentId: formData.value.id,
        excludedItemIds: [...remoteItemDeletes],
        keys: matchCandidates.map(([, item]) => ({
          batchNo: item.batchNo,
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
      await loadSaleReturnItemPage({
        orderDirection: undefined,
        orderField: undefined,
        pageNo: snapshot.pageState.pageNo,
      });
      await focusRemoteItemByKey(replacedBlankCreateKey, 'count');
    } else if (firstRemainingAddedKey) {
      await loadSaleReturnItemPage({
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
      await loadSaleReturnItemPage({
        orderDirection: undefined,
        orderField: undefined,
        pageNo: firstMatchedPageNo,
      });
      await focusRemoteItemByKey(
        itemRowKeyManager.ensureRowKey({ id: firstMatchedItemId }),
      );
    } else if (remoteItemDeletes.size > previousDeleteCount) {
      await loadSaleReturnItemPage({
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
    formData.value.items = snapshot.items;
    await formApi.setValues({ items: snapshot.items });
    message.error('明细处理失败，已恢复操作前状态，请重试');
  }
}

function handleUpdateFeeAmount(feeAmount: number) {
  if (isRemoteItemPaging.value) {
    return;
  }
  formData.value.feeAmount = feeAmount;
  formData.value.otherPrice = feeAmount;
  formApi.setValues({
    feeAmount,
    otherPrice: feeAmount,
  });
}

function handleUpdateDiscountPrice(discountPrice: number) {
  if (isRemoteItemPaging.value) {
    return;
  }
  formData.value.discountPrice = discountPrice;
  formApi.setValues({
    discountPrice,
  });
}

function handleUpdateTotalPrice(totalPrice: number) {
  if (isRemoteItemPaging.value) {
    return;
  }
  formData.value.totalPrice = totalPrice;
  formApi.setValues({
    totalPrice,
  });
}

async function handleUpdateSaleOut(
  out: ErpSaleOutApi.SaleOut,
  options: { fillReturnableItems?: boolean; openItemSelector?: boolean } = {
    openItemSelector: true,
  },
) {
  resetRemoteItemState();
  const currentValues = await formApi.getValues();
  formData.value = withSaleCustomerFromSource(
    {
      ...formData.value,
      ...currentValues,
      returnMode: 10,
      sourceOutId: out.id,
      sourceOutNo: out.no,
      deptId: out.deptId,
      totalCount: 0,
      items: [],
    },
    out,
  );
  // 按销售退货时部门下拉展示源单部门（可能超出当前登录人的部门数据权限），
  // 复用客户可选部门树以保证下拉能正确显示该部门名称
  await loadSaleDeptOptions(out.customerId, out.deptId);
  formData.value.deptId = out.deptId;
  await refreshSaleReturnFormSchema(formData.value);
  await formApi.setValues(
    buildSaleDocumentDetailFormValues(formData.value, formType.value),
    false,
  );
  if (options.fillReturnableItems) {
    const returnableItems = out.id
      ? await getReturnableItemsByOutId(out.id)
      : [];
    handleSelectReturnableItems(
      returnableItems.map((itemRow) => ({
        itemRow,
        count: Number(itemRow.returnableCount || 0),
      })),
      out,
    );
  } else if (options.openItemSelector ?? true) {
    returnableItemSelectRef.value?.open(out);
  }
  return out;
}

function handleSelectReturnableItems(
  rows: SelectedReturnableRows,
  sourceOut: ErpSaleOutApi.SaleOut,
) {
  const items = rows.map(({ itemRow, count }, index) => ({
    ...itemRow,
    id: undefined,
    seq: index + 1,
    count,
    sourceOutItemId: itemRow.sourceOutItemId,
    orderItemId: undefined,
    productName: itemRow.productName,
    productCode: itemRow.productCode,
    productBarCode: itemRow.productBarCode,
    productUnitName: itemRow.productUnitName,
    weight: itemRow.weight,
    packageQty: itemRow.packageQty,
    warehouseName: itemRow.warehouseName,
    warehouseDeptId: itemRow.warehouseDeptId,
    warehouseDeptName: itemRow.warehouseDeptName,
    deptName: itemRow.deptName,
  })) as ErpSaleReturnApi.SaleReturnItem[];
  if (items.length === 0) {
    message.warning('未选择可退明细');
    return;
  }
  recordRemoteItemChanges(items);
  formData.value = withSaleCustomerFromSource(
    {
      ...formData.value,
      sourceOutId: sourceOut.id,
      sourceOutNo: sourceOut.no,
      deptId: sourceOut.deptId,
      totalCount: calculateTotalCount(items),
      items,
    },
    sourceOut,
  );
  formApi.setValues(
    {
      sourceOutId: sourceOut.id,
      sourceOutNo: sourceOut.no,
      customerId: sourceOut.customerId,
      deptId: sourceOut.deptId,
      totalCount: formData.value.totalCount,
      items,
    },
    false,
  );
}

async function handleOrderConfirm() {
  if (!formData.value?.id) return;
  modalApi.lock();
  try {
    if (formData.value.returnMode === 20) {
      if (!currentCostReview.value)
        throw new Error('成本预览尚未就绪，请稍后重试');
      await currentCostReview.value.prepareOrderConfirm(formData.value.id);
      return;
    }
    await confirmSaleReturn(formData.value.id);
    await handleOrderConfirmed(formData.value.id);
  } finally {
    modalApi.unlock();
  }
}

async function handleCancelOrderConfirm() {
  if (!formData.value?.id) return;
  modalApi.lock();
  try {
    await cancelConfirmSaleReturn(formData.value.id);
    message.success('已撤销下单确认，可继续编辑');
    await reloadSaleReturnDetail();
    emit('success');
  } finally {
    modalApi.unlock();
  }
}

async function handleOrderConfirmed(id: number) {
  emit('success');
  message.success('下单确认成功，已生成拣货任务');
  if (id !== formData.value?.id) return;
  const refreshed = await getSaleReturn(id, { includeItems: false });
  if (id !== formData.value?.id) return;
  formData.value = refreshed;
  formData.value.items = [];
  await formApi.setValues(
    buildSaleDocumentDetailFormValues(formData.value, formType.value),
    false,
  );
  await loadSaleReturnItemPage({ pageNo: itemPageState.value.pageNo });
  refundTabReloadKey.value += 1;
}

async function reloadSaleReturnDetail() {
  if (!formData.value?.id) return;
  formData.value = normalizeLoadedSaleReturn(
    await getSaleReturn(formData.value.id, {
      includeItems: !isRemoteItemPaging.value,
      mask: formType.value === 'detail',
    }),
  );
  if (isRemoteItemPaging.value) {
    formData.value.items = [];
  }
  await formApi.setValues(
    buildSaleDocumentDetailFormValues(formData.value, formType.value),
    false,
  );
  if (isRemoteItemPaging.value) {
    await loadSaleReturnItemPage({ pageNo: itemPageState.value.pageNo });
  }
  refundTabReloadKey.value += 1;
  await nextTick();
  await getItemFormInstance()?.reloadItemsFromProps?.();
}

function normalizeLoadedSaleReturn(sourceData: ErpSaleReturnApi.SaleReturn) {
  sourceData.feeAmount =
    toOptionalNumberValue(sourceData.feeAmount ?? sourceData.otherPrice) ?? 0;
  sourceData.otherPrice = sourceData.feeAmount;
  sourceData.items = Array.isArray(sourceData.items) ? sourceData.items : [];
  return sourceData;
}

function getItemFormInstance() {
  return Array.isArray(itemFormRef.value)
    ? itemFormRef.value[0]
    : itemFormRef.value;
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

function normalizeRemoteItemForCompare(item: ErpSaleReturnApi.SaleReturnItem) {
  const source = item as unknown as Record<string, unknown>;
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
  current: ErpSaleReturnApi.SaleReturnItem,
  original?: ErpSaleReturnApi.SaleReturnItem,
) {
  if (!original) {
    return false;
  }
  return (
    JSON.stringify(normalizeRemoteItemForCompare(current)) ===
    JSON.stringify(normalizeRemoteItemForCompare(original))
  );
}

function rememberRemoteItemOriginals(rows: ErpSaleReturnApi.SaleReturnItem[]) {
  rows.forEach((item) => {
    if (item.id) {
      remoteItemOriginals.set(item.id, { ...item });
    }
  });
}

function getRemoteLocalItemKey(item: ErpSaleReturnApi.SaleReturnItem) {
  return itemRowKeyManager.ensureRowKey(item);
}

function applyRemoteItemCache(rows: ErpSaleReturnApi.SaleReturnItem[] = []) {
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

function recordRemoteItemChanges(rows: ErpSaleReturnApi.SaleReturnItem[]) {
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

async function loadSaleReturnItemPage(
  options: {
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
      excludedItemIds: [...remoteItemDeletes],
      mask: formType.value === 'detail',
      orderDirection: nextState.orderDirection,
      orderField: nextState.orderField,
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
      returnId: formData.value.id,
    };
    const result = await (formType.value === 'edit'
      ? getSaleReturnEditItemPage(request)
      : getSaleReturnItemPage(request));
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

async function buildMergedRemoteItemsForSubmit() {
  if (!isRemoteItemPaging.value || !formData.value?.id) {
    return (
      getItemFormInstance()?.getDraftItems?.() ?? formData.value.items ?? []
    );
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

function handleSubmitDraft() {
  if (!formData.value?.id) return;
  const returnId = formData.value.id;
  const returnNo = formData.value.no;
  AntdModal.confirm({
    title: `确认提交销售退货${returnNo ? ` ${returnNo}` : ''}吗？`,
    content: '提交后将进入待审批状态，不能再按草稿方式修改。',
    async onOk() {
      modalApi.lock();
      try {
        await submitSaleReturn(returnId);
        skipDraftOnClose = true;
        await modalApi.close();
        emit('success');
        message.success('销售退货已提交，下一步可进行审批');
      } finally {
        modalApi.unlock();
      }
    },
  });
}

async function buildCurrentSaleReturnPayload() {
  const formValues = (await formApi.getValues()) as ErpSaleReturnApi.SaleReturn;
  formValues.reductionAmount = toOptionalNumberValue(
    formValues.reductionAmount,
  );
  formValues.freightAmount = toOptionalNumberValue(formValues.freightAmount);
  formValues.discountPercent = toOptionalNumberValue(
    formValues.discountPercent,
  );
  formValues.discountPrice = toOptionalNumberValue(formValues.discountPrice);
  formValues.feeAmount =
    toOptionalNumberValue(formValues.feeAmount ?? formValues.otherPrice) ?? 0;
  formValues.otherPrice = formValues.feeAmount;
  formValues.totalPrice = toOptionalNumberValue(formValues.totalPrice);
  if (formValues.fileUrl && Array.isArray(formValues.fileUrl)) {
    formValues.fileUrl =
      formValues.fileUrl.length > 0 ? formValues.fileUrl[0] : '';
  }
  const data: ErpSaleReturnApi.SaleReturn = {
    ...formData.value,
    ...formValues,
    id: formData.value?.id,
    sourceOutId: formData.value?.sourceOutId,
    sourceOutNo: formData.value?.sourceOutNo,
    returnMode: formData.value?.returnMode ?? formValues.returnMode,
    items: (await buildMergedRemoteItemsForSubmit()).map(
      (item: ErpSaleReturnApi.SaleReturnItem) =>
        stripSaleItemClientFields(item),
    ),
  };
  delete (data as unknown as Record<string, unknown>).customerReceivableInfo;
  return data;
}

async function saveSaleReturnDraft(
  isCreatingDraft: boolean,
  options: { explicit?: boolean } = {},
) {
  if (draftSaving) {
    return false;
  }

  draftSaving = true;
  modalApi.lock();
  try {
    const data = await buildCurrentSaleReturnPayload();
    if (
      isCreatingDraft &&
      !hasValidSaleDraftItems(data.items ?? [], {
        priceMode: 'nonNegative',
        requireSaleOutItem: data.returnMode === 10,
      })
    ) {
      draftSaved = !options.explicit;
      message.warning('未选择明细，不生成草稿');
      return !options.explicit;
    }
    await (isCreatingDraft
      ? createSaleReturnDraft(data)
      : updateSaleReturnDraft(data));
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
  await saveSaleReturnDraft(formType.value === 'create', { explicit: true });
}

async function switchDetailToEdit(initialData?: ErpSaleReturnApi.SaleReturn) {
  if (!initialData?.id) return;
  const returnId = initialData.id;
  const sequence = ++formLoadSequence;
  detailLoading.value = true;
  detailLoadError.value = '';
  editLoadError.value = '';
  skipDraftOnClose = false;
  draftSaved = false;
  draftSaving = false;
  isLoadingFormData = true;
  modalApi.lock();
  try {
    const [sourceData] = await Promise.all([
      getSaleReturn(returnId, { includeItems: false, mask: false }),
      loadHiddenFields(),
    ]);
    if (sequence !== formLoadSequence) return;
    const loadedData = hydrateSaleCustomerFromFallback(
      normalizeLoadedSaleReturn(sourceData),
      initialData,
    );
    loadedData.items = [];
    resetRemoteItemState();
    await applySaleReturnFormMode('edit', loadedData);
    if (sequence !== formLoadSequence) return;
    await formApi.resetForm();
    formData.value = loadedData as any;
    const savedDeptId = formData.value.deptId;
    await loadSaleDeptOptions(formData.value.customerId, savedDeptId);
    if (sequence !== formLoadSequence) return;
    formData.value.deptId = savedDeptId;
    await formApi.setValues(
      buildSaleDocumentDetailFormValues(formData.value, formType.value),
      false,
    );
    await loadSaleReturnItemPage({ pageNo: 1 });
    await nextTick();
    await nextTick();
  } catch {
    if (sequence === formLoadSequence) {
      editLoadError.value = '销售退货草稿加载失败，请关闭页面后重新进入';
    }
  } finally {
    if (sequence === formLoadSequence) {
      isLoadingFormData = false;
      detailLoading.value = false;
      modalApi.unlock();
      void queueFocusFirstBasicFormControl(sequence);
    }
  }
}

async function handleEditFromDetail() {
  if (!canEditFromDetail.value) return;
  await switchDetailToEdit(formData.value);
}

const [Modal, modalApi] = useVbenModal({
  async onBeforeClose() {
    const isCreatingDraft = formType.value === 'create';
    const isUpdatingDraft = isEditingDraft.value && Boolean(formData.value?.id);
    if (
      (!isCreatingDraft && !isUpdatingDraft) ||
      skipDraftOnClose ||
      draftSaved
    ) {
      return true;
    }
    return saveSaleReturnDraft(isCreatingDraft);
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
    let data: ErpSaleReturnApi.SaleReturn;
    try {
      data = await buildCurrentSaleReturnPayload();
      if (
        isRemoteItemPaging.value &&
        formData.value?.id &&
        itemPageState.value.total <= 0
      ) {
        throw new Error('请至少添加一条退货明细');
      }
      itemFormInstance?.validate(
        (data.items ?? []).filter((item) => item.operation !== 'delete'),
        { requireItems: !isRemoteItemPaging.value },
      );
    } catch (error: any) {
      message.error(error.message || '子表单校验失败');
      return;
    }

    modalApi.lock();
    const shouldSubmitDraft = isEditingDraft.value;
    const editingReturnId = formData.value?.id;
    try {
      if (formType.value === 'create') {
        await createSaleReturn(data);
      } else if (shouldSubmitDraft) {
        if (!editingReturnId) {
          message.error('销售退货编号缺失，请关闭后重新打开再试');
          return;
        }
        await updateSaleReturnDraft(data);
        await submitSaleReturn(editingReturnId);
      } else {
        await updateSaleReturn(data);
      }
      skipDraftOnClose = true;
      await modalApi.close();
      emit('success');
      message.success(
        shouldSubmitDraft
          ? '销售退货已提交，下一步可进行审批'
          : $t('ui.actionMessage.operationSuccess'),
      );
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    currentCostReview.value?.close();
    isSaleReturnFormOpen.value = isOpen;
    if (!isOpen) {
      formLoadSequence += 1;
      saleDeptLoadSeq += 1;
      isLoadingFormData = false;
      formData.value = {} as ErpSaleReturnApi.SaleReturn;
      resetRemoteItemState();
      saleDeptOptions.value = [];
      detailLoading.value = false;
      detailLoadError.value = '';
      editLoadError.value = '';
      detailActiveTab.value = DETAIL_TAB_KEY;
      refundTabReloadKey.value += 1;
      return;
    }
    modalApi.setState({ fullscreen: true });
    const data = modalApi.getData<{
      fillReturnableItems?: boolean;
      id?: number;
      importData?: SaleReturnImportResp;
      initialData?: ErpSaleReturnApi.SaleReturn;
      outId?: string;
      saleOutId?: string;
      selectedReturnableRows?: SelectedReturnableRows;
      sourceOutId?: string;
      sourceSaleOut?: ErpSaleOutApi.SaleOut;
      type: string;
    }>();
    skipDraftOnClose = false;
    draftSaved = false;
    draftSaving = false;
    formType.value = data.type;
    detailActiveTab.value = DETAIL_TAB_KEY;
    refundTabReloadKey.value += 1;
    detailLoading.value = data.type === 'detail' && Boolean(data.id);
    detailLoadError.value = '';
    editLoadError.value = '';
    const sequence = ++formLoadSequence;
    modalApi.lock();
    try {
      await loadHiddenFields();
      if (sequence !== formLoadSequence) {
        modalApi.unlock();
        return;
      }
      await applySaleReturnFormMode(data.type, data.initialData);
      if (sequence !== formLoadSequence) {
        modalApi.unlock();
        return;
      }
    } catch (error) {
      detailLoading.value = false;
      if (data.type === 'detail') {
        detailLoadError.value = getDetailLoadErrorMessage(error);
        modalApi.unlock();
        return;
      }
      editLoadError.value = '销售退货加载失败，请关闭页面后重新进入';
      modalApi.unlock();
      return;
    }
    if (!data || !data.id) {
      resetRemoteItemState();
      isLoadingFormData = true;
      try {
        saleDeptOptions.value = [];
        await refreshSaleReturnFormSchema();
        const baseItems = data.importData?.items ?? [];
        formData.value = {
          ...formData.value,
          returnTime: getCurrentTimestamp(),
          returnMode: data.importData?.returnMode ?? 10,
          creatorName: userStore.userInfo?.nickname,
          deptId: undefined,
          discountPercent: 0,
          discountPrice: 0,
          totalPrice: 0,
          totalCount: calculateTotalCount(baseItems),
          feeAmount: 0,
          otherPrice: 0,
          settleMethod: '挂账',
          invoiceType: '收据',
          businessType: '普通销售',
          orderMethod: '正常单',
          deliveryMethod: '客户自提',
          items: baseItems,
        } as any;
        await formApi.setValues(
          buildSaleDocumentDetailFormValues(formData.value, formType.value),
          false,
        );
        await nextTick();
        await nextTick();
        const sourceOutId = data.sourceOutId ?? data.outId ?? data.saleOutId;
        const sourceSaleOut =
          data.sourceSaleOut?.id && data.sourceSaleOut.items?.length
            ? data.sourceSaleOut
            : sourceOutId || data.sourceSaleOut?.id
              ? await getSaleOut(
                  Number(sourceOutId ?? data.sourceSaleOut?.id),
                  {
                    includeItems: false,
                    mask: false,
                  },
                )
              : undefined;
        if (sourceSaleOut) {
          const saleOut = sourceSaleOut;
          if (saleOut) {
            const updatedSaleOut = await handleUpdateSaleOut(saleOut, {
              fillReturnableItems: data.fillReturnableItems,
              openItemSelector:
                !data.selectedReturnableRows?.length &&
                !data.fillReturnableItems,
            });
            if (data.selectedReturnableRows?.length) {
              handleSelectReturnableItems(
                data.selectedReturnableRows,
                updatedSaleOut,
              );
            }
          }
        } else if (
          formData.value.returnMode === 20 &&
          formData.value.customerId
        ) {
          await loadSaleDeptOptions(formData.value.customerId);
        }
      } finally {
        isLoadingFormData = false;
        if (sequence === formLoadSequence) {
          modalApi.unlock();
          void queueFocusFirstBasicFormControl(sequence);
        }
      }
      return;
    }
    try {
      isLoadingFormData = true;
      formData.value = hydrateSaleCustomerFromFallback(
        normalizeLoadedSaleReturn(
          await getSaleReturn(data.id, {
            includeItems: false,
            mask: data.type === 'detail',
          }),
        ),
        data.initialData,
      ) as any;
      formData.value.items = [];
      resetRemoteItemState();
      if (sequence !== formLoadSequence) return;
      const savedDeptId = formData.value.deptId;
      await loadSaleDeptOptions(formData.value.customerId, savedDeptId);
      if (sequence !== formLoadSequence) return;
      formData.value.deptId = savedDeptId;
      await formApi.setValues(
        buildSaleDocumentDetailFormValues(formData.value, formType.value),
        false,
      );
      await loadSaleReturnItemPage({ pageNo: 1 });
      await nextTick();
      await nextTick();
    } catch (error) {
      if (data.type === 'detail') {
        detailLoadError.value = getDetailLoadErrorMessage(error);
      } else {
        editLoadError.value =
          formData.value?.status === 0
            ? '销售退货草稿加载失败，请关闭页面后重新进入'
            : '销售退货加载失败，请关闭页面后重新进入';
      }
    } finally {
      isLoadingFormData = false;
      detailLoading.value = false;
      if (sequence === formLoadSequence) {
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
  await loadSaleReturnItemPage(payload);
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
    <div
      class="sale-return-detail-view"
      :class="{ 'erp-form-focus-highlight': formType !== 'detail' }"
    >
      <div
        v-if="formType === 'detail' && detailLoading"
        class="sale-return-detail-load-state"
      >
        正在加载完整明细，请稍候…
      </div>
      <div
        v-else-if="formType === 'detail' && detailLoadError"
        class="sale-return-detail-load-state is-error"
      >
        {{ detailLoadError }}
      </div>
      <div
        v-else-if="formType !== 'detail' && editLoadError"
        class="sale-return-detail-load-state is-error"
      >
        {{ editLoadError }}
      </div>

      <Tabs
        v-show="
          !editLoadError &&
          (formType !== 'detail' || (!detailLoading && !detailLoadError))
        "
        v-model:active-key="detailActiveTab"
        class="sale-return-detail-tabs"
        :class="{
          'sale-return-detail-tabs--hidden-nav': formType !== 'detail',
        }"
        :tab-bar-style="formType === 'detail' ? undefined : { display: 'none' }"
      >
        <Tabs.TabPane :key="DETAIL_TAB_KEY" tab="单据详情" force-render>
          <div class="sale-return-detail-content">
            <section
              ref="basicFormRef"
              class="sale-return-detail-section"
              @keydown.capture="handleBasicFormEnter"
            >
              <header class="sale-return-detail-section__header">
                <span class="sale-return-detail-section__title">基本信息</span>
              </header>
              <Form
                class="sale-return-edit-form"
                :class="{
                  'sale-return-edit-form--editable': formType !== 'detail',
                }"
              >
                <template #customerDetail>
                  <DetailLinkInput
                    :navigable="canOpenCustomerDetail"
                    :value="formData?.customerName"
                    @open="handleOpenCustomerDetail"
                  />
                </template>
                <template #sourceOutNo>
                  <DetailLinkInput
                    v-if="formType === 'detail'"
                    :navigable="canOpenSourceOutDetail"
                    :value="formData?.sourceOutNo"
                    @open="handleOpenSourceOutDetail"
                  />
                  <SaleOutSelect
                    v-else-if="formData?.returnMode === 10"
                    :out-no="formData?.sourceOutNo"
                    :customer-id="formData?.customerId"
                    :disabled="formType === 'detail'"
                    :hidden-fields="hiddenFields"
                    @update:out="handleUpdateSaleOut"
                  />
                  <span v-else class="text-gray-400">-</span>
                </template>
              </Form>

              <div
                v-if="
                  formType !== 'detail' &&
                  formData?.customerId &&
                  !hiddenFields.includes('customerId') &&
                  !hiddenFields.includes('customerReceivableInfo')
                "
                class="sale-return-detail-receivable"
              >
                <CustomerReceivableSummary :customer-id="formData.customerId" />
              </div>
            </section>

            <section
              v-if="!hiddenFields.includes('items')"
              class="sale-return-detail-section"
            >
              <header class="sale-return-detail-section__header">
                <span class="sale-return-detail-section__title"
                  >退货产品清单</span
                >
              </header>
              <div class="sale-return-detail-items">
                <ItemForm
                  ref="itemFormRef"
                  :items="formData?.items ?? []"
                  :disabled="formType === 'detail'"
                  :discount-percent="formData?.discountPercent ?? 0"
                  :document-id="formData?.id"
                  :enable-batch-edit="canBatchUpdateItems"
                  :stock-location-readonly="
                    [10, 20].includes(Number(formData?.returnMode))
                  "
                  :fee-amount="formData?.feeAmount ?? formData?.otherPrice ?? 0"
                  :hidden-fields="hiddenFields"
                  :item-page-loading="itemPageLoading"
                  :item-pagination="itemPageState"
                  :main-dept-id="formData?.deptId"
                  :customer-price-level="currentCustomerPriceLevel"
                  :remote-paging="isRemoteItemPaging"
                  :shortcut-active="isSaleReturnFormOpen"
                  @batch-update-success="reloadSaleReturnDetail"
                  @page-change="handleItemPageChange"
                  @request-submit="handleLastInputEnterConfirm"
                  @update:items="handleUpdateItems"
                  @update:discount-price="handleUpdateDiscountPrice"
                  @update:fee-amount="handleUpdateFeeAmount"
                  @update:total-price="handleUpdateTotalPrice"
                >
                  <template #toolbar>
                    <Button
                      v-if="formType !== 'detail'"
                      type="primary"
                      ghost
                      @click="handleImport"
                    >
                      导入明细
                    </Button>
                  </template>
                </ItemForm>
              </div>
              <div class="sale-return-document-summary">
                <strong>单据汇总</strong>
                <span>
                  退货数量：<b>{{
                    formatSaleDecimal(documentSummary.totalCount)
                  }}</b>
                </span>
                <span>
                  实际金额：<b>{{
                    formatDetailPriceAmount(
                      'totalProductPrice',
                      documentSummary.totalProductPrice,
                    )
                  }}</b>
                </span>
                <span>
                  优惠：<b>{{
                    formatDetailPriceAmount(
                      'discountPrice',
                      documentSummary.discountPrice,
                    )
                  }}</b>
                </span>
                <span>
                  费用：<b>{{
                    formatSaleAmount(documentSummary.feeAmount)
                  }}</b>
                </span>
                <span class="sale-return-document-summary__receivable">
                  应收金额：<b>{{
                    formatDetailPriceAmount(
                      'totalPrice',
                      documentSummary.totalPrice,
                    )
                  }}</b>
                </span>
              </div>
            </section>

            <section
              v-if="formType === 'detail'"
              class="sale-return-detail-section"
            >
              <header class="sale-return-detail-section__header">
                <span class="sale-return-detail-section__title">作业状态</span>
              </header>
              <div class="grid grid-cols-1 gap-2 p-3 md:grid-cols-4">
                <span>状态：{{ getDetailStatusText() }}</span>
                <span
                  >拣货进度：{{
                    formData.status === 15
                      ? `${Number(formData.pickedItemCount || 0)}/${Number(formData.pickTotalItemCount || 0)}`
                      : '-'
                  }}</span
                >
                <span>下单确认人：{{ formData.confirmUserName || '-' }}</span>
                <span>下单确认时间：{{ getDetailConfirmTimeText() }}</span>
              </div>
            </section>

            <section
              v-if="formType === 'detail'"
              class="sale-return-detail-section sale-return-detail-audit"
            >
              <header class="sale-return-detail-section__header">
                <span class="sale-return-detail-section__title">审计信息</span>
              </header>
              <ErpAuditInfo :record="formData" />
            </section>
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane
          v-if="formType === 'detail'"
          :key="REFUND_TAB_KEY"
          tab="退款核销"
        >
          <RefundWriteOffTab
            :active="detailActiveTab === REFUND_TAB_KEY"
            :can-view-receipt-items="canViewFinanceReceiptItems"
            :customer-id="formData?.customerId"
            :reload-key="refundTabReloadKey"
            :return-id="formData?.id"
          />
        </Tabs.TabPane>
        <Tabs.TabPane
          v-if="
            formType === 'detail' &&
            formData?.id &&
            formData.returnMode === 20 &&
            canPreviewCurrentCost
          "
          key="current-cost"
          tab="无单退货成本"
        >
          <div class="p-3">
            <p class="mb-2">
              查看退入库存的两套成本及核对状态；已过账单据显示当时成本。退款价格不作为入库成本。
            </p>
            <Button @click="currentCostReview?.openView(formData.id!)"
              >查看成本与核对依据</Button
            >
          </div>
        </Tabs.TabPane>
      </Tabs>
    </div>
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
        :title="printSortTitle"
        @click="handleDetailPrint"
      >
        打印
      </Button>
      <Button
        v-if="canCreateTransferOut"
        type="primary"
        @click="handleOpenTransferOut"
      >
        转调拨
      </Button>
      <Button
        v-if="canCreatePurchaseReturn"
        type="primary"
        @click="handleOpenPurchaseReturn"
      >
        转采购退货
      </Button>
      <Button v-if="formType === 'detail' && formData?.id" @click="handleCopy">
        复制
      </Button>
      <Button v-if="canOrderConfirm" type="primary" @click="handleOrderConfirm">
        下单确认
      </Button>
      <Button
        v-if="canCancelOrderConfirm"
        danger
        @click="handleCancelOrderConfirm"
      >
        撤销下单确认
      </Button>
    </template>
  </Modal>
  <CurrentCostReview
    ref="currentCostReview"
    @confirmed="handleOrderConfirmed"
  />
  <RemarkModal @success="handleRemarkSuccess" />
  <ImportFormModal @success="handleImportSuccess" />
  <CustomerDetailModal />
  <SaleOutDetailModal v-if="shouldRenderSaleOutDetail" />
  <SaleReturnableItemSelectModal
    ref="returnableItemSelectRef"
    @select="handleSelectReturnableItems"
  />
  <SaleReturnTransferOutForm ref="transferOutFormRef" />
  <SaleReturnPurchaseReturnForm ref="purchaseReturnFormRef" />
</template>

<style scoped>
:deep(.flex-auto.overflow-hidden:has(> .relative > .erp-detail-link-field)) {
  overflow: visible;
}

.sale-return-detail-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: hsl(var(--muted) / 28%);
  font-size: 12px;
}

.sale-return-detail-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sale-return-detail-load-state {
  display: flex;
  min-height: 72px;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.sale-return-detail-load-state.is-error {
  color: hsl(var(--destructive));
}

.sale-return-detail-section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.sale-return-detail-section__header {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.sale-return-detail-section__title {
  position: relative;
  padding-left: 10px;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
}

.sale-return-detail-section__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  background: hsl(var(--primary));
  border-radius: 3px;
  content: '';
}

.sale-return-edit-form :deep(.sale-return-basic-grid) {
  gap: 0 12px;
  padding: 12px;
}

.sale-return-edit-form :deep(.sale-return-basic-grid > div) {
  min-width: 0;
}

.sale-return-edit-form :deep(.sale-return-basic-grid > div > label) {
  margin-right: 0;
  padding-right: 10px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  white-space: nowrap;
}

.sale-return-edit-form :deep(.sale-return-basic-grid > div > .flex-auto) {
  min-width: 0;
}

.sale-return-edit-form :deep(.ant-input),
.sale-return-edit-form :deep(.ant-picker),
.sale-return-edit-form :deep(.ant-select-selector),
.sale-return-edit-form :deep(.ant-tree-select .ant-select-selector) {
  min-height: 32px;
  background: hsl(var(--muted) / 48%) !important;
  border-color: hsl(var(--border)) !important;
  border-radius: 6px !important;
  font-size: 12px;
}

.sale-return-edit-form :deep(.ant-input),
.sale-return-edit-form :deep(.ant-picker-input > input),
.sale-return-edit-form :deep(.ant-select-selection-item),
.sale-return-edit-form :deep(.ant-select-selection-placeholder),
.sale-return-edit-form :deep(.ant-radio-button-wrapper) {
  font-size: 12px;
}

.sale-return-edit-form :deep(.ant-input),
.sale-return-edit-form :deep(.ant-picker) {
  height: 32px;
}

.sale-return-edit-form :deep(.ant-select-single) {
  height: 32px;
}

.sale-return-detail-receivable {
  padding: 0 12px 12px;
}

.sale-return-detail-receivable :deep(> div) {
  background: hsl(var(--primary) / 7%);
  border-color: hsl(var(--primary) / 20%);
}

.sale-return-edit-form :deep(textarea) {
  min-height: 32px !important;
  resize: none;
}

.sale-return-edit-form
  :deep(.sale-return-attachment-field .ant-upload-select .ant-btn),
.sale-return-edit-form
  :deep(.sale-return-attachment-field .ant-upload-list-item),
.sale-return-edit-form :deep(.sale-return-attachment-field .mt-2) {
  font-size: 12px;
}

.sale-return-edit-form--editable :deep(.ant-input:not(:disabled)),
.sale-return-edit-form--editable :deep(.ant-picker:not(.ant-picker-disabled)),
.sale-return-edit-form--editable
  :deep(.ant-select:not(.ant-select-disabled) .ant-select-selector),
.sale-return-edit-form--editable
  :deep(.ant-upload-picture-card-wrapper .ant-upload-select) {
  background: hsl(var(--background)) !important;
}

.sale-return-edit-form--editable :deep(.ant-input:disabled),
.sale-return-edit-form--editable :deep(.ant-picker-disabled),
.sale-return-edit-form--editable
  :deep(.ant-select-disabled .ant-select-selector),
.sale-return-edit-form--editable
  :deep(.ant-upload-wrapper .ant-upload-disabled) {
  color: hsl(var(--muted-foreground)) !important;
  background: hsl(var(--muted-foreground) / 14%) !important;
  border-color: hsl(var(--muted-foreground) / 28%) !important;
}

.sale-return-detail-items {
  padding: 10px 10px 0;
}

.sale-return-detail-items :deep(.vxe-table) {
  font-size: 11px;
}

.sale-return-detail-items :deep(.vxe-header--column .vxe-cell),
.sale-return-detail-items :deep(.vxe-body--column .vxe-cell) {
  padding-right: 4px;
  padding-left: 4px;
}

.sale-return-detail-items :deep(.vxe-header--column .vxe-cell) {
  white-space: nowrap;
}

.sale-return-document-summary {
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

.sale-return-document-summary strong {
  margin-right: auto;
  color: hsl(var(--foreground));
}

.sale-return-document-summary b {
  margin-left: 5px;
  color: hsl(var(--foreground));
  font-variant-numeric: tabular-nums;
}

.sale-return-document-summary__receivable b {
  color: hsl(var(--success));
}

.sale-return-detail-audit :deep(.erp-audit-info) {
  padding: 12px;
}

.sale-return-detail-audit :deep(.erp-audit-info .text-sm) {
  font-size: 12px;
}

.sale-return-detail-audit :deep(.erp-audit-info > div:first-child) {
  display: none;
}

:global(.sale-return-form-select-dropdown .ant-select-item),
:global(.sale-return-form-select-dropdown .ant-select-tree),
:global(.sale-return-form-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

@media (max-width: 900px) {
  .sale-return-edit-form :deep(.sale-return-basic-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .sale-return-detail-view {
    padding: 8px;
  }

  .sale-return-edit-form :deep(.sale-return-basic-grid) {
    grid-template-columns: minmax(0, 1fr);
  }

  .sale-return-detail-section__header,
  .sale-return-document-summary {
    align-items: flex-start;
    flex-direction: column;
    justify-content: center;
    padding-top: 8px;
    padding-bottom: 8px;
  }

  .sale-return-document-summary strong {
    margin-right: 0;
  }
}
</style>
