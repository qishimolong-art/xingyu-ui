<script lang="ts" setup>
import { provide as provideStockDecimalMode } from 'vue';
const emit = defineEmits<{
  openTransferIn: [id: number];
  openTransferOut: [id: number];
}>();
provideStockDecimalMode('stock-decimal-context', true);
import type { ErpStockTransferLedgerApi } from '#/api/erp/stock/transfer-ledger';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Alert, Button, Table, Tag } from 'ant-design-vue';

import {
  getStockTransferLedgerDetailPage,
  normalizeStockTransferLedgerDate,
} from '#/api/erp/stock/transfer-ledger';
import {
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';

import { getLedgerStatusMeta } from './status';

const rows = ref<ErpStockTransferLedgerApi.Detail[]>([]);
const loading = ref(false);
const loadError = ref('');
const pageNo = ref(1);
const pageSize = ref(20);
const total = ref(0);
const modalData = ref<
  ErpStockTransferLedgerApi.QueryParams & { businessDate: string }
>();
let loadSequence = 0;
const { hiddenFields } = useFieldPermission('erp_stock_transfer_ledger');

const title = computed(() =>
  modalData.value?.businessDate
    ? `调拨台账明细 - ${modalData.value.businessDate}`
    : '调拨台账明细',
);
const currentPageAbnormalCount = computed(
  () => rows.value.filter((row) => row.matchStatus === 'ABNORMAL').length,
);

const columns = computed(() =>
  [
    { title: '产品名称', dataIndex: 'productName', width: 160 },
    { title: '匹配状态', dataIndex: 'matchStatus', width: 90 },
    { title: '调拨出库单号', dataIndex: 'transferOutNo', width: 150 },
    { title: '调拨入库单号', dataIndex: 'transferInNo', width: 170 },
    { title: '来源单号', dataIndex: 'sourceNo', width: 140 },
    { title: '调出部门', dataIndex: 'fromDeptName', width: 110 },
    { title: '调入部门', dataIndex: 'toDeptName', width: 110 },
    { title: '产品编码', dataIndex: 'productCode', width: 120 },
    { title: '调出仓库', dataIndex: 'fromWarehouseName', width: 120 },
    { title: '调入仓库', dataIndex: 'toWarehouseName', width: 120 },
    { title: '批次号', dataIndex: 'batchNo', width: 120 },
    { title: '单位', dataIndex: 'productUnitName', width: 80 },
    { title: '包装数', dataIndex: 'packageQty', width: 90 },
    { title: '单重', dataIndex: 'weight', width: 90 },
    { title: '总重', dataIndex: 'totalWeight', width: 100 },
    { title: '出库数量', dataIndex: 'transferOutCount', width: 100 },
    { title: '入库数量', dataIndex: 'transferInCount', width: 100 },
    { title: '差异数量', dataIndex: 'differenceCount', width: 100 },
    { title: '异常原因', dataIndex: 'exceptionReason', width: 260 },
  ].filter(
    (column) =>
      !isFieldHidden(hiddenFields.value, `report_${column.dataIndex}`),
  ),
);

async function loadData() {
  if (!modalData.value) return;
  const sequence = ++loadSequence;
  loading.value = true;
  loadError.value = '';
  try {
    const result = await getStockTransferLedgerDetailPage({
      ...modalData.value,
      pageNo: pageNo.value,
      pageSize: pageSize.value,
    });
    if (sequence !== loadSequence) return;
    rows.value = result.list ?? [];
    total.value = Number(result.total ?? 0);
  } catch {
    if (sequence === loadSequence) {
      rows.value = [];
      total.value = 0;
      loadError.value = '明细加载失败，请稍后重试';
    }
  } finally {
    if (sequence === loadSequence) loading.value = false;
  }
}

function handleTableChange(pagination: {
  current?: number;
  pageSize?: number;
}) {
  pageNo.value = pagination.current ?? 1;
  pageSize.value = pagination.pageSize ?? 20;
  void loadData();
}

const [Modal, modalApi] = useVbenModal({
  async onOpenChange(isOpen) {
    if (!isOpen) {
      loadSequence += 1;
      rows.value = [];
      loadError.value = '';
      modalData.value = undefined;
      return;
    }
    modalApi.setState({ fullscreen: true });
    const data = modalApi.getData<
      ErpStockTransferLedgerApi.QueryParams & { businessDate: unknown }
    >();
    modalData.value = {
      ...data,
      businessDate: normalizeStockTransferLedgerDate(
        data.businessDate,
        'YYYY-MM-DD',
      ),
    };
    pageNo.value = 1;
    pageSize.value = 20;
    await loadData();
  },
});
</script>

<template>
  <Modal
    :title="title"
    class="!w-full"
    content-class="p-3"
    :show-confirm-button="false"
  >
    <Alert
      v-if="loadError"
      class="mb-3"
      :message="loadError"
      show-icon
      type="error"
    />
    <div v-else class="ledger-detail-hint">
      <span>共 {{ total }} 组匹配明细</span>
      <span v-if="currentPageAbnormalCount" class="ledger-detail-hint--danger">
        本页 {{ currentPageAbnormalCount }} 组异常
      </span>
      <span class="ledger-detail-hint__legend">
        <i aria-hidden="true"></i>
        浅红色行表示出入库不匹配
      </span>
      <span class="ledger-detail-hint__boundary">
        当前台账用于出入库配对追溯，不是正式在途结算或内部利润报表。
      </span>
    </div>
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
      row-key="rowKey"
      size="small"
      :row-class-name="
        (record: ErpStockTransferLedgerApi.Detail) =>
          record.matchStatus === 'ABNORMAL' ? 'ledger-abnormal-row' : ''
      "
      :scroll="{ x: 'max-content', y: 'calc(100vh - 250px)' }"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'matchStatus'">
          <Tag :color="getLedgerStatusMeta(record.matchStatus).color">
            {{ getLedgerStatusMeta(record.matchStatus).label }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'transferOutNo'">
          <Button
            v-if="record.transferOutId"
            class="ledger-document-link"
            type="link"
            size="small"
            @click="emit('openTransferOut', record.transferOutId)"
          >
            {{ record.transferOutNo }}
          </Button>
          <span v-else>-</span>
        </template>
        <template v-else-if="column.dataIndex === 'transferInNo'">
          <Button
            v-if="record.transferInId"
            class="ledger-document-link"
            type="link"
            size="small"
            @click="emit('openTransferIn', record.transferInId)"
          >
            {{ record.transferInNo }}
          </Button>
          <span v-else></span>
        </template>
        <template v-else-if="column.dataIndex === 'exceptionReason'">
          <span :title="record.exceptionReason || ''">
            {{ record.exceptionReason || '—' }}
          </span>
        </template>
      </template>
    </Table>
  </Modal>
</template>

<style scoped>
:deep(.ledger-abnormal-row > td) {
  background: rgb(254 242 242) !important;
}

:deep(.ledger-abnormal-row:hover > td) {
  background: rgb(254 226 226) !important;
}

:deep(.ant-table),
:deep(.ant-table-cell),
:deep(.ant-pagination) {
  font-size: 12px;
}

:deep(.ant-table-thead > tr > th) {
  white-space: nowrap;
}

:deep(.ledger-document-link.ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

.ledger-detail-hint {
  display: flex;
  min-height: 32px;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 16px;
  padding: 0 4px 8px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.ledger-detail-hint--danger {
  color: #cf1322;
  font-weight: 600;
}

.ledger-detail-hint__legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.ledger-detail-hint__boundary {
  flex-basis: 100%;
}

.ledger-detail-hint__legend i {
  width: 18px;
  height: 10px;
  background: rgb(254 242 242);
  border: 1px solid rgb(252 165 165);
  border-radius: 2px;
}
</style>
