<script setup lang="ts">
import BusinessReportEmptyState from './business-report-empty-state.vue';

interface PreviewAction {
  disabled?: boolean;
  text: string;
  type?: 'default' | 'primary';
}

interface PreviewChart {
  caption: string;
  title: string;
  values: number[];
}

interface PreviewColumn {
  key: string;
  title: string;
  width?: string;
}

interface PreviewFilter {
  label: string;
  value: string;
}

interface PreviewMetric {
  label: string;
  note?: string;
  tone?: 'blue' | 'green' | 'orange' | 'purple';
  value: string;
}

interface PreviewPendingRule {
  name: string;
  reason: string;
}

interface PreviewRow {
  cells: Record<string, string>;
  key: string;
}

withDefaults(
  defineProps<{
    actions?: PreviewAction[];
    charts?: PreviewChart[];
    columns?: PreviewColumn[];
    filters?: PreviewFilter[];
    metrics?: PreviewMetric[];
    pendingRules?: PreviewPendingRule[];
    rows?: PreviewRow[];
    subtitle?: string;
    title?: string;
  }>(),
  {
    actions: () => [
      { text: '重置', type: 'default' },
      { text: '查询', type: 'primary' },
      { disabled: true, text: '导出', type: 'default' },
    ],
    charts: () => [
      {
        caption: '按过账日期统计，后续接真实接口',
        title: '经营趋势',
        values: [42, 58, 49, 72, 66, 81, 76],
      },
      {
        caption: '支持客户、商品、部门、仓库等排行',
        title: '结构排行',
        values: [88, 72, 64, 51, 39],
      },
    ],
    columns: () => [
      { key: 'bizDate', title: '业务日期', width: '120px' },
      { key: 'bizType', title: '业务类型', width: '120px' },
      { key: 'bizNo', title: '单据编号', width: '160px' },
      { key: 'party', title: '往来单位', width: '140px' },
      { key: 'product', title: '商品/项目', width: '180px' },
      { key: 'qty', title: '数量', width: '90px' },
      { key: 'amount', title: '金额', width: '120px' },
      { key: 'status', title: '口径状态', width: '130px' },
    ],
    filters: () => [
      { label: '日期类型', value: '过账日期' },
      { label: '统计期间', value: '本月' },
      { label: '部门', value: '全部可见部门' },
      { label: '业务对象', value: '客户/供应商/仓库' },
      { label: '商品维度', value: '编码/OE/品牌/品类' },
    ],
    metrics: () => [
      { label: '销售净额', note: '示例结构', tone: 'blue', value: '—' },
      { label: '销售成本', note: '等待成本快照', tone: 'orange', value: '—' },
      {
        label: '毛利率',
        note: '公式确认后启用',
        tone: 'purple',
        value: '待确认',
      },
      {
        label: '回款率',
        note: '核销口径接入后启用',
        tone: 'green',
        value: '待确认',
      },
    ],
    pendingRules: () => [
      { name: '毛利率', reason: '销售价暂按含税，税率和不含税口径需客户确认' },
      { name: '评分', reason: '供应商/客户评分规则需配置版本确认后启用' },
      { name: '分摊', reason: '费用分摊需保存规则版本、基数快照和尾差处理' },
      {
        name: '折旧/财务公式',
        reason: '资产折旧参数和三大报表公式确认前不输出正式值',
      },
    ],
    rows: () => [
      {
        key: 'demo-1',
        cells: {
          amount: '12,800.00',
          bizDate: '2026-09-22',
          bizNo: 'XSCK202609220001',
          bizType: '销售出库',
          party: '客户示例',
          product: '滤清器 A / OE-001',
          qty: '16',
          status: '真实接口接入后展示',
        },
      },
      {
        key: 'demo-2',
        cells: {
          amount: '8,420.00',
          bizDate: '2026-09-22',
          bizNo: 'CGRK202609220003',
          bizType: '采购入库',
          party: '供应商示例',
          product: '刹车片 B / OE-018',
          qty: '20',
          status: '复用分页接口',
        },
      },
      {
        key: 'demo-3',
        cells: {
          amount: '待确认',
          bizDate: '2026-09-22',
          bizNo: 'DBCK202609220002',
          bizType: '调拨出库',
          party: 'A 部门 → B 部门',
          product: '火花塞 C / OE-128',
          qty: '12',
          status: '双成本关闭',
        },
      },
    ],
    subtitle:
      '后续各业务模块按同一结构呈现，先展示页面效果，再逐步接入真实数据、权限、导出和下钻。',
    title: '统一报表页面模板',
  },
);
</script>

<template>
  <section class="erp-business-report-preview">
    <div class="erp-business-report-preview__head">
      <div>
        <strong>{{ title }}</strong>
        <p>{{ subtitle }}</p>
      </div>
      <div class="erp-business-report-preview__actions">
        <button
          v-for="action in actions"
          :key="action.text"
          class="erp-business-report-preview__button"
          :class="
            action.type === 'primary' &&
            'erp-business-report-preview__button--primary'
          "
          :disabled="action.disabled"
          type="button"
        >
          {{ action.text }}
        </button>
      </div>
    </div>

    <div class="erp-business-report-preview__filters" aria-label="统一筛选区">
      <span v-for="filter in filters" :key="filter.label">
        <em>{{ filter.label }}</em>
        {{ filter.value }}
      </span>
    </div>

    <div class="erp-business-report-preview__metrics">
      <article
        v-for="metric in metrics"
        :key="metric.label"
        class="erp-business-report-preview__metric"
        :class="
          metric.tone && `erp-business-report-preview__metric--${metric.tone}`
        "
      >
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
        <small v-if="metric.note">{{ metric.note }}</small>
      </article>
    </div>

    <div class="erp-business-report-preview__main">
      <article
        v-for="chart in charts"
        :key="chart.title"
        class="erp-business-report-preview__chart"
      >
        <div>
          <strong>{{ chart.title }}</strong>
          <span>{{ chart.caption }}</span>
        </div>
        <div class="erp-business-report-preview__bars">
          <i
            v-for="(value, index) in chart.values"
            :key="`${chart.title}-${index}`"
            :style="{ height: `${value}%` }"
          ></i>
        </div>
      </article>
      <article class="erp-business-report-preview__pending">
        <strong>待确认公式与规则</strong>
        <ul>
          <li v-for="rule in pendingRules" :key="rule.name">
            <span>{{ rule.name }}</span>
            <p>{{ rule.reason }}</p>
          </li>
        </ul>
      </article>
    </div>

    <BusinessReportEmptyState
      v-if="rows.length === 0"
      description="筛选条件下没有数据时，统一提示暂无数据；无权限、接口待接入和公式待确认也使用同一空状态组件说明原因。"
      title="暂无报表明细"
    />

    <div v-else class="erp-business-report-preview__table-wrap">
      <table class="erp-business-report-preview__table">
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              :style="{ width: column.width }"
            >
              {{ column.title }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key">
            <td v-for="column in columns" :key="column.key">
              {{ row.cells[column.key] ?? '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="erp-business-report-preview__footer">
      <span>本页合计：按当前分页展示</span>
      <span>全部合计：接入聚合接口后展示</span>
      <span>下钻：保留业务类型、单据 ID、明细 ID 和来源关系</span>
    </div>
  </section>
</template>

<style scoped>
.erp-business-report-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  background: #fff;
  border: 1px solid #e4eaf2;
  border-radius: 12px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
}

.erp-business-report-preview__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.erp-business-report-preview__head strong,
.erp-business-report-preview__pending > strong,
.erp-business-report-preview__chart strong {
  color: #173461;
  font-size: 16px;
}

.erp-business-report-preview__head p {
  margin: 5px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
}

.erp-business-report-preview__actions,
.erp-business-report-preview__filters,
.erp-business-report-preview__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.erp-business-report-preview__button {
  height: 30px;
  padding: 0 14px;
  color: #33506f;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 13px;
}

.erp-business-report-preview__button--primary {
  color: #fff;
  background: #2563eb;
  border-color: #2563eb;
}

.erp-business-report-preview__button:disabled {
  color: #94a3b8;
  background: #f8fafc;
  cursor: not-allowed;
}

.erp-business-report-preview__filters span,
.erp-business-report-preview__footer span {
  padding: 7px 10px;
  color: #475569;
  background: #f8fbff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 12px;
}

.erp-business-report-preview__filters em {
  margin-right: 6px;
  color: #64748b;
  font-style: normal;
}

.erp-business-report-preview__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.erp-business-report-preview__metric {
  padding: 12px;
  background: #f8fbff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.erp-business-report-preview__metric span,
.erp-business-report-preview__metric small,
.erp-business-report-preview__chart span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.erp-business-report-preview__metric strong {
  display: block;
  margin: 8px 0 4px;
  color: #1d4ed8;
  font-size: 22px;
  line-height: 1.2;
}

.erp-business-report-preview__metric--green strong {
  color: #0f766e;
}

.erp-business-report-preview__metric--orange strong {
  color: #d97706;
}

.erp-business-report-preview__metric--purple strong {
  color: #7c3aed;
}

.erp-business-report-preview__main {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)) minmax(260px, 0.75fr);
  gap: 12px;
}

.erp-business-report-preview__chart,
.erp-business-report-preview__pending {
  min-width: 0;
  padding: 12px;
  background: #fbfdff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.erp-business-report-preview__bars {
  display: flex;
  align-items: end;
  height: 120px;
  gap: 8px;
  margin-top: 12px;
  padding: 12px 10px 0;
  background: linear-gradient(180deg, #f8fafc, #fff);
  border-radius: 8px;
}

.erp-business-report-preview__bars i {
  flex: 1 1 0;
  min-height: 18px;
  background: linear-gradient(180deg, #60a5fa, #2563eb);
  border-radius: 8px 8px 0 0;
}

.erp-business-report-preview__pending ul {
  padding: 0;
  margin: 10px 0 0;
  list-style: none;
}

.erp-business-report-preview__pending li + li {
  margin-top: 8px;
}

.erp-business-report-preview__pending span {
  color: #7c3aed;
  font-size: 13px;
  font-weight: 600;
}

.erp-business-report-preview__pending p {
  margin: 3px 0 0;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}

.erp-business-report-preview__table-wrap {
  overflow: auto;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
}

.erp-business-report-preview__table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  font-size: 12px;
}

.erp-business-report-preview__table th,
.erp-business-report-preview__table td {
  padding: 10px;
  color: #475569;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}

.erp-business-report-preview__table th {
  color: #1d4ed8;
  background: #f8fafc;
  font-weight: 600;
}

.erp-business-report-preview__table tbody tr:last-child td {
  border-bottom: 0;
}

.erp-business-report-preview__footer span {
  background: #fff7ed;
  border-color: #fed7aa;
}

@media (max-width: 1280px) {
  .erp-business-report-preview__metrics,
  .erp-business-report-preview__main {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .erp-business-report-preview__head {
    flex-direction: column;
  }

  .erp-business-report-preview__metrics,
  .erp-business-report-preview__main {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
