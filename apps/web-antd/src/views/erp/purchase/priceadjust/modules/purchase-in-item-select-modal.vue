<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseInApi } from '#/api/erp/purchase/in';

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';


import { Input, message, Modal, Pagination, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getApprovedPurchaseInItemPage } from '#/api/erp/purchase/in';
import { formatPurchaseAmount,
  formatPurchaseDecimal,
  parsePurchaseDecimal,
} from '#/views/erp/purchase/utils/decimal';
import { isFormInputTarget } from '#/views/erp/purchase/utils/item-form';

interface Props {
  supplierId?: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  select: [
    rows: Array<{
      itemRow: ErpPurchaseInApi.PurchaseInItemForAdjust;
      newPrice: number;
    }>,
  ];
}>();

const open = ref(false);
const loading = ref(false);
const dataSource = ref<ErpPurchaseInApi.PurchaseInItemForAdjust[]>([]);
const productKeyword = ref('');
const pageState = ref({ pageNo: 1, pageSize: 20, total: 0 });
/** inItemId -> 新单价 */
const newPriceMap = ref<Record<number, string>>({});
const selectedMap = ref<Map<number, ErpPurchaseInApi.PurchaseInItemForAdjust>>(
  new Map(),
);
const selectedRows = computed(() => [...selectedMap.value.values()]);
const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];

function parseNewPrice(value: unknown) {
  const parsed = parsePurchaseDecimal(value, '调整后进价', { min: 0 });
  return parsed.ok ? parsed.value : undefined;
}

function normalizeNewPrice(row: ErpPurchaseInApi.PurchaseInItemForAdjust) {
  const parsed = parseNewPrice(newPriceMap.value[row.id]);
  if (parsed === undefined) {
    message.warning('调整后进价必须为非负数字，最多 6 位小数');
    newPriceMap.value[row.id] =
      formatPurchaseAmount(row.productPrice, '0');
    return;
  }
  newPriceMap.value[row.id] = formatPurchaseDecimal(parsed, '0');
}

const columns = computed<VxeTableGridOptions['columns']>(() => [
  { type: 'checkbox', width: 50, fixed: 'left' },
  { field: 'productName', title: '产品名称', minWidth: 180, fixed: 'left' },
  { field: 'inNo', title: '入库单号', width: 180, fixed: 'left' },
  {
    field: 'inTime',
    title: '入库时间',
    width: 160,
    formatter: 'formatDate',
  },
  { field: 'productCode', title: '产品编码', width: 130 },
  { field: 'batchNo', title: '批次号', minWidth: 120 },
  { field: 'vehicleModel', title: '车型', minWidth: 120 },
  { field: 'standard', title: '规格', minWidth: 110 },
  { field: 'featureCode', title: '特征码', minWidth: 110 },
  { field: 'originPlace', title: '产地', minWidth: 100 },
  { field: 'brand', title: '品牌', minWidth: 110 },
  { field: 'drawingNo', title: '图号', minWidth: 110 },
  { field: 'warehousePosition', title: '货架', minWidth: 110 },
  {
    field: 'count',
    title: '数量',
    width: 100,
    formatter: 'formatPurchaseDecimal6',
  },
  {
    field: 'productPrice',
    title: '原进价',
    width: 110,
    formatter: 'formatPurchaseDecimal6',
  },
  {
    field: 'newPrice',
    title: '调整后进价',
    width: 140,
    fixed: 'right',
    slots: { default: 'newPrice' },
  },
  {
    field: 'adjusted',
    title: '已调',
    width: 80,
    fixed: 'right',
    slots: { default: 'adjusted' },
  },
]);

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: columns.value,
    data: dataSource.value,
    height: '100%',
    border: true,
    keepSource: true,
    rowConfig: { keyField: 'id', isHover: true },
    checkboxConfig: { highlight: true, range: true },
    pagerConfig: { enabled: false },
    toolbarConfig: { enabled: false },
  } as VxeTableGridOptions<ErpPurchaseInApi.PurchaseInItemForAdjust>,
  gridEvents: {
    checkboxChange: ({
      records,
    }: {
      records: ErpPurchaseInApi.PurchaseInItemForAdjust[];
    }) => {
      syncCurrentPageSelection(records);
    },
    checkboxAll: ({
      records,
    }: {
      records: ErpPurchaseInApi.PurchaseInItemForAdjust[];
    }) => {
      syncCurrentPageSelection(records);
    },
    cellClick: ({
      row,
      column,
    }: {
      column: any;
      row: ErpPurchaseInApi.PurchaseInItemForAdjust;
    }) => {
      if (column?.type === 'checkbox' || column?.field === 'newPrice') {
        return;
      }
      const grid = gridApi.grid;
      grid.toggleCheckboxRow(row);
      syncCurrentPageSelection(grid.getCheckboxRecords());
    },
  },
});

function syncCurrentPageSelection(
  records: ErpPurchaseInApi.PurchaseInItemForAdjust[],
) {
  const next = new Map(selectedMap.value);
  dataSource.value.forEach((row) => next.delete(row.id));
  records.forEach((row) => next.set(row.id, row));
  selectedMap.value = next;
}

async function restoreCurrentPageSelection() {
  await nextTick();
  const rows = dataSource.value.filter((row) => selectedMap.value.has(row.id));
  await gridApi.grid.clearCheckboxRow?.();
  if (rows.length > 0) {
    await gridApi.grid.setCheckboxRow?.(rows, true);
  }
}

async function loadData(pageNo = pageState.value.pageNo) {
  if (!props.supplierId) {
    message.warning('请先选择供应商');
    return;
  }
  loading.value = true;
  try {
    const pageResult = await getApprovedPurchaseInItemPage({
      supplierId: props.supplierId,
      excludeAdjusted: true,
      excludeInvoiced: true,
      productKeyword: productKeyword.value || undefined,
      pageNo,
      pageSize: pageState.value.pageSize,
    });
    const availableList = pageResult?.list || [];
    dataSource.value = availableList;
    pageState.value = {
      ...pageState.value,
      pageNo,
      total: pageResult?.total || 0,
    };
    // 默认把新进价初始化为原进价，方便用户小幅调整
    const next: Record<number, string> = { ...newPriceMap.value };
    availableList.forEach((row) => {
      next[row.id] =
        newPriceMap.value[row.id] ??
        formatPurchaseAmount(row.productPrice, '0');
    });
    newPriceMap.value = next;
    gridApi.setGridOptions({ data: dataSource.value });
    await gridApi.grid.reloadData(dataSource.value);
    await restoreCurrentPageSelection();
  } finally {
    loading.value = false;
  }
}

function handleOk() {
  if (selectedRows.value.length === 0) {
    message.warning('请至少勾选一条明细');
    return;
  }
  const invalid = selectedRows.value.find((row) => {
    return parseNewPrice(newPriceMap.value[row.id]) === undefined;
  });
  if (invalid) {
    message.error(
      `入库单 ${invalid.inNo} - ${invalid.productName} 的调整后进价必须 >= 0`,
    );
    return;
  }
  emit(
    'select',
    selectedRows.value.map((row) => ({
      itemRow: row,
      newPrice: parseNewPrice(newPriceMap.value[row.id]) as number,
    })),
  );
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

function openModal() {
  open.value = true;
  selectedMap.value = new Map();
  newPriceMap.value = {};
  productKeyword.value = '';
  pageState.value = { pageNo: 1, pageSize: 20, total: 0 };
  void loadData(1);
}

function handleKeywordSearch(value: string) {
  productKeyword.value = value;
  void loadData(1);
}

function handlePageChange(pageNo: number, pageSize: number) {
  pageState.value = {
    ...pageState.value,
    pageNo,
    pageSize,
  };
  void loadData(pageNo);
}

watch(
  () => props.supplierId,
  () => {
    if (open.value) {
      void loadData();
    }
  },
);

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

defineExpose({ open: openModal });
</script>

<template>
  <Modal
    v-model:open="open"
    class="!w-[85vw]"
    title="选择未开票入库明细（添加明细调价）"
    :ok-text="`确定（已选 ${selectedRows.length} 条）`"
    :confirm-loading="loading"
    @ok="handleOk"
  >
    <div class="mb-3 flex items-center gap-2">
      <Input.Search
        v-model:value="productKeyword"
        allow-clear
        class="w-[320px]"
        placeholder="请输入配件编码、名称、拼音码、五笔码等"
        @search="handleKeywordSearch"
      />
      <a-button :loading="loading" @click="loadData()">刷新</a-button>
      <span class="text-xs text-muted-foreground">
        提示：已完成采购票据开具的入库明细不会显示；已调过的明细会被过滤
      </span>
    </div>
    <Grid class="h-[70vh]" table-title="未开票入库明细">
      <template #newPrice="{ row }">
        <Input
          v-model:value="newPriceMap[row.id]"
          autocomplete="off"
          class="w-full"
          inputmode="decimal"
          @blur="normalizeNewPrice(row)"
        />
      </template>
      <template #adjusted="{ row }">
        <Tag v-if="row.adjusted" color="red">调</Tag>
        <span v-else>-</span>
      </template>
    </Grid>
    <div class="mt-3 flex justify-end">
      <Pagination
        :current="pageState.pageNo"
        :disabled="loading"
        :page-size="pageState.pageSize"
        :page-size-options="PAGE_SIZE_OPTIONS"
        :show-total="(total) => `共 ${total} 条明细`"
        :total="pageState.total"
        show-quick-jumper
        show-size-changer
        size="small"
        @change="handlePageChange"
        @show-size-change="handlePageChange"
      />
    </div>
  </Modal>
</template>
