<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type { SupplierBaseDataQuickCreatePayload } from '../data';

import type { ErpBaseDataApi } from '#/api/erp/base';
import type { ErpSupplierApi } from '#/api/erp/purchase/supplier';
import type { ErpSupplierAccountApi } from '#/api/erp/purchase/supplier/account';
import type { ErpSupplierBillApi } from '#/api/erp/purchase/supplier/bill';
import type { ErpSupplierBusinessInfoApi } from '#/api/erp/purchase/supplier/business-info';
import type { ErpSupplierContactApi } from '#/api/erp/purchase/supplier/contact';
import type { ErpSupplierContractApi } from '#/api/erp/purchase/supplier/contract';
import type { ErpSupplierExtendApi } from '#/api/erp/purchase/supplier/extend';
import type { ErpSupplierExtendInfoApi } from '#/api/erp/purchase/supplier/extend-info';
import type { ErpSupplierImageApi } from '#/api/erp/purchase/supplier/image';
import type { ErpSupplierTaskApi } from '#/api/erp/purchase/supplier/task';

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';

import {
  Form as AForm,
  Alert,
  Modal as AModal,
  Button,
  Checkbox,
  DatePicker,
  FormItem,
  Image,
  Input,
  message,
  Popconfirm,
  Select,
  Spin,
  Switch,
  Tabs,
  Tag,
  TimePicker,
} from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { ACTION_ICON, TableAction } from '#/adapter/vxe-table';
import {
  getSupplier,
  getSupplierDeptDistribution,
  updateSupplier,
  updateSupplierDeptDistribution,
} from '#/api/erp/purchase/supplier';
import {
  createSupplierAccount,
  deleteSupplierAccount,
  getSupplierAccountPage,
  updateSupplierAccount,
} from '#/api/erp/purchase/supplier/account';
import {
  createSupplierBill,
  deleteSupplierBill,
  getSupplierBillPage,
  updateSupplierBill,
} from '#/api/erp/purchase/supplier/bill';
import {
  createSupplierBusinessInfo,
  deleteSupplierBusinessInfo,
  getSupplierBusinessInfoPage,
  updateSupplierBusinessInfo,
} from '#/api/erp/purchase/supplier/business-info';
import {
  createSupplierContact,
  deleteSupplierContact,
  getSupplierContactPage,
  updateSupplierContact,
} from '#/api/erp/purchase/supplier/contact';
import {
  createSupplierContract,
  deleteSupplierContract,
  getSupplierContractPage,
  updateSupplierContract,
} from '#/api/erp/purchase/supplier/contract';
import {
  createSupplierExtend,
  deleteSupplierExtend,
  getSupplierExtendPage,
  updateSupplierExtend,
} from '#/api/erp/purchase/supplier/extend';
import {
  getSupplierExtendInfo,
  saveSupplierExtendInfo,
} from '#/api/erp/purchase/supplier/extend-info';
import {
  createSupplierImage,
  deleteSupplierImage,
  getSupplierImagePage,
  updateSupplierImage,
} from '#/api/erp/purchase/supplier/image';
import {
  createSupplierTask,
  deleteSupplierTask,
  getSupplierTaskPage,
  updateSupplierTask,
} from '#/api/erp/purchase/supplier/task';
import { ImageUpload } from '#/components/upload';
import BaseDataForm from '#/views/erp/base/modules/form.vue';
import { prepareErpArchiveItemColumns } from '#/views/erp/base/utils/archive-list-table';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import {
  applyEffectiveFieldVisibility,
  isEffectiveFieldHidden,
  isFieldConfigKnown,
} from '#/views/erp/composables/useFieldConfig';
import { withCandidateFocus } from '#/views/erp/utils/candidate-focus';
import { buildPinyinCode, buildWubiCode } from '#/views/erp/utils/name-code';

import {
  useBasicFormSchema,
  useFinanceFormSchema,
  useInvoiceFormSchema,
} from '../data';
import { normalizeSupplierEditor } from '../utils/editor-numbers';
import { loadSupplierFieldVisibility } from '../utils/field-visibility';
import { useSupplierFormKeyboard } from '../utils/form-keyboard';
import {
  buildSupplierAreaEditValues,
  buildSupplierDeptEditValues,
  formatSupplierArea,
  normalizeSupplierFormData,
  resolveSupplierAuditUserName,
} from '../utils/form-normalize';
import SupplierDeptDistribution from './supplier-dept-distribution.vue';
import SupplierItemGrid from './supplier-item-grid.vue';

import '#/views/erp/styles/form-focus.css';

type EditorType =
  | 'account'
  | 'bill'
  | 'business'
  | 'contact'
  | 'contract'
  | 'extend'
  | 'extendInfo'
  | 'image'
  | 'task';
type DetailTabKey =
  | 'accounts'
  | 'base'
  | 'bills'
  | 'business'
  | 'contacts'
  | 'contracts'
  | 'deptDistribution'
  | 'extendInfo'
  | 'extends'
  | 'images'
  | 'tasks';
type SupplierModalMode = 'detail' | 'edit';
type SupplierModalData = ErpSupplierApi.Supplier & {
  activeTab?: DetailTabKey;
  mode?: SupplierModalMode;
};

const emit = defineEmits(['success']);
const supplier = ref<ErpSupplierApi.Supplier>();
const FIELD_CONFIG_MODULE = 'supplier';
const SUPPLIER_FIELD_ALIASES = {
  areaIds: ['region'],
  financePhone: ['financeMobile'],
  invoiceCompany: ['invoiceTitle'],
  taxpayerId: ['invoiceTaxNo'],
};
const hiddenFields = ref<string[]>([]);
const fieldConfigSnapshot = ref<any[]>([]);
const { hasAccessByCodes } = useAccess();
const activeTab = ref<DetailTabKey>('base');
const isEditMode = ref(false);
const dataReady = ref(false);
const loadError = ref('');
const mainSaving = ref(false);
let loadSequence = 0;
const canMaintain = computed(() => hasAccessByCodes(['erp:supplier:update']));
const canDistribute = computed(() =>
  hasAccessByCodes(['erp:supplier:dept-distribute']),
);
const { beginOpen, endOpen, formScope, handleFormEnter, onOpened, queueFocus } =
  useSupplierFormKeyboard(
    () => isEditMode.value && activeTab.value === 'base',
    () => dataReady.value && !loadError.value && !mainSaving.value,
  );
function setFormScope(element: unknown) {
  formScope.value = element instanceof HTMLElement ? element : undefined;
}

const itemGrids = new Map<string, InstanceType<typeof SupplierItemGrid>>();
function setItemGrid(key: string, grid: any) {
  if (grid) itemGrids.set(key, grid);
  else itemGrids.delete(key);
}
const editorTab: Record<EditorType, DetailTabKey> = {
  account: 'accounts',
  bill: 'bills',
  business: 'business',
  contact: 'contacts',
  contract: 'contracts',
  extend: 'extends',
  image: 'images',
  task: 'tasks',
  extendInfo: 'extendInfo',
};
async function refreshItem(type: EditorType, deleted = false) {
  await (type === 'extendInfo'
    ? loadExtendInfo()
    : itemGrids.get(editorTab[type])?.refreshCurrent(deleted));
  if (type === 'business') emit('success');
}
let extendInfoLoaded = false;
async function loadExtendInfo() {
  const id = currentSupplierId.value;
  const current = loadSequence;
  if (!id) return;
  const result = await getSupplierExtendInfo(id);
  if (current !== loadSequence || currentSupplierId.value !== id) return;
  extendInfo.value = result || { supplierId: id };
  extendInfoLoaded = true;
}
watch(activeTab, async (tab) => {
  if (tab === 'extendInfo' && dataReady.value && !extendInfoLoaded)
    await loadExtendInfo();
});
onBeforeUnmount(() => {
  loadSequence += 1;
});

const contacts = ref<ErpSupplierContactApi.SupplierContact[]>([]);
const contracts = ref<ErpSupplierContractApi.SupplierContract[]>([]);
const accounts = ref<ErpSupplierAccountApi.SupplierAccount[]>([]);
const bills = ref<ErpSupplierBillApi.SupplierBill[]>([]);
const tasks = ref<ErpSupplierTaskApi.SupplierTask[]>([]);
const images = ref<ErpSupplierImageApi.SupplierImage[]>([]);
const extendsList = ref<ErpSupplierExtendApi.SupplierExtend[]>([]);
const businessInfos = ref<ErpSupplierBusinessInfoApi.SupplierBusinessInfo[]>(
  [],
);
const extendInfo = ref<ErpSupplierExtendInfoApi.SupplierExtendInfo>();
const loading = ref(false);
const saving = ref(false);
const fieldConfigFieldKeys = ref<string[]>([]);
const fieldConfigHiddenFields = ref<string[]>([]);
const fieldConfigLoaded = ref(false);
const imageUploading = ref(false);
const editorVisible = ref(false);
const editorKeyboard = useSupplierFormKeyboard(
  () => editorVisible.value && canMaintain.value,
  () => !saving.value,
);
function setEditorScope(element: unknown) {
  editorKeyboard.formScope.value =
    element instanceof HTMLElement ? element : undefined;
}
let previousEditorFocus: HTMLElement | null = null;
let editorSequence = 0;
watch(editorVisible, async (visible) => {
  editorSequence += 1;
  if (visible) {
    previousEditorFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    editorKeyboard.beginOpen();
    await nextTick();
    editorKeyboard.onOpened();
  } else {
    editorKeyboard.endOpen();
    await nextTick();
    if (dataReady.value && previousEditorFocus?.isConnected)
      previousEditorFocus.focus({ preventScroll: true });
  }
});
const editorType = ref<EditorType>('contact');
const editorRecord = ref<Record<string, any>>({});
const imageUploaderKey = ref(0);
const selectedImageType = ref('营业执照');
const deptMap = ref<Map<number, string>>(new Map());
const auditUserNameMap = ref<Map<number, string>>(new Map());
const quickCreateContext = ref<SupplierBaseDataQuickCreatePayload>();
let previousQuickCreateFocus: HTMLElement | null = null;
async function restoreQuickCreateFocus() {
  await nextTick();
  if (dataReady.value && previousQuickCreateFocus?.isConnected)
    previousQuickCreateFocus.focus({ preventScroll: true });
}
const pinyinCodeTouched = ref(false);
const wubiCodeTouched = ref(false);
const suppressNameCodeTouch = ref(false);

const formConfig = {
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    labelClass: '!justify-start !text-left',
    labelWidth: 88,
  },
  compact: true,
  wrapperClass: 'supplier-form-grid grid-cols-4',
  layout: 'horizontal' as const,
  showDefaultActions: false,
};

function getSupplierSchemaOptions() {
  return {
    canCreateBaseData: hasAccessByCodes(['erp:base-data:create']),
    deptLabelInValue: true,
    deptOptions: supplier.value?.deptId
      ? [{ id: supplier.value.deptId, name: supplier.value.deptName }]
      : [],
    userOptions: supplier.value?.purchaser
      ? [
          {
            id: Number(supplier.value.purchaser),
            nickname: supplier.value.purchaserName ?? supplier.value.purchaser,
          },
        ]
      : [],
    onCreateBaseData: handleCreateBaseData,
  };
}

const [BasicForm, basicFormApi] = useVbenForm({
  ...formConfig,
  schema: withCandidateFocus(
    useBasicFormSchema([], getSupplierSchemaOptions()),
  ),
  handleValuesChange(values, changedFields) {
    if (!suppressNameCodeTouch.value) {
      const focusedField = basicFormApi.getFocusedField?.();
      if (
        changedFields.includes('pinyinCode') &&
        focusedField === 'pinyinCode'
      ) {
        pinyinCodeTouched.value = true;
      }
      if (changedFields.includes('wubiCode') && focusedField === 'wubiCode') {
        wubiCodeTouched.value = true;
      }
      if (changedFields.includes('name')) {
        syncNameCodes(values.name);
      }
    }
    if (changedFields.includes('manualInputCode') && !values.id) {
      basicFormApi.setFieldValue(
        'code',
        values.manualInputCode ? '' : undefined,
      );
    }
  },
});

function syncNameCodes(name?: string) {
  const updates: Record<string, string> = {};
  if (!pinyinCodeTouched.value) {
    updates.pinyinCode = buildPinyinCode(name);
  }
  if (!wubiCodeTouched.value) {
    updates.wubiCode = buildWubiCode(name);
  }
  if (Object.keys(updates).length === 0) {
    return;
  }
  suppressNameCodeTouch.value = true;
  basicFormApi.setValues(updates);
  void Promise.resolve().then(() => {
    suppressNameCodeTouch.value = false;
  });
}

const [InvoiceForm, invoiceFormApi] = useVbenForm({
  ...formConfig,
  schema: withCandidateFocus(
    useInvoiceFormSchema([], getSupplierSchemaOptions()),
  ),
});

const [FinanceForm, financeFormApi] = useVbenForm({
  ...formConfig,
  schema: withCandidateFocus(useFinanceFormSchema()),
});

const allFormApis = [basicFormApi, invoiceFormApi, financeFormApi];

const currentSupplierId = computed(() => supplier.value?.id);

const title = computed(() => {
  const action = isEditMode.value ? '编辑供应商' : '供应商详情';
  return supplier.value?.name ? `${action} - ${supplier.value.name}` : action;
});
const auditRecord = computed(() =>
  supplier.value
    ? {
        ...supplier.value,
        creatorName:
          showOptionalField('creator') && showOptionalField('creatorName')
            ? resolveSupplierAuditUserName(
                supplier.value.creator,
                supplier.value.creatorName,
                auditUserNameMap.value,
              )
            : supplier.value.creatorName,
        deptName: supplier.value.deptName || deptName(supplier.value.deptId),
        updaterName:
          showOptionalField('updater') && showOptionalField('updaterName')
            ? resolveSupplierAuditUserName(
                supplier.value.updater,
                supplier.value.updaterName,
                auditUserNameMap.value,
              )
            : supplier.value.updaterName,
      }
    : null,
);

const editorTitle = computed(() => {
  const action =
    editorRecord.value.id || editorType.value === 'extendInfo'
      ? '编辑'
      : '新增';
  const names: Record<EditorType, string> = {
    account: '供应商账户',
    bill: '票据登记',
    business: '工商信息',
    contact: '联系人',
    contract: '合同',
    extend: '动态拓展字段',
    extendInfo: '拓展配置',
    image: '企业图片',
    task: '任务量',
  };
  return `${action}${names[editorType.value]}`;
});

async function resetAllForms() {
  pinyinCodeTouched.value = false;
  wubiCodeTouched.value = false;
  for (const api of allFormApis) {
    await api.resetForm();
  }
}

async function setAllFormValues(data: Record<string, any>) {
  suppressNameCodeTouch.value = true;
  try {
    for (const api of allFormApis) {
      await api.setValues(data);
    }
  } finally {
    suppressNameCodeTouch.value = false;
  }
}

async function applyConfiguredSchema(
  schema: ReturnType<typeof useBasicFormSchema>,
) {
  return withCandidateFocus(
    await applyEffectiveFieldVisibility(schema, {
      fieldAliases: SUPPLIER_FIELD_ALIASES,
      config: fieldConfigSnapshot.value,
      fieldConfigHiddenFields: fieldConfigHiddenFields.value,
      moduleKey: FIELD_CONFIG_MODULE,
      roleHiddenFields: hiddenFields.value,
    }),
  );
}

function handleCreateBaseData(payload: SupplierBaseDataQuickCreatePayload) {
  previousQuickCreateFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  quickCreateContext.value = payload;
  baseDataModalApi.setData({ type: payload.type, title: payload.title }).open();
}

function getSupplierFormApiByField(fieldName: string) {
  if (fieldName === 'invoiceType') {
    return invoiceFormApi;
  }
  return basicFormApi;
}

async function handleBaseDataCreated(record: ErpBaseDataApi.BaseData) {
  const context = quickCreateContext.value;
  if (!context) {
    return;
  }

  const targetFormApi = getSupplierFormApiByField(context.fieldName);
  targetFormApi
    .getFieldComponentRef<{ reloadOptions?: () => void }>(context.fieldName)
    ?.reloadOptions?.();

  const value = context.valueField === 'id' ? record?.id : record?.name;
  if (value !== undefined && value !== null && value !== '') {
    await targetFormApi.setFieldValue(context.fieldName, value);
  }
  quickCreateContext.value = undefined;
  await restoreQuickCreateFocus();
}

async function prepareEditForms() {
  const current = loadSequence;
  try {
    const schemaOptions = getSupplierSchemaOptions();
    const [basicSchema, invoiceSchema, financeSchema] = await Promise.all([
      applyConfiguredSchema(useBasicFormSchema([], schemaOptions)),
      applyConfiguredSchema(useInvoiceFormSchema([], schemaOptions)),
      applyConfiguredSchema(useFinanceFormSchema()),
    ]);
    if (current !== loadSequence) return;
    basicFormApi.setState({ schema: basicSchema });
    invoiceFormApi.setState({ schema: invoiceSchema });
    financeFormApi.setState({ schema: financeSchema });
  } catch {
    throw new Error('Supplier field configuration unavailable');
  }
  await nextTick();
}

async function loadFieldVisibility() {
  const current = loadSequence;
  const snapshot = await loadSupplierFieldVisibility();
  if (current !== loadSequence) return;
  hiddenFields.value = snapshot.hiddenFields;
  fieldConfigSnapshot.value = snapshot.config;
  fieldConfigHiddenFields.value = snapshot.configHiddenFields;
  fieldConfigFieldKeys.value = snapshot.configFieldKeys;
  fieldConfigLoaded.value = snapshot.configFieldKeys.length > 0;
}

async function populateEditForms(data: ErpSupplierApi.Supplier) {
  const current = loadSequence;
  const deptValues = buildSupplierDeptEditValues(data, (id) =>
    deptMap.value.get(id),
  );
  const areaValues = buildSupplierAreaEditValues(data);
  await setAllFormValues({ ...data, ...deptValues, ...areaValues });
  await nextTick();
  if (current !== loadSequence) return;
  await basicFormApi.setFieldValue('deptId', deptValues.deptId);
  if (data.allowMultiDept) {
    await basicFormApi.setFieldValue('deptIds', deptValues.deptIds);
  }
}

async function handleSaveSupplier() {
  if (
    !isEditMode.value ||
    !supplier.value?.id ||
    !dataReady.value ||
    loadError.value ||
    mainSaving.value ||
    !canMaintain.value
  )
    return;
  const current = loadSequence;
  const id = supplier.value.id;
  mainSaving.value = true;
  modalApi.lock();
  try {
    for (const api of allFormApis) {
      const { valid } = await api.validate();
      if (current !== loadSequence) return;
      if (!valid) {
        activeTab.value = 'base';
        return;
      }
    }
    const values = await Promise.all(allFormApis.map((api) => api.getValues()));
    if (current !== loadSequence) return;
    await updateSupplier(
      normalizeSupplierFormData(Object.assign({ id }, ...values)),
    );
    emit('success');
    if (current === loadSequence) {
      message.success('保存成功');
      await modalApi.close();
    }
  } finally {
    if (current === loadSequence) {
      mainSaving.value = false;
      modalApi.unlock();
    }
  }
}

const actionColumn = {
  title: '操作',
  dataIndex: 'actions',
  fixed: 'right' as const,
  width: 120,
};

const contactImportanceOptions = [
  { label: '普通', value: 1 },
  { label: '重要', value: 2 },
  { label: '决策人', value: 3 },
];
const genderOptions = [
  { label: '男', value: 1 },
  { label: '女', value: 2 },
];
const freightSettleOptions = [
  { label: '我方承担', value: 1 },
  { label: '客户承担', value: 2 },
  { label: '双方平摊', value: 3 },
  { label: '月结', value: 4 },
];
const imageTypeOptions = [
  '营业执照',
  '门头照片',
  '公司证书',
  '名片',
  '内部照片',
].map((value) => ({
  label: value,
  value,
}));

const imageColumns = [
  { title: '图片类型', dataIndex: 'imageType', width: 110 },
  { title: '图片名称', dataIndex: 'imageName', width: 180 },
  { title: '预览', dataIndex: 'imageUrl', width: 90 },
  { title: '备注', dataIndex: 'remark', width: 150 },
  { title: '排序', dataIndex: 'sort', width: 60 },
  actionColumn,
];
const baseContactColumns: TableColumnsType<any> = [
  { title: '姓名', dataIndex: 'name', width: 120 },
  { title: '移动电话', dataIndex: 'mobile', width: 130 },
  { title: '联系电话', dataIndex: 'telephone', width: 130 },
  { title: '邮箱', dataIndex: 'email', width: 180 },
  { title: '职务', dataIndex: 'position', width: 120 },
  { title: '微信', dataIndex: 'wechat', width: 130 },
  { title: '重要性', dataIndex: 'importance', width: 100 },
  { title: '标记', dataIndex: 'flags', width: 260 },
  { title: '备注', dataIndex: 'remark', width: 180 },
  actionColumn,
];
const baseContractColumns: TableColumnsType<any> = [
  { title: '合同编号', dataIndex: 'contractNo', width: 150 },
  { title: '合同日期', dataIndex: 'contractDate', width: 170 },
  { title: '合同类型', dataIndex: 'contractType', width: 120 },
  { title: '生效日期', dataIndex: 'startTime', width: 170 },
  { title: '终止日期', dataIndex: 'endTime', width: 170 },
  { title: '结算方式', dataIndex: 'settleMethod', width: 120 },
  { title: '运输方式', dataIndex: 'transportMethod', width: 120 },
  { title: '铺底金额', dataIndex: 'baseAmount', width: 120 },
  { title: '目标任务量', dataIndex: 'taskAmount', width: 120 },
  { title: '附件', dataIndex: 'attachmentUrl', width: 160 },
  actionColumn,
];
const baseAccountColumns: TableColumnsType<any> = [
  { title: '账户名', dataIndex: 'accountName', width: 180 },
  { title: '卡号', dataIndex: 'cardNo', width: 220 },
  { title: '开户行', dataIndex: 'bankName', width: 180 },
  { title: '默认', dataIndex: 'defaulted', width: 90 },
  { title: '排序', dataIndex: 'sort', width: 90 },
  { title: '备注', dataIndex: 'remark', width: 180 },
  actionColumn,
];
const baseBillColumns: TableColumnsType<any> = [
  { title: '日期', dataIndex: 'billDate', width: 140 },
  { title: '票据号', dataIndex: 'billNo', width: 180 },
  { title: '金额', dataIndex: 'amount', width: 130 },
  { title: '备注', dataIndex: 'remark', width: 240 },
  actionColumn,
];
const baseTaskColumns: TableColumnsType<any> = [
  { title: '年份', dataIndex: 'year', width: 100 },
  { title: '月份', dataIndex: 'month', width: 100 },
  { title: '级别', dataIndex: 'taskLevel', width: 140 },
  { title: '任务量', dataIndex: 'taskAmount', width: 140 },
  { title: '备注', dataIndex: 'remark', width: 240 },
  actionColumn,
];
const baseExtendColumns: TableColumnsType<any> = [
  { title: '字段标识', dataIndex: 'extendKey', width: 150 },
  { title: '字段名称', dataIndex: 'extendName', width: 150 },
  { title: '字段类型', dataIndex: 'extendType', width: 120 },
  { title: '字段值', dataIndex: 'extendValue', width: 260 },
  { title: '排序', dataIndex: 'sort', width: 90 },
  actionColumn,
];
const baseBusinessColumns: TableColumnsType<any> = [
  { title: '企业名称', dataIndex: 'companyName', width: 180 },
  { title: '统一信用代码', dataIndex: 'creditCode', width: 190 },
  { title: '法人', dataIndex: 'legalPerson', width: 120 },
  { title: '注册地址', dataIndex: 'registeredAddress', width: 260 },
  { title: '经营状态', dataIndex: 'businessStatus', width: 120 },
  { title: '经营范围', dataIndex: 'businessScope', width: 300 },
  actionColumn,
];
const contactColumns = computed<TableColumnsType<any>>(() =>
  prepareErpArchiveItemColumns(baseContactColumns, { rows: contacts.value }),
);
const contractColumns = computed<TableColumnsType<any>>(() =>
  prepareErpArchiveItemColumns(baseContractColumns, { rows: contracts.value }),
);
const accountColumns = computed<TableColumnsType<any>>(() =>
  prepareErpArchiveItemColumns(baseAccountColumns, { rows: accounts.value }),
);
const billColumns = computed<TableColumnsType<any>>(() =>
  prepareErpArchiveItemColumns(baseBillColumns, { rows: bills.value }),
);
const taskColumns = computed<TableColumnsType<any>>(() =>
  prepareErpArchiveItemColumns(baseTaskColumns, { rows: tasks.value }),
);
const extendColumns = computed<TableColumnsType<any>>(() =>
  prepareErpArchiveItemColumns(baseExtendColumns, { rows: extendsList.value }),
);
const businessColumns = computed<TableColumnsType<any>>(() =>
  prepareErpArchiveItemColumns(baseBusinessColumns, {
    rows: businessInfos.value,
  }),
);

const [Modal, modalApi] = useVbenModal({
  destroyOnClose: true,
  onConfirm: handleSaveSupplier,
  onOpened,
  async onOpenChange(isOpen: boolean) {
    const current = ++loadSequence;
    dataReady.value = false;
    loadError.value = '';
    mainSaving.value = false;
    if (!isOpen) {
      endOpen();
      await resetAllForms();
      if (current !== loadSequence) return;
      resetDetail();
      return;
    }
    beginOpen();
    modalApi.setState({ fullscreen: true, confirmDisabled: true });
    loading.value = true;
    modalApi.lock();
    const data = modalApi.getData<SupplierModalData>();
    isEditMode.value = data?.mode === 'edit' && canMaintain.value;
    activeTab.value = data?.activeTab || 'base';
    try {
      await loadFieldVisibility();
      if (current !== loadSequence) return;
      if (!data?.id) throw new Error('Missing supplier');
      await loadDetail(data.id);
      if (current !== loadSequence) return;
      dataReady.value = true;
      modalApi.setState({ confirmDisabled: false });
      if (activeTab.value === 'extendInfo') await loadExtendInfo();
      queueFocus();
    } catch (error) {
      console.error('Failed to open supplier detail', error);
      if (current === loadSequence)
        loadError.value = '资料或权限加载失败，请关闭后重试';
    } finally {
      if (current === loadSequence) {
        loading.value = false;
        modalApi.unlock();
      }
    }
  },
});

const [BaseDataModal, baseDataModalApi] = useVbenModal({
  connectedComponent: BaseDataForm,
  onClosed: restoreQuickCreateFocus,
  destroyOnClose: true,
});

function resetDetail() {
  supplier.value = undefined;
  saving.value = false;
  imageUploading.value = false;
  extendInfoLoaded = false;
  isEditMode.value = false;
  activeTab.value = 'base';
  fieldConfigFieldKeys.value = [];
  fieldConfigHiddenFields.value = [];
  fieldConfigLoaded.value = false;
  contacts.value = [];
  contracts.value = [];
  accounts.value = [];
  bills.value = [];
  tasks.value = [];
  images.value = [];
  extendsList.value = [];
  businessInfos.value = [];
  extendInfo.value = undefined;
  editorVisible.value = false;
  imageUploaderKey.value = 0;
  selectedImageType.value = '营业执照';
}

async function loadDetail(supplierId: number) {
  const current = loadSequence;
  loading.value = true;
  modalApi.lock();
  try {
    const data = await getSupplier(supplierId);
    if (current !== loadSequence) return;
    if (!data) throw new Error('Supplier unavailable');
    supplier.value = data;
    if (isEditMode.value) {
      await prepareEditForms();
      if (current !== loadSequence) return;
      await populateEditForms(data);
    }
  } finally {
    if (current === loadSequence) {
      loading.value = false;
      modalApi.unlock();
    }
  }
}

async function handleDeptDistributionSuccess() {
  const id = currentSupplierId.value;
  const current = loadSequence;
  if (!id) return;
  const data = await getSupplier(id);
  if (current !== loadSequence) return;
  supplier.value = data;
  if (isEditMode.value) {
    const departments = buildSupplierDeptEditValues(data);
    await basicFormApi.setFieldValue('deptId', departments.deptId);
    await basicFormApi.setFieldValue('deptIds', departments.deptIds);
    await basicFormApi.setFieldValue('allowMultiDept', data.allowMultiDept);
  }
  emit('success');
}

function valueOrDash(value?: number | string) {
  return value === null || value === undefined || value === '' ? '-' : value;
}

function valueWithUnit(value: null | number | undefined, unit: string) {
  return value === null || value === undefined ? '-' : value + unit;
}

function monthlySettleDay(value?: number) {
  return value ? `每月 ${value} 日` : '-';
}

function deptName(id?: number, name?: string) {
  if (name) {
    return name;
  }
  if (!id) {
    return '-';
  }
  return deptMap.value.get(id) || '-';
}

function deptNames(ids?: number[], names?: string) {
  if (names) {
    return names;
  }
  const labels = (ids || [])
    .map((id) => deptName(id))
    .filter((name) => name && name !== '-');
  return labels.length > 0 ? labels.join('、') : '-';
}

function showField(fieldKey: string) {
  if (
    !fieldConfigLoaded.value ||
    !isFieldConfigKnown(fieldKey, {
      fieldAliases: SUPPLIER_FIELD_ALIASES,
      fieldConfigFieldKeys: fieldConfigFieldKeys.value,
    })
  ) {
    return false;
  }
  return showOptionalField(fieldKey);
}

function showOptionalField(fieldKey: string) {
  return !isEffectiveFieldHidden(fieldKey, {
    fieldAliases: SUPPLIER_FIELD_ALIASES,
    fieldConfigHiddenFields: fieldConfigHiddenFields.value,
    roleHiddenFields: hiddenFields.value,
  });
}

function getImageNameByUrl(url: string) {
  const segments = url.split('/');
  return decodeURIComponent(segments[segments.length - 1] || '图片');
}

function optionLabel(
  options: { label: string; value: number }[],
  value?: number,
) {
  return options.find((option) => option.value === value)?.label || '-';
}

async function handleImageUpload(value?: string | string[]) {
  const imageUrl = Array.isArray(value) ? value[0] : value;
  if (
    !imageUrl ||
    !currentSupplierId.value ||
    !canMaintain.value ||
    imageUploading.value
  )
    return;
  const current = loadSequence;
  imageUploading.value = true;
  try {
    await createSupplierImage({
      supplierId: currentSupplierId.value,
      imageType: selectedImageType.value,
      imageName: getImageNameByUrl(imageUrl),
      imageUrl,
      sort: 0,
    });
    message.success('上传成功');
    if (current === loadSequence) await refreshItem('image');
  } finally {
    if (current === loadSequence) {
      imageUploading.value = false;
      imageUploaderKey.value += 1;
    }
  }
}

function formatEditorAmount(field: string) {
  const text = String(editorRecord.value[field] ?? '').trim();
  if (
    /^-?(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(text) &&
    Number.isFinite(Number(text))
  )
    editorRecord.value[field] = Number(text).toFixed(2);
}

function openEditor(type: EditorType, record?: Record<string, any>) {
  if (!currentSupplierId.value || !dataReady.value || !canMaintain.value)
    return;
  if (type === 'image' && !record) return;
  editorType.value = type;
  const defaults: Record<string, any> = { supplierId: currentSupplierId.value };
  switch (type) {
    case 'account':
    case 'extend':
    case 'image': {
      defaults.sort = 0;
      if (type === 'image') {
        defaults.imageType = selectedImageType.value;
      }
      break;
    }
    case 'contact': {
      defaults.companyId = currentSupplierId.value;
      defaults.importance = 1;
      break;
    }
    case 'contract': {
      defaults.baseAmount = 0;
      defaults.taskAmount = 0;
      break;
    }
    case 'extendInfo': {
      Object.assign(defaults, extendInfo.value || {});
      break;
    }
    case 'task': {
      defaults.year = new Date().getFullYear();
      defaults.month = new Date().getMonth() + 1;
      break;
    }
  }
  editorRecord.value = {
    ...defaults,
    ...record,
  };
  editorVisible.value = true;
}

async function handleSaveEditor() {
  if (
    saving.value ||
    !dataReady.value ||
    !currentSupplierId.value ||
    !canMaintain.value
  )
    return;
  const current = loadSequence;
  const type = editorType.value;
  const editorRequest = editorSequence;
  saving.value = true;
  try {
    const data: any = normalizeSupplierEditor(type, {
      ...editorRecord.value,
      supplierId: currentSupplierId.value,
    });
    if (editorType.value === 'image' && data.imageUrl && !data.imageName) {
      data.imageName = getImageNameByUrl(data.imageUrl);
    }
    switch (editorType.value) {
      case 'account': {
        await (data.id
          ? updateSupplierAccount(data)
          : createSupplierAccount(data));
        break;
      }
      case 'bill': {
        await (data.id ? updateSupplierBill(data) : createSupplierBill(data));
        break;
      }
      case 'business': {
        await (data.id
          ? updateSupplierBusinessInfo(data)
          : createSupplierBusinessInfo(data));
        break;
      }
      case 'contact': {
        await (data.id
          ? updateSupplierContact(data)
          : createSupplierContact(data));
        break;
      }
      case 'contract': {
        await (data.id
          ? updateSupplierContract(data)
          : createSupplierContract(data));
        break;
      }
      case 'extend': {
        await (data.id
          ? updateSupplierExtend(data)
          : createSupplierExtend(data));
        break;
      }
      case 'extendInfo': {
        await saveSupplierExtendInfo(data);
        break;
      }
      case 'image': {
        await (data.id ? updateSupplierImage(data) : createSupplierImage(data));
        break;
      }
      case 'task': {
        await (data.id ? updateSupplierTask(data) : createSupplierTask(data));
        break;
      }
    }
    if (current !== loadSequence || editorRequest !== editorSequence) return;
    saving.value = false;
    editorVisible.value = false;
    message.success('保存成功');
    await refreshItem(type);
  } catch (error) {
    if (current === loadSequence)
      message.error(error instanceof Error ? error.message : '保存失败');
  } finally {
    if (current === loadSequence && editorRequest === editorSequence)
      saving.value = false;
  }
}

async function handleDelete(type: EditorType, id?: number) {
  if (!id || !canMaintain.value || !dataReady.value) return;
  const current = loadSequence;
  switch (type) {
    case 'account': {
      await deleteSupplierAccount(id);
      break;
    }
    case 'bill': {
      await deleteSupplierBill(id);
      break;
    }
    case 'business': {
      await deleteSupplierBusinessInfo(id);
      break;
    }
    case 'contact': {
      await deleteSupplierContact(id);
      break;
    }
    case 'contract': {
      await deleteSupplierContract(id);
      break;
    }
    case 'extend': {
      await deleteSupplierExtend(id);
      break;
    }
    case 'image': {
      await deleteSupplierImage(id);
      break;
    }
    case 'task': {
      await deleteSupplierTask(id);
      break;
    }
  }
  if (current !== loadSequence) return;
  message.success('删除成功');
  await refreshItem(type, true);
}
</script>

<template>
  <Modal
    :show-confirm-button="isEditMode"
    :title="title"
    class="!w-full"
    bordered
    content-class="p-0"
  >
    <BaseDataModal @success="handleBaseDataCreated" />
    <div
      :ref="setFormScope"
      :class="{ 'erp-form-focus-highlight': isEditMode }"
      @keydown.enter.capture="handleFormEnter"
    >
      <Alert v-if="loadError" :message="loadError" type="error" show-icon />
      <Spin :spinning="loading">
        <Tabs v-model:active-key="activeTab" class="supplier-detail-tabs">
          <Tabs.TabPane key="base" tab="基础信息">
            <div v-if="isEditMode" class="supplier-detail-layout">
              <section class="supplier-detail-section">
                <header class="supplier-detail-section__header">
                  <span class="supplier-detail-section__title">基础信息</span>
                </header>
                <BasicForm class="supplier-edit-form" />
              </section>

              <section class="supplier-detail-section">
                <header class="supplier-detail-section__header">
                  <span class="supplier-detail-section__title">开票信息</span>
                </header>
                <InvoiceForm class="supplier-edit-form" />
              </section>

              <section class="supplier-detail-section">
                <header class="supplier-detail-section__header">
                  <span class="supplier-detail-section__title">财务信息</span>
                </header>
                <FinanceForm class="supplier-edit-form" />
              </section>
            </div>

            <div v-else class="supplier-detail-layout">
              <section class="supplier-detail-section">
                <header class="supplier-detail-section__header">
                  <span class="supplier-detail-section__title">基础信息</span>
                </header>
                <div class="supplier-detail-grid">
                  <div v-if="showField('name')" class="supplier-detail-field">
                    <span>供应商名称</span>
                    <strong>{{ valueOrDash(supplier?.name) }}</strong>
                  </div>
                  <div
                    v-if="showField('shortName')"
                    class="supplier-detail-field"
                  >
                    <span>简称</span>
                    <strong>{{ valueOrDash(supplier?.shortName) }}</strong>
                  </div>
                  <div
                    v-if="showField('pinyinCode')"
                    class="supplier-detail-field"
                  >
                    <span>拼音码</span>
                    <strong>{{ valueOrDash(supplier?.pinyinCode) }}</strong>
                  </div>
                  <div
                    v-if="showField('wubiCode')"
                    class="supplier-detail-field"
                  >
                    <span>五笔码</span>
                    <strong>{{ valueOrDash(supplier?.wubiCode) }}</strong>
                  </div>
                  <div v-if="showField('code')" class="supplier-detail-field">
                    <span>供应商编码</span>
                    <strong>{{ valueOrDash(supplier?.code) }}</strong>
                  </div>
                  <div v-if="showField('deptId')" class="supplier-detail-field">
                    <span>所属部门</span>
                    <strong>{{
                      deptName(supplier?.deptId, supplier?.deptName)
                    }}</strong>
                  </div>
                  <div
                    v-if="showField('allowMultiDept')"
                    class="supplier-detail-field"
                  >
                    <span>允许多部门</span>
                    <strong>{{
                      supplier?.allowMultiDept ? '是' : '否'
                    }}</strong>
                  </div>
                  <div
                    v-if="showField('deptIds') && supplier?.allowMultiDept"
                    class="supplier-detail-field"
                  >
                    <span>适用部门</span>
                    <strong>{{
                      deptNames(supplier?.deptIds, supplier?.deptNames)
                    }}</strong>
                  </div>
                  <div
                    v-if="showField('contact')"
                    class="supplier-detail-field"
                  >
                    <span>联系人</span>
                    <strong>{{ valueOrDash(supplier?.contact) }}</strong>
                  </div>
                  <div v-if="showField('mobile')" class="supplier-detail-field">
                    <span>手机号码</span>
                    <strong>{{ valueOrDash(supplier?.mobile) }}</strong>
                  </div>
                  <div
                    v-if="showField('telephone')"
                    class="supplier-detail-field"
                  >
                    <span>联系电话</span>
                    <strong>{{ valueOrDash(supplier?.telephone) }}</strong>
                  </div>
                  <div v-if="showField('email')" class="supplier-detail-field">
                    <span>电子邮箱</span>
                    <strong>{{ valueOrDash(supplier?.email) }}</strong>
                  </div>
                  <div
                    v-if="showField('areaIds')"
                    class="supplier-detail-field"
                  >
                    <span>省市区县</span>
                    <strong>{{
                      valueOrDash(formatSupplierArea(supplier))
                    }}</strong>
                  </div>
                  <div
                    v-if="showField('category')"
                    class="supplier-detail-field"
                  >
                    <span>供应商类别</span>
                    <strong>{{ valueOrDash(supplier?.category) }}</strong>
                  </div>
                  <div
                    v-if="showField('purchaser')"
                    class="supplier-detail-field"
                  >
                    <span>采购员</span>
                    <strong>{{ valueOrDash(supplier?.purchaser) }}</strong>
                  </div>
                  <div
                    v-if="showField('settleMethod')"
                    class="supplier-detail-field"
                  >
                    <span>结算方式</span>
                    <strong>{{ valueOrDash(supplier?.settleMethod) }}</strong>
                  </div>
                  <div
                    v-if="showField('transportMethod')"
                    class="supplier-detail-field"
                  >
                    <span>运输方式</span>
                    <strong>{{
                      valueOrDash(supplier?.transportMethod)
                    }}</strong>
                  </div>
                  <div
                    v-if="showField('freightType')"
                    class="supplier-detail-field"
                  >
                    <span>运费类型</span>
                    <strong>{{ valueOrDash(supplier?.freightType) }}</strong>
                  </div>
                  <div
                    v-if="showField('logisticsCompany')"
                    class="supplier-detail-field"
                  >
                    <span>物流公司</span>
                    <strong>{{
                      valueOrDash(supplier?.logisticsCompany)
                    }}</strong>
                  </div>
                  <div
                    v-if="showField('remark')"
                    class="supplier-detail-field is-wide"
                  >
                    <span>备注</span>
                    <strong>{{ valueOrDash(supplier?.remark) }}</strong>
                  </div>
                </div>
              </section>

              <section class="supplier-detail-section">
                <header class="supplier-detail-section__header">
                  <span class="supplier-detail-section__title">开票信息</span>
                </header>
                <div class="supplier-detail-grid">
                  <div
                    v-if="showField('invoiceType')"
                    class="supplier-detail-field"
                  >
                    <span>开票类型</span>
                    <strong>{{ valueOrDash(supplier?.invoiceType) }}</strong>
                  </div>
                  <div
                    v-if="showField('taxpayerId')"
                    class="supplier-detail-field"
                  >
                    <span>纳税人识别号</span>
                    <strong>{{ valueOrDash(supplier?.taxpayerId) }}</strong>
                  </div>
                  <div
                    v-if="showField('invoiceBank')"
                    class="supplier-detail-field"
                  >
                    <span>开票银行</span>
                    <strong>{{ valueOrDash(supplier?.invoiceBank) }}</strong>
                  </div>
                  <div
                    v-if="showField('invoiceBankAccount')"
                    class="supplier-detail-field"
                  >
                    <span>开票银行账号</span>
                    <strong>{{
                      valueOrDash(supplier?.invoiceBankAccount)
                    }}</strong>
                  </div>
                  <div
                    v-if="showField('invoiceAddress')"
                    class="supplier-detail-field"
                  >
                    <span>开票地址</span>
                    <strong>{{ valueOrDash(supplier?.invoiceAddress) }}</strong>
                  </div>
                  <div
                    v-if="showField('invoicePhone')"
                    class="supplier-detail-field"
                  >
                    <span>开票电话</span>
                    <strong>{{ valueOrDash(supplier?.invoicePhone) }}</strong>
                  </div>
                  <div
                    v-if="showField('invoiceCompany')"
                    class="supplier-detail-field"
                  >
                    <span>开票单位</span>
                    <strong>{{ valueOrDash(supplier?.invoiceCompany) }}</strong>
                  </div>
                </div>
              </section>

              <section class="supplier-detail-section">
                <header class="supplier-detail-section__header">
                  <span class="supplier-detail-section__title">财务信息</span>
                </header>
                <div class="supplier-detail-grid">
                  <div
                    v-if="showField('account')"
                    class="supplier-detail-field"
                  >
                    <span>账户</span>
                    <strong>{{ valueOrDash(supplier?.account) }}</strong>
                  </div>
                  <div
                    v-if="showField('bankName')"
                    class="supplier-detail-field"
                  >
                    <span>开户行</span>
                    <strong>{{ valueOrDash(supplier?.bankName) }}</strong>
                  </div>
                  <div
                    v-if="showField('bankAccount')"
                    class="supplier-detail-field"
                  >
                    <span>开户账号</span>
                    <strong>{{ valueOrDash(supplier?.bankAccount) }}</strong>
                  </div>
                  <div
                    v-if="showField('bankAddress')"
                    class="supplier-detail-field"
                  >
                    <span>开户地址</span>
                    <strong>{{ valueOrDash(supplier?.bankAddress) }}</strong>
                  </div>
                  <div v-if="showField('taxNo')" class="supplier-detail-field">
                    <span>纳税人识别号</span>
                    <strong>{{ valueOrDash(supplier?.taxNo) }}</strong>
                  </div>
                  <div
                    v-if="showField('taxPercent')"
                    class="supplier-detail-field"
                  >
                    <span>税率(%)</span>
                    <strong>{{ valueOrDash(supplier?.taxPercent) }}</strong>
                  </div>
                  <div
                    v-if="showField('financePhone')"
                    class="supplier-detail-field"
                  >
                    <span>财务联系电话</span>
                    <strong>{{ valueOrDash(supplier?.financePhone) }}</strong>
                  </div>
                  <div
                    v-if="showField('memberCode')"
                    class="supplier-detail-field"
                  >
                    <span>会员编码</span>
                    <strong>{{ valueOrDash(supplier?.memberCode) }}</strong>
                  </div>
                  <div
                    v-if="showField('legalPerson')"
                    class="supplier-detail-field"
                  >
                    <span>法定代表</span>
                    <strong>{{ valueOrDash(supplier?.legalPerson) }}</strong>
                  </div>
                  <div
                    v-if="showField('creditCode')"
                    class="supplier-detail-field"
                  >
                    <span>统一信用代码</span>
                    <strong>{{ valueOrDash(supplier?.creditCode) }}</strong>
                  </div>
                </div>
              </section>
            </div>
          </Tabs.TabPane>

          <Tabs.TabPane key="contacts" tab="联系人">
            <div class="mb-3 flex justify-end">
              <Button
                v-if="canMaintain"
                type="primary"
                @click="openEditor('contact')"
              >
                新增
              </Button>
            </div>
            <SupplierItemGrid
              :ref="(el) => setItemGrid('contacts', el)"
              grid-key="contacts"
              :active="activeTab === 'contacts' && dataReady"
              :supplier-id="currentSupplierId"
              :api="getSupplierContactPage"
              :columns="contactColumns"
              :can-maintain="canMaintain"
              @loaded="contacts = $event"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'importance'">
                  {{ optionLabel(contactImportanceOptions, record.importance) }}
                </template>
                <template v-else-if="column.dataIndex === 'flags'">
                  <div class="flex flex-wrap gap-1">
                    <Tag v-if="record.primaryContact" color="blue">
                      主联系人
                    </Tag>
                    <Tag v-if="record.receiverContact" color="green">收货</Tag>
                    <Tag v-if="record.settleContact" color="orange">结算</Tag>
                    <Tag v-if="record.messageContact" color="purple">消息</Tag>
                    <Tag v-if="record.salesperson" color="cyan">导购员</Tag>
                  </div>
                </template>
                <template v-else-if="column.dataIndex === 'actions'">
                  <TableAction
                    :action-gap="6"
                    :actions="[
                      {
                        label: '编辑',
                        type: 'link',
                        icon: ACTION_ICON.EDIT,
                        auth: ['erp:supplier:update'],
                        onClick: () => openEditor('contact', record),
                      },
                      {
                        label: '删除',
                        type: 'link',
                        icon: ACTION_ICON.DELETE,
                        auth: ['erp:supplier:update'],
                        popConfirm: {
                          title: '确认删除该资料？',
                          confirm: () => handleDelete('contact', record.id),
                        },
                      },
                    ]"
                  />
                </template>
              </template>
            </SupplierItemGrid>
          </Tabs.TabPane>

          <Tabs.TabPane key="contracts" tab="合同">
            <div class="mb-3 flex justify-end">
              <Button
                v-if="canMaintain"
                type="primary"
                @click="openEditor('contract')"
              >
                新增
              </Button>
            </div>
            <SupplierItemGrid
              :ref="(el) => setItemGrid('contracts', el)"
              grid-key="contracts"
              :active="activeTab === 'contracts' && dataReady"
              :supplier-id="currentSupplierId"
              :api="getSupplierContractPage"
              :columns="contractColumns"
              :can-maintain="canMaintain"
              @loaded="contracts = $event"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'attachmentUrl'">
                  <a
                    v-if="record.attachmentUrl"
                    :href="record.attachmentUrl"
                    target="_blank"
                  >
                    <span>查看附件</span>
                  </a>
                  <span v-else>-</span>
                </template>
                <template v-else-if="column.dataIndex === 'actions'">
                  <TableAction
                    :action-gap="6"
                    :actions="[
                      {
                        label: '编辑',
                        type: 'link',
                        icon: ACTION_ICON.EDIT,
                        auth: ['erp:supplier:update'],
                        onClick: () => openEditor('contract', record),
                      },
                      {
                        label: '删除',
                        type: 'link',
                        icon: ACTION_ICON.DELETE,
                        auth: ['erp:supplier:update'],
                        popConfirm: {
                          title: '确认删除该资料？',
                          confirm: () => handleDelete('contract', record.id),
                        },
                      },
                    ]"
                  />
                </template>
              </template>
            </SupplierItemGrid>
          </Tabs.TabPane>

          <Tabs.TabPane key="extendInfo" tab="拓展配置">
            <div class="supplier-extend-layout">
              <div class="supplier-extend-toolbar">
                <div>
                  <div class="supplier-extend-toolbar__title">采购协同设置</div>
                  <div class="supplier-extend-toolbar__description">
                    统一维护合作、退货入库及库存补货规则
                  </div>
                </div>
                <Button
                  v-if="canMaintain"
                  type="primary"
                  @click="openEditor('extendInfo')"
                >
                  编辑配置
                </Button>
              </div>

              <section class="supplier-extend-section">
                <header class="supplier-extend-section__header">
                  <div>
                    <div class="supplier-extend-section__title">合作与结算</div>
                    <div class="supplier-extend-section__description">
                      供应商合作级别与月度结算参数
                    </div>
                  </div>
                </header>
                <div class="supplier-extend-grid">
                  <div class="supplier-extend-field">
                    <span>重点供应商</span>
                    <strong>
                      <span
                        class="supplier-extend-state"
                        :class="{ 'is-active': extendInfo?.keySupplier }"
                      >
                        <i></i>
                        {{ extendInfo?.keySupplier ? '是' : '否' }}
                      </span>
                    </strong>
                  </div>
                  <div class="supplier-extend-field">
                    <span>联盟补货</span>
                    <strong>
                      <span
                        class="supplier-extend-state"
                        :class="{
                          'is-active': extendInfo?.allianceReplenishment,
                        }"
                      >
                        <i></i>
                        {{
                          extendInfo?.allianceReplenishment
                            ? '已启用'
                            : '未启用'
                        }}
                      </span>
                    </strong>
                  </div>
                  <div class="supplier-extend-field">
                    <span>价格浮动率</span>
                    <strong>{{
                      valueWithUnit(extendInfo?.priceMarkupRate, '%')
                    }}</strong>
                  </div>
                  <div class="supplier-extend-field">
                    <span>结账日期</span>
                    <strong>{{
                      monthlySettleDay(extendInfo?.settleDay)
                    }}</strong>
                  </div>
                </div>
              </section>

              <section class="supplier-extend-section">
                <header class="supplier-extend-section__header">
                  <div>
                    <div class="supplier-extend-section__title">退货与入库</div>
                    <div class="supplier-extend-section__description">
                      采购退货联络信息及入库任务规则
                    </div>
                  </div>
                </header>
                <div class="supplier-extend-grid">
                  <div class="supplier-extend-field">
                    <span>退货联系人</span>
                    <strong>{{
                      valueOrDash(extendInfo?.purchaseReturnContact)
                    }}</strong>
                  </div>
                  <div class="supplier-extend-field">
                    <span>退货电话</span>
                    <strong>{{
                      valueOrDash(extendInfo?.purchaseReturnPhone)
                    }}</strong>
                  </div>
                  <div class="supplier-extend-field is-wide">
                    <span>退货地址</span>
                    <strong>{{
                      valueOrDash(extendInfo?.purchaseReturnAddress)
                    }}</strong>
                  </div>
                  <div class="supplier-extend-field">
                    <span>产生入仓单</span>
                    <strong>
                      <span
                        class="supplier-extend-state"
                        :class="{ 'is-active': extendInfo?.generateInBill }"
                      >
                        <i></i>
                        {{ extendInfo?.generateInBill ? '已启用' : '未启用' }}
                      </span>
                    </strong>
                  </div>
                  <div class="supplier-extend-field">
                    <span>入库方式</span>
                    <strong>{{
                      valueOrDash(extendInfo?.inboundMethod)
                    }}</strong>
                  </div>
                  <div class="supplier-extend-field">
                    <span>生成贴码任务</span>
                    <strong>
                      <span
                        class="supplier-extend-state"
                        :class="{ 'is-active': extendInfo?.generateLabelTask }"
                      >
                        <i></i>
                        {{
                          extendInfo?.generateLabelTask ? '已启用' : '未启用'
                        }}
                      </span>
                    </strong>
                  </div>
                </div>
              </section>

              <section class="supplier-extend-section">
                <header class="supplier-extend-section__header">
                  <div>
                    <div class="supplier-extend-section__title">自动补货</div>
                    <div class="supplier-extend-section__description">
                      补货计划、执行时间及安全库存区间
                    </div>
                  </div>
                  <span
                    class="supplier-extend-state"
                    :class="{
                      'is-active': extendInfo?.autoReplenishmentEnabled,
                    }"
                  >
                    <i></i>
                    {{
                      extendInfo?.autoReplenishmentEnabled ? '已启用' : '未启用'
                    }}
                  </span>
                </header>
                <div class="supplier-extend-grid">
                  <div class="supplier-extend-field is-wide">
                    <span>补货公式</span>
                    <strong>{{
                      valueOrDash(extendInfo?.autoReplenishmentFormula)
                    }}</strong>
                  </div>
                  <div class="supplier-extend-field">
                    <span>补货周期</span>
                    <strong>{{
                      valueOrDash(extendInfo?.autoReplenishmentCycle)
                    }}</strong>
                  </div>
                  <div class="supplier-extend-field">
                    <span>补货时间</span>
                    <strong>{{
                      valueOrDash(extendInfo?.autoReplenishmentTime)
                    }}</strong>
                  </div>
                  <div class="supplier-extend-field">
                    <span>下次订货</span>
                    <strong>{{
                      valueOrDash(extendInfo?.nextOrderDate)
                    }}</strong>
                  </div>
                  <div class="supplier-extend-field">
                    <span>库存上限</span>
                    <strong>{{
                      valueWithUnit(extendInfo?.stockUpperDays, ' 天')
                    }}</strong>
                  </div>
                  <div class="supplier-extend-field">
                    <span>标准库存</span>
                    <strong>{{
                      valueWithUnit(extendInfo?.stockStandardDays, ' 天')
                    }}</strong>
                  </div>
                  <div class="supplier-extend-field">
                    <span>库存下限</span>
                    <strong>{{
                      valueWithUnit(extendInfo?.stockLowerDays, ' 天')
                    }}</strong>
                  </div>
                </div>
              </section>
            </div>
          </Tabs.TabPane>

          <Tabs.TabPane key="extends" tab="动态字段">
            <div class="mb-3 flex justify-end">
              <Button
                v-if="canMaintain"
                type="primary"
                @click="openEditor('extend')"
              >
                新增
              </Button>
            </div>
            <SupplierItemGrid
              :ref="(el) => setItemGrid('extends', el)"
              grid-key="extends"
              :active="activeTab === 'extends' && dataReady"
              :supplier-id="currentSupplierId"
              :api="getSupplierExtendPage"
              :columns="extendColumns"
              :can-maintain="canMaintain"
              @loaded="extendsList = $event"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'actions'">
                  <TableAction
                    :action-gap="6"
                    :actions="[
                      {
                        label: '编辑',
                        type: 'link',
                        icon: ACTION_ICON.EDIT,
                        auth: ['erp:supplier:update'],
                        onClick: () => openEditor('extend', record),
                      },
                      {
                        label: '删除',
                        type: 'link',
                        icon: ACTION_ICON.DELETE,
                        auth: ['erp:supplier:update'],
                        popConfirm: {
                          title: '确认删除该资料？',
                          confirm: () => handleDelete('extend', record.id),
                        },
                      },
                    ]"
                  />
                </template>
              </template>
            </SupplierItemGrid>
          </Tabs.TabPane>

          <Tabs.TabPane key="images" tab="企业信息">
            <div class="supplier-images-toolbar">
              <div>
                <div class="supplier-images-title">企业图片</div>
                <div class="supplier-images-subtitle">
                  先选择图片类型，再直接上传图片，系统会自动创建图片记录。
                </div>
              </div>
              <div class="supplier-images-actions">
                <Select
                  v-model:value="selectedImageType"
                  :options="imageTypeOptions"
                  class="supplier-images-type"
                />
                <ImageUpload
                  :key="imageUploaderKey"
                  :disabled="
                    imageUploading || !currentSupplierId || !canMaintain
                  "
                  :max-number="1"
                  :show-description="false"
                  @change="handleImageUpload"
                />
              </div>
            </div>
            <SupplierItemGrid
              :ref="(el) => setItemGrid('images', el)"
              grid-key="images"
              :active="activeTab === 'images' && dataReady"
              :supplier-id="currentSupplierId"
              :api="getSupplierImagePage"
              :columns="imageColumns"
              :can-maintain="canMaintain"
              @loaded="images = $event"
            >
              <template #bodyCell="{ column, record }">
                <Image
                  v-if="column.dataIndex === 'imageUrl'"
                  :src="record.imageUrl"
                  :width="64"
                  :height="48"
                  class="object-cover"
                />
                <div v-else-if="column.dataIndex === 'actions'">
                  <Button
                    size="small"
                    type="link"
                    @click="openEditor('image', record)"
                  >
                    编辑
                  </Button>
                  <Popconfirm
                    title="确认删除该图片？"
                    @confirm="handleDelete('image', record.id)"
                  >
                    <Button danger size="small" type="link"> 删除 </Button>
                  </Popconfirm>
                </div>
              </template>
            </SupplierItemGrid>
          </Tabs.TabPane>

          <Tabs.TabPane key="accounts" tab="供应商账户">
            <div class="mb-3 flex justify-end">
              <Button
                v-if="canMaintain"
                type="primary"
                @click="openEditor('account')"
              >
                新增
              </Button>
            </div>
            <SupplierItemGrid
              :ref="(el) => setItemGrid('accounts', el)"
              grid-key="accounts"
              :active="activeTab === 'accounts' && dataReady"
              :supplier-id="currentSupplierId"
              :api="getSupplierAccountPage"
              :columns="accountColumns"
              :can-maintain="canMaintain"
              @loaded="accounts = $event"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'defaulted'">
                  <Tag v-if="record.defaulted" color="blue">默认</Tag>
                  <span v-else>否</span>
                </template>
                <template v-else-if="column.dataIndex === 'actions'">
                  <TableAction
                    :action-gap="6"
                    :actions="[
                      {
                        label: '编辑',
                        type: 'link',
                        icon: ACTION_ICON.EDIT,
                        auth: ['erp:supplier:update'],
                        onClick: () => openEditor('account', record),
                      },
                      {
                        label: '删除',
                        type: 'link',
                        icon: ACTION_ICON.DELETE,
                        auth: ['erp:supplier:update'],
                        popConfirm: {
                          title: '确认删除该资料？',
                          confirm: () => handleDelete('account', record.id),
                        },
                      },
                    ]"
                  />
                </template>
              </template>
            </SupplierItemGrid>
          </Tabs.TabPane>

          <Tabs.TabPane key="bills" tab="票据登记">
            <div class="mb-3 flex justify-end">
              <Button
                v-if="canMaintain"
                type="primary"
                @click="openEditor('bill')"
              >
                新增
              </Button>
            </div>
            <SupplierItemGrid
              :ref="(el) => setItemGrid('bills', el)"
              grid-key="bills"
              :active="activeTab === 'bills' && dataReady"
              :supplier-id="currentSupplierId"
              :api="getSupplierBillPage"
              :columns="billColumns"
              :can-maintain="canMaintain"
              @loaded="bills = $event"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'actions'">
                  <TableAction
                    :action-gap="6"
                    :actions="[
                      {
                        label: '编辑',
                        type: 'link',
                        icon: ACTION_ICON.EDIT,
                        auth: ['erp:supplier:update'],
                        onClick: () => openEditor('bill', record),
                      },
                      {
                        label: '删除',
                        type: 'link',
                        icon: ACTION_ICON.DELETE,
                        auth: ['erp:supplier:update'],
                        popConfirm: {
                          title: '确认删除该资料？',
                          confirm: () => handleDelete('bill', record.id),
                        },
                      },
                    ]"
                  />
                </template>
              </template>
            </SupplierItemGrid>
          </Tabs.TabPane>

          <Tabs.TabPane key="tasks" tab="任务量">
            <div class="mb-3 flex justify-end">
              <Button
                v-if="canMaintain"
                type="primary"
                @click="openEditor('task')"
              >
                新增
              </Button>
            </div>
            <SupplierItemGrid
              :ref="(el) => setItemGrid('tasks', el)"
              grid-key="tasks"
              :active="activeTab === 'tasks' && dataReady"
              :supplier-id="currentSupplierId"
              :api="getSupplierTaskPage"
              :columns="taskColumns"
              :can-maintain="canMaintain"
              @loaded="tasks = $event"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'actions'">
                  <TableAction
                    :action-gap="6"
                    :actions="[
                      {
                        label: '编辑',
                        type: 'link',
                        icon: ACTION_ICON.EDIT,
                        auth: ['erp:supplier:update'],
                        onClick: () => openEditor('task', record),
                      },
                      {
                        label: '删除',
                        type: 'link',
                        icon: ACTION_ICON.DELETE,
                        auth: ['erp:supplier:update'],
                        popConfirm: {
                          title: '确认删除该资料？',
                          confirm: () => handleDelete('task', record.id),
                        },
                      },
                    ]"
                  />
                </template>
              </template>
            </SupplierItemGrid>
          </Tabs.TabPane>

          <Tabs.TabPane key="business" tab="工商信息">
            <div class="mb-3 flex justify-end">
              <Button
                v-if="canMaintain"
                type="primary"
                @click="openEditor('business')"
              >
                新增
              </Button>
            </div>
            <SupplierItemGrid
              :ref="(el) => setItemGrid('business', el)"
              grid-key="business"
              :active="activeTab === 'business' && dataReady"
              :supplier-id="currentSupplierId"
              :api="getSupplierBusinessInfoPage"
              :columns="businessColumns"
              :can-maintain="canMaintain"
              @loaded="businessInfos = $event"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'actions'">
                  <TableAction
                    :action-gap="6"
                    :actions="[
                      {
                        label: '编辑',
                        type: 'link',
                        icon: ACTION_ICON.EDIT,
                        auth: ['erp:supplier:update'],
                        onClick: () => openEditor('business', record),
                      },
                      {
                        label: '删除',
                        type: 'link',
                        icon: ACTION_ICON.DELETE,
                        auth: ['erp:supplier:update'],
                        popConfirm: {
                          title: '确认删除该资料？',
                          confirm: () => handleDelete('business', record.id),
                        },
                      },
                    ]"
                  />
                </template>
              </template>
            </SupplierItemGrid>
          </Tabs.TabPane>

          <Tabs.TabPane key="deptDistribution" tab="分配部门">
            <SupplierDeptDistribution
              v-if="
                activeTab === 'deptDistribution' && dataReady && canDistribute
              "
              archive-name="供应商"
              :auth="['erp:supplier:dept-distribute']"
              :load-api="getSupplierDeptDistribution"
              :record="supplier"
              :save-api="updateSupplierDeptDistribution"
              :show-dept-id="false"
              @success="handleDeptDistributionSuccess"
            />
          </Tabs.TabPane>
        </Tabs>
        <ErpAuditInfo
          v-if="auditRecord"
          class="supplier-detail-audit"
          :department-keys="['createDeptName', 'createDeptId']"
          department-label="创建部门"
          :record="auditRecord"
        />
      </Spin>
    </div>

    <AModal
      v-model:open="editorVisible"
      :style="{ top: '24px' }"
      :body-style="{ maxHeight: 'calc(100dvh - 180px)', overflowY: 'auto' }"
      :confirm-loading="saving"
      :closable="!saving"
      :mask-closable="!saving"
      :keyboard="!saving"
      :title="editorTitle"
      destroy-on-close
      @ok="handleSaveEditor"
    >
      <div
        :ref="setEditorScope"
        class="erp-form-focus-highlight"
        @keydown.enter.capture="editorKeyboard.handleFormEnter"
      >
        <AForm :label-col="{ style: { width: '108px' } }" :model="editorRecord">
          <template v-if="editorType === 'contact'">
            <FormItem label="姓名" required>
              <Input v-model:value="editorRecord.name" />
            </FormItem>
            <FormItem label="移动电话" required>
              <Input v-model:value="editorRecord.mobile" />
            </FormItem>
            <FormItem label="联系电话">
              <Input v-model:value="editorRecord.telephone" />
            </FormItem>
            <FormItem label="邮箱">
              <Input v-model:value="editorRecord.email" />
            </FormItem>
            <FormItem label="性别">
              <Select
                v-model:value="editorRecord.gender"
                :options="genderOptions"
                allow-clear
                class="w-full"
              />
            </FormItem>
            <FormItem label="职务">
              <Input v-model:value="editorRecord.position" />
            </FormItem>
            <FormItem label="微信">
              <Input v-model:value="editorRecord.wechat" />
            </FormItem>
            <FormItem label="重要性">
              <Select
                v-model:value="editorRecord.importance"
                :options="contactImportanceOptions"
                allow-clear
                class="w-full"
              />
            </FormItem>
            <FormItem label="标记">
              <div class="grid grid-cols-2 gap-2">
                <Checkbox v-model:checked="editorRecord.primaryContact">
                  主联系人
                </Checkbox>
                <Checkbox v-model:checked="editorRecord.receiverContact">
                  收货
                </Checkbox>
                <Checkbox v-model:checked="editorRecord.settleContact">
                  结算
                </Checkbox>
                <Checkbox v-model:checked="editorRecord.messageContact">
                  消息
                </Checkbox>
                <Checkbox v-model:checked="editorRecord.salesperson">
                  导购员
                </Checkbox>
              </div>
            </FormItem>
          </template>

          <template v-else-if="editorType === 'contract'">
            <FormItem label="合同编号" required>
              <Input v-model:value="editorRecord.contractNo" />
            </FormItem>
            <FormItem label="合同日期" required>
              <DatePicker
                v-model:value="editorRecord.contractDate"
                show-time
                value-format="YYYY-MM-DD HH:mm:ss"
                class="w-full"
              />
            </FormItem>
            <FormItem label="合同类型">
              <Input v-model:value="editorRecord.contractType" />
            </FormItem>
            <FormItem label="结算方式">
              <Input v-model:value="editorRecord.settleMethod" />
            </FormItem>
            <FormItem label="生效日期">
              <DatePicker
                v-model:value="editorRecord.startTime"
                show-time
                value-format="YYYY-MM-DD HH:mm:ss"
                class="w-full"
              />
            </FormItem>
            <FormItem label="终止日期">
              <DatePicker
                v-model:value="editorRecord.endTime"
                show-time
                value-format="YYYY-MM-DD HH:mm:ss"
                class="w-full"
              />
            </FormItem>
            <FormItem label="运输方式">
              <Input v-model:value="editorRecord.transportMethod" />
            </FormItem>
            <FormItem label="运费结算">
              <Select
                v-model:value="editorRecord.freightSettleMethod"
                :options="freightSettleOptions"
                allow-clear
                class="w-full"
              />
            </FormItem>
            <FormItem label="铺底金额">
              <Input
                v-model:value="editorRecord.baseAmount"
                @blur="formatEditorAmount('baseAmount')"
                class="w-full"
                inputmode="decimal"
              />
            </FormItem>
            <FormItem label="目标任务量">
              <Input
                v-model:value="editorRecord.taskAmount"
                class="w-full"
                inputmode="decimal"
              />
            </FormItem>
            <FormItem label="主要合同">
              <Switch v-model:checked="editorRecord.mainContract" />
            </FormItem>
            <FormItem label="返点证集">
              <Switch v-model:checked="editorRecord.rebateEnabled" />
            </FormItem>
            <FormItem label="附件地址">
              <Input v-model:value="editorRecord.attachmentUrl" />
            </FormItem>
            <FormItem label="摘要">
              <Input.TextArea v-model:value="editorRecord.summary" :rows="3" />
            </FormItem>
          </template>

          <template v-else-if="editorType === 'extendInfo'">
            <FormItem label="重点供应商">
              <Switch v-model:checked="editorRecord.keySupplier" />
            </FormItem>
            <FormItem label="联盟补货">
              <Switch v-model:checked="editorRecord.allianceReplenishment" />
            </FormItem>
            <FormItem label="浮动率">
              <Input
                v-model:value="editorRecord.priceMarkupRate"
                addon-after="%"
                class="w-full"
                inputmode="decimal"
              />
            </FormItem>
            <FormItem label="采购退货联系人">
              <Input v-model:value="editorRecord.purchaseReturnContact" />
            </FormItem>
            <FormItem label="采购退货电话">
              <Input v-model:value="editorRecord.purchaseReturnPhone" />
            </FormItem>
            <FormItem label="采购退货地址">
              <Input v-model:value="editorRecord.purchaseReturnAddress" />
            </FormItem>
            <FormItem label="结账日期">
              <Input
                v-model:value="editorRecord.settleDay"
                class="w-full"
                inputmode="decimal"
              />
            </FormItem>
            <FormItem label="产生入仓单">
              <Switch v-model:checked="editorRecord.generateInBill" />
            </FormItem>
            <FormItem label="入库方式">
              <Input v-model:value="editorRecord.inboundMethod" />
            </FormItem>
            <FormItem label="贴码任务">
              <Switch v-model:checked="editorRecord.generateLabelTask" />
            </FormItem>
            <FormItem label="自动补货">
              <Switch v-model:checked="editorRecord.autoReplenishmentEnabled" />
            </FormItem>
            <FormItem label="补货公式">
              <Input v-model:value="editorRecord.autoReplenishmentFormula" />
            </FormItem>
            <FormItem label="补货周期">
              <Input v-model:value="editorRecord.autoReplenishmentCycle" />
            </FormItem>
            <FormItem label="补货时间">
              <TimePicker
                v-model:value="editorRecord.autoReplenishmentTime"
                value-format="HH:mm:ss"
                class="w-full"
              />
            </FormItem>
            <FormItem label="下次订货">
              <DatePicker
                v-model:value="editorRecord.nextOrderDate"
                value-format="YYYY-MM-DD"
                class="w-full"
              />
            </FormItem>
            <FormItem label="上限天数">
              <Input
                v-model:value="editorRecord.stockUpperDays"
                class="w-full"
                inputmode="decimal"
              />
            </FormItem>
            <FormItem label="标准天数">
              <Input
                v-model:value="editorRecord.stockStandardDays"
                class="w-full"
                inputmode="decimal"
              />
            </FormItem>
            <FormItem label="下限天数">
              <Input
                v-model:value="editorRecord.stockLowerDays"
                class="w-full"
                inputmode="decimal"
              />
            </FormItem>
          </template>

          <template v-else-if="editorType === 'extend'">
            <FormItem label="字段标识" required>
              <Input v-model:value="editorRecord.extendKey" />
            </FormItem>
            <FormItem label="字段名称">
              <Input v-model:value="editorRecord.extendName" />
            </FormItem>
            <FormItem label="字段类型">
              <Input v-model:value="editorRecord.extendType" />
            </FormItem>
            <FormItem label="选项值">
              <Input v-model:value="editorRecord.optionValues" />
            </FormItem>
            <FormItem label="必填">
              <Switch v-model:checked="editorRecord.required" />
            </FormItem>
            <FormItem label="排序">
              <Input
                v-model:value="editorRecord.sort"
                class="w-full"
                inputmode="decimal"
              />
            </FormItem>
            <FormItem label="字段值">
              <Input.TextArea
                v-model:value="editorRecord.extendValue"
                :rows="3"
              />
            </FormItem>
          </template>

          <template v-else-if="editorType === 'image'">
            <FormItem label="图片类型" required>
              <Select
                v-model:value="editorRecord.imageType"
                :options="imageTypeOptions"
                class="w-full"
              />
            </FormItem>
            <FormItem label="图片名称">
              <Input v-model:value="editorRecord.imageName" />
            </FormItem>
            <FormItem label="图片地址" required>
              <ImageUpload
                v-model:value="editorRecord.imageUrl"
                :max-number="1"
                :show-description="false"
              />
            </FormItem>
            <FormItem label="默认图">
              <Switch v-model:checked="editorRecord.defaulted" />
            </FormItem>
            <FormItem label="排序">
              <Input
                v-model:value="editorRecord.sort"
                class="w-full"
                inputmode="decimal"
              />
            </FormItem>
          </template>

          <template v-else-if="editorType === 'account'">
            <FormItem label="账户名" required>
              <Input v-model:value="editorRecord.accountName" />
            </FormItem>
            <FormItem label="卡号" required>
              <Input v-model:value="editorRecord.cardNo" />
            </FormItem>
            <FormItem label="开户行">
              <Input v-model:value="editorRecord.bankName" />
            </FormItem>
            <FormItem label="默认账户">
              <Switch v-model:checked="editorRecord.defaulted" />
            </FormItem>
            <FormItem label="排序">
              <Input
                v-model:value="editorRecord.sort"
                class="w-full"
                inputmode="decimal"
              />
            </FormItem>
          </template>

          <template v-else-if="editorType === 'bill'">
            <FormItem label="日期" required>
              <DatePicker
                v-model:value="editorRecord.billDate"
                value-format="YYYY-MM-DD"
                class="w-full"
              />
            </FormItem>
            <FormItem label="票据号" required>
              <Input v-model:value="editorRecord.billNo" />
            </FormItem>
            <FormItem label="金额" required>
              <Input
                v-model:value="editorRecord.amount"
                @blur="formatEditorAmount('amount')"
                class="w-full"
                inputmode="decimal"
              />
            </FormItem>
          </template>

          <template v-else-if="editorType === 'task'">
            <FormItem label="年份" required>
              <Input
                v-model:value="editorRecord.year"
                class="w-full"
                inputmode="decimal"
              />
            </FormItem>
            <FormItem label="月份" required>
              <Input
                v-model:value="editorRecord.month"
                class="w-full"
                inputmode="decimal"
              />
            </FormItem>
            <FormItem label="级别">
              <Input v-model:value="editorRecord.taskLevel" />
            </FormItem>
            <FormItem label="任务量" required>
              <Input
                v-model:value="editorRecord.taskAmount"
                class="w-full"
                inputmode="decimal"
              />
            </FormItem>
          </template>

          <template v-else>
            <FormItem label="企业名称">
              <Input v-model:value="editorRecord.companyName" />
            </FormItem>
            <FormItem label="信用代码">
              <Input v-model:value="editorRecord.creditCode" />
            </FormItem>
            <FormItem label="法人">
              <Input v-model:value="editorRecord.legalPerson" />
            </FormItem>
            <FormItem label="注册地址">
              <Input v-model:value="editorRecord.registeredAddress" />
            </FormItem>
            <FormItem label="注册资本">
              <Input v-model:value="editorRecord.registeredCapital" />
            </FormItem>
            <FormItem label="成立日期">
              <Input v-model:value="editorRecord.establishDate" />
            </FormItem>
            <FormItem label="经营状态">
              <Input v-model:value="editorRecord.businessStatus" />
            </FormItem>
            <FormItem label="经营范围">
              <Input.TextArea
                v-model:value="editorRecord.businessScope"
                :rows="3"
              />
            </FormItem>
          </template>

          <FormItem label="备注">
            <Input.TextArea v-model:value="editorRecord.remark" :rows="3" />
          </FormItem>
        </AForm>
      </div>
    </AModal>
  </Modal>
</template>

<style scoped>
.supplier-detail-tabs {
  font-size: 12px;
}

.supplier-detail-tabs :deep(.ant-tabs-nav) {
  padding: 0 12px;
  margin: 0;
  background: hsl(var(--card));
}

.supplier-detail-tabs :deep(.ant-tabs-tab) {
  padding: 10px 0;
  font-size: 12px;
}

.supplier-detail-tabs :deep(.ant-tabs-content-holder) {
  background: hsl(var(--muted) / 28%);
}

.supplier-detail-tabs :deep(.ant-tabs-tabpane) {
  padding: 12px;
}

.supplier-detail-tabs :deep(.ant-table),
.supplier-detail-tabs :deep(.ant-table-cell),
.supplier-detail-tabs :deep(.ant-btn),
.supplier-detail-tabs :deep(.ant-tag),
.supplier-detail-tabs :deep(.ant-empty-description),
.supplier-detail-tabs :deep(.ant-form-item-label > label),
.supplier-detail-tabs :deep(.ant-form-item-control-input),
.supplier-detail-tabs :deep(.ant-input),
.supplier-detail-tabs :deep(.ant-input-number-input),
.supplier-detail-tabs :deep(.ant-select-selection-item),
.supplier-detail-tabs :deep(.ant-select-selection-placeholder),
.supplier-detail-tabs :deep(.ant-tree-select) {
  font-size: 12px;
}

.supplier-detail-tabs :deep(.ant-table-small .ant-table-thead > tr > th),
.supplier-detail-tabs :deep(.ant-table-small .ant-table-tbody > tr > td) {
  padding: 6px 8px;
  font-size: 12px;
  line-height: 20px;
}

.supplier-detail-tabs :deep(.ant-btn-sm),
.supplier-detail-tabs :deep(.ant-btn-link) {
  height: 26px;
  padding: 1px 5px;
  font-size: 12px;
  line-height: 22px;
}

.supplier-detail-tabs :deep(.ant-tag) {
  line-height: 18px;
}

.supplier-detail-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.supplier-edit-form :deep(.supplier-form-grid) {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0 12px;
  padding: 10px 12px 12px;
}

.supplier-edit-form :deep(.supplier-form-grid > div) {
  min-width: 0;
}

.supplier-edit-form :deep(.supplier-form-grid > div > label) {
  margin-right: 0;
  padding-right: 10px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  white-space: nowrap;
}

.supplier-edit-form :deep(.supplier-form-grid > div > .flex-auto) {
  min-width: 0;
}

.supplier-edit-form :deep(.ant-input),
.supplier-edit-form :deep(.ant-input-affix-wrapper),
.supplier-edit-form :deep(.ant-picker),
.supplier-edit-form :deep(.ant-select-selector),
.supplier-edit-form :deep(.ant-tree-select .ant-select-selector) {
  min-height: 32px;
  border-radius: 6px !important;
  font-size: 12px;
}

.supplier-edit-form :deep(.ant-input),
.supplier-edit-form :deep(.ant-picker-input > input),
.supplier-edit-form :deep(.ant-select-selection-item),
.supplier-edit-form :deep(.ant-select-selection-placeholder),
.supplier-edit-form :deep(.ant-radio-wrapper),
.supplier-edit-form :deep(.ant-checkbox-wrapper) {
  font-size: 12px;
}

.supplier-edit-form :deep(.ant-input:not(textarea)),
.supplier-edit-form :deep(.ant-picker) {
  height: 32px;
}

.supplier-edit-form :deep(.ant-select-single) {
  height: 32px;
}

.supplier-edit-form :deep(.supplier-dept-multiple-select.ant-select-multiple),
.supplier-edit-form
  :deep(
    .supplier-dept-multiple-select.ant-select-multiple .ant-select-selector
  ) {
  height: 32px;
  min-height: 32px;
}

.supplier-edit-form :deep(.supplier-dept-multiple-select .ant-select-selector) {
  overflow: hidden;
}

.supplier-edit-form
  :deep(.supplier-dept-multiple-select .ant-select-selection-overflow) {
  flex-wrap: nowrap;
  min-width: 0;
  overflow: hidden;
}

.supplier-edit-form
  :deep(.supplier-dept-multiple-select .ant-select-selection-overflow-item) {
  min-width: 0;
}

.supplier-edit-form
  :deep(.supplier-dept-multiple-select .ant-select-selection-item) {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.supplier-edit-form
  :deep(.supplier-dept-multiple-select .supplier-dept-overflow-placeholder) {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: help;
}

.supplier-edit-form :deep(.ant-input[disabled]),
.supplier-edit-form :deep(.ant-input-affix-wrapper-disabled),
.supplier-edit-form :deep(.ant-picker-disabled),
.supplier-edit-form :deep(.ant-select-disabled .ant-select-selector) {
  color: hsl(var(--muted-foreground)) !important;
  background: hsl(var(--muted) / 48%) !important;
}

:global(.supplier-form-select-dropdown .ant-select-item),
:global(.supplier-form-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

.supplier-detail-section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.supplier-detail-section__header {
  display: flex;
  min-height: 40px;
  align-items: center;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.supplier-detail-section__title {
  position: relative;
  padding-left: 10px;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
}

.supplier-detail-section__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  background: hsl(var(--primary));
  border-radius: 3px;
  content: '';
}

.supplier-detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px 12px;
  padding: 12px;
}

.supplier-detail-field {
  display: grid;
  min-width: 0;
  grid-template-columns: 88px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 30px;
}

.supplier-detail-field.is-wide {
  grid-column: 1 / -1;
}

.supplier-detail-field > span {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.supplier-detail-field > strong {
  min-width: 0;
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.supplier-detail-audit {
  margin: 12px;
}

.detail-cell {
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  padding: 10px 12px;
}

.detail-cell span {
  color: hsl(var(--muted-foreground));
  display: block;
  font-size: 12px;
  line-height: 18px;
}

.detail-cell strong {
  display: block;
  font-size: 12px;
  font-weight: 500;
  line-height: 24px;
  min-height: 24px;
  word-break: break-all;
}

.supplier-extend-layout {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.supplier-extend-toolbar {
  position: relative;
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  overflow: hidden;
  padding: 9px 12px 9px 15px;
  background: linear-gradient(
    90deg,
    hsl(var(--primary) / 8%),
    hsl(var(--card)) 42%
  );
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.supplier-extend-toolbar::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3px;
  background: hsl(var(--primary));
  content: '';
}

.supplier-extend-toolbar__title {
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.supplier-extend-toolbar__description,
.supplier-extend-section__description {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 18px;
}

.supplier-extend-toolbar :deep(.ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
}

.supplier-extend-section {
  overflow: hidden;
  background: hsl(var(--border));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.supplier-extend-section__header {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.supplier-extend-section__title {
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.supplier-extend-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  background: hsl(var(--border));
}

.supplier-extend-field {
  display: flex;
  min-width: 0;
  min-height: 58px;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 8px 12px;
  background: hsl(var(--card));
}

.supplier-extend-field.is-wide {
  grid-column: span 2;
}

.supplier-extend-field > span {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.supplier-extend-field > strong {
  min-width: 0;
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 12px;
  font-weight: 500;
  line-height: 22px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.supplier-extend-field.is-wide > strong {
  overflow: visible;
  word-break: break-all;
  white-space: normal;
}

.supplier-extend-state {
  display: inline-flex;
  max-width: 100%;
  height: 22px;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
  background: hsl(var(--muted) / 44%);
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
}

.supplier-extend-state i {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  background: hsl(var(--muted-foreground) / 55%);
  border-radius: 50%;
}

.supplier-extend-state.is-active {
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary) / 24%);
}

.supplier-extend-state.is-active i {
  background: hsl(var(--primary));
  box-shadow: 0 0 0 2px hsl(var(--primary) / 12%);
}

.supplier-images-toolbar {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 14px 16px;
  margin-bottom: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--card));
}

.supplier-images-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 24px;
}

.supplier-images-subtitle {
  margin-top: 2px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 20px;
}

.supplier-images-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-start;
  justify-content: flex-end;
}

.supplier-images-type {
  width: 150px;
}

.supplier-image-group-title {
  font-size: 12px;
  font-weight: 600;
  line-height: 22px;
}

.supplier-images-actions :deep(.ant-upload-wrapper) {
  width: auto;
}

.supplier-images-actions :deep(.ant-upload-select-picture-card) {
  width: 88px;
  height: 88px;
  margin: 0;
}

@media (max-width: 768px) {
  .supplier-edit-form :deep(.supplier-form-grid) {
    grid-template-columns: minmax(0, 1fr);
  }

  .supplier-detail-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .supplier-extend-toolbar {
    align-items: flex-start;
  }

  .supplier-extend-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .supplier-extend-field.is-wide {
    grid-column: auto;
  }

  .supplier-images-toolbar {
    flex-direction: column;
  }

  .supplier-images-actions {
    justify-content: flex-start;
    width: 100%;
  }

  .supplier-images-type {
    width: 100%;
  }
}

@media (min-width: 769px) and (max-width: 1279px) {
  .supplier-edit-form :deep(.supplier-form-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .supplier-detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .supplier-extend-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
