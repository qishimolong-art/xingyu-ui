<script setup lang="ts">
import type { TableProps } from 'ant-design-vue';
import type { ColumnType } from 'ant-design-vue/es/table';

import type { TradeReportApi } from '#/api/erp/report/trade-v2';

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
  DatePicker,
  Input,
  Select,
  Table,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  exportTradeReport,
  getTradePage,
  getTradeStatus,
} from '#/api/erp/report/trade-v2';
import SourceDetail from '#/views/erp/stock/report/modules/source-detail.vue';
import {
  buildReportQuery,
  defaultPostingRange,
} from '#/views/erp/stock/report/report-v2-ui';

import FilterChoice from './filter-choice.vue';
import {
  businessTypes,
  cellReason,
  groupLabels,
  numericLabels,
  pageTotals,
  referenceTarget,
  sourceTypes,
  totalFields,
  tradeCell,
} from './trade-ui';

type TradeReportView = 'DETAIL' | 'GROUP';

const props = withDefaults(
  defineProps<{
    initialGroupBy?: string;
    initialView?: TradeReportView;
    kind: TradeReportApi.Kind;
    reportDescription?: string;
    reportTitle?: string;
  }>(),
  {
    initialGroupBy: 'PRODUCT',
    initialView: 'DETAIL',
    reportDescription: '',
    reportTitle: '',
  },
);
const { hasAccessByCodes } = useAccess();
const canQuery = computed(() =>
  hasAccessByCodes([`erp:${props.kind}-report-v2:query`]),
);
const canExport = computed(() =>
  hasAccessByCodes([`erp:${props.kind}-report-v2:export`]),
);
const status = ref<TradeReportApi.Status>();
const loading = ref(false);
const exporting = ref(false);
const error = ref('');
const filters = reactive({
  dates: defaultPostingRange() as [string, string] | undefined,
  bizNo: '',
  productId: undefined as number | undefined,
  partyId: undefined as number | undefined,
  saleUserId: undefined as number | undefined,
  purchaser: undefined as string | undefined,
  brand: undefined as string | undefined,
  oeNumber: '',
  categoryId: undefined as number | undefined,
  accountingDeptIds: [] as number[],
  stockDeptIds: [] as number[],
  warehouseIds: [] as number[],
  businessTypes: [] as string[],
  noOriginalSale: undefined as boolean | undefined,
});
const view = ref<TradeReportView>(props.initialView);
const groupBy = ref(props.initialGroupBy);
const rows = ref<TradeReportApi.Row[]>([]);
const summary = ref<TradeReportApi.Row>();
const context = ref<TradeReportApi.Bundle['queryContext']>();
const total = ref(0);
const pageNo = ref(1);
const pageSize = ref(10);
const applied = ref<TradeReportApi.Query>();
const source = ref<InstanceType<typeof SourceDetail>>();
const previousGroup = ref<TradeReportApi.Query>();
let version = 0;
const caliberNotice = computed(() =>
  props.kind === 'sale'
    ? {
        message: '销售价暂按含税金额展示，税率及不含税经营口径待客户最终确认。',
        description:
          '毛利率按当前可用成本快照计算；最低售价、客户评分、回款率等正式规则后续配置化后再启用。缺失成本不会按零成本生成高毛利。',
      }
    : {
        message:
          '采购价暂按含税金额展示，税率及不含税入库成本口径待客户最终确认。',
        description:
          '采购退货按退货时平均成本扣库存，供应商退款差额单列损益；供应商评分、费用分摊等正式规则后续配置化后再启用。缺失成本不会按零成本生成高收益。',
      },
);
const reportHeading = computed(
  () =>
    props.reportTitle ||
    (props.kind === 'sale' ? '销售商品综合表' : '采购商品综合表'),
);
const reportDescriptionText = computed(
  () =>
    props.reportDescription ||
    (props.kind === 'sale'
      ? '统一展示销售出库、销售退货、商品、客户、部门、仓库、业务员和金额成本字段。'
      : '统一展示采购入库、采购退货、商品、供应商、部门、仓库、采购员和金额成本字段。'),
);
const noOriginalValue = computed({
  get: () =>
    filters.noOriginalSale === undefined
      ? undefined
      : filters.noOriginalSale
        ? 'yes'
        : 'no',
  set: (value: string | undefined) => {
    filters.noOriginalSale = value === undefined ? undefined : value === 'yes';
  },
});
const groupOptions = computed(() =>
  Object.entries(groupLabels)
    .filter(([key]) =>
      props.kind === 'sale'
        ? !['PURCHASER', 'SUPPLIER'].includes(key)
        : !['CUSTOMER', 'SALE_USER'].includes(key),
    )
    .map(([value, label]) => ({ value, label })),
);
function buildQuery(): TradeReportApi.Query {
  const dates = buildReportQuery({ dates: filters.dates });
  return {
    postedFrom: dates.postedFrom,
    postedTo: dates.postedTo,
    pageNo: 1,
    pageSize: pageSize.value,
    groupBy: groupBy.value,
    orderField: 'postedAt',
    orderDirection: 'desc',
    bizNo: filters.bizNo || undefined,
    productId: filters.productId,
    customerId: props.kind === 'sale' ? filters.partyId : undefined,
    supplierId: props.kind === 'purchase' ? filters.partyId : undefined,
    saleUserId: props.kind === 'sale' ? filters.saleUserId : undefined,
    purchaser: props.kind === 'purchase' ? filters.purchaser : undefined,
    brand: filters.brand,
    oeNumber: filters.oeNumber || undefined,
    categoryId: filters.categoryId,
    accountingDeptIds: [...filters.accountingDeptIds],
    stockDeptIds: [...filters.stockDeptIds],
    warehouseIds: [...filters.warehouseIds],
    businessTypes: [...filters.businessTypes],
    noOriginalSale: props.kind === 'sale' ? filters.noOriginalSale : undefined,
  };
}
const optionQuery = computed<TradeReportApi.Query>(() => {
  try {
    return buildQuery();
  } catch {
    return {
      postedFrom: '',
      postedTo: '',
      pageNo: 1,
      pageSize: 10,
      groupBy: groupBy.value,
      orderField: 'postedAt',
      orderDirection: 'desc',
    };
  }
});
async function query(next?: TradeReportApi.Query) {
  if (!canQuery.value || status.value?.status !== 'READY') return;
  const request = ++version;
  loading.value = true;
  error.value = '';
  summary.value = undefined;
  rows.value = [];
  applied.value = undefined;
  try {
    const params = next || buildQuery();
    const grouped = view.value === 'GROUP';
    const result = await getTradePage(props.kind, params, grouped);
    if (request !== version || !canQuery.value) return;
    applied.value = { ...params };
    rows.value = result.page.list;
    total.value = result.page.total;
    summary.value = result.summary;
    context.value = result.queryContext;
    pageNo.value = params.pageNo;
    pageSize.value = params.pageSize;
  } catch (error_) {
    if (request === version) {
      error.value = error_ instanceof Error ? error_.message : '查询失败';
      total.value = 0;
      context.value = undefined;
    }
  } finally {
    if (request === version) loading.value = false;
  }
}
async function initialize() {
  if (!canQuery.value) return;
  const request = ++version;
  try {
    const result = await getTradeStatus(props.kind);
    if (request !== version || !canQuery.value) return;
    status.value = result;
    if (result.status === 'READY') {
      const [start] = filters.dates || [];
      if (
        start &&
        (!result.cutoverAt || !dayjs(start).isBefore(dayjs(result.cutoverAt)))
      )
        await query();
    }
  } catch (error_) {
    if (request === version)
      error.value = error_ instanceof Error ? error_.message : '状态读取失败';
  }
}
function reset() {
  view.value = props.initialView;
  groupBy.value = props.initialGroupBy;
  previousGroup.value = undefined;
  Object.assign(filters, {
    dates: defaultPostingRange(),
    bizNo: '',
    productId: undefined,
    partyId: undefined,
    saleUserId: undefined,
    purchaser: undefined,
    brand: undefined,
    oeNumber: '',
    categoryId: undefined,
    accountingDeptIds: [],
    stockDeptIds: [],
    warehouseIds: [],
    businessTypes: [],
    noOriginalSale: undefined,
  });
  pageSize.value = 20;
  query();
}
function fromCutover() {
  if (status.value?.cutoverAt) {
    filters.dates = [
      dayjs(status.value.cutoverAt).format('YYYY-MM-DD HH:mm:ss'),
      filters.dates?.[1] || defaultPostingRange()[1],
    ];
    query();
  }
}
function setOption(field: keyof typeof filters, value: unknown) {
  if (['accountingDeptIds', 'stockDeptIds', 'warehouseIds'].includes(field)) {
    const ids = Array.isArray(value)
      ? value.filter((v): v is number => typeof v === 'number')
      : [];
    if (field === 'accountingDeptIds') filters.accountingDeptIds = ids;
    if (field === 'stockDeptIds') filters.stockDeptIds = ids;
    if (field === 'warehouseIds') filters.warehouseIds = ids;
    return;
  }
  if (field === 'brand' || field === 'purchaser')
    filters[field] = typeof value === 'string' ? value : undefined;
  else if (
    field === 'productId' ||
    field === 'partyId' ||
    field === 'categoryId' ||
    field === 'saleUserId'
  )
    filters[field] = typeof value === 'number' ? value : undefined;
}
const onTableChange: NonNullable<TableProps<TradeReportApi.Row>['onChange']> = (
  pagination,
  _f,
  sorter,
) => {
  if (!applied.value) return;
  const sort = Array.isArray(sorter) ? sorter[0] : sorter;
  const field = sort?.field === 'postingId' ? 'postingId' : 'postedAt';
  query({
    ...applied.value,
    pageNo: pagination.current || 1,
    pageSize: pagination.pageSize || 20,
    orderField: field,
    orderDirection: sort?.order === 'ascend' ? 'asc' : 'desc',
  });
};
async function exportRows() {
  if (exporting.value || !canQuery.value || !canExport.value || !applied.value)
    return;
  exporting.value = true;
  error.value = '';
  try {
    const data = await exportTradeReport(
      props.kind,
      { ...applied.value },
      view.value === 'GROUP',
    );
    downloadFileFromBlobPart({
      source: data,
      fileName:
        props.kind === 'sale'
          ? '销售商品明细-新核算.xlsx'
          : '采购商品明细-新核算.xlsx',
    });
  } catch (error_) {
    error.value = error_ instanceof Error ? error_.message : '导出失败';
  } finally {
    exporting.value = false;
  }
}
function target(row: Record<string, unknown>) {
  return typeof row.businessType === 'string'
    ? sourceTypes[row.businessType]
    : undefined;
}
function canOpen(row: Record<string, unknown>) {
  const t = target(row);
  return (
    !!t && typeof row.bizId === 'number' && hasAccessByCodes([t.permission])
  );
}
function openSource(row: Record<string, unknown>) {
  const t = target(row);
  if (t && canOpen(row) && typeof row.bizId === 'number')
    source.value?.open(t.type, row.bizId);
}
function canOpenReference(row: Record<string, unknown>, field: unknown) {
  const t = typeof field === 'string' ? referenceTarget(row, field) : undefined;
  return !!t && hasAccessByCodes([t.permission]);
}
function openReference(row: Record<string, unknown>, field: unknown) {
  const t = typeof field === 'string' ? referenceTarget(row, field) : undefined;
  if (t && hasAccessByCodes([t.permission])) source.value?.open(t.type, t.id);
}
function drill(row: Record<string, unknown>) {
  if (!applied.value) return;
  const value = row.groupKey;
  if (value === null || value === undefined) {
    error.value = '未记录分组缺少可靠筛选键，请查看完整明细中的缺失状态';
    return;
  }
  previousGroup.value = { ...applied.value };
  const q = { ...applied.value, pageNo: 1 };
  const g = applied.value.groupBy;
  if (g === 'CUSTOMER' && typeof value === 'number') q.customerId = value;
  if (g === 'SUPPLIER' && typeof value === 'number') q.supplierId = value;
  if (g === 'PRODUCT' && typeof value === 'number') q.productId = value;
  if (g === 'CATEGORY' && typeof value === 'number') q.categoryId = value;
  if (g === 'SALE_USER' && typeof value === 'number') q.saleUserId = value;
  if (g === 'PURCHASER' && typeof value === 'string') q.purchaser = value;
  if (g === 'OE' && typeof value === 'string') q.oeNumber = value;
  if (g === 'BRAND' && typeof value === 'string') q.brand = value;
  if (g === 'ACCOUNTING_DEPT' && typeof value === 'number')
    q.accountingDeptIds = [value];
  if (g === 'STOCK_DEPT' && typeof value === 'number') q.stockDeptIds = [value];
  if (g === 'WAREHOUSE' && typeof value === 'number') q.warehouseIds = [value];
  syncFilters(q);
  view.value = 'DETAIL';
  query(q);
}
function syncFilters(q: TradeReportApi.Query) {
  Object.assign(filters, {
    dates: [q.postedFrom, q.postedTo],
    bizNo: q.bizNo || '',
    productId: q.productId,
    partyId: props.kind === 'sale' ? q.customerId : q.supplierId,
    saleUserId: q.saleUserId,
    purchaser: q.purchaser,
    brand: q.brand,
    oeNumber: q.oeNumber || '',
    categoryId: q.categoryId,
    accountingDeptIds: [...(q.accountingDeptIds || [])],
    stockDeptIds: [...(q.stockDeptIds || [])],
    warehouseIds: [...(q.warehouseIds || [])],
    businessTypes: [...(q.businessTypes || [])],
    noOriginalSale: q.noOriginalSale,
  });
}
function backToGroup() {
  const q = previousGroup.value;
  if (!q) return;
  syncFilters(q);
  groupBy.value = q.groupBy;
  view.value = 'GROUP';
  previousGroup.value = undefined;
  query(q);
}
function applicableAmount(key: string) {
  return props.kind === 'sale'
    ? ![
        'freightAllocatedAmount',
        'otherFeeAllocatedAmount',
        'paidAmount',
        'payableBalance',
        'returnDifferenceProfit',
      ].includes(key)
    : ![
        'financialGrossProfit',
        'financialMargin',
        'receivableBalance',
        'receivedAmount',
        'settlementGrossProfit',
        'settlementMargin',
      ].includes(key);
}
const pageSummary = computed(() => pageTotals(rows.value, summary.value));
const shownTotals = computed(() =>
  totalFields.filter((key) => applicableAmount(key)),
);
const columns = computed<ColumnType<TradeReportApi.Row>[]>(() => {
  const basic: Array<[string, string]> =
    view.value === 'GROUP'
      ? [
          ['groupKey', '分组值'],
          ['groupLabel', '历史名称标签'],
        ]
      : [
          ['postedAt', '过账时间'],
          ['bizDate', '业务日期'],
          ['businessType', '单据类型'],
          ['bizNo', '单据编号'],
          ...(props.kind === 'sale'
            ? ([
                ['originalBizNo', '原单编号'],
                ['noOriginalSale', '无原单退货'],
                ['sourceRole', '来源关系'],
                ['returnMode', '退货模式'],
                ['costBasis', '退入库存成本依据'],
              ] as Array<[string, string]>)
            : ([
                ['originalBizNo', '主要原单编号'],
                ['sourceRole', '来源关系'],
                ['returnMode', '退货模式'],
                ['sourcePurchaseInNo', '原采购入库单'],
                ['sourceOrderNo', '原入库上游采购订单'],
                ['returnDocumentOrderNo', '退货单自身关联订单'],
                ['traceSaleReturnNo', '销售退货追溯（非成本来源）'],
                ['costBasis', '扣库成本依据'],
                ['returnDifferenceStatus', '退货差额状态'],
              ] as Array<[string, string]>)),
          ['partyName', props.kind === 'sale' ? '客户' : '供应商'],
          [
            'accountingDeptName',
            props.kind === 'sale' ? '销售部门' : '采购部门',
          ],
          ['stockDeptName', '实际库存部门'],
          ['warehouseName', '实际出/入库仓库'],
          ...(props.kind === 'sale'
            ? ([
                ['saleUserName', '原销售人员'],
                ['currentHandlerName', '无单退货经办人'],
                ['sourceCreator', '来源制单人ID'],
              ] as Array<[string, string]>)
            : [['purchaser', '采购员'] as [string, string]]),
          ['productCode', '商品编码'],
          ['oeNumber', 'OE号'],
          ['productName', '商品名称'],
          ['brand', '品牌'],
          ['specification', '规格'],
          ['unitName', '单位'],
        ];
  const amount = Object.entries(numericLabels).filter(
    ([key]) =>
      applicableAmount(key) &&
      (view.value === 'DETAIL' ||
        !['financialUnitCost', 'rawUnitPrice', 'settlementUnitCost'].includes(
          key,
        )),
  );
  return [
    ...basic,
    ...amount,
    ...(view.value === 'DETAIL'
      ? [
          ['returnReason', '退货原因'],
          ['remark', '备注'],
          ['dataStatus', '数据状态'],
        ]
      : []),
  ].map(([key, label]) => ({
    key,
    dataIndex: key,
    title: label,
    width: 160,
    sorter: key === 'postedAt',
    align: numericLabels[key!] ? ('right' as const) : ('left' as const),
  }));
});
function cell(
  row: Record<string, unknown>,
  index: ColumnType<TradeReportApi.Row>['dataIndex'],
) {
  return typeof index === 'string' ? tradeCell(row, index) : '—';
}
watch(canQuery, (value) => {
  version++;
  rows.value = [];
  summary.value = undefined;
  status.value = undefined;
  total.value = 0;
  context.value = undefined;
  applied.value = undefined;
  loading.value = false;
  previousGroup.value = undefined;
  if (value) initialize();
});
onMounted(initialize);
onBeforeUnmount(() => version++);
</script>
<template>
  <div class="trade-report flex h-full min-h-0 flex-col space-y-2">
    <div class="trade-report__heading">
      <div>
        <h3>{{ reportHeading }}</h3>
        <p>{{ reportDescriptionText }}</p>
      </div>
    </div>
    <Alert v-if="!canQuery" type="info" message="没有新版商品报表查询权限" />
    <template v-else>
      <Alert
        type="info"
        show-icon
        :message="status?.reason || '正在读取核算状态'"
        :description="status?.coverageWarnings.join('；')"
      />
      <Alert
        type="info"
        show-icon
        :message="caliberNotice.message"
        :description="caliberNotice.description"
      />
      <Alert v-if="error" type="error" :message="error" show-icon />
      <template v-if="status?.status === 'READY'">
        <div class="flex flex-wrap items-center gap-2">
          <DatePicker.RangePicker
            v-model:value="filters.dates"
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
            format="YYYY-MM-DD HH:mm:ss"
            size="small"
          />
          <Button v-if="status.cutoverAt" size="small" @click="fromCutover">
            从切换时间开始
          </Button>
          <Input
            v-model:value="filters.bizNo"
            placeholder="单据编号"
            size="small"
            class="!w-36"
          />
          <Input
            v-model:value="filters.oeNumber"
            placeholder="OE号（精确）"
            size="small"
            class="!w-36"
          />
          <FilterChoice
            :kind="kind"
            :query="optionQuery"
            dimension="PRODUCT"
            label="商品"
            :value="filters.productId"
            @change="setOption('productId', $event)"
          />
          <FilterChoice
            :kind="kind"
            :query="optionQuery"
            :dimension="kind === 'sale' ? 'CUSTOMER' : 'SUPPLIER'"
            :label="kind === 'sale' ? '客户' : '供应商'"
            :value="filters.partyId"
            @change="setOption('partyId', $event)"
          />
          <FilterChoice
            :kind="kind"
            :query="optionQuery"
            dimension="BRAND"
            label="品牌"
            :value="filters.brand"
            @change="setOption('brand', $event)"
          />
          <FilterChoice
            :kind="kind"
            :query="optionQuery"
            dimension="CATEGORY"
            label="品类"
            :value="filters.categoryId"
            @change="setOption('categoryId', $event)"
          />
          <FilterChoice
            :kind="kind"
            :query="optionQuery"
            :dimension="kind === 'sale' ? 'SALE_USER' : 'PURCHASER'"
            :label="kind === 'sale' ? '销售人员' : '采购员'"
            :value="kind === 'sale' ? filters.saleUserId : filters.purchaser"
            @change="
              setOption(kind === 'sale' ? 'saleUserId' : 'purchaser', $event)
            "
          />
          <FilterChoice
            v-for="item in [
              {
                field: 'accountingDeptIds',
                dimension: 'ACCOUNTING_DEPT',
                label: '核算部门',
              },
              {
                field: 'stockDeptIds',
                dimension: 'STOCK_DEPT',
                label: '库存部门',
              },
              { field: 'warehouseIds', dimension: 'WAREHOUSE', label: '仓库' },
            ]"
            :key="item.field"
            :kind="kind"
            :query="optionQuery"
            :dimension="item.dimension"
            :label="item.label"
            :value="
              item.field === 'accountingDeptIds'
                ? filters.accountingDeptIds
                : item.field === 'stockDeptIds'
                  ? filters.stockDeptIds
                  : filters.warehouseIds
            "
            multiple
            @change="setOption(item.field as keyof typeof filters, $event)"
          />
          <Select
            v-model:value="filters.businessTypes"
            mode="multiple"
            placeholder="业务类型"
            class="w-48"
            size="small"
            :options="
              Object.entries(businessTypes)
                .filter(([key]) =>
                  kind === 'sale'
                    ? key.startsWith('SALE_')
                    : key.startsWith('PURCHASE_'),
                )
                .map(([value, label]) => ({ value, label }))
            "
          />
          <Select
            v-if="kind === 'sale'"
            v-model:value="noOriginalValue"
            allow-clear
            placeholder="无原单退货"
            class="w-36"
            size="small"
            :options="[
              { value: 'yes', label: '是' },
              { value: 'no', label: '否' },
            ]"
          />
          <Button
            size="small"
            type="primary"
            :loading="loading"
            @click="query()"
          >
            查询 </Button
          ><Button size="small" @click="reset">重置</Button>
          <Button
            v-if="canExport"
            size="small"
            :loading="exporting"
            :disabled="!applied || loading"
            @click="exportRows"
          >
            导出全部
          </Button>
        </div>
        <div class="flex items-center gap-2">
          <Button
            v-if="previousGroup && view === 'DETAIL'"
            size="small"
            @click="backToGroup"
          >
            返回原分组
          </Button>
          <Select
            v-model:value="view"
            size="small"
            class="w-28"
            :options="[
              { value: 'DETAIL', label: '商品明细' },
              { value: 'GROUP', label: '分组汇总' },
            ]"
            @change="query()"
          />
          <Select
            v-if="view === 'GROUP'"
            v-model:value="groupBy"
            size="small"
            class="w-36"
            :options="groupOptions"
            @change="query()"
          />
          <span class="text-xs text-gray-500"
            >区间左闭右开；数量跨单位合计仅作记录核对。{{
              context?.consistency
            }}</span
          >
        </div>
        <div v-if="context" class="text-xs">
          实际查询：{{ context.postedFrom }} ≤ 过账时间 &lt;
          {{ context.postedTo }}
        </div>
        <div class="trade-report__table-area">
          <Table
            class="trade-report__table"
            :columns="columns"
            :data-source="rows"
            :loading="loading"
            :row-key="
              (row) => String(row.postingId ?? row.groupKey ?? 'missing')
            "
            size="small"
            bordered
            :scroll="{ x: 'max-content', y: '100%' }"
            :pagination="{
              current: pageNo,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: (count: number) => `共 ${count} 行`,
            }"
            @change="onTableChange"
          >
            <template #bodyCell="{ column, record }">
              <Button
                v-if="column.dataIndex === 'bizNo' && canOpen(record)"
                type="link"
                size="small"
                @click="openSource(record)"
              >
                {{ record.bizNo }}
              </Button>
              <Button
                v-else-if="canOpenReference(record, column.dataIndex)"
                type="link"
                size="small"
                @click="openReference(record, column.dataIndex)"
              >
                {{
                  typeof column.dataIndex === 'string'
                    ? tradeCell(record, column.dataIndex)
                    : ''
                }}
              </Button>
              <Button
                v-else-if="
                  column.dataIndex === 'groupKey' && record.groupKey !== null
                "
                type="link"
                size="small"
                @click="drill(record)"
              >
                {{ record.groupKey }}
              </Button>
              <span
                v-else
                :title="
                  typeof column.dataIndex === 'string'
                    ? cellReason(record, column.dataIndex)
                    : ''
                "
                >{{ cell(record, column.dataIndex) }}</span
              >
            </template>
          </Table>
        </div>
        <div
          v-if="summary"
          class="trade-report__summary overflow-x-auto rounded border p-2 text-xs"
        >
          <table class="w-max">
            <thead>
              <tr>
                <th class="px-3 text-left">合计范围</th>
                <th v-for="key in shownTotals" :key="key" class="px-3">
                  {{ numericLabels[key] }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="px-3">本页合计</td>
                <td
                  v-for="key in shownTotals"
                  :key="key"
                  class="px-3 text-right"
                  :title="cellReason(pageSummary, key)"
                >
                  {{ tradeCell(pageSummary, key) }}
                </td>
              </tr>
              <tr>
                <td class="px-3">全部合计</td>
                <td
                  v-for="key in shownTotals"
                  :key="key"
                  class="px-3 text-right"
                  :title="cellReason(summary, key)"
                >
                  {{ tradeCell(summary, key) }}
                </td>
              </tr>
            </tbody>
          </table>
          <div class="mt-1">
            缺交易快照 {{ summary.missingSnapshotCount }} 行；缺含税净交易额
            {{ summary.missingGrossCount }} 行。空缺不按零处理。
          </div>
        </div>
      </template>
      <SourceDetail v-if="canQuery" ref="source" />
    </template>
  </div>
</template>

<style scoped>
.trade-report__heading {
  flex: 0 0 auto;
  padding: 12px 14px;
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  background: linear-gradient(
    135deg,
    hsl(var(--primary) / 8%),
    hsl(var(--card))
  );
}

.trade-report__heading h3 {
  margin: 0 0 4px;
  color: hsl(var(--foreground));
  font-size: 16px;
  font-weight: 700;
}

.trade-report__heading p {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.trade-report__table-area {
  display: flex;
  flex: 1 1 320px;
  min-height: 260px;
}

.trade-report__table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.trade-report :deep(.ant-table-wrapper),
.trade-report :deep(.ant-spin-nested-loading) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.trade-report :deep(.ant-spin-container) {
  display: flex;
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.trade-report :deep(.ant-table) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.trade-report :deep(.ant-table-container) {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.trade-report :deep(.ant-table-body) {
  flex: 1 1 auto;
  min-height: 0;
}

.trade-report__summary {
  flex: 0 0 auto;
}
</style>
