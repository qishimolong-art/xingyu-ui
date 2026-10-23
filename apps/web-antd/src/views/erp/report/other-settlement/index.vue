<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';
import type { Dayjs } from 'dayjs';

import type { ErpPayableMiscApi } from '#/api/erp/finance/payable/misc';
import type { ErpReceivableMiscApi } from '#/api/erp/finance/receivable/misc';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart } from '@vben/utils';

import {
  Button,
  Card,
  DatePicker,
  Form,
  FormItem,
  Input,
  message,
  Pagination,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  exportPayableMisc,
  getPayableMiscPage,
} from '#/api/erp/finance/payable/misc';
import {
  exportReceivableMisc,
  getReceivableMiscPage,
} from '#/api/erp/finance/receivable/misc';
import BusinessReportShell from '#/views/erp/report/components/business-report-shell.vue';

defineOptions({ name: 'ErpBusinessReportOtherSettlement' });

const RangePicker = DatePicker.RangePicker;
const DEFAULT_PAGE_SIZE = 10;
const DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

type PageKey =
  | 'aging-analysis'
  | 'balance-summary'
  | 'history'
  | 'other-payable'
  | 'other-receivable'
  | 'writeoff-detail';

type SettlementDirection = 'payable' | 'receivable';
type SettlementStatusFilter = '0' | '10' | '20' | 'all' | 'closed' | 'open';

interface MetricCard {
  label: string;
  note: string;
  tone?: 'blue' | 'green' | 'orange' | 'purple';
  value: string;
}

interface ReportRow {
  accountName?: string;
  amount?: number;
  balance?: number;
  bizDate?: string;
  contact?: string;
  dept?: string;
  direction: SettlementDirection;
  docNo?: string;
  dueDate?: string;
  handler?: string;
  key: string;
  objectName?: string;
  objectType?: string;
  project?: string;
  remark?: string;
  settledAmount?: number;
  sourceNo?: string;
  status?: number;
  type?: string;
}

const route = useRoute();
const { hasAccessByCodes } = useAccess();
const exportLoading = ref(false);
let loadSequence = 0;

const currentPath = computed(() =>
  typeof route?.path === 'string' ? route.path : '',
);
const canCurrentMenu = computed(() => {
  const matched = Array.isArray(route?.matched) ? route.matched : [];
  return (
    matched.length > 0 &&
    (currentPath.value === '/erp/business-report/other-settlement' ||
      currentPath.value.startsWith('/erp/business-report/other-settlement/'))
  );
});
const canQueryReceivableMisc = computed(() =>
  hasAccessByCodes(['erp:receivable-misc:query', 'erp:receivable-other:query']),
);
const canQueryPayableMisc = computed(() =>
  hasAccessByCodes(['erp:payable-misc:query', 'erp:payable-other:query']),
);
const canQueryOtherSettlement = computed(
  () =>
    canCurrentMenu.value ||
    canQueryReceivableMisc.value ||
    canQueryPayableMisc.value,
);
const canExportOtherSettlement = computed(
  () =>
    canCurrentMenu.value ||
    hasAccessByCodes([
      'erp:payable-misc:export',
      'erp:payable-other:export',
      'erp:receivable-misc:export',
      'erp:receivable-other:export',
    ]),
);

const pageTitles: Record<PageKey, string> = {
  'aging-analysis': '其他往来账龄分析',
  'balance-summary': '其他往来余额汇总',
  history: '历史其他往来口径',
  'other-payable': '其他应付报表',
  'other-receivable': '其他应收报表',
  'writeoff-detail': '其他往来核销明细',
};

const reportOptions = Object.entries(pageTitles).map(([value, label]) => ({
  label,
  value,
}));

const objectTypeOptions = [
  { label: '全部对象', value: 'all' },
  { label: '客户', value: 'customer' },
  { label: '供应商', value: 'supplier' },
];

const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '草稿', value: '0' },
  { label: '待审核', value: '10' },
  { label: '已审核', value: '20' },
  { label: '未结清', value: 'open' },
  { label: '已结清', value: 'closed' },
];

const query = reactive<{
  dateRange?: [Dayjs, Dayjs];
  keyword: string;
  objectType: 'all' | 'customer' | 'supplier';
  status: SettlementStatusFilter;
}>({
  dateRange: [dayjs().subtract(29, 'day').startOf('day'), dayjs().endOf('day')],
  keyword: '',
  objectType: 'all',
  status: 'all',
});

const tableState = reactive({
  error: '',
  loading: false,
  pageNo: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  rows: [] as ReportRow[],
  total: 0,
});

function normalizePageKey(value: unknown): PageKey {
  if (typeof value !== 'string') return 'other-receivable';
  const key = value.split('/').findLast(Boolean) as PageKey | undefined;
  return key && key in pageTitles ? key : 'other-receivable';
}

const pageKey = computed(() => normalizePageKey(currentPath.value));
const pageTitle = computed(() => pageTitles[pageKey.value]);

const pageDirections = computed<SettlementDirection[]>(() => {
  if (pageKey.value === 'other-receivable') return ['receivable'];
  if (pageKey.value === 'other-payable') return ['payable'];
  if (query.objectType === 'customer') return ['receivable'];
  if (query.objectType === 'supplier') return ['payable'];
  return ['receivable', 'payable'];
});

const queryNeedsLocalPage = computed(
  () =>
    pageDirections.value.length > 1 ||
    query.status === 'open' ||
    query.status === 'closed',
);

const pageSummary = computed(() => ({
  amount: sumRows('amount'),
  balance: sumRows('balance'),
  objectCount: new Set(
    tableState.rows.map((row) => row.objectName).filter(Boolean),
  ).size,
  settledAmount: sumRows('settledAmount'),
}));

const metricCards = computed<MetricCard[]>(() => {
  if (pageKey.value === 'aging-analysis') {
    return [
      {
        label: '本页未结余额',
        note: '按当前页剩余金额汇总',
        value: formatMoney(pageSummary.value.balance),
      },
      {
        label: '未到期',
        note: '按约定日期展示',
        tone: 'green',
        value: '待规则确认',
      },
      {
        label: '逾期 30 天内',
        note: '按约定日期展示',
        tone: 'orange',
        value: '待规则确认',
      },
      {
        label: '逾期 90 天以上',
        note: '按约定日期展示',
        tone: 'purple',
        value: '待规则确认',
      },
    ];
  }
  if (pageKey.value === 'writeoff-detail') {
    return [
      {
        label: '本页单据数',
        note: '按当前页展示行统计',
        value: formatNumber(tableState.rows.length),
      },
      {
        label: '本页发生',
        note: '按当前页发生金额汇总',
        tone: 'green',
        value: formatMoney(pageSummary.value.amount),
      },
      {
        label: '本页结算',
        note: '按当前页已收/已付汇总',
        tone: 'purple',
        value: formatMoney(pageSummary.value.settledAmount),
      },
      {
        label: '本页剩余',
        note: '按当前页剩余金额汇总',
        tone: 'orange',
        value: formatMoney(pageSummary.value.balance),
      },
    ];
  }
  return [
    {
      label: '往来对象数',
      note: '当前页对象去重',
      value: formatNumber(pageSummary.value.objectCount),
    },
    {
      label: '本页发生',
      note: '按当前页发生金额汇总',
      tone: 'green',
      value: formatMoney(pageSummary.value.amount),
    },
    {
      label: '本页结算',
      note: '按当前页已收/已付汇总',
      tone: 'purple',
      value: formatMoney(pageSummary.value.settledAmount),
    },
    {
      label: '本页余额',
      note: '按当前页剩余金额汇总',
      tone: 'orange',
      value: formatMoney(pageSummary.value.balance),
    },
  ];
});

const baseColumns: TableColumnsType<ReportRow> = [
  { title: '往来方向', dataIndex: 'direction', width: 110, fixed: 'left' },
  { title: '业务类型', dataIndex: 'type', width: 120 },
  { title: '业务日期', dataIndex: 'bizDate', width: 155 },
  { title: '单据编号', dataIndex: 'docNo', width: 175 },
  { title: '来源单号', dataIndex: 'sourceNo', width: 170 },
  { title: '往来对象类型', dataIndex: 'objectType', width: 120 },
  { title: '往来对象', dataIndex: 'objectName', width: 190 },
  { title: '联系方式', dataIndex: 'contact', width: 130 },
  { title: '账户', dataIndex: 'accountName', width: 130 },
  { title: '项目', dataIndex: 'project', width: 130 },
  { title: '责任部门', dataIndex: 'dept', width: 130 },
  { title: '经办人', dataIndex: 'handler', width: 110 },
  { title: '发生金额', dataIndex: 'amount', width: 120, align: 'right' },
  { title: '结算金额', dataIndex: 'settledAmount', width: 120, align: 'right' },
  { title: '余额', dataIndex: 'balance', width: 120, align: 'right' },
  { title: '约定日期', dataIndex: 'dueDate', width: 130 },
  { title: '状态', dataIndex: 'status', width: 110, fixed: 'right' },
];

const tableColumns = computed<TableColumnsType<ReportRow>>(() => {
  const hiddenByPage: Record<PageKey, string[]> = {
    'aging-analysis': ['settledAmount', 'sourceNo'],
    'balance-summary': ['docNo', 'sourceNo'],
    history: ['project'],
    'other-payable': ['project'],
    'other-receivable': ['project'],
    'writeoff-detail': ['dueDate', 'project'],
  };
  const hidden = new Set(hiddenByPage[pageKey.value]);
  return baseColumns.filter(
    (column) => !hidden.has(getColumnDataIndex(column)),
  );
});

const tableScrollX = computed(() =>
  Math.max(tableColumns.value.length * 130, 1100),
);

const trendBars = computed(() => {
  const monthMap = new Map<string, number>();
  for (const row of tableState.rows) {
    const month = row.bizDate
      ? dayjs(row.bizDate).format('YYYY-MM')
      : '未定日期';
    monthMap.set(month, (monthMap.get(month) || 0) + Number(row.amount || 0));
  }
  const rows = [...monthMap.entries()]
    .toSorted(([left], [right]) => left.localeCompare(right))
    .slice(-6)
    .map(([label, amount]) => ({ amount, label }));
  const maxAmount = Math.max(...rows.map((row) => Math.abs(row.amount)), 1);
  return rows.map((row) => ({
    ...row,
    height: `${Math.max(12, (Math.abs(row.amount) / maxAmount) * 100)}%`,
  }));
});

const rankRows = computed(() => {
  const rankMap = new Map<string, number>();
  for (const row of tableState.rows) {
    const name = row.objectName || '未命名对象';
    rankMap.set(name, (rankMap.get(name) || 0) + Number(row.amount || 0));
  }
  return [...rankMap.entries()]
    .map(([name, amount]) => ({ amount, name }))
    .toSorted((left, right) => Math.abs(right.amount) - Math.abs(left.amount))
    .slice(0, 6);
});

function getColumnDataIndex(column: unknown) {
  return String((column as { dataIndex?: string })?.dataIndex ?? '');
}

function formatMoney(value: unknown) {
  if (value === '待规则确认' || value === '不可计算' || value === '成本缺失') {
    return String(value);
  }
  if (value === null || value === undefined || value === '') return '—';
  const next = Number(value);
  if (!Number.isFinite(next)) return '—';
  return next.toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function formatNumber(value: unknown) {
  const next = Number(value);
  if (!Number.isFinite(next)) return '0';
  return next.toLocaleString('zh-CN');
}

function getStatusMeta(value: unknown) {
  if (Number(value) === 0) return { color: 'warning', label: '草稿' };
  if (Number(value) === 10) return { color: 'processing', label: '待审核' };
  if (Number(value) === 20) return { color: 'success', label: '已审核' };
  if (value === 'open') return { color: 'processing', label: '未结清' };
  if (value === 'closed') return { color: 'success', label: '已结清' };
  if (value) return { color: 'default', label: String(value) };
  return { color: 'default', label: '—' };
}

function getDirectionText(value: unknown) {
  if (value === 'receivable') return '其他应收';
  if (value === 'payable') return '其他应付';
  return '—';
}

function sumRows(field: 'amount' | 'balance' | 'settledAmount') {
  return tableState.rows.reduce(
    (total, row) => total + Number(row[field] || 0),
    0,
  );
}

function isSettlementStatusMatched(row: ReportRow) {
  if (query.status === 'all') return true;
  if (query.status === 'open') return Number(row.balance || 0) !== 0;
  if (query.status === 'closed') return Number(row.balance || 0) === 0;
  return Number(row.status) === Number(query.status);
}

function buildBaseParams(pageNo: number, pageSize: number) {
  const params: Record<string, any> = {
    keyword: query.keyword || undefined,
    orderDirection: 'desc',
    orderField: 'bizTime',
    pageNo,
    pageSize,
  };
  if (query.dateRange?.length === 2) {
    params.bizTime = [
      query.dateRange[0].format(DATE_FORMAT),
      query.dateRange[1].format(DATE_FORMAT),
    ];
  }
  if (['0', '10', '20'].includes(query.status)) {
    params.status = Number(query.status);
  }
  return params;
}

function toReceivableRow(row: ErpReceivableMiscApi.ReceivableMisc): ReportRow {
  return {
    accountName: row.accountName,
    amount: Number(row.amount || 0),
    balance: Number(row.balanceAmount || 0),
    bizDate: row.bizTime,
    contact: row.customerMobile || row.customerContact,
    dept: row.deptName,
    direction: 'receivable',
    docNo: row.no,
    dueDate: '待规则确认',
    handler: row.handlerName,
    key: `receivable-${row.id || row.no}`,
    objectName: row.customerName,
    objectType: '客户',
    project: row.remark,
    remark: row.remark,
    settledAmount: Number(row.settledAmount || 0),
    sourceNo: row.sourceNo || row.sourceMiscNo,
    status: row.status,
    type: row.generatedOffset ? '应收冲减' : '其他应收',
  };
}

function toPayableRow(row: ErpPayableMiscApi.PayableMisc): ReportRow {
  return {
    accountName: row.accountName,
    amount: Number(row.amount || 0),
    balance: Number(row.balanceAmount || 0),
    bizDate: row.bizTime,
    contact: row.supplierMobile || row.supplierContact,
    dept: row.deptName,
    direction: 'payable',
    docNo: row.no,
    dueDate: '待规则确认',
    handler: row.handlerName,
    key: `payable-${row.id || row.no}`,
    objectName: row.supplierName,
    objectType: '供应商',
    project: row.remark,
    remark: row.remark,
    settledAmount: Number(row.settledAmount || 0),
    sourceNo: row.sourceNo || row.sourceMiscNo,
    status: row.status,
    type: row.generatedOffset ? '应付冲减' : '其他应付',
  };
}

async function queryDirection(
  direction: SettlementDirection,
  pageNo: number,
  pageSize: number,
) {
  const params = buildBaseParams(pageNo, pageSize);
  if (direction === 'receivable') {
    const result = await getReceivableMiscPage(params);
    return {
      rows: (result.list || []).map((row) => toReceivableRow(row)),
      total: Number(result.total || 0),
    };
  }
  const result = await getPayableMiscPage(params);
  return {
    rows: (result.list || []).map((row) => toPayableRow(row)),
    total: Number(result.total || 0),
  };
}

function sortRows(rows: ReportRow[]) {
  return rows.toSorted((left, right) => {
    const leftTime = left.bizDate ? dayjs(left.bizDate).valueOf() : 0;
    const rightTime = right.bizDate ? dayjs(right.bizDate).valueOf() : 0;
    return rightTime - leftTime;
  });
}

async function loadData() {
  if (!canQueryOtherSettlement.value) return;
  const sequence = ++loadSequence;
  tableState.loading = true;
  tableState.error = '';
  try {
    const directions = pageDirections.value;
    const pageSize = queryNeedsLocalPage.value
      ? Math.max(tableState.pageNo * tableState.pageSize, DEFAULT_PAGE_SIZE)
      : tableState.pageSize;
    const pageNo = queryNeedsLocalPage.value ? 1 : tableState.pageNo;
    const results = await Promise.all(
      directions.map((direction) =>
        queryDirection(direction, pageNo, pageSize),
      ),
    );
    if (sequence !== loadSequence) return;
    const rows = sortRows(results.flatMap((result) => result.rows)).filter(
      (row) => isSettlementStatusMatched(row),
    );
    if (queryNeedsLocalPage.value) {
      const start = (tableState.pageNo - 1) * tableState.pageSize;
      tableState.rows = rows.slice(start, start + tableState.pageSize);
      tableState.total = rows.length;
    } else {
      tableState.rows = rows;
      tableState.total = results.reduce(
        (total, result) => total + result.total,
        0,
      );
    }
  } catch {
    if (sequence === loadSequence) {
      tableState.rows = [];
      tableState.total = 0;
      tableState.error = '报表数据加载失败，请稍后重试';
      message.error(tableState.error);
    }
  } finally {
    if (sequence === loadSequence) tableState.loading = false;
  }
}

function handleSearch() {
  tableState.pageNo = 1;
  void loadData();
}

function handleReset() {
  query.dateRange = [
    dayjs().subtract(29, 'day').startOf('day'),
    dayjs().endOf('day'),
  ];
  query.keyword = '';
  query.objectType = 'all';
  query.status = 'all';
  tableState.pageNo = 1;
  tableState.pageSize = DEFAULT_PAGE_SIZE;
  void loadData();
}

function handlePageChange(page: number, pageSize: number) {
  tableState.pageNo = page;
  tableState.pageSize = pageSize;
  void loadData();
}

async function downloadWithName(source: Promise<any>, fileName: string) {
  const data = await source;
  downloadFileFromBlobPart({ fileName, source: data });
}

function exportCurrentRows() {
  const headers = tableColumns.value.map((column) =>
    String(column.title || ''),
  );
  const fields = tableColumns.value.map((column) => getColumnDataIndex(column));
  const csvRows = tableState.rows.map((row) =>
    fields
      .map((field) => {
        const rawValue =
          field === 'direction'
            ? getDirectionText(row.direction)
            : (row as any)[field];
        let value = rawValue || '';
        if (['amount', 'balance', 'settledAmount'].includes(field)) {
          value = formatMoney(rawValue);
        } else if (field === 'status') {
          value = getStatusMeta(rawValue).label;
        }
        return `"${String(value).replaceAll('"', '""')}"`;
      })
      .join(','),
  );
  const source = new Blob(
    [`\uFEFF${headers.join(',')}\n${csvRows.join('\n')}`],
    {
      type: 'text/csv;charset=utf-8',
    },
  );
  downloadFileFromBlobPart({ fileName: `${pageTitle.value}.csv`, source });
}

async function handleExport() {
  if (!canExportOtherSettlement.value) return;
  exportLoading.value = true;
  try {
    if (pageKey.value === 'other-receivable') {
      await downloadWithName(
        exportReceivableMisc(buildBaseParams(1, tableState.pageSize)),
        `${pageTitle.value}.xls`,
      );
      return;
    }
    if (pageKey.value === 'other-payable') {
      await downloadWithName(
        exportPayableMisc(buildBaseParams(1, tableState.pageSize)),
        `${pageTitle.value}.xls`,
      );
      return;
    }
    exportCurrentRows();
  } finally {
    exportLoading.value = false;
  }
}

watch(
  () => currentPath.value,
  () => {
    tableState.pageNo = 1;
    if (canQueryOtherSettlement.value) void loadData();
  },
);

watch(canQueryOtherSettlement, (allowed) => {
  if (allowed) void loadData();
});

onMounted(() => {
  if (canQueryOtherSettlement.value) void loadData();
});
</script>

<template>
  <BusinessReportShell
    :title="`经营报表 · 其他应收及其他应付 · ${pageTitle}`"
    :denied="!canQueryOtherSettlement"
    body-scrollable
  >
    <section class="other-settlement-report-page">
      <Card class="other-settlement-report-page__query-card" size="small">
        <Form class="other-settlement-report-page__query" layout="inline">
          <FormItem label="业务时间">
            <RangePicker
              v-model:value="query.dateRange"
              class="other-settlement-report-page__date"
              format="YYYY-MM-DD HH:mm:ss"
              show-time
            />
          </FormItem>
          <FormItem label="报表">
            <Select
              class="other-settlement-report-page__select"
              :value="pageKey"
              :options="reportOptions"
              disabled
            />
          </FormItem>
          <FormItem label="往来对象">
            <Select
              v-model:value="query.objectType"
              class="other-settlement-report-page__select"
              :options="objectTypeOptions"
            />
          </FormItem>
          <FormItem label="状态">
            <Select
              v-model:value="query.status"
              class="other-settlement-report-page__select"
              :options="statusOptions"
            />
          </FormItem>
          <FormItem label="关键词">
            <Input
              v-model:value="query.keyword"
              allow-clear
              class="other-settlement-report-page__keyword"
              placeholder="单号 / 对象 / 部门 / 经办人"
              @press-enter="handleSearch"
            />
          </FormItem>
          <FormItem>
            <Space>
              <Button
                type="primary"
                :loading="tableState.loading"
                @click="handleSearch"
                >查询</Button
              >
              <Button @click="handleReset">重置</Button>
              <Button
                :disabled="!canExportOtherSettlement"
                :loading="exportLoading"
                @click="handleExport"
              >
                导出
              </Button>
            </Space>
          </FormItem>
        </Form>
      </Card>

      <div class="other-settlement-report-page__metrics">
        <Card
          v-for="metric in metricCards"
          :key="metric.label"
          class="other-settlement-report-page__metric"
          :class="
            metric.tone &&
            `other-settlement-report-page__metric--${metric.tone}`
          "
          size="small"
        >
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <small>{{ metric.note }}</small>
        </Card>
      </div>

      <div class="other-settlement-report-page__chart-grid">
        <Card
          class="other-settlement-report-page__chart"
          size="small"
          title="月度趋势"
        >
          <div
            v-if="trendBars.length > 0"
            class="other-settlement-report-page__bars"
          >
            <div
              v-for="item in trendBars"
              :key="item.label"
              class="other-settlement-report-page__bar-item"
            >
              <div class="other-settlement-report-page__bar-track">
                <div
                  class="other-settlement-report-page__bar"
                  :style="{ height: item.height }"
                ></div>
              </div>
              <span>{{ item.label }}</span>
              <b>{{ formatMoney(item.amount) }}</b>
            </div>
          </div>
          <div v-else class="other-settlement-report-page__empty-chart">
            暂无数据
          </div>
        </Card>
        <Card
          class="other-settlement-report-page__chart"
          size="small"
          title="对象排行"
        >
          <div
            v-if="rankRows.length > 0"
            class="other-settlement-report-page__rank"
          >
            <div
              v-for="item in rankRows"
              :key="item.name"
              class="other-settlement-report-page__rank-row"
            >
              <span>{{ item.name }}</span>
              <b>{{ formatMoney(item.amount) }}</b>
            </div>
          </div>
          <div v-else class="other-settlement-report-page__empty-chart">
            暂无数据
          </div>
        </Card>
      </div>

      <Card
        class="other-settlement-report-page__table-card"
        size="small"
        :title="pageTitle"
      >
        <Table
          :columns="tableColumns"
          :data-source="tableState.rows"
          :loading="tableState.loading"
          :pagination="false"
          row-key="key"
          size="small"
          :scroll="{ x: tableScrollX, y: 420 }"
        >
          <template #bodyCell="{ column, record, text }">
            <template v-if="getColumnDataIndex(column) === 'direction'">
              {{ getDirectionText(record.direction) }}
            </template>
            <template v-else-if="getColumnDataIndex(column) === 'status'">
              <Tag :color="getStatusMeta(record.status).color">
                {{ getStatusMeta(record.status).label }}
              </Tag>
            </template>
            <template
              v-else-if="
                ['amount', 'balance', 'settledAmount'].includes(
                  getColumnDataIndex(column),
                )
              "
            >
              {{ formatMoney(text) }}
            </template>
            <template v-else>
              {{ text || '—' }}
            </template>
          </template>
        </Table>
        <div class="other-settlement-report-page__footer">
          <span>共 {{ tableState.total }} 条记录</span>
          <span>本页 {{ tableState.rows.length }} 条</span>
          <span>本页发生金额：{{ formatMoney(pageSummary.amount) }}</span>
          <span
            >本页结算金额：{{ formatMoney(pageSummary.settledAmount) }}</span
          >
          <span>本页余额：{{ formatMoney(pageSummary.balance) }}</span>
          <Pagination
            v-model:current="tableState.pageNo"
            v-model:page-size="tableState.pageSize"
            :page-size-options="['10', '20', '50']"
            show-size-changer
            :total="tableState.total"
            @change="handlePageChange"
          />
        </div>
      </Card>
    </section>
  </BusinessReportShell>
</template>

<style scoped>
.other-settlement-report-page {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 12px;
}

.other-settlement-report-page__query-card,
.other-settlement-report-page__metric,
.other-settlement-report-page__chart,
.other-settlement-report-page__table-card {
  border-radius: 10px;
}

.other-settlement-report-page__query {
  gap: 8px 0;
}

.other-settlement-report-page__date {
  width: 360px;
}

.other-settlement-report-page__keyword {
  width: 240px;
}

.other-settlement-report-page__select {
  width: 150px;
}

.other-settlement-report-page__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.other-settlement-report-page__metric span,
.other-settlement-report-page__metric small {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.other-settlement-report-page__metric strong {
  display: block;
  margin: 8px 0 4px;
  color: #1d4ed8;
  font-size: 22px;
  line-height: 1.2;
}

.other-settlement-report-page__metric--green strong {
  color: #0f766e;
}

.other-settlement-report-page__metric--orange strong {
  color: #d97706;
}

.other-settlement-report-page__metric--purple strong {
  color: #7c3aed;
}

.other-settlement-report-page__chart-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 0.8fr);
  gap: 12px;
}

.other-settlement-report-page__bars {
  display: flex;
  min-height: 170px;
  align-items: flex-end;
  gap: 16px;
  padding: 12px 8px 0;
  overflow-x: auto;
}

.other-settlement-report-page__bar-item {
  display: grid;
  min-width: 82px;
  grid-template-rows: 110px auto auto;
  gap: 6px;
  color: #64748b;
  font-size: 12px;
  text-align: center;
}

.other-settlement-report-page__bar-track {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: 110px;
  border-radius: 8px;
  background: #f8fafc;
}

.other-settlement-report-page__bar {
  width: 28px;
  border-radius: 8px 8px 0 0;
  background: linear-gradient(180deg, #60a5fa, #2563eb);
}

.other-settlement-report-page__bar-item b,
.other-settlement-report-page__rank-row b {
  color: #2563eb;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.other-settlement-report-page__rank {
  display: flex;
  min-height: 170px;
  flex-direction: column;
  gap: 10px;
  justify-content: center;
  padding: 8px;
}

.other-settlement-report-page__rank-row {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  color: #475569;
  font-size: 13px;
}

.other-settlement-report-page__rank-row span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.other-settlement-report-page__empty-chart {
  display: flex;
  min-height: 170px;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  background: linear-gradient(180deg, #f8fafc, #fff);
  border-radius: 8px;
}

.other-settlement-report-page__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px 16px;
  min-height: 44px;
  padding-top: 10px;
  color: #64748b;
  font-size: 12px;
}

.other-settlement-report-page__footer span {
  white-space: nowrap;
}

:deep(.other-settlement-report-page__table-card .ant-card-body) {
  padding-bottom: 10px;
}

:deep(.other-settlement-report-page__table-card .ant-table),
:deep(.other-settlement-report-page__table-card .ant-table-cell),
:deep(.other-settlement-report-page__table-card .ant-pagination),
:deep(.other-settlement-report-page__query-card .ant-form-item-label > label),
:deep(.other-settlement-report-page__query-card .ant-input),
:deep(.other-settlement-report-page__query-card .ant-select),
:deep(.other-settlement-report-page__query-card .ant-picker),
:deep(.other-settlement-report-page__query-card .ant-btn) {
  font-size: 12px;
}

:deep(.other-settlement-report-page__table-card .ant-table-thead > tr > th) {
  white-space: nowrap;
}

@media (max-width: 1280px) {
  .other-settlement-report-page__metrics,
  .other-settlement-report-page__chart-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .other-settlement-report-page__metrics,
  .other-settlement-report-page__chart-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .other-settlement-report-page__date,
  .other-settlement-report-page__keyword,
  .other-settlement-report-page__select {
    width: 100%;
  }
}
</style>
