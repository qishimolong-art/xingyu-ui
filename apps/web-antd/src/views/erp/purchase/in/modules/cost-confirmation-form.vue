<script setup lang="ts">
import type { PurchaseCostApi } from '#/api/erp/purchase/cost-confirmation';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useAccess } from '@vben/access';
import { buildUUID } from '@vben/utils';
import { Alert, Input, InputNumber, Modal, Table } from 'ant-design-vue';
import {
  confirmPurchaseCost,
  getPurchaseCostPreview,
} from '#/api/erp/purchase/cost-confirmation';
import {
  costText,
  formatCostAmountInput,
  loadCompleteCostItems,
  validateCostConfirmation,
} from './cost-confirmation';

const props = defineProps<{ header: PurchaseCostApi.Header }>();
const emit = defineEmits<{ close: []; success: [] }>();
const { hasAccessByCodes } = useAccess();
const allowed = computed(
  () =>
    hasAccessByCodes(['erp:purchase-cost-confirmation:query']) &&
    hasAccessByCodes(['erp:purchase-cost-confirmation:confirm']) &&
    !props.header.costMasked &&
    props.header.canConfirm === true &&
    ['NONE', 'STALE', 'CONFIRMED'].includes(props.header.status),
);
const rows = ref<PurchaseCostApi.Item[]>([]);
const loading = ref(true);
const submitting = ref(false);
const error = ref('');
const evidence = ref('');
const feeTreatment = ref('');
let disposed = false;
// 相同内容重试保留请求标识；修改内容后另建标识，避免超时重试重复确认。
let requestKey = buildUUID();
let lastPayload = '';
const columns = [
  { title: '来源行', dataIndex: 'sourceItemId', width: 90 },
  { title: '配件', dataIndex: 'product', width: 200 },
  { title: '仓库', dataIndex: 'warehouseId', width: 80 },
  { title: '数量', dataIndex: 'quantity', width: 110 },
  { title: '原含税金额（税率未知）', dataIndex: 'rawLineAmount', width: 180 },
  {
    title: '上一版本确认未税总额',
    dataIndex: 'previousConfirmedNetTotalAmount',
    width: 180,
  },
  {
    title: '确认未税成本总额',
    dataIndex: 'confirmedNetTotalAmount',
    width: 240,
  },
  { title: '明细依据', dataIndex: 'evidence', width: 240 },
];
onMounted(async () => {
  if (!allowed.value) {
    loading.value = false;
    return;
  }
  try {
    const items = await loadCompleteCostItems(props.header);
    if (!disposed)
      rows.value = items.map((row) => ({
        ...row,
        previousConfirmedNetTotalAmount: row.confirmedNetTotalAmount,
        confirmedNetTotalAmount: undefined,
        evidence: '',
      }));
  } catch (cause) {
    if (!disposed)
      error.value = cause instanceof Error ? cause.message : '来源明细加载失败';
  } finally {
    if (!disposed) loading.value = false;
  }
});
onBeforeUnmount(() => {
  disposed = true;
});
async function submit() {
  if (!allowed.value || loading.value || submitting.value) return;
  error.value =
    validateCostConfirmation(rows.value, evidence.value, feeTreatment.value) ||
    '';
  if (error.value) return;
  submitting.value = true;
  try {
    const body = {
      purchaseInId: props.header.purchaseInId,
      expectedSignature: props.header.sourceSignature,
      expectedRevision: props.header.latestRevision,
      evidence: evidence.value.trim(),
      feeTreatment: feeTreatment.value.trim(),
      items: rows.value.map((row) => ({
        sourceItemId: row.sourceItemId,
        confirmedNetTotalAmount: row.confirmedNetTotalAmount!,
        evidence: row.evidence?.trim() || evidence.value.trim(),
      })),
    };
    const encoded = JSON.stringify(body);
    if (encoded !== lastPayload) {
      const current = await getPurchaseCostPreview(props.header.purchaseInId);
      if (
        current.costMasked ||
        current.canConfirm !== true ||
        current.sourceSignature !== props.header.sourceSignature ||
        current.latestRevision !== props.header.latestRevision ||
        !['NONE', 'STALE', 'CONFIRMED'].includes(current.status)
      )
        throw new Error('来源或确认版本已变化，请保留核对依据并关闭后重新加载');
    }
    if (!allowed.value || disposed) return;
    if (lastPayload && lastPayload !== encoded) requestKey = buildUUID();
    lastPayload = encoded;
    await confirmPurchaseCost({ ...body, requestKey });
    if (!disposed) {
      emit('success');
      emit('close');
    }
  } catch (cause) {
    if (!disposed)
      error.value =
        cause instanceof Error
          ? cause.message
          : '确认失败，已保留输入，请核对后重试';
  } finally {
    if (!disposed) submitting.value = false;
  }
}
</script>
<template>
  <Modal
    :open="true"
    title="确认采购未税成本"
    :width="1160"
    ok-text="确认全部明细成本"
    :confirm-loading="submitting"
    :closable="!submitting"
    :mask-closable="false"
    :cancel-button-props="{ disabled: submitting }"
    :ok-button-props="{ disabled: !allowed || loading || !rows.length }"
    @ok="submit"
    @cancel="!submitting && emit('close')"
  >
    <Alert
      v-if="!allowed"
      message="没有成本确认权限或成本字段不可见"
      type="warning"
    />
    <template v-else>
      <p class="mb-2">
        {{ header.purchaseNo || `采购入库 #${header.purchaseInId}` }} · 共
        {{ header.sourceItemCount }}
        条来源明细。采购审核成功即入库过账，两套成本使用同一确认金额。
      </p>
      <p v-if="header.status === 'CONFIRMED'" class="mb-2">
        本次确认将生成新版本并保留旧版本。上一版金额仅供核对，请明确填写本次成本及新的核对依据。
      </p>
      <Alert
        type="info"
        show-icon
        message="原采购价暂按含税展示，税率未知。请依据核对结果逐行填写未税成本总额；系统不会从原价倒推，也不会自动分摊折扣或费用。"
        class="mb-2"
      />
      <Alert v-if="error" type="error" :message="error" class="mb-2" />
      <Table
        row-key="sourceItemId"
        :data-source="rows"
        :columns="columns"
        :loading="loading"
        size="small"
        bordered
        :scroll="{ x: 'max-content', y: 360 }"
        :pagination="{
          pageSize: 20,
          showTotal: (count: number) => `共 ${count} 条，提交覆盖全部明细`,
        }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'product'"
            >{{
              [record.productCode, record.productName]
                .filter(Boolean)
                .join(' ') || `配件 #${record.productId}`
            }}{{ record.gift ? '（赠品）' : '' }}</template
          >
          <template v-else-if="column.dataIndex === 'confirmedNetTotalAmount'"
            ><InputNumber
              v-model:value="record.confirmedNetTotalAmount"
              :aria-label="`未税成本-${record.sourceItemId}`"
              string-mode
              :precision="6"
              :min="'0'"
              :formatter="formatCostAmountInput"
              :disabled="submitting"
              placeholder="请核对后填写"
              class="w-full"
          /></template>
          <template v-else-if="column.dataIndex === 'evidence'"
            ><Input
              v-model:value="record.evidence"
              :aria-label="`明细依据-${record.sourceItemId}`"
              :maxlength="1000"
              :disabled="submitting"
              placeholder="未填使用整单核对依据"
          /></template>
          <template v-else-if="column.dataIndex === 'rawLineAmount'">{{
            costText(record.rawLineAmount, header.costMasked)
          }}</template>
          <template
            v-else-if="column.dataIndex === 'previousConfirmedNetTotalAmount'"
            >{{
              costText(
                record.previousConfirmedNetTotalAmount,
                header.costMasked,
              )
            }}</template
          >
        </template>
      </Table>
      <label class="mt-3 block"
        >费用及折扣处理说明<Input.TextArea
          v-model:value="feeTreatment"
          aria-label="费用及折扣处理"
          :maxlength="1000"
          :disabled="submitting"
          placeholder="说明折扣、费用与运费是否及如何纳入各行成本；未发生也需明确说明"
      /></label>
      <label class="mt-3 block"
        >核对依据<Input.TextArea
          v-model:value="evidence"
          aria-label="核对依据"
          :maxlength="1000"
          :disabled="submitting"
          placeholder="填写核对凭据、计算依据或审批说明"
      /></label>
    </template>
  </Modal>
</template>
