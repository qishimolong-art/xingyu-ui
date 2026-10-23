<script setup lang="ts">
import { financeMoneyGrouped } from '#/views/erp/finance/utils/finance-decimal';
import { financeValue } from '#/views/erp/finance/utils/finance-decimal';

import type { TableColumnsType } from 'ant-design-vue';
import type { ErpReceivableAgingReportApi } from '#/api/erp/report/receivable-aging';
import type { ReportDocumentType } from '#/views/erp/report/components/report-document-detail';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';

import { Alert, Table } from 'ant-design-vue';

import { getReceivableAgingReportDetailPage } from '#/api/erp/report/receivable-aging';
import ReportDocumentDetailModal from '#/views/erp/report/components/report-document-detail-modal.vue';
import {
  REPORT_DOCUMENT_TYPES,
  resolveReportDocumentTarget,
} from '#/views/erp/report/components/report-document-detail';
import ReportDocumentLink from '#/views/erp/report/components/report-document-link.vue';

interface ModalData {
  analysisDate: string;
  bucket: ErpReceivableAgingReportApi.Bucket;
  bucketName: string;
  customerId: number;
  customerName?: string;
  deptId?: number;
  deptName?: string;
}

const { hasAccessByCodes } = useAccess();
const loading = ref(false);
const loadError = ref('');
const modalData = ref<ModalData>();
const rows = ref<ErpReceivableAgingReportApi.DetailRow[]>([]);
const pageNo = ref(1);
const pageSize = ref(20);
const total = ref(0);
let loadSequence = 0;
const documentDetailModalRef =
  ref<InstanceType<typeof ReportDocumentDetailModal>>();

const title = computed(() =>
  [
    '应收账龄构成明细',
    modalData.value?.customerName,
    modalData.value?.deptName,
    modalData.value?.bucketName,
  ]
    .filter(Boolean)
    .join(' - '),
);

const columns: TableColumnsType<ErpReceivableAgingReportApi.DetailRow> = [
  { title: '业务日期', dataIndex: 'businessDate', width: 168 },
  { title: '业务类型', dataIndex: 'businessType', width: 116 },
  { title: '单号', dataIndex: 'documentNo', width: 180 },
  { title: '客户', dataIndex: 'customerName', width: 190, ellipsis: true },
  { title: '部门', dataIndex: 'deptName', width: 140, ellipsis: true },
  { title: '业务员', dataIndex: 'businessUserName', width: 120 },
  { title: '金额', dataIndex: 'amount', width: 130, align: 'right' },
  { title: '备注', dataIndex: 'description', width: 220, ellipsis: true },
];

const documentTypeMap: Record<string, ReportDocumentType> = {
  FINANCE_RECEIPT: REPORT_DOCUMENT_TYPES.FINANCE_RECEIPT,
  RECEIVABLE_ADJUST: REPORT_DOCUMENT_TYPES.RECEIVABLE_OTHER,
  SALE_ADJUST: REPORT_DOCUMENT_TYPES.SALE_PRICE_ADJUST,
  SALE_OUT: REPORT_DOCUMENT_TYPES.SALE_OUT,
  SALE_RETURN: REPORT_DOCUMENT_TYPES.SALE_RETURN,
};

function formatMoney(value: unknown) {
  return financeMoneyGrouped(value as any);
}

function documentTarget(record: Record<string, any>) {
  const row = record as ErpReceivableAgingReportApi.DetailRow;
  return resolveReportDocumentTarget(
    documentTypeMap[row.documentTypeCode || ''],
    row.businessId,
    row.documentNo,
    hasAccessByCodes,
  );
}

function openDocument(record: Record<string, any>) {
  const target = documentTarget(record);
  if (target) documentDetailModalRef.value?.open(target.type, target.id);
}

async function loadRows() {
  const data = modalData.value;
  if (!data) return;
  const sequence = ++loadSequence;
  loading.value = true;
  loadError.value = '';
  try {
    const result = await getReceivableAgingReportDetailPage({
      analysisDate: data.analysisDate,
      bucket: data.bucket,
      customerId: data.customerId,
      deptId: data.deptId,
      deptUnassigned: !data.deptId,
      pageNo: pageNo.value,
      pageSize: pageSize.value,
    });
    if (sequence !== loadSequence) return;
    rows.value = result.list || [];
    total.value = Number(result.total || 0);
  } catch {
    if (sequence === loadSequence) {
      rows.value = [];
      total.value = 0;
      loadError.value = '构成明细加载失败，请关闭后重试';
    }
  } finally {
    if (sequence === loadSequence) loading.value = false;
  }
}

const [Modal, modalApi] = useVbenModal({
  async onOpenChange(open: boolean) {
    if (!open) {
      loadSequence += 1;
      rows.value = [];
      modalData.value = undefined;
      return;
    }
    const data = modalApi.getData<ModalData>();
    if (!data?.analysisDate || !data.customerId || !data.bucket) {
      loadError.value = '构成明细参数无效，请关闭后重试';
      return;
    }
    modalData.value = data;
    pageNo.value = 1;
    pageSize.value = 20;
    await loadRows();
  },
});

async function handlePageChange(page: number, size: number) {
  pageNo.value = page;
  pageSize.value = size;
  await loadRows();
}
</script>

<template>
  <Modal
    :title="title"
    class="!w-[85vw]"
    content-class="p-3"
    :show-confirm-button="false"
  >
    <Alert
      v-if="loadError"
      class="mb-3"
      :message="loadError"
      type="error"
      show-icon
    />
    <Table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="{
        current: pageNo,
        pageSize,
        total,
        showSizeChanger: true,
        showTotal: (value: number) => `共 ${value} 条`,
      }"
      :row-key="(row) => row.rowKey"
      :scroll="{ x: 1268, y: 'calc(70vh - 180px)' }"
      size="small"
      @change="
        (pagination: any) =>
          handlePageChange(pagination.current || 1, pagination.pageSize || 20)
      "
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'documentNo'">
          <ReportDocumentLink
            v-if="documentTarget(record)"
            :value="record.documentNo"
            @open="openDocument(record)"
          />
          <span v-else>{{ record.documentNo || '-' }}</span>
        </template>
        <template v-else-if="column.dataIndex === 'amount'">
          {{ formatMoney(record.amount) }}
        </template>
      </template>
    </Table>
    <ReportDocumentDetailModal ref="documentDetailModalRef" />
  </Modal>
</template>
