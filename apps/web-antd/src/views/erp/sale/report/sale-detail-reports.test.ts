import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const wrapperSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const quoteSource = readFileSync(
  join(currentDir, 'modules', 'sale-quote-detail-report-table.vue'),
  'utf8',
);
const outSource = readFileSync(
  join(currentDir, 'modules', 'sale-out-detail-report-table.vue'),
  'utf8',
);

describe('销售模块两个明细报表', () => {
  it('以独立页面接入销售管理并校验来源权限', () => {
    expect(wrapperSource).toContain("| 'quote-detail'");
    expect(wrapperSource).toContain("| 'out-detail'");
    expect(wrapperSource).toContain('erp:sale-quote-detail-report:query');
    expect(wrapperSource).toContain('erp:sale-out-detail-report:query');
    expect(wrapperSource).toContain('erp:sale-out:query');
    expect(wrapperSource).toContain('erp:sale-return:query');
    expect(wrapperSource).toContain('erp:sale-price-adjust:query');
    expect(wrapperSource).toContain('<SaleQuoteDetailReportTable');
    expect(wrapperSource).toContain('<SaleOutDetailReportTable');
  });

  it('报价报表展示确认的 38 列并采用手推车动态列宽', () => {
    for (const title of [
      '报价日期',
      '单号',
      '来源单号',
      '订单状态',
      '出库状态',
      '客户名称',
      '客户编码',
      '客户区域',
      '部门',
      '销售员',
      '制单人',
      '预计交货日期',
      '价格类型',
      '零件编码',
      '零件名称',
      '适用车型',
      '特征码',
      '图号',
      '规格',
      '品牌',
      '产地',
      '单位',
      '仓库',
      '货架位',
      '是否赠品',
      '数量',
      '单价',
      '金额',
      '下订时库存数',
      '当前库存数',
      '可用库存数',
      '库存上限',
      '库存下限',
      '标准库存',
      '已转出数',
      '实际出库数',
      '未出数',
      '单据备注',
    ])
      expect(quoteSource).toContain(`title: '${title}'`);
    expect(quoteSource).toContain('prepareSaleDocumentListColumns');
    expect(quoteSource).not.toContain("fixed: 'left'");
    expect(quoteSource).toContain("component: 'ErpLazyPageSelect'");
    expect(quoteSource).toContain('全条件合计');
  });

  it('出库报表按确认顺序展示 41 列并保留成本毛利列布局', () => {
    const columns = [
      '审核日期',
      '单号',
      '单据类型',
      '来源单号',
      '第三方单号',
      '零件编码',
      '零件名称',
      '适用车型',
      '特征码',
      '数量',
      '单价',
      '含运费单价',
      '上次销售价',
      '总金额',
      '税务开票金额',
      '开票状态',
      '销售成本单价',
      '销售成本金额',
      '毛利额',
      '毛利率',
      '产地',
      '品牌',
      '客户名称',
      '客户编码',
      '客户区域',
      '部门',
      '仓库',
      '货架位',
      '业务员',
      '规格',
      '图号',
      '单位',
      '是否赠品',
      '建立人',
      '备注',
      '单据备注',
      '厂家编码',
      '厂家名称',
      '厂家型号',
      '运费类型',
      '运费',
    ];
    let previous = -1;
    for (const title of columns) {
      const current = outSource.indexOf(`title: '${title}'`);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
    expect(outSource).toContain('prepareSaleDocumentListColumns');
    expect(outSource).not.toContain("fixed: 'left'");
  });

  it('出库报表仅在冻结成本完整时显示正式成本合计', () => {
    expect(outSource).toContain("label: '销售成本金额'");
    expect(outSource).toContain('missingSaleCostCount');
    expect(outSource).toContain('成本数据不完整');
    expect(outSource).toContain('totalSaleCostAmount');
    expect(outSource).toContain('costVisible');
    expect(outSource).toContain('costFields');
    expect(outSource).toContain('if (!showCost && costFields.has(field))');
    expect(outSource).toContain('if (costVisible.value)');
    expect(outSource).toContain(
      'formatMoney(summary.value.totalSaleCostAmount)',
    );
  });

  it('导出权限同时受报表权限和来源单据权限控制', () => {
    expect(quoteSource).toContain('erp:sale-quote-detail-report:export');
    expect(quoteSource).toContain('erp:sale-quote:export');
    expect(outSource).toContain('erp:sale-out-detail-report:export');
    expect(outSource).toContain('erp:sale-out:export');
    expect(outSource).toContain('erp:sale-return:export');
    // 销售调价现有导出接口沿用 query 权限，没有独立 export 权限码。
    expect(outSource).toContain('erp:sale-price-adjust:query');
  });

  it('报价报表单号和来源单号复用公共只读详情弹窗', () => {
    expect(quoteSource).toContain('<ReportDocumentLink');
    expect(quoteSource).toContain('REPORT_DOCUMENT_TYPES.SALE_QUOTE');
    expect(quoteSource).toContain('row.quoteId');
    expect(quoteSource).toContain('row.sourceDocumentTypeCode');
    expect(quoteSource).toContain('row.sourceBusinessId');
    expect(quoteSource).toContain('<ReportDocumentDetailModal');
  });

  it('出库报表按当前类型及来源技术字段打开只读详情', () => {
    expect(outSource).toContain('<ReportDocumentLink');
    expect(outSource).toContain(
      'SALE_ADJUST: REPORT_DOCUMENT_TYPES.SALE_PRICE_ADJUST',
    );
    expect(outSource).toContain('SALE_OUT: REPORT_DOCUMENT_TYPES.SALE_OUT');
    expect(outSource).toContain(
      'SALE_RETURN: REPORT_DOCUMENT_TYPES.SALE_RETURN',
    );
    expect(outSource).toContain('row.businessId');
    expect(outSource).toContain('row.sourceDocumentTypeCode');
    expect(outSource).toContain('row.sourceBusinessId');
    expect(outSource).toContain('<ReportDocumentDetailModal');
  });
});
