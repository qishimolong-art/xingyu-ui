<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { adjustStock, type ErpStockApi } from '#/api/erp/stock/stock';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { applyStockFormFieldPermission } from '#/views/erp/stock/utils/field-permission';
import { stockInput } from '#/views/erp/stock/utils/stock-decimal';

const emit = defineEmits(['success']);
const FIELD_PERMISSION_MODULE = 'erp_stock';

interface AdjustModalData {
  productId: number;
  warehouseId: number;
  productCode?: string;
  productName?: string;
  warehouseName?: string;
  count?: number;
}

const modalData = ref<AdjustModalData>();
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);

const formSchema: VbenFormSchema[] = [
  {
    fieldName: 'productId',
    label: 'productId',
    component: 'Input',
    dependencies: { triggerFields: [''], show: () => false },
  },
  {
    fieldName: 'warehouseId',
    label: 'warehouseId',
    component: 'Input',
    dependencies: { triggerFields: [''], show: () => false },
  },
  {
    fieldName: 'productName',
    label: '配件',
    component: 'Input',
    componentProps: { disabled: true },
    formItemClass: 'col-span-2',
  },
  {
    fieldName: 'warehouseName',
    label: '仓库',
    component: 'Input',
    componentProps: { disabled: true },
  },
  {
    fieldName: 'currentCount',
    label: '当前库存数',
    component: 'Input',
    componentProps: { disabled: true },
  },
  {
    fieldName: 'targetCount',
    label: '调整后库存数',
    component: 'Input',
    rules: 'required',
    componentProps: {
      inputmode: 'decimal',
      min: 0,
      class: 'w-full',
      placeholder: '请输入调整后的库存数量',
    },
  },
  {
    fieldName: 'reason',
    label: '调整原因',
    component: 'Select',
    componentProps: {
      allowClear: true,
      placeholder: '请选择调整原因',
      options: [
        { label: '盘点调整', value: '盘点调整' },
        { label: '报损', value: '报损' },
        { label: '报溢', value: '报溢' },
        { label: '其他', value: '其他' },
      ],
    },
  },
  {
    fieldName: 'remark',
    label: '备注',
    component: 'Textarea',
    componentProps: {
      rows: 3,
      placeholder: '请输入备注',
    },
    formItemClass: 'col-span-2',
  },
];

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    labelWidth: 120,
  },
  layout: 'horizontal',
  showDefaultActions: false,
  schema: formSchema,
  wrapperClass: 'grid-cols-2',
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    const values = (await formApi.getValues()) as {
      productId?: number | string;
      reason?: string;
      remark?: string;
      targetCount: number | string;
      warehouseId?: number | string;
    };
    modalApi.lock();
    try {
      const payload: ErpStockApi.StockAdjustReqVO = {
        productId: Number(values.productId ?? modalData.value?.productId),
        warehouseId: Number(values.warehouseId ?? modalData.value?.warehouseId),
        targetCount: stockInput(
          values.targetCount ?? modalData.value?.count ?? 0,
          { allowZero: true },
        ),
        reason: values.reason,
        remark: values.remark,
      };
      await adjustStock(payload);
      await modalApi.close();
      emit('success');
      message.success('已生成库存盘点单并完成审批');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      modalData.value = undefined;
      return;
    }
    await loadHiddenFields();
    formApi.updateSchema(
      applyStockFormFieldPermission(formSchema, hiddenFields.value),
    );
    const data = modalApi.getData<AdjustModalData>();
    if (!data) {
      return;
    }
    modalData.value = data;
    const productLabel = [data.productCode, data.productName]
      .filter(Boolean)
      .join(' ');
    await formApi.setValues({
      productId: data.productId,
      warehouseId: data.warehouseId,
      productName: productLabel || '-',
      warehouseName: data.warehouseName ?? '-',
      currentCount: data.count ?? 0,
      targetCount: data.count ?? 0,
      reason: '盘点调整',
      remark: undefined,
    });
  },
});
</script>

<template>
  <Modal title="调整库存数量" class="w-[600px]">
    <Form class="mx-4" />
  </Modal>
</template>
