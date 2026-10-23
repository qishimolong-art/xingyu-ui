<script setup lang="ts">
import { computed } from 'vue';
import { Alert, Table } from 'ant-design-vue';
import { ROLE_LABELS } from '#/api/erp/finance/accounting/voucher-rule';
const props = defineProps<{
  evidence?: Record<string, unknown>;
  snapshot?: string;
}>();
interface Evidence {
  source?: { header?: Record<string, unknown> };
  context?: {
    note?: string;
    taxAmount?: number;
    priceBasis?: string;
    discountNature?: string;
    feeConfirmed?: boolean;
  };
  template?: { name?: string; treatment?: string; basis?: string };
  matches?: {
    role: string;
    detailId?: number;
    sourceCategoryId?: number;
    matchedCategoryId?: number;
    categoryPath?: number[];
    subjectId: number;
    signedAmount: number;
    accountId?: number;
  }[];
}
const data = computed<Evidence>(() => {
  if (props.evidence) return props.evidence as Evidence;
  try {
    return JSON.parse(props.snapshot || '{}').evidence || {};
  } catch {
    return {};
  }
});
const labels: Record<string, string> = {
  totalProductPrice: '商品金额',
  discountPrice: '优惠金额',
  discountAmount: '优惠金额',
  feeAmount: '费用金额',
  otherPrice: '附加金额',
  totalPrice: '单据合计',
  actualAmount: '实际金额',
  receiptPrice: '实际收款',
  paymentPrice: '实际付款',
  transferPrice: '转账金额',
  feePrice: '转账手续费',
};
const amounts = computed(() =>
  Object.entries(data.value.source?.header || {})
    .filter(
      ([key, value]) => labels[key] && value !== null && value !== undefined,
    )
    .map(([key, value]) => ({
      label: labels[key],
      amount: Number(value).toFixed(2),
    })),
);
const matches = computed(() => data.value.matches || []);
</script>
<template>
  <div class="space-y-3">
    <Alert
      v-if="data.template"
      :message="data.template.name"
      :description="data.template.treatment"
    />
    <p v-if="data.template?.basis">
      <a :href="data.template.basis" target="_blank" rel="noreferrer"
        >查看财政部标准依据</a
      >
    </p>
    <div class="flex flex-wrap gap-x-5 gap-y-2">
      <span v-for="amount in amounts" :key="amount.label"
        >{{ amount.label }}：{{ amount.amount }} 元</span
      >
    </div>
    <p v-if="data.context">
      财务确认税额：{{ data.context.taxAmount ?? '不涉及' }}；金额口径：{{
        data.context.priceBasis === 'INCLUSIVE'
          ? '含税'
          : data.context.priceBasis === 'EXCLUSIVE'
            ? '未含税'
            : data.context.priceBasis === 'CNY'
              ? '人民币转账'
              : '不涉及'
      }}；优惠性质：{{
        data.context.discountNature === 'COMMERCIAL'
          ? '商业折扣'
          : data.context.discountNature === 'CASH'
            ? '现金折扣'
            : '无/不涉及'
      }}。
    </p>
    <Table
      :data-source="matches"
      :pagination="false"
      :scroll="{ x: 850, y: 240 }"
      :columns="[
        { title: '科目角色', key: 'role' },
        { title: '来源明细/账户', key: 'source' },
        { title: '类别匹配', key: 'category' },
        { title: '命中科目ID', dataIndex: 'subjectId' },
        { title: '金额及方向', key: 'amount' },
      ]"
    >
      <template #bodyCell="{ column, record }">
        <span v-if="column.key === 'role'">{{
          ROLE_LABELS[record.role] || '实际资金'
        }}</span>
        <span v-else-if="column.key === 'source'">{{
          record.accountId
            ? `账户 ${record.accountId}`
            : record.detailId
              ? `明细 ${record.detailId}`
              : '单据汇总'
        }}</span>
        <span v-else-if="column.key === 'category'"
          >{{
            record.categoryPath?.length
              ? record.categoryPath.join(' → ') + ' → '
              : ''
          }}{{
            record.matchedCategoryId
              ? `类别 ${record.matchedCategoryId}`
              : '默认科目'
          }}</span
        >
        <span v-else-if="column.key === 'amount'"
          >{{ Number(record.signedAmount) > 0 ? '借' : '贷' }}
          {{ Math.abs(Number(record.signedAmount)).toFixed(2) }}</span
        >
      </template>
    </Table>
    <p v-if="data.context?.note">财务依据说明：{{ data.context.note }}</p>
    <p class="text-gray-500">
      表内金额来自本次源单与库存流水。正向购销优惠按商品金额比例分摊，尾差计入最后一个有效明细；现金折扣列财务费用。已保存的依据反映生成时状态。
    </p>
  </div>
</template>
