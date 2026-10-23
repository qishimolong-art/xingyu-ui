<script lang="ts" setup>
import type { UploadFile, UploadProps } from 'ant-design-vue';

import type {
  CustomerBaseDataQuickCreatePayload,
  CustomerFormSchemaOptions,
} from '../data';
import type { CustomerDeptLabelValue } from '../utils/form-normalize';

import type { ErpBaseDataApi } from '#/api/erp/base';
import type { ErpCustomerApi } from '#/api/erp/sale/customer';

import { computed, nextTick, ref, onBeforeUnmount } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Alert, Button, message, Upload } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createCustomer,
  createCustomerBusinessInfo,
  createCustomerImage,
  getCustomer,
  recognizeCustomerBusinessLicense,
  updateCustomer,
} from '#/api/erp/sale/customer';
import { getAreaTree } from '#/api/system/area';
import { useUpload } from '#/components/upload/use-upload';
import { loadCustomerFieldVisibility } from '../utils/field-visibility';
import { useCustomerFormKeyboard } from '../utils/form-keyboard';
import '#/views/erp/styles/form-focus.css';
import { $t } from '#/locales';
import BaseDataForm from '#/views/erp/base/modules/form.vue';
import { applyEffectiveFieldVisibility } from '#/views/erp/composables/useFieldConfig';
import {
  formatOptionalNumberInput,
  normalizeOptionalNumberFields,
} from '#/views/erp/sale/utils/text-number';

import {
  useBasicFormSchema,
  useFinanceFormSchema,
  useInvoiceFormSchema,
  useSaleFormSchema,
  useSystemFormSchema,
} from '../data';
import { confirmBusinessLicenseNameMismatch } from '../utils/business-license-confirm';
import {
  buildCustomerDeptEditValues,
  normalizeCustomerDeptFields,
} from '../utils/form-normalize';
import {
  buildCustomerPinyinCode,
  buildCustomerWubiCode,
} from '../utils/name-code';
import {
  buildCustomerBusinessInfoFromOcr,
  CUSTOMER_BUSINESS_LICENSE_ACCEPT_EXTS,
  CUSTOMER_BUSINESS_LICENSE_IMAGE_TYPE,
  CUSTOMER_BUSINESS_LICENSE_MAX_SIZE,
  CUSTOMER_BUSINESS_LICENSE_UPLOAD_DIRECTORY,
  hasCustomerBusinessLicenseText,
  readCustomerBusinessLicenseFileAsDataUrl,
  resolveCustomerBusinessLicenseUploadedFileUrl,
  toCustomerBusinessLicenseBase64Payload,
} from '../utils/business-license';
import {
  buildBusinessLicenseAddressFill,
  getBusinessLicenseAddress,
  getBusinessLicenseCustomerName,
  getBusinessLicenseNameMismatch,
} from '../utils/business-license-ocr';

type CustomerFormValues = Omit<
  ErpCustomerApi.Customer,
  'creditLimit' | 'creditTermDays' | 'deptIds' | 'minOrderAmount'
> & {
  minOrderAmount?: number | string | undefined;
  creditLimit?: number | string | undefined;
  creditTermDays?: number | string | undefined;
  deptIds?: Array<CustomerDeptLabelValue | number>;
};
type CustomerFormSuccessPayload =
  | number
  | {
      activeTab?: 'business' | 'images';
      id?: number;
    };

const emit = defineEmits<{
  success: [payload?: CustomerFormSuccessPayload];
}>();
const FIELD_CONFIG_MODULE = 'customer';
const FIELD_PERMISSION_MODULE = 'erp_customer';
const FINANCE_FIELD_NAMES = new Set([
  'accountName',
  'settleMethod',
  'settleLocked',
  'invoiceType',
  'minOrderAmount',
  'freightType',
  'commissionRate',
  'commissionEnabled',
  'creditLimit',
]);
const INVOICE_FIELD_NAMES = new Set([
  'unifiedCreditCode',
  'taxNo',
  'bankName',
  'bankAccount',
  'bankAddress',
  'invoiceBankName',
  'invoiceBankAccount',
  'invoiceAddress',
  'invoiceTelephone',
  'invoiceCompany',
]);
const SALE_FIELD_NAMES = new Set([
  'saleUserId',
  'developerUserId',
  'priceLevel',
  'priceLocked',
  'logistics',
  'transportMethod',
  'routeId',
  'freightExplainId',
]);
const SYSTEM_FIELD_NAMES = new Set([
  'wubiCode',
  'pinyinCode',
  'memberCode',
  'platformCode',
  'status',
  'remark',
]);
const BUSINESS_LICENSE_FILL_FIELDS = [
  ['unifiedCreditCode', 'unifiedCreditCode'],
  ['taxNo', 'taxNo'],
  ['invoiceCompany', 'invoiceCompany'],
  ['invoiceAddress', 'invoiceAddress'],
] as const;
const formData = ref<ErpCustomerApi.Customer>();
const isEditMode = ref(false);
const pinyinCodeTouched = ref(false);
const wubiCodeTouched = ref(false);
const suppressSystemCodeTouch = ref(false);
const quickCreateContext = ref<CustomerBaseDataQuickCreatePayload>();
const businessLicenseFile = ref<File>();
const businessLicenseFileList = ref<UploadFile[]>([]);
const businessLicenseOcrResult = ref<ErpCustomerApi.BusinessLicenseOcrResp>();
const businessLicenseSaveBlocked = ref(false);
const businessLicenseRecognizing = ref(false);
const businessLicenseAreaId = ref<number>();
const businessLicenseAddressText = ref<string>();
const businessLicenseUploader = useUpload(
  CUSTOMER_BUSINESS_LICENSE_UPLOAD_DIRECTORY,
);
const fieldConfigHiddenFields = ref<string[]>([]);
const hiddenFields = ref<string[]>([]);
const fieldConfigSnapshot = ref<any[]>([]);
const dataReady = ref(false);
const loadError = ref('');
const submitting = ref(false);
const selectedOptions = ref<Record<string, any[]>>({});
let loadSequence = 0;
let recognitionSequence = 0;
let quickCreateFocus: HTMLElement | undefined;
const { beginOpen, endOpen, formScope, handleFormEnter, onOpened, queueFocus } =
  useCustomerFormKeyboard(
    () => true,
    () => dataReady.value && !loadError.value && !submitting.value,
  );
function setFormScope(element: unknown) {
  formScope.value = element instanceof HTMLElement ? element : undefined;
}
async function restoreQuickCreateFocus() {
  await nextTick();
  if (dataReady.value && quickCreateFocus?.isConnected)
    quickCreateFocus.focus({ preventScroll: true });
}
onBeforeUnmount(() => {
  loadSequence += 1;
  recognitionSequence += 1;
});
const { hasAccessByCodes } = useAccess();
const getTitle = computed(() => {
  return isEditMode.value
    ? $t('ui.actionTitle.edit', ['客户'])
    : $t('ui.actionTitle.create', ['客户']);
});

function buildCustomerFormValues(
  data?: Partial<ErpCustomerApi.Customer>,
): CustomerFormValues | undefined {
  if (!data) {
    return undefined;
  }
  return {
    ...data,
    ...buildCustomerDeptEditValues(data),
    minOrderAmount:
      data.minOrderAmount === undefined || data.minOrderAmount === null
        ? undefined
        : Number(data.minOrderAmount).toFixed(2),
    creditLimit:
      data.creditLimit === undefined || data.creditLimit === null
        ? undefined
        : Number(data.creditLimit).toFixed(2),
    creditTermDays: formatOptionalNumberInput(data.creditTermDays),
  } as CustomerFormValues;
}

function normalizeCustomerPayload(data: CustomerFormValues) {
  const payload = { ...data } as CustomerFormValues & Record<string, any>;
  if (typeof payload.code === 'string') {
    const code = payload.code.trim();
    payload.code = code || undefined;
  }
  delete payload.manualInputCode;
  normalizeOptionalNumberFields(payload as any, [
    'minOrderAmount',
    'creditLimit',
    'creditTermDays',
    'commissionRate',
  ]);
  if (!payload.creditEnabled) {
    payload.creditEnabled = false;
    payload.creditLimit = undefined;
    payload.creditTermDays = undefined;
  }
  if (
    !hasTextValue(payload.address) &&
    businessLicenseAreaId.value !== undefined &&
    String(payload.addressAreaId) === String(businessLicenseAreaId.value) &&
    hasTextValue(businessLicenseAddressText.value)
  ) {
    payload.address = businessLicenseAddressText.value;
  }
  return normalizeCustomerDeptFields(payload as ErpCustomerApi.Customer);
}

function hasOptionalValue(value: unknown) {
  return value !== undefined && value !== null && value !== '';
}

function hasTextValue(value: unknown) {
  return (
    value !== undefined &&
    value !== null &&
    !(typeof value === 'string' && value.trim() === '')
  );
}

async function buildCustomerSchema(
  schema: ReturnType<typeof useBasicFormSchema>,
) {
  return applyEffectiveFieldVisibility(schema, {
    moduleKey: FIELD_CONFIG_MODULE,
    config: fieldConfigSnapshot.value,
    fieldConfigHiddenFields: fieldConfigHiddenFields.value,
    roleHiddenFields: hiddenFields.value,
  });
}

async function loadFieldVisibility() {
  const current = loadSequence;
  const snapshot = await loadCustomerFieldVisibility(
    FIELD_CONFIG_MODULE,
    FIELD_PERMISSION_MODULE,
  );
  if (current !== loadSequence) return;
  hiddenFields.value = snapshot.hiddenFields;
  fieldConfigSnapshot.value = snapshot.config;
  fieldConfigHiddenFields.value = snapshot.configHiddenFields;
}

const formConfig = {
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    labelClass: '!justify-start !text-left',
    labelWidth: 88,
  },
  compact: true,
  wrapperClass: 'customer-form-grid grid-cols-4',
  layout: 'horizontal' as const,
  showDefaultActions: false,
};

function getCustomerSchemaOptions(): CustomerFormSchemaOptions {
  return {
    selectedOptions: selectedOptions.value,
    canCreateBaseData: hasAccessByCodes(['erp:base-data:create']),
    onCreateBaseData: handleCreateBaseData,
  };
}

function getCustomerFormApiByField(fieldName: string) {
  if (FINANCE_FIELD_NAMES.has(fieldName)) {
    return financeFormApi;
  }
  if (INVOICE_FIELD_NAMES.has(fieldName)) {
    return invoiceFormApi;
  }
  if (SALE_FIELD_NAMES.has(fieldName)) {
    return saleFormApi;
  }
  if (SYSTEM_FIELD_NAMES.has(fieldName)) {
    return systemFormApi;
  }
  return basicFormApi;
}

function handleCreateBaseData(payload: CustomerBaseDataQuickCreatePayload) {
  quickCreateFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
  quickCreateFocus?.blur();
  quickCreateContext.value = payload;
  baseDataModalApi
    .setData({
      type: payload.type,
      title: payload.title,
      codeRequired: payload.valueMode === 'code-map',
    })
    .open();
}

async function handleBaseDataCreated(record?: ErpBaseDataApi.BaseData) {
  const context = quickCreateContext.value;
  if (!context) {
    return;
  }

  const targetFormApi = getCustomerFormApiByField(context.fieldName);
  targetFormApi
    .getFieldComponentRef<{ reloadOptions?: () => void }>(context.fieldName)
    ?.reloadOptions?.();

  const chosen =
    context.valueMode === 'id'
      ? record?.id
      : record?.code && context.valueMap
        ? context.valueMap[record.code]
        : undefined;
  if (chosen !== undefined) {
    selectedOptions.value[context.fieldName] = [
      { ...record, id: chosen, value: chosen, label: record?.name },
    ];
    await targetFormApi.updateSchema([
      {
        fieldName: context.fieldName,
        componentProps: { options: selectedOptions.value[context.fieldName] },
      },
    ]);
  }
  if (context.valueMode === 'id') {
    if (record?.id !== undefined && record.id !== null) {
      await targetFormApi.setFieldValue(context.fieldName, record.id);
    }
    quickCreateContext.value = undefined;
    return;
  }

  const mappedValue =
    record?.code && context.valueMap
      ? context.valueMap[record.code]
      : undefined;
  if (mappedValue !== undefined) {
    await targetFormApi.setFieldValue(context.fieldName, mappedValue);
  } else {
    message.warning(
      '新增成功，但编码未匹配当前客户字段，请维护正确编码后再选择',
    );
  }
  quickCreateContext.value = undefined;
}

async function syncNameCodes(name?: string) {
  const pinyinCode = buildCustomerPinyinCode(name);
  const wubiCode = buildCustomerWubiCode(name);
  if (!pinyinCode && !wubiCode) {
    return;
  }
  suppressSystemCodeTouch.value = true;
  try {
    if (pinyinCode && !pinyinCodeTouched.value) {
      await systemFormApi.setFieldValue('pinyinCode', pinyinCode);
    }
    if (wubiCode && !wubiCodeTouched.value) {
      await systemFormApi.setFieldValue('wubiCode', wubiCode);
    }
  } finally {
    suppressSystemCodeTouch.value = false;
  }
}

function clearBusinessLicenseAddressFill() {
  businessLicenseAreaId.value = undefined;
  businessLicenseAddressText.value = undefined;
}

const beforeBusinessLicenseUpload: UploadProps['beforeUpload'] = (file) => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const isUnsupportedExtension =
    !extension || !CUSTOMER_BUSINESS_LICENSE_ACCEPT_EXTS.has(extension);
  if (isUnsupportedExtension) {
    message.error('营业执照仅支持 jpg、jpeg、png 格式');
    return Upload.LIST_IGNORE;
  }
  if (file.size > CUSTOMER_BUSINESS_LICENSE_MAX_SIZE) {
    message.error('营业执照图片不能超过 10MB');
    return Upload.LIST_IGNORE;
  }
  recognitionSequence += 1;
  businessLicenseRecognizing.value = false;
  businessLicenseFile.value = file as File;
  businessLicenseSaveBlocked.value = false;
  businessLicenseFileList.value = [file as unknown as UploadFile];
  businessLicenseOcrResult.value = undefined;
  clearBusinessLicenseAddressFill();
  return false;
};

function handleBusinessLicenseRemove() {
  recognitionSequence += 1;
  businessLicenseRecognizing.value = false;
  businessLicenseSaveBlocked.value = false;
  businessLicenseFile.value = undefined;
  businessLicenseFileList.value = [];
  businessLicenseOcrResult.value = undefined;
  clearBusinessLicenseAddressFill();
  return true;
}

function handleBusinessLicensePreview(file: UploadFile) {
  const source = file.url || file.thumbUrl;
  if (source) {
    window.open(source, '_blank', 'noopener,noreferrer');
    return;
  }
  const originFile = file.originFileObj;
  if (!originFile) return;
  const previewUrl = URL.createObjectURL(originFile as Blob);
  window.open(previewUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
}

function resetBusinessLicenseOcrState() {
  businessLicenseSaveBlocked.value = false;
  businessLicenseFile.value = undefined;
  businessLicenseFileList.value = [];
  businessLicenseOcrResult.value = undefined;
  clearBusinessLicenseAddressFill();
  businessLicenseRecognizing.value = false;
}

function getBusinessLicenseImageName(file: File) {
  return file.name || CUSTOMER_BUSINESS_LICENSE_IMAGE_TYPE;
}

async function saveBusinessLicenseImage(customerId: number, file: File) {
  const uploadResponse = await businessLicenseUploader.httpRequest(file);
  const imageUrl =
    resolveCustomerBusinessLicenseUploadedFileUrl(uploadResponse);
  if (hasCustomerBusinessLicenseText(imageUrl)) {
    await createCustomerImage({
      customerId,
      imageType: CUSTOMER_BUSINESS_LICENSE_IMAGE_TYPE,
      imageName: getBusinessLicenseImageName(file),
      imageUrl,
      sort: 0,
    });
    return;
  }
  throw new Error('Business license image upload response has no url');
}

async function saveBusinessLicenseOcrArtifacts(customerId?: number) {
  if (!customerId || isEditMode.value || businessLicenseSaveBlocked.value) {
    return;
  }

  const tasks: Array<Promise<void>> = [];
  const selectedFile = businessLicenseFile.value;
  if (selectedFile) {
    tasks.push(saveBusinessLicenseImage(customerId, selectedFile));
  }

  const businessInfo = buildCustomerBusinessInfoFromOcr(
    customerId,
    businessLicenseOcrResult.value,
  );
  if (businessInfo) {
    tasks.push(createCustomerBusinessInfo(businessInfo).then(() => undefined));
  }

  if (tasks.length === 0) {
    return;
  }

  try {
    await Promise.all(tasks);
  } catch (error) {
    console.error('Failed to save business license artifacts', error);
    message.warning(
      '客户已保存，但营业执照图片或工商识别信息留存失败，可在客户详情中补充',
    );
  }
}

function getBusinessLicenseSuccessPayload(
  id?: number,
): CustomerFormSuccessPayload | undefined {
  if (!id) {
    return undefined;
  }
  if (businessLicenseSaveBlocked.value) return id;
  if (businessLicenseOcrResult.value) {
    return { id, activeTab: 'business' };
  }
  if (businessLicenseFile.value) {
    return { id, activeTab: 'images' };
  }
  return id;
}

async function fillFieldsFromBusinessLicense(
  result: ErpCustomerApi.BusinessLicenseOcrResp,
) {
  const current = loadSequence;
  const recognition = recognitionSequence;
  const [basicValues, invoiceValues] = await Promise.all([
    basicFormApi.getValues(),
    invoiceFormApi.getValues(),
  ]);
  const basicFillValues: Record<string, number | string> = {};
  const invoiceFillValues: Record<string, string> = {};
  let skippedCount = 0;

  const customerName = getBusinessLicenseCustomerName(result);
  if (hasTextValue(customerName)) {
    if (hasTextValue(basicValues.name)) {
      skippedCount += 1;
    } else {
      basicFillValues.name = customerName!;
    }
  }

  const addressFill = await buildBusinessLicenseAddressFill(
    getBusinessLicenseAddress(result),
    basicValues,
    getAreaTree,
  );
  if (current !== loadSequence || recognition !== recognitionSequence) return;
  Object.assign(basicFillValues, addressFill.values);
  skippedCount += addressFill.skippedCount;
  const { unmatchedAddress } = addressFill;
  if (addressFill.area) {
    businessLicenseAreaId.value = addressFill.area.areaId;
    businessLicenseAddressText.value = addressFill.area.areaText;
  }

  for (const [targetField, resultField] of BUSINESS_LICENSE_FILL_FIELDS) {
    const value = result[resultField];
    if (!hasTextValue(value)) {
      continue;
    }
    if (hasTextValue(invoiceValues[targetField])) {
      skippedCount += 1;
      continue;
    }
    invoiceFillValues[targetField] = String(value).trim();
  }

  const filledCount =
    Object.keys(basicFillValues).length + Object.keys(invoiceFillValues).length;
  if (filledCount > 0) {
    if (Object.keys(basicFillValues).length > 0) {
      await basicFormApi.setValues(basicFillValues);
      if (hasTextValue(basicFillValues.name)) {
        await syncNameCodes(String(basicFillValues.name));
      }
    }
    if (current !== loadSequence || recognition !== recognitionSequence) return;
    if (Object.keys(invoiceFillValues).length > 0) {
      await invoiceFormApi.setValues(invoiceFillValues);
    }
    const suffix = [
      skippedCount > 0 ? `保留 ${skippedCount} 项已填写内容` : '',
      unmatchedAddress ? '地址未匹配到省市县，请手动选择' : '',
    ]
      .filter(Boolean)
      .join('，');
    message.success(
      `营业执照识别完成，已填充 ${filledCount} 项${suffix ? `，${suffix}` : ''}`,
    );
    return;
  }

  message.info(
    [
      '营业执照识别完成',
      skippedCount > 0 ? '已填写字段保持不变' : '未匹配到可填充字段',
      unmatchedAddress ? '地址未匹配到省市县，请手动选择' : '',
    ]
      .filter(Boolean)
      .join('，'),
  );
}

async function handleRecognizeBusinessLicense() {
  if (businessLicenseRecognizing.value) return;
  if (!businessLicenseFile.value) {
    message.warning('请先上传营业执照图片');
    return;
  }
  const recognition = ++recognitionSequence;
  const current = loadSequence;
  businessLicenseRecognizing.value = true;
  const selectedFile = businessLicenseFile.value;
  businessLicenseOcrResult.value = undefined;
  clearBusinessLicenseAddressFill();
  try {
    const image = toCustomerBusinessLicenseBase64Payload(
      await readCustomerBusinessLicenseFileAsDataUrl(businessLicenseFile.value),
    );
    const result = await recognizeCustomerBusinessLicense({ image });
    if (
      recognition !== recognitionSequence ||
      current !== loadSequence ||
      selectedFile !== businessLicenseFile.value
    )
      return;
    if (result?.success === false) {
      message.error(result.message || '营业执照识别失败，请手动填写');
      return;
    }
    const basicValues = await basicFormApi.getValues();
    const nameMismatch = getBusinessLicenseNameMismatch(
      basicValues.name,
      result,
    );
    if (nameMismatch) businessLicenseSaveBlocked.value = true;
    const confirmed = await confirmBusinessLicenseNameMismatch(
      nameMismatch,
      '继续填充',
    );
    if (
      !confirmed ||
      recognition !== recognitionSequence ||
      current !== loadSequence ||
      selectedFile !== businessLicenseFile.value
    )
      return;
    businessLicenseSaveBlocked.value = false;
    businessLicenseOcrResult.value = result;
    await fillFieldsFromBusinessLicense(result);
  } catch (error) {
    if (current !== loadSequence || recognition !== recognitionSequence) return;
    console.error('Failed to recognize business license', error);
    message.error('营业执照识别失败，请稍后重试或手动填写');
  } finally {
    if (recognition === recognitionSequence && current === loadSequence)
      businessLicenseRecognizing.value = false;
  }
}

const [BasicForm, basicFormApi] = useVbenForm({
  ...formConfig,
  schema: useBasicFormSchema(getCustomerSchemaOptions()),
  handleValuesChange(values, changedFields) {
    if (changedFields.includes('manualInputCode') && !values.id) {
      basicFormApi.setFieldValue(
        'code',
        values.manualInputCode ? '' : undefined,
      );
    }
    if (changedFields.includes('name')) {
      syncNameCodes(values.name);
    }
    if (
      changedFields.includes('addressAreaId') &&
      String(values.addressAreaId) !== String(businessLicenseAreaId.value)
    ) {
      clearBusinessLicenseAddressFill();
    }
  },
});

const [FinanceForm, financeFormApi] = useVbenForm({
  ...formConfig,
  schema: useFinanceFormSchema(getCustomerSchemaOptions()),
});

const [InvoiceForm, invoiceFormApi] = useVbenForm({
  ...formConfig,
  schema: useInvoiceFormSchema(getCustomerSchemaOptions()),
});

const [SaleForm, saleFormApi] = useVbenForm({
  ...formConfig,
  schema: useSaleFormSchema(getCustomerSchemaOptions()),
});

function isFocusedSystemCodeField(fieldName: 'pinyinCode' | 'wubiCode') {
  return systemFormApi.getFocusedField() === fieldName;
}

const [SystemForm, systemFormApi] = useVbenForm({
  ...formConfig,
  schema: useSystemFormSchema(getCustomerSchemaOptions()),
  handleValuesChange(_values, changedFields) {
    if (suppressSystemCodeTouch.value) {
      return;
    }
    if (
      changedFields.includes('pinyinCode') &&
      isFocusedSystemCodeField('pinyinCode')
    ) {
      pinyinCodeTouched.value = true;
    }
    if (
      changedFields.includes('wubiCode') &&
      isFocusedSystemCodeField('wubiCode')
    ) {
      wubiCodeTouched.value = true;
    }
  },
});

const formSections = [
  ['basic', basicFormApi],
  ['finance', financeFormApi],
  ['invoice', invoiceFormApi],
  ['sale', saleFormApi],
  ['system', systemFormApi],
] as const;

async function resetAllForms() {
  for (const [, api] of formSections) {
    await api.resetForm();
  }
}

async function setAllFormValues(data: Record<string, any>) {
  suppressSystemCodeTouch.value = true;
  try {
    for (const [, api] of formSections) {
      await api.setValues(data);
    }
  } finally {
    suppressSystemCodeTouch.value = false;
  }
}

async function applyConfiguredSchemas() {
  const schemaOptions = getCustomerSchemaOptions();
  const [basicSchema, financeSchema, invoiceSchema, saleSchema, systemSchema] =
    await Promise.all([
      buildCustomerSchema(useBasicFormSchema(schemaOptions)),
      buildCustomerSchema(useFinanceFormSchema(schemaOptions)),
      buildCustomerSchema(useInvoiceFormSchema(schemaOptions)),
      buildCustomerSchema(useSaleFormSchema(schemaOptions)),
      buildCustomerSchema(useSystemFormSchema(schemaOptions)),
    ]);
  basicFormApi.setState({ schema: basicSchema });
  financeFormApi.setState({ schema: financeSchema });
  invoiceFormApi.setState({ schema: invoiceSchema });
  saleFormApi.setState({ schema: saleSchema });
  systemFormApi.setState({ schema: systemSchema });
}

const [Modal, modalApi] = useVbenModal({
  destroyOnClose: true,
  onOpened,
  async onConfirm() {
    if (
      !dataReady.value ||
      loadError.value ||
      submitting.value ||
      businessLicenseRecognizing.value ||
      !hasAccessByCodes([
        isEditMode.value ? 'erp:customer:update' : 'erp:customer:create',
      ])
    )
      return;
    const current = loadSequence;
    submitting.value = true;
    try {
      for (const [, api] of formSections) {
        const { valid } = await api.validate();
        if (!valid || current !== loadSequence) {
          return;
        }
      }
      const mergedValues = Object.assign(
        {},
        ...(await Promise.all(formSections.map(([, api]) => api.getValues()))),
        formData.value?.id ? { id: formData.value.id } : undefined,
      ) as CustomerFormValues;
      if (current !== loadSequence) return;
      const data = normalizeCustomerPayload(mergedValues);
      if (
        data.creditEnabled &&
        !hasOptionalValue(data.creditLimit) &&
        !hasOptionalValue(data.creditTermDays)
      ) {
        message.warning('开启白条授信后，授信金额和授信期限至少填写一项');
        return;
      }
      modalApi.lock();
      try {
        const isUpdate = Boolean(formData.value?.id);
        const id = isUpdate ? data.id : await createCustomer(data);
        if (formData.value?.id) {
          await updateCustomer(data);
        }
        if (current !== loadSequence) {
          emit('success');
          return;
        }
        if (!isUpdate) {
          await saveBusinessLicenseOcrArtifacts(id);
        }
        if (current !== loadSequence) {
          emit('success');
          return;
        }
        const successPayload = getBusinessLicenseSuccessPayload(id);
        await modalApi.close();
        emit('success', successPayload);
        message.success($t('ui.actionMessage.operationSuccess'));
      } finally {
        if (current === loadSequence) modalApi.unlock();
      }
    } finally {
      if (current === loadSequence) submitting.value = false;
    }
  },
  async onOpenChange(isOpen: boolean) {
    const current = ++loadSequence;
    recognitionSequence += 1;
    dataReady.value = false;
    submitting.value = false;
    loadError.value = '';
    if (!isOpen) {
      endOpen();
      formData.value = undefined;
      isEditMode.value = false;
      fieldConfigHiddenFields.value = [];
      pinyinCodeTouched.value = false;
      wubiCodeTouched.value = false;
      resetBusinessLicenseOcrState();
      return;
    }
    beginOpen();
    modalApi.setState({ fullscreen: true, confirmDisabled: true });
    modalApi.lock();
    const data = modalApi.getData<ErpCustomerApi.Customer>();
    isEditMode.value = Boolean(data?.id);
    try {
      await loadFieldVisibility();
      if (current !== loadSequence) return;
      const record = data?.id ? await getCustomer(data.id) : undefined;
      if (current !== loadSequence) return;
      formData.value = record;
      selectedOptions.value = Object.fromEntries(
        [
          ['deptId', record?.deptId, record?.deptName],
          ['saleUserId', record?.saleUserId, record?.saleUserName],
          [
            'developerUserId',
            record?.developerUserId,
            record?.developerUserName,
          ],
          [
            'priceLevel',
            record?.priceLevel,
            record?.priceLevel === 6
              ? '库存成本价（历史）'
              : record?.priceLevel,
          ],
          ['routeId', record?.routeId, record?.routeName],
          ['areaId', record?.areaId, record?.areaName],
        ]
          .filter(([, id]) => id !== null && id !== undefined)
          .map(([field, id, name]) => [
            field,
            [
              {
                id,
                value: id,
                name: name ?? String(id),
                nickname: name ?? String(id),
                label: name ?? String(id),
              },
            ],
          ]),
      );
      await applyConfiguredSchemas();
      if (current !== loadSequence) return;
      await nextTick();
      resetBusinessLicenseOcrState();
      await resetAllForms();
      if (current !== loadSequence) return;
      await setAllFormValues(
        buildCustomerFormValues(record) ?? { manualInputCode: false },
      );
      if (current !== loadSequence) return;
      dataReady.value = true;
      modalApi.setState({ confirmDisabled: false });
      queueFocus();
    } catch {
      if (current === loadSequence)
        loadError.value = '资料或权限加载失败，请关闭后重试';
    } finally {
      if (current === loadSequence) modalApi.unlock();
    }
  },
});

const [BaseDataModal, baseDataModalApi] = useVbenModal({
  connectedComponent: BaseDataForm,
  onClosed: restoreQuickCreateFocus,
  destroyOnClose: true,
});
</script>

<template>
  <Modal :title="getTitle" class="!w-full" bordered content-class="p-0">
    <BaseDataModal @success="handleBaseDataCreated" />

    <div
      :ref="setFormScope"
      @keydown.enter.capture="handleFormEnter"
      class="customer-form-page erp-form-focus-highlight"
      :class="isEditMode ? 'customer-edit-layout' : 'customer-create-layout'"
    >
      <Alert v-if="loadError" :message="loadError" type="error" show-icon />
      <section v-if="!isEditMode" class="customer-business-license-ocr">
        <Upload
          :before-upload="beforeBusinessLicenseUpload"
          :file-list="businessLicenseFileList"
          :max-count="1"
          :multiple="false"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          @preview="handleBusinessLicensePreview"
          @remove="handleBusinessLicenseRemove"
        >
          <Button size="small">
            <IconifyIcon icon="lucide:upload" />
            上传营业执照
          </Button>
        </Upload>
        <Button
          type="primary"
          size="small"
          :disabled="!businessLicenseFile"
          :loading="businessLicenseRecognizing"
          @click="handleRecognizeBusinessLicense"
        >
          <IconifyIcon
            v-if="!businessLicenseRecognizing"
            icon="lucide:scan-text"
          />
          识别
        </Button>
      </section>
      <section
        :class="
          isEditMode ? 'customer-detail-section' : 'customer-create-sheet'
        "
      >
        <header
          :class="
            isEditMode
              ? 'customer-detail-section__header'
              : 'customer-create-sheet__header'
          "
        >
          <span
            :class="
              isEditMode
                ? 'customer-detail-section__title'
                : 'customer-create-sheet__title'
            "
          >
            {{ isEditMode ? '基础与联系' : '客户档案' }}
          </span>
          <span v-if="!isEditMode" class="customer-create-sheet__hint">
            所有主档字段均在当前页面填写
          </span>
        </header>
        <div v-if="!isEditMode" class="customer-create-group__title">
          基础与联系
        </div>
        <BasicForm class="customer-edit-form" />
      </section>

      <section
        :class="
          isEditMode ? 'customer-detail-section' : 'customer-create-group'
        "
      >
        <header v-if="isEditMode" class="customer-detail-section__header">
          <span class="customer-detail-section__title">财务与授信</span>
        </header>
        <div v-else class="customer-create-group__title">财务与授信</div>
        <FinanceForm class="customer-edit-form" />
      </section>

      <section
        :class="
          isEditMode ? 'customer-detail-section' : 'customer-create-group'
        "
      >
        <header v-if="isEditMode" class="customer-detail-section__header">
          <span class="customer-detail-section__title">开票与账户</span>
        </header>
        <div v-else class="customer-create-group__title">开票与账户</div>
        <InvoiceForm class="customer-edit-form" />
      </section>

      <section
        :class="
          isEditMode ? 'customer-detail-section' : 'customer-create-group'
        "
      >
        <header v-if="isEditMode" class="customer-detail-section__header">
          <span class="customer-detail-section__title">业务与物流</span>
        </header>
        <div v-else class="customer-create-group__title">业务与物流</div>
        <SaleForm class="customer-edit-form" />
      </section>

      <section
        :class="
          isEditMode ? 'customer-detail-section' : 'customer-create-group'
        "
      >
        <header v-if="isEditMode" class="customer-detail-section__header">
          <span class="customer-detail-section__title">系统辅助</span>
        </header>
        <div v-else class="customer-create-group__title">系统辅助</div>
        <SystemForm class="customer-edit-form" />
      </section>
    </div>
  </Modal>
</template>

<style scoped>
.customer-form-page {
  min-height: calc(100vh - 142px);
  padding: 12px;
  overflow: auto;
  background: hsl(var(--muted) / 28%);
  font-size: 12px;
}

.customer-create-layout {
  display: flex;
  flex-direction: column;
}

.customer-business-license-ocr {
  display: flex;
  min-height: 44px;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
}

.customer-business-license-ocr :deep(.ant-upload-wrapper) {
  min-width: 0;
}

.customer-business-license-ocr :deep(.ant-upload-list) {
  max-width: min(420px, 52vw);
  font-size: 12px;
}

.customer-business-license-ocr :deep(.ant-upload-list-item) {
  margin-top: 4px;
}

.customer-business-license-ocr :deep(.ant-btn) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.customer-create-sheet,
.customer-create-group,
.customer-detail-section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
}

.customer-create-sheet {
  border-radius: 0;
}

.customer-create-group {
  border-top: 0;
}

.customer-create-group:last-child {
  border-radius: 0 0 8px 8px;
}

.customer-create-sheet__header,
.customer-detail-section__header {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.customer-create-sheet__title,
.customer-detail-section__title,
.customer-create-group__title {
  position: relative;
  padding-left: 10px;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
}

.customer-create-sheet__title::before,
.customer-detail-section__title::before,
.customer-create-group__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  background: hsl(var(--primary));
  border-radius: 3px;
  content: '';
}

.customer-create-sheet__hint {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.customer-create-group__title {
  margin: 10px 12px 2px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.customer-edit-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.customer-detail-section {
  border-radius: 8px;
}

.customer-edit-form :deep(.customer-form-grid) {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px 12px;
  padding: 10px 12px 12px;
}

.customer-edit-form :deep(.customer-form-grid > div) {
  min-width: 0;
  min-height: 32px;
  padding-bottom: 0 !important;
}

.customer-edit-form :deep(.customer-form-grid > div > label) {
  margin-right: 0;
  padding-right: 10px;
  align-items: center;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  white-space: nowrap;
}

.customer-edit-form :deep(.customer-form-grid > div > .flex-auto) {
  min-width: 0;
  padding: 0;
}

.customer-edit-form :deep(.ant-input),
.customer-edit-form :deep(.ant-input-affix-wrapper),
.customer-edit-form :deep(.ant-input-number),
.customer-edit-form :deep(.ant-picker),
.customer-edit-form :deep(.ant-select-selector),
.customer-edit-form :deep(.ant-tree-select .ant-select-selector) {
  min-height: 32px;
  background: hsl(var(--card)) !important;
  border-color: hsl(var(--border)) !important;
  border-radius: 6px !important;
  font-size: 12px;
}

.customer-edit-form :deep(.ant-input),
.customer-edit-form :deep(.ant-input-number-input),
.customer-edit-form :deep(.ant-picker-input > input),
.customer-edit-form :deep(.ant-select-selection-item),
.customer-edit-form :deep(.ant-select-selection-placeholder),
.customer-edit-form :deep(.ant-radio-wrapper),
.customer-edit-form :deep(.ant-checkbox-wrapper) {
  font-size: 12px;
}

.customer-edit-form :deep(.ant-input:not(textarea)),
.customer-edit-form :deep(.ant-input-number),
.customer-edit-form :deep(.ant-picker),
.customer-edit-form :deep(.ant-select-single) {
  height: 32px;
}

.customer-edit-form :deep(.customer-dept-multiple-select.ant-select-multiple),
.customer-edit-form
  :deep(
    .customer-dept-multiple-select.ant-select-multiple .ant-select-selector
  ) {
  height: 32px;
  min-height: 32px;
}

.customer-edit-form :deep(.customer-dept-multiple-select .ant-select-selector) {
  overflow: hidden;
}

.customer-edit-form
  :deep(.customer-dept-multiple-select .ant-select-selection-overflow) {
  min-width: 0;
  flex-wrap: nowrap;
  overflow: hidden;
}

.customer-edit-form
  :deep(.customer-dept-multiple-select .ant-select-selection-overflow-item) {
  min-width: 0;
}

.customer-edit-form
  :deep(.customer-dept-multiple-select .ant-select-selection-item) {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.customer-edit-form
  :deep(.customer-dept-multiple-select .customer-dept-overflow-placeholder) {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: help;
}

.customer-edit-form :deep(.ant-input[disabled]),
.customer-edit-form :deep(.ant-input-affix-wrapper-disabled),
.customer-edit-form :deep(.ant-input-number-disabled),
.customer-edit-form :deep(.ant-picker-disabled),
.customer-edit-form :deep(.ant-select-disabled .ant-select-selector) {
  color: hsl(var(--muted-foreground)) !important;
  background: hsl(var(--muted) / 48%) !important;
}

:global(.customer-form-select-dropdown .ant-select-item),
:global(.customer-form-select-dropdown .ant-empty-description),
:global(.customer-form-select-dropdown .ant-select-tree-node-content-wrapper) {
  font-size: 12px;
}

@media (max-width: 1279px) {
  .customer-edit-form :deep(.customer-form-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .customer-form-page {
    padding: 8px;
  }

  .customer-create-sheet__header {
    align-items: flex-start;
    flex-direction: column;
    justify-content: center;
    padding-block: 8px;
  }

  .customer-business-license-ocr {
    align-items: stretch;
    flex-direction: column;
  }

  .customer-business-license-ocr :deep(.ant-upload-list) {
    max-width: 100%;
  }

  .customer-edit-form :deep(.customer-form-grid) {
    grid-template-columns: minmax(0, 1fr);
  }

  .customer-edit-form :deep(.customer-dept-form-item) {
    grid-column: auto;
  }
}
</style>
