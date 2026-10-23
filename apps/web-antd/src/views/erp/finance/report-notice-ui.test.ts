import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

describe('finance report business notices', () => {
  it('keeps receivable and payable reports separated from other AR/AP ledgers', () => {
    const receivableSource = readFileSync(
      join(currentDir, 'receivable/report/index.vue'),
      'utf8',
    );
    const payableSource = readFileSync(
      join(currentDir, 'payable/report/index.vue'),
      'utf8',
    );

    expect(receivableSource).toContain('销售侧业务发生与核销结果');
    expect(receivableSource).toContain('其他应收按独立往来闭环改造');
    expect(receivableSource).toContain(
      '完整余额仍需完成期初核对、收回、核销、冲销和调整台账',
    );
    expect(receivableSource).toContain('预收独立列示');
    expect(receivableSource).toContain(
      '账龄和逾期按真实往来事件及核销结果判断',
    );
    expect(receivableSource).toContain('对账差异生成待办，不直接调整余额');
    expect(payableSource).toContain('采购侧业务发生与核销结果');
    expect(payableSource).toContain('其他应付按独立往来闭环改造');
    expect(payableSource).toContain(
      '完整余额仍需完成期初核对、支付、核销、冲销和调整台账',
    );
    expect(payableSource).toContain('预付独立列示');
    expect(payableSource).toContain('账龄和逾期按真实往来事件及核销结果判断');
    expect(payableSource).toContain('对账差异生成待办，不直接调整余额');
  });

  it('keeps other receivable and other payable as independent closed loops', () => {
    const otherReceivableSource = readFileSync(
      join(currentDir, 'receivable/misc/index.vue'),
      'utf8',
    );
    const otherPayableSource = readFileSync(
      join(currentDir, 'payable/misc/index.vue'),
      'utf8',
    );

    expect(otherReceivableSource).toContain(
      '其他应收按独立往来闭环改造，与销售应收隔离',
    );
    expect(otherReceivableSource).toContain(
      '历史已审核发生额不能直接全部视为未结余额',
    );
    expect(otherReceivableSource).toContain('按逐笔核对结果建立期初');
    expect(otherPayableSource).toContain(
      '其他应付按独立往来闭环改造，与采购应付隔离',
    );
    expect(otherPayableSource).toContain(
      '历史已审核发生额不能直接全部视为未结余额',
    );
    expect(otherPayableSource).toContain('按逐笔核对结果建立期初');
  });
});
