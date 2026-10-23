<script lang="ts" setup>
import { computed, ref } from 'vue';



import { formatSaleDecimal, formatSaleAmount } from '../../utils/decimal';

import { Input, message, Modal, Table } from 'ant-design-vue';

import { convertSaleQuoteToCart, getSaleQuote } from '#/api/erp/sale/quote';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { focusNextInputOnEnter } from '#/views/erp/utils/keyboard';

import { applySaleSelectColumnPermission } from '../../utils/field-permission';

const emit = defineEmits(['success']);

interface RowItem {
  quoteItemId: number;
  productCode?: string;
  productName?: string;
  productUnitName?: string;
  warehouseName?: string;
  deptName?: string;
  stockCount?: number;
  availableCount?: number;
  weight?: number;
  packageQty?: number;
  productPrice?: number;
  giftFlag?: boolean;
  quoteCount: number;
  convertedCount: number;
  convertibleCount: number;
  count: string;
  countDirty: boolean;
  countValue: number;
  remark?: string;
}

const visible = ref(false);
const loading = ref(false);
const quoteId = ref<number>();
const quoteNo = ref<string>();
const items = ref<RowItem[]>([]);
const selectedRowKeys = ref<number[]>([]);
const hiddenFields = ref<string[]>([]);
const { hiddenFields: moduleHiddenFields, loadHiddenFields } =
  useFieldPermission('erp_sale_quote');

function parseCountInput(value: unknown, productName?: string) {
  const text = String(value ?? '').trim();
  if (!text) {
    throw new Error(`商品[${productName || '-'}]本次出库数量不能为空`);
  }
  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new Error(`商品[${productName || '-'}]本次出库数量格式不正确`);
  }
  return Number(text);
}

function resolveCountValue(row: RowItem) {
  return row.countDirty
    ? parseCountInput(row.count, row.productName)
    : row.countValue;
}

function handleCountBlur(row: Record<string, any>) {
  try {
    row.countValue = parseCountInput(row.count, row.productName);
    row.count = formatSaleDecimal(row.countValue);
    row.countDirty = false;
  } catch {
    // 输入错误仍由确认动作统一提示，失焦时保留用户原始输入。
  }
}

async function open(id: number, fields: string[] = []) {
  quoteId.value = id;
  if (fields.length > 0) {
    hiddenFields.value = fields;
  } else {
    await loadHiddenFields();
    hiddenFields.value = moduleHiddenFields.value;
  }
  visible.value = true;
  loading.value = true;
  try {
    const detail = await getSaleQuote(id, { includeStock: true });
    quoteNo.value = detail.no;
    const rows: RowItem[] = (detail.items || [])
      .map((item) => {
        const quoteCount = Number(item.count || 0);
        const convertedCount = Number(item.convertedCount || 0);
        const convertibleCount = Math.max(quoteCount - convertedCount, 0);
        return {
          quoteItemId: item.id!,
          productCode: item.productCode,
          productName: item.productName,
          productUnitName: item.productUnitName,
          warehouseName: item.warehouseName,
          deptName: item.deptName,
          stockCount: item.stockCount,
          availableCount: item.availableCount,
          weight: item.weight,
          packageQty: item.packageQty,
          productPrice: item.productPrice,
          giftFlag: item.giftFlag,
          quoteCount,
          convertedCount,
          convertibleCount,
          count: formatSaleDecimal(convertibleCount),
          countDirty: false,
          countValue: convertibleCount,
          remark: item.remark,
        };
      })
      .filter((row) => row.convertibleCount > 0);
    items.value = rows;
    selectedRowKeys.value = rows.map((row) => row.quoteItemId);
    if (rows.length === 0) {
      message.warning('没有剩余可出库的报价明细');
    }
  } finally {
    loading.value = false;
  }
}

async function handleConfirm() {
  const selectedKeySet = new Set(selectedRowKeys.value);
  const selected = items.value.filter((row) =>
    selectedKeySet.has(row.quoteItemId),
  );
  if (selected.length === 0) {
    message.warning('请至少勾选一项');
    return;
  }
  for (const row of selected) {
    const count = resolveCountValue(row);
    if (count <= 0) {
      message.warning(`商品[${row.productName}]本次出库数量必须大于0`);
      return;
    }
    if (count > row.convertibleCount) {
      message.warning(
        `商品[${row.productName}]本次出库数量(${formatSaleDecimal(count)})超过剩余可出数量(${formatSaleDecimal(row.convertibleCount)})`,
      );
      return;
    }
  }
  loading.value = true;
  try {
    await convertSaleQuoteToCart({
      quoteId: quoteId.value!,
      items: selected.map((row) => ({
        quoteItemId: row.quoteItemId,
        count: resolveCountValue(row),
      })),
    });
    message.success('出库成功，已生成待审核销售手推车');
    visible.value = false;
    emit('success');
  } finally {
    loading.value = false;
  }
}

const columns = [
  { title: '产品名称', dataIndex: 'productName', width: 180 },
  { title: '产品编号', dataIndex: 'productCode', width: 130 },
  { title: '仓库', dataIndex: 'warehouseName', width: 140 },
  { title: '所属部门', dataIndex: 'deptName', width: 140 },
  { title: '库存', dataIndex: 'stockCount', width: 100, key: 'stockCount' },
  {
    title: '可用库存',
    dataIndex: 'availableCount',
    width: 100,
    key: 'availableCount',
  },
  { title: '数量', dataIndex: 'quoteCount', width: 100, key: 'quoteCount' },
  { title: '本次出库数量', dataIndex: 'count', width: 130, key: 'count' },
  { title: '单价', dataIndex: 'productPrice', width: 110, key: 'productPrice' },
  { title: '是否为赠品', dataIndex: 'giftFlag', width: 100, key: 'giftFlag' },
  { title: '单位', dataIndex: 'productUnitName', width: 70 },
  { title: '重量', dataIndex: 'weight', width: 80, key: 'weight' },
  {
    title: '包装数',
    dataIndex: 'packageQty',
    width: 90,
    key: 'packageQty',
  },
  {
    title: '已转手推车',
    dataIndex: 'convertedCount',
    width: 100,
    key: 'convertedCount',
  },
  {
    title: '剩余可出',
    dataIndex: 'convertibleCount',
    width: 90,
    key: 'convertibleCount',
  },
  { title: '备注', dataIndex: 'remark', width: 160 },
];

const permittedColumns = computed(() =>
  applySaleSelectColumnPermission(columns, hiddenFields.value),
);

const rowSelection = computed(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: (number | string)[]) => {
    selectedRowKeys.value = keys.map(Number);
  },
}));

function handleRowClick(record: RowItem, event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (
    target?.closest(
      '.ant-checkbox, .ant-checkbox-wrapper, input, button, textarea, a',
    )
  ) {
    return;
  }
  const key = record.quoteItemId;
  if (selectedRowKeys.value.includes(key)) {
    selectedRowKeys.value = selectedRowKeys.value.filter(
      (item) => item !== key,
    );
    return;
  }
  selectedRowKeys.value = [...selectedRowKeys.value, key];
}

defineExpose({ open });
</script>

<template>
  <Modal
    v-model:open="visible"
    class="!w-[85vw]"
    :title="`报价订单分批出库${quoteNo ? ' - ' + quoteNo : ''}`"
    :confirm-loading="loading"
    @ok="handleConfirm"
  >
    <Table
      :columns="permittedColumns"
      :data-source="items"
      :loading="loading"
      :pagination="false"
      :row-selection="rowSelection"
      :scroll="{ x: 'max-content', y: 'calc(70vh - 120px)' }"
      row-key="quoteItemId"
      size="small"
      :custom-row="
        (record) => ({ onClick: (event) => handleRowClick(record, event) })
      "
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'productPrice'">
          {{ formatSaleAmount(record.productPrice) }}
        </template>
        <template v-else-if="column.key === 'quoteCount'">
          {{ formatSaleDecimal(record.quoteCount) }}
        </template>
        <template v-else-if="column.key === 'stockCount'">
          {{ formatSaleDecimal(record.stockCount ?? 0) }}
        </template>
        <template v-else-if="column.key === 'availableCount'">
          {{ formatSaleDecimal(record.availableCount ?? 0) }}
        </template>
        <template v-else-if="column.key === 'weight'">
          {{ formatSaleDecimal(record.weight) }}
        </template>
        <template v-else-if="column.key === 'packageQty'">
          {{ formatSaleDecimal(record.packageQty) }}
        </template>
        <template v-else-if="column.key === 'giftFlag'">
          {{ record.giftFlag ? '是' : '否' }}
        </template>
        <template v-else-if="column.key === 'convertedCount'">
          {{ formatSaleDecimal(record.convertedCount) }}
        </template>
        <template v-else-if="column.key === 'convertibleCount'">
          {{ formatSaleDecimal(record.convertibleCount) }}
        </template>
        <template v-else-if="column.key === 'count'">
          <Input
            v-model:value="record.count"
            size="small"
            class="w-full"
            @click.stop
            @press-enter="focusNextInputOnEnter"
            @update:value="record.countDirty = true"
            @blur="handleCountBlur(record)"
          />
        </template>
      </template>
    </Table>
  </Modal>
</template>
