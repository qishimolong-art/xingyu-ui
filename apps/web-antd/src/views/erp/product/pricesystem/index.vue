<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPriceSystemApi } from '#/api/erp/product/pricesystem';

import { onActivated, onMounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { isEmpty } from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deletePriceSystem,
  getPriceSystemPage,
} from '#/api/erp/product/pricesystem';
import { $t } from '#/locales';
import { queueFocusArchiveSearchInput } from '#/views/erp/base/utils/archive-search-focus';
import { useProductShortcut } from '#/views/erp/composables/useProductShortcut';

import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

/** ERP 价格体系列表 */
defineOptions({ name: 'ErpPriceSystem' });

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

/** 刷新表格 */
function handleRefresh() {
  gridApi.query();
}

/** 创建价格体系 */
function handleCreate() {
  formModalApi.setData(null).open();
}

useProductShortcut({
  onCreate: handleCreate,
});

/** 编辑价格体系 */
function handleEdit(row: ErpPriceSystemApi.PriceSystem) {
  formModalApi.setData(row).open();
}

/** 删除价格体系 */
async function handleDelete(ids: number[]) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting'),
    duration: 0,
  });
  try {
    await deletePriceSystem(ids);
    message.success($t('ui.actionMessage.deleteSuccess'));
    handleRefresh();
  } finally {
    hideLoading();
  }
}

const checkedIds = ref<number[]>([]);
const priceSystemGridShellRef = ref<HTMLElement>();
function handleRowCheckboxChange({
  records,
}: {
  records: ErpPriceSystemApi.PriceSystem[];
}) {
  checkedIds.value = records.map((item) => item.id!);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getPriceSystemPage({
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
    },
  } as VxeTableGridOptions<ErpPriceSystemApi.PriceSystem>,
  gridEvents: {
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
  },
});

onMounted(() => {
  queueFocusArchiveSearchInput(priceSystemGridShellRef);
});

onActivated(() => {
  queueFocusArchiveSearchInput(priceSystemGridShellRef);
});
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="handleRefresh" />
    <div ref="priceSystemGridShellRef" class="price-system-grid-shell">
      <Grid table-title="价格体系列表">
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: $t('ui.actionTitle.create', ['价格体系']),
                type: 'primary',
                icon: ACTION_ICON.ADD,
                tooltip: 'Insert 新增',
                auth: ['erp:price-system:create'],
                onClick: handleCreate,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                disabled: isEmpty(checkedIds),
                icon: ACTION_ICON.DELETE,
                auth: ['erp:price-system:delete'],
                popConfirm: {
                  title: `是否删除所选中数据？`,
                  confirm: handleDelete.bind(null, checkedIds),
                },
              },
            ]"
          />
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: $t('common.edit'),
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:price-system:update'],
                onClick: handleEdit.bind(null, row),
              },
              {
                label: $t('common.delete'),
                type: 'link',
                danger: true,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:price-system:delete'],
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.name]),
                  confirm: handleDelete.bind(null, [row.id!]),
                },
              },
            ]"
          />
        </template>
      </Grid>
    </div>
  </Page>
</template>

<style scoped>
.price-system-grid-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
</style>
