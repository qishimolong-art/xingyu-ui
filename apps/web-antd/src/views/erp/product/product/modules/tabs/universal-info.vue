<script lang="ts" setup>
import type { ErpProductApi } from '#/api/erp/product/product';
import type { TableColumnsType } from 'ant-design-vue';

import { computed } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Input, Table } from 'ant-design-vue';
import { prepareErpArchiveItemColumns } from '#/views/erp/base/utils/archive-list-table';
import { focusNextProductInputOnEnter } from '../../utils/keyboard';

const rows = defineModel<ErpProductApi.ProductUniversal[]>('modelValue', {
  default: () => [],
});
const props = defineProps<{ disabled?: boolean }>();

const columns = computed<TableColumnsType<ErpProductApi.ProductUniversal>>(
  () => {
    const baseColumns: TableColumnsType<ErpProductApi.ProductUniversal> = [
      { title: '通用件编码', dataIndex: 'universalCode', width: 180 },
      { title: '通用件名称', dataIndex: 'universalName', width: 220 },
      { title: '适用车型', dataIndex: 'universalVehicle' },
    ];
    if (!props.disabled) {
      baseColumns.push({
        title: '操作',
        dataIndex: 'op',
        width: 80,
        align: 'center' as const,
      });
    }
    return prepareErpArchiveItemColumns(baseColumns, {
      editable: !props.disabled,
      rows: rows.value,
    });
  },
);

function handleAdd() {
  const list = rows.value ? [...rows.value] : [];
  list.push({ universalCode: '', universalName: '', universalVehicle: '' });
  rows.value = list;
}

function handleRemove(index: number) {
  const list = rows.value ? [...rows.value] : [];
  list.splice(index, 1);
  rows.value = list;
}

function updateField(
  index: number,
  field: keyof ErpProductApi.ProductUniversal,
  val: any,
) {
  const list = rows.value ? [...rows.value] : [];
  const row = { ...list[index] } as ErpProductApi.ProductUniversal;
  (row as any)[field] = val;
  list[index] = row;
  rows.value = list;
}
</script>

<template>
  <div class="mx-2 py-2">
    <div class="mb-3 flex items-center justify-between">
      <div class="text-sm text-gray-500">
        通用件用于当前配件缺货时可替代销售的场景；一条记录对应一个可替代车型。
      </div>
      <Button v-if="!props.disabled" type="primary" @click="handleAdd">
        <template #icon><IconifyIcon icon="lucide:plus" /></template>
        新增
      </Button>
    </div>
    <Table
      :columns="columns"
      :data-source="rows"
      :pagination="false"
      row-key="universalCode"
      :scroll="{ x: 'max-content' }"
      size="middle"
      bordered
    >
      <template #bodyCell="{ column, index, record }">
        <template v-if="column.dataIndex === 'universalCode'">
          <Input
            :value="record.universalCode"
            :disabled="props.disabled"
            placeholder="请输入编码，如 P000002"
            @keydown.enter="focusNextProductInputOnEnter"
            @update:value="(v) => updateField(index, 'universalCode', v)"
          />
        </template>
        <template v-else-if="column.dataIndex === 'universalName'">
          <Input
            :value="record.universalName"
            :disabled="props.disabled"
            placeholder="请输入名称"
            @keydown.enter="focusNextProductInputOnEnter"
            @update:value="(v) => updateField(index, 'universalName', v)"
          />
        </template>
        <template v-else-if="column.dataIndex === 'universalVehicle'">
          <Input
            :value="record.universalVehicle"
            :disabled="props.disabled"
            placeholder="请输入适用车型"
            @keydown.enter="focusNextProductInputOnEnter"
            @update:value="(v) => updateField(index, 'universalVehicle', v)"
          />
        </template>
        <template v-else-if="column.dataIndex === 'op'">
          <Button type="link" danger @click="handleRemove(index)">删除</Button>
        </template>
      </template>
    </Table>
  </div>
</template>
