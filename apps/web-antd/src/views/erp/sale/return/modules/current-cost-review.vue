<script setup lang="ts">
import type { SaleReturnCurrentCostApi } from '#/api/erp/sale/return/current-cost';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useAccess } from '@vben/access';
import { Alert, Button, Modal, Table } from 'ant-design-vue';
import { confirmSaleReturn } from '#/api/erp/sale/return';
import {
  getSaleReturnCurrentCostItems,
  getSaleReturnCurrentCostPreview,
} from '#/api/erp/sale/return/current-cost';
import CurrentCostConfirmation from './current-cost-confirmation.vue';
import {
  assertCostPage,
  currentCostRowText,
  currentCostStatusLabels,
  currentCostText,
} from './current-cost';

const emit = defineEmits<{ confirmed: [id: number] }>();
const { hasAccessByCodes } = useAccess();
const canQuery = computed(
  () =>
    hasAccessByCodes(['erp:sale-return-current-cost:query']) ||
    hasAccessByCodes(['erp:sale-return:confirm']) ||
    hasAccessByCodes(['erp:sale-return:update-status']),
);
const visible = ref(false);
const loading = ref(false);
const submitting = ref(false);
const error = ref('');
const header = ref<SaleReturnCurrentCostApi.Header>();
const rows = ref<SaleReturnCurrentCostApi.Item[]>([]);
const pageNo = ref(1);
const manual = ref(false);
const approvalMode = ref(false);
let epoch = 0;
let pageEpoch = 0;
const canOrderConfirm = computed(
  () =>
    canQuery.value &&
    approvalMode.value &&
    hasAccessByCodes(['erp:sale-return:confirm']) &&
    header.value?.canApprove &&
    !header.value.costMasked &&
    !error.value &&
    !loading.value,
);
const canConfirm = computed(
  () =>
    canQuery.value &&
    hasAccessByCodes(['erp:sale-return-current-cost:confirm']) &&
    header.value?.canConfirm &&
    !header.value.costMasked &&
    !error.value &&
    !loading.value,
);
const columns = [
  { title: '来源明细', dataIndex: 'sourceItemId', width: 90 },
  { title: '配件', dataIndex: 'productName', width: 180 },
  { title: '仓库', dataIndex: 'warehouseName', width: 130 },
  { title: '退入数量', dataIndex: 'quantity', width: 110 },
  { title: '财务成本总额', dataIndex: 'financialAmount', width: 170 },
  { title: '部门结算成本总额', dataIndex: 'settlementAmount', width: 170 },
  { title: '成本来源', dataIndex: 'costSource', width: 150 },
  { title: '状态说明', dataIndex: 'reason', width: 220 },
];
function close() {
  if (submitting.value) return;
  ++epoch;
  visible.value = false;
  manual.value = false;
  header.value = undefined;
  rows.value = [];
  error.value = '';
  loading.value = false;
}
watch(canQuery, (value) => {
  if (!value) close();
});
onBeforeUnmount(() => {
  ++epoch;
});
async function loadPage(page: number, token = epoch) {
  const basis = header.value;
  if (!basis || !canQuery.value) return;
  const pageToken = ++pageEpoch;
  loading.value = true;
  try {
    const result = await getSaleReturnCurrentCostItems(basis, page, 20);
    if (token !== epoch || pageToken !== pageEpoch || !canQuery.value) return;
    assertCostPage(basis, result);
    if (
      result.list.length !==
      Math.min(20, Math.max(0, basis.sourceItemCount - (page - 1) * 20))
    )
      throw new Error('本页成本明细不完整，请重新预览');
    rows.value = result.list;
    pageNo.value = page;
  } catch (cause) {
    if (token === epoch && pageToken === pageEpoch) {
      rows.value = [];
      error.value =
        cause instanceof Error ? cause.message : '明细加载失败，请重新预览';
    }
  } finally {
    if (token === epoch && pageToken === pageEpoch) loading.value = false;
  }
}
/** Only an explicit disabled response permits the caller's original approval flow. */
async function open(id: number, forApproval: boolean): Promise<boolean> {
  if (submitting.value) return true;
  const token = ++epoch;
  visible.value = true;
  manual.value = false;
  approvalMode.value = forApproval;
  header.value = undefined;
  rows.value = [];
  pageNo.value = 1;
  error.value = '';
  loading.value = true;
  try {
    if (!canQuery.value) throw new Error('没有成本预览权限，不能继续审核');
    const result = await getSaleReturnCurrentCostPreview(id);
    if (token !== epoch || !canQuery.value) return true;
    if (
      forApproval &&
      result.status === 'DISABLED' &&
      result.enabled === false
    ) {
      close();
      return false;
    }
    header.value = result;
    if (
      result.enabled &&
      result.sourceItemCount > 0 &&
      result.sourceSignature &&
      result.basisSignature
    )
      await loadPage(1, token);
  } catch (cause) {
    if (token === epoch)
      error.value =
        cause instanceof Error ? cause.message : '成本预检失败，未执行审核';
  } finally {
    if (token === epoch) loading.value = false;
  }
  return true;
}
async function refresh() {
  const id = header.value?.id;
  if (id) await open(id, approvalMode.value);
}
async function confirmOrder() {
  if (!canOrderConfirm.value || submitting.value || !header.value) return;
  const id = header.value.id;
  const signature = header.value.basisSignature;
  if (!signature) {
    error.value = '成本基准缺失，请重新预览';
    return;
  }
  submitting.value = true;
  try {
    await confirmSaleReturn(id, signature);
    submitting.value = false;
    close();
    emit('confirmed', id);
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : '下单确认失败，未自动改用新成本；请重新预览核对';
  } finally {
    submitting.value = false;
  }
}
defineExpose({
  close,
  prepareOrderConfirm: (id: number) => open(id, true),
  openView: (id: number) => open(id, false),
});
</script>
<template>
  <Modal
    :open="visible"
    title="无单销售退货成本核对"
    class="!w-[85vw]"
    :footer="null"
    :mask-closable="false"
    :closable="!submitting"
    :keyboard="!submitting"
    @cancel="close"
  >
    <Alert
      type="info"
      message="请核对本次退入库存的财务成本和部门结算成本；退款金额单独核算。成本缺失或需要修改时，请补齐成本与核对依据。"
    />
    <Alert v-if="error" class="mt-2" type="error" :message="error" />
    <template v-if="header && canQuery">
      <Alert
        class="my-2"
        :type="
          header.canApprove || header.status === 'POSTED' ? 'info' : 'warning'
        "
        :message="currentCostStatusLabels[header.status] || '状态待核对'"
        :description="header.reason"
      />
      <div class="my-2">
        {{ header.no }} · 完整来源 {{ header.sourceItemCount }} 行 ·
        财务成本：{{
          currentCostText(header.financialAmount, header.costMasked)
        }}
        · 部门结算成本：{{
          currentCostText(header.settlementAmount, header.costMasked)
        }}
      </div>
      <Table
        class="current-cost-table"
        :columns="columns"
        :data-source="rows"
        row-key="sourceItemId"
        size="small"
        :loading="loading"
        :pagination="{
          current: pageNo,
          pageSize: 20,
          total: header.sourceItemCount,
          showSizeChanger: false,
          onChange: (page: number) => loadPage(page),
        }"
        :scroll="{ x: 'max-content', y: 'calc(65vh - 170px)' }"
      >
        <template #bodyCell="{ column, record }">
          <span>{{
            currentCostRowText(record, column.dataIndex, header.costMasked)
          }}</span>
        </template>
      </Table>
    </template>
    <div class="mt-3 flex justify-end gap-2">
      <Button :disabled="submitting" @click="close">取消</Button>
      <Button v-if="header" :disabled="loading || submitting" @click="refresh"
        >重新预览</Button
      >
      <Button v-if="canConfirm" :disabled="submitting" @click="manual = true"
        >补齐或修改成本</Button
      >
      <Button
        v-if="approvalMode"
        type="primary"
        :loading="submitting"
        :disabled="!canOrderConfirm || submitting"
        @click="confirmOrder"
        >确认成本并下单确认</Button
      >
    </div>
    <CurrentCostConfirmation
      v-if="manual && header"
      :key="header.basisSignature"
      :header="header"
      @close="manual = false"
      @success="refresh"
    />
  </Modal>
</template>
<style scoped>
.current-cost-table :deep(.ant-table-body) {
  min-height: calc(65vh - 170px);
}
</style>
