<script setup lang="ts">
import { provide as provideStockDecimalMode } from 'vue';
const props = defineProps<{
  direction: 'in' | 'out';
  enabled: boolean;
  hiddenFields: string[];
  items: Record<string, any>[];
  loading: boolean;
  orderDirection?: 'asc' | 'desc';
  orderField?: string;
}>();
const emit = defineEmits<{
  refresh: [];
  sort: [value: { field?: string; order?: 'asc' | 'desc' }];
}>();
provideStockDecimalMode('stock-decimal-context', true);
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { isFieldHidden } from '#/composables/useFieldPermission';
import ItemPriceReferenceOverlay from '#/views/erp/components/ItemPriceReferenceOverlay.vue';
import { useItemPriceReferenceShortcut } from '#/views/erp/utils/price-reference';

import { useStockDocumentColumns } from '../utils/document-columns';
import { prepareStockDocumentItemColumns } from '../utils/document-item-table';
import { formatStockNaturalNumber } from '../utils/document-number';
import StockItemDetailActions from './StockItemDetailActions.vue';

const detailActions = ref<InstanceType<typeof StockItemDetailActions>>();
const activeRow = ref<Record<string, any>>();
const renderedItemRows = ref<Record<string, any>[]>([]);
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
});
const { itemTableWrapRef, priceReferenceOpen } = useItemPriceReferenceShortcut({
  isBlocked: () =>
    !props.enabled ||
    props.loading ||
    Boolean(detailActions.value?.isBlockedForPrice()),
});
const numeric = new Set([
  'count',
  'packageQty',
  'pickedCount',
  'remainCount',
  'totalWeight',
  'weight',
  'wholeQty',
]);
// Only persisted columns supported by the item endpoint advertise remote sorting.
const sortable = new Set([
  'barCode',
  'batchNo',
  'brand',
  'count',
  'packageQty',
  'pickedCount',
  'productPrice',
  'remark',
  'sourceNo',
  'status',
  'totalWeight',
  'weight',
]);
function buildColumns() {
  const action = props.direction === 'in' ? '提' : '领';
  const fields = [
    ['productCode', '配件编码'],
    ['productName', '配件名称'],
    ['warehouseName', '仓库'],
    ['count', `历史应${action}数量`],
    ['pickedCount', `历史已${action}数量`],
    ['remainCount', `历史待${action}数量`],
    ['productPrice', '历史单价'],
    ['productUnitName', '单位'],
    ['packageQty', '包装数'],
    ['wholeQty', '整件数'],
    ['weight', '单重'],
    ['totalWeight', '总重'],
    ['batchNo', '批次'],
    ['warehousePosition', '货架位'],
    ['barCode', '条码'],
    ['drawingNo', '图号'],
    ['brand', '品牌'],
    ['vehicleModel', '车型'],
    ['originPlace', '产地'],
    ['status', '历史状态'],
    ['remark', '备注'],
  ];
  const columns = prepareStockDocumentItemColumns(
    fields
      .filter(([field]) => {
        const aliases: Record<string, string> = {
          productCode: 'productId',
          productName: 'productId',
          warehouseName: 'warehouseId',
        };
        const alias = aliases[field!] ?? field;
        if (
          field === 'remainCount' &&
          ['count', 'pickedCount'].some((key) =>
            isFieldHidden(props.hiddenFields, `item_${key}`),
          )
        )
          return false;
        return (
          !isFieldHidden(props.hiddenFields, `item_${field}`) &&
          !isFieldHidden(props.hiddenFields, `item_${alias}`)
        );
      })
      .map(([field, title]) => ({
        field,
        title,
        sortable: sortable.has(field!),
        ...(field === 'status' ? { slots: { default: 'status' } } : {}),
        formatter: ({ cellValue, row }: any) => {
          if (field === 'productPrice') {
            if (row.priceVisible === false || cellValue === '****')
              return '****';
            return cellValue === null ||
              cellValue === undefined ||
              cellValue === ''
              ? '-'
              : formatStockNaturalNumber(cellValue);
          }
          return numeric.has(field!)
            ? formatStockNaturalNumber(cellValue)
            : (cellValue ?? '-');
        },
      })) as any[],
    { editable: false, rows: props.items, trailingFlexibleColumnMinWidth: 150 },
  );
  return columns.map((column: any) => {
    if (!numeric.has(column.field) && column.field !== 'productPrice')
      return column;
    const contentWidth = Math.max(
      0,
      ...props.items.map(
        (row) =>
          String(column.formatter({ cellValue: row[column.field], row }))
            .length *
            8 +
          24,
      ),
    );
    return {
      ...column,
      width: Math.max(
        Number(column.width) || Number(column.minWidth) || 0,
        contentWidth,
      ),
    };
  });
}
const itemColumns = useStockDocumentColumns({
  columns: buildColumns,
  grid: () => gridApi,
  wrapper: () => itemTableWrapRef.value,
  afterReload: async () => {
    for (const column of gridApi.grid?.getFullColumns?.() ?? []) {
      column.order =
        column.field === props.orderField
          ? (props.orderDirection ?? null)
          : null;
    }
    await gridApi.grid?.refreshColumn?.();
  },
});
const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    id: `erp-stock-${props.direction}-bill-item-list-v3`,
    columns: [],
    data: [],
    fit: false,
    height: 440,
    autoResize: true,
    border: true,
    showOverflow: 'tooltip',
    showHeaderOverflow: 'tooltip',
    rowConfig: { keyField: 'id', isCurrent: true, isHover: true, height: 40 },
    headerCellConfig: { height: 40 },
    pagerConfig: { enabled: false },
    customConfig: {
      restoreStore: itemColumns.restoreStore,
      storage: { visible: true, sort: true, resizable: true, fixed: true },
    },
    toolbarConfig: {
      custom: true,
      zoom: true,
      refresh: { queryMethod: () => emit('refresh') },
      slots: { buttons: 'toolbar-buttons' },
    },
    sortConfig: {
      remote: true,
      multiple: false,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
    },
  },
  gridEvents: {
    cellClick: ({ row }: any) => {
      activeRow.value = row;
    },
    currentRowChange: ({ row }: any) => {
      activeRow.value = row;
    },
    custom: itemColumns.custom,
    resizableChange: itemColumns.queue,
    zoom: itemColumns.queue,
    sortChange: ({ field, order }: any) =>
      emit('sort', order ? { field, order } : {}),
  },
});
watch(
  () => props.loading,
  (value) => gridApi.setLoading(value),
);
watch(
  () => [props.items, props.hiddenFields],
  async () => {
    const rows = props.items;
    renderedItemRows.value = rows;
    activeRow.value =
      rows.find((row) => row.id === activeRow.value?.id) ?? rows[0];
    await nextTick();
    await itemColumns.reload();
    if (disposed || rows !== props.items) return;
    await gridApi.grid?.loadData(rows);
    if (activeRow.value) await gridApi.grid?.setCurrentRow?.(activeRow.value);
  },
  { immediate: true },
);
watch(
  () => props.enabled,
  (value) => {
    if (!value) {
      activeRow.value = undefined;
      priceReferenceOpen.value = false;
    }
  },
);
function statusText(status: number) {
  const action = props.direction === 'in' ? '提货' : '领货';
  if (status === 30) return '历史已完成';
  if (status === 20) return `历史部分${action}（待核对）`;
  if (status === 10) return `历史待${action}（待核对）`;
  return '历史状态未记录';
}
</script>
<template>
  <div
    ref="itemTableWrapRef"
    class="historical-bill-items"
    @mousedown.capture="detailActions?.pointer($event)"
  >
    <Grid>
      <template #toolbar-buttons>
        <StockItemDetailActions
          ref="detailActions"
          :active-row="activeRow"
          :hidden-fields="hiddenFields"
          :wrapper="itemTableWrapRef"
          :enabled="enabled && !loading"
          :blocked="priceReferenceOpen"
          @product-updated="itemColumns.reload()"
        />
        <div class="historical-bill-price-hint">
          当前页 W 全部价格（当前参考）
        </div>
      </template>
      <template #status="{ row }">
        {{ statusText((row as any).status) }}
      </template>
    </Grid>
    <ItemPriceReferenceOverlay
      preserve-decimal-precision
      :hidden-fields="hiddenFields"
      :open="priceReferenceOpen"
      :rows="renderedItemRows"
      :table-header-height="40"
      :table-row-height="40"
      :table-wrapper="itemTableWrapRef"
      :visible-rows="10"
    />
  </div>
</template>
<style scoped>
.historical-bill-items {
  position: relative;
}
.historical-bill-price-hint {
  margin-left: 12px;
  color: #64748b;
  font-size: 11px;
}
:deep(.vxe-table),
:deep(.vxe-toolbar) {
  font-size: 11px;
}
:deep(.vxe-body--row) {
  height: 40px;
}
</style>
