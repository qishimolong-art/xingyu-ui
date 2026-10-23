<script lang="ts" setup>
import type { ErpOtherPayableApi } from '#/api/erp/finance/accounting/other-payable';

import { computed, nextTick, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, Input, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  createOtherPayable,
  getOtherPayable,
  updateOtherPayable,
} from '#/api/erp/finance/accounting/other-payable';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import {
  formatOptionalNumberInput,
  toOptionalNumberValue,
} from '#/views/erp/finance/utils/text-number';

import { useFormSchema, useItemColumns } from '../data';

const emit = defineEmits(['success']);

const formType = ref<string>('');
const formData = ref<ErpOtherPayableApi.OtherPayable>({});
const tableData = ref<ErpOtherPayableApi.OtherPayableItem[]>([]);
const discountAmount = ref<string>('0');
const FIELD_PERMISSION_MODULE = 'erp_accounting_other_payable';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);

const getTitle = computed(() => {
  if (formType.value === 'create')
    return $t('ui.actionTitle.create', ['其他应付单']);
  if (formType.value === 'edit')
    return $t('ui.actionTitle.edit', ['其他应付单']);
  return '其他应付单详情';
});

const isReadonly = computed(() => formType.value === 'detail');

const totalAmount = computed(() => {
  return tableData.value.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0,
  );
});

const actualAmount = computed(() => {
  return Number(
    (totalAmount.value - (Number(discountAmount.value) || 0)).toFixed(2),
  );
});

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    labelWidth: 90,
  },
  wrapperClass: 'grid-cols-3',
  layout: 'horizontal',
  schema: useFormSchema(hiddenFields.value),
  showDefaultActions: false,
});

const [ItemGrid, itemGridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useItemColumns(false, hiddenFields.value),
    height: 'auto',
    maxHeight: 300,
    data: [],
    rowConfig: { keyField: '_uid' },
    toolbarConfig: undefined,
  },
});

let uidCounter = 0;
function genUid() {
  return `item_${++uidCounter}`;
}

function handleAddItem() {
  tableData.value.push({
    _uid: genUid(),
    summary: '',
    amount: '0',
    remark: '',
  } as any);
  nextTick(() => {
    itemGridApi.grid.reloadData(tableData.value);
  });
}

function handleDeleteItem(row: any) {
  const idx = tableData.value.findIndex((r: any) => r._uid === row._uid);
  if (idx !== -1) {
    tableData.value.splice(idx, 1);
    nextTick(() => {
      itemGridApi.grid.reloadData(tableData.value);
    });
  }
}

function handleItemFieldChange(row: any, field: string, val: any) {
  const idx = tableData.value.findIndex((r: any) => r._uid === row._uid);
  if (idx !== -1) {
    (tableData.value[idx] as any)[field] = val;
  }
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;

    if (tableData.value.length === 0) {
      message.error('请至少添加一条明细');
      return;
    }

    modalApi.lock();
    try {
      const values =
        (await formApi.getValues()) as ErpOtherPayableApi.OtherPayable;
      const data: ErpOtherPayableApi.OtherPayable = {
        ...values,
        totalAmount: totalAmount.value,
        discountAmount: Number(discountAmount.value) || 0,
        actualAmount: actualAmount.value,
        items: tableData.value.map((item: any) => ({
          id: formType.value === 'create' ? undefined : item.id,
          summary: item.summary,
          amount: toOptionalNumberValue(item.amount) || 0,
          remark: item.remark,
        })),
      };

      await (formType.value === 'create'
        ? createOtherPayable(data)
        : updateOtherPayable(data));
      message.success($t('ui.actionMessage.operationSuccess'));
      emit('success');
      await modalApi.close();
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      formData.value = {};
      tableData.value = [];
      discountAmount.value = '0';
      return;
    }
    const data = modalApi.getData<{ id?: number; type: string }>();
    formType.value = data.type;
    await loadHiddenFields();
    formApi.setState({ schema: useFormSchema(hiddenFields.value) });
    formApi.setDisabled(formType.value === 'detail');
    itemGridApi.setGridOptions({
      columns: useItemColumns(formType.value === 'detail', hiddenFields.value),
    });

    if (!data || !data.id) {
      formData.value = {};
      tableData.value = [];
      discountAmount.value = '0';
      await formApi.setValues({ bizTime: Date.now(), partyType: 2 }, false);
      await nextTick();
      await itemGridApi.grid.reloadData([]);
      return;
    }

    modalApi.lock();
    try {
      const detail = await getOtherPayable(data.id);
      formData.value = detail;
      discountAmount.value =
        formatOptionalNumberInput(detail.discountAmount) || '0';
      await formApi.setValues(
        {
          ...detail,
          totalAmount: formatOptionalNumberInput(detail.totalAmount),
          discountAmount: formatOptionalNumberInput(detail.discountAmount),
          actualAmount: formatOptionalNumberInput(detail.actualAmount),
        },
        false,
      );
      tableData.value = (detail.items || []).map((item) => ({
        ...item,
        _uid: genUid(),
      })) as any[];
      await nextTick();
      await itemGridApi.grid.reloadData(tableData.value);
    } finally {
      modalApi.unlock();
    }
  },
});
</script>

<template>
  <Modal
    :title="getTitle"
    class="!w-[800px]"
    :show-confirm-button="!isReadonly"
  >
    <div class="space-y-4 px-2">
      <Form />

      <!-- 明细子表 -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">付款明细</span>
          <Button
            v-if="!isReadonly"
            type="primary"
            size="small"
            @click="handleAddItem"
          >
            添加明细
          </Button>
        </div>
        <ItemGrid>
          <template #summary="{ row }">
            <Input
              v-if="!isReadonly"
              :value="row.summary"
              placeholder="请输入摘要"
              :maxlength="200"
              @change="
                (e: any) =>
                  handleItemFieldChange(row, 'summary', e.target.value)
              "
            />
            <span v-else>{{ row.summary }}</span>
          </template>
          <template #amount="{ row }">
            <Input
              v-if="!isReadonly"
              :value="row.amount"
              placeholder="请输入金额"
              class="w-full"
              :maxlength="20"
              inputMode="decimal"
              @change="
                (e: any) => handleItemFieldChange(row, 'amount', e.target.value)
              "
            />
            <span v-else>{{
              row.amount != null ? Number(row.amount).toFixed(2) : '-'
            }}</span>
          </template>
          <template #remark="{ row }">
            <Input
              v-if="!isReadonly"
              :value="row.remark"
              placeholder="请输入备注"
              :maxlength="200"
              @change="
                (e: any) => handleItemFieldChange(row, 'remark', e.target.value)
              "
            />
            <span v-else>{{ row.remark }}</span>
          </template>
          <template #actions="{ row }">
            <Button
              type="link"
              danger
              size="small"
              @click="handleDeleteItem(row)"
            >
              删除
            </Button>
          </template>
        </ItemGrid>
      </div>

      <!-- 底部汇总 -->
      <div class="flex items-center justify-end gap-6 border-t pt-3 text-sm">
        <span
          >合计金额：<b>{{ totalAmount.toFixed(2) }}</b></span
        >
        <span class="flex items-center gap-1">
          折让金额：
          <Input
            v-if="!isReadonly"
            v-model:value="discountAmount"
            :style="{ width: '120px' }"
            :maxlength="20"
            inputMode="decimal"
            placeholder="折让金额"
          />
          <b v-else>{{ (Number(discountAmount) || 0).toFixed(2) }}</b>
        </span>
        <span
          >实际金额：<b class="text-red-500">{{
            actualAmount.toFixed(2)
          }}</b></span
        >
      </div>
    </div>
  </Modal>
</template>
