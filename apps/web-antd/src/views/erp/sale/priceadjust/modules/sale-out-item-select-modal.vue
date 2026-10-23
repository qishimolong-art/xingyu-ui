<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpSalePriceAdjustApi } from '#/api/erp/sale/priceadjust';

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { formatSaleAmount } from '../../utils/decimal';

import { Button, Input, message, Modal, Pagination, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getAdjustableItemPage } from '#/api/erp/sale/priceadjust';
import { applySaleSelectColumnPermission } from '#/views/erp/sale/utils/field-permission';
import { shouldConfirmOnEnter } from '#/views/erp/sale/utils/keyboard';

import { refreshSalePriceAdjustGridColumns } from './sale-price-adjust-grid-lifecycle';

interface Props {
  open: boolean;
  customerId?: number;
  hiddenFields?: string[];
  saleOutId?: number;
  mainDeptId?: number;
}

type SaleOutItemSelectRow = ErpSalePriceAdjustApi.SaleOutItemForAdjust & {
  rowKey: string;
};

const props = withDefaults(defineProps<Props>(), {
  hiddenFields: () => [],
});
const emit = defineEmits<{
  'update:open': [value: boolean];
  select: [items: ErpSalePriceAdjustApi.SaleOutItemForAdjust[]];
}>();

const loading = ref(false);
const dataSource = ref<SaleOutItemSelectRow[]>([]);
const productKeyword = ref('');
const pageState = ref({ pageNo: 1, pageSize: 20, total: 0 });
const selectedMap = ref<Map<string, SaleOutItemSelectRow>>(new Map());
const selectedRows = computed(() => [...selectedMap.value.values()]);
const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];
let isEnterListening = false;

const selectedCount = computed(() => selectedRows.value.length);

const columns: VxeTableGridOptions<SaleOutItemSelectRow>['columns'] = [
  { type: 'checkbox', width: 50, fixed: 'left' },
  {
    field: 'productName',
    title: '配件名称',
    minWidth: 180,
    fixed: 'left',
    slots: { default: 'productName' },
  },
  { field: 'saleOutNo', title: '销售单号', width: 170, fixed: 'left' },
  {
    field: 'outTime',
    title: '销售时间',
    width: 160,
    formatter: 'formatDate',
  },
  { field: 'productCode', title: '配件编码', width: 140 },
  { field: 'vehicleModel', title: '车型', minWidth: 120 },
  { field: 'originPlace', title: '产地', minWidth: 110 },
  { field: 'brand', title: '品牌', minWidth: 120 },
  { field: 'unitName', title: '单位', width: 80 },
  {
    field: 'warehouseName',
    title: '仓库',
    minWidth: 120,
    slots: { default: 'warehouseName' },
  },
  { field: 'batchNo', title: '批次号', width: 120 },
  {
    field: 'count',
    title: '出库数',
    width: 100,
    formatter: 'formatAmount3',
  },
  {
    field: 'productPrice',
    title: '当前售价',
    width: 110,
    slots: { default: 'productPrice' },
  },
  {
    field: 'adjusted',
    title: '已调',
    width: 80,
    fixed: 'right',
    slots: { default: 'adjusted' },
  },
];

const permittedColumns = computed(() =>
  applySaleSelectColumnPermission(columns || [], props.hiddenFields),
);

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: permittedColumns.value,
    data: dataSource.value,
    height: '100%',
    border: true,
    keepSource: true,
    rowConfig: { keyField: 'rowKey', isHover: true },
    checkboxConfig: {
      highlight: true,
      range: true,
      checkMethod: ({ row }) => !row.adjusted,
    },
    rowClassName: ({
      row,
    }: {
      row: ErpSalePriceAdjustApi.SaleOutItemForAdjust;
    }) => (row.adjusted ? 'opacity-50' : ''),
    pagerConfig: { enabled: false },
    toolbarConfig: { enabled: false },
  } as VxeTableGridOptions<SaleOutItemSelectRow>,
  gridEvents: {
    checkboxChange: ({ records }: { records: SaleOutItemSelectRow[] }) => {
      syncCurrentPageSelection(records);
    },
    checkboxAll: ({ records }: { records: SaleOutItemSelectRow[] }) => {
      syncCurrentPageSelection(records);
    },
    cellClick: ({
      row,
      column,
    }: {
      column: any;
      row: SaleOutItemSelectRow;
    }) => {
      if (column?.type === 'checkbox' || row.adjusted) {
        return;
      }
      const grid = gridApi.grid;
      grid.toggleCheckboxRow(row);
      syncCurrentPageSelection(grid.getCheckboxRecords());
    },
  },
});

async function refreshPermittedColumns(hiddenFields = props.hiddenFields) {
  const nextColumns =
    applySaleSelectColumnPermission(columns || [], hiddenFields) || [];
  await refreshSalePriceAdjustGridColumns({
    columns: nextColumns,
    isOpen: props.open,
    nextTick,
    reloadColumns:
      typeof gridApi.grid?.reloadColumn === 'function'
        ? (value) => gridApi.grid.reloadColumn(value)
        : undefined,
    setColumns: (value) => gridApi.setGridOptions({ columns: value }),
  });
}

watch(
  () => props.hiddenFields,
  (hiddenFields) => {
    void refreshPermittedColumns(hiddenFields);
  },
);

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      startEnterListening();
    } else {
      stopEnterListening();
      return;
    }
    selectedMap.value = new Map();
    productKeyword.value = '';
    pageState.value = { pageNo: 1, pageSize: 20, total: 0 };
    await nextTick();
    await refreshPermittedColumns();
    await loadData(1);
  },
  { immediate: true },
);

function syncCurrentPageSelection(records: SaleOutItemSelectRow[]) {
  const next = new Map(selectedMap.value);
  dataSource.value.forEach((row) => next.delete(row.rowKey));
  records.forEach((row) => next.set(row.rowKey, row));
  selectedMap.value = next;
}

async function restoreCurrentPageSelection() {
  await nextTick();
  const rows = dataSource.value.filter((row) =>
    selectedMap.value.has(row.rowKey),
  );
  await gridApi.grid.clearCheckboxRow?.();
  if (rows.length > 0) {
    await gridApi.grid.setCheckboxRow?.(rows, true);
  }
}

async function loadData(pageNo = pageState.value.pageNo) {
  dataSource.value = [];
  await nextTick();
  await gridApi.grid.clearCheckboxRow?.();
  gridApi.setGridOptions({ data: dataSource.value });
  await gridApi.grid.reloadData(dataSource.value);
  if (!props.customerId) {
    message.warning('请先选择客户');
    return;
  }
  loading.value = true;
  try {
    const pageResult = await getAdjustableItemPage({
      customerId: props.customerId,
      saleOutId: props.saleOutId,
      excludeAdjusted: true,
      productKeyword: productKeyword.value || undefined,
      pageNo,
      pageSize: pageState.value.pageSize,
    });
    dataSource.value = (pageResult?.list || []).map((item) => ({
      ...item,
      rowKey: getRowKey(item),
    }));
    pageState.value = {
      ...pageState.value,
      pageNo,
      total: pageResult?.total || 0,
    };
    gridApi.setGridOptions({ data: dataSource.value });
    await gridApi.grid.reloadData(dataSource.value);
    await restoreCurrentPageSelection();
  } finally {
    loading.value = false;
  }
}

function getRowKey(record: ErpSalePriceAdjustApi.SaleOutItemForAdjust) {
  return `${record.saleOutId}_${record.saleOutItemId}`;
}

function handleOk() {
  if (selectedRows.value.length === 0) {
    message.warning('请至少勾选一条明细');
    return;
  }
  emit(
    'select',
    selectedRows.value.map(({ rowKey: _rowKey, ...item }) => item),
  );
  emit('update:open', false);
}

function handleCancel() {
  emit('update:open', false);
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

function handleEnterConfirm(event: KeyboardEvent) {
  if (!shouldConfirmOnEnter(event, props.open && selectedCount.value > 0)) {
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
  <Modal
    :open="open"
    title="选择调价明细"
    class="!w-[85vw]"
    :confirm-loading="loading"
    @ok="handleOk"
    @cancel="handleCancel"
  >
    <template #footer>
      <Button @click="handleCancel">取消</Button>
      <Button type="primary" :disabled="selectedCount === 0" @click="handleOk">
        确定（已选 {{ selectedCount }} 条）
      </Button>
    </template>
    <div class="mb-3 flex items-center gap-2">
      <Input.Search
        v-model:value="productKeyword"
        allow-clear
        class="w-[320px]"
        placeholder="请输入配件编码、名称、拼音码、五笔码等"
        @search="handleKeywordSearch"
      />
      <Button :loading="loading" @click="loadData()">刷新</Button>
      <span class="text-xs text-muted-foreground">
        提示：已调价的明细会被过滤；勾选销售出库明细后带入调价单
      </span>
    </div>
    <Grid class="h-[70vh]" table-title="可调价销售出库明细">
      <template #productPrice="{ row }">
        {{ formatSaleAmount(row.productPrice, '-') }}
      </template>
      <template #productName="{ row }">
        <div class="flex flex-wrap items-center gap-1">
          <span>{{ row.productName || '-' }}</span>
          <Tag
            v-if="
              props.mainDeptId &&
              row.warehouseDeptId &&
              props.mainDeptId !== row.warehouseDeptId
            "
            color="orange"
            class="m-0"
          >
            跨部门
          </Tag>
        </div>
      </template>
      <template #warehouseName="{ row }">
        <span>{{ row.warehouseName || '-' }}</span>
      </template>
      <template #adjusted="{ row }">
        <Tag v-if="row.adjusted" color="red">已调</Tag>
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
