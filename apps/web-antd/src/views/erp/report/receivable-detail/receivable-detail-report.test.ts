import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

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
    'receivable-detail',
    'index.ts',
  ),
  'utf8',
);

describe('应收账明细查询报表', () => {
  it('按确认顺序展示 22 列且没有固定列', () => {
    const columns = [
      '日期',
      '客户',
      '单据类型',
      '结算方式',
      '修改人',
      '制单人',
      '业务员',
      '运输方式',
      '客户编码',
      '单号',
      '上笔余额',
      '增加应收',
      '收款金额',
      '余额',
      '未确认应收',
      '审核时间',
      '凭证号',
      '已核销金额',
      '已收款金额',
      '来源单号',
      '说明',
      '是否结算',
    ];
    let previous = -1;
    for (const column of columns) {
      const current = pageSource.indexOf(`title: '${column}'`);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
    expect(pageSource).not.toContain("fixed: 'left'");
  });

  it('复用单据列表密度、自动列宽、分页选择器和服务端汇总', () => {
    expect(pageSource).toContain('useVbenVxeGrid');
    expect(pageSource).toContain('prepareSaleDocumentListColumns');
    expect(pageSource).toContain('getReceivableDetailReportPage');
    expect(pageSource).toContain('getReceivableDetailReportSummary');
    expect(pageSource).toContain("component: 'ErpLazyPageSelect'");
    expect(pageSource).toContain('getCustomerSimplePage');
    expect(pageSource).toContain('getReceivableAccountDeptSimplePage');
    expect(pageSource).toContain('getReceivableAccountUserSimplePage');
    expect(pageSource).toContain("'nickname'");
    expect(pageSource).toContain('全条件合计');
    expect(pageSource).not.toContain('<Table ');
  });

  it('手工核销不再作为应收流水单据类型', () => {
    expect(pageSource).not.toContain("value: 'MANUAL_WRITEOFF'");
    expect(apiSource).not.toContain("| 'MANUAL_WRITEOFF'");
    expect(pageSource).toContain("field: 'writeOffAmount'");
    expect(pageSource).toContain("title: '已核销金额'");
  });

  it('导出权限、路径和价格遮罩入口完整', () => {
    expect(pageSource).toContain('erp:receivable-detail-report:export');
    expect(pageSource).toContain('erp:receivable-account:query');
    expect(pageSource).toContain('amountVisible');
    expect(pageSource).toContain('v-if="canExport"');
    expect(apiSource).toContain('/erp/receivable-detail-report/page');
    expect(apiSource).toContain('/erp/receivable-detail-report/summary');
    expect(apiSource).toContain('/erp/receivable-detail-report/export-excel');
  });

  it('主单和可靠来源使用统一严格只读详情入口', () => {
    expect(pageSource).toContain("slots: { default: 'documentNo' }");
    expect(pageSource).toContain("slots: { default: 'sourceNo' }");
    expect(pageSource).toContain('ReportDocumentLink');
    expect(pageSource).toContain('ReportDocumentDetailModal');
    expect(pageSource).toContain(
      'FINANCE_RECEIPT: REPORT_DOCUMENT_TYPES.FINANCE_RECEIPT',
    );
    expect(pageSource).toContain(
      'RECEIVABLE_ADJUST: REPORT_DOCUMENT_TYPES.RECEIVABLE_OTHER',
    );
    expect(pageSource).toContain(
      'SALE_ADJUST: REPORT_DOCUMENT_TYPES.SALE_PRICE_ADJUST',
    );
    expect(pageSource).toContain('SALE_OUT: REPORT_DOCUMENT_TYPES.SALE_OUT');
    expect(pageSource).toContain(
      'SALE_RETURN: REPORT_DOCUMENT_TYPES.SALE_RETURN',
    );
    expect(pageSource).not.toContain('MANUAL_WRITEOFF: REPORT_DOCUMENT_TYPES');
  });

  it('来源链接同时校验展示值、可靠类型和正整数外键', () => {
    expect(pageSource).toContain('row.sourceNo?.trim()');
    expect(pageSource).toContain('isPositiveDocumentId(row.sourceBusinessId)');
    expect(pageSource).toContain(
      'isReportDocumentType(row.sourceDocumentTypeCode)',
    );
    const rowTypeSource = apiSource.slice(
      apiSource.indexOf('export interface Row'),
      apiSource.indexOf('export interface Summary'),
    );
    expect(rowTypeSource).toContain('sourceBusinessId?: number;');
    expect(rowTypeSource).toContain('sourceDocumentTypeCode?: string;');
  });
});
