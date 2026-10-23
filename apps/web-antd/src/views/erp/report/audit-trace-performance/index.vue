<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';
import type { Dayjs } from 'dayjs';

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
import StockRecordTab from '#/views/erp/stock/record/modules/stock-record-tab.vue';

import ImportExportAuditTable from './modules/import-export-audit-readonly-table.vue';
import OperateLogAuditTable from './modules/operate-log-readonly-table.vue';
import PurchaseInvoiceOcrAuditTable from './modules/purchase-invoice-ocr-readonly-table.vue';

defineOptions({ name: 'ErpBusinessReportAuditTracePerformance' });

const { RangePicker } = DatePicker;
const DEFAULT_PAGE_SIZE = 10;

type PageKey =
  | 'business-chain'
  | 'exception-todo'
  | 'history'
  | 'open-loop'
  | 'operation-audit'
  | 'performance-score'
  | 'reverse-trace';

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
  objectPlaceholder: string;
  statusItems: Array<{
    label: string;
    status: string;
    tone: 'blue' | 'gold' | 'green' | 'orange';
  }>;
  title: string;
};

const route = useRoute();

const query = reactive({
  dateRange: undefined as [Dayjs, Dayjs] | undefined,
  keyword: '',
  objectName: '',
  status: undefined as string | undefined,
});

const state = reactive({
  exportLoading: false,
  pageNo: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  total: 0,
});

const pageConfigs: Record<PageKey, PageConfig> = {
  'reverse-trace': {
    title: '原单与反向业务追踪',
    objectPlaceholder: '客户/供应商/部门/经办人',
    metrics: [
      {
        label: '关联业务数',
        value: '—',
        note: '按原单和反向单统计',
        tone: 'blue',
      },
      {
        label: '累计冲销数量',
        value: '—',
        note: '按来源明细汇总',
        tone: 'green',
      },
      {
        label: '剩余可冲销',
        value: '—',
        note: '规则确认后展示',
        tone: 'orange',
      },
      {
        label: '无单业务',
        value: '待规则确认',
        note: '独立审批口径确认后展示',
        tone: 'purple',
      },
    ],
    statusItems: [
      { label: '原单关联', status: '待规则确认', tone: 'gold' },
      { label: '反向关系', status: '待规则确认', tone: 'gold' },
      { label: '无单审批', status: '待规则确认', tone: 'orange' },
    ],
    columns: [
      { title: '业务类型', dataIndex: 'bizType', width: 130 },
      { title: '原单编号', dataIndex: 'sourceNo', width: 170 },
      { title: '反向单编号', dataIndex: 'reverseNo', width: 170 },
      { title: '业务对象', dataIndex: 'businessObject', width: 160 },
      { title: '发生日期', dataIndex: 'bizDate', width: 150 },
      { title: '原数量', dataIndex: 'sourceQty', width: 110, align: 'right' },
      {
        title: '已冲销数量',
        dataIndex: 'offsetQty',
        width: 120,
        align: 'right',
      },
      { title: '剩余数量', dataIndex: 'remainQty', width: 110, align: 'right' },
      { title: '金额', dataIndex: 'amount', width: 120, align: 'right' },
      { title: '状态', dataIndex: 'status', width: 120 },
      { title: '责任归属', dataIndex: 'responsibility', width: 140 },
    ],
    emptyTitle: '暂无原单与反向业务追踪数据',
    emptyDescription:
      '建立来源明细和反向单关系后，可查看原单、退货、冲销和调整的剩余数量金额。',
  },
  'business-chain': {
    title: '业务链路追踪',
    objectPlaceholder: '单号/客户/供应商/商品/仓库',
    metrics: [
      { label: '链路单据数', value: '—', note: '按业务链统计', tone: 'blue' },
      {
        label: '库存节点',
        value: '—',
        note: '出入库与调拨节点',
        tone: 'green',
      },
      {
        label: '往来资金节点',
        value: '—',
        note: '核销和收付确认后展示',
        tone: 'orange',
      },
      {
        label: '核算影响',
        value: '待规则确认',
        note: '核算关系确认后展示',
        tone: 'purple',
      },
    ],
    statusItems: [
      { label: '多来源关系', status: '待规则确认', tone: 'gold' },
      { label: '链路下钻', status: '待规则确认', tone: 'gold' },
      { label: '金额权限', status: '按权限控制', tone: 'blue' },
    ],
    columns: [
      { title: '链路编号', dataIndex: 'chainNo', width: 170 },
      { title: '当前节点', dataIndex: 'nodeName', width: 140 },
      { title: '业务类型', dataIndex: 'bizType', width: 130 },
      { title: '单据编号', dataIndex: 'docNo', width: 170 },
      { title: '来源单号', dataIndex: 'sourceNo', width: 170 },
      { title: '业务对象', dataIndex: 'businessObject', width: 160 },
      { title: '部门', dataIndex: 'deptName', width: 140 },
      { title: '仓库/账户', dataIndex: 'storageName', width: 150 },
      { title: '发生日期', dataIndex: 'bizDate', width: 150 },
      { title: '节点状态', dataIndex: 'status', width: 120 },
      { title: '处理人', dataIndex: 'operator', width: 120 },
    ],
    emptyTitle: '暂无业务链路追踪数据',
    emptyDescription:
      '来源关系补齐后，可从任意节点追查库存、往来、资金和核算影响。',
  },
  'open-loop': {
    title: '未闭环业务清单',
    objectPlaceholder: '单号/客户/供应商/责任人',
    metrics: [
      { label: '未闭环业务', value: '—', note: '按必需节点统计', tone: 'blue' },
      { label: '超期业务', value: '—', note: '按约定时限统计', tone: 'orange' },
      { label: '待复核', value: '—', note: '处理后等待复核', tone: 'green' },
      {
        label: '闭环规则',
        value: '待规则确认',
        note: '按业务场景配置',
        tone: 'purple',
      },
    ],
    statusItems: [
      { label: '未收货', status: '待规则确认', tone: 'gold' },
      { label: '未到账', status: '待规则确认', tone: 'gold' },
      { label: '未核销', status: '待规则确认', tone: 'gold' },
      { label: '未退款', status: '待规则确认', tone: 'gold' },
    ],
    columns: [
      { title: '业务场景', dataIndex: 'sceneName', width: 150 },
      { title: '单据编号', dataIndex: 'docNo', width: 170 },
      { title: '业务对象', dataIndex: 'businessObject', width: 160 },
      { title: '责任部门', dataIndex: 'responsibleDept', width: 140 },
      { title: '责任人', dataIndex: 'responsibleUser', width: 120 },
      { title: '缺失节点', dataIndex: 'missingNode', width: 140 },
      { title: '发生日期', dataIndex: 'bizDate', width: 150 },
      { title: '约定完成日', dataIndex: 'dueDate', width: 130 },
      {
        title: '超期天数',
        dataIndex: 'overdueDays',
        width: 110,
        align: 'right',
      },
      { title: '处理状态', dataIndex: 'status', width: 120 },
    ],
    emptyTitle: '暂无未闭环业务数据',
    emptyDescription:
      '配置业务必需节点后，可识别未收货、未到账、未核销、未退款和待复核业务。',
  },
  'exception-todo': {
    title: '异常规则与待办',
    objectPlaceholder: '规则/单号/责任人/部门',
    metrics: [
      { label: '异常规则', value: '—', note: '按有效规则统计', tone: 'blue' },
      { label: '待处理异常', value: '—', note: '按责任人统计', tone: 'orange' },
      {
        label: '已处理待复核',
        value: '—',
        note: '复核流程确认后展示',
        tone: 'green',
      },
      {
        label: '重复拦截',
        value: '待规则确认',
        note: '按去重规则展示',
        tone: 'purple',
      },
    ],
    statusItems: [
      { label: '风险等级', status: '待规则确认', tone: 'gold' },
      { label: '处理时限', status: '待规则确认', tone: 'gold' },
      { label: '复核流程', status: '待规则确认', tone: 'orange' },
    ],
    columns: [
      { title: '异常编号', dataIndex: 'exceptionNo', width: 170 },
      { title: '规则名称', dataIndex: 'ruleName', width: 180 },
      { title: '风险等级', dataIndex: 'riskLevel', width: 110 },
      { title: '关联单据', dataIndex: 'docNo', width: 170 },
      { title: '责任部门', dataIndex: 'responsibleDept', width: 140 },
      { title: '责任人', dataIndex: 'responsibleUser', width: 120 },
      { title: '生成时间', dataIndex: 'createTime', width: 150 },
      { title: '处理时限', dataIndex: 'deadline', width: 130 },
      { title: '处理状态', dataIndex: 'status', width: 120 },
      { title: '复核状态', dataIndex: 'reviewStatus', width: 120 },
    ],
    emptyTitle: '暂无异常规则与待办数据',
    emptyDescription:
      '异常规则生效后，可按风险、责任人、时限、处理和复核状态跟踪待办。',
  },
  'operation-audit': {
    title: '操作日志审计',
    objectPlaceholder: '操作人/模块/单号/IP',
    metrics: [
      { label: '操作记录', value: '—', note: '按筛选条件统计', tone: 'blue' },
      {
        label: '状态变更',
        value: '—',
        note: '业务日志确认后展示',
        tone: 'green',
      },
      { label: '导入导出', value: '—', note: '按记录来源统计', tone: 'orange' },
      {
        label: '规则版本',
        value: '待规则确认',
        note: '规则留痕后展示',
        tone: 'purple',
      },
    ],
    statusItems: [
      { label: '追加留痕', status: '待规则确认', tone: 'gold' },
      { label: '状态变化', status: '待规则确认', tone: 'gold' },
      { label: '敏感操作', status: '待规则确认', tone: 'orange' },
    ],
    columns: [
      { title: '操作时间', dataIndex: 'operateTime', width: 150 },
      { title: '操作人', dataIndex: 'operator', width: 120 },
      { title: '模块', dataIndex: 'moduleName', width: 150 },
      { title: '操作名称', dataIndex: 'operateName', width: 160 },
      { title: '业务单号', dataIndex: 'docNo', width: 170 },
      { title: '变更前', dataIndex: 'beforeValue', width: 180 },
      { title: '变更后', dataIndex: 'afterValue', width: 180 },
      { title: '规则版本', dataIndex: 'ruleVersion', width: 120 },
      { title: 'IP', dataIndex: 'userIp', width: 130 },
      { title: '链路追踪号', dataIndex: 'traceId', width: 180 },
    ],
    emptyTitle: '暂无操作日志审计数据',
    emptyDescription:
      '业务状态变化和规则版本留痕补齐后，可按操作人、模块、单据和时间审计。',
  },
  'performance-score': {
    title: '岗位绩效评分',
    objectPlaceholder: '员工/岗位/部门/规则',
    metrics: [
      { label: '评分对象', value: '—', note: '按岗位和人员统计', tone: 'blue' },
      {
        label: '完成业务',
        value: '—',
        note: '按已完成业务统计',
        tone: 'green',
      },
      {
        label: '反向调整',
        value: '—',
        note: '退货和冲销后调整',
        tone: 'orange',
      },
      {
        label: '绩效得分',
        value: '待规则确认',
        note: '评分公式确认后展示',
        tone: 'purple',
      },
    ],
    statusItems: [
      { label: '销售评分', status: '待规则确认', tone: 'gold' },
      { label: '采购评分', status: '待规则确认', tone: 'gold' },
      { label: '财务评分', status: '待规则确认', tone: 'gold' },
      { label: '仓储扫码绩效', status: '本期不纳入', tone: 'orange' },
    ],
    columns: [
      { title: '期间', dataIndex: 'period', width: 120 },
      { title: '部门', dataIndex: 'deptName', width: 140 },
      { title: '岗位', dataIndex: 'postName', width: 140 },
      { title: '员工', dataIndex: 'userName', width: 120 },
      { title: '业务类型', dataIndex: 'bizType', width: 130 },
      {
        title: '完成数量',
        dataIndex: 'finishCount',
        width: 110,
        align: 'right',
      },
      {
        title: '反向数量',
        dataIndex: 'reverseCount',
        width: 110,
        align: 'right',
      },
      { title: '基础分', dataIndex: 'baseScore', width: 110, align: 'right' },
      { title: '调整分', dataIndex: 'adjustScore', width: 110, align: 'right' },
      {
        title: '最终得分',
        dataIndex: 'finalScore',
        width: 110,
        align: 'right',
      },
      { title: '规则版本', dataIndex: 'ruleVersion', width: 120 },
    ],
    emptyTitle: '暂无岗位绩效评分数据',
    emptyDescription:
      '销售、采购和财务业务评分规则确认后，可按岗位、人员、期间和规则版本查看绩效。',
  },
  history: {
    title: '历史异常审计口径',
    objectPlaceholder: '单号/对象/责任人/说明',
    metrics: [
      { label: '历史记录', value: '—', note: '按切换前口径统计', tone: 'blue' },
      { label: '历史异常', value: '—', note: '按历史规则保留', tone: 'orange' },
      {
        label: '已处理',
        value: '—',
        note: '按历史处理结果展示',
        tone: 'green',
      },
      {
        label: '新旧接续',
        value: '待规则确认',
        note: '切换口径确认后展示',
        tone: 'purple',
      },
    ],
    statusItems: [
      { label: '历史来源', status: '待规则确认', tone: 'gold' },
      { label: '差异保留', status: '待规则确认', tone: 'gold' },
      { label: '接续方式', status: '待规则确认', tone: 'orange' },
    ],
    columns: [
      { title: '历史批次', dataIndex: 'batchNo', width: 160 },
      { title: '业务类型', dataIndex: 'bizType', width: 130 },
      { title: '单据编号', dataIndex: 'docNo', width: 170 },
      { title: '业务对象', dataIndex: 'businessObject', width: 160 },
      { title: '历史状态', dataIndex: 'historyStatus', width: 120 },
      { title: '处理结果', dataIndex: 'handleResult', width: 140 },
      { title: '责任部门', dataIndex: 'responsibleDept', width: 140 },
      { title: '责任人', dataIndex: 'responsibleUser', width: 120 },
      { title: '差异说明', dataIndex: 'differenceRemark', width: 220 },
    ],
    emptyTitle: '暂无历史异常审计口径数据',
    emptyDescription:
      '历史口径核对后，可保留异常来源、处理结果、差异说明和新旧接续依据。',
  },
};

const statusColor = {
  blue: 'blue',
  gold: 'gold',
  green: 'green',
  orange: 'orange',
} as const;

function normalizePageKey(value: unknown): PageKey {
  if (typeof value !== 'string') return 'reverse-trace';
  const parts = value.split('/').filter(Boolean);
  const key = parts[parts.length - 1] as PageKey | undefined;
  return key && key in pageConfigs ? key : 'reverse-trace';
}

const pageKey = computed(() => normalizePageKey(route.path));
const pageConfig = computed(() => pageConfigs[pageKey.value]);
const connectedPageKeys = new Set<PageKey>([
  'business-chain',
  'exception-todo',
  'operation-audit',
]);
const hasConnectedData = computed(() => connectedPageKeys.has(pageKey.value));
const tableRows = computed<ReportRow[]>(() => []);
const tableColumns = computed<TableColumnsType<ReportRow>>(() =>
  pageConfig.value.columns.map((column) => ({
    align: column.align,
    dataIndex: column.dataIndex,
    key: column.dataIndex,
    title: column.title,
    width: column.width,
  })),
);
const tableScrollX = computed(() =>
  Math.max(
    pageConfig.value.columns.reduce((total, column) => total + column.width, 0),
    980,
  ),
);

function escapeCsv(value: unknown) {
  const text = String(value ?? '');
  if (!/[",\n\r]/.test(text)) return text;
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
  query.dateRange = undefined;
  query.keyword = '';
  query.objectName = '';
  query.status = undefined;
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
    :title="`经营报表 · 异常审计及绩效 · ${pageConfig.title}`"
    body-scrollable
  >
    <section class="erp-audit-trace-report">
      <template v-if="hasConnectedData">
        <Card
          v-if="pageKey === 'business-chain'"
          class="erp-audit-trace-report__connected-card"
          size="small"
          title="业务链路库存节点明细"
        >
          <StockRecordTab
            fixed-height
            :page-size="DEFAULT_PAGE_SIZE"
            table-title="业务链路库存节点明细"
          />
        </Card>

        <Card
          v-else-if="pageKey === 'exception-todo'"
          class="erp-audit-trace-report__connected-card"
          size="small"
          title="异常来源批次"
        >
          <PurchaseInvoiceOcrAuditTable />
        </Card>

        <div
          v-else-if="pageKey === 'operation-audit'"
          class="erp-audit-trace-report__operation-grid"
        >
          <Card
            class="erp-audit-trace-report__connected-card"
            size="small"
            title="系统操作日志审计"
          >
            <OperateLogAuditTable />
          </Card>
          <ImportExportAuditTable operation-type="IMPORT" />
          <ImportExportAuditTable operation-type="EXPORT" />
        </div>
      </template>

      <template v-else>
        <Card class="erp-audit-trace-report__filter" size="small">
          <Form layout="inline" :model="query">
            <FormItem label="期间">
              <RangePicker
                v-model:value="query.dateRange"
                class="erp-audit-trace-report__date"
              />
            </FormItem>
            <FormItem label="业务对象">
              <Input
                v-model:value="query.objectName"
                allow-clear
                :placeholder="pageConfig.objectPlaceholder"
              />
            </FormItem>
            <FormItem label="状态">
              <Select
                v-model:value="query.status"
                allow-clear
                class="erp-audit-trace-report__status-select"
                placeholder="请选择状态"
                :options="[
                  { label: '全部', value: '' },
                  { label: '待处理', value: 'pending' },
                  { label: '处理中', value: 'processing' },
                  { label: '已完成', value: 'finished' },
                  { label: '待复核', value: 'reviewing' },
                ]"
              />
            </FormItem>
            <FormItem label="关键词">
              <Input
                v-model:value="query.keyword"
                allow-clear
                placeholder="单号 / 规则 / 人员 / 说明"
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

        <div class="erp-audit-trace-report__metrics">
          <Card
            v-for="metric in pageConfig.metrics"
            :key="metric.label"
            class="erp-audit-trace-report__metric"
            size="small"
          >
            <span>{{ metric.label }}</span>
            <strong
              :class="`erp-audit-trace-report__metric-value--${metric.tone}`"
            >
              {{ metric.value }}
            </strong>
            <em>{{ metric.note }}</em>
          </Card>
        </div>

        <Card class="erp-audit-trace-report__status-card" size="small">
          <div class="erp-audit-trace-report__status-list">
            <span v-for="item in pageConfig.statusItems" :key="item.label">
              {{ item.label }}
              <Tag :color="statusColor[item.tone]">{{ item.status }}</Tag>
            </span>
          </div>
        </Card>

        <Card
          class="erp-audit-trace-report__table-card"
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
                  record.docNo ||
                    record.chainNo ||
                    record.exceptionNo ||
                    record.batchNo ||
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
          <div class="erp-audit-trace-report__pager">
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
      </template>
    </section>
  </BusinessReportShell>
</template>

<style scoped>
.erp-audit-trace-report {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 12px;
}

.erp-audit-trace-report__filter {
  flex: 0 0 auto;
}

.erp-audit-trace-report__date {
  width: 240px;
}

.erp-audit-trace-report__status-select {
  width: 140px;
}

.erp-audit-trace-report__connected-card {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
}

.erp-audit-trace-report__connected-card :deep(.ant-card-body) {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
}

.erp-audit-trace-report__operation-grid {
  display: grid;
  flex: 1 1 auto;
  min-height: 0;
  grid-template-rows: minmax(480px, 1.1fr) minmax(380px, 0.9fr) minmax(
      380px,
      0.9fr
    );
  gap: 12px;
}

.erp-audit-trace-report__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.erp-audit-trace-report__metric :deep(.ant-card-body) {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.erp-audit-trace-report__metric span {
  color: #64748b;
  font-size: 13px;
}

.erp-audit-trace-report__metric strong {
  font-size: 24px;
  line-height: 1.2;
}

.erp-audit-trace-report__metric em {
  color: #94a3b8;
  font-size: 12px;
  font-style: normal;
}

.erp-audit-trace-report__metric-value--blue {
  color: #2563eb;
}

.erp-audit-trace-report__metric-value--green {
  color: #16a34a;
}

.erp-audit-trace-report__metric-value--orange {
  color: #f59e0b;
}

.erp-audit-trace-report__metric-value--purple {
  color: #7c3aed;
}

.erp-audit-trace-report__status-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  color: #475569;
  font-size: 13px;
}

.erp-audit-trace-report__status-list span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.erp-audit-trace-report__table-card {
  flex: 1 1 auto;
  min-height: 0;
}

.erp-audit-trace-report__table-card :deep(.ant-card-body) {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding: 0;
}

.erp-audit-trace-report__table-card :deep(.ant-table-wrapper) {
  min-height: 0;
}

.erp-audit-trace-report__pager {
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
  .erp-audit-trace-report__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .erp-audit-trace-report__metrics {
    grid-template-columns: minmax(0, 1fr);
  }

  .erp-audit-trace-report__pager {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
