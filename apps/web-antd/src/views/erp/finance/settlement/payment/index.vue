<script lang="ts" setup>
import { provideFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpFinancePaymentApi } from '#/api/erp/finance/payment';

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

import { useAccess } from '@vben/access';
import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  batchUpdateFinancePayment,
  deleteFinancePayment,
  downloadFinancePaymentImportFailureDetails,
  exportFinancePayment,
  getFinancePaymentExportFields,
  getFinancePaymentImportTemplate,
  getFinancePaymentPage,
  getFinancePaymentSummary,
  importFinancePayment,
  updateFinancePaymentStatus,
} from '#/api/erp/finance/payment';
import { $t } from '#/locales';
import { useFieldPermission } from '#/composables/useFieldPermission';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import PrintTemplateModal from '#/views/erp/components/PrintTemplateModal.vue';
import PrintTemplateSelector from '#/views/erp/components/PrintTemplateSelector.vue';
import { useFinanceShortcut } from '#/views/erp/composables/useFinanceShortcut';
import FinanceListQuerySummary from '#/views/erp/finance/components/FinanceListQuerySummary.vue';
import { fitFinanceDocumentListColumnsToWidth } from '#/views/erp/finance/utils/document-list-table';
import { useFinanceQuerySummary } from '#/views/erp/finance/utils/use-finance-query-summary';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import { useErpPrintTemplate } from '#/views/erp/utils/print-template';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import BatchEditModal from '../../components/batch-edit-modal.vue';
import ImportModal from '../../components/import-modal.vue';
import WriteOffModal from '../components/writeoff-modal.vue';
import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import { formatFinancePaymentAmount } from './ui';
const { candidateSchema, candidatePagerConfig } =
  provideFinanceCandidateFocus();

defineOptions({ name: 'ErpFinanceSettlementPayment' });

const PRINT_TEMPLATE_MODULE = 'finance_payment';
const PRINT_MODULE_NAME = '付款单';

const checkedIds = ref<number[]>([]);
const checkedRows = ref<ErpFinancePaymentApi.FinancePayment[]>([]);
const pageRows = ref<ErpFinancePaymentApi.FinancePayment[]>([]);
const gridShellRef = ref<HTMLElement>();
const { hasAccessByCodes } = useAccess();
const { hiddenFields: paymentHiddenFields, isHidden: isPaymentFieldHidden } =
  useFieldPermission('erp_finance_payment');
const { hiddenFields: voucherHiddenFields, isHidden: isVoucherFieldHidden } =
  useFieldPermission('erp_voucher');
const accountingVoucherVisible = computed(
  () =>
    hasAccessByCodes(['erp:voucher:query']) &&
    !isVoucherFieldHidden('voucherNo'),
);

function getPaymentStatusLabel(status?: number) {
  if (status === 0) return '草稿';
  if (status === 10) return '待审核';
  if (status === 20) return '已审核';
  if (status === 30) return '已驳回';
  return '-';
}

function getPaymentStatusColor(status?: number) {
  if (status === 0) return 'blue';
  if (status === 10) return 'orange';
  if (status === 20) return 'green';
  if (status === 30) return 'red';
  return 'default';
}

const querySummaryState = useFinanceQuerySummary((params, signal) =>
  getFinancePaymentSummary(params, signal),
);
const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  if (!value) return [];
  const amount = (input?: null | number) =>
    input === null || input === undefined
      ? '****'
      : `￥${formatFinancePaymentAmount(input)}`;
  return [
    {
      key: 'documentCount',
      label: '单据数',
      value: `${value.documentCount ?? 0} 张`,
    },
    { key: 'totalPrice', label: '应付金额', value: amount(value.totalPrice) },
    {
      key: 'discountPrice',
      label: '优惠金额',
      value: amount(value.discountPrice),
    },
    {
      key: 'paymentPrice',
      label: '实付金额',
      value: amount(value.paymentPrice),
    },
  ];
});

const exportActionLabel = computed(() =>
  checkedIds.value.length > 0
    ? `导出选中 ${checkedIds.value.length} 条`
    : '导出',
);

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: false,
});

const [ImportFormModal, importFormModalApi] = useVbenModal({
  connectedComponent: ImportModal,
  destroyOnClose: true,
});

const [ExportFieldModal, exportFieldModalApi] = useVbenModal({
  connectedComponent: ExportFieldModalComponent,
  destroyOnClose: true,
});

const [BatchEditFormModal, batchEditFormModalApi] = useVbenModal({
  connectedComponent: BatchEditModal,
  destroyOnClose: true,
});

const [WriteOffFormModal, writeOffFormModalApi] = useVbenModal({
  connectedComponent: WriteOffModal,
  destroyOnClose: true,
});

const [PrintTemplateDesignModal, printTemplateDesignModalApi] = useVbenModal({
  connectedComponent: PrintTemplateModal,
  destroyOnClose: true,
});

function handleRefresh() {
  querySummaryState.invalidate();
  gridApi.query();
}

function openFinancePrintModal(data: {
  businessId?: number | string;
  businessNo?: string;
  moduleKey: string;
  moduleName: string;
  templateId?: number | string;
}) {
  printTemplateDesignModalApi.setData(data).open();
}

const {
  cancelTemplateSelect,
  confirmTemplate,
  openDesigner: handleOpenPrintTemplateDesigner,
  printRow: handlePrint,
  selectedTemplateId: selectedPrintTemplateId,
  selectorOpen: printTemplateSelectOpen,
  templateOptions: printTemplateOptions,
} = useErpPrintTemplate<ErpFinancePaymentApi.FinancePayment>({
  moduleKey: PRINT_TEMPLATE_MODULE,
  moduleName: PRINT_MODULE_NAME,
  openModal: openFinancePrintModal,
});

function syncCheckedRows() {
  const records =
    (gridApi.grid?.getCheckboxRecords?.() as
      | ErpFinancePaymentApi.FinancePayment[]
      | undefined) ?? [];
  checkedRows.value = records;
  checkedIds.value = records
    .map((item) => item.id!)
    .filter((id) => id !== undefined);
}

const pendingExportParams = ref<Record<string, any>>({});
const exportLoading = ref(false);

async function handleExport() {
  if (exportLoading.value) return;
  const selectedIds = (
    (gridApi.grid?.getCheckboxRecords?.() as
      | ErpFinancePaymentApi.FinancePayment[]
      | undefined) ?? []
  )
    .map((item) => item.id!)
    .filter((id) => id !== undefined);
  pendingExportParams.value =
    selectedIds.length > 0
      ? { ids: selectedIds, ...buildSortParams() }
      : { ...(await gridApi.formApi.getValues()), ...buildSortParams() };
  exportFieldModalApi
    .setData({
      loadFields: getFinancePaymentExportFields,
      moduleKey: 'erp_finance_payment',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  exportLoading.value = true;
  const hideLoading = message.loading({ content: '导出中...', duration: 0 });
  try {
    const data = await exportFinancePayment({
      ...pendingExportParams.value,
      fields: fields.join(','),
    });
    downloadFileFromBlobPart({ fileName: '付款单.xls', source: data });
  } finally {
    hideLoading();
    exportLoading.value = false;
  }
}

function handleCreate() {
  formModalApi.setData({ type: 'create' }).open();
}

useFinanceShortcut({
  onCreate: () => {
    if (!hasAccessByCodes(['erp:finance-payment:create'])) return;
    handleCreate();
  },
  onImport: () => {
    if (!hasAccessByCodes(['erp:finance-payment:import'])) return;
    handleImport();
  },
});

function handleImport() {
  importFormModalApi
    .setData({
      failureDownload: {
        fileName: '付款单错误数据.xls',
        request: downloadFinancePaymentImportFailureDetails,
      },
      importRequest: importFinancePayment,
      templateGuideSummary:
        '付款单导入模板用于批量创建付款单。请填写供应商、付款账户等主单信息；凭证号选填，业务类型、采购业务单号和本次付款可选，不填时可后续核销。',
      templateGuideTips: [
        '供应商、付款账户、财务人员、所属部门请填写系统中已存在且名称唯一的数据。',
        '需要同时导入核销明细时，请同时填写业务类型、业务单号和本次付款；业务类型仅支持采购入库、采购退货、采购调价。',
        '同一付款单存在多行核销明细时，仅首行填写完整主单信息，后续行只填写明细；各行凭证号可留空或填写相同值，不能填写不同值。',
        '暂不选择业务单据时，请将业务类型、业务单号、已付金额、本次付款、明细备注留空，导入后在付款单页面后续核销。',
        '金额字段请填写数字；旧模板中的付款时间可留空，系统会默认当前时间。',
      ],
      templateFileName: '付款单导入模板.xls',
      templateRequest: getFinancePaymentImportTemplate,
      title: '导入付款单',
    })
    .open();
}

function handleBatchEdit() {
  const editableIds = checkedRows.value
    .filter((item) => item.status !== 20)
    .map((item) => item.id!)
    .filter(Boolean);
  if (editableIds.length === 0) {
    message.warning('已审核数据禁止批量修改');
    return;
  }
  if (editableIds.length < checkedRows.value.length) {
    message.warning('已跳过不能修改的数据');
  }
  batchEditFormModalApi
    .setData({
      ids: editableIds,
      title: '批量修改付款单',
      updateRequest: batchUpdateFinancePayment,
      fields: [
        {
          field: 'remark',
          label: '备注',
          component: 'textarea',
        },
        {
          field: 'fileUrl',
          label: '附件 URL',
          component: 'input',
        },
      ],
    })
    .open();
}

function handleEdit(row: ErpFinancePaymentApi.FinancePayment) {
  formModalApi.setData({ type: 'edit', id: row.id }).open();
}

function handleDetail(row: ErpFinancePaymentApi.FinancePayment) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

function handleWriteOff(row: ErpFinancePaymentApi.FinancePayment) {
  writeOffFormModalApi.setData({ type: 'payment', record: row }).open();
}

async function handleWriteOffSuccess() {
  await formModalApi.close();
  handleRefresh();
}

function handleSearchEnter(event: KeyboardEvent) {
  if (event.isComposing) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.closest('.ant-picker, .ant-select')) return;
  event.preventDefault();
  event.stopPropagation();
  void gridApi.formApi.submitForm();
}

async function handleDelete(ids: number[], skippedCount = 0) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting'),
    duration: 0,
  });
  try {
    await deleteFinancePayment(ids);
    if (skippedCount > 0) {
      message.success(`已删除 ${ids.length} 条，已跳过 ${skippedCount} 条`);
    } else {
      message.success($t('ui.actionMessage.deleteSuccess'));
    }
    checkedIds.value = [];
    checkedRows.value = [];
    gridApi.grid?.clearCheckboxRow?.();
    gridApi.grid?.clearCheckboxReserve?.();
    const pager = gridApi.grid?.getProxyInfo?.()?.pager;
    if (pager && ids.length >= pageRows.value.length && pager.currentPage > 1) {
      if (gridApi.grid?.setCurrentPage) {
        await gridApi.grid.setCurrentPage(pager.currentPage - 1);
      } else {
        pager.currentPage -= 1;
      }
    }
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleBatchDelete() {
  const deletableIds = checkedRows.value
    .filter((item) => item.status !== 20)
    .map((item) => item.id!)
    .filter(Boolean);
  const skippedCount = checkedRows.value.length - deletableIds.length;
  if (deletableIds.length === 0) {
    message.warning('当前勾选数据没有可删除项');
    return;
  }
  await handleDelete(deletableIds, skippedCount);
  checkedIds.value = [];
  checkedRows.value = [];
}

async function handleUpdateStatus(row: ErpFinancePaymentApi.FinancePayment) {
  const hideLoading = message.loading({
    content: `审核付款单 ${row.no || ''} 中`,
    duration: 0,
  });
  try {
    await updateFinancePaymentStatus(row.id!);
    message.success('审核成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleDetailAudit(row: ErpFinancePaymentApi.FinancePayment) {
  await handleUpdateStatus(row);
  await formModalApi.close();
}

const paymentSortFieldMap = {
  no: 'no',
  paymentTime: 'paymentTime',
  supplierName: 'supplierName',
  settleMethod: 'settleMethod',
  creatorName: 'creatorName',
  financeUserName: 'financeUserName',
  accountName: 'accountName',
  totalPrice: 'totalPrice',
  discountPrice: 'discountPrice',
  paymentPrice: 'paymentPrice',
  status: 'status',
  auditorName: 'auditorName',
  auditTime: 'auditTime',
  remark: 'remark',
  bankName: 'bankName',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(paymentSortFieldMap);

function buildGridColumns(
  rows: ErpFinancePaymentApi.FinancePayment[] = pageRows.value,
) {
  const columns = (useGridColumns(rows) || [])
    .filter(
      (column) =>
        (column.field !== 'paymentVoucherNo' ||
          !isPaymentFieldHidden('paymentVoucherNo')) &&
        (column.field !== 'voucherNo' || accountingVoucherVisible.value),
    )
    .map((column) =>
      column.field && column.field in paymentSortFieldMap
        ? { ...column, sortable: true }
        : column,
    );
  return fitFinanceDocumentListColumnsToWidth(
    columns,
    gridShellRef.value?.clientWidth ?? 0,
  );
}

const autoColumnWidths = new Map<string, number>();
let columnUpdateQueue = Promise.resolve<void>(undefined);

function queueColumnUpdate(update: () => Promise<void>) {
  const queuedUpdate = columnUpdateQueue.then(update, update);
  columnUpdateQueue = queuedUpdate.catch(() => undefined);
  return queuedUpdate;
}

async function applyAdaptiveColumnWidths(
  rows: ErpFinancePaymentApi.FinancePayment[],
) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await nextTick();
    if ((gridApi.grid?.getColumnWidth?.('no') || 0) > 0) break;
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 80));
  const widthUpdates: Promise<unknown>[] = [];
  for (const column of buildGridColumns(rows)) {
    const field = String(column.field || '');
    const width = typeof column.width === 'number' ? column.width : 0;
    if (!field || !width) continue;

    const currentWidth = gridApi.grid?.getColumnWidth?.(field) || 0;
    const previousAutoWidth = autoColumnWidths.get(field);
    if (
      currentWidth > 0 &&
      currentWidth !== previousAutoWidth &&
      currentWidth >= width
    ) {
      continue;
    }

    const update = gridApi.grid?.setColumnWidth?.(field, width);
    if (update) widthUpdates.push(Promise.resolve(update));
    autoColumnWidths.set(field, width);
  }
  await Promise.all(widthUpdates);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 68 },
    schema: candidateSchema(
      useGridFormSchema(
        paymentHiddenFields.value,
        accountingVoucherVisible.value,
      ),
    ),
  },
  gridOptions: {
    pagerConfig: candidatePagerConfig(),
    columns: buildGridColumns([]),
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    fit: false,
    height: 'auto',
    id: 'erp-finance-settlement-payment-list-v4',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 8 },
    scrollY: { enabled: true, gt: 10 },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const summaryChanged = querySummaryState.prepare(formValues);
          let pageRequestFailed = false;
          const result = await getFinancePaymentPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            includeItems: false,
            ...formValues,
            ...buildSortParams(sorts, sort),
          }).catch((error) => {
            pageRequestFailed = true;
            querySummaryState.cancelPending();
            if (pageRows.value.length > 0)
              return {
                list: pageRows.value,
                total:
                  gridApi.grid?.getProxyInfo?.()?.pager?.total ??
                  pageRows.value.length,
              };
            throw error;
          });
          pageRows.value = result.list || [];
          void queueColumnUpdate(() =>
            applyAdaptiveColumnWidths(pageRows.value),
          );
          if (!pageRequestFailed)
            void querySummaryState.load(formValues, summaryChanged);
          return result;
        },
        querySuccess: () => {
          restoreSortState(gridApi);
          syncCheckedRows();
        },
      },
      sort: true,
    },
    sortConfig: {
      remote: true,
      multiple: false,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
      allowBtn: false,
    },
    rowConfig: {
      keyField: 'id',
      isHover: true,
    },
    rowClassName: ({ row }) =>
      row.status === 0 ? 'finance-payment-draft-row' : '',
    toolbarConfig: {
      custom: true,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ErpFinancePaymentApi.FinancePayment>,
  gridEvents: {
    sortChange: handleSortChange,
    checkboxAll: ({
      records,
    }: {
      records: ErpFinancePaymentApi.FinancePayment[];
    }) => {
      checkedIds.value = records.map((item) => item.id!);
      checkedRows.value = records;
    },
    checkboxChange: ({
      records,
    }: {
      records: ErpFinancePaymentApi.FinancePayment[];
    }) => {
      checkedIds.value = records.map((item) => item.id!);
      checkedRows.value = records;
    },
  },
});

function handleGridResize() {
  void queueColumnUpdate(async () => {
    autoColumnWidths.clear();
    await gridApi.grid?.reloadColumn?.(buildGridColumns(pageRows.value));
    await applyAdaptiveColumnWidths(pageRows.value);
  });
}

onMounted(() => window.addEventListener('resize', handleGridResize));
onBeforeUnmount(() => window.removeEventListener('resize', handleGridResize));

watch([paymentHiddenFields, voucherHiddenFields], async () => {
  gridApi.formApi?.setState?.({
    schema: candidateSchema(
      useGridFormSchema(
        paymentHiddenFields.value,
        accountingVoucherVisible.value,
      ),
    ),
  });
  await queueColumnUpdate(async () => {
    autoColumnWidths.clear();
    await gridApi.grid?.reloadColumn?.(buildGridColumns(pageRows.value));
    await applyAdaptiveColumnWidths(pageRows.value);
  });
});

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpFinancePaymentApi.FinancePayment>({
    gridApi,
    errorMessage: 'Error occurred while refreshing finance payment page:',
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
      includeItems: false,
    }),
    queryPage: async (params) => {
      querySummaryState.invalidate();
      const result = await getFinancePaymentPage({
        ...params,
        includeItems: false,
      });
      void querySummaryState.load(params, true);
      return result;
    },
    onSuccess: async (rows) => {
      pageRows.value = rows;
      await queueColumnUpdate(() => applyAdaptiveColumnWidths(rows));
      checkedIds.value = [];
      checkedRows.value = [];
      gridApi.grid?.clearCheckboxRow?.();
      gridApi.grid?.clearCheckboxReserve?.();
      void restoreSortState(gridApi);
    },
  });
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【财务】采购付款、费用支出"
        url="https://doc.iocoder.cn/sale/finance-payment-receipt/"
      />
    </template>

    <FormModal
      @success="handleRefresh"
      @audit="handleDetailAudit"
      @writeoff="handleWriteOff"
    />
    <ImportFormModal @success="handleRefresh" />
    <ExportFieldModal @confirm="handleExportConfirm" />
    <BatchEditFormModal @success="handleRefresh" />
    <WriteOffFormModal @success="handleWriteOffSuccess" />
    <PrintTemplateDesignModal @printed="handleRefresh" />
    <PrintTemplateSelector
      v-model:open="printTemplateSelectOpen"
      v-model:selected-id="selectedPrintTemplateId"
      :templates="printTemplateOptions"
      @cancel="cancelTemplateSelect"
      @confirm="confirmTemplate"
    />
    <div ref="gridShellRef" class="finance-payment-grid-shell">
      <Grid
        class="finance-payment-grid"
        table-title="付款单列表"
        @keydown.enter.capture="handleSearchEnter"
      >
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '新增',
                type: 'primary',
                icon: ACTION_ICON.ADD,
                tooltip: 'Insert 新增',
                title: 'Insert 新增',
                auth: ['erp:finance-payment:create'],
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                tooltip: 'I 导入',
                title: 'I 导入',
                auth: ['erp:finance-payment:import'],
                onClick: handleImport,
              },
              {
                label: exportActionLabel,
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                tooltip:
                  checkedIds.length > 0
                    ? '导出当前勾选的付款单数据'
                    : '导出当前查询条件下的付款单数据',
                auth: ['erp:finance-payment:export'],
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:finance-payment:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
              {
                label: '批量修改',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                ifShow: () => checkedRows.some((item) => item.status !== 20),
                auth: ['erp:finance-payment:update'],
                onClick: handleBatchEdit,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                ifShow: () => checkedRows.length > 0,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:finance-payment:delete'],
                popConfirm: {
                  title: '是否删除选中的数据？不可删除数据将自动跳过',
                  confirm: handleBatchDelete,
                },
              },
            ]"
          />
        </template>
        <template #deleteAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '删除',
                type: 'link',
                danger: true,
                auth: ['erp:finance-payment:delete'],
                ifShow: () => row.status !== 20,
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.no]),
                  confirm: handleDelete.bind(null, [row.id!]),
                },
              },
            ]"
          />
        </template>
        <template #printAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '打印',
                type: 'link',
                auth: ['erp:finance-payment:print'],
                onClick: handlePrint.bind(null, row),
              },
            ]"
          />
        </template>
        <template #paymentNo="{ row }">
          <button
            class="finance-payment-grid__document-link"
            type="button"
            @click.stop="handleDetail(row)"
          >
            {{ row.no || '-' }}
          </button>
        </template>
        <template #status="{ row }">
          <Tag
            :color="getPaymentStatusColor(row.status)"
            class="m-0"
            :title="
              row.status === 0
                ? '草稿：关闭新增或草稿编辑页面时自动保存，尚未正式提交'
                : undefined
            "
          >
            {{ getPaymentStatusLabel(row.status) }}
          </Tag>
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: '核销',
                type: 'link',
                auth: ['erp:finance-payment:writeoff'],
                ifShow: () =>
                  row.status === 20 && Number(row.unallocatedPrice || 0) !== 0,
                onClick: handleWriteOff.bind(null, row),
              },
              {
                label: row.status === 0 ? '编辑草稿' : $t('common.edit'),
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:finance-payment:update'],
                ifShow: () => row.status !== 20,
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '审核',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:finance-payment:update-status'],
                ifShow: () => row.status === 10,
                popConfirm: {
                  title: `确认审核 ${row.no} 吗？`,
                  confirm: handleUpdateStatus.bind(null, row),
                },
              },
            ]"
          />
        </template>
        <template #bottom>
          <div class="finance-payment-summary">
            <div class="finance-payment-row-legend">
              <span
                class="finance-payment-row-legend__swatch"
                aria-hidden="true"
              ></span>
              <span>浅蓝色行表示未正式提交的草稿</span>
            </div>
            <FinanceListQuerySummary
              :error="querySummaryState.error.value"
              :items="querySummaryItems"
              :loading="querySummaryState.loading.value"
              @retry="querySummaryState.retry"
            />
          </div>
        </template>
      </Grid>
      <ErpActivationRefreshMask
        v-if="activationRefreshMaskVisible"
        class="finance-payment-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.finance-payment-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

.finance-payment-grid {
  --finance-payment-accent: 24 82% 42%;
}

:global(.dark) .finance-payment-grid {
  --finance-payment-accent: 27 92% 64%;
}

:deep(.finance-payment-grid .vxe-table--render-default),
:deep(.finance-payment-grid .vxe-grid--form-wrapper),
:deep(.finance-payment-grid .vxe-toolbar) {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.finance-payment-grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.finance-payment-grid .vxe-grid--form-wrapper .ant-form-item) {
  margin-bottom: 8px;
}

:deep(.finance-payment-grid .vxe-grid--form-wrapper label),
:deep(.finance-payment-grid .vxe-grid--form-wrapper .ant-input),
:deep(.finance-payment-grid .vxe-grid--form-wrapper .ant-picker),
:deep(.finance-payment-grid .vxe-grid--form-wrapper .ant-picker-input > input),
:deep(.finance-payment-grid .vxe-grid--form-wrapper .ant-select),
:deep(.finance-payment-grid .vxe-grid--form-wrapper .ant-btn) {
  font-size: 12px;
}

:deep(.finance-payment-grid .vxe-grid--form-wrapper .ant-input-affix-wrapper) {
  min-height: 28px;
  padding: 2px 8px;
}

:deep(.finance-payment-grid .vxe-grid--form-wrapper .ant-select-single),
:deep(
  .finance-payment-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
),
:deep(.finance-payment-grid .vxe-grid--form-wrapper .ant-picker) {
  height: 28px;
}

:deep(
  .finance-payment-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-item
),
:deep(
  .finance-payment-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:global(.finance-payment-search-select-dropdown .ant-select-item),
:global(.finance-payment-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

:deep(.finance-payment-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.finance-payment-grid .vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.finance-payment-grid .vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(.finance-payment-grid .vxe-header--column) {
  height: 34px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 600;
}

:deep(.finance-payment-grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(.finance-payment-grid .vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.finance-payment-grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.finance-payment-grid .vxe-body--column) {
  height: 36px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.finance-payment-grid .finance-payment-amount-cell) {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

:deep(
  .finance-payment-grid .finance-payment-amount-cell--actual .vxe-cell--label
) {
  color: hsl(var(--finance-payment-accent));
  font-weight: 700;
}

:deep(.finance-payment-grid .vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

.finance-payment-grid__document-link {
  max-width: 100%;
  overflow: hidden;
  padding: 0;
  border: 0;
  color: hsl(var(--primary));
  font: inherit;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: transparent;
  cursor: pointer;
}

.finance-payment-grid__document-link:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.finance-payment-grid__document-link:focus-visible {
  border-radius: 3px;
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
}

.finance-payment-summary {
  display: flex;
  min-height: 40px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 20px;
  padding: 5px 8px;
  border-top: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  font-size: 12px;
  line-height: 18px;
}

.finance-payment-row-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  color: hsl(var(--muted-foreground));
}

.finance-payment-row-legend__swatch {
  width: 18px;
  height: 10px;
  background: hsl(var(--primary) / 10%);
  border: 1px solid hsl(var(--primary) / 30%);
  border-radius: 2px;
}

:deep(.finance-payment-draft-row .vxe-body--column) {
  background-color: hsl(var(--primary) / 7%) !important;
}

:deep(.finance-payment-draft-row.row--hover .vxe-body--column) {
  background-color: hsl(var(--primary) / 13%) !important;
}

.finance-payment-summary__count,
.finance-payment-summary__totals {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
}

.finance-payment-summary__count {
  color: hsl(var(--muted-foreground));
  font-weight: 600;
}

.finance-payment-summary__totals b {
  color: hsl(var(--foreground));
  font-weight: 600;
}

.finance-payment-summary__totals span {
  font-variant-numeric: tabular-nums;
}

.finance-payment-summary__actual {
  color: hsl(var(--finance-payment-accent));
  font-weight: 700;
}

:deep(.finance-payment-grid .vxe-grid--bottom-wrapper) {
  position: sticky;
  z-index: 4;
  bottom: 36px;
  background: hsl(var(--card));
}

:deep(.finance-payment-grid .vxe-grid--pager-wrapper) {
  position: sticky;
  z-index: 5;
  bottom: 0;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

@media (max-width: 768px) {
  .finance-payment-summary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
