<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { computed, reactive } from 'vue';
import { useRoute } from 'vue-router';

import { downloadFileFromBlobPart } from '@vben/utils';

import {
  Button,
  Card,
  DatePicker,
  Form,
  FormItem,
  Input,
  Pagination,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import BusinessReportEmptyState from '#/views/erp/report/components/business-report-empty-state.vue';
import BusinessReportShell from '#/views/erp/report/components/business-report-shell.vue';

defineOptions({ name: 'ErpBusinessReportFixedAsset' });

const { RangePicker } = DatePicker;
const DEFAULT_PAGE_SIZE = 10;

type PageKey =
  | 'asset-card'
  | 'department-summary'
  | 'depreciation-detail'
  | 'disposal-record'
  | 'history'
  | 'transfer-record';

type MetricCard = {
  label: string;
  note: string;
  tone: 'blue' | 'green' | 'orange' | 'purple';
  value: string;
};

type ReportColumn = {
  align?: 'center' | 'left' | 'right';
  dataIndex: string;
  title: string;
  width: number;
};

type ReportRow = Record<string, number | string>;

type PageConfig = {
  columns: ReportColumn[];
  emptyDescription: string;
  emptyTitle: string;
  metrics: MetricCard[];
  statusItems: Array<{
    label: string;
    status: string;
    tone: 'blue' | 'gold' | 'green' | 'orange';
  }>;
  title: string;
};

const route = useRoute();

const query = reactive({
  assetStatus: undefined as string | undefined,
  dateRange: [] as unknown[],
  department: '',
  keyword: '',
});

const state = reactive({
  exportLoading: false,
  pageNo: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  total: 0,
});

const pageConfigs: Record<PageKey, PageConfig> = {
  'asset-card': {
    title: '固定资产卡片台账',
    metrics: [
      { label: '资产数量', value: '—', note: '按资产卡片统计', tone: 'blue' },
      {
        label: '资产原值',
        value: '—',
        note: '按已确认卡片汇总',
        tone: 'green',
      },
      {
        label: '累计折旧',
        value: '—',
        note: '折旧规则确认后显示',
        tone: 'orange',
      },
      {
        label: '账面净值',
        value: '待规则确认',
        note: '由原值与累计折旧计算',
        tone: 'purple',
      },
    ],
    statusItems: [
      { label: '卡片来源', status: '暂无数据', tone: 'blue' },
      { label: '折旧参数', status: '待规则确认', tone: 'gold' },
      { label: '凭证关联', status: '待规则确认', tone: 'orange' },
    ],
    columns: [
      { title: '资产编号', dataIndex: 'assetNo', width: 160 },
      { title: '资产名称', dataIndex: 'assetName', width: 180 },
      { title: '资产类别', dataIndex: 'assetCategory', width: 130 },
      { title: '归属部门', dataIndex: 'ownerDept', width: 140 },
      { title: '使用部门', dataIndex: 'useDept', width: 140 },
      { title: '保管人', dataIndex: 'keeper', width: 120 },
      { title: '启用日期', dataIndex: 'startDate', width: 130 },
      {
        title: '原值',
        dataIndex: 'originalAmount',
        width: 140,
        align: 'right',
      },
      {
        title: '累计折旧',
        dataIndex: 'depreciationAmount',
        width: 140,
        align: 'right',
      },
      { title: '资产状态', dataIndex: 'assetStatus', width: 120 },
      { title: '来源单据', dataIndex: 'sourceNo', width: 170 },
    ],
    emptyTitle: '暂无固定资产卡片数据',
    emptyDescription:
      '建立资产卡片后，可按部门、类别、保管人、启用日期和来源单据查看资产台账。',
  },
  'depreciation-detail': {
    title: '固定资产折旧明细',
    metrics: [
      { label: '本期折旧', value: '—', note: '按会计期间统计', tone: 'blue' },
      {
        label: '折旧资产数',
        value: '—',
        note: '同资产同期间只计一次',
        tone: 'green',
      },
      {
        label: '停提资产数',
        value: '—',
        note: '到期或处置后停止',
        tone: 'orange',
      },
      {
        label: '凭证状态',
        value: '待规则确认',
        note: '凭证关联后显示',
        tone: 'purple',
      },
    ],
    statusItems: [
      { label: '折旧方法', status: '待规则确认', tone: 'gold' },
      { label: '残值及期限', status: '待规则确认', tone: 'gold' },
      { label: '期间锁定', status: '待规则确认', tone: 'orange' },
    ],
    columns: [
      { title: '期间', dataIndex: 'period', width: 120 },
      { title: '资产编号', dataIndex: 'assetNo', width: 160 },
      { title: '资产名称', dataIndex: 'assetName', width: 180 },
      { title: '承担部门', dataIndex: 'expenseDept', width: 140 },
      { title: '折旧方法', dataIndex: 'method', width: 130 },
      {
        title: '本期折旧',
        dataIndex: 'periodAmount',
        width: 140,
        align: 'right',
      },
      {
        title: '累计折旧',
        dataIndex: 'totalAmount',
        width: 140,
        align: 'right',
      },
      { title: '期末净值', dataIndex: 'netAmount', width: 140, align: 'right' },
      { title: '计提状态', dataIndex: 'status', width: 120 },
      { title: '凭证号', dataIndex: 'voucherNo', width: 150 },
    ],
    emptyTitle: '暂无折旧明细数据',
    emptyDescription:
      '折旧参数和期间规则确认后，可按资产、部门和期间查看折旧明细。',
  },
  'department-summary': {
    title: '部门资产汇总',
    metrics: [
      {
        label: '部门数',
        value: '—',
        note: '按归属或使用部门统计',
        tone: 'blue',
      },
      { label: '资产原值', value: '—', note: '按部门汇总', tone: 'green' },
      { label: '累计折旧', value: '—', note: '按承担部门汇总', tone: 'orange' },
      {
        label: '净值占比',
        value: '待规则确认',
        note: '口径确认后显示',
        tone: 'purple',
      },
    ],
    statusItems: [
      { label: '归属部门', status: '暂无数据', tone: 'blue' },
      { label: '使用部门', status: '暂无数据', tone: 'blue' },
      { label: '承担部门', status: '待规则确认', tone: 'gold' },
    ],
    columns: [
      { title: '部门', dataIndex: 'department', width: 160 },
      {
        title: '资产数量',
        dataIndex: 'assetCount',
        width: 120,
        align: 'right',
      },
      {
        title: '原值',
        dataIndex: 'originalAmount',
        width: 140,
        align: 'right',
      },
      {
        title: '累计折旧',
        dataIndex: 'depreciationAmount',
        width: 140,
        align: 'right',
      },
      { title: '账面净值', dataIndex: 'netAmount', width: 140, align: 'right' },
      {
        title: '本期折旧',
        dataIndex: 'periodAmount',
        width: 140,
        align: 'right',
      },
      {
        title: '在用数量',
        dataIndex: 'activeCount',
        width: 120,
        align: 'right',
      },
      {
        title: '处置数量',
        dataIndex: 'disposedCount',
        width: 120,
        align: 'right',
      },
    ],
    emptyTitle: '暂无部门资产汇总数据',
    emptyDescription:
      '资产卡片和部门折旧归属确认后，可按部门查看资产原值、折旧和净值。',
  },
  'transfer-record': {
    title: '资产变更记录',
    metrics: [
      { label: '变更单数', value: '—', note: '按变更日期统计', tone: 'blue' },
      {
        label: '部门转移',
        value: '—',
        note: '归属或使用部门变更',
        tone: 'green',
      },
      { label: '保管变更', value: '—', note: '保管人变更', tone: 'orange' },
      {
        label: '折旧归属',
        value: '待规则确认',
        note: '按有效期间处理',
        tone: 'purple',
      },
    ],
    statusItems: [
      { label: '变更来源', status: '暂无数据', tone: 'blue' },
      { label: '有效期间', status: '待规则确认', tone: 'gold' },
      { label: '日志留痕', status: '待规则确认', tone: 'orange' },
    ],
    columns: [
      { title: '变更日期', dataIndex: 'changeDate', width: 140 },
      { title: '变更单号', dataIndex: 'changeNo', width: 170 },
      { title: '资产编号', dataIndex: 'assetNo', width: 160 },
      { title: '资产名称', dataIndex: 'assetName', width: 180 },
      { title: '变更类型', dataIndex: 'changeType', width: 130 },
      { title: '变更前', dataIndex: 'beforeValue', width: 180 },
      { title: '变更后', dataIndex: 'afterValue', width: 180 },
      { title: '经办人', dataIndex: 'operator', width: 120 },
      { title: '状态', dataIndex: 'status', width: 120 },
    ],
    emptyTitle: '暂无资产变更记录',
    emptyDescription:
      '部门、保管人或使用状态发生变更后，可在此查看变更前后内容和经办信息。',
  },
  'disposal-record': {
    title: '资产处置记录',
    metrics: [
      { label: '处置单数', value: '—', note: '按处置日期统计', tone: 'blue' },
      { label: '处置原值', value: '—', note: '按资产卡片汇总', tone: 'green' },
      { label: '处置净值', value: '—', note: '折旧确认后显示', tone: 'orange' },
      {
        label: '处置损益',
        value: '待规则确认',
        note: '凭证规则确认后显示',
        tone: 'purple',
      },
    ],
    statusItems: [
      { label: '处置方式', status: '暂无数据', tone: 'blue' },
      { label: '损益规则', status: '待规则确认', tone: 'gold' },
      { label: '凭证关联', status: '待规则确认', tone: 'orange' },
    ],
    columns: [
      { title: '处置日期', dataIndex: 'disposeDate', width: 140 },
      { title: '处置单号', dataIndex: 'disposeNo', width: 170 },
      { title: '资产编号', dataIndex: 'assetNo', width: 160 },
      { title: '资产名称', dataIndex: 'assetName', width: 180 },
      { title: '处置方式', dataIndex: 'disposeType', width: 130 },
      {
        title: '原值',
        dataIndex: 'originalAmount',
        width: 140,
        align: 'right',
      },
      {
        title: '累计折旧',
        dataIndex: 'depreciationAmount',
        width: 140,
        align: 'right',
      },
      {
        title: '处置收入',
        dataIndex: 'incomeAmount',
        width: 140,
        align: 'right',
      },
      {
        title: '处置损益',
        dataIndex: 'profitAmount',
        width: 140,
        align: 'right',
      },
      { title: '凭证号', dataIndex: 'voucherNo', width: 150 },
    ],
    emptyTitle: '暂无资产处置记录',
    emptyDescription:
      '资产处置确认后，可按处置方式、收入、累计折旧和凭证号核对处置结果。',
  },
  history: {
    title: '历史固定资产口径',
    metrics: [
      { label: '历史卡片', value: '—', note: '按切换期初核对', tone: 'blue' },
      { label: '历史原值', value: '—', note: '保留核对依据', tone: 'green' },
      {
        label: '历史累计折旧',
        value: '—',
        note: '保留差异说明',
        tone: 'orange',
      },
      {
        label: '接续状态',
        value: '待规则确认',
        note: '确认后接续核算',
        tone: 'purple',
      },
    ],
    statusItems: [
      { label: '期初导入', status: '暂无数据', tone: 'blue' },
      { label: '差异处理', status: '待规则确认', tone: 'gold' },
      { label: '新旧接续', status: '待规则确认', tone: 'orange' },
    ],
    columns: [
      { title: '核对批次', dataIndex: 'batchNo', width: 160 },
      { title: '资产编号', dataIndex: 'assetNo', width: 160 },
      { title: '资产名称', dataIndex: 'assetName', width: 180 },
      {
        title: '期初原值',
        dataIndex: 'openingOriginalAmount',
        width: 140,
        align: 'right',
      },
      {
        title: '期初累计折旧',
        dataIndex: 'openingDepreciationAmount',
        width: 150,
        align: 'right',
      },
      {
        title: '剩余期限',
        dataIndex: 'remainMonths',
        width: 120,
        align: 'right',
      },
      { title: '核对状态', dataIndex: 'checkStatus', width: 120 },
      { title: '差异说明', dataIndex: 'differenceRemark', width: 220 },
    ],
    emptyTitle: '暂无历史固定资产口径数据',
    emptyDescription:
      '期初核对完成后，可在此查看原值、累计折旧、剩余期限和差异说明。',
  },
};

const statusColor = {
  blue: 'blue',
  gold: 'gold',
  green: 'green',
  orange: 'orange',
} as const;

function normalizePageKey(value: unknown): PageKey {
  if (typeof value !== 'string') return 'asset-card';
  const parts = value.split('/').filter(Boolean);
  const key = parts[parts.length - 1] as PageKey | undefined;
  return key && key in pageConfigs ? key : 'asset-card';
}

const pageKey = computed(() => normalizePageKey(route?.path));
const pageConfig = computed(() => pageConfigs[pageKey.value]);
const tableColumns = computed<TableColumnsType<ReportRow>>(() =>
  pageConfig.value.columns.map((column) => ({
    align: column.align,
    dataIndex: column.dataIndex,
    title: column.title,
    width: column.width,
  })),
);
const tableScrollX = computed(() =>
  pageConfig.value.columns.reduce((sum, column) => sum + column.width, 0),
);
const tableRows = computed<ReportRow[]>(() => []);

function escapeCsv(value: unknown): string {
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function buildEmptyCsvBlob() {
  const header = pageConfig.value.columns
    .map((column) => escapeCsv(column.title))
    .join(',');
  return new Blob([`\uFEFF${header}`], { type: 'text/csv;charset=utf-8' });
}

function handleSearch() {
  state.pageNo = 1;
}

function handleReset() {
  query.assetStatus = undefined;
  query.dateRange = [];
  query.department = '';
  query.keyword = '';
  state.pageNo = 1;
  state.pageSize = DEFAULT_PAGE_SIZE;
}

function handlePageChange(page: number, pageSize: number) {
  state.pageNo = page;
  state.pageSize = pageSize;
}

function handleExport() {
  state.exportLoading = true;
  try {
    downloadFileFromBlobPart({
      fileName: `${pageConfig.value.title}.csv`,
      source: buildEmptyCsvBlob(),
    });
  } finally {
    state.exportLoading = false;
  }
}
</script>

<template>
  <BusinessReportShell
    :title="`经营报表 · 固定资产及折旧 · ${pageConfig.title}`"
    body-scrollable
  >
    <section class="erp-fixed-asset-report">
      <Card class="erp-fixed-asset-report__filter" size="small">
        <Form layout="inline" :model="query">
          <FormItem label="期间">
            <RangePicker
              v-model:value="query.dateRange"
              class="erp-fixed-asset-report__date"
            />
          </FormItem>
          <FormItem label="部门">
            <Input
              v-model:value="query.department"
              allow-clear
              placeholder="归属/使用/承担部门"
            />
          </FormItem>
          <FormItem label="状态">
            <Select
              v-model:value="query.assetStatus"
              allow-clear
              class="erp-fixed-asset-report__status-select"
              placeholder="请选择状态"
              :options="[
                { label: '全部', value: '' },
                { label: '在用', value: 'active' },
                { label: '停用', value: 'inactive' },
                { label: '已处置', value: 'disposed' },
              ]"
            />
          </FormItem>
          <FormItem label="关键词">
            <Input
              v-model:value="query.keyword"
              allow-clear
              placeholder="资产编号/名称/单号/保管人"
            />
          </FormItem>
          <FormItem>
            <Space>
              <Button type="primary" @click="handleSearch">查询</Button>
              <Button @click="handleReset">重置</Button>
              <Button :loading="state.exportLoading" @click="handleExport"
                >导出</Button
              >
            </Space>
          </FormItem>
        </Form>
      </Card>

      <div class="erp-fixed-asset-report__metrics">
        <Card
          v-for="metric in pageConfig.metrics"
          :key="metric.label"
          class="erp-fixed-asset-report__metric"
          size="small"
        >
          <span>{{ metric.label }}</span>
          <strong
            :class="`erp-fixed-asset-report__metric-value--${metric.tone}`"
          >
            {{ metric.value }}
          </strong>
          <em>{{ metric.note }}</em>
        </Card>
      </div>

      <Card class="erp-fixed-asset-report__status-card" size="small">
        <div class="erp-fixed-asset-report__status-list">
          <span v-for="item in pageConfig.statusItems" :key="item.label">
            {{ item.label }}
            <Tag :color="statusColor[item.tone]">{{ item.status }}</Tag>
          </span>
        </div>
      </Card>

      <Card
        class="erp-fixed-asset-report__table-card"
        size="small"
        :title="pageConfig.title"
      >
        <Table
          :columns="tableColumns"
          :data-source="tableRows"
          :pagination="false"
          :row-key="
            (record) =>
              String(
                record.assetNo ||
                  record.batchNo ||
                  record.changeNo ||
                  record.disposeNo ||
                  '',
              )
          "
          :scroll="{ x: tableScrollX, y: 360 }"
          size="small"
        >
          <template #emptyText>
            <BusinessReportEmptyState
              :title="pageConfig.emptyTitle"
              :description="pageConfig.emptyDescription"
              status="NO_DATA"
            />
          </template>
        </Table>
        <div class="erp-fixed-asset-report__pager">
          <span>共 0 条记录</span>
          <Pagination
            v-model:current="state.pageNo"
            v-model:page-size="state.pageSize"
            :page-size-options="['10', '20', '50']"
            :total="state.total"
            show-size-changer
            @change="handlePageChange"
          />
        </div>
      </Card>
    </section>
  </BusinessReportShell>
</template>

<style scoped>
.erp-fixed-asset-report {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 12px;
}

.erp-fixed-asset-report__filter {
  flex: 0 0 auto;
}

.erp-fixed-asset-report__date {
  width: 240px;
}

.erp-fixed-asset-report__status-select {
  width: 140px;
}

.erp-fixed-asset-report__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.erp-fixed-asset-report__metric :deep(.ant-card-body) {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.erp-fixed-asset-report__metric span {
  color: #64748b;
  font-size: 13px;
}

.erp-fixed-asset-report__metric strong {
  font-size: 24px;
  line-height: 1.2;
}

.erp-fixed-asset-report__metric em {
  color: #94a3b8;
  font-size: 12px;
  font-style: normal;
}

.erp-fixed-asset-report__metric-value--blue {
  color: #2563eb;
}

.erp-fixed-asset-report__metric-value--green {
  color: #16a34a;
}

.erp-fixed-asset-report__metric-value--orange {
  color: #f59e0b;
}

.erp-fixed-asset-report__metric-value--purple {
  color: #7c3aed;
}

.erp-fixed-asset-report__status-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  color: #475569;
  font-size: 13px;
}

.erp-fixed-asset-report__status-list span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.erp-fixed-asset-report__table-card {
  flex: 1 1 auto;
  min-height: 0;
}

.erp-fixed-asset-report__table-card :deep(.ant-card-body) {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding: 0;
}

.erp-fixed-asset-report__table-card :deep(.ant-table-wrapper) {
  min-height: 0;
}

.erp-fixed-asset-report__pager {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-top: 1px solid hsl(var(--border));
  color: #64748b;
  font-size: 13px;
}

@media (max-width: 1280px) {
  .erp-fixed-asset-report__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .erp-fixed-asset-report__metrics {
    grid-template-columns: minmax(0, 1fr);
  }

  .erp-fixed-asset-report__pager {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
