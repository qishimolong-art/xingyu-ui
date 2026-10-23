import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');

describe('system report cockpit UI contract', () => {
  it('uses the unified business report shell and keeps a full-height content chain', () => {
    expect(indexSource).toContain('BusinessReportShell');
    expect(indexSource).toContain('经营报表 · 部门利润、公司抵销及驾驶舱');
    expect(indexSource).not.toContain('<Page');
    expect(indexSource).toMatch(
      /<BusinessReportShell[\s\S]*class="system-report-page"/,
    );
    expect(indexSource).toMatch(
      /\.system-report-page\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?flex-direction:\s*column;[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*auto;[\s\S]*?\}/,
    );
  });

  it('states the business cockpit calculation boundaries clearly', () => {
    expect(indexSource).toContain(
      '经营驾驶舱当前用于第一阶段展示和筛选联调，尚未形成正式经营指标。',
    );
    expect(indexSource).toContain(
      '部门利润需要汇集外销毛利、本级调拨利润、直接费用、分摊费用',
    );
    expect(indexSource).toContain('公司利润需要按对外收入与财务成本计算');
    expect(indexSource).toContain(
      '内部收入成本抵销、未实现利润抵销和已实现利润调整',
    );
    expect(indexSource).toContain('毛利额/毛利率口径待确认');
    expect(indexSource).toContain(
      '当前排行榜只按系统分析接口字段或静态占位排序，不作为正式部门利润排行、公司利润排行或目标评分排行',
    );
    expect(indexSource).toContain(
      '部门利润、公司抵销、排行榜、目标评分等正式公式和配置版本未确认前，不应作为正式经营驾驶舱',
    );
    expect(indexSource).toContain('未配置正式指标时必须显示不可用原因');
    expect(indexSource).toContain('本页暂以边界说明代替正式不可用原因服务');
    expect(indexSource).toContain('cockpitReadiness');
    expect(indexSource).toContain('采购、销售、库存看板优先使用系统分析接口');
    expect(indexSource).toContain('只读线索来源');
    expect(indexSource).toContain(
      '资金、往来、费用、发票凭证、固定资产边界和异常审计已接入第一阶段只读页签',
    );
    expect(indexSource).toContain('暂不汇入正式利润、评分或排行榜');
    expect(indexSource).toContain(
      'grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));',
    );
    expect(indexSource).toContain('接口数据标记为“接口数据（非正式驾驶舱）”');
    expect(indexSource).toContain('接口未加载成功时标记为“静态占位（演示）”');
    expect(indexSource).toContain(
      "runtimeData[activeReport].loaded ? '接口数据（非正式驾驶舱）' : '静态占位（演示）'",
    );
    expect(indexSource).toContain(
      '毛利额/毛利率口径待确认，客户流失、回款率、排行等公式及配置版本未确认前，不作为正式经营指标。',
    );
    expect(indexSource).toContain(
      "{ label: '毛利额', value: '待配置', meta: '毛利率口径待确认', tone: 'warn' }",
    );
    expect(indexSource).toContain(
      '毛利额、财务成本、部门结算成本和退货冲回口径需确认配置版本后启用。',
    );
    expect(indexSource).not.toContain(
      '毛利 28.1 万 / 销售净额 272.8 万 = 10.3%',
    );
    expect(indexSource).toContain(
      '呆滞、周转和库存成本口径待确认，接口数据仍为非正式驾驶舱参考。',
    );
    expect(indexSource).toContain(
      '毛利额/毛利率、排行榜、部门利润、公司抵销和目标评分等公式及配置版本未确认前，不应作为正式经营驾驶舱。',
    );
    expect(indexSource).toContain(
      '导出当前系统分析接口返回数据；不得作为正式利润表、部门利润表、公司抵销表或绩效评分依据',
    );
    expect(indexSource).toContain('getSystemReportSummary');
    expect(indexSource).toContain('getSystemReportTrend');
    expect(indexSource).toContain('getSystemReportRank');
    expect(indexSource).toContain('getSystemReportPage');
    expect(indexSource).toContain('catch (error)');
    expect(indexSource).toContain('data.loaded ? data.rank.map');
    expect(indexSource).toContain('data.loaded ? data.trend.map');
    expect(indexSource).toContain('if (data.loaded)');
    expect(indexSource).not.toContain('真实数据');
    expect(indexSource).toContain(
      "import { Alert, Button, DatePicker, Input, message, Modal, Select, TabPane, Tabs } from 'ant-design-vue'",
    );
  });
});
