<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseOrderApi } from '#/api/erp/purchase/order';

import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Input, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getPurchaseOrderPage } from '#/api/erp/purchase/order';
import { isFormInputTarget } from '#/views/erp/purchase/utils/item-form';

import { useOrderGridColumns, useOrderGridFormSchema } from '../data';

const props = defineProps({
  orderNo: {
    type: String,
    default: () => undefined,
  },
  supplierId: {
    type: Number,
    default: () => undefined,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits<{
  'update:order': [order: ErpPurchaseOrderApi.PurchaseOrder];
}>();

const order = ref<ErpPurchaseOrderApi.PurchaseOrder>(); // 选择的采购订单
const open = ref<boolean>(false); // 选择采购订单弹窗是否打开

function normalizeSearchParams(values: Record<string, any>) {
  const params = { ...values };
  if (typeof params.no === 'string') {
    const normalized = params.no.trim().replace(/\s+/g, '%');
    params.no = normalized || undefined;
  }
  return params;
}

/** 表格配置 */
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useOrderGridFormSchema({ supplierLocked: true }),
  },
  gridOptions: {
    columns: useOrderGridColumns(),
    height: '100%',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues = {}) => {
          const querySupplierId = props.supplierId ?? formValues.supplierId;
          return await getPurchaseOrderPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            inEnable: true,
            ...normalizeSearchParams(formValues),
            supplierId: querySupplierId,
          });
        },
      },
    },
    rowConfig: {
      keyField: 'id',
      isHover: true,
    },
    radioConfig: {
      trigger: 'row',
      highlight: true,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpPurchaseOrderApi.PurchaseOrder>,
  gridEvents: {
    radioChange: ({ row }: { row: ErpPurchaseOrderApi.PurchaseOrder }) => {
      handleSelectOrder(row);
    },
  },
});

/** 选择采购订单 */
function handleSelectOrder(selectOrder: ErpPurchaseOrderApi.PurchaseOrder) {
  order.value = selectOrder;
}

/** 确认选择采购订单 */
function handleOk() {
  if (!order.value) {
    message.warning('请选择一个采购订单');
    return;
  }
  emit('update:order', order.value);
  open.value = false;
}

async function openOrderSelect() {
  if (props.disabled) {
    return;
  }
  if (!props.supplierId) {
    message.warning('请先选择供应商');
    return;
  }
  open.value = true;
}

async function syncLockedSupplier() {
  if (props.supplierId === undefined) {
    return;
  }
  await gridApi.formApi?.setValues({ supplierId: props.supplierId });
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (!open.value || event.key !== 'Enter' || event.defaultPrevented) {
    return;
  }
  if (isFormInputTarget(event.target)) {
    return;
  }
  event.preventDefault();
  handleOk();
}

watch(open, async (visible) => {
  if (visible) {
    await syncLockedSupplier();
    await nextTick();
    await gridApi.query();
    window.addEventListener('keydown', handleWindowKeydown);
  } else {
    window.removeEventListener('keydown', handleWindowKeydown);
  }
});

watch(
  () => props.supplierId,
  async () => {
    order.value = undefined;
    if (!open.value) {
      return;
    }
    await syncLockedSupplier();
    await gridApi.query();
  },
);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown);
});
</script>

<template>
  <div class="w-full">
    <Input
      class="w-full"
      readonly
      :value="orderNo"
      :disabled="disabled"
      @click="openOrderSelect"
    >
      <template #addonAfter>
        <div>
          <IconifyIcon
            class="h-full w-6 cursor-pointer"
            icon="ant-design:setting-outlined"
            :style="{
              cursor: disabled || !supplierId ? 'not-allowed' : 'pointer',
            }"
            @click.stop="openOrderSelect"
          />
        </div>
      </template>
    </Input>
    <Modal
      class="!w-[85vw]"
      v-model:open="open"
      title="选择关联订单"
      @ok="handleOk"
    >
      <Grid class="h-[70vh]" table-title="采购订单列表(仅展示可退货)" />
    </Modal>
  </div>
</template>
