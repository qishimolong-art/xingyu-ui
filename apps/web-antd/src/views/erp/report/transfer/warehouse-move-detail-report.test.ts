import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const tableSource = readFileSync(
  join(currentDir, 'modules/warehouse-move-detail-report.vue'),
  'utf8',
);
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/report/warehouse-move-detail/index.ts'),
  'utf8',
);

describe('仓库移货明细报表', () => {
  it('按确认顺序展示 23 个业务字段', () => {
    const expectedTitles = [
      '编码',
      '单号',
      '审核日期',
      '名称',
      '品牌',
      '车型',
      '产地',
      '单位',
      '移动数',
      '单价',
      '金额',
      '移货单价',
      '移货金额',
      '移出仓库',
      '移出货架',
      '移入仓库',
      '移入货架',
      '制单人',
      '审核人',
      '规格',
      '图号',
      '特征码',
      '明细备注',
    ];
    const titles = [...tableSource.matchAll(/title:\s*'([^']+)'/g)].map(
      (match) => match[1],
    );

    expect(titles).toEqual(expectedTitles);
    expect(tableSource).not.toContain("title: '供应商'");
    expect(tableSource).not.toContain("title: '外文名'");
  });

  it('使用独立明细分页、汇总和导出接口', () => {
    expect(apiSource).toContain(
      "const BASE_URL = '/erp/business-report/warehouse-move-detail'",
    );
    expect(tableSource).toContain('getWarehouseMoveDetailPage(params)');
    expect(tableSource).toContain('getWarehouseMoveDetailSummary');
    expect(tableSource).toContain('exportWarehouseMoveDetail');
    expect(indexSource).toContain("move: '仓库移货明细报表'");
    expect(indexSource).toContain(
      '<WarehouseMoveDetailReport v-if="pageKey === \'move\'" />',
    );
  });

  it('包含最近30天、懒加载仓库、分页小计和权限隐藏', () => {
    expect(tableSource).toContain("dayjs().subtract(29, 'day')");
    expect(tableSource).toContain('getWarehouseSimplePage');
    expect(tableSource).toContain('<ErpLazyPageSelect');
    expect(tableSource).toContain('本页小计：');
    expect(tableSource).toContain('全条件合计：');
    expect(tableSource).toContain("['10', '20', '50', '100']");
    expect(tableSource).toContain('summary.value.hiddenFields');
    expect(tableSource).toContain('costVisible');
    expect(tableSource).toContain('movePriceVisible');
    expect(tableSource).toContain('currentRequestId !== requestId');
  });
});
