<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpSupplierApi } from '#/api/erp/purchase/supplier';

import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { ElLoading, ElMessage } from 'element-plus';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteSupplier,
  exportSupplier,
  getSupplierPage,
} from '#/api/erp/purchase/supplier';
import { $t } from '#/locales';
import { useErpSearchFieldConfig } from '#/views/erp/composables/useErpSearchFieldConfig';
import { confirmErpExportCaptcha } from '#/views/erp/utils/export-captcha';

import { useGridColumns, useGridFormSchema } from './data';
import SupplierForm from './modules/form.vue';
import ImportForm from './modules/import-form.vue';

/** 供应商管理 */
defineOptions({ name: 'ErpSupplier' });

/** 刷新表格 */
function handleRefresh() {
  gridApi.query();
}

/** 创建供应商 */
function handleCreate() {
  formModalApi.setData(null).open();
}

/** 导入供应商 */
function handleImport() {
  importModalApi.open();
}

/** 编辑供应商 */
function handleEdit(row: ErpSupplierApi.Supplier) {
  formModalApi.setData(row).open();
}

/** 删除供应商 */
async function handleDelete(row: ErpSupplierApi.Supplier) {
  const loadingInstance = ElLoading.service({
    text: $t('ui.actionMessage.deleting', [row.name]),
  });
  try {
    await deleteSupplier(row.id!);
    ElMessage.success($t('ui.actionMessage.deleteSuccess', [row.name]));
    handleRefresh();
  } finally {
    loadingInstance.close();
  }
}

/** 导出供应商 */
async function handleExport() {
  if (!(await confirmErpExportCaptcha())) {
    return;
  }
  const data = await exportSupplier(await gridApi.formApi.getValues());
  downloadFileFromBlobPart({ fileName: '供应商.xls', source: data });
}

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: SupplierForm,
  destroyOnClose: true,
});

const [ImportModal, importModalApi] = useVbenModal({
  connectedComponent: ImportForm,
  destroyOnClose: true,
});

const gridFormSchema = useGridFormSchema();

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: gridFormSchema,
  },
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          return await getSupplierPage({
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
  } as VxeTableGridOptions<ErpSupplierApi.Supplier>,
});

useErpSearchFieldConfig('supplier', gridFormSchema, gridApi);
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【采购】采购订单、入库、退货"
        url="https://doc.iocoder.cn/erp/purchase/"
      />
    </template>

    <FormModal @success="handleRefresh" />
    <ImportModal @success="handleRefresh" />
    <Grid table-title="供应商列表">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('ui.actionTitle.create', ['供应商']),
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['erp:supplier:create'],
              onClick: handleCreate,
            },
            {
              label: $t('ui.actionTitle.import'),
              type: 'primary',
              icon: ACTION_ICON.UPLOAD,
              auth: ['erp:supplier:import'],
              onClick: handleImport,
            },
            {
              label: $t('ui.actionTitle.export'),
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              auth: ['erp:supplier:export'],
              onClick: handleExport,
            },
          ]"
        />
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: $t('common.edit'),
              type: 'primary',
              link: true,
              icon: ACTION_ICON.EDIT,
              auth: ['erp:supplier:update'],
              onClick: handleEdit.bind(null, row),
            },
            {
              label: $t('common.delete'),
              type: 'danger',
              link: true,
              icon: ACTION_ICON.DELETE,
              auth: ['erp:supplier:delete'],
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.name]),
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>
