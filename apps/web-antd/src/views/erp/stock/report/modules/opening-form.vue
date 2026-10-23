<script setup lang="ts">
import DecimalAmountInput from '#/views/erp/components/DecimalAmountInput.vue';
/* eslint-disable vue/html-closing-bracket-newline -- Oxfmt manages multiline template layout. */
import type { StockReportV2Api } from '#/api/erp/report/stock-v2';

import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';

import { useAccess } from '@vben/access';

import { Alert, DatePicker, Input, Modal, Select } from 'ant-design-vue';

import {
  confirmStockReportOpening,
  getReportProductOptions,
} from '#/api/erp/report/stock-v2';
import { getStockWarehouseFilterOptions } from '#/api/erp/stock/warehouse';
import {
  stockInput,
  validateStockStorage,
} from '#/views/erp/stock/utils/stock-decimal';

import { validateOpening } from '../report-v2-ui';

const props = defineProps<{ cutoverAt?: string }>();
const emit = defineEmits<{ close: []; success: [] }>();
const { hasAccessByCodes } = useAccess();
const canConfirm = () => hasAccessByCodes(['erp:report-stock-opening:confirm']);
const form = reactive<Partial<StockReportV2Api.Opening>>({
  cutoverAt: props.cutoverAt,
});
const submitting = ref(false);
const error = ref('');
const products = ref<Array<{ label: string; value: number }>>([]);
const warehouses = ref<
  Array<{ disabled?: boolean; label: string; value: number }>
>([]);
let productRequest = 0;
let disposed = false;

async function loadProducts(keyword = '') {
  if (!canConfirm()) return;
  const request = ++productRequest;
  try {
    const result = await getReportProductOptions(keyword, form.warehouseId);
    if (!disposed && request === productRequest)
      products.value = result.list.map((row) => ({
        label: `${row.code || ''} ${row.name}`.trim(),
        value: row.id,
      }));
  } catch (error_) {
    if (!disposed && request === productRequest)
      error.value =
        error_ instanceof Error ? error_.message : '配件选项加载失败';
  }
}

onMounted(async () => {
  if (!canConfirm()) return;
  void loadProducts();
  try {
    const list = await getStockWarehouseFilterOptions();
    if (!disposed)
      warehouses.value = list
        .filter((row) => row.id !== undefined)
        .map((row) => ({
          value: row.id!,
          label: `${row.displayName}${row.status && row.status !== 0 ? '（不可用）' : ''}`,
          disabled: row.status !== undefined && row.status !== 0,
        }));
  } catch (error_) {
    if (!disposed)
      error.value =
        error_ instanceof Error ? error_.message : '仓库选项加载失败';
  }
});
onBeforeUnmount(() => {
  disposed = true;
  productRequest++;
});
watch(
  () => form.warehouseId,
  () => {
    form.productId = undefined;
    void loadProducts();
  },
);

async function submit() {
  if (submitting.value || !canConfirm()) return;
  try {
    for (const field of [
      'quantity',
      'financialAmount',
      'settlementAmount',
    ] as const) {
      const value = stockInput(form[field], { allowZero: true });
      validateStockStorage(value, field);
      form[field] = value;
    }
  } catch (error_) {
    error.value = (error_ as Error).message;
    return;
  }
  error.value = validateOpening(form) || '';
  if (error.value) return;
  submitting.value = true;
  try {
    await confirmStockReportOpening({
      ...form,
      evidence: form.evidence!.trim(),
    } as StockReportV2Api.Opening);
    emit('success');
    emit('close');
  } catch (error_) {
    error.value =
      error_ instanceof Error ? error_.message : '期初确认失败，请核对后重试';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Modal
    :open="true"
    title="库存核算期初确认"
    :width="720"
    ok-text="确认核对结果"
    :confirm-loading="submitting"
    :closable="!submitting"
    :mask-closable="!submitting"
    :cancel-button-props="{ disabled: submitting }"
    :ok-button-props="{ disabled: !canConfirm() }"
    @ok="submit"
    @cancel="!submitting && emit('close')"
  >
    <Alert
      v-if="!canConfirm()"
      type="warning"
      message="没有库存核算期初确认权限"
      show-icon
    />
    <template v-else>
      <p class="mb-3 text-sm text-muted-foreground">
        按配件与仓库逐项确认两套期初成本。请使用已核对的数量、金额及切换时间；没有依据的金额请保留为空。
      </p>
      <Alert
        v-if="error"
        class="mb-3"
        type="error"
        :message="error"
        show-icon
      />
      <div class="grid grid-cols-2 gap-3">
        <label
          >仓库
          <Select
            v-model:value="form.warehouseId"
            :disabled="submitting"
            class="mt-1 w-full"
            aria-label="期初仓库"
            show-search
            option-filter-prop="label"
            :options="warehouses"
            placeholder="请选择有权限的仓库"
          />
        </label>
        <label
          >切换时间
          <DatePicker
            v-model:value="form.cutoverAt"
            :disabled="submitting"
            class="mt-1 w-full"
            aria-label="切换时间"
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="请选择核算切换时间"
          />
        </label>
        <label class="col-span-2"
          >配件
          <Select
            v-model:value="form.productId"
            :disabled="submitting"
            class="mt-1 w-full"
            aria-label="期初配件"
            show-search
            :filter-option="false"
            :options="products"
            placeholder="输入配件名称或编码搜索（切换仓库会清除已选配件）"
            @search="loadProducts"
          />
        </label>
        <label
          >核对数量
          <Input
            v-model:value="form.quantity"
            :disabled="submitting"
            class="mt-1 w-full"
            aria-label="核对数量"
            :min="0"
            inputmode="decimal"
            placeholder="必填，未核对不填0"
          />
        </label>
        <label
          >财务成本金额
          <DecimalAmountInput
            v-model:value="form.financialAmount"
            :disabled="submitting"
            class="mt-1 w-full"
            aria-label="财务成本金额"
            :min="0"
            inputmode="decimal"
            placeholder="必填"
          />
        </label>
        <label
          >部门结算成本金额
          <DecimalAmountInput
            v-model:value="form.settlementAmount"
            :disabled="submitting"
            class="mt-1 w-full"
            aria-label="部门结算成本金额"
            :min="0"
            inputmode="decimal"
            placeholder="必填"
          />
        </label>
        <label class="col-span-2"
          >核对依据
          <Input.TextArea
            v-model:value="form.evidence"
            :disabled="submitting"
            class="mt-1"
            aria-label="核对依据"
            :rows="3"
            :maxlength="500"
            show-count
            placeholder="填写盘点、对账依据及确认说明"
          />
        </label>
      </div>
    </template>
  </Modal>
</template>
