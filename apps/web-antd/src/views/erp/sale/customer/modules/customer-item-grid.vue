<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

import { formatDate, formatDateTime } from '@vben/utils';

import { useResizeObserver } from '@vueuse/core';
import { Alert } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { prepareErpArchiveItemColumns } from '#/views/erp/base/utils/archive-list-table';
import {
  applyPurchaseDocumentListColumnCustomization,
  releasePurchaseDocumentTrailingColumnResize,
  syncPurchaseDocumentColumnDefaults,
  syncPurchaseDocumentOperationColumn,
} from '#/views/erp/purchase/utils/document-list-table';
import { settleVxeColumnCustomization } from '#/views/erp/utils/vxe-column-custom';

const props = defineProps<{
  active: boolean;
  api: (params: any) => Promise<{ list: any[]; total: number }>;
  canMaintain: boolean;
  columns: any[];
  gridKey: string;
  actionWidth?: number;
  params?: Record<string, any>;
  customerId?: number;
}>();
const emit = defineEmits<{ loaded: [rows: any[]] }>();
const shell = ref<HTMLElement>();
const rows = ref<any[]>([]);
const total = ref(0);
const loadError = ref('');
let sequence = 0;
let mounted = false;
let loadedCustomer: number | undefined;
const customSlots = new Set([
  'actions',
  'attachmentUrl',
  'defaulted',
  'flags',
  'imageUrl',
  'importance',
  'gender',
  'status',
  'source',
  'rawData',
  'mainContract',
  'rebateEnabled',
  'freightSettleMethod',
]);
const numericFields = new Set([
  'amount',
  'baseAmount',
  'commissionRate',
  'month',
  'sort',
  'taskAmount',
  'year',
]);
const moneyFields = new Set(['amount', 'baseAmount']);
const title = computed(() =>
  props.columns
    .map((column) => column.title)
    .filter(Boolean)
    .join('、'),
);

function displayValue(field: string, value: any, row: Record<string, any>) {
  if (field === 'flags')
    return [
      ['primaryContact', '主联系人'],
      ['receiverContact', '收货'],
      ['settleContact', '结算'],
      ['messageContact', '消息'],
      ['salesperson', '业务员'],
    ]
      .filter(([key]) => row[key!])
      .map(([, label]) => label)
      .join('  ');
  if (value === null || value === undefined || value === '') return '-';
  if (field === 'imageUrl') return '图片';
  if (field === 'attachmentUrl') return '查看附件';
  if (field === 'importance')
    return (
      ({ 1: '普通', 2: '重要', 3: '决策人' } as Record<number, string>)[
        value
      ] ?? '-'
    );
  if (numericFields.has(field) && Number.isFinite(Number(value)))
    return moneyFields.has(field)
      ? Number(value).toFixed(2)
      : String(Number(value));
  if (field.endsWith('Date')) return formatDate(value) || value;
  if (field.endsWith('Time')) return formatDateTime(value) || value;
  return typeof value === 'boolean' ? (value ? '是' : '否') : value;
}
function buildColumns(preserve = true) {
  const measured = props.columns.map((column) => ({
    ...column,
    formatter: ({ cellValue, row }: any) =>
      displayValue(column.dataIndex ?? column.field, cellValue, row),
  }));
  const prepared = prepareErpArchiveItemColumns(measured, {
    rows: rows.value,
  }).map((column: any) => {
    const field = column.dataIndex ?? column.field;
    return {
      ...column,
      field,
      slots: customSlots.has(field) ? { default: 'cell' } : undefined,
      ...(field === 'actions'
        ? {
            fixed: 'right',
            width: props.actionWidth ?? 106,
            resizable: false,
            visible: props.canMaintain,
          }
        : {}),
    };
  });
  return applyPurchaseDocumentListColumnCustomization(
    prepared,
    preserve ? (gridApi.grid?.getFullColumns?.() ?? prepared) : prepared,
    90,
  );
}
async function reloadColumns(preserve = true) {
  const columns = buildColumns(preserve);
  await gridApi.grid?.reloadColumn?.(columns);
  syncPurchaseDocumentColumnDefaults(
    gridApi.grid?.getFullColumns?.() ?? [],
    buildColumns(false),
  );
  await syncPurchaseDocumentOperationColumn(gridApi.grid, columns);
  const action = gridApi.grid
    ?.getFullColumns?.()
    .find((column: any) => column.field === 'actions');
  if (action) action.resizeWidth = 0;
  releasePurchaseDocumentTrailingColumnResize(
    gridApi.grid?.getFullColumns?.() ?? [],
  );
  await nextTick();
  await gridApi.grid?.recalculate?.(true);
}
async function handleCustom({ type }: { type?: string }) {
  if (await settleVxeColumnCustomization(gridApi.grid, type))
    await reloadColumns(type !== 'reset');
}
const [Grid, gridApi] = useVbenVxeGrid({
  tableTitle: '资料列表',
  gridOptions: {
    id: `erp-customer-items-${props.gridKey}-v1`,
    columns: props.columns.map((column) => ({
      ...column,
      field: column.dataIndex,
      ...(column.dataIndex === 'actions'
        ? { visible: props.canMaintain, fixed: 'right' }
        : {}),
    })),
    fit: true,
    autoResize: true,
    height: 'auto',
    rowConfig: {
      keyField: 'id',
      isHover: true,
      height: props.gridKey === 'images' ? 64 : 40,
    },
    showOverflow: 'tooltip',
    showHeaderOverflow: 'tooltip',
    customConfig: {
      storage: { visible: true, sort: true, fixed: true, resizable: true },
    },
    pagerConfig: { pageSize: 20, pageSizes: [20, 50, 100] },
    toolbarConfig: { refresh: true, zoom: true, custom: true },
    proxyConfig: {
      autoLoad: false,
      ajax: {
        query: async ({ page }: any) => {
          const request = ++sequence;
          const customerId = props.customerId;
          if (!customerId) return { list: [], total: 0 };
          try {
            const result = await props.api({
              ...props.params,
              customerId,
              pageNo: page.currentPage,
              pageSize: page.pageSize,
            });
            if (request !== sequence || customerId !== props.customerId)
              return { list: rows.value, total: total.value };
            rows.value = result.list ?? [];
            total.value = result.total ?? 0;
            loadError.value = '';
            loadedCustomer = customerId;
            emit('loaded', rows.value);
            await reloadColumns();
            return result;
          } catch (error) {
            if (request === sequence)
              loadError.value = '关联资料加载失败，请点击刷新重试';
            throw error;
          }
        },
      },
    },
  },
  gridEvents: { custom: handleCustom },
});
watch(
  () => [props.active, props.customerId] as const,
  async ([active, id], old) => {
    if (id !== old?.[1]) {
      sequence += 1;
      rows.value = [];
      total.value = 0;
      loadedCustomer = undefined;
      gridApi.setGridOptions({ pagerConfig: { currentPage: 1 } });
    }
    if (mounted && active && id && loadedCustomer !== id) await gridApi.query();
  },
  { immediate: true, flush: 'post' },
);
onMounted(() => {
  mounted = true;
  if (props.active && props.customerId) void gridApi.query();
});
watch(
  () => props.canMaintain,
  () => reloadColumns(),
);
useResizeObserver(shell, () => {
  void gridApi.grid?.recalculate?.(true);
});
onBeforeUnmount(() => {
  mounted = false;
  sequence += 1;
});

async function refreshCurrent(deleted = false) {
  if (deleted && rows.value.length === 1) {
    const page = gridApi.grid?.getProxyInfo?.()?.pager?.currentPage ?? 1;
    gridApi.setGridOptions({
      pagerConfig: { currentPage: Math.max(1, page - 1) },
    });
  }
  await gridApi.query();
}
defineExpose({ refreshCurrent });
</script>

<template>
  <div ref="shell" class="customer-item-grid" :aria-label="title">
    <Alert v-if="loadError" :message="loadError" type="error" show-icon />
    <Grid>
      <template #cell="{ row, column }">
        <slot
          name="bodyCell"
          :record="row"
          :column="{ ...column, dataIndex: column.field }"
        ></slot>
      </template>
    </Grid>
  </div>
</template>

<style scoped>
.customer-item-grid {
  height: min(52vh, 520px);
  min-height: 280px;
  font-size: 12px;
}
:deep(.vxe-table),
:deep(.vxe-pager),
:deep(.ant-btn-link) {
  font-size: 12px;
}
:deep(.vxe-body--column .ant-btn-link) {
  height: auto;
  padding: 0 3px;
}
</style>
