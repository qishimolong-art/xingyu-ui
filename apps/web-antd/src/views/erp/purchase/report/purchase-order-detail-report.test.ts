import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const wrapperSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const tableSource = readFileSync(
  join(currentDir, 'modules', 'purchase-order-detail-report-table.vue'),
  'utf8',
);
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
    'purchase-order-detail',
    'index.ts',
  ),
  'utf8',
);

describe('配件订货明细表', () => {
  it('以独立页面接入采购管理并使用独立权限', () => {
    expect(wrapperSource).toContain("| 'order-detail'");
    expect(wrapperSource).toContain("'order-detail': '配件订货明细表'");
    expect(wrapperSource).toContain('erp:purchase-order-detail-report:query');
    expect(wrapperSource).toContain('<PurchaseOrderDetailReportTable');
    expect(wrapperSource).toContain('经营报表 · 采购管理');
  });

  it('使用销售手推车同款 VXE 列表骨架、后端分页、全条件合计和分页搜索选择器', () => {
    expect(tableSource).toContain('useVbenVxeGrid');
    expect(tableSource).toContain('table-title="配件订货明细表"');
    expect(tableSource).toContain(
      'toolbarConfig: { refresh: true, search: true }',
    );
    expect(tableSource).not.toContain('<Collapse');
    expect(tableSource).not.toContain('<Table\n');
    expect(tableSource).toContain('getPurchaseOrderDetailReportPage');
    expect(tableSource).toContain('getPurchaseOrderDetailReportSummary');
    expect(tableSource).toContain("component: 'ErpLazyPageSelect'");
    expect(tableSource).toContain('getSupplierSimplePage');
    expect(tableSource).toContain('getPurchaseOrderUserSimplePage');
    expect(tableSource).toContain('getPurchaseWarehouseSimplePage');
    expect(tableSource).toContain("key === 'keyword' ? 'productKeyword' : key");
    expect(tableSource).toContain('preparePurchaseDocumentListColumns');
    expect(tableSource).toContain(
      'useGridColumns(priceVisible.value, currentRows.value)',
    );
    expect(tableSource).not.toContain("fixed: 'left'");
    expect(tableSource).toContain('全条件合计');
    expect(tableSource).toContain('产品+仓库去重');
  });

  it('展示确认的 28 个字段且不包含到货数', () => {
    for (const field of [
      '订货日期',
      '厂家单号',
      '零件名称',
      '供应商',
      '适用车型',
      '零件编码',
      '仓库',
      '货架位',
      '图号',
      '规格',
      '品牌',
      '产地',
      '采购员',
      '制单人',
      '单号',
      '数量',
      '单价',
      '金额',
      '在途数',
      '未入数',
      '下订时库存数',
      '库存上限',
      '库存下限',
      '标准库存',
      '订单在途数',
      '预计到货日期',
      '单据备注',
      '特征码',
    ]) {
      expect(tableSource).toContain(`title: '${field}'`);
    }
    expect(tableSource).not.toContain("title: '到货数'");
  });

  it('导出沿用当前条件并受导出权限控制', () => {
    expect(tableSource).toContain('erp:purchase-order-detail-report:export');
    expect(tableSource).toContain(
      "auth: ['erp:purchase-order-detail-report:export']",
    );
    expect(tableSource).toContain('await gridApi.formApi.getValues()');
    expect(tableSource).toContain('exportPurchaseOrderDetailReport({');
    expect(apiSource).toContain(
      '/erp/purchase-order-detail-report/export-excel',
    );
  });

  it('单号以链接打开只读采购订单详情', () => {
    expect(tableSource).toContain("slots: { default: 'orderNo' }");
    expect(tableSource).toContain('<ReportDocumentLink');
    expect(tableSource).toContain('REPORT_DOCUMENT_TYPES.PURCHASE_ORDER');
    expect(tableSource).toContain('row.orderId');
    expect(tableSource).toContain('<ReportDocumentDetailModal');
  });
});
