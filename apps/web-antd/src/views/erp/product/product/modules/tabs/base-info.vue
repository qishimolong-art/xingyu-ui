<script lang="ts" setup>
import { useCandidateSchema } from '#/views/erp/utils/candidate-focus';

import type { ErpProductApi } from '#/api/erp/product/product';
import type { ProductQuickCreatePayload } from '../../data';

import { nextTick, ref, watch } from 'vue';

import { useAccess } from '@vben/access';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  getStockWarehouseSimpleList,
  getWarehouseSimpleList,
} from '#/api/erp/stock/warehouse';
import {
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import { buildPinyinCode, buildWubiCode } from '#/views/erp/utils/name-code';

import {
  isLeafProductCategoryId,
  useBaseFormSchema,
  useConfiguredBaseFormSchema,
} from '../../data';
import { focusNextProductInputOnEnter } from '../../utils/keyboard';
import {
  includeSelectedWarehouseOption,
  shouldUseStockVisibleWarehouseOptions,
} from '../../utils/warehouse-options';

const props = defineProps<{
  onQuickCreate?: (payload: ProductQuickCreatePayload) => void;
  onCreateWarehouse?: () => void;
  readonly?: boolean;
  value?: ErpProductApi.Product;
}>();
const decorateCandidates = useCandidateSchema();

const emit = defineEmits<{
  (e: 'change', values: Record<string, any>): void;
}>();
const { hiddenFields } = useFieldPermission('erp_product');
const { hasAccessByCodes } = useAccess();
const pinyinCodeTouched = ref(false);
const wubiCodeTouched = ref(false);
const suppressNameCodeTouch = ref(false);

async function getDefaultWarehouseOptions() {
  const warehouses = shouldUseStockVisibleWarehouseOptions({
    readonly: props.readonly,
    readonlyBySaleDistribution: props.value?.readonlyBySaleDistribution,
  })
    ? await getStockWarehouseSimpleList()
    : await getWarehouseSimpleList();
  return includeSelectedWarehouseOption(warehouses, props.value);
}

function getSchema() {
  return decorateCandidates(
    useBaseFormSchema(hiddenFields.value, {
      canCreateBrand: hasAccessByCodes(['erp:product-brand:create']),
      canCreateCategory: hasAccessByCodes(['erp:product-category:create']),
      canCreateUnit: hasAccessByCodes(['erp:product-unit:create']),
      canCreateWarehouse: hasAccessByCodes(['erp:warehouse:create']),
      getWarehouseOptions: getDefaultWarehouseOptions,
      onQuickCreate: props.onQuickCreate,
      onCreateWarehouse: props.onCreateWarehouse,
    }),
  );
}

async function refreshSchema(fields = hiddenFields.value) {
  formApi.setState({
    schema: decorateCandidates(
      await useConfiguredBaseFormSchema(fields, {
        canCreateCategory: hasAccessByCodes(['erp:product-category:create']),
        canCreateBrand: hasAccessByCodes(['erp:product-brand:create']),
        canCreateUnit: hasAccessByCodes(['erp:product-unit:create']),
        canCreateWarehouse: hasAccessByCodes(['erp:warehouse:create']),
        getWarehouseOptions: getDefaultWarehouseOptions,
        onQuickCreate: props.onQuickCreate,
        onCreateWarehouse: props.onCreateWarehouse,
      }),
    ),
  });
}

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    labelClass: '!justify-start !text-left',
    labelWidth: 82,
  },
  compact: true,
  wrapperClass: 'product-form-grid grid-cols-4',
  layout: 'horizontal',
  schema: getSchema(),
  showDefaultActions: false,
  handleValuesChange(values, changedFields) {
    if (!suppressNameCodeTouch.value) {
      const focusedField = formApi.getFocusedField?.();
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
      if (values.manualInputCode) {
        formApi.setFieldValue('code', '');
      } else {
        formApi.setFieldValue('code', undefined);
      }
    }
    emit('change', values);
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
  formApi.setValues(updates);
  void Promise.resolve().then(() => {
    suppressNameCodeTouch.value = false;
  });
}

watch(hiddenFields, (fields) => {
  void refreshSchema(fields);
});

watch(
  () => [props.onQuickCreate, props.onCreateWarehouse],
  () => {
    void refreshSchema();
  },
);

watch(
  () => [
    props.value?.defaultWarehouseId,
    props.value?.defaultWarehouseName,
    props.value?.readonlyBySaleDistribution,
    props.readonly,
  ],
  () => refreshDefaultWarehouseOptions(),
  { flush: 'post' },
);

function refreshFieldOptions(fieldName: string) {
  formApi
    .getFieldComponentRef<{ reloadOptions?: () => void }>(fieldName)
    ?.reloadOptions?.();
}

function refreshDefaultWarehouseOptions() {
  refreshFieldOptions('defaultWarehouseId');
}

async function setValuesWithoutNameCodeSync(data: Record<string, any>) {
  suppressNameCodeTouch.value = true;
  try {
    await formApi.setValues(data);
    await nextTick();
  } finally {
    suppressNameCodeTouch.value = false;
  }
}

defineExpose({
  async validate() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return false;
    }
    if (!isFieldHidden(hiddenFields.value, 'categoryId')) {
      const values = await formApi.getValues();
      const isLeaf = await isLeafProductCategoryId(values.categoryId);
      if (!isLeaf) {
        message.warning('请选择最末级配件分类');
        return false;
      }
    }
    return valid;
  },
  getValues: () => formApi.getValues(),
  async resetForm() {
    pinyinCodeTouched.value = false;
    wubiCodeTouched.value = false;
    await formApi.resetForm();
  },
  async setValues(data: Record<string, any>) {
    await setValuesWithoutNameCodeSync(data);
  },
  setDisabled: (disabled: boolean) => formApi.setDisabled(disabled),
  setFieldValue: (field: string, value: any) =>
    formApi.setFieldValue(field, value),
  refreshSchema,
  refreshFieldOptions,
  refreshDefaultWarehouseOptions,
});

if (props.value) {
  void setValuesWithoutNameCodeSync(props.value);
}

void refreshSchema();
</script>

<template>
  <div @keydown.enter="focusNextProductInputOnEnter">
    <Form class="mx-2" />
  </div>
</template>
