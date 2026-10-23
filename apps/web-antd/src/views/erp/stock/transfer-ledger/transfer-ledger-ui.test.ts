import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import dayjs from 'dayjs';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vitest';

import {
  normalizeStockTransferLedgerDate,
  normalizeStockTransferLedgerParams,
} from '#/api/erp/stock/transfer-ledger';

import { useGridColumns, useGridFormSchema } from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const detailSource = readFileSync(
  join(currentDir, 'modules/detail-modal.vue'),
  'utf8',
);
const transferDocumentReadonlySource = readFileSync(
  join(currentDir, 'modules/transfer-document-readonly-table.vue'),
  'utf8',
);

describe('stock transfer ledger UI contract', () => {
  setActivePinia(createPinia());

  it('defaults to a required recent-30-day range and exposes mismatch filters', () => {
    const schemas = useGridFormSchema();
    const dateSchema = schemas.find((item) => item.fieldName === 'moveTime');

    expect(dateSchema?.defaultValue).toHaveLength(2);
    expect(dateSchema?.defaultValue).toEqual([
      expect.stringMatching(/^\d{4}-\d{2}-\d{2} 00:00:00$/),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2} 23:59:59$/),
    ]);
    expect(dateSchema?.componentProps).toMatchObject({ allowClear: false });
    expect(schemas.map((item) => item.fieldName)).toEqual(
      expect.arrayContaining([
        'matchStatus',
        'exceptionCode',
        'transferOutNo',
        'transferInNo',
      ]),
    );
    expect(
      (schemas.find((item) => item.fieldName === 'matchStatus')?.componentProps as { options?: unknown })?.options,
    ).toEqual([
      { label: '正常', value: 'NORMAL' },
      { label: '异常', value: 'ABNORMAL' },
    ]);
  });

  it('keeps daily quantities, differences, statuses and drill-down actions', () => {
    const columns = useGridColumns() as any[];
    expect(columns.map((column) => column.field)).toEqual(
      expect.arrayContaining([
        'businessDate',
        'transferOutCount',
        'transferInCount',
        'differenceCount',
        'abnormalGroupCount',
        'ledgerStatus',
      ]),
    );
    expect(indexSource).toContain('openDetail(row)');
    expect(indexSource).toContain("column.field !== 'action'");
    expect(indexSource).toContain('Number(row.abnormalGroupCount) > 0');
    expect(indexSource).toContain('Number(row.differenceCount) !== 0');
    expect(indexSource).toContain("auth: ['erp:stock-transfer-ledger:export']");
    expect(indexSource).toContain("'ledger-abnormal-row'");
    expect(indexSource).toContain('包括出库单未审批、尚未生成入库单');
    expect(indexSource).toContain('BusinessReportShell');
    expect(indexSource).toContain('经营报表 · 调拨、移仓及在途');
    expect(indexSource).toContain(':notices="ledgerStageSections"');
    expect(indexSource).toContain(':denied="!canQueryAnyTransferReport"');
    expect(indexSource).toContain('erp:stock-transfer-ledger:query');
    expect(indexSource).toContain('erp:stock-transfer-out:query');
    expect(indexSource).toContain('erp:stock-transfer-in:query');
    expect(indexSource).toContain('tab="调拨出入库台账"');
    expect(indexSource).toContain('tab="调拨出库单只读参考"');
    expect(indexSource).toContain('tab="调拨入库单只读参考"');
    expect(indexSource).toContain('TransferDocumentReadonlyTable');
    expect(indexSource).not.toContain('<Page');
    expect(indexSource).toContain(
      '第一阶段复用现有调拨出入库台账展示发出、入库、差异和异常',
    );
    expect(indexSource).toContain('真实多级变价调拨利润');
    expect(indexSource).toContain('调出过账与调入收货拆分');
    expect(indexSource).toContain('在途结算成本');
    expect(indexSource).toContain('内部利润实现、未实现抵销');
    expect(indexSource).toContain('不启用双成本新核算');
    expect(indexSource).toContain('不新增调拨、收货或结算业务动作');
    expect(indexSource).toContain('getStockTransferLedgerPage(params)');
    expect(indexSource).toContain('getStockTransferLedgerTotal(params)');
    expect(indexSource).toContain('exportStockTransferLedger(params)');
    expect(indexSource).toContain('<DetailModal');
    expect(indexSource).toContain('同部门移仓');
    expect(indexSource).toContain('不产生调拨收入或调拨利润');
    expect(indexSource).toContain('销售手推车自动调拨链');
    expect(indexSource).toContain('不重复生成调拨');
    expect(indexSource).toContain('内部利润分配');
    expect(
      columns.find((column) => column.field === 'businessDate'),
    ).toMatchObject({ minWidth: 120 });
    expect(columns.find((column) => column.field === 'action')).toMatchObject({
      fixed: 'right',
      width: 76,
    });
    expect(columns).not.toContainEqual(
      expect.objectContaining({ field: 'pendingGroupCount' }),
    );
  });

  it('keeps the report shell and grid shell in a full-height flex chain', () => {
    expect(indexSource).toMatch(
      /<BusinessReportShell[\s\S]*class="stock-transfer-ledger-grid-shell"/,
    );
    expect(indexSource).toMatch(
      /\.stock-transfer-ledger-report-tabs\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;[\s\S]*?\}/,
    );
    expect(indexSource).toMatch(
      /\.stock-transfer-ledger-grid-shell\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;[\s\S]*?\}/,
    );
  });

  it('adds read-only transfer document reference tabs without write actions', () => {
    expect(transferDocumentReadonlySource).toContain('调拨出库单只读参考');
    expect(transferDocumentReadonlySource).toContain('调拨入库单只读参考');
    expect(transferDocumentReadonlySource).toContain('getStockTransferOutPage');
    expect(transferDocumentReadonlySource).toContain('getStockTransferInPage');
    expect(transferDocumentReadonlySource).toContain('includeItems: false');
    expect(transferDocumentReadonlySource).toContain("emit('openDocument'");
    expect(transferDocumentReadonlySource).toContain(
      'appendReportReferenceColumns',
    );
    expect(transferDocumentReadonlySource).toContain("field: 'relatedMoveNo'");
    expect(transferDocumentReadonlySource).toContain("title: '来源出库单号'");
    expect(transferDocumentReadonlySource).toContain("field: 'sourceNo'");
    expect(transferDocumentReadonlySource).toContain("field: 'sourceOutNo'");
    expect(transferDocumentReadonlySource).toContain("field: 'logisticsNo'");
    expect(transferDocumentReadonlySource).toContain(
      "field: 'logisticsCompany'",
    );
    expect(transferDocumentReadonlySource).toContain("title = '单据金额'");
    expect(transferDocumentReadonlySource).toContain('本页单据金额');
    expect(transferDocumentReadonlySource).toContain(
      '单据金额仅用于来源追溯，不代表正式在途结算成本、调拨收入或内部利润',
    );
    expect(transferDocumentReadonlySource).toContain(
      '不提供新增、修改、提交、审核、删除、解锁、打印或微信通知动作',
    );
    expect(transferDocumentReadonlySource).toContain(
      '不提供收货、修改、删除、导出或明细维护动作',
    );
    expect(transferDocumentReadonlySource).toContain("'deleteAction'");
    expect(transferDocumentReadonlySource).toContain("'printAction'");
    expect(transferDocumentReadonlySource).toContain("'wechatNotifyAction'");
    expect(transferDocumentReadonlySource).toContain("'continueBuyAction'");
    expect(transferDocumentReadonlySource).toContain('reportDetailAction');
    expect(transferDocumentReadonlySource).not.toContain(
      'createStockTransferOut',
    );
    expect(transferDocumentReadonlySource).not.toContain(
      'updateStockTransferOut',
    );
    expect(transferDocumentReadonlySource).not.toContain(
      'submitStockTransferOutDraft',
    );
    expect(transferDocumentReadonlySource).not.toContain(
      'approveStockTransferOut',
    );
    expect(transferDocumentReadonlySource).not.toContain('unlockSaleCart');
    expect(transferDocumentReadonlySource).not.toContain(
      'deleteStockTransferOut',
    );
    expect(transferDocumentReadonlySource).not.toContain(
      'exportStockTransferOut',
    );
    expect(transferDocumentReadonlySource).not.toContain(
      'exportStockTransferIn',
    );
    expect(transferDocumentReadonlySource).toMatch(
      /\.transfer-document-readonly-table\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;[\s\S]*?\}/,
    );
    expect(transferDocumentReadonlySource).toMatch(
      /\.transfer-document-readonly-table__grid\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;[\s\S]*?\}/,
    );
  });

  it('marks abnormal rows with text and supports both document detail links', () => {
    expect(detailSource).toContain("'ledger-abnormal-row'");
    expect(detailSource).toContain('record.exceptionReason');
    expect(detailSource).toContain("emit('openTransferOut'");
    expect(detailSource).toContain("emit('openTransferIn'");
    expect(detailSource).toContain(
      '<template v-else-if="column.dataIndex === \'transferInNo\'">',
    );
    expect(detailSource).toContain('<span v-else></span>');
    expect(detailSource).toContain('loadSequence');
    expect(detailSource).toContain('normalizeStockTransferLedgerDate');
    expect(detailSource).toContain(
      '本页 {{ currentPageAbnormalCount }} 组异常',
    );
    expect(detailSource).toContain(
      '当前台账用于出入库配对追溯，不是正式在途结算或内部利润报表',
    );
  });

  it('applies field permissions to query, summary and detail columns', () => {
    expect(useGridFormSchema(['query_productId'])).not.toContainEqual(
      expect.objectContaining({ fieldName: 'productKeyword' }),
    );
    expect(useGridColumns(['report_differenceCount'])).not.toContainEqual(
      expect.objectContaining({ field: 'differenceCount' }),
    );
    expect(detailSource).toContain('report_');
    expect(detailSource).toContain('column.dataIndex');
  });

  it('serializes picker and detail dates as backend-compatible strings', () => {
    expect(
      normalizeStockTransferLedgerParams({
        moveTime: [
          dayjs('2026-06-27 00:00:00') as any,
          dayjs('2026-07-26 23:59:59') as any,
        ],
      }).moveTime,
    ).toEqual(['2026-06-27 00:00:00', '2026-07-26 23:59:59']);
    expect(
      normalizeStockTransferLedgerDate(
        dayjs('2026-07-26 12:30:45'),
        'YYYY-MM-DD',
      ),
    ).toBe('2026-07-26');
    expect(normalizeStockTransferLedgerDate([2026, 7, 23], 'YYYY-MM-DD')).toBe(
      '2026-07-23',
    );
  });
});
