<script setup lang="ts">
/* eslint-disable vue/html-closing-bracket-newline, vue/multiline-html-element-content-newline -- Oxfmt manages multiline template layout. */
import type { TableProps } from 'ant-design-vue';
import type { ColumnType } from 'ant-design-vue/es/table';

import type { StockReportV2Api } from '#/api/erp/report/stock-v2';

import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart } from '@vben/utils';

import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Input,
  Popover,
  Select,
  Table,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  exportStockReportV2,
  getReportProductOptions,
  getStockReportOptions,
  getStockReportPage,
  getStockReportStatus,
  getStockReportSummary,
} from '#/api/erp/report/stock-v2';

import {
  buildReportQuery,
  businessTypeLabels,
  dataStatusLabels,
  defaultPostingRange,
  displayDecimal,
  historicalOptionLabel,
  sourceTargets,
  stockOriginLabel,
  summarizePage,
} from '../report-v2-ui';
import BusinessTypeTable from './business-type-table.vue';
import SourceDetail from './source-detail.vue';

const props = defineProps<{
  refreshKey?: number;
  reportType: StockReportV2Api.ReportType;
}>();
const { hasAccessByCodes } = useAccess();
const canQuery = computed(() => hasAccessByCodes(['erp:stock-record:query']));
const canExport = computed(() => hasAccessByCodes(['erp:stock-record:export']));
const filters = reactive({
  dates: defaultPostingRange() as [string, string] | undefined,
  productId: undefined as number | undefined,
  warehouseId: undefined as number | undefined,
  stockDeptIds: [] as number[],
  bizTypes: [] as number[],
  batchNo: '',
});
const status = ref<StockReportV2Api.Status>();
const error = ref('');
const loading = ref(false);
const exportLoading = ref(false);
const rows = ref<StockReportV2Api.Row[]>([]);
const summary = ref<StockReportV2Api.Summary>();
const pageNo = ref(1);
const pageSize = ref(20);
const total = ref(0);
const sort = ref<{ orderDirection?: 'asc' | 'desc'; orderField?: string }>({});
const applied = ref<StockReportV2Api.Query>();
const sourceDetail = ref<InstanceType<typeof SourceDetail>>();
const products = ref<Array<{ label: string; value: number }>>([]);
const warehouses = ref<
  Array<{ disabled?: boolean; label: string; value: number }>
>([]);
const departments = ref<Array<{ disabled: boolean; id: number; name: string }>>(
  [],
);
let requestVersion = 0;
let optionVersion = 0;
let disposed = false;
const isMovement = computed(() => props.reportType === 'MOVEMENT');
const pageSummary = computed(() => summarizePage(rows.value, props.reportType));
const selectableDeptIds = computed(() =>
  departments.value.filter((row) => !row.disabled).map((row) => row.id),
);
const allDepartments = computed(
  () =>
    selectableDeptIds.value.length > 0 &&
    selectableDeptIds.value.every((id) => filters.stockDeptIds.includes(id)),
);
const partialDepartments = computed(
  () => filters.stockDeptIds.length > 0 && !allDepartments.value,
);
function selectAllDepartments(checked: boolean) {
  filters.stockDeptIds = checked ? [...selectableDeptIds.value] : [];
}

type Field = keyof StockReportV2Api.Row;
interface Column {
  title: string;
  dataIndex: 'product' | 'source' | 'warehouse' | Field;
  key: string;
  width: number;
  sorter?: boolean;
  fixed?: 'left';
}
const quantityColumns: Array<[Field, string]> = [
  ['openingQuantity', '期初数量'],
  ['inQuantity', '入库数量'],
  ['outQuantity', '出库数量'],
  ['closingQuantity', '期末数量'],
];
const financialColumns: Array<[Field, string]> = [
  ['openingFinancialAmount', '期初财务成本'],
  ['financialInAmount', '财务成本增加'],
  ['financialOutAmount', '财务成本减少'],
  ['closingFinancialAmount', '期末财务成本'],
];
const settlementColumns: Array<[Field, string]> = [
  ['openingSettlementAmount', '期初结算成本'],
  ['settlementInAmount', '结算成本增加'],
  ['settlementOutAmount', '结算成本减少'],
  ['closingSettlementAmount', '期末结算成本'],
];
const numericFields = new Set<Field>([
  'balanceQuantity',
  'financialBalance',
  'financialMovement',
  'quantity',
  'settlementBalance',
  'settlementMovement',
  ...quantityColumns.map(([key]) => key),
  ...financialColumns.map(([key]) => key),
  ...settlementColumns.map(([key]) => key),
]);
const columns = computed<Column[]>(() => {
  const base: Column[] = [
    {
      title: '配件',
      dataIndex: 'product',
      key: 'product',
      width: 220,
      fixed: 'left',
    },
    { title: '仓库', dataIndex: 'warehouse', key: 'warehouse', width: 160 },
    {
      title: '库存部门',
      dataIndex: 'stockDeptId',
      key: 'stockDeptId',
      width: 120,
    },
  ];
  const metrics = isMovement.value
    ? [
        ['postedAt', '过账时间'],
        ['postingId', '流水序号'],
        ['bizType', '业务类型'],
        ['bizNo', '业务单据'],
        ['bizItemId', '业务明细编号'],
        ['source', '来源单据'],
        ['sourceBizItemId', '来源明细编号'],
        ['accountingDeptId', '核算部门'],
        ['quantity', '发生数量'],
        ['financialMovement', '财务成本发生额'],
        ['settlementMovement', '结算成本发生额'],
        ['balanceQuantity', '发生后数量'],
        ['financialBalance', '发生后财务成本'],
        ['settlementBalance', '发生后结算成本'],
        ['batchNo', '批次'],
        ['reversalPostingId', '反向关联流水'],
      ]
    : [
        ...quantityColumns,
        ...financialColumns,
        ...settlementColumns,
        ['cutoverAt', '切换时间'],
      ];
  return [
    ...base,
    {
      title: '起点来源',
      dataIndex: 'originKind',
      key: 'originKind',
      width: 165,
    },
    {
      title: '可核算起点时间',
      dataIndex: 'availableFrom',
      key: 'availableFrom',
      width: 215,
    },
    ...metrics.map(([key, title]) => ({
      title: title!,
      dataIndex: key as 'source' | Field,
      key: key!,
      width: key === 'postedAt' || key === 'cutoverAt' ? 175 : 150,
      sorter: isMovement.value && ['postedAt', 'postingId'].includes(key!),
    })),
    {
      title: '数据状态',
      dataIndex: 'dataStatus',
      key: 'dataStatus',
      width: 225,
    },
  ];
});
const summaryFields = computed(
  () =>
    (isMovement.value
      ? [
          ...quantityColumns.slice(1, 3),
          ...financialColumns.slice(1, 3),
          ...settlementColumns.slice(1, 3),
        ]
      : [
          ...quantityColumns,
          ...financialColumns,
          ...settlementColumns,
        ]) as Array<[keyof StockReportV2Api.Summary, string]>,
);
function isMasked(
  row:
    | Pick<
        StockReportV2Api.Row,
        'balanceMasked' | 'financialMasked' | 'settlementMasked'
      >
    | StockReportV2Api.Summary,
  field: string,
) {
  return (
    (field.toLowerCase().includes('financial') && row.financialMasked) ||
    (field.toLowerCase().includes('settlement') && row.settlementMasked) ||
    ('balanceMasked' in row &&
      row.balanceMasked &&
      ['balanceQuantity', 'financialBalance', 'settlementBalance'].includes(
        field,
      ))
  );
}
function departmentName(id?: number) {
  return (
    departments.value.find((row) => row.id === id)?.name ||
    (id === undefined ? '未记录' : `部门 #${id}`)
  );
}
function displayCell(
  row: Record<string, unknown>,
  dataIndex: ColumnType<StockReportV2Api.Row>['dataIndex'],
) {
  if (
    typeof dataIndex !== 'string' ||
    !columns.value.some((column) => column.dataIndex === dataIndex)
  )
    return '未记录';
  const field = dataIndex as Field;
  const value = row[field];
  return numericFields.has(field)
    ? displayDecimal(
        typeof value === 'string' || value === null ? value : undefined,
        !!isMasked(
          {
            financialMasked: row.financialMasked === true,
            settlementMasked: row.settlementMasked === true,
            balanceMasked: row.balanceMasked === true,
          },
          field,
        ),
      )
    : (value ?? '未记录');
}
function canOpen(type?: number, id?: number) {
  const target = type === undefined ? undefined : sourceTargets[type];
  return !!id && !!target && hasAccessByCodes([target.permission]);
}

async function loadProducts(keyword = '') {
  if (!canQuery.value) return;
  const version = ++optionVersion;
  try {
    const result = await getReportProductOptions(keyword, filters.warehouseId);
    if (!disposed && version === optionVersion)
      products.value = result.list.map((row) => ({
        label: `${row.code || ''} ${row.name}`.trim(),
        value: row.id,
      }));
  } catch (error_) {
    if (!disposed && version === optionVersion)
      error.value = error_ instanceof Error ? error_.message : '配件加载失败';
  }
}
async function loadOptions() {
  if (!canQuery.value) return;
  void loadProducts();
  try {
    const { warehouses: warehouseRows, stockDepartments: deptRows } =
      await getStockReportOptions();
    if (disposed || !canQuery.value) return;
    warehouses.value = warehouseRows
      .filter((row) => row.id !== undefined)
      .map((row) => ({
        label: historicalOptionLabel(row),
        value: row.id!,
        disabled: false,
      }));
    departments.value = deptRows
      .filter((row) => row.id !== undefined)
      .map((row) => ({
        id: row.id!,
        name: historicalOptionLabel(row),
        disabled: false,
      }));
  } catch (error_) {
    if (!disposed)
      error.value =
        error_ instanceof Error ? error_.message : '筛选选项加载失败';
  }
}

async function load(checkStatus = false) {
  if (!canQuery.value) return;
  const version = ++requestVersion;
  loading.value = true;
  error.value = '';
  rows.value = [];
  summary.value = undefined;
  total.value = 0;
  try {
    if (checkStatus || !status.value) {
      const result = await getStockReportStatus();
      if (disposed || version !== requestVersion) return;
      status.value = result;
    }
    if (status.value?.status !== 'READY') return;
    const params = {
      ...applied.value!,
      ...sort.value,
      pageNo: pageNo.value,
      pageSize: pageSize.value,
    };
    const [page, all] = await Promise.all([
      getStockReportPage(props.reportType, params),
      getStockReportSummary(props.reportType, { ...applied.value! }),
    ]);
    if (disposed || version !== requestVersion || !canQuery.value) return;
    rows.value = page.list;
    total.value = page.total;
    summary.value = all;
  } catch (error_) {
    if (!disposed && version === requestVersion)
      error.value =
        error_ instanceof Error ? error_.message : '库存报表查询失败';
  } finally {
    if (!disposed && version === requestVersion) loading.value = false;
  }
}
function search(checkStatus = false) {
  if (!canQuery.value) return;
  try {
    applied.value = buildReportQuery(filters);
  } catch (error_) {
    error.value = (error_ as Error).message;
    return;
  }
  pageNo.value = 1;
  void load(checkStatus);
}
function reset() {
  Object.assign(filters, {
    dates: defaultPostingRange(),
    productId: undefined,
    warehouseId: undefined,
    stockDeptIds: [],
    bizTypes: [],
    batchNo: '',
  });
  sort.value = {};
  pageSize.value = 20;
  search(true);
}
function startFromCutover() {
  if (!status.value?.cutoverAt) return;
  const start = dayjs(status.value.cutoverAt);
  if (!start.isValid()) {
    error.value = '切换时间无效，请先核对配置';
    return;
  }
  const end = dayjs(filters.dates?.[1]);
  filters.dates = [
    start.format('YYYY-MM-DD HH:mm:ss'),
    (end.isValid() && end.isAfter(start) ? end : start.add(1, 'day')).format(
      'YYYY-MM-DD HH:mm:ss',
    ),
  ];
  search();
}
const tableChange: NonNullable<TableProps<StockReportV2Api.Row>['onChange']> = (
  pagination,
  _filters,
  sorter,
) => {
  const sorting = Array.isArray(sorter) ? sorter[0] : sorter;
  const allowed = isMovement.value
    ? ['postedAt', 'postingId']
    : ['stockId', 'productId', 'warehouseId'];
  const nextSize = pagination.pageSize || pageSize.value;
  pageNo.value = nextSize === pageSize.value ? pagination.current || 1 : 1;
  pageSize.value = nextSize;
  sort.value =
    typeof sorting?.field === 'string' &&
    sorting.order &&
    allowed.includes(sorting.field)
      ? {
          orderField: sorting.field,
          orderDirection: sorting.order === 'ascend' ? 'asc' : 'desc',
        }
      : {};
  void load();
};
async function exportReport() {
  if (
    !canQuery.value ||
    !canExport.value ||
    exportLoading.value ||
    loading.value ||
    !applied.value ||
    status.value?.status !== 'READY'
  )
    return;
  exportLoading.value = true;
  try {
    const data = await exportStockReportV2(props.reportType, {
      ...applied.value,
      ...sort.value,
    });
    downloadFileFromBlobPart({
      fileName: isMovement.value
        ? '库存流水-新核算.xlsx'
        : '库存收发存-新核算.xlsx',
      source: data,
    });
  } catch (error_) {
    error.value = error_ instanceof Error ? error_.message : '导出失败';
  } finally {
    exportLoading.value = false;
  }
}
onMounted(() => {
  if (canQuery.value) {
    void loadOptions();
    search(true);
  }
});
watch(
  () => filters.warehouseId,
  () => {
    filters.productId = undefined;
    void loadProducts();
  },
);
watch(
  () => props.refreshKey,
  () => search(true),
);
watch(canQuery, (allowed) => {
  if (!allowed) {
    requestVersion++;
    optionVersion++;
    rows.value = [];
    summary.value = undefined;
  }
});
onBeforeUnmount(() => {
  disposed = true;
  requestVersion++;
  optionVersion++;
});
</script>

<template>
  <section class="stock-v2-report">
    <Alert
      v-if="!canQuery"
      type="warning"
      message="没有库存报表查询权限"
      show-icon
    />
    <template v-else>
      <div class="mb-3 flex flex-wrap items-end gap-2">
        <label
          >过账时间（起含止不含）<br /><DatePicker.RangePicker
            v-model:value="filters.dates"
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
            aria-label="过账时间"
        /></label>
        <label
          >配件<br /><Select
            v-model:value="filters.productId"
            class="w-60"
            aria-label="查询配件"
            allow-clear
            show-search
            :filter-option="false"
            :options="products"
            @search="loadProducts"
        /></label>
        <label
          >仓库<br /><Select
            v-model:value="filters.warehouseId"
            class="w-48"
            aria-label="查询仓库"
            allow-clear
            show-search
            option-filter-prop="label"
            :options="warehouses"
        /></label>
        <Popover trigger="click" placement="bottomLeft">
          <template #content>
            <div class="max-h-72 min-w-60 overflow-auto">
              <div class="mb-2 border-b pb-2">
                <Checkbox
                  :checked="allDepartments"
                  :indeterminate="partialDepartments"
                  @change="selectAllDepartments($event.target.checked)"
                >
                  全选可查询库存部门
                </Checkbox>
              </div>
              <Checkbox.Group v-model:value="filters.stockDeptIds">
                <div class="grid grid-cols-2 gap-2">
                  <Checkbox
                    v-for="department in departments"
                    :key="department.id"
                    :value="department.id"
                    :disabled="department.disabled"
                  >
                    {{ department.name
                    }}{{ department.disabled ? '（不可用）' : '' }}
                  </Checkbox>
                </div>
              </Checkbox.Group>
              <span v-if="departments.length === 0">暂无可查询部门</span>
            </div>
          </template>
          <Button>
            库存部门{{
              filters.stockDeptIds.length > 0
                ? `（${filters.stockDeptIds.length}）`
                : ''
            }}
          </Button>
        </Popover>
        <label v-if="isMovement"
          >业务类型<br /><Select
            v-model:value="filters.bizTypes"
            class="w-56"
            mode="multiple"
            allow-clear
            aria-label="查询业务类型"
            :options="
              Object.entries(businessTypeLabels).map(([value, label]) => ({
                label,
                value: Number(value),
              }))
            "
        /></label>
        <label v-if="isMovement"
          >批次号<br /><Input
            v-model:value="filters.batchNo"
            class="w-40"
            allow-clear
            aria-label="查询批次号"
            placeholder="精确批次号"
        /></label>
        <Button type="primary" :loading="loading" @click="search()">
          查询
        </Button>
        <Button @click="reset">重置</Button>
        <Button
          v-if="status?.cutoverAt && status.status === 'READY'"
          @click="startFromCutover"
        >
          从切换时间开始
        </Button>
        <Button
          v-if="canExport"
          :loading="exportLoading"
          :disabled="loading || status?.status !== 'READY'"
          @click="exportReport"
        >
          导出全部
        </Button>
      </div>
      <p class="mb-2 text-xs text-muted-foreground">
        {{
          isMovement
            ? '客户报表10 · 新版库存流水'
            : '客户报表9 · 新版库存收发存'
        }}
        · 金额增加/减少包含零数量成本调整。{{
          status?.cutoverAt ? `核算切换：${status.cutoverAt}` : ''
        }}
      </p>
      <p class="mb-2 text-xs text-muted-foreground">
        人工期初与新库存起点分别标明。本期新增库存按实际可核算起点计入，数量与成本以已确认业务记录为准；未记录起点不会自动按零计算。
      </p>
      <p v-if="applied" class="mb-2 text-xs text-muted-foreground">
        实际查询区间：[{{ applied.postedFrom }}，{{
          applied.postedTo
        }}），开始时间包含，截止时间不包含。
      </p>
      <Alert
        v-if="error"
        class="mb-2"
        type="error"
        :message="error"
        show-icon
      />
      <Alert
        v-if="status && status.status !== 'READY'"
        class="mb-2"
        type="warning"
        :message="status.reason || '新核算尚不可用，请先完成配置及期初核对'"
        show-icon
      >
        <template #action>
          <Button size="small" @click="search(true)"> 重新检查 </Button>
        </template>
      </Alert>
      <Alert
        v-if="summary?.dataStatus === 'INCOMPLETE'"
        class="mb-2"
        type="warning"
        show-icon
        :message="`当前期间数据不完整：未核对期初 ${summary.missingOpeningCount ?? '未知'} 项，超出切换覆盖 ${summary.outsideCoverageCount ?? '未知'} 项，期初待复核 ${summary.staleCount ?? '未知'} 项。不可计算的合计显示不可用。`"
      />
      <Table
        class="stock-v2-report__table"
        :columns="columns"
        :data-source="rows"
        :row-key="
          (row: StockReportV2Api.Row) =>
            String(isMovement ? row.postingId : row.stockId)
        "
        :loading="loading"
        size="small"
        bordered
        :scroll="{ x: 'max-content', y: 'calc(100vh - 445px)' }"
        :pagination="{
          current: pageNo,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['20', '50', '100'],
          showTotal: (count: number) => `共 ${count} 条`,
        }"
        @change="tableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'product'">
            {{
              [record.productCode, record.productName]
                .filter(Boolean)
                .join(' ') || `配件 #${record.productId}`
            }}
          </template>
          <template v-else-if="column.dataIndex === 'warehouse'">
            {{ record.warehouseName || `仓库 #${record.warehouseId}` }}
          </template>
          <template v-else-if="column.dataIndex === 'originKind'">
            {{ stockOriginLabel(record.originKind) }}
          </template>
          <template v-else-if="column.dataIndex === 'availableFrom'">
            {{ record.availableFrom || '未记录起点时间' }}
          </template>
          <template v-else-if="column.dataIndex === 'bizType'">
            {{
              record.bizTypeName ||
              businessTypeLabels[record.bizType] ||
              `业务类型 ${record.bizType}`
            }}
          </template>
          <template
            v-else-if="
              column.dataIndex === 'stockDeptId' ||
              column.dataIndex === 'accountingDeptId'
            "
          >
            {{ departmentName(record[column.dataIndex]) }}
          </template>
          <template v-else-if="column.dataIndex === 'bizNo'">
            <Button
              v-if="canOpen(record.bizType, record.bizId)"
              type="link"
              size="small"
              @click="sourceDetail?.open(record.bizType, record.bizId)"
            >
              {{ record.bizNo || `单据 #${record.bizId}` }} </Button
            ><span v-else>{{ record.bizNo || record.bizId || '未记录' }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'source'">
            <Button
              v-if="canOpen(record.sourceBizType, record.sourceBizId)"
              type="link"
              size="small"
              @click="
                sourceDetail?.open(record.sourceBizType, record.sourceBizId)
              "
            >
              #{{ record.sourceBizId }} </Button
            ><span v-else>{{
              record.sourceBizId ? `#${record.sourceBizId}` : '未记录'
            }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'dataStatus'">
            <Tag :color="record.dataStatus === 'READY' ? 'green' : 'orange'">
              {{
                dataStatusLabels[record.dataStatus] ||
                record.dataStatus ||
                '未记录'
              }}
            </Tag>
          </template>
          <template v-else>
            {{ displayCell(record, column.dataIndex) }}
          </template>
        </template>
        <template v-if="!isMovement" #expandedRowRender="{ record }">
          <BusinessTypeTable
            :title="`库存 #${record.stockId}`"
            :rows="record.byBizType"
            :financial-masked="record.financialMasked"
            :settlement-masked="record.settlementMasked"
          />
        </template>
      </Table>
      <div v-if="summary" class="mt-2 overflow-x-auto" data-testid="totals">
        <table class="summary-table">
          <thead>
            <tr>
              <th>合计范围</th>
              <th v-for="[field, label] in summaryFields" :key="field">
                {{ label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="[label, values] in [
                ['本页合计', pageSummary],
                ['全部合计', summary],
              ] as const"
              :key="label"
            >
              <th>{{ label }}（{{ values.rowCount ?? '未知' }}条）</th>
              <td v-for="[field] in summaryFields" :key="field">
                {{
                  displayDecimal(
                    values[field] as StockReportV2Api.Decimal,
                    !!isMasked(values, field),
                  )
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <template v-if="!isMovement && summary">
        <BusinessTypeTable
          title="本页业务分类合计"
          :rows="pageSummary.byBizType"
          :financial-masked="pageSummary.financialMasked"
          :settlement-masked="pageSummary.settlementMasked"
        />
        <BusinessTypeTable
          title="全部业务分类合计"
          :rows="summary.byBizType"
          :financial-masked="summary.financialMasked"
          :settlement-masked="summary.settlementMasked"
        />
        <p class="mt-1 text-xs text-muted-foreground">
          展开库存行查看该商品仓库的业务分类。收发存导出包含“业务类型发生额”工作表，净发生额保留正负方向。
        </p>
      </template>
      <SourceDetail ref="sourceDetail" />
    </template>
  </section>
</template>

<style scoped>
.stock-v2-report {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  font-size: 13px;
}

.stock-v2-report__table {
  flex: 1 1 auto;
  min-height: 0;
}

.stock-v2-report__table :deep(.ant-spin-container) {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.stock-v2-report__table :deep(.ant-table) {
  flex: 1 1 auto;
}

.stock-v2-report__table :deep(.ant-table-body) {
  min-height: min(520px, max(260px, calc(100vh - 445px)));
}
.summary-table {
  width: 100%;
  border-collapse: collapse;
  white-space: nowrap;
  font-size: 12px;
}
.summary-table th,
.summary-table td {
  border: 1px solid hsl(var(--border));
  padding: 6px 10px;
  text-align: right;
}
.summary-table th {
  background: hsl(var(--muted));
}
</style>
