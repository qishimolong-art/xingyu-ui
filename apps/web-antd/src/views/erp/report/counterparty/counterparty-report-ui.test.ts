import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const erpViewsDir = join(currentDir, '..', '..');

function readErpView(path: string) {
  return readFileSync(join(erpViewsDir, path), 'utf8');
}

describe('经营报表 05/06 往来只读入口', () => {
  const receivableSource = readErpView('finance/receivable/report/index.vue');
  const payableSource = readErpView('finance/payable/report/index.vue');
  const readonlyTableSource = readFileSync(
    join(currentDir, 'modules/misc-readonly-table.vue'),
    'utf8',
  );
  const offsetReadonlyTableSource = readFileSync(
    join(currentDir, 'modules/settlement-offset-readonly-table.vue'),
    'utf8',
  );
  const preSettlementReadonlyTableSource = readFileSync(
    join(currentDir, 'modules/pre-settlement-readonly-table.vue'),
    'utf8',
  );
  const writeoffReadonlyModalSource = readFileSync(
    join(currentDir, 'modules/settlement-writeoff-readonly-modal.vue'),
    'utf8',
  );

  it('在已有应收和应付路由中提供汇总、其他往来、预收预付和应收冲应付只读页签', () => {
    expect(receivableSource).toContain('经营报表 · 05 销售应收及其他应收');
    expect(receivableSource).toContain('05 · 销售应收账户');
    expect(receivableSource).toContain('05 · 销售应收汇总');
    expect(receivableSource).toContain('05 · 其他应收');
    expect(receivableSource).toContain('预收款只读参考');
    expect(receivableSource).toContain('预收账款只读参考');
    expect(receivableSource).toContain('应收冲应付参考');
    expect(payableSource).toContain('经营报表 · 06 采购应付及其他应付');
    expect(payableSource).toContain('06 · 采购应付账户');
    expect(payableSource).toContain('06 · 采购应付汇总');
    expect(payableSource).toContain('06 · 其他应付');
    expect(payableSource).toContain('预付款只读参考');
    expect(payableSource).toContain('应收冲应付参考');
    expect(receivableSource).toContain('BusinessReportShell');
    expect(payableSource).toContain('BusinessReportShell');
  });

  it('分别校验汇总、其他往来和应收冲应付查询权限', () => {
    expect(receivableSource).toContain("['erp:receivable-account:query']");
    expect(receivableSource).toContain("['erp:receivable-report:query']");
    expect(receivableSource).toContain("['erp:receivable-misc:query']");
    expect(receivableSource).toContain("['erp:settlement-offset:query']");
    expect(receivableSource).toContain("['erp:pre-receipt:query']");
    expect(receivableSource).toContain("['erp:pre-receivable:query']");
    expect(payableSource).toContain("['erp:payable-account:query']");
    expect(payableSource).toContain("['erp:payable-report:query']");
    expect(payableSource).toContain("['erp:payable-misc:query']");
    expect(payableSource).toContain("['erp:settlement-offset:query']");
    expect(payableSource).toContain("['erp:pre-payment:query']");
    expect(receivableSource).toContain(':denied="!canQuery"');
    expect(payableSource).toContain(':denied="!canQuery"');
  });

  it('预收和预付页签只复用分页接口且不引入会计维护动作', () => {
    expect(receivableSource).toContain('CustomerReceivableOverviewTable');
    expect(payableSource).toContain('SupplierPayableOverviewTable');
    expect(receivableSource).toContain('销售应收账户页签复用既有账户分页');
    expect(receivableSource).toContain(
      '正式新口径不能把其他应收串入销售应收余额',
    );
    expect(payableSource).toContain('采购应付账户页签复用既有账户分页');
    expect(payableSource).toContain('正式新口径不能把其他应付串入采购应付余额');
    expect(receivableSource).toContain('PreSettlementReadonlyTable');
    expect(payableSource).toContain('PreSettlementReadonlyTable');
    expect(receivableSource).toContain('report-type="preReceipt"');
    expect(receivableSource).toContain('report-type="preReceivable"');
    expect(payableSource).toContain('report-type="prePayment"');
    expect(receivableSource).toContain(
      '销售应收账户、其他应收、预收款、预收账款和应收冲应付参考',
    );
    expect(payableSource).toContain(
      '采购应付账户、其他应付、预付款和应收冲应付参考',
    );
    expect(preSettlementReadonlyTableSource).toContain('getPreReceiptPage');
    expect(preSettlementReadonlyTableSource).toContain('getPrePaymentPage');
    expect(preSettlementReadonlyTableSource).toContain('getPreReceivablePage');
    expect(preSettlementReadonlyTableSource).toContain('只读复用预收款分页');
    expect(preSettlementReadonlyTableSource).toContain('只读复用预付款分页');
    expect(preSettlementReadonlyTableSource).toContain('只读复用预收账款分页');
    expect(preSettlementReadonlyTableSource).toContain(
      '本页为参考合计，预收预付独立列示',
    );
    expect(preSettlementReadonlyTableSource).toContain(
      '不并入销售应收/采购应付正式余额',
    );
    expect(preSettlementReadonlyTableSource).toContain(
      '历史截止余额和账龄待新核算台账',
    );
    expect(preSettlementReadonlyTableSource).toContain('本页参考合计');
    expect(preSettlementReadonlyTableSource).toContain("field: 'remark'");
    expect(preSettlementReadonlyTableSource).toContain("field: 'fileUrl'");
    expect(preSettlementReadonlyTableSource).toContain(
      '<template #fileUrl="{ row }">',
    );
    for (const forbidden of [
      'createPreReceipt',
      'updatePreReceipt',
      'updatePreReceiptStatus',
      'deletePreReceipt',
      'getPreReceipt(',
      'createPreReceivable',
      'updatePreReceivable',
      'updatePreReceivableStatus',
      'deletePreReceivable',
      'getPreReceivable(',
      'createPrePayment',
      'updatePrePayment',
      'updatePrePaymentStatus',
      'deletePrePayment',
      'getPrePayment(',
      'TableAction',
    ]) {
      expect(preSettlementReadonlyTableSource).not.toContain(forbidden);
    }
  });

  it('其他往来复用分页接口且不引入写操作', () => {
    expect(readonlyTableSource).toContain('getReceivableMiscPage');
    expect(readonlyTableSource).toContain('getPayableMiscPage');
    expect(readonlyTableSource).not.toContain('receivable-other');
    expect(readonlyTableSource).not.toContain('payable-other');
    expect(readonlyTableSource).toContain('pageNo: page.currentPage');
    expect(readonlyTableSource).toContain('pageSize: page.pageSize');
    expect(readonlyTableSource).toContain("column.type !== 'checkbox'");
    expect(readonlyTableSource).toContain("field: 'customerContact'");
    expect(readonlyTableSource).toContain("field: 'customerMobile'");
    expect(readonlyTableSource).toContain("field: 'supplierContact'");
    expect(readonlyTableSource).toContain("field: 'supplierMobile'");
    expect(readonlyTableSource).toContain("field: 'handlerName'");
    expect(readonlyTableSource).toContain("title: '经办人'");
    expect(readonlyTableSource).toContain('其他应收与销售应收隔离');
    expect(readonlyTableSource).toContain('其他应付与采购应付隔离');
    expect(readonlyTableSource).toContain(
      '历史已审核发生额不能直接视为未结余额',
    );
    expect(readonlyTableSource).toContain('本表展示登记发生额和状态参考');
    expect(readonlyTableSource).toContain(
      '不能用“已审核金额 - 已转收付款”直接推导正式余额',
    );
    expect(readonlyTableSource).toContain(
      '本页为参考合计，草稿/待审核只作过程核对',
    );
    expect(readonlyTableSource).toContain(
      '正式余额需按独立往来闭环、期初核对、核销/冲销/调整形成',
    );
    expect(readonlyTableSource).toContain(
      '员工、其他单位、项目、约定收款日期、账龄、逾期及独立收回/核销/冲销/调整闭环仍待后续扩展',
    );
    expect(readonlyTableSource).toContain(
      '员工、其他单位、项目、约定付款日期、账龄、逾期及独立支付/核销/冲销/调整闭环仍待后续扩展',
    );
    expect(readonlyTableSource).toContain('本页参考合计');
    for (const type of ['Receivable', 'Payable']) {
      for (const apiName of [
        `create${type}Misc`,
        `createAndSubmit${type}Misc`,
        `delete${type}Misc`,
        `export${type}Misc`,
        `import${type}Misc`,
        `print${type}Misc`,
        `submit${type}Misc`,
        `update${type}Misc`,
        `updateAndSubmit${type}Misc`,
        `update${type}MiscStatus`,
      ]) {
        expect(readonlyTableSource).not.toContain(apiName);
      }
    }
  });

  it('应收冲应付页签只复用分页接口且不直接调整余额', () => {
    expect(receivableSource).toContain('SettlementOffsetReadonlyTable');
    expect(payableSource).toContain('SettlementOffsetReadonlyTable');
    expect(receivableSource).toContain(
      '应收冲应付只展示轧抵参考，不直接调整余额',
    );
    expect(payableSource).toContain('应收冲应付只展示轧抵参考，不直接调整余额');
    expect(receivableSource).toContain(
      '不替代对账单确认、历史截止余额或差异待办',
    );
    expect(payableSource).toContain('不替代对账单确认、历史截止余额或差异待办');
    expect(offsetReadonlyTableSource).toContain('getSettlementOffsetPage');
    expect(offsetReadonlyTableSource).toContain('应收冲应付只读参考');
    expect(offsetReadonlyTableSource).toContain(
      '本页只是轧抵参考，不自动生成冲抵单，不直接调整余额，差异和正式冲抵仍走业务流程',
    );
    expect(offsetReadonlyTableSource).toContain('不导出明细、不核销、不调账');
    expect(offsetReadonlyTableSource).toContain('本页参考应收');
    expect(offsetReadonlyTableSource).toContain('本页参考应付');
    expect(offsetReadonlyTableSource).toContain('本页参考轧抵');
    expect(offsetReadonlyTableSource).toContain(
      '不替代对账单确认、历史截止余额或差异待办',
    );
    for (const forbidden of [
      'getSettlementOffsetDetail',
      'exportSettlementOffsetDetail',
      'writeOff',
      'create',
      'update',
      'delete',
      'downloadFileFromBlobPart',
      'TableAction',
    ]) {
      expect(offsetReadonlyTableSource).not.toContain(forbidden);
    }
  });

  it('核销弹窗只展示当前业务核销关系且不冒充历史对账口径', () => {
    expect(writeoffReadonlyModalSource).toContain(
      'getFinanceReceiptWriteOffItems',
    );
    expect(writeoffReadonlyModalSource).toContain(
      'getFinancePaymentWriteOffItems',
    );
    expect(writeoffReadonlyModalSource).toContain('按现有核销关系只读展示');
    expect(writeoffReadonlyModalSource).toContain('核销明细读取接口');
    expect(writeoffReadonlyModalSource).toContain('不重算历史截止余额/账龄');
    expect(writeoffReadonlyModalSource).toContain(
      '不提供核销、反核销、编辑、删除、导出',
    );
    expect(writeoffReadonlyModalSource).toContain('本页参考核销合计');
    for (const forbidden of [
      'writeOffFinanceReceipt',
      'reverseFinanceReceiptWriteOff',
      'writeOffFinancePayment',
      'reverseFinancePaymentWriteOff',
      'deleteFinanceReceipt',
      'deleteFinancePayment',
      'downloadFileFromBlobPart',
      'TableAction',
    ]) {
      expect(writeoffReadonlyModalSource).not.toContain(forbidden);
    }
  });

  it('在页签容器内纵向填满并让表格占用剩余空间', () => {
    expect(readonlyTableSource).toMatch(
      /\.counterparty-misc-readonly-table\s*{[^}]*height:\s*100%;/s,
    );
    expect(readonlyTableSource).toMatch(
      /\.counterparty-misc-readonly-table__grid\s*{[^}]*flex:\s*1 1 auto;/s,
    );
    expect(offsetReadonlyTableSource).toMatch(
      /\.settlement-offset-readonly-table\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;[\s\S]*?\}/,
    );
    expect(offsetReadonlyTableSource).toMatch(
      /\.settlement-offset-readonly-table__table\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;[\s\S]*?\}/,
    );
    expect(preSettlementReadonlyTableSource).toMatch(
      /\.pre-settlement-readonly-table\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;[\s\S]*?\}/,
    );
    expect(preSettlementReadonlyTableSource).toMatch(
      /\.pre-settlement-readonly-table__grid\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;[\s\S]*?\}/,
    );
  });

  it('保留既有汇总明细和导出权限并说明正式余额口径', () => {
    expect(receivableSource).toContain(
      "auth: ['erp:receivable-report:export']",
    );
    expect(receivableSource).toContain("auth: ['erp:receivable-report:query']");
    expect(payableSource).toContain("auth: ['erp:payable-report:export']");
    expect(payableSource).toContain("auth: ['erp:payable-report:query']");
    expect(receivableSource).toContain(
      '只有已审核且有效的其他应收进入正式余额',
    );
    expect(payableSource).toContain('只有已审核且有效的其他应付进入正式余额');
    expect(receivableSource).toContain('草稿、待审核单据仅用于过程核对');
    expect(payableSource).toContain('草稿、待审核单据仅用于过程核对');
  });
});
