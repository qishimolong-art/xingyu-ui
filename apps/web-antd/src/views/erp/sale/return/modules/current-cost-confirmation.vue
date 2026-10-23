<script setup lang="ts">
import type { SaleReturnCurrentCostApi } from '#/api/erp/sale/return/current-cost';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useAccess } from '@vben/access';
import { buildUUID } from '@vben/utils';
import { Alert, Input, InputNumber, Modal, Table } from 'ant-design-vue';
import {
  confirmSaleReturnCurrentCost,
  getSaleReturnCurrentCostPreview,
} from '#/api/erp/sale/return/current-cost';
import {
  currentCostRowText,
  loadCompleteCurrentCostItems,
  validateCurrentCost,
} from './current-cost';
const props = defineProps<{ header: SaleReturnCurrentCostApi.Header }>();
const emit = defineEmits<{ close: []; success: [] }>();
const { hasAccessByCodes } = useAccess();
const allowed = computed(
  () =>
    hasAccessByCodes(['erp:sale-return-current-cost:confirm']) &&
    (hasAccessByCodes(['erp:sale-return-current-cost:query']) ||
      hasAccessByCodes(['erp:sale-return:confirm']) ||
      hasAccessByCodes(['erp:sale-return:update-status'])) &&
    props.header.canConfirm &&
    !props.header.costMasked,
);
const rows = ref<SaleReturnCurrentCostApi.Item[]>([]);
const loading = ref(true);
const submitting = ref(false);
const error = ref('');
const evidence = ref('');
let disposed = false;
let requestKey = buildUUID();
let lastPayload = '';
const columns = [
  { title: '来源明细', dataIndex: 'sourceItemId', width: 90 },
  { title: '配件', dataIndex: 'productName', width: 180 },
  { title: '仓库', dataIndex: 'warehouseName', width: 130 },
  { title: '退入数量', dataIndex: 'quantity', width: 110 },
  { title: '财务成本总额', dataIndex: 'financialAmount', width: 230 },
  { title: '部门结算成本总额', dataIndex: 'settlementAmount', width: 230 },
  { title: '明细依据', dataIndex: 'evidence', width: 230 },
];
onMounted(async () => {
  try {
    if (allowed.value) {
      const items = await loadCompleteCurrentCostItems(props.header);
      if (!disposed)
        rows.value = items.map((item) => ({ ...item, evidence: '' }));
    }
  } catch (cause) {
    if (!disposed)
      error.value = cause instanceof Error ? cause.message : '成本明细加载失败';
  } finally {
    if (!disposed) loading.value = false;
  }
});
onBeforeUnmount(() => {
  disposed = true;
});
async function submit() {
  if (!allowed.value || loading.value || submitting.value) return;
  error.value = validateCurrentCost(rows.value, evidence.value) || '';
  if (error.value) return;
  submitting.value = true;
  try {
    const body = {
      id: props.header.id,
      expectedSourceSignature: props.header.sourceSignature,
      expectedBasisSignature: props.header.basisSignature,
      expectedRevision: props.header.latestRevision,
      evidence: evidence.value.trim(),
      items: rows.value.map((item) => ({
        sourceItemId: item.sourceItemId,
        financialAmount: item.financialAmount!,
        settlementAmount: item.settlementAmount!,
        evidence: item.evidence?.trim() || evidence.value.trim(),
      })),
    };
    const encoded = JSON.stringify(body);
    // 内容不变的超时重试沿用requestKey；改变输入必须重新核对来源/库存/确认版本。
    if (encoded !== lastPayload) {
      const latest = await getSaleReturnCurrentCostPreview(props.header.id);
      if (
        !latest.canConfirm ||
        latest.costMasked ||
        latest.sourceSignature !== props.header.sourceSignature ||
        latest.basisSignature !== props.header.basisSignature ||
        latest.latestRevision !== props.header.latestRevision
      )
        throw new Error(
          '来源、库存成本或确认版本已变化；输入已保留，请关闭后重新预览核对',
        );
    }
    if (!allowed.value || disposed) return;
    if (lastPayload && encoded !== lastPayload) requestKey = buildUUID();
    lastPayload = encoded;
    await confirmSaleReturnCurrentCost({ ...body, requestKey });
    if (!disposed) {
      emit('success');
      emit('close');
    }
  } catch (cause) {
    if (!disposed)
      error.value =
        cause instanceof Error ? cause.message : '确认失败，已保留输入';
  } finally {
    if (!disposed) submitting.value = false;
  }
}
</script>
<template>
  <Modal
    :open="true"
    title="补齐或修改无单退货成本"
    class="!w-[85vw]"
    :mask-closable="false"
    :closable="!submitting"
    :keyboard="!submitting"
    :confirm-loading="submitting"
    :ok-button-props="{ disabled: !allowed || loading || submitting }"
    :cancel-button-props="{ disabled: submitting }"
    ok-text="保存成本确认版本"
    @ok="submit"
    @cancel="!submitting && emit('close')"
  >
    <Alert
      v-if="!allowed"
      type="warning"
      message="没有成本确认权限，或当前单据不允许确认"
    />
    <template v-else>
      <Alert
        type="info"
        show-icon
        message="两套成本分别确认；退款单价不是入库成本。当前可用成本已带入，缺失项必须补齐；明确零成本也需依据。"
      />
      <Alert v-if="error" class="mt-2" type="error" :message="error" />
      <Input.TextArea
        v-model:value="evidence"
        class="my-2"
        placeholder="核对依据（必填，最多500字）"
        :maxlength="500"
        :disabled="submitting"
      />
      <Table
        class="current-cost-table"
        :columns="columns"
        :data-source="rows"
        row-key="sourceItemId"
        size="small"
        :loading="loading"
        :pagination="{
          pageSize: 20,
          showSizeChanger: false,
          showTotal: (total: number) => `完整来源共 ${total} 行`,
        }"
        :scroll="{ x: 'max-content', y: 'calc(70vh - 180px)' }"
      >
        <template #bodyCell="{ column, record }">
          <InputNumber
            v-if="column.dataIndex === 'financialAmount'"
            v-model:value="record.financialAmount"
            string-mode
            :min="0"
            :precision="6"
            :controls="false"
            class="w-full"
            :disabled="submitting"
            placeholder="必须明确填写"
          />
          <InputNumber
            v-else-if="column.dataIndex === 'settlementAmount'"
            v-model:value="record.settlementAmount"
            string-mode
            :min="0"
            :precision="6"
            :controls="false"
            class="w-full"
            :disabled="submitting"
            placeholder="必须明确填写"
          />
          <Input
            v-else-if="column.dataIndex === 'evidence'"
            v-model:value="record.evidence"
            :maxlength="500"
            :disabled="submitting"
            placeholder="可沿用整体依据"
          />
          <span v-else>{{ currentCostRowText(record, column.dataIndex) }}</span>
        </template>
      </Table>
    </template>
  </Modal>
</template>
<style scoped>
.current-cost-table :deep(.ant-table-body) {
  min-height: calc(70vh - 180px);
}
</style>
