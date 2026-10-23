<script setup lang="ts">
import type { ErpBusinessReportStatusApi } from '#/api/erp/report/business-status';

import { computed, onMounted, ref } from 'vue';

import { getBusinessReportStatus } from '#/api/erp/report/business-status';

import BusinessReportPreviewTemplate from './business-report-preview-template.vue';

defineOptions({ name: 'ErpBusinessReportStatusBoard' });

interface ReportModuleCard {
  code: string;
  highlights: string[];
  name: string;
  reports: string;
  stage: string;
}

const status = ref<ErpBusinessReportStatusApi.Status>();

const fallbackModules: ReportModuleCard[] = [
  {
    code: '01',
    highlights: ['销售出库与退货', '客户经营分析', '订单履约跟踪'],
    name: '销售及客户经营',
    reports: '报表 1、2、3、34、35、36',
    stage: '页面已规划',
  },
  {
    code: '02',
    highlights: ['采购入库与退货', '供应商汇总', '价格波动与质量绩效'],
    name: '采购及供应商经营',
    reports: '报表 4、5、6、7、37、38',
    stage: '页面已规划',
  },
  {
    code: '03',
    highlights: ['实时库存', '收发存与流水', '库龄、批次和追溯'],
    name: '库存及商品追溯',
    reports: '报表 8、9、10、11、12、39、40',
    stage: '页面已规划',
  },
  {
    code: '04',
    highlights: ['调拨发出与收货', '在途数量', '内部调拨利润'],
    name: '调拨、移仓及在途',
    reports: '报表 13、14、15',
    stage: '页面已规划',
  },
  {
    code: '05',
    highlights: ['客户应收', '供应商应付', '其他应收应付与账龄'],
    name: '往来、资金及其他应收应付',
    reports: '报表 16、17、18、19、20、21、42、46、47',
    stage: '页面已规划',
  },
  {
    code: '06',
    highlights: ['费用支出', '分摊预算', '发票凭证、财务报表和固定资产'],
    name: '费用、财务及资产',
    reports: '报表 22、23、24、25、41、43、44',
    stage: '页面已规划',
  },
  {
    code: '07',
    highlights: ['部门利润', '公司内部抵销', '经营驾驶舱'],
    name: '利润分析及经营驾驶舱',
    reports: '报表 26、27、28',
    stage: '页面已规划',
  },
  {
    code: '08',
    highlights: ['异常预警', '审计日志', '业务链路追踪和岗位绩效'],
    name: '异常、审计、追踪及绩效',
    reports: '报表 29、30、31、32、33、45',
    stage: '页面已规划',
  },
];

const summaryItems = [
  { label: '覆盖报表', value: '47 项' },
  { label: '业务模块', value: '8 类' },
  { label: '统一入口', value: '经营报表' },
  { label: '展示优先级', value: '页面先行' },
];

const foundationItems = [
  '统一查询区、统计卡片、明细表、合计栏和导出入口',
  '所有报表统一放在“经营报表”模块，不拆到原业务菜单',
  '支持按业务模块分阶段接入真实数据、下钻和权限控制',
  '毛利率、评分、分摊、折旧和财务公式在确认后再作为正式指标展示',
];

const modules = computed(() => {
  const remoteModules = status.value?.modules ?? [];
  if (remoteModules.length === 0) {
    return fallbackModules;
  }
  return fallbackModules.map((module) => {
    const remote = remoteModules.find((item) => item.code === module.code);
    return remote?.status
      ? {
          ...module,
          stage: normalizeStage(remote.status),
        }
      : module;
  });
});

function normalizeStage(stage: string) {
  if (/已接入|READONLY|AVAILABLE|READY/i.test(stage)) {
    return '已可预览';
  }
  if (/PARTIAL|第一阶段|待完善|准备/i.test(stage)) {
    return '分阶段接入中';
  }
  return '页面已规划';
}

async function loadStatus() {
  try {
    status.value = await getBusinessReportStatus();
  } catch {
    status.value = undefined;
  }
}

onMounted(loadStatus);
</script>

<template>
  <section class="erp-business-report-home">
    <div class="erp-business-report-home__hero">
      <div>
        <span class="erp-business-report-home__eyebrow">经营报表总览</span>
        <h2>汽配 ERP 经营分析报表</h2>
        <p>
          围绕销售、采购、库存、调拨、往来资金、费用财务、利润驾驶舱和异常追踪建立统一报表入口。
          当前先完成客户可预览页面，后续按模块接入真实数据、计算规则、权限、导出和下钻。
        </p>
      </div>
      <div class="erp-business-report-home__summary">
        <article v-for="item in summaryItems" :key="item.label">
          <strong>{{ item.value }}</strong>
          <span>{{ item.label }}</span>
        </article>
      </div>
    </div>

    <div class="erp-business-report-home__foundation">
      <div>
        <strong>公共报表能力</strong>
        <p>
          第一个模块先搭好统一页面基础，让客户看到整体结构和后续每类报表的呈现方式。
        </p>
      </div>
      <ul>
        <li v-for="item in foundationItems" :key="item">{{ item }}</li>
      </ul>
    </div>

    <BusinessReportPreviewTemplate />

    <div class="erp-business-report-home__modules">
      <article v-for="module in modules" :key="module.code">
        <div class="erp-business-report-home__module-head">
          <span>{{ module.code }}</span>
          <em>{{ module.stage }}</em>
        </div>
        <h3>{{ module.name }}</h3>
        <p>{{ module.reports }}</p>
        <ul>
          <li v-for="highlight in module.highlights" :key="highlight">
            {{ highlight }}
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>

<style scoped>
.erp-business-report-home {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  margin-bottom: 8px;
  background:
    linear-gradient(135deg, rgba(22, 93, 255, 0.08), rgba(45, 212, 191, 0.07)),
    #fff;
  border: 1px solid #dce6f5;
  border-radius: 12px;
}

.erp-business-report-home__hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 0.55fr);
  gap: 18px;
  align-items: stretch;
}

.erp-business-report-home__eyebrow {
  display: inline-flex;
  padding: 3px 10px;
  color: #1d4ed8;
  background: #eaf2ff;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.erp-business-report-home h2 {
  margin: 10px 0 8px;
  color: #173461;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.25;
}

.erp-business-report-home p {
  margin: 0;
  color: #56657a;
  font-size: 13px;
  line-height: 1.8;
}

.erp-business-report-home__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.erp-business-report-home__summary article {
  padding: 14px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid #dfe8f6;
  border-radius: 10px;
}

.erp-business-report-home__summary strong {
  display: block;
  color: #155bd4;
  font-size: 24px;
  line-height: 1.2;
}

.erp-business-report-home__summary span {
  display: block;
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
}

.erp-business-report-home__foundation {
  display: grid;
  grid-template-columns: minmax(220px, 0.28fr) minmax(0, 1fr);
  gap: 14px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid #dfe8f6;
  border-radius: 10px;
}

.erp-business-report-home__foundation strong {
  display: block;
  margin-bottom: 6px;
  color: #173461;
  font-size: 15px;
}

.erp-business-report-home__foundation ul,
.erp-business-report-home__modules ul {
  padding: 0;
  margin: 0;
  list-style: none;
}

.erp-business-report-home__foundation ul {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.erp-business-report-home__foundation li,
.erp-business-report-home__modules li {
  position: relative;
  padding-left: 16px;
  color: #475569;
  font-size: 12px;
  line-height: 1.65;
}

.erp-business-report-home__foundation li::before,
.erp-business-report-home__modules li::before {
  position: absolute;
  top: 0.75em;
  left: 0;
  width: 6px;
  height: 6px;
  background: #2f7cf6;
  border-radius: 999px;
  content: '';
  transform: translateY(-50%);
}

.erp-business-report-home__modules {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}

.erp-business-report-home__modules article {
  min-width: 0;
  padding: 14px;
  background: #fff;
  border: 1px solid #e4eaf2;
  border-radius: 10px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
}

.erp-business-report-home__module-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.erp-business-report-home__module-head span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: #fff;
  background: linear-gradient(135deg, #2563eb, #14b8a6);
  border-radius: 10px;
  font-weight: 700;
}

.erp-business-report-home__module-head em {
  padding: 2px 9px;
  color: #0f766e;
  background: #ecfdf5;
  border: 1px solid #b7ead8;
  border-radius: 999px;
  font-size: 12px;
  font-style: normal;
}

.erp-business-report-home__modules h3 {
  margin: 12px 0 4px;
  color: #1f2f46;
  font-size: 16px;
  font-weight: 700;
}

.erp-business-report-home__modules p {
  margin-bottom: 10px;
  color: #64748b;
  font-size: 12px;
}

@media (max-width: 1280px) {
  .erp-business-report-home__hero,
  .erp-business-report-home__foundation {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .erp-business-report-home {
    padding: 12px;
  }

  .erp-business-report-home__summary,
  .erp-business-report-home__foundation ul {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
