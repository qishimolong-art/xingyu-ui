<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { ErpStockApi } from '#/api/erp/stock/stock';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { updateStock } from '#/api/erp/stock/stock';
import {
  stockInput,
  validateStockStorage,
} from '#/views/erp/stock/utils/stock-decimal';

const emit = defineEmits(['success']);

type EditableStockField =
  | 'costAmount'
  | 'costPrice'
  | 'purchasePrice'
  | 'shelf';

interface FieldEditModalData {
  field: EditableStockField;
  row: ErpStockApi.Stock;
}

const fieldLabels: Record<EditableStockField, string> = {
  shelf: '货架',
  purchasePrice: '进价',
  costPrice: '成本单价',
  costAmount: '成本金额',
};

const numericFields = new Set<EditableStockField>([
  'costAmount',
  'costPrice',
  'purchasePrice',
]);

const modalData = ref<FieldEditModalData>();
const modalTitle = computed(() => {
  const field = modalData.value?.field;
  return field ? `修改${fieldLabels[field]}` : '修改库存字段';
});

function normalizeShelf(value?: string) {
  return value?.trim() ?? '';
}

function normalizeNumber(value?: null | number | string) {
  if (value === undefined || value === null || value === '') {
    return 0;
  }
  return stockInput(value, { allowZero: true });
}

const formSchema: VbenFormSchema[] = [
  {
    fieldName: 'productName',
    label: '配件',
    component: 'Input',
    componentProps: { disabled: true },
  },
  {
    fieldName: 'warehouseName',
    label: '仓库',
    component: 'Input',
    componentProps: { disabled: true },
  },
  {
    fieldName: 'value',
    label: '修改值',
    component: 'Input',
    componentProps: {
      allowClear: true,
      placeholder: '请输入修改值',
    },
  },
];

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    labelWidth: 90,
  },
  layout: 'horizontal',
  showDefaultActions: false,
  schema: formSchema,
});

function buildPayload(
  row: ErpStockApi.Stock,
  field: EditableStockField,
  value: number | string | undefined,
): ErpStockApi.StockUpdateReqVO {
  const payload: ErpStockApi.StockUpdateReqVO = {
    id: row.id!,
    fieldName: field,
    shelf: normalizeShelf(row.shelf),
    purchasePrice: normalizeNumber(row.purchasePrice),
    costPrice: normalizeNumber(row.costPrice),
    costAmount: normalizeNumber(row.costAmount),
  };

  if (field === 'shelf') {
    payload.shelf = normalizeShelf(value as string | undefined);
  } else {
    const decimal = normalizeNumber(value);
    validateStockStorage(
      decimal,
      fieldLabels[field],
      field === 'costAmount' ? 4 : 6,
      ({ costAmount: 16, costPrice: 10 } as Partial<Record<string, number>>)[
        field
      ] ?? 18,
    );
    payload[field] = decimal;
  }
  return payload;
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const data = modalData.value;
    if (!data?.row.id) {
      message.warning('当前库存行缺少库存编号，无法修改');
      return;
    }
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    const values = (await formApi.getValues()) as {
      value?: number | string;
    };
    modalApi.lock();
    try {
      await updateStock(buildPayload(data.row, data.field, values.value));
      await modalApi.close();
      emit('success');
      message.success('修改成功');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      modalData.value = undefined;
      return;
    }
    const data = modalApi.getData<FieldEditModalData>();
    if (!data) {
      return;
    }
    modalData.value = data;
    const isNumericField = numericFields.has(data.field);
    formApi.updateSchema([
      {
        fieldName: 'value',
        label: fieldLabels[data.field],
        component: 'Input',
        componentProps: isNumericField
          ? {
              class: 'w-full',
              min: 0,
              inputmode: 'decimal',
              placeholder: `请输入${fieldLabels[data.field]}`,
            }
          : {
              allowClear: true,
              placeholder: `请输入${fieldLabels[data.field]}`,
            },
      },
    ]);
    await formApi.setValues({
      productName:
        [data.row.productCode, data.row.productName]
          .filter(Boolean)
          .join(' ') || '-',
      value: data.row[data.field] ?? undefined,
      warehouseName: data.row.warehouseName ?? '-',
    });
  },
});
</script>

<template>
  <Modal :title="modalTitle" class="w-[520px]">
    <Form class="mx-4" />
  </Modal>
</template>
