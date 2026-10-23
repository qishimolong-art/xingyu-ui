<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPartsPriceAdjustApi } from '#/api/erp/parts/price-adjust';

import { watch } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  batchUpdatePriceFields,
  getProductPage,
} from '#/api/erp/parts/price-adjust';
import {
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';

import { useGridColumns, useGridFormSchema } from './data';
import AdjustModal from './AdjustModal.vue';

defineOptions({ name: 'ErpPartsPriceAdjust' });

const { hiddenFields, loaded: hiddenFieldsLoaded } =
  useFieldPermission('erp_product');

const PRICE_UPDATE_FIELDS = [
  'backupPrice1',
  'referencePrice',
  'retailPrice',
  'wholesalePrice',
  'sharePrice',
  'stockMax',
  'stockMin',
  'stockStandard',
] as const;

const [AdjustModalComp, adjustModalApi] = useVbenModal({
  connectedComponent: AdjustModal,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(hiddenFields.value),
    height: 'auto',
    keepSource: true,
    editConfig: {
      trigger: 'click',
      mode: 'cell',
      showStatus: true,
    },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getProductPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          });
        },
      },
    },
    rowConfig: {
      keyField: 'id',
      isHover: true,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
      custom: true,
      zoom: true,
      slots: { buttons: 'toolbar-buttons' },
    },
  } as VxeTableGridOptions<ErpPartsPriceAdjustApi.PartsItem>,
});

async function handleSave() {
  if (!hiddenFieldsLoaded.value) {
    message.warning('价格字段权限加载中，请稍后再保存');
    return;
  }
  const grid = gridApi.grid;
  if (!grid) return;
  await grid.clearEdit();
  const editedRows =
    grid.getUpdateRecords() as ErpPartsPriceAdjustApi.PartsItem[];
  if (!editedRows.length) {
    message.info('没有修改的数据');
    return;
  }
  const data = editedRows.map((row) => {
    const item: ErpPartsPriceAdjustApi.BatchUpdatePriceFieldsItem = {
      id: row.id!,
    };
    PRICE_UPDATE_FIELDS.forEach((field) => {
      if (!isFieldHidden(hiddenFields.value, field)) {
        item[field] = row[field];
      }
    });
    return item;
  });
  try {
    await batchUpdatePriceFields(data);
    message.success(`已成功保存 ${data.length} 条配件`);
    gridApi.reload();
  } catch {
    // 错误由全局处理
  }
}

function openAdjustModal(initFilter?: Record<string, any>) {
  adjustModalApi.setData({ initFilter: initFilter ?? {} });
  adjustModalApi.open();
}

function handleNameClick(row: ErpPartsPriceAdjustApi.PartsItem) {
  openAdjustModal({ code: row.code, name: row.name });
}

watch(hiddenFields, async (fields) => {
  const columns = useGridColumns(fields) || [];
  gridApi.setGridOptions({ columns });
  await gridApi.grid?.clearEdit?.();
  await gridApi.grid?.reloadColumn?.(columns as any[]);
});
</script>

<template>
  <Page auto-content-height>
    <AdjustModalComp @success="gridApi.reload()" />

    <Grid table-title="配件价格调整">
      <template #toolbar-buttons>
        <a-button type="primary" @click="handleSave">保存</a-button>
        <a-button class="ml-2" @click="openAdjustModal()"
          >配件价格调整</a-button
        >
      </template>

      <template #name="{ row }">
        <a
          class="cursor-pointer text-blue-500 hover:underline"
          @click="handleNameClick(row)"
        >
          {{ row.name }}
        </a>
      </template>
    </Grid>
  </Page>
</template>
