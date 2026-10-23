<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';
import type { Dayjs } from 'dayjs';

import type { ErpPayableExpenseApi } from '#/api/erp/finance/payable/expense';
import type { ErpReceivableOtherIncomeApi } from '#/api/erp/finance/receivable/other-income';
import type { ErpPurchaseReportApi } from '#/api/erp/report/purchase';
import type { ErpSaleReportApi } from '#/api/erp/report/sale';
import type { ErpStockTransferLedgerApi } from '#/api/erp/stock/transfer-ledger';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart } from '@vben/utils';

import {
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  FormItem,
  Input,
  Pagination,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { getPayableExpensePage } from '#/api/erp/finance/payable/expense';
import { getOtherIncomePage } from '#/api/erp/finance/receivable/other-income';
import {
  getPurchaseReportDeptPage,
  getPurchaseReportSummary,
  getPurchaseReportTrend,
} from '#/api/erp/report/purchase';
import {
  getSaleReportDeptPage,
  getSaleReportSummary,
  getSaleReportTrend,
} from '#/api/erp/report/sale';
import {
  getStockTransferLedgerPage,
  getStockTransferLedgerTotal,
} from '#/api/erp/stock/transfer-ledger';
import BusinessReportShell from '#/views/erp/report/components/business-report-shell.vue';

defineOptions({ name: 'ErpReportProfitDashboard' });

const { RangePicker } = DatePicker;
const DEFAULT_PAGE_SIZE = 10;

type PageKey =
  | 'cockpit'
  | 'company-profit'
  | 'department-profit'
  | 'history'
  | 'internal-offset'
  | 'metric-drilldown'
  | 'realized-profit'
  | 'unrealized-profit';

type SourceKey = 'expense' | 'income' | 'purchase' | 'sale' | 'transfer';
type RowStatus = 'missing-cost' | 'pending' | 'ready' | 'unavailable';

type ReportRow = {
  amount?: number | string;
  basis: string;
  code: string;
  dept?: string;
  key: string;
  metric: string;
  object: string;
  period: string;
  quantity?: number | string;
  source: string;
  status: RowStatus;
};

type MetricCard = {
  label: string;
  note: string;
  tone: 'blue' | 'green' | 'orange' | 'purple';
  value: string;
};

type SourceStatus = {
  message?: string;
  status: 'failed' | 'loading' | 'ready' | 'skipped';
};

const route = useRoute();
const { hasAccessByCodes } = useAccess();

const pageTitles: Record<PageKey, string> = {
  cockpit: '经营驾驶舱',
  'company-profit': '公司经营利润汇总',
  'department-profit': '部门利润汇总',
  history: '历史利润口径',
  'internal-offset': '内部收入成本抵销',
  'metric-drilldown': '指标下钻明细',
  'realized-profit': '已实现内部利润调整',
  'unrealized-profit': '未实现内部利润明细',
};

const pageDescriptions: Record<PageKey, string> = {
  cockpit:
    '汇总销售、采购、调拨、费用和经营收支的当前可用数据，正式指标按已确认规则输出。',
  'company-profit':
    '展示公司层面的外部经营收入、采购入库、费用、其他经营收支和正式利润状态。',
  'department-profit':
    '按部门展示销售、采购和费用来源数据，部门利润在成本、分摊和调拨规则确认后输出。',
  history: '展示历史经营口径下可核对的来源数据，便于新旧经营分析切换核对。',
  'internal-offset':
    '展示调拨台账中的出入库、差异和异常数据，内部收入成本抵销按规则确认后输出。',
  'metric-drilldown': '展示经营指标的来源模块、取数状态和可下钻范围。',
  'realized-profit':
    '展示对外销售与调拨链路的来源数据，已实现内部利润按正式追踪规则输出。',
  'unrealized-profit':
    '展示调拨在途和库存相关来源状态，未实现内部利润按库存与调拨规则输出。',
};

const statusText: Record<RowStatus, string> = {
  'missing-cost': '成本缺失',
  pending: '待规则确认',
  ready: '可展示',
  unavailable: '不可计算',
};

const statusColor: Record<RowStatus, string> = {
  'missing-cost': 'orange',
  pending: 'gold',
  ready: 'green',
  unavailable: 'default',
};

const sourceTitles: Record<SourceKey, string> = {
  expense: '费用支付',
  income: '其他经营收入',
  purchase: '采购经营',
  sale: '销售经营',
  transfer: '调拨台账',
};

const currentPath = computed(() =>
  typeof route?.path === 'string' ? route.path : '',
);
const canCurrentMenu = computed(() => {
  const matched = Array.isArray(route?.matched) ? route.matched : [];
  return (
    matched.length > 0 &&
    (currentPath.value === '/erp/business-report/profit' ||
      currentPath.value.startsWith('/erp/business-report/profit/'))
  );
});
const canQueryRelatedReports = computed(() =>
  hasAccessByCodes([
    'erp:sale-report:query',
    'erp:sale-report-v2:query',
    'erp:purchase-report:query',
    'erp:purchase-report-v2:query',
    'erp:stock-transfer-ledger:query',
    'erp:payable-expense:query',
    'erp:receivable-other-income:query',
  ]),
);

function normalizePageKey(value: unknown): PageKey {
  if (typeof value !== 'string') return 'department-profit';
  const parts = value.split('/').filter(Boolean);
  const key = parts[parts.length - 1] as PageKey | undefined;
  return key && key in pageTitles ? key : 'department-profit';
}

const pageKey = computed(() => normalizePageKey(currentPath.value));
const pageTitle = computed(() => pageTitles[pageKey.value]);
const pageDescription = computed(() => pageDescriptions[pageKey.value]);
const canCurrentPage = computed(
  () => canCurrentMenu.value || canQueryRelatedReports.value,
);

const query = reactive({
  dateRange: [dayjs().startOf('month'), dayjs().endOf('month')] as [
    Dayjs,
    Dayjs,
  ],
  keyword: '',
  objectType: undefined as string | undefined,
});

const state = reactive({
  error: '',
  loading: false,
  pageNo: 1,
  pageSize: DEFAULT_PAGE_SIZE,
});

const sourceStatus = reactive<Record<SourceKey, SourceStatus>>({
  expense: { status: 'skipped' },
  income: { status: 'skipped' },
  purchase: { status: 'skipped' },
  sale: { status: 'skipped' },
  transfer: { status: 'skipped' },
});

const saleSummary = ref<ErpSaleReportApi.SaleReportSummary>({});
const saleTrend = ref<ErpSaleReportApi.SaleReportTrend[]>([]);
const saleDeptRows = ref<ErpSaleReportApi.SaleDeptReport[]>([]);
const purchaseSummary = ref<ErpPurchaseReportApi.PurchaseReportSummary>({});
const purchaseTrend = ref<ErpPurchaseReportApi.PurchaseReportTrend[]>([]);
const purchaseDeptRows = ref<ErpPurchaseReportApi.PurchaseDeptReport[]>([]);
const transferTotal = ref<Partial<ErpStockTransferLedgerApi.Total>>({});
const expenseRows = ref<ErpPayableExpenseApi.PayableExpense[]>([]);
const incomeRows = ref<ErpReceivableOtherIncomeApi.OtherIncome[]>([]);

const objectOptions = [
  { label: '全部对象', value: '' },
  { label: '公司', value: '公司' },
  { label: '部门', value: '部门' },
  { label: '库存余额', value: '库存余额' },
  { label: '调拨链路', value: '调拨链路' },
  { label: '来源模块', value: '来源模块' },
];

const tableColumns: TableColumnsType<ReportRow> = [
  { dataIndex: 'code', title: '编码', width: 150 },
  { dataIndex: 'metric', title: '指标', width: 180 },
  { dataIndex: 'object', title: '对象', width: 150 },
  { dataIndex: 'dept', title: '部门', width: 150 },
  { dataIndex: 'period', title: '期间', width: 120 },
  { align: 'right', dataIndex: 'quantity', title: '数量', width: 120 },
  { align: 'right', dataIndex: 'amount', title: '金额', width: 140 },
  { dataIndex: 'status', title: '状态', width: 120 },
  { dataIndex: 'source', title: '来源', width: 150 },
  { dataIndex: 'basis', title: '取数口径', width: 280 },
];

let loadSequence = 0;

function formatDateTimeValue(value: Dayjs, boundary: 'end' | 'start') {
  const nextValue =
    boundary === 'start' ? value.startOf('day') : value.endOf('day');
  return nextValue.format('YYYY-MM-DD HH:mm:ss');
}

function formatDateValue(value: Dayjs) {
  return value.format('YYYY-MM-DD');
}

function buildTradeParams() {
  const [start, end] = query.dateRange;
  return {
    bizTime: [
      formatDateTimeValue(start, 'start'),
      formatDateTimeValue(end, 'end'),
    ],
    keyword: query.keyword || undefined,
    pageNo: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

function buildFinanceDateParams(dateTime = false) {
  const [start, end] = query.dateRange;
  return {
    bizTime: dateTime
      ? [formatDateTimeValue(start, 'start'), formatDateTimeValue(end, 'end')]
      : [formatDateValue(start), formatDateValue(end)],
    includeItems: false,
    pageNo: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

function buildTransferParams(): ErpStockTransferLedgerApi.QueryParams {
  const [start, end] = query.dateRange;
  return {
    keyword: query.keyword || undefined,
    moveTime: [
      formatDateTimeValue(start, 'start'),
      formatDateTimeValue(end, 'end'),
    ],
    pageNo: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

function toAmount(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function sumAmount<T>(rows: T[], getter: (row: T) => unknown) {
  return rows.reduce((sum, row) => sum + toAmount(getter(row)), 0);
}

function formatMoney(value: unknown) {
  if (value === '待规则确认' || value === '不可计算' || value === '成本缺失')
    return value;
  return toAmount(value).toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function formatNumber(value: unknown) {
  return toAmount(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

function periodLabel() {
  const [start, end] = query.dateRange;
  return start.isSame(end, 'month')
    ? start.format('YYYY-MM')
    : `${start.format('YYYY-MM-DD')} 至 ${end.format('YYYY-MM-DD')}`;
}

function getColumnDataIndex(column: unknown) {
  return String((column as { dataIndex?: string })?.dataIndex ?? '');
}

async function loadSource<T>(
  key: SourceKey,
  task: () => Promise<T>,
  fallback: T,
) {
  sourceStatus[key] = { status: 'loading' };
  try {
    const result = await task();
    sourceStatus[key] = { status: 'ready' };
    return result;
  } catch (error) {
    console.error(error);
    sourceStatus[key] = { message: '数据读取失败', status: 'failed' };
    return fallback;
  }
}

async function loadData() {
  if (!canCurrentPage.value) return;
  const sequence = ++loadSequence;
  state.loading = true;
  state.error = '';
  try {
    const tradeParams = buildTradeParams();
    const financeDateParams = buildFinanceDateParams(false);
    const incomeDateParams = buildFinanceDateParams(true);
    const transferParams = buildTransferParams();
    const [
      saleResult,
      purchaseResult,
      transferResult,
      expenseResult,
      incomeResult,
    ] = await Promise.all([
      loadSource(
        'sale',
        async () => {
          const [summary, trend, deptPage] = await Promise.all([
            getSaleReportSummary(tradeParams),
            getSaleReportTrend(tradeParams),
            getSaleReportDeptPage(tradeParams),
          ]);
          return {
            deptRows: deptPage.list ?? [],
            summary: summary ?? {},
            trend: trend ?? [],
          };
        },
        { deptRows: [], summary: {}, trend: [] } as {
          deptRows: ErpSaleReportApi.SaleDeptReport[];
          summary: ErpSaleReportApi.SaleReportSummary;
          trend: ErpSaleReportApi.SaleReportTrend[];
        },
      ),
      loadSource(
        'purchase',
        async () => {
          const [summary, trend, deptPage] = await Promise.all([
            getPurchaseReportSummary(tradeParams),
            getPurchaseReportTrend(tradeParams),
            getPurchaseReportDeptPage(tradeParams),
          ]);
          return {
            deptRows: deptPage.list ?? [],
            summary: summary ?? {},
            trend: trend ?? [],
          };
        },
        { deptRows: [], summary: {}, trend: [] } as {
          deptRows: ErpPurchaseReportApi.PurchaseDeptReport[];
          summary: ErpPurchaseReportApi.PurchaseReportSummary;
          trend: ErpPurchaseReportApi.PurchaseReportTrend[];
        },
      ),
      loadSource(
        'transfer',
        async () => {
          const [total, page] = await Promise.all([
            getStockTransferLedgerTotal(transferParams),
            getStockTransferLedgerPage(transferParams),
          ]);
          return { rows: page.list ?? [], total: total ?? {} };
        },
        { rows: [], total: {} } as {
          rows: ErpStockTransferLedgerApi.Summary[];
          total: Partial<ErpStockTransferLedgerApi.Total>;
        },
      ),
      loadSource(
        'expense',
        async () => {
          const page = await getPayableExpensePage(financeDateParams);
          return page.list ?? [];
        },
        [] as ErpPayableExpenseApi.PayableExpense[],
      ),
      loadSource(
        'income',
        async () => {
          const page = await getOtherIncomePage(incomeDateParams);
          return page.list ?? [];
        },
        [] as ErpReceivableOtherIncomeApi.OtherIncome[],
      ),
    ]);

    if (sequence !== loadSequence) return;
    saleSummary.value = saleResult.summary;
    saleTrend.value = saleResult.trend;
    saleDeptRows.value = saleResult.deptRows;
    purchaseSummary.value = purchaseResult.summary;
    purchaseTrend.value = purchaseResult.trend;
    purchaseDeptRows.value = purchaseResult.deptRows;
    transferTotal.value = transferResult.total;
    expenseRows.value = expenseResult;
    incomeRows.value = incomeResult;
  } catch (error) {
    console.error(error);
    if (sequence === loadSequence)
      state.error = '经营报表数据加载失败，请稍后重试';
  } finally {
    if (sequence === loadSequence) state.loading = false;
  }
}

function baseRows(): ReportRow[] {
  const period = periodLabel();
  const expenseAmount = sumAmount(expenseRows.value, (row) => row.totalAmount);
  const incomeAmount = sumAmount(incomeRows.value, (row) => row.totalAmount);
  return [
    {
      amount: saleSummary.value.netAmount,
      basis: '按销售报表出库金额减退货金额展示',
      code: 'SRC-SALE-NET',
      key: 'SRC-SALE-NET',
      metric: '销售净额',
      object: '公司',
      period,
      quantity: saleSummary.value.saleCount,
      source: '销售经营',
      status: sourceStatus.sale.status === 'ready' ? 'ready' : 'unavailable',
    },
    {
      amount: purchaseSummary.value.netAmount,
      basis: '按采购报表入库金额减采购退货金额展示',
      code: 'SRC-PURCHASE-NET',
      key: 'SRC-PURCHASE-NET',
      metric: '采购净额',
      object: '公司',
      period,
      quantity: purchaseSummary.value.purchaseCount,
      source: '采购经营',
      status:
        sourceStatus.purchase.status === 'ready' ? 'ready' : 'unavailable',
    },
    {
      amount: expenseAmount,
      basis: '按费用支付当前筛选页主表金额汇总展示',
      code: 'SRC-EXPENSE',
      key: 'SRC-EXPENSE',
      metric: '费用支付',
      object: '公司',
      period,
      quantity: expenseRows.value.length,
      source: '费用收支',
      status: sourceStatus.expense.status === 'ready' ? 'ready' : 'unavailable',
    },
    {
      amount: incomeAmount,
      basis: '按其他经营收入当前筛选页主表金额汇总展示',
      code: 'SRC-INCOME',
      key: 'SRC-INCOME',
      metric: '其他经营收入',
      object: '公司',
      period,
      quantity: incomeRows.value.length,
      source: '费用收支',
      status: sourceStatus.income.status === 'ready' ? 'ready' : 'unavailable',
    },
    {
      amount: '不可计算',
      basis:
        '缺少正式成本、分摊、抵销和利润公式时不输出利润，成本缺失不按0计算',
      code: 'FORMAL-PROFIT',
      key: 'FORMAL-PROFIT',
      metric: '正式经营利润',
      object: '公司',
      period,
      source: '部门利润及驾驶舱',
      status: 'pending',
    },
  ];
}

function departmentRows(): ReportRow[] {
  const period = periodLabel();
  const saleRows = saleDeptRows.value.map((row, index) => ({
    amount: row.netAmount,
    basis: '按销售部门汇总接口展示销售净额',
    code: `DP-SALE-${row.deptId ?? index}`,
    dept: row.deptName || '未分配部门',
    key: `DP-SALE-${row.deptId ?? index}`,
    metric: '部门销售净额',
    object: '部门',
    period,
    quantity: row.saleCount,
    source: '销售经营',
    status: 'ready' as RowStatus,
  }));
  const purchaseRows = purchaseDeptRows.value.map((row, index) => ({
    amount: row.netAmount,
    basis: '按采购部门汇总接口展示采购净额',
    code: `DP-PURCHASE-${row.deptId ?? index}`,
    dept: row.deptName || '未分配部门',
    key: `DP-PURCHASE-${row.deptId ?? index}`,
    metric: '部门采购净额',
    object: '部门',
    period,
    quantity: row.purchaseCount,
    source: '采购经营',
    status: 'ready' as RowStatus,
  }));
  return [
    ...saleRows,
    ...purchaseRows,
    {
      amount: '不可计算',
      basis: '部门费用分摊、调拨收益、成本快照和损益规则确认后输出',
      code: 'DP-FORMAL-PROFIT',
      dept: '全部部门',
      key: 'DP-FORMAL-PROFIT',
      metric: '部门利润',
      object: '部门',
      period,
      source: '部门利润及驾驶舱',
      status: 'pending',
    },
  ];
}

function transferOffsetRows(): ReportRow[] {
  const period = periodLabel();
  return [
    {
      amount: transferTotal.value.transferOutCount,
      basis: '按调拨台账总计展示调拨出库数量',
      code: 'IO-OUT-QTY',
      key: 'IO-OUT-QTY',
      metric: '调拨出库数量',
      object: '调拨链路',
      period,
      source: '调拨台账',
      status:
        sourceStatus.transfer.status === 'ready' ? 'ready' : 'unavailable',
    },
    {
      amount: transferTotal.value.transferInCount,
      basis: '按调拨台账总计展示调拨入库数量',
      code: 'IO-IN-QTY',
      key: 'IO-IN-QTY',
      metric: '调拨入库数量',
      object: '调拨链路',
      period,
      source: '调拨台账',
      status:
        sourceStatus.transfer.status === 'ready' ? 'ready' : 'unavailable',
    },
    {
      amount: transferTotal.value.differenceCount,
      basis: '按调拨台账差异数量展示在途或未配平状态',
      code: 'IO-DIFF-QTY',
      key: 'IO-DIFF-QTY',
      metric: '调拨差异数量',
      object: '调拨链路',
      period,
      source: '调拨台账',
      status:
        sourceStatus.transfer.status === 'ready' ? 'ready' : 'unavailable',
    },
    {
      amount: '待规则确认',
      basis: '内部收入成本抵销、未实现利润抵销和已实现利润调整按正式规则输出',
      code: 'IO-OFFSET',
      key: 'IO-OFFSET',
      metric: '内部收入成本抵销',
      object: '调拨链路',
      period,
      source: '部门利润及驾驶舱',
      status: 'pending',
    },
  ];
}

function metricDrilldownRows(): ReportRow[] {
  const period = periodLabel();
  return (Object.keys(sourceTitles) as SourceKey[]).map((key) => ({
    basis:
      sourceStatus[key].status === 'ready'
        ? '可按现有经营报表入口继续查看明细'
        : sourceStatus[key].message || '当前来源不可用',
    code: `DRILL-${key.toUpperCase()}`,
    key: `DRILL-${key}`,
    metric: `${sourceTitles[key]}来源状态`,
    object: '来源模块',
    period,
    source: sourceTitles[key],
    status: sourceStatus[key].status === 'ready' ? 'ready' : 'unavailable',
  }));
}

function realizedRows(): ReportRow[] {
  const period = periodLabel();
  return [
    {
      amount: saleSummary.value.netAmount,
      basis: '对外销售净额已可展示，内部利润实现规则确认后分配',
      code: 'RP-SALE-NET',
      key: 'RP-SALE-NET',
      metric: '对外销售净额',
      object: '销售链路',
      period,
      quantity: saleSummary.value.saleCount,
      source: '销售经营',
      status: sourceStatus.sale.status === 'ready' ? 'ready' : 'unavailable',
    },
    {
      amount: transferTotal.value.transferOutCount,
      basis: '调拨链路数量已可展示，利润实现与退货冲回按正式追踪规则输出',
      code: 'RP-TRANSFER',
      key: 'RP-TRANSFER',
      metric: '调拨链路数量',
      object: '调拨链路',
      period,
      source: '调拨台账',
      status:
        sourceStatus.transfer.status === 'ready' ? 'ready' : 'unavailable',
    },
    {
      amount: '待规则确认',
      basis: '多级调拨、部分销售、退货和跨期结转确认后输出',
      code: 'RP-FORMAL',
      key: 'RP-FORMAL',
      metric: '已实现内部利润',
      object: '销售链路',
      period,
      source: '部门利润及驾驶舱',
      status: 'pending',
    },
  ];
}

function unrealizedRows(): ReportRow[] {
  const period = periodLabel();
  return [
    {
      amount: transferTotal.value.differenceCount,
      basis: '按调拨台账差异数量展示未配平链路',
      code: 'UP-DIFF',
      key: 'UP-DIFF',
      metric: '调拨差异数量',
      object: '调拨链路',
      period,
      source: '调拨台账',
      status:
        sourceStatus.transfer.status === 'ready' ? 'ready' : 'unavailable',
    },
    {
      amount: '待规则确认',
      basis: '库存余额、原始财务成本和内部利润归属确认后输出',
      code: 'UP-FORMAL',
      key: 'UP-FORMAL',
      metric: '未实现内部利润',
      object: '库存余额',
      period,
      source: '库存及调拨',
      status: 'pending',
    },
  ];
}

const rawRows = computed<ReportRow[]>(() => {
  switch (pageKey.value) {
    case 'cockpit': {
      return [...baseRows(), ...metricDrilldownRows().slice(0, 3)];
    }
    case 'company-profit': {
      return baseRows();
    }
    case 'department-profit': {
      return departmentRows();
    }
    case 'history': {
      return [
        ...baseRows()
          .slice(0, 4)
          .map((row) => ({
            ...row,
            code: `HIS-${row.code}`,
            object: '历史期间',
          })),
        {
          amount: '待规则确认',
          basis: '切换日前后按历史来源数据与新经营口径分别核对',
          code: 'HIS-CHECK',
          key: 'HIS-CHECK',
          metric: '历史经营口径核对',
          object: '历史期间',
          period: periodLabel(),
          source: '历史经营分析',
          status: 'pending',
        },
      ];
    }
    case 'internal-offset': {
      return transferOffsetRows();
    }
    case 'metric-drilldown': {
      return metricDrilldownRows();
    }
    case 'realized-profit': {
      return realizedRows();
    }
    case 'unrealized-profit': {
      return unrealizedRows();
    }
  }
  return [];
});

const rows = computed(() => {
  const keyword = query.keyword.trim().toLowerCase();
  return rawRows.value.filter((row) => {
    const matchesKeyword =
      !keyword ||
      [row.code, row.metric, row.object, row.source, row.basis, row.dept]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    const matchesObject =
      !query.objectType || row.object.includes(query.objectType);
    return matchesKeyword && matchesObject;
  });
});

const pagedRows = computed(() => {
  const start = (state.pageNo - 1) * state.pageSize;
  return rows.value.slice(start, start + state.pageSize);
});

const metrics = computed<MetricCard[]>(() => {
  const expenseAmount = sumAmount(expenseRows.value, (row) => row.totalAmount);
  const incomeAmount = sumAmount(incomeRows.value, (row) => row.totalAmount);
  if (pageKey.value === 'department-profit') {
    return [
      {
        label: '部门销售净额',
        note: '按销售部门汇总',
        tone: 'blue',
        value: formatMoney(
          sumAmount(saleDeptRows.value, (row) => row.netAmount),
        ),
      },
      {
        label: '部门采购净额',
        note: '按采购部门汇总',
        tone: 'green',
        value: formatMoney(
          sumAmount(purchaseDeptRows.value, (row) => row.netAmount),
        ),
      },
      {
        label: '正式部门利润',
        note: '成本和分摊规则确认后输出',
        tone: 'orange',
        value: '不可计算',
      },
      {
        label: '当前记录',
        note: '每页 10 条',
        tone: 'purple',
        value: formatNumber(rows.value.length),
      },
    ];
  }
  if (
    pageKey.value === 'internal-offset' ||
    pageKey.value === 'unrealized-profit'
  ) {
    return [
      {
        label: '调拨出库数',
        note: '按调拨台账汇总',
        tone: 'blue',
        value: formatNumber(transferTotal.value.transferOutCount),
      },
      {
        label: '调拨入库数',
        note: '按调拨台账汇总',
        tone: 'green',
        value: formatNumber(transferTotal.value.transferInCount),
      },
      {
        label: '差异数量',
        note: '用于识别未配平链路',
        tone: 'orange',
        value: formatNumber(transferTotal.value.differenceCount),
      },
      {
        label: '抵销金额',
        note: '正式规则确认后输出',
        tone: 'purple',
        value: '待规则确认',
      },
    ];
  }
  return [
    {
      label: '销售净额',
      note: '按销售出退汇总',
      tone: 'blue',
      value: formatMoney(saleSummary.value.netAmount),
    },
    {
      label: '采购净额',
      note: '按采购入退汇总',
      tone: 'green',
      value: formatMoney(purchaseSummary.value.netAmount),
    },
    {
      label: '费用支付',
      note: '当前筛选页汇总',
      tone: 'orange',
      value: formatMoney(expenseAmount),
    },
    {
      label: '其他经营收入',
      note: '当前筛选页汇总',
      tone: 'purple',
      value: formatMoney(incomeAmount),
    },
  ];
});

const trendRows = computed(() => {
  const periods = new Map<
    string,
    { period: string; purchase: number; sale: number }
  >();
  for (const item of saleTrend.value) {
    const period = item.period || '-';
    periods.set(period, {
      period,
      purchase: periods.get(period)?.purchase ?? 0,
      sale: toAmount(item.netAmount),
    });
  }
  for (const item of purchaseTrend.value) {
    const period = item.period || '-';
    const current = periods.get(period) ?? { period, purchase: 0, sale: 0 };
    current.purchase = toAmount(item.netAmount);
    periods.set(period, current);
  }
  return [...periods.values()].slice(-6);
});

const trendMax = computed(() =>
  Math.max(
    1,
    ...trendRows.value.flatMap((row) => [
      Math.abs(row.sale),
      Math.abs(row.purchase),
    ]),
  ),
);
const rankRows = computed(() => rows.value.slice(0, 5));

function resetQuery() {
  query.keyword = '';
  query.objectType = undefined;
  query.dateRange = [dayjs().startOf('month'), dayjs().endOf('month')];
  state.pageNo = 1;
  state.pageSize = DEFAULT_PAGE_SIZE;
  void loadData();
}

function handleSearch() {
  state.pageNo = 1;
  void loadData();
}

function handlePageChange(page: number, pageSize: number) {
  state.pageNo = page;
  state.pageSize = pageSize;
}

function escapeCsv(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function handleExport() {
  const header = [
    '编码',
    '指标',
    '对象',
    '部门',
    '期间',
    '数量',
    '金额',
    '状态',
    '来源',
    '取数口径',
  ];
  const body = rows.value.map((row) =>
    [
      row.code,
      row.metric,
      row.object,
      row.dept || '',
      row.period,
      row.quantity ?? '',
      typeof row.amount === 'number'
        ? formatMoney(row.amount)
        : row.amount || '',
      statusText[row.status],
      row.source,
      row.basis,
    ]
      .map((value) => escapeCsv(value))
      .join(','),
  );
  const source = new Blob([`\uFEFF${[header.join(','), ...body].join('\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  downloadFileFromBlobPart({ fileName: `${pageTitle.value}.csv`, source });
}

watch(
  () => pageKey.value,
  () => {
    state.pageNo = 1;
    void loadData();
  },
);

onMounted(() => void loadData());
</script>

<template>
  <BusinessReportShell
    :body-scrollable="true"
    :denied="!canCurrentPage"
    :title="`经营报表 · 部门利润及驾驶舱 · ${pageTitle}`"
  >
    <section class="profit-dashboard-report-page">
      <Card class="profit-dashboard-report-page__query-card" size="small">
        <Form class="profit-dashboard-report-page__query" layout="inline">
          <FormItem label="统计期间">
            <RangePicker
              v-model:value="query.dateRange"
              :allow-clear="false"
              class="profit-dashboard-report-page__date"
              format="YYYY-MM-DD"
            />
          </FormItem>
          <FormItem label="业务对象">
            <Select
              v-model:value="query.objectType"
              allow-clear
              class="profit-dashboard-report-page__select"
              :options="objectOptions"
              placeholder="请选择对象"
            />
          </FormItem>
          <FormItem label="关键词">
            <Input
              v-model:value="query.keyword"
              allow-clear
              class="profit-dashboard-report-page__keyword"
              placeholder="指标 / 对象 / 部门 / 来源"
              @press-enter="handleSearch"
            />
          </FormItem>
          <FormItem>
            <Space>
              <Button type="primary" @click="handleSearch">查询</Button>
              <Button @click="resetQuery">重置</Button>
              <Button @click="handleExport">导出</Button>
            </Space>
          </FormItem>
        </Form>
      </Card>

      <Card class="profit-dashboard-report-page__intro" size="small">
        <div>
          <strong>{{ pageTitle }}</strong>
          <p>{{ pageDescription }}</p>
        </div>
        <Tag color="blue">经营报表</Tag>
      </Card>

      <div class="profit-dashboard-report-page__metrics">
        <Card
          v-for="item in metrics"
          :key="item.label"
          class="profit-dashboard-report-page__metric"
          :class="`profit-dashboard-report-page__metric--${item.tone}`"
          size="small"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <small>{{ item.note }}</small>
        </Card>
      </div>

      <div class="profit-dashboard-report-page__chart-grid">
        <Card
          class="profit-dashboard-report-page__chart"
          size="small"
          title="销售采购趋势"
        >
          <div
            v-if="trendRows.length > 0"
            class="profit-dashboard-report-page__bars"
          >
            <div
              v-for="row in trendRows"
              :key="row.period"
              class="profit-dashboard-report-page__bar-group"
            >
              <i
                class="profit-dashboard-report-page__bar--sale"
                :style="{
                  height: `${Math.max(8, (Math.abs(row.sale) / trendMax) * 100)}%`,
                }"
              ></i>
              <i
                class="profit-dashboard-report-page__bar--purchase"
                :style="{
                  height: `${Math.max(8, (Math.abs(row.purchase) / trendMax) * 100)}%`,
                }"
              ></i>
              <span>{{ row.period }}</span>
            </div>
          </div>
          <Empty v-else description="暂无趋势数据" />
        </Card>
        <Card
          class="profit-dashboard-report-page__chart"
          size="small"
          title="当前页排行"
        >
          <div class="profit-dashboard-report-page__rank">
            <p v-for="row in rankRows" :key="`${row.key}-rank`">
              <span>{{ row.dept || row.object || row.metric }}</span>
              <b>{{
                typeof row.amount === 'number'
                  ? formatMoney(row.amount)
                  : row.amount || statusText[row.status]
              }}</b>
            </p>
            <Empty v-if="rankRows.length === 0" description="暂无数据" />
          </div>
        </Card>
      </div>

      <Card
        class="profit-dashboard-report-page__table-card"
        size="small"
        :title="pageTitle"
      >
        <div v-if="state.error" class="profit-dashboard-report-page__error">
          {{ state.error }}
        </div>
        <Table
          :columns="tableColumns"
          :data-source="pagedRows"
          :loading="state.loading"
          :pagination="false"
          row-key="key"
          size="small"
          :scroll="{ x: 1510, y: 360 }"
        >
          <template #bodyCell="{ column, record, text }">
            <template v-if="getColumnDataIndex(column) === 'status'">
              <Tag :color="statusColor[record.status]">{{
                statusText[record.status]
              }}</Tag>
            </template>
            <template v-else-if="getColumnDataIndex(column) === 'amount'">
              {{ typeof text === 'number' ? formatMoney(text) : text || '-' }}
            </template>
            <template v-else-if="getColumnDataIndex(column) === 'quantity'">
              {{ typeof text === 'number' ? formatNumber(text) : text || '-' }}
            </template>
            <template v-else>
              {{ text || '-' }}
            </template>
          </template>
        </Table>
        <div class="profit-dashboard-report-page__footer">
          <span>共 {{ rows.length }} 条记录</span>
          <span>本页 {{ pagedRows.length }} 条</span>
          <span>每页 10 条</span>
          <Pagination
            v-model:current="state.pageNo"
            v-model:page-size="state.pageSize"
            :page-size-options="['10', '20', '50']"
            show-size-changer
            :total="rows.length"
            @change="handlePageChange"
          />
        </div>
      </Card>
    </section>
  </BusinessReportShell>
</template>

<style scoped>
.profit-dashboard-report-page {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding-bottom: 12px;
}

.profit-dashboard-report-page__query-card,
.profit-dashboard-report-page__intro,
.profit-dashboard-report-page__metric,
.profit-dashboard-report-page__chart,
.profit-dashboard-report-page__table-card {
  border-radius: 10px;
}

.profit-dashboard-report-page__query {
  gap: 8px 0;
}

.profit-dashboard-report-page__date {
  width: 260px;
}

.profit-dashboard-report-page__keyword {
  width: 260px;
}

.profit-dashboard-report-page__select {
  width: 150px;
}

.profit-dashboard-report-page__intro {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  background: linear-gradient(135deg, #eef5ff, #fff 58%);
}

.profit-dashboard-report-page__intro strong {
  color: #173461;
  font-size: 16px;
}

.profit-dashboard-report-page__intro p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
}

.profit-dashboard-report-page__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.profit-dashboard-report-page__metric span,
.profit-dashboard-report-page__metric small {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.profit-dashboard-report-page__metric strong {
  display: block;
  margin: 8px 0 4px;
  color: #1d4ed8;
  font-size: 22px;
  line-height: 1.2;
}

.profit-dashboard-report-page__metric--green strong {
  color: #0f766e;
}

.profit-dashboard-report-page__metric--orange strong {
  color: #d97706;
}

.profit-dashboard-report-page__metric--purple strong {
  color: #7c3aed;
}

.profit-dashboard-report-page__chart-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.8fr);
  gap: 12px;
}

.profit-dashboard-report-page__bars {
  display: flex;
  align-items: flex-end;
  min-height: 150px;
  gap: 16px;
  padding: 14px 12px 0;
  background: linear-gradient(180deg, #f8fafc, #fff);
  border-radius: 8px;
}

.profit-dashboard-report-page__bar-group {
  display: flex;
  flex: 1 1 0;
  align-items: flex-end;
  justify-content: center;
  min-width: 64px;
  height: 150px;
  gap: 4px;
  position: relative;
}

.profit-dashboard-report-page__bar-group i {
  display: block;
  width: 18px;
  min-height: 8px;
  max-height: 120px;
  border-radius: 8px 8px 0 0;
}

.profit-dashboard-report-page__bar--sale {
  background: linear-gradient(180deg, #60a5fa, #2563eb);
}

.profit-dashboard-report-page__bar--purchase {
  background: linear-gradient(180deg, #34d399, #0f766e);
}

.profit-dashboard-report-page__bar-group span {
  position: absolute;
  bottom: -20px;
  color: #64748b;
  font-size: 12px;
}

.profit-dashboard-report-page__rank {
  display: grid;
  min-height: 150px;
  align-content: start;
  gap: 8px;
}

.profit-dashboard-report-page__rank p {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0;
  padding: 8px 10px;
  color: #475569;
  background: #f8fbff;
  border-radius: 8px;
}

.profit-dashboard-report-page__rank b {
  color: #2563eb;
}

.profit-dashboard-report-page__error {
  margin-bottom: 8px;
  padding: 8px 10px;
  color: #b42318;
  background: #fff1f0;
  border: 1px solid #ffccc7;
  border-radius: 8px;
  font-size: 13px;
}

.profit-dashboard-report-page__footer {
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

.profit-dashboard-report-page__footer span {
  white-space: nowrap;
}

:deep(.profit-dashboard-report-page__table-card .ant-card-body) {
  padding-bottom: 10px;
}

:deep(.profit-dashboard-report-page__table-card .ant-table),
:deep(.profit-dashboard-report-page__table-card .ant-table-cell),
:deep(.profit-dashboard-report-page__table-card .ant-pagination),
:deep(.profit-dashboard-report-page__query-card .ant-form-item-label > label),
:deep(.profit-dashboard-report-page__query-card .ant-input),
:deep(.profit-dashboard-report-page__query-card .ant-select),
:deep(.profit-dashboard-report-page__query-card .ant-picker),
:deep(.profit-dashboard-report-page__query-card .ant-btn) {
  font-size: 12px;
}

:deep(.profit-dashboard-report-page__table-card .ant-table-thead > tr > th) {
  white-space: nowrap;
}

@media (max-width: 1280px) {
  .profit-dashboard-report-page__metrics,
  .profit-dashboard-report-page__chart-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .profit-dashboard-report-page__metrics,
  .profit-dashboard-report-page__chart-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .profit-dashboard-report-page__date,
  .profit-dashboard-report-page__keyword,
  .profit-dashboard-report-page__select {
    width: 100%;
  }
}
</style>
