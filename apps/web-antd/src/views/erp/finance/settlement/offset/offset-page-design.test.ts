import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  useGridColumns,
  usePayableDetailColumns,
  useReceivableDetailColumns,
} from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const detailSource = readFileSync(
  join(currentDir, 'modules/detail-drawer.vue'),
  'utf8',
);

describe('settlement offset page design contract', () => {
  it('keeps the requested customer balance fields in their exact sequence', () => {
    const columns = (useGridColumns() || []).filter((column) => column.field);

    expect(columns.map((column) => column.field)).toEqual([
      'customerCode',
      'subjectName',
      'receivableBalance',
      'payableBalance',
      'offsetBalance',
    ]);
    expect(columns.map((column) => column.title)).toEqual([
      '客户编码',
      '客户名称',
      '应收余额',
      '应付余额',
      '余额',
    ]);
  });

  it('shows explicit receipt and payment information in both detail tables', () => {
    const receivableColumns = useReceivableDetailColumns() || [];
    const payableColumns = usePayableDetailColumns() || [];

    expect(receivableColumns.map((column) => column.title)).toEqual([
      '审批日期',
      '序号',
      '单据类型',
      '单据号',
      '所属部门',
      '上笔余额',
      '增加金额',
      '收款金额',
      '核销金额',
      '已核销金额',
      '余额',
      '收款情况',
      '单据时间',
    ]);
    expect(payableColumns.map((column) => column.title)).toEqual([
      '审批日期',
      '序号',
      '单据类型',
      '单据号',
      '所属部门',
      '上笔余额',
      '增加金额',
      '付款金额',
      '核销金额',
      '已核销金额',
      '余额',
      '付款情况',
      '单据时间',
    ]);
    expect(detailSource).toContain('#receiptStatus');
    expect(detailSource).toContain('#paymentStatus');
    expect(detailSource).toContain("deptName: 'deptName'");
    expect(detailSource).toContain('getReceivableStatusMeta(row).label');
    expect(detailSource).toContain('getPayableStatusMeta(row).label');
    expect(detailSource).toContain("receivableOrderField: 'approveTime'");
    expect(detailSource).toContain("receivableOrderDirection: 'asc'");
    expect(detailSource).toContain("payableOrderField: 'approveTime'");
    expect(detailSource).toContain("payableOrderDirection: 'asc'");
    expect(detailSource).toContain("field: 'approveTime',\n  order: 'asc'");
    expect(detailSource).toContain("keyField: 'eventKey'");
    expect(detailSource).toContain("dateBasis: 'approveTime'");
  });

  it('keeps detail loading and stale-request exits explicit', () => {
    expect(detailSource).toContain('const sequence = ++loadSequence');
    expect(detailSource).toContain('if (sequence !== loadSequence) return');
    expect(detailSource).toContain(
      "loadError.value = '往来明细加载失败，请稍后重试'",
    );
    expect(detailSource).toContain('loading.value = false');
    expect(detailSource).toContain('onBeforeUnmount');
  });
});
