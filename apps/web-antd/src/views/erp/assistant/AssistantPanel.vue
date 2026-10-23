<script setup lang="ts">
import type { EchartsUIType } from '@vben/plugins/echarts';

import type {
  AccountDepartmentResult,
  Conversation,
  History,
  ProductPriceStockResult,
  Result,
} from '#/api/erp/assistant';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onDeactivated,
  ref,
  watch,
} from 'vue';

import { useAccess } from '@vben/access';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import {
  Alert,
  Button,
  Drawer,
  Input,
  message,
  Pagination,
  Select,
  Table,
} from 'ant-design-vue';

import * as api from '#/api/erp/assistant';

import {
  assistantDetailAvailable,
  assistantDetailLabel,
  assistantResponseMessage,
  assistantTableColumn,
} from './assistant-result-format';
import { formatAssistantTime } from './time';

type PanelMode = 'drawer' | 'page';

defineOptions({ name: 'ErpAssistantPanel' });

const props = withDefaults(
  defineProps<{
    active?: boolean;
    currentPage?: string;
    mode?: PanelMode;
  }>(),
  {
    active: true,
    currentPage: '/erp/assistant',
    mode: 'page',
  },
);

const emit = defineEmits<{
  busyChange: [busy: boolean];
  openFullPage: [];
}>();

const CONVERSATION_PAGE_SIZE = 10;
const CONVERSATION_SCROLL_THRESHOLD = 24;

const { hasAccessByCodes } = useAccess();
const allowed = computed(() => hasAccessByCodes(['erp:assistant:query']));
const auditAllowed = computed(() => hasAccessByCodes(['erp:assistant:audit']));
const conversations = ref<Conversation[]>([]);
const messages = ref<History[]>([]);
const conversationId = ref('');
const question = ref('');
const composerRef = ref<HTMLElement>();
const composerComposing = ref(false);
const busy = ref(false);
const progress = ref('');
const error = ref('');
const readiness = ref<api.Readiness>();
const requestId = ref('');
const ready = computed(() => readiness.value?.status === 'READY');
const explanation = ref('');
const explanationText = computed(() =>
  explanation.value ===
  '汇总已完成，统计范围、口径及查询时间见结果卡片，可查看来源明细核对。'
    ? '汇总已完成，可查看统计口径或来源明细进行核对。'
    : explanation.value,
);
const clarification = ref('');
const choices = ref<string[]>([]);
const candidateField = ref('');
const selectedEntity = ref<api.SelectedEntity>();
const candidates = ref<
  Array<{
    code?: string;
    description?: string;
    entityType?: string;
    field?: string;
    id: number;
    matchType?: string;
    name: string;
  }>
>([]);
const lastQuestion = ref('');
const result = ref<Result>();
const expandedProductIds = ref<number[]>([]);
const conversationPage = ref(1);
const conversationExhausted = ref(false);
const historyPage = ref(1);
const historyExpanded = ref(false);
const historyExhausted = ref(false);
const detailDrawerOpen = ref(false);
const detailLoading = ref(false);
const detailRows = ref<Array<Record<string, any>>>([]);
const detailServerColumns = ref<
  Array<{ dataIndex?: string; key: string; title: string }>
>([]);
const detailTotal = ref(0);
const detailPage = ref(1);
const auditDrawerOpen = ref(false);
const auditLoading = ref(false);
const auditData = ref<api.AssistantAudit>();
const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

function candidateTypeLabel(type?: string) {
  return (
    {
      CUSTOMER: '客户',
      DEPARTMENT: '部门',
      PRODUCT: '产品',
      SUPPLIER: '供应商',
      WAREHOUSE: '仓库',
    }[type || ''] || type
  );
}
function entityReferenceLabel(type?: string) {
  return (
    {
      CUSTOMER: '这个客户',
      DEPARTMENT: '这个部门',
      PRODUCT: '这个产品',
      SUPPLIER: '这个供应商',
      WAREHOUSE: '这个仓库',
    }[type || ''] || '这个对象'
  );
}
function sendChoice(choice: string) {
  if (!selectedEntity.value) {
    void send(`${lastQuestion.value}；补充：${choice}`);
    return;
  }
  const entity = selectedEntity.value;
  void send(`${entityReferenceLabel(entity.entityType)}；补充：${choice}`, {
    field: entity.field || `resolved:${entity.entityType}`,
    id: entity.id,
  });
}
let controller: AbortController | undefined;
let generation = 0;
let detailGeneration = 0;
let readinessGeneration = 0;
let conversationGeneration = 0;
const historyLoading = ref(false);
const conversationLoading = ref(false);
const readinessLoading = ref(false);
const examples = [
  { metric: 'SALE', text: '本月销售情况' },
  { metric: 'STOCK_SKU', text: '蛟龙港仓当前有库存的 SKU 数' },
  { metric: 'STOCK', text: '蛟龙港仓当前库存' },
  { metric: 'RECEIPT', text: '本周收款情况' },
];
const availableMetrics = computed(
  () => readiness.value?.metrics.filter((item) => item.available) ?? [],
);
const availableExamples = computed(() =>
  examples.filter((item) => exampleAvailable(item.metric)),
);
const visibleHistory = computed(() =>
  historyExpanded.value ? messages.value : messages.value.slice(0, 3),
);
const conversationOptions = computed(() =>
  conversations.value.map((item) => ({
    label: item.title,
    value: item.id,
  })),
);

function exampleAvailable(metric: string) {
  return availableMetrics.value.some((item) => item.id === metric);
}

async function loadReadiness(refresh = false) {
  const epoch = ++readinessGeneration;
  const identity = api.identity();
  readinessLoading.value = true;
  try {
    const state = await api.readiness(refresh);
    if (epoch === readinessGeneration && identity === api.identity()) {
      readiness.value = state;
    }
  } catch {
    if (epoch !== readinessGeneration || identity !== api.identity()) return;
    readiness.value = {
      metrics: [],
      status: 'UNAVAILABLE',
      text: '服务状态获取失败，请刷新重试',
    };
  } finally {
    if (epoch === readinessGeneration && identity === api.identity()) {
      readinessLoading.value = false;
    }
  }
}

const columns = computed(() => {
  if (result.value?.columns?.length) {
    return result.value.columns.map((item) => assistantTableColumn(item));
  }
  return [
    { key: 'label', title: '分组' },
    { key: 'amount', title: '金额／数量' },
    { key: 'unit', title: '单位' },
  ].map((item) => assistantTableColumn(item));
});
const isProductResultTable = computed(
  () =>
    result.value?.toolName === 'query_product_stock' &&
    Array.isArray(result.value.productResults),
);
const isAccountResultTable = computed(
  () =>
    ['PAYABLE', 'RECEIVABLE'].includes(result.value?.plan?.metric ?? '') &&
    Array.isArray(result.value?.accountResults),
);
const productColumns = [
  { dataIndex: 'index', key: 'index', title: '序号', width: 64 },
  { dataIndex: 'productName', key: 'productName', title: '产品' },
  {
    customRender: ({ record }: { record: ProductPriceStockResult }) =>
      productPriceText(record),
    key: 'prices',
    title: '价格',
  },
  {
    customRender: ({ record }: { record: ProductPriceStockResult }) =>
      productStockText(record),
    key: 'warehouseStocks',
    title: '仓库库存',
  },
];
const productTableRows = computed(() =>
  (result.value?.productResults ?? []).map((item, index) => ({
    ...item,
    index: index + 1,
  })),
);
const accountColumns = computed(() => {
  const receivable = result.value?.plan?.metric === 'RECEIVABLE';
  return [
    { dataIndex: 'index', key: 'index', title: '序号', width: 64 },
    {
      dataIndex: 'partyName',
      key: 'partyName',
      title: receivable ? '客户' : '供应商',
    },
    { dataIndex: 'deptName', key: 'deptName', title: '单据所属部门' },
    {
      customRender: ({ record }: { record: AccountDepartmentResult }) =>
        formatProductNumber(record.amount),
      key: 'amount',
      title: receivable ? '应收余额' : '应付余额',
    },
  ];
});
const accountTableRows = computed(() =>
  (result.value?.accountResults ?? []).map((item, index) => ({
    ...item,
    index: index + 1,
    rowKey: `${item.partyId}-${item.deptId ?? 'unassigned'}`,
  })),
);
const accountPartyTitle = computed(() =>
  result.value?.plan?.metric === 'RECEIVABLE' ? '客户' : '供应商',
);
const fallbackDetailColumns = [
  { key: 'docType', title: '业务类型' },
  { key: 'name', title: '单据／配件' },
  { key: 'amount', title: '金额／数量' },
  { key: 'unit', title: '单位' },
  { key: 'day', title: '日期' },
  { key: 'deptName', title: '部门' },
  { key: 'partyName', title: '往来单位' },
  { key: 'warehouseName', title: '仓库' },
];
const detailColumns = computed(() =>
  (detailServerColumns.value.length > 0
    ? detailServerColumns.value
    : fallbackDetailColumns
  ).map((item) => assistantTableColumn(item)),
);
const label = computed(() => {
  if (result.value?.summaryLabel) return result.value.summaryLabel;
  if (result.value?.toolName === 'query_product_stock') return '当前库存';
  const metric = result.value?.plan?.metric;
  if (metric === 'SALE' || metric === 'PURCHASE') return '净额';
  if (metric === 'STOCK_SKU') return 'SKU 数';
  if (metric === 'STOCK') return '库存数量';
  if (metric === 'RECEIVABLE' || metric === 'PAYABLE') return '当前余额';
  if (metric === 'RECEIPT' || metric === 'PAYMENT') return '已审核实际金额';
  return '';
});

function summaryItemLabel(row: Record<string, unknown>) {
  if (result.value?.toolName === 'query_stock_movements') {
    return String(row.label ?? row.businessObject ?? '入库记录数');
  }
  if (result.value?.toolName === 'query_master_data_stats' && row.label) {
    return `${String(row.label)}数量`;
  }
  return label.value || String(row.label ?? row.businessObject ?? '统计结果');
}

function summaryItemAmount(row: Record<string, unknown>) {
  if (result.value?.toolName === 'query_stock_movements') {
    return row.amount ?? row.record_count;
  }
  if (['PAYABLE', 'RECEIVABLE'].includes(result.value?.plan?.metric ?? '')) {
    return formatProductNumber(row.amount);
  }
  return row.amount;
}

function summaryItemUnit(row: Record<string, unknown>) {
  if (result.value?.toolName === 'query_stock_movements') {
    return row.unit ?? '条';
  }
  return row.unit;
}

function summaryItemKey(row: Record<string, unknown>, index: number) {
  const identity = row.label ?? row.businessObject ?? row.unit ?? 'summary';
  return `${String(identity)}-${index}`;
}

const visibleSummary = computed(() => {
  const summary = result.value?.summary ?? [];
  if (isProductResultTable.value) return [];
  if (
    result.value?.queryType === 'KNOWLEDGE' ||
    result.value?.toolName === 'answer_company_knowledge' ||
    ['CLARIFY', 'KNOWLEDGE_NOT_FOUND'].includes(result.value?.status ?? '')
  ) {
    return [];
  }
  if (result.value?.toolName !== 'query_stock_movements') return summary;
  if (result.value?.status === 'EMPTY') return [];
  return summary.filter((row) => {
    const amount = Number(summaryItemAmount(row));
    return Number.isFinite(amount) && amount > 0;
  });
});

const presentationMode = computed(() => {
  if (result.value?.presentation?.mode) return result.value.presentation.mode;
  if (result.value?.plan?.presentationMode) {
    return result.value.plan.presentationMode;
  }
  if (result.value?.plan?.group === 'DAY') return 'TREND';
  if (result.value?.plan?.group && result.value.plan.group !== 'NONE') {
    return 'DISTRIBUTION';
  }
  return result.value?.rows?.length && !result.value?.summary?.length
    ? 'DETAIL'
    : 'SUMMARY';
});

const isStockQuantityRanking = computed(
  () =>
    presentationMode.value === 'RANKING' &&
    result.value?.plan?.metric === 'STOCK' &&
    ['PRODUCT', 'WAREHOUSE'].includes(result.value.plan.group),
);

const shouldShowSummary = computed(() => {
  const current = result.value;
  if (!current) return false;
  if (visibleSummary.value.length === 0) return false;
  if (current.presentation) return current.presentation.showSummary;
  return !['DETAIL', 'RANKING'].includes(presentationMode.value);
});

const shouldShowTable = computed(() => {
  if (isProductResultTable.value || isAccountResultTable.value) return false;
  if (!result.value?.rows?.length) return false;
  return result.value.presentation?.showTable ?? true;
});

const canOpenDetails = computed(() => {
  if (!result.value) return false;
  const protocolValue = assistantDetailAvailable(result.value);
  if (protocolValue !== undefined) return protocolValue;
  if (result.value.toolName === 'answer_company_knowledge') return false;
  if (result.value.toolName === 'query_master_data_stats') return false;
  return (
    result.value.queryType !== 'MIXED' || Boolean(result.value.dataToolName)
  );
});
const detailButtonLabel = computed(() => assistantDetailLabel(result.value));

function displayValue(value: unknown) {
  if (typeof value !== 'number') return String(value ?? '0');
  return Number.isInteger(value) ? String(value) : String(value);
}

const resultHeadline = computed(() => {
  if (result.value?.presentation?.headline) {
    return result.value.presentation.headline;
  }
  if (presentationMode.value !== 'RANKING' || !result.value?.rows?.length) {
    return '';
  }
  const firstRank = result.value.rows.filter((row, index) => {
    const rank = row.unitRank ?? row.unit_rank;
    return rank === undefined ? index === 0 : Number(rank) === 1;
  });
  if (firstRank.length === 0) return '';
  const direction = result.value.plan?.rankOrder === 'ASC' ? '最少' : '最多';
  const subject = result.value.plan?.group === 'WAREHOUSE' ? '仓库' : '产品';
  const describe = (row: Record<string, any>) =>
    `${row.label ?? '未命名'}（${displayValue(row.amount)}${row.unit ? ` ${row.unit}` : ''}）`;
  if (firstRank.length === 1) {
    const row = firstRank[0]!;
    return `库存${direction}的${subject}是${row.label ?? '未命名'}，当前库存为${displayValue(row.amount)}${row.unit ? ` ${row.unit}` : ''}。`;
  }
  return `库存${direction}的${subject}有 ${firstRank.length} 个：${firstRank.map((row) => describe(row)).join('、')}。`;
});

const toolLabel = computed(() => {
  const labels: Record<string, string> = {
    answer_company_knowledge: '公司知识问答',
    answer_mixed_question: '公司知识与实时数据组合查询',
    execute_semantic_query: '智能语义查询',
    query_account_balance: '往来余额查询',
    query_cash_documents: '收付款单查询',
    query_product_stock: '产品价格/库存查询',
    query_purchase_documents: '采购单据查询',
    query_purchase_fulfillment: '采购到货进度查询',
    query_sale_documents: '销售单据查询',
    query_sale_fulfillment: '销售发货进度查询',
    query_stock_movements: '库存流水查询',
    query_verified_metric: '已核验指标查询',
  };
  return result.value?.toolName
    ? (labels[result.value.toolName] ?? '业务数据查询')
    : '';
});

function chartValue(row: Record<string, any>) {
  for (const key of [
    'amount',
    'quantity',
    'documents',
    'count',
    'total_count',
    'remaining_count',
  ]) {
    if (typeof row[key] === 'number') return row[key];
  }
  return undefined;
}

function chartLabel(row: Record<string, any>) {
  return String(
    row.label ??
      row.warehouse_name ??
      row.dept_name ??
      row.supplier_name ??
      row.customer_name ??
      row.day ??
      row.name ??
      '未归属',
  );
}

const canRenderResultChart = computed(() => {
  if (isProductResultTable.value) return false;
  const rows = result.value?.rows ?? [];
  return (
    (result.value?.presentation?.showChart ??
      ['DISTRIBUTION', 'RANKING', 'TREND'].includes(presentationMode.value)) &&
    rows.length > 0 &&
    rows.every((row) => chartValue(row) !== undefined) &&
    (isStockQuantityRanking.value ||
      new Set(rows.map((row) => row.unit ?? '')).size === 1)
  );
});

function formatProductNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : '0.00';
}

function productPriceText(product: Partial<ProductPriceStockResult>) {
  if (product.priceDisplayText) return product.priceDisplayText;
  if (!product.prices?.length) return '当前账号可见的价格尚未维护';
  return product.prices
    .map((price) => `${price.title} ${formatProductNumber(price.value)}`)
    .join('；');
}

function productStockText(product: Partial<ProductPriceStockResult>) {
  const stocks = product.warehouseStocks ?? [];
  if (stocks.length === 0) return '无库存';
  const expanded =
    product.productId !== undefined &&
    expandedProductIds.value.includes(product.productId);
  const visible = expanded ? stocks : stocks.slice(0, 5);
  const values = visible.map(
    (stock) => `${stock.warehouseName} ${formatProductNumber(stock.amount)}`,
  );
  if (!expanded && stocks.length > 5) {
    const otherAmount = stocks
      .slice(5)
      .reduce((total, stock) => total + Number(stock.amount || 0), 0);
    values.push(
      `其他${stocks.length - 5}仓 ${formatProductNumber(otherAmount)}`,
    );
  }
  return values.join('；');
}

function toggleProductStocks(productId: number) {
  expandedProductIds.value = expandedProductIds.value.includes(productId)
    ? expandedProductIds.value.filter((id) => id !== productId)
    : [...expandedProductIds.value, productId];
}

function escapeTooltipText(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderResultChart() {
  if (!props.active || !result.value || !canRenderResultChart.value) return;
  const rows = result.value.rows;
  renderEcharts({
    series: [
      {
        data: rows.map((row) => chartValue(row)),
        name: isStockQuantityRanking.value ? '库存数量' : undefined,
        type: result.value.plan?.group === 'DAY' ? 'line' : 'bar',
      },
    ],
    tooltip: isStockQuantityRanking.value
      ? {
          formatter: (parameters: any) => {
            const parameter = Array.isArray(parameters)
              ? parameters[0]
              : parameters;
            const row = rows[parameter?.dataIndex ?? 0];
            if (!row) return '';
            return `${escapeTooltipText(chartLabel(row))}<br/>库存数量：${escapeTooltipText(chartValue(row))} ${escapeTooltipText(row?.unit)}`;
          },
          trigger: 'axis',
        }
      : { trigger: 'axis' },
    xAxis: {
      data: rows.map((row) => chartLabel(row)),
      type: 'category',
    },
    yAxis: { type: 'value' },
  });
}

function reset() {
  result.value = undefined;
  expandedProductIds.value = [];
  explanation.value = '';
  clarification.value = '';
  choices.value = [];
  candidates.value = [];
  candidateField.value = '';
  selectedEntity.value = undefined;
  error.value = '';
  detailDrawerOpen.value = false;
  auditDrawerOpen.value = false;
  auditData.value = undefined;
  ++detailGeneration;
  detailLoading.value = false;
  detailRows.value = [];
  detailServerColumns.value = [];
  detailTotal.value = 0;
}

async function refreshConversations() {
  const epoch = ++conversationGeneration;
  const identity = api.identity();
  conversationPage.value = 1;
  conversationExhausted.value = false;
  conversationLoading.value = true;
  try {
    const rows = await api.listConversations(1, CONVERSATION_PAGE_SIZE);
    if (epoch === conversationGeneration && identity === api.identity()) {
      const activeConversation = conversations.value.find(
        (item) => item.id === conversationId.value,
      );
      conversations.value = mergeConversations(
        activeConversation &&
          !rows.some((item) => item.id === activeConversation.id)
          ? [activeConversation]
          : [],
        rows,
      );
      conversationPage.value = 1;
      conversationExhausted.value = rows.length < CONVERSATION_PAGE_SIZE;
    }
  } finally {
    if (epoch === conversationGeneration && identity === api.identity()) {
      conversationLoading.value = false;
    }
  }
}

function mergeConversations(current: Conversation[], next: Conversation[]) {
  const merged = new Map(current.map((item) => [item.id, item]));
  next.forEach((item) => merged.set(item.id, item));
  return [...merged.values()];
}

async function selectConversation(id: string) {
  if (busy.value) return;
  const epoch = ++generation;
  reset();
  conversationId.value = id;
  messages.value = [];
  historyPage.value = 1;
  historyExpanded.value = false;
  historyExhausted.value = false;
  try {
    const rows = await api.history(id);
    if (epoch === generation) messages.value = rows;
  } catch (error_) {
    if (epoch === generation) error.value = String(error_);
  }
}

function activateEmptyConversation(id: string) {
  reset();
  conversationId.value = id;
  conversations.value = mergeConversations(
    [{ id, title: '新会话' }],
    conversations.value.filter((item) => item.id !== id),
  );
  messages.value = [];
  historyPage.value = 1;
  historyExpanded.value = false;
  historyExhausted.value = false;
}

async function newConversation() {
  if (busy.value) return;
  const epoch = ++generation;
  const identity = api.identity();
  const requestController = new AbortController();
  controller = requestController;
  busy.value = true;
  try {
    const id = await api.createConversation(requestController.signal);
    if (
      epoch !== generation ||
      identity !== api.identity() ||
      requestController.signal.aborted
    ) {
      return;
    }
    activateEmptyConversation(id);
  } catch (error_) {
    if (epoch === generation) error.value = String(error_);
  } finally {
    if (epoch === generation) {
      busy.value = false;
      if (controller === requestController) controller = undefined;
    }
  }
}

async function removeConversation() {
  if (!conversationId.value || busy.value) return;
  try {
    await api.deleteConversation(conversationId.value);
    conversationId.value = '';
    messages.value = [];
    historyExpanded.value = false;
    historyExhausted.value = false;
    reset();
    await refreshConversations();
  } catch (error_) {
    error.value = String(error_);
  }
}

async function send(
  text = question.value,
  choice?: { field: string; id: number },
  rerunId?: string,
) {
  if (busy.value || !text.trim() || !allowed.value || !ready.value) return;
  const identity = api.identity();
  const epoch = ++generation;
  const requestController = new AbortController();
  controller = requestController;
  busy.value = true;
  let queryStarted = false;
  try {
    if (!conversationId.value) {
      const id = await api.createConversation(requestController.signal);
      if (
        epoch !== generation ||
        identity !== api.identity() ||
        requestController.signal.aborted
      ) {
        return;
      }
      activateEmptyConversation(id);
    }
    if (!conversationId.value) return;
    reset();
    question.value = '';
    lastQuestion.value = text;
    requestId.value = '';
    queryStarted = true;
    const receive = (
      event: Parameters<typeof api.ask>[3] extends (event: infer Event) => void
        ? Event
        : never,
    ) => {
      if (event.event === 'started') {
        if (epoch !== generation) {
          void api.cancelRequest(event.data.requestId).catch(() => {});
          return;
        }
        requestId.value = event.data.requestId;
      }
      if (epoch !== generation) return;
      if (event.event === 'progress') progress.value = event.data.text;
      if (event.event === 'route') progress.value = '已选择安全查询路径';
      if (event.event === 'tool-progress') progress.value = event.data.text;
      if (event.event === 'clarification') {
        clarification.value = assistantResponseMessage(
          event.data,
          event.data.clarification || '需要补充信息后才能继续查询',
        );
        choices.value = event.data.choices || [];
        candidateField.value = event.data.field || '';
        selectedEntity.value = event.data.selectedEntity;
        candidates.value = event.data.candidates || [];
      }
      if (event.event === 'result') {
        result.value = event.data as Result;
        void nextTick().then(renderResultChart);
      }
      if (event.event === 'explanation') explanation.value = event.data.text;
      if (event.event === 'error') {
        error.value = assistantResponseMessage(
          event.data,
          event.data.text || '查询未完成，请稍后重试',
        );
      }
    };
    await (rerunId
      ? api.rerun(rerunId, requestController.signal, receive)
      : api.ask(
          conversationId.value,
          text,
          requestController.signal,
          receive,
          choice,
          undefined,
          {
            currentPage: props.currentPage,
            entry: props.mode === 'drawer' ? 'WEB_DRAWER' : 'WEB_PAGE',
          },
        ));
  } catch (error_) {
    if (epoch === generation) {
      error.value = error_ instanceof Error ? error_.message : '查询失败';
    }
  } finally {
    if (epoch === generation) {
      requestId.value = '';
      busy.value = false;
      progress.value = '';
      if (controller === requestController) controller = undefined;
      if (queryStarted) {
        const rows = await api
          .history(conversationId.value)
          .catch(() => messages.value);
        if (epoch === generation) {
          messages.value = rows;
          historyPage.value = 1;
          historyExhausted.value = false;
          await refreshConversations().catch(() => {});
        }
      }
    }
  }
}

function handleComposerKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey) return;
  if (event.isComposing || composerComposing.value || event.keyCode === 229) {
    return;
  }
  event.preventDefault();
  if (
    event.repeat ||
    busy.value ||
    !question.value.trim() ||
    !allowed.value ||
    !ready.value
  ) {
    return;
  }
  void send();
}

function handleComposerCompositionStart() {
  composerComposing.value = true;
}

function handleComposerCompositionEnd() {
  composerComposing.value = false;
}

function cancel() {
  if (requestId.value) {
    void api.cancelRequest(requestId.value).catch(() => {});
  }
  requestId.value = '';
  ++generation;
  controller?.abort();
  busy.value = false;
  progress.value = '';
  error.value = '本次查询已停止';
}

async function openDetails(page = 1) {
  if (!result.value) return;
  const messageId = result.value.messageId;
  const epoch = generation;
  const detailEpoch = ++detailGeneration;
  detailLoading.value = true;
  detailDrawerOpen.value = true;
  detailPage.value = page;
  try {
    const data = await api.details(messageId, page);
    if (
      epoch !== generation ||
      detailEpoch !== detailGeneration ||
      result.value?.messageId !== messageId
    ) {
      return;
    }
    detailRows.value = data.list;
    detailServerColumns.value = data.columns || [];
    detailTotal.value = data.total;
  } catch (error_) {
    if (epoch !== generation || detailEpoch !== detailGeneration) return;
    detailRows.value = [];
    detailServerColumns.value = [];
    detailTotal.value = 0;
    error.value = String(error_);
  } finally {
    if (epoch === generation && detailEpoch === detailGeneration) {
      detailLoading.value = false;
    }
  }
}

async function openAudit() {
  if (!result.value?.messageId || !auditAllowed.value) return;
  auditDrawerOpen.value = true;
  auditLoading.value = true;
  try {
    auditData.value = await api.audit(result.value.messageId);
  } catch (error_) {
    auditData.value = undefined;
    error.value = String(error_);
  } finally {
    auditLoading.value = false;
  }
}

async function moreHistory() {
  if (!conversationId.value || historyLoading.value || historyExhausted.value)
    return;
  const epoch = generation;
  historyLoading.value = true;
  try {
    const page = historyPage.value + 1;
    const rows = await api.history(conversationId.value, page);
    if (epoch === generation) {
      if (rows.length === 0) {
        historyExhausted.value = true;
      } else {
        historyPage.value = page;
        messages.value.push(...rows);
      }
    }
  } catch (error_) {
    if (epoch === generation) error.value = String(error_);
  } finally {
    historyLoading.value = false;
  }
}

function fillFromHistory(item: History) {
  if (busy.value) return;
  question.value = item.question;
  void nextTick(() => {
    composerRef.value?.querySelector('textarea')?.focus();
  });
}

async function moreConversations() {
  if (conversationLoading.value || conversationExhausted.value) return;
  const epoch = conversationGeneration;
  const identity = api.identity();
  conversationLoading.value = true;
  try {
    const page = conversationPage.value + 1;
    const rows = await api.listConversations(page, CONVERSATION_PAGE_SIZE);
    if (epoch === conversationGeneration && identity === api.identity()) {
      conversationPage.value = page;
      conversations.value = mergeConversations(conversations.value, rows);
      conversationExhausted.value = rows.length < CONVERSATION_PAGE_SIZE;
    }
  } catch {
    if (epoch === conversationGeneration && identity === api.identity()) {
      message.error('更多会话加载失败，请稍后重试');
    }
  } finally {
    if (epoch === conversationGeneration && identity === api.identity()) {
      conversationLoading.value = false;
    }
  }
}

function handleConversationScroll(event: Event) {
  const target = event.target as HTMLElement;
  if (
    target.scrollTop + target.clientHeight >=
    target.scrollHeight - CONVERSATION_SCROLL_THRESHOLD
  ) {
    void moreConversations();
  }
}

function cancelActiveRequest() {
  if (requestId.value) {
    void api.cancelRequest(requestId.value).catch(() => {});
  }
  requestId.value = '';
  ++generation;
  controller?.abort();
  busy.value = false;
}

function clearIdentityState() {
  ++conversationGeneration;
  cancelActiveRequest();
  reset();
  conversations.value = [];
  conversationPage.value = 1;
  conversationExhausted.value = false;
  messages.value = [];
  conversationId.value = '';
  historyPage.value = 1;
  historyExpanded.value = false;
  historyExhausted.value = false;
  question.value = '';
  readiness.value = undefined;
  if (allowed.value) {
    const identity = api.identity();
    void loadReadiness();
    void refreshConversations().catch((error_) => {
      if (identity === api.identity()) error.value = String(error_);
    });
  }
}

onBeforeUnmount(() => {
  ++conversationGeneration;
  cancelActiveRequest();
});

watch([() => api.identity(), allowed], clearIdentityState, {
  immediate: true,
});
watch(busy, (value) => emit('busyChange', value), { immediate: true });
watch(
  () => props.active,
  (active) => {
    if (active) void nextTick().then(renderResultChart);
  },
);

onDeactivated(() => {
  cancelActiveRequest();
  progress.value = '';
  reset();
});
</script>

<template>
  <Alert v-if="!allowed" message="没有智能问数访问权限" type="warning" />
  <div
    v-else
    class="assistant-layout"
    :class="`assistant-layout--${props.mode}`"
  >
    <aside v-if="props.mode === 'page'" class="assistant-sidebar">
      <Button block :disabled="busy" @click="newConversation">
        新建会话
      </Button>
      <div class="conversation-list" @scroll="handleConversationScroll">
        <button
          v-for="conversation in conversations"
          :key="conversation.id"
          class="conversation"
          :class="{ selected: conversation.id === conversationId }"
          :disabled="busy"
          :title="conversation.title"
          @click="selectConversation(conversation.id)"
        >
          {{ conversation.title }}
        </button>
        <div v-if="conversationLoading" class="conversation-loading">
          正在加载…
        </div>
      </div>
      <Button
        danger
        type="text"
        :disabled="busy || !conversationId"
        @click="removeConversation"
      >
        删除当前会话
      </Button>
    </aside>

    <div v-else class="assistant-drawer-toolbar">
      <Select
        :value="conversationId || undefined"
        :options="conversationOptions"
        :disabled="busy"
        :loading="conversationLoading"
        :not-found-content="conversationLoading ? '正在加载…' : undefined"
        allow-clear
        class="conversation-select"
        placeholder="选择历史会话"
        @change="(value) => value && selectConversation(String(value))"
        @popup-scroll="handleConversationScroll"
      />
      <Button :disabled="busy" @click="newConversation">新建</Button>
      <Button
        danger
        :disabled="busy || !conversationId"
        @click="removeConversation"
      >
        删除
      </Button>
      <Button type="link" :disabled="busy" @click="emit('openFullPage')">
        完整页面
      </Button>
    </div>

    <main class="assistant-main">
      <h2>查询你的经营数据</h2>
      <p class="muted">按当前权限查询，结果附统计口径与来源。</p>
      <div v-if="readiness && !ready" class="availability-warning">
        <Alert
          message="智能问数暂不可用，请稍后重新检测。"
          type="warning"
          show-icon
        />
        <Button
          type="link"
          :disabled="busy || readinessLoading"
          @click="loadReadiness(true)"
        >
          重新检测
        </Button>
      </div>
      <div class="examples">
        <Button
          v-for="item in availableExamples"
          :key="item.metric"
          :disabled="busy || !ready"
          @click="send(item.text)"
        >
          {{ item.text }}
        </Button>
      </div>
      <section v-if="messages.length > 0" class="recent-questions">
        <div class="recent-questions__header">
          <span>最近提问</span>
          <Button
            type="link"
            size="small"
            :disabled="busy"
            @click="historyExpanded = !historyExpanded"
          >
            {{ historyExpanded ? '收起' : '查看全部' }}
          </Button>
        </div>
        <div class="recent-questions__list">
          <Button
            v-for="item in visibleHistory"
            :key="item.id"
            class="recent-question"
            :disabled="busy"
            :title="item.question"
            @click="fillFromHistory(item)"
          >
            {{ item.question }}
          </Button>
        </div>
        <Button
          v-if="historyExpanded && !historyExhausted"
          class="load-more-history"
          type="link"
          size="small"
          :disabled="busy || historyLoading"
          @click="moreHistory"
        >
          {{ historyLoading ? '正在加载…' : '加载更多' }}
        </Button>
      </section>
      <Alert v-if="error" :message="error" type="warning" show-icon />
      <p v-if="busy" role="status">{{ progress || '正在查询…' }}</p>
      <section v-if="clarification" class="result-panel">
        <p>{{ clarification }}</p>
        <Button
          v-for="candidate in candidates"
          :key="candidate.id"
          :disabled="busy"
          @click="
            send(lastQuestion, {
              field: candidate.field || candidateField,
              id: candidate.id,
            })
          "
        >
          {{ candidate.name }}
          <template v-if="candidate.code">（{{ candidate.code }}）</template>
          <template v-if="candidate.entityType">
            · {{ candidateTypeLabel(candidate.entityType) }}
          </template>
          <template v-if="candidate.description">
            · {{ candidate.description }}
          </template>
        </Button>
        <Button
          v-for="choice in choices"
          :key="choice"
          :disabled="busy"
          @click="sendChoice(choice)"
        >
          {{ choice }}
        </Button>
      </section>
      <section v-if="result" class="result-panel">
        <Alert
          v-if="result.correctionNotice"
          :message="result.correctionNotice"
          type="info"
          show-icon
        />
        <p v-if="result.start">
          统计期间：{{ formatAssistantTime(result.start) }} 至
          {{ formatAssistantTime(result.end) }}（北京时间）
        </p>
        <Alert
          v-if="['EMPTY', 'NO_DATA'].includes(result.status)"
          :message="
            assistantResponseMessage(
              result,
              result.emptyText || '在指定条件和权限范围内未查到记录',
            )
          "
          type="info"
        />
        <Alert
          v-if="result.status === 'KNOWLEDGE_NOT_FOUND'"
          :message="
            assistantResponseMessage(
              result,
              result.emptyText ||
                '当前已发布的公司知识中没有找到足够相关的依据',
            )
          "
          type="info"
          show-icon
        />
        <Alert
          v-if="result.status === 'UNVERIFIED_KNOWLEDGE'"
          :message="
            assistantResponseMessage(
              result,
              result.verificationNotice ||
                '当前回答包含待核实资料，不能作为确定结论。',
            )
          "
          type="warning"
          show-icon
        />
        <Alert
          v-if="result.status === 'PARTIAL_SUCCESS'"
          :message="
            assistantResponseMessage(
              result,
              result.warnings?.join('；') || '问题仅完成了其中一部分',
            )
          "
          type="warning"
          show-icon
        />
        <Alert
          v-if="result.freshnessNotice"
          :message="result.freshnessNotice"
          type="info"
          show-icon
        />
        <Alert
          v-if="result.stockNotice"
          :message="result.stockNotice"
          type="info"
          show-icon
        />
        <Alert
          v-if="result.priceNotice"
          :message="result.priceNotice"
          type="warning"
          show-icon
        />
        <Alert
          v-if="resultHeadline"
          class="result-headline"
          :message="resultHeadline"
          type="success"
          show-icon
        />
        <div v-if="shouldShowSummary" class="cards">
          <article
            v-for="(row, index) in visibleSummary"
            :key="summaryItemKey(row, index)"
          >
            <span>{{ summaryItemLabel(row) }}</span>
            <strong>
              {{ summaryItemAmount(row) }}
              <small>{{ summaryItemUnit(row) }}</small>
            </strong>
            <p v-if="['SALE', 'PURCHASE'].includes(result.plan?.metric || '')">
              {{ result.plan?.metric === 'SALE' ? '销售额' : '采购入库额' }}
              {{ row.gross }} · 退货额 {{ row.refund }}
            </p>
            <p
              v-if="['RECEIPT', 'PAYMENT'].includes(result.plan?.metric || '')"
            >
              优惠 {{ row.refund }} · 已生效核销 {{ row.writeOff }} · 待审核
              {{ row.pending }}
            </p>
            <p
              v-if="
                result.plan &&
                !['PAYABLE', 'RECEIVABLE', 'STOCK', 'STOCK_SKU'].includes(
                  result.plan?.metric || '',
                ) &&
                result.plan?.group !== 'PRODUCT'
              "
            >
              记录数 {{ row.documents }}
            </p>
            <template
              v-for="field in result.priceFields || []"
              :key="field.key"
            >
              <p v-if="row[field.key] !== undefined && row[field.key] !== null">
                {{ field.title }} {{ row[field.key] }}
              </p>
            </template>
          </article>
        </div>
        <EchartsUI v-if="canRenderResultChart" ref="chartRef" class="chart" />
        <Table
          v-if="isProductResultTable && productTableRows.length"
          :columns="productColumns"
          :data-source="productTableRows"
          :pagination="false"
          :scroll="{ x: 'max-content' }"
          row-key="productId"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'prices'">
              {{ productPriceText(record) }}
            </template>
            <template v-else-if="column.key === 'warehouseStocks'">
              {{ productStockText(record) }}
              <Button
                v-if="record.warehouseStocks?.length > 5"
                size="small"
                type="link"
                @click="toggleProductStocks(record.productId)"
              >
                {{
                  expandedProductIds.includes(record.productId)
                    ? '收起'
                    : '展开全部仓库'
                }}
              </Button>
            </template>
          </template>
        </Table>
        <Alert
          v-if="isProductResultTable && result.productMatchTruncated"
          class="mt-3"
          message="匹配结果较多，已展示前 10 个产品"
          type="info"
          show-icon
        />
        <Table
          v-if="isAccountResultTable && accountTableRows.length"
          :columns="accountColumns"
          :data-source="accountTableRows"
          :pagination="false"
          :scroll="{ x: 'max-content' }"
          row-key="rowKey"
          size="small"
        />
        <p
          v-else-if="
            isAccountResultTable &&
            result.summary?.length &&
            !accountTableRows.length
          "
          class="mt-3"
        >
          当前没有非零部门余额。
        </p>
        <Alert
          v-if="isAccountResultTable && result.accountPartyTruncated"
          class="mt-3"
          :message="`匹配结果较多，已展示前 10 个${accountPartyTitle}及其部门明细`"
          type="info"
          show-icon
        />
        <Table
          v-if="shouldShowTable"
          :columns="columns"
          :data-source="result.rows"
          :pagination="false"
          :scroll="{ x: 'max-content' }"
          size="small"
        />
        <p v-if="explanationText">{{ explanationText }}</p>
        <details>
          <summary>统计口径与依据</summary>
          <p v-if="result.knowledge">{{ result.knowledge.description }}</p>
          <p v-if="result.knowledge">
            来源：{{ result.knowledge.source }} · 版本
            {{ result.knowledge.version }}
          </p>
          <p v-if="isStockQuantityRanking">
            排名口径：按库存数量统一排名，计量单位仅展示，不参与分组和排序。
          </p>
          <p v-if="result.basis?.length">依据：{{ result.basis.join('、') }}</p>
          <ul v-if="result.sources?.length" class="knowledge-sources">
            <li v-for="source in result.sources" :key="source.id">
              <strong v-if="source.citation">[{{ source.citation }}]</strong>
              《{{ source.title }}》 · {{ source.section }}
              <span v-if="source.updated"> · 更新于 {{ source.updated }}</span>
              <span
                v-if="source.verificationStatus === 'UNVERIFIED'"
                class="knowledge-source-unverified"
              >
                · 待核实
              </span>
              <p v-if="source.reason">{{ source.reason }}</p>
              <p>位置：{{ source.path }}</p>
            </li>
          </ul>
          <p v-if="toolLabel">查询方式：{{ toolLabel }}</p>
          <p v-if="result.plan?.metric === 'STOCK_SKU'">
            SKU 口径：{{ result.plan.stockMode }}
          </p>
        </details>
        <Button v-if="canOpenDetails" :disabled="busy" @click="openDetails()">
          {{ detailButtonLabel }}
        </Button>
        <Button
          v-if="auditAllowed"
          :disabled="busy"
          type="link"
          @click="openAudit"
        >
          查看查询审计
        </Button>
      </section>
      <div ref="composerRef" class="composer">
        <Input.TextArea
          v-model:value="question"
          :maxlength="2000"
          :auto-size="{ maxRows: 6, minRows: 2 }"
          placeholder="例如：本周收款情况，或兴宇公司主要做什么（Enter 发送，Shift+Enter 换行）"
          :disabled="busy"
          @compositionend="handleComposerCompositionEnd"
          @compositionstart="handleComposerCompositionStart"
          @keydown="handleComposerKeydown"
        />
        <Button v-if="busy" @click="cancel">停止</Button>
        <Button
          v-else
          type="primary"
          :disabled="!question.trim() || !ready"
          @click="send()"
        >
          发送
        </Button>
      </div>
    </main>
  </div>

  <Drawer
    v-model:open="detailDrawerOpen"
    title="来源明细（按当前权限重新查询）"
    width="85vw"
  >
    <Table
      :columns="detailColumns"
      :data-source="detailRows"
      :loading="detailLoading"
      :pagination="false"
      :scroll="{ x: 'max-content', y: '65vh' }"
      row-key="rowId"
    />
    <Pagination
      :current="detailPage"
      :page-size="20"
      :total="detailTotal"
      :show-size-changer="false"
      @change="openDetails"
    />
  </Drawer>

  <Drawer v-model:open="auditDrawerOpen" title="查询审计（管理员）" width="720">
    <p v-if="auditLoading">正在读取审计记录…</p>
    <template v-else-if="auditData">
      <p>
        路由：{{ auditData.route_type }} · 工具：{{
          auditData.tool_name || '-'
        }}
      </p>
      <p>
        状态：{{ auditData.status }} · 耗时：{{ auditData.elapsed_ms }} ms ·
        返回行数：{{ auditData.row_count ?? '-' }}
      </p>
      <p>SQL 指纹：{{ auditData.sql_fingerprint || '-' }}</p>
      <pre v-if="auditData.query_trace" class="audit-trace">{{
        auditData.query_trace
      }}</pre>
    </template>
  </Drawer>
</template>

<style scoped>
.assistant-layout {
  height: 100%;
  background: var(--background);
  color: var(--foreground);
}

.assistant-layout--page {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 20px;
  padding: 16px;
}

.assistant-layout--drawer {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.assistant-sidebar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  overflow: hidden;
  padding-right: 16px;
  border-right: 1px solid #ddd;
}

.conversation-list {
  display: flex;
  flex: 0 1 440px;
  flex-direction: column;
  gap: 4px;
  max-height: min(58vh, 440px);
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.conversation {
  flex: 0 0 auto;
  width: 100%;
  overflow: hidden;
  padding: 10px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 6px;
}

.conversation-loading {
  flex: 0 0 auto;
  padding: 8px 0;
  color: #8c8c8c;
  font-size: 12px;
  text-align: center;
}

.selected {
  color: #1458ad;
  background: #e8f3ff;
}

.assistant-drawer-toolbar {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 4px 12px;
  border-bottom: 1px solid var(--border);
}

.conversation-select {
  min-width: 200px;
  flex: 1 1 240px;
}

.assistant-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  overflow: auto;
  padding: 0 12px 16px;
}

.assistant-layout--drawer .assistant-main {
  flex: 1 1 auto;
  padding: 16px 4px 0;
}

.assistant-main h2 {
  font-size: 24px;
  font-weight: 600;
}

.muted {
  color: #777;
  font-size: 12px;
}

.availability-warning {
  display: flex;
  align-items: center;
  gap: 4px;
}

.availability-warning :deep(.ant-alert) {
  flex: 1 1 auto;
}

.audit-trace {
  max-height: 60vh;
  padding: 12px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--muted);
  border-radius: 8px;
}

.examples,
.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.recent-questions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recent-questions__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  color: #4b5563;
  font-size: 14px;
  font-weight: 500;
}

.recent-questions__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.recent-question {
  max-width: 100%;
  height: 32px;
  padding: 0 12px;
  overflow: hidden;
  color: #4b5563;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #f7f9fc;
  border-color: #e5e7eb;
  border-radius: 16px;
}

.recent-question:hover,
.recent-question:focus-visible {
  color: #1677ff;
  background: #f0f7ff;
  border-color: #91caff;
}

.load-more-history {
  align-self: flex-start;
  padding-inline: 0;
}

.result-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 10px;
}

.result-headline {
  font-size: 15px;
  line-height: 1.6;
}

.knowledge-sources {
  display: grid;
  gap: 8px;
  padding-left: 20px;
  margin: 8px 0 0;
}

.knowledge-sources li {
  line-height: 1.6;
}

.knowledge-sources p {
  margin: 2px 0 0;
  color: #8c5f00;
}

.knowledge-source-unverified {
  color: #ad6800;
  font-weight: 600;
}

.cards {
  gap: 16px;
}

.cards article {
  min-width: 200px;
  padding: 16px;
  color: #243247;
  background: #f5f8fc;
  border-radius: 8px;
}

.cards strong {
  display: block;
  font-size: 28px;
}

.cards small {
  font-size: 14px;
}

.chart {
  height: 280px;
}

.composer {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  margin-top: auto;
}

.assistant-layout--drawer .composer {
  position: sticky;
  bottom: 0;
  z-index: 1;
  flex: 0 0 auto;
  padding: 12px 4px;
  background: var(--background);
  border-top: 1px solid var(--border);
}

.composer textarea {
  flex: 1;
}

@media (max-width: 760px) {
  .assistant-layout--page {
    grid-template-columns: 1fr;
  }

  .assistant-sidebar {
    max-height: 160px;
    border-right: 0;
  }

  .assistant-layout--page .assistant-main {
    padding: 0;
  }

  .result-panel {
    padding: 14px;
  }
}
</style>
