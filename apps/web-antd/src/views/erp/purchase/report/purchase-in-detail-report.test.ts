import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const wrapperSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const tableSource = readFileSync(
  join(currentDir, 'modules', 'purchase-in-detail-report-table.vue'),
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
    'purchase-in-detail',
    'index.ts',
  ),
  'utf8',
);

describe('配件入库明细查询报表', () => {
  it('以独立页面接入采购管理并同时校验三类来源查询权限', () => {
    expect(wrapperSource).toContain("| 'in-detail'");
    expect(wrapperSource).toContain("'in-detail': '配件入库明细查询报表'");
    expect(wrapperSource).toContain('erp:purchase-in-detail-report:query');
    expect(wrapperSource).toContain('erp:purchase-in:query');
    expect(wrapperSource).toContain('erp:purchase-return:query');
    expect(wrapperSource).toContain('erp:purchase-price-adjust:query');
    expect(wrapperSource).toContain('<PurchaseInDetailReportTable');
  });

  it('固定展示确认的 35 列且单据类型紧随单号', () => {
    const columns = [
      '审核日期',
      '单号',
      '单据类型',
      '来源单号',
      '零件编码',
      '零件名称',
      '适用车型',
      '特征码',
      '数量',
      '单价',
      '含运费单价',
      '上次采购价',
      '总金额',
      '税务开票金额',
      '开票状态',
      '产地',
      '厂家单号',
      '品牌',
      '供应商',
      '供应商编码',
      '仓库',
      '货架位',
      '业务员',
      '规格',
      '图号',
      '单位',
      '建立人',
      '备注',
      '单据备注',
      '厂家编码',
      '厂家名称',
      '厂家型号',
      '供应商区域',
      '运费类型1',
      '运费1',
    ];
    let previous = -1;
    for (const column of columns) {
      const current = tableSource.indexOf(`title: '${column}'`);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
    expect(tableSource).not.toContain("fixed: 'left'");
  });

  it('使用与销售手推车一致的 VXE 报表壳层、服务端查询和自动列宽', () => {
    expect(tableSource).toContain('useVbenVxeGrid');
    expect(tableSource).toContain('preparePurchaseDocumentListColumns');
    expect(tableSource).toContain(
      'useGridColumns(priceVisible.value, currentRows.value)',
    );
    expect(tableSource).toContain('getPurchaseInDetailReportPage');
    expect(tableSource).toContain('getPurchaseInDetailReportSummary');
    expect(tableSource).toContain('proxyConfig');
    expect(tableSource).toContain('createVxeHeaderSort');
    expect(tableSource).toContain("component: 'ErpLazyPageSelect'");
    expect(tableSource).toContain('getSupplierSimplePage');
    expect(tableSource).toContain('getPurchaseWarehouseSimplePage');
    expect(tableSource).toContain('全条件合计');
    expect(tableSource).not.toContain('<Table ');
    expect(wrapperSource).toContain("pageKey !== 'order-detail'");
    expect(wrapperSource).toContain("pageKey !== 'in-detail'");
  });

  it('单价、含运费单价和上次采购价统一固定显示两位小数', () => {
    for (const field of [
      'productPrice',
      'freightIncludedPrice',
      'previousPurchasePrice',
    ]) {
      const column = tableSource.match(
        new RegExp(String.raw`field: '${field}'[\s\S]*?formatter: (\w+),`),
      );
      expect(column?.[1]).toBe('moneyFormatter');
    }
    expect(tableSource).not.toContain('preciseMoneyFormatter');
    expect(tableSource).toContain('minimumFractionDigits: fractionDigits');
    expect(tableSource).toContain('maximumFractionDigits: fractionDigits');
  });

  it('导出受报表和三类来源导出权限共同控制', () => {
    expect(tableSource).toContain('erp:purchase-in-detail-report:export');
    expect(tableSource).toContain('erp:purchase-in:export');
    expect(tableSource).toContain('erp:purchase-return:export');
    expect(tableSource).toContain('erp:purchase-price-adjust:export');
    expect(tableSource).toContain('v-if="canExport"');
    expect(apiSource).toContain('/erp/purchase-in-detail-report/export-excel');
  });

  it('当前单号和来源单号按可靠业务 ID 打开只读详情', () => {
    expect(tableSource).toContain("slots: { default: 'documentNo' }");
    expect(tableSource).toContain("slots: { default: 'sourceNo' }");
    expect(tableSource).toContain('currentDocumentTypeMap');
    expect(tableSource).toContain('row.businessId');
    expect(tableSource).toContain('row.sourceBusinessId');
    expect(tableSource).toContain('row.sourceDocumentTypeCode');
    expect(tableSource).toContain('<ReportDocumentDetailModal');
    expect(apiSource).toContain('sourceBusinessId?: number');
    expect(apiSource).toContain(
      "sourceDocumentTypeCode?: 'PURCHASE_IN' | 'PURCHASE_ORDER'",
    );
  });
});
