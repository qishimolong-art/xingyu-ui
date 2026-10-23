<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpImportExportRecordApi } from '#/api/erp/common/import-export-record';

import { computed, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Descriptions, Drawer, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getImportExportRecordPage } from '#/api/erp/common/import-export-record';

import { useGridColumns, useGridFormSchema } from './data';

defineOptions({ name: 'ErpExportRecord' });

const detailOpen = ref(false);
const currentRecord = ref<ErpImportExportRecordApi.RecordItem>();

const statusMap: Record<string, { color: string; label: string }> = {
  PROCESSING: { color: 'processing', label: '处理中' },
  SUCCESS: { color: 'success', label: '成功' },
  PARTIAL_SUCCESS: { color: 'warning', label: '部分成功' },
  FAILURE: { color: 'error', label: '失败' },
};

function renderStatus(status?: string) {
  return statusMap[status || ''] || { color: 'default', label: status || '-' };
}

function formatDuration(ms?: number) {
  if (ms === undefined || ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function handleDetail(row: ErpImportExportRecordApi.RecordItem) {
  currentRecord.value = row;
  detailOpen.value = true;
}

const formattedQueryParams = computed(() => {
  if (!currentRecord.value?.queryParams) return '-';
  try {
    return JSON.stringify(JSON.parse(currentRecord.value.queryParams), null, 2);
  } catch {
    return currentRecord.value.queryParams;
  }
});

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
        query: async ({ page }, formValues) =>
          getImportExportRecordPage({
            operationType: 'EXPORT',
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          }),
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
    },
  } as VxeTableGridOptions<ErpImportExportRecordApi.RecordItem>,
});
</script>

<template>
  <Page auto-content-height>
    <Grid table-title="导出记录">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: '刷新',
              icon: ACTION_ICON.REFRESH,
              onClick: () => gridApi.query(),
            },
          ]"
        />
      </template>

      <template #status="{ row }">
        <Tag :color="renderStatus(row.status).color">
          {{ renderStatus(row.status).label }}
        </Tag>
      </template>

      <template #duration="{ row }">
        {{ formatDuration(row.durationMs) }}
      </template>

      <template #action="{ row }">
        <TableAction
          :actions="[
            {
              label: '详情',
              auth: ['erp:export-record:query'],
              onClick: () => handleDetail(row),
            },
          ]"
        />
      </template>
    </Grid>

    <Drawer v-model:open="detailOpen" width="760" title="导出详情">
      <Descriptions v-if="currentRecord" :column="2" bordered size="small">
        <Descriptions.Item label="模块">{{
          currentRecord.moduleName
        }}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag :color="renderStatus(currentRecord.status).color">
            {{ renderStatus(currentRecord.status).label }}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="文件名">{{
          currentRecord.fileName || '-'
        }}</Descriptions.Item>
        <Descriptions.Item label="文件类型">{{
          currentRecord.fileType || '-'
        }}</Descriptions.Item>
        <Descriptions.Item label="导出数量">{{
          currentRecord.totalCount ?? 0
        }}</Descriptions.Item>
        <Descriptions.Item label="耗时">{{
          formatDuration(currentRecord.durationMs)
        }}</Descriptions.Item>
        <Descriptions.Item label="操作人">{{
          currentRecord.operatorName || '-'
        }}</Descriptions.Item>
        <Descriptions.Item label="导出时间">{{
          currentRecord.createTime || '-'
        }}</Descriptions.Item>
        <Descriptions.Item label="导出字段" :span="2">
          {{ currentRecord.exportFields || '-' }}
        </Descriptions.Item>
        <Descriptions.Item label="筛选条件" :span="2">
          <pre class="m-0 whitespace-pre-wrap">{{ formattedQueryParams }}</pre>
        </Descriptions.Item>
        <Descriptions.Item label="失败原因" :span="2">
          {{ currentRecord.errorMessage || '-' }}
        </Descriptions.Item>
      </Descriptions>
    </Drawer>
  </Page>
</template>
