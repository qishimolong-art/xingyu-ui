<script lang="ts" setup>
import { withCandidateFocus } from '#/views/erp/utils/candidate-focus';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpSaleOutApi } from '#/api/erp/sale/out';

import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Input, message, Modal, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getSaleOutPage } from '#/api/erp/sale/out';
import { applySaleSelectColumnPermission } from '#/views/erp/sale/utils/field-permission';
import { getCustomerSelectProps } from '#/views/erp/sale/utils/customer-select';
import {
  shouldConfirmOnEnter,
  withEnterBlurInputSchemas,
} from '#/views/erp/sale/utils/keyboard';

interface Props {
  customerId?: number;
  disabled?: boolean;
  hiddenFields?: string[];
  outNo?: string;
}

const props = withDefaults(defineProps<Props>(), {
  customerId: undefined,
  disabled: false,
  hiddenFields: () => [],
  outNo: undefined,
});

const emit = defineEmits<{
  'update:out': [out: ErpSaleOutApi.SaleOut];
}>();

const saleOut = ref<ErpSaleOutApi.SaleOut>();
const open = ref(false);
let isEnterListening = false;

const saleOutColumns: VxeTableGridOptions<ErpSaleOutApi.SaleOut>['columns'] = [
  { type: 'radio', width: 50, fixed: 'left' },
  { field: 'no', title: '销售单号', width: 200, fixed: 'left' },
  {
    field: 'productNames',
    title: '产品信息',
    minWidth: 180,
    showOverflow: 'tooltip',
  },
  { field: 'customerName', title: '客户', minWidth: 140 },
  { field: 'outTime', title: '销售时间', width: 170, formatter: 'formatDate' },
  {
    field: 'totalCount',
    title: '销售数量',
    minWidth: 120,
    formatter: 'formatSaleDecimal6',
  },
  {
    field: 'totalPrice',
    title: '销售金额',
    minWidth: 120,
    formatter: 'formatSaleAmount6',
  },
  {
    field: 'returnStatus',
    title: '退货状态',
    width: 110,
    slots: { default: 'returnStatus' },
  },
  { field: 'sourceNo', title: '来源单号', minWidth: 180 },
];

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: withCandidateFocus(
      withEnterBlurInputSchemas([
        {
          fieldName: 'no',
          label: '销售单号',
          component: 'Input',
          componentProps: {
            allowClear: true,
            placeholder: '请输入销售单号',
          },
        },
        {
          fieldName: 'customerId',
          label: '客户',
          component: 'CustomerLazySelect',
          componentProps: getCustomerSelectProps(),
        },
      ]),
    ),
  },
  gridOptions: {
    columns: applySaleSelectColumnPermission(
      saleOutColumns || [],
      props.hiddenFields,
    ),
    height: '100%',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues = {}) => {
          const queryCustomerId = props.customerId ?? formValues.customerId;
          return await getSaleOutPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            includeItems: false,
            status: 20,
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
      checkMethod: ({ row }: { row: any }) => row.returnStatus !== 2,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpSaleOutApi.SaleOut>,
  gridEvents: {
    radioChange: ({ row }: { row: ErpSaleOutApi.SaleOut }) => {
      saleOut.value = row;
    },
  },
});

watch(
  () => props.hiddenFields,
  (hiddenFields) => {
    gridApi.setGridOptions({
      columns:
        applySaleSelectColumnPermission(saleOutColumns || [], hiddenFields) ||
        [],
    });
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
    saleOut.value = undefined;
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

function handleOk() {
  if (!saleOut.value) {
    message.warning('请选择一个销售单');
    return;
  }
  emit('update:out', saleOut.value);
  open.value = false;
}

function handleEnterConfirm(event: KeyboardEvent) {
  if (!shouldConfirmOnEnter(event, open.value && Boolean(saleOut.value))) {
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
      :value="outNo"
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
      title="选择关联销售单"
      @ok="handleOk"
    >
      <Grid class="h-[70vh]" table-title="销售单列表">
        <template #returnStatus="{ row }">
          <Tag v-if="row.returnStatus === 2" color="red">全部退货</Tag>
          <Tag v-else-if="row.returnStatus === 1" color="orange">部分退货</Tag>
          <Tag v-else color="green">未退货</Tag>
        </template>
      </Grid>
    </Modal>
  </div>
</template>
