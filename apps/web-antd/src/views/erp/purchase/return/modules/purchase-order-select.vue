<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseOrderApi } from '#/api/erp/purchase/order';

import { onBeforeUnmount, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Input, message, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getPurchaseOrderPage } from '#/api/erp/purchase/order';
import { isFormInputTarget } from '#/views/erp/purchase/utils/item-form';

import { useOrderGridColumns, useOrderGridFormSchema } from '../data';

defineProps({
  orderNo: {
    type: String,
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

const order = ref<ErpPurchaseOrderApi.PurchaseOrder>();
const open = ref(false);

function normalizeSearchParams(values: Record<string, any>) {
  const params = { ...values };
  if (typeof params.no === 'string') {
    const normalized = params.no.trim().replace(/\s+/g, '%');
    params.no = normalized || undefined;
  }
  return params;
}

const [Grid] = useVbenVxeGrid({
  formOptions: {
    schema: useOrderGridFormSchema(),
  },
  gridOptions: {
    columns: useOrderGridColumns(),
    height: '100%',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          await getPurchaseOrderPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            returnEnable: true,
            ...normalizeSearchParams(formValues),
          }),
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
      order.value = row;
    },
  },
});

function handleOk() {
  if (!order.value) {
    message.warning('请选择一个采购订单');
    return;
  }
  emit('update:order', order.value);
  open.value = false;
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

watch(open, (visible) => {
  if (visible) {
    window.addEventListener('keydown', handleWindowKeydown);
  } else {
    window.removeEventListener('keydown', handleWindowKeydown);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown);
});
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
      v-model:open="open"
      class="!w-[85vw]"
      title="选择关联订单"
      @ok="handleOk"
    >
      <Grid class="h-[70vh]" table-title="采购订单列表(仅展示可退货)" />
    </Modal>
  </div>
</template>
