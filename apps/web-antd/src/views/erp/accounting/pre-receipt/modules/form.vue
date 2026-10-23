<script lang="ts" setup>
import type { ErpPreReceiptApi } from '#/api/erp/finance/accounting/pre-receipt';

import { computed, nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Button, Input, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getAccountSimpleList } from '#/api/erp/finance/account';
import {
  createPreReceipt,
  getPreReceipt,
  updatePreReceipt,
} from '#/api/erp/finance/accounting/pre-receipt';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import {
  formatOptionalNumberInput,
  toOptionalNumberValue,
} from '#/views/erp/finance/utils/text-number';

import { useFormItemColumns, useFormSchema } from '../data';

const emit = defineEmits(['success']);

type PreReceiptItemForm = Omit<ErpPreReceiptApi.PreReceiptItem, 'amount'> & {
  amount?: string;
  lineNo?: number;
  seq?: number;
};

const formData = ref<ErpPreReceiptApi.PreReceipt>();
const formType = ref<string>('create');
const tableData = ref<PreReceiptItemForm[]>([]);
const discountAmount = ref<string>('0');
const FIELD_PERMISSION_MODULE = 'erp_accounting_pre_receipt';
const { hiddenFields, loadHiddenFields, isHidden } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);

const isDetail = computed(() => formType.value === 'detail');
const getTitle = computed(() => {
  if (formType.value === 'detail') return '预收款单详情';
  return formData.value?.id
    ? $t('ui.actionTitle.edit', ['预收款单'])
    : '新增预收款单';
});

const totalAmount = computed(() => {
  return tableData.value.reduce(
    (sum, item) => sum + (toOptionalNumberValue(item.amount) || 0),
    0,
  );
});

const actualAmount = computed(() => {
  return Number(
    (
      totalAmount.value - (toOptionalNumberValue(discountAmount.value) || 0)
    ).toFixed(2),
  );
});

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-1',
    labelWidth: 90,
  },
  handleValuesChange(values, changedFields) {
    if (changedFields.includes('discountAmount')) {
      discountAmount.value =
        formatOptionalNumberInput(values.discountAmount) || '0';
    }
  },
  layout: 'horizontal',
  schema: useFormSchema(hiddenFields.value),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-2',
});

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useFormItemColumns(hiddenFields.value),
    data: tableData.value,
    minHeight: 200,
    autoResize: true,
    border: true,
    rowConfig: { keyField: 'seq', isHover: true },
    pagerConfig: { enabled: false },
    toolbarConfig: { enabled: false },
  },
});

async function loadAccountOptions() {
  if (isHidden('accountId')) {
    return;
  }
  const list = await getAccountSimpleList();
  formApi.updateSchema([
    {
      fieldName: 'accountId',
      componentProps: {
        options: (list || []).map((item) => ({
          label: item.name,
          value: item.id,
        })),
      },
    },
  ]);
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (isDetail.value) {
      await modalApi.close();
      return;
    }
    const { valid } = await formApi.validate();
    if (!valid) return;

    if (tableData.value.length === 0) {
      message.warning('请至少添加一条明细');
      return;
    }
    for (let i = 0; i < tableData.value.length; i++) {
      const item = tableData.value[i]!;
      if (!item.amount || (toOptionalNumberValue(item.amount) || 0) <= 0) {
        message.warning(`第${i + 1}行：金额必须大于 0`);
        return;
      }
    }

    modalApi.lock();
    const values = await formApi.getValues();
    const data: ErpPreReceiptApi.PreReceipt = {
      ...formData.value,
      ...values,
      totalAmount: totalAmount.value,
      discountAmount: toOptionalNumberValue(discountAmount.value) || 0,
      actualAmount: actualAmount.value,
      items: tableData.value.map((item, idx) => ({
        ...item,
        amount: toOptionalNumberValue(item.amount) || 0,
        lineNo: idx + 1,
      })),
    };
    try {
      await (formData.value?.id
        ? updatePreReceipt(data)
        : createPreReceipt(data));
      await modalApi.close();
      emit('success');
      message.success($t('ui.actionMessage.operationSuccess'));
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      formData.value = undefined;
      tableData.value = [];
      discountAmount.value = '0';
      formType.value = 'create';
      return;
    }
    await loadHiddenFields();
    formApi.setState({ schema: useFormSchema(hiddenFields.value) });
    gridApi.setGridOptions({
      columns: useFormItemColumns(hiddenFields.value),
    });
    await loadAccountOptions();
    const modalData = modalApi.getData<{ id?: number; formType?: string }>();
    if (modalData?.formType) {
      formType.value = modalData.formType;
    }
    if (!modalData || !modalData.id) {
      discountAmount.value = '0';
      await formApi.resetForm();
      await formApi.setValues({ discountAmount: '0' }, false);
      return;
    }
    modalApi.lock();
    try {
      formData.value = await getPreReceipt(modalData.id);
      discountAmount.value =
        formatOptionalNumberInput(formData.value.discountAmount) || '0';
      await formApi.setValues({
        ...formData.value,
        discountAmount: formatOptionalNumberInput(
          formData.value.discountAmount,
        ),
      });
      const items = (formData.value.items || []).map((item, idx) => ({
        ...item,
        amount: formatOptionalNumberInput(item.amount) || '0',
        seq:
          item.id ||
          Number(`${Date.now()}${Math.floor(Math.random() * 10_000)}`),
        lineNo: idx + 1,
      }));
      tableData.value = items;
      await nextTick();
      await gridApi.grid.reloadData(tableData.value);
    } finally {
      modalApi.unlock();
    }
  },
});

function handleFieldChange(row: PreReceiptItemForm) {
  const index = tableData.value.findIndex(
    (it) => (it as any).seq === (row as any).seq,
  );
  if (index === -1) return;
  tableData.value[index] = row;
}

function handleAdd() {
  const newRow: PreReceiptItemForm = {
    seq: Number(`${Date.now()}${Math.floor(Math.random() * 10_000)}`),
    lineNo: tableData.value.length + 1,
    summary: '',
    amount: '0',
    remark: '',
  };
  tableData.value.push(newRow);
  nextTick(() => gridApi.grid.reloadData(tableData.value));
}

function handleDelete(row: any) {
  const index = tableData.value.findIndex((it) => (it as any).seq === row.seq);
  if (index !== -1) tableData.value.splice(index, 1);
  tableData.value.forEach((it, idx) => {
    (it as any).lineNo = idx + 1;
  });
  nextTick(() => gridApi.grid.reloadData(tableData.value));
}
</script>

<template>
  <Modal class="!w-[700px]" :title="getTitle">
    <div class="px-4 pt-4">
      <Form />

      <div class="mb-2 flex items-center justify-between">
        <span class="font-medium">收款明细</span>
        <Button v-if="!isDetail" type="primary" size="small" @click="handleAdd">
          添加明细
        </Button>
      </div>

      <Grid class="w-full">
        <template #summary="{ row }">
          <Input
            v-if="!isDetail"
            v-model:value="row.summary"
            placeholder="请输入摘要"
            :maxlength="200"
            @change="handleFieldChange(row)"
          />
          <span v-else>{{ row.summary || '-' }}</span>
        </template>

        <template #amount="{ row }">
          <Input
            v-if="!isDetail"
            v-model:value="row.amount"
            class="w-full"
            placeholder="请输入金额"
            :maxlength="20"
            inputMode="decimal"
            @change="handleFieldChange(row)"
          />
          <span v-else>{{
            row.amount != null ? Number(row.amount).toFixed(2) : '-'
          }}</span>
        </template>

        <template #remark="{ row }">
          <Input
            v-if="!isDetail"
            v-model:value="row.remark"
            placeholder="请输入备注"
            :maxlength="200"
            @change="handleFieldChange(row)"
          />
          <span v-else>{{ row.remark || '-' }}</span>
        </template>

        <template #actions="{ row }">
          <TableAction
            v-if="!isDetail"
            :actions="[
              {
                label: '删除',
                type: 'link',
                danger: true,
                popConfirm: {
                  title: '确认删除该明细？',
                  confirm: handleDelete.bind(null, row),
                },
              },
            ]"
          />
        </template>
      </Grid>

      <div class="mt-3 rounded border border-border bg-muted p-3">
        <div class="flex justify-between text-sm">
          <span>
            合计金额：
            <span class="font-semibold text-blue-600">
              {{ totalAmount.toFixed(2) }}
            </span>
          </span>
          <span>
            实际金额：
            <span class="font-semibold text-green-600">
              {{ actualAmount.toFixed(2) }}
            </span>
          </span>
        </div>
      </div>
    </div>
  </Modal>
</template>
