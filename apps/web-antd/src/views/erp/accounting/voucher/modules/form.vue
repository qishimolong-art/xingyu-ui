<script lang="ts" setup>
import GenerationEvidence from '../../voucher-rule/generation-evidence.vue';
import type { ErpVoucherApi } from '#/api/erp/finance/accounting/voucher';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Button, Collapse, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createVoucher,
  getVoucher,
  updateVoucher,
} from '#/api/erp/finance/accounting/voucher';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import { getCurrentLocalDate } from '#/views/erp/utils/form-defaults';

import { useFormSchema } from '../data';
import ItemForm from './item-form.vue';

const emit = defineEmits(['success', 'close']);

const formData = ref<ErpVoucherApi.Voucher>({
  items: [],
  totalDebit: 0,
  totalCredit: 0,
  voucherWord: '记',
  attachmentCount: 0,
  generateBusinessDoc: false,
} as ErpVoucherApi.Voucher);
const formType = ref<string>('');
const itemFormRef = ref<InstanceType<typeof ItemForm>>();
const totalDebit = ref(0);
const totalCredit = ref(0);
const userStore = useUserStore();
const itemsActiveKey = ref<string[]>(['items']);
const submitting = ref(false);
const FIELD_PERMISSION_MODULE = 'erp_accounting_voucher';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);

const getTitle = computed(() => {
  if (formType.value === 'create') {
    return $t('ui.actionTitle.create', ['凭证']);
  }
  if (formType.value === 'edit') {
    return $t('ui.actionTitle.edit', ['凭证']);
  }
  return '凭证详情';
});

const isReadonly = computed(() => formType.value === 'detail');

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    labelWidth: 110,
  },
  wrapperClass: 'grid-cols-3',
  layout: 'vertical',
  schema: useFormSchema('', hiddenFields.value),
  showDefaultActions: false,
});

/** 子表更新（不再回写到 form values，避免 items 噪声字段污染表单状态） */
function handleUpdateItems(items: ErpVoucherApi.VoucherItem[]) {
  formData.value.items = items;
}

function handleUpdateTotalDebit(val: number) {
  totalDebit.value = val;
}

function handleUpdateTotalCredit(val: number) {
  totalCredit.value = val;
}

/** 添加分录 */
function handleAddItem() {
  const itemFormInstance = Array.isArray(itemFormRef.value)
    ? itemFormRef.value[0]
    : itemFormRef.value;
  itemFormInstance?.handleAdd();
}

/** 借贷平衡校验（保存/审批前） */
function validateBalance(): boolean {
  if (!formData.value.items || formData.value.items.length === 0) {
    message.error('请至少添加一条分录明细');
    return false;
  }
  const debit = Number(totalDebit.value.toFixed(2));
  const credit = Number(totalCredit.value.toFixed(2));
  if (debit !== credit) {
    message.error(`借贷不平衡：借方 ${debit} ≠ 贷方 ${credit}，无法保存`);
    return false;
  }
  return true;
}

/** 把后端返回的凭证字段抽到 schema 上（避免 setValues 把 items 等噪声字段写进 form values） */
function pickFormFields(detail: ErpVoucherApi.Voucher): Record<string, any> {
  return {
    id: detail.id,
    voucherWord: detail.voucherWord ?? '记',
    voucherNo: detail.voucherNo,
    voucherDate: detail.voucherDate,
    attachmentCount: detail.attachmentCount ?? '',
    summary: detail.summary ?? '',
    bookkeeperUserId: detail.bookkeeperUserId,
    cashierUserId: detail.cashierUserId,
    supervisorUserId: detail.supervisorUserId,
    auditorUserId: detail.auditorUserId,
    makerUserId: detail.makerUserId,
    projectId: detail.projectId,
    deptId: detail.deptId,
    customerId: detail.customerId,
    personUserId: detail.personUserId,
    auditTime: detail.auditTime,
    generateBusinessDoc: detail.generateBusinessDoc ?? false,
    bizDocType: detail.bizDocType,
    remark: detail.remark,
  };
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;

    // 调用子表 validate（含借贷平衡 + 同行借贷互斥校验）
    const itemFormInstance = Array.isArray(itemFormRef.value)
      ? itemFormRef.value[0]
      : itemFormRef.value;
    try {
      itemFormInstance?.validate();
    } catch (error: any) {
      message.error(error.message || '分录校验失败');
      return;
    }

    if (!validateBalance()) return;

    submitting.value = true;
    try {
      const data = (await formApi.getValues()) as ErpVoucherApi.Voucher;
      data.items = (formData.value.items || []).map((item) => ({
        ...item,
        id: formType.value === 'create' ? undefined : item.id,
      }));
      if (formType.value !== 'create') {
        data.id = formData.value.id;
      }
      data.totalDebit = totalDebit.value;
      data.totalCredit = totalCredit.value;
      await (formType.value === 'create'
        ? createVoucher(data)
        : updateVoucher(data));
      message.success($t('ui.actionMessage.operationSuccess'));
      await modalApi.close();
      emit('success');
    } finally {
      submitting.value = false;
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      // 关闭场景统一在此 emit('close')：取消按钮 / × / ESC / 点遮罩 / onConfirm 成功后关闭都会走到
      // destroyOnClose=true 由父组件提供，组件会被卸载，无需手动重置 formData
      submitting.value = false;
      emit('close');
      return;
    }
    const data = modalApi.getData<{ id?: number; type: string }>();
    formType.value = data.type;
    await loadHiddenFields();
    const detailMode = formType.value === 'detail';
    formApi.setState({
      schema: useFormSchema(formType.value, hiddenFields.value),
    });
    formApi.setDisabled(detailMode);

    if (!data || !data.id) {
      // 新增：默认 制单人 = 当前登录用户 + 凭证日期 = 当前时间
      const userInfo = userStore.userInfo as any;
      formData.value = {
        items: [],
        totalDebit: 0,
        totalCredit: 0,
        voucherWord: '记',
        attachmentCount: '',
        generateBusinessDoc: false,
        makerUserId: userInfo?.id,
        makerUserName: userInfo?.realName || userInfo?.nickname,
      } as ErpVoucherApi.Voucher;
      totalDebit.value = 0;
      totalCredit.value = 0;
      await formApi.setValues({
        voucherWord: '记',
        voucherDate: getCurrentLocalDate(),
        attachmentCount: 0,
        generateBusinessDoc: false,
        makerUserId: userInfo?.id,
      });
      return;
    }
    const detail = await getVoucher(data.id);
    formData.value = detail;
    totalDebit.value = Number(formData.value.totalDebit) || 0;
    totalCredit.value = Number(formData.value.totalCredit) || 0;
    await formApi.setValues(pickFormFields(formData.value));
  },
});
</script>

<template>
  <Modal
    :title="getTitle"
    class="w-3/4"
    :show-confirm-button="!isReadonly"
    :confirm-loading="submitting"
  >
    <div class="space-y-4">
      <Form class="mx-2" />

      <!-- 分录子表（折叠区域） -->
      <Collapse v-model:active-key="itemsActiveKey" class="mx-2">
        <Collapse.Panel key="items" header="分录明细">
          <div class="space-y-2">
            <div class="flex items-center justify-end">
              <Button
                v-if="!isReadonly"
                type="primary"
                size="small"
                @click="handleAddItem"
              >
                添加分录
              </Button>
            </div>
            <ItemForm
              ref="itemFormRef"
              :items="formData?.items ?? []"
              :disabled="isReadonly"
              :form-type="formType"
              :hidden-fields="hiddenFields"
              @update:items="handleUpdateItems"
              @update:total-debit="handleUpdateTotalDebit"
              @update:total-credit="handleUpdateTotalCredit"
            />
          </div>
        </Collapse.Panel>
      </Collapse>
      <details
        v-if="formType !== 'create' && formData.generationSnapshot"
        class="mt-3"
      >
        <summary>查看自动生成时的规则、金额及来源依据</summary>
        <GenerationEvidence :snapshot="formData.generationSnapshot" />
      </details>
    </div>
  </Modal>
</template>
