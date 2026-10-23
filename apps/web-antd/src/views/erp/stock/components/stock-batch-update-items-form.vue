<script lang="ts" setup>
import { computed, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Form as AForm, FormItem, message, Select } from 'ant-design-vue';

import {
  batchUpdateStockCheckItems,
  getStockCheckWarehouseDeptSimpleList,
} from '#/api/erp/stock/check';
import {
  batchUpdateStockInItems,
  getStockInWarehouseDeptSimpleList,
} from '#/api/erp/stock/in';
import {
  batchUpdateStockOutItems,
  getStockOutWarehouseDeptSimpleList,
} from '#/api/erp/stock/out';
import { getStockWarehouseSimpleList } from '#/api/erp/stock/warehouse';
import { isFieldHidden } from '#/composables/useFieldPermission';

const emit = defineEmits(['success']);

type StockBatchDocumentType = 'check' | 'in' | 'out';

interface ModalData {
  documentId?: number;
  documentType?: StockBatchDocumentType;
  hiddenFields?: string[];
  itemCount?: number;
  itemIds?: number[];
}

interface BatchUpdateItemsData {
  warehouseId?: number;
}

interface BatchUpdateItemsPayload {
  warehouse?: any;
  warehouseId?: number;
}

const DOCUMENT_LABEL: Record<StockBatchDocumentType, string> = {
  check: '库存盘点',
  in: '其它入库',
  out: '其它出库',
};

const documentId = ref<number>();
const documentType = ref<StockBatchDocumentType>('in');
const hiddenFields = ref<string[]>([]);
const itemCount = ref(0);
const itemIds = ref<number[]>([]);
const formData = ref<BatchUpdateItemsData>({});
const warehouseOptions = ref<any[]>([]);
const warehouseDeptCount = ref(0);
const warehouseDeptLoading = ref(false);
let warehouseDeptRequestSeq = 0;

const canEditWarehouse = computed(
  () => !isFieldHidden(hiddenFields.value, 'item_warehouseId'),
);
const selectedCount = computed(() => itemIds.value.length || itemCount.value);
const title = computed(
  () =>
    `批量修改${DOCUMENT_LABEL[documentType.value]}明细仓库/部门（已选 ${selectedCount.value} 条）`,
);

function filterSelectOption(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  const label = String(option?.label ?? option?.name ?? option?.title ?? '');
  return label.toLowerCase().includes(keyword);
}

function getWarehouseDeptSimpleList(
  warehouseId: number,
  currentDocumentType = documentType.value,
) {
  if (currentDocumentType === 'out') {
    return getStockOutWarehouseDeptSimpleList(warehouseId);
  }
  if (currentDocumentType === 'check') {
    return getStockCheckWarehouseDeptSimpleList(warehouseId);
  }
  return getStockInWarehouseDeptSimpleList(warehouseId);
}

function submitBatchUpdate(
  payload: { itemIds: number[]; warehouseId: number },
  currentDocumentType = documentType.value,
  currentDocumentId = documentId.value,
) {
  if (!currentDocumentId) return Promise.resolve();
  if (currentDocumentType === 'out') {
    return batchUpdateStockOutItems({ ...payload, outId: currentDocumentId });
  }
  if (currentDocumentType === 'check') {
    return batchUpdateStockCheckItems({
      ...payload,
      checkId: currentDocumentId,
    });
  }
  return batchUpdateStockInItems({ ...payload, inId: currentDocumentId });
}

async function loadOptions() {
  warehouseOptions.value = (await getStockWarehouseSimpleList()) || [];
}

async function loadWarehouseDeptOptions(warehouseId?: number) {
  const requestSeq = ++warehouseDeptRequestSeq;
  warehouseDeptCount.value = 0;
  if (!warehouseId) {
    return;
  }

  warehouseDeptLoading.value = true;
  try {
    const departments = await getWarehouseDeptSimpleList(warehouseId);
    if (requestSeq !== warehouseDeptRequestSeq) {
      return;
    }
    warehouseDeptCount.value = departments?.length || 0;
  } finally {
    if (requestSeq === warehouseDeptRequestSeq) {
      warehouseDeptLoading.value = false;
    }
  }
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const currentDocumentId = documentId.value;
    const currentDocumentType = documentType.value;
    const currentItemIds = [...itemIds.value];
    const currentSelectedCount = currentItemIds.length || itemCount.value;
    const currentWarehouseId = formData.value.warehouseId;
    const currentIsLocalMode = !currentDocumentId;

    if (currentSelectedCount === 0) {
      message.warning('请先勾选需要批量调整的库存明细');
      return;
    }
    if (!canEditWarehouse.value) {
      message.warning('当前账号没有明细仓库字段权限，不能批量调整');
      return;
    }
    if (!currentWarehouseId) {
      message.warning('请选择目标仓库');
      return;
    }
    if (warehouseDeptLoading.value) {
      message.warning('目标仓库部门信息加载中，请稍后再提交');
      return;
    }
    if (warehouseDeptCount.value === 0) {
      message.warning('目标仓库没有当前账号可用部门，不能批量调整');
      return;
    }
    const warehouse = warehouseOptions.value.find(
      (item) => item.id === currentWarehouseId,
    );
    if (!warehouse) {
      message.warning('目标仓库不存在，请重新选择');
      return;
    }

    modalApi.lock();
    try {
      const payload: BatchUpdateItemsPayload = {
        warehouse,
        warehouseId: currentWarehouseId,
      };
      if (currentIsLocalMode) {
        await modalApi.close();
        emit('success', payload);
        return;
      }
      await submitBatchUpdate(
        {
          itemIds: currentItemIds,
          warehouseId: currentWarehouseId,
        },
        currentDocumentType,
        currentDocumentId,
      );
      await modalApi.close();
      emit('success', payload);
      message.success(`已批量更新 ${currentSelectedCount} 条库存明细`);
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      documentId.value = undefined;
      documentType.value = 'in';
      hiddenFields.value = [];
      itemCount.value = 0;
      itemIds.value = [];
      formData.value = {};
      warehouseDeptCount.value = 0;
      warehouseDeptRequestSeq++;
      return;
    }
    const data = modalApi.getData<ModalData>();
    documentId.value = data?.documentId;
    documentType.value = data?.documentType || 'in';
    hiddenFields.value = data?.hiddenFields || [];
    itemCount.value = data?.itemCount || 0;
    itemIds.value = data?.itemIds || [];
    formData.value = {};
    await loadOptions();
  },
});

watch(
  () => formData.value.warehouseId,
  (warehouseId) => {
    void loadWarehouseDeptOptions(warehouseId);
  },
);
</script>

<template>
  <Modal :title="title" class="w-[520px]">
    <AForm
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 16 }"
      class="mx-4 my-4"
    >
      <FormItem v-if="canEditWarehouse" label="仓库">
        <Select
          v-model:value="formData.warehouseId"
          :field-names="{ label: 'name', value: 'id' }"
          :filter-option="filterSelectOption"
          :loading="warehouseDeptLoading"
          :options="warehouseOptions"
          allow-clear
          show-search
          placeholder="请选择目标仓库"
          popup-class-name="stock-document-item-select-dropdown erp-candidate-focus-popup"
          class="w-full"
        />
      </FormItem>
    </AForm>
  </Modal>
</template>
