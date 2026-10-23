<script lang="ts" setup>
import { CANDIDATE_FOCUS_KEY } from '#/views/erp/utils/candidate-focus';

import type { VbenFormSchema } from '#/adapter/form';
import type { ErpSaleCartApi, SaleCartImportResp } from '#/api/erp/sale/cart';

import { computed, defineAsyncComponent, h, nextTick, ref, provide } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';
import {
  erpCountInputFormatter,
  formatDateTime,
} from '@vben/utils';

import { Modal as AntdModal, Button, Empty, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { formatSaleAmount } from '#/views/erp/sale/utils/decimal';
import { getAccountSimpleList } from '#/api/erp/finance/account';
import {
  cancelFirstApproveSaleCart,
  confirmSaleCart,
  convertSaleCartToQuote,
  createAndSubmitSaleCart,
  createSaleCart,
  exportSaleCartImportTemplate,
  finalApproveSaleCart,
  firstApproveSaleCart,
  getSaleCart,
  getSaleCartCustomerDeptSimplePage,
  getSaleCartEditItemPage,
  getSaleCartFirstApproveConfig,
  getSaleCartItemPage,
  matchSaleCartItems,
  importSaleCart,
  recognizeSaleCartVin,
  submitSaleCart,
  updateSaleCart,
  updateSaleCartDraft,
} from '#/api/erp/sale/cart';
import { getCustomerSalePriceLevel } from '#/api/erp/sale/customer';
import {
  applyFieldPermission,
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import { applyFieldConfig } from '#/views/erp/composables/useFieldConfig';
import { useReportViewOnly } from '#/views/erp/report/components/report-view-only';
import CustomerReceivableSummary from '#/views/erp/sale/components/CustomerReceivableSummary.vue';
import SaleDetailImportModal from '#/views/erp/sale/components/sale-detail-import-modal.vue';
import SaleDocumentRemarkForm from '#/views/erp/sale/components/SaleDocumentRemarkForm.vue';
import { buildSaleCopyDraft } from '#/views/erp/sale/utils/copy-draft';
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
} from '#/views/erp/sale/utils/document-form';
import { hasValidSaleDraftItems } from '#/views/erp/sale/utils/draft-items';
import { getCurrentTimestamp } from '#/views/erp/sale/utils/form-defaults';
import { toOptionalNumberValue } from '#/views/erp/sale/utils/text-number';
import {
  focusFirstEditableFormControl,
  focusNextEditableFormControlOnEnter,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';

import { useFormSchema } from '../data';
import { mergeSaleCartItems } from '../utils/item-merge';
import {
  clampRemoteItemPageNo,
  composeRemoteItemPage,
  getRemoteCreatedItemNavigationPlan,
  getRemoteCreatedItemsNavigationPlan,
  getRemoteCreatedItemPageNo,
  getRemoteItemTotal,
} from '../utils/remote-item-paging';
import { buildSaleCartStockShortageText } from '../utils/stock-shortage-message';
import {
  buildSaleCartConfirmSuccessMessage,
  buildSaleCartSubmitSuccessMessage,
} from '../utils/submit-result';
import ItemForm from './item-form.vue';
import { keepFreightFeeAdjacent } from './sale-cart-form-layout';
import { buildCurrentSaleUserOptions } from './sale-cart-user-options';

import '#/views/erp/styles/form-focus.css';

provide(CANDIDATE_FOCUS_KEY, ref(true));

const emit = defineEmits(['success', 'edit', 'editBasic', 'print']);
const reportViewOnly = useReportViewOnly();
const FIELD_PERMISSION_MODULE = 'erp_sale_cart';
const FREIGHT_TYPE_CUSTOMER_ADVANCE = '代客户付';
const FREIGHT_TYPE_SELF_PAY = '我方自付';
const DEFAULT_ITEM_PAGE_SIZE = 10;
const userStore = useUserStore();
const formData = ref<ErpSaleCartApi.SaleCart>();
const formType = ref('');
const isSaleCartFormOpen = ref(false);
const detailLoading = ref(false);
const detailLoadError = ref('');
const editLoadError = ref('');
const vinRecognizing = ref(false);
const vinResultVisible = ref(false);
const vinResult = ref<ErpSaleCartApi.VinRecognizeResult>();
let detailLoadSequence = 0;
let formLoadSequence = 0;
let skipDraftOnClose = false;
let draftSaved = false;
let draftSaving = false;
const isHydratingFormValues = ref(false);
const draftGenerateLoading = ref(false);
const canOpenCustomerDetail = computed(() =>
  Boolean(formData.value?.customerId && formData.value?.customerName),
);
const itemFormRef = ref<InstanceType<typeof ItemForm>>();
const basicFormRef = ref<HTMLElement | null>(null);
const customerList = ref<any[]>([]);
const saleDeptOptions = ref<any[]>([]);
const currentSaleDeptId = ref<number>();
const currentCustomerPriceLevel = ref<number | undefined>();
const itemPageLoading = ref(false);
const itemPageState = ref({
  orderDirection: undefined as 'asc' | 'desc' | undefined,
  orderField: undefined as string | undefined,
  pageNo: 1,
  pageSize: DEFAULT_ITEM_PAGE_SIZE,
  total: 0,
});
const remotePersistedItemTotal = ref(0);
const remotePendingCreateCount = ref(0);
let itemPageLoadSequence = 0;
let remoteBlankRowAddSequence = 0;
let remoteStockSelectionQueue: Promise<void> = Promise.resolve();
let remoteStockSelectionGeneration = 0;
let saleDeptLoadSeq = 0;
let saleDeptSyncing = false;
const CustomerDetail = defineAsyncComponent(
  () => import('#/views/erp/sale/customer/modules/detail.vue'),
);
const [CustomerDetailModal, customerDetailModalApi] = useVbenModal({
  connectedComponent: CustomerDetail,
  destroyOnClose: true,
});
const [RemarkModal, remarkModalApi] = useVbenModal({
  connectedComponent: SaleDocumentRemarkForm,
  destroyOnClose: true,
});

function handleOpenCustomerDetail() {
  if (!formData.value?.customerId) return;
  customerDetailModalApi.setData({ id: formData.value.customerId }).open();
}
const firstApproveConfig = ref<ErpSaleCartApi.FirstApproveConfig>({
  enabled: true,
  deptAuthEnabled: false,
  includeChildDept: true,
  deptIds: [],
  currentUserAllowed: true,
});
const isRemoteItemPaging = computed(
  () =>
    Boolean(formData.value?.id) && ['detail', 'edit'].includes(formType.value),
);
const remoteItemSortLocked = computed(
  () => isRemoteItemPaging.value && remotePendingCreateCount.value > 0,
);
const remoteItemEdits = new Map<number, ErpSaleCartApi.SaleCartItem>();
const remoteItemDeletes = new Set<number>();
const itemRowKeyManager = createSaleItemClientRowKeyManager('sale-cart-item');
const remoteItemCreates = new Map<string, ErpSaleCartApi.SaleCartItem>();
const remoteItemOriginals = new Map<number, ErpSaleCartApi.SaleCartItem>();
const remoteStockMatchCache = new Map<
  string,
  ErpSaleCartApi.SaleCartItemMatch
>();
const remoteStockNoMatchKeys = new Set<string>();
const REMOTE_STOCK_MATCH_BATCH_SIZE = 200;
const REMOTE_ITEM_COMPARE_IGNORED_FIELDS = new Set([
  'clientRowKey',
  'operation',
  'seq',
  'cartId',
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
  'totalProductPrice',
  'totalPrice',
  'taxPrice',
  'totalTaxPrice',
  'totalWeight',
]);
const [ImportFormModal, importFormModalApi] = useVbenModal({
  connectedComponent: SaleDetailImportModal,
});
const { hasAccessByCodes } = useAccess();
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
  { customerPriceLevel: currentCustomerPriceLevel },
);
const canEditRemark = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    hasAccessByCodes(['erp:sale-cart:update']),
);
const detailPrintSortLabels: Record<string, string> = {
  batchNo: '批次',
  brand: '品牌',
  count: '数量',
  giftFlag: '赠品',
  lastSalePrice: '最后一次销售价',
  originPlace: '产地',
  packageQty: '包装数',
  pieceCount: '件数',
  productCode: '产品编号',
  productId: '产品名称',
  productPrice: '单价',
  productUnitName: '单位',
  remark: '备注',
  standard: '规格',
  stockCount: '库存',
  totalPrice: '金额',
  vehicleModel: '车型',
  warehouseDeptName: '仓库所属部门',
  warehouseId: '仓库',
  weight: '重量',
};
const canPrintFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:sale-cart:print']),
);
const detailPrintTitle = computed(() => {
  const { orderDirection, orderField } = itemPageState.value;
  if (!orderField || !orderDirection) return '按原始顺序打印';
  const label = detailPrintSortLabels[orderField] ?? orderField;
  return `按当前排序打印：${label}（${orderDirection === 'asc' ? '升序' : '降序'}）`;
});

function isEditableBeforeBillingConfirm(cart?: ErpSaleCartApi.SaleCart) {
  return (
    cart?.status === 10 ||
    cart?.status === 15 ||
    (cart?.status === 20 && !cart.billingConfirmTime)
  );
}

const canBatchUpdateItems = computed(() => {
  if (reportViewOnly) return false;
  if (formType.value !== 'detail') {
    return hasAccessByCodes([
      formData.value?.id ? 'erp:sale-cart:update' : 'erp:sale-cart:create',
    ]);
  }
  return (
    !!formData.value?.id &&
    isEditableBeforeBillingConfirm(formData.value) &&
    hasAccessByCodes(['erp:sale-cart:update'])
  );
});
const canSubmitDraftFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    formData.value?.status === 10 &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:sale-cart:submit']),
);
const canEditFromDetail = computed(
  () =>
    formType.value === 'detail' &&
    !!formData.value?.id &&
    isEditableBeforeBillingConfirm(formData.value) &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:sale-cart:update']),
);

function handleEditRemark() {
  if (!formData.value?.id) return;
  remarkModalApi
    .setData({
      documentName: '销售手推车',
      documentType: 'sale-cart',
      id: formData.value.id,
      no: formData.value.no,
      remark: formData.value.remark,
    })
    .open();
}

function handlePrintFromDetail() {
  if (!formData.value?.id) return;
  emit('print', {
    itemOrderDirection: itemPageState.value.orderDirection,
    itemOrderField: itemPageState.value.orderField,
    row: formData.value,
  });
}

async function handleRemarkSuccess(remark: string) {
  if (!formData.value) return;
  formData.value.remark = remark;
  await formApi.setValues({ remark });
  emit('success');
}

const showConvertQuoteBtn = computed(() => {
  return (
    formType.value === 'detail' &&
    isEditableBeforeBillingConfirm(formData.value) &&
    Boolean(formData.value?.customerId) &&
    (formData.value?.items?.length ?? 0) > 0 &&
    hasAccessByCodes(['erp:sale-cart:convert-quote'])
  );
});

const showBillingConfirmBtn = computed(() => {
  return (
    formType.value === 'detail' &&
    formData.value?.status === 15 &&
    hasAccessByCodes(['erp:sale-cart:confirm'])
  );
});

const showFirstApproveBtn = computed(() => {
  return (
    formType.value === 'detail' &&
    firstApproveConfig.value.enabled &&
    formData.value?.firstApproveRequired !== false &&
    formData.value?.status === 20 &&
    hasAccessByCodes(['erp:sale-cart:first-approve'])
  );
});

const showFinalApproveBtn = computed(() => {
  return (
    formType.value === 'detail' &&
    !formData.value?.pickDeliveryOrderId &&
    (formData.value?.status === 30 ||
      (formData.value?.status === 20 &&
        formData.value?.firstApproveRequired === false) ||
      (!firstApproveConfig.value.enabled && formData.value?.status === 20)) &&
    hasAccessByCodes(['erp:sale-cart:final-approve'])
  );
});

const showCancelFirstApproveBtn = computed(() => {
  return (
    formType.value === 'detail' &&
    !formData.value?.pickDeliveryOrderId &&
    formData.value?.status === 30 &&
    hasAccessByCodes(['erp:sale-cart:cancel-first-approve'])
  );
});

const fulfillmentNotice = computed(() => {
  if (!formData.value?.pickDeliveryOrderId) {
    return '';
  }
  if (formData.value.pickStatus !== 30) {
    return '正在拣货，全部送货完成后将自动终审';
  }
  if (formData.value.deliveryStatus !== 30) {
    return '正在送货，全部送货完成后将自动终审';
  }
  return '送货已完成，系统正在自动终审';
});

const isEditingDraft = computed(
  () => formType.value === 'edit' && formData.value?.status === 10,
);

const canGenerateDraft = computed(
  () => formType.value === 'create' || isEditingDraft.value,
);

const generateDraftButtonText = computed(() =>
  isEditingDraft.value ? '保存草稿' : '生成草稿',
);

const canConfirmForm = computed(() => {
  if (formType.value === 'detail' || editLoadError.value) {
    return false;
  }
  return !isEditingDraft.value || hasAccessByCodes(['erp:sale-cart:submit']);
});

const confirmText = computed(() =>
  isEditingDraft.value ? '确认提交' : '确定',
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

const VIN_BASIC_FIELD_GROUPS = [
  { label: 'VIN码', keys: ['vin', 'VIN'] },
  { label: '品牌', keys: ['brand', 'brand_name', 'pp', '品牌'] },
  { label: '车系', keys: ['series', 'series_name', 'cx', '车系'] },
  {
    label: '车型车款',
    keys: ['model', 'model_name', 'car_model', 'cartype', 'name', '车型'],
  },
  { label: '年款', keys: ['year', 'model_year', 'yeartype', 'nk', '年款'] },
  { label: '发动机', keys: ['engine', 'engine_model', 'fdj', '发动机'] },
  { label: '排量', keys: ['displacement', 'pl', '排量'] },
  { label: '变速箱', keys: ['transmission', 'gearbox', 'bsx', '变速箱'] },
  { label: '厂商', keys: ['manufacturer', 'factory', 'scs', '生产厂商'] },
];

const VIN_FIELD_LABELS: Record<string, string> = {
  vin: 'VIN码',
  matching_mode: '匹配模式',
  is_commercial: '是否商用',
  cid: '车ID',
  brand: '品牌',
  brand_name: '品牌名称',
  cartype: '车型',
  series: '车系',
  series_name: '车系',
  model: '车型',
  model_name: '车型名称',
  car_model: '车型',
  name: '车型车款',
  year: '年款',
  yeartype: '年款',
  model_year: '年款',
  price: '厂家指导价',
  guide_price: '指导价',
  gearbox: '变速箱',
  geartype: '变速箱类型',
  transmission: '变速箱',
  engine: '发动机',
  engine_model: '发动机型号',
  driven_type: '驱动方式',
  displacement_ml: '排量(mL)',
  displacementml: '排量(mL)',
  displacement: '排量(L)',
  nedczhyh: '油耗',
  effluent_standard: '环保标准',
  environmentalstandards: '排放标准',
  scale: '车辆级别',
  csjg: '车身结构',
  cms: '车门数(个)',
  doornum: '车门数(个)',
  zws: '座位数(个)',
  seatnum: '座位数(个)',
  listdate: '上市日期',
  market_date: '上市时间',
  stop_date: '停产日期',
  len: '长度(mm)',
  length: '长度(mm)',
  width: '宽度(mm)',
  high: '高度(mm)',
  height: '高度(mm)',
  wheelbase: '轴距(mm)',
  trackfront: '前轮距(mm)',
  trackrear: '后轮距(mm)',
  full_weight: '整备质量(kg)',
  front_tyre_size: '前轮胎规格',
  front_tyresize: '前轮胎规格',
  rear_tyre_size: '后轮胎规格',
  rear_tyresize: '后轮胎规格',
  fronttiresize: '前轮胎尺寸',
  reartiresize: '后轮胎尺寸',
  rlxs: '燃料形式',
  ryxh: '燃油标号',
  fuelgrade: '燃油标号',
  gearbox_number: '变速箱号',
  chassis_number: '底盘号',
  carlist: '可能的车型',
  carid: '车型API ID',
  logo: 'LOGO',
  typeid: '车型ID',
  typename: '车型名称',
  model_list: '可能的销售车型列表',
  full_weight_max: '最大满载质量(kg)',
  full_weight_zz: '核载质量',
  img: '车型图片',
  manufacturer: '厂商',
  zdgl: '最大功率',
  maxpower: '最大功率(kW)',
  maxhorsepower: '最大马力(Ps)',
  front_brake_type: '前制动器类型',
  front_brake: '前制动器类型',
  frontbraketype: '前制动类型',
  rear_brake_type: '后制动器类型',
  rear_brake: '后制动器类型',
  rearbraketype: '后制动类型',
  parking_brake_type: '驻车制动类型',
  parking_brake: '驻车制动类型',
  parkingbraketype: '驻车制动类型',
  qfs: '气缸数',
  cylindernum: '气缸数',
  gyfs: '供油方式',
  fuelmethod: '喷射方式',
  is_import: '是否进口',
  isimport: '是否进口',
  is_rules: 'vin是否合规',
  iscorrect: 'VIN是否合规',
  market_price: '市场参考价',
  marketprice: '市场价',
  gearnum: '变速箱档位数',
  body_type: '车体结构',
  bodytype: '车身型式',
  bodystructure: '车体结构',
  zdml: '最大马力',
  version: '销售版本',
  groupid: '车型组ID',
  groupname: '车型组名称',
  sizetype: '尺寸类型',
  comfuelconsumption: '油耗',
  fueltype: '燃油类型',
  drivemode: '驱动方式',
  carbody: '车身形式',
  ratedloadweight: '额定载质量',
  machineoil: '机油信息',
  volume: '参考用量',
  viscosity: '粘稠度',
  grade: '机油分类',
  level: '质量等级',
  gearboxinfo: '变速箱信息',
  gearboxmodel: '变速箱型号',
  gearboxbrand: '变速箱品牌',
  enginemodel: '发动机型号',
  caridexternal: '外部ID',
  joint: '接口型号',
  gravityoil: '重力加油量',
  mechanicaloil: '机械加油量',
  jointpiclist: '接口图片列表',
  positionpiclist: '位置图片列表',
  power_type: '助力类型',
  fuel_type: '燃料形式',
  fuel_form: '燃料形式',
  rybh: '燃油标号',
  qdfs: '驱动方式',
  fdj: '发动机',
  pp: '品牌',
  cx: '车系',
  nk: '年款',
  pl: '排量',
  bsx: '变速箱',
  scs: '生产厂商',
};

const VIN_MODEL_PRIMARY_KEYS = [
  'matching_mode',
  'is_commercial',
  'cid',
  'brand_name',
  'series_name',
  'name',
  'year',
  'price',
  'gearbox',
  'geartype',
  'engine_model',
  'driven_type',
  'displacement_ml',
  'displacement',
  'nedczhyh',
  'effluent_standard',
  'scale',
  'csjg',
  'cms',
  'zws',
  'market_date',
  'stop_date',
  'length',
  'width',
  'high',
  'wheelbase',
  'trackfront',
  'trackrear',
  'full_weight',
  'front_tyre_size',
  'rear_tyre_size',
  'rlxs',
  'ryxh',
  'gearbox_number',
  'chassis_number',
  'full_weight_max',
  'full_weight_zz',
  'img',
  'manufacturer',
  'zdgl',
  'front_brake_type',
  'rear_brake_type',
  'parking_brake_type',
  'qfs',
  'gyfs',
  'is_import',
  'is_rules',
  'market_price',
  'gearnum',
  'body_type',
  'zdml',
  'version',
];

const vinResultData = computed<Record<string, any>>(() =>
  isPlainRecord(vinResult.value?.data) ? vinResult.value!.data! : {},
);

const vinBasicEntries = computed(() =>
  VIN_BASIC_FIELD_GROUPS.map((group) => ({
    label: group.label,
    value: formatVinDisplayValue(
      findFirstVinValue(vinResultData.value, group.keys),
    ),
  })).filter((item) => item.value !== '-'),
);

const vinExtraEntries = computed(() => {
  const usedKeys = new Set([
    ...VIN_BASIC_FIELD_GROUPS.flatMap((group) => group.keys),
    'model_list',
  ]);
  return Object.entries(vinResultData.value)
    .filter(
      ([key, value]) =>
        !usedKeys.has(key) &&
        value !== undefined &&
        value !== null &&
        value !== '',
    )
    .map(([key, value]) => ({
      label: getVinFieldLabel(key),
      value: formatVinDisplayValue(value),
    }));
});

const vinModelList = computed(() => vinResult.value?.modelList ?? []);

const vinModelColumns = computed(() => {
  const availableKeys = new Set(
    vinModelList.value.flatMap((row) => Object.keys(row)),
  );
  const seenKeys = new Set<string>();
  const columns: Array<{ key: string; label: string }> = [];
  const appendColumn = (key: string) => {
    if (!key || seenKeys.has(key)) {
      return;
    }
    seenKeys.add(key);
    columns.push({ key, label: getVinFieldLabel(key) });
  };
  VIN_MODEL_PRIMARY_KEYS.filter((key) => availableKeys.has(key)).forEach(
    (key) => appendColumn(key),
  );
  vinModelList.value.forEach((row) =>
    Object.keys(row).forEach((key) => appendColumn(key)),
  );
  return columns;
});

const vinRawText = computed(() =>
  JSON.stringify(vinResult.value?.raw ?? vinResult.value ?? {}, null, 2),
);

function stripAutoGeneratedFieldRules(schema: VbenFormSchema[]) {
  return schema.map((item) => {
    if (item.fieldName !== 'cartTime') {
      return item;
    }
    const { rules: _rules, ...rest } = item;
    return rest;
  });
}

const EMBEDDED_SECTION_FIELDS = new Set(['customerReceivableInfo', 'items']);

/** 主表只保留四列基本字段，客户应收和产品明细由独立区块渲染。 */
function buildBasicFormSchema(schema: VbenFormSchema[]) {
  return stripAutoGeneratedFieldRules(schema).filter(
    (item) => !EMBEDDED_SECTION_FIELDS.has(item.fieldName),
  );
}

function withVinRecognizeAction(schema: VbenFormSchema[]) {
  return schema.map((item) => {
    if (item.fieldName !== 'vin') {
      return item;
    }
    return {
      ...item,
      componentProps: {
        ...(item.componentProps && typeof item.componentProps === 'object'
          ? item.componentProps
          : {}),
        class: 'sale-cart-vin-input',
      },
      renderComponentContent: () => ({
        addonAfter: () =>
          h(
            Button,
            {
              class: 'sale-cart-vin-recognize-addon',
              loading: vinRecognizing.value,
              size: 'small',
              type: 'link',
              onClick: handleRecognizeVinFromForm,
            },
            () => '识别',
          ),
      }),
    };
  });
}

async function refreshFormSchema(customerData = formData.value) {
  const hydratedCustomerData =
    await hydrateCurrentSaleFormSelectNames(customerData);
  const baseSchema = useFormSchema(
    formType.value,
    hiddenFields.value,
    saleDeptOptions.value,
    customerList.value,
    buildCurrentSaleUserOptions(formType.value, formData.value),
    handleCustomerOptionsChange,
  );
  const configuredSchema = await applyFieldConfig(baseSchema, 'sale_cart');
  formApi.setState({
    schema: withVinRecognizeAction(
      keepFreightFeeAdjacent(
        buildBasicFormSchema(
          withCurrentSaleFormSelectOptions(
            applyFieldPermission(configuredSchema, hiddenFields.value),
            hydratedCustomerData,
            formType.value,
          ),
        ),
      ),
    ),
  });
}

function handleCustomerOptionsChange(options: any[]) {
  customerList.value = Array.isArray(options) ? options : [];
}

async function applyFormMode(
  type: string,
  customerData?: ErpSaleCartApi.SaleCart,
) {
  formType.value = type;
  modalApi.setState({ fullscreen: true });
  formApi.setDisabled(type === 'detail');
  if (type !== 'detail') {
    await refreshFormSchema(customerData);
  }
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

/** 按客户分页加载可选部门，避免表单打开时拉取全量部门树 */
async function loadSaleDeptOptions(
  customerId?: number,
  preferredDeptId?: number,
) {
  const seq = ++saleDeptLoadSeq;
  saleDeptSyncing = true;
  try {
    const preservedValues =
      (await formApi.getValues()) as ErpSaleCartApi.SaleCart;
    updateDeptFieldCustomerParam(customerId);
    if (seq !== saleDeptLoadSeq) {
      return;
    }
    if (!customerId) {
      saleDeptOptions.value = [];
      currentSaleDeptId.value = undefined;
      if (formData.value) {
        formData.value.deptId = undefined;
      }
      await formApi.setValues({
        ...preservedValues,
        customerId: undefined,
        deptId: undefined,
      });
      return;
    }
    const page = await getSaleCartCustomerDeptSimplePage({
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
    await nextTick();
    if (seq !== saleDeptLoadSeq) {
      return;
    }
    const currentUserDeptId = userStore.userInfo?.deptId;
    const deptId =
      saleDeptOptions.value.find((dept) => dept.id === preferredDeptId)?.id ??
      saleDeptOptions.value.find((dept) => dept.id === currentUserDeptId)?.id ??
      saleDeptOptions.value[0]?.id;
    currentSaleDeptId.value = deptId;
    formData.value = formData.value || {};
    formData.value.customerId = customerId;
    formData.value.deptId = deptId;
    await formApi.setValues({
      ...preservedValues,
      customerId,
      deptId,
    });
    await nextTick();
  } finally {
    if (seq === saleDeptLoadSeq) {
      saleDeptSyncing = false;
    }
  }
}

async function loadCustomerPriceLevel(customerId?: number) {
  if (!customerId) {
    currentCustomerPriceLevel.value = undefined;
    return;
  }
  const cachedCustomer = customerList.value.find(
    (item) => item.id === customerId && !item.disabled,
  );
  if (cachedCustomer?.priceLevel !== undefined) {
    currentCustomerPriceLevel.value = cachedCustomer.priceLevel;
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

const getTitle = computed(() => {
  if (formType.value === 'create') return '新增销售手推车';
  if (formType.value === 'edit') return '编辑销售手推车';
  return '销售手推车详情';
});

const CART_STATUS_META: Record<number, { className: string; label: string }> = {
  10: { className: 'is-draft', label: '草稿' },
  15: { className: 'is-pending', label: '待开单确认' },
  20: { className: 'is-pending', label: '待初审' },
  30: { className: 'is-pending', label: '待终审' },
  40: { className: 'is-success', label: '终审通过' },
  50: { className: 'is-success', label: '已生成销售单' },
  60: { className: 'is-info', label: '已转报价' },
  90: { className: 'is-muted', label: '已取消' },
};

const detailStatus = computed(
  () =>
    CART_STATUS_META[Number(formData.value?.status)] || {
      className: 'is-muted',
      label: '未知状态',
    },
);

const detailItemCount = computed(() =>
  isRemoteItemPaging.value
    ? itemPageState.value.total
    : (formData.value?.items?.length ?? 0),
);

const detailProductAmount = computed(() => {
  if (formData.value?.totalProductPrice !== undefined) {
    return Number(formData.value.totalProductPrice || 0);
  }
  return (formData.value?.items ?? []).reduce(
    (sum, item) => sum + Number(item.totalPrice || 0),
    0,
  );
});

const detailExtraCost = computed(() => {
  const labels: string[] = [];
  let amount = 0;
  if (isDetailFieldVisible('feeAmount')) {
    labels.push('费用');
    amount += Number(
      formData.value?.feeAmount ?? formData.value?.otherPrice ?? 0,
    );
  }
  return { amount, label: labels.join('及') };
});

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

function isPlainRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function findFirstVinValue(record: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function formatVinDisplayValue(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? JSON.stringify(value) : '-';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function getVinFieldLabel(key: string) {
  return VIN_FIELD_LABELS[key] ?? VIN_FIELD_LABELS[key.toLowerCase()] ?? key;
}

function getVinModelValue(row: Record<string, any>, keys: string[]) {
  return formatVinDisplayValue(findFirstVinValue(row, keys));
}

function normalizeVinForRecognize(vin?: string) {
  return String(vin || '')
    .trim()
    .toUpperCase();
}

async function handleRecognizeVinFromForm(event?: Event) {
  event?.preventDefault();
  event?.stopPropagation();
  const values = (await formApi.getValues()) as ErpSaleCartApi.SaleCart;
  await handleRecognizeVin(values.vin);
}

async function handleRecognizeVin(vin?: string) {
  const normalizedVin = normalizeVinForRecognize(vin);
  if (!normalizedVin) {
    message.warning('请先输入VIN码');
    return;
  }
  if (normalizedVin.length !== 17) {
    message.warning('VIN码应为17位');
    return;
  }
  try {
    vinRecognizing.value = true;
    vinResult.value = await recognizeSaleCartVin(normalizedVin);
    vinResultVisible.value = true;
  } catch {
    message.error('VIN码识别失败，请稍后重试');
  } finally {
    vinRecognizing.value = false;
  }
}

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    labelClass: '!justify-start !text-left',
    labelWidth: 82,
  },
  compact: true,
  wrapperClass: 'sale-cart-basic-grid grid-cols-4',
  layout: 'horizontal',
  schema: keepFreightFeeAdjacent(
    buildBasicFormSchema(useFormSchema(formType.value)),
  ),
  showDefaultActions: false,
  handleValuesChange: async (values, changedFields) => {
    if (isHydratingFormValues.value) return;
    const previousCustomerId = formData.value?.customerId;
    if (formData.value && changedFields.includes('feeAmount')) {
      const feeAmount = toOptionalNumberValue(values.feeAmount) ?? 0;
      formData.value.feeAmount = feeAmount;
      formData.value.otherPrice = feeAmount;
    }
    if (
      !saleDeptSyncing &&
      changedFields.includes('customerId') &&
      values.customerId !== previousCustomerId
    ) {
      if (!formData.value) {
        formData.value = {} as ErpSaleCartApi.SaleCart;
      }
      formData.value.customerId = values.customerId;
      void loadSaleDeptOptions(values.customerId);
      void loadCustomerPriceLevel(values.customerId);
    }
    if (changedFields.includes('deptId') && !saleDeptSyncing) {
      if (!formData.value) {
        formData.value = {} as ErpSaleCartApi.SaleCart;
      }
      currentSaleDeptId.value = values.deptId;
      formData.value.deptId = values.deptId;
    }
    if (
      !saleDeptSyncing &&
      changedFields.includes('customerId') &&
      values.customerId
    ) {
      const customer = customerList.value.find(
        (c) => c.id === values.customerId && !c.disabled,
      );
      if (customer) {
        await formApi.setValues({
          contactPerson: customer.contact || '',
          contactPhone: customer.mobile || '',
        });
      }
    }
  },
});

function handleUpdateItems(items: ErpSaleCartApi.SaleCartItem[]) {
  recordRemoteItemChanges(items);
  formData.value = formData.value || {};
  formData.value.items = items;
}

function handleUpdateSummary(summary: {
  totalCount: number;
  totalPrice: number;
  totalProductPrice: number;
  totalTaxPrice: number;
}) {
  // 远程分页时子表只持有当前页，不能用页小计覆盖主表的整单汇总。
  if (isRemoteItemPaging.value) {
    return;
  }
  formData.value = {
    ...formData.value,
    ...summary,
  } as ErpSaleCartApi.SaleCart;
  formApi.setValues(summary);
}

function handleImport() {
  importFormModalApi
    .setData({
      title: '导入销售手推车明细',
      templateFileName: '销售手推车明细导入模板.xls',
      importRequest: importSaleCart,
      exportTemplateRequest: exportSaleCartImportTemplate,
      templateGuideSummary:
        '销售手推车明细导入模板用于解析当前手推车明细，上传后系统会按产品、仓库、数量、价格等字段回填到当前表单。',
      templateGuideTips: [
        '配件编码、配件名称、厂家编码是三选一字段：填写其中任意一个即可；如果多列都填，必须对应同一配件；仓库需能匹配到系统中已启用的资料。',
        '数量、单价、赠品、备注等明细字段请按模板示例填写。',
      ],
    })
    .open();
}

async function handleImportSuccess(data: SaleCartImportResp) {
  const currentItems = formData.value?.items ?? [];
  const mergedItems = isRemoteItemPaging.value
    ? [
        ...currentItems.filter((item) => item.id),
        ...mergeSaleCartItems([
          ...currentItems.filter((item) => !item.id),
          ...(data.items ?? []),
        ]),
      ]
    : mergeSaleCartItems([...currentItems, ...(data.items ?? [])]);
  const importValues = {
    items: mergedItems,
  } as ErpSaleCartApi.SaleCart;
  if (isRemoteItemPaging.value) {
    recordRemoteItemChanges(mergedItems);
  }
  formData.value = {
    ...formData.value,
    ...importValues,
  };
  if (isRemoteItemPaging.value) {
    const firstImportedKey = data.items?.[0]
      ? getRemoteLocalItemKey(data.items[0])
      : undefined;
    const { targetPageNo } = await consolidateRemoteCreatesWithMatches(
      data.items ?? [],
    );
    const createdPageNo = firstImportedKey
      ? getRemoteCreatedItemPageNo(
          remotePersistedItemTotal.value,
          [...remoteItemCreates.keys()],
          firstImportedKey,
          itemPageState.value.pageSize,
        )
      : undefined;
    await getItemFormInstance()?.clearRemoteItemSort?.();
    await loadSaleCartItemPage({
      orderDirection: undefined,
      orderField: undefined,
      pageNo: targetPageNo ?? createdPageNo ?? itemPageState.value.pageNo,
    });
  }
}

function normalizeImportData(importData?: SaleCartImportResp) {
  return {
    items: mergeSaleCartItems(importData?.items ?? []),
  } as ErpSaleCartApi.SaleCart;
}

async function loadFirstApproveConfig() {
  firstApproveConfig.value = {
    ...firstApproveConfig.value,
    ...(await getSaleCartFirstApproveConfig()),
  };
}

function normalizeLoadedSaleCart(sourceData: ErpSaleCartApi.SaleCart) {
  const legacyFreightAmount =
    sourceData.freightType === FREIGHT_TYPE_CUSTOMER_ADVANCE ||
    sourceData.freightType === FREIGHT_TYPE_SELF_PAY
      ? sourceData.totalFreight
      : undefined;
  sourceData.feeAmount =
    toOptionalNumberValue(
      sourceData.feeAmount ?? sourceData.otherPrice ?? legacyFreightAmount,
    ) ?? 0;
  sourceData.otherPrice = sourceData.feeAmount;
  return sourceData;
}

async function loadDefaultAccountId() {
  try {
    const accountList = await getAccountSimpleList();
    return accountList.find((item) => item.defaultStatus)?.id;
  } catch {
    // 账户下拉在用户展开时仍会重新加载，默认值加载失败不阻断新建表单。
    return undefined;
  }
}

async function loadDetailData(id: number, sequence: number) {
  try {
    const [sourceData] = await Promise.all([
      getSaleCart(id, { includeItems: false, mask: true }),
      loadFirstApproveConfig(),
    ]);
    if (sequence !== detailLoadSequence) {
      return;
    }
    formData.value = normalizeLoadedSaleCart(sourceData);
    formData.value.items = [];
    resetRemoteItemState();
    currentSaleDeptId.value = formData.value?.deptId;
    await loadCustomerPriceLevel(formData.value?.customerId);
    if (sequence !== detailLoadSequence) {
      return;
    }
    await loadHiddenFields(undefined, true, currentCustomerPriceLevel.value);
    await loadSaleCartItemPage({ pageNo: 1 });
  } catch {
    if (sequence === detailLoadSequence) {
      detailLoadError.value = reportViewOnly
        ? '单据已删除、不可用或无权访问，请关闭后重试'
        : '详情加载失败，请关闭后重试';
    }
  } finally {
    if (sequence === detailLoadSequence) {
      detailLoading.value = false;
    }
  }
}

async function reloadSaleCartDetail() {
  if (!formData.value?.id) return;
  const sourceData = await getSaleCart(formData.value.id, {
    includeItems: !isRemoteItemPaging.value,
    mask: formType.value === 'detail',
  });
  formData.value = normalizeLoadedSaleCart(sourceData);
  if (isRemoteItemPaging.value) {
    formData.value.items = [];
  }
  currentSaleDeptId.value = formData.value?.deptId;
  await loadFirstApproveConfig();
  await loadCustomerPriceLevel(formData.value.customerId);
  await formApi.setValues(
    buildSaleDocumentDetailFormValues(formData.value, formType.value),
  );
  if (isRemoteItemPaging.value) {
    await loadSaleCartItemPage({ pageNo: itemPageState.value.pageNo });
  }
  await nextTick();
  await getItemFormInstance()?.reloadItemsFromProps?.();
  await getItemFormInstance()?.waitForItemsReady?.();
}

function buildSaleCartCopyData(source: ErpSaleCartApi.SaleCart) {
  const copyData = buildSaleCopyDraft(source, {
    extraCleanKeys: [
      'generatedSaleOutNo',
      'submitUserId',
      'submitTime',
      'billingConfirmUserId',
      'billingConfirmUserName',
      'billingConfirmTime',
      'firstAuditUserId',
      'firstAuditTime',
      'finalAuditUserId',
      'finalAuditTime',
      'rejectUserId',
      'rejectTime',
    ],
    extraItemCleanKeys: ['cartId', 'sourceItemId'],
  });
  copyData.cartTime = getCurrentTimestamp();
  Object.assign(
    copyData,
    buildSaleCurrentUserFormDefaults(userStore.userInfo, ['saleUserId']),
  );
  copyData.items = mergeSaleCartItems(copyData.items ?? []);
  return copyData;
}

async function handleCopy() {
  if (!formData.value?.id) return;
  const copyData = buildSaleCartCopyData({
    ...formData.value,
    items: await loadAllSaleCartItems(formData.value.id, { mask: false }),
  });
  resetRemoteItemState();
  await applyFormMode('create');
  formData.value = copyData;
  await loadSaleDeptOptions(copyData.customerId, copyData.deptId);
  await loadCustomerPriceLevel(copyData.customerId);
  copyData.deptId = formData.value?.deptId;
  await formApi.setValues(copyData);
  const sequence = ++formLoadSequence;
  void queueFocusFirstBasicFormControl(sequence);
}

function normalizeFormNumberFields(data: ErpSaleCartApi.SaleCart) {
  const payload = { ...data };
  payload.totalFreight = undefined;
  payload.feeAmount =
    toOptionalNumberValue(payload.feeAmount ?? payload.otherPrice) ?? 0;
  payload.otherPrice = payload.feeAmount;
  payload.totalCount = toOptionalNumberValue(payload.totalCount);
  payload.totalProductPrice = toOptionalNumberValue(payload.totalProductPrice);
  payload.totalTaxPrice = toOptionalNumberValue(payload.totalTaxPrice);
  payload.totalPrice = toOptionalNumberValue(payload.totalPrice);
  return payload;
}

async function buildCurrentSaleCartPayload() {
  const itemFormInstance = getItemFormInstance();
  const items = await buildMergedRemoteItemsForSubmit();
  const data = normalizeFormNumberFields({
    ...((await formApi.getValues()) as ErpSaleCartApi.SaleCart),
    items: itemFormInstance?.getDraftItems?.() ?? formData.value?.items ?? [],
    saleUserId: userStore.userInfo?.id,
  });
  data.items = items.map((item: ErpSaleCartApi.SaleCartItem) =>
    stripSaleItemClientFields(item),
  );
  delete (data as unknown as Record<string, unknown>).customerReceivableInfo;
  delete (data as unknown as Record<string, unknown>).customerDetail;
  return data;
}

function getItemFormInstance() {
  return Array.isArray(itemFormRef.value)
    ? itemFormRef.value[0]
    : itemFormRef.value;
}

function resetRemoteItemState() {
  itemRowKeyManager.reset();
  itemPageLoadSequence += 1;
  remoteStockSelectionGeneration += 1;
  remoteItemEdits.clear();
  remoteItemDeletes.clear();
  remoteItemCreates.clear();
  remoteItemOriginals.clear();
  remoteStockMatchCache.clear();
  remoteStockNoMatchKeys.clear();
  remotePersistedItemTotal.value = 0;
  remotePendingCreateCount.value = 0;
  itemPageState.value = {
    orderDirection: undefined,
    orderField: undefined,
    pageNo: 1,
    pageSize: DEFAULT_ITEM_PAGE_SIZE,
    total: 0,
  };
}

function syncRemoteItemPagingTotal() {
  remotePendingCreateCount.value = remoteItemCreates.size;
  itemPageState.value.total = getRemoteItemTotal(
    remotePersistedItemTotal.value,
    remoteItemCreates.size,
  );
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

function normalizeRemoteItemForCompare(item: ErpSaleCartApi.SaleCartItem) {
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
  current: ErpSaleCartApi.SaleCartItem,
  original?: ErpSaleCartApi.SaleCartItem,
) {
  if (!original) {
    return false;
  }
  return (
    JSON.stringify(normalizeRemoteItemForCompare(current)) ===
    JSON.stringify(normalizeRemoteItemForCompare(original))
  );
}

function rememberRemoteItemOriginals(rows: ErpSaleCartApi.SaleCartItem[]) {
  rows.forEach((item) => {
    if (item.id) {
      remoteItemOriginals.set(item.id, { ...item });
    }
  });
}

function getRemoteLocalItemKey(item: ErpSaleCartApi.SaleCartItem) {
  return itemRowKeyManager.ensureRowKey(item);
}

function getRemoteDisplayItemKey(item: ErpSaleCartApi.SaleCartItem) {
  return getRemoteLocalItemKey(item);
}

function getRemoteStockKey(item: {
  batchNo?: string;
  giftFlag?: boolean;
  productId?: number;
  warehouseId?: number;
}) {
  return [
    item.productId ?? 'none',
    item.warehouseId ?? 'none',
    String(item.batchNo ?? '').trim(),
    item.giftFlag ? 1 : 0,
  ].join('|');
}

async function loadRemoteStockMatches(
  items: Array<{
    batchNo?: string;
    giftFlag?: boolean;
    productId?: number;
    warehouseId?: number;
  }>,
) {
  if (!isRemoteItemPaging.value || !formData.value?.id) return [];
  const keyMap = new Map(
    items
      .filter((item) => item.productId && item.warehouseId)
      .map((item) => [getRemoteStockKey(item), item]),
  );
  const missingItems = [...keyMap.entries()]
    .filter(
      ([key]) =>
        !remoteStockMatchCache.has(key) && !remoteStockNoMatchKeys.has(key),
    )
    .map(([, item]) => item);
  for (
    let offset = 0;
    offset < missingItems.length;
    offset += REMOTE_STOCK_MATCH_BATCH_SIZE
  ) {
    const batchItems = missingItems.slice(
      offset,
      offset + REMOTE_STOCK_MATCH_BATCH_SIZE,
    );
    const result = await matchSaleCartItems({
      cartId: formData.value.id,
      pageSize: itemPageState.value.pageSize,
      keys: batchItems.map((item) => ({
        batchNo: String(item.batchNo ?? '').trim(),
        giftFlag: Boolean(item.giftFlag),
        productId: Number(item.productId),
        warehouseId: Number(item.warehouseId),
      })),
    });
    (result?.matches ?? []).forEach((match) => {
      remoteStockMatchCache.set(getRemoteStockKey(match), match);
      rememberRemoteItemOriginals(match.items ?? []);
    });
    const matchedKeys = new Set(
      (result?.matches ?? []).map((match) => getRemoteStockKey(match)),
    );
    batchItems.forEach((item) => {
      const key = getRemoteStockKey(item);
      if (!matchedKeys.has(key)) remoteStockNoMatchKeys.add(key);
    });
  }
  return [...keyMap.keys()]
    .map((key) => remoteStockMatchCache.get(key))
    .filter(Boolean) as ErpSaleCartApi.SaleCartItemMatch[];
}

function getEffectiveMatchedItems(match: ErpSaleCartApi.SaleCartItemMatch) {
  return (match.items ?? [])
    .filter((item) => !item.id || !remoteItemDeletes.has(item.id))
    .map((item) => (item.id && remoteItemEdits.get(item.id)) || item);
}

async function consolidateRemoteCreatesWithMatches(
  selectedItems?: ErpSaleCartApi.SaleCartItem[],
  options: { syncTotal?: boolean } = {},
) {
  if (!isRemoteItemPaging.value) return {};
  const candidates = selectedItems?.length
    ? selectedItems
    : [...remoteItemCreates.values()];
  const matches = await loadRemoteStockMatches(candidates);
  let targetPageNo: number | undefined;
  let targetRowKey: string | undefined;
  let addedDeleteCount = 0;
  for (const match of matches) {
    const key = getRemoteStockKey(match);
    const creates = [...remoteItemCreates.entries()].filter(
      ([, item]) => getRemoteStockKey(item) === key,
    );
    if (creates.length === 0) continue;
    const existingItems = getEffectiveMatchedItems(match);
    if (existingItems.length === 0) continue;
    const survivor = existingItems.toSorted(
      (left, right) => Number(left.id || 0) - Number(right.id || 0),
    )[0]!;
    const latestCreate = creates.at(-1)![1];
    const count =
      existingItems.reduce((sum, item) => sum + Number(item.count || 0), 0) +
      creates.reduce((sum, [, item]) => sum + Number(item.count || 0), 0);
    const updatedSurvivor = {
      ...survivor,
      count,
      productPrice: latestCreate.productPrice,
      totalPrice: Number(latestCreate.productPrice || 0) * count,
    };
    remoteItemEdits.set(Number(survivor.id), updatedSurvivor);
    existingItems.forEach((item) => {
      if (item.id && item.id !== survivor.id) {
        if (!remoteItemDeletes.has(item.id)) {
          addedDeleteCount += 1;
        }
        remoteItemDeletes.add(item.id);
        remoteItemEdits.delete(item.id);
      }
    });
    creates.forEach(([localKey]) => remoteItemCreates.delete(localKey));
    targetPageNo ??= match.targetPageNo;
    targetRowKey ??= getRemoteDisplayItemKey(updatedSurvivor);
  }
  remotePersistedItemTotal.value = Math.max(
    0,
    remotePersistedItemTotal.value - addedDeleteCount,
  );
  if (options.syncTotal !== false) {
    syncRemoteItemPagingTotal();
  }
  return { targetPageNo, targetRowKey };
}

interface RemoteStockSelectionRequest {
  appendedItems: ErpSaleCartApi.SaleCartItem[];
  replacementItem?: ErpSaleCartApi.SaleCartItem;
  targetRowKey?: string;
}

function restoreRemoteItemMap<K>(
  target: Map<K, ErpSaleCartApi.SaleCartItem>,
  source: Map<K, ErpSaleCartApi.SaleCartItem>,
) {
  target.clear();
  source.forEach((value, key) => target.set(key, { ...value }));
}

async function applyRemoteStockSelection(
  payload: RemoteStockSelectionRequest,
  generation: number,
) {
  if (
    generation !== remoteStockSelectionGeneration ||
    !isRemoteItemPaging.value
  )
    return;
  const previousItems = (formData.value?.items ?? []).map((item) => ({
    ...item,
  }));
  const previousPageState = { ...itemPageState.value };
  const previousPersistedTotal = remotePersistedItemTotal.value;
  const previousPendingCreateCount = remotePendingCreateCount.value;
  const previousEdits = new Map(remoteItemEdits);
  const previousDeletes = new Set(remoteItemDeletes);
  const previousCreates = new Map(remoteItemCreates);
  let currentItems = previousItems;
  let replacementKey: string | undefined;
  try {
    if (payload.replacementItem && payload.targetRowKey) {
      const targetIndex = currentItems.findIndex(
        (item) => getRemoteDisplayItemKey(item) === payload.targetRowKey,
      );
      if (targetIndex < 0) {
        throw new Error('待替换的明细已不在当前页');
      }
      currentItems = [
        ...currentItems.slice(0, targetIndex),
        payload.replacementItem,
        ...currentItems.slice(targetIndex + 1),
      ];
      replacementKey = getRemoteDisplayItemKey(payload.replacementItem);
      recordRemoteItemChanges(currentItems);
    }
    payload.appendedItems.forEach((item) => {
      remoteItemCreates.set(getRemoteLocalItemKey(item), { ...item });
    });
    const consolidation = await consolidateRemoteCreatesWithMatches(
      [
        ...(payload.replacementItem ? [payload.replacementItem] : []),
        ...payload.appendedItems,
      ],
      { syncTotal: false },
    );
    if (generation !== remoteStockSelectionGeneration) return;
    const remainingAppendedKeys = payload.appendedItems
      .map(getRemoteLocalItemKey)
      .filter((key) => remoteItemCreates.has(key));
    syncRemoteItemPagingTotal();

    const replacementStillVisible = payload.replacementItem
      ? payload.replacementItem.id
        ? !remoteItemDeletes.has(payload.replacementItem.id)
        : remoteItemCreates.has(getRemoteLocalItemKey(payload.replacementItem))
      : false;
    if (replacementStillVisible && replacementKey) {
      itemPageState.value = {
        ...itemPageState.value,
        total: getRemoteItemTotal(
          remotePersistedItemTotal.value,
          remoteItemCreates.size,
        ),
      };
      await syncRemoteVisibleItems(
        applyRemoteItemCache(
          currentItems.filter((item) => item.id),
          previousPageState.pageNo,
          previousPageState.pageSize,
          remotePersistedItemTotal.value,
        ),
        { refreshAuxiliary: false },
      );
      await getItemFormInstance()?.focusRemoteItemByKey?.(
        replacementKey,
        'count',
        false,
      );
      getItemFormInstance()?.warnStockShortages?.();
      return;
    }

    if (remainingAppendedKeys.length > 0) {
      const navigationPlan = getRemoteCreatedItemsNavigationPlan({
        createdKeys: [...remoteItemCreates.keys()],
        currentPageNo: previousPageState.pageNo,
        orderField: previousPageState.orderField,
        pageSize: previousPageState.pageSize,
        persistedTotal: remotePersistedItemTotal.value,
        targetKeys: remainingAppendedKeys,
      });
      if (!navigationPlan) {
        throw new Error('无法定位新增明细所在页');
      }
      await getItemFormInstance()?.clearRemoteItemSort?.();
      if (navigationPlan.requiresPageRequest) {
        itemPageState.value = {
          ...itemPageState.value,
          orderDirection: undefined,
          orderField: undefined,
          pageNo: navigationPlan.targetPageNo,
          total: getRemoteItemTotal(
            remotePersistedItemTotal.value,
            remoteItemCreates.size,
          ),
        };
        const loaded = await loadSaleCartItemPage({
          orderDirection: undefined,
          orderField: undefined,
          pageNo: navigationPlan.targetPageNo,
        });
        if (!loaded) return;
      } else {
        const persistedRows =
          navigationPlan.targetPageNo === previousPageState.pageNo &&
          !previousPageState.orderField
            ? currentItems.filter((item) => item.id)
            : [];
        itemPageState.value = {
          ...itemPageState.value,
          orderDirection: undefined,
          orderField: undefined,
          pageNo: navigationPlan.targetPageNo,
          total: getRemoteItemTotal(
            remotePersistedItemTotal.value,
            remoteItemCreates.size,
          ),
        };
        await syncRemoteVisibleItems(
          applyRemoteItemCache(
            persistedRows,
            navigationPlan.targetPageNo,
            previousPageState.pageSize,
            remotePersistedItemTotal.value,
          ),
          { refreshAuxiliary: false },
        );
      }
      await getItemFormInstance()?.focusRemoteItemByKey?.(
        navigationPlan.focusKey,
        'count',
        false,
      );
      getItemFormInstance()?.warnStockShortages?.();
      return;
    }

    if (consolidation.targetPageNo) {
      await getItemFormInstance()?.clearRemoteItemSort?.();
      const canReuseCurrentPage =
        consolidation.targetPageNo === previousPageState.pageNo &&
        !previousPageState.orderField;
      if (canReuseCurrentPage) {
        itemPageState.value = {
          ...itemPageState.value,
          orderDirection: undefined,
          orderField: undefined,
          pageNo: consolidation.targetPageNo,
          total: getRemoteItemTotal(
            remotePersistedItemTotal.value,
            remoteItemCreates.size,
          ),
        };
        await syncRemoteVisibleItems(
          applyRemoteItemCache(
            currentItems.filter((item) => item.id),
            consolidation.targetPageNo,
            previousPageState.pageSize,
            remotePersistedItemTotal.value,
          ),
          { refreshAuxiliary: false },
        );
      } else {
        const loaded = await loadSaleCartItemPage({
          orderDirection: undefined,
          orderField: undefined,
          pageNo: consolidation.targetPageNo,
        });
        if (!loaded) return;
      }
      if (consolidation.targetRowKey) {
        await getItemFormInstance()?.focusRemoteItemByKey?.(
          consolidation.targetRowKey,
          'count',
          false,
        );
      }
      getItemFormInstance()?.warnStockShortages?.();
    }
  } catch {
    if (generation !== remoteStockSelectionGeneration) return;
    restoreRemoteItemMap(remoteItemEdits, previousEdits);
    remoteItemDeletes.clear();
    previousDeletes.forEach((id) => remoteItemDeletes.add(id));
    restoreRemoteItemMap(remoteItemCreates, previousCreates);
    remotePersistedItemTotal.value = previousPersistedTotal;
    remotePendingCreateCount.value = previousPendingCreateCount;
    itemPageState.value = previousPageState;
    await syncRemoteVisibleItems(previousItems, { refreshAuxiliary: false });
    await nextTick();
    await getItemFormInstance()?.restoreRemoteItemSort?.(
      previousPageState.orderField,
      previousPageState.orderDirection,
    );
    message.error('新增明细定位失败，请重试');
  }
}

function handleRemoteStockSelectionRequested(
  payload: RemoteStockSelectionRequest,
) {
  const generation = remoteStockSelectionGeneration;
  const operation = remoteStockSelectionQueue
    .catch(() => undefined)
    .then(() => applyRemoteStockSelection(payload, generation));
  remoteStockSelectionQueue = operation.catch(() => undefined);
  return operation;
}

function applyRemoteItemCache(
  rows: ErpSaleCartApi.SaleCartItem[] = [],
  pageNo = itemPageState.value.pageNo,
  pageSize = itemPageState.value.pageSize,
  persistedTotal = remotePersistedItemTotal.value,
) {
  itemRowKeyManager.ensureRowKeys(rows);
  const persistedRows = rows
    .filter((item) => !item.id || !remoteItemDeletes.has(item.id))
    .map((item) => (item.id && remoteItemEdits.get(item.id)) || item);
  return itemRowKeyManager.ensureRowKeys(
    composeRemoteItemPage({
      createdRows: [...remoteItemCreates.values()],
      pageNo,
      pageSize,
      persistedRows,
      persistedTotal,
    }),
  );
}

async function syncRemoteVisibleItems(
  rows: ErpSaleCartApi.SaleCartItem[],
  options: { refreshAuxiliary?: boolean } = {},
) {
  formData.value = formData.value ?? {};
  formData.value.items = rows;
  const itemForm = getItemFormInstance();
  if (itemForm?.syncRemoteItems) {
    await itemForm.syncRemoteItems(rows, options);
    return;
  }
  await nextTick();
  await getItemFormInstance()?.syncRemoteItems?.(rows, options);
}

function recordRemoteItemChanges(rows: ErpSaleCartApi.SaleCartItem[]) {
  if (!isRemoteItemPaging.value) {
    return;
  }
  const previousDeleteCount = remoteItemDeletes.size;
  const previousCreateCount = remoteItemCreates.size;
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
  remotePersistedItemTotal.value = Math.max(
    0,
    remotePersistedItemTotal.value -
      (remoteItemDeletes.size - previousDeleteCount),
  );
  if (
    previousCreateCount !== remoteItemCreates.size ||
    previousDeleteCount !== remoteItemDeletes.size
  ) {
    syncRemoteItemPagingTotal();
  }
}

async function loadSaleCartItemPage(
  options: {
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    pageNo?: number;
    pageSize?: number;
  } = {},
): Promise<boolean> {
  if (!formData.value?.id) {
    formData.value = formData.value ?? {};
    formData.value.items = [];
    return false;
  }
  const sequence = ++itemPageLoadSequence;
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
    const requestItemPage = (pageNo: number) => {
      const params = {
        cartId: formData.value!.id!,
        mask: formType.value === 'detail',
        orderDirection: nextState.orderDirection,
        orderField: nextState.orderField,
        pageNo,
        pageSize: nextState.pageSize,
      };
      return formType.value === 'edit'
        ? getSaleCartEditItemPage({
            ...params,
            excludedItemIds: [...remoteItemDeletes],
          })
        : getSaleCartItemPage(params);
    };
    let result = await requestItemPage(nextState.pageNo);
    if (sequence !== itemPageLoadSequence) return false;
    const persistedTotal = result.total ?? 0;
    const total = getRemoteItemTotal(persistedTotal, remoteItemCreates.size);
    const effectivePageNo = clampRemoteItemPageNo(
      nextState.pageNo,
      nextState.pageSize,
      total,
    );
    if (effectivePageNo !== nextState.pageNo) {
      result = await requestItemPage(effectivePageNo);
      if (sequence !== itemPageLoadSequence) return false;
      nextState.pageNo = effectivePageNo;
    }
    remotePersistedItemTotal.value = result.total ?? persistedTotal;
    remotePendingCreateCount.value = remoteItemCreates.size;
    itemPageState.value = {
      ...nextState,
      total: getRemoteItemTotal(
        remotePersistedItemTotal.value,
        remoteItemCreates.size,
      ),
    };
    rememberRemoteItemOriginals(result.list ?? []);
    const visibleItems = applyRemoteItemCache(
      result.list ?? [],
      nextState.pageNo,
      nextState.pageSize,
      remotePersistedItemTotal.value,
    );
    await syncRemoteVisibleItems(visibleItems);
    if (sequence !== itemPageLoadSequence) return false;
    return true;
  } finally {
    if (sequence === itemPageLoadSequence) {
      itemPageLoading.value = false;
    }
  }
}

async function handleRemoteRowsDeleted() {
  if (!isRemoteItemPaging.value) return;
  try {
    await loadSaleCartItemPage({ pageNo: itemPageState.value.pageNo });
  } catch {
    message.error('删除后的明细补位加载失败，请重试');
  }
}

async function handleRemoteBlankRowAdded(item: ErpSaleCartApi.SaleCartItem) {
  if (!isRemoteItemPaging.value) return;
  const sequence = ++remoteBlankRowAddSequence;
  const localKey = getRemoteLocalItemKey(item);
  const previousItems = [...(formData.value?.items ?? [])];
  const previousPageState = { ...itemPageState.value };
  remoteItemCreates.set(localKey, { ...item });
  syncRemoteItemPagingTotal();
  const navigationPlan = getRemoteCreatedItemNavigationPlan({
    createdKeys: [...remoteItemCreates.keys()],
    currentPageNo: previousPageState.pageNo,
    orderField: previousPageState.orderField,
    pageSize: previousPageState.pageSize,
    persistedTotal: remotePersistedItemTotal.value,
    targetKey: localKey,
  });
  if (!navigationPlan) {
    remoteItemCreates.delete(localKey);
    syncRemoteItemPagingTotal();
    return;
  }
  try {
    await getItemFormInstance()?.clearRemoteItemSort?.();
    if (sequence !== remoteBlankRowAddSequence) return;
    if (navigationPlan.requiresPageRequest) {
      itemPageState.value = {
        ...itemPageState.value,
        orderDirection: undefined,
        orderField: undefined,
        pageNo: navigationPlan.targetPageNo,
        total: getRemoteItemTotal(
          remotePersistedItemTotal.value,
          remoteItemCreates.size,
        ),
      };
      const loaded = await loadSaleCartItemPage({
        orderDirection: undefined,
        orderField: undefined,
        pageNo: navigationPlan.targetPageNo,
      });
      if (!loaded || sequence !== remoteBlankRowAddSequence) return;
    } else {
      const persistedRows =
        navigationPlan.targetPageNo === previousPageState.pageNo
          ? previousItems.filter((row) => row.id)
          : [];
      itemPageState.value = {
        ...itemPageState.value,
        orderDirection: undefined,
        orderField: undefined,
        pageNo: navigationPlan.targetPageNo,
        total: getRemoteItemTotal(
          remotePersistedItemTotal.value,
          remoteItemCreates.size,
        ),
      };
      await syncRemoteVisibleItems(
        applyRemoteItemCache(
          persistedRows,
          navigationPlan.targetPageNo,
          previousPageState.pageSize,
          remotePersistedItemTotal.value,
        ),
        { refreshAuxiliary: false },
      );
      if (sequence !== remoteBlankRowAddSequence) return;
    }
    await getItemFormInstance()?.focusRemoteItemByKey?.(
      localKey,
      'product',
      false,
    );
  } catch {
    if (sequence !== remoteBlankRowAddSequence) return;
    remoteItemCreates.delete(localKey);
    syncRemoteItemPagingTotal();
    itemPageState.value = previousPageState;
    await syncRemoteVisibleItems(previousItems, { refreshAuxiliary: false });
    await nextTick();
    await getItemFormInstance()?.restoreRemoteItemSort?.(
      previousPageState.orderField,
      previousPageState.orderDirection,
    );
    message.error('新增明细定位失败，请重试');
  }
}

async function loadAllSaleCartItems(
  cartId: number,
  options: { mask?: boolean } = {},
) {
  const pageSize = 200;
  const firstPage = await getSaleCartItemPage({
    cartId,
    mask: options.mask ?? false,
    pageNo: 1,
    pageSize,
  });
  const rows = [...(firstPage.list ?? [])];
  const total = firstPage.total ?? rows.length;
  const pageCount = Math.ceil(total / pageSize);
  for (let pageNo = 2; pageNo <= pageCount; pageNo++) {
    const page = await getSaleCartItemPage({
      cartId,
      mask: options.mask ?? false,
      pageNo,
      pageSize,
    });
    rows.push(...(page.list ?? []));
  }
  return rows;
}

async function buildMergedRemoteItemsForSubmit() {
  if (!isRemoteItemPaging.value || !formData.value?.id) {
    return (
      getItemFormInstance()?.getDraftItems?.() ?? formData.value?.items ?? []
    );
  }
  recordRemoteItemChanges(
    getItemFormInstance()?.getDraftItems?.() ?? formData.value.items ?? [],
  );
  await consolidateRemoteCreatesWithMatches();
  const updateItems = [...remoteItemEdits.values()].map((item) => ({
    ...stripSaleItemClientFields(item),
    operation: 'update' as const,
  }));
  const insertItems = mergeSaleCartItems([...remoteItemCreates.values()]).map(
    (item) => {
      const next = { ...item } as Record<string, any>;
      delete next.id;
      delete next.cartId;
      delete next.seq;
      delete next.clientRowKey;
      delete next.operation;
      return {
        ...next,
        operation: 'insert' as const,
      };
    },
  );
  const deleteItems = [...remoteItemDeletes].map((id) => ({
    id,
    operation: 'delete' as const,
  }));
  return [...updateItems, ...insertItems, ...deleteItems];
}

async function handleFirstApprove() {
  if (!formData.value?.id) return;
  await firstApproveSaleCart(formData.value.id);
  message.success('初审成功');
  await modalApi.close();
  emit('success');
}

async function handleBillingConfirm() {
  if (!formData.value?.id) return;
  const result = await confirmSaleCart(formData.value.id);
  message.success(buildSaleCartConfirmSuccessMessage(result));
  await modalApi.close();
  emit('success');
}

async function handleCancelFirstApprove() {
  if (!formData.value?.id) return;
  await cancelFirstApproveSaleCart(formData.value.id);
  message.success('已撤销初审并释放库存占用');
  await modalApi.close();
  emit('success');
}

async function handleFinalApprove() {
  if (!formData.value?.id) return;
  const result = await finalApproveSaleCart(formData.value.id);
  const ids = Array.isArray(result) ? result : [result];
  message.success(`终审成功，已生成 ${ids.length} 张销售单`);
  await modalApi.close();
  emit('success');
}

async function handleBasicEdit() {
  if (!formData.value?.id) return;
  const data = { ...formData.value };
  await modalApi.close();
  emit('editBasic', data);
}

function handleConvertQuote() {
  if (!formData.value?.id) return;
  const cartId = formData.value.id;
  const cartNo = formData.value.no;
  AntdModal.confirm({
    title: `确认将 ${cartNo} 转为报价订单吗？`,
    content: '转换后此手推车将被删除。',
    async onOk() {
      const items = await loadAllSaleCartItems(cartId, { mask: false });
      const itemIds = items
        .map((item) => item.id)
        .filter((id): id is number => typeof id === 'number');
      await convertSaleCartToQuote(cartId, itemIds);
      message.success('已转为报价订单');
      await modalApi.close();
      emit('success');
    },
  });
}

function showStockShortageError(shortages: any[]) {
  message.error(
    `库存不足，不能提交，请修改数量或更换有库存的仓库：\n${buildSaleCartStockShortageText(shortages, 5)}`,
    6,
  );
}

async function saveSaleCartDraft({
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
  if (!isCreatingDraft && !isUpdatingDraft) {
    return true;
  }
  if (draftSaving) {
    return false;
  }

  draftSaving = true;
  modalApi.lock();
  try {
    const data = await buildCurrentSaleCartPayload();
    if (
      isCreatingDraft &&
      !hasValidSaleDraftItems(data.items ?? [], { priceMode: 'none' })
    ) {
      draftSaved = closeWhenEmpty;
      message.warning('未选择明细，不生成草稿');
      return closeWhenEmpty;
    }
    if (isCreatingDraft) {
      await createSaleCart(data);
    } else {
      data.id = formData.value!.id;
      data.saleUserId = formData.value?.saleUserId ?? userStore.userInfo?.id;
      await updateSaleCartDraft(data);
    }
    draftSaved = true;
    message.success(
      successMessage ??
        (isCreatingDraft ? '未提交内容已自动保存为草稿' : '草稿修改已自动保存'),
    );
    emit('success');
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
  draftGenerateLoading.value = true;
  try {
    const isCreatingDraft = formType.value === 'create';
    const saved = await saveSaleCartDraft({
      closeWhenEmpty: false,
      failureMessage: isCreatingDraft
        ? '草稿生成失败，请稍后重试'
        : '草稿保存失败，请稍后重试',
      successMessage: isCreatingDraft ? '草稿生成成功' : '草稿保存成功',
    });
    if (!saved) return;

    skipDraftOnClose = true;
    await modalApi.close();
  } finally {
    draftGenerateLoading.value = false;
  }
}

function handleSubmitDraftFromDetail() {
  if (!formData.value?.id) return;
  const cartId = formData.value.id;
  const cartNo = formData.value.no;
  AntdModal.confirm({
    title: cartNo ? `确认提交草稿 ${cartNo} 吗？` : '确认提交该草稿吗？',
    content: '提交后将进入待开单确认状态，确认前仍可编辑。',
    async onOk() {
      modalApi.lock();
      try {
        const result = await submitSaleCart(cartId);
        message.success(buildSaleCartSubmitSuccessMessage(result), 6);
        skipDraftOnClose = true;
        await modalApi.close();
        emit('success');
      } finally {
        modalApi.unlock();
      }
    },
  });
}

async function handleEditFromDetail() {
  if (!formData.value?.id || !canEditFromDetail.value) return;
  await switchDetailToEdit({ ...formData.value });
}

async function switchDetailToEdit(initialData: ErpSaleCartApi.SaleCart) {
  if (!initialData.id) return;
  const sequence = ++formLoadSequence;
  detailLoadSequence += 1;
  detailLoadError.value = '';
  editLoadError.value = '';
  detailLoading.value = true;
  skipDraftOnClose = false;
  draftSaved = false;
  draftSaving = false;
  modalApi.lock();
  isHydratingFormValues.value = true;
  try {
    const [sourceData] = await Promise.all([
      getSaleCart(initialData.id, {
        includeItems: false,
        mask: false,
      }),
      loadHiddenFields(),
      loadFirstApproveConfig(),
    ]);
    if (sequence !== formLoadSequence) {
      return;
    }

    const loadedData = hydrateSaleCustomerFromFallback(
      normalizeLoadedSaleCart(sourceData),
      initialData,
    );
    loadedData.items = [];
    resetRemoteItemState();
    await applyFormMode('edit', loadedData);
    if (sequence !== formLoadSequence) {
      return;
    }
    await formApi.resetForm();
    formData.value = loadedData;
    currentSaleDeptId.value = formData.value.deptId;
    detailLoading.value = false;
    await nextTick();
    if (sequence !== formLoadSequence) {
      return;
    }
    await loadSaleDeptOptions(formData.value.customerId, formData.value.deptId);
    await loadCustomerPriceLevel(formData.value.customerId);
    if (sequence !== formLoadSequence) {
      return;
    }
    await formApi.setValues(
      buildSaleDocumentDetailFormValues(formData.value, formType.value),
      false,
    );
    await loadSaleCartItemPage({ pageNo: 1 });
    await nextTick();
    if (sequence !== formLoadSequence) {
      return;
    }
    await getItemFormInstance()?.waitForItemsReady?.();
  } catch {
    if (sequence === formLoadSequence) {
      formData.value = undefined;
      editLoadError.value = '销售手推车草稿加载失败，请关闭页面后重新进入';
    }
  } finally {
    if (sequence === formLoadSequence) {
      isHydratingFormValues.value = false;
      detailLoading.value = false;
      modalApi.unlock();
      void queueFocusFirstBasicFormControl(sequence);
    }
  }
}

function hasSaleCartItemsForSubmit(
  items: ErpSaleCartApi.SaleCartItem[] = formData.value?.items ?? [],
) {
  if (isRemoteItemPaging.value && formData.value?.id) {
    return itemPageState.value.total > 0;
  }
  return items.some((item) => Boolean(item));
}

const [Modal, modalApi] = useVbenModal({
  async onBeforeClose() {
    if (skipDraftOnClose || draftSaved) {
      return true;
    }
    return saveSaleCartDraft();
  },
  async onCancel() {
    skipDraftOnClose = true;
    await modalApi.close();
  },
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;

    const itemFormInstance = getItemFormInstance();
    let data: ErpSaleCartApi.SaleCart;

    try {
      data = await buildCurrentSaleCartPayload();
      if (!hasSaleCartItemsForSubmit(data.items ?? [])) {
        message.error('请先添加销售手推车产品');
        return;
      }
      itemFormInstance?.validate(
        (data.items ?? []).filter((item) => item.operation !== 'delete'),
        { requireItems: !isRemoteItemPaging.value },
      );
    } catch (error: any) {
      message.error(error.message || '子表单校验失败');
      return;
    }

    const stockShortages = itemFormInstance?.getStockShortages?.() ?? [];
    const isCreate = formType.value === 'create';
    const shouldSubmitDraft = isEditingDraft.value;
    const editingCartId = formData.value?.id;
    if (stockShortages.length > 0) {
      showStockShortageError(stockShortages);
      return;
    }
    if (!isCreate && !editingCartId) {
      message.error('销售手推车编号缺失，请关闭后重新打开再试');
      return;
    }

    modalApi.lock();
    if (!isCreate) {
      data.saleUserId = formData.value?.saleUserId ?? userStore.userInfo?.id;
    }
    try {
      if (isCreate) {
        const result = await createAndSubmitSaleCart(data);
        message.success(buildSaleCartSubmitSuccessMessage(result), 6);
      } else {
        await updateSaleCart(data);
        if (shouldSubmitDraft) {
          const result = await submitSaleCart(editingCartId!);
          message.success(buildSaleCartSubmitSuccessMessage(result), 6);
        } else {
          message.success($t('ui.actionMessage.operationSuccess'));
        }
      }
      skipDraftOnClose = true;
      await modalApi.close();
      emit('success');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    isSaleCartFormOpen.value = isOpen;
    if (!isOpen) {
      detailLoadSequence += 1;
      formLoadSequence += 1;
      saleDeptLoadSeq += 1;
      saleDeptSyncing = false;
      isHydratingFormValues.value = false;
      detailLoading.value = false;
      detailLoadError.value = '';
      editLoadError.value = '';
      formData.value = undefined;
      resetRemoteItemState();
      saleDeptOptions.value = [];
      currentSaleDeptId.value = undefined;
      currentCustomerPriceLevel.value = undefined;
      return;
    }

    const data = modalApi.getData<{
      id?: number;
      importData?: SaleCartImportResp;
      initialData?: ErpSaleCartApi.SaleCart;
      type: string;
    }>();
    skipDraftOnClose = false;
    draftSaved = false;
    draftSaving = false;
    draftGenerateLoading.value = false;
    const isCopy = data.type === 'copy';
    editLoadError.value = '';

    if (data.type === 'detail' && data.id) {
      detailLoading.value = true;
      detailLoadError.value = '';
      formData.value = undefined;
      const sequence = ++detailLoadSequence;
      await applyFormMode('detail');
      if (sequence !== detailLoadSequence) {
        return;
      }
      void loadDetailData(data.id, sequence);
      return;
    }

    if (data.id) {
      const sequence = ++formLoadSequence;
      const targetFormType = isCopy ? 'create' : data.type;
      formType.value = targetFormType;
      modalApi.setState({ fullscreen: true });
      formApi.setDisabled(false);
      formData.value = undefined;
      saleDeptOptions.value = [];
      currentSaleDeptId.value = undefined;
      currentCustomerPriceLevel.value = undefined;
      saleDeptLoadSeq += 1;
      modalApi.lock();
      isHydratingFormValues.value = true;
      try {
        const [sourceData] = await Promise.all([
          getSaleCart(data.id, {
            includeItems: isCopy,
            mask: false,
          }),
          loadHiddenFields(),
          loadFirstApproveConfig(),
        ]);
        if (sequence !== formLoadSequence) {
          return;
        }

        const loadedData = hydrateSaleCustomerFromFallback(
          normalizeLoadedSaleCart(sourceData),
          data.initialData,
        );
        await applyFormMode(targetFormType, loadedData);
        if (sequence !== formLoadSequence) {
          return;
        }
        await formApi.resetForm();
        formData.value = isCopy
          ? buildSaleCartCopyData(loadedData)
          : loadedData;
        if (!isCopy) {
          formData.value.items = [];
          resetRemoteItemState();
        } else {
          resetRemoteItemState();
        }

        await loadSaleDeptOptions(
          formData.value.customerId,
          formData.value.deptId,
        );
        await loadCustomerPriceLevel(formData.value.customerId);
        if (sequence !== formLoadSequence) {
          return;
        }
        await formApi.setValues(
          buildSaleDocumentDetailFormValues(formData.value, formType.value),
        );
        if (!isCopy) {
          await loadSaleCartItemPage({ pageNo: 1 });
        }
        await nextTick();
        if (sequence !== formLoadSequence) {
          return;
        }
        await getItemFormInstance()?.waitForItemsReady?.();
      } catch {
        if (sequence === formLoadSequence) {
          formData.value = undefined;
          editLoadError.value = '销售手推车草稿加载失败，请关闭页面后重新进入';
        }
      } finally {
        if (sequence === formLoadSequence) {
          isHydratingFormValues.value = false;
          modalApi.unlock();
          void queueFocusFirstBasicFormControl(sequence);
        }
      }
      return;
    }

    if (!data.id) {
      const sequence = ++formLoadSequence;
      resetRemoteItemState();
      modalApi.lock();
      try {
        const [defaultAccountId] = await Promise.all([
          loadDefaultAccountId(),
          loadHiddenFields(),
          loadFirstApproveConfig(),
        ]);
        if (sequence !== formLoadSequence) {
          return;
        }
        await applyFormMode(isCopy ? 'create' : data.type);
        if (sequence !== formLoadSequence) {
          return;
        }

        // The modal reuses the same form instance. Clear values from the
        // previous open before applying create defaults, otherwise selects can
        // display a stale customer/department while formData remains empty.
        // Keep the modal locked through this reset so a user's first customer
        // selection cannot be overwritten by asynchronous initialization.
        await formApi.resetForm();
        const userInfo = userStore.userInfo;
        saleDeptOptions.value = [];
        currentSaleDeptId.value = undefined;
        currentCustomerPriceLevel.value = undefined;
        await refreshFormSchema();
        if (sequence !== formLoadSequence) {
          return;
        }
        const importValues = normalizeImportData(data.importData);
        const defaultUserValues = buildSaleCurrentUserFormDefaults(userInfo, [
          'saleUserId',
        ]);
        const createValues = {
          cartTime: getCurrentTimestamp(),
          ...defaultUserValues,
          accountId: defaultAccountId,
          deptId: undefined,
          feeAmount: 0,
          ...importValues,
        };
        formData.value = {
          items: [],
          ...createValues,
        };
        await refreshFormSchema(formData.value);
        await formApi.setValues({
          ...createValues,
        });
      } finally {
        if (sequence === formLoadSequence) {
          modalApi.unlock();
          void queueFocusFirstBasicFormControl(sequence);
        }
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
  if (
    payload.pageSize !== undefined &&
    payload.pageSize !== itemPageState.value.pageSize
  ) {
    remoteStockMatchCache.clear();
    remoteStockNoMatchKeys.clear();
  }
  recordRemoteItemChanges(
    getItemFormInstance()?.getDraftItems?.() ?? formData.value?.items ?? [],
  );
  try {
    await loadSaleCartItemPage(payload);
  } catch {
    message.error('明细分页加载失败，请重试');
  }
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
      <div class="sale-cart-detail-title">
        <div class="sale-cart-detail-title__text">
          <span>{{ getTitle }}</span>
          <small
            v-if="
              formType !== 'create' &&
              formData?.no &&
              isDetailFieldVisible('no')
            "
          >
            {{ formatDetailText(formData?.no) }}
          </small>
        </div>
        <span
          v-if="
            formType !== 'create' &&
            formData?.status !== undefined &&
            isDetailFieldVisible('status')
          "
          class="sale-cart-status"
          :class="detailStatus.className"
        >
          {{ detailStatus.label }}
        </span>
      </div>
    </template>

    <div
      class="sale-cart-detail-view"
      :class="{ 'erp-form-focus-highlight': formType !== 'detail' }"
    >
      <div
        v-if="formType === 'detail' && detailLoading"
        class="sale-cart-detail-load-state"
      >
        正在加载完整明细，请稍候…
      </div>
      <div
        v-else-if="formType === 'detail' && detailLoadError"
        class="sale-cart-detail-load-state is-error"
      >
        {{ detailLoadError }}
      </div>
      <div
        v-else-if="formType !== 'detail' && editLoadError"
        class="sale-cart-detail-load-state is-error"
      >
        {{ editLoadError }}
      </div>

      <section
        v-if="!editLoadError && (formType !== 'detail' || formData)"
        ref="basicFormRef"
        class="sale-cart-detail-section"
        @keydown.capture="handleBasicFormEnter"
      >
        <header class="sale-cart-detail-section__header">
          <span class="sale-cart-detail-section__title">基本信息</span>
        </header>

        <div v-if="formType === 'detail'" class="sale-cart-detail-grid">
          <div v-if="isDetailFieldVisible('no')" class="sale-cart-detail-field">
            <span class="sale-cart-detail-field__label">手推车单号</span>
            <span
              class="sale-cart-detail-field__value"
              :title="formatDetailText(formData?.no)"
            >
              {{ formatDetailText(formData?.no) }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('cartTime')"
            class="sale-cart-detail-field"
          >
            <span class="sale-cart-detail-field__label">开单时间</span>
            <span
              class="sale-cart-detail-field__value"
              :title="formatDetailDate(formData?.cartTime)"
            >
              {{ formatDetailDate(formData?.cartTime) }}
            </span>
          </div>
          <div
            v-if="
              formData?.billingConfirmUserName || formData?.billingConfirmTime
            "
            class="sale-cart-detail-field"
          >
            <span class="sale-cart-detail-field__label">开单确认人</span>
            <span
              class="sale-cart-detail-field__value"
              :title="formatDetailText(formData?.billingConfirmUserName)"
            >
              {{ formatDetailText(formData?.billingConfirmUserName) }}
            </span>
          </div>
          <div
            v-if="formData?.billingConfirmTime"
            class="sale-cart-detail-field"
          >
            <span class="sale-cart-detail-field__label">开单确认时间</span>
            <span
              class="sale-cart-detail-field__value"
              :title="formatDetailDate(formData?.billingConfirmTime)"
            >
              {{ formatDetailDate(formData?.billingConfirmTime) }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('customerId')"
            class="sale-cart-detail-field"
          >
            <span class="sale-cart-detail-field__label">客户</span>
            <button
              v-if="canOpenCustomerDetail"
              type="button"
              class="sale-cart-detail-field__value sale-cart-detail-field__link"
              :title="formatDetailText(formData?.customerName)"
              @click="handleOpenCustomerDetail"
            >
              <span>{{ formatDetailText(formData?.customerName) }}</span>
              <span aria-hidden="true">↗</span>
            </button>
            <span v-else class="sale-cart-detail-field__value">-</span>
          </div>
          <div
            v-if="isDetailFieldVisible('saleUserId')"
            class="sale-cart-detail-field"
          >
            <span class="sale-cart-detail-field__label">销售人员</span>
            <span
              class="sale-cart-detail-field__value"
              :title="formatDetailText(formData?.saleUserName)"
            >
              {{ formatDetailText(formData?.saleUserName) }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('deptId')"
            class="sale-cart-detail-field"
          >
            <span class="sale-cart-detail-field__label">所属部门</span>
            <span
              class="sale-cart-detail-field__value"
              :title="formatDetailText(formData?.deptName)"
            >
              {{ formatDetailText(formData?.deptName) }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('freightType')"
            class="sale-cart-detail-field"
          >
            <span class="sale-cart-detail-field__label">运费类型</span>
            <span
              class="sale-cart-detail-field__value"
              :title="formatDetailText(formData?.freightType)"
            >
              {{ formatDetailText(formData?.freightType) }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('feeAmount')"
            class="sale-cart-detail-field"
          >
            <span class="sale-cart-detail-field__label">费用</span>
            <span
              class="sale-cart-detail-field__value sale-cart-detail-field__amount"
            >
              {{
                formatDetailAmount(formData?.feeAmount ?? formData?.otherPrice)
              }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('deliveryMethod')"
            class="sale-cart-detail-field"
          >
            <span class="sale-cart-detail-field__label">送货方式</span>
            <span
              class="sale-cart-detail-field__value"
              :title="formatDetailText(formData?.deliveryMethod)"
            >
              {{ formatDetailText(formData?.deliveryMethod) }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('logisticsCompany')"
            class="sale-cart-detail-field"
          >
            <span class="sale-cart-detail-field__label">物流公司</span>
            <span
              class="sale-cart-detail-field__value"
              :title="formatDetailText(formData?.logisticsCompany)"
            >
              {{ formatDetailText(formData?.logisticsCompany) }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('vin')"
            class="sale-cart-detail-field"
          >
            <span class="sale-cart-detail-field__label">VIN码</span>
            <span
              class="sale-cart-detail-field__value sale-cart-detail-field__value--with-action"
              :title="formatDetailText(formData?.vin)"
            >
              <span>{{ formatDetailText(formData?.vin) }}</span>
              <Button
                size="small"
                type="link"
                :loading="vinRecognizing"
                @click="handleRecognizeVin(formData?.vin)"
              >
                识别
              </Button>
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('contactPerson')"
            class="sale-cart-detail-field"
          >
            <span class="sale-cart-detail-field__label">联系人</span>
            <span
              class="sale-cart-detail-field__value"
              :title="formatDetailText(formData?.contactPerson)"
            >
              {{ formatDetailText(formData?.contactPerson) }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('contactPhone')"
            class="sale-cart-detail-field"
          >
            <span class="sale-cart-detail-field__label">联系电话</span>
            <span
              class="sale-cart-detail-field__value"
              :title="formatDetailText(formData?.contactPhone)"
            >
              {{ formatDetailText(formData?.contactPhone) }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('deliveryAddress')"
            class="sale-cart-detail-field"
          >
            <span class="sale-cart-detail-field__label">送货地址</span>
            <span
              class="sale-cart-detail-field__value"
              :title="formatDetailText(formData?.deliveryAddress)"
            >
              {{ formatDetailText(formData?.deliveryAddress) }}
            </span>
          </div>
          <div
            v-if="isDetailFieldVisible('remark')"
            class="sale-cart-detail-field"
          >
            <span class="sale-cart-detail-field__label">备注</span>
            <span
              class="sale-cart-detail-field__value"
              :title="formatDetailText(formData?.remark)"
            >
              {{ formatDetailText(formData?.remark) }}
            </span>
          </div>
        </div>

        <Form
          v-else
          class="sale-cart-edit-form sale-cart-edit-form--editable"
        />

        <div
          v-if="
            formData?.customerId &&
            isDetailFieldVisible('customerId') &&
            isDetailFieldVisible('customerReceivableInfo')
          "
          class="sale-cart-detail-receivable"
        >
          <CustomerReceivableSummary :customer-id="formData?.customerId" />
        </div>
      </section>

      <section
        v-if="
          !editLoadError &&
          (formType !== 'detail' || formData) &&
          isDetailFieldVisible('items')
        "
        class="sale-cart-detail-section"
      >
        <header class="sale-cart-detail-section__header">
          <span class="sale-cart-detail-section__title">手推车产品清单</span>
          <div class="sale-cart-detail-section__tools">
            <span class="sale-cart-detail-count">
              {{ detailItemCount }} 项产品
            </span>
          </div>
        </header>
        <div class="sale-cart-detail-items">
          <ItemForm
            v-if="formData"
            ref="itemFormRef"
            :items="formData?.items ?? []"
            :disabled="formType === 'detail'"
            compact
            :document-id="formData?.id"
            :enable-batch-edit="canBatchUpdateItems"
            :fee-amount="formData?.feeAmount ?? formData?.otherPrice ?? 0"
            :hidden-fields="hiddenFields"
            :dept-id="currentSaleDeptId"
            :customer-price-level="currentCustomerPriceLevel"
            :item-page-loading="itemPageLoading"
            :item-pagination="itemPageState"
            :price-type="formData?.priceType"
            :remote-paging="isRemoteItemPaging"
            :remote-sort-locked="remoteItemSortLocked"
            :shortcut-active="isSaleCartFormOpen"
            :suspend-price-auto-refresh="isHydratingFormValues"
            @batch-update-success="reloadSaleCartDetail"
            @import="handleImport"
            @page-change="handleItemPageChange"
            @remote-blank-row-added="handleRemoteBlankRowAdded"
            @remote-rows-deleted="handleRemoteRowsDeleted"
            @request-submit="handleLastInputEnterConfirm"
            @remote-stock-selection-requested="
              handleRemoteStockSelectionRequested
            "
            @update:items="handleUpdateItems"
            @update:summary="handleUpdateSummary"
          />
        </div>
        <div class="sale-cart-document-summary">
          <strong>单据合计</strong>
          <span v-if="isDetailFieldVisible('totalCount')">
            数量
            <b>{{ erpCountInputFormatter(formData?.totalCount || 0) }}</b>
          </span>
          <span
            v-if="
              isDetailFieldVisible('totalProductPrice') ||
              isDetailPriceFieldHidden('totalProductPrice')
            "
          >
            商品金额
            <b>{{
              formatDetailPriceAmount('totalProductPrice', detailProductAmount)
            }}</b>
          </span>
          <span
            v-if="
              isDetailFieldVisible('discountPrice') ||
              isDetailPriceFieldHidden('discountPrice')
            "
          >
            折让金额
            <b>{{
              isDetailPriceFieldHidden('discountPrice')
                ? '****'
                : `-${formatDetailAmount(formData?.discountPrice)}`
            }}</b>
          </span>
          <span v-if="detailExtraCost.label">
            {{ detailExtraCost.label }}
            <b>{{ formatDetailAmount(detailExtraCost.amount) }}</b>
          </span>
          <span
            v-if="
              isDetailFieldVisible('totalPrice') ||
              isDetailPriceFieldHidden('totalPrice')
            "
            class="sale-cart-document-summary__paid"
          >
            实收金额
            <b>{{
              formatDetailPriceAmount('totalPrice', formData?.totalPrice)
            }}</b>
          </span>
        </div>
      </section>

      <section
        v-if="formType === 'detail' && formData"
        class="sale-cart-detail-section sale-cart-detail-audit"
      >
        <header class="sale-cart-detail-section__header">
          <span class="sale-cart-detail-section__title">审计信息</span>
        </header>
        <ErpAuditInfo title="" :record="formData" />
      </section>
    </div>
    <template #cancelText>
      {{ formType === 'detail' ? '关闭' : '取消' }}
    </template>
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
      <span
        v-if="formType === 'detail' && formData?.pickDeliveryOrderId"
        class="text-warning mr-auto text-sm"
      >
        {{ fulfillmentNotice }}
      </span>
      <Button
        v-if="canSubmitDraftFromDetail"
        type="primary"
        @click="handleSubmitDraftFromDetail"
      >
        提交
      </Button>
      <Button
        v-if="canEditFromDetail"
        type="primary"
        ghost
        @click="handleEditFromDetail"
      >
        编辑
      </Button>
      <Button v-if="canEditRemark" type="primary" @click="handleEditRemark">
        修改备注
      </Button>
      <Button
        v-if="canPrintFromDetail"
        :title="detailPrintTitle"
        type="primary"
        ghost
        @click="handlePrintFromDetail"
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
      <Button
        v-if="showConvertQuoteBtn"
        type="primary"
        ghost
        @click="handleConvertQuote"
      >
        转报价
      </Button>
      <Button
        v-if="
          formType === 'detail' &&
          (formData?.status === 40 || formData?.status === 50)
        "
        type="primary"
        ghost
        @click="handleBasicEdit"
      >
        修改信息
      </Button>
      <Button
        v-if="showBillingConfirmBtn"
        type="primary"
        @click="handleBillingConfirm"
      >
        开单确认
      </Button>
      <Button
        v-if="showFirstApproveBtn"
        type="primary"
        @click="handleFirstApprove"
      >
        初审
      </Button>
      <Button
        v-if="showCancelFirstApproveBtn"
        danger
        @click="handleCancelFirstApprove"
      >
        撤销初审
      </Button>
      <Button
        v-if="showFinalApproveBtn"
        type="primary"
        @click="handleFinalApprove"
      >
        终审
      </Button>
    </template>
  </Modal>
  <AntdModal
    v-model:open="vinResultVisible"
    title="VIN码识别结果"
    width="860px"
    :footer="null"
    class="sale-cart-vin-result-modal"
  >
    <div class="sale-cart-vin-result">
      <div class="sale-cart-vin-result__summary">
        <span>
          VIN码
          <b>{{ vinResult?.vin || '-' }}</b>
        </span>
        <span v-if="vinResult?.message">
          接口消息
          <b>{{ vinResult?.message }}</b>
        </span>
      </div>

      <section class="sale-cart-vin-result__section">
        <h3>基础信息</h3>
        <div
          v-if="vinBasicEntries.length > 0"
          class="sale-cart-vin-result__grid"
        >
          <div v-for="item in vinBasicEntries" :key="item.label">
            <span>{{ item.label }}</span>
            <b :title="item.value">{{ item.value }}</b>
          </div>
        </div>
        <Empty v-else description="暂无基础信息" />
      </section>

      <section
        v-if="vinExtraEntries.length > 0"
        class="sale-cart-vin-result__section"
      >
        <h3>其他信息</h3>
        <div class="sale-cart-vin-result__grid">
          <div v-for="item in vinExtraEntries" :key="item.label">
            <span>{{ item.label }}</span>
            <b :title="item.value">{{ item.value }}</b>
          </div>
        </div>
      </section>

      <section class="sale-cart-vin-result__section">
        <h3>匹配车型列表 model_list</h3>
        <div
          v-if="vinModelList.length > 0"
          class="sale-cart-vin-model-table-wrap"
        >
          <table class="sale-cart-vin-model-table">
            <thead>
              <tr>
                <th>序号</th>
                <th v-for="column in vinModelColumns" :key="column.key">
                  {{ column.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in vinModelList" :key="index">
                <td>{{ index + 1 }}</td>
                <td
                  v-for="column in vinModelColumns"
                  :key="column.key"
                  :title="getVinModelValue(row, [column.key])"
                >
                  {{ getVinModelValue(row, [column.key]) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <Empty v-else description="暂无匹配车型" />
      </section>

      <details class="sale-cart-vin-result__raw">
        <summary>原始返回字段</summary>
        <pre>{{ vinRawText }}</pre>
      </details>
    </div>
  </AntdModal>
  <RemarkModal @success="handleRemarkSuccess" />
  <ImportFormModal @success="handleImportSuccess" />
  <CustomerDetailModal />
</template>

<style scoped>
:deep(.flex-auto.overflow-hidden:has(> .relative > .erp-detail-link-field)) {
  overflow: visible;
}

.sale-cart-detail-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.sale-cart-detail-title__text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.sale-cart-detail-title__text > span {
  line-height: 1.25;
}

.sale-cart-detail-title__text small {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-cart-status {
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

.sale-cart-status::before {
  width: 6px;
  height: 6px;
  background: currentcolor;
  border-radius: 50%;
  content: '';
}

.sale-cart-status.is-draft,
.sale-cart-status.is-pending {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 10%);
}

.sale-cart-status.is-success {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
}

.sale-cart-status.is-info {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 10%);
}

.sale-cart-status.is-muted {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
}

.sale-cart-detail-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: hsl(var(--muted) / 28%);
  font-size: 12px;
}

.sale-cart-detail-load-state {
  display: flex;
  min-height: 72px;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.sale-cart-detail-load-state.is-error {
  color: hsl(var(--destructive));
}

.sale-cart-edit-form :deep(.sale-cart-basic-grid) {
  gap: 0 12px;
  padding: 12px;
}

.sale-cart-edit-form :deep(.sale-cart-basic-grid > div) {
  min-width: 0;
}

.sale-cart-edit-form :deep(.sale-cart-basic-grid > div > label) {
  margin-right: 0;
  padding-right: 10px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  white-space: nowrap;
}

.sale-cart-edit-form :deep(.sale-cart-basic-grid > div > .flex-auto) {
  min-width: 0;
}

.sale-cart-edit-form :deep(.ant-input),
.sale-cart-edit-form :deep(.ant-picker),
.sale-cart-edit-form :deep(.ant-select-selector),
.sale-cart-edit-form :deep(.ant-tree-select .ant-select-selector) {
  min-height: 32px;
  background: hsl(var(--muted) / 48%) !important;
  border-color: hsl(var(--border)) !important;
  border-radius: 6px !important;
  font-size: 12px;
}

.sale-cart-edit-form :deep(.ant-input),
.sale-cart-edit-form :deep(.ant-picker-input > input),
.sale-cart-edit-form :deep(.ant-select-selection-item),
.sale-cart-edit-form :deep(.ant-select-selection-placeholder) {
  font-size: 12px;
}

.sale-cart-edit-form :deep(.ant-input),
.sale-cart-edit-form :deep(.ant-picker) {
  height: 32px;
}

.sale-cart-edit-form :deep(.ant-select-single) {
  height: 32px;
}

.sale-cart-edit-form :deep(.sale-cart-vin-input .ant-input-group-addon) {
  padding: 0;
  background: hsl(var(--background));
  border-color: hsl(var(--border));
}

.sale-cart-edit-form :deep(.sale-cart-vin-recognize-addon) {
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
}

.sale-cart-edit-form
  :deep(.ant-upload-picture-card-wrapper .ant-upload-list-picture-card) {
  display: block;
}

.sale-cart-edit-form
  :deep(.relative.flex.w-full.items-center:has(.ant-upload-wrapper) > div),
.sale-cart-edit-form :deep(.ant-upload-wrapper) {
  display: block;
  width: 100%;
}

.sale-cart-edit-form
  :deep(.ant-upload-picture-card-wrapper .ant-upload-list-item-container),
.sale-cart-edit-form
  :deep(.ant-upload-picture-card-wrapper .ant-upload-select) {
  width: 100% !important;
  height: 32px !important;
  margin: 0 !important;
  background: hsl(var(--muted) / 48%);
  border-color: hsl(var(--border));
  border-radius: 6px;
}

.sale-cart-edit-form
  :deep(.ant-upload-picture-card-wrapper .ant-upload-select .flex-col) {
  flex-direction: row;
  gap: 6px;
  font-size: 12px;
}

.sale-cart-edit-form
  :deep(.ant-upload-picture-card-wrapper .ant-upload-select .mt-2) {
  margin-top: 0;
}

.sale-cart-edit-form :deep(textarea) {
  min-height: 32px !important;
  resize: none;
  white-space: nowrap;
}

.sale-cart-edit-form--editable :deep(.ant-input:not(:disabled)),
.sale-cart-edit-form--editable :deep(.ant-picker:not(.ant-picker-disabled)),
.sale-cart-edit-form--editable
  :deep(.ant-select:not(.ant-select-disabled) .ant-select-selector),
.sale-cart-edit-form--editable
  :deep(.ant-upload-picture-card-wrapper .ant-upload-select) {
  background: hsl(var(--background)) !important;
}

.sale-cart-edit-form--editable :deep(.ant-input:disabled),
.sale-cart-edit-form--editable :deep(.ant-picker-disabled),
.sale-cart-edit-form--editable :deep(.ant-select-disabled .ant-select-selector),
.sale-cart-edit-form--editable :deep(.ant-upload-wrapper .ant-upload-disabled) {
  color: hsl(var(--muted-foreground)) !important;
  background: hsl(var(--muted-foreground) / 14%) !important;
  border-color: hsl(var(--muted-foreground) / 28%) !important;
}

.sale-cart-detail-section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.sale-cart-detail-section__header {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.sale-cart-detail-section__title {
  position: relative;
  padding-left: 10px;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
}

.sale-cart-detail-section__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  background: hsl(var(--primary));
  border-radius: 3px;
  content: '';
}

.sale-cart-detail-section__tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sale-cart-detail-count {
  padding: 2px 8px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
}

.sale-cart-detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px 12px;
  padding: 12px;
}

.sale-cart-detail-field {
  display: grid;
  min-width: 0;
  align-items: center;
  grid-template-columns: 82px minmax(0, 1fr);
}

.sale-cart-detail-field__label {
  min-width: 0;
  padding-right: 10px;
  color: hsl(var(--muted-foreground));
  line-height: 1.2;
  text-align: left;
  white-space: nowrap;
}

.sale-cart-detail-field__value {
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

.sale-cart-detail-field__value > span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-cart-detail-field__value > span:last-child {
  margin-left: auto;
}

.sale-cart-detail-field__value--with-action {
  padding-right: 4px;
}

.sale-cart-detail-field__value--with-action > span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sale-cart-detail-field__value--with-action :deep(.ant-btn) {
  flex: 0 0 auto;
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
}

.sale-cart-detail-field__link {
  width: 100%;
  color: hsl(var(--primary));
  cursor: pointer;
}

.sale-cart-detail-field__link:hover {
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary) / 55%);
}

.sale-cart-detail-field__amount {
  font-variant-numeric: tabular-nums;
}

.sale-cart-detail-receivable {
  padding: 0 12px 12px;
}

.sale-cart-detail-receivable :deep(> div) {
  border-color: hsl(var(--primary) / 20%);
  background: hsl(var(--primary) / 7%);
}

.sale-cart-detail-items {
  padding: 10px 10px 0;
}

.sale-cart-detail-items :deep(.vxe-table) {
  font-size: 11px;
}

.sale-cart-detail-items :deep(.vxe-header--column .vxe-cell),
.sale-cart-detail-items :deep(.vxe-body--column .vxe-cell) {
  padding-right: 4px;
  padding-left: 4px;
}

.sale-cart-detail-items :deep(.vxe-header--column .vxe-cell) {
  white-space: nowrap;
}

.sale-cart-document-summary {
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

.sale-cart-document-summary strong {
  margin-right: auto;
  color: hsl(var(--foreground));
}

.sale-cart-document-summary b {
  margin-left: 5px;
  color: hsl(var(--foreground));
  font-variant-numeric: tabular-nums;
}

.sale-cart-document-summary__paid b {
  color: hsl(var(--success));
}

.sale-cart-detail-audit :deep(.erp-audit-info) {
  padding: 12px;
}

.sale-cart-detail-audit :deep(.erp-audit-info .text-sm) {
  font-size: 12px;
}

.sale-cart-detail-audit :deep(.erp-audit-info > div:first-child) {
  display: none;
}

:global(.sale-cart-form-select-dropdown .ant-select-item),
:global(.sale-cart-form-select-dropdown .ant-select-tree),
:global(.sale-cart-form-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

:global(.sale-cart-vin-result-modal .ant-modal-body) {
  padding-top: 12px;
}

.sale-cart-vin-result {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 12px;
}

.sale-cart-vin-result__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  padding: 8px 10px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 35%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.sale-cart-vin-result__summary b {
  margin-left: 6px;
  color: hsl(var(--foreground));
  font-weight: 500;
}

.sale-cart-vin-result__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sale-cart-vin-result__section h3 {
  margin: 0;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
}

.sale-cart-vin-result__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.sale-cart-vin-result__grid > div {
  display: grid;
  min-width: 0;
  grid-template-columns: 112px minmax(0, 1fr);
  align-items: center;
  min-height: 32px;
  padding: 0 8px;
  background: hsl(var(--muted) / 24%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.sale-cart-vin-result__grid span {
  min-width: 0;
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-cart-vin-result__grid b {
  min-width: 0;
  overflow: hidden;
  color: hsl(var(--foreground));
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-cart-vin-model-table-wrap {
  overflow: auto;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.sale-cart-vin-model-table {
  width: 100%;
  min-width: 780px;
  border-collapse: collapse;
  table-layout: fixed;
}

.sale-cart-vin-model-table th,
.sale-cart-vin-model-table td {
  height: 32px;
  padding: 0 8px;
  overflow: hidden;
  border-bottom: 1px solid hsl(var(--border));
  font-size: 12px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-cart-vin-model-table th {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 35%);
  font-weight: 500;
}

.sale-cart-vin-model-table th:first-child,
.sale-cart-vin-model-table td:first-child {
  width: 48px;
  text-align: center;
}

.sale-cart-vin-model-table tbody tr:last-child td {
  border-bottom: 0;
}

.sale-cart-vin-result__raw {
  color: hsl(var(--muted-foreground));
}

.sale-cart-vin-result__raw summary {
  cursor: pointer;
}

.sale-cart-vin-result__raw pre {
  max-height: 240px;
  padding: 10px;
  margin: 8px 0 0;
  overflow: auto;
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 35%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  font-size: 12px;
}

@media (max-width: 640px) {
  .sale-cart-detail-view {
    padding: 8px;
  }

  .sale-cart-detail-section__header {
    align-items: flex-start;
    flex-direction: column;
    justify-content: center;
    padding-top: 8px;
    padding-bottom: 8px;
  }

  .sale-cart-document-summary {
    align-items: flex-start;
    flex-direction: column;
  }

  .sale-cart-document-summary strong {
    margin-right: 0;
  }

  .sale-cart-vin-result__grid {
    grid-template-columns: 1fr;
  }
}
</style>
