<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseOrderApi } from '#/api/erp/purchase/order';

import { ref } from 'vue';

import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart, isEmpty } from '@vben/utils';

import { ElLoading, ElMessage } from 'element-plus';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deletePurchaseOrder,
  exportPurchaseOrder,
  getPurchaseOrderPage,
  updatePurchaseOrderStatus,
} from '#/api/erp/purchase/order';
import { $t } from '#/locales';
import { useErpSearchFieldConfig } from '#/views/erp/composables/useErpSearchFieldConfig';

import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import RemarkForm from './modules/remark-form.vue';

/** ERP 采购订单列表 */
defineOptions({ name: 'ErpPurchaseOrder' });

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [RemarkModal, remarkModalApi] = useVbenModal({
  connectedComponent: RemarkForm,
  destroyOnClose: true,
});

/** 刷新表格 */
function handleRefresh() {
  gridApi.query();
}

function normalizeSearchParams(values: Record<string, any>) {
  const params = { ...values };
  if (typeof params.no === 'string') {
    const normalized = params.no.trim().replaceAll(/\s+/g, '%');
    params.no = normalized || undefined;
  }
  if (typeof params.factoryOrderNo === 'string') {
    const normalized = params.factoryOrderNo.trim().replaceAll(/\s+/g, '%');
    params.factoryOrderNo = normalized || undefined;
  }
  if (typeof params.remark === 'string') {
    const normalized = params.remark.trim().replaceAll(/\s+/g, '%');
    params.remark = normalized || undefined;
  }
  return params;
}

/** 导出表格 */
async function handleExport() {
  const data = await exportPurchaseOrder(
    normalizeSearchParams(await gridApi.formApi.getValues()),
  );
  downloadFileFromBlobPart({ fileName: '采购订单.xls', source: data });
}

/** 新增采购订单 */
function handleCreate() {
  formModalApi.setData({ type: 'create' }).open();
}

/** 编辑采购订单 */
function handleEdit(row: ErpPurchaseOrderApi.PurchaseOrder) {
  formModalApi.setData({ type: 'edit', id: row.id }).open();
}

/** 修改采购订单备注 */
function handleEditRemark(row: ErpPurchaseOrderApi.PurchaseOrder) {
  remarkModalApi.setData(row).open();
}

/** 删除采购订单 */
async function handleDelete(ids: number[]) {
  const loadingInstance = ElLoading.service({
    text: $t('ui.actionMessage.deleting'),
  });
  try {
    await deletePurchaseOrder(ids);
    ElMessage.success($t('ui.actionMessage.deleteSuccess'));
    handleRefresh();
  } finally {
    loadingInstance.close();
  }
}

/** 审批/反审批操作 */
async function handleUpdateStatus(
  row: ErpPurchaseOrderApi.PurchaseOrder,
  status: number,
) {
  if (status !== 20) return;
  const loadingInstance = ElLoading.service({
    text: `确定${status === 20 ? '审批' : '反审批'}该订单吗？`,
  });
  try {
    await updatePurchaseOrderStatus(row.id!, status);
    ElMessage.success(`${status === 20 ? '审批' : '反审批'}成功`);
    handleRefresh();
  } finally {
    loadingInstance.close();
  }
}

const checkedIds = ref<number[]>([]);
function handleRowCheckboxChange({
  records,
}: {
  records: ErpPurchaseOrderApi.PurchaseOrder[];
}) {
  checkedIds.value = records.map((item) => item.id!);
}

/** 查看详情 */
function handleDetail(row: ErpPurchaseOrderApi.PurchaseOrder) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

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
          const params = normalizeSearchParams(formValues);
          return await getPurchaseOrderPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...params,
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
  } as VxeTableGridOptions<ErpPurchaseOrderApi.PurchaseOrder>,
  gridEvents: {
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
  },
});

useErpSearchFieldConfig('purchase_order', gridFormSchema, gridApi);
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
    <RemarkModal @success="handleRefresh" />
    <Grid table-title="采购订单列表">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('ui.actionTitle.create', ['采购订单']),
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['erp:purchase-order:create'],
              onClick: handleCreate,
            },
            {
              label: $t('ui.actionTitle.export'),
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              auth: ['erp:purchase-order:export'],
              onClick: handleExport,
            },
            {
              label: '批量删除',
              type: 'danger',
              disabled: isEmpty(checkedIds),
              icon: ACTION_ICON.DELETE,
              auth: ['erp:purchase-order:delete'],
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
              label: $t('common.detail'),
              type: 'primary',
              link: true,
              icon: ACTION_ICON.VIEW,
              auth: ['erp:purchase-order:query'],
              onClick: handleDetail.bind(null, row),
            },
            {
              label: $t('common.edit'),
              type: 'primary',
              link: true,
              icon: ACTION_ICON.EDIT,
              auth: ['erp:purchase-order:update'],
              ifShow: () => row.status !== 20,
              onClick: handleEdit.bind(null, row),
            },
            {
              label: '修改备注',
              type: 'primary',
              link: true,
              icon: ACTION_ICON.EDIT,
              auth: ['erp:purchase-order:update'],
              onClick: handleEditRemark.bind(null, row),
            },
            {
              label: '审批',
              type: 'primary',
              link: true,
              icon: ACTION_ICON.AUDIT,
              auth: ['erp:purchase-order:update-status'],
              ifShow: () => row.status === 10,
              popConfirm: {
                title: `确认审批${row.no}吗？`,
                confirm: handleUpdateStatus.bind(null, row, 20),
              },
            },
            {
              label: $t('common.delete'),
              type: 'danger',
              link: true,
              icon: ACTION_ICON.DELETE,
              auth: ['erp:purchase-order:delete'],
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.no]),
                confirm: handleDelete.bind(null, [row.id!]),
              },
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>
