<script lang="ts" setup>
import { useCandidatePopupClass } from '#/views/erp/utils/candidate-focus';
import { computed, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Form as AForm, FormItem, message } from 'ant-design-vue';

import {
  batchUpdateSaleCartItems,
  getSaleCartDeptSimplePage,
  getSaleCartWarehouseDeptSimplePage,
} from '#/api/erp/sale/cart';
import { getSaleOrderDeptSimplePage } from '#/api/erp/sale/order';
import {
  batchUpdateSaleQuoteItems,
  getSaleQuoteDeptSimplePage,
  getSaleQuoteWarehouseDeptSimplePage,
} from '#/api/erp/sale/quote';
import {
  batchUpdateSaleReturnItems,
  getSaleReturnDeptSimplePage,
  getSaleReturnWarehouseDeptSimplePage,
} from '#/api/erp/sale/return';
import { getSaleWarehouseSimplePage } from '#/api/erp/stock/warehouse';
import { isFieldHidden } from '#/composables/useFieldPermission';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';

const candidatePopupClass = useCandidatePopupClass();

const emit = defineEmits(['success']);

type SaleBatchDocumentType = 'cart' | 'order' | 'quote' | 'return';
type BatchUpdateMode = 'local' | 'server';

interface BatchUpdateItemsData {
  deptId?: number;
  warehouseId?: number;
}

interface ModalData {
  documentId?: number;
  documentType?: SaleBatchDocumentType;
  hiddenFields?: string[];
  itemCount?: number;
  itemIds?: number[];
  mode?: BatchUpdateMode;
  warehouseReadonly?: boolean;
}

const DOCUMENT_LABEL: Record<SaleBatchDocumentType, string> = {
  cart: '销售手推车',
  order: '销售订单',
  quote: '报价订单',
  return: '销售退货',
};

const documentId = ref<number>();
const documentType = ref<SaleBatchDocumentType>('quote');
const itemCount = ref(0);
const itemIds = ref<number[]>([]);
const mode = ref<BatchUpdateMode>('server');
const hiddenFields = ref<string[]>([]);
const formData = ref<BatchUpdateItemsData>({});
const warehouseOptions = ref<any[]>([]);
const warehouseDeptIds = ref<Set<number>>(new Set());
const warehouseDeptTotal = ref(0);
const warehouseReadonly = ref(false);
let warehouseDeptRequestSeq = 0;

const canEditWarehouse = computed(
  () =>
    !warehouseReadonly.value &&
    !isFieldHidden(hiddenFields.value, 'item_warehouseId'),
);
const canEditDept = computed(
  () => !isFieldHidden(hiddenFields.value, 'item_deptId'),
);
const selectedCount = computed(() =>
  mode.value === 'server' ? itemIds.value.length : itemCount.value,
);
const title = computed(
  () =>
    `批量修改${DOCUMENT_LABEL[documentType.value]}明细（已选 ${selectedCount.value} 条）`,
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

function getOptionsSignature(options: any[]) {
  return (options || [])
    .map((item) =>
      JSON.stringify({
        id: item?.id ?? item?.value ?? '',
        name: item?.name ?? item?.label ?? '',
      }),
    )
    .join('|');
}

function handleWarehouseOptionsChange(options: any[]) {
  const nextOptions = mergeOptionsById(warehouseOptions.value, options);
  if (
    getOptionsSignature(nextOptions) !==
    getOptionsSignature(warehouseOptions.value)
  ) {
    warehouseOptions.value = nextOptions;
  }
}

function getDeptSimplePage(params: Record<string, any>) {
  const { warehouseId, ...rest } = params || {};
  if (!warehouseId) {
    if (documentType.value === 'order') {
      return getSaleOrderDeptSimplePage(rest as any);
    }
    if (documentType.value === 'cart') {
      return getSaleCartDeptSimplePage(rest as any);
    }
    if (documentType.value === 'return') {
      return getSaleReturnDeptSimplePage(rest as any);
    }
    return getSaleQuoteDeptSimplePage(rest as any);
  }
  if (documentType.value === 'order') {
    const warehouse = warehouseOptions.value.find(
      (item) => item.id === warehouseId,
    );
    return Promise.resolve(
      warehouse?.deptId
        ? {
            list: [
              {
                id: warehouse.deptId,
                name: warehouse.deptName || String(warehouse.deptId),
              },
            ],
            total: 1,
          }
        : { list: [], total: 0 },
    );
  }
  if (documentType.value === 'cart') {
    return getSaleCartWarehouseDeptSimplePage({ ...rest, warehouseId });
  }
  if (documentType.value === 'return') {
    return getSaleReturnWarehouseDeptSimplePage({ ...rest, warehouseId });
  }
  return getSaleQuoteWarehouseDeptSimplePage({ ...rest, warehouseId });
}

function getSingleWarehouseDeptId() {
  return warehouseDeptTotal.value === 1
    ? [...warehouseDeptIds.value][0]
    : undefined;
}

function submitBatchUpdate(
  payload: {
    deptId?: number;
    itemIds: number[];
    warehouseId?: number;
  },
  currentDocumentType = documentType.value,
  currentDocumentId = documentId.value,
) {
  if (!currentDocumentId) return Promise.resolve();
  if (currentDocumentType === 'cart') {
    return batchUpdateSaleCartItems({ ...payload, cartId: currentDocumentId });
  }
  if (currentDocumentType === 'return') {
    return batchUpdateSaleReturnItems({
      ...payload,
      returnId: currentDocumentId,
    });
  }
  return batchUpdateSaleQuoteItems({ ...payload, quoteId: currentDocumentId });
}

async function loadWarehouseDeptOptions(warehouseId?: number) {
  const requestSeq = ++warehouseDeptRequestSeq;
  warehouseDeptIds.value = new Set();
  warehouseDeptTotal.value = 0;

  if (!warehouseId) {
    return;
  }

  const page = await getDeptSimplePage({
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

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const currentMode = mode.value;
    const currentDocumentId = documentId.value;
    const currentDocumentType = documentType.value;
    const currentItemIds = [...itemIds.value];
    const currentSelectedCount =
      currentMode === 'server' ? currentItemIds.length : itemCount.value;

    if (
      currentMode === 'server' &&
      (!currentDocumentId || currentItemIds.length === 0)
    ) {
      message.warning('请先勾选需要批量修改的销售明细');
      return;
    }
    if (currentMode === 'local' && currentSelectedCount === 0) {
      message.warning('请先勾选需要批量修改的销售明细');
      return;
    }

    const payload = {
      itemIds: currentItemIds,
      warehouseId: canEditWarehouse.value
        ? formData.value.warehouseId
        : undefined,
      deptId: canEditDept.value
        ? formData.value.deptId
        : formData.value.warehouseId
          ? getSingleWarehouseDeptId()
          : undefined,
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
        await submitBatchUpdate(
          payload,
          currentDocumentType,
          currentDocumentId,
        );
      }
      await modalApi.close();
      emit('success', {
        deptId: payload.deptId,
        mode: currentMode,
        warehouseId: payload.warehouseId,
      });
      if (currentMode === 'server') {
        message.success(`已批量更新 ${currentSelectedCount} 条销售明细`);
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
      documentId.value = undefined;
      hiddenFields.value = [];
      warehouseDeptIds.value = new Set();
      warehouseDeptTotal.value = 0;
      warehouseReadonly.value = false;
      warehouseDeptRequestSeq++;
      return;
    }
    const data = modalApi.getData<ModalData>();
    documentId.value = data?.documentId;
    documentType.value = data?.documentType || 'quote';
    itemCount.value = data?.itemCount || 0;
    itemIds.value = data?.itemIds || [];
    mode.value = data?.mode || 'server';
    hiddenFields.value = data?.hiddenFields || [];
    warehouseReadonly.value = Boolean(data?.warehouseReadonly);
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
  <Modal :title="title" class="w-[560px]">
    <AForm
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 16 }"
      class="mx-4 my-4"
    >
      <FormItem v-if="canEditWarehouse" label="仓库">
        <ErpLazyPageSelect
          v-model:value="formData.warehouseId"
          :api="getSaleWarehouseSimplePage"
          :options="warehouseOptions"
          label-field="name"
          value-field="id"
          :page-size="10"
          allow-clear
          placeholder="请选择仓库"
          :popup-class-name="
            candidatePopupClass('sale-document-item-select-dropdown')
          "
          class="w-full"
          @options-change="handleWarehouseOptionsChange"
        />
      </FormItem>
      <FormItem v-if="canEditDept" label="部门">
        <ErpLazyPageSelect
          v-model:value="formData.deptId"
          :api="getDeptSimplePage"
          :params="{ warehouseId: formData.warehouseId }"
          label-field="name"
          value-field="id"
          :page-size="10"
          allow-clear
          :disabled="Boolean(formData.warehouseId) && warehouseDeptTotal === 0"
          placeholder="请选择部门"
          :popup-class-name="
            candidatePopupClass('sale-document-item-select-dropdown')
          "
          class="w-full"
        />
      </FormItem>
    </AForm>
  </Modal>
</template>
