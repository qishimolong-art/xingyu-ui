import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const wrapperSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const tableSource = readFileSync(
  join(currentDir, 'modules', 'pick-delivery-readonly-table.vue'),
  'utf8',
);
const apiSource = readFileSync(
  join(
    currentDir,
    '../../../../api/erp/report/sale-pick-delivery-detail/index.ts',
  ),
  'utf8',
);

describe('销售拣货、送货明细报表', () => {
  it('沿用原页面路径并同时校验新旧查询权限', () => {
    expect(wrapperSource).toContain("delivery: '送货明细查询'");
    expect(wrapperSource).toContain("pick: '拣货明细查询'");
    expect(wrapperSource).toContain('erp:sale-pick-detail-report:query');
    expect(wrapperSource).toContain('erp:sale-delivery-detail-report:query');
    expect(wrapperSource).toContain('canPick.value');
    expect(wrapperSource).toContain('canDelivery.value');
  });

  it('接入六个独立分页、汇总和导出接口', () => {
    expect(apiSource).toContain('/erp/sale-');
    expect(apiSource).toContain('-detail-report');
    expect(apiSource).toContain(`\${prefix(mode)}/page`);
    expect(apiSource).toContain(`\${prefix(mode)}/summary`);
    expect(apiSource).toContain(`\${prefix(mode)}/export-excel`);
  });

  it('覆盖两份报表的确认字段且不再显示已删除字段', () => {
    for (const title of [
      '序号',
      '任务创建日期',
      '销售出库日期',
      '销售手推车单号',
      '销售出库单号',
      '客户名称',
      '开单部门',
      '业务员',
      '仓库',
      '零件编码',
      '零件名称',
      '规格',
      '仓位',
      '已拣数量',
      '包装数',
      '件数',
      '最近操作时间',
      '任务完成时间',
    ])
      expect(tableSource).toContain(`'${title}'`);
    for (const title of ['已送数量', '当前可送数量', '未送数量'])
      expect(tableSource).toContain(`title: '${title}'`);
    for (const removed of [
      '承运人',
      '收货人',
      '物流公司',
      '签收状态',
      '配送单号',
      '明细备注',
    ])
      expect(tableSource).not.toContain(`title: '${removed}'`);
  });

  it('默认本月、限制分页档位并使用远程分页选择器', () => {
    expect(tableSource).toContain("dayjs().startOf('month')");
    expect(tableSource).toContain("dayjs().endOf('month')");
    expect(tableSource).toContain('pageSizes: [10, 20, 50]');
    expect(tableSource).toContain("component: 'ErpLazyPageSelect'");
    expect(tableSource).toContain('pageSize: 10');
  });

  it('两个单号只在技术 ID 有效时进入严格只读详情弹窗', () => {
    expect(tableSource).toContain('isValidId(row.sourceCartId)');
    expect(tableSource).toContain('isValidId(row.saleOutId)');
    expect(tableSource).toContain('REPORT_DOCUMENT_TYPES.SALE_CART');
    expect(tableSource).toContain('REPORT_DOCUMENT_TYPES.SALE_OUT');
    expect(tableSource).toContain('<ReportDocumentDetailModal');
  });

  it('查询与汇总独立，请求竞态及汇总失败不会清空列表', () => {
    expect(tableSource).toContain('const current = ++requestId');
    expect(tableSource).toContain('if (current !== requestId) return');
    expect(tableSource).toContain('.catch(() => undefined)');
    expect(tableSource).toContain('全条件合计');
  });

  it('字段权限同步移除列表、筛选、汇总和导出内容', () => {
    expect(tableSource).toContain("countMin: 'count'");
    expect(tableSource).toContain("remainingCountMax: 'count'");
    expect(tableSource).toContain("hiddenFields.value.has('count')");
  });
});
