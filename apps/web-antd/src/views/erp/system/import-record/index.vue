<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpImportExportRecordApi } from '#/api/erp/common/import-export-record';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { downloadFileFromBlobPart } from '@vben/utils';

import {
  Button,
  Descriptions,
  Drawer,
  message,
  Table,
  Tag,
} from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  downloadImportFailureDetails,
  getImportExportRecordDetailPage,
  getImportExportRecordPage,
} from '#/api/erp/common/import-export-record';

import { useGridColumns, useGridFormSchema } from './data';

defineOptions({ name: 'ErpImportRecord' });

const detailOpen = ref(false);
const currentRecord = ref<ErpImportExportRecordApi.RecordItem>();
const detailLoading = ref(false);
const detailRows = ref<ErpImportExportRecordApi.DetailItem[]>([]);
const detailTotal = ref(0);
const detailPage = ref({ current: 1, pageSize: 10 });
const failureDownloadLoading = ref(false);

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

async function loadDetails(
  pageNo = detailPage.value.current,
  pageSize = detailPage.value.pageSize,
) {
  if (!currentRecord.value?.id) return;
  detailLoading.value = true;
  try {
    const result = await getImportExportRecordDetailPage({
      recordId: currentRecord.value.id,
      pageNo,
      pageSize,
    });
    detailRows.value = result.list || [];
    detailTotal.value = result.total || 0;
    detailPage.value = { current: pageNo, pageSize };
  } finally {
    detailLoading.value = false;
  }
}

function handleDetail(row: ErpImportExportRecordApi.RecordItem) {
  currentRecord.value = row;
  detailOpen.value = true;
  detailRows.value = [];
  detailTotal.value = 0;
  detailPage.value = { current: 1, pageSize: 10 };
  void loadDetails(1, 10);
}

function formatRawData(rawData?: string) {
  if (!rawData) return '-';
  try {
    return JSON.stringify(JSON.parse(rawData), null, 2);
  } catch {
    return rawData;
  }
}

function rowHasRawData(row: ErpImportExportRecordApi.DetailItem) {
  return !!row.rawData;
}

async function handleDownloadFailureDetails() {
  if (!currentRecord.value?.id) return;
  if ((currentRecord.value.failureCount ?? 0) <= 0) {
    message.warning('当前导入记录没有错误数据');
    return;
  }
  failureDownloadLoading.value = true;
  try {
    const data = await downloadImportFailureDetails(currentRecord.value.id);
    downloadFileFromBlobPart({
      fileName: `${currentRecord.value.fileName?.replace(/\.[^.]+$/, '') || currentRecord.value.moduleName || '导入'}-错误数据.xls`,
      source: data,
    });
  } finally {
    failureDownloadLoading.value = false;
  }
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
        query: async ({ page }, formValues) =>
          getImportExportRecordPage({
            operationType: 'IMPORT',
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

const detailColumns = [
  { title: '行号', dataIndex: 'rowNo', width: 90 },
  { title: '业务标识', dataIndex: 'bizKey', width: 160 },
  { title: '业务名称', dataIndex: 'bizName', width: 160 },
  { title: '失败原因', dataIndex: 'failureReason', ellipsis: true },
];
</script>

<template>
  <Page auto-content-height>
    <Grid table-title="导入记录">
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
              auth: ['erp:import-record:query'],
              onClick: () => handleDetail(row),
            },
          ]"
        />
      </template>
    </Grid>

    <Drawer v-model:open="detailOpen" width="960" title="导入详情">
      <template #extra>
        <Button
          :disabled="!currentRecord || (currentRecord.failureCount ?? 0) <= 0"
          :loading="failureDownloadLoading"
          @click="handleDownloadFailureDetails"
        >
          <IconifyIcon icon="lucide:download" />
          下载错误数据
        </Button>
      </template>

      <Descriptions v-if="currentRecord" :column="3" bordered size="small">
        <Descriptions.Item label="模块">{{
          currentRecord.moduleName
        }}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag :color="renderStatus(currentRecord.status).color">
            {{ renderStatus(currentRecord.status).label }}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="操作人">{{
          currentRecord.operatorName || '-'
        }}</Descriptions.Item>
        <Descriptions.Item label="文件名">{{
          currentRecord.fileName || '-'
        }}</Descriptions.Item>
        <Descriptions.Item label="总数">{{
          currentRecord.totalCount ?? 0
        }}</Descriptions.Item>
        <Descriptions.Item label="耗时">{{
          formatDuration(currentRecord.durationMs)
        }}</Descriptions.Item>
        <Descriptions.Item label="成功">{{
          currentRecord.successCount ?? 0
        }}</Descriptions.Item>
        <Descriptions.Item label="失败">{{
          currentRecord.failureCount ?? 0
        }}</Descriptions.Item>
        <Descriptions.Item label="新增">{{
          currentRecord.createCount ?? 0
        }}</Descriptions.Item>
        <Descriptions.Item label="更新">{{
          currentRecord.updateCount ?? 0
        }}</Descriptions.Item>
        <Descriptions.Item label="开始时间">{{
          currentRecord.startTime || '-'
        }}</Descriptions.Item>
        <Descriptions.Item label="结束时间">{{
          currentRecord.endTime || '-'
        }}</Descriptions.Item>
        <Descriptions.Item label="整体失败原因" :span="3">
          {{ currentRecord.errorMessage || '-' }}
        </Descriptions.Item>
      </Descriptions>

      <Table
        class="mt-4"
        :columns="detailColumns"
        :data-source="detailRows"
        :loading="detailLoading"
        row-key="id"
        size="small"
        bordered
        :expandable="{ rowExpandable: rowHasRawData }"
        :pagination="{
          current: detailPage.current,
          pageSize: detailPage.pageSize,
          total: detailTotal,
          showSizeChanger: true,
        }"
        @change="
          (pagination: any) =>
            loadDetails(pagination.current, pagination.pageSize)
        "
      >
        <template #expandedRowRender="{ record }">
          <pre
            class="m-0 max-h-60 overflow-auto whitespace-pre-wrap break-all text-xs"
            >{{ formatRawData(record.rawData) }}</pre
          >
        </template>
      </Table>
    </Drawer>
  </Page>
</template>
