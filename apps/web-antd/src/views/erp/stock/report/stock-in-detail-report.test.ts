import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const tableSource = readFileSync(
  join(currentDir, 'modules/stock-in-detail-report-table.vue'),
  'utf8',
);
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/report/stock-in-detail/index.ts'),
  'utf8',
);

describe('其他入库明细报表', () => {
  it('按确认顺序展示 20 个业务列并排除已删除字段', () => {
    const expectedTitles = [
      '仓库',
      '单号',
      '相关对象',
      '编码',
      '图号',
      '产品名称',
      '适用车型',
      '数量',
      '单价',
      '金额',
      '品牌',
      '产地',
      '规格',
      '商品类型',
      '货架',
      '审核日期',
      '单据日期',
      '备注',
      '部门',
      '业务员',
    ];
    const titles = [...tableSource.matchAll(/title:\s*'([^']+)'/g)].map(
      (match) => match[1],
    );

    expect(titles).toEqual(expectedTitles);
    expect(tableSource).not.toContain('来源连锁店');
    expect(tableSource).not.toContain('连锁对应仓库');
    expect(tableSource).not.toContain('来源供应商');
    expect(tableSource).not.toContain("field: 'type'");
  });

  it('使用独立分页、全条件汇总、导出与双重权限', () => {
    expect(apiSource).toContain("'/erp/stock-in-detail-report/page'");
    expect(apiSource).toContain("'/erp/stock-in-detail-report/summary'");
    expect(apiSource).toContain("'/erp/stock-in-detail-report/export-excel'");
    expect(tableSource).toContain('本页小计');
    expect(tableSource).toContain('全条件合计');
    expect(tableSource).toContain(
      "hasAccessByCodes(['erp:stock-in-detail-report:export'])",
    );
    expect(tableSource).toContain("hasAccessByCodes(['erp:stock-in:export'])");
  });

  it('默认最近 30 个自然日并使用分页搜索选项', () => {
    expect(tableSource).toContain("subtract(29, 'day').startOf('day')");
    expect(tableSource).toContain("dayjs().endOf('day')");
    expect(tableSource).toContain('getWarehouseSimplePage');
    expect(tableSource).toContain('getSupplierSimplePage');
    expect(tableSource).toContain('getStockInDeptSimplePage');
    expect(tableSource).toContain('getStockInUserSimplePage');
    expect(tableSource).toContain('pageSizes: [10, 20, 50, 100]');
    expect(tableSource).toContain('remote: true');
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

  it('处理金额权限、旧请求、错误态和导出态', () => {
    expect(tableSource).toContain('summary.value.priceVisible === false');
    expect(tableSource).toContain('summary.value.hiddenFields');
    expect(tableSource).toContain('hiddenFields: rowVisibility.hiddenFields');
    expect(tableSource).toContain('priceVisible: rowVisibility.priceVisible');
    expect(tableSource).toContain('let pageRequestId = 0');
    expect(tableSource).toContain('let summaryRequestId = 0');
    expect(tableSource).toContain('v-if="loadError"');
    expect(tableSource).toContain('loading: exporting');
    expect(tableSource).toContain('汇总加载失败，列表数据不受影响');
  });

  it('库存经营报表容器接入独立页面', () => {
    expect(indexSource).toContain("'other-in-detail': '其他入库明细报表'");
    expect(indexSource).toContain("pageKey === 'other-in-detail'");
    expect(indexSource).toContain("'erp:stock-in-detail-report:query'");
    expect(indexSource).toContain("'erp:stock-in:query'");
  });
});
