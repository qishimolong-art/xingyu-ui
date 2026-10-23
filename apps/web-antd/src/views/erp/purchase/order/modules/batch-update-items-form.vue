<script lang="ts" setup>
import '#/views/erp/purchase/utils/candidate-focus';
import { computed, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Form as AForm, FormItem, message } from 'ant-design-vue';

import {
  batchUpdatePurchaseOrderItems,
  getPurchaseOrderDeptSimplePage,
  getPurchaseOrderWarehouseDeptSimplePage,
} from '#/api/erp/purchase/order';
import { getPurchaseWarehouseSimplePage } from '#/api/erp/stock/warehouse';
import { isFieldHidden } from '#/composables/useFieldPermission';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';

const emit = defineEmits(['success']);

interface BatchUpdateItemsData {
  deptId?: number;
  warehouseId?: number;
}

type BatchUpdateMode = 'local' | 'server';

const orderId = ref<number>();
const itemIds = ref<number[]>([]);
const itemCount = ref(0);
const mode = ref<BatchUpdateMode>('server');
const hiddenFields = ref<string[]>([]);
const formData = ref<BatchUpdateItemsData>({});
const warehouseOptions = ref<any[]>([]);
const warehouseDeptIds = ref<Set<number>>(new Set());
const warehouseDeptTotal = ref(0);
let warehouseDeptRequestSeq = 0;

const canEditWarehouse = computed(
  () => !isFieldHidden(hiddenFields.value, 'item_warehouseId'),
);
const canEditDept = computed(
  () => !isFieldHidden(hiddenFields.value, 'item_deptId'),
);
const selectedCount = computed(() =>
  mode.value === 'local' ? itemCount.value : itemIds.value.length,
);

function mergeOptionsById(oldOptions: any[], nextOptions: any[]) {
  const map = new Map<string, any>();
  (oldOptions || []).forEach(
    (item) => item?.id && map.set(String(item.id), item),
  );
  (nextOptions || []).forEach(
    (item) => item?.id && map.set(String(item.id), item),
  );
  return Array.from(map.values());
}

function handleWarehouseOptionsChange(options: any[]) {
  warehouseOptions.value = mergeOptionsById(warehouseOptions.value, options);
}

function loadDeptSimplePage(params: Record<string, any>) {
  const { warehouseId, ...rest } = params || {};
  return warehouseId
    ? getPurchaseOrderWarehouseDeptSimplePage({ ...rest, warehouseId })
    : getPurchaseOrderDeptSimplePage(rest as any);
}

async function loadWarehouseDeptOptions(warehouseId?: number) {
  const requestSeq = ++warehouseDeptRequestSeq;
  warehouseDeptIds.value = new Set();
  warehouseDeptTotal.value = 0;

  if (!warehouseId) {
    return;
  }

  const page = await getPurchaseOrderWarehouseDeptSimplePage({
    pageNo: 1,
    pageSize: 10,
    warehouseId,
  });
  if (requestSeq !== warehouseDeptRequestSeq) {
    return;
  }
  const departments = page?.list || [];
  warehouseDeptIds.value = new Set(departments.map((dept: any) => dept.id));
  warehouseDeptTotal.value = Number(page?.total || 0);
  if (
    formData.value.deptId &&
    warehouseDeptTotal.value <= departments.length &&
    !warehouseDeptIds.value.has(formData.value.deptId)
  ) {
    formData.value.deptId = undefined;
  }
  if (warehouseDeptTotal.value === 1 && canEditDept.value) {
    formData.value.deptId = departments[0]?.id;
  }
}

function getSingleWarehouseDeptId() {
  return warehouseDeptTotal.value === 1
    ? [...warehouseDeptIds.value][0]
    : undefined;
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (
      (mode.value === 'server' &&
        (!orderId.value || itemIds.value.length === 0)) ||
      (mode.value === 'local' && itemCount.value === 0)
    ) {
      message.warning('请先勾选需要批量修改的采购明细');
      return;
    }

    const currentMode = mode.value;
    const currentOrderId = orderId.value;
    const currentItemIds = [...itemIds.value];
    const currentSelectedCount = selectedCount.value;
    const payload = {
      orderId: currentOrderId,
      itemIds: currentItemIds,
      warehouseId: canEditWarehouse.value
        ? formData.value.warehouseId
        : undefined,
      deptId: canEditDept.value
        ? formData.value.deptId
        : getSingleWarehouseDeptId(),
    };

    if (!payload.warehouseId && !payload.deptId) {
      message.warning('请至少选择仓库或部门');
      return;
    }
    if (payload.warehouseId) {
      if (warehouseDeptTotal.value === 0) {
        message.warning('目标仓库没有可用部门，不能批量修改');
        return;
      }
      if (!canEditDept.value && warehouseDeptTotal.value !== 1) {
        message.warning(
          '目标仓库可用部门不唯一，当前无部门字段权限，不能批量修改',
        );
        return;
      }
      if (
        canEditDept.value &&
        warehouseDeptTotal.value > 1 &&
        !payload.deptId
      ) {
        message.warning('目标仓库可用部门不唯一，请选择部门');
        return;
      }
      if (
        payload.deptId &&
        warehouseDeptTotal.value <= warehouseDeptIds.value.size &&
        !warehouseDeptIds.value.has(payload.deptId)
      ) {
        message.warning('所选部门不属于目标仓库可用部门');
        return;
      }
    }

    modalApi.lock();
    try {
      if (currentMode === 'server') {
        await batchUpdatePurchaseOrderItems({
          orderId: currentOrderId!,
          itemIds: currentItemIds,
          warehouseId: payload.warehouseId,
          deptId: payload.deptId,
        });
      }
      await modalApi.close();
      emit('success', {
        deptId: payload.deptId,
        mode: currentMode,
        warehouseId: payload.warehouseId,
      });
      if (currentMode === 'server') {
        message.success(`已批量更新 ${currentSelectedCount} 条采购明细`);
      }
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      formData.value = {};
      itemIds.value = [];
      itemCount.value = 0;
      mode.value = 'server';
      orderId.value = undefined;
      hiddenFields.value = [];
      warehouseDeptIds.value = new Set();
      warehouseDeptTotal.value = 0;
      warehouseDeptRequestSeq++;
      return;
    }
    const data = modalApi.getData<{
      hiddenFields?: string[];
      itemCount?: number;
      itemIds?: number[];
      mode?: BatchUpdateMode;
      orderId?: number;
    }>();
    mode.value = data?.mode || 'server';
    orderId.value = data?.orderId;
    itemIds.value = data?.itemIds || [];
    itemCount.value = data?.itemCount ?? itemIds.value.length;
    hiddenFields.value = data?.hiddenFields || [];
    formData.value = {};
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
  <Modal
    :title="`批量修改采购明细（已选 ${selectedCount} 条）`"
    class="w-[560px]"
  >
    <AForm
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 16 }"
      class="mx-4 my-4"
    >
      <FormItem v-if="canEditWarehouse" label="仓库">
        <ErpLazyPageSelect
          v-model:value="formData.warehouseId"
          :api="getPurchaseWarehouseSimplePage"
          :options="warehouseOptions"
          label-field="name"
          value-field="id"
          :page-size="10"
          allow-clear
          placeholder="请选择仓库"
          popup-class-name="purchase-document-item-select-dropdown erp-candidate-focus-popup"
          class="w-full"
          @options-change="handleWarehouseOptionsChange"
        />
      </FormItem>
      <FormItem v-if="canEditDept" label="部门">
        <ErpLazyPageSelect
          v-model:value="formData.deptId"
          :api="loadDeptSimplePage"
          :params="{ warehouseId: formData.warehouseId }"
          label-field="name"
          value-field="id"
          :page-size="10"
          allow-clear
          :disabled="Boolean(formData.warehouseId) && warehouseDeptTotal === 0"
          placeholder="请选择部门"
          popup-class-name="purchase-document-item-select-dropdown erp-candidate-focus-popup"
          class="w-full"
        />
      </FormItem>
    </AForm>
  </Modal>
</template>
