import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const tableSource = readFileSync(
  join(currentDir, 'modules/stock-out-detail-report-table.vue'),
  'utf8',
);
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/report/stock-out-detail/index.ts'),
  'utf8',
);

describe('其他出库明细报表', () => {
  it('按确认顺序展示 31 个业务列并排除已删除字段', () => {
    const expectedTitles = [
      '仓库',
      '单号',
      '相关对象',
      '编码',
      '图号',
      '产品名称',
      '适用车型',
      '特征码',
      '数量',
      '单价',
      '金额',
      '成本单价',
      '成本金额',
      '产品价格',
      '产品金额',
      '取消数',
      '取消后出库数',
      '取消后出库金额',
      '单据日期',
      '审核日期',
      '来源单号',
      '品牌',
      '产地',
      '规格',
      '商品类别',
      '货架',
      '类别',
      '业务员',
      '制单人',
      '部门',
      '备注',
    ];
    const titles = [
      ...tableSource.matchAll(/column\('[^']+',\s*'([^']+)'/g),
    ].map((match) => match[1]);

    expect(titles).toEqual(expectedTitles);
    expect(tableSource).not.toContain('调入连锁店');
    expect(tableSource).not.toContain('连锁对应仓库');
    expect(tableSource).not.toContain('来源供应商');
    expect(tableSource).not.toContain('区域');
    expect(tableSource).not.toContain('路线');
  });

  it('使用独立接口、双重权限、分页搜索和最近三十天', () => {
    expect(apiSource).toContain("'/erp/stock-out-detail-report/page'");
    expect(apiSource).toContain("'/erp/stock-out-detail-report/summary'");
    expect(apiSource).toContain("'/erp/stock-out-detail-report/export-excel'");
    expect(tableSource).toContain("subtract(29, 'day').startOf('day')");
    expect(tableSource).toContain('getCustomerSimplePage');
    expect(tableSource).toContain('getStockOutDeptSimplePage');
    expect(tableSource).toContain('getStockOutUserSimplePage');
    expect(tableSource).toContain('pageSizes: [10, 20, 50, 100]');
    expect(tableSource).toContain(
      "hasAccessByCodes(['erp:stock-out-detail-report:export'])",
    );
    expect(tableSource).toContain("hasAccessByCodes(['erp:stock-out:export'])");
  });

  it('查询区默认只显示一行并统一占位文字字号', () => {
    expect(tableSource).toContain('collapsed: true');
    expect(tableSource).toContain('collapsedRows: 1');
    expect(tableSource).toContain('.ant-input::placeholder');
    expect(tableSource).toContain('.ant-input-number-input::placeholder');
    expect(tableSource).toContain('.ant-select-selection-placeholder');
    expect(tableSource).toContain(
      '.ant-select-selection-search-input::placeholder',
    );
    expect(tableSource).toContain('.ant-picker-input');
  });

  it('表头样式与销售手推车保持一致', () => {
    expect(tableSource).toContain('.vxe-table--render-default');
    expect(tableSource).toContain(
      '.vxe-header--column.is--sortable .vxe-cell--title',
    );
    expect(tableSource).toContain('color: #1677ff');
    expect(tableSource).toContain('.vxe-header--column .vxe-cell--sort');
    expect(tableSource).toContain('display: none');
  });

  it('处理全条件合计、三组字段权限、成本缺失、旧请求和错误态', () => {
    expect(tableSource).toContain('summary.value.priceVisible === false');
    expect(tableSource).toContain('summary.value.costVisible === false');
    expect(tableSource).toContain('summary.value.missingCostCount');
    expect(tableSource).toContain('let pageRequestId = 0');
    expect(tableSource).toContain('let summaryRequestId = 0');
    expect(tableSource).toContain('v-if="loadError"');
    expect(tableSource).toContain('loading: exporting');
    expect(tableSource).not.toContain('本页小计');
    expect(tableSource).not.toContain('pageSummaryItems');
    expect(tableSource).toContain('全条件合计');
  });

  it('库存经营报表容器接入独立页面', () => {
    expect(indexSource).toContain("'other-out-detail': '其他出库明细报表'");
    expect(indexSource).toContain("pageKey === 'other-out-detail'");
    expect(indexSource).toContain("'erp:stock-out-detail-report:query'");
    expect(indexSource).toContain("'erp:stock-out:query'");
  });
});
