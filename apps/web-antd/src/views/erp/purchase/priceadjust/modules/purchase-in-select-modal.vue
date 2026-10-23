<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseInApi } from '#/api/erp/purchase/in';

import { computed, onBeforeUnmount, ref, watch } from 'vue';


import { Input, message, Modal, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getApprovedPurchaseInsBySupplier } from '#/api/erp/purchase/in';
import { formatPurchaseAmount,
  formatPurchaseDecimal,
  parsePurchaseDecimal,
  purchaseDecimalDivide,
  purchaseDecimalMultiply,
} from '#/views/erp/purchase/utils/decimal';
import { isFormInputTarget } from '#/views/erp/purchase/utils/item-form';

interface Props {
  supplierId?: number;
  /** 父组件已加入到子表的入库单 ID 列表，用于禁用避免重复添加 */
  usedInIds?: number[];
}

const props = withDefaults(defineProps<Props>(), {
  supplierId: undefined,
  usedInIds: () => [],
});
const emit = defineEmits<{
  select: [
    rows: Array<{
      inRow: ErpPurchaseInApi.PurchaseInForAdjust;
      adjustRatio: number;
    }>,
  ];
}>();

const open = ref(false);
const loading = ref(false);
const dataSource = ref<ErpPurchaseInApi.PurchaseInForAdjust[]>([]);
/** inId -> 比率（%） */
const ratioMap = ref<Record<number, string>>({});
/** 顶部"批量设置比率"输入 */
const batchRatio = ref('100');
const selectedRows = ref<ErpPurchaseInApi.PurchaseInForAdjust[]>([]);

/** 已加入的 inId Set（用于行禁用判断） */
const usedInIdSet = computed(() => new Set(props.usedInIds || []));
function isRowUsed(row: ErpPurchaseInApi.PurchaseInForAdjust): boolean {
  return usedInIdSet.value.has(row.id);
}

function previewNewTotal(row: ErpPurchaseInApi.PurchaseInForAdjust): number {
  const r = Number(ratioMap.value[row.id]);
  if (!Number.isFinite(r)) return 0;
  return purchaseDecimalMultiply(
    row.totalProductPrice || 0,
    purchaseDecimalDivide(r, 100),
  );
}

function parseRatio(value: unknown) {
  const parsed = parsePurchaseDecimal(value, '调价比率', { min: 0 });
  return parsed.ok ? parsed.value : undefined;
}

function normalizeRatio(id?: number) {
  const value = id === undefined ? batchRatio.value : ratioMap.value[id];
  const parsed = parseRatio(value);
  if (parsed === undefined) {
    message.warning('调价比率必须为非负数字，最多 6 位小数');
    if (id === undefined) batchRatio.value = '100';
    else ratioMap.value[id] = '100';
    return;
  }
  const normalized = formatPurchaseDecimal(parsed, '0');
  if (id === undefined) batchRatio.value = normalized;
  else ratioMap.value[id] = normalized;
}

const columns = computed<VxeTableGridOptions['columns']>(() => [
  { type: 'checkbox', width: 50, fixed: 'left' },
  { field: 'no', title: '入库单号', width: 190, fixed: 'left' },
  {
    field: 'inTime',
    title: '入库时间',
    width: 160,
    formatter: 'formatDate',
  },
  { field: 'invoiceType', title: '开票类型', width: 130 },
  { field: 'auditorName', title: '审批人', width: 110 },
  {
    field: 'approveTime',
    title: '审批日期',
    width: 160,
    formatter: 'formatDate',
  },
  {
    field: 'totalProductPrice',
    title: '原金额合计',
    width: 130,
    formatter: 'formatPurchaseDecimal6',
  },
  {
    field: 'adjustRatio',
    title: '调价比率(%) ★',
    width: 160,
    headerClassName: 'text-orange-600 font-semibold',
    slots: { default: 'adjustRatio' },
  },
  {
    field: 'previewTotal',
    title: '调整后金额预览',
    width: 150,
    slots: { default: 'previewTotal' },
  },
  { field: 'itemCount', title: '明细行数', width: 100 },
  {
    field: 'adjusted',
    title: '是否已调过',
    width: 120,
    slots: { default: 'adjusted' },
  },
  {
    field: 'usedInForm',
    title: '是否已加入',
    width: 120,
    slots: { default: 'usedInForm' },
  },
  { field: 'remark', title: '备注', minWidth: 140, showOverflow: 'tooltip' },
]);

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: columns.value,
    data: dataSource.value,
    height: '100%',
    border: true,
    keepSource: true,
    rowConfig: { keyField: 'id', isHover: true },
    checkboxConfig: {
      highlight: true,
      range: true,
      // 已加入子表的入库单禁止再次勾选
      checkMethod: ({ row }) => !isRowUsed(row),
    },
    rowClassName: ({ row }: { row: ErpPurchaseInApi.PurchaseInForAdjust }) =>
      isRowUsed(row) ? 'opacity-50' : '',
    pagerConfig: { enabled: false },
    toolbarConfig: { enabled: false },
  } as VxeTableGridOptions<ErpPurchaseInApi.PurchaseInForAdjust>,
  gridEvents: {
    checkboxChange: ({
      records,
    }: {
      records: ErpPurchaseInApi.PurchaseInForAdjust[];
    }) => {
      selectedRows.value = records;
    },
    checkboxAll: ({
      records,
    }: {
      records: ErpPurchaseInApi.PurchaseInForAdjust[];
    }) => {
      selectedRows.value = records;
    },
    cellClick: ({
      row,
      column,
    }: {
      column: any;
      row: ErpPurchaseInApi.PurchaseInForAdjust;
    }) => {
      if (column?.type === 'checkbox' || column?.field === 'adjustRatio') {
        return;
      }
      const grid = gridApi.grid;
      grid.toggleCheckboxRow(row);
      selectedRows.value = grid.getCheckboxRecords();
    },
  },
});

async function loadData() {
  if (!props.supplierId) {
    message.warning('请先选择供应商');
    return;
  }
  loading.value = true;
  try {
    const list = await getApprovedPurchaseInsBySupplier(props.supplierId);
    const availableList = (list || []).filter((row) => !row.hasInvoice);
    dataSource.value = availableList;
    // 初始化每行比率默认 100 = 不调
    const next: Record<number, string> = {};
    availableList.forEach((row) => {
      next[row.id] = ratioMap.value[row.id] ?? '100';
    });
    ratioMap.value = next;
    selectedRows.value = [];
    gridApi.setGridOptions({ data: dataSource.value });
    await gridApi.grid.reloadData(dataSource.value);
  } finally {
    loading.value = false;
  }
}

function applyBatchRatio() {
  const parsed = parseRatio(batchRatio.value);
  if (parsed === undefined) {
    message.warning('请输入非负比率，最多 6 位小数');
    return;
  }
  if (selectedRows.value.length === 0) {
    message.warning('请先勾选要批量设置的入库单');
    return;
  }
  const val = formatPurchaseDecimal(parsed, '0');
  batchRatio.value = val;
  selectedRows.value.forEach((row) => {
    ratioMap.value[row.id] = val;
  });
}

function handleOk() {
  if (selectedRows.value.length === 0) {
    message.warning('请至少勾选一张入库单');
    return;
  }
  const invalid = selectedRows.value.find(
    (row) => parseRatio(ratioMap.value[row.id]) === undefined,
  );
  if (invalid) {
    message.error(`入库单 ${invalid.no} 调价比率必须为非负数字，最多 6 位小数`);
    return;
  }
  emit(
    'select',
    selectedRows.value.map((row) => ({
      inRow: row,
      adjustRatio: parseRatio(ratioMap.value[row.id]) as number,
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
  selectedRows.value = [];
  batchRatio.value = '100';
  // 打开后加载
  void loadData();
}

// 供应商变更时，若弹窗正打开，重拉数据
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
    title="选择未开票采购入库单（按入库单调价）"
    :ok-text="`确定（已选 ${selectedRows.length} 条）`"
    :confirm-loading="loading"
    @ok="handleOk"
  >
    <div
      class="mb-3 flex items-center gap-2 rounded border border-orange-300 bg-orange-50 p-2"
    >
      <span class="text-sm font-semibold text-orange-700"
        >★ 批量设置调价比率(%)：</span
      >
      <Input
        v-model:value="batchRatio"
        autocomplete="off"
        inputmode="decimal"
        placeholder="如 110 表示提升 10%"
        class="w-44"
        @blur="normalizeRatio()"
      />
      <a-button type="primary" @click="applyBatchRatio">
        应用到所有选中行
      </a-button>
      <a-button :loading="loading" @click="loadData">刷新</a-button>
      <span class="ml-auto text-xs text-orange-700">
        提示：已完成采购票据开具的入库单不会显示；比率=100 不调；150 提升
        50%；80 下调 20%。
      </span>
    </div>
    <Grid class="h-[70vh]" table-title="未开票采购入库单">
      <template #adjustRatio="{ row }">
        <Input
          v-if="!isRowUsed(row)"
          v-model:value="ratioMap[row.id]"
          autocomplete="off"
          inputmode="decimal"
          placeholder="请输入比率%"
          class="w-full !border-orange-400 hover:!border-orange-500 focus:!border-orange-500"
          @blur="normalizeRatio(row.id)"
        />
        <span v-else class="text-gray-400">-</span>
      </template>
      <template #previewTotal="{ row }">
        <span>{{ formatPurchaseAmount(previewNewTotal(row), '-') }}</span>
      </template>
      <template #adjusted="{ row }">
        <Tag v-if="row.adjusted" color="red">（调）</Tag>
        <span v-else>-</span>
      </template>
      <template #usedInForm="{ row }">
        <Tag v-if="isRowUsed(row)" color="default">已加入</Tag>
        <span v-else>-</span>
      </template>
    </Grid>
  </Modal>
</template>
