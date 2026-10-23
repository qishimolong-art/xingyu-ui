<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { useAccess } from '@vben/access';
import { Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteAssemblyOrder,
  ErpAssemblyOrderApi,
  exportAssemblyOrder,
  getAssemblyOrderPage,
  recordAssemblyOrderPrint,
} from '#/api/erp/assembly/order';

import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

defineOptions({ name: 'ErpAssemblyOrder' });

const { hasAccessByCodes } = useAccess();
const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

function refresh() {
  gridApi.query();
}

function openCreate() {
  formModalApi.setData(null).open();
}

function openOrder(row: ErpAssemblyOrderApi.Order, readonly = false) {
  formModalApi
    .setData({ ...row, readonly, type: readonly ? 'detail' : 'edit' })
    .open();
}

function openFromNo(row: ErpAssemblyOrderApi.Order) {
  openOrder(row, !canEdit(row));
}

function canEdit(row: ErpAssemblyOrderApi.Order) {
  return (
    row.status === ErpAssemblyOrderApi.STATUS_DRAFT &&
    hasAccessByCodes(['erp:assembly-order:update'])
  );
}

async function remove(row: ErpAssemblyOrderApi.Order) {
  await deleteAssemblyOrder(row.id!);
  message.success('草稿删除成功');
  refresh();
}

async function exportRow(row: ErpAssemblyOrderApi.Order) {
  const data = await exportAssemblyOrder(row.id!);
  downloadFileFromBlobPart({
    fileName: `套件组装单-${row.no || row.id}.xls`,
    source: data,
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? '-')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function printRows(row: ErpAssemblyOrderApi.Order) {
  const fields = [
    ['单号', row.no],
    ['单据日期', row.assemblyTime],
    ['单据状态', statusMeta(row.status).label],
    ['对象', row.recipeModuleName],
    ['图号', row.productDrawingNo],
    ['产品编码', row.productCode],
    ['产品名称', row.productName],
    ['产地', row.productOriginPlace],
    ['规格', row.productStandard],
    ['特征码', row.productFeatureCode],
    ['品牌', row.productBrand],
    ['车型', row.productVehicleModel],
    ['仓库', row.warehouseName],
    ['仓位', row.productShelf],
    ['数量', row.setCount],
    ['组装成本金额', row.totalCost],
    ['成本价', row.unitCost],
    ['零售价', row.productRetailPrice],
    ['创建人', row.creatorName],
    ['编辑人', row.updaterName],
  ];
  return fields
    .map(
      ([label, value]) =>
        `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`,
    )
    .join('');
}

async function printRow(row: ErpAssemblyOrderApi.Order) {
  const printWindow = window.open('', '_blank', 'width=960,height=720');
  if (!printWindow) {
    message.warning('浏览器阻止了打印窗口，请允许弹出窗口后重试');
    return;
  }
  printWindow.document.title = `套件组装单-${row.no || row.id}`;
  printWindow.document.body.innerHTML = `
    <style>
      body{font-family:Arial,"Microsoft YaHei",sans-serif;margin:24px;color:#222;font-size:12px}
      h1{font-size:18px;text-align:center;margin:0 0 18px}
      table{width:100%;border-collapse:collapse;table-layout:fixed}
      th,td{border:1px solid #999;padding:8px;text-align:left;word-break:break-all}
      th{width:18%;background:#f5f5f5;font-weight:600}
      @media print{body{margin:0}}
    </style>
    <h1>套件组装单</h1>
    <table><tbody>${printRows(row)}</tbody></table>`;
  try {
    await recordAssemblyOrderPrint(row.id!);
    await gridApi.query();
  } catch {
    message.warning('打印记录保存失败，本次仍可继续打印');
  }
  printWindow.focus();
  printWindow.print();
}

function statusMeta(status?: number) {
  if (status === ErpAssemblyOrderApi.STATUS_CONFIRMED) {
    return { color: 'blue', label: '已确认' };
  }
  if (status === ErpAssemblyOrderApi.STATUS_ASSEMBLING) {
    return { color: 'processing', label: '装配中' };
  }
  if (status === 20) return { color: 'success', label: '已完成' };
  if (status === 30) return { color: 'default', label: '历史已作废' };
  return { color: 'warning', label: '草稿' };
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 72 },
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    showOverflow: 'tooltip',
    proxyConfig: {
      ajax: {
        query: async ({ page }, values) =>
          getAssemblyOrderPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...values,
          }),
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ErpAssemblyOrderApi.Order>,
});
</script>

<template>
  <Page auto-content-height class="assembly-order-page">
    <FormModal @success="refresh" />
    <Grid class="assembly-order-grid" table-title="套件组装单">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: '新增组装单',
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['erp:assembly-order:create'],
              onClick: openCreate,
            },
          ]"
        />
      </template>
      <template #status="{ row }">
        <Tag :color="statusMeta(row.status).color">{{
          statusMeta(row.status).label
        }}</Tag>
      </template>
      <template #no="{ row }">
        <button
          type="button"
          class="assembly-order-number-link"
          :title="row.no || ''"
          @click.stop="openFromNo(row)"
        >
          {{ row.no || '-' }}
        </button>
      </template>
      <template #deleteAction="{ row }">
        <TableAction
          :actions="[
            {
              label: '删除',
              type: 'link',
              danger: true,
              ifShow: () => row.status === 10,
              auth: ['erp:assembly-order:delete'],
              popConfirm: {
                title: '确认删除该草稿？',
                confirm: () => remove(row),
              },
            },
          ]"
        />
      </template>
      <template #printAction="{ row }">
        <Button
          v-access:code="['erp:assembly-order:query']"
          class="assembly-order-action-link"
          type="link"
          @click.stop="printRow(row)"
        >
          打印
        </Button>
      </template>
      <template #exportAction="{ row }">
        <Button
          v-access:code="['erp:assembly-order:query']"
          class="assembly-order-action-link"
          type="link"
          @click.stop="exportRow(row)"
        >
          导出
        </Button>
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
.assembly-order-page {
  font-size: 12px;
}

:deep(.assembly-order-grid .vxe-table--render-default),
:deep(.assembly-order-grid .vxe-grid--form-wrapper),
:deep(.assembly-order-grid .vxe-toolbar),
:deep(.assembly-order-grid .vxe-grid--pager-wrapper),
:deep(.assembly-order-grid .ant-btn) {
  font-size: 12px;
}

.assembly-order-number-link,
.assembly-order-action-link {
  height: auto;
  padding: 0;
  color: hsl(var(--primary));
  font-size: 12px;
  line-height: 20px;
}

.assembly-order-number-link {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: transparent;
  border: 0;
  cursor: pointer;
}
</style>
