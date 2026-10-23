<script lang="ts" setup>
import type { ErpFinancePaymentApi } from '#/api/erp/finance/payment';
import type { ErpPurchaseInApi } from '#/api/erp/purchase/in';
import type { ErpPurchaseReturnApi } from '#/api/erp/purchase/return';

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
import PurchaseInSelect from './purchase-in-select.vue';
import SaleReturnSelect from './sale-return-select.vue';

interface Props {
  items?: ErpFinancePaymentApi.FinancePaymentItem[];
  supplierId?: number;
  disabled?: boolean;
  discountPrice?: number;
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  supplierId: undefined,
  disabled: false,
  discountPrice: 0,
});

const emit = defineEmits([
  'update:items',
  'update:total-price',
  'update:payment-price',
]);

const tableData = ref<ErpFinancePaymentApi.FinancePaymentItem[]>([]); // 表格数据

/** 获取表格合计数据 */
const summaries = computed(() => {
  return calculateErpItemSummary(tableData.value, {
    fields: ['totalPrice', 'paidPrice', 'paymentPrice'],
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

/** 监听详情/编辑态切换，刷新操作列显隐 */
watch(
  () => props.disabled,
  async (disabled) => {
    await nextTick();
    const columns = useFormItemColumns(disabled);
    await gridApi.grid.reloadColumn(columns || []);
  },
  {
    immediate: true,
  },
);

/** 计算 totalPrice、paymentPrice 价格 */
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
    const paymentPrice = tableData.value.reduce(
      (prev, curr) => prev + (curr.paymentPrice || 0),
      0,
    );
    const finalPaymentPrice = paymentPrice - (props.discountPrice || 0);
    // 通知父组件更新
    emit('update:total-price', totalPrice);
    emit('update:payment-price', finalPaymentPrice);
  },
  { deep: true },
);

/** 添加采购入库单 */
const purchaseInSelectRef = ref();
const handleOpenPurchaseIn = () => {
  if (!props.supplierId) {
    ElMessage.error('请选择供应商');
    return;
  }
  purchaseInSelectRef.value?.open(props.supplierId);
};

const handleAddPurchaseIn = (rows: ErpPurchaseInApi.PurchaseIn[]) => {
  rows.forEach((row) => {
    // TODO @芋艿
    const newItem: ErpFinancePaymentApi.FinancePaymentItem = {
      bizId: row.id,
      bizType: ErpBizType.PURCHASE_IN,
      bizNo: row.no,
      totalPrice: row.totalPrice,
      paidPrice: row.paymentPrice,
      paymentPrice: row.totalPrice - row.paymentPrice,
      remark: undefined,
    };
    tableData.value.push(newItem);
  });
  emit('update:items', [...tableData.value]);
};

/** 添加采购退货单 */
const saleReturnSelectRef = ref();
const handleOpenSaleReturn = () => {
  if (!props.supplierId) {
    ElMessage.error('请选择供应商');
    return;
  }
  saleReturnSelectRef.value?.open(props.supplierId);
};

const handleAddSaleReturn = (rows: ErpPurchaseReturnApi.PurchaseReturn[]) => {
  rows.forEach((row) => {
    const newItem: ErpFinancePaymentApi.FinancePaymentItem = {
      bizId: row.id,
      bizType: ErpBizType.PURCHASE_RETURN,
      bizNo: row.no,
      totalPrice: -row.totalPrice,
      paidPrice: -row.refundPrice,
      paymentPrice: -row.totalPrice + row.refundPrice,
      remark: undefined,
    };
    tableData.value.push(newItem);
  });
  emit('update:items', [...tableData.value]);
};

/** 删除行 */
const handleDelete = async (row: any) => {
  const index = tableData.value.findIndex(
    (item) => item.bizId === row.bizId && item.bizType === row.bizType,
  );
  if (index !== -1) {
    tableData.value.splice(index, 1);
  }
  // 通知父组件更新
  emit('update:items', [...tableData.value]);
};

/** 处理行数据变更 */
const handleRowChange = (row: any) => {
  const index = tableData.value.findIndex(
    (item) => item.bizId === row.bizId && item.bizType === row.bizType,
  );
  if (index === -1) {
    tableData.value.push(row);
  } else {
    tableData.value[index] = row;
  }
  emit('update:items', [...tableData.value]);
};

/** 表单校验 */
const validate = () => {
  if (tableData.value.length === 0) {
    throw new Error('Please add payment details');
  }
  for (let i = 0; i < tableData.value.length; i++) {
    const item = tableData.value[i];
    if (!item.paymentPrice || item.paymentPrice <= 0) {
      throw new Error(`Row ${i + 1}: payment amount must be greater than 0`);
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
};

defineExpose({ validate });
</script>

<template>
  <div>
    <Grid class="w-full">
      <template #paymentPrice="{ row }">
        <ElInputNumber
          v-if="!disabled"
          v-model="row.paymentPrice"
          :precision="2"
          :formatter="erpPriceInputFormatter"
          placeholder="Enter payment amount"
          controls-position="right"
          style="width: 100%"
          class="w-full"
          @change="handleRowChange(row)"
        />
        <span v-else>{{
          erpPriceInputFormatter(row.paymentPrice) || '-'
        }}</span>
      </template>
      <template #remark="{ row }">
        <ElInput
          v-if="!disabled"
          v-model="row.remark"
          placeholder="Enter remark"
          @change="handleRowChange(row)"
        />
        <span v-else>{{ row.remark || '-' }}</span>
      </template>
      <template #actions="{ row }">
        <TableAction
          v-if="!disabled"
          :actions="[
            {
              label: '删除',
              link: true,
              popConfirm: {
                title: 'Confirm delete this payment detail?',
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
                合计付款：{{ erpPriceInputFormatter(summaries.totalPrice) }}
              </span>
              <span>
                已付金额：{{ erpPriceInputFormatter(summaries.paidPrice) }}
              </span>
              <span>
                本次付款：
                {{ erpPriceInputFormatter(summaries.paymentPrice) }}
              </span>
            </div>
          </div>
        </div>
        <TableAction
          v-if="!disabled"
          class="mt-2 flex justify-center"
          :actions="[
            {
              label: '添加采购入库单',
              type: 'default',
              onClick: handleOpenPurchaseIn,
            },
            {
              label: '添加采购退货单',
              type: 'default',
              onClick: handleOpenSaleReturn,
            },
          ]"
        />
      </template>
    </Grid>

    <!-- 采购入库单选择组件 -->
    <PurchaseInSelect
      v-if="!disabled"
      ref="purchaseInSelectRef"
      @success="handleAddPurchaseIn"
    />
    <!-- 采购退货单选择组件 -->
    <SaleReturnSelect
      v-if="!disabled"
      ref="saleReturnSelectRef"
      @success="handleAddSaleReturn"
    />
  </div>
</template>
