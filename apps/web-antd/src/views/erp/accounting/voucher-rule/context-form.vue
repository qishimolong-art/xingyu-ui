<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  Alert,
  Checkbox,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
} from 'ant-design-vue';
import type {
  AccountingContext,
  Template,
} from '#/api/erp/finance/accounting/voucher-rule';
import {
  getAccountingContext,
  getAuxiliaryOptions,
  getRuleTemplates,
  previewVouchers,
  saveAccountingContext,
} from '#/api/erp/finance/accounting/voucher-rule';
import AuxiliaryEditor from './auxiliary-editor.vue';
const emit = defineEmits(['saved']);
const open = ref(false);
const busy = ref(false);
const changed = ref(false);
const value = ref<AccountingContext>();
const templates = ref<Template[]>([]);
const detailWeights = ref<
  { id: number; productId: number; count: number; totalPrice: number }[]
>([]);
const partyOptions = ref<{ value?: number; label?: string }[]>([]);
const current = computed(() =>
  templates.value.find((t) => t.code === value.value?.scenario),
);
const stockOnly = computed(() => [16, 17].includes(value.value?.bizType ?? 0));
const goods = computed(() => [2, 3, 8, 9].includes(value.value?.bizType ?? 0));
async function show(bizType: number, bizId: number) {
  busy.value = true;
  try {
    const [context, all, previews] = await Promise.all([
      getAccountingContext(bizType, bizId),
      getRuleTemplates(),
      previewVouchers([{ bizType, bizId }]),
    ]);
    changed.value = context.sourceVersion !== previews[0]?.sourceVersion;
    if (previews[0]?.sourceVersion)
      context.sourceVersion = previews[0].sourceVersion;
    const source = previews[0]?.evidence.source as
      | {
          details?: {
            id: number;
            productId: number;
            count: number;
            totalPrice: number;
          }[];
        }
      | undefined;
    detailWeights.value = source?.details || [];
    value.value = context;
    templates.value = all.filter((t) => t.bizType === bizType);
    open.value = true;
    await loadParty();
  } finally {
    busy.value = false;
  }
}
async function loadParty() {
  const type = value.value?.feePartyType;
  partyOptions.value = type
    ? (await getAuxiliaryOptions(type === 1 ? 'customer' : 'supplier')).map(
        (a) => ({ value: a.id, label: a.name }),
      )
    : [];
}
async function save() {
  if (!value.value) return;
  busy.value = true;
  try {
    await saveAccountingContext(value.value);
    message.success('记账信息已保存，请重新预览');
    open.value = false;
    emit('saved');
  } finally {
    busy.value = false;
  }
}
defineExpose({ show });
</script>
<template>
  <Modal
    v-model:open="open"
    title="补充记账信息"
    class="!w-[850px]"
    :confirm-loading="busy"
    :destroy-on-close="true"
    @ok="save"
  >
    <div v-if="value" class="max-h-[72vh] overflow-auto pr-3">
      <Alert
        v-if="changed"
        class="mb-3"
        type="warning"
        message="来源已变化，请重新核对以下信息；保存后使用当前来源版本。"
      />
      <Alert
        class="mb-3"
        message="这里只补充凭证依据，不修改业务单据金额。无法确定的情况请使用人工凭证。"
      />
      <Form layout="vertical">
        <FormItem label="业务性质"
          ><Select
            v-model:value="value.scenario"
            :options="templates.map((t) => ({ value: t.code, label: t.name }))"
          />
          <p class="mt-2 text-gray-500">{{ current?.treatment }}</p></FormItem
        >
        <FormItem v-if="[2, 3].includes(value.bizType)"
          ><Checkbox v-model:checked="value.revenueConfirmed"
            >已核实本次收入或退货确认条件</Checkbox
          ></FormItem
        >
        <FormItem label="优惠性质"
          ><Select
            v-model:value="value.discountNature"
            allow-clear
            :options="[
              { value: 'NONE', label: '无优惠' },
              { value: 'COMMERCIAL', label: '商业折扣（购销价格优惠）' },
              { value: 'CASH', label: '现金折扣（实际结算折扣）' },
            ]"
        /></FormItem>
        <template v-if="current?.taxable">
          <div class="grid grid-cols-2 gap-x-4">
            <FormItem label="原单金额口径"
              ><Select
                v-model:value="value.priceBasis"
                :options="[
                  { value: 'INCLUSIVE', label: '原单金额含税' },
                  { value: 'EXCLUSIVE', label: '原单商品金额未含税' },
                ]"
            /></FormItem>
            <FormItem label="明确税额（元；确无税额时填0）"
              ><InputNumber
                v-model:value="value.taxAmount"
                :min="0"
                :precision="2"
                class="w-full"
            /></FormItem>
            <FormItem label="发票/免税状态"
              ><Select
                v-model:value="value.invoiceStatus"
                :options="[
                  { value: 'RECEIVED', label: '已取得/确认发票依据' },
                  { value: 'NOT_RECEIVED', label: '未到票/尚未开票' },
                  { value: 'EXEMPT', label: '已确认免税' },
                ]"
            /></FormItem>
            <FormItem label="抵扣状态"
              ><Select
                v-model:value="value.deductionStatus"
                :options="[
                  { value: 'DEDUCTIBLE', label: '已确认可抵扣进项' },
                  { value: 'NON_DEDUCTIBLE', label: '不可抵扣进项' },
                  { value: 'NOT_APPLICABLE', label: '不适用进项抵扣' },
                ]"
            /></FormItem>
          </div>
          <p class="mb-3 text-gray-500">
            采购费用独立税额另行处理；混合抵扣、暂估后到票及复杂税额调整须人工办理。
          </p>
        </template>
        <FormItem v-if="stockOnly"
          ><Checkbox
            :checked="value.deductionStatus === 'NOT_APPLICABLE'"
            @change="
              (e) =>
                value &&
                (value.deductionStatus = e.target.checked
                  ? 'NOT_APPLICABLE'
                  : undefined)
            "
            >已确认不涉及进项转出、福利赠送或视同销售</Checkbox
          ></FormItem
        >
        <FormItem v-if="value.bizType === 18"
          ><Checkbox
            :checked="value.priceBasis === 'CNY'"
            @change="
              (e) =>
                value &&
                (value.priceBasis = e.target.checked ? 'CNY' : undefined)
            "
            >确认为人民币转账，手续费由转出账户另行支付</Checkbox
          ></FormItem
        >
        <template v-if="goods">
          <FormItem label="附加费用性质"
            ><Select
              v-model:value="value.feeNature"
              allow-clear
              :options="[
                { value: 'PROCUREMENT', label: '本企业承担的采购相关费用' },
                { value: 'SALE_RECHARGE', label: '向客户收取的销售附加价款' },
              ]"
          /></FormItem>
          <div class="grid grid-cols-2 gap-x-4">
            <FormItem label="费用往来类型"
              ><Select
                v-model:value="value.feePartyType"
                :options="[
                  { value: 1, label: '客户' },
                  { value: 2, label: '供应商' },
                ]"
                @change="
                  () => {
                    if (value) value.feePartyId = undefined;
                    loadParty();
                  }
                "
            /></FormItem>
            <FormItem label="费用往来对象"
              ><Select
                v-model:value="value.feePartyId"
                show-search
                option-filter-prop="label"
                :options="partyOptions"
            /></FormItem>
          </div>
          <FormItem
            ><Checkbox v-model:checked="value.feeConfirmed"
              >已核实费用金额、承担方及往来对象，且费用无须独立处理税额</Checkbox
            ><Checkbox
              class="mt-2"
              :checked="value.feeAlreadyPosted === false"
              @change="
                (e) =>
                  value &&
                  (value.feeAlreadyPosted = e.target.checked
                    ? false
                    : undefined)
              "
              >该费用未在其他单据记账</Checkbox
            ></FormItem
          >
        </template>
        <FormItem label="辅助核算（源单已有的客户、供应商和部门优先）"
          ><AuxiliaryEditor v-model="value.auxiliaries"
        /></FormItem>
        <FormItem label="已由其他来源记账（填写后不独立生成）">
          <div class="flex gap-2">
            <Select
              v-model:value="value.postedBizType"
              allow-clear
              class="w-1/2"
              :options="[
                { value: 2, label: '销售出库' },
                { value: 3, label: '销售退货' },
                { value: 4, label: '其他应收' },
                { value: 6, label: '收款' },
                { value: 8, label: '采购入库' },
                { value: 9, label: '采购退货' },
                { value: 10, label: '其他应付' },
                { value: 12, label: '付款' },
                { value: 16, label: '其他出库' },
                { value: 17, label: '其他入库' },
                { value: 18, label: '银行转账' },
                { value: 21, label: '预收款' },
                { value: 22, label: '预付款' },
                { value: 23, label: '预收账款' },
              ]"
            /><InputNumber
              v-model:value="value.postedBizId"
              :min="1"
              :precision="0"
              placeholder="关联来源单据ID"
              class="w-1/2"
            />
          </div>
        </FormItem>
        <details v-if="detailWeights.length" class="mb-3">
          <summary>
            零金额商品的分摊权重（仅需要分摊且没有金额依据时填写）
          </summary>
          <div
            v-for="line in detailWeights"
            :key="line.id"
            class="mt-2 flex items-center gap-3"
          >
            <span>明细 {{ line.id }} / 配件 {{ line.productId }}</span
            ><InputNumber
              v-model:value="value.allocationWeights[String(line.id)]"
              :min="0"
              placeholder="分摊权重"
            />
          </div>
        </details>
        <FormItem label="依据说明"
          ><Input.TextArea v-model:value="value.note" :rows="3"
        /></FormItem>
      </Form>
    </div>
  </Modal>
</template>
