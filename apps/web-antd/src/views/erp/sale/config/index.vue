<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpSaleConfigApi } from '#/api/erp/sale/config';

import { computed, nextTick, onActivated, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { isEmpty } from '@vben/utils';

import { message, Select, Spin } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteSaleConfig, getSaleConfigPage } from '#/api/erp/sale/config';
import { useSaleShortcut } from '#/views/erp/composables/useSaleShortcut';
import { $t } from '#/locales';

import {
  getConfigTypeLabel,
  saleConfigTypeOptions,
  useGridColumns,
  useGridFormSchema,
} from './data';
import Form from './modules/form.vue';

defineOptions({ name: 'ErpSaleConfig' });

const activeConfigType = ref('CONTRACT_TYPE');
const checkedIds = ref<number[]>([]);
const activationRefreshMaskVisible = ref(false);
const activeTitle = computed(() => getConfigTypeLabel(activeConfigType.value));

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

function handleRefresh() {
  gridApi.query();
}

function waitForFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function handleCreate() {
  formModalApi.setData({ defaultConfigType: activeConfigType.value }).open();
}

function handleEdit(row: ErpSaleConfigApi.SaleConfig) {
  formModalApi.setData(row).open();
}

async function handleDelete(ids: number[]) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting'),
    duration: 0,
  });
  try {
    await deleteSaleConfig(ids);
    message.success($t('ui.actionMessage.deleteSuccess'));
    checkedIds.value = [];
    handleRefresh();
  } finally {
    hideLoading();
  }
}

function handleRowCheckboxChange({
  records,
}: {
  records: ErpSaleConfigApi.SaleConfig[];
}) {
  checkedIds.value = records.map((item) => item.id!);
}

function handleConfigTypeChange(value: unknown) {
  activeConfigType.value = String(value || 'CONTRACT_TYPE');
  checkedIds.value = [];
  gridApi.query();
}

useSaleShortcut({
  onCreate: handleCreate,
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
  },
  gridClass: 'sale-config-vxe-grid',
  gridOptions: {
    columns: useGridColumns(),
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    height: '100%',
    id: 'erp-sale-config-list-v1',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getSaleConfigPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            configType: activeConfigType.value,
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
      search: false,
    },
  } as VxeTableGridOptions<ErpSaleConfigApi.SaleConfig>,
  gridEvents: {
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
  },
});

let activatedOnce = false;
let activationRefreshVersion = 0;

async function refreshActivatedSaleConfigPage() {
  const refreshVersion = ++activationRefreshVersion;
  activationRefreshMaskVisible.value = true;
  try {
    await nextTick();
    await waitForFrame();
    await waitForFrame();
    if (refreshVersion !== activationRefreshVersion) {
      return;
    }
    const proxyInfo = gridApi.grid?.getProxyInfo?.();
    const pager = proxyInfo?.pager;
    const pageSize = Number(pager?.pageSize || 20);
    const currentPage = Number(pager?.currentPage || 1);
    const formValues = await gridApi.formApi.getValues();
    let result = await getSaleConfigPage({
      pageNo: currentPage,
      pageSize,
      ...formValues,
      configType: activeConfigType.value,
    });
    const total = Number(result.total || 0);
    const pageCount = Math.max(Math.ceil(total / pageSize), 1);
    const finalPage = Math.min(currentPage, pageCount);
    if (finalPage !== currentPage) {
      result = await getSaleConfigPage({
        pageNo: finalPage,
        pageSize,
        ...formValues,
        configType: activeConfigType.value,
      });
    }
    if (refreshVersion !== activationRefreshVersion) {
      return;
    }
    const rows = result.list ?? [];
    if (pager) {
      pager.currentPage = finalPage;
      pager.pageSize = pageSize;
      pager.total = Number(result.total || 0);
    }
    await gridApi.grid?.loadData?.(rows);
    checkedIds.value = [];
    gridApi.grid?.clearCheckboxRow?.();
  } catch (error) {
    console.error('Error occurred while refreshing sale config page:', error);
  } finally {
    if (refreshVersion === activationRefreshVersion) {
      activationRefreshMaskVisible.value = false;
    }
  }
}

onActivated(() => {
  if (!activatedOnce) {
    activatedOnce = true;
    return;
  }
  void refreshActivatedSaleConfigPage();
});
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="handleRefresh" />
    <div class="sale-config-grid-shell">
      <Grid :table-title="`${activeTitle}列表`">
        <template #toolbar-actions>
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">配置类型</span>
            <Select
              class="w-[180px]"
              :value="activeConfigType"
              :options="saleConfigTypeOptions"
              @change="handleConfigTypeChange"
            />
          </div>
        </template>
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '新增',
                type: 'primary',
                icon: ACTION_ICON.ADD,
                tooltip: 'Insert 新增',
                auth: ['erp:sale-config:create'],
                onClick: handleCreate,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                disabled: isEmpty(checkedIds),
                icon: ACTION_ICON.DELETE,
                auth: ['erp:sale-config:delete'],
                popConfirm: {
                  title: '是否删除选中的销售配置？',
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
                auth: ['erp:sale-config:update'],
                onClick: handleEdit.bind(null, row),
              },
              {
                label: $t('common.delete'),
                type: 'link',
                danger: true,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:sale-config:delete'],
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.name]),
                  confirm: handleDelete.bind(null, [row.id!]),
                },
              },
            ]"
          />
        </template>
      </Grid>
      <div
        v-if="activationRefreshMaskVisible"
        class="sale-config-activation-mask"
      >
        <Spin size="small" />
      </div>
    </div>
  </Page>
</template>

<style scoped>
.sale-config-grid-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.sale-config-grid-shell :deep(.sale-config-vxe-grid) {
  height: 100% !important;
  min-height: 0;
}

.sale-config-activation-mask {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  background: rgb(255 255 255 / 38%);
  backdrop-filter: blur(1px);
}
</style>
