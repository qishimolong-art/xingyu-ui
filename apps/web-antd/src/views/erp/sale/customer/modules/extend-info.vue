<script lang="ts" setup>
import type { ErpCustomerExtendInfoApi } from '#/api/erp/sale/customer';
import type { FormInstance } from 'ant-design-vue';
import type { Rule } from 'ant-design-vue/es/form';

import { onMounted, reactive, ref, watch, onBeforeUnmount } from 'vue';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';
import { getAccountSimplePage } from '#/api/erp/finance/account';
import { getSaleConfigPage } from '#/api/erp/sale/config';

import {
  Alert,
  Button,
  Card,
  Col,
  Form as AForm,
  FormItem,
  Input,
  message,
  Row,
  Select,
  Spin,
  Switch,
  Textarea,
} from 'ant-design-vue';

import {
  getCustomerExtendInfo,
  getCustomerUserPage,
  saveCustomerExtendInfo,
} from '#/api/erp/sale/customer';
import { focusNextInputOnEnter } from '#/views/erp/utils/keyboard';

import {
  formatCustomerExtendNumberFields,
  getCustomerExtendNumberError,
  normalizeCustomerExtendNumberFields,
} from '../utils/extend-info-number';
import type { CustomerExtendNumberField } from '../utils/extend-info-number';

const props = defineProps<{
  customerId?: number;
  readonly?: boolean;
}>();

type ExtendInfoFormState = Omit<
  ErpCustomerExtendInfoApi.ExtendInfo,
  CustomerExtendNumberField
> &
  Partial<Record<CustomerExtendNumberField, number | string>>;

const loading = ref(false);
const ready = ref(false);
const loadError = ref('');
let sequence = 0;
onBeforeUnmount(() => {
  sequence += 1;
});
const saving = ref(false);
const formRef = ref<FormInstance>();
const formState = reactive<ExtendInfoFormState>({
  customerId: 0,
});

const autoConfirmOptions = [
  { label: '不自动', value: 0 },
  { label: '3 天', value: 3 },
  { label: '7 天', value: 7 },
  { label: '15 天', value: 15 },
];

function getNumberRules(field: CustomerExtendNumberField): Rule[] {
  return [
    {
      async validator(_rule: unknown, value: unknown) {
        const error = getCustomerExtendNumberError(field, value);
        if (error) {
          throw new Error(error);
        }
      },
      trigger: ['blur', 'change'],
    },
  ];
}

function resetForm(customerId: number) {
  Object.keys(formState).forEach((key) => {
    delete (formState as any)[key];
  });
  formState.customerId = customerId;
  formRef.value?.clearValidate();
}

async function loadData() {
  const current = ++sequence;
  const id = props.customerId;
  ready.value = false;
  loadError.value = '';
  if (!id) return;
  loading.value = true;
  try {
    const data = await getCustomerExtendInfo(props.customerId);
    if (current !== sequence || id !== props.customerId) return;
    resetForm(id);
    ready.value = true;
    if (data) {
      Object.assign(
        formState,
        formatCustomerExtendNumberFields(
          data as unknown as Record<string, unknown>,
        ),
      );
      formState.customerId = props.customerId;
    }
  } catch {
    if (current === sequence)
      loadError.value = '拓展配置加载失败，请重试，当前禁止保存';
  } finally {
    if (current === sequence) loading.value = false;
  }
}

async function handleSave() {
  if (!ready.value || props.readonly || saving.value || loadError.value) return;
  const current = sequence;
  saving.value = true;
  try {
    if (!props.customerId) {
      message.warning('请先保存客户基础信息');
      return;
    }
    try {
      await formRef.value?.validate();
    } catch {
      message.warning('请检查拓展信息中的数字字段');
      return;
    }
    saving.value = true;
    try {
      const payload = normalizeCustomerExtendNumberFields({
        ...formState,
        customerId: props.customerId,
      }) as unknown as ErpCustomerExtendInfoApi.ExtendInfo;
      await saveCustomerExtendInfo(payload);
      if (current !== sequence) return;
      message.success('保存成功');
      saving.value = false;
      await loadData();
    } finally {
      if (current === sequence) saving.value = false;
    }
  } finally {
    if (current === sequence) saving.value = false;
  }
}

watch(
  () => props.customerId,
  () => loadData(),
);

onMounted(() => {
  loadData();
});

defineExpose({ reload: loadData });
</script>

<template>
  <Spin :spinning="loading">
    <Alert v-if="loadError" :message="loadError" type="error" show-icon />
    <AForm
      :disabled="readonly || !ready || saving"
      ref="formRef"
      class="customer-extend-form erp-form-focus-highlight"
      :label-col="{ flex: '128px' }"
      label-align="right"
      :model="formState"
      :wrapper-col="{ flex: 1 }"
    >
      <Card class="customer-extend-section" size="small" title="财务与结算信息">
        <Row :gutter="[12, 0]">
          <Col :md="12" :xs="24" :xl="6">
            <FormItem
              label="预收款金额"
              name="advanceAmount"
              :rules="getNumberRules('advanceAmount')"
            >
              <Input
                v-model:value="formState.advanceAmount"
                inputmode="decimal"
                placeholder="请输入数字"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem
              label="铺底金额"
              name="baseAmount"
              :rules="getNumberRules('baseAmount')"
            >
              <Input
                v-model:value="formState.baseAmount"
                inputmode="decimal"
                placeholder="请输入数字"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem label="结算账户">
              <ErpLazyPageSelect
                v-model:value="formState.settleAccountId"
                :api="getAccountSimplePage"
                value-field="id"
                label-field="name"
                class="w-full"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem label="开户行2">
              <Input
                v-model:value="formState.bankName2"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem label="账户2">
              <Input
                v-model:value="formState.bankAccount2"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem
              label="结账日期（1-31）"
              name="settleDay"
              :rules="getNumberRules('settleDay')"
            >
              <Input
                v-model:value="formState.settleDay"
                inputmode="numeric"
                placeholder="请输入 1-31"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem
              label="售价上浮率（%）"
              name="priceMarkupRate"
              :rules="getNumberRules('priceMarkupRate')"
            >
              <Input
                v-model:value="formState.priceMarkupRate"
                inputmode="decimal"
                placeholder="请输入数字"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem
              label="优惠价格级别"
              name="discountPriceLevel"
              :rules="getNumberRules('discountPriceLevel')"
            >
              <Input
                v-model:value="formState.discountPriceLevel"
                inputmode="numeric"
                placeholder="请输入整数"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
        </Row>
      </Card>

      <Card class="customer-extend-section" size="small" title="销售与业绩信息">
        <Row :gutter="[12, 0]">
          <Col :md="12" :xs="24" :xl="6">
            <FormItem
              label="月销量目标"
              name="monthlySaleTarget"
              :rules="getNumberRules('monthlySaleTarget')"
            >
              <Input
                v-model:value="formState.monthlySaleTarget"
                inputmode="decimal"
                placeholder="请输入数字"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem
              label="月营业规模"
              name="monthlyBusinessScale"
              :rules="getNumberRules('monthlyBusinessScale')"
            >
              <Input
                v-model:value="formState.monthlyBusinessScale"
                inputmode="decimal"
                placeholder="请输入数字"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem
              label="总资产"
              name="totalAssets"
              :rules="getNumberRules('totalAssets')"
            >
              <Input
                v-model:value="formState.totalAssets"
                inputmode="decimal"
                placeholder="请输入数字"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem
              label="积分系数"
              name="pointsRate"
              :rules="getNumberRules('pointsRate')"
            >
              <Input
                v-model:value="formState.pointsRate"
                inputmode="decimal"
                placeholder="请输入数字"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem
              label="送货费用"
              name="deliveryFee"
              :rules="getNumberRules('deliveryFee')"
            >
              <Input
                v-model:value="formState.deliveryFee"
                inputmode="decimal"
                placeholder="请输入数字"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
        </Row>
      </Card>

      <Card class="customer-extend-section" size="small" title="法人与企业信息">
        <Row :gutter="[12, 0]">
          <Col :md="12" :xs="24" :xl="6">
            <FormItem label="企业法人">
              <Input
                v-model:value="formState.legalPerson"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem label="法人电话">
              <Input
                v-model:value="formState.legalPersonPhone"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem label="老板">
              <Input
                v-model:value="formState.boss"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem label="老板电话">
              <Input
                v-model:value="formState.bossPhone"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem label="身份证号码">
              <Input
                v-model:value="formState.idCardNo"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem label="电子邮件（拓展）">
              <Input
                v-model:value="formState.extEmail"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
          <Col :md="24" :xs="24" :xl="12">
            <FormItem label="经营项目">
              <Textarea v-model:value="formState.businessScope" :rows="3" />
            </FormItem>
          </Col>
        </Row>
      </Card>

      <Card
        class="customer-extend-section"
        size="small"
        title="采购退货联系人信息"
      >
        <Row :gutter="[12, 0]">
          <Col :md="12" :xs="24" :xl="6">
            <FormItem label="采购退货联系人">
              <Input
                v-model:value="formState.purchaseReturnContact"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem label="采购退货电话">
              <Input
                v-model:value="formState.purchaseReturnPhone"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
          <Col :md="24" :xs="24" :xl="12">
            <FormItem label="采购退货地址">
              <Textarea
                v-model:value="formState.purchaseReturnAddress"
                :rows="2"
              />
            </FormItem>
          </Col>
        </Row>
      </Card>

      <Card class="customer-extend-section" size="small" title="系统与业务开关">
        <Row :gutter="[12, 0]">
          <Col :md="12" :xs="24" :xl="6">
            <FormItem label="对应连锁">
              <ErpLazyPageSelect
                v-model:value="formState.chainGroupId"
                :api="
                  (params) =>
                    getSaleConfigPage({
                      ...params,
                      configType: 'CHAIN_GROUP',
                      status: 0,
                    })
                "
                value-field="id"
                label-field="name"
                class="w-full"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem label="替代编码">
              <Input
                v-model:value="formState.alternateCode"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem label="总经销">
              <ErpLazyPageSelect
                v-model:value="formState.generalDistributorId"
                :api="
                  (params) =>
                    getSaleConfigPage({
                      ...params,
                      configType: 'GENERAL_DISTRIBUTOR',
                      status: 0,
                    })
                "
                value-field="id"
                label-field="name"
                class="w-full"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem label="是否生成出仓单">
              <Switch v-model:checked="formState.generateOutBill" />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem label="是否生成入仓单">
              <Switch v-model:checked="formState.generateInBill" />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem label="自动确认收货">
              <Select
                v-model:value="formState.autoConfirmReceiveDays"
                allow-clear
                :options="autoConfirmOptions"
                placeholder="请选择"
                popup-class-name="customer-extend-select-popup"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem label="不参与备货">
              <Switch v-model:checked="formState.excludeStocking" />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem label="对账客服">
              <ErpLazyPageSelect
                v-model:value="formState.reconcileServiceUserId"
                :api="getCustomerUserPage"
                value-field="id"
                label-field="nickname"
                class="w-full"
              />
            </FormItem>
          </Col>
          <Col :md="12" :xs="24" :xl="6">
            <FormItem label="易加网账号">
              <Input
                v-model:value="formState.yijiaWangAccount"
                @press-enter="focusNextInputOnEnter"
              />
            </FormItem>
          </Col>
          <Col :md="24" :xs="24" :xl="12">
            <FormItem label="内部说明">
              <Textarea
                v-model:value="formState.internalDescription"
                :rows="3"
              />
            </FormItem>
          </Col>
        </Row>
      </Card>

      <div class="customer-extend-actions">
        <Button
          :disabled="!props.customerId"
          :loading="saving"
          type="primary"
          @click="handleSave"
        >
          保存
        </Button>
      </div>
    </AForm>
  </Spin>
</template>

<style scoped>
.customer-extend-form {
  padding: 0 1px 4px;
}

.customer-extend-section {
  margin-bottom: 8px;
}

.customer-extend-form :deep(.ant-card-head) {
  min-height: 38px;
  padding: 0 12px;
}

.customer-extend-form :deep(.ant-card-head-title) {
  padding: 9px 0;
  font-size: 13px;
  font-weight: 600;
}

.customer-extend-form :deep(.ant-card-body) {
  padding: 10px 12px 2px;
}

.customer-extend-form :deep(.ant-form-item) {
  margin-bottom: 8px;
}

.customer-extend-form :deep(.ant-form-item-label) {
  min-width: 0;
  padding: 0 8px 0 0;
}

.customer-extend-form :deep(.ant-form-item-label > label) {
  height: 32px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  white-space: nowrap;
}

.customer-extend-form :deep(.ant-form-item-control) {
  min-width: 0;
}

.customer-extend-form :deep(.ant-input),
.customer-extend-form :deep(.ant-select-selector) {
  min-height: 32px;
  font-size: 12px;
}

.customer-extend-form :deep(.ant-select-selection-item),
.customer-extend-form :deep(.ant-select-selection-placeholder),
.customer-extend-form :deep(.ant-input::placeholder),
.customer-extend-form :deep(textarea.ant-input) {
  font-size: 12px;
}

.customer-extend-form :deep(.ant-form-item-explain-error) {
  font-size: 11px;
  line-height: 18px;
}

.customer-extend-form :deep(.ant-switch) {
  margin-top: 5px;
}

.customer-extend-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 2px 0 4px;
}

.customer-extend-actions :deep(.ant-btn) {
  height: 28px;
  padding: 0 12px;
  font-size: 12px;
}

:global(.customer-extend-select-popup .ant-select-item) {
  min-height: 28px;
  padding: 5px 8px;
  font-size: 12px;
}

@media (max-width: 767px) {
  .customer-extend-form :deep(.ant-form-item) {
    display: block;
  }

  .customer-extend-form :deep(.ant-form-item-label) {
    width: 100% !important;
    padding: 0;
    text-align: left;
  }

  .customer-extend-form :deep(.ant-form-item-label > label) {
    height: 26px;
  }
}
</style>
