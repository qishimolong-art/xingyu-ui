<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';
import type { ErpSaleConfigApi } from '#/api/erp/sale/config';
import type { ErpCustomerApi } from '#/api/erp/sale/customer';

import { computed, h, ref, onBeforeUnmount, watch } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';

import {
  Form as AForm,
  Modal as AModal,
  Alert,
  Button,
  Checkbox,
  Col,
  DatePicker,
  FormItem,
  Image,
  Input,
  message,
  Popconfirm,
  Row,
  Select,
  Spin,
  Switch,
  Tabs,
  Tag,
} from 'ant-design-vue';

import { getBaseDataSimpleList } from '#/api/erp/base';
import {
  createCustomerArea,
  createCustomerBusinessInfo,
  createCustomerContact,
  createCustomerContract,
  createCustomerExtend,
  createCustomerImage,
  createCustomerTask,
  deleteCustomerArea,
  deleteCustomerBusinessInfo,
  deleteCustomerContact,
  deleteCustomerContract,
  deleteCustomerExtend,
  deleteCustomerImage,
  deleteCustomerTask,
  getCustomer,
  getCustomerContactPage,
  getCustomerContractPage,
  getCustomerAreaPage,
  getCustomerImagePage,
  getCustomerTaskPage,
  getCustomerBusinessInfoPage,
  getCustomerDeptDistribution,
  updateCustomerArea,
  updateCustomerBusinessInfo,
  updateCustomerContact,
  updateCustomerContract,
  updateCustomerDeptDistribution,
  updateCustomerExtend,
  updateCustomerImage,
  updateCustomerTask,
} from '#/api/erp/sale/customer';
import { getSaleConfigPage } from '#/api/erp/sale/config';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';
import { ImageUpload } from '#/components/upload';
import DeptDistributionPanel from './customer-dept-distribution.vue';
import CustomerItemGrid from './customer-item-grid.vue';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import {
  isFieldConfigKnown,
  isEffectiveFieldHidden,
} from '#/views/erp/composables/useFieldConfig';
import { prepareErpArchiveItemColumns } from '#/views/erp/base/utils/archive-list-table';
import CustomerLazySelect from '#/views/erp/sale/components/CustomerLazySelect.vue';
import { mergeCustomerOption } from '#/views/erp/sale/utils/customer-select';
import { fillPriceLevelNameMap } from '#/views/erp/sale/utils/price-level';
import { normalizeCustomerEditor } from '../utils/editor-numbers';
import { focusNextEditableFormControlOnEnter } from '#/views/erp/utils/keyboard';
import { loadCustomerFieldVisibility } from '../utils/field-visibility';
import '#/views/erp/styles/form-focus.css';

import { CUSTOMER_ARCHIVE_HIDDEN_FIELDS } from '../data';
import DeptCreditPanel from './dept-credit-panel.vue';
import CustomerMemberPanel from './customer-member-panel.vue';
import ExtendInfo from './extend-info.vue';

type EditorType =
  | 'area'
  | 'business'
  | 'contact'
  | 'contract'
  | 'extend'
  | 'image'
  | 'task';
type DetailTabKey =
  | 'areas'
  | 'base'
  | 'business'
  | 'contacts'
  | 'contracts'
  | 'deptCredit'
  | 'deptDistribution'
  | 'extends'
  | 'images'
  | 'members'
  | 'tasks';

const emit = defineEmits(['success']);
const FIELD_CONFIG_MODULE = 'customer';
const FIELD_PERMISSION_MODULE = 'erp_customer';
const customer = ref<ErpCustomerApi.Customer>();
const requestedCustomerId = ref<number>();
const activeTab = ref<DetailTabKey>('base');
const visitedTabs = ref(new Set<DetailTabKey>(['base']));
watch(activeTab, (key) => visitedTabs.value.add(key), { immediate: true });
const contacts = ref<ErpCustomerApi.CustomerContact[]>([]);
const contracts = ref<ErpCustomerApi.CustomerContract[]>([]);
const images = ref<ErpCustomerApi.CustomerImage[]>([]);
const tasks = ref<ErpCustomerApi.CustomerTask[]>([]);
const areas = ref<ErpCustomerApi.CustomerArea[]>([]);
const extendsList = ref<ErpCustomerApi.CustomerExtend[]>([]);
const businessInfos = ref<ErpCustomerApi.CustomerBusinessInfo[]>([]);
const loading = ref(false);
const detailLoadError = ref('');
const saving = ref(false);
const imageUploading = ref(false);
const editorVisible = ref(false);
const editorType = ref<EditorType>('contact');
const editorRecord = ref<Record<string, any>>({});
const contractTypeOptions = ref<ErpSaleConfigApi.SaleConfig[]>([]);
const taskLevelOptions = ref<ErpSaleConfigApi.SaleConfig[]>([]);
const customerSimpleOptions = ref<
  Array<Record<string, any> & { label: string; value: number }>
>([]);
const licenseUploaderKey = ref(0);
const storeUploaderKey = ref(0);
const fieldConfigFieldKeys = ref<string[]>([]);
const fieldConfigHiddenFields = ref<string[]>([]);
const fieldConfigLoaded = ref(false);
let configOptionsLoaded = false;
let detailLoadSequence = 0;
let editorSequence = 0;
const hiddenFields = ref<string[]>([]);
const { hasAccessByCodes } = useAccess();
const canMaintain = computed(() => hasAccessByCodes(['erp:customer:update']));
const itemGrids = new Map<string, InstanceType<typeof CustomerItemGrid>>();
function setItemGrid(key: string, value: unknown) {
  if (value) itemGrids.set(key, value as InstanceType<typeof CustomerItemGrid>);
  else itemGrids.delete(key);
}
onBeforeUnmount(() => {
  detailLoadSequence += 1;
});
const canShowCustomerMemberTab = computed(() =>
  hasAccessByCodes(['erp:customer-member:query']),
);
const customerArchiveHiddenFieldSet = new Set<string>([
  ...CUSTOMER_ARCHIVE_HIDDEN_FIELDS,
  'receivableBalance',
  'earliestUnpaidDate',
  'debtDays',
  'creditBlocked',
]);

function isHidden(fieldKey: string) {
  if (customerArchiveHiddenFieldSet.has(fieldKey)) {
    return true;
  }
  if (
    !fieldConfigLoaded.value ||
    !isFieldConfigKnown(fieldKey, {
      fieldConfigFieldKeys: fieldConfigFieldKeys.value,
    })
  ) {
    return true;
  }
  return isEffectiveFieldHidden(fieldKey, {
    fieldConfigHiddenFields: fieldConfigHiddenFields.value,
    roleHiddenFields: hiddenFields.value,
  });
}

async function loadFieldVisibility() {
  const current = detailLoadSequence;
  const snapshot = await loadCustomerFieldVisibility(
    FIELD_CONFIG_MODULE,
    FIELD_PERMISSION_MODULE,
  );
  if (current !== detailLoadSequence) return;
  hiddenFields.value = snapshot.hiddenFields;
  fieldConfigHiddenFields.value = snapshot.configHiddenFields;
  fieldConfigFieldKeys.value = snapshot.config.map((field) => field.fieldName);
  fieldConfigLoaded.value = true;
}

// 名称映射缓存
const userMap = ref<Map<number, string>>(new Map());
const deptMap = ref<Map<number, string>>(new Map());
const routeMap = ref<Map<number, string>>(new Map());
const freightExplainMap = ref<Map<number, string>>(new Map());
const areaConfigMap = ref<Map<number, string>>(new Map());
const customerTypeMap = ref<Map<number, string>>(new Map());
const relationTypeMap = ref<Map<number, string>>(new Map());
const settleMethodMap = ref<Map<number, string>>(new Map());
const invoiceTypeMap = ref<Map<number, string>>(new Map());
const freightTypeMap = ref<Map<number, string>>(new Map());
const transportMethodMap = ref<Map<number, string>>(new Map());
const priceLevelMap = ref<Map<number, string>>(new Map());

const freightSettleMethodOptions = [
  { label: '我方承担', value: 1 },
  { label: '客户承担', value: 2 },
  { label: '双方平摊', value: 3 },
  { label: '月结', value: 4 },
];

function freightSettleMethodLabel(value?: number) {
  return freightSettleMethodOptions.find((o) => o.value === value)?.label;
}

const contactGenderOptions = [
  { label: '男', value: 1 },
  { label: '女', value: 2 },
];

function contactGenderLabel(value?: number) {
  return contactGenderOptions.find((o) => o.value === value)?.label;
}

const contactImportanceOptions = [
  { label: '普通', value: 1 },
  { label: '重要', value: 2 },
  { label: '决策人', value: 3 },
];

function contactImportanceLabel(value?: number) {
  return contactImportanceOptions.find((o) => o.value === value)?.label;
}

// 枚举映射
const dataCenterAuditOptions = [
  { label: '未审核', value: 0 },
  { label: '已审核', value: 1 },
  { label: '驳回', value: 2 },
];
const statusOptions = [
  { label: '开启', value: 0 },
  { label: '关闭', value: 1 },
];

function enumLabel(options: { label: string; value: any }[], value?: any) {
  if (value === undefined || value === null) return '-';
  return options.find((o) => o.value === value)?.label || String(value);
}

function enterpriseMatchText(item?: ErpCustomerApi.Customer) {
  return item?.businessInfoSynced === true ? '已同步' : '未同步';
}

async function loadConfigOptions() {
  if (configOptionsLoaded) return;
  const [
    contractTypes,
    taskLevels,
    users,
    depts,
    routes,
    freightExplains,
    areas,
    relationTypes,
    customerTypes,
    settleMethods,
    invoiceTypes,
    freightTypes,
    transportMethods,
    priceLevels,
  ] = await Promise.all([
    Promise.resolve([]),
    Promise.resolve([]),
    Promise.resolve([]),
    Promise.resolve([]),
    Promise.resolve([]),
    Promise.resolve([]),
    Promise.resolve([]),
    getBaseDataSimpleList('customer_category'),
    getBaseDataSimpleList('customer_type'),
    getBaseDataSimpleList('settle_method'),
    getBaseDataSimpleList('invoice_type'),
    getBaseDataSimpleList('freight_type'),
    getBaseDataSimpleList('delivery_method'),
    getBaseDataSimpleList('price_level'),
  ]);
  contractTypeOptions.value = contractTypes || [];
  taskLevelOptions.value = taskLevels || [];
  // 构建映射
  (users || []).forEach((u: any) => userMap.value.set(u.id, u.nickname));
  // 部门是树形结构，需要递归展平
  function flattenDepts(list: any[]) {
    for (const d of list) {
      deptMap.value.set(d.id, d.name);
      if (d.children?.length) flattenDepts(d.children);
    }
  }
  flattenDepts(depts || []);
  (routes || []).forEach((r: any) => routeMap.value.set(r.id, r.name));
  (freightExplains || []).forEach((f: any) =>
    freightExplainMap.value.set(f.id, f.name),
  );
  (areas || []).forEach((a: any) => areaConfigMap.value.set(a.id, a.name));
  fillCodeMap(relationTypes, relationTypeMap.value, {
    customer: 1,
    customer_supplier: 2,
  });
  fillCodeMap(customerTypes, customerTypeMap.value, {
    car_owner: 1,
    repair_factory: 2,
    terminal_customer: 3,
    customer_supplier: 4,
    supplier: 5,
    store: 6,
    dealer: 7,
  });
  fillCodeMap(settleMethods, settleMethodMap.value, {
    cash: 1,
    credit: 2,
    remittance: 3,
    online_payment: 4,
  });
  fillCodeMap(invoiceTypes, invoiceTypeMap.value, {
    receipt: 1,
    normal_invoice: 2,
    vat_invoice: 3,
  });
  fillCodeMap(freightTypes, freightTypeMap.value, {
    pay_for_customer: 1,
    other: 2,
    self_pay: 3,
    customer_pay: 4,
    delivery_subsidy: 5,
  });
  fillCodeMap(transportMethods, transportMethodMap.value, {
    customer_pickup: 1,
    delivery_service: 2,
    logistics_consignment: 3,
    door_delivery: 4,
  });
  fillPriceLevelNameMap(priceLevels || [], priceLevelMap.value);
  configOptionsLoaded = true;
}

function fillCodeMap(
  list: any[] | undefined,
  target: Map<number, string>,
  valueMap: Record<string, number>,
) {
  (list || []).forEach((item: any) => {
    const value = valueMap[item.code];
    if (value !== undefined) {
      target.set(value, item.name);
    }
  });
}

function baseOptionName(map: Map<number, string>, value?: null | number) {
  if (value === undefined || value === null) return '-';
  return map.get(value) || String(value);
}

function userName(id?: number) {
  if (!id) return '-';
  return userMap.value.get(id) || String(id);
}
function deptName(id?: number) {
  if (!id) return '-';
  return deptMap.value.get(id) || String(id);
}
function routeName(id?: number) {
  if (!id) return '-';
  return routeMap.value.get(id) || String(id);
}
function freightExplainName(id?: number) {
  if (!id) return '-';
  return freightExplainMap.value.get(id) || String(id);
}
function areaConfigName(id?: number) {
  if (!id) return '-';
  return areaConfigMap.value.get(id) || String(id);
}

const currentCustomerId = computed(() => customer.value?.id);
const applicableDeptNames = computed(() =>
  deptNames(customer.value?.deptIds, customer.value?.deptNames),
);
const title = computed(() =>
  customer.value?.name ? `客户详情 - ${customer.value.name}` : '客户详情',
);
const auditCustomer = computed(() => {
  if (!customer.value) return undefined;
  return {
    ...customer.value,
    deptName:
      (customer.value as any).deptName || deptName(customer.value.deptId),
  };
});
const businessRecognitionMessage = computed(() =>
  customer.value?.businessInfoSynced
    ? '已同步工商信息'
    : '可识别营业执照或手动维护工商信息',
);
const businessRecognitionDescription = computed(
  () => '工商信息与企业图片按页展示，可在对应页签继续维护和查看历史记录。',
);
const editorTitle = computed(() => {
  const action = editorRecord.value.id ? '编辑' : '新增';
  const names: Record<EditorType, string> = {
    area: '企业地区',
    business: '工商信息',
    contact: '联系人',
    contract: '客户合同',
    extend: '拓展信息',
    image: '企业图片',
    task: '任务量',
  };
  return `${action}${names[editorType.value]}`;
});

const actionColumn = {
  title: '操作',
  dataIndex: 'actions',
  fixed: 'right' as const,
  width: 120,
};

const baseContactColumns: TableColumnsType<any> = [
  { title: '联系人', dataIndex: 'name', width: 120 },
  { title: '重要性', dataIndex: 'importance', width: 100 },
  { title: '性别', dataIndex: 'gender', width: 80 },
  { title: '手机号', dataIndex: 'mobile', width: 130 },
  { title: '电话', dataIndex: 'telephone', width: 130 },
  { title: '微信', dataIndex: 'wechat', width: 130 },
  { title: '职务', dataIndex: 'position', width: 120 },
  { title: '邮箱', dataIndex: 'email', width: 180 },
  { title: '地址', dataIndex: 'address', width: 220 },
  { title: '生日', dataIndex: 'birthday', width: 120 },
  { title: '最后联系时间', dataIndex: 'lastContactTime', width: 170 },
  { title: '标记', dataIndex: 'flags', width: 280 },
  { title: '备注', dataIndex: 'remark', width: 180 },
  actionColumn,
];
const baseContractColumns: TableColumnsType<any> = [
  { title: '合同编号', dataIndex: 'contractNo', width: 150 },
  { title: '合同类型', dataIndex: 'contractType', width: 120 },
  { title: '主要合同', dataIndex: 'mainContract', width: 100 },
  { title: '返点', dataIndex: 'rebateEnabled', width: 90 },
  { title: '合同日期', dataIndex: 'contractDate', width: 170 },
  { title: '生效日期', dataIndex: 'startTime', width: 170 },
  { title: '终止日期', dataIndex: 'endTime', width: 170 },
  { title: '结算方式', dataIndex: 'settleMethod', width: 120 },
  { title: '运输方式', dataIndex: 'transportMethod', width: 120 },
  { title: '运费结算', dataIndex: 'freightSettleMethod', width: 120 },
  { title: '铺底金额', dataIndex: 'baseAmount', width: 120 },
  { title: '任务量', dataIndex: 'taskAmount', width: 120 },
  { title: '附件', dataIndex: 'attachmentUrl', width: 160 },
  { title: '摘要', dataIndex: 'summary', width: 220 },
  { title: '备注', dataIndex: 'remark', width: 180 },
  actionColumn,
];
const baseTaskColumns: TableColumnsType<any> = [
  { title: '年份', dataIndex: 'year', width: 100 },
  { title: '月份', dataIndex: 'month', width: 100 },
  { title: '任务级别', dataIndex: 'taskLevel', width: 140 },
  { title: '任务量', dataIndex: 'taskAmount', width: 140 },
  { title: '备注', dataIndex: 'remark', width: 220 },
  actionColumn,
];
const baseAreaColumns: TableColumnsType<any> = [
  { title: '地图地址', dataIndex: 'mapAddress', width: 220 },
  { title: '详细地址', dataIndex: 'detailAddress', width: 240 },
  { title: '经度', dataIndex: 'longitude', width: 140 },
  { title: '纬度', dataIndex: 'latitude', width: 140 },
  { title: '默认', dataIndex: 'defaulted', width: 90 },
  { title: '备注', dataIndex: 'remark', width: 180 },
  actionColumn,
];
const baseBusinessColumns: TableColumnsType<any> = [
  { title: '统一社会信用代码', dataIndex: 'creditCode', width: 190 },
  { title: '法人', dataIndex: 'legalPerson', width: 120 },
  { title: '注册资本', dataIndex: 'registeredCapital', width: 140 },
  { title: '成立日期', dataIndex: 'establishDate', width: 140 },
  { title: '经营状态', dataIndex: 'businessStatus', width: 120 },
  { title: '经营范围', dataIndex: 'businessScope', width: 260 },
  { title: '来源', dataIndex: 'source', width: 100 },
  { title: 'OCR原文', dataIndex: 'rawData', width: 90 },
  { title: '备注', dataIndex: 'remark', width: 180 },
  { ...actionColumn, width: 180 },
];
const imageCategories = [
  { key: 'images-license', title: '营业执照', type: '营业执照' },
  { key: 'images-store', title: '门店图片', type: '门店图片' },
  { key: 'images-other', title: '其他图片', type: undefined },
];
const imageColumns = [
  { title: '图片', dataIndex: 'imageUrl' },
  { title: '名称', dataIndex: 'imageName' },
  { title: '类型', dataIndex: 'imageType' },
  { title: '备注', dataIndex: 'remark' },
  actionColumn,
];
const contactColumns = computed<TableColumnsType<any>>(() =>
  prepareErpArchiveItemColumns(baseContactColumns, { rows: contacts.value }),
);
const contractColumns = computed<TableColumnsType<any>>(() =>
  prepareErpArchiveItemColumns(baseContractColumns, { rows: contracts.value }),
);
const taskColumns = computed<TableColumnsType<any>>(() =>
  prepareErpArchiveItemColumns(baseTaskColumns, { rows: tasks.value }),
);
const areaColumns = computed<TableColumnsType<any>>(() =>
  prepareErpArchiveItemColumns(baseAreaColumns, { rows: areas.value }),
);
const businessColumns = computed<TableColumnsType<any>>(() =>
  prepareErpArchiveItemColumns(baseBusinessColumns, {
    rows: businessInfos.value,
  }),
);

const [Modal, modalApi] = useVbenModal({
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      detailLoadSequence += 1;
      resetDetail();
      return;
    }
    const openSequence = ++detailLoadSequence;
    modalApi.setState({ fullscreen: true });
    const data = modalApi.getData<
      ErpCustomerApi.Customer & { activeTab?: DetailTabKey }
    >();
    requestedCustomerId.value = data?.id;
    activeTab.value =
      data?.activeTab === 'members' && !canShowCustomerMemberTab.value
        ? 'base'
        : data?.activeTab || 'base';
    try {
      await Promise.all([loadConfigOptions(), loadFieldVisibility()]);
      if (openSequence !== detailLoadSequence) return;
      if (data?.id) {
        await loadDetail(data.id);
      }
    } catch (error) {
      console.error('Failed to initialize customer detail', error);
      if (openSequence === detailLoadSequence)
        detailLoadError.value = '客户资料加载失败，请稍后重试';
    }
  },
});

function resetDetail() {
  loading.value = false;
  modalApi.unlock();
  customer.value = undefined;
  requestedCustomerId.value = undefined;
  visitedTabs.value = new Set(['base']);
  activeTab.value = 'base';
  detailLoadError.value = '';
  fieldConfigFieldKeys.value = [];
  fieldConfigHiddenFields.value = [];
  fieldConfigLoaded.value = false;
  contacts.value = [];
  contracts.value = [];
  images.value = [];
  tasks.value = [];
  areas.value = [];
  extendsList.value = [];
  businessInfos.value = [];
  editorVisible.value = false;
  editorSequence += 1;
}

async function loadDetail(customerId: number) {
  const sequence = ++detailLoadSequence;
  loading.value = true;
  detailLoadError.value = '';
  modalApi.lock();
  try {
    const customerData = await getCustomer(customerId);
    if (sequence !== detailLoadSequence) return;
    customer.value = customerData;
    if (
      customerData.saleUserId !== null &&
      customerData.saleUserId !== undefined &&
      customerData.saleUserName
    )
      userMap.value.set(customerData.saleUserId, customerData.saleUserName);
    if (
      customerData.developerUserId !== null &&
      customerData.developerUserId !== undefined &&
      customerData.developerUserName
    )
      userMap.value.set(
        customerData.developerUserId,
        customerData.developerUserName,
      );
    if (
      customerData.deptId !== null &&
      customerData.deptId !== undefined &&
      customerData.deptName
    )
      deptMap.value.set(customerData.deptId, customerData.deptName);
    if (
      customerData.routeId !== null &&
      customerData.routeId !== undefined &&
      customerData.routeName
    )
      routeMap.value.set(customerData.routeId, customerData.routeName);
    if (
      customerData.areaId !== null &&
      customerData.areaId !== undefined &&
      customerData.areaName
    )
      areaConfigMap.value.set(customerData.areaId, customerData.areaName);
  } catch (error) {
    if (sequence === detailLoadSequence) {
      console.error('Failed to load customer detail', error);
      detailLoadError.value = '客户资料加载失败，请稍后重试';
    }
  } finally {
    if (sequence === detailLoadSequence) {
      loading.value = false;
      modalApi.unlock();
    }
  }
}

async function handleRetryDetail() {
  if (!requestedCustomerId.value) {
    return;
  }
  detailLoadError.value = '';
  try {
    await Promise.all([loadConfigOptions(), loadFieldVisibility()]);
    await loadDetail(requestedCustomerId.value);
  } catch (error) {
    console.error('Failed to retry customer detail', error);
    detailLoadError.value = '客户资料加载失败，请稍后重试';
  }
}

async function refreshCurrentDetail(deleted = false) {
  await itemGrids.get(String(activeTab.value))?.refreshCurrent(deleted);
  if (activeTab.value === 'images') {
    await Promise.all(
      ['images-license', 'images-store', 'images-other'].map((key) =>
        itemGrids.get(key)?.refreshCurrent(deleted),
      ),
    );
  }
}

async function handleDeptDistributionSuccess() {
  if (currentCustomerId.value) await loadDetail(currentCustomerId.value);
  emit('success');
}

async function handleDeptCreditSuccess() {
  emit('success');
}

async function handleCustomerMemberSuccess() {
  emit('success');
}

function valueOrDash(value?: number | string) {
  return value === undefined || value === null || value === '' ? '-' : value;
}

function deptNames(ids?: number[], names?: string) {
  if (names) {
    return names;
  }
  if (!ids?.length) {
    return '-';
  }
  return ids.map((id) => deptName(id)).join('、');
}

function getImageNameByUrl(url: string) {
  const segments = url.split('/');
  return decodeURIComponent(segments[segments.length - 1] || '图片');
}

function isBusinessInfoFromOcr(item?: ErpCustomerApi.CustomerBusinessInfo) {
  const remark = item?.remark || '';
  return Boolean(
    item?.rawData || remark.includes('OCR') || remark.includes('识别'),
  );
}

function isBusinessInfoRecordFromOcr(record: Record<string, any>) {
  return isBusinessInfoFromOcr(record as ErpCustomerApi.CustomerBusinessInfo);
}

function formatBusinessRawData(rawData?: string) {
  if (!rawData) {
    return '';
  }
  try {
    return JSON.stringify(JSON.parse(rawData), null, 2);
  } catch {
    return rawData;
  }
}

function handleViewBusinessRawData(
  record: ErpCustomerApi.CustomerBusinessInfo,
) {
  AModal.info({
    title: 'OCR 原始结果',
    width: 720,
    zIndex: 3000,
    okText: '关闭',
    content: h(
      'pre',
      {
        style: {
          maxHeight: '60vh',
          overflow: 'auto',
          margin: 0,
          padding: '12px',
          background: 'hsl(var(--muted) / 45%)',
          border: '1px solid hsl(var(--border))',
          borderRadius: '6px',
          color: 'hsl(var(--foreground))',
          fontSize: '12px',
          lineHeight: '18px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        },
      },
      formatBusinessRawData(record.rawData),
    ),
  });
}

function handleViewBusinessRawDataRecord(record: Record<string, any>) {
  handleViewBusinessRawData(record as ErpCustomerApi.CustomerBusinessInfo);
}

async function handleCategoryImageUpload(
  imageType: string,
  value?: string | string[],
) {
  const imageUrl = Array.isArray(value) ? value[0] : value;
  if (
    !imageUrl ||
    !currentCustomerId.value ||
    !canMaintain.value ||
    imageUploading.value
  )
    return;
  const sequence = detailLoadSequence;
  imageUploading.value = true;
  try {
    await createCustomerImage({
      customerId: currentCustomerId.value,
      imageType,
      imageName: getImageNameByUrl(imageUrl),
      imageUrl,
      sort: 0,
    });
    if (sequence !== detailLoadSequence) return;
    message.success('上传成功');
    await refreshCurrentDetail();
  } finally {
    imageUploading.value = false;
    if (imageType === '营业执照') {
      licenseUploaderKey.value += 1;
    } else if (imageType === '门店图片') {
      storeUploaderKey.value += 1;
    }
  }
}

function openEditor(type: EditorType, record?: Record<string, any>) {
  if (!currentCustomerId.value || !canMaintain.value || detailLoadError.value)
    return;
  editorSequence += 1;
  editorType.value = type;
  editorRecord.value = {
    customerId: currentCustomerId.value,
    ...(type === 'extend' || type === 'image' ? { sort: 0 } : {}),
    ...(type === 'task' ? { year: new Date().getFullYear() } : {}),
    ...(type === 'contact' && !record
      ? { importance: 1, companyId: currentCustomerId.value }
      : {}),
    ...record,
  };
  if (type === 'contact') {
    void syncEditorCompanyOption(editorRecord.value);
  }
  editorVisible.value = true;
}

function handleCustomerOptionsChange(options: any[]) {
  customerSimpleOptions.value = options || [];
}

async function syncEditorCompanyOption(record: Record<string, any>) {
  const companyId = record.companyId;
  if (!companyId) {
    return;
  }
  const exists = customerSimpleOptions.value.some(
    (item) => `${item.value ?? item.id}` === `${companyId}`,
  );
  if (exists) {
    return;
  }
  let current = customer.value;
  if (`${current?.id}` !== `${companyId}`) {
    try {
      current = await getCustomer(Number(companyId));
    } catch {
      return;
    }
  }
  if (!current?.id || !current.name) {
    return;
  }
  customerSimpleOptions.value = mergeCustomerOption(
    customerSimpleOptions.value,
    {
      ...current,
      label: current.name,
      value: current.id,
    },
  ) as any[];
}

async function handleSaveEditor() {
  if (
    saving.value ||
    !canMaintain.value ||
    !currentCustomerId.value ||
    detailLoadError.value
  )
    return;
  const sequence = detailLoadSequence;
  const editorRequest = editorSequence;
  const customerId = currentCustomerId.value;
  saving.value = true;
  try {
    let data: any;
    try {
      data = normalizeCustomerEditor(editorType.value, editorRecord.value);
    } catch (error) {
      message.warning((error as Error).message);
      return;
    }
    if (editorType.value === 'contact') {
      await (data.id
        ? updateCustomerContact(data)
        : createCustomerContact(data));
    } else if (editorType.value === 'contract') {
      await (data.id
        ? updateCustomerContract(data)
        : createCustomerContract(data));
    } else if (editorType.value === 'image') {
      await (data.id ? updateCustomerImage(data) : createCustomerImage(data));
    } else if (editorType.value === 'task') {
      await (data.id ? updateCustomerTask(data) : createCustomerTask(data));
    } else if (editorType.value === 'area') {
      await (data.id ? updateCustomerArea(data) : createCustomerArea(data));
    } else if (editorType.value === 'extend') {
      await (data.id ? updateCustomerExtend(data) : createCustomerExtend(data));
    } else {
      await (data.id
        ? updateCustomerBusinessInfo(data)
        : createCustomerBusinessInfo(data));
    }
    if (
      sequence !== detailLoadSequence ||
      editorRequest !== editorSequence ||
      customerId !== currentCustomerId.value
    )
      return;
    editorVisible.value = false;
    message.success('保存成功');
    await refreshCurrentDetail();
  } finally {
    if (sequence === detailLoadSequence) saving.value = false;
  }
}

async function handleDelete(type: EditorType, id?: number) {
  if (!id || !canMaintain.value) return;
  const sequence = detailLoadSequence;
  if (type === 'contact') await deleteCustomerContact(id);
  else if (type === 'contract') await deleteCustomerContract(id);
  else if (type === 'image') await deleteCustomerImage(id);
  else if (type === 'task') await deleteCustomerTask(id);
  else if (type === 'area') await deleteCustomerArea(id);
  else if (type === 'extend') await deleteCustomerExtend(id);
  else await deleteCustomerBusinessInfo(id);
  if (sequence !== detailLoadSequence) return;
  message.success('删除成功');
  await refreshCurrentDetail(true);
}
</script>

<template>
  <Modal
    class="!w-full"
    content-class="p-0"
    :show-confirm-button="false"
    :title="title"
  >
    <Spin :spinning="loading">
      <div v-if="detailLoadError" class="customer-detail-error">
        <Alert
          :message="detailLoadError"
          description="请检查网络连接后重新加载，或关闭页面后再试。"
          show-icon
          type="error"
        />
        <Button type="primary" @click="handleRetryDetail">重新加载</Button>
      </div>

      <Tabs v-else v-model:activeKey="activeTab" class="customer-detail-tabs">
        <Tabs.TabPane key="base" tab="基础信息">
          <div class="customer-detail-page">
            <section class="customer-detail-section">
              <header class="customer-detail-section__header">
                <span class="customer-detail-section__title">基础与联系</span>
              </header>
              <div class="customer-detail-grid">
                <div v-if="!isHidden('code')" class="detail-cell">
                  <span>客户编码</span
                  ><strong>{{ valueOrDash(customer?.code) }}</strong>
                </div>
                <div v-if="!isHidden('name')" class="detail-cell">
                  <span>客户名称</span
                  ><strong>{{ valueOrDash(customer?.name) }}</strong>
                </div>
                <div v-if="!isHidden('shortName')" class="detail-cell">
                  <span>简称</span
                  ><strong>{{ valueOrDash(customer?.shortName) }}</strong>
                </div>
                <div v-if="!isHidden('relationType')" class="detail-cell">
                  <span>往来类别</span
                  ><strong>{{
                    baseOptionName(relationTypeMap, customer?.relationType)
                  }}</strong>
                </div>
                <div v-if="!isHidden('areaId')" class="detail-cell">
                  <span>区域</span
                  ><strong>{{ areaConfigName(customer?.areaId) }}</strong>
                </div>
                <div v-if="!isHidden('customerType')" class="detail-cell">
                  <span>客户类型</span
                  ><strong>{{
                    baseOptionName(customerTypeMap, customer?.customerType)
                  }}</strong>
                </div>
                <div v-if="!isHidden('groupCustomer')" class="detail-cell">
                  <span>集团客户</span
                  ><strong>{{ customer?.groupCustomer ? '是' : '否' }}</strong>
                </div>
                <div
                  v-if="!isHidden('enterpriseMatchStatus')"
                  class="detail-cell"
                >
                  <span>企业匹配</span
                  ><strong>{{ enterpriseMatchText(customer) }}</strong>
                </div>
                <div v-if="!isHidden('contact')" class="detail-cell">
                  <span>联系人</span
                  ><strong>{{ valueOrDash(customer?.contact) }}</strong>
                </div>
                <div v-if="!isHidden('telephone')" class="detail-cell">
                  <span>电话</span
                  ><strong>{{ valueOrDash(customer?.telephone) }}</strong>
                </div>
                <div v-if="!isHidden('mobile')" class="detail-cell">
                  <span>手机</span
                  ><strong>{{ valueOrDash(customer?.mobile) }}</strong>
                </div>
                <div v-if="!isHidden('financeTelephone')" class="detail-cell">
                  <span>财务联系电话</span
                  ><strong>{{
                    valueOrDash(customer?.financeTelephone)
                  }}</strong>
                </div>
                <div
                  v-if="!isHidden('detailAddress')"
                  class="detail-cell customer-detail-cell--wide"
                >
                  <span>详细地址</span
                  ><strong>{{ valueOrDash(customer?.detailAddress) }}</strong>
                </div>
                <div v-if="!isHidden('postCode')" class="detail-cell">
                  <span>邮政编码</span
                  ><strong>{{ valueOrDash(customer?.postCode) }}</strong>
                </div>
                <div v-if="!isHidden('email')" class="detail-cell">
                  <span>邮箱</span
                  ><strong>{{ valueOrDash(customer?.email) }}</strong>
                </div>
              </div>
            </section>

            <section class="customer-detail-section">
              <header class="customer-detail-section__header">
                <span class="customer-detail-section__title">财务与授信</span>
              </header>
              <div class="customer-detail-grid">
                <div v-if="!isHidden('accountName')" class="detail-cell">
                  <span>账户</span
                  ><strong>{{ valueOrDash(customer?.accountName) }}</strong>
                </div>
                <div v-if="!isHidden('settleMethod')" class="detail-cell">
                  <span>结算方式</span
                  ><strong>{{
                    baseOptionName(settleMethodMap, customer?.settleMethod)
                  }}</strong>
                </div>
                <div v-if="!isHidden('settleLocked')" class="detail-cell">
                  <span>结算锁定</span
                  ><strong>{{ customer?.settleLocked ? '是' : '否' }}</strong>
                </div>
                <div v-if="!isHidden('invoiceType')" class="detail-cell">
                  <span>开票类型</span
                  ><strong>{{
                    baseOptionName(invoiceTypeMap, customer?.invoiceType)
                  }}</strong>
                </div>
                <div v-if="!isHidden('minOrderAmount')" class="detail-cell">
                  <span>起订金额</span
                  ><strong>{{ valueOrDash(customer?.minOrderAmount) }}</strong>
                </div>
                <div v-if="!isHidden('freightType')" class="detail-cell">
                  <span>运费类型</span
                  ><strong>{{
                    baseOptionName(freightTypeMap, customer?.freightType)
                  }}</strong>
                </div>
                <div v-if="!isHidden('commissionRate')" class="detail-cell">
                  <span>佣金比例</span
                  ><strong>{{
                    customer?.commissionRate != null
                      ? customer.commissionRate + '%'
                      : '-'
                  }}</strong>
                </div>
                <div v-if="!isHidden('commissionEnabled')" class="detail-cell">
                  <span>启用佣金</span
                  ><strong>{{
                    customer?.commissionEnabled ? '是' : '否'
                  }}</strong>
                </div>
                <div v-if="!isHidden('creditEnabled')" class="detail-cell">
                  <span>白条授信</span
                  ><strong>{{
                    customer?.creditEnabled ? '开启' : '关闭'
                  }}</strong>
                </div>
                <div v-if="!isHidden('creditLimit')" class="detail-cell">
                  <span>授信金额</span
                  ><strong>{{ valueOrDash(customer?.creditLimit) }}</strong>
                </div>
                <div v-if="!isHidden('creditTermDays')" class="detail-cell">
                  <span>授信期限</span
                  ><strong>{{
                    customer?.creditTermDays != null
                      ? `${customer.creditTermDays} 天`
                      : '-'
                  }}</strong>
                </div>
                <div
                  v-if="!isHidden('receivableBalance')"
                  class="detail-cell detail-cell--readonly"
                >
                  <span>当前欠款</span
                  ><strong>{{
                    valueOrDash(customer?.receivableBalance)
                  }}</strong>
                </div>
                <div
                  v-if="!isHidden('earliestUnpaidDate')"
                  class="detail-cell detail-cell--readonly"
                >
                  <span>最早未还欠款</span
                  ><strong>{{
                    valueOrDash(customer?.earliestUnpaidDate)
                  }}</strong>
                </div>
                <div
                  v-if="!isHidden('debtDays')"
                  class="detail-cell detail-cell--readonly"
                >
                  <span>欠款天数</span
                  ><strong>{{
                    customer?.debtDays != null ? `${customer.debtDays} 天` : '-'
                  }}</strong>
                </div>
                <div
                  v-if="!isHidden('creditBlocked')"
                  class="detail-cell detail-cell--readonly customer-detail-cell--wide"
                >
                  <span>授信状态</span>
                  <strong>
                    <Tag v-if="customer?.creditBlocked" color="red">{{
                      customer?.creditBlockedReason || '授信超限'
                    }}</Tag>
                    <Tag v-else-if="customer?.creditEnabled" color="green"
                      >正常</Tag
                    >
                    <span v-else>-</span>
                  </strong>
                </div>
              </div>
            </section>

            <section class="customer-detail-section">
              <header class="customer-detail-section__header">
                <span class="customer-detail-section__title">开票与账户</span>
              </header>
              <div class="customer-detail-grid">
                <div v-if="!isHidden('unifiedCreditCode')" class="detail-cell">
                  <span>统一信用代码</span
                  ><strong>{{
                    valueOrDash(customer?.unifiedCreditCode)
                  }}</strong>
                </div>
                <div v-if="!isHidden('taxNo')" class="detail-cell">
                  <span>纳税人识别号</span
                  ><strong>{{ valueOrDash(customer?.taxNo) }}</strong>
                </div>
                <div
                  v-if="!isHidden('taxPercent')"
                  class="detail-cell detail-cell--readonly"
                >
                  <span>税率</span
                  ><strong>{{
                    customer?.taxPercent != null
                      ? customer.taxPercent + '%'
                      : '-'
                  }}</strong>
                </div>
                <div v-if="!isHidden('bankName')" class="detail-cell">
                  <span>开户行</span
                  ><strong>{{ valueOrDash(customer?.bankName) }}</strong>
                </div>
                <div v-if="!isHidden('bankAccount')" class="detail-cell">
                  <span>开户账号</span
                  ><strong>{{ valueOrDash(customer?.bankAccount) }}</strong>
                </div>
                <div v-if="!isHidden('bankAddress')" class="detail-cell">
                  <span>开户地址</span
                  ><strong>{{ valueOrDash(customer?.bankAddress) }}</strong>
                </div>
                <div v-if="!isHidden('invoiceBankName')" class="detail-cell">
                  <span>开票银行</span
                  ><strong>{{ valueOrDash(customer?.invoiceBankName) }}</strong>
                </div>
                <div v-if="!isHidden('invoiceBankAccount')" class="detail-cell">
                  <span>开票银行账号</span
                  ><strong>{{
                    valueOrDash(customer?.invoiceBankAccount)
                  }}</strong>
                </div>
                <div v-if="!isHidden('invoiceAddress')" class="detail-cell">
                  <span>开票地址</span
                  ><strong>{{ valueOrDash(customer?.invoiceAddress) }}</strong>
                </div>
                <div v-if="!isHidden('invoiceTelephone')" class="detail-cell">
                  <span>开票电话</span
                  ><strong>{{
                    valueOrDash(customer?.invoiceTelephone)
                  }}</strong>
                </div>
                <div v-if="!isHidden('invoiceCompany')" class="detail-cell">
                  <span>开票单位</span
                  ><strong>{{ valueOrDash(customer?.invoiceCompany) }}</strong>
                </div>
              </div>
            </section>

            <section class="customer-detail-section">
              <header class="customer-detail-section__header">
                <span class="customer-detail-section__title">业务与物流</span>
              </header>
              <div class="customer-detail-grid">
                <div v-if="!isHidden('saleUserId')" class="detail-cell">
                  <span>所属业务员</span
                  ><strong>{{ userName(customer?.saleUserId) }}</strong>
                </div>
                <div v-if="!isHidden('developerUserId')" class="detail-cell">
                  <span>所属开发员</span
                  ><strong>{{ userName(customer?.developerUserId) }}</strong>
                </div>
                <div v-if="!isHidden('deptId')" class="detail-cell">
                  <span>所属部门</span
                  ><strong>{{ deptName(customer?.deptId) }}</strong>
                </div>
                <div v-if="!isHidden('priceLevel')" class="detail-cell">
                  <span>价格级别</span
                  ><strong>{{
                    baseOptionName(priceLevelMap, customer?.priceLevel)
                  }}</strong>
                </div>
                <div v-if="!isHidden('priceLocked')" class="detail-cell">
                  <span>价格锁定</span
                  ><strong>{{ customer?.priceLocked ? '是' : '否' }}</strong>
                </div>
                <div v-if="!isHidden('logistics')" class="detail-cell">
                  <span>是否物流</span
                  ><strong>{{ customer?.logistics ? '是' : '否' }}</strong>
                </div>
                <div v-if="!isHidden('transportMethod')" class="detail-cell">
                  <span>运输方式</span
                  ><strong>{{
                    baseOptionName(
                      transportMethodMap,
                      customer?.transportMethod,
                    )
                  }}</strong>
                </div>
                <div v-if="!isHidden('routeId')" class="detail-cell">
                  <span>线路</span
                  ><strong>{{ routeName(customer?.routeId) }}</strong>
                </div>
                <div v-if="!isHidden('freightExplainId')" class="detail-cell">
                  <span>运费说明</span
                  ><strong>{{
                    freightExplainName(customer?.freightExplainId)
                  }}</strong>
                </div>
                <div v-if="!isHidden('allowMultiDept')" class="detail-cell">
                  <span>允许多部门</span
                  ><strong>{{ customer?.allowMultiDept ? '是' : '否' }}</strong>
                </div>
                <div
                  v-if="!isHidden('deptIds') && customer?.allowMultiDept"
                  class="detail-cell customer-detail-cell--wide"
                >
                  <span>适用部门</span
                  ><strong
                    class="customer-detail-value--ellipsis"
                    :title="applicableDeptNames"
                    >{{ applicableDeptNames }}</strong
                  >
                </div>
                <div
                  v-if="!isHidden('dataCenterAuditStatus')"
                  class="detail-cell detail-cell--readonly"
                >
                  <span>数据中心审核</span
                  ><strong>{{
                    enumLabel(
                      dataCenterAuditOptions,
                      customer?.dataCenterAuditStatus,
                    )
                  }}</strong>
                </div>
              </div>
            </section>

            <section class="customer-detail-section">
              <header class="customer-detail-section__header">
                <span class="customer-detail-section__title">系统辅助</span>
              </header>
              <div class="customer-detail-grid">
                <div v-if="!isHidden('wubiCode')" class="detail-cell">
                  <span>五笔码</span
                  ><strong>{{ valueOrDash(customer?.wubiCode) }}</strong>
                </div>
                <div v-if="!isHidden('pinyinCode')" class="detail-cell">
                  <span>拼音码</span
                  ><strong>{{ valueOrDash(customer?.pinyinCode) }}</strong>
                </div>
                <div v-if="!isHidden('memberCode')" class="detail-cell">
                  <span>会员编码</span
                  ><strong>{{ valueOrDash(customer?.memberCode) }}</strong>
                </div>
                <div v-if="!isHidden('platformCode')" class="detail-cell">
                  <span>平台唯一码</span
                  ><strong>{{ valueOrDash(customer?.platformCode) }}</strong>
                </div>
                <div v-if="!isHidden('status')" class="detail-cell">
                  <span>状态</span
                  ><strong>{{
                    enumLabel(statusOptions, customer?.status)
                  }}</strong>
                </div>
                <div
                  v-if="!isHidden('remark')"
                  class="detail-cell customer-detail-cell--wide"
                >
                  <span>备注</span
                  ><strong>{{ valueOrDash(customer?.remark) }}</strong>
                </div>
              </div>
            </section>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane
          v-if="canShowCustomerMemberTab"
          key="members"
          tab="小程序授权会员"
        >
          <CustomerMemberPanel
            v-if="visitedTabs.has('members')"
            :customer-id="currentCustomerId"
            @success="handleCustomerMemberSuccess"
          />
        </Tabs.TabPane>

        <Tabs.TabPane key="contacts" tab="联系人">
          <div v-if="canMaintain" class="customer-detail-tab-toolbar">
            <Button type="primary" @click="openEditor('contact')"
              >新增联系人</Button
            >
          </div>
          <CustomerItemGrid
            :ref="(value) => setItemGrid('contacts', value)"
            :active="activeTab === 'contacts'"
            :customer-id="currentCustomerId"
            :api="getCustomerContactPage"
            :can-maintain="canMaintain"
            :columns="contactColumns"
            grid-key="contacts"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'importance'">
                {{ contactImportanceLabel(record.importance) || '-' }}
              </template>
              <template v-else-if="column.dataIndex === 'gender'">
                {{ contactGenderLabel(record.gender) || '-' }}
              </template>
              <template v-else-if="column.dataIndex === 'flags'">
                <div class="flex flex-wrap gap-1">
                  <Tag v-if="record.primaryContact" color="blue">主联系人</Tag>
                  <Tag v-if="record.receiverContact" color="green">收货</Tag>
                  <Tag v-if="record.settleContact" color="orange">结算</Tag>
                  <Tag v-if="record.messageContact" color="purple">消息</Tag>
                  <Tag v-if="record.salesperson" color="cyan">导购员</Tag>
                  <Tag v-if="record.fixedCommission" color="gold">固定提成</Tag>
                </div>
              </template>
              <template v-else-if="column.dataIndex === 'actions'">
                <Button
                  size="small"
                  type="link"
                  @click="openEditor('contact', record)"
                  >编辑</Button
                >
                <Popconfirm
                  title="确认删除该联系人？"
                  @confirm="handleDelete('contact', record.id)"
                >
                  <Button danger size="small" type="link">删除</Button>
                </Popconfirm>
              </template>
            </template>
          </CustomerItemGrid>
        </Tabs.TabPane>

        <Tabs.TabPane key="contracts" tab="客户合同">
          <div v-if="canMaintain" class="customer-detail-tab-toolbar">
            <Button type="primary" @click="openEditor('contract')"
              >新增合同</Button
            >
          </div>
          <CustomerItemGrid
            :ref="(value) => setItemGrid('contracts', value)"
            :active="activeTab === 'contracts'"
            :customer-id="currentCustomerId"
            :api="getCustomerContractPage"
            :can-maintain="canMaintain"
            :columns="contractColumns"
            grid-key="contracts"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'mainContract'">
                <Tag v-if="record.mainContract" color="blue">是</Tag>
                <span v-else>否</span>
              </template>
              <template v-else-if="column.dataIndex === 'rebateEnabled'">
                <Tag v-if="record.rebateEnabled" color="green">是</Tag>
                <span v-else>否</span>
              </template>
              <template v-else-if="column.dataIndex === 'freightSettleMethod'">
                {{
                  freightSettleMethodLabel(record.freightSettleMethod) || '-'
                }}
              </template>
              <template v-else-if="column.dataIndex === 'attachmentUrl'">
                <a
                  v-if="record.attachmentUrl"
                  :href="record.attachmentUrl"
                  target="_blank"
                  >查看附件</a
                >
                <span v-else>-</span>
              </template>
              <template v-else-if="column.dataIndex === 'actions'">
                <Button
                  size="small"
                  type="link"
                  @click="openEditor('contract', record)"
                  >编辑</Button
                >
                <Popconfirm
                  title="确认删除该合同？"
                  @confirm="handleDelete('contract', record.id)"
                >
                  <Button danger size="small" type="link">删除</Button>
                </Popconfirm>
              </template>
            </template>
          </CustomerItemGrid>
        </Tabs.TabPane>

        <Tabs.TabPane key="areas" tab="企业地区">
          <div v-if="canMaintain" class="customer-detail-tab-toolbar">
            <Button type="primary" @click="openEditor('area')">新增地区</Button>
          </div>
          <CustomerItemGrid
            :ref="(value) => setItemGrid('areas', value)"
            :active="activeTab === 'areas'"
            :customer-id="currentCustomerId"
            :api="getCustomerAreaPage"
            :can-maintain="canMaintain"
            :columns="areaColumns"
            grid-key="areas"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'defaulted'">
                <Tag v-if="record.defaulted" color="blue">默认</Tag>
              </template>
              <template v-else-if="column.dataIndex === 'actions'">
                <Button
                  size="small"
                  type="link"
                  @click="openEditor('area', record)"
                  >编辑</Button
                >
                <Popconfirm
                  title="确认删除该地区？"
                  @confirm="handleDelete('area', record.id)"
                >
                  <Button danger size="small" type="link">删除</Button>
                </Popconfirm>
              </template>
            </template>
          </CustomerItemGrid>
        </Tabs.TabPane>

        <Tabs.TabPane key="images" tab="企业图片">
          <section
            v-for="category in imageCategories"
            :key="category.key"
            class="mb-4"
          >
            <div class="customer-detail-tab-toolbar">
              <strong>{{ category.title }}</strong>
              <ImageUpload
                v-if="canMaintain && category.type"
                :disabled="imageUploading"
                :max-number="1"
                :show-description="false"
                directory="customer"
                @change="
                  (value) => handleCategoryImageUpload(category.type!, value)
                "
              />
              <Button
                v-if="canMaintain"
                size="small"
                @click="openEditor('image', { imageType: category.type })"
                >新增图片</Button
              >
            </div>
            <CustomerItemGrid
              :ref="(value) => setItemGrid(category.key, value)"
              :active="activeTab === 'images'"
              :customer-id="currentCustomerId"
              :api="getCustomerImagePage"
              :params="{
                imageType:
                  category.type === '门店图片'
                    ? '__store__'
                    : (category.type ?? '__other__'),
              }"
              :can-maintain="canMaintain"
              :columns="imageColumns"
              :grid-key="category.key"
            >
              <template #bodyCell="{ column, record }">
                <Image
                  v-if="column.dataIndex === 'imageUrl'"
                  :src="record.imageUrl"
                  :width="70"
                  :height="44"
                />
                <template v-else-if="column.dataIndex === 'actions'">
                  <Button
                    size="small"
                    type="link"
                    @click="openEditor('image', record)"
                    >编辑</Button
                  >
                  <Popconfirm
                    title="确认删除这张图片？"
                    @confirm="handleDelete('image', record.id)"
                    ><Button danger size="small" type="link"
                      >删除</Button
                    ></Popconfirm
                  >
                </template>
              </template>
            </CustomerItemGrid>
          </section>
        </Tabs.TabPane>

        <Tabs.TabPane key="extends" tab="拓展信息">
          <ExtendInfo
            v-if="visitedTabs.has('extends')"
            :customer-id="currentCustomerId"
            :readonly="!canMaintain"
          />
        </Tabs.TabPane>

        <Tabs.TabPane key="tasks" tab="任务量">
          <div v-if="canMaintain" class="customer-detail-tab-toolbar">
            <Button type="primary" @click="openEditor('task')"
              >新增任务量</Button
            >
          </div>
          <CustomerItemGrid
            :ref="(value) => setItemGrid('tasks', value)"
            :active="activeTab === 'tasks'"
            :customer-id="currentCustomerId"
            :api="getCustomerTaskPage"
            :can-maintain="canMaintain"
            :columns="taskColumns"
            grid-key="tasks"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'actions'">
                <Button
                  size="small"
                  type="link"
                  @click="openEditor('task', record)"
                  >编辑</Button
                >
                <Popconfirm
                  title="确认删除该任务量？"
                  @confirm="handleDelete('task', record.id)"
                >
                  <Button danger size="small" type="link">删除</Button>
                </Popconfirm>
              </template>
            </template>
          </CustomerItemGrid>
        </Tabs.TabPane>

        <Tabs.TabPane key="business" tab="工商信息">
          <Alert
            type="info"
            show-icon
            class="customer-detail-tab-alert"
            :description="businessRecognitionDescription"
            :message="businessRecognitionMessage"
          />
          <div v-if="canMaintain" class="customer-detail-tab-toolbar">
            <Button type="primary" @click="openEditor('business')"
              >新增工商信息</Button
            >
          </div>
          <CustomerItemGrid
            :ref="(value) => setItemGrid('business', value)"
            :active="activeTab === 'business'"
            :customer-id="currentCustomerId"
            :api="getCustomerBusinessInfoPage"
            :can-maintain="canMaintain"
            :columns="businessColumns"
            grid-key="business"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'source'">
                <Tag v-if="isBusinessInfoRecordFromOcr(record)" color="blue"
                  >OCR</Tag
                >
                <Tag v-else>人工</Tag>
              </template>
              <template v-else-if="column.dataIndex === 'rawData'"
                ><Button
                  v-if="record.rawData"
                  size="small"
                  type="link"
                  @click="handleViewBusinessRawDataRecord(record)"
                  >查看</Button
                ></template
              >
              <template v-else-if="column.dataIndex === 'actions'">
                <Button
                  size="small"
                  type="link"
                  @click="openEditor('business', record)"
                  >编辑</Button
                >
                <Button
                  v-if="record.rawData"
                  size="small"
                  type="link"
                  @click="handleViewBusinessRawDataRecord(record)"
                  >OCR原文</Button
                >
                <Popconfirm
                  title="确认删除该工商信息？"
                  @confirm="handleDelete('business', record.id)"
                >
                  <Button danger size="small" type="link">删除</Button>
                </Popconfirm>
              </template>
            </template>
          </CustomerItemGrid>
        </Tabs.TabPane>

        <Tabs.TabPane
          v-if="hasAccessByCodes(['erp:customer:dept-distribute'])"
          key="deptDistribution"
          tab="分配部门"
        >
          <DeptDistributionPanel
            v-if="
              visitedTabs.has('deptDistribution') &&
              hasAccessByCodes(['erp:customer:dept-distribute'])
            "
            archive-name="客户"
            :auth="['erp:customer:dept-distribute']"
            :load-api="getCustomerDeptDistribution"
            :record="customer"
            :save-api="updateCustomerDeptDistribution"
            :show-dept-id="false"
            @success="handleDeptDistributionSuccess"
          />
        </Tabs.TabPane>

        <Tabs.TabPane
          v-if="hasAccessByCodes(['erp:customer:dept-credit'])"
          key="deptCredit"
          tab="分部门授信"
        >
          <DeptCreditPanel
            v-if="
              visitedTabs.has('deptCredit') &&
              hasAccessByCodes(['erp:customer:dept-credit'])
            "
            :record="customer"
            @success="handleDeptCreditSuccess"
          />
        </Tabs.TabPane>
      </Tabs>
      <ErpAuditInfo
        v-if="customer"
        class="customer-detail-audit"
        :record="auditCustomer"
      />
    </Spin>

    <AModal
      @cancel="
        editorSequence += 1;
        saving = false;
      "
      v-model:open="editorVisible"
      :confirm-loading="saving"
      :title="editorTitle"
      destroy-on-close
      @ok="handleSaveEditor"
    >
      <AForm
        class="erp-form-focus-highlight"
        @keydown="
          (event: KeyboardEvent) =>
            focusNextEditableFormControlOnEnter(
              event,
              event.currentTarget as HTMLElement,
              { onLastControlEnter: () => {} },
            )
        "
        :label-col="{ style: { width: '96px' } }"
        :model="editorRecord"
      >
        <template v-if="editorType === 'contact'">
          <Row :gutter="16">
            <Col :span="12">
              <FormItem label="联系人" required
                ><Input v-model:value="editorRecord.name"
              /></FormItem>
            </Col>
            <Col :span="12">
              <FormItem label="重要性">
                <Select
                  v-model:value="editorRecord.importance"
                  :options="contactImportanceOptions"
                  allow-clear
                  placeholder="请选择重要性"
                  class="w-full"
                />
              </FormItem>
            </Col>
            <Col :span="12">
              <FormItem label="性别">
                <Select
                  v-model:value="editorRecord.gender"
                  :options="contactGenderOptions"
                  allow-clear
                  placeholder="请选择性别"
                  class="w-full"
                />
              </FormItem>
            </Col>
            <Col :span="12">
              <FormItem label="生日">
                <DatePicker
                  v-model:value="editorRecord.birthday"
                  value-format="YYYY-MM-DD"
                  format="YYYY-MM-DD"
                  class="w-full"
                />
              </FormItem>
            </Col>
            <Col :span="12">
              <FormItem label="手机号"
                ><Input v-model:value="editorRecord.mobile"
              /></FormItem>
            </Col>
            <Col :span="12">
              <FormItem label="电话"
                ><Input v-model:value="editorRecord.telephone"
              /></FormItem>
            </Col>
            <Col :span="12">
              <FormItem label="传真"
                ><Input v-model:value="editorRecord.fax"
              /></FormItem>
            </Col>
            <Col :span="12">
              <FormItem label="微信"
                ><Input v-model:value="editorRecord.wechat"
              /></FormItem>
            </Col>
            <Col :span="12">
              <FormItem label="QQ"
                ><Input v-model:value="editorRecord.qq"
              /></FormItem>
            </Col>
            <Col :span="12">
              <FormItem label="邮箱"
                ><Input v-model:value="editorRecord.email"
              /></FormItem>
            </Col>
            <Col :span="12">
              <FormItem label="职务"
                ><Input v-model:value="editorRecord.position"
              /></FormItem>
            </Col>
            <Col :span="12">
              <FormItem label="所属公司">
                <CustomerLazySelect
                  v-model:value="editorRecord.companyId"
                  :options="customerSimpleOptions"
                  allow-clear
                  placeholder="请选择所属公司"
                  show-search
                  class="w-full"
                  @options-change="handleCustomerOptionsChange"
                />
              </FormItem>
            </Col>
            <Col :span="12">
              <FormItem label="导购员">
                <Select
                  v-model:value="editorRecord.salesperson"
                  :options="
                    [
                      { label: '是', value: 1 },
                      { label: '否', value: 0 },
                    ] as any[]
                  "
                  allow-clear
                  placeholder="请选择"
                  class="w-full"
                />
              </FormItem>
            </Col>
            <Col :span="12">
              <FormItem label="固定提成">
                <Select
                  v-model:value="editorRecord.fixedCommission"
                  :options="
                    [
                      { label: '是', value: 1 },
                      { label: '否', value: 0 },
                    ] as any[]
                  "
                  allow-clear
                  placeholder="请选择"
                  class="w-full"
                />
              </FormItem>
            </Col>
            <Col :span="12">
              <FormItem label="提成率">
                <Input
                  inputmode="decimal"
                  v-model:value="editorRecord.commissionRate"
                  :precision="2"
                  :min="0"
                  :max="100"
                  addon-after="%"
                  class="w-full"
                />
              </FormItem>
            </Col>
            <Col :span="12">
              <FormItem label="邮编"
                ><Input v-model:value="editorRecord.postCode"
              /></FormItem>
            </Col>
            <Col :span="24">
              <FormItem label="地址"
                ><Input v-model:value="editorRecord.address"
              /></FormItem>
            </Col>
            <Col :span="12">
              <FormItem label="最后联系时间">
                <DatePicker
                  v-model:value="editorRecord.lastContactTime"
                  show-time
                  value-format="YYYY-MM-DD HH:mm:ss"
                  format="YYYY-MM-DD HH:mm:ss"
                  class="w-full"
                />
              </FormItem>
            </Col>
            <Col :span="12">
              <FormItem label="名片正面URL"
                ><Input
                  v-model:value="editorRecord.businessCardFrontUrl"
                  placeholder="请输入名片正面图片URL"
              /></FormItem>
            </Col>
            <Col :span="12">
              <FormItem label="名片背面URL"
                ><Input
                  v-model:value="editorRecord.businessCardBackUrl"
                  placeholder="请输入名片背面图片URL"
              /></FormItem>
            </Col>
            <Col :span="24">
              <FormItem label="标记">
                <div class="grid grid-cols-3 gap-2">
                  <Checkbox v-model:checked="editorRecord.primaryContact"
                    >主联系人</Checkbox
                  >
                  <Checkbox v-model:checked="editorRecord.receiverContact"
                    >收货联系人</Checkbox
                  >
                  <Checkbox v-model:checked="editorRecord.settleContact"
                    >结算联系人</Checkbox
                  >
                  <Checkbox v-model:checked="editorRecord.messageContact"
                    >消息联系人</Checkbox
                  >
                </div>
              </FormItem>
            </Col>
            <Col :span="24">
              <FormItem label="备注"
                ><Input.TextArea v-model:value="editorRecord.remark" :rows="2"
              /></FormItem>
            </Col>
          </Row>
        </template>
        <template v-else-if="editorType === 'contract'">
          <FormItem label="合同编号"
            ><Input v-model:value="editorRecord.contractNo"
          /></FormItem>
          <FormItem label="合同类型">
            <ErpLazyPageSelect
              v-model:value="editorRecord.contractType"
              :api="
                (params) =>
                  getSaleConfigPage({
                    ...params,
                    name: params.keyword,
                    configType: 'CONTRACT_TYPE',
                    status: 0,
                  })
              "
              value-field="code"
              label-field="name"
              class="w-full"
            />
          </FormItem>
          <FormItem label="合同日期"
            ><DatePicker
              v-model:value="editorRecord.contractDate"
              show-time
              value-format="YYYY-MM-DD HH:mm:ss"
              format="YYYY-MM-DD HH:mm:ss"
              class="w-full"
          /></FormItem>
          <FormItem label="生效日期"
            ><DatePicker
              v-model:value="editorRecord.startTime"
              show-time
              value-format="YYYY-MM-DD HH:mm:ss"
              format="YYYY-MM-DD HH:mm:ss"
              class="w-full"
          /></FormItem>
          <FormItem label="终止日期"
            ><DatePicker
              v-model:value="editorRecord.endTime"
              show-time
              value-format="YYYY-MM-DD HH:mm:ss"
              format="YYYY-MM-DD HH:mm:ss"
              class="w-full"
          /></FormItem>
          <FormItem label="结算方式"
            ><Input v-model:value="editorRecord.settleMethod"
          /></FormItem>
          <FormItem label="运输方式"
            ><Input v-model:value="editorRecord.transportMethod"
          /></FormItem>
          <FormItem label="铺底金额"
            ><Input
              inputmode="decimal"
              v-model:value="editorRecord.baseAmount"
              class="w-full"
              :precision="2"
          /></FormItem>
          <FormItem label="任务量"
            ><Input
              inputmode="decimal"
              v-model:value="editorRecord.taskAmount"
              class="w-full"
              :precision="2"
          /></FormItem>
          <FormItem label="主要合同"
            ><Switch v-model:checked="editorRecord.mainContract"
          /></FormItem>
          <FormItem label="返点证集"
            ><Switch v-model:checked="editorRecord.rebateEnabled"
          /></FormItem>
          <FormItem label="运费结算方式">
            <Select
              v-model:value="editorRecord.freightSettleMethod"
              :options="freightSettleMethodOptions"
              allow-clear
              placeholder="请选择运费结算方式"
              class="w-full"
            />
          </FormItem>
          <FormItem label="上传附件"
            ><Input
              v-model:value="editorRecord.attachmentUrl"
              placeholder="请粘贴附件 URL 或上传"
          /></FormItem>
          <FormItem label="合同摘要"
            ><Input.TextArea v-model:value="editorRecord.summary" :rows="3"
          /></FormItem>
        </template>
        <template v-else-if="editorType === 'area'">
          <FormItem label="地图地址"
            ><Input v-model:value="editorRecord.mapAddress"
          /></FormItem>
          <FormItem label="详细地址"
            ><Input v-model:value="editorRecord.detailAddress"
          /></FormItem>
          <FormItem label="经度"
            ><Input
              inputmode="decimal"
              v-model:value="editorRecord.longitude"
              class="w-full"
              :precision="10"
          /></FormItem>
          <FormItem label="纬度"
            ><Input
              inputmode="decimal"
              v-model:value="editorRecord.latitude"
              class="w-full"
              :precision="10"
          /></FormItem>
          <FormItem label="默认地址"
            ><Checkbox v-model:checked="editorRecord.defaulted"
              >设为默认</Checkbox
            ></FormItem
          >
        </template>
        <template v-else-if="editorType === 'image'">
          <FormItem label="图片类型">
            <Select
              v-model:value="editorRecord.imageType"
              :options="[
                { label: '营业执照', value: '营业执照' },
                { label: '门头照片', value: '门头照片' },
                { label: '公司证书', value: '公司证书' },
                { label: '名片', value: '名片' },
                { label: '内部照片', value: '内部照片' },
              ]"
              allow-clear
              placeholder="请选择图片类型"
              class="w-full"
            />
          </FormItem>
          <FormItem label="图片名称"
            ><Input v-model:value="editorRecord.imageName"
          /></FormItem>
          <FormItem label="图片地址" required
            ><Input v-model:value="editorRecord.imageUrl"
          /></FormItem>
          <FormItem label="排序"
            ><Input
              inputmode="decimal"
              v-model:value="editorRecord.sort"
              class="w-full"
              :precision="0"
          /></FormItem>
          <FormItem label="默认图"
            ><Checkbox v-model:checked="editorRecord.defaulted"
              >设为默认</Checkbox
            ></FormItem
          >
        </template>
        <template v-else-if="editorType === 'extend'">
          <FormItem label="字段标识" required
            ><Input v-model:value="editorRecord.extendKey"
          /></FormItem>
          <FormItem label="字段名称"
            ><Input v-model:value="editorRecord.extendName"
          /></FormItem>
          <FormItem label="字段值"
            ><Input v-model:value="editorRecord.extendValue"
          /></FormItem>
          <FormItem label="字段类型"
            ><Input v-model:value="editorRecord.extendType"
          /></FormItem>
          <FormItem label="排序"
            ><Input
              inputmode="decimal"
              v-model:value="editorRecord.sort"
              class="w-full"
              :precision="0"
          /></FormItem>
        </template>
        <template v-else-if="editorType === 'business'">
          <FormItem label="信用代码"
            ><Input v-model:value="editorRecord.creditCode"
          /></FormItem>
          <FormItem label="法人"
            ><Input v-model:value="editorRecord.legalPerson"
          /></FormItem>
          <FormItem label="注册资本"
            ><Input v-model:value="editorRecord.registeredCapital"
          /></FormItem>
          <FormItem label="成立日期"
            ><Input v-model:value="editorRecord.establishDate"
          /></FormItem>
          <FormItem label="经营状态"
            ><Input v-model:value="editorRecord.businessStatus"
          /></FormItem>
          <FormItem label="经营范围"
            ><Input.TextArea
              v-model:value="editorRecord.businessScope"
              :rows="3"
          /></FormItem>
        </template>
        <template v-else>
          <FormItem label="年份" required
            ><Input
              inputmode="decimal"
              v-model:value="editorRecord.year"
              class="w-full"
              :precision="0"
          /></FormItem>
          <FormItem label="月份"
            ><Input
              inputmode="decimal"
              v-model:value="editorRecord.month"
              class="w-full"
              :max="12"
              :min="1"
              :precision="0"
          /></FormItem>
          <FormItem label="任务级别">
            <ErpLazyPageSelect
              v-model:value="editorRecord.taskLevel"
              :api="
                (params) =>
                  getSaleConfigPage({
                    ...params,
                    name: params.keyword,
                    configType: 'TASK_LEVEL',
                    status: 0,
                  })
              "
              value-field="code"
              label-field="name"
              class="w-full"
            />
          </FormItem>
          <FormItem label="任务量"
            ><Input
              inputmode="decimal"
              v-model:value="editorRecord.taskAmount"
              class="w-full"
              :precision="2"
          /></FormItem>
        </template>
        <FormItem
          v-if="
            editorType === 'area' ||
            editorType === 'extend' ||
            editorType === 'business' ||
            editorType === 'image'
          "
          label="备注"
          ><Input.TextArea v-model:value="editorRecord.remark" :rows="3"
        /></FormItem>
      </AForm>
    </AModal>
  </Modal>
</template>

<style scoped>
.customer-detail-error {
  display: flex;
  min-height: calc(100vh - 142px);
  align-items: center;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
  padding: 24px;
  background: hsl(var(--background));
}

.customer-detail-error :deep(.ant-alert) {
  width: min(520px, 100%);
}

.customer-detail-tabs {
  min-height: calc(100vh - 102px);
  background: hsl(var(--background));
  font-size: 12px;
}

.customer-detail-tabs :deep(.ant-tabs-nav) {
  margin: 0;
  padding: 0 12px;
  background: hsl(var(--card));
  border-bottom: 1px solid hsl(var(--border));
}

.customer-detail-tabs :deep(.ant-tabs-tab) {
  margin: 0 24px 0 0;
  padding-block: 9px;
  font-size: 12px;
}

.customer-detail-tabs :deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
  font-weight: 600;
}

.customer-detail-tabs :deep(.ant-tabs-content-holder) {
  min-height: calc(100vh - 142px);
  padding: 12px;
  background: hsl(var(--muted) / 28%);
}

.customer-detail-tabs :deep(.ant-tabs-tabpane) {
  min-width: 0;
}

.customer-detail-tab-toolbar {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.customer-detail-tab-alert {
  margin-bottom: 8px;
}

.customer-detail-tabs :deep(.ant-table-wrapper) {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.customer-detail-tabs :deep(.ant-table),
.customer-detail-tabs :deep(.ant-table-cell),
.customer-detail-tabs :deep(.ant-btn),
.customer-detail-tabs :deep(.ant-tag),
.customer-detail-tabs :deep(.ant-empty-description),
.customer-detail-tabs :deep(.ant-alert),
.customer-detail-tabs :deep(.ant-form-item-label > label),
.customer-detail-tabs :deep(.ant-form-item-control-input),
.customer-detail-tabs :deep(.ant-input),
.customer-detail-tabs :deep(.ant-input-number-input),
.customer-detail-tabs :deep(.ant-select-selection-item),
.customer-detail-tabs :deep(.ant-select-selection-placeholder),
.customer-detail-tabs :deep(.ant-tree-select) {
  font-size: 12px;
}

.customer-detail-tabs :deep(.ant-table-small .ant-table-thead > tr > th),
.customer-detail-tabs :deep(.ant-table-small .ant-table-tbody > tr > td) {
  padding: 6px 8px;
  font-size: 12px;
  line-height: 20px;
}

.customer-detail-tabs :deep(.ant-table-thead > tr > th) {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 45%);
  font-weight: 500;
  white-space: nowrap;
}

.customer-detail-tabs :deep(.ant-table-tbody > tr > td) {
  white-space: nowrap;
}

.customer-detail-tabs :deep(.ant-table-cell-fix-right) {
  background: hsl(var(--card));
}

.customer-detail-tabs
  :deep(.ant-table-tbody > tr:hover > .ant-table-cell-fix-right) {
  background: hsl(var(--muted) / 30%);
}

.customer-detail-tabs :deep(.ant-btn-sm),
.customer-detail-tabs :deep(.ant-btn-link) {
  height: 26px;
  padding: 1px 5px;
  font-size: 12px;
  line-height: 22px;
}

.customer-detail-tabs :deep(.ant-btn-primary:not(.ant-btn-sm)) {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
}

.customer-detail-tabs :deep(.ant-tag) {
  margin-inline-end: 4px;
  line-height: 18px;
}

.customer-detail-tabs :deep(.ant-alert) {
  padding: 7px 10px;
}

.customer-detail-tabs :deep(.ant-empty) {
  margin-block: 24px;
}

.customer-detail-tabs :deep(.ant-card) {
  overflow: hidden;
  background: hsl(var(--card));
  border-color: hsl(var(--border));
  border-radius: 8px;
}

.customer-detail-tabs :deep(.ant-card-head) {
  min-height: 40px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  font-size: 13px;
}

.customer-detail-tabs :deep(.ant-card-body) {
  padding: 10px 12px 12px;
}

.customer-detail-tabs :deep(.ant-form-item) {
  margin-bottom: 10px;
}

.customer-detail-tabs :deep(.ant-input:not(textarea)),
.customer-detail-tabs :deep(.ant-input-number),
.customer-detail-tabs :deep(.ant-select-single),
.customer-detail-tabs :deep(.ant-select-selector) {
  min-height: 32px;
  font-size: 12px;
}

.customer-detail-audit {
  margin: 0;
  padding: 0 12px 12px;
  background: hsl(var(--background));
}

.customer-detail-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.customer-detail-section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.customer-detail-section__header {
  display: flex;
  min-height: 40px;
  align-items: center;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.customer-detail-section__title {
  position: relative;
  padding-left: 10px;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
}

.customer-detail-section__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  background: hsl(var(--primary));
  border-radius: 3px;
  content: '';
}

.customer-detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px 12px;
  padding: 10px 12px 12px;
}

.detail-cell {
  display: grid;
  min-width: 0;
  min-height: 32px;
  grid-template-columns: 88px minmax(0, 1fr);
  background: transparent;
}

.detail-cell > span {
  display: flex;
  min-width: 0;
  align-items: center;
  padding-right: 10px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 16px;
}

.detail-cell > strong {
  display: flex;
  min-width: 0;
  min-height: 32px;
  align-items: center;
  padding: 5px 8px;
  color: hsl(var(--foreground));
  background: hsl(var(--muted) / 36%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  word-break: break-all;
}

.detail-cell--readonly > strong {
  background: hsl(var(--muted) / 52%);
}

.detail-cell > strong.customer-detail-value--ellipsis {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: help;
}

.customer-detail-cell--wide {
  grid-column: span 2 / span 2;
}

.enterprise-images {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.enterprise-images > div {
  overflow: hidden;
  padding: 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.enterprise-images__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 32px;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid hsl(var(--border));
}

.enterprise-images__header > div:first-child {
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
}

.enterprise-images__upload {
  width: 108px;
  flex-shrink: 0;
}

.enterprise-images__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.enterprise-images__card {
  overflow: hidden;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  transition:
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.enterprise-images__card:hover {
  border-color: hsl(var(--primary) / 45%);
  box-shadow: 0 4px 14px hsl(var(--foreground) / 8%);
}

.enterprise-images__preview {
  width: 100%;
  height: 156px;
  object-fit: cover;
  background: hsl(var(--muted) / 45%);
}

.enterprise-images__body {
  padding: 8px 10px 10px;
}

.enterprise-images__body .font-medium {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 12px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enterprise-images__remark {
  min-height: 20px;
  margin-top: 2px;
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enterprise-images__actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid hsl(var(--border));
}

.enterprise-images :deep(.ant-empty) {
  margin-block: 0;
  padding: 28px 0 12px;
}

@media (max-width: 768px) {
  .customer-detail-tabs :deep(.ant-tabs-content-holder) {
    padding: 8px;
  }

  .customer-detail-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .customer-detail-cell--wide {
    grid-column: auto;
  }

  .enterprise-images__header {
    align-items: stretch;
    flex-direction: column;
  }

  .enterprise-images__upload {
    width: 100%;
  }

  .enterprise-images__grid {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 769px) and (max-width: 1279px) {
  .customer-detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
