<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseInApi } from '#/api/erp/purchase/in';

import { computed, nextTick, onBeforeUnmount, ref } from 'vue';

import { Input, InputNumber, message, Modal, Pagination } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getReturnableItemPageByInId } from '#/api/erp/purchase/in';
import { isFormInputTarget } from '#/views/erp/purchase/utils/item-form';

const emit = defineEmits<{
  select: [
    rows: Array<{
      itemRow: ErpPurchaseInApi.ReturnableItem;
      count: number;
    }>,
    sourceIn: ErpPurchaseInApi.PurchaseIn,
  ];
}>();

const open = ref(false);
const loading = ref(false);
const sourceIn = ref<ErpPurchaseInApi.PurchaseIn>();
const dataSource = ref<ErpPurchaseInApi.ReturnableItem[]>([]);
const productKeyword = ref('');
const pageState = ref({ pageNo: 1, pageSize: 20, total: 0 });
const countMap = ref<Record<number, number | undefined>>({});
const selectedMap = ref<Map<number, ErpPurchaseInApi.ReturnableItem>>(
  new Map(),
);
const selectedRows = computed(() => [...selectedMap.value.values()]);
const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];

const columns = computed<VxeTableGridOptions['columns']>(() => [
  { type: 'checkbox', width: 50, fixed: 'left' },
  { field: 'productName', title: '产品名称', minWidth: 180, fixed: 'left' },
  { field: 'sourceInNo', title: '入库单号', width: 180, fixed: 'left' },
  { field: 'productCode', title: '产品编码', width: 130 },
  { field: 'batchNo', title: '批次号', minWidth: 120 },
  { field: 'vehicleModel', title: '车型', minWidth: 120 },
  { field: 'brand', title: '品牌', minWidth: 110 },
  { field: 'drawingNo', title: '图号', minWidth: 110 },
  { field: 'warehousePosition', title: '货架', minWidth: 110 },
  {
    field: 'inCount',
    title: '入库数',
    width: 100,
    formatter: 'formatPurchaseDecimal6',
  },
  {
    field: 'returnedCount',
    title: '已退',
    width: 100,
    formatter: 'formatPurchaseDecimal6',
  },
  {
    field: 'returnableCount',
    title: '可退',
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
    field: 'count',
    title: '退货数量',
    width: 140,
    fixed: 'right',
    slots: { default: 'count' },
  },
]);

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: columns.value,
    data: dataSource.value,
    height: '100%',
    border: true,
    keepSource: true,
    rowConfig: { keyField: 'sourceInItemId', isHover: true },
    checkboxConfig: { highlight: true, range: true },
    pagerConfig: { enabled: false },
    toolbarConfig: { enabled: false },
  } as VxeTableGridOptions<ErpPurchaseInApi.ReturnableItem>,
  gridEvents: {
    checkboxChange: ({
      records,
    }: {
      records: ErpPurchaseInApi.ReturnableItem[];
    }) => {
      syncCurrentPageSelection(records);
    },
    checkboxAll: ({
      records,
    }: {
      records: ErpPurchaseInApi.ReturnableItem[];
    }) => {
      syncCurrentPageSelection(records);
    },
    cellClick: ({
      row,
      column,
    }: {
      column: any;
      row: ErpPurchaseInApi.ReturnableItem;
    }) => {
      if (column?.type === 'checkbox' || column?.field === 'count') {
        return;
      }
      const grid = gridApi.grid;
      grid.toggleCheckboxRow(row);
      syncCurrentPageSelection(grid.getCheckboxRecords());
    },
  },
});

function getRowKey(row: ErpPurchaseInApi.ReturnableItem) {
  return Number(row.sourceInItemId);
}

function syncCurrentPageSelection(records: ErpPurchaseInApi.ReturnableItem[]) {
  const next = new Map(selectedMap.value);
  dataSource.value.forEach((row) => next.delete(getRowKey(row)));
  records.forEach((row) => next.set(getRowKey(row), row));
  selectedMap.value = next;
}

async function restoreCurrentPageSelection() {
  await nextTick();
  const rows = dataSource.value.filter((row) =>
    selectedMap.value.has(getRowKey(row)),
  );
  await gridApi.grid.clearCheckboxRow?.();
  if (rows.length > 0) {
    await gridApi.grid.setCheckboxRow?.(rows, true);
  }
}

async function loadData(pageNo = pageState.value.pageNo) {
  if (!sourceIn.value?.id) {
    return;
  }
  loading.value = true;
  try {
    const pageResult = await getReturnableItemPageByInId({
      inId: sourceIn.value.id,
      productKeyword: productKeyword.value || undefined,
      pageNo,
      pageSize: pageState.value.pageSize,
    });
    dataSource.value = pageResult?.list || [];
    pageState.value = {
      ...pageState.value,
      pageNo,
      total: pageResult?.total || 0,
    };
    const next: Record<number, number | undefined> = { ...countMap.value };
    dataSource.value.forEach((row) => {
      const key = getRowKey(row);
      next[key] = countMap.value[key] ?? Number(row.returnableCount || 0);
    });
    countMap.value = next;
    gridApi.setGridOptions({ data: dataSource.value });
    await gridApi.grid.reloadData(dataSource.value);
    await restoreCurrentPageSelection();
  } finally {
    loading.value = false;
  }
}

function handleOk() {
  if (!sourceIn.value) return;
  if (selectedRows.value.length === 0) {
    message.warning('请至少勾选一条明细');
    return;
  }
  const invalid = selectedRows.value.find((row) => {
    const count = Number(countMap.value[getRowKey(row)]);
    return !count || count <= 0 || count > Number(row.returnableCount || 0);
  });
  if (invalid) {
    message.error(
      `${invalid.productName || invalid.productCode || '所选明细'} 的退货数量必须大于 0 且不超过可退数量`,
    );
    return;
  }
  emit(
    'select',
    selectedRows.value.map((row) => ({
      itemRow: row,
      count: Number(countMap.value[getRowKey(row)]),
    })),
    sourceIn.value,
  );
  open.value = false;
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (!open.value || event.key !== 'Enter' || event.defaultPrevented) return;
  if (isFormInputTarget(event.target)) return;
  event.preventDefault();
  handleOk();
}

function openModal(row: ErpPurchaseInApi.PurchaseIn) {
  sourceIn.value = row;
  selectedMap.value = new Map();
  countMap.value = {};
  productKeyword.value = '';
  pageState.value = { pageNo: 1, pageSize: 20, total: 0 };
  open.value = true;
  void loadData(1);
}

function handleKeywordSearch(value: string) {
  productKeyword.value = value;
  void loadData(1);
}

function handlePageChange(pageNo: number, pageSize: number) {
  pageState.value = { ...pageState.value, pageNo, pageSize };
  void loadData(pageNo);
}

function handleOpenChange(visible: boolean) {
  if (visible) {
    window.addEventListener('keydown', handleWindowKeydown);
  } else {
    window.removeEventListener('keydown', handleWindowKeydown);
  }
}

onBeforeUnmount(() =>
  window.removeEventListener('keydown', handleWindowKeydown),
);

defineExpose({ open: openModal });
</script>

<template>
  <Modal
    v-model:open="open"
    class="!w-[85vw]"
    title="选择可退入库明细"
    :ok-text="`确定（已选 ${selectedRows.length} 条）`"
    :confirm-loading="loading"
    @ok="handleOk"
    @update:open="handleOpenChange"
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
      <span class="text-xs text-muted-foreground"
        >只显示当前入库单中仍有可退数量的明细</span
      >
    </div>
    <Grid class="h-[68vh]" table-title="可退入库明细">
      <template #count="{ row }">
        <InputNumber
          v-model:value="countMap[Number(row.sourceInItemId)]"
          :min="0"
          :max="Number(row.returnableCount || 0)"
          :precision="6"
          class="w-full"
        />
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
