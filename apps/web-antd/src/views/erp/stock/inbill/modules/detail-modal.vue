<script lang="ts" setup>
import { provide as provideStockDecimalMode } from 'vue';
defineEmits(['success']);
provideStockDecimalMode('stock-decimal-context', true);
import { computed, onBeforeUnmount, provide, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import { Pagination, Progress, Tag } from 'ant-design-vue';

import { getStockInBill, getStockInBillItemPage } from '#/api/erp/stock/inbill';
import {
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import HistoricalStockBillItems from '#/views/erp/stock/components/HistoricalStockBillItems.vue';
import StockDocumentFormLayout from '#/views/erp/stock/components/StockDocumentFormLayout.vue';
import { formatStockNaturalNumber } from '#/views/erp/stock/utils/document-number';
import SourceDocumentModal from '#/views/erp/stock/utils/source-document-modal.vue';
import { STOCK_SOURCE_DOCUMENT_TYPES } from '#/views/erp/stock/utils/source-document-navigation';
import { CANDIDATE_FOCUS_KEY } from '#/views/erp/utils/candidate-focus';

import {
  getStockInBillProgress,
  getStockInBillRemainingCount,
  getStockInBillStatusMeta,
} from '../ui';

provide(CANDIDATE_FOCUS_KEY, ref(true));

const { hasAccessByCodes } = useAccess();
const canQuery = computed(() => hasAccessByCodes(['erp:stock-in-bill:query']));
const { hiddenFields, loadHiddenFields } =
  useFieldPermission('erp_stock_in_bill');
const DEFAULT_ITEM_PAGE_SIZE = 10;
const ITEM_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];
const bill = ref<any>();
const items = ref<any[]>([]);
const detailLoading = ref(false);
const detailLoadError = ref('');
const itemPageLoading = ref(false);
const itemPageState = ref({
  pageNo: 1,
  pageSize: DEFAULT_ITEM_PAGE_SIZE,
  total: 0,
});
const itemSort = ref<{ field?: string; order?: 'asc' | 'desc' }>({});
let detailLoadSequence = 0;
let itemLoadSequence = 0;
const sourceDocumentModalRef = ref<InstanceType<typeof SourceDocumentModal>>();
const title = '历史入仓单详情';
const itemTitle = '历史入仓明细';

function formatBillDate(value?: string) {
  return value ? formatDateTime(value) || '-' : '-';
}
function handleOpenSourceDocument() {
  sourceDocumentModalRef.value?.open(
    STOCK_SOURCE_DOCUMENT_TYPES.PURCHASE_IN,
    bill.value?.sourceId,
  );
}
function formatProtectedCount(value: unknown, field: string) {
  const dependencies: Record<string, string[]> = {
    totalCount: ['item_count'],
    pickedCount: ['item_pickedCount'],
    remainingCount: [
      'totalCount',
      'pickedCount',
      'item_count',
      'item_pickedCount',
    ],
    totalWeight: ['item_totalWeight'],
  };
  if (
    [field, ...(dependencies[field] ?? [])].some((key) =>
      isFieldHidden(hiddenFields.value, key),
    )
  )
    return '****';
  return formatStockNaturalNumber(value);
}

function resetItemPageState() {
  itemPageState.value = { pageNo: 1, pageSize: 10, total: 0 };
}
function clearDetail() {
  modalApi.unlock();
  ++detailLoadSequence;
  ++itemLoadSequence;
  bill.value = undefined;
  items.value = [];
  detailLoading.value = false;
  itemPageLoading.value = false;
  itemSort.value = {};
  resetItemPageState();
}
watch(canQuery, (allowed) => {
  if (!allowed) {
    clearDetail();
    detailLoadError.value = '没有历史入仓单查询权限';
  }
});
onBeforeUnmount(clearDetail);
async function loadItemPage(
  pageNo = itemPageState.value.pageNo,
  pageSize = itemPageState.value.pageSize,
) {
  if (!bill.value?.id || !canQuery.value) return;
  const billId = bill.value.id;
  const sequence = ++itemLoadSequence;
  itemPageLoading.value = true;
  try {
    const result = await getStockInBillItemPage({
      billId,
      mask: true,
      pageNo,
      pageSize,
      orderField: itemSort.value.field,
      orderDirection: itemSort.value.order,
    });
    if (
      sequence !== itemLoadSequence ||
      bill.value?.id !== billId ||
      !canQuery.value
    )
      return;
    items.value = result.list ?? [];
    itemPageState.value = { pageNo, pageSize, total: result.total ?? 0 };
    detailLoadError.value = '';
  } catch {
    if (sequence === itemLoadSequence)
      detailLoadError.value = '历史明细加载失败，请刷新重试';
  } finally {
    if (sequence === itemLoadSequence) itemPageLoading.value = false;
  }
}
async function handleItemPageChange(pageNo: number, pageSize: number) {
  await loadItemPage(pageNo, pageSize);
}
async function handleItemSort(value: {
  field?: string;
  order?: 'asc' | 'desc';
}) {
  itemSort.value = value;
  await loadItemPage(1);
}
const statusMeta = computed(() => getStockInBillStatusMeta(bill.value?.status));
const totalCount = computed(() => bill.value?.totalCount);
const pickedCount = computed(() => bill.value?.pickedCount);
const remainingCount = computed(() =>
  getStockInBillRemainingCount(totalCount.value, pickedCount.value),
);
const pickupProgress = computed(() =>
  getStockInBillProgress(totalCount.value, pickedCount.value),
);
const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    await modalApi.close();
  },
  async onOpenChange(open: boolean) {
    clearDetail();
    detailLoadError.value = '';
    if (!open) return;
    modalApi.setState({ fullscreen: true });
    const data = modalApi.getData<{ id?: number; mode?: string }>();
    if (!canQuery.value) {
      detailLoadError.value = '没有历史入仓单查询权限';
      return;
    }
    if (!data?.id) {
      detailLoadError.value = '入仓单参数无效';
      return;
    }
    const sequence = detailLoadSequence;
    detailLoading.value = true;
    modalApi.lock();
    try {
      await loadHiddenFields();
      const result = await getStockInBill(data.id);
      if (sequence !== detailLoadSequence || !canQuery.value) return;
      bill.value = result;
      await loadItemPage(1, DEFAULT_ITEM_PAGE_SIZE);
    } catch {
      if (sequence === detailLoadSequence)
        detailLoadError.value = '入仓单加载失败，请关闭后重试';
    } finally {
      if (sequence === detailLoadSequence) {
        detailLoading.value = false;
        modalApi.unlock();
      }
    }
  },
});
</script>

<template>
  <Modal
    :title="title"
    class="!w-full"
    bordered
    content-class="p-0"
    :show-confirm-button="false"
    ok-text="确定"
  >
    <button
      v-if="detailLoadError && bill?.id && canQuery"
      type="button"
      class="m-3 text-primary"
      @click="loadItemPage()"
    >
      刷新当前明细
    </button>
    <StockDocumentFormLayout
      :editable="false"
      :error="detailLoadError"
      :item-title="itemTitle"
      :loading="detailLoading"
    >
      <template #basic>
        <div class="mb-3 rounded border p-2 text-sm">
          历史采购入仓记录，仅供核对。采购审核成功即入库过账，未提数量不自动补入库存。
        </div>
        <div class="stock-in-bill-progress-card">
          <div class="stock-in-bill-progress-card__header">
            <div>
              <div class="stock-in-bill-progress-card__eyebrow">
                历史处理进度
              </div>
              <div class="stock-in-bill-progress-card__title">
                {{ bill?.no ?? '-' }}
              </div>
            </div>
            <Tag :color="statusMeta.color">{{ statusMeta.label }}</Tag>
          </div>
          <Progress
            :percent="pickupProgress ?? 0"
            v-if="pickupProgress !== undefined"
            :show-info="false"
            size="small"
            stroke-color="#1677ff"
          />
          <div class="stock-in-bill-progress-card__metrics">
            <div class="stock-in-bill-progress-card__metric">
              <span>应提数量</span>
              <strong>{{
                formatProtectedCount(totalCount, 'totalCount')
              }}</strong>
            </div>
            <div class="stock-in-bill-progress-card__metric">
              <span>已提数量</span>
              <strong>{{
                formatProtectedCount(pickedCount, 'pickedCount')
              }}</strong>
            </div>
            <div class="stock-in-bill-progress-card__metric">
              <span>待提数量</span>
              <strong class="stock-in-bill-progress-card__remaining">
                {{ formatProtectedCount(remainingCount, 'remainingCount') }}
              </strong>
            </div>
          </div>
        </div>
        <div class="stock-document-readonly-grid">
          <div
            v-if="!isFieldHidden(hiddenFields, 'no')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">单号</span>
            <span class="stock-document-readonly-field__value">
              {{ bill?.no ?? '-' }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'sourceNo')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">来源单号</span>
            <button
              v-if="bill?.sourceNo && bill?.sourceId"
              class="stock-document-readonly-field__value stock-document-readonly-field__value--link"
              type="button"
              @click.stop="handleOpenSourceDocument"
            >
              {{ bill.sourceNo }}
            </button>
            <span v-else class="stock-document-readonly-field__value">-</span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'warehouseId')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">仓库</span>
            <span class="stock-document-readonly-field__value">
              {{ bill?.warehouseName ?? '-' }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'status')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">状态</span>
            <span
              class="stock-document-readonly-field__value stock-in-bill-status-field"
            >
              <Tag :color="statusMeta.color">{{ statusMeta.label }}</Tag>
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'totalCount')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">应提数量</span>
            <span class="stock-document-readonly-field__value">
              {{ formatProtectedCount(bill?.totalCount, 'totalCount') }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'pickedCount')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">已提数量</span>
            <span class="stock-document-readonly-field__value">
              {{ formatProtectedCount(bill?.pickedCount, 'pickedCount') }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'pickupUserName')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">提货人</span>
            <span class="stock-document-readonly-field__value">
              {{ bill?.pickupUserName ?? '-' }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'billDate')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">日期</span>
            <span class="stock-document-readonly-field__value">
              {{ formatBillDate(bill?.billDate) }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'sourceUnitName')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">来源单位</span>
            <span class="stock-document-readonly-field__value">
              {{ bill?.sourceUnitName ?? '-' }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'priority')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">优先级</span>
            <span class="stock-document-readonly-field__value">
              {{ bill?.priority ?? '-' }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'wholeQty')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">整件数</span>
            <span class="stock-document-readonly-field__value">
              {{ formatProtectedCount(bill?.wholeQty, 'wholeQty') }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'looseQty')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">散件数</span>
            <span class="stock-document-readonly-field__value">
              {{ formatProtectedCount(bill?.looseQty, 'looseQty') }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'totalWeight')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">总重</span>
            <span class="stock-document-readonly-field__value">
              {{ formatProtectedCount(bill?.totalWeight, 'totalWeight') }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'creator')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">创建人</span>
            <span class="stock-document-readonly-field__value">
              {{ bill?.creatorName ?? '-' }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'createTime')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">创建时间</span>
            <span class="stock-document-readonly-field__value">
              {{ formatBillDate(bill?.createTime) }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'auditorName')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">审核人</span>
            <span class="stock-document-readonly-field__value">
              {{ bill?.auditorName ?? '-' }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'auditTime')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">审核时间</span>
            <span class="stock-document-readonly-field__value">
              {{ formatBillDate(bill?.auditTime) }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'remark')"
            class="stock-document-readonly-field stock-in-bill-remark-field"
          >
            <span class="stock-document-readonly-field__label">备注</span>
            <span
              class="stock-document-readonly-field__value stock-in-bill-remark-value"
            >
              {{ bill?.remark ?? '-' }}
            </span>
          </div>
        </div>
      </template>
      <template #items>
        <HistoricalStockBillItems
          direction="in"
          :order-field="itemSort.field"
          :order-direction="itemSort.order"
          :items="items"
          :hidden-fields="hiddenFields"
          :enabled="Boolean(bill?.id) && canQuery"
          :loading="itemPageLoading"
          @refresh="loadItemPage()"
          @sort="handleItemSort"
        />
        <div class="stock-in-bill-item-pager">
          <Pagination
            class="erp-candidate-focus-popup"
            :current="itemPageState.pageNo"
            :disabled="itemPageLoading"
            :page-size="itemPageState.pageSize"
            :page-size-options="ITEM_PAGE_SIZE_OPTIONS"
            :show-quick-jumper="true"
            :show-size-changer="true"
            :show-total="(total) => `共 ${total} 条明细`"
            :total="itemPageState.total"
            size="small"
            @change="handleItemPageChange"
            @show-size-change="handleItemPageChange"
          />
        </div>
      </template>
    </StockDocumentFormLayout>
  </Modal>
  <SourceDocumentModal ref="sourceDocumentModalRef" />
</template>

<style scoped>
.stock-in-bill-progress-card {
  margin: 12px 12px 0;
  padding: 12px 14px;
  background: linear-gradient(
    110deg,
    hsl(var(--primary) / 8%),
    hsl(var(--card)) 62%
  );
  border: 1px solid hsl(var(--primary) / 20%);
  border-radius: 8px;
}

.stock-in-bill-progress-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.stock-in-bill-progress-card__eyebrow {
  margin-bottom: 2px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.stock-in-bill-progress-card__title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--foreground));
  white-space: nowrap;
}

.stock-in-bill-progress-card__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px 16px;
  margin-top: 8px;
}

.stock-in-bill-progress-card__metric {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  min-width: 0;
  gap: 8px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.stock-in-bill-progress-card__metric strong {
  overflow: hidden;
  text-overflow: ellipsis;
  color: hsl(var(--foreground));
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.stock-in-bill-progress-card__metric
  strong.stock-in-bill-progress-card__remaining {
  color: hsl(var(--primary));
}

.stock-in-bill-status-field {
  display: flex;
  align-items: center;
}

.stock-in-bill-status-field :deep(.ant-tag) {
  margin-inline-end: 0;
}

.stock-in-bill-remark-field {
  grid-column: span 2;
}

.stock-in-bill-remark-value {
  min-height: 32px;
  overflow: visible;
  line-height: 20px;
  white-space: normal;
}

:deep(.stock-document-item-form .ant-table-wrapper) {
  font-variant-numeric: tabular-nums;
}

:deep(.stock-document-item-form .stock-in-bill-detail-table .ant-table) {
  font-size: 11px;
  line-height: 20px;
}

:deep(
  .stock-document-item-form
    .stock-in-bill-detail-table
    .ant-table-thead
    > tr
    > th
) {
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

:deep(
  .stock-document-item-form
    .stock-in-bill-detail-table
    .ant-table-tbody
    > tr
    > td
) {
  font-size: 11px;
  line-height: 20px;
}

:deep(
  .stock-document-item-form .stock-in-bill-detail-table .ant-input-number-input
) {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

:deep(.stock-in-bill-detail-table .ant-tag) {
  font-size: 11px;
}

.stock-in-bill-detail-table__number {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  white-space: nowrap;
}

.stock-in-bill-item-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.stock-in-bill-item-pager :deep(.ant-pagination),
.stock-in-bill-item-pager :deep(.ant-pagination-item),
.stock-in-bill-item-pager :deep(.ant-pagination-total-text),
.stock-in-bill-item-pager :deep(.ant-pagination-options),
.stock-in-bill-item-pager :deep(.ant-select),
.stock-in-bill-item-pager :deep(.ant-input) {
  font-size: 11px;
}

.stock-in-bill-item-pager :deep(.ant-pagination-item),
.stock-in-bill-item-pager :deep(.ant-pagination-prev),
.stock-in-bill-item-pager :deep(.ant-pagination-next),
.stock-in-bill-item-pager :deep(.ant-pagination-jump-prev),
.stock-in-bill-item-pager :deep(.ant-pagination-jump-next) {
  min-width: 24px;
  height: 24px;
  line-height: 22px;
}

.stock-in-bill-item-pager :deep(.ant-pagination-item a),
.stock-in-bill-item-pager :deep(.ant-pagination-prev button),
.stock-in-bill-item-pager :deep(.ant-pagination-next button) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.stock-in-bill-item-pager :deep(.ant-pagination-options-size-changer),
.stock-in-bill-item-pager :deep(.ant-select-single),
.stock-in-bill-item-pager :deep(.ant-select-selector) {
  height: 24px;
  line-height: 22px;
}

.stock-in-bill-item-pager
  :deep(.ant-pagination-options-size-changer .ant-select-selector) {
  box-sizing: border-box;
  align-items: center;
  min-height: 24px;
  padding: 0 24px 0 8px;
}

.stock-in-bill-item-pager
  :deep(.ant-select-single .ant-select-selector .ant-select-selection-item) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.stock-in-bill-item-pager :deep(.ant-select-arrow) {
  margin-top: -5px;
  font-size: 10px;
}

.stock-in-bill-item-pager :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 22px;
}

@media (max-width: 1279px) {
  .stock-in-bill-progress-card__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .stock-in-bill-progress-card {
    margin: 8px 8px 0;
  }

  .stock-in-bill-progress-card__metrics {
    grid-template-columns: minmax(0, 1fr);
  }

  .stock-in-bill-remark-field {
    grid-column: auto;
  }
}
</style>
