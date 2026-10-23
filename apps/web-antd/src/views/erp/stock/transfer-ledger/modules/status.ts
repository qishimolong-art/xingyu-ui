import type { ErpStockTransferLedgerApi } from '#/api/erp/stock/transfer-ledger';

export const LEDGER_STATUS_META: Record<
  ErpStockTransferLedgerApi.MatchStatus,
  { color: string; label: string }
> = {
  NORMAL: { color: 'success', label: '正常' },
  ABNORMAL: { color: 'error', label: '异常' },
};

export const EXCEPTION_OPTIONS = [
  { label: '缺少调拨入库', value: 'MISSING_TRANSFER_IN' },
  { label: '孤立调拨入库', value: 'ORPHAN_TRANSFER_IN' },
  { label: '重复调拨入库', value: 'DUPLICATE_TRANSFER_IN' },
  { label: '关联关系异常', value: 'BROKEN_BIDIRECTIONAL_LINK' },
  { label: '状态不一致', value: 'STATUS_MISMATCH' },
  { label: '调拨日期不一致', value: 'DATE_MISMATCH' },
  { label: '部门不一致', value: 'DEPT_MISMATCH' },
  { label: '缺少出库明细', value: 'ITEM_MISSING_OUT' },
  { label: '缺少入库明细', value: 'ITEM_MISSING_IN' },
  { label: '仓库不一致', value: 'WAREHOUSE_MISMATCH' },
  { label: '批次不一致', value: 'BATCH_MISMATCH' },
  { label: '数量不一致', value: 'COUNT_MISMATCH' },
];

export function getLedgerStatusMeta(
  status?: ErpStockTransferLedgerApi.MatchStatus,
) {
  return status ? LEDGER_STATUS_META[status] : LEDGER_STATUS_META.NORMAL;
}
