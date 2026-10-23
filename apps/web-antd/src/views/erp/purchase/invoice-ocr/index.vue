<script lang="ts" setup>
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';
import type { ErpPurchaseInvoiceOcrApi } from '#/api/erp/purchase/invoice-ocr';

import { computed, onMounted, reactive, ref } from 'vue';

import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { downloadFileFromBlobPart } from '@vben/utils';

import {
  Empty,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Spin,
  Table,
  Tabs,
  Tag,
} from 'ant-design-vue';

import { ACTION_ICON, TableAction } from '#/adapter/vxe-table';
import {
  confirmPurchaseInvoiceOcrBatch,
  exportPurchaseInvoiceOcrErrors,
  getPurchaseInvoiceOcrBatch,
  getPurchaseInvoiceOcrBatchPage,
  matchPurchaseInvoiceOcrBatch,
  PURCHASE_INVOICE_OCR_BATCH_STATUS,
  PURCHASE_INVOICE_OCR_ITEM_STATUS,
  recognizePurchaseInvoiceOcrBatch,
  updatePurchaseInvoiceOcrItemFactoryOrderNo,
} from '#/api/erp/purchase/invoice-ocr';

import UploadModal from './modules/upload-modal.vue';

defineOptions({ name: 'ErpPurchaseInvoiceOcr' });

type OcrBatch = ErpPurchaseInvoiceOcrApi.Batch;
type OcrItem = ErpPurchaseInvoiceOcrApi.Item;

interface FactorySummaryRow {
  factoryOrderNo: string;
  invoiceCount: number;
  invoiceTotalAmount: number;
  itemStatuses: string[];
  matchedPurchaseInNos?: string;
  purchaseInTotalAmount?: number;
  diffAmount?: number;
  errorMsg?: string;
}

const batchIdInput = ref<number>();
const batch = ref<OcrBatch>();
const activeTab = ref('workbench');
const pageLoading = ref(false);
const batchPageLoading = ref(false);
const batchPageRows = ref<OcrBatch[]>([]);
const batchPageTotal = ref(0);
const batchPageQuery = reactive({
  batchNo: '',
  pageNo: 1,
  pageSize: 10,
  remark: '',
  status: undefined as string | undefined,
});
const actionLoading = ref('');
const editFactoryOrderNoOpen = ref(false);
const editFactoryOrderNoSaving = ref(false);
const editingItem = ref<OcrItem>();
const factoryOrderNoInput = ref('');
const rawJsonOpen = ref(false);
const rawJsonTitle = ref('');
const rawJsonContent = ref('');

const [UploadModalComponent, uploadModalApi] = useVbenModal({
  connectedComponent: UploadModal,
  destroyOnClose: true,
});

const batchColumns: TableColumnsType<OcrBatch> = [
  { title: '批次号', dataIndex: 'batchNo', key: 'batchNo', width: 190 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 96 },
  {
    title: '文件',
    dataIndex: 'fileCount',
    key: 'fileCount',
    width: 64,
    align: 'right',
  },
  { title: '更新时间', dataIndex: 'updateTime', key: 'updateTime', width: 155 },
  {
    title: '操作',
    dataIndex: 'action',
    key: 'action',
    width: 72,
    fixed: 'right',
  },
];

const itemColumns: TableColumnsType<OcrItem> = [
  {
    title: '文件名',
    dataIndex: 'fileName',
    key: 'fileName',
    width: 190,
    fixed: 'left',
  },
  { title: '状态', dataIndex: 'status', key: 'status', width: 118 },
  {
    title: '厂家单号',
    dataIndex: 'factoryOrderNo',
    key: 'factoryOrderNo',
    width: 140,
  },
  {
    title: '发票金额',
    dataIndex: 'totalAmount',
    key: 'totalAmount',
    width: 110,
    align: 'right',
  },
  { title: '发票号', dataIndex: 'invoiceNo', key: 'invoiceNo', width: 150 },
  {
    title: '开票日期',
    dataIndex: 'invoiceDate',
    key: 'invoiceDate',
    width: 110,
  },
  {
    title: '备注',
    dataIndex: 'invoiceRemark',
    key: 'invoiceRemark',
    width: 220,
  },
  {
    title: '匹配入库单',
    dataIndex: 'matchedPurchaseInNos',
    key: 'matchedPurchaseInNos',
    width: 180,
  },
  {
    title: '入库金额',
    dataIndex: 'purchaseInTotalAmount',
    key: 'purchaseInTotalAmount',
    width: 110,
    align: 'right',
  },
  {
    title: '差额',
    dataIndex: 'diffAmount',
    key: 'diffAmount',
    width: 100,
    align: 'right',
  },
  {
    title: '生成票据ID',
    dataIndex: 'generatedInvoiceId',
    key: 'generatedInvoiceId',
    width: 120,
  },
  { title: '异常信息', dataIndex: 'errorMsg', key: 'errorMsg', width: 240 },
  {
    title: '附件',
    dataIndex: 'fileUrl',
    key: 'fileUrl',
    width: 80,
    fixed: 'right',
  },
  {
    title: '操作',
    dataIndex: 'action',
    key: 'action',
    width: 150,
    fixed: 'right',
  },
];

const summaryColumns: TableColumnsType<FactorySummaryRow> = [
  {
    title: '厂家单号',
    dataIndex: 'factoryOrderNo',
    key: 'factoryOrderNo',
    width: 160,
    fixed: 'left',
  },
  {
    title: '发票张数',
    dataIndex: 'invoiceCount',
    key: 'invoiceCount',
    width: 90,
    align: 'right',
  },
  {
    title: '发票合计',
    dataIndex: 'invoiceTotalAmount',
    key: 'invoiceTotalAmount',
    width: 120,
    align: 'right',
  },
  { title: '状态', dataIndex: 'itemStatuses', key: 'itemStatuses', width: 150 },
  {
    title: '匹配入库单',
    dataIndex: 'matchedPurchaseInNos',
    key: 'matchedPurchaseInNos',
    width: 220,
  },
  {
    title: '入库合计',
    dataIndex: 'purchaseInTotalAmount',
    key: 'purchaseInTotalAmount',
    width: 120,
    align: 'right',
  },
  {
    title: '差额',
    dataIndex: 'diffAmount',
    key: 'diffAmount',
    width: 110,
    align: 'right',
  },
  { title: '异常信息', dataIndex: 'errorMsg', key: 'errorMsg', width: 260 },
];

const items = computed(() => batch.value?.items ?? []);
const currentBatchId = computed(() => batch.value?.id);
const currentStatus = computed(() => batch.value?.status || '');
const batchPagination = computed<TablePaginationConfig>(() => ({
  current: batchPageQuery.pageNo,
  pageSize: batchPageQuery.pageSize,
  showSizeChanger: true,
  showTotal: (total) => `共 ${total} 个批次`,
  size: 'small',
  total: batchPageTotal.value,
}));
const batchStatusOptions = computed(() =>
  Object.values(PURCHASE_INVOICE_OCR_BATCH_STATUS).map((status) => ({
    label: getBatchStatusMeta(status).label,
    value: status,
  })),
);
const canRecognize = computed(() =>
  [
    PURCHASE_INVOICE_OCR_BATCH_STATUS.DRAFT,
    PURCHASE_INVOICE_OCR_BATCH_STATUS.FAILED,
    PURCHASE_INVOICE_OCR_BATCH_STATUS.RECOGNIZED,
  ].includes(currentStatus.value as any),
);
const canMatch = computed(() =>
  [
    PURCHASE_INVOICE_OCR_BATCH_STATUS.RECOGNIZED,
    PURCHASE_INVOICE_OCR_BATCH_STATUS.MATCHED,
  ].includes(currentStatus.value as any),
);
const canConfirm = computed(
  () => currentStatus.value === PURCHASE_INVOICE_OCR_BATCH_STATUS.MATCHED,
);

const processSteps = computed(() => {
  const status = currentStatus.value;
  return [
    {
      key: 'upload',
      label: '上传',
      status: batch.value ? 'done' : 'waiting',
      text: batch.value
        ? `${batchStats.value.fileCount} 个文件已入批次`
        : '等待选择发票文件',
    },
    {
      key: 'recognize',
      label: '识别',
      status: getStepStatus(
        status,
        [
          PURCHASE_INVOICE_OCR_BATCH_STATUS.RECOGNIZED,
          PURCHASE_INVOICE_OCR_BATCH_STATUS.MATCHED,
          PURCHASE_INVOICE_OCR_BATCH_STATUS.CONFIRMED,
        ],
        PURCHASE_INVOICE_OCR_BATCH_STATUS.RECOGNIZING,
      ),
      text: getRecognizeStepText(status),
    },
    {
      key: 'match',
      label: '匹配',
      status: getStepStatus(
        status,
        [
          PURCHASE_INVOICE_OCR_BATCH_STATUS.MATCHED,
          PURCHASE_INVOICE_OCR_BATCH_STATUS.CONFIRMED,
        ],
        PURCHASE_INVOICE_OCR_BATCH_STATUS.RECOGNIZED,
      ),
      text: getMatchStepText(status),
    },
    {
      key: 'confirm',
      label: '生成',
      status:
        status === PURCHASE_INVOICE_OCR_BATCH_STATUS.CONFIRMED
          ? 'done'
          : status === PURCHASE_INVOICE_OCR_BATCH_STATUS.MATCHED
            ? 'active'
            : 'waiting',
      text:
        status === PURCHASE_INVOICE_OCR_BATCH_STATUS.CONFIRMED
          ? '采购票据已生成'
          : '匹配无误后可确认生成',
    },
  ];
});

const batchStats = computed(() => {
  const totalAmount = items.value.reduce(
    (sum, item) => sum + toNumber(item.totalAmount),
    0,
  );
  const abnormalCount = items.value.filter((item) =>
    isAbnormalItemStatus(item.status),
  ).length;
  const matchedCount = items.value.filter(
    (item) => item.status === PURCHASE_INVOICE_OCR_ITEM_STATUS.MATCHED,
  ).length;
  const confirmedCount = items.value.filter(
    (item) => item.status === PURCHASE_INVOICE_OCR_ITEM_STATUS.CONFIRMED,
  ).length;
  return {
    abnormalCount,
    confirmedCount,
    fileCount: batch.value?.fileCount ?? items.value.length,
    matchedCount,
    totalAmount,
  };
});

const abnormalItems = computed(() =>
  items.value.filter(
    (item) => item.errorMsg || isAbnormalItemStatus(item.status),
  ),
);

const matchedFactoryCount = computed(
  () =>
    factorySummaryRows.value.filter(
      (row) =>
        getSummaryStatus(row) === PURCHASE_INVOICE_OCR_ITEM_STATUS.MATCHED ||
        getSummaryStatus(row) === PURCHASE_INVOICE_OCR_ITEM_STATUS.CONFIRMED,
    ).length,
);

const factorySummaryRows = computed<FactorySummaryRow[]>(() => {
  const map = new Map<string, FactorySummaryRow>();
  for (const item of items.value) {
    const factoryOrderNo = item.factoryOrderNo?.trim();
    if (!factoryOrderNo) continue;
    const row =
      map.get(factoryOrderNo) ??
      ({
        factoryOrderNo,
        invoiceCount: 0,
        invoiceTotalAmount: 0,
        itemStatuses: [],
      } as FactorySummaryRow);
    row.invoiceCount += 1;
    row.invoiceTotalAmount += toNumber(item.totalAmount);
    row.itemStatuses.push(item.status || '');
    row.matchedPurchaseInNos ||= item.matchedPurchaseInNos;
    row.purchaseInTotalAmount ??=
      item.purchaseInTotalAmount === undefined
        ? undefined
        : toNumber(item.purchaseInTotalAmount);
    row.diffAmount ??=
      item.diffAmount === undefined ? undefined : toNumber(item.diffAmount);
    row.errorMsg ||= item.errorMsg;
    map.set(factoryOrderNo, row);
  }
  return [...map.values()];
});

function toNumber(value?: number | string) {
  if (value === undefined || value === null || value === '') return 0;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatAmount(value?: number | string) {
  if (value === undefined || value === null || value === '') return '-';
  return Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatFileSize(value?: number) {
  if (!value) return '-';
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`;
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

function isAbnormalItemStatus(status?: string) {
  return [
    PURCHASE_INVOICE_OCR_ITEM_STATUS.OCR_FAILED,
    PURCHASE_INVOICE_OCR_ITEM_STATUS.NO_FACTORY_NO,
    PURCHASE_INVOICE_OCR_ITEM_STATUS.NO_PURCHASE_IN,
    PURCHASE_INVOICE_OCR_ITEM_STATUS.AMOUNT_DIFF,
  ].includes(status as any);
}

function getStepStatus(
  status: string,
  doneStatuses: string[],
  activeStatus: string,
) {
  if (!batch.value) return 'waiting';
  if (doneStatuses.includes(status)) return 'done';
  if (status === activeStatus) return 'active';
  if (status === PURCHASE_INVOICE_OCR_BATCH_STATUS.FAILED) return 'error';
  return 'waiting';
}

function getRecognizeStepText(status: string) {
  if (!batch.value) return '上传后自动开始 OCR';
  if (status === PURCHASE_INVOICE_OCR_BATCH_STATUS.RECOGNIZING)
    return '正在识别发票字段';
  if (status === PURCHASE_INVOICE_OCR_BATCH_STATUS.FAILED)
    return '识别失败，请查看明细';
  if (
    [
      PURCHASE_INVOICE_OCR_BATCH_STATUS.RECOGNIZED,
      PURCHASE_INVOICE_OCR_BATCH_STATUS.MATCHED,
      PURCHASE_INVOICE_OCR_BATCH_STATUS.CONFIRMED,
    ].includes(status as any)
  )
    return '金额和备注已解析';
  return '等待识别';
}

function getMatchStepText(status: string) {
  if (!batch.value) return '识别后按厂家单号汇总';
  if (status === PURCHASE_INVOICE_OCR_BATCH_STATUS.MATCHED)
    return '入库金额已核对';
  if (status === PURCHASE_INVOICE_OCR_BATCH_STATUS.CONFIRMED)
    return '匹配结果已生成票据';
  if (status === PURCHASE_INVOICE_OCR_BATCH_STATUS.RECOGNIZED) {
    return abnormalItems.value.length > 0 ? '存在待处理异常' : '可重新匹配入库';
  }
  return '等待匹配';
}

function getBatchStatusMeta(status?: string) {
  const map: Record<string, { color: string; label: string }> = {
    DRAFT: { color: 'default', label: '待识别' },
    RECOGNIZING: { color: 'processing', label: '识别中' },
    RECOGNIZED: { color: 'blue', label: '已识别' },
    MATCHED: { color: 'green', label: '已匹配' },
    CONFIRMED: { color: 'purple', label: '已确认' },
    FAILED: { color: 'red', label: '识别失败' },
  };
  return map[status || ''] ?? { color: 'default', label: status || '-' };
}

function getItemStatusMeta(status?: string) {
  const map: Record<string, { color: string; label: string }> = {
    PENDING: { color: 'blue', label: '待匹配' },
    OCR_FAILED: { color: 'red', label: '识别失败' },
    NO_FACTORY_NO: { color: 'orange', label: '无厂家单号' },
    NO_PURCHASE_IN: { color: 'orange', label: '无入库单' },
    AMOUNT_DIFF: { color: 'red', label: '金额不一致' },
    MATCHED: { color: 'green', label: '已匹配' },
    CONFIRMED: { color: 'purple', label: '已生成票据' },
    IGNORED: { color: 'default', label: '已忽略' },
  };
  return map[status || ''] ?? { color: 'default', label: status || '-' };
}

function getSummaryStatus(row: FactorySummaryRow | Record<string, any>) {
  const summaryRow = row as FactorySummaryRow;
  const statuses = new Set(summaryRow.itemStatuses.filter(Boolean));
  if (statuses.has(PURCHASE_INVOICE_OCR_ITEM_STATUS.AMOUNT_DIFF)) {
    return PURCHASE_INVOICE_OCR_ITEM_STATUS.AMOUNT_DIFF;
  }
  if (statuses.has(PURCHASE_INVOICE_OCR_ITEM_STATUS.NO_PURCHASE_IN)) {
    return PURCHASE_INVOICE_OCR_ITEM_STATUS.NO_PURCHASE_IN;
  }
  if (statuses.has(PURCHASE_INVOICE_OCR_ITEM_STATUS.MATCHED)) {
    return PURCHASE_INVOICE_OCR_ITEM_STATUS.MATCHED;
  }
  if (statuses.has(PURCHASE_INVOICE_OCR_ITEM_STATUS.CONFIRMED)) {
    return PURCHASE_INVOICE_OCR_ITEM_STATUS.CONFIRMED;
  }
  return [...statuses][0] || '';
}

function getSummaryRowKey(row: FactorySummaryRow | Record<string, any>) {
  return String((row as FactorySummaryRow).factoryOrderNo || '');
}

function getItemRowKey(row: OcrItem | Record<string, any>, index?: number) {
  const item = row as OcrItem;
  return (
    item.id ?? item.fileUrl ?? item.fileName ?? `invoice-ocr-item-${index ?? 0}`
  );
}

function canEditFactoryOrderNo(item: OcrItem) {
  return (
    !!item.id &&
    !!item.totalAmount &&
    item.status !== PURCHASE_INVOICE_OCR_ITEM_STATUS.OCR_FAILED &&
    item.status !== PURCHASE_INVOICE_OCR_ITEM_STATUS.CONFIRMED &&
    item.status !== PURCHASE_INVOICE_OCR_ITEM_STATUS.IGNORED &&
    !item.generatedInvoiceId &&
    currentStatus.value !== PURCHASE_INVOICE_OCR_BATCH_STATUS.RECOGNIZING &&
    currentStatus.value !== PURCHASE_INVOICE_OCR_BATCH_STATUS.CONFIRMED
  );
}

function openUploadModal() {
  uploadModalApi.open();
}

function openEditFactoryOrderNo(item: OcrItem) {
  editingItem.value = item;
  factoryOrderNoInput.value =
    item.factoryOrderNo || item.parsedFactoryOrderNo || '';
  editFactoryOrderNoOpen.value = true;
}

function openRawJson(item: OcrItem) {
  rawJsonTitle.value = item.fileName
    ? `OCR 原始结果 - ${item.fileName}`
    : 'OCR 原始结果';
  rawJsonContent.value = formatRawJson(item.rawJson);
  rawJsonOpen.value = true;
}

function formatRawJson(value?: string) {
  if (!value) return '';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

async function handleUploadSuccess(batchId: number) {
  batchIdInput.value = batchId;
  activeTab.value = 'workbench';
  await loadBatchPage();
  await loadBatch(batchId);
}

async function handleBatchSearch() {
  batchPageQuery.pageNo = 1;
  await loadBatchPage();
}

async function handleBatchReset() {
  batchPageQuery.batchNo = '';
  batchPageQuery.remark = '';
  batchPageQuery.status = undefined;
  batchPageQuery.pageNo = 1;
  await loadBatchPage();
}

async function handleBatchTableChange(pagination: TablePaginationConfig) {
  batchPageQuery.pageNo = Number(pagination.current || 1);
  batchPageQuery.pageSize = Number(pagination.pageSize || 10);
  await loadBatchPage();
}

async function openBatchFromList(row: OcrBatch) {
  if (!row.id) return;
  batchIdInput.value = row.id;
  activeTab.value = 'workbench';
  await loadBatch(row.id);
}

async function handleLoadBatch() {
  if (!batchIdInput.value) {
    message.warning('请输入批次 ID');
    return;
  }
  await loadBatch(batchIdInput.value);
}

async function refreshCurrentBatch() {
  if (!currentBatchId.value) return;
  await loadBatch(currentBatchId.value);
  await loadBatchPage();
}

async function loadBatchPage() {
  batchPageLoading.value = true;
  try {
    const result = await getPurchaseInvoiceOcrBatchPage({
      batchNo: batchPageQuery.batchNo || undefined,
      pageNo: batchPageQuery.pageNo,
      pageSize: batchPageQuery.pageSize,
      remark: batchPageQuery.remark || undefined,
      status: batchPageQuery.status,
    });
    batchPageRows.value = result.list ?? [];
    batchPageTotal.value = Number(result.total || 0);
  } finally {
    batchPageLoading.value = false;
  }
}

async function loadBatch(batchId: number) {
  pageLoading.value = true;
  try {
    batch.value = await getPurchaseInvoiceOcrBatch(batchId);
  } finally {
    pageLoading.value = false;
  }
}

async function handleExportErrors() {
  if (!currentBatchId.value) {
    message.warning('请先上传或打开一个发票批次');
    return;
  }
  actionLoading.value = 'export';
  try {
    const data = await exportPurchaseInvoiceOcrErrors(currentBatchId.value);
    downloadFileFromBlobPart({
      fileName: '采购发票识别异常.xls',
      source: data,
    });
  } finally {
    actionLoading.value = '';
  }
}

async function submitEditFactoryOrderNo() {
  if (!editingItem.value?.id) return;
  const factoryOrderNo = factoryOrderNoInput.value.trim();
  if (!factoryOrderNo) {
    message.warning('请输入厂家单号');
    return;
  }
  if (!factoryOrderNo.startsWith('S')) {
    message.warning('厂家单号必须以 S 开头');
    return;
  }
  editFactoryOrderNoSaving.value = true;
  try {
    await updatePurchaseInvoiceOcrItemFactoryOrderNo(editingItem.value.id, {
      factoryOrderNo,
    });
    message.success('厂家单号已修正并重新匹配');
    editFactoryOrderNoOpen.value = false;
    await refreshCurrentBatch();
  } finally {
    editFactoryOrderNoSaving.value = false;
  }
}

function runBatchAction(type: 'confirm' | 'match' | 'recognize') {
  if (!currentBatchId.value) {
    message.warning('请先上传或打开一个发票批次');
    return;
  }
  const actionMap = {
    recognize: {
      title: '发起 OCR 识别',
      content: '系统将逐个调用 OCR 接口识别本批次内的发票文件。',
      loading: 'recognize',
      request: recognizePurchaseInvoiceOcrBatch,
      success: '识别完成',
    },
    match: {
      title: '发起入库匹配',
      content: '系统将按厂家单号汇总发票金额，并和已审核采购入库单金额比较。',
      loading: 'match',
      request: matchPurchaseInvoiceOcrBatch,
      success: '匹配完成',
    },
    confirm: {
      title: '确认生成采购票据',
      content: '系统会按厂家单号生成待审核采购票据，生成后本批次不可重复确认。',
      loading: 'confirm',
      request: confirmPurchaseInvoiceOcrBatch,
      success: '采购票据已生成',
    },
  }[type];
  Modal.confirm({
    title: actionMap.title,
    content: actionMap.content,
    okText: '确认',
    cancelText: '取消',
    async onOk() {
      actionLoading.value = actionMap.loading;
      try {
        await actionMap.request(currentBatchId.value!);
        message.success(actionMap.success);
        await refreshCurrentBatch();
      } finally {
        actionLoading.value = '';
      }
    },
  });
}

onMounted(() => {
  void loadBatchPage();
});
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【采购】发票识别与入库匹配"
        url="https://doc.iocoder.cn/erp/purchase/"
      />
    </template>

    <UploadModalComponent @success="handleUploadSuccess" />
    <Modal
      v-model:open="editFactoryOrderNoOpen"
      :confirm-loading="editFactoryOrderNoSaving"
      title="修正厂家单号"
      ok-text="保存并重新匹配"
      @ok="submitEditFactoryOrderNo"
    >
      <Input
        v-model:value="factoryOrderNoInput"
        allow-clear
        placeholder="请输入以 S 开头的厂家单号"
        @press-enter="submitEditFactoryOrderNo"
      />
    </Modal>
    <Modal
      v-model:open="rawJsonOpen"
      :footer="null"
      :title="rawJsonTitle"
      width="860px"
    >
      <pre class="invoice-ocr-raw-json">{{
        rawJsonContent || '暂无 OCR 原始结果'
      }}</pre>
    </Modal>

    <div class="invoice-ocr-page">
      <section class="invoice-ocr-shell-head">
        <div>
          <span class="invoice-ocr-kicker">Purchase invoice desk</span>
          <h1>采购发票识别</h1>
          <p>上传发票后自动完成 OCR 识别和入库匹配，异常集中在当前批次处理。</p>
        </div>
        <TableAction
          :actions="[
            {
              label: 'OCR识别',
              icon: 'lucide:scan-text',
              disabled: !currentBatchId || !canRecognize || !!actionLoading,
              auth: ['erp:purchase-invoice-ocr:recognize'],
              onClick: () => runBatchAction('recognize'),
            },
            {
              label: '匹配入库',
              icon: 'lucide:git-compare',
              disabled: !currentBatchId || !canMatch || !!actionLoading,
              auth: ['erp:purchase-invoice-ocr:match'],
              onClick: () => runBatchAction('match'),
            },
            {
              label: '导出异常',
              icon: ACTION_ICON.DOWNLOAD,
              disabled:
                !currentBatchId ||
                abnormalItems.length === 0 ||
                !!actionLoading,
              auth: ['erp:purchase-invoice-ocr:export'],
              onClick: handleExportErrors,
            },
            {
              label: '确认生成',
              type: 'primary',
              icon: ACTION_ICON.AUDIT,
              disabled: !currentBatchId || !canConfirm || !!actionLoading,
              auth: ['erp:purchase-invoice-ocr:confirm'],
              onClick: () => runBatchAction('confirm'),
            },
          ]"
        />
      </section>

      <Tabs v-model:active-key="activeTab" class="invoice-ocr-tabs">
        <Tabs.TabPane key="workbench" tab="识别工作台">
          <div class="invoice-ocr-workbench">
            <section class="invoice-ocr-command-center">
              <div class="invoice-ocr-intake">
                <div class="invoice-ocr-intake__copy">
                  <span class="invoice-ocr-kicker">发票 OCR / 入库核对</span>
                  <h2>上传后自动识别并匹配入库</h2>
                  <p>
                    备注首段以 S
                    开头的厂家单号会被自动解析，同一厂家单号下的发票金额会合并核对。
                  </p>
                </div>
                <div class="invoice-ocr-intake__actions">
                  <TableAction
                    :actions="[
                      {
                        label: '上传发票',
                        type: 'primary',
                        icon: ACTION_ICON.UPLOAD,
                        auth: ['erp:purchase-invoice-ocr:upload'],
                        onClick: openUploadModal,
                      },
                      {
                        label: '刷新当前批次',
                        icon: ACTION_ICON.REFRESH,
                        disabled: !currentBatchId || pageLoading,
                        auth: ['erp:purchase-invoice-ocr:query'],
                        onClick: refreshCurrentBatch,
                      },
                    ]"
                  />
                  <div class="invoice-ocr-open-batch">
                    <InputNumber
                      v-model:value="batchIdInput"
                      :min="1"
                      :precision="0"
                      placeholder="批次 ID"
                      @press-enter="handleLoadBatch"
                    />
                    <TableAction
                      :actions="[
                        {
                          label: '打开',
                          icon: ACTION_ICON.SEARCH,
                          auth: ['erp:purchase-invoice-ocr:query'],
                          onClick: handleLoadBatch,
                        },
                      ]"
                    />
                  </div>
                </div>
              </div>

              <div class="invoice-ocr-process">
                <div
                  v-for="step in processSteps"
                  :key="step.key"
                  :class="['invoice-ocr-process__step', `is-${step.status}`]"
                >
                  <span class="invoice-ocr-process__dot">
                    <IconifyIcon
                      :icon="
                        step.status === 'done'
                          ? 'lucide:check'
                          : step.status === 'error'
                            ? 'lucide:triangle-alert'
                            : 'lucide:circle'
                      "
                    />
                  </span>
                  <div>
                    <strong>{{ step.label }}</strong>
                    <small>{{ step.text }}</small>
                  </div>
                </div>
              </div>
            </section>

            <Spin :spinning="pageLoading || !!actionLoading">
              <section v-if="!batch" class="invoice-ocr-empty-panel">
                <Empty description="上传发票后自动查看识别与匹配结果" />
              </section>
              <template v-else>
                <section class="invoice-ocr-batch-strip">
                  <div class="invoice-ocr-batch-strip__main">
                    <div class="invoice-ocr-batch-no">
                      {{ batch.batchNo || `#${batch.id}` }}
                    </div>
                    <Tag :color="getBatchStatusMeta(batch.status).color">
                      {{ getBatchStatusMeta(batch.status).label }}
                    </Tag>
                    <span v-if="batch.errorMsg" class="invoice-ocr-error">{{
                      batch.errorMsg
                    }}</span>
                  </div>
                  <div class="invoice-ocr-batch-strip__meta">
                    <span>文件 {{ batchStats.fileCount }}</span>
                    <span>金额 {{ formatAmount(batchStats.totalAmount) }}</span>
                    <span>已匹配 {{ batchStats.matchedCount }}</span>
                    <span>异常 {{ batchStats.abnormalCount }}</span>
                    <span
                      >已生成
                      {{
                        batch.generatedInvoiceCount || batchStats.confirmedCount
                      }}</span
                    >
                  </div>
                </section>

                <section class="invoice-ocr-metrics">
                  <div class="invoice-ocr-metric invoice-ocr-metric--primary">
                    <span>发票合计</span>
                    <strong>{{ formatAmount(batchStats.totalAmount) }}</strong>
                  </div>
                  <div class="invoice-ocr-metric">
                    <span>厂家单号</span>
                    <strong>{{ factorySummaryRows.length }}</strong>
                  </div>
                  <div class="invoice-ocr-metric">
                    <span>匹配成功</span>
                    <strong>{{ matchedFactoryCount }}</strong>
                  </div>
                  <div class="invoice-ocr-metric invoice-ocr-metric--warn">
                    <span>异常明细</span>
                    <strong>{{ abnormalItems.length }}</strong>
                  </div>
                </section>

                <section
                  v-if="abnormalItems.length > 0"
                  class="invoice-ocr-alert-band"
                >
                  <IconifyIcon icon="lucide:circle-alert" />
                  <span>
                    当前批次存在
                    {{ abnormalItems.length }} 条异常，请优先查看“异常信息”列。
                  </span>
                </section>

                <section class="invoice-ocr-section">
                  <div class="invoice-ocr-section__head">
                    <h3>厂家单号汇总</h3>
                    <span>按同一厂家单号汇总本批次发票金额</span>
                  </div>
                  <Table
                    :columns="summaryColumns"
                    :data-source="factorySummaryRows"
                    :pagination="false"
                    :row-key="getSummaryRowKey"
                    :scroll="{ x: 'max-content' }"
                    size="small"
                  >
                    <template #bodyCell="{ column, record }">
                      <template v-if="column.key === 'invoiceTotalAmount'">
                        {{ formatAmount(record.invoiceTotalAmount) }}
                      </template>
                      <template
                        v-else-if="column.key === 'purchaseInTotalAmount'"
                      >
                        {{ formatAmount(record.purchaseInTotalAmount) }}
                      </template>
                      <template v-else-if="column.key === 'diffAmount'">
                        <span
                          :class="{
                            'invoice-ocr-diff-danger':
                              Math.abs(record.diffAmount || 0) > 0,
                          }"
                        >
                          {{ formatAmount(record.diffAmount) }}
                        </span>
                      </template>
                      <template v-else-if="column.key === 'itemStatuses'">
                        <Tag
                          :color="
                            getItemStatusMeta(getSummaryStatus(record)).color
                          "
                        >
                          {{
                            getItemStatusMeta(getSummaryStatus(record)).label
                          }}
                        </Tag>
                      </template>
                    </template>
                  </Table>
                </section>

                <section class="invoice-ocr-section invoice-ocr-section--fill">
                  <div class="invoice-ocr-section__head">
                    <h3>发票明细</h3>
                    <span>OCR 识别、厂家单号解析与入库匹配结果</span>
                  </div>
                  <Table
                    :columns="itemColumns"
                    :data-source="items"
                    :pagination="{ pageSize: 20, showSizeChanger: true }"
                    :row-key="getItemRowKey"
                    :scroll="{ x: 'max-content', y: 'calc(100vh - 560px)' }"
                    size="small"
                  >
                    <template #bodyCell="{ column, record }">
                      <template v-if="column.key === 'status'">
                        <Tag :color="getItemStatusMeta(record.status).color">
                          {{ getItemStatusMeta(record.status).label }}
                        </Tag>
                      </template>
                      <template v-else-if="column.key === 'totalAmount'">
                        {{ formatAmount(record.totalAmount) }}
                      </template>
                      <template
                        v-else-if="column.key === 'purchaseInTotalAmount'"
                      >
                        {{ formatAmount(record.purchaseInTotalAmount) }}
                      </template>
                      <template v-else-if="column.key === 'diffAmount'">
                        <span
                          :class="{
                            'invoice-ocr-diff-danger':
                              Math.abs(toNumber(record.diffAmount)) > 0,
                          }"
                        >
                          {{ formatAmount(record.diffAmount) }}
                        </span>
                      </template>
                      <template v-else-if="column.key === 'fileName'">
                        <div class="invoice-ocr-file-cell">
                          <span>{{ record.fileName || '-' }}</span>
                          <small>{{ formatFileSize(record.fileSize) }}</small>
                        </div>
                      </template>
                      <template v-else-if="column.key === 'fileUrl'">
                        <a
                          v-if="record.fileUrl"
                          :href="record.fileUrl"
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          查看
                        </a>
                        <span v-else>-</span>
                      </template>
                      <template v-else-if="column.key === 'action'">
                        <TableAction
                          :actions="[
                            {
                              label: '原始结果',
                              type: 'link',
                              icon: 'lucide:file-json',
                              disabled: !record.rawJson,
                              auth: ['erp:purchase-invoice-ocr:query'],
                              onClick: () => openRawJson(record),
                            },
                            {
                              label: '修正',
                              type: 'link',
                              icon: 'lucide:pencil',
                              disabled: !canEditFactoryOrderNo(record),
                              auth: [
                                'erp:purchase-invoice-ocr:update-factory-order-no',
                              ],
                              onClick: () => openEditFactoryOrderNo(record),
                            },
                          ]"
                        />
                      </template>
                    </template>
                  </Table>
                </section>
              </template>
            </Spin>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane key="history" tab="历史记录">
          <section class="invoice-ocr-history">
            <div class="invoice-ocr-history__head">
              <div>
                <span class="invoice-ocr-kicker">批次留痕</span>
                <h3>查看之前的识别记录</h3>
              </div>
              <TableAction
                :actions="[
                  {
                    label: '刷新',
                    type: 'link',
                    icon: ACTION_ICON.REFRESH,
                    disabled: batchPageLoading,
                    auth: ['erp:purchase-invoice-ocr:query'],
                    onClick: loadBatchPage,
                  },
                ]"
              />
            </div>
            <div class="invoice-ocr-history__filters">
              <Input
                v-model:value="batchPageQuery.batchNo"
                allow-clear
                placeholder="批次号"
                @press-enter="handleBatchSearch"
              />
              <Select
                v-model:value="batchPageQuery.status"
                :options="batchStatusOptions"
                allow-clear
                placeholder="状态"
              />
              <Input
                v-model:value="batchPageQuery.remark"
                allow-clear
                placeholder="备注"
                @press-enter="handleBatchSearch"
              />
              <TableAction
                :actions="[
                  {
                    label: '查询',
                    type: 'primary',
                    icon: ACTION_ICON.SEARCH,
                    auth: ['erp:purchase-invoice-ocr:query'],
                    onClick: handleBatchSearch,
                  },
                  {
                    label: '重置',
                    icon: 'lucide:rotate-ccw',
                    auth: ['erp:purchase-invoice-ocr:query'],
                    onClick: handleBatchReset,
                  },
                ]"
              />
            </div>
            <Table
              :columns="batchColumns"
              :data-source="batchPageRows"
              :loading="batchPageLoading"
              :pagination="batchPagination"
              :row-key="(row) => row.id || row.batchNo || ''"
              :scroll="{ x: 'max-content', y: 'calc(100vh - 360px)' }"
              size="small"
              @change="handleBatchTableChange"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'batchNo'">
                  <a @click="openBatchFromList(record)">
                    {{ record.batchNo || `#${record.id}` }}
                  </a>
                </template>
                <template v-else-if="column.key === 'status'">
                  <Tag :color="getBatchStatusMeta(record.status).color">
                    {{ getBatchStatusMeta(record.status).label }}
                  </Tag>
                </template>
                <template v-else-if="column.key === 'action'">
                  <TableAction
                    :actions="[
                      {
                        label: '打开',
                        type: 'link',
                        icon: ACTION_ICON.VIEW,
                        auth: ['erp:purchase-invoice-ocr:query'],
                        onClick: () => openBatchFromList(record),
                      },
                    ]"
                  />
                </template>
              </template>
            </Table>
          </section>
        </Tabs.TabPane>
      </Tabs>
    </div>
  </Page>
</template>

<style scoped>
.invoice-ocr-page {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: 12px;
  font-size: 12px;
}

.invoice-ocr-shell-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: linear-gradient(90deg, #f8fbfc 0%, #ffffff 52%, #f7faf7 100%);
}

.invoice-ocr-shell-head h1 {
  margin: 2px 0 4px;
  color: hsl(var(--foreground));
  font-size: 20px;
  font-weight: 750;
  line-height: 28px;
}

.invoice-ocr-shell-head p {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 18px;
}

.invoice-ocr-kicker {
  color: #0f766e;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.invoice-ocr-tabs {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.invoice-ocr-tabs :deep(.ant-tabs-nav) {
  margin: 0 0 12px;
}

.invoice-ocr-tabs :deep(.ant-tabs-content-holder),
.invoice-ocr-tabs :deep(.ant-tabs-content),
.invoice-ocr-tabs :deep(.ant-tabs-tabpane) {
  min-height: 0;
}

.invoice-ocr-history,
.invoice-ocr-workbench {
  min-height: 0;
}

.invoice-ocr-command-center {
  padding: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
}

.invoice-ocr-intake {
  display: grid;
  align-items: stretch;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
}

.invoice-ocr-intake__copy {
  position: relative;
  min-height: 104px;
  padding: 6px 210px 8px 4px;
  overflow: hidden;
}

.invoice-ocr-intake__copy::after {
  position: absolute;
  right: 8px;
  bottom: 4px;
  width: 180px;
  height: 48px;
  border: 1px dashed #7dd3fc;
  border-radius: 6px;
  background: repeating-linear-gradient(
    90deg,
    rgba(14, 116, 144, 12%) 0,
    rgba(14, 116, 144, 12%) 10px,
    transparent 10px,
    transparent 18px
  );
  content: '';
}

.invoice-ocr-intake__copy h2 {
  max-width: 660px;
  margin: 4px 0 8px;
  color: hsl(var(--foreground));
  font-size: 24px;
  font-weight: 780;
  line-height: 32px;
}

.invoice-ocr-intake__copy p {
  max-width: 640px;
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  line-height: 22px;
}

.invoice-ocr-intake__actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
  padding: 10px 4px 10px 18px;
  border-left: 1px solid hsl(var(--border));
}

.invoice-ocr-open-batch {
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.invoice-ocr-process {
  display: grid;
  gap: 0;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid hsl(var(--border));
}

.invoice-ocr-process__step {
  position: relative;
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding: 2px 12px;
}

.invoice-ocr-process__step:not(:last-child)::after {
  position: absolute;
  top: 15px;
  right: 8px;
  left: 48px;
  height: 1px;
  background: #dbeafe;
  content: '';
}

.invoice-ocr-process__dot {
  position: relative;
  z-index: 1;
  display: inline-flex;
  width: 26px;
  height: 26px;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 1px solid #cbd5e1;
  border-radius: 50%;
  color: #64748b;
}

.invoice-ocr-process__step strong,
.invoice-ocr-process__step small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.invoice-ocr-process__step strong {
  color: hsl(var(--foreground));
  line-height: 18px;
}

.invoice-ocr-process__step small {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  line-height: 16px;
}

.invoice-ocr-process__step.is-done {
  color: #166534;
}

.invoice-ocr-process__step.is-done .invoice-ocr-process__dot {
  border-color: #22c55e;
  background: #22c55e;
  color: #ffffff;
}

.invoice-ocr-process__step.is-active {
  color: #0e7490;
}

.invoice-ocr-process__step.is-active .invoice-ocr-process__dot {
  border-color: #0891b2;
  color: #0891b2;
}

.invoice-ocr-process__step.is-error {
  color: #b91c1c;
}

.invoice-ocr-process__step.is-error .invoice-ocr-process__dot {
  border-color: #ef4444;
  color: #ef4444;
}

.invoice-ocr-history {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  padding: 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--card));
}

.invoice-ocr-history__head {
  display: flex;
  min-height: 30px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.invoice-ocr-history__head h3 {
  margin: 2px 0 0;
  color: hsl(var(--foreground));
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
}

.invoice-ocr-history__filters {
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(180px, 1fr) minmax(150px, 180px) minmax(
      220px,
      1.3fr
    ) auto;
}

.invoice-ocr-workbench {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
}

.invoice-ocr-workbench :deep(.ant-spin-nested-loading),
.invoice-ocr-workbench :deep(.ant-spin-container) {
  min-height: 100%;
}

.invoice-ocr-workbench :deep(.ant-spin-container) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.invoice-ocr-empty-panel {
  display: flex;
  min-height: 252px;
  align-items: center;
  justify-content: center;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.invoice-ocr-batch-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 10px 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--card));
}

.invoice-ocr-batch-strip__main,
.invoice-ocr-batch-strip__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.invoice-ocr-batch-strip__meta {
  color: hsl(var(--muted-foreground));
}

.invoice-ocr-batch-no {
  color: hsl(var(--foreground));
  font-size: 15px;
  font-weight: 700;
}

.invoice-ocr-error,
.invoice-ocr-diff-danger {
  color: #cf1322;
}

.invoice-ocr-metrics {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.invoice-ocr-metric {
  display: flex;
  min-height: 62px;
  flex-direction: column;
  justify-content: center;
  padding: 10px 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--card));
}

.invoice-ocr-metric span {
  color: hsl(var(--muted-foreground));
  line-height: 18px;
}

.invoice-ocr-metric strong {
  margin-top: 2px;
  color: hsl(var(--foreground));
  font-size: 20px;
  line-height: 26px;
}

.invoice-ocr-metric--primary {
  border-color: #1677ff33;
  background: #f0f7ff;
}

.invoice-ocr-metric--warn {
  border-color: #fa8c1633;
  background: #fff7e8;
}

.invoice-ocr-alert-band {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid #ffd591;
  border-radius: 6px;
  background: #fff7e6;
  color: #ad4e00;
}

.invoice-ocr-section {
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--card));
}

.invoice-ocr-section--fill {
  flex: 1;
  min-height: 0;
}

.invoice-ocr-section__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px 12px;
  padding: 10px 12px;
  border-bottom: 1px solid hsl(var(--border));
}

.invoice-ocr-section__head h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
}

.invoice-ocr-section__head span {
  color: hsl(var(--muted-foreground));
}

.invoice-ocr-file-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.invoice-ocr-file-cell span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.invoice-ocr-file-cell small {
  color: hsl(var(--muted-foreground));
}

.invoice-ocr-raw-json {
  max-height: 62vh;
  margin: 0;
  padding: 12px;
  overflow: auto;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

:deep(.ant-table) {
  font-size: 12px;
}

:deep(.ant-table-thead > tr > th),
:deep(.ant-table-tbody > tr > td) {
  padding: 7px 8px;
}

:deep(.table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
}

@media (max-width: 900px) {
  .invoice-ocr-intake {
    grid-template-columns: 1fr;
  }

  .invoice-ocr-intake__copy {
    padding-right: 190px;
  }

  .invoice-ocr-intake__actions {
    padding: 12px 0 0;
    border-top: 1px solid hsl(var(--border));
    border-left: 0;
  }

  .invoice-ocr-process {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .invoice-ocr-process__step {
    padding: 4px 8px;
  }

  .invoice-ocr-process__step:not(:last-child)::after {
    display: none;
  }

  .invoice-ocr-history__filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .invoice-ocr-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .invoice-ocr-shell-head,
  .invoice-ocr-batch-strip {
    align-items: stretch;
    flex-direction: column;
  }

  .invoice-ocr-open-batch,
  .invoice-ocr-history__filters,
  .invoice-ocr-process {
    grid-template-columns: 1fr;
  }

  .invoice-ocr-intake__copy {
    min-height: 0;
    padding: 4px 0 0;
  }

  .invoice-ocr-intake__copy::after {
    display: none;
  }

  .invoice-ocr-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
