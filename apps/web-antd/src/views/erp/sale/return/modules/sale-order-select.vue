<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpSaleOrderApi } from '#/api/erp/sale/order';

import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Input, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getSaleOrderPage } from '#/api/erp/sale/order';
import { applySaleSelectColumnPermission } from '#/views/erp/sale/utils/field-permission';
import { shouldConfirmOnEnter } from '#/views/erp/sale/utils/keyboard';

import { useOrderGridColumns, useOrderGridFormSchema } from '../data';

interface Props {
  customerId?: number;
  disabled?: boolean;
  hiddenFields?: string[];
  orderNo?: string;
}

const props = withDefaults(defineProps<Props>(), {
  customerId: undefined,
  disabled: false,
  hiddenFields: () => [],
  orderNo: undefined,
});

const emit = defineEmits<{
  'update:order': [order: ErpSaleOrderApi.SaleOrder];
}>();

const order = ref<ErpSaleOrderApi.SaleOrder>(); // 选择的销售订单
const open = ref<boolean>(false); // 选择销售订单弹窗是否打开
const orderColumns = useOrderGridColumns();
let isEnterListening = false;

/** 表格配置 */
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useOrderGridFormSchema(),
  },
  gridOptions: {
    columns: applySaleSelectColumnPermission(
      orderColumns || [],
      props.hiddenFields,
    ),
    height: '100%',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues = {}) => {
          const queryCustomerId = props.customerId ?? formValues.customerId;
          return await getSaleOrderPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            returnEnable: true,
            ...formValues,
            customerId: queryCustomerId,
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
  } as VxeTableGridOptions<ErpSaleOrderApi.SaleOrder>,
  gridEvents: {
    radioChange: ({ row }: { row: ErpSaleOrderApi.SaleOrder }) => {
      handleSelectOrder(row);
    },
  },
});

watch(
  () => props.hiddenFields,
  async (hiddenFields) => {
    await gridApi.grid.reloadColumn(
      applySaleSelectColumnPermission(orderColumns || [], hiddenFields) || [],
    );
  },
);

watch(open, async (visible) => {
  if (visible) {
    await syncLockedCustomer();
    await nextTick();
    await gridApi.query();
    startEnterListening();
  } else {
    stopEnterListening();
  }
});

watch(
  () => props.customerId,
  async () => {
    if (!open.value) return;
    order.value = undefined;
    await syncLockedCustomer();
    await gridApi.query();
  },
);

async function syncLockedCustomer() {
  if (props.customerId === undefined) {
    return;
  }
  await gridApi.formApi?.setValues({ customerId: props.customerId });
}

/** 选择销售订单 */
function handleSelectOrder(selectOrder: ErpSaleOrderApi.SaleOrder) {
  order.value = selectOrder;
}

/** 确认选择销售订单 */
function handleOk() {
  if (!order.value) {
    message.warning('请选择一个销售订单');
    return;
  }
  emit('update:order', order.value);
  open.value = false;
}

function handleEnterConfirm(event: KeyboardEvent) {
  if (!shouldConfirmOnEnter(event, open.value && Boolean(order.value))) {
    return;
  }
  event.preventDefault();
  handleOk();
}

function startEnterListening() {
  if (isEnterListening) {
    return;
  }
  window.addEventListener('keydown', handleEnterConfirm);
  isEnterListening = true;
}

function stopEnterListening() {
  if (!isEnterListening) {
    return;
  }
  window.removeEventListener('keydown', handleEnterConfirm);
  isEnterListening = false;
}

onBeforeUnmount(stopEnterListening);
</script>

<template>
  <div>
    <Input
      readonly
      :value="orderNo"
      :disabled="disabled"
      @click="() => !disabled && (open = true)"
    >
      <template #addonAfter>
        <div>
          <IconifyIcon
            class="h-full w-6 cursor-pointer"
            icon="ant-design:setting-outlined"
            :style="{ cursor: disabled ? 'not-allowed' : 'pointer' }"
            @click="() => !disabled && (open = true)"
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
      <Grid class="h-[70vh]" table-title="销售订单列表(仅展示可退货)" />
    </Modal>
  </div>
</template>
