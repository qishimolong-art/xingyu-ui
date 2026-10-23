<script lang="ts" setup>
import type { UploadFile, UploadProps } from 'ant-design-vue';

import type { SupplierBaseDataQuickCreatePayload } from '../data';

import type { ErpBaseDataApi } from '#/api/erp/base';
import type { ErpSupplierApi } from '#/api/erp/purchase/supplier';

import { nextTick, onBeforeUnmount, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import { Alert, Button, message, Spin, Upload } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createSupplier,
  getSupplierFormDeptPage,
  recognizeSupplierBusinessLicense,
} from '#/api/erp/purchase/supplier';
import { createSupplierBusinessInfo } from '#/api/erp/purchase/supplier/business-info';
import { createSupplierImage } from '#/api/erp/purchase/supplier/image';
import { getAreaTree } from '#/api/system/area';
import { useUpload } from '#/components/upload/use-upload';
import { $t } from '#/locales';
import BaseDataForm from '#/views/erp/base/modules/form.vue';
import { applyEffectiveFieldVisibility } from '#/views/erp/composables/useFieldConfig';
import { buildSupplierCopyDraft } from '#/views/erp/purchase/supplier/utils/copy-draft';
import { confirmBusinessLicenseNameMismatch } from '#/views/erp/sale/customer/utils/business-license-confirm';
import {
  getBusinessLicenseAddress,
  getBusinessLicenseCompanyName,
  getBusinessLicenseNameMismatch,
} from '#/views/erp/sale/customer/utils/business-license-ocr';
import { withCandidateFocus } from '#/views/erp/utils/candidate-focus';
import { buildPinyinCode, buildWubiCode } from '#/views/erp/utils/name-code';

import {
  useBasicFormSchema,
  useFinanceFormSchema,
  useInvoiceFormSchema,
} from '../data';
import {
  buildSupplierBusinessInfoFromOcr,
  readSupplierBusinessLicenseFileAsDataUrl,
} from '../utils/business-license';
import { buildSupplierBusinessLicenseAddressFill } from '../utils/business-license-ocr';
import { loadSupplierFieldVisibility } from '../utils/field-visibility';
import { useSupplierFormKeyboard } from '../utils/form-keyboard';
import {
  buildSupplierAreaEditValues,
  normalizeSupplierFormData,
} from '../utils/form-normalize';

import '#/views/erp/styles/form-focus.css';

type SupplierFormSuccessPayload =
  | number
  | {
      id?: number;
      targetTab?: 'business' | 'images';
    };

const emit = defineEmits<{
  success: [payload?: SupplierFormSuccessPayload];
}>();
const FIELD_CONFIG_MODULE = 'supplier';
const SUPPLIER_FIELD_ALIASES = {
  areaIds: ['region'],
  financePhone: ['financeMobile'],
  invoiceCompany: ['invoiceTitle'],
  taxpayerId: ['invoiceTaxNo'],
};
const BUSINESS_LICENSE_ACCEPT_EXTS = new Set(['jpeg', 'jpg', 'png']);
const BUSINESS_LICENSE_MAX_SIZE = 10 * 1024 * 1024;
const BUSINESS_LICENSE_IMAGE_TYPE = '营业执照';
const BUSINESS_LICENSE_UPLOAD_DIRECTORY = 'erp/supplier/business-license';
const BUSINESS_LICENSE_FILL_FIELDS = [
  ['shortName', 'invoiceCompany'],
  ['creditCode', 'unifiedCreditCode'],
  ['taxNo', 'taxNo'],
  ['taxpayerId', 'taxNo'],
  ['invoiceCompany', 'invoiceCompany'],
  ['invoiceAddress', 'invoiceAddress'],
  ['legalPerson', 'legalPerson'],
] as const;
const INVOICE_FIELD_NAMES = new Set([
  'invoiceAddress',
  'invoiceBank',
  'invoiceBankAccount',
  'invoiceCompany',
  'invoicePhone',
  'invoiceType',
  'taxpayerId',
]);
const FINANCE_FIELD_NAMES = new Set([
  'account',
  'bankAccount',
  'bankAddress',
  'bankName',
  'creditCode',
  'financePhone',
  'legalPerson',
  'memberCode',
  'settleLocked',
  'settleMethod',
  'taxNo',
  'taxPercent',
]);
const hiddenFields = ref<string[]>([]);
const fieldConfigSnapshot = ref<any[]>([]);
const { hasAccessByCodes } = useAccess();

const formData = ref<ErpSupplierApi.Supplier>();
const dataReady = ref(false);
const loadError = ref('');
const submitting = ref(false);
const selectedDeptOptions = ref<any[]>([]);
let loadSequence = 0;
const { beginOpen, endOpen, formScope, handleFormEnter, onOpened, queueFocus } =
  useSupplierFormKeyboard(
    () => true,
    () => dataReady.value && !loadError.value && !submitting.value,
  );
function setFormScope(element: unknown) {
  formScope.value = element instanceof HTMLElement ? element : undefined;
}

onBeforeUnmount(() => {
  loadSequence += 1;
});

const fieldConfigHiddenFields = ref<string[]>([]);
const userStore = useUserStore();
const quickCreateContext = ref<SupplierBaseDataQuickCreatePayload>();
let previousQuickCreateFocus: HTMLElement | null = null;
async function restoreQuickCreateFocus() {
  await nextTick();
  if (dataReady.value && previousQuickCreateFocus?.isConnected)
    previousQuickCreateFocus.focus({ preventScroll: true });
}
const businessLicenseFile = ref<File>();
const businessLicenseFileList = ref<UploadFile[]>([]);
const businessLicenseOcrResult = ref<ErpSupplierApi.BusinessLicenseOcrResp>();
const businessLicenseRecognizing = ref(false);
const businessLicenseSaveBlocked = ref(false);
let businessLicenseRequestVersion = 0;

function invalidateBusinessLicenseRequest() {
  businessLicenseRequestVersion += 1;
  businessLicenseRecognizing.value = false;
}
const businessLicenseUploader = useUpload(BUSINESS_LICENSE_UPLOAD_DIRECTORY);
const pinyinCodeTouched = ref(false);
const wubiCodeTouched = ref(false);
const suppressNameCodeTouch = ref(false);

const title = $t('ui.actionTitle.create', ['供应商']);

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
    deptOptions: selectedDeptOptions.value,
    canCreateBaseData: hasAccessByCodes(['erp:base-data:create']),
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

async function resetAllForms() {
  pinyinCodeTouched.value = false;
  wubiCodeTouched.value = false;
  for (const api of allFormApis) {
    await api.resetForm();
  }
}

async function setAllFormValues(
  data: Partial<ErpSupplierApi.Supplier> & Record<string, any>,
) {
  suppressNameCodeTouch.value = true;
  try {
    for (const api of allFormApis) {
      await api.setValues(data);
    }
  } finally {
    suppressNameCodeTouch.value = false;
  }
}

function hasTextValue(value: unknown) {
  return (
    value !== undefined &&
    value !== null &&
    !(typeof value === 'string' && value.trim() === '')
  );
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

async function loadFieldVisibility() {
  const current = loadSequence;
  const snapshot = await loadSupplierFieldVisibility();
  if (current !== loadSequence) return;
  hiddenFields.value = snapshot.hiddenFields;
  fieldConfigSnapshot.value = snapshot.config;
  fieldConfigHiddenFields.value = snapshot.configHiddenFields;
}

function getSupplierFormApiByField(fieldName: string) {
  if (INVOICE_FIELD_NAMES.has(fieldName)) {
    return invoiceFormApi;
  }
  if (FINANCE_FIELD_NAMES.has(fieldName)) {
    return financeFormApi;
  }
  return basicFormApi;
}

const beforeBusinessLicenseUpload: UploadProps['beforeUpload'] = (file) => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !BUSINESS_LICENSE_ACCEPT_EXTS.has(extension)) {
    message.error('营业执照仅支持 jpg、jpeg、png 格式');
    return Upload.LIST_IGNORE;
  }
  if (file.size > BUSINESS_LICENSE_MAX_SIZE) {
    message.error('营业执照图片不能超过 10MB');
    return Upload.LIST_IGNORE;
  }
  invalidateBusinessLicenseRequest();
  businessLicenseSaveBlocked.value = false;
  businessLicenseFile.value = file as File;
  businessLicenseFileList.value = [file as unknown as UploadFile];
  businessLicenseOcrResult.value = undefined;
  return false;
};

function handleBusinessLicenseRemove() {
  invalidateBusinessLicenseRequest();
  businessLicenseSaveBlocked.value = false;
  businessLicenseFile.value = undefined;
  businessLicenseFileList.value = [];
  businessLicenseOcrResult.value = undefined;
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

function toBase64Payload(dataUrl: string) {
  const separatorIndex = dataUrl.indexOf(',');
  return separatorIndex === -1 ? dataUrl : dataUrl.slice(separatorIndex + 1);
}

function resetBusinessLicenseOcrState() {
  invalidateBusinessLicenseRequest();
  businessLicenseSaveBlocked.value = false;
  businessLicenseFile.value = undefined;
  businessLicenseFileList.value = [];
  businessLicenseOcrResult.value = undefined;
  businessLicenseRecognizing.value = false;
}

function resolveUploadedFileUrl(response: any) {
  const url =
    response?.url ??
    response?.data?.url ??
    response?.data ??
    response?.response?.url ??
    response;
  return typeof url === 'string' ? url : '';
}

function getBusinessLicenseImageName(file: File) {
  return file.name || BUSINESS_LICENSE_IMAGE_TYPE;
}

async function saveBusinessLicenseImage(
  supplierId: number,
  file: File,
  current: number,
) {
  const uploadResponse = await businessLicenseUploader.httpRequest(file);
  if (current !== loadSequence) return;
  const imageUrl = resolveUploadedFileUrl(uploadResponse);
  if (hasTextValue(imageUrl)) {
    await createSupplierImage({
      supplierId,
      imageType: BUSINESS_LICENSE_IMAGE_TYPE,
      imageName: getBusinessLicenseImageName(file),
      imageUrl,
      sort: 0,
    });
    return;
  }
  throw new Error('Business license image upload response has no url');
}

async function saveBusinessLicenseOcrArtifacts(supplierId?: number) {
  if (!supplierId || businessLicenseSaveBlocked.value) {
    return;
  }

  const current = loadSequence;
  const tasks: Array<Promise<void>> = [];
  const selectedFile = businessLicenseFile.value;
  if (selectedFile) {
    tasks.push(saveBusinessLicenseImage(supplierId, selectedFile, current));
  }

  const businessInfo = buildSupplierBusinessInfoFromOcr(
    supplierId,
    businessLicenseOcrResult.value,
  );
  if (businessInfo) {
    tasks.push(createSupplierBusinessInfo(businessInfo).then(() => undefined));
  }

  if (tasks.length === 0) {
    return;
  }

  try {
    await Promise.all(tasks);
  } catch (error) {
    console.error('Failed to save supplier business license artifacts', error);
    message.warning(
      '供应商已保存，但营业执照图片或工商识别信息留存失败，可在供应商详情中补充',
    );
  }
}

function getBusinessLicenseSuccessPayload(
  id?: number,
): SupplierFormSuccessPayload | undefined {
  if (!id) {
    return undefined;
  }
  if (businessLicenseSaveBlocked.value) return id;
  if (businessLicenseOcrResult.value) {
    return { id, targetTab: 'business' };
  }
  if (businessLicenseFile.value) {
    return { id, targetTab: 'images' };
  }
  return id;
}

async function fillFieldsFromBusinessLicense(
  result: ErpSupplierApi.BusinessLicenseOcrResp,
  isCurrent: () => boolean,
) {
  const [basicValues, invoiceValues, financeValues] = await Promise.all([
    basicFormApi.getValues(),
    invoiceFormApi.getValues(),
    financeFormApi.getValues(),
  ]);
  const currentValues = {
    ...basicValues,
    ...invoiceValues,
    ...financeValues,
  } as Record<string, unknown>;
  const fillValuesByForm = new Map<any, Record<string, unknown>>();
  let skippedCount = 0;

  const setFillValue = (fieldName: string, value: unknown) => {
    const api = getSupplierFormApiByField(fieldName);
    const values = fillValuesByForm.get(api) ?? {};
    values[fieldName] = value;
    fillValuesByForm.set(api, values);
  };

  const supplierName = getBusinessLicenseCompanyName(result);
  if (hasTextValue(supplierName)) {
    if (hasTextValue(basicValues.name)) {
      skippedCount += 1;
    } else {
      setFillValue('name', supplierName!);
    }
  }

  const addressFill = await buildSupplierBusinessLicenseAddressFill(
    getBusinessLicenseAddress(result),
    basicValues,
    getAreaTree,
  );
  if (!isCurrent()) return;
  for (const [field, value] of Object.entries(addressFill.values)) {
    setFillValue(field, value);
  }
  skippedCount += addressFill.skippedCount;
  const unmatchedAddress = addressFill.unmatchedAddress;

  for (const [targetField, resultField] of BUSINESS_LICENSE_FILL_FIELDS) {
    const value = result[resultField];
    if (!hasTextValue(value)) {
      continue;
    }
    if (hasTextValue(currentValues[targetField])) {
      skippedCount += 1;
      continue;
    }
    setFillValue(targetField, String(value).trim());
  }

  // 用户在地区请求期间补写的内容也应保留。
  for (const [api, values] of fillValuesByForm) {
    const latest = await api.getValues();
    if (!isCurrent()) return;
    for (const field of Object.keys(values)) {
      const current = latest[field];
      if (Array.isArray(current) ? current.length > 0 : hasTextValue(current)) {
        delete values[field];
        skippedCount += 1;
      }
    }
  }
  const filledCount = [...fillValuesByForm.values()].reduce(
    (count, values) => count + Object.keys(values).length,
    0,
  );
  if (filledCount > 0) {
    await Promise.all(
      [...fillValuesByForm.entries()].map(([api, values]) =>
        api.setValues(values),
      ),
    );
    if (fillValuesByForm.get(basicFormApi)?.name) {
      syncNameCodes(String(supplierName));
    }
    const suffix = [
      skippedCount > 0 ? `保留 ${skippedCount} 项已填写内容` : '',
      unmatchedAddress ? '地址未匹配到省市县，请手动填写' : '',
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
      skippedCount > 0 ? '已填写字段保持不变' : '未匹配到可填充的供应商字段',
      unmatchedAddress ? '地址未匹配到省市县，请手动填写' : '',
    ]
      .filter(Boolean)
      .join('，'),
  );
}

async function handleRecognizeBusinessLicense() {
  if (businessLicenseRecognizing.value) return;
  const selectedFile = businessLicenseFile.value;
  if (!selectedFile) {
    message.warning('请先上传营业执照图片');
    return;
  }
  const requestVersion = ++businessLicenseRequestVersion;
  const isCurrent = () => requestVersion === businessLicenseRequestVersion;
  businessLicenseRecognizing.value = true;
  businessLicenseOcrResult.value = undefined;
  try {
    const image = toBase64Payload(
      await readSupplierBusinessLicenseFileAsDataUrl(selectedFile),
    );
    if (!isCurrent()) return;
    const result = await recognizeSupplierBusinessLicense({ image });
    if (!isCurrent()) return;
    if (result?.success === false) {
      message.error(result.message || '营业执照识别失败，请手动填写');
      return;
    }
    const values = await basicFormApi.getValues();
    if (!isCurrent()) return;
    const mismatch = getBusinessLicenseNameMismatch(
      values.name,
      result,
      '供应商',
    );
    if (mismatch) businessLicenseSaveBlocked.value = true;
    const confirmed = await confirmBusinessLicenseNameMismatch(
      mismatch,
      '继续填充',
    );
    if (!confirmed || !isCurrent()) return;
    await fillFieldsFromBusinessLicense(result, isCurrent);
    if (!isCurrent()) return;
    businessLicenseSaveBlocked.value = false;
    businessLicenseOcrResult.value = result;
  } catch (error) {
    if (!isCurrent()) return;
    console.error('Failed to recognize supplier business license', error);
    message.error('营业执照识别失败，请稍后重试或手动填写');
  } finally {
    if (isCurrent()) businessLicenseRecognizing.value = false;
  }
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

const [Modal, modalApi] = useVbenModal({
  destroyOnClose: true,
  onOpened,
  async onConfirm() {
    if (
      !dataReady.value ||
      loadError.value ||
      submitting.value ||
      businessLicenseRecognizing.value ||
      !hasAccessByCodes(['erp:supplier:create'])
    )
      return;
    const current = loadSequence;
    submitting.value = true;
    modalApi.lock();
    try {
      for (const api of allFormApis) {
        const { valid } = await api.validate();
        if (!valid || current !== loadSequence) return;
      }
      const values = await Promise.all(
        allFormApis.map((api) => api.getValues()),
      );
      if (current !== loadSequence) return;
      const data = normalizeSupplierFormData(Object.assign({}, ...values));
      const id = await createSupplier(data);
      if (current !== loadSequence) {
        emit('success');
        return;
      }
      await saveBusinessLicenseOcrArtifacts(id);
      if (current !== loadSequence) {
        emit('success');
        return;
      }
      const successPayload = getBusinessLicenseSuccessPayload(id);
      await modalApi.close();
      emit('success', successPayload);
      message.success($t('ui.actionMessage.operationSuccess'));
    } finally {
      if (current === loadSequence) {
        submitting.value = false;
        modalApi.unlock();
      }
    }
  },
  async onOpenChange(isOpen: boolean) {
    const current = ++loadSequence;
    dataReady.value = false;
    submitting.value = false;
    loadError.value = '';
    if (!isOpen) {
      endOpen();
      formData.value = undefined;
      fieldConfigHiddenFields.value = [];
      resetBusinessLicenseOcrState();
      return;
    }
    beginOpen();
    modalApi.setState({ fullscreen: true, confirmDisabled: true });
    modalApi.lock();
    const data = modalApi.getData<ErpSupplierApi.Supplier>();
    try {
      formData.value = data ? buildSupplierCopyDraft(data) : undefined;
      const defaultDeptId =
        formData.value?.deptId ?? userStore.userInfo?.deptId;
      const defaultDepartmentPage = defaultDeptId
        ? await getSupplierFormDeptPage({
            pageNo: 1,
            pageSize: 1,
            selectedId: defaultDeptId,
          })
        : undefined;
      if (current !== loadSequence) return;
      selectedDeptOptions.value = defaultDepartmentPage?.list ?? [];
      await loadFieldVisibility();
      if (current !== loadSequence) return;
      const schemaOptions = getSupplierSchemaOptions();
      const schemas = await Promise.all([
        applyConfiguredSchema(useBasicFormSchema([], schemaOptions)),
        applyConfiguredSchema(useInvoiceFormSchema([], schemaOptions)),
        applyConfiguredSchema(useFinanceFormSchema()),
      ]);
      if (current !== loadSequence) return;
      allFormApis.forEach((api, index) =>
        api.setState({ schema: schemas[index] }),
      );
      await nextTick();
      if (current !== loadSequence) return;
      resetBusinessLicenseOcrState();
      await resetAllForms();
      if (current !== loadSequence) return;
      await setAllFormValues({
        ...formData.value,
        ...buildSupplierAreaEditValues(formData.value || {}),
        manualInputCode: false,
        deptId: defaultDeptId,
        deptIds:
          formData.value?.deptIds ??
          (typeof defaultDeptId === 'number' ? [defaultDeptId] : []),
      });
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

defineExpose({
  modalApi,
});
</script>

<template>
  <Modal :title="title" class="!w-full" bordered content-class="p-0">
    <BaseDataModal @success="handleBaseDataCreated" />

    <Spin :spinning="!dataReady && !loadError">
      <div
        :ref="setFormScope"
        class="supplier-form-view supplier-create-layout erp-form-focus-highlight"
        @keydown.enter.capture="handleFormEnter"
      >
        <Alert v-if="loadError" :message="loadError" type="error" show-icon />
        <section class="supplier-business-license-ocr">
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
        <section class="supplier-create-card">
          <header class="supplier-create-card__header">
            <span class="supplier-create-card__title">供应商资料</span>
          </header>
          <div class="supplier-create-group">
            <div class="supplier-create-group__title">基础信息</div>
            <BasicForm class="supplier-edit-form" />
          </div>
          <div class="supplier-create-group">
            <div class="supplier-create-group__title">开票信息</div>
            <InvoiceForm class="supplier-edit-form" />
          </div>
          <div class="supplier-create-group">
            <div class="supplier-create-group__title">财务信息</div>
            <FinanceForm class="supplier-edit-form" />
          </div>
        </section>
      </div>
    </Spin>
  </Modal>
</template>

<style scoped>
.supplier-form-view {
  min-height: calc(100vh - 142px);
  padding: 12px;
  overflow: auto;
  background: hsl(var(--muted) / 28%);
  font-size: 12px;
}

.supplier-create-card {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.supplier-business-license-ocr {
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

.supplier-business-license-ocr + .supplier-create-card {
  border-radius: 0 0 8px 8px;
}

.supplier-business-license-ocr :deep(.ant-upload-wrapper) {
  min-width: 0;
}

.supplier-business-license-ocr :deep(.ant-upload-list) {
  max-width: min(420px, 52vw);
  font-size: 12px;
}

.supplier-business-license-ocr :deep(.ant-upload-list-item) {
  margin-top: 4px;
}

.supplier-business-license-ocr :deep(.ant-btn) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.supplier-create-card__header {
  display: flex;
  min-height: 40px;
  align-items: center;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.supplier-create-card__title,
.supplier-create-group__title {
  position: relative;
  padding-left: 10px;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
}

.supplier-create-card__title::before,
.supplier-create-group__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  background: hsl(var(--primary));
  border-radius: 3px;
  content: '';
}

.supplier-create-group {
  padding-top: 10px;
}

.supplier-create-group + .supplier-create-group {
  border-top: 1px solid hsl(var(--border));
}

.supplier-create-group__title {
  margin: 0 12px 2px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
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

@media (max-width: 1279px) {
  .supplier-edit-form :deep(.supplier-form-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .supplier-form-view {
    padding: 8px;
  }

  .supplier-business-license-ocr {
    align-items: stretch;
    flex-direction: column;
  }

  .supplier-business-license-ocr :deep(.ant-upload-list) {
    max-width: 100%;
  }

  .supplier-edit-form :deep(.supplier-form-grid) {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
