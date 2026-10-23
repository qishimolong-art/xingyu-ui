<script lang="ts" setup>
import type { ErpFinanceReceiptApi } from '#/api/erp/finance/receipt';
import type { ErpSaleOutApi } from '#/api/erp/sale/out';
import type { ErpSaleReturnApi } from '#/api/erp/sale/return';

import { computed, nextTick, ref, watch } from 'vue';

import { ErpBizType } from '@vben/constants';
import { erpPriceInputFormatter } from '@vben/utils';

import { ElInput, ElInputNumber, ElMessage } from 'element-plus';

import { TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';

import {
  calculateErpItemSummary,
  findDuplicateErpItems,
} from '../../../utils/item-table';
import { useFormItemColumns } from '../data';
import SaleOutSelect from './sale-out-select.vue';
import SaleReturnSelect from './sale-return-select.vue';

interface Props {
  items?: ErpFinanceReceiptApi.FinanceReceiptItem[];
  customerId?: number;
  disabled?: boolean;
  discountPrice?: number;
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  customerId: undefined,
  disabled: false,
  discountPrice: 0,
});

const emit = defineEmits([
  'update:items',
  'update:total-price',
  'update:receipt-price',
]);

const tableData = ref<ErpFinanceReceiptApi.FinanceReceiptItem[]>([]); // 表格数据

/** 获取表格合计数据 */
const summaries = computed(() => {
  return calculateErpItemSummary(tableData.value, {
    fields: ['totalPrice', 'receiptedPrice', 'receiptPrice'],
  });
});

/** 表格配置 */
const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useFormItemColumns(props.disabled),
    data: tableData.value,
    minHeight: 250,
    autoResize: true,
    border: true,
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
  () => props.items,
  async (items) => {
    if (!items) {
      return;
    }
    tableData.value = [...items];
    await nextTick(); // 特殊：保证 gridApi 已经初始化
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
      (prev, curr) => prev + (curr.totalPrice || 0),
      0,
    );
    const receiptPrice = tableData.value.reduce(
      (prev, curr) => prev + (curr.receiptPrice || 0),
      0,
    );
    const finalReceiptPrice = receiptPrice - (props.discountPrice || 0);
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
    ElMessage.error('请选择客户');
    return;
  }
  saleOutSelectRef.value?.open(props.customerId);
}

function handleAddSaleOut(rows: ErpSaleOutApi.SaleOut[]) {
  // TODO @芋艿
  rows.forEach((row) => {
    const newItem: ErpFinanceReceiptApi.FinanceReceiptItem = {
      bizId: row.id,
      bizType: ErpBizType.SALE_OUT,
      bizNo: row.no,
      totalPrice: row.totalPrice,
      receiptedPrice: row.receiptPrice,
      receiptPrice: row.totalPrice - row.receiptPrice,
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
    ElMessage.error('请选择客户');
    return;
  }
  saleReturnSelectRef.value?.open(props.customerId);
}

function handleAddSaleReturn(rows: ErpSaleReturnApi.SaleReturn[]) {
  rows.forEach((row) => {
    const newItem: ErpFinanceReceiptApi.FinanceReceiptItem = {
      bizId: row.id,
      bizType: ErpBizType.SALE_RETURN,
      bizNo: row.no,
      totalPrice: -row.totalPrice,
      receiptedPrice: -row.refundPrice,
      receiptPrice: -row.totalPrice + row.refundPrice,
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
  if (tableData.value.length === 0) {
    throw new Error('Please add receipt details');
  }
  for (let i = 0; i < tableData.value.length; i++) {
    const item = tableData.value[i];
    if (!item.receiptPrice || item.receiptPrice <= 0) {
      throw new Error(`Row ${i + 1}: receipt amount must be greater than 0`);
    }
  }
  const duplicate = findDuplicateErpItems(
    tableData.value.map((item) => ({
      ...item,
      bizUniqueId: `${item.bizType ?? ''}:${item.bizId ?? ''}`,
    })),
    {
      productKey: 'bizUniqueId',
      warehouseKey: 'bizType',
      fixedGift: false,
    },
  );
  if (duplicate) {
    throw new Error(
      `Row ${duplicate.currentIndex + 1} duplicates source bill at row ${
        duplicate.firstIndex + 1
      }`,
    );
  }
}

defineExpose({ validate });
</script>

<template>
  <div>
    <Grid class="w-full">
      <template #receiptPrice="{ row }">
        <ElInputNumber
          v-model="row.receiptPrice"
          :precision="2"
          :disabled="disabled"
          :formatter="erpPriceInputFormatter"
          placeholder="Enter receipt amount"
          controls-position="right"
          style="width: 100%"
          class="w-full"
          @change="handleRowChange(row)"
        />
      </template>
      <template #remark="{ row }">
        <ElInput
          v-model="row.remark"
          :disabled="disabled"
          placeholder="Enter remark"
          @change="handleRowChange(row)"
        />
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '删除',
              link: true,
              popConfirm: {
                title: 'Confirm delete this receipt detail?',
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
