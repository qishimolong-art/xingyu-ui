import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { normalizeOtherIncomeListRow } from '../../finance/receivable/other-income/ui';

const currentDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const apiSource = readFileSync(
  join(
    currentDir,
    '..',
    '..',
    '..',
    '..',
    'api',
    'erp',
    'report',
    'other-income',
    'index.ts',
  ),
  'utf8',
);

describe('其他收入查询报表', () => {
  it('按确认顺序展示 14 列且类型固定为空', () => {
    const columns = [
      '审核日期',
      '结算账户',
      '单号',
      '费用项目名称',
      '金额',
      '凭证号',
      '摘要',
      '类型',
      '开单部门',
      '项目隶属部门',
      '经办人',
      '对象',
      '发票',
      '发生日期',
    ];
    let previous = -1;
    for (const column of columns) {
      const current = pageSource.indexOf(`title: '${column}'`);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
    expect(pageSource.match(/formatter: emptyFormatter/g)).toHaveLength(1);
    expect(pageSource).not.toContain("field: 'incomeType'");
    expect(pageSource).not.toContain("field: 'docType'");
  });

  it('默认本月审核日期并提供发生日期和分页懒加载筛选', () => {
    expect(pageSource).toContain("dayjs().startOf('month')");
    expect(pageSource).toContain("dayjs().format('YYYY-MM-DD HH:mm:ss')");
    expect(pageSource).toContain("fieldName: 'occurrenceDate'");
    expect(pageSource).toContain("component: 'ErpLazyPageSelect'");
    expect(pageSource).toContain('getAccountSimplePage');
    expect(pageSource).toContain('getOtherIncomeDeptSimplePage');
    expect(pageSource).toContain('getOtherIncomeUserSimplePage');
    expect(pageSource).toContain(
      'pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] }',
    );
  });

  it('使用服务端分页汇总远程排序和完整导出权限链', () => {
    expect(pageSource).toContain('getOtherIncomeReportPage');
    expect(pageSource).toContain('getOtherIncomeReportSummary');
    expect(pageSource).toContain('sortFieldMap');
    expect(pageSource).toContain('remote: true');
    expect(pageSource).toContain('全条件合计');
    expect(pageSource).toContain('erp:other-income-report:export');
    expect(pageSource).toContain('erp:receivable-other-income:query');
    expect(pageSource).toContain('erp:receivable-other-income:export');
    expect(apiSource).toContain('/erp/other-income-report/page');
    expect(apiSource).toContain('/erp/other-income-report/summary');
    expect(apiSource).toContain('/erp/other-income-report/export-excel');
  });

  it('原其他收入列表优先显示固化审核时间并兼容历史更新时间', () => {
    expect(
      normalizeOtherIncomeListRow({
        status: 20,
        approveTime: '2026-10-14 09:00:00',
        updateTime: '2026-10-15 10:00:00',
      }).auditTime,
    ).toBe('2026-10-14 09:00:00');
    expect(
      normalizeOtherIncomeListRow({
        status: 20,
        updateTime: '2026-10-13 08:00:00',
      }).auditTime,
    ).toBe('2026-10-13 08:00:00');
  });

  it('单号按原查询权限打开其他收入只读详情', () => {
    expect(apiSource).toContain('incomeId: number');
    expect(pageSource).toContain("slots: { default: 'documentNo' }");
    expect(pageSource).toContain('REPORT_DOCUMENT_TYPES.OTHER_INCOME');
    expect(pageSource).toContain('row.incomeId');
    expect(pageSource).toContain('ReportDocumentDetailModal');
    expect(pageSource).toContain('@click.stop');
    expect(pageSource).toContain('type="button"');
  });
});
