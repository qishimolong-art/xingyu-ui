<script lang="ts" setup>
import {
  financeAdd,
  financeSubtract,
  financeValue,
  financeCompare,
  financeSign,
  financeAbs,
} from '#/views/erp/finance/utils/finance-decimal';

import DecimalAmountInput from '#/views/erp/components/DecimalAmountInput.vue';
import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import type { ErpFinanceReceiptApi } from '#/api/erp/finance/receipt';
import type { ErpSaleOutApi } from '#/api/erp/sale/out';
import type { ErpSaleReturnApi } from '#/api/erp/sale/return';

import { computed, nextTick, ref, watch } from 'vue';

import { ErpBizType } from '@vben/constants';

import { Input, InputNumber, message } from 'ant-design-vue';

import { TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { focusNextInputOnEnter } from '#/views/erp/utils/keyboard';

import { useFormItemColumns } from '../data';
import SaleOutSelect from './sale-out-select.vue';
import SaleReturnSelect from './sale-return-select.vue';

interface Props {
  items?: ErpFinanceReceiptApi.FinanceReceiptItem[];
  customerId?: number;
  disabled?: boolean;
  discountPrice?: number | string | null;
  hiddenFields?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  customerId: undefined,
  disabled: false,
  discountPrice: 0,
  hiddenFields: () => [],
});

const emit = defineEmits([
  'detail',
  'update:items',
  'update:total-price',
  'update:receipt-price',
]);

const tableData = ref<ErpFinanceReceiptApi.FinanceReceiptItem[]>([]); // 表格数据

/** 获取表格合计数据 */
const summaries = computed(() => {
  return {
    totalPrice: tableData.value.reduce(
      (sum, item) => financeAdd(sum, item.totalPrice || 0),
      '0',
    ),
    receiptedPrice: tableData.value.reduce(
      (sum, item) => financeAdd(sum, item.receiptedPrice || 0),
      '0',
    ),
    receiptPrice: tableData.value.reduce(
      (sum, item) => financeAdd(sum, item.receiptPrice || 0),
      '0',
    ),
  };
});

function buildItemColumns() {
  return useFormItemColumns(props.disabled, props.hiddenFields, {
    editable: !props.disabled,
    rows: tableData.value,
  });
}

/** 表格配置 */
const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: buildItemColumns(),
    data: tableData.value,
    minHeight: 250,
    autoResize: true,
    border: true,
    fit: false,
    rowConfig: {
      keyField: 'seq',
      isHover: true,
    },
    pagerConfig: {
      enabled: false,
    },
    toolbarConfig: {
      enabled: false,
    },
  },
});

/** 监听外部传入的列数据 */
watch(
  () => [props.disabled, props.hiddenFields],
  () => {
    gridApi.setGridOptions({
      columns: buildItemColumns(),
    });
  },
  { deep: true },
);

watch(
  () => props.items,
  async (items) => {
    if (!items) {
      return;
    }
    tableData.value = [...items];
    await nextTick(); // 特殊：保证 gridApi 已经初始化
    await gridApi.grid.reloadColumn(buildItemColumns());
    await gridApi.grid.reloadData(tableData.value);
  },
  {
    immediate: true,
  },
);

/** 计算 totalPrice、receiptPrice 价格 */
watch(
  () => [tableData.value, props.discountPrice],
  () => {
    if (!tableData.value || tableData.value.length === 0) {
      return;
    }
    const totalPrice = tableData.value.reduce(
      (prev, curr) => financeAdd(prev, curr.totalPrice || 0),
      '0',
    );
    const receiptPrice = tableData.value.reduce(
      (prev, curr) => financeAdd(prev, curr.receiptPrice || 0),
      '0',
    );
    const finalReceiptPrice = financeSubtract(
      receiptPrice,
      props.discountPrice || 0,
    );
    // 通知父组件更新
    emit('update:total-price', totalPrice);
    emit('update:receipt-price', finalReceiptPrice);
  },
  { deep: true },
);

/** 添加销售出库单 */
const saleOutSelectRef = ref();
function handleOpenSaleOut() {
  if (!props.customerId) {
    message.error('请选择客户');
    return;
  }
  saleOutSelectRef.value?.open(props.customerId);
}

function handleAddSaleOut(rows: ErpSaleOutApi.SaleOut[]) {
  rows.forEach((row) => {
    // TODO 芋艿
    const newItem: ErpFinanceReceiptApi.FinanceReceiptItem = {
      bizId: row.id ?? 0,
      bizType: ErpBizType.SALE_OUT,
      bizNo: row.no ?? '',
      totalPrice: row.totalPrice ?? 0,
      receiptedPrice: row.receiptPrice ?? 0,
      receiptPrice: financeSubtract(row.totalPrice ?? 0, row.receiptPrice ?? 0),
      remark: undefined,
    };
    tableData.value.push(newItem);
  });
  emit('update:items', [...tableData.value]);
}

/** 添加销售退货单 */
const saleReturnSelectRef = ref();
function handleOpenSaleReturn() {
  if (!props.customerId) {
    message.error('请选择客户');
    return;
  }
  saleReturnSelectRef.value?.open(props.customerId);
}

function handleAddSaleReturn(rows: ErpSaleReturnApi.SaleReturn[]) {
  // TODO 芋艿
  rows.forEach((row) => {
    const newItem: ErpFinanceReceiptApi.FinanceReceiptItem = {
      bizId: row.id ?? 0,
      bizType: ErpBizType.SALE_RETURN,
      bizNo: row.no ?? '',
      totalPrice: -(row.totalPrice ?? 0),
      receiptedPrice: -(row.refundPrice ?? 0),
      receiptPrice: financeAdd(-(row.totalPrice ?? 0), row.refundPrice ?? 0),
      remark: undefined,
    };
    tableData.value.push(newItem);
  });
  emit('update:items', [...tableData.value]);
}

/** 删除行 */
function handleDelete(row: any) {
  const index = tableData.value.findIndex(
    (item) => item.bizId === row.bizId && item.bizType === row.bizType,
  );
  if (index !== -1) {
    tableData.value.splice(index, 1);
  }
  if (tableData.value.length === 0) {
    emit('update:total-price', 0);
    emit('update:receipt-price', 0);
  }
  // 通知父组件更新
  emit('update:items', [...tableData.value]);
}

/** 处理行数据变更 */
function handleRowChange(row: any) {
  const index = tableData.value.findIndex(
    (item) => item.bizId === row.bizId && item.bizType === row.bizType,
  );
  if (index === -1) {
    tableData.value.push(row);
  } else {
    tableData.value[index] = row;
  }
  emit('update:items', [...tableData.value]);
}

/** 表单校验 */
function validate() {
  // 检查每行的收款金额
  for (let i = 0; i < tableData.value.length; i++) {
    const item = tableData.value[i];
    const remaining = financeSubtract(
      financeValue(item?.totalPrice || 0),
      financeValue(item?.receiptedPrice || 0),
    );
    const amount = financeValue(item?.receiptPrice || 0);
    if (
      financeCompare(amount, 0) === 0 ||
      financeCompare(financeSign(amount), financeSign(remaining)) !== 0 ||
      financeCompare(financeAbs(amount), financeAbs(remaining)) > 0
    ) {
      throw new Error(`第 ${i + 1} 行：核销金额必须在未核销金额范围内`);
    }
  }
}

defineExpose({ validate });
</script>

<template>
  <div>
    <Grid class="w-full">
      <template #bizNo="{ row }">
        <a
          v-if="row.bizNo && row.bizId"
          class="cursor-pointer text-primary"
          @click.stop="emit('detail', row)"
        >
          {{ row.bizNo }}
        </a>
        <span v-else>{{ row.bizNo || '-' }}</span>
      </template>
      <template #receiptPrice="{ row }">
        <DecimalAmountInput
          v-model:value="row.receiptPrice"
          :disabled="disabled"
          placeholder="请输入本次收款"
          @change="handleRowChange(row)"
          @press-enter="focusNextInputOnEnter"
        />
      </template>
      <template #remark="{ row }">
        <Input
          v-model:value="row.remark"
          :disabled="disabled"
          placeholder="请输入备注"
          @change="handleRowChange(row)"
          @press-enter="focusNextInputOnEnter"
        />
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '删除',
              type: 'link',
              danger: true,
              popConfirm: {
                title: '确认删除该收款明细吗？',
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>

      <template #bottom>
        <div class="mt-2 rounded border border-border bg-muted p-2">
          <div class="flex justify-between text-sm text-muted-foreground">
            <span class="font-medium text-foreground">合计：</span>
            <div class="flex space-x-4">
              <span>
                合计收款：{{ erpPriceInputFormatter(summaries.totalPrice) }}
              </span>
              <span>
                已收金额：{{ erpPriceInputFormatter(summaries.receiptedPrice) }}
              </span>
              <span>
                本次收款：
                {{ erpPriceInputFormatter(summaries.receiptPrice) }}
              </span>
            </div>
          </div>
        </div>
        <TableAction
          v-if="!disabled"
          class="mt-2 flex justify-center"
          :actions="[
            {
              label: '添加销售出库单',
              type: 'default',
              onClick: handleOpenSaleOut,
            },
            {
              label: '添加销售退货单',
              type: 'default',
              onClick: handleOpenSaleReturn,
            },
          ]"
        />
      </template>
    </Grid>

    <!-- 销售出库单选择组件 -->
    <SaleOutSelect ref="saleOutSelectRef" @success="handleAddSaleOut" />
    <!-- 销售退货单选择组件 -->
    <SaleReturnSelect
      ref="saleReturnSelectRef"
      @success="handleAddSaleReturn"
    />
  </div>
</template>
