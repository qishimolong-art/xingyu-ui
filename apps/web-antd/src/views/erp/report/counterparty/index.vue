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
  message,
  Pagination,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  exportPayableAccount,
  getPayableAccountPage,
} from '#/api/erp/finance/payable/account';
import {
  exportPayableReport,
  getPayableReportPage,
} from '#/api/erp/finance/payable/report';
import {
  exportFinancePayment,
  getFinancePaymentPage,
} from '#/api/erp/finance/payment';
import {
  exportFinanceReceipt,
  getFinanceReceiptPage,
} from '#/api/erp/finance/receipt';
import {
  exportReceivableAccount,
  getReceivableAccountPage,
} from '#/api/erp/finance/receivable/account';
import {
  exportReceivableReport,
  getReceivableReportPage,
} from '#/api/erp/finance/receivable/report';
import BusinessReportShell from '#/views/erp/report/components/business-report-shell.vue';

defineOptions({ name: 'ErpBusinessReportCounterparty' });

const RangePicker = DatePicker.RangePicker;
const DEFAULT_PAGE_SIZE = 10;

type PageKey =
  | 'aging-payable'
  | 'aging-receivable'
  | 'balance-summary'
  | 'customer-receivable'
  | 'history'
  | 'payment-writeoff-trace'
  | 'reconciliation-difference'
  | 'supplier-payable'
  | 'writeoff-detail';

type DataKind =
  | 'difference'
  | 'payableAccount'
  | 'payableReport'
  | 'payment'
  | 'receipt'
  | 'receivableAccount'
  | 'receivableReport'
  | 'settlementBoth';

type ObjectType = 'both' | 'customer' | 'supplier';
type ReportPageParams = Record<string, any> & {
  pageNo: number;
  pageSize: number;
};

interface MetricCard {
  label: string;
  note: string;
  tone?: 'green' | 'orange' | 'purple';
  value: string;
}

interface ReportRow {
  accountName?: string;
  actualAmount?: number | string;
  amount?: number | string;
  balance?: number | string;
  bizDate?: string;
  bizNo?: string;
  contact?: string;
  dept?: string;
  direction?: string;
  dueDate?: string;
  key: string;
  objectName?: string;
  operator?: string;
  overdueDays?: string;
  preAmount?: number | string;
  relatedNo?: string;
  status?: string;
  totalAmount?: number | string;
  type?: string;
  writeOffAmount?: number | string;
}

interface TableState {
  error: string;
  loading: boolean;
  pageNo: number;
  pageSize: number;
  rows: ReportRow[];
  total: number;
}

const route = useRoute();
const { hasAccessByCodes } = useAccess();

const currentPath = computed(() =>
  typeof route?.path === 'string' ? route.path : '',
);
const canCurrentMenu = computed(() => {
  const matched = Array.isArray(route?.matched) ? route.matched : [];
  return (
    matched.length > 0 &&
    (currentPath.value === '/erp/business-report/counterparty' ||
      currentPath.value.startsWith('/erp/business-report/counterparty/'))
  );
});
const canQueryReceivable = computed(() =>
  hasAccessByCodes(['erp:receivable-account:query']),
);
const canQueryReceivableReport = computed(() =>
  hasAccessByCodes(['erp:receivable-report:query']),
);
const canQueryPayable = computed(() =>
  hasAccessByCodes(['erp:payable-account:query']),
);
const canQueryPayableReport = computed(() =>
  hasAccessByCodes(['erp:payable-report:query']),
);
const canQueryReceipt = computed(() =>
  hasAccessByCodes(['erp:finance-receipt:query']),
);
const canQueryPayment = computed(() =>
  hasAccessByCodes(['erp:finance-payment:query']),
);
const canQueryCounterparty = computed(
  () =>
    canCurrentMenu.value ||
    canQueryReceivable.value ||
    canQueryReceivableReport.value ||
    canQueryPayable.value ||
    canQueryPayableReport.value ||
    canQueryReceipt.value ||
    canQueryPayment.value,
);
const canExportCounterparty = computed(
  () =>
    canCurrentMenu.value ||
    hasAccessByCodes([
      'erp:finance-payment:export',
      'erp:finance-receipt:export',
      'erp:payable-account:export',
      'erp:payable-report:export',
      'erp:receivable-account:export',
      'erp:receivable-report:export',
    ]),
);

const pageTitles: Record<PageKey, string> = {
  'aging-payable': '应付账龄分析',
  'aging-receivable': '应收账龄分析',
  'balance-summary': '往来余额汇总',
  'customer-receivable': '客户应收对账',
  history: '历史往来口径',
  'payment-writeoff-trace': '收付款核销追踪',
  'reconciliation-difference': '对账差异记录',
  'supplier-payable': '供应商应付对账',
  'writeoff-detail': '核销明细查询',
};

function normalizePageKey(value: unknown): PageKey {
  if (typeof value !== 'string') return 'customer-receivable';
  const parts = value.split('/').filter(Boolean);
  const key = parts[parts.length - 1] as PageKey | undefined;
  return key && key in pageTitles ? key : 'customer-receivable';
}

const pageKey = computed(() => normalizePageKey(currentPath.value));
const pageTitle = computed(() => pageTitles[pageKey.value]);

const query = reactive<{
  dateRange?: [Dayjs, Dayjs];
  keyword: string;
  objectType: ObjectType;
  status?: string;
}>({
  dateRange: [dayjs().subtract(29, 'day').startOf('day'), dayjs().endOf('day')],
  keyword: '',
  objectType: 'both',
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
const exportLoading = ref(false);
let loadSequence = 0;

const objectTypeOptions = computed(() => {
  if (
    pageKey.value === 'customer-receivable' ||
    pageKey.value === 'aging-receivable'
  ) {
    return [{ label: '客户', value: 'customer' }];
  }
  if (
    pageKey.value === 'supplier-payable' ||
    pageKey.value === 'aging-payable'
  ) {
    return [{ label: '供应商', value: 'supplier' }];
  }
  return [
    { label: '客户/供应商', value: 'both' },
    { label: '客户', value: 'customer' },
    { label: '供应商', value: 'supplier' },
  ];
});
const statusOptions = [
  { label: '未核销', value: 'open' },
  { label: '部分核销', value: 'partial' },
  { label: '已核销', value: 'closed' },
  { label: '存在差异', value: 'different' },
];

const pageDataKind = computed<DataKind>(() => {
  if (
    pageKey.value === 'customer-receivable' ||
    pageKey.value === 'aging-receivable'
  ) {
    return 'receivableAccount';
  }
  if (
    pageKey.value === 'supplier-payable' ||
    pageKey.value === 'aging-payable'
  ) {
    return 'payableAccount';
  }
  if (
    pageKey.value === 'writeoff-detail' ||
    pageKey.value === 'payment-writeoff-trace'
  ) {
    if (query.objectType === 'customer') return 'receipt';
    if (query.objectType === 'supplier') return 'payment';
    return 'settlementBoth';
  }
  if (pageKey.value === 'history') {
    if (query.objectType === 'customer') return 'receivableReport';
    if (query.objectType === 'supplier') return 'payableReport';
    return 'settlementBoth';
  }
  if (pageKey.value === 'reconciliation-difference') return 'difference';
  if (query.objectType === 'customer') return 'receivableAccount';
  if (query.objectType === 'supplier') return 'payableAccount';
  return 'settlementBoth';
});

const canCurrentPage = computed(() => {
  if (canCurrentMenu.value) return true;
  if (pageDataKind.value === 'receivableAccount')
    return canQueryReceivable.value;
  if (pageDataKind.value === 'receivableReport')
    return canQueryReceivableReport.value;
  if (pageDataKind.value === 'payableAccount') return canQueryPayable.value;
  if (pageDataKind.value === 'payableReport')
    return canQueryPayableReport.value;
  if (pageDataKind.value === 'receipt') return canQueryReceipt.value;
  if (pageDataKind.value === 'payment') return canQueryPayment.value;
  if (pageDataKind.value === 'settlementBoth') {
    return (
      canQueryReceivable.value ||
      canQueryPayable.value ||
      canQueryReceivableReport.value ||
      canQueryPayableReport.value ||
      canQueryReceipt.value ||
      canQueryPayment.value
    );
  }
  return canQueryCounterparty.value;
});

function normalizeObjectType() {
  if (
    pageKey.value === 'customer-receivable' ||
    pageKey.value === 'aging-receivable'
  ) {
    query.objectType = 'customer';
  } else if (
    pageKey.value === 'supplier-payable' ||
    pageKey.value === 'aging-payable'
  ) {
    query.objectType = 'supplier';
  } else if (
    !objectTypeOptions.value.some((item) => item.value === query.objectType)
  ) {
    query.objectType = 'both';
  }
}

function formatDate(value: unknown) {
  if (!value) return '—';
  return formatDateTime(value as string) || String(value);
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

function formatNumber(value: unknown, maximumFractionDigits = 0) {
  const next = Number(value ?? 0);
  if (!Number.isFinite(next)) return '—';
  return next.toLocaleString('zh-CN', { maximumFractionDigits });
}

function getStatusLabel(value: unknown) {
  if (value === 'open') return '未核销';
  if (value === 'partial') return '部分核销';
  if (value === 'closed') return '已核销';
  if (value === 'different') return '存在差异';
  if (value === 0 || value === '0') return '草稿';
  if (value === 10 || value === '10') return '待审核';
  if (value === 20 || value === '20') return '已审核';
  if (value) return String(value);
  return '—';
}

function getStatusColor(value: unknown) {
  const label = getStatusLabel(value);
  if (label === '已审核' || label === '已核销') return 'success';
  if (label === '部分核销' || label === '待审核') return 'processing';
  if (label === '存在差异') return 'warning';
  if (label === '未核销') return 'error';
  return 'default';
}

function getWriteOffStatusLabel(value: unknown) {
  if (value === 0 || value === '0') return '未核销';
  if (value === 1 || value === '1') return '部分核销';
  if (value === 2 || value === '2') return '已核销';
  if (value === 3 || value === '3') return '存在差异';
  return getStatusLabel(value);
}

function getBalanceStatus(balance: unknown) {
  const value = Number(balance ?? 0);
  if (!Number.isFinite(value)) return '待规则确认';
  return Math.abs(value) > 0 ? '未核销' : '已核销';
}

function sumRows(field: keyof ReportRow) {
  let total = 0;
  for (const row of state.rows) {
    const value = Number(row[field] ?? 0);
    if (Number.isFinite(value)) total += value;
  }
  return total;
}

function buildBaseParams(): ReportPageParams {
  const params: ReportPageParams = {
    pageNo: state.pageNo,
    pageSize: state.pageSize,
  };
  const keyword = query.keyword.trim();
  if (keyword) {
    params.keyword = keyword;
    params.no = keyword;
    params.name = keyword;
  }
  if (query.dateRange) {
    const range = [
      query.dateRange[0].format('YYYY-MM-DD HH:mm:ss'),
      query.dateRange[1].format('YYYY-MM-DD HH:mm:ss'),
    ];
    params.bizTime = range;
    params.receiptTime = range;
    params.paymentTime = range;
  }
  return params;
}

function buildFinanceParams(): ReportPageParams {
  const params = buildBaseParams();
  delete params.bizTime;
  if (query.status) {
    const statusMap: Record<string, number> = {
      closed: 2,
      different: 3,
      open: 0,
      partial: 1,
    };
    params.writeOffStatus = statusMap[query.status];
  }
  return params;
}

function buildAccountParams(): ReportPageParams {
  const params = buildBaseParams();
  params.showZeroBalance = true;
  delete params.receiptTime;
  delete params.paymentTime;
  return params;
}

function rowKey(prefix: string, row: Record<string, any>, index: number) {
  return String(
    row.id ??
      row.rowKey ??
      row.accountKey ??
      row.customerId ??
      row.supplierId ??
      row.no ??
      `${prefix}-${index}`,
  );
}

function mapReceivableRows(list: any[]): ReportRow[] {
  return list.map((row, index) => ({
    amount:
      row.saleOutAmount ?? row.receivableAmount ?? row.otherReceivableAmount,
    balance: row.receivableBalance ?? row.balance ?? row.unreceivedAmount,
    bizDate: formatDate(row.lastBizTime),
    bizNo: row.customerId ? `客户${row.customerId}` : undefined,
    contact: row.mobile || row.contact,
    dept: row.deptName,
    direction: '应收',
    key: `receivable-${rowKey('receivable', row, index)}`,
    objectName: row.customerName,
    operator: row.saleUserName ?? row.handlerName,
    preAmount: row.preAdvanceAmount,
    status: getBalanceStatus(
      row.receivableBalance ?? row.balance ?? row.unreceivedAmount,
    ),
    totalAmount: row.saleOutAmount,
    type: '客户应收',
    writeOffAmount: row.writeOffAmount ?? row.receiptAmount,
  }));
}

function mapPayableRows(list: any[]): ReportRow[] {
  return list.map((row, index) => ({
    amount: row.purchaseInAmount ?? row.otherPayableAmount,
    balance: row.balance,
    bizDate: formatDate(row.lastBizTime),
    bizNo: row.supplierId ? `供应商${row.supplierId}` : undefined,
    contact: row.mobile || row.contact,
    dept: row.deptName,
    direction: '应付',
    key: `payable-${rowKey('payable', row, index)}`,
    objectName: row.supplierName,
    operator: row.handlerName,
    preAmount: row.unclearedPrepayment,
    status: getBalanceStatus(row.balance),
    totalAmount: row.purchaseInAmount,
    type: '供应商应付',
    writeOffAmount: row.writeOffAmount ?? row.paymentAmount,
  }));
}

function mapReceivableReportRows(list: any[]): ReportRow[] {
  return list.map((row, index) => ({
    amount: row.otherReceivableAmount,
    balance: row.balance,
    bizDate: formatDate(row.lastBizTime),
    bizNo: row.customerId ? `客户${row.customerId}` : undefined,
    contact: row.mobile || row.contact,
    dept: row.deptName,
    direction: '应收',
    key: `receivable-report-${rowKey('receivable-report', row, index)}`,
    objectName: row.customerName,
    operator: row.handlerName,
    status: getBalanceStatus(row.balance),
    type: '应收报表',
    writeOffAmount: row.settledAmount,
  }));
}

function mapPayableReportRows(list: any[]): ReportRow[] {
  return list.map((row, index) => ({
    amount: row.otherPayableAmount,
    balance: row.balance,
    bizDate: formatDate(row.lastBizTime),
    bizNo: row.supplierId ? `供应商${row.supplierId}` : undefined,
    contact: row.mobile || row.contact,
    dept: row.deptName,
    direction: '应付',
    key: `payable-report-${rowKey('payable-report', row, index)}`,
    objectName: row.supplierName,
    operator: row.handlerName,
    status: getBalanceStatus(row.balance),
    type: '应付报表',
    writeOffAmount: row.settledAmount,
  }));
}

function mapReceiptRows(list: any[]): ReportRow[] {
  return list.map((row, index) => ({
    accountName: row.accountName,
    actualAmount: row.receiptPrice,
    amount: row.totalPrice,
    balance: row.unallocatedPrice,
    bizDate: formatDate(row.receiptTime),
    bizNo: row.bizNo || row.no,
    dept: row.deptName,
    direction: '收款核销',
    key: `receipt-${rowKey('receipt', row, index)}`,
    objectName: row.customerName,
    operator: row.financeUserName,
    relatedNo: row.no,
    status: getWriteOffStatusLabel(row.writeOffStatus),
    type: '收款单',
    writeOffAmount: row.allocatedPrice,
  }));
}

function mapPaymentRows(list: any[]): ReportRow[] {
  return list.map((row, index) => ({
    accountName: row.accountName,
    actualAmount: row.paymentPrice,
    amount: row.totalPrice,
    balance: row.unallocatedPrice,
    bizDate: formatDate(row.paymentTime),
    bizNo: row.bizNo || row.no,
    dept: row.deptName,
    direction: '付款核销',
    key: `payment-${rowKey('payment', row, index)}`,
    objectName: row.supplierName,
    operator: row.financeUserName,
    relatedNo: row.no,
    status: getWriteOffStatusLabel(row.writeOffStatus),
    type: '付款单',
    writeOffAmount: row.allocatedPrice,
  }));
}

function mapAgingRows(rows: ReportRow[]) {
  return rows.map((row) => ({
    ...row,
    dueDate: '待规则确认',
    overdueDays: '待规则确认',
    status: row.status || '未核销',
  }));
}

async function loadReceivableAccount(sequence: number) {
  const result = await getReceivableAccountPage(buildAccountParams());
  if (sequence !== loadSequence) return;
  const rows = mapReceivableRows(result.list ?? []);
  state.rows = pageKey.value === 'aging-receivable' ? mapAgingRows(rows) : rows;
  state.total = Number(result.total ?? 0);
}

async function loadPayableAccount(sequence: number) {
  const result = await getPayableAccountPage(buildAccountParams());
  if (sequence !== loadSequence) return;
  const rows = mapPayableRows(result.list ?? []);
  state.rows = pageKey.value === 'aging-payable' ? mapAgingRows(rows) : rows;
  state.total = Number(result.total ?? 0);
}

async function loadReceivableReport(sequence: number) {
  const result = await getReceivableReportPage(buildAccountParams());
  if (sequence !== loadSequence) return;
  state.rows = mapReceivableReportRows(result.list ?? []);
  state.total = Number(result.total ?? 0);
}

async function loadPayableReport(sequence: number) {
  const result = await getPayableReportPage(buildAccountParams());
  if (sequence !== loadSequence) return;
  state.rows = mapPayableReportRows(result.list ?? []);
  state.total = Number(result.total ?? 0);
}

async function loadReceipt(sequence: number) {
  const result = await getFinanceReceiptPage(buildFinanceParams());
  if (sequence !== loadSequence) return;
  state.rows = mapReceiptRows(result.list ?? []);
  state.total = Number(result.total ?? 0);
}

async function loadPayment(sequence: number) {
  const result = await getFinancePaymentPage(buildFinanceParams());
  if (sequence !== loadSequence) return;
  state.rows = mapPaymentRows(result.list ?? []);
  state.total = Number(result.total ?? 0);
}

async function loadBoth(sequence: number) {
  const accountPages = pageKey.value === 'history';
  const balancePage = pageKey.value === 'balance-summary';
  const params = accountPages ? buildAccountParams() : buildFinanceParams();
  let customerResult: any;
  let supplierResult: any;
  if (accountPages) {
    [customerResult, supplierResult] = await Promise.all([
      getReceivableReportPage(params),
      getPayableReportPage(params),
    ]);
  } else if (balancePage) {
    [customerResult, supplierResult] = await Promise.all([
      getReceivableAccountPage(buildAccountParams()),
      getPayableAccountPage(buildAccountParams()),
    ]);
  } else {
    [customerResult, supplierResult] = await Promise.all([
      getFinanceReceiptPage(params),
      getFinancePaymentPage(params),
    ]);
  }
  if (sequence !== loadSequence) return;
  let customerRows: ReportRow[];
  let supplierRows: ReportRow[];
  if (accountPages) {
    customerRows = mapReceivableReportRows(customerResult.list ?? []);
    supplierRows = mapPayableReportRows(supplierResult.list ?? []);
  } else if (balancePage) {
    customerRows = mapReceivableRows(customerResult.list ?? []);
    supplierRows = mapPayableRows(supplierResult.list ?? []);
  } else {
    customerRows = mapReceiptRows(customerResult.list ?? []);
    supplierRows = mapPaymentRows(supplierResult.list ?? []);
  }
  state.rows = [...customerRows, ...supplierRows].slice(0, state.pageSize);
  state.total =
    Number(customerResult.total ?? 0) + Number(supplierResult.total ?? 0);
}

async function loadDifference(sequence: number) {
  if (sequence !== loadSequence) return;
  state.rows = [];
  state.total = 0;
}

async function loadData() {
  if (!canCurrentPage.value) return;
  const sequence = ++loadSequence;
  state.loading = true;
  state.error = '';
  try {
    switch (pageDataKind.value) {
      case 'difference': {
        await loadDifference(sequence);
        break;
      }
      case 'payableAccount': {
        await loadPayableAccount(sequence);
        break;
      }
      case 'payableReport': {
        await loadPayableReport(sequence);
        break;
      }
      case 'payment': {
        await loadPayment(sequence);
        break;
      }
      case 'receipt': {
        await loadReceipt(sequence);
        break;
      }
      case 'receivableAccount': {
        await loadReceivableAccount(sequence);
        break;
      }
      case 'receivableReport': {
        await loadReceivableReport(sequence);
        break;
      }
      case 'settlementBoth': {
        await loadBoth(sequence);
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
  query.objectType = 'both';
  normalizeObjectType();
  state.pageNo = 1;
  state.pageSize = DEFAULT_PAGE_SIZE;
  void loadData();
}

function handlePageChange(pageNo: number, pageSize: number) {
  state.pageNo = pageNo;
  state.pageSize = pageSize;
  void loadData();
}

async function downloadWithName(source: Promise<any>, fileName: string) {
  const data = await source;
  downloadFileFromBlobPart({ fileName, source: data });
}

async function handleExport() {
  if (!canExportCounterparty.value) return;
  exportLoading.value = true;
  try {
    if (pageDataKind.value === 'difference') {
      message.info('当前筛选条件下暂无可导出的对账差异记录');
      return;
    }
    if (pageDataKind.value === 'receivableAccount') {
      await downloadWithName(
        exportReceivableAccount(buildAccountParams()),
        `${pageTitle.value}.xls`,
      );
      return;
    }
    if (pageDataKind.value === 'payableAccount') {
      await downloadWithName(
        exportPayableAccount(buildAccountParams()),
        `${pageTitle.value}.xls`,
      );
      return;
    }
    if (pageDataKind.value === 'receivableReport') {
      await downloadWithName(
        exportReceivableReport(buildAccountParams()),
        `${pageTitle.value}.xls`,
      );
      return;
    }
    if (pageDataKind.value === 'payableReport') {
      await downloadWithName(
        exportPayableReport(buildAccountParams()),
        `${pageTitle.value}.xls`,
      );
      return;
    }
    if (pageDataKind.value === 'receipt') {
      await downloadWithName(
        exportFinanceReceipt(buildFinanceParams()),
        `${pageTitle.value}-收款.xls`,
      );
      return;
    }
    if (pageDataKind.value === 'payment') {
      await downloadWithName(
        exportFinancePayment(buildFinanceParams()),
        `${pageTitle.value}-付款.xls`,
      );
      return;
    }
    if (pageKey.value === 'balance-summary') {
      await Promise.all([
        downloadWithName(
          exportReceivableAccount(buildAccountParams()),
          `${pageTitle.value}-客户应收.xls`,
        ),
        downloadWithName(
          exportPayableAccount(buildAccountParams()),
          `${pageTitle.value}-供应商应付.xls`,
        ),
      ]);
      return;
    }
    if (pageKey.value === 'history') {
      await Promise.all([
        downloadWithName(
          exportReceivableReport(buildAccountParams()),
          `${pageTitle.value}-应收.xls`,
        ),
        downloadWithName(
          exportPayableReport(buildAccountParams()),
          `${pageTitle.value}-应付.xls`,
        ),
      ]);
      return;
    }
    await Promise.all([
      downloadWithName(
        exportFinanceReceipt(buildFinanceParams()),
        `${pageTitle.value}-收款.xls`,
      ),
      downloadWithName(
        exportFinancePayment(buildFinanceParams()),
        `${pageTitle.value}-付款.xls`,
      ),
    ]);
  } finally {
    exportLoading.value = false;
  }
}

const metricCards = computed<MetricCard[]>(() => {
  if (
    pageKey.value === 'aging-receivable' ||
    pageKey.value === 'aging-payable'
  ) {
    return [
      {
        label: '未核销余额',
        note: '按当前页余额汇总',
        value: formatMoney(sumRows('balance')),
      },
      {
        label: '未到期',
        note: '到期规则配置后统计',
        tone: 'green',
        value: '待规则确认',
      },
      {
        label: '逾期 30 天内',
        note: '按约定日期计算',
        tone: 'orange',
        value: '待规则确认',
      },
      {
        label: '逾期 90 天以上',
        note: '按约定日期计算',
        tone: 'purple',
        value: '待规则确认',
      },
    ];
  }
  if (pageKey.value === 'reconciliation-difference') {
    return [
      { label: '待确认', note: '对账单确认后统计', value: '0' },
      {
        label: '有差异',
        note: '差异记录生成后统计',
        tone: 'orange',
        value: '0',
      },
      { label: '处理中', note: '处理进度跟踪', tone: 'purple', value: '0' },
      { label: '已完成', note: '保留处理记录', tone: 'green', value: '0' },
    ];
  }
  return [
    {
      label: '对象数',
      note: '当前页往来对象数',
      value: formatNumber(
        new Set(state.rows.map((row) => row.objectName).filter(Boolean)).size,
      ),
    },
    {
      label: '本页发生',
      note: '按当前页发生金额汇总',
      tone: 'green',
      value: formatMoney(sumRows('amount')),
    },
    {
      label: '本页核销',
      note: '按当前页核销金额汇总',
      tone: 'purple',
      value: formatMoney(sumRows('writeOffAmount')),
    },
    {
      label: '本页余额',
      note: '按当前页未核销余额汇总',
      tone: 'orange',
      value: formatMoney(sumRows('balance')),
    },
  ];
});

const baseColumns: TableColumnsType<ReportRow> = [
  { title: '往来方向', dataIndex: 'direction', width: 110, fixed: 'left' },
  { title: '往来对象', dataIndex: 'objectName', width: 180, fixed: 'left' },
  { title: '联系方式', dataIndex: 'contact', width: 130 },
  { title: '业务类型', dataIndex: 'type', width: 120 },
  { title: '单据编号', dataIndex: 'bizNo', width: 180 },
  { title: '收付款单号', dataIndex: 'relatedNo', width: 180 },
  { title: '账户', dataIndex: 'accountName', width: 130 },
  { title: '业务时间', dataIndex: 'bizDate', width: 155 },
  { title: '约定日期', dataIndex: 'dueDate', width: 130 },
  { title: '逾期天数', dataIndex: 'overdueDays', width: 110, align: 'right' },
  { title: '业务部门', dataIndex: 'dept', width: 140 },
  { title: '经办人', dataIndex: 'operator', width: 110 },
  { title: '发生金额', dataIndex: 'amount', width: 130, align: 'right' },
  { title: '实收/实付', dataIndex: 'actualAmount', width: 130, align: 'right' },
  {
    title: '核销金额',
    dataIndex: 'writeOffAmount',
    width: 130,
    align: 'right',
  },
  { title: '预收/预付', dataIndex: 'preAmount', width: 130, align: 'right' },
  { title: '未核销余额', dataIndex: 'balance', width: 140, align: 'right' },
  { title: '状态', dataIndex: 'status', width: 110, fixed: 'right' },
];

function getColumnDataIndex(column: unknown) {
  return String((column as { dataIndex?: string })?.dataIndex ?? '');
}

const tableColumns = computed<TableColumnsType<ReportRow>>(() => {
  const fieldsByPage: Record<PageKey, string[]> = {
    'aging-payable': [
      'objectName',
      'dept',
      'bizDate',
      'dueDate',
      'overdueDays',
      'balance',
      'status',
    ],
    'aging-receivable': [
      'objectName',
      'dept',
      'bizDate',
      'dueDate',
      'overdueDays',
      'balance',
      'status',
    ],
    'balance-summary': [
      'direction',
      'objectName',
      'contact',
      'dept',
      'operator',
      'amount',
      'writeOffAmount',
      'preAmount',
      'balance',
      'bizDate',
      'status',
    ],
    'customer-receivable': [
      'objectName',
      'contact',
      'dept',
      'operator',
      'amount',
      'writeOffAmount',
      'preAmount',
      'balance',
      'bizDate',
      'status',
    ],
    history: [
      'direction',
      'objectName',
      'contact',
      'type',
      'bizNo',
      'bizDate',
      'dept',
      'operator',
      'amount',
      'writeOffAmount',
      'balance',
      'status',
    ],
    'payment-writeoff-trace': [
      'direction',
      'objectName',
      'relatedNo',
      'bizNo',
      'accountName',
      'bizDate',
      'actualAmount',
      'writeOffAmount',
      'balance',
      'operator',
      'status',
    ],
    'reconciliation-difference': [
      'direction',
      'objectName',
      'bizNo',
      'bizDate',
      'amount',
      'dept',
      'operator',
      'status',
    ],
    'supplier-payable': [
      'objectName',
      'contact',
      'dept',
      'operator',
      'amount',
      'writeOffAmount',
      'preAmount',
      'balance',
      'bizDate',
      'status',
    ],
    'writeoff-detail': [
      'direction',
      'objectName',
      'relatedNo',
      'bizNo',
      'bizDate',
      'amount',
      'actualAmount',
      'writeOffAmount',
      'balance',
      'status',
    ],
  };
  const fields = new Set(fieldsByPage[pageKey.value]);
  return baseColumns.filter((column) => fields.has(getColumnDataIndex(column)));
});

const tableScrollX = computed(() =>
  Math.max(
    980,
    tableColumns.value.reduce(
      (sum, column) => sum + Number(column.width || 120),
      0,
    ),
  ),
);
const rankRows = computed(() => state.rows.slice(0, 5));

watch(
  () => pageKey.value,
  () => {
    normalizeObjectType();
    state.pageNo = 1;
    state.pageSize = DEFAULT_PAGE_SIZE;
    void loadData();
  },
);

watch(
  () => query.objectType,
  () => {
    state.pageNo = 1;
    void loadData();
  },
);

onMounted(() => {
  normalizeObjectType();
  void loadData();
});
</script>

<template>
  <BusinessReportShell
    :title="`经营报表 · 销售采购往来及对账 · ${pageTitle}`"
    :denied="!canCurrentPage"
    body-scrollable
  >
    <section class="counterparty-report-page">
      <Card class="counterparty-report-page__query-card" size="small">
        <Form class="counterparty-report-page__query" layout="inline">
          <FormItem label="业务时间">
            <RangePicker
              v-model:value="query.dateRange"
              class="counterparty-report-page__date"
              format="YYYY-MM-DD HH:mm:ss"
              show-time
            />
          </FormItem>
          <FormItem label="往来对象">
            <Select
              v-model:value="query.objectType"
              class="counterparty-report-page__select"
              :options="objectTypeOptions"
            />
          </FormItem>
          <FormItem
            v-if="
              pageKey === 'writeoff-detail' ||
              pageKey === 'payment-writeoff-trace'
            "
            label="核销状态"
          >
            <Select
              v-model:value="query.status"
              allow-clear
              class="counterparty-report-page__select"
              :options="statusOptions"
              placeholder="请选择状态"
            />
          </FormItem>
          <FormItem label="关键词">
            <Input
              v-model:value="query.keyword"
              allow-clear
              class="counterparty-report-page__keyword"
              placeholder="客户 / 供应商 / 单号 / 部门"
              @press-enter="handleSearch"
            />
          </FormItem>
          <FormItem>
            <Space>
              <Button type="primary" @click="handleSearch">查询</Button>
              <Button @click="handleReset">重置</Button>
              <Button
                :disabled="!canExportCounterparty"
                :loading="exportLoading"
                @click="handleExport"
              >
                导出
              </Button>
            </Space>
          </FormItem>
        </Form>
      </Card>

      <div class="counterparty-report-page__metrics">
        <Card
          v-for="metric in metricCards"
          :key="metric.label"
          class="counterparty-report-page__metric"
          :class="
            metric.tone && `counterparty-report-page__metric--${metric.tone}`
          "
          size="small"
        >
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <small>{{ metric.note }}</small>
        </Card>
      </div>

      <div class="counterparty-report-page__chart-grid">
        <Card
          class="counterparty-report-page__chart"
          size="small"
          title="金额结构"
        >
          <div class="counterparty-report-page__bars">
            <i
              v-for="(row, index) in rankRows"
              :key="`${row.key}-bar`"
              :style="{
                height: `${Math.max(18, Math.min(92, 28 + index * 12))}%`,
              }"
            ></i>
            <Empty v-if="rankRows.length === 0" description="暂无数据" />
          </div>
        </Card>
        <Card
          class="counterparty-report-page__chart"
          size="small"
          title="当前页关注"
        >
          <div class="counterparty-report-page__watch-list">
            <p v-for="row in rankRows" :key="`${row.key}-rank`">
              <span>{{
                row.objectName || row.relatedNo || row.bizNo || '—'
              }}</span>
              <b>{{
                formatMoney(row.balance ?? row.writeOffAmount ?? row.amount)
              }}</b>
            </p>
            <Empty v-if="rankRows.length === 0" description="暂无数据" />
          </div>
        </Card>
      </div>

      <Card
        class="counterparty-report-page__table-card"
        size="small"
        :title="pageTitle"
      >
        <div v-if="state.error" class="counterparty-report-page__error">
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
          <template #emptyText>
            <Empty description="暂无符合条件的数据" />
          </template>
          <template #bodyCell="{ column, record, text }">
            <template v-if="getColumnDataIndex(column) === 'status'">
              <Tag :color="getStatusColor(record.status)">
                {{ record.status || '—' }}
              </Tag>
            </template>
            <template
              v-else-if="
                [
                  'actualAmount',
                  'amount',
                  'balance',
                  'preAmount',
                  'totalAmount',
                  'writeOffAmount',
                ].includes(getColumnDataIndex(column))
              "
            >
              {{ formatMoney(text) }}
            </template>
            <template v-else-if="getColumnDataIndex(column) === 'overdueDays'">
              {{ typeof text === 'number' ? formatNumber(text) : text || '—' }}
            </template>
            <template v-else>
              {{ text || '—' }}
            </template>
          </template>
        </Table>
        <div class="counterparty-report-page__footer">
          <span>共 {{ state.total }} 条记录</span>
          <span>本页 {{ state.rows.length }} 条</span>
          <span>本页发生：{{ formatMoney(sumRows('amount')) }}</span>
          <span>本页核销：{{ formatMoney(sumRows('writeOffAmount')) }}</span>
          <span>本页余额：{{ formatMoney(sumRows('balance')) }}</span>
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
    </section>
  </BusinessReportShell>
</template>

<style scoped>
.counterparty-report-page {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 12px;
}

.counterparty-report-page__query-card,
.counterparty-report-page__metric,
.counterparty-report-page__chart,
.counterparty-report-page__table-card {
  border-radius: 10px;
}

.counterparty-report-page__query {
  gap: 8px 0;
}

.counterparty-report-page__date {
  width: 360px;
}

.counterparty-report-page__keyword {
  width: 260px;
}

.counterparty-report-page__select {
  width: 140px;
}

.counterparty-report-page__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.counterparty-report-page__metric span,
.counterparty-report-page__metric small {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.counterparty-report-page__metric strong {
  display: block;
  margin: 8px 0 4px;
  color: #1d4ed8;
  font-size: 22px;
  line-height: 1.2;
}

.counterparty-report-page__metric--green strong {
  color: #0f766e;
}

.counterparty-report-page__metric--orange strong {
  color: #d97706;
}

.counterparty-report-page__metric--purple strong {
  color: #7c3aed;
}

.counterparty-report-page__chart-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.8fr);
  gap: 12px;
}

.counterparty-report-page__bars {
  display: flex;
  align-items: end;
  min-height: 130px;
  gap: 10px;
  padding: 12px 12px 0;
  background: linear-gradient(180deg, #f8fafc, #fff);
  border-radius: 8px;
}

.counterparty-report-page__bars i {
  flex: 1 1 0;
  min-height: 18px;
  max-height: 130px;
  background: linear-gradient(180deg, #60a5fa, #2563eb);
  border-radius: 8px 8px 0 0;
}

.counterparty-report-page__watch-list {
  display: grid;
  min-height: 130px;
  align-content: start;
  gap: 8px;
}

.counterparty-report-page__watch-list p {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0;
  padding: 8px 10px;
  color: #475569;
  background: #f8fbff;
  border-radius: 8px;
}

.counterparty-report-page__watch-list span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.counterparty-report-page__watch-list b {
  color: #2563eb;
  font-weight: 600;
  white-space: nowrap;
}

.counterparty-report-page__error {
  margin-bottom: 8px;
  padding: 8px 10px;
  color: #b42318;
  background: #fff1f0;
  border: 1px solid #ffccc7;
  border-radius: 8px;
  font-size: 13px;
}

.counterparty-report-page__footer {
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

.counterparty-report-page__footer span {
  white-space: nowrap;
}

:deep(.counterparty-report-page__table-card .ant-card-body) {
  padding-bottom: 10px;
}

:deep(.counterparty-report-page__table-card .ant-table),
:deep(.counterparty-report-page__table-card .ant-table-cell),
:deep(.counterparty-report-page__table-card .ant-pagination),
:deep(.counterparty-report-page__query-card .ant-form-item-label > label),
:deep(.counterparty-report-page__query-card .ant-input),
:deep(.counterparty-report-page__query-card .ant-select),
:deep(.counterparty-report-page__query-card .ant-picker),
:deep(.counterparty-report-page__query-card .ant-btn) {
  font-size: 12px;
}

:deep(.counterparty-report-page__table-card .ant-table-thead > tr > th) {
  white-space: nowrap;
}

@media (max-width: 1280px) {
  .counterparty-report-page__metrics,
  .counterparty-report-page__chart-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .counterparty-report-page__metrics,
  .counterparty-report-page__chart-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .counterparty-report-page__date,
  .counterparty-report-page__keyword,
  .counterparty-report-page__select {
    width: 100%;
  }
}
</style>
