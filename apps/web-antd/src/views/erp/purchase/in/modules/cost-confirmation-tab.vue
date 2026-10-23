<script setup lang="ts">
import type { PurchaseCostApi } from '#/api/erp/purchase/cost-confirmation';
import type { TableProps } from 'ant-design-vue';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useAccess } from '@vben/access';
import { Alert, Button, Table, Tag } from 'ant-design-vue';
import {
  getPurchaseCostConfirmation,
  getPurchaseCostItems,
  getPurchaseCostPreview,
} from '#/api/erp/purchase/cost-confirmation';
import { costStatusLabels, costText } from './cost-confirmation';
import CostConfirmationForm from './cost-confirmation-form.vue';

const props = defineProps<{
  active: boolean;
  purchaseInId?: number;
  reloadKey?: number;
}>();
const emit = defineEmits<{ success: [] }>();
const { hasAccessByCodes } = useAccess();
const canQuery = computed(() =>
  hasAccessByCodes(['erp:purchase-cost-confirmation:query']),
);
const header = ref<PurchaseCostApi.Header>();
const rows = ref<PurchaseCostApi.Item[]>([]);
const pageNo = ref(1);
const total = ref(0);
const loading = ref(false);
const error = ref('');
const showForm = ref(false);
const canConfirm = computed(
  () =>
    canQuery.value &&
    hasAccessByCodes(['erp:purchase-cost-confirmation:confirm']) &&
    header.value &&
    !header.value.costMasked &&
    header.value.canConfirm === true &&
    ['NONE', 'STALE', 'CONFIRMED'].includes(header.value.status),
);
let version = 0;
const columns = [
  { title: '来源行', dataIndex: 'sourceItemId', width: 90 },
  { title: '配件', dataIndex: 'product', width: 210 },
  { title: '仓库', dataIndex: 'warehouseId', width: 90 },
  { title: '数量', dataIndex: 'quantity', width: 100 },
  { title: '原含税单价', dataIndex: 'rawUnitPrice', width: 140 },
  { title: '原含税金额', dataIndex: 'rawLineAmount', width: 160 },
  {
    title: '确认未税成本总额（两套同额）',
    dataIndex: 'confirmedNetTotalAmount',
    width: 240,
  },
  { title: '明细依据', dataIndex: 'evidence', width: 220 },
];
async function load(reset = false) {
  const request = ++version;
  if (!canQuery.value || !props.active || !props.purchaseInId) {
    header.value = undefined;
    rows.value = [];
    return;
  }
  if (reset) pageNo.value = 1;
  loading.value = true;
  error.value = '';
  rows.value = [];
  header.value = undefined;
  try {
    const preview = await getPurchaseCostPreview(props.purchaseInId);
    if (request !== version) return;
    if (preview.status === 'SCHEMA_MISSING') {
      header.value = preview;
      total.value = 0;
      return;
    }
    const [confirmation, page] = await Promise.all([
      getPurchaseCostConfirmation(props.purchaseInId),
      getPurchaseCostItems(
        props.purchaseInId,
        preview.sourceSignature,
        pageNo.value,
        20,
      ),
    ]);
    if (request !== version || !canQuery.value) return;
    if (
      confirmation.sourceSignature !== preview.sourceSignature ||
      confirmation.latestRevision !== preview.latestRevision ||
      page.list.some((row) => row.sourceSignature !== preview.sourceSignature)
    )
      throw new Error('来源版本已变化，请刷新重新核对');
    header.value = {
      ...preview,
      ...confirmation,
      costMasked: preview.costMasked || confirmation.costMasked,
      canConfirm:
        preview.canConfirm === true && confirmation.canConfirm === true,
    };
    rows.value = page.list;
    total.value = page.total;
  } catch (cause) {
    if (request === version)
      error.value = cause instanceof Error ? cause.message : '核算成本加载失败';
  } finally {
    if (request === version) loading.value = false;
  }
}
const tableChange: NonNullable<TableProps<PurchaseCostApi.Item>['onChange']> = (
  pagination,
) => {
  pageNo.value = pagination.current || 1;
  void load();
};
function confirmed() {
  showForm.value = false;
  void load(true);
  emit('success');
}
watch(
  () => [props.active, props.purchaseInId, props.reloadKey, canQuery.value],
  () => {
    showForm.value = false;
    void load(true);
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  version++;
});
</script>
<template>
  <section class="p-3">
    <Alert v-if="!canQuery" type="warning" message="没有采购核算成本查询权限" />
    <template v-else>
      <div class="mb-3 flex items-center gap-2">
        <Button :loading="loading" @click="load(true)">刷新核算状态</Button
        ><Button
          v-if="canConfirm"
          type="primary"
          :disabled="loading"
          @click="showForm = true"
          >{{
            header?.status === 'CONFIRMED'
              ? '重新确认成本（新版本）'
              : '确认未税成本'
          }}</Button
        ><Tag v-if="header">{{ costStatusLabels[header.status] }}</Tag>
      </div>
      <Alert v-if="error" type="error" :message="error" class="mb-2" />
      <template v-if="header">
        <Alert
          v-if="header.reason"
          type="warning"
          :message="header.reason"
          class="mb-2"
        />
        <Alert
          v-if="header.confirmBlockedReason"
          type="warning"
          :message="header.confirmBlockedReason"
          class="mb-2"
        />
        <p class="mb-2">
          采购审核成功即入库过账。原采购价暂按含税展示，税率未知；未税成本以明确核对结果为准。来源修改后，原确认自动失效。
        </p>
        <div class="mb-2 flex flex-wrap gap-3">
          <span>确认版本：{{ header.latestRevision }}</span
          ><span
            >原商品金额：{{
              costText(header.rawProductAmount, header.costMasked)
            }}</span
          ><span
            >折扣金额：{{
              costText(header.discountAmount, header.costMasked)
            }}</span
          ><span>费用：{{ costText(header.feeAmount, header.costMasked) }}</span
          ><span>运费1：{{ costText(header.freight1, header.costMasked) }}</span
          ><span
            >运费2：{{ costText(header.freight2, header.costMasked) }}</span
          >
        </div>
        <p v-if="header.confirmedAt" class="mb-2">
          确认时间：{{ header.confirmedAt }}
        </p>
        <p class="mb-2">
          核对依据：{{
            header.costMasked ? '****' : header.evidence || '未记录'
          }}；费用及折扣处理：{{
            header.costMasked ? '****' : header.feeTreatment || '未记录'
          }}
        </p>
        <Table
          v-if="header.status !== 'SCHEMA_MISSING'"
          row-key="sourceItemId"
          :data-source="rows"
          :columns="columns"
          :loading="loading"
          size="small"
          bordered
          :scroll="{ x: 'max-content' }"
          :pagination="{
            current: pageNo,
            pageSize: 20,
            total,
            showSizeChanger: false,
          }"
          @change="tableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'product'"
              >{{
                [record.productCode, record.productName]
                  .filter(Boolean)
                  .join(' ') || `配件 #${record.productId}`
              }}{{ record.gift ? '（赠品）' : '' }}</template
            >
            <template v-else-if="column.dataIndex === 'rawUnitPrice'">{{
              costText(record.rawUnitPrice, header.costMasked)
            }}</template>
            <template v-else-if="column.dataIndex === 'rawLineAmount'">{{
              costText(record.rawLineAmount, header.costMasked)
            }}</template>
            <template
              v-else-if="column.dataIndex === 'confirmedNetTotalAmount'"
              >{{
                costText(record.confirmedNetTotalAmount, header.costMasked)
              }}</template
            >
            <template v-else-if="column.dataIndex === 'evidence'">{{
              header.costMasked ? '****' : record.evidence || '未记录'
            }}</template>
          </template>
        </Table>
      </template>
      <CostConfirmationForm
        v-if="showForm && header && canConfirm"
        :header="header"
        @close="showForm = false"
        @success="confirmed"
      />
    </template>
  </section>
</template>
