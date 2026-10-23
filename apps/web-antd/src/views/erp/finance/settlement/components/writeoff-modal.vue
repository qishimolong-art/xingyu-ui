<script lang="ts" setup>import { financeValue, financeSubtract, financeAdd, financeCompare, financeMax, financeMin, financeSign, financeAbs } from '#/views/erp/finance/utils/finance-decimal';

import DecimalAmountInput from '#/views/erp/components/DecimalAmountInput.vue';
import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import type { TableProps } from 'ant-design-vue';
import type { ErpFinancePaymentApi } from '#/api/erp/finance/payment';
import type { ErpFinanceReceiptApi } from '#/api/erp/finance/receipt';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';


import {
  Alert,
  Descriptions,
  DescriptionsItem,
  Input,
  InputNumber,
  message,
  Table,
} from 'ant-design-vue';

import {
  getFinancePaymentWriteOffCandidates,
  writeOffFinancePayment,
} from '#/api/erp/finance/payment';
import {
  getFinanceReceiptWriteOffCandidates,
  writeOffFinanceReceipt,
} from '#/api/erp/finance/receipt';

type WriteOffType = 'payment' | 'receipt';
type FinanceRecord =
  | ErpFinancePaymentApi.FinancePayment
  | ErpFinanceReceiptApi.FinanceReceipt;
type Candidate =
  | ErpFinancePaymentApi.WriteOffCandidate
  | ErpFinanceReceiptApi.WriteOffCandidate;

const emit = defineEmits<{ success: [] }>();
const writeOffType = ref<WriteOffType>('receipt');
const financeRecord = ref<FinanceRecord>();
const candidates = ref<Candidate[]>([]);
const selectedRowKeys = ref<string[]>([]);
const loading = ref(false);

const isReceipt = computed(() => writeOffType.value === 'receipt');
const title = computed(() => (isReceipt.value ? '收款单核销' : '付款单核销'));
const totalPrice = computed(() => financeValue(financeRecord.value?.totalPrice || 0));
const allocatedPrice = computed(() =>
  financeValue(financeRecord.value?.allocatedPrice || 0),
);
const unallocatedPrice = computed(() =>
  financeValue(financeRecord.value?.unallocatedPrice ??
      financeSubtract(totalPrice.value, allocatedPrice.value)),
);
const currentWriteOffPrice = computed(() =>
  candidates.value
    .filter((item) => selectedRowKeys.value.includes(rowKey(item)))
    .reduce((sum, item) => financeAdd(sum, financeValue(item.writeOffAmount || 0)), 0),
);
const afterUnallocatedPrice = computed(
  () => financeSubtract(unallocatedPrice.value, currentWriteOffPrice.value),
);

function rowKey(row: Record<string, any>) {
  return `${row.bizType}:${row.bizId}`;
}

function formatAmount(value?: number) {
  return erpPriceInputFormatter(Number(value || 0));
}

const columns: TableProps['columns'] = [
  { title: '业务类型', dataIndex: 'bizTypeName', width: 100 },
  { title: '业务单号', dataIndex: 'bizNo', width: 180 },
  { title: '业务日期', dataIndex: 'bizTime', width: 160 },
  {
    title: '应收/应付金额',
    dataIndex: 'totalPrice',
    width: 130,
    align: 'right',
  },
  {
    title: '已核销金额',
    dataIndex: 'allocatedPrice',
    width: 120,
    align: 'right',
  },
  {
    title: '可核销金额',
    dataIndex: 'unallocatedPrice',
    width: 120,
    align: 'right',
  },
  {
    title: '本次核销金额',
    dataIndex: 'writeOffAmount',
    width: 160,
    align: 'right',
  },
  { title: '备注', dataIndex: 'remark', width: 180 },
];

const rowSelection = computed<TableProps['rowSelection']>(() => ({
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys) => {
    const nextKeys = keys.map(String);
    for (const item of candidates.value) {
      const key = rowKey(item);
      if (nextKeys.includes(key) && !selectedRowKeys.value.includes(key)) {
        const remaining = financeValue(item.unallocatedPrice || 0);
        if ((financeCompare(remaining, 0) < 0)) {
          item.writeOffAmount = remaining;
        } else {
          const otherNet = candidates.value
            .filter(
              (row) => nextKeys.includes(rowKey(row)) && rowKey(row) !== key,
            )
            .reduce((sum, row) => financeAdd(sum, financeValue(row.writeOffAmount || 0)), 0);
          item.writeOffAmount = financeMin(remaining, financeMax(0, financeSubtract(unallocatedPrice.value, otherNet)));
        }
      }
      if (!nextKeys.includes(key)) item.writeOffAmount = undefined;
    }
    selectedRowKeys.value = nextKeys;
  },
}));

function validateSelection() {
  if (selectedRowKeys.value.length === 0) {
    throw new Error('请至少选择一张业务单据');
  }
  const selected = candidates.value.filter((item) =>
    selectedRowKeys.value.includes(rowKey(item)),
  );
  for (const item of selected) {
    const amount = financeValue(item.writeOffAmount || 0);
    const remaining = financeValue(item.unallocatedPrice || 0);
    if (
      (financeCompare(amount, 0) === 0) ||
      (financeCompare(financeSign(amount), financeSign(remaining)) !== 0) ||
      (financeCompare(financeAbs(amount), financeAbs(remaining)) > 0)
    ) {
      throw new Error(`业务单据 ${item.bizNo} 的核销金额不在可核销范围内`);
    }
  }
  if (
    (financeCompare(afterUnallocatedPrice.value, 0) < 0) ||
    (financeCompare(financeAdd(allocatedPrice.value, currentWriteOffPrice.value), 0) < 0)
  ) {
    throw new Error('本次核销净额超过收/付款单可用额度');
  }
  return selected;
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    let selected: Candidate[];
    try {
      selected = validateSelection();
    } catch (error: any) {
      message.error(error.message);
      return;
    }
    modalApi.lock();
    try {
      const items = selected.map((item) => ({
        bizId: item.bizId,
        bizType: item.bizType,
        remark: item.remark,
        writeOffAmount: financeValue(item.writeOffAmount),
      }));
      if (isReceipt.value) {
        await writeOffFinanceReceipt({
          receiptId: financeRecord.value!.id!,
          items,
        });
      } else {
        await writeOffFinancePayment({
          paymentId: financeRecord.value!.id!,
          items,
        });
      }
      message.success('核销成功');
      await modalApi.close();
      emit('success');
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(open) {
    if (!open) {
      candidates.value = [];
      selectedRowKeys.value = [];
      return;
    }
    const data = modalApi.getData<{
      record: FinanceRecord;
      type: WriteOffType;
    }>();
    writeOffType.value = data.type;
    financeRecord.value = data.record;
    loading.value = true;
    try {
      candidates.value = isReceipt.value
        ? await getFinanceReceiptWriteOffCandidates(data.record.id!)
        : await getFinancePaymentWriteOffCandidates(data.record.id!);
    } finally {
      loading.value = false;
    }
  },
});
</script>

<template>
  <Modal
    :title="title"
    class="!w-[85vw]"
    :ok-text="`确认核销（已选 ${selectedRowKeys.length} 条）`"
  >
    <div class="flex h-[70vh] min-h-0 flex-col gap-3 overflow-hidden px-2 py-2">
      <Alert
        message="核销只建立收/付款单与业务单据的关联，不会再次减少应收或应付总余额。"
        type="info"
        show-icon
      />
      <Descriptions bordered size="small" :column="4">
        <DescriptionsItem :label="isReceipt ? '收款单号' : '付款单号'">
          {{ financeRecord?.no || '-' }}
        </DescriptionsItem>
        <DescriptionsItem :label="isReceipt ? '客户' : '供应商'">
          {{
            isReceipt
              ? (financeRecord as any)?.customerName || '-'
              : (financeRecord as any)?.supplierName || '-'
          }}
        </DescriptionsItem>
        <DescriptionsItem label="所属部门">
          {{ financeRecord?.deptName || '-' }}
        </DescriptionsItem>
        <DescriptionsItem label="总结算金额">
          {{ formatAmount(totalPrice) }}
        </DescriptionsItem>
        <DescriptionsItem label="已核销金额">
          {{ formatAmount(allocatedPrice) }}
        </DescriptionsItem>
        <DescriptionsItem label="本次核销净额">
          {{ formatAmount(currentWriteOffPrice) }}
        </DescriptionsItem>
        <DescriptionsItem label="核销后未核销金额" :span="2">
          <b
            :class="
              afterUnallocatedPrice < 0 ? 'text-destructive' : 'text-primary'
            "
          >
            {{ formatAmount(afterUnallocatedPrice) }}
          </b>
        </DescriptionsItem>
      </Descriptions>
      <div class="min-h-0 flex-1 overflow-hidden">
        <Table
          :columns="columns"
          :data-source="candidates"
          :loading="loading"
          :pagination="false"
          :row-key="rowKey"
          :row-selection="rowSelection"
          :scroll="{ x: 'max-content', y: 'calc(70vh - 250px)' }"
          bordered
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'bizTime'">
              {{
                record.bizTime ? String(record.bizTime).replace('T', ' ') : '-'
              }}
            </template>
            <template
              v-else-if="
                ['totalPrice', 'allocatedPrice', 'unallocatedPrice'].includes(
                  String(column.dataIndex),
                )
              "
            >
              {{ formatAmount(record[String(column.dataIndex)]) }}
            </template>
            <template v-else-if="column.dataIndex === 'writeOffAmount'">
              <DecimalAmountInput
                v-model:value="record.writeOffAmount"
                class="w-full"
                :disabled="!selectedRowKeys.includes(rowKey(record))"
                placeholder="请输入核销金额"
              />
            </template>
            <template v-else-if="column.dataIndex === 'remark'">
              <Input
                v-model:value="record.remark"
                :disabled="!selectedRowKeys.includes(rowKey(record))"
                placeholder="请输入备注"
              />
            </template>
          </template>
        </Table>
      </div>
    </div>
  </Modal>
</template>
