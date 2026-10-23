<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { handleTree } from '@vben/utils';

import {
  Form as AForm,
  Checkbox,
  FormItem,
  Input,
  message,
  Radio,
  RadioGroup,
  Select,
  TreeSelect,
} from 'ant-design-vue';

import { getProductCategorySimpleList } from '#/api/erp/product/category';
import {
  batchUpdateProduct,
  batchUpdateProductStockDistribution,
} from '#/api/erp/product/product';
import { getProductUnitSimpleList } from '#/api/erp/product/unit';
import { getWarehouseSimpleList } from '#/api/erp/stock/warehouse';
import { useFieldPermission } from '#/composables/useFieldPermission';

const emit = defineEmits(['success']);

interface BatchEditFormData {
  categoryId?: number;
  defaultWarehouseId?: number;
  remark?: string;
  status?: number;
  unitId?: number;
  warehouseIds?: number[];
}

const ids = ref<number[]>([]);
const formData = ref<BatchEditFormData>({});
const categoryTreeData = ref<any[]>([]);
const unitOptions = ref<{ label: string; value: number }[]>([]);
const warehouseOptions = ref<{ label: string; value: number }[]>([]);
const { isHidden, loadHiddenFields } = useFieldPermission('erp_product');
const { hasAccessByCodes } = useAccess();
const canStockDistribute = computed(() =>
  hasAccessByCodes(['erp:product:stock-distribute']),
);
const selectedWarehouseIdSet = computed(
  () => new Set(formData.value.warehouseIds || []),
);
const allWarehousesSelected = computed(() => {
  return (
    warehouseOptions.value.length > 0 &&
    warehouseOptions.value.every((item) =>
      selectedWarehouseIdSet.value.has(item.value),
    )
  );
});
const someWarehousesSelected = computed(() => {
  const selectedCount = warehouseOptions.value.filter((item) =>
    selectedWarehouseIdSet.value.has(item.value),
  ).length;
  return selectedCount > 0 && selectedCount < warehouseOptions.value.length;
});

function filterSelectOption(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  const label = String(option?.label ?? option?.name ?? option?.title ?? '');
  return label.toLowerCase().includes(keyword);
}

function toggleAllWarehouses(checked: boolean) {
  formData.value.warehouseIds = checked
    ? warehouseOptions.value.map((item) => item.value)
    : [];
}

async function loadOptions() {
  const [categories, units, warehouses] = await Promise.all([
    getProductCategorySimpleList(),
    getProductUnitSimpleList(),
    getWarehouseSimpleList(),
  ]);
  categoryTreeData.value = handleTree(categories || []);
  unitOptions.value = (units || []).map((item: any) => ({
    label: item.name,
    value: item.id,
  }));
  warehouseOptions.value = (warehouses || []).map((item: any) => ({
    label: item.name,
    value: item.id,
  }));
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (ids.value.length === 0) {
      message.warning('请先勾选至少一个配件');
      return;
    }

    const payload: Record<string, any> = { ids: ids.value };
    const warehouseIds = canStockDistribute.value
      ? (formData.value.warehouseIds || []).filter(
          (id) => id !== undefined && id !== null,
        )
      : [];
    (Object.keys(formData.value) as (keyof BatchEditFormData)[]).forEach(
      (key) => {
        if (key === 'warehouseIds') {
          return;
        }
        if (isHidden(key)) {
          return;
        }
        const value = formData.value[key];
        if (value !== undefined && value !== null && value !== '') {
          payload[key] = value;
        }
      },
    );
    const hasProductFields = Object.keys(payload).length > 1;
    const hasStockDistribution = warehouseIds.length > 0;
    if (!hasProductFields && !hasStockDistribution) {
      message.warning('请至少修改一个字段');
      return;
    }

    modalApi.lock();
    try {
      if (hasProductFields) {
        await batchUpdateProduct(payload as any);
      }
      if (hasStockDistribution) {
        await batchUpdateProductStockDistribution({
          productIds: ids.value,
          warehouseIds,
        });
      }
      await modalApi.close();
      emit('success');
      message.success(`已批量更新 ${ids.value.length} 个配件`);
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      formData.value = {};
      ids.value = [];
      return;
    }
    const data = modalApi.getData<{ ids: number[] }>();
    ids.value = data?.ids || [];
    formData.value = {};
    await Promise.all([loadOptions(), loadHiddenFields()]);
  },
});
</script>

<template>
  <Modal :title="`批量修改配件（已选 ${ids.length} 个）`" class="w-[600px]">
    <AForm
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 16 }"
      class="mx-4 my-4"
    >
      <p class="mb-4 text-gray-500">
        只填写需要批量修改的字段，留空代表不修改。
      </p>
      <FormItem v-if="!isHidden('categoryId')" label="配件分类">
        <TreeSelect
          v-model:value="formData.categoryId"
          :tree-data="categoryTreeData"
          :field-names="{ label: 'name', value: 'id', children: 'children' }"
          allow-clear
          show-search
          tree-node-filter-prop="name"
          tree-default-expand-all
          placeholder="请选择配件分类"
          class="w-full"
        />
      </FormItem>
      <FormItem v-if="!isHidden('unitId')" label="单位">
        <Select
          v-model:value="formData.unitId"
          :filter-option="filterSelectOption"
          :options="unitOptions"
          allow-clear
          show-search
          placeholder="请选择单位"
          class="w-full"
        />
      </FormItem>
      <FormItem v-if="!isHidden('defaultWarehouseId')" label="默认仓库">
        <Select
          v-model:value="formData.defaultWarehouseId"
          :filter-option="filterSelectOption"
          :options="warehouseOptions"
          allow-clear
          show-search
          placeholder="请选择默认仓库"
          class="w-full"
        />
      </FormItem>
      <FormItem v-if="canStockDistribute" label="库存分发仓库">
        <Select
          v-model:value="formData.warehouseIds"
          :filter-option="filterSelectOption"
          :options="warehouseOptions"
          allow-clear
          mode="multiple"
          show-search
          placeholder="请选择需要分发到的仓库"
          class="w-full"
        >
          <template #dropdownRender="{ menuNode: menu }">
            <div class="border-b px-3 py-2">
              <Checkbox
                :checked="allWarehousesSelected"
                :disabled="warehouseOptions.length === 0"
                :indeterminate="someWarehousesSelected"
                @change="(event) => toggleAllWarehouses(event.target.checked)"
              >
                全选仓库
              </Checkbox>
            </div>
            <component :is="menu" />
          </template>
        </Select>
      </FormItem>
      <FormItem v-if="!isHidden('status')" label="状态">
        <RadioGroup v-model:value="formData.status">
          <Radio :value="0">启用</Radio>
          <Radio :value="1">禁用</Radio>
        </RadioGroup>
      </FormItem>
      <FormItem v-if="!isHidden('remark')" label="备注">
        <Input.TextArea
          v-model:value="formData.remark"
          :rows="3"
          placeholder="留空表示不修改"
        />
      </FormItem>
    </AForm>
  </Modal>
</template>
