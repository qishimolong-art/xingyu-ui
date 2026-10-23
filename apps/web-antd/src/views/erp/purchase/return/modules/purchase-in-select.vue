<script lang="ts" setup>
import { withPurchaseCandidateFocus } from '#/views/erp/purchase/utils/candidate-focus';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseInApi } from '#/api/erp/purchase/in';

import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Input, message, Modal, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getPurchaseInPage } from '#/api/erp/purchase/in';
import { applyPurchaseSelectColumnPermission } from '#/views/erp/purchase/utils/field-permission';
import { attachPurchaseInputEnterFocus } from '#/views/erp/purchase/utils/form-enter-focus';
import { getSupplierSelectProps } from '#/views/erp/purchase/utils/supplier-select';
import { shouldConfirmOnEnter } from '#/views/erp/utils/keyboard';

import { purchaseInSelectColumns } from './purchase-in-select-columns';

interface Props {
  disabled?: boolean;
  hiddenFields?: string[];
  inNo?: string;
  supplierId?: number;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  hiddenFields: () => [],
  inNo: undefined,
  supplierId: undefined,
});

const emit = defineEmits<{
  'update:in': [purchaseIn: ErpPurchaseInApi.PurchaseIn];
}>();

const purchaseIn = ref<ErpPurchaseInApi.PurchaseIn>();
const open = ref(false);
let isEnterListening = false;

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: attachPurchaseInputEnterFocus(
      withPurchaseCandidateFocus([
        {
          fieldName: 'no',
          label: '入库单号',
          component: 'Input',
          componentProps: {
            allowClear: true,
            placeholder: '请输入入库单号',
          },
        },
        {
          fieldName: 'supplierId',
          label: '供应商',
          component: 'SupplierLazySelect',
          componentProps: getSupplierSelectProps(),
        },
      ]),
    ),
  },
  gridOptions: {
    columns: applyPurchaseSelectColumnPermission(
      purchaseInSelectColumns || [],
      props.hiddenFields,
    ),
    height: '100%',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues = {}) => {
          const querySupplierId = props.supplierId ?? formValues.supplierId;
          return await getPurchaseInPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            includeItems: false,
            status: 20,
            ...formValues,
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
      checkMethod: ({ row }: { row: ErpPurchaseInApi.PurchaseIn }) =>
        row.returnStatus !== 2,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpPurchaseInApi.PurchaseIn>,
  gridEvents: {
    radioChange: ({ row }: { row: ErpPurchaseInApi.PurchaseIn }) => {
      purchaseIn.value = row;
    },
  },
});

watch(
  () => props.hiddenFields,
  async (hiddenFields) => {
    await gridApi.grid.reloadColumn(
      applyPurchaseSelectColumnPermission(
        purchaseInSelectColumns || [],
        hiddenFields,
      ) || [],
    );
  },
);

watch(open, async (visible) => {
  if (visible) {
    await syncLockedSupplier();
    await nextTick();
    await gridApi.query();
    startEnterListening();
  } else {
    purchaseIn.value = undefined;
    stopEnterListening();
  }
});

watch(
  () => props.supplierId,
  async () => {
    if (!open.value) return;
    purchaseIn.value = undefined;
    await syncLockedSupplier();
    await gridApi.query();
  },
);

async function syncLockedSupplier() {
  if (props.supplierId === undefined) {
    return;
  }
  await gridApi.formApi?.setValues({ supplierId: props.supplierId });
}

function handleOk() {
  if (!purchaseIn.value) {
    message.warning('请选择一个采购入库单');
    return;
  }
  emit('update:in', purchaseIn.value);
  open.value = false;
}

function handleEnterConfirm(event: KeyboardEvent) {
  if (!shouldConfirmOnEnter(event, open.value && Boolean(purchaseIn.value))) {
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
      :value="inNo"
      :disabled="disabled"
      @click="() => !disabled && (open = true)"
    >
      <template #addonAfter>
        <IconifyIcon
          class="h-full w-6 cursor-pointer"
          icon="ant-design:setting-outlined"
          :style="{ cursor: disabled ? 'not-allowed' : 'pointer' }"
          @click="() => !disabled && (open = true)"
        />
      </template>
    </Input>
    <Modal
      v-model:open="open"
      class="!w-[85vw]"
      title="选择原采购入库单"
      @ok="handleOk"
    >
      <Grid class="h-[70vh]" table-title="采购入库单列表">
        <template #returnStatus="{ row }">
          <Tag v-if="row.returnStatus === 2" color="red">全部退货</Tag>
          <Tag v-else-if="row.returnStatus === 1" color="orange">部分退货</Tag>
          <Tag v-else color="green">未退货</Tag>
        </template>
      </Grid>
    </Modal>
  </div>
</template>
