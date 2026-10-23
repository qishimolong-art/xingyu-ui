<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue';
import type { Dayjs } from 'dayjs';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart, formatDateTime } from '@vben/utils';

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

import {
  exportStockTransferIn,
  getStockTransferInPage,
} from '#/api/erp/stock/transfer-in';
import {
  exportStockTransferLedger,
  getStockTransferLedgerPage,
  getStockTransferLedgerTotal,
  normalizeStockTransferLedgerDate,
} from '#/api/erp/stock/transfer-ledger';
import {
  exportStockTransferOut,
  getStockTransferOutPage,
} from '#/api/erp/stock/transfer-out';
import {
  exportWarehouseMove,
  getWarehouseMovePage,
  getWarehouseMoveSummary,
} from '#/api/erp/stock/warehouse-move';
import BusinessReportShell from '#/views/erp/report/components/business-report-shell.vue';

import WarehouseMoveDetailReport from './modules/warehouse-move-detail-report.vue';

interface MetricCard {
  label: string;
  note: string;
  tone?: 'blue' | 'green' | 'orange' | 'purple';
  value: string;
}

interface ReportRow {
  amount?: number | string;
  bizDate?: string;
  bizType?: string;
  costAmount?: number | string;
  differenceQty?: number | string;
  docNo?: string;
  fromDept?: string;
  fromWarehouse?: string;
  key: string;
  margin?: string;
  receivedQty?: number | string;
  relation?: string;
  remark?: string;
  sourceNo?: string;
  status?: number | string;
  toDept?: string;
  toWarehouse?: string;
  totalQty?: number | string;
}

type PageKey =
  | 'chain'
  | 'in-transit'
  | 'ledger'
  | 'legacy'
  | 'move'
  | 'price-difference';

type DataSourceKind =
  | 'history'
  | 'ledger'
  | 'move'
  | 'transferIn'
  | 'transferOut';

type HistoryType = 'move' | 'transferIn' | 'transferOut';

interface TableState {
  error: string;
  loading: boolean;
  pageNo: number;
  pageSize: number;
  rows: ReportRow[];
  total: number;
}

interface LedgerTotal {
  abnormalGroupCount?: number;
  differenceCount?: number;
  transferInCount?: number;
  transferOutCount?: number;
}

interface MoveSummary {
  totalCostAmount?: null | number;
  totalCount?: number;
  totalItems?: number;
  totalPrice?: null | number;
  totalRows?: number;
}

defineOptions({ name: 'ErpBusinessReportTransfer' });

const RangePicker = DatePicker.RangePicker;
const DEFAULT_PAGE_SIZE = 10;

const route = useRoute();
const { hasAccessByCodes } = useAccess();

const currentPath = computed(() =>
  typeof route?.path === 'string' ? route.path : '',
);
const canCurrentMenu = computed(() => {
  const matched = Array.isArray(route?.matched) ? route.matched : [];
  return (
    matched.length > 0 &&
    (currentPath.value === '/erp/business-report/transfer' ||
      currentPath.value.startsWith('/erp/business-report/transfer/'))
  );
});
const canQueryTransferLedger = computed(() =>
  hasAccessByCodes(['erp:stock-transfer-ledger:query']),
);
const canQueryTransferOut = computed(() =>
  hasAccessByCodes(['erp:stock-transfer-out:query']),
);
const canQueryTransferIn = computed(() =>
  hasAccessByCodes(['erp:stock-transfer-in:query']),
);
const canQueryWarehouseMove = computed(() =>
  hasAccessByCodes(['erp:warehouse-move:query']),
);
const canExportTransferLedger = computed(
  () =>
    canCurrentMenu.value ||
    hasAccessByCodes(['erp:stock-transfer-ledger:export']),
);
const canExportTransferOut = computed(
  () =>
    canCurrentMenu.value || hasAccessByCodes(['erp:stock-transfer-out:export']),
);
const canExportTransferIn = computed(
  () =>
    canCurrentMenu.value || hasAccessByCodes(['erp:stock-transfer-in:export']),
);
const canExportWarehouseMove = computed(
  () => canCurrentMenu.value || hasAccessByCodes(['erp:warehouse-move:export']),
);

const pageTitles: Record<PageKey, string> = {
  chain: '调拨链路追踪',
  'in-transit': '调拨在途明细',
  legacy: '历史调拨口径',
  ledger: '调拨出入库台账',
  move: '仓库移货明细报表',
  'price-difference': '调拨差价分析',
};

const pageDescriptions: Record<PageKey, string> = {
  chain:
    '按现有调拨来源和关联单据展示调拨链路，支持从来源单、调拨出库和调拨入库关系进行追溯。',
  'in-transit':
    '按现有调拨台账差异展示已发出未完整入库的数量状态，正式在途成本按核算规则确认。',
  legacy:
    '按现有调拨出库、调拨入库和移仓单据展示历史口径数据，保留原单据字段与状态。',
  ledger: '按业务日期核对调拨出库、调拨入库、数量差异和异常状态。',
  move: '按已审核仓库移货单逐条展示配件、仓库、货架、数量及金额明细。',
  'price-difference':
    '按现有调拨单据展示金额、数量和来源状态；调拨利润和内部利润按正式规则确认后展示。',
};

const pagePermissions: Record<PageKey, () => boolean> = {
  chain: () => canQueryTransferOut.value || canQueryTransferIn.value,
  'in-transit': () => canQueryTransferLedger.value,
  legacy: () =>
    canQueryTransferOut.value ||
    canQueryTransferIn.value ||
    canQueryWarehouseMove.value,
  ledger: () => canQueryTransferLedger.value,
  move: () => canQueryWarehouseMove.value,
  'price-difference': () => canQueryTransferOut.value,
};

const query = reactive<{
  dateRange?: [Dayjs, Dayjs];
  historyType: HistoryType;
  keyword: string;
  status?: number;
}>({
  dateRange: [dayjs().subtract(29, 'day').startOf('day'), dayjs().endOf('day')],
  historyType: 'transferOut',
  keyword: '',
  status: undefined,
});

const state = reactive<TableState>({
  error: '',
  loading: false,
  pageNo: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  rows: [],
  total: 0,
});
const ledgerTotal = ref<LedgerTotal>({});
const moveSummary = ref<MoveSummary>({});
let loadSequence = 0;

function normalizePageKey(value: unknown): PageKey {
  if (typeof value !== 'string') return 'ledger';
  if (value.endsWith('/erp/stock/transfer-ledger')) return 'ledger';
  const key = value.split('/').findLast(Boolean) as PageKey | undefined;
  return key && key in pageTitles ? key : 'ledger';
}

const pageKey = computed(() => normalizePageKey(route?.path));
const pageTitle = computed(() => pageTitles[pageKey.value]);
const pageDescription = computed(() => pageDescriptions[pageKey.value]);
const canCurrentPage = computed(
  () => canCurrentMenu.value || (pagePermissions[pageKey.value]?.() ?? false),
);
const dataSourceKind = computed<DataSourceKind>(() => {
  if (pageKey.value === 'move') return 'move';
  if (pageKey.value === 'chain' || pageKey.value === 'price-difference') {
    return 'transferOut';
  }
  if (pageKey.value === 'legacy') return 'history';
  return 'ledger';
});
const currentHistoryKind = computed<
  Exclude<DataSourceKind, 'history' | 'ledger'>
>(() => query.historyType);
const effectiveDataSourceKind = computed<Exclude<DataSourceKind, 'history'>>(
  () =>
    dataSourceKind.value === 'history'
      ? currentHistoryKind.value
      : dataSourceKind.value,
);
const canCurrentExport = computed(() => {
  if (effectiveDataSourceKind.value === 'ledger')
    return canExportTransferLedger.value;
  if (effectiveDataSourceKind.value === 'move')
    return canExportWarehouseMove.value;
  if (effectiveDataSourceKind.value === 'transferIn')
    return canExportTransferIn.value;
  return canExportTransferOut.value;
});

const historyTypeOptions = [
  { label: '调拨出库', value: 'transferOut' },
  { label: '调拨入库', value: 'transferIn' },
  { label: '移仓记录', value: 'move' },
];
const statusOptions = [
  { label: '草稿', value: 0 },
  { label: '待审核', value: 10 },
  { label: '已审核', value: 20 },
];

function formatNumber(value: unknown, maximumFractionDigits = 3) {
  const next = Number(value ?? 0);
  if (!Number.isFinite(next)) return '—';
  return next.toLocaleString('zh-CN', { maximumFractionDigits });
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

function formatDate(value: unknown) {
  if (!value) return '—';
  return formatDateTime(value as string) || String(value);
}

function getStatusMeta(value: unknown) {
  if (value === 'ABNORMAL') return { color: 'warning', label: '存在差异' };
  if (value === 'NORMAL') return { color: 'success', label: '正常' };
  if (value === 20 || value === '20')
    return { color: 'success', label: '已审核' };
  if (value === 10 || value === '10')
    return { color: 'processing', label: '待审核' };
  if (value === 0 || value === '0') return { color: 'default', label: '草稿' };
  if (value) return { color: 'default', label: String(value) };
  return { color: 'default', label: '—' };
}

function sumRows(field: keyof ReportRow) {
  let total = 0;
  for (const row of state.rows) {
    const value = Number(row[field] ?? 0);
    if (Number.isFinite(value)) total += value;
  }
  return total;
}

function buildBaseParams() {
  const params: Record<string, any> = {
    pageNo: state.pageNo,
    pageSize: state.pageSize,
    includeItems: false,
  };
  if (query.keyword.trim()) params.keyword = query.keyword.trim();
  if (query.status !== undefined) params.status = query.status;
  if (query.dateRange) {
    params.moveTime = [
      query.dateRange[0].format('YYYY-MM-DD HH:mm:ss'),
      query.dateRange[1].format('YYYY-MM-DD HH:mm:ss'),
    ];
  }
  return params;
}

function buildLedgerParams() {
  const params = buildBaseParams();
  params.orderField = 'businessDate';
  params.orderDirection = 'desc';
  if (pageKey.value === 'in-transit') {
    params.matchStatus = 'ABNORMAL';
  }
  return params;
}

function rowKey(prefix: string, row: Record<string, any>, index: number) {
  return String(
    row.id ?? row.rowKey ?? row.groupKey ?? row.no ?? `${prefix}-${index}`,
  );
}

function mapLedgerRows(list: any[]): ReportRow[] {
  return list.map((row, index) => {
    const difference = Number(row.differenceCount ?? 0);
    return {
      bizDate: normalizeStockTransferLedgerDate(row.businessDate, 'YYYY-MM-DD'),
      bizType: pageKey.value === 'in-transit' ? '在途差异' : '调拨台账',
      differenceQty: difference,
      docNo: '按日期汇总',
      key: rowKey('ledger', row, index),
      receivedQty: row.transferInCount,
      relation: difference === 0 ? '出入库已匹配' : '出入库数量差异',
      remark: row.exceptionReason,
      status: row.ledgerStatus,
      totalQty: row.transferOutCount,
    };
  });
}

function getTransferRelation(row: Record<string, any>) {
  if (row.sourceNo) return '来源单据';
  if (row.relatedMoveNo) return '关联出库';
  return '单据记录';
}

function mapTransferRows(
  list: any[],
  type: 'transferIn' | 'transferOut',
): ReportRow[] {
  return list.map((row, index) => ({
    amount: row.totalPrice,
    bizDate: formatDate(row.moveTime),
    bizType: type === 'transferOut' ? '调拨出库' : '调拨入库',
    docNo: row.no,
    fromDept: row.fromDeptName,
    fromWarehouse: row.fromWarehouseNames || row.fromWarehouseName,
    key: rowKey(type, row, index),
    margin: pageKey.value === 'price-difference' ? '待规则确认' : undefined,
    relation: getTransferRelation(row),
    remark: row.remark,
    sourceNo: row.sourceNo || row.relatedMoveNo || row.sourceOutNo,
    status: row.status,
    toDept: row.toDeptName,
    toWarehouse: row.toWarehouseNames || row.toWarehouseName,
    totalQty: row.totalCount,
  }));
}

function mapMoveRows(list: any[]): ReportRow[] {
  return list.map((row, index) => ({
    amount: row.totalPrice,
    bizDate: formatDate(row.moveTime),
    bizType: '移仓',
    costAmount: row.totalCostAmount,
    docNo: row.no,
    fromDept: row.deptName,
    fromWarehouse: row.fromWarehouseName,
    key: rowKey('move', row, index),
    relation: row.sourceNo ? '来源单据' : '移仓单据',
    remark: row.remark,
    sourceNo: row.sourceNo,
    status: row.status,
    toWarehouse: row.toWarehouseName,
    totalQty: row.totalCount,
  }));
}

async function loadLedger(sequence: number) {
  const params = buildLedgerParams();
  const [pageResult, totalResult] = await Promise.all([
    getStockTransferLedgerPage(params as any),
    getStockTransferLedgerTotal(params as any),
  ]);
  if (sequence !== loadSequence) return;
  state.rows = mapLedgerRows(pageResult.list ?? []);
  state.total = Number(pageResult.total ?? 0);
  ledgerTotal.value = totalResult ?? {};
  moveSummary.value = {};
}

async function loadTransferOut(sequence: number) {
  const pageResult = await getStockTransferOutPage(buildBaseParams() as any);
  if (sequence !== loadSequence) return;
  state.rows = mapTransferRows(pageResult.list ?? [], 'transferOut');
  state.total = Number(pageResult.total ?? 0);
  ledgerTotal.value = {};
  moveSummary.value = {};
}

async function loadTransferIn(sequence: number) {
  const pageResult = await getStockTransferInPage(buildBaseParams() as any);
  if (sequence !== loadSequence) return;
  state.rows = mapTransferRows(pageResult.list ?? [], 'transferIn');
  state.total = Number(pageResult.total ?? 0);
  ledgerTotal.value = {};
  moveSummary.value = {};
}

async function loadMove(sequence: number) {
  const params = buildBaseParams();
  const [pageResult, summaryResult] = await Promise.all([
    getWarehouseMovePage(params),
    getWarehouseMoveSummary(params),
  ]);
  if (sequence !== loadSequence) return;
  state.rows = mapMoveRows(pageResult.list ?? []);
  state.total = Number(pageResult.total ?? 0);
  moveSummary.value = summaryResult ?? {};
  ledgerTotal.value = {};
}

async function loadData() {
  if (!canCurrentPage.value) return;
  if (pageKey.value === 'move') {
    state.loading = false;
    state.error = '';
    state.rows = [];
    state.total = 0;
    moveSummary.value = {};
    return;
  }
  const sequence = ++loadSequence;
  state.loading = true;
  state.error = '';
  try {
    switch (effectiveDataSourceKind.value) {
      case 'ledger': {
        await loadLedger(sequence);
        break;
      }
      case 'move': {
        await loadMove(sequence);
        break;
      }
      case 'transferIn': {
        await loadTransferIn(sequence);
        break;
      }
      case 'transferOut': {
        await loadTransferOut(sequence);
        break;
      }
    }
  } catch {
    if (sequence === loadSequence) {
      state.rows = [];
      state.total = 0;
      state.error = '报表数据加载失败，请稍后重试';
    }
  } finally {
    if (sequence === loadSequence) state.loading = false;
  }
}

function handleSearch() {
  state.pageNo = 1;
  void loadData();
}

function handleReset() {
  query.dateRange = [
    dayjs().subtract(29, 'day').startOf('day'),
    dayjs().endOf('day'),
  ];
  query.keyword = '';
  query.status = undefined;
  query.historyType = 'transferOut';
  state.pageNo = 1;
  state.pageSize = DEFAULT_PAGE_SIZE;
  void loadData();
}

function handlePageChange(page: number, pageSize: number) {
  state.pageNo = page;
  state.pageSize = pageSize;
  void loadData();
}

async function handleExport() {
  const kind = effectiveDataSourceKind.value;
  const params = kind === 'ledger' ? buildLedgerParams() : buildBaseParams();
  switch (kind) {
    case 'ledger': {
      const data = await exportStockTransferLedger(params as any);
      downloadFileFromBlobPart({
        fileName: `${pageTitle.value}.xls`,
        source: data,
      });
      break;
    }
    case 'move': {
      const data = await exportWarehouseMove(params);
      downloadFileFromBlobPart({
        fileName: `${pageTitle.value}.xls`,
        source: data,
      });
      break;
    }
    case 'transferIn': {
      const data = await exportStockTransferIn(params);
      downloadFileFromBlobPart({
        fileName: `${pageTitle.value}.xls`,
        source: data,
      });
      break;
    }
    case 'transferOut': {
      const data = await exportStockTransferOut(params);
      downloadFileFromBlobPart({
        fileName: `${pageTitle.value}.xls`,
        source: data,
      });
      break;
    }
  }
}

const metricCards = computed<MetricCard[]>(() => {
  if (pageKey.value === 'ledger') {
    return [
      {
        label: '调拨出库数',
        note: '按台账筛选条件汇总',
        tone: 'blue',
        value: formatNumber(ledgerTotal.value.transferOutCount),
      },
      {
        label: '调拨入库数',
        note: '按台账筛选条件汇总',
        tone: 'green',
        value: formatNumber(ledgerTotal.value.transferInCount),
      },
      {
        label: '差异数量',
        note: '出入库配对后的数量差异',
        tone: 'orange',
        value: formatNumber(ledgerTotal.value.differenceCount),
      },
      {
        label: '异常组数',
        note: '按现有台账异常识别',
        tone: 'purple',
        value: formatNumber(ledgerTotal.value.abnormalGroupCount, 0),
      },
    ];
  }
  if (pageKey.value === 'in-transit') {
    return [
      {
        label: '在途差异数',
        note: '按现有台账差异展示',
        tone: 'blue',
        value: formatNumber(ledgerTotal.value.differenceCount),
      },
      {
        label: '待匹配组数',
        note: '出入库未完全匹配',
        tone: 'orange',
        value: formatNumber(ledgerTotal.value.abnormalGroupCount, 0),
      },
      {
        label: '在途金额',
        note: '正式结算成本确认后展示',
        tone: 'purple',
        value: '待规则确认',
      },
      {
        label: '本页记录',
        note: '当前页可查看记录',
        tone: 'green',
        value: formatNumber(state.rows.length, 0),
      },
    ];
  }
  if (pageKey.value === 'move') {
    return [
      {
        label: '移仓单数',
        note: '按筛选条件统计',
        tone: 'blue',
        value: formatNumber(moveSummary.value.totalRows ?? state.total, 0),
      },
      {
        label: '移仓数量',
        note: '按现有移仓数量汇总',
        tone: 'green',
        value: formatNumber(moveSummary.value.totalCount),
      },
      {
        label: '成本金额',
        note: '按现有单据成本展示',
        tone: 'orange',
        value: formatMoney(moveSummary.value.totalCostAmount),
      },
      {
        label: '移货金额',
        note: '按现有单据金额展示',
        tone: 'purple',
        value: formatMoney(moveSummary.value.totalPrice),
      },
    ];
  }
  if (pageKey.value === 'price-difference') {
    return [
      {
        label: '本页调拨金额',
        note: '按当前页单据金额汇总',
        tone: 'blue',
        value: formatMoney(sumRows('amount')),
      },
      {
        label: '本页调拨数量',
        note: '按当前页数量汇总',
        tone: 'green',
        value: formatNumber(sumRows('totalQty')),
      },
      {
        label: '结算成本',
        note: '成本快照确认后展示',
        tone: 'orange',
        value: '待规则确认',
      },
      {
        label: '本级差价',
        note: '调拨利润规则确认后展示',
        tone: 'purple',
        value: '不可计算',
      },
    ];
  }
  if (pageKey.value === 'chain') {
    return [
      {
        label: '链路记录',
        note: '按调拨出库来源展示',
        tone: 'blue',
        value: formatNumber(state.total, 0),
      },
      {
        label: '本页完成',
        note: '当前页已审核记录',
        tone: 'green',
        value: formatNumber(
          state.rows.filter((row) => row.status === 20).length,
          0,
        ),
      },
      {
        label: '来源单据',
        note: '当前页存在来源单号记录',
        tone: 'orange',
        value: formatNumber(state.rows.filter((row) => row.sourceNo).length, 0),
      },
      {
        label: '复杂链路',
        note: '按正式追踪服务确认后展示',
        tone: 'purple',
        value: '待规则确认',
      },
    ];
  }
  return [
    {
      label: '历史记录',
      note: '按当前类型筛选统计',
      tone: 'blue',
      value: formatNumber(state.total, 0),
    },
    {
      label: '本页数量',
      note: '按当前页数量汇总',
      tone: 'green',
      value: formatNumber(sumRows('totalQty')),
    },
    {
      label: '本页金额',
      note: '按当前页金额汇总',
      tone: 'orange',
      value: formatMoney(sumRows('amount')),
    },
    {
      label: '可追溯范围',
      note: '按已有来源关系展示',
      tone: 'purple',
      value: '按现有字段',
    },
  ];
});

const baseColumns: TableColumnsType<ReportRow> = [
  { title: '业务类型', dataIndex: 'bizType', width: 110 },
  { title: '业务日期', dataIndex: 'bizDate', width: 155 },
  { title: '单据编号', dataIndex: 'docNo', width: 170 },
  { title: '来源/关联单号', dataIndex: 'sourceNo', width: 160 },
  { title: '调出部门', dataIndex: 'fromDept', width: 130 },
  { title: '调入部门', dataIndex: 'toDept', width: 130 },
  { title: '调出仓库', dataIndex: 'fromWarehouse', width: 130 },
  { title: '调入仓库', dataIndex: 'toWarehouse', width: 130 },
  { title: '数量', dataIndex: 'totalQty', width: 110, align: 'right' },
  { title: '已入库数量', dataIndex: 'receivedQty', width: 110, align: 'right' },
  { title: '差异数量', dataIndex: 'differenceQty', width: 110, align: 'right' },
  { title: '金额', dataIndex: 'amount', width: 120, align: 'right' },
  { title: '成本金额', dataIndex: 'costAmount', width: 120, align: 'right' },
  { title: '调拨差价', dataIndex: 'margin', width: 120 },
  { title: '状态', dataIndex: 'status', width: 110 },
  { title: '关联关系', dataIndex: 'relation', width: 150 },
  { title: '备注', dataIndex: 'remark', width: 180 },
];

const tableColumns = computed<TableColumnsType<ReportRow>>(() => {
  const fieldsByPage: Record<PageKey, string[]> = {
    chain: [
      'bizType',
      'bizDate',
      'docNo',
      'sourceNo',
      'fromDept',
      'toDept',
      'fromWarehouse',
      'toWarehouse',
      'totalQty',
      'status',
      'relation',
      'remark',
    ],
    'in-transit': [
      'bizDate',
      'docNo',
      'totalQty',
      'receivedQty',
      'differenceQty',
      'status',
      'relation',
      'remark',
    ],
    ledger: [
      'bizDate',
      'docNo',
      'totalQty',
      'receivedQty',
      'differenceQty',
      'status',
      'relation',
      'remark',
    ],
    legacy: [
      'bizType',
      'bizDate',
      'docNo',
      'sourceNo',
      'fromDept',
      'toDept',
      'fromWarehouse',
      'toWarehouse',
      'totalQty',
      'amount',
      'status',
      'relation',
      'remark',
    ],
    move: [
      'bizDate',
      'docNo',
      'fromDept',
      'fromWarehouse',
      'toWarehouse',
      'totalQty',
      'costAmount',
      'amount',
      'status',
      'sourceNo',
      'remark',
    ],
    'price-difference': [
      'bizDate',
      'docNo',
      'sourceNo',
      'fromDept',
      'toDept',
      'fromWarehouse',
      'toWarehouse',
      'totalQty',
      'amount',
      'costAmount',
      'margin',
      'status',
      'remark',
    ],
  };
  const fields = new Set(fieldsByPage[pageKey.value]);
  return baseColumns.filter((column) => fields.has(getColumnDataIndex(column)));
});

const tableScrollX = computed(() =>
  Math.max(tableColumns.value.length * 130, 980),
);
const rankRows = computed(() => state.rows.slice(0, 5));

function getColumnDataIndex(column: unknown) {
  return String((column as { dataIndex?: string })?.dataIndex ?? '');
}

watch(
  () => [pageKey.value, query.historyType],
  () => {
    state.pageNo = 1;
    state.pageSize = DEFAULT_PAGE_SIZE;
    void loadData();
  },
);

onMounted(() => void loadData());
</script>

<template>
  <BusinessReportShell
    :title="`经营报表 · 调拨移仓及在途 · ${pageTitle}`"
    :denied="!canCurrentPage"
    body-scrollable
  >
    <section class="transfer-report-page">
      <WarehouseMoveDetailReport v-if="pageKey === 'move'" />
      <template v-else>
        <Card class="transfer-report-page__query-card" size="small">
          <Form class="transfer-report-page__query" layout="inline">
            <FormItem label="业务时间">
              <RangePicker
                v-model:value="query.dateRange"
                class="transfer-report-page__date"
                format="YYYY-MM-DD HH:mm:ss"
                show-time
              />
            </FormItem>
            <FormItem v-if="pageKey === 'legacy'" label="历史类型">
              <Select
                v-model:value="query.historyType"
                class="transfer-report-page__select"
                :options="historyTypeOptions"
              />
            </FormItem>
            <FormItem label="单据状态">
              <Select
                v-model:value="query.status"
                allow-clear
                class="transfer-report-page__select"
                :options="statusOptions"
                placeholder="请选择状态"
              />
            </FormItem>
            <FormItem label="关键词">
              <Input
                v-model:value="query.keyword"
                allow-clear
                class="transfer-report-page__keyword"
                placeholder="单号 / 来源单 / 商品 / 部门 / 仓库"
                @press-enter="handleSearch"
              />
            </FormItem>
            <FormItem>
              <Space>
                <Button type="primary" @click="handleSearch">查询</Button>
                <Button @click="handleReset">重置</Button>
                <Button :disabled="!canCurrentExport" @click="handleExport">
                  导出
                </Button>
              </Space>
            </FormItem>
          </Form>
        </Card>

        <Card class="transfer-report-page__intro" size="small">
          <strong>{{ pageTitle }}</strong>
          <p>{{ pageDescription }}</p>
        </Card>

        <div class="transfer-report-page__metrics">
          <Card
            v-for="metric in metricCards"
            :key="metric.label"
            class="transfer-report-page__metric"
            :class="
              metric.tone && `transfer-report-page__metric--${metric.tone}`
            "
            size="small"
          >
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
            <small>{{ metric.note }}</small>
          </Card>
        </div>

        <div class="transfer-report-page__chart-grid">
          <Card
            class="transfer-report-page__chart"
            size="small"
            title="趋势概览"
          >
            <div class="transfer-report-page__bars">
              <i
                v-for="(row, index) in rankRows"
                :key="`${row.key}-bar`"
                :style="{
                  height: `${Math.max(18, Math.min(92, 28 + index * 11))}%`,
                }"
              ></i>
              <Empty v-if="rankRows.length === 0" description="暂无数据" />
            </div>
          </Card>
          <Card
            class="transfer-report-page__chart"
            size="small"
            title="当前页排行"
          >
            <div class="transfer-report-page__rank">
              <p v-for="row in rankRows" :key="`${row.key}-rank`">
                <span>{{
                  row.docNo || row.bizDate || row.bizType || '—'
                }}</span>
                <b>{{
                  formatNumber(row.totalQty || row.differenceQty || 0)
                }}</b>
              </p>
              <Empty v-if="rankRows.length === 0" description="暂无数据" />
            </div>
          </Card>
        </div>

        <Card
          class="transfer-report-page__table-card"
          size="small"
          :title="pageTitle"
        >
          <div v-if="state.error" class="transfer-report-page__error">
            {{ state.error }}
          </div>
          <Table
            :columns="tableColumns"
            :data-source="state.rows"
            :loading="state.loading"
            :pagination="false"
            row-key="key"
            size="small"
            :scroll="{ x: tableScrollX, y: 360 }"
          >
            <template #bodyCell="{ column, record, text }">
              <template v-if="getColumnDataIndex(column) === 'status'">
                <Tag :color="getStatusMeta(record.status).color">
                  {{ getStatusMeta(record.status).label }}
                </Tag>
              </template>
              <template
                v-else-if="
                  ['amount', 'costAmount'].includes(getColumnDataIndex(column))
                "
              >
                {{ formatMoney(text) }}
              </template>
              <template
                v-else-if="
                  ['differenceQty', 'receivedQty', 'totalQty'].includes(
                    getColumnDataIndex(column),
                  )
                "
              >
                {{ formatNumber(text) }}
              </template>
              <template v-else>
                {{ text || '—' }}
              </template>
            </template>
          </Table>
          <div class="transfer-report-page__footer">
            <span>共 {{ state.total }} 条记录</span>
            <span>本页 {{ state.rows.length }} 条</span>
            <span>本页数量：{{ formatNumber(sumRows('totalQty')) }}</span>
            <span>本页金额：{{ formatMoney(sumRows('amount')) }}</span>
            <Pagination
              v-model:current="state.pageNo"
              v-model:page-size="state.pageSize"
              :page-size-options="['10', '20', '50']"
              show-size-changer
              :total="state.total"
              @change="handlePageChange"
            />
          </div>
        </Card>
      </template>
    </section>
  </BusinessReportShell>
</template>

<style scoped>
.transfer-report-page {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 12px;
}

.transfer-report-page__query-card,
.transfer-report-page__intro,
.transfer-report-page__metric,
.transfer-report-page__chart,
.transfer-report-page__table-card {
  border-radius: 10px;
}

.transfer-report-page__query {
  gap: 8px 0;
}

.transfer-report-page__date {
  width: 360px;
}

.transfer-report-page__keyword {
  width: 260px;
}

.transfer-report-page__select {
  width: 140px;
}

.transfer-report-page__intro strong {
  color: #173461;
  font-size: 16px;
}

.transfer-report-page__intro p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
}

.transfer-report-page__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.transfer-report-page__metric span,
.transfer-report-page__metric small {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.transfer-report-page__metric strong {
  display: block;
  margin: 8px 0 4px;
  color: #1d4ed8;
  font-size: 22px;
  line-height: 1.2;
}

.transfer-report-page__metric--green strong {
  color: #0f766e;
}

.transfer-report-page__metric--orange strong {
  color: #d97706;
}

.transfer-report-page__metric--purple strong {
  color: #7c3aed;
}

.transfer-report-page__chart-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.8fr);
  gap: 12px;
}

.transfer-report-page__bars {
  display: flex;
  align-items: end;
  min-height: 130px;
  gap: 10px;
  padding: 12px 12px 0;
  background: linear-gradient(180deg, #f8fafc, #fff);
  border-radius: 8px;
}

.transfer-report-page__bars i {
  flex: 1 1 0;
  min-height: 18px;
  max-height: 130px;
  background: linear-gradient(180deg, #60a5fa, #2563eb);
  border-radius: 8px 8px 0 0;
}

.transfer-report-page__rank {
  display: grid;
  min-height: 130px;
  align-content: start;
  gap: 8px;
}

.transfer-report-page__rank p {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0;
  padding: 8px 10px;
  color: #475569;
  background: #f8fbff;
  border-radius: 8px;
}

.transfer-report-page__rank b {
  color: #2563eb;
}

.transfer-report-page__error {
  margin-bottom: 8px;
  padding: 8px 10px;
  color: #b42318;
  background: #fff1f0;
  border: 1px solid #ffccc7;
  border-radius: 8px;
  font-size: 13px;
}

.transfer-report-page__footer {
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

.transfer-report-page__footer span {
  white-space: nowrap;
}

:deep(.transfer-report-page__table-card .ant-card-body) {
  padding-bottom: 10px;
}

:deep(.transfer-report-page__table-card .ant-table),
:deep(.transfer-report-page__table-card .ant-table-cell),
:deep(.transfer-report-page__table-card .ant-pagination),
:deep(.transfer-report-page__query-card .ant-form-item-label > label),
:deep(.transfer-report-page__query-card .ant-input),
:deep(.transfer-report-page__query-card .ant-select),
:deep(.transfer-report-page__query-card .ant-picker),
:deep(.transfer-report-page__query-card .ant-btn) {
  font-size: 12px;
}

:deep(.transfer-report-page__table-card .ant-table-thead > tr > th) {
  white-space: nowrap;
}

@media (max-width: 1280px) {
  .transfer-report-page__metrics,
  .transfer-report-page__chart-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .transfer-report-page__metrics,
  .transfer-report-page__chart-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .transfer-report-page__date,
  .transfer-report-page__keyword,
  .transfer-report-page__select {
    width: 100%;
  }
}
</style>
