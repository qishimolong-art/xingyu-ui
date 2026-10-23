<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import {
  Form as AForm,
  FormItem,
  message,
  RadioGroup,
  Select,
} from 'ant-design-vue';

import {
  getStockMoveFromWarehouseSimpleList,
  getWarehouseSimpleList,
} from '#/api/erp/stock/warehouse';
import { isFieldHidden } from '#/composables/useFieldPermission';

const emit = defineEmits(['success']);

type TransferOutBatchSide = 'from' | 'to';

interface ModalData {
  hiddenFields?: string[];
  itemCount?: number;
}

interface BatchUpdateItemsData {
  side?: TransferOutBatchSide;
  warehouseId?: number;
}

const itemCount = ref(0);
const hiddenFields = ref<string[]>([]);
const formData = ref<BatchUpdateItemsData>({});
const fromWarehouseOptions = ref<any[]>([]);
const toWarehouseOptions = ref<any[]>([]);
const loading = ref(false);

const canEditFromWarehouse = computed(
  () => !isFieldHidden(hiddenFields.value, 'item_fromWarehouseId'),
);
const canEditToWarehouse = computed(
  () => !isFieldHidden(hiddenFields.value, 'item_toWarehouseId'),
);
const sideOptions = computed(() => {
  const options: Array<{ label: string; value: TransferOutBatchSide }> = [];
  if (canEditFromWarehouse.value) {
    options.push({ label: '调出仓库/部门', value: 'from' });
  }
  if (canEditToWarehouse.value) {
    options.push({ label: '调入仓库/部门', value: 'to' });
  }
  return options;
});
const warehouseOptions = computed(() =>
  formData.value.side === 'from'
    ? fromWarehouseOptions.value
    : toWarehouseOptions.value,
);
const title = computed(
  () => `批量修改调拨出库明细（已选 ${itemCount.value} 条）`,
);

function filterSelectOption(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  const label = String(option?.label ?? option?.name ?? option?.title ?? '');
  return label.toLowerCase().includes(keyword);
}

async function loadOptions() {
  loading.value = true;
  try {
    [fromWarehouseOptions.value, toWarehouseOptions.value] = await Promise.all([
      getStockMoveFromWarehouseSimpleList(),
      getWarehouseSimpleList(),
    ]);
  } finally {
    loading.value = false;
  }
}

watch(
  () => formData.value.side,
  () => {
    formData.value.warehouseId = undefined;
  },
);

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const currentItemCount = itemCount.value;
    const currentSide = formData.value.side;
    const currentWarehouseId = formData.value.warehouseId;

    if (currentItemCount === 0) {
      message.warning('请先勾选需要批量修改的调拨出库明细');
      return;
    }
    if (!currentSide) {
      message.warning('请选择需要修改的仓库方向');
      return;
    }
    if (!currentWarehouseId) {
      message.warning('请选择目标仓库');
      return;
    }
    const currentWarehouseOptions =
      currentSide === 'from'
        ? fromWarehouseOptions.value
        : toWarehouseOptions.value;
    const warehouse = currentWarehouseOptions.find(
      (item) => item.id === currentWarehouseId,
    );
    if (!warehouse) {
      message.warning('目标仓库不存在，请重新选择');
      return;
    }
    const payload = {
      side: currentSide,
      warehouse,
      warehouseId: currentWarehouseId,
    };
    await modalApi.close();
    emit('success', payload);
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      itemCount.value = 0;
      hiddenFields.value = [];
      formData.value = {};
      return;
    }
    const data = modalApi.getData<ModalData>();
    itemCount.value = data?.itemCount || 0;
    hiddenFields.value = data?.hiddenFields || [];
    formData.value = {
      side: canEditFromWarehouse.value ? 'from' : 'to',
    };
    await loadOptions();
  },
});
</script>

<template>
  <Modal :title="title" class="w-[560px]">
    <AForm
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 16 }"
      class="mx-4 my-4"
    >
      <FormItem label="修改字段">
        <RadioGroup
          v-model:value="formData.side"
          :options="sideOptions"
          option-type="button"
          button-style="solid"
        />
      </FormItem>
      <FormItem label="目标仓库">
        <Select
          v-model:value="formData.warehouseId"
          :field-names="{ label: 'name', value: 'id' }"
          :filter-option="filterSelectOption"
          :loading="loading"
          :options="warehouseOptions"
          allow-clear
          show-search
          placeholder="请选择目标仓库"
          popup-class-name="transfer-out-item-select-dropdown erp-candidate-focus-popup"
          class="w-full"
        />
      </FormItem>
    </AForm>
  </Modal>
</template>
