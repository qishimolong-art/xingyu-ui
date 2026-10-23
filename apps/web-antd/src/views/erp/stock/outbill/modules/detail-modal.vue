<script lang="ts" setup>
import { provide as provideStockDecimalMode } from 'vue';
defineEmits(['success']);
provideStockDecimalMode('stock-decimal-context', true);
import { computed, onBeforeUnmount, provide, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';

import { Alert, Pagination } from 'ant-design-vue';

import {
  getStockOutBill,
  getStockOutBillItemPage,
  STOCK_OUT_BILL_HISTORY_NOTICE,
} from '#/api/erp/stock/outbill';
import {
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import HistoricalStockBillItems from '#/views/erp/stock/components/HistoricalStockBillItems.vue';
import StockDocumentFormLayout from '#/views/erp/stock/components/StockDocumentFormLayout.vue';
import { formatStockNaturalNumber } from '#/views/erp/stock/utils/document-number';
import SourceDocumentModal from '#/views/erp/stock/utils/source-document-modal.vue';
import { STOCK_SOURCE_DOCUMENT_TYPES } from '#/views/erp/stock/utils/source-document-navigation';
import { CANDIDATE_FOCUS_KEY } from '#/views/erp/utils/candidate-focus';

import { stockOutBillHistoryStatus } from '../outbill-history';

provide(CANDIDATE_FOCUS_KEY, ref(true));

const { hasAccessByCodes } = useAccess();
const canQuery = computed(() => hasAccessByCodes(['erp:stock-out-bill:query']));
const { hiddenFields, loadHiddenFields } =
  useFieldPermission('erp_stock_out_bill');
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
const title = '历史出仓单详情';

const formatNumber = formatStockNaturalNumber;
function handleOpenSourceDocument() {
  sourceDocumentModalRef.value?.open(
    STOCK_SOURCE_DOCUMENT_TYPES.SALE_OUT,
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
    detailLoadError.value = '没有历史出仓单查询权限';
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
    const result = await getStockOutBillItemPage({
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
const statusText = computed(() =>
  stockOutBillHistoryStatus(bill.value?.status),
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
      detailLoadError.value = '没有历史出仓单查询权限';
      return;
    }
    if (!data?.id) {
      detailLoadError.value = '出仓单参数无效';
      return;
    }
    const sequence = detailLoadSequence;
    detailLoading.value = true;
    modalApi.lock();
    try {
      await loadHiddenFields();
      const result = await getStockOutBill(data.id);
      if (sequence !== detailLoadSequence || !canQuery.value) return;
      bill.value = result;
      await loadItemPage(1, DEFAULT_ITEM_PAGE_SIZE);
    } catch {
      if (sequence === detailLoadSequence)
        detailLoadError.value = '出仓单加载失败，请关闭后重试';
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
    ok-text="关闭"
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
      item-title="历史出仓明细"
      :loading="detailLoading"
    >
      <template #basic>
        <Alert
          class="mb-2"
          type="info"
          :message="STOCK_OUT_BILL_HISTORY_NOTICE"
        />
        <div class="stock-document-readonly-grid">
          <div
            v-if="!isFieldHidden(hiddenFields, 'no')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">单号</span>
            <span
              class="stock-document-readonly-field__value"
              :title="bill?.no || '-'"
            >
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
              :title="bill.sourceNo"
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
            <span
              class="stock-document-readonly-field__value"
              :title="bill?.warehouseName || '-'"
            >
              {{ bill?.warehouseName ?? '-' }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'status')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">状态</span>
            <span class="stock-document-readonly-field__value">
              {{ statusText }}
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
            v-if="!isFieldHidden(hiddenFields, 'shippingArea')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">发货区</span>
            <span class="stock-document-readonly-field__value">
              {{ bill?.shippingArea ?? '-' }}
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
            v-if="!isFieldHidden(hiddenFields, 'billDate')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">日期</span>
            <span class="stock-document-readonly-field__value">
              {{ bill?.billDate ?? '-' }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'pickUserName')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">拣货人</span>
            <span class="stock-document-readonly-field__value">
              {{ bill?.pickUserName ?? '-' }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'printCount')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">打印次数</span>
            <span class="stock-document-readonly-field__value">
              {{ formatNumber(bill?.printCount) }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'printTime')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">打印时间</span>
            <span class="stock-document-readonly-field__value">
              {{ bill?.printTime ?? '-' }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'timeoutFlag')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">是否超时</span>
            <span class="stock-document-readonly-field__value">
              {{ bill?.timeoutFlag ? '是' : '否' }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'sourceRemark')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">来源备注</span>
            <span
              class="stock-document-readonly-field__value"
              :title="bill?.sourceRemark || '-'"
            >
              {{ bill?.sourceRemark ?? '-' }}
            </span>
          </div>
          <div
            v-if="!isFieldHidden(hiddenFields, 'remark')"
            class="stock-document-readonly-field"
          >
            <span class="stock-document-readonly-field__label">备注</span>
            <span
              class="stock-document-readonly-field__value"
              :title="bill?.remark || '-'"
            >
              {{ bill?.remark ?? '-' }}
            </span>
          </div>
        </div>
      </template>
      <template #items>
        <HistoricalStockBillItems
          direction="out"
          :order-field="itemSort.field"
          :order-direction="itemSort.order"
          :items="items"
          :hidden-fields="hiddenFields"
          :enabled="Boolean(bill?.id) && canQuery"
          :loading="itemPageLoading"
          @refresh="loadItemPage()"
          @sort="handleItemSort"
        />
        <div class="stock-out-bill-item-pager">
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
        <div class="stock-out-bill-document-summary">
          <strong>单据合计</strong>
          <div>
            明细 <b>{{ itemPageState.total }}</b> 项
          </div>
          <div>
            总重
            <b>{{ formatProtectedCount(bill?.totalWeight, 'totalWeight') }}</b>
          </div>
          <div>
            整件数 <b>{{ formatProtectedCount(bill?.wholeQty, 'wholeQty') }}</b>
          </div>
          <div>
            散件数 <b>{{ formatProtectedCount(bill?.looseQty, 'looseQty') }}</b>
          </div>
          <div>
            应拣
            <b>{{ formatProtectedCount(bill?.totalCount, 'totalCount') }}</b>
          </div>
          <span class="stock-out-bill-document-summary__picked">
            已拣
            <b>{{ formatProtectedCount(bill?.pickedCount, 'pickedCount') }}</b>
          </span>
        </div>
      </template>
      <template #audit>
        <ErpAuditInfo class="erp-audit-info" title="" :record="bill" />
      </template>
    </StockDocumentFormLayout>
  </Modal>
  <SourceDocumentModal ref="sourceDocumentModalRef" />
</template>

<style scoped>
.stock-out-bill-item-table,
.stock-out-bill-item-table :deep(.ant-table),
.stock-out-bill-item-table :deep(.ant-table-thead > tr > th),
.stock-out-bill-item-table :deep(.ant-table-tbody > tr > td),
.stock-out-bill-item-table :deep(.ant-empty-description),
.stock-out-bill-item-table :deep(.ant-tag) {
  font-size: 11px;
}

.stock-out-bill-item-table :deep(.ant-table-thead > tr > th) {
  white-space: nowrap;
}

.stock-out-bill-item-table
  :deep(.ant-table-column-has-sorters .ant-table-column-title) {
  color: hsl(var(--primary));
}

.stock-out-bill-item-table :deep(.ant-table-column-sorter) {
  display: none;
}

.stock-out-bill-item-table :deep(.ant-input-number) {
  min-height: 28px;
  font-size: 11px;
}

.stock-out-bill-item-table :deep(.ant-input-number-input) {
  font-size: 11px;
}

.stock-out-bill-document-summary {
  display: flex;
  min-height: 42px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px 20px;
  padding: 8px 10px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 20%);
  border: 1px solid hsl(var(--border));
  border-top: 0;
  border-radius: 0 0 6px 6px;
  font-size: 11px;
}

.stock-out-bill-document-summary strong {
  margin-right: auto;
  color: hsl(var(--foreground));
}

.stock-out-bill-document-summary b {
  margin-left: 4px;
  color: hsl(var(--foreground));
  font-variant-numeric: tabular-nums;
}

.stock-out-bill-document-summary__picked b {
  color: hsl(var(--success));
}

.stock-out-bill-item-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.stock-out-bill-item-pager :deep(.ant-pagination),
.stock-out-bill-item-pager :deep(.ant-pagination-item),
.stock-out-bill-item-pager :deep(.ant-pagination-total-text),
.stock-out-bill-item-pager :deep(.ant-pagination-options),
.stock-out-bill-item-pager :deep(.ant-select),
.stock-out-bill-item-pager :deep(.ant-input) {
  font-size: 11px;
}

.stock-out-bill-item-pager :deep(.ant-pagination-item),
.stock-out-bill-item-pager :deep(.ant-pagination-prev),
.stock-out-bill-item-pager :deep(.ant-pagination-next),
.stock-out-bill-item-pager :deep(.ant-pagination-jump-prev),
.stock-out-bill-item-pager :deep(.ant-pagination-jump-next) {
  min-width: 24px;
  height: 24px;
  line-height: 22px;
}

.stock-out-bill-item-pager :deep(.ant-pagination-item a),
.stock-out-bill-item-pager :deep(.ant-pagination-prev button),
.stock-out-bill-item-pager :deep(.ant-pagination-next button) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.stock-out-bill-item-pager :deep(.ant-pagination-options-size-changer),
.stock-out-bill-item-pager :deep(.ant-select-single),
.stock-out-bill-item-pager :deep(.ant-select-selector) {
  height: 24px;
  line-height: 22px;
}

.stock-out-bill-item-pager
  :deep(.ant-pagination-options-size-changer .ant-select-selector) {
  box-sizing: border-box;
  align-items: center;
  min-height: 24px;
  padding: 0 24px 0 8px;
}

.stock-out-bill-item-pager
  :deep(.ant-select-single .ant-select-selector .ant-select-selection-item) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.stock-out-bill-item-pager :deep(.ant-select-arrow) {
  margin-top: -5px;
  font-size: 10px;
}

.stock-out-bill-item-pager :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 22px;
}
</style>
